// Synthetic regression and verification suite for playback performance tools.
//
// Tests watch-playback.mjs and analyze-playback.mjs across all 6 mandatory categories:
// 1. Two-segment foreground normal flow, delta-based rate calculations, and CLI execution.
// 2. Hidden client, stale client, missing client guards; true 0 increment vs duplicate reports.
// 3. Sparse sequence numbers (e.g. 1 -> 2 -> 30) strictly calculating adjacent pairs only without false long gaps.
// 4. Session identity restart, dimension change comparability gates, and Wallpaper Engine source foreground semantics.
// 5. Timing hierarchy (encodeMs includes readback & jpeg, no double-counting) and cumulative latency truthfulness.
// 6. Robustness against malformed JSONL lines, schema rejections (exit code 3), pre-existing output directories, and STOP sentinel.
//
// Usage:
//   node qa/perf/check-playback.mjs

import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ANALYZE_SCRIPT = join(SCRIPT_DIR, 'analyze-playback.mjs');
const WATCH_SCRIPT = join(SCRIPT_DIR, 'watch-playback.mjs');

import {
  computeStats,
  computeAdjacentIntervals,
  analyzeSegment,
  compareSegments,
  analyzePlayback,
  BadInput,
} from './analyze-playback.mjs';

import { parseFramesJsonl, watchPlayback } from './watch-playback.mjs';

