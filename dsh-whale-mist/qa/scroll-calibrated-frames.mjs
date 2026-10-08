// Calibrated painted-frame check: does a frame drawn during a reverse scroll show text around the
// input card?
//
// This is the single drawing-frame entry point. It relies on `frame-pairing.mjs`, which keeps the three
// clocks apart and reports unmatched frames instead of stretching a tolerance. Per frame it records:
//
//   generated  `metadata.timestamp` (epoch seconds) converted to the page clock via `performance.timeOrigin`
//   delivered  host epoch milliseconds, used only to measure transport delay
//   sampled    `performance.now()` inside the page, with the clip value and inner scroll position
//
// A frame is scanned only when it was paired with an in-page sample inside the tolerance, and the band
// is taken from that sample's geometry. Frames that cannot be placed are counted as unmatched and are
// not used for any verdict. `WM_DELAY_CLIP_FRAMES` is not used here: the third review is right that a
// global animation-frame delay changes the probe as well as the theme, so the negative control has to
// target the clip write itself, which is done in the probe run separately.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createProfile, removeProfile, createRunDirectory, evidencePath, verifyPersisted } from './temp-profile.mjs';
import { pairFramesWithSamples, epochSecondsToPageTime, epochSecondsToEpochMs } from './frame-pairing.mjs';

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
const scenario = process.env.WM_SCENARIO || 'reverse';
const toleranceMs = Number(process.env.WM_PAIR_TOLERANCE_MS || 34);
const keepFrames = process.env.WM_KEEP_FRAMES === '1';

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
  <div class="BynINW_sidebarCol"></div><div class="BynINW_centerCol"><div class="Dc7zOa_root" data-phase="active">
  <div class="Dc7zOa_header"></div><div class="Dc7zOa_body" data-content-phase="active" data-conversation-content>
  <div class="Dc7zOa_scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="Dc7zOa_viewArea">
  <div class="messages" id="messages"></div></div></div>
  <div class="Dc7zOa_composerSeat" data-composer-seat data-conversation-region="composer">
  <div class="composer-toolbar"></div><div class="RlGAzG_card"><textarea style="width:85%;height:60%;color:white;background:transparent" aria-label="draft"></textarea></div>
  <div class="composer-footer"></div></div></div></div></div></div></div></main>
  <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script>
  <script>
    const messages = document.getElementById('messages');
    for (let index = 0; index < 120; index += 1) { const row = document.createElement('div'); row.className = 'message'; messages.append(row); }

    // Sampled once per animation frame: the inner scroll position, the clip value actually applied to
    // the view, and the geometry of the bands. These are the values a frame is matched against.
    window.__sampler = {
      on: false, samples: [], writes: [],
      start() { this.samples = []; this.writes = []; this.on = true; },
      stop() { this.on = false; return { samples: this.samples, writes: this.writes, timeOrigin: performance.timeOrigin }; },
      tick() {
        requestAnimationFrame(() => this.tick());
        if (!this.on) return;
        const view = document.querySelector('.Dc7zOa_viewArea');
        const scroll = document.querySelector('[data-conversation-scroll]');
        const card = document.querySelector('.RlGAzG_card');
        const toolbar = document.querySelector('.composer-toolbar');
        const clip = parseFloat(view.style.getPropertyValue('--wm-history-clip-bottom')) || 0;
        const cardRect = card.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const portRect = scroll.getBoundingClientRect();
        const nativePort = scroll.hasAttribute('data-wm-message-port');
        this.samples.push({
          at: performance.now(),
          scrollTop: Math.round(scroll.scrollTop),
          clip,
          clipped: view.hasAttribute('data-wm-history-clip'),
          card: [Math.round(cardRect.top), Math.round(cardRect.bottom)],
          visibleBottom: Math.round(nativePort ? Math.min(viewRect.bottom, portRect.bottom) : viewRect.bottom - clip),
          nativePort, portBottom: portRect.bottom,
          control: [Math.round(toolbar.getBoundingClientRect().top) - 60, Math.round(toolbar.getBoundingClientRect().top)],
          expectedClip: Math.round(viewRect.bottom - cardRect.top),
          // Is the reference frame itself moving with the scroll? If the view's top edge stays at the
          // scrollport's top, then viewRect.height places the boundary at the scrollport's bottom edge,
          // which lands on the card's top while the composer is seated, without following the content.
          viewTop: Number(viewRect.top.toFixed(1)),
          viewHeight: Number(viewRect.height.toFixed(1)),
          scrollTopEdge: Number(scroll.getBoundingClientRect().top.toFixed(1)),
          scrollBottomEdge: Number(scroll.getBoundingClientRect().bottom.toFixed(1)),
          cardTopRaw: Number(cardRect.top.toFixed(1)),
        });
        if (this.samples.length > 4000) this.samples.shift();
      },
    };
    // Every write to the clip variable, with the value and the page time of the write.
    (function () {
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
        if (name === '--wm-history-clip-bottom' && window.__sampler.on) {
          // Read the geometry at the write itself: a write that catches up after the fact would look
          // correct if it were compared against a nearby animation-frame sample instead.
          const scroll = document.querySelector('[data-conversation-scroll]');
          const card = document.querySelector('.RlGAzG_card');
          const view = document.querySelector('.Dc7zOa_viewArea');
          window.__sampler.writes.push({
            at: performance.now(),
            value: String(value),
            scrollTopAtWrite: scroll ? Math.round(scroll.scrollTop) : null,
            cardTopAtWrite: card && card.getClientRects().length ? Number(card.getBoundingClientRect().top.toFixed(1)) : null,
            viewBottomAtWrite: view && view.getClientRects().length ? Number(view.getBoundingClientRect().bottom.toFixed(1)) : null,
          });
        }
        return original.call(this, name, value, priority);
      };
    })();
    requestAnimationFrame(() => window.__sampler.tick());
  </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-calibrated-frames-');
