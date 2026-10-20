import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPreviewSession,
  registerWallpaperRoutes,
  queryWindowsProcesses,
  verifyIndependentWorkerCleanup,
  SCENES,
} from '../../src/wallpaper/session.js';

import { existsSync } from 'node:fs';

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const exists = path => existsSync(path) || path === HELPER || path === SCENES.lucy.project;

function fakeChild(onStdinEnd) {
  const child = new EventEmitter();
  child.pid = 987654720;
  child.exitCode = null;
  child.stdin = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin.end = () => {
    if (onStdinEnd) onStdinEnd(child);
  };
  child.kill = () => {
    child.exitCode = 1;
    child.emit('exit', 1);
    child.emit('close', 1);
  };
  return child;
}

// ---------------------------------------------------------------------------
// Scenario 1: Normal termination with Summary (matrix row 1)
// ---------------------------------------------------------------------------
test('Scenario 1: normal termination with full Summary closes without process queries', async () => {
  const calls = [];
  let queryCount = 0;
  const helperRun = async (_exe, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const spawnChild = () => {
    const child = fakeChild(() => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({ taskbarHide: { cleanupSafe: true, stage: 'action-done', attempted: true } }),
      }) + '\n');
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    });
    return child;
  };

  const queryProcesses = async () => {
    queryCount += 1;
    return { ok: true, pids: [], processes: [] };
  };

  const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });

  const result = await session.stop();
  assert.equal(result.closed, true);
  assert.equal(result.outcome, 'closed');
  assert.equal(session.isClosed(), true);
  assert.equal(queryCount, 0, 'normal path with Summary MUST NOT execute process queries');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
});

// ---------------------------------------------------------------------------
// Scenario 2: Normal exit without Summary (matrix row 2)
// ---------------------------------------------------------------------------
test('Scenario 2: normal exit without Summary retains unknown on attempt 1, recovers on retry', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen2-'));
  try {
    const calls = [];
    let queryCount = 0;
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'absent', closed: true };
      return {};
    };

    let sessionLocation = '';
    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      const child = fakeChild(() => {
        // Exits normally with 0, but no Summary emitted
        child.exitCode = 0;
        child.emit('exit', 0);
        child.emit('close', 0);
      });
      return child;
    };

    const queryProcesses = async () => {
      queryCount += 1;
      return { ok: true, pids: [], processes: [] };
    };

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // Attempt 1: Summary is missing, MUST retain worker-unconfirmed without closing window
    const attempt1 = await session.stop();
    assert.equal(attempt1.closed, false);
    assert.equal(attempt1.outcome, 'worker-unconfirmed');
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0, 'window close must NOT be called on attempt 1');
    assert.equal(session.isClosed(), false);

    // Simulate taskbar-action.json written by worker before/during exit
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: sessionLocation,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Attempt 2 (Retry): Independent verification runs, finds 0 procs and valid action record
    const attempt2 = await session.stop();
    assert.equal(attempt2.closed, true);
    assert.equal(attempt2.outcome, 'absent');
    assert.equal(session.isClosed(), true);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
    assert.equal(queryCount >= 1, true, 'queryProcesses was called on retry');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 3: Timeout force-kill without Summary (matrix row 3)
// ---------------------------------------------------------------------------
test('Scenario 3: timeout force-kill without Summary retains unknown on attempt 1, recovers on retry', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen3-'));
  try {
    const calls = [];
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 777, pid: 4455, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };

    let sessionLocation = '';
    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      const child = fakeChild(() => {
        // Child hangs and does not exit until force-killed
      });
      return child;
    };

    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });

    const session = createPreviewSession({
      helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists,
      childExitTimeoutMs: 10, childKillTimeoutMs: 10,
    });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // Attempt 1: Force killed, unconfirmed, window close not called
    const attempt1 = await session.stop();
    assert.equal(attempt1.closed, false);
    assert.equal(attempt1.outcome, 'worker-unconfirmed');
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
    assert.equal(session.isClosed(), false);

    // Provide valid taskbar-action.json
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: sessionLocation,
      requestedIdentity: { hwnd: 777, pid: 4455, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Attempt 2: Recovers
    const attempt2 = await session.stop();
    assert.equal(attempt2.closed, true);
    assert.equal(attempt2.outcome, 'closed');
    assert.equal(session.isClosed(), true);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 4: Worker process still running in OS on retry (matrix row 4)
// ---------------------------------------------------------------------------
test('Scenario 4: worker still running in OS rejects window close and retains session lock', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen4-'));
  try {
    const calls = [];
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };

    let sessionLocation = '';
    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      const child = fakeChild(() => {
        child.exitCode = 0; child.emit('exit', 0); child.emit('close', 0);
      });
      return child;
    };

    // Worker process is still detected in OS
    let workerAliveInOs = true;
    const queryProcesses = async loc => {
      if (workerAliveInOs) {
        return {
          ok: true,
          pids: [6677],
          processes: [{
            pid: 6677,
            name: 'WallpaperProbe.exe',
            executablePath: 'C:\\assets\\WallpaperProbe.exe',
            commandLine: `WallpaperProbe.exe --taskbar-worker 555 1122 2026-10-18T00:00:00Z ${loc} stop.txt`,
          }],
        };
      }
      return { ok: true, pids: [], processes: [] };
    };

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-pending',
      location: sessionLocation,
      requestedIdentity: { hwnd: 555, pid: 1122 },
      action: { pending: true, cleanupSafe: false },
    }));

    // Attempt 1: unconfirmed
    const attempt1 = await session.stop();
    assert.equal(attempt1.closed, false);

    // Attempt 2: retry while worker is alive in OS
    const attempt2 = await session.stop();
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /worker process 6677 is still running/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0, 'window close MUST NOT be called while worker is running');
    assert.equal(session.isClosed(), false);

    // Now simulate worker finally finishing and exiting
    workerAliveInOs = false;
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: sessionLocation,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Attempt 3: retry after worker is dead and safe
    const attempt3 = await session.stop();
    assert.equal(attempt3.closed, true);
    assert.equal(attempt3.outcome, 'closed');
    assert.equal(session.isClosed(), true);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 5: Query error, timeout, corrupt action file (matrix row 5)
