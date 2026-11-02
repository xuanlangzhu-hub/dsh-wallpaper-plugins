import assert from 'node:assert/strict';
export async function assertPixsoControls({page,record,observe,outputRoot,authorStats}) {
 const root=()=>page.locator('[data-whale-native-sidebar]:visible');
 const section=key=>page.locator('[data-whale-settings-section='+key+']:visible');
 await page.locator('#whale-appearance-header-btn').click();await root().waitFor();
 const initial={...(await observe()).settings};
 await record('Material: host-relative typography and clear default',async()=>{
  const info=await root().evaluate(n=>({font:getComputedStyle(n).fontSize,parentFont:getComputedStyle(n.parentElement).fontSize,material:n.dataset.whalePanelMaterial,blur:getComputedStyle(n).backdropFilter,fill:getComputedStyle(n).backgroundColor,ancestors:[...function*(x){for(let i=0;x&&i<7;i++,x=x.parentElement)yield {tag:x.tagName,cls:x.className,fill:getComputedStyle(x).backgroundColor,blur:getComputedStyle(x).backdropFilter};}(n.parentElement)]}));
  assert.equal(info.font,info.parentFont);assert.ok(parseFloat(info.font)>=14);assert.equal(info.material,'clear');assert.equal(info.blur,'none');assert.equal(info.fill,'rgba(0, 0, 0, 0)');
  await import('node:fs/promises').then(fs=>fs.writeFile(outputRoot+'material-parent-observation-after-choice-fix.json',JSON.stringify(info,null,2),{flag:'wx'}));
 });
 await record('Material: explicit frosting toggles only panel material and persists',async()=>{
  const before={...(await observe()).settings};
  const select=()=>root().locator('[data-whale-interface-option=panelMaterial]');
  await select().locator('[data-whale-choice-segment=frosted]').click();
  await page.waitForFunction(()=>document.querySelector('[data-whale-native-sidebar]')?.dataset.whalePanelMaterial==='frosted');
  assert.deepEqual((await observe()).settings,{...before,panelMaterial:'frosted'});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dsh-whale-mist.appearance.v1')).panelMaterial),'frosted');
  assert.equal(await root().evaluate(n=>getComputedStyle(n).backdropFilter),'blur(18px)');
  await select().locator('[data-whale-choice-segment=clear]').click();
  await page.waitForFunction(()=>document.querySelector('[data-whale-native-sidebar]')?.dataset.whalePanelMaterial==='clear');
  assert.deepEqual((await observe()).settings,before);
 });
 for(const theme of ['abyss','mist'])await record('Pixso actual SDK: '+theme+' rows fit 280/320/400/520 and preserve labels',async()=>{
  await page.evaluate(theme=>qa.setAppearance('theme',theme),theme);
  await page.waitForFunction(theme=>qa.observation().settings.theme===theme,theme);
  for(const tab of ['wallpaper','interface']){
   await section(tab).click();
   for(const width of [280,320,400,520,570]){
    await root().evaluate((n,w)=>{n.style.width=w+'px';n.style.flex='none';},width);
    const measurement=await root().evaluate(n=>{
     const panel=[...n.querySelectorAll('[data-whale-page-panel]')].find(p=>!p.hidden),overlaps=[];
     for(const row of panel.querySelectorAll('[data-whale-appearance-field]')){
      const label=row.querySelector('label'),range=row.querySelector('input[type=range]'),value=row.querySelector('output');
      if(!label||!range||!value)continue;
      const a=label.getBoundingClientRect(),b=range.getBoundingClientRect(),c=value.getBoundingClientRect();
      if(a.right>b.left+.5||b.right>c.left+.5)overlaps.push(row.dataset.whaleAppearanceField);
      if(label.htmlFor!==range.id)overlaps.push('label-'+row.dataset.whaleAppearanceField);
     }
     return {width:n.getBoundingClientRect().width,scroll:panel.scrollWidth,client:panel.clientWidth,overlaps,font:getComputedStyle(n).fontSize};
    });
    assert.equal(measurement.width,width);assert.ok(parseFloat(measurement.font)>=14,JSON.stringify(measurement));assert.ok(measurement.scroll<=measurement.client+1,JSON.stringify(measurement));assert.deepEqual(measurement.overlaps,[]);
   }
  }
 });
 await section('wallpaper').click();await page.locator('[data-whale-playback-action=start]').click();await page.waitForFunction(()=>qa.observation().wallpaper.rendered>0&&document.body.dataset.wmBackdrop==='wallpaper');
 await record('Pixso actual SDK: appearance alpha is live; header remains a single transparent layer',async()=>{
  await section('wallpaper').click();
  const generationBefore=(await observe()).wallpaper.generation;
  await root().locator('[data-whale-interface-option=panelMaterial] [data-whale-choice-segment=frosted]').click();
  await import('node:fs/promises').then(async fs=>fs.writeFile(outputRoot+'material-playing-ancestors.json',JSON.stringify(await root().evaluate(n=>[...function*(x){for(let i=0;x&&i<7;i++,x=x.parentElement)yield {tag:x.tagName,attrs:Object.fromEntries([...x.attributes].map(a=>[a.name,a.value])),fill:getComputedStyle(x).backgroundColor,blur:getComputedStyle(x).backdropFilter};}(n.parentElement)]),null,2),{flag:'wx'}));
  const alpha=()=>root().evaluate(n=>({fill:getComputedStyle(n).backgroundColor,opacity:getComputedStyle(n).opacity,header:getComputedStyle(n.querySelector('[data-whale-playback-header]')).backgroundColor}));
  await page.evaluate(()=>qa.setAppearance('surface',50));await page.waitForFunction(()=>getComputedStyle(document.body).getPropertyValue('--wm-ui-alpha').trim()==='0.5');const half=await alpha();
  await page.evaluate(()=>qa.setAppearance('surface',100));await page.waitForFunction(()=>getComputedStyle(document.body).getPropertyValue('--wm-ui-alpha').trim()==='1');const full=await alpha();
  assert.equal((await observe()).wallpaper.generation,generationBefore);
  assert.notEqual(half.fill,full.fill);assert.equal(half.opacity,'1');assert.equal(full.opacity,'1');assert.equal(half.header,'rgba(0, 0, 0, 0)');assert.equal(full.header,'rgba(0, 0, 0, 0)');
  await page.evaluate(n=>qa.setAppearance('surface',n),initial.surface);
  await root().locator('[data-whale-interface-option=panelMaterial] [data-whale-choice-segment=clear]').click();
 });
 await record('Pixso actual SDK: slider keyboard submission uses the original author pipeline exactly once',async()=>{
  await page.waitForFunction(()=>qa.observation().wallpaper.state==='playing');
  const slider=page.locator('input[type=range][data-whale-author-key=speed]');await slider.waitFor();
  const number=page.locator('[data-whale-author-number=speed]');assert.equal(await number.inputValue(),'2');
  const before=authorStats().commands.length;await slider.focus();await slider.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('[data-whale-author-feedback=speed]')?.dataset.state==='sent');
  assert.equal(authorStats().commands.length,before+1);assert.deepEqual(authorStats().commands.at(-1),{speed:3});
  assert.equal(await number.inputValue(),'3');
  await slider.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('[data-whale-author-number=speed]')?.value==='2'&&document.querySelector('[data-whale-author-feedback=speed]')?.dataset.state==='sent');
  assert.equal(authorStats().commands.length,before+2);assert.deepEqual(authorStats().commands.at(-1),{speed:2});
 });
 await record('Pixso actual SDK: author range/number row and feedback remain reachable at narrow widths',async()=>{
  for(const width of [280,320,400,520,570]){
   await root().evaluate((n,w)=>{n.style.width=w+'px';},width);
   const row=await page.locator('[data-whale-author-slider=speed]').evaluate(n=>{
    const a=n.querySelector('label').getBoundingClientRect(),b=n.querySelector('input[type=range]').getBoundingClientRect(),c=n.querySelector('[data-whale-author-number]').getBoundingClientRect();
    return {labelRight:a.right,rangeLeft:b.left,rangeRight:b.right,numberLeft:c.left,rowRight:n.getBoundingClientRect().right,numberRight:c.right};
   });
   assert.ok(row.labelRight<=row.rangeLeft+.5&&row.rangeRight<=row.numberLeft+.5&&row.numberRight<=row.rowRight+.5,JSON.stringify(row));
  }
  await root().evaluate(n=>{n.style.width='400px';});await root().screenshot({path:outputRoot+'/pixso-sdk-author.png',animations:'disabled'});
 });
 await page.locator('[data-whale-playback-action=stop]').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 for(const key of ['theme','surface'])await page.evaluate(([key,value])=>qa.setAppearance(key,value),[key,initial[key]]);
 await root().evaluate(n=>{n.style.width='';n.style.flex='';});await section('wallpaper').click();
}
