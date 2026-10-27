import assert from 'node:assert/strict';

// Actual SDK title slot and sidebar DOM. Native/WE IO stays substituted by the integration fixture.
export async function assertTitleChevron({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 const fold=()=>page.locator('[data-whale-fold=interface]');
 const summary=()=>fold().locator('summary');
 const header=()=>page.locator('[data-whale-change-wallpaper]:visible');
 const mode=()=>page.locator('[data-whale-playback-option=weMode]:visible');
 const writes=async()=>JSON.stringify((await observe()).appearanceWrites);
 const transform=async(node,pseudo=null)=>node.evaluate((n,p)=>getComputedStyle(n,p).transform,pseudo);
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await record('title: actual SDK title slot uses compact visible text with full identity and unchanged header entry',async()=>{
   const title=page.locator('[data-whale-sidebar-title]:visible');assert.equal(await title.count(),1);assert.equal(await title.textContent(),'外观');assert.equal(await title.getAttribute('title'),'Whale 外观');assert.equal(await title.getAttribute('aria-label'),'Whale 外观');
   assert.equal(await page.locator('#whale-appearance-header-btn').textContent(),'Whale 外观');const box=await title.boundingBox();assert.ok(box.width>0&&box.width<80,JSON.stringify(box));
 });
 await section('interface').click();
 await record('chevron: native details uses one line arrow, click opens and Space closes without settings writes',async()=>{
   assert.equal(await fold().getAttribute('open'),null);const before=await writes(),closed=await transform(summary(),'::before');
   assert.equal(await summary().evaluate(n=>getComputedStyle(n).listStyleType),'none');assert.equal(await summary().evaluate(n=>getComputedStyle(n,'::marker').content),'""');
   assert.equal(await summary().evaluate(n=>parseFloat(getComputedStyle(n,'::before').borderRightWidth)>0),true);
   await summary().click();assert.notEqual(await fold().getAttribute('open'),null);assert.notEqual(await transform(summary(),'::before'),closed);assert.equal(await page.locator('[data-whale-fold-body]:visible').count()>0,true);
   await summary().focus();await summary().press('Space');assert.equal(await fold().getAttribute('open'),null);assert.equal(await writes(),before);
 });
 await record('chevron: Enter toggles the same native summary once and keyboard focus stays visible',async()=>{
   const before=await writes();await summary().press('Enter');assert.notEqual(await fold().getAttribute('open'),null);assert.equal(await summary().evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
   await summary().press('Enter');assert.equal(await fold().getAttribute('open'),null);assert.equal(await writes(),before);
 });
 await section('wallpaper').click();await page.locator('[data-whale-playback-options] > summary').click();
 await record('chevron: remaining Select uses matching stroke with real expanded direction, Escape restores focus without write',async()=>{
   const icon=mode().locator('[data-whale-chevron=down]'),before=await writes(),closed=await transform(icon);assert.equal(await icon.textContent(),'');assert.equal(await icon.getAttribute('aria-hidden'),'true');
   const border=await icon.evaluate(n=>getComputedStyle(n).borderRightWidth),summaryBorder=await summary().evaluate(n=>getComputedStyle(n,'::before').borderRightWidth);assert.equal(border,summaryBorder);
   await mode().focus();await mode().press('ArrowDown');assert.equal(await mode().getAttribute('aria-expanded'),'true');assert.notEqual(await transform(icon),closed);await mode().press('Escape');assert.equal(await mode().getAttribute('aria-expanded'),'false');assert.equal(await transform(icon),closed);assert.equal(await mode().evaluate(n=>n===document.activeElement),true);assert.equal(await writes(),before);
 });
 await page.locator('[data-whale-playback-options] > summary').click();
 await record('chevron: pager arrows keep explicit accessible names and original page actions',async()=>{
   await header().click();const pager=page.locator('[data-whale-gallery-pagination]:visible'),previous=pager.getByRole('button',{name:'上一页',exact:true}),next=pager.getByRole('button',{name:'下一页',exact:true}),before=await writes();
   assert.equal(await previous.locator('[data-whale-chevron=left]').getAttribute('aria-hidden'),'true');assert.equal(await next.locator('[data-whale-chevron=right]').getAttribute('aria-hidden'),'true');assert.equal(await next.textContent(),'');assert.equal(await previous.isDisabled(),true);
   assert.notEqual(await transform(previous.locator('[data-whale-chevron]')),await transform(next.locator('[data-whale-chevron]')));await next.click();assert.equal(await pager.locator('output').textContent(),'2 / 2');await previous.click();assert.equal(await pager.locator('output').textContent(),'1 / 2');assert.equal(await writes(),before);await header().click();
 });
 await record('chevron: forced colours and reduced motion retain keyboard focus and stroke, with no rotation animation',async()=>{
   await section('interface').click();await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await summary().focus();await summary().press('Enter');assert.notEqual(await fold().getAttribute('open'),null);
   const style=await summary().evaluate(n=>{const s=getComputedStyle(n,'::before');return {width:s.borderRightWidth,transition:s.transitionDuration};});assert.ok(parseFloat(style.width)>0);assert.equal(style.transition,'0s');assert.equal(await summary().evaluate(n=>getComputedStyle(n).outlineStyle),'solid');await summary().press('Enter');await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
 });
 await record('title/chevron: narrow panels and doubled text keep summaries and controls inside the layout',async()=>{
   for(const width of [280,360,520]){await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';n.style.fontSize='28px';},width);await summary().click();assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);const box=await summary().boundingBox(),parent=await fold().boundingBox();assert.ok(box.width<=parent.width+1);await summary().click();}
   await root().evaluate(n=>{n.style.width='360px';n.style.fontSize='';});await summary().click();await page.locator('[data-whale-page-panel=interface]').evaluate(n=>{n.scrollTop=n.scrollHeight;});await root().screenshot({path:outputRoot+'/chevron-interface.png',animations:'disabled'});await summary().click();
 });
 await section('wallpaper').click();
}
