"""Build a Hub annotation candidate in isolation and validate types plus pure IO behaviour."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil,hashlib,os
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-node-environment'))
from prepare import payload
from annotate import annotate
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--cache',required=True)
p.add_argument('--compiler-root',required=True);p.add_argument('--protected-manifest',required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    protected=read(Path(a.protected_manifest).resolve());assert len(protected)==407;verify_protected(ROOT,protected)
    source=ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js';protocol=ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js'
    own={str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for f in HERE.iterdir() if f.is_file()}
    cache=Path(a.cache).resolve();lock_file=ROOT/'dsh-whale-mist/qa/typescript-node-environment/lock.json'
    lock=read(lock_file);receipt=read(cache/'cache-receipt.json');status=read(cache/'prepare-status.json')
    assert status['passed'] and status['exitConfirmed'] and not status['timedOut']
    assert receipt['passed'] and receipt['lockSha256']==sha(lock_file)
    watched={str(cache/n):sha(cache/n) for n in ['cache-receipt.json','prepare-status.json']}
    for item in lock['packages']:
        archive=cache/(item['key']+'.tgz');files,prefix=payload(archive.read_bytes(),item);directory=cache/'types'/item['directory']
        expected={n:hashlib.sha256(data).hexdigest().upper() for n,data in files.items()}
        assert expected==receipt['packages'][item['key']]['files'];verify_protected(directory,expected)
        assert {str(f.relative_to(directory)).replace('\\','/') for f in directory.rglob('*') if f.is_file()}==set(expected)
        watched[str(archive)]=sha(archive);watched[str(cache/(item['key']+'-metadata.json'))]=sha(cache/(item['key']+'-metadata.json'))
        watched.update({str(directory/n):h for n,h in expected.items()})
    compiler=Path(a.compiler_root).resolve();compiler_files=verify_compiler(compiler,read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json'))
    frozen=out/'frozen';frozen.mkdir()
    for name in own:shutil.copyfile(ROOT/name,frozen/Path(name).name)
    base=out/'base';candidate=out/'candidate';base.mkdir();candidate.mkdir()
    for folder in [base,candidate]:shutil.copyfile(protocol,folder/'frame-protocol.js')
    shutil.copyfile(source,base/'frame-hub.js')
    (candidate/'frame-hub.js').write_text(annotate(source.read_text(encoding='utf-8')),encoding='utf-8',newline='\n')
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    shutil.copyfile(HERE/'positive.ts',candidate/'positive.ts')
    cases=read(frozen/'cases.json');assert len(cases)==14;negatives=[]
    for case in cases:
        file=candidate/(case['name']+'.ts');assert file.parent==candidate
        file.write_text("import {FrameHub,streamFrames} from './frame-hub.js';\nimport type {HubTraceRecord} from './frame-hub.js';\nimport type {ServerResponse} from 'node:http';\ndeclare const response: ServerResponse;\nconst hub=new FrameHub();\n"+case['body'],encoding='utf-8')
        negatives.append(dict(name=case['name'],file=str(file),code=case['code']))
    transport=ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/transport.test.mjs';transport_hash=sha(transport)
    info=dict(baseline=str(base/'frame-hub.js'),baselineProtocol=str(base/'frame-protocol.js'),module=str(candidate/'frame-hub.js'),
         protocol=str(candidate/'frame-protocol.js'),positive=str(candidate/'positive.ts'),negatives=negatives,
         transportTest=str(transport),cache=str(cache),compilerModule=str(compiler/'package/lib/typescript.js'))
    save(out/'inputs.json',info)
    config=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/tsconfig.json')
    config['compilerOptions'].update(types=['node'],typeRoots=[str(cache/'types')],paths={'undici-types':[str(cache/'types/undici-types')]})
    config['files']=[info['module'],info['positive']];save(out/'tsconfig.json',config)
    stages=Stages(out,total_seconds=75);node=shutil.which('node');assert node
    inventory=lambda:{str(f.relative_to(out)) for f in out.rglob('*') if f.is_file()}
    before=inventory()
    stages.run('tsc-noemit',[node,compiler/'package/lib/tsc.js','--project',out/'tsconfig.json','--pretty','false','--listFiles'])
    assert inventory()-before=={'commands.json','tsc-noemit.stdout.txt','tsc-noemit.stderr.txt'}
    for part in ['baseline-positive','negative-1','negative-2','negative-3','ast-and-legacy']:
        stages.run(part,[node,frozen/'verify.mjs',out,part])
    positive_result=read(out/'baseline-positive.json');ast_result=read(out/'ast-and-legacy.json')
    negative_results=[row for part in ['negative-1','negative-2','negative-3'] for row in read(out/(part+'.json'))['negativeCases']]
    assert [(x['name'],x['code']) for x in negative_results]==[(x['name'],x['code']) for x in negatives]
    assert positive_result['positivePassed'] and ast_result['normalizedRuntimeAstEqual'] and len(negative_results)==14
    type_result=positive_result|{k:v for k,v in ast_result.items() if k in ['normalizedRuntimeAstEqual','optionalChainSemanticsPreserved','astMutationChecks','extractedLegacyHubCases','noCustomAnyIgnoreOrFakeDeclarations']}
    type_result.pop('part');type_result['negativeCases']=negative_results
    save(out/'type-results.json',type_result)
    stages.run('syntax',[node,'--check',candidate/'frame-hub.js'])
    tap=stages.run('pure-hub-equivalence',[node,'--test','--test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-timeout=3000',
         base/'legacy.test.mjs',candidate/'legacy.test.mjs',frozen/'runtime.test.mjs'],env=dict(os.environ,HUB_TYPE_INPUTS=str(out/'inputs.json')))
    assert '# tests 17' in tap and '# fail 0' in tap
    verify_protected(ROOT,protected);verify_protected(ROOT,own)
    assert sha(transport)==transport_hash and all(sha(Path(n))==h for n,h in watched.items());verify_protected(compiler/'package',compiler_files)
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'result.json',dict(passed=True,isolatedOnly=True,qaHashes=own,protectedInputs=407,typeResults=read(out/'type-results.json'),
         baselineSha256=sha(source),candidateSha256=sha(candidate/'frame-hub.js'),protocolSha256=sha(protocol),
         runtimeTests=17,legacyCasesPerImplementation=2,additionalRuntimeCases=13,commands=stages.commands,
         cacheFilesVerified=len(watched),runtimeSourceChanged=False,nativeOrLiveAppsUsed=False,projectOrGlobalDependencyInstalled=False))
    print('PASS: isolated shared Hub, 14 exact type refusals, 17 pure runtime cases; source unchanged')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
