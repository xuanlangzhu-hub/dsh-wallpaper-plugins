// Real production module + its bootstrap/panel and companion/contract. DOM, React and settings IO are substitutes.
import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';import {createRig} from './detachable-catalog-harness.mjs';
import {createCompanionApp} from '../src/companion/companion.js';
import {executeAuthoritativeAction,buildAppearanceSnapshot} from '../src/detachable-contract.js';
const source=fileURLToPath(new URL('../src/client.js',import.meta.url)),id='we-'+'a'.repeat(24),other='we-'+'b'.repeat(24);
const item={id,title:'Synthetic video',type:'video',available:true,contentRating:'Everyone'};
async function panel(fn,options={}){const f=await createRig(source,{items:[item],sceneId:id,allowSettingsWrite:true,...options});try{f.open();await f.flush();f.render();await fn(f);}finally{await f.dispose();assert.equal(f.timers.size,0);}}
const node=(f,id)=>{const n=f.controls().find(n=>n.props.id===id);assert.ok(n,'missing '+id);return n;};
const mode=f=>node(f,'whale-docked-we-mode'),auto=f=>node(f,'whale-docked-we-autostart');
const change=(n,value)=>n.props.onChange({target:{value,checked:value},currentTarget:{value,checked:value}});
for(const [name,state,expectedMismatch] of [
 ['idle',{state:'idle',host:{active:false,activeSceneId:null}},false],
 ['nested same',{state:'playing',host:{active:true,activeSceneId:id}},false],
 ['flat same',{state:'playing',activeSceneId:id},false],
 ['nested other',{state:'playing',host:{active:true,activeSceneId:other}},true],
 ['unknown',{state:'playing',host:{active:true,activeSceneId:null}},true],
 ['invalid string',{state:'playing',activeSceneId:'null'},true],
])await test('main: '+name,()=>panel(async f=>{
 f.setStatus(state);f.render();const banner=f.controls().find(n=>n.props.id==='whale-docked-mismatch-banner');assert.equal(Boolean(banner),expectedMismatch);
 if(banner){assert.doesNotMatch(banner.children.join(''),/「(?:null|undefined)」/);if(!state.activeSceneId&&!state.host?.activeSceneId)assert.match(banner.children.join(''),/身份|未知/);}
 if(state.state==='playing')assert.equal(f.observation().startDisabled,true);
}));
await test('main actual control events use existing setting keys, no playback IO, survive fixture remount',async()=>{
 const store={value:null};await panel(async f=>{assert.equal(mode(f).props.value,'daily');assert.equal(auto(f).props.checked,false);await change(mode(f),'preview');f.render();assert.equal(f.settings.weMode,'preview');await change(auto(f),true);f.render();assert.equal(f.settings.weAutoStart,true);assert.equal(auto(f).props.checked,true);assert.equal(f.settingWrites.length,2);assert.equal(f.requests.length,1);await change(mode(f),'bogus');assert.equal(f.settingWrites.length,2);}, {persistedStore:store});
 await panel(async f=>{assert.equal(mode(f).props.value,'preview');assert.equal(auto(f).props.checked,true);assert.equal(f.settingWrites.length,0);},{persistedStore:store});
});
for(const state of [{state:'starting'},{state:'playing',host:{activeSceneId:id}},{state:'stopping'},{state:'cleanup-failed',cleanupPending:true},{state:'idle',cleanupPending:true},{state:'idle',activeSceneId:other},{state:'idle',host:{activeSceneId:other}}])await test('main blocked settings events '+JSON.stringify(state),()=>panel(async f=>{f.setStatus(state);f.render();assert.equal(mode(f).props.disabled,true);assert.equal(auto(f).props.disabled,true);await change(mode(f),'preview');await change(auto(f),true);assert.equal(f.settingWrites.length,0);}));
await test('main detached settings controls cannot write',()=>panel(async f=>{f.setMode('detached');f.render();if(f.controls().length){assert.equal(mode(f).props.disabled,true);await change(mode(f),'preview');assert.equal(f.settingWrites.length,0);}}));
// Mount only actual HTML IDs needed by this test; null gallery/preview nodes avoid all media/network work.
const html=await readFile(new URL('../src/companion/index.html',import.meta.url),'utf8');
async function companion(saved={},options={}){
 let revision=1,settings={weScene:id,weMode:'daily',weAutoStart:false,weAgeRatings:'Everyone',...saved},wp={state:'idle',activeSceneId:null,cleanupPending:false},emitter=null;
 const actions=[],store={value:JSON.stringify(settings)};let starts=0,stops=0;
 const controller={read:()=>settings,set:(key,value)=>{settings={...settings,[key]:value};store.value=JSON.stringify(settings);revision++;return settings;},wallpaper:{getStatus:()=>wp,getLibrarySnapshot:()=>({state:'ready',loaded:true,items:[item]}),start:async()=>{starts++;return{ok:true};},stop:async()=>{stops++;return{ok:true};}}};
 const snapshot=()=>({...buildAppearanceSnapshot(controller,revision),wallpaper:wp});
 const elements=new Map();for(const id of ['status-pill','status-text','error-banner','details-playback-text','details-mismatch-banner','btn-start-wallpaper','btn-stop-wallpaper','select-playback-mode','checkbox-we-autostart']){
  assert.ok(html.includes('id="'+id+'"'),'missing actual HTML element '+id);
  const classes=new Set(),listeners=new Map();const el={id,value:'',checked:false,disabled:false,textContent:'',className:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},setAttribute(){},addEventListener:(type,fn)=>{listeners.set(type,fn);},async fire(type,value){if(typeof value==='boolean')this.checked=value;else this.value=value;const fn=listeners.get(type);assert.ok(fn,'missing '+id+' '+type+' listener');await fn({target:this,currentTarget:this});for(let i=0;i<35;i++)await Promise.resolve();}};elements.set(id,el);
 }
 const transport={connect:async()=>({ok:true,snapshot:snapshot()}),onSnapshot:fn=>{emitter=fn;},onDisconnect:()=>{},onDockedNotice:()=>{},sendAction:async action=>{actions.push(action);if(options.rejectSettings)return{ok:false,error:'fixture-setting-rejected',snapshot:snapshot()};return executeAuthoritativeAction({controller,action,currentRevision:revision,getSnapshot:snapshot});},disconnect:async()=>({ok:true}),close(){}};
 const app=createCompanionApp({windowObj:{location:{origin:'http://isolated.invalid',pathname:'/',search:'?token=fixture-token&instanceId=fixture-id'},history:{replaceState(){}},addEventListener(){},close(){}},documentObj:{title:'fixture',activeElement:null,getElementById:id=>elements.get(id)??null},customTransport:transport,actionTimeoutMs:500});await app.start();
 return{app,elements,actions,store,get settings(){return settings;},get startCount(){return starts;},get stopCount(){return stops;},mode:elements.get('select-playback-mode'),auto:elements.get('checkbox-we-autostart'),async publish(next,rev=null){wp=next;revision=rev??revision+1;if(emitter)emitter(snapshot());for(let i=0;i<30;i++)await Promise.resolve();},async settingsFromMain(patch){settings={...settings,...patch};store.value=JSON.stringify(settings);revision++;if(emitter)emitter(snapshot());for(let i=0;i<30;i++)await Promise.resolve();},close(){app.getClient().disconnect();app.disposeBlobUrls();}};
}
await test('companion actual DOM events go through validated revisioned contract and sync snapshot',async()=>{const f=await companion();try{assert.equal(f.mode.value,'daily');assert.equal(f.auto.checked,false);assert.equal(f.mode.disabled,false);await f.mode.fire('change','preview');assert.equal(f.settings.weMode,'preview');await f.auto.fire('change',true);assert.equal(f.settings.weAutoStart,true);assert.equal(JSON.parse(f.store.value).weMode,'preview');assert.equal(JSON.parse(f.store.value).weAutoStart,true);assert.equal(f.actions.length,2);assert.ok(f.actions.every(a=>a.type==='set-setting'));assert.equal(f.startCount,0);assert.equal(f.stopCount,0);await f.settingsFromMain({weMode:'daily',weAutoStart:false});assert.equal(f.mode.value,'daily');assert.equal(f.auto.checked,false);const saved=JSON.parse(f.store.value);const g=await companion(saved);try{assert.equal(g.mode.value,'daily');assert.equal(g.auto.checked,false);}finally{g.close();}}finally{f.close();}});
for(const state of [{state:'starting'},{state:'playing',host:{activeSceneId:id}},{state:'stopping'},{state:'cleanup-failed',cleanupPending:true},{state:'idle',cleanupPending:true},{state:'idle',activeSceneId:other},{state:'idle',host:{activeSceneId:other}}])await test('companion gated events '+JSON.stringify(state),async()=>{const f=await companion();try{await f.publish(state);assert.equal(f.mode.disabled,true);assert.equal(f.auto.disabled,true);await f.mode.fire('change','preview');await f.auto.fire('change',true);assert.equal(f.actions.length,0);}finally{f.close();}});
await test('companion nested identity, unknown/other display and disconnect safety',async()=>{const f=await companion();try{await f.publish({state:'playing',host:{activeSceneId:id}});assert.match(f.elements.get('details-playback-text').textContent,new RegExp(id));assert.equal(f.elements.get('details-mismatch-banner').classList.contains('hidden'),true);await f.publish({state:'playing',host:{activeSceneId:other}});assert.match(f.elements.get('details-mismatch-banner').textContent,new RegExp(other));await f.publish({state:'playing',activeSceneId:'null'});assert.doesNotMatch(f.elements.get('details-playback-text').textContent,/null|undefined/);await f.publish({state:'idle',activeSceneId:null});f.close();assert.equal(f.mode.disabled,true);await f.mode.fire('change','preview');assert.equal(f.actions.length,0);}finally{f.close();}});

