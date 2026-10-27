import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAppearanceSidebar} from '../src/sidebar/native-appearance-sidebar.js';
const ticks=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

// Obtain the actual private Preview component from the sidebar's rendered element tree.
// The hook driver exposes render vs passive-effect cleanup as separate browser phases.
async function rig(){
 const savedIO=globalThis.IntersectionObserver,make=URL.createObjectURL,revoke=URL.revokeObjectURL;
 const active=new Set(),revocations=[],readers=[],observers=[];let frame=null;
 URL.createObjectURL=blob=>{const url=make(blob);active.add(url);return url;};
 URL.revokeObjectURL=url=>{revocations.push(url);active.delete(url);revoke(url);};
 globalThis.IntersectionObserver=class{constructor(cb){this.cb=cb;observers.push(this);}observe(){}disconnect(){}};
 const React={createElement:choiceContract,useId:()=> 'preview-test',useSyncExternalStore:(_off,get)=>get(),
  useState(initial){if(!frame)return[typeof initial==='function'?initial():initial,()=>{}];const index=frame.index++,f=frame;if(!f.cells[index])f.cells[index]={value:typeof initial==='function'?initial():initial};return[f.cells[index].value,value=>{f.cells[index].value=typeof value==='function'?value(f.cells[index].value):value;}];},
  useRef(initial){if(!frame)return{current:initial};const index=frame.index++;return frame.cells[index]??=( {current:initial} );},
  useEffect(fn,deps){if(!frame)return;const index=frame.index++,f=frame,cell=f.cells[index]??={};if(!cell.deps||deps.some((d,i)=>!Object.is(d,cell.deps[i])))f.pending.set(index,{fn,deps});}
 };
 const noSubscribe=()=>()=>{},library={state:'ready',loaded:true,items:[{id:'lucy',title:'Lucy',type:'scene',available:true,contentRating:'Everyone',previewRef:{wallpaperId:'lucy',kind:'preview'}}]};
 const controller={getSettingsSnapshot:()=>({background:'wallpaper',weScene:'lucy',weMode:'daily',weAgeRatings:'Everyone'}),subscribeSettings:noSubscribe,
  wallpaper:{getStatus:()=>({state:'idle',generation:0}),subscribeStatus:noSubscribe,getLibrarySnapshot:()=>library,subscribeLibrary:noSubscribe}};
 const ctx={sidebarRight:{mounted:{getSnapshot:()=> 's1',subscribe:noSubscribe},openTab(){}},sidebarRightTabs:{register:noSubscribe},slots:{inject:(_key,fn)=>fn(),register:noSubscribe}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,loadPreview:(_id,{signal})=>new Promise(resolve=>readers.push({signal,resolve}))});api.showGallery(true);
 let element;function visit(node){if(element||!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(typeof node.type==='function'){if(node.type.name==='Preview'){element=node;return;}visit(node.type(node.props));return;}node.children?.forEach(visit);}
 visit(api.Body({useTabInfo:()=>({tab:{id:'t1',visible:true}})}));assert.ok(element,'actual gallery must expose Preview');
 const f={cells:[],pending:new Map(),index:0};let props={...element.props,visible:true,version:1},last;
 function render(patch={}){props={...props,...patch};f.index=0;frame=f;try{last=element.type(props);}finally{frame=null;}if(last.props.ref)last.props.ref.current={};return last;}
 function effects(){const pending=[...f.pending];f.pending.clear();for(const [index,next] of pending){const cell=f.cells[index];cell.cleanup?.();cell.deps=next.deps;cell.cleanup=next.fn();}}
 const image=node=>(node??last).children.find(child=>child?.type==='img');
 async function ready(){render();effects();observers.at(-1).cb([{isIntersecting:true}]);render();effects();readers.at(-1).resolve(new Blob(['png'],{type:'image/png'}));await ticks();render();assert.ok(image());return image();}
 return{api,active,revocations,readers,render,effects,image,ready,near(value){observers.at(-1).cb([{isIntersecting:value}]);},async resolve(){readers.at(-1).resolve(new Blob(['png'],{type:'image/png'}));await ticks();render();return image();},async cleanup(){for(const cell of f.cells)cell?.cleanup?.();api.dispose();for(const reader of readers)reader.resolve(new Blob(['png'],{type:'image/png'}));await ticks();assert.equal(active.size,0);URL.createObjectURL=make;URL.revokeObjectURL=revoke;if(savedIO===undefined)delete globalThis.IntersectionObserver;else globalThis.IntersectionObserver=savedIO;}};
}
const check=fn=>async()=>{const f=await rig();try{await fn(f);}finally{await f.cleanup();}};
test('viewport departure removes image during render before its passive cleanup revokes URL',check(async f=>{
 const old=await f.ready();f.near(false);assert.equal(f.image(f.render()),undefined);assert.equal(f.active.has(old.props.src),true);f.effects();assert.equal(f.active.has(old.props.src),false);
}));
test('hidden occurrence cannot render an image before cleanup even when it is decoded',check(async f=>{
 await f.ready();assert.equal(f.image(f.render({visible:false})),undefined);f.effects();assert.equal(f.active.size,0);
}));
test('catalogue revision changes cannot render old resource while new effect waits',check(async f=>{
 await f.ready();assert.equal(f.image(f.render({version:2})),undefined);f.effects();assert.equal(f.active.size,0);await f.resolve();assert.equal(f.active.size,1);
}));
test('late image error from old occurrence cannot revoke its replacement or mark it failed',check(async f=>{
 const old=await f.ready();f.render({visible:false});f.effects();f.render({visible:true});f.effects();const current=await f.resolve();assert.notEqual(current.props.src,old.props.src);old.props.onError();f.render();assert.equal(f.image()?.props.src,current.props.src);assert.equal(f.active.has(current.props.src),true);
}));
test('current image error detaches src and releases exactly its own URL once',check(async f=>{
 const img=await f.ready(),removed=[];img.props.onError({currentTarget:{removeAttribute:key=>removed.push(key)}});f.render();assert.deepEqual(removed,['src']);assert.equal(f.image(),undefined);assert.equal(f.active.size,0);f.render({visible:false});f.effects();assert.equal(f.revocations.filter(url=>url===img.props.src).length,1);
}));
test('late preview response after hidden effect cannot allocate a Blob URL',check(async f=>{
 f.render();f.effects();f.near(true);f.render();f.effects();assert.equal(f.readers.length,1);f.render({visible:false});f.effects();await f.resolve();assert.equal(f.active.size,0);assert.equal(f.image(),undefined);
}));
test('return to viewport requests one replacement and never renders revoked URL',check(async f=>{
 const first=await f.ready();f.near(false);f.render();f.effects();f.near(true);assert.equal(f.image(f.render()),undefined);f.effects();const next=await f.resolve();assert.notEqual(next.props.src,first.props.src);assert.equal(f.readers.length,2);assert.equal(f.active.size,1);
}));
