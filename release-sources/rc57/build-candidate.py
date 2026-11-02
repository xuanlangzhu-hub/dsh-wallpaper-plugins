from pathlib import Path,PurePosixPath
import argparse,gzip,hashlib,io,json,tarfile
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def unpack(raw):
 files={};modes={};seen=set()
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
  for m in archive:
   p=PurePosixPath(m.name);assert m.isfile() and p.parts[0]=='package' and not p.is_absolute() and '..' not in p.parts and '\\' not in m.name and ':' not in m.name and m.size<=40_000_000
   n=p.relative_to('package').as_posix();assert n.casefold() not in seen;seen.add(n.casefold());files[n]=archive.extractfile(m).read();modes[n]=m.mode
 return files,modes
def pack(files,modes):
 out=io.BytesIO()
 with gzip.GzipFile(fileobj=out,mode='wb',filename='',mtime=0) as gz:
  with tarfile.open(fileobj=gz,mode='w',format=tarfile.USTAR_FORMAT) as archive:
   for n,data in sorted(files.items()):
    info=tarfile.TarInfo('package/'+n);info.size=len(data);info.mode=modes[n];info.mtime=info.uid=info.gid=0;info.uname=info.gname='';archive.addfile(info,io.BytesIO(data))
 return out.getvalue()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists()
 source=ROOT/'.tmp/author-diagnostic-ui-20261029-d';proof=read(source/'result.json');assert proof['passed'] and proof['newLifecycleBootstrapUiChecks']==40 and proof['retainedExportRouteChecks']==30 and proof['hostAndProviderChecks']==76
 assert proof['defaultEnabled'] is False and proof['installedOrPackaged'] is False
 assert all(sha((source/'isolated/runtime'/n).read_bytes())==h for n,h in proof['files'].items())
 for n,h in proof['frozenQa'].items():assert sha((source/'frozen'/n).read_bytes())==h
 protected=read(ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json');assert all(sha((ROOT/n).read_bytes())==h for n,h in protected.items())
 daily=ROOT/'.tmp/rc56-taskbar-title-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.56.tgz';raw=daily.read_bytes();assert sha(raw)=='85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160'
 original,modes=unpack(raw);assert len(original)==43
 files={n:(source/'isolated/runtime'/n).read_bytes() for n in proof['files']};assert len(files)==47
 for n in files:modes.setdefault(n,0o644)
 before=json.loads(files['package.json']);assert before['version']=='0.6.0-rc.56';files['package.json']=files['package.json'].replace(b'"version": "0.6.0-rc.56"',b'"version": "0.6.0-rc.57"');after=json.loads(files['package.json'])
 assert after.pop('version')=='0.6.0-rc.57';before.pop('version');assert before==after and after['private'] is True and after['engines']['dsh']=='0.2.1-rc.3'
 assert not any(n in after.get('scripts',{}) for n in ['preinstall','install','postinstall','prepare','prepublishOnly'])
 prefix=(HERE/'README-prefix.md').read_bytes();files['README.md']=prefix+files['README.md']
 meta=dict(proof['build'],payloadVersion='0.6.0-rc.57');meta['buildId']=hashlib.sha256(json.dumps({'version':meta['payloadVersion'],'sourceBuildId':proof['build']['buildId'],'sources':meta['sources'],'recipeSha256':sha(Path(__file__).read_bytes()),'readmePrefixSha256':sha(prefix)},sort_keys=True).encode()).hexdigest()
 old=json.dumps(proof['build'],ensure_ascii=True,separators=(',',':')).encode();new=json.dumps(meta,ensure_ascii=True,separators=(',',':')).encode()
 for n in ['src/client.js','src/wallpaper/author-diagnostic-build.js']:
  assert files[n].count(old)==1,(n,'build anchor');files[n]=files[n].replace(old,new)
 assert sorted(n for n,data in files.items() if data!=(source/'isolated/runtime'/n).read_bytes())==['README.md','package.json','src/client.js','src/wallpaper/author-diagnostic-build.js']
 assets=[n for n in files if n.startswith('assets/')];assert len(assets)==14 and all(files[n]==original[n] for n in assets)
 archive=pack(files,modes);again,round_modes=unpack(archive);assert again==files and round_modes==modes
 out.mkdir();name='dsh-whale-mist-0.6.0-rc.57.tgz';(out/name).write_bytes(archive)
 for n,data in files.items():
  dest=out/'unpacked'/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 (out/'build.json').write_text(json.dumps(meta,indent=2),encoding='utf-8');shutil_source=(source/'isolated/native-sidebar.mjs').read_bytes();assert sha(shutil_source)==meta['sources']['controller'];(out/'native-sidebar.mjs').write_bytes(shutil_source)
 manifest={'version':'0.6.0-rc.57','archiveSha256':sha(archive),'archiveBytes':len(archive),'files':[{'file':n,'sha256':sha(data),'bytes':len(data),'mode':modes[n]} for n,data in sorted(files.items())]};(out/'package-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
 audit={'version':'0.6.0-rc.57','archive':name,'sha256':sha(archive),'bytes':len(archive),'files':len(files),'assetsUnchanged':len(assets),'sourceTrial':str(source.relative_to(ROOT)),'sourceReceiptSha256':sha((source/'result.json').read_bytes()),'sourceRuntimeFiles':proof['files'],'build':meta,'changedFromSource':['README.md','package.json','src/client.js','src/wallpaper/author-diagnostic-build.js'],'manifestOnlyVersionChanged':True,'private':True,'defaultEnabled':False,'defaultRollback':'0.6.0-rc.56','localTrialOnly':True,'publicReleaseAuthorized':False,'installed':False,'nativeRecompiled':False,'profileOrAppQueried':False,'protectedInputs':len(protected),'recipeSha256':sha(Path(__file__).read_bytes()),'readmePrefixSha256':sha(prefix)}
 (out/'candidate-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8');assert all(sha((ROOT/n).read_bytes())==h for n,h in protected.items());print(json.dumps({k:v for k,v in audit.items() if k not in ['sourceRuntimeFiles','build']}))
if __name__=='__main__':main()
