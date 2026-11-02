// Execute only registry initialization, never a runner's dispatch/spawn section.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

const [before,after,output]=process.argv.slice(2);assert.ok(before&&after&&output&&!existsSync(output));
let spawns=0;
const read=dir=>readFileSync(path.join(dir,'run-step.cjs'),'utf8');
function registry(source,dir){
 const end=source.indexOf('const label=process.argv[2]');assert.ok(end>0);
 const code=source.slice(0,end)+'\nglobalThis.registry=steps;';
 const req=createRequire(path.resolve(dir,'run-step.cjs'));
 const scope={__dirname:path.resolve(dir),process:{execPath:process.execPath},require(name){
  if(name==='node:child_process')return{spawn(){spawns++;throw Error('spawn forbidden');},spawnSync(){spawns++;throw Error('spawn forbidden');}};
  return req(name);
 }};
 vm.runInNewContext(code,scope,{timeout:500});return scope.registry;
}
const old=read(before),fixed=read(after),oldMap=registry(old,before),newMap=registry(fixed,after);
const normalize=(value,dir)=>{
 const visit=x=>typeof x==='string'?x.replaceAll(path.resolve(dir),'FIXTURE_ROOT'):Array.isArray(x)?x.map(visit):x;
 return JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,visit(v)]));
};
assert.equal(normalize(oldMap,before),normalize(newMap,after));
const legacyDuplicate=registry(old.replace('const steps={','const steps={snapshotPlaying:["new-fixture",[],1],'),before);
assert.equal(legacyDuplicate.snapshotPlaying[1][3],path.join(path.resolve(before),'snapshot-live.ps1'));
const fixedDuplicate=fixed.replace('defineSteps([','defineSteps([["snapshotPlaying",["new-fixture",[],1]],');
assert.throws(()=>registry(fixedDuplicate,after),/duplicate step: snapshotPlaying/);
const req=createRequire(path.resolve(after,'run-step.cjs'));const {defineSteps}=req('./step-map.cjs');
for(const key of ['__proto__','','bad-key'])assert.throws(()=>defineSteps([[key,1]]),/Invalid or duplicate step/);
const safe=defineSteps([['snapshotPlaying',1]]);assert.equal(Object.getPrototypeOf(safe),null);assert.equal(Object.hasOwn(safe,'toString'),false);
assert.equal(spawns,0);
const report={passed:true,cases:5,labelsCompared:Object.keys(oldMap).length,legacySilentOverwriteReproduced:true,duplicateRejectedBeforeDispatch:true,argvAndDeadlinesUnchanged:true,spawns,realAppsUsed:false};
writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
