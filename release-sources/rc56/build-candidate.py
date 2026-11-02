"""Build a deterministic local rc56 diagnostic candidate from fixed rc55 and the reviewed title-prefilter DLL."""
from pathlib import Path,PurePosixPath
import argparse,gzip,hashlib,io,json,tarfile

here=Path(__file__).resolve().parent;root=here.parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def unpack(raw):
    files={};modes={};seen=set()
    with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as arc:
        for m in arc:
            p=PurePosixPath(m.name)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in m.name and ':' not in m.name and p.parts[0]=='package'
            if m.isdir():continue
            assert m.isfile() and m.size<=40_000_000
            name=p.relative_to('package').as_posix();assert name.casefold() not in seen;seen.add(name.casefold())
            files[name]=arc.extractfile(m).read();modes[name]=m.mode
    return files,modes
def pack(files,modes):
    buffer=io.BytesIO()
    with gzip.GzipFile(fileobj=buffer,mode='wb',filename='',mtime=0) as compressed:
        with tarfile.open(fileobj=compressed,mode='w',format=tarfile.USTAR_FORMAT) as arc:
            for name,data in sorted(files.items()):
                m=tarfile.TarInfo('package/'+name);m.size=len(data);m.mode=modes[name];m.mtime=m.uid=m.gid=0;m.uname=m.gname=''
                arc.addfile(m,io.BytesIO(data))
    return buffer.getvalue()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);a=parser.parse_args()
    out=Path(a.output).resolve();assert out.is_relative_to(root/'.tmp') and not out.exists()
    manifest=read(root/'release-sources/rc55/package-manifest.json')
    archive=root/'.tmp/rc55-taskbar-stage-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.55.tgz'
    raw=archive.read_bytes();assert sha(raw)==manifest['archiveSha256']=='0D93C59FF1D5E408C3763439A8197CC69F8054CC23064FDDC6A0B3FB6D60FC29'
    baseline,modes=unpack(raw);assert len(baseline)==len(manifest['files'])==43
    assert set(baseline)=={r['file'] for r in manifest['files']}
    assert all(sha(baseline[r['file']])==r['sha256'] and len(baseline[r['file']])==r['bytes'] for r in manifest['files'])
    qa=root/'dsh-whale-mist/qa/taskbar-title-prefilter';preflight=root/'.tmp/taskbar-title-integration-20261029-c'
    plan=read(qa/'integration-plan.json');proof=read(preflight/'result.json');review=read(preflight/'documentation-check.json')
    assert proof['passed'] and review['passed'] and proof['metadataAllowlistMatched'] and proof['oldApphostDepsRuntimeconfigPreserved']
    assert proof['stagingDelta']==['assets/wallpaper/WallpaperProbe.dll'] and proof['normalizedDependencyGraphEqual'] and proof['dependencyDllsByteIdentical']==8
    assert plan['baseArchiveSha256']==sha(raw)
    assert all(sha((root/n).read_bytes())==h for n,h in proof['qaHashes'].items()),'preflight QA drift'
    for name,h in read(preflight/'staging-manifest.json').items():assert sha((preflight/'staging'/name).read_bytes())==h
    replacement=plan['replacementFiles']['assets/wallpaper/WallpaperProbe.dll']
    dll=(root/replacement['source']).read_bytes()
    assert sha(dll)==replacement['sha256']==proof['newDllSha256']=='730DC34D8CAB1970093746CF1F1699EB833C02A267AE68BDFCC55CDFAF93D1E2'
    protected=read(root/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json')
    assert all(sha((root/n).read_bytes())==h for n,h in protected.items())
    files=dict(baseline);files['assets/wallpaper/WallpaperProbe.dll']=dll
    before=json.loads(files['package.json']);anchor=b'"version": "0.6.0-rc.55"';assert files['package.json'].count(anchor)==1
    files['package.json']=files['package.json'].replace(anchor,b'"version": "0.6.0-rc.56"')
    after=json.loads(files['package.json']);assert after.pop('version')=='0.6.0-rc.56' and before.pop('version')=='0.6.0-rc.55' and after==before
    assert after['private'] is True and after['engines']['dsh']=='0.2.1-rc.3'
    assert not any(n in after.get('scripts',{}) for n in ['preinstall','install','postinstall','prepare','prepublishOnly'])
    prefix=(here/'README-prefix.md').read_text(encoding='utf-8').replace('\r\n','\n').encode('utf-8')
    files['README.md']=prefix+baseline['README.md']
    changed=sorted(n for n in files if files[n]!=baseline[n]);assert changed==['README.md','assets/wallpaper/WallpaperProbe.dll','package.json']
    js=[n for n in files if n.endswith('.js')];assets=[n for n in files if n.startswith('assets/')]
    assert len(js)==23 and all(files[n]==baseline[n] for n in js)
    assert len(assets)==14 and all(files[n]==baseline[n] for n in assets if n!='assets/wallpaper/WallpaperProbe.dll')
    packed=pack(files,modes);actual,actual_modes=unpack(packed);assert actual==files and actual_modes==modes
    out.mkdir();filename='dsh-whale-mist-0.6.0-rc.56.tgz';(out/filename).write_bytes(packed)
    for name,data in actual.items():
        target=out/'unpacked'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        assert target.read_bytes()==data
    package_manifest={'version':'0.6.0-rc.56','archiveSha256':sha(packed),'archiveBytes':len(packed),
        'files':[{'file':n,'sha256':sha(data),'bytes':len(data)} for n,data in sorted(actual.items())]}
    (out/'package-manifest.json').write_text(json.dumps(package_manifest,indent=2),encoding='utf-8')
    assert all(sha((root/n).read_bytes())==h for n,h in protected.items())
    result={'version':'0.6.0-rc.56','archive':filename,'sha256':sha(packed),'bytes':len(packed),'files':len(actual),
        'changedFromRc55':changed,'unchangedFiles':40,'unchangedJavaScript':23,'unchangedAssets':13,
        'manifestOnlyVersionChanged':True,'private':True,'enginesDsh':'0.2.1-rc.3','originalFileModesPreserved':True,
        'inheritedApphostDepsRuntimeconfig':True,'protectedInputs':len(protected),'changedProtectedInputs':[],
        'sourceArchiveSha256':sha(raw),'replacementDllSha256':sha(dll),'recipeSha256':sha(Path(__file__).read_bytes()),
        'readmePrefixSha256':sha(prefix),'preflightReceiptSha256':sha((preflight/'result.json').read_bytes()),
        'nativeRecompiled':False,'installed':False,'published':False,'realApplicationOperations':0,'visualAcceptance':False}
    (out/'candidate-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
if __name__=='__main__':main()
