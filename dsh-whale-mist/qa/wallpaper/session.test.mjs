import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewSession, registerWallpaperRoutes, pruneRuns, prepareRunDirectory, resolveHostResources, probeAvailability } from '../../src/wallpaper/session.js';
import { resolveSceneRequest, describeScenes, SCENES, PREVIEW_SECONDS } from '../../src/wallpaper/scenes.js';
import { createProfile, removeProfile } from '../temp-profile.mjs';

const ROUTE_TEST_ROOT = await createProfile('wm-route-fixture-');
after(() => removeProfile(ROUTE_TEST_ROOT));

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const SCENE_FILE = SCENES.lucy.project;
const exists = path => path === HELPER || path === SCENE_FILE;

function fakeChild(onSpawn) {
  const child = new EventEmitter();
  child.pid = 4242; child.exitCode = null; child.killed = false;
  child.stdin = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin.end = () => {
    child.exitCode = 0;
    if (!child.killed) {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } })
      }) + '\n');
    }
    child.emit('exit', 0);
    child.emit('close', 0);
  };
  child.kill = () => {
    child.killed = true;
    child.exitCode = 1;
    child.emit('exit', 1);
    child.emit('close', 1);
  };
  onSpawn(child);
  return child;
}

function sessionHarness({ helperOk = true, windowOk = true, closeResult = { outcome: 'closed', closed: true } } = {}) {
  const calls = [];
  const children = [];
  const openedLocation = () => calls.find(call => call[0] === '--we-open')?.[1] ?? '';
  const helperRun = async (helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') {
      if (!helperOk) throw new Error('--we-open exited 1: helper reported failure');
      return { opened: true };
    }
    if (args[0] === '--window-find') {
      if (!windowOk) return [];
      // The identity poll must answer with this run's name, exactly like the helper does.
      return [{ hwnd: 555, pid: 33272, title: openedLocation(), visible: true, left: 76, top: 76 }];
    }
    if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
    if (args[0] === '--window-onscreen') return {visibleArea: 0, window: {hwnd: 555, pid: 33272, title: openedLocation(), visible: true, iconic: false, cloaked: false, left: 4096, top: 0, width: 1280, height: 720}};
    if (args[0] === '--window-ensure-closed') return { ...closeResult, location: args[1] };
    throw new Error(`unexpected helper call ${args.join(' ')}`);
  };
  const session = createPreviewSession({
    helperRun,
    spawnChild: (helper, args) => { const child = fakeChild(value => children.push({ child: value, args })); return child; },
    sleep: async () => { await new Promise(resolve => setTimeout(resolve, 0)); },
    now: () => 1700000000000,
  });
  return { session, calls, children };
}

const findCalls = calls => calls.filter(args => args[0] === '--window-find');
const status = (child, value) => child.stderr.emit('data', `${JSON.stringify({ kind: 'log', level: 'info', scope: 'Status', message: JSON.stringify(value) })}\n`);

