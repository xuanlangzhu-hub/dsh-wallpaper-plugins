// Comparing painted content across scroll positions in the same session.
//
// A saved screencast frame showed the message layer covering the whole column with the card floating
// on top. This probe takes a still screenshot at the same scroll position and reads the clip in the
// same call, so "the clip is applied" can be checked against actual pixels rather than against the
// value the style object reports. It also checks whether the applied clip changes at all during a
// scroll, which is what the earlier probes assumed.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
    window.__clipLog = [];
    (function () {
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
        if (name === '--wm-history-clip-bottom') window.__clipLog.push({ at: Math.round(performance.now()), value: String(value) });
        return original.call(this, name, value, priority);
      };
    })();
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-paint-compare-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-paint-compare');
const shotDir = join(runDir, 'shots');
await mkdir(shotDir, { recursive: true });
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
  await sleep(400);

  /**
   * Reads the clip, measures the band, and takes a still screenshot. The clip reading and the
   * screenshot describe the same settled state: nothing is scrolling while this runs.
   */
  const capture = async label => {
    const state = await evaluate(`(() => {
      const view = document.querySelector('.Dc7zOa_viewArea');
      const scroll = document.querySelector('[data-conversation-scroll]');
      const card = document.querySelector('.RlGAzG_card');
      const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
      const cardRect = card.getBoundingClientRect();
      return {
        scrollTop: Math.round(scroll.scrollTop), clip,
        attribute: view.getAttribute('data-wm-history-clip') !== null,
        clipPath: getComputedStyle(view).clipPath,
        card: [Math.round(cardRect.top), Math.round(cardRect.bottom)],
        visibleBottom: Math.round(view.getBoundingClientRect().bottom - clip),
        clipWrites: window.__clipLog.length,
      };
    })()`);
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(shotDir, `${label}.png`), Buffer.from(shot.data, 'base64'));
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
      return { belowCard: count(673, 699), besideCard: count(552, 672), aboveComposer: count(452, 512), aboveHeader: count(100, 200) };
    })()`);
    const entry = { label, ...state, ...pixels };
    console.log('CAPTURE ' + JSON.stringify(entry));
    return entry;
  };

  const results = [];
  results.push(await capture('at-rest'));
  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 1200`);
  await sleep(250);
  results.push(await capture('scrolled-1200'));
  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 2400`);
  await sleep(250);
  results.push(await capture('scrolled-2400'));
  // A slow wheel so the clip has to follow; the screenshot is taken while it runs.
  // During a reverse scroll the same frame is captured twice: once as the state is read, and once
  // immediately after. If only the first shows text around the card, the boundary was genuinely behind
  // the content at that moment; if both show it, the state itself is stale; if neither does, the
  // earlier single reading was a coincidence of where the wheel happened to be.
  const midScroll = [];
  const reverseTask = (async () => {
    for (let step = 0; step < 12; step += 1) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY: -160, modifiers: 0, pointerType: 'mouse' });
      await sleep(12);
    }
  })();
  for (let shot = 0; shot < 4; shot += 1) {
    await sleep(40);
    const before = await evaluate(`(() => {
      const view = document.querySelector('.Dc7zOa_viewArea');
      const scroll = document.querySelector('[data-conversation-scroll]');
      const card = document.querySelector('.RlGAzG_card');
      const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
      const cardRect = card.getBoundingClientRect();
      return {
        scrollTop: Math.round(scroll.scrollTop), clip,
        expectedClip: Math.round(view.getBoundingClientRect().bottom - cardRect.top),
        card: [Math.round(cardRect.top), Math.round(cardRect.bottom)],
      };
    })()`);
    const first = await cdp('Page.captureScreenshot', { format: 'png' });
    const second = await cdp('Page.captureScreenshot', { format: 'png' });
    const after = await evaluate(`(() => {
      const view = document.querySelector('.Dc7zOa_viewArea');
      const scroll = document.querySelector('[data-conversation-scroll]');
      const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
      return { scrollTop: Math.round(scroll.scrollTop), clip };
    })()`);
    const scan = async data => {
      await evaluate(`window.__shot = ${JSON.stringify(data)}`);
      return evaluate(`(async () => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + window.__shot;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const scale = image.width / window.innerWidth;
        const cardRect = document.querySelector('.RlGAzG_card').getBoundingClientRect();
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
        return { belowCard: count(cardRect.bottom + 1, cardRect.bottom + 28), besideCard: count(cardRect.top, cardRect.bottom) };
      })()`);
    };
    midScroll.push({ shot, before, first: await scan(first.data), after, second: await scan(second.data) });
    await writeFile(join(shotDir, `mid-${shot}-first.png`), Buffer.from(first.data, 'base64'));
    await writeFile(join(shotDir, `mid-${shot}-second.png`), Buffer.from(second.data, 'base64'));
  }
  await reverseTask;
  await sleep(250);
  results.push(await capture('after-reverse'));
  console.log('MIDSCROLL ' + JSON.stringify(midScroll));

  // Does an active screencast change whether the page scrolls at all? The screencast run reported a
  // scroll position of 0 for every frame, so the same wheel is repeated with the stream running.
  const screencastFrames = [];
  let streaming = true;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Page.screencastFrame' || !streaming) return;
    cdp('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {});
    screencastFrames.push(Date.now());
  });
  await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 2400`);
  await sleep(200);
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  await sleep(150);
  const duringStream = [];
  for (let step = 0; step < 10; step += 1) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY: -160, modifiers: 0, pointerType: 'mouse' });
    await sleep(20);
    duringStream.push(await evaluate(`Math.round(document.querySelector('[data-conversation-scroll]').scrollTop)`));
  }
  await sleep(150);
  await cdp('Page.stopScreencast');
  streaming = false;
  const streamResult = { scrollTops: duringStream, framesDelivered: screencastFrames.length };
  console.log('STREAM ' + JSON.stringify(streamResult));
  const streamShot = await capture('with-screencast');

  const out = await evidencePath('WM_COMPARE_OUTPUT', runDir, 'compare.json');
  await writeFile(out, JSON.stringify({ isolated: true, results, streamResult, streamShot }, null, 2), { flag: 'w' });
  await verifyPersisted(out);
  console.log('COMPARE ' + JSON.stringify(results.map(entry => ({ label: entry.label, scrollTop: entry.scrollTop, clip: entry.clip, clipPath: entry.clipPath, visibleBottom: entry.visibleBottom, belowCard: entry.belowCard, besideCard: entry.besideCard, aboveComposer: entry.aboveComposer, aboveHeader: entry.aboveHeader }))));
  console.log(`report ${out}, shots in ${shotDir}`);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
