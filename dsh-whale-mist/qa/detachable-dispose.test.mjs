// Offline production-client/Host checks; no browser, DSH, native process or model calls.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
function createMockAppearanceController(){return {read:()=>({brightness:70,mask:40}),subscribeSettings:()=>()=>{}};}
const target=process.env.DISPOSE_TARGET ? resolve(process.env.DISPOSE_TARGET) : fileURLToPath(new URL('../',import.meta.url));
const {createMainRendererBridgeClient}=await import(pathToFileURL(resolve(target,'src/detachable-contract.js')));
const {createDetachableHttpHost}=await import(pathToFileURL(resolve(target,'src/detachable-host.js')));
const nativeFetch=globalThis.fetch;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function bounded(p,ms=4500){let t;try{return await Promise.race([p,new Promise((_,rej)=>t=setTimeout(()=>rej(Error('test deadline')),ms))]);}finally{clearTimeout(t);}}
async function until(fn,ms=800){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('condition deadline');await delay(5);}}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
function client(){return createMainRendererBridgeClient({baseUrl:'http://127.0.0.1:1',mainToken:'fixture-token',instanceId:'fixture-instance',controller:createMockAppearanceController()});}
function check(name,fn){test(name,{timeout:6000},async()=>{try{await fn();}finally{globalThis.fetch=nativeFetch;}});}

check('concurrent and repeated dispose share the same pending success',async()=>{
 const gate=deferred();let posts=0;globalThis.fetch=async()=>{posts++;await gate.promise;return response({ok:true});};
 const c=client();const p=c.dispose(),q=c.dispose();let early=false;q.then(()=>early=true);await delay(20);
 try{assert.equal(early,false,'second caller cannot declare early success');}finally{gate.resolve();}
 assert.equal(p,q,'one promise per instance');
 assert.deepEqual(await bounded(p),{ok:true});assert.deepEqual(await bounded(q),{ok:true});assert.deepEqual(await c.dispose(),{ok:true});assert.equal(posts,1);
});
check('repeated dispose retains failure rather than manufactured success',async()=>{
 globalThis.fetch=async()=>response({ok:false,error:'fixture-cleanup-unconfirmed'});
 const c=client();const a=await c.dispose();assert.equal(a.ok,false);assert.deepEqual(await c.dispose(),a);
});
for(const [name,impl] of [
 ['network rejection',async()=>{throw Error('fixture-network');}],
 ['invalid JSON',async()=>({ok:true,status:200,json:async()=>{throw Error('fixture-json');}})],
 ['missing acknowledgement',async()=>response({})],
 ['nonboolean acknowledgement',async()=>response({ok:'yes'})],
 ['non2xx pretending success',async()=>response({ok:true},503)],
 ['null acknowledgement',async()=>response(null)],
])check(name+' is not success',async()=>{globalThis.fetch=impl;assert.equal((await bounded(client().dispose())).ok,false);});
check('real unauthorized reply is retained',async()=>{globalThis.fetch=async()=>response({ok:false,error:'unauthorized-main-token'},401);assert.equal((await client().dispose()).error,'unauthorized-main-token');});
for(const [name,impl] of [
 ['fetch ignores abort',async()=>new Promise(()=>{})],
 ['body never finishes',async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})],
])check(name+' still has finite production deadline',async()=>{
 globalThis.fetch=impl;const c=client();const start=Date.now();const result=await bounded(c.dispose(),4000);
 assert.equal(result.ok,false);assert.ok(Date.now()-start<3900);assert.deepEqual(await c.dispose(),result);
});
check('disposed client refuses a new connect without network or stream',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return response({ok:true,generation:7});};
 const c=client();await c.dispose();const before=calls;const result=await c.connect();assert.equal(result.ok,false);assert.equal(calls,before);
});
check('in-flight connect cannot restore SSE after dispose',async()=>{
 const gate=deferred();let streams=0;globalThis.fetch=async(url)=>{
  const path=new URL(url).pathname;if(path.endsWith('/connect')){await gate.promise;return response({ok:true,generation:9});}
  if(path.endsWith('/actions')){streams++;return response({});}return response({ok:false,error:'unauthorized-main-token'},401);
 };
 const c=client();const connecting=c.connect();await c.dispose();gate.resolve();const connected=await bounded(connecting);assert.equal(connected.ok,false);assert.equal(streams,0);
});

