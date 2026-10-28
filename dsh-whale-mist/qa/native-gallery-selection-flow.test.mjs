import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choiceContract} from './native-choice-contract-fixture.mjs';
import {createNativeAppearanceSidebar} from '../src/sidebar/native-appearance-sidebar.js';

const B='we-'+'b'.repeat(24),C='we-'+'c'.repeat(24);
const item=(id,type='scene')=>({id,type,title:id==='lucy'?'Lucy':id===B?'Wallpaper B':'Wallpaper C',contentRating:'Everyone',available:true});
function rig({active=null,selected='lucy',type='scene',author=null}={}){
 let settings={background:'wallpaper',weScene:selected,weMode:'daily',weAgeRatings:'Everyone',brightness:70,mask:45};
 let status={state:active?'playing':'idle',activeSceneId:active,host:{activeSceneId:active},generation:7,cleanupPending:false};
 let library={state:'ready',loaded:true,items:[item('lucy'),item(B,type),item(C)]},restartTask=null;
 const listeners={settings:new Set(),status:new Set(),library:new Set()},calls=[],writes=[];
 const emit=key=>{for(const fn of [...listeners[key]])fn();};
 const sub=key=>fn=>{listeners[key].add(fn);return()=>listeners[key].delete(fn);};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings:sub('settings'),set(key,value){writes.push([key,value]);settings={...settings,[key]:value};emit('settings');},wallpaper:{
  getStatus:()=>status,getLibrarySnapshot:()=>library,subscribeStatus:sub('status'),subscribeLibrary:sub('library'),
  start(id,mode){calls.push(['start',id,mode]);return Promise.resolve({state:'starting'});},
  restart(id,mode){calls.push(['restart',id,mode]);return restartTask??Promise.resolve({state:'starting'});},
  stop(reason){calls.push(['stop',reason]);return Promise.resolve({state:'stopped',cleanupPending:false});},
 }};
 let serial=0;
 const React={Fragment:'fragment',createElement:choiceContract,useSyncExternalStore:(_sub,get)=>get(),useRef:value=>({current:value}),useEffect:()=>{},useId:()=>`flow-${++serial}`,useState:value=>[typeof value==='function'?value():value,()=>{}]};
 const ctx={sidebarRight:{mounted:{getSnapshot:()=> 'session',subscribe:()=>()=>{}},openTab(){}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_name,fn)=>fn(),register:()=>()=>{}}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,author});
 function nodes(){const all=[];const walk=n=>{if(!n||typeof n!=='object')return;if(typeof n.type==='function')return walk(n.type(n.props));all.push(n);for(const c of n.children??[])walk(c);};walk(api.Body({useTabInfo:()=>({tab:{id:'flow',visible:true}})}));return all;}
 const play=()=>{const v=api.getSnapshot();return api.play(v.playAction,v.selectedId,v.playMode,v.activeId,v.playGeneration);};
 return{api,calls,writes,nodes,play,restartTask:p=>restartTask=p,status:patch=>{status={...status,...patch};emit('status');},library:patch=>{library={...library,...patch};emit('library');},select(id){api.showGallery(true);return api.selectWallpaper(id);},dispose(){api.dispose();}};
}
async function run(options,fn){const f=rig(options);try{await fn(f);}finally{f.dispose();}}

