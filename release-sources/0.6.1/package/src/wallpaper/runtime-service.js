// Same runtime ports and budgets; automatic startup gets an idle-only playback lease.
import {isSceneId,AGE_RATINGS} from '../appearance-contract.js';
import {createDesktopLibraryBridge} from './desktop-follow-library.js';
import {createDesktopFollowController} from './desktop-follow-controller.js';
const valid=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(k=>['enabled','wanted','manualSceneId','allowedRatings'].includes(k))&&
 Object.entries(p).every(([k,v])=>k==='manualSceneId'?v===null||isSceneId(v):k==='allowedRatings'?Array.isArray(v)&&v.every(r=>AGE_RATINGS.includes(r)):typeof v==='boolean');
export function createDesktopFollowRuntimeService({library,wallpaper,queryPort=null,lookup=null,limits={},primeMs=5000}={}) {
 if(!Number.isInteger(primeMs)||primeMs<1||primeMs>30000)throw Error('follow-prime-budget-invalid');
 const bridge=lookup??createDesktopLibraryBridge(library);
 let owner=null,lastSequence=0,engaged=false,disposed=false,primed=false,cleanup=null,primeTask=null,primeUnconfirmed=false;
 let startup=null,startupSubmitted=false,startupStatus='none',forceStop=0;
 const idle=()=>{const s=wallpaper.statusPayload();return s.available===true&&s.active===false&&s.activeSceneId==null&&s.failed===false&&!s.session&&wallpaper.readCloseState().quiescent===true&&!wallpaper.ownership?.();};
 async function prime(){if(primed)return;if(!primeTask){primeTask=Promise.resolve().then(()=>bridge.refresh());const task=primeTask;task.then(()=>{primed=true;if(primeTask===task)primeTask=null;},()=>{if(primeTask===task)primeTask=null;});}
  let timer;try{await Promise.race([primeTask,new Promise((_,reject)=>{timer=setTimeout(()=>{primeUnconfirmed=true;reject(Error('follow-catalog-timeout'));},primeMs);})]);}finally{clearTimeout(timer);}}
 const playback={state:()=>({...wallpaper.statusPayload(),quiescent:wallpaper.readCloseState().quiescent}),
  stop(){
   if(startup&&!forceStop&&!startup.creating&&startup.createdGeneration!==wallpaper.playbackGeneration())return Promise.resolve({skipped:true});
   return wallpaper.stopNow();
  },
  async restart(id){
   const context=startup,verify=target=>bridge.verifyForPlayback(target,{allowedRatings:core.state().allowedRatings});
   if(!context)return wallpaper.restartFromHost(id,{verify});
   if(!idle()){startupStatus='occupied';throw Error('startup-source-occupied');}
   context.creating=true;
   try{const value=await wallpaper.startFromHost(id,{verify});context.createdGeneration=value.hostPlaybackGeneration;return value;}
   finally{context.creating=false;}
  }};
 const core=createDesktopFollowController({lookup:bridge,playback,query:options=>queryPort.query(options),...limits});
 function snapshot(sequence=lastSequence){const s=core.state(),host=wallpaper.statusPayload(),q=queryPort?.read?.();return{protocol:1,owner,sequence,
  state:{...s,available:!disposed&&q?.available===true&&!cleanup&&!primeUnconfirmed,blocked:s.blocked||q?.uncertain===true||primeUnconfirmed,queryPending:q?.pending===true,catalogPending:primeTask!==null,startupStatus},
  playback:{generation:wallpaper.playbackGeneration(),active:host.active===true,activeSceneId:host.activeSceneId??null,mode:host.mode??null,failed:host.failed===true,available:host.available===true}};}
 function stopOwned(explicit=false){if(!engaged&&!explicit)return Promise.resolve();let stopping;try{if(explicit)forceStop++;stopping=core.stop();}finally{if(explicit)forceStop--;}
  const task=Promise.resolve(stopping);cleanup=task;task.finally(()=>{if(cleanup===task)cleanup=null;}).catch(()=>{});return task;}
 return {read:snapshot,readIntent:()=>core.state(),
  claim(id){if(!Number.isSafeInteger(id)||id<1||disposed)throw Error('follow-owner-invalid');if(owner!==id){if(owner!==null)void stopOwned();owner=id;lastSequence=0;startupSubmitted=false;}return snapshot();},
  release(id){if(owner!==id)return Promise.resolve();owner=null;lastSequence=0;return stopOwned();},
  async request(id,sequence,action,patch){
   if(disposed||id!==owner||!Number.isSafeInteger(sequence)||sequence<=lastSequence)throw Error('follow-stale-request');
   if(!['read','configure','tick','stop','startup'].includes(action)||(['configure','startup'].includes(action)?!valid(patch)||action==='startup'&&(patch.enabled!==true||patch.wanted!==true):patch!==undefined))throw Error('follow-request-invalid');
   lastSequence=sequence;if(action==='read')return snapshot(sequence);if(action==='stop'){await stopOwned(true);return snapshot(sequence);}
   if(!snapshot().state.available)throw Error('follow-unavailable');
   if(action==='startup'){
    if(startupSubmitted){startupStatus='already-attempted';return snapshot(sequence);}startupSubmitted=true;
    if(core.state().wanted||core.state().pendingOperations||queryPort.read().pending||!idle()){startupStatus='occupied';return snapshot(sequence);}
    const context={creating:false,createdGeneration:null};startup=context;startupStatus='starting';engaged=true;
    try{await core.configure(patch);await prime();if(owner===id&&sequence===lastSequence)await core.tick();
     if(startup===context&&core.state().phase==='running'){startupStatus='running';startup=null;}
    }finally{if(startup===context){core.cancelStartupIntent();if(startupStatus==='starting')startupStatus='not-started';}}
   }else{engaged=true;if(action==='configure'){startup=null;await core.configure(patch);await prime();}else await core.tick();}
   if(owner!==id||sequence!==lastSequence)throw Error('follow-stale-result');return snapshot(sequence);
  },
  verifyForPlayback:(id,options)=>bridge.verifyForPlayback(id,{allowedRatings:core.state().allowedRatings,...options}),
  async dispose(){disposed=true;owner=null;queryPort?.dispose?.();await stopOwned();bridge.dispose();const q=queryPort?.read?.(),s=core.state();
   return {ok:!q?.pending&&!q?.uncertain&&!s.blocked&&s.pendingOperations===0&&!primeTask&&!primeUnconfirmed,queryPending:q?.pending===true,blocked:s.blocked||q?.uncertain===true};},
 };
}
