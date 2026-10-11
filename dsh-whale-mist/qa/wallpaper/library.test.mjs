// Offline checks for the Host wallpaper library and for the two-layer selection resolution.
// No real WE, native helper, DSH connection or window is involved: every root is a temporary
// fixture and every session/helper is a stand-in.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rename, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallpaperLibrary, VERIFIED_SCENES } from '../../src/wallpaper/library.js';
import { scanWallpaperCatalog, publicCatalogItem, verifyCatalogEntry, isCatalogId } from '../../src/wallpaper/catalog.js';
import { registerWallpaperRoutes, createPreviewSession, sceneSelection, isSceneId } from '../../src/wallpaper/session.js';
import { SCENES } from '../../src/wallpaper/scenes.js';

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const cases = [];
let serial = 0;

async function checked(name, run) {
  await test(name, async () => {
    try { await run(); cases.push({ name, passed: true }); }
    catch (error) { cases.push({ name, passed: false, error: error.message }); throw error; }
  });
}

const base = await mkdtemp(join(tmpdir(), 'wm-library-'));
async function fixtureRoot() { const root = join(base, `library-${++serial}`); await mkdir(root, { recursive: true }); return root; }
async function project(root, name, data = { type: 'scene', title: 'Example', file: 'scene.pkg', preview: 'preview.jpg' }, files = ['scene.pkg', 'preview.jpg']) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'project.json'), JSON.stringify(data));
  for (const file of files) { await mkdir(join(dir, file, '..'), { recursive: true }); await writeFile(join(dir, file), 'fixture content'); }
  return dir;
}

/** A counting scan wrapper, so "how often did it scan" is an observed number. */
function countingScan(inner = scanWallpaperCatalog) {
  const state = { calls: 0, roots: [] };
  return { state, scan: async options => { state.calls += 1; state.roots.push([...options.roots]); return inner(options); } };
}

function harness({ roots, scan, verify, exists = path => path === HELPER || path === SCENES.lucy.project } = {}) {
  const routes = new Map();
  const disposers = [];
  const sessions = [];
  const ctx = {
    effect(callback) { const off = callback(); disposers.push(off); return off; },
    webServer: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path); } },
  };
  const library = createWallpaperLibrary({ roots, scan, verify, exists: () => true });
  const api = registerWallpaperRoutes(ctx, {
    helper: HELPER,
    logRoot: join(base, `runs-${++serial}`),
    exists,
    onWarn: () => {},
    library,
    sessionFactory: options => {
      const session = fakeSession(options);
      sessions.push(session);
      return session;
    },
  });
  return { routes, route: routes.get('/whale-wallpaper'), sessions, api, library, disposers };
}

function fakeSession() {
  let cleanup = null;
  const session = {
    calls: [],
    hub: { latest: null, closed: false },
    closed: false,
    created: false,
    scene: null,
    async create(options) { session.calls.push('create'); session.created = true; session.scene = options.scene; },
    async stop() { session.calls.push('stop'); session.hub.closed = true; cleanup = { outcome: 'closed', closed: true }; session.closed = true; return cleanup; },
    isClosed: () => session.closed,
    report: () => ({ window: { location: 'WhaleWallpaperProbe-library-test', created: session.created } }),
    state: () => ({ cleanup, config: session.scene ? { mode: session.scene.mode, sceneId: session.scene.sceneId } : null }),
    ending: () => false,
    setClientStatus: () => {},
  };
  return session;
}

