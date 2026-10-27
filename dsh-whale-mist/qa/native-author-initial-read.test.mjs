import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAuthorSwitches,createNativeAuthorTextEditor} from '../src/sidebar/native-appearance-sidebar.js';
import {createAuthorSchema} from '../src/wallpaper/author-properties-schema.js';
import {authorDefaults,validateAuthorValue} from '../src/wallpaper/author-properties-contract.js';

const flush=async()=>{for(let i=0;i<36;i++)await Promise.resolve();};
function rig(){
 const schemas=[0,1].map(v=>createAuthorSchema({wallpaperId:'lucy',type:'scene',contentRating:'Everyone',properties:{particles:{type:'bool',value:true,text:'Particles'},speed:{type:'slider',value:v+2,min:0,max:5,text:'Speed'},caption:{type:'textinput',value:'seed',text:v?'Caption v2':'Caption'}}}));
 let version=0,recordVersion=0,revision=0,dirty=[],delivery='none',values=authorDefaults(schemas[0]),active=0,peak=0,serial=0;
 const calls=[],commands=[],jobs=new Map(),hooks={},holds=[],editors=[];
 const timers={setTimeout(fn,ms){assert.ok([4000,12000].includes(ms));jobs.set(++serial,fn);return serial;},clearTimeout:n=>jobs.delete(n),fire(){for(const [n,fn]of [...jobs]){jobs.delete(n);fn();}}};
 const response=()=>{const stale=version!==recordVersion;return {ok:true,schema:structuredClone(schemas[version]),application:{available:true,busy:false,targetActive:true},draft:{revision,stale,values:stale?null:{...values},dirtyKeys:stale?[]:[...dirty],delivery:{revision,state:delivery},...(stale?{staleRecord:{schemaFingerprint:schemas[recordVersion].fingerprint,revision,keys:[...dirty],labels:dirty.map(key=>schemas[recordVersion].fields.find(f=>f.key===key).label),delivery:{revision,state:delivery}}}:{})}};};
 const api=createNativeAuthorSwitches({timers,validateValue:validateAuthorValue,request:async(route,payload,{signal})=>{
   calls.push({route,payload,signal});active++;peak=Math.max(peak,active);
   try{if(hooks[route])return await hooks[route](payload,signal);
     if(route==='draft'){
       assert.equal(payload.expectedRevision,revision);assert.equal(payload.schemaFingerprint,schemas[version].fingerprint);
       if(payload.action==='refresh-schema'){assert.equal(dirty.length,0);recordVersion=version;values=authorDefaults(schemas[version]);revision++;delivery='none';return {...response(),refreshed:true,mutation:'refresh-schema',currentValuesKnown:false};}
       revision++;values={...values,...payload.values};dirty=Object.keys(payload.values);delivery='not-sent';
     }
     if(route==='apply'){commands.push(Object.fromEntries(dirty.map(k=>[k,values[k]])));dirty=[];delivery='confirmed';return {...response(),applySent:true,currentValuesKnown:false};}
     return response();
   }finally{active--;}
 }});
 api.setContext('lucy-generation-1');api.view('one',true);
 return {api,calls,commands,jobs,hooks,timers,response,schemas,get peak(){return peak;},get recordVersion(){return recordVersion;},version:n=>version=n,
   seed(state='not-sent'){dirty=['particles'];delivery=state;revision++;values.particles=false;},
   hold(route='schema'){let resolve;const promise=new Promise(r=>resolve=r);const gate={promise,resolve};holds.push(gate);hooks[route]=()=>promise;return gate;},
   editor(){const field=api.read().fields.find(f=>f.key==='caption'),editor=createNativeAuthorTextEditor({author:api,field,view:'one',isCurrent:()=>true});editors.push(editor);return editor;},
   async dispose(){for(const editor of editors)editor.dispose();api.dispose();for(const hold of holds)hold.resolve(response());await flush();assert.equal(jobs.size,0);assert.equal(active,0);}
 };
}
async function run(fn){const f=rig();try{await fn(f);}finally{await f.dispose();}}

