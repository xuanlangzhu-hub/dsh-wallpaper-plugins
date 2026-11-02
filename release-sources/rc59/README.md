# rc.59 local material/proportion trial

Final candidate: `.tmp/rc59-ui-material-candidate-20261031-b/dsh-whale-mist-0.6.0-rc.59.tgz`.
SHA256: `94B4FB04B8F026FEE6399F8666D7150BDD88DA8A8F82638A02F9980AC0F5EBA4`.
47 files, 14 unchanged assets; diagnostics default off; no native rebuild.

The initial `-a` candidate was rejected because replacing the whole shared sidebar
omitted rc.57-only diagnostic UI. It is not installable evidence. The corrected
source applies `ui.patch` to the fixed rc.57 overlay's combined sidebar, retaining
its diagnostic recorder and export wrapper. Intermediate failed artifacts remain.

```powershell
& F:/Python/Python314/python.exe -X utf8 release-sources/rc59/build-candidate.py --output .tmp/rc59-fresh-build
& F:/Python/Python314/python.exe -X utf8 release-sources/rc59/check-candidate.py --output .tmp/rc59-fresh-check
& F:/Python/Python314/python.exe -X utf8 release-sources/rc59/prepare-trial.py --output .tmp/rc59-fresh-tools
```

Recipes intentionally pin this reviewed candidate and its source receipts; they
are not a general release script and do not package the shared development tree.
Use new output directories. Required exact source snapshots and prior archive
remain local `.tmp` inputs; inspect the recipe before reproducing elsewhere.

Actual archive checks: 152 behavior cases, 27 JS syntax checks, CSS guard, 36 import
edges. Actual archive SDK checks: 7 controls + 9 lifecycle, all self-owned services
closed. Native IO is substituted; this is not desktop visual acceptance.

Fresh unauthorized trial tools: `.tmp/rc59-ui-material-short-trial-20261031-a`.
Their config has `profileWritesAuthorized:false`; no authorization or production
backup exists. Default rollback is the exact rc.57 archive and current-round data.
New convenience/normal-exit confirmation and new backups are required before any
live operation. Do not automatically clear or restore Network Cookies. Preserve
the prior startup-authentication incident evidence.

See `docs/RC59_UI_MATERIAL_CANDIDATE_AND_TRIAL_PREPARATION_20261031.md`.
