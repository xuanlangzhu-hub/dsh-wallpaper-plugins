import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {choiceContract} from '../native-choice-contract-fixture.mjs';
const {createNativeAppearanceSidebar}=await import(pathToFileURL(process.env.AUTHOR_SIDEBAR_SOURCE));

// React element/handler contract only. No DOM, Windows SDK, source window or Host IO.
function rig({own=true,stale=false,pending=false,unknown=true,compat=false}={}){
 const calls=[],listeners=new Set();let next=0;
 const state={fields:[{key:'particles',type:'bool',label:'粒子'}],values:{particles:true},marks:{particles:'unknown'},
  busy:false,phase:'blocked',message:null,loading:false,editing:false,canRead:true,canDiscard:!pending,canEdit:false,
  recovery:{own,stale,pending,unknown,keys:['particles'],labels:['粒子']}};
 const author={read:()=>state,subscribe:()=>()=>{},setContext(){},editCurrent:()=>false,load:()=>calls.push(['load'])};
 if(!compat)author.retry=options=>calls.push(['retry',options]);
 const settings={theme:'abyss',background:'wallpaper',brightness:70,mask:40,blur:0,surface:80,chatBackdrop:0,weScene:'lucy',weAgeRatings:'Everyone',weMode:'daily',weAutoStart:false};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);},wallpaper:{
  getStatus:()=>({state:'playing',activeSceneId:'lucy',generation:1}),getLibrarySnapshot:()=>({loaded:true,state:'ready',items:[{id:'lucy',contentRating:'Everyone',available:true,type:'scene',title:'Lucy'}]}),
  subscribeStatus:()=>()=>{},subscribeLibrary:()=>()=>{}}};
 const React={createElement:choiceContract,useRef:value=>({current:value}),useEffect(){},useId:()=>`recovery-${++next}`,useMemo:fn=>fn(),
  useState:value=>[typeof value==='function'?value():value,()=>{}],useSyncExternalStore:(_subscribe,get)=>get()};
 const ctx={sidebarRight:{openTab(){},mounted:{getSnapshot:()=> 's1',subscribe:()=>()=>{}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_n,fn)=>fn(),register:()=>()=>{}}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,author}),nodes=[];
 function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(typeof n.type==='function'){walk(n.type(n.props));return;}nodes.push(n);(n.children??[]).forEach(walk);}
 walk(api.Body({useTabInfo:()=>({tab:{id:'recovery-tab',visible:true}})}));
 const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
 return {nodes,calls,text,dispose(){api.dispose();assert.equal(listeners.size,0);}};
}
function check(options,fn){const f=rig(options);try{fn(f);}finally{f.dispose();}}
test('own unknown failure exposes one refresh action and retains uncertainty disclosure',()=>check({},f=>{
 const read=f.nodes.find(n=>n.props['data-whale-author-read']);assert.equal(f.text(read),'↻');
 assert.match(read.props.title,/仅清除本侧栏/);assert.match(read.props.title,/不重复下发/);
 assert.equal(f.nodes.some(n=>n.props['data-whale-author-discard-confirm']),false);
 assert.equal(f.nodes.some(n=>n.type==='details'&&/清除待发送记录/.test(f.text(n))),false);
 assert.ok(f.nodes.some(n=>n.props.role==='status'&&/可能已发送；点击↻恢复编辑/.test(f.text(n))));
 assert.deepEqual(f.calls,[]);read.props.onClick();assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'retry');
 assert.equal(f.calls[0][1].discardOwnFailure,true);assert.equal(typeof f.calls[0][1].view,'symbol');
 const help=f.nodes.find(n=>n.props['data-whale-author-source']);assert.match(f.text(help),/不读取壁纸实际值/);assert.match(f.text(help),/失败记录会清除待发送标记/);
}));
for(const options of [{own:false},{stale:true}])test('foreign or stale record keeps manual confirmation '+JSON.stringify(options),()=>check(options,f=>{
 assert.ok(f.nodes.some(n=>n.props['data-whale-author-discard-confirm']));assert.ok(f.nodes.some(n=>n.props['data-whale-author-discard']));
}));
test('pending worker displays wait status and offers no record-clear button',()=>check({pending:true},f=>{
 assert.ok(f.nodes.some(n=>n.props.role==='status'&&/命令仍待结束/.test(f.text(n))));assert.equal(f.nodes.some(n=>n.props['data-whale-author-discard']),false);
}));
test('older author adapter fallback remains read-only',()=>check({compat:true},f=>{
 f.nodes.find(n=>n.props['data-whale-author-read']).props.onClick();assert.deepEqual(f.calls,[['load']]);
}));
