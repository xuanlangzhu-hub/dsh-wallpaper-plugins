"""Build a local rc.60 from the frozen, SDK-tested rc.57 overlay, never the development tree."""
from pathlib import Path
import argparse, hashlib, importlib.util, json

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
read=lambda p:json.loads(p.read_bytes())
sha=lambda b:hashlib.sha256(b).hexdigest().upper()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
    out=Path(args.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists()
    source=ROOT/'.tmp/thin-glass-sdk-20261031-c'
    proof=read(source/'integration-proof.json')
    assert proof['changed']==['src/client.js'] and proof['unaffectedFiles']==46
    assert proof['diagnosticOutsideCssPreserved'] and proof['adapterOutsideControlsCssByteIdentical'] and proof['runtimeOutsideControlsCssByteIdentical'] and proof['durableQaMatchesExecuted']
    source_proof=read(ROOT/'.tmp/thin-glass-source-20261031-a/source-change-proof.json')
    assert source_proof['sourceOutsideControlsCssUnchanged'] and source_proof['clientOutsideControlsCssUnchanged']
    assert sha((HERE/'ui.patch').read_bytes())==sha((ROOT/'.tmp/thin-glass-source-20261031-a/thin-glass.patch').read_bytes())
    assert sha((source/'native-sidebar.mjs').read_bytes())==proof['adapterSha256']
    assert sha((ROOT/'dsh-whale-mist/src/sidebar/native-appearance-sidebar.js').read_bytes())==proof['sharedNativeSha256']
    assert len(proof['files'])==47
    files={n:(source/'runtime'/n).read_bytes() for n in proof['files']}
    assert {n:sha(b) for n,b in files.items()}==proof['files']
    protected=read(ROOT/'.tmp/thin-glass-source-20261031-a/protected-with-thin-qa.json')
    assert len(protected)==440 and all(sha(Path(n).read_bytes())==h for n,h in protected.items())
    report=read(source/'thin-windows-controls-report.json')
    assert report['passed'] and len(report['cases'])==11 and all(x['passed'] for x in report['cases'])
    assert report['inputHashes']['productClient']==sha(files['src/client.js'])
    native=(source/'native-sidebar.mjs').read_bytes()
    assert report['inputHashes']['adapter']==sha(native)
    assert report['inputHashes']['materialChecks']==sha((source/'sdk-pixso-controls.mjs').read_bytes())
    assert report['inputHashes']['thinGlassChecks']==sha((ROOT/'dsh-whale-mist/qa/sidebar-material/thin-glass-sdk.mjs').read_bytes())
    assert sha((source/'thin-windows-controls-report.json').read_bytes())==proof['reportSha256']
    assert report['cleanup']['ownedBrowserExitConfirmed'] and report['cleanup']['serverClosed'] and report['cleanup']['bridgeClosed']
    prior_recipe=HERE.parent/'rc58/build-candidate.py'
    spec=importlib.util.spec_from_file_location('rc58_archive_primitives',prior_recipe);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    daily=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz'
    assert sha(daily.read_bytes())=='EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262'
    original,modes=module.unpack(daily.read_bytes());assert set(files)==set(original)
    before=json.loads(files['package.json']);assert before['version']=='0.6.0-rc.57'
    files['package.json']=files['package.json'].replace(b'"version": "0.6.0-rc.57"',b'"version": "0.6.0-rc.60"')
    after=json.loads(files['package.json']);assert after.pop('version')=='0.6.0-rc.60';before.pop('version');assert before==after
    assert after['private'] is True and after['engines']['dsh']=='0.2.1-rc.3'
    assert not any(n in after.get('scripts',{}) for n in ['preinstall','install','postinstall','prepare','prepublishOnly'])
    prefix=(HERE/'README-prefix.md').read_bytes();files['README.md']=prefix+files['README.md']
    old=read(ROOT/'.tmp/pixso-ui-sdk-integration-20261030-b/build.json')
    meta=dict(old,payloadVersion='0.6.0-rc.60',sources={**old['sources'],'controller':sha(native)})
    recipe_hash=sha(Path(__file__).read_bytes())
    meta['buildId']=hashlib.sha256(json.dumps({'version':meta['payloadVersion'],'sourceBuildId':old['buildId'],'sources':meta['sources'],'testedClient':proof['files']['src/client.js'],'recipeSha256':recipe_hash,'readmePrefixSha256':sha(prefix)},sort_keys=True).encode()).hexdigest()
    literal=lambda x:json.dumps(x,ensure_ascii=True,separators=(',',':')).encode()
    for n in ['src/client.js','src/wallpaper/author-diagnostic-build.js']:
        assert files[n].count(literal(old))==1;files[n]=files[n].replace(literal(old),literal(meta))
    assets=[n for n in files if n.startswith('assets/')]
    assert len(assets)==14 and all(files[n]==original[n] for n in assets)
    changed=sorted(n for n in files if files[n]!=original[n])
    assert changed==['README.md','package.json','src/client.js','src/wallpaper/author-diagnostic-build.js']
    raw=module.pack(files,modes);again,again_modes=module.unpack(raw);assert again==files and again_modes==modes
    out.mkdir();name='dsh-whale-mist-0.6.0-rc.60.tgz';(out/name).write_bytes(raw)
    for n,b in files.items():
        p=out/'unpacked'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    (out/'native-sidebar.mjs').write_bytes(native)
    (out/'build.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
    manifest={'version':'0.6.0-rc.60','archiveSha256':sha(raw),'archiveBytes':len(raw),'files':[{'file':n,'sha256':sha(b),'bytes':len(b),'mode':modes[n]} for n,b in sorted(files.items())]}
    (out/'package-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    audit={'version':'0.6.0-rc.60','archive':name,'sha256':sha(raw),'bytes':len(raw),'files':47,'assetsUnchanged':14,'changedFromOriginalRc57':changed,'sourceIntegration':str(source.relative_to(ROOT)),'sourceReportSha256':sha((source/'thin-windows-controls-report.json').read_bytes()),'recipeSha256':recipe_hash,'archivePrimitivesRecipeSha256':sha(prior_recipe.read_bytes()),'defaultRollback':'0.6.0-rc.57','localTrialOnly':True,'publicReleaseAuthorized':False,'installed':False,'nativeRecompiled':False,'profileOrAppQueried':False,'defaultEnabled':False}
    (out/'candidate-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf8');print(json.dumps(audit))

if __name__=='__main__':main()
