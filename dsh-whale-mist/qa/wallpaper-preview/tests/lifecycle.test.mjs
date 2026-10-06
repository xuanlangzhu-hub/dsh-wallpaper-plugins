import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createWallpaperBridge } from '../index.js';
import { validateLocation, validateProjectFile, validateSize, newLocation, runHelper } from '../managed-window.js';

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const LOCATION = 'WhaleWallpaperProbe-test-0001';
const WINDOW_PID = 33272;
const CONFIG = { helper: HELPER, output: 'F:\\fake\\out', seconds: 30, fps: 30, file: 'E:\\we\\3521337568\\project.json', location: LOCATION, width: 1280, height: 720 };

function fakeChild(onSpawn) {
  const child = new EventEmitter();
  child.pid = 4242; child.exitCode = null; child.killed = false;
  child.stdin = new EventEmitter(); child.stdin.end = () => { child.exitCode = 0; };
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.kill = () => { child.killed = true; child.exitCode = 1; };
  onSpawn(child);
  return child;
}

function harness({ config = CONFIG, windowFound = true, closeResult = { outcome: 'closed', closed: true, safeToCleanUp: true }, onHelper, onEnterClose, sleep } = {}) {
  const calls = [];
  const children = [];
  // The helper answers with the same camelCase field names the native probe emits.
  const fakeWindow = () => ({ hwnd: 555, pid: WINDOW_PID, title: config.location ?? LOCATION, visible: true, left: 76, top: 76 });
  const helperRun = async (helper, args) => {
    calls.push(args);
    if (onHelper) { const value = await onHelper(args, calls); if (value !== undefined) return value; }
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return windowFound ? [fakeWindow()] : [];
    if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
    if (args[0] === '--window-ensure-closed') { onEnterClose?.(args); return { ...closeResult, location: args[1] }; }
    throw new Error(`unexpected helper call ${args.join(' ')}`);
  };
  const bridge = createWallpaperBridge({
    loadConfig: async () => ({ ...config }),
    spawnChild: (helper, args) => { const child = fakeChild(value => children.push({ child: value, args })); return child; },
    helperRun,
    // A no-op sleep starves the microtask queue: the suspended create call could
    // never resume inside the poll loop. Yielding keeps the fake realistic.
    // Tests that need the create call to stay pending use real timers instead.
    sleep: sleep ?? (async () => { await new Promise(resolve => setImmediate(resolve)); }),
    now: () => 1700000000000,
  });
  return { bridge, calls, children };
}

const status = (child, value) => child.stderr.emit('data', `${JSON.stringify({ kind: 'log', level: 'info', scope: 'Status', message: JSON.stringify(value) })}\n`);
const closes = calls => calls.filter(args => args[0] === '--window-ensure-closed');
const applies = calls => calls.filter(args => args[0] === '--window-apply');

