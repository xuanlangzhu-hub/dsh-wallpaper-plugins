import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const qa = dirname(fileURLToPath(import.meta.url));
const client = await readFile(join(qa, '../src/client.js'));
const harness = await readFile(join(qa, 'appearance-harness.js'));
// No-store plus a per-run query string: a cached client bundle would silently invalidate
// every assertion here, which is exactly the kind of stale result these checks must avoid.
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const server = createServer((req, res) => {
  if (req.url.split('?')[0] === '/client.js' || req.url.split('?')[0] === '/harness.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
    res.end(req.url.startsWith('/client.js') ? client : harness); return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html><head><title>Isolated Whale QA</title></head><body><main id="root"><div id="fixture-base" style="background:var(--dsw-alias-bg-base)">Canvas</div><div id="fixture-card" style="background:var(--dsw-alias-bg-layer-1)">Card</div><div id="fixture-composer" style="background:var(--dsw-specific-input-major)">Composer</div></main><script src="/harness.js?v=${runId}"></script><script src="/client.js?v=${runId}"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'whale-appearance-qa-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', '--autoplay-policy=no-user-gesture-required', `http://127.0.0.1:${server.address().port}/`,
], { windowsHide: true, stdio: 'ignore' });
let socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map(); let id = 0;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(port, 'headless browser started');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const page = pages.find(p => p.type === 'page' && p.url.startsWith(`http://127.0.0.1:${server.address().port}`));
  assert.ok(page, 'isolated test page found');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) { pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 30000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  for (let i = 0; i < 50 && !await evaluate('Boolean(window.fixture?.run && window.whaleModule)'); i++) await sleep(100);
  if (process.env.WHALE_QA_EXPORT_MEDIA) {
    const out = process.env.WHALE_QA_EXPORT_MEDIA;
    await mkdir(out, { recursive: true });
    for (const [name, method] of [['fixture.png', 'makeImage'], ['fixture.webm', 'makeVideo']]) {
      const bytes = await evaluate(`fixture.${method}().then(async blob => Array.from(new Uint8Array(await blob.arrayBuffer())))`);
      await writeFile(join(out, name), Buffer.from(bytes), { flag: 'wx' });
    }
    console.log(JSON.stringify({ generatedMedia: out }));
  } else {
  await evaluate('fixture.run()');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await evaluate(`fixture.wait(() => document.querySelector('#wm-backdrop video').paused).then(() => {
    fixture.assert(true, 'reduced motion pauses video');
    fixture.assert(getComputedStyle(document.querySelector('#wm-backdrop')).display === 'none', 'reduced transparency hides backdrop');
  })`);
  await cdp('Emulation.setEmulatedMedia', { features: [] });
  await evaluate(`(async () => {
    const c = fixture.controller;
    c.set('background', 'image'); c.set('background', 'video'); c.set('background', 'none');
    await new Promise(r => setTimeout(r, 100));
    fixture.assert(!document.getElementById('wm-backdrop') && fixture.liveUrls.size === 0, 'rapid switches discard stale loads and URLs');
    c.set('background', 'video'); fixture.dispose(); await new Promise(r => setTimeout(r, 100));
    fixture.assert(!document.getElementById('wm-backdrop') && fixture.liveUrls.size === 0, 'disposal cancels pending loads');
  })()`);
  const results = await evaluate('fixture.results');
  console.log(JSON.stringify({ passed: results.length, results, isolatedProfile: profile }, null, 2));
  }
  await cdp('Browser.close').catch(() => {});
} finally {
  socket?.close(); for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
