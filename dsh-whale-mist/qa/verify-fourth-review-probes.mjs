import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import { createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';

console.log('--- Running Fourth Review Verification Probes ---');

// =========================================================================
// PROBE 1: Graceful Close Intent & Resource Group Inspection Verification
// =========================================================================
{
  console.log('[PROBE 1] Testing Graceful Close Intent & Resource Group Inspection...');

  let requestCloseCalled = false;
  let inspectCalls = 0;
  const child = new EventEmitter();
  child.pid = 4101;
  child.kill = () => {
    throw new Error('child.kill() should not be invoked when requestWindowClose is provided');
  };

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    requestWindowClose: async (record) => {
      requestCloseCalled = true;
      assert.equal(record.pid, 4101);
      // Simulate normal window responding to close intent and exiting gracefully
      process.nextTick(() => child.emit('exit', 0));
    },
    inspectResourceGroup: async (record) => {
      inspectCalls++;
      assert.equal(record.pid, 4101);
      return { alive: false, pids: [] };
    },
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-1',
    instanceId: 'inst-1',
  });

  assert.equal(handle.pid, 4101);
  assert.equal(adapter.getTrackedProcessCount(), 1);
  assert.equal(adapter.getOwnedProfileCount(), 1);

  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, true, 'Close must report ok: true');
  assert.equal(closeRes.processTerminated, true, 'Process must be recorded as terminated');
  assert.equal(closeRes.profileDirCleaned, true, 'Profile directory must be cleaned');
  assert.equal(requestCloseCalled, true, 'requestWindowClose hook must be invoked');
  assert.ok(inspectCalls >= 1, 'Resource group inspection must be called at least once');
  assert.ok(adapter.getResourceGroupInspectionCount() >= 1, 'Resource group inspection count tracked');
  assert.equal(adapter.getCloseIntentCount(), 1, 'Close intent count tracked');
  assert.equal(adapter.getTrackedProcessCount(), 0, 'Process tracking cleared after verified exit and cleanup');
  assert.equal(adapter.getOwnedProfileCount(), 0, 'Profile ownership cleared after successful cleanup');

  console.log('  -> Probe 1 passed: Graceful close intent and resource group inspection verified.');
}

// =========================================================================
// PROBE 2: Surviving Sub-processes Trigger Phase 2 Forceful Tree Termination
// =========================================================================
{
  console.log('[PROBE 2] Testing Surviving Sub-processes and Forceful Tree Termination...');

  let phase2ForceKillCalled = false;
  let inspectGroupStep = 0;
  const child = new EventEmitter();
  child.pid = 4202;
  child.kill = () => {};

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    requestWindowClose: async () => {
      // Root process exits gracefully upon request
      process.nextTick(() => child.emit('exit', 0));
    },
    inspectResourceGroup: async (record) => {
      inspectGroupStep++;
      if (inspectGroupStep === 1) {
        // First inspection: root process exited, but child worker/renderer processes remain alive!
        return { alive: true, pids: [4202, 4203, 4204], rootAlive: false, subAlive: true };
      }
      // Second inspection (after Phase 2 force termination): all confirmed dead
      return { alive: false, pids: [] };
    },
    forceTerminateResourceGroup: async (record, status) => {
      phase2ForceKillCalled = true;
      assert.deepEqual(status.pids, [4202, 4203, 4204]);
    },
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-2',
    instanceId: 'inst-2',
  });

  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, true, 'Close must succeed after Phase 2 tree termination confirms clean exit');
  assert.equal(phase2ForceKillCalled, true, 'Phase 2 forceful tree termination must be triggered when sub-processes survive');
  assert.equal(inspectGroupStep, 2, 'Resource group inspection must be performed twice (initial check + post-force confirmation)');
  assert.equal(adapter.getTrackedProcessCount(), 0);
  assert.equal(adapter.getOwnedProfileCount(), 0);

  console.log('  -> Probe 2 passed: Surviving sub-process detection and tree termination verified.');
}