test('a run creates one uniquely named window, then captures with owned-location', async () => {
  const { session, calls, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const opened = calls.find(args => args[0] === '--we-open');
  assert.ok(opened, 'the helper must create the window');
  assert.match(opened[1], /^WhaleWallpaperProbe-\d{12}-[0-9a-f]{4}$/, 'the window name is round unique');
  assert.equal(opened[2], SCENE_FILE, 'only the whitelisted project can be opened');
  assert.equal(children.length, 1);
  assert.deepEqual(children[0].args.slice(4), ['pipe', '--owned-location', opened[1], '--taskbar-hide']);
  assert.equal(session.state().captureStarted, false);
  await session.stop();
});

test('the window is tucked away only after frames provably come from it', async () => {
  const { session, calls, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  status(children[0].child, { frames: 4, captureSource: 'window' });
  await new Promise(resolve => setImmediate(resolve));
  const tuck = calls.filter(args => args[0] === '--window-apply').at(-1);
  assert.ok(tuck, 'the window must be moved off screen');
  assert.equal(tuck[3], '--location');
  assert.equal(tuck[4], session.state().location);
  await session.stop();
});

test('a capture start that is not from this window never triggers a window action', async () => {
  const { session, calls, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  status(children[0].child, { frames: 4, captureSource: 'monitor' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(args => args[0] === '--window-apply').length, 0);
  await session.stop();
});

test('stop is idempotent and closes exactly this run once', async () => {
  const { session, calls } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  await Promise.all([session.stop(), session.stop(), session.stop()]);
  await session.stop();
  const closes = calls.filter(args => args[0] === '--window-ensure-closed');
  assert.equal(closes.length, 1);
  assert.equal(closes[0][1], session.state().location);
  assert.equal(session.state().cleanup.closed, true);
  assert.equal(session.report().failure, null);
});

test('a stop that lands during window creation still closes the late window', async () => {
  let release, visible = false;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const helperRun = async (helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') { await gate; visible = true; return { opened: true }; }
    if (args[0] === '--window-find') return visible ? [{ hwnd: 555, pid: 33272, title: calls.find(call => call[0] === '--we-open')[1], visible: true }] : [];
    if (args[0] === '--window-ensure-closed') { visible = false; return { outcome: 'closed', closed: true }; }
    throw new Error('unexpected ' + args.join(' '));
  };
  const session = createPreviewSession({ helperRun, spawnChild: () => fakeChild(() => {}), sleep: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5))) });
  const creating = session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopping = session.stop();
  const early = await Promise.race([stopping.then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 50))]);
  assert.equal(early, 'pending', 'teardown must wait for the in-flight creation');
  release();
  await creating.catch(() => {});
  await stopping;
  assert.equal(calls.filter(args => args[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.state().cleanup.closed, true, 'the late window must be reported closed');
  assert.equal(visible, false, 'the late window must be gone');
});

test('a helper reported failure still rolls back a window that appears late', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  let windowVisible = false;
  const helperRun = async (helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') { await gate; throw new Error('--we-open exited 1: helper reported failure'); }
    if (args[0] === '--window-find') return windowVisible ? [{ hwnd: 555, pid: 33272, title: calls.find(call => call[0] === '--we-open')[1], visible: true }] : [];
    if (args[0] === '--window-ensure-closed') { windowVisible = false; return { outcome: 'closed', closed: true }; }
    throw new Error('unexpected ' + args.join(' '));
  };
  const session = createPreviewSession({ helperRun, spawnChild: () => fakeChild(() => {}), sleep: () => new Promise(resolve => setTimeout(resolve, 0)) });
  const creating = session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  release();
  await new Promise(resolve => setTimeout(resolve, 5));
  windowVisible = true;
  await assert.rejects(() => creating, /Window setup failed/);
  assert.equal(calls.filter(args => args[0] === '--window-ensure-closed').length, 1, 'the late window must be closed');
  assert.equal(session.report().failure.startsWith('Window setup failed'), true);
});

