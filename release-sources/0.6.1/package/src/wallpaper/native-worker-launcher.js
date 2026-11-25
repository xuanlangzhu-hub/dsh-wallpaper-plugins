// Derived from the fixed worker launcher; a final matching record closes the control
// pipe so a synchronous Windows console reader can finish before worker exit.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
export function createSupervisedQueryLauncher({worker,timeoutMs=12000,cancelMs=1500,maxBytes=65536,input=()=>({})}={}) {
 if(!worker?.executable||!Array.isArray(worker.args)||!Array.isArray(worker.pins)||!worker.pins.some(p=>p.path===worker.executable)||
  !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>12000||!Number.isInteger(cancelMs)||cancelMs<1||cancelMs>2000||
  !Number.isInteger(maxBytes)||maxBytes<1||maxBytes>65536)throw Error('invalid-worker-config');
 return ({signal}={})=>{
  if(signal?.aborted)throw Error('query-cancelled');
  for(const pin of worker.pins)if(createHash('sha256').update(readFileSync(pin.path)).digest('hex')!==pin.sha256)throw Error('query-worker-drift');
  const nonce=randomUUID(),request={protocol:1,nonce,input:input()},encoded=JSON.stringify(request)+'\n';if(Buffer.byteLength(encoded)>8192)throw Error('query-worker-request-limit');
  const child=spawn(worker.executable,worker.args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let resolveResult,rejectResult,resolveClosed,done=false,cancelled=false,forced=false,error=null,stdout='',stdoutBytes=0,stderrBytes=0,grace;
  const result=new Promise((a,b)=>{resolveResult=a;rejectResult=b;}),closed=new Promise(a=>resolveClosed=a);result.catch(()=>{});
  const force=()=>{if(done||forced)return;forced=true;try{child.kill();}catch{error='query-worker-kill-unconfirmed';}rejectResult(Error(error??'query-worker-exit-unconfirmed'));};
  function cancel(){if(done||cancelled)return;cancelled=true;try{child.stdin.write(JSON.stringify({cancel:nonce})+'\n');}catch{}grace=setTimeout(force,cancelMs);}
  const deadline=setTimeout(()=>{error='query-worker-timeout';cancel();},timeoutMs);
  const onAbort=()=>cancel();signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)cancel();
  child.stdin.on('error',()=>{});child.on('error',()=>{error='query-worker-start-failed';});
  child.stdout.on('data',bytes=>{
   stdoutBytes+=bytes.length;if(stdoutBytes>maxBytes){error='query-worker-output-limit';cancel();force();return;}
   try{stdout+=decoder.decode(bytes,{stream:true});}catch{error='query-worker-encoding-invalid';cancel();force();return;}
   if(stdout.endsWith('\n'))try{const packet=JSON.parse(stdout);if(packet.protocol===1&&packet.nonce===nonce)child.stdin.end();}catch{}
  });
  child.stderr.on('data',bytes=>{stderrBytes+=bytes.length;if(stderrBytes>maxBytes){error='query-worker-output-limit';cancel();force();}});
  child.on('close',(code,signalCode)=>{
   if(done)return;done=true;clearTimeout(deadline);clearTimeout(grace);signal?.removeEventListener('abort',onAbort);child.stdin.destroy();
   let report;try{stdout+=decoder.decode();report=JSON.parse(stdout);}catch{error??='query-worker-protocol-invalid';}
   const valid=report?.protocol===1&&report.nonce===nonce&&report.queryChildCleanupConfirmed===true;
   const receipt={exited:child.pid!=null,workerReaped:true,exitCode:code,signal:signalCode,pid:child.pid??null,forced,
    queryChildCleanupConfirmed:valid&&!forced&&!error&&[0,2].includes(code),queryChildPid:valid?report.queryChildPid??null:null};
   resolveClosed(receipt);
   if(!receipt.queryChildCleanupConfirmed||(!cancelled&&code!==0)||!report.query)rejectResult(Error(error??'query-worker-unconfirmed'));else resolveResult(report.query);
  });
  try{child.stdin.write(encoded);}catch{error='query-worker-start-failed';cancel();}
  return {result,closed,cancel};
 };
}