// =========================================================================
// PROBE 3: Stubborn Sub-processes Refusing to Die Retain Process & Ownership
// =========================================================================
{
  console.log('[PROBE 3] Testing Stubborn Surviving Sub-processes Retention...');

  const child = new EventEmitter();
  child.pid = 4303;
  child.kill = () => {};

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    requestWindowClose: async () => {
      child.emit('exit', 0);
    },
    inspectResourceGroup: async () => {
      // Sub-processes refuse to exit even after force termination
      return { alive: true, pids: [4304], rootAlive: false, subAlive: true };
    },
    forceTerminateResourceGroup: async () => {},
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-3',
    instanceId: 'inst-3',
  });

  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, false, 'Close must report failure when resource group remains alive');
  assert.equal(closeRes.error, 'resource-group-still-alive');
  assert.deepEqual(closeRes.alivePids, [4304]);
  assert.equal(closeRes.processTerminated, false);
  assert.equal(closeRes.profileDirCleaned, false);

  // Critical: Process record and profile directory MUST NOT be dropped!
  assert.equal(adapter.getTrackedProcessCount(), 1, 'Active process record must be retained');
  assert.equal(adapter.getOwnedProfileCount(), 1, 'Owned profile directory must be retained');

  console.log('  -> Probe 3 passed: Stubborn sub-process failure and retention verified.');
}

// =========================================================================
// PROBE 4: Recycled PID / Process Identity Mismatch Defense
// =========================================================================
{
  console.log('[PROBE 4] Testing PID Recycling / Identity Mismatch Defense...');

  let closeIntentAttempted = false;
  const child = new EventEmitter();
  child.pid = 4404;

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    verifyProcessIdentity: async (record) => {
      assert.equal(record.pid, 4404);
      // Simulate OS PID recycling: PID 4404 now belongs to another process!
      return false;
    },
    requestWindowClose: async () => {
      closeIntentAttempted = true;
    },
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-4',
    instanceId: 'inst-4',
  });

  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, false, 'Close must reject operation on recycled PID');
  assert.equal(closeRes.error, 'pid-identity-mismatch');
  assert.equal(closeIntentAttempted, false, 'Must NEVER send close intent to recycled OS process');
  assert.equal(adapter.getTrackedProcessCount(), 1, 'Process record preserved');

  console.log('  -> Probe 4 passed: PID recycling identity check defense verified.');
}

// =========================================================================
// PROBE 5: Stale Handle Identity Mismatch Defense
// =========================================================================
{
  console.log('[PROBE 5] Testing Stale Handle Identity Mismatch Defense...');

  const child = new EventEmitter();
  child.pid = 4505;

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-5',
    instanceId: 'inst-5',
  });

  // 5.1 Stale handle with outdated createdAt
  const staleCreatedAtHandle = { ...handle, createdAt: handle.createdAt - 100000 };
  const res1 = await adapter.close(staleCreatedAtHandle);
  assert.equal(res1.ok, false);
  assert.equal(res1.error, 'stale-handle-identity-mismatch');

  // 5.2 Stale handle with mismatched instanceId
  const staleInstanceHandle = { ...handle, instanceId: 'different-inst' };
  const res2 = await adapter.close(staleInstanceHandle);
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'instance-identity-mismatch');

  // 5.3 Unowned handle PID
  const unownedHandle = { pid: 999999 };
  const res3 = await adapter.close(unownedHandle);
  assert.equal(res3.ok, false);
  assert.equal(res3.error, 'unowned-handle');

  console.log('  -> Probe 5 passed: Stale handle defense verified.');
}

