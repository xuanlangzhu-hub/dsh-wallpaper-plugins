import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  PROTOCOL_VERSION,
  DETACHABLE_MODES,
  DETACHABLE_ACTIONS,
  ALLOWED_SETTING_KEYS,
  RANGE_BOUNDS,
  isSceneId,
  buildAppearanceSnapshot,
  validateDetachableAction,
  buildEdgeAppLaunchSpec,
  createDetachableBridge,
  createCompanionClient,
  createHttpCompanionTransport,
  createMockTransportPair,
  createMainRendererBridgeClient,
} from '../src/detachable-bridge.js';

import { createDetachableHttpHost } from '../src/detachable-host.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Mock authoritative controller for isolated tests
function createMockController(initialSettings = {}) {
  let settings = {
    theme: 'abyss',
    palette: 'ocean',
    accentMode: 'theme',
    accentColor: '#8c72f2',
    canvas: 'soft',
    sidebar: 'balanced',
    glass: 'standard',
    textContrast: 'standard',
    background: 'wallpaper',
    motion: 'focus',
    chatBackdrop: 0,
    opaqueChat: false,
    opaqueSidebar: false,
    brightness: 70,
    mask: 0,
    blur: 0,
    surface: 45,
    weScene: 'lucy',
    weMode: 'daily',
    weAutoStart: false,
    ...initialSettings,
  };

  let presets = {
    version: 1,
    entries: {
      lucy: { brightness: 100, mask: 0, blur: 0, surface: 40 },
    },
  };

  let wpStatus = {
    state: 'playing',
    activeSceneId: 'lucy',
    cleanupPending: false,
  };

  const startCalls = [];
  const stopCalls = [];
  const restartCalls = [];

  let settingsSnapshot = Object.freeze({ ...settings });
  const settingsListeners = new Set();
  const notifySettings = () => {
    settingsSnapshot = Object.freeze({ ...settings });
    for (const l of settingsListeners) l(settingsSnapshot);
  };

  const presetListeners = new Set();
  const notifyPresets = () => {
    for (const l of presetListeners) l();
  };

  const statusListeners = new Set();
  const notifyStatus = () => {
    for (const l of statusListeners) l(wpStatus);
  };

  return {
    read: () => ({ ...settings }),
    getSettingsSnapshot: () => settingsSnapshot,
    subscribeSettings: (listener) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    set: (key, value) => {
      const next = { ...settings, [key]: value };
      const hasChanges = Object.keys(next).some((k) => next[k] !== settings[k]);
      if (!hasChanges) return { ...settings };
      settings = next;
      notifySettings();
      return { ...settings };
    },
    reset: () => {
      settings = {
        theme: 'abyss',
        palette: 'ocean',
        accentMode: 'theme',
        accentColor: '#8c72f2',
        canvas: 'soft',
        sidebar: 'balanced',
        glass: 'standard',
        textContrast: 'standard',
        background: 'none',
        motion: 'focus',
        chatBackdrop: 0,
        opaqueChat: false,
        opaqueSidebar: false,
        brightness: 70,
        mask: 0,
        blur: 0,
        surface: 45,
        weScene: 'lucy',
        weMode: 'daily',
        weAutoStart: false,
      };
      notifySettings();
      return { ...settings };
    },
    presets: {
      getSnapshot: () => presets,
      subscribe: (listener) => {
        presetListeners.add(listener);
        return () => presetListeners.delete(listener);
      },
      save: (sceneId) => {
        if (!sceneId || !isSceneId(sceneId)) return { ok: false, error: 'invalid-scene' };
        presets = {
          version: 1,
          entries: {
            ...presets.entries,
            [sceneId]: {
              brightness: settings.brightness,
              mask: settings.mask,
              blur: settings.blur,
              surface: settings.surface,
            },
          },
        };
        notifyPresets();
        return { ok: true, sceneId };
      },
      apply: (sceneId) => {
        if (!sceneId || !isSceneId(sceneId)) return { ok: false, error: 'invalid-scene' };
        const entry = presets.entries[sceneId];
        if (!entry) return { ok: false, error: 'preset-missing' };
        settings = {
          ...settings,
          brightness: entry.brightness,
          mask: entry.mask,
          blur: entry.blur,
          surface: entry.surface,
        };
        notifySettings();
        return { ok: true, sceneId, settings: { ...settings } };
      },
      remove: (sceneId) => {
        if (!presets.entries[sceneId]) return { ok: false, error: 'preset-missing' };
        const nextEntries = { ...presets.entries };
        delete nextEntries[sceneId];
        presets = { version: 1, entries: nextEntries };
        notifyPresets();
        return { ok: true, sceneId };
      },
    },
    wallpaper: {
      getStatus: () => wpStatus,
      subscribeStatus: (listener) => {
        statusListeners.add(listener);
        return () => statusListeners.delete(listener);
      },
      start: async (mode) => {
        startCalls.push(mode);
        wpStatus.state = 'playing';
        notifyStatus();
      },
      stop: async (reason) => {
        stopCalls.push(reason);
        wpStatus.state = 'idle';
        notifyStatus();
      },
      restart: async (reason) => {
        restartCalls.push(reason);
        wpStatus.state = 'playing';
        notifyStatus();
      },
      changeStatus: (newStatus) => {
        wpStatus = { ...wpStatus, ...newStatus };
        notifyStatus();
      },
    },
    getCalls: () => ({ start: [...startCalls], stop: [...stopCalls], restart: [...restartCalls] }),
  };
}

test('1. Snapshot building and Action Validation schema constraints (R5 schema drift fixed)', () => {
  const controller = createMockController();
  const snapshot = buildAppearanceSnapshot(controller, 1);

  assert.equal(snapshot.protocolVersion, PROTOCOL_VERSION);
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.settings.brightness, 70);
  assert.equal(snapshot.presets.entries.lucy.brightness, 100);
  assert.equal(snapshot.wallpaper.state, 'playing');

  // Valid action
  const validAction = {
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'brightness',
    value: 85,
    clientActionId: 'act-1',
    expectedRevision: 1,
  };
  assert.deepEqual(validateDetachableAction(validAction), { valid: true });

  // R5 Schema Drift: blur max 24, surface min 40
  assert.equal(RANGE_BOUNDS.blur.max, 24);
  assert.equal(RANGE_BOUNDS.surface.min, 40);

  const blur30 = { ...validAction, key: 'blur', value: 30 };
  assert.equal(validateDetachableAction(blur30).valid, false);

  const blur24 = { ...validAction, key: 'blur', value: 24 };
  assert.equal(validateDetachableAction(blur24).valid, true);

  const surface0 = { ...validAction, key: 'surface', value: 0 };
  assert.equal(validateDetachableAction(surface0).valid, false);

  const surface40 = { ...validAction, key: 'surface', value: 40 };
  assert.equal(validateDetachableAction(surface40).valid, true);

  // R5 Scene ID regex constraint
  const invalidScene = { ...validAction, key: 'weScene', value: 'we-' + 'z'.repeat(25) };
  assert.equal(validateDetachableAction(invalidScene).valid, false);

  const validHexScene = { ...validAction, key: 'weScene', value: 'we-' + 'a'.repeat(24) };
  assert.equal(validateDetachableAction(validHexScene).valid, true);

  const lucyScene = { ...validAction, key: 'weScene', value: 'lucy' };
  assert.equal(validateDetachableAction(lucyScene).valid, true);

  // R1 Null action does not throw
  const nullActionRes = validateDetachableAction(null);
  assert.equal(nullActionRes.valid, false);
  assert.equal(nullActionRes.error, 'action-invalid-object');
});

