import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { createDetachableHttpHost } from '../src/detachable-host.js';
import { createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';
import { createCompanionApp } from '../src/companion/companion.js';
import { apply } from '../src/index.js';
import { createMainRendererBridgeClient } from '../src/detachable-contract.js';

const out = {};
const routes = new Map(), disposers = [], injectors = [];
let rejectionCalled = 0;
process.env.WM_CONTRACT_ISOLATED = '1';

apply({
  webServer: { register(r) { routes.set(r.path, r); return () => routes.delete(r.path); } },
  effect(fn) { const d=fn(); if(typeof d==='function') disposers.push(d); },
  get() { return { requestRejection() { rejectionCalled++; return 401; } }; },
  on(n, fn) { if (n === 'dispose') disposers.push(fn); if(n === 'webserver/index-inject') injectors.push(fn); }
});

try {
  await new Promise(r => setTimeout(r, 100));
  let status, body;
  await routes.get('/whale-appearance/bootstrap').handler({headers:{},method:'GET',url:'/whale-appearance/bootstrap'}, {
    writeHead(s) { status=s; }, end(b) { body=JSON.parse(b); }
  });
  const table=[];for(const fn of injectors)fn(table);
  out.bootstrap = {
    anonymousStatus: status,
    mainTokenDisclosed: Boolean(body?.mainToken),
    actualRejectionApiCalls: rejectionCalled,
    globalSecretInjected: Boolean(table[0]?.value?.mainToken),
  };
} finally {
  for(const fn of disposers) await fn();
  delete process.env.WM_CONTRACT_ISOLATED;
}

let launchSpec;
const host = createDetachableHttpHost({
  windowAdapter: {
    async spawn(s) { launchSpec = s; return { id: 'mock-owned', pid: 12345, profileDir: 'C:\\Synthetic\\Profile' }; },
    async close() { return { ok: true }; }
  }
});
await host.start();

let mainClient;
try {
  const base = host.getBaseUrl();
  out.mainOriginChecks = [];
  for (const origin of ['dsh-app://app', 'null', 'http://127.0.0.1:12345']) {
    const r = await fetch(base + '/api/main/connect', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    out.mainOriginChecks.push({ origin, status: r.status });
  }

  const s = Object.freeze({ brightness: 70, mask: 55 });
  mainClient = createMainRendererBridgeClient({
    baseUrl: base,
    mainToken: host.getMainToken(),
    instanceId: 'synthetic-main',
    controller: {
      getSettingsSnapshot: () => s,
      subscribeSettings: () => () => {},
      presets: { getSnapshot: () => ({ entries: {} }) },
      wallpaper: { getStatus: () => ({ state: 'idle' }) }
    }
  });

  await mainClient.connect();
  const detached = await mainClient.requestDetach();
  const launchUrl = new URL(launchSpec.appUrl);
  const page = await fetch(launchSpec.appUrl);

  out.launch = {
    detachOk: detached.ok,
    specKeys: Object.keys(launchSpec),
    rawPortPresent: launchSpec.hostPort !== undefined,
    pagePath: launchUrl.pathname,
    pageStatus: page.status,
    queryKeyNames: [...launchUrl.searchParams.keys()],
  };

  const adapter = createEdgeWindowAdapter({
    profileDir: new URL('./adapter-profile', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess() { throw new Error('must-not-spawn'); }
  });

  try {
    await adapter.spawn(launchSpec);
    out.launch.adapterError = null;
  } catch (e) {
    out.launch.adapterError = e.message;
  }

  const notices = [];
  const app = createCompanionApp({
    windowObj: {
      location: { origin: base, pathname: '/index.html', search: launchUrl.search },
      history: { replaceState() {} }
    },
    documentObj: {
      title: 'synthetic',
      getElementById(id) {
        return id === 'error-banner' ? {
          classList: { add() {}, remove() {} },
          set textContent(v) { notices.push(v); }
        } : null;
      }
    },
    customTransport: {
      async connect() { return { ok: true }; }
    }
  });

  await app.start();
  out.launch.pageAuthenticated = app.isConnected();
  out.launch.pageError = notices.at(-1) || null;
} finally {
  await mainClient?.dispose();
  await host.stop();
}

const sent = [];
const app = createCompanionApp({
  windowObj: {
    location: { origin: 'http://127.0.0.1:1', pathname: '/', search: '?token=synthetic&instanceId=synthetic' },
    history: { replaceState() {} }
  },
  documentObj: { title: 'synthetic', getElementById() { return null; } },
  customTransport: {
    onSnapshot() {},
    async connect() { return { ok: true, snapshot: { revision: 1, settings: { brightness: 70, mask: 55 } } }; },
    async sendAction(a) { sent.push(a); return { ok: true }; }
  }
});
await app.start();
await app.handleMaskChange('0');
out.maskZero = { requested: 0, sent: sent[0]?.value };

const unowned = [];
const foreign = createEdgeWindowAdapter({
  execCommand(cmd, args, cb) { unowned.push({ cmd, args }); cb(null); }
});
await foreign.close({ pid: 987654321 });
out.unownedClose = { commands: unowned, osProcessesTouched: 0 };

const exitedChild = new EventEmitter();
exitedChild.pid = 987654323;
exitedChild.kill = () => {};
const staleCommands = [];
const stale = createEdgeWindowAdapter({
  findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
  spawnProcess: () => exitedChild,
  execCommand(cmd, args, cb) { staleCommands.push({ cmd, args }); cb(null); }
});
const staleHandle = await stale.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
exitedChild.emit('exit', 0);
await stale.close(staleHandle);
out.exitedOwnedProcessClose = { commands: staleCommands, osProcessesTouched: 0 };

const child = new EventEmitter();
child.pid = 987654322;
child.kill = () => {};
const failing = createEdgeWindowAdapter({
  gracefulTimeoutMs: 1,
  findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
  spawnProcess: () => child,
  execCommand(cmd, args, cb) { cb(new Error('synthetic-denied')); }
});
const h = await failing.spawn({ hostPort: 12345, token: 'synthetic', instanceId: 'synthetic' });
await failing.dispose();
out.failedDispose = {
  childExitObserved: false,
  profileStillExists: existsSync(h.profileDir),
  trackedProcesses: failing.getTrackedProcessCount(),
  ownedProfiles: failing.getOwnedProfileCount(),
  osProcessesTouched: 0
};

console.log(JSON.stringify(out, null, 2));
