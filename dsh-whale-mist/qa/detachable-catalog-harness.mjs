import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
export async function createRig(sourcePath,{fetchMode='ready',syncThrow=false,missingWallpaper=false,missingSnapshot=false,items=null,sceneId='lucy',initialSettings={},allowSettingsWrite=false,persistedStore=null,engineFetchImpl=null}={}){
 const source=await readFile(sourcePath,'utf8');let mod;const noOp=()=>{};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useSyncExternalStore:(_s,get)=>get(),useState:v=>[typeof v==='function'?v():v,noOp],useRef:v=>({current:v}),useEffect:noOp,useCallback:fn=>fn};
 const timers=new Map();let timerId=0;
 const timerSet=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
 const timerClear=id=>timers.delete(id);
 const sandbox={console,AbortController,URL,Blob,Uint8Array,ArrayBuffer,DataView,queueMicrotask,performance,createImageBitmap:async()=>({width:2,height:2,close(){}}),requestAnimationFrame:fn=>{queueMicrotask(()=>fn(performance.now()));return 0;},cancelAnimationFrame:noOp,setInterval:timerSet,clearInterval:timerClear,navigator:{language:'zh-CN'},document:{hidden:false},addEventListener:noOp,removeEventListener:noOp,setTimeout:timerSet,clearTimeout:timerClear};
 sandbox.window=sandbox;sandbox.__ModuleLoader__={load:({factory})=>{mod=factory(n=>n==='react'?React:{});}};vm.runInNewContext(source,sandbox,{timeout:1000,filename:'actual-client.js'});
 const requests=[];let readCalls=0,lastRead=null,statusOverride=null;
 const payload={state:'ready',loaded:true,items:[{id:'lucy',title:'Lucy',type:'scene',available:true,playbackVerified:true,contentRating:'Everyone'}],rootWarnings:[]};
 if(items)payload.items=items;
 const response=()=>({ok:true,status:200,json:async()=>payload});
 const wallpaper=mod.createWallpaperEngine({fetchImpl:(url,options={})=>{
  if(engineFetchImpl){const handled=engineFetchImpl(url,options);if(handled!==undefined)return handled;}
  if(!['/whale-wallpaper/library/refresh','/whale-wallpaper/library?ensure=1','/whale-wallpaper/library'].includes(url))throw Error('Forbidden IO: '+url);
  const row={url,method:options.method||'GET',signal:options.signal};requests.push(row);
  if(fetchMode==='ready')return Promise.resolve(response());
  if(fetchMode==='reject')return Promise.reject(Error('fixture read failure'));
  return new Promise((resolve,reject)=>{row.resolve=()=>resolve(response());row.reject=reject;if(fetchMode==='pending-abort')options.signal?.addEventListener('abort',()=>reject(Error('fixture aborted')),{once:true});});
 }});
 const originalRead=wallpaper.readLibrary,originalStatus=wallpaper.getStatus;
 wallpaper.readLibrary=(...args)=>{readCalls++;if(syncThrow)throw Error('fixture sync throw');lastRead=originalRead(...args);return lastRead;};
 wallpaper.getStatus=()=>statusOverride||originalStatus();
 if(missingSnapshot)wallpaper.getLibrarySnapshot=undefined;
 const settings={weScene:sceneId,weAgeRatings:'Everyone',weMode:'daily',weAutoStart:false,background:'wallpaper',brightness:70,mask:40,blur:0,surface:82,...initialSettings,...(persistedStore?.value?JSON.parse(persistedStore.value):{})};const settingWrites=[];
 const controller={read:()=>settings,getSettingsSnapshot:()=>settings,subscribeSettings:()=>noOp,set:(key,value)=>{if(!allowSettingsWrite)throw Error('Settings write refused');settingWrites.push({key,value});settings[key]=value;if(persistedStore)persistedStore.value=JSON.stringify(settings);return{...settings};},wallpaper,presets:{subscribe:()=>noOp,getSnapshot:()=>({entries:{}}),resolveTarget:()=>({ok:false})}};
 if(missingWallpaper)controller.wallpaper=undefined;
 const disposers=[];const ctx={effect:fn=>{const off=fn();if(typeof off==='function')disposers.push(off);return off;}};
 const start=source.indexOf('      // Detachable Appearance Seam & Bridge State'),end=source.indexOf('      const initBridge =',start);if(start<0||end<start)throw Error('Production bootstrap boundary missing');
 const block=source.slice(start,end);
 const makeBridge=vm.runInNewContext('(function(controller,ctx,DETACHABLE_MODES){let disposed=false;'+block+'\nreturn {bridge:appearanceBridge,markDisposed(){disposed=true;},setMode(v){bridgeState.mode=v;notifyBridge();}};})',sandbox,{timeout:1000});
 const {bridge,markDisposed,setMode}=makeBridge(controller,ctx,mod.DETACHABLE_MODES);
 let tree=null;function controls(){const all=[];function visit(n){if(!n||typeof n!=='object')return;all.push(n);for(const c of n.children||[])visit(c);}visit(tree);return all;}
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 return{requests,timers,settingWrites,settings,engine:wallpaper,setMode,externalRead:opts=>wallpaper.readLibrary(opts),get readCalls(){return readCalls;},open(){mod.WhaleHeaderAppearanceTrigger({appearanceBridge:bridge}).props.onClick();},openPanel:()=>bridge.openPanel(),close:()=>bridge.closePanel(),render(){tree=mod.WhaleDockedAppearancePanel({appearanceBridge:bridge,controller});return tree;},controls,flush,observation(){return{isOpen:bridge.getSnapshot().isOpen,startDisabled:controls().find(n=>n.props.id==='whale-docked-btn-start')?.props.disabled??null,readCalls,requests:requests.map(r=>({url:r.url,method:r.method,aborted:Boolean(r.signal?.aborted)})),timerCount:timers.size,catalog:wallpaper.getLibrarySnapshot?.()??null};},setStatus:s=>{statusOverride=s;},fireTimers(){for(const [id,{fn}] of [...timers]){timers.delete(id);fn();}},resolve:i=>requests[i].resolve(),async dispose(){wallpaper.dispose();markDisposed();for(const off of disposers.reverse())off();await flush();}};
}
