// Decisive comparison for the below-card band: does a stale clip actually put text on screen?
//
// The frame reader reports frames during a reverse scroll where the visible bottom edge of the
// message layer extends past the bottom of the input card, because the clip value lags the scroll by
// one step. Those frames are an observation of geometry, not of pixels. This probe reproduces the
// exact state in a still page: same scroll position, same card, and the clip value the lag produced.
// It then reads the pixels of the band below the card in both states. A difference means the lag
// paints text where the send box is; identical readings mean the lag never reaches the screen and the
// frame reader is measuring its own sampling order.
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
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-below-card-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-below-card');
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

  /**
   * Reads the band from the bottom of the card to the bottom of the scrollport, in the chat column
   * only, and reports how much message-coloured content it contains.
   */
  const measure = async label => {
    const geometry = await evaluate(`(() => {
      const scroll = document.querySelector('[data-conversation-scroll]');
      const view = document.querySelector('.Dc7zOa_viewArea');
      const card = document.querySelector('.RlGAzG_card');
      const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
      const viewRect = view.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      return {
        scrollTop: Math.round(scroll.scrollTop), clip, appliedClip: view.style.getPropertyValue('--wm-history-clip-bottom'),
        visibleBottom: Math.round(viewRect.bottom - clip),
        cardBottom: Math.round(cardRect.bottom), scrollBottom: Math.round(scrollRect.bottom),
      };
    })()`);
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    await evaluate(`window.__shot = ${JSON.stringify(shot.data)}`);
    const pixels = await evaluate(`(async () => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + window.__shot;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const scroll = document.querySelector('[data-conversation-scroll]');
      const card = document.querySelector('.RlGAzG_card');
      const scrollRect = scroll.getBoundingClientRect();
      const from = Math.ceil(card.getBoundingClientRect().bottom);
      const to = Math.floor(scrollRect.bottom) - 1;
      let text = 0; let other = 0; const rows = new Set();
      for (let y = from; y <= to; y += 1) {
        for (let x = ${COLUMN_LEFT} + 20; x < ${COLUMN_RIGHT} - 10; x += 4) {
          const data = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
          if (data[0] > 200 && data[1] > 200 && data[2] < 80) { text += 1; rows.add(y); }
          else other += 1;
        }
      }
      return { band: [from, to], text, other, textRows: [...rows].slice(0, 10) };
    })()`);
    const entry = { label, ...geometry, ...pixels };
    console.log('BAND ' + JSON.stringify(entry));
    return entry;
  };

  const results = [];
  // A position where the lag was observed, with the clip the theme settled on.
  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 2158`);
  await sleep(160);
  const accurate = await measure('clip accurate at scrollTop 2158');
  // The stale value the frame reader recorded at that scroll position: the clip lags by one step, so
  // the visible region is one step taller.
  await evaluate(`(() => {
    const view = document.querySelector('.Dc7zOa_viewArea');
    const current = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
    window.__accurateClip = current;
    view.style.setProperty('--wm-history-clip-bottom', (current - 160) + 'px', 'important');
    return current;
  })()`);
  await sleep(160);
  const stale = await measure('clip one step late (160px shorter)');
  await evaluate(`(() => { const view = document.querySelector('.Dc7zOa_viewArea'); view.style.setProperty('--wm-history-clip-bottom', window.__accurateClip + 'px'); return true; })()`);
  await sleep(160);
  results.push(accurate, stale, await measure('clip restored'));

  const out = await evidencePath('WM_BELOW_CARD_OUTPUT', runDir, 'below-card.json');
  await writeFile(out, JSON.stringify({ isolated: true, results }, null, 2), { flag: 'w' });
  await verifyPersisted(out);
  const delta = stale.text - accurate.text;
  console.log(`BELOW-CARD accurate=${accurate.text} stale=${stale.text} restored=${results[2].text} delta=${delta}`);
  console.log(`report ${out}`);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
