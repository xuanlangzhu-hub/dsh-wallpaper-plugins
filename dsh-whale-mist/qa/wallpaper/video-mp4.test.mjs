// Synthetic offline projects only; never starts WE, a helper or a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scanWallpaperCatalog,verifyCatalogEntry,publicCatalogItem} from '../../src/wallpaper/catalog.js';
import {createWallpaperLibrary,VERIFIED_SCENES} from '../../src/wallpaper/library.js';
import {validateProjectFile} from '../../src/wallpaper/managed-window.js';
import {executeAuthoritativeAction,DETACHABLE_ACTIONS} from '../../src/detachable-contract.js';
const root=await mkdtemp(join(tmpdir(),'wm-mp4-'));
let serial=0;
async function fixture(file='movie.mp4',type='video'){
 const dir=join(root,String(++serial));await mkdir(dir);
 const data={title:'Synthetic MP4',type,file,contentrating:'Everyone'};
 await writeFile(join(dir,'project.json'),JSON.stringify(data));
 if(file && !file.includes('..')){await mkdir(join(dir,file,'..'),{recursive:true});await writeFile(join(dir,file),'synthetic content, not a playable codec');}
 const items=(await scanWallpaperCatalog({roots:[root]})).items;
 return {dir,data,item:items.find(x=>x.project===join(dir,'project.json'))};
}
try {
 await test('MP4: eligible manual record, public metadata has no path and no verification claim',async()=>{
  const {dir,item}=await fixture('nested/CLIP.MP4');
  assert.equal(item.available,true);assert.equal(item.playbackVerified,false);
  const verified=await verifyCatalogEntry(item,{roots:[root]});assert.equal(verified.type,'video');assert.equal(verified.entry,join(dir,'nested/CLIP.MP4'));
  assert.equal(JSON.stringify(publicCatalogItem(item)).includes(root),false);
  const library=createWallpaperLibrary({roots:[root],exists:()=>true});await library.refresh();
  assert.equal(await library.resolveProject(item.id),verified.entry,'WE receives MP4 entry, not project.json');
  assert.deepEqual(await library.resolveSelection(item.id),{sceneId:item.id,project:verified.entry});
  assert.deepEqual(Object.keys(VERIFIED_SCENES),['lucy']);
 });
 await test('MP4: unsupported containers and nonvideo types stay unavailable',async()=>{
  for(const [file,type] of [['movie.webm','video'],['movie.exe','video'],['movie.mp4','web'],['movie.mp4','application']]){
   const {item}=await fixture(file,type);assert.equal(item.available,false);
   await assert.rejects(verifyCatalogEntry(item,{roots:[root]}));
  }
 });
 await test('MP4: disappeared, empty, renamed or changed metadata never falls back to scene.pkg',async()=>{
  for(const mutation of ['missing','empty','changed','type','unsafe']){
   const {dir,item,data}=await fixture();
   await writeFile(join(dir,'scene.pkg'),'must not be used');
   if(mutation==='missing')await rm(join(dir,'movie.mp4'));
   if(mutation==='empty')await writeFile(join(dir,'movie.mp4'),'');
   if(mutation==='changed'){data.file='other.mp4';await writeFile(join(dir,'other.mp4'),'different');}
   if(mutation==='type')data.type='scene';
   if(mutation==='unsafe')data.file='../escape.mp4';
   await writeFile(join(dir,'project.json'),JSON.stringify(data));
   await assert.rejects(verifyCatalogEntry(item,{roots:[root]}),mutation);
  }
 });
 await test('MP4: links outside project and unapproved roots are refused',async()=>{
  const {dir,item}=await fixture();await assert.rejects(verifyCatalogEntry(item,{roots:[join(root,'other')]}));
  const outside=join(root,'outside');await mkdir(outside);await writeFile(join(outside,'movie.mp4'),'outside');
  await symlink(outside,join(dir,'linked'),'junction');
  await writeFile(join(dir,'project.json'),JSON.stringify({type:'video',file:'linked/movie.mp4'}));
  await assert.rejects(verifyCatalogEntry(item,{roots:[root]}));
 });
 await test('MP4: native command input admits absolute JSON or MP4 only',()=>{
  for(const p of ['F:\\fixtures\\project.json','F:\\fixtures\\视频.MP4','\\\\server\\share\\clip.mp4'])assert.equal(validateProjectFile(p),p);
  for(const p of ['clip.mp4','F:\\x.webm','F:\\x.mp4.exe','F:\\x\n.mp4','F:\\x;evil.mp4','F:\\x.mp4:extra.mp4'])assert.throws(()=>validateProjectFile(p),p);
 });

 await test('MP4: authoritative executor admits video but retains all start safety gates',async()=>{
  const id='we-'+'a'.repeat(24);let calls=0;
  const settings={weScene:id,weMode:'daily'};let item={id,type:'video',available:true};let state={state:'idle',cleanupPending:false,activeSceneId:null};
  const controller={read:()=>settings,wallpaper:{getStatus:()=>state,getLibrarySnapshot:()=>({state:'ready',loaded:true,items:[item]}),start:async()=>{calls++;return{ok:true};}}};
  const action={type:DETACHABLE_ACTIONS.START_WALLPAPER,sceneId:id,mode:'daily',clientActionId:'mp4-action',expectedRevision:1};
  assert.equal((await executeAuthoritativeAction({controller,action})).ok,true);assert.equal(calls,1);
  for(const patch of [{type:'application',available:true},{type:'video',available:false}]){item={id,...patch};assert.equal((await executeAuthoritativeAction({controller,action})).ok,false);}
  item={id,type:'video',available:true};
  for(const patch of [{state:'cleanup-failed',cleanupPending:true},{state:'running',activeSceneId:id},{state:'idle',cleanupPending:true}]){state=patch;assert.equal((await executeAuthoritativeAction({controller,action})).ok,false);}
  assert.equal(calls,1);
 });
 await test('MP4: companion actual type expression accepts video/web and refuses application',async()=>{
  const src=await readFile(new URL('../../src/companion/companion.js',import.meta.url),'utf8');
  const match=src.match(/const isStartableType = ([^;]+);/);assert.ok(match);
  const allowed=new Function('item','return ('+match[1]+')');
  for(const type of ['scene','video','web'])assert.equal(allowed({type}),true);
  for(const type of ['application','unknown'])assert.equal(allowed({type}),false);
 });
} finally {await rm(root,{recursive:true,force:true});}
