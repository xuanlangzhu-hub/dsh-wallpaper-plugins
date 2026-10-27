import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import http from 'node:http';
import {createAuthorApplyAdapter,authorCommandArgs,runAuthorChild,AUTHOR_WE_EXE} from '../src/wallpaper/author-properties-apply.js';
import {planAuthorProperties,authorDefaults} from '../src/wallpaper/author-properties-contract.js';
import {createAuthorSchema} from '../src/wallpaper/author-properties-schema.js';
import {createDetachableHttpHost} from '../src/detachable-host.js';
import {createAuthorPanel} from '../src/wallpaper/author-properties-panel.js';
const id='lucy',location='WhaleWallpaperProbe-author-1',startUtc='2026-10-21T00:00:00.1234567Z';
const target=()=>({wallpaperId:id,generation:4,location,hwnd:104,pid:88,startUtc,helper:'C:\\fixture\\WallpaperProbe.exe',captureStarted:true,stopping:false});
const meta=()=>({wallpaperId:id,type:'scene',contentRating:'Everyone',properties:{title:{type:'textinput',value:'默认'},speed:{type:'slider',value:2,min:0,max:10}}});
const schema=()=>createAuthorSchema(meta()),plan=()=>planAuthorProperties(schema(),{title:'鲸鱼 🐳 "quote" \\ $() & %'}, {generation:4,activeSceneId:id,location});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{const end=Date.now()+500;while(!fn()&&Date.now()<end)await delay(1);assert.ok(fn(),'phase did not begin');};
function adapterFixture(options={}){
  let current=target(),next=null,intercept=null;const calls=[];
  const runChild=(file,args,opts)=>{
    const item={file,args,opts};calls.push(item);
    const custom=intercept?.(item);if(custom)return custom;
    if(next){const fn=next;next=null;return fn(item);}
    const stdout=file===AUTHOR_WE_EXE?'':file.endsWith('powershell.exe')?JSON.stringify({pid:88,startUtc,executable:AUTHOR_WE_EXE}):JSON.stringify({hwnd:104,pid:88,title:location,exists:true,processName:'wallpaper64'});
    return{result:Promise.resolve({ok:true,exitConfirmed:true,stdout}),settled:Promise.resolve()};
  };
  const adapter=createAuthorApplyAdapter({readTarget:()=>current,runChild,...options});
  return{adapter,calls,setTarget:v=>current={...current,...v},next:fn=>next=fn,respond:fn=>intercept=fn,apply:(p=plan(),hooks={})=>adapter.apply(p,{check(){},validate:async()=>{},...hooks})};
}
test('RAW command is ASCII lossless JSON, explicit named location and no executable/flag override',()=>{
  const p=plan(),args=authorCommandArgs(p);assert.deepEqual(args.slice(0,3),['-control','applyProperties','-properties']);assert.deepEqual(args.slice(4),['-location',location]);
  assert.match(args[3],/\\u9cb8/);assert.ok(/^[\x20-\x7e]+$/.test(args[3]));assert.deepEqual(JSON.parse(args[3].slice(5,-5)),{title:'鲸鱼 🐳 "quote" \\ $() & %'});
  for(const changed of [{...p,location:'desktop'},{...p,args:['-control','stop']},{...p,args:[...p.args.slice(0,4),'-monitor','0']}])assert.throws(()=>authorCommandArgs(changed));
  assert.throws(()=>authorCommandArgs({...p,args:['-control','applyProperties','-properties','RAW~({"x":{}})~END','-location',location]}));
  const oversized=JSON.stringify(Object.fromEntries(Array.from({length:30},(_,i)=>['field'+i,'鲸'.repeat(100)])));
  assert.throws(()=>authorCommandArgs({...p,args:['-control','applyProperties','-properties','RAW~('+oversized+')~END','-location',location]}),/author_command_limit/);
});
test('verified target runs before/after identity probes and exactly one constrained command',async()=>{
  const f=adapterFixture();const r=await f.apply();assert.equal(r.sent,true);assert.equal(r.currentValuesKnown,false);assert.equal(f.calls.length,5);
  const command=f.calls.find(c=>c.file===AUTHOR_WE_EXE);assert.ok(command.opts.verbatim);assert.equal(command.opts.forbiddenPid,88);assert.equal(command.args.at(-1),location);await until(()=>!f.adapter.busy());
});
for(const [name,value]of [['PID',{pid:null}],['timestamp',{startUtc:'bad'}],['HWND',{hwnd:0}],['location',{location:'desktop'}],['capture',{captureStarted:false}],['stop',{stopping:true}],['scene',{wallpaperId:'we-aaaaaaaaaaaaaaaaaaaaaaaa'}],['generation',{generation:5}]])test('target '+name+' drift refuses command',async()=>{
  const f=adapterFixture();f.setTarget(value);await assert.rejects(f.apply());assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,0);
});
for(const [name,win]of [['pid',{pid:9}],['title',{title:'desktop'}],['hwnd',{hwnd:9}],['exists',{exists:false}],['process',{processName:'other'}]])test('observed window '+name+' mismatch refuses command',async()=>{
  const f=adapterFixture();f.next(()=>({result:Promise.resolve({ok:true,exitConfirmed:true,stdout:JSON.stringify({hwnd:104,pid:88,title:location,exists:true,processName:'wallpaper64',...win})}),settled:Promise.resolve()}));
  await assert.rejects(f.apply());assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,0);
});
test('post-send schema drift is uncertain, never acknowledged as sent success',async()=>{
  const f=adapterFixture();let n=0;await assert.rejects(f.apply(plan(),{validate:async()=>{if(++n===2)throw Object.assign(new Error('drift'),{authorReason:'author_schema_changed'});}}),e=>e.sentMayHaveOccurred===true&&e.authorReason==='author_schema_changed');
});
test('concurrent click and unknown child exit remain locked until actual settle',async()=>{
  const f=adapterFixture();let settle;f.next(()=>({result:Promise.resolve({ok:false,exitConfirmed:false}),settled:new Promise(r=>settle=r)}));
  await assert.rejects(f.apply(),/author_apply_exit_unknown/);assert.equal(f.adapter.busy(),true);await assert.rejects(f.apply(),/author_apply_busy/);assert.equal(f.calls.length,1);settle();await delay(0);assert.equal(f.adapter.busy(),false);
});
test('bounded total deadline settles even ignored IO, then late result cannot spawn WE',async()=>{
  const f=adapterFixture({timeoutMs:30});let release;f.next(()=>{const p=new Promise(r=>release=r);return{result:p,settled:p};});
  await assert.rejects(f.apply(),/author_apply_timeout/);assert.equal(f.adapter.busy(),true);release({ok:true,exitConfirmed:true,stdout:'{}'});await delay(5);assert.equal(f.calls.length,1);assert.equal(f.adapter.busy(),false);
});
test('bounded dispose reports unknown child exit and refuses every future operation',async()=>{
  const f=adapterFixture({timeoutMs:30});let release;f.next(()=>{const p=new Promise(r=>release=r);return{result:p,settled:p};});
  const pending=f.apply();await until(()=>release);const cleanup=f.adapter.dispose();await assert.rejects(pending);assert.equal((await cleanup).ok,false);await assert.rejects(f.apply(),/author_disposed/);
  release({ok:true,exitConfirmed:true,stdout:'{}'});await delay(0);assert.equal(f.adapter.busy(),false);
});
test('stop generation poll cancels pending command, no late continuation',async()=>{
  const f=adapterFixture({pollMs:5});let release;f.next(()=>{const p=new Promise(r=>release=r);return{result:p,settled:p};});
  const pending=f.apply();await until(()=>f.calls.length);f.setTarget({generation:5});await assert.rejects(pending);release({ok:true,exitConfirmed:true,stdout:'{}'});await delay(0);assert.equal(f.calls.length,1);
});
function fakeChild(pid=123){const child=new EventEmitter();Object.assign(child,{pid,exitCode:null,stdout:new PassThrough(),stderr:new PassThrough(),kills:0,kill(){this.kills++;},close(code=0){this.exitCode=code;this.stdout.end();this.stderr.end();this.emit('close',code);}});return child;}
test('owned runner success, output bound, timeout and unknown exit proof',async()=>{
  const success=fakeChild();const a=runAuthorChild('fixture',[],{spawnImpl:()=>success});success.stdout.write('ok');success.close();assert.equal((await a.result).ok,true);await a.settled;
  for(const mode of ['output','timeout','abort']){
    const c=fakeChild(),controller=new AbortController();const job=runAuthorChild('fixture',[],{spawnImpl:()=>c,timeoutMs:15,killGraceMs:10,maxBytes:4,signal:controller.signal});
    if(mode==='output')c.stdout.write('12345');if(mode==='abort')controller.abort();const r=await job.result;assert.equal(r.ok,false);assert.equal(r.exitConfirmed,false);assert.ok(c.kills>0);let ended=false;job.settled.then(()=>ended=true);await delay(0);assert.equal(ended,false);c.close(1);await job.settled;
  }
});
test('runner never kills an ambiguous child or protected render PID; spawn throw settles',async()=>{
  const c=fakeChild(88),job=runAuthorChild('fixture',[],{spawnImpl:()=>c,forbiddenPid:88,killGraceMs:10});assert.equal((await job.result).exitConfirmed,false);assert.equal(c.kills,0);c.close();await job.settled;
  const failed=runAuthorChild('fixture',[],{spawnImpl:()=>{throw Error('failed');}});assert.equal((await failed.result).exitConfirmed,true);await failed.settled;
});

