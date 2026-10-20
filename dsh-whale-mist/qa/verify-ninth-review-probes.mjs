import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import {
  createEdgeWindowAdapter,
  classifyProcessRecord,
  parseCreationDate,
  normalizeWindowsPath,
  checkWindowsProcessIdentity,
} from '../src/detachable-edge-adapter.js';

console.log('--- Running Ninth Review Verification Probes (Strict Zero-Tolerance Creation Identity & Lifecycle Probes) ---');

// =========================================================================
// PART 1: Representation Normalization vs Non-Zero Deltas
// =========================================================================
{
  console.log('[UNIT 1] Strict zero-tolerance CreationDate equality & representation equivalence...');

  const baseIso = '2026-10-18T01:00:00.000Z';
  const baseEpoch = Date.parse(baseIso);
  const profile = 'C:\\temp\\test-p9';
  const expectedExe = 'C:\\Synthetic\\msedge.exe';

  const validProc = {
    ProcessId: 1006,
    Name: 'msedge.exe',
    ExecutablePath: expectedExe,
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: baseIso,
  };

  // 1. Equivalent representations of the EXACT same epoch moment must all match:
  const equivalentFormats = [
    baseIso,
    `/Date(${baseEpoch})/`,
    `/Date(${baseEpoch}+0800)/`,
    `/Date(${baseEpoch}-0500)/`,
    '2026-10-18T09:00:00.000+08:00',
    '2026-10-17T20:00:00.000-05:00',
    baseEpoch,
  ];
  for (const fmt of equivalentFormats) {
    const res = classifyProcessRecord(validProc, profile, expectedExe, fmt);
    assert.equal(res.status, 'controlled', `Identical epoch moment (${fmt}) must be classified as controlled`);
    assert.equal(res.creationDate, baseEpoch);
  }

  // 2. Strict zero-tolerance: ANY timestamp delta must be classified as foreign-recycled
  const deltaCases = [
    { label: '+1ms', val: '2026-10-18T01:00:00.001Z' },
    { label: '-1ms', val: '2026-10-18T00:59:59.999Z' },
    { label: '+500ms', val: '2026-10-18T01:00:00.500Z' },
    { label: '-500ms', val: '2026-10-18T00:59:59.500Z' },
    { label: '+1000ms', val: '2026-10-18T01:00:01.000Z' },
    { label: '-1000ms', val: '2026-10-18T00:59:59.000Z' },
    { label: '+1001ms', val: '2026-10-18T01:00:01.001Z' },
    { label: '-1001ms', val: '2026-10-18T00:59:58.999Z' },
    { label: '+1hr', val: '2026-10-18T02:00:00.000Z' },
    { label: 'numeric +1ms', val: baseEpoch + 1 },
    { label: 'numeric -1ms', val: baseEpoch - 1 },
    { label: 'WMI +500ms', val: `/Date(${baseEpoch + 500})/` },
    { label: 'WMI +1000ms', val: `/Date(${baseEpoch + 1000})/` },
  ];

  for (const { label, val } of deltaCases) {
    const res = classifyProcessRecord(validProc, profile, expectedExe, val);
    assert.equal(res.status, 'foreign-recycled', `Delta case ${label} (${val}) must be rejected as foreign-recycled`);
    assert.equal(res.reason, 'creation-date-mismatch');
  }

  console.log('  -> PASS');
}

