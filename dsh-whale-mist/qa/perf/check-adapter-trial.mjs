import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {trial} from './probe-mode-device.mjs';

const base=resolve('dsh-whale-mist/.tmp/perf');await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'adapter-trial-check-'));
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,ok:true});console.log('PASS',name);}catch(e){checks.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message);}}
function packet(sequence){const header=Buffer.alloc(24);header.writeUInt32BE(0x57484c31);header.writeUInt32LE(sequence,4);header.writeUInt32LE(5,8);header.writeBigInt64LE(1700000000000n,12);header.writeUInt16LE(1280,20);header.writeUInt16LE(720,22);return Buffer.concat([header,Buffer.from([255,216,sequence,255,217])]);}
async function sample(name,{invalidStream=false}={}){
  const dir=join(root,name);await mkdir(dir);let capturedArgs;
  const spawnImpl=(file,args)=>{
    capturedArgs=args;const child=new EventEmitter();child.pid=42;child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>true;
    setTimeout(async()=>{
      try{
        child.stderr.write(JSON.stringify({kind:'log',level:'info',message:JSON.stringify({adapter:'fixture',luid:'103941',vendorId:32902})})+'\n');
        const bytes=invalidStream?Buffer.alloc(30):Buffer.concat([packet(1),packet(2)]);child.stdout.write(bytes.subarray(0,7));child.stdout.write(bytes.subarray(7));
        await writeFile(join(args[1],'summary.json'),JSON.stringify({reason:'duration',frames:2}));child.emit('close',0,null);
      }catch(e){child.emit('error',e);child.emit('close',1,null);}
    },5);return child;
  };
  let result,error;
  try{result=await trial({helper:'fixture.exe',root:dir,mode:'pipe',index:0,window:{hwnd:88},spawnImpl,env:{},cwd:process.cwd(),timeoutMs:500,adapterLuid:'103941',inspectFrames:true});}catch(e){error=e;}
  return {dir,result,error,capturedArgs};
}
await check('Explicit LUID is passed, split packets decode and bounded samples persist',async()=>{
  const f=await sample('normal');assert.equal(f.error,undefined);assert.deepEqual(f.capturedArgs.slice(-2),['--qa-adapter-luid','103941']);
  assert.equal(f.result.requestedAdapterLuid,'103941');assert.equal(f.result.frameEvidence.decodedFrames,2);assert.equal(f.result.frameEvidence.last.sequence,2);
  assert.deepEqual(await readFile(join(f.dir,'1-pipe','first-frame.jpg')),Buffer.from([255,216,1,255,217]));
  assert.deepEqual(await readFile(join(f.dir,'1-pipe','last-frame.jpg')),Buffer.from([255,216,2,255,217]));
});
await check('Invalid frame stream cannot report a successful adapter capture',async()=>{
  const f=await sample('invalid',{invalidStream:true});assert.ok(f.error);assert.match(f.error.message,/frame/);
});
await check('Malformed or overflowing LUID is rejected before spawning',async()=>{
  let spawns=0;
  for(const adapterLuid of [103941,'0x19605','+1','9223372036854775808'])await assert.rejects(trial({adapterLuid,spawnImpl:()=>{spawns++;}}));
  assert.equal(spawns,0);
});
await writeFile(join(root,'checks.json'),JSON.stringify({checks,evidence:root},null,2));console.log(`${checks.filter(c=>c.ok).length}/${checks.length} passed; ${root}`);
if(checks.some(c=>!c.ok))process.exitCode=1;
