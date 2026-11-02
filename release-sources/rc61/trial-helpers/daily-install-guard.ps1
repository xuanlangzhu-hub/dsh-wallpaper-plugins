# Pure intent check, separate from current-round exit/identity/backup gates.
function Assert-DailyInstallIntent($Authorization,$Config) {
 if($Authorization.keepInstalled -isnot [bool] -or $Authorization.keepInstalled -ne $true){throw 'Explicit keep-installed daily authorization required'}
 if($Config.keepCandidateInstalled -isnot [bool] -or $Config.keepCandidateInstalled -ne $true){throw 'Daily switch policy missing'}
 if($Authorization.purpose -cne $Config.purpose -or $Config.purpose -cne 'daily-rc61-basic-transparent'){throw 'Wrong daily switch purpose'}
}
