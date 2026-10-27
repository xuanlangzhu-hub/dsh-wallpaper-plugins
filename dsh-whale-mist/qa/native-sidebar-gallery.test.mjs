import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAppearanceSidebar,nativeGalleryItems,createNativePreviewQueue} from '../src/sidebar/native-appearance-sidebar.js';
const id=n=>'we-'+n.toString(16).padStart(24,'0');
const row=(n,extra={})=>({id:id(n),title:'Ocean '+n,type:'scene',available:true,contentRating:'Everyone',previewRef:{wallpaperId:id(n),kind:'preview'},...extra});
const ready=items=>({state:'ready',loaded:true,items});
const flush=async()=>{for(let n=0;n<6;n++)await Promise.resolve();};
function rig(items=[]){
 let settings={background:'wallpaper',weScene:'lucy',weMode:'daily',weAgeRatings:'Everyone',brightness:70,mask:45},library=ready(items),status={state:'idle',activeSceneId:null},mode='normal',nextId=0;
 const listeners={settings:new Set(),status:new Set(),library:new Set()},slots=new Map(),writes=[];
 const emit=key=>{for(const fn of listeners[key])fn();};
 const subscribe=key=>fn=>{listeners[key].add(fn);return()=>listeners[key].delete(fn);};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings:subscribe('settings'),set(key,value){writes.push([key,value]);if(mode==='throw')throw Error('private raw detail');if(mode==='reject')return settings;settings={...settings,[key]:value};emit('settings');return settings;},
  wallpaper:{getStatus:()=>status,getLibrarySnapshot:()=>library,subscribeLibrary:subscribe('library'),subscribeStatus:subscribe('status'),readLibrary:()=>assert.fail('Unexpected catalogue IO'),start:()=>assert.fail('Unexpected start'),stop:()=>assert.fail('Unexpected stop')}};
 const React={Fragment:'fragment',createElement:choiceContract,useSyncExternalStore:(_sub,get)=>get(),useRef:value=>({current:value}),useEffect:()=>{},useId:()=>`id-${++nextId}`,useState:value=>[typeof value==='function'?value():value,()=>{}]};
 const ctx={sidebarRight:{mounted:{subscribe:()=>()=>{},getSnapshot:()=> 's1'},openTab(){}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_name,fn)=>fn(),register(def,component){slots.set(def.name,component);return()=>slots.delete(def.name);}}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,loadPreview:()=>assert.fail('Unexpected preview IO from pure render')});
 function nodes(){const all=[];function visit(n){if(!n||typeof n!=='object')return;if(typeof n.type==='function')return visit(n.type(n.props));all.push(n);for(const c of n.children??[])visit(c);}visit(api.Body({useTabInfo:()=>({tab:{id:'tab',visible:true}})}));return all;}
 return {api,writes,nodes,settings:()=>settings,library(value){library=value;emit('library');},status(value){status=value;emit('status');},mode(value){mode=value;},external(patch){settings={...settings,...patch};emit('settings');},dispose(){api.dispose();for(const list of Object.values(listeners))assert.equal(list.size,0);assert.equal(slots.size,0);}};
}
async function run(items,fn){const f=rig(items);try{await fn(f);}finally{f.dispose();}}

