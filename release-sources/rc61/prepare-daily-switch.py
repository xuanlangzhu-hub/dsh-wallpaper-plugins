"""Prepare a fresh rc.61 daily switch; no authorization, live IO or installation."""
from pathlib import Path
import argparse, ast, hashlib, importlib.util, json, re, shutil, subprocess, sys, time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
HELPERS=HERE/'trial-helpers'
spec=importlib.util.spec_from_file_location('trial_repairs',HELPERS/'repair-templates.py');repairs=importlib.util.module_from_spec(spec);spec.loader.exec_module(repairs)
read=lambda p:json.loads(p.read_bytes())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
trial=Path(args.output).resolve();assert trial.is_relative_to(ROOT/'.tmp') and not trial.exists()
pins=read(HERE/'trial-template-hashes.json');old=Path(pins['sourceRoot']);assert len(pins['files'])==45 and all(sha(old/n)==h for n,h in pins['files'].items())
candidate=ROOT/'.tmp/rc61-basic-transparent-candidate-20261031-b';audit=read(candidate/'candidate-audit.json');proof=read(ROOT/'.tmp/rc61-basic-transparent-package-check-20261031-a/result.json')
assert proof['passed'] and proof['archiveSha256']==audit['sha256']==sha(candidate/audit['archive']) and proof['totalBehaviorChecks']==152
original=read(old/'trial-config.json');daily=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz'
daily_sha='EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262';assert sha(daily)==daily_sha
config=dict(original,trialRoot=str(trial),purpose='daily-rc61-basic-transparent',keepCandidateInstalled=True,candidateVersion='0.6.0-rc.61',dailyVersion='0.6.0-rc.57',candidateArchive=str(candidate/audit['archive']),candidateSha256=audit['sha256'],dailyArchive=str(daily),dailySha256=daily_sha,backupRoot=str(Path(original['backupRoot']).parent/trial.name),profileWritesAuthorized=False)
assert not Path(config['backupRoot']).exists()
mapping={str(old):str(trial),old.name:trial.name,original['purpose']:config['purpose'],original['backupRoot']:config['backupRoot']}
for key in ['candidateArchive','candidateSha256','dailyArchive','dailySha256']:mapping[original[key]]=config[key]
mapping.update({'0.6.0-rc.57':'0.6.0-rc.61','rc.57':'rc.61','rc57':'rc61','0.6.0-rc.56':'0.6.0-rc.57','rc.56':'rc.57','rc56':'rc57'})
for before,after in list(mapping.items()):
    if '\\' in before:
        mapping[before.replace('\\','/')]=after.replace('\\','/');mapping[before.replace('\\','\\\\')]=after.replace('\\','\\\\')
pattern=re.compile('|'.join(re.escape(x) for x in sorted(mapping,key=len,reverse=True)))
replace=lambda s:pattern.sub(lambda m:mapping[m[0]],s)
trial.mkdir();sources={};adapted={}
for name in pins['files']:
    new_name=replace(name);text=replace((old/name).read_text(encoding='utf-8'))
    if name=='make-archives.py':
        assert text.count("assert len(files)==(43 if kind=='daily' else 47)")==1
        text=text.replace("assert len(files)==(43 if kind=='daily' else 47)",'assert len(files)==47').replace("'dailyFiles':43","'dailyFiles':47")
    if name=='launch-diagnostic-trial.ps1':
        needle='Assert-TrialAuthorization\n';assert text.count(needle)==1
        text=text.replace(needle,needle+"if($Mode -eq 'diagnostic'){throw 'Diagnostic launch is outside this UI trial'}\n")
    if name=='run-step.cjs':
        assert text.count('const steps={')==1
        text=text.replace('const steps={',"const steps={startupCookieBackup:ps('backup-startup-cookie-cache.ps1',15000),")
    text=repairs.repair(new_name,text)
    if new_name=='install.ps1':
        anchor='Assert-TrialAuthorization\n';assert text.count(anchor)==1
        text=text.replace(anchor,anchor+". (Join-Path $PSScriptRoot 'daily-install-guard.ps1')\n$dailyAuthorization=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'authorization.json') -Raw|ConvertFrom-Json -AsHashtable -DateKind String\nAssert-DailyInstallIntent $dailyAuthorization $trialConfig\n",1)
    assert old.name not in text
    (trial/new_name).write_text(text,encoding='utf-8',newline='');sources[str(old/name)]=sha(old/name);adapted[new_name]=sha(trial/new_name)
