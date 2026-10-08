// Reproduce the sidebar's bottom dark band.
//
// The reported symptom: a rectangular dark strip at the bottom of the workspace list, above the
// account row. The most likely source is the official list fade (`._9lTDKa_fade`), a 24px gradient
// from transparent to `--dsw-specific-sidebar-fill`, which the wallpaper state makes translucent.
// This probe mounts the real sidebar structure with the recorded official CSS and the shipped theme
// stylesheet, paints a recognisable wallpaper, and measures a horizontal row of pixels at each
// height so the band can be located by its edges rather than by eye.
//
// A band exists when a horizontal run inside the fade's own geometry is measurably darker than the
// row just above it, while the same x-range outside the fade does not darken. The probe prints the
// rows and the verdict; it does not decide for the theme.
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const qa = process.env.WM_QA_ROOT || dirname(fileURLToPath(import.meta.url));
const source = await readFile(process.env.WM_CLIENT_SOURCE || join(qa, '../src/client.js'), 'utf8');
const sidebarCss = await readFile(process.env.WM_SIDEBAR_CSS || join(qa, 'fixtures/sidebar-host-rc2.css'), 'utf8');
const themeCss = (() => {
  const opener = 'const backdropCss = `';
  const start = source.indexOf(opener) + opener.length;
  let index = start;
  while (index < source.length) {
    if (source[index] === '`' && source.slice(index, index + 2) === '`;') break;
    index += 1;
  }
  return source.slice(start, index)
    .replace(/\$\{backdropSelector\}/g, 'body.wm[data-wm-backdrop][data-wm-canvas]')
    .replace(/\$\{ACTIVE_CLASS\}/g, 'wm')
    .replace(/\$\{ABYSS_ACTIVE_CLASS\}/g, 'wm')
    .replace(/\$\{[^}]*\}/g, '');
})();

