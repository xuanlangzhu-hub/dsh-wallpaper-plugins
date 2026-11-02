/**
 * Detachable Appearance Bridge and Synchronization Protocol (P0 Seam).
 *
 * Implements the robust authoritative seam for the "Detachable & Dockable" Whale Appearance Panel:
 * 1. Single Authoritative Controller: The main DSH Controller is the sole source of truth.
 *    No duplicate controllers, no duplicate media pipelines.
 * 2. Strict Session Lease & Authorization: Actions are strictly bound to an authenticated
 *    active session lease and generation counter. Unauthenticated or expired connections cannot mutate state.
 * 3. Serialized Transitions & Generational Cleanup: Prevents races between async detach and dock
 *    requests; enforces dedicated temp user-data-dir; guarantees prompt cleanup of aborted or orphan resources.
 * 4. Monotonic Revision Rule & Deduplication Cache: Defends against stale, duplicate, or out-of-order
 *    actions with exact revision matching and payload-fingerprinted result caching.
 * 5. Transparent Business Outcomes: Accurately reflects business rejections (preset gates, storage errors)
 *    rather than swallowing failures inside success envelopes.
 * 6. Live Subscriptions & Stability: Subscribes to settings, presets, and wallpaper status;
 *    updates snapshots without infinite echo loops on identical setting values.
 */

import {
  PROTOCOL_VERSION,
  DETACHABLE_MODES,
  DETACHABLE_ACTIONS,
  ALLOWED_SETTING_KEYS,
  RANGE_BOUNDS,
  ALLOWED_ENUMS,
  BOOLEAN_KEYS,
  HEX_COLOR_PATTERN,
  CATALOG_ID_PATTERN,
  isSceneId,
  generateUuid,
  buildAppearanceSnapshot,
  validateDetachableAction,
  createCompanionClient,
  createHttpCompanionTransport,
  createMockTransportPair,
  STANDARD_EDGE_PATHS,
  findEdgeExecutable,
  buildEdgeAppLaunchSpec,
  executeAuthoritativeAction,
  createMainRendererBridgeClient,
} from './detachable-contract.js';

// Re-export contract members for complete backwards compatibility
export {
  PROTOCOL_VERSION,
  DETACHABLE_MODES,
  DETACHABLE_ACTIONS,
  ALLOWED_SETTING_KEYS,
  RANGE_BOUNDS,
  ALLOWED_ENUMS,
  BOOLEAN_KEYS,
  HEX_COLOR_PATTERN,
  CATALOG_ID_PATTERN,
  isSceneId,
  generateUuid,
  buildAppearanceSnapshot,
  validateDetachableAction,
  createCompanionClient,
  createHttpCompanionTransport,
  createMockTransportPair,
  STANDARD_EDGE_PATHS,
  findEdgeExecutable,
  buildEdgeAppLaunchSpec,
  executeAuthoritativeAction,
  createMainRendererBridgeClient,
};


/**
 * Creates the authoritative Main DSH Detachable Bridge.
 *
 * @param controller - Authoritative main DSH appearance controller
 * @param options - Configuration options (instanceId, windowAdapter, hostPort, profileDir, edgePath)
 */
