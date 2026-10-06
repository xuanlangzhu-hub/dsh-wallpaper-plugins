import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as realModules from '../../src/wallpaper/session.js';
import { registerWallpaperRoutes } from '../../src/wallpaper/session.js';
import { SCENES } from '../../src/wallpaper/scenes.js';

const HELPER = 'F:\\fake\\WallpaperProbe.exe';
const exists = path => path === HELPER || path === SCENES.lucy.project;

/** A controllable stand-in for one preview run. */
function fakeSession({ closeResult = { outcome: 'closed', closed: true }, createDelay = null, closeDelay = null, onStop = null } = {}) {
  // `cleanup` mirrors the real session: it stays null until a close has actually produced a
  // result, which is also the signal that releasing the run is safe.
  let cleanup = null;
  const session = {
    calls: [],
    hub: { latest: null, closed: false },
    closed: false,
    created: false,
    createStarted: false,
    async create() {
      session.createStarted = true;
      session.calls.push('create');
      if (createDelay) await createDelay();
      session.created = true;
    },
    async stop() {
      session.calls.push('stop');
      if (session.closed) return cleanup;
      if (closeDelay) await closeDelay();
      session.hub.closed = true;
      cleanup = closeResult;
      if (onStop) {
        // Lets a test vary what the next attempt answers, like a helper that recovers.
        const override = onStop();
        if (override) cleanup = override;
      }
      session.closed = cleanup.closed === true;
      return cleanup;
    },
    isClosed: () => session.closed,
    report: () => ({ window: { location: 'WhaleWallpaperProbe-route-test', created: session.created }, failure: cleanup?.closed === true ? null : 'Window cleanup incomplete (timeout)' }),
    state: () => ({ cleanup }),
    ending: () => false,
    setClientStatus: () => {},
  };
  return session;
}

function routeHarness(options = {}) {
  const sessions = [];
  const routes = new Map();
  const disposers = [];
  let logRoot = options.logRoot;
  const ctx = {
    effect(callback) { const off = callback(); disposers.push(off); return off; },
    webServer: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path); } },
  };
  const api = registerWallpaperRoutes(ctx, {
    helper: HELPER,
    logRoot,
    exists,
    onWarn: () => {},
    sessionFactory: () => {
      const session = fakeSession(options.nextSession?.(sessions.length) ?? options);
      sessions.push(session);
      return session;
    },
  });
  return { routes, disposers, sessions, api, route: routes.get('/whale-wallpaper') };
}

async function call(route, method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = { method, url: path, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
  const response = { status: 0, payload: null, headers: {}, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  await route.handler(req, response);
  return { status: response.status, body: response.payload ? JSON.parse(response.payload) : null };
}

/** A request whose body is released by the test, so route timing can be controlled. */
function gatedCall(route, method, path, body, gate) {
  const chunks = [Buffer.from(JSON.stringify(body))];
  const req = {
    method, url: path,
    async *[Symbol.asyncIterator]() { await gate.promise; for (const chunk of chunks) yield chunk; },
  };
  const response = { status: 0, payload: null, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
  return route.handler(req, response).then(() => ({ status: response.status, body: response.payload ? JSON.parse(response.payload) : null }));
}

function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

const ticks = async (count = 20) => { for (let index = 0; index < count; index++) await Promise.resolve(); };

async function withLogRoot(run) {
  const root = await mkdtemp(join(tmpdir(), 'wm-route-'));
  try { return await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('two concurrent starts create exactly one run', async () => {
  await withLogRoot(async logRoot => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { route, sessions } = routeHarness({ logRoot, nextSession: () => ({ createDelay: () => gate }) });
    const first = call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    await new Promise(resolve => setImmediate(resolve));
    const second = call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    release();
    const results = await Promise.all([first, second]);
    assert.equal(sessions.length, 1, 'only one run may be built');
    assert.equal(results.filter(result => result.status === 200).length >= 1, true, 'at least one caller gets the run');
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.active, true);
    await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(sessions[0].closed, true);
  });
});

test('a stop during preparation prevents the run from being created', async () => {
  await withLogRoot(async logRoot => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { route, sessions } = routeHarness({ logRoot, nextSession: () => ({ createDelay: () => gate }) });
    const starting = call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    await new Promise(resolve => setImmediate(resolve));
    // The stop answers immediately even though the start is still preparing.
    const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
    assert.equal(stopped.body.active, false);
    release();
    const started = await starting;
    assert.equal(started.status, 409, 'the invalidated start must not report success');
    assert.equal(sessions.length, 0, 'an invalidated start must not build a run at all');
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.active, false);
    assert.equal(status.body.session, null);
    assert.equal(status.body.failed, false, 'no run means nothing to fail about');
  });
});

test('a start during cleanup waits and cannot overlap the closing window', async () => {
  await withLogRoot(async logRoot => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { route, sessions } = routeHarness({ logRoot, nextSession: index => (index === 0 ? { closeDelay: () => gate } : {}) });
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    const stopping = call(route, 'POST', '/whale-wallpaper/stop');
    await new Promise(resolve => setImmediate(resolve));
    const starting = call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sessions[0].closed, false, 'the first run is still closing');
    assert.equal(sessions.length <= 2, true, 'no third instance may appear');
    release();
    await stopping;
    const started = await starting;
    assert.equal(sessions[0].closed, true, 'the first window closed before the next run');
    assert.equal(started.status === 200 || started.status === 409, true);
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    if (started.status === 200) assert.equal(status.body.active, true);
    await call(route, 'POST', '/whale-wallpaper/stop');
    for (const session of sessions) assert.equal(session.closed, true);
  });
});

