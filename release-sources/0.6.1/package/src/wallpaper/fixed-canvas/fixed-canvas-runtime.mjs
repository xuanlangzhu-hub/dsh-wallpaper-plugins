const rectangleKeys = ['left','top','width','height'];
const positive = value => Number.isSafeInteger(value) && value > 0;
const pixelSize = value => positive(value?.width) && positive(value?.height) && value.width <= 16384 && value.height <= 16384;
const rectangle = value => pixelSize(value) && rectangleKeys.every(key => Number.isSafeInteger(value[key])) &&
  [value.left,value.top,value.left+value.width,value.top+value.height].every(edge => Math.abs(edge) <= 2147483647);
const keepBox = value => Object.freeze(Object.fromEntries(rectangleKeys.map(key => [key,value[key]])));
const sameBox = (a,b) => rectangle(a) && rectangle(b) && rectangleKeys.every(key => a[key] === b[key]);
const sameSize = (a,b) => pixelSize(a) && pixelSize(b) && a.width === b.width && a.height === b.height;
const fresh = (time,now,limit) => Number.isSafeInteger(time) && time <= now && now-time < limit;
const digits = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
const identityKeys = ['runId','pid','hwnd','startTicks','ownerGeneration'];
const sourceKeys = ['location','hwnd','pid','startUtc'];

