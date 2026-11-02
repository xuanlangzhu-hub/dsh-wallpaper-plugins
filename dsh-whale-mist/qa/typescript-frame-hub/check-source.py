"""Node-only check of the real Hub; all generated fixtures stay inside the fresh output."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import argparse,shutil,hashlib,os,json
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-check'))
from common import Stages,read,save,sha,verify_compiler,verify_protected,load_annotation_recipe
sys.path.insert(0,str(ROOT/'dsh-whale-mist/qa/typescript-node-environment'))
from prepare import payload
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--cache',required=True)
p.add_argument('--compiler-root',required=True)
a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
try:
    manifest=ROOT/'dsh-whale-mist/qa/typescript-check/protected-baseline-v7.json'
    protected=read(manifest);assert len(protected)==432;verify_protected(ROOT,protected)
    recipeFile=HERE/'annotate.py';annotate=load_annotation_recipe(recipeFile)
    source=ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js';protocol=ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js'
    baseline=HERE/'baseline/frame-hub.js'
    assert sha(baseline)=='6B3E697A5317EF81BBDC39599A111FA3D949526CA28198456EEC88AD8AB5DF57'
    assert source.read_text(encoding='utf-8')==annotate(baseline.read_text(encoding='utf-8'))
    assert source.read_bytes().count(b'\r\n')==source.read_bytes().count(b'\n')
    own={str(manifest):sha(manifest)}
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
    for name in ['check-source.py','annotate.py','verify.mjs','cases.json','positive.ts','runtime.test.mjs','SOURCE_CHECK.md']:
        shutil.copyfile(HERE/name,frozen/name)
    original_verifier=(frozen/'verify.mjs').read_text(encoding='utf-8')
    old="for(const folder of [path.dirname(info.baseline),path.dirname(info.module)])fs.writeFileSync(path.join(folder,'legacy.test.mjs'),pure,{flag:'wx'});"
    new="for(const row of info.legacyOutputs){ const rebound=pure.replace(\"from './frame-hub.js'\", 'from '+JSON.stringify(pathToFileURL(row.module).href)); fs.writeFileSync(row.file,rebound,{flag:'wx'}); }"
    assert original_verifier.count(old)==1
    (frozen/'verify.mjs').write_text(original_verifier.replace(old,new),encoding='utf-8')
    save(out/'verifier-output-routing.json',dict(sourceSha256=sha(HERE/'verify.mjs'),frozenSha256=sha(frozen/'verify.mjs'),
         onlyChange='Route extracted legacy test files and their imports into explicit output locations; type/AST checks unchanged'))
    base=out/'base';actual=out/'actual';base.mkdir();actual.mkdir()
    shutil.copyfile(baseline,base/'frame-hub.js');shutil.copyfile(protocol,base/'frame-protocol.js')
    (out/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    rel=os.path.relpath(source,actual).replace('\\','/')
    text=(HERE/'positive.ts').read_text(encoding='utf-8');assert text.count('./frame-hub.js')==2
    (actual/'positive.ts').write_text(text.replace('./frame-hub.js',rel),encoding='utf-8')
    cases=read(frozen/'cases.json');assert len(cases)==14;negatives=[]
    for case in cases:
        file=actual/(case['name']+'.ts');assert file.parent==actual
        file.write_text("import {FrameHub,streamFrames} from '"+rel+"';\nimport type {HubTraceRecord} from '"+rel+"';\nimport type {ServerResponse} from 'node:http';\ndeclare const response: ServerResponse;\nconst hub=new FrameHub();\n"+case['body'],encoding='utf-8')
        negatives.append(dict(name=case['name'],file=str(file),code=case['code']))
    transport=ROOT/'dsh-whale-mist/qa/wallpaper-preview/tests/transport.test.mjs';transport_hash=sha(transport)
    info=dict(baseline=str(base/'frame-hub.js'),baselineProtocol=str(base/'frame-protocol.js'),module=str(source),protocol=str(protocol),
         positive=str(actual/'positive.ts'),negatives=negatives,transportTest=str(transport),cache=str(cache),
         compilerModule=str(compiler/'package/lib/typescript.js'),legacyOutputs=[
          dict(file=str(base/'legacy.test.mjs'),module=str(base/'frame-hub.js')),
          dict(file=str(actual/'legacy.test.mjs'),module=str(source))])
    save(out/'inputs.json',info)
    config=read(ROOT/'dsh-whale-mist/qa/typescript-frame-protocol/tsconfig.json')
    config['compilerOptions'].update(types=['node'],typeRoots=[str(cache/'types')],paths={'undici-types':[str(cache/'types/undici-types')]})
    config['files']=[str(source),info['positive']];save(out/'tsconfig.json',config)
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
    type_result.pop('part');type_result['negativeCases']=negative_results;save(out/'type-results.json',type_result)
    stages.run('syntax',[node,'--check',source])
    tap=stages.run('pure-hub-equivalence',[node,'--test','--test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-timeout=3000',
         base/'legacy.test.mjs',actual/'legacy.test.mjs',frozen/'runtime.test.mjs'],env=dict(os.environ,HUB_TYPE_INPUTS=str(out/'inputs.json')))
    assert '# tests 17' in tap and '# fail 0' in tap
    verify_protected(ROOT,protected)
    assert all(sha(Path(n))==h for n,h in own.items()) and sha(transport)==transport_hash and all(sha(Path(n))==h for n,h in watched.items())
    verify_protected(compiler/'package',compiler_files)
    assert not any(list(out.rglob(s)) for s in ['*.d.ts','*.map','*.tsbuildinfo'])
    save(out/'result.json',dict(passed=True,checkedActualDevelopmentHub=True,source=str(source),sourceSha256=sha(source),
         normalizedSourceMatchesReviewedRecipe=True,baselineSha256=sha(baseline),protocolSha256=sha(protocol),
         annotationRecipe=dict(file=str(recipeFile),sha256=sha(recipeFile)),typeResults=read(out/'type-results.json'),runtimeTests=17,protectedInputs=432,commands=stages.commands,
         cacheFilesVerified=len(watched),sourceWrittenByCheck=False,nativeOrLiveAppsUsed=False,
         projectOrGlobalDependencyInstalled=False,historicalRoundInputsRequired=False))
    print('PASS: actual development Hub, 14 exact type refusals, 17 pure runtime cases; no emit')
except Exception as error:
    save(out/'result.json',dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/'commands.json') if (out/'commands.json').exists() else []));raise
