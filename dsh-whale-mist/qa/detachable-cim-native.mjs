// Windows-only, self-supervised CIM regression. Own Node fixtures; never opens Edge.
import {spawn,spawnSync,execFile} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const filename=fileURLToPath(import.meta.url);
if(process.platform!=='win32'){
 console.log('SKIP: real Windows CIM validation requires Windows');
}else if(!process.argv.includes('--native-worker')){
 const child=spawn(process.execPath,[filename,...process.argv.slice(2),'--native-worker'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
 let timedOut=false,finished=false;
 const timer=setTimeout(()=>{timedOut=true;if(child.exitCode===null&&child.signalCode===null)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:2500,stdio:'ignore'});},75000);
 const fallback=setTimeout(()=>finish(null,null,false),80000);
 function finish(code,signal,confirmed){if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);console.log(JSON.stringify({supervisorExitConfirmed:confirmed,code,signal,timedOut}));process.exitCode=confirmed&&!timedOut&&code===0?0:1;if(!confirmed){child.stdout.destroy();child.stderr.destroy();child.unref();}}
 child.once('close',(c,s)=>finish(c,s,true));child.once('error',()=>finish(null,null,true));
}else{
 const {queryWindowsProcessesByProfile,checkWindowsProcessIdentity,extractUserDataDir,parseCreationDate}=await import('../src/detachable-edge-adapter.js');
 const rows=[];const owned=[];
 const outputArg=process.argv.indexOf('--output');const output=outputArg>=0?process.argv[outputArg+1]:null;
 const native=(f,a,o,cb)=>execFile(f,a,{...o,timeout:3000,windowsHide:true},cb);
 async function bounded(p,ms,label){let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(t);}}
 function record(name,fn){try{fn();rows.push({name,passed:true});}catch(e){rows.push({name,passed:false,error:e.message});}}
 const stem='C:\\Temp\\whale-companion-profile-native-cim-';
 let absentPid;
 try{
  for(const name of ['ordinary','space name','中文名',"apostrophe's",'dollar$name','back`tick','[brackets]','percent%','under_score',"mixed [x]_%'中文$`"]){
   const profile=stem+name;const fixture=spawn(process.execPath,['-e','setTimeout(()=>{},45000)','--','--user-data-dir='+profile],{windowsHide:true,stdio:'ignore'});
   owned.push(fixture);
   try{
    await bounded(once(fixture,'spawn'),3500,'fixture spawn deadline');
    const q=await queryWindowsProcessesByProfile(profile,process.execPath,native);
    record('native group exact PID: '+name,()=>{assert.equal(q.ok,true,q.error);assert.deepEqual(q.pids,[fixture.pid]);});
    const creation=q.processes?.find(r=>r.ProcessId===fixture.pid)?.CreationDate;
    const identity=await checkWindowsProcessIdentity(fixture.pid,profile,process.execPath,native,creation);
    record('native identity match: '+name,()=>assert.equal(identity.status,'matched',JSON.stringify(identity)));
    if(name==='ordinary'){
     const wrong=await checkWindowsProcessIdentity(fixture.pid,profile,process.execPath,native,parseCreationDate(creation)+1);
     record('native one-millisecond recycle rejected',()=>assert.equal(wrong.status,'mismatched'));
    }
    absentPid=fixture.pid;
   }finally{
    if(fixture.exitCode===null&&fixture.signalCode===null){const close=once(fixture,'close');fixture.kill();await bounded(close,1500,'owned fixture exit unconfirmed');}
   }
  }
  const absent=await checkWindowsProcessIdentity(absentPid,stem+'absent',process.execPath,native);
  record('native terminated fixture is not-found',()=>assert.equal(absent.status,'not-found'));
  const p="C:\\Temp\\literal'apostrophe";
  for(const command of ['msedge.exe --user-data-dir='+p,'msedge.exe --user-data-dir '+p,'msedge.exe --user-data-dir="'+p+'"','msedge.exe "--user-data-dir='+p+'"',"msedge.exe --user-data-dir='C:\\Temp\\wrapped profile'"]){
   record('argument shape '+command,()=>assert.equal(extractUserDataDir(command),command.includes('wrapped profile')?'C:\\Temp\\wrapped profile':p));
  }
  const stub=(error,out)=>(f,a,o,cb)=>cb(error,out,'');
  for(const error of [Object.assign(Error('general failure'),{code:1}),Object.assign(Error('not found in query text'),{code:3}),Object.assign(Error('synthetic-root-absent'),{code:5}),Object.assign(Error('deadline'),{code:'ETIMEDOUT'})]){
   const r=await checkWindowsProcessIdentity(400000,p,process.execPath,stub(error,''));
   record('identity error cannot become absent: '+error.code,()=>assert.equal(r.status,'error'));
  }
  const empty=await checkWindowsProcessIdentity(400000,p,process.execPath,stub(null,''));
  record('identity empty successful stdout is unknown',()=>assert.equal(empty.status,'error'));
  const explicit=await checkWindowsProcessIdentity(400000,p,process.execPath,stub(Object.assign(Error('explicit absence'),{code:2}),''));
  record('identity reserved exit2 is not-found',()=>assert.equal(explicit.status,'not-found'));
  for(const out of ['broken-json','null','42','{"ProcessId":400000}','[{"ProcessId":400000}]']){
   const r=await queryWindowsProcessesByProfile(p,process.execPath,stub(null,out));
   record('group bad output remains untrusted: '+out,()=>assert.equal(r.ok,false));
  }
  const error=await queryWindowsProcessesByProfile(p,process.execPath,stub(Object.assign(Error('CIM failed'),{code:1}),''));
  record('group execution error remains untrusted',()=>assert.equal(error.ok,false));
 }catch(e){rows.push({name:'worker failure',passed:false,error:e.stack});process.exitCode=1;}
 finally{
  for(const child of owned){if(child.exitCode===null&&child.signalCode===null){const close=once(child,'close');child.kill();try{await bounded(close,1500,'final fixture exit unconfirmed');}catch(e){rows.push({name:'fixture cleanup',passed:false,error:e.message});process.exitCode=1;}}}
  const result={passed:rows.every(r=>r.passed),checks:rows.length,ownedFixtures:owned.length,ownedExitsConfirmed:owned.every(c=>c.exitCode!==null||c.signalCode!==null),rows};
  if(!result.passed||!result.ownedExitsConfirmed)process.exitCode=1;
  if(output)await writeFile(output,JSON.stringify(result,null,2),{flag:'wx'});
  console.log(JSON.stringify(result,null,2));
 }
}