async function call(route, method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
  const response = { status: 0, payload: null, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  await route.handler(req, response);
  return { status: response.status, body: response.payload ? JSON.parse(response.payload) : null };
}

// ---------------------------------------------------------------------------------------------

await checked('The list loads on demand, and a status poll never scans', async () => {
  const root = await fixtureRoot();
  await project(root, 'alpha', { type: 'scene', title: 'Alpha', file: 'scene.pkg', preview: 'preview.jpg' });
  await project(root, 'beta', { type: 'video', title: 'Beta', file: 'movie.mp4' }, ['movie.mp4']);
  const { state, scan } = countingScan();
  const { route } = harness({ roots: [root], scan });

  const first = await call(route, 'GET', '/whale-wallpaper/library');
  assert.equal(first.status, 200);
  assert.equal(state.calls, 0, 'reading the list must not scan');
  assert.equal(first.body.loaded, false);
  assert.deepEqual(first.body.items, [], 'nothing is invented before the first refresh');

  for (let index = 0; index < 3; index++) await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(state.calls, 0, 'status polling never scans');

  const refreshed = await call(route, 'POST', '/whale-wallpaper/library/refresh');
  assert.equal(refreshed.status, 200);
  assert.equal(state.calls, 1);
  assert.equal(refreshed.body.loaded, true);
  const byTitle = Object.fromEntries(refreshed.body.items.map(item => [item.title, item]));
  assert.equal(byTitle.Alpha.available, true);
  assert.equal(byTitle.Alpha.type, 'scene');
  assert.equal(byTitle.Alpha.playbackVerified, false, 'a scene is not verified just because its files are complete');
  assert.equal(byTitle.Beta.available, false);
  assert.equal(byTitle.Beta.reason, 'playback_type_not_supported');
  assert.equal(Object.hasOwn(byTitle.Alpha, 'project'), false, 'the public entry carries no path');
  assert.equal(JSON.stringify(refreshed.body).includes(root), false, 'no fixture root may leak into the payload');
});

await checked('Concurrent refreshes coalesce into one scan and never queue', async () => {
  const root = await fixtureRoot();
  await project(root, 'one');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const inner = scanWallpaperCatalog;
  const state = { calls: 0 };
  const scan = async options => { state.calls += 1; await gate; return inner(options); };
  const { route } = harness({ roots: [root], scan });
  const first = call(route, 'POST', '/whale-wallpaper/library/refresh');
  // The first request must really be inside the scan before the others arrive; otherwise this would
  // only prove that four calls in the same tick happen to be served by one walk.
  await new Promise(resolve => setImmediate(resolve));
  const others = [2, 3, 4].map(() => call(route, 'POST', '/whale-wallpaper/library/refresh'));
  release();
  const calls = [first, ...others];
  const results = await Promise.all(calls);
  assert.equal(state.calls, 1, 'four refreshes must not become four directory walks');
  assert.equal(results.every(result => result.status === 200), true);
  assert.equal(results.filter(result => result.body.joined === true).length, 3, 'the joined callers are told they joined');
});

await checked('A failing refresh reports itself and keeps the previous list usable', async () => {
  const root = await fixtureRoot();
  await project(root, 'keep');
  let fail = false;
  const inner = scanWallpaperCatalog;
  const { route } = harness({ roots: [root], scan: async options => { if (fail) throw new Error('fixture scan failure'); return inner(options); } });
  const good = await call(route, 'POST', '/whale-wallpaper/library/refresh');
  assert.equal(good.body.items.length, 1);
  fail = true;
  const bad = await call(route, 'POST', '/whale-wallpaper/library/refresh');
  assert.equal(bad.status, 502);
  assert.match(bad.body.error, /fixture scan failure/);
  assert.equal(bad.body.items.length, 1, 'the old snapshot is still listed');
  assert.equal(bad.body.loaded, true);
});

await checked('A missing approved root is reported, not shown as an empty library', async () => {
  const root = await fixtureRoot();
  const missing = join(root, 'absent');
  const { route } = harness({ roots: [missing], scan: scanWallpaperCatalog });
  const refreshed = await call(route, 'POST', '/whale-wallpaper/library/refresh');
  assert.equal(refreshed.body.items.length, 0);
  assert.equal(refreshed.body.rootsAvailable, 0);
  assert.equal(refreshed.body.rootWarnings.length, 1, 'the unusable root must be visible');
  assert.equal(refreshed.body.rootWarnings[0].reason, 'root_unavailable');
});

await checked('A catalogue id starts the real thing: the re-verified project reaches the session and the report', async () => {
  const root = await fixtureRoot();
  const dir = await project(root, '3521337568', { type: 'scene', title: 'Second', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions, api } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'POST', '/whale-wallpaper/library/refresh');
  const listed = await call(route, 'GET', '/whale-wallpaper/library');
  const item = listed.body.items.find(entry => entry.available);
  assert.ok(isCatalogId(item.id), `the list must publish a catalogue id, got ${item.id}`);

  const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: item.id, mode: 'preview' });
  assert.equal(started.status, 200, started.payload);
  assert.equal(sessions.length, 1);
  const scene = sessions[0].scene;
  assert.equal(scene.sceneId, item.id, 'the id survives the double resolution');
  assert.equal(scene.project, join(dir, 'project.json'), 'the session gets the re-verified project file, not a browser value');
  assert.equal(started.body.activeSceneId, item.id, 'the reported current scene is the one actually created');
  assert.equal(started.body.mode, 'preview');

  // The observation above is the session call; this proves the payload the UI sees agrees.
  const status = await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(status.body.activeSceneId, item.id);
  assert.equal(status.body.library.loaded, true);
  void api;
});

