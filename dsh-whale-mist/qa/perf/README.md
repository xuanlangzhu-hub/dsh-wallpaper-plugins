# Performance phase sampler

Requires Windows PowerShell **7+** (`pwsh`) and Node.js for the synthetic checkers.
The sampler never starts/stops a process, changes Wallpaper Engine settings or edits a Profile.
It reads only explicitly selected processes and counters, then creates one new JSON output.
An existing output is refused using atomic `FileMode.CreateNew`.

## Offline phase comparison

`compare-phases.mjs` turns a phase manifest plus the sampler reports it names into a comparison report.
It is offline: the only inputs are JSON files, and the only output is a new directory. It starts nothing,
queries no counter, opens no window and touches nothing it was not given.

```powershell
node qa/perf/compare-phases.mjs --manifest <manifest.json> --output <new-directory>
```

- The manifest must be `schemaVersion: 1`, `state` `real` or `synthetic`, with phases exactly
  `A0, B, C, D, A1` and each phase `state: "measured"`. A `template` manifest is refused.
- `samplerReport` paths resolve relative to the manifest's own directory.
- Output: `comparison.json` and `comparison.md` in a directory that must not exist yet, written with
  `wx`. Nothing is cleared, overwritten or deleted; an existing directory is refused and left untouched.
- Exit codes: `0` a report was written (the report itself says whether the data sufficed); `2` the
  invocation was wrong; `3` the input was rejected and **no** report was written. A rejected input never
  produces a report that looks finished. "A report was written" and "the data is sufficient to compare"
  are deliberately different statements, so a legitimate-but-insufficient run exits `0` while its report
  carries `dataReady=false`.

The report separates two statements that must not be merged into one verdict: `status.reportWritten`
says a report exists, and `status.dataReady` / `status.inconclusive` say whether the data supports a
comparison. Legitimate but insufficient data (an unresolved required role, coverage below the manifest
minimum, a differing or unevidenced condition, or a pair whose run conditions do not match) still
produces a report with `dataReady=false` and the reasons listed. Broken input (bad JSON, wrong schema or
phase order, a report whose `phase` names a different phase, a bad measurement window, a target set that
does not match, a non-finite value, a negative interval) is rejected instead.

What it computes, per phase and per PID: CPU rebuilt from the raw intervals as total delta over total
valid time, reported in percentage points of the machine's logical capacity (never copied from the
sampler's summary); working-set and private-byte means; the four GPU memory metrics per adapter LUID
with their observation counts; and per LUID + engine type the observation mean, the observed maximum and
the instance names. Differences are produced only when the pair is comparable at all and the specific
metric has enough coverage on both sides.

Comparability is decided in two layers, and a blocked row keeps its raw values with a reason:

- **Pair gates**: identity conclusive in both phases, the report target set matching the manifest, the
  same logical processor capacity, the same capture frame size when both phases recorded one, the same
  adapter set, and every condition field evidenced in both phases and equal to the manifest's fixed value.
  A pair that fails a gate yields no difference for any of its processes, and the pair appears in
  `status.reasons`.
- **GPU-only gates**: the adapter set and the phase-internal topology check block GPU rows only; CPU and
  RAM differences are unaffected, and a per-metric row decides for itself, so one sparse or missing
  LUID/metric or engine key leaves only its own row null.
- **Per PID and per metric**: CPU needs `minimumCoverage.cpuIntervals`/`cpuValidSeconds` for that PID in
  both phases, working set and private bytes need `metricObservations`, and each GPU memory metric per
  LUID and each engine key needs `metricObservations`. A metric the phase never observed is absent rather
  than sparse, so it does not block, and a sparse PID does not suppress a well-covered one.

Reference pairs are included in both directions: `A0->B`, `B->A0`, `B->C`, `C->D`, `D->A1`, `A1->D`,
`A0->A1`, `B->A1`, `D->A0`, `B->A0`, `D->A1`. A negative difference is kept as measured, and a process
that exists in only one phase is listed as new or disappeared rather than given a fabricated zero.

