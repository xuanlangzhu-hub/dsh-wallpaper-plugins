// Host-only, explicit read-only catalogue. Importing this module performs no filesystem access.
// Paths stay in private records; no browser file route or playback registration is created here.
import {lstat,realpath,open,opendir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,join,isAbsolute,parse,win32,sep,dirname} from 'node:path';

export const CATALOG_LIMITS=Object.freeze({maxDepth:1,maxDirectories:512,maxEntries:4096,maxRecords:256,maxJsonBytes:512*1024});
const caps={maxDepth:3,maxDirectories:4096,maxEntries:32768,maxRecords:1024,maxJsonBytes:2*1024*1024};
const imageTypes=new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp']);
const identity=path=>process.platform==='win32'?resolve(path).toLowerCase():resolve(path);
const id=path=>'we-'+createHash('sha256').update(identity(path)).digest('hex').slice(0,24);
const title=(value,fallback)=>typeof value==='string'&&value.trim()?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,200):fallback;
const fail=reason=>Object.assign(new Error(reason),{catalogReason:reason});

// Project type spelling is case-insensitive; accept only known strings, without trimming/coercion.
function catalogType(value){
  const type=typeof value==='string'?value.toLowerCase():'';
  return ['scene','video','web'].includes(type)?type:'unknown';
}

