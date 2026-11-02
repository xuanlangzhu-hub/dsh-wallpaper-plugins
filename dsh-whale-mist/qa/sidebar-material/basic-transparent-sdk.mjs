import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Actual fixed SDK/client, synthetic frames and native IO stand-ins, never daily DSH.
export async function assertBasicControls({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const initial={...(await observe()).settings},observations=[];
 await page.locator('[data-whale-change-wallpaper]:visible').click();
 const search=()=>page.getByRole('searchbox',{name:'搜索壁纸'});
 await search().waitFor();
 const readField=()=>search().evaluate(n=>{const s=getComputedStyle(n);return{fill:s.backgroundColor,image:s.backgroundImage,blur:s.backdropFilter,shadow:s.boxShadow,border:s.borderTopWidth,borderStyle:s.borderTopStyle,type:n.type,font:s.fontSize,rootFont:getComputedStyle(n.closest('[data-whale-native-sidebar]')).fontSize};});
 await record('Basic controls: gallery search is transparent with one thin border and inherited type',async()=>{
  const s=await readField();assert.equal(s.fill,'rgba(0, 0, 0, 0)');assert.equal(s.image,'none');assert.equal(s.blur,'none');assert.equal(s.shadow,'none');assert.equal(s.border,'1px');assert.equal(s.borderStyle,'solid');assert.equal(s.font,s.rootFont);observations.push({kind:'search',...s});
 });
 await record('Basic controls: native search typing and keyboard focus remain functional',async()=>{
  await search().fill('Lucy');await page.waitForFunction(()=>document.querySelectorAll('[data-whale-gallery-item]').length===1);
  assert.equal(await page.locator('[data-whale-gallery-title]').textContent(),'Lucy');
  await search().focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  assert.equal(await search().evaluate(n=>document.activeElement===n&&n.matches(':focus-visible')),true);
  assert.equal(await search().evaluate(n=>getComputedStyle(n).outlineWidth),'2px');
  await search().fill('');await page.waitForFunction(()=>document.querySelectorAll('[data-whale-gallery-item]').length>1);
 });
 await page.locator('[data-whale-playback-action=start]:visible').click();
 await page.waitForFunction(()=>qa.observation().wallpaper.rendered>0&&document.body.dataset.wmBackdrop==='wallpaper');
 const generation=(await observe()).wallpaper.generation;
 await root().evaluate(n=>{n.style.width='420px';n.style.flex='none';});
 await record('Basic controls: real dark/light SDK uses native inputs over a transparent gallery',async()=>{
  for(const theme of ['abyss','mist']){
   await page.evaluate(theme=>qa.setAppearance('theme',theme),theme);
   await page.mouse.move(5,5);
   // The existing host hover transition can still be fading after moving away.
   // Wait for the resting state instead of measuring its intermediate tint.
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-whale-playback-action]')).backgroundColor==='rgba(0, 0, 0, 0)');
   const s=await readField();assert.equal(s.fill,'rgba(0, 0, 0, 0)');assert.equal(s.image,'none');assert.equal(s.blur,'none');assert.equal(s.shadow,'none');
   const checkbox=await root().locator('input[type=checkbox]').first().evaluate(n=>({appearance:getComputedStyle(n).appearance,before:getComputedStyle(n,'::before').content,width:getComputedStyle(n).width}));
   assert.equal(checkbox.appearance,'auto');assert.equal(checkbox.before,'none');assert.equal(checkbox.width,'16px');
   const button=await page.locator('[data-whale-playback-action=stop]:visible').evaluate(n=>({fill:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage,shadow:getComputedStyle(n).boxShadow,blur:getComputedStyle(n).backdropFilter}));
   assert.equal(button.fill,'rgba(0, 0, 0, 0)');assert.equal(button.image,'none');assert.equal(button.shadow,'none');assert.equal(button.blur,'none');
   assert.equal((await observe()).wallpaper.generation,generation);observations.push({kind:'theme',theme,field:s,checkbox,button});
   await root().screenshot({path:outputRoot+'basic-'+theme+'-gallery.png',animations:'disabled'});
  }
 });
 await page.locator('[data-whale-playback-action=stop]:visible').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 await record('Basic controls: high-contrast fallback retains a solid field and native input',async()=>{
  await page.emulateMedia({contrast:'more'});const s=await readField();assert.notEqual(s.fill,'rgba(0, 0, 0, 0)');assert.equal(s.image,'none');assert.equal(s.blur,'none');assert.equal(s.shadow,'none');observations.push({kind:'high-contrast',...s});await page.emulateMedia({contrast:'no-preference'});
 });
 await page.evaluate(theme=>qa.setAppearance('theme',theme),initial.theme);
 await page.locator('[data-whale-change-wallpaper]:visible').click();await root().evaluate(n=>{n.style.width='';n.style.flex='';});
 await writeFile(outputRoot+'basic-controls-observations.json',JSON.stringify(observations,null,2),{flag:'wx'});
}
