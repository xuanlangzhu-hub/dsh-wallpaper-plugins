// Local, machine-checked validation for the supervised managed-window mode.
// The Host creates and closes the wallpaper window itself, so every value that
// reaches a helper command line is validated here first: the location must be
// this round's unique window name, and the sample must be an absolute .json
// project path. Nothing in this file reads the network or the environment.

export const LOCATION_PREFIX = 'WhaleWallpaperProbe-';
const MAX_LOCATION = 120;
const MAX_FILE = 400;

const FORBIDDEN_LOCATION = new Set(['"', '\\', '/', ';', '&', '|', '^', '%']);

export function validateLocation(value) {
  const location = typeof value === 'string' ? value.trim() : '';
  if (!location) throw new Error('window location is required');
  if (location.length > MAX_LOCATION) throw new Error(`window location must be at most ${MAX_LOCATION} characters`);
  if (!location.startsWith(LOCATION_PREFIX)) throw new Error(`window location must start with ${LOCATION_PREFIX}`);
  for (const character of location) {
    const code = character.codePointAt(0);
    if (code < 0x21 || code > 0x7e || FORBIDDEN_LOCATION.has(character))
      throw new Error(`window location contains unsupported character 0x${code.toString(16)}`);
  }
  return location;
}

export function validateProjectFile(value) {
  const file = typeof value === 'string' ? value.trim() : '';
  if (!file) throw new Error('wallpaper project file is required');
  if (file.length > MAX_FILE) throw new Error(`wallpaper project file must be at most ${MAX_FILE} characters`);
  if (!/^[a-zA-Z]:[\\/]/.test(file) && !file.startsWith('\\\\')) throw new Error('wallpaper project file must be an absolute path');
  if (!file.toLowerCase().endsWith('.json')) throw new Error('wallpaper project file must be a .json path');
  if (/[";]/.test(file)) throw new Error('wallpaper project file contains unsupported characters');
  return file;
}

export function validateSize(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 160 || value > 7680) throw new Error('window size is out of range');
  return value;
}

/** Round-unique window name; never reuses a previous round's name. */
export function newLocation(now = Date.now(), random = Math.random()) {
  const stamp = new Date(now).toISOString().replace(/[-:TZ.]/g, '').slice(2, 14);
  const suffix = Math.floor(random * 0x10000).toString(16).padStart(4, '0');
  return validateLocation(`${LOCATION_PREFIX}${stamp}-${suffix}`);
}

/** One helper invocation, resolved with its parsed stdout or a bounded error. */
export function runHelper(spawnImpl, helper, args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(helper, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } finish(new Error(`${args[0]} timed out after ${timeoutMs} ms`)); }, timeoutMs);
    child.on('error', error => finish(error));
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
    child.on('close', code => {
      const text = stdout.trim();
      if (code === 0 && text) {
        try { finish(null, JSON.parse(text)); return; } catch { finish(new Error(`${args[0]} returned unreadable output: ${text.slice(0, 200)}`)); return; }
      }
      const reason = stderr.trim().split('\n').filter(Boolean).pop() ?? '';
      finish(new Error(`${args[0]} exited ${code}${reason ? `: ${reason.slice(0, 300)}` : ''}`));
    });
  });
}

export const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Poll until exactly one window with this round's name exists. A window can be
 * created by the helper slightly before or after its process exits, so the wait
 * runs a fast grace poll first and only then falls back to slow polling.
 * Returns null when nothing appeared within the bounded attempts.
 */
export async function waitForWindow(runHelperFn, location, {
  fastAttempts = 40, fastDelayMs = 100,
  attempts = 400, delayMs = 100,
  graceAttempts = 0, graceDelayMs = 250,
  sleep = defaultSleep,
} = {}) {
  const total = fastAttempts + graceAttempts + attempts;
  for (let attempt = 0; attempt < total; attempt++) {
    const found = await runHelperFn(['--window-find']).catch(() => []);
    const matches = (found ?? []).filter(window => window.title === location);
    if (matches.length === 1) return normalizeWindow(matches[0]);
    if (matches.length > 1) throw new Error(`${matches.length} windows named ${location}; refusing an ambiguous session`);
    const delay = attempt < fastAttempts ? fastDelayMs : attempt < fastAttempts + graceAttempts ? graceDelayMs : delayMs;
    await sleep(delay);
  }
  return null;
}

/**
 * One shape for window records regardless of the helper's field naming, so the
 * lifecycle never depends on a serialization detail.
 */
export function normalizeWindow(window) {
  if (!window || typeof window !== 'object') throw new Error('window record is missing');
  const hwnd = window.hwnd ?? window.Hwnd;
  const pid = window.pid ?? window.Pid;
  const title = window.title ?? window.Title;
  if (!Number.isInteger(hwnd) || hwnd <= 0) throw new Error(`window record has no usable handle: ${JSON.stringify(window)}`);
  return { hwnd, pid: typeof pid === 'number' ? pid : null, title,
    visible: window.visible ?? window.Visible ?? null, left: window.left ?? window.Left ?? null, top: window.top ?? window.Top ?? null };
}
