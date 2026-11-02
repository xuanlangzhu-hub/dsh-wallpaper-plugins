"""Prepare a fresh daily-adoption round; no authorization or live application queries."""
from pathlib import Path
import ast,hashlib,json,os,re,shutil,subprocess,sys,time

here=Path(__file__).resolve().parent;root=here.parents[1]
old=root/'.tmp/rc54-taskbar-visual-short-trial-20261029-a'
candidate=root/'.tmp/rc56-taskbar-title-candidate-20261029-b'
trial=root/'.tmp/rc56-daily-trial-20261029-a'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
audit=read(candidate/'candidate-audit.json');assert sha(candidate/audit['archive'])==audit['sha256']
assert audit['version']=='0.6.0-rc.56'
pins=read(here/'trial-template-hashes.json');assert pins['sourceRoot']==str(old.relative_to(root))
assert len(pins['files'])==36 and all(sha(old/n)==h for n,h in pins['files'].items())
old_config=read(old/'trial-config.json');c=dict(old_config,trialRoot=str(trial),purpose='retain-rc56-daily',candidateVersion='0.6.0-rc.56',
 candidateArchive=str(candidate/audit['archive']),candidateSha256=audit['sha256'],backupRoot=str(Path(old_config['backupRoot']).parent/trial.name),profileWritesAuthorized=False)
assert c['dailyVersion']=='0.6.0-rc.53' and not trial.exists() and not Path(c['backupRoot']).exists()
mapping={str(old):str(trial),old.name:trial.name,old_config['purpose']:c['purpose'],old_config['backupRoot']:c['backupRoot'],
 old_config['candidateArchive']:c['candidateArchive'],old_config['candidateSha256']:c['candidateSha256'],'0.6.0-rc.54':'0.6.0-rc.56','rc.54':'rc.56','rc54':'rc56'}
for before,after in list(mapping.items()):
 if '\\' in before:
  mapping[before.replace('\\','/')]=after.replace('\\','/')
  mapping[before.replace('\\','\\\\')]=after.replace('\\','\\\\')
pattern=re.compile('|'.join(re.escape(x) for x in sorted(mapping,key=len,reverse=True)))
replace=lambda s:pattern.sub(lambda m:mapping[m[0]],s)
trial.mkdir();sources={};adapted={}
for name in pins['files']:
 new=replace(name);text=replace((old/name).read_text(encoding='utf-8'))
 if name=='run-step.cjs':
  assert text.count('const steps={')==1
  text=text.replace('const steps={',"const steps={collectEvidence:py('collect-stage-evidence.py',15000),")
 assert old.name not in text
 (trial/new).write_text(text,encoding='utf-8',newline='');sources[str(old/name)]=sha(old/name);adapted[new]=sha(trial/new)
collector=here/'collect-stage-evidence.py';shutil.copyfile(collector,trial/collector.name)
sources[str(collector)]=sha(collector);adapted[collector.name]=sha(trial/collector.name)
(trial/'trial-config.json').write_text(json.dumps(c,indent=2),encoding='utf-8')
(trial/'protected-before.json').write_bytes((old/'protected-before.json').read_bytes())
(trial/'source-adaptation.json').write_text(json.dumps({'sourceRoot':str(old),'sourceHashes':sources,'adaptedHashes':adapted,
 'copiedRuntimeEvidence':False,'authorizationCreated':False,'productionBackupCreated':False,
 'replacementScope':'new root/purpose/candidate version/archive/hash only; reviewed played binding retained; guarded collector added'},indent=2),encoding='utf-8')
checks=replace((old/'offline-trial-checks-recheck.py').read_text(encoding='utf-8'))
assert str(trial).replace('\\','\\\\') in checks
checks=checks.replace("['retain-before-install.py','retain-after-test.py']","['retain-before-install.py','retain-after-test.py','collect-stage-evidence.py']")
checks=checks.replace("'guardedEntries':19","'guardedEntries':20")
(trial/'offline-trial-checks.py').write_text(checks,encoding='utf-8')
for p in trial.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
deadline=time.monotonic()+90;commands=[]
for label,args,limit in [('archives',[sys.executable,'-X','utf8',trial/'make-archives.py'],10),
 ('trial-offline-checks',[sys.executable,'-X','utf8',trial/'offline-trial-checks.py'],58)]:
 child=subprocess.Popen([str(x) for x in args],cwd=trial,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000 if os.name=='nt' else 0)
 timeout=False
 try:data,error=child.communicate(timeout=min(limit,max(.1,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:
  timeout=True
  if child.poll() is None:
   if os.name=='nt':subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=4,creationflags=0x08000000)
   else:child.kill()
  data,error=child.communicate(timeout=5)
 (trial/(label+'.stdout.txt')).write_bytes(data);(trial/(label+'.stderr.txt')).write_bytes(error)
 commands.append({'label':label,'pid':child.pid,'code':child.returncode,'exitConfirmed':child.returncode is not None,'timedOut':timeout})
 (trial/'preparation-commands.json').write_text(json.dumps(commands,indent=2),encoding='utf-8')
 assert not timeout and child.returncode==0,(label,error.decode('utf-8',errors='replace'))
assert not Path(c['backupRoot']).exists()
for name in ['authorization.json','closed-backup.json','preflight.json','closed-out.json','evidence-collection.json']:assert not (trial/name).exists()
print(json.dumps({'trialRoot':str(trial),'templateFiles':36,'collectorAdded':True,'offlineChecksPassed':True,'realAuthorizationCreated':False,'productionBackupCreated':False,'liveApplicationQueries':0,'retainCandidateAfterUserConfirmation':True,'repeatManualPlaybackTest':False,'collectorFixturesReusedByFingerprint':True}))