test('unloading the plugin waits for cleanup and cancels a pending start', async () => {
  await withLogRoot(async logRoot => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const { route, disposers } = routeHarness({ logRoot, nextSession: () => ({ createDelay: () => gate }) });
    const starting = call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    await new Promise(resolve => setTimeout(resolve, 10));
    const disposal = [];
    for (const off of [...disposers].reverse()) if (typeof off === 'function') disposal.push(off());
    assert.equal(disposal.some(value => value && typeof value.then === 'function'), true, 'the disposer must return a promise Cordis can await');
    release();
    await Promise.all(disposal);
    await starting.catch(() => {});
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.active, false, 'nothing stays active after unload');
    for (const session of [].concat(status.body.session ?? [])) assert.equal(session.window.created, false);
  });
});

test('unloading an active run closes it before the disposer resolves', async () => {
  await withLogRoot(async logRoot => {
    const { route, disposers, sessions } = routeHarness({ logRoot });
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(sessions[0].closed, false);
    for (const off of [...disposers].reverse()) if (typeof off === 'function') await off();
    assert.equal(sessions[0].closed, true, 'the disposer must not resolve before the window is closed');
  });
});

test('a close that cannot be proven is reported and kept for a retry', async () => {
  await withLogRoot(async logRoot => {
    const failing = { outcome: 'timeout', closed: false, error: 'still there' };
    const { route, api, sessions } = routeHarness({ logRoot, closeResult: failing });
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(stopped.status, 409, `an unproven close is a failure, not a success: ${JSON.stringify(stopped.body)}`);
    assert.equal(stopped.body.failed, true);
    assert.equal(stopped.body.lastCleanup.outcome, 'timeout');
    assert.match(stopped.body.error, /cleanup incomplete|timeout/i);
    assert.equal(stopped.body.session !== null, true, 'the failed run is retained so its window can be retried');
    assert.equal(api.currentSession(), sessions[0]);
    // A start must not slip in while the old window may still exist.
    const blocked = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(blocked.status, 409);
    // Retrying the stop is allowed and still reports the truth.
    const retry = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(retry.status, 409);
    assert.equal(retry.body.failed, true);
  });
});

test('a retried stop that succeeds clears the failed state', async () => {
  await withLogRoot(async logRoot => {
    // The same run answers "not closed" first and "closed" on the retry, which is exactly
    // what a second close attempt against a recovered helper looks like.
    let attempts = 0;
    const session = fakeSession({
      onStop: () => (attempts++ === 0
        ? { outcome: 'timeout', closed: false, error: 'still there' }
        : { outcome: 'closed', closed: true, waitedMs: 12 }),
    });
    const routes = new Map();
    const ctx = { effect(callback) { return callback(); }, webServer: { register(route) { routes.set(route.path, route); return () => {}; } } };
    registerWallpaperRoutes(ctx, { helper: HELPER, logRoot, exists, onWarn: () => {}, sessionFactory: () => session });
    const route = routes.get('/whale-wallpaper');
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });

    const failed = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(failed.status, 409, JSON.stringify(failed.body));
    assert.equal(failed.body.failed, true);
    assert.equal(failed.body.session !== null, true);

    const retried = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(retried.status, 200, JSON.stringify(retried.body));
    assert.equal(retried.status, 200, JSON.stringify(retried.body));
    assert.equal(retried.body.failed, false);
    assert.equal(retried.body.session, null, 'the proven-closed run is released');
    assert.equal(retried.body.lastCleanup.closed, true);

    // And a new run is allowed again.
    const restarted = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(restarted.status, 200, JSON.stringify(restarted.body));
  });
});

