// Isolated fixture for the Wallpaper Engine settings entry.
//
// It reuses qa/appearance-harness.js (real DOM/CSS/IndexedDB plus a small service stand-in)
// and adds a controllable mock Host: the client may only reach the constrained theme
// routes, the stream can be scripted (503 gaps, end, stall), and frames use the same WHL1
// framing the native helper produces.
const preview = {
  state: 'idle',
  frames: 0,
  host: null,
  metrics: [],
  streams: 0,
  stopped: 0,
  starts: 0,
  restarts: 0,
  requests: [],
  streamScript: [],     // queue of behaviours: 'ok' | 'unavailable' | 'end-after-first' | {delayMs}
  failStart: false,
  failRestart: false,
  timers: new Set(),
};
window.__realCreateImageBitmap = window.createImageBitmap.bind(window);

fixture.whlFrame = (sequence, width = 64, height = 36, fill = 0x40) => {
  const jpeg = new Uint8Array([255, 216, 255, 217]);
  const packet = new Uint8Array(24 + jpeg.length);
  const view = new DataView(packet.buffer);
  packet.set([0x57, 0x48, 0x4c, 0x31], 0);           // WHL1
  view.setUint32(4, sequence, true);                   // sequence
  view.setUint32(8, jpeg.length, true);                // length
  view.setBigInt64(12, BigInt(Date.now()), true);      // capturedAt
  view.setUint16(20, width, true);                     // width
  view.setUint16(22, height, true);
  packet.set(new Array(jpeg.length).fill(fill), 24);
  return packet;
};

fixture.resetWallpaperPreview = () => {
  for (const timer of preview.timers) clearInterval(timer);
  preview.timers.clear();
  preview.state = 'idle';
  preview.frames = 0;
  preview.metrics = [];
  preview.streams = 0;
  preview.stopped = 0;
  preview.starts = 0;
  preview.restarts = 0;
  preview.requests = [];
  preview.streamScript = [];
  preview.failStart = false;
  preview.failRestart = false;
  preview.mode = 'preview';
  preview.notReadyUntil = 0;
  // Readiness answers for the host. `statusFixed` answers that way for the whole check (a host
  // that never becomes readable); `statusMode` answers that way only before `statusReadyAt`,
  // which is how a recovery is observed. A fresh host starts ready.
  preview.statusMode = 'ok';
  preview.statusFixed = null;
  preview.statusReadyAt = 0;
  preview.statusDelayMs = 0;
  preview.statusQueries = 0;
  // Diagnostics for the readiness checks: how many times the host was reset and which start
  // requests actually reached this mock. A test asserts on these instead of guessing.
  preview.resets = (preview.resets ?? 0) + 1;
  preview.startLog = null;
};

