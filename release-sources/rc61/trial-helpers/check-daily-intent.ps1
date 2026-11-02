param([Parameter(Mandatory)][string]$Guard)
$ErrorActionPreference='Stop'
. $Guard
$config=@{keepCandidateInstalled=$true;purpose='daily-rc61-basic-transparent'}
$good=@{keepInstalled=$true;purpose=$config.purpose}
Assert-DailyInstallIntent $good $config
$denials=0
foreach($value in @($null,$false,'true',1,@{},@($true))){
 $auth=@{keepInstalled=$value;purpose=$config.purpose};$rejected=$false
 try{Assert-DailyInstallIntent $auth $config}catch{$rejected=$true}
 if(-not $rejected){throw 'Invalid keep-installed flag accepted'};$denials++
}
foreach($case in @(@{auth=@{keepInstalled=$true;purpose='temporary-rc61-basic-transparent'};config=$config},@{auth=$good;config=@{keepCandidateInstalled=$false;purpose=$config.purpose}})){
 $rejected=$false;try{Assert-DailyInstallIntent $case.auth $case.config}catch{$rejected=$true}
 if(-not $rejected){throw 'Foreign policy accepted'};$denials++
}
@{passed=$true;validIntentChecks=1;denials=$denials;realAppsUsed=$false;productionWrites=$false}|ConvertTo-Json
