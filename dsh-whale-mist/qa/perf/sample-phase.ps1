# Phase sampler for the source-performance comparison.
#
# READ-ONLY with respect to the system: it starts no process, stops nothing, changes no setting, and
# writes only its own JSON, created with CreateNew so a concurrent run cannot overwrite it.
#
# What a caller must supply: an explicit list of target PIDs (or names). The sampler never follows
# "every process with this name" by itself, and its periodic re-discovery only refreshes counter paths
# for the declared targets; a new Node or renderer process is a new target the caller has to name.
#
# Cost note, measured on this machine: a wildcard query over the whole GPU Engine set (1079 instances)
# costs 8.5-15.5 s, while restricting the instance name to one PID costs about 1.6 s. Discovery
# therefore queries `pid_<id>_*` per target, resolves the exact instance paths from the returned
# samples, and caches them; the cache is refreshed every -RediscoverEvery samples. Each Get-Counter
# sample also waits for the provider's own one-second interval, so -Seconds 45 yields roughly 15-25
# samples, not 45.
#
# Correctness rules this file follows, each of them a bug found in review:
#
#   CPU          The previous reading is captured before it is replaced, a missing reading stays null
#                with a reason (never 0), and a gap in the readings does not produce a delta spanning it.
#   PID          Instance names are matched as `pid_<id>_*`, never `pid_<id>*`, so PID 42 cannot pick
#                up 420; reads re-verify the instance's PID against the target set.
#   Identity     A target is re-checked against its start time each sample; a reused PID is reported and
#                the phase is marked, not measured as the old target.
#   GPU memory   Each of the four counters starts as null. A counter that is invalid or missing stays
#                null, and the other counters of the same instance are still reported.
#   PDH status   VALID_DATA (0) and NEW_DATA (1) are usable; other statuses stay invalid.
#   Health       Availability and activity are separate. All-zero readings from readable counters are an
#                idle measurement, not a failure; a phase with no readable readings at all is.
#   Summary      Adapter topology changes invalidate the phase or split it into segments with explicit
#                coverage; averages use the total delta over the total time, not an average of averages.
#
# Testing: set WM_PERF_FIXTURE to a JSON file that supplies the counter samples instead of the real
# provider (see qa/perf/check-sampler.mjs for the synthetic cases). The fixture path is only read, never
# written, and the switch exists so the failure modes above can be reproduced without touching the machine.
param(
  [Parameter(Mandatory)][string]$Phase,
  [Parameter(Mandatory)][string]$Output,
  [int]$Seconds = 45,
  [int]$IntervalMs = 1000,
  [int[]]$ProcessIds = @(),
  [string[]]$NameFilter = @(),
  [int]$RediscoverEvery = 12,
  [string]$Label = ''
)
$ErrorActionPreference = 'Stop'

if ($Seconds -lt 1) { throw "-Seconds must be at least 1, got $Seconds" }
if ($IntervalMs -lt 0) { throw "-IntervalMs cannot be negative, got $IntervalMs" }
if ($RediscoverEvery -lt 1) { throw "-RediscoverEvery must be at least 1, got $RediscoverEvery" }
if ($ProcessIds.Count -eq 0 -and $NameFilter.Count -eq 0) { throw "Give -ProcessIds or -NameFilter; an unnamed phase cannot be interpreted later." }

$fixturePath = $env:WM_PERF_FIXTURE
$fixture = $null
if ($fixturePath) {
  if (-not (Test-Path -LiteralPath $fixturePath)) { throw "WM_PERF_FIXTURE not found: $fixturePath" }
  $fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
  Write-Host "  fixture mode: counter providers replaced by $fixturePath; the real provider is not queried"
}

# --- success criteria -----------------------------------------------------------------------------
# Microsoft PDH defines both VALID_DATA and NEW_DATA as successful values.
$PDH_VALID_DATA = 0
$PDH_NEW_DATA = 1
function Test-PdhUsable([long]$status) { return ($status -band 0xffffffffL) -in 0,1 }
function Get-PdhStatusName([long]$status) {
  switch ($status -band 0xffffffffL) {
    0 { return 'VALID_DATA' }
    1 { return 'NEW_DATA' }
    0x800007d5L { return 'NO_DATA' }
    0xc0000bbaL { return 'INVALID_DATA' }
    0x800007d1L { return 'NO_INSTANCE' }
    default { return "STATUS_$status" }
  }
}