test('2. Single Source of Truth: Dual subscription, confirmed snapshot, and action deduplication (R3 deduplication)', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);
  const pair = createMockTransportPair();
  pair.mainTransport.setBridge(bridge);

  const detachRes = await bridge.requestDetach();
  const client = createCompanionClient({
    token: detachRes.token,
    instanceId: bridge.instanceId,
    transport: pair.companionTransport,
  });
  const connectRes = await client.connect();
  assert.equal(connectRes.ok, true);

  let clientSnapshotsReceived = 0;
  client.subscribe(() => { clientSnapshotsReceived++; });

  // Main DSH modifies brightness -> Companion receives snapshot
  controller.set('brightness', 95);
  assert.equal(client.getSnapshot().settings.brightness, 95);

  // Companion window modifies mask via action dispatch -> DSH modifies setting
  const actionRes = await client.dispatch(DETACHABLE_ACTIONS.SET_SETTING, {
    key: 'mask',
    value: 60,
  });
  assert.equal(actionRes.ok, true);
  assert.equal(controller.read().mask, 60);

  // Deduplication with exact same clientActionId and payload returns cached result
  const dupRes = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'mask',
    value: 60,
    clientActionId: 'same-action-id',
    expectedRevision: bridge.revision,
  });
  assert.equal(dupRes.ok, true);

  const dupRetry = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'mask',
    value: 60,
    clientActionId: 'same-action-id',
    expectedRevision: bridge.revision,
  });
  assert.equal(dupRetry.ok, true);
  assert.equal(dupRetry.duplicate, true);

  // Deduplication with SAME id but DIFFERENT payload returns rejection
  const dupTamper = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'mask',
    value: 80, // different payload
    clientActionId: 'same-action-id',
    expectedRevision: bridge.revision,
  });
  assert.equal(dupTamper.ok, false);
  assert.equal(dupTamper.error, 'action-payload-mismatch');

  await bridge.dispose();
});

test('3. Mode Transition (Docked <-> Detached) preserves wallpaper playback with ZERO interruptions', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);

  assert.equal(controller.getCalls().start.length, 0);
  assert.equal(controller.getCalls().stop.length, 0);
  assert.equal(controller.getCalls().restart.length, 0);

  // Transition to Detached
  const detachRes = await bridge.requestDetach();
  assert.equal(detachRes.ok, true);
  assert.equal(bridge.getMode(), DETACHABLE_MODES.DETACHING);

  // Transition to Docked
  const dockRes = await bridge.requestDock();
  assert.equal(dockRes.ok, true);
  assert.equal(bridge.getMode(), DETACHABLE_MODES.DOCKED);

  // Multiple roundtrips
  await bridge.requestDetach();
  await bridge.requestDock();
  await bridge.requestDetach();
  await bridge.requestDock();

  // Zero interruptions!
  assert.equal(controller.getCalls().start.length, 0);
  assert.equal(controller.getCalls().stop.length, 0);
  assert.equal(controller.getCalls().restart.length, 0);

  await bridge.dispose();
});

test('4. Security & Connection Boundaries (R1): Token single-use, capability lease binding, old channel rejection', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);
  const pair1 = createMockTransportPair();
  pair1.mainTransport.setBridge(bridge);

  // Unauthenticated action (no handshake) is rejected
  const noHandshake = await bridge.handleCompanionAction(
    { type: DETACHABLE_ACTIONS.SET_SETTING, key: 'brightness', value: 90, clientActionId: 'nh-1', expectedRevision: 1 },
    { instanceId: bridge.instanceId, token: 'fake' }
  );
  assert.equal(noHandshake.ok, false);
  assert.equal(controller.read().brightness, 70);

  // Request detach
  const detach = await bridge.requestDetach();
  const validToken = detach.token;

  // Handshake 1 succeeds and burns the token
  const r1 = await pair1.companionTransport.connect({
    token: validToken,
    instanceId: bridge.instanceId,
  });
  assert.equal(r1.ok, true);

  // Re-using the same burned token fails
  const pair2 = createMockTransportPair();
  pair2.mainTransport.setBridge(bridge);
  const r2 = await pair2.companionTransport.connect({
    token: validToken,
    instanceId: bridge.instanceId,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.error, 'unauthorized-token');

  // Docking closes pair1 session
  await bridge.requestDock();

  // New detach and connect with pair3
  const pair3 = createMockTransportPair();
  pair3.mainTransport.setBridge(bridge);
  const detach2 = await bridge.requestDetach();
  const r3 = await pair3.companionTransport.connect({
    token: detach2.token,
    instanceId: bridge.instanceId,
  });
  assert.equal(r3.ok, true);

  // Action from old closed pair1 channel is rejected!
  const oldChannelRes = await pair1.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'brightness',
    value: 100,
    clientActionId: 'old-ch-1',
    expectedRevision: bridge.revision,
  });
  assert.equal(oldChannelRes.ok, false);
  assert.equal(oldChannelRes.error, 'unauthorized-session-expired');
  assert.equal(controller.read().brightness, 70);

  // Null action does not throw and returns ok: false
  const nullActionRes = await bridge.handleCompanionAction(null, { leaseId: 'fake', generation: 1 });
  assert.equal(nullActionRes.ok, false);
  assert.equal(nullActionRes.error, 'action-invalid-object');

  await bridge.dispose();
});

test('5. Edge App Launch Spec Generator verifies secure Chromium arguments, mandatory profile, and absence of shell escape', () => {
  const spec = buildEdgeAppLaunchSpec({
    hostPort: 19387,
    token: 'test-token-123',
    instanceId: 'inst-456',
  });

  assert.equal(spec.executable.includes('msedge.exe'), true);
  assert.ok(spec.args.some((a) => a.startsWith('--app=http://127.0.0.1:19387/index.html?') || a.startsWith('--app=http://127.0.0.1:19387/whale-companion.html?')));
  assert.ok(spec.args.some((a) => a.startsWith('--user-data-dir=')));
  assert.ok(spec.args.includes('--no-first-run'));
  assert.ok(spec.args.includes('--no-default-browser-check'));
  assert.ok(spec.args.includes('--disable-extensions'));

  // Ensure arguments array contains NO shell metacharacters
  for (const arg of spec.args) {
    assert.equal(arg.includes('|'), false);
    assert.equal(arg.includes(';'), false);
    assert.equal(arg.includes('`'), false);
    assert.equal(arg.includes('$'), false);
    assert.equal(arg.includes('>'), false);
    assert.equal(arg.includes('<'), false);
  }
});

