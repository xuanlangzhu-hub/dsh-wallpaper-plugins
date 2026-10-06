import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewSession, registerWallpaperRoutes, pruneRuns, prepareRunDirectory, resolveHostResources, probeAvailability } from '../../src/wallpaper/session.js';
import { resolveSceneRequest, describeScenes, SCENES, PREVIEW_SECONDS } from '../../src/wallpaper/scenes.js';

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const SCENE_FILE = SCENES.lucy.project;
const exists = path => path === HELPER || path === SCENE_FILE;

function fakeChild(onSpawn) {
  const child = new EventEmitter();
  child.pid = 4242; child.exitCode = null; child.killed = false;
  child.stdin = new EventEmitter(); child.stdin.end = () => { child.exitCode = 0; };
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.kill = () => { child.killed = true; child.exitCode = 1; };
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
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  const opened = calls.find(args => args[0] === '--we-open');
  assert.ok(opened, 'the helper must create the window');
  assert.match(opened[1], /^WhaleWallpaperProbe-\d{12}-[0-9a-f]{4}$/, 'the window name is round unique');
  assert.equal(opened[2], SCENE_FILE, 'only the whitelisted project can be opened');
  assert.equal(children.length, 1);
  assert.deepEqual(children[0].args.slice(4), ['pipe', '--owned-location', opened[1]]);
  assert.equal(session.state().captureStarted, false);
  await session.stop();
});

test('the window is tucked away only after frames provably come from it', async () => {
  const { session, calls, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
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
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  status(children[0].child, { frames: 4, captureSource: 'monitor' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(args => args[0] === '--window-apply').length, 0);
  await session.stop();
});

test('stop is idempotent and closes exactly this run once', async () => {
  const { session, calls } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
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
  const creating = session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
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
  const creating = session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  release();
  await new Promise(resolve => setTimeout(resolve, 5));
  windowVisible = true;
  await assert.rejects(() => creating, /Window setup failed/);
  assert.equal(calls.filter(args => args[0] === '--window-ensure-closed').length, 1, 'the late window must be closed');
  assert.equal(session.report().failure.startsWith('Window setup failed'), true);
});

test('a capture error stops the run and reports the reason', async () => {
  const { session, children } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  children[0].child.stderr.emit('data', `${JSON.stringify({ kind: 'log', level: 'error', scope: 'Probe', message: 'InvalidOperationException', detail: 'this window cannot be captured' })}\n`);
  await session.stop();
  assert.match(session.report().failure, /this window cannot be captured/);
});

test('a close reported as unfinished is a recorded failure, never a silent success', async () => {
  const { session } = sessionHarness({ closeResult: { outcome: 'timeout', closed: false, error: 'still there' } });
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  await session.stop();
  assert.equal(session.state().cleanup.outcome, 'timeout');
  assert.match(session.report().failure, /Window cleanup incomplete \(timeout\)/);
});

test('a session instance refuses a second run', async () => {
  const { session } = sessionHarness();
  await session.create({ helper: HELPER, output: 'F:\\out', scene: { sceneId: 'lucy' } });
  await assert.rejects(() => session.create({ helper: HELPER, output: 'F:\\out2', scene: { sceneId: 'lucy' } }), /already started a run/);
  await session.stop();
  await assert.rejects(() => session.create({ helper: HELPER, output: 'F:\\out3', scene: { sceneId: 'lucy' } }), /already (started a run|ended)/);
});

test('scene payloads are constrained to the whitelist', () => {
  const request = resolveSceneRequest({ scene: 'lucy', seconds: 999 }, { exists });
  assert.equal(request.project, SCENE_FILE);
  assert.equal(request.seconds, PREVIEW_SECONDS.max, 'the preview limit is enforced host side');
  assert.equal(request.width, 1280);
  assert.equal(resolveSceneRequest({}, { exists }).sceneId, 'lucy', 'the default scene is Lucy');
  assert.throws(() => resolveSceneRequest({ scene: '../../etc/passwd' }, { exists }), /unknown scene/);
  assert.throws(() => resolveSceneRequest({ scene: 'lucy' }, { exists: () => false }), /scene file is missing/);
  assert.equal(describeScenes({ exists }).find(scene => scene.id === 'lucy').available, true);
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

function routeHarness({ sessions = [] } = {}) {
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
  const api = registerWallpaperRoutes(ctx, { helper: HELPER, logRoot: 'F:\\logs', sessionFactory: factory, exists });
  return { ctx, routes, api, sessions, registered };
}

async function call(route, method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
  const response = { status: 0, payload: null, headers: {}, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  await route.handler(req, response);
  return response;
}

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
  registerWallpaperRoutes(ctx, { helper: 'C:\\missing.exe', logRoot: 'F:\\logs', sessionFactory: () => sessionHarness().session, exists });
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
  registerWallpaperRoutes(ctx, { helper: HELPER, logRoot: 'F:\\logs',
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
    await session.create({ helper: HELPER, output, scene: { sceneId: 'lucy' } });
    await session.stop();
    const files = await readdir(output);
    assert.deepEqual(files.sort(), ['preview-final.json']);
    await writeFile(join(output, 'frames.jsonl'), '');
    const pruned = await pruneRuns(root, 1);
    assert.deepEqual(pruned, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
