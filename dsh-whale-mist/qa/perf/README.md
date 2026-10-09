# Performance phase sampler

Requires Windows PowerShell **7+** (`pwsh`) and Node.js for the synthetic checker.
The sampler never starts/stops a process, changes Wallpaper Engine settings or edits a Profile.
It reads only explicitly selected processes and counters, then creates one new JSON output.
An existing output is refused using atomic `FileMode.CreateNew`.

## Synthetic regression

From `dsh-whale-mist`:

```powershell
node qa/perf/check-sampler.mjs
```

This replaces process identity, CPU, hardware capacity, GPU and adapter providers with fixtures.
It also tests the actual real-provider wrapper with a mocked `Get-Counter`, including partial errors.
It does not query live counters or open applications. Fixtures, reports and results are retained under
`dsh-whale-mist/.tmp/perf/sampler-check-<unique>/`; set `WM_PERF_TEST_ROOT` to choose a different evidence root.

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