// ---------------------------------------------------------------------------
test('Scenario 5a: process query failure rejects window close and retains session', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen5a-'));
  try {
    const calls = [];
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
      return {};
    };

    const spawnChild = () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    const queryProcesses = async () => ({ ok: false, error: 'powershell-query-timed-out', pids: [], processes: [] });

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await session.stop(); // attempt 1
    const attempt2 = await session.stop(); // attempt 2 (retry)
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /process query failed/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
    assert.equal(session.isClosed(), false);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('Scenario 5b: corrupt taskbar-action.json rejects window close and retains session', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen5b-'));
  try {
    const calls = [];
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      return {};
    };

    const spawnChild = () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // Corrupt JSON file
    await writeFile(join(tmpDir, 'taskbar-action.json'), '{"schemaVersion": 1, stage: BROKEN JSON...');

    await session.stop(); // attempt 1
    const attempt2 = await session.stop(); // attempt 2
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /corrupted taskbar-action\.json/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('Scenario 5c: unsupported schemaVersion rejects window close and retains session', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen5c-'));
  try {
    const calls = [];
    let sessionLocation = '';
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      return {};
    };

    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      return fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    };
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 99,
      stage: 'action-done',
      location: sessionLocation,
    }));

    await session.stop(); // attempt 1
    const attempt2 = await session.stop(); // attempt 2
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /unsupported taskbar-action schemaVersion/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 6: Worker safe but window close fails (matrix row 6)
// ---------------------------------------------------------------------------
test('Scenario 6: worker safe but window close fails retains session, succeeds when helper recovers', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen6-'));
  try {
    const calls = [];
    let ensureClosedAttempts = 0;
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') {
        ensureClosedAttempts += 1;
        if (ensureClosedAttempts === 1) {
          return { outcome: 'error', closed: false, error: 'window close timed out' };
        }
        return { outcome: 'closed', closed: true };
      }
      return {};
    };

    let sessionLocation = '';
    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      return fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    };
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: sessionLocation,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Attempt 1: unconfirmed
    await session.stop();

    // Attempt 2: worker passes verification, helper called but helper returns closed: false
    const attempt2 = await session.stop();
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'error');
    assert.equal(session.isClosed(), false);

    // Attempt 3: helper succeeds
    const attempt3 = await session.stop();
    assert.equal(attempt3.closed, true);
    assert.equal(attempt3.outcome, 'closed');
    assert.equal(session.isClosed(), true);
    assert.equal(ensureClosedAttempts, 2);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 7: Stale location / identity in taskbar-action.json (matrix row 7)
