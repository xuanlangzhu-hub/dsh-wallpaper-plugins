import { EventEmitter } from 'node:events';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createPreviewSession, registerWallpaperRoutes, queryWindowsProcesses, queryWindowsProcessCreationUtc, areStartUtcsEquivalent, parseIsoStartUtc } from '../../src/wallpaper/session.js';
import { normalizeWindow } from '../../src/wallpaper/managed-window.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const testOutputDir = join(root, '.tmp-verify-b-review-probes');
await rm(testOutputDir, { recursive: true, force: true }).catch(() => {});
await mkdir(testOutputDir, { recursive: true });

const raw = JSON.parse(await readFile('F:/dsh-wallpaper-plugins/.tmp/daily-incidents-20261018-ede83704/logs/taskbar-action.json', 'utf8'));
const birth = raw.requestedIdentity.startUtc;
const results = [];

console.log('=== PART 1: Parser verification on invalid raw stdout ===');
for (const [name, stdout] of [['empty-object', '{}'], ['missing-pid', '[{"Name":"WallpaperProbe.exe"}]'], ['invalid-row', '[null]']]) {
  const query = await queryWindowsProcesses('WhaleWallpaperProbe-review', { execCommand: (_f, _a, _o, cb) => cb(null, stdout) });
  results.push({ kind: 'parser', name, stdout, query });
  assert.equal(query.ok, false, `parser for ${name} must reject corrupted stdout`);
  assert.equal(query.processes.length, 0);
  console.log(`  PASS: parser correctly rejected ${name} -> ${query.error}`);
}

console.log('\n=== PART 1B: Strict ISO Time Equivalence & Calendar Contract ===');
for (const [name, a, b, expected] of [
  ['zero-fraction-control', '2026-10-17T09:20:20.0000000Z', '2026-10-17T09:20:20Z', true],
  ['nonzero-fraction-omitted', '2026-10-17T09:20:20.0005000Z', '2026-10-17T09:20:20Z', false],
  ['invalid-calendar', '2026-03-02T09:20:20Z', '2026-02-30T09:20:20Z', false],
  ['timezone-equivalent', '2026-10-17T09:20:20.6092543Z', '2026-10-17T17:20:20.6092543+08:00', true],
]) {
  const actual = areStartUtcsEquivalent(a, b);
  assert.equal(actual, expected, `Time case ${name} must be ${expected}`);
  console.log(`  PASS: ${name} -> areStartUtcsEquivalent=${actual} (expected ${expected})`);
}

console.log('\n=== PART 2: Session default query and proof verification ===');
const probeCases = [
  'valid-control',
  'missing-identity-baseline',
  'real-native-window-shape-recovers',
  'past-birth-mismatch',
  'non-iso-date',
  'iso-equivalent-control',
  'zero-fraction-control',
  'nonzero-fraction-omitted',
  'invalid-calendar',
  'future-startUtc',
  'missing-identity-and-action',
  'missing-cleanup-safe',
  'exited-false',
  'pending-string',
  'pending-missing',
  'timedOut-string',
  'never-started-terminal',
  'never-started-missing-fields',
  'never-started-conflicting-flags',
  'unsettled-stage-armed',
  'malformed-process-record',
  'no-status-no-action',
  'foreign-location-control',
  'live-worker-control',
];

