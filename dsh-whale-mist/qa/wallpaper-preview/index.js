import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { FrameHub, streamFrames } from './frame-hub.js';
import { ProbeJournal } from './probe-log.js';
import { runHelper, waitForWindow, validateLocation, validateProjectFile, validateSize, newLocation } from './managed-window.js';

export const inject = ['webServer'];

/**
 * Supervised QA only: locally created config, validated WE window, no web
 * process-launch API.
 *
 * This module owns the round's resource lifecycle. `setup` creates exactly one
 * window with a round-unique name and reports its handle; `teardown` stops the
 * capture child and closes only that name. Both are injectable so the ordering
 * and rollback rules are unit-testable without touching a real window.
 */
export function createWallpaperBridge({ loadConfig, spawnChild = spawn, helperRun = (helper, args) => runHelper(spawn, helper, args), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  const hub = new FrameHub();
  const journal = new ProbeJournal();
  let config, child, stopping = false, stopRequested = false, failure = null, nativeStatus = null, clientStatus = null, output, reportTimer, killTimer;
  let location = null, windowCreated = false, windowPid = null, captureStarted = false, cleaning = null, cleanupResult = null;
  // Bounded window-acquisition verdict: resolves when this round's window
  // question is answered (found, absent, or grace expired). Teardown awaits it
  // so a stop during creation cannot close "nothing" and leave a late window.
  let windowAcquisitionWait = null;

  const report = () => ({ ...hub.snapshot(), transport: 'pipe-stream', mode: config?.mode ?? null,
    childPid: child?.pid ?? null,
    window: { location, pid: windowPid, created: windowCreated, captureStarted, cleanup: cleanupResult },
    stopping, failure, native: nativeStatus, diagnostics: journal.snapshot(), client: clientStatus });

  const writeReport = async name => { if (!output) return; try { await writeFile(join(output, name), JSON.stringify(report(), null, 2)); } catch { /* evidence is best effort */ } };

  const helper = args => helperRun(config.helper, args);

  // Idempotent teardown of this round's resources. It always re-evaluates the
  // current resource state instead of caching a verdict taken earlier, and it
  // waits for the window creation to reach a verdict before deciding whether
  // this round left a window behind.
  const cleanup = () => {
    cleaning ??= (async () => {
      stopping = true;
      clearInterval(reportTimer); hub.close();
      child?.stdin?.end('stop\n');
      if (child && child.exitCode === null) killTimer = setTimeout(() => child?.kill(), 2500);
      killTimer?.unref();
      await writeReport('bridge-final.json');

      // Wait for the round window's real verdict. `windowAcquisitionWait` is
      // bounded: a slow create call gets its full grace, a settled or failed one
      // only a short grace, and a window that never appears cannot hang teardown.
      if (windowAcquisitionWait) { try { await windowAcquisitionWait; } catch { /* setup reports the failure */ } }

      if (windowCreated && location) {
        const closeArgs = ['--window-ensure-closed', location, '15000'];
        if (Number.isInteger(windowPid) && windowPid > 0) closeArgs.push('--expect-pid', String(windowPid));
        try {
          const closed = await helper(closeArgs);
          cleanupResult = { outcome: closed?.outcome ?? null, closed: closed?.closed === true, waitedMs: closed?.waitedMs ?? null, error: closed?.error ?? null };
          // R4: a supervisable close is not a success. Timeouts and ambiguous
          // identity must be reported, not silently treated as cleaned up.
          if (closed?.closed !== true) failure ??= `Window cleanup incomplete (${closed?.outcome ?? 'unknown'}): ${closed?.error ?? 'no result'}`;
        } catch (error) {
          cleanupResult = { outcome: 'error', closed: false, error: error.message };
          failure ??= `Window cleanup failed: ${error.message}`;
        }
      }
      await writeReport('bridge-final.json');
    })();
    return cleaning;
  };

  const stop = () => {
    if (cleaning) return cleaning;
    stopRequested = true;
    return cleanup();
  };

  async function setup() {
    const loaded = await loadConfig();
    if (!isAbsolute(loaded.helper ?? '') || basename(loaded.helper).toLowerCase() !== 'wallpaperprobe.exe' ||
        !isAbsolute(loaded.output ?? '') ||
        !Number.isInteger(loaded.seconds) || loaded.seconds < 1 || loaded.seconds > 600 ||
        !Number.isInteger(loaded.fps) || loaded.fps < 1 || loaded.fps > 30)
      throw new Error('Invalid local probe configuration');
    const managed = loaded.hwnd === undefined || loaded.hwnd === null;
    if (!managed && (!Number.isSafeInteger(loaded.hwnd) || loaded.hwnd <= 0)) throw new Error('Invalid local probe configuration');
    config = { ...loaded, mode: managed ? 'managed' : 'hwnd' };
    if (managed) {
      config.location = validateLocation(loaded.location ?? newLocation(now()));
      config.file = validateProjectFile(loaded.file);
      config.width = validateSize(loaded.width, 1280);
      config.height = validateSize(loaded.height, 720);
      location = config.location;
    }
    if (stopRequested) return stop();
    output = config.output;

    // 1. Create this round's own window while keeping teardown cooperative: the
    //    name is claimed before the side effect, so a stop that lands during the
    //    call still removes whatever the helper created.
    if (config.mode === 'managed') {
      windowCreated = true;
      try {
        // Two independent views of the same creation:
        //  - `polls` is what real capture setup waits for, so a helper that never
        //    returns cannot block the lifecycle;
        //  - `windowAcquisitionWait` is the bounded verdict teardown awaits: it
        //    waits for the create call (capped by a grace) and then keeps polling
        //    while that call is still pending, so a late window is still closed.
        const polls = waitForWindow(helper, location, { sleep });
        let openSettled = false;
        const opened = helper(['--we-open', location, config.file, String(config.width), String(config.height)]);
        const settledWithFailure = opened.then(() => null, error => error);
        settledWithFailure.then(() => { openSettled = true; }).catch(() => {});
        const createWait = Promise.race([
          settledWithFailure.then(() => 'settled'),
          sleep(6000).then(() => 'grace'),
        ]).catch(() => 'grace');
        const extend = () => waitForWindow(helper, location, { sleep, fastAttempts: 0, graceAttempts: 0, attempts: 100, delayMs: 100 });
        // Teardown's bounded verdict: it waits for the create call to conclude
        // (capped by a grace) and then observes the window identity for a while
        // longer. On a helper error the window can still show up afterwards, so
        // "the helper failed" alone must never skip the close or the observation:
        // the failure is reported after that bounded polling, not instead of it.
        windowAcquisitionWait = (async () => {
          const phase = await createWait;
          const openError = await settledWithFailure;
          const found = await polls;
          if (found) return found;
          const late = phase === 'settled' ? null : await extend();
          if (openError) throw openError;
          return late;
        })();
        windowAcquisitionWait.catch(() => {});   // teardown may attach later

        // Real capture setup waits for the identity poll only; the create call's
        // failure is handled below so a leftover window can still be rolled back.
        const window = await polls;
        const openFailure = await settledWithFailure;
        if (openFailure) {
          // The rollback still needs this window's identity for the close call.
          const late = await windowAcquisitionWait.catch(() => null);
          if (late) { config.hwnd = late.hwnd; windowPid = Number.isInteger(late.pid) && late.pid > 0 ? late.pid : null; }
          throw openFailure;
        }
        if (!window) {
          failure ??= 'Window setup failed: the window did not appear';
          await stop();
          return;
        }
        config.hwnd = window.hwnd;
        windowPid = Number.isInteger(window.pid) && window.pid > 0 ? window.pid : null;
        nativeStatus = { windowReady: { hwnd: window.hwnd, pid: window.pid, visible: window.visible, left: window.left, top: window.top } };
      } catch (error) {
        failure = `Window setup failed: ${error.message}`;
        await stop();
        return;
      }
      if (stopRequested) return stop();
    }

    // 2. Start the capture. The native side creates the WGC item while the
    //    window is still visible, so a hidden or tool-window source is never
    //    requested (both were refused by WGC in this round's tests).
    child = spawnChild(config.helper, [String(config.hwnd), output, String(config.seconds), String(config.fps), 'pipe',
      ...(config.mode === 'managed' ? ['--owned-location', location] : [])],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {});
    child.on('error', error => { failure = error.message; stop(); });
    child.stdout.on('data', data => { try { hub.push(data); } catch (error) { failure = error.message; stop(); } });
    child.stderr.on('data', data => {
      // Informational and recovery diagnostics stay out of `failure`; only an
      // explicit error entry stops the capture. Periodic capture status lines
      // stay visible to the Host under `native`.
      for (const entry of journal.push(data)) {
        if (entry.level === 'error' && !stopping) { failure ??= journal.failureText(entry); stop(); }
        if (entry.scope === 'Status') {
          try {
            const value = JSON.parse(entry.message);
            nativeStatus = { ...nativeStatus, ...value };
            // 3. Tuck the window away only once frames really come from it, and
            //    only while naming the round window this Host is responsible for.
            if (value.captureSource === 'window' && config.mode === 'managed' && !captureStarted) {
              captureStarted = true;
              const args = ['--window-apply', String(config.hwnd), 'offscreen', '--location', location];
              if (windowPid) args.push('--pid', String(windowPid));
              helper(args)
                .then(state => { nativeStatus = { ...nativeStatus, tucked: { visible: state.Visible, left: state.Left, top: state.Top } }; })
                .catch(error => {
                  nativeStatus = { ...nativeStatus, tuckError: error.message };
                  failure ??= `Window tuck failed: ${error.message}`;
                  stop();
                });
            }
          } catch { /* keep the last readable status */ }
        }
      }
    });
    child.on('close', code => {
      clearTimeout(killTimer);
      journal.finish();
      try { hub.decoder.finish(); } catch (error) { if (!stopping) failure = error.message; }
      if (code && !stopping) failure ??= `Capture exited: ${code}`;
      stop();
    });
    reportTimer = setInterval(() => { writeReport('bridge-status.json'); }, 1000);
    reportTimer.unref();
  }

  return { hub, journal, report, setup, stop, state: () => ({ config, location, windowCreated, windowPid, captureStarted, stopRequested, cleanup: cleanupResult }),
    setClientStatus: value => { clientStatus = value; } };
}

export function apply(ctx) {
  const bridge = createWallpaperBridge({
    loadConfig: async () => JSON.parse(await readFile(join(tmpdir(), 'whale-wallpaper-probe-live.json'), 'utf8')),
  });
  const { journal, report, setup, stop } = bridge;

  ctx.effect(() => {
    setup().catch(error => {
      // A setup failure must stay visible: report it as an error diagnostic and
      // roll back whatever this round already created.
      journal.push(`${JSON.stringify({ kind: 'log', level: 'error', scope: 'Setup', message: error.message })}\n`);
      stop();
    });
    return stop;
  }, 'wallpaper probe: native memory bridge');

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/whale-wallpaper-probe',
    async handler(req, res) {
      const path = new URL(req.url, 'http://localhost').pathname;
      res.setHeader('cache-control', 'no-store');
      if (req.method === 'GET' && path === '/whale-wallpaper-probe/status') {
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(report())); return;
      }
      if (req.method === 'GET' && path === '/whale-wallpaper-probe/stream') {
        if (!bridge.hub.latest || bridge.hub.closed) { res.writeHead(503); res.end('Capture unavailable'); return; }
        streamFrames(bridge.hub, res); return;
      }
      if (req.method === 'POST' && path === '/whale-wallpaper-probe/stop') { await stop(); res.writeHead(204); res.end(); return; }
      if (req.method === 'POST' && path === '/whale-wallpaper-probe/metrics') {
        try {
          let size = 0, chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 2048) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
          const value = JSON.parse(Buffer.concat(chunks).toString());
          const allowed = ['received', 'rendered', 'dropped', 'sourceSequence', 'seconds', 'meanLatencyMs', 'maxLatencyMs', 'decodeErrors', 'hidden'];
          bridge.setClientStatus(Object.fromEntries(allowed.filter(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0).map(key => [key, value[key]])));
          res.writeHead(204); res.end();
        } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
        return;
      }
      res.writeHead(404); res.end();
    },
  }), 'wallpaper probe: memory stream routes');
}
