import assert from 'node:assert/strict';
import {rig as baseRig} from './background-source-fixture.mjs';
import {createNativeAppearanceSidebar,createAppearanceEditorGate} from '../src/sidebar/native-appearance-sidebar.js';
export const ticks=async(n=120)=>{for(let i=0;i<n;i++)await Promise.resolve();};
export const file=(name='one.png',type='image/png')=>Object.assign(new Blob(['synthetic decoder IO'],{type}),{name});

// Only browser IO is simulated: actual client/controller/backdrop, DB transaction orchestration,
// native sidebar and real Host routes remain unmodified.
export async function rig({kind='image',background='none',stored=null,missing=false}={}){
 const mediaElements=[];
 const records=new Map(stored?[[kind,stored]]:[]),urls=new Set(),held=[],dbLog=[];let decode='ok',dbMode='ok',closed=0,opens=0,readHook=null;
 const f=await baseRig({background,missing,configure(s){
  s.DOMException=DOMException;
  s.URL=class extends URL{static createObjectURL(blob){const u=URL.createObjectURL(blob);urls.add(u);return u;}static revokeObjectURL(u){urls.delete(u);URL.revokeObjectURL(u);}};
  s.document.addEventListener=s.document.removeEventListener=()=>{};
  s.document.hasFocus=()=>true;s.document.body.prepend=()=>{};
  s.document.createElement=tag=>{
   const events=new Map(),attributes=new Map();let src='';
   const consume=()=>{const mode=decode;decode='ok';return mode;};
   const el={tagName:tag.toUpperCase(),dataset:{},children:[],style:{setProperty(){},removeProperty(){}},alt:'',decoding:'',paused:true,loads:0,
    get src(){return src;},set src(value){src=value;if(tag!=='video'||!value)return;const mode=consume(),ready=()=>events.get(mode==='fail'?'error':'loadeddata')?.();if(mode==='hold')held.push(ready);else queueMicrotask(ready);},
    setAttribute(k,v){attributes.set(k,v);},removeAttribute(k){attributes.delete(k);if(k==='src')src='';},getAttribute:k=>attributes.get(k)??null,
    addEventListener(k,fn){events.set(k,fn);},removeEventListener(k,fn){if(events.get(k)===fn)events.delete(k);},
    append(...items){el.children.push(...items);},remove(){},querySelector:()=>el.children[0]??null,
    play(){el.paused=false;return Promise.resolve();},pause(){el.paused=true;},load(){el.loads++;},
    decode(){const mode=consume();if(mode==='fail')return Promise.reject(Error('decode'));if(mode==='hold')return new Promise(resolve=>held.push(resolve));return Promise.resolve();}};
   if(tag==='video'||tag==='img')mediaElements.push(el);return el;
  };
  s.indexedDB={open(){opens++;const request={};const complete=()=>{if(dbMode==='blocked'){request.onblocked?.();return;}const db={close(){closed++;},createObjectStore(){},transaction(_store,mode){
    const tx={error:null},changes=new Map(),deleted=new Set();let pending=0,aborted=false,done=false,queued=false;
    function commit(){if(queued||done)return;queued=true;queueMicrotask(()=>{queued=false;if(done||pending)return;const end=()=>{if(done)return;done=true;if(aborted){tx.onabort?.();return;}for(const [k,v] of changes)records.set(k,v);for(const k of deleted)records.delete(k);tx.oncomplete?.();};if(dbMode==='hold-terminal')held.push(end);else end();});}
    tx.abort=()=>{aborted=true;commit();};
    function operation(op,key,value){if(aborted||done)throw Error('inactive transaction');dbLog.push(op);pending++;const req={};queueMicrotask(()=>{pending--;if(aborted){commit();return;}if(dbMode==='fail'&&op!=='get'){aborted=true;tx.error=Error('quota');commit();return;}
     if(op==='get'){req.result=changes.has(key)?changes.get(key):records.get(key);readHook?.();}else if(op==='put')changes.set(key,value);else deleted.add(key);req.onsuccess?.();commit();});return req;}
    tx.objectStore=()=>({get:k=>operation('get',k),put:(v,k)=>operation('put',k,v),delete:k=>operation('delete',k)});return tx;
   }};request.result=db;request.onsuccess?.();};if(dbMode==='hold-open')held.push(complete);else queueMicrotask(complete);return request;}};
 }});f.startMedia();await ticks();
 const sessionListeners=new Set(),themeListeners=new Set(),token=Symbol('image-view');let session='s1',theme='whale-abyss';
 const ctx={on(_n,fn){themeListeners.add(fn);return()=>themeListeners.delete(fn);},theme:{getTheme:()=>({active:{id:theme}})},sidebarRight:{openTab(){},mounted:{getSnapshot:()=>session,subscribe(fn){sessionListeners.add(fn);return()=>sessionListeners.delete(fn);}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_n,fn)=>fn(),register:()=>()=>{}}};
 const React={createElement:(type,props,...children)=>({type,props:props??{},children}),useSyncExternalStore:(_off,get)=>get(),useId:()=> 'image-error',useRef:initial=>({current:typeof initial==='symbol'?token:initial}),useState:i=>[typeof i==='function'?i():i,()=>{}],useEffect(){}};
 const gate=createAppearanceEditorGate({readBridge:()=>({mode:'docked',unconfirmedCleanup:false}),dock(){throw Error('unexpected window');}});
 const playback={read:()=>({busy:false,draining:false,unknown:false,canStart:true,canStop:true}),subscribe:()=>()=>{}};
 const api=createNativeAppearanceSidebar({ctx,React,controller:f.controller,editorGate:gate,playback});api.registerView(token);api.viewVisible(token,true);
 return{...f,api,token,records,mediaElements,dbLog,urls,decode:v=>{decode=v;},dbMode:v=>{dbMode=v;},readHook:fn=>{readHook=fn;},release(){for(const fn of held.splice(0))fn();},async change(action='replace',value=file(kind==='image'?'one.png':'one.webm',kind==='image'?'image/png':'video/webm')){return api[kind+'Action'](action,value,api.getSnapshot()[kind+'Ticket'],token);},hide(){api.viewVisible(token,false);},show(){api.viewVisible(token,true);},session(v){session=v;for(const fn of sessionListeners)fn();},theme(v){theme=v;for(const fn of themeListeners)fn();},async cleanup(){dbMode='ok';decode='ok';readHook=null;for(const fn of held.splice(0))fn();await ticks();api.dispose();gate.dispose();await f.cleanup();assert.equal(urls.size,0);assert.ok(closed<=opens);}};
}