const WIDTH = 900;
const HEIGHT = 700;
const files = { '/theme.css': themeCss, '/sidebar.css': sidebarCss };
const server = createServer((req, res) => {
  if (files[req.url]) {
    res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' });
    res.end(files[req.url]);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html><head><link rel="stylesheet" href="/sidebar.css"><link rel="stylesheet" href="/theme.css"><style>
    html,body{margin:0;width:100%;height:100%} *{transition:none!important;animation:none!important}
    /* The theme's non-background sidebar fill. The real theme is always mounted and defines it for the
       normal state; this probe carries only the wallpaper part of the stylesheet, so the value the
       host's own list fade resolves against is supplied here. It matches the dark palette's fill. */
    :root{--dsw-specific-sidebar-fill:rgba(15, 23, 38, 0.94)}
    #wm-backdrop{position:fixed!important;inset:0;z-index:0}
    #root{position:fixed;inset:0;z-index:1;display:flex;flex-direction:column}
    .shell{flex:1;min-height:0;display:flex}
    .BynINW_sidebarCol{width:230px;flex:none;overflow:hidden;position:relative}
    .BynINW_centerCol{flex:1;min-width:0}
    .account{height:56px;flex:none;display:flex;align-items:center;padding:0 12px;gap:8px}
    .avatar{width:28px;height:28px;border-radius:50%;background:rgb(90,120,170)}
    .row{height:34px;display:flex;align-items:center;padding:0 12px;color:rgb(220,230,245);font:13px/1 sans-serif}
  </style></head><body class="wm" data-wm-backdrop="wallpaper" data-wm-canvas="clear" data-wm-theme="abyss" data-wm-palette="ocean">
    <div id="wm-backdrop"><div class="wm-backdrop-media"></div><div class="wm-backdrop-mask"></div></div>
    <div id="root"><div class="shell">
      <div class="BynINW_sidebarCol">
        <div class="_2H3hWW_root">
          <div class="_2H3hWW_regionArea">
            <div class="_9lTDKa_root">
              <div class="_9lTDKa_listArea">
                <div class="_9lTDKa_treeBody">
                  <div class="_9lTDKa_list" id="session-list"></div>
                  <span class="_9lTDKa_fade" id="list-fade"></span>
                </div>
              </div>
            </div>
          </div>
          <div class="_2H3hWW_footArea"><div class="account"><span class="avatar"></span><span>Account</span></div></div>
        </div>
      </div>
      <div class="BynINW_centerCol"></div>
    </div></div>
    <script>
      // Client state the theme expects, including a low surface opacity so the sidebar is translucent.
      document.body.style.setProperty('--wm-base-rgb', '8 11 20');
      document.body.style.setProperty('--wm-sidebar-rgb', '15 23 38');
      document.body.style.setProperty('--wm-layer1-rgb', '15 23 38');
      document.body.style.setProperty('--wm-layer2-rgb', '23 34 54');
      document.body.style.setProperty('--wm-layer3-rgb', '28 40 62');
      document.body.style.setProperty('--wm-ui-alpha', '0.4');
      document.body.style.setProperty('--wm-bg-mask', '0.45');
      document.body.style.setProperty('--wm-bg-brightness', '0.7');
      // The wallpaper layer the theme builds.
      const media = document.querySelector('.wm-backdrop-media');
      media.style.cssText = 'width:100%;height:100%;background:rgb(255,0,255)';
      document.querySelector('.wm-backdrop-mask').style.cssText = 'position:absolute;inset:0;background:transparent';
      document.querySelector('html').setAttribute('data-windows-titlebar', '');
      document.documentElement.style.setProperty('--dsh-windows-titlebar-height', '32px');
      document.documentElement.style.setProperty('--dsh-sidebar-inline-padding', '12px');
      // Enough rows to fill the list like a real workspace list.
      const list = document.getElementById('session-list');
      for (let index = 0; index < 14; index += 1) {
        const row = document.createElement('div');
        row.className = 'row';
        row.textContent = 'Session ' + (index + 1);
        list.append(row);
      }
    </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await mkdtemp(join(tmpdir(), 'wm-sidebar-band-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, `http://127.0.0.1:${server.address().port}/`,
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket; let id = 0;
const pending = new Map();
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(port, 'isolated browser launched');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const page = pages.find(entry => entry.type === 'page' && entry.url.startsWith(`http://127.0.0.1:${server.address().port}`));
  assert.ok(page, 'probe page found');
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
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await sleep(300);

  const measure = async label => {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    await evaluate(`window.__shot = ${JSON.stringify(shot.data)}`);
    return evaluate(`(async () => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + window.__shot;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const at = (x, y) => { const d = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data; return [d[0], d[1], d[2]]; };
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const fade = box('#list-fade');
      const list = box('#session-list');
      const sidebar = box('.BynINW_sidebarCol');
      const account = box('.account');
      const rows = [];
      for (let y = Math.floor(fade.top) - 16; y <= Math.ceil(fade.bottom) + 8; y += 2) {
        rows.push({
          y,
          insideFade: at(fade.left + Math.min(60, fade.width / 2), y),
          rightOfFade: at(fade.right + 24, y),
          sidebarEdge: at(sidebar.right - 4, y),
        });
      }
      return {
        label: ${JSON.stringify(label)},
        geometry: {
          fade: [Math.round(fade.top), Math.round(fade.bottom), Math.round(fade.left), Math.round(fade.right)],
          listBottom: Math.round(list.bottom),
          sidebar: [Math.round(sidebar.left), Math.round(sidebar.right)],
          accountTop: Math.round(account.top),
        },
        background: document.body.dataset.wmBackdrop ?? null,
        fadeBackground: getComputedStyle(document.querySelector('#list-fade')).backgroundImage,
        sidebarFill: getComputedStyle(document.body).getPropertyValue('--dsw-specific-sidebar-fill').trim(),
        sidebarColour: getComputedStyle(document.querySelector('.BynINW_sidebarCol')).backgroundColor,
        rows,
      };
    })()`);
  };

  const luminance = pixel => 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2];
  const near = (pixel, expected, tolerance = 12) =>
    Math.abs(pixel[0] - expected[0]) <= tolerance && Math.abs(pixel[1] - expected[1]) <= tolerance && Math.abs(pixel[2] - expected[2]) <= tolerance;
  const WALLPAPER_PIXEL = [178, 0, 178];
  const SIDEBAR_PIXEL = [15, 23, 38];
  const reports = [];
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  /** The band's strength: how much darker the fade's own rows are than the rows above it. */
  const bandStrength = report => {
    const insideRows = report.rows.filter(row => row.y >= report.geometry.fade[0] && row.y <= report.geometry.fade[1]);
    const aboveRows = report.rows.filter(row => row.y < report.geometry.fade[0]);
    if (!insideRows.length || !aboveRows.length) return null;
    const darkestInside = Math.min(...insideRows.map(row => luminance(row.insideFade)));
    const brightestAbove = Math.max(...aboveRows.map(row => luminance(row.insideFade)));
    return brightestAbove - darkestInside;
  };

  // 1. The reported state: a wallpaper with a translucent sidebar. This is where the band appeared.
  const translucent = await measure('wallpaper, sidebar translucent');
  reports.push({ label: translucent.label, band: bandStrength(translucent), ...translucent });
  console.log('GEOMETRY ' + JSON.stringify(translucent.geometry));
  console.log('FADE ' + translucent.fadeBackground);
  console.log('FILL ' + JSON.stringify({ sidebarFill: translucent.sidebarFill, sidebarColour: translucent.sidebarColour, background: translucent.background }));
  for (const row of translucent.rows) {
    console.log(`y=${String(row.y).padStart(4)} inside=${JSON.stringify(row.insideFade)} lum=${luminance(row.insideFade).toFixed(1)} | right=${JSON.stringify(row.rightOfFade)} lum=${luminance(row.rightOfFade).toFixed(1)} | edge=${JSON.stringify(row.sidebarEdge)}`);
  }
  check(translucent.fadeBackground === 'none',
    `the list fade paints nothing over the wallpaper, got ${translucent.fadeBackground}`);
  check(bandStrength(translucent) !== null && bandStrength(translucent) < 1.5,
    `no darker rectangle at the bottom of the list, got ${bandStrength(translucent)?.toFixed(1)} luminance`);
  // The sidebar itself must still be the translucent fill: the fix removes the extra fade, not the
  // region's own behaviour.
  check(!near(translucent.rows[Math.floor(translucent.rows.length / 2)].insideFade, SIDEBAR_PIXEL),
    'the sidebar is still translucent over the wallpaper');

  // 2. The sidebar set to its own solid colour: the fade is harmless there and must be left alone,
  // because it is what softens the last rows against the account area in that state too.
  await evaluate(`(async () => { window.fixture?.controller?.set?.('opaqueSidebar', true); return true; })()`).catch(() => {});
  await evaluate(`document.body.dataset.wmOpaqueSidebar = 'true'`);
  await sleep(80);
  const opaque = await measure('wallpaper, sidebar opaque');
  reports.push({ label: opaque.label, band: bandStrength(opaque), ...opaque });
  check(opaque.fadeBackground !== 'none',
    `the host fade is kept when the sidebar is solid, got ${opaque.fadeBackground}`);
  check(near(opaque.rows[Math.floor(opaque.rows.length / 2)].insideFade, SIDEBAR_PIXEL),
    `the sidebar is the theme colour when its switch is on, got ${JSON.stringify(opaque.rows[Math.floor(opaque.rows.length / 2)].insideFade)}`);

  // 3. The normal theme: no background, so the fade must behave exactly as the host ships it. Only
  //    the background-specific attributes are removed; the palette attributes stay, because the real
  //    theme is always mounted and always defines the colour variables (including the sidebar fill),
  //    and dropping them here would leave the host's own gradient unresolvable. The page is reloaded
  //    first so this state cannot inherit anything from the previous one.
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(700);
  await evaluate(`(() => {
    for (const key of ['wmBackdrop', 'wmCanvas', 'wmOpaqueSidebar', 'wmOpaqueChat']) {
      delete document.body.dataset[key];
    }
    document.querySelector('#wm-backdrop').style.display = 'none';
    return true;
  })()`);
  await sleep(120);
  console.log('PLAIN-DIAG ' + JSON.stringify(await evaluate('(() => { const f = document.querySelector(' + String.fromCharCode(39) + '#list-fade' + String.fromCharCode(39) + '); return { cls: document.body.className, backdrop: document.body.dataset.wmBackdrop ?? null, palette: document.body.dataset.wmPalette ?? null, fill: getComputedStyle(document.body).getPropertyValue(' + String.fromCharCode(39) + '--dsw-specific-sidebar-fill' + String.fromCharCode(39) + '), rootFill: getComputedStyle(document.documentElement).getPropertyValue(' + String.fromCharCode(39) + '--dsw-specific-sidebar-fill' + String.fromCharCode(39) + '), fadeBg: getComputedStyle(f).backgroundImage }; })()')));
  const plain = await measure('no background, normal theme');
  reports.push({ label: plain.label, band: bandStrength(plain), ...plain });
  check(plain.fadeBackground !== 'none',
    `the host fade is untouched without a background, got ${plain.fadeBackground}`);

  const out = process.env.WM_BAND_OUTPUT || join(profile, 'band.json');
  await writeFile(out, JSON.stringify({ isolated: true, wallpaperPixel: WALLPAPER_PIXEL, sidebarPixel: SIDEBAR_PIXEL, reports: reports.map(entry => ({ label: entry.label, band: entry.band, fade: entry.fadeBackground })) }, null, 2), { flag: 'w' });
  // Negative control: restore the host's fade while the wallpaper is active and the sidebar is still
  // translucent. That is exactly the state the report described, so the band check must catch it.
  const mutant = process.env.WM_BAND_MUTANT;
  if (mutant) {
    assert.equal(mutant, 'restoreFade', `known negative control, got ${mutant}`);
    // The normal-theme check removed backdrop state. Restore the reported translucent state
    // first; otherwise this control would merely re-measure the normal theme's existing fade.
    await evaluate(`(() => {
      document.body.dataset.wmBackdrop = 'wallpaper';
      document.body.dataset.wmCanvas = 'clear';
      delete document.body.dataset.wmOpaqueSidebar;
      document.querySelector('#wm-backdrop').style.display = '';
      return true;
    })()`);
    await sleep(120);
    const baseline = await measure('wallpaper, translucent before restoring fade');
    assert.equal(baseline.background, 'wallpaper', 'control starts with active wallpaper');
    assert.equal(baseline.fadeBackground, 'none', 'control starts from the corrected fade');
    assert.ok(bandStrength(baseline) < 1.5, 'control baseline has no dark band');
    await evaluate(`(() => { const style = document.createElement('style'); style.textContent = '#root ._9lTDKa_fade{background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill))!important}'; document.head.append(style); return style.textContent.length > 0; })()`);
    await sleep(120);
    const restored = await measure('wallpaper, host fade restored');
    const restoredBand = bandStrength(restored);
    assert.equal(restored.background, 'wallpaper', 'restored fade is measured with active wallpaper');
    assert.notEqual(restored.fadeBackground, 'none', 'the mutation actually paints the fade');
    assert.ok(restoredBand > 2,
      `the restored host fade must reproduce the band, got ${restoredBand} luminance`);
    await writeFile(out + '.control.json', JSON.stringify({ baseline, restored, restoredBand }, null, 2));
    console.log(`negative control restoreFade reproduced the band: ${restoredBand.toFixed(1)} luminance`);
  } else {
    assert.deepEqual(failures, [], `sidebar band checks failed: ${JSON.stringify(failures, null, 2)}`);
    console.log('SIDEBAR-BAND ' + JSON.stringify(reports.map(entry => ({ label: entry.label, band: Number(entry.band?.toFixed(1)), fade: entry.fadeBackground }))));
    console.log(`sidebar band checks passed: no dark rectangle with the wallpaper, host fade kept otherwise (report ${out})`);
  }
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
