import { existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createDetachableHttpHost } from '../src/detachable-host.js';
import { createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';
import { createMainRendererBridgeClient } from '../src/detachable-contract.js';
import { createCompanionApp } from '../src/companion/companion.js';

const out = {};
const child = new EventEmitter();
child.pid = 987654400;
child.kill = () => child.emit('exit', 0);

const adapter = createEdgeWindowAdapter({
  findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
  spawnProcess: () => child
});
const host = createDetachableHttpHost({ windowAdapter: adapter });
await host.start();
let main;

try {
  const settings = Object.freeze({ brightness: 70, mask: 55 });
  main = createMainRendererBridgeClient({
    baseUrl: host.getBaseUrl(),
    mainToken: host.getMainToken(),
    instanceId: 'review-' + randomUUID(),
    controller: {
      getSettingsSnapshot: () => settings,
      subscribeSettings: () => () => {},
      presets: { getSnapshot: () => ({ entries: {} }) },
      wallpaper: { getStatus: () => ({ state: 'idle' }) }
    }
  });

  await main.connect();
  const d = await main.requestDetach();
  const handle = host.getActiveOwnedHandle();
  const before = adapter.getOwnedProfileCount();
  const dock = await main.requestDock();

  out.prebuiltProfile = {
    detachOk: d.ok,
    dockOk: dock.ok,
    ownedCountAfterSpawn: before,
    profileExistsAfterDock: existsSync(handle.profileDir),
    trackedAfterDock: adapter.getTrackedProcessCount(),
    nativeProcessesTouched: 0
  };

  out.originFence = [];
  for (const path of ['/api/main/connect', '/api/action']) {
    for (const origin of ['null', 'dsh-app://app', 'http://127.0.0.1:12345']) {
      const r = await fetch(host.getBaseUrl() + path, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' }
      });
      out.originFence.push({ path, origin, status: r.status });
    }
  }
} finally {
  await main?.dispose();
  await host.stop();
}

const aliveChild = new EventEmitter();
aliveChild.pid = 987654401;
aliveChild.kill = () => {};
let callbackCount = 0;
const noExit = createEdgeWindowAdapter({
  gracefulTimeoutMs: 1,
  findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
  spawnProcess: () => aliveChild,
  execCommand(c, a, cb) { callbackCount++; cb(null); }
});
const h = await noExit.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
const close = await noExit.close(h);
out.unconfirmedExit = {
  childExitObserved: false,
  taskkillMockCallbackCount: callbackCount,
  closeOk: close.ok,
  trackedProcesses: noExit.getTrackedProcessCount(),
  profileExists: existsSync(h.profileDir),
  nativeProcessesTouched: 0
};

const falseHost = createDetachableHttpHost({
  windowAdapter: {
    async spawn() { return { id: 'synthetic-owned', pid: 12345 }; },
    async close() { return { ok: false, error: 'unowned-handle' }; }
  }
});
await falseHost.start();
let falseMain;
try {
  falseMain = createMainRendererBridgeClient({
    baseUrl: falseHost.getBaseUrl(),
    mainToken: falseHost.getMainToken(),
    instanceId: 'false-close',
    controller: { read: () => ({ brightness: 70, mask: 55 }) }
  });
  await falseMain.connect();
  await falseMain.requestDetach();
  const d = await falseMain.requestDock();
  out.falseCloseResult = {
    dockOk: d.ok,
    mode: falseHost.getMode(),
    ownerRetained: Boolean(falseHost.getActiveOwnedHandle()),
    unconfirmedCleanup: falseHost.hasUnconfirmedCleanup()
  };
} finally {
  await falseMain?.dispose();
  await falseHost.stop();
}

function makeApp(transport) {
  return createCompanionApp({
    windowObj: {
      location: { origin: 'http://127.0.0.1:1', pathname: '/', search: '?token=synthetic&instanceId=synthetic' },
      history: { replaceState() {} }
    },
    documentObj: { title: 'synthetic', getElementById() { return null; } },
    customTransport: transport
  });
}

const sent = [];
const noopApp = makeApp({
  async connect() { return { ok: true, snapshot: { revision: 1, settings: { brightness: 70, mask: 55 } } }; },
  async sendAction(a) {
    sent.push(a);
    return { ok: true, snapshot: { revision: 2, settings: { brightness: a.value, mask: 55 } } };
  }
});
await noopApp.start();
await noopApp.handleBrightnessChange('70');
await noopApp.handleBrightnessChange('95');
out.noopQueue = {
  requestedFinal: 95,
  sentValues: sent.map(a => a.value),
  confirmedBrightness: noopApp.getSnapshot()?.settings?.brightness
};

let revision = 1, settings = { brightness: 70, mask: 55 };
const crossSent = [];
const crossApp = makeApp({
  async connect() { return { ok: true, snapshot: { revision, settings: { ...settings } } }; },
  async sendAction(a) {
    crossSent.push({ key: a.key, value: a.value, expectedRevision: a.expectedRevision });
    await new Promise(r => setTimeout(r, 15));
    if (a.expectedRevision !== revision) {
      return { ok: false, error: 'stale-revision', snapshot: { revision, settings: { ...settings } } };
    }
    settings[a.key] = a.value;
    return { ok: true, snapshot: { revision: ++revision, settings: { ...settings } } };
  }
});
await crossApp.start();
await Promise.all([crossApp.handleBrightnessChange('95'), crossApp.handleMaskChange('0')]);
out.crossFieldQueue = { sent: crossSent, confirmedSettings: settings };

console.log(JSON.stringify(out, null, 2));
