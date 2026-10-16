// Verification suite for P2 frontend stage timings, error decoupling, and dropped classifications.
//
// Tests:
// 1. Stage delays & monotonic timing (Wait callback, Decode, Sync notification, Canvas Draw).
// 2. RAF vs Timeout backstop race & schedule cancellation.
// 3. Overwrite (dropped) classification: waiting callback vs decoding vs sync vs other.
// 4. Post-decode discards: hidden page discard vs stale generation discard.
// 5. Error decoupling & canvas guards: decode fail vs subscriber error vs draw error vs missing canvas.
// 6. Run generation isolation & metric resets.
// 7. Client snapshot payload size (< 2048 bytes) & Host route /whale-wallpaper/metrics seam.
// 8. Observer (watch-playback.mjs) & Analyzer (analyze-playback.mjs) end-to-end seam.
//
// Usage:
//   node qa/perf/check-frontend-stages.mjs

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

import { registerWallpaperRoutes } from '../../src/wallpaper/session.js';
import { analyzeSegment, compareSegments, renderMarkdownReport } from './analyze-playback.mjs';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_PATH = resolve(SCRIPT_DIR, '../../src/client.js');

/** Helper to generate valid WHL1 packets. */
function createWhl1Packet(sequence, width = 100, height = 100, capturedAt = 1000, jpegPayload = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])) {
  const header = new ArrayBuffer(24 + jpegPayload.byteLength);
  const view = new DataView(header);
  view.setUint32(0, 0x57484c31, false); // Magic 'WHL1'
  view.setUint32(4, sequence, true);
  view.setUint32(8, jpegPayload.byteLength, true);
  view.setBigInt64(12, BigInt(capturedAt), true);
  view.setUint16(20, width, true);
  view.setUint16(22, height, true);
  const bytes = new Uint8Array(header);
  bytes.set(jpegPayload, 24);
  return bytes;
}

/** Creates a mock browser sandbox with controllable clock and canvas. */
function createClientSandbox(options = {}) {
  const {
    initialTime = 1000,
    onDraw = null,
    hidden = false,
  } = options;

  let currentTime = initialTime;
  let monotonicTime = initialTime;

  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (bmp, x, y) => {
        if (onDraw) onDraw();
      },
    }),
  };

  const fakeLayer = {
    hidden: true,
    dataset: {},
    querySelector: (sel) => (sel === '.wm-backdrop-media' ? fakeCanvas : null),
    append: () => {},
    setAttribute: () => {},
    remove: () => {},
  };

  const sandbox = {
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    document: {
      hidden,
      body: {
        dataset: {},
        prepend: () => {},
      },
      createElement: (tag) => {
        if (tag === 'canvas') return fakeCanvas;
        if (tag === 'div') return fakeLayer;
        return {
          addEventListener: () => {},
          removeEventListener: () => {},
          append: () => {},
          setAttribute: () => {},
          remove: () => {},
        };
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => monotonicTime },
    createImageBitmap: async () => ({ width: 100, height: 100, close() {} }),
    Blob,
    AbortController,
    console,
    Uint8Array,
    DataView,
    ArrayBuffer,
    Symbol,
    Object,
    Math,
    Error,
    TypeError,
    Promise,
    Set,
    Map,
    URL,
  };

  sandbox.window = sandbox;

  let exportedModule = null;
  sandbox.window.__ModuleLoader__ = {
    load: (mod) => {
      exportedModule = mod.factory(() => ({}));
    },
  };

  const clientSource = options.clientSource;
  vm.runInNewContext(clientSource, sandbox);

  return {
    sandbox,
    exportedModule,
    fakeCanvas,
    fakeLayer,
    getTime: () => currentTime,
    setTime: (t) => { currentTime = t; },
    getMonoTime: () => monotonicTime,
    setMonoTime: (t) => { monotonicTime = t; },
    advanceMonoTime: (ms) => { monotonicTime += ms; },
  };
}

console.log('=== Starting Frontend Stages (P2) Verification Suite ===');

const clientSource = await readFile(CLIENT_PATH, 'utf8');
let globalSyntheticObs, globalSegDefA, globalSegDefB;

// ---------------------------------------------------------------------------------------------
// Test 1: Stage Delays & Monotonic Timing
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 1: Stage delays & monotonic timing ---');
  const env = createClientSandbox({ clientSource });
  let streamController;
  const stream = new ReadableStream({ start(c) { streamController = c; } });

  const fetchImpl = async (url) => {
    if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
    if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
    if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
    if (url === '/whale-wallpaper/metrics') return { ok: true, status: 204 };
    return { ok: false, status: 404, json: async () => ({}) };
  };

  // Override RAF and createImageBitmap with controlled delays
  env.sandbox.requestAnimationFrame = (cb) => {
    return setTimeout(() => {
      env.advanceMonoTime(15); // 15ms RAF wait
      cb();
    }, 10);
  };

  env.sandbox.createImageBitmap = async () => {
    env.advanceMonoTime(20); // 20ms decode
    return { width: 100, height: 100, close() {} };
  };

  const engine = env.exportedModule.createWallpaperEngine({
    fetchImpl,
    monotonicNow: env.getMonoTime,
    now: env.getTime,
    firstFrameTimeoutMs: 10000,
    idleTimeoutMs: 10000,
  });

  // Subscriber introduces 10ms sync delay
  engine.subscribe({
    onFrame: (bmp, frame) => {
      env.advanceMonoTime(10);
    },
  });

  await engine.start();
  streamController.enqueue(createWhl1Packet(1));
  await new Promise(r => setTimeout(r, 60));

  // Directly record a draw of 5ms
  engine.recordDraw(engine.getStatus().generation, true, 5);

  const snap = engine.snapshot();
  assert.equal(snap.rendered, 1, 'rendered should be 1');
  assert.equal(snap.waitRafCount, 1, 'waitRafCount should be 1');
  assert.equal(snap.waitRafSumMs, 15, 'waitRafSumMs should be 15');
  assert.equal(snap.waitRafMaxMs, 15, 'waitRafMaxMs should be 15');
  assert.equal(snap.decodeSuccessCount, 1, 'decodeSuccessCount should be 1');
  assert.equal(snap.decodeSuccessSumMs, 20, 'decodeSuccessSumMs should be 20');
  assert.equal(snap.decodeSuccessMaxMs, 20, 'decodeSuccessMaxMs should be 20');
  assert.equal(snap.syncCount, 1, 'syncCount should be 1');
  assert.equal(snap.syncSumMs, 10, 'syncSumMs should be 10');
  assert.equal(snap.syncMaxMs, 10, 'syncMaxMs should be 10');
  assert.equal(snap.drawCount, 1, 'drawCount should be 1');
  assert.equal(snap.drawSumMs, 5, 'drawSumMs should be 5');
  assert.equal(snap.drawMaxMs, 5, 'drawMaxMs should be 5');

  await engine.stop();
  console.log('✓ Test 1 passed: Stage delays and monotonic timing measured accurately.');
}