test('initial ensure performs one schema read per context and never saves or applies defaults',()=>run(async f=>{
 assert.equal(f.calls.length,0);assert.equal((await f.api.ensureLoaded()).ok,true);await flush();assert.deepEqual(f.calls.map(c=>c.route),['schema']);
 assert.deepEqual(f.calls[0].payload,{wallpaperId:'lucy'});assert.equal(f.api.read().phase,'ready');assert.equal(f.api.read().fields.length,3);assert.deepEqual(f.commands,[]);
 for(let i=0;i<8;i++)await f.api.ensureLoaded();f.api.view('one',false);f.api.view('one',true);await f.api.ensureLoaded();assert.equal(f.calls.length,1);
}));
test('two visible views share one pending initial request and one physical lane',()=>run(async f=>{
 const gate=f.hold();f.api.view('two',true);const first=f.api.ensureLoaded();const second=f.api.ensureLoaded();await flush();assert.equal((await second).ok,false);assert.equal(f.calls.length,1);assert.equal(f.api.read().busy,true);
 gate.resolve(f.response());await first;await flush();assert.equal(f.peak,1);assert.equal(f.api.read().phase,'ready');
}));
test('hidden absent or disposed contexts never start initial IO',()=>run(async f=>{
 f.api.view('one',false);await f.api.ensureLoaded();f.api.setContext(null);f.api.view('one',true);await f.api.ensureLoaded();f.api.dispose();await f.api.ensureLoaded();assert.equal(f.calls.length,0);
}));
test('an explicit manual read wins the same-tick race and consumes first-read eligibility',()=>run(async f=>{
 const first=f.api.load();await f.api.ensureLoaded();await first;await f.api.ensureLoaded();assert.deepEqual(f.calls.map(c=>c.route),['schema']);
}));
test('failed initial read stays blocked without automatic retry and explicit retry still works',()=>run(async f=>{
 f.hooks.schema=()=>({ok:false,error:'offline'});assert.equal((await f.api.ensureLoaded()).ok,false);await flush();assert.equal(f.api.read().phase,'blocked');
 for(let i=0;i<8;i++)await f.api.ensureLoaded();assert.equal(f.calls.length,1);delete f.hooks.schema;assert.equal((await f.api.load()).ok,true);await flush();assert.equal(f.calls.length,2);assert.deepEqual(f.commands,[]);
}));
test('malformed read cannot turn into defaults, a retry loop or a property call',()=>run(async f=>{
 f.hooks.schema=()=>({...f.response(),schema:{...f.response().schema,fingerprint:'bad'}});await f.api.ensureLoaded();await f.api.ensureLoaded();assert.equal(f.api.read().fields.length,0);assert.equal(f.calls.length,1);assert.deepEqual(f.commands,[]);
}));
test('clean stale record is inspected but only explicit manual read may refresh it',()=>run(async f=>{
 f.version(1);assert.equal((await f.api.ensureLoaded()).ok,false);assert.match(f.api.read().message,/手动重新读取/);assert.equal(f.recordVersion,0);assert.equal(f.api.read().canEdit,false);
 assert.deepEqual(f.calls.map(c=>c.route),['schema']);await f.api.ensureLoaded();assert.equal(f.calls.length,1);
 assert.equal((await f.api.load()).ok,true);await flush();assert.deepEqual(f.calls.map(c=>c.route),['schema','schema','draft']);assert.equal(f.calls[2].payload.action,'refresh-schema');assert.equal(f.recordVersion,1);assert.deepEqual(f.commands,[]);
}));
for(const delivery of ['not-sent','unknown','pending'])test(`stale ${delivery} record remains reviewable and never gets refreshed or replayed`,()=>run(async f=>{
 f.seed(delivery);f.version(1);await f.api.ensureLoaded();assert.equal(f.api.read().recovery.stale,true);assert.deepEqual(f.api.read().recovery.keys,['particles']);assert.equal(f.api.read().canEdit,false);assert.equal(f.recordVersion,0);
 await f.api.ensureLoaded();assert.deepEqual(f.calls.map(c=>c.route),['schema']);assert.deepEqual(f.commands,[]);
}));
test('current dirty records are shown as recovery without save discard reset or apply',()=>run(async f=>{
 f.seed();await f.api.ensureLoaded();assert.equal(f.api.read().phase,'blocked');assert.equal(f.api.read().recovery.own,false);assert.deepEqual(f.api.read().recovery.keys,['particles']);
 assert.equal((await f.api.change('particles',true)).ok,false);await f.api.ensureLoaded();assert.deepEqual(f.calls.map(c=>c.route),['schema']);assert.deepEqual(f.commands,[]);
}));
test('ensure never cancels an unfinished text editor or rereads over it',()=>run(async f=>{
 await f.api.load();const editor=f.editor();assert.equal(editor.focus(),true);editor.input('unsent');const before=f.calls.length;await f.api.ensureLoaded();assert.equal(f.api.read().editing,true);assert.equal(editor.read().text,'unsent');assert.equal(f.calls.length,before);assert.deepEqual(f.commands,[]);
}));
test('read timeout settles the UI but keeps a reader ignoring abort in its physical lane',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.timers.fire();assert.equal((await pending).ok,false);assert.equal(f.calls[0].signal.aborted,true);assert.equal(f.api.read().canRead,false);
 await f.api.ensureLoaded();assert.equal(f.calls.length,1);gate.resolve(f.response());await flush();assert.equal(f.api.read().canRead,true);assert.equal(f.api.read().fields.length,0);await f.api.ensureLoaded();assert.equal(f.calls.length,1);
}));
test('hiding the last view aborts and drops late results without a reopen retry',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.api.view('one',false);await pending;f.api.view('one',true);gate.resolve(f.response());await flush();assert.equal(f.api.read().fields.length,0);assert.equal(f.api.read().phase,'blocked');await f.api.ensureLoaded();assert.equal(f.calls.length,1);
}));
test('new generation waits for old physical settlement and then gets exactly one fresh read',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.api.setContext('lucy-generation-2');await pending;await f.api.ensureLoaded();assert.equal(f.calls.length,1);
 gate.resolve(f.response());await flush();delete f.hooks.schema;assert.equal((await f.api.ensureLoaded()).ok,true);await flush();assert.equal(f.calls.length,2);assert.equal(f.peak,1);assert.equal(f.api.read().phase,'ready');
}));
test('context ABA invalidates an old attempt and does not accept its late schema',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.api.setContext(null);f.api.setContext('lucy-generation-1');await pending;gate.resolve(f.response());await flush();assert.equal(f.api.read().fields.length,0);assert.equal(f.api.read().phase,'idle');delete f.hooks.schema;
 await f.api.ensureLoaded();await flush();assert.equal(f.calls.length,2);assert.equal(f.api.read().phase,'ready');
}));
test('one of two visible views leaving does not cancel the shared initial request',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.api.view('two',true);f.api.remove('one');assert.equal(f.calls[0].signal.aborted,false);gate.resolve(f.response());await pending;await flush();assert.equal(f.api.read().phase,'ready');assert.equal(f.calls.length,1);
}));
test('dispose settles initial UI and later completion cannot recreate fields or timers',()=>run(async f=>{
 const gate=f.hold(),pending=f.api.ensureLoaded();await flush();f.api.dispose();await pending;gate.resolve(f.response());await flush();await f.api.ensureLoaded();assert.equal(f.calls.length,1);assert.equal(f.api.read().fields.length,0);assert.equal(f.jobs.size,0);
}));