await test('real engine start/accept/status through real panel never loses nested Host identity',async()=>{
 let releaseRead=null;
 const f=await createRig(source,{items:[item],sceneId:id,engineFetchImpl:(url,opts={})=>{
  if(url==='/whale-wallpaper/start')return Promise.resolve({ok:true,json:async()=>({active:true,activeSceneId:id,mode:'daily',session:{}})});
  if(String(url).startsWith('/whale-wallpaper/stream'))return Promise.resolve({ok:true,body:{getReader:()=>({read:()=>new Promise(r=>{releaseRead=r;}),cancel:async()=>{releaseRead?.({done:true});},releaseLock(){}})}});
  if(url==='/whale-wallpaper/client-status')return Promise.resolve({ok:true});
 }});
 try{f.open();await f.flush();await f.engine.start(id,'daily');f.engine.acceptFrame({sequence:1,capturedAt:Date.now(),width:2,height:2,jpeg:new Uint8Array([255,216,255,217])});for(let i=0;i<100&&f.engine.getStatus().state!=='playing';i++)await f.flush();const status=f.engine.getStatus();assert.equal(status.state,'playing');assert.equal(status.host.activeSceneId,id);assert.equal(status.activeSceneId,undefined,'real engine wire shape is nested');f.render();assert.equal(f.controls().find(n=>n.props.id==='whale-docked-mismatch-banner'),undefined);}finally{f.engine.dispose();releaseRead?.({done:true});await f.dispose();assert.equal(f.timers.size,0);}
});