// ---------------------------------------------------------------------------------------------
// Test 2: RAF vs Timeout Backstop Race & Schedule Cancellation
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 2: RAF vs Timeout backstop race & cancellation ---');
  // Case 2a: Timeout backstop fires when RAF does not fire within 250ms
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    // RAF never runs (simulate background tab or non-composited window)
    env.sandbox.requestAnimationFrame = () => 999;
    // Timeout runs faster in test (replace 250ms with 30ms for test speed, advancing mono time by 255ms)
    const realSetTimeout = setTimeout;
    env.sandbox.setTimeout = (cb, ms) => {
      if (ms === 250) {
        return realSetTimeout(() => {
          env.advanceMonoTime(255);
          cb();
        }, 30);
      }
      return realSetTimeout(cb, ms);
    };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
      firstFrameTimeoutMs: 10000,
      idleTimeoutMs: 10000,
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => realSetTimeout(r, 60));

    const snap = engine.snapshot();
    assert.equal(snap.waitTimeoutCount, 1, 'waitTimeoutCount should be 1');
    assert.equal(snap.waitTimeoutSumMs, 255, 'waitTimeoutSumMs should be 255');
    assert.equal(snap.waitTimeoutMaxMs, 255, 'waitTimeoutMaxMs should be 255');
    assert.equal(snap.waitRafCount, 0, 'waitRafCount should be 0 when timeout fired');
    assert.equal(snap.rendered, 1, 'rendered should be 1');

    await engine.stop();
  }

  // Case 2b: Schedule cancellation on stop()
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    // RAF doesn't fire immediately
    env.sandbox.requestAnimationFrame = () => 1234;

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 10));
    // Frame is in wait queue. Now stop the engine!
    await engine.stop();

    const snap = engine.snapshot();
    assert.equal(snap.waitCancelledCount, 1, 'waitCancelledCount should increment when stopped during wait');
    assert.equal(snap.rendered, 0, 'rendered should be 0 since frame was cancelled');
  }

  console.log('✓ Test 2 passed: Timeout backstop single-execution and wait cancellation verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 3: Dropped Overwrite Classification
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 3: Dropped overwrite classification ---');
  // Case 3a: Overwrite while waiting for callback (paintPhase is idle, frameRequest is set)
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    // Hold callback so frames stack up in wait callback queue
    let heldCallback = null;
    env.sandbox.requestAnimationFrame = (cb) => {
      heldCallback = cb;
      return 111;
    };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    await engine.start();
    // Enqueue Frame 1 -> scheduled paint, frameRequest set
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 10));

    // Enqueue Frame 2 -> latest overwritten while waiting for callback
    streamController.enqueue(createWhl1Packet(2));
    await new Promise(r => setTimeout(r, 10));

    let snap = engine.snapshot();
    assert.equal(snap.dropped, 1, 'dropped should be 1');
    assert.equal(snap.dropWaitingCallbackCount, 1, 'dropWaitingCallbackCount should be 1');
    assert.equal(snap.dropDecodingCount, 0, 'dropDecodingCount should be 0');
    assert.equal(snap.dropSyncCount, 0, 'dropSyncCount should be 0');

    // Case 3b: Overwrite while decoding
    // Case 3b: Overwrite while decoding
    let decodeResolver = null;
    env.sandbox.createImageBitmap = () => new Promise(resolve => { decodeResolver = resolve; });

    // Release held callback: Frame 2 starts decoding (removed from latest)
    heldCallback();
    await new Promise(r => setTimeout(r, 10));

    // Frame 3 arrives -> occupies latest
    streamController.enqueue(createWhl1Packet(3));
    await new Promise(r => setTimeout(r, 10));

    // Frame 4 arrives while Frame 2 is still decoding -> overwrites Frame 3 in latest!
    streamController.enqueue(createWhl1Packet(4));
    await new Promise(r => setTimeout(r, 10));

    snap = engine.snapshot();
    assert.equal(snap.dropped, 2, 'dropped should be 2');
    assert.equal(snap.dropDecodingCount, 1, 'dropDecodingCount should be 1');

    // Case 3c: Overwrite while in sync notification
    // Frame 4 is currently in latest. When Frame 2 finishes decode, it enters sync.
    // Inside subscriber, Frame 5 arrives and overwrites Frame 4 in latest!
    let syncEntered = false;
    engine.subscribe({
      onFrame: () => {
        syncEntered = true;
        engine.acceptFrame({ sequence: 5, capturedAt: 1000, width: 100, height: 100, jpeg: new Uint8Array([1, 2]) });
      },
    });

    // Complete decode for Frame 2 -> enters sync phase
    decodeResolver({ width: 100, height: 100, close() {} });
    await new Promise(r => setTimeout(r, 20));

    assert.ok(syncEntered, 'Subscriber should have run');
    snap = engine.snapshot();
    assert.equal(snap.dropped, 3, 'dropped should be 3');
    assert.equal(snap.dropSyncCount, 1, 'dropSyncCount should be 1');

    // Case 3d: Check sum equality
    const calculatedSum = snap.dropDecodingCount + snap.dropSyncCount + snap.dropWaitingCallbackCount + snap.dropOtherCount;
    assert.equal(calculatedSum, snap.dropped, `sum (${calculatedSum}) must equal dropped (${snap.dropped})`);

    await engine.stop();
  }

  console.log('✓ Test 3 passed: Dropped overwrite categories mutually exclusive and sum exactly to dropped.');
}

