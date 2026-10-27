import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAppearanceSidebar,createNativePlaybackGate,attachNativeAppearanceSidebar} from '../src/sidebar/native-appearance-sidebar.js';

const other='we-'+'a'.repeat(24);
const turn=async()=>{await Promise.resolve();await Promise.resolve();};
function clock(){let seq=0;const jobs=new Map();return {jobs,setTimeout(fn,ms){assert.equal(ms,12000);const id=++seq;jobs.set(id,fn);return id;},clearTimeout:id=>jobs.delete(id),fire(){for(const [id,fn] of [...jobs]){jobs.delete(id);fn();}}};}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture({settings:patch={},status:initial={},library:lib,shared,gateOptions}={}){
 const listeners={settings:new Set(),status:new Set(),library:new Set(),mounted:new Set()},calls=[],slots=new Map();
 let settings={background:'wallpaper',weScene:'lucy',weMode:'daily',weAgeRatings:'Everyone',brightness:70,mask:45,...patch};
 let status={state:'idle',activeSceneId:null,cleanupPending:false,...initial};
 let library=lib??{loaded:true,state:'ready',loading:false,items:[{id:'lucy',title:'Lucy',available:true,type:'scene',contentRating:'Everyone'}]};
 let session='s1',pendingFlag=false,startTask=null,stopTask=null,childCleanup=[],dependencyCallback,serial=0;
 const emit=key=>{for(const fn of [...listeners[key]])fn();};
 const setStatus=patch=>{status=patch;emit('status');};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings:fn=>{listeners.settings.add(fn);return()=>listeners.settings.delete(fn);},
  wallpaper:{getStatus:()=>status,hasPendingCleanup:()=>pendingFlag,
   getLibrarySnapshot:()=>library,subscribeLibrary:fn=>{listeners.library.add(fn);return()=>listeners.library.delete(fn);},subscribeStatus:fn=>{listeners.status.add(fn);return()=>listeners.status.delete(fn);},
   start(id,mode){calls.push(['start',id,mode]);setStatus({state:'starting',activeSceneId:null,cleanupPending:false});return startTask?.promise??Promise.resolve(status);},
   stop(reason){calls.push(['stop',reason]);setStatus({state:'stopped',cleanupPending:true,activeSceneId:null});if(stopTask)return stopTask.promise;setStatus({state:'stopped',cleanupPending:false,activeSceneId:null});return Promise.resolve(status);},
  }};
 const React={useState:value=>[typeof value==='function'?value():value,()=>{}],createElement:choiceContract,useSyncExternalStore:(_fn,get)=>get(),useId:()=>`test-${++serial}`,useRef:value=>({current:value}),useEffect:()=>{}};
 const ctx={effect(fn){const off=fn();childCleanup.push(off);},
  inject(_deps,fn){dependencyCallback=fn;return {dispose:async()=>withdraw()};},
  sidebarRightTabs:{register:()=>()=>{}},sidebarRight:{mounted:{getSnapshot:()=>session,subscribe:fn=>{listeners.mounted.add(fn);return()=>listeners.mounted.delete(fn);}},openTab(){}},
  slots:{inject:(_name,fn)=>fn(),register(def,component){slots.set(def.name,component);return()=>slots.delete(def.name);}}};
 let api=shared?null:createNativeAppearanceSidebar({ctx,React,controller});
 const facade=shared?attachNativeAppearanceSidebar({ctx,React,controller,playbackOptions:gateOptions}):null;
 if(shared)activate();
 function activate(){dependencyCallback(ctx);}
 function withdraw(){for(const off of childCleanup.splice(0).reverse())off();}
 function nodes(){const body=slots.get('sidebar.right.pane.tab');assert.ok(body);const all=[];function visit(node){if(!node||typeof node!=='object')return;if(typeof node.type==='function')return visit(node.type(node.props));all.push(node);for(const child of node.children??[])visit(child);}visit(body({useTabInfo:()=>({tab:{id:'tab'}})}));return all;}
 const button=()=>nodes().find(n=>n.props['data-whale-playback-action']);
 return {controller,calls,listeners,ctx,React,slots,api,facade,button,activate,withdraw,
  click:()=>button().props.onClick(),deferStart(){startTask=deferred();return startTask;},deferStop(){stopTask=deferred();return stopTask;},
  status:setStatus,settings(patch){settings={...settings,...patch};emit('settings');},catalog(value){library=value;emit('library');},pending(value){pendingFlag=value;emit('status');},session(value){session=value;emit('mounted');},
  async dispose(){await facade?.dispose();api?.dispose();for(const set of Object.values(listeners))assert.equal(set.size,0);assert.equal(slots.size,0);},nodes};
}
async function run(options,fn){const f=fixture(options);try{await fn(f);}finally{await f.dispose();}}

