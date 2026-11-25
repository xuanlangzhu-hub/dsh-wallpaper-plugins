// Host-only controlled copy. No import-time IO and no browser-selected paths or cache roots.
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join,parse,sep,isAbsolute,extname} from 'node:path';
import {checkPrivateRoot,checkNoReparsePaths} from './media-bridge-permissions.js';
export {checkPrivateRoot};

export const MEDIA_BRIDGE_LIMITS=Object.freeze({maxFileBytes:512*1024*1024,maxTotalBytes:1024*1024*1024,maxLeases:2,maxCopyMs:30000,chunkBytes:1024*1024});
const messages={SELECTION:'refresh the library and select a supported local MP4',ROOT:'use an ASCII private local user directory; no alternate root will be chosen',PERMISSION:'private cache permission could not be confirmed',PATH:'a file path or identity changed; refresh the library',SOURCE:'the source changed; refresh the library before retrying',LIMIT:'media cache limit reached; stop playback or request cache recovery',SPACE:'not enough free space for the media copy',BUSY:'media cache is busy or a previous operation needs recovery',TIMEOUT:'media preparation timed out; retained files require recovery',CANCELLED:'playback was stopped during media preparation',COPY:'media copy verification failed; retained files require recovery',PROOF:'source or worker exit is unconfirmed; retry cleanup',OWNER:'cache ownership changed; files retained for recovery',IO:'media cache operation failed; check access and retry'};
const fail=code=>Object.assign(new Error(`MEDIA_BRIDGE_${code}: ${messages[code]}`),{bridgeCode:code});
const same=(a,b)=>['dev','ino','size','mtimeNs','ctimeNs','birthtimeNs'].every(k=>a[k]===b[k]);
const ownerSame=(a,b)=>['dev','ino','birthtimeNs'].every(k=>a[k]===b[k]);
const localPath=path=>isAbsolute(path)&&!path.startsWith('\\\\')&&!path.startsWith('//')&&!path.slice(parse(path).root.length).includes(':');
const approved=s=>s&&/^we-[0-9a-f]{24}$/.test(s.sceneId)&&s.type==='video'&&typeof s.project==='string'&&typeof s.entry==='string'&&localPath(s.project)&&localPath(s.entry)&&extname(s.project).toLowerCase()==='.json'&&extname(s.entry).toLowerCase()==='.mp4';
const sameSelection=(a,b)=>approved(b)&&['sceneId','type','project','entry'].every(k=>a[k]===b[k]);

