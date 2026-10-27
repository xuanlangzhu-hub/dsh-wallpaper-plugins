// Actual catalogue/library/Host, synthetic files only. Session/native/browser IO never executes.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {scanWallpaperCatalog,verifyCatalogEntry} from '../../src/wallpaper/catalog.js';
import {createWallpaperLibrary,VERIFIED_SCENES} from '../../src/wallpaper/library.js';
import {registerWallpaperRoutes} from '../../src/wallpaper/session.js';
import {validateProjectFile} from '../../src/wallpaper/managed-window.js';
import {executeAuthoritativeAction,DETACHABLE_ACTIONS} from '../../src/detachable-contract.js';
const top=await fs.mkdtemp(join(tmpdir(),'wm-types-'));let n=0;
after(async()=>{await fs.rm(top,{recursive:true,force:true});});
async function fixture(type='Scene',file='scene.pkg'){
 const root=join(top,String(++n)),dir=join(root,'project');await fs.mkdir(dir,{recursive:true});
 const data={type,file,title:'Synthetic type fixture',contentrating:'Everyone'};await fs.writeFile(join(dir,'project.json'),JSON.stringify(data));await fs.writeFile(join(dir,file),'inert synthetic text, not executable');
 const library=createWallpaperLibrary({roots:[root],exists:()=>true});await library.refresh();return{root,dir,data,library,item:library.publicItems()[0],project:join(dir,'project.json')};
}
async function call(route,url,body){const req={method:'POST',url,async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body??{}));}},res={setHeader(){},writeHead(s){this.status=s},end(v){this.data=v?JSON.parse(v):null}};await route.handler(req,res);return res;}
function host(f){const routes=new Map();let starts=0,selected=null,closed=false;const api=registerWallpaperRoutes({effect(cb){return cb();},webServer:{register(r){routes.set(r.path,r);return()=>{};}}},{helper:'F:\\fake\\WallpaperProbe.exe',exists:()=>true,logRoot:join(f.root,'logs'),library:f.library,onWarn:()=>{},mediaBridge:{prepare(){throw Error('Unexpected media bridge');}},sessionFactory:()=>{starts++;return{hub:{latest:null,closed:false},async create(o){selected=o.scene;},async stop(){closed=true;return{closed:true,outcome:'closed'};},isClosed:()=>closed,ending:()=>false,report:()=>({}),state:()=>({}),setClientStatus(){}};}});return{api,route:routes.get('/whale-wallpaper'),starts:()=>starts,selected:()=>selected};}

