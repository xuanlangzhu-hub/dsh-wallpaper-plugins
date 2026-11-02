from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,time
from prepare import prepare
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
pins=json.loads((HERE/'inputs.json').read_bytes());base=ROOT/pins['runtime'];previous=json.loads((ROOT/pins['diagnosticResult']).read_bytes());prior=json.loads((ROOT/'.tmp/author-slider-integration-20261029-f/result.json').read_bytes())
expected={r['file']:r['sha256'] for r in json.loads((ROOT/'release-sources/rc56/package-manifest.json').read_bytes())['files']}
expected.update({'src/client.js':prior['clientSha256'],'src/wallpaper/author-properties-host.js':previous['sources']['host'],'src/wallpaper/author-properties-apply.js':previous['sources']['adapter'],'src/wallpaper/author-diagnostics.js':previous['sources']['recorder']});assert len(expected)==44
assert all(sha(base/n)==h for n,h in expected.items())
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in protected.items())
qa_pins={f.name:sha(f) for f in HERE.iterdir() if f.is_file()};frozen=out/'frozen';frozen.mkdir()
for n in qa_pins:shutil.copyfile(HERE/n,frozen/n)
receipt=prepare(out/'isolated');runtime=out/'isolated/runtime';build=out/'isolated/build';node=shutil.which('node');assert node
env=dict(os.environ,AUTHOR_EXPORT_RUNTIME=str(runtime),AUTHOR_EXPORT_BUILD=str(out/'isolated/build.json'),AUTHOR_GENERATED_CLIENT=str(runtime/'src/client.js'),AUTHOR_INTEGRATION_RUNTIME=str(runtime),AUTHOR_CONTRACT_SOURCE=str(runtime/'src/wallpaper/author-properties-contract.js'),AUTHOR_SIDEBAR_SOURCE=str(out/'isolated/native-sidebar.mjs'))
deadline=time.monotonic()+90;commands=[]
# A finite, CPU-blocked owned child proves the parent can stop a blocked event loop.
# Test isolation below is disabled so that a timed-out runner cannot orphan Node workers.
probe=subprocess.Popen([node,'-e','const until=Date.now()+3000;while(Date.now()<until){}'],cwd=out,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);probe_timed=False
try:probe.communicate(timeout=.2)
except subprocess.TimeoutExpired:
 probe_timed=True
 if probe.poll() is None:probe.kill()
 probe.communicate(timeout=3)
