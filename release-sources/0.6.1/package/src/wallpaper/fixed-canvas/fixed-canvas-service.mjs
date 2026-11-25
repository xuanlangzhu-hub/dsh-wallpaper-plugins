import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {parseAgeRatings} from '../../appearance-contract.js';
import {createManualFixedCanvas} from './manual-fixed-canvas.mjs';
import {createFixedCanvasRuntime} from './fixed-canvas-runtime.mjs';
import {createLayoutTiming} from './layout-timing.mjs';
import {createSurfaceLayout} from './live-layout/surface-layout.mjs';

const leaseMs = 10000;
const fixedCanvasTypes = ['scene','video','web'];
const geometryKeys = ['runId','pid','hwnd','startTicks','ownerGeneration','rendererHwnd','rendererThread'];
const digits = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);

function playbackSource(session) {
  const {location,config,windowPid,windowStartUtc} = session.state();
  return {location,hwnd:config?.window,pid:windowPid,startUtc:windowStartUtc};
}

function send(stream, event, data) {
  if (!stream || stream.destroyed || stream.writableEnded || stream.writableLength > 32768) return false;
  try { stream.write(`event: fixed-canvas-${event}\ndata: ${JSON.stringify(data)}\n\n`);return true; }
  catch { return false; }
}

async function waitUntil(read, timeout, signal) {
  const deadline = performance.now()+timeout;
  do {
    signal.throwIfAborted();
    const value = read();
    if (value) return value;
    await wait(25,undefined,{signal});
  } while (performance.now() < deadline);
  throw Error('fixed-canvas-start-timeout');
}

