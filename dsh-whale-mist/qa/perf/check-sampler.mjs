// Deterministic end-to-end sampler regression: fixtures replace CPU, identity, counters and adapters.
// No live providers, application windows or installation changes. Every run retains its evidence.
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const here = dirname(fileURLToPath(import.meta.url));
const sampler = join(here, 'sample-phase.ps1');
const root = process.env.WM_PERF_TEST_ROOT || join(here, '../../.tmp/perf');
await mkdir(root, {recursive: true});
const workDir = await mkdtemp(join(root, 'sampler-check-'));
const results = [];
const A = 'luid_0x00000000_0x00000001', B = 'luid_0x00000000_0x00000002';
const state = (cpuSeconds = 1, extra = {}) => ({pid:42, name:'fixture-source',
  startTime:'2026-10-09T00:00:00.0000000Z', path:'F:/fixture/source.exe', cpuSeconds,
  workingSetBytes:1048576, privateBytes:2097152, threads:1, handles:1, ...extra});
const counter = (group, instanceName, metric, value, status = 0) => ({
  instanceName, path:`\\${group}(${instanceName})\\${metric}`, value, status});
const engine = (value = 10, status = 0, pid = 42, luid = A) =>
  counter('GPU Engine', `pid_${pid}_${luid}_phys_0_eng_0_engtype_3d`, 'Utilization Percentage', value, status);
const memory = (metric, value, status = 0, luid = A) =>
  counter('GPU Process Memory', `pid_42_${luid}_phys_0`, metric, value, status);
const adapter = (luid = A) => counter('GPU Adapter Memory', `${luid}_phys_0`, 'Dedicated Usage', 4096);
const frame = (atSeconds, cpu = 2, extra = {}) => ({atSeconds, processes:[state(cpu)],
  samples:[engine(), memory('Dedicated Usage',100), memory('Shared Usage',200),
    memory('Total Committed',300), adapter()], ...extra});
