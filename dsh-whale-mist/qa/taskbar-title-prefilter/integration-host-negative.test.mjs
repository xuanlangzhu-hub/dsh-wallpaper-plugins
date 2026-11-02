import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(process.env.WM_PREFLIGHT_ROOT);
const {verifyIndependentWorkerCleanup}=await import(pathToFileURL(join(root,'staging/src/wallpaper/session.js')));
const confirmed=JSON.parse(await readFile(join(root,'protocol/confirmed/taskbar-action.json'),'utf8'));
const unstarted=JSON.parse(await readFile(join(root,'protocol/unstarted/taskbar-action.json'),'utf8'));
const baseline=confirmed.requestedIdentity;
async function verify(record,changes={}) {
  return verifyIndependentWorkerCleanup({
    location:confirmed.location,windowHwnd:baseline.hwnd,windowPid:baseline.pid,expectedStartUtc:baseline.startUtc,
    outputDir:join(root,'in-memory-proof-only'),captureChild:{pid:4545,exitCode:0},captureClosed:true,captureSpawned:true,
    queryProcesses:async()=>({ok:true,processes:[]}),
    exists:p=>p.endsWith('stop.txt')||p.endsWith('taskbar-action.json'),
    readFile:async p=>{assert.ok(p.endsWith('taskbar-action.json'));return JSON.stringify(record);},
    writeFile:async()=>{throw Error('Unexpected OS write in offline verifier');},
    now:()=>Date.parse('2026-10-29T00:00:00Z'),...changes,
  });
}
for(const [name,change,reason] of [
  ['foreign location',r=>r.location+='-foreign',/location mismatch/],
  ['foreign HWND',r=>r.requestedIdentity.hwnd++,/hwnd mismatch/],
  ['foreign PID',r=>r.requestedIdentity.pid++,/pid mismatch/],
  ['100ns process recycle',r=>r.requestedIdentity.startUtc='2026-10-28T00:00:00.0000001+00:00',/startUtc mismatch/],
  ['missing requested identity',r=>delete r.requestedIdentity,/missing requestedIdentity/],
  ['pending stage with success flags',r=>r.stage='action-pending',/pending stage/],
  ['missing action',r=>delete r.action,/missing action/],
  ['unconfirmed cleanup',r=>r.action.cleanupSafe=false,/cleanupSafe/],
  ['unknown exit',r=>r.action.exited=null,/not confirmed exited/],
  ['unknown start',r=>r.action.started=null,/not marked started/],
  ['pending action',r=>r.action.pending=true,/pending is not false/],
  ['timed out action',r=>r.action.timedOut=true,/timedOut is not false/],
  ['terminated action',r=>r.action.terminated=true,/terminated is not false/],
  ['before identity from another creation',r=>r.beforeIdentity.startUtc='2026-10-28T00:00:00.0000001+00:00',/beforeIdentity/],
]) {
  test('fixed rc55 proof refuses '+name,async()=>{
    const record=structuredClone(confirmed);change(record);
    const result=await verify(record);assert.equal(result.safe,false);assert.match(result.reason,reason);
  });
}
test('failed process query cannot become a trusted empty inventory',async()=>{
  const r=await verify(confirmed,{queryProcesses:async()=>({ok:false,error:'injected query failure'})});
  assert.equal(r.safe,false);assert.match(r.reason,/process query failed/);
});
test('worker presence overrides valid terminal file',async()=>{
  const r=await verify(confirmed,{queryProcesses:async()=>({ok:true,processes:[{pid:999,commandLine:'probe --taskbar-worker'}]})});
  assert.equal(r.safe,false);assert.match(r.reason,/worker process 999/);
});
test('still-running capture is refused before querying proof',async()=>{
  const r=await verify(confirmed,{captureChild:{pid:4545,exitCode:null},captureClosed:false,
    queryProcesses:async()=>{throw Error('must not query after live-capture refusal');}});
  assert.equal(r.safe,false);assert.match(r.reason,/capture process is still running/);
});
test('actual stopped-before-action record remains a distinct accepted terminal branch',async()=>{
  const r=await verify(unstarted);assert.equal(r.safe,true);assert.match(r.reason,/stopped before action/);
});
test('stopped-before-action cannot conceal a triggered action',async()=>{
  const record=structuredClone(unstarted);record.trigger={sequence:1};
  const r=await verify(record);assert.equal(r.safe,false);assert.match(r.reason,/trigger is not null/);
});
