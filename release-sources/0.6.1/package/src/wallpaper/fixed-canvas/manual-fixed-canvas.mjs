import {isSceneId} from '../../appearance-contract.js';

const supportedMonitor = Object.freeze({left:0,top:0,width:2560,height:1440,monitorCount:1});
const launchSize = Object.freeze({width:2538,height:1384});
const monitorKeys = Object.keys(supportedMonitor);

export function fixedCanvasSelection(settings, scene, monitor) {
  return isSceneId(scene) && settings?.weScene === scene && settings.background === 'wallpaper' &&
    settings.weMode === 'daily' && settings.weFollowDesktop === false &&
    monitor != null && monitorKeys.every(key => monitor[key] === supportedMonitor[key])
    ? {...supportedMonitor,launchSize} : null;
}

function matchesMonitor(value, expected) {
  return value != null && monitorKeys.every(key => value[key] === expected[key]) &&
    value.launchSize?.width === expected.launchSize.width && value.launchSize?.height === expected.launchSize.height;
}

/**
 * Manual fixed playback uses the same playback owner as ordinary playback.
 * Probe acquisition and source proof are private Host adapters. The caller supplies only a scene ID.
 */
export function createManualFixedCanvas({wallpaper, readOwner, readMonitor, bindPlacement, allowSelection, verifySelection}) {
  let active = null;

  function configured(owner, scene, monitor) {
    const current = readOwner();
    if (!owner || current !== owner || !current.actionsSseRes ||
        current.actionsSseRes.destroyed || current.actionsSseRes.writableEnded) return null;
    const settings = current.snapshot?.settings;
    const selection = fixedCanvasSelection(settings, scene, monitor);
    return selection && allowSelection(settings, scene) ? selection : null;
  }

  function ownsSource(run) {
    return run.session && wallpaper.currentSession() === run.session &&
      wallpaper.playbackGeneration() === run.generation;
  }

  async function release(run) {
    run.controller.abort();
    let placementClosed = true;
    try {
      await run.placement?.close();
      run.placement = null;
    } catch { placementClosed = false; }
    // A normal stop or restart may already be closing this exact playback.
    if (ownsSource(run)) await wallpaper.ownership()?.promise?.catch(() => {});
    let sourceClosed = true;
    if (ownsSource(run)) {
      // A replacement or normal stop owns its own cleanup. Never stop it here.
      sourceClosed = false;
      if (!wallpaper.ownership()) {
        try {
          const result = await wallpaper.stopNow();
          sourceClosed = result.ok === true && result.payload?.cleanup?.closed === true;
        } catch { /* The normal cleanup state retains the failed session. */ }
      }
    }
    if (placementClosed && sourceClosed && active === run) active = null;
    return {ok:placementClosed && sourceClosed};
  }

  async function launch(run, scene) {
    try {
      const {signal} = run.controller;
      const monitor = await readMonitor({scene,signal});
      const selected = configured(run.owner,scene,monitor);
      if (signal.aborted || !selected || run.stream !== run.owner.actionsSseRes ||
          run.admission !== wallpaper.generation() || !wallpaper.readCloseState().quiescent) {
        await release(run);
        return {ok:false,error:'fixed-canvas-unavailable'};
      }

      const isConfigured = () => !signal.aborted && run.stream === run.owner.actionsSseRes &&
        Boolean(configured(run.owner,scene,monitor));
      const verify = async id => {
        if (id !== scene || !isConfigured()) throw Error('fixed-canvas-selection-changed');
        const settings = run.owner.snapshot.settings;
        const selection = await verifySelection(id,settings);
        if (!isConfigured() || settings.weAgeRatings !== run.owner.snapshot.settings.weAgeRatings)
          throw Error('fixed-canvas-selection-changed');
        return selection;
      };
      const result = await wallpaper.startFromHost(scene,{fixedCanvasMonitor:selected,signal,verify});
      const current = wallpaper.currentSession();
      const config = current?.state().config;
      if (current && result.hostPlaybackGeneration === wallpaper.playbackGeneration() &&
          config?.sceneId === scene && config.fixedCanvasMonitor) {
        run.session = current;
        run.generation = result.hostPlaybackGeneration;
      }
      if (!run.session || !matchesMonitor(config.fixedCanvasMonitor,selected)) {
        const closed = await release(run);
        return {ok:false,error:closed.ok ? 'fixed-canvas-playback-changed' : 'fixed-canvas-cleanup-pending'};
      }

      const isCurrent = () => isConfigured() && ownsSource(run) &&
        !current.state().stopRequested && !current.hub.closed;
      if (isCurrent()) run.placement = await bindPlacement({
        owner:run.owner, monitor:selected, session:current, generation:run.generation, signal, isCurrent,
      });
      const host = wallpaper.statusPayload();
      if (typeof run.placement?.close !== 'function' || run.placement.ready === false || !isCurrent() || host.active !== true || host.failed === true ||
          host.mode !== 'daily' || host.activeSceneId !== scene) {
        const closed = await release(run);
        return {ok:false,error:closed.ok ? 'fixed-canvas-placement-unavailable' : 'fixed-canvas-cleanup-pending'};
      }
      return {ok:true,host:{...host,generation:run.generation,
        session:{...host.session,fixedCanvasRequest:{width:selected.width,height:selected.height}}}};
    } catch {
      const closed = await release(run);
      return {ok:false,error:closed.ok ? 'fixed-canvas-start-failed' : 'fixed-canvas-cleanup-pending'};
    }
  }

  async function stop(owner, generation) {
    const run=active;
    if (!run || run.owner!==owner || (generation !== undefined && run.generation !== generation)) return {ok:true};
    run.controller.abort();
    await run.started;
    if (active!==run) return {ok:true};
    run.closing ??= release(run).then(result=>{run.closing=null;return result;});
    return run.closing;
  }

  return Object.freeze({
    async start(owner, scene, signal) {
      const ready = () => !signal?.aborted && configured(owner,scene,supportedMonitor) &&
        wallpaper.readCloseState().quiescent;
      if (!ready()) return {ok:false,error:'fixed-canvas-unavailable'};
      // A normal stop can close the source before the observer notices. Join that cleanup
      // before opening the next scene, then check admission again.
      if (active?.settled && active.session) {
        const closed = await stop(active.owner,active.generation);
        if (!closed.ok) return {ok:false,error:'fixed-canvas-cleanup-pending'};
      }
      if (active || !ready()) return {ok:false,error:'fixed-canvas-unavailable'};
      const run={owner,stream:owner.actionsSseRes,controller:new AbortController(),session:null,placement:null,
        admission:wallpaper.generation(),settled:false};
      const cancel = () => run.controller.abort();
      signal?.addEventListener('abort',cancel,{once:true});
      active=run;
      run.started=launch(run,scene).finally(()=>{run.settled=true;signal?.removeEventListener('abort',cancel);});
      return run.started;
    },
    stop,
    dispose: () => stop(active?.owner),
  });
}