await checked('A forged id, a bad name and a private path never reach the helper', async () => {
  const root = await fixtureRoot();
  await project(root, 'real', { type: 'scene', title: 'Real', file: 'scene.pkg', preview: 'preview.jpg' });
  const calls = [];
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog, verify: async (item, options) => { calls.push(item.id); return verifyCatalogEntry(item, options); } });
  await call(route, 'POST', '/whale-wallpaper/library/refresh');

  for (const bad of [
    { scene: 'we-ffffffffffffffffffffffff' },
    { scene: '__proto__' },
    { scene: 'constructor' },
    { scene: '../../etc/passwd' },
    { scene: 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960' },
  ]) {
    const response = await call(route, 'POST', '/whale-wallpaper/start', bad);
    assert.equal(response.status, 409, `must refuse ${JSON.stringify(bad)}: ${response.payload}`);
    assert.ok(response.body.error, 'a refusal always states a reason');
    assert.doesNotMatch(String(response.body.error), /project\.json|scene\.pkg/, 'the refusal must not echo a private path');
  }
  assert.equal(sessions.length, 0, 'no run may be built for a refused selection');
  assert.equal(calls.length, 0, 'a forged id must not even reach the verification step');
  // An absent scene is still the migration default, and it is the sample, not a path from the body.
  const defaulted = await call(route, 'POST', '/whale-wallpaper/start', {});
  assert.equal(defaulted.status, 200);
  assert.equal(sessions[0].scene.sceneId, 'lucy');
  assert.equal(sessions[0].scene.project, SCENES.lucy.project);
});

await checked('A selection is re-verified before every start: deletion, type change and junction are refused', async () => {
  const root = await fixtureRoot();
  const outside = await fixtureRoot();
  const dir = await project(root, 'target', { type: 'scene', title: 'Target', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'POST', '/whale-wallpaper/library/refresh');
  const listed = await call(route, 'GET', '/whale-wallpaper/library');
  const id = listed.body.items.find(entry => entry.available).id;

  // 1. The content disappears after the snapshot was taken.
  await rm(join(dir, 'scene.pkg'));
  const deleted = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  assert.equal(deleted.status, 409);
  assert.match(deleted.body.error, /not playable|missing_content/);
  assert.equal(sessions.length, 0);

  // 2. The type changed.
  await writeFile(join(dir, 'scene.pkg'), 'restored');
  await writeFile(join(dir, 'project.json'), JSON.stringify({ type: 'video', title: 'Target', file: 'scene.pkg' }));
  const retyped = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  assert.equal(retyped.status, 409);
  assert.match(retyped.body.error, /playback_type_not_supported|type_changed/);
  assert.equal(sessions.length, 0, 'a changed type must not start a run');

  // 3. The project directory is moved aside and replaced by a junction at the same path, so the
  // snapshot's remembered path now resolves through a link that was not there when it was scanned.
  await writeFile(join(dir, 'project.json'), JSON.stringify({ type: 'scene', title: 'Target', file: 'scene.pkg', preview: 'preview.jpg' }));
  const elsewhere = await project(outside, 'elsewhere', { type: 'scene', title: 'Target', file: 'scene.pkg', preview: 'preview.jpg' });
  const moved = join(root, 'moved-away');
  await rename(dir, moved);
  await symlink(elsewhere, dir, 'junction');
  const junction = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  assert.equal(junction.status, 409, 'the swapped project must not be playable');
  assert.match(junction.body.error, /link_refused|not playable|missing_content/);
  assert.equal(sessions.length, 0);
});

await checked('The verified sample keeps its own path and never depends on the library', async () => {
  const root = await fixtureRoot();
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  assert.equal(started.status, 200, started.payload);
  assert.equal(sessions[0].scene.sceneId, 'lucy');
  assert.equal(sessions[0].scene.project, SCENES.lucy.project, 'the sample resolves from the whitelist, not from a scan');
  assert.equal(VERIFIED_SCENES.lucy.playbackVerified, true);
});

await checked('The route hands the session an id and a verified project, never a caller path', async () => {
  const root = await fixtureRoot();
  await project(root, 'item', { type: 'scene', title: 'Item', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'POST', '/whale-wallpaper/library/refresh');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: id, project: 'C:\\evil.exe', entry: 'C:\\evil.exe', helper: 'C:\\evil.exe', window: 999, seconds: 60 });
  const scene = sessions[0].scene;
  assert.deepEqual(Object.keys(scene).sort(), ['mode', 'project', 'sceneId', 'seconds'], 'only these fields describe the run');
  assert.equal(JSON.stringify(scene).includes('evil'), false, 'a caller-supplied path must not survive');
});

