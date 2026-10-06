import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ProbeJournal, parseLogLine, describeLog } from '../probe-log.js';

const probeExe = fileURLToPath(new URL('../../wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe', import.meta.url));

test('a successful [Desktop] diagnostic is informational, not a capture failure', () => {
  const journal = new ProbeJournal();
  const added = journal.push('[Desktop] OpenDesktop: 752, SetThreadDesktop: True, err: 0\n');
  assert.equal(added[0].level, 'info');
  assert.equal(added[0].scope, 'Desktop');
  assert.equal(journal.firstError, null);
  assert.equal(journal.errorCount, 0);
  assert.equal(journal.snapshot().messages[0], '[Desktop] OpenDesktop: 752, SetThreadDesktop: True, err: 0');
});

test('a capture recovery notice is a warning, not a failure', () => {
  const journal = new ProbeJournal();
  journal.push('[Capture] Target 0x00010A0C returned 0x80070005, recovered using child 0x00010A10\n');
  assert.equal(journal.snapshot().count, 1);
  assert.equal(journal.errorCount, 0);
  assert.equal(journal.firstError, null);
});

test('structured log envelopes classify by level and survive split chunks', () => {
  const journal = new ProbeJournal();
  const line = JSON.stringify({ kind: 'log', level: 'error', scope: 'Capture', message: 'WGC not supported.' }) + '\n';
  const first = journal.push(line.slice(0, 17));
  const rest = journal.push(line.slice(17));
  assert.deepEqual(first, []);
  assert.equal(rest.length, 1);
  assert.equal(journal.firstError, '[Capture] WGC not supported.');
  assert.equal(rest[0].scope, 'Capture');
});

test('a status envelope keeps capture metrics, and unknown levels degrade to info', () => {
  const journal = new ProbeJournal();
  const status = { frames: 12, changed: 12, seconds: 1.001, visible: false };
  journal.push(JSON.stringify({ kind: 'log', level: 'info', scope: 'Status', message: JSON.stringify(status) }) + '\n');
  journal.push(JSON.stringify({ kind: 'log', level: 'verbose', message: 'unknown level' }) + '\n');
  assert.equal(journal.snapshot().count, 2);
  assert.equal(journal.errorCount, 0);
  assert.deepEqual(JSON.parse(journal.snapshot().messages[0].replace(/^\[Status\] /, '')), status);
  assert.equal(parseLogLine(JSON.stringify({ kind: 'log', level: 'verbose', message: 'x' })).level, 'info');
});

test('unreadable stderr text and malformed envelopes are still bounded failures', () => {
  assert.equal(parseLogLine('Unhandled exception. System.IO.IOException').level, 'error');
  assert.equal(parseLogLine('{not json}').level, 'error');
  assert.equal(parseLogLine('{"kind":"log","level":"error"}').level, 'error');
  assert.equal(parseLogLine('   \n'), null);
  const journal = new ProbeJournal(2);
  for (const text of ['one', 'two', 'three']) journal.push(`${text}\n`);
  assert.equal(journal.snapshot().count, 2);
  assert.equal(journal.snapshot().messages.at(-1), 'three');
});

test('plain JSON diagnostics from the helper stay informational', () => {
  // The probe echoes its own JSON diagnostics on stderr (device, start banner).
  const device = parseLogLine('{"adapter":"NVIDIA GeForce RTX 4060 Laptop GPU","luid":"105629","vendorId":4318}');
  assert.equal(device.level, 'info');
  assert.equal(device.scope, 'Status');
  const journal = new ProbeJournal();
  journal.push('{"started":true,"pid":33272,"hwnd":1377978,"fps":30,"mode":"pipe"}\n');
  assert.equal(journal.errorCount, 0);
  assert.equal(journal.firstError, null);
  assert.equal(journal.failureText(journal.entries[0]).length <= 301, true);
});

test('journal is bounded and reports the first error only', () => {
  const journal = new ProbeJournal(3);
  journal.push('{"kind":"log","level":"error","message":"first"}\n');
  journal.push('{"kind":"log","level":"error","message":"second"}\n');
  for (let index = 0; index < 50; index++) journal.push(`{"kind":"log","level":"info","message":"m${index}"}\n`);
  assert.equal(journal.errorCount, 2);
  assert.equal(journal.firstError, 'first');
  assert.equal(journal.snapshot().count, 3);
  assert.equal(journal.snapshot().last, 'm49');
});

test('no trailing newline still yields the final diagnostic on finish', () => {
  const journal = new ProbeJournal();
  journal.push('{"kind":"log","level":"warn","message":"no newline"}');
  assert.equal(journal.snapshot().count, 0);
  assert.equal(journal.finish().length, 1);
  assert.equal(journal.snapshot().count, 1);
});

test('the native helper reports failures as JSON error envelopes', () => {
  const result = spawnSync(probeExe, ['999', 'F:\\deepseekharness\\.tmp\\does-not-exist', '1', '5', 'pipe'], { windowsHide: true, timeout: 20000, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'an invalid target must fail');
  const lines = (result.stderr ?? '').trim().split('\n').filter(Boolean);
  assert.ok(lines.length >= 2, `expected diagnostics, got: ${JSON.stringify(result.stderr)}`);
  const parsed = lines.map(parseLogLine);
  // The failure may span several entries (type, message, stack), but every
  // trailing entry is an explicit error envelope.
  assert.equal(parsed.at(-1).level, 'error', `last line must be the failure envelope: ${lines.at(-1)}`);
  for (const entry of parsed.slice(0, 1)) assert.notEqual(entry.level, 'error', `premature failure line: ${describeLog(entry)}`);
  const journal = new ProbeJournal();
  journal.push(`${lines.join('\n')}\n`);
  assert.match(journal.snapshot().firstError, /Target HWND|not a valid window/i);
  assert.match(journal.snapshot().last, /\[Probe\]/);
});