test('a capture error stops the run and reports the reason', async () => {
  const { session, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  children[0].child.stderr.emit('data', `${JSON.stringify({ kind: 'log', level: 'error', scope: 'Probe', message: 'InvalidOperationException', detail: 'this window cannot be captured' })}\n`);
  await session.stop();
  assert.match(session.report().failure, /this window cannot be captured/);
});

test('a close reported as unfinished is a recorded failure, never a silent success', async () => {
  const { session } = sessionHarness({ closeResult: { outcome: 'timeout', closed: false, error: 'still there' } });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  await session.stop();
  assert.equal(session.state().cleanup.outcome, 'timeout');
  assert.match(session.report().failure, /Window cleanup incomplete \(timeout\)/);
});

test('a session instance refuses a second run', async () => {
  const { session } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  await assert.rejects(() => session.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy' } }), /already started a run/);
  await session.stop();
  await assert.rejects(() => session.create({ helper: HELPER, output: 'F:\\out3', scene: { scene: 'lucy' } }), /already (started a run|ended)/);
});

test('daily mode runs the capture without a duration and preview keeps its bounds', async () => {
  const { session, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy', mode: 'daily' } });
  const dailyArgs = children[0].args;
  assert.equal(dailyArgs[2], '--forever', 'the capture child gets the no-timer form');
  assert.equal(session.state().config.mode, 'daily');
  assert.equal(session.state().config.seconds, null);
  await session.stop();

  const second = sessionHarness();
  await second.session.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy', seconds: 30 } });
  assert.equal(second.children[0].args[2], '30', 'preview still passes its bounded duration');
  assert.equal(second.session.state().config.mode, 'preview');
  await second.session.stop();
});

test('the off-screen start experiment stays off unless it is requested', async () => {
  const plain = sessionHarness();
  await plain.session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const plainOpen = plain.calls.find(args => args[0] === '--we-open');
  assert.equal(plainOpen.includes('--initial-offscreen'), false, 'the accepted order is used by default');
  await plain.session.stop();

  const experiment = sessionHarness();
  await experiment.session.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy' }, offscreenStart: true });
  const experimentOpen = experiment.calls.find(args => args[0] === '--we-open');
  assert.equal(experimentOpen.includes('--initial-offscreen'), true, 'the experiment entry is opt-in');
  assert.equal(experiment.session.state().config.offscreenStart, true);
  await experiment.session.stop();
});
test('scene payloads are constrained to the whitelist and to the playback modes', () => {
  const request = resolveSceneRequest({ scene: 'lucy', seconds: 999 }, { exists });
  assert.equal(request.project, SCENE_FILE);
  assert.equal(request.seconds, PREVIEW_SECONDS.max, 'the preview limit is enforced host side');
  assert.equal(request.mode, 'preview', 'a request without a mode keeps the preview behaviour');
  assert.equal(request.width, 1280);
  assert.equal(resolveSceneRequest({}, { exists }).sceneId, 'lucy', 'the default scene is Lucy');
  assert.throws(() => resolveSceneRequest({ scene: '../../etc/passwd' }, { exists }), /unknown scene/);
  assert.throws(() => resolveSceneRequest({ scene: 'lucy' }, { exists: () => false }), /scene file is missing/);
  assert.equal(describeScenes({ exists }).find(scene => scene.id === 'lucy').available, true);

  // Daily playback has no timer: the request carries no duration and the host must not
  // invent one, because a duration would silently end a run the user meant to keep.
  const daily = resolveSceneRequest({ scene: 'lucy', mode: 'daily' }, { exists });
  assert.equal(daily.mode, 'daily');
  assert.equal(daily.seconds, null, 'daily mode has no duration');
  assert.equal(daily.fps, 30);
  assert.throws(() => resolveSceneRequest({ scene: 'lucy', mode: 'daily', seconds: 180 }, { exists }), /daily mode does not take a duration/);
  assert.throws(() => resolveSceneRequest({ scene: 'lucy', mode: 'forever' }, { exists }), /unknown mode/);
  assert.throws(() => resolveSceneRequest({ scene: 'lucy', mode: 7 }, { exists }), /unknown mode/);
  // Preview keeps its bounds, including the default when the caller omits seconds.
  const preview = resolveSceneRequest({ scene: 'lucy', mode: 'preview' }, { exists });
  assert.equal(preview.seconds, PREVIEW_SECONDS.default);
  assert.equal(resolveSceneRequest({ scene: 'lucy', seconds: 1 }, { exists }).seconds, PREVIEW_SECONDS.min);
});

test('host resources resolve from the package, not from a development path', () => {
  const resources = resolveHostResources(import.meta.url, { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' });
  assert.match(resources.helper, /dsh-whale-mist[\\/]assets[\\/]wallpaper[\\/]WallpaperProbe\.exe$/);
  assert.match(resources.logRoot, /Whale Appearance[\\/]wallpaper-preview$/);
  assert.equal(probeAvailability({ platform: 'linux', helper: resources.helper, exists }).available, false);
  assert.equal(probeAvailability({ platform: 'win32', env: {}, helper: resources.helper, exists }).available, false);
  assert.equal(probeAvailability({ platform: 'win32', env: { LOCALAPPDATA: 'x' }, helper: 'C:\\missing.exe', exists }).reason, 'helper');
  // A present helper with every whitelisted sample missing is the "scene" reason, and
  // the missing list says which samples were not found.
  assert.equal(probeAvailability({ platform: 'win32', env: { LOCALAPPDATA: 'x' }, helper: HELPER, exists: path => path === HELPER }).reason, 'scene');
  assert.deepEqual(probeAvailability({ platform: 'win32', env: { LOCALAPPDATA: 'x' }, helper: HELPER, exists: path => path === HELPER }).missing, ['lucy']);
  assert.equal(probeAvailability({ platform: 'win32', env: { LOCALAPPDATA: 'x' }, helper: HELPER, exists }).available, true);
  assert.equal(probeAvailability({ platform: 'win32', env: { LOCALAPPDATA: 'x' }, helper: HELPER, exists: () => false }).reason, 'helper', 'a missing helper is reported before the sample check');
});

test('run directories are rotated so logs cannot grow without bound', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wm-runs-'));
  try {
    for (let index = 0; index < 12; index++) await prepareRunDirectory(root, 'lucy', 1700000000000 + index * 1000);
    assert.equal((await readdir(root)).length, 12);
    const removed = await pruneRuns(root, 8);
    assert.equal(removed.length, 4);
    assert.equal((await readdir(root)).length, 8);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function routeHarness({ sessions = [], offscreenStart } = {}) {
  const routes = new Map();
  const registered = [];
  const ctx = {
    effect(callback) { const off = callback(); registered.push(off); return off; },
    webServer: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path); } },
  };
  const factory = () => {
    const session = sessionHarness().session;
    sessions.push(session);
    return session;
  };
  const api = registerWallpaperRoutes(ctx, { helper: HELPER, logRoot: ROUTE_TEST_ROOT, sessionFactory: factory, exists, offscreenStart });
  return { ctx, routes, api, sessions, registered };
}

async function call(route, method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
  const response = { status: 0, payload: null, headers: {}, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  await route.handler(req, response);
  return response;
}

test('routes use screen-external startup by default and preserve an explicit fallback', async () => {
  for (const value of [undefined, false]) {
    const { routes, sessions } = routeHarness({offscreenStart: value});
    const route = routes.get('/whale-wallpaper');
    const response = await call(route, 'POST', '/whale-wallpaper/start', {scene: 'lucy'});
    assert.equal(response.status, 200);
    assert.equal(sessions[0].state().config.offscreenStart, value !== false);
    await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(sessions[0].isClosed(), true);
  }
});

test('a verified initially offscreen source is not resized again after capture starts', async () => {
  const {session, calls, children} = sessionHarness();
  await session.create({helper: HELPER, output: 'F:\\out', scene: {scene: 'lucy'}, offscreenStart: true});
  status(children[0].child, {captureSource: 'window'});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls.filter(args => args[0] === '--window-onscreen').length, 1);
  assert.equal(calls.filter(args => args[0] === '--window-apply').length, 0);
  assert.equal(session.report().native.tucked.strategy, 'initial-position');
  await session.stop();
  assert.equal(session.isClosed(), true);
});

test('routes accept only constrained actions and reject a second concurrent start', async () => {
  const { routes, sessions } = routeHarness();
  const route = routes.get('/whale-wallpaper');
  const statusResponse = await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(statusResponse.status, 200);
  const payload = JSON.parse(statusResponse.payload);
  assert.equal(payload.available, true);
  assert.deepEqual(payload.scenes.map(scene => scene.id), ['lucy']);

  const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', path: 'C:\\evil.exe', hwnd: 123 });
  assert.equal(started.status, 200, started.payload);
  assert.equal(sessions.length, 1, 'the whitelisted scene is the only thing that can be started');
  // Stop through the route so the ownership record is released as well.
  const firstStop = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(firstStop.status, 200, firstStop.payload);

  // A forged-but-well-formed catalogue id is refused by the Host, and a name that is not an id at
  // all never reaches a lookup: both are reported, neither falls back to the verified sample.
  const forged = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'we-000000000000000000000000' });
  assert.equal(forged.status, 409);
  assert.match(JSON.parse(forged.payload).error, /library|verify/i);

  const rejected = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'nope' });
  assert.equal(rejected.status, 409);
  assert.match(JSON.parse(rejected.payload).error, /unknown scene/);

  const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(stopped.status, 200);
  assert.equal(JSON.parse(stopped.payload).active, false);
});

