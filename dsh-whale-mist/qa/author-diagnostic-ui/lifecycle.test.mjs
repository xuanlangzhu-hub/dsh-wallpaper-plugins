import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=process.env.AUTHOR_UI_RUNTIME,build=JSON.parse(await readFile(process.env.AUTHOR_UI_BUILD,'utf8'));
const {createAuthorDiagnosticRecorder,normalizeAuthorDiagnosticBuild,validateAuthorDiagnosticSnapshot}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostics.js'));
const {createAuthorDiagnosticSession}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-export.js'));
const {createAuthorDiagnosticLifecycle,createAuthorDiagnosticDownload}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-lifecycle.js'));
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function rig({host=null,save=null,timeoutMs=50}={}){
 let generation=1;const files=[],requests=[];const backend=createAuthorDiagnosticSession({enabled:true,build});
 const r=createAuthorDiagnosticLifecycle({expectedBuild:build,createRecorder:createAuthorDiagnosticRecorder,normalizeBuild:normalizeAuthorDiagnosticBuild,validateSnapshot:validateAuthorDiagnosticSnapshot,
  requestHost:async(id,options)=>{requests.push({id,options});return host?host(id,options):backend.exportData(id);},readConnection:()=>({generation}),save:save??((text,id)=>{files.push({text,id});return{ok:true,handedToBrowser:true};}),timeoutMs});
 r.view('view',true);return{r,files,requests,backend,generation:n=>generation=n,dispose(){r.dispose();backend.dispose();}};
}
test('default disabled is inert; malformed and wrong build activation cannot enable recording',async()=>{
 const f=rig();try{assert.equal(f.r.read().enabled,false);assert.equal((await f.r.exportFile('view')).ok,false);assert.equal(f.requests.length,0);
  for(const b of [null,{...build,extra:true},{...build,buildId:'0'.repeat(64)},{...build,sources:{...build.sources,host:'0'.repeat(64)}}])assert.equal(f.r.configure(b),false);
  assert.equal(f.r.recorder.begin('controller.read'),null);assert.equal(f.files.length,0);
 }finally{f.dispose();}
});
test('explicit valid activation and click export separate clock domains without author values',async()=>{
 const f=rig();try{assert.equal(f.r.configure(build),true);assert.equal(f.requests.length,0);
  const t=f.r.recorder.begin('controller.write',{epoch:1,revision:2,values:{private:'PRIVATE'}});f.r.recorder.finish(t,{ok:false,code:'burst-limit'});
  const h=f.backend.recorder.begin('host.apply',{generation:7});f.backend.recorder.finish(h,{ok:false,code:'author_apply_timeout',sentMayHaveOccurred:true});
  assert.equal((await f.r.exportFile('view')).handedToBrowser,true);assert.equal(f.requests.length,1);assert.equal(f.files.length,1);
  const data=JSON.parse(f.files[0].text);assert.equal(data.clockDomains.crossProcessTiming,'not-correlated');assert.equal(data.renderer.records[0].kind,'controller.write');assert.equal(data.host.records[0].kind,'host.apply');assert.equal(f.files[0].text.includes('PRIVATE'),false);assert.equal(f.r.read().mark,'download');
 }finally{f.dispose();}
});
for(const action of ['cancel','hide','remove','dispose','revoke'])test('late export is fenced after '+action,async()=>{
 const held=deferred(),f=rig({host:async()=>{await held.promise;return f.backend.exportData(build.buildId);}});f.r.configure(build);const pending=f.r.exportFile('view');
 try{if(action==='cancel')f.r.cancel();if(action==='hide')f.r.view('view',false);if(action==='remove')f.r.remove('view');if(action==='dispose')f.r.dispose();if(action==='revoke')f.r.configure(null);
  assert.equal((await pending).ok,false);held.resolve();await flush();assert.equal(f.files.length,0);assert.equal(f.r.read().busy,false);
 }finally{held.resolve();f.dispose();}
});
test('a changed connection generation blocks a completed response and duplicate clicks do not issue another request',async()=>{
 const held=deferred(),f=rig({host:async()=>{await held.promise;return f.backend.exportData(build.buildId);}});try{f.r.configure(build);const pending=f.r.exportFile('view');assert.equal((await f.r.exportFile('view')).ok,false);f.generation(2);held.resolve();assert.equal((await pending).ok,false);assert.equal(f.files.length,0);assert.equal(f.requests.length,1);}finally{held.resolve();f.dispose();}
});
test('uncooperative Host gets a bounded deadline and cannot write after it returns late',async()=>{
 const held=deferred(),f=rig({host:async()=>{await held.promise;return f.backend.exportData(build.buildId);}});try{f.r.configure(build);assert.equal((await f.r.exportFile('view')).error,'timeout');held.resolve();await flush();assert.equal(f.files.length,0);assert.equal(f.r.read().busy,false);}finally{held.resolve();f.dispose();}
});
test('old diagnostic tokens cannot add events to a reactivated recorder',async()=>{
 const f=rig();try{f.r.configure(build);const old=f.r.recorder.begin('controller.read',{epoch:1});f.r.configure(null);f.r.configure(build);f.r.recorder.finish(old,{ok:true});
  assert.equal((await f.r.exportFile('view')).ok,true);const s=JSON.parse(f.files[0].text).renderer;assert.equal(s.records.length,0);assert.equal(s.droppedEvents,0);
 }finally{f.dispose();}
});
for(const corrupt of [d=>d.host.sources.host='0'.repeat(64),d=>d.host.token='PRIVATE',d=>d.buildId='0'.repeat(64),d=>d.host.records=[{kind:'PRIVATE'}],d=>d.host.clockDomain='shared-clock'])test('invalid Host evidence is rejected before download '+corrupt.toString(),async()=>{
 const f=rig({host:async()=>{const response=f.backend.exportData(build.buildId);corrupt(response.diagnostic);return response;}});try{f.r.configure(build);assert.equal((await f.r.exportFile('view')).ok,false);assert.equal(f.files.length,0);assert.equal(f.r.read().mark,'error');}finally{f.dispose();}
});
test('download failure is retryable but never reports a completed save',async()=>{
 let fail=true;const f=rig({save:()=>{if(fail)throw Error('private filesystem path');return{ok:true,handedToBrowser:true};}});try{f.r.configure(build);assert.equal((await f.r.exportFile('view')).ok,false);assert.equal(f.r.read().mark,'error');fail=false;assert.equal((await f.r.exportFile('view')).handedToBrowser,true);}finally{f.dispose();}
});
function downloadRig({clickThrow=false,reentrant=false}={}){
 const urls=new Set(),timers=new Map(),anchors=[],revoked=[];let serial=0,download;
 const document={body:{appendChild(a){a.attached=true;}},createElement(type){assert.equal(type,'a');const a={click(){if(reentrant)download.dispose();if(clickThrow)throw Error('click');a.clicked=true;},remove(){a.removed=true;}};anchors.push(a);return a;}};
 download=createAuthorDiagnosticDownload({document,BlobType:Blob,urlApi:{createObjectURL(blob){assert.ok(blob.size<=300000);const url='blob:qa-'+ ++serial;urls.add(url);return url;},revokeObjectURL(url){urls.delete(url);revoked.push(url);}},timers:{setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}}});
 return{download,urls,timers,anchors,revoked};
}
test('explicit browser handoff uses a fixed name, bounded URLs and complete cleanup',()=>{
 const f=downloadRig();for(let i=0;i<4;i++)assert.equal(f.download.save('{}',build.buildId).handedToBrowser,true);
 assert.ok(f.urls.size<=2);assert.ok(f.timers.size<=2);assert.ok(f.anchors.every(a=>a.removed&&a.clicked&&a.download==='whale-author-diagnostic-'+build.buildId.slice(0,12)+'.json'));
 f.download.dispose();assert.equal(f.urls.size,0);assert.equal(f.timers.size,0);assert.throws(()=>f.download.save('{}',build.buildId));
});
test('click failures and reentrant disposal never leak an anchor, URL or timer',()=>{
 for(const options of [{clickThrow:true},{reentrant:true}]){const f=downloadRig(options);try{f.download.save('{}',build.buildId);}catch{}f.download.dispose();assert.equal(f.urls.size,0);assert.equal(f.timers.size,0);assert.ok(f.anchors.every(a=>a.removed));}
});
test('snapshot validation rejects arbitrary free text and accepts a truncated but explicitly incomplete recorder export',()=>{
 const r=createAuthorDiagnosticRecorder({sources:build.sources}),t=r.begin('controller.write');for(let i=0;i<40;i++)r.event(t,'round',{round:i});r.finish(t,{ok:false,code:'burst-limit'});
 const s=validateAuthorDiagnosticSnapshot(r.exportJson(),build.sources);assert.equal(s.records[0].incomplete,true);
 for(const alter of [v=>v.records[0].summary.code='PRIVATE',v=>v.records[0].incomplete=false,v=>v.historyComplete=true]){const bad=JSON.parse(JSON.stringify(s));alter(bad);assert.throws(()=>validateAuthorDiagnosticSnapshot(JSON.stringify(bad),build.sources));}
});
