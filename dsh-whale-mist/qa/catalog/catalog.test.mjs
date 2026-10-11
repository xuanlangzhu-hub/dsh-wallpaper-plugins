import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink} from 'node:fs/promises';
import {join,resolve,parse} from 'node:path';
import {scanWallpaperCatalog,publicCatalogItem} from '../../src/wallpaper/catalog.js';

const base=resolve('..','.tmp');await mkdir(base,{recursive:true});
const evidence=await mkdtemp(join(base,'catalog-check-'));const cases=[];
let serial=0;
async function checked(name,fn){await test(name,async()=>{try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.message});throw e;}});}
async function fixture(){const root=join(evidence,'library-'+(++serial));await mkdir(root);return root;}
async function project(root,name,data={type:'scene',title:'Example',file:'scene.pkg',preview:'preview.jpg'},files=['scene.pkg','preview.jpg']){
  const dir=join(root,name);await mkdir(dir,{recursive:true});await writeFile(join(dir,'project.json'),JSON.stringify(data));
  for(const file of files){await mkdir(join(dir,file,'..'),{recursive:true});await writeFile(join(dir,file),'fixture content');}
  return dir;
}
const scan=root=>scanWallpaperCatalog({roots:[root]});

await checked('Published scene.json metadata resolves shipped scene.pkg without mislabeling it missing',async()=>{
  const root=await fixture();await project(root,'3521337568',{type:'scene',title:'Lucy',file:'scene.json',preview:'preview.gif'},['scene.pkg','preview.gif']);
  const result=await scan(root);assert.equal(result.items.length,1);const item=result.items[0];
  assert.equal(item.type,'scene');assert.equal(item.available,true);assert.equal(item.playbackVerified,false);assert.equal(item.reason,null);
  assert.ok(item.entry.endsWith('scene.pkg'));assert.deepEqual(item.warnings,['scene_package_used']);
});
await checked('Ordinary unpacked scene and ./ paths are registered',async()=>{
  const root=await fixture();await project(root,'unpacked',{type:'scene',file:'./scene.json',preview:'./preview.jpg'},['scene.json','preview.jpg']);
  const item=(await scan(root)).items[0];assert.equal(item.available,true);assert.ok(item.entry.endsWith('scene.json'));
});
await checked('Video and web metadata are classified but not exposed as playable',async()=>{
  const root=await fixture();await project(root,'video',{type:'video',file:'movie.mp4'},['movie.mp4']);await project(root,'web',{type:'web',file:'index.html'},['index.html']);
  const items=(await scan(root)).items;assert.deepEqual(items.map(i=>i.type).sort(),['video','web']);
  for(const item of items){assert.equal(item.available,false);assert.equal(item.reason,'playback_type_not_supported');assert.equal(item.playbackVerified,false);}
});
await checked('Unknown type has its own unsupported reason',async()=>{
  const root=await fixture();await project(root,'unknown',{type:'application',file:'thing.bin'},['thing.bin']);assert.equal((await scan(root)).items[0].reason,'unknown_type');
});
await checked('One malformed JSON does not hide valid neighbours',async()=>{
  const root=await fixture();await project(root,'ok');await project(root,'bad');await writeFile(join(root,'bad','project.json'),'{broken');
  const items=(await scan(root)).items;assert.equal(items.length,2);assert.ok(items.some(i=>i.available));assert.ok(items.some(i=>i.reason==='invalid_json'));
});
await checked('Missing project, missing content and missing preview are distinguished',async()=>{
  const root=await fixture();await mkdir(join(root,'empty'));await project(root,'no-content',undefined,[]);await project(root,'no-preview',undefined,['scene.pkg']);
  const items=(await scan(root)).items;
  assert.equal(items.find(i=>i.title==='empty').reason,'missing_project');assert.ok(items.some(i=>i.reason==='missing_content'));
  const without=items.find(i=>i.available);assert.equal(without.preview,null);assert.ok(without.warnings.includes('missing_preview'));
});
await checked('Oversized metadata and non-object JSON are refused',async()=>{
  const root=await fixture();await project(root,'huge');await writeFile(join(root,'huge','project.json'),' '.repeat(2000));
  await project(root,'array');await writeFile(join(root,'array','project.json'),'[]');
  const items=(await scanWallpaperCatalog({roots:[root],limits:{maxJsonBytes:128}})).items;
  assert.ok(items.some(i=>i.reason==='project_too_large'));assert.ok(items.some(i=>i.reason==='invalid_project'));
});
await checked('Traversal, absolute paths and NTFS alternate-stream names cannot select content',async()=>{
  for(const file of ['../secret.json','C:\\secret.json','\\\\server\\share\\file','scene.pkg:secret']){
    const root=await fixture();await project(root,'unsafe',{type:'scene',file},['scene.pkg']);const item=(await scan(root)).items[0];
    assert.equal(item.available,false);assert.equal(item.reason,'unsafe_path');assert.equal(item.entry,null);
  }
});
await checked('Escaping preview is refused even when a usable scene package exists',async()=>{
  const root=await fixture();await project(root,'unsafe-preview',{type:'scene',file:'scene.pkg',preview:'../../secret.png'},['scene.pkg']);
  const item=(await scan(root)).items[0];assert.equal(item.preview,null);assert.equal(item.available,false);assert.equal(item.reason,'unsafe_preview');
});
await checked('Directory junctions are not scanned or followed for content/preview',async()=>{
  const root=await fixture();const outside=await fixture();await project(outside,'external');
  await symlink(join(outside,'external'),join(root,'linked-project'),'junction');
  const result=await scan(root);assert.equal(result.items.length,0);assert.ok(result.warnings.some(w=>w.reason==='link_refused'));
  const dir=await project(root,'content-link',{type:'scene',file:'assets/scene.pkg',preview:'preview.jpg'},['preview.jpg']);
  await symlink(join(outside,'external'),join(dir,'assets'),'junction');
  const item=(await scan(root)).items[0];assert.equal(item.entry,null);assert.equal(item.reason,'link_refused');
  await writeFile(join(dir,'project.json'),JSON.stringify({type:'scene',file:'scene.pkg',preview:'assets/preview.jpg'}));await writeFile(join(dir,'scene.pkg'),'fixture');
  const second=(await scan(root)).items[0];assert.equal(second.preview,null);assert.equal(second.reason,'unsafe_preview');
});
await checked('A linked approved root and a directory named project.json are refused',async()=>{
  const root=await fixture(),other=await fixture();const link=join(root,'alias');await symlink(other,link,'junction');
  const result=await scan(link);assert.equal(result.roots[0].available,false);assert.equal(result.roots[0].reason,'link_refused');
  const dir=join(other,'invalid');await mkdir(join(dir,'project.json'),{recursive:true});const item=(await scan(other)).items[0];assert.equal(item.reason,'not_regular_file');
});
await checked('IDs survive title edits, duplicate/overlapping roots and Windows case aliases',async()=>{
  const root=await fixture();const dir=await project(root,'one');const first=(await scan(root)).items[0].id;
  await writeFile(join(dir,'project.json'),JSON.stringify({type:'scene',title:'Renamed',file:'scene.pkg',preview:'preview.jpg'}));
  const roots=process.platform==='win32'?[root,root.toUpperCase(),dir]:[root,root,dir];
  const items=(await scanWallpaperCatalog({roots})).items;assert.equal(items.length,1);assert.equal(items[0].id,first);assert.equal(items[0].title,'Renamed');
});
await checked('Record, directory, entry and depth budgets bound enumeration and report truncation',async()=>{
  const root=await fixture();for(const name of ['a','b','c'])await project(root,name);
  const one=await scanWallpaperCatalog({roots:[root],limits:{maxRecords:1}});assert.equal(one.items.length,1);assert.equal(one.truncated,true);
  const dirs=await scanWallpaperCatalog({roots:[root],limits:{maxDirectories:1}});assert.equal(dirs.stats.directoriesVisited,1);assert.equal(dirs.truncated,true);
  const entries=await scanWallpaperCatalog({roots:[root],limits:{maxEntries:1}});assert.ok(entries.stats.entriesVisited<=1);assert.equal(entries.truncated,true);assert.equal(entries.items.length,1);
  assert.equal((await scanWallpaperCatalog({roots:[root],limits:{maxDepth:0}})).items.length,0);
  const root2=await fixture();await project(root2,'group/nested');const shallow=await scan(root2);assert.ok(!shallow.items.some(i=>i.available));
  assert.ok((await scanWallpaperCatalog({roots:[root2],limits:{maxDepth:2}})).items.some(i=>i.available));
});
await checked('Public records omit paths/properties; bounded author text remains plain data',async()=>{
  const root=await fixture();await project(root,'title',{type:'scene',title:'<b>Wallpaper</b>\nname',file:'scene.pkg',preview:'preview.jpg',general:{properties:{html:'<script>bad()</script>'}}});
  const item=(await scan(root)).items[0];const pub=publicCatalogItem(item);assert.equal(pub.title,'<b>Wallpaper</b> name');assert.equal(pub.playbackVerified,false);
  assert.deepEqual(Object.keys(pub).sort(),['available','id','playbackVerified','previewRef','reason','title','type','warnings'].sort());
  assert.ok(!JSON.stringify(pub).includes(root));assert.equal(pub.previewRef.wallpaperId,item.id);assert.ok(!JSON.stringify(pub).includes('bad()'));
});
await checked('Empty content is not eligible; empty thumbnail does not block a valid scene',async()=>{
  const root=await fixture();await project(root,'empty-content');await writeFile(join(root,'empty-content','scene.pkg'),'');
  await project(root,'empty-thumb');await writeFile(join(root,'empty-thumb','preview.jpg'),'');
  const items=(await scan(root)).items;assert.ok(items.some(i=>i.reason==='empty_content'&&!i.available));
  const thumb=items.find(i=>i.available);assert.equal(thumb.preview,null);assert.ok(thumb.warnings.includes('empty_preview'));
});
await checked('Missing approved root is a warning; malformed roots and limit names fail closed',async()=>{
  const root=await fixture();await project(root,'ok');const result=await scanWallpaperCatalog({roots:[root,join(root,'absent')]});assert.equal(result.items.length,1);assert.equal(result.roots[1].available,false);
  for(const roots of [[],['relative'],[parse(resolve(root)).root]])await assert.rejects(scanWallpaperCatalog({roots}));
  for(const limits of [{maxDepth:4},{maxRecords:0},{toString:1},{maxJsonBytes:Infinity}])await assert.rejects(scanWallpaperCatalog({roots:[root],limits}));
});
after(async()=>{await writeFile(join(evidence,'checks.json'),JSON.stringify({cases,evidence,cleanup:'Fixtures intentionally retained; no deletion'},null,2));console.log('Catalogue fixture evidence:',evidence);});
