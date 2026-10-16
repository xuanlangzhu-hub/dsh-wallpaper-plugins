import {readFile,writeFile,readdir,cp} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {prepare,run} from './probe-context-device.mjs';
import {verifyAdapterPlan} from './adapter-device-worker.mjs';

async function prepareAdapter(root,buildRoot){
  root=resolve(root);buildRoot=resolve(buildRoot);
  const built=JSON.parse(await readFile(join(buildRoot,'build-result.json'),'utf8'));
  if(!built.acceptedUnchanged)throw new Error('Build preservation missing');
  for(const entry of built.outputHashes){
    if(createHash('sha256').update(await readFile(entry.file)).digest('hex').toUpperCase()!==entry.sha256)throw new Error('Built helper fingerprint differs');
  }
  await prepare(root,{packageName:'dsh-whale-adapter-device-qa',workerName:'installAdapterHostWorker',workerUrl:new URL('./adapter-device-worker.mjs',import.meta.url).href});
  await cp(join(buildRoot,'native'),join(root,'native'),{recursive:true,errorOnExist:true,force:false});
  const files=await Promise.all((await readdir(join(root,'native'))).map(async file=>({file,sha256:createHash('sha256').update(await readFile(join(root,'native',file))).digest('hex').toUpperCase()})));
  const helper=join(root,'native','WallpaperProbeAdapterQa.exe');
  // Read-only fresh enumeration; no wallpaper/window is created.
  const inventory=await new Promise((res,rej)=>{
    const child=spawn(helper,['--qa-list-adapters'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',error='';
    child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>error+=b);child.once('error',rej);
    child.once('close',code=>{if(code!==0){rej(new Error(error||'Adapter inventory failed'));return;}try{res(JSON.parse(out));}catch(e){rej(e);}});
  });
  const hardware=inventory.filter(a=>!a.software);const adapters=[];
  for(const vendorId of [32902,4318]){const matches=hardware.filter(a=>a.vendorId===vendorId);if(matches.length!==1)throw new Error('Expected one Intel and one NVIDIA hardware adapter for this local QA');adapters.push(matches[0]);}
  await writeFile(join(root,'adapter-plan.json'),JSON.stringify({kind:'explicit-adapter-qa',helper,files,adapters,inventory,buildRoot,
    scope:'Two real-Host 8-second pipe captures; compatibility only, not complete playback cost.'},null,2),{flag:'wx'});
  await verifyAdapterPlan(root);console.log(JSON.stringify({prepared:root,adapters,windowOpened:false}));
}
async function main(){
  const {values}=parseArgs({options:{prepare:{type:'boolean'},run:{type:'boolean'},root:{type:'string'},build:{type:'string'}}});
  if(!values.root||values.prepare===values.run)throw new Error('Choose --prepare or --run with --root');
  if(values.prepare){if(!values.build)throw new Error('QA build root required');await prepareAdapter(values.root,values.build);return;}
  const controller=new AbortController();const abort=()=>controller.abort();process.on('SIGINT',abort);process.on('SIGTERM',abort);
  const root=resolve(values.root);const timer=setInterval(()=>readFile(join(root,'STOP')).then(abort,()=>{}),100);
  try{await verifyAdapterPlan(root);await run(root,controller.signal,{checkHelper:()=>verifyAdapterPlan(root),stages:['host-1','host-2'],reportKind:'explicit-adapter-compatibility-only'});}
  finally{clearInterval(timer);process.off('SIGINT',abort);process.off('SIGTERM',abort);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
