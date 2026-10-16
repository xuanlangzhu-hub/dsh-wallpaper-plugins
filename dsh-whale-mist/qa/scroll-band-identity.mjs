// What is in the 28px band below the input card? The frame reader reports message rows there for a
// few frames during a reverse scroll, while at rest the band is clean. This identifies the elements
// in that band, at rest and during a reverse scroll, instead of leaving it to inference.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createProfile, removeProfile, createRunDirectory, evidencePath, verifyPersisted } from './temp-profile.mjs';

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
const COLUMN_RIGHT = 883;

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
  </style></head><body><main id="root"><div class="BynINW_frame">
  <div class="BynINW_sidebarCol">sidebar label</div><div class="BynINW_centerCol"><div class="Dc7zOa_root" data-phase="active">
  <div class="Dc7zOa_header">session title</div><div class="Dc7zOa_body" data-content-phase="active" data-conversation-content>
  <div class="Dc7zOa_scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="Dc7zOa_viewArea">
  <div class="messages" id="messages"></div></div></div>
  <div class="Dc7zOa_composerSeat" data-composer-seat data-conversation-region="composer">
  <div class="composer-toolbar"></div><div class="RlGAzG_card"><textarea style="width:85%;height:60%;color:white;background:transparent" aria-label="draft"></textarea></div>
  <div class="composer-footer"></div></div></div></div></div></div></div></main>
  <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script>
  <script>
    const messages = document.getElementById('messages');
    for (let index = 0; index < 120; index += 1) { const row = document.createElement('div'); row.className = 'message'; messages.append(row); }

    window.__bandProbe = {
      rows: [],
      describe(y) {
        const x = ${COLUMN_LEFT} + 60;
        const stack = document.elementsFromPoint(x, y).slice(0, 5).map(element => {
          const rect = element.getBoundingClientRect();
          const name = element.id ? '#' + element.id : (element.className ? '.' + String(element.className).split(' ')[0] : element.tagName);
          return name + '[' + Math.round(rect.top) + ',' + Math.round(rect.bottom) + '] bg=' + getComputedStyle(element).backgroundColor;
        });
        const direct = document.elementFromPoint(x, y);
        return { y, top: direct ? (direct.className || direct.tagName) : null, stack };
      },
      snapshot(label) {
        const scroll = document.querySelector('[data-conversation-scroll]');
        const card = document.querySelector('.RlGAzG_card');
        const footer = document.querySelector('.composer-footer');
        const view = document.querySelector('.Dc7zOa_viewArea');
        const cardRect = card.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        const visibleBottom = view.getBoundingClientRect().bottom - clip;
        // The same visibility rule the frame reader uses: a row counts only inside the region the clip
        // leaves visible. Using the scrollport bottom instead would include rows the clip removed.
        void visibleBottom;
        // Which message rows overlap the band below the card, and by how much.
        const inBand = [];
        for (const row of document.querySelectorAll('.message')) {
          const r = row.getBoundingClientRect();
          const top = Math.max(r.top, view.getBoundingClientRect().bottom - clip, cardRect.bottom);
          const bottom = Math.min(r.bottom, scrollRect.bottom);
          if (bottom > top) inBand.push({ row: [Math.round(r.top), Math.round(r.bottom)], visiblePart: [Math.round(top), Math.round(bottom)] });
        }
        const sampleYs = [];
        for (let y = Math.ceil(cardRect.bottom) + 1; y < Math.min(scrollRect.bottom, cardRect.bottom + 30); y += 4) sampleYs.push(y);
        return {
          label,
          scrollTop: Math.round(scroll.scrollTop),
          clip: Math.round(clip), visibleBottom: Math.round(visibleBottom),
          cardBottom: Math.round(cardRect.bottom), scrollBottom: Math.round(scrollRect.bottom),
          footer: [Math.round(footerRect.top), Math.round(footerRect.bottom)],
          rowsInBand: inBand.length, first: inBand.slice(0, 3),
          band: sampleYs.map(y => this.describe(y)),
        };
      },
    };
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-band-identity-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-band-identity');
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const page = pages.find(entry => entry.type === 'page' && entry.url === url);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) { clearTimeout(request.timer); pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(Error(`${method} timeout`)); }, 20000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
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
  await sleep(150);

  const snapshots = [];
  snapshots.push(await evaluate(`window.__bandProbe.snapshot('at rest')`));
  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 1200`);
  await sleep(150);
  snapshots.push(await evaluate(`window.__bandProbe.snapshot('scrolled 1200')`));
  // A reverse scroll, sampled while it runs: the frames where rows were reported below the card.
  await evaluate(`(async () => {
    window.__bandProbe.rows = [];
    window.__bandProbe.on = true;
    const tick = () => { if (!window.__bandProbe.on) return; window.__bandProbe.rows.push(window.__bandProbe.snapshot('live')); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return true;
  })()`);
  for (let step = 0; step < 24; step += 1) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY: -160, modifiers: 0, pointerType: 'mouse' });
    await sleep(6);
  }
  const live = await evaluate(`(() => { window.__bandProbe.on = false; return window.__bandProbe.rows.filter(row => row.rowsInBand > 0).slice(0, 4); })()`);
  snapshots.push(...live);
  const out = await evidencePath('WM_BAND_IDENTITY_OUTPUT', runDir, 'band-identity.json');
  await writeFile(out, JSON.stringify({ isolated: true, snapshots }, null, 2), { flag: 'w' });
  await verifyPersisted(out);
  for (const snapshot of snapshots.slice(0, 6)) {
    console.log('BAND ' + JSON.stringify({
      label: snapshot.label, scrollTop: snapshot.scrollTop, clip: snapshot.clip,
      visibleBottom: snapshot.visibleBottom, cardBottom: snapshot.cardBottom, scrollBottom: snapshot.scrollBottom,
      footer: snapshot.footer, rowsInBand: snapshot.rowsInBand, first: snapshot.first,
      band: (snapshot.band || []).slice(0, 3),
    }));
  }
  console.log(`band identity report ${out}`);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
