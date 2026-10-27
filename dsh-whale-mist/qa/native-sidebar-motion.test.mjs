import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rig as mediaRig,ticks,file} from './local-media-fixture.mjs';
import {createNativeAppearanceSidebar,createAppearanceEditorGate} from '../src/sidebar/native-appearance-sidebar.js';
function rig({patch={},readOnly=false}={}){
 let settings={brightness:70,mask:40,blur:0,surface:82,chatBackdrop:20,textContrast:'enhanced',theme:'abyss',palette:'jade',accentMode:'custom',accentColor:'#146ab2',background:'video',motion:'focus',canvas:'clear',sidebar:'deep',weScene:'lucy',weMode:'daily',weAutoStart:false,weAgeRatings:'Everyone',...patch},active=settings.theme==='mist'?'whale-mist':'whale-abyss',session='s1',mode='normal',next=0,io=0,status={state:'idle',generation:0};
 const writes=[],listeners=new Set(),statusListeners=new Set(),mountListeners=new Set(),themeListeners=new Set();
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);},editBackgroundVideo(){io++;throw Error('no media import expected');},set(key,value){writes.push([key,value]);if(mode==='throw-before')throw Error('private failure');if(mode==='reject')return settings;settings={...settings,[key]:value};for(const fn of [...listeners])fn();if(mode==='throw-after')throw Error('private failure');return settings;},wallpaper:{getStatus:()=>status,subscribeStatus(fn){statusListeners.add(fn);return()=>statusListeners.delete(fn);},readLibrary(){io++;},start(){io++;},stop(){io++;}}};if(readOnly)delete controller.set;
 const React={useState:value=>[typeof value==='function'?value():value,()=>{}],createElement:choiceContract,useSyncExternalStore:(_subscribe,get)=>get(),useId:()=>`depth-${++next}`,useRef:initial=>({current:initial}),useEffect(){}};
 const ctx={theme:{getTheme:()=>({active:{id:active}})},on(name,fn){assert.equal(name,'theme/change');themeListeners.add(fn);return()=>themeListeners.delete(fn);},sidebarRight:{openTab(){},mounted:{getSnapshot:()=>session,subscribe(fn){mountListeners.add(fn);return()=>mountListeners.delete(fn);}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_key,fn)=>fn(),register:()=>()=>{}}};
 const gate=createAppearanceEditorGate({readBridge:()=>({mode:'docked',unconfirmedCleanup:false}),dock:()=>{throw Error('no dock needed');}}),api=createNativeAppearanceSidebar({ctx,React,controller,editorGate:gate});
 function nodes(){const out=[];const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}if(typeof n.type==='function'){visit(n.type(n.props));return;}out.push(n);n.children.forEach(visit);};visit(api.Body({useTabInfo:()=>({tab:{id:'fixture',visible:true}})}));return out;}
 const select=()=>nodes().find(n=>n.props['data-whale-video-option']==='motion');
 return{api,ctx,gate,controller,writes,nodes,select,status(value){status={state:'idle',generation:0,...value};for(const fn of [...statusListeners])fn();},change:value=>select().props.onChange({currentTarget:{value}}),setMode:v=>{mode=v;},external(patch){settings={...settings,...patch};for(const fn of [...listeners])fn();},setRuntime(id){active=id;for(const fn of [...themeListeners])fn();},setSession(value){session=value;for(const fn of [...mountListeners])fn();},dispose(){api.dispose();gate.dispose();for(const set of [listeners,statusListeners,mountListeners,themeListeners])assert.equal(set.size,0);assert.equal(io,0);}};
}
async function check(options,body){const f=rig(options);try{await body(f);}finally{f.dispose();}}
test('local video motion is labelled inside its source section with only two immediate options',()=>check({},f=>{
 const all=f.nodes(),select=all.find(n=>n.props['data-whale-video-option']==='motion'),section=all.find(n=>n.props['data-whale-local-video']);assert.ok(section);
 assert.equal(select.props.value,'focus');assert.equal(select.props.disabled,false);
 assert.deepEqual(select.children.filter(Boolean).map(n=>[n.props.value,n.children[0]]),[['focus','失焦暂停'],['always','始终播放']]);
 assert.ok(all.some(n=>n.type==='label'&&n.props.htmlFor===select.props.id&&n.children[0]==='播放策略'));
 assert.ok(select.props.title.includes('页面隐藏'));assert.ok(select.props.title.includes('减少动态'));assert.equal(select.props.style.font,'inherit');
 assert.equal(all.some(n=>n.props['data-whale-playback-options']),false);assert.equal(all.filter(n=>n.type==='button'&&n.props.role!=='tab').length,2);
}));
test('legal choices on both themes preserve every unrelated preference including custom accent and opacity',()=>{for(const theme of ['mist','abyss']){const f=rig({patch:{theme}});try{const before=f.controller.getSettingsSnapshot();for(const value of ['always','focus']){assert.equal(f.change(value).ok,true);assert.equal(f.select().props.value,value);assert.deepEqual(f.controller.getSettingsSnapshot(),{...before,motion:value});}assert.deepEqual(f.writes,[['motion','always'],['motion','focus']]);}finally{f.dispose();}}});
test('repeated identical motion choice skips duplicate controller writes',()=>check({},f=>{for(const value of ['focus','always','always'])assert.equal(f.change(value).ok,true);assert.deepEqual(f.writes,[['motion','always']]);}));
test('malformed arbitrary and inherited values cannot enter motion setter',()=>check({},f=>{for(const value of ['',null,undefined,true,0,{},['always'],'Deep','mist','constructor','__proto__'])assert.equal(f.change(value).error,'invalid-video-motion');assert.deepEqual(f.writes,[]);}));
test('missing or damaged video motion preference stays unknown and disabled instead of pretending focus',()=>{for(const value of [undefined,null,'',true,0,{},['always'],'unknown']){const f=rig({patch:{motion:value}});try{assert.equal(f.select().props.value,'');assert.equal(f.select().props.disabled,true);assert.equal(f.select().children[0].children[0],'暂不可用');assert.equal(f.change('focus').error,'appearance-unavailable');assert.deepEqual(f.writes,[]);f.external({motion:'always'});assert.equal(f.select().props.value,'always');assert.equal(f.select().props.disabled,false);}finally{f.dispose();}}});
test('readonly controller disables actual motion value and refuses blind writes',()=>check({readOnly:true},f=>{assert.equal(f.select().props.disabled,true);assert.equal(f.select().props.value,'focus');assert.equal(f.change('always').error,'appearance-unavailable');assert.deepEqual(f.writes,[]);}));
test('unknown preference theme or mismatched actual theme prevents invisible motion changes',()=>check({},f=>{for(const id of ['whale-mist','dark',undefined]){f.setRuntime(id);assert.equal(f.select().props.disabled,true);assert.equal(f.change('always').error,'appearance-unavailable');}f.setRuntime('whale-abyss');assert.equal(f.select().props.disabled,false);f.external({theme:undefined});assert.equal(f.select().props.disabled,true);assert.equal(f.change('always').ok,false);assert.deepEqual(f.writes,[]);}));
test('rejected choice keeps actual value and links only its short field error until explicit retry',()=>check({},f=>{f.setMode('reject');assert.equal(f.change('always').error,'video-motion-update-failed');const all=f.nodes(),select=all.find(n=>n.props['data-whale-video-option']==='motion');assert.equal(select.props.value,'focus');assert.equal(select.props['aria-invalid'],true);assert.ok(all.some(n=>n.props.id===select.props['aria-describedby']&&n.props.role==='alert'&&n.children[0]==='暂时无法更改播放策略，请重试'));assert.equal(all.find(n=>n.props['data-whale-interface-option']==='theme').props['aria-invalid'],undefined);f.setMode('normal');assert.equal(f.change('always').ok,true);assert.equal(f.select().props['aria-invalid'],undefined);}));
test('throw before mutation keeps real old value without leaking technical details',()=>check({},f=>{f.setMode('throw-before');assert.equal(f.change('always').ok,false);assert.equal(f.select().props.value,'focus');assert.deepEqual(f.nodes().find(n=>n.props.role==='alert').children,['暂时无法更改播放策略，请重试']);}));
test('throw after mutation retains actual new preference with honest error and same-value retry without duplicate write',()=>check({},f=>{f.setMode('throw-after');assert.equal(f.change('always').ok,false);assert.equal(f.select().props.value,'always');assert.equal(f.select().props['aria-invalid'],true);f.setMode('normal');assert.equal(f.change('always').ok,true);assert.equal(f.select().props['aria-invalid'],undefined);assert.deepEqual(f.writes,[['motion','always']]);}));
test('external updates and theme changes synchronize without replaying native choice',()=>check({},f=>{f.external({motion:'always'});assert.equal(f.select().props.value,'always');f.external({theme:'mist'});f.setRuntime('whale-mist');assert.equal(f.select().props.value,'always');assert.equal(f.select().props.disabled,false);assert.deepEqual(f.writes,[]);}));
test('session loss old editor admission and disposal reject captured motion handlers',()=>check({},f=>{const late=f.select().props.onChange;f.setSession(undefined);assert.equal(f.select().props.disabled,true);assert.equal(late({currentTarget:{value:'always'}}).error,'no-session');f.setSession('s2');const release=f.gate.acquireLegacy();assert.equal(late({currentTarget:{value:'always'}}).error,'editor-suspended');release();f.api.dispose();assert.equal(late({currentTarget:{value:'always'}}).error,'disposed');assert.deepEqual(f.writes,[]);}));
test('missing runtime read capability disables motion only and never falls back to a default theme',()=>check({},f=>{delete f.ctx.theme.getTheme;f.external({background:'video',motion:'focus'});assert.equal(f.select().props.disabled,true);assert.equal(f.change('always').error,'appearance-unavailable');assert.equal(f.nodes().find(n=>n.props['data-whale-appearance-range']==='blur').props.disabled,false);assert.deepEqual(f.writes,[]);}));
test('native motion choices match original production allowlist without broadening numeric setter',async()=>{const source=await readFile(new URL('../src/client.js',import.meta.url),'utf8');await check({},f=>{assert.deepEqual(f.select().children.filter(Boolean).map(n=>n.props.value),JSON.parse(source.match(/motion: Object.freeze\((\[[^\]]+\])\)/)[1]));assert.equal(f.api.setAppearance('motion','always').error,'invalid-appearance-value');});});

