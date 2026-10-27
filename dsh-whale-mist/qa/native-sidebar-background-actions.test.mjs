import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rig as controllerRig} from './background-source-fixture.mjs';
import {createNativeAppearanceSidebar,createAppearanceEditorGate} from '../src/sidebar/native-appearance-sidebar.js';

const ticks=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function rig(options){
 const base=await controllerRig(options),{controller}=base;
 const events=new Set(),mounts=new Set(),token=Symbol('view');let session='s1',theme='whale-abyss';
 const ctx={on:(_name,fn)=>{events.add(fn);return()=>events.delete(fn);},theme:{getTheme:()=>({active:{id:theme}})},
  sidebarRight:{openTab(){},mounted:{getSnapshot:()=>session,subscribe(fn){mounts.add(fn);return()=>mounts.delete(fn);}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_name,fn)=>fn(),register:()=>()=>{}}};
 const React={createElement:choiceContract,useSyncExternalStore:(_off,get)=>get(),useId:()=> 'source-error',useRef:()=>({current:token}),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect(){}};
 const editorGate=createAppearanceEditorGate({readBridge:()=>({mode:'docked',unconfirmedCleanup:false}),dock(){throw Error('no window IO');}});
 const playback={read:()=>({busy:false,draining:false,unknown:false,canStart:true,canStop:true,error:null}),subscribe:()=>()=>{}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,editorGate,playback});const viewAbort=new AbortController();api.registerView(token,viewAbort.signal);api.viewVisible(token,true);
 function nodes(){const result=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}if(typeof n.type==='function'){visit(n.type(n.props));return;}result.push(n);n.children.forEach(visit);}visit(api.Body({useTabInfo:()=>({tab:{id:'test',visible:true}})}));return result;}
 const button=kind=>nodes().find(n=>n.props[`data-whale-${kind}-wallpaper`]);
 return{...base,api,editorGate,nodes,button,token,hide(){api.viewVisible(token,false);},show(){api.viewVisible(token,true);},abort(){viewAbort.abort();},session(value){session=value;for(const fn of [...mounts])fn();},theme(value){theme=value;for(const fn of [...events])fn();},async cleanup(){api.dispose();editorGate.dispose();assert.equal(events.size,0);assert.equal(mounts.size,0);await base.cleanup();}};
}
const check=(fn,options)=>async()=>{const f=await rig(options);try{await fn(f);}finally{await f.cleanup();}};
const ordinary=f=>f.calls.filter(c=>/\/whale-wallpaper\/(start|restart|stop)$/.test(c.url));

