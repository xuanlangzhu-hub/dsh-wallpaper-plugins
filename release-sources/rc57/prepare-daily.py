"""Prepare a new daily round from pinned templates, without touching live state."""
from pathlib import Path
import argparse,hashlib,json,runpy,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
prior=ROOT/'.tmp/rc57-author-diagnostic-short-trial-20261029-b'
closed=read(prior/'closed-out.json');final=read(prior/'final-trial-verification.json')
assert closed==final and closed['passed'] and closed['dailyVersion']=='0.6.0-rc.56'
assert closed['userConfirmation']=='原外观和布局正常，播放停止' and closed['realDownloadAccepted']
assert closed['installedCandidateRetained'] is False and closed['longRunRootCauseConfirmed'] is False
candidate=ROOT/'.tmp/rc57-author-diagnostic-candidate-20261029-b';audit=read(candidate/'candidate-audit.json')
assert sha(candidate/audit['archive'])==audit['sha256']=='EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262'
assert all(sha(candidate/'unpacked'/row['file'])==row['sha256'] for row in read(candidate/'package-manifest.json')['files'])
parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'.tmp/rc57-daily-trial-20261029-a'));args=parser.parse_args()
trial=Path(args.output).resolve();assert trial.is_relative_to(ROOT/'.tmp') and not trial.exists()
sys.argv=[str(HERE/'prepare-trial.py'),'--output',str(trial),'--purpose','retain-rc57-daily']
runpy.run_path(str(HERE/'prepare-trial.py'),run_name='__main__')
c=read(trial/'trial-config.json');assert c['purpose']=='retain-rc57-daily' and c['profileWritesAuthorized'] is False
policy=dict(prepared=True,purpose=c['purpose'],trialRoot=str(trial),backupRoot=c['backupRoot'],candidateVersion=c['candidateVersion'],candidateSha256=c['candidateSha256'],rollbackVersion=c['dailyVersion'],retainAfterUserConfirmation=True,diagnosticsDefaultEnabled=False,enableDiagnosticLaunchInThisRound=False,repeatPlayback=False,repeatAuthorChanges=False,repeatExport=False,publicReleaseAuthorized=False,sourceShortTrialClosed=True,reuseOldAuthorization=False,productionBackupCreated=False,liveAppQueried=False,requiredStepOrder=['fresh normal-exit authorization','preflightRetry','readonlyDaily','backup','mediaBackup','verifyBeforeRetry','retain','layoutBefore','mediaVerifyBefore','install','verify','layoutAfter','runtime','environment','launchDefault','discoverDefault','snapshotDefault','observe original appearance and catalogue only','user confirmation','close out adoption'],recipeHashes={n:sha(HERE/n) for n in ['prepare-daily.py','prepare-trial.py','check-trial-extras.py']})
(trial/'daily-adoption-policy.json').write_text(json.dumps(policy,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in policy.items() if k not in ['recipeHashes','requiredStepOrder']}))