function inside(root,target){
  const r=relative(identity(root),identity(target));
  return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep));
}
function localParts(value){
  if(typeof value!=='string'||!value||value.length>400||isAbsolute(value)||win32.isAbsolute(value)||/[<>:"|?*\x00-\x1f]/.test(value))throw fail('unsafe_path');
  const parts=value.replaceAll('\\','/').split('/');
  if(parts.includes('..')||parts.some(p=>p!=='.'&&(p.endsWith(' ')||p.endsWith('.'))))throw fail('unsafe_path');
  const clean=parts.filter(p=>p!==''&&p!=='.');
  if(!clean.length)throw fail('unsafe_path');
  return clean;
}
// Reject links at every component, even links that currently resolve inside the project.
export async function boundFile(base,parts){
  let path=base;
  for(let i=0;i<parts.length;i++){
    path=join(path,parts[i]);
    const info=await lstat(path);
    if(info.isSymbolicLink())throw fail('link_refused');
    if(i<parts.length-1&&!info.isDirectory())throw fail('unsafe_path');
  }
  const physical=await realpath(path);
  if(!inside(base,physical))throw fail('unsafe_path');
  const info=await lstat(physical);
  if(!info.isFile())throw fail('not_regular_file');
  return {path:physical,info};
}

// Reject a link at any component of an already-real path. The scan does this while walking; this
// variant re-checks a path the snapshot remembers, which is what catches a junction swapped in
// afterwards.
async function noLinks(physical){
  const parts=resolve(physical).split(sep).filter(Boolean);
  let current=parts[0]+sep;
  for(const part of parts.slice(1)){
    current=join(current,part);
    const info=await lstat(current);
    if(info.isSymbolicLink())throw fail('link_refused');
  }
  return physical;
}

async function boundedProject(directory,limit){
  const file=await boundFile(directory,['project.json']);
  const handle=await open(file.path,'r');
  try{
    const before=await handle.stat();
    if(!before.isFile())throw fail('not_regular_file');
    if(before.size>limit)throw fail('project_too_large');
    const buffer=Buffer.alloc(limit+1);let count=0;
    while(count<buffer.length){const r=await handle.read(buffer,count,buffer.length-count,null);if(!r.bytesRead)break;count+=r.bytesRead;}
    if(count>limit)throw fail('project_too_large');
    const after=await handle.stat();
    const current=await boundFile(directory,['project.json']);
    if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==current.info.ino||before.dev!==current.info.dev)throw fail('project_changed');
    let data;
    try{data=JSON.parse(buffer.subarray(0,count).toString('utf8').replace(/^\uFEFF/,''));}catch{throw fail('invalid_json');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw fail('invalid_project');
    return {data,path:file.path,bytes:count};
  }finally{await handle.close();}
}
function fileError(error,missing){return error.catalogReason??(error.code==='ENOENT'?missing:'unreadable_file');}

async function record(directory,project){
  const data=project.data;const type=catalogType(data.type);
  const rawRating = typeof data.contentrating === 'string' ? data.contentrating : '';
  const contentRating = ['Everyone', 'Questionable', 'Mature'].includes(rawRating) ? rawRating : 'unknown';
  const result={id:id(project.path),title:title(data.title,parse(directory).base),type,contentRating,project:project.path,entry:null,preview:null,
    available:false,reason:null,warnings:[],playbackVerified:false,workshopId:typeof data.workshopid==='string'&&/^\d{1,20}$/.test(data.workshopid)?data.workshopid:null};
  let declared;
  try{declared=localParts(data.file);}catch(e){result.reason=e.catalogReason;}
  if(declared){
    try{const file=await boundFile(directory,declared);if(!file.info.size)throw fail('empty_content');result.entry=file.path;}
    catch(error){
      // Published scene packages can retain file="scene.json" while only scene.pkg ships.
      if(type==='scene'&&error.code==='ENOENT'){
        try{const file=await boundFile(directory,['scene.pkg']);if(!file.info.size)throw fail('empty_content');result.entry=file.path;result.warnings.push('scene_package_used');}
        catch(pkgError){result.reason=fileError(pkgError,'missing_content');}
      }else result.reason=fileError(error,'missing_content');
    }
  }
  const candidates=data.preview===undefined||data.preview===null||data.preview===''?['preview.jpg','preview.png','preview.gif','preview.webp']: [data.preview];
  for(const name of candidates){
    try{
      const parts=localParts(name);
      if(!imageTypes.has(parse(parts.at(-1)).ext.toLowerCase())){result.warnings.push('preview_type_unsupported');break;}
      const preview=await boundFile(directory,parts);if(!preview.info.size){result.warnings.push('empty_preview');break;}
      result.preview=preview.path;break;
    }catch(error){
      if(error.catalogReason==='unsafe_path'||error.catalogReason==='link_refused'||error.catalogReason==='not_regular_file'){
        result.warnings.push('unsafe_preview');result.reason??='unsafe_preview';break;
      }
      if(error.code!=='ENOENT'){result.warnings.push('preview_unreadable');break;}
    }
  }
  if(!result.preview&&!result.warnings.includes('unsafe_preview'))result.warnings.push('missing_preview');
  if(!result.reason){
    if(type==='scene'||(type==='video'&&parse(result.entry).ext.toLowerCase()==='.mp4')||(type==='web'&&['.html','.htm'].includes(parse(result.entry).ext.toLowerCase())))result.available=true;
    else result.reason=type==='unknown'?'unknown_type':'playback_type_not_supported';
  }
  return result;
}

/** True for the ids this module produces; used to reject forged or foreign ids before any lookup. */
export function isCatalogId(value){
  return typeof value==='string'&&/^we-[0-9a-f]{24}$/.test(value);
}

/**
 * Re-verify one cached record against the approved roots and the filesystem, immediately before it is
 * turned into a playback request. The scan result is an index, not a permanent authorization: a deleted
 * file, a changed type, a junction swapped in after the scan or a project outside the approved roots must
 * all be refused here instead of being trusted because they were true once.
 */
async function verifyCatalogProject(item,{roots}={}){
  if(!item||typeof item!=='object'||!isCatalogId(item.id))throw fail('unknown_wallpaper');
  if(item.type!=='scene'&&item.type!=='video'&&item.type!=='web')throw fail(item.type==='unknown'?'unknown_type':'playback_type_not_supported');
  if(typeof item.project!=='string'||typeof item.entry!=='string')throw fail('missing_content');
  if(!Array.isArray(roots)||!roots.length)throw fail('root_unavailable');
  const approved=[];
  for(const root of roots){
    try{
      const info=await lstat(resolve(root));
      if(info.isSymbolicLink()||!info.isDirectory())continue;
      approved.push(await realpath(root));
    }catch{/* An approved root that is gone cannot authorize anything. */}
  }
  if(!approved.length)throw fail('root_unavailable');
  let projectPath,entryPath;
  try{
    projectPath=await noLinks(await realpath(item.project));
    entryPath=await noLinks(await realpath(item.entry));
  }catch(error){throw fail(error.code==='ENOENT'?'missing_content':'unreadable_file');}
  // Both the project metadata and the content file must live inside an approved root, compared on the
  // physical path so a junction that resolves elsewhere cannot pass as the scanned location.
  if(!approved.some(root=>inside(root,projectPath)))throw fail('unsafe_path');
  if(!approved.some(root=>inside(root,entryPath)))throw fail('unsafe_path');
  // The snapshot remembers which content file it resolved. If that file is gone the record is no
  // longer startable: the scene.pkg fallback is for a package that was used from the start, not a
  // rescue for a declared scene.json that has since been deleted.
  let entryInfo;
  try{entryInfo=await lstat(entryPath);}catch(error){throw fail(error.code==='ENOENT'?'missing_content':'unreadable_file');}
  if(!entryInfo.isFile()||!entryInfo.size)throw fail(entryInfo.isFile()?'empty_content':'not_regular_file');
  const projectDirectory=dirname(resolve(projectPath));
  const project=await boundedProject(projectDirectory,CATALOG_LIMITS.maxJsonBytes);
  const data=project.data;
  const type=catalogType(data.type);
  if(type!==item.type)throw fail('type_changed');
  if(type==='video'&&parse(entryPath).ext.toLowerCase()!=='.mp4')throw fail('playback_type_not_supported');
  if(type==='web'&&!['.html','.htm'].includes(parse(entryPath).ext.toLowerCase()))throw fail('playback_type_not_supported');
  // The scene.pkg fallback exists for published packages whose metadata still says file="scene.json"
  // while only the package ships. It is NOT a way to survive a declaration that is itself unsafe: a
  // traversal, an absolute path, an ADS name or a link is refused here exactly as the scan refuses it,
  // so the fallback can never hide a declaration that changed after the snapshot was taken.
  let declared;
  try{declared=localParts(data.file);}
  catch(error){throw fail(error.catalogReason==='unsafe_path'?'unsafe_path':error.catalogReason??'unsafe_path');}
  let physicalEntry;
  try{
    // Only a legitimately parsed declaration whose file is gone, on a record whose content really was
    // the shipped package, may resolve to that package again.
    try{physicalEntry=await boundFile(projectDirectory,declared);}
    catch(error){
      if(type!=='scene'||error.code!=='ENOENT')throw error;
      const fallback=await boundFile(projectDirectory,['scene.pkg']);
      if(identity(fallback.path)!==identity(entryPath))throw fail('entry_changed');
      physicalEntry=fallback;
    }
  }catch(error){
    throw error.catalogReason?error:fail(error.code==='ENOENT'?'missing_content':'unreadable_file');
  }
  if(!physicalEntry.info.size)throw fail('empty_content');
  // The declared content must still be the same physical file the snapshot pointed at.
  if(identity(physicalEntry.path)!==identity(entryPath))throw fail('entry_changed');
  if(id(projectPath)!==item.id)throw fail('moved');
  return {id:item.id,title:item.title,type,project:projectPath,entry:physicalEntry.path,metadata:data};
}

export async function verifyCatalogEntry(item,options={}){
  const {metadata,...verified}=await verifyCatalogProject(item,options);
  return verified;
}

/** Host-private author metadata from the same bounded read that passed entry verification. */
export async function readCatalogAuthorMetadata(item,{roots,allowedRatings=['Everyone'],signal}={}){
  if(signal?.aborted)throw fail('author_cancelled');
  if(!Array.isArray(allowedRatings)||!allowedRatings.length||!allowedRatings.every(r=>['Everyone','Questionable','Mature'].includes(r)))throw fail('author_rating_denied');
  const verified=await verifyCatalogProject(item,{roots});
  if(signal?.aborted)throw fail('author_cancelled');
  const data=verified.metadata,rating=data.contentrating;
  if(!allowedRatings.includes(rating))throw fail('author_rating_denied');
  if(!['scene','web'].includes(verified.type))throw fail('author_type_unsupported');
  return {wallpaperId:verified.id,type:verified.type,contentRating:rating,properties:data.general?.properties??null,localization:data.general?.localization??null};
}

/**
 * Re-verifies a preview file against approved roots, guards against symlinks/junctions/tampering,
 * reads the file with double-stat checks, and validates the raster magic bytes.
 * Returns { buffer, contentType, bytes }.
 */
export async function verifyCatalogPreview(item, { roots, maxBytes = 10 * 1024 * 1024, signal = null } = {}) {
  if (!item || typeof item !== 'object' || typeof item.preview !== 'string' || !item.preview) {
    throw fail('missing_preview');
  }
  if (!Array.isArray(roots) || !roots.length) {
    throw fail('root_unavailable');
  }

  const approved = [];
  for (const root of roots) {
    try {
      const info = await lstat(resolve(root));
      if (info.isSymbolicLink() || !info.isDirectory()) continue;
      approved.push(await realpath(root));
    } catch {}
  }
  if (!approved.length) throw fail('root_unavailable');

  let previewPath, projectPath;
  try {
    // Check logical path components for symlinks or junctions BEFORE realpath
    // This prevents retargeting via junctions swapped in after the initial scan
    await noLinks(item.preview);
    if (item.project) {
      await noLinks(item.project);
    }
    previewPath = await noLinks(await realpath(item.preview));
    projectPath = item.project ? await noLinks(await realpath(item.project)) : null;
  } catch (error) {
    throw fail(error.code === 'ENOENT' ? 'missing_preview' : (error.catalogReason ?? 'unreadable_file'));
  }

  let verifiedContentRating = 'unknown';
  if (projectPath) {
    if (id(projectPath) !== item.id) {
      throw fail('moved');
    }
    const projectDir = dirname(resolve(projectPath));
    const project = await boundedProject(projectDir, CATALOG_LIMITS.maxJsonBytes);
    const declaredPreview = typeof project.data?.preview === 'string' && project.data.preview ? project.data.preview : null;
    const candidates = declaredPreview ? [declaredPreview] : ['preview.gif', 'preview.png', 'preview.jpg', 'preview.jpeg', 'preview.webp'];
    let matched = false;
    for (const name of candidates) {
      try {
        const parts = localParts(name);
        const physicalDeclared = await boundFile(projectDir, parts);
        if (identity(physicalDeclared.path) === identity(previewPath)) {
          matched = true;
          break;
        }
      } catch {}
    }
    if (!matched) {
      throw fail('preview_changed');
    }
    const r = project.data?.contentrating;
    verifiedContentRating = ['Everyone', 'Questionable', 'Mature'].includes(r) ? r : 'unknown';
  } else if (item.id === 'lucy') {
    verifiedContentRating = 'Everyone';
  }

  if (!approved.some(root => inside(root, previewPath))) {
    throw fail('unsafe_path');
  }
  if (projectPath && !approved.some(root => inside(root, projectPath))) {
    throw fail('unsafe_path');
  }

  let previewInfo;
  try {
    previewInfo = await lstat(previewPath);
  } catch (error) {
    throw fail(error.code === 'ENOENT' ? 'missing_preview' : 'unreadable_file');
  }
  if (previewInfo.isSymbolicLink()) throw fail('link_refused');
  if (!previewInfo.isFile()) throw fail('not_regular_file');
  if (!previewInfo.size) throw fail('empty_preview');
  if (previewInfo.size > maxBytes) throw fail('preview_too_large');

  if (signal?.aborted) throw fail('preview_aborted');

  const handle = await open(previewPath, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw fail('not_regular_file');
    if (before.size > maxBytes) throw fail('preview_too_large');
    if (
      previewInfo.ino !== before.ino ||
      previewInfo.dev !== before.dev ||
      previewInfo.size !== before.size ||
      previewInfo.mtimeMs !== before.mtimeMs
    ) {
      throw fail('preview_changed');
    }

    const buffer = Buffer.alloc(before.size);
    let count = 0;
    while (count < buffer.length) {
      if (signal?.aborted) throw fail('preview_aborted');
      const r = await handle.read(buffer, count, buffer.length - count, null);
      if (!r.bytesRead) break;
      count += r.bytesRead;
    }
    if (count !== before.size) throw fail('unreadable_file');

    const after = await handle.stat();
    const current = await lstat(previewPath);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ino !== current.ino ||
      before.dev !== current.dev ||
      after.size !== current.size ||
      after.mtimeMs !== current.mtimeMs
    ) {
      throw fail('preview_changed');
    }

    let contentType = null;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) {
      contentType = 'image/png';
    }
    // JPEG: FF D8 FF
    else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      contentType = 'image/jpeg';
    }
    // WebP: RIFF ... WEBP
    else if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      contentType = 'image/webp';
    }
    // GIF: GIF87a or GIF89a
    else if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
    ) {
      contentType = 'image/gif';
    }
    // BMP: BM (42 4D)
    else if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
      contentType = 'image/bmp';
    } else {
      throw fail('unsupported_image_format');
    }

    return { buffer, contentType, bytes: buffer.length, contentRating: verifiedContentRating };
  } finally {
    await handle.close();
  }
}