test('actual sidebar closes and re-enables through actual controller Host and strict persistence',check(async f=>{
 const n=ordinary(f).length,before=f.get();assert.equal(f.button('close').children[0],'关闭背景');assert.equal((await f.button('close').props.onClick()).ok,true);assert.equal(f.get().background,'none');assert.equal(f.stored().background,'none');assert.equal(f.button('close'),undefined);
 assert.equal((await f.button('enable').props.onClick()).ok,true);assert.deepEqual(f.get(),before);assert.equal(f.stored().background,'wallpaper');assert.equal(f.host.api.generation(),1);assert.equal(f.host.sessions.length,0);assert.equal(ordinary(f).length,n);assert.equal(f.writes.length,2);
}));
test('busy feedback disables both source and playback without replaying captured clicks',check(async f=>{
 const late=f.button('close').props.onClick,work=late();assert.equal(f.button('close').props['aria-busy'],true);assert.equal(f.button('close').props.disabled,true);assert.equal(f.api.getSnapshot().canPlay,false);assert.equal((await late()).ok,false);assert.equal((await work).ok,true);assert.equal((await late()).ok,false);assert.equal(f.writes.length,1);
}));
test('cold enable uses busy state then exposes manual start and never starts playback',check(async f=>{
 const work=f.button('enable').props.onClick();assert.equal(f.button('enable').props['aria-busy'],true);assert.equal(f.button('enable').props['aria-label'],'正在启用…');assert.equal((await work).ok,true);assert.equal(f.nodes().find(n=>n.props['data-whale-playback-action']).props['aria-label'],'开始播放');assert.equal(f.host.sessions.length,0);
},{background:'none'}));
test('no registered visible occurrence can invoke either source action',check(async f=>{
 assert.equal((await f.api.closeWallpaper(f.api.getSnapshot().closeWallpaperTicket,Symbol())).error,'background-view-unavailable');f.hide();assert.equal((await f.button('close').props.onClick()).error,'background-view-unavailable');assert.equal(f.writes.length,0);
}));
test('hidden aborted session replaced theme changed and legacy occupied views cancel before IO',async()=>{
 for(const mutate of [f=>f.hide(),f=>f.abort(),f=>f.session('s2'),f=>f.theme('whale-mist'),f=>f.editorGate.acquireLegacy()]){
  const f=await rig();try{const n=f.calls.length,p=f.button('close').props.onClick();mutate(f);assert.equal((await p).ok,false);assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);}finally{await f.cleanup();}
 }
});
test('hiding while real inspect is in flight preserves none source and never activates',check(async f=>{
 assert.equal((await f.button('close').props.onClick()).ok,true);let release;const hold=new Promise(resolve=>{release=resolve;});let seen=false;f.transport(async(url,_opts,response)=>{if(url.endsWith('/inspect')){seen=true;await hold;}return response;});const p=f.button('enable').props.onClick();await ticks();assert.equal(seen,true);f.hide();release();assert.equal((await p).ok,false);assert.equal(f.get().background,'none');assert.equal(f.calls.some(c=>c.url.endsWith('/activate')),false);assert.equal(f.writes.length,1);
}));
test('pending Host cleanup performs one inspection and waits for a new explicit check',check(async f=>{
 const stop=f.host.gate();f.host.next({stopGate:stop});await f.host.start();const result=await f.button('close').props.onClick();assert.equal(result.ok,false);assert.equal(f.get().background,'wallpaper');const count=f.calls.length;await ticks();assert.equal(f.calls.length,count);assert.equal(f.calls.filter(c=>c.url.endsWith('/prepare')).length,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/inspect')).length,1);assert.equal(f.button('close').children[0],'检查关闭');stop.release();await ticks();const checked=await f.button('close').props.onClick();assert.equal(checked.ok,true,JSON.stringify({checked,state:f.controller.readBackgroundCloseState(),view:f.api.getSnapshot()}));assert.equal(f.writes.length,1);assert.equal(f.host.sessions[0].calls.filter(c=>c==='stop').length,1);
}));
test('unconfirmed cleanup offers explicit retry only and keeps normal stop recovery',check(async f=>{
 f.host.next({closeResult:{closed:false}});await f.host.start();assert.equal((await f.button('close').props.onClick()).ok,false);assert.equal(f.button('close').children[0],'重试关闭');assert.equal(f.button('close').props.disabled,false);assert.equal(f.nodes().find(n=>n.props['data-whale-playback-action']).props['data-whale-playback-action'],'stop');const count=f.calls.length;await ticks();assert.equal(f.calls.length,count);f.host.sessions[0].options.closeResult={closed:true};assert.equal((await f.button('close').props.onClick()).ok,true);assert.equal(f.host.sessions[0].calls.filter(c=>c==='stop').length,2);
}));
test('failed close save retains wallpaper and only fresh explicit inspection can retry',check(async f=>{
 f.hook((op,_k,_v,actual)=>{if(op==='set')throw Error('private');return actual();});const late=f.button('close').props.onClick;assert.equal((await late()).ok,false);assert.equal(f.get().background,'wallpaper');assert.equal(f.button('close').children[0],'检查关闭');assert.equal((await late()).ok,false);assert.ok(!JSON.stringify(f.nodes()).includes('private'));f.hook(null);assert.equal((await f.button('close').props.onClick()).ok,true);
}));
test('write after throw renders actual none and applied error without a fake enabled source',check(async f=>{
 f.hook((op,_k,_v,actual)=>{const r=actual();if(op==='set')throw Error('private');return r;});const r=await f.button('close').props.onClick();assert.equal(r.applied,true);assert.equal(f.get().background,'none');assert.ok(f.button('enable'));assert.equal(f.button('close'),undefined);assert.deepEqual(f.nodes().find(n=>n.props.role==='alert').children,['设置已保存，请核对当前状态']);assert.equal(f.writes.length,1);
}));
test('forged ticket stale generation and a returning session cannot reuse a close click',check(async f=>{
 const late=f.button('close').props.onClick;assert.equal(f.api.closeWallpaper({},f.token).ok,false);f.session('s2');f.session('s1');assert.equal((await late()).error,'background-close-stale');assert.equal(f.writes.length,0);assert.equal((await f.button('close').props.onClick()).ok,true);
}));
test('disposing the sidebar cancels a queued close with no writes or new Host calls',check(async f=>{
 const n=f.calls.length,p=f.button('close').props.onClick();f.api.dispose();assert.equal((await p).ok,false);assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);
}));
test('a hidden then visible occurrence revokes the old close click even with identical settings',check(async f=>{
 const late=f.button('close').props.onClick;f.hide();f.show();assert.equal((await late()).error,'background-close-stale');assert.equal(f.writes.length,0);assert.equal((await f.button('close').props.onClick()).ok,true);
}));
test('closing again after strict re-enable starts a new fence rather than inspecting released ownership forever',check(async f=>{
 for(let i=0;i<2;i++){assert.equal(f.button('close').children[0],'关闭背景');assert.equal((await f.button('close').props.onClick()).ok,true);assert.equal((await f.button('enable').props.onClick()).ok,true);}assert.equal(f.host.api.generation(),2);assert.equal(f.calls.filter(c=>c.url.endsWith('/prepare')).length,2);assert.equal(f.host.sessions.length,0);
}));
