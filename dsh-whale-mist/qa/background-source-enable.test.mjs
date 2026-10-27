import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rig} from './background-source-fixture.mjs';
const key='dsh-whale-mist.appearance.v1';
const plain=x=>JSON.parse(JSON.stringify(x));
const check=fn=>async()=>{const f=await rig({background:'none'});try{await fn(f);}finally{await f.cleanup();}};
const ordinary=f=>f.calls.filter(c=>/\/whale-wallpaper\/(start|restart|stop)$/.test(c.url));
test('cold explicit enable verifies real Host then strictly saves only the source without playback',check(async f=>{
 const before=f.get(),stored=f.stored(),count=ordinary(f).length;const result=await f.controller.enableBackgroundSource();
 assert.equal(result.ok,true,result.error);assert.deepEqual(f.get(),{...before,background:'wallpaper'});assert.deepEqual(f.stored(),{...stored,background:'wallpaper'});
 assert.equal(f.writes.length,1);assert.equal(ordinary(f).length,count);assert.equal(f.host.sessions.length,0);assert.equal(f.host.api.generation(),0);
}));
test('close then explicit enable rebinds consumed proof and restores capability without starting',async()=>{
 const f=await rig();try{assert.equal(f.commit(await f.ready()).ok,true);const before=ordinary(f).length;
 const r=await f.controller.enableBackgroundSource();assert.equal(r.ok,true,r.error);assert.equal(f.get().background,'wallpaper');assert.equal(f.host.api.generation(),1);assert.equal(f.host.sessions.length,0);assert.equal(ordinary(f).length,before);
 assert.deepEqual(f.calls.filter(c=>c.url.includes('/close-fence/')).map(c=>c.url.split('/').at(-1)),['prepare','inspect','inspect','activate']);
 await f.controller.wallpaper.start();const start=f.calls.findLast(c=>c.url.endsWith('/start'));assert.match(start.options.headers['x-whale-wallpaper-admission'],/^[0-9a-f-]{36}$/);assert.equal(f.host.sessions.length,1);await f.controller.wallpaper.stop();assert.equal(f.controller.wallpaper.getStatus().state,'stopped');
 }finally{await f.cleanup();}
});
test('repeated close-enable cycles rotate admission and never reuse an old commit permit',async()=>{
 const f=await rig();try{let old;for(let i=0;i<2;i++){const p=await f.ready();if(old)assert.equal(f.commit(old).ok,false);assert.equal(f.commit(p).ok,true);assert.equal((await f.controller.enableBackgroundSource()).ok,true);old=p;}assert.equal(f.host.api.generation(),2);assert.equal(f.host.sessions.length,0);}finally{await f.cleanup();}
});
test('none retains stored autoplay choice but enable never schedules playback',async()=>{
 const f=await rig({background:'none',patch:{weAutoStart:true}});try{const n=ordinary(f).length;assert.equal((await f.controller.enableBackgroundSource()).ok,true);assert.equal(f.get().weAutoStart,true);assert.equal(ordinary(f).length,n);assert.equal(f.host.sessions.length,0);}finally{await f.cleanup();}
});
test('image video wallpaper malformed values and disposed controller cannot enable',async()=>{
 for(const background of ['image','video','wallpaper']){const f=await rig({background});try{const n=f.calls.length;assert.equal((await f.controller.enableBackgroundSource()).error,'background-enable-unavailable');assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);}finally{await f.cleanup();}}
 const f=await rig({background:'none'});try{f.disposeController();assert.equal((await f.controller.enableBackgroundSource()).ok,false);assert.equal(f.writes.length,0);}finally{await f.cleanup();}
});
test('invalid or already cancelled options are rejected before Host IO',check(async f=>{
 const a=new AbortController();a.abort();const n=f.calls.length;for(const options of [null,[],{timeoutMs:0},{isCurrent:3},{signal:{}},{signal:a.signal},{isCurrent:()=>false}])assert.equal((await f.controller.enableBackgroundSource(options)).ok,false);assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);
}));
test('parallel explicit enable cannot produce duplicate writes or protocol commands',check(async f=>{
 const first=f.controller.enableBackgroundSource(),second=f.controller.enableBackgroundSource();assert.equal((await second).error,'background-enable-unavailable');assert.equal((await first).ok,true);assert.equal(f.writes.length,1);
}));
test('foreign active Host is not treated as a safe empty source',check(async f=>{
 await f.host.start();const r=await f.controller.enableBackgroundSource();assert.equal(r.ok,false);assert.equal(f.get().background,'none');assert.equal(f.writes.length,0);assert.equal(f.host.sessions[0].calls.includes('stop'),false);
}));
test('caller context revoked at real Host publication prevents storage mutation',check(async f=>{
 let current=true;const off=f.controller.wallpaper.subscribeHostClose?.(()=>{current=false;});
 // A real Host read is awaited. Revoking immediately after dispatch also covers ignored cancellation.
 const p=f.controller.enableBackgroundSource({isCurrent:()=>current});current=false;const r=await p;off?.();assert.equal(r.ok,false);assert.equal(f.writes.length,0);assert.equal(f.get().background,'none');
}));
test('a concurrent newer setting revokes enable and is retained',check(async f=>{
 const p=f.controller.enableBackgroundSource();f.controller.set('brightness',89);const r=await p;assert.equal(r.ok,false);assert.equal(f.get().background,'none');assert.equal(f.get().brightness,89);assert.equal(f.stored().brightness,89);
}));
test('aborting activation after accepted Host write cannot save or silently regain admission',async()=>{
 const f=await rig();try{assert.equal(f.commit(await f.ready()).ok,true);const a=new AbortController();f.transport((url,_options,response)=>{if(url.endsWith('/activate'))a.abort();return response;});const r=await f.controller.enableBackgroundSource({signal:a.signal});assert.equal(r.ok,false);assert.equal(f.get().background,'none');assert.equal(f.writes.length,1);assert.equal(f.controller.wallpaper.getCloseSnapshot().uncertain,true);f.transport(null);assert.equal((await f.controller.enableBackgroundSource()).ok,false);}finally{await f.cleanup();}
});
test('storage unavailable silent failure and thrown write do not fabricate enabled source',check(async f=>{
 for(const mode of ['read','drop','throw']){f.hook((op,k,v,actual)=>{if(k===key){if(mode==='read'&&op==='get'||mode==='throw'&&op==='set')throw Error('private');if(mode==='drop'&&op==='set')return;}return actual();});const r=await f.controller.enableBackgroundSource();assert.equal(r.ok,false);assert.equal(f.get().background,'none');assert.ok(!JSON.stringify(r).includes('private'));}f.hook(null);assert.equal((await f.controller.enableBackgroundSource()).ok,true);
}));
test('storage drift is preserved and never overwritten by enable',check(async f=>{
 const changed={...f.stored(),mask:67};f.storage.set(key,JSON.stringify(changed));const r=await f.controller.enableBackgroundSource();assert.equal(r.error,'background-storage-conflict');assert.deepEqual(f.stored(),changed);assert.equal(f.writes.length,0);
}));
test('write then throw reports actual enabled state and does not roll it back',check(async f=>{
 f.hook((op,k,v,actual)=>{const r=actual();if(k===key&&op==='set')throw Error('after');return r;});const r=await f.controller.enableBackgroundSource();assert.equal(r.ok,false);assert.equal(r.value,'wallpaper');assert.equal(r.applied,true);assert.equal(r.persisted,'confirmed');assert.equal(f.get().background,'wallpaper');assert.equal(f.stored().background,'wallpaper');
}));
test('unknown enable save is adopted only on new explicit verification with no repeated write',check(async f=>{
 let wrote=false;f.hook((op,k,v,actual)=>{if(k===key&&op==='get'&&wrote)throw Error('readback');const r=actual();if(k===key&&op==='set')wrote=true;return r;});const first=await f.controller.enableBackgroundSource();assert.equal(first.persisted,'unknown');assert.equal(f.get().background,'none');f.hook(null);const writes=f.writes.length;const result=await f.controller.enableBackgroundSource();assert.equal(result.ok,true,result.error);assert.equal(result.stage,'recovered');assert.equal(f.writes.length,writes);
}));
test('confirmed activation with failed storage can recover by fresh Host read without reactivation',async()=>{
 const f=await rig();try{assert.equal(f.commit(await f.ready()).ok,true);f.hook((op,k,v,actual)=>{if(op==='set')throw Error('quota');return actual();});assert.equal((await f.controller.enableBackgroundSource()).ok,false);const count=f.calls.filter(c=>c.url.endsWith('/activate')).length;f.hook(null);assert.equal((await f.controller.enableBackgroundSource()).ok,true);assert.equal(f.calls.filter(c=>c.url.endsWith('/activate')).length,count);assert.equal(f.get().background,'wallpaper');}finally{await f.cleanup();}
});
test('projection failure publishes actual enabled state and no automatic start',check(async f=>{
 f.projection(()=>{throw Error('css');});let observed;const off=f.controller.subscribeSettings(s=>{observed=s.background;});const r=await f.controller.enableBackgroundSource();off();assert.equal(r.error,'background-projection-failed');assert.equal(r.applied,true);assert.equal(observed,'wallpaper');assert.equal(f.stored().background,'wallpaper');assert.equal(f.host.sessions.length,0);
}));
test('storage callback and notification reentry cannot overwrite newer choices',check(async f=>{
 let once=false;f.hook((op,k,v,actual)=>{if(!once&&op==='get'&&k===key){once=true;f.controller.set('brightness',91);}return actual();});assert.equal((await f.controller.enableBackgroundSource()).ok,false);assert.equal(f.get().background,'none');assert.equal(f.get().brightness,91);f.hook(null);
 const off=f.controller.subscribeSettings(()=>f.controller.set('brightness',92));const r=await f.controller.enableBackgroundSource();off();assert.equal(r.applied,true);assert.equal(r.persisted,'superseded');assert.equal(f.get().background,'wallpaper');assert.equal(f.get().brightness,92);
}));
test('hung cold Host read has a bounded deadline and its late response cannot enable',check(async f=>{
 let release,seen=false;const hold=new Promise(resolve=>{release=resolve;});f.transport(async(_url,_options,response)=>{seen=true;await hold;return response;});const p=f.controller.enableBackgroundSource({timeoutMs:30});for(let i=0;i<40&&!seen;i++)await Promise.resolve();assert.equal(seen,true);f.expire();const r=await p;assert.equal(r.ok,false);assert.equal(f.writes.length,0);release();for(let i=0;i<40;i++)await Promise.resolve();assert.equal(f.get().background,'none');assert.equal(f.writes.length,0);
}));
test('lost activation response latches uncertainty and a late accepted result cannot save',async()=>{
 const f=await rig();let release;try{assert.equal(f.commit(await f.ready()).ok,true);let seen=false;const hold=new Promise(resolve=>{release=resolve;});f.transport(async(url,_options,response)=>{if(url.endsWith('/activate')){seen=true;await hold;}return response;});const p=f.controller.enableBackgroundSource({timeoutMs:30});for(let i=0;i<300&&!seen;i++)await Promise.resolve();assert.equal(seen,true);f.expire();assert.equal((await p).ok,false);release();for(let i=0;i<40;i++)await Promise.resolve();assert.equal(f.get().background,'none');assert.equal(f.writes.length,1);assert.equal(f.controller.wallpaper.getCloseSnapshot().uncertain,true);f.transport(null);assert.equal((await f.controller.enableBackgroundSource()).ok,false);}finally{release?.();await f.cleanup();}
});
test('first explicit enable initialises a genuinely missing startup record without masking a lost existing record',async()=>{
 const f=await rig({background:'none',missing:true});try{const before=f.get();assert.equal((await f.controller.enableBackgroundSource()).ok,true);assert.deepEqual(f.get(),{...before,background:'wallpaper'});assert.equal(f.stored().background,'wallpaper');}finally{await f.cleanup();}
 const existing=await rig({background:'none'});try{existing.storage.delete(key);assert.equal((await existing.controller.enableBackgroundSource()).error,'background-storage-conflict');assert.equal(existing.storage.has(key),false);}finally{await existing.cleanup();}
});
