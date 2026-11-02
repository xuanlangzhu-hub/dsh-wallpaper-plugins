param([Parameter(Mandatory)][ValidateSet('environment','default','diagnostic','restored')][string]$Mode)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'trial-gate.ps1')
Assert-TrialAuthorization
function Write-NewJson([string]$Name,$Value){
 $path=Join-Path $PSScriptRoot $Name
 $stream=[IO.FileStream]::new($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 10));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
}
function Read-FlagState {
 [ordered]@{process=[Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','Process');user=[Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','User');machine=[Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','Machine')}
}
if($Mode -eq 'environment'){
 Assert-StepProof 'backup'
 . (Join-Path $PSScriptRoot 'closed-assert.ps1')
 Write-NewJson 'diagnostic-environment-before.json' ([ordered]@{trialRoot=$trialConfig.trialRoot;capturedAtUtc=[datetimeoffset]::UtcNow.ToString('o');flag=Read-FlagState;onlyVariable='WM_AUTHOR_DIAGNOSTICS'})
 @{passed=$true;onlyVariable='WM_AUTHOR_DIAGNOSTICS';environmentChanged=$false}|ConvertTo-Json
 return
}
Assert-StepProof 'environment'
if($Mode -eq 'restored'){Assert-StepProof 'verifyRuntime';Assert-StepProof 'restoreLayout'}else{Assert-StepProof 'runtime';Assert-StepProof 'mediaVerifyBefore'}
if($Mode -eq 'diagnostic'){
 foreach($step in @('launchDefault','discoverDefault','snapshotDefault')){Assert-StepProof $step}
}
. (Join-Path $PSScriptRoot 'closed-assert.ps1')
$original=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'diagnostic-environment-before.json') -Raw|ConvertFrom-Json -DateKind String
if($original.trialRoot -cne $trialConfig.trialRoot -or $original.onlyVariable -cne 'WM_AUTHOR_DIAGNOSTICS'){throw 'Wrong environment evidence'}
$now=Read-FlagState
foreach($scope in @('process','user','machine')){if($now[$scope] -cne $original.flag.$scope){throw ('Diagnostic environment changed externally: '+$scope)}}
$receipt='launch-'+$Mode+'.json'
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $receipt)){throw 'Launch receipt already exists; inspect instead of relaunching'}
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=$trialConfig.desktopExe
$info.WorkingDirectory=[IO.Path]::GetDirectoryName($trialConfig.desktopExe)
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
if($Mode -eq 'restored'){
 if($null -eq $original.flag.process){[void]$info.Environment.Remove('WM_AUTHOR_DIAGNOSTICS')}else{$info.Environment['WM_AUTHOR_DIAGNOSTICS']=$original.flag.process}
}else{$info.Environment['WM_AUTHOR_DIAGNOSTICS']=if($Mode -eq 'diagnostic'){'1'}else{'0'}}
# Reserve a receipt BEFORE starting. Any failure/timeout leaves an unknown attempt,
# so a caller cannot mistake absent post-start evidence for permission to retry.
Write-NewJson $receipt ([ordered]@{trialRoot=$trialConfig.trialRoot;mode=$Mode;attemptedAtUtc=[datetimeoffset]::UtcNow.ToString('o');outcome='unknown-until-discovery';hostReady=$false;parentEnvironmentChanged=$false})
$app=[Diagnostics.Process]::Start($info)
try{
 if($null -eq $app){throw 'No launcher handle; outcome unknown'}
 $identity=@{launcherPid=$app.Id;mode=$Mode;hostReady=$false;launchOnly=$true;appKilled=$false;parentEnvironmentChanged=$false}
 Write-NewJson ('launch-'+$Mode+'-started.json') $identity
 $after=Read-FlagState
 foreach($scope in @('process','user','machine')){if($after[$scope] -cne $original.flag.$scope){throw 'Parent or persistent diagnostic environment unexpectedly changed'}}
 $identity|ConvertTo-Json
}finally{if($null -ne $app){$app.Dispose()}}
