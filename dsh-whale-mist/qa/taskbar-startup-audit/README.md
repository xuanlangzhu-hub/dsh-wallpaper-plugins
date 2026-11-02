# Taskbar startup boundary audit

This is a read-only replay of retained rc.54 evidence plus an audit of the exact frozen native source and fixed rc.53 Host. It does not reproduce Windows Shell behavior or certify a visual fix.

From the repository root:

```powershell
python dsh-whale-mist/qa/taskbar-startup-audit/audit.py .tmp/taskbar-startup-boundary-audit-NEW-ROUND
```

The output directory must be new and under this workspace's `.tmp`. The script verifies all 18 original native source hashes, the rc.54 one-change runtime adaptation, the fixed Host hash, 361 protected inputs, and both completed trial identities. It freezes eight relevant source files, records source-order anchors and input hashes, and verifies them again after reading. It never queries current processes, windows, DSH, WE, Profile, or the network and never builds or installs a package.

The reported click-to-first-frame and click-to-worker-completion offsets use retained same-machine wall timestamps. They are not window-creation times, isolated COM durations, or measured visual disappearance times. Both source windows were hosted by the original WE process; only round location/window ownership is relevant to closing them. Missing detailed timings remain unknown.

The report and the next diagnostic-only scope are in [the startup audit](../../../docs/TASKBAR_INITIAL_ENTRY_AUDIT_20261029.md).
