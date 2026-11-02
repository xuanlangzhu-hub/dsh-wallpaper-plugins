"""Bounded diagnosis-only source injection and behavioral differential checks."""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,subprocess,time
from prepare import prepare
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();assert out.is_relative_to(ROOT/'.tmp') and not out.exists();out.mkdir()
pins=json.loads((HERE/'inputs.json').read_bytes());base=ROOT/pins['runtime'];controller=ROOT/pins['controller']
protected=json.loads((ROOT/'.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes());assert all(sha(ROOT/n)==h for n,h in protected.items())
base_files={str(f.relative_to(base)).replace('\\','/'):sha(f) for f in base.rglob('*') if f.is_file()};assert len(base_files)==43
prior=json.loads((ROOT/'.tmp/author-slider-integration-20261029-f/result.json').read_bytes());expected={r['file']:r['sha256'] for r in json.loads((ROOT/'release-sources/rc56/package-manifest.json').read_bytes())['files']}
expected.update({'src/client.js':prior['clientSha256'],'src/wallpaper/author-properties-host.js':prior['hostReceipt']['outputSha256']});assert base_files==expected
qa_pins={f.name:sha(f) for f in HERE.iterdir() if f.is_file()};frozen=out/'frozen';frozen.mkdir()
for n in qa_pins:shutil.copyfile(HERE/n,frozen/n)
receipt=prepare(out/'isolated');runtime=out/'runtime';shutil.copytree(base,runtime)
for n in ['author-properties-host.js','author-properties-apply.js','author-diagnostics.js']:shutil.copyfile(out/'isolated/runtime/src/wallpaper'/n,runtime/'src/wallpaper'/n)
source=out/'isolated/native-sidebar.mjs';node=shutil.which('node');assert node
sources={'controller':sha(source),'host':sha(runtime/'src/wallpaper/author-properties-host.js'),'adapter':sha(runtime/'src/wallpaper/author-properties-apply.js'),'recorder':sha(runtime/'src/wallpaper/author-diagnostics.js')}
(out/'evidence').mkdir()
env=dict(os.environ,AUTHOR_DIAG_BASELINE=str(base),AUTHOR_DIAG_RUNTIME=str(runtime),AUTHOR_DIAG_BASELINE_CONTROLLER=str(controller),AUTHOR_DIAG_CONTROLLER=str(source),AUTHOR_DIAG_SOURCES=json.dumps(sources),AUTHOR_DIAG_EVIDENCE_DIR=str(out/'evidence'),AUTHOR_CONTRACT_SOURCE=str(runtime/'src/wallpaper/author-properties-contract.js'),AUTHOR_SIDEBAR_SOURCE=str(source))
deadline=time.monotonic()+90;commands=[]
def run(label,argv):
 child=subprocess.Popen([str(v) for v in argv],cwd=out,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000)
 timed=False
 try:stdout,stderr=child.communicate(timeout=min(25,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:timed=True;child.kill();stdout,stderr=child.communicate(timeout=3)
 commands.append({'label':label,'pid':child.pid,'exitConfirmed':child.returncode is not None,'code':child.returncode,'timedOut':timed})
 (out/(label+'.stdout.txt')).write_bytes(stdout);(out/(label+'.stderr.txt')).write_bytes(stderr);(out/'commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
 assert not timed and child.returncode==0,(label,'inspect retained outputs');return stdout.decode('utf-8')
run('controller-syntax',[node,'--check',source])
run('host-syntax',[node,'--check',runtime/'src/wallpaper/author-properties-host.js'])
run('adapter-syntax',[node,'--check',runtime/'src/wallpaper/author-properties-apply.js'])
new=run('recorder-and-equivalence',[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',frozen/'recorder.test.mjs',frozen/'equivalence.test.mjs'])
assert '# fail 0' in new
# Existing controller/field/recovery tests target the instrumented source; original files remain intact.
qa=ROOT/'dsh-whale-mist/qa';tests=[]
for n in ['native-author-sliders.test.mjs','native-author-switches.test.mjs','native-author-recovery.test.mjs','native-author-stale-recovery.test.mjs','author-recovery-host.test.mjs','author-stale-recovery-host.test.mjs','author-properties-integration.test.mjs']:
 text=(qa/n).read_text(encoding='utf-8').replace("'../src/sidebar/native-appearance-sidebar.js'",source.as_uri().__repr__())
 text=re.sub(r"(['\"])\.\./src/([^'\"]+)\1",lambda m:(runtime/'src'/m[2]).as_uri().__repr__(),text)
 dest=frozen/n;dest.write_text(text,encoding='utf-8');tests.append(dest)
legacy=run('existing-controller-host',[node,'--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=6500',*tests]);assert '# fail 0' in legacy
recovery=ROOT/'dsh-whale-mist/qa/author-slider-recovery';shutil.copyfile(recovery/'retry.test.mjs',frozen/'retry.test.mjs');shutil.copyfile(recovery/'component.test.mjs',frozen/'component.test.mjs')
# Component test imports only its explicitly declared metadata/React element stand-in.
shutil.copyfile(qa/'native-choice-contract-fixture.mjs',out/'native-choice-contract-fixture.mjs')
extra=run('recovery-new',[node,'--test','--test-reporter=tap','--test-timeout=6500',frozen/'retry.test.mjs',frozen/'component.test.mjs']);assert '# tests 17' in extra and '# fail 0' in extra
assert all(sha(base/n)==h for n,h in base_files.items()) and all(sha(ROOT/n)==h for n,h in protected.items())
assert all(sha(HERE/n)==h for n,h in qa_pins.items());assert all(sha(ROOT/n)==h for n,h in pins['files'].items())
evidence={f.name:sha(f) for f in (out/'evidence').iterdir()};assert len(evidence)==14
changes=[n for n,h in base_files.items() if sha(runtime/n)!=h];assert set(changes)=={'src/wallpaper/author-properties-host.js','src/wallpaper/author-properties-apply.js'}
assert set(str(f.relative_to(runtime)).replace('\\','/') for f in runtime.rglob('*') if f.is_file())==set(base_files)|{'src/wallpaper/author-diagnostics.js'}
result={'passed':True,'newChecks':int(re.search(r'# tests (\d+)',new)[1]),'equivalenceModes':['baseline','instrumented-off','instrumented-on','throwing-recorder','removed-mid-operation'],'syntheticEvidence':evidence,'existingControllerHostChecks':int(re.search(r'# tests (\d+)',legacy)[1]),'retainedNewRecoveryChecks':17,'protectedInputs':len(protected),'baselineRuntimeFiles':len(base_files),'baselineControllerSha256':sha(controller),'sources':sources,'changedRuntimeFiles':changes,'addedModule':'src/wallpaper/author-diagnostics.js','receipt':receipt,'commands':commands,'frozenQa':{f.name:sha(f) for f in frozen.iterdir() if f.is_file()},'clockDomain':'one process only; no cross-process timing assertion','diagnosticWiringInProduction':False,'generatedClient':False,'installedOrPackaged':False,'totalDeadlineSeconds':90,'liveWindowsComCaptureOrDailyQueries':False,'longRunRootCauseConfirmed':False}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['commands','receipt','frozenQa']}))