// ---------------------------------------------------------------------------------------------
// Test 4: Post-Decode Discards
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 4: Post-decode discards (hidden & stale) ---');
  // Case 4a: Hidden discard
  {
    const env = createClientSandbox({ clientSource, hidden: false });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    let bitmapClosed = false;
    let decodeResolver = null;
    env.sandbox.createImageBitmap = () => new Promise(resolve => {
      decodeResolver = resolve;
    });

    let frameEmitted = false;
    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });
    engine.subscribe({ onFrame: () => { frameEmitted = true; } });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 20));

    // Page becomes hidden BEFORE decode resolves!
    env.sandbox.document.hidden = true;
    decodeResolver({ width: 100, height: 100, close: () => { bitmapClosed = true; } });
    await new Promise(r => setTimeout(r, 20));

    const snap = engine.snapshot();
    assert.equal(snap.discardHiddenCount, 1, 'discardHiddenCount should be 1');
    assert.equal(snap.rendered, 0, 'rendered should NOT increment on hidden discard');
    assert.equal(frameEmitted, false, 'frame should not be emitted to subscribers');
    assert.equal(bitmapClosed, true, 'bitmap should be closed');

    await engine.stop();
  }

  // Case 4b: Stale generation discard (stopped or restarted before decode resolves)
  {
    const env = createClientSandbox({ clientSource, hidden: false });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    let bitmapClosed = false;
    let decodeResolver = null;
    env.sandbox.createImageBitmap = () => new Promise(resolve => { decodeResolver = resolve; });

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 20));

    // Stop engine while decode is in flight!
    await engine.stop();

    // Now decode resolves
    decodeResolver({ width: 100, height: 100, close: () => { bitmapClosed = true; } });
    await new Promise(r => setTimeout(r, 20));

    const snap = engine.snapshot();
    assert.equal(snap.discardStaleCount, 1, 'discardStaleCount should be 1');
    assert.equal(snap.rendered, 0, 'rendered should remain 0');
    assert.equal(bitmapClosed, true, 'bitmap should be closed');
  }

  console.log('✓ Test 4 passed: Hidden and stale generation post-decode discards verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 5: Error Decoupling and Canvas Guards
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 5: Error decoupling & canvas guards ---');
  // Case 5a: Decode failure does NOT increment sync error
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    env.sandbox.createImageBitmap = async () => {
      throw new Error('corrupt jpeg');
    };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 30));

    const snap = engine.snapshot();
    assert.equal(snap.decodeFailCount, 1, 'decodeFailCount should be 1');
    assert.equal(snap.decodeErrors, 1, 'decodeErrors should be 1');
    assert.equal(snap.syncErrorCount, 0, 'syncErrorCount should be 0 on decode fail');
    assert.equal(snap.rendered, 0, 'rendered should be 0 on decode fail');

    await engine.stop();
  }

  // Case 5b: Subscriber exception does NOT increment decodeErrors or decodeFailCount
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    engine.subscribe({
      onFrame: () => {
        throw new Error('subscriber UI crash');
      },
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 40));

    const snap = engine.snapshot();
    assert.equal(snap.rendered, 1, 'rendered should be 1 because decode succeeded');
    assert.equal(snap.decodeSuccessCount, 1, 'decodeSuccessCount should be 1');
    assert.equal(snap.decodeFailCount, 0, 'decodeFailCount must NOT increment for subscriber error');
    assert.equal(snap.decodeErrors, 0, 'decodeErrors must NOT increment for subscriber error');
    assert.equal(snap.syncErrorCount, 1, 'syncErrorCount should be 1');

    await engine.stop();
  }

  // Case 5c: Canvas draw error via paintWallpaper
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    // Make drawImage throw
    env.fakeCanvas.getContext = () => ({
      drawImage: () => {
        throw new Error('GPU context lost');
      },
    });

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    const backdrop = env.exportedModule.createBackdrop(engine);
    backdrop.start({ background: 'wallpaper' }, true);

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 60));

    const snap = engine.snapshot();
    assert.equal(snap.rendered, 1, 'rendered is 1 (decode was ready)');
    assert.equal(snap.drawCount, 0, 'drawCount must NOT increment when drawImage throws');
    assert.equal(snap.drawErrorCount, 1, 'drawErrorCount should be 1');
    assert.equal(snap.decodeErrors, 0, 'decodeErrors must remain 0');

    await engine.stop();
    backdrop.stop();
  }

  // Case 5d: Canvas missing guard
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });

    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    // Layer returns no canvas
    env.fakeLayer.querySelector = () => null;

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    const backdrop = env.exportedModule.createBackdrop(engine);
    backdrop.start({ background: 'wallpaper' }, true);

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 60));

    const snap = engine.snapshot();
    assert.equal(snap.rendered, 1, 'rendered was ready');
    assert.equal(snap.drawCount, 0, 'drawCount remains 0 when canvas is missing');
    assert.equal(snap.drawErrorCount, 0, 'drawErrorCount remains 0 (early exit guard)');

    await engine.stop();
    backdrop.stop();
  }

  console.log('✓ Test 5 passed: Errors strictly separated between decode, sync, and canvas draw.');
}

