import {execFile} from 'node:child_process';
const denied=()=>new Error('MEDIA_BRIDGE_PERMISSION: private cache permission could not be confirmed');
// Read-only ACL check; no shell, credentials, ACL mutation, or import-time process.
export async function checkPrivateRoot(root,{exec=execFile,platform=process.platform}={}){
 if(platform!=='win32'||typeof root!=='string'||!root||/[\x00-\x1f]/.test(root))throw denied();
 const literal="'"+root.replaceAll("'","''")+"'";
 const script=`$ErrorActionPreference='Stop'; try {
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $node=${literal}; while(-not [string]::IsNullOrEmpty($node)) {
   if((([System.IO.File]::GetAttributes($node)) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0){throw 'reparse'}
   $parent=[System.IO.Path]::GetDirectoryName($node); if([string]::IsNullOrEmpty($parent) -or $parent -eq $node){break}; $node=$parent
  }
  $acl=([System.IO.DirectoryInfo]::new(${literal})).GetAccessControl()
  $owner=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
  if($owner -ne $sid){throw 'owner'}
  $trusted=@($sid,'S-1-5-18','S-1-5-32-544')
  $mask=[int64]([System.Security.AccessControl.FileSystemRights]::Write -bor [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [System.Security.AccessControl.FileSystemRights]::Delete -bor [System.Security.AccessControl.FileSystemRights]::ChangePermissions -bor [System.Security.AccessControl.FileSystemRights]::TakeOwnership)
  $rules=$acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])
  foreach($r in $rules){if($r.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and (([int64]$r.FileSystemRights -band $mask) -ne 0) -and ($trusted -notcontains $r.IdentityReference.Value)){throw 'grant'}}
  [Console]::Out.Write('true')
 } catch { [Console]::Out.Write('false'); exit 1 }`;
 const result=await new Promise(resolve=>{
  try{exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:3000,maxBuffer:8192},(error,stdout)=>resolve(!error&&stdout.trim()==='true'));}
  catch{resolve(false);}
 });
 if(!result)throw denied();
 return true;
}

// Node's isSymbolicLink covers junctions/symlinks; Windows has additional reparse tags.
// Refuse ALL reparse attributes at this IO boundary, including non-name-surrogate tags.
export async function checkNoReparsePaths(paths,{exec=execFile,platform=process.platform}={}){
 if(platform!=='win32'||!Array.isArray(paths)||!paths.length||paths.length>8||paths.some(p=>typeof p!=='string'||!p||/[\x00-\x1f]/.test(p)))throw denied();
 const literals=paths.map(p=>"'"+p.replaceAll("'","''")+"'").join(',');
 const script=`$ErrorActionPreference='Stop'; try {
  foreach($p in @(${literals})) { $node=$p; while(-not [string]::IsNullOrEmpty($node)) {
   if((([System.IO.File]::GetAttributes($node)) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0){throw 'reparse'}
   $parent=[System.IO.Path]::GetDirectoryName($node); if([string]::IsNullOrEmpty($parent) -or $parent -eq $node){break}; $node=$parent
  }}
  [Console]::Out.Write('true')
 } catch { [Console]::Out.Write('false'); exit 1 }`;
 const result=await new Promise(resolve=>{try{exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:3000,maxBuffer:8192},(error,stdout)=>resolve(!error&&stdout.trim()==='true'));}catch{resolve(false);}});
 if(!result)throw denied();
 return true;
}
