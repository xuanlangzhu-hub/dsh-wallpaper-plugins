import {test} from 'node:test';
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
 async function call(action,{method='POST',body,gate}={}){
  const req={method,url:'/whale-wallpaper/'+action,async *[Symbol.asyncIterator](){if(gate)await gate.promise;if(body!==undefined)yield Buffer.from(JSON.stringify(body));}};
  const res={code:null,raw:null,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code,headers){this.code=code;Object.assign(this.headers,headers);},end(raw){this.raw=raw;}};
  const task=route.handler(req,res).then(()=>({code:res.code,payload:res.raw?JSON.parse(res.raw):null,headers:res.headers}));jobs.push(task);return bounded(task,action);
 }
 const read=()=>api.readCloseState();
 return{api,route,routes,sessions,read,call,get existsCalls(){return existsCalls;},next:options=>{next=options;},gate(){let release;const promise=new Promise(resolve=>{release=resolve;});const gate={promise,release};gates.push(gate);return gate;},start:()=>call('start',{body:{scene:'lucy',mode:'daily'}}),stop:()=>call('stop'),async dispose(){for(const off of [...disposers].reverse())if(typeof off==='function')await bounded(Promise.resolve(off()),'dispose');},async cleanup(){for(const gate of gates)gate.release();for(const s of sessions){s.options.stateError=false;s.options.closeResult={closed:true,outcome:'closed'};s.change({closed:true});}await bounded(Promise.allSettled(jobs),'pending requests');for(const off of [...disposers].reverse())if(typeof off==='function')await bounded(Promise.resolve(off()),'cleanup');await removeProfile(logRoot);}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};

