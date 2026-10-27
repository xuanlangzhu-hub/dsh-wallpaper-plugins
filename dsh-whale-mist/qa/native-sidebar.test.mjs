import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {attachNativeAppearanceSidebar} from '../src/sidebar/native-appearance-sidebar.js';

function rig({failSlot=false,readOnly=false,settingsPatch={}}={}){
 const listeners={settings:new Set(),status:new Set(),mounted:new Set()},types=new Map(),slots=new Map(),calls=[];
 let childCleanup=[],callback,dead=false,session='s1',writeMode='normal',nextId=0;
 let settings={brightness:70,mask:45,weScene:'lucy',weAgeRatings:'Everyone',...settingsPatch};
 const writes=[];
 const controller={getSettingsSnapshot:()=>settings,
  set(key,value){writes.push([key,value]);if(writeMode==='throw-before')throw Error('private technical details');if(writeMode==='reject')return settings;settings={...settings,[key]:value};for(const fn of [...listeners.settings])fn();if(writeMode==='throw-after')throw Error('private technical details');return settings;},
  subscribeSettings:fn=>{listeners.settings.add(fn);return()=>listeners.settings.delete(fn);},
  wallpaper:{getStatus:()=>({state:'idle',activeSceneId:null}),subscribeStatus:fn=>{listeners.status.add(fn);return()=>listeners.status.delete(fn);}}};
 if(readOnly)delete controller.set;
 const root={inject(_names,fn){callback=fn;return{dispose:async()=>{dead=true;withdraw();}};}};
 const child={effect(fn){const off=fn();childCleanup.push(off);return off;},
  sidebarRight:{mounted:{getSnapshot:()=>session,subscribe:fn=>{listeners.mounted.add(fn);return()=>listeners.mounted.delete(fn);}},openTab(...args){calls.push(args);}},
  sidebarRightTabs:{register(def){if(types.has(def.kind))throw Error('duplicate type');types.set(def.kind,def);return()=>types.delete(def.kind);}},
  slots:{inject(_name,fn){return fn();},register(def,component){if(failSlot&&def.name.endsWith('.title'))throw Error('slot failure');const key=def.name+':'+def.key;slots.set(key,{...def,component});return()=>slots.delete(key);}}};
 const React={createElement:choiceContract,useSyncExternalStore:(_sub,get)=>get(),useId:()=>`range-${++nextId}`,useRef:value=>({current:value}),useEffect:()=>{},useState:value=>[typeof value==='function'?value():value,()=>{}]};
 const api=attachNativeAppearanceSidebar({ctx:root,React,controller});
 function activate(){if(dead)return;callback(child);}
 function withdraw(){for(const off of childCleanup.splice(0).reverse())off();}
 function nodes(){const entry=slots.get('sidebar.right.pane.tab:dsh-whale-mist/appearance-sidebar');assert.ok(entry);const tree=entry.component({useTabInfo:()=>({tab:{id:'test-tab'}})}),out=[];function walk(node){if(!node||typeof node!=='object')return;if(typeof node.type==='function'){walk(node.type(node.props));return;}out.push(node);for(const child of node.children??[])walk(child);}walk(tree);return out;}
 const input=key=>nodes().find(n=>n.type==='input'&&n.props['data-whale-appearance-range']===key);
 return{api,controller,listeners,types,slots,calls,writes,activate,withdraw,nodes,input,change:(key,value)=>input(key).props.onChange({currentTarget:{valueAsNumber:value}}),
  setWriteMode(mode){writeMode=mode;},external(patch){settings={...settings,...patch};for(const fn of [...listeners.settings])fn();},
  setSession(id){session=id;for(const fn of [...listeners.mounted])fn();},empty(){assert.equal(types.size,0);assert.equal(slots.size,0);for(const value of Object.values(listeners))assert.equal(value.size,0);}};
}
async function check(options,body){const f=rig(options);try{await body(f);}finally{await f.api.dispose();f.empty();}}
test('missing provider keeps entry disabled and refuses opening without a fallback',()=>check({},f=>{
 assert.deepEqual(f.api.getSnapshot(),{ready:false,canOpen:false,error:null});assert.equal(f.api.Trigger().children[0].props.disabled,true);assert.equal(f.api.open().error,'native-sidebar-unavailable');assert.equal(f.calls.length,0);
}));
test('provider ready opens only the unique native kind with no replacement options',()=>check({},f=>{
 f.activate();assert.equal(f.api.getSnapshot().ready,true);assert.equal(f.api.open().ok,true);assert.deepEqual(f.calls,[['whale-appearance']]);assert.equal(f.slots.size,2);
}));
test('no mounted session disables the control and API reports target absence',()=>check({},f=>{
 f.activate();f.setSession(undefined);assert.equal(f.api.getSnapshot().canOpen,false);assert.equal(f.api.open().error,'no-session');assert.equal(f.calls.length,0);assert.ok(f.api.getSnapshot().error);
}));
test('provider withdrawal releases only child-owned registrations and listeners',()=>check({},f=>{
 const controller=f.controller;f.activate();f.withdraw();f.empty();assert.equal(f.api.getSnapshot().ready,false);assert.equal(f.controller,controller);assert.equal(f.api.open().error,'native-sidebar-unavailable');
}));
test('late callback from old generation cannot mutate replacement readiness',()=>check({},f=>{
 f.activate();const late=[...f.listeners.settings][0];f.withdraw();f.activate();const current=f.api.getSnapshot();late();assert.equal(f.api.getSnapshot(),current);assert.equal(f.listeners.settings.size,1);assert.equal(f.listeners.status.size,1);
}));
test('dispose while awaiting providers prevents a later activation',()=>check({},async f=>{
 await f.api.dispose();f.activate();assert.equal(f.api.open().error,'disposed');f.empty();
}));
test('active dispose is idempotent and old callbacks cannot notify UI',()=>check({},async f=>{
 f.activate();let count=0;f.api.subscribe(()=>count++);const callbacks=[...f.listeners.status];await f.api.dispose();await f.api.dispose();callbacks.forEach(fn=>fn());assert.equal(count,0);f.empty();
}));
test('partial child setup rolls back and does not claim readiness',()=>check({failSlot:true},f=>{
 assert.throws(f.activate,/slot failure/);assert.equal(f.api.getSnapshot().ready,false);f.empty();
}));
test('repeated provider cycles retain exactly one set of controller subscriptions',()=>check({},f=>{
 for(let n=0;n<20;n++){f.activate();assert.equal(f.listeners.settings.size,1);assert.equal(f.listeners.status.size,1);f.withdraw();f.empty();}
}));