test('setup creates one round window, then capture, then tucks it off screen', async () => {
  const { bridge, calls, children } = harness();
  await bridge.setup();
  // The identity poll starts together with the create call, so the call order
  // between them is not significant.
  assert.deepEqual(calls.find(args => args[0] === '--we-open'), ['--we-open', LOCATION, CONFIG.file, '1280', '720']);
  assert.equal(children.length, 1);
  assert.equal(children[0].args[4], 'pipe');
  // R2 material: the capture process is told which round window it owns.
  assert.deepEqual(children[0].args.slice(5), ['--owned-location', LOCATION]);
  assert.equal(bridge.state().captureStarted, false);

  status(children[0].child, { frames: 3, captureSource: 'window', width: 1902, height: 1071 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bridge.state().captureStarted, true);
  // R5 material: the action names the expected round window and its process.
  assert.deepEqual(applies(calls).at(-1), ['--window-apply', '555', 'offscreen', '--location', LOCATION, '--pid', String(WINDOW_PID)]);
  assert.equal(bridge.report().native.captureSource, 'window');
  await bridge.stop();
});

test('capture start is only acted on when frames really come from the window', async () => {
  const { bridge, calls, children } = harness();
  await bridge.setup();
  status(children[0].child, { frames: 5, captureSource: 'monitor' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bridge.state().captureStarted, false);
  assert.equal(applies(calls).length, 0);
  await bridge.stop();
});

test('stop is idempotent: one window close, repeated calls reuse it', async () => {
  const { bridge, calls } = harness();
  await bridge.setup();
  await Promise.all([bridge.stop(), bridge.stop(), bridge.stop()]);
  await bridge.stop();
  assert.equal(closes(calls).length, 1);
  assert.deepEqual(closes(calls)[0], ['--window-ensure-closed', LOCATION, '15000', '--expect-pid', String(WINDOW_PID)]);
  assert.equal(bridge.report().stopping, true);
  assert.equal(bridge.report().failure, null);
  assert.equal(bridge.report().window.cleanup.closed, true);
});

// R1: the reviewer's exact timing. The previous implementation cached the first
// cleanup attempt, so a stop that landed while --we-open was still pending
// returned without closing the window that appeared afterwards. Real timers are
// required here: an instantly-resolving sleep lets the create call settle in the
// same microtask burst, which hides whether teardown really waited.
test('stop requested during window creation still closes the late window', async () => {
  const realSleep = ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5)));
  let release, windowVisible = false;
  const gate = new Promise(resolve => { release = resolve; });
  const record = () => ({ hwnd: 555, pid: WINDOW_PID, title: LOCATION, visible: true, left: 76, top: 76 });
  const { bridge, calls } = harness({
    sleep: realSleep,
    onHelper: async args => {
      if (args[0] === '--we-open') { await gate; windowVisible = true; return { opened: true }; }
      if (args[0] === '--window-find') return windowVisible ? [record()] : [];
      return undefined;
    },
  });
  const setup = bridge.setup();
  await new Promise(resolve => setImmediate(resolve));
  const stop = bridge.stop();
  // The teardown must not finish while the create call is still pending: it has
  // to wait for the window verdict instead of closing nothing.
  const early = await Promise.race([stop.then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 150))]);
  assert.equal(early, 'pending', 'teardown must wait for the in-flight window creation');
  release();
  await setup;
  await stop;
  await bridge.stop();           // any later stop must not duplicate the close
  assert.equal(bridge.state().windowCreated, true);
  assert.equal(closes(calls).length, 1, 'the late window must be closed exactly once');
  assert.equal(bridge.state().cleanup.closed, true);
  assert.equal(bridge.report().failure, null);
});

// R1, reviewer's timing: the teardown starts while --we-open is still suspended.
// It must wait for that creation to settle instead of deciding "nothing to close"
// before the window exists; the window that appears afterwards must be closed.
test('a window that appears after the create call returns is still closed', async () => {
  let release, closeCalls = 0, windowVisible = false;
  const gate = new Promise(resolve => { release = resolve; });
  const record = () => ({ hwnd: 555, pid: WINDOW_PID, title: LOCATION, visible: true, left: 76, top: 76 });
  const { bridge, children } = harness({
    onHelper: async args => {
      if (args[0] === '--we-open') { await gate; windowVisible = true; return { opened: true }; }
      if (args[0] === '--window-find') return windowVisible ? [record()] : [];
      if (args[0] === '--window-ensure-closed') {
        closeCalls++;
        // A close that races the creation can legitimately find nothing.
        return windowVisible
          ? { outcome: 'closed', closed: true, location: args[1], waitedMs: 20, safeToCleanUp: true, error: null }
          : { outcome: 'absent', closed: true, location: args[1], waitedMs: 20, safeToCleanUp: true, error: null };
      }
      return undefined;
    },
  });
  const setup = bridge.setup();
  await new Promise(resolve => setImmediate(resolve));
  release();
  // Wait until the identity poll has actually observed the window, so the test
  // does not race the poll's own scheduling.
  for (let attempt = 0; attempt < 200 && children.length === 0; attempt++) await new Promise(resolve => setImmediate(resolve));
  await setup;
  await bridge.stop();
  assert.equal(bridge.state().windowCreated, true);
  assert.equal(children.length, 1, 'the window that appeared must become the capture source');
  assert.equal(closeCalls, 1, 'the late window must be closed exactly once, after it appeared');
  assert.equal(bridge.state().cleanup.closed, true, 'the final cleanup must report the window closed');
  assert.equal(bridge.report().failure, null);
});

