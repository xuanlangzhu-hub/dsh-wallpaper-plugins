// Isolated browser fixture: real DOM/CSS/IndexedDB/media, a small DSH service stand-in.
// This does not emulate the official Desktop shell or claim visual acceptance there.
const liveUrls = new Set();
const createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = blob => { const url = createUrl(blob); liveUrls.add(url); return url; };
URL.revokeObjectURL = url => { liveUrls.delete(url); revokeUrl(url); };
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
  useSyncExternalStore: (_subscribe, get) => get(), useRef: value => ({ current: value }),
  // The stub is intentionally not a renderer: the settings component is called once per assertion
  // batch, so an effect runs once for that call and its cleanup runs immediately. That is enough for
  // "read the cached list on mount" and "drop a late answer after unmount", which is what the
  // picker needs; it is not a claim that React scheduling is reproduced here.
  useEffect: (run, _deps) => { const off = run(); if (typeof off === 'function') off(); },
  useCallback: (fn, _deps) => fn,
};
window.__ModuleLoader__ = { load({ factory }) {
  window.whaleModule = factory(name => name === 'react' ? React : { FishLogo() {} });
} };
window.fixture = { liveUrls, results: [] };
fixture.assert = (value, message) => { if (!value) throw new Error(message); fixture.results.push(message); };
fixture.wait = async predicate => {
  const start = performance.now();
  while (!predicate()) { if (performance.now() - start > 6000) throw new Error('Timed out: ' + predicate); await new Promise(r => setTimeout(r, 20)); }
};
fixture.boot = () => {
  const themes = new Map(), handlers = new Set(), disposers = [];
  let active = { id: 'dark', tokens: {} };
  const theme = {
    register(value) { themes.set(value.id, value); return () => themes.delete(value.id); },
    getTheme: () => ({ active }),
    setTheme(id) {
      for (const key of Object.keys(active.tokens || {})) document.documentElement.style.removeProperty(key);
      active = themes.get(id) || { id, tokens: {} };
      for (const [key, value] of Object.entries(active.tokens)) document.documentElement.style.setProperty(key, value);
      for (const callback of [...handlers]) callback({ active });
    },
  };
  const ctx = { theme,
    on(_event, callback) { handlers.add(callback); return () => handlers.delete(callback); },
    effect(callback) { const off = callback(); if (typeof off === 'function') disposers.push(off); },
    slots: {
      inject(_name, callback) { callback(); },
      register(config, component) {
        if (config.name === 'settings.general.item') { fixture.controller = config.inject().controller; fixture.settingsComponent = component; }
        return () => {};
      },
    },
  };
  whaleModule.apply(ctx);
  fixture.theme = theme;
  fixture.dispose = () => { for (const off of disposers.reverse()) off(); };
};
fixture.makeImage = async (name = 'sample.png') => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d'); context.fillStyle = '#86a8c2'; context.fillRect(0, 0, 32, 32);
  return new File([await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))], name, { type: 'image/png' });
};
fixture.makeVideo = async () => {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 36;
  const context = canvas.getContext('2d'), stream = canvas.captureStream(12);
  const chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
  recorder.ondataavailable = event => chunks.push(event.data);
  const ended = new Promise(resolve => recorder.onstop = resolve);
  recorder.start();
  for (let i = 0; i < 10; i++) {
    context.fillStyle = i % 2 ? '#5794c4' : '#4a3177'; context.fillRect(0, 0, 64, 36);
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  recorder.stop(); await ended; stream.getTracks().forEach(track => track.stop());
  return new File(chunks, 'sample.webm', { type: 'video/webm' });
};
fixture.controls = () => {
  const all = [];
  const visit = node => { if (!node || typeof node !== 'object') return; all.push(node); (node.children || []).forEach(visit); };
  visit(fixture.settingsComponent({ controller: fixture.controller })); return all;
};
fixture.run = async () => {
  const { assert, wait } = fixture;
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', sidebar: 'deep', glass: 'standard' }));
  fixture.boot(); let c = fixture.controller;
  assert(c.read().sidebar === 'deep' && c.read().background === 'none' && c.read().palette === 'ocean', 'legacy settings retained with additive defaults');
  assert(c.read().brightness === 70 && c.read().mask === 45, 'legacy default brightness and mask retained as 70 and 45');
  for (const legacyBrightness of [20, 70, 100]) {
    assert(c.set('brightness', legacyBrightness).brightness === legacyBrightness, 'legacy brightness preserved: ' + legacyBrightness);
  }
  // Cold-start normalize: candidate high brightness (200) stored in local storage normalizes to 120 on boot without resetting other fields
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', canvas: 'clear', sidebar: 'deep', glass: 'standard', brightness: 200 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().brightness === 120 && c.read().sidebar === 'deep', 'cold boot clamps stored candidate brightness 200 to 120 preserving other settings');
  assert(document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'clamped stored brightness 200 projects 1.2 to CSS');
  // Exercise the picker callback through the REAL appearance controller (not a fake controller.set).
  // Only the list snapshot is supplied by this fixture; the production callback, validation,
  // persistence and subsequent render all run unchanged. The old whitelist omission fails here.
  c.set('background', 'wallpaper'); // Mount the picker before exercising its real callback.
  const chosenScene = { id: 'we-' + 'a'.repeat(24), title: 'Fixture second scene', type: 'scene', available: true };
  const pickerControls = () => {
    const originalUseState = React.useState;
    let stateSlot = 0;
    React.useState = initial => {
      const slot = stateSlot++;
      return slot === 4
        ? [{ items: [chosenScene], state: 'ready', loaded: true, loading: false, error: '', rootWarnings: [] }, () => {}]
        : originalUseState(initial);
    };
    try { return fixture.controls(); }
    finally { React.useState = originalUseState; }
  };
  const sceneButton = pickerControls().find(node => node.props['data-wm-scene-item'] === chosenScene.id);
  assert(sceneButton && sceneButton.props['aria-disabled'] === false, 'the fixture second scene is selectable');
  sceneButton.props.onClick();
  assert(c.read().weScene === chosenScene.id, 'clicking a second scene changes the real controller selection');
  assert(JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')).weScene === chosenScene.id, 'picker selection is persisted through the real controller');
  const selectedButton = pickerControls().find(node => node.props['data-wm-scene-item'] === chosenScene.id);
  assert(selectedButton.props['aria-checked'] === true && selectedButton.props.className.includes('is-selected'), 'a subsequent picker render highlights the chosen scene');
  fixture.dispose(); fixture.boot(); c = fixture.controller;
  assert(c.read().weScene === chosenScene.id, 'a fresh plugin instance retains the chosen scene');
  for (const invalid of ['../project.json', '__proto__', 'we-zzzzzzzzzzzzzzzzzzzzzzzz', null]) {
    assert(c.set('weScene', invalid).weScene === chosenScene.id, 'invalid scene values cannot replace the saved selection: ' + String(invalid));
  }
  assert(c.set('weScene', 'lucy').weScene === 'lucy', 'the real controller can switch the selection back to Lucy');
  const savedAppearanceForHarness = localStorage.getItem('dsh-whale-mist.appearance.v1');

  // --- Wallpaper Appearance Presets P1 verification ---
  // Initially for Lucy no preset is saved
  let presetRow = fixture.controls().find(n => n.props && n.props['data-wm-presets-target'] === 'lucy');
  assert(presetRow && presetRow.props['data-wm-presets-has'] === 'false', 'wallpaper presets row renders for Lucy with empty status');
  let saveBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-save');
  let applyBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-apply');
  let deleteBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-delete');
  assert(saveBtn && saveBtn.props.disabled === false, 'save preset button enabled when target is idle/stopped and usable');
  assert(applyBtn && applyBtn.props.disabled === true, 'apply preset button disabled when no preset is saved');
  assert(deleteBtn && deleteBtn.props.disabled === true, 'delete preset button disabled when no preset is saved');

  // Adjust Lucy appearance and click real save button
  c.set('brightness', 115); c.set('mask', 30); c.set('blur', 12); c.set('surface', 90);
  saveBtn.props.onClick();
  assert(c.presets.get('lucy') && c.presets.get('lucy').brightness === 115 && c.presets.get('lucy').mask === 30 && c.presets.get('lucy').blur === 12 && c.presets.get('lucy').surface === 90, 'save button stores 4 appearance fields for Lucy');
  const storedPresets = JSON.parse(localStorage.getItem('dsh-whale-mist.wallpaper-appearance-presets.v1'));
  assert(storedPresets && storedPresets.version === 1 && storedPresets.entries.lucy.brightness === 115, 'preset is persisted to localStorage');
  const snapshot = c.presets.getSnapshot();
  assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.entries.lucy), 'preset snapshot is frozen against external mutation');

  // UI updates to reflect saved state
  presetRow = fixture.controls().find(n => n.props && n.props['data-wm-presets-target'] === 'lucy');
  assert(presetRow && presetRow.props['data-wm-presets-has'] === 'true', 'UI reflects preset saved for Lucy');
  applyBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-apply');
  deleteBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-delete');
  assert(applyBtn && applyBtn.props.disabled === false && deleteBtn && deleteBtn.props.disabled === false, 'apply and delete buttons enabled once preset is saved');

  // A/B Isolation: switch to scene B and test confirmation boundary
  const sceneBId = 'we-' + 'b'.repeat(24);
  c.set('weScene', sceneBId);
  c.set('brightness', 85); c.set('mask', 55); c.set('blur', 4); c.set('surface', 70);

  // Unconfirmed scene B: UI buttons disabled and controller rejects save/apply/remove
  let bButtons = fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action']));
  assert(bButtons.every(b => b.props.disabled === true), 'all preset buttons disabled when scene B is unconfirmed');
  const unconfirmedSaveRes = c.presets.save();
  assert(unconfirmedSaveRes.ok === false && unconfirmedSaveRes.error === 'scene-unconfirmed', 'controller rejects save for unconfirmed scene B');
  const unconfirmedApplyRes = c.presets.apply();
  assert(unconfirmedApplyRes.ok === false && unconfirmedApplyRes.error === 'scene-unconfirmed', 'controller rejects apply for unconfirmed scene B');
  const unconfirmedDeleteRes = c.presets.remove();
  assert(unconfirmedDeleteRes.ok === false && unconfirmedDeleteRes.error === 'scene-unconfirmed', 'controller rejects delete for unconfirmed scene B');

  // Once confirmed available in library snapshot: save succeeds and buttons reflect usability
  c.wallpaper.setLibrarySnapshot({ items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: true }], loaded: true, state: 'ready' });
  let bSaveBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-save');
  assert(bSaveBtn && bSaveBtn.props.disabled === false, 'save preset button enabled for confirmed scene B');
  const saveBRes = c.presets.save();
  assert(saveBRes.ok && saveBRes.targetId === sceneBId, 'controller saves preset for confirmed scene B');
  assert(c.presets.get('lucy').brightness === 115 && c.presets.get(sceneBId).brightness === 85, 'A and B presets are strictly isolated');

  // Explicitly unavailable scene B: UI disabled and controller rejects
  c.wallpaper.setLibrarySnapshot({ items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: false }], loaded: true, state: 'ready' });
  let bUnavailableButtons = fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action']));
  assert(bUnavailableButtons.every(b => b.props.disabled === true), 'all preset buttons disabled when scene B is explicitly unavailable');
  const unavailSaveRes = c.presets.save();
  assert(unavailSaveRes.ok === false && unavailSaveRes.error === 'scene-unavailable', 'controller rejects save for unavailable scene B');

  // Restore scene B availability for remaining tests
  c.wallpaper.setLibrarySnapshot({ items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: true }], loaded: true, state: 'ready' });

  // Real Apply callback: switch to Lucy, change current appearance, click apply
  c.set('weScene', 'lucy');
  c.set('brightness', 40); c.set('mask', 80); c.set('blur', 0); c.set('surface', 50);
  applyBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-apply');
  applyBtn.props.onClick();
  assert(c.read().brightness === 115 && c.read().mask === 30 && c.read().blur === 12 && c.read().surface === 90, 'apply button restores Lucy preset appearance');
  assert(document.body.style.getPropertyValue('--wm-bg-brightness') === '1.15' && document.body.style.getPropertyValue('--wm-bg-mask') === '0.3', 'applied preset projects to CSS variables');
  assert(c.read().weScene === 'lucy' && c.read().weMode === 'preview' && c.read().weAutoStart === false, 'preset apply preserves weScene, weMode, and weAutoStart');

  // Real Delete callback: delete Lucy, verify B is preserved and current sliders unchanged
  deleteBtn = fixture.controls().find(n => n.props && n.props['data-wm-action'] === 'preset-delete');
  deleteBtn.props.onClick();
  assert(c.presets.get('lucy') === null, 'delete button removes Lucy preset');
  assert(c.presets.get(sceneBId).brightness === 85, 'deleting Lucy preset leaves scene B preset intact');
  assert(c.read().brightness === 115 && c.read().mask === 30, 'deleting preset leaves current slider values unchanged');
  presetRow = fixture.controls().find(n => n.props && n.props['data-wm-presets-target'] === 'lucy');
  assert(presetRow && presetRow.props['data-wm-presets-has'] === 'false', 'UI reflects preset deleted');

  // Mismatch guard: Host reports playing Lucy while user selected scene B
  c.set('weScene', sceneBId);
  const originalGetStatus = c.wallpaper.getStatus;
  c.wallpaper.getStatus = () => ({ state: 'playing', host: { activeSceneId: 'lucy' } });
  const mismatchButtons = fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action']));
  assert(mismatchButtons.every(b => b.props.disabled === true), 'all preset buttons disabled when active wallpaper mismatches selection');
  const mismatchSaveRes = c.presets.save();
  assert(mismatchSaveRes.ok === false && mismatchSaveRes.error === 'mismatch', 'controller rejects save when active scene mismatches selection');
  const mismatchApplyRes = c.presets.apply();
  assert(mismatchApplyRes.ok === false && mismatchApplyRes.error === 'mismatch', 'controller rejects apply on mismatch');
  const mismatchDeleteRes = c.presets.remove();
  assert(mismatchDeleteRes.ok === false && mismatchDeleteRes.error === 'mismatch', 'controller rejects delete on mismatch');

  // Transition & cleanup-failed guards: buttons disabled and controller rejects
  c.wallpaper.getStatus = () => ({ state: 'starting' });
  assert(fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'buttons disabled during starting transition');
  assert(c.presets.save().error === 'transition', 'controller rejects save during transition');
  c.wallpaper.getStatus = () => ({ state: 'cleanup-failed' });
  assert(fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'buttons disabled on cleanup-failed');
  assert(c.presets.save().error === 'cleanup-failed', 'controller rejects save on cleanup-failed');

  // Lucy sample fallback vs explicit Lucy unavailable in Host status
  c.wallpaper.getStatus = originalGetStatus;
  c.set('weScene', 'lucy');
  c.wallpaper.setLibrarySnapshot({ items: [], loaded: true, state: 'ready' });
  assert(c.presets.resolveTarget().ok === true && c.presets.resolveTarget().targetId === 'lucy', 'Lucy sample fallback allows Lucy preset operations without catalog entry');
  c.wallpaper.getStatus = () => ({ state: 'stopped', host: { scenes: [{ id: 'lucy', available: false }] } });
  assert(c.presets.resolveTarget().ok === false && c.presets.resolveTarget().error === 'scene-unavailable', 'explicit Lucy unavailable in host status rejects Lucy preset');
  c.wallpaper.getStatus = originalGetStatus;

  // R1: Stop request attribution & stale callback isolation
  // R2: Catalog refresh resurrection & network exception bypass
  const origFetchForR1R2 = window.fetch;
  let r1PendingStops = [];
  let r1HostActive = false;
  let r2CatalogMode = 'sceneB-ok';
  let r2ReleaseRefresh = null;
  let r2HoldRefresh = false;

  window.fetch = async (input, init = {}) => {
    const path = new URL(String(input), location.href).pathname;
    const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (path === '/whale-wallpaper/status') {
      return jsonRes({ available: true, active: r1HostActive, activeSceneId: r1HostActive ? 'lucy' : null, scenes: [{ id: 'lucy', available: true }], cleanup: { closed: true, outcome: 'closed' } });
    }
    if (path === '/whale-wallpaper/start' || path === '/whale-wallpaper/restart') {
      r1HostActive = true;
      return jsonRes({ available: true, active: true, activeSceneId: 'lucy', scenes: [{ id: 'lucy', available: true }], cleanup: { closed: true, outcome: 'closed' } });
    }
    if (path === '/whale-wallpaper/stop') {
      return new Promise(resolve => {
        r1PendingStops.push(data => resolve(jsonRes(data || { available: true, active: false, cleanup: { closed: true, outcome: 'closed' } })));
      });
    }
    if (path === '/whale-wallpaper/stream') {
      return new Response(new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () => { try { controller.error(new DOMException('Stopped', 'AbortError')); } catch {} }, { once: true });
        }
      }));
    }
    if (path === '/whale-wallpaper/library/refresh') {
      if (r2HoldRefresh) {
        return new Promise(resolve => {
          r2ReleaseRefresh = () => {
            const avail = r2CatalogMode === 'sceneB-ok';
            resolve(jsonRes({ loaded: true, state: 'ready', items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: avail }] }));
          };
        });
      }
      return jsonRes({ loaded: true, state: 'ready', items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: r2CatalogMode === 'sceneB-ok' }] });
    }
    if (path === '/whale-wallpaper/library') {
      if (r2CatalogMode === 'throw') throw new Error('isolated-catalog-network-error');
      if (r2CatalogMode === 'failed') return jsonRes({ loaded: false, state: 'failed', error: 'catalog-service-failed' }, 500);
      const avail = r2CatalogMode === 'sceneB-ok';
      return jsonRes({ loaded: true, state: 'ready', items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: avail }] });
    }
    return origFetchForR1R2(input, init);
  };

  try {
    // 1. Single stop in flight
    r1PendingStops = [];
    const stopPromise = c.wallpaper.stop('user');
    await wait(() => r1PendingStops.length === 1);
    assert(c.wallpaper.hasPendingCleanup() === true, 'wallpaper hasPendingCleanup returns true during stop');
    assert(c.presets.resolveTarget().ok === false && c.presets.resolveTarget().error === 'transition', 'resolveTarget rejects during real stop promise pending');
    assert(fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'preset buttons disabled during real stop promise pending');
    assert(c.presets.save().error === 'transition', 'controller save rejected during real stop promise pending');
    r1PendingStops.shift()({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await stopPromise;
    assert(c.wallpaper.hasPendingCleanup() === false, 'wallpaper hasPendingCleanup returns false after stop resolves');
    assert(c.presets.resolveTarget().ok === true, 'resolveTarget succeeds after real stop completes');

    // 2. Out-of-order stops: late older stop success after newer cleanup failure
    await c.wallpaper.start('lucy', 'daily');
    r1PendingStops = [];
    const s1 = c.wallpaper.stop('user');
    const s2 = c.wallpaper.stop('reset');
    await wait(() => r1PendingStops.length === 2);
    // Complete newer stop s2 with cleanup failure
    r1PendingStops[1]({ available: true, active: true, cleanup: { closed: false, outcome: 'unconfirmed', error: 'test-stop-failure' } });
    await s2;
    assert(c.wallpaper.getStatus().state === 'cleanup-failed', 'state becomes cleanup-failed on newer stop failure');
    assert(c.presets.resolveTarget().error === 'cleanup-failed', 'resolveTarget rejects with cleanup-failed on newer stop failure');
    assert(c.presets.save().error === 'cleanup-failed', 'save rejects with cleanup-failed on newer stop failure');
    assert(fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'preset buttons disabled on cleanup-failed');
    // Now complete older stop s1 with cleanup success
    r1PendingStops[0]({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await s1;
    assert(c.wallpaper.getStatus().state === 'cleanup-failed', 'state remains cleanup-failed after delayed older stop success');
    assert(c.presets.resolveTarget().error === 'cleanup-failed', 'resolveTarget still rejects with cleanup-failed after older stop success');
    assert(c.presets.save().error === 'cleanup-failed', 'save still rejects with cleanup-failed after older stop success');
    assert(fixture.controls().filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'preset buttons remain disabled after older stop success');

    // 3. Stale stop reply after new start
    r1PendingStops = [];
    const clearStop = c.wallpaper.stop('user');
    await wait(() => r1PendingStops.length === 1);
    r1PendingStops.shift()({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await clearStop;
    await c.wallpaper.start('lucy', 'daily');
    r1PendingStops = [];
    const oldStop = c.wallpaper.stop('user');
    await wait(() => r1PendingStops.length === 1);
    await c.wallpaper.start('lucy', 'daily');
    assert(c.wallpaper.getStatus().state === 'connecting', 'new start reaches connecting state');
    assert(c.presets.resolveTarget().error === 'transition', 'presets blocked during connecting transition');
    r1PendingStops.shift()({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await oldStop;
    assert(c.wallpaper.getStatus().state === 'connecting', 'state remains connecting after delayed stop reply');
    assert(c.presets.resolveTarget().error === 'transition', 'presets remain blocked after delayed stop reply');
    assert(c.presets.save().error === 'transition', 'save rejects after delayed stop reply');
    assert(c.wallpaper.getStatus().host?.active === true, 'host active snapshot is not overwritten by delayed stop reply');
    assert(r1HostActive === true, 'host active state is preserved across stale stop reply');

    // 4. Stale stop reply after new restart
    r1PendingStops = [];
    const oldStopForRestart = c.wallpaper.stop('user');
    await wait(() => r1PendingStops.length === 1);
    await c.wallpaper.restart('lucy', 'daily');
    assert(c.wallpaper.getStatus().state === 'connecting', 'restart reaches connecting state');
    r1PendingStops.shift()({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await oldStopForRestart;
    assert(c.wallpaper.getStatus().state === 'connecting', 'state remains connecting after delayed stop reply during restart');
    assert(c.presets.resolveTarget().error === 'transition', 'presets remain blocked after delayed stop reply during restart');

    // Clean up playback to stopped state
    r1HostActive = false;
    r1PendingStops = [];
    const stopToIdle = c.wallpaper.stop('user');
    await wait(() => r1PendingStops.length === 1);
    r1PendingStops.shift()({ available: true, active: false, cleanup: { closed: true, outcome: 'closed' } });
    await stopToIdle;

    // R2: Catalog refresh resurrection & network exception bypass
    c.set('weScene', sceneBId);
    r2CatalogMode = 'sceneB-ok';
    const initialLib = await c.wallpaper.readLibrary();
    assert(initialLib.loaded === true && c.presets.resolveTarget().ok === true, 'scene B confirmed available initially');

    // Case 1: Pending refresh + old loaded/ready UI component render
    r2HoldRefresh = true;
    r2CatalogMode = 'sceneB-unavail';
    const refreshPromise = c.wallpaper.readLibrary({ refresh: true });
    await wait(() => r2ReleaseRefresh !== null);
    assert(c.wallpaper.getLibrarySnapshot() === null, 'library snapshot cleared when refresh starts');
    assert(c.presets.resolveTarget().error === 'scene-unconfirmed', 'resolveTarget returns scene-unconfirmed during refresh');
    const savedUseState = React.useState, savedUseEffect = React.useEffect;
    React.useState = initial => {
      const v = typeof initial === 'function' ? initial() : initial;
      return v && Object.hasOwn(v, 'items') && Object.hasOwn(v, 'loaded')
        ? [{ ...initialLib, loading: true }, () => {}]
        : [v, () => {}];
    };
    React.useEffect = () => {};
    let renderedControls;
    try { renderedControls = fixture.controls(); }
    finally { React.useState = savedUseState; React.useEffect = savedUseEffect; }
    assert(c.wallpaper.getLibrarySnapshot() === null, 'component render does not restore library snapshot during refresh');
    assert(renderedControls.filter(n => n.props && ['preset-save', 'preset-apply', 'preset-delete'].includes(n.props['data-wm-action'])).every(b => b.props.disabled === true), 'preset buttons remain disabled during catalog refresh render');
    assert(c.presets.save().error === 'scene-unconfirmed', 'controller rejects save for scene-unconfirmed during refresh');
    assert(c.presets.apply().error === 'scene-unconfirmed', 'controller rejects apply for scene-unconfirmed during refresh');
    assert(c.presets.remove().error === 'scene-unconfirmed', 'controller rejects delete for scene-unconfirmed during refresh');
    r2ReleaseRefresh();
    await refreshPromise;
    r2HoldRefresh = false;
    assert(c.presets.resolveTarget().error === 'scene-unavailable', 'controller rejects save for scene-unavailable after refresh finishes');

    // Case 2: Catalog fetch network exception immediately invalidates confirmation
    r2CatalogMode = 'sceneB-ok';
    await c.wallpaper.readLibrary();
    assert(c.presets.resolveTarget().ok === true, 'scene B confirmed available again');
    r2CatalogMode = 'throw';
    let fetchErr = null;
    try { await c.wallpaper.readLibrary(); } catch (err) { fetchErr = err; }
    assert(fetchErr !== null, 'catalog fetch throws network error');
    assert(c.wallpaper.getLibrarySnapshot() === null, 'snapshot cleared on catalog network exception');
    assert(c.presets.resolveTarget().error === 'scene-unconfirmed', 'resolveTarget returns scene-unconfirmed after network exception');
    assert(c.presets.save().error === 'scene-unconfirmed', 'controller rejects save after network exception');

    // Case 3: Non-ready catalog response clears confirmation
    r2CatalogMode = 'sceneB-ok';
    await c.wallpaper.readLibrary();
    assert(c.presets.resolveTarget().ok === true, 'scene B confirmed before non-ready test');
    r2CatalogMode = 'failed';
    const nonReadyRes = await c.wallpaper.readLibrary();
    assert(nonReadyRes.state === 'failed', 'catalog read returns non-ready failed state');
    assert(c.wallpaper.getLibrarySnapshot() === null, 'snapshot cleared on non-ready catalog response');
    assert(c.presets.resolveTarget().error === 'scene-unconfirmed', 'resolveTarget returns scene-unconfirmed on non-ready response');
    assert(c.presets.save().error === 'scene-unconfirmed', 'controller rejects save on non-ready catalog response');

    // Case 4: Concurrent reads out-of-order rejection
    let releaseSlowRead = null;
    let isSlow = true;
    const slowOrigFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const p = new URL(String(input), location.href).pathname;
      if (p === '/whale-wallpaper/library' && isSlow) {
        isSlow = false;
        return new Promise(resolve => {
          releaseSlowRead = () => resolve(new Response(JSON.stringify({ loaded: true, state: 'ready', items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: true }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
        });
      }
      return slowOrigFetch(input, init);
    };
    r2CatalogMode = 'sceneB-unavail';
    const slowReadPromise = c.wallpaper.readLibrary();
    await wait(() => releaseSlowRead !== null);
    const fastReadPromise = c.wallpaper.readLibrary();
    await fastReadPromise;
    assert(c.presets.resolveTarget().error === 'scene-unavailable', 'newer fast read sets scene B unavailable');
    releaseSlowRead();
    await slowReadPromise;
    assert(c.presets.resolveTarget().error === 'scene-unavailable', 'older slow read cannot overwrite newer catalog snapshot');

    // Case 5: Recovery when catalog confirms scene B available again
    window.fetch = origFetchForR1R2;
    r2CatalogMode = 'sceneB-ok';
    window.fetch = async (input, init = {}) => {
      const p = new URL(String(input), location.href).pathname;
      if (p === '/whale-wallpaper/library') {
        return new Response(JSON.stringify({ loaded: true, state: 'ready', items: [{ id: sceneBId, title: 'Scene B', type: 'scene', available: true }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return origFetchForR1R2(input, init);
    };
    await c.wallpaper.readLibrary();
    assert(c.presets.resolveTarget().ok === true, 'controller recovers and confirms scene B available');
  } finally {
    window.fetch = origFetchForR1R2;
  }

  // Cold boot persistence & compatibility: clamping candidate 200 to 120
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.wallpaper-appearance-presets.v1', JSON.stringify({
    version: 1,
    entries: {
      lucy: { brightness: 200, mask: 40, blur: 0, surface: 80 },
      [sceneBId]: { brightness: 90, mask: 50, blur: 2, surface: 75 }
    }
  }));
  fixture.boot(); c = fixture.controller;
  assert(c.presets.get('lucy') && c.presets.get('lucy').brightness === 120, 'cold boot clamps stored candidate high brightness 200 to 120');
  assert(c.presets.get(sceneBId) && c.presets.get(sceneBId).brightness === 90, 'cold boot reloads scene B preset correctly');

  // Resilient handling of malformed JSON and unsupported versions
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.wallpaper-appearance-presets.v1', '{ corrupt json');
  fixture.boot(); c = fixture.controller;
  assert(c.presets.get('lucy') === null && Object.keys(c.presets.getAll()).length === 0, 'corrupted presets JSON safely defaults to empty library');
  assert(localStorage.getItem('dsh-whale-mist.wallpaper-appearance-presets.v1') === '{ corrupt json', 'reading bad JSON does not overwrite stored string');

  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.wallpaper-appearance-presets.v1', JSON.stringify({ version: 99, entries: { lucy: { brightness: 100 } } }));
  fixture.boot(); c = fixture.controller;
  assert(c.presets.get('lucy') === null, 'unsupported schema version safely yields empty library');

  // Global reset does NOT delete preset library
  c.set('background', 'wallpaper');
  c.set('weScene', 'lucy');
  c.set('brightness', 110);
  c.presets.save();
  assert(c.presets.get('lucy') && c.presets.get('lucy').brightness === 110, 'Lucy preset saved before global reset');
  c.reset();
  assert(c.wallpaper.hasPendingCleanup() === true, 'global reset leaves no window during pending stop cleanup');
  await wait(() => !c.wallpaper.hasPendingCleanup());
  assert(c.read().background === 'none' && c.read().brightness === 70, 'global reset restores appearance defaults');
  assert(c.presets.get('lucy') && c.presets.get('lucy').brightness === 110, 'global reset preserves preset library');
  assert(JSON.parse(localStorage.getItem('dsh-whale-mist.wallpaper-appearance-presets.v1')).entries.lucy.brightness === 110, 'global reset keeps preset in localStorage');

  // Storage failure resilience
  c.set('background', 'wallpaper');
  c.set('weScene', 'lucy');
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => {
    if (k === 'dsh-whale-mist.wallpaper-appearance-presets.v1') throw new DOMException('Storage fault', 'QuotaExceededError');
    return originalSetItem(k, v);
  };
  try {
    const quotaFailRes = c.presets.save();
    assert(quotaFailRes.ok === false && quotaFailRes.error === 'storage-failed', 'save rejects with storage-failed when localStorage throws');
    const deleteFailRes = c.presets.remove();
    assert(deleteFailRes.ok === false && deleteFailRes.error === 'storage-failed', 'delete rejects with storage-failed when localStorage throws');
  } finally {
    localStorage.setItem = originalSetItem;
  }
  assert(c.presets.get('lucy').brightness === 110, 'storage write failure does not corrupt in-memory preset');

  // Disposal boundary
  fixture.dispose();
  assert(c.presets.save().error === 'disposed' && c.presets.apply().error === 'disposed' && c.presets.remove().error === 'disposed', 'controller presets reject operations once disposed');

  // --- Theme Readability P1 verification (Text Contrast & Chat Backdrop) ---
  // 1. Storage migration & normalization contracts
  fixture.dispose();
  // Case A: Missing chatBackdrop with opaqueChat: true migrates to chatBackdrop: 100, opaqueChat: true
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', opaqueChat: true }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'legacy opaqueChat: true migrates to chatBackdrop: 100');
  assert(c.read().textContrast === 'standard', 'missing textContrast defaults to standard');
  assert(localStorage.getItem('dsh-whale-mist.appearance.v1') === JSON.stringify({ theme: 'abyss', opaqueChat: true }), 'cold boot normalizes in memory without immediately rewriting localStorage');

  // Case B: Missing chatBackdrop with opaqueChat: false migrates to chatBackdrop: 0, opaqueChat: false
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'mist', opaqueChat: false }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'legacy opaqueChat: false migrates to chatBackdrop: 0');

  // Case C: Corrupt opaqueChat booleans (string, number, object) treat as false -> 0
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ opaqueChat: 'true' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'corrupt string boolean "true" treated as false');
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ opaqueChat: 1 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'corrupt number boolean 1 treated as false');

  // Case D: Conflict resolution: finite chatBackdrop takes priority over opaqueChat
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 45, opaqueChat: true }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 45 && c.read().opaqueChat === false, 'finite chatBackdrop 45 takes priority over opaqueChat: true');
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 100, opaqueChat: false }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'chatBackdrop 100 takes priority over opaqueChat: false');

  // Case E: Clamping and rounding
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 150 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'chatBackdrop > 100 clamped to 100');
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: -25 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'chatBackdrop < 0 clamped to 0');
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 45.4 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 45, 'decimal chatBackdrop 45.4 rounded to 45');
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 45.6 }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 46, 'decimal chatBackdrop 45.6 rounded to 46');

  // Case F: Non-finite chatBackdrop fallback to opaqueChat
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ chatBackdrop: 'invalid', opaqueChat: true }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'invalid non-finite chatBackdrop falls back to opaqueChat: true');

  // Case G: Invalid textContrast enum falls back to standard
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ textContrast: 'super-contrast' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().textContrast === 'standard', 'invalid textContrast enum falls back to standard');

  // 2. Controller API & alias synchronization
  c.set('chatBackdrop', 65);
  assert(c.read().chatBackdrop === 65 && c.read().opaqueChat === false, 'controller sets chatBackdrop to 65 with opaqueChat false');
  assert(document.body.style.getPropertyValue('--wm-chat-alpha') === '0.65', 'chatBackdrop 65 projects --wm-chat-alpha: 0.65');
  assert(document.body.dataset.wmChatTint === 'true' && document.body.dataset.wmOpaqueChat === undefined, 'chatBackdrop 65 sets wmChatTint and clears wmOpaqueChat');
  assert(JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')).chatBackdrop === 65, 'chatBackdrop 65 persists to localStorage');

  c.set('chatBackdrop', 100);
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'controller sets chatBackdrop 100 with opaqueChat true');
  assert(document.body.style.getPropertyValue('--wm-chat-alpha') === '1', 'chatBackdrop 100 projects --wm-chat-alpha: 1');
  assert(document.body.dataset.wmOpaqueChat === 'true' && document.body.dataset.wmChatTint === undefined, 'chatBackdrop 100 sets wmOpaqueChat and clears wmChatTint');

  c.set('chatBackdrop', 0);
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'controller sets chatBackdrop 0 with opaqueChat false');
  assert(document.body.style.getPropertyValue('--wm-chat-alpha') === '0', 'chatBackdrop 0 projects --wm-chat-alpha: 0');
  assert(document.body.dataset.wmOpaqueChat === undefined && document.body.dataset.wmChatTint === undefined, 'chatBackdrop 0 clears both wmOpaqueChat and wmChatTint');

  // Legacy set('opaqueChat', ...) alias sync
  c.set('opaqueChat', true);
  assert(c.read().chatBackdrop === 100 && c.read().opaqueChat === true, 'legacy set(opaqueChat, true) syncs chatBackdrop: 100');
  assert(document.body.dataset.wmOpaqueChat === 'true', 'legacy set(opaqueChat, true) projects wmOpaqueChat');
  c.set('opaqueChat', false);
  assert(c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'legacy set(opaqueChat, false) syncs chatBackdrop: 0');
  assert(document.body.dataset.wmOpaqueChat === undefined && document.body.dataset.wmChatTint === undefined, 'legacy set(opaqueChat, false) clears chat flags');

  // Invalid set rejected
  assert(c.set('chatBackdrop', '60').chatBackdrop === 0, 'invalid string chatBackdrop rejected');
  assert(c.set('chatBackdrop', NaN).chatBackdrop === 0, 'NaN chatBackdrop rejected');
  assert(c.set('opaqueChat', 'true').opaqueChat === false, 'string opaqueChat rejected');
  assert(c.set('textContrast', 'ultra').textContrast === 'standard', 'invalid textContrast rejected');

  c.set('textContrast', 'enhanced');
  assert(c.read().textContrast === 'enhanced', 'controller sets textContrast enhanced');
  assert(document.body.dataset.wmTextContrast === 'enhanced', 'textContrast enhanced projects dataset attribute');
  c.set('textContrast', 'standard');
  assert(c.read().textContrast === 'standard', 'controller sets textContrast standard');
  assert(document.body.dataset.wmTextContrast === 'standard', 'textContrast standard projects dataset attribute');

  // Reset restores defaults
  c.set('textContrast', 'enhanced');
  c.set('chatBackdrop', 80);
  c.reset();
  await wait(() => !c.wallpaper.hasPendingCleanup());
  assert(c.read().textContrast === 'standard' && c.read().chatBackdrop === 0 && c.read().opaqueChat === false, 'reset restores standard contrast and 0 chat backdrop');
  assert(document.body.dataset.wmTextContrast === 'standard' && !document.body.dataset.wmChatTint && !document.body.dataset.wmOpaqueChat, 'reset clears projection flags');

  // 3. Preset isolation: textContrast and chatBackdrop do NOT leak into wallpaper appearance presets
  c.set('weScene', 'lucy');
  c.set('background', 'wallpaper');
  c.set('textContrast', 'enhanced');
  c.set('chatBackdrop', 75);
  c.set('brightness', 95);
  c.set('mask', 25);
  c.set('blur', 6);
  c.set('surface', 70);
  const saveWithReadabilityRes = c.presets.save();
  assert(saveWithReadabilityRes.ok === true, 'preset save succeeds while enhanced readability is active');
  const lucyPresetEntry = c.presets.get('lucy');
  assert(lucyPresetEntry && lucyPresetEntry.brightness === 95 && lucyPresetEntry.mask === 25 && lucyPresetEntry.blur === 6 && lucyPresetEntry.surface === 70, 'preset entry contains exactly 4 appearance properties');
  assert(lucyPresetEntry.textContrast === undefined && lucyPresetEntry.chatBackdrop === undefined && lucyPresetEntry.opaqueChat === undefined, 'preset entry strictly excludes textContrast and chatBackdrop');
  const storedPresetRaw = JSON.parse(localStorage.getItem('dsh-whale-mist.wallpaper-appearance-presets.v1'));
  assert(storedPresetRaw.entries.lucy.textContrast === undefined && storedPresetRaw.entries.lucy.chatBackdrop === undefined, 'stored preset strictly excludes readability fields');

  // Applying preset does not alter textContrast or chatBackdrop
  c.set('textContrast', 'standard');
  c.set('chatBackdrop', 20);
  c.set('brightness', 60);
  const applyPresetRes = c.presets.apply();
  assert(applyPresetRes.ok === true && c.read().brightness === 95, 'applying preset restores brightness 95');
  assert(c.read().textContrast === 'standard', 'preset apply does not overwrite textContrast');
  assert(c.read().chatBackdrop === 20, 'preset apply does not overwrite chatBackdrop');

  // 4. UI Controls & Dynamic Hints (tested in both zh-CN and en-US)
  const languageCases = [
    {
      lang: 'zh-CN',
      label: '文字可读性',
      standardHint: '保持主题原有文字，跟随系统高对比度',
      enhancedHint: '提高正文、次要说明和普通工具行的区分，不改变状态含义',
      standardOption: '标准',
      enhancedOption: '增强'
    },
    {
      lang: 'en-US',
      label: 'Text readability',
      standardHint: 'Preserves original theme text and follows system high contrast',
      enhancedHint: 'Increases separation between body text, secondary notes, and normal tool rows without altering semantic states',
      standardOption: 'Standard',
      enhancedOption: 'Enhanced'
    }
  ];

  const originalLanguage = navigator.language;
  try {
    for (const item of languageCases) {
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => item.lang });
      const controls = fixture.controls();
      const textContrastRow = controls.find(n => (n.props && n.props.key === 'textContrast') || n.key === 'textContrast');
      assert(textContrastRow, `[${item.lang}] textContrast row rendered`);
      const copyNode = textContrastRow.children?.find(ch => ch?.props?.className === 'wm-settings-copy');
      const labelText = copyNode?.children?.find(ch => ch?.props?.className === 'wm-settings-label')?.children?.[0];
      assert(labelText === item.label, `[${item.lang}] textContrast label matches expected: ${item.label}`);

      const contrastButtons = controls.filter(n => n.props && n.props['data-wm-setting'] === 'textContrast');
      assert(contrastButtons.length === 2, `[${item.lang}] two text contrast segmented options rendered`);
      const standardBtn = contrastButtons.find(n => n.props['data-wm-value'] === 'standard');
      const enhancedBtn = contrastButtons.find(n => n.props['data-wm-value'] === 'enhanced');
      assert(standardBtn && enhancedBtn, `[${item.lang}] standard and enhanced buttons present`);
      assert(standardBtn.children?.includes(item.standardOption), `[${item.lang}] standard option text matches: ${item.standardOption}`);
      assert(enhancedBtn.children?.includes(item.enhancedOption), `[${item.lang}] enhanced option text matches: ${item.enhancedOption}`);

      // Click enhanced
      enhancedBtn.props.onClick();
      assert(c.read().textContrast === 'enhanced', `[${item.lang}] clicking enhanced sets textContrast enhanced`);
      const enhancedControls = fixture.controls();
      const enhancedRow = enhancedControls.find(n => (n.props && n.props.key === 'textContrast') || n.key === 'textContrast');
      const enhancedCopy = enhancedRow?.children?.find(ch => ch?.props?.className === 'wm-settings-copy');
      const enhancedHint = enhancedCopy?.children?.find(ch => ch?.props?.className === 'wm-settings-hint')?.children?.[0];
      assert(enhancedHint === item.enhancedHint, `[${item.lang}] dynamic hint displays enhanced text: ${item.enhancedHint}`);
      const activeEnhancedBtn = enhancedControls.find(n => n.props && n.props['data-wm-setting'] === 'textContrast' && n.props['data-wm-value'] === 'enhanced');
      assert(activeEnhancedBtn.props.className.includes('is-selected') && activeEnhancedBtn.props['aria-pressed'] === true, `[${item.lang}] enhanced button marked is-selected and aria-pressed`);

      // Click standard
      standardBtn.props.onClick();
      assert(c.read().textContrast === 'standard', `[${item.lang}] clicking standard sets textContrast standard`);
      const standardControls = fixture.controls();
      const standardRow = standardControls.find(n => (n.props && n.props.key === 'textContrast') || n.key === 'textContrast');
      const standardCopy = standardRow?.children?.find(ch => ch?.props?.className === 'wm-settings-copy');
      const standardHint = standardCopy?.children?.find(ch => ch?.props?.className === 'wm-settings-hint')?.children?.[0];
      assert(standardHint === item.standardHint, `[${item.lang}] dynamic hint displays standard text: ${item.standardHint}`);
      const activeStandardBtn = standardControls.find(n => n.props && n.props['data-wm-setting'] === 'textContrast' && n.props['data-wm-value'] === 'standard');
      assert(activeStandardBtn.props.className.includes('is-selected') && activeStandardBtn.props['aria-pressed'] === true, `[${item.lang}] standard button marked is-selected and aria-pressed`);
    }
  } finally {
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => originalLanguage });
  }

  // chatBackdrop slider conditional rendering
  c.set('background', 'none');
  assert(!fixture.controls().some(n => n.props && n.props['data-wm-setting'] === 'chatBackdrop'), 'chatBackdrop slider hidden when background is none');
  c.set('background', 'image');
  const visibleChatSlider = fixture.controls().find(n => n.props && n.props['data-wm-setting'] === 'chatBackdrop');
  assert(visibleChatSlider, 'chatBackdrop slider visible when background is image');
  assert(visibleChatSlider.props.min === 0 && visibleChatSlider.props.max === 100 && visibleChatSlider.props.step === 1, 'chatBackdrop slider has min 0, max 100, step 1');
  visibleChatSlider.props.onChange({ currentTarget: { value: 60 } });
  assert(c.read().chatBackdrop === 60, 'chatBackdrop slider onChange updates value to 60');
  const chatOutput = fixture.controls().find(n => n.type === 'output' && n.children && n.children[0] === '60%');
  assert(chatOutput, 'chatBackdrop output displays 60%');

  // No duplicate opaqueChat checkbox in region background group
  assert(!fixture.controls().some(n => n.props && n.props['data-wm-setting'] === 'opaqueChat'), 'duplicate opaqueChat checkbox removed from UI');

  // 5. Real Computed CSS Styles (Text Contrast across Mist and 4 Abyss Palettes)
  const rootContainer = document.getElementById('root');
  const colorFixture = document.createElement('div');
  colorFixture.id = 'qa-color-fixture';
  colorFixture.innerHTML = `
    <span id="qa-text-primary" style="color: var(--dsw-alias-label-primary);">Primary</span>
    <span id="qa-text-secondary" style="color: var(--dsw-alias-label-secondary);">Secondary</span>
    <span id="qa-text-tertiary" style="color: var(--dsw-alias-label-tertiary);">Tertiary</span>
    <button id="qa-button-fg" style="color: var(--dsw-alias-label-primary-foreground); background: var(--dsw-alias-button-primary-fill);">Button</button>
    <span id="qa-brand-primary" style="color: var(--dsw-alias-brand-primary);">Brand</span>
    <span id="qa-state-warn" style="color: var(--dsw-alias-state-warn-primary);">Warn</span>
  `;
  rootContainer.appendChild(colorFixture);

  const primaryEl = document.getElementById('qa-text-primary');
  const secondaryEl = document.getElementById('qa-text-secondary');
  const tertiaryEl = document.getElementById('qa-text-tertiary');
  const buttonFgEl = document.getElementById('qa-button-fg');
  const brandPrimaryEl = document.getElementById('qa-brand-primary');
  const stateWarnEl = document.getElementById('qa-state-warn');

  const normalizeRgb = (str) => str ? str.replace(/\s*,\s*/g, ' ').trim() : '';

  // 5a. Mist Theme
  c.set('theme', 'mist');
  c.set('textContrast', 'standard');
  assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(21, 48, 71)'), 'Mist standard primary matches #153047');
  assert(normalizeRgb(getComputedStyle(secondaryEl).color) === normalizeRgb('rgb(98, 121, 140)'), 'Mist standard secondary matches #62798c');
  assert(normalizeRgb(getComputedStyle(tertiaryEl).color) === normalizeRgb('rgb(128, 148, 165)'), 'Mist standard tertiary matches #8094a5');
  const mistButtonFgStandard = getComputedStyle(buttonFgEl).color;
  const mistBrandPrimaryStandard = getComputedStyle(brandPrimaryEl).color;
  const mistStateWarnStandard = getComputedStyle(stateWarnEl).color;

  c.set('textContrast', 'enhanced');
  assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(12, 38, 59)'), 'Mist enhanced primary matches #0c263b');
  assert(normalizeRgb(getComputedStyle(secondaryEl).color) === normalizeRgb('rgb(60, 86, 107)'), 'Mist enhanced secondary matches #3c566b');
  assert(normalizeRgb(getComputedStyle(tertiaryEl).color) === normalizeRgb('rgb(80, 107, 128)'), 'Mist enhanced tertiary matches #506b80');
  assert(getComputedStyle(buttonFgEl).color === mistButtonFgStandard, 'Mist button foreground is not altered by textContrast');
  assert(getComputedStyle(brandPrimaryEl).color === mistBrandPrimaryStandard, 'Mist brand primary is not altered by textContrast');
  assert(getComputedStyle(stateWarnEl).color === mistStateWarnStandard, 'Mist semantic state is not altered by textContrast');

  c.set('textContrast', 'standard');
  assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(21, 48, 71)'), 'Mist standard restores cleanly with no residue');

  // 5b. Abyss Theme across 4 palettes
  c.set('theme', 'abyss');
  for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
    c.set('palette', palette);
    c.set('textContrast', 'standard');
    assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(231, 236, 245)'), `Abyss ${palette} standard primary matches #e7ecf5`);
    assert(normalizeRgb(getComputedStyle(secondaryEl).color) === normalizeRgb('rgb(167, 178, 197)'), `Abyss ${palette} standard secondary matches #a7b2c5`);
    assert(normalizeRgb(getComputedStyle(tertiaryEl).color) === normalizeRgb('rgb(127, 141, 165)'), `Abyss ${palette} standard tertiary matches #7f8da5`);
    const abyssButtonFgStandard = getComputedStyle(buttonFgEl).color;
    const abyssBrandPrimaryStandard = getComputedStyle(brandPrimaryEl).color;

    c.set('textContrast', 'enhanced');
    assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(242, 245, 252)'), `Abyss ${palette} enhanced primary matches #f2f5fc`);
    assert(normalizeRgb(getComputedStyle(secondaryEl).color) === normalizeRgb('rgb(192, 202, 218)'), `Abyss ${palette} enhanced secondary matches #c0cada`);
    assert(normalizeRgb(getComputedStyle(tertiaryEl).color) === normalizeRgb('rgb(163, 175, 194)'), `Abyss ${palette} enhanced tertiary matches #a3afc2`);
    assert(getComputedStyle(buttonFgEl).color === abyssButtonFgStandard, `Abyss ${palette} button foreground unaffected by enhanced contrast`);
    assert(getComputedStyle(brandPrimaryEl).color === abyssBrandPrimaryStandard, `Abyss ${palette} brand accent color unaffected by enhanced contrast`);

    c.set('textContrast', 'standard');
    assert(normalizeRgb(getComputedStyle(primaryEl).color) === normalizeRgb('rgb(231, 236, 245)'), `Abyss ${palette} standard restores cleanly without lingering styles`);
  }

  // 6. Real Computed CSS Styles (Chat Backdrop Tinting, Corner Radius, and Container Protection)
  const chatFixture = document.createElement('div');
  chatFixture.id = 'qa-chat-fixture';
  chatFixture.innerHTML = `
    <div class="BynINW_frame">
      <div class="BynINW_sidebarCol" style="background: transparent;">Sidebar</div>
      <div class="BynINW_centerCol" style="border-top-left-radius: 16px;">
        <div class="wm-chat-column-inner">Chat Message Column</div>
      </div>
      <div class="Dc7zOa_composerSeat">
        <div class="RlGAzG_card">Input Card</div>
      </div>
    </div>
  `;
  rootContainer.appendChild(chatFixture);

  const centerColEl = chatFixture.querySelector('.BynINW_centerCol');
  const frameEl = chatFixture.querySelector('.BynINW_frame');
  const cardEl = chatFixture.querySelector('.RlGAzG_card');

  // Activate real background markers
  c.set('palette', 'ocean');
  c.set('canvas', 'clear');
  c.set('background', 'image');
  document.body.dataset.wmBackdrop = 'image';

  // Chat Backdrop = 0
  c.set('chatBackdrop', 0);
  assert(!document.body.dataset.wmOpaqueChat && !document.body.dataset.wmChatTint, 'chatBackdrop 0 sets no chat dataset attributes');
  assert(getComputedStyle(centerColEl).borderTopLeftRadius === '16px', 'chatBackdrop 0 preserves 16px corner radius');

  // Chat Backdrop = 50 (intermediate tint)
  c.set('chatBackdrop', 50);
  assert(document.body.dataset.wmChatTint === 'true' && !document.body.dataset.wmOpaqueChat, 'chatBackdrop 50 sets wmChatTint only');
  assert(getComputedStyle(centerColEl).backgroundColor.includes('8, 11, 20') && (getComputedStyle(centerColEl).backgroundColor.includes('0.5') || getComputedStyle(centerColEl).backgroundColor.includes('50%')), 'chatBackdrop 50 tints centerCol with 0.5 alpha');
  assert(getComputedStyle(centerColEl).borderTopLeftRadius === '16px', 'chatBackdrop 50 preserves 16px rounded corner');
  assert(getComputedStyle(frameEl).backgroundColor === 'rgba(0, 0, 0, 0)', 'frame background remains transparent during chat tinting');
  assert(getComputedStyle(cardEl).backgroundImage.includes('linear-gradient') || getComputedStyle(cardEl).backgroundImage.includes('rgb('), 'composer card retains opaque background');

  // Surface slider independence
  c.set('surface', 40);
  assert(getComputedStyle(centerColEl).backgroundColor.includes('0.5') || getComputedStyle(centerColEl).backgroundColor.includes('50%'), 'surface slider change does not alter chatBackdrop alpha');
  c.set('surface', 82);

  // Chat Backdrop = 100 (solid opaque)
  c.set('chatBackdrop', 100);
  assert(document.body.dataset.wmOpaqueChat === 'true' && !document.body.dataset.wmChatTint, 'chatBackdrop 100 sets wmOpaqueChat only');
  assert(normalizeRgb(getComputedStyle(centerColEl).backgroundColor) === normalizeRgb('rgb(8, 11, 20)'), 'chatBackdrop 100 renders solid base color');
  assert(getComputedStyle(centerColEl).borderTopLeftRadius === '0px', 'chatBackdrop 100 flattens top-left corner (0px)');

  // Inactive background removes tint
  delete document.body.dataset.wmBackdrop;
  c.set('background', 'none');
  assert(getComputedStyle(centerColEl).borderTopLeftRadius === '16px', 'inactive background restores default corner radius');
  assert(c.read().chatBackdrop === 100, 'chatBackdrop value 100 retained when background is inactive');

  // Cleanup test DOM
  rootContainer.removeChild(colorFixture);
  rootContainer.removeChild(chatFixture);

  // 7. Disposal boundary clears readability projections
  c.set('textContrast', 'enhanced');
  c.set('chatBackdrop', 80);
  fixture.dispose();
  assert(!document.body.dataset.wmTextContrast, 'dispose clears wmTextContrast dataset');
  assert(!document.body.dataset.wmChatTint && !document.body.dataset.wmOpaqueChat, 'dispose clears chat dataset attributes');
  assert(!document.body.style.getPropertyValue('--wm-chat-alpha'), 'dispose clears --wm-chat-alpha CSS variable');

  // --- Theme Accent Color P1 verification ---
  // 1. Storage migration, normalization & controller validation
  fixture.dispose();
  // Case A: Missing accent fields in stored appearance defaults to accentMode: "theme", accentColor: "#8c72f2"
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ theme: 'abyss', palette: 'ocean' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().accentMode === 'theme', 'missing accentMode defaults to theme');
  assert(c.read().accentColor === '#8c72f2', 'missing accentColor defaults to #8c72f2');
  assert(localStorage.getItem('dsh-whale-mist.appearance.v1') === JSON.stringify({ theme: 'abyss', palette: 'ocean' }), 'cold boot does not rewrite storage when missing accent fields');

  // Case B: Unknown accentMode falls back to theme
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ accentMode: 'unsupported_mode', accentColor: '#123456' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().accentMode === 'theme', 'unknown accentMode falls back to theme');
  assert(c.read().accentColor === '#123456', 'valid accentColor preserved when accentMode falls back');

  // Case C: Case normalization on accentColor (#FF00AA -> #ff00aa)
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ accentMode: 'custom', accentColor: '#FF00AA' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().accentColor === '#ff00aa', 'accentColor normalized to lowercase');
  assert(c.read().accentMode === 'custom', 'valid custom accentColor keeps custom mode');

  // Case D: Invalid hex colors in storage fall back to default candidate #8c72f2
  for (const badHex of ['#abc', 'red', 'rgb(0,0,0)', '#12345678', '#12345 ', ' #123456', '']) {
    fixture.dispose();
    localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ accentMode: 'theme', accentColor: badHex }));
    fixture.boot(); c = fixture.controller;
    assert(c.read().accentColor === '#8c72f2', `invalid hex "${badHex}" falls back to default candidate #8c72f2`);
  }

  // Case E: Corrupt custom mode without valid hex falls back to theme mode
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ accentMode: 'custom', accentColor: 'invalid_color' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().accentMode === 'theme', 'custom mode with invalid color falls back to theme mode');
  assert(c.read().accentColor === '#8c72f2', 'custom mode with invalid color resets candidate to #8c72f2');

  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', JSON.stringify({ accentMode: 'custom' }));
  fixture.boot(); c = fixture.controller;
  assert(c.read().accentMode === 'theme', 'custom mode with missing color falls back to theme mode');

  // Case F: Controller validation & candidate preservation
  const preBad = c.read();
  assert(c.set('accentMode', 'invalid').accentMode === 'theme', 'controller rejects invalid accentMode enum');
  assert(c.set('accentColor', '#12345').accentColor === preBad.accentColor, 'controller rejects 5-digit hex');
  assert(c.set('accentColor', 'blue').accentColor === preBad.accentColor, 'controller rejects named color');
  assert(c.set('accentColor', '#00112233').accentColor === preBad.accentColor, 'controller rejects 8-digit hex');

  // Setting valid color in theme mode updates candidate without switching mode
  assert(c.set('accentColor', '#AABBCC').accentColor === '#aabbcc', 'controller normalizes uppercase hex to lowercase');
  assert(c.read().accentMode === 'theme', 'setting accentColor does not implicitly switch accentMode to custom');

  // Switching to custom mode uses the preserved candidate
  assert(c.set('accentMode', 'custom').accentMode === 'custom', 'controller switches to custom mode');
  assert(c.read().accentColor === '#aabbcc', 'custom mode uses preserved candidate color');

  // Switching back to theme preserves the candidate color
  assert(c.set('accentMode', 'theme').accentMode === 'theme', 'controller switches back to theme mode');
  assert(c.read().accentColor === '#aabbcc', 'switching back to theme preserves candidate color');
  assert(c.set('accentMode', 'custom').accentMode === 'custom', 'switching to custom restores candidate');

  // Reset restores accentMode: theme and accentColor: #8c72f2
  assert(c.reset().accentMode === 'theme', 'controller reset restores accentMode to theme');
  assert(c.read().accentColor === '#8c72f2', 'controller reset restores accentColor to #8c72f2');

  // Presets isolation: saving, applying, and removing wallpaper presets never touch accent settings
  c.set('accentMode', 'custom');
  c.set('accentColor', '#112233');
  c.set('brightness', 95);
  c.presets.save('lucy');
  c.set('brightness', 70);
  c.presets.apply('lucy');
  assert(c.read().accentMode === 'custom' && c.read().accentColor === '#112233', 'preset apply does not overwrite accentMode or accentColor');
  c.presets.remove('lucy');
  assert(c.read().accentMode === 'custom' && c.read().accentColor === '#112233', 'preset remove does not touch accentMode or accentColor');
  c.set('accentMode', 'theme');

  // 2. Color derivation & contrast thresholds (Independent verification)
  const hex2rgb = (h) => {
    const num = parseInt(h.slice(1), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };
  const s2lin = (val255) => {
    const v = val255 / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const testLum = (rgb) => 0.2126 * s2lin(rgb[0]) + 0.7152 * s2lin(rgb[1]) + 0.0722 * s2lin(rgb[2]);
  const testCR = (rgb1, rgb2) => {
    const l1 = testLum(rgb1), l2 = testLum(rgb2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const testDeriveCases = [
    { name: 'Pure Black', hex: '#000000', expFg: '#ffffff', expHover: '#1f1f1f' },
    { name: 'Pure White', hex: '#ffffff', expFg: '#000000', expHover: '#e0e0e0' },
    { name: 'Mid Gray', hex: '#808080', expFg: '#000000', expHover: '#8f8f8f' },
    { name: 'Default Purple', hex: '#8c72f2', expFg: '#000000', expHover: '#7b64d5' },
    { name: 'Primary Red', hex: '#ff0000', expFg: '#000000', expHover: '#ff1f1f' },
    { name: 'Primary Green', hex: '#00ff00', expFg: '#000000', expHover: '#00e000' },
    { name: 'Primary Blue', hex: '#0000ff', expFg: '#ffffff', expHover: '#1f1fff' }
  ];

  for (const tc of testDeriveCases) {
    const rawRgb = hex2rgb(tc.hex);
    const derived = whaleModule.deriveAccentValues(tc.hex, 'mist', 'ocean');
    assert(derived.btnFg === tc.expFg, `${tc.name} button foreground matches independent expected ${tc.expFg}`);
    assert(derived.btnHover === tc.expHover, `${tc.name} button hover matches independent expected ${tc.expHover}`);
    const fgRgb = hex2rgb(derived.btnFg);
    const hoverRgb = hex2rgb(derived.btnHover);
    assert(testCR(rawRgb, fgRgb) >= 4.5, `${tc.name} normal fill against button foreground achieves >= 4.5 contrast (got ${testCR(rawRgb, fgRgb).toFixed(2)})`);
    assert(testCR(hoverRgb, fgRgb) >= 4.5, `${tc.name} hover fill against button foreground achieves >= 4.5 contrast (got ${testCR(hoverRgb, fgRgb).toFixed(2)})`);
  }

  // Ink verification on Mist and Abyss reference surfaces
  const mistInkPurple = whaleModule.deriveInkColor(hex2rgb('#8c72f2'), 'mist', 'ocean');
  assert(mistInkPurple === '#6955b5', 'Mist ink for #8c72f2 matches independent expected #6955b5');
  const abyssInkPurple = whaleModule.deriveInkColor(hex2rgb('#8c72f2'), 'abyss', 'ocean');
  assert(abyssInkPurple === '#947cf3', 'Abyss Ocean ink for #8c72f2 matches independent expected #947cf3');
  const mistInkBlack = whaleModule.deriveInkColor(hex2rgb('#000000'), 'mist', 'ocean');
  assert(mistInkBlack === '#000000', 'Mist ink for #000000 preserves black');
  const abyssInkWhite = whaleModule.deriveInkColor(hex2rgb('#ffffff'), 'abyss', 'ocean');
  assert(abyssInkWhite === '#ffffff', 'Abyss ink for #ffffff preserves white');

  // 3. Real Computed CSS Styles (Accent Color across Mist and 4 Abyss Palettes)
  const accentFixture = document.createElement('div');
  accentFixture.id = 'qa-accent-fixture';
  accentFixture.innerHTML = `
    <style>#qa-accent-fixture, #qa-accent-fixture * { transition: none !important; }</style>
    <button id="qa-accent-btn" class="test-btn-primary" style="background-color: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground);">Action</button>
    <a id="qa-accent-link" class="test-link" href="#" style="color: var(--dsw-alias-link);">Documentation Link</a>
    <span id="qa-accent-brand" style="color: var(--dsw-alias-brand-primary);">Brand</span>
    <span id="qa-accent-brand-new" style="color: var(--dsw-alias-brand-primary-new-colorprimary-new-color);">Brand New</span>
    <span id="qa-accent-citation" style="color: var(--dsw-alias-markdown-citation);">Citation</span>
    <span id="qa-accent-biz-primary" style="color: var(--dsw-alias-state-business-primary);">Business Primary</span>
    <span id="qa-accent-biz-tertiary" style="background: var(--dsw-alias-state-business-tertiary);">Business Tertiary</span>
    <button id="qa-accent-info" style="background: var(--dsw-alias-button-info-fill);">Info Fill</button>
    <button id="qa-accent-ghost" style="background: var(--dsw-alias-button-ghost-active-fill);">Ghost Active</button>
    <div id="qa-accent-interactive" style="background: var(--dsw-alias-interactive-bg-primary);">Interactive Primary</div>
    <div id="qa-accent-sidebar-active" style="background: var(--dsw-specific-sidebar-nav-item-active); color: var(--dsw-specific-sidebar-nav-item-active-accent);">Sidebar Item</div>
    <button id="qa-accent-focus" class="test-focus-target">Focus Target</button>
    <div class="wm-session-status wm-session-status-running">
      <span id="qa-accent-status-mark" class="wm-status-mark">Mark</span>
    </div>
    <div class="wm-session-status wm-session-status-waiting">
      <span id="qa-accent-waiting-mark" class="wm-status-mark">Waiting</span>
    </div>
    <div class="wm-session-status wm-session-status-complete">
      <span id="qa-accent-complete-mark" class="wm-status-mark">Complete</span>
    </div>
  `;
  rootContainer.appendChild(accentFixture);

  const realSelectedBtn = document.createElement('button');
  realSelectedBtn.id = 'qa-real-settings-selected';
  realSelectedBtn.textContent = 'Custom';
  accentFixture.appendChild(realSelectedBtn);

  const realUnselectedBtn = document.createElement('button');
  realUnselectedBtn.id = 'qa-real-settings-unselected';
  realUnselectedBtn.textContent = 'Theme';
  accentFixture.appendChild(realUnselectedBtn);

  const accentBtnEl = document.getElementById('qa-accent-btn');
  const accentLinkEl = document.getElementById('qa-accent-link');
  const accentBrandEl = document.getElementById('qa-accent-brand');
  const accentBrandNewEl = document.getElementById('qa-accent-brand-new');
  const accentCitationEl = document.getElementById('qa-accent-citation');
  const accentBizPrimaryEl = document.getElementById('qa-accent-biz-primary');
  const accentBizTertiaryEl = document.getElementById('qa-accent-biz-tertiary');
  const accentInfoEl = document.getElementById('qa-accent-info');
  const accentGhostEl = document.getElementById('qa-accent-ghost');
  const accentInteractiveEl = document.getElementById('qa-accent-interactive');
  const accentSidebarEl = document.getElementById('qa-accent-sidebar-active');
  const accentFocusEl = document.getElementById('qa-accent-focus');
  const accentStatusMarkEl = document.getElementById('qa-accent-status-mark');
  const accentWaitingMarkEl = document.getElementById('qa-accent-waiting-mark');
  const accentCompleteMarkEl = document.getElementById('qa-accent-complete-mark');

  // 3a. Theme mode baseline verification (Mist and Abyss ocean)
  c.set('theme', 'mist');
  c.set('accentMode', 'theme');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).backgroundColor) === normalizeRgb('rgb(20, 104, 168)'), 'Mist theme mode button fill matches #1468a8');
  assert(normalizeRgb(getComputedStyle(accentBrandEl).color) === normalizeRgb('rgb(20, 104, 168)'), 'Mist theme mode brand matches #1468a8');
  accentFocusEl.focus({ focusVisible: true });
  assert(getComputedStyle(accentFocusEl).outlineColor.includes('20, 104, 168'), 'Mist theme mode focus outline is blue');

  c.set('theme', 'abyss');
  c.set('palette', 'ocean');
  c.set('accentMode', 'theme');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).backgroundColor) === normalizeRgb('rgb(125, 99, 222)'), 'Abyss ocean theme mode button fill matches #7d63de');
  assert(normalizeRgb(getComputedStyle(accentBrandEl).color) === normalizeRgb('rgb(140, 114, 242)'), 'Abyss ocean theme mode brand matches #8c72f2');
  accentFocusEl.focus({ focusVisible: true });
  assert(getComputedStyle(accentFocusEl).outlineColor.includes('140, 114, 242'), 'Abyss ocean theme mode focus outline is purple');

  // 3b. Custom mode verification with #8c72f2 in Mist
  c.set('theme', 'mist');
  c.set('accentMode', 'custom');
  c.set('accentColor', '#8c72f2');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).backgroundColor) === normalizeRgb('rgb(140, 114, 242)'), 'Mist custom mode button fill uses raw color #8c72f2');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).color) === normalizeRgb('rgb(0, 0, 0)'), 'Mist custom mode button text uses derived foreground #000000');
  assert(normalizeRgb(getComputedStyle(accentLinkEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode link uses derived ink #6955b5');
  assert(normalizeRgb(getComputedStyle(accentBrandEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode brand uses derived ink #6955b5');
  assert(normalizeRgb(getComputedStyle(accentBrandNewEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode brand-new uses derived ink #6955b5');
  assert(normalizeRgb(getComputedStyle(accentCitationEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode citation uses derived ink #6955b5');
  assert(normalizeRgb(getComputedStyle(accentBizPrimaryEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode business primary uses derived ink #6955b5');
  assert(getComputedStyle(accentBizTertiaryEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentBizTertiaryEl).backgroundColor.includes('0.2'), 'Mist custom mode business tertiary has 0.20 raw alpha');
  assert(getComputedStyle(accentInfoEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentInfoEl).backgroundColor.includes('0.18'), 'Mist custom mode info fill has 0.18 raw alpha');
  assert(getComputedStyle(accentGhostEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentGhostEl).backgroundColor.includes('0.2'), 'Mist custom mode ghost active has 0.20 raw alpha');
  assert(getComputedStyle(accentInteractiveEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentInteractiveEl).backgroundColor.includes('0.16'), 'Mist custom mode interactive bg primary has 0.16 raw alpha');
  assert(getComputedStyle(accentSidebarEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentSidebarEl).backgroundColor.includes('0.16'), 'Mist custom mode sidebar nav active has 0.16 raw alpha');
  assert(normalizeRgb(getComputedStyle(accentSidebarEl).color) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode sidebar nav active accent uses ink');
  accentFocusEl.focus({ focusVisible: true });
  assert(normalizeRgb(getComputedStyle(accentFocusEl).outlineColor) === normalizeRgb('rgb(105, 85, 181)'), 'Mist custom mode focus ring uses ink outline');
  assert(normalizeRgb(getComputedStyle(accentStatusMarkEl).backgroundColor) === normalizeRgb('rgb(140, 114, 242)'), 'Mist custom status mark uses raw color');
  assert(normalizeRgb(getComputedStyle(accentStatusMarkEl).color) === normalizeRgb('rgb(0, 0, 0)'), 'Mist custom status mark uses button foreground');

  // Semantic state immunity in custom mode
  assert(normalizeRgb(getComputedStyle(accentWaitingMarkEl).backgroundColor) === normalizeRgb('rgb(169, 106, 34)'), 'Mist waiting status mark retains warning color in custom mode');
  assert(normalizeRgb(getComputedStyle(accentCompleteMarkEl).backgroundColor) === normalizeRgb('rgb(43, 129, 100)'), 'Mist complete status mark retains success color in custom mode');

  // 3c. Custom mode verification with #8c72f2 across 4 Abyss Palettes
  c.set('theme', 'abyss');
  for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
    c.set('palette', palette);
    assert(normalizeRgb(getComputedStyle(accentBtnEl).backgroundColor) === normalizeRgb('rgb(140, 114, 242)'), `Abyss ${palette} custom mode button fill preserves raw #8c72f2`);
    assert(normalizeRgb(getComputedStyle(accentBtnEl).color) === normalizeRgb('rgb(0, 0, 0)'), `Abyss ${palette} custom mode button text uses derived foreground #000000`);
    const expInkHex = whaleModule.deriveInkColor(hex2rgb('#8c72f2'), 'abyss', palette);
    const expInkRgb = hex2rgb(expInkHex);
    assert(normalizeRgb(getComputedStyle(accentLinkEl).color) === normalizeRgb(`rgb(${expInkRgb.join(' ')})`), `Abyss ${palette} custom mode link uses derived ink ${expInkHex}`);
    assert(normalizeRgb(getComputedStyle(accentBrandEl).color) === normalizeRgb(`rgb(${expInkRgb.join(' ')})`), `Abyss ${palette} custom mode brand uses derived ink ${expInkHex}`);
    accentFocusEl.focus({ focusVisible: true });
    assert(normalizeRgb(getComputedStyle(accentFocusEl).outlineColor) === normalizeRgb(`rgb(${expInkRgb.join(' ')})`), `Abyss ${palette} custom mode focus ring uses ink outline`);
    assert(normalizeRgb(getComputedStyle(accentStatusMarkEl).backgroundColor) === normalizeRgb('rgb(140, 114, 242)'), `Abyss ${palette} custom status mark uses raw color`);
    assert(normalizeRgb(getComputedStyle(accentStatusMarkEl).color) === normalizeRgb('rgb(0, 0, 0)'), `Abyss ${palette} custom status mark uses button foreground`);
  }

  // 3d. Settings page selected option styling in Custom Mode (A1 verification)
  const ctrlSelNode = fixture.controls().find(n => n.props?.['data-wm-setting'] === 'accentMode' && n.props?.['data-wm-value'] === 'custom');
  const ctrlUnselNode = fixture.controls().find(n => n.props?.['data-wm-setting'] === 'accentMode' && n.props?.['data-wm-value'] === 'theme');
  assert(ctrlSelNode && ctrlSelNode.props.className.includes('is-selected'), 'settings component emits is-selected for active custom option');
  assert(ctrlUnselNode && !ctrlUnselNode.props.className.includes('is-selected'), 'settings component emits non-selected for inactive theme option');
  realSelectedBtn.className = ctrlSelNode.props.className;
  realSelectedBtn.setAttribute('aria-pressed', String(ctrlSelNode.props['aria-pressed']));
  realUnselectedBtn.className = ctrlUnselNode.props.className;
  realUnselectedBtn.setAttribute('aria-pressed', String(ctrlUnselNode.props['aria-pressed']));

  const layer2Surfaces = {
    mist: [230, 242, 251],
    ocean: [23, 34, 54],
    graphite: [31, 31, 36],
    violet: [35, 25, 50],
    jade: [20, 39, 33]
  };

  const parseRgbList = (str) => (str.match(/[\d.]+/g) || []).map(Number);
  const calcComposite = (bgRgba, surfaceRgb) => {
    const alpha = bgRgba[3] ?? 1;
    return bgRgba.slice(0, 3).map((v, i) => v * alpha + surfaceRgb[i] * (1 - alpha));
  };

  const greenExpInks = {
    mist: 'rgb(0, 118, 0)',
    ocean: 'rgb(0, 255, 0)',
    graphite: 'rgb(0, 255, 0)',
    violet: 'rgb(0, 255, 0)',
    jade: 'rgb(0, 255, 0)'
  };

  // Mist with Red and Green - distinct raw alpha fills, layout stability, focus outline
  c.set('theme', 'mist');
  c.set('accentMode', 'custom');
  c.set('accentColor', '#ff0000');
  const mistRedOptBg = getComputedStyle(realSelectedBtn).backgroundColor;
  const mistRedOptColor = getComputedStyle(realSelectedBtn).color;
  assert(normalizeRgb(mistRedOptBg).includes('255 0 0') && normalizeRgb(mistRedOptBg).includes('0.2'), 'Mist custom mode selected option has red 0.20 raw alpha fill');
  assert(normalizeRgb(mistRedOptColor) === normalizeRgb('rgb(21, 48, 71)'), 'Mist custom mode selected option text uses standard primary label rgb(21, 48, 71)');
  assert(getComputedStyle(realSelectedBtn).borderWidth === '0px', 'selected option maintains 0px border (no layout jump)');
  assert(getComputedStyle(realSelectedBtn).padding === '4px 10px', 'selected option maintains 4px 10px padding');

  c.set('accentColor', '#00ff00');
  const mistGreenOptBg = getComputedStyle(realSelectedBtn).backgroundColor;
  const mistGreenOptColor = getComputedStyle(realSelectedBtn).color;
  assert(normalizeRgb(mistGreenOptBg).includes('0 255 0') && normalizeRgb(mistGreenOptBg).includes('0.2'), 'Mist custom mode selected option has green 0.20 raw alpha fill');
  assert(normalizeRgb(mistGreenOptColor) === normalizeRgb('rgb(21, 48, 71)'), 'Mist green custom mode selected option text uses standard primary label rgb(21, 48, 71)');
  assert(mistRedOptBg !== mistGreenOptBg, 'Red and green settings selected option fills are distinct and adapt to accentColor');

  // Unselected option remains transparent
  assert(normalizeRgb(getComputedStyle(realUnselectedBtn).backgroundColor) === normalizeRgb('rgba(0, 0, 0, 0)'), 'unselected option retains transparent background');

  // Focus state on selected option uses derived ink
  realSelectedBtn.focus({ focusVisible: true });
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).outlineColor) === normalizeRgb(greenExpInks.mist), 'focused selected option outline matches green ink');

  // Abyss across 4 palettes: check red/green alpha fills and focus outline
  c.set('theme', 'abyss');
  for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
    c.set('palette', palette);
    c.set('accentColor', '#ff0000');
    assert(normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('255 0 0') && normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0.2'), `Abyss ${palette} custom mode selected option has red 0.20 alpha fill`);
    assert(normalizeRgb(getComputedStyle(realSelectedBtn).color) === normalizeRgb('rgb(231, 236, 245)'), `Abyss ${palette} custom mode selected option text matches standard primary label rgb(231, 236, 245)`);

    c.set('accentColor', '#00ff00');
    assert(normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0 255 0') && normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0.2'), `Abyss ${palette} custom mode selected option has green 0.20 alpha fill`);
    assert(normalizeRgb(getComputedStyle(realSelectedBtn).color) === normalizeRgb('rgb(231, 236, 245)'), `Abyss ${palette} custom mode selected option text matches standard primary label rgb(231, 236, 245)`);
    realSelectedBtn.focus({ focusVisible: true });
    assert(normalizeRgb(getComputedStyle(realSelectedBtn).outlineColor) === normalizeRgb(greenExpInks[palette]), `Abyss ${palette} focused selected option outline matches green ink`);
  }

  // A2: Formal verification across 5 themes x 7 representative colors against composite background
  const themePairs = [
    ['mist', 'ocean'],
    ['abyss', 'ocean'],
    ['abyss', 'graphite'],
    ['abyss', 'violet'],
    ['abyss', 'jade']
  ];
  const representativeColors = ['#000000', '#ffffff', '#808080', '#8c72f2', '#ff0000', '#00ff00', '#0000ff'];

  for (const [theme, palette] of themePairs) {
    c.set('theme', theme);
    if (theme === 'abyss') c.set('palette', palette);
    const expPrimary = theme === 'mist' ? 'rgb(21, 48, 71)' : 'rgb(231, 236, 245)';
    const surface = layer2Surfaces[theme === 'mist' ? 'mist' : palette];

    for (const colorHex of representativeColors) {
      c.set('accentColor', colorHex);
      const computedColor = getComputedStyle(realSelectedBtn).color;
      const computedBg = getComputedStyle(realSelectedBtn).backgroundColor;
      assert(normalizeRgb(computedColor) === normalizeRgb(expPrimary), `${theme} ${palette} ${colorHex} selected option text uses standard primary`);
      const fg = parseRgbList(computedColor).slice(0, 3);
      const bg = parseRgbList(computedBg);
      const comp = calcComposite(bg, surface);
      const cr = testCR(fg, comp);
      assert(cr >= 4.5, `${theme} ${palette} ${colorHex} selected option text against composite background achieves >= 4.5 contrast (got ${cr.toFixed(2)})`);
    }
  }

  // Deep sidebar in Graphite for selected option
  c.set('theme', 'abyss');
  c.set('palette', 'graphite');
  c.set('sidebar', 'deep');
  c.set('accentColor', '#ff0000');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('255 0 0') && normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0.2'), 'Abyss graphite deep sidebar selected option overrides palette specificity');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).color) === normalizeRgb('rgb(231, 236, 245)'), 'Abyss graphite deep sidebar selected option text uses standard primary');
  const graphiteDeepFg = parseRgbList(getComputedStyle(realSelectedBtn).color).slice(0, 3);
  const graphiteDeepBg = parseRgbList(getComputedStyle(realSelectedBtn).backgroundColor);
  const graphiteDeepComp = calcComposite(graphiteDeepBg, layer2Surfaces.graphite);
  assert(testCR(graphiteDeepFg, graphiteDeepComp) >= 4.5, 'Abyss graphite deep sidebar selected option achieves >= 4.5 contrast');
  c.set('sidebar', 'balanced');

  // textContrast enhanced verification for selected option (Mist & Abyss)
  c.set('theme', 'mist');
  c.set('accentColor', '#ff0000');
  c.set('textContrast', 'enhanced');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('255 0 0') && normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0.2'), 'Mist selected option background unaffected by textContrast enhanced');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).color) === normalizeRgb('rgb(12, 38, 59)'), 'Mist selected option text uses enhanced primary label rgb(12, 38, 59)');
  const mistEnhFg = parseRgbList(getComputedStyle(realSelectedBtn).color).slice(0, 3);
  const mistEnhBg = parseRgbList(getComputedStyle(realSelectedBtn).backgroundColor);
  const mistEnhComp = calcComposite(mistEnhBg, layer2Surfaces.mist);
  assert(testCR(mistEnhFg, mistEnhComp) >= 4.5, 'Mist enhanced selected option achieves >= 4.5 contrast');

  c.set('theme', 'abyss');
  c.set('palette', 'graphite');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('255 0 0') && normalizeRgb(getComputedStyle(realSelectedBtn).backgroundColor).includes('0.2'), 'Abyss selected option background unaffected by textContrast enhanced');
  assert(normalizeRgb(getComputedStyle(realSelectedBtn).color) === normalizeRgb('rgb(242, 245, 252)'), 'Abyss selected option text uses enhanced primary label rgb(242, 245, 252)');
  const abyssEnhFg = parseRgbList(getComputedStyle(realSelectedBtn).color).slice(0, 3);
  const abyssEnhBg = parseRgbList(getComputedStyle(realSelectedBtn).backgroundColor);
  const abyssEnhComp = calcComposite(abyssEnhBg, layer2Surfaces.graphite);
  assert(testCR(abyssEnhFg, abyssEnhComp) >= 4.5, 'Abyss enhanced selected option achieves >= 4.5 contrast');
  c.set('textContrast', 'standard');

  // Theme mode restoration
  c.set('accentMode', 'theme');
  const themeOptBg = getComputedStyle(realSelectedBtn).backgroundColor;
  const themeOptColor = getComputedStyle(realSelectedBtn).color;
  assert(!themeOptBg.includes('255, 0, 0'), 'theme mode restores neutral background on selected option');
  assert(normalizeRgb(themeOptColor) === normalizeRgb('rgb(231, 236, 245)'), 'theme mode restores neutral label color on selected option');

  // Restore to custom #8c72f2 for remaining tests
  c.set('accentMode', 'custom');
  c.set('accentColor', '#8c72f2');

  // Deep sidebar specificity check in Graphite
  c.set('palette', 'graphite');
  c.set('sidebar', 'deep');
  assert(getComputedStyle(accentSidebarEl).backgroundColor.includes('140, 114, 242') && getComputedStyle(accentSidebarEl).backgroundColor.includes('0.16'), 'Abyss graphite deep sidebar nav item active overrides palette deep specificity');
  c.set('sidebar', 'balanced');

  // 4. Immunity with Text Contrast Enhanced
  c.set('textContrast', 'enhanced');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).color) === normalizeRgb('rgb(0, 0, 0)'), 'button foreground remains #000000 and is not overwritten by textContrast enhanced');
  assert(normalizeRgb(getComputedStyle(accentBtnEl).backgroundColor) === normalizeRgb('rgb(140, 114, 242)'), 'button background remains #8c72f2 during textContrast enhanced');
  c.set('textContrast', 'standard');

  // Cleanup test fixture DOM
  rootContainer.removeChild(accentFixture);

  // 5. Disposal and theme toggle cleanup
  fixture.dispose();
  assert(!document.body.dataset.wmAccentMode, 'dispose clears wmAccentMode dataset attribute');
  for (const vName of ['--wm-custom-raw', '--wm-custom-btn-hover', '--wm-custom-btn-fg', '--wm-custom-ink']) {
    assert(!document.body.style.getPropertyValue(vName), `dispose clears ${vName} property`);
  }

  // 6. UI & Dual-language inspection
  fixture.boot(); c = fixture.controller;
  const originalLang = navigator.language;
  try {
    const langItems = [
      {
        lang: 'zh-CN',
        modeLabel: '强调色',
        themeOpt: '跟随主题',
        customOpt: '自定义',
        hint: '按钮使用所选颜色；链接、高亮和焦点会随主题调整深浅以便识别。跟随主题恢复原配色',
        customLabel: '自定义颜色',
        customHint: '仅使用 6 位十六进制色值；自动调整文字与焦点对比度',
        btnText: '主按钮',
        linkText: '链接',
        paletteHint: '鲸渊的主题底色；跟随主题时同时决定强调色'
      },
      {
        lang: 'en-US',
        modeLabel: 'Accent color',
        themeOpt: 'Follow theme',
        customOpt: 'Custom',
        hint: 'Buttons use the selected color; links, highlights, and focus rings adapt to maintain readability across themes. Follow theme restores default colors.',
        customLabel: 'Custom color',
        customHint: '6-digit hex color only; text and focus contrast adjust automatically',
        btnText: 'Primary button',
        linkText: 'Link',
        paletteHint: 'Base color for Whale Abyss; also decides accent color when following theme'
      }
    ];

    for (const item of langItems) {
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => item.lang });
      c.set('accentMode', 'theme');
      let controls = fixture.controls();
      const accentRowNode = controls.find(n => (n.props && n.props.key === 'accentMode') || n.key === 'accentMode');
      assert(accentRowNode, `[${item.lang}] accentMode row rendered`);
      const copyNode = accentRowNode?.children?.find(ch => ch?.props?.className === 'wm-settings-copy');
      const labelText = copyNode?.children?.find(ch => ch?.props?.className === 'wm-settings-label')?.children?.[0];
      assert(labelText === item.modeLabel, `[${item.lang}] accent label matches expected: ${item.modeLabel}`);
      const hintText = copyNode?.children?.find(ch => ch?.props?.className === 'wm-settings-hint')?.children?.[0];
      assert(hintText === item.hint, `[${item.lang}] accent hint matches expected: ${item.hint}`);

      const themeBtn = controls.find(n => n.props && n.props['data-wm-setting'] === 'accentMode' && n.props['data-wm-value'] === 'theme');
      const customBtn = controls.find(n => n.props && n.props['data-wm-setting'] === 'accentMode' && n.props['data-wm-value'] === 'custom');
      assert(themeBtn && customBtn, `[${item.lang}] theme and custom accent buttons present`);
      assert(themeBtn.children[0] === item.themeOpt, `[${item.lang}] theme option text matches: ${item.themeOpt}`);
      assert(customBtn.children[0] === item.customOpt, `[${item.lang}] custom option text matches: ${item.customOpt}`);
      assert(themeBtn.props.className.includes('is-selected') && themeBtn.props['aria-pressed'] === true, `[${item.lang}] theme button marked is-selected and aria-pressed`);

      // Palette hint check
      const paletteRowNode = controls.find(n => (n.props && n.props.key === 'palette') || n.key === 'palette');
      const paletteCopyNode = paletteRowNode?.children?.find(ch => ch?.props?.className === 'wm-settings-copy');
      const paletteHintText = paletteCopyNode?.children?.find(ch => ch?.props?.className === 'wm-settings-hint')?.children?.[0];
      assert(paletteHintText === item.paletteHint, `[${item.lang}] palette hint text matches: ${item.paletteHint}`);

      // In theme mode, custom controls are not rendered
      assert(!controls.some(n => n.props && n.props['data-wm-setting'] === 'accentColor'), `[${item.lang}] color picker not rendered in theme mode`);

      // Switch to custom mode
      customBtn.props.onClick();
      assert(c.read().accentMode === 'custom', `[${item.lang}] clicking custom sets accentMode custom`);
      controls = fixture.controls();
      const activeCustomBtn = controls.find(n => n.props && n.props['data-wm-setting'] === 'accentMode' && n.props['data-wm-value'] === 'custom');
      assert(activeCustomBtn.props.className.includes('is-selected') && activeCustomBtn.props['aria-pressed'] === true, `[${item.lang}] custom button marked is-selected and aria-pressed`);

      // Custom controls rendered
      const colorPicker = controls.find(n => n.props && n.props['data-wm-setting'] === 'accentColor');
      assert(colorPicker && colorPicker.props.type === 'color', `[${item.lang}] native color picker rendered in custom mode`);
      assert(colorPicker.props.value === c.read().accentColor, `[${item.lang}] color picker value matches accentColor ${c.read().accentColor}`);

      const hexSpan = controls.find(n => n.props && n.props['data-wm-accent-hex']);
      assert(hexSpan && hexSpan.children[0] === c.read().accentColor, `[${item.lang}] hex readout displays ${c.read().accentColor}`);

      const previewBtn = controls.find(n => n.props && n.props['data-wm-preview'] === 'button');
      assert(previewBtn && previewBtn.children[0] === item.btnText, `[${item.lang}] preview button displays ${item.btnText}`);

      const previewLink = controls.find(n => n.props && n.props['data-wm-preview'] === 'link');
      assert(previewLink && previewLink.children[0] === item.linkText, `[${item.lang}] preview link displays ${item.linkText}`);

      // Changing color picker
      colorPicker.props.onChange({ currentTarget: { value: '#3388cc' } });
      assert(c.read().accentColor === '#3388cc', `[${item.lang}] color picker update sets accentColor to #3388cc`);

      // Reset back to theme mode
      themeBtn.props.onClick();
      assert(c.read().accentMode === 'theme', `[${item.lang}] clicking theme restores theme mode`);
    }
  } finally {
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => originalLang });
  }

  // Reboot clean for remaining media tests
  fixture.dispose();
  localStorage.setItem('dsh-whale-mist.appearance.v1', savedAppearanceForHarness);
  fixture.boot(); c = fixture.controller;
  c.set('background', 'none');
  const accents = new Set();
  for (const palette of ['ocean', 'graphite', 'violet', 'jade']) {
    c.set('palette', palette); accents.add(getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim());
  }
  assert(accents.size === 4, 'four palettes produce distinct computed accent colors');
  assert(fixture.controls().filter(node => node.props['data-wm-setting'] === 'palette').length === 4, 'all four palette buttons are connected');
  // Media controls belong to the source that is selected: with no background there is no
  // file input, and choosing Image mounts exactly the image one.
  assert(fixture.controls().filter(node => node.props.type === 'file').length === 0, 'no file input is offered while no background is selected');
  c.set('background', 'image');
  assert(fixture.controls().filter(node => node.props.type === 'file').length === 1, 'the selected source offers its file input');
  c.set('background', 'none');
  assert(c.set('brightness', 999).brightness === 120 && c.set('surface', -3).surface === 40, 'range settings clamp');
  assert(document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'clamped brightness 120 projects 1.2 to CSS');
  assert(c.set('brightness', 10).brightness === 20 && document.body.style.getPropertyValue('--wm-bg-brightness') === '0.2', 'lower clamped brightness 20 projects 0.2 to CSS');
  assert(c.set('brightness', 110).brightness === 110 && document.body.style.getPropertyValue('--wm-bg-brightness') === '1.1', 'controller accepts brightness 110 and projects 1.1');
  assert(c.set('brightness', 120).brightness === 120 && document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'controller accepts brightness 120 and projects 1.2');
  assert(c.set('brightness', NaN).brightness === 120 && c.set('brightness', Infinity).brightness === 120 && c.set('brightness', '110').brightness === 120 && c.set('__proto__', 'x').theme === 'abyss', 'invalid and prototype settings ignored');
  assert(c.set('mask', 0).mask === 0 && document.body.style.getPropertyValue('--wm-bg-mask') === '0' && document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'mask 0 projects 0 without changing brightness');
  assert(c.set('mask', 90).mask === 90 && document.body.style.getPropertyValue('--wm-bg-mask') === '0.9' && document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'mask 90 projects 0.9 without changing brightness');
  await c.importMedia('image', await fixture.makeImage());
  await wait(() => c.media.getSnapshot().status === 'ready');
  assert(document.body.dataset.wmBackdrop === 'image' && document.querySelectorAll('#wm-backdrop').length === 1, 'real PNG decoded and background mounted once');
  assert(getComputedStyle(document.querySelector('#wm-backdrop')).pointerEvents === 'none', 'background cannot intercept clicks');
  assert(getComputedStyle(document.getElementById('fixture-base')).backgroundColor === 'rgba(0, 0, 0, 0)', 'clear canvas stays transparent with background');
  assert(getComputedStyle(document.getElementById('fixture-card')).backgroundColor.includes('0.4'), 'surface slider reaches rendered surface opacity');
  assert(getComputedStyle(document.getElementById('fixture-composer')).backgroundImage.includes('rgb(') && !getComputedStyle(document.getElementById('fixture-composer')).backgroundImage.includes('rgba('), 'composer remains opaque');
  assert(fixture.controls().filter(node => node.props.type === 'range').length === 5, 'five appearance sliders are connected');
  const chatBackdropSlider = fixture.controls().find(node => node.props && node.props['data-wm-setting'] === 'chatBackdrop');
  assert(chatBackdropSlider && chatBackdropSlider.props.min === 0 && chatBackdropSlider.props.max === 100 && chatBackdropSlider.props.step === 1, 'chat backdrop slider has min 0, max 100, step 1');
  const brightnessSlider = fixture.controls().find(node => node.props && node.props['data-wm-setting'] === 'brightness');
  assert(brightnessSlider && brightnessSlider.props.min === 20 && brightnessSlider.props.max === 120 && brightnessSlider.props.step === 1, 'brightness slider has min 20, max 120, step 1');
  brightnessSlider.props.onChange({ currentTarget: { value: 110 } });
  assert(c.read().brightness === 110, 'slider onChange updates brightness to 110');
  assert(document.body.style.getPropertyValue('--wm-bg-brightness') === '1.1', 'slider onChange projects --wm-bg-brightness to 1.1');
  assert(JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')).brightness === 110, 'slider onChange persists brightness 110');
  const output110 = fixture.controls().find(node => node.type === 'output' && node.children && node.children[0] === '110%');
  assert(output110, 'slider output displays 110%');
  brightnessSlider.props.onChange({ currentTarget: { value: 120 } });
  assert(c.read().brightness === 120, 'slider onChange updates brightness to 120');
  assert(document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'slider onChange projects --wm-bg-brightness to 1.2');
  assert(JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')).brightness === 120, 'slider onChange persists brightness 120');
  const output120 = fixture.controls().find(node => node.type === 'output' && node.children && node.children[0] === '120%');
  assert(output120, 'slider output displays 120%');
  const expectedBrightnessHint = (navigator.language || '').toLowerCase().startsWith('zh')
    ? '100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响'
    : '100% preserves original brightness, higher values brighten further; final look is also affected by scrim and surface opacity';
  const expectedMaskHint = (navigator.language || '').toLowerCase().startsWith('zh')
    ? '叠加主题底色；数值越大，主题底色覆盖越强，0%关闭这层遮罩'
    : 'Overlays the theme base colour; higher values cover more, 0% turns this scrim off';
  const brightnessHintNode = fixture.controls().find(node => node.props?.className === 'wm-settings-hint' && typeof node.children?.[0] === 'string' && (node.children[0].includes('原亮度') || node.children[0].includes('original brightness')));
  assert(brightnessHintNode && brightnessHintNode.children[0] === expectedBrightnessHint, 'brightness hint explains 100% baseline and further brightening');
  const maskHintNode = fixture.controls().find(node => node.props?.className === 'wm-settings-hint' && typeof node.children?.[0] === 'string' && (node.children[0].includes('叠加主题底色') || node.children[0].includes('Overlays the theme base colour')));
  assert(maskHintNode && maskHintNode.children[0] === expectedMaskHint, 'mask hint explains theme base overlay');
  await c.importMedia('image', new File(['not an image'], 'broken.png', { type: 'image/png' }));
  assert(c.media.getSnapshot().error === 'image-decode' && c.media.getSnapshot().media.image.name === 'sample.png', 'invalid replacement preserves saved image');
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = () => { throw new DOMException('Fixture quota fault', 'QuotaExceededError'); };
  try { await c.importMedia('image', await fixture.makeImage('quota.png')); }
  finally { IDBObjectStore.prototype.put = originalPut; }
  assert(c.media.getSnapshot().error === 'quota' && c.media.getSnapshot().media.image.name === 'sample.png', 'quota failure preserves prior media and reports an error');
  c.set('background', 'none');
  const originalOpen = indexedDB.open.bind(indexedDB);
  indexedDB.open = () => { throw new DOMException('Fixture storage fault', 'SecurityError'); };
  c.set('background', 'image'); await wait(() => c.media.getSnapshot().error === 'storage');
  assert(!document.getElementById('wm-backdrop'), 'storage read failure restores plain theme');
  indexedDB.open = originalOpen;
  c.set('background', 'none'); c.set('background', 'image'); await wait(() => c.media.getSnapshot().status === 'ready');
  assert(document.body.dataset.wmBackdrop === 'image', 'stored media reloads after storage recovers');
  c.set('theme', 'mist'); await wait(() => c.media.getSnapshot().status !== 'loading');
  assert(document.body.classList.contains('dsh-whale-mist-active') && document.body.dataset.wmBackdrop === 'image', 'background survives switching to Mist');
  fixture.theme.setTheme('dark'); await Promise.resolve();
  assert(fixture.theme.getTheme().active.id === 'whale-mist', 'host theme reset is repaired');
  c.set('theme', 'abyss');
  fixture.dispose(); await Promise.resolve();
  assert(!document.getElementById('wm-backdrop') && liveUrls.size === 0 && !document.body.dataset.wmPalette && !document.body.style.getPropertyValue('--wm-bg-mask'), 'dispose removes media URLs and projections');
  fixture.boot(); c = fixture.controller;
  await wait(() => c.media.getSnapshot().status === 'ready');
  assert(document.body.dataset.wmBackdrop === 'image', 'new plugin instance reloads saved blob from real IndexedDB');
  assert(c.read().brightness === 120 && document.body.style.getPropertyValue('--wm-bg-brightness') === '1.2', 'new plugin instance reloads saved brightness 120 and projects 1.2');
  const pending = c.importMedia('image', await fixture.makeImage('new.png')); c.reset(); await pending;
  assert(c.read().background === 'none' && !document.getElementById('wm-backdrop'), 'reset during import does not reenable background');
  assert(c.read().brightness === 70 && document.body.style.getPropertyValue('--wm-bg-brightness') === '0.7', 'reset restores default brightness 70 and projects 0.7');
  assert(c.media.getSnapshot().media.image.name === 'new.png', 'reset preserves chosen media');
  c.set('background', 'image'); await wait(() => c.media.getSnapshot().status === 'ready');
  await c.media.remove('image'); await wait(() => c.media.getSnapshot().status === 'missing');
  assert(!document.getElementById('wm-backdrop'), 'removing active media restores theme');
  await c.importMedia('video', await fixture.makeVideo());
  c.set('motion', 'always'); await wait(() => c.media.getSnapshot().status === 'ready');
  await wait(() => document.querySelector('#wm-backdrop video').currentTime > .05);
  const video = document.querySelector('#wm-backdrop video');
  assert(video.muted && video.loop && !video.paused, 'real WebM decoded and plays muted in a loop');
  Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
  c.set('motion', 'focus'); window.dispatchEvent(new Event('blur'));
  assert(video.paused, 'focus policy pauses on blur');
  delete document.hasFocus; c.set('motion', 'always'); window.dispatchEvent(new Event('focus'));
  await wait(() => !video.paused);
  return fixture.results;
};
