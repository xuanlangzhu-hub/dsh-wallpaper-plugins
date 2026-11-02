import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {rig} from './fixture.mjs';

function check(options,run){const f=rig(options);try{return run(f);}finally{f.dispose();}}
test('panel material is independent of wallpaper effects, glass strength and playback',()=>check({},f=>{
 const initial=f.settings();
 assert.equal(f.api.getSnapshot().panelMaterial,'clear');
 assert.equal(f.api.setPanelMaterial('frosted').ok,true);
 assert.deepEqual(f.settings(),{...initial,panelMaterial:'frosted'});
 assert.equal(f.api.setPanelMaterial('frosted').ok,true);
 assert.equal(f.writes.length,1);
 assert.equal(f.api.setPanelMaterial('clear').ok,true);
 assert.deepEqual(f.settings(),initial);
 assert.deepEqual(f.writes,[['panelMaterial','frosted'],['panelMaterial','clear']]);
}));
test('visible segmented material control and root reflect authoritative external changes',()=>check({},f=>{
 const control=()=>f.nodes().find(n=>n.props['data-whale-interface-option']==='panelMaterial');
 const selected=()=>control().children.filter(Boolean).flatMap(n=>n.children??[]).find(n=>n?.type==='input'&&n.props.checked)?.props.value;
 assert.equal(selected(),'clear');
 f.external({panelMaterial:'frosted'});
 assert.equal(selected(),'frosted');
 assert.equal(f.nodes().find(n=>n.props['data-whale-native-sidebar']).props['data-whale-panel-material'],'frosted');
 assert.deepEqual(f.writes,[]);
}));
test('invalid material values never write or accidentally enable frosting',()=>check({},f=>{
 for(const value of [null,undefined,0,true,'','Frosted','__proto__',{},['frosted']])assert.equal(f.api.setPanelMaterial(value).error,'invalid-panel-material');
 assert.deepEqual(f.writes,[]);
 f.external({panelMaterial:'invalid'});
 assert.equal(f.api.setPanelMaterial('frosted').error,'appearance-unavailable');
 assert.equal(f.nodes().find(n=>n.props['data-whale-native-sidebar']).props['data-whale-panel-material'],'clear');
}));
test('missing setter, no session and withdrawn editor refuse retained handlers',()=>{
 check({readOnly:true},f=>assert.equal(f.api.setPanelMaterial('frosted').error,'appearance-unavailable'));
 check({},f=>{f.session(undefined);assert.equal(f.api.setPanelMaterial('frosted').error,'no-session');});
 check({},f=>{const release=f.editorGate.acquireLegacy();assert.equal(f.api.setPanelMaterial('frosted').error,'editor-suspended');release();f.api.dispose();assert.equal(f.api.setPanelMaterial('frosted').error,'disposed');});
});
test('rejected and throwing setters keep honest local feedback without fallback',()=>check({},f=>{
 for(const mode of ['reject','throw-before','throw-after']){
  f.external({panelMaterial:'clear'});f.writeMode(mode);
  assert.equal(f.api.setPanelMaterial('frosted').error,'panel-material-update-failed');
  assert.equal(f.api.getSnapshot().panelMaterial,mode==='throw-after'?'frosted':'clear');
  assert.equal(f.api.getSnapshot().panelMaterialError,'暂时无法更改侧栏背景，请重试');
 }
 f.writeMode('normal');assert.equal(f.api.setPanelMaterial('clear').ok,true);assert.equal(f.api.getSnapshot().panelMaterialError,null);
}));
test('actual client normalization migrates missing material to clear and retains valid preference',async()=>{
 const client=await readFile(new URL('../../src/client.js',import.meta.url),'utf8');
 const start=client.indexOf('    const STORAGE_KEY ='),end=client.indexOf('    function readSettings(',start);
 assert.ok(start>0&&end>start);
 const context={};vm.runInNewContext(client.slice(start,end)+'\nglobalThis.normalize=normalizeSettings;globalThis.valid=isValidSetting;',context,{timeout:500});
 const previous={theme:'mist',brightness:81,surface:65,glass:'restrained',weScene:'lucy',weAutoStart:true};
 const migrated=context.normalize(previous);assert.equal(migrated.panelMaterial,'clear');
 for(const [key,value] of Object.entries(previous))assert.equal(migrated[key],value);
 assert.equal(context.normalize({...previous,panelMaterial:'frosted'}).panelMaterial,'frosted');
 for(const value of [null,true,0,'wrong',{}])assert.equal(context.normalize({panelMaterial:value}).panelMaterial,'clear');
 assert.equal(context.valid('panelMaterial','clear'),true);assert.equal(context.valid('panelMaterial','frosted'),true);assert.equal(context.valid('panelMaterial',true),false);
});