await checked('Stopping during re-verification prevents the run from being created', async () => {
  const root = await fixtureRoot();
  await project(root, 'slow', { type: 'scene', title: 'Slow', file: 'scene.pkg', preview: 'preview.jpg' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { route, sessions } = harness({
    roots: [root], scan: scanWallpaperCatalog,
    verify: async (item, options) => { await gate; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'POST', '/whale-wallpaper/library/refresh');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  const starting = call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  await new Promise(resolve => setImmediate(resolve));
  const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(stopped.status, 200, stopped.payload);
  release();
  const outcome = await starting;
  // A late, finished verification must not open a source: the run is refused and nothing was built.
  assert.equal(sessions.length, 0, 'a stopped start creates no session');
  assert.notEqual(outcome.status, 200, 'the late start does not report success');
});

await checked('The scene id syntax is a shape, not a lookup, and only the Host resolves it', async () => {
  assert.equal(isSceneId('lucy'), true);
  assert.equal(isSceneId(`we-${'a'.repeat(24)}`), true);
  assert.equal(isSceneId(`we-${'A'.repeat(24)}`), false, 'uppercase hex is not the published shape');
  assert.equal(isSceneId('we-abc'), false);
  assert.equal(isSceneId('__proto__'), false);
  assert.equal(isSceneId(7), false);
  assert.deepEqual(sceneSelection({}), { sceneId: 'lucy', mode: undefined });
  assert.throws(() => sceneSelection({ scene: 'nope' }), /unknown scene/, 'an invalid selection is refused, not replaced by the sample');
});

await checked('A session without a Host library still resolves the sample and refuses an id', async () => {
  // The helper is injected as a stand-in: this check never spawns a real process. It has to answer
  // for this round's own generated window name, which is only known once --we-open was called.
  let location = null;
  const session = createPreviewSession({
    exists: path => path === SCENES.lucy.project,
    spawnChild: () => ({ pid: 4242, stdin: { end() {}, on() {} }, stdout: { on() {}, off() {} }, stderr: { on() {}, off() {} }, on() {}, off() {}, exitCode: null, kill() {} }),
    helperRun: async (helper, args) => {
      if (args[0] === '--we-open') { location = args[1]; return { window: 1 }; }
      if (args[0] === '--window-find') return location ? [{ hwnd: 5150, pid: 4242, title: location, visible: true, left: 0, top: 0 }] : [];
      return { closed: true, outcome: 'closed' };
    },
  });
  const started = await session.create({ helper: HELPER, output: join(base, 'run-plain'), scene: { scene: 'lucy', mode: 'preview' } }).catch(error => error);
  assert.equal(started instanceof Error, false, `the sample must start: ${started?.message}`);
  assert.equal(session.state().config.sceneId, 'lucy');
  await session.stop();
  const refused = await createPreviewSession({ exists: () => true, spawnChild: () => { throw new Error('the helper must never be spawned for an id without a library'); } })
    .create({ helper: HELPER, output: join(base, 'run-again'), scene: { scene: `we-${'b'.repeat(24)}` } })
    .catch(error => error);
  assert.match(String(refused?.message), /unknown scene/, 'an id without a Host library is refused, not resolved');
});

await checked('Opening the area loads the list: the first read scans once, later reads and polls do not', async () => {
  const root = await fixtureRoot();
  await project(root, 'alpha', { type: 'scene', title: 'Alpha', file: 'scene.pkg', preview: 'preview.jpg' });
  const { state, scan } = countingScan();
  const { route } = harness({ roots: [root], scan });

  // This is what the settings panel does on its first mount: ask for a list, not for a cache peek.
  const first = await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  assert.equal(first.status, 200, first.payload);
  assert.equal(state.calls, 1, 'the first open must really scan');
  assert.equal(first.body.loaded, true, 'the answer must not be an unloaded empty cache');
  assert.equal(first.body.items.length, 1, 'the existing wallpaper is in the first answer');
  assert.equal(first.body.ensureScan, true, 'this caller performed the scan');

  // Reopening the area, and any polling, must not walk the library again.
  const reopened = await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  assert.equal(state.calls, 1, 'reopening with a snapshot present is a cached read');
  assert.equal(reopened.body.loaded, true);
  assert.equal(reopened.body.ensureScan, false);
  for (let index = 0; index < 3; index++) await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(state.calls, 1, 'status polling still never scans');
  // A plain read (no ensure) is also a cached read.
  await call(route, 'GET', '/whale-wallpaper/library');
  assert.equal(state.calls, 1, 'a plain list read never scans');
  // Only the explicit refresh asks for a new scan.
  await call(route, 'POST', '/whale-wallpaper/library/refresh');
  assert.equal(state.calls, 2, 'the refresh control is what rescans');
});

await checked('A selection accepted while the sample is missing: the other wallpaper still starts', async () => {
  const root = await fixtureRoot();
  await project(root, 'second', { type: 'scene', title: 'Second', file: 'scene.pkg', preview: 'preview.jpg' });
  // The sample's own file is gone; the machine and the helper are fine.
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog, exists: path => path === HELPER });
  const listed = await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const item = listed.body.items.find(entry => entry.available);
  assert.ok(item, 'the complete second scene must be listed as available');
  const status = await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(status.body.available, true, 'a complete library scene keeps the service available');
  assert.deepEqual(status.body.missingScenes, ['lucy'], 'the missing sample is reported as its own fact');
  const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: item.id, mode: 'preview' });
  assert.equal(started.status, 200, started.payload);
  assert.equal(sessions.length, 1, 'the second wallpaper starts');
  assert.equal(sessions[0].scene.sceneId, item.id);
});

