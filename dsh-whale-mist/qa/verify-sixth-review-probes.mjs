import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import { createEdgeWindowAdapter, extractUserDataDir, classifyProcessRecord, isControlledEdgeProcess } from '../src/detachable-edge-adapter.js';

console.log('--- Running Sixth Review Verification Probes (W1, W3, and Safety Gate) ---');

// =========================================================================
// PART 1: Unit Verification of extractUserDataDir and classifyProcessRecord
// =========================================================================
{
  console.log('[UNIT 1] extractUserDataDir boundary parsing...');
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir=C:\\temp\\d1 --no-first-run'), 'C:\\temp\\d1');
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir="C:\\temp with spaces\\d1" --no-first-run'), 'C:\\temp with spaces\\d1');
  assert.equal(extractUserDataDir('msedge.exe "--user-data-dir=C:\\temp with spaces\\d1" --no-first-run'), 'C:\\temp with spaces\\d1');
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir=\'C:\\temp\\d1\' --no-first-run'), 'C:\\temp\\d1');
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir C:\\temp\\d1 --no-first-run'), 'C:\\temp\\d1');
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir "C:\\temp with spaces\\d1" --no-first-run'), 'C:\\temp with spaces\\d1');
  assert.equal(extractUserDataDir('powershell.exe -Command Write-Output \'C:\\temp\\d1\''), null);
  assert.equal(extractUserDataDir('msedge.exe --user-data-dir=C:\\temp\\d1-other'), 'C:\\temp\\d1-other');
  console.log('  -> PASS');
}

