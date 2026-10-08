// Isolated browser reproduction for the per-region backgrounds: which areas cover the wallpaper
// with their own theme colour. Same harness as the history-clip pixel check: real client, recorded
// official host CSS, magenta wallpaper, no Desktop and no Wallpaper Engine.
//
// For each of the four switch combinations it measures the sidebar and the chat column, and it
// records the frame, the title bar strip and the composer so a change that also repaints those is
// caught. The two defaults are off, so the first case is the previous release's behaviour.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createProfile, removeProfile, createRunDirectory, evidencePath, verifyPersisted } from './temp-profile.mjs';

const qa = process.env.WM_QA_ROOT || dirname(fileURLToPath(import.meta.url));
const files = {
  '/client.js': await readFile(process.env.WM_CLIENT_SOURCE || join(qa, '../src/client.js')),
  '/harness.js': await readFile(join(qa, 'appearance-harness.js')),
  '/fixture.js': await readFile(join(qa, 'appearance-wallpaper-fixture.js')),
  '/host.css': await readFile(process.env.WM_OFFICIAL_CSS || join(qa, 'fixtures/conversation-host-rc2.css')),
};
const WALLPAPER = [255, 0, 255];
// The theme colours the two regions must use, written by the page below so the reading is exact.
const SIDEBAR_COLOUR = [15, 23, 38];
const CHAT_COLOUR = [8, 11, 20];

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
  .BynINW_sidebarCol{position:absolute;left:0;top:32px;bottom:0;width:160px}
  .BynINW_centerCol{position:absolute;left:160px;right:0;top:32px;bottom:0}
  .Dc7zOa_root{height:100%}.Dc7zOa_header{height:60px;min-height:60px}
  .Dc7zOa_body{flex:1;min-height:0;display:flex;flex-direction:column}
  [data-slot="conversation.session"]{display:contents}
  .history{height:2200px;flex:none;color:yellow;font:20px/24px monospace;
    background:repeating-linear-gradient(yellow 0px,yellow 8px,transparent 8px,transparent 16px)}
  .RlGAzG_card{width:72%;height:120px;box-sizing:border-box;border-radius:20px;align-self:center}
  .composer-toolbar{height:24px;flex:none}.composer-footer{height:28px;flex:none}
  #wm-backdrop{background:magenta!important}.wm-backdrop-media{visibility:hidden!important}
  .wm-backdrop-mask{background:transparent!important} *{transition:none!important;animation:none!important}
  </style></head><body><main id="root"><div class="BynINW_frame">
  <div class="BynINW_sidebarCol"></div><div class="BynINW_centerCol"><div class="Dc7zOa_root" data-phase="active">
  <div class="Dc7zOa_header"></div><div class="Dc7zOa_body" data-content-phase="active" data-conversation-content>
  <div class="Dc7zOa_scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="Dc7zOa_viewArea">
  <div class="history">LONG CHAT HISTORY<br>TEXT MUST DISAPPEAR AT INPUT AREA</div></div></div>
  <div class="Dc7zOa_composerSeat" data-composer-seat data-conversation-region="composer">
  <div class="composer-toolbar"></div><div class="RlGAzG_card"><textarea style="width:85%;height:60%;color:white;background:transparent" aria-label="draft"></textarea></div>
  <div class="composer-footer"></div></div></div></div></div></div></div></main>
  <script src="/harness.js"></script><script src="/fixture.js"></script>
  <script>
    // The theme's own colours for this state, written before the client boots so both the theme and
    // this check read the same values instead of relying on a palette constant.
    document.body.style.setProperty('--wm-base-rgb', '${CHAT_COLOUR.join(' ')}');
    document.body.style.setProperty('--wm-sidebar-rgb', '${SIDEBAR_COLOUR.join(' ')}');
    document.body.style.setProperty('--wm-layer1-rgb', '15 23 38');
    document.body.style.setProperty('--wm-layer2-rgb', '23 34 54');
    document.body.style.setProperty('--wm-layer3-rgb', '28 40 62');
  </script>
  <script src="/client.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await createProfile('wm-region-');