for (const name of probeCases) {
  const output = join(testOutputDir, name);
  await mkdir(output, { recursive: true });
  const helper = 'C:\\Synthetic\\WallpaperProbe.exe';
  let location, child;
  const calls = [];
  const queries = [];

  let sourceBirth = birth;
  let actionBirth = birth;
  if (name === 'iso-equivalent-control') {
    sourceBirth = '2026-10-17T09:20:20.6092543Z';
    actionBirth = '2026-10-17T09:20:20.6092543+00:00';
  } else if (name === 'zero-fraction-control') {
    sourceBirth = '2026-10-17T09:20:20.0000000Z';
    actionBirth = '2026-10-17T09:20:20Z';
  } else if (name === 'nonzero-fraction-omitted') {
    sourceBirth = '2026-10-17T09:20:20.0005000Z';
    actionBirth = '2026-10-17T09:20:20Z';
  } else if (name === 'invalid-calendar') {
    sourceBirth = '2026-03-02T09:20:20Z';
    actionBirth = '2026-02-30T09:20:20Z';
  } else if (name === 'past-birth-mismatch') {
    actionBirth = '2026-10-17T09:20:21.6092543+00:00';
  } else if (name === 'non-iso-date') {
    actionBirth = 'October 17, 2026';
  } else if (name === 'future-startUtc') {
    actionBirth = '2099-01-01T00:00:00Z';
  }

  const helperRun = async (_file, args) => {
    calls.push(args);
    if (args[0] === '--we-open') {
      location = args[1];
      return { opened: true };
    }
    if (args[0] === '--window-find') {
      const rec = { hwnd: 555, pid: 1122, title: location, visible: true };
      if (name !== 'missing-identity-baseline' && name !== 'real-native-window-shape-recovers') {
        rec.startUtc = sourceBirth;
      }
      return [rec];
    }
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const execCommand = (_file, args, _opts, cb) => {
    queries.push(args);
    const cmdStr = args?.join(' ') || '';
    if (name === 'malformed-process-record') {
      cb(null, '{}');
      return;
    }
    if (name === 'live-worker-control') {
      cb(null, JSON.stringify({
        ProcessId: 7788,
        Name: 'WallpaperProbe.exe',
        ExecutablePath: helper,
        CommandLine: `${helper} --taskbar-worker 555 1122 2026-10-18T00:00:00Z ${location} stop.txt`,
        CreationDate: '2026-10-18T00:00:00Z',
      }));
      return;
    }
    if (name === 'real-native-window-shape-recovers') {
      // Query for process creation time of PID 1122
      if (cmdStr.includes('Get-Process -Id 1122') || cmdStr.includes('ProcessId = 1122') || cmdStr.includes('1122')) {
        cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: sourceBirth }));
        return;
      }
    }
    cb(null, '');
  };

  const session = createPreviewSession({
    helperRun,
    execCommand,
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    spawnChild: () => {
      child = new EventEmitter();
      child.pid = 987654720;
      child.exitCode = null;
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin.end = () => {
        if (child.exitCode === null) {
          child.exitCode = 0;
          child.emit('exit', 0);
          child.emit('close', 0);
        }
      };
      return child;
    },
  });

  await session.create({ helper, output, scene: { scene: 'lucy' } });
  if (name !== 'no-status-no-action') {
    child.stderr.emit('data', JSON.stringify({
      kind: 'log', level: 'info', scope: 'Status',
      message: JSON.stringify({ captureSource: 'window', taskbarHide: { stage: 'action-done', attempted: true } }),
    }) + '\n');
  }

  // Attempt 1: First stop without terminal Summary
  const first = await session.stop();
  assert.equal(first.closed, false);
  assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 0);

  // Setup action file
  let action = {
    ...raw,
    location,
    requestedIdentity: { ...raw.requestedIdentity, hwnd: 555, pid: 1122, startUtc: actionBirth },
    beforeIdentity: { ...raw.beforeIdentity, hwnd: 555, pid: 1122, startUtc: actionBirth },
    action: { ...raw.action, cleanupSafe: true, exited: true, started: true, pending: false, timedOut: false, terminated: false },
  };

  if (name === 'missing-identity-and-action') {
    action = { schemaVersion: 1, location, stage: 'action-done' };
  } else if (name === 'missing-cleanup-safe') {
    delete action.action.cleanupSafe;
  } else if (name === 'exited-false') {
    action.action.exited = false;
  } else if (name === 'pending-string') {
    action.action.pending = 'true';
  } else if (name === 'pending-missing') {
    delete action.action.pending;
  } else if (name === 'timedOut-string') {
    action.action.timedOut = 'true';
  } else if (name === 'never-started-terminal') {
    action.stage = 'stopped-before-action';
    action.action = null;
    action.beforeIdentity = null;
    action.afterIdentity = null;
    action.trigger = null;
  } else if (name === 'never-started-missing-fields') {
    action.stage = 'stopped-before-action';
    action.action = null;
    action.trigger = null;
    delete action.action;
    delete action.trigger;
  } else if (name === 'never-started-conflicting-flags') {
    action.stage = 'stopped-before-action';
    action.trigger = null;
    action.action = { started: 'true', exited: false, cleanupSafe: true, pending: false, timedOut: true, terminated: true };
  } else if (name === 'unsettled-stage-armed') {
    action.stage = 'armed';
    action.action = null;
  } else if (name === 'foreign-location-control') {
    action.location = 'WhaleWallpaperProbe-foreign';
  }

  if (name !== 'no-status-no-action') {
    await writeFile(join(output, 'taskbar-action.json'), JSON.stringify(action));
  }

  // Attempt 2: Retry stop
  const retry = await session.stop();
  const closes = calls.filter(a => a[0] === '--window-ensure-closed').length;

  // Expected repaired behavior:
  // ONLY valid-control, iso-equivalent-control, zero-fraction-control, real-native-window-shape-recovers, and never-started-terminal are allowed to close!
  const expectedClosed = ['valid-control', 'iso-equivalent-control', 'zero-fraction-control', 'real-native-window-shape-recovers', 'never-started-terminal'].includes(name);
  assert.equal(retry.closed, expectedClosed, `Case ${name}: retry.closed must be ${expectedClosed}`);
  assert.equal(closes, expectedClosed ? 1 : 0, `Case ${name}: closes count must be ${expectedClosed ? 1 : 0}`);
  assert.equal(session.isClosed(), expectedClosed);

  results.push({
    kind: 'session-default-query',
    name,
    first,
    retry,
    closes,
    queryCount: queries.length,
    isClosed: session.isClosed(),
  });
  console.log(`  PASS: ${name} -> retry.closed=${retry.closed}, closes=${closes}, error=${retry.error || 'none'}`);

  // For no-status-no-action: verify that providing valid action on 3rd attempt recovers!
  if (name === 'no-status-no-action') {
    const validAction = {
      ...raw,
      location,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: birth },
      beforeIdentity: { startUtc: birth },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    };
    await writeFile(join(output, 'taskbar-action.json'), JSON.stringify(validAction));
    const third = await session.stop();
    assert.equal(third.closed, true, 'no-status-no-action must recover when valid action is provided on attempt 3');
    assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 1);
    assert.equal(session.isClosed(), true);
    console.log(`  PASS: no-status-no-action recovered on attempt 3 after valid action file supplied!`);
  }
}

