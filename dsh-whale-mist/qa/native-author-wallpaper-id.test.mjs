import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAuthorSwitches} from '../src/sidebar/native-appearance-sidebar.js';
import {createAuthorSchema} from '../src/wallpaper/author-properties-schema.js';
import {authorDefaults,validateAuthorValue} from '../src/wallpaper/author-properties-contract.js';
const B='we-'+'b'.repeat(24),C='we-'+'c'.repeat(24);
function rig(id=B,{empty=false}={}){
 let schema=createAuthorSchema({wallpaperId:id,type:'scene',contentRating:'Everyone',properties:empty?{}:{particles:{type:'bool',value:true,text:'Particles'}}});
 let revision=0,values=authorDefaults(schema),dirty=[],delivery='none',replyHook=null;const calls=[];
 const reply=()=>({ok:true,application:{available:true,targetActive:true},schema,draft:{revision,values:{...values},dirtyKeys:[...dirty],delivery:{state:delivery,revision}}});
 const api=createNativeAuthorSwitches({validateValue:validateAuthorValue,request:async(route,payload)=>{
  calls.push([route,payload]);if(replyHook)return replyHook(route,payload,reply);
  if(route==='draft'){values={...values,...payload.values};dirty=Object.keys(payload.values??{});revision++;delivery='not-sent';}
  if(route==='apply'){dirty=[];delivery='confirmed';return{...reply(),applySent:true,currentValuesKnown:false};}return reply();
 }});
 api.setContext('session-context',id);const token=Symbol('author');api.view(token,true);
 return{api,calls,setSchema(value){schema=value;},hook(fn){replyHook=fn;},dispose(){api.dispose();}};
}
async function run(id,options,fn){const f=rig(id,options);try{await fn(f);}finally{f.dispose();}}
test('non-Lucy schema read sends the context wallpaper id and accepts that schema',()=>run(B,{},async f=>{
 assert.equal((await f.api.ensureLoaded()).ok,true);assert.equal(f.calls[0][1].wallpaperId,B);assert.equal(f.api.read().fields.length,1);
}));
test('non-Lucy draft and apply remain bound to the same wallpaper',()=>run(B,{},async f=>{
 assert.equal((await f.api.load()).ok,true);assert.equal((await f.api.change('particles',false)).ok,true);
 assert.deepEqual(f.calls.map(([route,payload])=>[route,payload.wallpaperId]),[['schema',B],['draft',B],['apply',B]]);
}));
test('wrong-wallpaper success response cannot create editable fields',()=>run(B,{},async f=>{
 f.hook((_route,_payload,reply)=>({...reply(),schema:{...reply().schema,wallpaperId:C}}));assert.equal((await f.api.load()).ok,false);assert.equal(f.api.read().fields.length,0);assert.equal(f.api.read().canEdit,false);
}));
test('late B read cannot populate C even if the caller reuses a context key',()=>run(B,{},async f=>{
 let resolve;f.hook(()=>new Promise(r=>resolve=r));const read=f.api.load();await Promise.resolve();f.api.setContext('session-context',C);resolve({ok:false});await read;assert.equal(f.api.read().fields.length,0);assert.equal(f.api.read().phase,'idle');
}));
test('invalid wallpaper identity produces no request',()=>run(B,{},async f=>{
 f.api.setContext('invalid-context','../private');
 assert.equal((await f.api.load()).ok,false);assert.deepEqual(f.calls,[]);
}));
test('an empty supported declaration is a successful empty schema, not a read error',()=>run(B,{empty:true},async f=>{
 assert.equal((await f.api.load()).ok,true);assert.equal(f.api.read().fields.length,0);assert.equal(f.api.read().message,null);assert.equal(f.api.read().phase,'ready');
}));
