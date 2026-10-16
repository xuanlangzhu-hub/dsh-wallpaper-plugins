// Verification suite for P3 Native Capture Pacing Local Observation.
//
// Tests:
// 1. Acceptance 1: Pacing request vs actual separation (e.g. 10ms vs 25ms),
//    accurate boundary attribution, exact delta sum/count mean recomputation.
// 2. Acceptance 2: Post-record work (+20ms) and consecutive empty frame retries
//    kept strictly distinct from encodeMs and synthetic FPS.
// 3. Acceptance 3: Zero waits / null division, terminal summary, run reset,
//    rollback / negative counter gating and backward compatibility.
// 4. Acceptance 4: End-to-end observation sampler and analyzer pipeline with P3 metrics.
// 5. Acceptance 5: Isolated C# WallpaperProbe build and CLI self-test execution.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { analyzeSegment, compareSegments, renderMarkdownReport, analyzePlayback, BadInput } from './analyze-playback.mjs';
import { sanitizeStatus, sanitizePacing, watchPlayback } from './watch-playback.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const testEvidenceDir = join(repoRoot, '.tmp', `p3-native-pacing-check-${Date.now()}`);

console.log('=== Starting P3 Native Pacing Verification Suite ===');
console.log(`Test evidence root: ${testEvidenceDir}`);
await mkdir(testEvidenceDir, { recursive: true });