test('6. Stale & Future Revision Defense & Recovery (R3)', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);
  const pair = createMockTransportPair();
  pair.mainTransport.setBridge(bridge);

  const d = await bridge.requestDetach();
  await pair.companionTransport.connect({ token: d.token, instanceId: bridge.instanceId });

  // Current bridge revision is 1. Increment controller brightness -> revision becomes 2.
  controller.set('brightness', 110);
  assert.equal(bridge.revision, 2);

  // Stale by one: expectedRevision = 1 -> REJECTED
  const staleRes = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'brightness',
    value: 60,
    clientActionId: 'stale-1',
    expectedRevision: 1,
  });
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.error, 'stale-revision');
  assert.equal(controller.read().brightness, 110);

  // Future revision: expectedRevision = 999999 -> REJECTED
  const futureRes = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.SET_SETTING,
    key: 'brightness',
    value: 80,
    clientActionId: 'future-1',
    expectedRevision: 999999,
  });
  assert.equal(futureRes.ok, false);
  assert.equal(futureRes.error, 'stale-revision');
  assert.equal(controller.read().brightness, 110);

  // R3: Late connect does NOT resurrect disconnected client
  {
    const response = deferred();
    const cclient = createCompanionClient({ token: 't', instanceId: 'i', transport: { connect: () => response.promise, close() {} } });
    const pending = cclient.connect();
    cclient.disconnect();
    response.resolve({ ok: true, snapshot: { revision: 3 } });
    const res = await pending;
    assert.equal(cclient.isConnected(), false);
    assert.equal(res.ok, false);
  }

  // R3: New snapshot during connect is NOT lost
  {
    let cb;
    const response = deferred();
    const cclient = createCompanionClient({ token: 't', instanceId: 'i', transport: { connect: () => response.promise, onSnapshot: f => { cb = f; }, close() {} } });
    const pending = cclient.connect();
    cb({ revision: 4, settings: { brightness: 110 } });
    response.resolve({ ok: true, snapshot: { revision: 3, settings: { brightness: 90 } } });
    await pending;
    assert.equal(cclient.getSnapshot().revision, 4);
    cclient.disconnect();
  }

  // R3: Automatic recovery: rejection snapshot is absorbed and subsequent action succeeds
  {
    await bridge.requestDock();
    const pairR = createMockTransportPair();
    pairR.mainTransport.setBridge(bridge);
    const dR = await bridge.requestDetach();
    const cclient = createCompanionClient({ token: dR.token, instanceId: bridge.instanceId, transport: pairR.companionTransport });
    await cclient.connect();
    pairR.mainTransport.sendSnapshot = () => {}; // simulate missed broadcast
    controller.set('brightness', 115); // controller revision increments to 3

    const r1 = await cclient.dispatch('set-setting', { key: 'brightness', value: 80 });
    assert.equal(r1.error, 'stale-revision');
    assert.equal(cclient.getCurrentRevision(), 3); // absorbed revision 3 from rejection response

    const r2 = await cclient.dispatch('set-setting', { key: 'brightness', value: 90 });
    assert.equal(r2.ok, true);
    assert.equal(controller.getSettingsSnapshot().brightness, 90);
    cclient.disconnect();
  }

  await bridge.dispose();
});

test('7. Injection & Disallowed Payload Defense: Arbitrary paths, commands, code strings are refused', () => {
  const disallowedActions = [
    { type: 'exec', command: 'cmd.exe', clientActionId: 'bad-1', expectedRevision: 1 },
    { type: DETACHABLE_ACTIONS.SET_SETTING, key: '__proto__', value: {}, clientActionId: 'bad-2', expectedRevision: 1 },
    { type: DETACHABLE_ACTIONS.SET_SETTING, key: 'constructor', value: {}, clientActionId: 'bad-3', expectedRevision: 1 },
    { type: DETACHABLE_ACTIONS.SET_SETTING, key: 'background', value: 'malicious.exe', clientActionId: 'bad-4', expectedRevision: 1 },
    { type: DETACHABLE_ACTIONS.SET_SETTING, key: 'accentColor', value: 'red; drop table', clientActionId: 'bad-5', expectedRevision: 1 },
    { type: DETACHABLE_ACTIONS.SAVE_PRESET, sceneId: '../../etc/passwd', clientActionId: 'bad-6', expectedRevision: 1 },
  ];

  for (const act of disallowedActions) {
    const res = validateDetachableAction(act);
    assert.equal(res.valid, false);
  }
});

