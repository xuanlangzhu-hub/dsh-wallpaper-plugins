import {win32 as path} from 'node:path';

function localPath(value) {
  const input = value?.trim() ?? '';
  if (!/^[a-z]:[\\/]/i.test(input) || /[:<>"|?*\x00-\x1f]/.test(input.slice(2))) return '';
  return path.normalize(input);
}

export function resolveSteamLibrary(env = process.env) {
  if (env.WM_STEAM_LIBRARY !== undefined) return localPath(env.WM_STEAM_LIBRARY);
  const programFiles = localPath(env['ProgramFiles(x86)'] ?? env.ProgramFiles);
  return programFiles ? path.join(programFiles, 'Steam') : '';
}

const steamLibrary = resolveSteamLibrary();
export const wallpaperLibraryRoot = steamLibrary
  ? path.join(steamLibrary, 'steamapps', 'workshop', 'content', '431960')
  : '';
export const wallpaperEngineImage = steamLibrary
  ? path.join(steamLibrary, 'steamapps', 'common', 'wallpaper_engine', 'wallpaper64.exe')
  : '';
export function workshopProject(id) {
  return wallpaperLibraryRoot ? path.join(wallpaperLibraryRoot, id, 'project.json') : '';
}
