import assert from 'node:assert/strict';

// Real SDK DOM, client and Author Host/adapter; source/window/command IO is controlled.
export async function assertGallerySelectionFlow({page,record,observe,backend}){
 const B='we-000000000000000000000001';
 const header=()=>page.locator('[data-whale-change-wallpaper]:visible');
 const gallery=()=>page.locator('[data-whale-gallery]:visible');
 const card=id=>page.locator('[data-whale-gallery-item="'+id+'"]');
 const main=action=>page.locator('[data-whale-playback-action="'+action+'"]:visible');
 const open=async()=>{if(await gallery().count()===0)await header().click();await gallery().waitFor();};
 const playing=async id=>{await page.waitForFunction(id=>qa.observation().wallpaper.state==='playing'&&qa.observation().wallpaper.host.activeSceneId===id,id);};
 const stopped=async()=>{await main('stop').click();await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');};
 const until=async fn=>{const end=Date.now()+2000;while(!fn()){if(Date.now()>=end)throw Error('controlled request observation deadline');await new Promise(r=>setTimeout(r,10));}};
 await record('selection flow: gallery selection stays open; one explicit Play switches A to B without navigating',async()=>{
  await open();await card('lucy').click();await main('start').click();await playing('lucy');
  const before=backend.stats().requests.length;await card(B).click();assert.equal(await gallery().count(),1);assert.equal(backend.stats().requests.length,before);
  assert.equal((await observe()).wallpaper.host.activeSceneId,'lucy');assert.equal(await main('switch').textContent(),'播放');
  await main('switch').click();await playing(B);assert.equal(await gallery().count(),1);
  assert.equal(backend.stats().requests.length,before+1);assert.equal(backend.stats().requests.at(-1).path,'/whale-wallpaper/restart');
  assert.equal(await card(B).locator('[data-whale-gallery-playing]').count(),1);assert.equal(await card('lucy').locator('[data-whale-gallery-playing]').count(),0);
 });
 await record('selection flow: wallpaper parameters opens non-Lucy fields; one edit applies only that delta',async()=>{
  const beforeReads=backend.stats().authorReads.length,beforeCommands=backend.stats().authorCommands.length;
  assert.equal(await header().textContent(),'壁纸参数');await header().click();
  const particle=page.locator('[data-whale-author-key=particles]:visible');await particle.waitFor();
  assert.ok(backend.stats().authorReads.slice(beforeReads).length>0);assert.ok(backend.stats().authorReads.slice(beforeReads).every(id=>id===B));
  assert.equal(backend.stats().authorCommands.length,beforeCommands);await particle.uncheck();await until(()=>backend.stats().authorCommands.length===beforeCommands+1);
  await page.waitForFunction(()=>document.querySelector('[data-whale-author-key=particles]')?.getAttribute('aria-busy')!=='true');
  assert.deepEqual(backend.stats().authorCommands.at(-1),{particles:false});await stopped();
 });
 for(const status of [409,200])await record(`selection flow: HTTP ${status} unconfirmed restart retains A and explicit stop can recover`,async()=>{
  await open();await card('lucy').click();await main('start').click();await playing('lucy');await card(B).click();
  const before=backend.stats().requests.length;backend.failStop(true,status);
  try{await main('switch').click();await page.waitForFunction(()=>['error','cleanup-failed'].includes(qa.observation().wallpaper.state));
   assert.equal(backend.stats().requests.length,before+1);assert.equal(backend.stats().source,'lucy');assert.equal(await gallery().count(),1);
  }finally{backend.failStop(false);}
  await stopped();assert.equal(backend.stats().source,null);assert.equal((await observe()).settings.weScene,B);
 });
}