const fixture = (frames, targets = [state()]) => ({logicalProcessors:32, physicalCores:16, targets, frames});
async function invoke(name, data, options = {}) {
  const input = join(workDir, `${name}-fixture.json`), output = join(workDir, `${name}-report.json`);
  await writeFile(input, JSON.stringify(data,null,2));
  if (options.sentinel) await writeFile(output,options.sentinel);
  const run = spawnSync('pwsh',['-NoProfile','-File',sampler,'-Phase',name,'-Output',output,
    '-ProcessIds','42','-Seconds',String(options.seconds ?? 3),'-IntervalMs',String(options.interval ?? 0),
    '-RediscoverEvery',String(options.rediscover ?? 1)], {encoding:'utf8',windowsHide:true,timeout:20000,
    env:{...process.env, WM_PERF_FIXTURE:input}});
  await writeFile(join(workDir,`${name}-run.json`),JSON.stringify({status:run.status,
    error:run.error?.message, stdout:run.stdout, stderr:run.stderr},null,2));
  if (options.failure) {
    assert.equal(run.error,undefined,'negative case must not pass through a timeout or spawn error');
    assert.notEqual(run.status,0);
    if (options.sentinel) assert.equal(await readFile(output,'utf8'),options.sentinel);
    return;
  }
  assert.equal(run.status,0,run.stderr || run.error?.message);
  return JSON.parse(await readFile(output,'utf8'));
}
async function check(label,fn) {
  try {await fn();results.push({label,ok:true});console.log(`PASS ${label}`);}
  catch(error){results.push({label,ok:false,error:error.message});console.log(`FAIL ${label}: ${error.message}`);}
}
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const p = (r,i) => r.samples[i].processes[0];
const m = (r,i=0) => r.samples[i].processVram[0].adapters[0];
await check('PowerShell full-file parse',()=>{
  const q=sampler.replaceAll("'","''");
  const run=spawnSync('pwsh',['-NoProfile','-Command',`$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile('${q}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){$e|Out-String|Write-Error;exit 1}`],{encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(run.status,0,run.stderr);
});
await check('Real-provider wrapper retains partial output, null and provider timestamp',async()=>{
  const q=sampler.replaceAll("'","''");
  const command=`$ErrorActionPreference='Stop';$t=$null;$e=$null;
$ast=[System.Management.Automation.Language.Parser]::ParseFile('${q}',[ref]$t,[ref]$e);
$def=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-RealCounter'},$true);
Invoke-Expression $def.Extent.Text;
function Get-Counter { [CmdletBinding()]param($Counter,$MaxSamples)
 Write-Error 'synthetic provider warning';
 [pscustomobject]@{CounterSamples=@(
 [pscustomobject]@{InstanceName='fixture';Path='fixture';CookedValue=12;Status=1;Timestamp=[datetime]'2026-10-09T00:00:00Z'},
 [pscustomobject]@{InstanceName='missing';Path='missing';CookedValue=$null;Status=0;Timestamp=$null})}
}; Invoke-RealCounter -Paths @('fixture') | ConvertTo-Json -Depth 5`;
  const run=spawnSync('pwsh',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:20000});
  await writeFile(join(workDir,'real-wrapper-run.json'),JSON.stringify({status:run.status,stdout:run.stdout,stderr:run.stderr},null,2));
  assert.equal(run.status,0,run.stderr);const r=JSON.parse(run.stdout);
  assert.equal(r.ok,true);assert.match(r.error,/synthetic provider warning/);
  assert.equal(r.entries[0].value,12);assert.equal(r.entries[0].status,1);
  assert.ok(r.entries[0].providerTimestamp);assert.equal(r.entries[1].value,null);
});
await check('CPU deltas and unequal-interval weighted percent',async()=>{
  const r=await invoke('cpu-weighted',fixture([frame(2,2),frame(5,5)]));
  assert.equal(p(r,0).cpuSecondsDelta,1);assert.equal(p(r,1).wallClockSecondsDelta,3);
  near(p(r,0).cpuPercentOfLogicalCapacity,100/64);
  const s=r.summary.segments[0].perPid[0];
  assert.equal(s.cpuSecondsDeltaTotal,4);assert.equal(s.wallClockSecondsTotal,5);
  near(s.cpuPercentOfLogicalCapacity,100*4/(5*32));
});
await check('Idle zero remains readable',async()=>{
  const r=await invoke('idle',fixture([frame(1,1,{samples:[engine(0),memory('Total Committed',0),adapter()]})]));
  assert.equal(p(r,0).cpuSecondsDelta,0);assert.equal(r.summary.measuredSomething,true);
  assert.equal(r.samples[0].idleRatherThanFailed,true);
});
await check('Missing CPU stays null and resets baseline',async()=>{
  const r=await invoke('cpu-gap',fixture([frame(1,null),frame(2,5),frame(3,6)]));
  assert.equal(p(r,0).cpuSeconds,null);assert.equal(p(r,0).cpuSecondsDelta,null);
  assert.equal(r.samples[0].availability.everyTargetReadable,false);
  assert.equal(p(r,1).cpuSecondsDelta,null);assert.equal(p(r,2).cpuSecondsDelta,1);
});
await check('Exit gap cannot generate an interval across absence',async()=>{
  const r=await invoke('exit-gap',fixture([frame(1,2,{processes:[]}),frame(2,5),frame(3,6)]));
  assert.equal(p(r,0).alive,false);assert.deepEqual(r.samples[0].processGpu,[]);
  assert.equal(p(r,1).cpuSecondsDelta,null);assert.equal(p(r,2).cpuSecondsDelta,1);
});
await check('PID 420 excluded while PID 42 is measured',async()=>{
  const r=await invoke('pid-prefix',fixture([frame(1,2,{injectForeign:true,samples:[engine(10),engine(99,0,420),adapter()]})]));
  assert.equal(r.samples[0].processGpu.length,1);assert.equal(r.samples[0].processGpu[0].pid,42);
  assert.equal(r.samples[0].processGpu[0].engines[0].maxUtilizationPercent,10);
  assert.ok(r.discovery.foreignInstancesDropped.length>0);
});
await check('Reused PID excluded from CPU and GPU',async()=>{
  const r=await invoke('pid-reused',fixture([frame(1,20,{processes:[state(20,{startTime:'2026-10-09T01:00:00Z'})]})]));
  assert.equal(r.summary.identityStable,false);assert.equal(p(r,0).cpuSeconds,null);
  assert.deepEqual(r.samples[0].processGpu,[]);assert.deepEqual(r.samples[0].processVram,[]);
});
await check('Unreadable identity excluded',async()=>{
  const r=await invoke('identity-unknown',fixture([frame(1,2,{processes:[state(2,{startTime:null})]})]));
  assert.equal(r.summary.identityStable,false);assert.deepEqual(r.samples[0].processGpu,[]);
});
await check('Identity changed during GPU query excludes returned GPU values',async()=>{
  const r=await invoke('pid-mid-query',fixture([frame(1,2,{afterGpuProcesses:[state(99,{startTime:'2026-10-09T01:00:00Z'})]})]));
  assert.equal(p(r,0).cpuSecondsDelta,1);assert.equal(r.summary.identityStable,false);
  assert.deepEqual(r.samples[0].processGpu,[]);assert.deepEqual(r.samples[0].gpuReadings,[]);
});
await check('Invalid and missing memory remain null independently',async()=>{
  const r=await invoke('memory-null',fixture([frame(1,2,{samples:[engine(),memory('Dedicated Usage',900,0xc0000bba),
    memory('Shared Usage',200),memory('Total Committed',null),adapter()]})]));
  assert.equal(m(r).dedicatedBytes,null);assert.equal(m(r).sharedBytes,200);assert.equal(m(r).totalCommittedBytes,null);
  assert.equal(r.samples[0].invalidReadingCount,2);assert.ok(r.samples[0].rejectedReadings.some(x=>x.statusName==='INVALID_DATA'));
});
await check('PDH NEW_DATA status 1 is usable',async()=>{
  const r=await invoke('pdh-new-data',fixture([frame(1,2,{samples:[engine(12,1),adapter()]})]));
  assert.equal(r.samples[0].processGpu[0].engines[0].maxUtilizationPercent,12);assert.equal(r.samples[0].invalidReadingCount,0);
});
await check('Partial provider error retains valid counters and warning',async()=>{
  const r=await invoke('partial-error',fixture([frame(1,2,{counterError:'one counter missing'})]));
  assert.equal(r.samples[0].processGpu[0].engines[0].maxUtilizationPercent,10);
  assert.ok(r.counterErrors.some(x=>x.error==='one counter missing'));
});
await check('Invalid discovery can recover on cached paths',async()=>{
  const r=await invoke('discovery-recovery',fixture([frame(1,2,{samples:[engine(10,0xc0000bba),adapter()]}),
    frame(2,3,{samples:[engine(15),adapter()]})]),{rediscover:12});
  assert.deepEqual(r.samples[0].processGpu,[]);assert.equal(r.samples[1].processGpu[0].engines[0].maxUtilizationPercent,15);
});
await check('Adapter A to B to A creates three known segments',async()=>{
  const r=await invoke('topology-change',fixture([frame(1),frame(2,3,{samples:[engine(10,0,42,B),adapter(B)]}),frame(3,4)]));
  assert.equal(r.adapterTopology.changed,true);assert.deepEqual(r.summary.segments.map(x=>x.adapterLuidSet),[A,B,A]);
});
await check('Adapter error is unknown rather than a topology change',async()=>{
  const r=await invoke('adapter-gap',fixture([frame(1,2,{adapterUnavailable:true}),frame(2,3)]));
  assert.equal(r.samples[0].adapterLuidSet,null);assert.equal(r.summary.segments[0].topologyKnown,false);
  assert.equal(r.adapterTopology.changed,false);
  assert.equal(r.adapterTopology.unknownTopologySamples,1);
  assert.equal(r.adapterTopology.largestSegmentSamples,1);
  assert.match(r.adapterTopology.coverage,/incomplete/);
});
await check('Adapter enumeration order is not a topology change',async()=>{
  const r=await invoke('adapter-order',fixture([frame(1,2,{samples:[engine(),adapter(A),adapter(B)]}),
    frame(2,3,{samples:[engine(),adapter(B),adapter(A)]})]));
  assert.equal(r.adapterTopology.changed,false);assert.equal(r.summary.segments.length,1);
});
await check('Partially invalid adapter set is unknown, valid observations retained',async()=>{
  const bad=adapter(B);bad.status=0xc0000bba;
  const r=await invoke('adapter-partial',fixture([frame(1,2,{samples:[engine(),adapter(A),bad]})]));
  assert.equal(r.samples[0].adapters.length,1);assert.equal(r.samples[0].adapterLuidSet,null);
  assert.equal(r.adapterTopology.unknownTopologySamples,1);
});
await check('Per-adapter memory gauges average rather than sum over time',async()=>{
  const samples=v=>[engine(),memory('Total Committed',v),memory('Total Committed',v*2,0,B),adapter(A),adapter(B)];
  const r=await invoke('memory-gauges',fixture([frame(1,2,{samples:samples(100)}),frame(2,3,{samples:samples(300)})]));
  const ms=r.summary.segments[0].perPid[0].memoryByAdapter;
  assert.equal(ms.find(x=>x.luid===A).totalCommittedBytesAvg,200);assert.equal(ms.find(x=>x.luid===B).totalCommittedBytesAvg,400);
  assert.equal(ms[0].metricSamples.committed,2);
});
await check('Unavailable counters do not manufacture readable zeros',async()=>{
  const r=await invoke('provider-unavailable',fixture([frame(1,null,{counterUnavailable:true})]));
  assert.equal(r.summary.measuredSomething,false);assert.deepEqual(r.samples[0].processGpu,[]);
  assert.equal(r.samples[0].idleRatherThanFailed,false);
});
await check('Existing output refused without modifying evidence',()=>invoke('existing-output',fixture([frame(1)]),{sentinel:'KEEP ORIGINAL',failure:true}));
await check('Fixture without logical capacity fails without live hardware fallback',()=>
  invoke('missing-capacity',{...fixture([frame(1)]),logicalProcessors:0},{failure:true}));
for(const [key,value] of [['seconds',0],['interval',-1],['rediscover',0]]) {
  await check(`Reject invalid ${key}`,()=>invoke(`invalid-${key}`,fixture([frame(1)]),{[key]:value,failure:true}));
}
await writeFile(join(workDir,'results.json'),JSON.stringify({results,evidenceDir:workDir},null,2));
console.log(`${results.filter(x=>x.ok).length}/${results.length} passed; evidence: ${workDir}`);
if(results.some(x=>!x.ok))process.exitCode=1;
