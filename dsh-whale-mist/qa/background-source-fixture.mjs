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
export async function rig({patch={},background='wallpaper',configure,missing=false}={}){
 const host=await hostRig(),calls=[],writes=[],timers=new Map(),effects=[],css=new Map();let mod,controller,id=0,hook=null,projectionHook=null,responseHook=null,mediaOff=null;
 const storage=new Map([[key,JSON.stringify({theme:'abyss',background,brightness:77,mask:23,blur:2,surface:65,weScene:'lucy',weMode:'daily',weAutoStart:false,...patch})],['unrelated','preserve'],['dsh-whale-mist.wallpaper-appearance-presets.v1','{"version":1,"entries":{}}']]);
 if(missing)storage.delete(key);
 const actualGet=k=>storage.get(k)??null,actualSet=(k,v)=>storage.set(k,String(v));
 const localStorage={getItem(k){return hook?hook('get',k,undefined,()=>actualGet(k)):actualGet(k);},setItem(k,v){writes.push([k,v]);return hook?hook('set',k,v,()=>actualSet(k,v)):actualSet(k,v);}};
 const set=(fn,ms)=>{const n=++id;timers.set(n,{fn,ms});return n;},clear=n=>timers.delete(n);
 const body={dataset:{},style:{setProperty(k,v){projectionHook?.(k,v);css.set(k,String(v));},removeProperty:k=>css.delete(k)},classList:{toggle(){},remove(){},contains(){return false;}}};
 const sandbox={console,AbortController,TextDecoder,Blob,URL,URLSearchParams,Uint8Array,ArrayBuffer,DataView,performance,crypto:{randomUUID},document:{hidden:false,body},localStorage,location:{search:''},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setTimeout:set,clearTimeout:clear,setInterval:set,clearInterval:clear,addEventListener(){},removeEventListener(){}};sandbox.window=sandbox;
 sandbox.fetch=async(url,options={})=>{calls.push({url,options});const r=await host.call(url.replace('/whale-wallpaper/',''),{method:options.method??'GET',body:options.body?JSON.parse(options.body):undefined,headers:options.headers});const response=new Response(JSON.stringify(r.payload),{status:r.code,headers:{'content-type':'application/json'}});return responseHook?responseHook(url,options,response):response;};
 configure?.(sandbox);sandbox.__ModuleLoader__={load:({factory})=>{mod=factory(()=>({}));}};vm.runInNewContext(source,sandbox,{timeout:1000});
 const ctx={effect(fn,label){effects.push({fn,label});return()=>{};},inject(){return{dispose:async()=>{}};},slots:{inject(_slot,fn){fn();},register(options){if(options.id==='whale-mist')controller=options.inject().controller;return()=>{};}},theme:{getTheme:()=>({active:{id:'whale-abyss'}})},on(){return()=>{};}};
 mod.apply(ctx);assert.ok(controller,'actual apply must register the controller');
 return{controller,host,calls,writes,storage,css,startMedia(){mediaOff??=effects.find(e=>e.label==='whale: local image and video background').fn();},expireImage(){for(const [n,t] of [...timers])if(t.ms<=6000){timers.delete(n);t.fn();}},transport:fn=>{responseHook=fn;},expire(){for(const [n,t] of [...timers])if(t.ms<=4000){timers.delete(n);t.fn();}},hook:fn=>{hook=fn;},projection:fn=>{projectionHook=fn;},get:()=>plain(controller.read()),stored:()=>JSON.parse(actualGet(key)),async ready(options){const p=await controller.prepareBackgroundClose(options);assert.equal(p.ok,true,p.error);const r=await controller.inspectBackgroundClose(options);assert.equal(r.ok,true,r.error);assert.ok(r.permit,'ready controller must mint its own opaque permit');return r.permit;},async check(options){const r=await controller.inspectBackgroundClose(options);assert.equal(r.ok,true,r.error);return r.permit;},commit:permit=>controller.commitBackgroundClose(permit),disposeController(){const off=effects.find(e=>e.label==='whale: controller lifetime').fn();off();controller.wallpaper.dispose();},async cleanup(){hook=null;projectionHook=null;mediaOff?.();controller.wallpaper.dispose();await host.cleanup();assert.equal(timers.size,0);}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};
