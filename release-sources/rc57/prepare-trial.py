"""Derive guarded, unauthorized rc.57 tools. No installed/profile/app inspection."""
from pathlib import Path
import argparse, ast, hashlib, json, re, shutil, subprocess, sys, time
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--purpose',choices=['temporary-rc57-author-diagnostics','retain-rc57-daily'],default='temporary-rc57-author-diagnostics');args=p.parse_args()
trial=Path(args.output).resolve();assert trial.is_relative_to(ROOT/'.tmp') and not trial.exists()
old=ROOT/'.tmp/rc54-taskbar-visual-short-trial-20261029-a';candidate=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b'
pins=read(HERE.parent/'rc56/trial-template-hashes.json');assert len(pins['files'])==36 and all(sha(old/n)==h for n,h in pins['files'].items())
audit=read(candidate/'candidate-audit.json');assert sha(candidate/audit['archive'])==audit['sha256']
proof=read(ROOT/'.tmp/rc57-author-diagnostic-package-check-20261029-b/result.json');assert proof['passed'] and proof['archiveSha256']==audit['sha256'] and proof['totalBehaviorChecks']==146
old_config=read(old/'trial-config.json');c=dict(old_config,trialRoot=str(trial),purpose=args.purpose,candidateVersion='0.6.0-rc.57',dailyVersion='0.6.0-rc.56',candidateArchive=str(candidate/audit['archive']),candidateSha256=audit['sha256'],dailyArchive=str(ROOT/'.tmp/rc56-taskbar-title-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.56.tgz'),dailySha256='85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160',backupRoot=str(Path(old_config['backupRoot']).parent/trial.name),profileWritesAuthorized=False,downloadsRoot='C:\\Users\\HP\\Downloads')
assert not Path(c['backupRoot']).exists()
mapping={str(old):str(trial),old.name:trial.name,old_config['purpose']:c['purpose'],old_config['backupRoot']:c['backupRoot']}
for key in ['candidateArchive','candidateSha256','dailyArchive','dailySha256']:mapping[old_config[key]]=c[key]
mapping.update({'0.6.0-rc.54':'0.6.0-rc.57','rc.54':'rc.57','rc54':'rc57','0.6.0-rc.53':'0.6.0-rc.56','rc.53':'rc.56','rc53':'rc56'})
for before,after in list(mapping.items()):
 if '\\' in before:
  mapping[before.replace('\\','/')]=after.replace('\\','/');mapping[before.replace('\\','\\\\')]=after.replace('\\','\\\\')
pattern=re.compile('|'.join(re.escape(x) for x in sorted(mapping,key=len,reverse=True)))
replace=lambda s:pattern.sub(lambda m:mapping[m[0]],s)
trial.mkdir();sources={};adapted={}
for name in pins['files']:
 new=replace(name);text=replace((old/name).read_text(encoding='utf-8'))
 if name=='make-archives.py':
  assert text.count('assert len(files)==43')==1
  text=text.replace('assert len(files)==43',"assert len(files)==(43 if kind=='daily' else 47)").replace("'candidateFiles':43","'candidateFiles':47")
 if name in ['verify.py','verify-installed-readonly.py']:
  text='from trial_guard import require_authorization\nrequire_authorization()\n'+text
 if name=='check-layout.cjs':
  text="(async()=>{await import('./diagnostic-tool-guard.mjs').then(m=>m.requireAuthorization(__dirname));\n"+text+"\n})().catch(e=>{console.error(e.message);process.exitCode=1;});\n"
 if name=='run-step.cjs':
  assert text.count('const steps={')==1
  text=text.replace('const steps={',"const steps={discoverDefault:ps('discover-default.ps1',45000),snapshotDefault:ps('snapshot-default.ps1',20000,'-Label','default-stopped'),")
 assert old.name not in text
 (trial/new).write_text(text,encoding='utf-8',newline='');sources[str(old/name)]=sha(old/name);adapted[new]=sha(trial/new)
extra=['launch-diagnostic-trial.ps1','diagnostic-tool-guard.mjs','run-diagnostic-step.mjs','validate-download.mjs','collect-diagnostic-download.mjs','mark-download-intent.ps1','offline-launch-check.ps1']
for name in extra:
 shutil.copyfile(HERE/name,trial/name);sources[str(HERE/name)]=sha(HERE/name);adapted[name]=sha(trial/name)
for source,dest in [('discover-live.ps1','discover-default.ps1'),('snapshot-live.ps1','snapshot-default.ps1')]:
 text=(trial/source).read_text(encoding='utf-8').replace('live-endpoint-discovery.json','default-endpoint-discovery.json')
 (trial/dest).write_text(text,encoding='utf-8');adapted[dest]=sha(trial/dest)
(trial/'trial-config.json').write_text(json.dumps(c,indent=2),encoding='utf-8')
(trial/'protected-before.json').write_bytes((old/'protected-before.json').read_bytes())
for source,dest in [('build.json','diagnostic-build.json'),('package-manifest.json','candidate-manifest.json')]:shutil.copyfile(candidate/source,trial/dest)
(trial/'source-adaptation.json').write_text(json.dumps(dict(sourceRoot=str(old),sourceHashes=sources,adaptedHashes=adapted,copiedRuntimeEvidence=False,authorizationCreated=False,productionBackupCreated=False,extraChanges=['candidate archive count 47 vs daily 43','authorization before verify/Profile reads','guarded child-only diagnostic launch and explicit download collector']),indent=2),encoding='utf-8')
checks=replace((old/'offline-trial-checks-recheck.py').read_text(encoding='utf-8'))
checks=checks.replace("['retain-before-install.py','retain-after-test.py']","['retain-before-install.py','retain-after-test.py','verify.py','verify-installed-readonly.py']")
checks=checks.replace("('discover-live.ps1',[])","('discover-live.ps1',[]),('discover-default.ps1',[]),('snapshot-default.ps1',['-Label','offline-denied'])")
checks=checks.replace("'guardedEntries':19","'guardedEntries':23")
(trial/'offline-trial-checks.py').write_text(checks,encoding='utf-8')
for f in trial.glob('*.py'):ast.parse(f.read_text(encoding='utf-8'))
deadline=time.monotonic()+90;commands=[]
for label,argv,limit in [('archives',[sys.executable,'-X','utf8',trial/'make-archives.py'],10),('base-tool-checks',[sys.executable,'-X','utf8',trial/'offline-trial-checks.py'],60),('diagnostic-tool-checks',[sys.executable,'-X','utf8',HERE/'check-trial-extras.py',str(trial)],15)]:
 child=subprocess.Popen([str(x) for x in argv],cwd=trial,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000);timed=False
 try:data,error=child.communicate(timeout=min(limit,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:
  timed=True;child.kill();data,error=child.communicate(timeout=3)
 commands.append(dict(label=label,pid=child.pid,code=child.returncode,exitConfirmed=child.returncode is not None,timedOut=timed))
 (trial/'preparation-commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8');(trial/(label+'.stdout.txt')).write_bytes(data);(trial/(label+'.stderr.txt')).write_bytes(error)
 assert not timed and child.returncode==0,(label,error.decode('utf-8',errors='replace'))
assert not Path(c['backupRoot']).exists()
for name in ['authorization.json','closed-backup.json','closed-out.json','preflight.json','diagnostic-environment-before.json','download-intent.json','diagnostic-export.json']:assert not (trial/name).exists(),name
print(json.dumps(dict(trialRoot=str(trial),templates=36,newTools=7,additionalPhaseScripts=2,checksPassed=True,authorizationCreated=False,productionBackupCreated=False,liveAppsUsed=False)))