async function withHost(fn,windowAdapter=null){
 const host=createDetachableHttpHost({port:0,mainToken:randomUUID(),windowAdapter,edgePath:'C:\\isolated-fixture\\msedge.exe',profileDir:'C:\\isolated-fixture\\profile'});let c;
 await bounded(host.start(),1000);
 const base=host.getBaseUrl(),id=randomUUID(),token=host.getMainToken();
 c=createMainRendererBridgeClient({baseUrl:base,instanceId:id,mainToken:token,controller:createMockAppearanceController()});
 try{assert.equal((await bounded(c.connect(),1500)).ok,true);await until(()=>host.getMainSession()?.actionsSseRes);await fn({host,c,base,id,token});}
 finally{globalThis.fetch=nativeFetch;await bounded(host.stop(),2000);}
}
check('real Host: delayed POST preserves SSE until authenticated disconnect',async()=>withHost(async({host,c})=>{
 let sessionRetained;
 globalThis.fetch=async(url,opts={})=>{
  if(new URL(String(url)).pathname==='/api/main/disconnect'){
   await delay(150);sessionRetained=Boolean(host.getMainSession());
  }
  return nativeFetch(url,{...opts,signal:opts.signal||AbortSignal.timeout(1500)});
 };
 const result=await bounded(c.dispose());assert.equal(sessionRetained,true,'client must retain SSE until POST');assert.equal(result.ok,true);assert.equal(host.getMainSession(),null);assert.equal(host.getActiveSession(),null);
}));
check('real Host: concurrent dispose waits for one confirmed POST',async()=>withHost(async({host,c})=>{
 let count=0;globalThis.fetch=async(url,opts={})=>{if(new URL(String(url)).pathname.endsWith('/disconnect')){count++;await delay(30);}return nativeFetch(url,opts);};
 const result=await Promise.all([c.dispose(),c.dispose(),c.dispose()]);assert.ok(result.every(x=>x.ok===true));assert.equal(count,1);assert.equal(host.getMainSession(),null);
}));
check('real Host: stale client dispose cannot revoke replacement generation',async()=>withHost(async({host,c,base,id,token})=>{
 const res=await nativeFetch(base+'/api/main/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId:id,mainToken:token,snapshot:{}}),signal:AbortSignal.timeout(1000)});
 const registration=await res.json();assert.equal(registration.ok,true);const generation=host.getMainSession().generation;
 const result=await c.dispose();assert.equal(result.ok,false);assert.equal(result.error,'unauthorized-generation');assert.equal(host.getMainSession().generation,generation);
}));
check('real Host: transport already lost remains explicit failure',async()=>withHost(async({host,c})=>{
 host.getMainSession().actionsSseRes.destroy();await until(()=>!host.getMainSession());
 const result=await c.dispose();assert.equal(result.ok,false);assert.equal(result.error,'unauthorized-main-token');assert.deepEqual(await c.dispose(),result);
}));
check('real Host: wrong token rejected without losing active session',async()=>withHost(async({host,base,id})=>{
 const res=await nativeFetch(base+'/api/main/disconnect',{method:'POST',headers:{'X-Whale-Main-Token':'wrong','Content-Type':'application/json'},body:JSON.stringify({instanceId:id,generation:1}),signal:AbortSignal.timeout(1000)});
 assert.equal(res.status,401);assert.ok(host.getMainSession());
}));
check('real Host and IO substitute: dispose waits for owned cleanup',async()=>{
 const gate=deferred();let entered=false,closed=0;const handle={fixture:'owned-handle'};
 const adapter={spawn:async()=>handle,close:async h=>{assert.equal(h,handle);closed++;entered=true;await gate.promise;return {ok:true};}};
 await withHost(async({host,c})=>{
  assert.equal((await c.requestDetach()).ok,true);const p=c.dispose(),q=c.dispose();let early=false;q.then(()=>early=true);
  try{await until(()=>entered);await delay(30);assert.equal(early,false);assert.equal(host.getActiveOwnedHandle(),handle);}finally{gate.resolve();}
  assert.equal((await bounded(p)).ok,true);assert.equal((await q).ok,true);assert.equal(closed,1);assert.equal(host.getActiveOwnedHandle(),null);
 },adapter);
});
check('real Host and IO substitute: failed cleanup acknowledgement is retained',async()=>{
 let allowClose=false;const handle={fixture:'owned-failed-handle'};
 const adapter={spawn:async()=>handle,close:async()=>allowClose?{ok:true}:{ok:false,error:'fixture-resource-still-alive'}};
 await withHost(async({host,c})=>{
  try{
   assert.equal((await c.requestDetach()).ok,true);const a=await c.dispose();assert.equal(a.ok,false);assert.equal(a.error,'fixture-resource-still-alive');assert.deepEqual(await c.dispose(),a);
   assert.equal(host.getActiveOwnedHandle(),handle);assert.equal(host.hasUnconfirmedCleanup(),true);assert.notEqual(c.getMode(),'docked');
  }finally{allowClose=true;}
 },adapter);
});
check('real Host: connect arriving after dispose cannot leave an orphan session',async()=>{
 const host=createDetachableHttpHost({port:0,mainToken:randomUUID()});const gate=deferred();let c;
 await bounded(host.start(),1000);const base=host.getBaseUrl();
 globalThis.fetch=async(url,opts={})=>{if(new URL(String(url)).pathname.endsWith('/connect'))await gate.promise;return nativeFetch(url,{...opts,signal:opts.signal||AbortSignal.timeout(1500)});};
 try{
  c=createMainRendererBridgeClient({baseUrl:base,mainToken:host.getMainToken(),instanceId:randomUUID(),controller:createMockAppearanceController()});
  const connecting=c.connect();const disposed=await bounded(c.dispose());assert.equal(disposed.ok,false);gate.resolve();
  const late=await bounded(connecting);assert.equal(late.ok,false);assert.equal(host.getMainSession(),null,'late registration must be explicitly cleaned');
 }finally{gate.resolve();globalThis.fetch=nativeFetch;await bounded(host.stop(),2000);}
});
check('real Host: late connect cleanup cannot revoke a replacement session',async()=>{
 const host=createDetachableHttpHost({port:0,mainToken:randomUUID()});const gate=deferred(),registered=deferred();
 await bounded(host.start(),1000);const base=host.getBaseUrl(),token=host.getMainToken(),id=randomUUID();
 globalThis.fetch=async(url,opts={})=>{
  const res=await nativeFetch(url,{...opts,signal:opts.signal||AbortSignal.timeout(1500)});
  if(new URL(String(url)).pathname.endsWith('/connect')){registered.resolve();await gate.promise;}return res;
 };
 try{
  const c=createMainRendererBridgeClient({baseUrl:base,mainToken:token,instanceId:id,controller:createMockAppearanceController()});const connecting=c.connect();await bounded(registered.promise,1000);
  await c.dispose();
  const res=await nativeFetch(base+'/api/main/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId:'replacement',mainToken:token,snapshot:{}}),signal:AbortSignal.timeout(1000)});assert.equal((await res.json()).ok,true);
  const generation=host.getMainSession().generation;gate.resolve();const late=await bounded(connecting);assert.equal(late.ok,false);assert.equal(host.getMainSession().generation,generation);assert.equal(host.getMainSession().instanceId,'replacement');
 }finally{gate.resolve();globalThis.fetch=nativeFetch;await bounded(host.stop(),2000);}
});
check('synchronous unsubscribe reentry shares one teardown',async()=>{
 let c,reentered,calls=0,unsubscribed=0;const controller=createMockAppearanceController();
 controller.subscribeSettings=()=>()=>{unsubscribed++;reentered=c.dispose();};
 globalThis.fetch=async()=>{calls++;return response({ok:true});};
 c=createMainRendererBridgeClient({baseUrl:'http://127.0.0.1:1',mainToken:'fixture-token',instanceId:'fixture-instance',controller});
 const p=c.dispose();assert.equal((await p).ok,true);assert.equal(reentered,p);assert.equal(calls,1);assert.equal(unsubscribed,1);
});
check('late malformed generation cannot guess a cleanup credential',async()=>{
 const gate=deferred();let disconnects=0;
 globalThis.fetch=async(url)=>{if(new URL(url).pathname.endsWith('/connect')){await gate.promise;return response({ok:true});}disconnects++;return response({ok:false,error:'unauthorized-main-token'},401);};
 const c=client();const p=c.connect();await c.dispose();gate.resolve();const late=await bounded(p);assert.equal(late.ok,false);assert.equal(late.cleanup?.ok,false);assert.equal(disconnects,1);
});
