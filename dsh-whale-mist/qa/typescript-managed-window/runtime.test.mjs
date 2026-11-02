import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
const info=JSON.parse(fs.readFileSync(process.env.MANAGED_TYPE_INPUTS,'utf8'));
const baseline=await import(pathToFileURL(info.baseline)),typed=await import(pathToFileURL(info.module));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Only the process/stream IO seam is replaced; no executable or real helper is launched.
function rig(api,script,{timeoutMs=100,killThrows=false,streams=true}={}){
  const child=new EventEmitter(),calls=[];
  child.stdout=streams?new PassThrough():null;child.stderr=streams?new PassThrough():null;
  child.kill=()=>{calls.push('kill');if(killThrows)throw Error('already gone');return true;};
  const task=api.runHelper((...args)=>{calls.push(args);queueMicrotask(()=>script(child));return child;},'inert-helper.exe',['--window-find'],{timeoutMs});
  return {child,calls,task,dispose(){child.stdout?.end();child.stderr?.end();}};
}
for(const [label,api] of [['baseline',baseline],['typed',typed]]){
  test(label+': location rules preserve rejected characters and boundary lengths',()=>{
    const prefix=api.LOCATION_PREFIX;assert.equal(api.validateLocation('  '+prefix+'round!  '),prefix+'round!');
    assert.equal(api.validateLocation(prefix+'x'.repeat(120-prefix.length)).length,120);
    for(const value of [null,0,'',prefix+'x'.repeat(121-prefix.length),'other-round',...['"','\\','/',';','&','|','^','%',' ','中','\u007f'].map(x=>prefix+'x'+x+'y')])assert.throws(()=>api.validateLocation(value),String(value));
  });
  test(label+': Windows paths preserve extension, UNC and validation behavior',()=>{
    for(const p of ['C:\\a\\project.json','E:/a/movie.MP4','\\\\server\\share\\a.mp4','C:\\中文\\x.json'])assert.equal(api.validateProjectFile(' '+p+' '),p);
    for(const p of [null,'relative.json','C:movie.mp4','\\\\server\\x.json','\\\\.\\device\\x.mp4','C:\\x.exe','C:\\x:stream.mp4','C:\\x?.mp4','C:\\x\u0000.mp4','C:/'+ 'x'.repeat(400)+'.json'])assert.throws(()=>api.validateProjectFile(p));
  });
  test(label+': generic fallback, numeric bounds and deterministic identifiers',()=>{
    const fallback={kept:true};assert.equal(api.validateSize(null,fallback),fallback);assert.equal(api.validateSize(undefined,'auto'),'auto');
    for(const n of [160,7680])assert.equal(api.validateSize(n,99),n);
    for(const n of [159,7681,160.5,NaN,Infinity,'200',true])assert.throws(()=>api.validateSize(n,fallback));
    assert.equal(api.newLocation(0,.5),'WhaleWallpaperProbe-700101000000-8000');
    assert.ok(api.newLocation(0,1.5).startsWith(api.LOCATION_PREFIX));
    assert.throws(()=>api.newLocation(NaN,.5),RangeError);
  });
  test(label+': aliases retain unknown fields and original weak pid predicate',()=>{
    const left={opaque:1};const result=api.normalizeWindow({Hwnd:123,Pid:NaN,Title:17,Visible:'kept',Left:left,Top:false,StartUtc:' stamp '});
    assert.equal(result.hwnd,123);assert.ok(Number.isNaN(result.pid));assert.equal(result.title,17);assert.equal(result.visible,'kept');assert.equal(result.left,left);assert.equal(result.top,false);assert.equal(result.startUtc,'stamp');
    assert.deepEqual(api.normalizeWindow({hwnd:1,Hwnd:2,pid:'3',Pid:4,title:'',Title:'fallback',visible:false,left:0,top:null,startUtc:' '}),{hwnd:1,pid:null,title:'',visible:false,left:0,top:null,startUtc:null});
    for(const value of [null,17,{}, {hwnd:'1'},{hwnd:0},{hwnd:1.5}])assert.throws(()=>api.normalizeWindow(value));
    assert.equal(api.normalizeWindow({hwnd:2**54}).hwnd,2**54);
  });
  test(label+': helper preserves raw JSON and launch options',async()=>{
    for(const [text,want] of [['{"a":1}',{a:1}],['7',7],['null',null],['[1]',[1]]]){
      const r=rig(api,c=>{c.stdout.write(text.slice(0,1));c.stdout.write(Buffer.from(text.slice(1)));c.emit('close',0);});
      try{assert.deepEqual(await r.task,want);assert.deepEqual(r.calls[0],['inert-helper.exe',['--window-find'],{windowsHide:true,stdio:['ignore','pipe','pipe']}]);assert.equal(r.calls.length,1);}finally{r.dispose();}
    }
  });
  test(label+': helper malformed, nonzero and error events preserve failures',async()=>{
    for(const [script,expected,options] of [
      [c=>{c.stdout.write('{');c.emit('close',0);},/returned unreadable output: \{/],
      [c=>c.emit('close',0),/exited 0/],
      [c=>{c.stderr.write('old\n'+'z'.repeat(5000)+'\nlast reason');c.emit('close',7);},/exited 7: last reason/],
      [c=>c.emit('close',null),/exited null/,{streams:false}],
      [c=>{c.emit('error',Error('event failed'));c.stdout.write('{}');c.emit('close',0);},/event failed/],
    ]){const r=rig(api,script,options);try{await assert.rejects(r.task,expected);}finally{r.dispose();}}
    await assert.rejects(api.runHelper(()=>{throw Error('spawn failed');},'x',[]),/spawn failed/);
  });
  test(label+': helper timeout wins over late completion and settled result cancels timer',async()=>{
    const timed=rig(api,()=>{},{timeoutMs:10,killThrows:true});
    try{await assert.rejects(timed.task,/timed out after 10 ms/);assert.equal(timed.calls.filter(x=>x==='kill').length,1);timed.child.stdout.write('{}');timed.child.emit('close',0);await assert.rejects(timed.task,/timed out/);}finally{timed.dispose();}
    const done=rig(api,c=>{c.stdout.write('{}');c.emit('close',0);c.emit('error',Error('late error'));},{timeoutMs:10});
    try{assert.deepEqual(await done.task,{});await pause(25);assert.equal(done.calls.filter(x=>x==='kill').length,0);}finally{done.dispose();}
  });
  test(label+': polling preserves fast, grace and slow order without real sleeps',async()=>{
    const calls=[],delays=[];let n=0;
    const result=await api.waitForWindow(async args=>{calls.push([...args]);return ++n===4?[{title:'wanted',hwnd:99,pid:7}]:[{title:'other',hwnd:1}];},'wanted',{fastAttempts:1,graceAttempts:1,attempts:2,fastDelayMs:11,graceDelayMs:22,delayMs:33,sleep:async ms=>{delays.push(ms);}});
    assert.equal(result.hwnd,99);assert.deepEqual(delays,[11,22,33]);assert.deepEqual(calls,Array.from({length:4},()=>['--window-find']));
  });
  test(label+': rejection, no result, ambiguous and malformed matched records',async()=>{
    const opts={fastAttempts:0,attempts:2,sleep:async()=>{}};
    assert.equal(await api.waitForWindow(async()=>{throw Error('find failed');},'wanted',opts),null);
    assert.equal(await api.waitForWindow(async()=>null,'wanted',opts),null);
    assert.equal(await api.waitForWindow(async()=>[{Title:'wanted',Hwnd:1}],'wanted',opts),null);
    await assert.rejects(api.waitForWindow(async()=>[{title:'wanted',hwnd:1},{title:'wanted',hwnd:2}],'wanted',opts),/2 windows named wanted/);
    await assert.rejects(api.waitForWindow(async()=>[{title:'wanted',hwnd:0}],'wanted',opts),/no usable handle/);
    await assert.rejects(api.waitForWindow(async()=>({title:'wanted'}),'wanted',opts),TypeError);
  });
  test(label+': default sleep returns a promise resolving without a value',async()=>{
    const result=api.defaultSleep(0);assert.ok(result instanceof Promise);assert.equal(await result,undefined);
  });
}
test('baseline and typed deterministic transcript agree',async()=>{
  async function transcript(api){
    const errors=[];for(const value of ['',0,'bad'])try{api.validateLocation(value);}catch(error){errors.push([error.name,error.message]);}
    const delays=[];const window=await api.waitForWindow(async()=>[],'none',{fastAttempts:1,graceAttempts:1,attempts:1,fastDelayMs:1,graceDelayMs:2,delayMs:3,sleep:async ms=>{delays.push(ms);}});
    return {errors,window,delays,record:api.normalizeWindow({hwnd:3,title:19,visible:'x',startUtc:' time '})};
  }
  assert.deepEqual(await transcript(typed),await transcript(baseline));
});
