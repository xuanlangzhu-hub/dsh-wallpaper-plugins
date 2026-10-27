import assert from 'node:assert/strict';

// Official Windows SDK DOM + actual Whale client/controllers. Native WE/window IO is substituted.
export async function assertStepOnePolish({page,record,observe,outputRoot,setStopMode}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const header=()=>page.locator('[data-whale-playback-header]:visible');
 const menu=name=>page.locator('[data-whale-menu-trigger="'+name+'"]:visible');
 const popup=name=>page.locator('[data-whale-action-menu-popup="'+name+'"]');
 const open=()=>page.locator('[data-whale-action-menu-popup]:popover-open');
 const section=key=>page.locator('[data-whale-settings-section="'+key+'"]:visible');
 const field=key=>page.locator('[data-whale-interface-option="'+key+'"]:visible');
 const writes=async()=>JSON.stringify((await observe()).appearanceWrites);
 const cancel=async name=>{await popup(name).locator('[role=menuitem]:enabled').first().press('Escape');};
 const almost=(a,b)=>assert.ok(Math.abs(a-b)<=1,JSON.stringify({before:a,after:b}));
 await record('polish: compact row at wide/narrow widths and larger text preserves accessible actions',async()=>{
   for(const width of [520,360,280]){
     await root().evaluate((n,w)=>{n.style.width=w+'px';},width);
     const box=await header().boundingBox();assert.ok(box.height<90,JSON.stringify({width,box}));
     assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
     assert.equal(await header().getByRole('button',{name:'开始播放',exact:true}).count(),1);
     assert.equal(await header().getByRole('button',{name:'更换壁纸',exact:true}).count(),1);
   }
   await root().evaluate(n=>{n.style.fontSize='28px';n.style.width='360px';});
   assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   await root().evaluate(n=>{n.style.fontSize='';n.style.width='520px';});
   const wallpaper=await header().boundingBox();await section('interface').click();
   const ui=await header().boundingBox();assert.ok(ui.height<wallpaper.height,JSON.stringify({wallpaper,ui}));
   await section('wallpaper').click();
 });
 await record('menu: opening a top-layer menu never changes header/body geometry or settings',async()=>{
   const before=await header().boundingBox(),body=await page.locator('[data-whale-page-panel=wallpaper]').boundingBox(),settings=await writes();
   await menu('object').click();assert.equal(await open().count(),1);
   const after=await header().boundingBox(),bodyAfter=await page.locator('[data-whale-page-panel=wallpaper]').boundingBox();
   almost(before.height,after.height);almost(before.y,after.y);almost(body.y,bodyAfter.y);
   assert.equal(await popup('object').locator('p').count(),0);assert.equal(await writes(),settings);
   const color=await popup('object').evaluate(n=>getComputedStyle(n).backgroundColor);assert.ok(color!=='rgba(0, 0, 0, 0)',color);
   await popup('object').screenshot({path:outputRoot+'/step1-menu.png'});
   await cancel('object');assert.equal(await open().count(),0);assert.equal(await menu('object').evaluate(n=>n===document.activeElement),true);
 });
 await record('menu: keyboard open, arrows, Tab and outside cancellation have no command side effect',async()=>{
   const before=await writes();await menu('object').focus();await menu('object').press('ArrowDown');
   assert.equal(await popup('object').locator('[role=menuitem]:enabled').first().evaluate(n=>n===document.activeElement),true);
   await popup('object').locator('[role=menuitem]:enabled').first().press('End');
   await popup('object').locator('[role=menuitem]:enabled').first().press('Tab');assert.equal(await open().count(),0);
   assert.equal(await menu('object').evaluate(n=>n===document.activeElement),false);
   await menu('object').click();await page.locator('[data-whale-settings-navigation]').click();assert.equal(await open().count(),0);
   assert.equal(await writes(),before);assert.equal((await observe()).settings.background,'wallpaper');
 });
 await record('menu: one shared popup owner, section/theme changes discard old command',async()=>{
   await section('wallpaper').click();if(await page.locator('[data-whale-playback-options]').getAttribute('open')===null)await page.locator('[data-whale-playback-options] > summary').click();await page.locator('[data-whale-playback-option=weMode]').click();assert.equal(await page.locator('[data-whale-choice-list]:popover-open').count(),1);
   await menu('object').click();assert.equal(await page.locator('[data-whale-choice-list]:popover-open').count(),0);assert.equal(await open().count(),1);
   const old=await popup('object').locator('[data-whale-close-wallpaper]').elementHandle();
   await page.evaluate(()=>qa.setAppearance('theme','mist'));await page.waitForFunction(()=>document.querySelectorAll('[data-whale-action-menu-popup]:popover-open').length===0);
   const before=await writes();await old.evaluate(n=>n.click());assert.equal(await writes(),before);await old.dispose();
   await page.evaluate(()=>qa.setAppearance('theme','abyss'));await section('wallpaper').click();
 });
 await record('menu: hide and session replacement dismiss open popups without executing actions',async()=>{
   const before=await writes();await menu('object').click();await page.evaluate(()=>qa.collapse());
   await page.waitForFunction(()=>document.querySelectorAll('[data-whale-action-menu-popup]:popover-open').length===0);
   await page.evaluate(()=>qa.open());await root().waitFor();await menu('object').click();await page.evaluate(()=>qa.changeSession('s2'));
   await page.waitForFunction(()=>document.querySelectorAll('[data-whale-action-menu-popup]:popover-open').length===0);
   await page.evaluate(()=>qa.changeSession('s1'));await page.evaluate(()=>qa.open());await root().waitFor();assert.equal(await writes(),before);
 });
 await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');
 await page.locator('[data-whale-author-read]').click();await page.locator('[data-whale-author-key=caption]').waitFor();
 await record('menu: pointer cannot blur-submit unfinished author text',async()=>{
   const caption=page.locator('[data-whale-author-key=caption]'),before=(await observe()).commands;
   await caption.fill('unfinished menu test');await menu('object').click();assert.equal(await open().count(),0);
   assert.equal(await caption.evaluate(n=>n===document.activeElement),true);assert.equal((await observe()).commands,before);
   await caption.press('Escape');
 });
 await record('surface: one sidebar fill uses existing opacity, header stays transparent and off switch is visible',async()=>{
   const fill=await root().evaluate(n=>{const s=getComputedStyle(n);return {actual:s.backgroundColor,expected:s.getPropertyValue('--dsw-specific-sidebar-fill').trim(),opacity:s.opacity};});
   assert.equal(fill.opacity,'1');assert.ok(fill.actual!=='rgba(0, 0, 0, 0)',JSON.stringify(fill));
   assert.equal(await header().evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
   const check=page.locator('input[type=checkbox][data-whale-author-key]').first();
   // No property write: off-state styling is inspected on an isolated cloned input.
   const off=await check.evaluate(n=>{const c=n.cloneNode();c.checked=false;c.disabled=false;n.parentElement.append(c);const s=getComputedStyle(c),thumb=getComputedStyle(c,'::before');const result={bg:s.backgroundColor,border:s.borderTopColor,thumb:thumb.backgroundColor};c.remove();return result;});
   assert.ok(off.bg!=='rgba(0, 0, 0, 0)',JSON.stringify(off));assert.notEqual(off.thumb,off.bg);
   await root().screenshot({path:outputRoot+'/step1-wallpaper.png',animations:'disabled'});
 });
 await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 await record('menu: existing close command executes once and stopped/disabled background states remain distinct',async()=>{
   await menu('object').click();await popup('object').locator('[data-whale-close-wallpaper]').click();
   await page.waitForFunction(()=>qa.observation().settings.background==='none');assert.equal(await open().count(),0);
   assert.equal(await page.locator('[data-whale-object-status]').textContent(),'背景已关闭');
   assert.equal(await page.locator('[data-whale-enable-wallpaper]').getAttribute('aria-label'),'启用壁纸背景');
 });
 await record('local menu: image removal popover preserves adjacent button size and calls existing media action',async()=>{
   const chooser=page.waitForEvent('filechooser',{timeout:3500});await page.locator('[data-whale-image-choose]').click();
   await(await chooser).setFiles({name:'offline-dot.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64')});
   await page.waitForFunction(()=>qa.observation().settings.background==='image');await menu('image').waitFor();
   const button=page.locator('[data-whale-image-choose]'),a=await button.boundingBox(),body=await page.locator('[data-whale-local-image]').boundingBox();
   await menu('image').click();const menuBox=await popup('image').boundingBox(),rootBox=await root().boundingBox();assert.ok(menuBox.x>=rootBox.x&&menuBox.x+menuBox.width<=rootBox.x+rootBox.width+1,JSON.stringify({menuBox,rootBox}));const b=await button.boundingBox(),after=await page.locator('[data-whale-local-image]').boundingBox();almost(a.height,b.height);almost(body.height,after.height);
   await page.locator('[data-whale-native-sidebar]:visible').screenshot({path:outputRoot+'/step1-local-media.png',animations:'disabled'});
   await popup('image').locator('[data-whale-image-remove]').click();await page.waitForFunction(()=>qa.observation().settings.background==='none');assert.equal(await open().count(),0);
 });
 await record('menu: forced colors retain visible menu items and Escape focus',async()=>{
   await page.locator('[data-whale-enable-wallpaper]').click();await page.waitForFunction(()=>qa.observation().settings.background==='wallpaper');
   await page.emulateMedia({forcedColors:'active'});await menu('object').click();assert.equal(await popup('object').locator('[role=menuitem]').isVisible(),true);await cancel('object');await page.emulateMedia({forcedColors:'none'});
 });
 await record('recovery: failed stop keeps a visible labelled retry outside the menu',async()=>{
   await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');
   setStopMode('fail');await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='cleanup-failed');
   const retry=page.locator('[data-whale-playback-recovery=true]');assert.equal(await retry.textContent(),'重试清理');assert.equal(await retry.isVisible(),true);
   setStopMode('ok');await retry.click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 });
 await section('interface').click();await root().screenshot({path:outputRoot+'/step1-interface.png',animations:'disabled'});
}
