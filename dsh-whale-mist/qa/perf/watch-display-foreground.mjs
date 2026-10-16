// Read-only foreground observer. It never activates, moves or closes a window.
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {runHelper} from '../../src/wallpaper/managed-window.js';
const {values}=parseArgs({options:{directory:{type:'string'},helper:{type:'string'},pid:{type:'string'},width:{type:'string'},height:{type:'string'}}});
if(!values.directory||!values.helper||!values.pid)throw new Error('Observer directory/helper/foreground PID required');
const root=resolve(values.directory);const observations=[];
const end=Date.now()+120000;
while(Date.now()<end){
  try{await readFile(join(root,'stop-foreground-monitor'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{const foreground=await runHelper(spawn,values.helper,['--window-foreground'],{timeoutMs:3000});
    observations.push({at:new Date().toISOString(),foreground,valid:foreground.pid===Number(values.pid)&&foreground.width===Number(values.width)&&foreground.height===Number(values.height)});
  }catch(e){observations.push({at:new Date().toISOString(),valid:false,error:e.message});}
  await new Promise(r=>setTimeout(r,5000));
}
await writeFile(join(root,'foreground-observations.json'),JSON.stringify({observerPid:process.pid,observations,
  allObservedValid:observations.length>0&&observations.every(o=>o.valid),caveat:'Five-second polling; intervals between checks are unobserved. Observer is outside plugin target set.'},null,2),{flag:'wx'});