await test('companion failed setting restores authoritative control values',async()=>{const f=await companion({},{rejectSettings:true});try{await f.mode.fire('change','preview');assert.equal(f.settings.weMode,'daily');assert.equal(f.mode.value,'daily');assert.equal(f.mode.disabled,false);assert.match(f.elements.get('error-banner').textContent,/失败|rejected/);await f.auto.fire('change',true);assert.equal(f.settings.weAutoStart,false);assert.equal(f.auto.checked,false);assert.equal(f.startCount,0);}finally{f.close();}});
await test('companion invalid enum and nonboolean DOM values never dispatch',async()=>{const f=await companion();try{await f.mode.fire('change','garbage');assert.equal(f.actions.length,0);f.auto.checked='true';await f.auto.fire('change',undefined);assert.equal(f.actions.length,0);}finally{f.close();}});

await test('companion handler also refuses nested activity if disabled property is bypassed',async()=>{const f=await companion();try{await f.publish({state:'idle',host:{activeSceneId:other}});assert.equal(f.mode.disabled,true);f.mode.disabled=false;await f.mode.fire('change','preview');assert.equal(f.actions.length,0);}finally{f.close();}});
await test('mode controls missing/invalid setting defaults to bounded preview in both views',async()=>{await panel(async f=>{assert.equal(mode(f).props.value,'preview');},{initialSettings:{weMode:undefined}});const f=await companion({weMode:undefined});try{assert.equal(f.mode.value,'preview');}finally{f.close();}});
