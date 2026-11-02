import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {choiceContract} from './native-choice-contract-fixture.mjs';
const raw=await readFile(process.env.AUTHOR_GENERATED_CLIENT,'utf8'),begin='    /* WM_NATIVE_SIDEBAR_BEGIN */',end='    /* WM_NATIVE_SIDEBAR_END */';
const from=raw.indexOf(begin),to=raw.indexOf(end,from);assert.ok(from>=0&&to>from);
const api=vm.runInNewContext(raw.slice(from+begin.length,to)+'\nWM_NATIVE_SIDEBAR;',{setTimeout,clearTimeout,AbortController,performance,console},{timeout:1000});
function rig({enabled=false,busy=false,mark=null,stopped=false,cleanup=false}={}){
 const calls=[],listeners=new Set();let next=0;
 const state={fields:[{key:'particles',type:'bool',label:'粒子'}],values:{particles:true},marks:{},busy:false,phase:'ready',message:null,loading:false,editing:false,canRead:true,recovery:null,canDiscard:false,canEdit:true};
 const author={read:()=>state,subscribe:()=>()=>{},setContext(){},editCurrent:()=>false,load(){}};
 const diagnostic={read:()=>({enabled,busy,mark}),subscribe:()=>()=>{},view(){},remove(){},exportFile:token=>calls.push(['export',token]),cancel:()=>calls.push(['cancel'])};
 const settings={theme:'abyss',background:'wallpaper',brightness:70,mask:40,blur:0,surface:80,chatBackdrop:0,weScene:'lucy',weAgeRatings:'Everyone',weMode:'daily',weAutoStart:false};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);},wallpaper:{getStatus:()=>({state:stopped?'idle':'playing',activeSceneId:stopped?null:'lucy',generation:1,cleanupPending:cleanup}),getLibrarySnapshot:()=>({loaded:true,state:'ready',items:[{id:'lucy',contentRating:'Everyone',available:true,type:'scene',title:'Lucy'}]}),subscribeStatus:()=>()=>{},subscribeLibrary:()=>()=>{}}};
 const React={createElement:choiceContract,useRef:value=>({current:value}),useEffect(){},useId:()=>`diag-${++next}`,useMemo:fn=>fn(),useState:value=>[typeof value==='function'?value():value,()=>{}],useSyncExternalStore:(_subscribe,get)=>get()};
 const ctx={sidebarRight:{openTab(){},mounted:{getSnapshot:()=> 's1',subscribe:()=>()=>{}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_n,fn)=>fn(),register:()=>()=>{}}};
 const sidebar=api.createNativeAppearanceSidebar({ctx,React,controller,author,diagnostic});const nodes=[];
 function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(typeof n.type==='function'){walk(n.type(n.props));return;}nodes.push(n);(n.children??[]).forEach(walk);}
 walk(sidebar.Body({useTabInfo:()=>({tab:{id:'diag',visible:true}})}));const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
 return{nodes,calls,text,dispose(){sidebar.dispose();assert.equal(listeners.size,0);}};
}
function check(options,fn){const f=rig(options);try{fn(f);}finally{f.dispose();}}
test('default UI has no diagnostic or cancel button and performs no export',()=>check({},f=>{assert.equal(f.nodes.some(n=>n.props['data-whale-author-diagnostic-export']),false);assert.deepEqual(f.calls,[]);}));
test('enabled explicit button uses the established quiet control style and the current view token',()=>check({enabled:true},f=>{const b=f.nodes.find(n=>n.props['data-whale-author-diagnostic-export']);assert.equal(b.props.className,'dsw-btn');assert.equal(b.props['data-whale-quiet'],true);assert.equal(b.props.disabled,false);assert.deepEqual(f.calls,[]);b.props.onClick();assert.equal(f.calls.length,1);assert.equal(typeof f.calls[0][1],'symbol');}));
test('busy disables duplicate handoff and exposes a cancel action',()=>check({enabled:true,busy:true},f=>{assert.equal(f.nodes.find(n=>n.props['data-whale-author-diagnostic-export']).props.disabled,true);f.nodes.find(n=>n.props['data-whale-author-diagnostic-cancel']).props.onClick();assert.deepEqual(f.calls,[['cancel']]);}));
test('download receipt explicitly avoids claiming a saved file',()=>check({enabled:true,mark:'download'},f=>{const b=f.nodes.find(n=>n.props['data-whale-author-diagnostic-export']);assert.match(b.props.title,/交给浏览器下载/);assert.equal(/保存成功/.test(b.props.title),false);assert.match(f.text(b),/✓/);}));
test('failure offers a short retry indication without raw details',()=>check({enabled:true,mark:'error'},f=>{const b=f.nodes.find(n=>n.props['data-whale-author-diagnostic-export']);assert.match(b.props.title,/点击重试/);assert.match(f.text(b),/!/);}));
for(const options of [{stopped:true},{cleanup:true}])test('diagnostic entry survives absent author editing context '+JSON.stringify(options),()=>check({enabled:true,...options},f=>{assert.equal(f.nodes.some(n=>n.props['data-whale-author-switches']),false);assert.ok(f.nodes.find(n=>n.props['data-whale-author-diagnostic-export']));}));
