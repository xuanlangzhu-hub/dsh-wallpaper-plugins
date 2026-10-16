// No live window/process providers. Verify the Host boundary and the real file queue protocol.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {installHostWorker,validateTicket} from './context-device-worker.mjs';
import {run} from './probe-context-device.mjs';

const base=resolve('dsh-whale-mist/.tmp/perf');await mkdir(base,{recursive:true});
const evidence=await mkdtemp(join(base,'context-check-'));const checks=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const snapshot={pid:321,execPath:'C:\\Apps\\DeepSeek Harness.exe',environment:{ELECTRON_RUN_AS_NODE:'1'}};
const window={title:'WhaleWallpaperProbe-context-fixture',hwnd:88,pid:99,visible:true,iconic:false,cloaked:false};
const ticket=index=>({index,token:'fixture',location:window.title,window,cwd:process.cwd(),expiresAt:Date.now()+60000});
async function check(name,fn){try{await fn();checks.push({name,ok:true});console.log('PASS',name);}catch(e){checks.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
async function fixture(name,capture,overrides={}){
  const root=join(evidence,name);await mkdir(root);await mkdir(join(root,'host'));
  await writeFile(join(root,'plan.json'),JSON.stringify({root,kind:'context-device-qa',token:'fixture'}));
  let dispose;const ctx={on(event,callback){assert.equal(event,'dispose');dispose=callback;}};
  installHostWorker(ctx,root,{describe:()=>snapshot,platform:'win32',checkHelper:async()=>({fixture:true}),capture,...overrides});
  return {root,dispose:()=>dispose()};
}
async function waitJson(path){for(let i=0;i<40;i++){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}await pause(25);}throw new Error('Fixture completion timed out');}
await check('Node executable cannot masquerade as the official Host',async()=>{
  assert.throws(()=>installHostWorker({on(){}},evidence,{describe:()=>({...snapshot,execPath:'C:\\node.exe'}),platform:'win32'}),/official Desktop Host/);
  assert.throws(()=>installHostWorker({on(){}},evidence,{describe:()=>({...snapshot,environment:{}}),platform:'win32'}),/official Desktop Host/);
});
await check('Expired, wrong token/index, invalid source and missing cwd are rejected',async()=>{
  const plan={token:'fixture'};validateTicket(ticket(1),plan,1);
  for(const change of [{expiresAt:Date.now()-1},{expiresAt:Infinity},{token:'other'},{index:3},{cwd:null},{window:{...window,pid:0}},{location:'other'}])
    assert.throws(()=>validateTicket({...ticket(1),...change},plan,1));
});
await check('Apply only reports readiness; no ticket means no capture',async()=>{
  let calls=0;const f=await fixture('idle',async()=>{calls++;});
  try{const ready=await waitJson(join(f.root,'host-ready.json'));assert.equal(ready.snapshot.pid,321);await pause(300);assert.equal(calls,0);}finally{f.dispose();}
});
await check('Two requests run once each, with no source lifecycle calls',async()=>{
  const calls=[];const f=await fixture('two',async options=>{calls.push(options);return {device:{luid:'fixture'}};});
  try{
    await waitJson(join(f.root,'host-ready.json'));
    await writeFile(join(f.root,'request-1.json'),JSON.stringify(ticket(1)));await writeFile(join(f.root,'request-2.json'),JSON.stringify(ticket(2)));
    const response=await waitJson(join(f.root,'response-2.json'));assert.equal(response.childClosed,true);assert.equal(response.error,null);
    await pause(350);assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.index),[0,1]);
    for(const c of calls){assert.equal(c.location,window.title);assert.equal(c.cwd,process.cwd());assert.ok(c.signal instanceof AbortSignal);}
  }finally{f.dispose();}
});
await check('Existing STOP aborts before the borrowed capture starts',async()=>{
  let aborted=false;const f=await fixture('stop',async({signal})=>{aborted=signal.aborted;throw new Error('fixture cancelled');});
  try{await waitJson(join(f.root,'host-ready.json'));await writeFile(join(f.root,'STOP'),'stop');await writeFile(join(f.root,'request-1.json'),JSON.stringify(ticket(1)));
    const response=await waitJson(join(f.root,'response-1.json'));assert.equal(aborted,true);assert.match(response.error,/cancelled/);assert.equal(response.childClosed,true);
  }finally{f.dispose();}
});
await check('Dispose cancels active work; response waits for its completion',async()=>{
  let started=false,finished=false;const f=await fixture('dispose',async({signal})=>{
    started=true;await new Promise(r=>signal.addEventListener('abort',r,{once:true}));await pause(30);finished=true;throw new Error('disposed');
  });
  await waitJson(join(f.root,'host-ready.json'));await writeFile(join(f.root,'request-1.json'),JSON.stringify(ticket(1)));
  for(let i=0;i<40&&!started;i++)await pause(25);assert.equal(started,true);f.dispose();
  const response=await waitJson(join(f.root,'response-1.json'));assert.equal(finished,true);assert.equal(response.childClosed,true);assert.match(response.error,/disposed/);
});
async function controllerFixture(name,{noResponse=false,hostError=false,stages}={}){
  const root=join(evidence,name);await mkdir(root);await mkdir(join(root,'host'));await mkdir(join(root,'node'));
  await writeFile(join(root,'plan.json'),JSON.stringify({root,kind:'context-device-qa',token:'fixture'}));
  const host={...snapshot,electron:'fixture'};await writeFile(join(root,'host-ready.json'),JSON.stringify({snapshot:host}));
  let source;const actions=[],captureCalls=[];
  const nativeCall=async args=>{actions.push(args);
    if(args[0]==='--we-open'){source={...window,title:args[1]};return {};}
    if(args[0]==='--window-find')return [source];
    if(args[0]==='--window-ensure-closed')return {closed:true};
    throw new Error('Unexpected native lifecycle operation');
  };
  const delay=async()=>{
    if(!noResponse)for(const i of [1,2]){
      try{await readFile(join(root,`request-${i}.json`));await writeFile(join(root,`response-${i}.json`),JSON.stringify({index:i,snapshot:host,childClosed:true,
        error:hostError?'mock Host failure':null,result:hostError?null:{device:{luid:'mock'}}}),{flag:'wx'});
      }catch(e){if(!['ENOENT','EEXIST'].includes(e.code))throw e;}
    }
    await pause(2);
  };
  let error;
  try{await run(root,new AbortController().signal,{nativeCall,capture:async()=>{captureCalls.push(true);return {device:{luid:'mock'}};},checkHelper:async()=>({}),delay,warmupMs:0,responseTimeoutMs:30,...(stages?{stages}:{})});}catch(e){error=e;}
  return {root,actions,captureCalls,error,report:JSON.parse(await readFile(join(root,'report.json'),'utf8'))};
}
await check('Controller orders Node/Host/Host/Node and closes the unique source once',async()=>{
  const f=await controllerFixture('controller-normal');assert.equal(f.error,undefined);assert.equal(f.report.complete,true);
  assert.deepEqual(f.report.results.map(r=>r.stage),['node-1','host-1','host-2','node-2']);
  const close=f.actions.filter(a=>a[0]==='--window-ensure-closed');assert.equal(close.length,1);assert.deepEqual(close[0].slice(-2),['--expect-pid','99']);
});
await check('Confirmed Host failure aborts later stages, then permits source cleanup',async()=>{
  const f=await controllerFixture('controller-failure',{hostError:true});assert.match(f.error.message,/Host failure/);
  assert.equal(f.report.results.length,1);assert.equal(f.report.complete,false);assert.equal(f.report.cleanup.closed,true);
});
await check('Missing Host completion never closes a potentially borrowed active source',async()=>{
  const f=await controllerFixture('controller-unconfirmed',{noResponse:true});assert.ok(f.error);assert.equal(f.report.cleanup.closed,false);
  assert.equal(f.actions.filter(a=>a[0]==='--window-ensure-closed').length,0);assert.equal(await readFile(join(f.root,'STOP'),'utf8'),'stop');
});
await check('Selected-adapter sequence contains only the two Host trials',async()=>{
  const f=await controllerFixture('adapter-stages',{stages:['host-1','host-2']});assert.equal(f.error,undefined);assert.equal(f.report.complete,true);
  assert.deepEqual(f.report.results.map(r=>r.stage),['host-1','host-2']);assert.equal(f.captureCalls.length,0);
  assert.equal(f.actions.filter(a=>a[0]==='--window-ensure-closed').length,1);
});
await writeFile(join(evidence,'checks.json'),JSON.stringify({checks,evidence},null,2));
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} passed; ${evidence}`);
if(checks.some(c=>!c.ok))process.exitCode=1;
