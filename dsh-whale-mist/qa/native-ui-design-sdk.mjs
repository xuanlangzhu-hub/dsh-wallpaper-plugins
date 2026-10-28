import assert from 'node:assert/strict';

// Real DOM / official SDK check. Host/native IO is supplied by the isolated
// integration fixture; these assertions do not inspect the user's daily DSH.
export async function assertAstraDesign({page,record,observe,outputRoot}){
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const field=key=>page.locator('[data-whale-interface-option='+key+']:visible');
 const list=async node=>page.locator('[id="'+await node.getAttribute('aria-controls')+'"]');
 const openLists=()=>page.locator('[data-whale-choice-list]:popover-open');
 const choose=async(node,value)=>{if(await node.getAttribute('role')==='radiogroup'){await node.locator('input[value="'+value+'"]').check();return;}await node.click();await(await list(node)).locator('[role=option][data-value="'+value+'"]').click();};
 const ensureMore=async()=>{if(await page.locator('[data-whale-fold=interface]').getAttribute('open')===null)await page.locator('[data-whale-fold=interface] > summary').click();};
 const writes=async()=>JSON.stringify((await observe()).appearanceWrites);
 await page.locator('#whale-appearance-header-btn').click();
 await page.locator('[data-whale-native-sidebar]:visible').waitFor();
 await record('design: compact header, single main action and closed low-frequency groups',async()=>{
   assert.equal(await page.locator('[data-whale-header-actions] [data-whale-playback-action]').count(),1);
   assert.equal(await page.locator('[data-whale-object-more] [data-whale-menu-trigger]').getAttribute('aria-label'),'壁纸更多操作');
   assert.equal(await page.locator('[data-whale-fold=picture]').count(),0);
   assert.equal(await page.locator('[data-whale-playback-options]').getAttribute('open'),null);
   assert.equal(await page.locator('[data-whale-appearance-range=blur]').isVisible(),true);
   assert.equal(await page.locator('[data-whale-appearance-range=brightness]').isVisible(),true);
   assert.equal(await page.locator('[data-whale-appearance-range=mask]').isVisible(),true);
   const rect=await page.locator('[data-whale-playback-header]').boundingBox();assert.ok(rect.height<=180,JSON.stringify(rect));
 });
 await section('interface').click();
 await record('design: interface grouping is readable and low-frequency controls stay reachable',async()=>{
   assert.deepEqual(await page.locator('[data-whale-page-panel=interface] [data-whale-control-group] > legend').allTextContents(),['主题与配色','文字']);
   assert.equal(await field('textContrast').isVisible(),true);
   assert.equal(await page.locator('[data-whale-appearance-range=chatBackdrop]').isVisible(),false);
   assert.equal(await page.locator('[data-whale-fold=interface]').getAttribute('open'),null);
   assert.equal(await page.locator('[data-whale-native-sidebar] select').count(),0);
   await page.locator('[data-whale-fold=interface] > summary').click();
   for(const key of ['sidebar','canvas','glass'])assert.equal(await field(key).getAttribute('role'),'radiogroup');
   await page.locator('[data-whale-fold=interface] > summary').click();
 });
 await record('choice: interface choices preserve their exact setting keys',async()=>{
   const before={...(await observe()).settings};
   await choose(field('palette'),'graphite');assert.equal((await observe()).settings.palette,'graphite');await choose(field('palette'),before.palette);
   await choose(field('accentMode'),'custom');assert.equal(await page.locator('[data-whale-interface-color=accentColor]').isVisible(),true);
   await choose(field('accentMode'),before.accentMode);assert.equal(await page.locator('[data-whale-interface-color=accentColor]').count(),0);
   await ensureMore();
   for(const [key,value] of [['sidebar','deep'],['canvas','clear'],['glass','restrained']]){
     await choose(field(key),value);assert.equal((await observe()).settings[key],value);await choose(field(key),before[key]);
   }
   await page.locator('[data-whale-fold=interface] > summary').click();
   assert.equal((await observe()).settings.weScene,before.weScene);assert.equal((await observe()).wallpaper.state,'idle');
 });
 // Representative synthetic SDK previews; no user's live app is sampled.
 await page.locator('[data-whale-page-panel=interface]').evaluate(n=>{n.scrollTop=0;});await page.locator('[data-whale-native-sidebar]:visible').screenshot({animations:'disabled',path:outputRoot+'/ui-dark-interface.png'});
 await choose(field('theme'),'mist');await page.locator('[data-whale-native-sidebar]:visible').screenshot({animations:'disabled',path:outputRoot+'/ui-light-interface.png'});
 await choose(field('theme'),'abyss');await section('wallpaper').click();
 await page.locator('[data-whale-playback-options] > summary').click();
 const mode=page.locator('[data-whale-playback-option=weMode]');
 await record('choice: remaining menu ArrowDown browses, Escape cancels and restores focus without writes',async()=>{
   const before=await writes();await mode.focus();await mode.press('ArrowDown');
   assert.equal(await mode.getAttribute('aria-expanded'),'true');assert.equal(await mode.evaluate(n=>n.value),'daily');assert.equal(await (await list(mode)).locator('[data-active=true]').getAttribute('data-value'),'preview');assert.equal(await writes(),before);
   await mode.press('Escape');assert.equal(await mode.evaluate(n=>n===document.activeElement),true);assert.equal(await writes(),before);
 });
 await record('choice: remaining menu Enter confirms once and same-value selection does not rewrite',async()=>{
   const count=(await observe()).appearanceWrites.length;await mode.press('ArrowDown');await mode.press('Enter');assert.equal((await observe()).settings.weMode,'preview');assert.equal((await observe()).appearanceWrites.length,count+1);
   await choose(mode,'preview');assert.equal((await observe()).appearanceWrites.length,count+1);await choose(mode,'daily');
 });
 await record('choice: remaining menu Home/End/text search browse without committing',async()=>{
   const before=await writes();await mode.press('Home');assert.equal(await (await list(mode)).locator('[data-active=true]').getAttribute('data-value'),'daily');await mode.press('End');assert.equal(await (await list(mode)).locator('[data-active=true]').getAttribute('data-value'),'preview');await mode.press('Escape');
   await mode.dispatchEvent('keydown',{key:'日'});assert.equal(await mode.getAttribute('aria-expanded'),'true');await mode.press('Escape');assert.equal(await writes(),before);
 });
 await record('choice: remaining menu outside pointer/Tab/section changes dismiss without commit',async()=>{
   const before=await writes();await mode.press('Home');await page.locator('[data-whale-settings-navigation]').click();assert.equal(await openLists().count(),0);await mode.focus();await mode.press('Home');await mode.press('Tab');assert.equal(await openLists().count(),0);assert.equal(await mode.evaluate(n=>n===document.activeElement),false);
   await mode.click();await section('interface').click();assert.equal(await openLists().count(),0);await section('wallpaper').click();assert.equal(await writes(),before);
 });
 await record('choice: theme change invalidates a remaining menu and its detached old option',async()=>{
   await mode.click();const old=await (await list(mode)).locator('[data-value=preview]').elementHandle();await page.evaluate(()=>qa.setAppearance('theme','mist'));await page.waitForFunction(()=>document.querySelectorAll('[data-whale-choice-list]:popover-open').length===0);
   const before=await writes();await old.evaluate(n=>n.click());assert.equal(await writes(),before);assert.equal((await observe()).settings.weMode,'daily');await old.dispose();await page.evaluate(()=>qa.setAppearance('theme','abyss'));
 });
 await record('choice: remaining menu fits 320/360/520px and doubled text, retains an opaque surface and forced-colour access',async()=>{
   for(const width of [320,360,520]){await page.locator('[data-whale-native-sidebar]:visible').evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';},width);await mode.click();const rect=await (await list(mode)).boundingBox(),size=page.viewportSize();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width&&rect.y+rect.height<=size.height);await mode.press('Escape');}
   await page.locator('[data-whale-native-sidebar]:visible').evaluate(n=>{n.style.width='360px';n.style.fontSize='28px';});await mode.click();assert.ok(await (await list(mode)).evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=28));assert.equal(await page.locator('[data-whale-native-sidebar]:visible').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);await mode.press('Escape');await page.locator('[data-whale-native-sidebar]:visible').evaluate(n=>{n.style.fontSize='';});
   await mode.click();const color=await (await list(mode)).evaluate(n=>getComputedStyle(n).backgroundColor);assert.ok(!color.startsWith('rgba(')||/,[ ]*1\)$/.test(color),color);await mode.press('Escape');await page.emulateMedia({forcedColors:'active'});await mode.click();assert.equal(await openLists().count(),1);await mode.press('Escape');await page.emulateMedia({forcedColors:'none'});
 });
 await record('choice: remaining menu uses available space above in a short viewport',async()=>{
   await page.setViewportSize({width:1280,height:330});await mode.evaluate(n=>{n.dataset.savedStyle=n.style.cssText;Object.assign(n.style,{position:'fixed',left:'800px',bottom:'8px',width:'280px'});});await mode.click();const a=await mode.boundingBox(),b=await (await list(mode)).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=330&&b.y+b.height<=a.y);await mode.press('Escape');await mode.evaluate(n=>{n.style.cssText=n.dataset.savedStyle;delete n.dataset.savedStyle;});await page.setViewportSize({width:1280,height:800});
 });
 await record('choice: hidden sidebar drops its popup with no implicit play or settings write',async()=>{

   await mode.click();const before=await writes();await page.evaluate(()=>qa.collapse());await page.waitForFunction(()=>document.querySelectorAll('[data-whale-choice-list]:popover-open').length===0);
   assert.equal(await writes(),before);await page.evaluate(()=>qa.open());await page.locator('[data-whale-native-sidebar]:visible').waitFor();
 });
 await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');
 await page.locator('[data-whale-author-read]').click();await page.locator('[data-whale-author-key=caption]').waitFor();
 await record('choice: opening a combo cannot blur-submit another unfinished author input',async()=>{
   const caption=page.locator('[data-whale-author-key=caption]'),variant=page.locator('[data-whale-author-key=variant]');
   await caption.fill('unfinished edit');await variant.click();assert.equal(await variant.getAttribute('aria-expanded'),'false');
   assert.equal(await caption.evaluate(n=>n===document.activeElement),true);assert.equal((await observe()).wallpaper.state,'playing');
   await caption.press('Escape');
 });
 await record('choice: an option from an unmounted target cannot apply to the replacement',async()=>{
   const variant=page.locator('[data-whale-author-key=variant]');await variant.click();const old=await (await list(variant)).locator('[data-value="4"]').elementHandle();
   await page.locator('[data-whale-change-wallpaper]').click();await page.locator('[data-whale-gallery-item="we-000000000000000000000001"]').click();
   const before=await writes();await old.evaluate(n=>n.click());assert.equal(await writes(),before);assert.equal((await observe()).wallpaper.host.activeSceneId,'lucy');
   await old.dispose();assert.equal(await page.locator('[data-whale-gallery]').count(),1);await page.locator('[data-whale-gallery-item=lucy]').click();await page.locator('[data-whale-change-wallpaper]').click();
   await page.locator('[data-whale-author-read]').click();await page.locator('[data-whale-author-key=variant]').waitFor();
 });
 await page.locator('[data-whale-native-sidebar]:visible').screenshot({animations:'disabled',path:outputRoot+'/ui-wallpaper-detail.png'});
 await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
}
