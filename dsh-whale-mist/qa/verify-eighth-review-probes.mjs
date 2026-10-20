import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import {
  createEdgeWindowAdapter,
  extractUserDataDir,
  classifyProcessRecord,
  isControlledEdgeProcess,
  parseCreationDate,
  normalizeWindowsPath,
  checkWindowsProcessIdentity,
} from '../src/detachable-edge-adapter.js';

console.log('--- Running Eighth Review Verification Probes (W3 Full Path & Creation Identity Verification) ---');

// =========================================================================
// PART 1: Unit Verification of CreationDate, Full Path, and Contradictions
// =========================================================================
{
  console.log('[UNIT 1] parseCreationDate, normalizeWindowsPath & classifyProcessRecord boundaries...');

  // WMI formats
  assert.equal(parseCreationDate('/Date(1792295139249)/'), 1792295139249);
  assert.equal(parseCreationDate('/Date(1792295139249+0800)/'), 1792295139249);
  assert.equal(parseCreationDate('/Date(1792295139249-0500)/'), 1792295139249);

  // ISO formats
  const isoMs = parseCreationDate('2026-10-18T01:00:00.000Z');
  assert.equal(typeof isoMs, 'number');
  assert.ok(Number.isFinite(isoMs) && isoMs > 0);

  // Finite numbers
  assert.equal(parseCreationDate(1792295139249), 1792295139249);

  // Invalid / corrupt formats must return null:
  assert.equal(parseCreationDate(null), null);
  assert.equal(parseCreationDate(undefined), null);
  assert.equal(parseCreationDate(''), null);
  assert.equal(parseCreationDate('   '), null);
  assert.equal(parseCreationDate('invalid-creation-time'), null);
  assert.equal(parseCreationDate(NaN), null);
  assert.equal(parseCreationDate(Infinity), null);
  assert.equal(parseCreationDate(-100), null);
  assert.equal(parseCreationDate({}), null);

  // Path normalization
  assert.equal(
    normalizeWindowsPath('C:\\Synthetic\\msedge.exe'),
    normalizeWindowsPath('c:/synthetic/msedge.exe')
  );

  const profile = 'C:\\temp\\test-p8';
  const expectedExe = 'C:\\Synthetic\\msedge.exe';

  // 1. Missing ExecutablePath
  const missingExe = {
    ProcessId: 1001,
    Name: 'msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  const mRes = classifyProcessRecord(missingExe, profile, expectedExe);
  assert.equal(mRes.status, 'insufficient-info');
  assert.equal(mRes.reason, 'missing-executable-path');

  // 2. Same executable name in DIFFERENT directory (W3-B)
  const diffDirExe = {
    ProcessId: 1002,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\ForeignApplication\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  const dRes = classifyProcessRecord(diffDirExe, profile, expectedExe);
  assert.equal(dRes.status, 'foreign-executable');
  assert.equal(dRes.reason, 'unmatched-executable-path');

  // 3. Legitimate canonicalized executable path match
  const canonExe = {
    ProcessId: 1003,
    Name: 'msedge.exe',
    ExecutablePath: 'c:/synthetic/msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  const cRes = classifyProcessRecord(canonExe, profile, expectedExe);
  assert.equal(cRes.status, 'controlled');

  // 4. Name / ExecutablePath contradiction
  const contradiction = {
    ProcessId: 1004,
    Name: 'powershell.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  const conRes = classifyProcessRecord(contradiction, profile, expectedExe);
  assert.equal(conRes.status, 'foreign-executable');
  assert.equal(conRes.reason, 'name-executablepath-contradiction');

  // 5. Missing / corrupt current CreationDate (W3-A)
  const corruptCurrentTime = {
    ProcessId: 1005,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: 'invalid-creation-time',
  };
  const curRes = classifyProcessRecord(corruptCurrentTime, profile, expectedExe);
  assert.equal(curRes.status, 'insufficient-info');
  assert.equal(curRes.reason, 'missing-or-invalid-creation-date');

  // 6. Missing / corrupt expectedCreationDate (W3-A)
  const validProc = {
    ProcessId: 1006,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  };
  const expRes = classifyProcessRecord(validProc, profile, expectedExe, 'invalid-creation-time');
  assert.equal(expRes.status, 'insufficient-info');
  assert.equal(expRes.reason, 'missing-or-invalid-expected-creation-date');

  // 7. Legitimate matching CreationDate with identical epoch across formats (WMI, ISO, numeric, ISO w/ tz)
  const baseEpoch = Date.parse('2026-10-18T01:00:00.000Z');
  const equivalentFormats = [
    '2026-10-18T01:00:00.000Z',
    `/Date(${baseEpoch})/`,
    `/Date(${baseEpoch}+0800)/`,
    '2026-10-18T09:00:00.000+08:00',
    baseEpoch,
  ];
  for (const fmt of equivalentFormats) {
    const matchRes = classifyProcessRecord(validProc, profile, expectedExe, fmt);
    assert.equal(matchRes.status, 'controlled', `Format ${fmt} should match identical epoch`);
  }

  // 8. CreationDate mismatch (foreign-recycled) - zero tolerance: ANY difference even 1ms is rejected!
  const differingTimes = [
    '2026-10-18T01:00:00.001Z', // +1ms
    '2026-10-18T00:59:59.999Z', // -1ms
    '2026-10-18T01:00:00.500Z', // +500ms
    '2026-10-18T01:00:01.000Z', // +1000ms
    '2026-10-18T01:00:01.001Z', // +1001ms
    '2026-10-18T02:00:00.000Z', // +1h
    baseEpoch + 1,
    baseEpoch - 1,
    `/Date(${baseEpoch + 500})/`,
  ];
  for (const diffTime of differingTimes) {
    const recRes = classifyProcessRecord(validProc, profile, expectedExe, diffTime);
    assert.equal(recRes.status, 'foreign-recycled', `Time ${diffTime} must be rejected as foreign-recycled`);
    assert.equal(recRes.reason, 'creation-date-mismatch');
  }

  console.log('  -> PASS');
}

// =========================================================================
// PART 2: Codex Eighth Review 4 Isolation Cases (incomplete-identity-probes)
// =========================================================================
async function runEighthReviewCase(scenario) {
  const rootPid = 987654710, subPid = 987655001;
  const state = { scenario, calls: [], forced: [], snapshotQueries: 0, identityQueries: [], preActionCount: 0, recovered: false };
  let child, profile;

  function fakeSpawn() {
    child = new EventEmitter();
    child.pid = rootPid;
    child.kill = () => { throw Error('Unexpected native child.kill'); };
    return child;
  }

  const baselineExe = 'C:\\Synthetic\\msedge.exe';

  // Legitimate controlled snapshot
  const controlled = (pid, exe = baselineExe, creation = '2026-10-18T01:00:00.000Z') => ({
    ProcessId: pid,
    Name: 'msedge.exe',
    ExecutablePath: exe,
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: creation,
  });

  function getScanSnapshot(pid) {
    if (state.recovered || state.forced.length) return null;
    if (scenario === 'sub-missing-baseline-creation-date') {
      const p = controlled(pid);
      delete p.CreationDate;
      return p;
    }
    if (scenario === 'sub-foreign-executable-path') {
      return controlled(pid, 'C:\\ForeignApplication\\msedge.exe');
    }
    return controlled(pid);
  }

  function getPreActionProcess(pid) {
    if (pid !== subPid) return controlled(pid);
    if (scenario === 'sub-missing-current-creation-date') {
      const p = controlled(pid);
      delete p.CreationDate;
      return p;
    }
    if (scenario === 'sub-invalid-current-creation-date') {
      return controlled(pid, baselineExe, 'invalid-creation-time');
    }
    if (scenario === 'sub-foreign-executable-path') {
      return controlled(pid, 'C:\\ForeignApplication\\msedge.exe');
    }
    if (scenario === 'sub-creation-diff-1ms') {
      return controlled(pid, baselineExe, '2026-10-18T01:00:00.001Z');
    }
    if (scenario === 'sub-creation-diff-500ms') {
      return controlled(pid, baselineExe, '2026-10-18T01:00:00.500Z');
    }
    if (scenario === 'sub-creation-diff-1000ms') {
      return controlled(pid, baselineExe, '2026-10-18T01:00:01.000Z');
    }
    if (scenario === 'sub-creation-diff-1001ms') {
      return controlled(pid, baselineExe, '2026-10-18T01:00:01.001Z');
    }
    if (scenario === 'sub-creation-identical-wmi') {
      const baseEpoch = Date.parse('2026-10-18T01:00:00.000Z');
      return controlled(pid, baselineExe, `/Date(${baseEpoch})/`);
    }
    return controlled(pid);
  }

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    state.calls.push({ file, args, command });

    if (file === 'taskkill.exe') {
      const pid = Number(args[1]);
      state.forced.push({ pid, args });
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      const pid = Number(command.match(/ProcessId = (\d+)/)[1]);
      const current = getPreActionProcess(pid);
      state.identityQueries.push({ pid, current });
      cb(null, JSON.stringify(current), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      state.snapshotQueries++;
      if (state.recovered || state.forced.length) {
        cb(null, '', '');
        return;
      }
      const snap = getScanSnapshot(subPid);
      if (!snap) {
        cb(null, '', '');
        return;
      }
      cb(null, JSON.stringify(snap), '');
      return;
    }
    throw Error('Unexpected IO ' + file + ' ' + command);
  }

  const adapter = createEdgeWindowAdapter({
    edgePath: baselineExe,
    findEdge: () => ({ available: true, path: baselineExe }),
    spawnProcess: fakeSpawn,
    execCommand: fakeExec,
    gracefulTimeoutMs: 1,
  });

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: scenario });
  profile = h.profileDir;

  const close = await adapter.close(h);
  const result = {
    scenario,
    close,
    forced: structuredClone(state.forced),
    identityQueries: structuredClone(state.identityQueries),
    profileExists: fs.existsSync(profile),
  };

  // Recovery verification
  state.recovered = true;
  child.emit('exit', 0);
  const disposeRes = await adapter.dispose();
  assert.equal(disposeRes.ok, true, `recovery cleanup must succeed for scenario ${scenario}`);

  return result;
}

const eighthScenarios = [
  'sub-missing-current-creation-date',
  'sub-invalid-current-creation-date',
  'sub-missing-baseline-creation-date',
  'sub-foreign-executable-path',
  'sub-creation-diff-1ms',
  'sub-creation-diff-500ms',
  'sub-creation-diff-1000ms',
  'sub-creation-diff-1001ms',
  'sub-creation-identical-wmi',
];

console.log('\n[EVALUATION OF CODEX EIGHTH & NINTH REVIEW ISOLATION SCENARIOS]');
for (const scenario of eighthScenarios) {
  const res = await runEighthReviewCase(scenario);
  console.log(`  Scenario: ${res.scenario} | Close Ok: ${res.close.ok} | Error: ${res.close.error} | Forced Targets: ${res.forced.length} | Profile Preserved: ${res.profileExists}`);
  if (scenario === 'sub-creation-identical-wmi') {
    assert.equal(res.close.ok, true, `Identical WMI epoch must succeed close`);
    assert.equal(res.forced.length, 1, `Legitimate child must be terminated`);
    assert.equal(res.profileExists, false, `Profile must be cleaned up`);
  } else if (scenario === 'sub-foreign-executable-path') {
    assert.equal(res.forced.length, 0, `Safety violation: targetted PID in scenario ${res.scenario}`);
    assert.equal(res.close.ok, true);
  } else {
    assert.equal(res.forced.length, 0, `Safety violation: targetted PID in scenario ${res.scenario}`);
    assert.equal(res.close.ok, false, `Close must NOT succeed in scenario ${res.scenario}`);
    assert.equal(res.profileExists, true, `Profile MUST be preserved in scenario ${res.scenario}`);
  }
}
console.log('  -> All isolation cases PASSED with 0 forced targets on mismatched identity!');

// =========================================================================
// PART 3: Seventh Review 3 PID-Recycling Cases Regression
// =========================================================================
async function runSeventhReviewRegressionCase(mode) {
  const rootPid = 987654710, subPid = 987655001;
  const state = { mode, calls: [], forced: [], recycled: false, recovered: false };
  let child, profile;

  function fakeSpawn() {
    child = new EventEmitter();
    child.pid = rootPid;
    child.kill = () => { throw Error('Unexpected native child.kill'); };
    return child;
  }

  const controlled = pid => ({
    ProcessId: pid,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T01:00:00.000Z',
  });

  function currentProcess(pid) {
    if (!state.recycled || pid !== (mode === 'root-recycled' ? rootPid : subPid)) return controlled(pid);
    return mode === 'sub-prefix-recycled'
      ? { ...controlled(pid), CommandLine: `msedge.exe --user-data-dir="${profile}-other"`, CreationDate: '2026-10-18T02:00:00.000Z' }
      : {
          ProcessId: pid,
          Name: 'powershell.exe',
          ExecutablePath: 'C:\\Windows\\powershell.exe',
          CommandLine: `powershell.exe -Command Write-Output '${profile}'`,
          CreationDate: '2026-10-18T02:00:00.000Z',
        };
  }

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    state.calls.push({ file, args });

    if (file === 'taskkill.exe') {
      const pid = Number(args[1]);
      state.forced.push({ pid, currentProcess: currentProcess(pid), args });
      if (mode === 'root-recycled') child.emit('exit', 1);
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      const pid = Number(command.match(/ProcessId = (\d+)/)[1]);
      const current = currentProcess(pid);
      cb(null, JSON.stringify(current), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      if (mode !== 'root-recycled') child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      if (state.recovered || state.forced.length) {
        cb(null, '', '');
        return;
      }
      const pid = mode === 'root-recycled' ? rootPid : subPid;
      const snapshot = controlled(pid);
      state.recycled = true;
      cb(null, JSON.stringify(snapshot), '');
      return;
    }
    throw Error('Unexpected IO ' + file);
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
  state.recovered = true;
  child.emit('exit', 0);
  await adapter.dispose();

  assert.equal(state.forced.length, 0, `Regression failure: targetted PID in mode ${mode}`);
  assert.equal(close.ok, false);
}

console.log('\n[EVALUATION OF SEVENTH REVIEW REGRESSION SCENARIOS]');
for (const m of ['sub-shell-recycled', 'sub-prefix-recycled', 'root-recycled']) {
  await runSeventhReviewRegressionCase(m);
  console.log(`  Mode: ${m} -> PASS (0 forced targets)`);
}

// =========================================================================
// PART 4: Root Process Pre-Action Boundary Tests
// =========================================================================
console.log('\n[EVALUATION OF ROOT PROCESS PRE-ACTION BOUNDARIES]');
{
  // Root with foreign executable path
  const rootPid = 987654710;
  const state = { forced: [] };
  const child = new EventEmitter();
  child.pid = rootPid;

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    if (file === 'taskkill.exe') {
      state.forced.push(Number(args[1]));
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      // Root process in OS has foreign executable path
      cb(null, JSON.stringify({
        ProcessId: rootPid,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\ForeignApplication\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profile}"`,
        CreationDate: '2026-10-18T01:00:00.000Z',
      }), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      cb(null, '', '');
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

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'root-foreign-exe' });
  profile = h.profileDir;

  const closeRes = await adapter.close(h);
  assert.equal(closeRes.ok, false);
  assert.equal(state.forced.length, 0, 'Root must NOT be killed when ExecutablePath does not match');
  assert.equal(fs.existsSync(profile), true, 'Profile must be preserved');
  console.log('  Root foreign executable path -> PASS');
}

{
  // Root with recycled CreationDate (+500ms difference)
  const rootPid = 987654710;
  const state = { forced: [], recycled: false };
  const child = new EventEmitter();
  child.pid = rootPid;

  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const command = args.at(-1) || '';
    if (file === 'taskkill.exe') {
      state.forced.push(Number(args[1]));
      cb(null, '', '');
      return;
    }
    if (command.includes('ProcessId =')) {
      const creation = state.recycled ? '2026-10-18T01:00:00.500Z' : '2026-10-18T01:00:00.000Z';
      cb(null, JSON.stringify({
        ProcessId: rootPid,
        Name: 'msedge.exe',
        ExecutablePath: 'C:\\Synthetic\\msedge.exe',
        CommandLine: `msedge.exe --user-data-dir="${profile}"`,
        CreationDate: creation,
      }), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      state.recycled = true;
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      cb(null, '', '');
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

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'root-recycled-500ms' });
  profile = h.profileDir;

  const closeRes = await adapter.close(h);
  assert.equal(closeRes.ok, false);
  assert.equal(state.forced.length, 0, 'Root must NOT be killed when CreationDate differs (+500ms)');
  assert.equal(fs.existsSync(profile), true, 'Profile must be preserved');
  console.log('  Root recycled CreationDate (+500ms) -> PASS');
}

// =========================================================================
// PART 5: Returned PID Mismatch Verification
// =========================================================================
console.log('\n[EVALUATION OF RETURNED PID MISMATCH VERIFICATION]');
{
  function fakeExec(file, args, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    cb(null, JSON.stringify({
      ProcessId: 999999999, // Mismatched returned PID!
      Name: 'msedge.exe',
      ExecutablePath: 'C:\\Synthetic\\msedge.exe',
      CommandLine: 'msedge.exe --user-data-dir="C:\\temp"',
      CreationDate: '2026-10-18T01:00:00.000Z',
    }), '');
  }

  const res = await checkWindowsProcessIdentity(
    12345,
    'C:\\temp',
    'C:\\Synthetic\\msedge.exe',
    fakeExec,
    '2026-10-18T01:00:00.000Z'
  );
  assert.equal(res.status, 'mismatched');
  assert.equal(res.reason, 'returned-pid-mismatch');
  console.log('  Returned PID mismatch check -> PASS');
}

// =========================================================================
// PART 6: Legitimate Controlled Process Termination & Cleanup
// =========================================================================
console.log('\n[EVALUATION OF LEGITIMATE CONTROLLED PROCESS TERMINATION]');
{
  const state = { forced: [], queries: 0 };
  const child = new EventEmitter();
  child.pid = 987654710;
  const subPid = 987655001;

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
      state.queries++;
      if (state.queries === 1) {
        cb(null, JSON.stringify({
          ProcessId: subPid,
          Name: 'msedge.exe',
          ExecutablePath: 'C:\\Synthetic\\msedge.exe',
          CommandLine: `msedge.exe --user-data-dir="${profile}"`,
          CreationDate: '2026-10-18T01:00:00.000Z',
        }), '');
      } else {
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

  const h = await adapter.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'legit' });
  profile = h.profileDir;

  const closeRes = await adapter.close(h);
  assert.equal(closeRes.ok, true);
  assert.deepEqual(state.forced, [subPid], 'Legitimate controlled child must be targeted');
  assert.equal(fs.existsSync(profile), false, 'Profile directory cleanly deleted');
  console.log('  Legitimate child termination & cleanup -> PASS');
}

console.log('\n--- ALL EIGHTH REVIEW VERIFICATION PROBES PASSED! ---');

function isResourceGroupQuery(command) {
 if (command.includes('CommandLine like')) return true;
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 return Boolean(b64 && Buffer.from(b64,'base64').toString('utf8').startsWith('CommandLine like'));
}
