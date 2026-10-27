import assert from 'node:assert/strict';

// Real rendered controls and preset transactions in the isolated official SDK shell.
export async function assertStepTwoGrouping({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const preset=()=>page.locator('[data-whale-presets]:visible');
 const action=op=>preset().locator('[data-whale-preset-action='+op+']:visible');
 const menu=()=>page.locator('[data-whale-action-menu-popup=preset]');
 const more=()=>preset().locator('[data-whale-menu-trigger=preset]');
 const confirm=()=>preset().locator('[data-whale-preset-confirm-yes]');
 const four=value=>Object.fromEntries(['brightness','mask','blur','surface'].map(k=>[k,value[k]]));
 const store=async()=>JSON.parse(JSON.stringify((await observe()).presetStore));
 const appearance=async()=>JSON.parse(JSON.stringify((await observe()).settings));
 let saved;
 await section('wallpaper').click();
 await record('grouping: all five ranges occur once in wallpaper, blur has no single-control fold',async()=>{
   assert.deepEqual(await page.locator('[data-whale-page-panel=wallpaper] [data-whale-control-group] > legend').allTextContents(),['画面效果','界面透出']);
   assert.equal(await page.locator('[data-whale-fold=picture]').count(),0);
   for(const key of ['brightness','mask','blur','surface','chatBackdrop'])assert.equal(await page.locator('[data-whale-page-panel=wallpaper] [data-whale-appearance-range='+key+']').count(),1);
   assert.equal(await page.locator('[data-whale-page-panel=interface] [data-whale-appearance-range]').count(),0);
   const brightness=page.locator('[data-whale-appearance-range=brightness]');await brightness.focus();await brightness.press('Home');
   assert.equal((await appearance()).brightness,20);
   await section('interface').click();assert.deepEqual(await page.locator('[data-whale-page-panel=interface] [data-whale-control-group]>legend').allTextContents(),['主题与配色','文字']);await section('wallpaper').click();
 });
 await record('preset row: no duplicated value list, one explicit save stores only original four fields',async()=>{
   assert.equal(await preset().locator('[data-whale-preset-values]').count(),0);assert.equal(await preset().locator('[data-whale-preset-confirm]').count(),0);
   assert.equal(await action('save').isEnabled(),true);const before=await appearance();
   await action('save').click();saved=(await store()).entries.lucy;
   assert.deepEqual(saved,four(before));assert.deepEqual(await appearance(),before);assert.deepEqual(Object.keys(saved).sort(),['blur','brightness','mask','surface']);
   assert.equal(await preset().locator('[data-whale-preset-state]').textContent(),'已保存');assert.equal(await action('apply').isDisabled(),true);
   assert.equal(await preset().locator('[data-whale-preset-values]').count(),0);
 });
 await record('preset restore: updates four visible fields while chat backdrop and all other settings remain unchanged',async()=>{
   await page.evaluate(()=>{for(const [key,value] of Object.entries({brightness:95,mask:37,blur:6,surface:60,chatBackdrop:65}))qa.setAppearance(key,value);});
   const before=await appearance();await action('apply').click();assert.deepEqual(await appearance(),{...before,...saved});
   assert.equal((await appearance()).chatBackdrop,65);assert.equal(await page.locator('[data-whale-appearance-range=surface]').inputValue(),String(saved.surface));
   assert.equal(await page.locator('[data-whale-appearance-range=chatBackdrop]').inputValue(),'65');assert.equal(await action('apply').isDisabled(),true);
 });
 await record('preset overwrite: menu does not write; exact target/four values are reviewed, Escape cancels',async()=>{
   await page.evaluate(()=>qa.updateBrightness(85));const before=await store();await more().click();assert.deepEqual(await store(),before);
   await menu().locator('[data-whale-preset-action=save]').click();assert.equal(await preset().locator('[data-whale-preset-confirm=save]').isVisible(),true);
   assert.match(await preset().locator('[data-whale-preset-confirm]').textContent(),/Lucy/);assert.equal(await preset().locator('[data-whale-preset-values] dd').count(),4);assert.deepEqual(await store(),before);
   await confirm().press('Escape');assert.equal(await preset().locator('[data-whale-preset-confirm]').count(),0);assert.deepEqual(await store(),before);
   assert.equal(await action('apply').evaluate(n=>n===document.activeElement),true);
   await more().click();await menu().locator('[data-whale-preset-action=save]').click();const current=four(await appearance());await confirm().click();assert.deepEqual((await store()).entries.lucy,current);saved=current;
 });
 await record('preset confirmation: external unrelated preference change invalidates captured confirmation',async()=>{
   await page.evaluate(()=>qa.updateBrightness(75));await more().click();await menu().locator('[data-whale-preset-action=save]').click();const old=await confirm().elementHandle(),before=await store();
   await page.evaluate(()=>qa.setAppearance('chatBackdrop',66));assert.equal(await preset().locator('[data-whale-preset-confirm]').count(),0);
   await old.evaluate(n=>n.click());await old.dispose();assert.deepEqual(await store(),before);
 });
 await record('preset confirmation: hiding and reopening revokes the old view lease and does not replay',async()=>{
   await more().click();await menu().locator('[data-whale-preset-action=remove]').click();const old=await confirm().elementHandle(),before=await store();
   await page.evaluate(()=>qa.collapse());await page.evaluate(()=>qa.open());await root().waitFor();
   await old.evaluate(n=>n.click());await old.dispose();assert.deepEqual(await store(),before);assert.equal(await preset().locator('[data-whale-preset-confirm]').count(),0);
 });
 await record('preset deletion: explicit confirmation removes only the entry, never current appearance',async()=>{
   const before=await appearance();await more().click();await menu().locator('[data-whale-preset-action=remove]').click();assert.deepEqual(await appearance(),before);
   await preset().locator('[data-whale-preset-cancel]').click();assert.ok((await store()).entries.lucy);
   await more().click();await menu().locator('[data-whale-preset-action=remove]').click();await confirm().click();
   assert.equal((await store()).entries.lucy,undefined);assert.deepEqual(await appearance(),before);assert.equal(await preset().locator('[data-whale-preset-state]').textContent(),'未保存');
 });
 await record('preset persistence failure: inline error is visible, record is preserved and explicit retry works',async()=>{
   await page.evaluate(()=>{window.qaSavedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dsh-whale-mist.wallpaper-appearance-presets.v1')throw Error('offline storage failure');return window.qaSavedSetItem.call(this,key,value);};});
   const before=await store();await action('save').click();assert.equal(await preset().locator('[data-whale-preset-error]').isVisible(),true);assert.deepEqual(await store(),before);
   await page.evaluate(()=>{Storage.prototype.setItem=window.qaSavedSetItem;delete window.qaSavedSetItem;});await action('save').click();assert.deepEqual((await store()).entries.lucy,four(await appearance()));assert.equal(await preset().locator('[data-whale-preset-error]').count(),0);
 });
 await record('preset gesture: unfinished author text is not blurred or submitted by restore',async()=>{
   await page.evaluate(()=>qa.updateBrightness(90));
   await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');
   await page.locator('[data-whale-author-read]').click();const caption=page.locator('[data-whale-author-key=caption]');await caption.waitFor();
   const before=await appearance(),stored=await store();await caption.fill('unfinished preset test');
   await action('apply').scrollIntoViewIfNeeded();await action('apply').click();assert.deepEqual(await appearance(),before);assert.deepEqual(await store(),stored);assert.equal(await caption.evaluate(n=>n===document.activeElement),true);
   await caption.press('Escape');await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 });
 await record('preset row: narrow widths and larger text preserve actions without horizontal overflow',async()=>{
   for(const width of [280,360,520]){await root().evaluate((n,w)=>{n.style.width=w+'px';},width);assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);}
   await root().evaluate(n=>{n.style.width='280px';n.style.fontSize='28px';});assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   await root().evaluate(n=>{n.style.width='520px';n.style.fontSize='';});await page.locator('[data-whale-page-panel=wallpaper]').evaluate(n=>{n.scrollTop=0;});
   await root().screenshot({path:outputRoot+'/step2-wallpaper.png',animations:'disabled'});
   await preset().scrollIntoViewIfNeeded();await root().screenshot({path:outputRoot+'/step2-preset.png',animations:'disabled'});
   await section('interface').click();await root().screenshot({path:outputRoot+'/step2-interface.png',animations:'disabled'});
 });
}
