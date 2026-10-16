// The failing check: while a reverse scroll is running, the boundary the clip keeps is behind the
// content, so text is drawn around the input card.
//
// `scroll-paint-compare.mjs` shows this in a single captured frame. This check makes it a verdict: it
// scrolls upward in steps and, after each step while the scroll is still moving, reads the clipped
// boundary and scans the bands around the card from a screenshot. A step where the boundary is behind
// the card and the bands contain message-coloured pixels is a leaked sample.
//
// `WM_LAG_EXTRA` shortens the clip by an extra amount on every step, which reproduces a larger lag and
// is the negative control for the detector: with it the check must find leaks. Without it, a build
// whose clip keeps up must find none.
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
const lagExtra = Number(process.env.WM_LAG_EXTRA || 0);
const steps = Number(process.env.WM_STEPS || 20);

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

const profile = await createProfile('wm-scroll-leak-check-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-scroll-leak');
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
const samples = [];
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(port, 'isolated browser launched');
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
    const timer = setTimeout(() => { pending.delete(key); reject(Error(`${method} timeout`)); }, 30000);
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
  await sleep(300);

  /** Reads the state and captures the frame; both describe the same settled moment. */
  const capture = async label => {
    const state = await evaluate(`(() => {
      const view = document.querySelector('.Dc7zOa_viewArea');
      const scroll = document.querySelector('[data-conversation-scroll]');
      const card = document.querySelector('.RlGAzG_card');
      const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
      const viewRect = view.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      // Where the boundary would sit if the clip matched this scroll position: the visible part must
      // end at the card's top edge, so the inset has to be viewRect.bottom - cardRect.top.
      return {
        scrollTop: Math.round(scroll.scrollTop), clip, clipPath: getComputedStyle(view).clipPath,
        card: [Math.round(cardRect.top), Math.round(cardRect.bottom)],
        visibleBottom: Math.round(viewRect.bottom - clip),
        expectedClip: Math.round(viewRect.bottom - cardRect.top),
        applied: view.style.getPropertyValue('--wm-history-clip-bottom'),
        column: [Math.round(scrollRect.left), Math.round(scrollRect.right)],
      };
    })()`);
    if (lagExtra > 0) {
      // Negative control: shorten the clip by an extra amount and read the state back, so the check
      // must see the boundary behind the card and text in the bands.
      await evaluate(`(() => {
        const view = document.querySelector('.Dc7zOa_viewArea');
        const current = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        view.style.setProperty('--wm-history-clip-bottom', Math.max(0, current - ${lagExtra}) + 'px', 'important');
        return true;
      })()`);
      const after = await evaluate(`(() => {
        const view = document.querySelector('.Dc7zOa_viewArea');
        const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        return { clip, visibleBottom: Math.round(view.getBoundingClientRect().bottom - clip) };
      })()`);
      state.clip = after.clip;
      state.visibleBottom = after.visibleBottom;
    }
    const shot = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
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
      const card = document.querySelector('.RlGAzG_card');
      const cardRect = card.getBoundingClientRect();
      const count = (top, bottom) => {
        let hits = 0;
        for (let y = Math.max(0, Math.ceil(top)); y <= Math.min(image.height - 1, Math.floor(bottom)); y += 1) {
          for (let x = ${COLUMN_LEFT} + 20; x < ${COLUMN_RIGHT} - 10; x += 4) {
            const d = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
            if (d[0] > 200 && d[1] > 200 && d[2] < 90) hits += 1;
          }
        }
        return hits;
      };
      return {
        belowCard: count(cardRect.bottom + 1, cardRect.bottom + 28),
        besideCard: count(cardRect.top, cardRect.bottom),
      };
    })()`);
    const sample = { label, ...state, ...pixels, behind: state.visibleBottom > state.card[0] + 1 };
    samples.push(sample);
    return sample;
  };

  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 2600`);
  await sleep(250);
  await capture('settled-at-2600');

  // Upward steps: after each wheel event the state is read and the frame captured while the boundary
  // is still catching up.
  for (let step = 0; step < steps; step += 1) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY: -160, modifiers: 0, pointerType: 'mouse' });
    await sleep(6);
    await capture(`reverse-step-${step}`);
  }
  await sleep(300);
  await capture('settled-after');

  const leaked = samples.filter(sample => sample.belowCard > 0 || sample.besideCard > 0);
  const report = {
    isolated: true, lagExtra, steps,
    samples,
    leakedSamples: leaked.length,
    settledClean: samples.filter(sample => sample.label.startsWith('settled')).every(sample => sample.belowCard === 0 && sample.besideCard === 0),
  };
  const out = await evidencePath('WM_LEAK_OUTPUT', runDir, 'leak.json');
  await writeFile(out, JSON.stringify(report, null, 2), { flag: 'w' });
  const persisted = await verifyPersisted(out);
  for (const sample of samples) {
    console.log('SAMPLE ' + JSON.stringify({ label: sample.label, scrollTop: sample.scrollTop, clip: sample.clip, expectedClip: sample.expectedClip, visibleBottom: sample.visibleBottom, cardTop: sample.card[0], behind: sample.behind, belowCard: sample.belowCard, besideCard: sample.besideCard }));
  }
  console.log(`SCROLL-LEAK-CANDIDATE samples=${samples.length} leaked=${leaked.length} settledClean=${report.settledClean} reportBytes=${persisted.bytes}`);
  if (process.env.WM_EXPECT_LEAK === '1') {
    assert.ok(leaked.length > 0, 'the negative control must produce leaks, but every sample was clean');
    console.log(`negative control confirmed: ${leaked.length} of ${samples.length} samples leaked`);
  } else {
    assert.equal(leaked.length, 0,
      `no sample may show text around the input card while scrolling, got ${JSON.stringify(leaked.map(sample => ({ label: sample.label, scrollTop: sample.scrollTop, clip: sample.clip, expectedClip: sample.expectedClip, belowCard: sample.belowCard, besideCard: sample.besideCard })))}`);
    console.log('scroll leak check passed: nothing drawn around the input card in any sample');
  }
  console.log(`report ${out}`);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