test('a restart stops the old run before a new instance is created', async () => {
  const { routes, sessions } = routeHarness();
  const route = routes.get('/whale-wallpaper');
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
  const first = sessions[0];
  const restarted = await call(route, 'POST', '/whale-wallpaper/restart', { scene: 'lucy' });
  assert.equal(restarted.status, 200, restarted.payload);
  assert.equal(sessions.length, 2, 'a restart builds a new instance');
  assert.equal(first.isClosed(), true, 'the previous run was stopped and its window proven closed');
  assert.equal(first.state().cleanup.closed, true);
  for (const session of sessions) await session.stop();
});

test('an unavailable helper is reported instead of starting', async () => {
  const routes = new Map();
  const ctx = {
    effect(callback) { return callback(); },
    webServer: { register(route) { routes.set(route.path, route); return () => {}; } },
  };
  registerWallpaperRoutes(ctx, { helper: 'C:\\missing.exe', logRoot: ROUTE_TEST_ROOT, sessionFactory: () => sessionHarness().session, exists });
  const route = routes.get('/whale-wallpaper');
  const statusResponse = JSON.parse((await call(route, 'GET', '/whale-wallpaper/status')).payload);
  assert.equal(statusResponse.available, false);
  assert.equal(statusResponse.unavailableReason, 'helper');
  const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(started.status, 409);
  assert.match(JSON.parse(started.payload).error, /unavailable: helper/);
});

