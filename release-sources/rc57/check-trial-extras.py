from pathlib import Path
import hashlib,json,os,subprocess,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];trial=Path(sys.argv[1]).resolve()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
config=read(trial/'trial-config.json');assert config['profileWritesAuthorized'] is False and str(trial)==config['trialRoot']
pwsh='C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
rows=[]
def run(label,argv,expected=0):
 result=subprocess.run([str(x) for x in argv],cwd=trial,stdin=subprocess.DEVNULL,capture_output=True,timeout=8,creationflags=0x08000000)
 (trial/(label+'.stdout.txt')).write_bytes(result.stdout);(trial/(label+'.stderr.txt')).write_bytes(result.stderr)
 if expected==0:assert result.returncode==0,(label,result.stderr)
 else:assert result.returncode!=0 and b'Fresh current-round user authorization required' in result.stderr,(label,result.stderr)
 rows.append(dict(label=label,code=result.returncode,expectedDenial=expected!=0));return result.stdout
for f in trial.glob('*.mjs'):run('syntax-'+f.stem,['node','--check',f])
run('child-environment-fixtures',[pwsh,'-NoProfile','-NonInteractive','-File',trial/'offline-launch-check.ps1'])
for mode in ['environment','default','diagnostic','restored']:
 run('denied-launch-'+mode,[pwsh,'-NoProfile','-NonInteractive','-File',trial/'launch-diagnostic-trial.ps1','-Mode',mode],1)
run('denied-download-intent',[pwsh,'-NoProfile','-NonInteractive','-File',trial/'mark-download-intent.ps1'],1)
run('denied-launch-runner',['node',trial/'run-diagnostic-step.mjs','launchDefault'],1)
run('denied-download-collector',['node',trial/'collect-diagnostic-download.mjs','C:/Users/HP/Downloads/does-not-exist.json'],1)
run('denied-layout',['node',trial/'check-layout.cjs','before-install'],1)
env=dict(os.environ,AUTHOR_UI_RUNTIME=str(Path(config['candidateArchive']).parent/'unpacked'),AUTHOR_UI_BUILD=str(trial/'diagnostic-build.json'))
result=subprocess.run(['node','--test','--test-isolation=none','--test-reporter=tap','--test-concurrency=1','--test-timeout=3000',str(HERE/'trial-extras.test.mjs')],cwd=trial,env=env,capture_output=True,timeout=8,creationflags=0x08000000)
(trial/'download-auth-fixtures.stdout.txt').write_bytes(result.stdout);(trial/'download-auth-fixtures.stderr.txt').write_bytes(result.stderr)
assert result.returncode==0 and b'# tests 7' in result.stdout and b'# fail 0' in result.stdout,result.stderr
adapt=read(trial/'source-adaptation.json');sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest().upper()
assert all(sha(trial/n)==h for n,h in adapt['adaptedHashes'].items())
assert all(sha(p)==h for p,h in adapt['sourceHashes'].items())
assert all(sha(p)==h for p,h in read(trial/'protected-before.json').items())
assert not Path(config['backupRoot']).exists()
for name in ['authorization.json','diagnostic-environment-before.json','download-intent.json','diagnostic-export.json']:assert not (trial/name).exists()
report=dict(passed=True,commands=rows,newGuardDenials=8,downloadAuthorizationFixtureTests=7,childEnvironmentFixtureChecks=4,appStarted=False,liveAppQueried=False,realFileDownloaded=False)
(trial/'diagnostic-tool-preparation.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='commands'}))
