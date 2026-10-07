// Rendered-pixel checks for the two transparency protections.
//
// The desktop review rejected an earlier version of this check for two reasons, and both are
// addressed here:
//   1. it asserted computed styles only, so a frame painted opaque over the whole wallpaper
//      counted as success, and
//   2. its colour/gradient parsers could report a fully transparent gradient as opaque.
//
// This file therefore measures *pixels* of a painted stack (wallpaper layer behind, frame and
// columns in front) and carries sanity checks for its own parsers. The page is deliberately
// minimal: the theme's own stylesheet is extracted from src/client.js at run time and the host
// declarations are copied verbatim from the official stylesheet kept with the review evidence, so
// nothing here depends on the fixture's mount flow. This is an isolated harness, not DSH.
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const qa = dirname(fileURLToPath(import.meta.url));
const themePath = join(qa, '../src/client.js');
const themeSource = await readFile(themePath, 'utf8');
const OFFICIAL_CSS = process.env.WM_OFFICIAL_CSS
  || 'F:\\deepseekharness\\.tmp\\wallpaper-visual-issues-20261007-103010\\official-styles.css';

const ACTIVE_CLASS = 'dsh-whale-mist-active';
const ABYSS_ACTIVE_CLASS = 'dsh-whale-abyss-active';

/** Extracts the theme's backdrop stylesheet, resolving the two class-name placeholders. */
function extractBackdropCss(source) {
  const opener = 'const backdropCss = `';
  const start = source.indexOf(opener);
  assert.ok(start > 0, 'the theme backdrop stylesheet is present in src/client.js');
  const bodyStart = start + opener.length;
  let index = bodyStart;
  let end = -1;
  while (index < source.length) {
    if (source[index] === '`' && source.slice(index, index + 2) === '`;') { end = index; break; }
    index += 1;
  }
  assert.ok(end > bodyStart, 'the theme backdrop stylesheet is terminated');
  const selector = `body:is(.${ACTIVE_CLASS}, .${ABYSS_ACTIVE_CLASS})[data-wm-backdrop][data-wm-canvas]`;
  return source.slice(bodyStart, end)
    .replace(/\$\{backdropSelector\}/g, selector)
    .replace(/\$\{ACTIVE_CLASS\}/g, ACTIVE_CLASS)
    .replace(/\$\{ABYSS_ACTIVE_CLASS\}/g, ABYSS_ACTIVE_CLASS)
    .replace(/\$\{[^}]*\}/g, '');
}

