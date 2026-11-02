import {spawn} from 'node:child_process';
import {validateLocation,validateProjectFile,validateSize,newLocation,runHelper,waitForWindow,normalizeWindow,defaultSleep} from './managed-window.js';
import type {HelperSpawn,FindWindows,NormalizedWindow} from './managed-window.js';
const spawning: HelperSpawn=spawn;
const location: string=validateLocation({untrusted:true});
const file: string=validateProjectFile(42);
const fallback={label:'retained'};
const size=validateSize(undefined,fallback);
if(typeof size==='number'){const n:number=size;void n;}else{const s:string=size.label;void s;}
const id:string=newLocation(1700000000000,.5);
const raw:Promise<unknown>=runHelper(spawning,'offline.exe',['--window-find'],{timeoutMs:10});
// A real boundary check is needed before wiring raw helper JSON to the finder contract.
const finder:FindWindows=async args=>{
  const value=await runHelper(spawning,'offline.exe',args);
  if(!Array.isArray(value))throw Error('expected array');
  return value.map((entry:unknown)=>{
    if(!entry||typeof entry!=='object')throw Error('expected record');
    return {...entry,title:'title' in entry?entry.title:undefined};
  });
};
const pending:Promise<NormalizedWindow|null>=waitForWindow(finder,id,{attempts:2,sleep:defaultSleep});
async function consume(){const found=await pending;if(found){const hwnd:number=found.hwnd;const title:unknown=found.title;void [hwnd,title];}}
const record=normalizeWindow({Hwnd:1,Pid:NaN,Title:17,Visible:'kept',Left:{x:1}});
const unvalidated:unknown=record.visible;
const delayed:Promise<unknown>=defaultSleep(1);
void [location,file,raw,consume,unvalidated,delayed];