try {
  // =========================================================================
  // Test 1: Pacing Request vs Actual Separation (Acceptance 1)
  // =========================================================================
  console.log('--- Test 1: Pacing request vs actual separation (10ms vs 25ms) ---');
  {
    const basePacing1 = {
      pacingWaitCount: 10,
      pacingWaitRequestedSumMs: 100.0,
      pacingWaitRequestedMaxMs: 10.0,
      pacingWaitActualSumMs: 250.0,
      pacingWaitActualMaxMs: 27.5,
      postRecordCount: 10,
      postRecordSumMs: 12.0,
      postRecordMaxMs: 1.5,
      statusPublishCount: 1,
      statusPublishSumMs: 2.0,
      statusPublishMaxMs: 2.0,
      emptyRetryCount: 0,
      emptyWaitRequestedSumMs: 0.0,
      emptyWaitRequestedMaxMs: 0.0,
      emptyWaitActualSumMs: 0.0,
      emptyWaitActualMaxMs: 0.0,
      cycleIntervalCount: 9,
      cycleIntervalSumMs: 418.5,
      cycleIntervalMaxMs: 47.0,
      totalWorkCount: 10,
      totalWorkSumMs: 162.0,
      totalWorkMaxMs: 17.5,
    };

    const basePacing2 = {
      pacingWaitCount: 30, // delta = 20
      pacingWaitRequestedSumMs: 300.0, // delta = 200.0 -> mean = 10.0
      pacingWaitRequestedMaxMs: 10.0,
      pacingWaitActualSumMs: 750.0, // delta = 500.0 -> mean = 25.0
      pacingWaitActualMaxMs: 28.0,
      postRecordCount: 30, // delta = 20
      postRecordSumMs: 36.0, // delta = 24.0 -> mean = 1.2
      postRecordMaxMs: 1.8,
      statusPublishCount: 3, // delta = 2
      statusPublishSumMs: 6.0, // delta = 4.0 -> mean = 2.0
      statusPublishMaxMs: 2.1,
      emptyRetryCount: 0,
      emptyWaitRequestedSumMs: 0.0,
      emptyWaitRequestedMaxMs: 0.0,
      emptyWaitActualSumMs: 0.0,
      emptyWaitActualMaxMs: 0.0,
      cycleIntervalCount: 29, // delta = 20
      cycleIntervalSumMs: 930.0, // delta = 511.5 -> mean = 25.58
      cycleIntervalMaxMs: 48.0,
      totalWorkCount: 30, // delta = 20
      totalWorkSumMs: 486.0, // delta = 324.0 -> mean = 16.2
      totalWorkMaxMs: 18.0,
    };

    const mockObs = {
      schemaVersion: 1,
      state: 'synthetic',
      runDir: 'F:\\mock-run',
      session: { stable: true, childPid: 1234, location: 'WhaleWallpaperProbe-test' },
      samples: [
        {
          sampleIndex: 0,
          elapsedMs: 1000,
          status: {
            readOk: true,
            duplicate: false,
            data: {
              frames: 10,
              seconds: 1.0,
              width: 1280,
              height: 720,
              foreground: true,
              encodeMs: 15.0,
              pacing: basePacing1,
            },
          },
          previewStatus: {
            readOk: true,
            duplicate: false,
            data: {
              childPid: 1234,
              received: 10,
              seconds: 1.0,
              window: { location: 'WhaleWallpaperProbe-test', pid: 5678, created: true, captureStarted: true },
            },
          },
        },
        {
          sampleIndex: 1,
          elapsedMs: 2000,
          status: {
            readOk: true,
            duplicate: false,
            data: {
              frames: 30,
              seconds: 2.0,
              width: 1280,
              height: 720,
              foreground: true,
              encodeMs: 15.0,
              pacing: basePacing2,
            },
          },
          previewStatus: {
            readOk: true,
            duplicate: false,
            data: {
              childPid: 1234,
              received: 30,
              seconds: 2.0,
              window: { location: 'WhaleWallpaperProbe-test', pid: 5678, created: true, captureStarted: true },
            },
          },
        },
      ],
      framesSnapshot: {
        records: [
          { frames: 10, seconds: 1.0, encodeMs: 15.0, prevPacingRequestedMs: 10.0, prevPacingActualMs: 25.0, prevPostRecordMs: 1.2, cycleIntervalMs: 41.2 },
          { frames: 11, seconds: 1.05, encodeMs: 15.0, prevPacingRequestedMs: 10.0, prevPacingActualMs: 25.0, prevPostRecordMs: 1.2, cycleIntervalMs: 41.2 },
        ],
      },
    };

    const segDef = { id: 'seg1', label: '10ms_vs_25ms_test', startElapsedMs: 1000, endElapsedMs: 2000, conditions: { userManualDshForeground: true } };
    const res = analyzeSegment(segDef, mockObs);

    assert.equal(res.valid, true, 'Segment must be valid');
    assert.equal(res.nativePacing.available, true);
    assert.equal(res.nativePacing.valid, true);

    const pw = res.nativePacing.pacingWait;
    assert.equal(pw.count, 20, 'Wait count delta must be 20');
    assert.equal(pw.requestedSumMs, 200.0, 'Requested sum delta must be 200ms');
    assert.equal(pw.requestedMeanMs, 10.0, 'Requested mean must be exactly 10.0ms');
    assert.equal(pw.actualSumMs, 500.0, 'Actual sum delta must be 500ms');
    assert.equal(pw.actualMeanMs, 25.0, 'Actual mean must be exactly 25.0ms');
    assert.equal(pw.discrepancyMeanMs, 15.0, 'Discrepancy mean must be exactly 15.0ms (25.0 - 10.0)');
    assert.equal(pw.cumulativeActualMaxMs, 28.0);

    const pr = res.nativePacing.postRecord;
    assert.equal(pr.count, 20);
    assert.equal(pr.sumMs, 24.0);
    assert.equal(pr.meanMs, 1.2);

    const sp = res.nativePacing.statusPublish;
    assert.equal(sp.count, 2);
    assert.equal(sp.sumMs, 4.0);
    assert.equal(sp.meanMs, 2.0);

    console.log('✓ Test 1 passed: Requested 10ms and actual 25ms wait cleanly separated with exact discrepancy 15.0ms.');
  }

  // =========================================================================
  // Test 2: Post-Record Work (+20ms) and Empty Retry Decoupling (Acceptance 2)
  // =========================================================================
  console.log('--- Test 2: Post-record work (+20ms) & consecutive empty retries decoupling ---');
  {
    const pacingWithEmptyAndPostWork1 = {
      pacingWaitCount: 10,
      pacingWaitRequestedSumMs: 150.0,
      pacingWaitRequestedMaxMs: 15.0,
      pacingWaitActualSumMs: 250.0,
      pacingWaitActualMaxMs: 27.0,
      postRecordCount: 10,
      postRecordSumMs: 200.0, // 20ms per frame
      postRecordMaxMs: 22.0,
      statusPublishCount: 1,
      statusPublishSumMs: 18.0,
      statusPublishMaxMs: 18.0,
      emptyRetryCount: 2,
      emptyWaitRequestedSumMs: 4.0,
      emptyWaitRequestedMaxMs: 2.0,
      emptyWaitActualSumMs: 31.2, // 15.6ms actual per retry
      emptyWaitActualMaxMs: 16.0,
      cycleIntervalCount: 9,
      cycleIntervalSumMs: 500.0,
      cycleIntervalMaxMs: 58.0,
      totalWorkCount: 10,
      totalWorkSumMs: 350.0, // 15ms encode + 20ms postRecord = 35ms total work
      totalWorkMaxMs: 37.0,
    };

    const pacingWithEmptyAndPostWork2 = {
      pacingWaitCount: 20, // delta = 10
      pacingWaitRequestedSumMs: 300.0, // delta = 150.0 -> mean = 15.0ms
      pacingWaitRequestedMaxMs: 15.0,
      pacingWaitActualSumMs: 500.0, // delta = 250.0 -> mean = 25.0ms
      pacingWaitActualMaxMs: 27.5,
      postRecordCount: 20, // delta = 10
      postRecordSumMs: 400.0, // delta = 200.0 -> mean = 20.0ms (+20ms post-record work!)
      postRecordMaxMs: 22.5,
      statusPublishCount: 2, // delta = 1
      statusPublishSumMs: 36.0, // delta = 18.0 -> mean = 18.0ms
      statusPublishMaxMs: 18.5,
      emptyRetryCount: 5, // delta = 3 retries!
      emptyWaitRequestedSumMs: 10.0, // delta = 6.0ms (3 * 2ms)
      emptyWaitRequestedMaxMs: 2.0,
      emptyWaitActualSumMs: 78.0, // delta = 46.8ms (3 * 15.6ms actual)
      emptyWaitActualMaxMs: 16.2,
      cycleIntervalCount: 19, // delta = 10
      cycleIntervalSumMs: 1100.0, // delta = 600.0 -> mean = 60.0ms
      cycleIntervalMaxMs: 65.0,
      totalWorkCount: 20, // delta = 10
      totalWorkSumMs: 700.0, // delta = 350.0 -> mean = 35.0ms
      totalWorkMaxMs: 37.5,
    };

    const mockObs = {
      schemaVersion: 1,
      state: 'synthetic',
      runDir: 'F:\\mock-run-empty',
      session: { stable: true, childPid: 2222, location: 'WhaleWallpaperProbe-test' },
      samples: [
        {
          sampleIndex: 0,
          elapsedMs: 1000,
          status: {
            readOk: true,
            duplicate: false,
            data: {
              frames: 10,
              seconds: 1.0,
              width: 1280,
              height: 720,
              foreground: true,
              encodeMs: 15.0,
              pacing: pacingWithEmptyAndPostWork1,
            },
          },
          previewStatus: {
            readOk: true,
            duplicate: false,
            data: {
              childPid: 2222,
              received: 10,
              seconds: 1.0,
              window: { location: 'WhaleWallpaperProbe-test', pid: 3333, created: true, captureStarted: true },
            },
          },
        },
        {
          sampleIndex: 1,
          elapsedMs: 2000,
          status: {
            readOk: true,
            duplicate: false,
            data: {
              frames: 20,
              seconds: 2.0,
              width: 1280,
              height: 720,
              foreground: true,
              encodeMs: 15.0,
              pacing: pacingWithEmptyAndPostWork2,
            },
          },
          previewStatus: {
            readOk: true,
            duplicate: false,
            data: {
              childPid: 2222,
              received: 20,
              seconds: 2.0,
              window: { location: 'WhaleWallpaperProbe-test', pid: 3333, created: true, captureStarted: true },
            },
          },
        },
      ],
      framesSnapshot: {
        records: [
          { frames: 10, seconds: 1.0, encodeMs: 15.0, prevPacingRequestedMs: 15.0, prevPacingActualMs: 25.0, prevPostRecordMs: 20.0, prevEmptyRetryCount: 1, prevEmptyWaitActualMs: 15.6, cycleIntervalMs: 60.6 },
          { frames: 11, seconds: 1.06, encodeMs: 15.0, prevPacingRequestedMs: 15.0, prevPacingActualMs: 25.0, prevPostRecordMs: 20.0, prevEmptyRetryCount: 1, prevEmptyWaitActualMs: 15.6, cycleIntervalMs: 60.6 },
        ],
      },
    };

    const res = analyzeSegment({ id: 'seg_empty', startElapsedMs: 1000, endElapsedMs: 2000, conditions: { userManualDshForeground: true } }, mockObs);
    assert.equal(res.valid, true);

    // Verify encodeMs is preserved independently at 15ms (NOT mixed with postRecord 20ms or emptyWait 46.8ms)
    assert.equal(res.timings.encodeMs.mean, 15.0, 'encodeMs must remain 15.0ms');

    // Verify postRecord work is measured separately at 20.0ms
    assert.equal(res.nativePacing.postRecord.count, 10);
    assert.equal(res.nativePacing.postRecord.meanMs, 20.0, 'postRecord mean must be exactly 20.0ms');

    // Verify totalWork is 35.0ms (15.0 + 20.0)
    assert.equal(res.nativePacing.totalWork.meanMs, 35.0, 'totalWork mean must be 35.0ms');

    // Verify empty frame retries are measured separately
    const ew = res.nativePacing.emptyWait;
    assert.equal(ew.retryCount, 3, 'Empty retry count must be 3');
    assert.equal(ew.requestedSumMs, 6.0, 'Requested empty wait sum must be 6.0ms (3 * 2ms)');
    assert.equal(ew.actualSumMs, 46.8, 'Actual empty wait sum must be 46.8ms');
    assert.equal(ew.actualMeanMs, 15.6, 'Actual empty wait mean per retry must be 15.6ms');

    // Verify cycle interval
    assert.equal(res.nativePacing.cycleInterval.meanMs, 60.0);
    assert.equal(res.nativePacing.cycleInterval.cadenceFps, 16.67);

    // Verify native delivery rate is 10fps (frames delta 10 / 1s), not synthesized from empty retries
    assert.equal(res.nativeThroughput.deliveryRateFps, 10.0);

    console.log('✓ Test 2 passed: +20ms post-record work and consecutive empty retries decouple cleanly without inflating encodeMs.');
  }

  // =========================================================================
  // Test 3: Zero Waits, Run Reset, Gating & Rollback Rejection (Acceptance 3)
  // =========================================================================
  console.log('--- Test 3: Zero waits, run reset, rollback & anomaly gating ---');
  {
    // Zero waits case
    const zeroPacing = {
      pacingWaitCount: 0,
      pacingWaitRequestedSumMs: 0.0,
      pacingWaitRequestedMaxMs: null,
      pacingWaitActualSumMs: 0.0,
      pacingWaitActualMaxMs: null,
      postRecordCount: 0,
      postRecordSumMs: 0.0,
      postRecordMaxMs: null,
      statusPublishCount: 0,
      statusPublishSumMs: 0.0,
      statusPublishMaxMs: null,
      emptyRetryCount: 0,
      emptyWaitRequestedSumMs: 0.0,
      emptyWaitRequestedMaxMs: null,
      emptyWaitActualSumMs: 0.0,
      emptyWaitActualMaxMs: null,
      cycleIntervalCount: 0,
      cycleIntervalSumMs: 0.0,
      cycleIntervalMaxMs: null,
      totalWorkCount: 0,
      totalWorkSumMs: 0.0,
      totalWorkMaxMs: null,
    };

    const zeroObs = {
      schemaVersion: 1,
      state: 'synthetic',
      runDir: 'F:\\mock-zero',
      session: { stable: true, childPid: 4444, location: 'WhaleWallpaperProbe-test' },
      samples: [
        {
          sampleIndex: 0,
          elapsedMs: 1000,
          status: { readOk: true, duplicate: false, data: { frames: 0, seconds: 1.0, width: 1280, height: 720, foreground: true, encodeMs: 0.0, pacing: zeroPacing } },
          previewStatus: { readOk: true, duplicate: false, data: { childPid: 4444, received: 0, seconds: 1.0, window: { location: 'WhaleWallpaperProbe-test', pid: 5555, created: true, captureStarted: true } } },
        },
        {
          sampleIndex: 1,
          elapsedMs: 2000,
          status: { readOk: true, duplicate: false, data: { frames: 0, seconds: 2.0, width: 1280, height: 720, foreground: true, encodeMs: 0.0, pacing: zeroPacing } },
          previewStatus: { readOk: true, duplicate: false, data: { childPid: 4444, received: 0, seconds: 2.0, window: { location: 'WhaleWallpaperProbe-test', pid: 5555, created: true, captureStarted: true } } },
        },
      ],
    };

    const resZero = analyzeSegment({ id: 'seg_zero', startElapsedMs: 1000, endElapsedMs: 2000, conditions: { userManualDshForeground: true } }, zeroObs);
    assert.equal(resZero.nativePacing.available, true);
    assert.equal(resZero.nativePacing.valid, true);
    assert.equal(resZero.nativePacing.pacingWait.count, 0);
    assert.equal(resZero.nativePacing.pacingWait.requestedMeanMs, null, 'Division by 0 count must produce null mean');
    assert.equal(resZero.nativePacing.pacingWait.actualMeanMs, null, 'Division by 0 count must produce null mean');
    assert.equal(resZero.nativePacing.emptyWait.retryCount, 0);
    assert.equal(resZero.nativePacing.emptyWait.actualMeanMs, null);

    // Rollback rejection: artificial decrease in pacingWaitCount (50 -> 40)
    const rollbackObs = JSON.parse(JSON.stringify(zeroObs));
    rollbackObs.samples[0].status.data.frames = 10;
    rollbackObs.samples[1].status.data.frames = 20;
    rollbackObs.samples[0].status.data.pacing = { ...zeroPacing, pacingWaitCount: 50, pacingWaitRequestedSumMs: 500 };
    rollbackObs.samples[1].status.data.pacing = { ...zeroPacing, pacingWaitCount: 40, pacingWaitRequestedSumMs: 400 }; // ROLLBACK!
    const resRollback = analyzeSegment({ id: 'seg_rb', startElapsedMs: 1000, endElapsedMs: 2000, conditions: { userManualDshForeground: true } }, rollbackObs);
    assert.equal(resRollback.nativePacing.valid, false, 'Rollback must invalidate native pacing');
    assert.ok(resRollback.nativePacing.reason.includes('native_pacing_counter_reset'), 'Reason must indicate counter reset');
    assert.equal(resRollback.valid, false, 'Segment must be invalid on counter reset');

    // Negative counter rejection: validateObservation rejects negative numbers in pacing
    const negativeObs = JSON.parse(JSON.stringify(zeroObs));
    negativeObs.samples[0].status.data.pacing = { ...zeroPacing, pacingWaitRequestedSumMs: -5.0 };
    assert.throws(
      () => {
        analyzeSegment({ id: 'seg_neg', startElapsedMs: 1000, endElapsedMs: 2000, conditions: { userManualDshForeground: true } }, negativeObs);
      },
      /BadInput.*negative/,
      'Negative pacing metrics must be rejected as BadInput'
    );

    // R1 regression: Integer truncation wait calculation
    function computeLegacyRequestedWait(fps, elapsed) {
      return Math.max(1, Math.trunc(1000.0 / fps - elapsed));
    }
    assert.equal(computeLegacyRequestedWait(30, 15.6), 17, 'fps=30, work=15.6 must truncate to 17ms');
    assert.equal(computeLegacyRequestedWait(30, 15.3), 18, 'fps=30, work=15.3 must truncate to 18ms');
    assert.equal(computeLegacyRequestedWait(30, 17.8), 15, 'fps=30, work=17.8 must truncate to 15ms');
    assert.equal(computeLegacyRequestedWait(30, 34.0), 1, 'fps=30, work=34.0 must clamp to 1ms');

    // R2 regression: Counterexample where middle sample has invalid count and hides rollback
    const r2CaseDir = join(testEvidenceDir, 'r2-counterexample');
    await mkdir(r2CaseDir, { recursive: true });

    const r2Samples = [];
    for (let n = 1; n <= 3; n++) {
      const pacing = {
        pacingWaitCount: 30 * n,
        pacingWaitRequestedSumMs: 300 * n,
        pacingWaitRequestedMaxMs: 10,
        pacingWaitActualSumMs: 750 * n,
        pacingWaitActualMaxMs: 25,
        postRecordCount: 30 * n,
        postRecordSumMs: 600 * n,
        postRecordMaxMs: 20,
        statusPublishCount: n,
        statusPublishSumMs: 2 * n,
        statusPublishMaxMs: 2,
        emptyRetryCount: 3 * n,
        emptyWaitRequestedSumMs: 6 * n,
        emptyWaitRequestedMaxMs: 2,
        emptyWaitActualSumMs: 15 * n,
        emptyWaitActualMaxMs: 5,
        cycleIntervalCount: n,
        cycleIntervalSumMs: 40 * n,
        cycleIntervalMaxMs: 40,
        totalWorkCount: 30 * n,
        totalWorkSumMs: 1050 * n,
        totalWorkMaxMs: 35,
      };

      const client = {
        received: 30 * n, rendered: 30 * n, dropped: 0, seconds: n, sourceSequence: 30 * n, hidden: 0, decodeErrors: 0,
        drawCount: 30 * n, drawSumMs: 0.9 * n, drawErrorCount: 0, syncCount: 30 * n, syncSumMs: 1.8 * n, syncErrorCount: 0,
        decodeSuccessCount: 30 * n, decodeSuccessSumMs: 150 * n, decodeFailCount: 0, decodeFailSumMs: 0,
        waitRafCount: 30 * n, waitRafSumMs: 30 * n, waitTimeoutCount: 0, waitTimeoutSumMs: 0, waitCancelledCount: 0,
        discardHiddenCount: 0, discardStaleCount: 0, dropDecodingCount: 0, dropSyncCount: 0, dropWaitingCallbackCount: 0, dropOtherCount: 0,
      };

      const data = { frames: 30 * n, seconds: n, width: 1280, height: 720, encodeMs: 15, pacing };
      r2Samples.push({
        sampleIndex: n - 1, elapsedMs: n * 1000, utc: new Date(1700000000000 + n * 1000).toISOString(),
        status: { readOk: true, duplicate: false, data },
        previewStatus: {
          readOk: true, duplicate: false,
          data: {
            childPid: 4444, received: 30 * n, seconds: n, running: true,
            window: { location: 'WhaleWallpaperProbe-p3-r2-counterexample' }, client,
          },
        },
      });
    }

    // Corrupt middle sample exactly as in Codex counterexample
    const middleData = r2Samples[1].status.data;
    middleData.pacing.pacingWaitCount = 'broken';
    middleData.pacing.postRecordCount = 0;
    middleData.pacing.postRecordSumMs = 0;
    r2Samples[1].status.data = sanitizeStatus(middleData);

    const r2Obs = {
      schemaVersion: 1, state: 'synthetic', tool: 'r2-counterexample', runDir: 'F:/synthetic-r2',
      session: { stable: true, childPid: 4444, location: 'WhaleWallpaperProbe-p3-r2-counterexample' },
      samples: r2Samples,
      framesSnapshot: { records: [] },
    };

    const r2Segments = {
      schemaVersion: 1, state: 'synthetic', userNamedScene: 'P3 R2 regression',
      segments: [
        { id: 'A', startIndex: 0, endIndex: 2, conditions: { userManualDshForeground: true, userManualMouseAction: 'stationary' } },
        { id: 'B', startIndex: 0, endIndex: 2, conditions: { userManualDshForeground: true, userManualMouseAction: 'moving' } },
      ],
    };

    const r2ObsPath = join(r2CaseDir, 'r2-obs.json');
    const r2SegPath = join(r2CaseDir, 'r2-seg.json');
    await writeFile(r2ObsPath, JSON.stringify(r2Obs, null, 2), 'utf8');
    await writeFile(r2SegPath, JSON.stringify(r2Segments, null, 2), 'utf8');

    const r2AnalysisOut = await analyzePlayback({ inputPath: r2ObsPath, segmentsPath: r2SegPath, outputDir: join(r2CaseDir, 'analysis') });
    const r2SegA = r2AnalysisOut.analysis.segments[0];
    assert.equal(r2SegA.valid, false, 'Segment must be invalid when middle sample resets count');
    assert.equal(r2SegA.nativePacing.valid, false, 'Native pacing must be invalid on counter reset');
    assert.ok(
      r2SegA.nativePacing.reason.includes('native_pacing_counter_reset') || r2SegA.nativePacing.reason.includes('native_pacing_invalid'),
      `Reason must indicate counter reset or invalid metric, got: ${r2SegA.nativePacing.reason}`
    );
    assert.equal(r2AnalysisOut.analysis.comparison.nativePacingDeltas, null, 'Pacing deltas must be suppressed on invalid pacing');
    assert.equal(r2AnalysisOut.analysis.status.dataReady, false, 'dataReady must be false');

    console.log('✓ Test 3 passed: Zero wait yields null means; rollbacks, negative values and R2 counterexamples properly gated.');
  }

  // =========================================================================
  // Test 4: End-to-End Watcher -> Analyzer Pipeline with P3 Metrics
  // =========================================================================
  console.log('--- Test 4: End-to-end watcher and analyzer pipeline ---');
  {
    const runDir = join(testEvidenceDir, 'mock-run');
    const watcherOutDir = join(testEvidenceDir, 'watcher-out');
    const analysisOutDir = join(testEvidenceDir, 'analysis-out');
    await mkdir(runDir, { recursive: true });

    const statusPacing = {
      pacingWaitCount: 15,
      pacingWaitRequestedSumMs: 150.0,
      pacingWaitRequestedMaxMs: 12.0,
      pacingWaitActualSumMs: 375.0,
      pacingWaitActualMaxMs: 26.5,
      postRecordCount: 15,
      postRecordSumMs: 18.0,
      postRecordMaxMs: 1.5,
      statusPublishCount: 2,
      statusPublishSumMs: 3.5,
      statusPublishMaxMs: 2.0,
      emptyRetryCount: 1,
      emptyWaitRequestedSumMs: 2.0,
      emptyWaitRequestedMaxMs: 2.0,
      emptyWaitActualSumMs: 15.6,
      emptyWaitActualMaxMs: 15.6,
      cycleIntervalCount: 14,
      cycleIntervalSumMs: 580.0,
      cycleIntervalMaxMs: 44.0,
      totalWorkCount: 15,
      totalWorkSumMs: 225.0,
      totalWorkMaxMs: 16.5,
    };

    const statusObj = {
      frames: 15,
      changed: 15,
      seconds: 1.5,
      width: 1280,
      height: 720,
      bytes: 45000,
      hash: 'ABCD1234',
      mode: 'pipe',
      skippedPublications: 0,
      captureSource: 'window',
      sourceTimestampMs: 1000.0,
      capturedAt: Date.now(),
      pipeMs: 0.1,
      sourceAgeMs: 5.0,
      minimized: false,
      foreground: true,
      visible: true,
      cloaked: false,
      winLeft: 0,
      winTop: 0,
      acquireMs: 1.0,
      readbackMs: 8.0,
      jpegMs: 5.0,
      packHashMs: 0.5,
      imageWriteMs: 0.1,
      encodeMs: 14.6,
      cycleIntervalMs: 41.5,
      prevPacingRequestedMs: 10.0,
      prevPacingActualMs: 25.0,
      prevPostRecordMs: 1.2,
      prevEmptyRetryCount: 0,
      prevEmptyWaitActualMs: 0.0,
      isStatusFrame: true,
      pacing: statusPacing,
    };

    const previewStatusObj = {
      transport: 'pipe-stream',
      childPid: 9876,
      window: { location: 'WhaleWallpaperProbe-p3', pid: 5432, created: true, captureStarted: true, cleanup: null },
      stopping: false,
      failure: null,
      received: 15,
      bytes: 45000,
      updatedAt: Date.now(),
      sourceSequence: 15,
      running: true,
      seconds: 1.5,
      client: {
        received: 15,
        rendered: 15,
        dropped: 0,
        sourceSequence: 15,
        seconds: 1.5,
        meanLatencyMs: 25.0,
        maxLatencyMs: 30.0,
        decodeErrors: 0,
        hidden: 0,
        waitRafCount: 15,
        waitRafSumMs: 10.0,
        waitRafMaxMs: 1.5,
        waitTimeoutCount: 0,
        waitTimeoutSumMs: 0.0,
        waitTimeoutMaxMs: null,
        waitCancelledCount: 0,
        decodeSuccessCount: 15,
        decodeSuccessSumMs: 60.0,
        decodeSuccessMaxMs: 5.0,
        decodeFailCount: 0,
        decodeFailSumMs: 0.0,
        decodeFailMaxMs: null,
        discardHiddenCount: 0,
        discardStaleCount: 0,
        syncCount: 15,
        syncSumMs: 1.0,
        syncMaxMs: 0.1,
        syncErrorCount: 0,
        drawCount: 15,
        drawSumMs: 0.5,
        drawMaxMs: 0.05,
        drawErrorCount: 0,
        dropDecodingCount: 0,
        dropSyncCount: 0,
        dropWaitingCallbackCount: 0,
        dropOtherCount: 0,
      },
      native: statusObj,
    };

    const framesJsonl = [
      JSON.stringify({ log: 'frames', capacity: 1200 }),
      JSON.stringify({ frames: 1, seconds: 0.1, encodeMs: 14.5, cycleIntervalMs: null, prevPacingRequestedMs: null, prevPacingActualMs: null, prevPostRecordMs: null, isStatusFrame: true, pacing: statusPacing }),
      JSON.stringify({ frames: 2, seconds: 0.15, encodeMs: 14.6, cycleIntervalMs: 41.5, prevPacingRequestedMs: 10.0, prevPacingActualMs: 25.0, prevPostRecordMs: 1.2, isStatusFrame: false, pacing: statusPacing }),
    ].join('\n');

    await writeFile(join(runDir, 'status.json'), JSON.stringify(statusObj, null, 2));
    await writeFile(join(runDir, 'preview-status.json'), JSON.stringify(previewStatusObj, null, 2));
    await writeFile(join(runDir, 'frames.jsonl'), framesJsonl);

    // Run watchPlayback in synthetic mode
    await watchPlayback({
      runDir,
      outputDir: watcherOutDir,
      seconds: 2,
      intervalMs: 100,
      state: 'synthetic',
    });

    const obsRaw = await readFile(join(watcherOutDir, 'observation.json'), 'utf8');
    const obs = JSON.parse(obsRaw);
    assert.ok(obs.samples.length >= 1, 'Observation must contain samples');
    assert.ok(obs.samples[0].status.data.pacing, 'Status sample must contain sanitized pacing object');
    assert.equal(obs.samples[0].status.data.pacing.pacingWaitCount, 15);
    assert.equal(obs.samples[0].status.data.pacing.pacingWaitRequestedSumMs, 150.0);
    assert.equal(obs.samples[0].status.data.pacing.pacingWaitActualSumMs, 375.0);

    // Create segments manifest comparing two mock segments from synthetically expanded samples
    // Duplicate sample with advanced counts for segment B
    const s1 = JSON.parse(JSON.stringify(obs.samples[0]));
    s1.sampleIndex = 0;
    s1.elapsedMs = 100;
    s1.status.data.seconds = 1.0;
    s1.previewStatus.data.seconds = 1.0;

    const s2 = JSON.parse(JSON.stringify(obs.samples[0]));
    s2.sampleIndex = 1;
    s2.elapsedMs = 1000;
    s2.status.data.seconds = 2.0;
    s2.status.data.frames = 35;
    s2.previewStatus.data.seconds = 2.0;
    s2.previewStatus.data.received = 35;
    s2.previewStatus.data.client.seconds = 2.0;
    s2.previewStatus.data.client.rendered = 35;
    s2.previewStatus.data.client.drawCount = 35;
    s2.status.data.pacing.pacingWaitCount = 35;
    s2.status.data.pacing.pacingWaitRequestedSumMs = 350.0;
    s2.status.data.pacing.pacingWaitActualSumMs = 875.0;
    s2.status.data.pacing.postRecordCount = 35;
    s2.status.data.pacing.postRecordSumMs = 42.0;
    s2.status.data.pacing.cycleIntervalCount = 34;
    s2.status.data.pacing.cycleIntervalSumMs = 1380.0;
    s2.status.data.pacing.totalWorkCount = 35;
    s2.status.data.pacing.totalWorkSumMs = 525.0;

    const multiSampleObs = {
      ...obs,
      samples: [s1, s2],
    };

    const segmentsManifest = {
      schemaVersion: 1,
      state: 'synthetic',
      userNamedScene: 'P3_E2E_Test',
      segments: [
        { id: 'segA', label: 'Baseline', startIndex: 0, endIndex: 1, conditions: { userManualDshForeground: true, userManualMouseAction: 'idle' } },
        { id: 'segB', label: 'Active', startIndex: 0, endIndex: 1, conditions: { userManualDshForeground: true, userManualMouseAction: 'mouse' } },
      ],
    };

    const segA = analyzeSegment(segmentsManifest.segments[0], multiSampleObs);
    const segB = analyzeSegment(segmentsManifest.segments[1], multiSampleObs);
    assert.equal(segA.valid, true);
    assert.equal(segB.valid, true);

    const comp = compareSegments(segA, segB, multiSampleObs);
    assert.equal(comp.comparable, true);
    assert.ok(comp.nativePacingDeltas, 'Comparison must include nativePacingDeltas');
    assert.equal(comp.nativePacingDeltas.pacingWaitRequestedMeanMs, 0.0); // Identical segments -> 0 delta
    assert.equal(comp.nativePacingDeltas.pacingWaitActualMeanMs, 0.0);

    const analysisObj = {
      schemaVersion: 1,
      tool: 'analyze-playback',
      state: 'synthetic',
      createdAt: new Date().toISOString(),
      status: { reportWritten: true, dataReady: true, inconclusive: false, reasons: [] },
      metadata: { state: 'synthetic', input: 'mock', segmentsManifest: 'mock', scene: 'P3_E2E_Test', runDir: runDir },
      overview: [],
      segments: [segA, segB],
      comparison: comp,
      boundaries: ['B1: Native Pacing Observation'],
    };

    const md = renderMarkdownReport(analysisObj);
    assert.ok(md.includes('原生采集节奏与延迟分解 (P3 Native Pacing)'), 'Markdown must render P3 section in segments');
    assert.ok(md.includes('循环起点间隔 (cycleInterval)'), 'Markdown must render cycleInterval row');
    assert.ok(md.includes('Pacing 请求等待 (requested)'), 'Markdown must render requested wait row');
    assert.ok(md.includes('Pacing 实际等待 (actual)'), 'Markdown must render actual wait row');
    assert.ok(md.includes('调度恢复偏差 (discrepancy)'), 'Markdown must render discrepancy row');
    assert.ok(md.includes('记录后工作 (postRecord)'), 'Markdown must render postRecord row');
    assert.ok(md.includes('原生采集节奏与延迟分解差值 (Segment B - Segment A)'), 'Markdown must render native pacing deltas table');

    console.log('✓ Test 4 passed: Full end-to-end watcher -> analyzer pipeline verified with P3 metrics and markdown output.');
  }

  // =========================================================================
  // Test 5: Isolated Native Probe C# Binary Self-Test & Log Verification (R3)
  // =========================================================================
  console.log('--- Test 5: Isolated native probe C# binary self-test & execution ---');
  {
    const probeExe = join(repoRoot, '.tmp', 'p3-probe-build', 'WallpaperProbe.exe');
    assert.ok(await stat(probeExe), 'WallpaperProbe.exe must exist in .tmp/p3-probe-build');

    // 1. Run --parse-check self-test on isolated binary
    const checkArgsFile = join(testEvidenceDir, 'check-args.json');
    await writeFile(checkArgsFile, JSON.stringify(['0', 'C:\\temp\\dummy', '--forever', '30', 'pipe', '--owned-location', 'WhaleWallpaperProbe-p3-test']), 'utf8');
    const checkOutput = execFileSync(probeExe, ['--parse-check', checkArgsFile], { encoding: 'utf8' });
    const parsedCheck = JSON.parse(checkOutput.trim().split('\n').filter(l => l.startsWith('{')).pop());
    assert.equal(parsedCheck.ok, true);
    assert.equal(parsedCheck.ownedLocation, 'WhaleWallpaperProbe-p3-test');

    // 2. Run --self-test-lifecycle on isolated binary
    const lifecycleOutput = execFileSync(probeExe, ['--self-test-lifecycle'], { encoding: 'utf8' });
    assert.ok(lifecycleOutput.includes('"mismatches": 0'), 'Lifecycle self-test must pass with 0 mismatches');

    // 3. R3: Run --self-test-native-pacing to exercise actual C# tracker timing & wait calculation
    const pacingSelfTestDir = join(testEvidenceDir, 'probe-self-pacing');
    const probeStdout = execFileSync(probeExe, ['--self-test-native-pacing', pacingSelfTestDir], { encoding: 'utf8' });

    const selfTestParsed = JSON.parse(probeStdout.trim().split('\n').filter(l => l.startsWith('{')).pop());
    assert.equal(selfTestParsed.ok, true, 'Self-test must succeed');
    assert.equal(selfTestParsed.mismatches, 0, 'Self-test must have 0 mismatches');
    assert.equal(selfTestParsed.r1Checked, true, 'R1 delay truncation checks must pass');
    assert.equal(selfTestParsed.snapshotFields, 22, 'Snapshot fields must be 22');

    // Verify files generated by probe
    const probeStatusRaw = JSON.parse(await readFile(join(pacingSelfTestDir, 'status.json'), 'utf8'));
    const probeSummaryRaw = JSON.parse(await readFile(join(pacingSelfTestDir, 'summary.json'), 'utf8'));
    assert.ok(probeStatusRaw.pacing, 'status.json must contain pacing');
    assert.ok(probeSummaryRaw.pacing, 'summary.json must contain pacing');
    assert.equal(probeStatusRaw.pacing.pacingWaitRequestedSumMs, 10);
    assert.equal(probeStatusRaw.pacing.pacingWaitActualSumMs, 25);
    assert.equal(probeStatusRaw.pacing.postRecordSumMs, 20);
    assert.equal(probeStatusRaw.pacing.totalWorkSumMs, 35);
    assert.equal(probeStatusRaw.pacing.emptyRetryCount, 3);
    assert.equal(probeStatusRaw.pacing.emptyWaitActualSumMs, 15);

    // 4. Seam test: Pipe actual probe status output through real watcher sanitizer and analyzer
    const sanitizedStatus0 = sanitizeStatus({
      frames: 0, seconds: 0, width: 1280, height: 720, encodeMs: 0,
      pacing: {
        pacingWaitCount: 0, pacingWaitRequestedSumMs: 0, pacingWaitActualSumMs: 0,
        postRecordCount: 0, postRecordSumMs: 0, statusPublishCount: 0, statusPublishSumMs: 0,
        emptyRetryCount: 0, emptyWaitRequestedSumMs: 0, emptyWaitActualSumMs: 0,
        cycleIntervalCount: 0, cycleIntervalSumMs: 0, totalWorkCount: 0, totalWorkSumMs: 0,
      },
    });
    const sanitizedStatus1 = sanitizeStatus(probeStatusRaw);

    const client0 = { received: 0, rendered: 0, dropped: 0, seconds: 0, sourceSequence: 0, hidden: 0, decodeErrors: 0 };
    const client1 = { received: 1, rendered: 1, dropped: 0, seconds: 0.05, sourceSequence: 1, hidden: 0, decodeErrors: 0 };

    const seamObs = {
      schemaVersion: 1, state: 'synthetic', tool: 'native-pacing-seam-check', runDir: pacingSelfTestDir,
      session: { stable: true, childPid: 4444, location: 'WhaleWallpaperProbe-seam-test' },
      samples: [
        {
          sampleIndex: 0, elapsedMs: 0, utc: new Date(1700000000000).toISOString(),
          status: { readOk: true, duplicate: false, data: sanitizedStatus0 },
          previewStatus: { readOk: true, duplicate: false, data: { childPid: 4444, received: 0, seconds: 0, running: true, window: { location: 'WhaleWallpaperProbe-seam-test' }, client: client0 } },
        },
        {
          sampleIndex: 1, elapsedMs: 50, utc: new Date(1700000000050).toISOString(),
          status: { readOk: true, duplicate: false, data: sanitizedStatus1 },
          previewStatus: { readOk: true, duplicate: false, data: { childPid: 4444, received: 1, seconds: 0.05, running: true, window: { location: 'WhaleWallpaperProbe-seam-test' }, client: client1 } },
        },
      ],
      framesSnapshot: { records: [] },
    };

    const seamSegments = {
      schemaVersion: 1, state: 'synthetic', userNamedScene: 'Native pacing seam test',
      segments: [
        { id: 'S1', startIndex: 0, endIndex: 1, conditions: { userManualDshForeground: true, userManualMouseAction: 'stationary' } },
        { id: 'S2', startIndex: 0, endIndex: 1, conditions: { userManualDshForeground: true, userManualMouseAction: 'moving' } },
      ],
    };

    const seamObsPath = join(testEvidenceDir, 'seam-obs.json');
    const seamSegPath = join(testEvidenceDir, 'seam-seg.json');
    await writeFile(seamObsPath, JSON.stringify(seamObs, null, 2), 'utf8');
    await writeFile(seamSegPath, JSON.stringify(seamSegments, null, 2), 'utf8');

    const seamAnalysis = await analyzePlayback({ inputPath: seamObsPath, segmentsPath: seamSegPath, outputDir: join(testEvidenceDir, 'seam-analysis') });
    const seamPacing = seamAnalysis.analysis.segments[0].nativePacing;
    assert.equal(seamPacing.valid, true, 'Native pacing from real probe output must be valid');
    assert.equal(seamPacing.pacingWait.requestedMeanMs, 10, 'Requested wait mean must be 10ms');
    assert.equal(seamPacing.pacingWait.actualMeanMs, 25, 'Actual wait mean must be 25ms');
    assert.equal(seamPacing.pacingWait.discrepancyMeanMs, 15, 'Discrepancy mean must be 15ms');
    assert.equal(seamPacing.postRecord.meanMs, 20, 'PostRecord mean must be 20ms');
    assert.equal(seamPacing.emptyWait.actualMeanMs, 5, 'Empty wait actual mean must be 5ms');
    assert.equal(seamPacing.emptyWait.retryCount, 3, 'Empty retry count must be 3');

    // 5. Assets binary exact byte / SHA-256 preservation
    const assetsDll = join(repoRoot, 'dsh-whale-mist', 'assets', 'wallpaper', 'WallpaperProbe.dll');
    const tmpDll = join(repoRoot, '.tmp', 'p3-probe-build', 'WallpaperProbe.dll');
    const assetsBuffer = await readFile(assetsDll);
    const tmpBuffer = await readFile(tmpDll);
    const assetsSha256 = createHash('sha256').update(assetsBuffer).digest('hex').toUpperCase();
    const tmpSha256 = createHash('sha256').update(tmpBuffer).digest('hex').toUpperCase();

    const expectedAssetsSha256 = 'FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34';
    assert.equal(assetsSha256, expectedAssetsSha256, 'Assets production binary must match fixed rc.30 SHA256 baseline exactly');
    assert.notEqual(assetsSha256, tmpSha256, 'Assets production binary must not match isolated build hash');

    console.log('✓ Test 5 passed: Isolated C# WallpaperProbe binary builds, runs CLI self-tests, seam-verifies pacing to analysis, and assets SHA256 is preserved.');
  }

  console.log('\n======================================================');
  console.log('ALL P3 NATIVE PACING VERIFICATION CHECKS PASSED!');
  console.log('======================================================\n');
} finally {
  await rm(testEvidenceDir, { recursive: true, force: true }).catch(() => {});
}
