# Offline PowerShell Date Serialization Contract
# Demonstrates why raw DateTime objects in PowerShell 5.1 lose precision under ConvertTo-Json,
# and how explicit .ToString('o') preserves full 7-digit round-trip ISO precision identical to .NET C#.
# Strictly offline: no process queries, no application actions.

$fixtureDate = [DateTime]::Parse('2026-10-17T09:20:20.6092543Z', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)

# 1. Raw DateTime object: PowerShell 5.1 JavaScriptSerializer outputs \/Date(ms)\/
$rawObject = [pscustomobject]@{
    ProcessId = 1122
    CreationDate = $fixtureDate
    ShellVersion = $PSVersionTable.PSVersion.ToString()
}
$rawJson = $rawObject | ConvertTo-Json -Compress

# 2. Explicit .ToString('o') string: ConvertTo-Json outputs full 7-digit ISO string
$exactObject = [pscustomobject]@{
    ProcessId = 1122
    CreationDate = $fixtureDate.ToString('o')
    ShellVersion = $PSVersionTable.PSVersion.ToString()
}
$exactJson = $exactObject | ConvertTo-Json -Compress

[pscustomobject]@{
    FixtureExact = $fixtureDate.ToString('o')
    RawJson = $rawJson
    ExactJson = $exactJson
    RawDegradesToDateMs = ($rawJson -like '*Date(*')
    ExactPreservesIso = ($exactJson -like '*2026-10-17T09:20:20.6092543Z*')
} | ConvertTo-Json -Compress