// ---------------------------------------------------------------------------
test('Scenario 7: stale location or mismatched hwnd/pid in action file is rejected', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen7-'));
  try {
    const calls = [];
    const helperRun = async (_exe, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
      return {};
    };

    const spawnChild = () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // File belongs to a different location
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: 'WhaleWallpaperProbe-FOREIGN-LOCATION-999',
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { cleanupSafe: true, pending: false, exited: true, started: true, timedOut: false, terminated: false },
    }));

    await session.stop(); // attempt 1
    const attempt2 = await session.stop(); // attempt 2
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /location mismatch/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);

    // Now test mismatched PID
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location: session.state().location,
      requestedIdentity: { hwnd: 555, pid: 999999, startUtc: '2026-10-18T00:00:00Z' }, // foreign recycled PID
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { cleanupSafe: true, pending: false, exited: true, started: true, timedOut: false, terminated: false },
    }));

    const attempt3 = await session.stop();
    assert.equal(attempt3.closed, false);
    assert.match(attempt3.error, /pid mismatch/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 8: Concurrent / repeated stop and restart flow in routes (matrix row 8)
// ---------------------------------------------------------------------------
test('Scenario 8: route level recovery - retry stop clears failure and permits new start under authentic native window shape and late child data', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen8-'));
  try {
    let activeSession = null;
    let openedLocation = '';
    let location = '';
    let childCount = 0;
    let child1 = null;
    let child2 = null;

    // Authentic native rc.35 helper window-find returns { hwnd, pid, title, visible }, NO startUtc!
    const helperRun = async (_exe, args) => {
      if (args[0] === '--we-open') { openedLocation = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: openedLocation, visible: true }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };

    const spawnChild = (_exe, args) => {
      childCount += 1;
      const currentChildNum = childCount;
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) location = args[locIdx + 1];
      const ch = fakeChild(c => {
        if (currentChildNum === 1) {
          // Round 1 child exits without summary
          c.exitCode = 0; c.emit('exit', 0); c.emit('close', 0);
        }
      });
      if (currentChildNum === 1) child1 = ch;
      else child2 = ch;
      return ch;
    };

    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
    // Authentic default process creation query via execCommand (no queryProcessIdentity override)
    const execCommand = (_f, args, _o, cb) => {
      const cmd = args?.at(-1) || '';
      if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
        cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: '2026-10-18T00:00:00.0000000Z' }));
      } else {
        cb(null, '');
      }
    };

    const sessionFactory = opts => {
      activeSession = createPreviewSession({
        ...opts, helperRun, spawnChild, queryProcesses, execCommand, sleep: async () => {}, exists,
      });
      return activeSession;
    };

    const routes = new Map();
    const ctx = { effect: fn => fn(), webServer: { register: r => routes.set(r.path, r) } };
    const controller = registerWallpaperRoutes(ctx, { helper: HELPER, logRoot: tmpDir, exists, onWarn: () => {}, sessionFactory, queryProcesses });
    const route = routes.get('/whale-wallpaper');

    const callRoute = async (method, path, body) => {
      const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
      const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
      const res = {
        status: 0,
        payload: null,
        headers: {},
        setHeader: () => {},
        writeHead(code) { this.status = code; },
        end(value) { this.payload = value; },
      };
      await route.handler(req, res);
      let resPayload = null;
      try { resPayload = JSON.parse(res.payload); } catch { resPayload = res.payload; }
      return { status: res.status, body: resPayload };
    };

    // 1. Start preview
    const start1 = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(start1.status, 200);

    // 2. Stop preview -> child exited without summary -> 409 Conflict, failed: true
    const stop1 = await callRoute('POST', '/whale-wallpaper/stop');
    assert.equal(stop1.status, 409);
    assert.equal(stop1.body.failed, true);
    assert.equal(stop1.body.session !== null, true, 'session must be retained on initial failure');

    // 3. New start is blocked by active failed session
    const blocked = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(blocked.status, 409);

    // 4. Now action file arrives
    const runDirs = activeSession.state().config.output;
    await writeFile(join(runDirs, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1,
      enabled: true,
      stage: 'action-done',
      location,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // 5. Retry stop -> independent verification succeeds -> 200 OK, session released!
    const stop2 = await callRoute('POST', '/whale-wallpaper/stop');
    assert.equal(stop2.status, 200);
    assert.equal(stop2.body.failed, false);
    assert.equal(stop2.body.session, null, 'session released after verified stop');
    assert.equal(stop2.body.lastCleanup.closed, true);

    // 6. Status check verifies clean state
    const status = await callRoute('GET', '/whale-wallpaper/status');
    assert.equal(status.body.active, false);
    assert.equal(status.body.failed, false);
    assert.equal(status.body.session, null);

    // 7. New start now succeeds!
    const start2 = await callRoute('POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(start2.status, 200);

    // Check status while Round 2 is running
    const status2 = await callRoute('GET', '/whale-wallpaper/status');
    assert.equal(status2.body.active, true);
    assert.equal(status2.body.failed, false);
    assert.equal(status2.body.session !== null, true);
    assert.equal(status2.body.session.failure, null);
    assert.equal(status2.body.session.diagnostics.firstError, null);
    assert.equal(status2.body.session.diagnostics.errors, 0);
    assert.equal(controller.currentSession(), activeSession);
    assert.equal(typeof controller.generation(), 'number');
    assert.equal(controller.generation() >= 1, true);

    // 8. While Round 2 is active: emit late data on old child1
    assert.doesNotThrow(() => {
      child1.stderr.emit('data', 'late error from dead round 1 child\n');
      child1.stdout.emit('data', Buffer.from([99, 100, 101]));
    });

    // Verify Round 2 top-level failure and diagnostics are pristine
    const rep2 = activeSession.report();
    assert.equal(rep2.failure, null);
    assert.equal(rep2.diagnostics.firstError, null);
    assert.equal(rep2.diagnostics.messages.some(m => m.includes('dead round 1 child')), false, 'Round 2 must have no late log residue from Round 1');

    // Verify child1 listeners are fully detached
    assert.equal(child1.listenerCount('close'), 0);
    assert.equal(child1.listenerCount('error'), 0);
    assert.equal(child1.stderr.listenerCount('data'), 0);
    assert.equal(child1.stdout.listenerCount('data'), 0);

    // 9. Stop round 2 cleanly with summary
    child2.stderr.emit('data', JSON.stringify({
      kind: 'log', level: 'info', scope: 'Summary',
      message: JSON.stringify({ captureSource: 'window', taskbarHide: { stage: 'action-done', attempted: true, cleanupSafe: true } }),
    }) + '\n');
    child2.exitCode = 0;
    child2.emit('exit', 0);
    child2.emit('close', 0);

    const stopRound2 = await callRoute('POST', '/whale-wallpaper/stop');
    assert.equal(stopRound2.status, 200);

    const finalStatus = await callRoute('GET', '/whale-wallpaper/status');
    assert.equal(finalStatus.body.active, false);
    assert.equal(finalStatus.body.failed, false);
    assert.equal(finalStatus.body.session, null);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 9: Wallpaper Engine main process isolation (matrix row 9)
// ---------------------------------------------------------------------------
test('Scenario 9: query filter strictly scopes to location, Wallpaper Engine main process never targeted', async () => {
  let executedQueryFilter = '';
  const mockExec = (_file, args, _opts, callback) => {
    const cmd = args.find(a => typeof a === 'string' && a.includes('Get-CimInstance'));
    executedQueryFilter = cmd || '';
    callback(null, '');
  };

  const testLocation = 'WhaleWallpaperProbe-261018-test9';
  const result = await queryWindowsProcesses(testLocation, { execCommand: mockExec });
  assert.equal(result.ok, true);
  assert.equal(result.processes.length, 0);
  assert.match(executedQueryFilter, new RegExp(`CommandLine like '%${testLocation}%'`));
  assert.doesNotMatch(executedQueryFilter, /wallpaper64/i);
  assert.doesNotMatch(executedQueryFilter, /wallpaper32/i);
});

// ---------------------------------------------------------------------------
// Unit testing: queryWindowsProcesses parsing logic
// ---------------------------------------------------------------------------
test('queryWindowsProcesses handles various formats and errors deterministically', async () => {
  // Empty location
  const emptyRes = await queryWindowsProcesses('');
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.error, 'invalid-location');

  // Single object output from PowerShell
  const singleObjExec = (_f, _a, _o, cb) => cb(null, JSON.stringify({
    ProcessId: 1234, Name: 'WallpaperProbe.exe', CommandLine: 'WallpaperProbe.exe --taskbar-worker test', CreationDate: '2026-10-18',
  }));
  const res1 = await queryWindowsProcesses('test', { execCommand: singleObjExec });
  assert.equal(res1.ok, true);
  assert.equal(res1.processes.length, 1);
  assert.equal(res1.processes[0].pid, 1234);

  // Array output
  const arrayExec = (_f, _a, _o, cb) => cb(null, JSON.stringify([
    { ProcessId: 100, Name: 'proc1', CommandLine: 'test 1' },
    { ProcessId: 200, Name: 'proc2', CommandLine: 'test 2' },
  ]));
  const res2 = await queryWindowsProcesses('test', { execCommand: arrayExec });
  assert.equal(res2.ok, true);
  assert.equal(res2.processes.length, 2);

  // Query error
  const errExec = (_f, _a, _o, cb) => cb(new Error('timeout'));
  const res3 = await queryWindowsProcesses('test', { execCommand: errExec });
  assert.equal(res3.ok, false);
  assert.match(res3.error, /timeout/);

  // Malformed JSON
  const badJsonExec = (_f, _a, _o, cb) => cb(null, 'not valid json');
  const res4 = await queryWindowsProcesses('test', { execCommand: badJsonExec });
  assert.equal(res4.ok, false);
  assert.match(res4.error, /process-query-parse-failed/);

  // R1 parser negative cases: empty object, missing pid, invalid row
  const emptyObjExec = (_f, _a, _o, cb) => cb(null, '{}');
  const res5 = await queryWindowsProcesses('test', { execCommand: emptyObjExec });
  assert.equal(res5.ok, false);
  assert.equal(res5.error, 'process-query-missing-process-id');

  const missingPidExec = (_f, _a, _o, cb) => cb(null, '[{"Name":"WallpaperProbe.exe"}]');
  const res6 = await queryWindowsProcesses('test', { execCommand: missingPidExec });
  assert.equal(res6.ok, false);
  assert.equal(res6.error, 'process-query-missing-process-id');

  const invalidRowExec = (_f, _a, _o, cb) => cb(null, '[null]');
  const res7 = await queryWindowsProcesses('test', { execCommand: invalidRowExec });
  assert.equal(res7.ok, false);
  assert.equal(res7.error, 'process-query-contains-invalid-item');

  // S1 PID raw type matrix: arrays, strings, booleans, objects, zero/negative/floats
  for (const [tName, badPid] of [
    ['array', [1122]],
    ['string', '1122'],
    ['nested-array', [[1122]]],
    ['boolean', true],
    ['object', {}],
    ['zero', 0],
    ['negative', -5],
    ['float', 1122.5],
  ]) {
    const badPidExec = (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: badPid, Name: 'WallpaperProbe.exe', CommandLine: 'test' }));
    const badPidRes = await queryWindowsProcesses('test', { execCommand: badPidExec });
    assert.equal(badPidRes.ok, false, `queryWindowsProcesses must reject bad PID type: ${tName}`);
    assert.equal(badPidRes.error, 'process-query-invalid-pid-type');
  }

  // S1 worker record claiming process.pid: arrays rejected, numeric retained and NOT swallowed
  const workerArrExec = (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: [process.pid], Name: 'WallpaperProbe.exe', CommandLine: 'WallpaperProbe.exe --taskbar-worker test' }));
  const workerArrRes = await queryWindowsProcesses('test', { execCommand: workerArrExec });
  assert.equal(workerArrRes.ok, false);
  assert.equal(workerArrRes.error, 'process-query-invalid-pid-type');

  const workerNumExec = (_f, _a, _o, cb) => cb(null, JSON.stringify({ ProcessId: process.pid, Name: 'WallpaperProbe.exe', CommandLine: 'WallpaperProbe.exe --taskbar-worker test' }));
  const workerNumRes = await queryWindowsProcesses('test', { execCommand: workerNumExec });
  assert.equal(workerNumRes.ok, true);
  assert.deepEqual(workerNumRes.pids, [process.pid], 'worker process matching process.pid must NOT be swallowed');
  assert.equal(workerNumRes.processes.length, 1);
});

