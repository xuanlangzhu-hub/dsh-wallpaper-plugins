// Actual-DOM layout checks for the Wallpaper Engine settings entry.
//
// The rc.11 desktop review found the WE row wrapping one character per line in a narrow
// settings panel: the two-column row let the text column shrink to zero width while the
// controls kept theirs. The other settings checks in this directory read the VNode tree,
// which cannot see layout at all, so this file renders the real settings component into real
// DOM nodes, loads the plugin's stylesheet, and measures geometry at several panel widths.
//
// It is an isolated harness, not the DSH desktop: the host page supplies only the three
// fixture blocks the CSS expects, and the panel width is set explicitly.
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const here = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const qa = here.endsWith('/') ? here.slice(0, -1) : here;
const files = {
  '/client.js': await readFile(join(qa, '../src/client.js')),
  '/harness.js': await readFile(join(qa, 'appearance-harness.js')),
  '/fixture.js': await readFile(join(qa, 'appearance-wallpaper-fixture.js')),
};
// A fresh query string and no-store on every response: a cached bundle would make these
// geometry numbers describe old code.
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const server = createServer((req, res) => {
  const key = req.url.split('?')[0];
  if (files[key]) { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); res.end(files[key]); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html><head><title>Whale settings layout QA</title></head><body>
    <main id="root">
      <div id="fixture-base" style="background:var(--dsw-alias-bg-base)">Canvas</div>
      <div id="fixture-card" style="background:var(--dsw-alias-bg-layer-1)">Card</div>
      <div id="fixture-composer" style="background:var(--dsw-specific-input-major)">Composer</div>
    </main>
    <script src="/harness.js?v=${runId}"></script><script src="/fixture.js?v=${runId}"></script><script src="/client.js?v=${runId}"></script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = await mkdtemp(join(tmpdir(), 'whale-layout-qa-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', '--window-size=1280,1000', `http://127.0.0.1:${server.address().port}/`,
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
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 120000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  for (let attempt = 0; attempt < 50 && !await evaluate('Boolean(window.fixture?.run && window.whaleModule)'); attempt++) await sleep(100);

  // The desktop check ran at a 1280px viewport with a narrow settings panel inside it.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  const measured = await evaluate(`(async () => {
    const fixture = window.fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', background: 'wallpaper', weMode: 'daily', weAutoStart: false }));
    fixture.boot();
    // Render the real settings VNode tree into real elements, like a host would.
    const element = node => {
      if (node == null || node === false) return document.createTextNode('');
      if (typeof node !== 'object') return document.createTextNode(String(node));
      if (typeof node.type === 'function') return element(node.type({ ...node.props, children: node.children }));
      const el = document.createElement(typeof node.type === 'string' ? node.type : 'div');
      for (const [key, value] of Object.entries(node.props || {})) {
        if (key === 'className') el.className = value;
        else if (key === 'style' && value && typeof value === 'object') Object.assign(el.style, value);
        else if (key === 'checked') el.checked = value;
        else if (key === 'disabled') el.disabled = value;
        else if (!key.startsWith('on') && key !== 'key' && value != null) el.setAttribute(key, String(value));
      }
      for (const child of node.children || []) el.append(element(child));
      return el;
    };
    const panel = document.createElement('div');
    panel.id = 'layout-panel';
    panel.style.cssText = 'box-sizing:border-box;padding:0;margin:24px;font-family:"Microsoft YaHei",sans-serif';
    panel.append(element(fixture.settingsComponent({ controller: fixture.controller })));
    document.body.append(panel);
    const rect = el => el.getBoundingClientRect();
    const inside = (child, parent, tolerance = 1) => {
      const a = rect(child), b = rect(parent);
      return a.left >= b.left - tolerance && a.right <= b.right + tolerance;
    };
    const results = [];
    for (const width of [720, 640, 560, 480, 400]) {
      panel.style.width = width + 'px';
      await pause(60);
      const panelRect = rect(panel);
      const weRow = [...panel.querySelectorAll('.wm-wallpaper-row')].find(el => el.querySelector('[data-wm-action="wallpaper-start"]'));
      const copy = weRow.querySelector('.wm-wallpaper-copy');
      const label = copy.querySelector('.wm-settings-label');
      const hint = copy.querySelector('.wm-settings-hint');
      const actions = weRow.querySelector('.wm-wallpaper-actions');
      const start = weRow.querySelector('[data-wm-action="wallpaper-start"]');
      const restart = weRow.querySelector('[data-wm-action="wallpaper-restart"]');
      const stop = weRow.querySelector('[data-wm-action="wallpaper-stop"]');
      const scene = weRow.querySelector('[data-wm-setting="weScene"]');
      const mode = weRow.querySelector('[data-wm-setting="weMode"]');
      const autoRow = panel.querySelector('.wm-wallpaper-auto-start');
      const autoCopy = autoRow.querySelector('.wm-settings-copy');
      const autoBox = autoRow.querySelector('input[type="checkbox"]');
      // A real click must still reach the control. A narrow panel pushes the row down, so scroll
      // it into view first; elementFromPoint only hit-tests what the viewport actually shows.
      start.scrollIntoView({ block: 'center' });
      await pause(40);
      const startRect = rect(start);
      const hit = document.elementFromPoint(startRect.left + startRect.width / 2, startRect.top + startRect.height / 2);
      const labelSize = parseFloat(getComputedStyle(label).fontSize);
      const lineHeight = parseFloat(getComputedStyle(hint).lineHeight) || 18;
      results.push({
        viewport: innerWidth,
        panelWidth: width,
        weRow: {
          width: Math.round(rect(weRow).width),
          height: Math.round(rect(weRow).height),
          scrollWidth: weRow.scrollWidth,
          overflowX: weRow.scrollWidth - Math.round(rect(weRow).width),
          flexDirection: getComputedStyle(weRow).flexDirection,
          copyWidth: Math.round(rect(copy).width),
          labelWidth: Math.round(rect(label).width),
          hintWidth: Math.round(rect(hint).width),
          hintHeight: Math.round(rect(hint).height),
          hintLines: Math.round(rect(hint).height / lineHeight),
          startRect: { left: Math.round(startRect.left), top: Math.round(startRect.top), width: Math.round(startRect.width), height: Math.round(startRect.height) },
          hitTag: hit ? hit.tagName + '.' + (hit.className || '') : null,
          hitIsStart: hit === start || start.contains(hit),
          hintWritingMode: getComputedStyle(hint).writingMode,
          labelWritingMode: getComputedStyle(label).writingMode,
          actionsWidth: Math.round(rect(actions).width),
          actionsFlexWrap: getComputedStyle(actions).flexWrap,
          actionsRows: new Set([start, restart, stop, scene, mode].map(el => Math.round(rect(el).top))).size,
          controlsInsidePanel: [start, restart, stop, scene, mode].every(el => inside(el, panel, 1)),
          fieldWidths: { start: Math.round(startRect.width), scene: Math.round(rect(scene).width), mode: Math.round(rect(mode).width) },
          clickedStart: hit === start || start.contains(hit),
        },
        autoRow: {
          scrollWidth: autoRow.scrollWidth,
          overflowX: autoRow.scrollWidth - Math.round(rect(autoRow).width),
          flexDirection: getComputedStyle(autoRow).flexDirection,
          alignItems: getComputedStyle(autoRow).alignItems,
          copyWidth: Math.round(rect(autoCopy).width),
          copyRight: Math.round(rect(autoCopy).right),
          labelWidth: Math.round(rect(autoCopy.querySelector('.wm-settings-label')).width),
          hintHeight: Math.round(rect(autoCopy.querySelector('.wm-settings-hint')).height),
          // The box must stay a normal square control: it used to stretch to the whole row
          // width because the row inherited align-items stretch from the stacked WE class.
          checkboxWidth: Math.round(rect(autoBox).width),
          checkboxHeight: Math.round(rect(autoBox).height),
          checkboxLeft: Math.round(rect(autoBox).left),
          checkboxTop: Math.round(rect(autoBox).top),
          checkboxInside: inside(autoBox, panel, 1),
          // Design: text on the left, box on the right of the same line.
          boxRightOfText: rect(autoBox).left >= rect(autoCopy).right - 1,
          sameLine: Math.abs(rect(autoBox).top + rect(autoBox).height / 2 - (rect(autoCopy).top + rect(autoCopy).height / 2)) <= 12,
          checkboxHitIsBox: (() => {
            const r = rect(autoBox);
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return hit === autoBox || autoBox.contains(hit);
          })(),
        },
        // The other rows must keep their previous two-column layout.
        imageRowDirection: (() => {
          const row = [...panel.querySelectorAll('.wm-settings-row')].find(el => el.querySelector('[data-wm-setting="weScene"]') === null && el.className.includes('wm-settings-row'));
          return row ? getComputedStyle(row).flexDirection : null;
        })(),
        panelWidthMeasured: Math.round(panelRect.width),
        panelScrollWidth: panel.scrollWidth,
      });
    }
    // Narrow viewport: the existing responsive rule still applies to the whole row set.
    fixture.dispose();
    return results;
  })()`);

  const narrow = await evaluate(`(async () => {
    const fixture = window.fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.__WM_LAYOUT_NARROW = true;
    return { viewport: innerWidth };
  })()`);

  const fresh = await evaluate(`(async () => {
    const fixture = window.fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    // Re-render at 560px and then shrink the whole viewport to 640px so the media rule fires.
    const element = node => {
      if (node == null || node === false) return document.createTextNode('');
      if (typeof node !== 'object') return document.createTextNode(String(node));
      if (typeof node.type === 'function') return element(node.type({ ...node.props, children: node.children }));
      const el = document.createElement(typeof node.type === 'string' ? node.type : 'div');
      for (const [key, value] of Object.entries(node.props || {})) {
        if (key === 'className') el.className = value;
        else if (key === 'checked') el.checked = value;
        else if (key === 'disabled') el.disabled = value;
        else if (!key.startsWith('on') && key !== 'key' && value != null) el.setAttribute(key, String(value));
      }
      for (const child of node.children || []) el.append(element(child));
      return el;
    };
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', background: 'wallpaper', weMode: 'daily', weAutoStart: true }));
    fixture.boot();
    const panel = document.createElement('div');
    panel.id = 'layout-panel-narrow';
    panel.style.cssText = 'box-sizing:border-box;padding:16px;margin:0;font-family:"Microsoft YaHei",sans-serif;width:100%';
    panel.append(element(fixture.settingsComponent({ controller: fixture.controller })));
    document.body.append(panel);
    await pause(80);
    const rect = el => el.getBoundingClientRect();
    const weRow = [...panel.querySelectorAll('.wm-wallpaper-row')].find(el => el.querySelector('[data-wm-action="wallpaper-start"]'));
    const autoRow = panel.querySelector('.wm-wallpaper-auto-start');
    const out = {
      viewport: innerWidth,
      weRowOverflowX: weRow.scrollWidth - Math.round(rect(weRow).width),
      weRowDirection: getComputedStyle(weRow).flexDirection,
      hintWidth: Math.round(rect(weRow.querySelector('.wm-settings-hint')).width),
      hintLines: Math.round(rect(weRow.querySelector('.wm-settings-hint')).height / 18),
      controlsInside: [...weRow.querySelectorAll('button, select')].every(el => {
        const a = rect(el), b = rect(panel);
        return a.left >= b.left - 1 && a.right <= b.right + 1;
      }),
      autoRowOverflowX: autoRow.scrollWidth - Math.round(rect(autoRow).width),
      autoLabelWidth: Math.round(rect(autoRow.querySelector('.wm-settings-label')).width),
      checkboxInside: (() => { const a = rect(autoRow.querySelector('input[type="checkbox"]')), b = rect(panel); return a.left >= b.left - 1 && a.right <= b.right + 1; })(),
    };
    fixture.dispose();
    return out;
  })()`);

  // A long description must wrap as a paragraph at every panel width. The shipped copy is
  // short, so this replaces its text with a realistic long one: the original defect only showed
  // up when the text needed more than one line.
  const longHint = await evaluate(`(async () => {
    const fixture = window.fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const hint = document.querySelector('#layout-panel .wm-wallpaper-copy .wm-settings-hint');
    const row = hint.closest('.wm-wallpaper-row');
    const panel = document.getElementById('layout-panel');
    const original = hint.textContent;
    hint.textContent = 'Wallpaper Engine 桌面壁纸接入：开始后由本机采集进程把画面送到 DSH，停止会关闭本轮源窗口；日常模式持续播放，预览模式有最长时限。';
    const out = [];
    for (const width of [720, 640, 560, 480, 400]) {
      panel.style.width = width + 'px';
      await pause(60);
      const measure = () => {
        const r = hint.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(hint).lineHeight) || 18;
        return { width: Math.round(r.width), height: Math.round(r.height), lines: Math.round(r.height / lineHeight) };
      };
      out.push({ panelWidth: width, ...measure(), overflowX: row.scrollWidth - Math.round(row.getBoundingClientRect().width) });
    }
    hint.textContent = original;
    return out;
  })()`);

  const narrowViewport = await (async () => {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 640, height: 900, deviceScaleFactor: 1, mobile: false });
    const value = await evaluate(`(async () => {
      const fixture = window.fixture;
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const element = node => {
        if (node == null || node === false) return document.createTextNode('');
        if (typeof node !== 'object') return document.createTextNode(String(node));
        if (typeof node.type === 'function') return element(node.type({ ...node.props, children: node.children }));
        const el = document.createElement(typeof node.type === 'string' ? node.type : 'div');
        for (const [key, value] of Object.entries(node.props || {})) {
          if (key === 'className') el.className = value;
          else if (key === 'checked') el.checked = value;
          else if (key === 'disabled') el.disabled = value;
          else if (!key.startsWith('on') && key !== 'key' && value != null) el.setAttribute(key, String(value));
        }
        for (const child of node.children || []) el.append(element(child));
        return el;
      };
      fixture.wallpaperHost();
      localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', background: 'wallpaper', weMode: 'daily', weAutoStart: false }));
      fixture.boot();
      const panel = document.createElement('div');
      panel.style.cssText = 'box-sizing:border-box;padding:16px;font-family:"Microsoft YaHei",sans-serif;width:100%';
      panel.append(element(fixture.settingsComponent({ controller: fixture.controller })));
      document.body.append(panel);
      await pause(80);
      const rect = el => el.getBoundingClientRect();
      const weRow = [...panel.querySelectorAll('.wm-wallpaper-row')].find(el => el.querySelector('[data-wm-action="wallpaper-start"]'));
      const actions = weRow.querySelector('.wm-wallpaper-actions');
      const view = {
        viewport: innerWidth,
        weRowOverflowX: weRow.scrollWidth - Math.round(rect(weRow).width),
        actionsFlexWrap: getComputedStyle(actions).flexWrap,
        actionRows: new Set([...actions.children].map(el => Math.round(rect(el).top))).size,
        controlsInside: [...weRow.querySelectorAll('button, select')].every(el => {
          const a = rect(el), b = rect(panel);
          return a.left >= b.left - 1 && a.right <= b.right + 1;
        }),
        hintWidth: Math.round(rect(weRow.querySelector('.wm-settings-hint')).width),
        // The auto playback row must stay un-stretched in the narrow viewport too.
        autoRowDirection: getComputedStyle(panel.querySelector('.wm-wallpaper-auto-start')).flexDirection,
        autoCheckbox: (() => {
          const box = panel.querySelector('.wm-wallpaper-auto-start input[type="checkbox"]');
          const r = rect(box), p = rect(panel);
          return {
            width: Math.round(r.width),
            height: Math.round(r.height),
            inside: r.left >= p.left - 1 && r.right <= p.right + 1,
          };
        })(),
      };
      fixture.dispose();
      return view;
    })()`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    return value;
  })();

  // Assertions: the geometry has to hold at every panel width, not just the widest one.
  for (const entry of measured) {
    const where = `panel ${entry.panelWidth}px`;
    assert.equal(entry.weRow.hintWritingMode, 'horizontal-tb', `${where}: the hint stays horizontal`);
    assert.equal(entry.weRow.labelWritingMode, 'horizontal-tb', `${where}: the label stays horizontal`);
    assert.ok(entry.weRow.copyWidth > 0, `${where}: the text column keeps a real width, got ${entry.weRow.copyWidth}`);
    assert.ok(entry.weRow.hintWidth >= 200, `${where}: the hint gets a usable line width, got ${entry.weRow.hintWidth}`);
    assert.ok(entry.weRow.hintLines <= 6, `${where}: the hint wraps as a paragraph, not per character (${entry.weRow.hintLines} lines)`);
    assert.equal(entry.weRow.flexDirection, 'column', `${where}: the WE row stacks its text above its controls`);
    assert.equal(entry.weRow.actionsFlexWrap, 'wrap', `${where}: the controls may wrap`);
    assert.ok(entry.weRow.overflowX <= 1, `${where}: the WE row does not overflow, got ${entry.weRow.overflowX}px`);
    assert.ok(entry.weRow.controlsInsidePanel, `${where}: every control stays inside the panel`);
    assert.ok(entry.weRow.clickedStart, `${where}: the start button is the topmost element at its own centre (hit ${entry.weRow.hitTag} at ${JSON.stringify(entry.weRow.startRect)})`);
    assert.ok(entry.weRow.fieldWidths.start >= 40, `${where}: the start button keeps a clickable width`);
    assert.ok(entry.weRow.fieldWidths.scene >= 40 && entry.weRow.fieldWidths.mode >= 40, `${where}: the selects keep a usable width`);
    assert.ok(entry.autoRow.overflowX <= 1, `${where}: the auto playback row does not overflow`);
    assert.ok(entry.autoRow.labelWidth >= 120, `${where}: the auto playback label keeps a readable width, got ${entry.autoRow.labelWidth}`);
    // U1: the box must stay a normal square control, not stretch to the row width.
    assert.equal(entry.autoRow.flexDirection, 'row', `${where}: the auto playback row stays two-column, got ${entry.autoRow.flexDirection}`);
    assert.ok(entry.autoRow.checkboxInside, where + ': the checkbox is inside the panel');
    assert.ok(entry.autoRow.checkboxWidth >= 12 && entry.autoRow.checkboxWidth <= 24,
      where + ': the checkbox keeps a normal width, got ' + entry.autoRow.checkboxWidth + 'px');
    assert.ok(entry.autoRow.checkboxHeight >= 12 && entry.autoRow.checkboxHeight <= 24,
      where + ': the checkbox keeps a normal height, got ' + entry.autoRow.checkboxHeight + 'px');
    assert.ok(entry.autoRow.checkboxWidth <= entry.autoRow.copyWidth,
      where + ': the box does not stretch past the text column');
    assert.ok(entry.autoRow.boxRightOfText, where + ': the box sits to the right of the text');
    assert.ok(entry.autoRow.sameLine, where + ': the box shares the text line');
    assert.ok(entry.autoRow.checkboxHitIsBox, where + ': the checkbox centre is the checkbox itself');
    assert.ok(entry.autoRow.hintHeight <= 18 * 6, `${where}: the auto playback hint stays a paragraph`);
  }
  assert.deepEqual(measured.map(entry => entry.panelWidth), [720, 640, 560, 480, 400], 'every panel width was measured');
  assert.ok(measured.every(entry => Math.abs(entry.panelWidthMeasured - entry.panelWidth) <= 1), 'the panel really had the requested width');
  for (const entry of longHint) {
    const where = `long hint, panel ${entry.panelWidth}px`;
    assert.ok(entry.width >= 200, `${where}: the paragraph keeps a usable line width, got ${entry.width}`);
    assert.ok(entry.lines >= 1 && entry.lines <= 5, `${where}: the paragraph wraps normally, got ${entry.lines} lines`);
    assert.ok(entry.overflowX <= 1, `${where}: the row still does not overflow, got ${entry.overflowX}px`);
  }
  assert.ok(narrowViewport.weRowOverflowX <= 1, `narrow viewport: no horizontal overflow, got ${narrowViewport.weRowOverflowX}px`);
  assert.ok(narrowViewport.controlsInside, 'narrow viewport: controls stay inside the panel');
  assert.ok(narrowViewport.hintWidth > 0, 'narrow viewport: the hint keeps a width');
  assert.equal(narrowViewport.actionsFlexWrap, 'wrap', 'narrow viewport: the controls still wrap');
  assert.equal(narrowViewport.autoRowDirection, 'row', 'narrow viewport: the auto playback row stays two-column');
  assert.ok(narrowViewport.autoCheckbox.width >= 12 && narrowViewport.autoCheckbox.width <= 24,
    `narrow viewport: the checkbox keeps a normal width, got ${narrowViewport.autoCheckbox.width}px`);
  assert.ok(narrowViewport.autoCheckbox.height >= 12 && narrowViewport.autoCheckbox.height <= 24,
    `narrow viewport: the checkbox keeps a normal height, got ${narrowViewport.autoCheckbox.height}px`);
  assert.ok(narrowViewport.autoCheckbox.inside, 'narrow viewport: the checkbox stays inside the panel');

  const report = { isolatedHarness: true, viewport: 1280, measured, longHint, narrowPanel: fresh, narrowViewport, results: measured.length * 15 };
  const out = process.env.WM_LAYOUT_OUTPUT || join(tmpdir(), `whale-layout-${Date.now()}.json`);
  await writeFile(out, JSON.stringify(report, null, 2), { flag: 'w' });
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nlayout checks passed: ${measured.length} panel widths, narrow viewport ${narrowViewport.viewport}px, report ${out}`);
} finally {
  socket?.close();
  browser.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