test('unloading the plugin stops the active run', async () => {
  const routes = new Map();
  const disposers = [];
  const ctx = {
    effect(callback) { const off = callback(); disposers.push(off); return off; },
    webServer: { register(route) { routes.set(route.path, route); return () => {}; } },
  };
  const closeCalls = [];
  const sessions = [];
  registerWallpaperRoutes(ctx, { helper: HELPER, logRoot: ROUTE_TEST_ROOT,
    sessionFactory: ({ exists: factoryExists }) => {
      const harness = sessionHarness();
      // Record the close so the assertion can check the window really was closed.
      const original = harness.session.stop;
      harness.session.stop = () => { closeCalls.push(harness.session.state().location); return original(); };
      sessions.push(harness.session);
      assert.equal(typeof factoryExists, 'function', 'the session must share the route availability check');
      return harness.session;
    },
    exists });
  await call(routes.get('/whale-wallpaper'), 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(sessions[0].ending(), false, 'the run is active before disposal');
  for (const off of disposers.reverse()) if (typeof off === 'function') await off();
  assert.equal(sessions[0].isClosed(), true, 'disposal must stop the run and prove the window closed');
  assert.equal(closeCalls.length, 1, 'disposal must close this run\'s window');
  assert.equal(sessions[0].report().failure, null);
});

test('run metadata is written under the controlled directory only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wm-log-'));
  try {
    const output = await prepareRunDirectory(root, 'lucy');
    const { session } = sessionHarness();
    await session.create({ helper: HELPER, output, scene: { scene: 'lucy' } });
    await session.stop();
    const files = await readdir(output);
    assert.deepEqual(files.sort(), ['preview-final.json']);
    await writeFile(join(output, 'frames.jsonl'), '');
    const pruned = await pruneRuns(root, 1);
    assert.deepEqual(pruned, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('session passes --taskbar-hide by default and respects WM_WALLPAPER_TASKBAR_HIDE=0', async () => {
  const normal = sessionHarness();
  await normal.session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  assert.equal(normal.children[0].args.includes('--taskbar-hide'), true, 'enabled by default');
  await normal.session.stop();

  const disabledChildren = [];
  const disabledCalls = [];
  const disabledSession = createPreviewSession({
    env: { WM_WALLPAPER_TASKBAR_HIDE: '0' },
    helperRun: async (helper, args) => {
      disabledCalls.push(args);
      if (args[0] === '--we-open') return { opened: true };
      if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: disabledCalls.find(c => c[0] === '--we-open')?.[1] ?? '', visible: true }];
      if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
      return {};
    },
    spawnChild: (helper, args) => {
      const child = fakeChild(c => disabledChildren.push({ child: c, args }));
      return child;
    },
    sleep: async () => {},
    now: () => 1700000000000,
  });

  await disabledSession.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy' } });
  assert.equal(disabledChildren[0].args.includes('--taskbar-hide'), false, 'fallback switch disables taskbar hide');
  await disabledSession.stop();
});

