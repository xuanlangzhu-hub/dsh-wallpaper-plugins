/**
 * Node.js Plugin Host Loopback Server for Detachable Appearance Companion.
 *
 * Implements the unified server-side boundary:
 * 1. Binds strictly to 127.0.0.1 (loopback only) on an ephemeral or specified port.
 * 2. Origin verification: only accepts requests originating from allowed origins
 *    (host loopback origin or explicitly configured allowedOrigins). Rejects foreign origins with 403 Forbidden.
 * 3. Endpoint authentication & session binding:
 *    - /api/connect: requires single-use token and instanceId matching active main session.
 *    - /api/events: SSE event stream; requires active leaseId and generation.
 *    - /api/snapshot: requires active capability leaseId bound to current main generation.
 *    - /api/action: requires capability leaseId and generation.
 *    - /api/disconnect: companion graceful disconnect; invalidates lease and cleans up owned window.
 *    - /api/main/*: Main Renderer communication channel (bound to secure mainToken, instanceId, and generation).
 *    - Rejects missing/expired credentials with 401 Unauthorized.
 * 4. Main instance disconnect & lifecycle protection:
 *    - If bridge or main session is disposed, disconnected, or abruptly lost, invalidates companion
 *      leases immediately (subsequent reads return 503 Service Unavailable) and cleans up owned window.
 * 5. Unified Window Ownership:
 *    - Sole manager of OS window process lifecycle (spawn/close via windowAdapter).
 *    - Idempotent requestDetach, serialized transitions, error visibility on close failure,
 *      and guaranteed handle cleanup on disconnect, dock, main loss, or host stop.
 * 6. Structured body parser with size limits and robust error handling.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTOCOL_VERSION,
  DETACHABLE_MODES,
  DETACHABLE_ACTIONS,
  validateDetachableAction,
  buildEdgeAppLaunchSpec,
  isSceneId,
  parseAgeRatings,
} from './detachable-contract.js';
import { createAuthorPropertiesHost } from './wallpaper/author-properties-host.js';
import { createEdgeWindowAdapter } from './detachable-edge-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const STATIC_MANIFEST = Object.freeze({
  '/': Object.freeze({ file: join(__dirname, 'companion/index.html'), contentType: 'text/html; charset=utf-8' }),
  '/index.html': Object.freeze({ file: join(__dirname, 'companion/index.html'), contentType: 'text/html; charset=utf-8' }),
  '/companion.js': Object.freeze({ file: join(__dirname, 'companion/companion.js'), contentType: 'application/javascript; charset=utf-8' }),
  '/companion.css': Object.freeze({ file: join(__dirname, 'companion/companion.css'), contentType: 'text/css; charset=utf-8' }),
  '/wallpaper/author-properties-panel.js': Object.freeze({file:join(__dirname,'wallpaper/author-properties-panel.js'),contentType:'application/javascript; charset=utf-8'}),
  '/wallpaper/author-properties-contract.js': Object.freeze({file:join(__dirname,'wallpaper/author-properties-contract.js'),contentType:'application/javascript; charset=utf-8'}),
  '/wallpaper/managed-window.js': Object.freeze({file:join(__dirname,'wallpaper/managed-window.js'),contentType:'application/javascript; charset=utf-8'}),
  '/detachable-contract.js': Object.freeze({ file: join(__dirname, 'detachable-contract.js'), contentType: 'application/javascript; charset=utf-8' }),
});

export const STATIC_SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
});

function readJsonBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    let data = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > limit) {
        req.destroy();
        reject(new Error('payload-too-large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch {
        reject(new Error('invalid-json'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

export function createDetachableHttpHost({
  library = null,
  readWallpaperLifecycle = null,
  authorApplyAdapter = null,
  bridge = null,
  port = 0,
  allowedOrigins = [],
  mainAllowedOrigins = null,
  companionAllowedOrigins = [],
  mainToken = null,
  windowAdapter = null,
  profileDir = null,
  edgePath = null,
} = {}) {
  const resolvedMainToken =
    typeof mainToken === 'string' && mainToken.length > 0 ? mainToken : randomUUID();
  const resolvedMainOrigins = (mainAllowedOrigins || allowedOrigins || []).filter(Boolean);
  const resolvedCompanionOrigins = (companionAllowedOrigins || []).filter(Boolean);
  const resolvedWindowAdapter =
    windowAdapter === 'auto' || windowAdapter === true
      ? createEdgeWindowAdapter({ edgePath, profileDir })
      : windowAdapter;

  let activePreviewReads = 0;
  const MAX_CONCURRENT_PREVIEW_READS = 8;
  const PREVIEW_READ_TIMEOUT_MS = 3000;

  let server = null;
  let activePort = null;
  let started = false;

  let mainRegistrationGeneration = 0;
  let popupWindowGeneration = 0;
  let latestRegistrationIntentId = 0;
  let hostMode = DETACHABLE_MODES.DOCKED;
  let activeToken = null;
  let activeTokenInstanceId = null;
  let activeOwnedHandle = null;
  let unconfirmedCleanup = false;
  let lastCleanupError = null;
  let transitionMutex = Promise.resolve();
  const windowActionCache = new Map();

  let activeSession = null; // Companion session
  let mainSession = null; // Main Renderer session
  let lastTerminatedLeaseId = null;
  let lastTerminatedMainGen = null;

  // Shares the authenticated main controller's selection/policy and Host-owned playback state.
  // Both views share one owner; companion credentials never become settings or target data.
  const authorOwner = () => mainSession ? `main:${mainSession.generation}` : null;
  const strictGeneration = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const authorHost = typeof library?.getAuthorMetadata === 'function' && typeof readWallpaperLifecycle === 'function'
    ? createAuthorPropertiesHost({library,applyAdapter:authorApplyAdapter,root:'/api/author-properties',readContext(req){
        if (!mainSession) return null;
        const headers=req.headers, gen=strictGeneration(headers['x-whale-generation']);
        const isMain=headers['x-whale-main-token'] === resolvedMainToken
          && headers['x-whale-instance-id'] === mainSession.instanceId && gen === mainSession.generation;
        const isCompanion=!headers['x-whale-main-token'] && activeSession
          && headers['x-whale-lease'] === activeSession.leaseId && gen === activeSession.mainGeneration
          && activeSession.mainGeneration === mainSession.generation;
        if (!isMain && !isCompanion) return null;
        // Credential-specific origin rules: a companion origin cannot impersonate main.
        const origin=headers.origin;
        if (origin && (isMain
          ? !(origin==='dsh-app://app'||resolvedMainOrigins.includes(origin))
          : !(origin===`http://127.0.0.1:${activePort}`||origin===`http://localhost:${activePort}`||resolvedCompanionOrigins.includes(origin)))) return null;
        const snapshot=mainSession.snapshot;
        return {authorized:true,owner:authorOwner(),revision:snapshot?.revision,
          selectedId:snapshot?.settings?.weScene,allowedRatings:parseAgeRatings(snapshot?.settings?.weAgeRatings),
          lifecycle:readWallpaperLifecycle()};
      }}) : null;

  const notifyMainRendererWindowState = () => {
    if (mainSession?.actionsSseRes && !mainSession.actionsSseRes.writableEnded) {
      try {
        const payload = {
          mode: hostMode,
          generation: mainSession.generation,
          popupGeneration: popupWindowGeneration,
          unconfirmedCleanup,
          lastError: lastCleanupError,
        };
        mainSession.actionsSseRes.write(`event: window-state\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    }
  };

  function verifyMainRequest(req, parsedUrl, body) {
    const suppliedMainToken =
      req.headers['x-whale-main-token'] || parsedUrl.searchParams.get('mainToken');
    if (!mainSession || suppliedMainToken !== resolvedMainToken) {
      return { ok: false, status: 401, error: 'unauthorized-main-token' };
    }

    const suppliedInstance =
      body?.instanceId ||
      req.headers['x-whale-instance-id'] ||
      parsedUrl.searchParams.get('instanceId');
    if (!suppliedInstance || suppliedInstance !== mainSession.instanceId) {
      return { ok: false, status: 403, error: 'unauthorized-instance' };
    }

    const genHeader = req.headers['x-whale-generation'];
    const genParam = parsedUrl.searchParams.get('generation');
    const suppliedGen =
      body?.generation ??
      (genHeader ? parseInt(genHeader, 10) : undefined) ??
      (genParam ? parseInt(genParam, 10) : undefined);
    if (suppliedGen == null || suppliedGen !== mainSession.generation) {
      return { ok: false, status: 403, error: 'unauthorized-generation' };
    }

    return { ok: true };
  }

  const executeTransition = (fn) => {
    const next = transitionMutex
      .catch(() => {})
      .then(async () => {
        return await fn();
      });
    transitionMutex = next.catch(() => {});
    return next;
  };

  const performWindowCleanup = async () => {
    let closeResult = { ok: true };
    if (activeOwnedHandle != null && resolvedWindowAdapter && typeof resolvedWindowAdapter.close === 'function') {
      const handleToClose = activeOwnedHandle;
      try {
        const res = await resolvedWindowAdapter.close(handleToClose);
        if (res && res.ok === false) {
          unconfirmedCleanup = true;
          lastCleanupError = res.error || 'window-close-failed';
          closeResult = { ok: false, error: lastCleanupError, handle: handleToClose };
        } else {
          activeOwnedHandle = null;
          unconfirmedCleanup = false;
          lastCleanupError = null;
          closeResult = { ok: true, ...(res || {}) };
        }
      } catch (err) {
        unconfirmedCleanup = true;
        lastCleanupError = err.message;
        closeResult = { ok: false, error: `window-close-failed: ${err.message}`, handle: handleToClose };
      }
    }
    if (closeResult.ok) {
      hostMode = DETACHABLE_MODES.DOCKED;
      activeToken = null;
      activeTokenInstanceId = null;
    } else {
      hostMode = DETACHABLE_MODES.DOCKING;
    }
    return closeResult;
  };

  const terminateCompanionSession = (reason = 'disconnect') => {
    if (activeSession) {
      const sess = activeSession;
      lastTerminatedLeaseId = sess.leaseId;
      lastTerminatedMainGen = sess.mainGeneration;
      activeSession = null;
      if (sess.sseRes && !sess.sseRes.writableEnded) {
        try {
          sess.sseRes.write(`event: ${reason}\ndata: {}\n\n`);
          sess.sseRes.end();
        } catch {}
      }
    }
  };

  const terminateMainSession = (reason = 'main-instance-disconnected') => {
    if (mainSession) {
      const sess = mainSession;
      authorHost?.clearOwner(authorOwner());
      mainSession = null;
      if (sess.actionsSseRes && !sess.actionsSseRes.writableEnded) {
        try {
          sess.actionsSseRes.end();
        } catch {}
      }
      if (sess.pendingActions) {
        for (const pending of sess.pendingActions.values()) {
          try {
            clearTimeout(pending.timer);
            pending.resolveAction({ ok: false, error: reason });
          } catch {}
        }
        sess.pendingActions.clear();
      }
    }
  };

  const serverPromise = new Promise((resolve, reject) => {
    server = createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort || 0}`);
      const pathname = parsedUrl.pathname;
      const origin = req.headers['origin'];

      // Origin verification
      const isAllowedOrigin = (orig) => {
        if (!orig || typeof orig !== 'string') return false;
        if (orig === 'null') return false; // Reject null unconditionally

        if (pathname.startsWith('/api/main/') || pathname === '/api/wallpaper-preview' || pathname === '/api/wallpaper/preview' || pathname.startsWith('/api/author-properties/')) {
          // Main renderer endpoint or wallpaper preview: official Desktop app origin or configured main allowed origins
          if (orig === 'dsh-app://app') return true;
          if (resolvedMainOrigins.includes(orig)) return true;
          if (pathname === '/api/wallpaper-preview' || pathname === '/api/wallpaper/preview' || pathname.startsWith('/api/author-properties/')) {
            const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
            const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
            if (myOrigin && orig === myOrigin) return true;
            if (myLocalhost && orig === myLocalhost) return true;
            if (resolvedCompanionOrigins.includes(orig)) return true;
          }
          return false;
        }

        // Companion window endpoints: strictly companion's own origin or explicit companionAllowedOrigins
        const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
        const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
        if (myOrigin && orig === myOrigin) return true;
        if (myLocalhost && orig === myLocalhost) return true;
        if (resolvedCompanionOrigins.includes(orig)) return true;

        return false;
      };

      if (origin) {
        if (!isAllowedOrigin(origin)) {
          sendJson(res, 403, { ok: false, error: 'forbidden-origin' });
          return;
        }

        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Whale-Lease, X-Whale-Generation, X-Whale-Main-Token, X-Whale-Instance-Id, Accept'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // -------------------------------------------------------------
      // Static Companion Assets & Security Boundary
      // -------------------------------------------------------------
      if (!pathname.startsWith('/api/')) {
        // Strict path traversal / encoding escape defense
        if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0') || /%2e/i.test(req.url || '')) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_SECURITY_HEADERS });
          res.end('bad-path');
          return;
        }

        // Method enforcement: only GET and HEAD permitted on static assets
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { 'Allow': 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_SECURITY_HEADERS });
          res.end('method-not-allowed');
          return;
        }

        if (pathname === '/favicon.ico') {
          res.writeHead(204, STATIC_SECURITY_HEADERS);
          res.end();
          return;
        }

        const staticEntry = STATIC_MANIFEST[pathname];
        if (!staticEntry) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_SECURITY_HEADERS });
          res.end('not-found');
          return;
        }

        try {
          const content = await readFile(staticEntry.file);
          res.writeHead(200, {
            'Content-Type': staticEntry.contentType,
            'Content-Length': Buffer.byteLength(content),
            ...STATIC_SECURITY_HEADERS,
          });
          if (req.method === 'HEAD') {
            res.end();
          } else {
            res.end(content);
          }
          return;
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_SECURITY_HEADERS });
          res.end('internal-server-error');
          return;
        }
      }

      // -------------------------------------------------------------
      // Main Renderer Remote Bridge Endpoints (/api/main/*)
      // -------------------------------------------------------------
      if (pathname.startsWith('/api/author-properties/')) {
        // Only typed author routes; plan and private Host modules stay inaccessible.
        if (!authorHost || pathname==='/api/author-properties/apply'&&!authorApplyAdapter || !['/api/author-properties/schema','/api/author-properties/draft','/api/author-properties/apply'].includes(pathname)) {
          sendJson(res,404,{ok:false,error:'author_route_unknown'});return;
        }
        await authorHost.handler(req,res);return;
      }
      if (pathname.startsWith('/api/main/')) {
        const suppliedMainToken =
          req.headers['x-whale-main-token'] || parsedUrl.searchParams.get('mainToken');

        if (pathname === '/api/main/connect' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch (err) {
            sendJson(res, 400, { ok: false, error: err.message });
            return;
          }
          if (!body || body.mainToken !== resolvedMainToken) {
            sendJson(res, 401, { ok: false, error: 'unauthorized-main-token' });
            return;
          }
          if (!body.instanceId || typeof body.instanceId !== 'string') {
            sendJson(res, 400, { ok: false, error: 'missing-instance-id' });
            return;
          }

          const myIntent = ++latestRegistrationIntentId;

          // If previous mainSession was active, tear down old companion leases and window
          if (mainSession) {
            terminateCompanionSession('disconnect');
            terminateMainSession('main-instance-replaced');
            await executeTransition(() => performWindowCleanup());
          }

          // If a newer registration intent entered during the await, do not install old intent
          if (myIntent !== latestRegistrationIntentId) {
            sendJson(res, 409, { ok: false, error: 'registration-superseded' });
            return;
          }

          mainRegistrationGeneration++;
          const targetGen = mainRegistrationGeneration;

          mainSession = {
            instanceId: body.instanceId,
            generation: targetGen,
            snapshot: body.snapshot,
            actionsSseRes: null,
            pendingActions: new Map(),
          };
          sendJson(res, 200, { ok: true, generation: targetGen });
          return;
        }

        // All subsequent /api/main/* endpoints require an active mainSession and valid credentials
        if (!mainSession || suppliedMainToken !== resolvedMainToken) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-main-token' });
          return;
        }

        if (pathname === '/api/main/actions' && req.method === 'GET') {
          const auth = verifyMainRequest(req, parsedUrl, null);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
          });
          res.write(': ok\n\n');
          mainSession.actionsSseRes = res;
          notifyMainRendererWindowState();

          const pingInterval = setInterval(() => {
            if (res.writableEnded || !mainSession || mainSession.actionsSseRes !== res) {
              clearInterval(pingInterval);
              return;
            }
            try {
              res.write(': ping\n\n');
            } catch {
              clearInterval(pingInterval);
            }
          }, 300);

          const onMainDisconnect = (source) => {
            clearInterval(pingInterval);
            if (mainSession && mainSession.actionsSseRes === res) {
              mainSession.actionsSseRes = null;
              terminateMainSession('main-instance-disconnected');
              terminateCompanionSession('disconnect');
              executeTransition(() => performWindowCleanup()).catch(() => {});
            }
          };

          req.on('close', () => onMainDisconnect('req-close'));
          res.on('close', () => onMainDisconnect('res-close'));
          req.socket?.on('close', () => onMainDisconnect('socket-close'));
          return;
        }

        if (pathname === '/api/main/snapshot' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch {}

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          if (body.snapshot) {
            if (
              mainSession.snapshot?.revision != null &&
              body.snapshot.revision != null &&
              body.snapshot.revision < mainSession.snapshot.revision
            ) {
              sendJson(res, 400, { ok: false, error: 'stale-revision' });
              return;
            }
            mainSession.snapshot = body.snapshot;
            if (activeSession?.sseRes && !activeSession.sseRes.writableEnded) {
              try {
                activeSession.sseRes.write(
                  `event: snapshot\ndata: ${JSON.stringify(body.snapshot)}\n\n`
                );
              } catch {}
            }
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === '/api/main/action-result' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch {}

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          const { clientActionId, result } = body || {};
          if (clientActionId && mainSession.pendingActions.has(clientActionId)) {
            const pending = mainSession.pendingActions.get(clientActionId);
            mainSession.pendingActions.delete(clientActionId);
            clearTimeout(pending.timer);
            if (result?.snapshot) {
              mainSession.snapshot = result.snapshot;
            }
            pending.resolveAction(result);
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === '/api/main/detach' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch {}

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          const targetMainGen = mainSession.generation;

          const detachResult = await executeTransition(async () => {
            if (!mainSession || mainSession.generation !== targetMainGen) {
              return { ok: false, error: 'main-instance-disconnected' };
            }

            if (unconfirmedCleanup) {
              return {
                ok: false,
                error: 'previous-window-still-open',
                details: lastCleanupError,
                mode: hostMode,
                unconfirmedCleanup: true,
                ownedHandle: activeOwnedHandle,
              };
            }

            // Idempotency: if already DETACHED or DETACHING, do not spawn a second window
            if (hostMode === DETACHABLE_MODES.DETACHED || hostMode === DETACHABLE_MODES.DETACHING) {
              return {
                ok: true,
                mode: hostMode,
                alreadyDetached: true,
                token: activeToken,
                instanceId: mainSession.instanceId,
                generation: targetMainGen,
                popupGeneration: popupWindowGeneration,
                ownedHandle: activeOwnedHandle,
              };
            }

            hostMode = DETACHABLE_MODES.DETACHING;
            activeToken = randomUUID();
            activeTokenInstanceId = mainSession.instanceId;
            popupWindowGeneration++;
            const targetPopupGen = popupWindowGeneration;

            notifyMainRendererWindowState();

            if (resolvedWindowAdapter && typeof resolvedWindowAdapter.spawn === 'function') {
              const spec = buildEdgeAppLaunchSpec({
                hostPort: activePort,
                token: activeToken,
                instanceId: mainSession.instanceId,
                profileDir,
                edgePath,
                companionPath: '/index.html',
              });

              let handle = null;
              try {
                handle = await resolvedWindowAdapter.spawn(spec);
                activeOwnedHandle =
                  handle || { spec, instanceId: mainSession.instanceId, generation: targetPopupGen };
              } catch (err) {
                hostMode = DETACHABLE_MODES.DOCKED;
                activeToken = null;
                activeTokenInstanceId = null;
                activeOwnedHandle = null;
                notifyMainRendererWindowState();
                return { ok: false, error: `window-launch-failed: ${err.message}` };
              }

              if (!mainSession || mainSession.generation !== targetMainGen) {
                await performWindowCleanup();
                notifyMainRendererWindowState();
                return { ok: false, error: 'transition-cancelled' };
              }
            }

            return {
              ok: true,
              mode: hostMode,
              token: activeToken,
              instanceId: mainSession.instanceId,
              generation: targetMainGen,
              popupGeneration: targetPopupGen,
              ownedHandle: activeOwnedHandle,
            };
          });

          sendJson(res, 200, detachResult);
          return;
        }

        if (pathname === '/api/main/dock' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch {}

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          const targetMainGen = mainSession.generation;

          const dockResult = await executeTransition(async () => {
            if (!mainSession || mainSession.generation !== targetMainGen) {
              return { ok: false, error: 'main-instance-disconnected' };
            }

            hostMode = DETACHABLE_MODES.DOCKING;
            notifyMainRendererWindowState();

            const closeRes = await performWindowCleanup();
            notifyMainRendererWindowState();

            if (!closeRes.ok) {
              return {
                ok: false,
                error: closeRes.error,
                mode: hostMode,
                unconfirmedCleanup: true,
                snapshot: mainSession?.snapshot,
              };
            }

            terminateCompanionSession('docked');
            return {
              ok: true,
              mode: DETACHABLE_MODES.DOCKED,
              unconfirmedCleanup: false,
              snapshot: mainSession?.snapshot,
            };
          });

          sendJson(res, 200, dockResult);
          return;
        }

        if (pathname === '/api/main/disconnect' && req.method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch {}

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          const targetMainGen = mainSession.generation;
          const targetInstanceId = mainSession.instanceId;

          const disconnectResult = await executeTransition(async () => {
            if (!mainSession || mainSession.generation !== targetMainGen || mainSession.instanceId !== targetInstanceId) {
              return { ok: false, error: 'transition-superseded' };
            }
            terminateCompanionSession('disconnect');
            terminateMainSession('main-instance-disconnected');
            const closeRes = await performWindowCleanup();
            notifyMainRendererWindowState();
            if (!closeRes.ok) return closeRes;
            return { ok: true };
          });

          const status = (!disconnectResult.ok && disconnectResult.error === 'transition-superseded') ? 409 : 200;
          sendJson(res, status, disconnectResult);
          return;
        }
      }

      // -------------------------------------------------------------
      // Companion Window Endpoints (/api/*)
      // -------------------------------------------------------------

      // 1. POST /api/connect: Companion Handshake
      if (req.method === 'POST' && pathname === '/api/connect') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message });
          return;
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { ok: false, error: 'invalid-json-body' });
          return;
        }

        const { token, instanceId } = body;
        if (!token) {
          sendJson(res, 401, { ok: false, error: 'missing-token' });
          return;
        }

        if (bridge) {
          const hostTransport = {
            sendSnapshot(snap) {
              if (activeSession?.sseRes && !activeSession.sseRes.writableEnded) {
                try {
                  activeSession.sseRes.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
                } catch {}
              }
            },
            sendDockedNotice() {
              if (activeSession?.sseRes && !activeSession.sseRes.writableEnded) {
                try {
                  activeSession.sseRes.write('event: docked\ndata: {}\n\n');
                } catch {}
              }
            },
            close() {
              if (activeSession?.sseRes && !activeSession.sseRes.writableEnded) {
                try {
                  activeSession.sseRes.write('event: disconnect\ndata: {}\n\n');
                  activeSession.sseRes.end();
                } catch {}
              }
            },
          };

          const connResult = bridge.handleCompanionConnect({
            token,
            instanceId,
            transport: hostTransport,
          });

          if (!connResult.ok) {
            sendJson(res, 401, connResult);
            return;
          }

          activeSession = {
            leaseId: connResult.leaseId,
            generation: connResult.generation,
            transport: hostTransport,
            sseRes: null,
          };

          sendJson(res, 200, connResult);
          return;
        }

        // Remote Main Renderer Session mode
        if (!mainSession) {
          sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
          return;
        }
        if (!activeToken || token !== activeToken) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-token' });
          return;
        }
        if (!instanceId || instanceId !== mainSession.instanceId || instanceId !== activeTokenInstanceId) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-instance' });
          return;
        }

        activeToken = null; // Single use token burned
        activeTokenInstanceId = null;
        lastTerminatedLeaseId = null;
        lastTerminatedMainGen = null;
        const leaseId = randomUUID();
        hostMode = DETACHABLE_MODES.DETACHED;
        notifyMainRendererWindowState();
        activeSession = {
          leaseId,
          instanceId: mainSession.instanceId,
          mainGeneration: mainSession.generation,
          popupGeneration: popupWindowGeneration,
          sseRes: null,
        };

        sendJson(res, 200, {
          ok: true,
          snapshot: mainSession.snapshot,
          leaseId,
          generation: mainSession.generation,
          popupGeneration: popupWindowGeneration,
        });
        return;
      }

      // 2. GET /api/events: SSE Event Stream for Live Snapshot Push
      if (req.method === 'GET' && pathname === '/api/events') {
        if (bridge?.disposed || (!bridge && !mainSession)) {
          sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
          return;
        }

        const lease = req.headers['x-whale-lease'] || parsedUrl.searchParams.get('lease');
        if (!activeSession || lease !== activeSession.leaseId) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        if (!bridge && activeSession.mainGeneration !== mainSession.generation) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        });
        res.write(': ok\n\n');

        activeSession.sseRes = res;

        req.on('close', () => {
          if (activeSession && activeSession.sseRes === res) {
            activeSession.sseRes = null;
            if (bridge) {
              bridge.handleCompanionDisconnect(activeSession.transport, activeSession.generation);
              activeSession = null;
            } else {
              terminateCompanionSession('disconnect');
              executeTransition(() => performWindowCleanup()).catch(() => {});
            }
          }
        });
        return;
      }

      // 3. POST /api/disconnect: Explicit Companion Window Disconnect
      if (req.method === 'POST' && pathname === '/api/disconnect') {
        const leaseHeader = req.headers['x-whale-lease'];
        if (!activeSession || leaseHeader !== activeSession.leaseId) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        const sess = activeSession;
        activeSession = null;

        if (sess.sseRes && !sess.sseRes.writableEnded) {
          try {
            sess.sseRes.write('event: disconnect\ndata: {}\n\n');
            sess.sseRes.end();
          } catch {}
        }

        if (bridge) {
          await bridge.handleCompanionDisconnect(sess.transport, sess.generation);
        } else {
          await executeTransition(() => performWindowCleanup());
          notifyMainRendererWindowState();
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      // 4. GET /api/snapshot: Authenticated Snapshot Read
      if (req.method === 'GET' && pathname === '/api/snapshot') {
        if (bridge?.disposed || (!bridge && !mainSession)) {
          sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
          return;
        }

        const leaseHeader = req.headers['x-whale-lease'] || parsedUrl.searchParams.get('lease');
        if (!activeSession || !leaseHeader || leaseHeader !== activeSession.leaseId) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        if (!bridge && activeSession.mainGeneration !== mainSession.generation) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        const snap = bridge ? bridge.getSnapshot() : mainSession?.snapshot;
        sendJson(res, 200, { ok: true, snapshot: snap });
        return;
      }

      // 4b. GET /api/wallpaper-preview: Restricted Authenticated Image Read
      if ((pathname === '/api/wallpaper-preview' || pathname === '/api/wallpaper/preview') && req.method === 'GET') {
        if (bridge?.disposed || (!bridge && !mainSession)) {
          sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
          return;
        }

        // Strict query parameter schema: ONLY ?id=<valid-scene-id> is allowed
        const queryKeys = Array.from(parsedUrl.searchParams.keys());
        if (queryKeys.length !== 1 || queryKeys[0] !== 'id' || parsedUrl.searchParams.getAll('id').length !== 1) {
          sendJson(res, 400, { ok: false, error: 'invalid-preview-query' });
          return;
        }

        const sceneId = parsedUrl.searchParams.get('id');
        if (!sceneId || !isSceneId(sceneId)) {
          sendJson(res, 400, { ok: false, error: 'invalid-scene-id' });
          return;
        }

        // Credentials must come strictly from request headers, never URL query
        const leaseHeader = req.headers['x-whale-lease'];
        const mainTokenHeader = req.headers['x-whale-main-token'];
        const instanceHeader = req.headers['x-whale-instance-id'];
        const genHeader = req.headers['x-whale-generation'];

        const parseStrictPositiveInt = (val) => {
          if (typeof val !== 'string' || !/^[1-9]\d*$/.test(val)) return null;
          const num = Number(val);
          return Number.isSafeInteger(num) ? num : null;
        };

        let entryMainInstanceId = null;
        let entryMainGen = null;
        let entryLeaseId = null;
        let entryCompGen = null;

        if (mainTokenHeader) {
          if (!mainSession || mainTokenHeader !== resolvedMainToken) {
            sendJson(res, 401, { ok: false, error: 'unauthorized-main-token' });
            return;
          }
          if (!instanceHeader || instanceHeader !== mainSession.instanceId) {
            sendJson(res, 403, { ok: false, error: 'unauthorized-instance' });
            return;
          }
          const mainGen = parseStrictPositiveInt(genHeader);
          if (mainGen == null || mainGen !== mainSession.generation) {
            sendJson(res, 403, { ok: false, error: 'unauthorized-generation' });
            return;
          }
          if (req.headers.origin) {
            const orig = req.headers.origin;
            const allowed = orig === 'dsh-app://app' || resolvedMainOrigins.includes(orig);
            if (!allowed) {
              sendJson(res, 403, { ok: false, error: 'forbidden-origin' });
              return;
            }
          }
          entryMainInstanceId = mainSession.instanceId;
          entryMainGen = mainSession.generation;
        } else if (leaseHeader) {
          if (!activeSession || leaseHeader !== activeSession.leaseId) {
            sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
            return;
          }
          if (mainSession && activeSession.mainGeneration !== mainSession.generation) {
            sendJson(res, 403, { ok: false, error: 'unauthorized-lease' });
            return;
          }
          const compGen = parseStrictPositiveInt(genHeader);
          const activeExpectedGen = activeSession.generation ?? activeSession.mainGeneration ?? 1;
          if (compGen == null || compGen !== activeExpectedGen) {
            sendJson(res, 403, { ok: false, error: 'unauthorized-generation' });
            return;
          }
          if (req.headers.origin) {
            const orig = req.headers.origin;
            const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
            const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
            const allowed = (myOrigin && orig === myOrigin) || (myLocalhost && orig === myLocalhost) || resolvedCompanionOrigins.includes(orig);
            if (!allowed) {
              sendJson(res, 403, { ok: false, error: 'forbidden-origin' });
              return;
            }
          }
          entryLeaseId = activeSession.leaseId;
          entryCompGen = compGen;
          entryMainGen = activeSession.mainGeneration;
        } else {
          sendJson(res, 401, { ok: false, error: 'unauthorized-request' });
          return;
        }

        if (!library || typeof library.getPreview !== 'function') {
          sendJson(res, 404, { ok: false, error: 'preview-unavailable' });
          return;
        }

        // Concurrency gate: check and claim slot BEFORE any metadata or image IO (U1)
        if (activePreviewReads >= MAX_CONCURRENT_PREVIEW_READS) {
          sendJson(res, 503, { ok: false, error: 'preview-concurrency-exceeded' });
          return;
        }

        activePreviewReads++;

        const abortCtrl = new AbortController();
        const onReqClose = () => {
          try { abortCtrl.abort(); } catch {}
        };
        req.on('close', onReqClose);

        let timeoutTimer = null;
        const timeoutPromise = new Promise((_, rej) => {
          timeoutTimer = setTimeout(() => {
            try { abortCtrl.abort(); } catch {}
            rej(new Error('preview-read-timeout'));
          }, PREVIEW_READ_TIMEOUT_MS);
        });

        const getCurrentSettings = () => {
          return bridge?.getSnapshot?.()?.settings
            || mainSession?.snapshot?.settings
            || (typeof bridge?.controller?.read === 'function' ? bridge.controller.read() : null)
            || {};
        };

        const verifyCurrentSession = () => {
          if (mainTokenHeader) {
            if (!mainSession || mainSession.instanceId !== entryMainInstanceId || mainSession.generation !== entryMainGen) {
              return { ok: false, error: 'session-invalidated-during-read' };
            }
          } else if (leaseHeader) {
            const currentExpectedGen = activeSession?.generation ?? activeSession?.mainGeneration ?? 1;
            if (!activeSession || activeSession.leaseId !== entryLeaseId || currentExpectedGen !== entryCompGen) {
              return { ok: false, error: 'session-invalidated-during-read' };
            }
            if (mainSession && activeSession.mainGeneration !== mainSession.generation) {
              return { ok: false, error: 'session-invalidated-during-read' };
            }
          } else {
            return { ok: false, error: 'unauthorized-request' };
          }
          return { ok: true };
        };

        const getCurrentAllowedRatings = () => {
          const currentSettings = getCurrentSettings();
          return parseAgeRatings(currentSettings.weAgeRatings);
        };

        const pipelinePromise = (async () => {
          // Pre-check session before stage 1
          const preSession = verifyCurrentSession();
          if (!preSession.ok) {
            return { status: 403, error: preSession.error };
          }

          // Stage 1: Initial on-disk metadata resolution
          let itemRating = null;
          if (typeof library.resolvePreviewRating === 'function') {
            try {
              itemRating = await library.resolvePreviewRating(sceneId, { signal: abortCtrl.signal });
            } catch {
              itemRating = 'unknown';
            }
          }

          if (abortCtrl.signal.aborted) {
            return { aborted: true };
          }

          if (itemRating === null) {
            if (sceneId === 'lucy') {
              itemRating = 'Everyone';
            } else if (typeof library.publicEntry === 'function') {
              const entry = library.publicEntry(sceneId);
              if (!entry) {
                return { status: 404, error: 'preview-unavailable' };
              }
              itemRating = entry.contentRating || 'unknown';
            } else {
              return { status: 404, error: 'preview-unavailable' };
            }
          }

          // Re-verify session identity after Stage 1 await (U2)
          const s1Session = verifyCurrentSession();
          if (!s1Session.ok) {
            return { status: 403, error: s1Session.error };
          }

          // Re-verify allowed ratings after Stage 1 await (U2 case 1: policy tightened during initial rating query -> 0 image reads)
          const s1Allowed = getCurrentAllowedRatings();
          if (!s1Allowed.includes(itemRating)) {
            return { status: 403, error: 'preview-rating-filtered' };
          }

          if (abortCtrl.signal.aborted) {
            return { aborted: true };
          }

          // Stage 2: Read image preview bytes (0 reads if Stage 1 rejected above!)
          let previewRes;
          try {
            previewRes = await library.getPreview(sceneId, { signal: abortCtrl.signal });
          } catch (err) {
            if (abortCtrl.signal.aborted) {
              return { aborted: true };
            }
            throw err;
          }

          if (abortCtrl.signal.aborted) {
            return { aborted: true };
          }
          if (!previewRes || !previewRes.buffer) {
            return { status: 404, error: 'preview-unavailable' };
          }

          // Re-verify session identity after Stage 2 await
          const s2Session = verifyCurrentSession();
          if (!s2Session.ok) {
            return { status: 403, error: s2Session.error };
          }

          // Re-verify allowed ratings after Stage 2 await
          const s2Allowed = getCurrentAllowedRatings();
          const s2Rating = previewRes.contentRating || itemRating;
          if (!s2Allowed.includes(s2Rating)) {
            return { status: 403, error: 'preview-rating-filtered' };
          }

          if (abortCtrl.signal.aborted) {
            return { aborted: true };
          }

          // Stage 3: Final on-disk metadata re-check
          let settledRating = previewRes.contentRating || itemRating;
          if (typeof library.resolvePreviewRating === 'function') {
            try {
              const currentOnDisk = await library.resolvePreviewRating(sceneId, { signal: abortCtrl.signal });
              if (currentOnDisk) {
                settledRating = currentOnDisk;
              } else if (sceneId !== 'lucy') {
                settledRating = 'unknown';
              }
            } catch {
              if (sceneId !== 'lucy') settledRating = 'unknown';
            }
          } else if (typeof library.publicEntry === 'function') {
            const settledEntry = library.publicEntry(sceneId);
            if (settledEntry && settledEntry.contentRating) {
              settledRating = settledEntry.contentRating;
            }
          }

          if (abortCtrl.signal.aborted) {
            return { aborted: true };
          }

          // Final synchronous verification (ALL IO COMPLETE, ZERO AWAIT BEFORE WRITEHEAD/END)
          // U2 case 2: policy tightened during final rating query -> 403
          // U2 case 3: main session replaced during final rating query -> 403
          const finalSession = verifyCurrentSession();
          if (!finalSession.ok) {
            return { status: 403, error: finalSession.error };
          }
          const finalAllowed = getCurrentAllowedRatings();
          if (!finalAllowed.includes(settledRating)) {
            return { status: 403, error: 'preview-rating-filtered' };
          }

          return {
            status: 200,
            previewRes,
          };
        })();

        // Bounded occupancy: Slot is held until pipelinePromise actually settles (U1)
        pipelinePromise
          .finally(() => {
            activePreviewReads--;
          })
          .catch(() => {});

        try {
          const result = await Promise.race([
            pipelinePromise,
            timeoutPromise,
          ]);

          if (res.writableEnded || req.destroyed) return;

          if (result.aborted) {
            return;
          }

          if (result.status === 200 && result.previewRes) {
            res.writeHead(200, {
              'Content-Type': result.previewRes.contentType,
              'Content-Length': result.previewRes.bytes,
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            });
            res.end(result.previewRes.buffer);
            return;
          }

          sendJson(res, result.status || 404, { ok: false, error: result.error || 'preview-unavailable' });
          return;
        } catch (err) {
          if (!res.writableEnded && !req.destroyed) {
            if (err.message === 'preview-read-timeout') {
              sendJson(res, 503, { ok: false, error: 'preview-read-timeout' });
            } else {
              sendJson(res, 404, { ok: false, error: 'preview-unavailable' });
            }
          }
          return;
        } finally {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          req.off('close', onReqClose);
        }
      }

      // 5. POST /api/action: Companion Action Dispatch
      if (req.method === 'POST' && pathname === '/api/action') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message });
          return;
        }

        if (bridge?.disposed || (!bridge && !mainSession)) {
          sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
          return;
        }

        const leaseHeader = req.headers['x-whale-lease'];
        const genHeader = parseInt(req.headers['x-whale-generation'] || '1', 10);
        const capability = body?.capability || {
          leaseId: leaseHeader,
          generation: Number.isInteger(genHeader) ? genHeader : 1,
        };

        const isCurrentSession = activeSession && capability?.leaseId === activeSession.leaseId;
        const isRecentClosedSession =
          !activeSession &&
          lastTerminatedLeaseId &&
          capability?.leaseId === lastTerminatedLeaseId &&
          (!mainSession || lastTerminatedMainGen === mainSession.generation);

        if ((!isCurrentSession && !isRecentClosedSession) || !capability?.leaseId) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        if (isCurrentSession && !bridge && activeSession.mainGeneration !== mainSession.generation) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        if (isRecentClosedSession) {
          if (body.action?.clientActionId && windowActionCache.has(body.action.clientActionId)) {
            const fingerprint = JSON.stringify({
              type: body.action.type,
              clientActionId: body.action.clientActionId,
              expectedRevision: body.action.expectedRevision,
            });
            const cached = windowActionCache.get(body.action.clientActionId);
            if (cached.leaseId === capability.leaseId && cached.popupGeneration === popupWindowGeneration) {
              if (cached.fingerprint === fingerprint) {
                sendJson(res, 200, cached.result);
                return;
              }
              sendJson(res, 200, {
                ok: false,
                error: 'action-tampered-payload',
                clientActionId: body.action.clientActionId,
                snapshot: mainSession?.snapshot,
              });
              return;
            }
          }
          sendJson(res, 401, { ok: false, error: 'unauthorized-lease' });
          return;
        }

        if (bridge) {
          const actionResult = await bridge.handleCompanionAction(body.action, capability);
          const status = actionResult.ok ? 200 : actionResult.error?.startsWith('unauthorized') ? 401 : 200;
          sendJson(res, status, actionResult);
          return;
        }

        // Remote Main Renderer Session mode
        if (
          body.action?.type === DETACHABLE_ACTIONS.REQUEST_DOCK ||
          body.action?.type === DETACHABLE_ACTIONS.CLOSE_WINDOW
        ) {
          // Direct execution by window owner
          // 1. Schema validation (G3)
          const val = validateDetachableAction(body.action);
          if (!val.valid) {
            sendJson(res, 200, {
              ok: false,
              error: val.error,
              snapshot: mainSession?.snapshot,
            });
            return;
          }

          // 2. Strict exact expected revision check
          if (
            mainSession.snapshot?.revision != null &&
            body.action.expectedRevision !== mainSession.snapshot.revision
          ) {
            sendJson(res, 200, {
              ok: false,
              error: 'stale-revision',
              expectedRevision: body.action.expectedRevision,
              latestRevision: mainSession.snapshot.revision,
              snapshot: mainSession.snapshot,
            });
            return;
          }

          // 3. Deduplication and payload fingerprinting
          const fingerprint = JSON.stringify({
            type: body.action.type,
            clientActionId: body.action.clientActionId,
            expectedRevision: body.action.expectedRevision,
          });

          if (windowActionCache.has(body.action.clientActionId)) {
            const cached = windowActionCache.get(body.action.clientActionId);
            if (cached.leaseId !== capability.leaseId || cached.popupGeneration !== popupWindowGeneration) {
              sendJson(res, 200, {
                ok: false,
                error: 'action-superseded',
                snapshot: mainSession?.snapshot,
              });
              return;
            }
            if (cached.fingerprint === fingerprint) {
              sendJson(res, 200, cached.result);
              return;
            }
            sendJson(res, 200, {
              ok: false,
              error: 'action-tampered-payload',
              clientActionId: body.action.clientActionId,
              snapshot: mainSession?.snapshot,
            });
            return;
          }

          const capturedMainGen = mainSession.generation;
          const capturedPopupGen = popupWindowGeneration;
          const capturedLeaseId = capability.leaseId;
          const capturedExpectedRevision = body.action.expectedRevision;

          const dockResult = await executeTransition(async () => {
            if (!mainSession || mainSession.generation !== capturedMainGen) {
              return { ok: false, error: 'main-instance-disconnected' };
            }

            // H2: Check if target popup window was already closed/superseded
            if (popupWindowGeneration !== capturedPopupGen) {
              return { ok: false, error: 'window-already-closed' };
            }

            // H2: Check if companion session lease is still active and bound to this window
            if (
              !activeSession ||
              activeSession.leaseId !== capturedLeaseId ||
              activeSession.popupGeneration !== capturedPopupGen
            ) {
              return { ok: false, error: 'session-superseded' };
            }

            // H2: Check if revision drifted while queued
            if (
              mainSession.snapshot?.revision != null &&
              capturedExpectedRevision !== mainSession.snapshot.revision
            ) {
              return {
                ok: false,
                error: 'stale-revision',
                expectedRevision: capturedExpectedRevision,
                latestRevision: mainSession.snapshot.revision,
                snapshot: mainSession.snapshot,
              };
            }

            if (hostMode === DETACHABLE_MODES.DOCKED && activeOwnedHandle == null) {
              return { ok: true, mode: DETACHABLE_MODES.DOCKED, alreadyDocked: true, snapshot: mainSession?.snapshot };
            }

            hostMode = DETACHABLE_MODES.DOCKING;
            notifyMainRendererWindowState();

            const closeRes = await performWindowCleanup();
            notifyMainRendererWindowState();

            if (!closeRes.ok) {
              return {
                ok: false,
                error: closeRes.error,
                mode: hostMode,
                unconfirmedCleanup: true,
                snapshot: mainSession?.snapshot,
              };
            }

            terminateCompanionSession('docked');
            return {
              ok: true,
              mode: DETACHABLE_MODES.DOCKED,
              unconfirmedCleanup: false,
              snapshot: mainSession?.snapshot,
            };
          });

          if (dockResult) {
            windowActionCache.set(body.action.clientActionId, {
              leaseId: capturedLeaseId,
              popupGeneration: capturedPopupGen,
              fingerprint,
              result: dockResult,
            });
            if (windowActionCache.size > 200) {
              const oldest = windowActionCache.keys().next().value;
              windowActionCache.delete(oldest);
            }
          }

          sendJson(res, 200, dockResult);
          return;
        }

        // Forward action to browser controller over SSE
        if (mainSession && mainSession.actionsSseRes && !mainSession.actionsSseRes.writableEnded) {
          const clientActionId = body.action?.clientActionId || randomUUID();
          let timer;
          const actionPromise = new Promise((resolveAction) => {
            timer = setTimeout(() => {
              if (mainSession?.pendingActions?.has(clientActionId)) {
                mainSession.pendingActions.delete(clientActionId);
                resolveAction({ ok: false, error: 'action-timeout' });
              }
            }, 10000);
            mainSession.pendingActions.set(clientActionId, { resolveAction, timer });
          });

          mainSession.actionsSseRes.write(
            `event: action\ndata: ${JSON.stringify({ action: body.action, clientActionId })}\n\n`
          );
          const actionResult = await actionPromise;
          const status = actionResult.ok ? 200 : actionResult.error?.startsWith('unauthorized') ? 401 : 200;
          sendJson(res, status, actionResult);
          return;
        }

        sendJson(res, 503, { ok: false, error: 'main-instance-disconnected' });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not-found' });
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      activePort = server.address().port;
      started = true;
      resolve({ port: activePort, host: '127.0.0.1', baseUrl: `http://127.0.0.1:${activePort}` });
    });
  });

  return {
    async start() {
      return await serverPromise;
    },
    getPort: () => activePort,
    getBaseUrl: () => `http://127.0.0.1:${activePort}`,
    getMainToken: () => resolvedMainToken,
    getActiveSession: () => activeSession,
    getMainSession: () => mainSession,
    getMode: () => hostMode,
    getActiveOwnedHandle: () => activeOwnedHandle,
    hasUnconfirmedCleanup: () => unconfirmedCleanup,
    getWindowAdapter: () => resolvedWindowAdapter,
    async stop() {
      const authorCleanup=authorHost?.dispose();
      terminateCompanionSession('disconnect');
      terminateMainSession('host-stopped');

      let cleanupRes = { ok: true };
      if (activeOwnedHandle != null || unconfirmedCleanup) {
        cleanupRes = await executeTransition(() => performWindowCleanup());
      }

      let disposeRes = { ok: true };
      if (resolvedWindowAdapter && typeof resolvedWindowAdapter.dispose === 'function') {
        try {
          disposeRes = (await resolvedWindowAdapter.dispose()) || { ok: true };
        } catch (err) {
          disposeRes = { ok: false, error: err.message };
        }
      }

      if (server) {
        server.closeAllConnections?.();
        await new Promise((r) => server.close(r));
        started = false;
        server = null;
      }

      const authorResult=await authorCleanup;
      if(authorResult?.ok===false)return authorResult;
      if (cleanupRes && cleanupRes.ok === false) return cleanupRes;
      if (disposeRes && disposeRes.ok === false) return disposeRes;
      if (activeOwnedHandle != null || unconfirmedCleanup) {
        return { ok: false, error: lastCleanupError || 'unconfirmed-cleanup-remaining' };
      }
      return { ok: true };
    },
  };
}
