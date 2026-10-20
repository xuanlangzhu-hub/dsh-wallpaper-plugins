// Bounded offline entry point. Own Node test tree only; never launches Edge/DSH/WE.
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('./detachable-dispose.test.mjs',import.meta.url));
const start=Date.now();
const child=spawn(process.execPath,['--test','--test-concurrency=1',file],{
  windowsHide:true,detached:process.platform!=='win32',stdio:'inherit',
});
let settled=false,timedOut=false;
function finish(code,signal,exitConfirmed){
  if(settled)return;settled=true;clearTimeout(deadline);clearTimeout(fallback);
  console.log(JSON.stringify({stage:'dispose-offline-qa',code,signal,timedOut,exitConfirmed,elapsedMs:Date.now()-start}));
  process.exitCode=exitConfirmed&&!timedOut&&code===0?0:1;
  if(!exitConfirmed)child.unref();
}
const deadline=setTimeout(()=>{
  timedOut=true;
  if(child.pid&&child.exitCode===null&&child.signalCode===null){
    if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:3000,stdio:'ignore'});
    else {try{process.kill(-child.pid,'SIGKILL');}catch{}}
  }
},25000);
const fallback=setTimeout(()=>finish(null,null,false),31000);
child.once('close',(code,signal)=>finish(code,signal,true));
child.once('error',()=>finish(null,null,false));
