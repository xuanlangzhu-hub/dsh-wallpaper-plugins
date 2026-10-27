import assert from 'node:assert/strict';

// Actual official SDK DOM and product settings controller; native window/WE IO stays substituted.
export async function assertDirectChoices({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const group=key=>page.locator('[data-whale-interface-option='+key+']:visible');
 const radio=(key,value)=>group(key).locator('input[value="'+value+'"]');
 const state=async()=>JSON.stringify((await observe()).appearanceWrites);
 const pick=async(key,value)=>{await radio(key,value).check();};
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await section('interface').click();
 const before=(await observe()).settings;
 await record('direct choices: labelled native radio groups replace only theme/mode/readability/palette',async()=>{
   for(const [key,label,count] of [['theme','主题',2],['accentMode','强调色',2],['textContrast','文字可读性',2],['palette','深色配色',4]]){
     assert.equal(await group(key).getAttribute('role'),'radiogroup');assert.equal(await group(key).getAttribute('aria-expanded'),null);
     assert.equal(await group(key).getByRole('radio').count(),count);assert.equal(await group(key).locator('input:checked').count(),1);
     assert.equal(await page.locator('[id="'+await group(key).getAttribute('aria-labelledby')+'"]').textContent(),label);
   }
   assert.equal(await page.locator('[data-whale-choice-list]:popover-open').count(),0);
 });
 await record('direct choices: pointer selects once and repeated selected clicks do not write',async()=>{
   const prior=await observe(),next=prior.settings.textContrast==='standard'?'enhanced':'standard';
   await pick('textContrast',next);assert.equal((await observe()).settings.textContrast,next);
   assert.equal((await observe()).appearanceWrites.length,prior.appearanceWrites.length+1);
   await radio('textContrast',next).click();assert.equal((await observe()).appearanceWrites.length,prior.appearanceWrites.length+1);
   assert.equal(await group('textContrast').locator('[data-whale-segment-check]').allTextContents().then(v=>v.filter(Boolean).join('')),'✓');
 });
 await record('direct choices: native arrow navigation selects immediately once, Space on selection does not repeat',async()=>{
   await pick('textContrast','standard');const prior=(await observe()).appearanceWrites.length;
   await radio('textContrast','standard').focus();await radio('textContrast','standard').press('ArrowRight');
   assert.equal((await observe()).settings.textContrast,'enhanced');assert.equal((await observe()).appearanceWrites.length,prior+1);
   assert.equal(await radio('textContrast','enhanced').evaluate(n=>n===document.activeElement),true);
   await radio('textContrast','enhanced').press('Space');assert.equal((await observe()).appearanceWrites.length,prior+1);
   await radio('textContrast','enhanced').press('ArrowRight');assert.equal((await observe()).settings.textContrast,'standard');
 });
 await record('direct choices: focus enters one checked radio per group and Tab does not alter settings',async()=>{
   await radio('theme','abyss').focus();const prior=await state();await radio('theme','abyss').press('Tab');
   assert.equal(await group('palette').locator('input:checked').evaluate(n=>n===document.activeElement),true);
   assert.equal(await state(),prior);
 });
 await record('direct choices: all named palette swatches select exact values without changing unrelated settings',async()=>{
   assert.deepEqual(await group('palette').getByRole('radio').allTextContents(),['','','','']);
   assert.deepEqual(await group('palette').locator('[data-whale-segment-text]').allTextContents(),['深海','石墨','暗紫','墨绿']);
   const original={...(await observe()).settings};
   for(const value of ['graphite','violet','jade','ocean']){
     await pick('palette',value);const actual={...(await observe()).settings};assert.equal(actual.palette,value);delete actual.palette;
     const expected={...original};delete expected.palette;assert.deepEqual(actual,expected);
     assert.match(await group('palette').locator('[data-whale-palette-swatch='+value+']').getAttribute('style'),/linear-gradient/);
   }
 });
 await record('direct choices: theme change hides palette and preserves its saved value and playback',async()=>{
   await pick('palette','jade');const prior=await observe();await pick('theme','mist');
   assert.equal(await group('palette').count(),0);assert.equal((await observe()).theme,'whale-mist');
   assert.equal((await observe()).settings.palette,'jade');assert.deepEqual((await observe()).wallpaper,prior.wallpaper);
   await pick('theme','abyss');assert.equal(await radio('palette','jade').isChecked(),true);
 });
 await record('direct choices: selected saved theme can explicitly repair a mismatched runtime without another preference write',async()=>{
   // The full plugin normally reasserts the saved theme. Hold just that SDK IO for this negative.
   await page.evaluate(()=>{window.directThemeOriginalSet=qaRoot.theme.setTheme;qaRoot.theme.setTheme=id=>{if(id!=='whale-abyss')return window.directThemeOriginalSet.call(qaRoot.theme,id);};qaRoot.theme.setTheme('whale-mist');});
   try{assert.equal((await observe()).settings.theme,'abyss');assert.equal((await observe()).theme,'whale-mist');
     const prior=await state();assert.equal(await radio('theme','abyss').isChecked(),true);
     await page.evaluate(()=>{qaRoot.theme.setTheme=window.directThemeOriginalSet;delete window.directThemeOriginalSet;});
     await radio('theme','abyss').click();assert.equal((await observe()).theme,'whale-abyss');assert.equal(await state(),prior);
   }finally{await page.evaluate(()=>{if(window.directThemeOriginalSet){qaRoot.theme.setTheme=window.directThemeOriginalSet;delete window.directThemeOriginalSet;}qaRoot.theme.setTheme('whale-abyss');});}
 });
 await record('direct choices: custom accent keeps the existing picker/hex and saved colour across mode switches',async()=>{
   const colour=(await observe()).settings.accentColor;await pick('accentMode','custom');
   assert.equal(await page.locator('[data-whale-interface-color=accentColor]').inputValue(),colour);
   assert.equal(await page.locator('[data-whale-accent-hex]').textContent(),colour);
   await pick('accentMode','theme');assert.equal(await page.locator('[data-whale-interface-color=accentColor]').count(),0);
   await pick('accentMode','custom');assert.equal(await page.locator('[data-whale-interface-color=accentColor]').inputValue(),colour);
 });
 await record('direct choices: failed writes retain the real selection and linked local error; explicit retry clears it',async()=>{
   await pick('textContrast','standard');await page.evaluate(()=>qa.setWriteMode('throw-before'));
   try{await radio('textContrast','enhanced').click();assert.equal((await observe()).settings.textContrast,'standard');
     assert.equal(await radio('textContrast','standard').isChecked(),true);assert.equal(await group('textContrast').getAttribute('aria-invalid'),'true');
     const error=await group('textContrast').getAttribute('aria-describedby');assert.ok(error);assert.equal(await page.locator('[id="'+error+'"]').getAttribute('role'),'alert');
   }finally{await page.evaluate(()=>qa.setWriteMode('normal'));}
   await pick('textContrast','enhanced');assert.equal(await group('textContrast').getAttribute('aria-invalid'),null);
 });
 await record('direct choices: externally changed values synchronize with no replay from mounted radios',async()=>{
   await page.evaluate(()=>qa.setAppearance('textContrast','standard'));const prior=await state();
   assert.equal(await radio('textContrast','standard').isChecked(),true);await section('wallpaper').click();await section('interface').click();
   assert.equal(await state(),prior);assert.equal(await radio('textContrast','standard').isChecked(),true);
 });
 await record('direct choices: hidden controls and a detached old palette cannot write',async()=>{
   const hidden=await radio('textContrast','enhanced').elementHandle();await section('wallpaper').click();let prior=await state();
   await hidden.evaluate(n=>n.click());assert.equal(await state(),prior);await hidden.dispose();await section('interface').click();
   const stale=await radio('palette','graphite').elementHandle();await pick('theme','mist');prior=await state();
   await stale.evaluate(n=>n.click());assert.equal(await state(),prior);await stale.dispose();await pick('theme','abyss');
 });
 await record('direct choices: 280/360/520px and doubled text wrap without clipping names or overflowing',async()=>{
   for(const width of [280,360,520]){
     await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';n.style.fontSize='28px';},width);
     assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
     for(const key of ['theme','accentMode','textContrast','palette'])assert.equal(await group(key).evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   }
   await root().evaluate(n=>{n.style.width='360px';n.style.fontSize='';});
 });
 await record('direct choices: keyboard focus and selected check stay visible in forced colours and reduced motion',async()=>{
   await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await radio('textContrast','standard').focus();await radio('textContrast','standard').press('ArrowRight');
   const visual=await radio('textContrast','enhanced').evaluate(n=>{const s=getComputedStyle(n.nextElementSibling);return {outline:s.outlineStyle,border:s.borderTopWidth};});
   assert.notEqual(visual.outline,'none');assert.equal(visual.border,'2px');
   await radio('textContrast','enhanced').hover();await page.mouse.down();
   try{assert.equal(await radio('textContrast','enhanced').evaluate(n=>getComputedStyle(n.nextElementSibling).transform),'none');}finally{await page.mouse.up();}
   assert.equal(await group('textContrast').locator('[data-whale-segment-check]').allTextContents().then(v=>v.filter(Boolean).join('')),'✓');
   await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
 });
 await page.locator('[data-whale-page-panel=interface]').evaluate(n=>{n.scrollTop=0;});
 await root().screenshot({path:outputRoot+'/direct-dark.png',animations:'disabled'});
 await pick('theme','mist');await root().screenshot({path:outputRoot+'/direct-light.png',animations:'disabled'});
 for(const key of ['theme','palette','accentMode','textContrast'])await page.evaluate(([key,value])=>qa.setAppearance(key,value),[key,before[key]]);
 await section('wallpaper').click();
}