test('mount render hide and cleanup perform no autonomous wallpaper or library commands',()=>run({},f=>{f.nodes();assert.equal(f.button().props.disabled,false);assert.deepEqual(f.calls,[]);}));
test('explicit start uses current selected identity and exact persisted mode once',()=>run({settings:{weMode:'preview'}},async f=>{await f.click();assert.deepEqual(f.calls,[['start','lucy','preview']]);assert.equal(f.button().props['data-whale-playback-action'],'stop');}));
test('same-tick repeated click is blocked even before controller emits busy state',()=>run({},async f=>{const pending=f.deferStart();const first=f.click();await f.click();assert.equal(f.calls.length,1);pending.resolve({state:'starting'});await first;}));
test('one primary action stops active wallpaper independently of selected catalogue item',()=>run({settings:{weScene:other},status:{state:'playing',host:{activeSceneId:'lucy'}}},async f=>{assert.equal(f.button().props['data-whale-playback-action'],'stop');assert.equal(f.nodes().find(n=>n.props['data-whale-selected-target']).children[0],'所选：所选壁纸');await f.click();assert.deepEqual(f.calls,[['stop','user']]);}));
test('null-like or unrecognized active identity can never pass the start gate',async()=>{for(const activeSceneId of ['null','',123,other])await run({status:{state:'idle',activeSceneId}},f=>{assert.equal(f.button().props['data-whale-playback-action'],'stop');assert.equal(f.api.getSnapshot().statusLabel,'状态未知');});});
test('cleanup failure exposes only retry cleanup; cleanup inflight disables resubmission',()=>run({status:{state:'cleanup-failed',cleanupPending:false}},async f=>{assert.equal((f.button().props['aria-label']??f.button().children[0]),'重试清理');const pending=f.deferStop();const first=f.click();await f.click();assert.equal(f.calls.length,1);assert.equal(f.button().props.disabled,true);f.status({state:'stopped',cleanupPending:false});pending.resolve({state:'stopped',cleanupPending:false});await first;}));
test('internal pending-cleanup proof blocks start even when public status looks idle',()=>run({},f=>{f.pending(true);assert.equal(f.button().props.disabled,true);}));
test('broken catalogue read cannot disable stopping an active source',()=>run({status:{state:'playing',activeSceneId:'lucy'}},async f=>{f.controller.wallpaper.getLibrarySnapshot=()=>{throw Error('broken metadata');};f.status({state:'playing',activeSceneId:'lucy'});assert.equal(f.button().props.disabled,false);await f.click();assert.deepEqual(f.calls,[['stop','user']]);}));
test('no session, missing target, background and invalid mode cannot start',async()=>{for(const settings of [{weScene:null},{background:'none'},{weMode:null}])await run({settings},async f=>{assert.equal(f.button().props.disabled,true);await f.click();assert.deepEqual(f.calls,[]);});await run({},async f=>{f.session(undefined);await f.click();assert.deepEqual(f.calls,[]);});});
test('unconfirmed catalogue does not scan or launch; later library notification enables the action',()=>run({library:{state:'idle',loaded:false,items:[]}},async f=>{assert.equal(f.button().props.disabled,true);await f.click();assert.deepEqual(f.calls,[]);f.catalog({state:'ready',loaded:true,items:[]});assert.equal(f.button().props.disabled,false);}));
test('supported types and Everyone gate match catalogue eligibility without exposing hidden title',async()=>{
 for(const [type,rating,available,enabled] of [['scene','Everyone',true,true],['video','Everyone',true,true],['web','Everyone',true,true],['application','Everyone',true,false],['video','Mature',true,false],['scene','Everyone',false,false]])await run({settings:{weScene:other},library:{state:'ready',loaded:true,items:[{id:other,type,contentRating:rating,available,title:'Private title'}]}},f=>{assert.equal(!f.button().props.disabled,enabled);if(rating==='Mature')assert.ok(!JSON.stringify(f.nodes()).includes('Private title'));});
});
test('Lucy unavailable evidence or empty age selection blocks start',async()=>{await run({status:{state:'idle',host:{scenes:[{id:'lucy',available:false}]}}},f=>assert.equal(f.button().props.disabled,true));await run({settings:{weAgeRatings:''}},f=>assert.equal(f.button().props.disabled,true));});
test('rendered old target or mode cannot silently launch a newly selected one',()=>run({},async f=>{const stale=f.button().props.onClick;f.settings({weScene:other,weMode:'preview'});f.catalog({state:'ready',loaded:true,items:[{id:other,type:'scene',available:true,contentRating:'Everyone'}]});assert.equal((await stale()).error,'target-drift');assert.deepEqual(f.calls,[]);}));
test('stale Start is not reinterpreted as Stop after external playback begins',()=>run({},async f=>{const stale=f.button().props.onClick;f.status({state:'playing',activeSceneId:'lucy'});await stale();assert.deepEqual(f.calls,[]);}));
test('stale Stop cannot affect a replacement source generation',()=>run({status:{state:'playing',activeSceneId:'lucy',generation:1}},async f=>{const stale=f.button().props.onClick;f.status({state:'playing',activeSceneId:other,generation:2});assert.equal((await stale()).error,'target-drift');assert.deepEqual(f.calls,[]);}));
test('unowned starting and stopping phases cannot submit another command',async()=>{for(const state of ['starting','stopping'])await run({status:{state,cleanupPending:false}},async f=>{assert.equal(f.button().props.disabled,true);await f.click();assert.deepEqual(f.calls,[]);});});
test('action result never overwrites authoritative status with returned payload',()=>run({},async f=>{const pending=f.deferStart(),first=f.click();f.status({state:'playing',activeSceneId:'lucy',generation:3});pending.resolve({state:'error',error:'raw private command',generation:1});await first;assert.equal(f.button().props['data-whale-playback-action'],'stop');assert.ok(!JSON.stringify(f.nodes()).includes('raw private command'));}));
test('disposed provider callback cannot issue a command',()=>run({shared:true},async f=>{const stale=f.button().props.onClick;f.withdraw();await stale();assert.deepEqual(f.calls,[]);}));

