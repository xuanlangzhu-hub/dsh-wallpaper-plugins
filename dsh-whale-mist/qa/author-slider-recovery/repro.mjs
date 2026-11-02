import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {createNativeAuthorSwitches}=await import(pathToFileURL(process.env.AUTHOR_SIDEBAR_SOURCE));
const {validateAuthorValue}=await import(pathToFileURL(process.env.AUTHOR_CONTRACT_SOURCE));
const {createAuthorApplyAdapter,AUTHOR_WE_EXE}=await import(pathToFileURL(process.env.AUTHOR_APPLY_SOURCE));
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
const id='we-'+ 'a'.repeat(24);
function rig(){
 let revision=0,values={music:0.5},dirty=[],delivery='none',mode='ok',holds=[],commands=[];
 const fields=[{key:'music',label:'Music',type:'slider',supported:true,min:0,max:1,step:0.01,fraction:true}];
 const response=()=>({ok:true,schema:{wallpaperId:id,schemaVersion:1,fingerprint:'b'.repeat(64),fields},draft:{revision,values:{...values},dirtyKeys:[...dirty],stale:false,delivery:{revision,state:delivery}},application:{available:true,targetActive:true,busy:false}});
 const timers={jobs:new Map(),next:0,setTimeout(fn,ms){this.jobs.set(++this.next,{fn,ms});return this.next;},clearTimeout(n){this.jobs.delete(n);}};
 const api=createNativeAuthorSwitches({validateValue:validateAuthorValue,timers,request:async(route,p)=>{
  if(route==='draft'&&p.action==='discard'){assert.equal(p.expectedRevision,revision);assert.deepEqual(p.discardKeys,dirty);revision++;dirty=[];delivery='none';return {...response(),discarded:true,mutation:'discard',currentValuesKnown:false};}
  if(route==='draft'){assert.equal(p.expectedRevision,revision);revision++;values={...values,...p.values};dirty=Object.keys(p.values);delivery='not-sent';}
  if(route==='apply'){
   if(mode==='hold'){const d=deferred();holds.push(d);await d.promise;}
   if(mode==='fail'){delivery='unknown';return{ok:false,error:'author_apply_timeout',sentMayHaveOccurred:true};}
   commands.push(Object.fromEntries(dirty.map(k=>[k,values[k]])));dirty=[];delivery='confirmed';return {...response(),applySent:true,currentValuesKnown:false};
  }
  return response();
 }});api.setContext('run',id);api.view('view',true);
 return {api,timers,holds,commands,mode:m=>mode=m,dirty:()=>dirty,gesture(value){const t=api.editStart('music','slider','view');assert.ok(t);api.editPreview(t,value);return api.editEnd(t);}};
}
const findings=[];
const f=rig();assert.equal((await f.api.load()).ok,true);
const t=f.api.editStart('music','slider','view');for(let i=0;i<120;i++)assert.equal(f.api.editPreview(t,(i%101)/100),true);
assert.equal((await f.api.editEnd(t)).ok,true);findings.push({case:'120 previews within one gesture',commands:f.commands.length,phase:f.api.read().phase});f.api.dispose();
const b=rig();await b.api.load();b.mode('hold');const pending=b.gesture(0.6);await flush();
for(let i=0;i<4;i++){assert.equal(b.holds.length,i+1);await b.gesture([0.7,0.8,0.9,1][i]);b.holds[i].resolve();await flush();}
assert.equal((await pending).ok,false);assert.equal(b.api.read().phase,'blocked');
findings.push({case:'fifth committed value queued across four delayed acknowledgements',commands:b.commands.length,phase:b.api.read().phase,message:b.api.read().message,remainingValue:b.api.read().values.music});b.api.dispose();
const c=rig();await c.api.load();c.mode('fail');assert.equal((await c.gesture(0.7)).ok,false);await flush();assert.equal((await c.api.load()).ok,true);
assert.equal(c.api.read().canEdit,false);assert.equal(c.api.read().recovery.own,true);assert.equal(c.api.read().recovery.unknown,true);
findings.push({case:'reread after own uncertain failure',canEdit:c.api.read().canEdit,own:c.api.read().recovery.own,unknown:c.api.read().recovery.unknown,plainDiscard:(await c.api.discard()).error});
assert.equal((await c.api.discard({confirm:true,observed:true,expected:c.api.read().recovery})).ok,true);assert.equal(c.api.read().canEdit,true);
assert.equal((await c.gesture(0.8)).ok,false);findings.push({case:'underlying failure left active after local recovery',phase:c.api.read().phase,remoteCommands:c.commands.length});
await c.api.load();await c.api.discard({confirm:true,observed:true,expected:c.api.read().recovery});c.mode('ok');assert.equal((await c.gesture(0.9)).ok,true);c.api.dispose();
// Scaled deadline reproduces the real adapter's pre-verify / send / post-verify sequence.
const target={wallpaperId:id,generation:1,hwnd:42,pid:7,startUtc:'2026-10-29T00:00:00Z',helper:'F:\\offline\\WallpaperProbe.exe',location:'WhaleWallpaperProbe-offline-slider',captureStarted:true,stopping:false};
async function adapterCase(delay){
 const commands=[];
 const adapter=createAuthorApplyAdapter({readTarget:()=>target,timeoutMs:200,runChild:(file,args,{signal})=>{
  let finish;const result=new Promise(r=>finish=r);let done=false;
  const complete=value=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);finish(value);};
  const abort=()=>complete({ok:false,exitConfirmed:true,reason:'cancelled'});
  commands.push(args[0]);const timer=setTimeout(()=>complete({ok:true,exitConfirmed:true,stdout:args[0]==='--window-inspect'?JSON.stringify({exists:true,hwnd:42,pid:7,title:target.location,processName:'wallpaper64'}):file===AUTHOR_WE_EXE?'':JSON.stringify({pid:7,startUtc:target.startUtc,executable:AUTHOR_WE_EXE})}),delay);
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  return{result,settled:result.then(()=>{}),cancel:abort};
 }});
 let outcome;try{outcome=await adapter.apply({planOnly:true,executed:false,wallpaperId:id,generation:1,location:target.location,args:['-control','applyProperties','-properties','RAW~({"music":0.7})~END','-location',target.location]},{check(){},validate:async()=>{}});}catch(e){outcome={ok:false,reason:e.authorReason,sentMayHaveOccurred:e.sentMayHaveOccurred===true};}
 await flush();await adapter.dispose();return{commands,outcome};
}
const quick=await adapterCase(5),slow=await adapterCase(65);assert.equal(quick.outcome.ok,true);assert.equal(quick.commands.length,5);assert.equal(slow.outcome.ok,false);assert.equal(slow.outcome.sentMayHaveOccurred,true);
findings.push({case:'scaled total budget200ms, all IO substituted',quick,slow});
const result={findings,realWindowsProcessesOrCom:false,hoursLongUserIncidentReproduced:false,rootCauseConfirmed:false,limits:'Controller and actual adapter flow reproduced with bottom-level transport/child IO substitutes. The latency is injected; no real After You source or current session was queried.'};
await writeFile('repro-results.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
