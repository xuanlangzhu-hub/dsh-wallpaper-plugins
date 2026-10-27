import assert from 'node:assert/strict';

// Actual SDK DOM; metadata is synthetic, and WE command/window IO is substituted.
export async function assertAuthorPresentation({page,record,observe,outputRoot,readAuthorStats}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const author=()=>page.locator('[data-whale-author-switches]:visible');
 const read=()=>page.locator('[data-whale-author-read]:visible');
 const help=()=>page.locator('[data-whale-menu-trigger=author-source]:visible');
 const popup=name=>page.locator('[data-whale-action-menu-popup="'+name+'"]');
 const close=async name=>{await popup(name).getByRole('button',{name:'关闭说明',exact:true}).press('Escape');};
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await page.locator('[data-whale-settings-section=wallpaper]').click();
 const initial=readAuthorStats();
 await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');await author().waitFor();await page.locator('[data-whale-author-key=caption]').waitFor();
 await record('author heading: one automatic initial read in header, with no apply',async()=>{
   assert.equal(await author().getAttribute('aria-label'),'作者参数');assert.equal(await author().locator('legend > span').first().textContent(),'作者参数');
   assert.equal(await read().getAttribute('aria-label'),'重新读取作者参数');assert.ok(await author().locator('[data-whale-author-key]').count()>0);
   const a=await author().locator('legend').boundingBox(),b=await read().boundingBox();assert.ok(b.y>=a.y&&b.y+b.height<=a.y+a.height+1);
   assert.equal(readAuthorStats().reads,initial.reads+1);assert.equal(readAuthorStats().commands,initial.commands);assert.equal(await author().locator('details[data-whale-author-source]').count(),0);
 });
 await record('author help: keyboard opens a read-only dialog, scope is clear, Escape returns focus with zero IO',async()=>{
   const before=readAuthorStats(),a=await author().boundingBox();await help().focus();await help().press('Enter');
   assert.equal(await popup('author-source').getAttribute('role'),'dialog');assert.equal(await popup('author-source').isVisible(),true);
   assert.match(await popup('author-source').textContent(),/未读取壁纸实际值/);assert.match(await popup('author-source').textContent(),/不读取壁纸实际值，不重复下发/);
   const b=await author().boundingBox();assert.ok(Math.abs(a.height-b.height)<=1);assert.deepEqual(readAuthorStats(),before);
   await popup('author-source').screenshot({path:outputRoot+'/step3-source-help.png'});
   await close('author-source');assert.equal(await help().evaluate(n=>n===document.activeElement),true);
 });
 await page.locator('[data-whale-author-key=caption]').waitFor();
 await record('author read: initial automatic load occurs once; refresh retains its full accessible name',async()=>{
   assert.equal(readAuthorStats().reads,initial.reads+1);assert.equal(readAuthorStats().commands,initial.commands);
   assert.equal(await read().getAttribute('aria-label'),'重新读取作者参数');assert.equal(await read().textContent(),'↻');
   assert.match(await read().getAttribute('title'),/设置结构和本机记录/);
   const heading=await author().locator('legend').boundingBox(),button=await read().boundingBox();assert.ok(button.y>=heading.y&&button.y+button.height<=heading.y+heading.height+1);
   assert.equal(await author().locator('[data-whale-author-original]').filter({visible:true}).count(),0);
 });
 await record('author labels: only exact known names simplify, original name stays keyboard-accessible nearby',async()=>{
   assert.equal(await page.locator('[data-whale-author-key=particles]').getAttribute('aria-label'),'粒子');
   assert.equal(await page.locator('[data-whale-author-key=switchOption]').getAttribute('aria-label'),'开关');
   assert.equal(await page.locator('[data-whale-author-key=marketing]').getAttribute('aria-label'),'隐藏作者营销文字');
   const original=page.locator('[data-whale-menu-trigger=author-original-particles]'),before=readAuthorStats();await original.focus();await original.press('Enter');
   assert.equal(await popup('author-original-particles').locator('[data-whale-author-original]').textContent(),'粒子/Particles');
   assert.deepEqual(readAuthorStats(),before);await close('author-original-particles');assert.equal(await original.evaluate(n=>n===document.activeElement),true);
 });
 await record('author labels: existing controller still excludes unresolved tokens; projected names preserve slashes safely',async()=>{
   assert.equal(await page.locator('[data-whale-author-key=unnamed]').count(),0);assert.equal(await page.locator('[data-whale-menu-trigger=author-original-unnamed]').count(),0);
   assert.equal(await page.locator('[data-whale-author-name=caption] > label').textContent(),'Caption / A/B');
   assert.equal(await author().locator('img[src=x]').count(),0);assert.equal(await author().locator('label[for]').count()>0,true);
 });
 await record('author help: one popup owner, outside/section changes dismiss without loading or applying',async()=>{
   const before=readAuthorStats();await help().click();await page.locator('[data-whale-menu-trigger=author-original-particles]').focus();await page.locator('[data-whale-menu-trigger=author-original-particles]').press('Enter');
   assert.equal(await page.locator('[data-whale-action-menu-popup]:popover-open').count(),1);assert.equal(await popup('author-source').evaluate(n=>n.matches(':popover-open')),false);
   await page.locator('[data-whale-settings-section=interface]').click();assert.equal(await page.locator('[data-whale-action-menu-popup]:popover-open').count(),0);
   await page.locator('[data-whale-settings-section=wallpaper]').click();assert.deepEqual(readAuthorStats(),before);
 });
 await record('author refresh: editing consequence remains explicit, refresh cancels unsubmitted text without apply',async()=>{
   const caption=page.locator('[data-whale-author-key=caption]'),before=readAuthorStats();await caption.fill('unsent text for refresh');
   assert.equal(await read().getAttribute('aria-label'),'取消编辑并重新读取作者参数');assert.equal(await read().textContent(),'取消编辑并重读');assert.equal(await help().isDisabled(),true);
   await read().click();await page.waitForFunction(()=>document.querySelector('[data-whale-author-read]')?.getAttribute('aria-label')==='重新读取作者参数');
   assert.equal(await caption.inputValue(),'seed');assert.equal(readAuthorStats().reads,before.reads+1);assert.equal(readAuthorStats().commands,before.commands);
 });
 await record('author heading/name help: narrow/large text/forced colors remain reachable',async()=>{
   for(const width of [280,360,520]){await root().evaluate((n,w)=>{n.style.width=w+'px';},width);assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);}
   await root().evaluate(n=>{n.style.fontSize='28px';n.style.width='280px';});assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   await root().evaluate(n=>{n.style.fontSize='';n.style.width='520px';});
   await page.emulateMedia({forcedColors:'active'});await help().click();assert.equal(await popup('author-source').isVisible(),true);await close('author-source');await page.emulateMedia({forcedColors:'none'});
   await page.locator('[data-whale-page-panel=wallpaper]').evaluate(n=>{n.scrollTop=0;});await root().screenshot({path:outputRoot+'/step3-author.png',animations:'disabled'});
 });
 await record('author label interaction: one toggle per label click, original-name help never toggles it',async()=>{
   const label=page.locator('[data-whale-author-name=particles] > label'),input=page.locator('[data-whale-author-key=particles]'),before=readAuthorStats();
   await label.click();await page.waitForFunction(()=>document.querySelector('[data-whale-author-feedback=particles]')?.dataset.state==='sent');assert.equal(await input.isChecked(),false);assert.equal(readAuthorStats().commands,before.commands+1);
   await page.locator('[data-whale-menu-trigger=author-original-particles]').click();assert.equal(await input.isChecked(),false);assert.equal(readAuthorStats().commands,before.commands+1);await close('author-original-particles');
   await label.click();await page.waitForFunction(()=>document.querySelector('[data-whale-author-feedback=particles]')?.dataset.state==='sent');assert.equal(await input.isChecked(),true);assert.equal(readAuthorStats().commands,before.commands+2);
 });
 await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
}
