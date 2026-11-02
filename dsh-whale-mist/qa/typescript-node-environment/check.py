"""Verify a pinned cache and compile smoke consumers without executing app modules."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected
from prepare import payload
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--cache',required=True)
p.add_argument('--compiler-root',required=True);p.add_argument('--protected-manifest',required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    protected=read(Path(a.protected_manifest).resolve());assert len(protected)==400;verify_protected(ROOT,protected)
    own={str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for f in HERE.iterdir() if f.is_file()}
    cache=Path(a.cache).resolve();lock=read(HERE/'lock.json');receipt=read(cache/'cache-receipt.json')
    assert read(cache/'prepare-status.json')['passed'] and receipt['passed'] and receipt['lockSha256']==sha(HERE/'lock.json')
    watched={str(cache/n):sha(cache/n) for n in ['cache-receipt.json','prepare-status.json']}
    for item in lock['packages']:
        archive=cache/(item['key']+'.tgz');files,prefix=payload(archive.read_bytes(),item)
        directory=cache/'types'/item['directory']
        expected={n:__import__('hashlib').sha256(data).hexdigest().upper() for n,data in files.items()}
        assert expected==receipt['packages'][item['key']]['files'];verify_protected(directory,expected)
        assert {str(f.relative_to(directory)).replace('\\','/') for f in directory.rglob('*') if f.is_file()}==set(expected)
        watched[str(archive)]=sha(archive)
        watched[str(cache/(item['key']+'-metadata.json'))]=sha(cache/(item['key']+'-metadata.json'))
        watched.update({str(directory/n):h for n,h in expected.items()})
    compiler=Path(a.compiler_root).resolve()
    compiler_files=verify_compiler(compiler,read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json'))
    frozen=out/'frozen';frozen.mkdir()
    for name in own:shutil.copyfile(ROOT/name,frozen/Path(name).name)
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    positive=out/'positive.ts';negative=out/'negative.ts'
    positive.write_text("""import {EventEmitter} from 'node:events';
import {Buffer} from 'node:buffer';
import type {ServerResponse} from 'node:http';
import {performance} from 'node:perf_hooks';
const emitter = new EventEmitter<{frame: []; end: []}>();
emitter.on('frame', () => {}); emitter.emit('frame'); emitter.off('end', () => {});
const bytes: Uint8Array = Buffer.from(new Uint8Array([1,2]));
const globalBytes: Buffer = globalThis.Buffer.alloc(2);
const clock: number = performance.now() + globalThis.performance.now();
function useResponse(res: ServerResponse): boolean {
  res.writeHead(200, {'content-type':'application/x-whale-frames'});
  res.flushHeaders(); res.on('drain', () => {}); res.off('close', () => {});
  const accepted: boolean = res.write(Buffer.from(bytes)); res.end(); return accepted;
}
void [globalBytes, clock, emitter, useResponse];
""",encoding='utf-8')
    negative.write_text("import {Buffer} from 'node:buffer';\nconst value: string = Buffer.alloc(1); void value;\n",encoding='utf-8')
    save(out/'inputs.json',dict(cache=str(cache),positive=str(positive),negative=str(negative),compilerModule=str(compiler/'package/lib/typescript.js')))
    stages=Stages(out,total_seconds=30);node=shutil.which('node');assert node
    stages.run('real-declaration-smoke',[node,frozen/'smoke.mjs',out])
    verify_protected(ROOT,protected);verify_protected(ROOT,own)
    assert all(sha(Path(n))==h for n,h in watched.items());verify_protected(compiler/'package',compiler_files)
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'result.json',dict(passed=True,qaHashes=own,protectedInputs=400,findings=read(out/'smoke-result.json'),
         commands=stages.commands,cacheFilesVerified=len(watched),applicationExecuted=False,nodeModulesCreated=False,
         projectOrGlobalDependencyInstalled=False,runtimeSourcesChanged=False))
    print('PASS: pinned Node24 declaration closure with TS5.9.3; no app execution or dependency install')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
