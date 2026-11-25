import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {lstat,readFile} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AUTHOR_WE_EXE} from '../author-properties-apply.js';
import {SCENES} from '../scenes.js';
import {createFixedCanvasNative} from './fixed-canvas-native.mjs';
import {createFixedCanvasService} from './fixed-canvas-service.mjs';

// Fingerprints from the Lucy source used in the accepted crop trial.
const scene = {
  'project.json': [6340,'4e80b2729993f45b2b7b90ccbf2e7ffe502c530f0b43e7fe70520bd0b13f10bb'],
  'scene.pkg': [32773007,'232a16d4608b213fb719d2fa51384eadffa221a4440948cdd1acaea1edfa68a4'],
};

export function createPackagedFixedCanvas(wallpaper,readOwner,library) {
  const project = SCENES.lucy.project;
  const desktopImage = process.execPath;
  const executable = fileURLToPath(new URL('../../../assets/wallpaper/DailyFixedCanvas.exe',import.meta.url));
  if (process.platform!=='win32' || process.env.ELECTRON_RUN_AS_NODE!=='1' || process.env.WM_WALLPAPER_OFFSCREEN_START==='0' ||
      basename(desktopImage).toLowerCase()!=='deepseek harness.exe' || !existsSync(executable) ||
      !existsSync(AUTHOR_WE_EXE)) return null;
  const native = createFixedCanvasNative({executable,desktopPid:process.ppid,desktopImage,engineImage:AUTHOR_WE_EXE});
  return createFixedCanvasService({wallpaper,readOwner,native,library,async verifyBuiltin(signal) {
    for (const [name,[size,hash]] of Object.entries(scene)) {
      const file = join(dirname(project),name);
      const info = await lstat(file);
      if (!info.isFile() || info.size!==size) throw Error('fixed-canvas-scene-unavailable');
      const bytes = await readFile(file,{signal});
      if (createHash('sha256').update(bytes).digest('hex')!==hash) throw Error('fixed-canvas-scene-changed');
    }
  }});
}
