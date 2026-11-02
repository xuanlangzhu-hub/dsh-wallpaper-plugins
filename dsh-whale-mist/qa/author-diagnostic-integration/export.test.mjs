import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=process.env.AUTHOR_EXPORT_RUNTIME,build=JSON.parse(await readFile(process.env.AUTHOR_EXPORT_BUILD,'utf8'));
const {createDetachableHttpHost,STATIC_MANIFEST}=await import(pathToFileURL(root+'/src/detachable-host.js'));
const {createAuthorDiagnosticSession}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-export.js'));
const raw=await readFile(root+'/src/client.js','utf8'),from=raw.indexOf('    function createMainRendererBridgeClient('),to=raw.indexOf('    function WhaleHeaderAppearanceTrigger(',from);
assert.ok(from>=0&&to>from);const factory=raw.slice(from,to);
const secret='PRIVATE-AUTHOR-CONTENT';
async function fixture(t,{enabled=true}={}){
 const session=createAuthorDiagnosticSession({enabled,build});
 const reads={metadata:0,lifecycle:0};
 const host=createDetachableHttpHost({mainToken:'offline-export-main',authorDiagnosticSession:session,library:{getAuthorMetadata:async()=>{reads.metadata++;throw Error('metadata must not run during export');}},readWallpaperLifecycle:()=>{reads.lifecycle++;throw Error('lifecycle must not run during export');}});await host.start();const base=host.getBaseUrl();
 const snapshot={revision:3,settings:{weScene:'lucy',weAgeRatings:'Everyone'},wallpaper:{state:'idle'},privateText:secret};
 const call=async(path,body,headers={},extra={})=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),headers:{'content-type':'application/json',...headers},signal:AbortSignal.timeout(1800),...extra});
  return{status:response.status,data:await response.json(),headers:response.headers};
 };
 const connected=await call('/api/main/connect',{mainToken:'offline-export-main',instanceId:'main-export',snapshot});assert.equal(connected.data.ok,true);const generation=connected.data.generation;
 const headers={'x-whale-main-token':'offline-export-main','x-whale-instance-id':'main-export','x-whale-generation':String(generation)};
 const body={instanceId:'main-export',generation,authorDiagnostics:{action:'export',buildId:build.buildId}};
 t.after(async()=>{let timer;try{await Promise.race([host.stop(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('host-close-deadline')),1200))]);}finally{clearTimeout(timer);}});
 return{session,host,base,snapshot,headers,body,call,reads,export:(bodyOverride=body,headerOverride=headers,path='/api/main/snapshot')=>call(path,bodyOverride,headerOverride)};
}
test('disabled session allocates no recorder and cannot be enabled by a request',async t=>{
 const f=await fixture(t,{enabled:false});assert.equal(f.session.recorder,null);const r=await f.export();assert.equal(r.data.error,'author-diagnostics-disabled');assert.equal(r.status,503);
 assert.equal((await f.export({...f.body,authorDiagnostics:{...f.body.authorDiagnostics,enabled:true}})).status,400);assert.equal(f.session.recorder,null);
});
test('explicit export is bound to sources, read-only, cache-disabled and contains no snapshot fields',async t=>{
 const f=await fixture(t),token=f.session.recorder.begin('host.schema',{generation:7,values:secret});f.session.recorder.finish(token,{ok:true});
 const before=JSON.stringify(f.host.getMainSession().snapshot),a=await f.export(),b=await f.export();assert.equal(a.status,200);assert.equal(a.headers.get('cache-control'),'no-store');assert.equal(a.headers.get('x-content-type-options'),'nosniff');
 assert.equal(a.data.diagnostic.buildId,build.buildId);assert.deepEqual(a.data.diagnostic.host.sources,build.sources);assert.deepEqual(a.data,b.data);
 assert.equal(JSON.stringify(a.data).includes(secret),false);assert.equal(JSON.stringify(f.host.getMainSession().snapshot),before);assert.equal(f.session.recorder.snapshot().records.length,1);
 assert.deepEqual(f.reads,{metadata:0,lifecycle:0});
});
for(const [name,mutate]of [
 ['missing token',h=>{delete h['x-whale-main-token'];}],['wrong instance',h=>h['x-whale-instance-id']='other'],['partial generation',h=>h['x-whale-generation']+='junk'],['leading zero',h=>h['x-whale-generation']='0'+h['x-whale-generation']],['companion lease only',h=>{delete h['x-whale-main-token'];h['x-whale-lease']='fake';}],
 ])test('export credential rejection: '+name,async t=>{const f=await fixture(t),h={...f.headers};mutate(h);const r=await f.export(f.body,h);assert.ok(r.status>=400);assert.equal('diagnostic' in r.data,false);});
