// Local supervised QA only. The worker borrows a controller-owned source; it never closes it.
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runHelper,validateLocation} from '../../src/wallpaper/managed-window.js';
import {normalizeWindow,verifyWindow,trial} from './probe-mode-device.mjs';

export const helper=fileURLToPath(new URL('../../assets/wallpaper/WallpaperProbe.exe',import.meta.url));
const fingerprints={exe:'F172D2BC60701ADB4479E2E12EE296799F149B09B80C3EE3B5731F5EA30AE117',dll:'D7353A75665DCCD9D6263C10FE3CFC18D176572EBBE0AED2B4A1691D5DF39968'};
export function contextSnapshot(){
  return {pid:process.pid,ppid:process.ppid,execPath:process.execPath,cwd:process.cwd(),
    node:process.versions.node,electron:process.versions.electron??null,
    environment:Object.fromEntries(['ELECTRON_RUN_AS_NODE','DSH_DESKTOP_NODE_EXECUTABLE','WM_WALLPAPER_OFFSCREEN_START','WM_CONTRACT_ISOLATED'].map(key=>[key,process.env[key]??null]))};
}
export async function verifyHelper(){
  const actual={};
  for(const [key,path] of Object.entries({exe:helper,dll:join(resolve(helper,'..'),'WallpaperProbe.dll')})){
    actual[key]=createHash('sha256').update(await readFile(path)).digest('hex').toUpperCase();
    if(actual[key]!==fingerprints[key])throw new Error(`Helper ${key} fingerprint mismatch`);
  }
  return actual;
}
export function validateTicket(ticket,plan,index,now=Date.now()){
  if(![1,2].includes(index)||ticket.index!==index||ticket.token!==plan.token||
    !Number.isFinite(ticket.expiresAt)||ticket.expiresAt<now||ticket.expiresAt>now+120000)
    throw new Error('Unarmed, stale or invalid context ticket');
  validateLocation(ticket.location);verifyWindow(ticket.window,ticket.location);
  if(ticket.window.title!==ticket.location)throw new Error('Ticket source mismatch');
  if(typeof ticket.cwd!=='string'||!ticket.cwd)throw new Error('Missing controlled cwd');
}
export async function captureBorrowed({root,index,window,location,cwd,signal,spawnImpl=spawn,nativeCall=args=>runHelper(spawn,helper,args)}){
  verifyWindow(window,location);
  verifyWindow(normalizeWindow(await nativeCall(['--window-status',location])),location,window);
  const result=await trial({helper,root,mode:'pipe',index,window,spawnImpl,env:{...process.env},cwd,signal,timeoutMs:20000});
  verifyWindow(normalizeWindow(await nativeCall(['--window-status',location])),location,window);
  return result;
}

export function installHostWorker(ctx,root,{capture=captureBorrowed,describe=contextSnapshot,platform=process.platform,checkHelper=verifyHelper}={}){
  // apply never opens a source or starts capture without a fresh controller ticket.
  const snapshot=describe();
  if(platform!=='win32'||basename(snapshot.execPath).toLowerCase()!=='deepseek harness.exe'||snapshot.environment.ELECTRON_RUN_AS_NODE!=='1')
    throw new Error('Actual official Desktop Host required');
  let busy=false,disposed=false,active=null,timer;const handled=new Set();
  const deadline=Date.now()+10*60000;
  const ready=(async()=>{
    const plan=JSON.parse(await readFile(join(root,'plan.json'),'utf8'));
    if(plan.kind!=='context-device-qa'||plan.root!==root)throw new Error('Invalid local plan');
    const hashes=await checkHelper();
    await writeFile(join(root,'host-ready.json'),JSON.stringify({snapshot,hashes,readyAt:Date.now()},null,2),{flag:'wx'});
    return plan;
  })();
  ready.catch(error=>{clearInterval(timer);console.warn('[Whale context QA]',error.message);});
  const poll=async()=>{
    if(busy||disposed)return;
    if(Date.now()>deadline){clearInterval(timer);return;}
    busy=true;
    try{
      const plan=await ready;
      for(const index of [1,2]){
        if(handled.has(index))continue;
        let ticket;
        try{ticket=JSON.parse(await readFile(join(root,`request-${index}.json`),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
        validateTicket(ticket,plan,index);
        try{await writeFile(join(root,`claim-${index}.json`),JSON.stringify({pid:snapshot.pid,index,at:Date.now()}),{flag:'wx'});}catch(error){if(error.code==='EEXIST'){handled.add(index);continue;}throw error;}
        handled.add(index);
        active=new AbortController();let stopTimer;
        let result=null,error=null;
        try{
          stopTimer=setInterval(()=>readFile(join(root,'STOP')).then(()=>active?.abort(),()=>{}),100);
          if(disposed)active.abort();
          try{await readFile(join(root,'STOP'));active.abort();}catch(stopError){if(stopError.code!=='ENOENT')throw stopError;}
          result=await capture({root:join(root,'host'),index:index-1,window:ticket.window,location:ticket.location,cwd:ticket.cwd,signal:active.signal});
        }catch(failure){error=failure.message;}
        finally{clearInterval(stopTimer);active=null;}
        // captureBorrowed awaits child close before returning or throwing.
        await writeFile(join(root,`response-${index}.json`),JSON.stringify({index,snapshot,result,error,childClosed:true},null,2),{flag:'wx'});
      }
      if(handled.size===2)clearInterval(timer);
    }catch(error){console.warn('[Whale context QA]',error.message);}
    finally{busy=false;}
  };
  timer=setInterval(poll,250);timer.unref();
  ctx.on('dispose',()=>{disposed=true;clearInterval(timer);active?.abort();});
}