export function createDetachableBridge(controller, options = {}) {
  const instanceId = options.instanceId ?? generateUuid();
  const windowAdapter = options.windowAdapter ?? null;
  const hostPort = options.hostPort ?? 19387;

  let revision = 1;
  let mode = DETACHABLE_MODES.DOCKED;
  let activeToken = null;
  let currentGeneration = 0;
  let activeSession = null; // { leaseId, generation, transport, actionCache: Map, closed: false }
  let activeOwnedHandle = null;
  let unconfirmedCleanup = false;
  let lastCleanupError = null;
  let inFlightOperation = null;
  let disposed = false;
  let disposePromise = null;
  let transitionMutex = Promise.resolve();

  const subscribers = new Set();
  let snapshot = buildAppearanceSnapshot(controller, revision);

  const notifySubscribers = () => {
    snapshot = buildAppearanceSnapshot(controller, revision);
    for (const sub of subscribers) {
      try {
        sub({ snapshot, mode, revision, generation: currentGeneration, unconfirmedCleanup });
      } catch {}
    }
    if (activeSession && !activeSession.closed && typeof activeSession.transport?.sendSnapshot === 'function') {
      try {
        activeSession.transport.sendSnapshot(snapshot);
      } catch {}
    }
  };

  // Run async transitions sequentially to prevent concurrent race conditions
  const executeTransition = (transitionFn) => {
    const next = transitionMutex
      .catch(() => {})
      .then(async () => {
        if (disposed) return { ok: false, error: 'disposed' };
        return await transitionFn();
      });
    transitionMutex = next.catch(() => {});
    return next;
  };

  // Subscribe to controller settings changes
  let unsubscribeSettings = null;
  if (typeof controller.subscribeSettings === 'function') {
    unsubscribeSettings = controller.subscribeSettings(() => {
      revision++;
      notifySubscribers();
    });
  }

  // Subscribe to controller preset changes
  let unsubscribePresets = null;
  if (typeof controller.presets?.subscribe === 'function') {
    unsubscribePresets = controller.presets.subscribe(() => {
      revision++;
      notifySubscribers();
    });
  }

  // Subscribe to wallpaper status changes
  let unsubscribeWallpaper = null;
  if (typeof controller.wallpaper?.subscribeStatus === 'function') {
    unsubscribeWallpaper = controller.wallpaper.subscribeStatus(() => {
      revision++;
      notifySubscribers();
    });
  }

  // Subscribe to library changes
  let unsubscribeLibrary = null;
  if (typeof controller.wallpaper?.subscribeLibrary === 'function') {
    unsubscribeLibrary = controller.wallpaper.subscribeLibrary(() => {
      revision++;
      notifySubscribers();
    });
  }

  const bridge = {
    get instanceId() {
      return instanceId;
    },
    get revision() {
      return revision;
    },
    get generation() {
      return currentGeneration;
    },
    get disposed() {
      return disposed;
    },
    getMode: () => mode,
    getSnapshot: () => snapshot,
    getActiveToken: () => activeToken,
    hasUnconfirmedCleanup: () => unconfirmedCleanup,

    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    /**
     * Request transition to Detached mode (Pop out into standalone OS window).
     */
    requestDetach() {
      return executeTransition(async () => {
        if (disposed) return { ok: false, error: 'disposed' };

        // Prevent new window spawn when previous window close failed/unconfirmed
        if (unconfirmedCleanup) {
          return {
            ok: false,
            error: 'previous-window-still-open',
            details: lastCleanupError,
            mode,
            ownedHandle: activeOwnedHandle,
          };
        }

        // Idempotency: if already DETACHED or DETACHING, do not spawn a second window or reissue token
        if (mode === DETACHABLE_MODES.DETACHED || mode === DETACHABLE_MODES.DETACHING) {
          return {
            ok: true,
            mode,
            alreadyDetached: true,
            token: activeToken,
            instanceId,
            generation: currentGeneration,
            ownedHandle: activeOwnedHandle,
          };
        }

        currentGeneration++;
        const targetGeneration = currentGeneration;

        mode = DETACHABLE_MODES.DETACHING;
        activeToken = generateUuid();
        notifySubscribers();

        if (windowAdapter && typeof windowAdapter.spawn === 'function') {
          inFlightOperation = (async () => {
            const spec = buildEdgeAppLaunchSpec({
              hostPort,
              token: activeToken,
              instanceId,
              profileDir: options.profileDir,
              edgePath: options.edgePath,
            });

            let handle = null;
            try {
              const res = await windowAdapter.spawn(spec);
              handle = res || { spec, instanceId, generation: targetGeneration };
              activeOwnedHandle = handle;
            } catch (error) {
              mode = DETACHABLE_MODES.DOCKED;
              activeToken = null;
              activeOwnedHandle = null;
              notifySubscribers();
              return { ok: false, error: `window-launch-failed: ${error.message}` };
            }

            // Guard against cancellation/disposal during async spawn
            if (disposed || currentGeneration !== targetGeneration) {
              if (windowAdapter && typeof windowAdapter.close === 'function') {
                try {
                  await windowAdapter.close(handle);
                  activeOwnedHandle = null;
                  unconfirmedCleanup = false;
                  lastCleanupError = null;
                } catch (closeErr) {
                  activeOwnedHandle = handle;
                  unconfirmedCleanup = true;
                  lastCleanupError = closeErr.message;
                  notifySubscribers();
                  return { ok: false, error: `window-close-failed: ${closeErr.message}`, handle };
                }
              }
              if (disposed) return { ok: false, error: 'disposed' };
              return { ok: false, error: 'transition-cancelled' };
            }

            activeOwnedHandle = handle;
            return {
              ok: true,
              mode,
              token: activeToken,
              instanceId,
              generation: targetGeneration,
              ownedHandle: handle,
            };
          })();

          const res = await inFlightOperation;
          inFlightOperation = null;
          return res;
        }

        return { ok: true, mode, token: activeToken, instanceId, generation: targetGeneration };
      });
    },

    /**
     * Request transition to Docked mode (Dock back into DSH overlay).
     */
    requestDock() {
      return executeTransition(async () => {
        if (disposed) return { ok: false, error: 'disposed' };
        if (mode === DETACHABLE_MODES.DOCKED && !activeSession && !activeToken && !unconfirmedCleanup && activeOwnedHandle == null) {
          return { ok: true, mode, alreadyDocked: true };
        }

        currentGeneration++;
        const targetGeneration = currentGeneration;

        mode = DETACHABLE_MODES.DOCKING;
        notifySubscribers();

        // Gracefully close active companion session and invalidate lease
        if (activeSession) {
          activeSession.closed = true;
          try {
            activeSession.transport.sendDockedNotice?.();
            activeSession.transport.close?.();
          } catch {}
          activeSession = null;
        }

        // Close window via adapter with owned handle
        if (windowAdapter && typeof windowAdapter.close === 'function') {
          try {
            await windowAdapter.close(activeOwnedHandle);
            activeOwnedHandle = null;
            unconfirmedCleanup = false;
            lastCleanupError = null;
          } catch (error) {
            unconfirmedCleanup = true;
            lastCleanupError = error.message;
            notifySubscribers();
            return { ok: false, error: `window-close-failed: ${error.message}`, mode };
          }
        }

        if (disposed || currentGeneration !== targetGeneration) {
          if (disposed) return { ok: false, error: 'disposed' };
          return { ok: false, error: 'transition-superseded' };
        }

        activeToken = null;
        mode = DETACHABLE_MODES.DOCKED;
        notifySubscribers();
        return { ok: true, mode: DETACHABLE_MODES.DOCKED };
      });
    },

    /**
     * Handle companion handshake connection.
     * Burns the single-use token and binds a connection capability lease.
     */
    handleCompanionConnect({ token, instanceId: suppliedInstanceId, transport }) {
      if (disposed) return { ok: false, error: 'disposed' };
      if (!token || token !== activeToken) {
        return { ok: false, error: 'unauthorized-token' };
      }
      if (mode !== DETACHABLE_MODES.DETACHING) {
        return { ok: false, error: 'unauthorized-not-detaching' };
      }
      if (!suppliedInstanceId || suppliedInstanceId !== instanceId) {
        return { ok: false, error: 'unauthorized-instance' };
      }

      // Single-use token: immediately burn token upon handshake
      activeToken = null;

      // Close previous session if any
      if (activeSession) {
        activeSession.closed = true;
        try {
          activeSession.transport.close?.();
        } catch {}
      }

      const leaseId = generateUuid();
      const session = {
        leaseId,
        generation: currentGeneration,
        transport,
        actionCache: new Map(),
        closed: false,
      };

      activeSession = session;
      mode = DETACHABLE_MODES.DETACHED;

      // Attach transport listeners with session capability binding
      if (transport && typeof transport.onAction === 'function') {
        transport.onAction((action) =>
          bridge.handleCompanionAction(action, { leaseId: session.leaseId, generation: session.generation })
        );
      }
      if (transport && typeof transport.onDisconnect === 'function') {
        transport.onDisconnect(() =>
          bridge.handleCompanionDisconnect(transport, session.generation)
        );
      }

      notifySubscribers();
      return { ok: true, snapshot, leaseId, generation: session.generation };
    },

    /**
     * Handle constrained action submitted by companion window.
     */
    async handleCompanionAction(action, capability) {
      if (disposed) {
        return { ok: false, error: 'disposed', snapshot: bridge.getSnapshot() };
      }

      // Defensive check for non-object/null action before reading any properties
      if (!action || typeof action !== 'object' || Array.isArray(action)) {
        return { ok: false, error: 'action-invalid-object', snapshot: bridge.getSnapshot() };
      }

      // Capability & session verification
      if (!capability || typeof capability !== 'object') {
        return { ok: false, error: 'unauthorized-no-capability', snapshot: bridge.getSnapshot() };
      }
      if (
        !activeSession ||
        activeSession.closed ||
        capability.leaseId !== activeSession.leaseId ||
        capability.generation !== activeSession.generation
      ) {
        return { ok: false, error: 'unauthorized-session-expired', snapshot: bridge.getSnapshot() };
      }
      const session = activeSession;
      if (mode !== DETACHABLE_MODES.DETACHED) {
        return { ok: false, error: 'invalid-mode', mode, snapshot: bridge.getSnapshot() };
      }

      const executionResult = await executeAuthoritativeAction({
        controller,
        action,
        expectedRevisionCheck: true,
        currentRevision: revision,
        actionCache: session.actionCache,
        onRequestDock: () => bridge.requestDock(),
        getSnapshot: () => bridge.getSnapshot(),
      });

      // If controller did not auto-publish, increment revision and notify
      if (!unsubscribeSettings && !unsubscribePresets && executionResult.ok) {
        revision++;
        notifySubscribers();
      }

      return executionResult;
    },


    /**
     * Handle companion disconnection.
     * Verifies generation to ignore delayed disconnects from earlier sessions.
     */
    handleCompanionDisconnect(transport, disconnectGen) {
      if (
        !activeSession ||
        activeSession.transport !== transport ||
        activeSession.generation !== disconnectGen
      ) {
        // Disconnect from older superseded session; ignore
        return;
      }

      activeSession.closed = true;
      activeSession = null;
      activeToken = null;

      // Transport disconnected, but is the owned window closed?
      // Attempt to close the owned window via windowAdapter
      return executeTransition(async () => {
        if (disposed) return;
        if (activeOwnedHandle != null && windowAdapter && typeof windowAdapter.close === 'function') {
          try {
            await windowAdapter.close(activeOwnedHandle);
            activeOwnedHandle = null;
            unconfirmedCleanup = false;
            lastCleanupError = null;
            mode = DETACHABLE_MODES.DOCKED;
          } catch (err) {
            unconfirmedCleanup = true;
            lastCleanupError = err.message;
            mode = DETACHABLE_MODES.DOCKING;
          }
        } else if (activeOwnedHandle != null) {
          // Window exit not confirmed
          unconfirmedCleanup = true;
          lastCleanupError = 'disconnected-window-not-closed';
          mode = DETACHABLE_MODES.DOCKING;
        } else {
          mode = DETACHABLE_MODES.DOCKED;
        }
        notifySubscribers();
      });
    },

    getActiveOwnedHandle: () => activeOwnedHandle,

    confirmWindowExit(handle) {
      if (handle == null || handle === activeOwnedHandle) {
        activeOwnedHandle = null;
        unconfirmedCleanup = false;
        lastCleanupError = null;
        if (mode === DETACHABLE_MODES.DOCKING) {
          mode = DETACHABLE_MODES.DOCKED;
        }
        notifySubscribers();
        return true;
      }
      return false;
    },

    /**
     * Teardown on DSH or plugin unload.
     * Idempotent: returns the same awaitable Promise. Waits for in-flight spawn and returns true close result.
     */
    dispose() {
      if (disposePromise) return disposePromise;
      disposed = true;
      currentGeneration++;

      if (unsubscribeSettings) {
        try { unsubscribeSettings(); } catch {}
        unsubscribeSettings = null;
      }
      if (unsubscribePresets) {
        try { unsubscribePresets(); } catch {}
        unsubscribePresets = null;
      }
      if (unsubscribeWallpaper) {
        try { unsubscribeWallpaper(); } catch {}
        unsubscribeWallpaper = null;
      }
      if (unsubscribeLibrary) {
        try { unsubscribeLibrary(); } catch {}
        unsubscribeLibrary = null;
      }

      subscribers.clear();

      if (activeSession) {
        activeSession.closed = true;
        try {
          activeSession.transport.close?.();
        } catch {}
        activeSession = null;
      }

      activeToken = null;

      disposePromise = (async () => {
        // Await in-flight spawn/transition to finish first
        let inFlightResult = null;
        if (inFlightOperation) {
          try {
            inFlightResult = await inFlightOperation;
          } catch (e) {
            inFlightResult = { ok: false, error: e.message };
          }
        }
        try { await transitionMutex; } catch {}

        let closeResult = { ok: true };
        if (inFlightResult && inFlightResult.error?.startsWith('window-close-failed')) {
          closeResult = inFlightResult;
        } else if (activeOwnedHandle != null && windowAdapter && typeof windowAdapter.close === 'function') {
          try {
            await windowAdapter.close(activeOwnedHandle);
            activeOwnedHandle = null;
            unconfirmedCleanup = false;
            lastCleanupError = null;
          } catch (err) {
            unconfirmedCleanup = true;
            lastCleanupError = err.message;
            closeResult = { ok: false, error: `window-close-failed: ${err.message}`, handle: activeOwnedHandle };
          }
        } else if (unconfirmedCleanup) {
          closeResult = { ok: false, error: `window-close-failed: ${lastCleanupError}`, handle: activeOwnedHandle };
        }

        if (closeResult.ok) {
          mode = DETACHABLE_MODES.DOCKED;
        }

        notifySubscribers();
        return closeResult;
      })();

      return disposePromise;
    },
  };

  return bridge;
}
