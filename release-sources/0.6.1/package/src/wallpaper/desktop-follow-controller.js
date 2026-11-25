// Candidate orchestration only. No timers that poll automatically, native calls or IO on
// import/construction; query, lookup and own-plugin playback are explicit private ports.
import { isSceneId, parseAgeRatings } from '../appearance-contract.js';
import { currentWallpaperArgs } from './desktop-follow-selection.js';

const failure = code => Object.assign(Error(code), { followReason: code });

export function createDesktopFollowController({ query, lookup, playback, initial = {},
  queryMs = 12000, verifyMs = 5000, playbackMs = 45000, tickMs = 60000 } = {}) {
  for (const value of [queryMs, verifyMs, playbackMs]) if (!Number.isInteger(value) || value < 1 || value > 60000) throw failure('invalid-timeout');
  if (!Number.isInteger(tickMs) || tickMs < 1 || tickMs > 120000) throw failure('invalid-total-timeout');
  const normalize = input => {
    const config = { enabled: Object.hasOwn(input, 'enabled') ? input.enabled : false,
      wanted: Object.hasOwn(input, 'wanted') ? input.wanted : false,
      manualSceneId: input.manualSceneId ?? null, monitor: input.monitor ?? null,
      allowedRatings: parseAgeRatings(input.allowedRatings) };
    if (typeof config.enabled !== 'boolean' || typeof config.wanted !== 'boolean' ||
        (config.manualSceneId !== null && !isSceneId(config.manualSceneId))) throw failure('invalid-config');
    currentWallpaperArgs({ monitor: config.monitor }); return config;
  };
  let config = normalize(initial), generation = 0, disposed = false, inFlight = null;
  let abort = new AbortController(), blocked = false, phase = 'idle', reason = null, desiredSceneId = null;
  const realOperations = new Set();
  function state() {
    let current;
    try { current = playback.state(); } catch { current = { failed: true }; }
    return { ...structuredClone(config), generation, disposed, phase, reason, desiredSceneId,
      activeSceneId: current.activeSceneId ?? null, pendingOperations: realOperations.size, blocked };
  }
  async function bounded(kind, operation, timeoutMs, signal) {
    if (signal?.aborted) throw failure('cancelled');
    const item = { kind }, real = Promise.resolve().then(() => {
      if (signal?.aborted) throw failure('cancelled');
      return operation();
    });
    realOperations.add(item);
    real.then(() => realOperations.delete(item), () => realOperations.delete(item));
    let timer, onAbort;
    try {
      return await Promise.race([real, new Promise((_, reject) => {
        timer = setTimeout(() => reject(failure(kind + '-timeout')), timeoutMs);
        onAbort = () => reject(failure('cancelled'));
        signal?.addEventListener('abort', onAbort, { once: true });
      })]);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  }
  const invalidate = () => { generation += 1; abort.abort(); abort = new AbortController(); };
  async function stopOwnPreview() {
    try {
      // Existing stopNow invalidates a restart synchronously, before its first await.
      const stopping = playback.stop();
      await bounded('stop', () => stopping, playbackMs);
      const current = playback.state();
      const mutationPending = [...realOperations].some(op => ['switch', 'stop'].includes(op.kind));
      if (current.quiescent !== true || current.failed === true || mutationPending) throw failure('cleanup-unconfirmed');
      blocked = false; return true;
    } catch { blocked = true; phase = 'blocked'; reason = 'cleanup-unconfirmed'; return false; }
  }
  async function run() {
    const epoch = generation, signal = abort.signal, current = () => !disposed && generation === epoch && !signal.aborted;
    const deadline = performance.now() + tickMs;
    const budget = cap => {
      const left = Math.floor(deadline - performance.now());
      if (left < 1) throw failure('tick-timeout');
      return Math.min(cap, left);
    };
    if (disposed || !config.wanted) { phase = disposed ? 'disposed' : 'paused'; return state(); }
    if (blocked) return state();
    if (realOperations.size) { phase = 'waiting'; reason = 'previous-operation-pending'; return state(); }
    const hostState = playback.state();
    if (hostState.failed === true) { blocked = true; phase = 'blocked'; reason = 'cleanup-unconfirmed'; return state(); }
    try {
      let next;
      if (config.enabled) {
        phase = 'querying';
        const raw = await bounded('query', () => query({ monitor: config.monitor, signal }), budget(queryMs), signal);
        if (!current()) return state();
        phase = 'matching';
        next = await bounded('verify', () => lookup.resolve(raw, { allowedRatings: config.allowedRatings, signal, isCurrent: current }), budget(verifyMs), signal);
      } else {
        if (config.manualSceneId === null) { phase = 'paused'; desiredSceneId = null; return state(); }
        phase = 'matching';
        await bounded('verify', () => lookup.verifyForPlayback(config.manualSceneId,
          { allowedRatings: config.allowedRatings, signal, isCurrent: current }), budget(verifyMs), signal);
        next = { status: 'ready', sceneId: config.manualSceneId };
      }
      if (!current()) return state();
      if (next.status !== 'ready') throw failure(next.reason ?? 'desktop-target-unavailable');
      desiredSceneId = next.sceneId;
      const before = playback.state();
      if (before.activeSceneId === next.sceneId && before.active === true && before.failed !== true) {
        phase = 'running'; reason = null; return state();
      }
      phase = 'switching';
      await bounded('switch', () => {
        if (!current()) throw failure('cancelled');
        return playback.restart(next.sceneId);
      }, budget(playbackMs), signal);
      if (!current()) return state();
      const active = playback.state();
      if (active.activeSceneId !== next.sceneId || active.active !== true || active.failed === true) throw failure('switch-unconfirmed');
      phase = 'running'; reason = null;
    } catch (error) {
      if (!current()) return state();
      invalidate(); const cleanupEpoch = generation; desiredSceneId = null;
      const stopped = await stopOwnPreview();
      if (!disposed && generation === cleanupEpoch && stopped) { phase = 'suspended'; reason = error.followReason ?? 'operation-failed'; }
    }
    return state();
  }
  return {
    state,
    cancelStartupIntent(){config={...config,wanted:false};invalidate();desiredSceneId=null;return state();},
    tick() {
      if (inFlight) return inFlight;
      const task = run().finally(() => { if (inFlight === task) inFlight = null; }); inFlight = task; return task;
    },
    async configure(patch) {
      if (disposed) throw failure('disposed');
      const next = normalize({ ...config, ...patch });
      if (JSON.stringify(next) === JSON.stringify(config)) return state();
      const manualOnly = next.enabled && config.enabled && JSON.stringify({ ...next, manualSceneId: null }) === JSON.stringify({ ...config, manualSceneId: null });
      config = next;
      if (manualOnly) return state();
      invalidate(); desiredSceneId = null; phase = 'idle'; reason = null;
      const before = playback.state();
      if (inFlight || before.active === true || before.quiescent !== true || blocked) await stopOwnPreview();
      return state(); // Reading/configuring preferences never starts a new source.
    },
    async stop() {
      if (disposed) return state();
      config = { ...config, wanted: false }; invalidate(); desiredSceneId = null;
      if (await stopOwnPreview()) { phase = 'paused'; reason = null; }
      return state();
    },
    async retryCleanup() {
      if (disposed) throw failure('disposed'); invalidate();
      if (await stopOwnPreview()) { phase = 'idle'; reason = null; }
      return state();
    },
    async dispose() {
      if (disposed) return state();
      disposed = true; config = { ...config, wanted: false }; invalidate(); desiredSceneId = null;
      await stopOwnPreview(); phase = 'disposed'; return state();
    },
  };
}
