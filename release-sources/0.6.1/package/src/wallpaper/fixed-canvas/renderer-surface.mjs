import {compareViewport} from './viewport-observation.mjs';

const rectangleKeys = ['left', 'top', 'width', 'height'];
const nativeId = value => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value);

// Only the Host's renderer-bound geometry provider may supply the third observation.
// A main-window rectangle or a renderer-reported screen position is not that observation.
export function compareRendererSurface(native, viewport, surface, options = {}) {
  const {ownerGeneration, layoutRevision, now = Date.now(), maxAgeMs = 250} = options;
  const comparison = compareViewport(native, viewport, {...options, now});
  if (surface == null) return {contentPhysical: null, reason: 'renderer-surface-unavailable'};
  if (surface.scope !== 'fixed-canvas-renderer-surface-v1' ||
      surface.ownerGeneration !== ownerGeneration || surface.layoutRevision !== layoutRevision ||
      !Number.isSafeInteger(native.pid) || native.pid <= 0 || surface.pid !== native.pid ||
      !nativeId(native.hwnd) || surface.hwnd !== native.hwnd ||
      !nativeId(native.startTicks) || surface.startTicks !== native.startTicks) {
    throw Error('renderer-surface-binding');
  }
  if (!Number.isSafeInteger(surface.sampledAt) || surface.sampledAt > now || now - surface.sampledAt > maxAgeMs) {
    throw Error('renderer-surface-stale');
  }
  if (!comparison.unpanned || !comparison.monitorScaleMatch) {
    return {contentPhysical: null, reason: comparison.unpanned ? 'renderer-scale-differs-from-window-dpi' : 'visual-viewport-transformed'};
  }

  const box = surface.contentPhysical;
  const client = native.geometry.nativeClientPhysical;
  if (!rectangleKeys.every(key => client[key] === surface.nativeClientPhysical?.[key])) {
    return {contentPhysical: null, reason: 'renderer-surface-client-changed'};
  }
  // Keep the measured renderer dimensions. At fractional DPI its far edges can round up by one pixel.
  if (!rectangleKeys.every(key => Number.isSafeInteger(box?.[key])) ||
      box.width <= 0 || box.height <= 0 ||
      box.left < client.left || box.top < client.top ||
      box.left + box.width > client.left + client.width + 1 || box.top + box.height > client.top + client.height + 1) {
    return {contentPhysical: null, reason: 'renderer-surface-outside-client'};
  }
  if (Math.abs(box.width - viewport.width * viewport.dpr) > 1 ||
      Math.abs(box.height - viewport.height * viewport.dpr) > 1) {
    return {contentPhysical: null, reason: 'renderer-surface-viewport-size-mismatch'};
  }
  const {left, top, width, height} = box;
  return {contentPhysical: {left, top, width, height}, reason: null};
}