// U2: a stop must not leave the reporting loop or extra capture listeners behind. The check
// counts real timers and listeners of the session that createPreviewSession built.
test('stopping leaves no report timer and no duplicate capture listeners', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig();
    const { route, sessions } = realRouteHarness({ rig, logRoot });
    const originalSet = globalThis.setInterval;
    const originalClear = globalThis.clearInterval;
    const active = new Set();
    globalThis.setInterval = (...args) => { const handle = originalSet(...args); active.add(handle); return handle; };
    globalThis.clearInterval = handle => { active.delete(handle); return originalClear(handle); };
    try {
      await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
      const session = sessions[0];
      const running = session.stats();
      assert.equal(running.reporting, true, 'a live run reports while it runs');
      assert.equal(running.closeListeners, 1, 'one close listener while the run is live');
      assert.equal(active.size >= 1, true, 'the reporting timer exists while the run is live');

      await call(route, 'POST', '/whale-wallpaper/stop');
      assert.equal(session.isClosed(), true, 'the run is proven closed');
      assert.equal(session.stats().reporting, false, 'a stopped run must stop reporting');
      assert.equal(session.stats().closeListeners, 0, 'a stopped run must not keep capture listeners');
      assert.equal(session.stats().stdoutListeners, 0, 'no leftover stdout listener');
      assert.equal(active.size, 0, 'no reporting timer survives the stop');

      // A capture that goes away on its own must clean up the same way.
      await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
      const second = sessions[1];
      second.state().child?.emit('close', 0);
      await second.stop();
      assert.equal(second.isClosed(), true);
      assert.equal(second.stats().reporting, false, 'a naturally ended run stops reporting');
      assert.equal(second.stats().closeListeners, 0, 'a naturally ended run keeps no listener');
      assert.equal(active.size, 0, 'no reporting timer survives a natural end');
    } finally {
      globalThis.setInterval = originalSet;
      globalThis.clearInterval = originalClear;
    }
  });
});

test('a failed close retries without accumulating timers or listeners', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig({ firstCloseFails: true });
    const { route, sessions } = realRouteHarness({ rig, logRoot });
    const originalSet = globalThis.setInterval;
    const originalClear = globalThis.clearInterval;
    const active = new Set();
    globalThis.setInterval = (...args) => { const handle = originalSet(...args); active.add(handle); return handle; };
    globalThis.clearInterval = handle => { active.delete(handle); return originalClear(handle); };
    try {
      await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
      const session = sessions[0];
      const failed = await call(route, 'POST', '/whale-wallpaper/stop');
      assert.equal(failed.status, 409, JSON.stringify(failed.body));
      assert.equal(session.stats().closeListeners <= 1, true, `no duplicate close listener after a failed close: ${session.stats().closeListeners}`);
      assert.equal(session.stats().stdoutListeners <= 1, true, 'no duplicate stdout listener after a failed close');

      rig.state.canClose = true;
      const retried = await call(route, 'POST', '/whale-wallpaper/stop');
      assert.equal(retried.status, 200, JSON.stringify(retried.body));
      assert.equal(rig.state.closes, 2, 'the retry really closed the window');
      assert.equal(session.stats().reporting, false, 'a successful retry stops reporting');
      assert.equal(session.stats().closeListeners, 0, 'a successful retry removes the capture listeners');
      assert.equal(active.size, 0, 'no reporting timer survives the retry');
    } finally {
      globalThis.setInterval = originalSet;
      globalThis.clearInterval = originalClear;
    }
  });
});

