// Attribution for the painted frames: what was the page doing when text appeared below the card?
//
// `Page.startScreencast` reports `scrollOffsetY` as 0 even while the page scrolls, so a frame cannot
// label itself. This probe records the scroll position, the clip value and the card position on every
// animation frame, and pairs each arriving screencast frame with the nearest record. Each frame is then
// scanned using *its own* card position, so the band is right even mid-scroll. Frames whose record
// shows a stale clip are written to disk next to the report, so the painted content can be looked at
// instead of inferred.
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
const delayFrame = Number(process.env.WM_DELAY_CLIP_FRAMES || 0);
const scenario = process.env.WM_SCENARIO || 'reverse';

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
  <script>
    ${delayFrame > 0 ? `(function () {
      // Negative control only: animation-frame callbacks run one frame later than asked, so the theme's
      // clip update lands after the frame it was computed for.
      const raf = window.requestAnimationFrame.bind(window);
      const caf = window.cancelAnimationFrame.bind(window);
      const inner = new Map();
      window.requestAnimationFrame = callback => {
        const id = raf(() => { const second = raf(() => { inner.delete(id); callback(performance.now()); }); inner.set(id, second); });
        return id;
      };
      window.cancelAnimationFrame = id => { const second = inner.get(id); if (second) caf(second); caf(id); };
    })();` : ''}
    window.__frameProbe = {
      on: false,
      ticks: [],
      tick() {
        requestAnimationFrame(() => this.tick());
        if (!this.on) return;
        const view = document.querySelector('.Dc7zOa_viewArea');
        const scroll = document.querySelector('[data-conversation-scroll]');
        const card = document.querySelector('.RlGAzG_card');
        const toolbar = document.querySelector('.composer-toolbar');
        const cardRect = card.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        this.ticks.push({
          at: Math.round(performance.now() * 10) / 10,
          scrollTop: Math.round(scroll.scrollTop),
          clip,
          clipped: view.hasAttribute('data-wm-history-clip'),
          card: [Math.round(cardRect.top), Math.round(cardRect.bottom)],
          visibleBottom: Math.round(viewRect.bottom - clip),
          control: [Math.round(toolbar.getBoundingClientRect().top) - 60, Math.round(toolbar.getBoundingClientRect().top)],
        });
        if (this.ticks.length > 2000) this.ticks.shift();
      },
      start() { this.ticks = []; this.on = true; },
      stop() { this.on = false; return this.ticks; },
    };
  </script>
  <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script>
  <script>
    const messages = document.getElementById('messages');
    for (let index = 0; index < 120; index += 1) { const row = document.createElement('div'); row.className = 'message'; messages.append(row); }
    requestAnimationFrame(() => window.__frameProbe.tick());
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-painted-attrib-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-painted-attrib');
const frameDir = join(runDir, 'frames');
await mkdir(frameDir, { recursive: true });
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
const frames = [];
let collecting = false;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(port, 'isolated browser launched');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const page = pages.find(entry => entry.type === 'page' && entry.url === url);
  assert.ok(page, 'isolated test page');
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
      const params = message.params;
      cdp('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
      if (collecting) frames.push({ at: Date.now(), metadata: params.metadata, data: params.data });
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
  collecting = true;
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  await sleep(200);
  const wheel = async (deltaY, times, interval) => {
    for (let step = 0; step < times; step += 1) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY, modifiers: 0, pointerType: 'mouse' });
      await sleep(interval);
    }
  };
  if (scenario === 'reverse') { await wheel(160, 25, 8); await wheel(-160, 25, 6); }
  else if (scenario === 'down') await wheel(160, 30, 8);
  else if (scenario === 'fast') await wheel(400, 35, 4);
  else if (scenario === 'static') await sleep(700);
  await sleep(300);
  await cdp('Page.stopScreencast');
  collecting = false;
  const ticks = await evaluate('window.__frameProbe.stop()');
  assert.ok(ticks.length > 0, 'the frame probe recorded ticks');

  const ordered = [...ticks].sort((a, b) => a.at - b.at);
  const tickFor = at => {
    let best = null;
    for (const tick of ordered) { if (tick.at <= at + 60) best = tick; else break; }
    return best || ordered[0];
  };

  /** Scans one frame using the card position from its own tick. */
  const scan = async (data, tick) => {
    await evaluate(`window.__shot = ${JSON.stringify(data)}`);
    return evaluate(`(async () => {
      const image = new Image();
      image.src = 'data:image/jpeg;base64,' + window.__shot;
      try { await image.decode(); } catch (error) { return { error: String(error) }; }
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const count = (top, bottom) => {
        if (bottom <= top) return { hits: 0, rows: [] };
        let hits = 0; const rows = new Set();
        for (let y = Math.max(0, Math.ceil(top)); y <= Math.min(image.height - 1, Math.floor(bottom)); y += 1) {
          for (let x = ${COLUMN_LEFT} + 20; x < ${COLUMN_RIGHT} - 10; x += 4) {
            const d = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
            if (d[0] > 170 && d[1] > 170 && d[2] < 110 && Math.abs(d[0] - d[1]) < 60) { hits += 1; rows.add(y); }
          }
        }
        return { hits, rows: [...rows].slice(0, 6) };
      };
      const tick = ${JSON.stringify(tick)};
      return {
        belowCard: count(tick.card[1] + 1, tick.card[1] + 34),
        aboveComposer: count(tick.control[0], tick.control[1]),
      };
    })()`);
  };

  const samples = [];
  for (const frame of frames) {
    const tick = tickFor(frame.at);
    const counts = await scan(frame.data, tick);
    samples.push({
      at: frame.at, scrollTop: tick.scrollTop, clip: tick.clip,
      card: tick.card, visibleBottom: tick.visibleBottom,
      stale: tick.visibleBottom > tick.card[1] + 1,
      belowCard: counts.belowCard, aboveComposer: counts.aboveComposer,
    });
  }

  const stale = samples.filter(sample => sample.stale);
  const leaky = samples.filter(sample => sample.belowCard && sample.belowCard.hits > 0);
  for (const [order, sample] of leaky.slice(0, 8).entries()) {
    const source = frames[samples.indexOf(sample)];
    await writeFile(join(frameDir, `leak-${String(order).padStart(2, '0')}-scrollTop${sample.scrollTop}.jpg`), Buffer.from(source.data, 'base64'));
  }
  for (const [order, sample] of stale.filter(entry => entry.belowCard.hits === 0).slice(0, 4).entries()) {
    const source = frames[samples.indexOf(sample)];
    await writeFile(join(frameDir, `stale-clean-${order}-scrollTop${sample.scrollTop}.jpg`), Buffer.from(source.data, 'base64'));
  }

  const report = {
    isolated: true, delayFrame, scenario,
    frames: frames.length, ticks: ticks.length,
    // The full per-frame table is kept: pairing a frame with a tick is approximate, so the raw
    // sequence (arrival order, time, and the state recorded for that frame) has to be inspectable.
    perFrame: samples.map(sample => ({
      at: sample.at, scrollTop: sample.scrollTop, clip: sample.clip, card: sample.card,
      visibleBottom: sample.visibleBottom, stale: sample.stale,
      belowCardHits: sample.belowCard ? sample.belowCard.hits : null,
      belowCardRows: sample.belowCard ? sample.belowCard.rows : null,
      aboveComposerHits: sample.aboveComposer ? sample.aboveComposer.hits : null,
    })),
    framesWithStaleGeometry: stale.length,
    framesWithTextBelowCard: leaky.length,
    framesWithTextAboveComposer: samples.filter(sample => sample.aboveComposer && sample.aboveComposer.hits > 0).length,
    leakSamples: leaky.slice(0, 8).map(sample => ({ scrollTop: sample.scrollTop, clip: sample.clip, card: sample.card, visibleBottom: sample.visibleBottom, hits: sample.belowCard.hits, rows: sample.belowCard.rows })),
    staleCleanSample: stale.filter(entry => entry.belowCard.hits === 0).slice(0, 3).map(sample => ({ scrollTop: sample.scrollTop, clip: sample.clip, card: sample.card, visibleBottom: sample.visibleBottom })),
  };
  const out = await evidencePath('WM_ATTRIB_OUTPUT', runDir, 'attribution.json');
  await writeFile(out, JSON.stringify(report, null, 2), { flag: 'w' });
  const persisted = await verifyPersisted(out);
  console.log('ATTRIB ' + JSON.stringify({ scenario, delayFrame, frames: report.frames, ticks: report.ticks, staleGeometry: report.framesWithStaleGeometry, textBelowCard: report.framesWithTextBelowCard, textAboveComposer: report.framesWithTextAboveComposer, leak: report.leakSamples.slice(0, 3), staleClean: report.staleCleanSample.slice(0, 2) }));
  console.log(`report ${out} (${persisted.bytes} bytes), frames in ${frameDir}`);
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
