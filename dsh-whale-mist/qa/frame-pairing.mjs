// Pairing screencast frames with in-page samples, across two different clocks.
//
// Three times describe a frame, and they must not be mixed:
//
//   - generated:  `metadata.timestamp`, seconds since the Unix epoch (the protocol defines it as
//                 `Network.TimeSinceEpoch`; the optional `monotonicTimestamp` is not present in this
//                 browser, so it is not assumed). Converted to the page's clock by subtracting the
//                 page's `performance.timeOrigin`.
//   - delivered:  when the frame arrived here. Epoch milliseconds from the host clock. It measures
//                 transport delay only and cannot tell when the frame was drawn.
//   - sampled:    `performance.now()` inside the page, with `performance.timeOrigin` giving its origin.
//
// An earlier version compared a page clock value against a host clock value, so every frame matched the
// last sample. This module keeps the bases apart, converts explicitly, and reports samples it cannot
// place as `unmatched` instead of stretching a tolerance until they fit.
//
// The pairing rules are exercised by `check-pairing.mjs` with hand-written sequences.

/**
 * Converts a screencast `metadata.timestamp` (epoch seconds) to the page's `performance.now()` base.
 */
export function epochSecondsToPageTime(timestampSeconds, timeOrigin) {
  return timestampSeconds * 1000 - timeOrigin;
}

/** Converts a screencast `metadata.timestamp` (epoch seconds) to epoch milliseconds. */
export function epochSecondsToEpochMs(timestampSeconds) {
  return timestampSeconds * 1000;
}

/**
 * Pairs frames with samples.
 *
 * @param frames  `[{ generatedPageTime, generatedAtEpochMs, deliveredAtEpochMs }]` — `generatedPageTime`
 *                converted to the page clock, `generatedAtEpochMs` the same instant on the epoch clock.
 *                Either may be null when the source did not provide it.
 * @param samples `[{ at, ... }]` — page-clock times (`performance.now()`), ascending.
 * @param toleranceMs how far apart frame and sample times may be, in the same clock.
 * @returns `{ pairs, unmatchedFrames, calibration, stats }`
 */
export function pairFramesWithSamples(frames, samples, toleranceMs = 50) {
  const ordered = [...samples].sort((a, b) => a.at - b.at);
  const pairs = [];
  const unmatchedFrames = [];

  // Calibration measures transport delay, so both ends must be on the epoch clock. Subtracting a page
  // clock value from an epoch value (an earlier mistake here) yields roughly `timeOrigin`, which says
  // nothing about the delay and hides frames that arrive early.
  const offsets = frames
    .map(frame => (Number.isFinite(frame.generatedAtEpochMs) && Number.isFinite(frame.deliveredAtEpochMs)
      ? frame.deliveredAtEpochMs - frame.generatedAtEpochMs
      : null))
    .filter(offset => offset !== null);
  const calibration = {
    measured: offsets.length,
    minOffsetMs: offsets.length ? Math.min(...offsets) : null,
    maxOffsetMs: offsets.length ? Math.max(...offsets) : null,
    // Delivery happens after generation; a clearly negative offset means the two ends are not on the
    // same clock, or the frame was reported before it could have been drawn.
    early: offsets.filter(offset => offset < -5).length,
  };

  for (const frame of frames) {
    if (!Number.isFinite(frame.generatedPageTime)) { unmatchedFrames.push({ frame, reason: "no-generated-time" }); continue; }
    let best = null;
    for (const sample of ordered) {
      const delta = Math.abs(sample.at - frame.generatedPageTime);
      if (delta <= toleranceMs && (best === null || delta < best.delta)) best = { sample, delta };
    }
    if (best === null) { unmatchedFrames.push({ frame, reason: "no-sample-within-tolerance" }); continue; }
    pairs.push({ frame, sample: best.sample, deltaMs: best.delta });
  }

  const scrollTops = [...new Set(pairs.map(pair => pair.sample.scrollTop))];
  return {
    pairs,
    unmatchedFrames,
    calibration,
    stats: {
      frames: frames.length,
      samples: ordered.length,
      matched: pairs.length,
      unmatched: unmatchedFrames.length,
      meanDeltaMs: pairs.length ? Number((pairs.reduce((sum, pair) => sum + pair.deltaMs, 0) / pairs.length).toFixed(2)) : null,
      maxDeltaMs: pairs.length ? Number(Math.max(...pairs.map(pair => pair.deltaMs)).toFixed(2)) : null,
      distinctScrollTops: scrollTops.length,
      scrollTops: scrollTops.slice(0, 12),
    },
  };
}
