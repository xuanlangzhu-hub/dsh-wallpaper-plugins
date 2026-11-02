import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createAuthorDiagnosticRecorder} from './recorder.mjs';
const baseline=process.env.AUTHOR_DIAG_BASELINE,patched=process.env.AUTHOR_DIAG_RUNTIME;
const before={
 controller:await import(pathToFileURL(process.env.AUTHOR_DIAG_BASELINE_CONTROLLER)),
 adapter:await import(pathToFileURL(baseline+'/src/wallpaper/author-properties-apply.js')),
 host:await import(pathToFileURL(baseline+'/src/wallpaper/author-properties-host.js')),
};
const after={controller:await import(pathToFileURL(process.env.AUTHOR_DIAG_CONTROLLER)),adapter:await import(pathToFileURL(patched+'/src/wallpaper/author-properties-apply.js')),host:await import(pathToFileURL(patched+'/src/wallpaper/author-properties-host.js'))};
const {validateAuthorValue}=await import(pathToFileURL(baseline+'/src/wallpaper/author-properties-contract.js'));
const id='we-'+'b'.repeat(24),flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const until=async(predicate)=>{const end=performance.now()+500;while(!predicate()){if(performance.now()>end)throw Error('fixture-phase-deadline');await new Promise(r=>setImmediate(r));}};
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
const secret='PRIVATE-AUTHOR-TEXT-PATH-TOKEN';
function target(){return{wallpaperId:id,generation:7,hwnd:42,pid:7,startUtc:'2026-10-29T00:00:00Z',helper:'F:\\'+secret+'\\WallpaperProbe.exe',location:'WhaleWallpaperProbe-offline-diag',captureStarted:true,stopping:false};}
function diagnostics(mode){
 if(mode==='off')return null;
 if(mode==='throw')return new Proxy({},{get(){throw Error('injected-recorder-fault');}});
 let tick=0;const r=createAuthorDiagnosticRecorder({clock:()=>++tick,sources:JSON.parse(process.env.AUTHOR_DIAG_SOURCES)});
 if(mode==='removed')return{begin:(...a)=>r.begin(...a),event(){delete this.event;delete this.finish;},finish:(...a)=>r.finish(...a)};
 return r;
}
async function retain(name,record){assert.equal(JSON.stringify(record).includes(secret),false);await writeFile(join(process.env.AUTHOR_DIAG_EVIDENCE_DIR,name+'.json'),JSON.stringify(record,null,2),{flag:'wx'});}
function childIo(t,exe){
 const commands=[],physical=[],pending=new Set();let mode='ok';
 return{commands,physical,setMode:m=>mode=m,release(){for(const job of [...pending])job.release();},runChild(file,args,{signal}){
  const isWindow=args[0]==='--window-inspect',isSend=file===exe;commands.push(isWindow?'window':isSend?'send':'process');
  if(isSend)physical.push(JSON.parse(args[3].slice(5,-5)));
  let resolveResult,resolveSettled,done=false;const result=new Promise(r=>resolveResult=r),settled=new Promise(r=>resolveSettled=r);
  const job={release(){if(!done){done=true;resolveResult({ok:false,exitConfirmed:true,reason:'cancelled'});}resolveSettled();pending.delete(job);signal?.removeEventListener('abort',abort);}};
  const abort=()=>job.release();pending.add(job);signal?.addEventListener('abort',abort,{once:true});
  const hold=mode==='budget-pre'&&commands.length===1||mode==='budget-post'&&isWindow&&physical.length>0;
  if(!hold){
   const stdout=isWindow?JSON.stringify({exists:true,hwnd:42,pid:7,title:mode==='identity-post'&&physical.length?t.location+'-changed':t.location,processName:'wallpaper64'}):isSend?'':JSON.stringify({pid:7,startUtc:t.startUtc,executable:exe});
   let reply={ok:true,exitConfirmed:true,stdout};
   if(mode==='timeout-pre'&&commands.length===1||mode==='timeout-send'&&isSend)reply={ok:false,exitConfirmed:true,reason:'timeout'};
   if(mode==='unknown-exit'&&isSend)reply={ok:false,exitConfirmed:false,reason:'timeout'};
   done=true;resolveResult(reply);if(reply.exitConfirmed)job.release();
  }
  if(signal?.aborted)abort();return{result,settled,cancel:abort};
 }};
}
async function adapterRun(mod,mode,scenario){
 const t=target(),io=childIo(t,mod.AUTHOR_WE_EXE),r=diagnostics(mode);io.setMode(scenario);
 const adapter=mod.createAuthorApplyAdapter({readTarget:()=>t,runChild:io.runChild,timeoutMs:50,diagnostics:r});
 const controller=new AbortController();if(scenario==='cancelled')controller.abort();
 let result;
 try{result=await adapter.apply({planOnly:true,executed:false,wallpaperId:id,generation:7,location:t.location,args:['-control','applyProperties','-properties','RAW~({"music":0.7})~END','-location',t.location]},
  {signal:controller.signal,check(){},validate:async()=>{if(scenario==='metadata-failed')throw Object.assign(Error('private metadata detail'),{authorReason:'author_context_changed'});}});
 }catch(e){result={ok:false,reason:e.authorReason,sentMayHaveOccurred:e.sentMayHaveOccurred===true};}
 const busyBefore=adapter.busy();let second;
 if(scenario==='unknown-exit'){try{await adapter.apply({});}catch(e){second=e.authorReason;}}
 io.release();await flush();await adapter.dispose();assert.equal(adapter.busy(),false);
 return{business:{result,commands:io.commands,physical:io.physical,busyBefore,second},record:r&&mode==='on'?JSON.parse(r.exportJson()):null};
}
for(const scenario of ['ok','timeout-pre','timeout-send','unknown-exit','identity-post','metadata-failed','budget-pre','budget-post','cancelled']){
 test('adapter IO/results and settled fence remain equivalent: '+scenario,async()=>{
  const old=await adapterRun(before.adapter,'off',scenario);
  for(const mode of ['off','on','throw','removed']){
   const next=await adapterRun(after.adapter,mode,scenario);assert.deepEqual(next.business,old.business);
   if(mode==='on'){
    const record=next.record.records.find(r=>r.kind==='adapter.apply');assert.ok(record);assert.equal(record.summary.ok,old.business.result.ok);
    assert.equal(next.record.records.some(r=>JSON.stringify(r).includes(secret)),false);
    if(scenario==='ok')assert.deepEqual(record.events.filter(e=>e.event==='command-end').map(e=>e.stage),['window-pre','process-pre','send','window-post','process-post']);
    if(scenario==='budget-pre'||scenario==='budget-post')assert.equal(record.summary.code,'author_apply_timeout');
    if(scenario==='unknown-exit'){assert.equal(record.summary.sentMayHaveOccurred,true);assert.ok(record.events.some(e=>e.event==='children-settled'&&e.exitConfirmed&&e.late));}
    await retain('adapter-'+scenario,next.record);
   }
  }
 });
}
async function chainRun(mod,mode,scenario){
 const r=diagnostics(mode),t=target(),io=childIo(t,mod.adapter.AUTHOR_WE_EXE),requests=[];
 const ctx={authorized:true,owner:'main:diagnostic',selectedId:id,revision:1,allowedRatings:['Everyone'],lifecycle:{generation:7,activeSceneId:id,location:t.location,cleanupPending:false,busy:false}};
 const adapter=mod.adapter.createAuthorApplyAdapter({readTarget:()=>t,runChild:io.runChild,diagnostics:r});
 const host=mod.host.createAuthorPropertiesHost({readContext:()=>ctx,root:'/api/author-properties',applyAdapter:adapter,diagnostics:r,library:{getAuthorMetadata:async()=>({wallpaperId:id,type:'scene',contentRating:'Everyone',properties:{music:{type:'slider',value:0.5,min:0,max:1,fraction:true,step:0.01,text:'Music'},caption:{type:'textinput',value:secret,text:'Caption'}}})}});
 let drop=false,rejectReply=false,hold=false;const held=[];
 const request=async(route,body)=>{
  const req=Object.assign(new EventEmitter(),{method:route==='schema'?'GET':'POST',url:'/api/author-properties/'+route+(route==='schema'?'?wallpaperId='+id:''),headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){if(route!=='schema')yield Buffer.from(JSON.stringify(body));}});
  const res=Object.assign(new EventEmitter(),{headersSent:false,writableEnded:false,setHeader(){},writeHead(code){this.code=code;this.headersSent=true;},end(raw){this.body=JSON.parse(raw);this.writableEnded=true;}});
  await host.handler(req,res);requests.push({route,action:body.action,status:res.code,ok:res.body.ok,error:res.body.error});
  if(route==='apply'&&hold){const gate=deferred();held.push(gate);await gate.promise;}
  if(route==='apply'&&drop){drop=false;return{ok:false,error:'offline-response-lost',sentMayHaveOccurred:true};}
  if(route==='apply'&&rejectReply){rejectReply=false;throw Error(secret);}
  return res.body;
 };
 const c=mod.controller.createNativeAuthorSwitches({request,validateValue:validateAuthorValue,diagnostics:r});c.setContext('run',id);c.view('view',true);
 try{
  assert.equal((await c.load()).ok,true);
  let result,recovered;
  if(scenario==='burst'){
   hold=true;const p=c.change('music',0.6);await flush();
   for(let i=0;i<4;i++){await until(()=>held.length===i+1);await c.change('music',[0.7,0.8,0.9,1][i]);held[i].resolve();await flush();}
   result=await p;hold=false;recovered=await c.retry({view:'view',discardOwnFailure:true});
  }else{
   if(scenario==='unknown')io.setMode('timeout-send');if(scenario==='lost-reply')drop=true;if(scenario==='transport-reject')rejectReply=true;
   result=await c.change('music',0.7);await flush();
   if(scenario!=='ok'){io.setMode('ok');recovered=await c.retry({view:'view',discardOwnFailure:true});}
  }
  const state=c.read();io.release();await flush();
  const business={result,recovered,phase:state.phase,canEdit:state.canEdit,values:state.values,marks:state.marks,recovery:state.recovery,requests,commands:io.commands,physical:io.physical,busy:adapter.busy()};
  return{business,record:r&&mode==='on'?JSON.parse(r.exportJson()):null};
 }finally{for(const g of held)g.resolve();c.dispose();io.release();await flush();await host.dispose();assert.equal(adapter.busy(),false);}
}
for(const scenario of ['ok','unknown','lost-reply','burst','transport-reject'])test('controller + real Host + real adapter business sequence is unchanged: '+scenario,async()=>{
 const old=await chainRun(before,'off',scenario);
 for(const mode of ['off','on','throw','removed']){
  const next=await chainRun(after,mode,scenario);assert.deepEqual(next.business,old.business);
  if(mode==='on'){
   const records=next.record.records;assert.ok(records.some(r=>r.kind==='controller.write'));assert.ok(records.some(r=>r.kind==='host.apply'));assert.ok(records.some(r=>r.kind==='adapter.apply'));
   assert.equal(JSON.stringify(next.record).includes(secret),false);
   for(const record of records.filter(r=>r.kind==='host.apply'&&r.summary.applyConfirmed))assert.equal(record.summary.sentMayHaveOccurred,true);
   for(const record of records.filter(r=>r.kind==='host.schema'))assert.equal(Object.hasOwn(record.summary,'sentMayHaveOccurred'),false);
   if(scenario==='unknown')assert.ok(records.some(r=>r.kind==='host.apply'&&r.summary.code==='author_apply_timeout'));
   if(scenario==='lost-reply'){assert.ok(records.some(r=>r.kind==='host.apply'&&r.summary.applyConfirmed));assert.ok(records.some(r=>r.kind==='controller.write'&&!r.summary.ok));assert.equal(next.business.requests.some(r=>r.action==='discard'),false);}
   if(scenario==='burst')assert.ok(records.some(r=>r.kind==='controller.write'&&r.summary.code==='burst-limit'&&r.summary.round===5&&r.summary.confirmedRounds===4&&r.summary.sentMayHaveOccurred&&r.droppedEvents>0&&r.incomplete));
   if(scenario==='transport-reject')assert.ok(records.some(r=>r.kind==='controller.write'&&r.summary.code==='transport-failed'));
   await retain('chain-'+scenario,next.record);
  }
 }
});