// R1, the reviewer's literal repro sketch. Their sequence was "stop() fully
// completes while --we-open is suspended, then release the creation". With the
// fixed design that sequence cannot complete before the creation reaches a
// verdict — teardown waits for it — which is exactly the property the test above
// asserts. What still has to hold is that the window created after that verdict
// is closed; that is covered here with the creation released after teardown
// started, using real timers so the create call really is pending.
test('a window created after teardown started is still closed', async () => {
  const realSleep = ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5)));
  let release, windowVisible = false, windowAppeared = false;
  const gate = new Promise(resolve => { release = resolve; });
  const record = () => ({ hwnd: 555, pid: WINDOW_PID, title: LOCATION, visible: true, left: 76, top: 76 });
  const { bridge, calls } = harness({
    sleep: realSleep,
    onHelper: async args => {
      if (args[0] === '--we-open') { await gate; windowVisible = true; windowAppeared = true; return { opened: true }; }
      if (args[0] === '--window-find') return windowVisible ? [record()] : [];
      return undefined;
    },
  });
  const setup = bridge.setup();
  await new Promise(resolve => setTimeout(resolve, 20));
  const stop = bridge.stop();           // teardown starts while the create is pending
  await new Promise(resolve => setTimeout(resolve, 50));
  release();
  await Promise.all([setup, stop]);
  assert.equal(windowAppeared, true, 'the helper must have created the window after the stop');
  assert.equal(bridge.state().windowCreated, true);
  assert.equal(closes(calls).length, 1, 'the late window must be closed exactly once');
  assert.equal(bridge.state().cleanup.closed, true, 'the late window must be reported closed');
  assert.equal(bridge.report().failure, null);
});

test('a failed create call that left nothing behind rolls back and never captures', async () => {
  const { bridge, calls, children } = harness({
    windowFound: false, // the fake helper reports no window at all
    onHelper: async args => {
      if (args[0] === '--we-open') throw new Error('--we-open exited 1: bad window location');
      return undefined;
    },
  });
  await bridge.setup();
  assert.equal(children.length, 0, 'capture must not start when no window exists');
  assert.equal(closes(calls).length, 1, 'a possibly created window must still be cleaned up');
  assert.deepEqual(closes(calls)[0].slice(0, 2), ['--window-ensure-closed', LOCATION]);
  assert.match(bridge.report().failure, /Window setup failed/);
});

test('a failed create call that did leave a window is still cleaned up', async () => {
  // "The helper errored" is not proof that nothing was created, so a window that
  // exists when the call failed must be closed instead of captured forever.
  const { bridge, calls, children } = harness({
    onHelper: async args => {
      if (args[0] === '--we-open') throw new Error('--we-open exited 1: window appeared but the helper reported failure');
      return undefined;
    },
  });
  await bridge.setup();
  assert.equal(children.length, 0, 'a failed setup must not continue into capture');
  assert.equal(closes(calls).length, 1, 'the window left behind by the failed call must be closed');
  assert.equal(bridge.state().cleanup.closed, true);
  assert.match(bridge.report().failure, /Window setup failed/);
});