test('controlled shutdown sequence awaits child exit before closing source window', async () => {
  const order = [];
  let openedLocation = '';
  const helperRun = async (helper, args) => {
    order.push(args[0]);
    if (args[0] === '--we-open') { openedLocation = args[1]; return { opened: true }; }
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: openedLocation, visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  let mockChild;
  const spawnChild = (helper, args) => {
    mockChild = new EventEmitter();
    mockChild.pid = 9999;
    mockChild.exitCode = null;
    mockChild.killed = false;
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.stdin = new EventEmitter();
    mockChild.stdin.end = () => {
      order.push('stdin-end');
      // Simulate child exiting after a delay
      setTimeout(() => {
        mockChild.stderr.emit('data', JSON.stringify({
          kind: 'log', level: 'info', scope: 'Summary',
          message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'armed', attempted: false, cleanupSafe: true } })
        }) + '\n');
        order.push('child-exit');
        mockChild.exitCode = 0;
        mockChild.emit('exit', 0);
        mockChild.emit('close', 0);
      }, 25);
    };
    mockChild.kill = () => { mockChild.killed = true; mockChild.exitCode = 1; };
    return mockChild;
  };

  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 1000, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  await session.stop();

  assert.equal(order.includes('stdin-end'), true);
  assert.equal(order.includes('child-exit'), true);
  assert.equal(order.includes('--window-ensure-closed'), true);
  assert.ok(order.indexOf('stdin-end') < order.indexOf('child-exit'), 'stdin closed before child exit');
  assert.ok(order.indexOf('child-exit') < order.indexOf('--window-ensure-closed'), 'child exits BEFORE source window close');
  assert.equal(session.state().cleanup.closed, true);
});

test('unconfirmed worker aborts source window close and retains session ownership', async () => {
  const calls = [];
  let openedLocation = '';
  const helperRun = async (helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') { openedLocation = args[1]; return { opened: true }; }
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: openedLocation, visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    return {};
  };

  const spawnChild = (helper, args) => {
    const child = fakeChild(() => {});
    // Child exits but reports worker unconfirmed in status
    child.stdin.end = () => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Status',
        message: JSON.stringify({ taskbarHide: { cleanupSafe: false, stage: 'action-unconfirmed' } })
      }) + '\n');
      child.exitCode = 0;
      child.emit('close', 0);
    };
    return child;
  };

  const session = createPreviewSession({ helperRun, spawnChild, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();

  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0, 'source window close is BLOCKED when worker is unconfirmed');
  assert.equal(session.isClosed(), false);

  // Next create is blocked because old session was not confirmed closed
  await assert.rejects(() => session.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy' } }), /already (started a run|ended)/);
});

test('ordinary taskbar hide warning does not stop playback', async () => {
  const { session, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });

  // Native emits warning for hide failure with cleanupSafe = true
  children[0].child.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'warn', scope: 'TaskbarHide',
    message: 'Taskbar hide failed (DeleteTab): HRESULT 0x80004005'
  }) + '\n');
  children[0].child.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'info', scope: 'Status',
    message: JSON.stringify({ taskbarHide: { cleanupSafe: true, stage: 'failed', warning: 'failed' } })
  }) + '\n');

  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(session.report().stopping, false, 'playback continues despite hide warning');
  assert.equal(session.report().failure, null);

  await session.stop();
  assert.equal(session.state().cleanup.closed, true);
});


test('F1 regression: parent force-kill without worker proof aborts source close and retains ownership', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9999; child.exitCode = null; child.killed = false;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {}; // Never responds to stop
    child.kill = () => {
      child.killed = true; child.exitCode = 1;
      child.emit('exit', 1); child.emit('close', 1);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 20, childKillTimeoutMs: 20, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0, 'source window close MUST NOT be called when force-killed without worker proof');
  assert.equal(session.isClosed(), false);
});

