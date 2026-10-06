import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const probeExe = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));
const missing = 'WhaleWallpaperProbe-self-test-absent';

function run(args) {
  const result = spawnSync(probeExe, args, { windowsHide: true, timeout: 30000, encoding: 'utf8' });
  return { code: result.status, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
}

// Regression: the extended --window-apply form (with --location/--pid) must be
// handled as a window action. When the argument count was checked exactly, these
// flags fell through to the capture usage error, so the Host's tuck silently
// failed and the source window stayed on screen.
test('extended --window-apply form is recognized, not treated as a capture run', () => {
  const extended = run(['--window-apply', '999', 'offscreen', '--location', missing, '--pid', '1234']);
  assert.notEqual(extended.code, 0);
  assert.doesNotMatch(extended.stderr, /Usage: WallpaperProbe/, 'must not fall through to the capture usage error');
  // Reaching the identity check is the proof that the window-action handler ran.
  assert.match(extended.stderr, /not a valid window/);

  const withNameOnly = run(['--window-apply', '999', 'offscreen', '--location', missing]);
  assert.notEqual(withNameOnly.code, 0);
  assert.doesNotMatch(withNameOnly.stderr, /Usage: WallpaperProbe/);
  assert.match(withNameOnly.stderr, /not a valid window/);

  const rejectedName = run(['--window-apply', '999', 'offscreen', '--location', 'SomeOtherWindow']);
  assert.notEqual(rejectedName.code, 0);
  // stderr carries the JSON-escaped envelope, so the quote appears as \u0027.
  assert.match(rejectedName.stderr, /must start with (?:'|\\u0027)WhaleWallpaperProbe-/);

  const rejectedOption = run(['--window-apply', '999', 'offscreen', '--bogus', 'x']);
  assert.notEqual(rejectedOption.code, 0);
  assert.match(rejectedOption.stderr, /Unknown --window-apply option/);
});

test('the bare legacy --window-apply form still refuses an invalid handle', () => {
  const bare = run(['--window-apply', '999', 'offscreen']);
  assert.notEqual(bare.code, 0);
  assert.match(bare.stderr, /not a valid window/);
});

test('ensure-closed accepts the optional expected pid and reports camelCase results', () => {
  const absent = run(['--window-ensure-closed', missing, '3000']);
  assert.equal(absent.code, 0, absent.stderr);
  const result = JSON.parse(absent.stdout);
  assert.equal(result.outcome, 'absent');
  assert.equal(result.closed, true);
  assert.equal(result.safeToCleanUp, true);

  const rejected = run(['--window-ensure-closed', missing, '3000', '--bogus', '1']);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Unknown --window-ensure-closed option/);
});
