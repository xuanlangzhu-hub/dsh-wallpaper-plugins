/**
 * Detachable Appearance Protocol & Browser-Safe Contract.
 *
 * This module contains zero Node.js-specific imports or dependencies, making it
 * safe to import directly in standard browser environments (Edge Companion Window,
 * DSH Renderer) as well as Node.js test runtimes.
 */

export const PROTOCOL_VERSION = 1;

export const DETACHABLE_MODES = Object.freeze({
  DOCKED: 'docked',
  DETACHING: 'detaching',
  DETACHED: 'detached',
  DOCKING: 'docking',
});

export const DETACHABLE_ACTIONS = Object.freeze({
  SET_SETTING: 'set-setting',
  RESET_SETTINGS: 'reset-settings',
  SAVE_PRESET: 'save-preset',
  APPLY_PRESET: 'apply-preset',
  REMOVE_PRESET: 'remove-preset',
  REQUEST_DOCK: 'request-dock',
  CLOSE_WINDOW: 'close-window',
  START_WALLPAPER: 'start-wallpaper',
  STOP_WALLPAPER: 'stop-wallpaper',
  REFRESH_CATALOG: 'refresh-catalog',
});

/**
 * Strict bounds matching real production controller constraints.
 * Note: blur max is 24; surface min is 40.
 */
export const RANGE_BOUNDS = Object.freeze({
  brightness: Object.freeze({ min: 20, max: 120 }),
  mask: Object.freeze({ min: 0, max: 90 }),
  blur: Object.freeze({ min: 0, max: 24 }),
  surface: Object.freeze({ min: 40, max: 100 }),
  chatBackdrop: Object.freeze({ min: 0, max: 100 }),
});

export const ALLOWED_ENUMS = Object.freeze({
  theme: Object.freeze(['mist', 'abyss']),
  palette: Object.freeze(['ocean', 'graphite', 'violet', 'jade']),
  accentMode: Object.freeze(['theme', 'custom']),
  canvas: Object.freeze(['soft', 'clear']),
  sidebar: Object.freeze(['balanced', 'deep']),
  glass: Object.freeze(['standard', 'restrained']),
  textContrast: Object.freeze(['standard', 'enhanced']),
  background: Object.freeze(['none', 'image', 'video', 'wallpaper']),
  motion: Object.freeze(['focus', 'always']),
  weMode: Object.freeze(['preview', 'daily']),
});

export const BOOLEAN_KEYS = Object.freeze([
  'weAutoStart',
  'opaqueSidebar',
  'opaqueChat',
]);

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Strict scene ID rule matching production:
 * Either 'lucy' or 'we-' followed by exactly 24 lowercase hex characters.
 */
export const CATALOG_ID_PATTERN = /^we-[0-9a-f]{24}$/;

export function isSceneId(value) {
  return value === 'lucy' || (typeof value === 'string' && CATALOG_ID_PATTERN.test(value));
}

export const AGE_RATINGS = Object.freeze(['Everyone', 'Questionable', 'Mature']);
export const DEFAULT_AGE_RATINGS = Object.freeze(['Everyone']);

export function parseAgeRatings(strOrArr) {
  if (Array.isArray(strOrArr)) {
    if (strOrArr.length === 0) return [];
    const allValid = strOrArr.every(r => typeof r === 'string' && AGE_RATINGS.includes(r));
    if (!allValid) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const filtered = [...new Set(strOrArr)];
    filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
    return filtered;
  }
  if (typeof strOrArr === 'string') {
    const trimmed = strOrArr.trim();
    if (trimmed === '') return [];
    const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const allValid = parts.every(r => AGE_RATINGS.includes(r));
    if (!allValid) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const filtered = [...new Set(parts)];
    filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
    return filtered;
  }
  return [...DEFAULT_AGE_RATINGS];
}

export function formatAgeRatings(arr) {
  if (!Array.isArray(arr)) return 'Everyone';
  if (arr.length === 0) return '';
  const allValid = arr.every(r => typeof r === 'string' && AGE_RATINGS.includes(r));
  if (!allValid) return 'Everyone';
  const filtered = [...new Set(arr)];
  filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
  return filtered.join(',');
}

export const ALLOWED_SETTING_KEYS = Object.freeze([
  ...Object.keys(RANGE_BOUNDS),
  ...Object.keys(ALLOWED_ENUMS),
  ...BOOLEAN_KEYS,
  'accentColor',
  'weScene',
  'weAgeRatings',
]);

/**
 * Cryptographically secure UUID generator.
 */
export function generateUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('cryptographically-secure-random-not-available');
}

/**
 * Builds an immutable appearance snapshot from the authoritative controller.
 */
