"""Audit Node/Trace boundaries without importing FrameHub or installing declarations."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected
p=argparse.ArgumentParser()
p.add_argument('--output',required=True)
p.add_argument('--compiler-root',required=True)
p.add_argument('--protected-manifest',required=True)
a=p.parse_args();out=Path(a.output).resolve()
assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    protected=read(Path(a.protected_manifest).resolve());assert len(protected)==398
    verify_protected(ROOT,protected)
    own={str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for f in HERE.iterdir() if f.is_file()}
    compiler=Path(a.compiler_root).resolve()
    compiler_files=verify_compiler(compiler,read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json'))
    source=ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js'
    fixed=ROOT/'release-sources/rc53/package/src/wallpaper/frame-hub.js'
    legacy=ROOT/'dsh-whale-mist/qa/wallpaper-preview/frame-hub.js'
    test=ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/transport.test.mjs'
    manifest=ROOT/'release-sources/rc57/package-manifest.json'
    entry=next(x for x in read(manifest)['files'] if x['file']=='src/wallpaper/frame-hub.js')
    assert sha(fixed)==entry['sha256'] and sha(source)!=sha(fixed)
    inspected=[source,fixed,legacy,test,manifest,ROOT/'dsh-whale-mist/src/wallpaper/session.js',ROOT/'dsh-whale-mist/src/wallpaper/cadence-trace.js']
    hashes={str(x.relative_to(ROOT)).replace('\\','/'):sha(x) for x in inspected}
    frozen=out/'frozen';frozen.mkdir()
    for name in own:shutil.copyfile(ROOT/name,frozen/Path(name).name)
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    save(out/'inputs.json',dict(source=str(source),fixed=str(fixed),fixedSha256=sha(fixed),legacyHub=str(legacy),
         transportTest=str(test),protocol=str(ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js'),compilerModule=str(compiler/'package/lib/typescript.js')))
    stages=Stages(out,total_seconds=30);node=shutil.which('node');assert node
    version=stages.run('qa-node-version',[node,'--version'],stage_seconds=5).strip()
    stages.run('source-scope',[node,frozen/'audit.mjs',out],stage_seconds=12)
    verify_protected(ROOT,protected);verify_protected(ROOT,own);verify_protected(ROOT,hashes)
    verify_protected(compiler/'package',compiler_files)
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'result.json',dict(passed=True,scopeOnly=True,qaNodeVersion=version,hostRuntimeVersionVerified=False,
         findings=read(out/'frame-hub-scope.json'),protectedInputs=398,qaHashes=own,inspectedHashes=hashes,
         commands=stages.commands,runtimeSourceChanged=False,hubOrTestsExecuted=False,nodeTypesInstalledOrDownloaded=False,
         compilerEmittedFiles=0,nativeOrLiveAppsUsed=False,installedOrPackaged=False))
    print('PASS: FrameHub source/Trace scope only; no module execution or Node declaration install')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []))
    raise