assert probe_timed and probe.returncode is not None
(out/'guardian-probe.json').write_text(json.dumps({'pid':probe.pid,'finiteBusyLoopMs':3000,'parentDeadlineMs':200,'deadlineTriggered':probe_timed,'exitConfirmed':True,'code':probe.returncode,'killUsesRetainedHandle':True},indent=2),encoding='utf-8')
def run(label,argv):
 child=subprocess.Popen([str(x) for x in argv],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:stdout,stderr=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();stdout,stderr=child.communicate(timeout=3)
 commands.append({'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timed});(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(out/(label+'.stdout.txt')).write_bytes(stdout);(out/(label+'.stderr.txt')).write_bytes(stderr)
 assert not timed and child.returncode==0,(label,'inspect retained output');return stdout.decode('utf-8')
run('generate',[node,build/'scripts/build-native-sidebar.mjs']);run('generated-check',[node,build/'scripts/build-native-sidebar.mjs','--check']);shutil.copyfile(build/'src/client.js',runtime/'src/client.js')
for name in ['src/client.js','src/detachable-host.js','src/wallpaper/author-diagnostic-export.js']:run('syntax-'+Path(name).stem,[node,'--check',runtime/name])
exports=run('exports',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=10000',frozen/'export.test.mjs']);assert '# tests 19' in exports and '# fail 0' in exports
# Use the actual generated fragment, injecting separate renderer/Host recorders in QA only.
qa=ROOT/'dsh-whale-mist/qa';recovery=qa/'author-slider-recovery';shutil.copyfile(recovery/'generated-controller.mjs',frozen/'generated-controller.mjs')
routes=(recovery/'routes.test.mjs').read_text(encoding='utf-8')
routes="import {readFile} from 'node:fs/promises';\n"+routes
routes=routes.replace("const id='we-'+'a'.repeat(24);","const {createAuthorDiagnosticSession}=await import(pathToFileURL(basePath+'/src/wallpaper/author-diagnostic-export.js'));\nconst {createAuthorDiagnosticRecorder}=await import(pathToFileURL(basePath+'/src/wallpaper/author-diagnostics.js'));\nconst diagnosticBuild=JSON.parse(await readFile(process.env.AUTHOR_EXPORT_BUILD,'utf8'));\nconst id='we-'+'a'.repeat(24);")
routes=routes.replace(' const requests=[],commands=[],physical=[],children=new Set(),controllers=[];'," const diagnosticSession=createAuthorDiagnosticSession({enabled:true,build:diagnosticBuild});const rendererDiagnostic=createAuthorDiagnosticRecorder({sources:diagnosticBuild.sources});\n const requests=[],commands=[],physical=[],children=new Set(),controllers=[];")
routes=routes.replace('createAuthorApplyAdapter({readTarget:()=>target,runChild:', 'createAuthorApplyAdapter({diagnostics:diagnosticSession.recorder,readTarget:()=>target,runChild:')
routes=routes.replace('authorApplyAdapter:adapter,readWallpaperLifecycle:', 'authorApplyAdapter:adapter,authorDiagnosticSession:diagnosticSession,readWallpaperLifecycle:')
routes=routes.replace('createNativeAuthorSwitches({request,validateValue:validateAuthorValue})','createNativeAuthorSwitches({request,validateValue:validateAuthorValue,diagnostics:rendererDiagnostic})')
assert 'authorDiagnosticSession:diagnosticSession' in routes and 'diagnostics:rendererDiagnostic' in routes
(frozen/'routes.test.mjs').write_text(routes,encoding='utf-8');full=run('generated-routes',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',frozen/'routes.test.mjs']);assert '# tests 11' in full and '# fail 0' in full
tests=[]
for n in ['author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs','native-sidebar.test.mjs']:
 text=(qa/n).read_text(encoding='utf-8').replace("'../src/sidebar/native-appearance-sidebar.js'",(out/'isolated/native-sidebar.mjs').as_uri().__repr__())
 text=re.sub(r"(['\"])\.\./src/([^'\"]+)\1",lambda m:(runtime/'src'/m[2]).as_uri().__repr__(),text)
 dest=frozen/n;dest.write_text(text,encoding='utf-8');tests.append(dest)
shutil.copyfile(qa/'native-choice-contract-fixture.mjs',frozen/'native-choice-contract-fixture.mjs')
legacy=run('host-and-provider-regressions',[node,'--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',*tests]);assert '# fail 0' in legacy
# Freeze and check exact import/file closure, including private modules.
imports=[]
for file in (runtime/'src').rglob('*.js'):
 for name in re.findall(r"^import\s+(?:.*?from\s+)?['\"]([^'\"]+)['\"]",file.read_text(encoding='utf-8'),re.M):
  if name.startswith('.'):
   target=(file.parent/name).resolve();assert target.is_relative_to(runtime) and target.is_file(),(file,name);imports.append(str(target.relative_to(runtime)))
actual={str(f.relative_to(runtime)).replace('\\','/'):sha(f) for f in runtime.rglob('*') if f.is_file()};assert set(actual)==set(expected)|{'src/wallpaper/author-diagnostic-export.js'}
changes=[n for n,h in expected.items() if actual[n]!=h];assert set(changes)=={'src/client.js','src/detachable-host.js'}
old=(base/'src/client.js').read_text(encoding='utf-8');new=(runtime/'src/client.js').read_text(encoding='utf-8');begin='    /* WM_NATIVE_SIDEBAR_BEGIN */';end='    /* WM_NATIVE_SIDEBAR_END */'
strip=lambda s:s[:s.index(begin)]+s[s.index(end)+len(end):]
rest=strip(new).replace((HERE/'bridge-method.txt').read_text(encoding='utf-8'),'').replace('        requestAuthor,\n        requestAuthorDiagnostics,\n        dispose,','        requestAuthor,\n        dispose,');assert rest==strip(old)
native=(out/'isolated/native-sidebar.mjs').read_text(encoding='utf-8').replace('requestAuthor,validateValue,editorGate=null,diagnostics=null})','requestAuthor,validateValue,editorGate=null})').replace('createNativeAuthorSwitches({request:requestAuthor,validateValue,diagnostics})','createNativeAuthorSwitches({request:requestAuthor,validateValue})');assert native==(ROOT/pins['controller']).read_text(encoding='utf-8')
assert all(sha(base/n)==h for n,h in expected.items()) and all(sha(ROOT/n)==h for n,h in protected.items());assert all(sha(HERE/n)==h for n,h in qa_pins.items())
result={'passed':True,'exportChecks':19,'generatedAuthenticatedRoutes':11,'hostAndProviderRegressions':int(re.search(r'# tests (\d+)',legacy)[1]),'files':actual,'changedFilesFromPriorDiagnosticExperiment':changes,'newPrivateModule':'src/wallpaper/author-diagnostic-export.js','importEdges':len(imports),'clientChangesOutsideFragment':'one export method and its returned API only','build':receipt['build'],'protectedInputs':len(protected),'commands':commands,'frozenQa':{f.name:sha(f) for f in frozen.iterdir() if f.is_file()},'newPublicHttpRoutes':0,'defaultEnabled':False,'productionBootstrapActivationOrSaveUiWired':False,'installedOrPackaged':False,'liveAppQueriesOrWindowsIo':False,'totalDeadlineSeconds':90,'longRunRootCauseConfirmed':False,'nodeTestIsolation':'none','blockedEventLoopGuardianProbePassed':True}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['files','commands','frozenQa','build']}))