// ---------------------------------------------------------------------------
// Scenario 10: R1 Session with malformed process record from default query (matrix row 10)
// ---------------------------------------------------------------------------
test('Scenario 10: R1 query returns malformed record {} -> retry stop retains session and 0 window close', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen10-'));
  try {
    const calls = [];
    const helperRun = async (_file, args) => {
      calls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };
    const execCommand = (_f, _a, _o, cb) => cb(null, '{}');
    let sessionLocation = '';
    const spawnChild = (_exe, args) => {
      const locIdx = args.indexOf('--owned-location');
      if (locIdx >= 0) sessionLocation = args[locIdx + 1];
      return fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
    };

    const session = createPreviewSession({ helperRun, execCommand, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1, enabled: true, stage: 'action-done', location: sessionLocation,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    await session.stop(); // attempt 1
    const attempt2 = await session.stop(); // attempt 2: execCommand returns '{}', must reject!
    assert.equal(attempt2.closed, false);
    assert.equal(attempt2.outcome, 'worker-unconfirmed');
    assert.match(attempt2.error, /process-query-missing-process-id/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 11: R2 Action file missing identity/cleanupSafe/exited/future startUtc (matrix row 11)
// ---------------------------------------------------------------------------
test('Scenario 11: R2 Action file defects all retain session and 0 window close', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen11-'));
  try {
    const runDefectCase = async defectMutator => {
      const caseDir = await mkdtemp(join(tmpDir, 'case-'));
      const calls = [];
      let loc = '';
      const helperRun = async (_file, args) => {
        calls.push(args);
        if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
        if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
        if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
        return {};
      };
      const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
      const spawnChild = () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
      const session = createPreviewSession({ helperRun, queryProcesses, sleep: async () => {}, exists });
      await session.create({ helper: HELPER, output: caseDir, scene: { scene: 'lucy' } });

      let action = {
        schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
        requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
        beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
        action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
      };
      action = defectMutator(action, loc);
      await writeFile(join(caseDir, 'taskbar-action.json'), JSON.stringify(action));

      await session.stop(); // attempt 1
      const attempt2 = await session.stop(); // attempt 2
      assert.equal(attempt2.closed, false);
      assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
      return attempt2;
    };

    // Defect A: missing requestedIdentity & action
    const rA = await runDefectCase((_a, loc) => ({ schemaVersion: 1, location: loc, stage: 'action-done' }));
    assert.match(rA.error, /missing requestedIdentity/);

    // Defect B: missing cleanupSafe
    const rB = await runDefectCase(a => { delete a.action.cleanupSafe; return a; });
    assert.match(rB.error, /cleanupSafe is not true/);

    // Defect C: exited=false
    const rC = await runDefectCase(a => { a.action.exited = false; return a; });
    assert.match(rC.error, /not confirmed exited/);

    // Defect D: startUtc in future (2099)
    const rD = await runDefectCase(a => { a.requestedIdentity.startUtc = '2099-01-01T00:00:00Z'; return a; });
    assert.match(rD.error, /in the future/);

    // W2 Defect E: pending is string "true"
    const rE = await runDefectCase(a => { a.action.pending = 'true'; return a; });
    assert.match(rE.error, /pending is not false/);

    // W2 Defect F: pending missing
    const rF = await runDefectCase(a => { delete a.action.pending; return a; });
    assert.match(rF.error, /pending is not false/);

    // W2 Defect G: timedOut is string "true"
    const rG = await runDefectCase(a => { a.action.timedOut = 'true'; return a; });
    assert.match(rG.error, /timedOut is not false/);

    // W1 Defect H: non-ISO date format
    const rH = await runDefectCase(a => { a.requestedIdentity.startUtc = 'October 17, 2026'; return a; });
    assert.match(rH.error, /invalid requestedIdentity\.startUtc format/);

    // W1 Defect I: past timestamp mismatch
    const rI = await runDefectCase(a => { a.requestedIdentity.startUtc = '2026-10-18T00:00:01Z'; return a; });
    assert.match(rI.error, /startUtc mismatch with expected/);

    // W3/T3 Defect J: conflict where stopped-before-action claims started=true
    const rJ = await runDefectCase(a => { a.stage = 'stopped-before-action'; a.trigger = null; a.action.started = true; return a; });
    assert.match(rJ.error, /stopped-before-action action\.started is not false/);

    // T3 Defect J2: stopped-before-action missing action or trigger property
    const rJ2 = await runDefectCase(a => { a.stage = 'stopped-before-action'; delete a.action; delete a.trigger; return a; });
    assert.match(rJ2.error, /missing action or trigger property/);

    // T3 Defect J3: stopped-before-action with conflicting flags
    const rJ3 = await runDefectCase(a => {
      a.stage = 'stopped-before-action'; a.trigger = null;
      a.action = { started: 'true', exited: false, cleanupSafe: true, pending: false, timedOut: true, terminated: true };
      return a;
    });
    assert.match(rJ3.error, /stopped-before-action action\.started is not false/);

    // T2 Defect L: non-zero fraction omitted (500us difference rejected)
    const rL = await runDefectCase(a => {
      a.requestedIdentity.startUtc = '2026-10-18T00:00:00.0005000Z';
      a.beforeIdentity = { startUtc: '2026-10-18T00:00:00.0005000Z' };
      return a;
    });
    assert.match(rL.error, /startUtc mismatch with expected/);

    // T2 Defect M: invalid calendar date (Feb 30 rejected)
    const rM = await runDefectCase(a => {
      a.requestedIdentity.startUtc = '2026-02-30T00:00:00Z';
      a.beforeIdentity = { startUtc: '2026-02-30T00:00:00Z' };
      return a;
    });
    assert.match(rM.error, /invalid requestedIdentity\.startUtc format/);

    // W3 Defect K: unfinalized stage armed
    const rK = await runDefectCase(a => { a.stage = 'armed'; a.action = null; return a; });
    assert.match(rK.error, /unsettled taskbar stage/);

    // W3 Positive control: never-started-terminal (stopped-before-action, action=null, trigger=null) recovers
    {
      const caseDir = await mkdtemp(join(tmpDir, 'case-pos-'));
      let loc = '';
      const helperRun = async (_file, args) => {
        if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
        if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
        if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
        return {};
      };
      const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
      const session = createPreviewSession({ helperRun, queryProcesses, sleep: async () => {}, exists });
      await session.create({ helper: HELPER, output: caseDir, scene: { scene: 'lucy' } });
      await writeFile(join(caseDir, 'taskbar-action.json'), JSON.stringify({
        schemaVersion: 1, enabled: true, stage: 'stopped-before-action', location: loc,
        requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
        action: null, trigger: null,
      }));
      await session.stop(); // attempt 1
      const posAttempt2 = await session.stop(); // attempt 2 -> recovers!
      assert.equal(posAttempt2.closed, true);
      assert.equal(session.isClosed(), true);
    }

    // T2 Positive control: zero fraction extension (.0000000Z vs Z equivalent) recovers
    {
      const caseDir = await mkdtemp(join(tmpDir, 'case-pos-zerofrac-'));
      let loc = '';
      const helperRun = async (_file, args) => {
        if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
        if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
        if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
        return {};
      };
      const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
      const session = createPreviewSession({ helperRun, queryProcesses, sleep: async () => {}, exists });
      await session.create({ helper: HELPER, output: caseDir, scene: { scene: 'lucy' } });
      await writeFile(join(caseDir, 'taskbar-action.json'), JSON.stringify({
        schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
        requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00.0000000Z' },
        beforeIdentity: { startUtc: '2026-10-18T00:00:00.0000000Z' },
        action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
      }));
      await session.stop(); // attempt 1
      const posAttempt2 = await session.stop(); // attempt 2 -> recovers!
      assert.equal(posAttempt2.closed, true);
      assert.equal(session.isClosed(), true);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 12: R3 Capture spawned without status/summary and no action file (matrix row 12)
// ---------------------------------------------------------------------------
test('Scenario 12: R3 no status & no action file retains session, recovers on attempt 3 when action supplied', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen12-'));
  try {
    const calls = [];
    let loc = '';
    const helperRun = async (_file, args) => {
      calls.push(args);
      if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
    const spawnChild = () => fakeChild(c => {
      // Child exits with 0 stderr data
      c.exitCode = 0; c.emit('close', 0);
    });

    const session = createPreviewSession({ helperRun, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // Stop 1
    const s1 = await session.stop();
    assert.equal(s1.closed, false);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);

    // Stop 2 without action file -> must NOT assume worker never started!
    const s2 = await session.stop();
    assert.equal(s2.closed, false);
    assert.match(s2.error, /taskbar-action\.json missing/);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
    assert.equal(session.isClosed(), false);

    // Provide valid action file
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Stop 3 -> recovers cleanly!
    const s3 = await session.stop();
    assert.equal(s3.closed, true);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
    assert.equal(session.isClosed(), true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 13: R4 Concurrent stop() calls on retry resolve consistently (matrix row 13)
// ---------------------------------------------------------------------------
test('Scenario 13: R4 Concurrent stop calls on retry resolve to same outcome with 1 window close call', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen13-'));
  try {
    const calls = [];
    let loc = '';
    const helperRun = async (_file, args) => {
      calls.push(args);
      if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
    const spawnChild = () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });

    const session = createPreviewSession({ helperRun, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    // Initial concurrent stop calls
    const [c1, c2] = await Promise.all([session.stop(), session.stop()]);
    assert.equal(c1.closed, false);
    assert.equal(c2.closed, false);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);

    // Provide action file
    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    // Concurrent retry stop calls
    const [r1, r2] = await Promise.all([session.stop(), session.stop()]);
    assert.equal(r1.closed, true);
    assert.equal(r2.closed, true);
    assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
    assert.equal(session.isClosed(), true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 14: R4 Late data from old run & timer/listener detachment (matrix row 14)
// ---------------------------------------------------------------------------
test('Scenario 14: R4 Late data from terminated child is ignored and leaves no listeners', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen14-'));
  try {
    let oldChild;
    let loc = '';
    const helperRun = async (_file, args) => {
      if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true, startUtc: '2026-10-18T00:00:00Z' }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    };
    const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
    const spawnChild = () => {
      oldChild = fakeChild(c => { c.exitCode = 0; c.emit('close', 0); });
      return oldChild;
    };

    const session = createPreviewSession({ helperRun, spawnChild, queryProcesses, sleep: async () => {}, exists });
    await session.create({ helper: HELPER, output: tmpDir, scene: { scene: 'lucy' } });

    await writeFile(join(tmpDir, 'taskbar-action.json'), JSON.stringify({
      schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
      requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00Z' },
      beforeIdentity: { startUtc: '2026-10-18T00:00:00Z' },
      action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
    }));

    await session.stop();
    const stopped = await session.stop();
    assert.equal(stopped.closed, true);

    // Old child late events
    assert.doesNotThrow(() => {
      oldChild.stderr.emit('data', 'late error\n');
      oldChild.stdout.emit('data', Buffer.from([1, 2, 3]));
    });

    // Check listeners are 0
    assert.equal(oldChild.listenerCount('close'), 0);
    assert.equal(oldChild.listenerCount('error'), 0);
    assert.equal(oldChild.stderr.listenerCount('data'), 0);
    assert.equal(oldChild.stdout.listenerCount('data'), 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 15: Q1-Q3 Default process creation query defect matrix & authentic recovery
// ---------------------------------------------------------------------------
test('Scenario 15: Q1-Q3 Default process creation query defects retain session, authentic record recovers', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen15-'));
  try {
    const testCases = [
      { name: 'foreign-pid', record: { ProcessId: 999999, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'missing-pid', record: { CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'multiple-records', record: [{ ProcessId: 999999, CreationDate: '2026-10-18T00:00:00.6092543Z' }, { ProcessId: 1122, CreationDate: '2026-10-18T00:00:00.6092543Z' }], expectClosed: false },
      { name: 'serialized-precision-loss', record: { ProcessId: 1122, CreationDate: '/Date(1792281600609)/' }, expectClosed: false },
      // S1 PID raw type matrix
      { name: 'pid-array', record: { ProcessId: [1122], CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-string', record: { ProcessId: '1122', CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-nested-array', record: { ProcessId: [[1122]], CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-boolean', record: { ProcessId: true, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-object', record: { ProcessId: {}, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-zero', record: { ProcessId: 0, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-negative', record: { ProcessId: -5, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'pid-float', record: { ProcessId: 1122.5, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: false },
      { name: 'correct-authentic', record: { ProcessId: 1122, CreationDate: '2026-10-18T00:00:00.6092543Z' }, expectClosed: true },
    ];

    for (const tc of testCases) {
      const subDir = join(tmpDir, tc.name);
      await mkdir(subDir, { recursive: true });
      let loc = '';
      const calls = [];
      const helperRun = async (_file, args) => {
        calls.push(args);
        if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
        // Authentic native window find returns no startUtc
        if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true }];
        if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
        return {};
      };
      const queryProcesses = async () => ({ ok: true, pids: [], processes: [] });
      const execCommand = (_f, args, _o, cb) => {
        const cmd = args?.at(-1) || '';
        if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
          cb(null, JSON.stringify(tc.record));
        } else {
          cb(null, '');
        }
      };

      const session = createPreviewSession({
        helperRun,
        execCommand,
        queryProcesses,
        spawnChild: () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); }),
        sleep: async () => {},
        exists,
      });

      await session.create({ helper: HELPER, output: subDir, scene: { scene: 'lucy' } });
      const firstStop = await session.stop();
      assert.equal(firstStop.closed, false, `${tc.name}: first stop must be unconfirmed`);

      await writeFile(join(subDir, 'taskbar-action.json'), JSON.stringify({
        schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
        requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00.6092543Z' },
        beforeIdentity: { startUtc: '2026-10-18T00:00:00.6092543Z' },
        action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
      }));

      const retryStop = await session.stop();
      const closeCalls = calls.filter(a => a[0] === '--window-ensure-closed').length;

      if (tc.expectClosed) {
        assert.equal(retryStop.closed, true, `${tc.name} must recover on retry stop`);
        assert.equal(closeCalls, 1, `${tc.name} must close window exactly once`);
        assert.equal(session.isClosed(), true);
      } else {
        assert.equal(retryStop.closed, false, `${tc.name} must safely reject window close on retry stop`);
        assert.equal(closeCalls, 0, `${tc.name} must never call window-ensure-closed`);
        assert.equal(session.isClosed(), false);
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scenario 16: S1 worker PID array & numeric caller checks reject release, recover on authentic exit
// ---------------------------------------------------------------------------
test('Scenario 16: S1 worker PID array and numeric caller checks reject release, recover on authentic exit', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'scen16-'));
  try {
    for (const mode of ['worker-pid-array', 'worker-pid-numeric', 'worker-recovered']) {
      const subDir = join(tmpDir, mode);
      await mkdir(subDir, { recursive: true });
      let loc = '';
      const calls = [];
      const helperRun = async (_file, args) => {
        calls.push(args);
        if (args[0] === '--we-open') { loc = args[1]; return { opened: true }; }
        if (args[0] === '--window-find') return [{ hwnd: 555, pid: 1122, title: loc, visible: true }];
        if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
        return {};
      };

      const execCommand = (_f, args, _o, cb) => {
        const cmd = args?.at(-1) || '';
        if (cmd.includes('Get-Process -Id 1122') || cmd.includes('1122')) {
          cb(null, JSON.stringify({ ProcessId: 1122, CreationDate: '2026-10-18T00:00:00.6092543Z' }));
        } else if (mode === 'worker-pid-array') {
          // Worker record with ProcessId as array [process.pid], claiming location
          cb(null, JSON.stringify({
            ProcessId: [process.pid],
            Name: 'WallpaperProbe.exe',
            ExecutablePath: HELPER,
            CommandLine: `${HELPER} --taskbar-worker ${loc}`,
            CreationDate: '2026-10-18T00:00:00.6092543Z',
          }));
        } else if (mode === 'worker-pid-numeric') {
          // Worker record with numeric ProcessId equal to process.pid, claiming location
          cb(null, JSON.stringify({
            ProcessId: process.pid,
            Name: 'WallpaperProbe.exe',
            ExecutablePath: HELPER,
            CommandLine: `${HELPER} --taskbar-worker ${loc}`,
            CreationDate: '2026-10-18T00:00:00.6092543Z',
          }));
        } else {
          // Worker clean exit: query returns empty list
          cb(null, '');
        }
      };

      const session = createPreviewSession({
        helperRun,
        execCommand,
        spawnChild: () => fakeChild(c => { c.exitCode = 0; c.emit('close', 0); }),
        sleep: async () => {},
        exists,
      });

      await session.create({ helper: HELPER, output: subDir, scene: { scene: 'lucy' } });
      const firstStop = await session.stop();
      assert.equal(firstStop.closed, false);

      await writeFile(join(subDir, 'taskbar-action.json'), JSON.stringify({
        schemaVersion: 1, enabled: true, stage: 'action-done', location: loc,
        requestedIdentity: { hwnd: 555, pid: 1122, startUtc: '2026-10-18T00:00:00.6092543Z' },
        beforeIdentity: { startUtc: '2026-10-18T00:00:00.6092543Z' },
        action: { call: 'DeleteTab', succeeded: true, pending: false, cleanupSafe: true, started: true, exited: true, timedOut: false, terminated: false },
      }));

      const retryStop = await session.stop();
      const closeCalls = calls.filter(a => a[0] === '--window-ensure-closed').length;

      if (mode === 'worker-recovered') {
        assert.equal(retryStop.closed, true, 'clean exit must recover on retry stop');
        assert.equal(closeCalls, 1);
        assert.equal(session.isClosed(), true);
      } else {
        assert.equal(retryStop.closed, false, `${mode} must safely reject window close on retry stop`);
        assert.equal(closeCalls, 0);
        assert.equal(session.isClosed(), false);
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
