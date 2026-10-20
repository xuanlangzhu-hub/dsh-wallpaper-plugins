import { existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import { createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';

console.log('--- Running Fifth Review Verification Probes (W1-W4) ---');

// =========================================================================
// PROBE 1 (W1): Query Error Preserves Process Record & Profile Directory
// =========================================================================
{
  console.log('[PROBE 1 - W1] Testing that query error preserves process and profile directory...');

  const state = { commands: [], queries: 0 };
  const child = new EventEmitter();
  child.pid = 987654710;
  child.kill = () => { throw new Error('child.kill must not be called'); };

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = inspectCimCommand(args.at(-1) || '');
    state.commands.push({ file, command });

    if (command.includes('ProcessId =')) {
      // A matched identity requires a real process record, never empty output.
      cb(null, JSON.stringify({ ProcessId: child.pid, Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${handle.profileDir}"`,
        CreationDate: '2026-10-18T01:00:00.000Z' }), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      state.queries++;
      // Simulate CIM query error / failure
      cb(Object.assign(new Error('synthetic-CIM-failed'), { code: 1 }), '', 'synthetic CIM error');
      return;
    }
    throw new Error('unexpected command stub: ' + file);
  }

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const handle = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, false, 'Close MUST fail when resource query fails');
  assert.equal(closeRes.error, 'synthetic-CIM-failed', 'Error message must reflect query failure');
  assert.equal(closeRes.processTerminated, false, 'Process MUST NOT be marked terminated when query failed');
  assert.equal(adapter.getTrackedProcessCount(), 1, 'Tracked process MUST be preserved on query failure');
  assert.equal(adapter.getOwnedProfileCount(), 1, 'Owned profile directory MUST be preserved on query failure');
  assert.equal(existsSync(handle.profileDir), true, 'Physical profile directory MUST still exist on disk');

  // Dispose while query still fails must also fail and preserve directory
  const disposeRes = await adapter.dispose();
  assert.equal(disposeRes.ok, false);
  assert.equal(adapter.getOwnedProfileCount(), 1, 'Dispose must not clean directory of unconfirmed process');
  assert.equal(existsSync(handle.profileDir), true);

  console.log('  -> Probe 1 passed: W1 query failure properly retains resources and reports failure.');
}

// =========================================================================
// PROBE 2 (W2): User Already Closed Root Window (Root Absent) Handled Cleanly
// =========================================================================
{
  console.log('[PROBE 2 - W2] Testing that user closing window prior to close() is handled gracefully...');

  const state = { commands: [], identityQueries: 0, resourceQueries: 0, taskkillTargets: [] };
  const child = new EventEmitter();
  child.pid = 987654711;

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = inspectCimCommand(args.at(-1) || '');
    state.commands.push({ file, command, args });

    if (command.includes('ProcessId =')) {
      state.identityQueries++;
      // Root process is absent from OS process table because user already closed it
      cb(Object.assign(new Error('synthetic-root-absent'), { code: 2 }), '', '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      throw new Error('Must NOT attempt CloseMainWindow on absent root process');
    }
    if (isResourceGroupQuery(command)) {
      state.resourceQueries++;
      // Return 0 remaining sub-processes
      cb(null, '', '');
      return;
    }
    if (file === 'taskkill.exe') {
      state.taskkillTargets.push(args[1]);
      cb(null, '', '');
      return;
    }
    throw new Error('unexpected command: ' + file);
  }

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const handle = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
  child.emit('exit', 0); // User closed the window

  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, true, 'Close must succeed when root already exited and no sub-processes remain');
  assert.notEqual(closeRes.error, 'pid-identity-mismatch', 'Must NOT report pid-identity-mismatch for absent root');
  assert.equal(closeRes.processTerminated, true);
  assert.equal(closeRes.profileDirCleaned, true);
  assert.equal(state.identityQueries, 1, 'Identity query was executed');
  assert.equal(state.resourceQueries, 1, 'Resource query was executed');
  assert.equal(adapter.getTrackedProcessCount(), 0);
  assert.equal(adapter.getOwnedProfileCount(), 0);
  assert.equal(existsSync(handle.profileDir), false, 'Profile directory cleaned after verified exit');

  console.log('  -> Probe 2 passed: W2 absent root window proceeds to resource check and cleans up.');
}

