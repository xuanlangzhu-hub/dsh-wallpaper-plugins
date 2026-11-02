# Diagnostic client / controlled export integration

```powershell
python dsh-whale-mist/qa/author-diagnostic-integration/check.py --output .tmp/author-diagnostic-integration-NEW
```

Output must be new. This derives an isolated experimental payload from the fixed
diagnostic source stage, generates the real client with the original generator,
and validates its private imports and HTTP/bridge contracts. It does not install,
create an archive, enable diagnostics in a running app or write user files.

The backend export session owns its recorder and validates fixed source/build
metadata. Export is a distinct read-only operation on `/api/main/snapshot`, with
exact body fields and canonical header credentials. No new HTTP route or static
private module is exposed. Ordinary snapshot requests retain their behavior.
The new bridge method has a 2.5-second total deadline, 262144-byte response cap,
cancellation and current-connection checks; it never retries or saves a file.

The actual generated fragment and actual generated bridge are executed through
explicit VM seams. Nineteen export checks, eleven authenticated controller/Host/
adapter route checks with bottom-level IO substitutes, and 76 Host/provider
regressions pass. VM/provider checks are not desktop SDK or visual acceptance.

The parent enforces 90 seconds total / 25 seconds per retained Node child. Node tests use `--test-isolation=none` (validated on
Node 24.18) so there are no separate test workers to orphan. An owned finite
busy-loop probe confirms handle-based parent termination. Test
HTTP services use owned ephemeral loopback ports and bounded close. No real WE,
PowerShell, COM, windows or capture runs. No daily app is queried.

Activation/bootstrap wiring and file-save UI remain pending; defaults stay off.
The unchanged rc.56 version in this experiment must not be installed or published.
See `docs/AUTHOR_DIAGNOSTIC_EXPORT_INTEGRATION_20261029.md`.
