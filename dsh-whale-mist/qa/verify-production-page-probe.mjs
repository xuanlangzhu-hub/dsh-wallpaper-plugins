import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createProfile, removeProfile } from './temp-profile.mjs';
import { createDetachableHttpHost } from '../src/detachable-host.js';

const clientJs = await readFile('src/client.js', 'utf8');
const harnessJs = await readFile('qa/appearance-harness.js', 'utf8');
const contractJs = await readFile('src/detachable-contract.js', 'utf8');

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

const staticServer = createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url === '/main.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(mainHtml);
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

let spawnCount = 0;
let closeCount = 0;
const host = createDetachableHttpHost({
  port: 0,
  mainToken: 'secret-main-token',
  allowedOrigins: [`http://127.0.0.1:${staticPort}`],
  windowAdapter: {
    spawn: async (spec) => {
      spawnCount++;
      return { id: `window-${spawnCount}`, spec, profileDir: spec.profileDir };
    },
    close: async () => {
      closeCount++;
      return { ok: true };
    },
  },
});
await host.start();
const hostBaseUrl = host.getBaseUrl();

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
      if (devToolsPort) break;
    } catch {
      await sleep(100);
    }
  }
  assert.ok(devToolsPort, 'DevToolsActivePort found');

  let pages;
  for (let i = 0; i < 30; i++) {
    try {
      pages = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`).then((r) => r.json());
      if (Array.isArray(pages) && pages.length > 0) break;
    } catch {
      await sleep(100);
    }
  }

  const mainPageInfo = pages.find((p) => p.url.includes('/main.html'));
  assert.ok(mainPageInfo, 'Main page found in browser');
  const mainTab = await createCdpClient(mainPageInfo.webSocketDebuggerUrl);

  for (let i = 0; i < 50; i++) {
    if (await mainTab.evaluate('Boolean(window.ready)')) break;
    await sleep(100);
  }

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

  const url = host.getActiveOwnedHandle().spec.appUrl;
  const info = await fetch(`http://127.0.0.1:${devToolsPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((r) => r.json());
  const companion = await createCdpClient(info.webSocketDebuggerUrl);

  let connected = false;
  for (let i = 0; i < 60; i++) {
    if (await companion.evaluate('document.getElementById("status-text")?.textContent==="已连接"')) {
      connected = true;
      break;
    }
    await sleep(100);
  }

  const before = await companion.evaluate('({status:document.getElementById("status-text")?.textContent,error:document.getElementById("error-banner")?.textContent,mask:document.getElementById("slider-mask")?.value,credentialsScrubbed:!location.search})');

  await companion.evaluate('(()=>{const e=document.getElementById("slider-brightness");e.value="95";e.dispatchEvent(new Event("input",{bubbles:true}));})()');
  let brightness;
  for (let i = 0; i < 40; i++) {
    brightness = await mainTab.evaluate('mainController.read().brightness');
    if (brightness === 95) break;
    await sleep(50);
  }

  await companion.evaluate('(()=>{const e=document.getElementById("slider-mask");e.value="0";e.dispatchEvent(new Event("input",{bubbles:true}));})()');
  let mask;
  for (let i = 0; i < 40; i++) {
    mask = await mainTab.evaluate('mainController.read().mask');
    if (mask === 0) break;
    await sleep(50);
  }

  const result = {
    productionPageConnected: connected,
    before,
    mainBrightness: brightness,
    mainMask: mask,
    realMainController: true,
    windowAdapterMocked: true,
    liveDSHUsed: false,
  };
  console.log(JSON.stringify(result, null, 2));

  companion.socket.close();
  mainTab.socket.close();
} finally {
  browserProcess.kill();
  await staticServer.close();
  await host.stop();
  try {
    await removeProfile(profile);
  } catch {}
}