test('deadline returns unknown; explicit stop is allowed; late start cannot unlock restart until drained',async()=>{
 const timers=clock(),gate=createNativePlaybackGate({timers});const start=deferred(),stop=deferred();
 const first=gate.run('start',()=>start.promise);timers.fire();assert.equal((await first).error,'playback-result-unknown');assert.equal(gate.read().canStart,false);assert.equal(gate.read().canStop,true);
 const second=gate.run('stop',()=>stop.promise);stop.resolve({state:'stopped',cleanupPending:false});await second;assert.equal(gate.read().canStart,false);start.resolve({state:'error'});await turn();assert.equal(gate.read().canStart,true);assert.equal(gate.read().error,null);gate.dispose();assert.equal(timers.jobs.size,0);
});
test('timed-out stop cannot automatically retry or start a new run',async()=>{
 const timers=clock(),gate=createNativePlaybackGate({timers}),pending=deferred();const action=gate.run('stop',()=>pending.promise);timers.fire();assert.equal((await action).ok,false);assert.equal(gate.read().canStop,false);assert.equal((await gate.run('stop',()=>assert.fail('duplicate stop'))).error,'busy');assert.equal(gate.read().canStart,false);gate.dispose();pending.resolve({state:'stopped'});await turn();assert.equal(timers.jobs.size,0);
});
test('failed stop remains recovery-only until an explicit successful cleanup',async()=>{const gate=createNativePlaybackGate();await gate.run('stop',()=>({state:'error'}));assert.equal(gate.read().canStart,false);await gate.run('stop',()=>({state:'stopped',cleanupPending:false}));assert.equal(gate.read().canStart,true);gate.dispose();});
test('synchronous exception resolves with short unknown result and clears its deadline',async()=>{const timers=clock(),gate=createNativePlaybackGate({timers});assert.equal((await gate.run('start',()=>{throw Error('raw private error');})).error,'playback-result-unknown');assert.equal(gate.read().error,'操作结果未确认');assert.equal(timers.jobs.size,0);gate.dispose();});
test('malformed completion is unknown and cannot unlock another start',async()=>{const gate=createNativePlaybackGate();assert.equal((await gate.run('start',()=>({state:'made-up'}))).error,'playback-result-unknown');assert.equal(gate.read().canStart,false);gate.dispose();});
test('provider replacement retains one shared command lock; late result cannot reach disposed child',async()=>{
 const timers=clock();await run({shared:true,gateOptions:{timers}},async f=>{const pending=f.deferStart(),first=f.click();f.withdraw();f.activate();assert.equal(f.button().props.disabled,true);assert.equal(f.listeners.status.size,1);timers.fire();await first;assert.equal(f.button().props['data-whale-playback-action'],'stop');f.withdraw();f.activate();await f.click();assert.equal(f.calls.length,2);assert.equal(f.button().props.disabled,true);pending.resolve({state:'error'});await turn();assert.equal(f.button().props.disabled,false);});assert.equal(timers.jobs.size,0);
});
test('root disposal clears timers and returns without waiting for an unresponsive controller',async()=>{const timers=clock(),gate=createNativePlaybackGate({timers}),pending=deferred();const result=gate.run('start',()=>pending.promise);gate.dispose();assert.equal((await result).error,'disposed');assert.equal(timers.jobs.size,0);pending.reject(Error('late'));await turn();});
