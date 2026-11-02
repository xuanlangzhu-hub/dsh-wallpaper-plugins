# Bounded author failure diagnostics — isolated source stage

This is an injectable in-memory diagnostic implementation, not a package or live
diagnostic session. Production constructors and profile settings are not wired.
The fixed rc.56 recovery experiment is the SHA-pinned input; shared production
source, client and assets remain unchanged.

From the repository root, with Python and Node available:

```powershell
python dsh-whale-mist/qa/author-slider-diagnostics/check.py --output .tmp/author-diagnostics-NEW
```

The directory must be new. The parent enforces 90 seconds total and 25 seconds
per owned Node child; Node tests also have a 6.5-second deadline. A hung child is
stopped using its retained process handle, output is retained and the run fails.
The tests do not launch real child executables, desktop apps, windows or capture.

- `recorder.mjs`: dependency-free ring of 32 transactions, 16 events each, fixed
  field/error/stage lists, detached snapshots, bounded explicit JSON export.
- `prepare.py`: instruments only isolated copies of controller, Host and adapter.
  Hooks default to null. The sidebar stays import-free; backend adds one module.
- `recorder.test.mjs`: limits, privacy, clock faults, token separation, late exit,
  throwing hooks, export truncation and evidence immutability.
- `equivalence.test.mjs`: compares the prior implementation against diagnostic
  off/on/throwing/removed modes on nine real-adapter and five controller/Host/
  adapter scenarios, with metadata and child IO substituted.
- 124 existing controller/Host checks plus 17 prior recovery checks are relinked
  to the instrumented modules. Actual diagnostic client generation, desktop SDK,
  authenticated export surface and live acceptance are still pending.

Fourteen synthetic JSON examples are explicitly exported by QA into the output's
`evidence/` directory, never by the runtime recorder itself. Test clocks are
synthetic monotonic ticks; those durations are not Windows performance results.
No field values, commands, paths, stdout, tokens or chat content are retained.

`finished` describes the diagnostic span, not physical worker termination. A late
`children-settled` event does not rewrite an earlier unknown delivery result.
Overflow and missing events remain unknown; absence never proves no command ran.
Transactions rotate after 32 entries, so this is not an hours-long history.

See `docs/AUTHOR_SLIDER_BOUNDED_DIAGNOSTICS_20261029.md` for the exact stage boundary.
