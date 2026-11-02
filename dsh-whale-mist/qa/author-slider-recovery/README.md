# Author slider failure recovery — isolated offline stage

This directory does not modify the shared sidebar, generated client, fixed release
inputs, production assets, installed plugin or user Profile. `prepare.py` derives
an isolated sidebar and unified patch from the SHA-pinned rc.53 integrated source
(also used by rc.56). Keep the pinned rc.56 archive unpacked at the path in
`baseline.json`; a different runtime must be reviewed and pinned explicitly.

From the repository root, using Python and Node on PATH:

```powershell
python dsh-whale-mist/qa/author-slider-recovery/check.py --output .tmp/author-slider-recovery-NEW
```

The output directory must be new. The parent enforces a 75-second total budget,
25 seconds per child, and a 2.5-second Node test deadline. On timeout it targets
only its own child tree, retains stdout/stderr and fails. No daily app is queried.

- `repro.mjs`: real fixed controller/ApplyAdapter, substituted request and child IO.
  Demonstrates gesture coalescing, four-round limit, local recovery and injected
  latency. The adapter budget is scaled to 200 ms; this is not a performance test.
- `retry.test.mjs`: 12 ownership, uncertainty, intent, concurrency and revision checks.
- `component.test.mjs`: 5 React element/handler checks; not a DOM or SDK acceptance.
- Four retained controller suites: 68 regressions, relinked to the isolated source.

The repair clears only this controller's exact, settled failed local dirty marker
after an explicit refresh intent. It does not resend uncertain commands, read
actual wallpaper values, reset defaults or clear foreign/stale/pending records.
`load()` and initial automatic reading remain read-only. The existing Host
revision, identity and discard gates remain authoritative.

The hours-long After You, Lucy incident has **not** been reproduced or resolved.
See `docs/AUTHOR_SLIDER_STABILITY_RECOVERY_20261029.md` for findings and next steps.

## Generated fragment / Host integration

```powershell
python dsh-whale-mist/qa/author-slider-recovery/integration.py --output .tmp/author-slider-integration-NEW
```

This runner copies all 43 SHA-pinned rc.56 files, verifies the original generator
in check mode, generates only the sidebar fragment, and freezes QA inputs. A
test-only VM seam exposes the embedded controller without loading the desktop UI.
Its requests use an owned ephemeral loopback HTTP Host with real authentication,
record service and ApplyAdapter; only metadata and child IO are substituted.

The fixed Host has a pre-existing stale-record-clear omission: 4 retained Host
checks and 1 generated-controller stale recovery check fail on the baseline.
`host-repair.py` fixes exact old key/delivery proof checks and returns clean new
defaults plus the refresh receipt; it preserves the fixed capture-ready GET and
dispose paths. The final payload differs only in client.js and this Host file.
11 route checks and 56 Host regressions pass. The prior 85 checks remain a
separate source/controller result; do not call their sum an end-to-end test count.

All children have a 25-second bound and the parent a 90-second total bound. No
production app, windows, SDK or wallpaper runs. No archive or installation is
created. The unchanged rc.56 version in the output identifies an experimental
copy, not a release candidate. Integration boundaries and next instrumentation
design: `docs/AUTHOR_SLIDER_RECOVERY_INTEGRATION_20261029.md`.