console.log('\n=== PART 3: Real Concurrent stop() verification (Offline Safe) ===');
{
  const output = join(testOutputDir, 'concurrent-stop');
  await mkdir(output, { recursive: true });
  const helper = 'C:\\Synthetic\\WallpaperProbe.exe';
  let location;
  const calls = [];
  const helperRun = async (_file, args) => {
    calls.push(args);
    if (args[0] === '--we-open') { location = args[1]; return { opened: true }; }
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: location, visible: true, startUtc: birth }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const execCommand = (_file, _args, _opts, cb) => cb(null, '');

  const session = createPreviewSession({
    helperRun,
    execCommand,
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    spawnChild: () => {
      const child = new EventEmitter();
      child.pid = 987654720;
      child.exitCode = null;
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin.end = () => {
        if (child.exitCode === null) {
          child.exitCode = 0;
          child.emit('exit', 0);
          child.emit('close', 0);
        }
      };
      return child;
    },
  });

  await session.create({ helper, output, scene: { scene: 'lucy' } });
  // Concurrent initial stop calls
  const [stop1, stop2] = await Promise.all([session.stop(), session.stop()]);
  assert.equal(stop1.closed, false);
  assert.equal(stop2.closed, false);
  assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 0);

  // Write valid action file
  await writeFile(join(output, 'taskbar-action.json'), JSON.stringify({
    schemaVersion: 1,
    enabled: true,
    stage: 'action-done',
    location,
    requestedIdentity: { hwnd: 555, pid: 1122, startUtc: birth },
    beforeIdentity: { startUtc: birth },
    action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
  }));

  // Concurrent retry stop calls
  const [retry1, retry2] = await Promise.all([session.stop(), session.stop()]);
  assert.equal(retry1.closed, true);
  assert.equal(retry2.closed, true);
  assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 1, 'ensure-closed must be called exactly once despite concurrent stop calls');
  assert.equal(session.isClosed(), true);
  console.log('  PASS: Concurrent stop calls resolved safely with exactly 1 ensure-closed call');
}

