"""Validate pinned declarations, then measure the actual FrameHub type baseline read-only."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil,hashlib
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-node-environment'))
from prepare import payload
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--cache',required=True)
p.add_argument('--compiler-root',required=True);p.add_argument('--protected-manifest',required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    protected=read(Path(a.protected_manifest).resolve());assert len(protected)==405;verify_protected(ROOT,protected)
    own={str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for f in HERE.iterdir() if f.is_file()}
    cache=Path(a.cache).resolve();lock_file=ROOT/'dsh-whale-mist/qa/typescript-node-environment/lock.json'
    lock=read(lock_file);receipt=read(cache/'cache-receipt.json');status=read(cache/'prepare-status.json')
    assert status['passed'] and status['exitConfirmed'] and not status['timedOut']
    assert receipt['passed'] and receipt['lockSha256']==sha(lock_file)
    watched={str(cache/n):sha(cache/n) for n in ['cache-receipt.json','prepare-status.json']}
    for item in lock['packages']:
        archive=cache/(item['key']+'.tgz');files,prefix=payload(archive.read_bytes(),item)
        directory=cache/'types'/item['directory']
        expected={n:hashlib.sha256(data).hexdigest().upper() for n,data in files.items()}
        assert expected==receipt['packages'][item['key']]['files'];verify_protected(directory,expected)
        assert {str(f.relative_to(directory)).replace('\\','/') for f in directory.rglob('*') if f.is_file()}==set(expected)
        watched[str(archive)]=sha(archive);watched[str(cache/(item['key']+'-metadata.json'))]=sha(cache/(item['key']+'-metadata.json'))
        watched.update({str(directory/n):h for n,h in expected.items()})
    compiler=Path(a.compiler_root).resolve()
    compiler_files=verify_compiler(compiler,read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json'))
    frozen=out/'frozen';frozen.mkdir()
    for name in own:shutil.copyfile(ROOT/name,frozen/Path(name).name)
    save(out/'inputs.json',dict(source=str(ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js'),
         protocol=str(ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js'),cache=str(cache),compilerModule=str(compiler/'package/lib/typescript.js')))
    stages=Stages(out,total_seconds=30);node=shutil.which('node');assert node
    stages.run('read-only-node-baseline',[node,frozen/'audit.mjs',out])
    verify_protected(ROOT,protected);verify_protected(ROOT,own)
    assert all(sha(Path(n))==h for n,h in watched.items());verify_protected(compiler/'package',compiler_files)
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'result.json',dict(passed=True,scopeOnly=True,qaHashes=own,protectedInputs=405,
         findings=read(out/'node-baseline.json'),cacheFilesVerified=len(watched),commands=stages.commands,
         moduleOrTestsExecuted=False,projectOrGlobalDependencyInstalled=False,runtimeSourcesChanged=False,
         hostRuntimeVerified=False))
    print('PASS: actual Hub Node-context baseline measured; no source edits or module execution')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
