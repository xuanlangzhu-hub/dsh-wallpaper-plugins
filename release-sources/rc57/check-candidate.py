"""Check the actual rc.57 archive in a new evidence directory, without live apps."""
from pathlib import Path
import argparse, hashlib, json, os, re, shutil, subprocess, tarfile, time

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
read=lambda p:json.loads(p.read_bytes())
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
candidate=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b'
other=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-a'
audit=read(candidate/'candidate-audit.json');manifest=read(candidate/'package-manifest.json')
assert sha(candidate/audit['archive'])==audit['sha256']==sha(other/audit['archive'])
assert manifest==read(other/'package-manifest.json')
manifest={row['file']:row['sha256'] for row in manifest['files']}
runtime=candidate/'unpacked';build=candidate/'build.json';prior=ROOT/'.tmp/author-diagnostic-ui-20261029-d'
expected=read(prior/'result.json');protected=read(ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json')
assert len(manifest)==47 and all(sha(runtime/n)==h for n,h in manifest.items())
assert all(sha(ROOT/n)==h for n,h in protected.items())
frozen=out/'frozen';frozen.mkdir()
for name,h in expected['frozenQa'].items():
 source=prior/'frozen'/name;assert sha(source)==h
 text=source.read_text(encoding='utf-8')
 text=text.replace((prior/'isolated/runtime').as_uri(),runtime.as_uri())
 text=text.replace((prior/'isolated/native-sidebar.mjs').as_uri(),(candidate/'native-sidebar.mjs').as_uri())
 (frozen/name).write_text(text,encoding='utf-8')
env=dict(os.environ,AUTHOR_UI_RUNTIME=str(runtime),AUTHOR_UI_BUILD=str(build),AUTHOR_EXPORT_RUNTIME=str(runtime),AUTHOR_EXPORT_BUILD=str(build),AUTHOR_GENERATED_CLIENT=str(runtime/'src/client.js'),AUTHOR_INTEGRATION_RUNTIME=str(runtime),AUTHOR_CONTRACT_SOURCE=str(runtime/'src/wallpaper/author-properties-contract.js'),AUTHOR_SIDEBAR_SOURCE=str(candidate/'native-sidebar.mjs'))
commands=[];deadline=time.monotonic()+90;node=shutil.which('node');assert node
def run(label,args):
 child=subprocess.Popen([str(x) for x in args],cwd=out,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000)
 timed=False
 try:data,error=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:
  timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed))
 (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
 (out/(label+'.stdout.txt')).write_bytes(data);(out/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,label
 return data.decode('utf-8')
js=list(runtime.rglob('*.js'))
for f in js:run('syntax-'+f.stem,[node,'--check',f])
counts=[]
for label,names,count in [
 ('candidate-ui',['lifecycle.test.mjs','bootstrap.test.mjs','component.test.mjs','provider-flow.test.mjs'],40),
 ('candidate-export',['export.test.mjs','routes.test.mjs'],30),
 ('candidate-host',['author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs','native-sidebar.test.mjs'],76)]:
 data=run(label,[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',*[frozen/n for n in names]])
 assert f'# tests {count}' in data and '# fail 0' in data;counts.append(count)
edges=[]
for f in js:
 for name in re.findall(r"^import\s+(?:.*?from\s+)?['\"]([^'\"]+)['\"]",f.read_text(encoding='utf-8'),re.M):
  if name.startswith('.'):
   dest=(f.parent/name).resolve();assert dest.is_relative_to(runtime) and dest.is_file();edges.append(str(dest.relative_to(runtime)))
assert all(sha(runtime/n)==h for n,h in manifest.items()) and all(sha(ROOT/n)==h for n,h in protected.items())
result=dict(passed=True,archiveSha256=audit['sha256'],independentArchivesIdentical=True,files=47,javaScriptSyntaxChecks=len(js),checks=counts,totalBehaviorChecks=sum(counts),importEdges=len(edges),protectedInputs=len(protected),commands=commands,liveAppsUsed=False,downloadSavedAcceptance=False,longRunRootCauseConfirmed=False)
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
for n in ['candidate-audit.json','package-manifest.json','build.json']:
 shutil.copyfile(candidate/n,HERE/n)
print(json.dumps({k:v for k,v in result.items() if k!='commands'}))
