import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { FrameHub, streamFrames } from './frame-hub.js';

const hub = new FrameHub(), client = await readFile(new URL('client.js', import.meta.url));
const themeClient = await readFile(new URL('../../src/client.js', import.meta.url));
const themeHarness = await readFile(new URL('../appearance-harness.js', import.meta.url));
let metrics = {}, activeStreams = 0;
const server = createServer(async (req, res) => {
  if (req.url === '/client.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(client); return; }
  if (req.url === '/theme.js' || req.url === '/theme-harness.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(req.url === '/theme.js' ? themeClient : themeHarness); return;
  }
  if (req.url === '/whale-wallpaper-probe/stream') {
    if (!hub.latest || hub.closed) { res.writeHead(503); res.end(); return; }
    activeStreams++; res.once('close', () => activeStreams--); streamFrames(hub, res); return;
  }
  if (req.url === '/whale-wallpaper-probe/metrics') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    metrics = JSON.parse(Buffer.concat(chunks)); res.writeHead(204); res.end(); return;
  }
  if (req.url === '/whale-wallpaper-probe/stop') { hub.close(); res.writeHead(204); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><style>
    #root { position:fixed; inset:0; background:var(--dsw-alias-bg-base); }
    #fixture-primary { background:var(--dsw-alias-bg-primary); }
    #fixture-card { background:var(--dsw-alias-bg-layer-1); }
    #fixture-composer { background:var(--dsw-specific-input-major); }
    </style></head><body><main id="root">Isolated stream renderer test
    <div id="fixture-primary">Primary</div><div id="fixture-card">Card</div>
    <div id="fixture-composer">Composer</div></main>
    <script src="/theme-harness.js"></script><script src="/theme.js"></script>
    <script>fixture.boot();window.__ModuleLoader__={load({factory}){factory().apply({effect(fn){window.disposeProbe=fn()}})}};</script>
    <script src="/client.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'whale-stream-qa-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--no-proxy-server', origin,
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, timer, nextId = 0;
const pending = new Map();
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); } }
  assert.ok(port);
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  socket = new WebSocket(pages.find(p => p.type === 'page' && p.url.startsWith(origin)).webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data), request = pending.get(value.id);
    if (request) { pending.delete(value.id); clearTimeout(request.timeout); value.error ? request.reject(new Error(value.error.message)) : request.resolve(value.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId, timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const colors = await evaluate(`['#204080','#805020'].map(color=>{const c=document.createElement('canvas');c.width=64;c.height=36;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,64,36);return c.toDataURL('image/jpeg').split(',')[1]})`);
  const frames = colors.map(color => Buffer.from(color, 'base64'));
  let sequence = 0;
  timer = setInterval(() => {
    const jpeg = frames[sequence % 2], packet = Buffer.alloc(24 + jpeg.length); packet.write('WHL1');
    packet.writeUInt32LE(++sequence, 4); packet.writeUInt32LE(jpeg.length, 8); packet.writeBigInt64LE(BigInt(Date.now()), 12);
    packet.writeUInt16LE(64, 20); packet.writeUInt16LE(36, 22); jpeg.copy(packet, 24);
    // Exercise framing splits on an actual HTTP body as well as the unit-level decoder.
    hub.push(packet.subarray(0, 13)); hub.push(packet.subarray(13));
  }, 33);
  let visible;
  for (let i = 0; i < 80; i++) {
    visible = await evaluate(`(()=>{const c=document.getElementById('whale-wallpaper-probe-frame');return {active:document.body.classList.contains('wm-wallpaper-probe-live'),frames:Number(c?.dataset.receivedFrames||0),pixel:c?[...c.getContext('2d').getImageData(0,0,1,1).data]:[]}})()`);
    if (visible.active && visible.frames >= 25 && metrics.rendered >= 20) break;
    await delay(100);
  }
  assert.equal(visible.active, true); assert.ok(visible.frames >= 25); assert.ok(metrics.rendered >= 20); assert.equal(metrics.decodeErrors, 0);
  assert.ok(visible.pixel[0] > 20 && visible.pixel[3] === 255, 'real JPEG decoded and painted');
  for (const theme of ['abyss', 'mist']) {
    for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
      for (const canvas of ['soft', 'clear']) {
        const surfaces = await evaluate(`(() => {
          fixture.controller.set('theme', ${JSON.stringify(theme)});
          fixture.controller.set('palette', ${JSON.stringify(palette)});
          fixture.controller.set('canvas', ${JSON.stringify(canvas)});
          fixture.controller.set('glass', 'restrained');
          fixture.controller.set('sidebar', 'deep');
          return {
            base: getComputedStyle(document.getElementById('root')).backgroundColor,
            primary: getComputedStyle(document.getElementById('fixture-primary')).backgroundColor,
            card: getComputedStyle(document.getElementById('fixture-card')).backgroundColor,
            composer: getComputedStyle(document.getElementById('fixture-composer')).backgroundImage,
            pointerEvents: getComputedStyle(document.getElementById('whale-wallpaper-probe-frame')).pointerEvents,
          };
        })()`);
        const combination = `${theme}/${palette}/${canvas}`;
        assert.equal(surfaces.base, 'rgba(0, 0, 0, 0)', `${combination}: theme must not cover painted wallpaper`);
        assert.equal(surfaces.primary, 'rgba(0, 0, 0, 0)', `${combination}: primary canvas stays transparent`);
        const cardAlpha = Number(surfaces.card.match(/, ([.\d]+)\)$/)?.[1] ?? 1);
        assert.ok(cardAlpha >= .6 && cardAlpha < 1, `${combination}: card has a readable translucent surface`);
        assert.ok(surfaces.composer.includes('rgb(') && !surfaces.composer.includes('rgba('), `${combination}: composer remains opaque`);
        assert.equal(surfaces.pointerEvents, 'none', `${combination}: wallpaper cannot intercept input`);
      }
    }
  }
  clearInterval(timer); hub.close();
  // The client hides the background only after the newest frame is older than
  // 3000 ms, and it checks that once per second. Five seconds of slack keeps
  // this deterministic on a loaded desktop without weakening the assertion.
  for (let i = 0; i < 50 && await evaluate("document.body.classList.contains('wm-wallpaper-probe-live')"); i++) await delay(100);
  assert.equal(await evaluate("document.body.classList.contains('wm-wallpaper-probe-live')"), false, 'EOF restores theme');
  assert.notEqual(await evaluate("getComputedStyle(document.getElementById('root')).backgroundColor"), 'rgba(0, 0, 0, 0)', 'EOF restores original theme opacity');
  await evaluate('window.disposeProbe()'); await delay(100);
  assert.equal(await evaluate("document.querySelectorAll('#whale-wallpaper-probe-frame,#whale-wallpaper-probe-stop').length"), 0);
  assert.equal(activeStreams, 0); assert.equal(hub.listenerCount('frame'), 0);
  console.log(JSON.stringify({ passed: true, rendered: metrics.rendered, received: metrics.received,
    decodeErrors: metrics.decodeErrors, meanLatencyMs: metrics.meanLatencyMs, themeCombinations: 16, cleanup: true }, null, 2));
  await cdp('Browser.close').catch(() => {});
} finally {
  clearInterval(timer); hub.close(); socket?.close(); for (const request of pending.values()) clearTimeout(request.timeout);
  browser.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
