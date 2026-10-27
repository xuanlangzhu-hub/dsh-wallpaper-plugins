import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rig,ticks,file} from './local-media-fixture.mjs';
const check=(fn,options)=>async()=>{const f=await rig(options);try{await fn(f);}finally{await f.cleanup();}};

test('native image selection changes only source and reuses image DB key without playback',check(async f=>{
 const before=f.get(),n=f.calls.length;const r=await f.change();assert.equal(r.ok,true,r.error);assert.deepEqual(f.get(),{...before,background:'image'});assert.equal(f.stored().background,'image');assert.equal(f.records.get('image').name,'one.png');assert.equal(f.controller.media.getSnapshot().media.image.name,'one.png');assert.equal(f.host.sessions.length,0);assert.equal(f.calls.slice(n).filter(c=>/\/(start|stop|restart)$/.test(c.url)).length,0);
}));
test('an unreadable replacement preserves the original Blob and source',check(async f=>{
 const original=f.records.get('image');f.decode('fail');const r=await f.change();assert.equal(r.error,'image-decode');assert.equal(f.records.get('image'),original);assert.equal(f.get().background,'image');assert.equal(f.api.getSnapshot().imageError,'图片无法读取，请换一张');assert.equal(f.urls.size,0);
},{background:'image',stored:{blob:file('old.png'),name:'old.png'}}));
test('replacement while image source active stores only image and retains all appearance choices',check(async f=>{
 const before=f.get(),writes=f.writes.length;const r=await f.change('replace',file('two.webp','image/webp'));assert.equal(r.ok,true,r.error);assert.deepEqual(f.get(),before);assert.equal(f.writes.length,writes);assert.equal(f.records.get('image').name,'two.webp');
},{background:'image',stored:{blob:file('old.png'),name:'old.png'}}));
test('remove switches image source off before deleting the saved image',check(async f=>{
 let sourceAtDelete;f.readHook(()=>{sourceAtDelete=f.get().background;});const r=await f.change('remove',null);assert.equal(r.ok,true,r.error);assert.equal(sourceAtDelete,'none');assert.equal(f.get().background,'none');assert.equal(f.stored().background,'none');assert.equal(f.records.has('image'),false);assert.equal(f.controller.media.getSnapshot().media.image,null);
},{background:'image',stored:{blob:file(),name:'old.png'}}));
test('removing a cached image while source is none does not write appearance or change other media',check(async f=>{
 f.records.set('video',{blob:file('video','video/mp4'),name:'video'});const n=f.writes.length;assert.equal((await f.change('remove',null)).ok,true);assert.equal(f.get().background,'none');assert.equal(f.writes.length,n);assert.equal(f.records.get('video').name,'video');
},{stored:{blob:file(),name:'old.png'}}));
test('using saved image validates it and activates without another Blob write',check(async f=>{
 const puts=f.dbLog.filter(op=>op==='put').length;assert.equal((await f.change('use',null)).ok,true);assert.equal(f.get().background,'image');assert.equal(f.dbLog.filter(op=>op==='put').length,puts);
},{stored:{blob:file(),name:'old.png'}}));
test('missing cached image cannot activate a source',check(async f=>{const r=await f.change('use',null);assert.equal(r.error,'image-missing');assert.equal(f.get().background,'none');assert.equal(f.writes.length,0);}));
test('invalid zero-size non-image and unsupported SVG files reject before lifecycle IO',check(async f=>{
 const n=f.calls.length;for(const blob of [null,{},new Blob([],{type:'image/png'}),file('x','text/plain'),file('x.svg','image/svg+xml')]){const r=await f.controller.editBackgroundImage('replace',blob);assert.equal(r.error,'image-file-invalid');}assert.equal(f.calls.length,n);assert.equal(f.writes.length,0);
}));
test('wallpaper and video cannot be silently stopped by the new image API',async()=>{
 for(const background of ['wallpaper','video']){const f=await rig({background});try{const n=f.calls.length;assert.equal((await f.controller.editBackgroundImage('replace',file())).error,'image-unavailable');assert.equal(f.api.getSnapshot().showLocalImage,false);assert.equal(f.calls.length,n);}finally{await f.cleanup();}}
});
test('foreign active Host prevents image persistence without issuing a stop',check(async f=>{
 await f.host.start();const r=await f.change();assert.equal(r.ok,false);assert.equal(f.records.has('image'),false);assert.equal(f.host.sessions[0].calls.includes('stop'),false);
}));
test('cancelled file selection consumes no image ticket or storage work',check(async f=>{
 const n=f.calls.length,ticket=f.api.getSnapshot().imageTicket;assert.equal((await f.api.imageAction('replace',null,ticket,f.token)).error,'image-cancelled');assert.equal(f.api.getSnapshot().imageTicket,ticket);assert.equal(f.calls.length,n);
}));
test('busy lane rejects duplicate image and enable requests without another write',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();assert.equal(f.api.getSnapshot().imageBusy,true);assert.equal((await f.change()).ok,false);assert.equal((await f.controller.enableBackgroundSource()).ok,false);f.release();assert.equal((await p).ok,true);assert.equal(f.dbLog.filter(op=>op==='put').length,1);
}));
test('hidden then visible view and session or theme round trips revoke old picker tickets',async()=>{
 for(const mutate of [f=>{f.hide();f.show();},f=>{f.session('s2');f.session('s1');},f=>{f.theme('whale-mist');f.theme('whale-abyss');}]){const f=await rig();try{const t=f.api.getSnapshot().imageTicket;mutate(f);assert.equal((await f.api.imageAction('replace',file(),t,f.token)).error,'image-stale');assert.equal(f.writes.length,0);}finally{await f.cleanup();}}
});
test('view hidden during decode cancels before DB mutation and never changes source',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();f.hide();f.release();const r=await p;assert.equal(r.ok,false);assert.equal(f.records.has('image'),false);assert.equal(f.get().background,'none');assert.equal(f.urls.size,0);
}));
test('decode deadline releases URL and a late decoder cannot write image or source',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);f.release();await ticks();assert.equal(f.urls.size,0);assert.equal(f.records.has('image'),false);assert.equal(f.get().background,'none');
}));
test('blocked database and failed transaction preserve the cached image',check(async f=>{
 const old=f.records.get('image');for(const mode of ['blocked','fail']){f.dbMode(mode);assert.equal((await f.change()).ok,false);assert.equal(f.records.get('image'),old);assert.equal(f.get().background,'none');}f.dbMode('ok');assert.equal((await f.change()).ok,true);
},{stored:{blob:file('old.png'),name:'old.png'}}));
test('DB open timeout closes its late connection without starting a transaction',check(async f=>{
 f.dbMode('hold-open');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);f.dbMode('ok');f.release();await ticks();assert.equal(f.records.has('image'),false);assert.equal(f.get().background,'none');assert.equal(f.urls.size,0);
}));
test('transaction timeout retains writer lease until its late abort terminates',check(async f=>{
 f.dbMode('hold-terminal');const p=f.change();await ticks();f.expireImage();assert.equal((await p).ok,false);assert.equal((await f.change()).error,'image-busy');f.dbMode('ok');f.release();await ticks();assert.equal(f.records.has('image'),false);assert.equal((await f.change()).ok,true);
}));
test('source save rejection retains cached file and explicit use recovers without another Blob write',check(async f=>{
 f.hook((op,_k,_v,actual)=>{if(op==='set')throw Error('quota');return actual();});const r=await f.change();assert.equal(r.ok,false);assert.equal(r.mediaSaved,true);assert.equal(f.records.get('image').name,'one.png');assert.equal(f.get().background,'none');assert.equal(f.api.getSnapshot().imageError,'图片已保存，背景尚未启用');f.hook(null);const puts=f.dbLog.filter(x=>x==='put').length;assert.equal((await f.change('use',null)).ok,true);assert.equal(f.dbLog.filter(x=>x==='put').length,puts);
}));
test('failed source close during remove preserves the original saved file',check(async f=>{
 const old=f.records.get('image');f.hook((op,_k,_v,actual)=>{if(op==='set')throw Error('quota');return actual();});assert.equal((await f.change('remove',null)).ok,false);assert.equal(f.records.get('image'),old);assert.equal(f.get().background,'image');assert.equal(f.dbLog.includes('delete'),false);
},{background:'image',stored:{blob:file(),name:'old.png'}}));
test('delete failure reports actual none and retains file for a new explicit removal',check(async f=>{
 f.dbMode('fail');const r=await f.change('remove',null);assert.equal(r.error,'image-remove-storage');assert.equal(r.applied,true);assert.equal(f.api.getSnapshot().imageError,'图片未能移除，请重试');assert.equal(f.get().background,'none');assert.equal(f.records.has('image'),true);f.dbMode('ok');assert.equal((await f.change('remove',null)).ok,true);assert.equal(f.records.has('image'),false);
},{background:'image',stored:{blob:file(),name:'old.png'}}));
test('a newer appearance choice during decode is retained and prevents replacing the cached file',check(async f=>{
 const old=f.records.get('image');f.decode('hold');const p=f.change();await ticks();f.controller.set('mask',64);f.release();assert.equal((await p).ok,false);assert.equal(f.records.get('image'),old);assert.equal(f.get().mask,64);assert.equal(f.get().background,'none');
},{stored:{blob:file(),name:'old.png'}}));
test('legacy media mutation is refused while native transaction owns the writer',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();assert.equal(await f.controller.media.store('image',file('legacy.png')),false);await f.controller.media.remove('image');f.release();assert.equal((await p).ok,true);assert.equal(f.records.get('image').name,'one.png');
}));
test('appearance storage drift is not hidden by an image replacement that keeps the same source',check(async f=>{
 const old=f.records.get('image'),n=f.calls.length;f.storage.set('dsh-whale-mist.appearance.v1',JSON.stringify({...f.stored(),mask:77}));const r=await f.change();assert.equal(r.error,'image-settings-unconfirmed');assert.equal(f.records.get('image'),old);assert.equal(f.stored().mask,77);assert.equal(f.calls.length,n);
},{background:'image',stored:{blob:file(),name:'old.png'}}));
test('reentrant settings update from a storage read cannot authorise a stale image mutation',check(async f=>{
 f.decode('hold');const p=f.change();await ticks();let once=false;f.hook((op,_k,_v,actual)=>{const before=actual();if(op==='get'&&!once){once=true;f.controller.set('mask',65);}return before;});f.release();assert.equal((await p).ok,false);assert.equal(f.get().mask,65);assert.equal(f.get().background,'none');assert.equal(f.records.has('image'),false);
}));
test('a genuinely new default configuration can create its first appearance record; a lost existing record cannot',async()=>{
 const f=await rig({missing:true});try{const before=f.get();assert.equal(f.storage.has('dsh-whale-mist.appearance.v1'),false);assert.equal((await f.change()).ok,true);assert.deepEqual(f.get(),{...before,background:'image'});assert.equal(f.stored().background,'image');}finally{await f.cleanup();}
 const existing=await rig();try{existing.storage.delete('dsh-whale-mist.appearance.v1');assert.equal((await existing.change()).error,'image-settings-unconfirmed');assert.equal(existing.records.has('image'),false);}finally{await existing.cleanup();}
});
