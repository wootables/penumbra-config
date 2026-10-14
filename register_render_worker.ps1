# register_render_worker.ps1 - ONE-SHOT, runs as SYSTEM from the watchdog tick
# (the only execution channel to the box). Registers the "Penumbra Render
# Worker" scheduled task under NETWORK SERVICE, grants that account what the
# worker needs, starts it, and proves it is alive by its heartbeat.
$P = 'D:\Utilities\PHP_8.2-p'
$Q = "$P\render_queue"
$tn = 'Penumbra Render Worker'
"register as $([Environment]::UserName) session $([Diagnostics.Process]::GetCurrentProcess().SessionId)"
New-Item -ItemType Directory -Force -Path $Q | Out-Null
# What NETWORK SERVICE needs: the queue (modify), the two scripts (read+execute).
& icacls $Q /grant "NT AUTHORITY\NETWORK SERVICE:(OI)(CI)M" /Q 2>&1 | ForEach-Object { "icacls queue: " + "$_".Trim() }
& icacls "$P\penumbra_render_worker.ps1" /grant "NT AUTHORITY\NETWORK SERVICE:RX" /Q 2>&1 | ForEach-Object { "icacls ps1: " + "$_".Trim() }
& icacls "$P\penumbra_render_worker.cmd" /grant "NT AUTHORITY\NETWORK SERVICE:RX" /Q 2>&1 | ForEach-Object { "icacls cmd: " + "$_".Trim() }
# Every 5 minutes; the default instance policy for schtasks-created tasks is
# "do not start a new instance", so a live worker is never doubled and a dead
# one is replaced within five minutes. /RL LIMITED: no elevation needed.
& schtasks /Create /TN $tn /TR "$P\penumbra_render_worker.cmd" /SC MINUTE /MO 5 /RU "NT AUTHORITY\NETWORK SERVICE" /RL LIMITED /F 2>&1 | ForEach-Object { "create: $_" }
& schtasks /Run /TN $tn 2>&1 | ForEach-Object { "run: $_" }
$hb = "$Q\worker.heartbeat"
$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt 45 -and -not (Test-Path $hb)) { Start-Sleep -Seconds 2 }
if (Test-Path $hb) { "heartbeat after $([int]$sw.Elapsed.TotalSeconds)s: $(Get-Content $hb -Raw)" } else { "NO HEARTBEAT after 45s" }
& schtasks /Query /TN $tn /V /FO LIST 2>&1 | Select-String 'Status|Last Run Time|Last Result|Run As User|Schedule Type|Repeat: Every' | ForEach-Object { "query: " + $_.Line.Trim() }
if (Test-Path "$Q\worker.log") { Get-Content "$Q\worker.log" | Select-Object -Last 3 | ForEach-Object { "worker.log: $_" } }
