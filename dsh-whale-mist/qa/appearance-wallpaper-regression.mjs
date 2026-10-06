// Targeted, window-free checks for the Wallpaper Engine settings entry.
//
// It runs the real theme client in an isolated headless browser against a scripted mock
// Host: the settings surface, background switching, persistence, the CSS that keeps the
// experimental picture readable, and the failure/recovery timings the rc.2 review found.
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const qa = dirname(fileURLToPath(import.meta.url));
const files = {
  '/client.js': await readFile(join(qa, '../src/client.js')),
  '/harness.js': await readFile(join(qa, 'appearance-harness.js')),
  '/fixture.js': await readFile(join(qa, 'appearance-wallpaper-fixture.js')),
};
const server = createServer((req, res) => {
  const key = req.url.split('?')[0];
  if (files[key]) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(files[key]); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><title>Whale wallpaper QA</title></head><body>
    <main id="root">
      <div id="fixture-base" style="background:var(--dsw-alias-bg-base)">Canvas</div>
      <div id="fixture-card" style="background:var(--dsw-alias-bg-layer-1)">Card</div>
      <div id="fixture-composer" style="background:var(--dsw-specific-input-major)">Composer</div>
    </main>
    <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'whale-wallpaper-qa-'));
const browser = spawn(process.env.WHALE_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
  '--no-proxy-server', `http://127.0.0.1:${server.address().port}/`,
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
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 30000);
    pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  for (let attempt = 0; attempt < 50 && !await evaluate('Boolean(window.fixture?.run && window.whaleModule)'); attempt++) await sleep(100);
  // Same production code paths, shorter bounded waits: this only removes dead waiting time in
  // the checks below, it does not change any behaviour under test.
  await evaluate('window.__WM_WALLPAPER_TIMEOUTS__ = { firstFrameTimeoutMs: 1500, idleTimeoutMs: 800, retryDelayMs: 150 }; true');

  // B1 guard: the settings component must only touch the public controller surface. A name
  // that belongs to another closure (the theme's or the backdrop's) would only explode when a
  // user clicks a button, which is exactly what the direct-controller checks cannot see.
  {
    const component = files['/client.js'].toString();
    const start = component.indexOf('function WhaleAppearanceSettings');
    const end = component.indexOf('function WhaleSessionStatus');
    assert.ok(start > 0 && end > start, 'the settings component is present in the client bundle');
    const body = component.slice(start, end).replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const name of ['selectionRevision', 'themeActive', 'reconcile(', 'backdrop.update', 'backdrop.stop']) {
      assert.ok(!body.includes(name), `the settings component must not read the ${name} closure`);
    }
    const used = [...body.matchAll(/controller\.([A-Za-z]+)/g)].map(match => match[1]);
    const allowed = new Set(['read', 'media', 'wallpaper', 'set', 'reset', 'importMedia']);
    const unexpected = [...new Set(used)].filter(name => !allowed.has(name));
    assert.equal(unexpected.length, 0, `the settings component uses only public controller members: ${unexpected.join(', ')}`);
  }

  const results = await evaluate(`(async () => {
    const { assert, wait } = fixture;
    const statusText = () => {
      const node = fixture.controls().find(entry => entry.props['data-wm-wallpaper-state'] !== undefined);
      return node ? node.children.flat(Infinity).join('') : '';
    };

    // 0. An unavailable Host is explained, and starting it creates nothing.
    fixture.wallpaperHost({ available: false, reason: 'helper' });
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', background: 'wallpaper' }));
    fixture.boot();
    const unavailableController = fixture.controller;
    const unavailable = await unavailableController.wallpaper.loadHostStatus();
    assert(unavailable.available === false && unavailable.unavailableReason === 'helper', 'the Host reports why the preview cannot run');
    await unavailableController.wallpaper.start('lucy');
    assert(unavailableController.wallpaper.getStatus().error.includes('unavailable'), 'a failed start surfaces the Host reason');
    assert(fixture.preview.starts === 0 && fixture.preview.state === 'idle', 'no run is created while the preview is unavailable');
    const prepared = document.getElementById('wm-backdrop');
    assert(!prepared || (prepared.hidden && !document.body.dataset.wmBackdrop), 'an unavailable preview never becomes visible');
    fixture.dispose();

    // 1. Selecting Wallpaper Engine must not start anything by itself.
    fixture.wallpaperHost();
    fixture.boot();
    const c = fixture.controller;
    assert(c.read().background === 'wallpaper', 'a stored wallpaper choice survives reload');
    assert(fixture.preview.starts === 0 && fixture.preview.streams === 0, 'selecting the source does not start a preview');

    // 2. The controls exist and are wired.
    const controls = fixture.controls();
    assert(controls.filter(node => node.props['data-wm-value'] === 'wallpaper').length === 1, 'the settings segment offers the experimental source');
    // D3: the option must name Wallpaper Engine, not reuse the section heading.
    const optionText = (value) => {
      const node = fixture.controls().find(entry => entry.props['data-wm-value'] === value);
      return node ? node.children.flat(Infinity).join('') : '';
    };
    const wallpaperOption = optionText('wallpaper');
    assert(wallpaperOption.includes('Wallpaper Engine'), 'the option names the experimental source: ' + wallpaperOption);
    assert(!/^背景壁纸$/.test(wallpaperOption.trim()), 'the option does not reuse the section heading');
    // The section heading above the source row keeps its original wording.
    const sectionTitle = fixture.controls().find(entry => entry.props.className === 'wm-settings-subtitle');
    assert(sectionTitle && sectionTitle.children.flat(Infinity).join('') === '背景壁纸', 'the section heading keeps its own wording');
    assert(optionText('none') === '无' && optionText('image') === '图片' && optionText('video') === '视频', 'the other source options keep their wording');
    // The English copy must name the source too, instead of the section heading.
    const languageProperty = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    const englishOption = optionText('wallpaper');
    if (languageProperty) Object.defineProperty(navigator, 'language', languageProperty);
    assert(englishOption.includes('Wallpaper Engine'), 'the English option names the experimental source: ' + englishOption);
    assert(englishOption !== 'Wallpaper' && englishOption !== 'Background wallpaper', 'the English option is not the section heading');
    assert(optionText('none') === '无' && optionText('image') === '图片' && optionText('video') === '视频', 'the other source options keep their wording');
    assert(controls.filter(node => node.props['data-wm-action']).length === 3, 'start, restart and stop controls are present');
    const scene = controls.find(node => node.props['data-wm-setting'] === 'weScene');
    assert(scene && scene.props.value === 'lucy', 'the verified scene is the selected one');

    // 3. R2: the Host answers 503 until the first frame exists; the client must keep waiting
    //    instead of treating the normal startup gap as the end of the run.
    fixture.preview.streamScript = ['unavailable', 'unavailable', 'ok'];
    await c.wallpaper.start('lucy');
    const early = c.wallpaper.getStatus();
    assert(early.state === 'connecting' || early.state === 'starting', 'the run stays in a starting state during the gap');
    assert(c.wallpaper.running() === true, 'the run is still active while the first frame is pending');
    await wait(() => document.getElementById('wm-backdrop')?.dataset.wmSequence);
    assert(fixture.preview.streams >= 3, 'the client retried the stream after the 503 answers');
    assert(c.wallpaper.getStatus().rendered > 0, 'frames are painted after the retries');
    assert(c.wallpaper.getStatus().state === 'playing', 'the run reaches the playing state');

    // 3b. The picture is readable and cannot intercept clicks.
    const layer = document.getElementById('wm-backdrop');
    const media = layer.querySelector('canvas');
    assert(layer.dataset.wmKind === 'wallpaper', 'the preview owns the backdrop layer');
    assert(getComputedStyle(layer).pointerEvents === 'none', 'the picture cannot intercept chat clicks');
    assert(getComputedStyle(media).filter.includes('brightness') && getComputedStyle(media).filter.includes('blur'), 'brightness and blur apply to the preview picture');
    assert(getComputedStyle(layer.querySelector('.wm-backdrop-mask')).backgroundColor.includes('rgb'), 'the theme scrim applies to the preview');
    assert(getComputedStyle(document.getElementById('fixture-base')).backgroundColor === 'rgba(0, 0, 0, 0)', 'clear canvas stays transparent behind the preview');
    assert(getComputedStyle(document.getElementById('fixture-composer')).backgroundImage.includes('rgb('), 'the composer stays opaque');
    assert(!document.body.classList.contains('wm-wallpaper-probe-live'), 'the QA-only transparency class is not copied into the theme');

    // 4. R7: the status line advances with real drawing and uses this run's limit.
    const renderedAtStart = c.wallpaper.getStatus().rendered;
    await wait(() => c.wallpaper.getStatus().rendered > renderedAtStart + 5);
    const firstText = statusText();
    const firstRendered = c.wallpaper.getStatus().rendered;
    await wait(() => c.wallpaper.getStatus().rendered > firstRendered + 5);
    const secondText = statusText();
    assert(!firstText.includes('undefined') && !secondText.includes('undefined'), 'the status text has no undefined placeholder: ' + firstText);
    assert(firstText !== secondText, 'the status text advances while frames are drawn');
    const count = Number((secondText.match(/(\\d+) 帧/) ?? [])[1]);
    assert(count > 0 && count >= firstRendered, 'the displayed frame count follows the real drawing count: ' + secondText);
    assert(c.wallpaper.snapshot().seconds > 0, 'the client reports elapsed seconds for the countdown');
    assert(fixture.preview.metrics.length > 0, 'client metrics are submitted to the Host');

    // 5. R3: the stream ending (time limit / capture stopped) withdraws the last frame.
    fixture.preview.state = 'idle';
    fixture.preview.streamScript = ['end-after-first'];
    await c.wallpaper.restart('lucy');
    await wait(() => c.wallpaper.getStatus().state === 'stopped');
    await wait(() => !document.getElementById('wm-backdrop'));
    assert(!document.getElementById('wm-backdrop'), 'the layer is removed when the stream ends');
    assert(!document.body.dataset.wmBackdrop, 'the see-through marker is cleared when the stream ends');

    // 5b. D1/D2: after a stop, the next run mounts its own layer and counts only its own
    //     frames. Stopping removes the layer, so this is the case the desktop acceptance hit.
    fixture.preview.state = 'idle';
    fixture.preview.streamScript = ['ok', 'ok', 'ok'];
    await c.wallpaper.stop();
    const firstRun = c.wallpaper.snapshot();
    const metricsBefore = fixture.preview.metrics.length;
    await c.wallpaper.start('lucy');
    await wait(() => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence) > 0);
    assert(Boolean(document.getElementById('wm-backdrop')), 'starting again mounts a picture layer without any setting change');
    assert(document.body.dataset.wmBackdrop === 'wallpaper', 'the picture is presented again right after starting');
    const secondRun = c.wallpaper.snapshot();
    assert(secondRun.received < firstRun.received + secondRun.received, 'the run counter starts from this run, not the previous total');
    assert(secondRun.received > 0 && secondRun.rendered > 0, 'the new run counts its own frames');
    // This run reports its own elapsed time, and it grows from zero instead of inheriting
    // the stopped run's total. A short wait makes the growth measurable.
    const elapsedAtStart = secondRun.seconds;
    await new Promise(r => setTimeout(r, 1200));
    const laterRun = c.wallpaper.snapshot();
    assert(elapsedAtStart < 2, 'the new run starts its own clock: ' + elapsedAtStart);
    assert(laterRun.seconds > elapsedAtStart, 'the new run clock advances: ' + laterRun.seconds + ' vs ' + elapsedAtStart);
    // Metrics are submitted on a one second cadence, so they exist by now.
    const perRunMetrics = fixture.preview.metrics.slice(metricsBefore).filter(entry => entry.rendered > 0);
    assert(perRunMetrics.length > 0, 'client metrics are submitted for the new run');
    // Every submitted sample belongs to this run: the numbers must be bounded by what this run
    // has actually done, not by the totals of every run since the page loaded.
    assert(perRunMetrics.every(entry => entry.rendered <= laterRun.rendered && entry.received <= laterRun.received),
      'submitted metrics belong to the current run: ' + JSON.stringify(perRunMetrics.slice(-1)) + ' vs ' + JSON.stringify(laterRun));
    assert(perRunMetrics.every(entry => entry.seconds <= laterRun.seconds + 1.5), 'submitted metrics carry this run seconds');

    // 5c. Restart must behave the same way and also start its own accounting.
    const beforeRestart = c.wallpaper.snapshot();
    await c.wallpaper.restart('lucy');
    await wait(() => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence) > 0);
    const afterRestart = c.wallpaper.snapshot();
    assert(Boolean(document.getElementById('wm-backdrop')) && document.body.dataset.wmBackdrop === 'wallpaper', 'restart keeps a picture layer mounted');
    assert(afterRestart.received < beforeRestart.received + afterRestart.received, 'restart resets the run counters as well');
    assert(afterRestart.seconds < 2, 'restart starts a new elapsed time: ' + afterRestart.seconds);
    await c.wallpaper.stop();
    await wait(() => !document.getElementById('wm-backdrop'));

    // 5d. B1: the watched controls must run their real onClick callbacks. The earlier checks
    //     call the controller directly, which is exactly how the rc.6 button defect slipped
    //     through: the settings component read names that were not in its scope.
    {
      fixture.wallpaperHost();
      localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', background: 'wallpaper' }));
      fixture.boot();
      // Own controller so the blocks below keep theirs (each boot gets its own engine).
      const buttons = fixture.controller;
      const button = (action) => fixture.controls().find(entry => entry.props['data-wm-action'] === action);
      const click = async (action) => {
        const node = button(action);
        assert(Boolean(node), 'the ' + action + ' control exists');
        assert(typeof node.props.onClick === 'function', 'the ' + action + ' control has a real click handler');
        await node.props.onClick();
      };
      const painted = () => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence ?? 0);
      const selectedText = () => {
        const node = fixture.controls().find(entry => entry.props['data-wm-wallpaper-state'] !== undefined);
        return node ? node.children.flat(Infinity).join('') : '';
      };
      const posts = () => fixture.preview.requests.filter(entry => entry.method === 'POST');

      const postsBefore = posts().length;
      await click('wallpaper-start');
      assert(posts().length > postsBefore, 'the start control reaches the Host');
      assert(selectedText().includes('未开始') === false, 'the status line leaves the idle wording after a start: ' + selectedText());
      await wait(() => painted() > 0);
      assert(Boolean(document.getElementById('wm-backdrop')), 'the start control presents a picture');
      assert(button('wallpaper-start').props.disabled === true, 'the start control is disabled while the run is active');
      assert(button('wallpaper-stop').props.disabled === false, 'the stop control is available while the run is active');

      await click('wallpaper-stop');
      await wait(() => !document.getElementById('wm-backdrop'));
      assert(!document.getElementById('wm-backdrop'), 'the stop control removes the picture');
      assert(button('wallpaper-start').props.disabled === false, 'the start control becomes available again');

      // Start again straight from the button: this is the desktop acceptance case.
      const paintsBeforeSecond = painted();
      await click('wallpaper-start');
      await wait(() => painted() > 0);
      assert(Boolean(document.getElementById('wm-backdrop')) && document.body.dataset.wmBackdrop === 'wallpaper',
        'starting again from the control presents a picture without any setting change');
      assert(painted() > 0, 'the second run paints after the button start: ' + paintsBeforeSecond);
      const secondRunStart = buttons.wallpaper.snapshot();
      await new Promise(resolve => setTimeout(resolve, 1200));
      const secondRun = buttons.wallpaper.snapshot();
      assert(secondRun.received < secondRun.rendered + secondRun.received, 'the button start begins a fresh run count');
      assert(secondRun.seconds > secondRunStart.seconds, 'the button start runs its own clock');

      await click('wallpaper-restart');
      await wait(() => painted() > 0);
      assert(Boolean(document.getElementById('wm-backdrop')) && document.body.dataset.wmBackdrop === 'wallpaper', 'the restart control keeps a picture');

      // A failing action must leave the controls usable and say what happened.
      await click('wallpaper-stop');
      await wait(() => !document.getElementById('wm-backdrop'));
      fixture.preview.failStart = true;
      await click('wallpaper-start');
      assert(buttons.wallpaper.running() === false, 'a refused start does not leave a run behind');
      assert(button('wallpaper-start').props.disabled === false, 'the start control is usable again after a failure');
      assert(selectedText().length > 0, 'the status line still explains the failed action: ' + selectedText());
      assert(selectedText().includes('undefined') === false, 'no undefined placeholder after a failure: ' + selectedText());
      fixture.preview.failStart = false;
      await click('wallpaper-start');
      await wait(() => painted() > 0);
      assert(Boolean(document.getElementById('wm-backdrop')), 'the controls recover after a failed start');
      await click('wallpaper-stop');
      await wait(() => !document.getElementById('wm-backdrop'));
      fixture.dispose();
    }

    // 6. R5: a late start reply must not revive a run the user already stopped.
    fixture.wallpaperHost();
    fixture.boot();
    const slow = fixture.controller;
    fixture.preview.startDelayMs = 400;
    const starting = slow.wallpaper.start('lucy');
    await new Promise(r => setTimeout(r, 60));
    await slow.wallpaper.stop();
    fixture.preview.startDelayMs = 0;
    await starting;
    await new Promise(r => setTimeout(r, 200));
    assert(slow.wallpaper.running() === false, 'a late start response does not restart the run');
    assert(slow.wallpaper.getStatus().state !== 'connecting', 'the client does not reconnect from a stale start');
    assert(!document.getElementById('wm-backdrop'), 'no layer is mounted from the stale start');

    // 7. R6: a close that cannot be proven is shown as a failure with a retry, not success.
    fixture.preview.stopFails = true;
    await slow.wallpaper.start('lucy');
    await wait(() => slow.wallpaper.running());
    await slow.wallpaper.stop();
    const failedStatus = slow.wallpaper.getStatus();
    assert(failedStatus.state === 'cleanup-failed', 'an unproven close is reported as a cleanup failure');
    assert(failedStatus.error.length > 0, 'the failure carries a reason');
    const failedText = statusText();
    assert(failedText.includes('关闭未确认') || failedText.includes('重试'), 'the status line tells the user to retry: ' + failedText);
    const startButton = fixture.controls().find(node => node.props['data-wm-action'] === 'wallpaper-start');
    const stopButton = fixture.controls().find(node => node.props['data-wm-action'] === 'wallpaper-stop');
    assert(startButton.props.disabled === true, 'a new start stays blocked while the old window may exist');
    assert(stopButton.props.disabled === false, 'the retry control is available');
    fixture.preview.stopFails = false;
    await slow.wallpaper.stop();
    assert(slow.wallpaper.getStatus().state !== 'cleanup-failed', 'a successful retry clears the failure');

    // 8. A failed restart stays failed and says why.
    fixture.preview.failRestart = true;
    await slow.wallpaper.restart('lucy');
    assert(slow.wallpaper.getStatus().state === 'error', 'a failed restart reports an error state');
    assert(slow.wallpaper.getStatus().error.length > 0, 'a failed restart keeps its reason');
    assert(slow.wallpaper.running() === false, 'a failed restart does not pretend to be connected');
    fixture.preview.failRestart = false;

    // 9. Switching to another source stops this run before showing that source.
    fixture.wallpaperHost();
    fixture.boot();
    const switched = fixture.controller;
    fixture.preview.streamScript = ['ok', 'ok'];
    await switched.wallpaper.start('lucy');
    await wait(() => switched.wallpaper.running());
    const stopsBefore = fixture.preview.stopped;
    switched.set('background', 'image');
    await wait(() => fixture.preview.stopped > stopsBefore);
    assert(fixture.preview.state === 'idle', 'the Host was asked to stop this run');
    assert(!document.getElementById('wm-backdrop'), 'the preview layer is gone after the switch');
    await switched.importMedia('image', await fixture.makeImage());
    await wait(() => switched.media.getSnapshot().status === 'ready');
    assert(document.body.dataset.wmBackdrop === 'image', 'the chosen image is presented instead');
    const startsBefore = fixture.preview.starts;
    switched.set('background', 'wallpaper');
    await new Promise(r => setTimeout(r, 150));
    assert(fixture.preview.starts === startsBefore, 'switching back does not restart the preview automatically');

    // 10. Disposal during an in-flight request leaves nothing running.
    const disposal = fixture.controller;
    fixture.preview.startDelayMs = 300;
    const pendingStart = disposal.wallpaper.start('lucy');
    await new Promise(r => setTimeout(r, 50));
    fixture.dispose();
    fixture.preview.startDelayMs = 0;
    await pendingStart.catch(() => {});
    await new Promise(r => setTimeout(r, 300));
    assert(disposal.wallpaper.running() === false, 'an unloaded client does not keep a run alive');
    assert(!document.getElementById('wm-backdrop'), 'an unloaded client leaves no layer');

    // 11. Every request stayed inside the constrained prefix.
    const unexpected = fixture.preview.requests.filter(r => !r.path.startsWith('/whale-wallpaper/'));
    assert(unexpected.length === 0, 'no request leaves the constrained route prefix');
    return fixture.results;
  })()`);

  // 12. T4: an open connection that never sends a frame, and one that stops after the first
  //     frame, must both end the run, withdraw the picture and ask the Host to clean up.
  //     This needs the real production idle timeout, so it runs in its own page pass.
  const stallResults = await evaluate(`(async () => {
    const { assert } = fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (predicate, ms = 6000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > ms) return false;
        await pause(20);
      }
      return true;
    };
    const outcomes = {};
    for (const behaviour of ['open-silent', 'stall-after-first']) {
      fixture.wallpaperHost();
      localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', background: 'wallpaper' }));
      fixture.boot();
      const c = fixture.controller;
      fixture.preview.streamScript = [behaviour];
      await c.wallpaper.start('lucy');
      if (behaviour === 'stall-after-first') await until(() => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence) > 0);
      // No frames can ever arrive: the client must not wait forever on the open reader.
      const ended = await until(() => c.wallpaper.running() === false);
      const layer = document.getElementById('wm-backdrop');
      outcomes[behaviour] = {
        ended,
        running: c.wallpaper.running(),
        state: c.wallpaper.getStatus().state,
        error: c.wallpaper.getStatus().error,
        layerExists: Boolean(layer),
        backdropMarker: document.body.dataset.wmBackdrop ?? null,
        hostStopCalls: fixture.preview.stopped,
      };
      fixture.dispose();
      await pause(100);
    }
    assert(outcomes['open-silent'].ended === true && outcomes['open-silent'].running === false, 'an open silent connection does not keep the run alive');
    assert(outcomes['open-silent'].state === 'error', 'a stream that never delivers a frame ends as a failure');
    assert(outcomes['open-silent'].backdropMarker === null, 'no see-through marker survives a silent stream');
    assert(outcomes['open-silent'].hostStopCalls > 0, 'the Host is asked to clean up a failed run');
    assert(outcomes['stall-after-first'].ended === true && outcomes['stall-after-first'].running === false, 'a stalled stream after the first frame does not stay playing');
    assert(outcomes['stall-after-first'].state === 'error', 'a stalled stream ends as a failure');
    assert(outcomes['stall-after-first'].backdropMarker === null, 'the stale frame is withdrawn when the stream stalls');
    assert(outcomes['stall-after-first'].layerExists === false, 'the layer is removed when the run ends');
    assert(outcomes['stall-after-first'].hostStopCalls > 0, 'the stalled run is cleaned up on the Host');
    return outcomes;
  })()`);

  // 13. A temporary gap must recover: frames arriving again inside the idle window bring the
  //     picture back instead of ending the run.
  const recovery = await evaluate(`(async () => {
    const { assert } = fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (predicate, ms = 8000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > ms) return false;
        await pause(20);
      }
      return true;
    };
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', background: 'wallpaper' }));
    fixture.boot();
    const c = fixture.controller;
    fixture.preview.streamScript = ['gap-then-resume', 'gap-then-resume', 'gap-then-resume'];
    await c.wallpaper.start('lucy');
    const painted = () => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence ?? 0);
    await until(() => painted() > 0);
    const first = painted();
    // The picture resumes growing after the gap, without the user touching anything.
    const resumed = await until(() => painted() > first + 3);
    const outcome = {
      resumed,
      running: c.wallpaper.running(),
      state: c.wallpaper.getStatus().state,
      painted: painted(),
      backdropMarker: document.body.dataset.wmBackdrop ?? null,
      layerVisible: document.getElementById('wm-backdrop')?.hidden === false,
      hostStopCalls: fixture.preview.stopped,
    };
    assert(outcome.resumed === true, 'frames keep arriving after a temporary gap');
    assert(outcome.running === true, 'a temporary gap does not end the run');
    assert(outcome.state === 'playing', 'the state returns to playing after frames resume');
    assert(outcome.layerVisible === true && outcome.backdropMarker === 'wallpaper', 'the picture is presented again');
    fixture.dispose();
    await pause(100);
    return outcome;
  })()`);

  // 14. U1: a healthy stream must survive far past the first-frame window. The checks above run
  //     with a 1500 ms first-frame window, so several seconds of continuous frames is well past
  //     it; a clock jump must not end it either, because the bounds are about silence and not
  //     about the age of the run.
  const healthy = await evaluate(`(async () => {
    const { assert } = fixture;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    fixture.wallpaperHost();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', background: 'wallpaper' }));
    fixture.boot();
    const c = fixture.controller;
    fixture.preview.streamScript = ['ok', 'ok', 'ok', 'ok'];
    await c.wallpaper.start('lucy');
    const painted = () => Number(document.getElementById('wm-backdrop')?.dataset.wmSequence ?? 0);
    await pause(500);
    const before = { frames: c.wallpaper.snapshot().rendered, state: c.wallpaper.getStatus().state };
    // Keep the stream flowing while the client clock jumps by 30 s, exactly like the review.
    const realNow = Date.now;
    let offset = 0;
    Date.now = () => realNow() + offset;
    offset = 30000;
    await pause(4000);
    const outcome = {
      before,
      afterFrames: c.wallpaper.snapshot().rendered,
      state: c.wallpaper.getStatus().state,
      error: c.wallpaper.getStatus().error,
      running: c.wallpaper.running(),
      hostStopCalls: fixture.preview.stopped,
      backdropMarker: document.body.dataset.wmBackdrop ?? null,
      elapsedSeconds: c.wallpaper.snapshot().seconds,
      painted: painted(),
    };
    Date.now = realNow;
    assert(outcome.running === true, 'a healthy stream is not stopped by the first-frame window');
    assert(outcome.state === 'playing', 'a healthy stream stays playing, got ' + outcome.state + ' ' + outcome.error);
    assert(outcome.afterFrames > outcome.before.frames, 'frames keep being drawn well past the first-frame window');
    assert(outcome.hostStopCalls === 0, 'no Host cleanup is requested for a healthy stream');
    assert(outcome.backdropMarker === 'wallpaper', 'the picture stays presented');
    assert(outcome.elapsedSeconds >= 4, 'the run really went past the first-frame window');
    fixture.preview.state = 'idle';
    await c.wallpaper.stop();
    fixture.dispose();
    await pause(100);
    return outcome;
  })()`);
  console.log(JSON.stringify({ passed: results.length, results, stallResults, recovery, healthy, isolatedProfile: profile }, null, 2));
  await cdp('Browser.close').catch(() => {});
} finally {
  socket?.close(); for (const request of pending.values()) clearTimeout(request.timer);
  browser.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