console.log('\n=== PART 4: Cross-Round Session Isolation & Timer/Listener Detachment Verification ===');
{
  const output1 = join(testOutputDir, 'round-1');
  const output2 = join(testOutputDir, 'round-2');
  await mkdir(output1, { recursive: true });
  await mkdir(output2, { recursive: true });
  const helper = 'C:\\Synthetic\\WallpaperProbe.exe';
  let location1, location2;
  let child1, child2;
  const calls = [];
  const helperRun = async (_file, args) => {
    calls.push(args);
    if (args[0] === '--we-open') {
      const loc = args[1];
      if (!location1) location1 = loc; else location2 = loc;
      return { opened: true };
    }
    if (args[0] === '--window-find') {
      const loc = calls.filter(c => c[0] === '--we-open').pop()[1];
      return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: birth }];
    }
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const execCommand = (_file, _args, _opts, cb) => cb(null, '');

  const session1 = createPreviewSession({
    helperRun,
    execCommand,
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    spawnChild: () => {
      child1 = new EventEmitter();
      child1.pid = 987654720;
      child1.exitCode = null;
      child1.stdin = new EventEmitter();
      child1.stdout = new EventEmitter();
      child1.stderr = new EventEmitter();
      child1.stdin.end = () => {
        if (child1.exitCode === null) {
          child1.exitCode = 0;
          child1.emit('exit', 0);
          child1.emit('close', 0);
        }
      };
      return child1;
    },
  });

  await session1.create({ helper, output: output1, scene: { scene: 'lucy' } });
  await writeFile(join(output1, 'taskbar-action.json'), JSON.stringify({
    schemaVersion: 1,
    enabled: true,
    stage: 'action-done',
    location: location1,
    requestedIdentity: { hwnd: 555, pid: 1122, startUtc: birth },
    beforeIdentity: { startUtc: birth },
    action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
  }));
  await session1.stop(); // attempt 1
  const stopped1 = await session1.stop(); // attempt 2 -> recovers
  assert.equal(stopped1.closed, true);
  assert.equal(session1.isClosed(), true);

  // Start Round 2: verify pristine state and zero pollution
  const session2 = createPreviewSession({
    helperRun,
    execCommand,
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    spawnChild: () => {
      child2 = new EventEmitter();
      child2.pid = 987654722;
      child2.exitCode = null;
      child2.stdin = new EventEmitter();
      child2.stdout = new EventEmitter();
      child2.stderr = new EventEmitter();
      child2.stdin.end = () => {
        if (child2.exitCode === null) {
          child2.exitCode = 0;
          child2.emit('exit', 0);
          child2.emit('close', 0);
        }
      };
      return child2;
    },
  });

  await session2.create({ helper, output: output2, scene: { scene: 'lucy' } });
  assert.notEqual(location1, location2);
  assert.equal(session2.isClosed(), false);

  // While Round 2 is ACTIVE, simulate late data arriving on dead child1
  assert.doesNotThrow(() => {
    child1.stderr.emit('data', 'late error message from dead child1\n');
    child1.stdout.emit('data', Buffer.from([0, 1, 2]));
  });

  // Verify listeners on child1 are cleanly detached
  assert.equal(child1.listenerCount('close'), 0);
  assert.equal(child1.listenerCount('error'), 0);
  assert.equal(child1.stderr.listenerCount('data'), 0);
  assert.equal(child1.stdout.listenerCount('data'), 0);

  const stats1 = session1.stats();
  assert.equal(stats1.reporting, false, 'Session 1 reportTimer must be cleared after stop');
  assert.equal(stats1.attached, false, 'Session 1 must be detached after stop');
  assert.equal(stats1.closeListeners, 0, 'Session 1 must have 0 close listeners');
  assert.equal(stats1.stdoutListeners, 0, 'Session 1 must have 0 stdout listeners');
  assert.equal(stats1.stderrListeners, 0, 'Session 1 must have 0 stderr listeners');

  const rep2 = session2.report();
  assert.equal(rep2.failure, null);
  assert.equal(rep2.diagnostics.firstError, null);
  assert.equal(rep2.diagnostics.errors, 0);
  assert.equal(rep2.diagnostics.messages.some(m => m.includes('dead child1')), false, 'Round 2 must have no late log residue from Round 1');

  child2.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'info', scope: 'Summary',
    message: JSON.stringify({ captureSource: 'window', taskbarHide: { stage: 'action-done', attempted: true, cleanupSafe: true } }),
  }) + '\n');
  const stopped2 = await session2.stop();
  assert.equal(stopped2.closed, true);
  assert.equal(session2.isClosed(), true);

  console.log('  PASS: Cross-round session execution succeeded with zero state pollution and 0 listener leaks');
}

console.log('\n=== PART 5: Fourth Review Q1-Q3 Default Query, Precision & Async Boundaries ===');

// Q1: Parser verification of PID, root structure, and array rejection
const p1Correct = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: birth })) });
assert.equal(p1Correct.ok, true);
assert.equal(p1Correct.pid, 1122);
assert.equal(areStartUtcsEquivalent(birth, p1Correct.startUtc), true);
console.log('  PASS: Q1 correct record accepted and returns exact pid and startUtc');

