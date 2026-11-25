import {compareRendererSurface} from '../renderer-surface.mjs';

const rectKeys = ['left', 'top', 'width', 'height'];
const windowKeys = ['runId', 'pid', 'hwnd', 'startTicks', 'ownerGeneration', 'rendererHwnd', 'rendererThread'];
const viewportKeys = ['width', 'height', 'dpr', 'visualWidth', 'visualHeight', 'visualScale', 'offsetLeft', 'offsetTop'];
const same = (a, b, keys) => a && b && keys.every(key => a[key] === b[key]);
const sameOwner = (a, b) => same(a, b, ['instanceId', 'generation']);
const lifetime = 250;
const clockLeadMs = 1;

function observedAt(sampledAt, receivedAt, previous) {
  if (!Number.isSafeInteger(sampledAt) || sampledAt > receivedAt + clockLeadMs) return null;
  const capturedAt = Math.min(sampledAt,receivedAt);
  return capturedAt >= previous ? capturedAt : null;
}

function physical(box) {
  if (![box?.left, box?.top, box?.right, box?.bottom].every(Number.isSafeInteger) ||
      box.right <= box.left || box.bottom <= box.top) return null;
  return {left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top};
}

function resolveSurfaceLayout(native, viewport, monitorPhysical, now) {
  const geometry = native.geometry;
  if (!geometry || !same(physical(geometry.monitor), monitorPhysical, rectKeys)) return {reason:'monitor-mismatch'};
  if (!Number.isSafeInteger(viewport.width) || !Number.isSafeInteger(viewport.height) ||
      viewport.dpr < .75 || viewport.dpr > 4) return {reason:'viewport-metrics-invalid'};
  const client = physical(geometry.nativeClient);
  const bounds = physical(geometry.rendererClient);
  if (!client || !bounds) return {reason:'native-bounds-invalid'};
  const binding = {
    pid: native.pid, hwnd: native.hwnd, startTicks: native.startTicks,
    ownerGeneration: native.ownerGeneration, layoutRevision: viewport.layoutRevision,
  };
  const sample = {
    ...binding, ok: true, scope: 'fixed-canvas-window-geometry-v1', physicalCoordinates: true,
    localThreadDpiContextRestored: true, rendererContentConfirmed: false,
    sampledAt: new Date(native.sampledAt).toISOString(),
    geometry: {nativeClientPhysical: client, windowDpi: geometry.windowDpi},
  };
  const surface = {
    ...binding, scope: 'fixed-canvas-renderer-surface-v1', sampledAt: native.sampledAt,
    nativeClientPhysical: client, contentPhysical: bounds,
  };
  try {
    const result=compareRendererSurface(sample, viewport, surface, {...binding, now, maxAgeMs: lifetime});
    if (!result.contentPhysical) {
      const {reason}=result;
      const overlap=bounds.left<client.left+client.width && client.left<bounds.left+bounds.width &&
        bounds.top<client.top+client.height && client.top<bounds.top+bounds.height;
      return {reason, originOnly:reason==='renderer-surface-viewport-size-mismatch' ||
        (reason==='renderer-surface-outside-client' && overlap)};
    }
  } catch {
    return {reason:'surface-observation-rejected'};
  }
  const {width, height, dpr} = viewport;
  const contentPhysical = {left: bounds.left, top: bounds.top, width: width * dpr, height: height * dpr};
  const right = Math.floor(Math.min(bounds.left + bounds.width, client.left + client.width,
    contentPhysical.left + contentPhysical.width));
  const bottom = Math.floor(Math.min(bounds.top + bounds.height, client.top + client.height,
    contentPhysical.top + contentPhysical.height));
  if (right <= bounds.left || bottom <= bounds.top) return {reason:'surface-clip-empty'};
  return {
    layout: {contentPhysical,
      visiblePhysical: {left: bounds.left, top: bounds.top, width: right - bounds.left, height: bottom - bounds.top},
      viewportCss: {width, height}, dpr},
  };
}

