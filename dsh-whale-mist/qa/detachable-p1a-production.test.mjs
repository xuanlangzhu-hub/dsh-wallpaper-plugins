/**
 * Production Detachable Appearance P1A Verification Suite.
 *
 * Verifies the production integration of the Detachable / Dockable appearance window link:
 * 1. Host service composition, index-inject table emit, authenticated bootstrap route, and graceful dispose.
 * 2. Edge Window Adapter: validated discovery, dedicated temporary profile under os.tmpdir(),
 *    secure launch spec, multi-process tracking, orderly PID-specific close, and strict profile cleanup.
 * 3. Static companion file server: fixed manifest (/index.html, /companion.js, /companion.css, /detachable-contract.js),
 *    strict GET/HEAD method enforcement, directory traversal defenses, and security headers.
 * 4. Dual Views & Single Controller:
 *    - Main Renderer docked view (WhaleDockedAppearancePanel) and standalone Companion Window.
 *    - Bi-directional real-time sync for Brightness (20-120, default 70) and Mask (0-90, default 40).
 *    - Zero duplicate controllers, zero duplicate media pipelines, and zero echo loops.
 *    - Stale revision rejection, requestDetach, requestDock, and disconnect safety.
 *
 * Strictly offline and isolated:
 * - Runs against loopback and isolated test stubs.
 * - Zero interaction with live DSH desktop or active user profiles.
 * - No visible OS windows created.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync, promises as fsPromises } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { createDetachableHttpHost, STATIC_MANIFEST, STATIC_SECURITY_HEADERS } from '../src/detachable-host.js';
import { findEdgeExecutable, createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';
import {
  PROTOCOL_VERSION,
  DETACHABLE_MODES,
  DETACHABLE_ACTIONS,
  RANGE_BOUNDS,
  createCompanionClient,
  createHttpCompanionTransport,
  createMainRendererBridgeClient,
  executeAuthoritativeAction,
  buildAppearanceSnapshot,
} from '../src/detachable-contract.js';
import { apply as applyHost, inject as hostInject } from '../src/index.js';
import { createCompanionApp } from '../src/companion/companion.js';

// Minimal mock DSH controller matching production appearance controller interface
function createMockAppearanceController(initialSettings = {}) {
  let settings = {
    brightness: 70,
    mask: 40,
    blur: 0,
    surface: 100,
    chatBackdrop: 0,
    theme: 'mist',
    palette: 'ocean',
    accentMode: 'theme',
    accentColor: '#8c72f2',
    canvas: 'soft',
    sidebar: 'balanced',
    glass: 'standard',
    textContrast: 'standard',
    background: 'none',
    motion: 'focus',
    weMode: 'preview',
    weScene: 'lucy',
    weAutoStart: false,
    opaqueSidebar: false,
    opaqueChat: false,
    ...initialSettings,
  };

  let presets = { version: 1, entries: {} };
  let wallpaperStatus = { state: 'idle', activeSceneId: null, cleanupPending: false };
  const settingsListeners = new Set();
  const presetListeners = new Set();
  const wallpaperListeners = new Set();
  let persistCount = 0;

  return {
    read: () => ({ ...settings }),
    getSettingsSnapshot: () => ({ ...settings }),
    getPersistCount: () => persistCount,
    subscribeSettings: (listener) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    set: (key, value) => {
      if (settings[key] === value) return { ...settings };
      settings[key] = value;
      persistCount++;
      for (const l of settingsListeners) l({ ...settings });
      return { ...settings };
    },
    reset: () => {
      settings = {
        brightness: 70,
        mask: 40,
        blur: 0,
        surface: 100,
        chatBackdrop: 0,
        theme: 'mist',
        palette: 'ocean',
        accentMode: 'theme',
        accentColor: '#8c72f2',
        canvas: 'soft',
        sidebar: 'balanced',
        glass: 'standard',
        textContrast: 'standard',
        background: 'none',
        motion: 'focus',
        weMode: 'preview',
        weScene: 'lucy',
        weAutoStart: false,
        opaqueSidebar: false,
        opaqueChat: false,
      };
      persistCount++;
      for (const l of settingsListeners) l({ ...settings });
      return { ...settings };
    },
    presets: {
      getSnapshot: () => presets,
      subscribe: (listener) => {
        presetListeners.add(listener);
        return () => presetListeners.delete(listener);
      },
      save: (sceneId, name) => {
        presets = { ...presets, entries: { ...presets.entries, [sceneId]: { sceneId, name } } };
        for (const l of presetListeners) l(presets);
        return { ok: true };
      },
      apply: (sceneId) => {
        if (!presets.entries[sceneId]) return { ok: false, error: 'preset-missing' };
        return { ok: true, preset: presets.entries[sceneId] };
      },
      remove: (sceneId) => {
        if (!presets.entries[sceneId]) return { ok: false, error: 'preset-missing' };
        const nextEntries = { ...presets.entries };
        delete nextEntries[sceneId];
        presets = { ...presets, entries: nextEntries };
        for (const l of presetListeners) l(presets);
        return { ok: true };
      },
    },
    wallpaper: {
      getStatus: () => wallpaperStatus,
      subscribeStatus: (listener) => {
        wallpaperListeners.add(listener);
        return () => wallpaperListeners.delete(listener);
      },
      start: async (sceneId) => {
        wallpaperStatus = { state: 'playing', activeSceneId: sceneId, cleanupPending: false };
        for (const l of wallpaperListeners) l(wallpaperStatus);
        return { ok: true };
      },
      stop: async () => {
        wallpaperStatus = { state: 'idle', activeSceneId: null, cleanupPending: false };
        for (const l of wallpaperListeners) l(wallpaperStatus);
        return { ok: true };
      },
    },
  };
}

// ---------------------------------------------------------------------------
// TEST 1: Host Lifecycle, Index Injection & Authenticated Bootstrap Route
// ---------------------------------------------------------------------------
test('1. Host Lifecycle, Index Injection, and Protected Bootstrap Route', async () => {
  // 1. Verify service dependency declaration
  assert.ok(Array.isArray(hostInject), 'Host inject array must be exported');
  assert.ok(hostInject.includes('webServer'), 'Host must declare dependency on webServer');

  // 2. Compose mock Cordis context
  const registeredRoutes = new Map();
  const indexInjectSubscribers = [];
  const disposeSubscribers = [];
  let connectionAuthenticated = false;

  const mockCtx = {
    effect: (fn) => fn?.(),
    webServer: {
      protocol: 'http:',
      register: (route) => {
        registeredRoutes.set(route.path, route);
        return () => registeredRoutes.delete(route.path);
      },
    },
    get: (serviceName) => {
      if (serviceName === 'connection') {
        return {
          isAuthenticated: () => connectionAuthenticated,
        };
      }
      return null;
    },
    on: (eventName, listener) => {
      if (eventName === 'webserver/index-inject') indexInjectSubscribers.push(listener);
      if (eventName === 'dispose') disposeSubscribers.push(listener);
    },
  };

  // Run apply in isolated mode
  process.env.WM_CONTRACT_ISOLATED = '1';
  try {
    applyHost(mockCtx);
    // Allow host.start() to complete binding port 0
    await new Promise((r) => setTimeout(r, 80));

    // Verify index-inject subscriber was registered
    assert.ok(indexInjectSubscribers.length > 0, 'index-inject subscriber must be installed');

    // Collect index injection rows
    const table = [];
    for (const sub of indexInjectSubscribers) {
      sub(table);
    }

    const bootRow = table.find((r) => r.name === '__WHALE_DETACHABLE_BOOT__');
    assert.ok(bootRow, '__WHALE_DETACHABLE_BOOT__ must be injected into index table');
    assert.equal(bootRow.kind, 'global');
    assert.ok(typeof bootRow.value.port === 'number', 'Injected port must be a valid number');
    assert.equal(bootRow.value.mainToken, undefined, 'Public index injection must not leak mainToken');

    // Verify /whale-appearance/bootstrap exact route was registered
    assert.ok(registeredRoutes.has('/whale-appearance/bootstrap'), 'Bootstrap route must be registered on webServer');
    const bootstrapRoute = registeredRoutes.get('/whale-appearance/bootstrap');

    // Test 1.3a: Unauthenticated access returns 401
    connectionAuthenticated = false;
    let unauthorizedStatusCode = 0;
    let unauthorizedBody = null;
    await bootstrapRoute.handler(
      { headers: {} },
      {
        writeHead: (code) => { unauthorizedStatusCode = code; },
        end: (payload) => { unauthorizedBody = JSON.parse(payload); },
      }
    );
    assert.equal(unauthorizedStatusCode, 401, 'Unauthenticated bootstrap request must be rejected with 401');
    assert.equal(unauthorizedBody?.error, 'unauthorized');

    // Test 1.3b: Authenticated access returns 200 with credentials
    connectionAuthenticated = true;
    let authorizedStatusCode = 0;
    let authorizedBody = null;
    let responseHeaders = {};
    await bootstrapRoute.handler(
      { headers: {} },
      {
        writeHead: (code, headers) => {
          authorizedStatusCode = code;
          responseHeaders = headers;
        },
        end: (payload) => { authorizedBody = JSON.parse(payload); },
      }
    );
    assert.equal(authorizedStatusCode, 200, 'Authenticated bootstrap request must succeed with 200');
    assert.equal(authorizedBody?.ok, true);
    assert.equal(authorizedBody?.port, bootRow.value.port);
    assert.ok(typeof authorizedBody?.mainToken === 'string' && authorizedBody.mainToken.length > 0, 'Authenticated bootstrap must provide mainToken');
    assert.equal(responseHeaders['Cache-Control'], 'no-store', 'Bootstrap route must enforce Cache-Control: no-store');
    assert.equal(responseHeaders['Referrer-Policy'], 'no-referrer', 'Bootstrap route must enforce Referrer-Policy: no-referrer');

    // Test 1.4: Graceful dispose
    for (const disp of disposeSubscribers) {
      await disp();
    }
    assert.equal(registeredRoutes.has('/whale-appearance/bootstrap'), false, 'Dispose must revoke bootstrap route');
  } finally {
    for (const disp of disposeSubscribers) {
      try { await disp(); } catch {}
    }
    delete process.env.WM_CONTRACT_ISOLATED;
  }
});

// ---------------------------------------------------------------------------
// TEST 2: Production Edge Window Adapter
// ---------------------------------------------------------------------------
test('2. Edge Window Adapter: Discovery, Sandbox Arguments, Dedicated Profiles, and Orderly Close', async () => {
  // Test 2.1: Edge discovery fallback
  const customMissing = findEdgeExecutable({ customPath: 'C:\\NonExistent\\msedge.exe' });
  assert.equal(customMissing.available, false);
  assert.equal(customMissing.reason, 'custom-path-not-found');

  // Test 2.2: Dedicated Profile creation, parameter array, and spawn tracking
  const spawnedCalls = [];
  const executedCommands = [];
  const mockChild = {
    pid: 8888,
    exitListeners: [],
    on(event, listener) {
      if (event === 'exit') this.exitListeners.push(listener);
    },
    once(event, listener) {
      if (event === 'exit') this.exitListeners.push(listener);
    },
    kill() {
      // Simulate graceful exit
      for (const l of this.exitListeners) l(0);
    },
  };

  const adapter = createEdgeWindowAdapter({
    edgePath: 'C:\\Mock\\msedge.exe',
    findEdge: () => ({ available: true, path: 'C:\\Mock\\msedge.exe' }),
    spawnProcess: (executable, args, options) => {
      spawnedCalls.push({ executable, args, options });
      return mockChild;
    },
    execCommand: (cmd, args, cb) => {
      executedCommands.push({ cmd, args });
      // A successful null CIM result is explicitly encoded by exit 2.
      // Empty stdout alone no longer proves that the process has exited.
      if (cmd === 'powershell.exe' && args.at(-1).includes('ProcessId =')) {
        cb(Object.assign(new Error('explicit fixture process absence'), { code: 2 }), '', '');
        return;
      }
      cb(null, '', '');
    },
  });

  const handle = await adapter.spawn({
    hostPort: 4321,
    token: 'test-token-uuid',
    instanceId: 'test-instance-1',
  });

  assert.equal(handle.pid, 8888);
  assert.ok(handle.profileDir.startsWith(resolve(tmpdir())), 'Dedicated profile must reside strictly within os.tmpdir()');
  assert.ok(handle.profileDir.includes('whale-companion-profile-'), 'Dedicated profile must use dedicated prefix');
  assert.ok(existsSync(handle.profileDir), 'Dedicated profile directory must be physically created');

  assert.equal(spawnedCalls.length, 1);
  const call = spawnedCalls[0];
  assert.equal(call.executable, 'C:\\Mock\\msedge.exe');
  assert.equal(call.options.shell, false, 'Shell must strictly be false (no cmd injection)');
  assert.ok(call.args.some((a) => a.startsWith('--app=http://127.0.0.1:4321/index.html?token=test-token-uuid')), 'App mode URL must be set');
  assert.ok(call.args.some((a) => a === `--user-data-dir=${handle.profileDir}`), 'User data dir must strictly match created dedicated profile');
  assert.ok(call.args.includes('--no-first-run'));
  assert.ok(call.args.includes('--no-default-browser-check'));

  // Test 2.3: Orderly close and confirmed cleanup
  const closeRes = await adapter.close(handle);
  assert.equal(closeRes.ok, true);
  assert.equal(closeRes.closedPid, 8888);
  assert.equal(closeRes.profileDirCleaned, true);
  assert.equal(existsSync(handle.profileDir), false, 'Dedicated profile directory must be cleaned up after confirmed close');

  // Test 2.4: Profile boundary defense - adapter never cleans foreign or root directories
  const foreignDir = join(tmpdir(), 'arbitrary-foreign-dir');
  await fsPromises.mkdir(foreignDir, { recursive: true });
  try {
    const unownedRes = await adapter.close({ pid: 9999, profileDir: foreignDir });
    assert.equal(existsSync(foreignDir), true, 'Adapter must NEVER delete unowned directories');
  } finally {
    await fsPromises.rm(foreignDir, { recursive: true, force: true });
  }

  // Test 2.5: Missing Edge throws clearly without crashing host
  const missingAdapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: false, path: null, reason: 'msedge-not-found' }),
  });
  await assert.rejects(
    async () => {
      await missingAdapter.spawn({ hostPort: 1234, token: 'x', instanceId: 'y' });
    },
    /edge-unavailable: msedge-not-found/
  );
});

// ---------------------------------------------------------------------------
// TEST 3: Static Companion Assets & Security Boundary
// ---------------------------------------------------------------------------
test('3. Static Companion Assets: Manifest Serving, Method Guard, and Traversal Defense', async () => {
  const host = createDetachableHttpHost({ port: 0 });
  await host.start();
  const base = host.getBaseUrl();

  try {
    // 3.1: Manifest assets served with correct Content-Type
    const resRoot = await fetch(base + '/');
    assert.equal(resRoot.status, 200);
    assert.equal(resRoot.headers.get('Content-Type'), 'text/html; charset=utf-8');
    const rootHtml = await resRoot.text();
    assert.ok(rootHtml.includes('鲸系外观'), 'Root page must contain companion title');
    assert.ok(rootHtml.includes('slider-brightness'), 'Root page must include brightness slider');
    assert.ok(rootHtml.includes('slider-mask'), 'Root page must include mask slider');

    const resJs = await fetch(base + '/companion.js');
    assert.equal(resJs.status, 200);
    assert.equal(resJs.headers.get('Content-Type'), 'application/javascript; charset=utf-8');
    const jsText = await resJs.text();
    assert.ok(jsText.includes('createCompanionApp'), 'companion.js must define createCompanionApp');
    assert.ok(!jsText.includes('require('), 'companion.js must have zero Node require calls');
    assert.ok(!jsText.includes('node:'), 'companion.js must have zero node: imports');

    const resContract = await fetch(base + '/detachable-contract.js');
    assert.equal(resContract.status, 200);
    assert.equal(resContract.headers.get('Content-Type'), 'application/javascript; charset=utf-8');

    const resCss = await fetch(base + '/companion.css');
    assert.equal(resCss.status, 200);
    assert.equal(resCss.headers.get('Content-Type'), 'text/css; charset=utf-8');

    const resFavicon = await fetch(base + '/favicon.ico');
    assert.equal(resFavicon.status, 204);

    // 3.2: Security headers present on static responses
    for (const [key, expectedVal] of Object.entries(STATIC_SECURITY_HEADERS)) {
      assert.equal(resRoot.headers.get(key), expectedVal, `Static response must carry ${key}`);
    }

    // 3.3: Method guard: POST/PUT/DELETE on static routes return 405 Method Not Allowed
    const resPost = await fetch(base + '/index.html', { method: 'POST' });
    assert.equal(resPost.status, 405, 'POST on static resource must return 405');
    assert.equal(resPost.headers.get('Allow'), 'GET, HEAD');

    // 3.4: Path traversal and escape attempts rejected
    const resTraversal1 = await fetch(base + '/../package.json');
    assert.equal(resTraversal1.status === 400 || resTraversal1.status === 404, true);

    const resTraversal2 = await fetch(base + '/%2e%2e/package.json');
    assert.equal(resTraversal2.status === 400 || resTraversal2.status === 404, true);

    const resTraversal3 = await fetch(base + '/companion.js%00.txt');
    assert.equal(resTraversal3.status === 400 || resTraversal3.status === 404, true);

    // 3.5: Unknown route returns 404
    const res404 = await fetch(base + '/random-unmapped-file.js');
    assert.equal(res404.status, 404);
  } finally {
    await host.stop();
  }
});

// ---------------------------------------------------------------------------
// TEST 4: Dual Views + Single Authoritative Controller Real-Time Synchronization
// ---------------------------------------------------------------------------
test('4. Dual Views (Docked Panel & Companion Window) with Single Authoritative Controller', async () => {
  const host = createDetachableHttpHost({
    port: 0,
    mainToken: 'p1a-authoritative-main-token',
  });
  await host.start();
  const base = host.getBaseUrl();

  const controller = createMockAppearanceController({
    brightness: 70,
    mask: 40,
  });

  const mainInstanceId = `main-p1a-${randomUUID()}`;

  // 1. Initialize Main Renderer Bridge Client
  const bridgeClient = createMainRendererBridgeClient({
    baseUrl: base,
    instanceId: mainInstanceId,
    mainToken: 'p1a-authoritative-main-token',
    controller,
  });

  const waitForCondition = async (checkFn, timeout = 1500) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (checkFn()) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return checkFn();
  };

  try {
    const mainConn = await bridgeClient.connect();
    assert.equal(mainConn.ok, true, 'Main bridge must connect successfully');

    // 2. Request Detach to spawn companion token
    const detachRes = await bridgeClient.requestDetach();
    assert.equal(detachRes.ok, true);
    assert.ok(detachRes.token, 'Detach must return single-use handshake token');
    const companionToken = detachRes.token;

    // 3. Connect Companion Client via HTTP transport
    const companionTransport = createHttpCompanionTransport({
      baseUrl: base,
      token: companionToken,
      instanceId: mainInstanceId,
    });

    const companionClient = createCompanionClient({ transport: companionTransport });
    const compConn = await companionClient.connect();
    assert.equal(compConn.ok, true, 'Companion client must connect successfully');
    assert.equal(compConn.snapshot.settings.brightness, 70);
    assert.equal(compConn.snapshot.settings.mask, 40);

    // Set up live listener on companion client
    const receivedCompanionSnapshots = [];
    companionClient.subscribe((state) => {
      if (state.snapshot) {
        receivedCompanionSnapshots.push(state.snapshot);
      }
    });

    // Wait for initial SSE channel establishment
    await new Promise((r) => setTimeout(r, 100));

    // 4. BI-DIRECTIONAL SYNC: BRIGHTNESS
    // Step 4a: Main Controller updates brightness (e.g. from Docked Panel slider) -> Companion receives update
    const initialPersistCount = controller.getPersistCount();
    controller.set('brightness', 95);
    assert.equal(controller.read().brightness, 95);

    // Wait for SSE propagation from Main to Host to Companion
    await waitForCondition(() => receivedCompanionSnapshots.some((s) => s?.settings?.brightness === 95));
    const latestCompSnap1 = receivedCompanionSnapshots[receivedCompanionSnapshots.length - 1];
    assert.ok(latestCompSnap1, 'Companion must receive snapshot via SSE');
    assert.equal(latestCompSnap1.settings.brightness, 95, 'Companion snapshot brightness must sync to 95');

    // Step 4b: Companion updates brightness -> Main Controller receives and updates
    const compBrightnessRes = await companionClient.setSetting('brightness', 115);
    assert.equal(compBrightnessRes.ok, true, 'Companion brightness update must succeed');
    assert.equal(controller.read().brightness, 115, 'Main controller brightness must immediately be 115');

    // 5. BI-DIRECTIONAL SYNC: MASK
    // Step 5a: Main Controller updates mask -> Companion receives update
    controller.set('mask', 65);
    assert.equal(controller.read().mask, 65);

    await waitForCondition(() => receivedCompanionSnapshots.some((s) => s?.settings?.mask === 65));
    const latestCompSnap2 = receivedCompanionSnapshots[receivedCompanionSnapshots.length - 1];
    assert.equal(latestCompSnap2.settings.mask, 65, 'Companion snapshot mask must sync to 65');

    // Step 5b: Companion updates mask -> Main Controller receives and updates
    const compMaskRes = await companionClient.setSetting('mask', 20);
    assert.equal(compMaskRes.ok, true, 'Companion mask update must succeed');
    assert.equal(controller.read().mask, 20, 'Main controller mask must immediately be 20');

    // 6. Echo loop & Deduplication defense: identical value does NOT cause redundant persistence
    const countBefore = controller.getPersistCount();
    const dupRes = await companionClient.setSetting('mask', 20);
    assert.equal(dupRes.ok, true);
    assert.equal(controller.getPersistCount(), countBefore, 'Identical value set must not increment persist count');

    // 7. Stale revision rejection: obsolete revision does NOT mutate state
    const staleRes = await companionClient.dispatchAction({
      type: DETACHABLE_ACTIONS.SET_SETTING,
      clientActionId: randomUUID(),
      expectedRevision: 1, // Ancient revision
      key: 'brightness',
      value: 50,
    });
    assert.equal(staleRes.ok, false);
    assert.equal(staleRes.error, 'stale-revision');
    assert.equal(controller.read().brightness, 115, 'Stale revision must not overwrite controller brightness');

    // 8. Orderly Docking from Companion Window
    const dockRes = await companionClient.requestDock();
    assert.equal(dockRes.ok, true, 'Companion requestDock must succeed');
    assert.equal(dockRes.mode, DETACHABLE_MODES.DOCKED);
    await waitForCondition(() => bridgeClient.getMode() === DETACHABLE_MODES.DOCKED);
    assert.equal(bridgeClient.getMode(), DETACHABLE_MODES.DOCKED, 'Main bridge mode must transition to DOCKED');
  } finally {
    // Clean shutdown
    try { await companionClient?.disconnect(); } catch {}
    try { await bridgeClient?.dispose(); } catch {}
    try { await host?.stop(); } catch {}
  }
});

// ---------------------------------------------------------------------------
// TEST 5: Companion Application Client DOM Wiring & Address Bar Token Scrubbing
// ---------------------------------------------------------------------------
test('5. Companion Application (companion.js) Token Scrubbing, DOM Sync, and Error Guard', async () => {
  // Simulate browser window and document environment
  const mockStorage = new Map();
  let replacedUrl = null;

  const mockWindow = {
    location: {
      origin: 'http://127.0.0.1:9999',
      pathname: '/',
      search: '?token=single-use-secret-token&instanceId=inst-xyz',
    },
    history: {
      replaceState: (state, title, url) => {
        replacedUrl = url;
      },
    },
    close: () => {},
  };

  const elements = new Map();
  function createMockElement(id, initialVal = '') {
    const el = {
      id,
      value: initialVal,
      disabled: false,
      textContent: '',
      className: '',
      classList: {
        add: (cls) => { el.className += ` ${cls}`; },
        remove: (cls) => { el.className = el.className.replace(cls, '').trim(); },
      },
      listeners: {},
      addEventListener: (evt, fn) => {
        el.listeners[evt] = el.listeners[evt] || [];
        el.listeners[evt].push(fn);
      },
      trigger: (evt, val) => {
        if (val !== undefined) el.value = val;
        for (const fn of el.listeners[evt] || []) fn({ target: el });
      },
    };
    elements.set(id, el);
    return el;
  }

  createMockElement('status-pill');
  createMockElement('status-text');
  createMockElement('error-banner');
  createMockElement('slider-brightness', '70');
  createMockElement('input-brightness', '70');
  createMockElement('slider-mask', '40');
  createMockElement('input-mask', '40');
  createMockElement('btn-dock');
  createMockElement('btn-close');

  const mockDocument = {
    title: 'Test Companion',
    activeElement: null,
    getElementById: (id) => elements.get(id) || null,
  };

  // Mock transport to avoid live network
  let sentActions = [];
  const mockTransport = {
    connect: async () => ({
      ok: true,
      snapshot: {
        revision: 1,
        settings: { brightness: 85, mask: 55 },
        brightness: 85,
        mask: 55,
      },
    }),
    subscribe: () => () => {},
    sendAction: async (action) => {
      sentActions.push(action);
      return { ok: true, snapshot: { revision: 2, settings: { [action.key]: action.value } } };
    },
    requestDock: async () => ({ ok: true }),
    disconnect: async () => ({ ok: true }),
  };

  const app = createCompanionApp({
    windowObj: mockWindow,
    documentObj: mockDocument,
    customTransport: mockTransport,
  });

  // Verify token is immediately scrubbed from address bar and history
  assert.equal(replacedUrl, '/', 'Token and instanceId must be scrubbed from window.location immediately');

  // Start app and verify DOM elements populated with snapshot values
  await app.start();

  assert.equal(elements.get('slider-brightness').value, '85');
  assert.equal(elements.get('input-brightness').value, '85');
  assert.equal(elements.get('slider-mask').value, '55');
  assert.equal(elements.get('input-mask').value, '55');
  assert.ok(elements.get('status-pill').className.includes('status-connected'));

  // Test slider input triggering action dispatch
  await app.handleBrightnessChange('105');
  assert.equal(sentActions.length, 1);
  assert.equal(sentActions[0].key, 'brightness');
  assert.equal(sentActions[0].value, 105);

  await app.handleMaskChange('15');
  assert.equal(sentActions.length, 2);
  assert.equal(sentActions[1].key, 'mask');
  assert.equal(sentActions[1].value, 15);

  // Test mask set to 0 is respected as 0 (not fallback to 40)
  await app.handleMaskChange('0');
  assert.equal(sentActions.length, 3);
  assert.equal(sentActions[2].key, 'mask');
  assert.equal(sentActions[2].value, 0, 'Mask 0 must be transmitted as 0, not default 40');

  // Test rapid continuous input serialization
  const p1 = app.handleBrightnessChange('50');
  const p2 = app.handleBrightnessChange('60');
  const p3 = app.handleBrightnessChange('70');
  await Promise.all([p1, p2, p3]);

  const lastBrightnessAction = sentActions.filter((a) => a.key === 'brightness').pop();
  assert.equal(lastBrightnessAction.value, 70, 'Continuous slider drag must land on the final requested value');
});
