import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=process.env.AUTHOR_UI_RUNTIME,build=JSON.parse(await readFile(process.env.AUTHOR_UI_BUILD,'utf8'));
const {createAuthorDiagnosticSession}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-export.js'));
const {createAuthorDiagnosticLifecycle}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostic-lifecycle.js'));
const {createAuthorDiagnosticRecorder,normalizeAuthorDiagnosticBuild,validateAuthorDiagnosticSnapshot}=await import(pathToFileURL(root+'/src/wallpaper/author-diagnostics.js'));
const index=await readFile(root+'/src/index.js','utf8'),hostFunction=index.slice(index.indexOf('function registerDetachableHost('));
async function hostRig(flag,authed=true){
 const hooks=new Map(),effects=[],routes=[],captured={};let stops=0;
 const ctx={webServer:{protocol:'https:',host:'app',port:1234,register(route){routes.push(route);return()=>{};}},get(){return{requestRejection:()=>authed?undefined:401};},on(name,fn){hooks.set(name,fn);},effect(fn){effects.push(fn());}};
 const create=vm.runInNewContext(hostFunction+'\nregisterDetachableHost;',{console,process:{platform:'win32',env:{WM_AUTHOR_DIAGNOSTICS:flag}},AUTHOR_DIAGNOSTIC_BUILD:build,createAuthorDiagnosticSession,
  createWallpaperReadTarget:()=>()=>null,createWallpaperReadLifecycle:()=>()=>null,createEdgeWindowAdapter:()=>null,
  createAuthorApplyAdapter(options){captured.adapter=options;return{};},createDetachableHttpHost(options){captured.host=options;return{start:async()=>({}),getPort:()=>12345,getMainToken:()=>'PRIVATE-BOOT-TOKEN',stop:async()=>{stops++;options.authorDiagnosticSession.dispose();return{ok:true};}};}},{timeout:1000});
 create(ctx,{library:{},wallpaper:{}});assert.equal(routes.length,1);
 const res={writeHead(code,headers){this.code=code;this.headers=headers;},end(body){this.data=JSON.parse(body);}};await routes[0].handler({},res);
 const globals=[];hooks.get('webserver/index-inject')(globals);
 return{res,captured,globals,async dispose(){for(const off of effects)await off();await hooks.get('dispose')();assert.equal(stops,1);}};
}
for(const flag of [undefined,'0','true','1'])test('actual Host creation/bootstrap flag '+String(flag),async()=>{
 const f=await hostRig(flag);try{assert.equal(f.res.code,200);assert.equal(!!f.res.data.authorDiagnostics,flag==='1');assert.equal(f.captured.adapter.diagnostics,f.captured.host.authorDiagnosticSession.recorder);assert.equal(!!f.captured.adapter.diagnostics,flag==='1');assert.equal(Object.keys(f.globals[0].value).join(','),'port');assert.equal(JSON.stringify(f.globals).includes('PRIVATE'),false);}finally{await f.dispose();}
});
test('bootstrap authentication failure never returns credentials or diagnostics',async()=>{
 const f=await hostRig('1',false);try{assert.equal(f.res.code,401);assert.equal('authorDiagnostics' in f.res.data,false);assert.equal('mainToken' in f.res.data,false);}finally{await f.dispose();}
});
const client=await readFile(root+'/src/client.js','utf8'),start=client.indexOf('      const initBridge = async () => {'),end=client.indexOf('      initBridge().catch(',start),init=client.slice(start,end);
assert.ok(start>=0&&end>start);
async function rendererRig({boot={port:12345},response={ok:true,port:12345,mainToken:'PRIVATE-BOOT-TOKEN',authorDiagnostics:build},ok=true,connected=true,lateDispose=false}={}){
 const files=[],calls=[];const diagnostic=createAuthorDiagnosticLifecycle({expectedBuild:build,createRecorder:createAuthorDiagnosticRecorder,normalizeBuild:normalizeAuthorDiagnosticBuild,validateSnapshot:validateAuthorDiagnosticSnapshot,requestHost:async()=>{throw Error('not requested');},readConnection:()=>({generation:1}),save:(text)=>files.push(text)});
 const context={__WHALE_DETACHABLE_BOOT__:boot,disposed:false,crypto:{randomUUID:()=> 'qa'},controller:{},bridgeState:{},editorGate:{refresh(){}},notifyBridge(){},nativeSidebar:{configureAuthorDiagnostics:value=>diagnostic.configure(value)},fetch:async(path)=>{calls.push(path);if(lateDispose)context.disposed=true;return{ok,json:async()=>response};},createMainRendererBridgeClient:()=>({authorConnected:connected,subscribe(){},connect:async()=>({ok:connected})})};
 const run=vm.runInNewContext('let bridgeClientInstance=null;\n'+init+'\ninitBridge;',context,{timeout:1000});await run();return{enabled:diagnostic.read().enabled,files,calls,dispose:()=>diagnostic.dispose()};
}
for(const [name,options,enabled]of [
 ['valid authenticated metadata',{},true],['missing metadata',{response:{ok:true,port:12345,mainToken:'PRIVATE'}},false],['wrong build',{response:{ok:true,port:12345,mainToken:'PRIVATE',authorDiagnostics:{...build,buildId:'0'.repeat(64)}}},false],['unauthenticated response',{ok:false},false],['failed bridge connection',{connected:false},false],['late disposed renderer',{lateDispose:true},false],['forged global metadata',{boot:{port:12345,mainToken:'PRIVATE',authorDiagnostics:build}},false],
 ])test('actual Renderer initialization: '+name,async()=>{const f=await rendererRig(options);try{assert.equal(f.enabled,enabled);assert.equal(f.files.length,0);if(name==='forged global metadata')assert.equal(f.calls.length,0);}finally{f.dispose();}});