// Feed this from the Host's bound native reader and the current authenticated renderer connection.
// Publishing null withdraws the old layout even if there is no newer wallpaper frame.
export function createSurfaceLayout({window, owner, monitorPhysical, readOwner, publish, report=()=>{}, observe=()=>{},
  now = Date.now, schedule = setTimeout, cancel = clearTimeout}) {
  if (!owner?.instanceId || window.ownerGeneration !== owner.generation) throw Error('surface-owner-binding');
  const identity = {...window};
  const session = {...owner};
  const monitor = {...monitorPhysical};
  let native = null, viewport = null, metrics = null, timer, lastLayout = null, lastReason;
  let nativeSequence = 0, viewportSequence = 0, lastNativeAt = 0, lastViewportAt = 0;
  let revision = -1, layoutSince = 0, disposed = false;

  function emit(layout, reason, originOnly=false) {
    if (reason!==lastReason) {
      lastReason=reason;
      report(reason);
    }
    observe(layout, layout || originOnly ? {
      native, sampledAt: Math.min(native.sampledAt, viewport.sampledAt), originOnly,
    } : null);
    if (JSON.stringify(layout) === JSON.stringify(lastLayout)) return;
    lastLayout = layout;
    publish(layout);
  }
  function dispose(reason='watch-stopped') {
    if (disposed) return;
    disposed = true;
    cancel(timer);
    emit(null,reason);
  }
  function current() {
    if (!disposed && !sameOwner(readOwner(), session)) dispose('renderer-connection-retired');
    return !disposed;
  }
  function refresh() {
    if (!current()) return;
    cancel(timer);
    const at = now();
    if (!native) return emit(null,'native-unavailable');
    if (!viewport) return emit(null,'viewport-unavailable');
    if (native.sampledAt > at || viewport.sampledAt > at) return emit(null,'sample-in-future');
    const remaining = Math.min(native.sampledAt, viewport.sampledAt) + lifetime - at;
    if (remaining <= 0) {
      emit(null, native.sampledAt<=viewport.sampledAt?'native-expired':'viewport-expired');
      return;
    }
    timer = schedule(refresh, remaining);
    const {layout,reason,originOnly}=resolveSurfaceLayout(native, viewport, monitor, at);
    const beforeRevision=native.startedAt < layoutSince;
    if (layout && !beforeRevision) return emit(layout,'paired');
    // The measured origin can still place the crop while CSS and native sizes settle.
    emit(null,beforeRevision && (layout || originOnly) ? 'native-before-viewport-revision' : reason,
      Boolean(layout || originOnly));
  }
  return {
    updateNative(packet) {
      if (!current() || packet?.scope !== 'fixed-canvas-surface-watch-v1' || !same(packet, identity, windowKeys) ||
          !Number.isSafeInteger(packet.sequence) || packet.sequence <= nativeSequence) return false;
      nativeSequence = packet.sequence;
      if (packet.terminal === true) {
        dispose('native-binding-retired');
        return true;
      }
      if (packet.available !== true) {
        native = null;
        refresh();
        return true;
      }
      const {startedAt,sampledAt} = packet;
      const capturedAt = observedAt(sampledAt,now(),lastNativeAt);
      if (capturedAt === null || !Number.isSafeInteger(startedAt) ||
          startedAt > sampledAt || sampledAt - startedAt >= lifetime) {
        report('native-timing-ignored');
        return false;
      }
      lastNativeAt = capturedAt;
      native = {...packet,startedAt:Math.min(startedAt,capturedAt),sampledAt:capturedAt};
      refresh();
      return true;
    },
    updateViewport(sender, {sequence, visible, observation} = {}) {
      if (!current() || !sameOwner(sender, session) || !Number.isSafeInteger(sequence) || sequence <= viewportSequence) return false;
      viewportSequence = sequence;
      if (visible !== true || observation?.scope !== 'fixed-canvas-renderer-viewport-v1' ||
          observation.ownerGeneration !== session.generation ||
          !Number.isSafeInteger(observation.layoutRevision) || observation.layoutRevision < Math.max(0, revision)) {
        native = viewport = null;
        refresh();
        return false;
      }
      // A malformed timestamp does not tell us that the current viewport disappeared.
      const capturedAt = observedAt(observation.sampledAt,now(),lastViewportAt);
      if (capturedAt === null) {
        report('viewport-timing-ignored');
        return false;
      }
      if (observation.layoutRevision === revision && !same(observation, metrics, viewportKeys)) {
        native = viewport = null;
        refresh();
        return false;
      }
      if (!viewport || observation.layoutRevision !== revision) layoutSince = capturedAt;
      revision = observation.layoutRevision;
      lastViewportAt = capturedAt;
      viewport = metrics = {...observation,sampledAt:capturedAt};
      refresh();
      return true;
    },
    refresh, dispose,
  };
}