export function buildAppearanceSnapshot(controller, revision = 1) {
  const settings = controller.getSettingsSnapshot
    ? controller.getSettingsSnapshot()
    : Object.freeze(controller.read ? controller.read() : {});

  const presets = controller.presets?.getSnapshot
    ? controller.presets.getSnapshot()
    : Object.freeze({ version: 1, entries: {} });

  const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;

  const presetTarget = controller.presets?.resolveTarget
    ? Object.freeze({ ...controller.presets.resolveTarget() })
    : null;

  const catalogSource = (typeof controller.wallpaper?.getLibrarySnapshot === 'function'
    ? controller.wallpaper.getLibrarySnapshot()
    : controller.catalog) || { items: [], state: 'idle', loaded: false, loading: false, truncated: false, error: null, scannedAt: null, rootWarnings: [] };

  const rawItems = Array.isArray(catalogSource.items) ? [...catalogSource.items] : [];
  if (catalogSource.state !== 'failed' && !rawItems.some(item => item.id === 'lucy')) {
    const verified = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(scene => scene.id === 'lucy') : null;
    rawItems.unshift({
      id: 'lucy',
      title: 'Lucy',
      type: 'scene',
      contentRating: 'Everyone',
      available: verified ? verified.available !== false : true,
      playbackVerified: true,
      reason: null,
      warnings: [],
      previewRef: { wallpaperId: 'lucy', kind: 'preview' },
    });
  }

  const cleanItems = rawItems.map(item => ({
    ...item,
    contentRating: AGE_RATINGS.includes(item.contentRating) ? item.contentRating : (item.id === 'lucy' ? 'Everyone' : 'unknown'),
  }));

  const catalog = Object.freeze({
    items: Object.freeze(cleanItems),
    state: catalogSource.state || 'idle',
    loaded: Boolean(catalogSource.loaded),
    loading: Boolean(catalogSource.loading),
    truncated: Boolean(catalogSource.truncated),
    error: catalogSource.error || null,
    scannedAt: catalogSource.scannedAt || null,
    rootWarnings: Array.isArray(catalogSource.rootWarnings) ? catalogSource.rootWarnings : [],
  });

  return Object.freeze({
    protocolVersion: PROTOCOL_VERSION,
    revision,
    settings,
    presets,
    presetTarget,
    catalog,
    wallpaper: Object.freeze({
      state: wp?.state ?? 'idle',
      activeSceneId: wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null,
      cleanupPending: Boolean(wp?.cleanupPending),
    }),
  });
}

/**
 * Strictly validates an incoming detachable action against whitelist and schema rules.
 */
export function validateDetachableAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { valid: false, error: 'action-invalid-object' };
  }
  if (!Object.values(DETACHABLE_ACTIONS).includes(action.type)) {
    return { valid: false, error: 'action-unsupported-type' };
  }
  if (!action.clientActionId || typeof action.clientActionId !== 'string') {
    return { valid: false, error: 'action-missing-client-id' };
  }
  if (!Number.isInteger(action.expectedRevision) || action.expectedRevision <= 0) {
    return { valid: false, error: 'action-invalid-expected-revision' };
  }

  if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
    if (!ALLOWED_SETTING_KEYS.includes(action.key)) {
      return { valid: false, error: 'setting-key-disallowed', key: action.key };
    }

    if (Object.hasOwn(RANGE_BOUNDS, action.key)) {
      if (typeof action.value !== 'number' || !Number.isFinite(action.value)) {
        return { valid: false, error: 'setting-value-not-numeric', key: action.key };
      }
      const bounds = RANGE_BOUNDS[action.key];
      if (action.value < bounds.min || action.value > bounds.max) {
        return { valid: false, error: 'setting-value-out-of-bounds', key: action.key, min: bounds.min, max: bounds.max };
      }
    } else if (action.key === 'accentColor') {
      if (typeof action.value !== 'string' || !HEX_COLOR_PATTERN.test(action.value)) {
        return { valid: false, error: 'setting-color-invalid', value: action.value };
      }
    } else if (BOOLEAN_KEYS.includes(action.key)) {
      if (typeof action.value !== 'boolean') {
        return { valid: false, error: 'setting-value-not-boolean', key: action.key };
      }
    } else if (Object.hasOwn(ALLOWED_ENUMS, action.key)) {
      if (!ALLOWED_ENUMS[action.key].includes(action.value)) {
        return { valid: false, error: 'setting-enum-invalid', key: action.key, value: action.value };
      }
    } else if (action.key === 'weScene') {
      if (!isSceneId(action.value)) {
        return { valid: false, error: 'setting-scene-invalid', value: action.value };
      }
    } else if (action.key === 'weAgeRatings') {
      if (typeof action.value === 'string') {
        const trimmed = action.value.trim();
        if (trimmed !== '') {
          const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length === 0 || !parts.every(p => AGE_RATINGS.includes(p))) {
            return { valid: false, error: 'setting-age-ratings-invalid', value: action.value };
          }
        }
      } else if (Array.isArray(action.value)) {
        if (!action.value.every(p => typeof p === 'string' && AGE_RATINGS.includes(p))) {
          return { valid: false, error: 'setting-age-ratings-invalid', value: action.value };
        }
      } else {
        return { valid: false, error: 'setting-age-ratings-invalid', value: action.value };
      }
    }
  } else if (
    action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
    action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
    action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
  ) {
    if (!isSceneId(action.sceneId)) {
      return { valid: false, error: 'preset-scene-invalid', sceneId: action.sceneId };
    }
  } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
    if (!isSceneId(action.sceneId)) {
      return { valid: false, error: 'wallpaper-scene-invalid', sceneId: action.sceneId };
    }
    if (action.mode !== undefined && !['preview', 'daily'].includes(action.mode)) {
      return { valid: false, error: 'wallpaper-mode-invalid', mode: action.mode };
    }
  }

  return { valid: true };
}

/**
 * Standard known installation paths for Microsoft Edge on Windows.
 */
export const STANDARD_EDGE_PATHS = Object.freeze([
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]);

/**
 * Resolves the path to the Edge executable across standard installation locations.
 * Browser-safe: defends against non-Node environments.
 */
