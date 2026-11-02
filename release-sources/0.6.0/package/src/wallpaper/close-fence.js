import { randomUUID } from 'node:crypto';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const counter = value => Number.isSafeInteger(value) && value >= 0;
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const refusal = error => Object.freeze({ ok: false, error });

/** Host-local admission fence. No timers, retries, preference writes or native IO of its own.
 * Once explicitly used, legacy starts remain blocked for this Host's entire lifetime.
 * The private activation capability is only returned to the owner of the current fence.
 * This is lifecycle ordering, not authentication against other local applications.
 */
export function createCloseFence({ hostInstanceId, readCloseState, stopNow, touchCloseState }) {
  let fence = null;
  let admission = null;

  const stateOf = close => {
    if (close.lifecycle !== 'active') return 'disposed';
    if (fence.released) return 'released';
    if (fence.pending) return 'pending';
    if (fence.unknown || close.uncertain) return 'unknown';
    if (close.pendingCount || close.ownership) return 'pending';
    if (!fence.stopped || !close.quiescent) return 'unconfirmed';
    return 'ready';
  };
  const snapshot = () => {
    const close = readCloseState();
    return Object.freeze({ version: 1, hostInstanceId, fenceId: fence.id,
      requestId: fence.requestId, attempt: fence.attempt, state: stateOf(close),
      close, canCommit: false });
  };
  const answer = () => Object.freeze({ ok: true, snapshot: snapshot() });
  const owned = body => body.hostInstanceId === hostInstanceId && fence && body.fenceId === fence.id;
  const runStop = () => {
    const current = fence;
    current.pending = true;
    current.stopped = false;
    // stopNow bumps cancellation synchronously, before any awaited native operation.
    // The request returns without waiting for a stuck helper. Pending is never success.
    let job;
    try { job = stopNow(); } catch { current.unknown = true; current.pending = false; return; }
    Promise.resolve(job).then(outcome => {
      try {
        if (!outcome || typeof outcome.ok !== 'boolean' || !outcome.payload
          || typeof outcome.payload.failed !== 'boolean') current.unknown = true;
        else current.stopped = outcome.ok === true && outcome.payload.failed === false;
      } catch { current.unknown = true; }
    }, () => { current.unknown = true; }).then(() => { current.pending = false; });
  };

  return Object.freeze({
    admissionError(value, { stop = false } = {}) {
      if (readCloseState().lifecycle !== 'active') return 'close-fence-disposed';
      if (!fence) return null; // unchanged legacy behaviour until explicit preparation
      if (!fence.released) return stop ? null : 'close-fence-sealed';
      return typeof value === 'string' && value === admission ? null : 'close-fence-admission';
    },
    prepare(body) {
      if (!shape(body, ['hostInstanceId', 'revision', 'requestId'])
        || !uuid(body.hostInstanceId) || !uuid(body.requestId) || !counter(body.revision)) return refusal('close-fence-invalid');
      const close = readCloseState();
      if (close.lifecycle !== 'active') return refusal('close-fence-disposed');
      if (body.hostInstanceId !== hostInstanceId) return refusal('close-fence-host');
      // A lost response may be retrieved using the EXACT original request. No second stop.
      if (fence?.requestId === body.requestId) {
        return body.revision === fence.preparedRevision ? answer() : refusal('close-fence-conflict');
      }
      if (fence && !fence.released) return refusal('close-fence-owned');
      if (body.revision !== close.revision) return refusal('close-fence-stale');
      fence = { id: randomUUID(), requestId: body.requestId, preparedRevision: body.revision,
        attempt: 1, pending: false, stopped: false, unknown: false, released: false };
      admission = null;
      touchCloseState();
      runStop();
      return answer();
    },
    inspect(body) {
      if (!shape(body, ['hostInstanceId', 'fenceId']) || !owned(body)) return refusal('close-fence-owner');
      return answer();
    },
    retry(body) {
      if (!shape(body, ['hostInstanceId', 'fenceId', 'attempt']) || !owned(body)
        || !counter(body.attempt) || body.attempt < 1) return refusal('close-fence-owner');
      const view = snapshot();
      // The immediately previous attempt is an idempotent duplicate, never a new retry.
      if (body.attempt === fence.attempt - 1) return answer();
      if (body.attempt !== fence.attempt || fence.attempt === Number.MAX_SAFE_INTEGER) return refusal('close-fence-conflict');
      if (view.state !== 'unconfirmed') return refusal('close-fence-not-retryable');
      fence.attempt += 1;
      touchCloseState();
      runStop();
      return answer();
    },
    activate(body) {
      if (!shape(body, ['hostInstanceId', 'fenceId', 'revision']) || !owned(body)
        || !counter(body.revision)) return refusal('close-fence-owner');
      const close = readCloseState();
      if (close.lifecycle !== 'active') return refusal('close-fence-disposed');
      if (fence.released) {
        if (body.revision !== fence.activatedRevision) return refusal('close-fence-conflict');
      } else {
        if (stateOf(close) !== 'ready') return refusal('close-fence-not-ready');
        if (close.revision !== body.revision) return refusal('close-fence-stale');
        fence.activatedRevision = body.revision;
        fence.released = true;
        admission = randomUUID();
        touchCloseState();
      }
      return Object.freeze({ ok: true, admission, snapshot: snapshot() });
    },
  });
}

/** Only the new fence protocol uses this bounded, strict body reader. A caller timeout
 * never releases a fence or cancels a lifecycle write which has already been accepted.
 */
export async function readCloseFenceBody(req) {
  const iterator = req[Symbol.asyncIterator]();
  const chunks = [];
  let bytes = 0, count = 0, timer, failed = false;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('close-fence-body-timeout')), 1000); });
  try {
    while (true) {
      const part = await Promise.race([iterator.next(), deadline]);
      if (part.done) break;
      if (++count > 64 || !(part.value instanceof Uint8Array)) throw Error('close-fence-body-invalid');
      bytes += part.value.byteLength;
      if (bytes > 1024) throw Error('close-fence-body-invalid');
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) { failed = true; throw error; }
  finally {
    clearTimeout(timer);
    if (failed) {
      // Destroy only this incomplete inbound request. Do not await an uncooperative iterator.
      try { req.destroy?.(); } catch {}
      try { Promise.resolve(iterator.return?.()).catch(() => {}); } catch {}
    }
  }
}