const TEST_ROOT = process.env.WM_PERF_TEST_ROOT || resolve(
  'F:/dsh-wallpaper-plugins/.tmp',
  `playback-perf-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

async function pathExists(path) {
  try {
    await stat(resolve(path));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolvePromise) => {
    const proc = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('close', code => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Test 1: Two-segment foreground normal flow with interval deltas & CLI execution
// ---------------------------------------------------------------------------------------------
async function testCategory1NormalTwoSegmentFlow(root) {
  console.log('--- Test 1: Normal two-segment flow & CLI execution ---');
  const caseDir = join(root, 'case1-normal');
  await mkdir(caseDir, { recursive: true });

  const syntheticObservation = {
    schemaVersion: 1,
    tool: 'watch-playback',
    state: 'synthetic',
    createdAt: '2026-10-14T06:00:00.000Z',
    runDir: 'C:\\test\\run-1',
    session: { childPid: 5001, location: 'we-loc-1', stable: true },
    samples: [
      // Segment 1 (idle): elapsed 0 to 10s
      {
        sampleIndex: 0,
        elapsedMs: 0,
        utc: '2026-10-14T06:00:00.000Z',
        readDurationMs: 2,
        status: {
          readOk: true,
          data: {
            frames: 100,
            seconds: 10.0,
            width: 1302,
            height: 776,
            acquireMs: 2.0,
            readbackMs: 60.0,
            jpegMs: 20.0,
            packHashMs: 0.5,
            pipeMs: 1.0,
            encodeMs: 82.0,
            sourceAgeMs: 5.0,
            foreground: true,
          },
        },
        previewStatus: {
          readOk: true,
          data: {
            received: 100,
            seconds: 10.0,
            client: { received: 100, rendered: 95, seconds: 10.0, hidden: 0, meanLatencyMs: 15.0, maxLatencyMs: 30.0 },
          },
        },
      },
      {
        sampleIndex: 1,
        elapsedMs: 10000,
        utc: '2026-10-14T06:00:10.000Z',
        readDurationMs: 2,
        status: {
          readOk: true,
          data: {
            frames: 250,
            seconds: 20.0,
            width: 1302,
            height: 776,
            acquireMs: 2.0,
            readbackMs: 62.0,
            jpegMs: 21.0,
            packHashMs: 0.5,
            pipeMs: 1.0,
            encodeMs: 85.0,
            sourceAgeMs: 5.0,
            foreground: true,
          },
        },
        previewStatus: {
          readOk: true,
          data: {
            received: 250,
            seconds: 20.0,
            client: { received: 250, rendered: 245, seconds: 20.0, hidden: 0, meanLatencyMs: 16.0, maxLatencyMs: 35.0 },
          },
        },
      },
      // Segment 2 (mouse): elapsed 20 to 30s
      {
        sampleIndex: 2,
        elapsedMs: 20000,
        utc: '2026-10-14T06:00:20.000Z',
        readDurationMs: 2,
        status: {
          readOk: true,
          data: {
            frames: 400,
            seconds: 30.0,
            width: 1302,
            height: 776,
            acquireMs: 2.5,
            readbackMs: 68.0,
            jpegMs: 22.0,
            packHashMs: 0.6,
            pipeMs: 1.2,
            encodeMs: 92.0,
            sourceAgeMs: 5.5,
            foreground: true,
          },
        },
        previewStatus: {
          readOk: true,
          data: {
            received: 400,
            seconds: 30.0,
            client: { received: 400, rendered: 395, seconds: 30.0, hidden: 0, meanLatencyMs: 18.0, maxLatencyMs: 40.0 },
          },
        },
      },
      {
        sampleIndex: 3,
        elapsedMs: 30000,
        utc: '2026-10-14T06:00:30.000Z',
        readDurationMs: 2,
        status: {
          readOk: true,
          data: {
            frames: 500,
            seconds: 40.0,
            width: 1302,
            height: 776,
            acquireMs: 2.5,
            readbackMs: 70.0,
            jpegMs: 23.0,
            packHashMs: 0.6,
            pipeMs: 1.2,
            encodeMs: 95.0,
            sourceAgeMs: 5.5,
            foreground: true,
          },
        },
        previewStatus: {
          readOk: true,
          data: {
            received: 500,
            seconds: 40.0,
            client: { received: 500, rendered: 495, seconds: 40.0, hidden: 0, meanLatencyMs: 19.0, maxLatencyMs: 42.0 },
          },
        },
      },
    ],
    framesSnapshot: {
      records: [
        { frames: 100, seconds: 10.0 },
        { frames: 101, seconds: 10.066 },
        { frames: 400, seconds: 30.0 },
        { frames: 401, seconds: 30.100 },
      ],
    },
  };

  const syntheticSegments = {
    schemaVersion: 1,
    state: 'synthetic',
    userNamedScene: 'Three-Body problem - Test',
    segments: [
      {
        id: 'idle',
        label: '前台静止',
        startElapsedMs: 0,
        endElapsedMs: 10000,
        conditions: { userManualDshForeground: true, userManualMouseAction: 'none' },
      },
      {
        id: 'mouse',
        label: '前台鼠标移动',
        startElapsedMs: 20000,
        endElapsedMs: 30000,
        conditions: { userManualDshForeground: true, userManualMouseAction: 'moving' },
      },
    ],
  };

  const obsPath = join(caseDir, 'observation.json');
  const segPath = join(caseDir, 'segments.json');
  const outDir = join(caseDir, 'output');

  await writeFile(obsPath, JSON.stringify(syntheticObservation, null, 2));
  await writeFile(segPath, JSON.stringify(syntheticSegments, null, 2));

  // Run CLI: node analyze-playback.mjs
  const res = await runCommand('node', [ANALYZE_SCRIPT, '--input', obsPath, '--segments', segPath, '--output', outDir]);

  assert.equal(res.code, 0, `CLI failed with code ${res.code}: ${res.stderr}`);
  assert.ok(await pathExists(join(outDir, 'analysis.json')));
  assert.ok(await pathExists(join(outDir, 'analysis.md')));

  const analysis = JSON.parse(await readFile(join(outDir, 'analysis.json'), 'utf8'));
  assert.equal(analysis.status.reportWritten, true);
  assert.equal(analysis.status.dataReady, true);
  assert.equal(analysis.segments.length, 2);

  // Segment 1 (idle): (250 - 100) / (20 - 10) = 15.0 fps
  const seg1 = analysis.segments[0];
  assert.equal(seg1.nativeThroughput.deliveryRateFps, 15.0);
  assert.equal(seg1.hostThroughput.receivedRateFps, 15.0);
  assert.equal(seg1.clientThroughput.renderRateFps, 15.0); // (245 - 95) / 10 = 15.0

  // Segment 2 (mouse): (500 - 400) / (40 - 30) = 10.0 fps
  const seg2 = analysis.segments[1];
  assert.equal(seg2.nativeThroughput.deliveryRateFps, 10.0);
  assert.equal(seg2.hostThroughput.receivedRateFps, 10.0);
  assert.equal(seg2.clientThroughput.renderRateFps, 10.0); // (495 - 395) / 10 = 10.0

  // Comparison diff: seg2 - seg1 = 10.0 - 15.0 = -5.0 fps
  assert.equal(analysis.comparison.comparable, true);
  assert.equal(analysis.comparison.deltas.nativeDeliveryRateFps, -5.0);
  assert.equal(analysis.comparison.deltas.clientRenderRateFps, -5.0);
  assert.equal(analysis.comparison.deltas.encodeMeanMs, 10.0); // (95+92)/2=93.5 vs (82+85)/2=83.5 -> delta = +10.0

  console.log('✓ Test 1 passed: Normal two-segment flow verified with exact expected deltas.');
}

// ---------------------------------------------------------------------------------------------
// Test 2: Hidden client, stale client, missing client & true 0 increment vs duplicate
// ---------------------------------------------------------------------------------------------
async function testCategory2ClientGuardsAndZeroIncrement(root) {
  console.log('--- Test 2: Client hidden/stale guards & true 0 increment vs duplicate ---');
  const caseDir = join(root, 'case2-guards');
  await mkdir(caseDir, { recursive: true });

  // 2a: client.hidden === 1
  const segDefHidden = { id: 'segHidden', label: 'Hidden Test', startElapsedMs: 0, endElapsedMs: 5000 };
  const obsHidden = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 10, seconds: 1.0, width: 100, height: 100 } },
        previewStatus: {
          readOk: true,
          data: {
            received: 10,
            seconds: 1.0,
            client: { received: 10, rendered: 10, seconds: 1.0, hidden: 1 },
          },
        },
      },
      {
        sampleIndex: 1,
        elapsedMs: 5000,
        status: { readOk: true, data: { frames: 50, seconds: 5.0, width: 100, height: 100 } },
        previewStatus: {
          readOk: true,
          data: {
            received: 50,
            seconds: 5.0,
            client: { received: 50, rendered: 20, seconds: 5.0, hidden: 1 }, // background dropped frames
          },
        },
      },
    ],
  };

  const analyzedHidden = analyzeSegment(segDefHidden, obsHidden);
  assert.equal(analyzedHidden.nativeThroughput.deliveryRateFps, 10.0); // (50 - 10) / (5 - 1) = 10.0
  assert.equal(analyzedHidden.clientThroughput.valid, false);
  assert.equal(analyzedHidden.clientThroughput.renderRateFps, null);
  assert.ok(analyzedHidden.clientThroughput.reason.includes('client_hidden'));

  // 2b: client stale (seconds did not advance)
  const obsStale = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 10, seconds: 1.0, width: 100, height: 100 } },
        previewStatus: {
          readOk: true,
          data: {
            received: 10,
            seconds: 1.0,
            client: { received: 10, rendered: 10, seconds: 1.0, hidden: 0 },
          },
        },
      },
      {
        sampleIndex: 1,
        elapsedMs: 5000,
        status: { readOk: true, data: { frames: 50, seconds: 5.0, width: 100, height: 100 } },
        previewStatus: {
          readOk: true,
          data: {
            received: 50,
            seconds: 5.0,
            client: { received: 10, rendered: 10, seconds: 1.0, hidden: 0 }, // client seconds stuck at 1.0
          },
        },
      },
    ],
  };
  const analyzedStale = analyzeSegment(segDefHidden, obsStale);
  assert.equal(analyzedStale.clientThroughput.valid, false);
  assert.equal(analyzedStale.clientThroughput.renderRateFps, null);
  assert.ok(analyzedStale.clientThroughput.reason.includes('client_stale'));

  // 2c: True zero increment (seconds advanced from 10.0 to 12.0, frames remained 100)
  const obsZero = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 100, seconds: 10.0, width: 100, height: 100 } },
        previewStatus: { readOk: true, data: { received: 100, seconds: 10.0 } },
      },
      {
        sampleIndex: 1,
        elapsedMs: 2000,
        status: { readOk: true, data: { frames: 100, seconds: 12.0, width: 100, height: 100 } },
        previewStatus: { readOk: true, data: { received: 100, seconds: 12.0 } },
      },
    ],
  };
  const analyzedZero = analyzeSegment(segDefHidden, obsZero);
  assert.equal(analyzedZero.nativeThroughput.deliveryRateFps, 0.0);
  assert.equal(analyzedZero.nativeThroughput.framesDelta, 0);
  assert.equal(analyzedZero.nativeThroughput.secondsDelta, 2.0);

  // 2d: Duplicate report (seconds and frames didn't advance, same content)
  const obsDuplicate = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 100, seconds: 10.0, width: 100, height: 100 } },
        previewStatus: { readOk: true, data: { received: 100, seconds: 10.0 } },
      },
      {
        sampleIndex: 1,
        elapsedMs: 1000,
        status: { readOk: true, duplicate: true, data: { frames: 100, seconds: 10.0, width: 100, height: 100 } },
        previewStatus: { readOk: true, duplicate: true, data: { received: 100, seconds: 10.0 } },
      },
    ],
  };
  const analyzedDup = analyzeSegment(segDefHidden, obsDuplicate);
  assert.equal(analyzedDup.nativeThroughput.deliveryRateFps, null); // seconds delta is 0, correctly not synthesizing 0 fps!

  console.log('✓ Test 2 passed: Hidden/stale guards and true zero vs duplicate distinguished correctly.');
}

// ---------------------------------------------------------------------------------------------
// Test 3: Sparse frame sequence 1 -> 2 -> 30 strictly calculates adjacent intervals only
// ---------------------------------------------------------------------------------------------
async function testCategory3SparseFrameSequences() {
  console.log('--- Test 3: Sparse frame sequences & adjacent intervals ---');

  const records = [
    { frames: 1, seconds: 1.000 },
    { frames: 2, seconds: 1.050 }, // Adjacent pair: (1, 2), gap = 50ms
    { frames: 30, seconds: 3.000 }, // Sparse skip: 30 != 2 + 1. MUST NOT be paired with 2!
    { frames: 31, seconds: 3.070 }, // Adjacent pair: (30, 31), gap = 70ms
  ];

  const intervals = computeAdjacentIntervals(records);
  assert.equal(intervals.adjacentPairs, 2, 'Should only count the 2 strictly adjacent pairs');
  assert.equal(intervals.intervalsMs.count, 2);
  assert.equal(intervals.intervalsMs.min, 50.0);
  assert.equal(intervals.intervalsMs.max, 70.0);
  assert.equal(intervals.intervalsMs.mean, 60.0);
  assert.equal(intervals.longGapsOver250ms, 0, 'Sparse jump (2 -> 30 = 1950ms) must NOT be counted as long gap');

  // Single frame or disjoint frames with no adjacent pairs
  const disjoint = [
    { frames: 10, seconds: 1.0 },
    { frames: 20, seconds: 2.0 },
  ];
  const disjointIntervals = computeAdjacentIntervals(disjoint);
  assert.equal(disjointIntervals.adjacentPairs, 0);
  assert.equal(disjointIntervals.intervalsMs, null);
  assert.equal(disjointIntervals.longGapsOver250ms, 0);

  console.log('✓ Test 3 passed: Strictly adjacent frame sequence intervals verified; no false long gaps.');
}

// ---------------------------------------------------------------------------------------------
// Test 4: Session identity, dimensions, and source foreground semantics
// ---------------------------------------------------------------------------------------------
async function testCategory4SessionDimensionAndForeground(root) {
  console.log('--- Test 4: Session identity, dimension gates & source foreground ---');

  // 4a: Session restart / unstable identity
  const segA = {
    id: 'segA',
    valid: true,
    sampleCount: 5,
    conditions: { observedWidth: 1302, observedHeight: 776 },
    nativeThroughput: { deliveryRateFps: 20.0 },
    hostThroughput: { receivedRateFps: 20.0 },
    clientThroughput: { valid: true, renderRateFps: 20.0 },
    reasons: [],
  };
  const segB = {
    id: 'segB',
    valid: true,
    sampleCount: 5,
    conditions: { observedWidth: 1302, observedHeight: 776 },
    nativeThroughput: { deliveryRateFps: 20.0 },
    hostThroughput: { receivedRateFps: 20.0 },
    clientThroughput: { valid: true, renderRateFps: 20.0 },
    reasons: [],
  };

  const obsUnstableSession = {
    session: { childPid: 1234, stable: false }, // identity changed
  };
  const compUnstable = compareSegments(segA, segB, obsUnstableSession);
  assert.equal(compUnstable.comparable, false);
  assert.equal(compUnstable.deltas, null);
  assert.ok(compUnstable.blockedReasons.some(r => r.includes('session_identity_changed')));

  // 4b: Dimension mismatch (e.g. 1302x776 vs 1920x1080)
  const segBMismatchedDim = {
    ...segB,
    conditions: { observedWidth: 1920, observedHeight: 1080 },
  };
  const compDimMismatch = compareSegments(segA, segBMismatchedDim, { session: { stable: true } });
  assert.equal(compDimMismatch.comparable, false);
  assert.equal(compDimMismatch.deltas, null);
  assert.ok(compDimMismatch.blockedReasons.some(r => r.includes('dimension_mismatch')));

  // 4c: Native foreground = false is Wallpaper Engine window state, not DSH foreground
  const segDefFg = { id: 'segFg', label: 'FG test', startElapsedMs: 0, endElapsedMs: 2000 };
  const obsFg = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 10, seconds: 1.0, width: 100, height: 100, foreground: false } },
        previewStatus: { readOk: true, data: { received: 10, seconds: 1.0, client: { received: 10, rendered: 10, seconds: 1.0, hidden: 0 } } },
      },
      {
        sampleIndex: 1,
        elapsedMs: 2000,
        status: { readOk: true, data: { frames: 30, seconds: 2.0, width: 100, height: 100, foreground: false } },
        previewStatus: { readOk: true, data: { received: 30, seconds: 2.0, client: { received: 30, rendered: 30, seconds: 2.0, hidden: 0 } } },
      },
    ],
  };
  const analyzedFg = analyzeSegment(segDefFg, obsFg);
  assert.equal(analyzedFg.conditions.observedNativeForeground, false);
  assert.equal(analyzedFg.clientThroughput.valid, true, 'client throughput should remain valid because DSH client.hidden is 0');
  assert.equal(analyzedFg.clientThroughput.renderRateFps, 20.0);

  console.log('✓ Test 4 passed: Comparability gates and native foreground semantics verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 5: Timing hierarchy and latency truthfulness
// ---------------------------------------------------------------------------------------------
async function testCategory5TimingHierarchyAndLatency() {
  console.log('--- Test 5: Timing hierarchy & latency truthfulness ---');

  const statsAcquire = computeStats([2.0, 2.5]);
  const statsReadback = computeStats([60.0, 64.0]);
  const statsJpeg = computeStats([20.0, 22.0]);
  const statsEncode = computeStats([82.0, 88.0]);

  assert.equal(statsEncode.mean, 85.0);
  assert.equal(statsReadback.mean, 62.0);
  assert.equal(statsJpeg.mean, 21.0);

  // Assert that encodeMs already contains readback and jpeg:
  // readback (62) + jpeg (21) = 83ms <= encode (85ms).
  // Total time must NEVER be calculated as encode + readback + jpeg (= 168ms).
  assert.ok(statsReadback.mean + statsJpeg.mean <= statsEncode.mean);

  // In analyzeSegment, verify hierarchyNotice is included
  const segDef = { id: 'segT', label: 'Timing', startElapsedMs: 0, endElapsedMs: 2000 };
  const obs = {
    schemaVersion: 1,
    samples: [
      {
        sampleIndex: 0,
        elapsedMs: 0,
        status: { readOk: true, data: { frames: 1, seconds: 1.0, acquireMs: 2, readbackMs: 60, jpegMs: 20, encodeMs: 82, width: 100, height: 100 } },
        previewStatus: { readOk: true, data: { received: 1, seconds: 1.0, client: { received: 1, rendered: 1, seconds: 1.0, hidden: 0, meanLatencyMs: 15.0, maxLatencyMs: 35.0 } } },
      },
      {
        sampleIndex: 1,
        elapsedMs: 2000,
        status: { readOk: true, data: { frames: 10, seconds: 2.0, acquireMs: 2, readbackMs: 64, jpegMs: 22, encodeMs: 88, width: 100, height: 100 } },
        previewStatus: { readOk: true, data: { received: 10, seconds: 2.0, client: { received: 10, rendered: 10, seconds: 2.0, hidden: 0, meanLatencyMs: 16.0, maxLatencyMs: 36.0 } } },
      },
    ],
  };
  const analyzed = analyzeSegment(segDef, obs);
  assert.ok(analyzed.timings.hierarchyNotice.includes('encodeMs 已包含 readbackMs 与 jpegMs'));
  assert.ok(analyzed.latencyReference.note.includes('客户端自启动以来的累计值'));
  assert.equal(analyzed.latencyReference.cumulativeMaxMs, 36.0);

  console.log('✓ Test 5 passed: Hierarchy notice and latency truthfulness verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 6: Incomplete JSONL, CLI error handling, existing output refuse, and STOP sentinel
// ---------------------------------------------------------------------------------------------
async function testCategory6RobustnessAndSentinel(root) {
  console.log('--- Test 6: Robustness, schema rejection, existing dir & STOP sentinel ---');
  const caseDir = join(root, 'case6-robustness');
  await mkdir(caseDir, { recursive: true });

  // 6a: Incomplete JSONL line parsing
  const malformedJsonl = `{"log":"bounded","policy":"dense-tail-plus-frame-sampling"}
{"frames":1,"seconds":0.033,"encodeMs":15}
{"frames":2,"seconds":0.066,"encodeMs":16
{"frames":3,"seconds":0.099,"encodeMs":15}
`;
  const parsed = parseFramesJsonl(malformedJsonl);
  assert.equal(parsed.records.length, 2); // frames 1 and 3
  assert.equal(parsed.incompleteLines, 1, 'Incomplete middle line must be caught without throwing');

  // 6b: CLI rejected input (broken JSON / schema) -> exit code 3, no report written
  const badSegPath = join(caseDir, 'bad-segments.json');
  await writeFile(badSegPath, '{ "schemaVersion": 999 }'); // invalid schema version
  const badOutDir = join(caseDir, 'bad-out');

  const resBad = await runCommand('node', [ANALYZE_SCRIPT, '--input', badSegPath, '--segments', badSegPath, '--output', badOutDir]);
  assert.equal(resBad.code, 3, `Expected code 3 on bad input, got ${resBad.code}`);
  assert.equal(await pathExists(badOutDir), false, 'No directory or report should be created on bad input');

  // 6c: Pre-existing output directory refused -> exit code 3
  const existingDir = join(caseDir, 'existing-dir');
  await mkdir(existingDir, { recursive: true });
  await writeFile(join(existingDir, 'sentinel.txt'), 'do not touch');

  const resExists = await runCommand('node', [ANALYZE_SCRIPT, '--input', badSegPath, '--segments', badSegPath, '--output', existingDir]);
  assert.equal(resExists.code, 3, `Expected code 3 on existing output dir, got ${resExists.code}`);
  assert.equal(await readFile(join(existingDir, 'sentinel.txt'), 'utf8'), 'do not touch', 'Existing file must be untouched');

  // 6d: watch-playback.mjs STOP sentinel handling
  const runDir = join(caseDir, 'mock-run');
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'status.json'), JSON.stringify({ frames: 100, seconds: 10.0, width: 1302, height: 776 }));
  await writeFile(join(runDir, 'preview-status.json'), JSON.stringify({ received: 100, seconds: 10.0, childPid: 9999 }));
  await writeFile(join(runDir, 'frames.jsonl'), '{"frames":100,"seconds":10.0}\n');

  const watchOutDir = join(caseDir, 'watch-out');

  // Launch watch-playback with 60s timeout in background
  const watchProc = spawn('node', [WATCH_SCRIPT, '--run-dir', runDir, '--output', watchOutDir, '--seconds', '60', '--interval-ms', '100', '--state', 'synthetic'], {
    stdio: 'ignore',
  });

  // Wait for watch-playback to initialize and create directory
  let created = false;
  for (let i = 0; i < 30; i += 1) {
    await new Promise(r => setTimeout(r, 100));
    if (await pathExists(watchOutDir)) {
      created = true;
      break;
    }
  }
  assert.ok(created, 'watch-playback should have created output dir');

  // Write STOP sentinel file inside output dir
  await writeFile(join(watchOutDir, 'STOP'), 'STOP_REQUESTED');

  // Wait for watchProc to exit
  const exitCode = await new Promise((res) => {
    watchProc.on('close', code => res(code));
  });

  assert.equal(exitCode, 0, `watch-playback should exit 0 on STOP sentinel, got ${exitCode}`);
  const obsData = JSON.parse(await readFile(join(watchOutDir, 'observation.json'), 'utf8'));
  assert.equal(obsData.summary.stopReason, 'sentinel');
  assert.equal(obsData.summary.partial, true);
  assert.ok(obsData.summary.sampleCount >= 1);

  console.log('✓ Test 6 passed: Robustness, schema rejection, existing dir guard, and STOP sentinel verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 7: Review R1-R4 Counterexample Regression Suite (12 cases)
// ---------------------------------------------------------------------------------------------
async function testReviewR1ToR4Cases(root) {
  console.log('--- Test 7: Review R1-R4 Counterexample Regression Suite (12 cases) ---');
  const reviewRoot = join(root, 'review-r1-r4');
  await mkdir(reviewRoot, { recursive: true });

  function makeFixture() {
    const runDir = 'C:/synthetic-playback/run-review';
    const samples = Array.from({ length: 6 }, (_, i) => ({
      sampleIndex: i,
      elapsedMs: i * 1000,
      utc: new Date(Date.UTC(2026, 9, 14, 6, 0, i)).toISOString(),
      readDurationMs: 1,
      status: {
        readOk: true,
        duplicate: false,
        mtime: `s${i}`,
        data: {
          frames: 100 + i * 10,
          seconds: 10 + i,
          width: 1280,
          height: 720,
          acquireMs: 0.1,
          readbackMs: 2,
          jpegMs: 2,
          packHashMs: 0.1,
          pipeMs: 0.1,
          encodeMs: 5,
          sourceAgeMs: 1,
          foreground: false,
        },
      },
      previewStatus: {
        readOk: true,
        duplicate: false,
        mtime: `p${i}`,
        data: {
          childPid: 5001,
          window: { location: 'synthetic-location', pid: 6001 },
          received: 100 + i * 10,
          seconds: 10 + i,
          running: true,
          failure: null,
          client: {
            received: 100 + i * 10,
            rendered: 100 + i * 10,
            dropped: 0,
            seconds: 10 + i,
            hidden: 0,
            meanLatencyMs: 5,
            maxLatencyMs: 8,
            decodeErrors: 0,
          },
        },
      },
    }));
    const observation = {
      schemaVersion: 1,
      tool: 'watch-playback',
      state: 'synthetic',
      runDir,
      session: { childPid: 5001, location: 'synthetic-location', stable: true },
      summary: { stopReason: 'completed', partial: false, identityStable: true },
      framesSnapshot: { records: [] },
      samples,
    };
    const conditions = {
      expectedWidth: 1280,
      expectedHeight: 720,
      userManualDshForeground: true,
      sceneId: 'synthetic-scene',
      captureLimitFps: 30,
      appearanceUnchanged: true,
    };
    const manifest = {
      schemaVersion: 1,
      userNamedScene: 'synthetic-review',
      segments: [
        {
          id: 'idle',
          startElapsedMs: 0,
          endElapsedMs: 2000,
          conditions: { ...conditions, userManualMouseAction: 'stationary' },
        },
        {
          id: 'mouse',
          startElapsedMs: 3000,
          endElapsedMs: 5000,
          conditions: { ...conditions, userManualMouseAction: 'moving' },
        },
      ],
    };
    return { observation, manifest };
  }

  async function executeCase(caseId, change) {
    const dir = join(reviewRoot, caseId);
    await mkdir(dir, { recursive: true });
    const { observation, manifest } = makeFixture();
    change?.(observation, manifest);

    await writeFile(join(dir, 'observation.json'), JSON.stringify(observation, null, 2), { flag: 'wx' });
    let manifestText = JSON.stringify(manifest, null, 2);
    if (caseId === 'nonfinite-segment-bound') {
      manifestText = manifestText.replace('"endElapsedMs": 2000', '"endElapsedMs": 1e309');
    }
    await writeFile(join(dir, 'segments.json'), manifestText, { flag: 'wx' });

    const outDir = join(dir, 'analysis');
    const res = await runCommand('node', [ANALYZE_SCRIPT, '--input', join(dir, 'observation.json'), '--segments', join(dir, 'segments.json'), '--output', outDir]);

    let analysis = null;
    try {
      analysis = JSON.parse(await readFile(join(outDir, 'analysis.json'), 'utf8'));
    } catch {}

    return {
      caseId,
      exitCode: res.code,
      dataReady: analysis?.status?.dataReady ?? null,
      comparable: analysis?.comparison?.comparable ?? null,
      client: analysis?.segments?.map(s => s.clientThroughput) ?? null,
      reasons: analysis?.status?.reasons ?? null,
      state: analysis?.state ?? null,
      stderr: res.stderr,
    };
  }

  // 1. baseline
  const cBaseline = await executeCase('baseline', null);
  assert.equal(cBaseline.exitCode, 0);
  assert.equal(cBaseline.dataReady, true);
  assert.equal(cBaseline.comparable, true);
  assert.equal(cBaseline.state, 'synthetic');

  // 2. hidden-background-readiness
  const cHidden = await executeCase('hidden-background-readiness', o => {
    for (const s of o.samples) s.previewStatus.data.client.hidden = 1;
  });
  assert.equal(cHidden.exitCode, 0);
  assert.equal(cHidden.dataReady, false);
  assert.equal(cHidden.comparable, false);
  assert.equal(cHidden.client[0].renderRateFps, null);

  // 3. missing-client-counts
  const cMissingCounts = await executeCase('missing-client-counts', o => {
    for (const s of o.samples) {
      s.previewStatus.data.client.rendered = null;
      s.previewStatus.data.client.received = null;
    }
  });
  assert.equal(cMissingCounts.exitCode, 0);
  assert.equal(cMissingCounts.dataReady, false);
  assert.equal(cMissingCounts.client[0].renderRateFps, null);
  assert.equal(cMissingCounts.client[0].receivedRateFps, null);

  // 4. interior-client-reset
  const cClientReset = await executeCase('interior-client-reset', o => {
    const c = o.samples[1].previewStatus.data.client;
    c.rendered = 1;
    c.received = 1;
    c.seconds = 1;
  });
  assert.equal(cClientReset.exitCode, 0);
  assert.equal(cClientReset.dataReady, false);
  assert.equal(cClientReset.client[0].renderRateFps, null);
  assert.ok(cClientReset.client[0].reason.includes('client_counter_reset'));

  // 5. interior-native-reset
  const cNativeReset = await executeCase('interior-native-reset', o => {
    o.samples[1].status.data.frames = 1;
    o.samples[1].status.data.seconds = 1;
  });
  assert.equal(cNativeReset.exitCode, 0);
  assert.equal(cNativeReset.dataReady, false);
  assert.equal(cNativeReset.comparable, false);
  assert.ok(cNativeReset.reasons.some(r => r.includes('native_counter_rollback')));

  // 6. interior-size-change
  const cSizeChange = await executeCase('interior-size-change', o => {
    o.samples[1].status.data.width = 1920;
    o.samples[1].status.data.height = 1080;
  });
  assert.equal(cSizeChange.exitCode, 0);
  assert.equal(cSizeChange.dataReady, false);
  assert.equal(cSizeChange.comparable, false);
  assert.ok(cSizeChange.reasons.some(r => r.includes('interior_size_change')));

  // 7. changed-manual-conditions
  const cChangedCond = await executeCase('changed-manual-conditions', (o, m) => {
    m.segments[1].conditions.userManualDshForeground = false;
    m.segments[1].conditions.captureLimitFps = 60;
  });
  assert.equal(cChangedCond.exitCode, 0);
  assert.equal(cChangedCond.dataReady, false);
  assert.equal(cChangedCond.comparable, false);
  assert.ok(cChangedCond.reasons.some(r => r.includes('fixed_condition_mismatch') || r.includes('user_manual_dsh_foreground_false')));

  // 8. missing-preview-reports
  const cMissingPreview = await executeCase('missing-preview-reports', o => {
    for (const s of o.samples) {
      s.previewStatus.readOk = false;
      s.previewStatus.data = null;
    }
  });
  assert.equal(cMissingPreview.exitCode, 0);
  assert.equal(cMissingPreview.dataReady, false);

  // 9. negative-observer-time
  const cNegativeTime = await executeCase('negative-observer-time', o => {
    o.samples[1].elapsedMs = -1;
  });
  assert.equal(cNegativeTime.exitCode, 3);

  // 10. conflicting-frame-records
  const cConflict = await executeCase('conflicting-frame-records', o => {
    const base = o.samples[0].status.data;
    o.framesSnapshot.records = [
      { ...base, frames: 101, seconds: 10.1 },
      { ...base, frames: 101, seconds: 10.9 },
      { ...base, frames: 102, seconds: 11.0 },
    ];
  });
  assert.equal(cConflict.exitCode, 3);

  // 11. nonfinite-segment-bound
  const cNonfinite = await executeCase('nonfinite-segment-bound', null);
  assert.equal(cNonfinite.exitCode, 3);

  // 12. watch-duration
  const watchCaseDir = join(reviewRoot, 'watch-duration');
  const mockRunDir = join(watchCaseDir, 'fake-run');
  await mkdir(mockRunDir, { recursive: true });
  const fakeSample = makeFixture().observation.samples[0];
  await writeFile(join(mockRunDir, 'status.json'), JSON.stringify(fakeSample.status.data, null, 2), { flag: 'wx' });
  await writeFile(join(mockRunDir, 'preview-status.json'), JSON.stringify(fakeSample.previewStatus.data, null, 2), { flag: 'wx' });
  await writeFile(join(mockRunDir, 'frames.jsonl'), '{}\n', { flag: 'wx' });

  const watchOutDir = join(watchCaseDir, 'output');
  const resWatch = await runCommand('node', [WATCH_SCRIPT, '--run-dir', mockRunDir, '--output', watchOutDir, '--seconds', '0.1', '--interval-ms', '2000', '--state', 'synthetic']);
  assert.equal(resWatch.code, 0);
  const watchObs = JSON.parse(await readFile(join(watchOutDir, 'observation.json'), 'utf8'));
  assert.ok(watchObs.summary.totalDurationMs < 300, `Expected totalDurationMs < 300ms, got ${watchObs.summary.totalDurationMs}ms`);
  assert.equal(watchObs.summary.stopReason, 'completed');

  console.log('✓ Test 7 passed: All 12 review R1-R4 counterexample cases verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 8: Second Review F1-F4 Counterexample Regression Suite (8 cases)
// ---------------------------------------------------------------------------------------------
async function testSecondReviewF1ToF4Cases(root) {
  console.log('--- Test 8: Second Review F1-F4 Counterexample Regression Suite (8 cases) ---');
  const reviewRoot = join(root, 'review-f1-f4');
  await mkdir(reviewRoot, { recursive: true });

  function makeFixture() {
    const runDir = 'C:/synthetic-playback/run-second-review';
    const samples = Array.from({ length: 6 }, (_, i) => ({
      sampleIndex: i,
      elapsedMs: i * 1000,
      utc: new Date(Date.UTC(2026, 9, 14, 6, 0, i)).toISOString(),
      readDurationMs: 1,
      status: {
        readOk: true,
        duplicate: false,
        mtime: `s${i}`,
        data: {
          frames: 100 + i * 10,
          seconds: 10 + i,
          width: 1280,
          height: 720,
          acquireMs: 0.1,
          readbackMs: 2,
          jpegMs: 2,
          packHashMs: 0.1,
          pipeMs: 0.1,
          encodeMs: 5,
          sourceAgeMs: 1,
          foreground: false,
        },
      },
      previewStatus: {
        readOk: true,
        duplicate: false,
        mtime: `p${i}`,
        data: {
          childPid: 5001,
          window: { location: 'synthetic-location', pid: 6001 },
          received: 100 + i * 10,
          seconds: 10 + i,
          running: true,
          failure: null,
          client: {
            received: 100 + i * 10,
            rendered: 100 + i * 10,
            dropped: 0,
            seconds: 10 + i,
            hidden: 0,
            meanLatencyMs: 5,
            maxLatencyMs: 8,
            decodeErrors: 0,
          },
        },
      },
    }));
    const observation = {
      schemaVersion: 1,
      tool: 'watch-playback',
      state: 'synthetic',
      runDir,
      session: { childPid: 5001, location: 'synthetic-location', stable: true },
      summary: { stopReason: 'completed', partial: false, identityStable: true },
      framesSnapshot: { records: [] },
      samples,
    };
    const conditions = {
      expectedWidth: 1280,
      expectedHeight: 720,
      userManualDshForeground: true,
      sceneId: 'synthetic-scene',
      captureLimitFps: 30,
      appearanceUnchanged: true,
    };
    const manifest = {
      schemaVersion: 1,
      userNamedScene: 'synthetic-review',
      segments: [
        {
          id: 'idle',
          startElapsedMs: 0,
          endElapsedMs: 2000,
          conditions: { ...conditions, userManualMouseAction: 'stationary' },
        },
        {
          id: 'mouse',
          startElapsedMs: 3000,
          endElapsedMs: 5000,
          conditions: { ...conditions, userManualMouseAction: 'moving' },
        },
      ],
    };
    return { observation, manifest };
  }

  async function executeCase(caseId, change) {
    const dir = join(reviewRoot, caseId);
    await mkdir(dir, { recursive: true });
    const { observation, manifest } = makeFixture();
    change?.(observation, manifest);

    let rawObs = JSON.stringify(observation, null, 2);
    if (caseId === 'nonfinite-client-count') {
      rawObs = rawObs.replaceAll('"__NONFINITE__"', '1e309');
    }
    await writeFile(join(dir, 'observation.json'), rawObs, { flag: 'wx' });
    await writeFile(join(dir, 'segments.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });

    const outDir = join(dir, 'analysis');
    const res = await runCommand('node', [ANALYZE_SCRIPT, '--input', join(dir, 'observation.json'), '--segments', join(dir, 'segments.json'), '--output', outDir]);

    let analysis = null;
    try {
      analysis = JSON.parse(await readFile(join(outDir, 'analysis.json'), 'utf8'));
    } catch {}

    return {
      exitCode: res.code,
      analysis,
      dataReady: analysis?.status?.dataReady ?? null,
      comparable: analysis?.comparison?.comparable ?? null,
      client: analysis?.segments?.map(s => s.clientThroughput) ?? null,
      nativeRates: analysis?.segments?.map(s => s.nativeThroughput?.deliveryRateFps ?? null) ?? null,
      frameIntervals: analysis?.segments?.map(s => s.frameIntervals) ?? null,
      reasons: analysis?.status?.reasons ?? null,
      outputExists: analysis !== null,
    };
  }

  // 1. unknown-manual-foreground
  const cManualFg = await executeCase('unknown-manual-foreground', (o, m) => {
    for (const seg of m.segments) delete seg.conditions.userManualDshForeground;
  });
  assert.equal(cManualFg.exitCode, 0);
  assert.equal(cManualFg.dataReady, false);
  assert.equal(cManualFg.comparable, false);

  // 2. unknown-client-visibility
  const cClientVis = await executeCase('unknown-client-visibility', o => {
    for (const s of o.samples) s.previewStatus.data.client.hidden = null;
  });
  assert.equal(cClientVis.exitCode, 0);
  assert.equal(cClientVis.dataReady, false);
  assert.ok(cClientVis.client.every(s => s.valid === false));

  // 3. unknown-run-identity
  const cRunIdentity = await executeCase('unknown-run-identity', o => {
    o.session = { childPid: null, location: null, stable: true };
    for (const s of o.samples) {
      s.previewStatus.data.childPid = null;
      s.previewStatus.data.window.location = null;
    }
  });
  assert.equal(cRunIdentity.exitCode, 0);
  assert.equal(cRunIdentity.dataReady, false);
  assert.equal(cRunIdentity.comparable, false);

  // 4. missing-client-clock
  const cMissingClientClock = await executeCase('missing-client-clock', o => {
    o.samples[0].previewStatus.data.client.seconds = null;
    o.samples[3].previewStatus.data.client.seconds = null;
  });
  assert.equal(cMissingClientClock.exitCode, 0);
  assert.equal(cMissingClientClock.dataReady, false);
  assert.ok(cMissingClientClock.client.every(s => s.renderRateFps === null));

  // 5. missing-native-clock
  const cMissingNativeClock = await executeCase('missing-native-clock', o => {
    o.samples[0].status.data.seconds = null;
    o.samples[3].status.data.seconds = null;
  });
  assert.equal(cMissingNativeClock.exitCode, 0);
  assert.equal(cMissingNativeClock.dataReady, false);
  assert.ok(cMissingNativeClock.nativeRates.every(rate => rate == null));

  // 6. nonfinite-client-count
  const cNonfiniteClient = await executeCase('nonfinite-client-count', o => {
    for (const s of o.samples) s.previewStatus.data.client.rendered = '__NONFINITE__';
  });
  assert.equal(cNonfiniteClient.exitCode, 3);
  assert.equal(cNonfiniteClient.outputExists, false);

  // 7. sparse-disjoint-frame-coverage
  const cSparseCoverage = await executeCase('sparse-disjoint-frame-coverage', o => {
    o.framesSnapshot.records = [
      { frames: 100, seconds: 10.00, encodeMs: 80 },
      { frames: 101, seconds: 10.05, encodeMs: 80 },
      { frames: 119, seconds: 11.90, encodeMs: 80 },
      { frames: 120, seconds: 12.00, encodeMs: 80 },
    ];
  });
  assert.equal(cSparseCoverage.exitCode, 0);
  assert.equal(cSparseCoverage.frameIntervals[0].coverageAdequate, false);
  assert.ok(cSparseCoverage.frameIntervals[0].coverageRatio <= 0.08, `Expected coverageRatio <= 0.08, got ${cSparseCoverage.frameIntervals[0].coverageRatio}`);

  // 8. multi-sample-duration
  const watchDir = join(reviewRoot, 'multi-sample-duration');
  await mkdir(watchDir, { recursive: true });
  const fakeRun = join(watchDir, 'fake-run');
  await mkdir(fakeRun, { recursive: true });
  const fakeBase = makeFixture().observation.samples[0];
  await writeFile(join(fakeRun, 'status.json'), JSON.stringify(fakeBase.status.data), { flag: 'wx' });
  await writeFile(join(fakeRun, 'preview-status.json'), JSON.stringify(fakeBase.previewStatus.data), { flag: 'wx' });
  await writeFile(join(fakeRun, 'frames.jsonl'), '{"frames":100,"seconds":10}\n', { flag: 'wx' });

  const watchOutDir = join(watchDir, 'observation');
  const cli = await runCommand('node', [WATCH_SCRIPT, '--run-dir', fakeRun, '--output', watchOutDir, '--seconds', '2', '--interval-ms', '100', '--state', 'synthetic']);
  assert.equal(cli.code, 0);
  const watched = JSON.parse(await readFile(join(watchOutDir, 'observation.json'), 'utf8'));
  assert.ok(watched.summary.totalDurationMs >= 1500, `Expected totalDurationMs >= 1500ms, got ${watched.summary.totalDurationMs}ms`);
  assert.ok(watched.summary.sampleCount >= 10, `Expected sampleCount >= 10, got ${watched.summary.sampleCount}`);
  assert.equal(watched.summary.stopReason, 'completed');

  console.log('✓ Test 8 passed: All 8 Second Review F1-F4 counterexample cases verified.');
}

// ---------------------------------------------------------------------------------------------
// Test 9: Third Review G1-G3 cases (scant client progress, deduplication fallback, clock bounds)
// ---------------------------------------------------------------------------------------------
async function testThirdReviewG1ToG3Cases(root) {
  console.log('--- Test 9: Third Review G1-G3 counterexample cases ---');
  const reviewRoot = join(root, 'third-review-cases');
  await mkdir(reviewRoot, { recursive: true });

  function makeFixture() {
    const runDir = 'C:\\test\\synthetic-playback-g';
    const samples = Array.from({ length: 6 }, (_, i) => ({
      sampleIndex: i,
      elapsedMs: i * 1000,
      utc: new Date(Date.UTC(2026, 9, 14, 6, 0, i)).toISOString(),
      readDurationMs: 1,
      status: {
        readOk: true,
        duplicate: false,
        mtime: `s${i}`,
        data: {
          frames: 100 + i * 10,
          seconds: 10 + i,
          width: 1280,
          height: 720,
          acquireMs: 0.1,
          readbackMs: 2,
          jpegMs: 2,
          packHashMs: 0.1,
          pipeMs: 0.1,
          encodeMs: 5,
          sourceAgeMs: 1,
          foreground: false,
        },
      },
      previewStatus: {
        readOk: true,
        duplicate: false,
        mtime: `p${i}`,
        data: {
          childPid: 5001,
          window: { location: 'synthetic-location', pid: 6001 },
          received: 100 + i * 10,
          seconds: 10 + i,
          running: true,
          failure: null,
          client: {
            received: 100 + i * 10,
            rendered: 100 + i * 10,
            dropped: 0,
            seconds: 10 + i,
            hidden: 0,
            meanLatencyMs: 5,
            maxLatencyMs: 8,
            decodeErrors: 0,
          },
        },
      },
    }));
    const observation = {
      schemaVersion: 1,
      tool: 'watch-playback',
      state: 'synthetic',
      runDir,
      session: { childPid: 5001, location: 'synthetic-location', stable: true },
      summary: { stopReason: 'completed', partial: false, identityStable: true },
      framesSnapshot: { records: [] },
      samples,
    };
    const conditions = {
      expectedWidth: 1280,
      expectedHeight: 720,
      userManualDshForeground: true,
      sceneId: 'synthetic-scene',
      captureLimitFps: 30,
      appearanceUnchanged: true,
    };
    const manifest = {
      schemaVersion: 1,
      userNamedScene: 'synthetic-review',
      segments: [
        {
          id: 'idle',
          startElapsedMs: 0,
          endElapsedMs: 2000,
          conditions: { ...conditions, userManualMouseAction: 'stationary' },
        },
        {
          id: 'mouse',
          startElapsedMs: 3000,
          endElapsedMs: 5000,
          conditions: { ...conditions, userManualMouseAction: 'moving' },
        },
      ],
    };
    return { observation, manifest };
  }

  async function executeCase(caseId, change) {
    const dir = join(reviewRoot, caseId);
    await mkdir(dir, { recursive: true });
    const { observation, manifest } = makeFixture();
    change?.(observation, manifest);

    await writeFile(join(dir, 'observation.json'), JSON.stringify(observation, null, 2), { flag: 'wx' });
    await writeFile(join(dir, 'segments.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });

    const outDir = join(dir, 'analysis');
    const res = await runCommand('node', [ANALYZE_SCRIPT, '--input', join(dir, 'observation.json'), '--segments', join(dir, 'segments.json'), '--output', outDir]);

    let analysis = null;
    try {
      analysis = JSON.parse(await readFile(join(outDir, 'analysis.json'), 'utf8'));
    } catch {}

    return {
      exitCode: res.code,
      analysis,
      dataReady: analysis?.status?.dataReady ?? null,
      comparable: analysis?.comparison?.comparable ?? null,
      client: analysis?.segments?.map(s => s.clientThroughput) ?? null,
      nativeRates: analysis?.segments?.map(s => s.nativeThroughput?.deliveryRateFps ?? null) ?? null,
      timings: analysis?.segments?.map(s => s.timings) ?? null,
      outputExists: analysis !== null,
    };
  }

  // 1. scant-client-progress (G1)
  const cScant = await executeCase('scant-client-progress', (o, m) => {
    for (let i = 0; i < o.samples.length; i++) {
      const s = o.samples[i];
      s.elapsedMs = i * 10000;
      s.utc = new Date(Date.UTC(2026, 9, 14, 6, 0, 0) + s.elapsedMs).toISOString();
      s.status.mtime = s.utc;
      s.previewStatus.mtime = s.utc;
      s.status.data.seconds = 10 + s.elapsedMs / 1000;
      s.status.data.frames = 100 + (s.elapsedMs / 1000) * 10;
      s.previewStatus.data.seconds = s.status.data.seconds;
      s.previewStatus.data.received = s.status.data.frames;
      const c = s.previewStatus.data.client;
      c.seconds = (i < 3 ? 10 : 11) + (i % 3 === 2 ? 0.01 : 0);
      c.rendered = (i < 3 ? 100 : 200) + (i % 3 === 2 ? 1 : 0);
      c.received = c.rendered;
    }
    m.segments[0].startElapsedMs = 0;
    m.segments[0].endElapsedMs = 20000;
    m.segments[1].startElapsedMs = 30000;
    m.segments[1].endElapsedMs = 50000;
  });
  assert.equal(cScant.exitCode, 0);
  assert.equal(cScant.dataReady, false);
  assert.equal(cScant.comparable, false);

  // 2. duplicate-only-one-unique-status (G2)
  const cDuplicateFallback = await executeCase('duplicate-only-one-unique-status', o => {
    for (const [first, last] of [[0, 2], [3, 5]]) {
      const original = structuredClone(o.samples[first].status.data);
      const mtime = o.samples[first].status.mtime;
      for (let i = first; i <= last; i++) {
        o.samples[i].status.data = structuredClone(original);
        o.samples[i].status.mtime = mtime;
        o.samples[i].status.duplicate = i !== first;
      }
    }
  });
  assert.equal(cDuplicateFallback.exitCode, 0);
  assert.ok(cDuplicateFallback.timings.every(s =>
    s.observedSamples === 1 && s.encodeMs.count === 1 && s.duplicateSamplesIgnored === 2
  ));

  // 3. negative-client-relative-clock (G3)
  const cNegClient = await executeCase('negative-client-relative-clock', o => {
    for (let i = 0; i < o.samples.length; i++) {
      o.samples[i].previewStatus.data.client.seconds = -20 + i;
    }
  });
  assert.equal(cNegClient.exitCode, 3);
  assert.equal(cNegClient.outputExists, false);

  // 4. negative-native-relative-clock (G3)
  const cNegNative = await executeCase('negative-native-relative-clock', o => {
    for (let i = 0; i < o.samples.length; i++) {
      o.samples[i].status.data.seconds = -20 + i;
    }
  });
  assert.equal(cNegNative.exitCode, 3);
  assert.equal(cNegNative.outputExists, false);

  // 5. true-zero-with-progressing-client-clock
  const cTrueZero = await executeCase('true-zero-with-progressing-client-clock', o => {
    for (const s of o.samples) {
      s.previewStatus.data.client.rendered = 100;
      s.previewStatus.data.client.received = 100;
    }
  });
  assert.equal(cTrueZero.exitCode, 0);
  assert.equal(cTrueZero.dataReady, true);
  assert.ok(cTrueZero.client.every(s => s.valid && s.renderRateFps === 0));

  // 6. export-parameter-validation
  const invalids = [
    ['zero-seconds', { seconds: 0 }],
    ['over-max-seconds', { seconds: 121 }],
    ['nan-seconds', { seconds: NaN }],
    ['small-interval', { intervalMs: 1 }],
    ['unknown-state', { state: 'unknown' }],
  ];
  const apiDir = join(reviewRoot, 'export-params');
  await mkdir(apiDir, { recursive: true });
  const runDir = join(apiDir, 'run');
  await mkdir(runDir, { recursive: true });
  for (const [id, override] of invalids) {
    const outDir = join(apiDir, id);
    let threw = false;
    try {
      await watchPlayback({ runDir, outputDir: outDir, seconds: 0.01, intervalMs: 10, state: 'synthetic', ...override });
    } catch {
      threw = true;
    }
    assert.ok(threw, `Expected watchPlayback to throw for ${id}`);
    assert.equal(await pathExists(outDir), false, `Expected no output directory created for ${id}`);
  }

  // 7. stop-after-multiple-samples
  const stopDir = join(reviewRoot, 'stop-sentinel');
  await mkdir(stopDir, { recursive: true });
  const stopRun = join(stopDir, 'run');
  await mkdir(stopRun, { recursive: true });
  const baseSample = makeFixture().observation.samples[0];
  await writeFile(join(stopRun, 'status.json'), JSON.stringify(baseSample.status.data), { flag: 'wx' });
  await writeFile(join(stopRun, 'preview-status.json'), JSON.stringify(baseSample.previewStatus.data), { flag: 'wx' });
  await writeFile(join(stopRun, 'frames.jsonl'), '{"frames":100,"seconds":10}\n', { flag: 'wx' });
  const stopOut = join(stopDir, 'observation');
  const stopProc = spawn('node', [WATCH_SCRIPT, '--run-dir', stopRun, '--output', stopOut, '--seconds', '5', '--interval-ms', '100', '--state', 'synthetic'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const waitStart = performance.now();
  while (!(await pathExists(stopOut))) {
    if (performance.now() - waitStart > 2000) throw new Error('watch-playback failed to create output directory');
    await new Promise(r => setTimeout(r, 20));
  }
  await new Promise(r => setTimeout(r, 450));
  await writeFile(join(stopOut, 'STOP'), 'stop sentinel\n', { flag: 'wx' });
  const stopExitCode = await new Promise((res, rej) => {
    stopProc.on('error', rej);
    stopProc.on('close', res);
  });
  assert.equal(stopExitCode, 0);
  const stopObs = JSON.parse(await readFile(join(stopOut, 'observation.json'), 'utf8'));
  assert.equal(stopObs.summary.stopReason, 'sentinel');
  assert.equal(stopObs.summary.partial, true);
  assert.ok(stopObs.summary.sampleCount >= 3, `Expected sampleCount >= 3, got ${stopObs.summary.sampleCount}`);

  console.log('✓ Test 9 passed: All Third Review G1-G3 counterexample cases verified.');
}

// ---------------------------------------------------------------------------------------------
// Main Test Runner
// ---------------------------------------------------------------------------------------------
async function runAllTests() {
  console.log(`=== Starting Playback Performance Verification Suite ===`);
  console.log(`Test evidence root: ${TEST_ROOT}`);

  await mkdir(TEST_ROOT, { recursive: true });

  try {
    await testCategory1NormalTwoSegmentFlow(TEST_ROOT);
    await testCategory2ClientGuardsAndZeroIncrement(TEST_ROOT);
    await testCategory3SparseFrameSequences();
    await testCategory4SessionDimensionAndForeground(TEST_ROOT);
    await testCategory5TimingHierarchyAndLatency();
    await testCategory6RobustnessAndSentinel(TEST_ROOT);
    await testReviewR1ToR4Cases(TEST_ROOT);
    await testSecondReviewF1ToF4Cases(TEST_ROOT);
    await testThirdReviewG1ToG3Cases(TEST_ROOT);

    console.log('\n======================================================');
    console.log('ALL PLAYBACK PERFORMANCE TEST CATEGORIES PASSED!');
    console.log('======================================================');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();