test('selecting repeatedly stays in the gallery and makes no playback calls',()=>run({},f=>{
 assert.equal(f.select(B).ok,true);assert.equal(f.api.getSnapshot().galleryOpen,true);
 assert.equal(f.api.selectWallpaper(C).ok,true);assert.equal(f.api.getSnapshot().galleryOpen,true);
 assert.deepEqual(f.writes,[['weScene',B],['weScene',C]]);assert.deepEqual(f.calls,[]);
}));
test('gallery navigation says wallpaper parameters; detail navigation retains change',()=>run({},f=>{
 f.api.showGallery(true);let b=f.nodes().find(n=>n.props['data-whale-change-wallpaper']);
 assert.equal(b.children[0],'壁纸参数');assert.equal(b.props['aria-label'],'壁纸参数');
 b.props.onClick({detail:0});assert.equal(f.api.getSnapshot().galleryOpen,false);
 b=f.nodes().find(n=>n.props['data-whale-change-wallpaper']);assert.equal(b.children[0],'更换');
}));
test('explicit play starts the selected wallpaper while leaving gallery open',()=>run({},async f=>{
 f.select(B);assert.equal((await f.play()).ok,true);assert.deepEqual(f.calls,[['start',B,'daily']]);assert.equal(f.api.getSnapshot().galleryOpen,true);
}));
test('play contains a visible text label rather than an icon alone',()=>run({},f=>{
 const b=f.nodes().find(n=>n.props['data-whale-playback-action']);assert.ok(b.children.some(c=>c==='播放'));
}));
test('select B while A plays keeps A until one explicit restart of B',()=>run({active:'lucy'},async f=>{
 f.select(B);assert.equal(f.api.getSnapshot().activeId,'lucy');assert.deepEqual(f.calls,[]);
 assert.equal(f.api.getSnapshot().playAction,'switch');assert.equal((await f.play()).ok,true);
 assert.deepEqual(f.calls,[['restart',B,'daily']]);assert.equal(f.api.getSnapshot().galleryOpen,true);
}));
test('a selected different wallpaper retains an explicit stop-current control',()=>run({active:'lucy'},async f=>{
 f.select(B);const stop=f.nodes().find(n=>n.props['data-whale-stop-current']);assert.ok(stop);await stop.props.onClick();assert.deepEqual(f.calls,[['stop','user']]);
}));
test('same-tick repeated play cannot issue two switches',()=>run({active:'lucy'},async f=>{
 let resolve;f.restartTask(new Promise(r=>resolve=r));f.select(B);const first=f.play();await f.play();assert.equal(f.calls.length,1);resolve({state:'starting'});await first;
}));
test('stale selection or old source generation cannot issue a switch',()=>run({active:'lucy'},async f=>{
 f.select(B);const old=f.api.getSnapshot();f.api.selectWallpaper(C);
 assert.equal((await f.api.play('switch',B,old.playMode,old.activeId,old.playGeneration)).ok,false);
 f.select(B);f.status({generation:8});assert.equal((await f.api.play('switch',B,old.playMode,old.activeId,old.playGeneration)).ok,false);assert.deepEqual(f.calls,[]);
}));
test('an unconfirmed cleanup cannot start the next wallpaper',()=>run({active:'lucy'},async f=>{
 f.select(B);f.status({state:'cleanup-failed',cleanupPending:true});assert.equal(f.api.getSnapshot().playAction,'stop');await f.play();assert.deepEqual(f.calls,[]);
}));
test('restart failure leaves gallery open and never falls back to a second start',()=>run({active:'lucy'},async f=>{
 f.restartTask(Promise.resolve({state:'cleanup-failed',error:'not-closed'}));f.select(B);assert.equal((await f.play()).ok,false);assert.equal(f.api.getSnapshot().galleryOpen,true);assert.deepEqual(f.calls,[['restart',B,'daily']]);
}));
for(const type of ['scene','web'])test(`non-Lucy ${type} receives a matching author context`,()=>{
 const contexts=[],author={setContext:(...args)=>contexts.push(args),dispose(){}};
 return run({active:B,selected:B,type,author},f=>{assert.ok(f.api.getSnapshot().authorContext);assert.equal(contexts.at(-1)[1],B);});
});
test('video does not pretend to expose scene/web author parameters',()=>{
 const author={setContext(){},dispose(){}};return run({active:B,selected:B,type:'video',author},f=>assert.equal(f.api.getSnapshot().authorContext,null));
});
test('conflicting active identities do not open author editing',()=>{
 const author={setContext(){},dispose(){}};return run({active:B,selected:B,author},f=>{f.status({host:{activeSceneId:'lucy'}});assert.equal(f.api.getSnapshot().authorContext,null);});
});