test('motion entry is absent outside local video and stale events cannot change source-specific preferences',()=>check({},f=>{
 const late=f.select().props.onChange;
 for(const background of ['none','image','wallpaper',undefined]){f.external({background});assert.equal(f.select(),undefined);assert.equal(late({currentTarget:{value:'always'}}).error,'appearance-unavailable');}
 assert.deepEqual(f.writes,[]);
}));
test('source change during setter retains authoritative state and reports unconfirmed policy without rollback',()=>check({},f=>{
 const set=f.controller.set;f.controller.set=(key,value)=>{set(key,value);f.external({background:'image'});};
 assert.equal(f.api.setVideoMotion('always').error,'video-motion-update-failed');assert.equal(f.controller.getSettingsSnapshot().background,'image');
 assert.equal(f.api.getSnapshot().videoMotion,'always');assert.equal(f.select(),undefined);assert.deepEqual(f.writes,[['motion','always']]);
}));

test('unknown generation active identity and unconfirmed cleanup disable motion without starting or stopping anything',()=>check({},f=>{
 for(const patch of [{generation:undefined},{generation:-1},{state:'playing'},{activeSceneId:'lucy'},{cleanupPending:true},{host:{cleanupPending:true}}]){
  f.status(patch);assert.equal(f.select().props.disabled,true);assert.equal(f.api.setVideoMotion('always').error,'appearance-unavailable');
 }
 f.status({});assert.equal(f.select().props.disabled,false);assert.deepEqual(f.writes,[]);
}));

test('an in-flight native video replacement disables policy until its own source lane ends',async()=>{
 const f=await mediaRig({kind:'video',background:'video',stored:{blob:file('old.webm','video/webm'),name:'old.webm'}});
 try{f.decode('hold');const pending=f.change('replace',file('new.webm','video/webm'));await ticks();
  assert.equal(f.api.getSnapshot().videoBusy,true);assert.equal(f.api.getSnapshot().canSetVideoMotion,false);
  assert.equal(f.api.setVideoMotion('always').error,'appearance-unavailable');assert.equal(f.get().motion,'focus');
  f.release();assert.equal((await pending).ok,true);assert.equal(f.api.getSnapshot().canSetVideoMotion,true);
 }finally{await f.cleanup();}
});
