$ErrorActionPreference='Stop'
$before=[Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','Process')
$checks=0
foreach($value in @('0','1')){
 $info=[Diagnostics.ProcessStartInfo]::new();$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $info.Environment['WM_AUTHOR_DIAGNOSTICS']=$value
 if($info.Environment['WM_AUTHOR_DIAGNOSTICS'] -cne $value -or $info.UseShellExecute -or -not $info.CreateNoWindow){throw 'Invalid child-only environment'}
 if([Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','Process') -cne $before){throw 'Parent environment changed'}
 $checks++
}
$info=[Diagnostics.ProcessStartInfo]::new();[void]$info.Environment.Remove('WM_AUTHOR_DIAGNOSTICS')
if($info.Environment.ContainsKey('WM_AUTHOR_DIAGNOSTICS')){throw 'Child removal failed'};$checks++
$info.Environment['WM_AUTHOR_DIAGNOSTICS']='prior-synthetic-value'
if($info.Environment['WM_AUTHOR_DIAGNOSTICS'] -cne 'prior-synthetic-value'){throw 'Child original-value preservation failed'};$checks++
if([Environment]::GetEnvironmentVariable('WM_AUTHOR_DIAGNOSTICS','Process') -cne $before){throw 'Parent environment changed'}
@{passed=$true;checks=$checks;childLaunched=$false;persistentEnvironmentReadOrWritten=$false}|ConvertTo-Json
