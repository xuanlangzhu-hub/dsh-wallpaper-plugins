import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createCloseFence,readCloseFenceBody} from '../../src/wallpaper/close-fence.js';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {registerWallpaperRoutes} from '../../src/wallpaper/session.js';
import {createProfile,removeProfile} from '../temp-profile.mjs';

const ticks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const bounded=async(p,label,ms=1200)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),ms);})]);}finally{clearTimeout(timer);}};
async function rig(){
 const logRoot=await createProfile('wm-close-state-'),routes=new Map(),disposers=[],sessions=[],gates=[],jobs=[];let existsCalls=0,next={};
 const api=registerWallpaperRoutes({effect(fn){const off=fn();disposers.push(off);return off;},webServer:{register(route){routes.set(route.path,route);return()=>routes.delete(route.path);}}},{helper:'X:/offline/helper.exe',logRoot,exists:()=>{existsCalls++;return true;},onWarn(){},sessionFactory(){
  const options=next;next={};let cleanup=null,closed=false;
  const session={calls:[],hub:{latest:null,closed:false},async create(){session.calls.push('create');if(options.createGate)await options.createGate.promise;if(options.createError)throw Error('private create error');},async stop(){session.calls.push('stop');const gate=options.stopGates?.shift()??options.stopGate;if(gate)await gate.promise;cleanup=options.closeResult??{closed:true,outcome:'closed'};closed=cleanup?.closed===true;return cleanup;},state(){if(options.stateError)throw Error('private state details');return{cleanup};},isClosed:()=>closed,report:()=>({}),setClientStatus(){},change(value,{isClosed=value?.closed===true}={}){cleanup=value;closed=isClosed;},options};sessions.push(session);return session;
 }});
 const route=routes.get('/whale-wallpaper');
 async function call(action,{method='POST',body,gate,headers={}}={}){
  const req={method,headers,url:'/whale-wallpaper/'+action,async *[Symbol.asyncIterator](){if(gate)await gate.promise;if(body!==undefined)yield Buffer.from(JSON.stringify(body));}};
  const res={code:null,raw:null,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code,headers){this.code=code;Object.assign(this.headers,headers);},end(raw){this.raw=raw;}};
  const task=route.handler(req,res).then(()=>({code:res.code,payload:res.raw?JSON.parse(res.raw):null,headers:res.headers}));jobs.push(task);return bounded(task,action);
 }
 const read=()=>api.readCloseState();
 return{api,route,routes,sessions,read,call,get existsCalls(){return existsCalls;},next:options=>{next=options;},gate(){let release;const promise=new Promise(resolve=>{release=resolve;});const gate={promise,release};gates.push(gate);return gate;},start:()=>call('start',{body:{scene:'lucy',mode:'daily'}}),stop:()=>call('stop'),async dispose(){for(const off of [...disposers].reverse())if(typeof off==='function')await bounded(Promise.resolve(off()),'dispose');},async cleanup(){for(const gate of gates)gate.release();for(const s of sessions){s.options.stateError=false;s.options.closeResult={closed:true,outcome:'closed'};s.change({closed:true});}await bounded(Promise.allSettled(jobs),'pending requests');for(const off of [...disposers].reverse())if(typeof off==='function')await bounded(Promise.resolve(off()),'cleanup');await removeProfile(logRoot);}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};

const prepareBody=f=>{const s=f.read();return{hostInstanceId:s.hostInstanceId,revision:s.revision,requestId:randomUUID()};};
const prepare=async f=>{const r=await f.call('close-fence/prepare',{body:prepareBody(f)});assert.equal(r.code,200);await ticks();return r.payload.snapshot;};
const ticket=s=>({hostInstanceId:s.hostInstanceId,fenceId:s.fenceId});
const inspect=async(f,s)=>{const r=await f.call('close-fence/inspect',{body:ticket(s)});assert.equal(r.code,200);return r.payload.snapshot;};
const activate=async(f,s)=>f.call('close-fence/activate',{body:{...ticket(s),revision:s.close.revision}});