test('8. Lifecycle & Concurrency Resilience (R2): Mutex transition serialization, repeat detach, close error visibility, barrier dispose', async () => {
  // R2: Repeat detach before handshake does NOT spawn twice and does NOT invalidate token
  {
    let spawns = 0;
    const b = createDetachableBridge(createMockController(), { windowAdapter: { spawn: async () => { spawns++; }, close: async () => {} } });
    const first = await b.requestDetach();
    const second = await b.requestDetach();
    assert.equal(spawns, 1);
    assert.equal(first.token, second.token);
    assert.equal(second.alreadyDetached, true);
    await b.dispose();
  }

  // R2: Refuse new spawn when previous window close failed/unconfirmed
  {
    let spawns = 0;
    const b = createDetachableBridge(createMockController(), { windowAdapter: { spawn: async () => { spawns++; }, close: async () => { throw Error('still-open'); } } });
    await b.requestDetach();
    const failed = await b.requestDock();
    assert.equal(failed.ok, false);
    const next = await b.requestDetach();
    assert.equal(next.ok, false);
    assert.equal(next.error, 'previous-window-still-open');
    assert.equal(spawns, 1);
    await b.dispose();
  }

  // R2: Dispose awaits in-flight spawn and cleans up with barrier
  {
    const started = deferred(), release = deferred();
    let spawnFinished = false, closes = 0, closedAfterFinish = 0;
    const b = createDetachableBridge(createMockController(), {
      windowAdapter: {
        spawn: async () => { started.resolve(); await release.promise; spawnFinished = true; },
        close: async () => { closes++; if (spawnFinished) closedAfterFinish++; }
      }
    });
    const detach = b.requestDetach();
    await started.promise;
    const disposePromise = b.dispose();
    release.resolve();
    const disposeResult = await disposePromise;
    const detachResult = await detach;
    assert.equal(spawnFinished, true);
    assert.ok(closedAfterFinish >= 1);
    assert.equal(detachResult.ok, false);
    assert.equal(disposeResult.ok, true);
  }

  // R2: Dispose close failure is visible and returns ok: false
  {
    const b = createDetachableBridge(createMockController(), { windowAdapter: { spawn: async () => {}, close: async () => { throw Error('still-open'); } } });
    await b.requestDetach();
    const result = await b.dispose();
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('window-close-failed: still-open'));
    assert.notEqual(b.getMode(), 'docked');
  }

  // R2: Repeated dispose returns same promise
  {
    const b = createDetachableBridge(createMockController(), { windowAdapter: { spawn: async () => {}, close: async () => {} } });
    await b.requestDetach();
    const p1 = b.dispose();
    const p2 = b.dispose();
    assert.equal(p1, p2);
    const r1 = await p1;
    const r2 = await p2;
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
  }

  // R2: Old disconnect does not cancel new detach
  {
    const b = createDetachableBridge(createMockController());
    const pair = createMockTransportPair();
    pair.mainTransport.setBridge(b);

    const d1 = await b.requestDetach();
    await pair.companionTransport.connect({ token: d1.token, instanceId: b.instanceId });
    await b.requestDock();

    const d2 = await b.requestDetach();
    // Late disconnect from old session
    b.handleCompanionDisconnect(pair.mainTransport, 1);
    assert.equal(b.getMode(), DETACHABLE_MODES.DETACHING);
    assert.equal(b.getActiveToken(), d2.token);
    await b.dispose();
  }

  // R2: Late spawn close failure preserves handle and returns ok: false, does not call close(null)
  {
    const began = deferred(), release = deferred(), handle = { id: 'late-H' };
    const calls = [];
    const b = createDetachableBridge(createMockController(), {
      windowAdapter: {
        spawn: async () => { began.resolve(); await release.promise; return handle; },
        close: async h => { calls.push(h); if (h === handle) throw Error('late-H-still-alive'); }
      }
    });
    const pending = b.requestDetach();
    await began.promise;
    const disposed = b.dispose();
    release.resolve();
    const d = await disposed;
    await pending;
    assert.equal(d.ok, false);
    assert.deepEqual(calls, [handle]);
    assert.equal(b.hasUnconfirmedCleanup(), true);
    assert.deepEqual(b.getActiveOwnedHandle(), handle);
  }

  // R2: Transport disconnect closes owned window via adapter; close failure blocks subsequent detach
  {
    let spawned = 0, closed = 0;
    const b = createDetachableBridge(createMockController(), {
      windowAdapter: { spawn: async () => ({ id: ++spawned }), close: async () => { closed++; } }
    });
    const d = await b.requestDetach();
    const dummyTransport = { onAction() {}, onDisconnect() {}, close() {} };
    const auth = b.handleCompanionConnect({ token: d.token, instanceId: b.instanceId, transport: dummyTransport });
    assert.equal(auth.ok, true);
    await b.handleCompanionDisconnect(dummyTransport, auth.generation);
    assert.equal(closed, 1);
    assert.equal(b.getMode(), 'docked');
    const d2 = await b.requestDock();
    assert.equal(d2.alreadyDocked, true);
    const d3 = await b.requestDetach();
    assert.equal(d3.ok, true);
    assert.equal(spawned, 2);
    assert.equal(closed, 1);
    await b.dispose();
  }
});

test('9. Transparent Business Results & Preset Operations (R4): Missing preset or failure returns outer ok: false, dock awaits completion', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);
  const pair = createMockTransportPair();
  pair.mainTransport.setBridge(bridge);

  const d = await bridge.requestDetach();
  await pair.companionTransport.connect({ token: d.token, instanceId: bridge.instanceId });

  // Applying missing preset returns outer ok: false with error preset-missing
  await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.REMOVE_PRESET,
    sceneId: 'lucy',
    clientActionId: 'rem-1',
    expectedRevision: bridge.revision,
  });

  const failRes = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.APPLY_PRESET,
    sceneId: 'lucy',
    clientActionId: 'fail-1',
    expectedRevision: bridge.revision,
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.error, 'preset-missing');

  // Retrying the failed action with same clientActionId returns cached failure (not ok: true)
  const failRetry = await pair.companionTransport.sendAction({
    type: DETACHABLE_ACTIONS.APPLY_PRESET,
    sceneId: 'lucy',
    clientActionId: 'fail-1',
    expectedRevision: bridge.revision,
  });
  assert.equal(failRetry.ok, false);
  assert.equal(failRetry.duplicate, true);
  assert.equal(failRetry.error, 'preset-missing');

  await bridge.dispose();

  // R4: Companion request-dock action reports actual failure if close throws
  {
    const b = createDetachableBridge(createMockController(), { windowAdapter: { spawn: async () => {}, close: async () => { throw Error('still-open'); } } });
    const p = createMockTransportPair();
    p.mainTransport.setBridge(b);
    const dRes = await b.requestDetach();
    await p.companionTransport.connect({ token: dRes.token, instanceId: b.instanceId });

    const dockActionRes = await p.companionTransport.sendAction({
      type: DETACHABLE_ACTIONS.REQUEST_DOCK,
      clientActionId: 'dock-fail-1',
      expectedRevision: b.revision,
    });
    assert.equal(dockActionRes.ok, false);
    assert.ok(dockActionRes.error.includes('window-close-failed: still-open'));
    assert.equal(b.getMode(), 'docking');
    await b.dispose();
  }
});

test('10. Real Controller Contract & Live Status Subscriptions (R5)', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);

  // Status changes are subscribed and increment revision
  assert.equal(bridge.getSnapshot().wallpaper.state, 'playing');
  controller.wallpaper.changeStatus({ state: 'cleanup-failed', cleanupPending: true });

  assert.equal(bridge.getSnapshot().wallpaper.state, 'cleanup-failed');
  assert.equal(bridge.getSnapshot().wallpaper.cleanupPending, true);

  // Controller set same value does NOT reallocate snapshot
  const beforeSnap = controller.getSettingsSnapshot();
  let notifications = 0;
  const unsub = controller.subscribeSettings(() => { notifications++; });
  controller.set('brightness', beforeSnap.brightness);
  unsub();

  assert.equal(notifications, 0);
  assert.equal(controller.getSettingsSnapshot(), beforeSnap);

  await bridge.dispose();
});

