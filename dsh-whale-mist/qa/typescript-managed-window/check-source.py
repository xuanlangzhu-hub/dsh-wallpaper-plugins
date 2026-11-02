"""Check actual managed-window source using the reviewed recipe and real Node types."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil,hashlib,os
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
QA=ROOT/'dsh-whale-mist/qa'
sys.path.insert(0,str(QA/'typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected,load_annotation_recipe
sys.path.insert(0,str(QA/'typescript-node-environment'))
from prepare import payload
p=argparse.ArgumentParser()
for name in ['output','compiler-root','cache']:p.add_argument('--'+name,required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    manifest=QA/'typescript-check/protected-baseline-v7.json'
    protected=read(manifest);assert len(protected)==432;verify_protected(ROOT,protected)
    recipeFile=HERE/'annotate.py';annotate=load_annotation_recipe(recipeFile)
    own={manifest.relative_to(ROOT).as_posix():sha(manifest)}
    source=ROOT/'dsh-whale-mist/src/wallpaper/managed-window.js'
    baseline=HERE/'baseline/managed-window.js'
    assert sha(baseline)=='6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86'
    assert source.read_text(encoding='utf-8')==annotate(baseline.read_text(encoding='utf-8'))
    assert source.read_bytes().count(b'\r\n')==source.read_bytes().count(b'\n')
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
    frozen=out/'frozen';base=out/'base';candidate=out/'actual'
    for directory in [frozen,base,candidate]:directory.mkdir()
    for name in ['check-source.py','annotate.py','positive.ts','cases.json','verify.mjs','runtime.test.mjs','SOURCE_CHECK.md']:
        shutil.copyfile(HERE/name,frozen/name)
    shutil.copyfile(baseline,base/'managed-window.js')
    rel=os.path.relpath(source,candidate).replace('\\','/')
    text=(frozen/'positive.ts').read_text(encoding='utf-8');assert text.count('./managed-window.js')==2
    (candidate/'positive.ts').write_text(text.replace('./managed-window.js',rel),encoding='utf-8')
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    cases=read(frozen/'cases.json');assert len(cases)==16;negatives=[]
    imports="import {spawn} from 'node:child_process';\nimport {runHelper,waitForWindow,newLocation,normalizeWindow,validateSize,defaultSleep} from './managed-window.js';\n"
    assert imports.count('./managed-window.js')==1;imports=imports.replace('./managed-window.js',rel)
    for case in cases:
        file=candidate/(case['name']+'.ts');assert file.parent==candidate
        file.write_text(imports+case['body'],encoding='utf-8')
        negatives.append(dict(name=case['name'],file=str(file),code=case['code']))
    info=dict(baseline=str(base/'managed-window.js'),module=str(source),positive=str(candidate/'positive.ts'),
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
    stages.run('syntax',[node,'--check',source])
    tap=stages.run('pure-managed-equivalence',[node,'--test','--test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-timeout=3000',frozen/'runtime.test.mjs'],
          env=dict(os.environ,MANAGED_TYPE_INPUTS=str(out/'inputs.json')))
    assert '# tests 21' in tap and '# fail 0' in tap
    verify_protected(ROOT,protected);verify_protected(ROOT,own);verify_protected(compiler/'package',compiler_files)
    assert all(sha(Path(n))==h for n,h in watched.items())
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'protected-after.json',protected|own)
    save(out/'result.json',dict(passed=True,checkedActualDevelopmentManagedWindow=True,annotationRecipe=dict(file=str(recipeFile),sha256=sha(recipeFile)),typeResults=result,baselineSha256=sha(baseline),sourceSha256=sha(source),source=str(source),
         protectedInputs=432,continuationInputs=433,qaHashes=own,runtimeTests=21,cacheFilesVerified=len(watched),commands=stages.commands,
         sourceWrittenByCheck=False,historicalRoundInputsRequired=False,nativeOrLiveAppsUsed=False,realHelperSpawned=False,projectOrGlobalDependencyInstalled=False))
    print('PASS: actual managed-window, 16 exact type refusals, 21 pure runtime cases; no emit')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