export function createMediaBridge({env=process.env,limits:requested={},io=fs,checkRoot=checkPrivateRoot,checkPaths=checkNoReparsePaths,now=Date.now}={}){
 const limits=Object.freeze(Object.fromEntries(Object.entries(MEDIA_BRIDGE_LIMITS).map(([k,v])=>[k,Number.isSafeInteger(requested[k])&&requested[k]>0?Math.min(v,requested[k]):v])));
 const app=typeof env.LOCALAPPDATA==='string'?env.LOCALAPPDATA:'';
 const root=app?join(app,'Whale Appearance','media-bridge'):null;
 const ownLeases=new WeakSet();
 function budget(isCurrent=()=>true,timeoutMs=limits.maxCopyMs){
  const end=now()+timeoutMs,pending=new Set();let expired=false;
  const check=()=>{if(expired||now()>=end){expired=true;throw fail('TIMEOUT');}if(!isCurrent())throw fail('CANCELLED');};
  const run=async (fn,late)=>{check();let timer;const work=Promise.resolve().then(fn);if(late)work.then(value=>{if(expired){try{Promise.resolve(late(value)).catch(()=>{});}catch{}}},()=>{});pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(fail('TIMEOUT'));},Math.max(1,end-now()));})]);}finally{clearTimeout(timer);}};
  return {run,check,pending,remaining:()=>Math.max(0,end-now()),expire:()=>{expired=true;},get expired(){return expired;}};
 }
 async function pathInfo(path,b,{directory=false,single=false}={}){
  if(typeof path!=='string'||!isAbsolute(path)||resolve(path)!==path||/[\x00-\x1f]/.test(path))throw fail('PATH');
  const base=parse(path).root;let current=base;
  for(const component of path.slice(base.length).split(sep).filter(Boolean)){
   current=join(current,component);const st=await b.run(()=>io.lstat(current,{bigint:true}));
   if(st.isSymbolicLink())throw fail('PATH');
  }
  if(await b.run(()=>io.realpath(path))!==path)throw fail('PATH');
  const st=await b.run(()=>io.lstat(path,{bigint:true}));
  if(directory?!st.isDirectory():!st.isFile())throw fail('PATH');
  if(single&&st.nlink!==1n)throw fail('OWNER');
  return st;
 }
 async function openRead(path,b){const before=await pathInfo(path,b,{single:true});const fd=await b.run(()=>io.open(path,'r'),fd=>fd.close());try{if(!same(before,await b.run(()=>fd.stat({bigint:true}))))throw fail('PATH');return {fd,before};}catch(e){await closeAfterIO(fd,b);throw e;}}
 async function hashFile(path,b,max=limits.maxFileBytes){
  const {fd,before}=await openRead(path,b);try{
   if(before.size<1n||before.size>BigInt(max))throw fail('LIMIT');
   const hash=createHash('sha256'),buffer=Buffer.alloc(Math.min(limits.chunkBytes,max));let bytes=0;
   while(true){b.check();const {bytesRead}=await b.run(()=>fd.read(buffer,0,buffer.length,null));if(!bytesRead)break;bytes+=bytesRead;if(bytes>max)throw fail('LIMIT');hash.update(buffer.subarray(0,bytesRead));}
   if(BigInt(bytes)!==before.size||!same(before,await b.run(()=>fd.stat({bigint:true})))||!same(before,await pathInfo(path,b)))throw fail('SOURCE');
   return {stat:before,hash:hash.digest('hex'),bytes};
  }finally{await closeAfterIO(fd,b);}
 }
 // A timed-out IO may still own the handle. Close only once that IO has actually settled.
 function closeAfterIO(fd,b){
  if(!fd)return;const outstanding=[...b.pending];
  const work=Promise.allSettled(outstanding).then(()=>fd.close());b.pending.add(work);work.then(()=>b.pending.delete(work),()=>b.pending.delete(work));work.catch(()=>{b.expire();});
  if(b.expired||outstanding.length)return;
  let timer;return Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{b.expire();resolve();},1000);})]).catch(()=>{throw fail('IO');}).finally(()=>clearTimeout(timer));
 }
 async function privateRoot(b){
  if(!root||!isAbsolute(app)||resolve(app)!==app||!/^[\x20-\x7e]+$/.test(root)||root.startsWith('\\\\')||root.slice(parse(root).root.length).includes(':'))throw fail('ROOT');
  await pathInfo(app,b,{directory:true});await b.run(()=>checkRoot(app));
  for(const dir of [join(app,'Whale Appearance'),root]){
   try{await b.run(()=>io.mkdir(dir,{mode:0o700}));}catch(e){if(e.code!=='EEXIST')throw e;}
   await pathInfo(dir,b,{directory:true});await b.run(()=>checkRoot(dir));
  }
  return await pathInfo(root,b,{directory:true});
 }
 async function smallJson(path,b){
  const st=await pathInfo(path,b,{single:true});if(st.size<1n||st.size>4096n)throw fail('OWNER');
  const {fd,before}=await openRead(path,b);try{const buf=Buffer.alloc(4097);const {bytesRead}=await b.run(()=>fd.read(buf,0,buf.length,0));if(BigInt(bytesRead)!==st.size||!same(before,await pathInfo(path,b)))throw fail('OWNER');return {data:JSON.parse(buf.subarray(0,bytesRead).toString('utf8')),stat:before};}finally{await closeAfterIO(fd,b);}
 }
 async function withLock(b,fn){
  const rootStat=await privateRoot(b),path=join(root,'budget.lock'),token=randomUUID();let fd,st;
  try{fd=await b.run(()=>io.open(path,'wx',0o600),fd=>fd.close());st=await b.run(()=>fd.stat({bigint:true}));await b.run(()=>fd.writeFile(token));await b.run(()=>fd.sync());st=await b.run(()=>fd.stat({bigint:true}));return await fn(rootStat);}
  catch(e){if(e.code==='EEXIST')throw fail('BUSY');throw e;}
  finally{
   await closeAfterIO(fd,b);
   if(fd&&(b.expired||b.pending.size||b.remaining()<=0))throw fail('TIMEOUT');
   // Never unlock around unsettled/late IO, nor steal a lock replaced by another owner.
   if(fd&&!b.expired&&b.pending.size===0){
    try{const check=budget(()=>true,Math.min(1000,b.remaining()));if(!ownerSame(rootStat,await pathInfo(root,check,{directory:true}))||!same(st,await pathInfo(path,check,{single:true}))||(await check.run(()=>io.readFile(path,'utf8')))!==token)throw fail('OWNER');await check.run(()=>io.unlink(path));}catch(e){throw e.bridgeCode?e:fail('BUSY');}
   }
  }
 }
 async function namesAt(path,b,max){
  const dir=await b.run(()=>io.opendir(path),handle=>handle.close());const names=[];
  try{while(true){const entry=await b.run(()=>dir.read());if(!entry)break;names.push(entry.name);if(names.length>max)throw fail('OWNER');}return names;}finally{await closeAfterIO(dir,b);}
 }
 async function allocate(sourceBytes,b){const bytes=sourceBytes*2;return withLock(b,async rootStat=>{
  const names=await namesAt(root,b,65);let total=0,count=0;
  for(const name of names){if(name==='budget.lock')continue;if(!/^lease-[0-9a-f-]{36}$/.test(name))throw fail('OWNER');const dir=join(root,name);await pathInfo(dir,b,{directory:true});const marker=await smallJson(join(dir,'owner.json'),b);if(marker.data.schema!==1||marker.data.lease!==name||!/^[0-9a-f-]{36}$/.test(marker.data.token)||!Number.isSafeInteger(marker.data.bytes)||marker.data.bytes<1||marker.data.bytes>MEDIA_BRIDGE_LIMITS.maxFileBytes*2||!Number.isSafeInteger(marker.data.sourceBytes)||marker.data.bytes!==marker.data.sourceBytes*2)throw fail('OWNER');const files=await namesAt(dir,b,3);for(const file of files){if(!['owner.json','partial.mp4','clip.mp4'].includes(file))throw fail('OWNER');if(file!=='owner.json'){const st=await pathInfo(join(dir,file),b,{single:true});if(st.size>BigInt(marker.data.sourceBytes))throw fail('OWNER');}}total+=marker.data.bytes;count++;}
  if(count>=limits.maxLeases||total+bytes>limits.maxTotalBytes)throw fail('LIMIT');
  const space=await b.run(()=>io.statfs(root,{bigint:true}));if(BigInt(space.bavail)*BigInt(space.bsize)<BigInt(bytes+16*1024*1024))throw fail('SPACE');
  const name='lease-'+randomUUID(),dir=join(root,name),token=randomUUID();
  await b.run(()=>io.mkdir(dir,{mode:0o700}));const dirStat=await pathInfo(dir,b,{directory:true});await b.run(()=>checkRoot(dir));
  const marker=join(dir,'owner.json'),data={schema:1,lease:name,token,bytes,sourceBytes};await b.run(()=>io.writeFile(marker,JSON.stringify(data),{flag:'wx',mode:0o600}));
  return {dir,dirStat,rootStat,marker,markerData:data,markerStat:await pathInfo(marker,b,{single:true}),path:join(dir,'clip.mp4'),partial:join(dir,'partial.mp4')};
 });}
 async function owned(record,b){
  const rt=await privateRoot(b);if(!ownerSame(record.rootStat,rt)||!ownerSame(record.dirStat,await pathInfo(record.dir,b,{directory:true})))throw fail('OWNER');
  await b.run(()=>checkPaths([root,record.dir,record.marker,...(record.published === true ? [record.path] : [record.partial])]));
  const marker=await smallJson(record.marker,b);if(!same(marker.stat,record.markerStat)||JSON.stringify(marker.data)!==JSON.stringify(record.markerData))throw fail('OWNER');
 }
 async function prepare(selection,{reverify,isCurrent=()=>true}={}){
  if(!approved(selection)||typeof reverify!=='function')throw fail('SELECTION');
  const b=budget(isCurrent);let sourceHandle,destHandle;
  try{
   if(!sameSelection(selection,await b.run(reverify)))throw fail('SOURCE');
   await b.run(()=>checkPaths([selection.project,selection.entry]));
   const declaration=await hashFile(selection.project,b,512*1024);
   const source=await openRead(selection.entry,b);sourceHandle=source.fd;
   if(source.before.size<1n||source.before.size>BigInt(limits.maxFileBytes))throw fail('LIMIT');
   const record=await allocate(Number(source.before.size),b);
   destHandle=await b.run(()=>io.open(record.partial,'wx',0o600),fd=>fd.close());
   const hash=createHash('sha256'),buffer=Buffer.alloc(limits.chunkBytes);let bytes=0;
   while(true){b.check();const {bytesRead}=await b.run(()=>sourceHandle.read(buffer,0,buffer.length,null));if(!bytesRead)break;bytes+=bytesRead;if(bytes>limits.maxFileBytes||BigInt(bytes)>source.before.size)throw fail('SOURCE');hash.update(buffer.subarray(0,bytesRead));let at=0;while(at<bytesRead){const result=await b.run(()=>destHandle.write(buffer,at,bytesRead-at,null));if(!result.bytesWritten)throw fail('COPY');at+=result.bytesWritten;}}
   if(BigInt(bytes)!==source.before.size||!same(source.before,await b.run(()=>sourceHandle.stat({bigint:true}))))throw fail('SOURCE');
   await b.run(()=>destHandle.sync());await b.run(()=>destHandle.close());destHandle=null;
   await pathInfo(record.partial,b,{single:true});record.copy=await hashFile(record.partial,b);if(record.copy.bytes!==bytes||record.copy.hash!==hash.digest('hex'))throw fail('COPY');
   const verifySource=async check=>{
    await check.run(()=>checkPaths([selection.project,selection.entry]));
    if(!sameSelection(selection,await check.run(reverify)))throw fail('SOURCE');
    if(!same(source.before,await pathInfo(selection.entry,check)))throw fail('SOURCE');
    const current=await hashFile(selection.project,check,512*1024);if(current.hash!==declaration.hash||!same(current.stat,declaration.stat))throw fail('SOURCE');
   };
   await verifySource(b);await owned(record,b);b.check();
   try{await b.run(()=>io.lstat(record.path));throw fail('OWNER');}catch(e){if(e.code!=='ENOENT')throw e;}
   // COPYFILE_EXCL refuses a collision atomically. Rename would overwrite an existing
   // destination on Windows. Reserve both files while this publication copy is in flight.
   await b.run(()=>io.copyFile(record.partial,record.path,constants.COPYFILE_EXCL));
   await pathInfo(record.path,b,{single:true});const published=await hashFile(record.path,b);
   if(published.hash!==record.copy.hash||!same(record.copy.stat,await pathInfo(record.partial,b,{single:true})))throw fail('COPY');
   await verifySource(b);await owned(record,b);
   await b.run(()=>io.unlink(record.partial));record.copy=published;record.published=true;
   if(record.copy.bytes!==bytes)throw fail('COPY');b.check();
   let released=false;
   const lease={path:record.path,
    async verify(){if(released)throw fail('OWNER');const check=budget(isCurrent);try{await owned(record,check);await verifySource(check);const copy=await hashFile(record.path,check);if(!same(copy.stat,record.copy.stat)||copy.hash!==record.copy.hash)throw fail('COPY');check.check();}catch(e){throw e.bridgeCode?e:fail('IO');}},
    async release(proof){if(!ownLeases.has(lease))throw fail('OWNER');if(released)return;if(proof?.neverOpened!==true&&!(proof?.closed===true&&proof?.workersExited===true))throw fail('PROOF');const check=budget();try{await withLock(check,async()=>{
      await owned(record,check);const names=await namesAt(record.dir,check,3);if(names.length!==2||!names.includes('clip.mp4')||!names.includes('owner.json'))throw fail('OWNER');
      if(!same(record.copy.stat,await pathInfo(record.path,check,{single:true})))throw fail('OWNER');
      // Validate all before deleting any; no recursive deletion or discovery of historical caches.
      await check.run(()=>io.unlink(record.path));await check.run(()=>io.unlink(record.marker));await check.run(()=>io.rmdir(record.dir));released=true;
     });}catch(e){throw e.bridgeCode?e:fail('IO');}}
   };
   ownLeases.add(lease);return lease;
  }catch(e){throw e.bridgeCode?e:fail('IO');}
  finally{await closeAfterIO(sourceHandle,b);await closeAfterIO(destHandle,b);if(b.expired)throw fail('TIMEOUT');}
 }
 return {prepare,limits};
}
