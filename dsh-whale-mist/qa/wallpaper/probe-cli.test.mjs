import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Native argument surface for daily playback. `--parse-check` runs the real parser over an
// argv file and prints the result, so these checks assert on the exact argv the Host builds
// without creating a window or doing any capture work.
// qa/wallpaper/ -> qa/wallpaper-probe/ (the sibling experiment directory)
const probeExe = fileURLToPath(new URL('../../qa/wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));

const argDirectory = await mkdtemp(join(tmpdir(), 'wm-argv-'));
let counter = 0;

/** Runs the packaged parser over one argv array and returns its verdict. */
async function parse(args) {
  const file = join(argDirectory, `argv-${++counter}.json`);
  await writeFile(file, JSON.stringify(args), 'utf8');
  const result = spawnSync(probeExe, ['--parse-check', file], { windowsHide: true, timeout: 30000, encoding: 'utf8' });
  const line = (result.stdout ?? '').trim().split('\n').filter(Boolean).pop();
  return line ? JSON.parse(line) : { ok: false, error: 'no-output', message: (result.stderr ?? '').trim() };
}

// The exact argv `src/wallpaper/session.js` builds for daily playback. When the parser removed
// `--forever` in place it shifted `pipe` into the fps slot and every daily run died with the
// usage error before any window work; this locks the production shape.
function exactHostDailyArgv(outputDirectory, location) {
  return ['0', outputDirectory, '--forever', '30', 'pipe', '--owned-location', location];
}

test('the exact Host daily argv parses as a daily capture', async () => {
  const parsed = await parse(exactHostDailyArgv('C:\\temp\\wm-daily-output', 'WhaleWallpaperProbe-self-test-absent'));
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  assert.equal(parsed.forever, true, 'daily playback is a no-timer run');
  assert.equal(parsed.durationSeconds, null, 'a daily run has no duration');
  assert.equal(parsed.fps, 30, 'fps stays in its slot');
  assert.equal(parsed.captureMode, 'pipe', 'the capture mode is not misread as fps');
  assert.equal(parsed.outputDirectory, 'C:\\temp\\wm-daily-output');
  assert.equal(parsed.ownedLocation, 'WhaleWallpaperProbe-self-test-absent', 'the round ownership is kept');
  assert.equal(parsed.echoMode, false);
});

// T3: an unlimited run must stay bound to its parent and to this round's window. Without the
// command pipe there is no stop channel, and without the owned round name a parent loss could
// not close the captured window, so both are required for --forever.
test('a daily run without the parent stop channel is refused', async () => {
  for (const mode of ['disk', 'memory', 'readback', 'staging', 'frames']) {
    const parsed = await parse(['0', 'C:\\temp\\wm-daily-unowned', '--forever', '30', mode, '--owned-location', 'WhaleWallpaperProbe-self-test-absent']);
    assert.equal(parsed.ok, false, `daily + ${mode} must be refused`);
    assert.match(parsed.message, /pipe capture mode/);
  }
  const noMode = await parse(['0', 'C:\\temp\\wm-daily-nomode', '--forever', '30']);
  assert.equal(noMode.ok, false, 'daily without an explicit pipe mode must be refused');
  assert.match(noMode.message, /pipe capture mode/);
});

test('a daily run without resource ownership is refused', async () => {
  const unowned = await parse(['0', 'C:\\temp\\wm-daily-unowned', '--forever', '30', 'pipe']);
  assert.equal(unowned.ok, false, 'daily without --owned-location must be refused');
  assert.match(unowned.message, /owned-location/);
});

test('the bounded QA forms keep working with their own capture modes', async () => {
  // The constraint above applies to the unlimited run only: a timed capture is supervised by its
  // own duration and keeps the existing disk/memory/readback/staging forms.
  for (const mode of ['disk', 'memory', 'readback', 'staging', 'frames', 'pipe']) {
    const parsed = await parse(['0', 'C:\\temp\\wm-qa', '120', '30', mode]);
    assert.equal(parsed.ok, true, `bounded ${mode} must parse: ${JSON.stringify(parsed)}`);
    assert.equal(parsed.forever, false);
    assert.equal(parsed.captureMode, mode);
  }
});

// T4: the legacy diagnostic flag must keep working instead of becoming an extra positional
// argument, which is what the previous parser change broke.
test('the legacy --echo-on-stderr flag is accepted and reported', async () => {
  const preview = await parse(['0', 'C:\\temp\\wm-echo', '180', '30', 'pipe', '--echo-on-stderr']);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.echoMode, true, 'the echo diagnostic stays enabled');
  assert.equal(preview.durationSeconds, 180, 'the preview keeps its duration');
  assert.equal(preview.captureMode, 'pipe');

  const withOwned = await parse(['0', 'C:\\temp\\wm-echo-owned', '180', '30', 'pipe', '--echo-on-stderr', '--owned-location', 'WhaleWallpaperProbe-self-test-absent']);
  assert.equal(withOwned.ok, true, JSON.stringify(withOwned));
  assert.equal(withOwned.echoMode, true);
  assert.equal(withOwned.ownedLocation, 'WhaleWallpaperProbe-self-test-absent');
  assert.equal(withOwned.captureMode, 'pipe', 'the flag is not read as the capture mode');

  const diskForm = await parse(['0', 'C:\\temp\\wm-echo-disk', '120', '30', '--echo-on-stderr']);
  assert.equal(diskForm.ok, true, JSON.stringify(diskForm));
  assert.equal(diskForm.captureMode, 'disk', 'the trailing flag does not consume the mode slot');

  // An unknown flag must still be refused rather than silently ignored.
  const unknown = await parse(['0', 'C:\\temp\\wm-unknown', '120', '30', 'pipe', '--bogus-flag']);
  assert.equal(unknown.ok, false, 'an unknown flag is refused');
  assert.match(unknown.message, /Usage/);
});

test('the exact Host preview argv parses as a bounded capture', async () => {
  const parsed = await parse(['0', 'C:\\temp\\wm-preview-output', '180', '30', 'pipe', '--owned-location', 'WhaleWallpaperProbe-self-test-absent']);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  assert.equal(parsed.forever, false);
  assert.equal(parsed.durationSeconds, 180, 'the preview keeps its bounded seconds');
  assert.equal(parsed.fps, 30);
  assert.equal(parsed.captureMode, 'pipe');
});

test('invalid combinations are still refused', async () => {
  const mixed = await parse(['0', 'C:\\temp\\wm-mixed', '180', '--forever', '30']);
  assert.equal(mixed.ok, false, 'a duration next to --forever is ambiguous');
  assert.match(mixed.message, /duration slot/);

  const short = await parse(['0', '--forever', '30', 'pipe']);
  assert.equal(short.ok, false, 'a missing output directory is refused');
  assert.match(short.message, /duration slot|Usage/);

  const outOfRange = await parse(['0', 'C:\\temp\\wm-range', '1801', '30', 'pipe']);
  assert.equal(outOfRange.ok, false);
  assert.match(outOfRange.message, /Usage/);

  const badFps = await parse(['0', 'C:\\temp\\wm-fps', '180', '99', 'pipe']);
  assert.equal(badFps.ok, false);
  assert.match(badFps.message, /fps/);

  const badMode = await parse(['0', 'C:\\temp\\wm-mode', '180', '30', 'bogus']);
  assert.equal(badMode.ok, false);
  assert.match(badMode.message, /Unknown capture mode/);

  const badOwned = await parse(['0', 'C:\\temp\\wm-owned', '180', '30', 'pipe', '--owned-location', 'SomeOtherWindow']);
  assert.equal(badOwned.ok, false, 'the round name must keep its prefix');
});

test('a capture request without a capture mode still parses', async () => {
  const parsed = await parse(['0', 'C:\\temp\\wm-plain', '180', '30']);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  assert.equal(parsed.captureMode, 'disk', 'the legacy default mode is kept');
  assert.equal(parsed.durationSeconds, 180);
});

test('--initial-offscreen rides along with the window open request', () => {
  // The flag belongs to --we-open; used anywhere else it must be reported instead of
  // silently ignored, so a typo cannot look like a working off-screen start.
  const misused = spawnSync(probeExe, ['--window-ensure-closed', 'WhaleWallpaperProbe-self-test-absent', '2000', '--initial-offscreen'], { windowsHide: true, timeout: 30000, encoding: 'utf8' });
  assert.notEqual(misused.status, 0);
  assert.match(misused.stderr ?? '', /Unknown --window-ensure-closed option/);

  // On the open path it must be recognized: a missing project file is reported as such,
  // which proves the request reached the open handler rather than the usage error.
  const recognized = spawnSync(probeExe, ['--we-open', 'WhaleWallpaperProbe-self-test-absent', 'C:\\temp\\not-a-project.txt', '1280', '720', '--initial-offscreen'], { windowsHide: true, timeout: 30000, encoding: 'utf8' });
  assert.notEqual(recognized.status, 0);
  assert.doesNotMatch(recognized.stderr ?? '', /Usage: WallpaperProbe/);
  assert.match(recognized.stderr ?? '', /absolute \.json path/);
});

test('the bounded frame log keeps a long session small', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wm-frame-log-'));
  try {
    const result = spawnSync(probeExe, ['--self-test-frame-log', directory], { windowsHide: true, timeout: 30000, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.failed, 0, JSON.stringify(report.checks));
    assert.equal(report.total, 5000, 'every frame is counted');
    assert.ok(report.retained <= report.capacity, `retained ${report.retained} <= capacity ${report.capacity}`);
    assert.ok(report.bytes < 64 * 1024, `bounded file size, got ${report.bytes} bytes`);
    // The retention policy must be visible in the report, not only claimed in a comment.
    assert.equal(report.policy, 'dense-tail-plus-frame-sampling');
    assert.equal(report.sparseFrames.every(frame => frame % report.sampleEvery === 0), true, 'older frames are sampled by frame number');
    assert.equal(report.retainedFrames.slice(-report.denseTail).length, report.denseTail, 'the newest frames are kept one by one');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test.after(async () => { await rm(argDirectory, { recursive: true, force: true }); });
