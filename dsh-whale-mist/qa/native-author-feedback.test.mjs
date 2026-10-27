import {choiceContract,groupedFields} from './native-choice-contract-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAppearanceSidebar} from '../src/sidebar/native-appearance-sidebar.js';

// Component contract checks with explicit UI state. Real DOM / controller / Host paths
// are additionally exercised by the retained actual Windows rc.3 SDK fixture.
function rig({mark,localError=null,expandColors=false,editing=false,message=null}={}){
 const calls=[],listeners=new Set();let next=0;
 const fields=[{key:'particles',type:'bool',label:'粒子'},{key:'speed',type:'slider',label:'速度',rangeMin:0,rangeMax:5,rangeStep:1},
  {key:'tint',type:'color',label:'颜色'},{key:'variant',type:'combo',label:'样式',options:[{label:'关',value:false},{label:'零',value:0}]},
  {key:'caption',type:'textinput',label:'文字'}];
 const state={fields,values:{particles:true,speed:2,tint:'1 0 0',variant:false,caption:'seed'},marks:mark?Object.fromEntries(fields.map(f=>[f.key,mark])):{},
  busy:mark==='busy',phase:'ready',message,loading:false,editing,canRead:true,recovery:null,canDiscard:false,canEdit:true};
 const author={read:()=>state,subscribe:()=>()=>{},setContext(){},editCurrent:()=>false,
  change:(...args)=>calls.push(['change',...args]),load:()=>calls.push(['load'])};
 const settings={theme:'abyss',background:'wallpaper',brightness:70,mask:40,blur:0,surface:80,chatBackdrop:0,weScene:'lucy',weAgeRatings:'Everyone',weMode:'daily',weAutoStart:false};
 const controller={getSettingsSnapshot:()=>settings,subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);},wallpaper:{
  getStatus:()=>({state:'playing',activeSceneId:'lucy',generation:1}),getLibrarySnapshot:()=>({loaded:true,state:'ready',items:[{id:'lucy',contentRating:'Everyone',available:true,type:'scene',title:'Lucy'}]}),
  subscribeStatus:()=>()=>{},subscribeLibrary:()=>()=>{}}};
 const React={createElement:choiceContract,useRef:value=>({current:value}),useEffect(){},useId:()=>`feedback-${++next}`,useMemo:fn=>fn(),
  useState:value=>[value===null?localError:value===false?expandColors:typeof value==='function'?value():value,()=>{}],
  useSyncExternalStore:(_subscribe,get)=>{const value=get();return localError&&typeof value?.text==='string'&&'composing' in value?{...value,error:localError}:value;}};
 const ctx={sidebarRight:{openTab(){},mounted:{getSnapshot:()=> 's1',subscribe:()=>()=>{}}},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_n,fn)=>fn(),register:()=>()=>{}}};
 const api=createNativeAppearanceSidebar({ctx,React,controller,author});
 const nodes=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){for(const item of n)walk(item);return;}if(typeof n.type==='function'){walk(n.type(n.props));return;}nodes.push(n);for(const child of n.children??[])walk(child);}
 walk(api.Body({useTabInfo:()=>({tab:{id:'feedback-tab',visible:true}})}));
 const slots=nodes.filter(n=>n.props['data-whale-author-feedback']);
 const text=n=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
 const inputs=nodes.filter(n=>n.props['data-whale-author-key']||n.props['data-whale-author-number']||n.props['data-whale-author-channel']);
 return{nodes,slots,inputs,state,calls,text,dispose(){api.dispose();assert.equal(listeners.size,0);}};
}
function check(options,fn){const f=rig(options);try{fn(f);}finally{f.dispose();}}

