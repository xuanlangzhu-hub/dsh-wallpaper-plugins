// Per-frame measurement of what the message layer draws around the send box.
//
// The reported symptom is text flashing *below* the send box while scrolling. An earlier version of
// this check scanned the strip *above* the input card (where text is allowed to show) and counted
// animation-frame callbacks, which leaked between runs. Both are fixed here:
//
//   - Two bands are measured from element geometry, not from screenshots: the band the send box
//     occupies, and a control band above the composer where text is expected. An element counts as
//     visible in a band when its layout box, intersected with the region the clip leaves visible,
//     covers a non-empty area there. Screenshots mix moments and cannot answer whether a frame was
//     drawn with text in the band.
//   - One schedule per start/stop cycle: the tick owns its request id, does not reschedule after
//     stop, and samples are keyed by the browser's own frame timestamp, so a frame is never counted
//     twice and a later run cannot be sampled by a leftover loop.
//
// A sample describes the frame its callback belongs to. The theme updates the clip in its own
// animation-frame callback, so a sample can still show a value that its callback corrects before that
// frame is painted. The run therefore reports *series* of consecutive offending frames rather than a
// bare count, and it always records the control band, so a reader can tell whether the measurement is
// looking at the message layer at all.
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

    window.__frameReader = {
      samples: [],
      timer: null,
      duplicateCallbacks: 0,
      frameTimestamps: null,
      start() {
        if (this.timer !== null) throw new Error('the frame reader is already recording');
        this.samples = [];
        this.duplicateCallbacks = 0;
        this.frameTimestamps = new Set();
        const tick = (timestamp) => {
          // The tick keeps the id it was given. Stopping cancels that id and the loop ends here, so a
          // later run cannot be sampled by this one.
          this.timer = requestAnimationFrame(tick);
          this.record(timestamp);
        };
        this.timer = requestAnimationFrame(tick);
      },
      stop() {
        if (this.timer !== null) { cancelAnimationFrame(this.timer); this.timer = null; }
        return this.summary();
      },
      /** The region the clip leaves visible for the message layer, in viewport coordinates. */
      geometry() {
        const scroll = document.querySelector('[data-conversation-scroll]');
        const view = document.querySelector('.Dc7zOa_viewArea');
        const card = document.querySelector('.RlGAzG_card');
        const toolbar = document.querySelector('.composer-toolbar');
        const viewRect = view.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        // inset(bottom) removes the last bottom pixels of the view's own border box, so the visible
        // part ends at viewRect.bottom - bottom; the scrollport clips it as well.
        const clipBottom = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        const clipped = view.hasAttribute('data-wm-history-clip');
        const visibleTop = Math.max(viewRect.top, scrollRect.top);
        const visibleBottom = Math.min(clipped ? viewRect.bottom - clipBottom : viewRect.bottom, scrollRect.bottom);
        return {
          clipBottom, clipped, visibleTop, visibleBottom,
          cardTop: cardRect.top, cardBottom: cardRect.bottom,
          columnLeft: Math.max(${COLUMN_LEFT}, scrollRect.left), columnRight: Math.min(${COLUMN_RIGHT}, scrollRect.right),
          // Below the send box: the footer strip and whatever lies under the card, to the scrollport.
          dangerTop: cardRect.bottom, dangerBottom: scrollRect.bottom,
          // The composer's own strip above the card.
          seatTop: toolbarRect.top,
          // Above the composer: a control band that must show text.
          controlTop: toolbarRect.top - 60, controlBottom: toolbarRect.top,
        };
      },
      record(timestamp) {
        if (this.frameTimestamps.has(timestamp)) { this.duplicateCallbacks += 1; return; }
        this.frameTimestamps.add(timestamp);
        const geometry = this.geometry();
        const band = (top, bottom) => {
          if (bottom <= top) return 0;
          let count = 0;
          for (const row of document.querySelectorAll('.message')) {
            const rect = row.getBoundingClientRect();
            const left = Math.max(rect.left, geometry.columnLeft);
            const right = Math.min(rect.right, geometry.columnRight);
            const overlapTop = Math.max(rect.top, geometry.visibleTop, top);
            const overlapBottom = Math.min(rect.bottom, geometry.visibleBottom, bottom);
            if (right > left && overlapBottom > overlapTop) count += 1;
          }
          return count;
        };
        this.samples.push({
          frame: timestamp,
          scrollTop: document.querySelector('[data-conversation-scroll]').scrollTop,
          ...geometry,
          inDanger: band(geometry.dangerTop, geometry.dangerBottom),
          inSeatStrip: band(geometry.seatTop, geometry.cardTop),
          inControl: band(geometry.controlTop, geometry.controlBottom),
        });
      },
      summary() {
        const samples = this.samples;
        const count = key => samples.reduce((sum, sample) => sum + sample[key], 0);
        const series = [];
        let start = null;
        for (const [index, sample] of samples.entries()) {
          if (sample.inDanger > 0) { if (start === null) start = index; }
          else if (start !== null) { series.push([start, index - 1]); start = null; }
        }
        if (start !== null) series.push([start, samples.length - 1]);
        return {
          frames: samples.length,
          duplicateCallbacksSuppressed: this.duplicateCallbacks,
          framesWithTextBelowCard: samples.filter(sample => sample.inDanger > 0).length,
          rowsBelowCard: count('inDanger'),
          framesWithTextInSeatStrip: samples.filter(sample => sample.inSeatStrip > 0).length,
          rowsInSeatStrip: count('inSeatStrip'),
          framesWithTextAboveComposer: samples.filter(sample => sample.inControl > 0).length,
          rowsAboveComposer: count('inControl'),
          series,
          firstOffenders: samples.filter(sample => sample.inDanger > 0).slice(0, 6).map(sample => ({
            scrollTop: Math.round(sample.scrollTop), clip: sample.clipBottom,
            visibleBottom: Math.round(sample.visibleBottom), cardBottom: Math.round(sample.cardBottom),
            spill: Number((sample.visibleBottom - sample.cardBottom).toFixed(1)), rows: sample.inDanger,
          })),
        };
      },
    };
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-scroll-frames-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-scroll-frames');
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
const runs = [];
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

  const settled = await evaluate(`(() => { const g = window.__frameReader.geometry(); return { clip: g.clipBottom, clipped: g.clipped, visibleBottom: Math.round(g.visibleBottom), cardTop: Math.round(g.cardTop), cardBottom: Math.round(g.cardBottom), danger: [Math.round(g.dangerTop), Math.round(g.dangerBottom)], seat: [Math.round(g.seatTop), Math.round(g.cardTop)], control: [Math.round(g.controlTop), Math.round(g.controlBottom)] }; })()`);
  console.log('GEOMETRY ' + JSON.stringify(settled));
  assert.equal(settled.clipped, true, 'the theme applies its clip');
  assert.ok(Math.abs(settled.visibleBottom - settled.cardTop) <= 1.5,
    `at rest the visible part ends at the card, got ${JSON.stringify(settled)}`);

  const wheel = async (deltaY, times, interval) => {
    for (let step = 0; step < times; step += 1) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY, modifiers: 0, pointerType: 'mouse' });
      await sleep(interval);
    }
  };
  const reset = async () => { await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop = 0`); await sleep(150); };
  const run = async (label, action) => {
    await evaluate('window.__frameReader.start()');
    await action();
    const summary = await evaluate('window.__frameReader.stop()');
    summary.label = label;
    runs.push(summary);
    console.log('PASS ' + JSON.stringify({ label, frames: summary.frames, dup: summary.duplicateCallbacksSuppressed, belowCard: summary.framesWithTextBelowCard, seatStrip: summary.framesWithTextInSeatStrip, aboveComposer: summary.framesWithTextAboveComposer, series: summary.series }));
    return summary;
  };

  // Two identical runs back to back: a leftover schedule would inflate the second one.
  const resting = [];
  resting.push(await run('at rest', async () => { await sleep(400); }));
  resting.push(await run('at rest again', async () => { await sleep(400); }));
  assert.equal(resting[1].duplicateCallbacksSuppressed, 0,
    `a fresh run must not see callbacks from the previous one, got ${resting[1].duplicateCallbacksSuppressed}`);
  const first = resting[0].frames / 400;
  const second = resting[1].frames / 400;
  assert.ok(Math.abs(first - second) < 0.05,
    `both runs must sample at the display rate, got ${resting[0].frames} then ${resting[1].frames} frames over the same wall time`);

  await reset();
  await run('scroll down', async () => wheel(160, 30, 8));
  await reset();
  await run('scroll down then up', async () => { await wheel(160, 30, 8); await wheel(-160, 30, 8); });
  await reset();
  await run('reverse only', async () => { await wheel(160, 20, 8); await wheel(-160, 20, 4); });
  await reset();
  await run('fast scroll down', async () => wheel(400, 40, 4));

  const out = await evidencePath('WM_SCROLL_OUTPUT', runDir, 'scroll-frames.json');
  await writeFile(out, JSON.stringify({ isolated: true, geometry: settled, runs }, null, 2), { flag: 'w' });
  const persisted = await verifyPersisted(out);
  const totalFrames = runs.reduce((sum, entry) => sum + entry.frames, 0);
  const belowCard = runs.reduce((sum, entry) => sum + entry.framesWithTextBelowCard, 0);
  const aboveComposer = runs.reduce((sum, entry) => sum + entry.framesWithTextAboveComposer, 0);
  console.log(`SCROLL-FRAMES frames=${totalFrames} framesWithTextBelowCard=${belowCard} framesWithTextAboveComposer=${aboveComposer} reportBytes=${persisted.bytes}`);
  if (process.env.WM_EXPECT_BELOW_CARD === '1') {
    assert.ok(belowCard > 0, 'this build is expected to draw text below the send box while scrolling, but no frame did');
    console.log(`below-card text observed: ${belowCard} of ${totalFrames} frames`);
  } else {
    assert.equal(belowCard, 0,
      `no message text may be drawn below the send box, got ${JSON.stringify(runs.filter(entry => entry.framesWithTextBelowCard > 0).map(entry => ({ label: entry.label, frames: entry.framesWithTextBelowCard, first: entry.firstOffenders })))}`);
    assert.ok(aboveComposer > 0, 'the reader must see text above the composer, otherwise it is not measuring the message layer');
    console.log('scroll frame checks passed: nothing drawn below the send box, the control band sees text');
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