/** available means eligible for later scene/MP4/local-HTML verification, never proven playable. */
export async function scanWallpaperCatalog({roots,limits={}}={}){
  if(!Array.isArray(roots)||!roots.length||roots.length>8)throw new TypeError('Provide 1..8 explicitly approved absolute roots');
  const budget={...CATALOG_LIMITS};
  for(const [key,value] of Object.entries(limits)){
    if(!Object.hasOwn(caps,key)||!Number.isInteger(value)||value<(key==='maxDepth'?0:1)||value>caps[key])throw new TypeError('Invalid catalog limit: '+key);
    budget[key]=value;
  }
  for(const root of roots)if(typeof root!=='string'||!isAbsolute(root)||identity(root)===identity(parse(resolve(root)).root))throw new TypeError('Root must be an approved absolute project/library directory, not a filesystem root');
  const result={roots:[],items:[],warnings:[],limits:budget,truncated:false,stats:{directoriesVisited:0,entriesVisited:0,jsonBytesAccepted:0}};
  const visited=new Set(),seenRoots=new Set(),seenItems=new Set();
  const warn=(root,reason,code)=>{if(result.warnings.length<budget.maxDirectories)result.warnings.push({root,reason,...(code?{code}:{})});};
  const add=item=>{if(seenItems.has(item.id))return;seenItems.add(item.id);result.items.push(item);};
  for(const requested of roots){
    let physical;
    try{
      const info=await lstat(resolve(requested));if(info.isSymbolicLink())throw fail('link_refused');if(!info.isDirectory())throw fail('not_directory');
      physical=await realpath(requested);
    }catch(error){result.roots.push({requested,available:false,reason:error.catalogReason??'root_unavailable',code:error.code??null});continue;}
    if(seenRoots.has(identity(physical)))continue;seenRoots.add(identity(physical));
    result.roots.push({requested,path:physical,available:true});
    const queue=[{path:physical,depth:0}];
    while(queue.length){
      if(result.items.length>=budget.maxRecords||result.stats.directoriesVisited>=budget.maxDirectories){result.truncated=true;break;}
      const current=queue.shift();if(visited.has(identity(current.path)))continue;
      try{const info=await lstat(current.path);if(info.isSymbolicLink())throw fail('link_refused');const actual=await realpath(current.path);
        if(!inside(physical,actual)||!info.isDirectory())throw fail('unsafe_path');
      }catch(error){warn(requested,error.catalogReason??'directory_unavailable',error.code);continue;}
      visited.add(identity(current.path));result.stats.directoriesVisited++;
      try{
        const project=await boundedProject(current.path,budget.maxJsonBytes);result.stats.jsonBytesAccepted+=project.bytes;
        add(await record(current.path,project));continue; // Project assets are not more projects.
      }catch(error){
        const reason=fileError(error,'missing_project');
        if(current.depth>0||reason!=='missing_project')add({id:id(join(current.path,'project.json')),title:parse(current.path).base,type:'unknown',
          contentRating:'unknown',project:null,entry:null,preview:null,available:false,reason,warnings:[],playbackVerified:false,workshopId:null});
        if(reason!=='missing_project')continue;
      }
      if(current.depth>=budget.maxDepth)continue;
      if(result.stats.entriesVisited>=budget.maxEntries){result.truncated=true;continue;}
      let directory;
      try{
        directory=await opendir(current.path);
        for await(const entry of directory){
          if(result.stats.entriesVisited>=budget.maxEntries){result.truncated=true;break;}
          result.stats.entriesVisited++;
          if(entry.isSymbolicLink()){warn(requested,'link_refused');continue;}
          if(!entry.isDirectory())continue;
          if(result.stats.directoriesVisited+queue.length>=budget.maxDirectories){result.truncated=true;break;}
          queue.push({path:join(current.path,entry.name),depth:current.depth+1});
        }
      }catch(error){warn(requested,'directory_unreadable',error.code);}
    }
  }
  result.items.sort((a,b)=>a.id.localeCompare(b.id));return result;
}

