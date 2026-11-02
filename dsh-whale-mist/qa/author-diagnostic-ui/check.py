from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,time
from prepare import prepare
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
pins=json.loads((HERE/'inputs.json').read_bytes());base=ROOT/pins['runtime'];prior=json.loads((ROOT/pins['priorResult']).read_bytes());assert len(prior['files'])==45 and all(sha(base/n)==h for n,h in prior['files'].items())
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in protected.items())
qa_pins={f.name:sha(f) for f in HERE.iterdir() if f.is_file()};frozen=out/'frozen';frozen.mkdir()
for n in qa_pins:shutil.copyfile(HERE/n,frozen/n)
receipt=prepare(out/'isolated');runtime=out/'isolated/runtime';build=out/'isolated/build';node=shutil.which('node');assert node
env=dict(os.environ,AUTHOR_UI_RUNTIME=str(runtime),AUTHOR_UI_BUILD=str(out/'isolated/build.json'),AUTHOR_EXPORT_RUNTIME=str(runtime),AUTHOR_EXPORT_BUILD=str(out/'isolated/build.json'),AUTHOR_GENERATED_CLIENT=str(runtime/'src/client.js'),AUTHOR_INTEGRATION_RUNTIME=str(runtime),AUTHOR_CONTRACT_SOURCE=str(runtime/'src/wallpaper/author-properties-contract.js'),AUTHOR_SIDEBAR_SOURCE=str(out/'isolated/native-sidebar.mjs'))
deadline=time.monotonic()+90;commands=[]
def run(label,argv):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:stdout,stderr=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();stdout,stderr=child.communicate(timeout=3)
 commands.append({'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timed});(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(stdout);(out/(label+'.stderr.txt')).write_bytes(stderr)
 assert not timed and child.returncode==0,(label,'inspect retained outputs');return stdout.decode('utf-8')
run('generate',[node,build/'scripts/build-native-sidebar.mjs']);run('generated-check',[node,build/'scripts/build-native-sidebar.mjs','--check']);shutil.copyfile(build/'src/client.js',runtime/'src/client.js')
for n in ['src/client.js','src/index.js','src/wallpaper/author-diagnostics.js','src/wallpaper/author-diagnostic-lifecycle.js','src/wallpaper/author-diagnostic-build.js']:run('syntax-'+Path(n).stem,[node,'--check',runtime/n])
qa=ROOT/'dsh-whale-mist/qa';shutil.copyfile(qa/'native-choice-contract-fixture.mjs',frozen/'native-choice-contract-fixture.mjs')
new=run('lifecycle-bootstrap-component',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',frozen/'lifecycle.test.mjs',frozen/'bootstrap.test.mjs',frozen/'component.test.mjs',frozen/'provider-flow.test.mjs']);assert '# fail 0' in new
# Reuse the prior frozen actual-route recipe with its explicit renderer/Host injection.
oldround=ROOT/'.tmp/author-diagnostic-integration-20261029-e/frozen'
for n in ['export.test.mjs','routes.test.mjs','generated-controller.mjs']:shutil.copyfile(oldround/n,frozen/n)
exports=run('retained-export-routes',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',frozen/'export.test.mjs',frozen/'routes.test.mjs']);assert '# tests 30' in exports and '# fail 0' in exports
tests=[]
for n in ['author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs','native-sidebar.test.mjs']:
 text=(qa/n).read_text(encoding='utf-8').replace("'../src/sidebar/native-appearance-sidebar.js'",(out/'isolated/native-sidebar.mjs').as_uri().__repr__())
 text=re.sub(r"(['\"])\.\./src/([^'\"]+)\1",lambda m:(runtime/'src'/m[2]).as_uri().__repr__(),text)
 dest=frozen/n;dest.write_text(text,encoding='utf-8');tests.append(dest)
legacy=run('host-and-provider',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',*tests]);assert '# tests 76' in legacy and '# fail 0' in legacy
files={str(f.relative_to(runtime)).replace('\\','/'):sha(f) for f in runtime.rglob('*') if f.is_file()};assert set(files)==set(prior['files'])|{'src/wallpaper/author-diagnostic-lifecycle.js','src/wallpaper/author-diagnostic-build.js'}
changed=[n for n,h in prior['files'].items() if files[n]!=h];assert set(changed)=={'src/client.js','src/index.js','src/wallpaper/author-diagnostics.js'}
edges=[]
for f in (runtime/'src').rglob('*.js'):
 for n in re.findall(r"^import\s+(?:.*?from\s+)?['\"]([^'\"]+)['\"]",f.read_text(encoding='utf-8'),re.M):
  if n.startswith('.'):
   dest=(f.parent/n).resolve();assert dest.is_relative_to(runtime) and dest.is_file(),(f,n);edges.append(str(dest.relative_to(runtime)))
assert all(sha(base/n)==h for n,h in prior['files'].items()) and all(sha(ROOT/n)==h for n,h in protected.items());assert all(sha(HERE/n)==h for n,h in qa_pins.items())
result={'passed':True,'newLifecycleBootstrapUiChecks':int(re.search(r'# tests (\d+)',new)[1]),'retainedExportRouteChecks':30,'hostAndProviderChecks':76,'files':files,'changedFromPrior':changed,'newModules':['src/wallpaper/author-diagnostic-lifecycle.js','src/wallpaper/author-diagnostic-build.js'],'importEdges':len(edges),'build':receipt['build'],'protectedInputs':len(protected),'commands':commands,'frozenQa':{f.name:sha(f) for f in frozen.iterdir() if f.is_file()},'defaultEnabled':False,'optInEnvironment':'WM_AUTHOR_DIAGNOSTICS=1','bootstrapWired':True,'explicitBrowserDownloadUiWired':True,'fileSavedAcceptance':False,'desktopSdkOrLiveAppUsed':False,'installedOrPackaged':False,'totalDeadlineSeconds':90,'nodeTestIsolation':'none','longRunRootCauseConfirmed':False}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['files','commands','frozenQa','build']}))
