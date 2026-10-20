import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';

import { apply } from '../src/index.js';
import { createEdgeWindowAdapter } from '../src/detachable-edge-adapter.js';
import { createDetachableHttpHost } from '../src/detachable-host.js';
import { createMainRendererBridgeClient } from '../src/detachable-contract.js';

console.log('--- Running Third Review Verification Probes ---');

// =========================================================================
// PROBE 1: Production Origin Fence via real index.apply with desktopOrigin
// =========================================================================
const disposers = [];
const injectors = [];
process.env.WM_CONTRACT_ISOLATED = '1';

apply({
  webServer: {
    host: '127.0.0.1',
    port: 12345,
    protocol: 'http:',
    register() { return () => {}; }
  },
  get() {
    return { requestRejection() { return 401; } };
  },
  effect(fn) {
    const off = fn();
    if (typeof off === 'function') disposers.push(off);
  },
  on(name, fn) {
    if (name === 'webserver/index-inject') injectors.push(fn);
    if (name === 'dispose') disposers.push(fn);
  }
});

let probe1Results = [];
try {
  await new Promise((r) => setTimeout(r, 100));
  const table = [];
  for (const fn of injectors) fn(table);
  const bootEntry = table.find((r) => r.name === '__WHALE_DETACHABLE_BOOT__');
  assert.ok(bootEntry, '__WHALE_DETACHABLE_BOOT__ must be injected');
  const port = bootEntry.value.port;
  assert.ok(port > 0, 'Port must be a positive integer');

  for (const path of ['/api/main/connect', '/api/action']) {
    for (const origin of ['null', 'dsh-app://app', 'http://127.0.0.1:12345', 'http://127.0.0.1:12346', `http://127.0.0.1:${port}`]) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' }
      });
      probe1Results.push({ path, origin, status: r.status });
    }
  }

  // Assertions for /api/main/connect
  const mainNull = probe1Results.find((r) => r.path === '/api/main/connect' && r.origin === 'null');
  assert.equal(mainNull.status, 403, 'Main endpoint must reject null origin with 403');
  const mainDsh = probe1Results.find((r) => r.path === '/api/main/connect' && r.origin === 'dsh-app://app');
  assert.equal(mainDsh.status, 204, 'Main endpoint must accept dsh-app://app with 204');
  const mainDesktop = probe1Results.find((r) => r.path === '/api/main/connect' && r.origin === 'http://127.0.0.1:12345');
  assert.equal(mainDesktop.status, 204, 'Main endpoint must accept configured desktopOrigin with 204');
  const mainForeign = probe1Results.find((r) => r.path === '/api/main/connect' && r.origin === 'http://127.0.0.1:12346');
  assert.equal(mainForeign.status, 403, 'Main endpoint must reject foreign loopback port with 403');

  // Assertions for /api/action (companion endpoint)
  const actNull = probe1Results.find((r) => r.path === '/api/action' && r.origin === 'null');
  assert.equal(actNull.status, 403, 'Companion endpoint must reject null origin with 403');
  const actDsh = probe1Results.find((r) => r.path === '/api/action' && r.origin === 'dsh-app://app');
  assert.equal(actDsh.status, 403, 'Companion endpoint must reject dsh-app://app with 403');
  const actDesktop = probe1Results.find((r) => r.path === '/api/action' && r.origin === 'http://127.0.0.1:12345');
  assert.equal(actDesktop.status, 403, 'Companion endpoint must reject desktopOrigin with 403');
  const actForeign = probe1Results.find((r) => r.path === '/api/action' && r.origin === 'http://127.0.0.1:12346');
  assert.equal(actForeign.status, 403, 'Companion endpoint must reject foreign loopback with 403');
  const actCompanion = probe1Results.find((r) => r.path === '/api/action' && r.origin === `http://127.0.0.1:${port}`);
  assert.equal(actCompanion.status, 204, 'Companion endpoint must accept companion own origin with 204');

  console.log('[PASS] Probe 1: Production Origin Fence verified successfully.');
} finally {
  for (const fn of disposers) await fn();
  delete process.env.WM_CONTRACT_ISOLATED;
}

// =========================================================================
// PROBE 2: Pre-existing Profile Preservation & Boundary Defense
// =========================================================================
const sentinelRoot = resolve(join(tmpdir(), 'whale-companion-profile-third-review-sentinel-' + randomUUID()));
await mkdir(sentinelRoot, { recursive: false });
const sentinel = join(sentinelRoot, 'created-before-adapter.txt');
await writeFile(sentinel, 'owned by the review fixture, not adapter');

try {
  const child = new EventEmitter();
  child.pid = 987654501;
  child.kill = () => child.emit('exit', 0);
  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'synthetic',
    instanceId: 'synthetic',
    profileDir: sentinelRoot,
  });

  const count = adapter.getOwnedProfileCount();
  assert.equal(count, 0, 'Pre-existing profile must NOT be claimed as owned');

  const closed = await adapter.close(handle);
  assert.equal(closed.ok, true, 'Adapter close must succeed');
  assert.equal(closed.profileDirCleaned, false, 'Pre-existing profile must NOT be cleaned up');
  assert.equal(existsSync(sentinel), true, 'Sentinel file must be preserved');
  assert.equal(existsSync(sentinelRoot), true, 'Sentinel root directory must be preserved');

  console.log('[PASS] Probe 2: Pre-existing profile preservation verified successfully.');
} finally {
  await rm(sentinelRoot, { recursive: true, force: true }).catch(() => {});
}

