import assert from 'node:assert/strict';

// Actual SDK DOM/settings, with native window and WE IO substituted by the integration fixture.
export async function assertLowFrequency({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const fold=()=>page.locator('[data-whale-fold=interface]');
 const group=key=>page.locator('[data-whale-interface-option='+key+']:visible');
 const radio=(key,value)=>group(key).locator('input[value="'+value+'"]');
 const pairs=[['sidebar','balanced','deep'],['canvas','soft','clear'],['glass','standard','restrained']];
 const writes=async()=>JSON.stringify((await observe()).appearanceWrites);
 const set=async(key,value)=>radio(key,value).check();
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await section('interface').click();const saved={...(await observe()).settings};
 await record('low frequency: closed by default, opening reveals three labelled two-option groups with no write',async()=>{
   assert.equal(await fold().getAttribute('open'),null);const prior=await writes();
   for(const [key]of pairs)assert.equal(await group(key).count(),0);
   await fold().locator('summary').click();
   for(const [key]of pairs){assert.equal(await group(key).getAttribute('role'),'radiogroup');assert.equal(await group(key).getByRole('radio').count(),2);assert.equal(await group(key).locator('input:checked').count(),1);}
   assert.deepEqual(await group('sidebar').locator('[data-whale-segment-text]').allTextContents(),['均衡','加深']);
   assert.deepEqual(await group('canvas').locator('[data-whale-segment-text]').allTextContents(),['柔雾','清晰']);
   assert.deepEqual(await group('glass').locator('[data-whale-segment-text]').allTextContents(),['标准','偏实色']);assert.equal(await writes(),prior);
 });
 await record('low frequency: option explanations are available by title and accessible description without adding visible prose',async()=>{
   const ids=[];
   for(const [key,a,b]of pairs)for(const value of [a,b]){
     const node=radio(key,value),id=await node.getAttribute('aria-describedby');assert.ok(id);assert.equal(id.includes(' '),false);ids.push(id);
     const description=page.locator('[id="'+id+'"]');assert.equal(await description.isVisible(),false);
     assert.equal(await node.locator('..').getAttribute('title'),await description.textContent());assert.ok((await description.textContent()).length>5);
   }
   assert.equal(new Set(ids).size,6);assert.match(await page.locator('[id="'+await radio('glass','restrained').getAttribute('aria-describedby')+'"]').textContent(),/不改变输入卡片/);
 });
 await record('low frequency: each click writes exactly one original key, same selection does not repeat, unrelated settings stay exact',async()=>{
   for(const [key,a,b]of pairs){const prior=await observe(),value=prior.settings[key]===a?b:a;
     await set(key,value);const after=await observe();assert.equal(after.appearanceWrites.length,prior.appearanceWrites.length+1);assert.deepEqual(after.settings,{...prior.settings,[key]:value});
     await radio(key,value).click();assert.equal((await observe()).appearanceWrites.length,prior.appearanceWrites.length+1);
     await set(key,prior.settings[key]);
   }
 });
 await record('low frequency: arrows select immediately once, Space does not repeat, Tab moves to the next group',async()=>{
   await set('sidebar','balanced');const prior=(await observe()).appearanceWrites.length;await radio('sidebar','balanced').focus();await radio('sidebar','balanced').press('ArrowRight');
   assert.equal((await observe()).settings.sidebar,'deep');assert.equal((await observe()).appearanceWrites.length,prior+1);await radio('sidebar','deep').press('Space');assert.equal((await observe()).appearanceWrites.length,prior+1);
   await radio('sidebar','deep').press('Tab');assert.equal(await group('canvas').locator('input:checked').evaluate(n=>n===document.activeElement),true);
 });
 await record('low frequency: rejected writes retain real values and link both field errors and option explanations, retry is explicit',async()=>{
   for(const [key,a,b]of pairs){await set(key,a);await page.evaluate(()=>qa.setWriteMode('throw-before'));
     try{await radio(key,b).click();assert.equal((await observe()).settings[key],a);assert.equal(await radio(key,a).isChecked(),true);
       const error=await group(key).getAttribute('aria-describedby'),description=await radio(key,b).getAttribute('aria-describedby');assert.ok(error);assert.equal(await group(key).getAttribute('aria-invalid'),'true');assert.equal(await page.locator('[id="'+error+'"]').getAttribute('role'),'alert');
       assert.equal(description.split(' ').length,2);assert.ok(description.split(' ').includes(error));
     }finally{await page.evaluate(()=>qa.setWriteMode('normal'));}
     await set(key,b);assert.equal(await group(key).getAttribute('aria-invalid'),null);assert.equal((await radio(key,b).getAttribute('aria-describedby')).split(' ').length,1);await set(key,a);
   }
 });
 await record('low frequency: external values synchronize and closing/reopening the fold never replays them',async()=>{
   await page.evaluate(()=>{qa.setAppearance('sidebar','deep');qa.setAppearance('canvas','clear');qa.setAppearance('glass','restrained');});const prior=await writes();
   await fold().locator('summary').click();await fold().locator('summary').click();for(const [key,,b]of pairs)assert.equal(await radio(key,b).isChecked(),true);assert.equal(await writes(),prior);
 });
 await record('low frequency: hidden folded/section controls cannot write through retained DOM handles',async()=>{
   const old=await radio('sidebar','balanced').elementHandle();await fold().locator('summary').click();let prior=await writes();await old.evaluate(n=>n.click());assert.equal(await writes(),prior);
   await fold().locator('summary').click();await section('wallpaper').click();prior=await writes();await old.evaluate(n=>n.click());assert.equal(await writes(),prior);await old.dispose();await section('interface').click();
 });
 await record('low frequency: light/dark theme changes keep current choices and exact playback state',async()=>{
   const prior=await observe();await page.locator('[data-whale-interface-option=theme]:visible input[value=mist]').check();for(const [key,,b]of pairs)assert.equal(await radio(key,b).isChecked(),true);
   assert.deepEqual((await observe()).wallpaper,prior.wallpaper);await root().screenshot({path:outputRoot+'/low-frequency-light.png',animations:'disabled'});
   await page.locator('[data-whale-interface-option=theme]:visible input[value=abyss]').check();
 });
 await record('low frequency: narrow widths and doubled text have no horizontal clipping; forced-colour keyboard focus is visible',async()=>{
   for(const width of [280,360,520]){await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';n.style.fontSize='28px';},width);assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);for(const [key]of pairs)assert.equal(await group(key).evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);}
   await root().evaluate(n=>{n.style.width='360px';n.style.fontSize='';});await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await radio('sidebar','deep').focus();await radio('sidebar','deep').press('ArrowLeft');
   const visual=await radio('sidebar','balanced').evaluate(n=>{const s=getComputedStyle(n.nextElementSibling);return {outline:s.outlineStyle,border:s.borderTopWidth};});assert.notEqual(visual.outline,'none');assert.equal(visual.border,'2px');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
 });
 await page.locator('[data-whale-page-panel=interface]').evaluate(n=>{n.scrollTop=n.scrollHeight;});await root().screenshot({path:outputRoot+'/low-frequency-dark.png',animations:'disabled'});
 for(const [key]of pairs)await page.evaluate(([key,value])=>qa.setAppearance(key,value),[key,saved[key]]);
 await fold().locator('summary').click();await section('wallpaper').click();
}
