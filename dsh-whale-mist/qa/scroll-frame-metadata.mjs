// What does this browser actually put in a screencast frame's metadata?
//
// The protocol defines `timestamp` as `Network.TimeSinceEpoch` and offers an optional
// `monotonicTimestamp`. Guessing which fields exist here would repeat the mistake of the previous
// round, so this probe prints the raw metadata of the first frames together with the page's own clocks
// (`performance.timeOrigin` and `performance.now()`), which is what a calibrated conversion needs.
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

const qa = process.env.WM_QA_ROOT || dirname(fileURLToPath(import.meta.url));
const files = {
  '/client.js': await readFile(process.env.WM_CLIENT_SOURCE || join(qa, '../src/client.js')),
  '/harness.js': await readFile(join(qa, 'appearance-harness.js')),
  '/fixture.js': await readFile(join(qa, 'appearance-wallpaper-fixture.js')),
  '/host.css': await readFile(process.env.WM_OFFICIAL_CSS || join(qa, 'fixtures/conversation-host-rc2.css')),
};
const WIDTH = 900;
const HEIGHT = 700;
const COLUMN_LEFT = 160;

const server = createServer((req, res) => {
  if (files[req.url]) {
    res.writeHead(200, { 'content-type': req.url.endsWith('.css') ? 'text/css' : 'text/javascript', 'cache-control': 'no-store' });
    res.end(files[req.url]);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html data-windows-titlebar><head><link rel="stylesheet" href="/host.css"><style>
  html,body{margin:0;width:100%;height:100%} html{--dsh-windows-titlebar-height:32px} #root{position:fixed!important;inset:0}
  .BynINW_frame{height:100%;width:100%;box-sizing:border-box}
  .BynINW_sidebarCol{position:absolute;left:0;top:32px;bottom:0;width:${COLUMN_LEFT}px;background:rgb(20,30,45)}
  .BynINW_centerCol{position:absolute;left:${COLUMN_LEFT}px;right:0;top:32px;bottom:0}
  .Dc7zOa_root{height:100%}.Dc7zOa_header{height:60px;min-height:60px}
  .Dc7zOa_body{flex:1;min-height:0;display:flex;flex-direction:column}
  [data-slot="conversation.session"]{display:contents}
  .messages{display:flex;flex-direction:column;gap:14px;padding:16px 0}
  .message{height:10px;background:rgb(255,255,0);flex:none}
  .RlGAzG_card{width:72%;height:120px;box-sizing:border-box;border-radius:20px;align-self:center;background:rgb(8,11,20)}
  .composer-toolbar{height:40px;flex:none}.composer-footer{height:28px;flex:none}
  #wm-backdrop{background:magenta!important}.wm-backdrop-media{visibility:hidden!important}
  .wm-backdrop-mask{background:transparent!important} *{transition:none!important;animation:none!important}
  #probe-overlay{position:fixed;left:8px;top:8px;z-index:9999;font:16px monospace;color:#0ff;background:#000;padding:2px 6px}
  </style></head><body><main id="root"><div class="BynINW_frame">
  <div class="BynINW_sidebarCol"></div><div class="BynINW_centerCol"><div class="Dc7zOa_root" data-phase="active">
  <div class="Dc7zOa_header"></div><div class="Dc7zOa_body" data-content-phase="active" data-conversation-content>
  <div class="Dc7zOa_scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="Dc7zOa_viewArea">
  <div class="messages" id="messages"></div></div></div>
  <div class="Dc7zOa_composerSeat" data-composer-seat data-conversation-region="composer">
  <div class="composer-toolbar"></div><div class="RlGAzG_card"><textarea style="width:85%;height:60%;color:white;background:transparent" aria-label="draft"></textarea></div>
  <div class="composer-footer"></div></div></div></div></div></div></div></main>
  <div id="probe-overlay">boot</div>
  <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script>
  <script>
    const messages = document.getElementById('messages');
    for (let index = 0; index < 120; index += 1) { const row = document.createElement('div'); row.className = 'message'; messages.append(row); }
    // A visible marker of the current state: the scroll position as the page's own sampling sees it.
    // It is drawn inside the page, so a painted frame either shows the marker or does not.
    const overlay = document.getElementById('probe-overlay');
    window.__markers = [];
    (function paint() {
      requestAnimationFrame(paint);
      const scroll = document.querySelector('[data-conversation-scroll]');
      const now = performance.now();
      overlay.textContent = 'inner=' + Math.round(scroll.scrollTop) + ' t=' + Math.round(now);
      window.__markers.push({ at: Math.round(now * 10) / 10, scrollTop: Math.round(scroll.scrollTop) });
      if (window.__markers.length > 3000) window.__markers.shift();
    })();
    window.__frameProbe = { start() { window.__markers.length = 0; }, stop() { return { markers: window.__markers, timeOrigin: performance.timeOrigin, now: performance.now() }; } };
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await mkdtemp(join(tmpdir(), 'wm-meta-probe-'));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
const received = [];
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const page = pages.find(entry => entry.type === 'page' && entry.url === url);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(Error(`${method} timeout`)); }, 30000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.screencastFrame') {
      cdp('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {});
      received.push({ at: Date.now(), metadata: message.params.metadata, bytes: message.params.data.length });
      return;
    }
    const request = pending.get(message.id);
    if (request) { clearTimeout(request.timer); pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result); }
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  for (let attempt = 0; attempt < 50 && !await evaluate('Boolean(window.fixture?.boot && window.whaleModule)'); attempt++) await sleep(100);
  await evaluate(`(async () => {
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', palette: 'ocean', canvas: 'clear', background: 'wallpaper', weMode: 'daily', surface: 40 }));
    fixture.boot();
    await fixture.controller.wallpaper.start('lucy');
    await fixture.wait(() => document.body.dataset.wmBackdrop === 'wallpaper');
    return true;
  })()`);
  await sleep(200);
  await evaluate('window.__frameProbe.start()');
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
  await sleep(300);
  // A few scroll steps, so the marker's value changes while frames are being delivered.
  const nodeBefore = Date.now();
  for (let step = 0; step < 8; step += 1) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY: 160, modifiers: 0, pointerType: 'mouse' });
    await sleep(40);
  }
  const nodeAfter = Date.now();
  await sleep(200);
  await cdp('Page.stopScreencast');
  const clocks = await evaluate('window.__frameProbe.stop()');

  console.log('CLOCKS ' + JSON.stringify({
    timeOrigin: clocks.timeOrigin,
    nowAtStop: Math.round(clocks.now),
    markerCount: clocks.markers.length,
    firstMarker: clocks.markers[0],
    lastMarker: clocks.markers[clocks.markers.length - 1],
    markerScrollTops: [...new Set(clocks.markers.map(marker => marker.scrollTop))].slice(0, 12),
    nodeBefore, nodeAfter,
  }));
  console.log('METADATA-FIELDS ' + JSON.stringify([...new Set(received.flatMap(entry => Object.keys(entry.metadata || {})))]));
  for (const entry of received.slice(0, 5)) {
    console.log('FRAME ' + JSON.stringify({ receivedAtEpochMs: entry.at, bytes: entry.bytes, metadata: entry.metadata }));
  }
  console.log('FRAME-COUNT ' + received.length);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }).catch(() => {});
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
