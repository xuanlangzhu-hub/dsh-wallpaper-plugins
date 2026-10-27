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

const source=await readFile(new URL('../src/client.js',import.meta.url),'utf8');
const key='dsh-whale-mist.appearance.v1';
const plain=value=>JSON.parse(JSON.stringify(value));
async function rig({patch={},background='wallpaper'}={}){
 const host=await hostRig(),calls=[],writes=[],timers=new Map(),effects=[],css=new Map();let mod,controller,id=0,hook=null,projectionHook=null;
 const storage=new Map([[key,JSON.stringify({theme:'abyss',background,brightness:77,mask:23,blur:2,surface:65,weScene:'lucy',weMode:'daily',weAutoStart:false,...patch})],['unrelated','preserve'],['dsh-whale-mist.wallpaper-appearance-presets.v1','{"version":1,"entries":{}}']]);
 const actualGet=k=>storage.get(k)??null,actualSet=(k,v)=>storage.set(k,String(v));
 const localStorage={getItem(k){return hook?hook('get',k,undefined,()=>actualGet(k)):actualGet(k);},setItem(k,v){writes.push([k,v]);return hook?hook('set',k,v,()=>actualSet(k,v)):actualSet(k,v);}};
 const set=(fn,ms)=>{const n=++id;timers.set(n,{fn,ms});return n;},clear=n=>timers.delete(n);
 const body={dataset:{},style:{setProperty(k,v){projectionHook?.(k,v);css.set(k,String(v));},removeProperty:k=>css.delete(k)},classList:{toggle(){},remove(){},contains(){return false;}}};
 const sandbox={console,AbortController,TextDecoder,Blob,URL,URLSearchParams,Uint8Array,ArrayBuffer,DataView,performance,crypto:{randomUUID},document:{hidden:false,body},localStorage,location:{search:''},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setTimeout:set,clearTimeout:clear,setInterval:set,clearInterval:clear,addEventListener(){},removeEventListener(){}};sandbox.window=sandbox;
 sandbox.fetch=async(url,options={})=>{calls.push({url,options});const r=await host.call(url.replace('/whale-wallpaper/',''),{method:options.method??'GET',body:options.body?JSON.parse(options.body):undefined,headers:options.headers});return new Response(JSON.stringify(r.payload),{status:r.code,headers:{'content-type':'application/json'}});};
 sandbox.__ModuleLoader__={load:({factory})=>{mod=factory(()=>({}));}};vm.runInNewContext(source,sandbox,{timeout:1000});
 const ctx={effect(fn,label){effects.push({fn,label});return()=>{};},inject(){return{dispose:async()=>{}};},slots:{inject(_slot,fn){fn();},register(options){if(options.id==='whale-mist')controller=options.inject().controller;return()=>{};}},theme:{getTheme:()=>({active:{id:'whale-abyss'}})},on(){return()=>{};}};
 mod.apply(ctx);assert.ok(controller,'actual apply must register the controller');
 return{controller,host,calls,writes,storage,css,hook:fn=>{hook=fn;},projection:fn=>{projectionHook=fn;},get:()=>plain(controller.read()),stored:()=>JSON.parse(actualGet(key)),async ready(options){const p=await controller.prepareBackgroundClose(options);assert.equal(p.ok,true,p.error);const r=await controller.inspectBackgroundClose(options);assert.equal(r.ok,true,r.error);assert.ok(r.permit,'ready controller must mint its own opaque permit');return r.permit;},async check(options){const r=await controller.inspectBackgroundClose(options);assert.equal(r.ok,true,r.error);return r.permit;},commit:permit=>controller.commitBackgroundClose(permit),disposeController(){const off=effects.find(e=>e.label==='whale: controller lifetime').fn();off();controller.wallpaper.dispose();},async cleanup(){hook=null;projectionHook=null;controller.wallpaper.dispose();await host.cleanup();assert.equal(timers.size,0);}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};

test('actual controller refuses unprepared forged or cross-controller close permission without IO',check(async f=>{
 const baseline=f.calls.length;assert.equal(typeof f.controller.commitBackgroundClose,'function');for(const p of [undefined,null,{},Object.freeze({version:1,id:1})])assert.equal(f.commit(p).error,'background-close-stale');assert.equal(f.calls.length,baseline);assert.equal(f.writes.length,0);
 const permit=await f.ready(),other=await rig();try{assert.equal(other.commit(permit).ok,false);assert.equal(f.commit({...permit}).ok,false);assert.equal(f.commit(permit).ok,true);}finally{await other.cleanup();}
}));
test('a verified close writes only background once and sends zero extra stop requests',check(async f=>{
 const permit=await f.ready(),settings=f.get(),stored=f.stored(),before=f.calls.length,extra=[...f.storage].filter(([k])=>k!==key);let notifications=0;const off=f.controller.subscribeSettings(()=>notifications++);
 const r=f.commit(permit);off();assert.deepEqual(plain(r),{ok:true,stage:'complete',value:'none',applied:true,persisted:'confirmed'});assert.deepEqual(f.get(),{...settings,background:'none'});assert.deepEqual(f.stored(),{...stored,background:'none'});assert.deepEqual([...f.storage].filter(([k])=>k!==key),extra);assert.equal(f.writes.length,1);assert.equal(f.calls.length,before);assert.equal(f.host.api.generation(),1);assert.equal(notifications,1);assert.equal(f.controller.wallpaper.running(),false);
 assert.equal(f.commit(permit).error,'background-close-stale');assert.equal(f.writes.length,1);assert.equal(f.calls.length,before);
}));
test('storage unknown fields survive the background-only patch',check(async f=>{
 const permit=await f.ready(),stored=f.stored();f.storage.set(key,JSON.stringify({...stored,extraMetadata:{revision:8,label:'future'}}));assert.equal(f.commit(permit).ok,true);assert.deepEqual(f.stored().extraMetadata,{revision:8,label:'future'});
}));
test('preference and selection round trips revoke the captured permission',check(async f=>{
 let permit=await f.ready();f.controller.set('brightness',80);f.controller.set('brightness',77);const n=f.writes.length;assert.equal(f.commit(permit).ok,false);assert.equal(f.writes.length,n);permit=await f.check();f.controller.set('weScene','we-'+(1).toString(16).padStart(24,'0'));f.controller.set('weScene','lucy');const m=f.writes.length;assert.equal(f.commit(permit).ok,false);assert.equal(f.writes.length,m);assert.equal(f.get().background,'wallpaper');
}));
test('a new explicit inspect revokes the old permission even with identical values',check(async f=>{
 const first=await f.ready(),second=await f.check(),n=f.calls.length;assert.notEqual(first,second);assert.equal(f.commit(first).ok,false);assert.equal(f.commit(second).ok,true);assert.equal(f.calls.length,n);
}));
test('external abort and disposal reject the original permission without writing',check(async f=>{
 const c=new AbortController(),p=await f.ready({signal:c.signal});c.abort();assert.equal(f.commit(p).ok,false);assert.equal(f.writes.length,0);const other=await rig();try{const q=await other.ready();other.disposeController();assert.equal(other.commit(q).error,'background-close-disposed');assert.equal(other.writes.length,0);}finally{await other.cleanup();}
}));
test('an intervening engine read cannot turn an old fence observation into a consumable proof',check(async f=>{
 const p=await f.ready();await f.controller.wallpaper.readHostCloseState();assert.equal(f.commit(p).ok,false);assert.equal(f.writes.length,0);assert.equal(f.commit(await f.check()).ok,true);
}));
test('a failed write before storage mutation retains wallpaper and consumes permission',check(async f=>{
 const p=await f.ready();f.hook((op,k,v,actual)=>{if(op==='set'&&k===key)throw Error('private quota details');return actual();});const r=f.commit(p);assert.equal(r.error,'background-storage-write');assert.equal(r.persisted,'unchanged');assert.equal(r.applied,false);assert.equal(f.get().background,'wallpaper');assert.equal(f.stored().background,'wallpaper');assert.equal(f.commit(p).ok,false);assert.ok(!JSON.stringify(r).includes('private'));f.hook(null);assert.equal(f.commit(await f.check()).ok,true);
}));
test('storage write then throw reports failure while publishing actual none',check(async f=>{
 const p=await f.ready();let seen;const off=f.controller.subscribeSettings(s=>{seen=s.background;});f.hook((op,k,v,actual)=>{const r=actual();if(op==='set'&&k===key)throw Error('private after write');return r;});const r=f.commit(p);off();assert.equal(r.error,'background-storage-write');assert.equal(r.value,'none');assert.equal(r.applied,true);assert.equal(r.persisted,'confirmed');assert.equal(seen,'none');assert.equal(f.get().background,'none');assert.equal(f.stored().background,'none');assert.equal(f.commit(p).ok,false);
}));
test('a silent dropped storage write is not success',check(async f=>{
 const p=await f.ready();f.hook((op,k,v,actual)=>op==='set'&&k===key?undefined:actual());const r=f.commit(p);assert.equal(r.error,'background-storage-unconfirmed');assert.equal(r.persisted,'unchanged');assert.equal(f.get().background,'wallpaper');
}));
test('unreadable storage does not substitute defaults into none',check(async f=>{
 const p=await f.ready();f.hook((op,k,v,actual)=>{if(op==='get'&&k===key)throw Error('private read');return actual();});const r=f.commit(p);assert.equal(r.error,'background-storage-unavailable');assert.equal(r.persisted,'unknown');assert.equal(f.get().background,'wallpaper');assert.equal(f.writes.length,0);assert.equal(f.commit(p).ok,false);
}));
test('unconfirmed readback can be recovered only by fresh explicit inspection without another write',check(async f=>{
 const p=await f.ready();let wrote=false;f.hook((op,k,v,actual)=>{if(k===key&&op==='get'&&wrote)throw Error('readback unavailable');const r=actual();if(k===key&&op==='set')wrote=true;return r;});const r=f.commit(p);assert.equal(r.error,'background-storage-unconfirmed');assert.equal(r.persisted,'unknown');assert.equal(f.get().background,'wallpaper');assert.equal(f.storage.has(key),true);f.hook(null);assert.equal(f.stored().background,'none');assert.equal(f.commit(p).ok,false);const writes=f.writes.length,posts=f.calls.length;const fresh=await f.check(),afterInspect=f.calls.length;assert.ok(afterInspect>posts);const recovered=f.commit(fresh);assert.equal(recovered.ok,true);assert.equal(recovered.stage,'recovered');assert.equal(f.get().background,'none');assert.equal(f.writes.length,writes);assert.equal(f.calls.length,afterInspect);
}));
test('external storage drift or malformed data is retained rather than overwritten',check(async f=>{
 await f.ready();for(const raw of ['null','[]','{bad',JSON.stringify({...f.stored(),brightness:111}),JSON.stringify({...f.stored(),background:'none'})]){
  const p=await f.check();f.storage.set(key,raw);const n=f.writes.length,r=f.commit(p);assert.equal(r.error,'background-storage-conflict');assert.equal(f.storage.get(key),raw);assert.equal(f.writes.length,n);f.storage.set(key,JSON.stringify(f.get()));
 }
}));
test('projection failure still publishes the persisted current source',check(async f=>{
 const p=await f.ready();f.projection(()=>{throw Error('private css');});let seen;const off=f.controller.subscribeSettings(s=>{seen=s.background;});const r=f.commit(p);off();assert.equal(r.error,'background-projection-failed');assert.equal(r.applied,true);assert.equal(r.persisted,'confirmed');assert.equal(r.value,'none');assert.equal(seen,'none');assert.equal(f.controller.getSettingsSnapshot().background,'none');assert.equal(f.stored().background,'none');assert.equal(f.writes.length,1);
}));
test('a storage-read reentrant newer preference prevents the stale write',check(async f=>{
 const p=await f.ready();let once=false;f.hook((op,k,v,actual)=>{if(!once&&op==='get'&&k===key){once=true;f.controller.set('brightness',90);}return actual();});const r=f.commit(p);assert.equal(r.error,'background-close-stale');assert.equal(f.get().brightness,90);assert.equal(f.get().background,'wallpaper');assert.equal(f.writes.length,1);assert.equal(f.stored().brightness,90);
}));
test('reentrant settings notification preserves the newer choice without rollback',check(async f=>{
 const p=await f.ready();let once=false;const off=f.controller.subscribeSettings(()=>{if(!once){once=true;f.controller.set('brightness',90);}});const r=f.commit(p);off();assert.equal(r.error,'background-close-stale');assert.equal(r.stage,'superseded');assert.equal(r.value,'none');assert.equal(f.get().brightness,90);assert.equal(f.stored().brightness,90);assert.equal(f.get().background,'none');assert.equal(f.writes.length,2);
}));
test('another close attempt from a storage hook cannot replay an already consumed permit',check(async f=>{
 const p=await f.ready();let attempted=false,inner;f.hook((op,k,v,actual)=>{if(op==='set'&&k===key&&!attempted){attempted=true;inner=f.commit(p);}return actual();});assert.equal(f.commit(p).ok,true);assert.equal(inner.error,'background-close-stale');assert.equal(f.writes.length,1);
}));
test('none image and video sources never receive a wallpaper-close permit',async()=>{
 for(const background of ['none','image','video']){const f=await rig({background});try{await f.controller.prepareBackgroundClose();const r=await f.controller.inspectBackgroundClose();assert.equal(r.ok,true);assert.equal(r.permit,undefined);assert.equal(f.commit({version:1,id:1}).ok,false);assert.equal(f.get().background,background);assert.equal(f.writes.length,0);}finally{await f.cleanup();}}
});
test('pending and unconfirmed Host closure never mint commit permission',check(async f=>{
 const gate=f.host.gate();f.host.next({stopGate:gate,closeResult:{closed:false}});await f.host.start();const p=await f.controller.prepareBackgroundClose();assert.equal(p.permit,undefined);assert.equal(f.commit(p.permit).ok,false);gate.release();await ticks();const r=await f.controller.inspectBackgroundClose();assert.equal(r.snapshot.state,'unconfirmed');assert.equal(r.permit,undefined);assert.equal(f.writes.length,0);
}));
test('engine proof consumption is identity-bound and cannot be replayed via a controller permit',check(async f=>{
 const p=await f.ready(),proof=f.controller.wallpaper.getCloseFenceSnapshot();assert.equal(f.controller.wallpaper.consumeCloseFence({...proof}),false);assert.equal(f.controller.wallpaper.consumeCloseFence(proof),true);assert.equal(f.controller.wallpaper.consumeCloseFence(proof),false);assert.equal(f.commit(p).ok,false);assert.equal(f.writes.length,0);
}));
test('a newer protocol invocation prevents an older completion from reinstalling a permit',check(async f=>{
 await f.controller.prepareBackgroundClose();let next,once=false;const off=f.controller.wallpaper.subscribeCloseFence(s=>{if(!once&&s.state==='ready'){once=true;next=f.controller.inspectBackgroundClose();}});const r=await f.controller.inspectBackgroundClose();off();if(next)assert.equal((await next).error,'fence-busy');assert.equal(r.permit,undefined);assert.equal(f.writes.length,0);assert.equal(f.commit(await f.check()).ok,true);
}));
test('a newer choice immediately after the actual write is retained in memory and storage',check(async f=>{
 const p=await f.ready();let once=false;f.hook((op,k,v,actual)=>{const r=actual();if(!once&&op==='set'&&k===key){once=true;f.controller.set('brightness',90);}return r;});const r=f.commit(p);assert.equal(r.error,'background-close-stale');assert.equal(f.get().brightness,90);assert.equal(f.stored().brightness,90);assert.equal(f.get().background,'wallpaper');assert.equal(f.stored().background,'wallpaper');
}));
test('unknown-save recovery is not reused after newer settings have replaced its context',check(async f=>{
 const p=await f.ready();let wrote=false;f.hook((op,k,v,actual)=>{if(op==='get'&&k===key&&wrote)throw Error('readback');const r=actual();if(op==='set'&&k===key)wrote=true;return r;});assert.equal(f.commit(p).persisted,'unknown');f.hook(null);f.controller.set('brightness',90);const fresh=await f.check(),r=f.commit(fresh);assert.equal(r.ok,true);assert.equal(r.stage,'complete');assert.equal(f.get().brightness,90);assert.equal(f.stored().brightness,90);
}));
test('a consumed failed-save proof cannot reactivate without a fresh explicit inspection',check(async f=>{
 const p=await f.ready();f.hook((op,k,v,actual)=>{if(op==='set'&&k===key)throw Error('quota');return actual();});assert.equal(f.commit(p).ok,false);f.hook(null);const n=f.calls.length;assert.equal((await f.controller.activateBackgroundSource()).error,'fence-not-ready');assert.equal(f.calls.length,n);assert.equal((await f.controller.inspectBackgroundClose()).ok,true);assert.equal((await f.controller.activateBackgroundSource()).ok,true);assert.equal(f.get().background,'wallpaper');assert.equal(f.host.sessions.length,0);
}));