// ---------------------------------------------------------------------------------------------
// Test 6: Run Generation Isolation & Reset
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 6: Run generation isolation & metric resets ---');
  const env = createClientSandbox({ clientSource });
  let streamController;
  const stream = new ReadableStream({ start(c) { streamController = c; } });

  const fetchImpl = async (url) => {
    if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
    if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
    if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const engine = env.exportedModule.createWallpaperEngine({
    fetchImpl,
    monotonicNow: env.getMonoTime,
    now: env.getTime,
  });

  await engine.start();
  const oldGen = engine.getStatus().generation;
  engine.recordDraw(oldGen, true, 8);
  assert.equal(engine.snapshot().drawCount, 1);

  // Stop run: retains final metrics of that run
  await engine.stop();
  assert.equal(engine.snapshot().drawCount, 1, 'Final snapshot of stopped run retains its metrics');

  // Late recordDraw from old generation must be ignored!
  engine.recordDraw(oldGen, true, 8);
  assert.equal(engine.snapshot().drawCount, 1, 'Late recordDraw after stop is ignored (remains 1, not 2)');

  // Start new run: resets metrics to 0
  await engine.start();
  assert.equal(engine.snapshot().drawCount, 0, 'New run resets drawCount to 0');
  const newGen = engine.getStatus().generation;
  assert.notEqual(newGen, oldGen, 'New generation must differ');

  // Old gen draw call during new run must be ignored
  engine.recordDraw(oldGen, true, 8);
  assert.equal(engine.snapshot().drawCount, 0, 'Draw from old generation must not pollute new run');

  // Valid new gen draw succeeds
  engine.recordDraw(newGen, true, 6);
  assert.equal(engine.snapshot().drawCount, 1, 'Valid new gen draw succeeds');

  await engine.stop();
  console.log('✓ Test 6 passed: Run generation isolation and counter resets verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 7: Client Snapshot Payload (< 2048 Bytes) & Host Route Seam
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 7: Client snapshot payload size & Host route seam ---');
  const env = createClientSandbox({ clientSource });
  const engine = env.exportedModule.createWallpaperEngine({
    monotonicNow: env.getMonoTime,
    now: env.getTime,
  });

  const snap = engine.snapshot();
  const snapJson = JSON.stringify(snap);
  const snapBytes = Buffer.byteLength(snapJson, 'utf8');

  // Verify full JSON is well under the 2048-byte limit
  assert.ok(snapBytes < 1200, `Snapshot JSON size (${snapBytes} bytes) exceeds safety margin (< 1200 bytes)`);
  assert.ok(snapBytes < 2048, `Snapshot JSON size (${snapBytes} bytes) exceeds route limit (2048 bytes)`);

  // Verify all 36 keys are present (9 baseline + 27 stage keys)
  assert.equal(Object.keys(snap).length, 36, 'Snapshot must contain exactly 36 keys (9 baseline + 27 stage keys)');

  // Test Host route /whale-wallpaper/metrics handler
  let clientStatusSet = null;
  const fakeSession = {
    hub: { latest: null, closed: false },
    closed: false,
    async create() {},
    async stop() { return { outcome: 'closed', closed: true }; },
    isClosed: () => false,
    report: () => ({ window: { location: 'we-p2-test', created: true } }),
    state: () => ({ cleanup: null }),
    ending: () => false,
    setClientStatus: (val) => { clientStatusSet = val; },
    getPreviewStatus: () => ({ client: clientStatusSet }),
  };

  const routes = new Map();
  const ctx = {
    effect: (cb) => cb(),
    webServer: { register: (r) => routes.set(r.path, r) },
  };

  registerWallpaperRoutes(ctx, {
    helper: 'fake.exe',
    logRoot: 'C:\\fake\\logs',
    exists: () => true,
    sessionFactory: () => fakeSession,
  });

  const route = routes.get('/whale-wallpaper');
  assert.ok(route, 'Wallpaper route must be registered');

  // Start session so route has an active session
  {
    const req = {
      method: 'POST',
      url: '/whale-wallpaper/start',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ scene: 'lucy' }));
      },
    };
    const res = { setHeader: () => {}, writeHead: () => {}, end: () => {} };
    await route.handler(req, res);
  }

  // POST full client snapshot to route
  {
    const req = {
      method: 'POST',
      url: '/whale-wallpaper/metrics',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(snapJson);
      },
    };
    let statusCode = 0;
    const res = {
      setHeader: () => {},
      writeHead: (code) => { statusCode = code; },
      end: () => {},
    };
    await route.handler(req, res);
    assert.equal(statusCode, 204, 'Route should respond 204 for valid snapshot');
    assert.ok(clientStatusSet, 'Session setClientStatus should have received sanitized metrics');
    assert.equal(clientStatusSet.waitRafCount, 0);
    assert.equal(clientStatusSet.drawCount, 0);
    assert.equal(clientStatusSet.dropDecodingCount, 0);
  }

  // POST with negative/non-finite/unknown keys (sanitizer test)
  {
    const badMetrics = {
      ...snap,
      waitRafCount: -5,
      drawCount: Infinity,
      maliciousExtraKey: 12345,
    };
    const req = {
      method: 'POST',
      url: '/whale-wallpaper/metrics',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify(badMetrics));
      },
    };
    let statusCode = 0;
    const res = {
      setHeader: () => {},
      writeHead: (code) => { statusCode = code; },
      end: () => {},
    };
    await route.handler(req, res);
    assert.equal(statusCode, 204);
    assert.equal(clientStatusSet.waitRafCount, undefined, 'Negative number must be stripped');
    assert.equal(clientStatusSet.drawCount, undefined, 'Infinity must be stripped');
    assert.equal(clientStatusSet.maliciousExtraKey, undefined, 'Unknown key must be stripped');
  }

  // POST oversized body (> 2048 bytes)
  {
    const bigBody = JSON.stringify({ padding: 'x'.repeat(2100) });
    const req = {
      method: 'POST',
      url: '/whale-wallpaper/metrics',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(bigBody);
      },
    };
    let statusCode = 0;
    const res = {
      setHeader: () => {},
      writeHead: (code) => { statusCode = code; },
      end: () => {},
    };
    await route.handler(req, res);
    assert.ok(statusCode === 400 || statusCode === 413, `Oversized body must be rejected (got ${statusCode})`);
  }

  console.log(`✓ Test 7 passed: Payload size is ${snapBytes} bytes (<2048) and Host route filters safely.`);
}

