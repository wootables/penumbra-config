# spike_v3.ps1 - runs as SYSTEM from the watchdog tick. Edge refuses to run as
# SYSTEM (v2: exit in <300ms, no output), so try the two passwordless service
# accounts through TEMPORARY local tasks, created and deleted in this run.
$D = 'D:\Utilities\PHP_8.2-p\chart_spike'
"v3 as $([Environment]::UserName) session $([Diagnostics.Process]::GetCurrentProcess().SessionId)"
& icacls $D /grant "NT AUTHORITY\NETWORK SERVICE:(OI)(CI)M" /grant "NT AUTHORITY\LOCAL SERVICE:(OI)(CI)M" /T /Q 2>&1 | Out-String | ForEach-Object { "icacls: " + $_.Trim() }
foreach ($t in @(@{ x = 'NS'; ru = 'NT AUTHORITY\NETWORK SERVICE' }, @{ x = 'LS'; ru = 'NT AUTHORITY\LOCAL SERVICE' })) {
  $x = $t.x; $tn = "Penumbra Spike $x"
  foreach ($f in @("$D\chart_$x.png", "$D\attempt_$x.log", "$D\attempt_$x.err", "$D\attempt_$x.out")) { if (Test-Path $f) { [IO.File]::Delete($f) } }
  $tr = "$D\attempt_svc.cmd $x"
  "--- $x : creating task '$tn' as $($t.ru)"
  & schtasks /Create /TN $tn /TR $tr /SC ONCE /ST 00:00 /RU $t.ru /RL LIMITED /F 2>&1 | ForEach-Object { "  create: $_" }
  & schtasks /Run /TN $tn 2>&1 | ForEach-Object { "  run: $_" }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt 60) {
    Start-Sleep -Seconds 2
    if ((Test-Path "$D\attempt_$x.log") -and ((Get-Content "$D\attempt_$x.log" -Raw) -match 'attempt \w+ end')) { break }
  }
  "  waited $([int]$sw.Elapsed.TotalSeconds)s"
  if (Test-Path "$D\attempt_$x.log") { Get-Content "$D\attempt_$x.log" | ForEach-Object { "  log: $_" } }
  else { "  NO attempt log - the task did not run"; & schtasks /Query /TN $tn /V /FO LIST 2>&1 | Select-String 'Last Run Time|Last Result|Status' | ForEach-Object { "  query: " + $_.Line.Trim() } }
  "  png=$(Test-Path "$D\chart_$x.png") bytes=$(if (Test-Path "$D\chart_$x.png") { (Get-Item "$D\chart_$x.png").Length } else { 0 }) err_bytes=$(if (Test-Path "$D\attempt_$x.err") { (Get-Item "$D\attempt_$x.err").Length } else { -1 })"
  & schtasks /End /TN $tn 2>&1 | Out-Null
  & schtasks /Delete /TN $tn /F 2>&1 | ForEach-Object { "  delete: $_" }
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*chart_spike*' } | ForEach-Object { "  leftover edge pid $($_.ProcessId) - killing"; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
"tasks left named Penumbra Spike: $((schtasks /Query /FO LIST 2>$null | Select-String 'Penumbra Spike').Count)"
