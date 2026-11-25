// Authenticated native sidebar transport. No static pages, OS windows, leases or remote actions.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {isSceneId,parseAgeRatings} from './appearance-contract.js';
import {createAuthorPropertiesHost} from './wallpaper/author-properties-host.js';

function readJsonBody(req, limit = 65536, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    // Sidebar registration/snapshot bodies have a deadline as well as a byte limit.
    const timer = timeoutMs ? setTimeout(() => req.destroy(new Error('body-read-timeout')), timeoutMs) : null;
    const clear = () => { if (timer) clearTimeout(timer); };
    req.once('close', clear);
    req.once('end', clear);
    req.once('error', clear);
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

const SIDEBAR_ROUTES = new Set([
  '/api/main/desktop-follow', '/api/main/fixed-canvas',
  '/api/main/connect', '/api/main/actions', '/api/main/snapshot', '/api/main/disconnect',
  '/api/wallpaper-preview', '/api/wallpaper/preview',
  '/api/author-properties/schema', '/api/author-properties/draft', '/api/author-properties/apply',
]);

export function createAppearanceServiceHttpHost({
  library = null,
  desktopFollow = null,
  createFixedCanvas = null,
  readWallpaperLifecycle = null,
  authorApplyAdapter = null,
  authorDiagnosticSession = null,
  port = 0,
  allowedOrigins = [],
  mainAllowedOrigins = null,
  mainToken = null,
} = {}) {
  const resolvedMainToken =
    typeof mainToken === 'string' && mainToken.length > 0 ? mainToken : randomUUID();
  const resolvedMainOrigins = (mainAllowedOrigins || allowedOrigins || []).filter(Boolean);
  const readBody = req => readJsonBody(req, 65536, 4000);

  let activePreviewReads = 0;
  const MAX_CONCURRENT_PREVIEW_READS = 8;
  const PREVIEW_READ_TIMEOUT_MS = 3000;

  let server = null;
  let activePort = null;
  let stopped = false;
  let stopPromise = null;

  let mainRegistrationGeneration = 0;
  let followCleanup = null;
  let mainSession = null; // Main Renderer session
  const fixedCanvas = createFixedCanvas?.(()=>mainSession) ?? null;
  const retireFixedCanvas = session => void fixedCanvas?.stop(session).catch(()=>{});
  // Shares the authenticated main controller's selection/policy and Host-owned playback state.
  // Author policy and selection come from this authenticated main controller only.
  const authorOwner = () => mainSession ? `main:${mainSession.generation}` : null;
  const strictGeneration = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const authorHost = typeof library?.getAuthorMetadata === 'function' && typeof readWallpaperLifecycle === 'function'
    ? createAuthorPropertiesHost({library,applyAdapter:authorApplyAdapter,diagnostics:authorDiagnosticSession?.recorder,root:'/api/author-properties',readContext(req){
        if (!mainSession) return null;
        const headers=req.headers, gen=strictGeneration(headers['x-whale-generation']);
        const isMain=headers['x-whale-main-token'] === resolvedMainToken
          && headers['x-whale-instance-id'] === mainSession.instanceId && gen === mainSession.generation;
        if (!isMain) return null;
        const origin=headers.origin;
        if (origin && !(origin==='dsh-app://app'||resolvedMainOrigins.includes(origin))) return null;
        const snapshot=mainSession.snapshot;
        return {authorized:true,owner:authorOwner(),revision:snapshot?.revision,
          selectedId:snapshot?.settings?.weScene,allowedRatings:parseAgeRatings(snapshot?.settings?.weAgeRatings),
          lifecycle:readWallpaperLifecycle()};
      }}) : null;

  // Readiness proof belongs to this authenticated service generation.
  const notifyMainRendererState = () => {
    if (mainSession?.actionsSseRes && !mainSession.actionsSseRes.writableEnded) {
      desktopFollow?.setReady?.(mainSession.generation,true);
      const payload={protocol:2,generation:mainSession.generation,ready:true,...(fixedCanvas && {fixedCanvas:true})};
      mainSession.actionsSseRes.write(`event: service-state\ndata: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const offFollow = desktopFollow?.subscribe?.(packet => {
    if(packet.owner !== mainSession?.generation || !mainSession?.actionsSseRes || mainSession.actionsSseRes.writableEnded)return;
    mainSession.actionsSseRes.write(`event: desktop-follow\ndata: ${JSON.stringify(packet)}\n\n`);
  });
  function verifyMainRequest(req, parsedUrl, body) {
    const params=parsedUrl.searchParams;
    const tokens=[req.headers['x-whale-main-token'],...params.getAll('mainToken')].filter(v=>v!==undefined);
    if (!mainSession || !tokens.length || tokens.some(v=>v!==resolvedMainToken) || params.getAll('mainToken').length>1)
      return {ok:false,status:401,error:'unauthorized-main-token'};
    const instances=[body?.instanceId,req.headers['x-whale-instance-id'],...params.getAll('instanceId')].filter(v=>v!==undefined);
    if (!instances.length || instances.some(v=>v!==mainSession.instanceId) || params.getAll('instanceId').length>1)
      return {ok:false,status:403,error:'unauthorized-instance'};
    const generations=[body?.generation,req.headers['x-whale-generation']===undefined?undefined:strictGeneration(req.headers['x-whale-generation']),
      ...params.getAll('generation').map(strictGeneration)].filter(v=>v!==undefined);
    if (!generations.length || generations.some(v=>v!==mainSession.generation) || params.getAll('generation').length>1)
      return {ok:false,status:403,error:'unauthorized-generation'};
    return {ok:true};
  }

  const terminateMainSession = (reason = 'main-instance-disconnected') => {
    if (mainSession) {
      const sess = mainSession;
      retireFixedCanvas(sess);
      followCleanup = desktopFollow?.release(sess.generation);
      authorHost?.clearOwner(authorOwner());
      mainSession = null;
      if (sess.actionsSseRes && !sess.actionsSseRes.writableEnded) {
        try {
          sess.actionsSseRes.end();
        } catch {}
      }
    }
  };

  const serverPromise = new Promise((resolve, reject) => {
    server = createServer(async (req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort || 0}`);
      const pathname = parsedUrl.pathname;
      if (stopped) {sendJson(res,503,{ok:false,error:'host-disposed'});return;}
      const origin = req.headers['origin'];

      // A sidebar service has no static page, companion lease, or window-control API.
      // Reject before body parsing; no window transition implementation exists here.
      if (!SIDEBAR_ROUTES.has(pathname)) {
        sendJson(res, 404, { ok: false, error: 'not-found' });
        return;
      }

      if (origin) {
        if (origin === 'null' || (origin !== 'dsh-app://app' && !resolvedMainOrigins.includes(origin))) {
          sendJson(res, 403, { ok: false, error: 'forbidden-origin' });
          return;
        }

        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Whale-Generation, X-Whale-Main-Token, X-Whale-Instance-Id, Accept'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

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
            body = await readBody(req);
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

          if (stopped) { sendJson(res,503,{ok:false,error:'host-disposed'});return; }
          terminateMainSession('main-instance-replaced');
          mainRegistrationGeneration++;
          const targetGen = mainRegistrationGeneration;

          mainSession = {
            instanceId: body.instanceId,
            generation: targetGen,
            snapshot: body.snapshot,
            actionsSseRes: null,
          };
          desktopFollow?.claim(targetGen);
          sendJson(res, 200, { ok: true, generation: targetGen, service: 'native-sidebar', protocol: 2 });
          return;
        }

        // All subsequent /api/main/* endpoints require an active mainSession and valid credentials
        if (!mainSession || suppliedMainToken !== resolvedMainToken) {
          sendJson(res, 401, { ok: false, error: 'unauthorized-main-token' });
          return;
        }

        if (pathname === '/api/main/desktop-follow' && req.method === 'POST') {
          // Same token/instance/generation authority, exclusively in headers. No paths or handles.
          if(parsedUrl.search || !req.headers['x-whale-main-token'] || !req.headers['x-whale-instance-id'] || !req.headers['x-whale-generation']) {
            sendJson(res,403,{ok:false,error:'follow-credentials-invalid'});return;
          }
          let body;try{body=await readBody(req);}catch{sendJson(res,400,{ok:false,error:'follow-body-invalid'});return;}
          const auth=verifyMainRequest(req,parsedUrl,null);if(!auth.ok){sendJson(res,auth.status,{ok:false,error:auth.error});return;}
          if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['sequence','action','patch'].includes(k))) {
            sendJson(res,400,{ok:false,error:'follow-request-invalid'});return;
          }
          if(!desktopFollow){sendJson(res,503,{ok:false,error:'follow-unavailable'});return;}
          const generation=mainSession.generation;
          try{
            const packet=await desktopFollow.request(generation,body.sequence,body.action,body.patch);
            if(mainSession?.generation!==generation){sendJson(res,409,{ok:false,error:'follow-stale-result'});return;}
            sendJson(res,200,{ok:true,packet},{'Cache-Control':'no-store'});
          }catch{if(!res.destroyed&&!res.writableEnded)sendJson(res,409,{ok:false,error:'follow-unconfirmed'});}
          return;
        }
        if (pathname === '/api/main/fixed-canvas' && req.method === 'POST') {
          if (parsedUrl.search || !req.headers['x-whale-main-token'] || !req.headers['x-whale-instance-id'] || !req.headers['x-whale-generation']) {
            sendJson(res,403,{ok:false,error:'fixed-canvas-credentials-invalid'});return;
          }
          let body;
          try { body=await readBody(req); }
          catch { if (!res.destroyed) sendJson(res,400,{ok:false,error:'fixed-canvas-body-invalid'});return; }
          const auth=verifyMainRequest(req,parsedUrl,null);
          if (!auth.ok) {sendJson(res,auth.status,{ok:false,error:auth.error});return;}
          const owner=mainSession, stream=owner.actionsSseRes;
          if (!fixedCanvas || !stream || stream.writableEnded || stream.destroyed) {
            sendJson(res,503,{ok:false,error:'fixed-canvas-unavailable'});return;
          }
          const keys=body && !Array.isArray(body) ? Object.keys(body).sort().join(',') : '';
          let result;
          if (body?.action==='viewport' && keys==='action,nonce,observation,sequence,visible') {
            result={ok:fixedCanvas.acceptViewport(owner,body)};
          } else if (body?.action==='stop' && keys==='action,playbackGeneration' &&
              Number.isSafeInteger(body.playbackGeneration) && body.playbackGeneration>0) {
            result=await fixedCanvas.stop(owner,body.playbackGeneration);
          } else if (body?.action==='start' && keys==='action,scene' && isSceneId(body.scene)) {
            const request=new AbortController();
            const cancel=()=>request.abort();
            res.once('close',cancel);
            if (res.destroyed) cancel();
            try { result=await fixedCanvas.start(owner,body.scene,request.signal); }
            finally { res.removeListener('close',cancel); }
            if (result.ok && (res.destroyed || mainSession!==owner || owner.actionsSseRes!==stream)) {
              await fixedCanvas.stop(owner,result.host.generation);
              result={ok:false,error:'fixed-canvas-owner-retired'};
            }
          } else {
            sendJson(res,400,{ok:false,error:'fixed-canvas-request-invalid'});return;
          }
          if (!res.destroyed && !res.writableEnded) sendJson(res,result.ok?200:409,result,{'Cache-Control':'no-store'});
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
          const previous = mainSession.actionsSseRes;
          if (previous && previous !== res) {
            retireFixedCanvas(mainSession);
          }
          mainSession.actionsSseRes = res;
          if (previous && previous !== res) previous.end();
          notifyMainRendererState();
          const followState=desktopFollow?.read?.();
          if(followState?.owner===mainSession.generation)res.write(`event: desktop-follow\ndata: ${JSON.stringify(followState)}\n\n`);

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
            body = await readBody(req);
          } catch (error) {
            if (!res.destroyed && !res.writableEnded) sendJson(res,400,{ok:false,error:error.message});
            return;
          }

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          if(body&&Object.hasOwn(body,'authorDiagnostics')){
            // A distinct read-only operation on the existing authenticated main route.
            // It never falls through to settings/snapshot mutation.
            const d=body.authorDiagnostics,h=req.headers;
            if(parsedUrl.search||h['x-whale-main-token']!==resolvedMainToken||h['x-whale-instance-id']!==mainSession.instanceId||typeof h['x-whale-generation']!=='string'||!/^[1-9]\d*$/.test(h['x-whale-generation'])||Number(h['x-whale-generation'])!==mainSession.generation){sendJson(res,403,{ok:false,error:'author-diagnostic-credentials-invalid'});return;}
            if(Object.keys(body).sort().join(',')!=='authorDiagnostics,generation,instanceId'||body.generation!==mainSession.generation||body.instanceId!==mainSession.instanceId||!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).sort().join(',')!=='action,buildId'||d.action!=='export'||typeof d.buildId!=='string'||!/^[a-f0-9]{64}$/.test(d.buildId)){sendJson(res,400,{ok:false,error:'author-diagnostic-request-invalid'});return;}
            const result=authorDiagnosticSession?.exportData(d.buildId)??{ok:false,error:'author-diagnostics-disabled'};
            sendJson(res,result.ok?200:503,result,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return;
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
            desktopFollow?.settingsChanged?.(mainSession.generation);
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === '/api/main/disconnect' && req.method === 'POST') {
          let body;
          try {
            body = await readBody(req);
          } catch (error) {
            if (!res.destroyed && !res.writableEnded) sendJson(res,400,{ok:false,error:error.message});
            return;
          }

          const auth = verifyMainRequest(req, parsedUrl, body);
          if (!auth.ok) {
            sendJson(res, auth.status, { ok: false, error: auth.error });
            return;
          }

          terminateMainSession('main-instance-disconnected');
          sendJson(res,200,{ok:true});
          return;
        }
      }

      // 4b. GET /api/wallpaper-preview: Restricted Authenticated Image Read
      if ((pathname === '/api/wallpaper-preview' || pathname === '/api/wallpaper/preview') && req.method === 'GET') {
        if (!mainSession) {
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
          return mainSession?.snapshot?.settings || {};
        };

        const verifyCurrentSession = () => {
          if (mainTokenHeader) {
            if (!mainSession || mainSession.instanceId !== entryMainInstanceId || mainSession.generation !== entryMainGen) {
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

      sendJson(res,404,{ok:false,error:'not-found'});
    });

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      activePort = server.address().port;
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
    getMainSession: () => mainSession,
    async stop() {
      if (stopPromise) return stopPromise;
      stopped = true;
      stopPromise = (async () => {
        offFollow?.();
        const authorCleanup=authorHost?.dispose();authorDiagnosticSession?.dispose();
        terminateMainSession('host-stopped');
        const fixedResult = fixedCanvas?.dispose();
        await serverPromise.catch(() => {});
        if (server) {
          server.closeAllConnections?.();
          await new Promise((resolve,reject) => {
            const timer=setTimeout(()=>reject(new Error('sidebar-close-timeout')),2000);
            server.close(error=>{clearTimeout(timer);if(error && error.code!=='ERR_SERVER_NOT_RUNNING')reject(error);else resolve();});
          });
          server=null;
        }
        await followCleanup;
        const followResult=await desktopFollow?.dispose();
        if(followResult?.ok===false)return {ok:false,error:"follow-cleanup-unconfirmed"};
        if ((await fixedResult)?.ok === false) return {ok:false,error:'fixed-canvas-cleanup-unconfirmed'};
        const authorResult=await authorCleanup;
        return authorResult?.ok===false ? authorResult : {ok:true};
      })();
      return stopPromise;
    },
  };
}
