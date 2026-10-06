import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FrameHub, streamFrames } from './frame-hub.js';
import { ProbeJournal } from './probe-log.js';
import { runHelper, waitForWindow, validateLocation, newLocation } from './managed-window.js';
import { SCENES, PREVIEW_SECONDS, WINDOW_SIZE, resolveSceneRequest, describeScenes } from './scenes.js';

/**
 * Wallpaper Engine preview for the Whale Appearance theme.
 *
 * The window/capture lifecycle is the one verified by the supervised QA package
 * (qa/wallpaper-preview 0.0.7). What is specific to a real theme:
 *
 *  - no TEMP config file, no development path, no historical PID/HWND: the scene comes
 *    from the Host-side whitelist and the helper is resolved from this package;
 *  - the frontend submits only a constrained action plus a scene id — never a path, an
 *    output directory, a command or a window handle;
 *  - run metadata stays under a controlled per-user directory and is rotated;
 *  - operations are owned: a start, a stop and an unload cannot interleave into two
 *    live windows, and cleanup results are reported instead of being dropped.
 */

export const MAX_RUN_DIRECTORIES = 8;

export { SCENES, PREVIEW_SECONDS, describeScenes, resolveSceneRequest };

/** Resolves the helper and log root from this module's own package location. */
export function resolveHostResources(moduleUrl = import.meta.url, env = process.env) {
  const root = resolve(fileURLToPath(new URL('../..', moduleUrl)));
  const localAppData = env.LOCALAPPDATA ?? env.TEMP;
  if (!localAppData) throw new Error('no writable per-user directory is available');
  return { root, helper: join(root, 'assets', 'wallpaper', 'WallpaperProbe.exe'), logRoot: join(localAppData, 'Whale Appearance', 'wallpaper-preview') };
}

/**
 * Host-side availability. The theme is browser-only outside the official Windows
 * desktop; the preview additionally needs the packaged helper and the local sample.
 */
export function probeAvailability({ platform = process.platform, env = process.env, helper, scenes = SCENES, exists = existsSync } = {}) {
  if (platform !== 'win32') return { available: false, reason: 'platform', missing: [] };
  if (!env.LOCALAPPDATA) return { available: false, reason: 'host', missing: [] };
  if (!helper || !exists(helper)) return { available: false, reason: 'helper', missing: [] };
  const missing = Object.values(scenes).filter(scene => !exists(scene.project)).map(scene => scene.id);
  if (missing.length === Object.keys(scenes).length) return { available: false, reason: 'scene', missing };
  return { available: true, reason: '', missing };
}

/** Keeps the newest `limit` run directories and drops the rest. */
export async function pruneRuns(logRoot, limit = MAX_RUN_DIRECTORIES) {
  let entries;
  try { entries = await readdir(logRoot, { withFileTypes: true }); } catch { return []; }
  const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const removed = [];
  for (const name of directories.slice(0, Math.max(0, directories.length - limit))) {
    try { await rm(join(logRoot, name), { recursive: true, force: true }); removed.push(name); } catch { /* keep the run */ }
  }
  return removed;
}

export async function prepareRunDirectory(logRoot, sceneId, now = Date.now(), suffix = Math.random().toString(16).slice(2, 6)) {
  // Millisecond precision plus a suffix: two starts in the same second must never share
  // a directory, because the native capture refuses to overwrite existing evidence.
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '').replace('Z', '').slice(0, 17);
  const output = join(logRoot, `${stamp}-${suffix}-${sceneId}`);
  await mkdir(output, { recursive: true });
  return output;
}

/**
 * One preview run. `create` builds this run's instance; `stop` is idempotent and always
 * ends by proving this run's window is gone. Injectable for tests: spawnChild,
 * helperRun, sleep, now, exists.
 */
