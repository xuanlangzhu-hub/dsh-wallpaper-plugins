"""Generate only a fixed-payload copy and test its fragment against offline HTTP Host."""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,time
from prepare import prepare
import importlib.util
spec=importlib.util.spec_from_file_location('host_repair',Path(__file__).with_name('host-repair.py'));host_repair=importlib.util.module_from_spec(spec);spec.loader.exec_module(host_repair)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve()
assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
pins=json.loads((HERE/'baseline.json').read_bytes());fixed=ROOT/pins['fixedRuntime'];manifest=json.loads((ROOT/'release-sources/rc56/package-manifest.json').read_bytes())
assert manifest['version']=='0.6.0-rc.56'
assert all(sha(ROOT/n)==h for n,h in pins['integrationInputs'].items())
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes())
assert all(sha(ROOT/n)==h for n,h in protected.items())
files={r['file']:r['sha256'] for r in manifest['files']};assert len(files)==43
assert all(sha(fixed/n)==h for n,h in files.items())
qa_pins={f.name:sha(f) for f in HERE.iterdir() if f.is_file()}
frozen=out/'frozen';frozen.mkdir()
for f in HERE.iterdir():
 if f.is_file():shutil.copyfile(f,frozen/f.name)
receipt=prepare(out/'repair');payload=out/'payload';payload.mkdir()
for n in files:
 dest=payload/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(fixed/n,dest)
build=out/'build';(build/'scripts').mkdir(parents=True);(build/'src/sidebar').mkdir(parents=True)
builder=ROOT/'dsh-whale-mist/scripts/build-native-sidebar.mjs';shutil.copyfile(builder,build/'scripts/build-native-sidebar.mjs')
shutil.copyfile(fixed/'src/client.js',build/'src/client.js');shutil.copyfile(ROOT/pins['source'],build/'src/sidebar/native-appearance-sidebar.js')
deadline=time.monotonic()+90;commands=[];node=shutil.which('node');assert node
env=dict(os.environ,AUTHOR_GENERATED_CLIENT=str(payload/'src/client.js'),AUTHOR_INTEGRATION_RUNTIME=str(payload),AUTHOR_CONTRACT_SOURCE=str(payload/'src/wallpaper/author-properties-contract.js'))
def run(label,argv,expected=0):
 child=subprocess.Popen([str(v) for v in argv],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000)
 timed=False
 try:stdout,stderr=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:
  timed=True;child.kill();stdout,stderr=child.communicate(timeout=3)
 entry={'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timed};commands.append(entry)
 (out/(label+'.stdout.txt')).write_bytes(stdout);(out/(label+'.stderr.txt')).write_bytes(stderr)
 (out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
 assert not timed and child.returncode==expected,(label,'inspect retained output')
 return stdout.decode('utf-8')
run('original-generator-check',[node,build/'scripts/build-native-sidebar.mjs','--check'])
shutil.copyfile(out/'repair/native-sidebar.mjs',build/'src/sidebar/native-appearance-sidebar.js')
run('generate',[node,build/'scripts/build-native-sidebar.mjs'])
run('generated-check',[node,build/'scripts/build-native-sidebar.mjs','--check'])
shutil.copyfile(build/'src/client.js',payload/'src/client.js')
run('syntax',[node,'--check',payload/'src/client.js'])
old=(fixed/'src/client.js').read_bytes();new=(payload/'src/client.js').read_bytes()
begin=b'    /* WM_NATIVE_SIDEBAR_BEGIN */';end=b'    /* WM_NATIVE_SIDEBAR_END */'
assert old.count(begin)==new.count(begin)==old.count(end)==new.count(end)==1
assert old.split(begin)[0]==new.split(begin)[0] and old.split(end)[1]==new.split(end)[1]
changes=[n for n,h in files.items() if sha(payload/n)!=h];assert changes==['src/client.js'],changes
assert set(str(f.relative_to(payload)).replace('\\','/') for f in payload.rglob('*') if f.is_file())==set(files)
routes=run('routes-before-host-repair',[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',frozen/'routes.test.mjs'],1)
assert '# tests 11' in routes and '# fail 1' in routes
tests=[]
for n in ['author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs']:
 text=(ROOT/'dsh-whale-mist/qa'/n).read_text(encoding='utf-8')
 text=re.sub(r"(['\"])\.\./src/([^'\"]+)\1",lambda m:(payload/'src'/m[2]).as_uri().__repr__(),text)
 dest=frozen/n;dest.write_text(text,encoding='utf-8');tests.append(dest)
argv=[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',*tests]
baseline=run('host-baseline-red',argv,1);assert '# tests 56' in baseline and '# fail 4' in baseline
host_receipt=host_repair.prepare_host(out/'host-repair')
shutil.copyfile(out/'host-repair/author-properties-host.js',payload/'src/wallpaper/author-properties-host.js')
run('host-syntax',[node,'--check',payload/'src/wallpaper/author-properties-host.js'])
legacy=run('host-regressions',argv)
assert '# fail 0' in legacy
routes=run('routes-after-host-repair',[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',frozen/'routes.test.mjs'])
assert '# tests 11' in routes and '# fail 0' in routes
changes=[n for n,h in files.items() if sha(payload/n)!=h];assert set(changes)=={'src/client.js','src/wallpaper/author-properties-host.js'}
assert all(sha(ROOT/n)==h for n,h in protected.items()) and all(sha(fixed/n)==h for n,h in files.items())
assert all(sha(HERE/n)==h for n,h in qa_pins.items())
result={'passed':True,'fixedFiles':43,'changedFiles':changes,'unchangedFiles':41,'outsideFragmentUnchanged':True,'clientSha256':sha(payload/'src/client.js'),'sourceReceipt':receipt,'hostReceipt':host_receipt,'baselineHostExpectedFailures':4,
 'generatedControllerAuthenticatedHostAdapterChecks':11,'hostRegressionTests':int(re.search(r'# tests (\d+)',legacy)[1]),'commands':commands,'protectedInputs':len(protected),
 'sourceManifestSha256':sha(ROOT/'release-sources/rc56/package-manifest.json'),'generatorSha256':sha(builder),'frozenQa':{f.name:sha(f) for f in frozen.iterdir() if f.is_file()},
 'network':'owned ephemeral loopback HTTP only','childIo':'all ApplyAdapter children substituted; no executables or windows launched','sdkDomOrVisualAcceptance':False,'longRunRootCauseConfirmed':False,
 'installedOrPackaged':False,'versionUnchangedIsExperimentalCopyOnly':True,'totalDeadlineSeconds':90}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['frozenQa','commands','sourceReceipt']}))
