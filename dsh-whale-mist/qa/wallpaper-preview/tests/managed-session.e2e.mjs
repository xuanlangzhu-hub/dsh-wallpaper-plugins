// End-to-end check of the managed lifecycle against the real helper and a real
// Wallpaper Engine window. One window is created, captured, moved off screen,
// and closed; nothing else on the desktop is touched.
//
// Run: node tests/managed-session.e2e.mjs   (supervised; opens a WE window)
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWallpaperBridge } from '../index.js';
import { runHelper, newLocation } from '../managed-window.js';

const execFileAsync = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const probeExe = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));
const weExe = 'E:\\SteamLibrary\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe';
const project = 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960\\3521337568\\project.json';

if (process.platform !== 'win32' || !existsSync(probeExe) || !existsSync(weExe)) {
  console.log(JSON.stringify({ skipped: true, reason: 'Windows with Wallpaper Engine and a built probe is required' }));
  process.exit(0);
}

const helper = args => runHelper(execFile, probeExe, args);
const root = await mkdtemp(join(tmpdir(), 'whale-managed-'));
const output = join(root, 'capture');
await mkdir(output, { recursive: true });
const location = newLocation();
const config = { helper: probeExe, output, seconds: 30, fps: 30, location, file: project, width: 1280, height: 720 };
const result = { location, output, steps: [] };

const bridge = createWallpaperBridge({ loadConfig: async () => ({ ...config }) });
let exitCode = 1;
try {
  await bridge.setup();
  result.steps.push({ step: 'setup', state: bridge.state() });
  assert.equal(bridge.state().windowCreated, true, 'the round window must be marked created');

  const deadline = Date.now() + 25000;
  while (!bridge.state().captureStarted && Date.now() < deadline) await sleep(200);
  result.steps.push({ step: 'capture-started', native: bridge.report().native });
  assert.equal(bridge.state().captureStarted, true, 'capture must report frames from the window item');

  // Frames must keep flowing while the window sits off screen.
  const before = bridge.report().received;
  await sleep(4000);
  const after = bridge.report().received;
  const found = (await helper(['--window-find'])).find(window => window.title === location);
  assert.ok(found, `the round window ${location} must still exist while off screen`);
  result.steps.push({ step: 'offscreen-steady', receivedBefore: before, receivedAfter: after, windowState: { visible: found.visible, left: found.left, top: found.top, exStyle: found.exStyle } });
  assert.ok(after > before, `no frames while off screen (${before} -> ${after})`);
  assert.equal(found.visible, true, 'an off-screen window stays a visible window');
  assert.ok(found.left <= -30000, 'the window must be off screen');

  const atDsh = await helper(['--window-at', '860', '480', String(0)]);
  result.steps.push({ step: 'dsh-point-hit-test', atDsh });
  assert.equal(atDsh.isProbeWindow, false, 'the source window must not cover the desktop point under test');
  await bridge.stop();
  await sleep(500);
  const remaining = await helper(['--window-find']);
  const final = bridge.report();
  const summary = JSON.parse(await readFile(join(output, 'summary.json'), 'utf8').catch(() => 'null'));
  result.steps.push({ step: 'stopped', failure: final.failure, stopping: final.stopping, remainingProbeWindows: remaining.length, summaryReason: summary?.reason ?? null, frames: summary?.frames ?? null });
  assert.equal(final.failure, null, `no failure expected: ${final.failure}`);
  assert.equal(remaining.length, 0, 'the round window must be gone');
  assert.ok((summary?.frames ?? 0) > 0, 'the capture must have produced frames');

  exitCode = 0;
} catch (error) {
  result.error = error.message;
  await bridge.stop().catch(() => {});
  throw error;
} finally {
  await helper(['--window-ensure-closed', location, '15000']).catch(() => {});
  await writeFile(join(root, 'managed-session-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, exitCode }, null, 2));
  await rm(root, { recursive: true, force: true }).catch(() => {});
}
process.exit(exitCode);
