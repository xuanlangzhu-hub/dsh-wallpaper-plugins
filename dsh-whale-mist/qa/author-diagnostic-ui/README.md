# Default-off activation and explicit diagnostic download

```powershell
python dsh-whale-mist/qa/author-diagnostic-ui/check.py --output .tmp/author-diagnostic-ui-NEW
```

Uses the fixed 45-file export experiment and derives 47 isolated runtime files,
an actual generated client and fixed source/build metadata. Shared source, assets,
installed plugin, environment and Profile are never written. Output must be new.
The unchanged rc.56 version is an experiment and must not be installed/published.

- Host activation requires exactly `WM_AUTHOR_DIAGNOSTICS=1` at process startup.
  This runner never sets it for a daily app. Authenticated bootstrap alone carries
  enabled metadata; the global index table still contains only a port.
- Renderer activation validates the exact compiled build/source contract and a
  connected bridge. Missing, malformed, late or global-only metadata stays off.
- The quiet export row exists only when enabled, survives stopped/cleanup states,
  and has explicit export/cancel actions. A view close, provider disposal, changed
  connection or deadline fences late work; no automatic download is performed.
- Files contain separate Renderer/Host snapshots with uncorrelated clock domains.
  Closed schema/source checks and a 300000-byte Blob cap precede any handoff.
  The receipt says handed to browser, never file saved. Actual download acceptance
  requires a later supervised desktop trial.
- At most two owned Blob URLs/timers remain, anchors are removed immediately, and
  timer/dispose/failure paths revoke URLs. No file picker, arbitrary save path,
  direct filesystem writer or upload is introduced.

40 new lifecycle/bootstrap/UI/provider-flow checks, 30 retained export/route checks,
and 76 Host/provider regressions pass. The bootstrap functions, generated fragment,
real provider/lifecycle and Blob bytes execute with explicit SDK/DOM/transport
substitutes. These are not full desktop SDK or visual/file-save acceptance.

All Node tests use one process (`--test-isolation=none`), per-test deadlines, a
25-second parent stage bound and a 90-second overall bound. No daily windows,
WE, PowerShell, COM or capture runs. No candidate archive is created.

Details: `docs/AUTHOR_DIAGNOSTIC_ACTIVATION_DOWNLOAD_20261029.md`.
