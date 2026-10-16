// Prepare is file-only. Run requires an installed, actually composed official Host QA plugin.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {runHelper,validateLocation} from '../../src/wallpaper/managed-window.js';
import {SCENES} from '../../src/wallpaper/scenes.js';
import {normalizeWindow,verifyWindow} from './probe-mode-device.mjs';
import {helper,verifyHelper,contextSnapshot,captureBorrowed} from './context-device-worker.mjs';

const pause=ms=>new Promise(resolvePause=>setTimeout(resolvePause,ms));
async function readJson(path){return JSON.parse(await readFile(path,'utf8'));}
async function save(path,data){await writeFile(path,JSON.stringify(data,null,2),{flag:'wx'});}
const native=args=>runHelper(spawn,helper,args);

export async function prepare(root,{packageName='dsh-whale-context-device-qa',workerName='installHostWorker',workerUrl}={}){
  root=resolve(root);await mkdir(root);await mkdir(join(root,'node'));await mkdir(join(root,'host'));await mkdir(join(root,'plugin'));
  const hashes=await verifyHelper();
  const plan={kind:'context-device-qa',root,token:randomUUID(),helper,hashes,createdAt:new Date().toISOString()};
  await save(join(root,'plan.json'),plan);
  const moduleUrl=workerUrl??pathToFileURL(fileURLToPath(new URL('./context-device-worker.mjs',import.meta.url))).href;
  if(!/^dsh-whale-[a-z-]+$/.test(packageName)||!/^\w+$/.test(workerName)||!moduleUrl.startsWith('file:'))throw new Error('Local QA entry required');
  await writeFile(join(root,'plugin','index.js'),`import {${workerName}} from ${JSON.stringify(moduleUrl)};\nexport function apply(ctx){${workerName}(ctx,${JSON.stringify(root)});}\n`,{flag:'wx'});
  await writeFile(join(root,'plugin','cordis.patch.yml'),`- insert:\n    - id: ${packageName}\n      name: ${packageName}\n`,{flag:'wx'});
  await save(join(root,'plugin','package.json'),{name:packageName,version:`0.0.1-qa.${Date.now()}`,private:true,type:'module',
    description:'Local supervised context diagnostic; no theme or window ownership',main:'./index.js',
    exports:{'.':'./index.js','./cordis.patch.yml':'./cordis.patch.yml'},dsh:{bundle:{patch:'./cordis.patch.yml'}},files:['index.js','cordis.patch.yml']});
  console.log(JSON.stringify({prepared:root,plugin:join(root,'plugin'),note:'No window created. Local QA imports fixed workspace module; not a portable release.'}));
  return plan;
}