test('query credentials, foreign and companion origins are denied without exporting',async t=>{
 const f=await fixture(t);for(const origin of ['null','https://evil.example',f.base]){const r=await f.export(f.body,{...f.headers,origin});assert.equal(r.status,403);assert.equal('diagnostic' in r.data,false);}
 const r=await f.export(f.body,f.headers,'/api/main/snapshot?mainToken=offline-export-main');assert.equal(r.status,403);
});
test('stale registration cannot read the next main owners evidence',async t=>{
 const f=await fixture(t);await f.call('/api/main/connect',{mainToken:'offline-export-main',instanceId:'main-export',snapshot:f.snapshot});assert.ok((await f.export()).status>=400);
});
test('malformed export and snapshot piggyback never fall through to snapshot mutation',async t=>{
 const f=await fixture(t),before=JSON.stringify(f.host.getMainSession().snapshot);
 for(const body of [{...f.body,snapshot:{revision:999}}, {...f.body,authorDiagnostics:null},{...f.body,authorDiagnostics:{...f.body.authorDiagnostics,action:'enable'}},{...f.body,authorDiagnostics:{...f.body.authorDiagnostics,file:'F:/arbitrary'}},{...f.body,extra:true}])assert.equal((await f.export(body)).status,400);
 assert.equal(JSON.stringify(f.host.getMainSession().snapshot),before);
 assert.equal((await f.export({...f.body,authorDiagnostics:{action:'export',buildId:'a'.repeat(64)}})).data.error,'author-diagnostic-build-mismatch');
});
test('ordinary snapshot updates keep their original behavior and never export diagnostics',async t=>{
 const f=await fixture(t),r=await f.call('/api/main/snapshot',{instanceId:f.body.instanceId,generation:f.body.generation,snapshot:{revision:4,settings:{},privateText:secret}},f.headers);
 assert.equal(r.data.ok,true);assert.equal('diagnostic' in r.data,false);assert.equal(f.host.getMainSession().snapshot.revision,4);
});
test('no new public route or static private module is exposed',async t=>{
 const f=await fixture(t);for(const path of ['/api/author-properties/diagnostics','/api/main/diagnostics','/wallpaper/author-diagnostic-export.js','/wallpaper/author-diagnostics.js'])assert.ok((await fetch(f.base+path,{signal:AbortSignal.timeout(1000)})).status>=400);
 assert.equal(Object.keys(STATIC_MANIFEST).some(k=>k.includes('diagnostic')),false);
});
test('build contract rejects incomplete or malformed source evidence and copies valid metadata',()=>{
 for(const b of [null,{...build,sources:{}},{...build,buildId:'bad'},{...build,extra:secret},{...build,sources:{...build.sources,token:secret}}])assert.throws(()=>createAuthorDiagnosticSession({enabled:true,build:b}));
 const copy=JSON.parse(JSON.stringify(build)),s=createAuthorDiagnosticSession({enabled:true,build:copy});copy.sources.host='0'.repeat(64);
 assert.deepEqual(s.exportData(build.buildId).diagnostic.host.sources,build.sources);s.dispose();assert.equal(s.exportData(build.buildId).ok,false);
});
function bridge(fetchImpl,{baseUrl='http://offline.invalid'}={}){
 const context={fetch:fetchImpl,AbortController,TextDecoder,setTimeout,clearTimeout,console,DETACHABLE_MODES:{DOCKED:'docked',DETACHED:'detached'},buildAppearanceSnapshot:()=>({revision:1,settings:{}})};
 const create=vm.runInNewContext(factory+'\ncreateMainRendererBridgeClient;',context,{timeout:1000});return create({baseUrl,instanceId:'main-export',mainToken:'offline-export-main',controller:{}});
}
const mockFetch=(handler)=>{
 let closeStream=()=>{},markReady;const ready=new Promise(r=>markReady=r);
 const fn=async(url,options)=>{
  if(url.includes('/connect'))return{json:async()=>({ok:true,generation:1})};
  if(url.includes('/actions?'))return{ok:true,body:{getReader:()=>({read:()=>new Promise(resolve=>{closeStream=()=>{options.signal?.removeEventListener('abort',closeStream);resolve({done:true});};markReady();options.signal?.addEventListener('abort',closeStream,{once:true});if(options.signal?.aborted)closeStream();})})}};
  if(url.includes('/disconnect'))return{json:async()=>({ok:true})};return handler(url,options);
 };fn.disconnect=()=>closeStream();fn.ready=ready;return fn;
};
test('actual generated bridge performs exactly one typed export with header credentials',async()=>{
 const calls=[],b=bridge(mockFetch(async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true,diagnostic:{format:'whale-author-export-v1',buildId:build.buildId}}));}));
 try{await b.connect();assert.equal(calls.length,0);assert.equal((await b.requestAuthorDiagnostics(build.buildId)).ok,true);assert.equal(calls.length,1);
  const req=calls[0];assert.equal(new URL(req.url).search,'');assert.equal(JSON.parse(req.options.body).snapshot,undefined);assert.equal(req.options.headers['X-Whale-Instance-Id'],'main-export');
 }finally{await b.dispose();}
});
test('actual generated bridge reaches the real authenticated export route without altering snapshot',async t=>{
 const f=await fixture(t),b=bridge(fetch,{baseUrl:f.base});
 try{await b.connect();const before=JSON.stringify(f.host.getMainSession().snapshot);const r=await b.requestAuthorDiagnostics(build.buildId);assert.equal(r.diagnostic.buildId,build.buildId);assert.equal(JSON.stringify(f.host.getMainSession().snapshot),before);assert.deepEqual(JSON.parse(JSON.stringify(r.diagnostic.host.sources)),build.sources);}finally{await b.dispose();}
});
test('lost action stream during export still invalidates a late response',async()=>{
 let release;const gate=new Promise(r=>release=r),transport=mockFetch(async()=>{await gate;return new Response(JSON.stringify({ok:true,diagnostic:{format:'whale-author-export-v1',buildId:build.buildId}}));}),b=bridge(transport);
 try{await b.connect();await transport.ready;const result=b.requestAuthorDiagnostics(build.buildId);transport.disconnect();const end=performance.now()+500;while(b.authorConnected){if(performance.now()>end)throw Error('fixture-disconnect-deadline');await new Promise(r=>setImmediate(r));}release();await assert.rejects(result,/stale/);}finally{release();await b.dispose();}
});
test('bridge rejects changed build response and bounded oversized body',async()=>{
 for(const payload of [JSON.stringify({ok:true,diagnostic:{format:'whale-author-export-v1',buildId:'0'.repeat(64)}}),'x'.repeat(262145)]){
  const b=bridge(mockFetch(async()=>new Response(payload)));try{await b.connect();await assert.rejects(b.requestAuthorDiagnostics(build.buildId));}finally{await b.dispose();}
 }
});
test('bridge cancellation and disposed state prevent late acceptance',async()=>{
 const abort=new AbortController(),b=bridge(mockFetch(async()=>new Promise(()=>{})));await b.connect();const pending=b.requestAuthorDiagnostics(build.buildId,{signal:abort.signal});abort.abort();await assert.rejects(pending);await b.dispose();await assert.rejects(b.requestAuthorDiagnostics(build.buildId));
});
test('bridge has its own deadline even if a substituted transport ignores abort',async()=>{
 const b=bridge(mockFetch(async()=>new Promise(()=>{})));try{await b.connect();await assert.rejects(b.requestAuthorDiagnostics(build.buildId),/timeout/);}finally{await b.dispose();}
});