const p1Foreign = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: 999999, CreationDate: birth })) });
assert.equal(p1Foreign.ok, false);
assert.equal(p1Foreign.startUtc, null);
assert.match(p1Foreign.error, /pid-mismatch/);
console.log(`  PASS: Q1 foreign PID 999999 rejected -> ${p1Foreign.error}`);

const p1Missing = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ CreationDate: birth })) });
assert.equal(p1Missing.ok, false);
assert.equal(p1Missing.startUtc, null);
assert.match(p1Missing.error, /missing-pid/);
console.log(`  PASS: Q1 missing PID in record rejected -> ${p1Missing.error}`);

const p1Multiple = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify([{ ProcessId: 999999, CreationDate: birth }, { ProcessId: 1122, CreationDate: birth }])) });
assert.equal(p1Multiple.ok, false);
assert.equal(p1Multiple.startUtc, null);
assert.match(p1Multiple.error, /ambiguous-array-records/);
console.log(`  PASS: Q1 multiple records array rejected -> ${p1Multiple.error}`);

// Q2: Precision preservation contract
const serializedSample = { ProcessId: 1122, CreationDate: '/Date(1792228820609)/' };
const p2Serialized = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify(serializedSample)) });
assert.equal(p2Serialized.ok, true);
assert.equal(areStartUtcsEquivalent(birth, p2Serialized.startUtc), false, 'Degraded millisecond date must NOT equal 7-digit native birth');
console.log('  PASS: Q2 Degraded millisecond date strictly does not equal 7-digit native birth');

const p2ExactFormatted = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: '2026-10-17T09:20:20.6092543Z' })) });
assert.equal(p2ExactFormatted.ok, true);
assert.equal(areStartUtcsEquivalent('2026-10-17T09:20:20.6092543+00:00', p2ExactFormatted.startUtc), true);
console.log('  PASS: Q2 Explicit .ToString("o") 7-digit ISO strictly equals native birth');

// Q3: Async boundary, out-of-range dates, and error safety
const p3RangeNumber = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => queueMicrotask(() => cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: 1e20 }))) });
assert.equal(p3RangeNumber.ok, false);
assert.match(p3RangeNumber.error, /date-out-of-range/);
console.log(`  PASS: Q3 Async 1e20 numeric date safely rejected -> ${p3RangeNumber.error}`);

const p3RangeDateStr = await queryWindowsProcessCreationUtc(1122, { execCommand: (_f, _a, _o, cb) => queueMicrotask(() => cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: '/Date(9999999999999999999)/' }))) });
assert.equal(p3RangeDateStr.ok, false);
assert.match(p3RangeDateStr.error, /date-out-of-range/);
console.log(`  PASS: Q3 Async out-of-range /Date(...) safely rejected -> ${p3RangeDateStr.error}`);

const p3Timeout = await queryWindowsProcessCreationUtc(1122, { execCommand: () => {}, timeoutMs: 50 });
assert.equal(p3Timeout.ok, false);
assert.match(p3Timeout.error, /process-identity-timeout/);
console.log(`  PASS: Q3 Async timeout safely settled -> ${p3Timeout.error}`);

// Full session runs under default execCommand queries
const sessionRecords = {
  correct: { ProcessId: 1122, CreationDate: birth },
  foreign: { ProcessId: 999999, CreationDate: birth },
  missing: { CreationDate: birth },
  multiple: [{ ProcessId: 999999, CreationDate: birth }, { ProcessId: 1122, CreationDate: birth }],
  serialized: serializedSample,
};

for (const name of ['correct', 'foreign', 'missing', 'multiple', 'serialized', 'query-error']) {
  const output = join(testOutputDir, 'part5-' + name);
  await mkdir(output, { recursive: true });
  let location, child;
  const calls = [];
  const helper = 'C:\\Synthetic\\WallpaperProbe.exe';
  const session = createPreviewSession({
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    execCommand: (_f, args, _o, cb) => {
      const cmd = args?.at(-1) || '';
      if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
        if (name === 'query-error') cb(new Error('synthetic identity query failure'));
        else cb(null, JSON.stringify(sessionRecords[name]));
      } else cb(null, '');
    },
    helperRun: async (_f, args) => {
      calls.push(args);
      if (args[0] === '--we-open') { location = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: location, visible: true }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    },
    spawnChild: () => {
      child = new EventEmitter();
      child.pid = 987654720;
      child.exitCode = null;
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin.end = () => {
        if (child.exitCode === null) {
          child.exitCode = 0;
          child.emit('exit', 0);
          child.emit('close', 0);
        }
      };
      return child;
    }
  });
  await session.create({ helper, output, scene: { scene: 'lucy' } });
  const first = await session.stop();
  assert.equal(first.closed, false);
  const action = {
    ...raw,
    location,
    requestedIdentity: { ...raw.requestedIdentity, hwnd: 555, pid: 1122 },
    action: { ...raw.action, cleanupSafe: true, started: true, exited: true, pending: false, timedOut: false, terminated: false }
  };
  await writeFile(join(output, 'taskbar-action.json'), JSON.stringify(action));
  const retry = await session.stop();
  const windowCloses = calls.filter(a => a[0] === '--window-ensure-closed').length;
  if (name === 'correct') {
    assert.equal(retry.closed, true, 'correct default identity must recover on retry stop');
    assert.equal(windowCloses, 1);
    console.log('  PASS: Session with correct default query recovers with 1 window close');
  } else {
    assert.equal(retry.closed, false, `${name} must NOT close window on retry stop`);
    assert.equal(windowCloses, 0);
    console.log(`  PASS: Session with ${name} safely retains session and 0 window close`);
  }
}

