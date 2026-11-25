import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {resolveSteamLibrary} from './package/src/wallpaper/steam-library.js';

const probe = fileURLToPath(new URL('./package/assets/wallpaper/WallpaperProbe.exe', import.meta.url));
const index = new URL('./package/src/index.js', import.meta.url).href;
const config = new URL('./package/src/wallpaper/native-config.js', import.meta.url).href;
const scenes = new URL('./package/src/wallpaper/scenes.js', import.meta.url).href;
const author = new URL('./package/src/wallpaper/author-properties-apply.js', import.meta.url).href;

test('Steam library uses the Windows install directory and rejects ambiguous paths', () => {
  assert.equal(resolveSteamLibrary({'ProgramFiles(x86)': 'Z:\\Apps x86', ProgramFiles: 'X:\\Apps'}), 'Z:\\Apps x86\\Steam');
  assert.equal(resolveSteamLibrary({ProgramFiles: 'X:\\Apps'}), 'X:\\Apps\\Steam');
  for (const root of ['X:relative', 'relative', '\\\\server\\share', '\\\\?\\Z:\\Steam', 'G:\\bad"root', '']) {
    assert.equal(resolveSteamLibrary({WM_STEAM_LIBRARY: root, ProgramFiles: 'X:\\Apps'}), '');
  }
});

test('Host library, Lucy, author parameters, follow and native playback share one configured path',
     {skip: process.platform !== 'win32'}, () => {
  const env = {...process.env, WM_STEAM_LIBRARY: 'Z:/Wallpaper Library'};
  const executable = 'Z:\\Wallpaper Library\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe';
  const workshop = 'Z:\\Wallpaper Library\\steamapps\\workshop\\content\\431960';
  const program = [
    'import assert from "node:assert/strict";',
    'import {WALLPAPER_LIBRARY_ROOTS as roots} from ' + JSON.stringify(index) + ';',
    'import {SCENES} from ' + JSON.stringify(scenes) + ';',
    'import {AUTHOR_WE_EXE as authorImage} from ' + JSON.stringify(author) + ';',
    'import {readPackagedFollowConfig} from ' + JSON.stringify(config) + ';',
    'assert.deepEqual(roots, [' + JSON.stringify(workshop) + ']);',
    'assert.equal(SCENES.lucy.project, ' + JSON.stringify(workshop + '\\3521337568\\project.json') + ');',
    'assert.equal(authorImage, ' + JSON.stringify(executable) + ');',
    'assert.equal(readPackagedFollowConfig().image.path, authorImage);',
  ].join('\n');
  const host = spawnSync(process.execPath, ['--input-type=module', '-e', program], {env, encoding: 'utf8', timeout: 6000});
  assert.equal(host.status, 0, host.stderr);
  const native = spawnSync(probe, ['--resolve-wallpaper-engine'], {env, encoding: 'utf8', windowsHide: true, timeout: 6000});
  assert.equal(native.status, 0, native.stderr);
  assert.equal(JSON.parse(native.stdout).image, executable);
  const invalid = spawnSync(probe, ['--resolve-wallpaper-engine'], {
    env: {...env, WM_STEAM_LIBRARY: 'Z:relative'}, encoding: 'utf8', windowsHide: true, timeout: 6000,
  });
  assert.equal(invalid.status, 1, invalid.stderr);
});

test('Windows x64 public metadata uses the package allowlist and has no lifecycle scripts', async () => {
  const manifest = JSON.parse(await readFile(new URL('./package/package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.os, ['win32']);
  assert.deepEqual(manifest.cpu, ['x64']);
  assert.equal(manifest.version, '0.6.1');
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.files.length, 93);
  assert.ok(manifest.files.every(name => !name.includes('/fixture/') && !name.endsWith('.pdb')));
});