test('F2 regression: safe Summary consumed after pending Status allows safe close and retry recovery', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  let testChild;
  const spawnChild = () => {
    testChild = new EventEmitter();
    testChild.pid = 9999; testChild.exitCode = null;
    testChild.stdin = new EventEmitter(); testChild.stdout = new EventEmitter(); testChild.stderr = new EventEmitter();
    testChild.stdin.end = () => {
      // Child emits final Summary on stop
      testChild.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'action-failed', cleanupSafe: true, warning: null } })
      }) + '\n');
      testChild.exitCode = 0;
      testChild.emit('exit', 0);
      testChild.emit('close', 0);
    };
    return testChild;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  // Emit pending Status while capture runs
  testChild.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'info', scope: 'Status',
    message: JSON.stringify({ record: { captureSource: 'window', frames: 100 }, taskbarHide: { stage: 'action-pending', cleanupSafe: false } })
  }) + '\n');
  assert.equal(session.report().native.taskbarHide.cleanupSafe, false);

  // Stop should consume the Summary with cleanupSafe = true and close safely
  const stopped = await session.stop();
  assert.equal(stopped.closed, true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.isClosed(), true);
});

test('F3 regression: both flat status and nested record trigger offscreen window tuck', async () => {
  for (const nested of [false, true]) {
    const { session, children, calls } = sessionHarness();
    await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' }, offscreenStart: false });
    const record = { captureSource: 'window', frames: 5, width: 1280, height: 720 };
    const payload = nested ? { record, taskbarHide: { stage: 'armed', cleanupSafe: true } } : record;
    children[0].child.stderr.emit('data', JSON.stringify({ kind: 'log', level: 'info', scope: 'Status', message: JSON.stringify(payload) }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(session.state().captureStarted, true, `captureStarted must be true for nested=${nested}`);
    assert.equal(calls.filter(c => c[0] === '--window-apply').length, 1, `window tuck must occur for nested=${nested}`);
    await session.stop();
  }
});

test('F2 regression: clean normal exit with no terminal proof blocks close and returns worker-unconfirmed', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9991; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      // Normal exit with code 0 but NO summary or taskbar proof
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  assert.equal(session.isClosed(), false);
});

test('F2 regression: delayed Summary arriving before close within budget allows safe close', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9992; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.exitCode = 0;
      child.emit('exit', 0);
      setTimeout(() => {
        child.stderr.emit('data', JSON.stringify({
          kind: 'log', level: 'info', scope: 'Summary',
          message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'action-failed', cleanupSafe: true } })
        }) + '\n');
        child.emit('close', 0);
      }, 20);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 100, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.isClosed(), true);
});

test('F2 regression: delayed Summary exceeding exit budget blocks close initially then succeeds on retry', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  let testChild;
  const spawnChild = () => {
    testChild = new EventEmitter();
    testChild.pid = 9993; testChild.exitCode = null;
    testChild.stdin = new EventEmitter(); testChild.stdout = new EventEmitter(); testChild.stderr = new EventEmitter();
    testChild.stdin.end = () => {
      testChild.exitCode = 0;
      testChild.emit('exit', 0);
      setTimeout(() => {
        testChild.stderr.emit('data', JSON.stringify({
          kind: 'log', level: 'info', scope: 'Summary',
          message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'action-failed', cleanupSafe: true } })
        }) + '\n');
        testChild.emit('close', 0);
      }, 40);
    };
    return testChild;
  };
  // childExitTimeoutMs: 15 < 40ms delay -> initial stop will time out on close
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 15, childKillTimeoutMs: 15, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  testChild.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'info', scope: 'Status',
    message: JSON.stringify({ record: { captureSource: 'window' }, taskbarHide: { stage: 'action-pending', cleanupSafe: false } })
  }) + '\n');
  const initialStop = await session.stop();
  assert.equal(initialStop.closed, false);
  assert.equal(initialStop.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);

  // Wait past delayed close
  await new Promise(resolve => setTimeout(resolve, 50));
  const retry = await session.stop();
  assert.equal(retry.closed, true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.isClosed(), true);
});

