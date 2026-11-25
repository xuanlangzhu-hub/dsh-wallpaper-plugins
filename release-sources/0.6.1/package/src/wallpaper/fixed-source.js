import { validateSize } from './managed-window.js';

// This input comes from the Host's monitor reader. Browser playback requests remain id-only.
export function fixedSourceMonitor(value) {
  if (value == null) return null;
  const { monitorCount, left, top, width, height } = value;
  if (monitorCount !== 1 || ![left, top, width, height].every(Number.isSafeInteger)) {
    throw new Error('fixed canvas requires one measured physical monitor');
  }
  return Object.freeze({
    monitorCount,
    left,
    top,
    width: validateSize(width),
    height: validateSize(height),
    ...(value.launchSize && {launchSize: Object.freeze({width:validateSize(value.launchSize.width,width),
      height:validateSize(value.launchSize.height,height)})}),
  });
}

export function fixedWindowBounds(window) {
  const { left, top, width, height } = window;
  if (![left, top, width, height].every(Number.isSafeInteger) || width <= 0 || height <= 0) {
    throw new Error('fixed canvas source window bounds are unavailable');
  }
  return { left, top, width, height };
}