console.log('\n=== PART 6: Fifth Review S1 PID Raw Type Negative Matrix & Worker Non-Swallow Protection ===');

// 6.1 Identity query PID raw type matrix: arrays, strings, nested arrays, booleans, null, objects, zero/negative/floats
const s1IdentityTypes = [
  ['array', [1122], 'process-identity-invalid-pid-type'],
  ['string', '1122', 'process-identity-invalid-pid-type'],
  ['nested-array', [[1122]], 'process-identity-invalid-pid-type'],
  ['boolean', true, 'process-identity-invalid-pid-type'],
  ['null', null, 'process-identity-missing-pid'],
  ['object', {}, 'process-identity-invalid-pid-type'],
  ['zero', 0, 'process-identity-invalid-pid-type'],
  ['negative', -5, 'process-identity-invalid-pid-type'],
  ['float', 1122.5, 'process-identity-invalid-pid-type'],
];

for (const [tName, rawVal, expectedErr] of s1IdentityTypes) {
  const qRes = await queryWindowsProcessCreationUtc(1122, {
    execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: rawVal, CreationDate: birth }))
  });
  assert.equal(qRes.ok, false, `S1 identity query must reject raw PID type: ${tName}`);
  assert.equal(qRes.error, expectedErr);
  console.log(`  PASS: S1 identity query correctly rejected ${tName} -> ${qRes.error}`);
}

// 6.2 Process list query PID raw type matrix: arrays, strings, nested arrays, booleans, null, objects, zero/negative/floats
const s1ProcessQueryTypes = [
  ['array', [1122], 'process-query-invalid-pid-type'],
  ['string', '1122', 'process-query-invalid-pid-type'],
  ['nested-array', [[1122]], 'process-query-invalid-pid-type'],
  ['boolean', true, 'process-query-invalid-pid-type'],
  ['null', null, 'process-query-missing-process-id'],
  ['object', {}, 'process-query-invalid-pid-type'],
  ['zero', 0, 'process-query-invalid-pid-type'],
  ['negative', -5, 'process-query-invalid-pid-type'],
  ['float', 1122.5, 'process-query-invalid-pid-type'],
];

for (const [tName, rawVal, expectedErr] of s1ProcessQueryTypes) {
  const pqRes = await queryWindowsProcesses('WhaleWallpaperProbe-review', {
    execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: rawVal, Name: 'WallpaperProbe.exe', CommandLine: 'test' }))
  });
  assert.equal(pqRes.ok, false, `S1 process list query must reject raw PID type: ${tName}`);
  assert.equal(pqRes.error, expectedErr);
  console.log(`  PASS: S1 process query correctly rejected ${tName} -> ${pqRes.error}`);
}

// 6.3 Worker process matching process.pid: array rejected, numeric integer retained & NOT swallowed
const workerArrPq = await queryWindowsProcesses('WhaleWallpaperProbe-review', {
  execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({
    ProcessId: [process.pid],
    Name: 'WallpaperProbe.exe',
    CommandLine: 'WallpaperProbe.exe --taskbar-worker WhaleWallpaperProbe-review'
  }))
});
assert.equal(workerArrPq.ok, false);
assert.equal(workerArrPq.error, 'process-query-invalid-pid-type');
console.log('  PASS: S1 worker PID array [process.pid] rejected -> process-query-invalid-pid-type');

