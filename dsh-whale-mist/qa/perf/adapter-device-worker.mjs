// Separately built QA helper only. Uses the proven two-ticket real-Host queue.
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,isAbsolute,basename} from 'node:path';
import {installHostWorker,helper as acceptedHelper,verifyHelper} from './context-device-worker.mjs';
import {runHelper} from '../../src/wallpaper/managed-window.js';
import {trial,normalizeWindow,verifyWindow} from './probe-mode-device.mjs';

export async function verifyAdapterPlan(root){
  const plan=JSON.parse(await readFile(join(root,'adapter-plan.json'),'utf8'));
  if(plan.kind!=='explicit-adapter-qa'||!isAbsolute(plan.helper)||basename(plan.helper)!=='WallpaperProbeAdapterQa.exe'||
    dirname(plan.helper)!==join(root,'native')||plan.adapters?.length!==2||new Set(plan.adapters.map(a=>a.luid)).size!==2)
    throw new Error('Invalid fixed adapter QA plan');
  for(const a of plan.adapters){
    if(a.software!==false||typeof a.luid!=='string'||! /^-?[0-9]+$/.test(a.luid)||BigInt(a.luid)<-(1n<<63n)||BigInt(a.luid)>=(1n<<63n))throw new Error('Invalid hardware adapter');
  }
  for(const entry of plan.files){
    if(basename(entry.file)!==entry.file)throw new Error('QA artifact filename invalid');
    const actual=createHash('sha256').update(await readFile(join(root,'native',entry.file))).digest('hex').toUpperCase();
    if(actual!==entry.sha256)throw new Error('QA native artifact fingerprint differs');
  }
  await verifyHelper();return plan;
}
export function installAdapterHostWorker(ctx,root){
  const native=args=>runHelper(spawn,acceptedHelper,args);
  installHostWorker(ctx,root,{
    checkHelper:async()=>{const p=await verifyAdapterPlan(root);return {experimentalHelper:p.helper,files:p.files};},
    capture:async({index,window,location,cwd,signal,root:hostOutput})=>{
      const plan=await verifyAdapterPlan(root);const selected=plan.adapters[index];
      if(!selected)throw new Error('Adapter stage missing');
      verifyWindow(normalizeWindow(await native(['--window-status',location])),location,window);
      const result=await trial({helper:plan.helper,root:hostOutput,mode:'pipe',index,window,spawnImpl:spawn,
        env:{...process.env},cwd,signal,timeoutMs:20000,adapterLuid:selected.luid,inspectFrames:true});
      if(result.device.luid!==selected.luid)throw new Error('Actual capture adapter differs from requested LUID');
      verifyWindow(normalizeWindow(await native(['--window-status',location])),location,window);
      return result;
    }
  });
}