for(const [mark,label,icon] of [[undefined,'未读取壁纸实际值',''],['busy','正在处理修改','…'],['sent','下发已确认，效果请观察','✓'],['error','修改未完成','!'],['unknown','本轮修改结果未确认','?']]){
 test(`all five field types have one accessible ${mark??'record'} receipt without claiming a format error`,()=>check({mark},f=>{
  assert.equal(f.slots.length,5);
  for(const slot of f.slots){assert.equal(slot.props['data-state'],mark??'record');assert.ok(f.text(slot).includes(label));assert.equal(slot.children[0].children[0],icon);assert.equal(slot.children[0].props['aria-hidden'],true);}
  for(const input of f.inputs){assert.equal(input.props['aria-invalid'],undefined);assert.ok(f.slots.some(slot=>input.props['aria-describedby'].split(' ').includes(slot.props.id)));assert.equal(input.props['aria-busy'],mark==='busy');}
  const checkbox=f.inputs.find(n=>n.props['data-whale-author-key']==='particles');assert.equal(checkbox.props['aria-label'],'粒子');assert.equal(checkbox.props.checked,true);assert.equal(checkbox.props.ref,undefined);if(mark==='unknown')assert.equal(checkbox.props.title,'本轮修改结果未确认');
  assert.deepEqual(f.calls,[]);
 }));
}
test('scalar number, text and hex format errors remain invalid and retain both delivery and error descriptions',()=>check({mark:'unknown',localError:'格式不正确'},f=>{
 for(const input of f.inputs.filter(n=>n.props.type==='text')){assert.equal(input.props['aria-invalid'],true);const ids=input.props['aria-describedby'].split(' ');assert.equal(ids.length,2);assert.ok(f.nodes.some(n=>n.props.id===ids[1]&&f.text(n).includes('格式不正确')));}
 assert.equal(f.inputs.find(n=>n.props.type==='range').props['aria-invalid'],undefined);
}));
test('expanded RGB channels and scalar number share the parent delivery receipt instead of duplicating acknowledgments',()=>check({mark:'sent',expandColors:true},f=>{
 const channels=f.inputs.filter(n=>n.props['data-whale-author-channel']);assert.equal(channels.length,3);const tint=f.slots.find(n=>n.props['data-whale-author-feedback']==='tint');
 for(const input of channels)assert.equal(input.props['aria-describedby'],tint.props.id);
 assert.equal(f.slots.length,5);assert.equal(f.inputs.find(n=>n.props['data-whale-author-number']).props['aria-describedby'],f.slots.find(n=>n.props['data-whale-author-feedback']==='speed').props.id);
}));
test('source help retains explicit description in a metadata-only popover contract and re-read remains an explicit read-only action',()=>check({},f=>{
 const help=f.nodes.find(n=>n.props['data-whale-author-source']);assert.equal(help.type,'menu-command-contract');assert.equal(help.props['data-menu-contract'],'author-source');assert.match(f.text(help),/不读取壁纸实际值，不重复下发/);
 const read=f.nodes.find(n=>n.props['data-whale-author-read']);assert.equal(read.props['aria-label'],'重新读取作者参数');assert.equal(f.text(read),'↻');assert.match(read.props.title,/设置结构和本机记录/);read.props.onClick();assert.deepEqual(f.calls,[['load']]);
}));
test('editing read action and uncertain group message preserve the needed recovery instruction',()=>check({mark:'unknown',editing:true,message:'下发结果未确认，请观察后重新读取'},f=>{
 const read=f.nodes.find(n=>n.props['data-whale-author-read']);assert.equal(read.props['aria-label'],'取消编辑并重新读取作者参数');assert.equal(f.text(read),'取消编辑并重读');assert.match(read.props.title,/取消未完成编辑/);
 assert.ok(f.nodes.some(n=>n.props.role==='alert'&&f.text(n)==='本轮修改结果未确认，请观察画面后重新读取'));
}));
test('boolean interaction still forwards exactly one explicit value without a save/apply button chain',()=>check({},f=>{
 f.inputs.find(n=>n.props['data-whale-author-key']==='particles').props.onChange({currentTarget:{checked:false}});assert.deepEqual(f.calls,[['change','particles',false]]);
 assert.equal(f.nodes.some(n=>n.type==='button'&&/保存草稿|应用到当前壁纸/.test(f.text(n))),false);
}));