/** One fixed playback and its layout observer, scoped to the existing main owner and source. */
export function createFixedCanvasService({wallpaper,readOwner,native,library,verifyBuiltin,now=Date.now}) {
  const runtime = createFixedCanvasRuntime({wallpaper,now});
  let active = null;
  const manual = createManualFixedCanvas({wallpaper,readOwner,
    allowSelection(settings, scene) {
      const allowedRatings = parseAgeRatings(settings?.weAgeRatings);
      if (scene === 'lucy') return allowedRatings.includes('Everyone');
      const item = library?.publicEntry(scene);
      return item?.available === true && fixedCanvasTypes.includes(item.type) && allowedRatings.includes(item.contentRating);
    },
    async verifySelection(scene, settings) {
      const selection = await library.resolveForPlayback(scene,{allowedRatings:parseAgeRatings(settings.weAgeRatings)});
      if (!fixedCanvasTypes.includes(selection.type)) throw Error('fixed-canvas-type-unsupported');
      return selection;
    },
    async readMonitor({scene,signal}) {
      const monitor = await native.readMonitor({signal});
      if (scene === 'lucy' && monitor?.width === 2560 && monitor?.height === 1440 && monitor.monitorCount === 1)
        await verifyBuiltin(signal);
      return monitor;
    },
    bindPlacement,
  });

  async function bindPlacement({owner,monitor,session,generation,signal,isCurrent}) {
    if (active) return null;
    const source = playbackSource(session);
    const sourceType = session.state().config?.fixedCanvasType ?? 'scene';
    let shape = null;
    const timing = createLayoutTiming();
    const noteProof = error => session.noteFixedCanvasProof?.({
      shape,error,get timing() { return timing.snapshot(); },
    });
    const stream = owner.actionsSseRes, stop = new AbortController();
    const lifetime = AbortSignal.any([signal,stop.signal]);
    const token = {nonce:randomUUID(), ownerGeneration:owner.generation};
    const slot = {owner,stream,token,sequence:0,viewport:null,pair:null};
    let watcher, lease, timer, binding, capture, report, layoutSequence=0, presented=false, stopped=false;
    const current = () => {
      if (lifetime.aborted || !isCurrent()) return false;
      const currentSource = playbackSource(session);
      return Object.entries(source).every(([key,value])=>currentSource[key] === value);
    };

    function transmit(event,data) { return send(stream,event,{...token,...data}); }
    function cancelRun() { stop.abort(); void manual.stop(owner,generation).catch(()=>{}); }

    async function close() {
      if (!stopped) {
        stopped = true;
        stop.abort();
        clearInterval(timer);
        slot.pair?.dispose();
        lease?.dispose();
        transmit('stop',{hostGeneration:generation});
      }
      const ended = await watcher?.close();
      if (ended && !ended.reaped) throw Error('fixed-canvas-watch-close-unconfirmed');
      if (active === slot) active = null;
    }

    function publish(layout, measured) {
      if (!current() || !capture) return;
      if (!lease && layout) {
        lease = runtime.bind({...owner,expiresAt:now()+leaseMs,capture,
          calibration:{...binding,monitorPhysical:monitor,dpr:layout.dpr,clientOffsetX:0,clientOffsetY:0}});
      }
      if (!lease) return;
      // On a late heartbeat the renderer can keep a previously drawn picture for its short grace period.
      if (!measured && (!presented || report === 'native-expired' || report === 'viewport-expired' || report === 'sample-in-future')) return;
      let geometry = null;
      if (measured) {
        const {rendererClient: bounds,windowDpi} = measured.native.geometry;
        geometry = {nativeClientPhysical:{left:bounds.left,top:bounds.top,width:bounds.right-bounds.left,
          height:bounds.bottom-bounds.top},monitorPhysical:monitor,windowDpi};
      }
      const message = {...binding,scope:'fixed-canvas-layout-watch-v1',sequence:++layoutSequence,
        sampledAt:measured?.sampledAt ?? now(),available:Boolean(geometry),geometry,
        ...(measured?.originOnly === true && {originOnly:true})};
      if (!lease.acceptLine(JSON.stringify(message))) return;
      const view = runtime.read(owner.generation,owner.instanceId);
      if (view) {
        presented = view.layout.available;
        if (!transmit('layout',{view})) cancelRun();
      }
    }

    active = slot;
    runtime.claim(owner.generation,owner.instanceId);
    try {
      if (!transmit('start',{})) throw Error('fixed-canvas-sidebar-disconnected');
      watcher = native.watchDesktop({ownerGeneration:owner.generation,signal:lifetime,onPacket(packet) {
        if (!current()) return;
        if (packet.header === true && !binding && Number.isSafeInteger(packet.rendererThread) && packet.rendererThread>0 &&
            digits(packet.hwnd) && digits(packet.rendererHwnd) && packet.rendererHwnd!==packet.hwnd && digits(packet.startTicks)) {
          binding = Object.fromEntries(geometryKeys.map(key=>[key,packet[key]]));
          slot.pair = createSurfaceLayout({window:binding,owner,monitorPhysical:monitor,readOwner,publish() {},now,
            report(reason) {report=reason;},observe:publish});
          if (slot.viewport) slot.pair.updateViewport(owner,slot.viewport);
          return;
        }
        if (!binding || !geometryKeys.every(key=>packet[key]===binding[key])) throw Error('fixed-canvas-watch-binding');
        // Keep the source lease alive while minimized. The last measured layout still expires independently.
        if (lease && !lease.renew(now()+leaseMs)) { cancelRun();return; }
        if (slot.pair.updateNative(packet)) timing.observe(packet);
      }});
      void watcher.exited.then(()=>{if (!lifetime.aborted) cancelRun();});
      timer = setInterval(()=>{if (!lifetime.aborted && !current()) cancelRun();},100);
      shape = await native.proveSource({source,sourceType,monitor,signal:lifetime});
      if (shape.captureContentPixels.width !== monitor.width || shape.captureContentPixels.height !== monitor.height)
        throw Error('fixed-canvas-source-client-size-mismatch');
      const checkedAt = now();
      const frame = await waitUntil(()=>{
        const latest = session.hub.latest;
        if (!current() || !session.state().captureStarted || latest?.capturedAt < checkedAt ||
            latest?.capturedAt > now() || now()-latest?.capturedAt >= 500 || !Number.isSafeInteger(latest?.capturedAt) ||
            !Number.isSafeInteger(latest?.sequence)) return null;
        if (latest.width!==shape.framePixels.width || latest.height!==shape.framePixels.height) throw Error('fixed-canvas-source-frame-size-changed');
        return latest;
      },2000,lifetime);
      capture = {...shape,source,checkedAt,verified:true,hostGeneration:generation,
        frameSequence:frame.sequence,monitorPhysical:monitor};
      slot.pair?.refresh();
      await waitUntil(()=>presented,1800,lifetime);
      noteProof(null);
      return {close};
    } catch (error) {
      const reason = /^[a-zA-Z0-9-]{1,80}$/.test(error?.message ?? '')
        ? error.message : 'fixed-canvas-placement-unavailable';
      noteProof(reason);
      // Hand the cleanup back to the manual owner, including any unconfirmed observer exit.
      return {ready:false,close};
    }
  }

  return Object.freeze({
    start: manual.start,
    stop: manual.stop,
    dispose: manual.dispose,
    acceptViewport(owner, packet) {
      const slot = active;
      if (!slot || owner !== slot.owner || owner !== readOwner() || owner.actionsSseRes !== slot.stream ||
          packet?.nonce !== slot.token.nonce || !Number.isSafeInteger(packet.sequence) ||
          packet.sequence <= slot.sequence || typeof packet.visible !== 'boolean') return false;
      slot.sequence = packet.sequence;
      slot.viewport = packet;
      if (slot.pair) slot.pair.updateViewport(owner,packet);
      return true;
    },
  });
}
