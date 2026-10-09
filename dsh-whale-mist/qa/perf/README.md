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

## Fixture schema

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
