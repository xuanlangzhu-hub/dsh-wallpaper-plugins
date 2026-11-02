import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {createNativeAuthorSwitches}=await import(pathToFileURL(process.env.AUTHOR_SIDEBAR_SOURCE));
const {validateAuthorValue}=await import(pathToFileURL(process.env.AUTHOR_CONTRACT_SOURCE));
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function fixture(){
 let revision=0,dirty=[],delivery='none',busy=false,mode='ok',values={music:0.5},hook=null;
 const calls=[],commands=[],jobs=new Map();let serial=0;
 const timers={setTimeout(fn,ms){jobs.set(++serial,{fn,ms});return serial;},clearTimeout(n){jobs.delete(n);}};
 const response=()=>({ok:true,application:{available:true,busy,targetActive:!busy},schema:{wallpaperId:'lucy',schemaVersion:1,fingerprint:'a'.repeat(64),fields:[{key:'music',type:'slider',label:'Music',supported:true,min:0,max:1,step:0.01,fraction:true}]},draft:{revision,values:{...values},dirtyKeys:[...dirty],stale:false,delivery:{revision,state:delivery}}});
 const api=createNativeAuthorSwitches({validateValue:validateAuthorValue,timers,request:async(route,p)=>{
  calls.push({route,p});if(hook){const result=await hook(route,p);if(result)return result;}
  if(route==='draft'&&p.action==='discard'){assert.equal(p.expectedRevision,revision);assert.deepEqual(p.discardKeys,dirty);assert.equal(p.acknowledgeUnknown,delivery!=='not-sent');revision++;dirty=[];delivery='none';return{...response(),discarded:true,mutation:'discard',currentValuesKnown:false};}
  if(route==='draft'){assert.equal(p.expectedRevision,revision);revision++;values={...values,...p.values};dirty=Object.keys(p.values);delivery='not-sent';}
  if(route==='apply'){if(mode!=='ok'){delivery=mode==='timeout'?'unknown':'not-sent';return{ok:false,error:mode==='timeout'?'author_apply_timeout':'author_target_unverified',sentMayHaveOccurred:mode==='timeout'};}commands.push({...values});dirty=[];delivery='confirmed';return{...response(),applySent:true,currentValuesKnown:false};}
  return response();
 }});api.setContext('run');api.view('view',true);
 return{api,calls,commands,response,mode:m=>mode=m,hook:fn=>hook=fn,seed(d='unknown'){revision++;dirty=['music'];delivery=d;},busy:b=>busy=b,
  retry:()=>typeof api.retry==='function'?api.retry({view:'view',discardOwnFailure:true}):api.load(),dispose(){api.dispose();assert.equal(jobs.size,0);}};
}
async function run(work){const f=fixture();try{await f.api.load();await work(f);}finally{f.dispose();}}
for(const mode of ['timeout','not-sent'])test('one refresh restores own '+mode+' failure without resending',()=>run(async f=>{
 f.mode(mode);assert.equal((await f.api.change('music',0.7)).ok,false);await flush();
 assert.equal((await f.retry()).ok,true);assert.equal(f.api.read().canEdit,true);assert.equal(f.api.read().recovery,null);
 assert.equal(f.api.read().values.music,0.7);assert.equal(f.commands.length,0);
 assert.equal(f.calls.filter(c=>c.route==='apply').length,1);assert.equal(f.calls.filter(c=>c.p.action==='discard').length,1);
 f.mode('ok');assert.equal((await f.api.change('music',0.8)).ok,true);assert.deepEqual(f.commands,[{music:0.8}]);
}));
test('normal refresh does not introduce a local clear or apply',()=>run(async f=>{
 const before=f.calls.length;assert.equal((await f.retry()).ok,true);assert.deepEqual(f.calls.slice(before).map(c=>c.route),['schema']);
}));
test('foreign uncertain draft retains explicit manual recovery',()=>run(async f=>{
 f.seed();await f.retry();assert.equal(f.api.read().recovery.own,false);assert.equal(f.api.read().canEdit,false);assert.equal(f.calls.filter(c=>c.p.action==='discard').length,0);
}));
test('unknown source never inherits ownership from an older own request',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();f.seed();await f.retry();assert.equal(f.api.read().recovery.own,false);assert.equal(f.calls.filter(c=>c.p.action==='discard').length,0);
}));
test('pending worker cannot be cleared by one refresh',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();f.busy(true);await f.retry();assert.equal(f.api.read().recovery.pending,true);assert.equal(f.calls.filter(c=>c.p.action==='discard').length,0);
}));
test('revision conflict cannot turn a newer record into cleared state',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();f.hook((route,p)=>p.action==='discard'?{ok:false,error:'author_revision_conflict'}:null);
 await f.retry();assert.equal(f.api.read().canEdit,false);assert.ok(f.api.read().recovery);assert.equal(f.commands.length,0);
}));
test('hidden initiating view cannot start recovery reads',()=>run(async f=>{
 f.api.view('view',false);const count=f.calls.length;assert.equal((await f.retry()).ok,false);assert.equal(f.calls.length,count);
}));
test('late read cannot clear another playback generation',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();let resolve;const hold=new Promise(r=>resolve=r);
 f.hook(async route=>{if(route==='schema'){await hold;return f.response();}});
 const pending=f.retry();await flush();f.api.setContext('other-run');resolve();await pending;await flush();assert.equal(f.calls.filter(c=>c.p.action==='discard').length,0);assert.equal(f.api.read().phase,'idle');
}));
test('same-context refresh preserves Host discard confirmation gates',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();await f.api.load();assert.equal((await f.api.discard()).ok,false);assert.equal(f.api.read().canEdit,false);
}));
test('read-only refresh without explicit discard intent cannot clear own unknown delivery',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();
 if(typeof f.api.retry==='function')await f.api.retry({view:'view'});else await f.api.load();
 assert.ok(f.api.read().recovery);assert.equal(f.api.read().canEdit,false);assert.equal(f.calls.filter(c=>c.p.action==='discard').length,0);
}));
test('a persistent underlying error still fails rather than pretending success',()=>run(async f=>{
 f.mode('timeout');await f.api.change('music',0.7);await flush();await f.retry();assert.equal(f.api.read().canEdit,true);
 assert.equal((await f.api.change('music',0.8)).ok,false);assert.equal(f.api.read().phase,'blocked');assert.equal(f.commands.length,0);
}));
