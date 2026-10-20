// Host-only bounded wallpaper library: one cached catalogue snapshot, an explicit refresh and the
// only place a browser-supplied id can become a project file.
//
// The snapshot is an index. Every playback request re-verifies the selected record against the
// approved roots and the filesystem, so a deleted project, a changed type or a junction swapped in
// after the scan is refused instead of being trusted because it was true once.
import { statSync, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { scanWallpaperCatalog, publicCatalogItem, verifyCatalogEntry, verifyCatalogPreview, verifyCatalogItemRating, boundFile, isCatalogId } from './catalog.js';
import { SCENES, isSceneId } from './scenes.js';

/** The one scene with a supervised real-window acceptance behind it. */
export const VERIFIED_SCENES = Object.freeze(Object.fromEntries(
  Object.values(SCENES).filter(scene => scene.playbackVerified === true).map(scene => [scene.id, scene]),
));

/** How many refreshes may run at once: a second one joins the first instead of queueing a scan. */
export const LIBRARY_REFRESH_POLICY = 'coalesced';

/**
 * Build the Host library. `roots` must be explicitly approved absolute directories; nothing here
 * searches the disk or accepts a directory from a request.
 */
export function createWallpaperLibrary({ roots = [], scan = scanWallpaperCatalog, verify = verifyCatalogEntry, limits = {}, exists = existsSync, now = Date.now, warn = () => {} } = {}) {
  const approvedRoots = Object.freeze([...roots]);
  const subscribers = new Set();
  let snapshot = null;          // { items, byId, warnings, truncated, stats, refreshedAt, scanMs }
  let refreshing = null;        // the in-flight refresh; concurrent callers join it
  let sequence = 0;
  let lastError = null;

  const libraryWarning = reason => {
    if (reason === 'root_unavailable' || reason === 'not_directory' || reason === 'link_refused') return reason;
    if (reason === 'unsafe_path') return 'unsafe_path';
    return 'root_unavailable';
  };

  /** Health of the list, shaped for the UI: no paths, no private reasons. */
  const health = () => {
    if (!snapshot) {
      return {
        state: lastError ? 'failed' : 'idle',
        rootsConfigured: approvedRoots.length,
        rootsAvailable: 0,
        truncated: false,
        scannedAt: null,
        scanMs: null,
        items: 0,
        error: lastError ? String(lastError.message ?? lastError) : null,
      };
    }
    return {
      state: 'ready',
      rootsConfigured: approvedRoots.length,
      rootsAvailable: snapshot.roots.filter(root => root.available === true).length,
      truncated: snapshot.truncated === true,
      scannedAt: new Date(snapshot.refreshedAt).toISOString(),
      scanMs: snapshot.scanMs,
      items: snapshot.items.length,
      // A configured root that does not exist is reported as a warning, never as an empty library
      // that looks like "you own no wallpapers".
      rootWarnings: snapshot.roots.filter(root => root.available !== true).map(root => ({ reason: libraryWarning(root.reason) })),
      error: null,
    };
  };

  const publicItems = () => (snapshot ? snapshot.items.map(publicCatalogItem) : []);
  const hasSnapshot = () => snapshot !== null;
  const publicEntry = id => {
    if (id === 'lucy') {
      return {
        id: 'lucy',
        title: 'Lucy',
        type: 'scene',
        contentRating: 'Everyone',
        available: true,
        reason: null,
        warnings: [],
        playbackVerified: true,
        previewRef: { wallpaperId: 'lucy', kind: 'preview' },
      };
    }
    const item = snapshot?.byId.get(id);
    if (!item) return null;
    const published = publicCatalogItem(item);
    return { ...published, playbackVerified: VERIFIED_SCENES[id]?.playbackVerified === true || published.playbackVerified === true };
  };
  const isVerified = id => VERIFIED_SCENES[id] !== undefined;

  /** True when the id is one this Host could resolve: the sample or a well-formed catalogue id. */
  const knows = id => isSceneId(id);

  function scanOnce() {
    const started = now();
    return scan({ roots: [...approvedRoots], limits }).then(result => {
      const byId = new Map();
      for (const item of result.items) byId.set(item.id, item);
      // The swap is atomic: readers keep the previous snapshot until this one is complete.
      snapshot = { items: result.items, byId, roots: result.roots, warnings: result.warnings, truncated: result.truncated === true, stats: result.stats, refreshedAt: now(), scanMs: Math.max(0, now() - started) };
      lastError = null;
      sequence += 1;
      for (const sub of subscribers) {
        try { sub(snapshot); } catch {}
      }
      return snapshot;
    }, error => {
      // A failed refresh keeps the previous list usable and reports the failure on its own; it never
      // turns the existing list into an empty one.
      lastError = error;
      warn(`[Whale wallpaper] library refresh failed: ${error.message}`);
      throw error;
    });
  }

  /**
   * Refresh the snapshot. Concurrent calls share one scan, so polling the status or holding a key
   * down cannot queue an unbounded number of directory walks.
   */
  function refresh() {
    if (refreshing) return refreshing.then(joined => ({ ...joined, joined: true }));
    // The handle is stored synchronously, before the first await: a second call in the same tick
    // must join this scan instead of starting another directory walk.
    const run = scanOnce().then(
      () => ({ ...health(), joined: false }),
      error => { throw Object.assign(new Error(`wallpaper library refresh failed: ${error.message}`), { libraryReason: 'refresh_failed' }); },
    );
    const handle = run.then(
      value => { refreshing = null; return value; },
      error => { refreshing = null; throw error; },
    );
    refreshing = handle;
    return handle;
  }

  /**
   * Re-verify one selected id and return the project file the Host will actually start.
   * This is the only path from an id to a path, and it always re-checks the files.
   */
  async function resolveProject(sceneId, privateRecord = false) {
    if (!isSceneId(sceneId)) throw new Error(`unknown scene: ${String(sceneId)}`);
    const verified = VERIFIED_SCENES[sceneId];
    if (verified) {
      if (!exists(verified.project)) throw new Error(`scene file is missing: ${sceneId}`);
      return privateRecord ? { id: sceneId, type: 'scene', project: verified.project, entry: verified.project } : verified.project;
    }
    if (!isCatalogId(sceneId)) throw new Error(`unknown scene: ${String(sceneId)}`);
    if (!snapshot) throw new Error(`the wallpaper library has not been loaded yet: ${sceneId}`);
    const item = snapshot.byId.get(sceneId);
    if (!item) throw new Error(`unknown scene: ${sceneId}`);
    // The snapshot already refused this record (an unsupported type, a dangerous preview, an unsafe
    // declaration). Re-verification proves the files are still the same ones; it must never upgrade a
    // record the scan refused just because a scene.pkg happens to sit next to it.
    if (item.available !== true) {
      throw Object.assign(new Error(`selected wallpaper is not playable: ${item.reason ?? 'not_available'}`), { libraryReason: item.reason ?? 'not_available', sceneId });
    }
    let record;
    try {
      record = await verify(item, { roots: [...approvedRoots] });
    } catch (error) {
      throw Object.assign(new Error(`selected wallpaper is not playable: ${error.catalogReason ?? error.message}`), { libraryReason: error.catalogReason ?? 'verify_failed', sceneId });
    }
    // The cached record is updated with the paths that were just re-proved, so status and the run
    // report describe the same files this request validated.
    const next = { ...item, project: record.project, entry: record.entry, available: true, reason: null };
    snapshot = { ...snapshot, items: snapshot.items.map(entry => (entry.id === item.id ? next : entry)), byId: new Map(snapshot.byId).set(item.id, next) };
    // Video must open its re-verified media entry; scenes keep project metadata.
    return privateRecord ? record : record.type === 'video' ? record.entry : record.project;
  }

  /** Resolve a selection into the constrained request fields the session needs, or throw. */
  async function resolveSelection(sceneId) {
    const project = await resolveProject(sceneId);
    return { sceneId, project };
  }

  // Host-private descriptor: the request still supplies only an id. Retain the original
  // declaration separately from the helper path, so the media bridge can re-prove it.
  async function resolveForPlayback(sceneId) {
    const record = await resolveProject(sceneId, true);
    return { sceneId, type: record.type, project: record.type === 'video' ? record.entry : record.project, sourceProject: record.project, entry: record.entry };
  }

  /**
   * Resolves the preview record for a scene id, ensuring it belongs to approved roots.
   */
  async function resolvePreviewItem(sceneId) {
    if (!isSceneId(sceneId)) {
      throw Object.assign(new Error(`unknown scene: ${String(sceneId)}`), { libraryReason: 'unknown_wallpaper' });
    }
    if (sceneId === 'lucy') {
      const verified = VERIFIED_SCENES.lucy;
      if (verified && exists(verified.project)) {
        const projectDir = dirname(resolve(verified.project));
        for (const name of ['preview.gif', 'preview.png', 'preview.jpg', 'preview.webp']) {
          try {
            const file = await boundFile(projectDir, [name]);
            if (file.info.size) {
              return { id: 'lucy', preview: file.path, contentRating: 'Everyone' };
            }
          } catch {}
        }
      }
      throw Object.assign(new Error(`missing preview for scene: ${sceneId}`), { libraryReason: 'missing_preview' });
    }
    if (!snapshot) {
      throw Object.assign(new Error(`wallpaper library not loaded yet: ${sceneId}`), { libraryReason: 'library_not_loaded' });
    }
    const item = snapshot.byId.get(sceneId);
    if (!item || !item.preview) {
      throw Object.assign(new Error(`missing preview for scene: ${sceneId}`), { libraryReason: 'missing_preview' });
    }
    return item;
  }

  /**
   * Reads and verifies the raster image bytes for a scene preview.
   */
  async function getPreview(sceneId, options = {}) {
    const item = await resolvePreviewItem(sceneId);
    return await verifyCatalogPreview(item, { roots: [...approvedRoots], ...options });
  }

  /**
   * Re-verifies on-disk project.json content rating for a scene without reading preview image bytes.
   */
  async function resolvePreviewRating(sceneId, options = {}) {
    if (!isSceneId(sceneId)) return null;
    let item;
    try {
      item = await resolvePreviewItem(sceneId);
    } catch {
      return null;
    }
    return await verifyCatalogItemRating(item, { roots: [...approvedRoots], ...options });
  }

  return {
    roots: approvedRoots,
    refresh,
    hasSnapshot,
    health,
    publicItems,
    publicEntry,
    isVerified,
    knows,
    resolveProject,
    resolveSelection,
    resolveForPlayback,
    resolvePreviewItem,
    resolvePreviewRating,
    getPreview,
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    /** Test/diagnostic view: the number of completed scans. */
    scans: () => sequence,
    currentError: () => (lastError ? String(lastError.message ?? lastError) : null),
    /** Cheap availability probe used by the status payload; never scans. */
    availability: () => {
      if (!approvedRoots.length) return { available: false, reason: 'root' };
      try {
        const first = approvedRoots[0];
        if (!statSync(first).isDirectory()) return { available: false, reason: 'root' };
      } catch { return { available: false, reason: 'root' }; }
      return { available: true, reason: null };
    },
    /** Re-stat a cached item without touching the filesystem twice per status poll. */
    stillPresent: async id => {
      const item = snapshot?.byId.get(id);
      if (!item?.entry) return false;
      try { return (await stat(item.entry)).isFile(); } catch { return false; }
    },
  };
}
