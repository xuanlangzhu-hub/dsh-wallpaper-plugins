import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// Fixed official SDK and full rc.57 adapter; no real wallpaper/application IO.
export async function assertGalleryPagination({page,record,observe,outputRoot}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const grid=()=>root().locator('[data-whale-gallery-grid]');
 const pager=()=>root().getByRole('navigation',{name:'壁纸分页'});
 const search=()=>root().getByRole('searchbox',{name:'搜索壁纸'});
 const initial={...(await observe()).settings},commands=(await observe()).commands;
 const measurements=[];
 await page.locator('[data-whale-change-wallpaper]:visible').click();
 await search().waitFor();
 await record('Gallery pagination: reserved transparent footer never overlays cards at normal/narrow sizes',async()=>{
  for(const height of [800,480])for(const width of [280,420,570]){
   await page.setViewportSize({width:1280,height});
   await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';},width);
   await grid().evaluate(n=>{n.scrollTop=n.scrollHeight;});
   const m=await root().evaluate(n=>{
    const g=n.querySelector('[data-whale-gallery-grid]'),p=n.querySelector('[data-whale-gallery-pagination]'),last=g.lastElementChild;
    const r=x=>{const b=x.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};};
    return {root:r(n),grid:r(g),pager:r(p),last:r(last),gridOverflow:getComputedStyle(g).overflowY,gridScroll:g.scrollTop,
     pagerPosition:getComputedStyle(p).position,pagerFill:getComputedStyle(p).backgroundColor,pagerBorder:getComputedStyle(p).borderTopWidth,
     horizontalOverflow:g.scrollWidth>g.clientWidth+1,rootOverflow:n.scrollWidth>n.clientWidth+1};
   });
   assert.equal(m.gridOverflow,'auto');assert.equal(m.pagerPosition,'static');assert.equal(m.pagerFill,'rgba(0, 0, 0, 0)');assert.equal(m.pagerBorder,'0px');
   assert.ok(m.grid.bottom<=m.pager.top+1,JSON.stringify(m));assert.ok(m.last.bottom<=m.grid.bottom+1,JSON.stringify(m));
   assert.ok(m.pager.bottom<=height+1,JSON.stringify(m));assert.ok(m.grid.height>40,JSON.stringify(m));
   assert.equal(m.horizontalOverflow,false);assert.equal(m.rootOverflow,false);measurements.push({width,height,...m});
  }
 });
 await page.setViewportSize({width:1280,height:800});
 await root().evaluate(n=>{n.style.width='420px';});
 await record('Gallery pagination: page change resets card scroll and preserves gallery selection without playback',async()=>{
  await grid().evaluate(n=>{n.scrollTop=n.scrollHeight;});
  const scrollProbe=await grid().evaluate(n=>({top:n.scrollTop,client:n.clientHeight,scroll:n.scrollHeight,rows:n.childElementCount,columns:getComputedStyle(n).gridTemplateColumns,tracks:getComputedStyle(n).gridTemplateRows}));
  await writeFile(outputRoot+'pagination-scroll-probe.json',JSON.stringify({measurements,scrollProbe},null,2),{flag:'wx'});
  assert.ok(scrollProbe.top>0,JSON.stringify(scrollProbe));
  await pager().getByRole('button',{name:'下一页'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-whale-gallery-pagination] output')?.textContent==='2 / 2');
  assert.equal(await grid().evaluate(n=>n.scrollTop),0);
  assert.equal(await pager().getByRole('button',{name:'下一页'}).isDisabled(),true);
  const item=grid().getByRole('button',{name:'Public 12',exact:true});await item.click();
  assert.equal(await item.getAttribute('aria-pressed'),'true');assert.equal(await search().isVisible(),true);
  await pager().getByRole('button',{name:'上一页'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-whale-gallery-pagination] output')?.textContent==='1 / 2');
  assert.equal(await grid().evaluate(n=>n.scrollTop),0);
  assert.equal(await pager().getByRole('button',{name:'上一页'}).isDisabled(),true);
  await grid().getByRole('button',{name:'Lucy',exact:true}).click();
  assert.equal((await observe()).wallpaper.state,'stopped');assert.equal((await observe()).commands,commands);
 });
 await record('Gallery pagination: single-page and empty searches remove footer and keyboard controls still work',async()=>{
  await search().fill('Lucy');await page.waitForFunction(()=>document.querySelectorAll('[data-whale-gallery-item]').length===1);
  assert.equal(await pager().count(),0);
  await search().fill('no-such-wallpaper-offline');await page.waitForFunction(()=>document.querySelectorAll('[data-whale-gallery-item]').length===0);
  assert.equal(await pager().count(),0);assert.equal(await root().getByText('没有匹配的壁纸',{exact:true}).isVisible(),true);
  await search().fill('');await pager().waitFor();
  await pager().getByRole('button',{name:'下一页'}).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-whale-gallery-pagination] output')?.textContent==='2 / 2');
  await pager().getByRole('button',{name:'上一页'}).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[data-whale-gallery-pagination] output')?.textContent==='1 / 2');
 });
 await record('Gallery pagination: short windows use reachable document flow and dark/light footer stays transparent',async()=>{
  await page.setViewportSize({width:1280,height:330});
  const short=await grid().evaluate(n=>({overflow:getComputedStyle(n).overflowY,height:n.clientHeight,scrollHeight:n.scrollHeight}));
  assert.equal(short.overflow,'visible');assert.ok(short.height>=short.scrollHeight-1);
  await pager().getByRole('button',{name:'下一页'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-whale-gallery-pagination] output')?.textContent==='2 / 2');
  await pager().getByRole('button',{name:'上一页'}).click();
  await page.setViewportSize({width:1280,height:800});
  for(const theme of ['abyss','mist']){
   await page.evaluate(theme=>qa.setAppearance('theme',theme),theme);
   await grid().evaluate(n=>{n.scrollTop=n.scrollHeight;});
   assert.equal(await pager().evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
   await root().screenshot({path:outputRoot+'pagination-'+theme+'.png',animations:'disabled'});
  }
  measurements.push({kind:'short-window',...short});
 });
 await page.evaluate(theme=>qa.setAppearance('theme',theme),initial.theme);
 await page.locator('[data-whale-change-wallpaper]:visible').click();
 await root().evaluate(n=>{n.style.width='';n.style.flex='';});
 await writeFile(outputRoot+'pagination-observations.json',JSON.stringify(measurements,null,2),{flag:'wx'});
}