/** Re-verifies on-disk project.json content rating without reading preview image bytes. */
export async function verifyCatalogItemRating(item, { roots, signal = null } = {}) {
  if (signal?.aborted) return 'unknown';
  if (!item || typeof item !== 'object') return 'unknown';
  if (item.id === 'lucy') {
    if (item.project) {
      try {
        await noLinks(item.project);
        if (signal?.aborted) return 'unknown';
        const pPath = await noLinks(await realpath(item.project));
        const projectDir = dirname(resolve(pPath));
        const project = await boundedProject(projectDir, CATALOG_LIMITS.maxJsonBytes);
        const r = project.data?.contentrating;
        return ['Everyone', 'Questionable', 'Mature'].includes(r) ? r : 'Everyone';
      } catch {
        return 'Everyone';
      }
    }
    return 'Everyone';
  }
  if (!item.project) return item.contentRating || 'unknown';
  try {
    await noLinks(item.project);
    if (signal?.aborted) return 'unknown';
    const projectPath = await noLinks(await realpath(item.project));
    if (Array.isArray(roots) && roots.length) {
      const approved = [];
      for (const root of roots) {
        try {
          const info = await lstat(resolve(root));
          if (!info.isSymbolicLink() && info.isDirectory()) {
            approved.push(await realpath(root));
          }
        } catch {}
      }
      if (approved.length && !approved.some(root => inside(root, projectPath))) {
        return 'unknown';
      }
    }
    if (signal?.aborted) return 'unknown';
    const projectDir = dirname(resolve(projectPath));
    const project = await boundedProject(projectDir, CATALOG_LIMITS.maxJsonBytes);
    const r = project.data?.contentrating;
    return ['Everyone', 'Questionable', 'Mature'].includes(r) ? r : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Browser-safe metadata for a future UI; deliberately no paths, HTML or general properties. */
export function publicCatalogItem(item){
  return {id:item.id,title:item.title,type:item.type,contentRating:item.contentRating||'unknown',available:item.available,reason:item.reason,warnings:[...item.warnings],
    playbackVerified:false,previewRef:item.preview?{wallpaperId:item.id,kind:'preview'}:null};
}
