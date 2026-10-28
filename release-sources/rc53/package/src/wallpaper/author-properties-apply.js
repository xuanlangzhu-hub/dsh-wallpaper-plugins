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

export function inspectTarget(value){
  if(!value||typeof value!=='object')return{ok:false,reason:'none'};
  if(!isSceneId(value.wallpaperId)||!Number.isSafeInteger(value.generation)||value.generation<0||!Number.isSafeInteger(value.hwnd)||value.hwnd<=0||!Number.isSafeInteger(value.pid)||value.pid<=0||!parseIsoStartUtc(value.startUtc)||typeof value.helper!=='string'||!value.helper.endsWith('.exe')||value.stopping)return{ok:false,reason:'invalid'};
  let validLoc=null;
  try{validLoc=validateLocation(value.location);}catch{return{ok:false,reason:'invalid_location'};}
  const normalized={wallpaperId:value.wallpaperId,generation:value.generation,location:validLoc,hwnd:value.hwnd,pid:value.pid,startUtc:value.startUtc,helper:value.helper};
  if(!value.captureStarted)return{ok:false,reason:'capture_pending',target:normalized,value};
  return{ok:true,target:normalized};
}

function matchBoundIdentity(currentRaw, bound){
  if(!currentRaw||typeof currentRaw!=='object')return{match:false,reason:'target_missing'};
  if(currentRaw.session!==bound.session)return{match:false,reason:'session_changed'};
  if(currentRaw.stopping===true)return{match:false,reason:'stopping'};
  if(currentRaw.busy===true)return{match:false,reason:'busy'};
  const inspected=inspectTarget(currentRaw);
  if(inspected.reason==='invalid'||inspected.reason==='none'||inspected.reason==='invalid_location'){
    return{match:false,reason:inspected.reason};
  }
  const t=inspected.target;
  if(!t)return{match:false,reason:'invalid'};
  if(t.wallpaperId!==bound.wallpaperId||t.generation!==bound.generation||t.location!==bound.location){
    return{match:false,reason:'identity_changed'};
  }
  if(t.hwnd!==bound.hwnd||t.pid!==bound.pid||t.helper!==bound.helper||!areStartUtcsEquivalent(t.startUtc,bound.startUtc)){
    return{match:false,reason:'identity_changed'};
  }
  return{match:true,inspected};
}

export function createAuthorApplyAdapter({readTarget,runChild=runAuthorChild,timeoutMs=5000,pollMs=25}={}){
  if(typeof readTarget!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<20||timeoutMs>5000)throw new TypeError('Invalid author apply adapter');
  let active=null,disposed=false;
  const pendingWaiters=new Set();
  const read=()=>target(readTarget());
  return{
    canApply(id,generation){try{const t=read();return!disposed&&!active&&t.wallpaperId===id&&t.generation===generation;}catch{return false;}},
    busy:()=>Boolean(active),
    isBoundTargetCurrent(bound){
      if(!bound||disposed||active)return false;
      const currentRaw=readTarget();
      const check=matchBoundIdentity(currentRaw,bound);
      return check.match&&check.inspected?.ok===true&&currentRaw?.captureStarted===true;
    },
    currentBoundIdentity(){
      const raw=readTarget();
      const inspected=inspectTarget(raw);
      if(!inspected.ok)return null;
      return {...inspected.target,session:raw.session};
    },
    async waitForReady(id,generation,{signal}={}){
      if(disposed)return{ok:false,reason:'disposed'};
      if(signal?.aborted)return{ok:false,reason:'cancelled'};
      if(active)return{ok:false,reason:'busy'};
      const initialRaw=readTarget();
      const initial=inspectTarget(initialRaw);
      if(initial.ok){
        if(initial.target.wallpaperId!==id||initial.target.generation!==generation)return{ok:false,reason:'mismatch'};
        return{ok:true,target:initial.target,boundIdentity:{...initial.target,session:initialRaw.session}};
      }
      if(initial.reason!=='capture_pending')return{ok:false,reason:initial.reason};
      if(initial.target.wallpaperId!==id||initial.target.generation!==generation)return{ok:false,reason:'mismatch'};
      const boundSession=initialRaw.session;
      if(!boundSession||typeof boundSession.onCaptureReady!=='function')return{ok:false,reason:'no_session_subscription'};
      const boundIdentity={...initial.target,session:boundSession};

      return new Promise((resolve,reject)=>{
        let unbind=null,settled=false;
        const waiter={
          abort(reason){
            if(settled)return;
            settle({ok:false,reason:reason??'cancelled'});
          }
        };
        pendingWaiters.add(waiter);

        const settle=(result)=>{
          if(settled)return;settled=true;
          pendingWaiters.delete(waiter);
          try{unbind?.();}catch{}
          unbind=null;
          signal?.removeEventListener('abort',onAbort);
          resolve(result);
        };

        const onAbort=()=>{
          if(settled)return;settled=true;
          pendingWaiters.delete(waiter);
          try{unbind?.();}catch{}
          unbind=null;
          signal?.removeEventListener('abort',onAbort);
          reject(signal?.reason??authorError('author_cancelled'));
        };

        if(signal?.aborted){onAbort();return;}
        if(disposed){settle({ok:false,reason:'disposed'});return;}
        signal?.addEventListener('abort',onAbort,{once:true});

        unbind=boundSession.onCaptureReady(event=>{
          if(settled)return;
          if(disposed){settle({ok:false,reason:'disposed'});return;}
          if(signal?.aborted){onAbort();return;}
          const currentRaw=readTarget();
          const check=matchBoundIdentity(currentRaw,boundIdentity);
          if(!check.match){
            settle({ok:false,reason:check.reason});
            return;
          }
          if(check.inspected.ok&&currentRaw.captureStarted===true){
            settle({ok:true,target:check.inspected.target,boundIdentity});
          }else{
            settle({ok:false,reason:check.inspected.reason});
          }
        });

        if(disposed){settle({ok:false,reason:'disposed'});return;}
        const checkRaw=readTarget();
        const doubleCheck=matchBoundIdentity(checkRaw,boundIdentity);
        if(!doubleCheck.match){
          settle({ok:false,reason:doubleCheck.reason});
          return;
        }
        if(doubleCheck.inspected.ok&&checkRaw.captureStarted===true){
          settle({ok:true,target:doubleCheck.inspected.target,boundIdentity});
        }
      });
    },
    cancel(){active?.controller.abort(authorError('author_apply_cancelled'));},
    dispose(){
      disposed=true;
      this.cancel();
      for(const waiter of [...pendingWaiters]){
        try{waiter.abort('disposed');}catch{}
      }
      pendingWaiters.clear();
      if(!active)return Promise.resolve({ok:true});
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
