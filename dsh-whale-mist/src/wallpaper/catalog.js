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
async function boundFile(base,parts){
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
  const data=project.data;const type=['scene','video','web'].includes(data.type)?data.type:'unknown';
  const result={id:id(project.path),title:title(data.title,parse(directory).base),type,project:project.path,entry:null,preview:null,
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
    if(type==='scene')result.available=true;
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
export async function verifyCatalogEntry(item,{roots}={}){
  if(!item||typeof item!=='object'||!isCatalogId(item.id))throw fail('unknown_wallpaper');
  if(item.type!=='scene')throw fail(item.type==='unknown'?'unknown_type':'playback_type_not_supported');
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
  const type=['scene','video','web'].includes(data.type)?data.type:'unknown';
  if(type!==item.type)throw fail('type_changed');
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
      if(error.code!=='ENOENT')throw error;
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
  return {id:item.id,title:item.title,type:'scene',project:projectPath,entry:physicalEntry.path};
}

/** available means eligible for later scene verification, never proven playable. */
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
          project:null,entry:null,preview:null,available:false,reason,warnings:[],playbackVerified:false,workshopId:null});
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

/** Browser-safe metadata for a future UI; deliberately no paths, HTML or general properties. */
export function publicCatalogItem(item){
  return {id:item.id,title:item.title,type:item.type,available:item.available,reason:item.reason,warnings:[...item.warnings],
    playbackVerified:false,previewRef:item.preview?{wallpaperId:item.id,kind:'preview'}:null};
}