test('unloading an active run leaves no timer behind', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig();
    const routes = new Map();
    const disposers = [];
    const { createPreviewSession } = realModules;
    const sessions = [];
    const ctx = { effect(callback) { const off = callback(); disposers.push(off); return off; }, webServer: { register(route) { routes.set(route.path, route); return () => {}; } } };
    realModules.registerWallpaperRoutes(ctx, { helper: HELPER, logRoot, exists, onWarn: () => {}, sessionFactory: () => {
      const session = createPreviewSession({ exists: () => true, sleep: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 1))), helperRun: rig.helperRun, spawnChild: rig.spawnChild });
      sessions.push(session);
      return session;
    } });
    const route = routes.get('/whale-wallpaper');
    const originalSet = globalThis.setInterval;
    const originalClear = globalThis.clearInterval;
    const active = new Set();
    globalThis.setInterval = (...args) => { const handle = originalSet(...args); active.add(handle); return handle; };
    globalThis.clearInterval = handle => { active.delete(handle); return originalClear(handle); };
    try {
      await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
      assert.equal(active.size >= 1, true, 'the reporting timer exists while the run is live');
      for (const off of [...disposers].reverse()) if (typeof off === 'function') await off();
      assert.equal(sessions[0].isClosed(), true, 'unloading closed the run');
      assert.equal(sessions[0].stats().reporting, false, 'unloading stops reporting');
      assert.equal(active.size, 0, 'unloading leaves no timer behind');
    } finally {
      globalThis.setInterval = originalSet;
      globalThis.clearInterval = originalClear;
    }
  });
});
test('the Host status carries the real preview limit for the countdown', async () => {
  await withLogRoot(async logRoot => {
    const { route } = routeHarness({ logRoot });
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.previewSeconds.default, 180);
    assert.equal(status.body.failed, false);
    assert.equal(status.body.lastCleanup, null);
  });
});

// T1: the ownership token must cover reading the request body, not just the build phase.
// These three cases release the bodies only after another operation has happened.

test('two starts whose bodies are both pending create at most one run', async () => {
  await withLogRoot(async logRoot => {
    const { route, sessions } = routeHarness({ logRoot });
    const shared = gate();
    const first = gatedCall(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' }, shared);
    await ticks();
    const second = gatedCall(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' }, shared);
    await ticks();
    shared.release();
    const outcomes = await Promise.all([first, second]);
    const accepted = outcomes.filter(outcome => outcome.status === 200);
    assert.equal(accepted.length, 1, `exactly one start may be accepted: ${JSON.stringify(outcomes.map(o => o.status))}`);
    assert.equal(sessions.length, 1, 'only one run may be built while the bodies were pending');
    const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
    assert.equal(sessions.filter(session => session.created && !session.closed).length, 0, 'no run survives the stop');
  });
});

test('a stop while a start body is still pending prevents that start', async () => {
  await withLogRoot(async logRoot => {
    const { route, sessions } = routeHarness({ logRoot });
    const pending = gate();
    const starting = gatedCall(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' }, pending);
    await ticks();
    const stopped = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
    assert.equal(stopped.body.active, false);
    pending.release();
    const started = await starting;
    assert.equal(started.status, 409, 'the invalidated start must not be accepted');
    assert.equal(sessions.length, 0, 'no run may be created after the stop');
    assert.match(String(started.body.error), /stopped while it was starting/);
  });
});

test('unloading while a start body is still pending prevents that start', async () => {
  await withLogRoot(async logRoot => {
    const { route, sessions, disposers } = routeHarness({ logRoot });
    const pending = gate();
    const starting = gatedCall(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' }, pending);
    await ticks();
    // Unloading must not wait for a client that never finishes its body.
    for (const off of [...disposers].reverse()) if (typeof off === 'function') await off();
    pending.release();
    const started = await starting;
    assert.equal(started.status, 409, 'an unloaded route must not start anything');
    assert.equal(sessions.length, 0, 'no run may be created after unload');
    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.active, false);
  });
});

// T2/T3: these use the real createPreviewSession, so the cached-close defect and the
// natural-end defect are covered against production code instead of a mutable fake.

function realSessionRig({ firstCloseFails = false } = {}) {
  // `canClose` flips to true after the first failed attempt, which is exactly what a helper
  // that recovers after a timeout looks like; a test can also flip it by hand.
  const state = { visible: false, closes: 0, canClose: !firstCloseFails, child: null, location: null };
  return {
    state,
    helperRun: async (_helper, args) => {
      if (args[0] === '--we-open') { state.location = args[1]; state.visible = true; return { opened: true }; }
      if (args[0] === '--window-find') return state.visible ? [{ hwnd: 321, pid: 222, title: state.location, visible: true }] : [];
      if (args[0] === '--window-ensure-closed') {
        state.closes += 1;
        if (state.canClose) { state.visible = false; return { outcome: 'closed', closed: true }; }
        return { outcome: 'timeout', closed: false };
      }
      if (args[0] === '--window-apply') return { visible: true, left: -32000, top: -32000 };
      throw new Error(`unexpected helper command ${args[0]}`);
    },
    spawnChild: () => {
      const child = new EventEmitter();
      child.pid = 9000;
      child.exitCode = null;
      child.stdin = new EventEmitter();
      child.stdin.end = () => { child.exitCode = 0; };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => { child.exitCode = 1; };
      state.child = child;
      return child;
    },
  };
}

function realRouteHarness({ rig, logRoot }) {
  const sessions = [];
  const routes = new Map();
  const { createPreviewSession } = realModules;
  const ctx = { effect(callback) { return callback(); }, webServer: { register(route) { routes.set(route.path, route); return () => {}; } } };
  const api = realModules.registerWallpaperRoutes(ctx, { helper: HELPER, logRoot, exists, onWarn: () => {}, sessionFactory: () => {
    const session = createPreviewSession({
      exists: () => true,
      sleep: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 1))),
      helperRun: rig.helperRun,
      spawnChild: rig.spawnChild,
    });
    sessions.push(session);
    return session;
  } });
  return { route: routes.get('/whale-wallpaper'), sessions, api };
}