{
  console.log('[UNIT 2] classifyProcessRecord and isControlledEdgeProcess...');
  const profile = 'C:\\temp\\test-profile';

  // 1. Controlled Edge process
  const controlled = {
    ProcessId: 1001,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}" --no-first-run`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  assert.equal(classifyProcessRecord(controlled, profile, 'C:\\Synthetic\\msedge.exe').status, 'controlled');
  assert.equal(isControlledEdgeProcess(controlled, profile, 'C:\\Synthetic\\msedge.exe'), true);

  // 2. Foreign shell (mentioning profile)
  const foreignShell = {
    ProcessId: 1002,
    Name: 'powershell.exe',
    ExecutablePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    CommandLine: `powershell.exe -Command Write-Output '${profile}'`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  assert.equal(classifyProcessRecord(foreignShell, profile, 'C:\\Synthetic\\msedge.exe').status, 'foreign-shell');
  assert.equal(isControlledEdgeProcess(foreignShell, profile, 'C:\\Synthetic\\msedge.exe'), false);

  // 3. Foreign executable containing "edge" (e.g. knowledge.exe)
  const foreignExe = {
    ProcessId: 1003,
    Name: 'knowledge.exe',
    ExecutablePath: 'C:\\Other\\knowledge.exe',
    CommandLine: `knowledge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  assert.equal(classifyProcessRecord(foreignExe, profile, 'C:\\Synthetic\\msedge.exe').status, 'foreign-executable');
  assert.equal(isControlledEdgeProcess(foreignExe, profile, 'C:\\Synthetic\\msedge.exe'), false);

  // 4. Prefix collision
  const prefixCollision = {
    ProcessId: 1004,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}-other"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  assert.equal(classifyProcessRecord(prefixCollision, profile, 'C:\\Synthetic\\msedge.exe').status, 'foreign-prefix-collision');
  assert.equal(isControlledEdgeProcess(prefixCollision, profile, 'C:\\Synthetic\\msedge.exe'), false);

  // 5. Insufficient info (missing CommandLine)
  const missingCmd = {
    ProcessId: 1005,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
  };
  assert.equal(classifyProcessRecord(missingCmd, profile, 'C:\\Synthetic\\msedge.exe').status, 'insufficient-info');
  assert.equal(isControlledEdgeProcess(missingCmd, profile, 'C:\\Synthetic\\msedge.exe'), false);

  // 6. Insufficient info (invalid PID)
  const invalidPid = {
    ProcessId: 'not-a-number',
    Name: 'msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
  };
  assert.equal(classifyProcessRecord(invalidPid, profile, 'C:\\Synthetic\\msedge.exe').status, 'insufficient-info');

  console.log('  -> PASS');
}

// =========================================================================
// PART 2: Codex Adversarial VM Suite against Production Adapter
// =========================================================================
async function runCase(mode) {
  const state = { mode, calls: [], forced: [], queryCount: 0, rootIdentityCount: 0, retry: false };
  const rootPid = 987654710, foreignPid = 987655001, queryPid = 987655999;
  let child, profile;

  function fakeSpawn() {
    child = new EventEmitter();
    child.pid = rootPid;
    child.kill = () => { throw Error('Unexpected native child.kill'); };
    return child;
  }

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    state.calls.push({ file, args });

    if (file === 'taskkill.exe') {
      state.forced.push(Number(args[1]));
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      state.rootIdentityCount++;
      if (mode === 'absent-root') {
        cb(Object.assign(Error('Command failed (exit 2)'), { code: 2 }), '', '');
      } else {
        const m = command.match(/ProcessId = (\d+)/);
        const qPid = m ? Number(m[1]) : rootPid;
        cb(null, JSON.stringify({
          ProcessId: qPid,
          Name: 'msedge.exe',
          ExecutablePath: 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir="${profile}"`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        }), '');
      }
      return;
    }
    if (command.includes('CloseMainWindow')) {
      child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      state.queryCount++;
      if (state.retry) {
        cb(null, '', '');
        return;
      }
      if (mode === 'query-error') {
        cb(Object.assign(Error('CIM unavailable'), { code: 1 }), '', '');
        return;
      }
      if (mode === 'malformed') {
        cb(null, 'not a process result\r\n', '');
        return;
      }
      if (mode === 'malformed-json') {
        cb(null, '[{"ProcessId":987655001', '');
        return;
      }
      if (mode === 'absent-root') {
        cb(null, '', '');
        return;
      }
      if (mode === 'foreign-mention' || mode === 'query-self-only') {
        let candidates = [{ ProcessId: queryPid, Name: 'powershell.exe', CommandLine: command }];
        if (mode === 'foreign-mention' && !state.forced.includes(foreignPid)) {
          candidates.push({
            ProcessId: foreignPid,
            Name: 'powershell.exe',
            ExecutablePath: 'C:\\Windows\\powershell.exe',
            CommandLine: `powershell.exe -Command Write-Output '${profile}'`,
            CreationDate: '2026-10-18T01:00:00.000Z',
          });
        }
        if (command.includes('$_.ProcessId -ne $PID')) {
          candidates = candidates.filter(p => p.ProcessId !== queryPid);
        }
        state.candidateRecords = candidates;
        const stdout = command.includes('ExpandProperty ProcessId')
          ? candidates.map(p => String(p.ProcessId)).join('\r\n')
          : JSON.stringify(candidates);
        cb(null, stdout, '');
        return;
      }
      if (mode === 'prefix-collision-json' || mode === 'wrong-executable-json') {
        const p = {
          ProcessId: foreignPid,
          Name: mode === 'wrong-executable-json' ? 'knowledge.exe' : 'msedge.exe',
          ExecutablePath: mode === 'wrong-executable-json' ? 'C:\\Other\\knowledge.exe' : 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir=${profile}${mode === 'prefix-collision-json' ? '-other' : ''}`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        };
        cb(null, state.forced.includes(foreignPid) ? '' : JSON.stringify(p), '');
        return;
      }
    }
    throw Error('Unexpected command: ' + file + ' ' + command);
  }

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: fakeSpawn,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: mode });
  profile = h.profileDir;

  const close = await adapter.close(h);
  const first = {
    close,
    profileExists: fs.existsSync(profile),
    tracked: adapter.getTrackedProcessCount(),
    owned: adapter.getOwnedProfileCount(),
  };

  let failedDispose;
  if (mode === 'query-error' || mode === 'malformed' || mode === 'malformed-json') {
    const res = await adapter.dispose();
    failedDispose = {
      result: res,
      profileExists: fs.existsSync(profile),
      tracked: adapter.getTrackedProcessCount(),
      owned: adapter.getOwnedProfileCount(),
    };
  }

  const originalCalls = structuredClone(state.calls);
  const originalForced = [...state.forced];

  state.retry = true;
  const finalDispose = await adapter.dispose();
  assert.equal(finalDispose.ok, true, 'fixture final controlled retry cleanup');
  assert.equal(fs.existsSync(profile), false, 'profile directory must be cleaned after retry succeeds');

  return {
    mode,
    first,
    failedDispose,
    forcedPids: originalForced,
    rootIdentityQueries: state.rootIdentityCount,
    calls: originalCalls,
    finalDispose,
    nativeProcessesTouched: 0,
    defaultWindowsBranch: true,
  };
}

const modes = [
  'query-error',
  'absent-root',
  'query-self-only',
  'foreign-mention',
  'malformed',
  'malformed-json',
  'prefix-collision-json',
  'wrong-executable-json',
];

const results = {};
for (const mode of modes) {
  results[mode] = await runCase(mode);
}

// =========================================================================
// PART 3: Evaluation against Safety Gate Checks
// =========================================================================
console.log('\n[SAFETY GATE EVALUATION]');

const checks = [
  ['W1 exec error retains profile', !results['query-error'].first.close.ok && results['query-error'].failedDispose.profileExists],
  ['W2 absent root cleans only after empty resource query', results['absent-root'].first.close.ok],
  ['W3 query process excluded', results['query-self-only'].forcedPids.length === 0],
  ['W3 foreign profile mention never targeted', results['foreign-mention'].forcedPids.length === 0],
  ['W1 malformed text preserves unknown resources', !results.malformed.first.close.ok && results.malformed.first.profileExists],
  ['W1 malformed JSON preserves unknown resources', !results['malformed-json'].first.close.ok && results['malformed-json'].first.profileExists],
  ['W3 JSON profile prefix collision never targeted', results['prefix-collision-json'].forcedPids.length === 0],
  ['W3 JSON unrelated executable never targeted', results['wrong-executable-json'].forcedPids.length === 0],
];

for (const [name, passed] of checks) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}: ${name}`);
  assert.equal(passed, true, `Safety Gate check FAILED: ${name}`);
}

// =========================================================================
// PART 4: Additional Verification: Legitimate Child Termination & PID Recycling
// =========================================================================
{
  console.log('\n[PROBE 9] Legitimate surviving child process is verified and terminated in Phase 2...');
  const state = { forced: [], queries: 0 };
  const child = new EventEmitter();
  child.pid = 987654710;

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    if (file === 'taskkill.exe') {
      state.forced.push(Number(args[1]));
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      const m = command.match(/ProcessId = (\d+)/);
      const qPid = m ? Number(m[1]) : 987655001;
      cb(null, JSON.stringify({
        ProcessId: qPid,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profile}"`,
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
        // Child worker process 987655001 is legitimately surviving
        cb(null, JSON.stringify({
          ProcessId: 987655001,
          Name: 'msedge.exe',
          ExecutablePath: 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir="${profile}"`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        }), '');
      } else {
        // Second query after taskkill: all gone
        cb(null, '', '');
      }
      return;
    }
    throw Error('unexpected: ' + file);
  }

  let profile;
  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'legit-child' });
  profile = h.profileDir;

  const closeRes = await adapter.close(h);
  assert.equal(closeRes.ok, true);
  assert.deepEqual(state.forced, [987655001], 'Must target legitimate surviving child PID');
  assert.equal(fs.existsSync(profile), false, 'Profile cleanly deleted after confirmed termination');
  console.log('  -> PASS');
}

{
  console.log('[PROBE 10] PID recycled before Phase 2 taskkill: must NOT kill and must retain profile...');
  const state = { forced: [] };
  const child = new EventEmitter();
  child.pid = 987654710;

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    if (file === 'taskkill.exe') {
      state.forced.push(Number(args[1]));
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      if (command.includes('987655001')) {
        // Child PID 987655001 was recycled by OS! Exit 1 (mismatched)
        cb(Object.assign(Error('recycled'), { code: 1 }), '', '');
        return;
      }
      const m = command.match(/ProcessId = (\d+)/);
      const qPid = m ? Number(m[1]) : 987654710;
      cb(null, JSON.stringify({
        ProcessId: qPid,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profile}"`,
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
      cb(null, JSON.stringify({
        ProcessId: 987655001,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profile}"`,
        CreationDate: '2026-10-18T01:00:00.000Z',
      }), '');
      return;
    }
    throw Error('unexpected: ' + file);
  }

  let profile;
  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Synthetic\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'recycled-child' });
  profile = h.profileDir;

  const closeRes = await adapter.close(h);
  assert.equal(closeRes.ok, false);
  assert.equal(state.forced.length, 0, 'Must NOT taskkill a recycled PID!');
  assert.equal(fs.existsSync(profile), true, 'Profile must be preserved when PID is recycled');

  console.log('  -> PASS');
}

console.log('\n--- ALL SIXTH REVIEW VERIFICATION PROBES PASSED! ---');

function isResourceGroupQuery(command) {
 if (command.includes('CommandLine like')) return true;
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 return Boolean(b64 && Buffer.from(b64,'base64').toString('utf8').startsWith('CommandLine like'));
}