## Synthetic regression

Condition objects compare by values, independent of JSON member ordering (including nested objects).
Array order and value types remain significant. This avoids false condition drift when PowerShell
and Node serialize the same viewport with different key ordering; real differences still block pairs.

From `dsh-whale-mist`:

```powershell
node qa/perf/check-sampler.mjs
node qa/perf/check-compare.mjs
```

`check-sampler.mjs` replaces process identity, CPU, hardware capacity, GPU and adapter providers with
fixtures. It also tests the actual real-provider wrapper with a mocked `Get-Counter`, including partial
errors. It does not query live counters or open applications. Fixtures, reports and results are retained
under `dsh-whale-mist/.tmp/perf/sampler-check-<unique>/`; set `WM_PERF_TEST_ROOT` to choose a different
evidence root.

`check-compare.mjs` builds its own manifests and sampler reports for the comparison tool and asserts on
concrete numbers and status flags, including the negative cases (template manifest, broken JSON, wrong
phase order, an existing output directory with a sentinel file). Evidence is written to
`dsh-whale-mist/.tmp/perf/compare-check-<unique>/`; failed cases keep their inputs and outputs.

## Real sampling, when the phase is authorized

Use fresh PIDs from the current phase manifest and a new output name; the following is an example only:

```powershell
& ./qa/perf/sample-phase.ps1 -Phase 'B-source' -Output 'F:/evidence/B-source-unique.json' `
  -ProcessIds @(12345, 12346) -Seconds 45 -IntervalMs 1000 -RediscoverEvery 12