// =========================================================================
// PART 2: Codex Ninth Review Lifecycle Boundary Matrix
// =========================================================================
async function runNinthReviewBoundaryCase(scenario) {
  const rootPid = 987654710, subPid = 987655001;
  const state = { scenario, calls: [], forced: [], rootExited: false, recovered: false };
  let child, profile;

  function fakeSpawn() {
    child = new EventEmitter();
    child.pid = rootPid;
    child.kill = () => { throw Error('Unexpected native child.kill'); };
    return child;
  }

  const baselineExe = 'C:\\Synthetic\\msedge.exe';
  const baseTime = '2026-10-18T01:00:00.000Z';
  const baseEpoch = Date.parse(baseTime);

  const controlled = (pid, exe = baselineExe, creation = baseTime) => ({
    ProcessId: pid,
    Name: 'msedge.exe',
    ExecutablePath: exe,
    CommandLine: `msedge.exe --user-data-dir="${profile}"`,
    CreationDate: creation,
  });

  function getPreActionProcess(pid) {
    if (pid === rootPid) {
      if (scenario === 'root-creation-diff-500ms' && state.rootExited) {
        // Root recycled after window close failed
        return controlled(pid, baselineExe, '2026-10-18T01:00:00.500Z');
      }
      return controlled(pid);
    }
    if (pid === subPid) {
      switch (scenario) {
        case 'sub-creation-diff-1ms':
          return controlled(pid, baselineExe, '2026-10-18T01:00:00.001Z');
        case 'sub-creation-diff-500ms':
          return controlled(pid, baselineExe, '2026-10-18T01:00:00.500Z');
        case 'sub-creation-diff-1000ms':
          return controlled(pid, baselineExe, '2026-10-18T01:00:01.000Z');
        case 'sub-creation-diff-1001ms':
          return controlled(pid, baselineExe, '2026-10-18T01:00:01.001Z');
        case 'sub-creation-exact-match':
          return controlled(pid, baselineExe, baseTime);
        case 'sub-creation-identical-wmi':
          return controlled(pid, baselineExe, `/Date(${baseEpoch})/`);
        default:
          return controlled(pid);
      }
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
      cb(null, JSON.stringify(current), '');
      return;
    }
    if (command.includes('CloseMainWindow')) {
      if (scenario !== 'root-creation-diff-500ms') {
        child.emit('exit', 0);
      } else {
        state.rootExited = true; // window close did not terminate root
      }
      cb(null, '', '');
      return;
    }
    if (isResourceGroupQuery(command)) {
      if (state.recovered || state.forced.length) {
        cb(null, '', '');
        return;
      }
      if (scenario === 'root-creation-diff-500ms') {
        cb(null, '', '');
        return;
      }
      cb(null, JSON.stringify(controlled(subPid, baselineExe, baseTime)), '');
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
    profileExists: fs.existsSync(profile),
  };

  // Recovery cleanup
  state.recovered = true;
  child.emit('exit', 0);
  await adapter.dispose();

  return result;
}

console.log('\n[EVALUATION OF CODEX NINTH REVIEW BOUNDARY MATRIX]');
const ninthMatrix = [
  { scenario: 'sub-creation-diff-1ms', expectedClose: false, expectedForced: 0, expectProfilePreserved: true },
  { scenario: 'sub-creation-diff-500ms', expectedClose: false, expectedForced: 0, expectProfilePreserved: true },
  { scenario: 'sub-creation-diff-1000ms', expectedClose: false, expectedForced: 0, expectProfilePreserved: true },
  { scenario: 'sub-creation-diff-1001ms', expectedClose: false, expectedForced: 0, expectProfilePreserved: true },
  { scenario: 'root-creation-diff-500ms', expectedClose: false, expectedForced: 0, expectProfilePreserved: true },
  { scenario: 'sub-creation-exact-match', expectedClose: true, expectedForced: 1, expectProfilePreserved: false },
  { scenario: 'sub-creation-identical-wmi', expectedClose: true, expectedForced: 1, expectProfilePreserved: false },
];

for (const row of ninthMatrix) {
  const res = await runNinthReviewBoundaryCase(row.scenario);
  console.log(`  Scenario: ${res.scenario.padEnd(28)} | Close Ok: ${String(res.close.ok).padEnd(5)} | Forced: ${res.forced.length} | Profile Preserved: ${res.profileExists}`);
  assert.equal(res.close.ok, row.expectedClose, `Close result mismatch for ${row.scenario}`);
  assert.equal(res.forced.length, row.expectedForced, `Forced count mismatch for ${row.scenario}`);
  assert.equal(res.profileExists, row.expectProfilePreserved, `Profile preservation mismatch for ${row.scenario}`);
}

console.log('  -> All 7 Codex Ninth Review boundary matrix scenarios PASSED!');
console.log('\n--- ALL NINTH REVIEW VERIFICATION PROBES PASSED! ---');

function isResourceGroupQuery(command) {
 if (command.includes('CommandLine like')) return true;
 const b64 = command.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 return Boolean(b64 && Buffer.from(b64,'base64').toString('utf8').startsWith('CommandLine like'));
}