test('legacy start and restart remain usable before any explicit fence',check(async f=>{
 assert.equal((await f.start()).code,200);assert.equal((await f.call('restart',{body:{scene:'lucy'}})).code,200);assert.equal(f.sessions.length,2);
}));
test('fresh absence is sealed with one stop and no session creation',check(async f=>{
 const s=await prepare(f),v=await inspect(f,s);assert.equal(v.state,'ready');assert.equal(v.canCommit,false);assert.equal(v.close.scope,'arrived-operations');assert.equal(v.close.canCommit,false);assert.equal(v.close.quiescent,true);assert.equal(f.api.generation(),1);assert.equal(f.sessions.length,0);
}));
test('same prepare body replays the ticket instead of stopping twice',check(async f=>{
 await f.start();const body=prepareBody(f);const a=await f.call('close-fence/prepare',{body});await ticks();const b=await f.call('close-fence/prepare',{body});assert.equal(a.payload.snapshot.fenceId,b.payload.snapshot.fenceId);assert.equal(f.api.generation(),1);assert.deepEqual(f.sessions[0].calls,['create','stop']);
}));
test('same request id with different revision is not idempotent',check(async f=>{
 const body=prepareBody(f);await f.call('close-fence/prepare',{body});const r=await f.call('close-fence/prepare',{body:{...body,revision:body.revision+1}});assert.equal(r.code,409);assert.equal(f.api.generation(),1);
}));
test('wrong Host identity and stale revision have zero stop effects',check(async f=>{
 const body=prepareBody(f);assert.equal((await f.call('close-fence/prepare',{body:{...body,hostInstanceId:randomUUID()}})).code,409);await f.start();assert.equal((await f.call('close-fence/prepare',{body})).code,409);assert.deepEqual(f.sessions[0].calls,['create']);assert.equal(f.api.generation(),0);
}));
test('malformed and extra request fields cannot prepare a fence',check(async f=>{
 for(const body of [null,[],{}, {...prepareBody(f),revision:-1},{...prepareBody(f),revision:1.5},{...prepareBody(f),requestId:'bad'},{...prepareBody(f),allowLegacy:true}])assert.equal((await f.call('close-fence/prepare',{body})).code,409);assert.equal(f.api.generation(),0);assert.equal((await f.start()).code,200);
}));
test('unknown action and GET never invoke lifecycle work',check(async f=>{
 assert.equal((await f.call('close-fence/nope')).code,404);assert.equal((await f.call('close-fence/prepare',{method:'GET'})).code,404);assert.equal(f.api.generation(),0);
}));
test('prepare does not wait for a blocked native close and never reports it ready',check(async f=>{
 await f.start();const g=f.gate();f.sessions[0].options.stopGate=g;const s=await prepare(f);assert.equal((await inspect(f,s)).state,'pending');assert.equal((await activate(f,await inspect(f,s))).code,409);assert.equal(f.api.generation(),1);g.release();await ticks();assert.equal((await inspect(f,s)).state,'ready');
}));
test('all late legacy starts and restarts are refused before body or file IO',check(async f=>{
 const s=await prepare(f),before=f.existsCalls;const g=f.gate();for(const action of ['start','restart']){const r=await f.call(action,{body:{scene:'lucy'},gate:g});assert.equal(r.code,409);assert.equal(r.payload.error,'close-fence-sealed');}assert.equal(f.existsCalls,before);assert.equal(f.sessions.length,0);assert.equal((await inspect(f,s)).state,'ready');
}));
test('a body admitted before the fence drains as cancelled, not as closed proof',check(async f=>{
 const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();const s=await prepare(f);assert.equal((await inspect(f,s)).state,'pending');assert.equal(f.api.ownership()?.kind,'start');g.release();assert.equal((await p).code,409);assert.equal((await inspect(f,s)).state,'ready');assert.equal(f.sessions.length,0);
}));
test('a restart admitted before the fence cannot close then create a late successor',check(async f=>{
 await f.start();const g=f.gate(),p=f.call('restart',{body:{scene:'lucy'},gate:g});await ticks();const s=await prepare(f);assert.equal((await inspect(f,s)).state,'pending');g.release();assert.equal((await p).code,409);assert.equal((await inspect(f,s)).state,'ready');assert.equal(f.sessions.length,1);assert.deepEqual(f.sessions[0].calls,['create','stop']);
}));
test('an admitted creation must finish rollback before the sealed fence becomes ready',check(async f=>{
 const g=f.gate();f.next({createGate:g});const p=f.start();for(let i=0;i<80&&!f.sessions.length;i++)await new Promise(resolve=>setTimeout(resolve,2));assert.equal(f.sessions.length,1);const s=await prepare(f);assert.equal((await inspect(f,s)).state,'pending');g.release();assert.equal((await p).code,409);await ticks();assert.equal((await inspect(f,s)).state,'ready');assert.equal(f.sessions.length,1);assert.equal(f.sessions[0].calls.filter(x=>x==='stop').length,1);
}));
test('an older draining close cannot turn a later orphaned failure into ready absence',check(async f=>{
 await f.start();const a=f.gate(),b=f.gate();f.sessions[0].options.stopGates=[a,b];const old=f.stop();await ticks();const s=await prepare(f);assert.equal((await inspect(f,s)).state,'pending');b.release();await ticks();assert.equal(f.api.currentSession(),null);assert.equal((await inspect(f,s)).state,'pending');f.sessions[0].options.closeResult={closed:false,outcome:'worker-unconfirmed'};a.release();await old;assert.equal((await inspect(f,s)).state,'unknown');assert.equal((await activate(f,await inspect(f,s))).code,409);
}));
test('another prepare cannot steal a sealed fence, even with a fresh Host revision',check(async f=>{
 const s=await prepare(f);assert.equal((await f.call('close-fence/prepare',{body:prepareBody(f)})).code,409);assert.equal(f.api.generation(),1);assert.equal((await inspect(f,s)).fenceId,s.fenceId);
}));
test('wrong ticket cannot inspect retry or activate',check(async f=>{
 const s=await prepare(f),bad={hostInstanceId:s.hostInstanceId,fenceId:randomUUID()};for(const [action,body] of [['inspect',bad],['retry',{...bad,attempt:1}],['activate',{...bad,revision:f.read().revision}]])assert.equal((await f.call('close-fence/'+action,{body})).code,409);assert.equal(f.api.generation(),1);
}));
test('failed cleanup retains the session and the fence, with explicit idempotent retry',check(async f=>{
 f.next({closeResult:{closed:false,outcome:'unconfirmed',error:'private command path'}});await f.start();const s=await prepare(f);let v=await inspect(f,s);assert.equal(v.state,'unconfirmed');assert.equal(f.api.currentSession(),f.sessions[0]);assert.equal((await activate(f,v)).code,409);assert.ok(!JSON.stringify(v).includes('private'));
 f.sessions[0].options.closeResult={closed:true};const body={...ticket(s),attempt:1};assert.equal((await f.call('close-fence/retry',{body})).code,200);await ticks();assert.equal((await f.call('close-fence/retry',{body})).code,200);v=await inspect(f,s);assert.equal(v.attempt,2);assert.equal(v.state,'ready');assert.equal(f.api.generation(),2);assert.equal(f.sessions[0].calls.filter(x=>x==='stop').length,2);
}));
test('retry while pending, ready or with a future attempt cannot send another stop',check(async f=>{
 await f.start();const g=f.gate();f.sessions[0].options.stopGate=g;const s=await prepare(f);assert.equal((await f.call('close-fence/retry',{body:{...ticket(s),attempt:1}})).code,409);assert.equal((await f.call('close-fence/retry',{body:{...ticket(s),attempt:3}})).code,409);g.release();await ticks();assert.equal((await inspect(f,s)).state,'ready');assert.equal((await f.call('close-fence/retry',{body:{...ticket(s),attempt:1}})).code,409);assert.equal(f.api.generation(),1);
}));
test('legacy cleanup fallback cannot produce ready on a sealed fence',check(async f=>{
 await f.start();f.sessions[0].change(null,{isClosed:true});const s=await prepare(f),v=await inspect(f,s);assert.equal(v.state,'unknown');assert.equal(v.close.uncertain,true);assert.equal((await activate(f,v)).code,409);assert.equal((await f.call('close-fence/retry',{body:{...ticket(s),attempt:1}})).code,409);
}));
test('an unexpected Host stop exception is sticky unknown, never cleared by a healthy read',check(async f=>{
 await f.start();f.sessions[0].options.stateError=true;f.sessions[0].options.closeResult={closed:false};const s=await prepare(f);f.sessions[0].options.stateError=false;assert.equal((await inspect(f,s)).state,'unknown');assert.equal((await activate(f,await inspect(f,s))).code,409);assert.equal((await f.start()).code,409);
}));
test('activation is explicit, revision-bound and sends neither stop nor start',check(async f=>{
 const s=await prepare(f),v=await inspect(f,s);await f.stop();assert.equal((await activate(f,v)).code,409);const fresh=await inspect(f,s),before=f.api.generation();const a=await activate(f,fresh);assert.equal(a.code,200);assert.match(a.payload.admission,/^[0-9a-f-]{36}$/);assert.equal(a.payload.snapshot.state,'released');assert.equal(a.payload.snapshot.canCommit,false);assert.equal(f.api.generation(),before);assert.equal(f.sessions.length,0);const b=await activate(f,fresh);assert.equal(b.payload.admission,a.payload.admission);assert.equal(f.api.generation(),before);
}));
test('after activation legacy or incorrect credentials stay blocked; only new capability starts',check(async f=>{
 const s=await prepare(f),a=await activate(f,await inspect(f,s)),key=a.payload.admission;assert.equal((await f.start()).code,409);assert.equal((await f.call('start',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':randomUUID()}})).code,409);assert.equal((await f.call('start',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':[key,key]}})).code,409);assert.equal((await f.call('start',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':key}})).code,200);assert.equal(f.sessions.length,1);assert.equal((await f.call('restart',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':key}})).code,200);assert.equal(f.sessions.length,2);
}));
test('late legacy compensating stop cannot stop a newly reactivated run',check(async f=>{
 const s=await prepare(f),a=await activate(f,await inspect(f,s)),key=a.payload.admission;const headers={'x-whale-wallpaper-admission':key};assert.equal((await f.call('start',{body:{scene:'lucy'},headers})).code,200);const before=f.api.generation();assert.equal((await f.stop()).code,409);assert.deepEqual(f.sessions[0].calls,['create']);assert.equal(f.api.generation(),before);assert.equal((await f.call('stop',{headers})).code,200);assert.deepEqual(f.sessions[0].calls,['create','stop']);
}));
test('legacy stop remains available while sealed as a cleanup-only recovery path',check(async f=>{
 await f.start();const s=await prepare(f);assert.equal((await f.stop()).code,200);assert.equal((await inspect(f,s)).state,'ready');assert.equal((await f.start()).code,409);
}));
test('a second close revokes the old capability and old activation replay forever',check(async f=>{
 const s=await prepare(f),ready=await inspect(f,s),a=await activate(f,ready),key=a.payload.admission;const next=await prepare(f);assert.notEqual(next.fenceId,s.fenceId);assert.equal((await activate(f,ready)).code,409);const b=await activate(f,await inspect(f,next));assert.notEqual(b.payload.admission,key);assert.equal((await f.call('start',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':key}})).code,409);assert.equal((await f.call('start',{body:{scene:'lucy'},headers:{'x-whale-wallpaper-admission':b.payload.admission}})).code,200);
}));
test('delayed activation of a replaced fence cannot reopen the current gate',check(async f=>{
 const s=await prepare(f),ready=await inspect(f,s),g=f.gate();const delayed=f.call('close-fence/activate',{body:{...ticket(s),revision:ready.close.revision},gate:g});await activate(f,ready);const next=await prepare(f);g.release();assert.equal((await delayed).code,409);assert.equal((await inspect(f,next)).state,'ready');assert.equal((await f.start()).code,409);
}));
test('unload permanently refuses new admission and activation, including delayed prepare bodies',check(async f=>{
 const s=await prepare(f),ready=await inspect(f,s),g=f.gate(),p=f.call('close-fence/prepare',{body:prepareBody(f),gate:g});await f.dispose();g.release();assert.equal((await p).code,409);assert.equal((await activate(f,ready)).code,409);assert.equal((await inspect(f,s)).state,'disposed');assert.equal((await f.start()).code,409);assert.equal(f.sessions.length,0);
}));
test('malformed fence HTTP bodies do not install an admission barrier',check(async f=>{
 assert.equal((await f.call('close-fence/prepare',{body:'x'.repeat(1100)})).code,400);assert.equal((await f.start()).code,200);assert.equal(f.api.generation(),0);
}));
test('inspect is read-only and does not expose the activation capability',check(async f=>{
 const s=await prepare(f),a=await activate(f,await inspect(f,s)),before=f.api.generation();for(let i=0;i<4;i++){const r=await f.call('close-fence/inspect',{body:ticket(s)});assert.equal(r.headers['cache-control'],'no-store');assert.ok(!JSON.stringify(r.payload).includes(a.payload.admission));}assert.equal(f.api.generation(),before);assert.equal(f.sessions.length,0);
}));

function bodyReq(chunks){let destroyed=0,returned=0;return{async *[Symbol.asyncIterator](){try{for(const chunk of chunks)yield chunk;}finally{returned++;}},destroy(){destroyed++;},get destroyedCount(){return destroyed;},get returnedCount(){return returned;}};}
test('strict fence body accepts valid UTF-8 JSON and leaves complete request intact',async()=>{const req=bodyReq([Buffer.from('{"x":"鲸"}')]);assert.deepEqual(await readCloseFenceBody(req),{x:'鲸'});assert.equal(req.destroyedCount,0);assert.equal(req.returnedCount,1);});
test('fence body rejects damaged UTF-8 instead of substituting characters',async()=>{const req=bodyReq([Buffer.from([123,34,120,34,58,34,0xff,34,125])]);await assert.rejects(readCloseFenceBody(req));assert.equal(req.destroyedCount,1);});
test('fence body rejects oversized bytes, excessive empty chunks, nonbytes and malformed JSON',async()=>{for(const chunks of [[Buffer.alloc(1025)],Array.from({length:65},()=>Buffer.alloc(0)),['text'],[Buffer.from('{')],[]]){const req=bodyReq(chunks);await assert.rejects(readCloseFenceBody(req));assert.equal(req.destroyedCount,1);assert.equal(req.returnedCount,1);}});
test('hung body has one whole-request deadline and closes only its inbound request',async()=>{let release,destroyed=0,returned=0;const gate=new Promise(resolve=>{release=resolve;});const req={destroy(){destroyed++;release({done:true});},[Symbol.asyncIterator](){return{next:()=>gate,return(){returned++;return Promise.resolve({done:true});}};}};try{await assert.rejects(bounded(readCloseFenceBody(req),'body safety',1400),/body-timeout/);assert.equal(destroyed,1);assert.equal(returned,1);}finally{release({done:true});}});
test('throwing iterator setup cannot leave a body timer or install a fence',async()=>{await assert.rejects(readCloseFenceBody({[Symbol.asyncIterator](){throw Error('bad iterator');}}),/bad iterator/);});

test('malformed stop outcomes fail closed even if the observed Host is absent',async()=>{
 for(const result of [null,{}, {ok:true}, {ok:'yes'}, {ok:true,payload:null}]){
  let revision=0;const hostInstanceId=randomUUID(),readCloseState=()=>Object.freeze({hostInstanceId,revision,lifecycle:'active',quiescent:true,uncertain:false,pendingCount:0,ownership:null});
  const f=createCloseFence({hostInstanceId,readCloseState,touchCloseState(){revision++;},stopNow:()=>result});const r=f.prepare({hostInstanceId,revision:0,requestId:randomUUID()});await ticks();const v=f.inspect(ticket(r.snapshot));assert.equal(v.snapshot.state,'unknown');assert.equal(f.activate({...ticket(r.snapshot),revision}).ok,false);
 }
});
test('real loopback HTTP exercises prepare, inspect, activation and credential admission',check(async f=>{
 const server=createServer((req,res)=>f.route.handler(req,res).catch(()=>{res.writeHead(500);res.end();}));server.listen(0,'127.0.0.1');await bounded(once(server,'listening'),'listen');const root='http://127.0.0.1:'+server.address().port+'/whale-wallpaper/';
 const post=async(action,body,headers={})=>{const res=await fetch(root+action,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(1000)});return{code:res.status,payload:await res.json()};};
 try{const p=await post('close-fence/prepare',prepareBody(f));assert.equal(p.code,200);const s=(await post('close-fence/inspect',ticket(p.payload.snapshot))).payload.snapshot;assert.equal(s.state,'ready');assert.equal((await post('start',{scene:'lucy'})).code,409);const a=await post('close-fence/activate',{...ticket(s),revision:s.close.revision});assert.equal(a.code,200);assert.equal((await post('start',{scene:'lucy'},{'x-whale-wallpaper-admission':a.payload.admission})).code,200);assert.equal((await post('stop',{}, {'x-whale-wallpaper-admission':a.payload.admission})).code,200);assert.equal(f.sessions.length,1);}finally{server.closeAllConnections();await bounded(new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),'server close');assert.equal(server.listening,false);}
}));