test('two labelled ranges write their own local appearance field with no save button',()=>check({},f=>{
 f.activate();assert.equal(f.input('brightness').props.min,20);assert.equal(f.input('brightness').props.max,120);assert.equal(f.input('mask').props.min,0);assert.equal(f.input('mask').props.max,90);
 assert.equal(f.change('brightness',80).ok,true);assert.equal(f.change('mask',0).ok,true);assert.deepEqual(f.writes,[['brightness',80],['mask',0]]);assert.equal(f.controller.getSettingsSnapshot().weScene,'lucy');
 assert.equal(f.nodes().filter(n=>n.type==='button'&&n.props.role!=='tab').length,2);assert.deepEqual(f.nodes().filter(n=>n.props.role==='tab').map(n=>[n.props['data-whale-settings-section'],n.props['aria-selected']]),[['wallpaper',true],['interface',false]]);const nodes=f.nodes();for(const label of nodes.filter(n=>n.type==='label'))assert.ok(nodes.some(n=>['input','select'].includes(n.type)&&n.props.id===label.props.htmlFor));
}));
test('range endpoints are accepted and repeated identical values skip the controller write',()=>check({},f=>{
 f.activate();for(const n of [20,120,120])assert.equal(f.change('brightness',n).ok,true);for(const n of [0,90,90])assert.equal(f.change('mask',n).ok,true);assert.equal(f.writes.length,4);
}));
test('malformed fractional and out-of-range values cannot change shared settings',()=>check({},f=>{
 f.activate();for(const n of [19,121,80.5,NaN,Infinity,'80',null])assert.equal(f.change('brightness',n).error,'invalid-appearance-value');for(const n of [-1,91,100,101,20.5])assert.equal(f.change('mask',n).error,'invalid-appearance-value');assert.equal(f.writes.length,0);
}));
test('rapid alternation and external updates retain both fields with one subscription set',()=>check({},f=>{
 f.activate();for(let n=30;n<=70;n++){f.change('brightness',n);f.change('mask',n);}f.external({brightness:90,mask:15});assert.equal(f.input('brightness').props.value,90);assert.equal(f.input('mask').props.value,15);assert.equal(f.listeners.settings.size,1);assert.equal(f.listeners.status.size,1);
}));
test('failed write keeps authoritative value with a short field-local error; user retry clears it',()=>check({},f=>{
 f.activate();f.setWriteMode('throw-before');assert.equal(f.change('brightness',80).error,'appearance-update-failed');assert.equal(f.input('brightness').props.value,70);assert.equal(f.input('brightness').props['aria-invalid'],true);assert.equal(f.input('mask').props['aria-invalid'],undefined);const error=f.nodes().find(n=>n.props.role==='alert');assert.deepEqual(error.children,['暂时无法调整，请重试']);f.setWriteMode('normal');f.change('brightness',80);assert.equal(f.input('brightness').props['aria-invalid'],undefined);
}));
test('a rejected synchronous write reports failure and never pretends the value changed',()=>check({},f=>{
 f.activate();f.setWriteMode('reject');assert.equal(f.change('mask',30).ok,false);assert.equal(f.input('mask').props.value,45);
}));
test('exception after mutation re-reads actual value instead of inventing rollback',()=>check({},f=>{
 f.activate();f.setWriteMode('throw-after');assert.equal(f.change('mask',30).ok,false);assert.equal(f.input('mask').props.value,30);assert.equal(f.input('mask').props['aria-invalid'],true);assert.equal(f.writes.length,1);
}));
test('missing setter or damaged stored field disables that range without corrupting valid sibling',()=>check({readOnly:true},f=>{
 f.activate();assert.equal(f.input('brightness').props.disabled,true);assert.equal(f.change('brightness',80).error,'appearance-unavailable');
}));
test('damaged field is not displayed as a valid low value and cannot be edited blindly',()=>check({settingsPatch:{brightness:NaN}},f=>{
 f.activate();assert.equal(f.input('brightness').props.disabled,true);assert.equal(f.input('brightness').props['aria-valuetext'],'暂不可用');assert.equal(f.change('brightness',80).error,'appearance-unavailable');assert.equal(f.change('mask',25).ok,true);
}));
test('no session and retained event handler after provider disposal cannot write',()=>check({},f=>{
 f.activate();const late=f.input('brightness').props.onChange;f.setSession(undefined);assert.equal(f.input('brightness').props.disabled,true);assert.equal(f.change('brightness',80).error,'no-session');f.withdraw();assert.equal(late({currentTarget:{valueAsNumber:90}}).error,'disposed');assert.equal(f.writes.length,0);
}));
test('client bundle matches the single ESM source and root inject remains theme/slots',async()=>{
 const [module,client]=await Promise.all(['../src/sidebar/native-appearance-sidebar.js','../src/client.js'].map(name=>readFile(new URL(name,import.meta.url),'utf8')));
 const from=client.indexOf('    /* WM_NATIVE_SIDEBAR_BEGIN */'),to=client.indexOf('    /* WM_NATIVE_SIDEBAR_END */',from);
 assert.ok(from>=0&&to>from);assert.ok(client.slice(from,to).includes(module.replace(/^export /gm,'')));
 assert.ok(client.includes('const inject = ["theme", "slots"];'));assert.ok(!client.includes('ctx.slots.inject("shell.overlay"'));
 const rangeContract=client.match(/const RANGE_SETTINGS = Object.freeze\(\{([\s\S]*?)\n    \}\);/)[1];
 await check({},f=>{f.activate();for(const key of ['brightness','mask']){const match=rangeContract.match(new RegExp(key+': Object.freeze\\(\\[(\\d+), (\\d+)\\]\\)'));assert.ok(match);const input=f.input(key);assert.equal(input.props.min,Number(match[1]));assert.equal(input.props.max,Number(match[2]));}});
});
