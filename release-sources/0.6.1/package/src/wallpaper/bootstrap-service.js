import {randomUUID} from 'node:crypto';
import {createDesktopFollowRuntimeService} from './runtime-service.js';
import {createBootstrapNativePort} from './bootstrap-port.js';
// Host-private composition. Native config defaults to null and is never a route field.
export function createBootstrapBoundService({library,wallpaper,nativeConfig=null,readSettings=()=>null,createPort=createBootstrapNativePort,limits={}}={}) {
 let owner=null,registration=null,activation=1,runtime=null;
 const port=createPort({...nativeConfig,readContext:()=>{
  const intent=runtime?.readIntent()??{},settings=readSettings();
  return registration?{...registration,activation,enabled:intent.enabled===true,wanted:intent.wanted===true,background:settings?.background}:null;
 }});
 runtime=createDesktopFollowRuntimeService({library,wallpaper,queryPort:port,limits});
 const retire=()=>{activation++;port.invalidate();};
 return {
  read(){const raw=runtime.read();return {...raw,state:{...raw.state,bootstrap:port.read().phase,baseline:port.read().baseline===true}};},
  readIntent:()=>runtime.readIntent(),
  claim(id){if(owner!==id){retire();owner=id;registration={ownerGeneration:id,connectionId:randomUUID(),connected:true,ready:false};}return runtime.claim(id);},
  setReady(id,ready){if(id!==owner||!registration)return;if(registration.ready!==ready){retire();registration={...registration,ready:ready===true};}},
  release(id){if(id!==owner)return Promise.resolve();retire();registration=null;owner=null;return runtime.release(id);},
  request(id,sequence,action,patch){
   const before=runtime.readIntent();
   if(id===owner&&(action==='stop'||action==='startup'&&!before.wanted||action==='configure'&&(patch?.enabled===false||patch?.wanted===false||patch?.enabled===true&&!before.enabled||patch?.wanted===true&&(!before.wanted||["suspended","blocked"].includes(before.phase)))))retire();
   return runtime.request(id,sequence,action,patch);
  },
  verifyForPlayback:(...args)=>runtime.verifyForPlayback(...args),
  async dispose(){retire();registration=null;owner=null;return runtime.dispose();},
 };
}
