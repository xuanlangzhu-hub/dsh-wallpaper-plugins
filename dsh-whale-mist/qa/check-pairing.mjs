// Hand-written sequences for the frame-pairing rules. No browser involved.
//
// The sequence the third review used is included first: four samples with page-clock times, and three
// frames stamped with host-clock arrival times. The old comparison mapped all three frames to the last
// sample; the corrected pairing must place them where they belong and must not silently stretch its
// tolerance.
import assert from 'node:assert/strict';
import { pairFramesWithSamples, epochSecondsToPageTime } from './frame-pairing.mjs';

const checks = [];
const check = (label, fn) => {
  try { fn(); checks.push({ label, ok: true }); }
  catch (error) { checks.push({ label, ok: false, error: error.message }); }
};

// 1. The review's sequence: page-clock samples, host-clock arrivals. The old code compared these
//    directly, so every frame matched the last sample (time 400, scrollTop 0).
check('review sequence is placed by page clock, not host clock', () => {
  const samples = [
    { at: 100, scrollTop: 0 },
    { at: 200, scrollTop: 160 },
    { at: 300, scrollTop: 320 },
    { at: 400, scrollTop: 0 },
  ];
  const timeOrigin = 1791455772931.4;
  // Frames generated at page times 160, 260 (already delivered), expressed as epoch seconds.
  const frames = [
    { generatedPageTime: epochSecondsToPageTime((timeOrigin + 160) / 1000, timeOrigin), deliveredAtEpochMs: timeOrigin + 172 },
    { generatedPageTime: epochSecondsToPageTime((timeOrigin + 260) / 1000, timeOrigin), deliveredAtEpochMs: timeOrigin + 271 },
    { generatedPageTime: epochSecondsToPageTime((timeOrigin + 300) / 1000, timeOrigin), deliveredAtEpochMs: timeOrigin + 312 },
  ];
  const result = pairFramesWithSamples(frames, samples, 50);
  assert.equal(result.stats.matched, 3, `expected three matches, got ${JSON.stringify(result.stats)}`);
  const scrollTops = result.pairs.map(pair => pair.sample.scrollTop);
  assert.deepEqual(scrollTops, [160, 320, 320], `frames landed on ${JSON.stringify(scrollTops)}`);
  assert.ok(!scrollTops.every(value => value === 0), 'frames must not all land on the last sample');
  assert.ok(result.stats.distinctScrollTops >= 2, 'matched samples must cover more than one scroll position');
});

// 2. The same sequence with host-clock values passed where page-clock values belong: the frames must
//    be reported as unmatched, not squeezed onto a sample.
check('host-clock values are reported unmatched instead of forced onto a sample', () => {
  const samples = [{ at: 100, scrollTop: 0 }, { at: 400, scrollTop: 0 }];
  const frames = [{ generatedPageTime: 1791455773100, deliveredAtEpochMs: 1791455773106 }];
  const result = pairFramesWithSamples(frames, samples, 50);
  assert.equal(result.stats.matched, 0, 'a frame from another clock must not match');
  assert.equal(result.unmatchedFrames.length, 1);
  assert.equal(result.unmatchedFrames[0].reason, 'no-sample-within-tolerance');
});

// 3. A missing generated time is unmatched, with its own reason.
check('a frame without a generated time is unmatched', () => {
  const result = pairFramesWithSamples([{ generatedPageTime: null, deliveredAtEpochMs: 123 }], [{ at: 100, scrollTop: 5 }], 50);
  assert.equal(result.stats.matched, 0);
  assert.equal(result.unmatchedFrames[0].reason, 'no-generated-time');
});

// 4. Tolerance is respected on both sides: just inside matches, just outside does not.
check('tolerance is applied on both sides', () => {
  const samples = [{ at: 1000, scrollTop: 7 }];
  const inside = pairFramesWithSamples([{ generatedPageTime: 1050, deliveredAtEpochMs: 2000 }], samples, 50);
  const outside = pairFramesWithSamples([{ generatedPageTime: 1051, deliveredAtEpochMs: 2000 }], samples, 50);
  assert.equal(inside.stats.matched, 1);
  assert.equal(outside.stats.matched, 0);
});

// 5. A frame generated after the last sample but within tolerance still matches the nearest one, and
//    the reported delta says how far off it was.
check('the nearest sample wins and the delta is reported', () => {
  const samples = [{ at: 100, scrollTop: 1 }, { at: 140, scrollTop: 2 }, { at: 180, scrollTop: 3 }];
  const result = pairFramesWithSamples([{ generatedPageTime: 145, deliveredAtEpochMs: 1e12 }], samples, 50);
  assert.equal(result.pairs[0].sample.scrollTop, 2);
  assert.equal(result.pairs[0].deltaMs, 5);
  assert.equal(result.stats.meanDeltaMs, 5);
});

// 6. Calibration measures transport delay on the epoch clock and flags frames that arrive early.
check('calibration measures delay between two epoch values', () => {
  const generatedAtEpochMs = 1791455773641.2;
  const deliveredAtEpochMs = 1791455773647.0;
  const good = pairFramesWithSamples([{ generatedPageTime: 709.8, generatedAtEpochMs, deliveredAtEpochMs }], [{ at: 710, scrollTop: 0 }], 50);
  assert.equal(good.calibration.measured, 1);
  assert.ok(Math.abs(good.calibration.minOffsetMs - 5.8) < 0.001,
    `a normal delivery must read as a few milliseconds, got ${good.calibration.minOffsetMs}`);
  assert.equal(good.calibration.early, 0);
  const early = pairFramesWithSamples([{ generatedPageTime: 709.8, generatedAtEpochMs, deliveredAtEpochMs: generatedAtEpochMs - 20 }], [{ at: 710, scrollTop: 0 }], 50);
  assert.equal(early.calibration.early, 1, 'an early delivery must be flagged');
  assert.ok(Math.abs(early.calibration.minOffsetMs + 20) < 0.001, `got ${early.calibration.minOffsetMs}`);
  // Mixing the clocks must not be possible to mistake for a real delay.
  const mixed = pairFramesWithSamples([{ generatedPageTime: 709.8, generatedAtEpochMs: null, deliveredAtEpochMs }], [{ at: 710, scrollTop: 0 }], 50);
  assert.equal(mixed.calibration.measured, 0, 'without the epoch generation time there is nothing to measure');
});

// 7. Epoch seconds convert to the page clock with the page's own origin.
check('epoch seconds convert against performance.timeOrigin', () => {
  const timeOrigin = 1791455772931.4;
  const pageTime = epochSecondsToPageTime(1791455773.641202, timeOrigin);
  assert.ok(Math.abs(pageTime - 709.802) < 0.01, `got ${pageTime}`);
});

// 8. Duplicate frames (the same generated time twice) do not multiply the sample count.
check('duplicate generated times pair to the same sample once each', () => {
  const samples = [{ at: 100, scrollTop: 4 }];
  const result = pairFramesWithSamples([
    { generatedPageTime: 100, deliveredAtEpochMs: 1 },
    { generatedPageTime: 100, deliveredAtEpochMs: 2 },
  ], samples, 50);
  assert.equal(result.stats.frames, 2);
  assert.equal(result.stats.matched, 2);
  assert.equal(result.stats.distinctScrollTops, 1);
});

const failed = checks.filter(entry => !entry.ok);
for (const entry of checks) console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.label}${entry.ok ? '' : ' :: ' + entry.error}`);
console.log(`pairing checks: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) { console.log(JSON.stringify(failed, null, 1)); process.exitCode = 1; }
