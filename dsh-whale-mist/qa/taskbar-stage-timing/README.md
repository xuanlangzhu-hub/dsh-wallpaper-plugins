# Taskbar stage timing (isolated M1 diagnostics)

This recipe starts from the pinned rc.39 native inputs, retains the accepted rc.54 factory delay change, and adds diagnostic-only stage observations. It never edits the shared native tree, installed assets, Profile, or candidate archives.

```powershell
python dsh-whale-mist/qa/taskbar-stage-timing/check.py --output .tmp/taskbar-stage-timing-NEW-ROUND
```

Use a new output directory. The controller has a 180-second total deadline, per-stage bounds, owned-child termination on timeout, exit evidence, and retained stdout/stderr. It compiles an isolated full native project but never runs that application's entry point. Two separate pure harnesses exercise real monitor/COM-call/strategy logic with process and native IO substitutes, plus the previous first-frame/runtime regressions. The child entry's parent/named-event gate and real Start/Job wiring are checked structurally, not executed against Windows processes.

`prepare.py` verifies all original input hashes, applies exact replacements, preserves untouched files byte for byte, and writes `native.patch` plus `source-receipt.json`. Only Program, TaskbarHideRuntime, TaskbarHideStrategy, TaskbarWorker, and TaskbarList change relative to rc.54; TaskbarTiming is new. The full build's apphost/deps/PDB are **not approved installation replacements**.

The optional artifacts are `taskbar-parent-timing.json` (capture-side role `capture-parent`) and `taskbar-worker-timing.json` (role `shell-worker`). Their `purpose` explicitly denies termination-proof status. No reader or cleanup fence consumes them. Each has a process-specific clock/origin, target location/HWND/PID/start timestamp, bounded events, and nullable elapsed/UTC values. Compute durations only within one valid clock and between two stages actually present. Do not substitute zero for missing stages, subtract elapsed values from different processes, or infer visual taskbar disappearance from a call/exit timestamp.

Worker data buffers before authorization, and its file is writable only after the original parent-supervision gate succeeds. A sidecar may be missing after early rejection or abrupt exit. Files are created once without overwriting, directory creation, retries, or stdout output. Ordinary timing/sink failures are contained; the existing action result, HRESULT, timeout, stop/identity gates, and cleanup evidence remain authoritative.

Final reviewed offline evidence: `.tmp/taskbar-stage-timing-20261029-b/`. The earlier `-a` run is retained but has unwanted line-ending changes and is not the accepted patch. Scope and limitations: [M1 report](../../../docs/TASKBAR_STAGE_TIMING_OFFLINE_REPAIR_20261029.md).