// 本轮指定修复的落点：--we-open 报错之后窗口才出现。清理必须先跑完有界的窗口轮询，
// 再决定是否关窗；"helper 报错" 本身不能当作"没有窗口"。
// 时序：建窗调用报错（此时窗口还不存在）→ setup 按失败回滚、但清理先做有界轮询
// → 窗口在宽限期内出现并首次被观察到 → 清理据此发一次关闭。
test('a window that shows up after a failed create call is still closed', async () => {
  const realSleep = ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5)));
  let windowPresent = false;
  let closeArgs = null;
  let findCalls = 0;
  const record = () => ({ hwnd: 555, pid: WINDOW_PID, title: LOCATION, visible: true, left: 76, top: 76 });
  const { bridge, calls } = harness({
    sleep: realSleep,
    onHelper: async args => {
      if (args[0] === '--we-open') {
        // 建窗调用报错；窗口此刻还不存在。
        assert.equal(windowPresent, false);
        throw new Error('--we-open exited 1: helper reported failure');
      }
      if (args[0] === '--window-find') {
        findCalls++;
        // 窗口在清理的有界轮询期间才出现。
        if (findCalls === 3) windowPresent = true;
        return windowPresent ? [record()] : [];
      }
      return undefined;
    },
    // 关闭动作本身才是让窗口消失的原因，之后的状态改变才是真实验的。
    onEnterClose: args => { closeArgs = args; windowPresent = false; },
  });
  await bridge.setup();
  assert.match(bridge.report().failure, /Window setup failed/);

  for (let attempt = 0; attempt < 400 && !closeArgs; attempt++) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(closeArgs, 'the late window must be closed after the bounded poll observed it');
  assert.deepEqual(closeArgs.slice(0, 2), ['--window-ensure-closed', LOCATION]);
  // 带 --expect-pid 说明清理确实是在观察到窗口之后才发的关闭请求。
  assert.deepEqual(closeArgs.slice(2), ['15000', '--expect-pid', String(WINDOW_PID)]);
  assert.equal(bridge.state().cleanup.closed, true, 'cleanup must report the window closed');
  assert.equal(windowPresent, false, 'the window must not exist after cleanup');
  assert.equal(calls.filter(args => args[0] === '--window-ensure-closed').length, 1, 'exactly one close attempt');
  assert.ok(findCalls >= 3, 'cleanup must poll the window identity before deciding');
});

test('an ambiguous window match is refused instead of acted on', async () => {
  const duplicated = () => [
    { hwnd: 555, pid: WINDOW_PID, title: LOCATION },
    { hwnd: 556, pid: WINDOW_PID, title: LOCATION },
  ];
  const { bridge, calls, children } = harness({ onHelper: async args => (args[0] === '--window-find' ? duplicated() : undefined) });
  await bridge.setup();
  assert.equal(children.length, 0, 'capture must not start on an ambiguous target');
  assert.equal(applies(calls).length, 0);
  assert.match(bridge.report().failure, /refusing an ambiguous session/);
  assert.equal(closes(calls).length, 1);
});

// R4: the native close reports an outcome; only a proven-gone window is cleaned up.
test('a close that reports closed=false is a recorded failure, not a success', async () => {
  const { bridge, calls } = harness({ closeResult: { outcome: 'timeout', closed: false, safeToCleanUp: false, error: 'Window still existed after the close wait.' } });
  await bridge.setup();
  await bridge.stop();
  assert.equal(closes(calls).length, 1);
  assert.equal(bridge.report().window.cleanup.outcome, 'timeout');
  assert.match(bridge.report().failure, /Window cleanup incomplete \(timeout\)/);
});

test('an ambiguous close identity is a recorded failure', async () => {
  const { bridge } = harness({ closeResult: { outcome: 'ambiguous', closed: false, safeToCleanUp: false, error: "2 windows match 'x'" } });
  await bridge.setup();
  await bridge.stop();
  assert.equal(bridge.report().window.cleanup.outcome, 'ambiguous');
  assert.match(bridge.report().failure, /Window cleanup incomplete \(ambiguous\)/);
});

