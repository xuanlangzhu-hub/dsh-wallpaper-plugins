import assert from 'node:assert/strict';

// Actual SDK/native-sidebar DOM and product controllers. Catalog/previews/source IO are synthetic.
export async function assertGalleryPolish({page,record,observe,outputRoot,backend}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const header=()=>page.locator('[data-whale-change-wallpaper]:visible');
 const gallery=()=>page.locator('[data-whale-gallery]:visible');
 const panel=()=>page.locator('[data-whale-page-panel=wallpaper]:visible');
 const grid=()=>page.locator('[data-whale-gallery-grid]:visible');
 const pager=()=>page.locator('[data-whale-gallery-pagination]:visible');
 const card=id=>page.locator('[data-whale-gallery-item="'+id+'"]');
 const query=()=>page.getByRole('searchbox',{name:'搜索壁纸'});
 const next=()=>pager().getByRole('button',{name:'下一页',exact:true});
 const previous=()=>pager().getByRole('button',{name:'上一页',exact:true});
 const coast='we-000000000000000000000001',adult='we-000000000000000000000066';
 const open=async()=>{if(await header().getAttribute('aria-expanded')!=='true')await header().click();await gallery().waitFor();};
 const close=async()=>{if(await header().getAttribute('aria-expanded')==='true')await header().click();};
 const writes=async()=>JSON.stringify((await observe()).appearanceWrites);
 const isInPanel=async node=>{const a=await node.boundingBox(),b=await panel().boundingBox();assert.ok(a&&b&&a.y>=b.y-1&&a.y+a.height<=b.y+b.height+1,JSON.stringify({control:a,panel:b}));};
 if(!await root().count()){await page.locator('#whale-appearance-header-btn').click();await root().waitFor();}
 await page.locator('[data-whale-settings-section=wallpaper]').click();
 await record('gallery polish: one pointer gesture opens once, header opens wallpaper parameters, no settings or source mutation',async()=>{
   const before=await writes(),commands=backend.stats().commands;await open();assert.equal(await header().getAttribute('aria-label'),'壁纸参数');assert.equal(await header().textContent(),'壁纸参数');
   assert.equal(await gallery().getByRole('button',{name:/当前壁纸/}).count(),0);assert.equal(await gallery().locator('strong').count(),0);
   assert.equal(await grid().locator('[data-whale-gallery-item]').count(),12);assert.equal(await writes(),before);assert.equal(backend.stats().commands,commands);
 });
 await record('gallery polish: header entry and return from Interface navigate to wallpaper without changing the source',async()=>{
   await close();await page.locator('[data-whale-settings-section=interface]').click();const commands=backend.stats().commands;
   await header().click();assert.equal(await page.locator('[data-whale-settings-section=wallpaper]').getAttribute('aria-selected'),'true');assert.equal(await gallery().count(),1);
   await page.locator('[data-whale-settings-section=interface]').click();await header().click();assert.equal(await gallery().count(),0);assert.equal(await page.locator('[data-whale-settings-section=wallpaper]').getAttribute('aria-selected'),'true');assert.equal(backend.stats().commands,commands);await open();
 });
 await record('gallery polish: density is 3/2/1 columns at 520/360/280px with 16:9 previews and single-line titles',async()=>{
   for(const [width,columns]of [[520,3],[360,2],[280,1]]){
     await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';},width);
     assert.equal(await grid().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),columns);assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
     const image=await card('lucy').locator('[data-whale-gallery-thumbnail]').boundingBox();assert.ok(Math.abs(image.width/image.height-16/9)<.05);
     assert.equal(await card('lucy').locator('[data-whale-gallery-title]').evaluate(n=>getComputedStyle(n).whiteSpace),'nowrap');
     assert.equal(await card('lucy').getAttribute('title'),await card('lucy').getAttribute('aria-label'));assert.equal(await card('lucy').locator('[data-whale-gallery-type]').textContent(),'场景');
   }
   await root().evaluate(n=>{n.style.width='360px';});const size=await card('lucy').boundingBox();assert.ok(size.height<135,JSON.stringify(size));
 });
 await record('gallery polish: pagination remains visible at list top/bottom, page limits and focus survive a change',async()=>{
   await panel().evaluate(n=>{n.scrollTop=0;});await isInPanel(pager());const fill=await pager().evaluate(n=>getComputedStyle(n).backgroundColor);assert.ok(!fill.startsWith('rgba(')||/,[ ]*1\)$/.test(fill),fill);const barAtTop=await pager().boundingBox(),panelBox=await panel().boundingBox();assert.ok(Math.abs(barAtTop.y+barAtTop.height-panelBox.y-panelBox.height)<2);assert.equal(await previous().isDisabled(),true);assert.equal(await pager().getByRole('status').count(),1);
   await panel().evaluate(n=>{n.scrollTop=n.scrollHeight;});await isInPanel(pager());const last=await grid().locator('[data-whale-gallery-item]').last().boundingBox(),bar=await pager().boundingBox();assert.ok(last.y+last.height<=bar.y+1);await next().click();assert.equal(await pager().locator('output').textContent(),'2 / 2');assert.equal(await next().isDisabled(),true);assert.equal(await grid().locator('[data-whale-gallery-item]').count(),4);
   assert.equal(await next().evaluate(n=>n===document.activeElement),false);await previous().click();assert.equal(await pager().locator('output').textContent(),'1 / 2');assert.equal(await grid().locator('[data-whale-gallery-item]').count(),12);await isInPanel(pager());
 });
 await record('gallery polish: rating-first search resets pagination without exposing excluded titles or preview requests',async()=>{
   await next().click();await query().fill('Public 3');assert.equal(await pager().count(),0);assert.equal(await grid().locator('[data-whale-gallery-item]').count(),1);assert.equal(await page.locator('[data-whale-gallery-count]').textContent(),'1 张');
   await query().fill('Adult synthetic');assert.equal(await grid().locator('[data-whale-gallery-item]').count(),0);assert.equal(await gallery().textContent().then(t=>t.includes('Adult synthetic')),false);
   assert.equal(backend.stats().previews.includes(adult),false);await query().fill('');assert.equal(await pager().locator('output').textContent(),'1 / 2');
 });
 await record('gallery polish: explicitly enabling then withdrawing Mature cancels late preview consumers without loading it by default',async()=>{
   await query().fill('Adult synthetic');backend.hold();
   try{await page.locator('[data-whale-rating=Mature]').check();await card(adult).waitFor();
     for(let i=0;i<50&&!backend.stats().previews.includes(adult);i++)await page.waitForTimeout(20);
     assert.equal(backend.stats().previews.includes(adult),true);await page.locator('[data-whale-rating=Mature]').uncheck();assert.equal(await card(adult).count(),0);
   }finally{backend.release();}
   await page.waitForTimeout(80);assert.equal(await grid().locator('img').count(),0);assert.equal(await gallery().textContent().then(t=>t.includes('Adult synthetic')),false);assert.deepEqual((await observe()).revokedWithConsumers,[]);
   await query().fill('');
 });
 await record('gallery polish: choosing no ratings stays empty; it does not silently restore Everyone or fetch filtered previews',async()=>{
   await page.locator('[data-whale-rating=Everyone]').uncheck();const requests=backend.stats().previews.length;assert.equal((await observe()).settings.weAgeRatings,'');assert.equal(await grid().locator('[data-whale-gallery-item]').count(),0);assert.equal(await pager().count(),0);assert.match(await gallery().textContent(),/请选择至少一个分级/);
   await page.waitForTimeout(80);assert.equal(backend.stats().previews.length,requests);await page.locator('[data-whale-rating=Everyone]').check();
 });
 await record('gallery polish: selected and playing badges describe different wallpapers; selection never restarts the active source',async()=>{
   await close();await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');await open();
   assert.equal(await card('lucy').getAttribute('aria-pressed'),'true');assert.equal(await card('lucy').locator('[data-whale-gallery-playing]').count(),1);
   const commands=backend.stats().commands;await card(coast).click();assert.equal(await gallery().count(),1);assert.equal((await observe()).settings.weScene,coast);assert.equal((await observe()).wallpaper.host.activeSceneId,'lucy');assert.equal(backend.stats().commands,commands);
   await open();assert.equal(await card('lucy').getAttribute('aria-pressed'),'false');assert.equal(await card(coast).getAttribute('aria-pressed'),'true');assert.equal(await card('lucy').locator('[data-whale-gallery-selected]').count(),0);assert.equal(await card(coast).locator('[data-whale-gallery-playing]').count(),0);
   const description=await card('lucy').getAttribute('aria-describedby');assert.match(await page.locator('[id="'+description+'"]').textContent(),/正在播放/);
   await page.locator('[data-whale-stop-current]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');assert.equal(await page.locator('[data-whale-gallery-playing]').count(),0);assert.equal(await card(coast).getAttribute('aria-pressed'),'true');await card('lucy').click();await close();
 });
 await record('gallery polish: Enter/Space and cancelled pointer gestures keep the header toggle single-action',async()=>{
   await header().focus();await header().press('Enter');assert.equal(await gallery().count(),1);await header().press('Enter');assert.equal(await gallery().count(),0);
   await header().press('Space');assert.equal(await gallery().count(),1);await header().press('Space');assert.equal(await gallery().count(),0);
   await header().dispatchEvent('pointerdown',{button:0});assert.equal(await gallery().count(),1);await header().dispatchEvent('pointercancel');await header().press('Enter');assert.equal(await gallery().count(),0);
 });
 await record('gallery polish: unavailable items stay disabled; large text/forced colours retain readable names checks and pager controls',async()=>{
   await open();await next().click();const unavailable=card('we-00000000000000000000000f');assert.equal(await unavailable.isDisabled(),true);const id=await unavailable.getAttribute('aria-describedby');assert.match(await page.locator('[id="'+id+'"]').textContent(),/不可选择/);await previous().click();
   await root().evaluate(n=>{n.style.width='280px';n.style.fontSize='28px';});assert.equal(await root().evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);await isInPanel(pager());await root().evaluate(n=>{n.style.width='360px';n.style.fontSize='';});
   await page.emulateMedia({forcedColors:'active'});await card('lucy').focus();await card('lucy').press('Tab');assert.equal(await card('lucy').locator('[data-whale-gallery-selected]').isVisible(),true);await page.emulateMedia({forcedColors:'none'});
   await panel().evaluate(n=>{n.scrollTop=0;});await root().screenshot({path:outputRoot+'/gallery-compact.png',animations:'disabled'});await root().evaluate(n=>{n.style.width='520px';});await root().screenshot({path:outputRoot+'/gallery-wide.png',animations:'disabled'});await root().evaluate(n=>{n.style.width='360px';});await close();assert.equal(await header().getAttribute('aria-label'),'更换壁纸');
 });
}