/** The native producer is on the Host side. The renderer only reads this slot. */
export function createFixedCanvasRuntime({wallpaper, now=Date.now}) {
  let owner = null, active = null, revision = 0;
  const owns = (generation,instanceId) => owner?.generation === generation && owner?.instanceId === instanceId;
  const live = () => {
    const session = wallpaper.currentSession();
    const state = session?.state();
    const monitor = state?.config?.fixedCanvasMonitor;
    if (!session || wallpaper.ownership() || !state?.captureStarted || state.stopRequested ||
      session.hub?.closed !== false || !session.hub.latest || monitor?.monitorCount !== 1 || !rectangle(monitor)) return null;
    const source = {location:state.location,hwnd:state.config.window,pid:state.windowPid,startUtc:state.windowStartUtc};
    if (typeof source.location !== 'string' || !source.location || !positive(source.hwnd) || !positive(source.pid) ||
      typeof source.startUtc !== 'string' || !source.startUtc) return null;
    return {session, monitor, source, generation:wallpaper.playbackGeneration(), frame:session.hub.latest};
  };
  function attached(slot, at) {
    if (slot !== active || slot.expiresAt <= at) return false;
    const source = live();
    return source?.session === slot.session && source.generation === slot.evidence.hostGeneration &&
      sourceKeys.every(key => source.source[key] === slot.source[key]) &&
      sameBox(source.monitor,slot.evidence.monitorPhysical) && sameSize(source.frame,slot.evidence.framePixels) &&
      source.frame.sequence >= slot.proofSequence;
  }

  return Object.freeze({
    claim(generation, instanceId) {
      if (!positive(generation) || typeof instanceId !== 'string' || !instanceId) return false;
      if (owns(generation,instanceId)) return true;
      owner = {generation,instanceId};
      active = null;
      return true;
    },
    release(generation, instanceId) {
      if (!owns(generation,instanceId)) return;
      owner = active = null;
    },
    bind({generation, instanceId, expiresAt, capture, calibration}) {
      const at = now(), source = live();
      if (!owns(generation,instanceId) || !source || !Number.isSafeInteger(expiresAt) ||
        expiresAt <= at || expiresAt-at > 66000 || !positive(capture?.hostGeneration) ||
        capture.hostGeneration !== source.generation || capture?.verified !== true || !fresh(capture.checkedAt,at,4000) ||
        !positive(capture.frameSequence) || capture.frameSequence > source.frame.sequence ||
        source.frame.sequence-capture.frameSequence > 120 ||
        !sourceKeys.every(key => capture.source?.[key] === source.source[key]) ||
        !sameBox(capture.monitorPhysical,source.monitor) || !sameSize(capture.framePixels,source.frame) ||
        !rectangle(capture.captureContentPixels) || !sameSize(capture.captureContentPixels,source.monitor) ||
        capture.captureContentPixels.left < 0 || capture.captureContentPixels.top < 0 ||
        capture.captureContentPixels.left+capture.captureContentPixels.width > capture.framePixels.width ||
        capture.captureContentPixels.top+capture.captureContentPixels.height > capture.framePixels.height ||
        calibration?.ownerGeneration !== generation || !positive(calibration.pid) ||
        typeof calibration.runId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(calibration.runId) ||
        !digits(calibration.hwnd) || !digits(calibration.startTicks) ||
        !sameBox(calibration.monitorPhysical,source.monitor) ||
        !Number.isFinite(calibration.dpr) || calibration.dpr < .75 || calibration.dpr > 4 ||
        ![calibration.clientOffsetX,calibration.clientOffsetY].every(offset => Number.isSafeInteger(offset)&&Math.abs(offset)<=1)) return null;
      const evidence = Object.freeze({hostGeneration:source.generation, captureContentVerified:true,
        monitorPhysical:keepBox(source.monitor), captureContentPixels:keepBox(capture.captureContentPixels),
        framePixels:Object.freeze({width:source.frame.width,height:source.frame.height}),
        calibration:Object.freeze({...Object.fromEntries(identityKeys.map(key => [key,calibration[key]])),
          monitorPhysical:keepBox(source.monitor),dpr:calibration.dpr,
          clientOffsetX:calibration.clientOffsetX,clientOffsetY:calibration.clientOffsetY})});
      const slot = {revision:++revision, evidence, expiresAt, session:source.session, source:source.source,
        proofSequence:capture.frameSequence, layout:null, sequence:0, sampledAt:0};
      active = slot;
      return Object.freeze({
        acceptLine(line) {
          if (typeof line !== 'string' || line.length > 4096 || !attached(slot,now())) return false;
          let packet;
          try {packet=JSON.parse(line);} catch {return false;}
          if (packet?.scope !== 'fixed-canvas-layout-watch-v1' || !positive(packet.sequence) ||
            packet.sequence <= slot.sequence || !fresh(packet.sampledAt,now(),250) ||
            (packet.available && packet.sampledAt < slot.sampledAt) ||
            !identityKeys.every(key => packet[key] === evidence.calibration[key]) || typeof packet.available !== 'boolean' ||
            (packet.originOnly !== undefined && (packet.originOnly !== true || !packet.available))) return false;
          const geom = packet.geometry;
          if (packet.available && (!rectangle(geom?.nativeClientPhysical) || !sameBox(geom.monitorPhysical,source.monitor) ||
            !positive(geom.windowDpi))) return false;
          slot.sequence = packet.sequence;
          if (packet.available) slot.sampledAt = packet.sampledAt;
          slot.layout = Object.freeze({scope:packet.scope, ...Object.fromEntries(identityKeys.map(key => [key,packet[key]])),
            sequence:packet.sequence,sampledAt:packet.sampledAt,available:packet.available,
            ...(packet.originOnly === true && {originOnly:true}),
            geometry:packet.available ? Object.freeze({nativeClientPhysical:keepBox(geom.nativeClientPhysical),
              monitorPhysical:keepBox(geom.monitorPhysical),windowDpi:geom.windowDpi}) : null});
          return true;
        },
        renew(expiresAt) {
          const at=now();
          if (!attached(slot,at) || !Number.isSafeInteger(expiresAt) || expiresAt < slot.expiresAt || expiresAt-at > 66000) return false;
          slot.expiresAt=expiresAt;
          return true;
        },
        dispose() {if(active===slot)active=null;},
      });
    },
    read(generation,instanceId) {
      if (!owns(generation,instanceId)) return null;
      const at=now(), slot=active;
      if (!slot) return null;
      if (!attached(slot,at)) {active=null;return null;}
      if (!fresh(slot.layout?.sampledAt,at,250)) return null;
      return {owner:generation,revision:slot.revision,expiresAt:slot.expiresAt,evidence:slot.evidence,layout:slot.layout};
    },
  });
}