test('a window that never appears rolls back without starting capture', async () => {
  const { bridge, calls, children } = harness({ windowFound: false });
  await bridge.setup();
  assert.equal(children.length, 0, 'capture must not start without a verified window');
  assert.match(bridge.report().failure, /Window setup failed/);
  assert.equal(closes(calls).length, 1, 'partial setup must still be rolled back');
});

test('a capture child that exits on its own stops the bridge without restarting', async () => {
  const { bridge, children } = harness();
  await bridge.setup();
  const child = children[0].child;
  let closeEvents = 0;
  child.on('close', () => { closeEvents++; });
  child.exitCode = 3;
  child.emit('close', 3);
  await bridge.stop();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closeEvents, 1);
  assert.equal(children.length, 1, 'a failed capture must not be restarted');
  assert.match(bridge.report().failure, /Capture exited: 3/);
});

test('a capture error from stderr stops the bridge and reports the reason', async () => {
  const { bridge, children } = harness();
  await bridge.setup();
  children[0].child.stderr.emit('data', `${JSON.stringify({ kind: 'log', level: 'error', scope: 'Probe', message: 'InvalidOperationException', detail: 'this window cannot be captured' })}\n`);
  await bridge.stop();
  assert.equal(bridge.report().stopping, true);
  assert.match(bridge.report().failure, /this window cannot be captured/);
  assert.equal(bridge.report().diagnostics.errors, 1);
});

test('a failed tuck is reported instead of silently leaving the window on screen', async () => {
  const { bridge, children } = harness({
    onHelper: async args => {
      if (args[0] === '--window-apply') throw new Error('--window-apply exited 1: HWND is a different window now');
      return undefined;
    },
  });
  await bridge.setup();
  status(children[0].child, { frames: 2, captureSource: 'window' });
  await new Promise(resolve => setImmediate(resolve));
  await bridge.stop();
  assert.equal(bridge.state().captureStarted, true);
  assert.match(bridge.report().failure, /Window tuck failed/);
});

test('an invalid config never creates or closes a window', async () => {
  const { bridge, calls } = harness({ config: { ...CONFIG, helper: 'relative\\WallpaperProbe.exe' } });
  await assert.rejects(() => bridge.setup(), /Invalid local probe configuration/);
  assert.equal(calls.length, 0);
});

test('window names and sample paths are validated before any helper call', () => {
  assert.equal(validateLocation('WhaleWallpaperProbe-20261005-abc'), 'WhaleWallpaperProbe-20261005-abc');
  for (const bad of ['', 'OtherWindow', 'WhaleWallpaperProbe-a b', 'WhaleWallpaperProbe-a"b', 'WhaleWallpaperProbe-a\\b', `WhaleWallpaperProbe-${'a'.repeat(200)}`])
    assert.throws(() => validateLocation(bad));
  assert.equal(validateProjectFile('E:\\we\\3521337568\\project.json').endsWith('project.json'), true);
  for (const bad of ['', 'scene.pkg', 'relative\\project.json', 'E:\\a"b.json']) assert.throws(() => validateProjectFile(bad));
  assert.equal(validateSize(undefined, 1280), 1280);
  assert.throws(() => validateSize(50, 1280));
  const location = newLocation(1700000000000, 0.5);
  assert.match(location, /^WhaleWallpaperProbe-\d{12}-[0-9a-f]{4}$/);
  assert.notEqual(newLocation(1700000000000, 0.1), newLocation(1700000000000, 0.9));
});

test('runHelper rejects a non-zero exit with the helper diagnostic', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => {};
    setImmediate(() => {
      child.stderr.emit('data', '{"kind":"log","level":"error","scope":"Probe","message":"Target HWND 999 is not a valid window."}\n');
      child.emit('close', 1);
    });
    return child;
  };
  await assert.rejects(() => runHelper(spawnImpl, HELPER, ['--window-status', '999'], { timeoutMs: 500 }), /exited 1.*not a valid window/);
});