test('model filters ratings before exposing titles or preview capabilities',()=>{const rows=nativeGalleryItems(ready([row(1),row(2,{contentRating:'Mature',title:'Hidden adult'}),row(3,{contentRating:'unknown'})]),['Everyone']);assert.deepEqual(rows.map(row=>row.id),['lucy',id(1)]);assert.ok(!JSON.stringify(rows).includes('Hidden adult'));});
test('model rejects malformed identities duplicate entries and non-ready data',()=>{assert.deepEqual(nativeGalleryItems({state:'loading',loaded:true,items:[row(1)]},['Everyone']),[]);const rows=nativeGalleryItems(ready([row(1),row(1),row(2,{id:'../bad'})]),['Everyone']);assert.equal(rows.length,2);});
test('model does not use supplied preview URLs or unsupported preview references',()=>{const rows=nativeGalleryItems(ready([row(1,{previewRef:{wallpaperId:id(2),kind:'preview'},previewUrl:'https://external.invalid/secret'}),row(2,{type:'application'})]),['Everyone']);assert.equal(rows[1].hasPreview,false);assert.equal(rows[2].hasPreview,false);assert.equal(rows[2].selectable,false);assert.ok(!JSON.stringify(rows).includes('external.invalid'));});
test('gallery defaults to current view and opening/search never scans or writes settings',()=>run([row(1)],f=>{assert.equal(f.api.getSnapshot().galleryOpen,false);f.api.showGallery(true);f.api.search('Ocean');f.nodes();assert.equal(f.api.getSnapshot().galleryRows.length,1);assert.deepEqual(f.writes,[]);}));
test('search is case insensitive bounded and applied only after rating filtering',()=>run([row(1),row(2,{contentRating:'Mature',title:'Hidden adult'})],f=>{f.api.showGallery(true);f.api.search('OCEAN');assert.equal(f.api.getSnapshot().galleryCount,1);f.api.search('Hidden');assert.equal(f.api.getSnapshot().galleryCount,0);f.api.search('x'.repeat(500));assert.equal(f.api.getSnapshot().galleryQuery.length,200);}));
test('large catalogue mounts at most twelve cards and pagination clamps after search',()=>run(Array.from({length:25},(_,i)=>row(i+1)),f=>{f.api.showGallery(true);assert.equal(f.api.getSnapshot().galleryPages,3);assert.equal(f.api.getSnapshot().galleryRows.length,12);assert.equal(f.nodes().filter(n=>n.props['data-whale-gallery-item']).length,12);f.api.changePage(1);f.api.changePage(1);assert.equal(f.api.getSnapshot().galleryRows.length,2);f.api.changePage(1);assert.equal(f.api.getSnapshot().galleryPage,2);f.api.search('Ocean 25');assert.equal(f.api.getSnapshot().galleryPage,0);assert.equal(f.api.getSnapshot().galleryPages,1);}));
test('empty rating selection remains empty and never falls back to Everyone',()=>run([row(1)],f=>{f.api.showGallery(true);f.api.setRating('Everyone',false);assert.equal(f.settings().weAgeRatings,'');assert.equal(f.api.getSnapshot().galleryRows.length,0);assert.equal(f.nodes().filter(n=>n.props['data-whale-gallery-item']).length,0);}));
test('each rating checkbox changes only the existing persisted rating field',()=>run([row(1),row(2,{contentRating:'Mature'})],f=>{f.api.showGallery(true);f.api.setRating('Mature',true);assert.equal(f.settings().weAgeRatings,'Everyone,Mature');assert.equal(f.api.getSnapshot().galleryCount,3);f.api.setRating('Questionable',true);assert.equal(f.settings().weAgeRatings,'Everyone,Questionable,Mature');assert.equal(f.settings().weScene,'lucy');assert.ok(f.writes.every(([key])=>key==='weAgeRatings'));}));
test('explicit selection persists only weScene and returns to current controls',()=>run([row(1)],f=>{f.api.showGallery(true);assert.equal(f.api.selectWallpaper(id(1)).ok,true);assert.deepEqual(f.writes,[['weScene',id(1)]]);assert.equal(f.api.getSnapshot().galleryOpen,false);assert.equal(f.settings().background,'wallpaper');assert.equal(f.settings().weMode,'daily');}));
test('choosing a different item never stops or replaces the active source',()=>run([row(1)],f=>{f.status({state:'playing',host:{activeSceneId:'lucy'},generation:2});f.api.showGallery(true);f.api.selectWallpaper(id(1));assert.equal(f.api.getSnapshot().activeId,'lucy');assert.equal(f.api.getSnapshot().selectedId,id(1));assert.equal(f.api.getSnapshot().playAction,'stop');assert.equal(f.nodes().find(n=>n.props['data-whale-selected-target']).children[0],'所选：Ocean 1');}));
test('hidden unavailable unsupported or removed entries cannot be selected via old handles',()=>run([row(1,{contentRating:'Mature'}),row(2,{available:false}),row(3,{type:'application'}),row(4)],f=>{f.api.showGallery(true);for(const n of [1,2,3])assert.equal(f.api.selectWallpaper(id(n)).ok,false);f.library(ready([]));assert.equal(f.api.selectWallpaper(id(4)).ok,false);assert.deepEqual(f.writes,[]);}));
test('shrinking the age filter immediately removes adult titles and stale selection eligibility',()=>run([row(1,{contentRating:'Mature',title:'Private adult title'})],f=>{f.api.showGallery(true);f.api.setRating('Mature',true);assert.ok(JSON.stringify(f.nodes()).includes('Private adult title'));f.api.setRating('Mature',false);assert.ok(!JSON.stringify(f.nodes()).includes('Private adult title'));assert.equal(f.api.selectWallpaper(id(1)).ok,false);}));
test('selection setter rejection and exception stay in gallery with a short error',async()=>{for(const mode of ['reject','throw'])await run([row(1)],f=>{f.api.showGallery(true);f.mode(mode);assert.equal(f.api.selectWallpaper(id(1)).ok,false);assert.equal(f.api.getSnapshot().galleryOpen,true);assert.equal(f.api.getSnapshot().selectionError,'暂时无法选择这张壁纸');});});
test('rating rejection does not pretend the filter changed',()=>run([row(1)],f=>{f.api.showGallery(true);f.mode('reject');f.api.setRating('Mature',true);assert.equal(f.api.getSnapshot().galleryRatings,'Everyone');assert.ok(f.api.getSnapshot().selectionError);}));
test('current snapshot and gallery arrays remain stable between notifications',()=>run([row(1)],f=>{f.api.showGallery(true);const before=f.api.getSnapshot();f.nodes();f.status({state:'idle'});assert.equal(f.api.getSnapshot(),before);f.api.search('Ocean');const current=f.api.getSnapshot();f.status({state:'idle'});assert.equal(f.api.getSnapshot(),current);}));
test('root disposal rejects stale selection and produces no additional writes',()=>run([row(1)],f=>{f.api.showGallery(true);f.dispose();assert.equal(f.api.selectWallpaper(id(1)).error,'disposed');assert.deepEqual(f.writes,[]);}));