const url = `http://127.0.0.1:${server.address().port}/`;
const runDir = await createRunDirectory('wm-calibrated-frames');
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
      if (collecting) frames.push({ deliveredAtEpochMs: Date.now(), metadata: params.metadata, data: params.data });
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
  await sleep(250);

  await evaluate('window.__sampler.start()');
  collecting = true;
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  await sleep(150);
  const wheel = async (deltaY, times, interval) => {
    for (let step = 0; step < times; step += 1) {
      await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 520, y: 300, deltaX: 0, deltaY, modifiers: 0, pointerType: 'mouse' });
      await sleep(interval);
    }
  };
  if (scenario === 'reverse') { await wheel(160, 22, 25); await wheel(-160, 22, 25); }
  else if (scenario === 'down') await wheel(160, 25, 25);
  else if (scenario === 'fast') { await wheel(400, 12, 6); await wheel(-400, 12, 6); }
  else if (scenario === 'smooth') {
    await evaluate('document.querySelector("[data-conversation-scroll]").scrollTo({top: 2400, behavior: "smooth"})');
    await sleep(650);
    await evaluate('document.querySelector("[data-conversation-scroll]").scrollTo({top: 0, behavior: "smooth"})');
    await sleep(650);
  }
  else if (scenario === 'static') await sleep(900);
  else throw Error(`unknown scroll scenario: ${scenario}`);
  await sleep(300);
  await cdp('Page.stopScreencast');
  collecting = false;
  const recorded = await evaluate('window.__sampler.stop()');
  assert.ok(recorded.samples.length > 0, 'the sampler recorded samples');

  // Convert each frame's generated time (epoch seconds) to the page clock and pair it.
  const pairingInput = frames.map(frame => ({
    deliveredAtEpochMs: frame.deliveredAtEpochMs,
    generatedPageTime: frame.metadata && Number.isFinite(frame.metadata.timestamp)
      ? epochSecondsToPageTime(frame.metadata.timestamp, recorded.timeOrigin)
      : null,
    generatedAtEpochMs: frame.metadata && Number.isFinite(frame.metadata.timestamp)
      ? epochSecondsToEpochMs(frame.metadata.timestamp)
      : null,
  }));
  const pairing = pairFramesWithSamples(pairingInput, recorded.samples, toleranceMs);

  /** Scans a frame in the bands its own sample describes. */
  const scan = async (data, sample) => {
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
      const sample = ${JSON.stringify(sample)};
      return {
        belowCard: count(sample.card[1] + 1, sample.card[1] + 30),
        aboveComposer: count(sample.control[0], sample.control[1]),
        // Distinguishes two different failures. A boundary that lags keeps the layer's top edge clipped
        // and shows text only near the card. A frame where the clip is not applied at all shows the
        // message bands far above the visible end as well, near the top of the scrollport.
        topOfColumn: count(100, 160),
        midLayer: count(sample.card[0] - 420, sample.card[0] - 360),
      };
    })()`);
  };

  // Each write, with the geometry read at the write itself. This replaces an earlier check that paired
  // a write with the closest animation-frame sample taken before it: that allowed a write which caught
  // up after the fact to look correct, and it observed "no lag" even while frames showed text around
  // the card.
  const writesWithExpectation = recorded.writes.map(write => {
    // The boundary should place the visible end at the card's top edge, measured from the view's own
    // box: inset = viewBottom - cardTop. Both ends are read in the write hook, so the comparison uses
    // the geometry of that moment rather than a nearby animation-frame sample.
    const expected = write.viewBottomAtWrite === null || write.cardTopAtWrite === null
      ? null
      : Number((write.viewBottomAtWrite - write.cardTopAtWrite).toFixed(1));
    return {
      at: Number(write.at.toFixed(1)),
      value: Number(parseFloat(write.value)) || 0,
      scrollTopAtWrite: write.scrollTopAtWrite,
      cardTopAtWrite: write.cardTopAtWrite,
      expectedAtWrite: expected,
      behind: expected === null ? null : (parseFloat(write.value) || 0) < expected - 1,
    };
  });
  const writesBehind = writesWithExpectation.filter(entry => entry.behind === true);

  // The forbidden region is a fixed screen area, so it is read from the run rather than per frame: the
  // card position is asserted constant, and then *every* painted frame is scanned against it. Time
  // pairing stays a diagnostic for the cause; an unmatched frame is still a frame that was painted, so
  // it is never skipped.
  const cardPositions = [...new Set(recorded.samples.map(sample => sample.card.join(',')))];
  const roi = { cardPositions, valid: cardPositions.length === 1, card: recorded.samples[0].card };
  const controlTop = recorded.samples[0].control;
  const fixedSample = { card: roi.card, control: controlTop };

  const matched = [];
  const painted = [];
  for (const [index, frame] of frames.entries()) {
    const counts = await scan(frame.data, fixedSample);
    assert.ok(!counts.error && counts.belowCard && counts.aboveComposer, `invalid painted frame ${index}: ${JSON.stringify(counts)}`);
    painted.push({ frameIndex: index, deliveredAtEpochMs: frame.deliveredAtEpochMs, counts });
  }
  for (const pair of pairing.pairs) {
    const frameIndex = pairingInput.indexOf(pair.frame);
    const counts = painted[frameIndex].counts;
    matched.push({
      frameIndex,
      generatedPageTime: Number(pair.frame.generatedPageTime.toFixed(1)),
      deliveredAtEpochMs: pair.frame.deliveredAtEpochMs,
      deltaMs: pair.deltaMs,
      scrollTop: pair.sample.scrollTop,
      clip: pair.sample.clip,
      topOfColumn: counts.topOfColumn,
      midLayer: counts.midLayer,
      expectedClip: pair.sample.expectedClip,
      generatedAtEpochMs: pair.frame.generatedAtEpochMs,
      visibleBottom: pair.sample.visibleBottom,
      card: pair.sample.card,
      belowCard: counts.belowCard,
      aboveComposer: counts.aboveComposer,
    });
  }

  const staleFrames = matched.filter(entry => entry.visibleBottom > entry.card[0] + 1);
  const paintedLeaking = painted.filter(entry => entry.counts.belowCard && entry.counts.belowCard.hits > 0);
  const paintedWithNormalContent = painted.filter(entry => entry.counts.aboveComposer && entry.counts.aboveComposer.hits > 0).length;
  const leaking = paintedLeaking;
  if (keepFrames) {
    for (const [index, frame] of frames.entries()) await writeFile(join(frameDir, `frame-${String(index).padStart(4, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
  }

  // Did the boundary ever lag behind the scroll position during this run?
  const lagging = recorded.samples.filter(sample => sample.visibleBottom > sample.card[0] + 1);

  const normalContentFrames = matched.filter(entry => entry.aboveComposer && entry.aboveComposer.hits > 0).length;
  const report = {
    isolated: true, scenario, toleranceMs,
    clocks: { timeOrigin: recorded.timeOrigin, offsetMeasured: pairing.calibration.measured, minOffsetMs: pairing.calibration.minOffsetMs, maxOffsetMs: pairing.calibration.maxOffsetMs, early: pairing.calibration.early },
    pairing: pairing.stats,
    referenceFrame: (() => {
      const s = recorded.samples;
      const span = key => { const v = s.map(x => x[key]).filter(x => typeof x === 'number'); return v.length ? { min: Math.min(...v), max: Math.max(...v) } : null; };
      const insets = s.map(x => x.viewHeight - (x.cardTopRaw - x.viewTop));
      return { viewTop: span('viewTop'), viewHeight: span('viewHeight'), scrollTopEdge: span('scrollTopEdge'), scrollBottomEdge: span('scrollBottomEdge'), cardTop: span('cardTopRaw'), insetFromViewHeightMinusOffset: { min: Math.min(...insets), max: Math.max(...insets) } };
    })(),
    sampler: { samples: recorded.samples.length, clipWrites: recorded.writes.length, laggingSamples: lagging.length, scrollRange: [Math.min(...recorded.samples.map(s => s.scrollTop)), Math.max(...recorded.samples.map(s => s.scrollTop))] },
    clipWrites: { total: writesWithExpectation.length, behind: writesBehind.length, firstBehind: writesBehind.slice(0, 5), samples: writesWithExpectation.slice(0, 20) },
    roi,
    normalContentFrames,
    matched: matched.map(entry => ({
      ...entry,
      belowCard: entry.belowCard ? entry.belowCard.hits : null,
      aboveComposer: entry.aboveComposer ? entry.aboveComposer.hits : null,
      topOfColumn: entry.topOfColumn ? entry.topOfColumn.hits : null,
      midLayer: entry.midLayer ? entry.midLayer.hits : null,
      deliveryDelayMs: entry.generatedAtEpochMs === null || entry.generatedAtEpochMs === undefined
        ? null : Number((entry.deliveredAtEpochMs - entry.generatedAtEpochMs).toFixed(1)),
    })),
    staleFrames: staleFrames.length,
    paintedFrames: painted.length,
    leakingFrames: leaking.length,
    paintedLeakingFrames: paintedLeaking.length,
    paintedWithNormalContent,
    raw: { metadata: frames.map(frame => ({deliveredAtEpochMs: frame.deliveredAtEpochMs, metadata: frame.metadata})), samples: recorded.samples, writes: recorded.writes, painted },
  };
  const out = await evidencePath('WM_CALIBRATED_OUTPUT', runDir, 'calibrated-frames.json');
  await writeFile(out, JSON.stringify(report, null, 2), { flag: 'w' });
  const persisted = await verifyPersisted(out);
  console.log('WRITES ' + JSON.stringify({ total: writesWithExpectation.length, behind: writesBehind.length, first: writesBehind.slice(0, 3) }));
  console.log('ROI ' + JSON.stringify(roi));
  console.log('CALIB ' + JSON.stringify({ scenario, frames: frames.length, matched: pairing.stats.matched, unmatched: pairing.stats.unmatched, meanDeltaMs: pairing.stats.meanDeltaMs, distinctScrollTops: pairing.stats.distinctScrollTops, samplerLagging: lagging.length, staleFrames: staleFrames.length, normalContentFrames, leakingFrames: leaking.length }));
  console.log(`report ${out} (${persisted.bytes} bytes)`);

  if (process.env.WM_STRICT === '1' || process.argv.includes('--strict')) {
    // Strict mode: this is the gate. Every condition is required, and a scenario that cannot be judged
    // fails rather than passing quietly.
    assert.ok(frames.length > 0, 'strict: no painted frame was received');
    assert.ok(roi.valid, `strict: the card is not at a fixed screen position, so the forbidden region is not defined: ${JSON.stringify(roi.cardPositions)}`);
    assert.ok(recorded.samples.every(sample => !sample.nativePort || sample.portBottom <= sample.cardTopRaw + 1), 'strict: native viewport extends below the card');
    assert.ok(pairing.stats.matched > 0, 'strict: no frame could be paired with an in-page sample');
    assert.ok(paintedWithNormalContent > 0, 'strict: no painted frame showed the normal content above the composer, so the scan is not reading the message layer');
    if (scenario !== 'static') assert.ok(recorded.samples.some(sample => sample.scrollTop > 100), 'strict: the scenario did not scroll the message layer');
    assert.equal(leaking.length, 0,
      `strict: message pixels were painted in the fixed forbidden region below the send box: ${JSON.stringify(leaking.slice(0, 6).map(entry => ({ frameIndex: entry.frameIndex, hits: entry.counts.belowCard.hits, rows: entry.counts.belowCard.rows })))}`);
    console.log('strict scroll frames passed: fixed forbidden region clean, control band painted');
  } else {
    console.log('diagnostic mode: counts above only; run with WM_STRICT=1 to fail on message pixels below the card');
  }
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  await removeProfile(profile);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
