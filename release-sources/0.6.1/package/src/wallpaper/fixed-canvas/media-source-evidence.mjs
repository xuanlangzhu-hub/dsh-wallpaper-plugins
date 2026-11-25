const coordinates = ['left','top','right','bottom'];
const box = value => value && coordinates.every(key => Number.isInteger(value[key]) &&
  value[key] >= -2147483648 && value[key] <= 2147483647) &&
  value.right > value.left && value.bottom > value.top;

export function validateMediaRoot(report, plan, monitor) {
  const {frame,client,rootSize,crop} = report ?? {};
  if (report?.outcome !== 'offscreen-client-profile-recorded' || report.runId !== plan.runId ||
      report.rootHwnd !== plan.hwnd || report.pid !== plan.pid || report.startTicks !== plan.startTicks ||
      report.rootClass !== 'WPEOverlappedWallpaper' || report.screenPixelReads !== 0 ||
      report.imagesSaved !== false || !box(frame) || !box(client) ||
      !(frame.left >= monitor.left+monitor.width || frame.right <= monitor.left ||
        frame.top >= monitor.top+monitor.height || frame.bottom <= monitor.top)) {
    throw Error('fixed-canvas-media-source-unverified');
  }

  const width = frame.right-frame.left, height = frame.bottom-frame.top;
  const left = client.left-frame.left, top = client.top-frame.top;
  const contentWidth = client.right-client.left, contentHeight = client.bottom-client.top;
  if (rootSize?.width !== width || rootSize?.height !== height || width*height > 10000000 ||
      left < 0 || top < 0 || left+contentWidth > width || top+contentHeight > height ||
      crop?.x !== left || crop?.y !== top || crop?.width !== contentWidth || crop?.height !== contentHeight) {
    throw Error('fixed-canvas-media-client-unverified');
  }
  return {framePixels:{width,height},captureContentPixels:{left,top,width:contentWidth,height:contentHeight}};
}
