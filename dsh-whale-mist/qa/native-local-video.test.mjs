import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rig as mediaRig,ticks,file as mediaFile} from './local-media-fixture.mjs';
const rig=options=>mediaRig({kind:'video',...options});
const file=(name='one.webm',type='video/webm')=>mediaFile(name,type);
const check=(fn,options)=>async()=>{const f=await rig(options);try{await fn(f);}finally{await f.cleanup();}};

test('native video selection changes only source and reuses video DB key without native playback',check(async f=>{
 const before=f.get(),n=f.calls.length;const r=await f.change();assert.equal(r.ok,true,r.error);assert.deepEqual(f.get(),{...before,background:'video'});assert.equal(f.stored().background,'video');assert.equal(f.records.get('video').name,'one.webm');assert.equal(f.controller.media.getSnapshot().media.video.name,'one.webm');assert.equal(f.host.sessions.length,0);assert.equal(f.calls.slice(n).filter(c=>/\/(start|stop|restart)$/.test(c.url)).length,0);
}));
test('an unreadable replacement preserves the original Blob and source',check(async f=>{
 const original=f.records.get('video');f.decode('fail');const r=await f.change();assert.equal(r.error,'video-decode');assert.equal(f.records.get('video'),original);assert.equal(f.get().background,'video');assert.equal(f.api.getSnapshot().videoError,'视频无法读取，请换一个');assert.equal(f.urls.size,0);
},{background:'video',stored:{blob:file('old.png'),name:'old.png'}}));
test('replacement while video source active stores only video and retains all appearance choices',check(async f=>{
 const before=f.get(),writes=f.writes.length;const r=await f.change('replace',file('two.mp4','video/mp4'));assert.equal(r.ok,true,r.error);assert.deepEqual(f.get(),before);assert.equal(f.writes.length,writes);assert.equal(f.records.get('video').name,'two.mp4');
},{background:'video',stored:{blob:file('old.png'),name:'old.png'}}));
test('remove switches video source off before deleting the saved video',check(async f=>{
 let sourceAtDelete;f.readHook(()=>{sourceAtDelete=f.get().background;});const r=await f.change('remove',null);assert.equal(r.ok,true,r.error);assert.equal(sourceAtDelete,'none');assert.equal(f.get().background,'none');assert.equal(f.stored().background,'none');assert.equal(f.records.has('video'),false);assert.equal(f.controller.media.getSnapshot().media.video,null);
},{background:'video',stored:{blob:file(),name:'old.png'}}));
test('removing a cached video while source is none does not write appearance or change other media',check(async f=>{
 f.records.set('image',{blob:file('video','video/mp4'),name:'video'});const n=f.writes.length;assert.equal((await f.change('remove',null)).ok,true);assert.equal(f.get().background,'none');assert.equal(f.writes.length,n);assert.equal(f.records.get('image').name,'video');
},{stored:{blob:file(),name:'old.png'}}));
test('using saved video validates it and activates without another Blob write',check(async f=>{
 const puts=f.dbLog.filter(op=>op==='put').length;assert.equal((await f.change('use',null)).ok,true);assert.equal(f.get().background,'video');assert.equal(f.dbLog.filter(op=>op==='put').length,puts);
},{stored:{blob:file(),name:'old.png'}}));
test('missing cached video cannot activate a source',check(async f=>{const r=await f.change('use',null);assert.equal(r.error,'video-missing');assert.equal(f.get().background,'none');assert.equal(f.writes.length,0);}));
test('invalid zero-size non-video and unsupported container files reject before lifecycle IO',check(async f=>{
 const n=f.calls.length;for(const blob of [null,{},new Blob([],{type:'video/png'}),file('x','text/plain'),file('x.avi','video/avi')]){const r=await f.controller.editBackgroundVideo('replace',blob);assert.equal(r.error,'video-file-invalid');}assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);
}));
test('wallpaper and image cannot be silently stopped by the new video API',async()=>{
 for(const background of ['wallpaper','image']){const f=await rig({background});try{const n=f.calls.length;assert.equal((await f.controller.editBackgroundVideo('replace',file())).error,'video-unavailable');assert.equal(f.api.getSnapshot().showLocalVideo,false);assert.equal(f.calls.length,n);}finally{await f.cleanup();}}
});
test('foreign active Host prevents video persistence without issuing a stop',check(async f=>{
 await f.host.start();const r=await f.change();assert.equal(r.ok,false);assert.equal(f.records.has('video'),false);assert.equal(f.host.sessions[0].calls.includes('stop'),false);
}));
test('cancelled file selection consumes no video ticket or storage work',check(async f=>{
 const n=f.calls.length,ticket=f.api.getSnapshot().videoTicket;assert.equal((await f.api.videoAction('replace',null,ticket,f.token)).error,'video-cancelled');assert.equal(f.api.getSnapshot().videoTicket,ticket);assert.equal(f.calls.length,n);
}));
test('busy lane rejects duplicate video and enable requests without another write',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();assert.equal(f.api.getSnapshot().videoBusy,true);assert.equal((await f.change()).ok,false);assert.equal((await f.controller.enableBackgroundSource()).ok,false);f.release();assert.equal((await p).ok,true);assert.equal(f.dbLog.filter(op=>op==='put').length,1);
}));
test('hidden then visible view and session or theme round trips revoke old picker tickets',async()=>{
 for(const mutate of [f=>{f.hide();f.show();},f=>{f.session('s2');f.session('s1');},f=>{f.theme('whale-mist');f.theme('whale-abyss');}]){const f=await rig();try{const t=f.api.getSnapshot().videoTicket;mutate(f);assert.equal((await f.api.videoAction('replace',file(),t,f.token)).error,'video-stale');assert.equal(f.writes.length,0);}finally{await f.cleanup();}}
});
test('view hidden during decode cancels before DB mutation and never changes source',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();f.hide();f.release();const r=await p;assert.equal(r.ok,false);assert.equal(f.records.has('video'),false);assert.equal(f.get().background,'none');assert.equal(f.urls.size,0);
}));
test('decode deadline releases URL and a late decoder cannot write video or source',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);f.release();await ticks();assert.equal(f.urls.size,0);assert.equal(f.records.has('video'),false);assert.equal(f.get().background,'none');
}));
test('blocked database and failed transaction preserve the cached video',check(async f=>{
 const old=f.records.get('video');for(const mode of ['blocked','fail']){f.dbMode(mode);assert.equal((await f.change()).ok,false);assert.equal(f.records.get('video'),old);assert.equal(f.get().background,'none');}f.dbMode('ok');assert.equal((await f.change()).ok,true);
},{stored:{blob:file('old.png'),name:'old.png'}}));
test('DB open timeout closes its late connection without starting a transaction',check(async f=>{
 f.dbMode('hold-open');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);f.dbMode('ok');f.release();await ticks();assert.equal(f.records.has('video'),false);assert.equal(f.get().background,'none');assert.equal(f.urls.size,0);
}));
test('transaction timeout retains writer lease until its late abort terminates',check(async f=>{
 f.dbMode('hold-terminal');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);assert.equal((await f.change()).error,'video-busy');f.dbMode('ok');f.release();await ticks();assert.equal(f.records.has('video'),false);assert.equal((await f.change()).ok,true);
}));
test('source save rejection retains cached file and explicit use recovers without another Blob write',check(async f=>{
 f.hook((op,_k,_v,actual)=>{if(op==='set')throw Error('quota');return actual();});const r=await f.change();assert.equal(r.ok,false);assert.equal(r.mediaSaved,true);assert.equal(f.records.get('video').name,'one.webm');assert.equal(f.get().background,'none');assert.equal(f.api.getSnapshot().videoError,'视频已保存，背景尚未启用');f.hook(null);const puts=f.dbLog.filter(x=>x==='put').length;assert.equal((await f.change('use',null)).ok,true);assert.equal(f.dbLog.filter(x=>x==='put').length,puts);
}));
test('failed source close during remove preserves the original saved file',check(async f=>{
 const old=f.records.get('video');f.hook((op,_k,_v,actual)=>{if(op==='set')throw Error('quota');return actual();});assert.equal((await f.change('remove',null)).ok,false);assert.equal(f.records.get('video'),old);assert.equal(f.get().background,'video');assert.equal(f.dbLog.includes('delete'),false);
},{background:'video',stored:{blob:file(),name:'old.png'}}));
test('delete failure reports actual none and retains file for a new explicit removal',check(async f=>{
 f.dbMode('fail');const r=await f.change('remove',null);assert.equal(r.error,'video-remove-storage');assert.equal(r.applied,true);assert.equal(f.api.getSnapshot().videoError,'视频未能移除，请重试');assert.equal(f.get().background,'none');assert.equal(f.records.has('video'),true);f.dbMode('ok');assert.equal((await f.change('remove',null)).ok,true);assert.equal(f.records.has('video'),false);
},{background:'video',stored:{blob:file(),name:'old.png'}}));
test('a newer appearance choice during decode is retained and prevents replacing the cached file',check(async f=>{
 const old=f.records.get('video');f.decode('hold');const p=f.change();await ticks();f.controller.set('mask',64);f.release();assert.equal((await p).ok,false);assert.equal(f.records.get('video'),old);assert.equal(f.get().mask,64);assert.equal(f.get().background,'none');
},{stored:{blob:file(),name:'old.png'}}));
test('legacy media mutation is refused while native transaction owns the writer',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();assert.equal(await f.controller.media.store('video',file('legacy.png')),false);await f.controller.media.remove('video');f.release();assert.equal((await p).ok,true);assert.equal(f.records.get('video').name,'one.webm');
}));
test('appearance storage drift is not hidden by an video replacement that keeps the same source',check(async f=>{
 const old=f.records.get('video'),n=f.calls.length;f.storage.set('dsh-whale-mist.appearance.v1',JSON.stringify({...f.stored(),mask:77}));const r=await f.change();assert.equal(r.error,'video-settings-unconfirmed');assert.equal(f.records.get('video'),old);assert.equal(f.stored().mask,77);assert.equal(f.calls.length,n);
},{background:'video',stored:{blob:file(),name:'old.png'}}));
test('reentrant settings update from a storage read cannot authorise a stale video mutation',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();let once=false;f.hook((op,_k,_v,actual)=>{const before=actual();if(op==='get'&&!once){once=true;f.controller.set('mask',65);}return before;});f.release();assert.equal((await p).ok,false);assert.equal(f.get().mask,65);assert.equal(f.get().background,'none');assert.equal(f.records.has('video'),false);
}));
test('a genuinely new default configuration can create its first appearance record; a lost existing record cannot',async()=>{
 const f=await rig({missing:true});try{const before=f.get();assert.equal(f.storage.has('dsh-whale-mist.appearance.v1'),false);assert.equal((await f.change()).ok,true);assert.deepEqual(f.get(),{...before,background:'video'});assert.equal(f.stored().background,'video');}finally{await f.cleanup();}
 const existing=await rig();try{existing.storage.delete('dsh-whale-mist.appearance.v1');assert.equal((await existing.change()).error,'video-settings-unconfirmed');assert.equal(existing.records.has('video'),false);}finally{await existing.cleanup();}
});

