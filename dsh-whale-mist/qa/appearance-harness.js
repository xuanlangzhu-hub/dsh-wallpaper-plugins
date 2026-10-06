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
  assert(c.set('brightness', 999).brightness === 100 && c.set('surface', -3).surface === 40, 'range settings clamp');
  assert(c.set('brightness', NaN).brightness === 100 && c.set('__proto__', 'x').theme === 'abyss', 'invalid and prototype settings ignored');
  await c.importMedia('image', await fixture.makeImage());
  await wait(() => c.media.getSnapshot().status === 'ready');
  assert(document.body.dataset.wmBackdrop === 'image' && document.querySelectorAll('#wm-backdrop').length === 1, 'real PNG decoded and background mounted once');
  assert(getComputedStyle(document.querySelector('#wm-backdrop')).pointerEvents === 'none', 'background cannot intercept clicks');
  assert(getComputedStyle(document.getElementById('fixture-base')).backgroundColor === 'rgba(0, 0, 0, 0)', 'clear canvas stays transparent with background');
  assert(getComputedStyle(document.getElementById('fixture-card')).backgroundColor.includes('0.4'), 'surface slider reaches rendered surface opacity');
  assert(getComputedStyle(document.getElementById('fixture-composer')).backgroundImage.includes('rgb(') && !getComputedStyle(document.getElementById('fixture-composer')).backgroundImage.includes('rgba('), 'composer remains opaque');
  assert(fixture.controls().filter(node => node.props.type === 'range').length === 4, 'four background sliders are connected');
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
  const pending = c.importMedia('image', await fixture.makeImage('new.png')); c.reset(); await pending;
  assert(c.read().background === 'none' && !document.getElementById('wm-backdrop'), 'reset during import does not reenable background');
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
