// Supervised device-choice diagnostic only. No imports or default invocation start a window.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {StringDecoder} from 'node:string_decoder';
import {parseArgs} from 'node:util';
import {runHelper,validateLocation} from '../../src/wallpaper/managed-window.js';
import {SCENES} from '../../src/wallpaper/scenes.js';
import {FrameDecoder} from '../../src/wallpaper/frame-protocol.js';

const here=dirname(fileURLToPath(import.meta.url));
const HELPER=resolve(here,'../../assets/wallpaper/WallpaperProbe.exe');
const HASHES={exe:'F172D2BC60701ADB4479E2E12EE296799F149B09B80C3EE3B5731F5EA30AE117',
  dll:'D7353A75665DCCD9D6263C10FE3CFC18D176572EBBE0AED2B4A1691D5DF39968'};
const modes=['memory','pipe','pipe','memory'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
// Native find uses camelCase; status serializes the same record with PascalCase.
export function normalizeWindow(raw){
  if(!raw)return raw;
  return {...raw,title:raw.title??raw.Title,hwnd:raw.hwnd??raw.Hwnd,pid:raw.pid??raw.Pid,
    visible:raw.visible??raw.Visible,iconic:raw.iconic??raw.Iconic,cloaked:raw.cloaked??raw.Cloaked};
}
export function verifyWindow(window,location,expected){
  if(!window||window.title!==location||!Number.isSafeInteger(window.hwnd)||window.hwnd<=0||!Number.isInteger(window.pid)||window.pid<=0)
    throw new Error('Source identity missing or ambiguous');
  if(expected&&(window.hwnd!==expected.hwnd||window.pid!==expected.pid))throw new Error('Source identity changed');
  if(!window.visible||window.iconic||window.cloaked)throw new Error('Source is not capture-ready');
}

export async function trial({helper,root,mode,index,window,spawnImpl,env,cwd,signal,timeoutMs,adapterLuid,inspectFrames=false}){
  if(adapterLuid!==undefined&&(typeof adapterLuid!=='string'||! /^-?[0-9]+$/.test(adapterLuid)||BigInt(adapterLuid)<-(1n<<63n)||BigInt(adapterLuid)>=(1n<<63n)))
    throw new Error('QA adapter LUID must be a signed 64-bit decimal string');
  if(inspectFrames&&mode!=='pipe')throw new Error('Frame inspection requires pipe mode');
  const output=join(root,`${index+1}-${mode}`);await mkdir(output);
  const argv=[String(window.hwnd),output,'8','30',mode,'--echo-on-stderr',...(adapterLuid===undefined?[]:['--qa-adapter-luid',adapterLuid])];
  let child,closed=false,stdoutBytes=0,stderr='',pending='',parseError=null;
  let decodedFrames=0,firstFrame=null,lastFrame=null;
  const frameDecoder=inspectFrames?new FrameDecoder(frame=>{
    const sample={sequence:frame.sequence,width:frame.width,height:frame.height,jpeg:Buffer.from(frame.jpeg)};
    if(sample.jpeg[0]!==255||sample.jpeg[1]!==216||sample.jpeg.at(-2)!==255||sample.jpeg.at(-1)!==217)throw new Error('Invalid JPEG frame markers');
    decodedFrames++;firstFrame??=sample;lastFrame=sample;
  }):null;
  const decoder=new StringDecoder('utf8');const devices=[];const logErrors=[];
  const consume=text=>{
    pending+=text;
    if(pending.length>32768){parseError=new Error('Diagnostic line exceeded limit');pending='';return;}
    let end;
    while((end=pending.indexOf('\n'))>=0){
      const line=pending.slice(0,end).trim();pending=pending.slice(end+1);if(!line)continue;
      try{const entry=JSON.parse(line);
        if(entry.level==='error')logErrors.push(entry.message);
        if(entry.kind==='log'&&typeof entry.message==='string'&&entry.message.startsWith('{')){
          const payload=JSON.parse(entry.message);
          if(typeof payload.adapter==='string'&&typeof payload.luid==='string'&&Number.isInteger(payload.vendorId))devices.push(payload);
        }
      }catch{parseError=new Error('Unparseable diagnostic line');}
    }
  };
  let timer,abortListener,timedOut=false,aborted=false,spawnError=null,forceTimer,finished;
  const requestStop=()=>{
    if(closed)return;
    void writeFile(join(output,'stop.txt'),'stop',{flag:'wx'}).catch(()=>{});
    if(mode==='pipe'&&!child.stdin.destroyed)child.stdin.write('stop\n',()=>{});
    if(!forceTimer)forceTimer=setTimeout(()=>{if(!closed)child.kill();},7000);
  };
  try{
    if(signal?.aborted)throw new Error('Experiment cancelled before spawn');
    child=spawnImpl(helper,argv,{windowsHide:true,stdio:['pipe','pipe','pipe'],env,cwd});
    finished=new Promise(resolveClose=>{
      child.on('error',error=>{spawnError=error;});
      child.once('close',(code,exitSignal)=>{closed=true;resolveClose({code,exitSignal});});
      child.stdout.on('data',chunk=>{stdoutBytes+=chunk.length; // Always drain binary pipe output.
        if(frameDecoder)try{frameDecoder.push(chunk);}catch(error){parseError=error;requestStop();}
      });
      child.stdout.on('error',error=>{parseError=error;requestStop();});
      child.stderr.on('data',chunk=>{
        const text=decoder.write(chunk);stderr=(stderr+text).slice(-131072);consume(text);
      });
      child.stderr.on('error',error=>{parseError=error;requestStop();});
      child.stdin.on('error',()=>{});
    });
    timer=setTimeout(()=>{timedOut=true;requestStop();},timeoutMs);
    abortListener=()=>{aborted=true;requestStop();};signal?.addEventListener('abort',abortListener,{once:true});
    if(signal?.aborted)abortListener();
    const exit=await finished;consume(decoder.end());if(pending.trim())consume('\n');
    if(frameDecoder)try{frameDecoder.finish();}catch(error){parseError=error;}
    const frameEvidence=frameDecoder?{decodedFrames,first:firstFrame?{sequence:firstFrame.sequence,width:firstFrame.width,height:firstFrame.height}:null,
      last:lastFrame?{sequence:lastFrame.sequence,width:lastFrame.width,height:lastFrame.height}:null}:undefined;
    if(firstFrame)await writeFile(join(output,'first-frame.jpg'),firstFrame.jpeg,{flag:'wx'});
    if(lastFrame)await writeFile(join(output,'last-frame.jpg'),lastFrame.jpeg,{flag:'wx'});
    const result={index:index+1,mode,pid:child.pid??null,parentPid:process.pid,argv,cwd,stdoutBytes,exit,...(devices.length===1?{device:devices[0]}:{}),
      ...(adapterLuid===undefined?{}:{requestedAdapterLuid:adapterLuid}),
      ...(frameEvidence?{frameEvidence}:{}),
      diagnosticDeviceCount:devices.length,timedOut,aborted,logErrors};
    await writeFile(join(output,'stderr.log'),stderr,{flag:'wx'});
    await writeFile(join(output,'controller-trial.json'),JSON.stringify(result,null,2),{flag:'wx'});
    if(spawnError)throw spawnError;
    if(timedOut||aborted||signal?.aborted)throw new Error(timedOut?'Trial watchdog expired':'Experiment cancelled');
    if(exit.code!==0||exit.exitSignal)throw new Error(`Trial exited unsuccessfully: ${exit.code}/${exit.exitSignal}`);
    if(parseError)throw parseError;
    if(frameDecoder&&!decodedFrames)throw new Error('No decoded pipe frames');
    if(devices.length!==1||logErrors.length)throw new Error('Missing/ambiguous device or native error');
    const summary=JSON.parse(await readFile(join(output,'summary.json'),'utf8'));
    if(summary.reason!=='duration'||summary.frames<1)throw new Error(`Trial ended early: ${summary.reason}`);
    return {...result,summary};
  }finally{
    clearTimeout(timer);signal?.removeEventListener('abort',abortListener);
    if(child&&!closed){requestStop();if(finished)await finished;}
    clearTimeout(forceTimer);
    if(child&&!child.stdin.destroyed)child.stdin.end();
  }
}

export async function runModeExperiment({outputRoot,helper=HELPER,project=SCENES.lucy.project,
  location=validateLocation(`WhaleWallpaperProbe-mode-${Date.now()}-${randomUUID().slice(0,8)}`),
  nativeCall=args=>runHelper(spawn,helper,args),spawnImpl=spawn,signal,timeoutMs=20000,warmupMs=2000}){
  validateLocation(location);
  const root=resolve(outputRoot);await mkdir(root); // Existing evidence is never overwritten.
  const env={...process.env},cwd=process.cwd();let claimed=false,window=null,failure=null,cleanup=null;
  const trials=[];
  await writeFile(join(root,'ownership.json'),JSON.stringify({location,controllerPid:process.pid,helper,project,claimed:false},null,2),{flag:'wx'});
  try{
    if(signal?.aborted)throw new Error('Experiment cancelled');
    claimed=true;await writeFile(join(root,'claimed.json'),JSON.stringify({location,controllerPid:process.pid},null,2),{flag:'wx'});
    await nativeCall(['--we-open',location,project,'1280','720','--initial-offscreen']);
    for(let i=0;i<20;i++){
      if(signal?.aborted)throw new Error('Experiment cancelled');
      const matches=(await nativeCall(['--window-find'])).map(normalizeWindow).filter(w=>w.title===location);
      if(matches.length>1)throw new Error('Ambiguous source');
      if(matches.length===1){window=matches[0];break;}
      await pause(250);
    }
    verifyWindow(window,location);
    await writeFile(join(root,'source.json'),JSON.stringify(window,null,2),{flag:'wx'});
    await pause(warmupMs);
    for(const [index,mode] of modes.entries()){
      if(signal?.aborted)throw new Error('Experiment cancelled');
      verifyWindow(normalizeWindow(await nativeCall(['--window-status',location])),location,window);
      const result=await trial({helper,root,mode,index,window,spawnImpl,env,cwd,signal,timeoutMs});
      verifyWindow(normalizeWindow(await nativeCall(['--window-status',location])),location,window);
      trials.push(result);
      console.log(`trial ${index+1} ${mode}: ${result.device.adapter}, LUID=${result.device.luid}`);
    }
  }catch(error){failure=error.message;}
  finally{
    if(claimed){
      try{
        const args=['--window-ensure-closed',location,'10000'];if(window)args.push('--expect-pid',String(window.pid));
        cleanup=await nativeCall(args);
        if(cleanup.closed!==true)failure??='Owned source closure not confirmed';
      }catch(error){cleanup={closed:false,error:error.message};failure??=error.message;}
    }
    const report={kind:'device-selection-only',controllerPid:process.pid,helper,project,location,cwd,
      environmentPolicy:'One captured environment object; values not logged',window,trials,cleanup,failure,
      complete:trials.length===4&&cleanup?.closed===true&&failure===null,
      sameDevice:trials.length===4?new Set(trials.map(t=>t.device.luid)).size===1:null,
      caveat:'Ordinary Node context only; does not isolate formal Electron Host or rule out mode/context interaction.'};
    await writeFile(join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  }
  if(failure)throw new Error(failure);
  return JSON.parse(await readFile(join(root,'report.json'),'utf8'));
}

async function main(){
  const {values}=parseArgs({options:{run:{type:'boolean'},output:{type:'string'}},allowPositionals:false});
  if(!values.run||!values.output)throw new Error('Explicit --run --output <new-directory> required after user confirms convenient');
  const fingerprints={};
  for(const [key,file] of Object.entries({exe:HELPER,dll:join(dirname(HELPER),'WallpaperProbe.dll')})){
    fingerprints[key]=createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase();
    if(fingerprints[key]!==HASHES[key])throw new Error(`Accepted ${key} fingerprint differs`);
  }
  const controller=new AbortController();let stop=false;
  const abort=()=>controller.abort();process.on('SIGINT',abort);process.on('SIGTERM',abort);
  const stopper=setInterval(async()=>{
    if(stop)return;
    try{await readFile(join(resolve(values.output),'STOP'));stop=true;controller.abort();}catch{}
  },250);
  try{
    const report=await runModeExperiment({outputRoot:values.output,signal:controller.signal});
    await writeFile(join(resolve(values.output),'fingerprints.json'),JSON.stringify({fingerprints,node:process.version},null,2),{flag:'wx'});
    console.log(JSON.stringify({complete:report.complete,sameDevice:report.sameDevice,cleanup:report.cleanup,output:resolve(values.output)}));
  }finally{clearInterval(stopper);process.off('SIGINT',abort);process.off('SIGTERM',abort);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
