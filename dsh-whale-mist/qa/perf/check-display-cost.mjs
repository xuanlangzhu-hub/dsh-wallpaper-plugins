// Exercise the QA wrapper with fake sessions/processes; never start real windows.
import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createDisplayCostFactory,costCaptureArgs} from './display-cost-session.mjs';
const base=resolve('dsh-whale-mist/.tmp/perf');await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'display-cost-check-'));
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,ok:true});console.log('PASS',name);}catch(e){checks.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
const helper='F:\\fake\\WallpaperProbeAdapterQa.exe';
const plan={helper,adapters:[{luid:'103941',description:'Intel'},{luid:'105141',description:'NVIDIA'}]};
async function fixture(name){
  const dir=join(root,name);await mkdir(dir);await writeFile(join(dir,'plan.json'),JSON.stringify({token:'fixed'}));
  const spawns=[];const children=[];
  const factory=createDisplayCostFactory({root:dir,verify:async()=>plan,describe:()=>({pid:99}),
    spawnImpl:(file,args,options)=>{spawns.push({file,args,options});const c=new EventEmitter();c.pid=42+spawns.length;children.push(c);return c;},
    createSession:options=>{
      let child;return {
        async create(config){child=options.spawnChild(config.helper,['88',config.output,'--forever','30','pipe','--owned-location','WhaleWallpaperProbe-fixture'],{windowsHide:true,stdio:['pipe','pipe','pipe']});return {};},
        async stop(){if(child){const c=child;child=null;setTimeout(()=>c.emit('close',0,null),10);}return {closed:true,outcome:'closed'};},
        report:()=>({window:{location:'WhaleWallpaperProbe-fixture'},failure:null})
      };
    }});
  const arm=async(label,change={})=>writeFile(join(dir,`${label}-armed.json`),JSON.stringify({label,token:'fixed',expiresAt:Date.now()+60000,...change}));
  const start=async()=>{const session=factory({});await session.create({helper:'original.exe',output:dir,scene:{mode:'daily'}});return session;};
  return {dir,spawns,children,arm,start,factory};
}
await check('Only duration and explicit adapter are added to the accepted capture argv',async()=>{
  const original=['88','out','--forever','30','pipe','--owned-location','WhaleWallpaperProbe-one'];
  assert.deepEqual(costCaptureArgs(original,'105141'),['88','out','300','30','pipe','--owned-location','WhaleWallpaperProbe-one','--qa-adapter-luid','105141']);
  assert.equal(original[2],'--forever');assert.throws(()=>costCaptureArgs(['88','out','8','30','pipe'],'105141'));
});
await check('Unarmed phase starts no child',async()=>{const f=await fixture('unarmed');await assert.rejects(f.start());assert.equal(f.spawns.length,0);});
await check('Expired or wrong-token tickets start no child',async()=>{
  for(const [name,change] of [['stale',{expiresAt:0}],['token',{token:'wrong'}]]){const f=await fixture(name);await f.arm('N1',change);await assert.rejects(f.start());assert.equal(f.spawns.length,0);}
});
await check('Four ordered phases keep the same helper and streams; stop waits for child close',async()=>{
  const f=await fixture('normal');
  for(const label of ['N1','I1','I2','N2']){
    await f.arm(label);const s=await f.start();const stop=s.stop();assert.equal(await readFile(join(f.dir,`${label}-claimed.json`),'utf8').then(()=>true),true);
    await stop;const end=JSON.parse(await readFile(join(f.dir,`${label}-ended.json`),'utf8'));assert.equal(end.childClosed,true);assert.equal(end.cleanup.closed,true);
  }
  assert.deepEqual(f.spawns.map(s=>s.args.at(-1)),['105141','103941','103941','105141']);
  for(const s of f.spawns){assert.equal(s.file,helper);assert.deepEqual(s.options.stdio,['pipe','pipe','pipe']);}
  await assert.rejects(f.start(),/all four/);
});
await check('Concurrent start cannot advance the phase while capture is active',async()=>{
  const f=await fixture('concurrent');await f.arm('N1');const s=await f.start();await assert.rejects(f.start(),/already running/);assert.equal(f.spawns.length,1);await s.stop();
});
await check('Preview mode is refused before allocating a ticket',async()=>{
  const f=await fixture('preview');await f.arm('N1');await assert.rejects(f.factory({}).create({scene:{mode:'preview'}}),/daily mode/);assert.equal(f.spawns.length,0);
});
await check('Natural child close still finalizes ownership before the next phase',async()=>{
  const f=await fixture('natural');await f.arm('N1');await f.start();f.children[0].emit('close',0,null);
  for(let i=0;i<30;i++){try{const end=JSON.parse(await readFile(join(f.dir,'N1-ended.json'),'utf8'));assert.equal(end.childClosed,true);return;}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,10));}
  throw new Error('Natural close not finalized');
});
await writeFile(join(root,'checks.json'),JSON.stringify({checks,evidence:root},null,2));console.log(`${checks.filter(c=>c.ok).length}/${checks.length} passed; ${root}`);
if(checks.some(c=>!c.ok))process.exitCode=1;