export function findEdgeExecutable(customPath = null) {
  if (customPath && typeof customPath === 'string') return customPath;
  const isNode = typeof process !== 'undefined' && process?.env;
  const programFilesX86 =
    (isNode && process.env?.['ProgramFiles(x86)']) || 'C:\\Program Files (x86)';
  const programFiles = (isNode && process.env?.ProgramFiles) || 'C:\\Program Files';
  const localAppData = (isNode && process.env?.LOCALAPPDATA) || '';

  const candidates = [
    `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    localAppData ? `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe` : null,
  ].filter(Boolean);

  return candidates[0] || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

/**
 * Builds a validated, safe command spec to launch Microsoft Edge in Application Window mode.
 * Enforces a dedicated user-data-dir to isolate the companion session from user browsing.
 */
export function buildEdgeAppLaunchSpec({
  hostPort,
  token,
  instanceId,
  profileDir,
  edgePath = findEdgeExecutable(),
  companionPath = '/index.html',
}) {
  if (!Number.isInteger(hostPort) || hostPort <= 0 || hostPort > 65535) {
    throw new Error(`invalid hostPort: ${hostPort}`);
  }
  if (!token || typeof token !== 'string') {
    throw new Error('invalid token');
  }
  if (!instanceId || typeof instanceId !== 'string') {
    throw new Error('invalid instanceId');
  }

  const query = new URLSearchParams({
    token,
    instanceId,
    instance: instanceId,
  });

  const appUrl = `http://127.0.0.1:${hostPort}${companionPath}?${query.toString()}`;

  const isNode = typeof process !== 'undefined' && process?.env;
  const defaultTempDir =
    (isNode && (process.env?.TEMP || process.env?.TMP)) || 'C:\\ProgramData\\Temp';
  const uniqueSuffix = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const resolvedProfileDir =
    profileDir && typeof profileDir === 'string'
      ? profileDir
      : `${defaultTempDir}\\whale-companion-profile-${instanceId}-${uniqueSuffix}`;

  const args = [
    `--app=${appUrl}`,
    `--user-data-dir=${resolvedProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--window-size=380,680',
    '--guest',
  ];

  return Object.freeze({
    executable: edgePath || findEdgeExecutable(),
    args: Object.freeze(args),
    appUrl,
    profileDir: resolvedProfileDir,
    spawnOptions: Object.freeze({ shell: false, windowsHide: false }),
    hostPort,
    token,
    instanceId,
  });
}


/**
 * Creates a Companion Client running in the browser window context.
 * Guards incoming snapshots to be strictly monotonic (ignores regressive/duplicate revisions).
 */
export function createCompanionClient({ token, instanceId, transport }) {
  let snapshot = null;
  let currentRevision = 0;
  const subscribers = new Set();
  let connected = false;
  let connectionEpoch = 0;

  const notify = () => {
    const state = {
      connected,
      snapshot,
      revision: currentRevision,
      protocolVersion: snapshot?.protocolVersion ?? PROTOCOL_VERSION,
      settings: snapshot?.settings,
      wallpaper: snapshot?.wallpaper,
      presets: snapshot?.presets,
      catalog: snapshot?.catalog,
      brightness: snapshot?.settings?.brightness ?? snapshot?.brightness,
      mask: snapshot?.settings?.mask ?? snapshot?.mask,
    };
    for (const sub of subscribers) {
      try {
        sub(state);
      } catch {}
    }
  };

  const absorbSnapshot = (newSnapshot) => {
    if (!newSnapshot || typeof newSnapshot !== 'object' || typeof newSnapshot.revision !== 'number') return;
    if (newSnapshot.revision <= currentRevision) return;
    currentRevision = newSnapshot.revision;
    snapshot = newSnapshot;
    if (connected) {
      notify();
    }
  };

  if (transport && typeof transport.onSnapshot === 'function') {
    transport.onSnapshot((newSnapshot) => {
      absorbSnapshot(newSnapshot);
    });
  }

  if (transport && typeof transport.onDockedNotice === 'function') {
    transport.onDockedNotice(() => {
      connected = false;
      notify();
    });
  }

  if (transport && typeof transport.onDisconnect === 'function') {
    transport.onDisconnect(() => {
      connected = false;
      notify();
    });
  }

  return {
    requestAuthor: (route,payload,options) => connected && typeof transport.requestAuthor==='function' ? transport.requestAuthor(route,payload,options) : Promise.reject(new Error('author-disconnected')),
    async connect() {
      const epoch = ++connectionEpoch;
      try {
        const result = await transport.connect({ token, instanceId });
        // Epoch check: if disconnect() was called while connect was pending, ignore
        if (connectionEpoch !== epoch) {
          return { ok: false, error: 'connection-cancelled' };
        }
        if (result.ok) {
          connected = true;
          if (result.snapshot && result.snapshot.revision > currentRevision) {
            currentRevision = result.snapshot.revision;
            snapshot = result.snapshot;
          }
          notify();
        }
        return result;
      } catch (err) {
        return { ok: false, error: `connect-failed: ${err.message}` };
      }
    },

    isConnected: () => connected,
    getSnapshot: () => snapshot,
    getCurrentRevision: () => currentRevision,

    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    async dispatch(actionType, payload = {}, options = {}) {
      if (!connected) return { ok: false, error: 'not-connected' };
      const epoch = connectionEpoch;
      const signal = options?.signal;
      if (signal?.aborted) {
        return { ok: false, error: 'action-aborted' };
      }
      const action = {
        type: actionType,
        clientActionId: generateUuid(),
        expectedRevision: currentRevision || snapshot?.revision || 1,
        ...payload,
      };
      let res;
      try {
        res = await transport.sendAction(action, options);
      } catch (err) {
        if (signal?.aborted) {
          return { ok: false, error: 'action-aborted' };
        }
        return { ok: false, error: `action-failed: ${err.message}` };
      }
      if (signal?.aborted || connectionEpoch !== epoch) {
        return { ok: false, error: 'action-aborted' };
      }
      if (res && res.ok === false && (res.error === 'main-instance-disconnected' || res.status === 503)) {
        connected = false;
        notify();
      }
      // Automatically absorb authoritative snapshot only if action was not aborted/expired
      if (!signal?.aborted && connectionEpoch === epoch) {
        if (res && typeof res === 'object' && res.snapshot) {
          absorbSnapshot(res.snapshot);
        }
      }
      return res;
    },

    async setSetting(key, value, options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.SET_SETTING, { key, value }, options);
    },

    async dispatchAction(action, options = {}) {
      const { type, ...payload } = action;
      return this.dispatch(type, payload, options);
    },

    requestDock(options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.REQUEST_DOCK, {}, options);
    },

    closeWindow(options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.CLOSE_WINDOW, {}, options);
    },

    startWallpaper(sceneId, options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.START_WALLPAPER, { sceneId }, options);
    },

    stopWallpaper(options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.STOP_WALLPAPER, {}, options);
    },

    refreshCatalog(options = {}) {
      return this.dispatch(DETACHABLE_ACTIONS.REFRESH_CATALOG, {}, options);
    },

    fetchPreviewBlob(sceneId, options = {}) {
      return transport?.fetchPreviewBlob?.(sceneId, options);
    },

    disconnect() {
      connectionEpoch++;
      connected = false;
      currentRevision = 0;
      snapshot = null;
      notify();
      transport.close?.();
    },
  };
}

/**
 * Browser-safe HTTP Companion Transport using standard fetch API and SSE stream.
 * Connects to the local Host HTTP server via loopback.
 */
export function createHttpCompanionTransport({ baseUrl, token, instanceId }) {
  let onSnapshotHandler = null;
  let onDockedNoticeHandler = null;
  let onDisconnectHandler = null;
  let activeLeaseId = null;
  let activeGeneration = null;
  let closed = false;
  let streamAbortController = null;

  async function startEventStream(leaseId, generation) {
    if (streamAbortController) {
      try { streamAbortController.abort(); } catch {}
    }
    streamAbortController = new AbortController();
    try {
      const query = `lease=${encodeURIComponent(leaseId)}&generation=${encodeURIComponent(generation)}`;
      const res = await fetch(`${baseUrl}/api/events?${query}`, {
        headers: {
          'Accept': 'text/event-stream',
          'X-Whale-Lease': leaseId,
          'X-Whale-Generation': String(generation),
        },
        signal: streamAbortController.signal,
      });

      if (!res.ok) {
        if (res.status === 503 || res.status === 401) {
          onDisconnectHandler?.();
        }
        return;
      }

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const block of blocks) {
            if (!block.trim() || block.startsWith(':')) continue;
            let eventName = 'message';
            let eventData = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                eventData = line.slice(5).trim();
              }
            }
            if (eventName === 'snapshot') {
              try {
                const snap = JSON.parse(eventData);
                onSnapshotHandler?.(snap);
              } catch {}
            } else if (eventName === 'docked') {
              onDockedNoticeHandler?.();
            } else if (eventName === 'disconnect') {
              onDisconnectHandler?.();
            }
          }
        }
      }
    } catch {
      // Aborted or network disconnected
    } finally {
      if (!closed) {
        onDisconnectHandler?.();
      }
    }
  }

  return {
    async connect({ token: connToken = token, instanceId: connInstance = instanceId } = {}) {
      if (closed) return { ok: false, error: 'transport-closed' };
      try {
        const res = await fetch(`${baseUrl}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: connToken, instanceId: connInstance }),
        });
        const data = await res.json();
        if (data.ok && data.leaseId) {
          activeLeaseId = data.leaseId;
          activeGeneration = data.generation ?? 1;
          startEventStream(activeLeaseId, activeGeneration).catch(() => {});
        }
        return data;
      } catch (err) {
        return { ok: false, error: `http-connect-failed: ${err.message}` };
      }
    },

    async sendAction(action, options = {}) {
      if (closed) return { ok: false, error: 'transport-closed' };
      try {
        const res = await fetch(`${baseUrl}/api/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Whale-Lease': activeLeaseId || '',
            'X-Whale-Generation': String(activeGeneration || 1),
          },
          body: JSON.stringify({ action, capability: { leaseId: activeLeaseId, generation: activeGeneration } }),
          signal: options?.signal,
        });
        const data = await res.json();
        if (res.status === 503 || data.error === 'main-instance-disconnected') {
          onDisconnectHandler?.();
        }
        return data;
      } catch (err) {
        if (options?.signal?.aborted) {
          return { ok: false, error: 'action-aborted' };
        }
        return { ok: false, error: `http-action-failed: ${err.message}` };
      }
    },

    async requestAuthor(route,payload,{signal}={}) {
      if(closed || !activeLeaseId || !['schema','draft','apply'].includes(route))throw new Error('author-disconnected');
      const res=await fetch(`${baseUrl}/api/author-properties/${route}${route==='schema'?`?wallpaperId=${encodeURIComponent(payload.wallpaperId)}`:''}`,{
        method:route==='schema'?'GET':'POST',headers:{'Content-Type':'application/json',
          'X-Whale-Lease':activeLeaseId,'X-Whale-Generation':String(activeGeneration)},
        ...(route!=='schema'?{body:JSON.stringify(payload)}:{}),signal});
      return await res.json();
    },

    async fetchPreviewBlob(wallpaperId, { signal } = {}) {
      if (closed) throw new Error('transport-closed');
      const url = `${baseUrl}/api/wallpaper-preview?id=${encodeURIComponent(wallpaperId)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Whale-Lease': activeLeaseId || '',
          'X-Whale-Generation': String(activeGeneration || 1),
        },
        signal,
      });
      if (!res.ok) {
        throw new Error(`preview-fetch-failed: ${res.status}`);
      }
      return await res.blob();
    },

    onSnapshot(handler) {
      onSnapshotHandler = handler;
    },
    onDockedNotice(handler) {
      onDockedNoticeHandler = handler;
    },
    onDisconnect(handler) {
      onDisconnectHandler = handler;
    },
    close() {
      if (closed) return;
      closed = true;
      const lease = activeLeaseId;
      const gen = activeGeneration;
      activeLeaseId = null;
      activeGeneration = null;
      try { streamAbortController?.abort(); } catch {}

      if (lease) {
        try {
          fetch(`${baseUrl}/api/disconnect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Whale-Lease': lease,
              'X-Whale-Generation': String(gen || 1),
            },
          }).catch(() => {});
        } catch {}
      }
    },
  };
}

/**
 * In-memory bidirectional transport pair for offline testing and validation.
 */
export function createMockTransportPair() {
  let mainActionHandler = null;
  let mainDisconnectHandler = null;
  let companionSnapshotHandler = null;
  let companionDockedHandler = null;

  let bridgeRef = null;

  const mainTransport = {
    setBridge(bridge) {
      bridgeRef = bridge;
    },
    onAction(handler) {
      mainActionHandler = handler;
    },
    onDisconnect(handler) {
      mainDisconnectHandler = handler;
    },
    sendSnapshot(snapshot) {
      if (companionSnapshotHandler) companionSnapshotHandler(snapshot);
    },
    sendDockedNotice() {
      if (companionDockedHandler) companionDockedHandler();
    },
    close() {
      if (mainDisconnectHandler) {
        const handler = mainDisconnectHandler;
        mainDisconnectHandler = null;
        handler();
      }
      if (companionDockedHandler) companionDockedHandler();
    },
  };

  const companionTransport = {
    connect({ token, instanceId }) {
      if (!bridgeRef) return Promise.resolve({ ok: false, error: 'no-bridge' });
      const res = bridgeRef.handleCompanionConnect({ token, instanceId, transport: mainTransport });
      return Promise.resolve(res);
    },
    sendAction(action) {
      if (!mainActionHandler) return Promise.resolve({ ok: false, error: 'no-handler' });
      return Promise.resolve(mainActionHandler(action));
    },
    onSnapshot(handler) {
      companionSnapshotHandler = handler;
    },
    onDockedNotice(handler) {
      companionDockedHandler = handler;
    },
    close() {
      if (mainDisconnectHandler) {
        const handler = mainDisconnectHandler;
        mainDisconnectHandler = null;
        handler();
      }
    },
  };

  return { mainTransport, companionTransport };
}

/**
 * Authoritative Action Executor.
 * Shared across both DetachableBridge and MainRendererBridgeClient to guarantee
 * identical validation, revision checking, deduplication, preset handling, and error transparency.
 */
export async function executeAuthoritativeAction({
  controller,
  action,
  expectedRevisionCheck = true,
  currentRevision = 1,
  actionCache = null,
  onRequestDock = null,
  getSnapshot = null,
}) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { ok: false, error: 'action-invalid-object', snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
  }

  const val = validateDetachableAction(action);
  if (!val.valid) {
    return { ok: false, error: val.error, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
  }

  const fingerprint = JSON.stringify({
    type: action.type,
    key: action.key,
    value: action.value,
    sceneId: action.sceneId,
    mode: action.mode,
  });

  if (actionCache && actionCache.has(action.clientActionId)) {
    const cached = actionCache.get(action.clientActionId);
    if (cached.fingerprint !== fingerprint) {
      return {
        ok: false,
        error: 'action-payload-mismatch',
        clientActionId: action.clientActionId,
        snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
      };
    }
    return { ...cached.result, duplicate: true, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
  }

  if (expectedRevisionCheck && action.expectedRevision !== currentRevision) {
    return {
      ok: false,
      error: 'stale-revision',
      expectedRevision: action.expectedRevision,
      latestRevision: currentRevision,
      snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined,
    };
  }

  let executionResult = null;
  try {
    if (action.type === DETACHABLE_ACTIONS.SET_SETTING) {
      const res = controller.set(action.key, action.value);
      if (!res || typeof res !== 'object') {
        executionResult = { ok: false, error: 'set-setting-rejected' };
      } else {
        executionResult = { ok: true };
      }
    } else if (action.type === DETACHABLE_ACTIONS.RESET_SETTINGS) {
      controller.reset?.();
      executionResult = { ok: true };
    } else if (
      action.type === DETACHABLE_ACTIONS.SAVE_PRESET ||
      action.type === DETACHABLE_ACTIONS.APPLY_PRESET ||
      action.type === DETACHABLE_ACTIONS.REMOVE_PRESET
    ) {
      const op =
        action.type === DETACHABLE_ACTIONS.SAVE_PRESET
          ? 'save'
          : action.type === DETACHABLE_ACTIONS.APPLY_PRESET
          ? 'apply'
          : 'remove';
      const fn = controller.presets?.[op];
      if (typeof fn !== 'function') {
        executionResult = { ok: false, error: `preset-op-unsupported: ${op}` };
      } else {
        const res = fn(action.sceneId, action.name);
        if (res && typeof res === 'object' && res.ok === false) {
          executionResult = { ok: false, error: res.error || 'preset-op-failed', details: res };
        } else {
          executionResult = { ok: true, result: res };
        }
      }
    } else if (action.type === DETACHABLE_ACTIONS.START_WALLPAPER) {
      const currentSettings = typeof controller.read === 'function'
        ? controller.read()
        : (typeof controller.getSettingsSnapshot === 'function' ? controller.getSettingsSnapshot() : null);
      const currentSelectedScene = currentSettings?.weScene || 'lucy';
      const currentMode = action.mode || currentSettings?.weMode || 'daily';

      const wp = controller.wallpaper?.getStatus ? controller.wallpaper.getStatus() : null;
      const wpState = wp?.state ?? 'idle';
      const cleanupPending = Boolean(wp?.cleanupPending);
      const activeSceneId = wp?.activeSceneId ?? wp?.host?.activeSceneId ?? null;

      if (action.sceneId !== currentSelectedScene) {
        executionResult = {
          ok: false,
          error: 'target-drift-or-mismatch',
          selectedSceneId: currentSelectedScene,
          requestedSceneId: action.sceneId,
        };
      } else if (!['idle', 'stopped', 'error'].includes(wpState) || cleanupPending || wpState === 'cleanup-failed' || activeSceneId != null) {
        executionResult = { ok: false, error: 'playback-active-or-transitioning', state: wpState, activeSceneId };
      } else {
        const catalog = controller.wallpaper?.getLibrarySnapshot ? controller.wallpaper.getLibrarySnapshot() : null;
        const catalogReady = catalog?.state === 'ready' && catalog?.loaded === true;
        if (!catalogReady) {
          executionResult = { ok: false, error: 'catalog-not-ready', state: catalog?.state || 'unloaded' };
        } else {
          const items = Array.isArray(catalog?.items) ? catalog.items : [];
          const isLucy = action.sceneId === 'lucy';
          const catalogItem = items.find(item => item.id === action.sceneId);

          const lucyHostScene = Array.isArray(wp?.host?.scenes) ? wp.host.scenes.find(s => s.id === 'lucy') : null;
          const lucyAvailable = lucyHostScene ? lucyHostScene.available !== false : true;

          if (isLucy && !lucyAvailable) {
            executionResult = { ok: false, error: 'scene-unavailable', sceneId: 'lucy', reason: 'sample_unavailable' };
          } else if (!isLucy && (!catalogItem || catalogItem.available !== true || !['scene', 'video', 'web'].includes(catalogItem.type))) {
            executionResult = {
              ok: false,
              error: 'scene-unavailable',
              sceneId: action.sceneId,
              reason: catalogItem?.reason || 'not_available',
            };
          } else if (typeof controller.wallpaper?.start === 'function') {
            try {
              const startRes = await controller.wallpaper.start(action.sceneId, currentMode);
              if (!startRes || startRes.ok === false || startRes.state === 'error' || startRes.state === 'cleanup-failed') {
                executionResult = {
                  ok: false,
                  error: startRes?.error || `start-failed: ${startRes?.state || 'error'}`,
                  state: startRes?.state || 'error',
                  result: startRes,
                };
              } else {
                executionResult = { ok: true, activeSceneId: action.sceneId, result: startRes };
              }
            } catch (err) {
              executionResult = { ok: false, error: `start-failed: ${err.message}` };
            }
          } else {
            executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
          }
        }
      }
    } else if (action.type === DETACHABLE_ACTIONS.STOP_WALLPAPER) {
      if (typeof controller.wallpaper?.stop === 'function') {
        try {
          const stopRes = await controller.wallpaper.stop('user');
          if (!stopRes || stopRes.ok === false || stopRes.state === 'cleanup-failed' || stopRes.state === 'error') {
            executionResult = {
              ok: false,
              error: stopRes?.error || `stop-failed: ${stopRes?.state || 'error'}`,
              state: stopRes?.state || 'error',
              result: stopRes,
            };
          } else {
            executionResult = { ok: true, result: stopRes };
          }
        } catch (err) {
          executionResult = { ok: false, error: `stop-failed: ${err.message}` };
        }
      } else {
        executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
      }
    } else if (action.type === DETACHABLE_ACTIONS.REFRESH_CATALOG) {
      if (typeof controller.wallpaper?.readLibrary === 'function') {
        try {
          const libRes = await controller.wallpaper.readLibrary({ refresh: true });
          if (!libRes || libRes.ok === false || libRes.state === 'failed') {
            executionResult = {
              ok: false,
              error: libRes?.error || 'refresh-failed',
              state: libRes?.state || 'failed',
              result: libRes,
            };
          } else {
            executionResult = { ok: true, result: libRes };
          }
        } catch (err) {
          executionResult = { ok: false, error: `refresh-failed: ${err.message}` };
        }
      } else {
        executionResult = { ok: false, error: 'wallpaper-controller-unavailable' };
      }
    } else if (
      action.type === DETACHABLE_ACTIONS.REQUEST_DOCK ||
      action.type === DETACHABLE_ACTIONS.CLOSE_WINDOW
    ) {
      if (typeof onRequestDock === 'function') {
        const dockRes = await onRequestDock();
        if (!dockRes || !dockRes.ok) {
          executionResult = { ok: false, error: dockRes?.error || 'dock-failed' };
        } else {
          executionResult = { ok: true, mode: DETACHABLE_MODES.DOCKED };
        }
      } else {
        executionResult = { ok: false, error: 'dock-handler-unavailable' };
      }
    } else {
      executionResult = { ok: false, error: 'action-unsupported-type' };
    }
  } catch (err) {
    executionResult = { ok: false, error: `controller-error: ${err.message}` };
  }

  if (actionCache && executionResult != null) {
    actionCache.set(action.clientActionId, {
      fingerprint,
      result: executionResult,
    });
    if (actionCache.size > 200) {
      const oldest = actionCache.keys().next().value;
      actionCache.delete(oldest);
    }
  }

  return { ...executionResult, snapshot: typeof getSnapshot === 'function' ? getSnapshot() : undefined };
}

/**
 * Browser-side Main Renderer Bridge Client.
 * Connects the real WhaleAppearanceController in the Main DSH Renderer to the local Node.js Host.
 * - Pushes authoritative snapshots to Host whenever settings, presets, or wallpaper status change.
 * - Listens for companion actions forwarded by Host over SSE, executes them using the authoritative
 *   action executor, and reports confirmed results back to Host.
 * - Zero Node.js imports: 100% browser native.
 */
export function createMainRendererBridgeClient({ baseUrl, instanceId, mainToken, controller }) {
  let mode = DETACHABLE_MODES.DOCKED;
  let unconfirmedCleanup = false;
  let lastCleanupError = null;
  let revision = 1;
  let currentGeneration = 1;
  let activeToken = null;
  let sseAbort = null;
  let disposed = false;
  let disposePromise = null;
  const subscribers = new Set();
  const actionCache = new Map();

  const getSnapshot = () => buildAppearanceSnapshot(controller, revision);

  function notify() {
    const snap = getSnapshot();
    for (const sub of subscribers) {
      try {
        sub({
          snapshot: snap,
          mode,
          revision,
          generation: currentGeneration,
          unconfirmedCleanup,
          lastError: lastCleanupError,
        });
      } catch {}
    }
  }

  const pushSnapshotToHost = async () => {
    if (disposed) return;
    try {
      await fetch(`${baseUrl}/api/main/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whale-Main-Token': mainToken,
          'X-Whale-Generation': String(currentGeneration),
        },
        body: JSON.stringify({ snapshot: getSnapshot(), revision, instanceId, generation: currentGeneration }),
      });
    } catch {}
  };

  // Subscribe to controller settings changes
  const unsubSettings = controller.subscribeSettings?.(() => {
    revision++;
    notify();
    pushSnapshotToHost();
  });

  // Subscribe to controller preset changes
  const unsubPresets = controller.presets?.subscribe?.(() => {
    revision++;
    notify();
    pushSnapshotToHost();
  });

  // Subscribe to wallpaper status changes
  const unsubWallpaper = controller.wallpaper?.subscribeStatus?.(() => {
    revision++;
    notify();
    pushSnapshotToHost();
  });

  // Subscribe to library changes
  const unsubLibrary = controller.wallpaper?.subscribeLibrary?.(() => {
    revision++;
    notify();
    pushSnapshotToHost();
  });

  const handlePageUnload = () => {
    try {
      const url = `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(currentGeneration)}`;
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  };

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', handlePageUnload);
    window.addEventListener('beforeunload', handlePageUnload);
  }

  async function connect() {
    if (disposed) return { ok: false, error: 'bridge-disposed' };
    const res = await fetch(`${baseUrl}/api/main/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, mainToken, snapshot: getSnapshot() }),
    });
    const data = await res.json();
    if (!data.ok) return data;
    if (disposed) {
      // Disposal may have run before this registration reached the Host.
      // Never reopen SSE; request cleanup with exactly this returned generation.
      const cleanup = Number.isSafeInteger(data.generation) && data.generation > 0
        ? await sendDisconnect(data.generation)
        : { ok: false, error: 'invalid-main-generation' };
      return { ok: false, error: 'bridge-disposed', cleanup };
    }

    currentGeneration = data.generation ?? 1;
    sseAbort = new AbortController();
    startActionStream().catch(() => {});
    return data;
  }

  async function startActionStream() {
    if (disposed) return;
    try {
      const res = await fetch(
        `${baseUrl}/api/main/actions?instanceId=${encodeURIComponent(instanceId)}&mainToken=${encodeURIComponent(mainToken)}&generation=${encodeURIComponent(currentGeneration)}`,
        {
          headers: {
            'Accept': 'text/event-stream',
            'X-Whale-Generation': String(currentGeneration),
          },
          signal: sseAbort.signal,
        }
      );
      if (!res.ok || !res.body?.getReader) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!disposed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          if (!block.trim() || block.startsWith(':')) continue;
          let eventName = 'action';
          let eventData = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
          }
          if (eventName === 'action') {
            let parsed;
            try {
              parsed = JSON.parse(eventData);
            } catch {
              continue;
            }
            const { action, clientActionId } = parsed;
            let result;
            try {
              result = await executeAuthoritativeAction({
                controller,
                action,
                expectedRevisionCheck: true,
                currentRevision: revision,
                actionCache,
                onRequestDock: async () => {
                  return await requestDock();
                },
                getSnapshot,
              });
            } catch (err) {
              result = { ok: false, error: `execution-error: ${err.message}`, snapshot: getSnapshot() };
            }

            try {
              await fetch(`${baseUrl}/api/main/action-result`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Whale-Main-Token': mainToken,
                  'X-Whale-Generation': String(currentGeneration),
                },
                body: JSON.stringify({ clientActionId, result, instanceId, generation: currentGeneration }),
              });
            } catch {}
          } else if (eventName === 'window-state') {
            let state;
            try {
              state = JSON.parse(eventData);
            } catch {
              continue;
            }
            if (state.generation != null && state.generation !== currentGeneration) {
              continue;
            }
            if (state.mode) {
              mode = state.mode;
            }
            unconfirmedCleanup = Boolean(state.unconfirmedCleanup);
            lastCleanupError = state.lastError || null;
            if (mode === DETACHABLE_MODES.DOCKED && !unconfirmedCleanup) {
              activeToken = null;
            }
            notify();
          } else if (eventName === 'dock') {
            if (!unconfirmedCleanup) {
              mode = DETACHABLE_MODES.DOCKED;
              activeToken = null;
              notify();
            }
          }
        }
      }
    } catch {}
  }

  async function requestDetach() {
    const res = await fetch(`${baseUrl}/api/main/detach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Whale-Main-Token': mainToken,
        'X-Whale-Generation': String(currentGeneration),
      },
      body: JSON.stringify({ instanceId, generation: currentGeneration }),
    });
    const data = await res.json();
    if (data.ok) {
      mode = data.mode || DETACHABLE_MODES.DETACHED;
      activeToken = data.token;
      notify();
    }
    return data;
  }

  async function requestDock() {
    const res = await fetch(`${baseUrl}/api/main/dock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Whale-Main-Token': mainToken,
        'X-Whale-Generation': String(currentGeneration),
      },
      body: JSON.stringify({ instanceId, generation: currentGeneration }),
    });
    const data = await res.json();
    if (data.ok) {
      mode = DETACHABLE_MODES.DOCKED;
      unconfirmedCleanup = false;
      lastCleanupError = null;
      activeToken = null;
      notify();
    } else {
      if (data.mode) mode = data.mode;
      unconfirmedCleanup = Boolean(data.unconfirmedCleanup);
      lastCleanupError = data.error || null;
      notify();
    }
    return data;
  }

  function dispose() {
    if (disposePromise) return disposePromise;
    const generationAtDispose = currentGeneration;
    disposed = true;
    disposePromise = Promise.resolve().then(() => finishDispose(generationAtDispose));
    return disposePromise;
  }

  async function finishDispose(generationAtDispose) {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('pagehide', handlePageUnload);
      window.removeEventListener('beforeunload', handlePageUnload);
    }
    try { unsubSettings?.(); } catch {}
    try { unsubPresets?.(); } catch {}
    try { unsubWallpaper?.(); } catch {}
    try { unsubLibrary?.(); } catch {}
    subscribers.clear();

    let result;
    try {
      result = await sendDisconnect(generationAtDispose);
    } finally {
      try { sseAbort?.abort(); } catch {}
    }
    if (result.ok === true) {
      mode = DETACHABLE_MODES.DOCKED;
      activeToken = null;
      notify();
    }
    return result;
  }

  // A late connect is cleaned only with its own acknowledged generation.
  async function sendDisconnect(generationAtDispose) {
    const deadline = new AbortController();
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { deadline.abort(); } catch {}
        reject(new Error('disconnect-timeout'));
      }, 3000);
    });
    const failed = (error) => ({ ok: false, error });
    let result = failed('disconnect-failed');
    try {
      const resp = await Promise.race([
        fetch(
          `${baseUrl}/api/main/disconnect?mainToken=${encodeURIComponent(mainToken)}&instanceId=${encodeURIComponent(instanceId)}&generation=${encodeURIComponent(generationAtDispose)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Whale-Main-Token': mainToken,
              'X-Whale-Generation': String(generationAtDispose),
            },
            body: JSON.stringify({ instanceId, generation: generationAtDispose }),
            signal: deadline.signal,
          }
        ),
        timeoutPromise,
      ]);
      let parsed;
      try {
        parsed = await Promise.race([resp.json(), timeoutPromise]);
      } catch (err) {
        if (err && err.message === 'disconnect-timeout') throw err;
        parsed = undefined;
      }
      const hasBoolOk = !!parsed && typeof parsed === 'object' && typeof parsed.ok === 'boolean';
      if (hasBoolOk && parsed.ok === false) result = parsed;
      else if (hasBoolOk && parsed.ok === true && resp.ok) result = parsed;
      else if (!resp.ok) result = failed(`http-${resp.status}`);
      else result = failed('invalid-disconnect-result');
    } catch (err) {
      result = failed(err && err.message === 'disconnect-timeout' ? 'disconnect-timeout' : 'disconnect-failed');
    } finally {
      clearTimeout(timer);
    }
    return result;
  }

  async function fetchPreviewBlob(sceneId, { signal } = {}) {
    if (disposed) throw new Error('bridge-disposed');
    if (!baseUrl || !mainToken) throw new Error('bridge-not-connected');
    if (!sceneId) throw new Error('invalid-scene-id');

    const url = `${baseUrl}/api/wallpaper-preview?id=${encodeURIComponent(sceneId)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Whale-Main-Token': mainToken,
        'X-Whale-Instance-Id': instanceId,
        'X-Whale-Generation': String(currentGeneration),
      },
      signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`preview-fetch-failed: ${resp.status} ${errText}`);
    }

    return await resp.blob();
  }

  return {
    get instanceId() { return instanceId; },
    get revision() { return revision; },
    get generation() { return currentGeneration; },
    connect,
    getSnapshot,
    getMode: () => mode,
    hasUnconfirmedCleanup: () => unconfirmedCleanup,
    getLastError: () => lastCleanupError,
    requestDetach,
    requestDock,
    fetchPreviewBlob,
    dispose,
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
  };
}

