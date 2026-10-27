// Real authenticated HTTP gateway, production form and ModuleLoader mount; IO/window work substituted.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDetachableHttpHost,STATIC_MANIFEST} from '../src/detachable-host.js';
import {createAuthorPanel} from '../src/wallpaper/author-properties-panel.js';
import {createAuthorSchema} from '../src/wallpaper/author-properties-schema.js';
import {authorDefaults} from '../src/wallpaper/author-properties-contract.js';
import {createCompanionApp} from '../src/companion/companion.js';
const id='lucy',other='we-aaaaaaaaaaaaaaaaaaaaaaaa';
const metadata=(wallpaperId=id)=>({wallpaperId,type:'scene',contentRating:'Everyone',properties:{
  heading:{type:'group',text:'画面'}, enabled:{type:'bool',value:false,text:'开启'},speed:{type:'slider',value:2,min:0,max:10,text:'速度'},
  color:{type:'color',value:'1 0 0',text:'颜色'},mode:{type:'combo',value:1,options:[{label:'一',value:1},{label:'二',value:2}],text:'模式'},
  title:{type:'textinput',value:'鲸鱼',text:'文字'},conditional:{type:'bool',value:true,condition:'script',text:'条件'},
}});
const initialSchema=createAuthorSchema(metadata());
const response=()=>({ok:true,schema:initialSchema,draft:{revision:0,values:authorDefaults(initialSchema),dirtyKeys:[]}});
const life=()=>({generation:0,activeSceneId:null,location:null,cleanupPending:false,busy:false});
function call(base,path,{body,headers={},method=body?'POST':'GET'}={}){
  return new Promise((resolve,reject)=>{const req=http.request(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},timeout:2500},res=>{
    let raw='';res.on('data',chunk=>raw+=chunk);res.on('end',()=>{let data;try{data=JSON.parse(raw);}catch{data=raw;}resolve({status:res.statusCode,data,headers:res.headers});});
  });req.on('timeout',()=>req.destroy(new Error('test-http-timeout')));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
}
async function fixture(t,options={}){
  let reads=0,currentLife=life(),gate=null;const library={getAuthorMetadata:async(wallpaperId,opts)=>{reads++;if(gate)await gate;assert.ok(opts.allowedRatings.includes('Everyone'));return metadata(wallpaperId);}};
  const host=createDetachableHttpHost({library,readWallpaperLifecycle:()=>({...currentLife}),mainToken:'test-main',...options});
  await host.start();t.after(()=>host.stop());const base=host.getBaseUrl();let gen;
  const snapshot={revision:1,settings:{weScene:id,weAgeRatings:'Everyone'},catalog:{items:[]},wallpaper:{state:'idle'}};
  async function register(){const r=await call(base,'/api/main/connect',{body:{mainToken:'test-main',instanceId:'main-test',snapshot}});assert.equal(r.data.ok,true);gen=r.data.generation;}
  await register();const headers=()=>({'x-whale-main-token':'test-main','x-whale-instance-id':'main-test','x-whale-generation':String(gen)});
  const read=(h=headers())=>call(base,'/api/author-properties/schema?wallpaperId='+snapshot.settings.weScene,{headers:h});
  const update=async()=>{snapshot.revision++;return call(base,'/api/main/snapshot',{headers:headers(),body:{instanceId:'main-test',generation:gen,snapshot}});};
  async function companion(){const d=await call(base,'/api/main/detach',{headers:headers(),body:{instanceId:'main-test',generation:gen}});const c=await call(base,'/api/connect',{body:{token:d.data.token,instanceId:'main-test'}});assert.equal(c.data.ok,true);return {'x-whale-lease':c.data.leaseId,'x-whale-generation':String(gen)};}
  return{host,base,snapshot,headers,read,update,register,companion,get reads(){return reads;},setLife:value=>{currentLife={...currentLife,...value};},setGate:p=>{gate=p;}};
}
test('gateway denies missing/forged/old credentials and wrong origin before metadata IO', {timeout:7000},async t=>{
  const f=await fixture(t);
  for(const headers of [{},{...f.headers(),'x-whale-generation':'1junk'},{...f.headers(),'x-whale-instance-id':'other'},{...f.headers(),origin:'http://evil.example'},{...f.headers(),origin:f.base}]){
    assert.equal((await f.read(headers)).data.ok,false);
  }
  assert.equal(f.reads,0);assert.equal((await f.read()).data.ok,true);
  const old=f.headers();await f.register();assert.equal((await f.read(old)).data.ok,false);
});
test('real main and companion share one draft/revision; duplicate save conflicts and no apply route',{timeout:7000},async t=>{
  const f=await fixture(t),c=await f.companion(),s=(await f.read()).data;
  const payload={wallpaperId:id,schemaFingerprint:s.schema.fingerprint,expectedRevision:0,values:{title:'双端鲸鱼'}};
  const results=await Promise.all([call(f.base,'/api/author-properties/draft',{headers:f.headers(),body:payload}),call(f.base,'/api/author-properties/draft',{headers:c,body:payload})]);
  assert.equal(results.filter(r=>r.data.ok).length,1);assert.equal(results.find(r=>!r.data.ok).data.error,'author_revision_conflict');
  assert.equal((await f.read(c)).data.draft.values.title,'双端鲸鱼');
  for(const route of ['plan','apply'])assert.equal((await call(f.base,'/api/author-properties/'+route,{body:payload,headers:f.headers()})).status,404);
  const bad=await call(f.base,'/api/author-properties/draft',{headers:f.headers(),body:{...payload,expectedRevision:1,authorized:true,location:'desktop'}});assert.equal(bad.data.ok,false);
  const r=await call(f.base,'/api/author-properties/draft',{headers:c,body:{wallpaperId:id,schemaFingerprint:s.schema.fingerprint,expectedRevision:1,action:'reset'}});assert.equal(r.data.mutation,'reset');assert.equal(r.data.draft.values.title,'鲸鱼');
});
for(const drift of ['selection','rating','stop','registration','lease'])test('late authenticated read rejected after '+drift,{timeout:7000},async t=>{
  const f=await fixture(t),c=drift==='lease'?await f.companion():null;
  let release;f.setGate(new Promise(r=>release=r));const pending=f.read(c||f.headers());
  const readDeadline=Date.now()+500;
  while(!f.reads&&Date.now()<readDeadline)await new Promise(r=>setTimeout(r,1));
  assert.ok(f.reads,'metadata phase must start within 500ms');
  if(drift==='selection'){f.snapshot.settings.weScene=other;await f.update();}
  if(drift==='rating'){f.snapshot.settings.weAgeRatings='';await f.update();}
  if(drift==='stop')f.setLife({generation:1});
  if(drift==='registration')await f.register();
  if(drift==='lease')await call(f.base,'/api/disconnect',{headers:c,body:{}});
  release();const result=await pending;assert.equal(result.data.ok,false);
  f.setGate(null);if(['stop','registration'].includes(drift))assert.equal((await f.read()).data.draft.revision,0);
});
test('static page serves audited import closure and denies Node/private modules',{timeout:7000},async t=>{
  const f=await fixture(t),page=await call(f.base,'/index.html');assert.match(page.data,/id="author-properties-panel"/);
  for(const path of ['/companion.js','/wallpaper/author-properties-panel.js','/wallpaper/author-properties-contract.js','/wallpaper/managed-window.js','/detachable-contract.js']){
    const r=await call(f.base,path);assert.equal(r.status,200);assert.equal(r.headers['x-content-type-options'],'nosniff');
    for(const m of r.data.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      assert.ok(!m[1].startsWith('node:'));assert.ok(STATIC_MANIFEST[new URL(m[1],f.base+path).pathname]);
    }
  }
  for(const path of ['/wallpaper/author-properties-host.js','/wallpaper/author-properties-schema.js','/index.js','/package.json'])assert.equal((await call(f.base,path)).status,404);
});