const workerNumPq = await queryWindowsProcesses('WhaleWallpaperProbe-review', {
  execCommand: (_f, _a, _o, cb) => cb(null, JSON.stringify({
    ProcessId: process.pid,
    Name: 'WallpaperProbe.exe',
    CommandLine: 'WallpaperProbe.exe --taskbar-worker WhaleWallpaperProbe-review'
  }))
});
assert.equal(workerNumPq.ok, true);
assert.deepEqual(workerNumPq.pids, [process.pid], 'worker process matching process.pid must NOT be swallowed');
assert.equal(workerNumPq.processes.length, 1);
console.log('  PASS: S1 worker PID numeric process.pid retained and NOT swallowed as empty set');

// 6.4 Full session with [1122] identity query and [process.pid] worker query: 0 window close, failure retained, retry recovers
for (const sCase of ['session-identity-array', 'session-worker-pid-array', 'session-worker-pid-numeric']) {
  const output = join(testOutputDir, 'part6-' + sCase);
  await mkdir(output, { recursive: true });
  let location, child;
  const calls = [];
  const helper = 'C:\\Synthetic\\WallpaperProbe.exe';
  let mode = sCase;

  const session = createPreviewSession({
    exists: p => existsSync(p) || p === helper,
    sleep: async () => {},
    execCommand: (_f, args, _o, cb) => {
      const cmd = args?.at(-1) || '';
      if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
        if (mode === 'session-identity-array') {
          cb(null, JSON.stringify({ ProcessId: [1122], CreationDate: birth }));
        } else {
          cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: birth }));
        }
      } else if (mode === 'session-worker-pid-array') {
        cb(null, JSON.stringify({
          ProcessId: [process.pid],
          Name: 'WallpaperProbe.exe',
          ExecutablePath: helper,
          CommandLine: `${helper} --taskbar-worker ${location}`,
          CreationDate: birth,
        }));
      } else if (mode === 'session-worker-pid-numeric') {
        cb(null, JSON.stringify({
          ProcessId: process.pid,
          Name: 'WallpaperProbe.exe',
          ExecutablePath: helper,
          CommandLine: `${helper} --taskbar-worker ${location}`,
          CreationDate: birth,
        }));
      } else {
        cb(null, '');
      }
    },
    helperRun: async (_f, args) => {
      calls.push(args);
      if (args[0] === '--we-open') { location = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: location, visible: true }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    },
    spawnChild: () => {
      child = new EventEmitter();
      child.pid = 987654720;
      child.exitCode = null;
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin.end = () => {
        if (child.exitCode === null) {
          child.exitCode = 0;
          child.emit('exit', 0);
          child.emit('close', 0);
        }
      };
      return child;
    }
  });

  await session.create({ helper, output, scene: { scene: 'lucy' } });
  const first = await session.stop();
  assert.equal(first.closed, false);

  const action = {
    ...raw,
    location,
    requestedIdentity: { ...raw.requestedIdentity, hwnd: 555, pid: 1122 },
    action: { ...raw.action, cleanupSafe: true, started: true, exited: true, pending: false, timedOut: false, terminated: false }
  };
  await writeFile(join(output, 'taskbar-action.json'), JSON.stringify(action));

  // Stop under defect mode -> MUST reject window close (0 close calls)
  const defectStop = await session.stop();
  assert.equal(defectStop.closed, false, `${sCase} must reject window close`);
  assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 0);
  assert.equal(session.isClosed(), false);
  console.log(`  PASS: ${sCase} safely rejected window close (closed=false, 0 ensure-closed calls)`);

  if (sCase === 'session-identity-array') {
    // Identity baseline was permanently missing for this window -> retry stop continues to protect window
    const retryStillBlocked = await session.stop();
    assert.equal(retryStillBlocked.closed, false);
    assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 0);
    assert.equal(session.isClosed(), false);
    console.log(`  PASS: ${sCase} safely retains session and 0 window close across retries`);
  } else {
    // Worker processes now exited -> retry stop MUST recover!
    mode = 'recovered';
    const recoveredStop = await session.stop();
    assert.equal(recoveredStop.closed, true, `${sCase} must recover when clean authentic conditions are restored`);
    assert.equal(calls.filter(a => a[0] === '--window-ensure-closed').length, 1);
    assert.equal(session.isClosed(), true);
    console.log(`  PASS: ${sCase} successfully recovered upon retry with clean authentic conditions (closed=true, 1 ensure-closed call)`);
  }
}

