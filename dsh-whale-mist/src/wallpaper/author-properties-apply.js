// Host-only. Commands are always owned children; never terminate the rendering WE process.
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {validateLocation} from './managed-window.js';
import {areStartUtcsEquivalent,parseIsoStartUtc} from './session.js';
import {isSceneId} from '../detachable-contract.js';
import {authorError,isAuthorKey,isAuthorObject,safeAuthorString} from './author-properties-contract.js';

export const AUTHOR_WE_EXE='E:\\SteamLibrary\\steamapps\\common\\wallpaper_engine\\wallpaper64.exe';

/** Return early on unknown exit, but retain settled until the actual child close is observed. */
export function runAuthorChild(file,args,{signal,timeoutMs=900,killGraceMs=250,maxBytes=16384,verbatim=false,forbiddenPid=null,spawnImpl=spawn}={}){
  let child,closed=false,reported=false,failed=null,stdout='',stderr='',bytes=0,timer,grace,resolveResult,resolveSettled;
  const result=new Promise(r=>resolveResult=r),settled=new Promise(r=>resolveSettled=r);
  const report=exitConfirmed=>{if(reported)return;reported=true;resolveResult({ok:closed&&!failed&&child?.exitCode===0,exitConfirmed,pid:child?.pid??null,code:child?.exitCode??null,signal:child?.signalCode??null,stdout,reason:failed});};
  const finish=()=>{if(closed)return;closed=true;clearTimeout(timer);clearTimeout(grace);signal?.removeEventListener('abort',cancel);report(true);resolveSettled();};
  const cancel=()=>{
    failed??='cancelled';clearTimeout(timer);
    // kill() acts on this ChildProcess handle only. A substituted/ambiguous PID is never killed.
    if(!closed&&child?.pid&&child.pid!==forbiddenPid){try{child.kill();}catch{}}
    if(!grace)grace=setTimeout(()=>report(false),killGraceMs);
  };
  if(signal?.aborted){failed='cancelled';finish();return{result,settled,cancel};}
  try{
    child=spawnImpl(file,args,{windowsHide:true,shell:false,windowsVerbatimArguments:verbatim,stdio:['ignore','pipe','pipe']});
    const data=(kind,chunk)=>{bytes+=Buffer.byteLength(chunk);if(bytes>maxBytes){failed='output-limit';cancel();return;}if(kind==='stdout')stdout+=chunk;else stderr+=chunk;};
    child.stdout?.on('data',c=>data('stdout',c));child.stderr?.on('data',c=>data('stderr',c));
    child.once('close',(code)=>{if(code!==0)failed??='exit-error';finish();});
    child.once('error',()=>{failed='spawn-error';if(!child.pid)finish();else cancel();});
    if(child.pid===forbiddenPid){failed='ambiguous-child';grace=setTimeout(()=>report(false),killGraceMs);}
    else timer=setTimeout(()=>{failed='timeout';cancel();},timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  }catch{failed='spawn-error';finish();}
  return{result,settled,cancel};
}

export function authorCommandArgs(plan){
  if(!plan||plan.planOnly!==true||plan.executed!==false||!isSceneId(plan.wallpaperId)||!Array.isArray(plan.args)||plan.args.length!==6)throw authorError('author_plan_invalid');
  const location=validateLocation(plan.location);
  if(plan.args[0]!=='-control'||plan.args[1]!=='applyProperties'||plan.args[2]!=='-properties'||plan.args[4]!=='-location'||plan.args[5]!==location)throw authorError('author_plan_invalid');
  const raw=plan.args[3];if(typeof raw!=='string'||!raw.startsWith('RAW~(')||!raw.endsWith(')~END'))throw authorError('author_plan_invalid');
  let values;try{values=JSON.parse(raw.slice(5,-5));}catch{throw authorError('author_plan_invalid');}
  if(!isAuthorObject(values)||!Object.keys(values).length||Object.keys(values).length>256)throw authorError('author_plan_invalid');
  for(const [key,value]of Object.entries(values)){
    if(!isAuthorKey(key)||!['string','boolean','number'].includes(typeof value)||typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>1e6))throw authorError('author_plan_invalid');
    if(typeof value==='string')safeAuthorString(value);
  }
  // Keep the actual Win32 command line ASCII, including Chinese/emoji string values.
  // JSON escapes survive ANSI boundaries; verbatim preserves the JSON quotes inside WE's RAW block.
  const json=JSON.stringify(values).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  if(json.length>12000||json.includes(')~END')||json.includes('RAW~('))throw authorError('author_command_limit');
  return ['-control','applyProperties','-properties',`RAW~(${json})~END`,'-location',location];
}

function target(value){
  if(!value||!isSceneId(value.wallpaperId)||!Number.isSafeInteger(value.generation)||value.generation<0||!Number.isSafeInteger(value.hwnd)||value.hwnd<=0||!Number.isSafeInteger(value.pid)||value.pid<=0||!parseIsoStartUtc(value.startUtc)||typeof value.helper!=='string'||!value.helper.endsWith('.exe')||value.stopping||!value.captureStarted)throw authorError('author_target_unverified');
  return{wallpaperId:value.wallpaperId,generation:value.generation,location:validateLocation(value.location),hwnd:value.hwnd,pid:value.pid,startUtc:value.startUtc,helper:value.helper};
}

