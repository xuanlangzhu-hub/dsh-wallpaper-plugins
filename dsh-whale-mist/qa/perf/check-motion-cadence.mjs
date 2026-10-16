// Verification and Replay Suite for Motion Cadence Trace & Offline Analyzer.
//
// Tests:
// 1. Native Cadence Trace CLI, parse-check, self-tests (cadence-trace, pacing, native-wait),
//    isolated compilation (0 warnings/errors), and asset immutability.
// 2. Host FrameHub & streamFrames real replay:
//    - frame arrival to FrameDecoder
//    - streamFrames backpressure (res.write=false -> drain)
//    - sequence skip distinction: 'latest-overwritten' vs 'duplicate-sequence'
//    - connection isolation (concurrent streams tag separate connectionIds)
//    - x-cadence-trace: 1, x-cadence-run-id, x-cadence-connection-id header negotiation
// 3. Client Production Pipeline real replay & off vs on parity:
//    - Stepped virtual clock simulation driving real FrameDecoder -> accept -> schedulePaint -> paint -> backdrop canvas
//    - 3 arrival cadences (Steady 33.3ms, Burst 10/10/80ms, Decode Jitter 5/25/45ms)
//    - Real continuous painting: actual canvas drawCount >= 10 in all scenarios
//    - Exact parity in render/drop counts, drop classifications, and bitmap disposal between trace OFF and ON
//    - Edge cases: missing canvas, draw throwing error, stale generation discard, RAF cancellation on stop, batch chunking
// 4. Host Session cadence trace routes & ingestion security:
//    - GET trace endpoint
//    - POST batch ingestion with valid runId (204)
//    - Missing or mismatched runId rejection (400)
//    - Forged clockDomain batch rejection (400)
//    - Body size limit (>256KB rejection)
//    - Non-blocking stop: hanging file write does not block stop() (<300ms timeout)
// 5. Cadence Analyzer pipeline alignment & statistics:
//    - Multi-domain trace alignment using real session exports from Section 3/4
//    - Consecutive-only cadenceProxyRatio (no ratios computed across sequence gaps or missing WGC)
//    - Grouping by runId / connectionId preventing negative intervals
//    - Full anomaly detection (backpressure, skips, duplicate events, cross-run, clock mismatch)
//    - Data availability checks (unavailable / degraded / available)
// 6. Synthetic fixture & rate masking demonstration:
//    - Identical mean FPS (~30fps) with vastly different P95 (34ms vs 80ms)
//    - Labeled 'synthetic'
// 7. Resource ceiling & trace disabled verification:
//    - Strict bounded capacity (8192 events) with overflow tracking
//    - Zero per-frame allocations / I/O when disabled (events === null)
//
// Usage:
//   node qa/perf/check-motion-cadence.mjs

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import vm from 'node:vm';

import { CadenceTraceCollector, CADENCE_TRACE_CAPACITY, CADENCE_TRACE_SCHEMA_VERSION } from '../../src/wallpaper/cadence-trace.js';
import { FrameHub, streamFrames } from '../../src/wallpaper/frame-hub.js';
import { FrameDecoder } from '../../src/wallpaper/frame-protocol.js';
import { createPreviewSession, registerWallpaperRoutes } from '../../src/wallpaper/session.js';
import {
  alignCadenceTrace,
  analyzeCadenceTimeline,
  computeStats,
  computeIntervals,
  generateSyntheticFixtureComparison,
} from './analyze-motion-cadence.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const pluginRoot = resolve(__dirname, '../..');
const clientPath = resolve(pluginRoot, 'src/client.js');
const probeProjectDir = resolve(pluginRoot, 'qa/wallpaper-probe');
const evidenceDir = join(repoRoot, '.tmp', `motion-cadence-check-${Date.now()}`);

console.log('=== Starting Motion Cadence Trace & Offline Replay Suite ===');
console.log(`Evidence Directory: ${evidenceDir}`);
await mkdir(evidenceDir, { recursive: true });

function createWhl1Packet(sequence, width = 100, height = 100, capturedAt = 1000, jpegPayload = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])) {
  const header = new ArrayBuffer(24 + jpegPayload.byteLength);
  const view = new DataView(header);
  view.setUint32(0, 0x57484c31, false); // Magic 'WHL1'
  view.setUint32(4, sequence, true);
  view.setUint32(8, jpegPayload.byteLength, true);
  view.setBigInt64(12, BigInt(Math.round(capturedAt)), true);
  view.setUint16(20, width, true);
  view.setUint16(22, height, true);
  const bytes = new Uint8Array(header);
  bytes.set(jpegPayload, 24);
  return bytes;
}

