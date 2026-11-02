# Pure protocol decoding. No requests, process inspection or production IO here.
function ConvertFrom-WhaleHostStatus([string]$Json) {
 if([string]::IsNullOrWhiteSpace($Json)){throw 'Empty Host status response'}
 $value=ConvertFrom-Json -InputObject $Json -AsHashtable -NoEnumerate -DateKind String -ErrorAction Stop
 if($value -isnot [System.Collections.IDictionary] -or -not $value.Contains('available') -or $value.available -isnot [bool]){throw 'Invalid Host status object'}
 if(-not $value.Contains('active') -or $value.active -isnot [bool] -or -not $value.Contains('session')){throw 'Host activity/session state is unknown'}
 foreach($key in @('active','failed')){if($value.Contains($key) -and $value[$key] -isnot [bool]){throw ('Invalid Host status flag: '+$key)}}
 if($value.Contains('session') -and $null -ne $value.session -and $value.session -isnot [System.Collections.IDictionary]){throw 'Invalid Host session object'}
 return $value
}
