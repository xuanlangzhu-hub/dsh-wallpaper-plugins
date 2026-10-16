// No live processes or window calls: substitute native calls and the exact child-process boundary.
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {runModeExperiment} from './probe-mode-device.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const base=resolve(here,'../../.tmp/perf');await mkdir(base,{recursive:true});
const root=await mkdtemp(join(base,'mode-check-'));const results=[];
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
const location='WhaleWallpaperProbe-mode-mock';
const device={adapter:'测试 GPU',luid:'103941',vendorId:32902};
function fixture(options={}){
  const events=[],spawns=[];let statusCalls=0,active=0;
  const window={title:location,hwnd:100,pid:77,visible:true,iconic:false,cloaked:false};
  const nativeCall=async args=>{
    events.push({native:args[0],args,active});
    if(args[0]==='--we-open'){if(options.openFails)throw new Error('mock open failed');return {opened:true};}
    if(args[0]==='--window-find')return [window];
    if(args[0]==='--window-status'){
      statusCalls++;const state=options.changedIdentity&&statusCalls===2?{...window,pid:88}:window;
      return options.pascalStatus?Object.fromEntries(Object.entries(state).map(([key,value])=>[key[0].toUpperCase()+key.slice(1),value])):state;
    }
    if(args[0]==='--window-ensure-closed'){assert.equal(active,0,'window cleanup must follow child close');return {closed:!options.closeFails};}
    throw new Error('Unexpected native call');
  };
  const spawnImpl=(file,args,opts)=>{
    const child=new EventEmitter();child.pid=1000+spawns.length;child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
    spawns.push({file,args,opts,child});active++;
    let done=false;child.kill=()=>{if(!done){done=true;active--;child.emit('close',1,'SIGTERM');}return true;};
    setTimeout(async()=>{
      if(done)return;
      try{
        const payload=JSON.stringify({kind:'log',level:'info',scope:args[4]==='pipe'?'Capture':'Status',message:JSON.stringify(device)})+'\n';
        if(!options.noDevice){
          const bytes=Buffer.from(payload);const split=bytes.indexOf(Buffer.from('测试'))+1;
          child.stderr.write(bytes.subarray(0,split));child.stderr.write(bytes.subarray(split));
          if(options.duplicateDevice)child.stderr.write(payload);
        }
        child.stdout.write(Buffer.alloc(128,255));
        await writeFile(join(args[1],'summary.json'),JSON.stringify({reason:options.early?'escape':'duration',frames:2}));
        if(options.abort)options.abort.abort();
        done=true;active--;child.emit('close',options.exitFailure?1:0,null);
      }catch(error){child.emit('error',error);done=true;active--;child.emit('close',1,null);}
    },options.slow?50:5);
    return child;
  };
  return {nativeCall,spawnImpl,events,spawns};
}
async function run(name,options={}){
  const f=fixture(options);const outputRoot=join(root,name);
  let report,error;
  try{report=await runModeExperiment({outputRoot,helper:'mock-helper',project:'mock-project',location,...f,warmupMs:0,
    timeoutMs:options.slow?2:500,signal:options.abort?.signal});}catch(e){error=e;}
  return {...f,report,error,outputRoot};
}
await check('Four trials share one source, parent options and captured environment',async()=>{
  const r=await run('normal');assert.equal(r.error,undefined);assert.equal(r.report.complete,true);assert.equal(r.report.sameDevice,true);
  assert.deepEqual(r.spawns.map(x=>x.args[4]),['memory','pipe','pipe','memory']);
  assert.equal(r.events.filter(e=>e.native==='--we-open').length,1);assert.equal(r.events.filter(e=>e.native==='--window-ensure-closed').length,1);
  for(const s of r.spawns){assert.equal(s.args[0],'100');assert.equal(s.args[2],'8');assert.equal(s.args[3],'30');assert.equal(s.args[5],'--echo-on-stderr');
    assert.ok(!s.args.includes('--owned-location')&&!s.args.includes('--forever'));assert.deepEqual(s.opts.stdio,['pipe','pipe','pipe']);
    assert.equal(s.opts.env,r.spawns[0].opts.env);assert.equal(s.opts.cwd,r.spawns[0].opts.cwd);assert.equal(s.opts.windowsHide,true);}
  assert.equal(r.report.trials[0].device.adapter,'测试 GPU');assert.equal(r.report.trials[0].stdoutBytes,128);
});
await check('Native camelCase find and PascalCase status share the same identity',async()=>{
  const r=await run('native-casing',{pascalStatus:true});assert.equal(r.error,undefined);assert.equal(r.report.complete,true);
});
for(const [name,options] of [['missing-device',{noDevice:true}],['duplicate-device',{duplicateDevice:true}],['failed-exit',{exitFailure:true}],['escape',{early:true}]]){
  await check(name+' aborts later trials and closes only owned source',async()=>{
    const r=await run(name,options);assert.ok(r.error);assert.equal(r.spawns.length,1);assert.equal(r.events.at(-1).native,'--window-ensure-closed');
    assert.equal(JSON.parse(await readFile(join(r.outputRoot,'report.json'),'utf8')).complete,false);
  });
}
await check('Source identity change is rejected and original PID guards cleanup',async()=>{
  const r=await run('identity',{changedIdentity:true});assert.match(r.error.message,/identity changed/);
  assert.equal(r.spawns.length,1);assert.deepEqual(r.events.at(-1).args.slice(-2),['--expect-pid','77']);
});
await check('Unconfirmed cleanup never reports success',async()=>{
  const r=await run('cleanup-failure',{closeFails:true});assert.ok(r.error);
  const report=JSON.parse(await readFile(join(r.outputRoot,'report.json'),'utf8'));assert.equal(report.complete,false);assert.equal(report.cleanup.closed,false);
});
await check('Window-open failure still attempts claimed-name cleanup',async()=>{
  const r=await run('open-failure',{openFails:true});assert.ok(r.error);assert.equal(r.spawns.length,0);assert.equal(r.events.at(-1).native,'--window-ensure-closed');
});
await check('Watchdog waits for owned child close before window cleanup',async()=>{
  const r=await run('watchdog',{slow:true});assert.match(r.error.message,/watchdog/);assert.equal(r.spawns.length,1);assert.equal(r.events.at(-1).active,0);
});
await check('Cancellation stops sequence and confirms child exit first',async()=>{
  const abort=new AbortController();const r=await run('cancel',{abort});assert.match(r.error.message,/cancelled/);assert.equal(r.spawns.length,1);assert.equal(r.events.at(-1).active,0);
});
await check('Existing output refuses all native actions and preserves sentinel',async()=>{
  const dir=join(root,'occupied');await mkdir(dir);await writeFile(join(dir,'sentinel'),'keep');const f=fixture();
  await assert.rejects(runModeExperiment({outputRoot:dir,location,...f,warmupMs:0}));assert.equal(f.events.length,0);assert.equal(await readFile(join(dir,'sentinel'),'utf8'),'keep');
});
await check('Already-cancelled request creates no window',async()=>{
  const abort=new AbortController();abort.abort();const r=await run('pre-cancel',{abort});assert.ok(r.error);assert.equal(r.events.length,0);
});
await writeFile(join(root,'checks.json'),JSON.stringify({results,evidenceDir:root},null,2));
console.log(`${results.filter(x=>x.ok).length}/${results.length} passed; evidence: ${root}`);
if(results.some(x=>!x.ok))process.exitCode=1;
