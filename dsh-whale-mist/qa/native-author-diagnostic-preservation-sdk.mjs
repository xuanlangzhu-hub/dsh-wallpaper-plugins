import assert from 'node:assert/strict';

// Use the fixed rc.52 client/Host as the base. Metadata failure is controlled IO;
// the diagnostic, retry UI and transport are production implementations.
export async function assertAuthorDiagnosticPreserved({page,record,observe,backend}){
 const id='we-000000000000000000000001';
 const header=()=>page.locator('[data-whale-change-wallpaper]:visible');
 await record('rc52 preservation: non-Lucy metadata failure keeps its stage code and requires one explicit retry',async()=>{
  if(await header().getAttribute('aria-expanded')!=='true')await header().click();
  await page.locator('[data-whale-gallery-item="'+id+'"]').click();
  await page.locator('[data-whale-playback-action=start]:visible').click();
  await page.waitForFunction(id=>qa.observation().wallpaper.state==='playing'&&qa.observation().wallpaper.host.activeSceneId===id,id);
  const before=backend.stats(),schemas=()=>backend.stats().authorHttp.filter(r=>r.path.endsWith('/schema')).length;
  const count=schemas();backend.failMetadata(true);
  try{
   await header().click();await page.getByRole('button',{name:'重试读取作者参数',exact:true}).waitFor();
   assert.match(await page.locator('[data-whale-author-switches]:visible').textContent(),/\[schema\.metadata\.409\]/);
   assert.equal(schemas(),count+1);await page.waitForTimeout(60);assert.equal(schemas(),count+1);
   assert.equal(backend.stats().authorCommands.length,before.authorCommands.length);
  }finally{backend.failMetadata(false);}
  await page.getByRole('button',{name:'重试读取作者参数',exact:true}).click();
  await page.locator('[data-whale-author-key=particles]:visible').waitFor();
  assert.equal(schemas(),count+2);assert.equal(backend.stats().authorCommands.length,before.authorCommands.length);
  assert.equal((await observe()).wallpaper.host.activeSceneId,id);
  await page.locator('[data-whale-playback-action=stop]:visible').click();
  await page.waitForFunction(()=>qa.observation().wallpaper.state==='stopped');
 });
}