export function createPreviewSession(options = {}) {
  const {
    spawnChild = spawn,
    helperRun = (helper, args) => runHelper(spawn, helper, args),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    now = Date.now,
    exists = existsSync,
  } = options;
  const hub = new FrameHub();
  const journal = new ProbeJournal();

  let config = null;
  let child = null;
  let stopping = false;
  let stopRequested = false;
  let failure = null;
  let nativeStatus = null;
  let clientStatus = null;
  let location = null;
  let windowCreated = false;
  let windowPid = null;
  let captureStarted = false;
  let cleaning = null;
  let attached = false;
  let cleanupResult = null;
  let windowAcquisitionWait = null;
  let reportTimer = null;
  let killTimer = null;

  const helper = args => helperRun(config.helper, args);

  const report = () => ({
    transport: 'pipe-stream',
    childPid: child?.pid ?? null,
    window: { location, pid: windowPid, created: windowCreated, captureStarted, cleanup: cleanupResult },
    stopping,
    failure,
    native: nativeStatus,
    diagnostics: journal.snapshot(),
    client: clientStatus,
    ...hub.snapshot(),
  });

  /** True only when this run's window is proven gone. */
  const isClosed = () => cleanupResult?.closed === true;

  const writeReport = async name => {
    if (!config?.output) return;
    try { await writeFile(join(config.output, name), JSON.stringify(report(), null, 2)); } catch { /* evidence is best effort */ }
  };

  /**
   * One close attempt. Idempotent while it is in flight, but a finished attempt that
   * could NOT prove the window gone must not freeze the session forever: a later stop
   * retries the close instead of returning the cached failure.
   *
   * The reporting loop and the capture subscriptions are removed for the whole close. Only
   * an unproven close re-attaches them (the capture may still be alive and its evidence is
   * still worth keeping), so a successful stop leaves no timer and no duplicate listener.
   */
  const runClose = async () => {
    stopping = true;
    detach();
    hub.close();
    child?.stdin?.end('stop\n');
    if (child && child.exitCode === null) killTimer = setTimeout(() => child?.kill(), 2500);
    killTimer?.unref();
    await writeReport('preview-final.json');

    // Bounded verdict: a stop that lands while the window is still being created must
    // still close the window that appears afterwards.
    if (windowAcquisitionWait) { try { await windowAcquisitionWait; } catch { /* reported by create/stop */ } }

    if (windowCreated && location) {
      const closeArgs = ['--window-ensure-closed', location, '15000'];
      if (Number.isInteger(windowPid) && windowPid > 0) closeArgs.push('--expect-pid', String(windowPid));
      try {
        const closed = await helper(closeArgs);
        cleanupResult = { outcome: closed?.outcome ?? null, closed: closed?.closed === true, waitedMs: closed?.waitedMs ?? null, error: closed?.error ?? null };
      } catch (error) {
        cleanupResult = { outcome: 'error', closed: false, error: error.message };
      }
      if (cleanupResult.closed !== true) {
        const attempt = Number.isInteger(cleanupResult.attempts) ? cleanupResult.attempts + 1 : 1;
        cleanupResult = { ...cleanupResult, attempts: attempt };
        failure ??= `Window cleanup incomplete (${cleanupResult.outcome ?? 'unknown'}): ${cleanupResult.error ?? 'no result'}`;
        // The capture may still be running this window: keep its evidence flowing until the
        // next attempt proves the window gone.
        reattach();
      }
    }
    detach();
    await writeReport('preview-final.json');
    return cleanupResult;
  };

  const cleanup = () => {
    if (!cleaning) cleaning = runClose().finally(() => { cleaning = null; });
    return cleaning;
  };

  const stop = () => {
    stopRequested = true;
    if (cleaning) return cleaning;                       // one in-flight close stays idempotent
    if (cleanupResult?.closed === true) return Promise.resolve(cleanupResult);
    return cleanup();                                    // retry after an unproven close
  };

  async function create({ helper: helperPath, output, scene }) {
    if (cleaning) throw new Error('this preview run has already ended');
    if (config) throw new Error('this preview session already started a run');
    const request = resolveSceneRequest({ scene: scene?.sceneId, seconds: scene?.seconds }, { exists });
    config = {
      helper: helperPath,
      output,
      location: validateLocation(scene?.location ?? newLocation(now())),
      project: request.project,
      seconds: request.seconds,
      width: request.width,
      height: request.height,
      fps: request.fps,
      sceneId: request.sceneId,
    };
    location = config.location;
    if (stopRequested) { await stop(); throw new Error('this preview run was stopped before it started'); }

    // 1. Create this run's own window; the name is claimed before the side effect.
    windowCreated = true;
    try {
      const polls = waitForWindow(helper, location, { sleep });
      const opened = helper(['--we-open', location, config.project, String(config.width), String(config.height)]);
      const settledWithFailure = opened.then(() => null, error => error);
      let openSettled = false;
      settledWithFailure.then(() => { openSettled = true; }).catch(() => {});
      const createWait = Promise.race([
        settledWithFailure.then(() => 'settled'),
        sleep(6000).then(() => 'grace'),
      ]).catch(() => 'grace');
      const extend = () => waitForWindow(helper, location, { sleep, fastAttempts: 0, graceAttempts: 0, attempts: 100, delayMs: 100 });
      windowAcquisitionWait = (async () => {
        const phase = await createWait;
        const openError = await settledWithFailure;
        const found = await polls;
        if (found) return found;
        const late = phase === 'settled' ? null : await extend();
        if (openError) throw openError;
        return late;
      })();
      windowAcquisitionWait.catch(() => {});

      const window = await polls;
      const openFailure = await settledWithFailure;
      if (openFailure) {
        const late = await windowAcquisitionWait.catch(() => null);
        if (late) { config.window = late.hwnd; windowPid = Number.isInteger(late.pid) && late.pid > 0 ? late.pid : null; }
        throw openFailure;
      }
      if (!window) {
        failure ??= 'Window setup failed: the window did not appear';
        await stop();
        throw new Error(failure);
      }
      config.window = window.hwnd;
      windowPid = Number.isInteger(window.pid) && window.pid > 0 ? window.pid : null;
      nativeStatus = { windowReady: { hwnd: window.hwnd, pid: window.pid, visible: window.visible, left: window.left, top: window.top } };
    } catch (error) {
      failure = failure ?? `Window setup failed: ${error.message}`;
      await stop();
      throw new Error(failure);
    }
    if (stopRequested) { await stop(); throw new Error('this preview run was stopped before capture started'); }

    // 2. Capture. The native side builds the capture item while the window is still
    //    visible (WGC refuses hidden and tool windows), then the window is tucked away.
    child = spawnChild(config.helper, [String(config.window), output, String(config.seconds), String(config.fps), 'pipe',
      '--owned-location', location], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {});
    attachCapture();
    return report();
  }

  /**
   * Subscribe to the capture child: frames, native status and its exit. The listeners are
   * named so they can be removed again; `attachCapture` refuses to install a second copy,
   * which is what keeps a close retry from accumulating listeners and log timers.
   */
  const onChildStdout = data => { try { hub.push(data); } catch { /* keep the last frame */ } };
  const onChildError = error => { failure = error.message; stop(); };
  const onChildClose = code => {
    clearTimeout(killTimer);
    stopReporting();
    journal.finish();
    try { hub.decoder.finish(); } catch { /* keep the last frame */ }
    if (code && !stopping) failure ??= `Capture exited: ${code}`;
    stop();
  };
  const onChildStderr = data => {
    for (const entry of journal.push(data)) {
      if (entry.level === 'error' && !stopping) { failure ??= journal.failureText(entry); stop(); }
      if (entry.scope === 'Status') {
        try {
          const value = JSON.parse(entry.message);
          nativeStatus = { ...nativeStatus, ...value };
          if (value.captureSource === 'window' && !captureStarted) {
            captureStarted = true;
            const args = ['--window-apply', String(config.window), 'offscreen', '--location', location];
            if (windowPid) args.push('--pid', String(windowPid));
            helper(args)
              .then(state => { nativeStatus = { ...nativeStatus, tucked: { visible: state.visible, left: state.left, top: state.top } }; })
              .catch(error => { nativeStatus = { ...nativeStatus, tuckError: error.message }; failure ??= `Window tuck failed: ${error.message}`; stop(); });
          }
        } catch { /* keep the last readable status */ }
      }
    }
  };

  const stopReporting = () => {
    if (reportTimer) { clearInterval(reportTimer); reportTimer = null; }
  };

  function attachCapture() {
    if (attached || !child) return false;
    attached = true;
    child.stdout.on('data', onChildStdout);
    child.stderr.on('data', onChildStderr);
    child.on('error', onChildError);
    child.on('close', onChildClose);
    reportTimer = setInterval(() => { writeReport('preview-status.json'); }, 1000);
    reportTimer.unref();
    return true;
  }

  /** Remove every capture subscription and the reporting loop; safe to call repeatedly. */
  function detach() {
    stopReporting();
    if (!attached || !child) return false;
    attached = false;
    child.stdout.off('data', onChildStdout);
    child.stderr.off('data', onChildStderr);
    child.off('error', onChildError);
    child.off('close', onChildClose);
    return true;
  }

  /**
   * Re-take ownership of a capture child that is still running after an unproven close.
   * Only that case re-attaches: a successful stop must leave no timer and no listener behind.
   */
  const reattach = () => {
    if (!child || child.exitCode !== null) return false;
    detach();
    return attachCapture();
  };

  return {
    hub,
    journal,
    report,
    create,
    stop,
    reattach,
    isClosed,
    ending: () => cleaning !== null,
    /** Test/diagnostic view of the lifecycle bookkeeping. */
    stats: () => ({
      attached,
      reporting: reportTimer !== null,
      closeListeners: child ? child.listenerCount('close') : 0,
      stdoutListeners: child ? child.listenerCount('data') : 0,
      stderrListeners: child ? child.listenerCount('data') : 0,
      cleanup: cleanupResult,
    }),
    state: () => ({ config, location, windowCreated, windowPid, captureStarted, stopRequested, cleanup: cleanupResult }),
    setClientStatus: value => { clientStatus = value; },
  };
}