test('current object preview uses full approved metadata independently of search and pagination',()=>run(Array.from({length:25},(_,i)=>row(i+1)),f=>{
 f.external({weScene:id(25)});const preview=f.api.getSnapshot().objectPreview;assert.equal(preview.id,id(25));
 f.api.showGallery(true);f.api.search('Ocean 1');assert.equal(f.api.getSnapshot().objectPreview,preview);
 f.api.search('');f.api.changePage(1);assert.equal(f.api.getSnapshot().objectPreview,preview);assert.deepEqual(f.writes,[]);
}));
test('active wallpaper owns the thumbnail while another wallpaper is selected without switching source',()=>run([row(1),row(2)],f=>{
 f.external({weScene:id(2)});f.status({state:'playing',activeSceneId:id(1),host:{activeSceneId:id(1)}});
 assert.equal(f.api.getSnapshot().objectPreview.id,id(1));assert.equal(f.api.getSnapshot().selectedId,id(2));
 assert.equal(f.api.getSnapshot().playAction,'stop');assert.deepEqual(f.writes,[]);
}));
test('conflicting malformed and unknown active identities never borrow the selected thumbnail',()=>run([row(1),row(2)],f=>{
 f.external({weScene:id(2)});
 for(const status of [
  {state:'playing',activeSceneId:id(1),host:{activeSceneId:id(2)}},
  {state:'playing',activeSceneId:'untrusted',host:{activeSceneId:id(1)}},
  {state:'playing',activeSceneId:{}},{state:'waiting',activeSceneId:null},
  {state:'unknown',activeSceneId:null},{state:'starting',activeSceneId:null},
  {state:'stopping',activeSceneId:null,cleanupPending:true}
 ]){f.status(status);assert.equal(f.api.getSnapshot().objectPreview,null);}
 assert.deepEqual(f.writes,[]);
}));
test('removing an age rating withdraws both selected and active object preview immediately',()=>run([row(1,{contentRating:'Mature',title:'Private poster'})],f=>{
 f.external({weScene:id(1),weAgeRatings:'Everyone,Mature'});assert.equal(f.api.getSnapshot().objectPreview.id,id(1));
 f.status({state:'playing',activeSceneId:id(1)});f.external({weAgeRatings:'Everyone'});assert.equal(f.api.getSnapshot().objectPreview,null);
 assert.ok(!JSON.stringify(f.nodes()).includes('Private poster'));f.external({weAgeRatings:''});assert.equal(f.api.getSnapshot().objectPreview,null);
 assert.deepEqual(f.writes,[]);
}));
test('unavailable unsupported missing and forged preview references cannot supply current thumbnail',()=>run([
 row(1,{available:false}),row(2,{type:'application'}),row(3,{previewRef:null}),
 row(4,{previewRef:{wallpaperId:id(5),kind:'preview'},previewUrl:'https://external.invalid/private'}),row(5,{contentRating:'unknown'})
],f=>{
 for(const n of [1,2,3,4,5,6]){f.external({weScene:id(n)});assert.equal(f.api.getSnapshot().objectPreview,null);}
 assert.deepEqual(f.writes,[]);
}));
test('catalogue loading failure and replacement withdraw or replace the approved preview generation',()=>run([row(1)],f=>{
 f.external({weScene:id(1)});const first=f.api.getSnapshot();assert.equal(first.objectPreview.id,id(1));
 for(const library of [{loaded:false,state:'idle'},{loaded:true,state:'loading',loading:true,items:[row(1)]},{loaded:true,state:'ready',ok:false,items:[row(1)]}]){
  f.library(library);assert.equal(f.api.getSnapshot().objectPreview,null);
 }
 f.library(ready([row(1)]));assert.equal(f.api.getSnapshot().objectPreview.id,id(1));assert.notEqual(f.api.getSnapshot().galleryVersion,first.galleryVersion);
 assert.deepEqual(f.writes,[]);
}));
test('ordinary local media never reuses the selected WE poster and none retains only its selected metadata',()=>run([row(1)],f=>{
 f.external({weScene:id(1)});
 for(const background of ['image','video',null,'broken']){f.external({background});assert.equal(f.api.getSnapshot().objectPreview,null);}
 f.external({background:'none'});assert.equal(f.api.getSnapshot().objectPreview.id,id(1));assert.deepEqual(f.writes,[]);
}));
test('built-in Lucy preview requires ready metadata and explicit Everyone permission',()=>run([],f=>{
 assert.equal(f.api.getSnapshot().objectPreview.id,'lucy');f.external({weAgeRatings:'Mature'});assert.equal(f.api.getSnapshot().objectPreview,null);
 f.external({weAgeRatings:'Everyone'});f.library({loaded:false,state:'idle'});assert.equal(f.api.getSnapshot().objectPreview,null);assert.deepEqual(f.writes,[]);
}));

