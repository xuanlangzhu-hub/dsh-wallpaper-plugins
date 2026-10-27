// Actual client module and private bootstrap seam; React/tree, lifecycle,
// metadata fetch and timers are substitutes. No native processes or live DSH.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRig} from './detachable-catalog-harness.mjs';
const after=fileURLToPath(new URL('../src/client.js',import.meta.url));
function run(name,options,fn){test(name,async()=>{const f=await createRig(after,options);try{await fn(f);}finally{await f.dispose();assert.equal(f.timers.size,0);}});}
await run('first open ensure/cache/reopen/no playback',{},async f=>{f.open();f.render();await f.flush();f.render();assert.equal(f.readCalls,1);assert.equal(f.requests[0].url,'/whale-wallpaper/library?ensure=1');assert.equal(f.requests[0].method,'GET');assert.equal(f.observation().startDisabled,false);assert.equal(f.timers.size,0);f.openPanel();f.close();f.open();await f.flush();assert.equal(f.readCalls,1);f.setStatus({state:'cleanup-failed',cleanupPending:true,activeSceneId:null});f.render();assert.equal(f.observation().startDisabled,true);});
await run('single inflight and close cancels immediately',{fetchMode:'pending-abort'},async f=>{f.open();f.openPanel();f.openPanel();assert.equal(f.readCalls,1);assert.equal(f.timers.size,1);f.close();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.timers.size,0);f.open();assert.equal(f.readCalls,2);f.close();await f.flush();});
await run('4000ms timeout and retry on reopen',{fetchMode:'pending-abort'},async f=>{f.open();assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,4000);f.fireTimers();await f.flush();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.timers.size,0);f.close();f.open();assert.equal(f.readCalls,2);f.close();await f.flush();});
await run('async failure does not loop; reopen retries',{fetchMode:'reject'},async f=>{f.open();await f.flush();assert.equal(f.readCalls,1);assert.equal(f.timers.size,0);await f.flush();assert.equal(f.readCalls,1);f.close();f.open();await f.flush();assert.equal(f.readCalls,2);});
await run('sync throw clears timer/slot',{syncThrow:true},async f=>{assert.doesNotThrow(()=>f.open());assert.equal(f.readCalls,1);assert.equal(f.timers.size,0);f.close();assert.doesNotThrow(()=>f.open());assert.equal(f.readCalls,2);assert.equal(f.timers.size,0);});
await run('late old result cannot clear/abort newer slot',{fetchMode:'ignore-abort'},async f=>{f.open();f.close();f.open();assert.equal(f.readCalls,2);f.resolve(0);await f.flush();assert.equal(f.requests[1].signal.aborted,false);assert.equal(f.timers.size,1);f.close();assert.equal(f.requests[1].signal.aborted,true);assert.equal(f.timers.size,0);f.resolve(1);await f.flush();});
await run('dispose aborts; disposed cannot launch new read',{fetchMode:'pending-abort'},async f=>{f.open();await f.dispose();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.timers.size,0);f.close();f.open();assert.equal(f.readCalls,1);});
await run('missing wallpaper interface is harmless',{missingWallpaper:true},async f=>{assert.doesNotThrow(()=>f.open());assert.equal(f.readCalls,0);assert.equal(f.timers.size,0);});
await run('missing cached snapshot is safe',{missingSnapshot:true},async f=>{assert.doesNotThrow(()=>f.open());await f.flush();assert.equal(f.readCalls,1);assert.equal(f.timers.size,0);});
await run('non-docked mode cannot launch metadata read',{},async f=>{f.setMode('detached');f.open();assert.equal(f.readCalls,0);assert.equal(f.timers.size,0);});
await run('external refresh retains its own cancellation',{fetchMode:'pending-abort'},async f=>{const abort=new AbortController();const external=f.externalRead({refresh:true,signal:abort.signal});f.open();assert.equal(f.readCalls,1);assert.equal(f.timers.size,0);f.close();await f.dispose();assert.equal(abort.signal.aborted,false);const rejected=assert.rejects(external,/fixture aborted/);abort.abort();await rejected;});

const videoId='we-'+ 'a'.repeat(24);
for(const [type,available,disabled] of [['video',true,false],['video',false,true],['web',true,false],['unknown',true,true]]){
 await run(`MP4 actual docked component gate ${type}/${available}`,{sceneId:videoId,items:[{id:videoId,title:'Synthetic',type,available,playbackVerified:false,contentRating:'Everyone'}]},async f=>{
  f.open();await f.flush();f.render();assert.equal(f.observation().startDisabled,disabled);
  f.setStatus({state:'cleanup-failed',cleanupPending:true});f.render();assert.equal(f.observation().startDisabled,true);
 });
}

for(const contentRating of ['Mature','unknown']){
 await run(`MP4 actual docked age gate ${contentRating}`,{sceneId:videoId,items:[{id:videoId,title:'Hidden synthetic',type:'video',available:true,contentRating}]},async f=>{
  f.open();await f.flush();f.render();assert.equal(f.observation().startDisabled,true);
 });
}
