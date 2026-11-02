import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Visual CSS checks in the actual isolated SDK; native/source IO remains substituted.
export async function assertThinGlass({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const initial={...(await observe()).settings};
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const observations=[];
 await section('wallpaper').click();
 await record('Thin glass: real button has local 3px blur, a thin inset edge, and unchanged geometry',async()=>{
  const button=page.locator('[data-whale-playback-action=start]:visible');
  const info=await button.evaluate(n=>{const s=getComputedStyle(n),root=n.closest('[data-whale-native-sidebar]');return {font:s.fontSize,rootFont:getComputedStyle(root).fontSize,height:n.getBoundingClientRect().height,filter:s.backdropFilter,shadow:s.boxShadow,fill:s.backgroundColor,gradient:s.backgroundImage,rootFilter:getComputedStyle(root).backdropFilter};});
  assert.equal(info.font,info.rootFont);assert.ok(parseFloat(info.font)>=14);assert.ok(info.height>=36);
  assert.equal(info.filter,'blur(3px) saturate(1.2)');assert.equal(info.rootFilter,'none');
  assert.equal(info.shadow,'rgba(255, 255, 255, 0.32) 0px 0.5px 0px 0px inset');
  await button.hover();const hover=await button.evaluate(n=>getComputedStyle(n).backgroundImage);assert.notEqual(hover,info.gradient);
  await button.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  assert.equal(await button.evaluate(n=>document.activeElement===n&&n.matches(':focus-visible')),true);
  assert.equal(await button.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
  observations.push({kind:'button',...info,hover});
 });
 await page.locator('[data-whale-playback-action=start]:visible').click();
 await page.waitForFunction(()=>qa.observation().wallpaper.rendered>0&&document.body.dataset.wmBackdrop==='wallpaper');
 const generation=(await observe()).wallpaper.generation;
 await record('Thin glass: actual author input retains native semantics and flat material',async()=>{
  const slider=page.locator('input[type=range][data-whale-author-key=speed]');await slider.waitFor();
  const info=await slider.evaluate(n=>{const track=getComputedStyle(n,'::-webkit-slider-runnable-track'),thumb=getComputedStyle(n,'::-webkit-slider-thumb');return {type:n.type,disabled:n.disabled,trackShadow:track.boxShadow,thumbWidth:thumb.width,thumbFilter:thumb.backdropFilter};});
  assert.equal(info.type,'range');assert.equal(info.disabled,false);
  // Pseudo-element computed styles are not reliable in Chromium; geometry/pixels
  // below and the existing keyboard 2 -> 3 -> 2 checks cover the actual input.
  const toggle=page.locator('input[type=checkbox][data-whale-author-key=particles]');
  const material=await toggle.evaluate(n=>{const s=getComputedStyle(n);return {width:s.width,height:s.height,filter:s.backdropFilter,fill:s.backgroundColor,checked:n.checked};});
  assert.equal(material.width,'40px');assert.equal(material.height,'24px');assert.equal(material.filter,'blur(3px) saturate(1.2)');assert.equal(material.checked,true);
  observations.push({kind:'author',...info,toggle:material});
 });
 await record('Thin glass: clear/frosted remain separate in both real SDK themes',async()=>{
  await root().evaluate(n=>{n.style.width='420px';n.style.flex='none';});
  for(const [key,value] of [['brightness',100],['mask',0],['surface',70]])await page.evaluate(([key,value])=>qa.setAppearance(key,value),[key,value]);
  for(const theme of ['abyss','mist']){
   await page.evaluate(theme=>qa.setAppearance('theme',theme),theme);
   for(const material of ['clear','frosted']){
    await root().locator('[data-whale-interface-option=panelMaterial] [data-whale-choice-segment='+material+']').click();
    await page.waitForFunction(material=>document.querySelector('[data-whale-native-sidebar]')?.dataset.whalePanelMaterial===material,material);
    const info=await root().evaluate(n=>({panel:getComputedStyle(n).backdropFilter,button:getComputedStyle(n.querySelector('[data-whale-playback-action]')).backdropFilter,font:getComputedStyle(n).fontSize}));
    assert.equal(info.panel,material==='clear'?'none':'blur(18px)');assert.equal(info.button,'blur(3px) saturate(1.2)');
    assert.equal((await observe()).wallpaper.generation,generation);
    observations.push({kind:'theme',theme,material,...info});
    await root().screenshot({path:outputRoot+'thin-'+theme+'-'+material+'.png',animations:'disabled'});
   }
  }
 });
 await root().locator('[data-whale-interface-option=panelMaterial] [data-whale-choice-segment=clear]').click();
 await page.locator('[data-whale-playback-action=stop]:visible').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 await record('Thin glass: high contrast uses a solid fallback and removes local backdrop filters',async()=>{
  await page.emulateMedia({contrast:'more'});
  const info=await page.locator('[data-whale-playback-action=start]:visible').evaluate(n=>{const s=getComputedStyle(n);return {filter:s.backdropFilter,shadow:s.boxShadow,fill:s.backgroundColor};});
  assert.equal(info.filter,'none');assert.equal(info.shadow,'none');assert.ok(!info.fill.startsWith('rgba('),info.fill);
  await page.emulateMedia({contrast:'no-preference'});observations.push({kind:'contrast',...info});
 });
 for(const key of ['theme','brightness','mask','surface'])await page.evaluate(([key,value])=>qa.setAppearance(key,value),[key,initial[key]]);
 await root().evaluate(n=>{n.style.width='';n.style.flex='';});
 await writeFile(outputRoot+'thin-glass-observations.json',JSON.stringify(observations,null,2),{flag:'wx'});
}
