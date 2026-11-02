import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(process.env.WM_PREFLIGHT_ROOT);
const {verifyIndependentWorkerCleanup}=await import(pathToFileURL(join(root,'staging/src/wallpaper/session.js')));
const record=JSON.parse(await readFile(join(root,'protocol/confirmed/taskbar-action.json'),'utf8'));
const actionName='taskbar-action.json';
const fakeTiming={purpose:'taskbar-stage-timing-not-termination-proof',cleanupSafe:true,exited:true,events:[{stage:'delete-tab-returned',elapsedMs:1}]};
async function check(files,processes=[]) {
  const reads=[];const dir=join(root,'sidecar-cases',String(Math.random()).slice(2));await mkdir(dir,{recursive:true});
  for(const [name,data] of Object.entries(files))await writeFile(join(dir,name),typeof data==='string'?data:JSON.stringify(data));
  const exists=path=>Object.hasOwn(files,path.slice(dir.length+1)) || path.endsWith('stop.txt');
  const result=await verifyIndependentWorkerCleanup({location:record.location,windowHwnd:record.requestedIdentity.hwnd,
    windowPid:record.requestedIdentity.pid,expectedStartUtc:record.requestedIdentity.startUtc,outputDir:dir,
    captureChild:{pid:4545,exitCode:0},captureClosed:true,captureSpawned:true,
    queryProcesses:async()=>({ok:true,processes}),exists,
    readFile:async(path,encoding)=>{reads.push(path.slice(dir.length+1));return readFile(path,encoding);},
    writeFile:async()=>{throw Error('unexpected write');},now:()=>Date.parse('2026-10-29T00:00:00Z')});
  return {result,reads};
}
const sidecars={'taskbar-parent-timing.json':fakeTiming,'taskbar-worker-timing.json':fakeTiming};
test('sidecars cannot replace a missing terminal action file',async()=>{
  const {result,reads}=await check(sidecars);assert.equal(result.safe,false);assert.match(result.reason,/missing/);assert.deepEqual(reads,[]);
});
test('sidecars cannot repair a damaged action file',async()=>{
  const {result,reads}=await check({...sidecars,[actionName]:'{broken'});assert.equal(result.safe,false);assert.deepEqual(reads,[actionName]);
});
test('sidecars cannot turn an unconfirmed worker into safe cleanup',async()=>{
  const unsafe=structuredClone(record);unsafe.action.exited=false;unsafe.action.cleanupSafe=false;
  const {result,reads}=await check({...sidecars,[actionName]:unsafe});assert.equal(result.safe,false);assert.deepEqual(reads,[actionName]);
});
test('sidecar success cannot override OS worker presence',async()=>{
  const {result,reads}=await check({...sidecars,[actionName]:record},[{pid:999,commandLine:'probe --taskbar-worker'}]);assert.equal(result.safe,false);assert.deepEqual(reads,[]);
});
test('valid terminal proof works without diagnostic files',async()=>{
  const {result,reads}=await check({[actionName]:record});assert.equal(result.safe,true);assert.deepEqual(reads,[actionName]);
});
test('corrupt diagnostic files do not poison valid terminal proof',async()=>{
  const {result,reads}=await check({[actionName]:record,'taskbar-parent-timing.json':'{bad','taskbar-worker-timing.json':'null'});
  assert.equal(result.safe,true);assert.deepEqual(reads,[actionName]);
});
