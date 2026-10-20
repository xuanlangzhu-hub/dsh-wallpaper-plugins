/**
 * Detachable Appearance P0: Full Headless Browser E2E Integration Proof (R6-C).
 *
 * Proves the true 3-party architecture in real headless Microsoft Edge:
 * 1. Browser Context 1 (Main DSH Renderer): Holds the authoritative controller (WhaleAppearanceController)
 *    and connects to Node Host via createMainRendererBridgeClient.
 * 2. Node Host: Loopback HTTP server (createDetachableHttpHost) managing endpoint security,
 *    token burning, capability lease binding, window adapter spec, and forwarding.
 * 3. Browser Context 2 (Companion Window): Standalone client (createCompanionClient +
 *    createHttpCompanionTransport) running 100% browser-native Web code with zero Node dependencies.
 *
 * Verifies:
 * - Live snapshot push from Main Renderer to Companion Window over loopback HTTP SSE.
 * - Restricted action dispatch from Companion Window modifying the real Main Renderer controller.
 * - Leases revoked on companion disconnect.
 * - Companion disables writes when Main Renderer disconnects / disposes.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createProfile, removeProfile } from './temp-profile.mjs';
import { createDetachableHttpHost } from '../src/detachable-host.js';

const qa = dirname(fileURLToPath(import.meta.url));
const clientJs = await readFile(join(qa, '../src/client.js'), 'utf8');
const harnessJs = await readFile(join(qa, 'appearance-harness.js'), 'utf8');
const contractJs = await readFile(join(qa, '../src/detachable-contract.js'), 'utf8');

const mainHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Main Renderer</title></head>
<body>
  <div id="root">Main Renderer</div>
  <script src="/harness.js"></script>
  <script src="/client.js"></script>
  <script>
    fixture.boot();
    window.mainController = fixture.controller;
    window.ready = true;
  </script>
</body>
</html>`;

const companionHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Companion Window</title></head>
<body>
  <div id="companion-root">Companion Window</div>
  <script>
    window.companionReady = true;
  </script>
</body>
</html>`;

// 1. Static asset server for browser contexts
const staticServer = createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url === '/main.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(mainHtml);
  } else if (url === '/companion.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(companionHtml);
  } else if (url === '/harness.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(harnessJs);
  } else if (url === '/client.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(clientJs);
  } else if (url === '/detachable-contract.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(contractJs);
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((r) => staticServer.listen(0, '127.0.0.1', r));
const staticPort = staticServer.address().port;

// 2. Node.js Detachable HTTP Host (Plugin Host process)
let spawnCount = 0;
let closeCount = 0;
const host = createDetachableHttpHost({
  port: 0,
  mainToken: 'secret-main-token',
  mainAllowedOrigins: [`http://127.0.0.1:${staticPort}`],
  companionAllowedOrigins: [`http://127.0.0.1:${staticPort}`],
  windowAdapter: {
    spawn: async (spec) => {
      spawnCount++;
      return { id: `window-${spawnCount}`, spec };
    },
    close: async (handle) => {
      closeCount++;
    },
  },
});
await host.start();
const hostPort = host.getPort();
const hostBaseUrl = host.getBaseUrl();

// 3. Launch isolated Headless Microsoft Edge
const profile = await createProfile('whale-detachable-browser-');
const browserProcess = spawn(
  process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--no-proxy-server',
    `http://127.0.0.1:${staticPort}/main.html`,
  ],
  { windowsHide: true, stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const pending = new Map();
  let id = 0;

  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const req = pending.get(msg.id);
    if (req) {
      pending.delete(msg.id);
      clearTimeout(req.timer);
      if (msg.error) req.reject(new Error(msg.error.message));
      else req.resolve(msg.result);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error(`CDP Timeout: ${method}`));
      }, 20000);
      pending.set(key, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: key, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  return { socket, send, evaluate };
}

try {
  let devToolsPort;
  for (let i = 0; i < 100; i++) {
    try {
      devToolsPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(devToolsPort, 'DevToolsActivePort found');

  // Discover Main Renderer Tab (Context 1)
  const pages = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`).then((r) => r.json());
  const mainPageInfo = pages.find((p) => p.url.includes('/main.html'));
  assert.ok(mainPageInfo, 'Main page found in browser');
  const mainTab = await createCdpClient(mainPageInfo.webSocketDebuggerUrl);

  // Wait for Main Renderer to boot
  for (let i = 0; i < 50; i++) {
    if (await mainTab.evaluate('Boolean(window.ready)')) break;
    await sleep(100);
  }

  // Set up Main Renderer Bridge Client in Context 1
  await mainTab.evaluate(`(async () => {
    const { createMainRendererBridgeClient } = await import('/detachable-contract.js');
    window.mainBridge = createMainRendererBridgeClient({
      baseUrl: '${hostBaseUrl}',
      instanceId: 'instance-whale-main',
      mainToken: 'secret-main-token',
      controller: window.mainController,
    });
    const connectRes = await window.mainBridge.connect();
    if (!connectRes.ok) throw new Error('main-connect-failed');
    window.detachRes = await window.mainBridge.requestDetach();
  })()`);

  const detachRes = await mainTab.evaluate('window.detachRes');
  assert.equal(detachRes.ok, true);
  assert.ok(detachRes.token, 'Token received for companion');

  // Open Companion Window Tab (Context 2)
  const newPageRes = await fetch(
    `http://127.0.0.1:${devToolsPort}/json/new?http://127.0.0.1:${staticPort}/companion.html`,
    { method: 'PUT' }
  ).then((r) => r.json());
  const companionTab = await createCdpClient(newPageRes.webSocketDebuggerUrl);

  // Wait for Companion Tab to be ready
  for (let i = 0; i < 50; i++) {
    if (await companionTab.evaluate('Boolean(window.companionReady)')) break;
    await sleep(100);
  }

  // Set up Companion Client in Context 2
  await companionTab.evaluate(`(async () => {
    const { createCompanionClient, createHttpCompanionTransport, DETACHABLE_ACTIONS } = await import('/detachable-contract.js');
    window.DETACHABLE_ACTIONS = DETACHABLE_ACTIONS;
    window.transport = createHttpCompanionTransport({
      baseUrl: '${hostBaseUrl}',
      token: '${detachRes.token}',
      instanceId: 'instance-whale-main',
    });
    window.client = createCompanionClient({
      token: '${detachRes.token}',
      instanceId: 'instance-whale-main',
      transport: window.transport,
    });
    window.connectRes = await window.client.connect();
  })()`);

  const companionConnectRes = await companionTab.evaluate('window.connectRes');
  assert.equal(companionConnectRes.ok, true);
  assert.ok(companionConnectRes.leaseId);

  // Initial value in both contexts is brightness 70
  const initialMainBrightness = await mainTab.evaluate('window.mainController.getSettingsSnapshot().brightness');
  const initialCompBrightness = await companionTab.evaluate('window.client.getSnapshot().settings.brightness');
  assert.equal(initialMainBrightness, 70);
  assert.equal(initialCompBrightness, 70);

  // -------------------------------------------------------------
  // Test 1: Main Renderer updates brightness -> pushed to Companion over loopback SSE
  // -------------------------------------------------------------
  await mainTab.evaluate('window.mainController.set("brightness", 110)');
  await sleep(150); // allow SSE transmission and DOM event loop
  const compBrightnessAfterMainUpdate = await companionTab.evaluate('window.client.getSnapshot().settings.brightness');
  assert.equal(compBrightnessAfterMainUpdate, 110, 'Companion received live snapshot update from Main Renderer');

  // -------------------------------------------------------------
  // Test 2: Companion Window dispatches restricted action -> updates Main Renderer controller
  // -------------------------------------------------------------
  const compActionResult = await companionTab.evaluate(`
    window.client.dispatch(window.DETACHABLE_ACTIONS.SET_SETTING, {
      key: 'brightness',
      value: 84,
    })
  `);
  assert.equal(compActionResult.ok, true);
  const mainBrightnessAfterCompAction = await mainTab.evaluate('window.mainController.getSettingsSnapshot().brightness');
  assert.equal(mainBrightnessAfterCompAction, 84, 'Main Renderer controller accepted and applied action from Companion');

  // -------------------------------------------------------------
  // Test 3: Stale revision defense (F1 probe)
  // Expected revision 1 rejected when latest revision is higher; controller NOT overwritten
  // -------------------------------------------------------------
  const staleRes = await companionTab.evaluate(`
    window.client.dispatch('set-setting', {
      key: 'brightness',
      value: 60,
      expectedRevision: 1,
      clientActionId: 'stale-remote-1'
    })
  `);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.error, 'stale-revision');
  const mainBrightnessAfterStale = await mainTab.evaluate('window.mainController.read().brightness');
  assert.equal(mainBrightnessAfterStale, 84, 'Controller brightness remained 84, not overwritten by stale revision');

  // -------------------------------------------------------------
  // Test 4: Deduplication with payload fingerprinting (F1 probe)
  // Same actionId with same payload returns cached duplicate: true; different payload returns mismatch
  // -------------------------------------------------------------
  const firstAction = await companionTab.evaluate(`
    window.client.dispatch('set-setting', {
      key: 'brightness',
      value: 80,
      clientActionId: 'same-id-remote'
    })
  `);
  assert.equal(firstAction.ok, true);
  assert.equal(await mainTab.evaluate('window.mainController.read().brightness'), 80);

  const tamperedAction = await companionTab.evaluate(`
    window.client.dispatch('set-setting', {
      key: 'brightness',
      value: 90,
      clientActionId: 'same-id-remote'
    })
  `);
  assert.equal(tamperedAction.ok, false);
  assert.equal(tamperedAction.error, 'action-payload-mismatch');
  assert.equal(
    await mainTab.evaluate('window.mainController.read().brightness'),
    80,
    'Controller was NOT updated by tampered duplicate'
  );

  const duplicateAction = await companionTab.evaluate(`
    window.client.dispatch('set-setting', {
      key: 'brightness',
      value: 80,
      clientActionId: 'same-id-remote'
    })
  `);
  assert.equal(duplicateAction.ok, true);
  assert.equal(duplicateAction.duplicate, true);

  // -------------------------------------------------------------
  // Test 5: Preset rejection transparency (F1 probe)
  // Removing missing preset returns transparent business error (preset-missing), not ok: true
  // -------------------------------------------------------------
  const presetReject = await companionTab.evaluate(`
    window.client.dispatch('remove-preset', {
      sceneId: 'lucy',
      clientActionId: 'remove-missing-remote'
    })
  `);
  assert.equal(presetReject.ok, false);
  assert.equal(presetReject.error, 'preset-missing');

  // -------------------------------------------------------------
  // Test 6: Idempotent detach (F2 probe)
  // Repeated detach requests do NOT spawn new windows or issue divergent tokens
  // -------------------------------------------------------------
  const repeatRes = await mainTab.evaluate(`
    Promise.all([window.mainBridge.requestDetach(), window.mainBridge.requestDetach()])
  `);
  assert.equal(spawnCount, 1, 'Repeat detach was idempotent; spawnCount remains 1');
  assert.equal(repeatRes[0].alreadyDetached, true);
  assert.equal(repeatRes[1].alreadyDetached, true);

  // -------------------------------------------------------------
  // Test 7: Companion requestDock() (F1 & F2 probe)
  // Dock transition closes window via windowAdapter and returns ok: true, mode: docked
  // -------------------------------------------------------------
  const dockRes = await companionTab.evaluate('window.client.requestDock()');
  assert.equal(dockRes.ok, true);
  assert.equal(dockRes.mode, 'docked');
  await sleep(100);
  assert.equal(closeCount, 1, 'Window close adapter invoked on dock');
  assert.equal(await mainTab.evaluate('window.mainBridge.getMode()'), 'docked');

  // -------------------------------------------------------------
  // Test 8: Re-detach and Companion disconnect window cleanup (F2 probe)
  // -------------------------------------------------------------
  const reDetach = await mainTab.evaluate('window.mainBridge.requestDetach()');
  assert.equal(reDetach.ok, true);
  assert.equal(spawnCount, 2);

  const reConnect = await companionTab.evaluate(`(async () => {
    const { createCompanionClient, createHttpCompanionTransport, DETACHABLE_ACTIONS } = await import('/detachable-contract.js');
    window.transport = createHttpCompanionTransport({
      baseUrl: '${hostBaseUrl}',
      token: '${reDetach.token}',
      instanceId: 'instance-whale-main',
    });
    window.client = createCompanionClient({
      token: '${reDetach.token}',
      instanceId: 'instance-whale-main',
      transport: window.transport,
    });
    return await window.client.connect();
  })()`);
  assert.equal(reConnect.ok, true);

  // Companion disconnects -> window closed
  await companionTab.evaluate('window.client.disconnect()');
  await sleep(100);
  assert.equal(closeCount, 2, 'Window closed on companion disconnect');

  // Replay fetch with old lease fails with 401
  const replayRes = await fetch(`${hostBaseUrl}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Whale-Lease': reConnect.leaseId,
    },
    body: JSON.stringify({
      action: {
        type: 'set-setting',
        key: 'brightness',
        value: 120,
        clientActionId: 'replay-1',
        expectedRevision: 3,
      },
    }),
  });
  assert.equal(replayRes.status, 401, 'Old lease rejected after disconnect');

  // -------------------------------------------------------------
  // Test 9: Unexpected Main Renderer Loss (navigate to about:blank) (F2 probe)
  // Re-detach, companion connects, then Main tab navigates to about:blank.
  // Host detects main lost: closes window (closeCount 3), companion lease returns 503,
  // companion marked disconnected.
  // -------------------------------------------------------------
  const reDetach3 = await mainTab.evaluate('window.mainBridge.requestDetach()');
  assert.equal(reDetach3.ok, true);
  assert.equal(spawnCount, 3);

  const reConnect3 = await companionTab.evaluate(`(async () => {
    const { createCompanionClient, createHttpCompanionTransport } = await import('/detachable-contract.js');
    window.transport = createHttpCompanionTransport({
      baseUrl: '${hostBaseUrl}',
      token: '${reDetach3.token}',
      instanceId: 'instance-whale-main',
    });
    window.client = createCompanionClient({
      token: '${reDetach3.token}',
      instanceId: 'instance-whale-main',
      transport: window.transport,
    });
    return await window.client.connect();
  })()`);
  assert.equal(reConnect3.ok, true);
  assert.equal(await companionTab.evaluate('window.client.isConnected()'), true);

  // Main tab suddenly navigates to about:blank (crash/loss simulation)
  await mainTab.send('Page.navigate', { url: 'about:blank' });
  for (let i = 0; i < 150; i++) {
    if (closeCount === 3) break;
    await sleep(100);
  }

  assert.equal(closeCount, 3, 'Window closed on unexpected main loss');
  const snapAfterLoss = await fetch(`${hostBaseUrl}/api/snapshot`, {
    headers: { 'X-Whale-Lease': reConnect3.leaseId },
  });
  assert.equal(snapAfterLoss.status, 503, 'Snapshot returns 503 after main loss');
  assert.equal(
    await companionTab.evaluate('window.client.isConnected()'),
    false,
    'Companion marked disconnected after main loss'
  );

  console.log(
    JSON.stringify(
      {
        status: 'PASSED',
        tests: [
          'Main Renderer (Browser Context 1) initialized real controller',
          'Companion Window (Browser Context 2) connected via loopback HTTP',
          'Live snapshot update from Main to Companion over SSE verified',
          'Action dispatch from Companion to Main controller verified',
          'Stale revision rejection (F1) verified: controller not overwritten',
          'Action deduplication & payload fingerprinting (F1) verified',
          'Preset error transparency (F1) verified: returns preset-missing',
          'Repeat detach idempotency (F2) verified: spawnCount preserved',
          'Companion requestDock() (F1/F2) verified: window closed, mode docked',
          'Companion disconnect (F2) verified: window closed, lease revoked (401)',
          'Unexpected Main loss (F2) verified: window closed, 503 returned, client disconnected',
        ],
        spawnCount,
        closeCount,
        browserProfile: profile,
      },
      null,
      2
    )
  );

  companionTab.socket.close();
} finally {
  browserProcess.kill('SIGKILL');
  await staticServer.close();
  await host.stop();
  try {
    await removeProfile(profile);
  } catch {}
}