test('video validation is muted looping inline and detaches its temporary decoder before saving',check(async f=>{
 const picture={blob:mediaFile('keep.png'),name:'keep.png'};f.records.set('image',picture);
 assert.equal((await f.change()).ok,true);const video=f.mediaElements.find(e=>e.tagName==='VIDEO');assert.ok(video);
 for(const k of ['muted','defaultMuted','loop','playsInline','disablePictureInPicture'])assert.equal(video[k],true,k);
 assert.equal(video.preload,'auto');assert.equal(video.src,'');assert.equal(video.paused,true);assert.equal(video.loads,1);
 assert.equal(f.records.get('image'),picture);
}));
test('oversize and unknown MIME videos are rejected before any Host or database mutation',check(async f=>{
 class Oversize extends Blob{get size(){return 1024*1024*1024+1;}}
 const n=f.calls.length,operations=f.dbLog.length;
 for(const value of [new Oversize(['x'],{type:'video/mp4'}),file('x.mov','video/quicktime'),file('x.webm','application/octet-stream')]){
  assert.equal((await f.controller.editBackgroundVideo('replace',value)).error,'video-file-invalid');
 }
 assert.equal(f.calls.length,n);assert.equal(f.dbLog.length,operations);assert.equal(f.records.size,0);
}));
test('video import blocks image and legacy video writers in the same physical lane',check(async f=>{
 f.decode('hold');const task=f.change();await ticks();
 assert.equal((await f.controller.editBackgroundImage('replace',mediaFile())).ok,false);
 assert.equal(await f.controller.media.store('video',file('legacy.webm')),false);
 await f.controller.media.remove('video');f.release();assert.equal((await task).ok,true);
 assert.equal(f.dbLog.filter(x=>x==='put').length,1);assert.equal(f.records.has('image'),false);
}));
test('a cancelled temporary video decoder is detached and late loadeddata cannot persist it',check(async f=>{
 f.decode('hold');const task=f.change();await ticks();const video=f.mediaElements.find(e=>e.tagName==='VIDEO');
 assert.ok(video?.src);f.hide();assert.equal((await task).ok,false);assert.equal(video.src,'');assert.equal(video.paused,true);assert.equal(video.loads,1);
 f.release();await ticks();assert.equal(f.records.has('video'),false);assert.equal(f.get().background,'none');
}));