// 6.5 Route-level end-to-end integration: defect mode blocks new start, retry stop recovers & permits start
{
  const routeOutputDir = join(testOutputDir, 'part6-routes');
  await mkdir(routeOutputDir, { recursive: true });
  let routeLocation = '';
  const routeCalls = [];
  let routeMode = 'worker-pid-array';

  const helperRun = async (_f, args) => {
    routeCalls.push(args);
    if (args[0] === '--we-open') { routeLocation = args[1]; return { opened: true }; }
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: routeLocation, visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const execCommand = (_f, args, _o, cb) => {
    const cmd = args?.at(-1) || '';
    if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
      cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: birth }));
    } else if (routeMode === 'worker-pid-array') {
      cb(null, JSON.stringify({
        ProcessId: [process.pid],
        Name: 'WallpaperProbe.exe',
        ExecutablePath: 'C:\\Synthetic\\WallpaperProbe.exe',
        CommandLine: `C:\\Synthetic\\WallpaperProbe.exe --taskbar-worker ${routeLocation}`,
        CreationDate: birth,
      }));
    } else {
      cb(null, '');
    }
  };

  let activeRouteSession = null;
  const sessionFactory = opts => {
    activeRouteSession = createPreviewSession({
      ...opts, helperRun, execCommand, sleep: async () => {}, exists: () => true,
      spawnChild: () => {
        const c = new EventEmitter();
        c.pid = 987654720; c.exitCode = null;
        c.stdin = new EventEmitter(); c.stdout = new EventEmitter(); c.stderr = new EventEmitter();
        c.stdin.end = () => { if (c.exitCode === null) { c.exitCode = 0; c.emit('exit', 0); c.emit('close', 0); } };
        return c;
      }
    });
    return activeRouteSession;
  };

  const routes = new Map();
  const ctx = { effect: fn => fn(), webServer: { register: r => routes.set(r.path, r) } };
  registerWallpaperRoutes(ctx, { helper: 'C:\\Synthetic\\WallpaperProbe.exe', logRoot: routeOutputDir, exists: () => true, onWarn: () => {}, sessionFactory });
  const route = routes.get('/whale-wallpaper');

  const callRoute = async (method, path, body) => {
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
    const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
    const res = { status: 0, payload: null, headers: {}, setHeader: () => {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
    await route.handler(req, res);
    let resPayload = null;
    try { resPayload = JSON.parse(res.payload); } catch { resPayload = res.payload; }
    return { status: res.status, body: resPayload };
  };

  // Start preview -> 200
  const rStart1 = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(rStart1.status, 200);

  // Stop preview -> initial stop fails -> 409 Conflict, session retained
  const rStop1 = await callRoute('POST', '/whale-wallpaper/stop');
  assert.equal(rStop1.status, 409);
  assert.equal(rStop1.body.failed, true);
  assert.notEqual(rStop1.body.session, null);

  // Action file arrives
  const rRunDir = activeRouteSession.state().config.output;
  await writeFile(join(rRunDir, 'taskbar-action.json'), JSON.stringify({
    ...raw,
    location: routeLocation,
    requestedIdentity: { ...raw.requestedIdentity, hwnd: 555, pid: 1122 },
    action: { ...raw.action, cleanupSafe: true, started: true, exited: true, pending: false, timedOut: false, terminated: false }
  }));

  // Retry stop while routeMode is 'worker-pid-array' -> query fails, 409 Conflict, 0 window close
  const rStopDefect = await callRoute('POST', '/whale-wallpaper/stop');
  assert.equal(rStopDefect.status, 409);
  assert.equal(rStopDefect.body.failed, true);
  assert.equal(routeCalls.filter(a => a[0] === '--window-ensure-closed').length, 0);

  // New start is blocked by active session -> 409
  const rStartBlocked = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(rStartBlocked.status, 409);

  // Clean worker query restored -> retry stop succeeds -> 200 OK, session released, 1 window close call
  routeMode = 'clean';
  const rStopRecovered = await callRoute('POST', '/whale-wallpaper/stop');
  assert.equal(rStopRecovered.status, 200);
  assert.equal(rStopRecovered.body.failed, false);
  assert.equal(rStopRecovered.body.session, null);
  assert.equal(routeCalls.filter(a => a[0] === '--window-ensure-closed').length, 1);

  // Next start now succeeds -> 200 OK
  const rStart2 = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(rStart2.status, 200);
  console.log('  PASS: S1 route-level integration: defect blocks release/start, clean recovery permits release & new start');
}

await rm(testOutputDir, { recursive: true, force: true }).catch(() => {});
console.log('\n=== ALL PROBE VERIFICATIONS PASSED (0 dangerous releases, 100% safety preserved) ===');