function clock(){let next=0;const jobs=new Map();return {jobs,setTimeout(fn,ms){assert.equal(ms,4000);const id=++next;jobs.set(id,fn);return id;},clearTimeout:id=>jobs.delete(id),fire(){for(const [id,fn] of [...jobs]){jobs.delete(id);fn();}}};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const image=()=>new Blob(['png'],{type:'image/png'});
test('preview queue bounds physical concurrency at two',async()=>{const timers=clock(),tasks=[],queue=createNativePreviewQueue((id,{signal})=>{const task={...deferred(),id,signal};tasks.push(task);return task.promise;},{timers});const a=queue.request(id(1)),b=queue.request(id(2)),c=queue.request(id(3));assert.equal(tasks.length,2);assert.deepEqual(queue.read(),{active:2,queued:1});tasks[0].resolve(image());await a;await flush();assert.equal(tasks.length,3);tasks[1].resolve(image());tasks[2].resolve(image());await Promise.all([b,c]);queue.dispose();assert.equal(timers.jobs.size,0);});
test('cancelled queued preview never performs image IO',async()=>{const timers=clock(),tasks=[],queue=createNativePreviewQueue(()=>{const task=deferred();tasks.push(task);return task.promise;},{timers});const a=queue.request(id(1)),b=queue.request(id(2)),abort=new AbortController(),c=queue.request(id(3),{signal:abort.signal}),rejected=assert.rejects(c,/preview-unavailable/);abort.abort();await rejected;assert.equal(tasks.length,2);tasks.forEach(task=>task.resolve(image()));await Promise.all([a,b]);queue.dispose();assert.equal(timers.jobs.size,0);});
test('timeout returns a placeholder failure but keeps a non-aborting reader physical slot',async()=>{const timers=clock(),tasks=[],queue=createNativePreviewQueue(()=>{const task=deferred();tasks.push(task);return task.promise;},{timers});const a=queue.request(id(1)),b=queue.request(id(2)),c=queue.request(id(3));const done=Promise.all([assert.rejects(a),assert.rejects(b),assert.rejects(c)]);timers.fire();await done;assert.equal(tasks.length,2);assert.deepEqual(queue.read(),{active:2,queued:0});tasks.forEach(task=>task.resolve(image()));await flush();assert.equal(queue.read().active,0);queue.dispose();});
test('late preview after caller abort is rejected without retry',async()=>{const timers=clock(),pending=deferred(),abort=new AbortController();let calls=0;const queue=createNativePreviewQueue(()=>{calls++;return pending.promise;},{timers});const result=queue.request(id(1),{signal:abort.signal}),done=assert.rejects(result);abort.abort();await done;pending.resolve(image());await flush();assert.equal(calls,1);assert.equal(timers.jobs.size,0);queue.dispose();});
test('preview MIME and size boundaries reject SVG HTML empty and oversized data',async()=>{for(const blob of [new Blob(['svg'],{type:'image/svg+xml'}),new Blob(['html'],{type:'text/html'}),new Blob([],{type:'image/png'}),{type:'image/png',size:4*1024*1024+1}]){const timers=clock(),queue=createNativePreviewQueue(()=>blob,{timers});await assert.rejects(queue.request(id(1)));assert.equal(timers.jobs.size,0);queue.dispose();}});
test('sync throw and unavailable loader are bounded errors',async()=>{const timers=clock(),queue=createNativePreviewQueue(()=>{throw Error('raw');},{timers});await assert.rejects(queue.request(id(1)),/preview-unavailable/);assert.equal(timers.jobs.size,0);queue.dispose();await assert.rejects(createNativePreviewQueue(null).request(id(1)));});
test('queue disposal aborts active readers clears deadlines and consumes late rejections',async()=>{const timers=clock(),tasks=[],queue=createNativePreviewQueue((_id,{signal})=>{const task={...deferred(),signal};tasks.push(task);return task.promise;},{timers});const a=queue.request(id(1)),b=queue.request(id(2)),done=Promise.all([assert.rejects(a),assert.rejects(b)]);queue.dispose();await done;assert.ok(tasks.every(task=>task.signal.aborted));tasks.forEach(task=>task.reject(Error('late')));await flush();assert.equal(timers.jobs.size,0);assert.equal(queue.read().active,0);});

// Display states are deliberately independent from the next selected wallpaper.
test('gallery marks the reported playing source separately from the next selected item',()=>run([row(1)],f=>{
 f.status({state:'playing',activeSceneId:'lucy',host:{activeSceneId:'lucy'},generation:2});f.api.showGallery(true);f.api.selectWallpaper(id(1));f.api.showGallery(true);
 const nodes=f.nodes(),items=nodes.filter(n=>n.props['data-whale-gallery-item']);assert.equal(items.find(n=>n.props['data-whale-gallery-item']===id(1)).props['aria-pressed'],true);assert.equal(items.find(n=>n.props['data-whale-gallery-item']==='lucy').props['aria-pressed'],false);
 assert.equal(nodes.filter(n=>n.props['data-whale-gallery-playing']).length,1);assert.equal(nodes.filter(n=>n.props['data-whale-gallery-selected']).length,1);assert.deepEqual(f.writes,[['weScene',id(1)]]);
}));
test('gallery never labels a retained active id as playing while waiting stopping stopped or cleanup is pending',()=>run([],f=>{
 f.api.showGallery(true);
 for(const state of ['connecting','waiting','stopping','stopped','cleanup-failed','unknown']){f.status({state,activeSceneId:'lucy',host:{activeSceneId:'lucy'},generation:2});assert.equal(f.nodes().filter(n=>n.props['data-whale-gallery-playing']).length,0);}
 f.status({state:'playing',activeSceneId:'lucy',cleanupPending:true,host:{activeSceneId:'lucy'},generation:2});assert.equal(f.nodes().filter(n=>n.props['data-whale-gallery-playing']).length,0);assert.deepEqual(f.writes,[]);
}));
test('compact gallery keeps full long titles and unavailable metadata accessible without opening a source',()=>run([row(1,{title:'A very long wallpaper title / with symbols <img> and Unicode 海'}),row(2,{available:false})],f=>{
 f.api.showGallery(true);const nodes=f.nodes(),item=nodes.find(n=>n.props['data-whale-gallery-item']===id(1));assert.equal(item.props.title,item.props['aria-label']);assert.match(item.props.title,/Unicode 海/);
 const unavailable=nodes.find(n=>n.props['data-whale-gallery-item']===id(2));assert.equal(unavailable.props.disabled,true);const info=nodes.find(n=>n.props.id===unavailable.props['aria-describedby']);assert.equal(info.props.hidden,true);assert.match(info.children[0],/不可选择/);assert.deepEqual(f.writes,[]);
}));
