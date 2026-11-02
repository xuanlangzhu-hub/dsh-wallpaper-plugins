"""Validate the actual trial archive in a fresh directory; never inspect live apps."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, os, re, subprocess, time

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
read=lambda p:json.loads(p.read_bytes())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
out=Path(args.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
candidate=ROOT/'.tmp/rc59-ui-material-candidate-20261031-b'
audit=read(candidate/'candidate-audit.json');manifest=read(candidate/'package-manifest.json')
archive=candidate/audit['archive'];assert sha(archive)==audit['sha256']==manifest['archiveSha256']
spec=importlib.util.spec_from_file_location('rc59_archive_recipe',HERE.parent/'rc58/build-candidate.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
files,modes=module.unpack(archive.read_bytes());expected={r['file']:r['sha256'] for r in manifest['files']}
assert len(files)==47 and {n:hashlib.sha256(b).hexdigest().upper() for n,b in files.items()}==expected
runtime=out/'runtime'
for n,b in files.items():p=runtime/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
protected=read(ROOT/'.tmp/pixso-ui-proportion-material-20261031-a/protected-after-approved.json')
assert all(sha(ROOT/n)==h for n,h in protected.items())
old=ROOT/'.tmp/rc57-author-diagnostic-package-check-20261029-b/frozen';frozen=out/'frozen';frozen.mkdir()
prior=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b'
for source in old.glob('*.mjs'):
    text=source.read_text(encoding='utf-8').replace((prior/'unpacked').as_uri(),runtime.as_uri()).replace((prior/'native-sidebar.mjs').as_uri(),(candidate/'native-sidebar.mjs').as_uri())
    (frozen/source.name).write_text(text,encoding='utf-8')
env=dict(os.environ,AUTHOR_UI_RUNTIME=str(runtime),AUTHOR_UI_BUILD=str(candidate/'build.json'),AUTHOR_EXPORT_RUNTIME=str(runtime),AUTHOR_EXPORT_BUILD=str(candidate/'build.json'),AUTHOR_GENERATED_CLIENT=str(runtime/'src/client.js'),AUTHOR_INTEGRATION_RUNTIME=str(runtime),AUTHOR_CONTRACT_SOURCE=str(runtime/'src/wallpaper/author-properties-contract.js'),AUTHOR_SIDEBAR_SOURCE=str(candidate/'native-sidebar.mjs'))
commands=[];deadline=time.monotonic()+75;node='C:/Program Files/nodejs/node.exe'
def run(label,argv,limit=20):
    child=subprocess.Popen([str(a) for a in argv],cwd=out,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
    try:data,error=child.communicate(timeout=min(limit,max(.1,deadline-time.monotonic())))
    except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
    commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed))
    (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
    assert not timed and child.returncode==0,(label,error.decode('utf-8',errors='replace'));return data.decode('utf-8')
js=list(runtime.rglob('*.js'))
for f in js:run('syntax-'+f.stem,[node,'--check',f],4)
# Rebind new material tests to the actual unpacked archive and sidebar adapter.
fixture=(ROOT/'dsh-whale-mist/qa/sidebar-material/fixture.mjs').read_text(encoding='utf8').replace('"../../src/sidebar/native-appearance-sidebar.js"',json.dumps((candidate/'native-sidebar.mjs').as_uri()))
(out/'material-fixture.mjs').write_text(fixture,encoding='utf8')
tests=(ROOT/'dsh-whale-mist/qa/sidebar-material/material.test.mjs').read_text(encoding='utf8').replace("'./fixture.mjs'","'./material-fixture.mjs'").replace("'../../src/client.js'",repr((runtime/'src/client.js').as_uri()))
(out/'material.test.mjs').write_text(tests,encoding='utf8')
counts=[]
for label,names,count in [('ui',['lifecycle.test.mjs','bootstrap.test.mjs','component.test.mjs','provider-flow.test.mjs'],40),('export',['export.test.mjs','routes.test.mjs'],30),('host',['author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs','native-sidebar.test.mjs'],76)]:
    data=run(label,[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',*[frozen/n for n in names]])
    assert f'# tests {count}' in data and '# fail 0' in data;counts.append(count)
data=run('material',[node,'--test','--test-reporter=tap','--test-timeout=10000',out/'material.test.mjs'])
assert '# tests 6' in data and '# fail 0' in data;counts.append(6)

guard=(ROOT/'dsh-whale-mist/qa/css-template-guard.mjs').read_text(encoding='utf-8');needle="const root = join(dirname(fileURLToPath(import.meta.url)), '..');";assert guard.count(needle)==1
(out/'css-template-guard.mjs').write_text(guard.replace(needle,'const root = '+json.dumps(str(runtime))+';'),encoding='utf-8');run('css-guard',[node,out/'css-template-guard.mjs'])
edges=[]
for f in js:
    for name in re.findall(r"^import\s+(?:.*?from\s+)?['\"]([^'\"]+)['\"]",f.read_text(encoding='utf-8'),re.M):
        if name.startswith('.'):
            target=(f.parent/name).resolve();assert target.is_relative_to(runtime) and target.is_file();edges.append(str(target.relative_to(runtime)))
assert all(sha(runtime/n)==h for n,h in expected.items()) and all(sha(ROOT/n)==h for n,h in protected.items())
build=read(candidate/'build.json');assert build['payloadVersion']=='0.6.0-rc.59' and sha(candidate/'native-sidebar.mjs')==build['sources']['controller']
literal=json.dumps(build,ensure_ascii=True,separators=(',',':')).encode()
assert files['src/client.js'].count(literal)==files['src/wallpaper/author-diagnostic-build.js'].count(literal)==1
result=dict(passed=True,archiveSha256=audit['sha256'],files=47,javaScriptSyntaxChecks=len(js),checks=counts,totalBehaviorChecks=sum(counts),importEdges=len(edges),cssGuard=True,protectedInputs=len(protected),commands=commands,liveAppsUsed=False,installed=False,publicReleaseAuthorized=False,defaultDiagnosticsEnabled=False)
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='commands'}))
