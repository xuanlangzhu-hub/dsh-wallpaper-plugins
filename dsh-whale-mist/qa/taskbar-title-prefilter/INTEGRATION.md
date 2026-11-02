# Fixed rc55 payload preflight

```powershell
F:/Python/Python314/python.exe -X utf8 dsh-whale-mist/qa/taskbar-title-prefilter/preflight.py --output .tmp/taskbar-title-integration-NEW-UNIQUE-ROUND
```

Offline only. It stages43 pinned rc55 files and replaces only WallpaperProbe.dll from the accepted prefilter build. Old apphost/deps/runtimeconfig and8 dependency DLLs remain byte-identical. No full native rebuild, package creation, application entry execution, real process/window queries, worker, COM, capture, installation or Profile change.

`integration-inputs.json` pins reused metadata/protocol/Host templates. `integration-metadata-allowlist.json` pins both DLLs and exactly two normalized IL body changes, with no definition/signature changes. `--inventory-only` explicitly is not acceptance; inspect differences before setting an allowlist.

The protocol harness links frozen source with its existing IO substitutes. Host imports exact staged JS; process/query/command dependencies are injected.19 additional strict proof cases exercise identity and termination facts. They supplement11 Host protocol and6 diagnostic-sidecar cases. Actual Host argv is sent back to the native parser. Frame bytes test parsing only, not displayed images.

120-second parent deadline, bounded child phases, retained exit/stdout/stderr. Node output is explicitly TAP; no unbounded waits. Fresh output directory required. Final evidence `.tmp/taskbar-title-integration-20261029-c/`:14 native checks,36 fixed Host checks,3 argv round trips;6 child phases exit0. `a` is inventory-only. `b` retained a reporter-format assertion failure even though all36 tests passed; `c` pins TAP and passes the full pipeline.

This source patch retains the repeated title read after process lookup, all3 fresh scans, PID/start revalidation, first-published-frame trigger, async one-shot worker, stop and terminal proof. Do not cache identity, prewarm a worker or change owner/TOOLWINDOW/SW_HIDE.

See [integration report](../../../docs/TASKBAR_TITLE_PREFILTER_INTEGRATION_PREFLIGHT_20261029.md). The plan is permission for no live action; a later candidate needs distinct version/README metadata, and a real trial needs fresh user convenience confirmation and backups.