test('fresh Host has a frozen stable identity-bound absence observation without commit permission',check(async f=>{
 assert.equal(typeof f.api.readCloseState,'function');const s=f.read();assert.equal(s,f.read());assert.match(s.hostInstanceId,/^[0-9a-f-]{36}$/);assert.equal(s.version,1);assert.equal(s.state,'absent');assert.equal(s.session,'absent');assert.equal(s.pendingCount,0);assert.equal(s.quiescent,true);assert.equal(s.canCommit,false);assert.equal(s.scope,'arrived-operations');assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.pending));
}));
test('separate Host registrations have separate lifecycle identities',check(async f=>{const other=await rig();try{assert.notEqual(f.read().hostInstanceId,other.read().hostInstanceId);}finally{await other.cleanup();}}));
test('new GET reads cached local state without probing files scanning or creating sessions',check(async f=>{
 const before=f.existsCalls;for(let i=0;i<4;i++){const r=await f.call('close-state',{method:'GET'});assert.equal(r.code,200);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.payload.state,'absent');}assert.equal(f.existsCalls,before);assert.equal(f.sessions.length,0);assert.equal(f.api.generation(),0);
}));
test('POST to the read endpoint does not become a lifecycle command',check(async f=>{const r=await f.call('close-state');assert.equal(r.code,404);assert.equal(f.api.generation(),0);assert.equal(f.sessions.length,0);}));
test('a start waiting for its request body is visible before any window work',check(async f=>{
 const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();const s=f.read();assert.equal(s.state,'pending');assert.equal(s.pendingCount,1);assert.equal(s.ownership,'start');assert.equal(s.session,'absent');assert.equal(s.quiescent,false);assert.ok(Object.isFrozen(s.pending[0]));await f.stop();g.release();assert.equal((await p).code,409);assert.equal(f.sessions.length,0);
}));
test('legacy pending false on stop does not conceal the still-unread start',check(async f=>{
 const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();const before=f.read(),r=await f.stop();assert.equal(r.payload.pending,false);const s=f.read();assert.equal(s.state,'pending');assert.equal(s.quiescent,false);assert.equal(s.pendingCount,1);assert.ok(s.cancelGeneration>before.cancelGeneration);g.release();await p;assert.equal(f.read().state,'absent');assert.equal(f.read().pendingCount,0);
}));
test('rejected concurrent start has no phantom retained operation',check(async f=>{
 const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();assert.equal((await f.start()).code,409);assert.equal(f.read().pendingCount,1);await f.stop();g.release();await p;assert.equal(f.read().pendingCount,0);
}));
test('malformed request releases its operation while preserving the old route status',check(async f=>{const r=await f.call('start',{body:null});assert.ok([400,409].includes(r.code));assert.equal(f.read().state,'absent');assert.equal(f.read().pendingCount,0);}));
test('preparing and creating operations are never reported as quiescent',check(async f=>{
 const g=f.gate();f.next({createGate:g});const p=f.start();for(let i=0;i<80&&!f.sessions.length;i++)await new Promise(resolve=>setTimeout(resolve,2));assert.equal(f.sessions.length,1);const s=f.read();assert.equal(s.state,'pending');assert.equal(s.session,'active');assert.equal(s.quiescent,false);g.release();assert.equal((await p).code,200);assert.equal(f.read().state,'active');assert.equal(f.read().pendingCount,0);
}));
test('active read does not stop or archive the session',check(async f=>{await f.start();const session=f.api.currentSession(),calls=[...session.calls],before=f.read();assert.equal(before.state,'active');assert.equal(before.quiescent,false);assert.equal(f.read(),before);assert.equal(f.api.currentSession(),session);assert.deepEqual(session.calls,calls);}));
test('an explicit confirmed close is different from fresh absence',check(async f=>{await f.start();const before=f.read();await f.stop();const s=f.read();assert.equal(s.state,'closed');assert.equal(s.session,'absent');assert.equal(s.quiescent,true);assert.equal(s.canCommit,false);assert.ok(s.revision>before.revision);assert.equal(s.hostInstanceId,before.hostInstanceId);}));
test('a failed close remains retained unconfirmed and an explicit retry can recover it',check(async f=>{f.next({closeResult:{closed:false,outcome:'unconfirmed',error:'private process detail'}});await f.start();assert.equal((await f.stop()).code,409);const failed=f.read();assert.equal(failed.state,'unconfirmed');assert.equal(failed.session,'unconfirmed');assert.equal(failed.quiescent,false);assert.ok(!JSON.stringify(failed).includes('private'));f.sessions[0].options.closeResult={closed:true};await f.stop();assert.equal(f.read().state,'closed');}));
test('old successful closure never overrides a newly active session',check(async f=>{await f.start();await f.stop();const old=f.read();await f.start();const s=f.read();assert.equal(s.state,'active');assert.equal(s.quiescent,false);assert.ok(s.revision>old.revision);}));
test('a session that ends itself is observed closed without mutating ownership or retiring it',check(async f=>{await f.start();const session=f.api.currentSession(),before=f.read();session.change({closed:true,outcome:'closed'});const s=f.read();assert.equal(s.state,'closed');assert.equal(s.session,'closed');assert.equal(s.quiescent,true);assert.ok(s.revision>before.revision);assert.equal(f.api.currentSession(),session);assert.deepEqual(session.calls,['create']);assert.equal(f.read(),s);}));
test('legacy status retirement preserves the confirmed close observation',check(async f=>{await f.start();f.sessions[0].change({closed:true});await f.call('status',{method:'GET'});assert.equal(f.api.currentSession(),null);assert.equal(f.read().state,'closed');}));
test('legacy retirement cannot promote contradictory closure flags into a positive observation',check(async f=>{await f.start();f.sessions[0].change({closed:true},{isClosed:false});assert.equal(f.read().state,'unconfirmed');await f.call('status',{method:'GET'});assert.equal(f.api.currentSession(),null);assert.equal(f.read().state,'unknown');assert.equal(f.read().quiescent,false);}));
test('unreadable session state reports unknown without leaking exception details',check(async f=>{await f.start();f.sessions[0].options.stateError=true;const s=f.read();assert.equal(s.state,'unknown');assert.equal(s.uncertain,true);assert.equal(s.quiescent,false);assert.ok(!JSON.stringify(s).includes('private'));f.sessions[0].options.stateError=false;}));
test('isClosed without explicit cleanup is unknown rather than fabricated proof',check(async f=>{await f.start();f.sessions[0].change(null,{isClosed:true});assert.equal(f.read().state,'unknown');assert.equal(f.read().quiescent,false);await f.api.closeSession();assert.equal(f.api.currentSession(),null);assert.equal(f.read().state,'unknown');assert.equal(f.read().uncertain,true);}));
test('create failure retired by a legacy fallback cannot manufacture proof',check(async f=>{f.next({createError:true,closeResult:{outcome:'absent'}});await f.start();assert.equal(f.read().quiescent,false);assert.ok(['unknown','unconfirmed'].includes(f.read().state));}));
test('pending close is visible even when called directly instead of through HTTP ownership',check(async f=>{
 await f.start();const g=f.gate();f.sessions[0].options.stopGate=g;const p=f.api.closeSession();await ticks();const s=f.read();assert.equal(s.state,'pending');assert.equal(s.ownership,null);assert.ok(s.pending.some(x=>x.kind==='close'));assert.equal(s.quiescent,false);g.release();await p;assert.equal(f.read().state,'closed');
}));
test('concurrent close ownership replacement does not lose the older draining operation',check(async f=>{
 await f.start();const g=f.gate();f.sessions[0].options.stopGate=g;const p=f.stop(),q=f.stop();await ticks();assert.ok(f.read().pendingCount>=2);assert.equal(f.read().state,'pending');g.release();await Promise.all([p,q]);assert.equal(f.read().pendingCount,0);assert.equal(f.read().state,'closed');
}));
test('an older close remains pending after the newer owner has already released its session',check(async f=>{
 await f.start();const a=f.gate(),b=f.gate();f.sessions[0].options.stopGates=[a,b];const p=f.stop();await ticks();const q=f.stop();await ticks();b.release();await q;assert.equal(f.api.ownership(),null);assert.equal(f.api.currentSession(),null);assert.equal(f.read().state,'pending');assert.equal(f.read().quiescent,false);assert.ok(f.read().pendingCount>=1);a.release();await p;assert.equal(f.read().pendingCount,0);assert.equal(f.read().state,'closed');
}));
test('public pending detail is capped while the total still counts every live operation',check(async f=>{
 await f.start();const g=f.gate();f.sessions[0].options.stopGate=g;const jobs=Array.from({length:24},()=>f.api.closeSession());await ticks();const s=f.read();assert.equal(s.pendingCount,24);assert.equal(s.pending.length,16);assert.equal(s.pendingTruncated,true);assert.equal(s.quiescent,false);assert.ok(JSON.stringify(s).length<2048);g.release();await Promise.all(jobs);assert.equal(f.read().pendingCount,0);assert.equal(f.read().pendingTruncated,false);
}));
test('restart body remains visible after stop cancellation until it actually settles',check(async f=>{
 const g=f.gate(),p=f.call('restart',{body:{scene:'lucy'},gate:g});await ticks();await f.stop();assert.equal(f.read().pendingCount,1);assert.equal(f.read().state,'pending');g.release();assert.equal((await p).code,409);assert.equal(f.read().pendingCount,0);assert.equal(f.sessions.length,0);
}));
test('unload invalidates observations immediately and never lets a delayed body appear closed',check(async f=>{
 const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();await f.dispose();const s=f.read();assert.equal(s.lifecycle,'disposed');assert.equal(s.state,'disposed');assert.equal(s.quiescent,false);assert.equal(s.pendingCount,1);g.release();assert.equal((await p).code,409);assert.equal(f.read().pendingCount,0);assert.equal(f.read().state,'disposed');assert.equal(f.sessions.length,0);
}));
test('stable repeated reads never advance revision while real A to B to A activity does',check(async f=>{const old=f.read();assert.equal(f.read().revision,old.revision);const g=f.gate(),p=f.call('start',{body:{scene:'lucy'},gate:g});await ticks();await f.stop();g.release();await p;const s=f.read();assert.equal(s.state,old.state);assert.ok(s.revision>old.revision);assert.equal(f.read(),s);}));
test('state is explicitly limited to arrived requests and does not fence a later legacy start',check(async f=>{const old=f.read();assert.equal(old.quiescent,true);assert.equal(old.canCommit,false);assert.equal(old.scope,'arrived-operations');assert.equal((await f.start()).code,200);assert.equal(old.state,'absent');assert.equal(f.read().state,'active');assert.ok(f.read().revision>old.revision);}));
test('real loopback HTTP GET publishes the same bounded public schema and closes its server',check(async f=>{
 const server=createServer((req,res)=>f.route.handler(req,res).catch(()=>{res.writeHead(500);res.end();}));server.listen(0,'127.0.0.1');await bounded(once(server,'listening'),'listen');try{const res=await fetch('http://127.0.0.1:'+server.address().port+'/whale-wallpaper/close-state',{signal:AbortSignal.timeout(1000)});assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');const data=await res.json();assert.equal(data.hostInstanceId,f.read().hostInstanceId);assert.equal(data.state,'absent');assert.equal(data.canCommit,false);assert.ok(JSON.stringify(data).length<2048);assert.ok(!JSON.stringify(data).includes('offline'));}finally{server.closeAllConnections();await bounded(new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),'server close');assert.equal(server.listening,false);}
}));
