import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createNativeAuthorSwitches} from './generated-controller.mjs';
const basePath=process.env.AUTHOR_INTEGRATION_RUNTIME;
const {createDetachableHttpHost}=await import(pathToFileURL(basePath+'/src/detachable-host.js'));
const {createAuthorApplyAdapter,AUTHOR_WE_EXE}=await import(pathToFileURL(basePath+'/src/wallpaper/author-properties-apply.js'));
const {validateAuthorValue}=await import(pathToFileURL(basePath+'/src/wallpaper/author-properties-contract.js'));
const id='we-'+'a'.repeat(24);
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
function call(base,path,{body,headers={}}={}){
 return new Promise((resolve,reject)=>{const req=http.request(base+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...headers},timeout:1500},res=>{
  let raw='';res.on('data',chunk=>{raw+=chunk;if(raw.length>131072)req.destroy(Error('output-limit'));});
  res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(raw)});}catch(e){reject(e);}});res.on('error',reject);
 });req.on('timeout',()=>req.destroy(Error('request-timeout')));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
}
async function fixture(t){
 const requests=[],commands=[],physical=[],children=new Set(),controllers=[];
 let mode='ok',metadataVersion=0,heldSchema=null,discardRace=null,metadataHook=null,dropApplyReply=false;
 const lifecycle={generation:7,activeSceneId:id,location:'WhaleWallpaperProbe-offline-slider-route',cleanupPending:false,busy:false};
 const target={wallpaperId:id,generation:7,hwnd:42,pid:7,startUtc:'2026-10-29T00:00:00Z',helper:'F:\\offline\\WallpaperProbe.exe',location:lifecycle.location,captureStarted:true,stopping:false};
 // Real ApplyAdapter, with only child IO replaced. No executable or window is launched.
 const adapter=createAuthorApplyAdapter({readTarget:()=>target,runChild:(file,args)=>{
  const stage=args[0]==='--window-inspect'?'window':file===AUTHOR_WE_EXE?'send':'process';
  commands.push(stage);let resolveResult,resolveSettled;
  const result=new Promise(r=>resolveResult=r),settled=new Promise(r=>resolveSettled=r);
  const child={release(){resolveSettled();children.delete(child);}};children.add(child);
  const text=stage==='window'?JSON.stringify({exists:true,hwnd:42,pid:7,title:target.location,processName:'wallpaper64'}):stage==='process'?JSON.stringify({pid:7,startUtc:target.startUtc,executable:AUTHOR_WE_EXE}):'';
  let response={ok:true,exitConfirmed:true,stdout:text};
  if(stage==='send'){
   physical.push(JSON.parse(args[3].slice(5,-5)));
   if(mode==='timeout')response={ok:false,exitConfirmed:true,reason:'timeout'};
   if(mode==='exit-unknown')response={ok:false,exitConfirmed:false,reason:'timeout'};
  }
  resolveResult(response);if(mode!=='exit-unknown'||stage!=='send')child.release();
  return{result,settled,cancel:()=>child.release()};
 }});
 const library={getAuthorMetadata:async()=>{if(metadataHook){const hook=metadataHook;metadataHook=null;await hook();}return{wallpaperId:id,type:'scene',contentRating:'Everyone',properties:metadataVersion?{amount:{type:'slider',value:1,min:0,max:5,text:'Amount'}}:{music:{type:'slider',value:0.5,min:0,max:1,step:0.01,fraction:true,text:'Music'},fdr:{type:'bool',value:true,text:'FDR'}}};}};
 const host=createDetachableHttpHost({library,authorApplyAdapter:adapter,readWallpaperLifecycle:()=>({...lifecycle}),mainToken:'offline-slider-main'});
 await host.start();const base=host.getBaseUrl();
 const snapshot={revision:1,settings:{weScene:id,weAgeRatings:'Everyone'},catalog:{items:[]},wallpaper:{state:'playing'}};
 const connected=await call(base,'/api/main/connect',{body:{mainToken:'offline-slider-main',instanceId:'slider-main',snapshot}});
 assert.equal(connected.data.ok,true);
 const headers={'x-whale-main-token':'offline-slider-main','x-whale-instance-id':'slider-main','x-whale-generation':String(connected.data.generation)};
 const raw=async(route,p={},credentials=headers)=>call(base,'/api/author-properties/'+route+(route==='schema'?'?wallpaperId='+id:''),{headers:credentials,...(route==='schema'?{}:{body:p})});
 const request=async(route,p)=>{
  if(route==='schema'&&heldSchema){const gate=heldSchema;heldSchema=null;gate.entered.resolve();await gate.release.promise;}
  if(route==='draft'&&p.action==='discard'&&discardRace){const race=discardRace;discardRace=null;await race();}
  const result=await raw(route,p);requests.push({route,body:p,result:result.data,status:result.status});
  if(route==='apply'&&dropApplyReply){dropApplyReply=false;return{ok:false,error:'offline_response_lost',sentMayHaveOccurred:true};}
  return result.data;
 };
 const make=()=>{const c=createNativeAuthorSwitches({request,validateValue:validateAuthorValue});c.setContext('offline-run',id);c.view('view',true);controllers.push(c);return c;};
 const controller=make();assert.equal((await controller.load()).ok,true);assert.equal(controller.read().fields.some(f=>f.key==='music'),true);
 t.after(async()=>{
  controllers.forEach(c=>c.dispose());for(const c of [...children])c.release();await adapter.dispose();
  const stop=host.stop();let timer;try{await Promise.race([stop,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('host-stop-deadline')),1000);})]);}finally{clearTimeout(timer);}
  assert.equal(adapter.busy(),false);assert.equal(children.size,0);
 });
 return{controller,make,requests,commands,physical,raw,headers,lifecycle,target,mode:v=>mode=v,metadata:v=>metadataVersion=v,
  release(){for(const c of [...children])c.release();},holdSchema(){heldSchema={entered:deferred(),release:deferred()};return heldSchema;},raceDiscard(fn){discardRace=fn;},onMetadata(fn){metadataHook=fn;},dropReply(){dropApplyReply=true;},
  retry:()=>controller.retry({view:'view',discardOwnFailure:true})};
}
async function failure(f,mode='timeout'){f.mode(mode);assert.equal((await f.controller.change('music',0.7)).ok,false);}
test('generated controller through authenticated gateway and real adapter clears own unknown without replay',async t=>{
 const f=await fixture(t);await failure(f);assert.equal(f.physical.length,1);assert.equal(f.controller.read().phase,'blocked');
 assert.match(f.controller.read().message,/下发超时/);assert.equal((await f.retry()).ok,true);assert.equal(f.controller.read().canEdit,true);
 assert.equal(f.physical.length,1);const cleared=f.requests.find(r=>r.body.action==='discard');assert.equal(cleared.result.discarded,true);assert.equal(cleared.body.acknowledgeUnknown,true);
 assert.equal(cleared.result.currentValuesKnown,false);assert.equal(cleared.result.draft.values.music,0.7);assert.equal(cleared.result.draft.delivery.state,'none');
 f.mode('ok');assert.equal((await f.controller.change('music',0.8)).ok,true);assert.equal(f.physical.length,2);
});
test('unknown child exit keeps real adapter busy and cannot clear until settled',async t=>{
 const f=await fixture(t);await failure(f,'exit-unknown');assert.equal((await f.retry()).ok,false);assert.equal(f.controller.read().recovery.pending,true);
 assert.equal(f.requests.filter(r=>r.body.action==='discard').length,0);f.release();await Promise.resolve();await Promise.resolve();
 assert.equal((await f.retry()).ok,true);assert.equal(f.physical.length,1);
});
test('another controller cannot inherit the first controllers failed delta',async t=>{
 const f=await fixture(t);await failure(f);const other=f.make();await other.load();assert.equal(other.read().recovery.own,false);
 assert.equal((await other.retry({view:'view',discardOwnFailure:true})).ok,false);assert.equal(f.requests.filter(r=>r.body.action==='discard').length,0);
});
test('concurrent draft writer invalidates clear ticket at real Host revision gate',async t=>{
 const f=await fixture(t);await failure(f);f.raceDiscard(async()=>{
  const s=(await f.raw('schema')).data;assert.equal((await f.raw('draft',{wallpaperId:id,schemaFingerprint:s.schema.fingerprint,expectedRevision:s.draft.revision,values:{fdr:false}})).data.ok,true);
 });
 assert.equal((await f.retry()).ok,false);assert.equal(f.controller.read().canEdit,false);
 assert.ok(f.requests.some(r=>r.body.action==='discard'&&r.result.error==='author_revision_conflict'));assert.equal(f.physical.length,1);
});
test('schema drift keeps explicit stale recovery instead of shortcut discard',async t=>{
 const f=await fixture(t);await failure(f);f.metadata(1);assert.equal((await f.retry()).ok,false);assert.equal(f.controller.read().recovery.stale,true);
 assert.equal(f.requests.filter(r=>r.body.action==='discard').length,0);assert.equal(f.physical.length,1);
});
test('explicit stale confirmation refreshes generated controller with clean defaults and no resend',async t=>{
 const f=await fixture(t);await failure(f);f.metadata(1);await f.controller.load();const old=f.controller.read().recovery;
 assert.equal(old.stale,true);assert.equal((await f.controller.discard({confirm:true,observed:true,expected:old,view:'view'})).ok,true);
 assert.equal(f.controller.read().recovery,null);assert.equal(f.controller.read().values.amount,1);assert.equal(f.controller.read().canEdit,true);
 assert.equal(f.physical.length,1);const s=(await f.raw('schema')).data;assert.equal(s.draft.dirtyKeys.length,0);assert.equal(s.currentValuesKnown,undefined);
});
test('playback generation drift during Host metadata IO rejects the clear request',async t=>{
 const f=await fixture(t);await failure(f);f.raceDiscard(async()=>{f.onMetadata(()=>{f.lifecycle.generation++;});});
 assert.equal((await f.retry()).ok,false);assert.equal(f.physical.length,1);
 assert.ok(f.requests.some(r=>r.body.action==='discard'&&r.result.ok===false));
});
test('pre-request generation drift can clear same-owner local intent but never replays a command',async t=>{
 // Existing Host records are keyed by owner+wallpaper, not by playback generation.
 // Its per-request context proof is not an across-request generation CAS.
 const f=await fixture(t);await failure(f);f.raceDiscard(async()=>{f.lifecycle.generation++;});
 assert.equal((await f.retry()).ok,true);assert.equal(f.physical.length,1);
 const clear=f.requests.find(r=>r.body.action==='discard');assert.equal(clear.result.currentValuesKnown,false);
 assert.equal(clear.result.application.targetActive,false);assert.equal(clear.result.draft.dirtyKeys.length,0);
 // Editing the local record is not authority to apply against a mismatched instance.
 f.mode('ok');assert.equal((await f.controller.change('music',0.8)).ok,false);assert.equal(f.physical.length,1);
});
test('lost apply acknowledgement after confirmed Host send recovers by schema read alone',async t=>{
 const f=await fixture(t);f.dropReply();assert.equal((await f.controller.change('music',0.7)).ok,false);
 assert.equal(f.physical.length,1);assert.equal((await f.raw('schema')).data.draft.delivery.state,'confirmed');
 assert.equal((await f.retry()).ok,true);assert.equal(f.controller.read().recovery,null);assert.equal(f.controller.read().canEdit,true);
 assert.equal(f.requests.filter(r=>r.body.action==='discard').length,0);assert.equal(f.physical.length,1);
});
test('late schema refresh after local playback context change does not discard',async t=>{
 const f=await fixture(t);await failure(f);const gate=f.holdSchema(),retry=f.retry();await gate.entered.promise;
 f.controller.setContext('new-playback',id);gate.release.resolve();assert.equal((await retry).ok,false);
 assert.equal(f.requests.filter(r=>r.body.action==='discard').length,0);assert.equal(f.physical.length,1);
});
test('missing or forged credentials cannot read or mutate local author records',async t=>{
 const f=await fixture(t);await failure(f);const before=f.physical.length;
 for(const credentials of [{},{...f.headers,'x-whale-generation':'01'},{...f.headers,'x-whale-instance-id':'other'}]){
  assert.equal((await f.raw('schema',{},credentials)).data.ok,false);assert.equal((await f.raw('draft',{action:'discard'},credentials)).data.ok,false);
 }
 assert.equal(f.physical.length,before);assert.equal((await f.raw('schema')).data.draft.delivery.state,'unknown');
});
