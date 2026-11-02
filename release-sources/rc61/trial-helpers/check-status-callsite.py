"""Execute real discovery/snapshot scripts with synthetic CIM, process and HTTP IO."""
from pathlib import Path
import argparse, datetime, json, shutil, subprocess

ap=argparse.ArgumentParser();ap.add_argument('--trial',required=True);ap.add_argument('--output',required=True);ap.add_argument('--legacy',action='store_true');args=ap.parse_args()
trial=Path(args.trial).resolve();out=Path(args.output).resolve();assert not out.exists();out.mkdir()
pwsh='C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'
stub=r'''
function Get-CimInstance {
 [CmdletBinding()]param([string]$ClassName,[string]$Filter)
 if($Filter -like "Name='WallpaperProbe.exe'"){return}
 $desktop=[pscustomobject]@{Name='DeepSeek Harness.exe';ProcessId=101;ParentProcessId=99;CreationDate=[datetime]'2026-10-31T01:00:00Z'}
 $hostRow=[pscustomobject]@{Name='node.exe';ProcessId=102;ParentProcessId=101;CreationDate=[datetime]'2026-10-31T01:00:01Z'}
 if($Filter){if($Filter -eq 'ProcessId=102'){return $hostRow};throw 'Unapproved synthetic process query'}
 return @($desktop,$hostRow)
}
function Get-NetTCPConnection {
 [CmdletBinding()]param([string]$State)
 return [pscustomobject]@{OwningProcess=102;LocalPort=12345;LocalAddress='127.0.0.1'}
}
function Get-Process {
 [CmdletBinding()]param([int]$Id)
 if($Id -ne 100){throw 'Unapproved synthetic WE query'}
 return [pscustomobject]@{Id=100;StartTime=[datetime]'2026-10-31T00:00:00Z'}
}
function Invoke-RestMethod {
 [CmdletBinding()]param([string]$Uri,[string]$Method,[int]$TimeoutSec,[switch]$NoProxy)
 return $global:fixtureBody
}
function Invoke-WebRequest {
 [CmdletBinding()]param([string]$Uri,[string]$Method,[int]$TimeoutSec,[switch]$NoProxy)
 return [pscustomobject]@{Content=$global:fixtureBody}
}
$global:fixtureBody=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'response.json'))
'''
cases=[('json-text',{'available':True,'active':False,'session':None},True),
 ('case-distinct-keys',{'available':True,'active':False,'session':None,'metrics':{'Width':1280,'width':640}},True),
 ('invalid-json','{bad',False),('array-root',[],False),('null-root',None,False),
 ('missing-available',{},False),('string-available',{'available':'true'},False),
 ('missing-active',{'available':True,'session':None},False),('missing-session',{'available':True,'active':False},False),
 ('bad-active',{'available':True,'active':'false'},False),('bad-session',{'available':True,'session':[]},False)]
if args.legacy:cases=cases[:2]
rows=[]
for name,value,valid in cases:
 root=out/name;root.mkdir()
 for f in ['trial-gate.ps1','discover-default.ps1','snapshot-default.ps1','host-status-json.ps1']:
  if (trial/f).exists():shutil.copy2(trial/f,root/f)
 config={k:'synthetic-fixture' for k in ['purpose','candidateVersion','dailyVersion','candidateSha256','dailySha256']};config['trialRoot']=str(root)
 auth={**config,'confirmedNormallyExited':True,'sourceMessage':'OFFLINE SYNTHETIC FIXTURE ONLY','acceptedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 for f,v in [('trial-config.json',config),('authorization.json',auth),('closed-backup.json',{'wallpaper':[{'pid':100,'startTime':'2026-10-31T00:00:00Z'}]})]:
  (root/f).write_text(json.dumps(v),encoding='utf-8')
 (root/'response.json').write_text(value if name=='invalid-json' else json.dumps(value),encoding='utf-8')
 success=True;detail=''
 for phase in (['discovery','snapshot'] if valid else ['discovery']):
  script=root/(phase+'-fixture.ps1');script.write_text(stub+('\n& (Join-Path $PSScriptRoot \'discover-default.ps1\')' if phase=='discovery' else "\n& (Join-Path $PSScriptRoot 'snapshot-default.ps1') -Label 'fixture-stopped'"),encoding='utf-8')
  result=subprocess.run([pwsh,'-NoProfile','-NonInteractive','-File',str(script)],cwd=root,stdin=subprocess.DEVNULL,capture_output=True,timeout=6,creationflags=0x08000000)
  (root/(phase+'.stdout.txt')).write_bytes(result.stdout);(root/(phase+'.stderr.txt')).write_bytes(result.stderr)
  if (result.returncode==0)!=valid:
   success=False;detail=phase+' return code '+str(result.returncode)
   if args.legacy and phase=='discovery':
    captured=json.loads((root/'default-endpoint-discovery.json').read_text(encoding='utf-8-sig'))['responses'][0]['status']
    assert isinstance(captured,str) and json.loads(captured)['available'] is True, 'Fixture failed to deliver valid JSON text'
   break
  if not valid:
   data=json.loads((root/'default-endpoint-discovery.json').read_text(encoding='utf-8-sig'))
   assert all(x.get('status') is None for x in data['responses'])
  if phase=='snapshot' and valid:
   snapshot=json.loads((root/'fixture-stopped-status.json').read_text(encoding='utf-8-sig'));assert snapshot['active'] is False and snapshot['capture']==[]
   data=json.loads((root/'default-endpoint-discovery.json').read_text(encoding='utf-8-sig'));status=data['responses'][0]['status'];assert status['available'] is True
   if name=='case-distinct-keys':assert status['metrics']=={'Width':1280,'width':640}
 rows.append({'case':name,'passed':success,'detail':detail})
report={'passed':all(x['passed'] for x in rows),'cases':rows,'io':'synthetic process/CIM/HTTP stand-ins; actual PowerShell discovery/snapshot call sites','realAppsUsed':False,'productionWrites':False}
(out/'result.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));raise SystemExit(0 if report['passed'] else 1)
