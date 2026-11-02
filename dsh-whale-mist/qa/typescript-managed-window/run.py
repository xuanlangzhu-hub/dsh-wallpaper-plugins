"""Isolated managed-window annotations, exact types, AST and bounded pure IO checks."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil,hashlib,os
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
QA=ROOT/'dsh-whale-mist/qa'
sys.path.insert(0,str(QA/'typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected
sys.path.insert(0,str(QA/'typescript-node-environment'))
from prepare import payload
from annotate import annotate
p=argparse.ArgumentParser()
for name in ['output','compiler-root','cache','protected-manifest']:p.add_argument('--'+name,required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    protected=read(Path(a.protected_manifest).resolve());assert len(protected)==423;verify_protected(ROOT,protected)
    own={f.relative_to(ROOT).as_posix():sha(f) for f in HERE.iterdir() if f.is_file()};assert len(own)==7
    source=ROOT/'dsh-whale-mist/src/wallpaper/managed-window.js'
    assert sha(source)=='6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86'
    compiler=Path(a.compiler_root).resolve()
    compiler_files=verify_compiler(compiler,read(QA/'typescript-frame-protocol/compiler-lock.json'))
    cache=Path(a.cache).resolve();lock_file=QA/'typescript-node-environment/lock.json'
    lock=read(lock_file);receipt=read(cache/'cache-receipt.json');status=read(cache/'prepare-status.json')
    assert status['passed'] and status['exitConfirmed'] and not status['timedOut']
    assert receipt['passed'] and receipt['lockSha256']==sha(lock_file)
    watched={str(cache/n):sha(cache/n) for n in ['cache-receipt.json','prepare-status.json']}
    for item in lock['packages']:
        archive=cache/(item['key']+'.tgz');files,_=payload(archive.read_bytes(),item);directory=cache/'types'/item['directory']
        expected={n:hashlib.sha256(data).hexdigest().upper() for n,data in files.items()}
        assert expected==receipt['packages'][item['key']]['files'];verify_protected(directory,expected)
        assert {f.relative_to(directory).as_posix() for f in directory.rglob('*') if f.is_file()}==set(expected)
        watched[str(archive)]=sha(archive);watched[str(cache/(item['key']+'-metadata.json'))]=sha(cache/(item['key']+'-metadata.json'))
        watched.update({str(directory/n):h for n,h in expected.items()})
    frozen=out/'frozen';base=out/'base';candidate=out/'candidate'
    for directory in [frozen,base,candidate]:directory.mkdir()
    for name in own:shutil.copyfile(ROOT/name,frozen/Path(name).name)
    shutil.copyfile(source,base/'managed-window.js')
    (candidate/'managed-window.js').write_text(annotate(source.read_text(encoding='utf-8')),encoding='utf-8',newline='\n')
    shutil.copyfile(HERE/'positive.ts',candidate/'positive.ts')
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    cases=read(frozen/'cases.json');assert len(cases)==16;negatives=[]
    imports="import {spawn} from 'node:child_process';\nimport {runHelper,waitForWindow,newLocation,normalizeWindow,validateSize,defaultSleep} from './managed-window.js';\n"
    for case in cases:
        file=candidate/(case['name']+'.ts');assert file.parent==candidate
        file.write_text(imports+case['body'],encoding='utf-8')
        negatives.append(dict(name=case['name'],file=str(file),code=case['code']))
    info=dict(baseline=str(base/'managed-window.js'),module=str(candidate/'managed-window.js'),positive=str(candidate/'positive.ts'),
              negatives=negatives,cache=str(cache),compilerModule=str(compiler/'package/lib/typescript.js'))
    save(out/'inputs.json',info)
    config=read(QA/'typescript-frame-protocol/tsconfig.json')
    config['compilerOptions'].update(types=['node'],typeRoots=[str(cache/'types')],paths={'undici-types':[str(cache/'types/undici-types')]})
    config['files']=[info['module'],info['positive']];save(out/'tsconfig.json',config)
    stages=Stages(out,total_seconds=75);node=shutil.which('node');assert node
    inventory=lambda:{f.relative_to(out).as_posix() for f in out.rglob('*') if f.is_file()}
    before=inventory()
    stages.run('tsc-noemit',[node,compiler/'package/lib/tsc.js','--project',out/'tsconfig.json','--pretty','false','--listFiles'])
    assert inventory()-before=={'commands.json','tsc-noemit.stdout.txt','tsc-noemit.stderr.txt'}
    parts=['baseline-positive','negative-1','negative-2','negative-3','negative-4','ast']
    for part in parts:stages.run(part,[node,frozen/'verify.mjs',out,part])
    result=read(out/'baseline-positive.json');result.pop('part')
    ast=read(out/'ast.json')
    result.update({k:ast[k] for k in ['normalizedRuntimeAstEqual','optionalChainSemanticsPreserved','astMutationChecks','noCustomAnyIgnoreOrFakeDeclarations']})
    refused=[row for part in parts if part.startswith('negative-') for row in read(out/(part+'.json'))['negativeCases']]
    assert [(r['name'],r['code']) for r in refused]==[(r['name'],r['code']) for r in negatives]
    result['negativeCases']=refused;save(out/'type-results.json',result)
    stages.run('syntax',[node,'--check',candidate/'managed-window.js'])
    tap=stages.run('pure-managed-equivalence',[node,'--test','--test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-timeout=3000',frozen/'runtime.test.mjs'],
          env=dict(os.environ,MANAGED_TYPE_INPUTS=str(out/'inputs.json')))
    assert '# tests 21' in tap and '# fail 0' in tap
    verify_protected(ROOT,protected);verify_protected(ROOT,own);verify_protected(compiler/'package',compiler_files)
    assert all(sha(Path(n))==h for n,h in watched.items())
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'protected-after.json',protected|own)
    save(out/'result.json',dict(passed=True,isolatedOnly=True,typeResults=result,baselineSha256=sha(source),candidateSha256=sha(candidate/'managed-window.js'),
         protectedInputs=423,continuationInputs=430,qaHashes=own,runtimeTests=21,cacheFilesVerified=len(watched),commands=stages.commands,
         runtimeSourceChanged=False,nativeOrLiveAppsUsed=False,realHelperSpawned=False,projectOrGlobalDependencyInstalled=False))
    print('PASS: isolated managed-window, 16 exact type refusals, 21 pure runtime cases; actual source unchanged')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