// =========================================================================
// PROBE 3: Normal Profile Exclusive Creation & Confirmed Cleanup
// =========================================================================
{
  const child = new EventEmitter();
  child.pid = 987654502;
  child.kill = () => child.emit('exit', 0);
  const adapter = createEdgeWindowAdapter({
    findEdge: () => ({ available: true, path: 'C:\\Synthetic\\msedge.exe' }),
    spawnProcess: () => child,
  });

  const handle = await adapter.spawn({
    hostPort: 12345,
    token: 'synthetic-normal',
    instanceId: 'synthetic-normal',
  });

  assert.equal(adapter.getOwnedProfileCount(), 1, 'Newly created profile must be registered as owned');
  assert.equal(existsSync(handle.profileDir), true, 'Dedicated profile dir must exist on disk');

  const closed = await adapter.close(handle);
  assert.equal(closed.ok, true, 'Adapter close must succeed');
  assert.equal(closed.profileDirCleaned, true, 'Dedicated profile must be cleaned up on close');
  assert.equal(existsSync(handle.profileDir), false, 'Dedicated profile dir must no longer exist');
  assert.equal(adapter.getOwnedProfileCount(), 0, 'Owned profile count must return to 0');

  console.log('[PASS] Probe 3: Normal profile exclusive creation and cleanup verified.');
}

// =========================================================================
// PROBE 4: Host Stop Retry with Unconfirmed Cleanup
// =========================================================================
{
  let fail = true;
  let closes = 0;
  const host = createDetachableHttpHost({
    windowAdapter: {
      async spawn() { return { id: 'synthetic' }; },
      async close() {
        closes++;
        return fail ? { ok: false, error: 'synthetic-close-failure' } : { ok: true };
      }
    }
  });

  await host.start();
  const main = createMainRendererBridgeClient({
    baseUrl: host.getBaseUrl(),
    mainToken: host.getMainToken(),
    instanceId: 'stop-retry',
    controller: { read: () => ({ brightness: 70, mask: 55 }) }
  });

  try {
    await main.connect();
    await main.requestDetach();

    // First stop: fails
    const first = await host.stop();
    assert.equal(first.ok, false, 'First stop must report false on cleanup failure');
    assert.equal(closes, 1, 'Close should have been called once');
    assert.equal(Boolean(host.getActiveOwnedHandle()), true, 'Owner handle must be retained on failure');
    assert.equal(host.hasUnconfirmedCleanup(), true, 'unconfirmedCleanup must remain true');

    // Fix failure condition
    fail = false;

    // Second stop: retries and succeeds!
    const second = await host.stop();
    assert.equal(second.ok, true, 'Second stop must succeed after failure condition is cleared');
    assert.equal(closes, 2, 'Close must have been retried on second stop');
    assert.equal(Boolean(host.getActiveOwnedHandle()), false, 'Owner handle must be cleared after successful cleanup');
    assert.equal(host.hasUnconfirmedCleanup(), false, 'unconfirmedCleanup must be cleared after successful cleanup');

    // Third stop: idempotent
    const third = await host.stop();
    assert.equal(third.ok, true, 'Third stop must be idempotent');
    assert.equal(closes, 2, 'No additional close calls on idempotent stop');

    console.log('[PASS] Probe 4: Stop retry on unconfirmed cleanup verified successfully.');
  } finally {
    await main.dispose();
    await host.stop();
  }
}

// =========================================================================
// PROBE 5: Persistent Failure Behavior
// =========================================================================
{
  let closeAttempts = 0;
  const host = createDetachableHttpHost({
    windowAdapter: {
      async spawn() { return { id: 'persistent-fail-handle' }; },
      async close() {
        closeAttempts++;
        return { ok: false, error: 'cannot-close-window' };
      }
    }
  });

  await host.start();
  const main = createMainRendererBridgeClient({
    baseUrl: host.getBaseUrl(),
    mainToken: host.getMainToken(),
    instanceId: 'persistent-fail',
    controller: { read: () => ({ brightness: 70, mask: 55 }) }
  });

  try {
    await main.connect();
    await main.requestDetach();

    const stop1 = await host.stop();
    assert.equal(stop1.ok, false);
    assert.equal(closeAttempts, 1);
    assert.equal(host.hasUnconfirmedCleanup(), true);

    const stop2 = await host.stop();
    assert.equal(stop2.ok, false);
    assert.equal(closeAttempts, 2, 'Should continue attempting cleanup on subsequent calls');
    assert.equal(host.hasUnconfirmedCleanup(), true);

    console.log('[PASS] Probe 5: Persistent failure continues reporting unconfirmed cleanup.');
  } finally {
    await main.dispose();
  }
}

console.log('--- ALL THIRD REVIEW VERIFICATION PROBES PASSED! ---');
