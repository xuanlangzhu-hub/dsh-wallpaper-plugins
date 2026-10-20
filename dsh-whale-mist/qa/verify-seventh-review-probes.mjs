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
  checkWindowsProcessIdentity,
} from '../src/detachable-edge-adapter.js';

console.log('--- Running Seventh Review Verification Probes (W3 Pre-Action Identity & Recycled Defenses) ---');

// =========================================================================
// PART 1: Unit Verification of CreationDate and Contradiction Defense
// =========================================================================
{
  console.log('[UNIT 1] parseCreationDate & Contradiction / Recycled Classification...');
  const t1 = parseCreationDate('/Date(1792295139249)/');
  assert.equal(t1, 1792295139249);
  const t2 = parseCreationDate('2026-10-18T01:00:00.000Z');
  assert.equal(typeof t2, 'number');

  const profile = 'C:\\temp\\test-p7';

  // Contradiction: Name is powershell.exe but ExecutablePath claims msedge.exe
  const contradiction = {
    ProcessId: 1001,
    Name: 'powershell.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
  };
  const cRes = classifyProcessRecord(contradiction, profile, 'C:\\Synthetic\\msedge.exe');
  assert.equal(cRes.status, 'foreign-executable');
  assert.equal(cRes.reason, 'name-executablepath-contradiction');

  // CreationDate mismatch (PID reused by newly created process)
  const reusedProc = {
    ProcessId: 1002,
    Name: 'msedge.exe',
    ExecutablePath: 'C:\\Synthetic\\msedge.exe',
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: '2026-10-18T02:00:00.000Z',
  };
  const rRes = classifyProcessRecord(reusedProc, profile, 'C:\\Synthetic\\msedge.exe', '2026-10-18T01:00:00.000Z');
  assert.equal(rRes.status, 'foreign-recycled');
  assert.equal(rRes.reason, 'creation-date-mismatch');

  console.log('  -> PASS');
}

// =========================================================================
// PART 2: Codex Seventh Review 3 Adversarial VM Reproduction Cases
// =========================================================================
async function runCodexCase(mode) {
  const rootPid = 987654710, subPid = 987655001;
  const state = { mode, calls: [], forced: [], snapshotQueries: 0, identityQueries: [], recycled: false, recovered: false };
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
      state.identityQueries.push({ pid, recycled: state.recycled, current });
      if (command.includes('ConvertTo-Json')) {
        cb(null, JSON.stringify(current), '');
      } else if (command.includes('.CommandLine -like') && current.CommandLine.includes(profile)) {
        cb(null, '', '');
      } else {
        throw Error('Unmodelled identity predicate');
      }
      return;
    }
    if (command.includes('CloseMainWindow')) {
      if (mode !== 'root-recycled') child.emit('exit', 0);
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      state.snapshotQueries++;
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
  const result = {
    mode,
    close,
    forced: structuredClone(state.forced),
    identityQueries: structuredClone(state.identityQueries),
    commands: structuredClone(state.calls),
    profileExists: fs.existsSync(profile),
    defaultWindowsBranch: true,
    actualNativeProcessesTouched: 0,
  };

  state.recovered = true;
  child.emit('exit', 0);
  const disposeRes = await adapter.dispose();
  assert.equal(disposeRes.ok, true, 'controlled fixture cleanup');

  return result;
}

const modes = ['sub-shell-recycled', 'sub-prefix-recycled', 'root-recycled'];
const results = [];
for (const mode of modes) {
  const res = await runCodexCase(mode);
  results.push(res);
}

console.log('\n[EVALUATION OF CODEX SEVENTH REVIEW SAFETY GATE]');
const failures = results.filter(r => r.forced.length);
for (const r of results) {
  console.log(`  Mode: ${r.mode} | Close Ok: ${r.close.ok} | Error: ${r.close.error} | Forced Targets: ${r.forced.length} | Profile Preserved: ${r.profileExists}`);
  assert.equal(r.forced.length, 0, `Safety violation: targetted foreign/recycled PID in mode ${r.mode}`);
  assert.equal(r.close.ok, false, `Close must NOT succeed when PID recycling is detected in mode ${r.mode}`);
  assert.equal(r.profileExists, true, `Profile MUST be preserved when PID recycling is detected in mode ${r.mode}`);
}
assert.equal(failures.length, 0, 'Zero safety failures allowed');
console.log('  -> All 3 Codex adversarial cases PASSED with 0 forced targets and 100% profile preservation!');

// =========================================================================
// PART 3: Verification of Legitimate Controlled Processes Termination
// =========================================================================
{
  console.log('\n[PROBE 4] Legitimate controlled child process is verified and killed in Phase 2...');
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
          ProcessId: 987655001,
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
  assert.deepEqual(state.forced, [987655001], 'Legitimate controlled child must be targeted');
  assert.equal(fs.existsSync(profile), false, 'Profile directory cleanly deleted');
  console.log('  -> PASS');
}

console.log('\n--- ALL SEVENTH REVIEW VERIFICATION PROBES PASSED! ---');

function isResourceGroupQuery(command) {
 if (command.includes('CommandLine like')) return true;
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 return Boolean(b64 && Buffer.from(b64,'base64').toString('utf8').startsWith('CommandLine like'));
}