class Element {
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.style={};this.children=[];this.events={};this.attrs={};this.value='';this.disabled=false;this.textContent='';this.classList={add(){},remove(){},toggle(){}};}
  appendChild(node){this.children.push(node);return node;}replaceChildren(...nodes){this.children=nodes;this.textContent='';}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){this.events[k]=fn;}removeEventListener(){}querySelector(){return null;}querySelectorAll(){return [];}
  fire(kind){if(!this.disabled)this.events[kind]?.({currentTarget:this,target:this});}
}
function dom(){const nodes=new Map(),doc={createElement:tag=>new Element(tag,doc),getElementById:id=>nodes.get(id)??null,querySelectorAll:()=>[],activeElement:null};const root=new Element('section',doc);nodes.set('author-properties-panel',root);return{doc,root};}
const all=node=>[node,...node.children.flatMap(all)];
const find=(root,key)=>all(root).find(n=>n.attrs['data-author-key']===key);
const button=(root,text)=>all(root).find(n=>n.tagName==='button'&&n.textContent===text);
const flush=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
function form(request=async()=>response(),options={}){const d=dom();const panel=createAuthorPanel({root:d.root,documentObj:d.doc,request,...options});panel.update({wallpaperId:id,allowed:true,connected:true,contextKey:'1'});return {...d,panel};}
test('shared real form renders typed fields and structural groups, searches and disables actual apply',async()=>{
  const f=form();await flush();assert.ok(find(f.root,'enabled'));assert.equal(find(f.root,'speed').type,'number');assert.equal(find(f.root,'color').type,'color');assert.equal(find(f.root,'mode').tagName,'select');assert.ok(!find(f.root,'conditional'));
  assert.equal(button(f.root,'应用到当前壁纸（待接入）').disabled,true);
  const search=all(f.root).find(n=>n.type==='search');search.value='速度';search.fire('input');assert.ok(find(f.root,'speed'));assert.ok(!find(f.root,'enabled'));f.panel.dispose();
});
test('invalid visible numeric input prevents saving old valid value; valid edit sends delta only',async()=>{
  const calls=[];const f=form(async(route,payload)=>{calls.push({route,payload});return response();});await flush();
  const n=find(f.root,'speed');n.value='3';n.fire('change');n.value='';n.fire('change');assert.equal(button(f.root,'保存草稿').disabled,true);
  n.value='4';n.fire('change');button(f.root,'保存草稿').fire('click');await flush();assert.deepEqual(calls[1].payload.values,{speed:4});f.panel.dispose();
});
test('conflict refresh keeps local edits; explicit confirmation is required for resetting defaults',async()=>{
  let resetCalls=0,reads=0;const f=form(async(route,payload)=>{
    if(route==='draft'){if(payload.action==='reset'){resetCalls++;const r=response();r.draft.revision=2;return {...r,mutation:'reset'};}return {ok:false,error:'author_revision_conflict'};}
    const r=response();r.draft.revision=reads++;return r;
  });await flush();const n=find(f.root,'title');n.value='本地';n.fire('change');button(f.root,'保存草稿').fire('click');await flush();
  button(f.root,'刷新草稿').fire('click');await flush();assert.equal(f.panel.snapshot().pending.title,'本地');
  button(f.root,'确认恢复默认草稿').fire('click');await flush();assert.equal(resetCalls,0);
  all(f.root).filter(n=>n.type==='checkbox').at(-1).checked=true;button(f.root,'确认恢复默认草稿').fire('click');await flush();assert.equal(resetCalls,1);assert.deepEqual(f.panel.snapshot().pending,{});f.panel.dispose();
});
test('hidden rating/disconnect and selection replacement abort old work and never display late data',async()=>{
  const calls=[];const f=form((route,payload,opts)=>new Promise(resolve=>calls.push({resolve,opts,payload})));await flush();
  f.panel.update({wallpaperId:other,allowed:true,connected:true,contextKey:'2'});await flush();assert.equal(calls[0].opts.signal.aborted,true);
  calls[0].resolve(response());await flush();assert.equal(f.panel.snapshot(),null);
  f.panel.update({wallpaperId:other,allowed:false,connected:true,contextKey:'3'});assert.equal(calls[1].opts.signal.aborted,true);assert.equal(f.panel.snapshot(),null);
  const r=response();r.schema={...r.schema,wallpaperId:other};calls[1].resolve(r);await flush();assert.equal(f.panel.snapshot(),null);f.panel.dispose();
});
test('timeout settles without a cooperating transport, no retry loop; dispose aborts',async()=>{
  let calls=0;const f=form(()=>{calls++;return new Promise(()=>{});},{timeoutMs:15});await new Promise(r=>setTimeout(r,35));assert.equal(calls,1);assert.equal(button(f.root,'刷新草稿').disabled,false);f.panel.dispose();assert.equal(f.root.children.length,0);
});
test('actual ModuleLoader mount uses generated same form and cancels on unmount',async()=>{
  const source=await readFile(new URL('../src/client.js',import.meta.url),'utf8');const d=dom(),refs=[{current:d.root},{current:null}],effects=[];let exports;
  const React={useRef:()=>refs.shift(),useEffect:fn=>effects.push(fn),createElement:(type,props)=>({type,props})};
  const sandbox={window:{__ModuleLoader__:{load:({factory})=>exports=factory(name=>name==='react'?React:{})}},console,AbortController,URL,Uint8Array,ArrayBuffer,DataView,setTimeout,clearTimeout};
  const context=vm.createContext(sandbox);vm.runInContext(source,context,{timeout:1000});const calls=[];const bridge={getClient:()=>({}),requestAuthor:(...args)=>{calls.push(args);return Promise.resolve(vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(response()))+')',context,{timeout:1000}));}};
  const node=exports.WhaleAuthorProperties({appearanceBridge:bridge,wallpaperId:id,allowed:true,connected:true,contextKey:'1'});assert.equal(node.props['data-author-panel'],'docked');
  const off=effects[0]();effects[1]();await flush();assert.equal(calls.length,1);assert.ok(find(d.root,'title'));assert.equal(find(d.root,'title').value,'鲸鱼');off();assert.equal(d.root.children.length,0);
});
test('actual companion mounts shared form and disposes it through page lifetime',async()=>{
  const d=dom(),events={},calls=[],snapshot={revision:1,settings:{weScene:id,weAgeRatings:'Everyone'},catalog:{items:[{id,available:true,type:'scene',contentRating:'Everyone'}]},wallpaper:{state:'idle'}};
  const app=createCompanionApp({documentObj:d.doc,windowObj:{location:{search:'?token=test&instanceId=main-test',origin:'http://127.0.0.1:12345',pathname:'/index.html'},history:{replaceState(){}},addEventListener:(k,fn)=>events[k]=fn},customTransport:{
    connect:async()=>({ok:true,snapshot}),requestAuthor:async(...args)=>{calls.push(args);return response();},
  }});
  await app.start();await flush();assert.equal(calls.length,1);assert.ok(find(d.root,'title'));app.disposeBlobUrls();assert.equal(d.root.children.length,0);
});
test('actual embedded main transport drains selection snapshot and uses acknowledged generation; disconnect disables author requests',async()=>{
  const source=await readFile(new URL('../src/client.js',import.meta.url),'utf8'),calls=[];let exports,disconnect;
  const fetch=async(url,options={})=>{
    calls.push({path:new URL(url).pathname,options});
    if(url.includes('/actions?'))return {ok:true,body:{getReader:()=>({read:()=>new Promise(resolve=>{disconnect=()=>resolve({done:true});options.signal.addEventListener('abort',disconnect,{once:true});})})}};
    if(url.endsWith('/connect'))return {ok:true,json:async()=>({ok:true,generation:7})};
    return {ok:true,json:async()=>response()};
  };
  const sandbox={window:{__ModuleLoader__:{load:({factory})=>exports=factory(()=>({}))}},console,AbortController,URL,Uint8Array,ArrayBuffer,DataView,TextDecoder,setTimeout,clearTimeout,fetch};
  vm.runInNewContext(source,sandbox,{timeout:1000});
  const controller={read:()=>({weScene:id,weAgeRatings:'Everyone'})};
  const client=exports.createMainRendererBridgeClient({baseUrl:'http://127.0.0.1:12345',instanceId:'real-main',mainToken:'credential',controller});
  await assert.rejects(client.requestAuthor('schema',{wallpaperId:id}));await client.connect();assert.equal(client.authorConnected,true);
  const signal=new AbortController().signal;await client.requestAuthor('schema',{wallpaperId:id},{signal});
  assert.deepEqual(calls.slice(-2).map(c=>c.path),['/api/main/snapshot','/api/author-properties/schema']);
  assert.equal(calls.at(-1).options.headers['X-Whale-Generation'],'7');assert.equal(calls.at(-1).options.headers['X-Whale-Instance-Id'],'real-main');assert.equal(calls.at(-1).options.signal,signal);
  const applyPayload={wallpaperId:id,schemaFingerprint:initialSchema.fingerprint,expectedRevision:0};
  await client.requestAuthor('apply',applyPayload,{signal});assert.equal(calls.at(-1).path,'/api/author-properties/apply');assert.deepEqual(JSON.parse(calls.at(-1).options.body),applyPayload);
  disconnect();await flush();assert.equal(client.authorConnected,false);const before=calls.length;await assert.rejects(client.requestAuthor('draft',{wallpaperId:id}));assert.equal(calls.length,before);await client.dispose();
});
test('actual shared form applies only a saved delta and reports sent separately from actual values',async()=>{
  let revision=0,dirty=[],values=authorDefaults(initialSchema);const calls=[];
  const f=form(async(route,payload)=>{
    calls.push({route,payload});
    if(route==='draft'){revision++;values={...values,...payload.values};dirty=Object.keys(payload.values);}
    if(route==='apply'){assert.deepEqual(Object.keys(payload).sort(),['expectedRevision','schemaFingerprint','wallpaperId']);dirty=[];}
    return{ok:true,schema:initialSchema,draft:{revision,values,dirtyKeys:dirty},application:{available:true,targetActive:true},...(route==='apply'?{applySent:true}:{})};
  });await flush();
  assert.equal(button(f.root,'应用到当前壁纸').disabled,true);const n=find(f.root,'speed');n.value='5';n.fire('change');assert.equal(calls.length,1);
  button(f.root,'保存草稿').fire('click');await flush();assert.equal(button(f.root,'应用到当前壁纸').disabled,false);
  button(f.root,'应用到当前壁纸').fire('click');await flush();assert.equal(calls.at(-1).route,'apply');assert.equal(button(f.root,'应用到当前壁纸').disabled,true);
  assert.ok(all(f.root).some(n=>n.textContent.includes('参数已发送')));f.panel.dispose();
});
