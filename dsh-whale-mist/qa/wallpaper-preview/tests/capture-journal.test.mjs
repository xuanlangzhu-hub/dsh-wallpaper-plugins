import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProbeJournal, parseLogLine } from '../probe-log.js';

const probeExe = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));
const weExe = 'E:\\SteamLibrary\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe';
const project = 'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960\\3521337568\\project.json';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function launchWe(args) {
  const child = spawn(weExe, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function helperJson(args, timeoutMs = 20000) {
  const child = spawn(probeExe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  const code = await new Promise(resolve => child.on('close', resolve));
  assert.equal(code, 0, `helper failed: ${args.join(' ')}`);
  return JSON.parse(stdout.trim());
}

/** True while a window with this exact round name still exists. */
async function exists(location) {
  const found = await helperJson(['--window-find']).catch(() => []);
  return found.some(window => window.title === location);
}

const runnable = process.platform === 'win32';
const available = runnable && (await import('node:fs')).existsSync(weExe) && (await import('node:fs')).existsSync(probeExe);

// One supervised capture against a real, uniquely named WE window. This is the
// end-to-end check that a successful run leaves `failure` null even though the
// helper writes [Desktop] diagnostics to stderr.
test('a successful capture produces only informational diagnostics', { skip: !available, timeout: 120000 }, async () => {
  const location = `WhaleWallpaperProbe-selftest-${Date.now().toString().slice(-8)}`;
  const root = await mkdtemp(join(tmpdir(), 'whale-probe-selftest-'));
  const output = join(root, 'capture');
  try {
    launchWe(['-control', 'openWallpaper', '-file', project, '-playInWindow', location, '-width', '640', '-height', '360']);
    let state = null;
    for (let attempt = 0; attempt < 40 && !state; attempt++) {
      await sleep(500);
      const found = await helperJson(['--window-find']);
      state = found.find(window => window.title === location) ?? null;
    }
    assert.ok(state, `window ${location} did not appear`);

    const child = spawn(probeExe, [String(state.hwnd), output, '3', '30', 'readback', '--echo-on-stderr'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const journal = new ProbeJournal();
    child.stdout.resume();
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => journal.push(chunk));
    const code = await new Promise(resolve => child.on('close', resolve));
    journal.finish();

    assert.equal(code, 0, `capture exited ${code}: ${journal.snapshot().firstError ?? ''}`);
    assert.equal(journal.errorCount, 0, `unexpected error diagnostics: ${journal.snapshot().firstError}`);
    const desktop = journal.entries.find(entry => entry.scope === 'Desktop');
    assert.ok(desktop, 'the informational desktop diagnostic is missing');
    assert.match(desktop.message, /SetThreadDesktop: (True|False)/);
    assert.ok(journal.entries.some(entry => entry.scope === 'Status'), 'device diagnostics are missing');
    assert.ok(journal.entries.some(entry => entry.scope === 'Summary'), 'the final summary envelope is missing');
    const lastError = journal.entries.filter(entry => entry.level === 'error');
    assert.deepEqual(lastError, []);
    const summary = JSON.parse(await readFile(join(output, 'summary.json'), 'utf8'));
    assert.equal(summary.mode, 'readback');
    assert.ok(summary.frames > 0);
    assert.equal(parseLogLine(journal.snapshot().messages[0]).level, 'info');
  } finally {
    await helperJson(['--window-ensure-closed', location, '15000']).catch(() => {});
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

// Pipe mode is the Host transport: every stderr line must classify without an
// error, and the summary must report the parent's explicit stop.
test('pipe mode stops on stdin EOF and reports no error', { skip: !available, timeout: 120000 }, async () => {
  const location = `WhaleWallpaperProbe-selftest-pipe-${Date.now().toString().slice(-8)}`;
  const root = await mkdtemp(join(tmpdir(), 'whale-probe-pipe-'));
  const output = join(root, 'capture');
  try {
    launchWe(['-control', 'openWallpaper', '-file', project, '-playInWindow', location, '-width', '640', '-height', '360']);
    let state = null;
    for (let attempt = 0; attempt < 40 && !state; attempt++) {
      await sleep(500);
      const found = await helperJson(['--window-find']);
      state = found.find(window => window.title === location) ?? null;
    }
    assert.ok(state, `window ${location} did not appear`);

    const child = spawn(probeExe, [String(state.hwnd), output, '60', '30', 'pipe'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const journal = new ProbeJournal();
    let stdoutBytes = 0;
    child.stdout.on('data', chunk => { stdoutBytes += chunk.length; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => journal.push(chunk));
    await sleep(3000);
    child.stdin.end('stop\n'); // Parent-side stop path used by the Host.
    const code = await new Promise(resolve => child.on('close', resolve));
    journal.finish();

    assert.equal(code, 0, `capture exited ${code}: ${journal.snapshot().firstError ?? ''}`);
    assert.equal(journal.errorCount, 0, `unexpected error diagnostics: ${journal.snapshot().firstError}`);
    assert.ok(stdoutBytes > 0, 'no frames reached stdout');
    const status = journal.entries.filter(entry => entry.scope === 'Status');
    assert.ok(status.length >= 1, 'no capture status envelope');
    assert.ok(JSON.parse(status.at(-1).message).frames > 0);
    const summary = journal.entries.filter(entry => entry.scope === 'Summary').at(-1);
    assert.ok(summary, 'no summary envelope');
    assert.equal(JSON.parse(summary.message).reason, 'parent-stop');
    await writeFile(join(root, 'stderr.jsonl'), journal.snapshot().messages.join('\n'));
  } finally {
    await helperJson(['--window-ensure-closed', location, '15000']).catch(() => {});
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

// R2: the Host can die without running any JavaScript cleanup. The surviving
// native process owns the round window through --owned-location and must close
// it after the parent end of the pipe goes away. This test never closes the
// window itself: it only asserts that it is gone afterwards.
test('parent disconnect leaves no source window behind', { skip: !available, timeout: 180000 }, async () => {
  const location = `WhaleWallpaperProbe-selftest-orphan-${Date.now().toString().slice(-8)}`;
  const root = await mkdtemp(join(tmpdir(), 'whale-probe-orphan-'));
  const output = join(root, 'capture');
  try {
    launchWe(['-control', 'openWallpaper', '-file', project, '-playInWindow', location, '-width', '640', '-height', '360']);
    let state = null;
    for (let attempt = 0; attempt < 40 && !state; attempt++) {
      await sleep(500);
      const found = await helperJson(['--window-find']);
      state = found.find(window => window.title === location) ?? null;
    }
    assert.ok(state, `window ${location} did not appear`);

    const child = spawn(probeExe, [String(state.hwnd), output, '120', '30', 'pipe', '--owned-location', location],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const journal = new ProbeJournal();
    child.stdout.resume();
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => journal.push(chunk));
    await sleep(3000);
    assert.equal(await exists(location), true, 'the window must exist before the disconnect');

    // Simulate a dead parent: close our end without a stop command.
    child.stdin.destroy();
    const code = await new Promise(resolve => child.on('close', resolve));
    journal.finish();
    assert.equal(code, 0, `capture exited ${code}: ${journal.snapshot().firstError ?? ''}`);

    let gone = false;
    for (let attempt = 0; attempt < 60 && !gone; attempt++) { await sleep(500); gone = !(await exists(location)); }
    assert.equal(gone, true, 'the source window must be closed by the surviving native process');
    const summary = JSON.parse(await readFile(join(output, 'summary.json'), 'utf8'));
    assert.equal(summary.reason, 'parent-stop');
    assert.equal(summary.ownedLocation, location);
    assert.equal(summary.windowClose?.closed, true, `window close reported ${JSON.stringify(summary.windowClose)}`);
    assert.ok(summary.frames > 0, 'the capture must have produced frames before the disconnect');
    await writeFile(join(root, 'orphan-summary.json'), JSON.stringify(summary, null, 2));
  } finally {
    await helperJson(['--window-ensure-closed', location, '15000']).catch(() => {});
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

