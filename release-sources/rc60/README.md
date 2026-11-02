# rc.60 local thin-glass UI candidate

The user selected prototype B. This candidate preserves the fixed complete rc.57
runtime and diagnostic export wrapper, applying the approved proportions/panel
choice and thin-glass CSS. It never packages the shared development tree.

Candidate: `.tmp/rc60-thin-glass-candidate-20261031-b/dsh-whale-mist-0.6.0-rc.60.tgz`

SHA-256: `CCC49C5C5DEE6D4DFFA728C4A84B22755B98E3EAE905533CE93ECDFD203F4885`

7,283,152 bytes; 47 files; 14 original assets unchanged. Two independent builds
are byte-identical. Both sides carry the same new diagnostic build metadata.
No production dependencies, React upgrade, new native binaries, or animations.

```powershell
python release-sources/rc60/build-candidate.py --output .tmp/rc60-fresh-build
python release-sources/rc60/check-candidate.py --output .tmp/rc60-fresh-check
python release-sources/rc60/prepare-trial.py --output .tmp/rc60-fresh-tools
```

These recipes intentionally pin local reviewed inputs and archive identities.
Always use new output directories; do not substitute newer shared source into
an old recipe. Exact inputs remain in the local `.tmp` evidence directories.

Actual archive checks: 152 behavior cases, 27 JavaScript syntax checks, CSS guard,
36 relative import edges. Actual archive Windows rc.3 SDK: 11 cases, native IO
substituted. The first SDK run completed the control cases but failed the log
gate due to one extra `stale-revision` response; it is preserved. A single rerun
with read-only revision tracing passed the unchanged gate. No claim that the
existing snapshot publication race is fixed.

Fresh trial tools: `.tmp/rc60-thin-glass-short-trial-20261031-b`.
Default rollback: the exact rc.57 archive and this round's settings/media/layout.
No real authorization or production backup exists. The additional
`startupCookieBackup` step requires fresh authorization plus completed closed
backup and only copies the startup Cookie cache; it does not clear or restore it.

An install needs current convenience/normal-exit confirmation and a new backup.
Diagnostic launch is excluded; normal trial diagnostics stay off. Public release
and a daily-version switch are outside this round.

See `docs/RC60_THIN_GLASS_CANDIDATE_AND_TRIAL_PREPARATION_20261031.md`.
