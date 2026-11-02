import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(process.env.WM_PREFLIGHT_ROOT);
const pkg=join(root,'staging');
const samples=join(root,'protocol');
const {FrameDecoder}=await import(pathToFileURL(join(pkg,'src/wallpaper/frame-protocol.js')));
const {createPreviewSession}=await import(pathToFileURL(join(pkg,'src/wallpaper/session.js')));
const runtime=JSON.parse(await readFile(join(samples,'runtime.json'),'utf8'));
const journal=(await readFile(join(samples,'journal.jsonl'),'utf8')).trim().split(/\r?\n/);
const packet=await readFile(join(samples,'frame.whl'));
const argv=[];
let index=0;
async function harness({mode='daily',disabled=false,proof=runtime.success}={}) {
  const calls=[],children=[];
  const output=join(root,'host-cases',String(index++)); await mkdir(output,{recursive:true});
  const location=()=>calls.find(c=>c[0]==='--we-open')?.[1];
  const session=createPreviewSession({
    env:disabled?{WM_WALLPAPER_TASKBAR_HIDE:'0'}:{},childExitTimeoutMs:50,
    helperRun:async(_helper,args)=>{
      calls.push(args);
      if(args[0]==='--we-open')return {opened:true};
      if(args[0]==='--window-find')return [{hwnd:4242,pid:777,title:location(),visible:true}];
      if(args[0]==='--window-apply')return {visible:true,left:-32000,top:-32000};
      if(args[0]==='--window-ensure-closed')return {outcome:'closed',closed:true,location:args[1]};
      throw Error('unexpected helper call '+args[0]);
    },
    spawnChild:(_helper,args)=>{
      const child=new EventEmitter(); child.pid=4545;child.exitCode=null;
      child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();
      child.stdin.end=()=>{
        if(proof)child.stderr.emit('data',JSON.stringify({kind:'log',level:'info',scope:'Summary',message:JSON.stringify({reason:'parent-stop',taskbarHide:proof})})+'\n');
        child.exitCode=0;child.emit('exit',0);child.emit('close',0);
      };
      child.kill=()=>{child.exitCode=1;child.emit('exit',1);child.emit('close',1);};
      children.push({child,args});return child;
    },sleep:async()=>{},now:()=>1700000000000,
  });
  await session.create({helper:join(pkg,'assets/wallpaper/WallpaperProbe.exe'),output,scene:{scene:'lucy',mode}});
  return {session,calls,children};
}

test('real C# FramePipe bytes survive split chunks in fixed rc53 decoder',()=>{
  const frames=[];const decoder=new FrameDecoder(f=>frames.push(f));
  for(let i=0;i<packet.length;i+=3)decoder.push(packet.subarray(i,i+3));decoder.finish();
  assert.equal(frames.length,1);assert.equal(frames[0].sequence,7);assert.equal(frames[0].capturedAt,1700000000123);
  assert.equal(frames[0].width,1280);assert.equal(frames[0].height,720);assert.deepEqual([...frames[0].jpeg],[255,216,255,217]);
});
test('fixed decoder refuses damaged native packet',()=>{
  const bad=Buffer.from(packet);bad[0]=0;assert.throws(()=>new FrameDecoder(()=>{}).push(bad),/magic/);
});
test('fixed decoder refuses incomplete native packet',()=>{
  const decoder=new FrameDecoder(()=>{});decoder.push(packet.subarray(0,-1));assert.throws(()=>decoder.finish(),/Truncated/);
});
for(const [name,mode,disabled]of [['daily','daily',false],['preview','preview',false],['fallback','daily',true]]) {
  test('fixed Host emits native-compatible '+name+' argv',async()=>{
    const f=await harness({mode,disabled});
    try{const args=f.children[0].args;argv.push(args);assert.equal(args.includes('--taskbar-hide'),!disabled);assert.equal(args.includes('--forever'),mode==='daily');
      assert.equal(args[args.indexOf('--owned-location')+1],f.session.state().location);
    }finally{await f.session.stop();}
  });
}
test('fixed Host consumes real C# journal and confirmed runtime summary',async()=>{
  const f=await harness();try{
    for(const line of journal)f.children[0].child.stderr.emit('data',line+'\n');
    await new Promise(r=>setImmediate(r));
    assert.equal(f.session.state().captureStarted,true);
    assert.equal(f.session.report().native.taskbarHide.stage,'action-done');
    const result=await f.session.stop();assert.equal(result.closed,true);
    assert.equal(f.calls.filter(c=>c[0]==='--window-ensure-closed').length,1);
  }finally{await f.session.stop();}
});
test('periodic runtime status cannot replace terminal cleanup proof',async()=>{
  const f=await harness({proof:null});
  f.children[0].child.stderr.emit('data',journal[0]+'\n');
  const result=await f.session.stop();assert.equal(result.closed,false);
  assert.equal(f.calls.filter(c=>c[0]==='--window-ensure-closed').length,0);
});
test('unconfirmed real runtime summary blocks source close',async()=>{
  const f=await harness({proof:runtime.unconfirmed});const result=await f.session.stop();
  assert.equal(result.closed,false);assert.equal(f.calls.filter(c=>c[0]==='--window-ensure-closed').length,0);
});
test('stopped-before-action real runtime summary permits exact owned-source close',async()=>{
  const f=await harness({proof:runtime.unstarted});const result=await f.session.stop();
  assert.equal(result.closed,true);assert.equal(f.calls.filter(c=>c[0]==='--window-ensure-closed').length,1);
});
test('persist actual Host argv for pure native parser round trip',async()=>{
  assert.equal(argv.length,3);await writeFile(join(root,'host-argv.json'),JSON.stringify(argv));
});
