import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {choiceContract} from './native-choice-contract-fixture.mjs';
const root=process.env.AUTHOR_UI_RUNTIME,build=JSON.parse(await readFile(process.env.AUTHOR_UI_BUILD,'utf8'));
const {createAuthorDiagnosticSession}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-export.js'));
const raw=await readFile(root+'/src/client.js','utf8'),begin='    /* WM_NATIVE_SIDEBAR_BEGIN */',end='    /* WM_NATIVE_SIDEBAR_END */';
const from=raw.indexOf(begin),to=raw.indexOf(end,from);assert.ok(from>=0&&to>from);
const native=vm.runInNewContext(raw.slice(from+begin.length,to)+'\nWM_NATIVE_SIDEBAR;',{setTimeout,clearTimeout,AbortController,performance,console},{timeout:1000});
function rig({hold=false}={}){
 const settingsListeners=new Set(),statusListeners=new Set(),slots=new Map(),cleanups=[],reactEffects=[],urls=new Map(),timers=new Map(),anchors=[];let serial=0,release;
 const gate=new Promise(r=>release=r),backend=createAuthorDiagnosticSession({enabled:true,build}),requests=[];
 const settings={theme:'abyss',background:'wallpaper',brightness:70,mask:40,blur:0,surface:80,chatBackdrop:0,weScene:'lucy',weAgeRatings:'Everyone',weMode:'daily',weAutoStart:false};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings(fn){settingsListeners.add(fn);return()=>settingsListeners.delete(fn);},wallpaper:{getStatus:()=>({state:'idle',activeSceneId:null,generation:1}),getLibrarySnapshot:()=>({loaded:true,state:'ready',items:[{id:'lucy',contentRating:'Everyone',available:true,type:'scene',title:'Lucy'}]}),subscribeStatus(fn){statusListeners.add(fn);return()=>statusListeners.delete(fn);},subscribeLibrary:()=>()=>{}}};
 const doc={body:{appendChild(){}},createElement(){const a={click(){a.clicked=true;},remove(){a.removed=true;}};anchors.push(a);return a;}};
 const downloadOptions={document:doc,BlobType:Blob,urlApi:{createObjectURL(blob){const url='blob:flow-'+ ++serial;urls.set(url,blob);return url;},revokeObjectURL(url){urls.delete(url);}},timers:{setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}}};
 const child={effect(fn){const off=fn();cleanups.push(off);return off;},sidebarRight:{mounted:{getSnapshot:()=> 's1',subscribe:()=>()=>{}},openTab(){}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_n,fn)=>fn(),register(def,component){slots.set(def.name+':'+def.key,component);return()=>slots.delete(def.name+':'+def.key);}}};
 const ctx={inject(_names,fn){fn(child);return{dispose:async()=>{for(const off of cleanups.splice(0).reverse())off?.();}};}};
 const React={createElement:choiceContract,useRef:value=>({current:value}),useEffect:fn=>reactEffects.push(fn),useId:()=> 'flow-'+ ++serial,useMemo:fn=>fn(),useState:value=>[typeof value==='function'?value():value,()=>{}],useSyncExternalStore:(_subscribe,get)=>get()};
 const api=native.attachNativeAppearanceSidebar({ctx,React,controller,requestAuthor:async()=>{throw Error('no author read during stopped export');},diagnosticOptions:{expectedBuild:build,downloadOptions,readConnection:()=>({generation:1}),requestHost:async id=>{requests.push(id);if(hold)await gate;return backend.exportData(id);}}});
 function render(){
  const Body=slots.get('sidebar.right.pane.tab:dsh-whale-mist/appearance-sidebar');assert.ok(Body);const nodes=[];
  function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(typeof n.type==='function'){walk(n.type(n.props));return;}nodes.push(n);(n.children??[]).forEach(walk);}
  walk(Body({useTabInfo:()=>({tab:{id:'flow',visible:true}})}));for(const fn of reactEffects.splice(0)){const off=fn();if(off)cleanups.push(off);}return nodes;
 }
 return{api,backend,requests,urls,timers,anchors,release,render,async dispose(){await api.dispose();backend.dispose();assert.equal(urls.size,0);assert.equal(timers.size,0);assert.equal(settingsListeners.size,0);assert.equal(statusListeners.size,0);}};
}
test('actual generated provider routes trusted configuration through its real lifecycle to browser handoff',async()=>{
 const f=rig();try{assert.equal(f.requests.length,0);assert.equal(f.api.configureAuthorDiagnostics(build),true);const button=f.render().find(n=>n.props['data-whale-author-diagnostic-export']);assert.ok(button);const result=await button.props.onClick();assert.equal(result.handedToBrowser,true);assert.equal(f.requests.length,1);assert.equal(f.anchors.length,1);assert.equal(f.anchors[0].removed,true);const blob=[...f.urls.values()][0],data=JSON.parse(await blob.text());assert.equal(data.build.buildId,build.buildId);assert.equal(data.clockDomains.crossProcessTiming,'not-correlated');assert.equal(data.renderer.records.length,0);}finally{f.release();await f.dispose();}
});
test('actual provider disposal cancels an in-flight export before a late response can download',async()=>{
 const f=rig({hold:true});try{f.api.configureAuthorDiagnostics(build);const button=f.render().find(n=>n.props['data-whale-author-diagnostic-export']);const pending=button.props.onClick();await f.api.dispose();assert.equal((await pending).ok,false);f.release();await Promise.resolve();assert.equal(f.anchors.length,0);}finally{f.release();await f.dispose();}
});