// =========================================================================
// PROBE 3 (W3): Taskkill Targets Surviving Sub-processes (Not Dead Root PID)
// =========================================================================
{
  console.log('[PROBE 3 - W3] Testing that Phase 2 taskkill targets surviving child PIDs...');

  const state = { commands: [], taskkillTargets: [], queries: 0 };
  const child = new EventEmitter();
  child.pid = 987654712;

  let profileDir;
  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = inspectCimCommand(args.at(-1) || '');
    state.commands.push({ file, args, command });

    if (command.includes('ProcessId =')) {
      const m = command.match(/ProcessId = (\d+)/);
      const qPid = m ? Number(m[1]) : 987654712;
      cb(null, JSON.stringify({
        ProcessId: qPid,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profileDir}"`,
        CreationDate: '2026-10-18T01:00:00.000Z',
      }), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      state.queries++;
      if (state.queries === 1) {
        // First query: root exited, but child worker process 987655001 is surviving!
        cb(null, JSON.stringify({
          ProcessId: 987655001,
          Name: 'msedge.exe',
          ExecutablePath: 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir="${profileDir}"`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        }), '');
      } else {
        // Second query (after taskkill): child process is gone!
        cb(null, '', '');
      }
      return;
    }
    if (file === 'taskkill.exe') {
      state.taskkillTargets.push(args[1]);
      cb(null, '', '');
      return;
    }
    throw new Error('unexpected command: ' + file);
  }

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const handle = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
  profileDir = handle.profileDir;
  const closeRes = await adapter.close(handle);

  assert.equal(closeRes.ok, true, 'Close must succeed after surviving child PID is killed');
  assert.equal(state.queries, 2, 'Resource group inspection must be performed twice');
  assert.deepEqual(state.taskkillTargets, ['987655001'], 'Taskkill MUST target surviving child PID (987655001), NOT dead root PID (987654712)');
  assert.equal(adapter.getTrackedProcessCount(), 0);
  assert.equal(adapter.getOwnedProfileCount(), 0);

  console.log('  -> Probe 3 passed: W3 taskkill accurately targets verified surviving sub-processes.');
}

// =========================================================================
// PROBE 4 (W4): Dispose Preserves Profile Directory While Sub-process Is Alive
// =========================================================================
{
  console.log('[PROBE 4 - W4] Testing that dispose preserves profile directory when sub-process survives...');

  const child = new EventEmitter();
  child.pid = 987654720;

  let subProcessAlive = true;

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    verifyProcessIdentity: () => true, // W4 isolates resource-group lifetime; native identity is tested separately.
    requestWindowClose: () => { child.emit('exit', 0); },
    inspectResourceGroup: () => {
      if (subProcessAlive) {
        return { alive: true, pids: [987654721], rootAlive: false, subAlive: true };
      }
      return { alive: false, pids: [], rootAlive: false, subAlive: false };
    },
    forceTerminateResourceGroup: () => {
      // Stubborn sub-process ignores force terminate initially
    },
    gracefulTimeoutMs: 1,
  });

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });

  // 4.1 First close fails because sub-process is alive
  const before = await adapter.close(h);
  assert.equal(before.ok, false);
  assert.equal(before.error, 'resource-group-still-alive');
  assert.equal(existsSync(h.profileDir), true);
  assert.equal(adapter.getOwnedProfileCount(), 1);
  assert.equal(adapter.getTrackedProcessCount(), 1);

  // 4.2 CRITICAL W4 CHECK: dispose() while sub-process survives MUST NOT delete profile directory!
  const disposed = await adapter.dispose();
  assert.equal(disposed.ok, false);
  assert.equal(disposed.error, 'some-processes-failed-to-close');
  assert.equal(existsSync(h.profileDir), true, 'Profile directory MUST still exist on disk after failed dispose');
  assert.equal(adapter.getOwnedProfileCount(), 1, 'ownedProfileDirs MUST still retain the directory');
  assert.equal(adapter.getTrackedProcessCount(), 1, 'activeProcesses MUST still retain the process record');

  // 4.3 Sub-process finally exits: calling dispose() again must clean up and succeed
  subProcessAlive = false;
  const disposed2 = await adapter.dispose();
  assert.equal(disposed2.ok, true);
  assert.equal(existsSync(h.profileDir), false, 'Profile directory now cleanly removed');
  assert.equal(adapter.getOwnedProfileCount(), 0);
  assert.equal(adapter.getTrackedProcessCount(), 0);

  console.log('  -> Probe 4 passed: W4 dispose strictly preserves profile of living/unclosed processes.');
}

// =========================================================================
// PROBE 5: Codex Exact VM Test (windows-default-probes.mjs verification)
// =========================================================================
{
  console.log('[PROBE 5] Running Codex exact VM test fixture checks...');

  const results = {};
  async function runCase(mode) {
    const state = { mode, commands: [], queries: 0, identityQueries: 0, child: null, profileDir: null, forcedPid: null };
    function fakeSpawn() {
      const c = new EventEmitter();
      c.pid = 987654710;
      c.kill = () => { throw new Error('production must not call child.kill'); };
      state.child = c;
      return c;
    }
    function fakeExec(file, args, options, callback) {
      const cb = typeof options === 'function' ? options : callback;
      const command = inspectCimCommand(args.at(-1) || '');
      state.commands.push({
        file,
        commandKind: command.includes('CloseMainWindow')
          ? 'CloseMainWindow'
          : isResourceGroupQuery(command)
          ? 'profile-query'
          : command.includes('ProcessId =')
          ? 'identity-query'
          : file,
      });
      if (file === 'taskkill.exe') {
        state.forcedPid = args[1];
        cb(Object.assign(new Error('not found 128'), { code: 128 }), '', '');
        return;
      }
      if (command.includes('ProcessId =')) {
        state.identityQueries++;
        if (mode === 'already-closed' && command.includes(String(state.child.pid))) {
          cb(Object.assign(new Error('synthetic-root-absent'), { code: 2 }), '', '');
        } else {
          const m = command.match(/ProcessId = (\d+)/);
          const qPid = m ? Number(m[1]) : 987654710;
          cb(null, JSON.stringify({
            ProcessId: qPid,
            Name: 'msedge.exe',
            ExecutablePath: 'C:\\Synthetic\\msedge.exe',
            CommandLine: `msedge.exe --user-data-dir="${state.profileDir}"`,
            CreationDate: '2026-10-18T01:00:00.000Z',
          }), '');
        }
        return;
      }
      if (command.includes('CloseMainWindow')) {
        state.child.emit('exit', 0);
        cb(null, '', '');
        return;
      }
      if (isResourceGroupQuery(command)) {
        state.queries++;
        state.queryCommandContainsOwnProfile = command.includes(state.profileDir);
        if (mode === 'query-error') cb(Object.assign(new Error('synthetic-CIM-failed'), { code: 1 }), '', 'synthetic CIM error');
        else cb(null, JSON.stringify({
          ProcessId: 987655000 + state.queries,
          Name: 'msedge.exe',
          ExecutablePath: 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir="${state.profileDir}"`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        }), '');
        return;
      }
      throw new Error('unexpected command stub: ' + file);
    }

    const adapter = createEdgeWindowAdapter({
      edgePath: 'C:\\Synthetic\\msedge.exe',
      findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
      spawnProcess: fakeSpawn,
      execCommand: fakeExec,
      gracefulTimeoutMs: 1,
    });

    const handle = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
    state.profileDir = handle.profileDir;
    if (mode === 'already-closed') state.child.emit('exit', 0);

    const closeRes = await adapter.close(handle);
    return {
      closeOk: closeRes.ok,
      error: closeRes.error,
      processTerminated: closeRes.processTerminated,
      profileExists: existsSync(handle.profileDir),
      tracked: adapter.getTrackedProcessCount(),
      owned: adapter.getOwnedProfileCount(),
      identityQueries: state.identityQueries,
      resourceQueries: state.queries,
      queryCommandContainsOwnProfile: state.queryCommandContainsOwnProfile,
      taskkillTarget: state.forcedPid,
      commands: state.commands,
      nativeProcessesTouched: 0,
      defaultWindowsBranch: true,
    };
  }

  const queryFailure = await runCase('query-error');
  const alreadyClosedRoot = await runCase('already-closed');
  const querySelfMatch = await runCase('query-self-match');

  // Verify queryFailure
  assert.equal(queryFailure.closeOk, false, 'queryFailure: closeOk must be false');
  assert.equal(queryFailure.processTerminated, false, 'queryFailure: processTerminated must be false');
  assert.equal(queryFailure.profileExists, true, 'queryFailure: profileExists must be true');
  assert.equal(queryFailure.tracked, 1, 'queryFailure: tracked must be 1');
  assert.equal(queryFailure.owned, 1, 'queryFailure: owned must be 1');

  // Verify alreadyClosedRoot
  assert.equal(alreadyClosedRoot.closeOk, false, 'alreadyClosedRoot: closeOk is false because sub-process was returned');
  assert.notEqual(alreadyClosedRoot.error, 'pid-identity-mismatch', 'alreadyClosedRoot: error must NOT be pid-identity-mismatch');
  assert.equal(alreadyClosedRoot.resourceQueries, 2, 'alreadyClosedRoot: resourceQueries must be 2 (proves resource check ran)');
  assert.equal(alreadyClosedRoot.taskkillTarget, '987655001', 'alreadyClosedRoot: taskkillTarget must be 987655001 (not dead root PID)');

  // Verify querySelfMatch
  assert.equal(querySelfMatch.taskkillTarget, '987655001', 'querySelfMatch: taskkillTarget must be 987655001');

  console.log('  -> Probe 5 passed: Codex exact VM cases match expected behavior.');
}

console.log('--- ALL FIFTH REVIEW VERIFICATION PROBES (W1-W4) PASSED! ---');

function isResourceGroupQuery(command) {
 if (command.includes('CommandLine like')) return true;
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 return Boolean(b64 && Buffer.from(b64,'base64').toString('utf8').startsWith('CommandLine like'));
}

// IO fixture dispatch sees the logical filter as well as its transport encoding.
function inspectCimCommand(command) {
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 if (!b64) return command;
 const filter = Buffer.from(b64,'base64').toString('utf8');
 return command + '\n' + filter.replaceAll('\\\\','\\');
}
