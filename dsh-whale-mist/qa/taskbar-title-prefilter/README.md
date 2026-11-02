# Taskbar title prefilter: offline-only

Pinned M1 source: `baseline.json` (19 inputs). `prepare.py` copies only those inputs into a new `.tmp` tree and adds two four-line title prefilters in `SourceWindowHelper.cs`. The original process/title/Inspect checks stay in place. No production test seam, new dependency, signature, version or asset change.

From `F:\dsh-wallpaper-plugins`:

```powershell
F:/Python/Python314/python.exe -X utf8 dsh-whale-mist/qa/taskbar-title-prefilter/check.py --output .tmp/taskbar-title-prefilter-new-unique-round
```

Output must be new; old evidence is never overwritten. Total child deadline210s, build40/45s and replay15s. Only owned child PIDs are terminated on timeout; exit status and both streams are retained. Builds disable shared build servers. The full native application is compiled, never executed.

`io_transform.py` creates QA-only copies of the two real source files. It replaces every DllImport with fixture reads or a throwing sentinel, and aliases Process to `FixtureProcess`. No algorithm, enumeration body, title comparison or identity verification is replaced. The assertions include calls through the ShowWindow and CreateProcess sentinels; those calls throw in managed QA code and cannot operate Windows.

`Program.cs` runs real FindProbeWindows, RequireUniqueProbeWindow, VerifyExpectedWindow and RealWindowProbe.Inspect. Stable random observations, race refusals, fresh process start and cleanup rejection paths are compared. Enumeration/process/title call counts measure work only. Existing M1 and first-frame replays retain their original bottom IO substitutes.

Accepted output: `.tmp/taskbar-title-prefilter-20261029-c/`:

- red38 checks, exactly3 expected optimization failures (exit1); green38/38 (exit0).
- 301 stable serialized observations equal, from150 random inventories plus an initial full snapshot.
- 70 M1 and41 first-frame checks pass; all four harness builds and full native build0 warnings/errors.
- 120 unrelated windows: full probe process-object reads368→8, ProcessName367→7, title reads366→369; all3 enumerations remain.
- Only SourceWindowHelper.cs differs;18 inputs,361 protected inputs and rc.53/54/55 archives unchanged.

`a` retains the fixture nullable-callback counter error. `b` passes the earlier37-check version. `c` replaces a vacuous counter check with the two throwing-sentinel assertions; production patch unchanged.

Limits: stable-input equality is not arbitrary race equivalence. A newly matching title may wait until the next enumeration. Inherited scan-exception/absent semantics are unchanged, not proven universally safe. No real process/window enumeration, worker, COM, capture, cleanup, visual timing or installation is exercised. Next step is fixed-payload integration preflight, not automatic adoption.

Report: [TASKBAR_TITLE_PREFILTER_OFFLINE_REPAIR_20261029.md](../../../docs/TASKBAR_TITLE_PREFILTER_OFFLINE_REPAIR_20261029.md).