// =========================================================================
// PROBE 6: Profile Cleanup EBUSY Failure Retention & Dispose Retry (P2)
// =========================================================================
{
  console.log('[PROBE 6] Testing Profile EBUSY Cleanup Failure Retention & Dispose Retry...');

  // Create real temporary test directories under os.tmpdir() matching prefix
  const testDirId = randomUUID();
  const dedicatedDir = resolve(join(tmpdir(), `whale-companion-profile-p2test-${testDirId}`));

  const child = new EventEmitter();
  child.pid = 4606;
  child.kill = () => {
    process.nextTick(() => child.emit('exit', 0));
  };

  let simulateEbusy = true;

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    inspectResourceGroup: async () => ({ alive: false, pids: [] }),
    rmDir: async (target) => {
      if (resolve(target) === resolve(dedicatedDir) && simulateEbusy) {
        const ebusyErr = new Error('EBUSY: resource busy or locked');
        ebusyErr.code = 'EBUSY';
        throw ebusyErr;
      }
      await rm(target, { recursive: true, force: true });
    },
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-6',
    instanceId: 'inst-6',
    profileDir: dedicatedDir,
  });

  assert.equal(existsSync(dedicatedDir), true, 'Dedicated test directory was created');
  assert.equal(adapter.getOwnedProfileCount(), 1, 'Adapter owns the test profile directory');
  assert.equal(adapter.getTrackedProcessCount(), 1, 'Adapter tracks process 4606');

  // Place a sentinel file inside
  const lockedFile = join(dedicatedDir, 'lockfile.txt');
  await writeFile(lockedFile, 'locked content');

  try {
    // 6.1 First close attempt encounters EBUSY
    const closeRes1 = await adapter.close(handle);

    assert.equal(closeRes1.ok, false, 'Close MUST return ok: false when profile cleanup fails');
    assert.equal(closeRes1.error, 'profile-dir-cleanup-failed');
    assert.equal(closeRes1.processTerminated, true, 'Process termination state is recorded as true');
    assert.equal(closeRes1.profileDirCleaned, false, 'Profile directory cleaned state is false');
    assert.equal(closeRes1.closedPid, 4606);
    assert.equal(resolve(closeRes1.profileDir), resolve(dedicatedDir));

    // CRITICAL P2 CHECK: Directory ownership MUST NOT be discarded!
    assert.equal(adapter.getOwnedProfileCount(), 1, 'ownedProfileDirs MUST still retain the uncleaned directory');
    assert.equal(adapter.getTrackedProcessCount(), 1, 'activeProcesses MUST retain the process record for retry');
    assert.equal(existsSync(dedicatedDir), true, 'Physical directory still exists');

    // 6.2 Dispose attempt while lock still persists
    const disposeRes1 = await adapter.dispose();
    assert.equal(disposeRes1.ok, false, 'Dispose must report failure while EBUSY persists');
    assert.equal(disposeRes1.error, 'some-profiles-failed-to-clean');
    assert.equal(adapter.getOwnedProfileCount(), 1, 'Directory still retained in ownedProfileDirs after failed dispose');

    // 6.3 Clear the EBUSY condition (lock released) and retry dispose
    simulateEbusy = false;

    const disposeRes2 = await adapter.dispose();
    assert.equal(disposeRes2.ok, true, 'Dispose must report ok: true once lock is released');
    assert.equal(adapter.getOwnedProfileCount(), 0, 'ownedProfileDirs is now cleared');
    assert.equal(adapter.getTrackedProcessCount(), 0, 'activeProcesses is now cleared');
    assert.equal(existsSync(dedicatedDir), false, 'Physical directory has been cleanly removed');

    console.log('  -> Probe 6 passed: EBUSY failure retention and subsequent retry verified.');
  } finally {
    try {
      if (existsSync(dedicatedDir)) {
        await rm(dedicatedDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

// =========================================================================
// PROBE 7: Profile Cleanup Retry via Direct close() Call
// =========================================================================
{
  console.log('[PROBE 7] Testing Profile EBUSY Retry via Direct close() Call...');

  const testDirId = randomUUID();
  const dedicatedDir = resolve(join(tmpdir(), `whale-companion-profile-p2direct-${testDirId}`));

  const child = new EventEmitter();
  child.pid = 4707;
  child.kill = () => {
    process.nextTick(() => child.emit('exit', 0));
  };

  let simulateEbusy = true;

  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Windows\\dummy\\edge.exe' }),
    spawnProcess: () => child,
    inspectResourceGroup: async () => ({ alive: false, pids: [] }),
    rmDir: async (target) => {
      if (resolve(target) === resolve(dedicatedDir) && simulateEbusy) {
        const ebusyErr = new Error('EBUSY: resource busy or locked');
        ebusyErr.code = 'EBUSY';
        throw ebusyErr;
      }
      await rm(target, { recursive: true, force: true });
    },
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'test-token-7',
    instanceId: 'inst-7',
    profileDir: dedicatedDir,
  });

  try {
    const res1 = await adapter.close(handle);
    assert.equal(res1.ok, false);
    assert.equal(res1.error, 'profile-dir-cleanup-failed');
    assert.equal(res1.processTerminated, true);
    assert.equal(res1.profileDirCleaned, false);
    assert.equal(adapter.getOwnedProfileCount(), 1);
    assert.equal(adapter.getTrackedProcessCount(), 1);

    // Release lock
    simulateEbusy = false;

    // Retry calling close(handle) directly
    const res2 = await adapter.close(handle);
    assert.equal(res2.ok, true, 'Direct close() retry must succeed once lock is released');
    assert.equal(res2.processTerminated, true);
    assert.equal(res2.profileDirCleaned, true);
    assert.equal(adapter.getOwnedProfileCount(), 0);
    assert.equal(adapter.getTrackedProcessCount(), 0);
    assert.equal(existsSync(dedicatedDir), false);

    console.log('  -> Probe 7 passed: Direct close() retry on previous EBUSY verified.');
  } finally {
    try {
      if (existsSync(dedicatedDir)) {
        await rm(dedicatedDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

console.log('--- ALL FOURTH REVIEW VERIFICATION PROBES PASSED! ---');
