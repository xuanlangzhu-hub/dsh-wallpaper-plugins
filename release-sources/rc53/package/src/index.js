import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerWallpaperRoutes, resolveHostResources, describeScenes, probeAvailability } from './wallpaper/session.js';
import {createAuthorApplyAdapter} from './wallpaper/author-properties-apply.js';
import { createWallpaperLibrary } from './wallpaper/library.js';
import { createDetachableHttpHost } from './detachable-host.js';
import { createEdgeWindowAdapter } from './detachable-edge-adapter.js';

/**
 * The only library roots this Host will read. They are explicit absolutes configured here, never a
 * request value and never a disk search. A machine without the Steam library simply gets an empty,
 * clearly-reported list instead of a scan of unrelated directories.
 */
export const WALLPAPER_LIBRARY_ROOTS = Object.freeze([
  'E:\\SteamLibrary\\steamapps\\workshop\\content\\431960',
]);

/**
 * Host service dependencies. Cordis refuses to read an undeclared service
 * (`cannot get property "webServer" without inject`), so this must be exported next
 * to `apply`; the loader reads it from the module. Keeping the declaration exact means
 * the wallpaper preview is composed only when the web server carrier is present, and
 * the icon helper still works everywhere else.
 */
export const inject = ['webServer'];

/** Themes remain browser-only outside the official Windows desktop Host. */
export function apply(ctx) {
  // Contract tests compose this module inside a real Cordis context to check the
  // service declaration and the routes. That must never touch the running desktop:
  // the flag keeps the icon helper and any window work out of the check.
  const isolated = process.env.WM_CONTRACT_ISOLATED === '1';
  const executable = process.execPath;
  // Wallpaper Engine library instance shared across Wallpaper Host and Detachable Host
  let library = null;
  try {
    library = createWallpaperLibrary({ roots: WALLPAPER_LIBRARY_ROOTS });
  } catch (err) {
    console.warn('[Whale wallpaper] library initialization degraded:', err.message);
  }

  // Desktop's Host gets ELECTRON_RUN_AS_NODE; DSH_DESKTOP_NODE_EXECUTABLE is
  // only supplied to package-manager children, not to the running Host.
  if (isolated) {
    const wallpaper = registerWallpaper(ctx, { library });
    registerDetachableHost(ctx, { library, wallpaper });
    return;
  }
  if (process.platform !== 'win32' || process.env.ELECTRON_RUN_AS_NODE !== '1' ||
      basename(executable).toLowerCase() !== 'deepseek harness.exe' || !process.env.LOCALAPPDATA) return;

  const root = dirname(fileURLToPath(import.meta.url));
  const icon = resolve(root, '../assets/DeepSeek-Harness.ico');
  const helper = resolve(root, '../assets/whale-icon-helper.exe');
  const statusDirectory = join(process.env.LOCALAPPDATA, 'Whale Appearance');
  const child = spawn(helper, [String(process.ppid), executable, icon, statusDirectory], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let disposed = false;
  let output = '';
  child.stdin.on('error', () => {});
  child.on('error', error => console.warn('[Whale desktop icon]', error.message));
  child.stderr.on('data', data => console.warn('[Whale desktop icon]', String(data).trim()));
  child.stdout.on('data', data => {
    output += data;
    let newline;
    while ((newline = output.indexOf('\n')) !== -1) {
      const line = output.slice(0, newline).trim();
      output = output.slice(newline + 1);
      const match = /^applied:(\d+)$/.exec(line);
      if (!match || disposed) continue;
      const status = {
        pid: process.ppid,
        executable,
        icon,
        windowHandle: match[1],
        appUserModelId: 'com.deepseek.dsh',
        verified: true,
        appliedAt: new Date().toISOString(),
      };
      mkdir(statusDirectory, { recursive: true })
        .then(() => writeFile(join(statusDirectory, 'runtime-icon-status.json'), JSON.stringify(status, null, 2)))
        .catch(error => console.warn('[Whale desktop icon]', error.message));
    }
  });
  ctx.on('dispose', () => {
    disposed = true;
    // EOF asks the helper to restore the original window properties and icons.
    child.stdin.end();
  });

  // Wallpaper Engine playback. `inject` above guarantees the carrier is composed before
  // this runs; the packaged helper and the local sample can still be missing, and that
  // must only disable the wallpaper, never the appearance or the icon.
  const wallpaper = registerWallpaper(ctx, { library });

  // Detachable appearance companion host and protected bootstrap
  registerDetachableHost(ctx, { library, wallpaper });
}

/** Registers the constrained wallpaper routes; failures only disable the wallpaper. */
function registerWallpaper(ctx, { library = null } = {}) {
  try {
    const resources = resolveHostResources();
    const availability = probeAvailability({ helper: resources.helper });
    if (!availability.available) {
      console.warn('[Whale wallpaper] playback unavailable:', availability.reason,
        `scenes: ${describeScenes().filter(scene => scene.available).map(scene => scene.id).join(', ') || 'none'}`);
    }
    // The library is built here so the approved roots come from Host configuration and the routes
    // only ever see ids. An unusable root is reported by the list itself, not by throwing: the
    // appearance UI and the verified sample must keep working.
    const activeLibrary = library || createWallpaperLibrary({ roots: WALLPAPER_LIBRARY_ROOTS });
    return registerWallpaperRoutes(ctx, { ...resources, library: activeLibrary });
  } catch (error) {
    console.warn('[Whale wallpaper] setup failed:', error.message);
  }
}

export function createWallpaperReadTarget(wallpaper) {
  return () => {
    const session = wallpaper?.currentSession?.();
    const state = session?.state?.();
    if (!state || wallpaper?.ownership?.()) return null;
    return {
      wallpaperId: state.config?.sceneId,
      generation: wallpaper.generation(),
      location: state.location,
      hwnd: state.config?.window,
      pid: state.windowPid,
      startUtc: state.windowStartUtc,
      helper: state.config?.helper,
      stopping: state.stopRequested,
      captureStarted: state.captureStarted,
      session
    };
  };
}

export function createWallpaperReadLifecycle(wallpaper) {
  return () => {
    const state = wallpaper?.currentSession?.()?.state?.();
    const status = wallpaper?.statusPayload?.() ?? {};
    return {
      generation: wallpaper?.generation?.() ?? 0,
      activeSceneId: status.activeSceneId ?? null,
      location: state?.location ?? null,
      busy: Boolean(wallpaper?.ownership?.()),
      cleanupPending: Boolean(state?.stopRequested || status.failed)
    };
  };
}

/**
 * Registers the detachable appearance companion host, index bootstrap injection,
 * and authenticated bootstrap route. Failures never affect wallpaper or icon helper.
 */
function registerDetachableHost(ctx, { library = null, wallpaper = null } = {}) {
  try {
    const isWindows = process.platform === 'win32';
    const isolated = process.env.WM_CONTRACT_ISOLATED === '1';
    const windowAdapter = (!isolated && isWindows) ? createEdgeWindowAdapter() : null;
    const desktopOrigin = (ctx.webServer?.protocol && ctx.webServer?.host)
      ? `${ctx.webServer.protocol}//${ctx.webServer.host}${ctx.webServer.port ? `:${ctx.webServer.port}` : ''}`
      : null;
    const allowedOrigins = ['dsh-app://app', desktopOrigin].filter(Boolean);
    const host = createDetachableHttpHost({
      library,
      authorApplyAdapter: wallpaper && !isolated ? createAuthorApplyAdapter({readTarget: createWallpaperReadTarget(wallpaper)}) : null,
      readWallpaperLifecycle: wallpaper ? createWallpaperReadLifecycle(wallpaper) : null,
      windowAdapter,
      allowedOrigins,
      mainAllowedOrigins: allowedOrigins,
    });

    let disposed = false;
    const startPromise = host.start().catch((err) => {
      console.warn('[Whale detachable host] start failed:', err.message);
      return null;
    });

    ctx.on?.('webserver/index-inject', (table) => {
      if (disposed) return;
      const port = host.getPort();
      if (port) {
        // Expose only port to index table; credentials must be retrieved via authenticated bootstrap route
        table.push({
          kind: 'global',
          name: '__WHALE_DETACHABLE_BOOT__',
          value: { port },
        });
      }
    });

    let disposeRoute = null;
    if (ctx.webServer && typeof ctx.webServer.register === 'function') {
      try {
        disposeRoute = ctx.webServer.register({
          kind: 'exact',
          path: '/whale-appearance/bootstrap',
          handler: async (req, res) => {
            if (disposed) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'host-disposed' }));
              return;
            }

            // Fail-closed authentication using official Cordis HostConnectionService
            const connection = typeof ctx.get === 'function' ? ctx.get('connection') : null;
            let authed = false;
            let rejectStatus = 401;

            if (connection) {
              if (typeof connection.requestRejection === 'function') {
                const rej = connection.requestRejection(req);
                if (rej === undefined) {
                  authed = true;
                } else {
                  rejectStatus = rej;
                }
              } else if (typeof connection.admit === 'function') {
                const adm = connection.admit(req);
                if (adm && !adm.rejection) {
                  authed = true;
                } else if (adm?.rejection) {
                  rejectStatus = adm.rejection;
                }
              } else if (typeof connection.isAuthenticated === 'function') {
                const secure = ctx.webServer?.protocol === 'https:';
                if (connection.isAuthenticated(req, secure)) {
                  authed = true;
                }
              }
            }

            if (!authed) {
              res.writeHead(rejectStatus, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
              });
              res.end(JSON.stringify({ ok: false, error: rejectStatus === 403 ? 'forbidden' : 'unauthorized' }));
              return;
            }

            const port = host.getPort();
            const mainToken = host.getMainToken();
            if (!port || !mainToken) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'detachable-host-not-ready' }));
              return;
            }
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'Referrer-Policy': 'no-referrer',
            });
            res.end(JSON.stringify({ ok: true, port, mainToken }));
          },
        });
      } catch (err) {
        console.warn('[Whale detachable host] bootstrap route registration failed:', err.message);
      }
    }

    let cleanupPromise = null;
    const cleanup = () => {
      if (cleanupPromise) return cleanupPromise;
      disposed = true;
      const promise = (async () => {
        if (typeof disposeRoute === 'function') {
          try { disposeRoute(); } catch {}
        }
        try {
          await startPromise;
        } catch {}
        try {
          const res = await host.stop();
          if (res && res.ok === false) {
            console.warn('[Whale detachable host] stop unconfirmed cleanup:', res.error);
            cleanupPromise = null; // allow bounded retry on unconfirmed cleanup
            return res;
          }
          return res || { ok: true };
        } catch (err) {
          console.warn('[Whale detachable host] stop error:', err.message);
          cleanupPromise = null; // allow bounded retry on failure
          throw err;
        }
      })();
      cleanupPromise = promise;
      return promise;
    };

    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => cleanup());
    }
    ctx.on?.('dispose', () => cleanup());

    return host;
  } catch (error) {
    console.warn('[Whale detachable host] setup failed:', error.message);
    return null;
  }
}
