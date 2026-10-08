// Synthetic regression for the output-boundary rules, with assertions and a non-zero exit on failure.
//
// Every case states its expected outcome: the junction cases must be refused, the normal cases must
// work, and the unique-directory rules must hold even with the clock frozen. A setup or cleanup step
// that cannot run is a failure, not a skipped test.
//
// Only directories created by this test are touched, and the junction it creates is removed before the
// test cleans up. No browser, no workspace data, no user files.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, lstat, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfile, removeProfile, createRunDirectory, evidencePath, verifyPersisted, ownedProfiles } from './temp-profile.mjs';

const results = [];
const pass = (label, detail = '') => { results.push({ label, ok: true }); console.log(`PASS ${label}${detail ? ' :: ' + detail : ''}`); };
const fail = (label, error) => { results.push({ label, ok: false, error: String(error && error.message || error) }); console.log(`FAIL ${label} :: ${error && error.message || error}`); };

/** Runs `action` and asserts it is refused with a message mentioning `expected`. */
async function expectRefused(label, expected, action) {
  let outcome = null;
  try {
    await action();
    outcome = 'accepted';
  } catch (error) {
    const message = String(error && error.message || error);
    if (!message.includes(expected)) { fail(label, `refused, but the reason did not mention "${expected}": ${message}`); return; }
    pass(label, 'refused');
    return;
  }
  fail(label, `expected a refusal mentioning "${expected}", but it was ${outcome}`);
}

const state = { profile: null, junctions: [], directories: [], restore: [
  ['WM_PIXEL_OUTPUT', process.env.WM_PIXEL_OUTPUT], ['WM_RUN_DIR', process.env.WM_RUN_DIR], ['__clock__', Date.now],
] };
delete process.env.WM_PIXEL_OUTPUT;
delete process.env.WM_RUN_DIR;
const scratchRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp');
await mkdir(scratchRoot, {recursive: true});
const cleanupRoots = [await realpath(tmpdir()), await realpath(scratchRoot)];