$logicalProcessors = if ($fixture) { [int]$fixture.logicalProcessors } else { (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors }
$sockets = if ($fixture) { 1 } else { (Get-CimInstance Win32_ComputerSystem).NumberOfProcessors }
$physicalCores = if ($fixture) { $fixture.physicalCores } else { @(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum }
if ($logicalProcessors -lt 1) { throw 'Logical processor count must be positive' }
$fixtureFrame = $null
$fixtureEpoch = if ($fixture) { [datetime]'2026-10-09T00:00:00Z' } else { $null }

$targets = @()
if ($fixture) {
  $targets = @($fixture.targets | Where-Object { ($ProcessIds -contains $_.pid -or $NameFilter -contains $_.name) -and $_.alive -ne $false } | ForEach-Object { [pscustomobject]@{Id=[int]$_.pid;ProcessName=$_.name} })
} elseif ($ProcessIds.Count -gt 0) {
  $targets = @(Get-Process -Id $ProcessIds -ErrorAction SilentlyContinue)
} elseif ($NameFilter.Count -gt 0) {
  $targets = @(Get-Process | Where-Object { $base = $_.ProcessName; $NameFilter -contains $base })
}
if ($targets.Count -eq 0) { throw "No process matched. An empty phase cannot be interpreted later." }

function Get-ElapsedMs([datetime]$From) { return [math]::Round(([datetime]::Now - $From).TotalMilliseconds) }

# Reads a process identity and CPU reading. A missing value stays null with a reason.
function Read-ProcessState([int]$pidValue) {
  $result = @{ ok = $false; reason = $null; name = $null; startTime = $null; path = $null; cpuSeconds = $null; workingSetBytes = $null; privateBytes = $null; threads = $null; handles = $null }
  if ($fixture) {
    $states = if ($fixtureFrame) { $fixtureFrame.processes } else { $fixture.targets }
    $state = @($states | Where-Object {$_.pid -eq $pidValue}) | Select-Object -First 1
    if (-not $state -or $state.alive -eq $false) { $result.reason='not running'; return $result }
    $result.ok=$true
    foreach ($key in @('name','startTime','path','cpuSeconds','workingSetBytes','privateBytes','threads','handles')) { $result[$key]=$state.$key }
    if ($null -eq $result.cpuSeconds) { $result.reason='CPU unavailable' }
    return $result
  }
  try { $process = Get-Process -Id $pidValue -ErrorAction Stop } catch { $result.reason = "not running"; return $result }
  $result.name = $process.ProcessName
  try { $result.startTime = $process.StartTime.ToString('o') } catch { $result.reason = 'start time unreadable' }
  try { $result.path = (Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction Stop).ExecutablePath } catch {}
  try {
    $cpu = $process.TotalProcessorTime
    if ($null -eq $cpu) { $result.reason = 'TotalProcessorTime unreadable (protected process)' }
    else { $result.cpuSeconds = [double]$cpu.TotalSeconds }
  } catch { $result.reason = 'TotalProcessorTime threw' }
  try { $result.workingSetBytes = [long]$process.WorkingSet64 } catch {}
  try { $result.privateBytes = [long]$process.PrivateMemorySize64 } catch {}
  try { $result.threads = $process.Threads.Count } catch {}
  try { $result.handles = $process.HandleCount } catch {}
  $result.ok = $true
  return $result
}

# --- counter providers (real, or replaced by a fixture for the synthetic regression) --------------

function Invoke-RealCounter([string[]]$Paths) {
  if ($Paths.Count -eq 0) { return @{ok=$true;entries=@();error=$null} }
  try {
    $providerErrors=@()
    $samples = @((Get-Counter -Counter $Paths -MaxSamples 1 -ErrorAction SilentlyContinue -ErrorVariable +providerErrors).CounterSamples)
    $entries = @($samples | ForEach-Object {
      @{
        instanceName = $_.InstanceName
        path = $_.Path
        value = if ($null -ne $_.CookedValue) { [double]$_.CookedValue } else { $null }
        status = [long]$_.Status
        providerTimestamp = if ($_.Timestamp) { $_.Timestamp.ToString('o') } else { $null }
      }
    })
    return @{ ok = ($entries.Count -gt 0); entries = $entries; error = (@($providerErrors | ForEach-Object {$_.Exception.Message}) -join '; ') }
  } catch {
    return @{ ok = $false; entries = @(); error = $_.Exception.Message }
  }
}

function Invoke-FixtureCounter([string[]]$Paths) {
  # A fixture is a list of samples; a sample may be marked unavailable to stand in for a provider error,
  # and each entry may carry a status to stand in for an invalid PDH reading.
  $frame = if ($fixtureFrame) { $fixtureFrame } else { $fixture.frames[0] }
  if ($frame.counterUnavailable -or ($frame.adapterUnavailable -and ($Paths -join '|') -match 'GPU Adapter Memory')) { return @{ ok=$false; entries=@(); error='fixture: provider unavailable' } }
  $entries = @()
  foreach ($sample in @($frame.samples)) {
    if (-not $sample.path) { continue }
    if (-not @($Paths | Where-Object {$sample.path -like $_}).Count -and -not $frame.injectForeign) { continue }
    $entries += @{
      instanceName = $sample.instanceName
      path = $sample.path
      value = $sample.value
      status = if ($null -ne $sample.status) { [long]$sample.status } else { 0 }
      providerTimestamp = $sample.providerTimestamp
    }
  }
  return @{ ok = $true; entries = $entries; error = $frame.counterError }
}

function Invoke-Counter([string[]]$Paths) {
  if ($fixture) { return Invoke-FixtureCounter -Paths $Paths }
  return Invoke-RealCounter -Paths $Paths
}

<#
Discovery. The instance name is matched with the PID as a terminal segment (`pid_<id>_*`), so PID 42
cannot match 420, and the exact paths that came back are cached rather than the wildcard being reused.
The PID in each instance name is checked against the target set again here: anything else is dropped and
counted, so a synthetic provider cannot smuggle a foreign process into the results.
#>
function Resolve-Paths([int[]]$pids) {
  $queryPaths = [Collections.Generic.List[string]]::new()
  foreach ($pidValue in $pids) {
    $queryPaths.Add("\GPU Engine(pid_${pidValue}_*)\Utilization Percentage")
    $queryPaths.Add("\GPU Process Memory(pid_${pidValue}_*)\Dedicated Usage")
    $queryPaths.Add("\GPU Process Memory(pid_${pidValue}_*)\Shared Usage")
    $queryPaths.Add("\GPU Process Memory(pid_${pidValue}_*)\Non Local Usage")
    $queryPaths.Add("\GPU Process Memory(pid_${pidValue}_*)\Total Committed")
  }
  $queryPaths = $queryPaths.ToArray()
  $response = Invoke-Counter -Paths $queryPaths
  $resolved = [Collections.Generic.List[string]]::new()
  $foreign = [Collections.Generic.List[string]]::new()
  $invalid = 0
  if ($response.ok) {
    foreach ($entry in $response.entries) {
      if ($entry.instanceName -notmatch '^pid_(\d+)_') { continue }
      $instancePid = [int]$Matches[1]
      if ($pids -notcontains $instancePid) { $foreign.Add($entry.instanceName); continue }
      if (-not (Test-PdhUsable $entry.status)) { $invalid += 1 }
      if (-not $resolved.Contains($entry.path)) { $resolved.Add($entry.path) }
    }
  }
  return @{
    queryPaths = $queryPaths
    resolvedPaths = $resolved
    foreignInstances = $foreign
    invalidAtDiscovery = $invalid
    ok = $response.ok
    error = $response.error
  }
}

function Get-AdapterSnapshot {
  $response = Invoke-Counter -Paths @('\GPU Adapter Memory(*)\Dedicated Usage')
  if (-not $response.ok) { return @{ ok = $false; entries = @(); error = $response.error } }
  $entries = @()
  $complete = -not $response.error
  foreach ($entry in $response.entries) {
    if ($entry.path -notmatch '\\GPU Adapter Memory\(') { continue }
    if (-not (Test-PdhUsable $entry.status) -or $null -eq $entry.value -or -not [double]::IsFinite([double]$entry.value)) { $complete=$false; continue }
    if ($entry.instanceName -notmatch '(luid_0x[0-9a-f]+_0x[0-9a-f]+)') { $complete=$false; continue }
    $entries += @{
      instance = $entry.instanceName
      luid = if ($entry.instanceName -match '(luid_0x[0-9a-f]+_0x[0-9a-f]+)') { $Matches[1] } else { $null }
      dedicatedUsageBytes = $entry.value
    }
  }
  return @{ ok = $complete; entries = $entries; error = $(if($response.error){$response.error}elseif(-not $complete){'adapter snapshot incomplete'}else{$null}) }
}

<#
One sample over the cached exact paths. Each of the four memory counters is initialised to null: a
counter that is invalid or absent stays null and the others are still reported, so an unknown value is
never written as a real zero. Engine readings keep every instance so an aggregate can be recomputed.
#>
function Read-Fixed([string[]]$paths, [int[]]$pids) {
  $response = Invoke-Counter -Paths $paths
  if (-not $response.ok) { return @{ ok = $false; error = $response.error; engine = @(); memory = @(); accepted = @(); invalid = 0; foreign = @(); rejected = @() } }
  $engine = @{}
  $memory = @{}
  $invalid = 0
  $foreign = @()
  $rejected = @()
  $accepted = @()
  foreach ($entry in $response.entries) {
    if ($entry.instanceName -notmatch '^pid_(\d+)_') { continue }
    $instancePid = [int]$Matches[1]
    if ($pids -notcontains $instancePid) { $foreign += $entry.instanceName; continue }
    if (-not (Test-PdhUsable $entry.status) -or $null -eq $entry.value -or -not [double]::IsFinite([double]$entry.value)) {
      $invalid += 1
      $rejected += @{ instanceName = $entry.instanceName; path = $entry.path; status = $entry.status; statusName = (Get-PdhStatusName $entry.status); reason = $(if(Test-PdhUsable $entry.status){'missing/non-finite value'}else{'invalid status'}) }
      continue
    }
    $accepted += $entry
    $luid = if ($entry.instanceName -match '(luid_0x[0-9a-f]+_0x[0-9a-f]+)') { $Matches[1] } else { 'unknown' }
    if ($entry.path -match '\\GPU Engine') {
      $engineType = if ($entry.instanceName -match 'engtype_(.*)$') { $Matches[1] } else { 'unknown' }
      $key = "$instancePid|$luid|$engineType"
      if ($engine.ContainsKey($key)) {
        $engine[$key].values += $entry.value
        $engine[$key].maxUtilizationPercent = [math]::Max($engine[$key].maxUtilizationPercent, $entry.value)
      } else {
        $engine[$key] = @{
          pid = $instancePid; luid = $luid; engineType = $engineType
          maxUtilizationPercent = $entry.value; values = @($entry.value); instanceNames = @($entry.instanceName)
        }
      }
      if ($engine[$key].instanceNames -notcontains $entry.instanceName) { $engine[$key].instanceNames += $entry.instanceName }
    } else {
      $metric = Split-Path -Leaf $entry.path
      $key = "$instancePid|$luid"
      if (-not $memory.ContainsKey($key)) {
        $memory[$key] = @{
          pid = $instancePid; luid = $luid
          dedicatedBytes = $null; sharedBytes = $null; nonLocalBytes = $null; totalCommittedBytes = $null
          readAt = (Get-Date).ToString('o')
        }
      }
      switch ($metric) {
        'Dedicated Usage' { $memory[$key].dedicatedBytes = $entry.value }
        'Shared Usage' { $memory[$key].sharedBytes = $entry.value }
        'Non Local Usage' { $memory[$key].nonLocalBytes = $entry.value }
        'Total Committed' { $memory[$key].totalCommittedBytes = $entry.value }
      }
    }
  }
  $engineList = [Collections.Generic.List[object]]::new()
  foreach ($key in @($engine.Keys | Sort-Object)) { $engineList.Add($engine[$key]) }
  $memoryList = [Collections.Generic.List[object]]::new()
  foreach ($key in @($memory.Keys | Sort-Object)) { $memoryList.Add($memory[$key]) }
  return @{ ok = $true; error = $response.error; engine = $engineList; memory = $memoryList; accepted = $accepted; invalid = $invalid; foreign = $foreign; rejected = $rejected }
}

# --- run ------------------------------------------------------------------------------------------

$counterErrors = [Collections.Generic.List[object]]::new()
$adapterSnapshots = [Collections.Generic.List[object]]::new()
$previous = @{}
$identity = @()
foreach ($target in $targets) {
  $state = Read-ProcessState -pidValue $target.Id
  $identity += [ordered]@{
    pid = $target.Id; name = $state.name; startTime = $state.startTime; path = $state.path
    cpuReadable = ($null -ne $state.cpuSeconds); note = $state.reason
  }
}

Write-Host "phase $Phase : $($targets.Count) process(es): $(($targets | ForEach-Object { "$($_.ProcessName)($($_.Id))" }) -join ', ')"

$livePids = @($targets | ForEach-Object { $_.Id })
$discovery = Resolve-Paths -pids $livePids
if (-not $discovery.ok) { $counterErrors.Add(@{ stage = 'discovery'; error = $discovery.error }) }
$cachedPaths = $discovery.resolvedPaths
Write-Host "  discovery matched $($cachedPaths.Count) exact counter path(s) for these PIDs; $(@($discovery.foreignInstances).Count) foreign instance(s) dropped"

# Warm-up: records the first CPU reading so the first sample can difference against it.
foreach ($target in $targets) {
  $state = Read-ProcessState -pidValue $target.Id
  if ($state.ok -and $null -ne $state.cpuSeconds) { $previous[$target.Id] = @{ at = $(if($fixture){$fixtureEpoch}else{[datetime]::Now}); cpu = $state.cpuSeconds } }
}

$rows = [Collections.Generic.List[object]]::new()
$deadline = [datetime]::Now.AddSeconds($Seconds)
$sinceDiscover = 0
$identityChanges = [Collections.Generic.List[object]]::new()

$fixtureIndex = 0
while (($fixture -and $fixtureIndex -lt $fixture.frames.Count) -or (-not $fixture -and (Get-Date) -lt $deadline)) {
  if ($fixture) { $fixtureFrame = $fixture.frames[$fixtureIndex]; $fixtureIndex++ }
  $readStartedAt = [datetime]::Now
  if ($sinceDiscover -ge $RediscoverEvery) {
    $rediscovery = Resolve-Paths -pids $livePids
    if (-not $rediscovery.ok) { $counterErrors.Add(@{ stage = 'rediscovery'; error = $rediscovery.error }) }
    if ($rediscovery.resolvedPaths.Count -gt 0) { $cachedPaths = $rediscovery.resolvedPaths }
    $sinceDiscover = 0
  }
  $sinceDiscover += 1

  $cpuReadAt = if ($fixture) { $fixtureEpoch.AddSeconds([double]$fixtureFrame.atSeconds) } else { [datetime]::Now }
  $processRows = @()
  foreach ($target in $targets) {
    $state = Read-ProcessState -pidValue $target.Id
    if (-not $state.ok) {
      $previous.Remove($target.Id)
      $processRows += [ordered]@{ pid = $target.Id; name = $target.ProcessName; alive = $false; cpuSeconds = $null; cpuPercentOfLogicalCapacity = $null; note = $state.reason }
      continue
    }
    # A reused PID must not be measured as the original target.
    $expected = $identity | Where-Object { $_.pid -eq $target.Id } | Select-Object -First 1
    $identityChanged = (-not $expected.startTime -or -not $state.startTime)
    if ($expected -and $expected.startTime -and $state.startTime -and $expected.startTime -ne $state.startTime) { $identityChanged = $true }
    if ($identityChanged) {
      $identityChanges.Add(@{ pid = $target.Id; expectedStart = $expected.startTime; observedStart = $state.startTime; at = (Get-Date).ToString('o') })
      $previous.Remove($target.Id)
      $processRows += [ordered]@{pid=$target.Id;name=$state.name;alive=$true;identityChanged=$true;cpuSeconds=$null;note='identity changed or unverifiable; excluded'}
      continue
    }

    $cpuPercent = $null
    $cpuDelta = $null
    $wallDelta = $null
    $note = $state.reason
    if ($null -eq $state.cpuSeconds) {
      $previous.Remove($target.Id)
      $note = if ($note) { $note } else { 'CPU reading unavailable' }
    } elseif ($previous.ContainsKey($target.Id) -and -not $identityChanged) {
      # The previous reading is captured before it is replaced; a reading that was unavailable leaves no
      # baseline, so the first reading after the gap does not produce an interval figure.
      $old = $previous[$target.Id]
      $wallDelta = ($cpuReadAt - $old.at).TotalSeconds
      $cpuDelta = $state.cpuSeconds - $old.cpu
      if ($wallDelta -gt 0 -and $cpuDelta -ge 0) { $cpuPercent = 100 * $cpuDelta / ($wallDelta * $logicalProcessors) }
      else { $note = 'invalid CPU interval; dropped'; $cpuDelta = $null; $wallDelta=$null; $cpuPercent = $null }
    } else {
      $note = if ($identityChanged) { 'PID reused by another process; no delta computed' } else { 'first reading; no baseline yet' }
    }
    if ($null -ne $state.cpuSeconds) { $previous[$target.Id] = @{ at = $cpuReadAt; cpu = $state.cpuSeconds } }

    $processRows += [ordered]@{
      pid = $target.Id
      name = $state.name
      alive = $true
      identityChanged = $identityChanged
      cpuSeconds = if ($null -ne $state.cpuSeconds) { [math]::Round($state.cpuSeconds, 6) } else { $null }
      cpuSecondsDelta = if ($null -ne $cpuDelta) { [math]::Round($cpuDelta, 9) } else { $null }
      wallClockSecondsDelta = if ($null -ne $wallDelta) { [math]::Round($wallDelta, 9) } else { $null }
      cpuPercentOfLogicalCapacity = if ($null -ne $cpuPercent) { [math]::Round($cpuPercent, 9) } else { $null }
      workingSetBytes = $state.workingSetBytes
      privateBytes = $state.privateBytes
      threads = $state.threads
      handles = $state.handles
      note = $note
    }
  }

  $gpuReadAt = [datetime]::Now
  $livePids = @($processRows | Where-Object {$_.alive -and -not $_.identityChanged} | ForEach-Object {$_.pid})
  $read = Read-Fixed -paths $cachedPaths -pids $livePids
  $gpuReadFinishedAt = [datetime]::Now
  # Get-Counter can block: verify identity again before accepting its GPU readings.
  $gpuVerifiedPids = @()
  foreach ($pidValue in $livePids) {
    $expected = $identity | Where-Object {$_.pid -eq $pidValue} | Select-Object -First 1
    $observedStart = $null
    if ($fixture) {
      $postStates = if ($null -ne $fixtureFrame.afterGpuProcesses) { $fixtureFrame.afterGpuProcesses } else { $fixtureFrame.processes }
      $post = $postStates | Where-Object {$_.pid -eq $pidValue -and $_.alive -ne $false} | Select-Object -First 1
      if ($post) { $observedStart = $post.startTime }
    } else {
      try { $observedStart = (Get-Process -Id $pidValue -ErrorAction Stop).StartTime.ToString('o') } catch {}
    }
    if ($observedStart -and $observedStart -eq $expected.startTime) { $gpuVerifiedPids += $pidValue }
    else {
      $identityChanges.Add(@{pid=$pidValue;expectedStart=$expected.startTime;observedStart=$observedStart;stage='after GPU read';at=$gpuReadFinishedAt.ToString('o')})
      $previous.Remove($pidValue)
    }
  }
  $read.engine = @($read.engine | Where-Object {$gpuVerifiedPids -contains $_.pid})
  $read.memory = @($read.memory | Where-Object {$gpuVerifiedPids -contains $_.pid})
  $read.accepted = @($read.accepted | Where-Object { $_.instanceName -match '^pid_(\d+)_' -and $gpuVerifiedPids -contains [int]$Matches[1] })
  if ($read.error) { $counterErrors.Add(@{ stage = 'read'; error = $read.error }) }
  if ($read.foreign.Count -gt 0) { $counterErrors.Add(@{ stage = 'read'; error = "foreign instances ignored: $(($read.foreign) -join ', ')" }) }

  $adapters = Get-AdapterSnapshot
  if (-not $adapters.ok) { $counterErrors.Add(@{ stage = 'adapters'; error = $adapters.error }) }
  $adapterSnapshots.Add($adapters)
  # The adapter set of this sample, built after the snapshot it describes.
  $adapterLuids = @()
  foreach ($adapterEntry in $adapters.entries) {
    if ($adapterLuids -notcontains $adapterEntry.luid) { $adapterLuids = $adapterLuids + $adapterEntry.luid }
  }
  # Sort the set so provider enumeration order cannot create a false topology change.
  $adapterLuids = @($adapterLuids | Sort-Object -Unique)
  $luidSetText = ''
  foreach ($luidItem in $adapterLuids) {
    if ($luidSetText -eq '') { $luidSetText = "$luidItem" } else { $luidSetText = "$luidSetText|$luidItem" }
  }
  $luidSet = $luidSetText
  if (-not $adapters.ok -or $adapterLuids.Count -eq 0) { $luidSet=$null }

  $gpuProjection = @()
  $gpuSeenPids = @()
  foreach ($rowEntry in $read.engine) {
    if ($gpuSeenPids -notcontains $rowEntry.pid) { $gpuSeenPids = $gpuSeenPids + $rowEntry.pid }
  }
  foreach ($gpuPid in $gpuSeenPids) {
    $gpuProjection += [ordered]@{
      pid = $gpuPid
      engines = @($read.engine | Where-Object { $_.pid -eq $gpuPid } | ForEach-Object {
        [ordered]@{
          engineType = $_.engineType; luid = $_.luid
          maxUtilizationPercent = [math]::Round($_.maxUtilizationPercent, 6)
          values = @($_.values | ForEach-Object { [math]::Round($_, 6) })
          instanceNames = @($_.instanceNames)
        }
      })
    }
  }
  $vramProjection = @()
  $vramSeenPids = @()
  foreach ($rowEntry in $read.memory) {
    if ($vramSeenPids -notcontains $rowEntry.pid) { $vramSeenPids = $vramSeenPids + $rowEntry.pid }
  }
  foreach ($vramPid in $vramSeenPids) {
    $vramProjection += [ordered]@{ pid = $vramPid; adapters = @($read.memory | Where-Object { $_.pid -eq $vramPid }) }
  }

  # Availability and activity are separate: readable-but-zero is an idle measurement, not a failure.
  $readableCpu = @($processRows | Where-Object { $null -ne $_.cpuSeconds }).Count
  $readableEngine = @($gpuProjection | Where-Object { $_.engines.Count -gt 0 }).Count
  $readableMemory = @($vramProjection | Where-Object { @($_.adapters | Where-Object { $null -ne $_.totalCommittedBytes -or $null -ne $_.dedicatedBytes -or $null -ne $_.sharedBytes }).Count -gt 0 }).Count
  $activeCpu = @($processRows | Where-Object { $null -ne $_.cpuPercentOfLogicalCapacity -and $_.cpuPercentOfLogicalCapacity -gt 0 }).Count
  $activeEngine = @($gpuProjection | Where-Object { @($_.engines | Where-Object { $_.maxUtilizationPercent -gt 0.05 }).Count -gt 0 }).Count
  $activeMemory = @($vramProjection | Where-Object { @($_.adapters | Where-Object { ($null -ne $_.totalCommittedBytes -and $_.totalCommittedBytes -gt 0) }).Count -gt 0 }).Count

  # Keep the complete sample record before adding it to the report.
  $row = [ordered]@{
    readStartedAt = $readStartedAt.ToString('o')
    cpuReadAt = $cpuReadAt.ToString('o')
    gpuReadAt = $gpuReadAt.ToString('o')
    gpuReadFinishedAt = $gpuReadFinishedAt.ToString('o')
    availability = [ordered]@{
      processesWithReadableCpu = $readableCpu
      processesWithReadableEngine = $readableEngine
      processesWithReadableMemory = $readableMemory
      counterReadOk = $read.ok
      adapterReadOk = $adapters.ok
      everyTargetReadable = ($readableCpu -eq $targets.Count)
    }
    activity = [ordered]@{
      processesWithCpuAboveZero = $activeCpu
      processesWithEngineAboveThreshold = $activeEngine
      processesWithMemoryAboveZero = $activeMemory
    }
    idleRatherThanFailed = (($readableCpu + $readableEngine + $readableMemory) -gt 0) -and (($activeCpu + $activeEngine + $activeMemory) -eq 0)
    measuredSomething = (($readableCpu + $readableEngine + $readableMemory) -gt 0)
    processes = $processRows
    processGpu = $gpuProjection
    processVram = $vramProjection
    gpuReadings = @($read.accepted)
    gpuIdentityVerifiedPids = $gpuVerifiedPids
    adapters = $adapters.entries
    adapterLuidSet = $luidSet
    rejectedReadings = @($read.rejected)
    invalidReadingCount = $read.invalid
  }
  $rows.Add($row)
  $sampleSeconds = [math]::Round((Get-ElapsedMs $gpuReadAt) / 1000, 1)
  $sampleLabel = "  sample {0} at {1} (GPU read {2} s)" -f $rows.Count, ([datetime]::Now).ToString('HH:mm:ss'), $sampleSeconds
  Write-Host $sampleLabel
  if (-not $fixture) { Start-Sleep -Milliseconds $IntervalMs }
}

# --- adapter topology: split into segments rather than averaging across a change -------------------
$segments = [Collections.Generic.List[object]]::new()
$currentSet = $null
foreach ($row in $rows) {
  if ($null -eq $row.adapterLuidSet) {
    $segments.Add(@{adapterLuidSet=$null;startAt=$row.readStartedAt;samples=[Collections.Generic.List[object]]::new()})
    $segments[$segments.Count-1].samples.Add($row)
    $currentSet=$null
    continue
  }
  if ($null -eq $currentSet -or $row.adapterLuidSet -ne $currentSet) {
    $currentSet = $row.adapterLuidSet
    $segments.Add(@{ adapterLuidSet = $currentSet; startAt = $row.readStartedAt; samples = [Collections.Generic.List[object]]::new() })
  }
  $segments[$segments.Count - 1].samples.Add($row)
}
$topologyChanged = @($segments | Where-Object {$null -ne $_.adapterLuidSet} | ForEach-Object {$_.adapterLuidSet} | Sort-Object -Unique).Count -gt 1

$summarySegments = @()
foreach ($segment in $segments) {
  $segmentRows = @($segment.samples)
  # Utilization over the whole segment: total delta over total time, not an average of per-sample averages,
  # because the sampler cannot promise evenly spaced intervals.
  $perPid = @()
  foreach ($target in $targets) {
    $cpuDeltaTotal = 0.0
    $wallTotal = 0.0
    $cpuDeltaCount = 0
    $readableCount = 0
    $cpuAvailable = 0
    foreach ($row in $segmentRows) {
      $entry = $row.processes | Where-Object { $_.pid -eq $target.Id } | Select-Object -First 1
      if (-not $entry -or -not $entry.alive -or $entry.identityChanged) { continue }
      $readableCount += 1
      if ($null -ne $entry.cpuSeconds) { $cpuAvailable += 1 }
      if ($null -ne $entry.cpuSecondsDelta -and $null -ne $entry.wallClockSecondsDelta) {
        $cpuDeltaTotal += $entry.cpuSecondsDelta
        $wallTotal += $entry.wallClockSecondsDelta
        $cpuDeltaCount += 1
      }
    }
    # Memory is summarised per adapter and per metric; LUIDs of one PID are never added together, and
    # metric names are kept distinct because the four counters are not interchangeable.
    $memoryByAdapter = @{}
    $engineMaxByType = @{}
    foreach ($row in $segmentRows) {
      foreach ($vram in @($row.processVram | Where-Object { $_.pid -eq $target.Id })) {
        foreach ($adapter in $vram.adapters) {
          $key = $adapter.luid
          if (-not $memoryByAdapter.ContainsKey($key)) {
            $memoryByAdapter[$key] = @{ luid = $key; dedicatedBytes = @(); sharedBytes = @(); nonLocalBytes = @(); totalCommittedBytes = @() }
          }
          foreach ($metric in @('dedicatedBytes', 'sharedBytes', 'nonLocalBytes', 'totalCommittedBytes')) {
            if ($null -ne $adapter.$metric) { $memoryByAdapter[$key][$metric] += $adapter.$metric }
          }
        }
      }
      foreach ($gpu in @($row.processGpu | Where-Object { $_.pid -eq $target.Id })) {
        foreach ($engine in $gpu.engines) {
          if (-not $engineMaxByType.ContainsKey($engine.engineType)) { $engineMaxByType[$engine.engineType] = @() }
          $engineMaxByType[$engine.engineType] += $engine.maxUtilizationPercent
        }
      }
    }
    $memorySummary = @()
    foreach ($key in @($memoryByAdapter.Keys | Sort-Object)) {
      $entry = $memoryByAdapter[$key]
      $memorySummary += [ordered]@{
        luid = $entry.luid
        dedicatedBytesAvg = if ($entry.dedicatedBytes.Count) { [double](($entry.dedicatedBytes | Measure-Object -Average).Average) } else { $null }
        sharedBytesAvg = if ($entry.sharedBytes.Count) { [double](($entry.sharedBytes | Measure-Object -Average).Average) } else { $null }
        nonLocalBytesAvg = if ($entry.nonLocalBytes.Count) { [double](($entry.nonLocalBytes | Measure-Object -Average).Average) } else { $null }
        totalCommittedBytesAvg = if ($entry.totalCommittedBytes.Count) { [double](($entry.totalCommittedBytes | Measure-Object -Average).Average) } else { $null }
        metricSamples = @{dedicated=$entry.dedicatedBytes.Count;shared=$entry.sharedBytes.Count;nonLocal=$entry.nonLocalBytes.Count;committed=$entry.totalCommittedBytes.Count}
        samples = $entry.totalCommittedBytes.Count
      }
    }
    $engineSummary = @()
    foreach ($engineType in @($engineMaxByType.Keys | Sort-Object)) {
      $values = @($engineMaxByType[$engineType])
      $engineSummary += [ordered]@{ engineType = $engineType; maxPercent = ($values | Measure-Object -Maximum).Maximum; samples = $values.Count }
    }
    $perPid += [ordered]@{
      pid = $target.Id
      name = $target.ProcessName
      samplesPresent = $readableCount
      cpuReadableSamples = $cpuAvailable
      cpuPercentOfLogicalCapacity = if ($wallTotal -gt 0) { [math]::Round(100 * $cpuDeltaTotal / ($wallTotal * $logicalProcessors), 9) } else { $null }
      cpuSecondsDeltaTotal = [math]::Round($cpuDeltaTotal, 6)
      wallClockSecondsTotal = [math]::Round($wallTotal, 6)
      cpuIntervalsUsed = $cpuDeltaCount
      memoryByAdapter = $memorySummary
      engineMaxByType = $engineSummary
    }
  }
  $summarySegments += [ordered]@{
    adapterLuidSet = $segment.adapterLuidSet
    topologyKnown = ($null -ne $segment.adapterLuidSet)
    samples = $segmentRows.Count
    startAt = $segment.startAt
    perPid = $perPid
  }
}

$totalSamples = $rows.Count
$coveredSamples = ($summarySegments | ForEach-Object { $_.samples } | Measure-Object -Maximum).Maximum
$knownTopologySamples = @($rows | Where-Object {$null -ne $_.adapterLuidSet}).Count
$allTargetsReadable = @($rows | Where-Object { $_.availability.everyTargetReadable }).Count
$report = [ordered]@{
  phase = $Phase
  label = $Label
  machine = [ordered]@{
    logicalProcessors = $logicalProcessors
    physicalCores = $physicalCores
    sockets = $sockets
    cpuPercentBasis = 'percent of all logical processors on this machine; not a single-core figure'
  }
  targets = $identity
  secondsRequested = $Seconds
  intervalMs = $IntervalMs
  rediscoverEvery = $RediscoverEvery
  discovery = [ordered]@{
    matchedExactPaths = @($cachedPaths)
    foreignInstancesDropped = @($discovery.foreignInstances)
    note = 'Instance names are matched as pid_<id>_* and the returned paths are cached; re-discovery only refreshes paths for the declared targets.'
  }
  samples = $rows.ToArray()
  adapterTopology = [ordered]@{
    changed = $topologyChanged
    segments = $summarySegments
    coverage = if ($topologyChanged) { 'topology changed: separate segments; no whole-phase average' } elseif ($knownTopologySamples -ne $totalSamples) { 'topology incomplete: unknown samples are separate segments' } else { 'one adapter set for the whole phase' }
    knownTopologySamples = $knownTopologySamples
    unknownTopologySamples = $totalSamples - $knownTopologySamples
    largestSegmentSamples = $coveredSamples
    samplesTotal = $totalSamples
  }
  summary = [ordered]@{
    identityStable = ($identityChanges.Count -eq 0)
    samplesTotal = $totalSamples
    samplesWithAllTargetsReadable = $allTargetsReadable
    idleRatherThanFailedSamples = @($rows | Where-Object { $_.idleRatherThanFailed }).Count
    measuredSomething = @($rows | Where-Object { $_.measuredSomething }).Count -gt 0
    identityChanges = $identityChanges.ToArray()
    segments = $summarySegments
    caveat = 'Per-PID engine values are that process''s own counter, not a share of the whole GPU. Memory is reported per adapter LUID and per metric; the four metrics are not interchangeable.'
  }
  counterErrors = $counterErrors.ToArray()
  notes = @(
    'PDH VALID_DATA (0) and NEW_DATA (1) are usable; invalid values retain their status.'
    'A reading that could not be taken stays null with a reason; it is never written as zero.'
    'Availability (could it be read) and activity (was it above zero) are separate fields.'
  )
}

$json = $report | ConvertTo-Json -Depth 12
# CreateNew: a concurrent run cannot overwrite this phase's evidence.
$stream = [IO.File]::Open($Output, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $stream.Write($bytes, 0, $bytes.Length)
} finally {
  $stream.Dispose()
}
@{ output = $Output; samples = $totalSamples; topologyChanged = $topologyChanged; segments = $summarySegments.Count; bytes = (Get-Item -LiteralPath $Output).Length } | ConvertTo-Json
