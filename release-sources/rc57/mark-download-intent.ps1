$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'trial-gate.ps1')
Assert-TrialAuthorization
Assert-StepProof 'launchDiagnostic'
$build=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'diagnostic-build.json') -Raw|ConvertFrom-Json
if($build.buildId -cnotmatch '^[a-f0-9]{64}$' -or $build.payloadVersion -cne $trialConfig.candidateVersion){throw 'Wrong diagnostic build'}
$value=[ordered]@{trialRoot=$trialConfig.trialRoot;buildId=$build.buildId;requestedAtUtc=[datetimeoffset]::UtcNow.ToString('o');sourceMessage='Authorized trial: assistant registers intent immediately before explicitly clicking export'}
$stream=[IO.FileStream]::new((Join-Path $PSScriptRoot 'download-intent.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
@{passed=$true;downloadClicked=$false;fileSaved=$false}|ConvertTo-Json
