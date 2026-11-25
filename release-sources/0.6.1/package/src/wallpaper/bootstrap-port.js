// Connection/activation-bound discovery, followed by a separately scoped query.
import {readFileSync} from 'node:fs';
import {join,basename,win32} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createSupervisedQueryLauncher} from './native-worker-launcher.js';
import {createDesktopQueryLifecycle} from './query-lifecycle.js';
import {consumeConsoleEnvelope} from './runtime-console-decode.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const pathKey=x=>typeof x==='string'?x.replaceAll('/','\\').toLowerCase():null;
const failedQuery=(code=1)=>({exited:true,timedOut:false,exitCode:code,signal:null,stdout:''});
export function createBootstrapAuthority({readContext=()=>null,image=null,now=()=>Date.now()}={}) {
 const fixed=image?structuredClone(image):null;
 if(fixed&&(Object.keys(fixed).sort().join(',')!=='path,sha256'||!/^[a-z]:[\\/].*[\\/]wallpaper64\.exe$/i.test(fixed.path??'')||fixed.path.length>4096||!/^[a-f0-9]{64}$/i.test(fixed.sha256??'')))throw Error('bootstrap-image-invalid');
 if(fixed)fixed.path=win32.normalize(fixed.path);
 const snapshot=()=>{try{const c=readContext();return c?{...c}:null;}catch{return null;}};
 const capable=(c=snapshot())=>!!(fixed&&c?.connected===true&&c.ready===true&&Number.isSafeInteger(c.ownerGeneration)&&c.ownerGeneration>0&&uuid(c.connectionId)&&Number.isSafeInteger(c.activation)&&c.activation>0);
 const active=c=>capable(c)&&c.enabled===true&&c.wanted===true&&c.background==='wallpaper';
 const key=c=>c?`${c.ownerGeneration}:${c.connectionId}:${c.activation}`:null;
 const current=saved=>{const c=snapshot();return active(c)&&key(c)===key(saved);};
 function identity(value){return value&&Number.isInteger(value.Pid)&&value.Pid>0&&value.Pid<=2147483647&&typeof value.BirthUtcTicks==='string'&&/^[1-9]\d{0,18}$/.test(value.BirthUtcTicks)&&BigInt(value.BirthUtcTicks)<=9223372036854775807n&&pathKey(value.ImagePath)===pathKey(fixed?.path);}
 return {capable,current,key,
  capture(){const c=snapshot();if(!active(c))throw Error('bootstrap-authority-required');return c;},
  grant(kind,saved,expected=null){const c=snapshot();if(!active(c)||key(c)!==key(saved)||!['environment','query'].includes(kind)||
    (kind==='environment'?expected!==null:!identity(expected)))throw Error('bootstrap-authority-required');const time=now();
   return {Scope:'desktop-follow-runtime-console-v1',Kind:kind,Activation:c.activation,OwnerGeneration:c.ownerGeneration,ConnectionId:c.connectionId,TicketId:randomUUID(),Enabled:true,Wanted:true,
    Created:new Date(time).toISOString(),Expires:new Date(time+15000).toISOString(),ImagePath:fixed.path,ImageSha256:fixed.sha256,ExpectedEngine:expected?structuredClone(expected):null,Monitor:null};},
  accept(envelope){
   const valid=e=>e?.Complete===true&&e.Error===null&&Array.isArray(e.Engines)&&e.Engines.length===1&&identity(e.Engines[0]);
   if(envelope?.ready!==true||envelope.ownJobActive!==1||envelope.inBudget!==true||envelope.failure!==null||!valid(envelope.before)||!valid(envelope.after))return null;
   const a=envelope.before.Engines[0],b=envelope.after.Engines[0];
   return a.Pid===b.Pid&&a.BirthUtcTicks===b.BirthUtcTicks&&pathKey(a.ImagePath)===pathKey(b.ImagePath)?structuredClone(b):null;
  },
 };
}
function createPort({build,buildSha256,readContext,image,fixture=null,encoding='auto',record=()=>{}}={}) {
 if(!build||!buildSha256||!image||!readContext)return {read:()=>({available:false,pending:false,uncertain:false,phase:'unconfigured',baseline:false}),query:async()=>{throw Error('bootstrap-not-configured');},invalidate(){},dispose(){}};
 const authority=createBootstrapAuthority({readContext,image}),raw=readFileSync(join(build,'manifest.json'));
 if(hash(raw)!==buildSha256)throw Error('bootstrap-manifest-drift');const manifest=JSON.parse(raw),pins=[];
 if(manifest.environmentBootstrapSupported!==true||manifest.conptyRuntimeSupported!==true||manifest.runtimeScope!=='desktop-follow-runtime-console-v1')throw Error('bootstrap-build-unsupported');
 for(const [name,digest] of Object.entries(manifest.native)){if(!/^(?:fixture\/)?[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name)||name.includes('..'))throw Error('bootstrap-member-invalid');const path=join(build,'native',name);if(hash(readFileSync(path))!==digest)throw Error('bootstrap-build-drift');pins.push({path,sha256:digest});}
 const executable=join(build,'native','DesktopRuntimeQuery.exe');if(!pins.some(p=>p.path===executable))throw Error('bootstrap-executable-missing');
 let baseline=null,phase='idle',activeCancel=null,disposed=false;
 const invalidate=()=>{baseline=null;activeCancel?.();};
 const lifecycle=createDesktopQueryLifecycle({launch:({signal}={})=>{
  const context=authority.capture(),receipts=[];let currentHandle=null,cancelled=false,resolveClosed;
  const closed=new Promise(resolve=>resolveClosed=resolve);
  const cancel=()=>{cancelled=true;baseline=null;currentHandle?.cancel();};activeCancel=cancel;
  const valid=()=>!disposed&&!cancelled&&!signal?.aborted&&authority.current(context);
  async function run(kind,expected){
   if(!valid())return null;
   const grant=authority.grant(kind,context,expected),extra=fixture?fixture(kind):{};
   const launch=createSupervisedQueryLauncher({worker:{executable,args:[fixture?'--console-bootstrap-fixture-worker':'--runtime-console-worker'],pins},timeoutMs:12000,cancelMs:2000,input:()=>({...extra,grant})});
   const handle=launch({signal});currentHandle=handle;receipts.push(handle.closed);
   const value=await handle.result;record({phase:kind,value,synthetic:fixture!==null});return value;
  }
  const result=(async()=>{
   if(!baseline||authority.key(baseline.context)!==authority.key(context)){
    baseline=null;phase='reading-identity';const value=await run('environment',null);if(!valid()){phase='cancelled';return failedQuery(2);}
    const envelope=value?.bootstrapEnvelope;if(!fixture&&envelope?.syntheticRuntimeOnly===true)throw Error('synthetic-bootstrap-refused');
    const identity=authority.accept(envelope);if(!identity){phase='blocked';return failedQuery();}
    // No async gap between the current-scope check and publishing the fresh baseline.
    if(!valid()){phase='cancelled';return failedQuery(2);}baseline={context,identity};
   }
   if(!valid()){phase='cancelled';return failedQuery(2);}phase='querying';
   const value=await run('query',baseline.identity);if(!valid()){phase='cancelled';return failedQuery(2);}
   const envelope=value?.nativeEnvelope;if(!fixture&&envelope?.syntheticRuntimeOnly===true)throw Error('synthetic-query-refused');
   const consumed=consumeConsoleEnvelope(envelope);
   // A failed query cannot silently authorize a replacement engine in this activation.
   if(consumed.status!=='resolved-path'){phase='blocked';return failedQuery();}
   phase='ready';return consumed.query;
  })();
  const finish=()=>{
   if(activeCancel===cancel)activeCancel=null;
   // Consumer errors are bounded; physical close remains independent until observed.
   Promise.all(receipts).then(values=>resolveClosed({exited:values.every(v=>v.exited===true),queryChildCleanupConfirmed:values.every(v=>v.queryChildCleanupConfirmed===true),workers:values.length,neverStarted:values.length===0}));
  };
  result.then(finish,()=>{baseline=null;phase='blocked';finish();});return {result,closed,cancel};
 },closeMs:2000});
 return {read(){if(baseline&&!authority.current(baseline.context))baseline=null;const s=lifecycle.read();return {...s,available:!disposed&&s.available&&authority.capable(),phase,baseline:baseline!==null};},
  query(options){if(disposed)return Promise.reject(Error('bootstrap-disposed'));try{authority.capture();}catch(error){return Promise.reject(error);}return lifecycle.query(options);},
  invalidate,dispose(){disposed=true;invalidate();return lifecycle.dispose();}};
}
export const createBootstrapNativePort=options=>createPort(options);
// Test-only explicit factory. No connected production index selects this function.
export const createBootstrapFixturePort=({modes={},path=()=> 'Q:/fixture/scene.pkg',...options}={})=>
 createPort({...options,fixture:kind=>({fixture:typeof modes==='function'?modes(kind):modes[kind]??'success',path:path()})});