test('types: known case variants publish canonical types with unchanged rating and manual status',async()=>{
 for(const[type,file,want]of [['Scene','scene.pkg','scene'],['SCENE','scene.pkg','scene'],['sCeNe','scene.pkg','scene'],['Video','movie.MP4','video'],['WEB','index.HTML','web']]){const f=await fixture(type,file);assert.equal(f.item.type,want,type);assert.equal(f.item.available,true);assert.equal(f.item.contentRating,'Everyone');assert.equal(f.item.playbackVerified,false);assert.equal(JSON.stringify(f.item).includes(f.root),false);}
 assert.deepEqual(Object.keys(VERIFIED_SCENES),['lucy']);
});
test('types: case-only metadata change survives real start revalidation in both directions',async()=>{
 for(const[a,b]of [['scene','Scene'],['Scene','scene'],['Video','video'],['Web','wEb']]){const f=await fixture(a,a.toLowerCase()==='scene'?'scene.pkg':a.toLowerCase()==='video'?'movie.mp4':'index.html');await fs.writeFile(f.project,JSON.stringify({...f.data,type:b}));const resolved=await f.library.resolveForPlayback(f.item.id);assert.equal(resolved.type,a.toLowerCase());assert.equal(resolved.sceneId,f.item.id);}
});
test('types: uppercase scene retains legitimate missing scene.json to scene.pkg fallback',async()=>{
 const f=await fixture('Scene');await fs.writeFile(f.project,JSON.stringify({...f.data,file:'scene.json'}));await f.library.refresh();assert.equal(f.library.publicItems()[0].available,true);assert.ok(f.library.publicItems()[0].warnings.includes('scene_package_used'));assert.equal((await f.library.resolveForPlayback(f.item.id)).project,f.project);
});
test('types: semantic type change is rejected before a new session is constructed',async()=>{
 const f=await fixture('Scene'),h=host(f);try{await fs.writeFile(f.project,JSON.stringify({...f.data,type:'Video'}));const r=await call(h.route,'/whale-wallpaper/start',{scene:f.item.id,mode:'daily'});assert.equal(r.status,409);assert.match(r.data.error,/type_changed/);assert.equal(h.starts(),0);}finally{await h.api.stopNow();}
});
test('types: whitespace, near matches, nonstrings and application remain unknown',async()=>{
 for(const type of [' scene','scene ','scenes','ＳＣＥＮＥ','application','Application',null,2,[],{},true]){const f=await fixture(type);assert.equal(f.item.type,'unknown',JSON.stringify(type));assert.equal(f.item.available,false);await assert.rejects(f.library.resolveForPlayback(f.item.id),/unknown_type/);}
});
test('types: uppercase scene cannot hide changed traversal or swapped links',async()=>{
 const f=await fixture('Scene');await fs.writeFile(f.project,JSON.stringify({...f.data,file:'../outside.pkg'}));await assert.rejects(f.library.resolveForPlayback(f.item.id),/unsafe_path/);
 const g=await fixture('Scene'),raw=(await scanWallpaperCatalog({roots:[g.root]})).items[0],outside=join(g.root,'outside');await fs.mkdir(outside);await fs.writeFile(join(outside,'scene.pkg'),'inert');await fs.rename(g.dir,join(g.root,'before'));await fs.symlink(outside,g.dir,'junction');await fs.writeFile(join(outside,'project.json'),JSON.stringify(g.data));await assert.rejects(verifyCatalogEntry(raw,{roots:[g.root]}));
});
test('types: actual Host route resolves Scene by ID and ignores supplied file/type',async()=>{
 const f=await fixture('Scene'),h=host(f);try{const r=await call(h.route,'/whale-wallpaper/start',{scene:f.item.id,mode:'daily',type:'application',project:'F:\\outside\\bad.json'});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(h.starts(),1);assert.equal(h.selected().project,f.project);assert.equal(h.selected().sceneId,f.item.id);assert.equal((await call(h.route,'/whale-wallpaper/stop',{})).data.cleanup.closed,true);}finally{await h.api.stopNow();}
});
test('application: actual Host rejects inert EXE and JSON projects with zero session/native calls',async()=>{
 for(const[type,file]of [['application','payload.exe'],['Application','payload.json'],['APPLICATION','index.html']]){const f=await fixture(type,file),h=host(f);try{const r=await call(h.route,'/whale-wallpaper/start',{scene:f.item.id,mode:'daily',type:'scene',project:f.project});assert.equal(r.status,409);assert.match(r.data.error,/unknown_type/);assert.equal(h.starts(),0);}finally{await h.api.stopNow();}}
 assert.throws(()=>validateProjectFile('F:\\fixture\\payload.exe'));assert.equal(validateProjectFile('F:\\fixture\\project.json'),'F:\\fixture\\project.json');
});
test('application: real action rejects forged available application after a successful scene control',async()=>{
 const f=await fixture('scene');let item=f.item,calls=0;const controller={read:()=>({weScene:f.item.id,weMode:'daily'}),wallpaper:{getLibrarySnapshot:()=>({loaded:true,state:'ready',items:[item]}),getStatus:()=>({state:'idle',activeSceneId:null}),start:async()=>{calls++;return{ok:true};}}},action={type:DETACHABLE_ACTIONS.START_WALLPAPER,sceneId:f.item.id,mode:'daily',clientActionId:'application-rejection',expectedRevision:1};assert.equal((await executeAuthoritativeAction({controller,action})).ok,true);for(const type of ['application','Application']){item={...f.item,type,available:true};assert.equal((await executeAuthoritativeAction({controller,action})).ok,false);}assert.equal(calls,1);
});