/** Keeps the official declarations this stack depends on, keyed by the selectors used below. */
function selectOfficialRules(css) {
  const keep = [
    /\.BynINW_frame\{/,
    /\[data-windows-titlebar\] \.BynINW_frame\{/,
    /\[data-windows-titlebar\] \.BynINW_frame:before\{/,
    /\.BynINW_sidebarCol\{/,
    /\.BynINW_centerCol\{/,
    /\[data-windows-titlebar\] \.BynINW_centerCol\{/,
    /\.Dc7zOa_root\{/,
    /\.Dc7zOa_composerSeat\{/,
    /\[data-phase=active\] \.Dc7zOa_composerSeat\{/,
    /\.RlGAzG_card\{/,
  ];
  const rules = [];
  let depth = 0;
  let current = '';
  for (const char of css) {
    current += char;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        if (keep.some(pattern => pattern.test(current))) rules.push(current.trim());
        current = '';
      }
    }
  }
  return rules;
}

const officialAll = await readFile(OFFICIAL_CSS, 'utf8');
// The official stylesheet is minified and may sit inside media queries; keep the top-level rules
// this stack needs and drop the media wrappers, because the harness tests one fixed environment.
const officialRules = selectOfficialRules(officialAll);
assert.ok(officialRules.length >= 8, `the official baseline rules were found (${officialRules.length})`);

const themeCss = extractBackdropCss(themeSource);
const WIDTH = 1000;
const HEIGHT = 600;
const WALLPAPER = { r: 255, g: 0, b: 255 };

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const server = createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/theme.css') {
    res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' });
    let served = themeCss;
    // Negative controls, each one disabling exactly one protection so the check that covers it
    // must fail:
    //   mask      - no composer fade at all (the original defect);
    //   solidSeat - the rc.15 defect: the whole seat painted with one flat colour;
    //   frame     - the rc.14 defect: the whole application frame painted opaque.
    if (process.env.WM_PIXEL_NEGATIVE_CONTROL === 'mask') {
      served = themeCss.replace(/html:has\([^{]*composerSeat[^{]*\{[^}]*\}/g, '');
      assert.notEqual(served, themeCss, 'the mask negative control removed the composer rule');
    } else if (process.env.WM_PIXEL_NEGATIVE_CONTROL === 'solidSeat') {
      // The rc.15 defect: one flat colour for the whole seat instead of the fade ramp. The
      // replacement is anchored to the seat rule so it cannot swallow neighbouring rules.
      const seatRule = /(\.Dc7zOa_composerSeat \{\s*)background: linear-gradient\(180deg,[\s\S]*?;\s*(!important;)?/;
      assert.match(themeCss, seatRule, 'the seat fade rule is present in the theme stylesheet');
      served = themeCss.replace(seatRule, '$1background: rgb(var(--wm-base-rgb)) !important;');
      assert.notEqual(served, themeCss, 'the solid seat negative control replaced the seat fade');
      assert.match(served, /\.BynINW_frame \{\s*background: transparent !important;/,
        'the solid seat control leaves the frame clearing rule in place');
    } else if (process.env.WM_PIXEL_NEGATIVE_CONTROL === 'frame') {
      // The rc.14 defect: the whole application frame painted opaque.
      const clearing = /html\[data-windows-titlebar\]:has\([\s\S]*?\) \.BynINW_frame \{\s*background: transparent !important;/;
      assert.match(themeCss, clearing, 'the frame clearing rule is present in the theme stylesheet');
      served = themeCss.replace(clearing, 'html[data-windows-titlebar]:has(body[data-wm-backdrop]) .BynINW_frame { background: rgb(8, 11, 20) !important;');
      assert.notEqual(served, themeCss, 'the frame negative control replaced the clearing rule');
    }
    res.end(served);
    return;
  }
  if (path === '/official.css') {
    res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' });
    res.end(officialRules.join('\n'));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html data-windows-titlebar data-platform="win32"><head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="/official.css?v=${runId}">
    <link rel="stylesheet" href="/theme.css?v=${runId}">
  </head><body data-wm-backdrop="wallpaper" data-wm-canvas="clear" data-wm-theme="abyss" data-wm-palette="ocean" data-wm-sidebar="balanced" data-wm-glass="standard" class="${ABYSS_ACTIVE_CLASS}">
    <div id="wm-backdrop"><div class="wm-backdrop-media"></div><div class="wm-backdrop-mask"></div></div>
    <main id="root">
      <div class="BynINW_frame">
        <div class="BynINW_sidebarCol" style="position:absolute;left:0;top:0;bottom:0;width:220px">sidebar</div>
        <div class="BynINW_centerCol" style="position:absolute;left:220px;right:0;top:32px;bottom:0">
          <div class="Dc7zOa_root" data-phase="active" style="height:100%">
            <div class="Dc7zOa_header">header</div>
            <div class="Dc7zOa_scrollBody" style="flex:1;min-height:0">
              <div class="Dc7zOa_history" style="height:2000px;color:rgb(255,255,0)">long chat history that keeps scrolling behind the input area</div>
              <div class="Dc7zOa_composerSeat" style="position:absolute;left:0;right:0;bottom:0">
                <div class="Dc7zOa_composerDock" style="height:40px">toolbar</div>
                <div class="RlGAzG_card" style="height:120px">input card</div>
                <div class="Dc7zOa_composerFooter" style="height:28px">status</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <script>
      // State that the plugin writes at runtime, plus the geometry the harness needs.
      document.body.style.setProperty('--wm-base-rgb', '8 11 20');
      document.body.style.setProperty('--wm-sidebar-rgb', '15 23 38');
      document.body.style.setProperty('--wm-layer1-rgb', '15 23 38');
      document.body.style.setProperty('--wm-layer2-rgb', '23 34 54');
      document.body.style.setProperty('--wm-layer3-rgb', '28 40 62');
      document.body.style.setProperty('--wm-ui-alpha', '0.35');
      document.documentElement.style.setProperty('--dsh-windows-titlebar-height', '32px');
      document.body.style.margin = '0';
      const root = document.getElementById('root');
      root.style.cssText = 'position:fixed;inset:0;margin:0;padding:0;display:block';
      const media = document.querySelector('.wm-backdrop-media');
      media.style.cssText = 'width:100%;height:100%;background:rgb(255,0,255)';
      const mask = document.querySelector('.wm-backdrop-mask');
      mask.style.cssText = 'position:absolute;inset:0;background:transparent';
      const motion = document.createElement('style');
      motion.textContent = '*{transition:none !important;animation:none !important}';
      document.head.append(motion);
    </script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await mkdtemp(join(tmpdir(), 'whale-pixels-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `--window-size=${WIDTH},${HEIGHT}`, `http://127.0.0.1:${server.address().port}/`,
], { windowsHide: true, stdio: 'ignore' });

let socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map();
let id = 0;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(port, 'headless browser started');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const page = pages.find(entry => entry.type === 'page' && entry.url.startsWith(`http://127.0.0.1:${server.address().port}`));
  assert.ok(page, 'isolated test page found');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (request) { pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 60000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await sleep(300);

  // Parse plumbing: colour and gradient readings plus their sanity checks. The parser avoids
  // regular expressions because this script travels through a template literal in an earlier
  // version and lost its backslashes there, which is exactly the defect the review caught.
  await evaluate(`(() => {
    window.__wmParse = {
      colorAlpha(value) {
        if (!CSS.supports('color', value)) return null;
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color.trim();
        probe.remove();
        const open = resolved.indexOf('(');
        if (open < 0 || !resolved.endsWith(')')) return null;
        const name = resolved.slice(0, open);
        const body = resolved.slice(open + 1, -1);
        if (name === 'rgb') return 1;
        if (name === 'rgba') { const parts = body.split(','); return parts.length > 3 ? parseFloat(parts[3]) : 1; }
        if (name === 'color') { const slash = body.split('/'); return slash.length > 1 ? parseFloat(slash[1]) : 1; }
        return null;
      },
      gradientStops(image) {
        if (!image || image === 'none') return null;
        const text = image.trim();
        const open = text.indexOf('(');
        if (open < 0 || !text.endsWith(')')) return null;
        if (text.indexOf('linear-gradient(') !== 0) return null;
        const parts = [];
        let depth = 0;
        let current = '';
        for (const char of text.slice(open + 1, -1)) {
          if (char === '(') depth += 1;
          if (char === ')') depth -= 1;
          if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
          current += char;
        }
        if (current.trim()) parts.push(current.trim());
        return parts.filter(part => {
          if (part.startsWith('to ')) return false;
          const first = part.split(' ')[0];
          return !(first.endsWith('deg') || first.endsWith('rad') || first.endsWith('turn'));
        });
      },
      stripLength(stop) {
        const parts = stop.trim().split(' ').filter(Boolean);
        const last = parts[parts.length - 1];
        if (parts.length > 1 && (last.endsWith('px') || last.endsWith('%'))) return parts.slice(0, -1).join(' ');
        return stop.trim();
      },
      gradientEndAlpha(image) {
        const stops = this.gradientStops(image);
        if (!stops || stops.length === 0) return null;
        return this.colorAlpha(this.stripLength(stops[stops.length - 1]));
      },
    };
    return true;
  })()`);

  const parserCheck = await evaluate(`({
    transparentPair: window.__wmParse.gradientEndAlpha('linear-gradient(color(srgb 0 0 0 / 0) 0px, rgba(0, 0, 0, 0) 36px)'),
    halfStop: window.__wmParse.gradientEndAlpha('linear-gradient(180deg, rgba(8, 11, 20, 0) 0px, rgba(8, 11, 20, 0.35) 36px)'),
    opaqueStop: window.__wmParse.gradientEndAlpha('linear-gradient(180deg, rgb(8, 11, 20) 0px, rgb(8, 11, 20) 100%)'),
    attachedLength: window.__wmParse.colorAlpha('rgb(8, 11, 20) 100%'),
    bogusName: window.__wmParse.colorAlpha('not-a-colour'),
  })`);
  assert.equal(parserCheck.transparentPair, 0, `parser: a transparent gradient reads as alpha 0, got ${parserCheck.transparentPair}`);
  assert.equal(parserCheck.halfStop, 0.35, `parser: a half stop reads its own alpha, got ${parserCheck.halfStop}`);
  assert.equal(parserCheck.opaqueStop, 1, `parser: an opaque stop reads as alpha 1, got ${parserCheck.opaqueStop}`);
  assert.equal(parserCheck.attachedLength, null, `parser: a colour with a trailing length is refused, got ${parserCheck.attachedLength}`);
  assert.equal(parserCheck.bogusName, null, `parser: a non-colour is refused, got ${parserCheck.bogusName}`);

  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  const report = await evaluate(`(async () => {
    const image = new Image();
    image.src = 'data:image/png;base64,${shot.data}';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const at = (x, y) => {
      const data = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return { x: Math.round(x), y: Math.round(y), r: data[0], g: data[1], b: data[2], a: Number((data[3] / 255).toFixed(3)) };
    };
    const frame = document.querySelector('.BynINW_frame');
    const sidebar = document.querySelector('.BynINW_sidebarCol');
    const center = document.querySelector('.BynINW_centerCol');
    const seat = document.querySelector('.Dc7zOa_composerSeat');
    const card = document.querySelector('.RlGAzG_card');
    const frameRect = frame.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const seatRect = seat.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(frame).paddingTop || '0');
    const chatX = centerRect.left + centerRect.width / 2;
    const chatY = centerRect.top + 60;
    return {
      size: { width: image.width, height: image.height },
      frameRect: { top: Math.round(frameRect.top), left: Math.round(frameRect.left), width: Math.round(frameRect.width), height: Math.round(frameRect.height) },
      paddingTop: padding,
      styles: {
        frameBackground: getComputedStyle(frame).backgroundColor,
        stripBackground: getComputedStyle(frame, '::before').backgroundColor,
        sidebarBackground: getComputedStyle(sidebar).backgroundColor,
        centerBackground: getComputedStyle(center).backgroundColor,
        rootBackground: getComputedStyle(document.querySelector('.Dc7zOa_root')).backgroundColor,
        seatGradient: getComputedStyle(seat).backgroundImage,
        seatEndAlpha: window.__wmParse.gradientEndAlpha(getComputedStyle(seat).backgroundImage),
        cardBackgroundColor: getComputedStyle(card).backgroundColor,
        cardBackgroundImage: getComputedStyle(card).backgroundImage,
        hasCallToAction: true,
      },
      rects: {
        seat: { top: Math.round(seatRect.top), bottom: Math.round(seatRect.bottom), height: Math.round(seatRect.height), left: Math.round(seatRect.left), width: Math.round(seatRect.width) },
        card: (() => { const r = card.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }; })(),
        scrollBody: (() => { const r = document.querySelector('.Dc7zOa_scrollBody').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; })(),
      },
      pixels: {
        strip: at(frameRect.left + frameRect.width / 2, frameRect.top + Math.max(2, padding / 2)),
        chat: at(chatX, chatY),
        sidebar: at(sidebarRect.left + sidebarRect.width / 2, sidebarRect.top + centerRect.height / 2),
        // Inside the card: must be opaque and must not show the wallpaper.
        cardCenter: at((card.getBoundingClientRect().left + card.getBoundingClientRect().right) / 2, card.getBoundingClientRect().top + 40),
        // In the toolbar strip above the card, which is the seat's own area inside the seat (the
        // fade is fully opaque there): the protection must hold there too.
        seatBesideCard: at(seatRect.left + seatRect.width / 2, card.getBoundingClientRect().top - 12),
        // The very top of the seat, where the fade should still be translucent: that is what keeps
        // the wallpaper visible above the input area instead of a flat block from here downwards.
        seatRamp: at(seatRect.left + seatRect.width / 2, seatRect.top + 2),
        // Between the card and the bottom of the seat: must not be one flat block.
        belowCard: at(seatRect.left + seatRect.width / 2, Math.min(seatRect.bottom - 4, card.getBoundingClientRect().bottom + 4)),
      },
      stack: document.elementsFromPoint(chatX, chatY).map(element => element.tagName
        + (element.id ? '#' + element.id : '') + (element.className ? '.' + String(element.className).split(' ')[0] : '')
        + ' bg=' + getComputedStyle(element).backgroundColor),
    };
  })()`);

  const near = (value, expected, tolerance) => Math.abs(value - expected) <= tolerance;
  // The theme's active state leaves the host's 6% sidebar fill on the frame, so the wallpaper is
  // composited rather than reproduced exactly. These helpers test participation, not equality.
  const isWallpaper = pixel => near(pixel.b, WALLPAPER.b, 12) && near(pixel.r, WALLPAPER.r, 12) && near(pixel.g, WALLPAPER.g, 12);
  const carriesWallpaper = pixel => pixel.b - pixel.g > 60 && pixel.r - pixel.g > 60;
  const isBaseOnly = pixel => distance(pixel, { r: 8, g: 11, b: 20 }) <= 12;
  const distance = (pixel, expected) => Math.abs(pixel.r - expected.r) + Math.abs(pixel.g - expected.g) + Math.abs(pixel.b - expected.b);

  // The stack must really be the painted application, otherwise the pixel readings describe
  // something else entirely.
  assert.ok(report.frameRect.width >= WIDTH - 1 && report.frameRect.height >= HEIGHT - 1,
    `the frame covers the window, got ${JSON.stringify(report.frameRect)}`);
  assert.equal(report.styles.frameBackground, 'rgba(0, 0, 0, 0)',
    `the application frame is cleared so the wallpaper can show, got ${report.styles.frameBackground}`);

  // V1: the top strip is opaque and hides the source window's decoration.
  const strip = report.pixels.strip;
  assert.equal(strip.a, 1, `the top strip is fully opaque, got ${JSON.stringify(strip)}`);
  assert.ok(distance(strip, WALLPAPER) > 60, `the top strip does not show the wallpaper, got ${JSON.stringify(strip)}`);
  // ...while the content area and the sidebar still show it, which is what rc.14 broke.
  assert.ok(carriesWallpaper(report.pixels.chat), `the chat area shows the wallpaper, got ${JSON.stringify(report.pixels.chat)} stack ${JSON.stringify(report.stack)}`);
  assert.ok(!isBaseOnly(report.pixels.chat), `the chat area is not just the opaque base colour, got ${JSON.stringify(report.pixels.chat)}`);
  const sidebarPixel = report.pixels.sidebar;
  assert.ok(carriesWallpaper(sidebarPixel), `the sidebar shows the wallpaper through its fill, got ${JSON.stringify(sidebarPixel)}`);
  assert.ok(!isBaseOnly(sidebarPixel), `the sidebar is not just an opaque fill, got ${JSON.stringify(sidebarPixel)}`);
  assert.ok(sidebarPixel.b > sidebarPixel.g + 40, `the sidebar still blends the wallpaper with its fill, got ${JSON.stringify(sidebarPixel)}`);

  // R4: the composer must protect without flattening everything into one dark block.
  // 1. The seat still has a fade ramp: it is translucent at its top and opaque where the input
  //    area begins. This single measured fact separates the shipped behaviour from both the
  //    rc.14/rc.15 flat seat and a seat with no protection at all.
  const rampPixel = report.pixels.seatRamp;
  const bottomPixel = report.pixels.belowCard;
  assert.ok(carriesWallpaper(rampPixel),
    `the fade starts translucent so the wallpaper shows above the input, got ${JSON.stringify(rampPixel)}`);
  assert.ok(distance(rampPixel, bottomPixel) > 40,
    `the seat is a ramp rather than one flat colour: ${JSON.stringify(rampPixel)} vs ${JSON.stringify(bottomPixel)}`);
  // 2. Where the input area begins the fade is opaque, so history cannot scroll past it.
  assert.equal(report.styles.seatEndAlpha, 1,
    `the composer fade ends opaque, got ${report.styles.seatEndAlpha} (${report.styles.seatGradient})`);
  assert.ok(distance(report.pixels.seatBesideCard, WALLPAPER) > 60,
    `the composer area around the card is masked, got ${JSON.stringify(report.pixels.seatBesideCard)}`);
  // ...the input card is opaque and keeps its own surface, distinct from the flat base colour...
  assert.equal(report.styles.cardBackgroundColor, 'rgba(0, 0, 0, 0)',
    `the card paints a gradient rather than a flat fill, got ${report.styles.cardBackgroundColor}`);
  assert.match(report.styles.cardBackgroundImage, /gradient/,
    `the card keeps its own surface gradient, got ${report.styles.cardBackgroundImage}`);
  const cardPixel = report.pixels.cardCenter;
  assert.ok(!carriesWallpaper(cardPixel), `the input card hides the wallpaper, got ${JSON.stringify(cardPixel)}`);
  assert.ok(distance(cardPixel, WALLPAPER) > 60, `the input card is not transparent, got ${JSON.stringify(cardPixel)}`);
  // The card surface is not identical to the theme base colour: that difference is the layering
  // the rc.15 review asked for. Both are dark, so compare against the base with a small margin.
  const baseLike = distance(cardPixel, { r: 8, g: 11, b: 20 }) <= 12;
  const cardSurfaceDiffers = distance(cardPixel, { r: 23, g: 34, b: 54 }) <= 40 || !baseLike;
  assert.ok(cardSurfaceDiffers,
    `the input card has its own surface rather than the flat base colour, got ${JSON.stringify(cardPixel)}`);
  // The area below the card is inside the seat and therefore masked, but it must not simply be an
  // unbounded black region: the seat's own bottom edge is where it ends.
  assert.ok(report.rects.seat.bottom <= HEIGHT + 1,
    `the composer seat stays inside the window, got ${JSON.stringify(report.rects.seat)}`);

  const out = process.env.WM_PIXEL_OUTPUT || join(tmpdir(), `whale-pixels-${Date.now()}.json`);
  const payload = { isolatedHarness: true, viewport: { width: WIDTH, height: HEIGHT }, parserCheck, officialRuleCount: officialRules.length, ...report };
  await writeFile(out, JSON.stringify(payload, null, 2), { flag: 'w' });
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\npixel checks passed: strip/chat/sidebar/card/ramp sampled, report ${out}`);
} finally {
  socket?.close();
  browser.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
