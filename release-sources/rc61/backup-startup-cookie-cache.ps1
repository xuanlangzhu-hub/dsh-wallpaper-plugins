$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'closed-assert.ps1')
Assert-StepProof 'backup'
$source='C:\Users\HP\AppData\Roaming\@deepseek-ai\dsh-desktop\Network'
$dest=Join-Path $trialConfig.backupRoot 'startup-cookie-cache-before'
if(Test-Path -LiteralPath $dest){throw 'Cookie cache backup already exists'}
if((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse source refused'}
New-Item -ItemType Directory -Path $dest -ErrorAction Stop|Out-Null
$rows=@()
foreach($name in @('Cookies','Cookies-journal','Cookies-wal','Cookies-shm')){
 $file=Join-Path $source $name
 if(-not(Test-Path -LiteralPath $file)){continue}
 if((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse file refused'}
 $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
 $target=Join-Path $dest $name
 Copy-Item -LiteralPath $file -Destination $target -ErrorAction Stop
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -cne $hash){throw 'Cookie backup hash mismatch'}
 $rows+=@{file=$name;sha256=$hash;bytes=(Get-Item -LiteralPath $target).Length}
}
@{passed=$true;files=$rows;backupRoot=$dest;automaticallyRestored=$false;productionCookieWrites=$false}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'startup-cookie-cache-backup.json') -Encoding utf8
@{passed=$true;files=$rows.Count;productionCookieWrites=$false}|ConvertTo-Json
