const limit = 250;

function add(histogram, ms) {
  if (Number.isSafeInteger(ms) && ms >= 0 && ms < limit) histogram[ms]++;
}

function summarize(histogram) {
  const count = histogram.reduce((total, n) => total+n,0);
  if (!count) return {count,medianMs:null,p95Ms:null};

  let seen = 0, medianMs = null;
  for (let ms=0; ms<histogram.length; ms++) {
    seen += histogram[ms];
    if (medianMs === null && seen >= Math.ceil(count/2)) medianMs = ms;
    if (seen >= Math.ceil(count*.95)) return {count,medianMs,p95Ms:ms};
  }
}

// Keep bounded timing aggregates for the playback report. No screen positions leave this observer.
export function createLayoutTiming() {
  const readMs = new Uint32Array(limit), moveMs = new Uint32Array(limit), resizeMs = new Uint32Array(limit);
  let previous = null, unavailable = 0;
  return {
    observe(packet) {
      const box = packet.geometry?.rendererClient;
      if (packet.available !== true || !box) {
        previous = null;
        unavailable++;
        return;
      }
      const {sampledAt,startedAt} = packet;
      add(readMs,sampledAt-startedAt);
      const width = box.right-box.left, height = box.bottom-box.top;
      if (previous && sampledAt > previous.sampledAt) {
        const gap = sampledAt-previous.sampledAt;
        if (width !== previous.width || height !== previous.height) add(resizeMs,gap);
        else if (box.left !== previous.left || box.top !== previous.top) add(moveMs,gap);
      }
      previous = {left:box.left,top:box.top,width,height,sampledAt};
    },
    snapshot: () => ({read:summarize(readMs),move:summarize(moveMs),resize:summarize(resizeMs),unavailable}),
  };
}
