// File-only package/collector preparation. Does not install, open windows or start capture.
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url));const repo=resolve(here,'../../..');const plugin=resolve(here,'../..');
const {values}=parseArgs({options:{root:{type:'string'},nativeRoot:{type:'string'}}});
if(!values.root||!values.nativeRoot)throw new Error('--root <new-dir> --nativeRoot <prepared-adapter-root> required');
const root=resolve(values.root);await mkdir(root);const staged=join(root,'package');await mkdir(staged);
const nativeRoot=resolve(values.nativeRoot);
for(const file of ['plan.json','adapter-plan.json']){
  const plan=JSON.parse(await readFile(join(nativeRoot,file),'utf8'));
  if(file==='plan.json'){plan.root=root;plan.token=randomUUID();}
  else plan.helper=join(root,'native','WallpaperProbeAdapterQa.exe');
  await writeFile(join(root,file),JSON.stringify(plan,null,2),{flag:'wx'});
}
await cp(join(nativeRoot,'native'),join(root,'native'),{recursive:true,force:false,errorOnExist:true});
// LUIDs are session identities: rebuild the local plan from a fresh read-only inventory.
const inventory=await new Promise((res,rej)=>{
  const c=spawn(join(root,'native','WallpaperProbeAdapterQa.exe'),['--qa-list-adapters'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';
  c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>err+=b);c.once('error',rej);
  c.once('close',code=>{if(code!==0){rej(new Error(err||'Inventory failed'));return;}try{res(JSON.parse(out));}catch(e){rej(e);}});
});
const adapterPlan=JSON.parse(await readFile(join(root,'adapter-plan.json'),'utf8'));
adapterPlan.inventory=inventory;adapterPlan.adapters=[32902,4318].map(vendorId=>{
  const matches=inventory.filter(a=>a.vendorId===vendorId&&!a.software);if(matches.length!==1)throw new Error('Expected one Intel and one NVIDIA adapter');return matches[0];
});
await writeFile(join(root,'adapter-plan.json'),JSON.stringify(adapterPlan,null,2));
for(const name of ['src','assets'])await cp(join(plugin,name),join(staged,name),{recursive:true,force:false,errorOnExist:true});
for(const name of ['README.md','cordis.patch.yml'])await cp(join(plugin,name),join(staged,name),{force:false,errorOnExist:true});
const pkg=JSON.parse(await readFile(join(plugin,'package.json'),'utf8'));pkg.version=`0.6.0-rc.24-qa.${Date.now()}`;
await writeFile(join(staged,'package.json'),JSON.stringify(pkg,null,2),{flag:'wx'});
let index=await readFile(join(staged,'src','index.js'),'utf8');
const anchor='registerWallpaperRoutes(ctx, resources);';if(index.split(anchor).length!==2)throw new Error('Host route anchor changed');
const worker=new URL('./display-cost-session.mjs',import.meta.url).href;
index=`import { registerDisplayCost } from ${JSON.stringify(worker)};\n`+index.replace(anchor,
  `registerDisplayCost(ctx, resources, ${JSON.stringify(root)}, { registerRoutes: registerWallpaperRoutes, createSession: createPreviewSession });`);
index=index.replace('registerWallpaperRoutes, resolveHostResources','createPreviewSession, registerWallpaperRoutes, resolveHostResources');
await writeFile(join(staged,'src','index.js'),index);

const oldCollector=join(repo,'.tmp','capture-gpu-align-20261010-100812','measure-phase.ps1');
let collector=await readFile(oldCollector,'utf8');
function change(from,to){if(collector.split(from).length!==2)throw new Error('Collector anchor changed: '+from);collector=collector.replace(from,to);}
change("[ValidateSet('A0','B','C','D','A1')]","[ValidateSet('N1','I1','I2','N2')]");
change("$helper='C:\\Users\\HP\\.dsh\\profiles\\desktop\\node_modules\\dsh-whale-mist\\assets\\wallpaper\\WallpaperProbe.exe'",
  `$helper='${join(root,'native','WallpaperProbeAdapterQa.exe').replaceAll("'","''")}'`);
if(collector.split("'WallpaperProbe.dll'").length!==4)throw new Error('Capture DLL fingerprint anchors changed');
collector=collector.replaceAll("'WallpaperProbe.dll'","'WallpaperProbeAdapterQa.dll'");
change("-Seconds 45 -IntervalMs 1000","-Seconds 60 -IntervalMs 1000");
change("captureMode=if($Phase -eq 'C'){'memory'}elseif($Phase -eq 'D'){'pipe'}else{$null}","captureMode='pipe'");
const sampleStart="$start=(Get-Date).ToString('o')";
change(sampleStart,`${sampleStart}
$observerScript='${join(here,'watch-display-foreground.mjs').replaceAll("'","''")}'
$observerNode=(Get-Command node -ErrorAction Stop).Source
$observerArgs=@('"'+$observerScript+'"','--directory','"'+$phaseDir+'"','--helper','"'+$helper+'"','--pid',[string]$before.foreground.pid,'--width',[string]$before.foreground.width,'--height',[string]$before.foreground.height)
$observer=Start-Process -FilePath $observerNode -ArgumentList $observerArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $phaseDir 'foreground-monitor.stdout.log') -RedirectStandardError (Join-Path $phaseDir 'foreground-monitor.stderr.log')
try {`);
change("if(-not (Test-Path -LiteralPath (Join-Path $phaseDir 'sample.json'))){throw 'Sampler did not produce a report'}",`if(-not (Test-Path -LiteralPath (Join-Path $phaseDir 'sample.json'))){throw 'Sampler did not produce a report'}
} finally {
  'stop' | Set-Content -LiteralPath (Join-Path $phaseDir 'stop-foreground-monitor')
  if(-not $observer.WaitForExit(12000)){$observer.Kill();throw 'Foreground observer did not finish'}
}
$foregroundObserved=Get-Content -LiteralPath (Join-Path $phaseDir 'foreground-observations.json') -Raw | ConvertFrom-Json`);
change("identityStable=$report.summary.identityStable}","identityStable=$report.summary.identityStable;foregroundObserved=$foregroundObserved}");
collector += `\n# QA labels refer to same displayed chain; per-process engine metrics are not whole-GPU totals.\n`;
await writeFile(join(root,'measure-phase.ps1'),collector,{flag:'wx'});
await writeFile(join(root,'order.json'),JSON.stringify({order:['N1','I1','I2','N2'],warmupSeconds:30,sampleBudgetSeconds:60,safetyCaptureSeconds:300,
  sourcePolicy:'Fresh same-project source per phase, normal ownership/cleanup; not identical HWND.',gpuPolicy:'Wallpaper Engine settings unchanged; only capture adapter differs.'},null,2),{flag:'wx'});
const fingerprints=await Promise.all(['src/client.js','src/wallpaper/session.js'].map(async file=>({file,source:createHash('sha256').update(await readFile(join(plugin,file))).digest('hex'),staged:createHash('sha256').update(await readFile(join(staged,file))).digest('hex')})));
if(fingerprints.some(f=>f.source!==f.staged))throw new Error('Accepted renderer/session changed');
await writeFile(join(root,'prepare-result.json'),JSON.stringify({root,version:pkg.version,fingerprints,originalUnchanged:true},null,2),{flag:'wx'});
console.log(JSON.stringify({prepared:root,packageDirectory:staged,version:pkg.version,windowsOpened:false}));