fixture.wallpaperHost = (options = {}) => {
  const settings = { available: true, reason: '', scenes: [{ id: 'lucy', label: 'Lucy', available: true }], ...options };
  fixture.resetWallpaperPreview();
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const hostStatus = () => ({
    available: settings.available,
    unavailableReason: settings.reason,
    missingScenes: settings.available ? [] : ['lucy'],
    previewSeconds: { min: 30, max: 300, default: 180 },
    modes: ['preview', 'daily'],
    // The real Host defaults a request without a mode to preview; the fixture must match it,
    // otherwise a migration default could look right in the checks and wrong in production.
    defaultMode: 'preview',
    mode: preview.state === 'playing' ? preview.mode : null,
    scenes: settings.scenes,
    active: preview.state === 'playing',
    failed: false,
    lastCleanup: preview.lastCleanup ?? null,
    session: preview.state === 'playing' ? { seconds: 180, received: preview.frames } : null,
  });

  window.fetch = async (url, init = {}) => {
    const path = String(url);
    preview.requests.push({ path, method: init.method || 'GET', body: init.body ?? null });
    if (path.startsWith('/whale-wallpaper/status')) {
      preview.statusQueries = (preview.statusQueries ?? 0) + 1;
      // `statusFixed` wins: it models a host that stays unreadable. Otherwise the scripted
      // answer applies only until statusReadyAt, so the recovery after it is observable.
      const mode = preview.statusFixed
        ?? (preview.statusReadyAt && Date.now() < preview.statusReadyAt ? (preview.statusMode || 'error-json') : 'ok');
      // A host that takes its time: the answer arrives after statusDelayMs unless the caller
      // aborts first, which is what a bounded read is supposed to do.
      if (preview.statusDelayMs) await new Promise((resolve, reject) => {
        const signal = init?.signal;
        const timer = setTimeout(resolve, preview.statusDelayMs);
        if (signal) signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
      if (mode === 'hang') return new Promise((resolve, reject) => {
        // Honours the abort signal, like a real fetch: a bounded client read must be able to end it.
        const signal = init?.signal;
        if (signal) signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
      if (mode === 'error-json') return json(503, { error: 'service-starting' });
      if (mode === 'not-found') return json(404, { error: 'no-such-route' });
      if (mode === 'malformed') return new Response('not json at all', { status: 200, headers: { 'content-type': 'application/json' } });
      // Simulates a host that is still starting: not ready answers with available:false.
      if (preview.notReadyUntil && Date.now() < preview.notReadyUntil) {
        return json(200, { ...hostStatus(), available: false, unavailableReason: 'host', active: false });
      }
      return json(200, hostStatus());
    }
    if (path.startsWith('/whale-wallpaper/metrics')) { preview.metrics.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    if (path.startsWith('/whale-wallpaper/stop')) {
      preview.stopped++;
      preview.state = 'idle';
      if (preview.stopFails) {
        preview.lastCleanup = { outcome: 'timeout', closed: false, error: 'still there' };
        return json(409, { ...hostStatus(), failed: true, error: 'Window cleanup incomplete (timeout): still there', lastCleanup: preview.lastCleanup, session: { window: { created: true } } });
      }
      preview.lastCleanup = { outcome: 'closed', closed: true, waitedMs: 20 };
      return json(200, hostStatus());
    }
    if (path.startsWith('/whale-wallpaper/start') || path.startsWith('/whale-wallpaper/restart')) {
      const restart = path.startsWith('/whale-wallpaper/restart');
      if (restart) preview.restarts++;
      if (!settings.available) return json(409, { ...hostStatus(), error: `wallpaper engine preview is unavailable: ${settings.reason}` });
      if ((restart && preview.failRestart) || (!restart && preview.failStart)) return json(409, { ...hostStatus(), error: 'the playback could not be created' });
      preview.starts++;
      preview.startLog = (preview.startLog ?? []).concat([{ at: Math.round(performance.now()), starts: preview.starts, body: init.body ?? null }]);
      preview.state = 'playing';
      const body = init.body ? JSON.parse(init.body) : {};
      if (body.scene && body.scene !== 'lucy') return json(409, { ...hostStatus(), error: `unknown scene: ${body.scene}` });
      // Same constrained enum as the Host: an unknown mode is refused before any work.
      if (body.mode !== undefined && !['preview', 'daily'].includes(body.mode)) {
        preview.state = 'idle';
        return json(409, { ...hostStatus(), error: `unknown mode: ${String(body.mode)}` });
      }
      preview.mode = body.mode ?? 'preview';
      // Optional delay lets a test hold the reply and stop in the meantime.
      if (preview.startDelayMs) await new Promise(resolve => setTimeout(resolve, preview.startDelayMs));
      return json(200, hostStatus());
    }
    if (path.startsWith('/whale-wallpaper/stream')) {
      preview.streams++;
      const behaviour = preview.streamScript.shift() ?? 'ok';
      if (behaviour === 'unavailable') return new Response('Preview unavailable', { status: 503 });
      const intervalMs = typeof behaviour === 'object' && behaviour.intervalMs ? behaviour.intervalMs : 40;
      const endAfterFirst = behaviour === 'end-after-first';
      const stall = behaviour === 'stall';
      // 'open-silent' answers 200 and never sends a frame: the case where an open
      // connection could otherwise hang the client forever.
      const openSilent = behaviour === 'open-silent';
      // 'stall-after-first' sends one frame and then stays open without data;
      // 'gap-then-resume' pauses for a while (shorter than the idle timeout) and then
      // continues, which is what a temporary capture hiccup looks like.
      const stallAfterFirst = behaviour === 'stall-after-first';
      const gapThenResume = behaviour === 'gap-then-resume';
      let sequence = 0;
      const stream = new ReadableStream({
        start(controller) {
          if (openSilent) { preview.timers.add('open-silent'); return; }
          let paused = false;
          const timer = setInterval(() => {
            if (stall || paused) return;
            if (preview.state !== 'playing') {
              clearInterval(timer); preview.timers.delete(timer);
              try { controller.close(); } catch {}
              return;
            }
            preview.frames++;
            controller.enqueue(fixture.whlFrame(++sequence));
            if (gapThenResume && sequence === 1) {
              paused = true;
              setTimeout(() => { paused = false; }, 450);
              return;
            }
            if (endAfterFirst || stallAfterFirst) {
              clearInterval(timer); preview.timers.delete(timer);
              if (endAfterFirst) { try { controller.close(); } catch {} }
            }
          }, intervalMs);
          preview.timers.add(timer);
        },
        cancel() { for (const timer of preview.timers) clearInterval(timer); },
      });
      return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-whale-frames' } });
    }
    throw new Error(`unexpected request: ${path}`);
  };

  // The fixture frames are minimal JPEGs; what is under test is the decode→paint path and
  // the layer/CSS behaviour, so hand back a real, drawable image.
  const pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAEBAQAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
  window.createImageBitmap = async () => {
    const image = new Image();
    image.src = pixel;
    await image.decode();
    image.close = () => {};
    fixture.decodedBlobs = (fixture.decodedBlobs ?? 0) + 1;
    return image;
  };
  fixture.preview = preview;
};
