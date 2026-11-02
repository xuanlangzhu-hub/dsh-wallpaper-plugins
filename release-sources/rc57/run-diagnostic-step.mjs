import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {requireAuthorization} from './diagnostic-tool-guard.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));requireAuthorization(root);
const modes={environment:'environment',launchDefault:'default',launchDiagnostic:'diagnostic',launchRestored:'restored'};
const label=process.argv[2];if(process.argv.length!==3||!Object.hasOwn(modes,label))throw Error('Invalid diagnostic step');
if(fs.existsSync(path.join(root,label+'-result.json')))throw Error('Step already attempted; inspect retained evidence');
const pwsh='C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
const stdout=fs.openSync(path.join(root,label+'.stdout.log'),'wx'),stderr=fs.openSync(path.join(root,label+'.stderr.log'),'wx');
let finished=false,timedOut=false;const started=Date.now();
const child=spawn(pwsh,['-NoProfile','-NonInteractive','-File',path.join(root,'launch-diagnostic-trial.ps1'),'-Mode',modes[label]],{cwd:root,windowsHide:true,stdio:['ignore',stdout,stderr]});
fs.closeSync(stdout);fs.closeSync(stderr);
// Only stop our helper handle. Never kill the tree: it can now contain DSH.
const timer=setTimeout(()=>{timedOut=true;child.kill();},15000);
const fallback=setTimeout(()=>finish(null,null,false),19000);
function finish(code,signal,exitConfirmed){
 if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);
 const row={label,pid:child.pid,code,signal,exitConfirmed,timedOut,elapsedMs:Date.now()-started,passed:exitConfirmed&&!timedOut&&code===0,hostReady:false,appTerminationAttempted:false};
 fs.writeFileSync(path.join(root,label+'-result.json'),JSON.stringify(row,null,2),{flag:'wx'});console.log(JSON.stringify(row));process.exitCode=row.passed?0:1;
 if(!exitConfirmed)child.unref();
}
child.once('close',(code,signal)=>finish(code,signal,true));child.once('error',()=>finish(null,null,true));
