import assert from 'node:assert/strict';

// Official SDK + actual client/Host routes. Native WE/window IO is substituted.
export async function assertInitialAuthorRead({page,record,observe,outputRoot,backend}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const read=()=>page.locator('[data-whale-author-read]:visible');
 const author=()=>page.locator('[data-whale-author-switches]:visible');
 const particle=()=>page.locator('[data-whale-author-key=particles]:visible');
 const stats=()=>{const s=backend.stats();return {...s,schema:s.requests.filter(r=>r.path.endsWith('/schema')).length,posts:s.requests.filter(r=>r.method==='POST').length};};
 const playing=async()=>{await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');};
 const ready=async()=>{await particle().waitFor();await page.waitForFunction(()=>document.querySelector('[data-whale-author-read]')?.getAttribute('aria-label')==='重新读取作者参数');};
 const stop=async()=>{backend.release();await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');};
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await record('auto read: stopped wallpaper and interface-only playback do not read author records',async()=>{
   const before=stats();assert.equal((await observe()).wallpaper.state==='stopped'||(await observe()).wallpaper.state==='idle',true);
   await section('interface').click();await playing();await page.waitForTimeout(80);assert.equal(stats().schema,before.schema);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
 });
 await record('auto read: visible qualified details populate with one GET and no draft/plan/apply',async()=>{
   const before=stats();await section('wallpaper').click();await ready();assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
   assert.equal(await read().textContent(),'↻');assert.equal(await particle().isEnabled(),true);
   await root().screenshot({path:outputRoot+'/initial-read-ready.png',animations:'disabled'});
 });
 await record('auto read: rerenders, help and section round trips do not repeat the initial GET',async()=>{
   const before=stats();await page.evaluate(()=>qa.updateBrightness(81));await page.locator('[data-whale-menu-trigger=author-source]').click();await page.locator('[data-whale-action-menu-popup=author-source]').getByRole('button',{name:'关闭说明'}).press('Escape');
   await section('interface').click();await section('wallpaper').click();await ready();assert.equal(stats().schema,before.schema);assert.equal(stats().posts,before.posts);
 });
 await record('auto read: selecting another wallpaper exposes no Lucy fields and returning gets one fresh scoped read',async()=>{
   const before=stats();await page.locator('[data-whale-change-wallpaper]').click();await page.locator('[data-whale-gallery-item="we-000000000000000000000001"]').click();
   assert.equal(await author().count(),0);assert.equal(stats().schema,before.schema);assert.equal((await observe()).wallpaper.host.activeSceneId,'lucy');
   assert.equal(await page.locator('[data-whale-gallery]').count(),1);await page.locator('[data-whale-gallery-item=lucy]').click();await page.locator('[data-whale-change-wallpaper]').click();await ready();assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
 });
 await record('auto read: explicit refresh remains one user-driven GET with no property replay',async()=>{
   const before=stats();await read().click();await ready();assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
 });
 await stop();
 await record('auto read: damaged read response displays retry and never loops on visibility changes',async()=>{
   const before=stats(),pattern='**/api/author-properties/schema**';
   const malformed=route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'offline-invalid-response'})});await page.route(pattern,malformed);
   await playing();await page.getByRole('button',{name:'重试读取作者参数',exact:true}).waitFor();assert.equal(stats().schema,before.schema+1);
   await section('interface').click();await section('wallpaper').click();await page.waitForTimeout(80);assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);
   await root().screenshot({path:outputRoot+'/initial-read-failure.png',animations:'disabled'});
   await page.unroute(pattern,malformed);await read().click();await ready();assert.equal(stats().schema,before.schema+2);assert.equal(stats().commands,before.commands);
 });
 await stop();
 await record('auto read: hidden pending metadata is aborted, late fields discarded, manual retry required',async()=>{
   const before=stats();backend.hold();await playing();
   for(let i=0;i<20&&backend.stats().held===0;i++)await page.waitForTimeout(15);assert.equal(backend.stats().held,1);
   await section('interface').click();backend.release();await section('wallpaper').click();await page.getByRole('button',{name:'重试读取作者参数',exact:true}).waitFor();
   assert.equal(await particle().count(),0);assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);
   await read().click();await ready();assert.equal(stats().schema,before.schema+2);
 });
 await stop();
 await record('auto read: stopping a pending generation cannot attach its fields to the replacement generation',async()=>{
   const before=stats();backend.hold();await playing();for(let i=0;i<20&&backend.stats().held===0;i++)await page.waitForTimeout(15);assert.equal(backend.stats().held,1);
   await stop();assert.equal(await author().count(),0);await playing();await ready();assert.equal(stats().schema,before.schema+2);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
 });
 await stop();
 await record('auto read: clean stale schema requires explicit refresh before any local record mutation',async()=>{
   const before=stats();backend.bumpSchema();await playing();await page.getByRole('button',{name:'重试读取作者参数',exact:true}).waitFor();
   assert.match(await author().textContent(),/手动重新读取以更新本机记录/);assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);assert.equal(await particle().count(),0);
   await read().click();await ready();assert.equal(stats().schema,before.schema+2);assert.equal(stats().posts,before.posts+1);assert.equal(stats().requests.at(-1).path,'/api/author-properties/draft');assert.equal(stats().commands,before.commands);
 });
 await record('auto read: pending local values from a refused explicit edit are not resent on the next playback',async()=>{
   const before=stats();backend.fault('before-send');await particle().uncheck();await page.waitForFunction(()=>document.querySelector('[data-whale-author-feedback=particles]')?.dataset.state==='error');backend.fault('none');
   assert.equal(stats().commands,before.commands);await stop();const afterEdit=stats();await playing();await page.locator('[data-whale-author-recovery]').waitFor();
   assert.equal(stats().schema,afterEdit.schema+1);assert.equal(stats().posts,afterEdit.posts);assert.equal(stats().commands,afterEdit.commands);assert.equal(await particle().isDisabled(),true);
 });
 await stop();
 await record('auto read: schema changes with dirty recovery preserve the old scope without reset or apply',async()=>{
   const before=stats();backend.bumpSchema();await playing();await page.locator('[data-whale-author-recovery]').waitFor();
   assert.match(await page.locator('[data-whale-author-recovery]').textContent(),/旧参数记录/);assert.equal(stats().schema,before.schema+1);assert.equal(stats().posts,before.posts);assert.equal(stats().commands,before.commands);
   await root().screenshot({path:outputRoot+'/initial-read-recovery.png',animations:'disabled'});
 });
 await stop();
}