```

The output parent must already exist. Do not carry these example PIDs into an actual run.
`NameFilter` resolves initial targets only; neither it nor rediscovery automatically follows newly created
Node/renderer processes. Supply the full phase target set explicitly. StartTime is the identity boundary;
unreadable or changed identities are excluded, including GPU values returned after a blocking query.
CPU read before an identity change may remain valid, but `summary.identityStable=false` prevents interpreting
the phase as an unchanged target set.

`Seconds` is a wall-clock budget checked between samples, not an exact deadline or sample-count promise.
Counter discovery, per-process checks and GPU/adapter reads cost time and can overrun the deadline.
Recorded CPU and GPU read intervals are sequential, not one synchronized frame.
`gpuReadings` retains accepted path, instance, status, value and provider timestamp when available.
CPU percent is normalized to all logical processors; its segment summary uses total delta / total time.
Memory summaries are arithmetic means of valid observations per LUID and metric, with sample counts;
they are gauges, not bytes summed over time, and are not time-weighted means.

Inspect CPU/GPU availability separately. True zero is valid idle data; unknown values remain null.
Engine summaries use explicitly named maxima, not a whole-GPU percentage. Adapter topology changes split
segments; failed/empty snapshots create unknown segments, not an assumed adapter removal.
Inspect `knownTopologySamples`, `unknownTopologySamples`, segment sizes, counter errors and identity changes
before comparing phases. No power/clock data is synthesized, and valid CPU alone does not prove GPU coverage.

## Supervised mode/device diagnostic

`node qa/perf/check-mode-device.mjs` checks the controller with simulated child processes and native calls;
it does not open real windows. After the user confirms convenience, from the repository root use
`node dsh-whale-mist/qa/perf/probe-mode-device.mjs --run --output <new-directory>`.
The output parent must exist; an existing output directory is refused. It creates one uniquely named Lucy
source and captures memory/pipe/pipe/memory for eight seconds each, with fixed helper fingerprints and
one controller environment/cwd/stdio layout. Each trial keeps stdin open and drains stdout.
Write a `STOP` file inside the output directory or interrupt the controller to cancel. Native Esc can
end a trial early; early exit stops the sequence. Cleanup targets only the owned source name/expected PID.
Inspect report.json and cleanup.closed; a device match is not a performance or formal Host acceptance.
The real V1 result and startup limitation are recorded in `docs/CAPTURE_MODE_V1_20261010.md` at repo root.

## Sampler fixture schema

Explicit-adapter QA uses a separately generated native helper, never the accepted packaged binary.
See `docs/EXPLICIT_ADAPTER_QA_20261010.md` at repo root. `check-adapter-trial.mjs` checks the LUID argv and
bounded first/last frame evidence with fake processes. Native build/option/device checks live in
`qa/adapter-probe`; device creation without a window does not prove capture compatibility.
`probe-adapter-device.mjs --prepare --root <new-dir> --build <new-qa-build>` creates the local package;
actual `--run --root <prepared-dir>` requires the installed real-Host QA plugin and user coordination.

The supervised real-Host context diagnostic is separate: see
`docs/CAPTURE_CONTEXT_PLAN_20261010.md` at repo root. From repo root,
`node dsh-whale-mist/qa/perf/check-context-device.mjs` exercises file tickets and lifecycle with
mock providers only. `probe-context-device.mjs --prepare --root <new-directory>` prepares a local QA
package without starting windows. Actual `--run` requires the explicitly installed official Host QA
plugin and a separate user convenience check. It borrows one controller-owned source and never changes
the daily appearance plugin. Missing Host completion leaves cleanup unconfirmed rather than closing
a potentially active borrowed source.

`WM_PERF_FIXTURE` points to a read-only JSON file. It must declare a positive `logicalProcessors`,
`targets`, and `frames`. Each target/state contains `pid`, `name`, `startTime`, `path`, `cpuSeconds`,
`workingSetBytes`, `privateBytes`, `threads`, `handles`, and optionally `alive=false`.
Each frame contains an increasing `atSeconds` (relative to a deterministic warm-up timestamp), a
`processes` array and `samples` entries with `instanceName`, full counter `path`, `value`, `status`
and optional `providerTimestamp`. The checker contains concrete examples.

Frame fault controls: `counterUnavailable`, `adapterUnavailable`, `counterError`, `injectForeign`,
and `afterGpuProcesses` (process identities after GPU query). The fixture supplies all frames immediately;
it does not sleep or obey the real wall-clock duration. Use only this documented schema, not earlier
counter-only fixtures that still depended on live OS processes.

## Playback performance observation & offline analysis (P1)

Read-only, non-intrusive playback observation and offline segment analysis for investigating complex
wallpaper scenarios (such as "Three-Body problem - SYKM").

These tools never start or stop processes, query CPU/GPU performance counters, open or inspect windows,
or modify settings. They consume and analyze already-written runtime logs (`status.json`,
`preview-status.json`, `frames.jsonl`).

### 1. Read-only sampler: `watch-playback.mjs`

Polls an active or specified playback run directory periodically and records periodic samples into a
self-contained observation archive.

```powershell
node qa/perf/watch-playback.mjs --run-dir <run-dir> --output <new-directory> [--seconds 90] [--interval-ms 1000] [--state real|synthetic]
```

- **Safety & isolation**: The output directory must not exist yet (refused via atomic `mkdir`); existing files
  are never overwritten. It stops cleanly if a `STOP` sentinel file is created inside `<new-directory>` or
  on `SIGINT` (Ctrl-C). Stopping the sampler never interrupts the wallpaper or helper processes.
- **Data captured**: Monotonic `elapsedMs`, UTC timestamp, read duration, file `mtime` changes, raw `status.json`
  and `preview-status.json` payloads, and ring snapshots of `frames.jsonl`.
- **Field preservation**: Missing fields remain `null`/unknown; values are never synthesized or fabricated.
  Distinguishes fresh true-zero frame increments from duplicate reads of unchanged files.
- **Output**: Writes `observation.json` and preserves snapshots in `raw/`.

### 2. Offline segment analyzer: `analyze-playback.mjs`

Analyzes specified observation periods (e.g., foreground idle vs. foreground mouse moving) and computes
delivery throughput, stage timing distributions, and strictly adjacent frame intervals.

```powershell
node qa/perf/analyze-playback.mjs --input <observation.json|dir> --segments <segments.json> --output <new-directory>
```

- **Segments manifest** (`segments.json`): Requires `schemaVersion: 1`, `userNamedScene`, and an array of
  segments defining `startElapsedMs`/`endElapsedMs` (or `startIndex`/`endIndex`) and manual context annotations
  (`userManualDshForeground`, `userManualMouseAction`).
- **Core metrics & boundaries**:
  - **Native delivery/processing rate**: Computed from frame delta over native seconds delta in that segment.
    Explicitly represents delivery throughput to Host, *not* Wallpaper Engine source rendering FPS.
  - **Host received rate**: Host received frame delta over effective duration.
  - **Client decode-ready & canvas draw rate**: Computed from `client.rendered` delta over `client.seconds` delta (`renderRateFps`)
    and `client.drawCount` delta over `client.seconds` delta (`drawRateFps`). Strictly guarded: if `client.hidden === 1` in any
    sample in the segment, or if client data is missing or stale, rates are reported as `null` with a clear explanation
    (`client_hidden` / `client_stale`).
    Notice: `rendered` is the count of frames that successfully finished decoding and were delivered to subscribers (prior to
    `paintWallpaper`); it does *not* represent canvas `drawImage` completion or DWM physical compositor presentation.
  - **Frontend Stage Timing Breakdown (P2)**: When client stage metrics are available:
    - *Wait Callback*: Measures duration from paint scheduling to callback execution, separating `waitRaf` vs `waitTimeout`,
      and recording `waitCancelledCount`.
    - *Decode*: Measures `createImageBitmap` duration for `decodeSuccess` and `decodeFail`, separating post-decode discards
      (`discardHiddenCount` and `discardStaleCount`).
    - *Sync Processing*: Measures synchronous notification duration (`syncCount`, `syncSumMs`, `syncMeanMs`) and subscriber
      exceptions (`syncErrorCount`). Subscriber exceptions are strictly decoupled and never pollute `decodeFailCount` or `decodeErrors`.
    - *Canvas Draw*: Measures `CanvasRenderingContext2D.drawImage` duration (`drawCount`, `drawSumMs`, `drawMeanMs`) and draw
      exceptions (`drawErrorCount`). Missing canvas, missing layer, or stopped state guards return early without incrementing `drawCount`.
    - *Dropped Overwrite Breakdown*: Quantifies overwrite state at the instant a new frame replaces `latest` in `accept`:
      `dropWaitingCallbackCount` (waiting for RAF/timeout), `dropDecodingCount` (during decode), `dropSyncCount` (during sync
      processing), and `dropOtherCount`. Verified to sum strictly to `client.dropped` delta.
    - *Cumulative Max & Mean Constraints*: Stage means are computed as `sumDelta / countDelta`. If `countDelta === 0`, mean is
      strictly `null` (unknown), never synthesized as 0. Cumulative max values (`cumulative*MaxMs`) are lifetime run values and
      must never masquerade as segment max or P95.
  - **Timing distributions**: Computes mean, P50, P95, and max for `acquireMs`, `readbackMs`, `jpegMs`,
    `packHashMs`, `pipeMs`, and `encodeMs`. Explains the hierarchy: `encodeMs` already subsumes `readbackMs`
    and `jpegMs`; they must not be added together into a false total.
  - **Strictly adjacent frame intervals**: Only consecutive frame sequence numbers (`curr.frames === prev.frames + 1`)
    are used for interval statistics. Sparse ring buffer samples (e.g. 1 -> 2 -> 30) are *never* counted as
    dropped frames or long pauses.
  - **Latency reference**: Client cumulative `meanLatencyMs` and `maxLatencyMs` are reported as lifetime baselines,
    never claimed as segment P95 or end-to-end mouse response latency.
  - **Comparability gates**: Diffing between segments is only permitted when both segments belong to the same
    stable session (`runDir`, `childPid`, `location`), share identical dimensions (`width` x `height`) throughout
    both segments, have valid non-rollback counters, satisfy declared DSH foreground requirements, match on
    all declared fixed conditions (except the predetermined independent variable `userManualMouseAction`), and have
    adequate client progress (client seconds delta covers at least 50% of the observer phase duration; scant progress
    like 10ms over 20s leaves `dataReady=false` and `comparable=false`).
    If client throughput is unavailable, hidden, or reset, foreground comparison is blocked and `dataReady` is `false`.
    Otherwise, `diff` is `null` with explicit blocked reasons.
  - **Deduplication strictly enforced**: Timing sample breakdown strictly uses non-duplicate status samples, never
    falling back to duplicate rereads even when only 1 unique status is observed in the segment.
  - **Input validation & rejection**: Unreasonable or corrupt inputs (negative observer time, negative relative
    native or client clocks, non-finite segment bounds, non-finite counters, or conflicting timestamps for the same
    frame sequence) are strictly rejected with exit code `3` and produce no analysis report.
  - **Source classification**: The `state` (`real` vs `synthetic`) is strictly propagated from observation/manifest
    to `analysis.json` and highlighted prominently in `analysis.md`.
- **Output**: Writes `analysis.json` and human-readable `analysis.md` in `<new-directory>`. Exits `0` if a
  report was produced (even if `dataReady = false`), `2` on bad invocation, and `3` on rejected/broken input.

### 3. Synthetic verification suites

```powershell
node qa/perf/check-playback.mjs
node qa/perf/check-frontend-stages.mjs
```

`check-playback.mjs` verifies all calculations, boundaries, CLI executions, and edge cases across:
- The 6 original mandatory test categories (normal two-segment flow, client hidden/stale/0-increment guards, sparse sequences, session/dimension comparability gates, timing hierarchy/latency truthfulness, robustness/sentinel/existing dir).
- The complete 12-case R1–R4 review regression suite (hidden background, missing client counts, interior client/native reset, interior size change, changed manual conditions, missing preview reports, negative observer time, conflicting frame records, non-finite segment bound, watch-duration limit).
- The complete 8-case F1–F4 second review regression suite (`unknown-manual-foreground`, `unknown-client-visibility`, `unknown-run-identity`, `missing-client-clock`, `missing-native-clock`, `nonfinite-client-count`, `sparse-disjoint-frame-coverage`, `multi-sample-duration`).
- The complete Third Review G1–G3 regression suite (`scant-client-progress`, `duplicate-only-one-unique-status`, `negative-client-relative-clock`, `negative-native-relative-clock`, `true-zero-with-progressing-client-clock`, `export-parameter-validation`, `stop-after-multiple-samples`).

`check-frontend-stages.mjs` verifies P2 frontend stage timing and error decoupling across 8 suites:
1. Stage delays & monotonic timing (Wait callback, Decode, Sync notification, Canvas Draw).
2. RAF vs Timeout backstop race & schedule cancellation.
3. Overwrite (dropped) classification (waiting callback vs decoding vs sync vs other, summing to `dropped`).
4. Post-decode discards (hidden page discard vs stale generation discard).
5. Error decoupling & canvas guards (decode fail vs subscriber error vs draw error vs missing canvas).
6. Run generation isolation & metric resets.
7. Client snapshot payload size (< 2048 bytes; ~654 bytes measured) & Host route `/whale-wallpaper/metrics` filtering.
8. Observer (`watch-playback.mjs`) & Analyzer (`analyze-playback.mjs`) end-to-end seam.

All tests run completely offline using deterministic fixtures without invoking real helper processes or accessing hardware counters.