test('F2 regression: only periodic safe status without terminal summary proof blocks close', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  let testChild;
  const spawnChild = () => {
    testChild = new EventEmitter();
    testChild.pid = 9994; testChild.exitCode = null;
    testChild.stdin = new EventEmitter(); testChild.stdout = new EventEmitter(); testChild.stderr = new EventEmitter();
    testChild.stdin.end = () => {
      // Exits cleanly but emits NO terminal Summary
      testChild.exitCode = 0;
      testChild.emit('exit', 0);
      testChild.emit('close', 0);
    };
    return testChild;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  // Emit periodic Status with armed and cleanupSafe = true
  testChild.stderr.emit('data', JSON.stringify({
    kind: 'log', level: 'info', scope: 'Status',
    message: JSON.stringify({ record: { captureSource: 'window' }, taskbarHide: { stage: 'armed', cleanupSafe: true } })
  }) + '\n');
  const stopped = await session.stop();
  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
  assert.equal(session.isClosed(), false);
});

test('F2 regression: terminal summary with cleanupSafe false blocks close', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9995; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({ reason: 'parent-stop', taskbarHide: { stage: 'action-failed', cleanupSafe: false } })
      }) + '\n');
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
});

test('F2 regression: fallback WM_WALLPAPER_TASKBAR_HIDE=0 allows clean close without worker proof', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9996; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };
  const session = createPreviewSession({
    env: { WM_WALLPAPER_TASKBAR_HIDE: '0' },
    helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {}
  });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.isClosed(), true);
});

test('F2 regression: early stop with zero frames (stage observing, attempted false, cleanupSafe true) cleans up source window and closes session', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9997; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({
          reason: 'parent-stop',
          taskbarHide: { stage: 'observing', attempted: false, cleanupSafe: true, warning: null },
          windowClose: { closed: true }
        })
      }) + '\n');
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 1);
  assert.equal(session.isClosed(), true);
});

test('F2 regression: early stop with first frame under 10 seconds allows clean stop and subsequent start', async () => {
  const calls = [];
  let round = 0;
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555 + round, pid: 33272 + round, title: calls.findLast(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    round++;
    const child = new EventEmitter();
    child.pid = 9990 + round; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({
          reason: 'parent-stop',
          taskbarHide: { stage: round === 1 ? 'observing' : 'stopped-before-action', attempted: false, cleanupSafe: true, warning: null },
          windowClose: { closed: true }
        })
      }) + '\n');
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };

  // First session: early stop after first frame
  const session1 = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session1.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped1 = await session1.stop();
  assert.equal(stopped1.closed, true);
  assert.equal(session1.isClosed(), true);

  // Subsequent session on same helper harness creates and stops cleanly
  const session2 = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session2.create({ helper: HELPER, output: 'F:\\out2', scene: { scene: 'lucy' } });
  const stopped2 = await session2.stop();
  assert.equal(stopped2.closed, true);
  assert.equal(session2.isClosed(), true);
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 2);
});

test('F2 regression: attempted=true with non-settled stage observing is strictly rejected', async () => {
  const calls = [];
  const helperRun = async (_helper, args) => {
    calls.push(args);
    if (args[0] === '--we-open') return { opened: true };
    if (args[0] === '--window-find') return [{ hwnd: 555, pid: 33272, title: calls.find(c => c[0] === '--we-open')[1], visible: true }];
    if (args[0] === '--window-ensure-closed') return { outcome: 'closed', closed: true };
    throw new Error('unexpected ' + args[0]);
  };
  const spawnChild = () => {
    const child = new EventEmitter();
    child.pid = 9998; child.exitCode = null;
    child.stdin = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin.end = () => {
      child.stderr.emit('data', JSON.stringify({
        kind: 'log', level: 'info', scope: 'Summary',
        message: JSON.stringify({
          reason: 'parent-stop',
          taskbarHide: { stage: 'observing', attempted: true, cleanupSafe: true, warning: null }
        })
      }) + '\n');
      child.exitCode = 0;
      child.emit('exit', 0);
      child.emit('close', 0);
    };
    return child;
  };
  const session = createPreviewSession({ helperRun, spawnChild, childExitTimeoutMs: 50, sleep: async () => {} });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { scene: 'lucy' } });
  const stopped = await session.stop();
  assert.equal(stopped.closed, false);
  assert.equal(stopped.outcome, 'worker-unconfirmed');
  assert.equal(calls.filter(c => c[0] === '--window-ensure-closed').length, 0);
});