await checked('A missing sample does not hide a broken selection, and the sample still fails on its own file', async () => {
  const root = await fixtureRoot();
  await project(root, 'second', { type: 'scene', title: 'Second', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog, exists: path => path === HELPER });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  // The library scene is deleted after the snapshot: it must be refused, not silently replaced.
  await rm(join(root, 'second', 'scene.pkg'));
  const refused = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  assert.equal(refused.status, 409, refused.payload);
  assert.equal(sessions.length, 0, 'the deleted scene must not start');
  // The sample is missing too, and that is its own refusal with its own message.
  const sample = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
  assert.equal(sample.status, 409, sample.payload);
  assert.match(String(sample.body.error), /missing|unavailable|scene/i);
  assert.equal(sessions.length, 0);
});

await checked('A restart with an unusable next selection keeps the current picture playing', async () => {
  const root = await fixtureRoot();
  await project(root, 'target', { type: 'scene', title: 'Target', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;

  // A run is playing: the sample is the one with a real file in this harness.
  const playing = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  assert.equal(playing.status, 200, playing.payload);
  assert.equal(sessions.length, 1);

  // The next selection becomes unusable before the user presses restart.
  await rm(join(root, 'target', 'scene.pkg'));
  const refused = await call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  assert.equal(refused.status, 409, refused.payload);
  assert.equal(sessions.length, 1, 'no new run may be created from an unusable selection');
  assert.equal(sessions[0].calls.includes('stop'), false, 'the working picture must not be closed first');
  assert.equal(sessions[0].isClosed(), false, 'the old source is still alive');
  // The stop route still works on the run that was kept.
  const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(stopped.status, 200, stopped.payload);
  assert.equal(sessions[0].isClosed(), true);
});

await checked('A restart with a usable selection does switch, and closes the old run only after verifying', async () => {
  const root = await fixtureRoot();
  await project(root, 'target', { type: 'scene', title: 'Target', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  const restarted = await call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  assert.equal(restarted.status, 200, restarted.payload);
  assert.equal(sessions.length, 2, 'a restart builds a new run');
  assert.equal(sessions[0].isClosed(), true, 'the old run was closed');
  assert.equal(sessions[1].scene.sceneId, id, 'the new run uses the verified selection');
  assert.equal(restarted.body.activeSceneId, id, 'the reported current scene is the new one');
});

await checked('A selection whose declaration turns unsafe is refused even with a scene.pkg present', async () => {
  const root = await fixtureRoot();
  const dir = await project(root, 'unsafe-later', { type: 'scene', title: 'Unsafe later', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;

  for (const file of ['../outside.scene', 'C:\\outside.scene', 'scene.pkg:secret']) {
    await writeFile(join(dir, 'project.json'), JSON.stringify({ type: 'scene', title: 'Unsafe later', file, preview: 'preview.jpg' }));
    const refused = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
    assert.equal(refused.status, 409, `declaration ${file} must be refused: ${refused.payload}`);
    assert.match(String(refused.body.error), /unsafe_path|not playable|link_refused/);
    assert.equal(sessions.length, 0, `declaration ${file} must not start a run`);
  }

  // A legitimately parsed declaration whose file is gone still uses the shipped package.
  await writeFile(join(dir, 'project.json'), JSON.stringify({ type: 'scene', title: 'Unsafe later', file: 'scene.json', preview: 'preview.jpg' }));
  const fallback = await call(route, 'POST', '/whale-wallpaper/start', { scene: id });
  assert.equal(fallback.status, 200, fallback.payload);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].scene.project, join(dir, 'project.json'));
});

await checked('A record the scan marked unavailable is not upgraded by a later scene.pkg', async () => {
  const root = await fixtureRoot();
  const dir = await project(root, 'bad-preview', { type: 'scene', title: 'Bad preview', file: 'scene.pkg', preview: '../secret.png' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  const listed = await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const item = listed.body.items[0];
  assert.equal(item.available, false, 'the scan refused this record');
  assert.equal(item.reason, 'unsafe_preview');
  // The package exists, so a re-verification must not turn the record into a startable one.
  assert.equal(existsSync(join(dir, 'scene.pkg')), true, 'the fixture really has a package');
  const refused = await call(route, 'POST', '/whale-wallpaper/start', { scene: item.id });
  assert.equal(refused.status, 409, `an unavailable record must stay unavailable: ${refused.payload}`);
  assert.equal(sessions.length, 0);
});

await checked('R1: a stop during a slow restart verification cancels the restart', async () => {
  const root = await fixtureRoot();
  await project(root, 'slow', { type: 'scene', title: 'Slow', file: 'scene.pkg', preview: 'preview.jpg' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let verifying = 0;
  const { route, sessions, api } = harness({
    roots: [root], scan: scanWallpaperCatalog,
    verify: async (item, options) => { verifying += 1; await gate; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  assert.equal(sessions.length, 1);

  const restarting = call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(verifying, 1, 'the restart must be inside its verification');
  // While the verification is waiting, the user stops. The stop must succeed immediately.
  const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(stopped.status, 200, stopped.payload);
  release();
  const late = await restarting;
  assert.notEqual(late.status, 200, `a cancelled restart must not report success: ${late.payload}`);
  assert.equal(sessions.length, 1, 'the cancelled restart must not create a new run');
  const status = await call(route, 'GET', '/whale-wallpaper/status');
  assert.equal(status.body.active, false, 'nothing may be playing after the stop');
  assert.equal(api.ownership(), null, 'the cancelled restart must release its ownership');
});

await checked('R1: unloading during a slow restart verification cancels the restart', async () => {
  const root = await fixtureRoot();
  await project(root, 'slow', { type: 'scene', title: 'Slow', file: 'scene.pkg', preview: 'preview.jpg' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { route, sessions, disposers } = harness({
    roots: [root], scan: scanWallpaperCatalog,
    verify: async (item, options) => { await gate; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  const restarting = call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  await new Promise(resolve => setImmediate(resolve));
  // Unloading the plugin while the verification is still waiting; the disposer must finish.
  await Promise.all(disposers.map(dispose => dispose()));
  release();
  const late = await restarting;
  assert.notEqual(late.status, 200, `a restart cancelled by unload must not report success: ${late.payload}`);
  assert.equal(sessions.length, 1, 'the unload must not be followed by a new run');
});

await checked('R1: a stop during the body read of a restart cancels it too', async () => {
  const root = await fixtureRoot();
  await project(root, 'later', { type: 'scene', title: 'Later', file: 'scene.pkg', preview: 'preview.jpg' });
  const { route, sessions } = harness({ roots: [root], scan: scanWallpaperCatalog });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });

  // A restart whose body arrives only after the user stopped: the token was taken first, so the
  // cancellation wins.
  let releaseBody;
  const bodyGate = new Promise(resolve => { releaseBody = resolve; });
  const chunks = [Buffer.from(JSON.stringify({ scene: id, mode: 'daily' }))];
  const req = { method: 'POST', url: '/whale-wallpaper/restart', async *[Symbol.asyncIterator]() { await bodyGate; for (const chunk of chunks) yield chunk; } };
  const response = { status: 0, payload: null, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  const restarting = route.handler(req, response);
  await new Promise(resolve => setImmediate(resolve));
  const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
  assert.equal(stopped.status, 200, stopped.payload);
  releaseBody();
  await restarting;
  assert.notEqual(response.status, 200, 'the late body must not revive the cancelled restart');
  assert.equal(sessions.length, 1, 'no run may be created from the cancelled restart');
});

await checked('R1: two restarts cannot overlap, and a verified restart still completes', async () => {
  const root = await fixtureRoot();
  await project(root, 'two', { type: 'scene', title: 'Two', file: 'scene.pkg', preview: 'preview.jpg' });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let verifyCalls = 0;
  const { route, sessions } = harness({
    roots: [root], scan: scanWallpaperCatalog,
    verify: async (item, options) => { verifyCalls += 1; if (verifyCalls === 1) await gate; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  const first = call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  await new Promise(resolve => setImmediate(resolve));
  // A second switch while the first is still verifying must be refused, not queued.
  const second = await call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  assert.equal(second.status, 409, `a concurrent switch must be refused: ${second.payload}`);
  release();
  const completed = await first;
  assert.equal(completed.status, 200, `the verified restart must still complete: ${completed.payload}`);
  assert.equal(sessions.length, 2, 'exactly one new run was created');
  assert.equal(sessions[0].isClosed(), true, 'the old run was closed by the restart');
  assert.equal(sessions[1].scene.sceneId, id);
  assert.equal(verifyCalls, 1, 'the restart verifies the next item exactly once and the start path reuses that result');
});

/**
 * The strictest harness: the routes use the REAL createPreviewSession, so the only stand-in is the
 * helper command runner. Nothing here spawns a process, and every helper argv that would carry a path
 * is recorded, which is what makes "no leak into the start parameters" an observation instead of an
 * assertion about a status code.
 */
function realSessionHarness({ roots, exists, verify } = {}) {
  const routes = new Map();
  const disposers = [];
  const helperCalls = [];
  let openedWindow = null;
  const ctx = {
    effect(callback) { const off = callback(); disposers.push(off); return off; },
    webServer: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path); } },
  };
  const library = createWallpaperLibrary({ roots, scan: scanWallpaperCatalog, verify, exists: () => true });
  const api = registerWallpaperRoutes(ctx, {
    helper: HELPER,
    logRoot: join(base, `real-runs-${++serial}`),
    exists,
    onWarn: () => {},
    library,
    // The real session, with only its process boundaries replaced.
    sessionFactory: options => createPreviewSession({
      ...options,
      spawnChild: () => ({
        pid: 7000 + helperCalls.length,
        stdin: { end() {}, on() {} },
        stdout: { on() {}, off() {} },
        stderr: { on() {}, off() {} },
        on() {}, off() {}, exitCode: null, kill() {},
      }),
      helperRun: async (helper, args) => {
        helperCalls.push([...args]);
        if (args[0] === '--we-open') { openedWindow = args[1]; return { window: 1 }; }
        if (args[0] === '--window-find') return openedWindow ? [{ hwnd: 9001, pid: 9001, title: openedWindow, visible: true, left: 0, top: 0 }] : [];
        return { closed: true, outcome: 'closed' };
      },
    }),
  });
  return { route: routes.get('/whale-wallpaper'), helperCalls, api, library, disposers };
}

/** Every argv that would hand a path to the helper. */
const openCalls = helperCalls => helperCalls.filter(args => args[0] === '--we-open');
const captureCalls = helperCalls => helperCalls.filter(args => args[0] === '--we-capture' || args.includes('pipe'));

await checked('R3: a forged resolveFrom in the request body cannot skip the id verification', async () => {
  const root = await fixtureRoot();
  const real = await project(root, 'real', { type: 'scene', title: 'Real', file: 'scene.pkg', preview: 'preview.jpg' });
  const forgedProject = join(root, 'not-registered', 'project.json');
  let verifyCalls = 0;
  const { route, helperCalls } = realSessionHarness({
    roots: [root],
    exists: path => path === HELPER || path === SCENES.lucy.project,
    verify: async (item, options) => { verifyCalls += 1; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const registeredId = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;

  // 1. An unregistered id with a forged "already verified" shape: refused, and the forged path never
  //    reaches a helper command line.
  const unknown = await call(route, 'POST', '/whale-wallpaper/start', {
    scene: `we-${'f'.repeat(24)}`,
    resolveFrom: { sceneId: `we-${'f'.repeat(24)}`, project: forgedProject, mode: 'daily' },
  });
  assert.equal(unknown.status, 409, `an unregistered id plus a forged result must be refused: ${unknown.payload}`);
  assert.equal(verifyCalls, 0, 'an id that is not in the snapshot never reaches the verifier, and the forged field changes nothing');
  assert.equal(openCalls(helperCalls).length, 0, 'no window may be opened from a forged selection');
  assert.equal(helperCalls.length, 0, 'no helper command at all may run for a refused selection');
  assert.equal(JSON.stringify(helperCalls).includes('not-registered'), false, 'the forged path must not appear in any argv');

  // 2. A REGISTERED id plus a forged project: the Host's own resolution wins, the forged path is not
  //    used, and the run is described by the re-verified record.
  const forged = await call(route, 'POST', '/whale-wallpaper/start', {
    scene: registeredId,
    resolveFrom: { sceneId: registeredId, project: forgedProject, mode: 'daily' },
  });
  // The run's own window/child lifecycle may legitimately fail in this stand-in; what matters is that
  // the argv the Host produced names the approved project and never the forged one.
  const args = JSON.stringify(openCalls(helperCalls));
  assert.equal(args.includes('not-registered'), false, `the forged project must never reach --we-open: ${args}`);
  assert.equal(args.includes('real'), true, `the approved project must be the one opened: ${args}`);
  assert.equal(verifyCalls, 1, 'the registered id is verified by the Host exactly once, from its own snapshot');
  void forged;

  // 3. The extra fields are dropped, not stored: a caller-supplied window name or helper cannot
  //    become part of this run either.
  const extra = await call(route, 'POST', '/whale-wallpaper/start', { scene: registeredId, location: 'WhaleWallpaperProbe-someone-else', helper: 'C:\\evil.exe' });
  void extra;
  const locationArgs = helperCalls.filter(entry => entry[0] === '--we-open').map(entry => entry[1]);
  assert.equal(locationArgs.every(value => typeof value === 'string' && value.startsWith('WhaleWallpaperProbe-')), true, 'only this round\'s generated window name is used');
  assert.equal(locationArgs.includes('WhaleWallpaperProbe-someone-else'), false, 'a caller-supplied window name is ignored');
  assert.equal(JSON.stringify(helperCalls).includes('evil.exe'), false, 'a caller-supplied helper path never appears');
});

await checked('R3: a normal restart still verifies once and reuses that result', async () => {
  const root = await fixtureRoot();
  await project(root, 'next', { type: 'scene', title: 'Next', file: 'scene.pkg', preview: 'preview.jpg' });
  let verifyCalls = 0;
  const { route, helperCalls } = realSessionHarness({
    roots: [root],
    exists: path => path === HELPER || path === SCENES.lucy.project,
    verify: async (item, options) => { verifyCalls += 1; return verifyCatalogEntry(item, options); },
  });
  await call(route, 'GET', '/whale-wallpaper/library?ensure=1');
  const id = (await call(route, 'GET', '/whale-wallpaper/library')).body.items.find(entry => entry.available).id;
  await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'daily' });
  const opened = openCalls(helperCalls).length;
  const restarted = await call(route, 'POST', '/whale-wallpaper/restart', { scene: id, mode: 'daily' });
  // The restart itself may report a failure from the stand-in lifecycle; the point is the Host
  // verification count and that a new run really tried to open the approved project.
  assert.equal(verifyCalls, 1, `the restart must verify the next item exactly once, got ${verifyCalls}`);
  const after = openCalls(helperCalls).slice(opened).map(entry => entry[2]);
  assert.equal(after.every(value => String(value).includes('next')), true, `the restarted run opens the approved project: ${JSON.stringify(after)}`);
  assert.notEqual(restarted.status, 0, 'the route answers');
});

after(async () => {
  await writeFile(join(base, 'library-checks.json'), JSON.stringify({ cases, evidence: base, cleanup: 'Fixtures are intentionally retained; no deletion' }, null, 2));
  console.log('Library fixture evidence:', base);
});
