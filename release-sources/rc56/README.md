# rc.56 local title-prefilter diagnosis candidate

Subsequent status: [the single trial completed and dailyrc.53 was restored](../../docs/RC56_TASKBAR_TITLE_PREFILTER_SHORT_TEST_20261029.md). User confirmed the original layout/appearance and stopped playback. The prepared trial is closed and cannot be reused. Configuration/backup statements below describe its preparation-time snapshot, not current authorization or reusable state.

Fixed rc.55 payload + reviewed title-prefilter DLL. Only DLL, package version and README prefix change. Default rollback is dailyrc.53. No public release or automatic daily adoption.

Daily adoption has completed: [the daily handoff](../../docs/RC56_DAILY_TRIAL_20261029.md) records fresh authorization/backups,43 installed files, normal reopen and user confirmation. That daily round is now closed and retainsrc.56. Its [preparation plan](../../docs/RC56_DAILY_TRIAL_PREPARATION_20261029.md) and the earlier short-trial restoration instructions remain historical; neither round, authorization, endpoint nor backup may be reused.

```powershell
F:/Python/Python314/python.exe -X utf8 release-sources/rc56/build-candidate.py --output .tmp/rc56-candidate-NEW-ROUND
```

The recipe pins rc.55, the accepted integration, metadata allowlist/QA and replacement DLL. It preserves all23 JS files,13 other assets, old apphost/deps/runtimeconfig and file modes. Deterministic tar/gzip is reread and checked. It never invokes npm, native build, DSH, WE or package scripts.

Accepted local candidate: `.tmp/rc56-taskbar-title-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.56.tgz`, SHA256 `85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160`,7,265,680bytes／43files. Independent a/b archives match. `package-manifest.json` and `candidate.json` are package pins, not live authorization.

`prepare-trial.py` has prepared `.tmp/rc56-taskbar-title-short-trial-20261029-a/`. Do not rerun into that directory. It copies36 pinned templates plus the guarded timing collector, retaining strict played cleanup/restore binding and rc.53 rollback. No old authorization, backup, endpoint, PID or results are copied. Config remains `profileWritesAuthorized:false`; no production backup exists.

Offline preparation passed27 PowerShell parses,10 authorization-object,5 creation-time precision,7 cleanup-binding checks,20 unauthorized-entry refusals,23 runner references and13 collector fixtures. This is not a live restore, window or visual acceptance.

See [TRIAL.md](TRIAL.md) for the next authorized trial sequence and [candidate report](../../docs/RC56_TASKBAR_TITLE_PREFILTER_CANDIDATE_20261029.md). Do not perform real application operations without fresh user convenience/no-task/normal-exit confirmation and a new backup.
