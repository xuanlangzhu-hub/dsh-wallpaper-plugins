import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {registerWallpaperRoutes} from '../src/wallpaper/session.js';
import {createProfile,removeProfile} from './temp-profile.mjs';

const ticks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const bounded=async(p,label,ms=1200)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' deadline')),ms);})]);}finally{clearTimeout(timer);}};
async function hostRig(){
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

const clientSource=await readFile(new URL('../src/client.js',import.meta.url),'utf8');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function rig({transport,realTimers=false,noCrypto=false}={}){
 const host=await hostRig(),calls=[],timers=new Map(),held=[],streams=new Set(),filters=[];let mod,id=0;
 const set=realTimers?setTimeout:(fn,ms)=>{const n=++id;timers.set(n,{fn,ms});return n;},clear=realTimers?clearTimeout:n=>timers.delete(n);
 async function actual(url,options={}){
  if(url==='/whale-wallpaper/stream'){
   let controller;const stream=new ReadableStream({start(c){controller=c;streams.add(c);},cancel(){streams.delete(controller);}});
   const close=()=>{try{controller.close();}catch{}streams.delete(controller);};options.signal?.addEventListener('abort',close,{once:true});
   return new Response(stream,{headers:{'content-type':'application/octet-stream'}});
  }
  if(url.includes('/metrics')||url.includes('/cadence-trace'))return new Response(null,{status:204});
  const action=url.replace('/whale-wallpaper/',''),r=await host.call(action,{method:options.method??'GET',headers:options.headers,body:options.body?JSON.parse(options.body):undefined});return json(r.payload,r.code);
 }
 const fetchImpl=async(url,options={})=>{calls.push({url,options});if(transport)return transport(url,options,actual);const fn=filters.shift();return fn?fn(url,options,actual):actual(url,options);};
 const sandbox={console,AbortController,TextDecoder,Blob,URL,Uint8Array,ArrayBuffer,DataView,performance,crypto:noCrypto?{}:{randomUUID},document:{hidden:false},setTimeout:set,clearTimeout:clear,setInterval:set,clearInterval:clear,addEventListener(){},removeEventListener(){}};sandbox.window=sandbox;sandbox.__ModuleLoader__={load:({factory})=>{mod=factory(()=>({}));}};vm.runInNewContext(clientSource,sandbox,{timeout:1000});
 const engine=mod.createWallpaperEngine({fetchImpl});
 return{engine,host,calls,timers,actual,filter:fn=>filters.push(fn),hold(){const d=deferred();held.push(d);return d;},expire(){for(const[n,{fn}]of [...timers]){timers.delete(n);fn();}},state:()=>engine.getCloseFenceSnapshot(),async prepare(){const r=await engine.prepareCloseFence();assert.equal(r.ok,true);return r;},async ready(options){const p=await engine.prepareCloseFence(options);assert.equal(p.ok,true,p.error);const s=await engine.inspectCloseFence(options);assert.equal(s.ok,true,s.error);assert.equal(s.snapshot.state,'ready');return s;},async cleanup(){engine.dispose();for(const d of held)d.resolve(json({}));for(const c of streams){try{c.close();}catch{}}streams.clear();await ticks();await host.cleanup();await ticks();assert.equal(timers.size,0);}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};
const fenceCalls=f=>f.calls.filter(c=>c.url.includes('/close-fence/'));

test('fence snapshots are stable frozen explicit observations without automatic IO',check(async f=>{
 const s=f.state();assert.equal(s.state,'unprepared');assert.equal(s,f.state());assert.equal(s.canCommit,false);assert.ok(Object.isFrozen(s));assert.equal(f.calls.length,0);
}));
test('real Host preparation sends one GET then one fence write and no ordinary stop',check(async f=>{
 const r=await f.prepare();assert.ok(['pending','ready'].includes(r.snapshot.state));const s=(await f.engine.inspectCloseFence()).snapshot;assert.equal(s.state,'ready');assert.equal(s.sameRound,true);assert.equal(s.canCommit,false);assert.equal(f.host.api.generation(),1);assert.deepEqual(f.calls.map(c=>c.url),['/whale-wallpaper/close-state','/whale-wallpaper/close-fence/prepare','/whale-wallpaper/close-fence/inspect']);assert.equal(f.calls[1].options.cache,'no-store');assert.equal(f.timers.size,0);
}));
test('a playing engine ends local streaming and the Host run with exactly one native stop',check(async f=>{
 await f.engine.start();assert.equal(f.engine.running(),true);let ended=0;const off=f.engine.subscribe({onFrame(){},onStop(){ended++;}});await f.ready();off();assert.equal(ended,1);assert.equal(f.engine.running(),false);assert.equal(f.engine.getStatus().state,'stopped');assert.equal(f.engine.hasPendingCleanup(),false);assert.deepEqual(f.host.sessions[0].calls,['create','stop']);assert.equal(f.calls.filter(c=>c.url==='/whale-wallpaper/stop').length,0);
}));
test('sealed engine never starts or restarts and does not automatically activate',check(async f=>{
 await f.ready();const n=f.calls.length;await f.engine.start();await f.engine.restart();assert.equal(f.calls.length,n);assert.equal(f.host.sessions.length,0);assert.equal(fenceCalls(f).some(c=>c.url.endsWith('/activate')),false);
}));
test('duplicate preparation does not send a second stop or replace the owner',check(async f=>{
 await f.ready();const n=f.calls.length;assert.equal((await f.engine.prepareCloseFence()).error,'fence-owned');assert.equal(f.calls.length,n);assert.equal(f.host.api.generation(),1);
}));
test('a stuck native close stays pending until a fresh explicit inspect',check(async f=>{
 await f.engine.start();const gate=f.host.gate();f.host.sessions[0].options.stopGate=gate;await f.prepare();assert.equal(f.state().state,'pending');assert.equal((await f.engine.activateCloseFence()).error,'fence-not-ready');gate.release();await ticks();assert.equal(f.state().state,'pending');const r=await f.engine.inspectCloseFence();assert.equal(r.snapshot.state,'ready');assert.equal(f.host.sessions[0].calls.filter(c=>c==='stop').length,1);
}));
test('failed cleanup remains retained and only an explicit retry sends another fence stop',check(async f=>{
 f.host.next({closeResult:{closed:false,outcome:'worker-unconfirmed'}});await f.engine.start();await f.prepare();await f.engine.inspectCloseFence();assert.equal(f.state().state,'unconfirmed');assert.equal(f.engine.getStatus().state,'cleanup-failed');assert.equal((await f.engine.activateCloseFence()).error,'fence-not-ready');f.host.sessions[0].options.closeResult={closed:true};const r=await f.engine.retryCloseFence();assert.equal(r.ok,true,r.error);await f.engine.inspectCloseFence();assert.equal(f.state().state,'ready');assert.equal(f.state().attempt,2);assert.equal(f.host.sessions[0].calls.filter(c=>c==='stop').length,2);
}));
test('retry before preparation or while ready cannot create a new request',check(async f=>{
 assert.equal((await f.engine.retryCloseFence()).error,'fence-unprepared');await f.ready();const n=f.calls.length;assert.equal((await f.engine.retryCloseFence()).error,'fence-not-retryable');assert.equal(f.calls.length,n);
}));
test('explicit activation produces credentials only on later lifecycle requests',check(async f=>{
 await f.ready();const r=await f.engine.activateCloseFence();assert.equal(r.ok,true,r.error);assert.equal(r.snapshot.state,'released');assert.equal(f.host.api.generation(),1);assert.equal(f.host.sessions.length,0);assert.ok(!('admission' in r));await f.engine.start();const a=f.calls.findLast(c=>c.url.endsWith('/start')).options.headers['x-whale-wallpaper-admission'];assert.match(a,/^[0-9a-f-]{36}$/);assert.equal(f.engine.running(),true);assert.ok(!JSON.stringify(f.state()).includes(a));assert.ok(!JSON.stringify(f.engine.getCloseSnapshot()).includes(a));await f.engine.stop();assert.equal(f.calls.findLast(c=>c.url==='/whale-wallpaper/stop').options.headers['x-whale-wallpaper-admission'],a);assert.equal(f.engine.getStatus().state,'stopped');
}));
test('a subsequent explicit close and activation rotate credentials without legacy fallback',check(async f=>{
 await f.ready();await f.engine.activateCloseFence();await f.engine.start();const first=f.calls.findLast(c=>c.url.endsWith('/start')).options.headers['x-whale-wallpaper-admission'];await f.ready();await f.engine.activateCloseFence();await f.engine.start();const second=f.calls.findLast(c=>c.url.endsWith('/start')).options.headers['x-whale-wallpaper-admission'];assert.notEqual(first,second);assert.equal(f.host.sessions.length,2);await f.engine.stop();
}));
test('unsettled legacy commands block preparation before another network request',check(async f=>{
 const d=f.hold();f.filter(()=>d.promise);const stop=f.engine.stop();const n=f.calls.length;assert.equal((await f.engine.prepareCloseFence()).error,'fence-busy');assert.equal(f.calls.length,n);d.resolve(json({cleanup:{closed:true},active:false,session:null}));await stop;
}));
test('legacy unknown is sticky and a healthy Host GET cannot admit a fence write',check(async f=>{
 f.filter(()=>Promise.reject(Error('private write')));await f.engine.stop();assert.equal(f.engine.getCloseSnapshot().uncertain,true);await f.engine.readHostCloseState();const n=f.calls.length;assert.equal((await f.engine.prepareCloseFence()).error,'fence-write-unknown');assert.equal(f.calls.length,n);
}));
test('invalid options false async guards and missing crypto cannot issue a fence write',check(async f=>{
 for(const options of [null,[],{timeoutMs:0},{signal:{}},{isCurrent:5},{isCurrent:()=>false},{isCurrent:()=>Promise.resolve(true)}])assert.equal((await f.engine.prepareCloseFence(options)).ok,false);assert.equal(f.calls.length,0);const other=await rig({noCrypto:true});try{assert.equal((await other.engine.prepareCloseFence()).error,'fence-unavailable');assert.equal(other.calls.length,0);}finally{await other.cleanup();}
}));
test('an already aborted prepare never stops local playback or sends a new request',check(async f=>{
 await f.engine.start();const c=new AbortController();c.abort();const n=f.calls.length;assert.equal((await f.engine.prepareCloseFence({signal:c.signal})).error,'fence-aborted');assert.equal(f.engine.running(),true);assert.equal(f.calls.length,n);await f.engine.stop();
}));
test('aborting the preflight GET has no shutdown or write side effects',check(async f=>{
 const d=f.hold(),c=new AbortController();f.filter(()=>d.promise);const p=f.engine.prepareCloseFence({signal:c.signal});c.abort();assert.equal((await p).error,'fence-aborted');assert.equal(f.engine.getCloseSnapshot().uncertain,false);assert.equal(fenceCalls(f).length,0);d.resolve(json(f.host.read()));await ticks();assert.equal(f.host.api.generation(),0);
}));
test('a hung fence write is bounded, latches unknown and cannot be revived by a late response',check(async f=>{
 const d=f.hold();f.filter((u,o,a)=>a(u,o));f.filter(()=>d.promise);const p=f.engine.prepareCloseFence({timeoutMs:30});for(let i=0;i<50&&fenceCalls(f).length===0;i++)await ticks();assert.equal(fenceCalls(f).length,1);f.expire();const r=await p;assert.equal(r.error,'fence-timeout');await ticks();assert.equal(f.engine.getCloseSnapshot().uncertain,true);const s=f.state();d.resolve(json({}));await ticks();assert.equal(f.state(),s);assert.equal((await f.engine.activateCloseFence()).ok,false);assert.equal(fenceCalls(f).length,1);
}));
test('hung response consumption is cancelled without cancelling the accepted Host fence',check(async f=>{
 let cancelled=0;f.filter((u,o,a)=>a(u,o));f.filter(async(u,o,a)=>{await a(u,o);return new Response(new ReadableStream({pull(){},cancel(){cancelled++;}}));});const p=f.engine.prepareCloseFence({timeoutMs:30});for(let i=0;i<50&&!f.host.api.generation();i++)await ticks();await ticks();f.expire();assert.equal((await p).error,'fence-timeout');await ticks();assert.ok(cancelled>=1);assert.equal(f.engine.getCloseSnapshot().uncertain,true);assert.equal(f.host.api.generation(),1);assert.equal((await f.host.start()).code,409);
}));
test('ignored-abort late fence bodies are cancelled and never publish ready',check(async f=>{
 const d=f.hold(),c=new AbortController();let cancelled=0;f.filter((u,o,a)=>a(u,o));f.filter(()=>d.promise);const p=f.engine.prepareCloseFence({signal:c.signal});for(let i=0;i<50&&!fenceCalls(f).length;i++)await ticks();c.abort();assert.equal((await p).error,'fence-aborted');d.resolve(new Response(new ReadableStream({pull(){},cancel(){cancelled++;}})));await ticks();assert.equal(cancelled,1);assert.equal(f.state().state,'unknown');
}));
test('new preparations are refused while the first preflight is still pending',check(async f=>{
 const d=f.hold();f.filter(()=>d.promise);const p=f.engine.prepareCloseFence();assert.equal((await f.engine.prepareCloseFence()).error,'fence-busy');f.expire();await p;d.resolve(json(f.host.read()));await ticks();assert.equal(f.host.api.generation(),0);
}));
test('scope A to B to A invalidates pending replies, while a new explicit inspect may rebind',check(async f=>{
 let epoch=0;await f.ready({isCurrent:()=>epoch===0});epoch++;epoch++;assert.equal(f.state().state,'stale');const n=f.calls.length;assert.equal((await f.engine.activateCloseFence()).error,'fence-not-ready');assert.equal(f.calls.length,n);const r=await f.engine.inspectCloseFence({isCurrent:()=>epoch===2});assert.equal(r.snapshot.state,'ready');assert.equal((await f.engine.activateCloseFence({isCurrent:()=>epoch===2})).ok,true);
}));
test('stale ready listener cannot turn a new stop into a successful outer result',check(async f=>{
 await f.prepare();let stop;const off=f.engine.subscribeCloseFence(s=>{if(s.state==='ready'&&!stop)stop=f.engine.stop();});const r=await f.engine.inspectCloseFence();off();if(stop)await stop;assert.equal(r.ok,false);assert.equal(r.error,'fence-stale');assert.notEqual(f.state().state,'ready');
}));
test('a reentrant local shutdown callback is not absorbed into the prepare baseline',check(async f=>{
 let stop,entered=false;const off=f.engine.subscribe({onFrame(){},onStop(){if(!entered){entered=true;stop=f.engine.stop();}}});const r=await f.engine.prepareCloseFence();off();if(stop)await stop;assert.equal(r.ok,false);assert.equal(r.error,'fence-stale');assert.equal(fenceCalls(f).length,0);
}));
test('a known rejected prepare can be explicitly retried after normal cleanup',check(async f=>{
 f.filter((u,o,a)=>a(u,o));f.filter(()=>json({ok:false,error:'close-fence-owned'},409));assert.equal((await f.engine.prepareCloseFence()).error,'fence-rejected');await f.engine.stop();const r=await f.engine.prepareCloseFence();assert.equal(r.ok,true,r.error);assert.equal(f.host.api.generation(),2);
}));
test('disposal during an uncertain write remains disposed in the public snapshot',check(async f=>{
 const d=f.hold();f.filter((u,o,a)=>a(u,o));f.filter(()=>d.promise);const p=f.engine.prepareCloseFence();for(let i=0;i<50&&!fenceCalls(f).length;i++)await ticks();f.engine.dispose();assert.equal((await p).error,'fence-disposed');assert.equal(f.state().state,'disposed');assert.equal(f.engine.getCloseSnapshot().uncertain,true);d.resolve(json({}));await ticks();assert.equal(f.state().state,'disposed');
}));
test('known conflict returns a fixed refusal without claiming a completed source close',check(async f=>{
 f.filter((u,o,a)=>a(u,o));f.filter(()=>json({ok:false,error:'close-fence-owned'},409));const r=await f.engine.prepareCloseFence();assert.equal(r.error,'fence-rejected');assert.equal(f.engine.getCloseSnapshot().uncertain,false);assert.equal(f.state().canCommit,false);assert.equal(f.state().state,'failed');
}));
test('unsupported or malformed fence write replies cannot become a no-session success',check(async f=>{
 for(const response of [()=>new Response('{}',{status:404}),()=>json(null),()=>json({ok:true,snapshot:{}}),()=>new Response('private invalid JSON')]){
  const other=await rig();try{other.filter((u,o,a)=>a(u,o));other.filter(response);const r=await other.engine.prepareCloseFence();assert.equal(r.ok,false);assert.equal(other.engine.getCloseSnapshot().uncertain,true);assert.equal(other.state().canCommit,false);assert.ok(!JSON.stringify(r).includes('private'));}finally{await other.cleanup();}
 }
}));
test('strict reply validation rejects missing extra contradictory and mismatched ticket fields',check(async f=>{
 await f.ready();const mutations=[s=>{delete s.canCommit;},s=>{s.extra=true;},s=>{s.canCommit=true;},s=>{s.version=2;},s=>{s.fenceId=randomUUID();},s=>{s.requestId=randomUUID();},s=>{s.attempt=0;},s=>{s.attempt++;},s=>{s.state='ready';s.close.quiescent=false;},s=>{s.close.revision=-1;}];
 for(const mutate of mutations){f.filter(async(u,o,a)=>{const r=await a(u,o),p=await r.json();mutate(p.snapshot);return json(p);});const r=await f.engine.inspectCloseFence();assert.equal(r.ok,false);assert.equal(f.state().canCommit,false);assert.equal(f.engine.getCloseSnapshot().uncertain,false);}
 assert.equal((await f.engine.inspectCloseFence()).snapshot.state,'ready');
}));
test('oversized UTF-8 damage and endless empty chunks have bounded rejection',check(async f=>{
 await f.ready();for(const body of ['x'.repeat(9000),new Uint8Array([0xff])]){f.filter(()=>Promise.resolve(new Response(body)));assert.equal((await f.engine.inspectCloseFence()).ok,false);}let pulled=0,cancelled=0;f.filter(()=>Promise.resolve(new Response(new ReadableStream({pull(c){if(++pulled<9000)c.enqueue(new Uint8Array());else c.close();},cancel(){cancelled++;}}))));assert.equal((await f.engine.inspectCloseFence()).ok,false);assert.ok(pulled<8200);assert.equal(cancelled,1);
}));
test('read-only cancellation does not manufacture a write-unknown latch',check(async f=>{
 await f.ready();const d=f.hold(),c=new AbortController();f.filter(()=>d.promise);const p=f.engine.retryCloseFence();assert.equal((await p).error,'fence-not-retryable');f.filter(()=>d.promise);const read=f.engine.inspectCloseFence({signal:c.signal});c.abort();await read;assert.equal(f.engine.getCloseSnapshot().uncertain,false);d.resolve(json({}));await ticks();
}));
test('a successful exact-ticket inspect cannot wash away an uncertain activation write',check(async f=>{
 await f.ready();const d=f.hold();f.filter(async(u,o,a)=>{await a(u,o);return d.promise;});const p=f.engine.activateCloseFence({timeoutMs:30});await ticks();f.expire();assert.equal((await p).ok,false);d.resolve(json({}));await ticks();const r=await f.engine.inspectCloseFence();assert.equal(r.ok,true,r.error);assert.equal(r.snapshot.state,'unknown');assert.equal(f.engine.getCloseSnapshot().uncertain,true);assert.equal((await f.engine.activateCloseFence()).error,'fence-write-unknown');
}));
test('unknown conflict codes are not accepted as proof that a write was rejected',check(async f=>{
 f.filter((u,o,a)=>a(u,o));f.filter(()=>json({ok:false,error:'close-fence-new-unknown-code'},409));const r=await f.engine.prepareCloseFence();assert.equal(r.ok,false);assert.equal(f.engine.getCloseSnapshot().uncertain,true);
}));
test('malformed activation capabilities do not release local admission',check(async f=>{
 await f.ready();f.filter(async(u,o,a)=>{const p=await(await a(u,o)).json();p.admission='not-a-capability';return json(p);});const r=await f.engine.activateCloseFence();assert.equal(r.ok,false);assert.equal(f.engine.getCloseSnapshot().uncertain,true);const n=f.calls.length;await f.engine.start();assert.equal(f.calls.length,n);
}));
test('same-Host revisions and counters cannot regress through the fence protocol',check(async f=>{
 await f.ready();f.filter(async(u,o,a)=>{const p=await(await a(u,o)).json();p.snapshot.close.revision=0;return json(p);});const r=await f.engine.inspectCloseFence();assert.equal(r.ok,false);assert.equal(r.error,'fence-host-regressed');assert.equal((await f.engine.inspectCloseFence()).snapshot.state,'ready');
}));
test('the whole preflight and response share a real deadline and remove all owned waits',async()=>{
 let gate=deferred();const f=await rig({realTimers:true,transport:()=>gate.promise});try{const start=Date.now(),r=await bounded(f.engine.prepareCloseFence({timeoutMs:40}),'real deadline',1000);assert.equal(r.error,'fence-timeout');assert.ok(Date.now()-start<1000);assert.equal(f.engine.getCloseSnapshot().uncertain,false);}finally{gate.resolve(json(f.host.read()));await f.cleanup();}
});
test('real loopback Host and client agree on preparation inspection activation and credentialed stop',async()=>{
 let base;const seen=[],f=await rig({realTimers:true,transport:(url,options)=>fetch(base+url,options)});const server=createServer((req,res)=>{seen.push({method:req.method,url:req.url,admission:req.headers['x-whale-wallpaper-admission']});f.host.route.handler(req,res).catch(()=>{res.writeHead(500);res.end();});});server.listen(0,'127.0.0.1');await bounded(once(server,'listening'),'listen');base='http://127.0.0.1:'+server.address().port;
 try{await bounded(f.ready(),'HTTP ready');assert.equal((await bounded(f.engine.activateCloseFence(),'HTTP activate')).ok,true);assert.equal(f.host.api.generation(),1);assert.equal(f.host.sessions.length,0);await bounded(f.engine.stop(),'HTTP stop');const stop=seen.find(r=>r.url==='/whale-wallpaper/stop');assert.match(stop.admission,/^[0-9a-f-]{36}$/);assert.equal(seen.filter(r=>r.url==='/whale-wallpaper/stop').length,1);assert.equal(f.engine.getCloseSnapshot().uncertain,false);}finally{await f.cleanup();server.closeAllConnections();await bounded(new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())),'close server');assert.equal(server.listening,false);}
});
test('activation aborted after Host acceptance never publishes a capability or starts a run',check(async f=>{
 await f.ready();const d=f.hold(),c=new AbortController();f.filter(async(u,o,a)=>{await a(u,o);return d.promise;});const p=f.engine.activateCloseFence({signal:c.signal});for(let i=0;i<50&&fenceCalls(f).filter(x=>x.url.endsWith('/activate')).length===0;i++)await ticks();await ticks();c.abort();assert.equal((await p).error,'fence-aborted');d.resolve(json({}));await ticks();assert.equal(f.engine.getCloseSnapshot().uncertain,true);const n=f.calls.length;await f.engine.start();assert.equal(f.calls.length,n);assert.equal(f.host.sessions.length,0);
}));
test('throwing signal setup removes the owned deadline without any GET or POST',check(async f=>{
 const signal={aborted:false,addEventListener(){throw Error('private hook');},removeEventListener(){throw Error('private cleanup');}};const r=await f.engine.prepareCloseFence({signal});assert.equal(r.error,'fence-invalid-options');assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);
}));
test('dispose cancels a pending fence read and forbids later lifecycle admission',check(async f=>{
 await f.ready();const d=f.hold();f.filter(()=>d.promise);const p=f.engine.inspectCloseFence();f.engine.dispose();assert.equal((await p).error,'fence-disposed');const n=f.calls.length;assert.equal((await f.engine.prepareCloseFence()).error,'fence-disposed');await f.engine.start();assert.equal(f.calls.length,n);d.resolve(json({}));await ticks();assert.equal(f.state().state,'disposed');
}));
test('long deadlines stay capped and fence subscriptions are removable',check(async f=>{
 const d=f.hold();f.filter(()=>d.promise);const p=f.engine.prepareCloseFence({timeoutMs:999999});assert.ok([...f.timers.values()].every(t=>t.ms<=4000));let count=0;const off=f.engine.subscribeCloseFence(()=>count++);off();f.expire();await p;assert.equal(count,0);d.resolve(json(f.host.read()));await ticks();assert.equal(f.timers.size,0);
}));