function call(base,path,{body,headers={}}={}){return new Promise((resolve,reject)=>{const req=http.request(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...headers},timeout:3500},res=>{let data='';res.on('data',v=>data+=v);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data)}));});req.on('timeout',()=>req.destroy(Error('test-http-timeout')));req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});}
async function gateway(t){
  const f=adapterFixture(),data=meta();let readGate=null;
  const library={getAuthorMetadata:async()=>{if(readGate)await readGate;return JSON.parse(JSON.stringify(data));}};
  const state={revision:1,settings:{weScene:id,weAgeRatings:'Everyone'}};
  const host=createDetachableHttpHost({library,mainToken:'apply-test',authorApplyAdapter:f.adapter,readWallpaperLifecycle:()=>({generation:4,activeSceneId:id,location,cleanupPending:false,busy:false})});await host.start();t.after(()=>host.stop());const base=host.getBaseUrl();
  const reg=await call(base,'/api/main/connect',{body:{instanceId:'main',mainToken:'apply-test',snapshot:state}});const headers={'x-whale-main-token':'apply-test','x-whale-instance-id':'main','x-whale-generation':String(reg.data.generation)};
  const schemaReply=(await call(base,'/api/author-properties/schema?wallpaperId='+id,{headers})).data;
  const payload={wallpaperId:id,schemaFingerprint:schemaReply.schema.fingerprint,expectedRevision:0};
  const save=await call(base,'/api/author-properties/draft',{headers,body:{...payload,values:{title:'只改这一项'}}});assert.equal(save.data.ok,true);payload.expectedRevision=1;
  return {...f,host,base,headers,payload,state,data,setReadGate:p=>readGate=p,send:()=>call(base,'/api/author-properties/apply',{headers,body:payload})};
}
test('production HTTP apply sends stored delta, clears dirty state and rejects replay/forged body',{timeout:7000},async t=>{
  const f=await gateway(t);for(const extra of [{values:{speed:9}},{location:'desktop'},{authorized:true}])assert.equal((await call(f.base,'/api/author-properties/apply',{headers:f.headers,body:{...f.payload,...extra}})).data.ok,false);
  const r=await f.send();assert.equal(r.data.applySent,true);assert.deepEqual(r.data.draft.dirtyKeys,[]);const cmd=f.calls.find(c=>c.file===AUTHOR_WE_EXE);assert.deepEqual(JSON.parse(cmd.args[3].slice(5,-5)),{title:'只改这一项'});
  assert.equal((await f.send()).data.ok,false);assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,1);
});
test('production revision/schema/rating/lease drift and duplicate request cannot send stale defaults',{timeout:7000},async t=>{
  const f=await gateway(t);const bad=await call(f.base,'/api/author-properties/apply',{headers:f.headers,body:{...f.payload,expectedRevision:0}});assert.equal(bad.data.error,'author_revision_conflict');
  f.data.properties.title.value='已更改';assert.equal((await f.send()).data.error,'author_schema_changed');assert.equal(f.calls.length,0);
});
test('production unregister during preflight cancels without sending a command',{timeout:7000},async t=>{
  const f=await gateway(t);let release;let commandSeen=false;let n=0;
  // First identity probe waits; replacing the main instance cancels before any apply command.
  f.next(()=>{const p=new Promise(r=>release=r);return{result:p,settled:p};});
  const pending=f.send();await until(()=>f.calls.length);
  await call(f.base,'/api/main/connect',{body:{instanceId:'main',mainToken:'apply-test',snapshot:f.state}});
  assert.equal((await pending).data.ok,false);release({ok:true,exitConfirmed:true,stdout:'{}'});await delay(0);assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,0);
});
for(const [name,fields]of [['PID',{pid:9}],['timestamp',{startUtc:'2026-10-21T00:00:00.1234568Z'}],['executable',{executable:'C:\\other\\wallpaper64.exe'}]])test('observed process '+name+' mismatch refuses command',async()=>{
  const f=adapterFixture();f.respond(item=>item.file.endsWith('powershell.exe')?{result:Promise.resolve({ok:true,exitConfirmed:true,stdout:JSON.stringify({pid:88,startUtc,executable:AUTHOR_WE_EXE,...fields})}),settled:Promise.resolve()}:null);
  await assert.rejects(f.apply());assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,0);
});
for(const mode of ['policy','schema','stop','lease','dispose'])test('production '+mode+' during WE command never acknowledges success',{timeout:7000},async t=>{
  const f=await gateway(t);let release,commandSignal;
  f.respond(item=>{if(item.file!==AUTHOR_WE_EXE)return null;commandSignal=item.opts.signal;const p=new Promise(r=>release=r);return{result:p,settled:p};});
  let headers=f.headers;
  if(mode==='lease'){
    const d=(await call(f.base,'/api/main/detach',{headers:f.headers,body:{instanceId:'main',generation:1}})).data;
    const c=(await call(f.base,'/api/connect',{body:{instanceId:'main',token:d.token}})).data;
    headers={'x-whale-lease':c.leaseId,'x-whale-generation':String(c.generation)};
  }
  const pending=call(f.base,'/api/author-properties/apply',{headers,body:f.payload}).catch(e=>({data:{ok:false,networkClosed:true}}));await until(()=>release);
  const mutation=await call(f.base,'/api/author-properties/draft',{headers:f.headers,body:{...f.payload,values:{speed:5}}});assert.equal(mutation.data.error,'author_apply_busy');
  if(mode==='policy'){f.state.revision++;f.state.settings.weAgeRatings='';await call(f.base,'/api/main/snapshot',{headers:f.headers,body:{snapshot:f.state,instanceId:'main',generation:1}});}
  if(mode==='schema')f.data.properties.title.value='changed';
  if(mode==='stop')f.setTarget({generation:5});
  if(mode==='lease')await call(f.base,'/api/disconnect',{headers,body:{}});
  if(mode==='dispose')await f.host.stop();
  if(mode==='schema')release({ok:true,exitConfirmed:true,stdout:''});
  const result=await pending;assert.equal(result.data.ok,false);
  if(mode!=='dispose')assert.equal(result.data.sentMayHaveOccurred,true);
  assert.equal(commandSignal.aborted,true);assert.equal(f.calls.filter(c=>c.file===AUTHOR_WE_EXE).length,1);
  if(mode!=='schema')release({ok:true,exitConfirmed:true,stdout:''});await delay(0);
});