/**
 * Host routes for the theme.
 *
 * Ownership rules (see the review of rc.2):
 *  - the operation lock is taken before the first await, so two starts cannot both pass
 *    the "already running" check;
 *  - a stop or unload invalidates an in-flight start: it bumps the generation and the
 *    start aborts before it builds anything;
 *  - while cleanup runs, ownership is retained, so a new start cannot overlap a window
 *    that is still closing;
 *  - when a close cannot be proven, the failed run is retained and reported, so the UI
 *    can say "cleanup failed" instead of showing a false success.
 */
export function registerWallpaperRoutes(ctx, { scenes = SCENES, helper, logRoot, sessionFactory = createPreviewSession, exists = existsSync, onWarn = message => console.warn(message) } = {}) {
  const buildSession = () => sessionFactory({ exists });

  let ownership = null;          // { kind: 'start' | 'stop', generation, promise }
  let generation = 0;
  let session = null;            // live or not-yet-proven-closed run
  let lastCleanup = null;        // last close outcome, kept for the UI and for retrying
  let lastError = '';

  const claim = kind => {
    const token = { kind, generation, promise: null };
    ownership = token;
    return token;
  };
  const release = token => { if (ownership === token) ownership = null; };
  const isCurrent = token => generation === token.generation;

  const statusPayload = (extra = {}) => {
    // A run that reached its time limit or ended on its own has already closed its window;
    // archive it so the reported state and the next explicit start agree.
    releaseFinishedSession();
    // A retained run keeps its own close evidence, so the reported failure is the real one
    // even when the run ended by itself and never went through the route's stop path. A
    // caller that already knows the close result passes it explicitly and wins.
    if (session && extra.lastCleanup === undefined) lastCleanup = session.state?.().cleanup ?? lastCleanup;
    const availability = probeAvailability({ helper, scenes, exists });
    const live = Boolean(session);
    const running = live && session.isClosed?.() !== true;
    return {
      available: availability.available,
      unavailableReason: availability.reason,
      missingScenes: availability.missing,
      previewSeconds: PREVIEW_SECONDS,
      scenes: describeScenes({ scenes, exists }),
      active: running,
      // A retained session whose close failed is reported as failed, never as stopped. The
      // caller's own close result (when there is one) decides this instead of stale evidence.
      failed: extra.cleanup ? extra.cleanup.closed !== true : Boolean(lastCleanup && lastCleanup.closed !== true),
      lastCleanup,
      error: extra.error ?? lastError,
      session: live ? session.report() : null,
      ...extra,
    };
  };

  /**
   * Archive a run that has finished and proven its window gone (time limit, capture ended).
   * A run that only stopped producing frames, or whose close is unproven, keeps ownership:
   * its window may still exist and the next start must not overlap it.
   */
  const releaseFinishedSession = () => {
    if (!session) return false;
    if (ownership?.kind === 'stop') return false;
    const state = session.state?.() ?? {};
    // Only a close that has actually been attempted and proven gone releases ownership. A
    // run that merely stopped producing frames, or whose close is still in flight or
    // unproven, keeps it: its window may still exist.
    if (state.cleanup?.closed !== true) return false;
    lastCleanup = state.cleanup;
    session = null;
    return true;
  };

  const closeSession = async () => {
    const current = session;
    if (!current) return { outcome: 'absent', closed: true };
    if (current.isClosed?.() === true) {
      // Already proven closed by the run itself: archive and release without a new close.
      const cleanup = current.state?.().cleanup ?? { outcome: 'closed', closed: true };
      lastCleanup = cleanup;
      session = null;
      lastError = '';
      return cleanup;
    }
    const result = await current.stop().catch(error => ({ outcome: 'error', closed: false, error: error.message }));
    lastCleanup = result ?? null;
    if (result?.closed === true) {
      session = null;
      lastError = '';
    } else {
      // Keep the failed run: its window may still exist, and the user needs a retry path.
      lastError = `Window cleanup incomplete (${result?.outcome ?? 'unknown'}): ${result?.error ?? 'no result'}`;
      onWarn(`[Whale wallpaper] ${lastError}`);
    }
    return result;
  };

  /**
   * Run one start. The ownership token is created by the caller before the request body is
   * read, so the whole "read body -> prepare -> create" sequence is covered by the lock and
   * a stop or unload can invalidate it before any resource exists.
   */
  const startWithToken = (token, body) => {
    token.promise = (async () => {
      if (!body) throw new Error('the request body was not read');
      if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
      // A run that ended on its own is released here as well, so a plain start works right
      // after the time limit instead of being refused by a session that no longer runs.
      releaseFinishedSession();
      if (session) throw new Error('a preview is already running or still being cleaned up');
      const availability = probeAvailability({ helper, scenes, exists });
      if (!availability.available) throw new Error(`wallpaper engine preview is unavailable: ${availability.reason}`);
      const request = resolveSceneRequest(body, { scenes, exists });
      const output = await prepareRunDirectory(logRoot, request.sceneId);
      await pruneRuns(logRoot);
      // A stop or unload that arrived during preparation wins over this start.
      if (!isCurrent(token)) throw new Error('the preview was stopped while it was starting');
      const next = buildSession();
      session = next;
      token.started = true;
      try {
        await next.create({ helper, output, scene: { sceneId: request.sceneId, seconds: request.seconds } });
      } catch (error) {
        await next.stop().catch(() => {});
        const result = next.state().cleanup ?? { outcome: 'absent', closed: true };
        lastCleanup = result;
        if (result.closed === true) session = null;
        throw error;
      }
      if (!isCurrent(token)) {
        // Stopped or unloaded during creation: tear the fresh run down and report it.
        await closeSession();
        throw new Error('the preview was stopped while it was starting');
      }
      lastError = '';
      return statusPayload();
    })();
    token.promise.catch(() => {});   // the HTTP handler reports it
    return token;
  };

  const settle = async token => {
    try {
      const payload = await token.promise;
      return { ok: true, payload };
    } catch (error) {
      lastError = error.message;
      return { ok: false, payload: statusPayload({ error: error.message }) };
    } finally {
      release(token);
    }
  };

  /**
   * Stop the current run without waiting for an in-flight start.
   *
   * A stop must answer now: waiting for a pending start would look like a hang, and the
   * generation bump already invalidates it — including one whose request body has not
   * arrived yet. Only a start that has really begun building this run's window is waited
   * for, so its rollback finishes before the close is decided.
   */
  const stopNow = async () => {
    generation += 1;
    const pending = ownership;
    const inFlight = pending?.kind === 'start' && pending.started ? pending.promise.catch(() => {}) : null;
    if (!session) {
      return { payload: statusPayload({ stopped: true, cleanup: null, pending: Boolean(inFlight), error: '' }), ok: true };
    }
    const token = claim('stop');
    token.promise = (async () => {
      if (inFlight) await inFlight;
      const result = await closeSession();
      // Placeholder: the payload is rebuilt after the settle below, so it always reflects the
      // state that the close actually produced instead of the state before it ran.
      return { cleanup: result ?? null };
    })();
    token.promise.catch(() => {});
    const outcome = await settle(token);
    const stopped = outcome.payload?.cleanup?.closed === true;
    return { ok: outcome.ok, payload: statusPayload({ stopped, cleanup: outcome.payload?.cleanup ?? null }) };
  };

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/whale-wallpaper',
    async handler(req, res) {
      const path = new URL(req.url, 'http://localhost').pathname;
      res.setHeader('cache-control', 'no-store');
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.method === 'GET' && path === '/whale-wallpaper/status') { send(200, statusPayload()); return; }

      if (req.method === 'GET' && path === '/whale-wallpaper/stream') {
        if (!session || session.isClosed?.() === true || !session.hub.latest || session.hub.closed) {
          res.writeHead(503); res.end('Preview unavailable'); return;
        }
        streamFrames(session.hub, res);
        return;
      }

      if (req.method === 'POST' && (path === '/whale-wallpaper/start' || path === '/whale-wallpaper/restart')) {
        // The ownership token is created BEFORE the body is read, and it covers the whole
        // "read body -> prepare -> create" sequence. A second request that arrives while
        // the first body is still pending is refused immediately; a stop or unload during
        // that window invalidates the token, so the late body can no longer create
        // anything.
        if (ownership) { send(409, statusPayload({ error: 'a wallpaper preview operation is already in progress' })); return; }
        if (path.endsWith('/restart')) {
          const stopped = await stopNow();
          if (!stopped.ok || stopped.payload?.failed === true) { send(409, stopped.payload); return; }
          if (ownership) { send(409, statusPayload({ error: 'a wallpaper preview operation is already in progress' })); return; }
        }
        const token = claim('start');
        // Body reading happens while the token is owned, so this request is visible to a
        // stop or unload even before its body has arrived; both bump the generation, which
        // makes the late body unable to create anything.
        token.promise = (async () => {
          let body;
          try { body = await readJsonBody(req, 2048); }
          catch (error) { lastError = error.message; throw error; }
          return startWithToken(token, body).promise;
        })();
        token.promise.catch(() => {});
        const outcome = await settle(token);
        const badBody = !outcome.ok && /body|JSON/.test(String(outcome.payload?.error ?? ''));
        send(outcome.ok ? 200 : badBody ? 400 : 409, outcome.payload);
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/stop') {
        // A stop answers immediately even while a start is preparing; the queued close
        // still runs once that start has settled. A close that could not be proven is
        // reported as a failure, never as a successful stop.
        const outcome = await stopNow();
        const failed = !outcome.ok || outcome.payload?.failed === true;
        send(failed ? 409 : 200, outcome.payload);
        return;
      }

      if (req.method === 'POST' && path === '/whale-wallpaper/metrics') {
        try {
          const value = await readJsonBody(req, 2048);
          const allowed = ['received', 'rendered', 'dropped', 'sourceSequence', 'seconds', 'meanLatencyMs', 'maxLatencyMs', 'decodeErrors', 'hidden'];
          const clean = Object.fromEntries(allowed.filter(key => typeof value?.[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0).map(key => [key, value[key]]));
          session?.setClientStatus(clean);
          res.writeHead(204); res.end();
        } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
        return;
      }

      res.writeHead(404); res.end();
    },
  }), 'whale-mist: wallpaper engine preview routes');

  // Cordis awaits a disposer's returned promise, so unloading waits for the real close.
  ctx.effect(() => () => {
    generation += 1;                     // invalidate a start that is still preparing
    const pending = ownership;
    // A start whose request body has not been read yet owns nothing, so unloading must not
    // wait for that client; it waits only for a run that has really begun to be built.
    const inFlight = pending && (pending.kind !== 'start' || pending.started) ? pending.promise.catch(() => {}) : null;
    return (async () => {
      if (inFlight) await inFlight;
      await closeSession();
    })();
  }, 'whale-mist: wallpaper preview lifetime');

  return { statusPayload, stopNow, closeSession, releaseFinishedSession, currentSession: () => session, ownership: () => ownership };
}

async function readJsonBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