test('11. Browser Loadability & Zero-Node-Dependency Verification (R6)', async () => {
  const contractPath = fileURLToPath(new URL('../src/detachable-contract.js', import.meta.url));
  const bridgePath = fileURLToPath(new URL('../src/detachable-bridge.js', import.meta.url));

  const contractSrc = await readFile(contractPath, 'utf8');
  const bridgeSrc = await readFile(bridgePath, 'utf8');

  // Ensure NO node: imports in contract or bridge
  assert.equal(contractSrc.includes("from 'node:"), false, 'detachable-contract.js must not import node: builtins');
  assert.equal(contractSrc.includes('from "node:'), false, 'detachable-contract.js must not import node: builtins');
  assert.equal(bridgeSrc.includes("from 'node:"), false, 'detachable-bridge.js must not import node: builtins');
  assert.equal(bridgeSrc.includes('from "node:'), false, 'detachable-bridge.js must not import node: builtins');

  // Check package.json files array contains all three modules
  const pkg = JSON.parse(await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.ok(pkg.files.includes('src/detachable-contract.js'), 'package.json files must include detachable-contract.js');
  assert.ok(pkg.files.includes('src/detachable-bridge.js'), 'package.json files must include detachable-bridge.js');
  assert.ok(pkg.files.includes('src/detachable-host.js'), 'package.json files must include detachable-host.js');
});

test('12. Loopback HTTP Host & Endpoint Security (R6)', async () => {
  const controller = createMockController();
  const bridge = createDetachableBridge(controller);
  const host = createDetachableHttpHost({ bridge });
  await host.start();
  const baseUrl = host.getBaseUrl();

  try {
    // 1. Foreign origin is rejected with 403 Forbidden
    const foreignRes = await fetch(`${baseUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://evil.com' },
      body: JSON.stringify({ token: 'any', instanceId: 'any' }),
    });
    assert.equal(foreignRes.status, 403);
    const foreignData = await foreignRes.json();
    assert.equal(foreignData.error, 'forbidden-origin');

    // 2. Missing token rejected with 401
    const missingTokRes = await fetch(`${baseUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: bridge.instanceId }),
    });
    assert.equal(missingTokRes.status, 401);

    // 3. Body null rejected with 400 without unhandled rejection
    const nullBodyRes = await fetch(`${baseUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    assert.equal(nullBodyRes.status, 400);
    const nullBodyData = await nullBodyRes.json();
    assert.equal(nullBodyData.error, 'invalid-json-body');

    // 4. Unauthenticated snapshot read rejected with 401 / 403
    const foreignSnapRes = await fetch(`${baseUrl}/api/snapshot`, {
      headers: { Origin: 'http://127.0.0.1:9' },
    });
    assert.equal(foreignSnapRes.status, 403);
    const unauthSnapRes = await fetch(`${baseUrl}/api/snapshot`);
    assert.equal(unauthSnapRes.status, 401);

    // 5. Connect over loopback HTTP via createHttpCompanionTransport
    const detachRes = await bridge.requestDetach();
    const transport = createHttpCompanionTransport({
      baseUrl,
      token: detachRes.token,
      instanceId: bridge.instanceId,
    });
    const client = createCompanionClient({
      token: detachRes.token,
      instanceId: bridge.instanceId,
      transport,
    });

    const connectRes = await client.connect();
    assert.equal(connectRes.ok, true);
    assert.ok(connectRes.leaseId);

    // 6. Live Server-Sent Events push from Main to Companion
    await new Promise((r) => setTimeout(r, 60)); // allow SSE connection to establish
    controller.set('brightness', 110);
    await new Promise((r) => setTimeout(r, 60)); // allow SSE event to be processed
    assert.equal(client.getSnapshot().settings.brightness, 110);

    // 7. Action over HTTP
    const actionRes = await client.dispatch(DETACHABLE_ACTIONS.SET_SETTING, {
      key: 'brightness',
      value: 85,
    });
    assert.equal(actionRes.ok, true);
    assert.equal(controller.getSettingsSnapshot().brightness, 85);

    // 8. Unauthorized action (fake lease)
    const badLeaseRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': 'fake-lease' },
      body: JSON.stringify({
        action: {
          type: DETACHABLE_ACTIONS.SET_SETTING,
          key: 'brightness',
          value: 95,
          clientActionId: 'bad-1',
          expectedRevision: bridge.revision,
        },
      }),
    });
    assert.equal(badLeaseRes.status, 401);

    // 9. Client disconnect revokes lease on Host
    client.disconnect();
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(bridge.getMode(), 'docked');
    const replayRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Whale-Lease': connectRes.leaseId,
        'X-Whale-Generation': String(connectRes.generation || 1),
      },
      body: JSON.stringify({
        action: {
          type: DETACHABLE_ACTIONS.SET_SETTING,
          key: 'brightness',
          value: 100,
          clientActionId: 'after-http-close',
          expectedRevision: bridge.revision,
        },
      }),
    });
    assert.equal(replayRes.status, 401);

    // 10. Main instance disconnected (after bridge dispose) returns 503 and marks client disconnected
    const detachRes2 = await bridge.requestDetach();
    const transport2 = createHttpCompanionTransport({
      baseUrl,
      token: detachRes2.token,
      instanceId: bridge.instanceId,
    });
    const client2 = createCompanionClient({
      token: detachRes2.token,
      instanceId: bridge.instanceId,
      transport: transport2,
    });
    await client2.connect();
    await bridge.dispose();

    const disconnectedRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': detachRes2.token },
      body: JSON.stringify({
        action: {
          type: DETACHABLE_ACTIONS.SET_SETTING,
          key: 'brightness',
          value: 100,
          clientActionId: 'after-disp-1',
          expectedRevision: 2,
        },
      }),
    });
    assert.equal(disconnectedRes.status, 503);
    const disconnData = await disconnectedRes.json();
    assert.equal(disconnData.error, 'main-instance-disconnected');

    const actionAfterDispose = await client2.dispatch(DETACHABLE_ACTIONS.SET_SETTING, {
      key: 'brightness',
      value: 90,
    });
    assert.equal(actionAfterDispose.ok, false);
    assert.equal(client2.isConnected(), false);
  } finally {
    await host.stop();
  }
});

test('13. Remote Instance & Generation Isolation (F3 Session Probes)', async () => {
  // 1. Host with random or explicit token refuses 'default-main-token'
  const hostNoToken = createDetachableHttpHost({});
  await hostNoToken.start();
  const baseNoToken = hostNoToken.getBaseUrl();
  try {
    const r = await fetch(`${baseNoToken}/api/main/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainToken: 'default-main-token', instanceId: 'main-A' }),
    });
    assert.equal(r.status, 401, 'default-main-token rejected when token is unconfigured (random token generated)');
    const d = await r.json();
    assert.equal(d.error, 'unauthorized-main-token');
  } finally {
    await hostNoToken.stop();
  }

  // 2. Multi-instance boundary tests on configured host
  const mainToken = 'secure-random-token-12345';
  const host = createDetachableHttpHost({ mainToken });
  await host.start();
  const base = host.getBaseUrl();

  const post = async (path, body, token = mainToken) => {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Whale-Main-Token': token },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const snapshot = (revision, marker) => ({ protocolVersion: 1, revision, settings: { marker } });

  try {
    // Register main-A
    const regA = await post('/api/main/connect', { mainToken, instanceId: 'main-A', snapshot: snapshot(1, 'A') });
    assert.equal(regA.status, 200);
    assert.equal(regA.data.ok, true);

    // Detach window for main-A
    const detachA = await post('/api/main/detach', { instanceId: 'main-A', generation: regA.data.generation });
    assert.equal(detachA.status, 200);
    assert.ok(detachA.data.token);

    // Handshake with wrong instance is rejected (401)
    const badHandshake = await fetch(`${base}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: detachA.data.token, instanceId: 'wrong-instance' }),
    });
    assert.equal(badHandshake.status, 401, 'Handshake with wrong instanceId rejected');
    const badHandshakeData = await badHandshake.json();
    assert.equal(badHandshakeData.error, 'unauthorized-instance');

    // Correct handshake succeeds
    const goodHandshake = await fetch(`${base}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: detachA.data.token, instanceId: 'main-A' }),
    });
    assert.equal(goodHandshake.status, 200);
    const leaseA = (await goodHandshake.json()).leaseId;

    // Register new main-B (replaces main-A)
    const regB = await post('/api/main/connect', { mainToken, instanceId: 'main-B', snapshot: snapshot(10, 'B') });
    assert.equal(regB.status, 200);

    // Old companion lease from main-A CANNOT read new main-B snapshot (401)
    const oldRead = await fetch(`${base}/api/snapshot`, {
      headers: { 'X-Whale-Lease': leaseA },
    });
    assert.equal(oldRead.status, 401, 'Old companion lease cannot read new main instance');

    // Old main-A cannot push snapshot to overwrite main-B (403)
    const oldWrite = await post('/api/main/snapshot', {
      instanceId: 'main-A',
      generation: regA.data.generation,
      snapshot: snapshot(1, 'late-A'),
    });
    assert.equal(oldWrite.status, 403, 'Old main-A snapshot rejected with 403');
    assert.equal(oldWrite.data.error, 'unauthorized-instance');

    // Old main-A cannot disconnect new main-B (403)
    const oldDisconnect = await post('/api/main/disconnect', {
      instanceId: 'main-A',
      generation: regA.data.generation,
    });
    assert.equal(oldDisconnect.status, 403, 'Old main-A disconnect rejected with 403');
    assert.equal(oldDisconnect.data.error, 'unauthorized-instance');

    // Main-B is still alive and reads revision 10
    const detachB = await post('/api/main/detach', { instanceId: 'main-B', generation: regB.data.generation });
    const handshakeB = await fetch(`${base}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: detachB.data.token, instanceId: 'main-B' }),
    });
    const leaseB = (await handshakeB.json()).leaseId;
    const readB = await fetch(`${base}/api/snapshot`, {
      headers: { 'X-Whale-Lease': leaseB },
    });
    assert.equal(readB.status, 200);
    const snapB = await readB.json();
    assert.equal(snapB.snapshot.settings.marker, 'B');
  } finally {
    await host.stop();
  }
});

test('14. Fifth Review G1/G2/G3: Registration Generations, Close Failure Consistency, and Action Schema', async () => {
  const defer = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  // -------------------------------------------------------------
  // G1-A: Same instanceId reconnect rejects old generation requests
  // -------------------------------------------------------------
  {
    const mainToken = 'g1-test-token';
    const h = createDetachableHttpHost({ mainToken });
    await h.start();
    const base = h.getBaseUrl();
    const post = async (path, body) => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Main-Token': mainToken },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    };

    try {
      const first = await post('/api/main/connect', {
        mainToken,
        instanceId: 'same-main',
        snapshot: { protocolVersion: 1, revision: 50, settings: { marker: 'gen-1' } },
      });
      assert.equal(first.status, 200);

      const second = await post('/api/main/connect', {
        mainToken,
        instanceId: 'same-main',
        snapshot: { protocolVersion: 1, revision: 1, settings: { marker: 'gen-2' } },
      });
      assert.equal(second.status, 200);
      assert.notEqual(first.data.generation, second.data.generation);

      // Old generation 1 snapshot push MUST be rejected with 403
      const oldUpdate = await post('/api/main/snapshot', {
        instanceId: 'same-main',
        generation: first.data.generation,
        snapshot: { protocolVersion: 1, revision: 51, settings: { marker: 'old-generation' } },
      });
      assert.equal(oldUpdate.status, 403);
      assert.equal(oldUpdate.data.error, 'unauthorized-generation');
      assert.equal(h.getMainSession().snapshot.settings.marker, 'gen-2');

      // Old generation 1 disconnect MUST be rejected with 403
      const oldDisconnect = await post('/api/main/disconnect', {
        instanceId: 'same-main',
        generation: first.data.generation,
      });
      assert.equal(oldDisconnect.status, 403);
      assert.equal(oldDisconnect.data.error, 'unauthorized-generation');
      assert.ok(h.getMainSession() !== null);
      assert.equal(h.getMainSession().instanceId, 'same-main');
      assert.equal(h.getMainSession().generation, second.data.generation);
    } finally {
      await h.stop();
    }
  }

  // -------------------------------------------------------------
  // G1-B: Async registration race: older registration does NOT overwrite newer registration
  // -------------------------------------------------------------
  {
    const began = defer(), release = defer();
    let closes = 0;
    const mainToken = 'g1-race-token';
    const h = createDetachableHttpHost({
      mainToken,
      windowAdapter: {
        spawn: async () => {
          began.resolve();
          await release.promise;
          return { id: 'owned-A' };
        },
        close: async () => { closes++; },
      },
    });
    await h.start();
    const base = h.getBaseUrl();
    const post = async (path, body) => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Main-Token': mainToken },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    };

    try {
      const regA = await post('/api/main/connect', { mainToken, instanceId: 'A' });
      const pendingDetach = post('/api/main/detach', { instanceId: 'A', generation: regA.data.generation });
      await began.promise;

      // Register B starts while A's detach spawn is waiting
      const registerB = post('/api/main/connect', { mainToken, instanceId: 'B' });
      for (let i = 0; i < 100 && h.getMainSession() !== null; i++) {
        await new Promise((r) => setTimeout(r, 2));
      }
      assert.equal(h.getMainSession(), null);

      // C arrives and registers as the active main session
      const registeredC = await post('/api/main/connect', { mainToken, instanceId: 'C' });
      assert.equal(registeredC.data.ok, true);
      assert.equal(h.getMainSession().instanceId, 'C');

      // Now release A's spawn and await pending detach and B's registration
      release.resolve();
      await pendingDetach;
      const lateB = await registerB;

      // Older registration B was superseded and must NOT overwrite C!
      assert.equal(lateB.data.ok, false);
      assert.equal(lateB.data.error, 'registration-superseded');
      assert.equal(h.getMainSession().instanceId, 'C');
    } finally {
      release.resolve();
      await h.stop();
    }
  }

  // -------------------------------------------------------------
  // G2: Window mode published accurately on close failure
  // -------------------------------------------------------------
  {
    let shouldFailClose = true;
    let closeAttempts = 0;
    const mainToken = 'g2-close-fail-token';
    const h = createDetachableHttpHost({
      mainToken,
      windowAdapter: {
        spawn: async () => ({ id: 'window-g2' }),
        close: async () => {
          closeAttempts++;
          if (shouldFailClose) throw new Error('window-close-hung');
        },
      },
    });
    await h.start();
    const base = h.getBaseUrl();

    try {
      const controller = createMockController();
      const client = createMainRendererBridgeClient({
        baseUrl: base,
        instanceId: 'main-g2',
        mainToken,
        controller,
      });
      await client.connect();

      // Detach window
      const d = await client.requestDetach();
      assert.equal(d.ok, true);

      // Companion connects -> Host mode becomes detached and notifies main renderer!
      const compTransport = createHttpCompanionTransport({
        baseUrl: base,
        token: d.token,
        instanceId: 'main-g2',
      });
      const compClient = createCompanionClient({
        token: d.token,
        instanceId: 'main-g2',
        transport: compTransport,
      });
      await compClient.connect();
      await new Promise((r) => setTimeout(r, 60)); // allow SSE to deliver mode update
      assert.equal(client.getMode(), 'detached', 'Main renderer reflects detached mode after companion connect');

      // Attempt dock when close fails
      shouldFailClose = true;
      const failedDock = await compClient.requestDock();
      assert.equal(failedDock.ok, false);
      assert.equal(failedDock.mode, 'docking');
      assert.equal(failedDock.unconfirmedCleanup, true);
      assert.equal(h.getMode(), 'docking');
      assert.equal(h.hasUnconfirmedCleanup(), true);

      await new Promise((r) => setTimeout(r, 60)); // allow SSE delivery
      assert.equal(client.getMode(), 'docking', 'Main renderer does NOT claim docked when close failed');
      assert.equal(client.hasUnconfirmedCleanup(), true);

      // Retry dock and succeed
      shouldFailClose = false;
      const successfulDock = await compClient.requestDock();
      assert.equal(successfulDock.ok, true);
      assert.equal(successfulDock.mode, 'docked');
      assert.equal(h.getMode(), 'docked');
      assert.equal(h.hasUnconfirmedCleanup(), false);

      await new Promise((r) => setTimeout(r, 60));
      assert.equal(client.getMode(), 'docked', 'Main renderer reflects docked after confirmed close');
      assert.equal(client.hasUnconfirmedCleanup(), false);

      await client.dispose();
    } finally {
      await h.stop();
    }
  }

  // -------------------------------------------------------------
  // G3: Host direct execution validates action schema & deduplication
  // -------------------------------------------------------------
  {
    let closes = 0;
    const mainToken = 'g3-schema-token';
    const h = createDetachableHttpHost({
      mainToken,
      windowAdapter: {
        spawn: async () => ({ id: 'window-g3' }),
        close: async () => { closes++; },
      },
    });
    await h.start();
    const base = h.getBaseUrl();
    const post = async (path, body) => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Main-Token': mainToken },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    };

    try {
      const reg = await post('/api/main/connect', {
        mainToken,
        instanceId: 'main-g3',
        snapshot: { protocolVersion: 1, revision: 10, settings: {} },
      });
      const d = await post('/api/main/detach', { instanceId: 'main-g3', generation: reg.data.generation });
      const auth = await fetch(`${base}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: d.data.token, instanceId: 'main-g3' }),
      }).then((r) => r.json());
      assert.equal(auth.ok, true);

      // Missing clientActionId and expectedRevision: REJECTED, closes remains 0
      const noSchemaRes = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': auth.leaseId },
        body: JSON.stringify({ action: { type: 'request-dock' } }),
      }).then((r) => r.json());
      assert.equal(noSchemaRes.ok, false);
      assert.equal(noSchemaRes.error, 'action-missing-client-id');
      assert.equal(closes, 0, 'No close triggered when clientActionId is missing');

      // Stale revision: REJECTED, closes remains 0
      const staleRes = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': auth.leaseId },
        body: JSON.stringify({
          action: { type: 'request-dock', clientActionId: 'dock-act-1', expectedRevision: 5 },
        }),
      }).then((r) => r.json());
      assert.equal(staleRes.ok, false);
      assert.equal(staleRes.error, 'stale-revision');
      assert.equal(closes, 0, 'No close triggered on stale revision');

      // Valid dock action: SUCCEEDS, closes becomes 1
      const validRes = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': auth.leaseId },
        body: JSON.stringify({
          action: { type: 'request-dock', clientActionId: 'dock-act-1', expectedRevision: 10 },
        }),
      }).then((r) => r.json());
      assert.equal(validRes.ok, true);
      assert.equal(validRes.mode, 'docked');
      assert.equal(closes, 1, 'Close executed on valid action');

      // Repeat with tampered revision: REJECTED, closes remains 1
      const tamperedRes = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': auth.leaseId },
        body: JSON.stringify({
          action: { type: 'request-dock', clientActionId: 'dock-act-1', expectedRevision: 999 },
        }),
      }).then((r) => r.json());
      assert.equal(tamperedRes.ok, false);
      assert.equal(tamperedRes.error, 'action-tampered-payload');
      assert.equal(closes, 1, 'No additional close on tampered replay');

      // Repeat with identical payload: cached result returned, closes remains 1
      const replayRes = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Whale-Lease': auth.leaseId },
        body: JSON.stringify({
          action: { type: 'request-dock', clientActionId: 'dock-act-1', expectedRevision: 10 },
        }),
      }).then((r) => r.json());
      assert.equal(replayRes.ok, true);
      assert.equal(replayRes.mode, 'docked');
      assert.equal(closes, 1, 'Identical replay returns cached result without second close');
    } finally {
      await h.stop();
    }
  }
});

