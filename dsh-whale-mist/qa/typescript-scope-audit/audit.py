"""Read-only D2 inventory. No compiler, generator, package install or application is executed."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,textwrap

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
out=Path(args.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists()
fixed=ROOT/'.tmp/rc56-taskbar-title-candidate-20261029-b/unpacked'
manifest=load(ROOT/'release-sources/rc56/package-manifest.json')
expected={x['file']:x['sha256'] for x in manifest['files']}
protected=load(ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json')
assert all(sha(ROOT/n)==h for n,h in protected.items())
modules=['src/wallpaper/frame-protocol.js','src/wallpaper/author-properties-contract.js','src/wallpaper/media-bridge-permissions.js']
rows=[]
for n in modules:
    source=ROOT/'dsh-whale-mist'/n;text=source.read_text(encoding='utf-8')
    assert sha(fixed/n)==expected[n]
    rows.append({'file':n,'sha256':sha(source),'sameAsFixedRc56':source.read_bytes()==(fixed/n).read_bytes(),
                 'lines':len(text.splitlines()),'imports':re.findall(r'^import .*? from [\'\"]([^\'\"]+)',text,re.M),
                 'exports':re.findall(r'^export (?:async )?(?:const|function|class) (\w+)',text,re.M)})
assert all(row['sameAsFixedRc56'] for row in rows)
assert rows[0]['lines']==32 and rows[0]['imports']==[]
inputs=[ROOT/'dsh-whale-mist'/n for n in modules]
inputs += [ROOT/'dsh-whale-mist/scripts/build-wm-protocol.mjs',ROOT/'dsh-whale-mist/src/client.js',fixed/'src/client.js',
           ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js',fixed/'src/wallpaper/frame-hub.js',ROOT/'dsh-whale-mist/package.json']
before={str(p.relative_to(ROOT)):sha(p) for p in inputs}
protocol=(ROOT/'dsh-whale-mist/src/wallpaper/frame-protocol.js').read_text(encoding='utf-8')
injected=re.sub(r'^export ','',protocol,flags=re.M).replace('FrameDecoder','WM_FRAME_DECODER').strip()
def frame_block(file):
    text=file.read_text(encoding='utf-8')
    assert text.count('/* WM_FRAME_PROTOCOL */')==text.count('/* WM_FRAME_PROTOCOL_END */')==1
    return textwrap.dedent(text.split('/* WM_FRAME_PROTOCOL */')[1].split('/* WM_FRAME_PROTOCOL_END */')[0]).strip()
assert frame_block(ROOT/'dsh-whale-mist/src/client.js')==injected
assert frame_block(fixed/'src/client.js')==injected
consumer=ROOT/'dsh-whale-mist/src/wallpaper/frame-hub.js'
assert "from './frame-protocol.js'" in consumer.read_text(encoding='utf-8')
result={'kind':'read-only-typescript-scope-inventory-not-typecheck','passed':True,'modules':rows,
        'selectedFirstModule':modules[0],'proposedApproach':'JSDoc + allowJs/checkJs + noEmit; no suffix/output path change',
        'currentSharedAndFixedClientProtocolBlocksEqual':True,'clientInliner':'dsh-whale-mist/scripts/build-wm-protocol.mjs',
        'frameHubSameAsFixedRc56':consumer.read_bytes()==(fixed/'src/wallpaper/frame-hub.js').read_bytes(),
        'frameHubExcludedBecauseSharedHasUnshippedTrace':True,'tscOnPath':shutil.which('tsc'),
        'projectLocalTypeScriptPresent':(ROOT/'dsh-whale-mist/node_modules/typescript/package.json').exists(),
        'sourceHashes':before,'protectedInputs':len(protected),'typeChecksRun':0,'dependenciesInstalled':False,
        'runtimeSourceChanged':False,'generatorRun':False,'nativeOrAppOperations':False,
        'nextAcceptance':['pin an isolated development compiler','type errors at the real module and typed consumer boundary',
                          'negative fixtures reject wrong chunk/callback types','runtime bodies unchanged',
                          'existing frame split/damage/truncation regressions','no emitted runtime/asset files']}
assert all(sha(ROOT/n)==h for n,h in before.items()) and all(sha(ROOT/n)==h for n,h in protected.items())
out.mkdir();(out/'scope-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k not in ['sourceHashes','modules','nextAcceptance']}))
