import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createAuthorPropertiesHost} from '../src/wallpaper/author-properties-host.js';

const initial=()=>({authorized:true,owner:'main:1',selectedId:'lucy',revision:1,allowedRatings:['Everyone'],lifecycle:{generation:4,activeSceneId:'lucy',location:'WhaleWallpaperProbe-offline-context-1',cleanupPending:false,busy:false}});
async function invoke(host,method='GET',body){
  const req=Object.assign(new EventEmitter(),{method,url:method==='GET'?'/api/author-properties/schema?wallpaperId=lucy':body.values?'/api/author-properties/draft':'/api/author-properties/apply',headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}});
  const res=Object.assign(new EventEmitter(),{headersSent:false,writableEnded:false,setHeader(){},writeHead(code){this.code=code;this.headersSent=true;},end(value){this.body=JSON.parse(value);this.writableEnded=true;}});
  await host.handler(req,res);return res.body;
}
async function fixture(){
  const context=initial();let gate=null,entered,commands=0;
  const host=createAuthorPropertiesHost({root:'/api/author-properties',readContext:()=>context,library:{getAuthorMetadata:async()=>{if(gate){entered();await gate;}return{wallpaperId:'lucy',type:'scene',contentRating:'Everyone',properties:{particles:{type:'bool',value:true}}};}},applyAdapter:{canApply:()=>true,busy:()=>false,dispose:async()=>({ok:true}),apply:async(_plan,hooks)=>{hooks.check();await hooks.validate();hooks.check();commands++;return{ok:true,sent:true};}}});
  const first=await invoke(host);assert.equal(first.ok,true);
  return{host,context,payload:{wallpaperId:'lucy',schemaFingerprint:first.schema.fingerprint,expectedRevision:0},get commands(){return commands;},block(){let release;gate=new Promise(resolve=>release=resolve);const started=new Promise(resolve=>entered=resolve);return{started,release:()=>{gate=null;release();}};}};
}
const changes={
  revisionOnly:c=>c.revision++,
  selected:c=>c.selectedId='we-aaaaaaaaaaaaaaaaaaaaaaaa',
  owner:c=>c.owner='main:2',
  ratings:c=>c.allowedRatings=['Everyone','Mature'],
  revoked:c=>c.authorized=false,
  generation:c=>c.lifecycle.generation++,
  location:c=>c.lifecycle.location='WhaleWallpaperProbe-offline-context-2',
  activeScene:c=>c.lifecycle.activeSceneId=null,
  stopping:c=>c.lifecycle.cleanupPending=true,
  busy:c=>c.lifecycle.busy=true,
};
for(const stage of ['save','apply'])for(const [change,mutate] of Object.entries(changes))test(stage+': '+change,{timeout:2500},async()=>{
  const f=await fixture();let blocked;
  try{
    if(stage==='apply'){const saved=await invoke(f.host,'POST',{...f.payload,values:{particles:false}});assert.equal(saved.ok,true);f.payload.expectedRevision=1;}
    blocked=f.block();const pending=invoke(f.host,'POST',{...f.payload,...(stage==='save'?{values:{particles:false}}:{})});
    await blocked.started;mutate(f.context);blocked.release();const reply=await pending;
    if(change==='revisionOnly'){assert.equal(reply.ok,true);if(stage==='apply')assert.equal(reply.applySent,true);}
    else{assert.equal(reply.ok,false);assert.equal(f.commands,0);}
  }finally{blocked?.release();await f.host.dispose();}
});