const runDir = await createRunDirectory('qa-run');
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', url,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
const reports = [];
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
    const timer = setTimeout(() => { pending.delete(key); reject(Error(`${method} timeout`)); }, 15000);
    pending.set(key, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
  for (let attempt = 0; attempt < 50 && !await evaluate('Boolean(window.fixture?.boot && window.whaleModule)'); attempt++) await sleep(100);

  // Boot with a wallpaper background and both switches left at their defaults.
  await evaluate(`(async () => {
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', palette: 'ocean', canvas: 'clear', background: 'wallpaper', weMode: 'daily', surface: 40 }));
    fixture.boot();
    await fixture.controller.wallpaper.start('lucy');
    await fixture.wait(() => document.body.dataset.wmBackdrop === 'wallpaper');
    return true;
  })()`);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
  await sleep(120);

  // The stored defaults must survive a boot: an old configuration has no region fields at all.
  const defaults = await evaluate(`(() => { const read = fixture.controller.read(); return { sidebar: read.opaqueSidebar, chat: read.opaqueChat, stored: JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')) }; })()`);
  assert.equal(defaults.sidebar, false, 'a stored configuration without the field keeps the sidebar switch off');
  assert.equal(defaults.chat, false, 'a stored configuration without the field keeps the chat switch off');

  const snapshot = async () => {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    return evaluate(`(async () => {
      const image = new Image();
      image.src = ${JSON.stringify('data:image/png;base64,' + shot.data)};
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const at = (x, y) => Array.from(context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data).slice(0, 3);
      const sidebar = box('.BynINW_sidebarCol');
      const center = box('.BynINW_centerCol');
      const frame = box('.BynINW_frame');
      const header = box('.Dc7zOa_header');
      const body = box('.Dc7zOa_body');
      const card = box('.RlGAzG_card');
      const seat = box('[data-composer-seat]');
      return {
        sidebarPixel: at(sidebar.left + sidebar.width / 2, sidebar.top + sidebar.height / 2),
        // The conversation header (session title and the conversation/trace tabs) and the body are
        // sampled separately: the chat switch has to cover both, which is what R7 fixed.
        headerPixel: at(header.left + 20, header.top + header.height / 2),
        headerMiddlePixel: at((header.left + header.right) / 2, header.top + header.height / 2),
        chatPixel: at(body.left + 20, body.top + 40),
        chatMiddle: at((body.left + body.right) / 2, body.top + body.height * 0.55),
        // The column corner, above the header: also part of the right-hand column.
        columnCorner: at(center.left + 20, center.top + 6),
        columnTip: at(center.left + 2, center.top + 2),
        columnRadius: getComputedStyle(document.querySelector('.BynINW_centerCol')).borderTopLeftRadius,
        strip: at(frame.left + frame.width / 2, 12),
        card: at(card.left + 8, card.top + 40),
        seatBeside: at(seat.left + 8, seat.top + 8),
        below: at((card.left + card.right) / 2, card.bottom + 8),
        backgrounds: {
          frame: getComputedStyle(document.querySelector('.BynINW_frame')).backgroundColor,
          center: getComputedStyle(document.querySelector('.BynINW_centerCol')).backgroundColor,
          body: getComputedStyle(document.querySelector('.Dc7zOa_body')).backgroundColor,
          header: getComputedStyle(document.querySelector('.Dc7zOa_header')).backgroundColor,
        },
        region: { sidebar: document.body.dataset.wmOpaqueSidebar ?? null, chat: document.body.dataset.wmOpaqueChat ?? null },
        read: (() => { const value = fixture.controller.read(); return { sidebar: value.opaqueSidebar, chat: value.opaqueChat }; })(),
      };
    })()`);
  };

  const near = (pixel, expected, tolerance = 12) =>
    Math.abs(pixel[0] - expected[0]) <= tolerance && Math.abs(pixel[1] - expected[1]) <= tolerance && Math.abs(pixel[2] - expected[2]) <= tolerance;
  const isWallpaper = pixel => pixel[0] - pixel[1] > 60 && pixel[2] - pixel[1] > 60;

  // Negative controls: each one breaks exactly one promise of this feature. A control that does not
  // actually change the rendering is not a control, so the case that should notice it is named here
  // and checked after injection; a control that silently did nothing would otherwise let the run
  // report a pass that means nothing.
  const mutants = {
    // The two switches must stay independent: this makes the sidebar switch paint the chat column.
    // The selector is spelled the way the page actually carries the flag (the attribute is on the
    // body), because a selector that never matches is a control that proves nothing.
    linkRegions: {
      css: 'body[data-wm-opaque-sidebar] .Dc7zOa_body{background:rgb(var(--wm-base-rgb))!important}',
      expect: 'sidebar on: the chat column still shows the wallpaper',
    },
    // The rc.18 shape of this feature: with the chat switch on, only the body was painted, so the
    // conversation header and its tabs kept showing the wallpaper. It must fail on the header.
    // The paint and the override are two separate rules: the theme's own rule carries `!important`,
    // so an override that is merely more specific loses, and one without `!important` changes
    // nothing at all. Both mistakes were made here before the control actually reproduced rc.18.
    bodyOnlyPainter: {
      css: 'body[data-wm-opaque-chat] .Dc7zOa_body{background:rgb(var(--wm-base-rgb))!important} body[data-wm-opaque-chat] .BynINW_centerCol:not(#wm-a):not(#wm-b){background:transparent!important}',
      expect: 'default: the conversation header is covered when the chat switch is on',
    },
    // A rule that painted the whole centre column unconditionally: that is "the other regions must
    // not be dragged along". Note that painting the column when the chat switch is ON is now the
    // intended behaviour, so this control is about doing it with the switch off.
    outsidePainter: {
      css: '#root .BynINW_centerCol{background:rgb(8,11,20)!important}',
      expect: 'default: the column corner still shows the wallpaper',
    },
    // The composer must not be painted at all; only the card is opaque.
    solidComposer: {
      css: '#root [data-composer-seat]{background:rgb(8,11,20)!important}',
      expect: 'default: the area beside the input card still shows the wallpaper',
    },
  };
  const cases = [
    ['default off/off', false, false],
    ['sidebar on', true, false],
    ['chat on', false, true],
    ['both on', true, true],
  ];
  for (const [label, sidebar, chat] of cases) {
    await evaluate(`(async () => { fixture.controller.set('opaqueSidebar', ${sidebar}); fixture.controller.set('opaqueChat', ${chat}); return true; })()`);
    await sleep(120);
    const state = await snapshot();
    reports.push({ label, sidebar, chat, ...state });
    console.log(JSON.stringify({ label, sidebar, chat, sidebarPixel: state.sidebarPixel, chatPixel: state.chatPixel, columnCorner: state.columnCorner, backgrounds: state.backgrounds, region: state.region }));
  }

  // The negative control is applied only now, with both switches back to their defaults, and it is
  // compared against the same state the targeted check describes. Injecting it earlier would let it
  // fail some unrelated case and prove nothing about the promise it is supposed to break.
  const mutant = process.env.WM_REGION_MUTANT;
  let mutantState = null;
  if (mutant) {
    assert.ok(mutants[mutant], `known negative control, got ${mutant}`);
    await evaluate(`(async () => { fixture.controller.set('opaqueSidebar', false); fixture.controller.set('opaqueChat', false); return true; })()`);
    await sleep(120);
    const injected = await evaluate(`(() => { const style = document.createElement('style'); style.textContent = ${JSON.stringify(mutants[mutant].css)}; document.head.append(style); return style.textContent; })()`);
    assert.equal(injected, mutants[mutant].css, 'the negative control stylesheet was injected');
    await sleep(80);
    mutantState = await snapshot();
  }
  const expectFailure = mutant ? mutants[mutant].expect : null;
  // The controls target specific combinations, so those combinations are measured with the mutation
  // in place rather than assuming the default state speaks for them.
  let mutantSidebarOnly = null;
  if (mutant === 'linkRegions') {
    await evaluate(`(async () => { fixture.controller.set('opaqueSidebar', true); fixture.controller.set('opaqueChat', false); return true; })()`);
    await sleep(120);
    mutantSidebarOnly = await snapshot();
  }
  let mutantChatOnly = null;
  if (mutant === 'bodyOnlyPainter') {
    await evaluate(`(async () => { fixture.controller.set('opaqueSidebar', false); fixture.controller.set('opaqueChat', true); return true; })()`);
    await sleep(120);
    mutantChatOnly = await snapshot();
  }

  const out = await evidencePath('WM_REGION_OUTPUT', runDir, 'regions.json');
  await writeFile(out, JSON.stringify({ isolated: true, wallpaper: WALLPAPER, sidebarColour: SIDEBAR_COLOUR, chatColour: CHAT_COLOUR, reports }, null, 2), { flag: 'w' });

  const [offOff, sidebarOn, chatOn, bothOn] = reports;
  // Every check records its failure and keeps going, so a negative control can be compared against
  // the failure it was supposed to cause. Stopping at the first one would hide whether a control
  // broke the thing it targets or something unrelated.
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  // Defaults: both regions keep the previous release's behaviour, i.e. the wallpaper reaches them.
  check(isWallpaper(offOff.sidebarPixel), `default: the wallpaper reaches the sidebar, got ${JSON.stringify(offOff.sidebarPixel)}`);
  check(isWallpaper(offOff.chatPixel), `default: the wallpaper reaches the chat column, got ${JSON.stringify(offOff.chatPixel)}`);
  // Sidebar switch: that region alone becomes the theme's sidebar colour, the chat column does not.
  check(near(sidebarOn.sidebarPixel, SIDEBAR_COLOUR), `sidebar on: the sidebar is the theme colour, got ${JSON.stringify(sidebarOn.sidebarPixel)}`);
  check(isWallpaper(sidebarOn.chatPixel), `sidebar on: the chat column still shows the wallpaper, got ${JSON.stringify(sidebarOn.chatPixel)}`);
  check(isWallpaper(sidebarOn.headerPixel), `sidebar on: the conversation header still shows the wallpaper, got ${JSON.stringify(sidebarOn.headerPixel)}`);
  // Chat switch: that region alone becomes the base colour, header and tabs included, and the
  // sidebar does not. The header is checked separately because that is exactly what rc.18 missed.
  check(near(chatOn.chatPixel, CHAT_COLOUR), `chat on: the chat body is the theme colour, got ${JSON.stringify(chatOn.chatPixel)}`);
  check(near(chatOn.chatMiddle, CHAT_COLOUR), `chat on: the whole column is covered, got ${JSON.stringify(chatOn.chatMiddle)}`);
  check(near(chatOn.headerPixel, CHAT_COLOUR), `chat on: the conversation header is covered, got ${JSON.stringify(chatOn.headerPixel)}`);
  check(near(chatOn.headerMiddlePixel, CHAT_COLOUR), `chat on: the tab strip is covered, got ${JSON.stringify(chatOn.headerMiddlePixel)}`);
  check(near(chatOn.columnCorner, CHAT_COLOUR), `chat on: the top of the column is covered, got ${JSON.stringify(chatOn.columnCorner)}`);
  check(isWallpaper(chatOn.sidebarPixel), `chat on: the sidebar still shows the wallpaper, got ${JSON.stringify(chatOn.sidebarPixel)}`);
  // Both: independently satisfied, which is what rules out one switch driving the other.
  check(near(bothOn.sidebarPixel, SIDEBAR_COLOUR), `both on: the sidebar is the theme colour, got ${JSON.stringify(bothOn.sidebarPixel)}`);
  check(near(bothOn.chatPixel, CHAT_COLOUR), `both on: the chat body is the theme colour, got ${JSON.stringify(bothOn.chatPixel)}`);
  check(near(bothOn.headerPixel, CHAT_COLOUR), `both on: the conversation header is covered, got ${JSON.stringify(bothOn.headerPixel)}`);
  for (const report of reports) {
    check(report.chat ? near(report.columnTip, CHAT_COLOUR) : isWallpaper(report.columnTip),
      `${report.label}: the upper-left tip follows the chat background choice, got ${JSON.stringify(report.columnTip)}`);
    check(report.columnRadius === (report.chat ? '0px' : '16px'),
      `${report.label}: the host corner is only squared for opaque chat, got ${report.columnRadius}`);
  }
  // With the chat switch off, the header must keep the wallpaper like the rest of the column.
  check(isWallpaper(offOff.headerPixel), `default: the wallpaper reaches the conversation header, got ${JSON.stringify(offOff.headerPixel)}`);
  // The regions report themselves consistently with the requested combination: the controller holds
  // booleans and the projected attributes appear exactly when a region is on.
  for (const report of reports) {
    check(report.read.sidebar === report.sidebar, `${report.label}: the controller holds the sidebar flag`);
    check(report.read.chat === report.chat, `${report.label}: the controller holds the chat flag`);
    check(report.region.sidebar === (report.sidebar ? 'true' : null), `${report.label}: the sidebar attribute follows the flag`);
    check(report.region.chat === (report.chat ? 'true' : null), `${report.label}: the chat attribute follows the flag`);
  }
  // Nothing outside the two regions may move: the title bar strip, the frame and the input card keep
  // their own colours whatever the switches are set to. The samples inside the composer seat are not
  // in this list on purpose: that area is part of the chat column, so the chat switch covers it, and
  // the card above it is what must stay untouched.
  for (const report of reports) {
    check(!isWallpaper(report.strip), `${report.label}: the title bar stays opaque, got ${JSON.stringify(report.strip)}`);
    check(!isWallpaper(report.card), `${report.label}: the input card stays opaque, got ${JSON.stringify(report.card)}`);
    // The column corner is inside the chat column's region: with that switch off it must still reach
    // the background, which is also what catches a rule painting beyond its own container.
    if (report.chat === false) {
      check(isWallpaper(report.columnCorner), `${report.label}: the column corner still shows the wallpaper, got ${JSON.stringify(report.columnCorner)}`);
    }
    // The composer's own strips belong to the chat column as well, so they follow the chat switch;
    // the card above them is the only opaque thing there.
    if (report.chat === false) {
      check(isWallpaper(report.seatBeside), `${report.label}: the area beside the input card still shows the wallpaper, got ${JSON.stringify(report.seatBeside)}`);
      check(isWallpaper(report.below), `${report.label}: the strip below the input card still shows the wallpaper, got ${JSON.stringify(report.below)}`);
    }
    const reference = reports[0];
    for (const key of ['strip', 'card']) {
      const delta = report[key].reduce((sum, value, index) => sum + Math.abs(value - reference[key][index]), 0);
      check(delta <= 12, `${report.label}: ${key} is unchanged by the region switches, got ${JSON.stringify(report[key])} against ${JSON.stringify(reference[key])}`);
    }
  }
  // With both defaults off the history must still be clipped away from the input area: the region
  // feature must not have replaced the message protection.
  await evaluate(`(async () => { fixture.controller.set('opaqueSidebar', false); fixture.controller.set('opaqueChat', false); return true; })()`);
  await sleep(120);
  const clip = await evaluate(`(() => ({ clipped: document.querySelectorAll('[data-wm-history-clip]').length, value: document.querySelector('.Dc7zOa_viewArea').style.getPropertyValue('--wm-history-clip-bottom') }))()`);
  check(clip.clipped >= 1, 'the history clip is still applied with the region switches off');
  check(/px$/.test(clip.value), `the history clip has a measured inset, got ${clip.value}`);

  // The two switches as the user reaches them: the rendered settings nodes must carry the right
  // checkbox state and their change handler must drive the controller, not only the store.
  const switches = await evaluate(`(() => {
    const nodes = fixture.controls();
    const find = key => nodes.find(node => node.props && node.props['data-wm-setting'] === key && node.props.type === 'checkbox');
    return ['opaqueSidebar', 'opaqueChat'].map(key => {
      const node = find(key);
      return node ? { key, checked: node.props.checked, type: node.props.type } : { key, missing: true };
    });
  })()`);
  for (const entry of switches) {
    check(!entry.missing, `${entry.key}: the settings panel renders a checkbox for it`);
    if (!entry.missing) {
      check(entry.type === 'checkbox', `${entry.key}: the control is a checkbox, got ${entry.type}`);
      check(entry.checked === false, `${entry.key}: the checkbox starts unchecked, got ${entry.checked}`);
    }
  }
  const toggled = await evaluate(`(async () => {
    const find = key => fixture.controls().find(node => node.props && node.props['data-wm-setting'] === key && node.props.type === 'checkbox');
    const box = find('opaqueSidebar');
    await box.props.onChange({ currentTarget: { checked: true } });
    const after = { read: fixture.controller.read().opaqueSidebar, attribute: document.body.dataset.wmOpaqueSidebar ?? null };
    const again = find('opaqueSidebar');
    after.checked = again.props.checked;
    await again.props.onChange({ currentTarget: { checked: false } });
    after.cleared = { read: fixture.controller.read().opaqueSidebar, attribute: document.body.dataset.wmOpaqueSidebar ?? null };
    return after;
  })()`);
  check(toggled.read === true, 'clicking the sidebar checkbox stores true');
  check(toggled.attribute === 'true', 'clicking the sidebar checkbox projects the attribute');
  check(toggled.checked === true, 'the checkbox reflects the stored value after the click');
  check(toggled.cleared.read === false && toggled.cleared.attribute === null,
    `unchecking the sidebar checkbox clears both, got ${JSON.stringify(toggled.cleared)}`);

  // Persistence and the migration path: a saved true survives a restart, an old or corrupt value
  // lands on the off state instead of switching a region on.
  const stored = await evaluate(`(async () => {
    await fixture.controller.wallpaper.stop();
    await new Promise(resolve => setTimeout(resolve, 120));
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', palette: 'ocean', canvas: 'clear', background: 'wallpaper', opaqueSidebar: true, opaqueChat: 'yes' }));
    fixture.dispose();
    fixture.wallpaperHost();
    fixture.boot();
    const read = fixture.controller.read();
    return { sidebar: read.opaqueSidebar, chat: read.opaqueChat, sidebarAttribute: document.body.dataset.wmOpaqueSidebar ?? null, chatAttribute: document.body.dataset.wmOpaqueChat ?? null };
  })()`);
  check(stored.sidebar === true, 'a stored true is kept');
  check(stored.chat === false, `a stored non-boolean falls back to off, got ${stored.chat}`);
  check(stored.sidebarAttribute === 'true' && stored.chatAttribute === null,
    `the projected attributes follow the restored values, got ${JSON.stringify(stored)}`);

  // Reset returns both regions to the default, and the panel's own reset control is what does it.
  const afterReset = await evaluate(`(async () => {
    fixture.controller.set('opaqueSidebar', true);
    fixture.controller.set('opaqueChat', true);
    const resetNode = fixture.controls().find(node => node.props && node.props.className === 'wm-settings-reset');
    const hasReset = Boolean(resetNode);
    if (resetNode) await resetNode.props.onClick();
    else fixture.controller.reset();
    const read = fixture.controller.read();
    return { hasReset, sidebar: read.opaqueSidebar, chat: read.opaqueChat, sidebarAttribute: document.body.dataset.wmOpaqueSidebar ?? null, chatAttribute: document.body.dataset.wmOpaqueChat ?? null };
  })()`);
  check(afterReset.hasReset, 'the settings panel exposes a reset control');
  check(afterReset.sidebar === false && afterReset.chat === false,
    `reset returns both regions to off, got ${JSON.stringify(afterReset)}`);
  check(afterReset.sidebarAttribute === null && afterReset.chatAttribute === null,
    'reset clears the projected attributes');

  // With no background selected the preference is kept but nothing is painted, and the opaque theme
  // is untouched.
  const inactive = await evaluate(`(async () => {
    fixture.controller.set('opaqueSidebar', true);
    fixture.controller.set('opaqueChat', true);
    fixture.controller.set('background', 'none');
    await new Promise(resolve => setTimeout(resolve, 120));
    const sidebar = getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor;
    return { read: { sidebar: fixture.controller.read().opaqueSidebar, chat: fixture.controller.read().opaqueChat }, sidebar };
  })()`);
  check(inactive.read.sidebar === true && inactive.read.chat === true, 'the preference survives with no background');
  check(inactive.sidebar === 'rgba(15, 23, 38, 0.94)',
    `no region paint happens without a background, got ${inactive.sidebar}`);

  // The switches must not be able to end a running background: setting them leaves the session alone.
  const whileRunning = await evaluate(`(async () => {
    fixture.controller.set('background', 'wallpaper');
    await fixture.controller.wallpaper.start('lucy');
    await fixture.wait(() => document.body.dataset.wmBackdrop === 'wallpaper');
    const before = { starts: fixture.preview.starts, stops: fixture.preview.stopped, frames: fixture.preview.frames };
    fixture.controller.set('opaqueSidebar', true);
    fixture.controller.set('opaqueChat', true);
    await new Promise(resolve => setTimeout(resolve, 150));
    return { before, after: { starts: fixture.preview.starts, stops: fixture.preview.stopped }, background: document.body.dataset.wmBackdrop ?? null };
  })()`);
  check(whileRunning.after.starts === whileRunning.before.starts && whileRunning.after.stops === whileRunning.before.stops,
    `the switches do not start or stop a run, got ${JSON.stringify(whileRunning)}`);
  check(whileRunning.background === 'wallpaper', 'the background keeps running while the switches change');

  // Stopping restores theme paint and history clipping. Preference attributes may remain while
  // the appearance plugin is active; disposal removes those projections.
  const stopped = await evaluate(`(async () => {
    await fixture.controller.wallpaper.stop();
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      sidebarAttribute: document.body.dataset.wmOpaqueSidebar ?? null,
      chatAttribute: document.body.dataset.wmOpaqueChat ?? null,
      backdrop: document.body.dataset.wmBackdrop ?? null,
      clipped: document.querySelectorAll('[data-wm-history-clip]').length,
      sidebarBackground: getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor,
      preference: { sidebar: fixture.controller.read().opaqueSidebar, chat: fixture.controller.read().opaqueChat },
    };
  })()`);
  check(stopped.backdrop === null, `stopping clears the background state, got ${stopped.backdrop}`);
  check(stopped.clipped === 0, `stopping restores the host message layer, got ${stopped.clipped} clipped views`);
  check(stopped.preference.sidebar === true && stopped.preference.chat === true,
    'the preference is still kept after stopping');
  // The region attributes belong to the appearance projection, like the theme and palette attributes,
  // so they stay while the preference does. What must not stay is a paint: with the background gone
  // the sidebar is back to the theme's own translucent fill.
  check(stopped.sidebarBackground === 'rgba(15, 23, 38, 0.94)',
    `with the background stopped the sidebar returns to the theme fill, got ${stopped.sidebarBackground}`);

  // The region colour follows the theme's own palette and sidebar setting, which is the requirement
  // that the two regions use "the corresponding theme solid colour" rather than a fixed value.
  const paletteColours = await evaluate(`(async () => {
    fixture.controller.set('opaqueSidebar', true);
    const seen = {};
    for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
      fixture.controller.set('palette', palette);
      await new Promise(resolve => setTimeout(resolve, 80));
      seen[palette] = getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor;
    }
    fixture.controller.set('palette', 'ocean');
    fixture.controller.set('sidebar', 'balanced');
    await new Promise(resolve => setTimeout(resolve, 80));
    const balanced = getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor;
    fixture.controller.set('sidebar', 'deep');
    await new Promise(resolve => setTimeout(resolve, 80));
    const deep = getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor;
    fixture.controller.set('sidebar', 'balanced');
    fixture.controller.set('opaqueSidebar', false);
    return { seen, balanced, deep };
  })()`);
  check(new Set(Object.values(paletteColours.seen)).size === 4,
    `each palette gives the sidebar its own colour, got ${JSON.stringify(paletteColours.seen)}`);
  const brightness = value => {
    const parts = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!parts) return null;
    const [r, g, b] = parts[1].split(',').map(part => parseFloat(part));
    return r + g + b;
  };
  check(brightness(paletteColours.deep) < brightness(paletteColours.balanced),
    `the deep sidebar colour is darker than the balanced one, got ${paletteColours.deep} against ${paletteColours.balanced}`);

  // Active-state supplement: palette checks above run AFTER playback stopped. Exercise the
  // actual active state, both UI callbacks, media kinds and migration/teardown separately.
  const supplement = mutant ? null : await evaluate(`(async () => {
    const rows=[];
    const must=(value,message)=>{if(!value)throw Error(message);};
    const tick=()=>new Promise(resolve=>setTimeout(resolve,100));
    const css=selector=>getComputedStyle(document.querySelector(selector));
    const expected=name=>{const probe=document.createElement('span');probe.style.color='rgb('+getComputedStyle(document.body).getPropertyValue(name)+')';document.body.append(probe);const colour=getComputedStyle(probe).color;probe.remove();return colour;};
    await fixture.controller.wallpaper.start('lucy');
    await fixture.wait(()=>document.body.dataset.wmBackdrop==='wallpaper');
    // The DS fixture wrote ocean RGB values inline; those would override every palette stylesheet.
    // Let the real theme resolve its own colours before claiming active-palette coverage.
    for(const name of ['--wm-base-rgb','--wm-sidebar-rgb','--wm-layer1-rgb','--wm-layer2-rgb','--wm-layer3-rgb'])document.body.style.removeProperty(name);
    const start=fixture.preview.starts,stop=fixture.preview.stopped;
    const inspect=async(label)=>{
      fixture.controller.set('opaqueSidebar',true);fixture.controller.set('opaqueChat',true);await tick();
      // The chat region is now painted on the column, so that is the drawing container to compare.
      // The body keeps its own background from the host, which is why comparing it would be wrong.
      const row={label,background:document.body.dataset.wmBackdrop,sidebar:css('.BynINW_sidebarCol').backgroundColor,chat:css('.BynINW_centerCol').backgroundColor,sidebarExpected:expected('--wm-sidebar-rgb'),chatExpected:expected('--wm-base-rgb'),frame:css('.BynINW_frame').backgroundColor};
      must(row.sidebar===row.sidebarExpected,label+': active sidebar uses opaque palette colour');
      must(row.chat===row.chatExpected,label+': active chat uses opaque palette colour');
      must(row.frame==='rgba(0, 0, 0, 0)',label+': frame remains clear');
      must(document.querySelectorAll('[data-wm-history-clip]').length===1,label+': history clip kept');
      rows.push(row);
    };
    for(const palette of ['ocean','graphite','violet','jade']){
      fixture.controller.set('palette',palette);
      for(const sidebar of ['balanced','deep']){fixture.controller.set('sidebar',sidebar);await inspect('active-'+palette+'-'+sidebar);}
    }
    fixture.controller.set('theme','mist');await inspect('active-light');
    const balanced=rows.filter(row=>row.label.endsWith('-balanced'));
    must(new Set(balanced.map(row=>row.sidebar)).size===4,'four active dark palettes have distinct sidebar colours');
    const sum=colour=>colour.match(/[0-9.]+/g).slice(0,3).map(Number).reduce((a,b)=>a+b,0);
    for(const row of balanced){const deep=rows.find(other=>other.label===row.label.replace('-balanced','-deep'));must(sum(deep.sidebar)<sum(row.sidebar),row.label+': deep active fill is darker');}
    must(sum(rows.at(-1).sidebar)>sum(balanced[0].sidebar),'light active fill is lighter than ocean');
    must(fixture.preview.starts===start&&fixture.preview.stopped===stop,'theme/region changes preserve same WE run');
    fixture.controller.set('theme','abyss');fixture.controller.set('palette','ocean');fixture.controller.set('sidebar','balanced');
    for(const key of ['opaqueSidebar','opaqueChat']){
      fixture.controller.set(key,false);
      const find=()=>fixture.controls().find(node=>node.props?.['data-wm-setting']===key);
      const control=find();must(control&&control.props.type==='checkbox',key+': checkbox exists');
      await control.props.onChange({currentTarget:{checked:true}});
      must(fixture.controller.read()[key]===true&&find().props.checked===true,key+': UI enables setting');
      await find().props.onChange({currentTarget:{checked:false}});
      must(fixture.controller.read()[key]===false&&find().props.checked===false,key+': UI disables setting');
    }
    await fixture.controller.importMedia('image',await fixture.makeImage());await fixture.wait(()=>document.body.dataset.wmBackdrop==='image');await inspect('image');
    await fixture.controller.importMedia('video',await fixture.makeVideo());await fixture.wait(()=>document.body.dataset.wmBackdrop==='video');await inspect('video');
    fixture.controller.set('background','none');await tick();
    must(css('.Dc7zOa_body').backgroundColor==='rgba(0, 0, 0, 0)','none: chat has no region paint');
    must(css('.BynINW_sidebarCol').backgroundColor==='rgba(15, 23, 38, 0.94)','none: sidebar restores theme fill');
    must(document.querySelectorAll('[data-wm-history-clip]').length===0,'none: clipping removed');
    fixture.dispose();
    must(!document.body.hasAttribute('data-wm-opaque-sidebar')&&!document.body.hasAttribute('data-wm-opaque-chat'),'dispose: projected flags removed');
    for(const value of ['true','yes',1,0,null,{},false,true]){
      localStorage.setItem('dsh-whale-mist.appearance.v1',JSON.stringify({theme:'abyss',opaqueSidebar:value,opaqueChat:value,background:'none'}));
      fixture.boot();const read=fixture.controller.read();must(read.opaqueSidebar===(value===true)&&read.opaqueChat===(value===true),'strict migration for '+JSON.stringify(value));fixture.dispose();
    }
    localStorage.setItem('dsh-whale-mist.appearance.v1',JSON.stringify({theme:'abyss',palette:'ocean',canvas:'clear',opaqueSidebar:true,opaqueChat:true,background:'none'}));
    fixture.wallpaperHost();fixture.boot();const saved=fixture.controller.read();
    must(saved.opaqueSidebar===true&&saved.opaqueChat===true,'both true survive reopen');
    fixture.controller.set('opaqueSidebar',false);fixture.controller.set('opaqueChat',false);fixture.dispose();
    fixture.boot();const off=fixture.controller.read();must(!off.opaqueSidebar&&!off.opaqueChat,'both off persist');fixture.dispose();
    return {rows,uiCallbacks:2,strictValues:8,persistence:true,teardown:true};
  })()`);
  if (supplement) {
    const supplementOut = await evidencePath('WM_SUPPLEMENT_OUTPUT', runDir, 'supplement.json');
    await writeFile(supplementOut, JSON.stringify(supplement, null, 2));
    await verifyPersisted(supplementOut);
    console.log('supplement passed: 8 active dark states, light, image/video, both callbacks, strict booleans and teardown');
  }
  if (mutantSidebarOnly) {
    check(isWallpaper(mutantSidebarOnly.chatPixel), `sidebar on: the chat column still shows the wallpaper, got ${JSON.stringify(mutantSidebarOnly.chatPixel)}`);
  }
  if (mutantChatOnly) {
    // The rc.18 shape: with the chat switch on, the body only. The header must be reported as still
    // showing the wallpaper, which is the failure this control exists to produce.
    check(near(mutantChatOnly.headerPixel, CHAT_COLOUR),
      `default: the conversation header is covered when the chat switch is on, got ${JSON.stringify(mutantChatOnly.headerPixel)}`);
  }
  if (mutantState) {
    check(isWallpaper(mutantState.columnCorner), `default: the column corner still shows the wallpaper, got ${JSON.stringify(mutantState.columnCorner)}`);
    check(isWallpaper(mutantState.seatBeside), `default: the area beside the input card still shows the wallpaper, got ${JSON.stringify(mutantState.seatBeside)}`);
    check(isWallpaper(mutantState.chatPixel), `default: the wallpaper reaches the chat column, got ${JSON.stringify(mutantState.chatPixel)}`);
  }
  if (expectFailure) {
    // The control is only meaningful if it fails the very check it targets, not some other one. The
    // targeted check runs against the mutant state, the rest against the four shipped combinations.
    const targeted = failures.filter(message => message.startsWith(expectFailure));
    assert.ok(targeted.length > 0,
      `negative control ${mutant} must break "${expectFailure}"; failures were ${JSON.stringify(failures)}`);
    console.log(`negative control ${mutant} rejected as expected: ${targeted[0]}`);
  } else {
    assert.deepEqual(failures, [], `region checks failed: ${JSON.stringify(failures, null, 2)}`);
    console.log(`region checks passed: 4 combinations, other regions unchanged; report ${out}`);
  }} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await removeProfile(profile);
}