# rc.55 local stage-timing diagnosis candidate

Fixed payload: accepted rc.54 + reviewed M1 timing DLL. Only the DLL, candidate version and README prefix change. This is not a public release or a daily upgrade; the default trial restoration is rc.53.

```powershell
python release-sources/rc55/build-candidate.py --output .tmp/rc55-candidate-NEW-ROUND
```

The recipe verifies the fixed archive, preflight, DLL, dependencies and protected inputs, builds deterministic tar/gzip, and rereads the actual archive. It never invokes npm, package scripts, a native build, DSH or WE. The original apphost/deps/runtimeconfig and all 23 JS files remain unchanged.

Current candidate: `.tmp/rc55-taskbar-stage-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.55.tgz`, SHA256 `0D93C59FF1D5E408C3763439A8197CC69F8054CC23064FDDC6A0B3FB6D60FC29`, 7,265,382 bytes / 43 files. The independent a/b archives match byte for byte. package-manifest.json and candidate.json pin the package; neither is a live installation authorization.

`prepare-trial.py` has already prepared `.tmp/rc55-taskbar-stage-short-trial-20261029-a/`. Do not rerun it into that directory. It copies only 36 pinned templates, adapts the new root/purpose/candidate references while retaining rc.53 rollback, and adds one guarded evidence collector. No old authorization, backup, endpoint, PID, result or closed-out state is copied. Current config is unauthorized; no production backup exists.

After a fresh convenience/no-task/normal-exit confirmation, use only the new round's runner and current backup. Sequence: closed preflight → Profile/storage/install/media/layout backups → recheck and verify → install candidate → verify/layoutAfter/runtime while DSH remains closed → reopen → discover fresh Host → select Lucy/daily/manual → play once → successful snapshotPlaying → normal Stop → verifyLiveCleanup → collectEvidence. Do not wait on feedback while leaving the wallpaper running. Collection errors do not weaken the restoration checks or grant cleanup permission.

Then normal Quit, strict played restore preflight, retain after-test state, restore rc.53/settings/layout/media, verify closed state, normal reopen and fresh stopped snapshot, then close the round. No old round authorization/endpoint/backup can be reused. Do not use final-playing proof if that snapshot was not actually produced.

The collector freezes six required native files and up to two timing sidecars, matching the stopped run's location/window/source PID. Source PID may equal original WE PID; never terminate original WE. Missing or malformed sidecars remain unknown. Different roles have different elapsed origins; no cross-process elapsed subtraction. Clock PID is reported metadata, not independent worker identity verification; timing files never authorize cleanup or prove visual disappearance. Pure fixtures test these boundaries without reading real application logs.

Offline preparation evidence and installation boundary: [candidate report](../../docs/RC55_TASKBAR_STAGE_TIMING_CANDIDATE_20261029.md).