function createSteppedClientSandbox(options = {}) {
  const {
    clientSource,
    initialMonoTime = 1000.0,
    onDraw = null,
    hidden = false,
  } = options;

  let monotonicTime = initialMonoTime;
  let wallTime = initialMonoTime;

  const rafQueue = new Map();
  let rafIdCounter = 1;
  const timerQueue = new Map();
  let timerIdCounter = 1;

  const scheduleRaf = (cb) => {
    const id = rafIdCounter++;
    rafQueue.set(id, cb);
    return id;
  };
  const cancelRaf = (id) => {
    rafQueue.delete(id);
  };

  const scheduleTimer = (cb, ms = 0) => {
    const id = timerIdCounter++;
    timerQueue.set(id, { cb, due: monotonicTime + Math.max(0, ms) });
    return id;
  };
  const cancelTimer = (id) => {
    timerQueue.delete(id);
  };

  const fakeContext = {
    drawImage: (bmp, x, y) => {
      if (onDraw) onDraw(bmp, x, y);
    },
  };

  const fakeCanvas = {
    className: 'wm-backdrop-media',
    width: 0,
    height: 0,
    getContext: () => fakeContext,
  };

  let wallpaperLayer = null;

  const sandbox = {
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    document: {
      hidden,
      body: {
        dataset: {},
        prepend: (el) => { wallpaperLayer = el; },
      },
      createElement: (tag) => {
        if (tag === 'canvas') return fakeCanvas;
        const div = {
          id: '',
          className: '',
          hidden: false,
          dataset: {},
          children: [],
          append: (...children) => { div.children.push(...children); },
          setAttribute: (k, v) => { div[k] = v; },
          removeAttribute: (k) => { delete div[k]; },
          querySelector: (sel) => {
            if (sel === '.wm-backdrop-media') {
              return div.children.find(c => c.className === 'wm-backdrop-media') || null;
            }
            return null;
          },
          remove: () => { wallpaperLayer = null; },
        };
        return div;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    requestAnimationFrame: (cb) => scheduleRaf(cb),
    cancelAnimationFrame: (id) => cancelRaf(id),
    setTimeout: (cb, ms) => scheduleTimer(cb, ms),
    clearTimeout: (id) => cancelTimer(id),
    setInterval: (cb, ms) => scheduleTimer(cb, ms),
    clearInterval: (id) => cancelTimer(id),
    performance: { now: () => monotonicTime },
    createImageBitmap: null,
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
    ReadableStream,
    Response,
    Headers,
  };

  sandbox.window = sandbox;

  let exportedModule = null;
  sandbox.window.__ModuleLoader__ = {
    load: (mod) => {
      exportedModule = mod.factory(() => ({}));
    },
  };

  vm.runInNewContext(clientSource, sandbox);

  async function stepTime(advanceMs) {
    const targetMono = monotonicTime + advanceMs;
    while (monotonicTime < targetMono) {
      const step = Math.min(16.667, targetMono - monotonicTime);
      monotonicTime += step;
      wallTime += step;

      // Fire due timers
      for (const [id, timer] of Array.from(timerQueue.entries())) {
        if (timer.due <= monotonicTime) {
          timerQueue.delete(id);
          timer.cb();
        }
      }

      // Fire queued RAFs
      if (rafQueue.size > 0) {
        const rafs = Array.from(rafQueue.values());
        rafQueue.clear();
        for (const cb of rafs) {
          cb(monotonicTime);
        }
      }

      await new Promise(r => setImmediate(r));
    }
  }

  return {
    sandbox,
    exportedModule,
    fakeCanvas,
    fakeContext,
    getWallpaperLayer: () => wallpaperLayer,
    setWallpaperLayer: (l) => { wallpaperLayer = l; },
    getMonoTime: () => monotonicTime,
    setMonoTime: (t) => { monotonicTime = t; },
    advanceMonoTime: (ms) => { monotonicTime += ms; wallTime += ms; },
    stepTime,
  };
}

try {
  // =========================================================================
  // Section 1: Native WallpaperProbe Isolated Build, CLI, & Self-Tests
  // =========================================================================
  console.log('--- Section 1: Native WallpaperProbe Build, Self-Tests, & CLI ---');
  {
    // 1.1 Verify asset immutability (rc.30 baseline)
    const expectedHashes = {
      'assets/wallpaper/WallpaperProbe.dll': 'FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34',
      'assets/wallpaper/WallpaperProbe.exe': 'C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731',
      'assets/wallpaper/WallpaperProbe.deps.json': '8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95',
    };

    for (const [relPath, expectedHash] of Object.entries(expectedHashes)) {
      const fullPath = join(pluginRoot, relPath);
      const data = await readFile(fullPath);
      const actualHash = createHash('sha256').update(data).digest('hex').toUpperCase();
      assert.equal(actualHash, expectedHash, `Asset file ${relPath} must strictly match rc.30 baseline`);
    }
    console.log('  [PASS] Assets immutability check against rc.30 baseline passed.');

    // 1.2 Isolated C# compilation
    const probeBuildDir = join(evidenceDir, 'isolated-probe-bin');
    console.log(`  Compiling WallpaperProbe to isolated dir: ${probeBuildDir}`);
    const buildOutput = execFileSync('dotnet', [
      'build',
      probeProjectDir,
      '-c', 'Release',
      '-o', probeBuildDir,
      '-p:ContinuousIntegrationBuild=true',
    ], { encoding: 'utf8' });

    assert.match(buildOutput, /0 Warning\(s\)|0 个警告/i, 'Isolated build must have 0 warnings');
    assert.match(buildOutput, /0 Error\(s\)|0 个错误/i, 'Isolated build must have 0 errors');
    console.log('  [PASS] Isolated WallpaperProbe compiled with 0 warnings and 0 errors.');

    const probeExe = join(probeBuildDir, 'WallpaperProbe.exe');

    // 1.3 CLI parse check with and without --cadence-trace
    const argvOffFile = join(evidenceDir, 'argv-off.json');
    await writeFile(argvOffFile, JSON.stringify(['0', 'C:\\temp\\wm-output', '--forever', '30', 'pipe', '--owned-location', 'WhaleWallpaperProbe-loc-1']));
    const parseCheckOff = execFileSync(probeExe, ['--parse-check', argvOffFile], { encoding: 'utf8' });
    const jsonOff = JSON.parse(parseCheckOff.trim().split('\n').filter(Boolean).pop());
    assert.equal(jsonOff.ok, true);
    assert.equal(jsonOff.cadenceTrace, false, 'Without --cadence-trace, parsed flag must be false');

    const argvOnFile = join(evidenceDir, 'argv-on.json');
    await writeFile(argvOnFile, JSON.stringify(['0', 'C:\\temp\\wm-output', '--forever', '30', 'pipe', '--owned-location', 'WhaleWallpaperProbe-loc-1', '--cadence-trace']));
    const parseCheckOn = execFileSync(probeExe, ['--parse-check', argvOnFile], { encoding: 'utf8' });
    const jsonOn = JSON.parse(parseCheckOn.trim().split('\n').filter(Boolean).pop());
    assert.equal(jsonOn.ok, true);
    assert.equal(jsonOn.cadenceTrace, true, 'With --cadence-trace, parsed flag must be true');
    console.log('  [PASS] Native CLI argument parsing correctly detects --cadence-trace.');

    // 1.4 Native Cadence Trace SelfTest
    const cadenceSelfTest = execFileSync(probeExe, ['--self-test-cadence-trace'], { encoding: 'utf8' });
    const cadenceResult = JSON.parse(cadenceSelfTest.trim().split('\n').filter(l => l.startsWith('{')).pop());
    assert.equal(cadenceResult.ok, true, 'CadenceTrace.SelfTest must succeed');
    assert.equal(cadenceResult.schemaVersion, 1);
    assert.equal(cadenceResult.retained, 32);
    assert.equal(cadenceResult.overflowCount, 18);
    assert.equal(cadenceResult.totalRecorded, 50);
    console.log('  [PASS] Native CadenceTrace.SelfTest ring buffer wrap & overflow verified.');

    // 1.5 P3 Native Pacing SelfTest regression check
    const pacingDir = join(evidenceDir, 'probe-self-pacing');
    const pacingSelfTest = execFileSync(probeExe, ['--self-test-native-pacing', pacingDir], { encoding: 'utf8' });
    const pacingResult = JSON.parse(pacingSelfTest.trim().split('\n').filter(l => l.startsWith('{')).pop());
    assert.equal(pacingResult.ok, true, 'P3 pacing self-test must succeed');
    assert.equal(pacingResult.mismatches, 0, 'P3 pacing self-test must report 0 mismatches');
    assert.equal(pacingResult.snapshotFields, 22, 'P3 pacing self-test must preserve 22 fields');
    console.log('  [PASS] Native P3 pacing self-test preserved (22 fields, 0 mismatches).');

    // 1.6 P4 Native Wait SelfTest regression check
    const waitDir = join(evidenceDir, 'probe-self-wait');
    const waitSelfTest = execFileSync(probeExe, ['--self-test-native-wait', waitDir], { encoding: 'utf8' });
    assert.match(waitSelfTest, /self-test passed: 54 checks/, 'P4 native wait self-test must report 54 checks passed');
    const waitReport = JSON.parse(await readFile(join(waitDir, 'self-test.json'), 'utf8'));
    assert.equal(waitReport.passed, true, 'P4 native wait self-test report must have passed=true');
    assert.equal(waitReport.checks.length, 54, 'P4 native wait self-test must have 54 checks in list');
    console.log('  [PASS] Native P4 wait self-test preserved (54 checks passed).');
  }

  // =========================================================================
  // Section 2: Host FrameHub & streamFrames Real Replay
  // =========================================================================
  console.log('--- Section 2: Host FrameHub & streamFrames Real Replay ---');
  {
    const hostTraceCollector = new CadenceTraceCollector({ enabled: true, runId: 'run-host-test', clockDomain: 'host-mono' });
    const hub = new FrameHub({ cadenceTrace: hostTraceCollector, runId: 'run-host-test' });

    // 2.1 Feed WHL1 frames to FrameHub and verify host-hub-received events
    for (let seq = 1; seq <= 5; seq++) {
      const packet = createWhl1Packet(seq, 1920, 1080, 1000 + seq * 33);
      hub.push(packet);
    }
    assert.equal(hub.received, 5);
    const hostSnap1 = hostTraceCollector.snapshot();
    const recvEvents = hostSnap1.records.filter(r => r.event === 'host-hub-received');
    assert.equal(recvEvents.length, 5);
    assert.equal(recvEvents[0].sequence, 1);
    assert.equal(recvEvents[4].sequence, 5);
    assert.equal(recvEvents[0].clockDomain, 'host-mono');
    console.log('  [PASS] FrameDecoder -> FrameHub records host-hub-received events.');

    // 2.2 streamFrames with backpressure, drain, and handshake identity headers
    let writeShouldBlock = false;
    const writtenPackets = [];
    class MockResponse extends EventEmitter {
      constructor() {
        super();
        this.headers = {};
        this.statusCode = null;
      }
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
      }
      flushHeaders() {}
      write(chunk) {
        writtenPackets.push(chunk);
        return !writeShouldBlock;
      }
      end() {
        this.emit('close');
      }
    }

    const res = new MockResponse();
    const endStream = streamFrames(hub, res, { cadenceTrace: hostTraceCollector, runId: 'run-host-test', connId: 'conn-1' });

    // Assert handshake identity headers: x-cadence-trace, x-cadence-run-id, x-cadence-connection-id
    assert.equal(res.headers['x-cadence-trace'], '1', 'Stream response must contain x-cadence-trace: 1 header');
    assert.equal(res.headers['x-cadence-run-id'], 'run-host-test', 'Stream response must contain x-cadence-run-id header');
    assert.equal(res.headers['x-cadence-connection-id'], 'conn-1', 'Stream response must contain x-cadence-connection-id header');

    // Simulate next frame arrival with backpressure active
    writeShouldBlock = true;
    hub.push(createWhl1Packet(6, 1920, 1080, 1200));

    const hostSnap2 = hostTraceCollector.snapshot();
    const write6 = hostSnap2.records.find(r => r.event === 'host-stream-write' && r.sequence === 6);
    assert.ok(write6, 'Must record host-stream-write for seq 6');
    assert.equal(write6.backpressure, true, 'Seq 6 must have backpressure = true');
    assert.equal(write6.connectionId, 'conn-1');

    // 2.3 Latest-overwritten skip detection during backpressure
    // Frames 7 and 8 arrive while blocked; frame 9 arrives as the latest
    hub.push(createWhl1Packet(7, 1920, 1080, 1233));
    hub.push(createWhl1Packet(8, 1920, 1080, 1266));
    hub.push(createWhl1Packet(9, 1920, 1080, 1300));

    // Emit drain to unblock and pump latest (frame 9)
    writeShouldBlock = false;
    res.emit('drain');

    const hostSnap3 = hostTraceCollector.snapshot();
    const drainEvent = hostSnap3.records.find(r => r.event === 'host-stream-drain' && r.sequence === 6);
    assert.ok(drainEvent, 'Must record host-stream-drain after drain event');

    const latestSkip = hostSnap3.records.find(r => r.event === 'host-stream-skip' && r.reason === 'latest-overwritten');
    assert.ok(latestSkip, 'Must record host-stream-skip with reason=latest-overwritten');
    assert.equal(latestSkip.skippedFrom, 7);
    assert.equal(latestSkip.skippedTo, 8);
    assert.equal(latestSkip.skippedCount, 2);
    console.log('  [PASS] Host latest-overwritten skip correctly recorded (skipped 7..8, count=2).');

    // 2.4 Duplicate sequence skipping
    hub.emit('frame');
    const hostSnap4 = hostTraceCollector.snapshot();
    const dupSkip = hostSnap4.records.find(r => r.event === 'host-stream-skip' && r.reason === 'duplicate-sequence');
    assert.ok(dupSkip, 'Must record host-stream-skip on duplicate sequence pump');

    // 2.5 Connection isolation
    const res2 = new MockResponse();
    const endStream2 = streamFrames(hub, res2, { cadenceTrace: hostTraceCollector, runId: 'run-host-test', connId: 'conn-2' });
    hub.push(createWhl1Packet(10, 1920, 1080, 1333));

    const hostSnap5 = hostTraceCollector.snapshot();
    const writes10 = hostSnap5.records.filter(r => r.event === 'host-stream-write' && r.sequence === 10);
    assert.equal(writes10.length, 2, 'Two separate connections must each record their own write');
    const connIds = writes10.map(w => w.connectionId).sort();
    assert.deepEqual(connIds, ['conn-1', 'conn-2'], 'Writes must preserve separate connectionIds');

    endStream();
    endStream2();
    hub.close();
    console.log('  [PASS] streamFrames backpressure, drain, latest-overwritten skip, and connection isolation verified.');
  }

  const scenarioReplayData = {};

  // =========================================================================
  // Section 3: Client Production Pipeline Real Replay & Off vs On Parity
  // =========================================================================
  console.log('--- Section 3: Client Pipeline Real Replay & Off vs On Parity ---');
  {
    const clientSource = await readFile(clientPath, 'utf8');

    // Helper to run a test run on the client engine using real stream response, WHL1 decoder, backdrop and stepped clock
    async function runClientScenario(scenarioName, cadenceTraceEnabled, frameDelays, decodeDelays) {
      let drawCount = 0;
      let bitmapsClosed = 0;
      const postedBatches = [];

      const env = createSteppedClientSandbox({
        clientSource,
        onDraw: () => {
          drawCount++;
        },
      });

      // Track closed bitmaps & simulate decode time using sandbox setTimeout
      env.sandbox.createImageBitmap = () => new Promise(resolve => {
        const decodeTime = typeof decodeDelays === 'function' ? decodeDelays(drawCount) : (decodeDelays[drawCount % decodeDelays.length] ?? 5);
        env.sandbox.setTimeout(() => {
          resolve({
            width: 100,
            height: 100,
            close: () => { bitmapsClosed++; },
          });
        }, decodeTime);
      });

      let streamController = null;
      const stream = new env.sandbox.ReadableStream({
        start(controller) {
          streamController = controller;
        },
      });

      const runId = `run-${scenarioName.toLowerCase()}`;
      const connId = `conn-${scenarioName.toLowerCase()}`;

      // Mock fetch with real stream handshake negotiation headers
      const fetchImpl = async (url, opts) => {
        if (url === '/whale-wallpaper/start') {
          return { ok: true, json: async () => ({ window: { location: runId, created: true }, running: true }) };
        }
        if (url === '/whale-wallpaper/stream') {
          return {
            ok: true,
            body: stream,
            headers: {
              get: (k) => {
                const lower = k.toLowerCase();
                if (lower === 'x-cadence-trace') return cadenceTraceEnabled ? '1' : '0';
                if (lower === 'x-cadence-run-id') return runId;
                if (lower === 'x-cadence-connection-id') return connId;
                return null;
              },
            },
          };
        }
        if (url === '/whale-wallpaper/stop') {
          return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
        }
        if (url === '/whale-wallpaper/metrics') return { ok: true, status: 204 };
        if (url === '/whale-wallpaper/cadence-trace') {
          if (opts?.body) {
            try { postedBatches.push(JSON.parse(opts.body)); } catch {}
          }
          return { ok: true, status: 204 };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      };

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl,
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
        firstFrameTimeoutMs: 10000,
        idleTimeoutMs: 10000,
      });

      // Mount backdrop and start wallpaper mode
      const backdrop = env.exportedModule.createBackdrop(engine);
      backdrop.start({ background: 'wallpaper', motion: 'always' }, true);

      await engine.start();
      await new Promise(r => setImmediate(r));

      // Stepped feeding loop: advance virtual time by delay, feed frame through real WHL1 stream, allow RAF and decode to interleave
      for (let i = 0; i < frameDelays.length; i++) {
        const delay = frameDelays[i];
        if (delay > 0) {
          await env.stepTime(delay);
        }
        const seq = i + 1;
        const packet = createWhl1Packet(seq, 100, 100, env.getMonoTime());
        if (streamController) {
          streamController.enqueue(packet);
        }
        await new Promise(r => setImmediate(r));
      }

      // Allow final pending frame paints to settle
      await env.stepTime(100);
      try { streamController?.close(); } catch {}

      const finalMetrics = engine.snapshot();
      await engine.stop();
      backdrop.stop();
      await new Promise(r => setImmediate(r));

      const allRecords = [...postedBatches.flatMap(b => b.records), ...engine.getCadenceTrace()];

      return {
        scenarioName,
        cadenceTraceEnabled,
        metrics: finalMetrics,
        drawCount,
        bitmapsClosed,
        traceRecords: allRecords,
        postedBatches,
      };
    }

    // 3.1 Cadence A: Steady 33.3ms arrivals (15 frames, 5ms decode)
    const steadyArrivals = Array(15).fill(33.3);
    const steadyDecode = [5];
    const steadyOff = await runClientScenario('Steady', false, steadyArrivals, steadyDecode);
    const steadyOn = await runClientScenario('Steady', true, steadyArrivals, steadyDecode);
    scenarioReplayData.steady = steadyOn;

    assert.equal(steadyOff.metrics.rendered, steadyOn.metrics.rendered, 'Steady: rendered count must match');
    assert.equal(steadyOff.metrics.dropped, steadyOn.metrics.dropped, 'Steady: dropped count must match');
    assert.equal(steadyOff.metrics.received, steadyOn.metrics.received, 'Steady: received count must match');
    assert.equal(steadyOff.drawCount, steadyOn.drawCount, 'Steady: actual canvas drawCount must match');
    assert.equal(steadyOff.bitmapsClosed, steadyOn.bitmapsClosed, 'Steady: bitmap disposal count must match');
    assert.ok(steadyOn.drawCount >= 10, `Steady must perform >=10 real canvas draws, got ${steadyOn.drawCount}`);
    assert.equal(steadyOff.traceRecords.length, 0, 'Steady trace disabled must capture 0 records');
    assert.ok(steadyOn.traceRecords.length > 0, 'Steady trace enabled must capture records');

    // Verify client records schema, drawn sequences, and monotonically non-decreasing timestamps
    const steadyDrawEndRecords = steadyOn.traceRecords.filter(r => r.event === 'client-draw-end');
    assert.ok(steadyDrawEndRecords.length >= 10, 'Steady must record >=10 client-draw-end events');
    assert.equal(steadyDrawEndRecords[0].runId, 'run-steady');
    assert.equal(steadyDrawEndRecords[0].connectionId, 'conn-steady');
    assert.equal(steadyDrawEndRecords[0].clockDomain, 'client-mono');
    assert.equal(steadyDrawEndRecords[0].success, true);
    for (let k = 1; k < steadyDrawEndRecords.length; k++) {
      assert.ok(steadyDrawEndRecords[k].sequence > steadyDrawEndRecords[k - 1].sequence, 'Steady drawn sequence numbers must strictly increase');
      assert.ok(steadyDrawEndRecords[k].atMonoMs >= steadyDrawEndRecords[k - 1].atMonoMs, 'Steady drawn timestamps must be non-decreasing');
    }
    console.log(`  [PASS] Cadence A (Steady) Off vs On Parity: draws=${steadyOn.drawCount}, rendered=${steadyOn.metrics.rendered}, sequences=[${steadyDrawEndRecords.map(r => r.sequence).join(',')}]`);

    // 3.2 Cadence B: Batched/Burst arrivals (5ms, 5ms, 80ms)
    const burstArrivals = [5, 5, 80, 5, 5, 80, 5, 5, 80, 5, 5, 80, 5, 5, 80];
    const burstDecode = [5];
    const burstOff = await runClientScenario('Burst', false, burstArrivals, burstDecode);
    const burstOn = await runClientScenario('Burst', true, burstArrivals, burstDecode);
    scenarioReplayData.burst = burstOn;

    assert.equal(burstOff.metrics.rendered, burstOn.metrics.rendered, 'Burst: rendered count must match');
    assert.equal(burstOff.metrics.dropped, burstOn.metrics.dropped, 'Burst: dropped count must match');
    assert.equal(burstOff.metrics.dropWaitingCallbackCount, burstOn.metrics.dropWaitingCallbackCount, 'Burst: dropWaitingCallbackCount must match');
    assert.equal(burstOff.drawCount, burstOn.drawCount, 'Burst: actual canvas drawCount must match');
    assert.equal(burstOff.bitmapsClosed, burstOn.bitmapsClosed, 'Burst: bitmap disposal count must match');
    assert.ok(burstOn.drawCount >= 5, `Burst must execute multiple real canvas draws, got ${burstOn.drawCount}`);
    assert.ok(burstOn.metrics.dropped > 0, 'Burst must exercise frame drops due to burst arrival spacing');

    const burstDrawEndRecords = burstOn.traceRecords.filter(r => r.event === 'client-draw-end');
    for (let k = 1; k < burstDrawEndRecords.length; k++) {
      assert.ok(burstDrawEndRecords[k].sequence > burstDrawEndRecords[k - 1].sequence, 'Burst drawn sequence numbers must strictly increase');
      assert.ok(burstDrawEndRecords[k].atMonoMs >= burstDrawEndRecords[k - 1].atMonoMs, 'Burst drawn timestamps must be non-decreasing');
    }
    console.log(`  [PASS] Cadence B (Burst) Off vs On Parity: draws=${burstOn.drawCount}, dropped=${burstOn.metrics.dropped}, sequences=[${burstDrawEndRecords.map(r => r.sequence).join(',')}]`);

    // 3.3 Cadence C: Decode Jitter (5ms, 25ms, 45ms)
    const jitterArrivals = Array(15).fill(33.3);
    const jitterDecode = [5, 25, 45];
    const jitterOff = await runClientScenario('Jitter', false, jitterArrivals, jitterDecode);
    const jitterOn = await runClientScenario('Jitter', true, jitterArrivals, jitterDecode);
    scenarioReplayData.jitter = jitterOn;

    assert.equal(jitterOff.metrics.rendered, jitterOn.metrics.rendered, 'Jitter: rendered count must match');
    assert.equal(jitterOff.metrics.dropped, jitterOn.metrics.dropped, 'Jitter: dropped count must match');
    assert.equal(jitterOff.metrics.dropDecodingCount, jitterOn.metrics.dropDecodingCount, 'Jitter: dropDecodingCount must match');
    assert.equal(jitterOff.drawCount, jitterOn.drawCount, 'Jitter: actual canvas drawCount must match');
    assert.equal(jitterOff.bitmapsClosed, jitterOn.bitmapsClosed, 'Jitter: bitmap disposal count must match');
    assert.ok(jitterOn.drawCount >= 8, `Jitter must execute multiple real canvas draws, got ${jitterOn.drawCount}`);

    const jitterDrawEndRecords = jitterOn.traceRecords.filter(r => r.event === 'client-draw-end');
    for (let k = 1; k < jitterDrawEndRecords.length; k++) {
      assert.ok(jitterDrawEndRecords[k].sequence > jitterDrawEndRecords[k - 1].sequence, 'Jitter drawn sequence numbers must strictly increase');
      assert.ok(jitterDrawEndRecords[k].atMonoMs >= jitterDrawEndRecords[k - 1].atMonoMs, 'Jitter drawn timestamps must be non-decreasing');
    }
    console.log(`  [PASS] Cadence C (Jitter) Off vs On Parity: draws=${jitterOn.drawCount}, dropped=${jitterOn.metrics.dropped}, sequences=[${jitterDrawEndRecords.map(r => r.sequence).join(',')}]`);

    // 3.4 Edge Cases: missing canvas, draw error, stale generation, schedule cancellation
    // 3.4.1 Missing canvas in paintWallpaper -> client-draw-skipped with reason: 'no-canvas' and bitmap closed
    {
      const env = createSteppedClientSandbox({ clientSource });
      let bitmapsClosed = 0;

      env.sandbox.createImageBitmap = async () => ({
        width: 100, height: 100,
        close: () => { bitmapsClosed++; },
      });

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl: async () => ({ ok: true, status: 204, json: async () => ({}) }),
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
      });

      // Mount backdrop
      const backdrop = env.exportedModule.createBackdrop(engine);
      backdrop.start({ background: 'wallpaper', motion: 'always' }, true);

      await engine.start();
      engine.enableCadenceTrace(true, 'run-no-canvas', 'conn-1');

      // Remove canvas from backdrop layer so paintWallpaper cannot find it
      const layer = env.getWallpaperLayer();
      if (layer) {
        layer.querySelector = () => null;
      }

      engine.acceptFrame({
        sequence: 10,
        width: 100,
        height: 100,
        capturedAt: env.getMonoTime(),
        packet: createWhl1Packet(10),
        jpeg: createWhl1Packet(10).subarray(24),
      });

      await env.stepTime(30);

      assert.equal(bitmapsClosed, 1, 'Bitmap must be closed even when canvas is missing');
      const trace = engine.getCadenceTrace();
      const skipRecord = trace.find(r => r.event === 'client-draw-skipped');
      assert.ok(skipRecord, 'Must record client-draw-skipped via real paintWallpaper');
      assert.equal(skipRecord.reason, 'no-canvas');
      assert.equal(skipRecord.success, false);
      await engine.stop();
      console.log('  [PASS] Edge case: real paintWallpaper handles missing canvas, records skip & closes bitmap.');
    }

    // 3.4.2 Draw error in canvas.drawImage -> recorded failure & bitmap closed
    {
      const env = createSteppedClientSandbox({ clientSource });
      let bitmapsClosed = 0;

      // Force drawImage to throw
      env.fakeContext.drawImage = () => {
        throw new Error('Canvas render failure');
      };

      env.sandbox.createImageBitmap = async () => ({
        width: 100, height: 100,
        close: () => { bitmapsClosed++; },
      });

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl: async () => ({ ok: true, status: 204, json: async () => ({}) }),
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
      });

      const backdrop = env.exportedModule.createBackdrop(engine);
      backdrop.start({ background: 'wallpaper', motion: 'always' }, true);
      await engine.start();
      engine.enableCadenceTrace(true, 'run-draw-err', 'conn-1');

      engine.acceptFrame({
        sequence: 1,
        width: 100,
        height: 100,
        capturedAt: env.getMonoTime(),
        packet: createWhl1Packet(1),
        jpeg: createWhl1Packet(1).subarray(24),
      });

      await env.stepTime(30);

      const metrics = engine.snapshot();
      assert.equal(metrics.drawErrorCount, 1, 'drawErrorCount must be incremented on canvas draw exception');
      assert.equal(bitmapsClosed, 1, 'Bitmap must be closed even when drawImage throws');

      const trace = engine.getCadenceTrace();
      const drawEnd = trace.find(r => r.event === 'client-draw-end');
      assert.ok(drawEnd);
      assert.equal(drawEnd.success, false);
      assert.equal(drawEnd.reason, 'draw-error');
      await engine.stop();
      console.log('  [PASS] Edge case: canvas draw error recorded and bitmap closed in finally.');
    }

    // 3.4.3 Stale generation decode discard
    {
      const env = createSteppedClientSandbox({ clientSource });
      let bitmapsClosed = 0;
      let resolveDecode = null;

      env.sandbox.createImageBitmap = () => new Promise(resolve => {
        resolveDecode = resolve;
      });

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl: async () => ({ ok: true, status: 204, json: async () => ({}) }),
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
      });

      const backdrop = env.exportedModule.createBackdrop(engine);
      backdrop.start({ background: 'wallpaper', motion: 'always' }, true);
      await engine.start();
      engine.enableCadenceTrace(true, 'run-stale', 'conn-1');

      engine.acceptFrame({
        sequence: 1,
        width: 100, height: 100,
        capturedAt: env.getMonoTime(),
        packet: createWhl1Packet(1),
        jpeg: createWhl1Packet(1).subarray(24),
      });

      await env.stepTime(20);

      // Stop engine while decode is in flight
      await engine.stop();

      // Old decode finishes
      resolveDecode({
        width: 100, height: 100,
        close: () => { bitmapsClosed++; },
      });

      await new Promise(r => setImmediate(r));
      assert.equal(bitmapsClosed, 1, 'Stale generation bitmap must be closed and discarded');
      console.log('  [PASS] Edge case: stale generation decode safely discarded and closed.');
    }

    // 3.4.4 Schedule cancellation on stop
    {
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl: async () => ({ ok: true, status: 204, json: async () => ({}) }),
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
      });

      await engine.start();
      engine.acceptFrame({
        sequence: 1,
        width: 100, height: 100,
        capturedAt: env.getMonoTime(),
        packet: createWhl1Packet(1),
        jpeg: createWhl1Packet(1).subarray(24),
      });

      // Frame accepted, RAF scheduled, not fired yet. Stop engine:
      await engine.stop();
      const metrics = engine.snapshot();
      assert.equal(metrics.waitCancelledCount, 1, 'Schedule must be cancelled on stop');
      console.log('  [PASS] Edge case: pending schedule cancelled on stop.');
    }

    // 3.4.3 Bounded batch chunking and 400 failure accounting
    {
      const env = createSteppedClientSandbox({ clientSource });
      let postBodies = [];
      let postCallCount = 0;
      let returnStatus = 400;

      const fetchImpl = async (url, opts) => {
        if (url === '/whale-wallpaper/start') return { ok: true, json: async () => ({ window: { location: 'loc-batch', created: true }, running: true }) };
        if (url === '/whale-wallpaper/stop') return { ok: true, json: async () => ({ cleanup: { outcome: 'closed', closed: true } }) };
        if (url === '/whale-wallpaper/cadence-trace') {
          postCallCount++;
          postBodies.push(JSON.parse(opts.body));
          return { ok: returnStatus < 400, status: returnStatus };
        }
        return { ok: true, status: 204 };
      };

      const engine = env.exportedModule.createWallpaperEngine({
        fetchImpl,
        monotonicNow: env.getMonoTime,
        now: env.getMonoTime,
      });

      await engine.start();
      engine.enableCadenceTrace(true, 'loc-batch', 'conn-batch');

      // Inject 350 trace records
      for (let i = 1; i <= 350; i++) {
        engine.recordCadenceDrawStart(1, i, env.getMonoTime());
      }
      assert.equal(engine.getCadenceTrace().length, 350);

      // Flush 1: server returns 400 -> first batch of 150 records dropped with accounting
      engine.flushCadenceTrace();
      await new Promise(r => setImmediate(r));

      assert.equal(postCallCount, 1);
      assert.equal(postBodies[0].records.length, 150, 'Batch must be sliced to max 150 records');
      assert.equal(engine.getCadenceTrace().length, 200, 'Remaining 200 records kept in buffer');

      // Flush 2: server returns 204 -> next 150 records successfully sent and removed
      returnStatus = 204;
      engine.flushCadenceTrace();
      await new Promise(r => setImmediate(r));

      assert.equal(postCallCount, 2);
      assert.equal(postBodies[1].records.length, 150);
      assert.equal(engine.getCadenceTrace().length, 50, 'Remaining 50 records kept in buffer');

      await engine.stop();
      console.log('  [PASS] Client flush: bounded batch slicing (<=150), 400 drop accounting, and 204 removal verified.');
    }

    // 3.4.4 F3 Verification: ACK ring race (in-flight batch confirmation must NOT drop newer un-sent records after ring head wrap)
    {
      const pending = [];
      const bodies = [];
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        now: env.getMonoTime,
        monotonicNow: env.getMonoTime,
        fetchImpl: (url, opts) => {
          if (url === '/whale-wallpaper/stream') return Promise.resolve({ ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } });
          if (url === '/whale-wallpaper/cadence-trace') {
            bodies.push(JSON.parse(opts.body));
            return new Promise(resolve => pending.push(resolve));
          }
          return Promise.resolve({ ok: true, json: async () => url.endsWith('/stop') ? { cleanup: { closed: true } } : { window: { location: 'r', created: true }, running: true } });
        },
      });
      await engine.start();
      engine.enableCadenceTrace(true, 'r', 'a');
      const gen = engine.getStatus().generation;

      // Fill 8192 records (seq 1..8192)
      for (let i = 1; i <= 8192; i++) engine.recordCadenceDrawStart(gen, i, i);

      // Flush in-flight: sends seq 1..150
      engine.flushCadenceTrace();

      // Append 150 more records (seq 8193..8342), causing ring buffer wrap
      for (let i = 8193; i <= 8342; i++) engine.recordCadenceDrawStart(gen, i, i);

      const before = engine.getCadenceTrace();
      assert.equal(before[0].sequence, 151, 'Buffer head before ACK must be seq 151 after ring wrap');

      // ACK 204 arrives for batch 1 (seq 1..150)
      pending[0]({ ok: true, status: 204 });
      await new Promise(r => setImmediate(r));

      const after = engine.getCadenceTrace();
      // Crucial: seq 151 must STILL be the head, NOT deleted!
      assert.equal(after[0].sequence, 151, 'F3 ACK ring race: seq 151 must NOT be dropped by ACK of batch 1!');
      assert.equal(after.length, 8192, 'Buffer must contain all 8192 valid records without dropping newer unacknowledged records');

      await engine.stop();
      for (const res of pending) res({ ok: true, status: 204 });
      await new Promise(r => setImmediate(r));
      console.log('  [PASS] F3 verified: ACK ring race prevents dropping newer records after buffer wrap.');
    }

    // 3.4.5 F3 Verification: Stop tail flush (remaining buffered records flushed or accurately accounted on stop)
    {
      const bodies = [];
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        now: env.getMonoTime,
        monotonicNow: env.getMonoTime,
        fetchImpl: async (url, opts) => {
          if (url === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
          if (url === '/whale-wallpaper/cadence-trace') {
            bodies.push(JSON.parse(opts.body));
            return { ok: true, status: 204 };
          }
          return { ok: true, json: async () => url.endsWith('/stop') ? { cleanup: { closed: true } } : { window: { location: 'r', created: true }, running: true } };
        },
      });
      await engine.start();
      engine.enableCadenceTrace(true, 'r', 'a');
      const gen = engine.getStatus().generation;

      // Inject 350 records
      for (let i = 1; i <= 350; i++) engine.recordCadenceDrawStart(gen, i, i);

      // Stop engine: tail flush must execute
      await engine.stop();
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));

      const totalSubmitted = bodies.flatMap(b => b.records).length;
      assert.equal(totalSubmitted, 350, 'All 350 records must be submitted across regular/tail batches on stop');
      assert.equal(engine.getCadenceTrace().length, 0, 'No records left unsubmitted in client buffer');
      const stopBatch = bodies.find(b => b.isStop === true);
      assert.ok(stopBatch, 'Tail batch must be flagged with isStop=true');
      console.log('  [PASS] F3 verified: stop tail batch safely flushes remaining records with isStop=true.');
    }

    // 3.4.6 F3 Verification: Stop failure (409) terminates immediately without infinite retry loop
    {
      let requestCount = 0;
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        now: env.getMonoTime,
        monotonicNow: env.getMonoTime,
        fetchImpl: async (url) => {
          if (url === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
          if (url === '/whale-wallpaper/cadence-trace') {
            requestCount++;
            return { ok: false, status: 409 }; // Host session closed
          }
          return { ok: true, json: async () => ({ cleanup: { closed: true } }) };
        },
      });
      await engine.start();
      engine.enableCadenceTrace(true, 'r', 'a');
      const gen = engine.getStatus().generation;
      engine.recordCadenceDrawStart(gen, 1, 100);

      await engine.stop();
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));

      assert.equal(requestCount, 1, '409 response on stop must terminate immediately without retry storm');
      assert.equal(engine.getCadenceTrace().length, 0, 'Client records must be cleared and accounted on terminal 409');
      console.log('  [PASS] F3 verified: 409 on stop terminates without infinite retry storm.');
    }

    // 3.4.7 F3 Verification: Old run delayed ACK does NOT trigger stop tail flush on new activeRun
    {
      let run1PendingResolve;
      let run2FlushCount = 0;
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        now: env.getMonoTime,
        monotonicNow: env.getMonoTime,
        fetchImpl: async (url, opts) => {
          if (url === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
          if (url === '/whale-wallpaper/cadence-trace') {
            const body = JSON.parse(opts.body);
            if (body.runId === 'run-1') {
              return new Promise(resolve => { run1PendingResolve = resolve; });
            }
            if (body.runId === 'run-2' && body.isStop) {
              run2FlushCount++;
            }
            return { ok: true, status: 204 };
          }
          return { ok: true, json: async () => ({ cleanup: { closed: true } }) };
        },
      });

      // Start run 1
      await engine.start();
      engine.enableCadenceTrace(true, 'run-1', 'a');
      const gen1 = engine.getStatus().generation;
      engine.recordCadenceDrawStart(gen1, 1, 100);
      engine.flushCadenceTrace(); // In-flight on run 1

      // Stop run 1 while request is in-flight
      await engine.stop();

      // Start run 2
      await engine.start();
      engine.enableCadenceTrace(true, 'run-2', 'b');
      const gen2 = engine.getStatus().generation;
      engine.recordCadenceDrawStart(gen2, 1, 200);

      // Now run 1's delayed 204 arrives!
      assert.ok(run1PendingResolve, 'Run 1 pending request must exist');
      run1PendingResolve({ ok: true, status: 204 });
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));

      // CRITICAL: run 2 is actively running, its running state must NOT be stopped or affected!
      assert.equal(run2FlushCount, 0, 'Old run 1 late ACK must NOT trigger isStop flush on new activeRun 2');
      console.log('  [PASS] F3 verified: old run late ACK does NOT trigger stop tail flush on new activeRun.');
    }

    // 3.13 L1 Verification: Pending in-flight requests carry AbortSignal and abort within deadline on stop
    {
      const capturedSignals = [];
      let pendingRequests = 0;
      const env = createSteppedClientSandbox({ clientSource });
      const engine = env.exportedModule.createWallpaperEngine({
        now: env.getMonoTime,
        monotonicNow: env.getMonoTime,
        fetchImpl: async (path, options) => {
          if (path === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
          if (path === '/whale-wallpaper/cadence-trace') {
            pendingRequests++;
            capturedSignals.push(options?.signal);
            return new Promise((resolve, reject) => {
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  pendingRequests--;
                  reject(new Error('aborted'));
                });
              }
            });
          }
          return { ok: true, json: async () => ({ cleanup: { closed: true } }) };
        },
      });

      // Run 1: start, record, flush (hangs), then stop
      await engine.start();
      engine.enableCadenceTrace(true, 'run-hang-1', 'conn-1');
      const gen1 = engine.getStatus().generation;
      engine.recordCadenceDrawStart(gen1, 1, 100);
      engine.flushCadenceTrace();
      await engine.stop();

      // Run 2: start, record, flush (hangs), then stop
      await engine.start();
      engine.enableCadenceTrace(true, 'run-hang-2', 'conn-2');
      const gen2 = engine.getStatus().generation;
      engine.recordCadenceDrawStart(gen2, 1, 200);
      engine.flushCadenceTrace();
      await engine.stop();

      assert.equal(capturedSignals.length, 2, 'Both flush requests must be initiated');
      assert.ok(capturedSignals[0], 'Run 1 flush request must have AbortSignal');
      assert.ok(capturedSignals[1], 'Run 2 flush request must have AbortSignal');

      // Advance stepped sandbox time by 250ms (requests abort within 150-200ms deadline)
      await env.stepTime(250);

      assert.equal(pendingRequests, 0, 'L1: All pending hanging requests must be aborted and cleaned up within deadline');
      assert.equal(capturedSignals[0].aborted, true, 'Run 1 request must be aborted');
      assert.equal(capturedSignals[1].aborted, true, 'Run 2 request must be aborted');
      console.log('  [PASS] L1 verified: hanging in-flight requests carry AbortSignal and abort within deadline without accumulating.');
    }

    // 3.14 L1-A Verification: ACK timing around stop (ACK-before-stop and ACK-after-stop positive timing)
    {
      // Sub-test 1: ACK-before-stop
      {
        const postBatches = [];
        const env = createSteppedClientSandbox({ clientSource });
        const engine = env.exportedModule.createWallpaperEngine({
          now: env.getMonoTime,
          monotonicNow: env.getMonoTime,
          fetchImpl: async (path, options) => {
            if (path === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
            if (path === '/whale-wallpaper/cadence-trace') {
              const body = JSON.parse(options.body);
              postBatches.push(body);
              return { ok: true, status: 204 };
            }
            return { ok: true, json: async () => ({ cleanup: { closed: true } }) };
          },
        });

        await engine.start();
        engine.enableCadenceTrace(true, 'run-l1a-1', 'conn-1');
        const gen = engine.getStatus().generation;
        engine.recordCadenceDrawStart(gen, 1, 100);
        engine.flushCadenceTrace();
        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));

        assert.equal(postBatches.length, 1, 'Normal batch must be sent before stop');
        assert.equal(postBatches[0].isStop, false, 'First batch is normal batch');

        await engine.stop();
        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));

        assert.equal(postBatches.length, 2, 'Stop confirmation empty batch must be sent after stop');
        assert.equal(postBatches[1].isStop, true, 'Second batch must be isStop: true');
        assert.equal(postBatches[1].records.length, 0, 'Second batch records must be empty confirmation');
      }

      // Sub-test 2: ACK-after-stop (204 arrives while request was in-flight when stop() occurred)
      {
        let pendingResolve;
        const postBatches = [];
        const env = createSteppedClientSandbox({ clientSource });
        const engine = env.exportedModule.createWallpaperEngine({
          now: env.getMonoTime,
          monotonicNow: env.getMonoTime,
          fetchImpl: async (path, options) => {
            if (path === '/whale-wallpaper/stream') return { ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } };
            if (path === '/whale-wallpaper/cadence-trace') {
              const body = JSON.parse(options.body);
              postBatches.push(body);
              if (body.isStop === false) {
                return new Promise(resolve => { pendingResolve = resolve; });
              }
              return { ok: true, status: 204 };
            }
            return { ok: true, json: async () => ({ cleanup: { closed: true } }) };
          },
        });

        await engine.start();
        engine.enableCadenceTrace(true, 'run-l1a-2', 'conn-2');
        const gen = engine.getStatus().generation;
        engine.recordCadenceDrawStart(gen, 1, 100);
        engine.flushCadenceTrace(); // Initiates normal batch, held in pendingResolve

        // Call stop while normal batch is in-flight!
        await engine.stop();

        assert.equal(postBatches.length, 1, 'Only normal batch in flight before resolution');
        assert.equal(postBatches[0].isStop, false, 'First batch has isStop: false');

        // Now release the 204 for the normal batch
        assert.ok(pendingResolve, 'In-flight normal request must be pending');
        pendingResolve({ ok: true, status: 204 });
        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));

        // Client must NOT have mistaken normal batch 204 as stop confirmation!
        // It must have scheduled and sent the empty isStop: true confirmation batch!
        assert.equal(postBatches.length, 2, 'L1-A: Empty stop confirmation batch must be sent after normal batch 204 arrives');
        assert.equal(postBatches[1].isStop, true, 'L1-A: Second batch must be isStop: true');
        assert.equal(postBatches[1].records.length, 0, 'L1-A: Second batch records must be empty confirmation');
        console.log('  [PASS] L1-A verified: ACK-before-stop and ACK-after-stop positive timing both send isStop tail batch.');
      }
    }

    // 3.15 G1 & G2 Verification: Natural EOF tail flush & bounded stop drain before Host close
    {
      // Sub-test 1 (G2): Natural stream-end EOF flushes buffered tail records with isStop: true without sending /stop
      {
        const tracePosts = [];
        const stopCommands = [];
        let streamController;
        const env = createSteppedClientSandbox({ clientSource });
        const engine = env.exportedModule.createWallpaperEngine({
          now: env.getMonoTime,
          monotonicNow: env.getMonoTime,
          fetchImpl: async (url, opts) => {
            if (url === '/whale-wallpaper/stream') {
              return {
                ok: true,
                body: new env.sandbox.ReadableStream({ start(c) { streamController = c; } }),
                headers: { get: key => ({ 'x-cadence-trace': '1', 'x-cadence-run-id': 'r-eof', 'x-cadence-connection-id': 'c-eof' }[key] ?? null) },
              };
            }
            if (url === '/whale-wallpaper/cadence-trace') {
              tracePosts.push(JSON.parse(opts.body));
              return { ok: true, status: 204 };
            }
            if (url.endsWith('/stop')) stopCommands.push('stop');
            return { ok: true, json: async () => url.endsWith('/stop') ? { cleanup: { closed: true } } : { window: { location: 'r-eof', created: true }, running: true } };
          },
        });
        await engine.start();
        for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r));
        const g = engine.getStatus().generation;
        engine.recordCadenceDrawEnd(g, 1, true, 1);
        engine.recordCadenceDrawEnd(g, 2, true, 1);

        // Close stream naturally (EOF)
        streamController.close();
        for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r));

        assert.equal(engine.getStatus().state, 'stopped', 'G2: Engine state must be stopped after natural EOF');
        assert.equal(engine.getCadenceTrace().length, 0, 'G2: Buffered records must be flushed on natural EOF');
        assert.equal(tracePosts.length, 1, 'G2: Tail batch must be posted on natural EOF');
        assert.equal(tracePosts[0].isStop, true, 'G2: Natural EOF tail batch must have isStop: true');
        assert.equal(tracePosts[0].records.length, 2, 'G2: Both tail records must be included');
        assert.equal(stopCommands.length, 0, 'G2: Natural EOF must not send explicit /stop command');
      }

      // Helper for real-timer client sandbox (advances with real I/O & timers)
      const createRealTimerClientSandbox = () => {
        const env = createSteppedClientSandbox({ clientSource });
        env.sandbox.setTimeout = setTimeout;
        env.sandbox.clearTimeout = clearTimeout;
        env.sandbox.setInterval = setInterval;
        env.sandbox.clearInterval = clearInterval;
        return env;
      };

      // Sub-test 2 (G1-I/O): Real loopback HTTP server with 15ms delayed normal ACK before stop()
      {
        const issued = new Set(['c']);
        const clientCol = new CadenceTraceCollector({ enabled: true, runId: 'r', clockDomain: 'client-mono' });
        const hostCol = new CadenceTraceCollector({ enabled: true, runId: 'r' });
        clientCol.issuedConnections = issued;
        const archivePath = join(evidenceDir, 'closure-archived-client.json');
        let archive = null;
        const active = {
          closed: false,
          issuedConnections: issued,
          cadenceTrace: { host: hostCol, client: clientCol },
          hub: { closed: false, latest: null },
          async create() {},
          async stop() {
            archive = clientCol.snapshot();
            await writeFile(archivePath, JSON.stringify(archive, null, 2));
            this.closed = true;
            return { closed: true };
          },
          isClosed() { return this.closed; },
          state: () => ({ location: 'r' }),
          report: () => ({ window: { location: 'r', created: true } }),
          ending: () => false,
          setClientStatus() {},
        };
        let route;
        registerWallpaperRoutes(
          { effect: cb => cb(), webServer: { register: r => { route = r; return () => {}; } } },
          { sessionFactory: () => active, cadenceTrace: true, exists: () => true, helper: 'F:\\fake\\WallpaperProbe.exe', logRoot: join(evidenceDir, 'loopback-g1'), onWarn() {} }
        );
        const traceResponses = [];
        const events = [];
        let firstSeenResolve;
        const firstSeen = new Promise(resolve => { firstSeenResolve = resolve; });
        const server = createServer((req, res) => {
          const chunks = [];
          const originalIterator = req[Symbol.asyncIterator].bind(req);
          req[Symbol.asyncIterator] = async function* () {
            for await (const c of originalIterator()) { chunks.push(c); yield c; }
          };
          const originalEnd = res.end.bind(res);
          res.end = (...args) => {
            if (req.url === '/whale-wallpaper/cadence-trace') {
              const b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              traceResponses.push({ isStop: b.isStop, sequences: b.records.map(r => r.sequence), status: res.statusCode });
              events.push(`trace-ingested-${b.isStop ? 'final' : 'normal'}-${res.statusCode}`);
              if (traceResponses.length === 1) {
                firstSeenResolve();
                setTimeout(() => {
                  events.push('normal-ack-released-after-15ms');
                  originalEnd(...args);
                }, 15);
                return res;
              }
            }
            if (req.url === '/whale-wallpaper/stop') events.push('stop-response');
            return originalEnd(...args);
          };
          route.handler(req, res).catch(err => { res.statusCode = 500; originalEnd(String(err)); });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        try {
          const opened = await fetch(`${base}/whale-wallpaper/start`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scene: 'lucy' }),
          });
          await opened.text();
          assert.equal(opened.status, 200);

          const env = createRealTimerClientSandbox();
          const engine = env.exportedModule.createWallpaperEngine({
            now: env.getMonoTime,
            monotonicNow: env.getMonoTime,
            fetchImpl: (url, opts) => {
              if (url === '/whale-wallpaper/stream') {
                return Promise.resolve({ ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } });
              }
              if (url === '/whale-wallpaper/cadence-trace' || url === '/whale-wallpaper/stop') {
                return fetch(base + url, opts);
              }
              return Promise.resolve({ ok: true, json: async () => ({ window: { location: 'r', created: true }, running: true }) });
            },
          });
          await engine.start();
          await new Promise(resolve => setImmediate(resolve));
          engine.enableCadenceTrace(true, 'r', 'c');
          const g = engine.getStatus().generation;
          engine.recordCadenceDrawEnd(g, 1, true, 1);
          engine.recordCadenceDrawEnd(g, 2, true, 1);
          engine.flushCadenceTrace();
          await firstSeen;
          engine.recordCadenceDrawEnd(g, 3, true, 1);
          await engine.stop();

          const fromDisk = JSON.parse(await readFile(archivePath, 'utf8'));
          const stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: fromDisk }));
          assert.deepEqual(traceResponses.map(p => p.status), [204, 204], 'G1-I/O: 15ms delayed normal ACK and final isStop batch must both receive 204');
          assert.deepEqual(fromDisk.records.map(r => r.sequence), [1, 2, 3], 'G1-I/O: Archived snapshot on disk must contain all sequences [1, 2, 3]');
          assert.equal(fromDisk.clientFinalized, true, 'G1-I/O: Archived snapshot must record clientFinalized=true');
          assert.equal(stats.state, 'available', 'G1-I/O: Analyzer state must be available');
        } finally {
          server.closeAllConnections();
          await new Promise(resolve => server.close(resolve));
        }
      }

      // Sub-test 3 (G1-I/O Multi-slice & Natural EOF Host Export & Deadline Exhaustion 409)
      {
        // 3a: Multi-slice (>150 records: 320 records -> 3 slices of 150, 150, 20) over real HTTP
        {
          const issued = new Set(['c-slice']);
          const clientCol = new CadenceTraceCollector({ enabled: true, runId: 'r-slice', clockDomain: 'client-mono' });
          const hostCol = new CadenceTraceCollector({ enabled: true, runId: 'r-slice' });
          clientCol.issuedConnections = issued;
          let archive = null;
          const active = {
            closed: false,
            issuedConnections: issued,
            cadenceTrace: { host: hostCol, client: clientCol },
            hub: { closed: false, latest: null },
            async create() {},
            async stop() { archive = clientCol.snapshot(); this.closed = true; return { closed: true }; },
            isClosed() { return this.closed; },
            state: () => ({ location: 'r-slice' }),
            report: () => ({ window: { location: 'r-slice', created: true } }),
            ending: () => false,
            setClientStatus() {},
          };
          let route;
          registerWallpaperRoutes(
            { effect: cb => cb(), webServer: { register: r => { route = r; return () => {}; } } },
            { sessionFactory: () => active, cadenceTrace: true, exists: () => true, helper: 'F:\\fake\\WallpaperProbe.exe', logRoot: join(evidenceDir, 'loopback-slice'), onWarn() {} }
          );
          const server = createServer((req, res) => {
            route.handler(req, res).catch(err => { res.statusCode = 500; res.end(String(err)); });
          });
          await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
          const base = `http://127.0.0.1:${server.address().port}`;
          try {
            await fetch(`${base}/whale-wallpaper/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scene: 'lucy' }) });
            const env = createRealTimerClientSandbox();
            const engine = env.exportedModule.createWallpaperEngine({
              now: env.getMonoTime,
              monotonicNow: env.getMonoTime,
              fetchImpl: (url, opts) => {
                if (url === '/whale-wallpaper/stream') return Promise.resolve({ ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } });
                if (url === '/whale-wallpaper/cadence-trace' || url === '/whale-wallpaper/stop') return fetch(base + url, opts);
                return Promise.resolve({ ok: true, json: async () => ({ window: { location: 'r-slice', created: true }, running: true }) });
              },
            });
            await engine.start();
            engine.enableCadenceTrace(true, 'r-slice', 'c-slice');
            const g = engine.getStatus().generation;
            for (let seq = 1; seq <= 320; seq++) {
              engine.recordCadenceDrawEnd(g, seq, true, 1);
            }
            await engine.stop();
            assert.ok(archive, 'G1-I/O slice: Archive must be captured');
            assert.equal(archive.records.length, 320, 'G1-I/O slice: All 320 records across 3 slices must be ingested before Host close');
            assert.equal(archive.clientFinalized, true, 'G1-I/O slice: Multi-slice stop must finalize only after trailingUnsentCount reaches 0');
            assert.equal(archive.clientTrailingUnsentCount, 0);
          } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
          }
        }

        // 3b: Natural EOF (G2) with real createPreviewSession + HTTP route exporting final tail batch
        {
          const eofOutputDir = join(evidenceDir, 'loopback-eof-output');
          await mkdir(eofOutputDir, { recursive: true });
          let childProc = null;
          let openedLoc = '';
          const eofSession = createPreviewSession({
            cadenceTrace: true,
            exists: () => true,
            sleep: () => Promise.resolve(),
            childExitTimeoutMs: 20,
            childKillTimeoutMs: 20,
            helperRun: async (_h, args) => {
              if (args[0] === '--we-open') { openedLoc = args[1]; return { opened: true }; }
              if (args[0] === '--window-find') return [{ hwnd: 777, pid: 8888, title: openedLoc, visible: true, left: 0, top: 0, width: 1280, height: 720 }];
              if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
              if (args[0] === '--window-onscreen') return { visibleArea: 0, window: { hwnd: 777, pid: 8888, title: openedLoc, visible: true, iconic: false, cloaked: false, left: 4096, top: 0, width: 1280, height: 720 } };
              if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true, location: args[1] };
              return { ok: true };
            },
            spawnChild: () => {
              const c = new EventEmitter();
              c.pid = 8888; c.exitCode = null; c.stdin = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
              c.stdin.on('error', () => {});
              c.stdin.end = () => {};
              c.kill = () => {};
              childProc = c;
              return c;
            },
          });

          let route;
          registerWallpaperRoutes(
            { effect: cb => cb(), webServer: { register: r => { route = r; return () => {}; } } },
            { sessionFactory: () => eofSession, cadenceTrace: true, exists: () => true, helper: 'F:\\fake\\WallpaperProbe.exe', logRoot: eofOutputDir, onWarn() {} }
          );
          const server = createServer((req, res) => {
            route.handler(req, res).catch(err => { res.statusCode = 500; res.end(String(err)); });
          });
          await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
          const base = `http://127.0.0.1:${server.address().port}`;
          try {
            const env = createRealTimerClientSandbox();
            const engine = env.exportedModule.createWallpaperEngine({
              now: env.getMonoTime,
              monotonicNow: env.getMonoTime,
              fetchImpl: (url, opts) => {
                if (url === '/whale-wallpaper/start' || url === '/whale-wallpaper/stream' || url === '/whale-wallpaper/cadence-trace') {
                  return fetch(base + url, opts);
                }
                return Promise.resolve({ ok: true, json: async () => ({ window: { location: openedLoc, created: true }, running: true }) });
              },
            });
            await engine.start();
            // Emit 1 frame from child stdout so FrameDecoder -> hub.push delivers stream headers + chunk
            childProc.stdout.emit('data', Buffer.from(createWhl1Packet(1, 100, 100, Date.now())));
            await new Promise(resolve => setTimeout(resolve, 25));
            const g = engine.getStatus().generation;
            engine.recordCadenceDrawEnd(g, 1, true, 1.2);
            engine.recordCadenceDrawEnd(g, 2, true, 1.5);

            // Simulate natural preview end on Host: child emits Summary + close(0) -> triggers eofSession.stop() -> hub.close() -> Client EOF -> POST /cadence-trace -> Host exports file
            childProc.exitCode = 0;
            childProc.stderr.emit('data', JSON.stringify({
              kind: 'log', level: 'info', scope: 'Summary',
              message: JSON.stringify({ reason: 'duration-elapsed', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } }),
            }) + '\n');
            childProc.emit('close', 0);

            // Wait for eofSession to finish closing and exporting
            for (let i = 0; i < 30 && !eofSession.isClosed(); i++) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.equal(eofSession.isClosed(), true, 'G2 Host EOF: Session must close cleanly');
            await eofSession.stop(); // Wait for existing closing/export task to finish writeCadenceTrace disk writes
            const exportedClient = JSON.parse(await readFile(join(eofSession.state().config.output, 'cadence-trace-client.json'), 'utf8'));
            const eofStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: exportedClient }));
            assert.equal(exportedClient.clientFinalized, true, 'G2 Host EOF: Exported client trace must be finalized after natural EOF');
            assert.ok(exportedClient.records.some(r => r.sequence === 2 && r.event === 'client-draw-end'), 'G2 Host EOF: Exported client trace must contain tail records');
            assert.equal(eofStats.state, 'available', 'G2 Host EOF: Analyzed state must be available');
          } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
          }
        }

        // 3c: Deadline exhaustion (>100ms delay -> 200ms) degrades honestly and late request gets 409
        {
          const issued = new Set(['c-late']);
          const clientCol = new CadenceTraceCollector({ enabled: true, runId: 'r-late', clockDomain: 'client-mono' });
          const hostCol = new CadenceTraceCollector({ enabled: true, runId: 'r-late' });
          clientCol.issuedConnections = issued;
          let archive = null;
          const active = {
            closed: false,
            issuedConnections: issued,
            cadenceTrace: { host: hostCol, client: clientCol },
            hub: { closed: false, latest: null },
            async create() {},
            async stop() { archive = clientCol.snapshot(); this.closed = true; return { closed: true }; },
            isClosed() { return this.closed; },
            state: () => ({ location: 'r-late' }),
            report: () => ({ window: { location: 'r-late', created: true } }),
            ending: () => false,
            setClientStatus() {},
          };
          let route;
          registerWallpaperRoutes(
            { effect: cb => cb(), webServer: { register: r => { route = r; return () => {}; } } },
            { sessionFactory: () => active, cadenceTrace: true, exists: () => true, helper: 'F:\\fake\\WallpaperProbe.exe', logRoot: join(evidenceDir, 'loopback-late'), onWarn() {} }
          );
          let firstSeenResolve;
          const firstSeen = new Promise(resolve => { firstSeenResolve = resolve; });
          let traceCount = 0;
          const server = createServer((req, res) => {
            const originalEnd = res.end.bind(res);
            res.end = (...args) => {
              if (req.url === '/whale-wallpaper/cadence-trace') {
                traceCount++;
                if (traceCount === 1) {
                  firstSeenResolve();
                  setTimeout(() => originalEnd(...args), 220);
                  return res;
                }
              }
              return originalEnd(...args);
            };
            route.handler(req, res).catch(err => { res.statusCode = 500; originalEnd(String(err)); });
          });
          await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
          const base = `http://127.0.0.1:${server.address().port}`;
          try {
            await fetch(`${base}/whale-wallpaper/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scene: 'lucy' }) });
            const env = createRealTimerClientSandbox();
            const engine = env.exportedModule.createWallpaperEngine({
              now: env.getMonoTime,
              monotonicNow: env.getMonoTime,
              fetchImpl: (url, opts) => {
                if (url === '/whale-wallpaper/stream') return Promise.resolve({ ok: true, body: new env.sandbox.ReadableStream(), headers: { get: () => null } });
                if (url === '/whale-wallpaper/cadence-trace' || url === '/whale-wallpaper/stop') return fetch(base + url, opts);
                return Promise.resolve({ ok: true, json: async () => ({ window: { location: 'r-late', created: true }, running: true }) });
              },
            });
            await engine.start();
            engine.enableCadenceTrace(true, 'r-late', 'c-late');
            const g = engine.getStatus().generation;
            engine.recordCadenceDrawEnd(g, 1, true, 1);
            engine.flushCadenceTrace();
            await firstSeen;
            engine.recordCadenceDrawEnd(g, 2, true, 1);
            await engine.stop();

            assert.ok(archive, 'G1-I/O deadline: Archive must be captured after bounded timeout');
            assert.equal(archive.clientFinalized, false, 'G1-I/O deadline: Exhausted deadline must leave clientFinalized=false');
            assert.equal(analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: archive })).state, 'degraded', 'G1-I/O deadline: Analyzer must report degraded');

            // Late POST arriving after session closed must receive 409
            const lateRes = await fetch(`${base}/whale-wallpaper/cadence-trace`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ runId: 'r-late', connectionId: 'c-late', generation: g, clockDomain: 'client-mono', isStop: true, trailingUnsentCount: 0, records: [] }),
            });
            assert.equal(lateRes.status, 409, 'G1-I/O deadline: Late POST after window closed must receive 409');
          } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
          }
        }
        console.log('  [PASS] G1-I/O & G2 verified: real HTTP 15ms ACK drain, multi-slice drain, natural EOF Host export, and deadline exhaustion 409 degradation.');
      }
    }
  }

  // =========================================================================
  // Section 4: Host Session Cadence Trace Routes & Ingestion Security
  // =========================================================================
  console.log('--- Section 4: Host Session Cadence Trace Routes & Ingestion Security ---');
  {
    const sessionOutputDir = join(evidenceDir, 'session-test-output');
    await mkdir(sessionOutputDir, { recursive: true });

    const hostTrace = new CadenceTraceCollector({ enabled: true, runId: 'session-run-1', clockDomain: 'host-mono' });
    const clientTrace = new CadenceTraceCollector({ enabled: true, runId: 'session-run-1', clockDomain: 'client-mono' });
    let sessionWithTrace = null;

    const routes = new Map();
    const ctx = {
      routes,
      effect(callback) { return callback(); },
      route(path, handler) { routes.set(path, { handler }); },
      webServer: { register(r) { routes.set(r.path, r); return () => routes.delete(r.path); } },
    };

    registerWallpaperRoutes(ctx, {
      helper: 'F:\\fake\\WallpaperProbe.exe',
      logRoot: sessionOutputDir,
      cadenceTrace: true,
      sessionFactory: () => {
        let cleanup = null;
        sessionWithTrace = {
          create: async () => {},
          stop: async () => { cleanup = { closed: true, outcome: 'closed' }; return cleanup; },
          isClosed: () => cleanup?.closed === true,
          state: () => ({ location: 'session-run-1', cleanup }),
          report: () => ({ window: { location: 'session-run-1', created: true }, failure: null }),
          cadenceTrace: { host: hostTrace, client: clientTrace },
          hub: { latest: null, closed: false },
          setClientStatus: () => {},
          issuedConnections: new Set(['conn-session-1']),
        };
        clientTrace.registerConnection('conn-session-1');
        return sessionWithTrace;
      },
      exists: () => true,
      onWarn: () => {},
    });

    const route = routes.get('/whale-wallpaper');
    assert.ok(route, 'Route /whale-wallpaper must be registered');

    async function callRoute(method, path, body) {
      const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
      const req = {
        method,
        url: path,
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) yield chunk;
        },
      };
      const response = {
        status: 0,
        payload: null,
        headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        writeHead(code, hdrs) {
          this.status = code;
          if (hdrs) Object.assign(this.headers, hdrs);
        },
        end(value) { this.payload = value; },
      };
      await route.handler(req, response);
      let parsed = null;
      if (response.payload) {
        try { parsed = JSON.parse(response.payload); } catch { parsed = response.payload; }
      }
      return { status: response.status, body: parsed, headers: response.headers };
    }

    // Start session to activate cadence trace in host session
    const startRes = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(startRes.status, 200, `Starting session must succeed, got: ${JSON.stringify(startRes.body)}`);

    // 4.1 GET /whale-wallpaper/cadence-trace
    const getRes = await callRoute('GET', '/whale-wallpaper/cadence-trace');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.schemaVersion, 1);
    console.log('  [PASS] GET /whale-wallpaper/cadence-trace returns valid status & schema.');

    // 4.2 Valid POST /whale-wallpaper/cadence-trace ingestion
    const validBatch = {
      runId: 'session-run-1',
      connectionId: 'conn-session-1',
      clockDomain: 'client-mono',
      records: [
        { runId: 'session-run-1', connectionId: 'conn-session-1', generation: 1, sequence: 1, event: 'client-accept', atMonoMs: 100.5, clockDomain: 'client-mono' },
        { runId: 'session-run-1', connectionId: 'conn-session-1', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 133.8, success: true, durationMs: 2.1, clockDomain: 'client-mono' },
      ],
    };

    const postRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', validBatch);
    assert.equal(postRes.status, 204, 'Valid trace ingestion must return 204');
    assert.equal(clientTrace.snapshot().records.length, 2);
    console.log('  [PASS] POST /whale-wallpaper/cadence-trace ingests valid batch.');

    // 4.3 F1 Verification: Foreign/never-issued connectionId rejected with 400
    const foreignConnBatch = {
      runId: 'session-run-1',
      connectionId: 'never-issued',
      clockDomain: 'client-mono',
      records: [
        { runId: 'session-run-1', connectionId: 'never-issued', generation: 999, sequence: 2, event: 'client-draw-end', atMonoMs: 22, success: true, clockDomain: 'client-mono' },
      ],
    };
    const foreignConnRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', foreignConnBatch);
    assert.equal(foreignConnRes.status, 400, 'Foreign/unissued connectionId must return 400');
    console.log('  [PASS] F1 verified: foreign connectionId rejected with 400.');

    // 4.4 F1 Verification: Incomplete record missing required schema fields rejected with 400
    const incompleteRecordBatch = {
      runId: 'session-run-1',
      connectionId: 'conn-session-1',
      clockDomain: 'client-mono',
      records: [
        { runId: 'session-run-1', event: 'client-draw-end', success: true }, // missing sequence, atMonoMs, generation, connectionId
      ],
    };
    const incompleteRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', incompleteRecordBatch);
    assert.equal(incompleteRes.status, 400, 'Batch with schema violations must return 400');
    console.log('  [PASS] F1 verified: incomplete record schema violations rejected with 400.');

    // 4.4.1 F1 Verification: Empty issued connections set rejects foreign connectionId
    sessionWithTrace.issuedConnections = new Set(); // Reset to empty (no connections issued yet)
    const emptyIssuedRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', foreignConnBatch);
    assert.equal(emptyIssuedRes.status, 400, 'Empty issuedConnections set must reject foreign connectionId');
    sessionWithTrace.issuedConnections = new Set(['conn-session-1']); // Restore valid connection
    console.log('  [PASS] F1 verified: empty issued connections set rejects unknown connectionId.');

    // 4.4.2 F1 Verification: Invalid optional field types (e.g. success: "false", durationMs: -5) rejected with 400
    const invalidOptionalFieldsBatch = {
      runId: 'session-run-1',
      connectionId: 'conn-session-1',
      clockDomain: 'client-mono',
      records: [
        { runId: 'session-run-1', connectionId: 'conn-session-1', generation: 1, sequence: 5, event: 'client-draw-end', atMonoMs: 200, success: 'false', durationMs: -5, clockDomain: 'client-mono' },
      ],
    };
    const invalidOptionalRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', invalidOptionalFieldsBatch);
    assert.equal(invalidOptionalRes.status, 400, 'Invalid optional field types (string success, negative duration) must be rejected with 400');
    console.log('  [PASS] F1 verified: invalid optional field types rejected with 400.');

    // 4.5 Missing or mismatched runId rejection (400)
    const missingRunRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', { connectionId: 'conn-session-1', clockDomain: 'client-mono', records: [{ sequence: 1 }] });
    assert.equal(missingRunRes.status, 400, 'Missing top-level runId must return 400');

    const mismatchRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', { runId: 'wrong-run-id', connectionId: 'conn-session-1', clockDomain: 'client-mono', records: [{ sequence: 1 }] });
    assert.equal(mismatchRes.status, 400, 'Mismatched runId must return 400');
    console.log('  [PASS] Missing or mismatched runId rejected with 400.');

    // 4.6 Forged clock domain batch rejection (400)
    const forgedBatch = {
      runId: 'session-run-1',
      connectionId: 'conn-session-1',
      clockDomain: 'native-mono',
      records: [
        { runId: 'session-run-1', sequence: 10, event: 'client-accept', clockDomain: 'native-mono', atMonoMs: 100 },
      ],
    };
    const forgedRes = await callRoute('POST', '/whale-wallpaper/cadence-trace', forgedBatch);
    assert.equal(forgedRes.status, 400, 'Batch claiming foreign clock domain must be rejected with 400');
    console.log('  [PASS] Forged foreign clock domain rejected with 400.');

    // 4.5 Non-blocking stop: hanging file write does not block stop() (R5)
    let childClosedInStop = false;
    let openedLoc = '';
    const helperRun = async (helper, args) => {
      if (args[0] === '--we-open') { openedLoc = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 9999, title: openedLoc, visible: true, left: 76, top: 76 }];
      if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
      if (args[0] === '--window-ensure-closed') return { closed: true, outcome: 'closed', location: args[1] };
      return {};
    };

    const realSession = createPreviewSession({
      cadenceTrace: true,
      helperRun,
      spawnChild: () => {
        const c = new EventEmitter();
        c.pid = 9999; c.exitCode = null; c.killed = false;
        c.stdin = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
        c.stdin.end = () => {
          c.exitCode = 0;
          c.stderr.emit('data', JSON.stringify({
            kind: 'log', level: 'info', scope: 'Summary',
            message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } }),
          }) + '\n');
          c.emit('exit', 0);
          c.emit('close', 0);
          childClosedInStop = true;
        };
        c.kill = () => { c.killed = true; c.emit('close', 0); };
        return c;
      },
    });

    const stopOutputDir = join(evidenceDir, 'stop-nonblocking-test');
    await mkdir(stopOutputDir, { recursive: true });

    await realSession.create({
      helper: 'F:\\fake\\WallpaperProbe.exe',
      output: stopOutputDir,
      scene: { sceneId: 'lucy', project: 'F:\\fake\\project.json', mode: 'preview', seconds: 180 },
    });

    // Record dummy trace
    realSession.cadenceTrace.host.record({ sequence: 1, event: 'host-hub-received', atMonoMs: 100 });
    realSession.cadenceTrace.client.record({ sequence: 1, event: 'client-accept', atMonoMs: 120 });
    realSession.cadenceTrace.client.clientFinalized = true;

    const stopStart = Date.now();
    const cleanupResult = await realSession.stop();
    const stopElapsed = Date.now() - stopStart;

    assert.ok(stopElapsed < 500, `session.stop() must return promptly without hanging, took ${stopElapsed}ms`);
    assert.equal(realSession.isClosed(), true, 'session must be closed after stop');

    const hostTraceFile = join(stopOutputDir, 'cadence-trace-host.json');
    const clientTraceFile = join(stopOutputDir, 'cadence-trace-client.json');
    assert.ok(await stat(hostTraceFile), 'cadence-trace-host.json published');
    assert.ok(await stat(clientTraceFile), 'cadence-trace-client.json published');
    console.log(`  [PASS] Non-blocking session.stop() completed in ${stopElapsed}ms with atomic trace publish.`);

    // 4.8 F4 Verification: Fault injection - hanging file write stops within 200ms timeout without late publication
    {
      const faultOutputDir = join(evidenceDir, 'stop-hanging-fault-test');
      await mkdir(faultOutputDir, { recursive: true });

      let gateResolve;
      let blockedWrites = 0;
      let openedLoc = '';
      const gate = new Promise(resolve => { gateResolve = resolve; });

      const faultSession = createPreviewSession({
        cadenceTrace: true,
        childExitTimeoutMs: 10,
        childKillTimeoutMs: 10,
        exists: () => true,
        sleep: () => Promise.resolve(),
        writeFile: async (path, content, ...rest) => {
          if (String(path).includes('cadence-trace-host.') && String(path).endsWith('.tmp')) {
            blockedWrites++;
            await gate;
          }
          return writeFile(path, content, ...rest);
        },
        helperRun: async (_h, args) => {
          if (args[0] === '--we-open') { openedLoc = args[1]; return { opened: true }; }
          if (args[0] === '--window-find') return [{ hwnd: 1234, pid: 4242, title: openedLoc, visible: true, left: 76, top: 76, width: 1280, height: 720 }];
          if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
          if (args[0] === '--window-onscreen') return { visibleArea: 0, window: { hwnd: 1234, pid: 4242, title: openedLoc, visible: true, left: 4096, top: 0 } };
          if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true, location: args[1] };
          return { ok: true };
        },
        spawnChild: () => {
          const c = new EventEmitter(); c.pid = 4242; c.exitCode = null; c.killed = false;
          c.stdin = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
          c.stdin.end = () => {
            c.exitCode = 0;
            c.stderr.emit('data', JSON.stringify({ kind: 'log', level: 'info', scope: 'Summary', message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } }) }) + '\n');
            c.emit('exit', 0); c.emit('close', 0);
          };
          c.kill = () => { c.killed = true; c.emit('close', 0); };
          return c;
        },
      });

      await faultSession.create({
        helper: 'F:\\fake\\WallpaperProbe.exe',
        output: faultOutputDir,
        scene: { sceneId: 'lucy', project: 'F:\\fake\\project.json', mode: 'preview', seconds: 180 },
      });

      faultSession.cadenceTrace.host.record({ sequence: 1, event: 'host-hub-received', atMonoMs: 100 });
      faultSession.cadenceTrace.client.record({ sequence: 1, event: 'client-accept', atMonoMs: 120 });

      const faultStopStart = Date.now();
      const stopPromise = faultSession.stop();

      const stopResult = await stopPromise;
      const faultStopElapsed = Date.now() - faultStopStart;

      assert.ok(faultStopElapsed < 450, `Fault session.stop() must return within budget, took ${faultStopElapsed}ms`);
      assert.equal(blockedWrites, 1, 'Hanging write must be intercepted');
      const hostSnapAfterTimeout = faultSession.cadenceTrace.host.snapshot();
      assert.equal(hostSnapAfterTimeout.degraded, true, 'Host snapshot must be marked degraded after timeout');
      assert.equal(hostSnapAfterTimeout.degradeReason, 'export-timeout');

      // Check destination file does NOT exist before releasing gate
      const hostFileExistsBefore = await stat(join(faultOutputDir, 'cadence-trace-host.json')).then(() => true, () => false);
      assert.equal(hostFileExistsBefore, false, 'Trace file must NOT exist while write is hanging');

      // Release the hanging write
      gateResolve();
      await new Promise(resolve => setTimeout(resolve, 50));

      // CRITICAL F4 VERIFICATION: Late release MUST NOT publish destination file because token.cancelled was set!
      const hostFileExistsAfter = await stat(join(faultOutputDir, 'cadence-trace-host.json')).then(() => true, () => false);
      assert.equal(hostFileExistsAfter, false, 'F4 verified: late release after timeout MUST NOT publish destination file');

      console.log('  [PASS] F4 verified: hanging write timed out, marked degraded, and late release did NOT publish file.');
    }

    // 4.9 F4 Verification: Fault injection - hanging rename cancels publish and unlinks destination
    {
      const renameOutputDir = join(evidenceDir, 'stop-rename-fault-test');
      await mkdir(renameOutputDir, { recursive: true });

      let renameGateResolve;
      const renameGate = new Promise(resolve => { renameGateResolve = resolve; });
      let openedLoc2 = '';
      let blockedRenames = 0;

      const faultRenameSession = createPreviewSession({
        cadenceTrace: true,
        childExitTimeoutMs: 10,
        childKillTimeoutMs: 10,
        exists: () => true,
        sleep: () => Promise.resolve(),
        rename: async (src, dest) => {
          if (String(dest).includes('cadence-trace-host.json')) {
            blockedRenames++;
            await renameGate;
          }
          return rename(src, dest);
        },
        helperRun: async (_h, args) => {
          if (args[0] === '--we-open') { openedLoc2 = args[1]; return { opened: true }; }
          if (args[0] === '--window-find') return [{ hwnd: 5555, pid: 4343, title: openedLoc2, visible: true, left: 76, top: 76, width: 1280, height: 720 }];
          if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
          if (args[0] === '--window-onscreen') return { visibleArea: 0, window: { hwnd: 5555, pid: 4343, title: openedLoc2, visible: true, left: 4096, top: 0 } };
          if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true, location: args[1] };
          return { ok: true };
        },
        spawnChild: () => {
          const c = new EventEmitter(); c.pid = 4343; c.exitCode = null; c.killed = false;
          c.stdin = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
          c.stdin.end = () => {
            c.exitCode = 0;
            c.stderr.emit('data', JSON.stringify({ kind: 'log', level: 'info', scope: 'Summary', message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } }) }) + '\n');
            c.emit('exit', 0); c.emit('close', 0);
          };
          c.kill = () => { c.killed = true; c.emit('close', 0); };
          return c;
        },
      });

      await faultRenameSession.create({
        helper: 'F:\\fake\\WallpaperProbe.exe',
        output: renameOutputDir,
        scene: { sceneId: 'lucy', project: 'F:\\fake\\project.json', mode: 'preview', seconds: 180 },
      });

      faultRenameSession.cadenceTrace.host.record({ sequence: 1, event: 'host-hub-received', atMonoMs: 100 });
      faultRenameSession.cadenceTrace.client.record({ sequence: 1, event: 'client-accept', atMonoMs: 120 });

      const stop1Start = Date.now();
      const stop1Promise = faultRenameSession.stop();
      await stop1Promise;
      const stop1Elapsed = Date.now() - stop1Start;
      assert.ok(stop1Elapsed < 450, `Fault rename stop must return within budget, took ${stop1Elapsed}ms`);
      assert.equal(blockedRenames, 1, 'Rename operation must be intercepted');

      // Stop retry while in-flight task is still pending: must NOT spawn second writeTask
      await faultRenameSession.stop();
      assert.equal(blockedRenames, 1, 'Retry stop must NOT stack new writeTask while in-flight');

      // Release rename gate
      renameGateResolve();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Destination file must be deleted upon cancellation detection and NOT appear
      const hostDestExists = await stat(join(renameOutputDir, 'cadence-trace-host.json')).then(() => true, () => false);
      assert.equal(hostDestExists, false, 'Late rename after timeout must unlink destination and NOT leave published file');
      console.log('  [PASS] F4 verified: hanging rename timed out, retry avoided duplicate task, and late rename unlinked destination.');
    }

    // 4.10 L1 Verification: Session stop closes before in-flight trace arrives, 409 returns, Host exports clientFinalized: false, analyzer degrades
    {
      const unfinalizedDir = join(evidenceDir, 'stop-unfinalized-test');
      await mkdir(unfinalizedDir, { recursive: true });

      // 1. Session stop happens via route and closes the active session
      const stopRes = await callRoute('POST', '/whale-wallpaper/stop');
      assert.equal(stopRes.status, 200, 'Session stop must succeed');

      // 2. Late seq arrives at route after stop -> route returns 409 because session is closed
      const res409 = await callRoute('POST', '/whale-wallpaper/cadence-trace', {
        runId: 'session-run-1',
        connectionId: 'conn-session-1',
        generation: 1,
        clockDomain: 'client-mono',
        isStop: true,
        records: [
          { runId: 'session-run-1', connectionId: 'conn-session-1', generation: 1, sequence: 3, event: 'client-draw-end', atMonoMs: 176, success: true, clockDomain: 'client-mono' },
        ],
      });
      assert.equal(res409.status, 409, 'Late request after stop must return 409');

      // 3. Host export has clientFinalized: false because stop confirmation was never received
      const clientExport = clientTrace.snapshot();
      assert.equal(clientExport.clientFinalized, false, 'Client trace must NOT be marked finalized when stop batch is rejected with 409');
      await writeFile(join(unfinalizedDir, 'cadence-trace-client.json'), JSON.stringify(clientExport, null, 2));

      // 4. Analyzer correctly diagnoses state as degraded and reports clientUnfinalized anomaly
      const aligned = alignCadenceTrace({ clientTrace: clientExport });
      const stats = analyzeCadenceTimeline(aligned);
      assert.equal(stats.state, 'degraded', 'L1: Unfinalized client trace must degrade analyzer state');
      assert.equal(stats.anomalies.clientUnfinalized, 1, 'L1: Anomaly clientUnfinalized must be 1');
      console.log('  [PASS] L1 verified: missing stop confirmation (e.g. 409 late batch) records clientFinalized: false and degrades analyzer state.');
    }

    // 4.11 L1-B Verification: Multi-stream finalization and trailing unsent isolation
    {
      const multiStreamDir = join(evidenceDir, 'multi-stream-isolation-test');
      await mkdir(multiStreamDir, { recursive: true });

      const clientTrace411 = new CadenceTraceCollector({ enabled: true, runId: 'run-multi-stream', clockDomain: 'client-mono' });
      clientTrace411.registerConnection('conn-A');
      clientTrace411.registerConnection('conn-B');

      // 1. Connection A sends normal batch (trailingUnsent=0)
      clientTrace411.appendBatch([
        { runId: 'run-multi-stream', connectionId: 'conn-A', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 100, success: true, clockDomain: 'client-mono' },
        { runId: 'run-multi-stream', connectionId: 'conn-A', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 133, success: true, clockDomain: 'client-mono' },
      ], 'run-multi-stream');
      clientTrace411.updateClientStream('conn-A', 1, { isStop: false, trailingUnsentCount: 0 });

      // 2. Connection B sends normal batch (trailingUnsent=3)
      clientTrace411.appendBatch([
        { runId: 'run-multi-stream', connectionId: 'conn-B', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 105, success: true, clockDomain: 'client-mono' },
        { runId: 'run-multi-stream', connectionId: 'conn-B', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 138, success: true, clockDomain: 'client-mono' },
      ], 'run-multi-stream');
      clientTrace411.updateClientStream('conn-B', 1, { isStop: false, trailingUnsentCount: 3 });

      const snapBeforeAStop = clientTrace411.snapshot();
      assert.equal(snapBeforeAStop.clientFinalized, false, 'Before stop, clientFinalized must be false');
      assert.equal(snapBeforeAStop.clientTrailingUnsentCount, 3, 'Before stop, trailing unsent must be 3');

      // 3. ONLY Connection A sends empty stop confirmation (isStop: true, trailingUnsentCount: 0)
      clientTrace411.updateClientStream('conn-A', 1, { isStop: true, trailingUnsentCount: 0 });

      // Connection B has NOT sent stop confirmation
      const snapAfterAStop = clientTrace411.snapshot();
      assert.equal(snapAfterAStop.clientFinalized, false, 'L1-B: Connection A stop confirmation must NOT certify Connection B');
      assert.equal(snapAfterAStop.clientTrailingUnsentCount, 3, 'L1-B: Connection A trailing=0 must NOT mask Connection B trailing=3');

      // Analyzer on snapAfterAStop must diagnose degraded with clientUnfinalized: 1 and clientTrailingUnsentCount: 3
      const alignedAfterA = alignCadenceTrace({ clientTrace: snapAfterAStop });
      const statsAfterA = analyzeCadenceTimeline(alignedAfterA);
      assert.equal(statsAfterA.state, 'degraded', 'L1-B: Unfinalized stream B must degrade state');
      assert.equal(statsAfterA.anomalies.clientUnfinalized, 1, 'L1-B: Anomaly clientUnfinalized must be 1');
      assert.equal(statsAfterA.anomalies.clientTrailingUnsentCount, 3, 'L1-B: Anomaly clientTrailingUnsentCount must be 3');

      // 4. Positive case: Connection B now sends stop confirmation (isStop: true, trailingUnsentCount: 0)
      clientTrace411.updateClientStream('conn-B', 1, { isStop: true, trailingUnsentCount: 0 });
      const snapBothFinalized = clientTrace411.snapshot();
      assert.equal(snapBothFinalized.clientFinalized, true, 'L1-B: When all streams send stop confirmation, clientFinalized must be true');
      assert.equal(snapBothFinalized.clientTrailingUnsentCount, 0, 'L1-B: When all streams send stop confirmation, trailing unsent must be 0');

      const alignedBoth = alignCadenceTrace({ clientTrace: snapBothFinalized });
      const statsBoth = analyzeCadenceTimeline(alignedBoth);
      assert.equal(statsBoth.state, 'available', 'L1-B: When all streams are finalized and healthy, state must be available');
      assert.equal(statsBoth.anomalies.clientUnfinalized, 0, 'L1-B: Anomaly clientUnfinalized must be 0');
      assert.equal(statsBoth.anomalies.clientTrailingUnsentCount, 0, 'L1-B: Anomaly clientTrailingUnsentCount must be 0');

      // 5. Generational isolation: Conn-A generation 1 is finalized, but Conn-A generation 2 sends records without stop
      clientTrace411.appendBatch([
        { runId: 'run-multi-stream', connectionId: 'conn-A', generation: 2, sequence: 3, event: 'client-draw-end', atMonoMs: 200, success: true, clockDomain: 'client-mono' },
      ], 'run-multi-stream');
      clientTrace411.updateClientStream('conn-A', 2, { isStop: false, trailingUnsentCount: 0 });

      const snapGen2 = clientTrace411.snapshot();
      assert.equal(snapGen2.clientFinalized, false, 'L1-B: Old generation 1 confirmation must NOT certify new generation 2');
      const alignedGen2 = alignCadenceTrace({ clientTrace: snapGen2 });
      const statsGen2 = analyzeCadenceTimeline(alignedGen2);
      assert.equal(statsGen2.state, 'degraded', 'L1-B: Unfinalized new generation 2 must degrade state');
      assert.equal(statsGen2.anomalies.clientUnfinalized, 1, 'L1-B: Anomaly clientUnfinalized must be 1 for unfinalized generation 2');

      console.log('  [PASS] L1-B verified: multi-stream finalization & unsent isolation, all-stream positive completion, and generational non-certification.');
    }

    // 4.12 G4 Verification: Envelope generation & counter schema validation and record-to-envelope consistency
    {
      await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
      clientTrace.clear();
      clientTrace.runId = 'session-run-1';
      clientTrace.registerConnection('conn-session-1');

      const makeEvent = (seq, gen = 1) => ({
        runId: 'session-run-1',
        connectionId: 'conn-session-1',
        generation: gen,
        sequence: seq,
        clockDomain: 'client-mono',
        event: 'client-draw-end',
        atMonoMs: 1000 + seq * 33,
        durationMs: 1,
        success: true,
      });
      const makeEnvelope = (records = [], extra = {}) => ({
        runId: 'session-run-1',
        connectionId: 'conn-session-1',
        generation: 1,
        clockDomain: 'client-mono',
        records,
        isStop: false,
        trailingUnsentCount: 0,
        overflowCount: 0,
        droppedCount: 0,
        ...extra,
      });

      const missingGen = makeEnvelope([], { isStop: true });
      delete missingGen.generation;
      const resMissingGen = await callRoute('POST', '/whale-wallpaper/cadence-trace', missingGen);
      assert.equal(resMissingGen.status, 400, 'G4: Empty stop batch missing generation must return 400');

      const resNegGen = await callRoute('POST', '/whale-wallpaper/cadence-trace', makeEnvelope([], { isStop: true, generation: -2 }));
      assert.equal(resNegGen.status, 400, 'G4: Negative generation must return 400');

      const resBadCounters = await callRoute('POST', '/whale-wallpaper/cadence-trace', makeEnvelope([makeEvent(1, 1)], { overflowCount: -1, droppedCount: 'bad', trailingUnsentCount: -3 }));
      assert.equal(resBadCounters.status, 400, 'G4: Invalid counter types / negative counters must return 400');

      const resMismatchGen = await callRoute('POST', '/whale-wallpaper/cadence-trace', makeEnvelope([makeEvent(2, 1)], { generation: 2, isStop: true }));
      assert.equal(resMismatchGen.status, 400, 'G4: Record generation mismatching top-level envelope generation must return 400');

      const snapG4 = clientTrace.snapshot();
      assert.ok(snapG4.schemaViolationCount >= 4, 'G4: Schema violation count must be incremented for rejected envelopes');
      assert.equal(Object.keys(snapG4.clientStreams).length, 0, 'G4: Rejected envelopes must not create bogus streams');

      await callRoute('POST', '/whale-wallpaper/stop');
      console.log('  [PASS] G4 verified: envelope generation/counter schema violations and record-to-envelope mismatches rejected with 400.');
    }

    // 4.13 G5 / L1-B-cap Verification: 32-stream bounded capacity preserves unfinalized & trailing unsent evidence
    {
      // Sub-test 1: 33 connections (c0..c32), c0 unfinalized with trailingUnsentCount=3, c1..c32 finalized
      {
        const col = new CadenceTraceCollector({ enabled: true, runId: 'r-cap1', clockDomain: 'client-mono' });
        for (let i = 0; i <= 32; i++) col.registerConnection(`c${i}`);

        col.appendBatch([{ runId: 'r-cap1', connectionId: 'c0', generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000, durationMs: 1, success: true }], 'r-cap1');
        col.updateClientStream('c0', 1, { isStop: false, trailingUnsentCount: 3 });

        for (let i = 1; i <= 32; i++) {
          col.appendBatch([{ runId: 'r-cap1', connectionId: `c${i}`, generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000 + i, durationMs: 1, success: true }], 'r-cap1');
          col.updateClientStream(`c${i}`, 1, { isStop: true, trailingUnsentCount: 0 });
        }

        const snap = col.snapshot();
        const stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: snap }));
        assert.equal(Object.keys(snap.clientStreams).length, 32, 'L1-B-cap: clientStreams map must remain bounded at 32');
        assert.equal(snap.clientFinalized, false, 'L1-B-cap: Unfinalized stream c0 must not be forgotten at 33rd stream');
        assert.equal(snap.clientTrailingUnsentCount, 3, 'L1-B-cap: Trailing unsent 3 from c0 must be preserved');
        assert.equal(stats.state, 'degraded', 'L1-B-cap: Analyzer state must remain degraded');
        assert.equal(stats.anomalies.clientUnfinalized, 1);
      }

      // Sub-test 2: Single connection across 33 generations (g=1..33), g=1 unfinalized with trailing=3 and trailing=0
      for (const earlyTrailing of [3, 0]) {
        const col = new CadenceTraceCollector({ enabled: true, runId: 'r-cap-gen', clockDomain: 'client-mono' });
        col.registerConnection('c');
        for (let g = 1; g <= 33; g++) {
          col.appendBatch([{ runId: 'r-cap-gen', connectionId: 'c', generation: g, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000 + g * 10, durationMs: 1, success: true }], 'r-cap-gen');
          col.updateClientStream('c', g, { isStop: g > 1, trailingUnsentCount: g === 1 ? earlyTrailing : 0 });
        }
        const snap = col.snapshot();
        const stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: snap }));
        assert.equal(Object.keys(snap.clientStreams).length, 32, 'L1-B-cap: clientStreams bounded at 32 across 33 generations');
        assert.equal(snap.clientFinalized, false, `L1-B-cap: Unconfirmed g=1 (trailing=${earlyTrailing}) must keep clientFinalized=false`);
        assert.equal(snap.clientTrailingUnsentCount, earlyTrailing);
        assert.equal(stats.state, 'degraded', `L1-B-cap: Unconfirmed g=1 (trailing=${earlyTrailing}) must keep state=degraded`);
        assert.equal(stats.anomalies.clientUnfinalized, 1);
      }

      // Sub-test 3: All 33 streams unfinalized when c32 arrives (forcing eviction of unfinalized c0), then c1..c32 finalize
      {
        const col = new CadenceTraceCollector({ enabled: true, runId: 'r-cap-all-unfin', clockDomain: 'client-mono' });
        for (let i = 0; i <= 32; i++) {
          col.registerConnection(`u${i}`);
          col.appendBatch([{ runId: 'r-cap-all-unfin', connectionId: `u${i}`, generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000 + i, durationMs: 1, success: true }], 'r-cap-all-unfin');
          col.updateClientStream(`u${i}`, 1, { isStop: false, trailingUnsentCount: i === 0 ? 4 : 0 });
        }
        for (let i = 1; i <= 32; i++) {
          col.updateClientStream(`u${i}`, 1, { isStop: true, trailingUnsentCount: 0 });
        }
        const snap = col.snapshot();
        const stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: snap }));
        assert.equal(snap.evictedUnfinalizedStreams, 1, 'L1-B-cap: Evicted unfinalized stream count must be 1');
        assert.equal(snap.clientFinalized, false, 'L1-B-cap: Evicted unfinalized stream must keep clientFinalized=false');
        assert.equal(snap.clientTrailingUnsentCount, 4, 'L1-B-cap: Evicted stream trailingUnsentCount=4 must be retained');
        assert.equal(stats.state, 'degraded');
      }

      // Sub-test 4: Healthy positive control — all 33 streams independently finalized and healthy
      {
        const col = new CadenceTraceCollector({ enabled: true, runId: 'r-cap-healthy', clockDomain: 'client-mono' });
        for (let i = 0; i <= 32; i++) {
          col.registerConnection(`h${i}`);
          col.appendBatch([
            { runId: 'r-cap-healthy', connectionId: `h${i}`, generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000, durationMs: 1, success: true },
            { runId: 'r-cap-healthy', connectionId: `h${i}`, generation: 1, sequence: 2, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1033, durationMs: 1, success: true },
          ], 'r-cap-healthy');
          col.updateClientStream(`h${i}`, 1, { isStop: true, trailingUnsentCount: 0 });
        }
        const snap = col.snapshot();
        const stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: snap }));
        assert.equal(Object.keys(snap.clientStreams).length, 32, 'L1-B-cap: Healthy 33 streams compacted to 32');
        assert.equal(snap.clientFinalized, true, 'L1-B-cap: All 33 finalized healthy streams must report clientFinalized=true');
        assert.equal(snap.clientTrailingUnsentCount, 0);
        assert.equal(stats.state, 'available', 'L1-B-cap: Healthy 33 streams must analyze as available');
      }
      console.log('  [PASS] G5 / L1-B-cap verified: 32-stream capacity compacts completed streams first and retains evicted unfinalized/unsent summaries.');
    }
  }

  // =========================================================================
  // Section 5: Cadence Analyzer Pipeline Alignment & Statistics
  // =========================================================================
  console.log('--- Section 5: Cadence Analyzer Pipeline Alignment & Statistics ---');
  {
    // 5.1 End-to-end integration with real trace output from Session and Replay
    assert.ok(scenarioReplayData.steady, 'Steady replay data must be available from Section 3');
    const steadyClientTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'run-steady',
      records: scenarioReplayData.steady.traceRecords,
    };

    const steadyNativeRecords = [];
    const steadyHostRecords = [];
    for (let seq = 1; seq <= 15; seq++) {
      steadyNativeRecords.push(
        { runId: 'run-steady', sequence: seq, event: 'native-source', atMonoMs: 1000 + (seq - 1) * 33.3, wgcTimestampMs: 1000 + (seq - 1) * 33.3, clockDomain: 'native-mono' },
        { runId: 'run-steady', sequence: seq, event: 'native-pipe-write', atMonoMs: 1000 + (seq - 1) * 33.3 + 1, durationMs: 0.5, success: true, clockDomain: 'native-mono' }
      );
      steadyHostRecords.push(
        { runId: 'run-steady', sequence: seq, event: 'host-hub-received', atMonoMs: 1000 + (seq - 1) * 33.3 + 2, clockDomain: 'host-mono' },
        { runId: 'run-steady', sequence: seq, event: 'host-stream-write', connectionId: 'conn-steady', atMonoMs: 1000 + (seq - 1) * 33.3 + 3, durationMs: 0.2, backpressure: false, clockDomain: 'host-mono' }
      );
    }
    const steadyNativeTrace = { schemaVersion: 1, clockDomain: 'native-mono', runId: 'run-steady', records: steadyNativeRecords };
    const steadyHostTrace = { schemaVersion: 1, clockDomain: 'host-mono', runId: 'run-steady', records: steadyHostRecords };

    const steadyAligned = alignCadenceTrace({
      nativeTrace: steadyNativeTrace,
      hostTrace: steadyHostTrace,
      clientTrace: steadyClientTrace,
    });

    assert.ok(steadyAligned.length >= 10, 'Must align >=10 real frames from Steady replay');
    const steadyStats = analyzeCadenceTimeline(steadyAligned);
    assert.equal(steadyStats.state, 'available');
    assert.equal(steadyStats.unknown, false);
    assert.ok(steadyStats.clientDrawIntervals.count >= 9, 'Must compute client draw intervals');
    assert.ok(Math.abs(steadyStats.clientDrawIntervals.mean - 33.3) < 2.0, `Steady client draw mean interval should be ~33.3ms, got ${steadyStats.clientDrawIntervals.mean}`);
    assert.ok(steadyStats.cadenceProxyRatio.count >= 9, 'Must compute cadence proxy ratio across consecutive rendered frames');
    assert.ok(Math.abs(steadyStats.cadenceProxyRatio.mean - 1.0) < 0.2, `Steady cadence proxy ratio should be ~1.0, got ${steadyStats.cadenceProxyRatio.mean}`);
    console.log(`  [PASS] Real Steady replay trace aligned and analyzed: state=available, draws=${steadyStats.clientDrawIntervals.count}, meanInterval=${steadyStats.clientDrawIntervals.mean}ms, proxyRatio=${steadyStats.cadenceProxyRatio.mean}`);

    // Also verify real session exported JSON files
    const exportedHostJson = JSON.parse(await readFile(join(evidenceDir, 'stop-nonblocking-test', 'cadence-trace-host.json'), 'utf8'));
    const exportedClientJson = JSON.parse(await readFile(join(evidenceDir, 'stop-nonblocking-test', 'cadence-trace-client.json'), 'utf8'));
    const realSessionAligned = alignCadenceTrace({
      hostTrace: exportedHostJson,
      clientTrace: exportedClientJson,
    });
    const realSessionStats = analyzeCadenceTimeline(realSessionAligned);
    assert.equal(realSessionStats.state, 'available');
    console.log('  [PASS] Real session exported files aligned and analyzed.');

    // 5.2 R2 Counterexample Verification: Consecutive-only cadenceProxyRatio & gap suppression
    // 3 rendered frames: seq 1 (WGC=0, draw=0), seq 2 (missing WGC, draw=33), seq 3 (WGC=66, draw=66)
    // Intermediate seq 2 drawn without WGC must block false ratio across the gap!
    const gapTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'run-gap',
      records: [
        { runId: 'run-gap', connectionId: 'c', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
        { runId: 'run-gap', connectionId: 'c', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 33, success: true, clockDomain: 'client-mono' },
        { runId: 'run-gap', connectionId: 'c', generation: 1, sequence: 3, event: 'client-draw-end', atMonoMs: 66, success: true, clockDomain: 'client-mono' },
      ],
    };
    const gapNative = {
      schemaVersion: 1,
      clockDomain: 'native-mono',
      runId: 'run-gap',
      records: [
        { runId: 'run-gap', sequence: 1, event: 'native-source', atMonoMs: 0, wgcTimestampMs: 0, clockDomain: 'native-mono' },
        // Sequence 2 lacks WGC source record
        { runId: 'run-gap', sequence: 3, event: 'native-source', atMonoMs: 66, wgcTimestampMs: 66, clockDomain: 'native-mono' },
      ],
    };

    const gapAligned = alignCadenceTrace({ nativeTrace: gapNative, clientTrace: gapTrace });
    const gapStats = analyzeCadenceTimeline(gapAligned);
    assert.equal(gapStats.cadenceProxyRatio.count, 0, 'No cadence proxy ratio must be computed across frames with missing WGC');
    console.log('  [PASS] Counterexample 1 verified: intermediate frame missing WGC suppresses false proxy ratio.');

    // 5.3 R2 Counterexample Verification: Multi-run isolation (no negative intervals)
    const multiRunTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'run-1',
      records: [
        { runId: 'run-1', connectionId: 'c', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 100, success: true, clockDomain: 'client-mono' },
        { runId: 'run-1', connectionId: 'c', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 133, success: true, clockDomain: 'client-mono' },
        { runId: 'run-2', connectionId: 'c', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 10, success: true, clockDomain: 'client-mono' },
        { runId: 'run-2', connectionId: 'c', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 43, success: true, clockDomain: 'client-mono' },
      ],
    };
    const multiRunAligned = alignCadenceTrace({ clientTrace: multiRunTrace });
    const multiRunStats = analyzeCadenceTimeline(multiRunAligned);
    assert.equal(multiRunStats.anomalies.crossRunCount, 1, 'Must detect 1 extra run');
    assert.equal(multiRunStats.clientDrawIntervals.min, 33, 'Min interval must be positive 33ms, NOT cross-run negative');
    console.log('  [PASS] Counterexample 2 verified: multi-run isolated without negative intervals.');

    // 5.4 R2 Counterexample Verification: Multi-connection backpressure retention
    const multiConnHost = {
      schemaVersion: 1,
      clockDomain: 'host-mono',
      runId: 'run-conn',
      records: [
        { runId: 'run-conn', sequence: 1, event: 'host-stream-write', connectionId: 'c1', backpressure: true, atMonoMs: 10, clockDomain: 'host-mono' },
        { runId: 'run-conn', sequence: 1, event: 'host-stream-write', connectionId: 'c2', backpressure: false, atMonoMs: 11, clockDomain: 'host-mono' },
      ],
    };
    const multiConnAligned = alignCadenceTrace({ hostTrace: multiConnHost });
    const multiConnStats = analyzeCadenceTimeline(multiConnAligned);
    assert.equal(multiConnStats.anomalies.hostBackpressureCount, 1, 'Backpressure on any connection must be preserved, not overwritten');
    console.log('  [PASS] Counterexample 3 verified: multi-connection backpressure preserved.');

    // 5.5 F2 Counterexample: Foreign clock domain degrades state to 'degraded'
    const cmTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 33, success: true, clockDomain: 'foreign-clock' },
      ],
    };
    const cmStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: cmTrace }));
    assert.equal(cmStats.state, 'degraded', 'F2: foreign clock domain must degrade state to degraded');
    assert.equal(cmStats.anomalies.clockDomainMismatchCount, 1);
    console.log('  [PASS] F2 Counterexample 4 verified: foreign clock domain degrades state to degraded.');

    // 5.6 F2 Counterexample: Multi-connection client stream isolation prevents scalar overwrite
    const mcTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 1000, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'b', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 1033, success: true, clockDomain: 'client-mono' },
      ],
    };
    const mcStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: mcTrace }));
    assert.equal(mcStats.clientDrawIntervals.mean, 33, 'F2: stream intervals must be isolated per (connectionId, generation), yielding 33ms');
    console.log('  [PASS] F2 Counterexample 5 verified: multi-connection stream intervals computed per connection (33ms).');

    // 5.7 F2 Counterexample: Generation reset does not produce cross-generation negative min
    const grTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 1000, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 2, sequence: 2, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
      ],
    };
    const grStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: grTrace }));
    assert.ok(grStats.clientDrawIntervals.count === 0 || grStats.clientDrawIntervals.min >= 0, 'F2: generation reset must not produce negative interval');
    console.log('  [PASS] F2 Counterexample 6 verified: generation reset isolated without negative intervals.');

    // 5.8 F2 Counterexample: Duplicate events detected, degraded, and excluded from intervals
    const dupF2Trace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 100, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 33, success: true, clockDomain: 'client-mono' },
      ],
    };
    const dupF2Stats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: dupF2Trace }));
    assert.equal(dupF2Stats.state, 'degraded', 'F2: duplicate event must degrade state');
    assert.equal(dupF2Stats.anomalies.duplicateEventCount, 1);
    assert.equal(dupF2Stats.clientDrawIntervals.min, 33, 'Duplicate event must be excluded from interval calculation');
    console.log('  [PASS] F2 Counterexample 7 verified: duplicate events diagnosed and degraded, interval=33ms.');

    // 5.9 F2 Counterexample: Missing timestamp schema violation degrades state
    const missingTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 33, success: true, clockDomain: 'client-mono' },
      ],
    };
    const missingStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: missingTrace }));
    assert.equal(missingStats.state, 'degraded', 'F2: missing timestamp must degrade state');
    assert.equal(missingStats.anomalies.schemaViolationCount, 1);
    console.log('  [PASS] F2 Counterexample 8 verified: missing timestamp degrades state.');

    // 5.10 F2 Counterexample: Host-only trace returns state=unavailable, unknown=true
    const hostOnlyTrace = {
      schemaVersion: 1,
      clockDomain: 'host-mono',
      runId: 'r',
      records: [
        { runId: 'r', sequence: 1, event: 'host-hub-received', atMonoMs: 10, clockDomain: 'host-mono' },
      ],
    };
    const hostOnlyStats = analyzeCadenceTimeline(alignCadenceTrace({ hostTrace: hostOnlyTrace }));
    assert.equal(hostOnlyStats.state, 'unavailable', 'F2: host-only trace must be state=unavailable');
    assert.equal(hostOnlyStats.unknown, true, 'F2: host-only trace must have unknown=true');
    console.log('  [PASS] F2 Counterexample 9 verified: host-only trace yields unavailable & unknown=true.');

    // 5.11 F2 Counterexample: Sparse skipped draw proxy ratio correctly pairs adjacent drawn frames
    const sparseTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 0, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 3, event: 'client-draw-end', atMonoMs: 66, success: true, clockDomain: 'client-mono' },
      ],
    };
    const sparseNative = {
      schemaVersion: 1,
      clockDomain: 'native-mono',
      runId: 'r',
      records: [
        { runId: 'r', sequence: 1, event: 'native-source', atMonoMs: 0, wgcTimestampMs: 0, clockDomain: 'native-mono' },
        { runId: 'r', sequence: 3, event: 'native-source', atMonoMs: 66, wgcTimestampMs: 66, clockDomain: 'native-mono' },
      ],
    };
    const sparseStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: sparseTrace, nativeTrace: sparseNative }));
    assert.equal(sparseStats.cadenceProxyRatio.count, 1, 'F2: valid sparse skipped draws must be paired');
    assert.equal(sparseStats.cadenceProxyRatio.mean, 1.0, 'F2: ratio must be 1.0 (66ms / 66ms)');
    console.log('  [PASS] F2 Counterexample 10 verified: sparse skipped draw proxy ratio = 1.0 (count=1).');

    // 5.12 Data availability: empty trace returns unavailable / unknown
    const emptyStats = analyzeCadenceTimeline(alignCadenceTrace({}));
    assert.equal(emptyStats.state, 'unavailable');
    assert.equal(emptyStats.unknown, true);
    console.log('  [PASS] Empty trace correctly diagnosed as state=unavailable, unknown=true.');

    // 5.13 Data availability: overflow trace returns degraded
    const overflowTrace = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'run-of',
      overflowCount: 15,
      records: [{ runId: 'run-of', connectionId: 'a', generation: 1, sequence: 20, event: 'client-accept', atMonoMs: 200, clockDomain: 'client-mono' }],
    };
    const overflowStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: overflowTrace }));
    assert.equal(overflowStats.state, 'degraded');
    assert.equal(overflowStats.anomalies.overflowCount, 15);
    console.log('  [PASS] Overflow trace correctly diagnosed as state=degraded.');

    // 5.14 F2 Verification: Host writes & client accepts per-connection interval isolation
    // Connection A has seq 1/2 at 1000/1033ms; Connection B has seq 1 at 0ms.
    const mcIsoHost = {
      schemaVersion: 1,
      clockDomain: 'host-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', sequence: 1, event: 'host-stream-write', atMonoMs: 1000, clockDomain: 'host-mono' },
        { runId: 'r', connectionId: 'b', sequence: 1, event: 'host-stream-write', atMonoMs: 0, clockDomain: 'host-mono' },
        { runId: 'r', connectionId: 'a', sequence: 2, event: 'host-stream-write', atMonoMs: 1033, clockDomain: 'host-mono' },
      ],
    };
    const mcIsoClient = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-accept', atMonoMs: 1000, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'b', generation: 1, sequence: 1, event: 'client-accept', atMonoMs: 0, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-accept', atMonoMs: 1033, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 1010, success: true, clockDomain: 'client-mono' },
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 2, event: 'client-draw-end', atMonoMs: 1043, success: true, clockDomain: 'client-mono' },
      ],
    };
    const mcIsoStats = analyzeCadenceTimeline(alignCadenceTrace({ hostTrace: mcIsoHost, clientTrace: mcIsoClient }));
    assert.equal(mcIsoStats.hostWriteIntervals.mean, 33, 'Host write intervals must be isolated per connectionId (33ms, not 1033ms)');
    assert.equal(mcIsoStats.clientAcceptIntervals.mean, 33, 'Client accept intervals must be isolated per stream (33ms, not 1033ms)');
    console.log('  [PASS] F2 verified: Host write & client accept intervals strictly isolated per connection (33ms).');

    // 5.15 F2 Verification: Real collector health fields ingestion degrades state
    const healthSnapClient = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r',
      clientOverflowCount: 150,
      clientDroppedCount: 10,
      clientTrailingUnsentCount: 200,
      records: [
        { runId: 'r', connectionId: 'a', generation: 1, sequence: 1, event: 'client-draw-end', atMonoMs: 100, success: true, clockDomain: 'client-mono' },
      ],
    };
    const healthStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: healthSnapClient }));
    assert.equal(healthStats.state, 'degraded', 'Client overflow/drops/unsent must degrade state');
    assert.equal(healthStats.anomalies.overflowCount, 150, 'Must record 150 overflows');
    assert.equal(healthStats.anomalies.droppedBatchRecords, 10, 'Must record 10 dropped records');
    assert.equal(healthStats.anomalies.clientTrailingUnsentCount, 200, 'Must record 200 trailing unsent records');
    console.log('  [PASS] F2 verified: Real collector health fields degrade state and export anomaly counts.');

    // 5.16 L2 Verification: Multi-connection stage durations & schedule sources preserved across connections
    // Connection A: RAF, decode 10ms, draw 2ms; Connection B: timeout, decode 50ms, draw 8ms (same run, seq 1)
    const mcStagesClient = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r-stages',
      clientFinalized: true,
      records: [
        { runId: 'r-stages', connectionId: 'conn-a', generation: 1, sequence: 1, event: 'client-schedule-fire', scheduleSource: 'raf', atMonoMs: 10, clockDomain: 'client-mono' },
        { runId: 'r-stages', connectionId: 'conn-a', generation: 1, sequence: 1, event: 'client-decode-end', durationMs: 10, success: true, atMonoMs: 20, clockDomain: 'client-mono' },
        { runId: 'r-stages', connectionId: 'conn-a', generation: 1, sequence: 1, event: 'client-draw-end', durationMs: 2, success: true, atMonoMs: 25, clockDomain: 'client-mono' },

        { runId: 'r-stages', connectionId: 'conn-b', generation: 1, sequence: 1, event: 'client-schedule-fire', scheduleSource: 'timeout', atMonoMs: 12, clockDomain: 'client-mono' },
        { runId: 'r-stages', connectionId: 'conn-b', generation: 1, sequence: 1, event: 'client-decode-end', durationMs: 50, success: true, atMonoMs: 62, clockDomain: 'client-mono' },
        { runId: 'r-stages', connectionId: 'conn-b', generation: 1, sequence: 1, event: 'client-draw-end', durationMs: 8, success: true, atMonoMs: 70, clockDomain: 'client-mono' },
      ],
    };
    const mcStagesStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: mcStagesClient }));
    assert.equal(mcStagesStats.decodeDurations.count, 2, 'L2: decode durations must contain events from BOTH connections');
    assert.equal(mcStagesStats.decodeDurations.mean, 30, 'L2: decode mean must be (10+50)/2 = 30ms, not overwritten by connection B');
    assert.equal(mcStagesStats.drawDurations.count, 2, 'L2: draw durations must contain events from BOTH connections');
    assert.equal(mcStagesStats.drawDurations.mean, 5, 'L2: draw mean must be (2+8)/2 = 5ms, not overwritten by connection B');
    assert.equal(mcStagesStats.anomalies.rafScheduleCount, 1, 'L2: RAF schedule count must be 1 (connection A)');
    assert.equal(mcStagesStats.anomalies.timeoutScheduleCount, 1, 'L2: Timeout schedule count must be 1 (connection B)');
    console.log('  [PASS] L2 verified: multi-connection stage durations & schedule sources preserved across all connections.');

    // 5.17 L2 Verification: Decode failure on one connection is NOT masked by success on another
    const mcFailClient = {
      schemaVersion: 1,
      clockDomain: 'client-mono',
      runId: 'r-fail',
      clientFinalized: true,
      records: [
        { runId: 'r-fail', connectionId: 'conn-a', generation: 1, sequence: 1, event: 'client-decode-end', durationMs: 10, success: false, atMonoMs: 20, clockDomain: 'client-mono' },
        { runId: 'r-fail', connectionId: 'conn-b', generation: 1, sequence: 1, event: 'client-decode-end', durationMs: 20, success: true, atMonoMs: 30, clockDomain: 'client-mono' },
        { runId: 'r-fail', connectionId: 'conn-b', generation: 1, sequence: 1, event: 'client-draw-end', durationMs: 4, success: true, atMonoMs: 35, clockDomain: 'client-mono' },
      ],
    };
    const mcFailStats = analyzeCadenceTimeline(alignCadenceTrace({ clientTrace: mcFailClient }));
    assert.equal(mcFailStats.anomalies.decodeFailCount, 1, 'L2: Connection A decode failure must NOT be masked by Connection B success');
    assert.equal(mcFailStats.state, 'degraded', 'L2: Decode failure must degrade analyzer state');
    console.log('  [PASS] L2 verified: decode failure on one connection is preserved and degrades state, not masked by another connection.');

    // 5.18 G7 & G7-skip Verification: Host per-connection and same-connection skip/backpressure events preserved without overwrite or false dedup
    {
      const g7HealthyClient = {
        schemaVersion: 1,
        clockDomain: 'client-mono',
        runId: 'r-g7',
        clientFinalized: true,
        records: [
          { runId: 'r-g7', connectionId: 'a', generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000, durationMs: 1, success: true },
          { runId: 'r-g7', connectionId: 'a', generation: 1, sequence: 2, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1033, durationMs: 1, success: true },
        ],
      };
      const g7HostTrace = {
        schemaVersion: 1,
        runId: 'r-g7',
        clockDomain: 'host-mono',
        records: [
          { runId: 'r-g7', sequence: 2, clockDomain: 'host-mono', event: 'host-stream-skip', connectionId: 'a', atMonoMs: 1000, reason: 'latest-overwritten', skippedCount: 5 },
          { runId: 'r-g7', sequence: 2, clockDomain: 'host-mono', event: 'host-stream-skip', connectionId: 'b', atMonoMs: 1001, reason: 'duplicate-sequence' },
          { runId: 'r-g7', sequence: 2, clockDomain: 'host-mono', event: 'host-stream-write', connectionId: 'a', atMonoMs: 1002, backpressure: true },
          { runId: 'r-g7', sequence: 2, clockDomain: 'host-mono', event: 'host-stream-write', connectionId: 'b', atMonoMs: 1003, backpressure: true },
        ],
      };
      const g7Aligned = alignCadenceTrace({ hostTrace: g7HostTrace, clientTrace: g7HealthyClient });
      const g7Stats = analyzeCadenceTimeline(g7Aligned);
      assert.equal(g7Stats.anomalies.hostLatestSkipCount, 1, 'G7: Connection A latest-overwritten must not be overwritten by Connection B duplicate-sequence');
      assert.equal(g7Stats.anomalies.hostSkippedFrameCount, 5, 'G7: Connection A skippedCount=5 must be preserved');
      assert.equal(g7Stats.anomalies.hostDuplicateSkipCount, 1, 'G7: Connection B duplicate-sequence must be counted');
      assert.equal(g7Stats.anomalies.hostBackpressureCount, 2, 'G7: Both connections backpressure write events must be counted');
      assert.ok(g7Aligned.flatMap(f => f.hostStreamWrites).every(w => typeof w.sequence === 'number'), 'G7: Every hostStreamWrites item must preserve numeric sequence');

      // G7-skip Positive: Real FrameDecoder -> FrameHub -> streamFrames same-connection backpressure + two drains
      // First drain writes seq 5 after skipping seq 2..4 (latest-overwritten, skippedCount=3) and returns false (still backpressured);
      // second drain with no new frame hits latest.sequence === lastSequence (5) and records duplicate-sequence on the same (runId, connectionId, sequence=5).
      let g7Mono = 1000;
      const g7HostCollector = new CadenceTraceCollector({
        enabled: true,
        clockDomain: 'host-mono',
        runId: 'run-g7-same-conn',
        now: () => {
          g7Mono += 10;
          return g7Mono;
        },
      });
      const g7Hub = new FrameHub({ cadenceTrace: g7HostCollector, runId: 'run-g7-same-conn' });
      const g7Res = new EventEmitter();
      const g7Writes = [];
      g7Res.writeHead = () => {};
      g7Res.flushHeaders = () => {};
      g7Res.end = () => {};
      g7Res.write = (chunk) => {
        g7Writes.push(chunk);
        return false; // Simulate continuous backpressure across both writes
      };

      const g7ConnId = 'conn-same-skip';
      const endG7Stream = streamFrames(g7Hub, g7Res, { cadenceTrace: g7HostCollector, runId: 'run-g7-same-conn', connId: g7ConnId });
      for (let seq = 1; seq <= 5; seq++) {
        g7Hub.push(createWhl1Packet(seq, 64, 36, seq * 33));
      }
      g7Res.emit('drain'); // Writes seq 5, records latest-overwritten (2 -> 4, skippedCount=3), returns false so waitingForDrain stays true
      g7Res.emit('drain'); // No new frame since seq 5: records duplicate-sequence on seq 5
      endG7Stream();

      const g7SameConnSnap = g7HostCollector.snapshot();
      const g7SameConnSkips = g7SameConnSnap.records.filter((r) => r.event === 'host-stream-skip');
      assert.equal(g7SameConnSkips.length, 2, 'G7-skip: Host collector must emit 2 distinct host-stream-skip records on the same connection');
      const g7SameConnClient = {
        schemaVersion: 1,
        clockDomain: 'client-mono',
        runId: 'run-g7-same-conn',
        clientFinalized: true,
        records: [
          { runId: 'run-g7-same-conn', connectionId: g7ConnId, generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1100, durationMs: 2, success: true },
          { runId: 'run-g7-same-conn', connectionId: g7ConnId, generation: 1, sequence: 5, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1133, durationMs: 2, success: true },
        ],
      };
      const g7SameConnAligned = alignCadenceTrace({ hostTrace: g7SameConnSnap, clientTrace: g7SameConnClient });
      const g7SameConnStats = analyzeCadenceTimeline(g7SameConnAligned);
      assert.equal(g7SameConnStats.anomalies.hostLatestSkipCount, 1, 'G7-skip: Same-connection latest-overwritten skip must be counted');
      assert.equal(g7SameConnStats.anomalies.hostSkippedFrameCount, 3, 'G7-skip: Same-connection skippedCount=3 (seq 2..4) must be preserved');
      assert.equal(g7SameConnStats.anomalies.hostDuplicateSkipCount, 1, 'G7-skip: Same-connection duplicate-sequence skip on seq 5 must not be deduped against latest-overwritten');
      assert.equal(g7SameConnStats.anomalies.duplicateEventCount, 0, 'G7-skip: Legitimate latest-overwritten + duplicate-sequence on same connection/sequence must have duplicateEventCount=0');
      assert.equal(g7SameConnStats.state, 'available', 'G7-skip: Legitimate same-connection skips must keep analyzer state available');

      // G7-skip Negative (Counterexample): True duplicate skip record with identical reason/range MUST still be flagged and degrade state
      const g7TrueDupHost = {
        ...g7SameConnSnap,
        records: [
          ...g7SameConnSnap.records,
          { ...g7SameConnSkips[1] }, // Duplicate 'duplicate-sequence' record on same (runId, connectionId, sequence)
        ],
      };
      const g7TrueDupStats = analyzeCadenceTimeline(alignCadenceTrace({ hostTrace: g7TrueDupHost, clientTrace: g7SameConnClient }));
      assert.equal(g7TrueDupStats.anomalies.duplicateEventCount, 1, 'G7-skip counterexample: True duplicate host-stream-skip record must increment duplicateEventCount');
      assert.equal(g7TrueDupStats.state, 'degraded', 'G7-skip counterexample: True duplicate host-stream-skip record must degrade analyzer state');

      console.log('  [PASS] G7 & G7-skip verified: Multi-connection and same-connection Host skip/backpressure events preserved; true duplicate skip still degrades.');
    }

    // 5.19 G8 & G9 Verification: Native/Host record validation, foreign clock domain exclusion, and native flushFailed semantics
    {
      const g8HealthyClient = {
        schemaVersion: 1,
        clockDomain: 'client-mono',
        runId: 'r-g8',
        clientFinalized: true,
        records: [
          { runId: 'r-g8', connectionId: 'c', generation: 1, sequence: 1, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1000, durationMs: 1, success: true },
          { runId: 'r-g8', connectionId: 'c', generation: 1, sequence: 2, clockDomain: 'client-mono', event: 'client-draw-end', atMonoMs: 1033, durationMs: 1, success: true },
        ],
      };

      // Negative native atMonoMs rejected and degrades state
      const negNative = {
        schemaVersion: 1,
        runId: 'r-g8',
        clockDomain: 'native-mono',
        records: [
          { runId: 'r-g8', sequence: 1, clockDomain: 'native-mono', event: 'native-pipe-write', atMonoMs: 10 },
          { runId: 'r-g8', sequence: 2, clockDomain: 'native-mono', event: 'native-pipe-write', atMonoMs: -5 },
        ],
      };
      const negNativeStats = analyzeCadenceTimeline(alignCadenceTrace({ nativeTrace: negNative, clientTrace: g8HealthyClient }));
      assert.equal(negNativeStats.state, 'degraded', 'G8: Negative native atMonoMs must degrade state');
      assert.equal(negNativeStats.metadata.schemaViolationCount, 1, 'G8: Negative native atMonoMs must increment schemaViolationCount');
      assert.equal(negNativeStats.nativeWriteIntervals.count, 0, 'G8: Invalid native record must not enter nativeWriteIntervals');

      // Foreign clockDomain in hostTrace excluded from hostReceivedIntervals
      const foreignHost = {
        schemaVersion: 1,
        runId: 'r-g8',
        clockDomain: 'host-mono',
        records: [
          { runId: 'r-g8', sequence: 1, event: 'host-hub-received', clockDomain: 'host-mono', atMonoMs: 1000 },
          { runId: 'r-g8', sequence: 2, event: 'host-hub-received', clockDomain: 'client-mono', atMonoMs: 2000 },
        ],
      };
      const foreignHostStats = analyzeCadenceTimeline(alignCadenceTrace({ hostTrace: foreignHost, clientTrace: g8HealthyClient }));
      assert.equal(foreignHostStats.state, 'degraded', 'G8: Foreign clockDomain in Host trace must degrade state');
      assert.equal(foreignHostStats.metadata.clockDomainMismatchCount, 1, 'G8: Foreign clockDomain must increment clockDomainMismatchCount');
      assert.equal(foreignHostStats.hostReceivedIntervals.count, 0, 'G8: Foreign clockDomain record must NOT enter hostReceivedIntervals');

      // G9: nativeTrace flushFailed=true degrades analyzer state; flushFailed=false stays available
      const flushFailedStats = analyzeCadenceTimeline(alignCadenceTrace({
        nativeTrace: { schemaVersion: 1, runId: 'r-g8', clockDomain: 'native-mono', flushFailed: true, records: [] },
        clientTrace: g8HealthyClient,
      }));
      assert.equal(flushFailedStats.state, 'degraded', 'G9: nativeTrace with flushFailed=true must degrade analyzer state');
      assert.equal(flushFailedStats.metadata.degraded, true, 'G9: metadata.degraded must be true when flushFailed=true');

      const flushOkStats = analyzeCadenceTimeline(alignCadenceTrace({
        nativeTrace: { schemaVersion: 1, runId: 'r-g8', clockDomain: 'native-mono', flushFailed: false, records: [] },
        clientTrace: g8HealthyClient,
      }));
      assert.equal(flushOkStats.state, 'available', 'G9: nativeTrace with flushFailed=false and healthy client trace must be available');
      console.log('  [PASS] G8 & G9 verified: native/Host schema & clockDomain filtering and flushFailed degradation semantics.');
    }
  }

  // =========================================================================
  // Section 6: Synthetic Fixture & Rate Masking Demonstration
  // =========================================================================
  console.log('--- Section 6: Synthetic Fixture & Rate Masking Demonstration ---');
  {
    const fixture = generateSyntheticFixtureComparison();
    assert.equal(fixture.label, 'synthetic');

    assert.equal(fixture.steady.mean, 33.333);
    assert.equal(fixture.burst.mean, 33.333);

    assert.equal(fixture.steady.p95, 34);
    assert.equal(fixture.burst.p95, 80);

    console.log(`  [PASS] Synthetic fixture demonstrates rate masking:`);
    console.log(`         Steady Mean=${fixture.steady.mean}ms, P95=${fixture.steady.p95}ms`);
    console.log(`         Burst  Mean=${fixture.burst.mean}ms, P95=${fixture.burst.p95}ms`);
  }

  // =========================================================================
  // Section 7: Resource Ceiling & Bounded Ring Buffer
  // =========================================================================
  console.log('--- Section 7: Resource Ceiling & Disabled Trace Safety ---');
  {
    // 7.1 Bounded ring buffer capacity (8192) & overflow
    const capCollector = new CadenceTraceCollector({ enabled: true, capacity: 8192, runId: 'cap-test' });
    assert.equal(capCollector.capacity, 8192);

    const smallCollector = new CadenceTraceCollector({ enabled: true, capacity: 50, runId: 'cap-small' });
    for (let i = 1; i <= 80; i++) {
      smallCollector.record({ sequence: i, event: 'test-event', atMonoMs: i * 10 });
    }
    const snap = smallCollector.snapshot();
    assert.equal(snap.retained, 50, 'Retained events must not exceed capacity (50)');
    assert.equal(snap.overflowCount, 30, 'OverflowCount must be exactly 30');
    assert.equal(snap.totalRecorded, 80, 'TotalRecorded must be 80');

    // 7.2 Disabled collector lazy allocation contract (events === null)
    const disabledCollector = new CadenceTraceCollector({ enabled: false, runId: 'disabled-test' });
    assert.equal(disabledCollector.events, null, 'Disabled collector must NOT allocate array');
    for (let i = 1; i <= 50; i++) {
      disabledCollector.record({ sequence: i, event: 'test-event', atMonoMs: i * 10 });
    }
    const disabledSnap = disabledCollector.snapshot();
    assert.equal(disabledSnap.enabled, false);
    assert.equal(disabledSnap.totalRecorded, 0);
    assert.equal(disabledSnap.retained, 0);
    assert.equal(disabledSnap.records.length, 0);

    console.log('  [PASS] Bounded ring buffer ceiling, 8192 capacity, and lazy disabled allocation verified.');
  }

  console.log('\n=============================================================');
  console.log('ALL 7 MOTION CADENCE VERIFICATION TESTS PASSED SUCCESSFULLY.');
  console.log('=============================================================\n');

} catch (err) {
  console.error('\n[FAIL] Motion Cadence Verification failed:', err);
  process.exit(1);
}
