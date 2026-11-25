export const sceneMonitor = Object.freeze({left: 0, top: 0, width: 2560, height: 1440, monitorCount: 1});
const need = (ok, reason) => {if (!ok) throw Error(reason);};
const same = (a, b, keys) => Boolean(a && b && keys.every(key => a[key] === b[key]));
const integer = value => Number.isSafeInteger(value) && value > 0;
function dimensions(value, expected) {
  return same(value, expected, ['width', 'height']);
}

export function validateSceneRoot(report, plan) {
  const {frame, client, rootSize, crop} = report;
  const offscreen = frame && [frame.left, frame.top, frame.right, frame.bottom].every(Number.isSafeInteger) &&
    (frame.left >= sceneMonitor.width || frame.right <= 0 || frame.top >= sceneMonitor.height || frame.bottom <= 0);
  need(report.outcome === 'offscreen-root-profile-recorded' && report.runId === plan.runId &&
    report.rootHwnd === plan.hwnd && report.pid === plan.pid && report.startTicks === plan.startTicks &&
    integer(report.childHwnd) && report.childHwnd !== report.rootHwnd && report.capture?.usable === true &&
    report.screenPixelReads === 0 && report.imagesSaved === false &&
    offscreen && same(client,frame,['left','top','right','bottom']) &&
    frame.right - frame.left === sceneMonitor.width && frame.bottom - frame.top === sceneMonitor.height &&
    dimensions(rootSize, sceneMonitor) && dimensions(crop, sceneMonitor) && crop.x === 0 && crop.y === 0,
    'fixed-canvas-source-geometry-unverified');
  return {framePixels: {width: rootSize.width, height: rootSize.height},
    captureContentPixels: {left: crop.x, top: crop.y, width: crop.width, height: crop.height}};
}