test('a close that fails once is really retried by the session', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig({ firstCloseFails: true });
    const { route, sessions, api } = realRouteHarness({ rig, logRoot });
    const started = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(started.status, 200, JSON.stringify(started.body));

    const failed = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(failed.status, 409, `an unproven close must be reported: ${JSON.stringify(failed.body)}`);
    assert.equal(rig.state.closes, 1, 'the first close was attempted once');
    assert.equal(rig.state.visible, true, 'the window is still there after an unproven close');
    assert.equal(api.currentSession(), sessions[0], 'the failed run is retained');

    // The helper recovers; a retried stop must really call it again.
    rig.state.canClose = true;
    const retried = await call(route, 'POST', '/whale-wallpaper/stop');
    assert.equal(retried.status, 200, `the retried close must succeed: ${JSON.stringify(retried.body)}`);
    assert.equal(rig.state.closes, 2, 'the retry must call the real close again, not return the cached failure');
    assert.equal(rig.state.visible, false, 'the window is gone after the successful retry');
    assert.equal(retried.body.lastCleanup.closed, true);
    assert.equal(api.currentSession(), null, 'a proven-closed run releases its ownership');
  });
});

test('a run that ends by itself allows the next start', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig();
    const { route, sessions } = realRouteHarness({ rig, logRoot });
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    const first = sessions[0];
    // The native capture ends on its own (time limit) and the session closes its window.
    first.state().child?.emit('close', 0);
    await first.stop();
    assert.equal(first.isClosed(), true, 'the run closed itself');

    const before = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(before.body.active, false);

    const restarted = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(restarted.status, 200, `a plain start after a natural end must work: ${JSON.stringify(restarted.body)}`);
    assert.equal(sessions.length, 2, 'a new run is created');
  });
});

test('a run that ended without a proven close still blocks the next start', async () => {
  await withLogRoot(async logRoot => {
    const rig = realSessionRig({ firstCloseFails: true });
    const { route, sessions } = realRouteHarness({ rig, logRoot });
    await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    const first = sessions[0];
    first.state().child?.emit('close', 0);
    await first.stop();
    assert.equal(first.isClosed(), false, 'the close was not proven');

    const status = await call(route, 'GET', '/whale-wallpaper/status');
    assert.equal(status.body.failed, true);
    const blocked = await call(route, 'POST', '/whale-wallpaper/start', { scene: 'lucy' });
    assert.equal(blocked.status, 409, 'an unproven close must keep blocking new starts');
    assert.equal(sessions.length, 1, 'no second run may be built');
  });
});

