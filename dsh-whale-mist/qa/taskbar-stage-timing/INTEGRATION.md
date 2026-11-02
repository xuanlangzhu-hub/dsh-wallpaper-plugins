# M1 fixed-payload preflight

```powershell
python dsh-whale-mist/qa/taskbar-stage-timing/preflight.py --output .tmp/taskbar-stage-integration-NEW-ROUND
```

This is an offline staging and protocol check, not an installation package. It fixes the accepted rc.54 archive and M1 DLL hashes; 42 of 43 files remain byte-identical. It preserves the old apphost, deps and runtimeconfig plus all eight vendor dependency DLLs. No new package version/archive, installation, live process/window query, or WallpaperProbe entry execution occurs.

MetadataProbe uses PEReader and signature decoding, never Assembly.Load. It normalizes metadata operands, locals and catch types before comparing IL bodies so mere metadata-token renumbering does not masquerade as a logic change. `metadata-allowlist.json` pins the exact reviewed definition additions/removals and body differences, their values/hashes, and both DLL hashes. Its changed internal signatures and compiler-generated closure types are expected; this does not promise general backwards compatibility for arbitrary callers of internal helper methods.

A separate generated harness links the same frozen native inputs to produce frames, log records and terminal records. Host tests import the exact staged JS and inject process identity/query and command boundaries; unexpected OS commands throw. Six extra cases verify timing files cannot grant cleanup and are not required for valid terminal proof. Native process supervision, real COM, rendered motion and actual load-through-the-old-apphost still need a later authorized candidate trial.

Use a fresh output directory. `--inventory-only` explicitly reports integrationAccepted=false and is only for reviewing differences, never permission to widen the allowlist blindly. Each full run has a 120-second overall deadline, bounded subprocess phases and retained exit evidence.

Final evidence: `.tmp/taskbar-stage-integration-20261029-c/`. The `-a` metadata inventory is not an accepted integration; `-b` retained a fixture failure because API success alone did not prove worker exit. The corrected `-c` fixture uses actual `Execution.FromWorker` with a complete bottom-level IO substitute outcome; no production gate changed. See [the report](../../../docs/TASKBAR_STAGE_TIMING_INTEGRATION_PREFLIGHT_20261029.md).