// ---------------------------------------------------------------------------------------------
// Test 8: Observer & Analyzer End-to-End Seam
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 8: Observer & Analyzer end-to-end seam ---');

  // Synthetic observation with two segments having full P2 frontend metrics
  const syntheticObs = {
    schemaVersion: 1,
    tool: 'watch-playback',
    state: 'synthetic',
    createdAt: '2026-10-14T08:00:00.000Z',
    runDir: 'C:\\test\\run-frontend-p2',
    session: { childPid: 6001, location: 'we-p2-test', stable: true },
    samples: [
      // Segment A: 0s to 10s (Idle)
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 100, seconds: 10.0, width: 1280, height: 720, encodeMs: 40, foreground: true } },
        previewStatus: {
          readOk: true,
          data: {
            childPid: 6001,
            window: { location: 'we-p2-test', created: true },
            client: {
              received: 100,
              rendered: 100,
              dropped: 0,
              seconds: 10.0,
              hidden: 0,
              meanLatencyMs: 15.0,
              maxLatencyMs: 25.0,
              waitRafCount: 100, waitRafSumMs: 1600.0, waitRafMaxMs: 22.0,
              waitTimeoutCount: 0, waitTimeoutSumMs: 0, waitTimeoutMaxMs: 0,
              waitCancelledCount: 0,
              decodeSuccessCount: 100, decodeSuccessSumMs: 1200.0, decodeSuccessMaxMs: 18.0,
              decodeFailCount: 0, decodeFailSumMs: 0, decodeFailMaxMs: 0,
              discardHiddenCount: 0, discardStaleCount: 0,
              syncCount: 100, syncSumMs: 400.0, syncMaxMs: 6.0, syncErrorCount: 0,
              drawCount: 100, drawSumMs: 300.0, drawMaxMs: 5.0, drawErrorCount: 0,
              dropDecodingCount: 0, dropSyncCount: 0, dropWaitingCallbackCount: 0, dropOtherCount: 0,
            },
          },
        },
      },
      {
        sampleIndex: 1,
        elapsedMs: 10000,
        status: { readOk: true, data: { frames: 300, seconds: 20.0, width: 1280, height: 720, encodeMs: 40, foreground: true } },
        previewStatus: {
          readOk: true,
          data: {
            childPid: 6001,
            window: { location: 'we-p2-test', created: true },
            client: {
              received: 300,
              rendered: 300,
              dropped: 0,
              seconds: 20.0,
              hidden: 0,
              meanLatencyMs: 15.0,
              maxLatencyMs: 25.0,
              waitRafCount: 300, waitRafSumMs: 4800.0, waitRafMaxMs: 22.0,
              waitTimeoutCount: 0, waitTimeoutSumMs: 0, waitTimeoutMaxMs: 0,
              waitCancelledCount: 0,
              decodeSuccessCount: 300, decodeSuccessSumMs: 3600.0, decodeSuccessMaxMs: 18.0,
              decodeFailCount: 0, decodeFailSumMs: 0, decodeFailMaxMs: 0,
              discardHiddenCount: 0, discardStaleCount: 0,
              syncCount: 300, syncSumMs: 1200.0, syncMaxMs: 6.0, syncErrorCount: 0,
              drawCount: 300, drawSumMs: 900.0, drawMaxMs: 5.0, drawErrorCount: 0,
              dropDecodingCount: 0, dropSyncCount: 0, dropWaitingCallbackCount: 0, dropOtherCount: 0,
            },
          },
        },
      },
      // Segment B: 10s to 20s (Moving with overwrite and draw delay)
      {
        sampleIndex: 2,
        elapsedMs: 20000,
        status: { readOk: true, data: { frames: 500, seconds: 30.0, width: 1280, height: 720, encodeMs: 40, foreground: true } },
        previewStatus: {
          readOk: true,
          data: {
            childPid: 6001,
            window: { location: 'we-p2-test', created: true },
            client: {
              received: 500,
              rendered: 450,
              dropped: 50,
              seconds: 30.0,
              hidden: 0,
              meanLatencyMs: 22.0,
              maxLatencyMs: 45.0,
              waitRafCount: 450, waitRafSumMs: 8100.0, waitRafMaxMs: 35.0,
              waitTimeoutCount: 0, waitTimeoutSumMs: 0, waitTimeoutMaxMs: 0,
              waitCancelledCount: 0,
              decodeSuccessCount: 450, decodeSuccessSumMs: 6300.0, decodeSuccessMaxMs: 28.0,
              decodeFailCount: 0, decodeFailSumMs: 0, decodeFailMaxMs: 0,
              discardHiddenCount: 0, discardStaleCount: 0,
              syncCount: 450, syncSumMs: 2700.0, syncMaxMs: 12.0, syncErrorCount: 0,
              drawCount: 450, drawSumMs: 1800.0, drawMaxMs: 9.0, drawErrorCount: 0,
              dropDecodingCount: 30, dropSyncCount: 15, dropWaitingCallbackCount: 5, dropOtherCount: 0,
            },
          },
        },
      },
    ],
  };

  const segDefA = {
    id: 'segA',
    label: '静止对照段',
    startElapsedMs: 0,
    endElapsedMs: 10000,
    conditions: {
      userManualDshForeground: true,
      userManualMouseAction: 'idle',
      observedWidth: 1280,
      observedHeight: 720,
    },
  };

  const segDefB = {
    id: 'segB',
    label: '划动实验段',
    startElapsedMs: 10000,
    endElapsedMs: 20000,
    conditions: {
      userManualDshForeground: true,
      userManualMouseAction: 'circle_300px_1hz',
      observedWidth: 1280,
      observedHeight: 720,
    },
  };

  const segA = analyzeSegment(segDefA, syntheticObs);
  const segB = analyzeSegment(segDefB, syntheticObs);
  globalSyntheticObs = syntheticObs;
  globalSegDefA = segDefA;
  globalSegDefB = segDefB;

  // Check segment A frontend stages
  assert.equal(segA.frontendStages.available, true);
  assert.equal(segA.frontendStages.valid, true);
  assert.equal(segA.frontendStages.drawRateFps, 20.0); // (300 - 100) / 10s = 20fps
  assert.equal(segA.frontendStages.waitRaf.count, 200);
  assert.equal(segA.frontendStages.waitRaf.meanMs, 16.0); // (4800 - 1600) / 200 = 16.0 ms
  assert.equal(segA.frontendStages.decodeSuccess.meanMs, 12.0); // (3600 - 1200) / 200 = 12.0 ms
  assert.equal(segA.frontendStages.sync.meanMs, 4.0); // (1200 - 400) / 200 = 4.0 ms
  assert.equal(segA.frontendStages.draw.meanMs, 3.0); // (900 - 300) / 200 = 3.0 ms
  assert.equal(segA.frontendStages.droppedBreakdown.totalDroppedDelta, 0);
  assert.equal(segA.frontendStages.droppedBreakdown.matches, true);

  // Check segment B frontend stages
  assert.equal(segB.frontendStages.available, true);
  assert.equal(segB.frontendStages.valid, true);
  assert.equal(segB.frontendStages.drawRateFps, 15.0); // (450 - 300) / 10s = 15fps
  assert.equal(segB.frontendStages.waitRaf.meanMs, 22.0); // (8100 - 4800) / 150 = 22.0 ms
  assert.equal(segB.frontendStages.decodeSuccess.meanMs, 18.0); // (6300 - 3600) / 150 = 18.0 ms
  assert.equal(segB.frontendStages.sync.meanMs, 10.0); // (2700 - 1200) / 150 = 10.0 ms
  assert.equal(segB.frontendStages.draw.meanMs, 6.0); // (1800 - 900) / 150 = 6.0 ms
  assert.equal(segB.frontendStages.droppedBreakdown.totalDroppedDelta, 50);
  assert.equal(segB.frontendStages.droppedBreakdown.dropDecoding, 30);
  assert.equal(segB.frontendStages.droppedBreakdown.dropSync, 15);
  assert.equal(segB.frontendStages.droppedBreakdown.dropWaitingCallback, 5);
  assert.equal(segB.frontendStages.droppedBreakdown.dropOther, 0);
  assert.equal(segB.frontendStages.droppedBreakdown.matches, true);

  // Compare segments
  const comparison = compareSegments(segA, segB, syntheticObs);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.deltas.clientRenderRateFps, -5.0); // 15.0 - 20.0 = -5.0 fps
  assert.equal(comparison.deltas.clientDrawRateFps, -5.0); // 15.0 - 20.0 = -5.0 fps
  assert.ok(comparison.frontendStageDeltas, 'frontendStageDeltas must be present');
  assert.equal(comparison.frontendStageDeltas.drawRateFps, -5.0);
  assert.equal(comparison.frontendStageDeltas.waitRafMeanMs, 6.0); // 22.0 - 16.0 = 6.0 ms
  assert.equal(comparison.frontendStageDeltas.decodeSuccessMeanMs, 6.0); // 18.0 - 12.0 = 6.0 ms
  assert.equal(comparison.frontendStageDeltas.syncMeanMs, 6.0); // 10.0 - 4.0 = 6.0 ms
  assert.equal(comparison.frontendStageDeltas.drawMeanMs, 3.0); // 6.0 - 3.0 = 3.0 ms
  assert.equal(comparison.frontendStageDeltas.droppedTotalDeltaDiff, 50);
  assert.equal(comparison.frontendStageDeltas.dropDecodingDiff, 30);
  assert.equal(comparison.frontendStageDeltas.dropSyncDiff, 15);
  assert.equal(comparison.frontendStageDeltas.dropWaitingCallbackDiff, 5);

  // Render markdown report
  const analysisObj = {
    state: 'synthetic',
    createdAt: '2026-10-14T08:00:00.000Z',
    status: { reportWritten: true, dataReady: true, reasons: [] },
    metadata: { scene: 'lucy', runDir: 'C:\\test\\run-frontend-p2' },
    segments: [segA, segB],
    comparison,
    boundaries: [
      '1. Native encodeMs 已包含 readbackMs 与 jpegMs 等阶段，各分项不可再次叠加求和。',
      '2. client.hidden=1 时 dropped 包含页面主动后台停绘，不可作为前台呈现速率结论。',
      '3. Native foreground 为壁纸源窗口状态，非 DSH 前台窗口状态。',
      '4. 稀疏帧日志仅在严格相邻序号（N 与 N+1）间计算间隔，不跨步计算虚假长停顿。',
      '5. 客户端累计延迟与各阶段累计最大值仅作为参考基线，不代表本阶段 P95 或端到端鼠标响应时间。',
      '6. rendered 为前端解码准备投递计数，在进入 paintWallpaper 之前统计，不代表画布 drawImage 成功或物理屏幕呈现。',
      '7. drawImage 耗时仅测量 Canvas2D 同步执行时长，返回不代表物理呈现；待处理帧覆盖分类反映新帧到达时 latest 所处的生命周期状态，非鼠标交互的因果证明。',
      '8. 只有在同会话、同分辨率且满足前台与固定条件时才生成对比差值；任一条件不满足时对比阻断。',
    ],
  };

  const md = renderMarkdownReport(analysisObj);
  assert.ok(md.includes('## 4. 前端分阶段耗时与丢帧分解'), 'Markdown must include Section 4');
  assert.ok(md.includes('RAF 等待 (waitRaf)'), 'Markdown must include RAF wait row');
  assert.ok(md.includes('画布绘制 (drawImage)'), 'Markdown must include drawImage row');
  assert.ok(md.includes('待处理旧帧覆盖分解'), 'Markdown must include dropped breakdown table');
  assert.ok(md.includes('核对一致'), 'Markdown must show dropped breakdown check matches');
  assert.ok(md.includes('前端解码投递 (rendered)'), 'Markdown must include rendered notice');

  // Test rollback guard: artificial decrease in drawCount
  const rollbackObs = JSON.parse(JSON.stringify(syntheticObs));
  rollbackObs.samples[1].previewStatus.data.client.drawCount = 50; // decreases from 100!
  const segRollback = analyzeSegment(segDefA, rollbackObs);
  assert.equal(segRollback.frontendStages.valid, false);
  assert.equal(segRollback.frontendStages.reason, 'frontend_stages_counter_reset (前端阶段计数在段内发生重置/回退)');

  // Test legacy observation missing P2 fields
  const legacyObs = JSON.parse(JSON.stringify(syntheticObs));
  for (const s of legacyObs.samples) {
    delete s.previewStatus.data.client.waitRafCount;
    delete s.previewStatus.data.client.drawCount;
  }
  const segLegacy = analyzeSegment(segDefA, legacyObs);
  assert.equal(segLegacy.frontendStages.available, false);
  assert.equal(segLegacy.frontendStages.valid, false);
  assert.ok(segLegacy.frontendStages.reason.includes('frontend_stages_missing'));

  console.log('✓ Test 8 passed: Observer and Analyzer end-to-end seam completely verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 9: Review R1-R4 Counterexample Regression Suite
// ---------------------------------------------------------------------------------------------
{
  console.log('--- Test 9: Review R1-R4 Counterexample Regression Suite ---');

  // Case 9a (R1): Late decode completion (success & rejection) after new start does not pollute new run
  {
    for (const shouldReject of [false, true]) {
      const env = createClientSandbox({ clientSource });
      let streamController;
      const stream = new ReadableStream({ start(c) { streamController = c; } });
      const fetchImpl = async (url) => {
        if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
        if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
        if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
        return { ok: false, status: 404, json: async () => ({}) };
      };

      let resolveDecode, rejectDecode, closed = 0;
      env.sandbox.createImageBitmap = () => new Promise((res, rej) => {
        resolveDecode = res;
        rejectDecode = rej;
      });

      let rafCallback = null;
      env.sandbox.requestAnimationFrame = (cb) => { rafCallback = cb; return 1; };

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl,
        monotonicNow: env.getMonoTime,
        now: env.getTime,
      });

      await engine.start();
      streamController.enqueue(createWhl1Packet(1));
      await new Promise(r => setTimeout(r, 10));
      rafCallback();
      assert.equal(typeof resolveDecode, 'function', 'decode must have started');

      // Stop engine and start Run 2
      await engine.stop();
      await engine.start();
      const before = engine.snapshot();
      assert.equal(before.decodeSuccessCount, 0);
      assert.equal(before.decodeFailCount, 0);
      assert.equal(before.decodeErrors, 0);

      // Old decode completes
      env.advanceMonoTime(20);
      if (shouldReject) {
        rejectDecode(new Error('old decode failed'));
      } else {
        resolveDecode({ width: 100, height: 100, close: () => { closed++; } });
      }
      await new Promise(r => setTimeout(r, 20));

      const after = engine.snapshot();
      assert.equal(after.decodeSuccessCount, 0, 'new run decodeSuccessCount must not be polluted by old decode');
      assert.equal(after.decodeFailCount, 0, 'new run decodeFailCount must not be polluted by old decode');
      assert.equal(after.decodeErrors, 0, 'new run decodeErrors must not be polluted by old decode');
      if (!shouldReject) {
        assert.equal(closed, 1, 'old bitmap must be closed when old decode finishes after new run started');
      }
      await engine.stop();
    }
  }

  // Case 9b (R2): Bitmap properly closed if subscriber throws before handoff
  {
    const env = createClientSandbox({ clientSource });
    let streamController;
    const stream = new ReadableStream({ start(c) { streamController = c; } });
    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') return { ok: true, body: stream };
      return { ok: false, status: 404, json: async () => ({}) };
    };

    let closed = 0;
    env.sandbox.createImageBitmap = async () => ({ width: 100, height: 100, close: () => { closed++; } });
    let rafCallback = null;
    env.sandbox.requestAnimationFrame = (cb) => { rafCallback = cb; return 1; };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    engine.subscribe({
      onFrame: () => { throw new Error('subscriber throws before taking ownership'); },
    });

    await engine.start();
    streamController.enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 10));
    rafCallback();
    await new Promise(r => setTimeout(r, 20));

    const snap = engine.snapshot();
    assert.equal(snap.syncErrorCount, 1, 'syncErrorCount should record subscriber failure');
    assert.equal(snap.decodeErrors, 0, 'decodeErrors must not be incremented on subscriber failure');
    assert.equal(closed, 1, 'bitmap must be closed by engine when subscriber throws');
    await engine.stop();
  }

  // Case 9c (R3): RAF handle with ID 0 properly cancelled, old callback cannot cancel new callback
  {
    const env = createClientSandbox({ clientSource });
    const controllers = [];
    const fetchImpl = async (url) => {
      if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc1', created: true }, running: true }) };
      if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
      if (url === '/whale-wallpaper/stream') {
        const stream = new ReadableStream({ start(c) { controllers.push(c); } });
        return { ok: true, body: stream };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    let nextRafId = 0; // First RAF ID is 0
    const pendingRaf = new Map();
    const cancelledRaf = [];
    env.sandbox.requestAnimationFrame = (cb) => {
      const id = nextRafId++;
      pendingRaf.set(id, cb);
      return id;
    };
    env.sandbox.cancelAnimationFrame = (id) => {
      cancelledRaf.push(id);
      pendingRaf.delete(id);
    };

    const engine = env.exportedModule.createWallpaperEngine({
      fetchImpl,
      monotonicNow: env.getMonoTime,
      now: env.getTime,
    });

    await engine.start();
    controllers.at(-1).enqueue(createWhl1Packet(1));
    await new Promise(r => setTimeout(r, 10));
    assert(pendingRaf.has(0), 'RAF 0 must be scheduled');

    // Stop engine -> RAF 0 must be cancelled
    await engine.stop();
    assert.equal(pendingRaf.has(0), false, 'RAF 0 must be cancelled on stop');
    assert(cancelledRaf.includes(0), 'cancelAnimationFrame(0) must have been called');

    // Start Run 2 -> schedules RAF 1
    await engine.start();
    controllers.at(-1).enqueue(createWhl1Packet(2));
    await new Promise(r => setTimeout(r, 10));
    assert(pendingRaf.has(1), 'RAF 1 must be scheduled for Run 2');

    const beforeOld = engine.snapshot();
    assert.equal(beforeOld.waitRafCount, 0);

    // Run 2's RAF 1 fires
    const cb1 = pendingRaf.get(1);
    cb1();
    await new Promise(r => setTimeout(r, 20));
    const snap2 = engine.snapshot();
    assert.equal(snap2.waitRafCount, 1, 'Run 2 waitRafCount should be 1');
    assert.equal(snap2.rendered, 1, 'Run 2 should render its frame');
    await engine.stop();
  }

  // Case 9d (R4): Inconsistent dropped breakdown invalidates frontend stages and suppresses deltas
  {
    const mismatchedObs = JSON.parse(JSON.stringify(globalSyntheticObs));
    // Perturb dropWaitingCallbackCount so sum of drops !== total dropped
    mismatchedObs.samples[1].previewStatus.data.client.dropWaitingCallbackCount += 1;

    const badSegA = analyzeSegment(globalSegDefA, mismatchedObs);
    const badSegB = analyzeSegment(globalSegDefB, mismatchedObs);
    assert.equal(badSegA.frontendStages.valid, false, 'frontendStages.valid must be false on drop mismatch');
    assert.equal(badSegA.frontendStages.droppedBreakdown.matches, false, 'droppedBreakdown.matches must be false');
    assert(badSegA.frontendStages.reason.includes('frontend_stages_dropped_mismatch'), 'reason must state mismatch');

    const badComp = compareSegments(badSegA, badSegB, mismatchedObs);
    assert.equal(badComp.frontendStageDeltas, null, 'frontendStageDeltas must be suppressed to null');
    assert.equal(badComp.deltas.clientDrawRateFps, null, 'clientDrawRateFps must be null');

    const reportObj = {
      state: 'synthetic',
      createdAt: '2026-10-14T08:00:00.000Z',
      status: { reportWritten: true, dataReady: true, reasons: [] },
      metadata: { scene: 'lucy', runDir: 'C:\\test\\run-frontend-p2' },
      segments: [badSegA, badSegB],
      comparison: badComp,
      boundaries: [],
    };
    const reportMd = renderMarkdownReport(reportObj);
    assert(reportMd.includes('已抑制前端分阶段对比差值'), 'Report must explain suppressed stage deltas');
  }

  console.log('✓ Test 9 passed: Review R1-R4 counterexample regression checks verified.');
}

// A stopped run keeps its counters, but its elapsed clock must no longer advance.
{
  console.log('--- Test 10: Stopped clock and restart timing ---');
  const env = createClientSandbox({ clientSource });
  let streamController;
  let heldRaf;
  env.sandbox.requestAnimationFrame = cb => { heldRaf = cb; return 0; };
  const flush = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
  const fetchImpl = async (url, options = {}) => {
    if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'clock-run', created: true }, running: true }) };
    if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
    if (url === '/whale-wallpaper/stream') {
      const stream = new ReadableStream({ start(controller) { streamController = controller; } });
      const controller = streamController;
      options.signal?.addEventListener('abort', () => controller.close(), { once: true });
      return { ok: true, body: stream };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const engine = env.exportedModule.createWallpaperEngine({ fetchImpl, now: env.getTime, monotonicNow: env.getMonoTime });
  engine.subscribe({ onFrame: bitmap => bitmap.close() });
  try {
    await engine.start();
    await flush();
    env.setTime(2000);
    streamController.enqueue(createWhl1Packet(1));
    await flush();
    heldRaf();
    await flush();
    assert.equal(engine.snapshot().seconds, 1, 'Running clock uses this run start');
    assert.equal(engine.snapshot().rendered, 1, 'Actual stream frame was processed');

    await engine.stop();
    assert.equal(engine.snapshot().seconds, 0, 'Stop must clear the active run clock');
    env.setTime(4000);
    assert.equal(engine.snapshot().seconds, 0, 'Stopped clock must remain zero as time advances');
    assert.equal(engine.snapshot().rendered, 1, 'Stop retains ended run frame counters');

    await engine.start();
    await flush();
    env.setTime(5000);
    assert.equal(engine.snapshot().seconds, 1, 'New run starts its own clock');
    assert.equal(engine.snapshot().rendered, 0, 'New run resets frame counters');
    await engine.stop();
    assert.equal(engine.snapshot().seconds, 0, 'Repeated stop clears the new run clock');
  } finally {
    engine.dispose();
    await flush();
  }
  console.log('✓ Test 10 passed: Stop clears elapsed time and preserves counters; a new run starts fresh.');
}

console.log('\n======================================================');
console.log('ALL FRONTEND STAGE (P2) VERIFICATION CHECKS PASSED!');
console.log('======================================================');
