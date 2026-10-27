import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../src/client.js',import.meta.url),'utf8');
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const response=(payload={cleanup:{closed:true},active:false,activeSceneId:null,session:null},ok=true)=>({ok,json:async()=>payload});
function rig(){
 let mod;const timers=new Map();let timerId=0,time=1000;
 const setTimer=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clear=id=>timers.delete(id);
 const sandbox={console,AbortController,Blob,URL,Uint8Array,ArrayBuffer,DataView,performance,document:{hidden:false},setTimeout:setTimer,clearTimeout:clear,setInterval:setTimer,clearInterval:clear,addEventListener(){},removeEventListener(){}};
 sandbox.window=sandbox;sandbox.__ModuleLoader__={load:({factory})=>{mod=factory(()=>({}));}};
 vm.runInNewContext(source,sandbox,{timeout:1000});
 const calls=[],queue=[];
 const engine=mod.createWallpaperEngine({now:()=>time,fetchImpl:(url,options={})=>{
  if(url.endsWith('/stream')){const reader={read:()=>new Promise(resolve=>{if(options.signal?.aborted)resolve({done:true});else options.signal?.addEventListener('abort',()=>resolve({done:true}),{once:true});}),cancel:async()=>{},releaseLock(){}};return Promise.resolve({ok:true,body:{getReader:()=>reader}});}
  if(url.endsWith('/metrics'))return Promise.resolve({ok:true});
  if(url.endsWith('/status'))return Promise.resolve({ok:true,json:async()=>({available:true,active:false})});
  calls.push({url,body:JSON.parse(options.body)});const task=queue.shift();return task?task():Promise.resolve(response());
 }});
 return{engine,calls,timers,read:()=>engine.getCloseSnapshot(),waitForFrames(){time+=9000;for(const job of [...timers.values()])if(job.ms===500)job.fn();},queue:fn=>queue.push(fn),hold(){const d=deferred();queue.push(()=>d.promise);return d;},async close(){engine.dispose();await tick();assert.equal(timers.size,0);}};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const run=fn=>async()=>{const f=rig();try{await fn(f);}finally{await f.close();}};

test('fresh read is immutable stable and cannot authorize a source commit',run(async f=>{
 assert.equal(typeof f.engine.getCloseSnapshot,'function');const s=f.read();assert.equal(s,f.read());assert.equal(s.state,'unverified');assert.equal(s.pendingCount,0);assert.equal(s.canCommit,false);assert.equal(s.closedObserved,false);assert.equal(s.reason,'host-proof-unavailable');assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.pending));assert.deepEqual(f.calls,[]);
}));
test('synchronous reads and subscriptions perform no commands and release cleanly',run(async f=>{
 const seen=[];const off=f.engine.subscribeCloseState(s=>seen.push(s));for(let i=0;i<5;i++)f.read();assert.deepEqual(f.calls,[]);off();await f.engine.stop();assert.equal(seen.length,0);
}));
test('an admitted stop is recorded before its fetch settles',run(async f=>{
 const d=f.hold(),p=f.engine.stop();const s=f.read();assert.equal(s.state,'pending');assert.equal(s.pendingCount,1);assert.equal(s.pending[0].action,'stop');assert.equal(s.pending[0].compensating,false);assert.equal(s.canCommit,false);d.resolve(response());await p;assert.equal(f.read().pendingCount,0);assert.equal(f.read().state,'closed-observed');assert.equal(f.read().closedObserved,true);assert.equal(f.read().canCommit,false);
}));
test('two concurrent stops remain two unsettled records and stale success is not fresh evidence',run(async f=>{
 const a=f.hold(),p=f.engine.stop(),b=f.hold(),q=f.engine.stop();assert.equal(f.read().pendingCount,2);b.resolve(response());await q;assert.equal(f.read().pendingCount,1);assert.equal(f.read().closedObserved,false);a.resolve(response());await p;assert.equal(f.read().pendingCount,0);assert.equal(f.read().closedObserved,false);assert.equal(f.read().lastCommand.action,'stop');
}));
test('a later current stop can establish a local observation after all earlier commands drain',run(async f=>{
 const d=f.hold(),p=f.engine.stop();await f.engine.stop();d.resolve(response());await p;assert.equal(f.read().closedObserved,false);await f.engine.stop();assert.equal(f.read().closedObserved,true);assert.equal(f.read().pendingCount,0);
}));
test('a failed stop retains unconfirmed outcome without granting close permission',run(async f=>{
 f.queue(()=>Promise.resolve(response({cleanup:{closed:false},activeSceneId:'lucy'},false)));await f.engine.stop();assert.equal(f.read().state,'unverified');assert.equal(f.read().lastCommand.outcome,'unconfirmed');assert.equal(f.read().closedObserved,false);assert.equal(f.read().canCommit,false);
}));
test('missing cleanup is a legitimate no-proof observation rather than fabricated closure',run(async f=>{
 f.queue(()=>Promise.resolve(response({stopped:true,pending:false,active:false,session:null,cleanup:null})));await f.engine.stop();assert.equal(f.read().lastCommand.outcome,'no-proof');assert.equal(f.read().uncertain,false);assert.equal(f.read().closedObserved,false);assert.equal(f.read().canCommit,false);
}));
test('stale lastCleanup fallback does not replace a missing current cleanup proof',run(async f=>{
 f.queue(()=>Promise.resolve(response({lastCleanup:{closed:true},active:false})));await f.engine.stop();assert.equal(f.read().lastCommand.outcome,'no-proof');assert.equal(f.read().closedObserved,false);
}));
test('contradictory successful stop payloads cannot be observed as closed',run(async f=>{
 for(const patch of [{active:true},{active:'false'},{active:null},{activeSceneId:'lucy'},{session:{}},{pending:true},{pending:0},{failed:true},{failed:'false'},{cleanupPending:true},{cleanupPending:'false'},{activeSceneId:0}]){f.queue(()=>Promise.resolve(response({cleanup:{closed:true},active:false,activeSceneId:null,session:null,...patch})));await f.engine.stop();assert.equal(f.read().closedObserved,false,JSON.stringify(patch));assert.equal(f.read().lastCommand.outcome,'unconfirmed');}
}));
test('network failures latch unknown and do not expose raw exception details',run(async f=>{
 f.queue(()=>Promise.reject(Error('private path or command')));await f.engine.stop();assert.equal(f.read().state,'unknown');assert.equal(f.read().uncertain,true);assert.equal(f.read().pendingCount,0);assert.ok(!JSON.stringify(f.read()).includes('private'));await f.engine.stop();assert.equal(f.read().uncertain,true);assert.equal(f.read().closedObserved,false);
}));
test('sync transport throws and JSON parsing failures are tracked despite existing engine catches',run(async f=>{
 for(const fn of [()=>{throw Error('private sync');},()=>Promise.resolve({ok:true,json:async()=>{throw Error('private json');}})]){f.queue(fn);await f.engine.stop();assert.equal(f.read().uncertain,true);assert.equal(f.read().state,'unknown');assert.equal(f.read().pendingCount,0);}
}));
test('null arrays and scalars are malformed rather than no-session proof',run(async f=>{
 for(const payload of [null,[],true,'closed',0]){f.queue(()=>Promise.resolve(response(payload)));await f.engine.stop();assert.equal(f.read().lastCommand.outcome,'unknown');assert.equal(f.read().closedObserved,false);}
}));
test('start and restart share the same pending ledger and a busy rejection creates no phantom command',run(async f=>{
 const d=f.hold(),p=f.engine.start('lucy','daily');assert.equal(f.read().pending[0].action,'start');await f.engine.restart('lucy','daily');assert.equal(f.read().pendingCount,1);assert.equal(f.calls.length,1);d.resolve(response({active:true,activeSceneId:'lucy'}));await p;assert.equal(f.read().state,'active');await f.engine.stop();const e=f.hold(),q=f.engine.restart('lucy','daily');assert.equal(f.read().closedObserved,false);assert.equal(f.read().pending[0].action,'restart');e.resolve(response({active:true,activeSceneId:'lucy'}));await q;await f.engine.stop();
}));
test('held old start remains visible after a newer stop and its late compensation is explicitly recorded',run(async f=>{
 const d=f.hold(),p=f.engine.start('lucy','daily');await f.engine.stop();assert.equal(f.read().pendingCount,1);assert.equal(f.read().pending[0].action,'start');assert.equal(f.read().closedObserved,false);const e=f.hold();d.resolve(response({activeSceneId:'lucy'}));await tick();assert.equal(f.read().pendingCount,1);assert.equal(f.read().pending[0].action,'stop');assert.equal(f.read().pending[0].compensating,true);assert.equal(f.read().closedObserved,false);e.resolve(response());await p;assert.equal(f.read().lastCommand.compensating,true);assert.equal(f.read().closedObserved,false);assert.equal(f.calls.filter(c=>c.url.endsWith('/stop')).length,2);
}));
test('late rejected old start invalidates an earlier stop observation without inventing compensation',run(async f=>{
 const d=f.hold(),p=f.engine.start('lucy','daily');await f.engine.stop();d.resolve(response({error:'stopped'},false));await p;assert.equal(f.read().pendingCount,0);assert.equal(f.read().closedObserved,false);assert.equal(f.calls.filter(c=>c.url.endsWith('/stop')).length,1);
}));
test('late restart uses the same compensation accounting',run(async f=>{
 const d=f.hold(),p=f.engine.restart('lucy','daily');await f.engine.stop();d.resolve(response({activeSceneId:'lucy'}));await p;assert.equal(f.read().lastCommand.compensating,true);assert.equal(f.read().closedObserved,false);assert.equal(f.read().pendingCount,0);
}));
test('a running source waiting for frames stays active rather than looking idle or closed',run(async f=>{
 await f.engine.start('lucy','daily');f.waitForFrames();assert.equal(f.engine.getStatus().state,'waiting');assert.equal(f.read().state,'active');assert.equal(f.read().closedObserved,false);assert.equal(f.read().canCommit,false);await f.engine.stop();
}));
test('observer exceptions cannot change the original command outcome',run(async f=>{
 const off=f.engine.subscribeCloseState(()=>{throw Error('observer');});await f.engine.stop();off();assert.equal(f.engine.lastCleanup().closed,true);assert.equal(f.read().closedObserved,true);
}));
test('disposed engine rejects observation reuse and still accounts for late compensation',run(async f=>{
 const d=f.hold(),p=f.engine.start('lucy','daily'),seen=[];f.engine.subscribeCloseState(s=>seen.push(s));f.engine.dispose();const count=seen.length;assert.equal(f.read().state,'disposed');d.resolve(response({activeSceneId:'lucy'}));await p;assert.equal(f.read().state,'disposed');assert.equal(f.read().pendingCount,0);assert.equal(seen.length,count);assert.equal(f.read().canCommit,false);assert.equal(f.calls.filter(c=>c.url.endsWith('/stop')).length,1);
}));
test('bounded summaries do not retain completed command history or mutable payload references',run(async f=>{
 const payload={cleanup:{closed:true},active:false,activeSceneId:null,session:null};f.queue(()=>Promise.resolve(response(payload)));await f.engine.stop();const old=f.read();payload.cleanup.closed=false;assert.equal(old.closedObserved,true);for(let i=0;i<25;i++)await f.engine.stop();assert.equal(f.read().pending.length,0);assert.equal(f.read().lastCommand.id,26);assert.ok(Object.isFrozen(f.read().lastCommand));assert.equal(old.lastCommand.id,1);assert.equal(plain(f.read()).canCommit,false);
}));