(trial/'trial-config.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
shutil.copy2(HERE/'run-launch.cjs',trial/'run-launch.cjs')
sources[str(HERE/'run-launch.cjs')]=sha(HERE/'run-launch.cjs');adapted['run-launch.cjs']=sha(trial/'run-launch.cjs')
for name in ['host-status-json.ps1','step-map.cjs','daily-install-guard.ps1']:
    shutil.copy2(HELPERS/name,trial/name);sources[str(HELPERS/name)]=sha(HELPERS/name);adapted[name]=sha(trial/name)
protected=read(HERE/'integration-inputs.json')['protectedInputs']
assert all(sha(ROOT/n)==h for n,h in protected.items())
(trial/'protected-before.json').write_text(json.dumps({str(ROOT/n):h for n,h in protected.items()},indent=2),encoding='utf-8')
for source,dest in [('build.json','diagnostic-build.json'),('package-manifest.json','candidate-manifest.json')]:shutil.copyfile(candidate/source,trial/dest)
sources[str(old/'offline-trial-checks.py')]=sha(old/'offline-trial-checks.py')
cookie=HERE/'backup-startup-cookie-cache.ps1';shutil.copy2(cookie,trial/cookie.name);sources[str(cookie)]=sha(cookie);adapted[cookie.name]=sha(trial/cookie.name)
(trial/'source-adaptation.json').write_text(json.dumps(dict(sourceRoot=str(old),sourceHashes=sources,adaptedHashes=adapted,copiedRuntimeEvidence=False,authorizationCreated=False,productionBackupCreated=False,extraChanges=['daily and candidate both 47 files','all copied launch/auth/cleanup guards retained','diagnostic launch explicitly excluded','fresh config profileWritesAuthorized false','raw response JSON strictly decoded to case-preserving Hashtable','duplicate step initializer rejected before spawn','backup purpose and file count derived from current configuration and archive']),indent=2),encoding='utf-8')
checks=replace((old/'offline-trial-checks.py').read_text(encoding='utf-8'))
assert checks.count('entries=[')==1
checks=checks.replace('entries=[',"entries=[('backup-startup-cookie-cache.ps1',[]),").replace("'guardedEntries':23","'guardedEntries':24")
(trial/'offline-trial-checks.py').write_text(checks,encoding='utf-8')
policy=dict(purpose=config['purpose'],candidateVersion=config['candidateVersion'],defaultRollback=config['dailyVersion'],diagnosticsDefaultEnabled=False,diagnosticLaunchAllowed=False,publicReleaseAuthorized=False,installationAuthorized=False,newNormalExitConfirmationRequired=True,defaultRestoreSettingsAndLayout=False,keepCandidateInstalled=True,futureRollbackRequiresFreshStateAndAuthorization=True,automaticCookieCleanup=False,automaticCookieRestore=False,sourceTemplates=45,startupCookieBackupToolAdded=True,productionBackupCreated=False,liveAppQueried=False,launchRunner='run-launch.cjs (direct log descriptors; helper-only timeout)',requiredStepOrder=['fresh normal-exit and explicit keepInstalled authorization','preflight and verify original rc57','new closed backup and media/layout retention','copy startup Cookie cache without cleanup or restore','install rc61 and verify 47 files','launch default with child-only diagnostic flag 0','bind a fresh returned DSH window and activate it before input; stop original autoplay immediately if it starts, without changing the preference','only after stopping: discover current Host, then check original appearance, layout and gallery without manual playback','confirm stopped and capture zero, original WE identity and unchanged runtime','preserve rc61 as daily only after user confirmation','close round; any future rollback needs fresh authorization and retention of then-current data'])
(trial/'ui-trial-policy.json').write_text(json.dumps(policy,indent=2),encoding='utf-8')
for f in trial.glob('*.py'):ast.parse(f.read_text(encoding='utf-8'))
deadline=time.monotonic()+90;commands=[]
for label,argv,limit in [('archives',[sys.executable,'-X','utf8',trial/'make-archives.py'],10),('base-tool-checks',[sys.executable,'-X','utf8',trial/'offline-trial-checks.py'],60),('extra-guard-checks',[sys.executable,'-X','utf8',HERE.parent/'rc57/check-trial-extras.py',trial],15)]:
    child=subprocess.Popen([str(x) for x in argv],cwd=trial,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
    try:data,error=child.communicate(timeout=min(limit,max(.1,deadline-time.monotonic())))
    except subprocess.TimeoutExpired:timed=True;child.kill();data,error=child.communicate(timeout=3)
    commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed))
    (trial/'preparation-commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(trial/(label+'.stdout.txt')).write_bytes(data);(trial/(label+'.stderr.txt')).write_bytes(error)
    assert not timed and child.returncode==0,(label,error.decode('utf-8',errors='replace'))
assert not Path(config['backupRoot']).exists()
for name in ['authorization.json','closed-backup.json','closed-out.json','preflight.json','diagnostic-environment-before.json','download-intent.json','diagnostic-export.json']:assert not (trial/name).exists(),name
assert read(trial/'trial-config.json')['profileWritesAuthorized'] is False
print(json.dumps(dict(trialRoot=str(trial),candidateFiles=47,dailyFiles=47,checksPassed=True,authorizationCreated=False,productionBackupCreated=False,liveAppsUsed=False,diagnosticLaunchAllowed=False)))