test('15. Sixth Review H1/H2: Queue Boundaries, Stale Disconnect, and Obsolete Window Action Isolation', async () => {
  // Probe H1: Queued disconnect of stale main session does not terminate newer main session
  {
    let spawnGate = deferred();
    let spawns = 0;
    let closes = 0;
    const windowAdapter = {
      spawn: async () => {
        spawns++;
        await spawnGate.promise;
        return { pid: 1001 + spawns };
      },
      close: async () => {
        closes++;
      },
    };

    const host = createDetachableHttpHost({
      mainToken: 'tok-h1',
      windowAdapter,
    });
    await host.start();
    const base = `http://127.0.0.1:${host.getPort()}`;

    try {
      // 1. Client A registers
      const regA = await fetch(`${base}/api/main/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainToken: 'tok-h1', instanceId: 'inst-A' }),
      }).then((r) => r.json());
      assert.equal(regA.ok, true);
      assert.equal(regA.generation, 1);

      // 2. Client A starts detach (which waits on spawnGate)
      const detachPromiseA = fetch(`${base}/api/main/detach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h1',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({ instanceId: 'inst-A', generation: 1 }),
      }).then((r) => r.json());

      // 3. Client A queues a disconnect behind the pending detach
      const disconnectPromiseA = fetch(`${base}/api/main/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h1',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({ instanceId: 'inst-A', generation: 1 }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }));

      // 4. Client B attempts registration while A's detach is pending; it awaits cleanup
      const regPromiseB = fetch(`${base}/api/main/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainToken: 'tok-h1', instanceId: 'inst-B' }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }));

      // Give event loop tick so B enters connect
      await new Promise((r) => setTimeout(r, 20));

      // 5. Client C registers and takes over as the active main session (generation 2)
      const regC = await fetch(`${base}/api/main/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainToken: 'tok-h1', instanceId: 'inst-C' }),
      }).then((r) => r.json());
      assert.equal(regC.ok, true);
      assert.equal(regC.generation, 2);

      // 6. Release spawnGate so A's spawn and queued operations proceed
      spawnGate.resolve();

      await detachPromiseA;
      const disconnectResultA = await disconnectPromiseA;
      const regResultB = await regPromiseB;

      // B was superseded by C
      assert.equal(regResultB.status, 409);
      assert.equal(regResultB.data.error, 'registration-superseded');

      // A's queued disconnect must have failed with transition-superseded or 409
      assert.equal(disconnectResultA.data.ok, false);
      assert.equal(disconnectResultA.data.error, 'transition-superseded');

      // Assert Client C is STILL active and NOT disconnected!
      const snapC = await fetch(`${base}/api/main/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h1',
          'X-Whale-Generation': '2',
        },
        body: JSON.stringify({
          instanceId: 'inst-C',
          generation: 2,
          snapshot: { revision: 100, theme: 'abyss' },
        }),
      }).then((r) => r.json());
      assert.equal(snapC.ok, true, 'Client C session remains active despite A queued disconnect');
    } finally {
      spawnGate.resolve();
      await host.stop();
    }
  }

  // Probe H2: Obsolete window action in queue does not close newer window
  {
    let closeGate = deferred();
    let closeStarted = deferred();
    let spawns = 0;
    let closes = 0;
    const windowAdapter = {
      spawn: async () => {
        spawns++;
        return { pid: 2000 + spawns };
      },
      close: async () => {
        closes++;
        closeStarted.resolve();
        await closeGate.promise;
      },
    };

    const host = createDetachableHttpHost({
      mainToken: 'tok-h2',
      windowAdapter,
    });
    await host.start();
    const base = `http://127.0.0.1:${host.getPort()}`;

    try {
      // 1. Main connects
      const reg = await fetch(`${base}/api/main/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainToken: 'tok-h2', instanceId: 'inst-h2' }),
      }).then((r) => r.json());
      assert.equal(reg.ok, true);

      // 2. Publish initial snapshot (revision: 10)
      await fetch(`${base}/api/main/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h2',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({
          instanceId: 'inst-h2',
          generation: 1,
          snapshot: { revision: 10, theme: 'abyss' },
        }),
      });

      // 3. Detach window 1
      const detach1 = await fetch(`${base}/api/main/detach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h2',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({ instanceId: 'inst-h2', generation: 1 }),
      }).then((r) => r.json());
      assert.equal(detach1.ok, true);
      assert.equal(detach1.popupGeneration, 1);
      assert.equal(spawns, 1);

      // 4. Companion 1 connects
      const comp1 = await fetch(`${base}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: detach1.token, instanceId: 'inst-h2' }),
      }).then((r) => r.json());
      assert.equal(comp1.ok, true);
      const lease1 = comp1.leaseId;

      // 5. Main initiates dock (which enters close, deferred by closeGate)
      const mainDockPromise = fetch(`${base}/api/main/dock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h2',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({ instanceId: 'inst-h2', generation: 1 }),
      }).then((r) => r.json());

      // Wait until main dock has actually entered adapter.close and holds transition mutex
      await closeStarted.promise;

      // 6. Main now queues a new detach (Window 2) behind the closing window 1
      const mainDetachPromise = fetch(`${base}/api/main/detach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h2',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({ instanceId: 'inst-h2', generation: 1 }),
      }).then((r) => r.json());

      // Give event loop time so detach request arrives and queues behind dock
      await new Promise((r) => setTimeout(r, 20));

      // 7. Companion 1 also sends request-dock, which queues behind main detach
      const comp1DockPromise = fetch(`${base}/api/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Lease': lease1,
        },
        body: JSON.stringify({
          action: {
            type: 'request-dock',
            clientActionId: 'w1-dock-1',
            expectedRevision: 10,
          },
        }),
      }).then((r) => r.json());

      // Give event loop time so companion action arrives and queues behind detach
      await new Promise((r) => setTimeout(r, 20));

      // 8. Release closeGate so Window 1 finishes closing
      closeGate.resolve();

      const mainDockRes = await mainDockPromise;
      assert.equal(mainDockRes.ok, true);
      assert.equal(closes, 1);

      const mainDetachRes = await mainDetachPromise;
      assert.equal(mainDetachRes.ok, true);
      assert.equal(mainDetachRes.popupGeneration, 2);
      assert.equal(spawns, 2);

      // 9. When Companion 1's queued request-dock executes, it must NOT close Window 2!
      const comp1DockRes = await comp1DockPromise;
      assert.equal(comp1DockRes.ok, false);
      assert.ok(
        comp1DockRes.error === 'window-already-closed' || comp1DockRes.error === 'session-superseded',
        `Expected obsolete window rejection, got: ${comp1DockRes.error}`
      );
      assert.equal(closes, 1, 'Closes MUST remain 1, Window 2 must NOT be closed by obsolete request');
      assert.equal(host.getMode(), 'detaching', 'Host mode must remain detaching for Window 2');

      // 10. Also verify revision drift while queued: if expectedRevision drifts, rejected before execution
      const comp2 = await fetch(`${base}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mainDetachRes.token, instanceId: 'inst-h2' }),
      }).then((r) => r.json());
      assert.equal(comp2.ok, true);

      // Update revision from 10 to 11
      await fetch(`${base}/api/main/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': 'tok-h2',
          'X-Whale-Generation': '1',
        },
        body: JSON.stringify({
          instanceId: 'inst-h2',
          generation: 1,
          snapshot: { revision: 11, theme: 'abyss' },
        }),
      });

      // Send action with stale expected revision 10
      const staleDock = await fetch(`${base}/api/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Lease': comp2.leaseId,
        },
        body: JSON.stringify({
          action: {
            type: 'request-dock',
            clientActionId: 'w2-stale-dock',
            expectedRevision: 10,
          },
        }),
      }).then((r) => r.json());

      assert.equal(staleDock.ok, false);
      assert.equal(staleDock.error, 'stale-revision');
      assert.equal(closes, 1, 'Closes must remain 1 after stale revision rejection');
    } finally {
      closeGate.resolve();
      await host.stop();
    }
  }
});