export async function run(root,signal,{nativeCall=native,capture=captureBorrowed,checkHelper=verifyHelper,
  delay=pause,warmupMs=2000,responseTimeoutMs=35000,stages=['node-1','host-1','host-2','node-2'],reportKind='context-device-only'}={}){
  if(![['node-1','host-1','host-2','node-2'],['host-1','host-2']].some(s=>JSON.stringify(s)===JSON.stringify(stages)))throw new Error('Unsupported bounded QA sequence');
  root=resolve(root);const plan=await readJson(join(root,'plan.json'));if(plan.root!==root||plan.kind!=='context-device-qa')throw new Error('Invalid plan');
  // wx prevents rerunning against existing tickets/ownership after a failure.
  await save(join(root,'controller.json'),{...contextSnapshot(),startedAt:Date.now()});
  await checkHelper();
  const host=await readJson(join(root,'host-ready.json'));
  if(!host.snapshot.electron||host.snapshot.environment.ELECTRON_RUN_AS_NODE!=='1')throw new Error('Formal Host readiness not proven');
  console.log(`Actual Host ready: PID ${host.snapshot.pid}, ${host.snapshot.execPath}`);
  const location=validateLocation(`WhaleWallpaperProbe-context-${Date.now()}-${randomUUID().slice(0,8)}`);
  const results=[];const pending=new Set();let window=null,claimed=false,failure=null,cleanup=null;
  const cancelled=()=>{if(signal.aborted)throw new Error('Cancelled');};
  const waitResponse=async(index,ms,ignoreCancel=false)=>{
    const end=Date.now()+ms;
    while(Date.now()<end){
      if(!ignoreCancel)cancelled();
      try{const response=await readJson(join(root,`response-${index}.json`));
        if(response.index!==index||response.snapshot.pid!==host.snapshot.pid||response.childClosed!==true)throw new Error('Host response identity invalid');
        pending.delete(index);return response;
      }catch(error){if(error.code!=='ENOENT')throw error;}
      await delay(200);
    }
    throw new Error(`No confirmed Host completion for request ${index}`);
  };
  try{
    cancelled();claimed=true;await save(join(root,'ownership.json'),{location,controllerPid:process.pid});
    await nativeCall(['--we-open',location,SCENES.lucy.project,'1280','720','--initial-offscreen']);
    for(let i=0;i<20;i++){
      cancelled();const matches=(await nativeCall(['--window-find'])).map(normalizeWindow).filter(w=>w.title===location);
      if(matches.length>1)throw new Error('Ambiguous source');
      if(matches.length){window=matches[0];break;}await delay(250);
    }
    verifyWindow(window,location);await save(join(root,'source.json'),window);await delay(warmupMs);
    for(const stage of stages){
      cancelled();console.log(`Capturing ${stage} (8 seconds, pipe)`);
      const [role,label]=stage.split('-');const index=Number(label);
      if(role==='node'){
        const result=await capture({root:join(root,'node'),index:index-1,window,location,cwd:process.cwd(),signal});
        results.push({stage,context:contextSnapshot(),result});
      }else{
        // cwd, argv and streams align; inherited environments intentionally remain contextual.
        pending.add(index);
        await save(join(root,`request-${index}.json`),{token:plan.token,index,expiresAt:Date.now()+60000,window,location,cwd:process.cwd()});
        const response=await waitResponse(index,responseTimeoutMs);
        if(response.error||!response.result)throw new Error(response.error??'Missing Host result');
        results.push({stage,context:response.snapshot,result:response.result});
      }
    }
  }catch(error){failure=error.message;}
  finally{
    if(pending.size){
      await writeFile(join(root,'STOP'),'stop',{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      for(const index of [...pending]){try{await waitResponse(index,responseTimeoutMs,true);}catch(error){failure??=error.message;}}
    }
    if(claimed&&pending.size===0){
      try{const args=['--window-ensure-closed',location,'10000'];if(window)args.push('--expect-pid',String(window.pid));
        cleanup=await nativeCall(args);if(cleanup.closed!==true)failure??='Source cleanup unconfirmed';
      }catch(error){cleanup={closed:false,error:error.message};failure??=error.message;}
    }else if(claimed){cleanup={closed:false,error:'Host completion unconfirmed; source retained to avoid closing an active borrowed capture'};}
    await save(join(root,'report.json'),{kind:reportKind,location,window,results,failure,cleanup,
      complete:results.length===stages.length&&!failure&&cleanup?.closed===true,
      caveat:reportKind==='explicit-adapter-compatibility-only'?'Two selected-adapter capture trials only; not complete background playback cost or a GPU recommendation.':
        'Contexts aggregate parent identity/runtime and inherited environment; differences do not identify a particular variable. QA capture is not formal background playback.'});
  }
  if(failure)throw new Error(failure);
  console.log(JSON.stringify({complete:true,devices:results.map(r=>({stage:r.stage,...r.result.device})),cleanup}));
}

async function main(){
  const {values}=parseArgs({options:{prepare:{type:'boolean'},run:{type:'boolean'},root:{type:'string'}}});
  if(!values.root||values.prepare===values.run)throw new Error('Choose --prepare or --run and an explicit --root');
  if(values.prepare){await prepare(values.root);return;}
  const controller=new AbortController();const abort=()=>controller.abort();process.on('SIGINT',abort);process.on('SIGTERM',abort);
  const timer=setInterval(()=>readFile(join(resolve(values.root),'STOP')).then(abort,()=>{}),100);
  try{await run(values.root,controller.signal);}finally{clearInterval(timer);process.off('SIGINT',abort);process.off('SIGTERM',abort);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