try {
  // ---- T3: a junction inside the evidence folder that points at the profile -----------------------
  state.profile = await createProfile('t3-profile-');
  const evidenceRoot = await mkdtemp(join(await realpath(tmpdir()), 't3-evidence-'));
  state.directories.push(evidenceRoot);
  const junction = join(evidenceRoot, 'link-to-profile');
  const created = spawnSync('cmd', ['/c', 'mklink', '/J', junction, state.profile], { encoding: 'utf8', windowsHide: true });
  assert.equal(created.status, 0, `creating the junction failed: ${(created.stdout || created.stderr || '').trim()}`);
  state.junctions.push(junction);
  pass('junction created', junction);

  const throughJunction = join(junction, 'result.json');
  process.env.WM_PIXEL_OUTPUT = join(state.profile, 'direct.json');
  await expectRefused('output written straight into the profile is refused', 'inside the browser profile',
    () => evidencePath('WM_PIXEL_OUTPUT', evidenceRoot, 'result.json'));
  process.env.WM_PIXEL_OUTPUT = throughJunction;
  await expectRefused('output through a junction into the profile is refused', 'inside the browser profile',
    () => evidencePath('WM_PIXEL_OUTPUT', evidenceRoot, 'result.json'));
  delete process.env.WM_PIXEL_OUTPUT;
  await expectRefused('a junction path with a suffix that does not exist yet is refused', 'resolves to',
    () => verifyPersisted(join(junction, 'new', 'nested', 'report.json')));
  await writeFile(join(state.profile, 'already.json'), '{}');
  await expectRefused('a junction path to an existing file is refused', 'inside the browser profile',
    () => verifyPersisted(join(junction, 'already.json')));

  // ---- T4: unique run directories on both branches ------------------------------------------------
  const defaultOne = await createRunDirectory('dup-label');
  const defaultTwo = await createRunDirectory('dup-label');
  state.directories.push(defaultOne, defaultTwo);
  assert.notEqual(defaultOne, defaultTwo, 'the default branch returned the same directory twice');
  pass('default branch allocates a unique directory');

  const customBase = await mkdtemp(join(await realpath(tmpdir()), 't4-base-'));
  state.directories.push(customBase);
  process.env.WM_RUN_DIR = customBase;
  const customOne = await createRunDirectory('dup-label');
  const customTwo = await createRunDirectory('dup-label');
  state.directories.push(customOne, customTwo);
  assert.notEqual(customOne, customTwo, 'the custom branch returned the same directory twice');
  assert.ok(customOne.startsWith(customBase) && customTwo.startsWith(customBase), 'custom entries must live under the requested base');
  pass('custom branch allocates unique directories under the requested base');

  // Freezing the clock is what made the old branch collide.
  const realNow = Date.now;
  Date.now = () => 1791455773000;
  const frozenOne = await createRunDirectory('frozen');
  const frozenTwo = await createRunDirectory('frozen');
  Date.now = realNow;
  state.directories.push(frozenOne, frozenTwo);
  assert.notEqual(frozenOne, frozenTwo, 'with the clock frozen the two directories were identical');
  pass('custom branch stays unique with the clock frozen');

  process.env.WM_RUN_DIR = join(state.profile, 'reports');
  await expectRefused('a custom run base inside the profile is refused', 'inside the browser profile',
    () => createRunDirectory('inside'));
  delete process.env.WM_RUN_DIR;

  // ---- Normal paths still work -------------------------------------------------------------------
  const normalBase = await mkdtemp(join(await realpath(tmpdir()), 't3-normal-'));
  state.directories.push(normalBase);
  process.env.WM_PIXEL_OUTPUT = join(normalBase, 'nested', 'report.json');
  const honoured = await evidencePath('WM_PIXEL_OUTPUT', defaultOne, 'result.json');
  delete process.env.WM_PIXEL_OUTPUT;
  await writeFile(honoured, JSON.stringify({ ok: true }));
  assert.ok(honoured.includes('t3-normal-'), `the override was not honoured: ${honoured}`);
  assert.ok((await verifyPersisted(honoured)).bytes > 0, 'the override report is not readable');
  pass('an override outside the profile is honoured and verified');

  const defaultReport = await evidencePath('WM_LAYOUT_OUTPUT', defaultOne, 'layout.json');
  await writeFile(defaultReport, JSON.stringify({ ok: true }));
  assert.ok((await verifyPersisted(defaultReport)).bytes > 0, 'the default report is not readable');
  for (const junction of state.junctions) {
    const removed = spawnSync('cmd', ['/c', 'rmdir', junction], {windowsHide: true});
    assert.equal(removed.status, 0, 'release owned junction before profile cleanup');
  }
  state.junctions.length = 0;
  await removeProfile(state.profile);
  state.profile = null;
  assert.equal(await exists(defaultReport), true, 'the default report disappeared with the profile');
  assert.equal(ownedProfiles().length, 0, 'the ownership registry was not cleared');
  pass('default evidence survives profile cleanup');
} catch (error) {
  fail('test body', error);
} finally {
  // Release the junction before removing anything it points at, restore the environment, then clean up
  // exactly the directories this test created.
  for (const junction of state.junctions) {
    const removed = spawnSync('cmd', ['/c', 'rmdir', junction], { windowsHide: true });
    if (removed.status !== 0) fail(`releasing junction ${junction}`, removed.stderr || `exit ${removed.status}`);
  }
  for (const [name, value] of state.restore) {
    if (name === '__clock__') Date.now = value;
    else if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (state.profile) { try { await removeProfile(state.profile); } catch (error) { fail('cleaning the profile', error); } }
  for (const directory of state.directories.slice().reverse()) {
    try {
      if (!await exists(directory)) continue;
      assert.ok(!(await lstat(directory)).isSymbolicLink(), 'refuse cleanup through a directory link');
      const physical = await realpath(directory);
      assert.ok(cleanupRoots.some(root => { const child = relative(root, physical); return child !== '' && !child.startsWith('..') && !isAbsolute(child); }), `cleanup target outside synthetic roots: ${physical}`);
      await rm(physical, { recursive: true, force: true });
    } catch (error) { fail(`cleaning ${directory}`, error); }
  }
}

async function exists(path) {
  try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

const failed = results.filter(entry => !entry.ok);
console.log(`boundary regression: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) { console.log(JSON.stringify(failed, null, 1)); process.exitCode = 1; }