export function createAuthorApplyAdapter({readTarget,runChild=runAuthorChild,timeoutMs=5000,pollMs=25}={}){
  if(typeof readTarget!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<20||timeoutMs>5000)throw new TypeError('Invalid author apply adapter');
  let active=null,disposed=false;
  const read=()=>target(readTarget());
  return{
    canApply(id,generation){try{const t=read();return!disposed&&!active&&t.wallpaperId===id&&t.generation===generation;}catch{return false;}},
    busy:()=>Boolean(active),
    cancel(){active?.controller.abort(authorError('author_apply_cancelled'));},
    dispose(){
      disposed=true;this.cancel();if(!active)return Promise.resolve({ok:true});
      const pending=active;let timer;
      return Promise.race([pending.released.then(()=>({ok:true})),new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,error:'author_apply_exit_unknown'}),350);})]).finally(()=>clearTimeout(timer));
    },
    async apply(plan,{signal,check,validate}={}){
      if(disposed)throw authorError('author_disposed');if(active)throw authorError('author_apply_busy');
      const args=authorCommandArgs(plan),initial=read(),identity=JSON.stringify(initial);
      if(initial.wallpaperId!==plan.wallpaperId||initial.generation!==plan.generation||initial.location!==plan.location)throw authorError('author_target_unverified');
      const controller=new AbortController(),jobs=[];let releaseDone;const operation={controller,released:new Promise(resolve=>releaseDone=resolve)};active=operation;
      let sent=false,timer,poller,rejectAbort;
      const abort=()=>controller.abort(authorError('author_apply_cancelled'));
      const assertCurrent=()=>{if(disposed||controller.signal.aborted)throw authorError('author_apply_cancelled');check();if(JSON.stringify(read())!==identity)throw authorError('author_target_changed');};
      const cancelled=new Promise((_,reject)=>{rejectAbort=reject;controller.signal.addEventListener('abort',()=>reject(controller.signal.reason??authorError('author_apply_cancelled')),{once:true});});
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      timer=setTimeout(()=>controller.abort(authorError('author_apply_timeout')),timeoutMs);
      poller=setInterval(()=>{try{assertCurrent();}catch(e){controller.abort(e);}},pollMs);
      const command=async(file,argv,verbatim=false)=>{
        assertCurrent();const job=runChild(file,argv,{signal:controller.signal,verbatim,forbiddenPid:initial.pid});jobs.push(job);
        const r=await job.result;assertCurrent();
        if(!r?.exitConfirmed)throw authorError('author_apply_exit_unknown');
        if(!r.ok)throw authorError(r.reason==='timeout'?'author_apply_timeout':'author_apply_command_failed');return r.stdout;
      };
      const verifyIdentity=async()=>{
        let win,proc;
        try{win=JSON.parse(await command(initial.helper,['--window-inspect',String(initial.hwnd)]));}catch(e){if(e.authorReason)throw e;throw authorError('author_target_unverified');}
        if(win.exists!==true||win.hwnd!==initial.hwnd||win.pid!==initial.pid||win.title!==initial.location||win.processName!=='wallpaper64')throw authorError('author_target_unverified');
        const script=`$ErrorActionPreference='Stop'; $p=[Diagnostics.Process]::GetProcessById(${initial.pid}); [pscustomobject]@{pid=$p.Id;startUtc=$p.StartTime.ToUniversalTime().ToString('o');executable=$p.MainModule.FileName}|ConvertTo-Json -Compress`;
        const powershell=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
        try{proc=JSON.parse(await command(powershell,['-NoProfile','-NonInteractive','-Command',script]));}catch(e){if(e.authorReason)throw e;throw authorError('author_target_unverified');}
        if(proc.pid!==initial.pid||typeof proc.executable!=='string'||proc.executable.toLowerCase()!==AUTHOR_WE_EXE.toLowerCase()||!areStartUtcsEquivalent(proc.startUtc,initial.startUtc))throw authorError('author_target_unverified');
      };
      try{
        const work=(async()=>{
          assertCurrent();await verifyIdentity();await validate();assertCurrent();
          sent=true;await command(AUTHOR_WE_EXE,args,true);
          await verifyIdentity();await validate();assertCurrent();
          return{ok:true,sent:true,currentValuesKnown:false};
        })();
        return await Promise.race([work,cancelled]);
      }catch(e){controller.abort(e);if(sent)throw Object.assign(authorError(e.authorReason??'author_apply_uncertain'),{sentMayHaveOccurred:true});throw e;}
      finally{
        clearTimeout(timer);clearInterval(poller);signal?.removeEventListener('abort',abort);
        // Never unlock a second command while one of our children has unknown exit.
        // Timed-out IO can settle later, but its result can no longer spawn any new command.
        const release=()=>{if(active===operation)active=null;releaseDone();};
        Promise.allSettled(jobs.map(j=>j.settled)).then(release);
      }
    },
  };
}
