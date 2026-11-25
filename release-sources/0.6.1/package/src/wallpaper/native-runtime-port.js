// Host-private authority and binary adapter; default-disabled, never queries on import.
import {readFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createSupervisedQueryLauncher} from './native-worker-launcher.js';
import {createDesktopQueryLifecycle} from './query-lifecycle.js';
import {consumeNativeQuery} from './native-query-decode.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export function createDesktopRuntimeAuthority({readContext=()=>null,image=null,now=()=>Date.now()}={}) {
 const fixed=image?structuredClone(image):null;
 if(fixed&&(!/^[a-z]:[\\/].*[\\/]wallpaper64\.exe$/i.test(fixed.path??'')||!/^\w{64}$/.test(fixed.sha256??'')||!/^[a-f0-9]{64}$/i.test(fixed.sha256)||
  !Number.isInteger(fixed.expected?.Pid)||fixed.expected.Pid<1||typeof fixed.expected.BirthUtcTicks!=='string'||!/^\d{1,19}$/.test(fixed.expected.BirthUtcTicks)||
  BigInt(fixed.expected.BirthUtcTicks)<1n||BigInt(fixed.expected.BirthUtcTicks)>9223372036854775807n||
  fixed.expected.ImagePath?.replaceAll('/','\\').toLowerCase()!==fixed.path.replaceAll('/','\\').toLowerCase()))throw Error('runtime-image-identity-invalid');
 const context=()=>{try{return readContext();}catch{return null;}};
 const capable=(c=context())=>!!(fixed&&c?.connected===true&&c.ready===true&&Number.isSafeInteger(c.ownerGeneration)&&c.ownerGeneration>0&&uuid(c.connectionId));
 const canQuery=(c=context())=>capable(c)&&c?.enabled===true&&c.wanted===true&&c.background==='wallpaper';
 return {capable,canQuery,
  issue(){const c=context();if(!canQuery(c))throw Error('runtime-authority-required');const time=now();
   return {Scope:'desktop-follow-runtime-worker-v1',OwnerGeneration:c.ownerGeneration,ConnectionId:c.connectionId,TicketId:randomUUID(),Enabled:true,Wanted:true,
    Created:new Date(time).toISOString(),Expires:new Date(time+15000).toISOString(),ImagePath:fixed.path,ImageSha256:fixed.sha256,ExpectedEngine:structuredClone(fixed.expected),Monitor:null};},
  current(grant){const c=context();return canQuery(c)&&c.ownerGeneration===grant.OwnerGeneration&&c.connectionId===grant.ConnectionId;},
 };
}
function buildPort({build,buildSha256,authority=null,fixture=null,encoding='auto',record=()=>{}}={}) {
 if(!build||!buildSha256||!authority&&!fixture)return {read:()=>({available:false,pending:false,uncertain:false}),query:async()=>{throw Error('native-runtime-not-configured');},dispose(){}};
 const raw=readFileSync(join(build,'manifest.json'));if(hash(raw)!==buildSha256)throw Error('runtime-build-manifest-drift');
 const manifest=JSON.parse(raw),pins=[];
 for(const [name,digest] of Object.entries(manifest.native)){
  if(basename(name)!==name)throw Error('runtime-build-member-invalid');const path=join(build,'native',name);
  if(hash(readFileSync(path))!==digest)throw Error('runtime-build-drift');pins.push({path,sha256:digest});
 }
 const executable=join(build,'native','DesktopRuntimeQuery.exe');if(!pins.some(pin=>pin.path===executable))throw Error('runtime-executable-missing');
 let latestGrant=null;
 const launch=createSupervisedQueryLauncher({worker:{executable,args:[fixture?'--fixture-worker':'--runtime-worker'],pins},timeoutMs:12000,cancelMs:2000,
  input:()=>{if(fixture)return fixture();latestGrant=authority.issue();return{grant:latestGrant};}});
 const lifecycle=createDesktopQueryLifecycle({launch:options=>{
  const handle=launch(options),grant=latestGrant;
  return {...handle,result:handle.result.then(raw=>{
   const envelope=raw?.nativeEnvelope;record({envelope,synthetic:fixture!==null});
   if(!fixture&&envelope?.syntheticRuntimeOnly===true)throw Error('synthetic-native-result-refused');
   if(options.signal?.aborted||!fixture&&!authority.current(grant))return {exited:true,timedOut:false,exitCode:2,signal:null,stdout:''};
   const consumed=consumeNativeQuery(envelope,encoding);
   if(consumed.status!=='resolved-path')return {exited:true,timedOut:false,exitCode:1,signal:null,stdout:''};
   return consumed.query;
  })};
 },closeMs:2000});
 return {read:()=>{const s=lifecycle.read();return {...s,available:s.available&&(fixture!==null||authority.capable())};},
  query(options){if(!fixture&&!authority.canQuery())return Promise.reject(Error('runtime-authority-required'));return lifecycle.query(options);},
  dispose:()=>lifecycle.dispose()};
}
export const createNativeRuntimePort=options=>buildPort(options);
// Explicitly named fixture factory; not referenced by the plugin index or any route.
export const createNativeRuntimeFixturePort=({mode='success',path=()=> 'Q:/fixture/scene.pkg',...options}={})=>
 buildPort({...options,fixture:()=>({fixture:mode,path:path()})});
