# =============================================================================
# penumbra_render_worker.ps1 - headless-Edge render worker (2026-09-29)
#
# WHY IT EXISTS: PHP on oitras cannot spawn a process (php.ini disable_functions,
# every SAPI, on purpose - README section 5), and headless Edge refuses to run
# as SYSTEM, which is what the scheduler task is. So charts for scheduled email
# and PDF are rendered by THIS loop, run by the scheduled task
# "Penumbra Render Worker" under NT AUTHORITY\NETWORK SERVICE (the account the
# 2026-09-29 spike proved: exit 0, PNG in 5-17s).
#
# PROTOCOL (one folder, render_queue\, shared with the runner):
#   <id>.html          the page to render (the runner writes <id>.html.tmp and
#                      renames it, so a half-written page is never picked up)
#   <id>.json          optional options: width, height, dpr, budget (ms),
#                      mode ("png" = screenshot, the default; "dom" = the
#                      page's DOM after its scripts ran, --dump-dom)
#   <id>.lock          this worker is rendering it
#   <id>.png           the result of a png render
#   <id>.dom           the result of a dom render
#   <id>.done          JSON: ok, ms, bytes, error, width, height, dpr, mode, finished
#   js\                app libraries the runner mirrors here for dom pages
#                      (NETWORK SERVICE cannot read the webroot); never swept
#   worker.heartbeat   ISO timestamp, rewritten every poll (liveness for the
#                      runner and the Health hub)
#   worker.lock        PID of the running instance (one instance at a time)
#   worker.log         this log (rotated at 1 MB)
# The runner deletes its own files once it has read them; anything older than
# StaleMinutes is swept here so an abandoned request cannot fill the folder.
#
# LIFETIME: the task fires every 5 minutes with "do not start a new instance";
# the loop exits after MaxHours so a fresh process (and a fresh Edge profile
# after ProfileRecycleDays) takes over at the next trigger. It also exits when
# this file changes on disk (self-reload: nothing outside the box can stop it).
#   -Once   process what is queued and exit (used by the test suite)
# =============================================================================
param(
  [string]$Queue = 'D:\Utilities\PHP_8.2-p\render_queue',
  [string]$Edge = '',
  [double]$MaxHours = 23,
  [int]$RenderTimeoutSec = 60,
  [int]$PollMs = 500,
  [int]$StaleMinutes = 60,
  [int]$StaleEveryMinutes = 5,
  [switch]$Once
)
$ErrorActionPreference = 'Continue'
if (-not $Edge) {
  $Edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  if (-not (Test-Path $Edge)) { $Edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
}
New-Item -ItemType Directory -Force -Path $Queue | Out-Null
$log       = Join-Path $Queue 'worker.log'
$heartbeat = Join-Path $Queue 'worker.heartbeat'
$lockFile  = Join-Path $Queue 'worker.lock'
$edgeProfile = Join-Path $Queue 'profile'   # not $profile: that is PowerShell's own automatic variable

function Log([string]$m) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  try { [IO.File]::AppendAllText($log, $line + "`r`n") } catch {}
  Write-Output $line
}
function Del([string]$p) { try { if (Test-Path -LiteralPath $p) { [IO.File]::Delete($p) } } catch {} }

# Rotate the log at 1 MB.
try { if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) { Del ($log + '.1'); [IO.File]::Move($log, $log + '.1') } } catch {}

# One instance at a time. A lock whose PID is gone (or is not a PowerShell) is stale.
try {
  if (Test-Path $lockFile) {
    $oldPid = 0; try { $oldPid = [int](Get-Content $lockFile -ErrorAction Stop | Select-Object -First 1) } catch {}
    $oldProc = if ($oldPid -gt 0) { Get-Process -Id $oldPid -ErrorAction SilentlyContinue } else { $null }
    if ($oldProc -and $oldProc.ProcessName -like 'powershell*' -and $oldPid -ne $PID) { Log "another worker (pid $oldPid) holds the lock - exiting"; exit 0 }
    if ($oldPid -gt 0) { Log "stale lock from pid $oldPid - taking over" }
  }
  [IO.File]::WriteAllText($lockFile, "$PID")
} catch { Log "lock failed: $($_.Exception.Message)"; exit 1 }

Log "worker start pid=$PID user=$([Environment]::UserName) session=$([Diagnostics.Process]::GetCurrentProcess().SessionId) edge=$Edge queue=$Queue once=$Once"
if (-not (Test-Path $Edge)) { Log "EDGE NOT FOUND at $Edge - exiting"; Del $lockFile; exit 1 }
$deadline = (Get-Date).AddHours($MaxHours)

function Clamp([int]$v, [int]$lo, [int]$hi) { if ($v -lt $lo) { $lo } elseif ($v -gt $hi) { $hi } else { $v } }

function Render-One([string]$html) {
  $id   = [IO.Path]::GetFileNameWithoutExtension($html)
  $png  = Join-Path $Queue "$id.png"
  $domF = Join-Path $Queue "$id.dom"
  $done = Join-Path $Queue "$id.done"
  $lock = Join-Path $Queue "$id.lock"
  $opt  = Join-Path $Queue "$id.json"
  $errF = Join-Path $Queue "$id.err"
  $outF = Join-Path $Queue "$id.out"
  if (Test-Path $done) { return }
  try { [IO.File]::WriteAllText($lock, "$PID") } catch { return }
  $w = 900; $h = 450; $dpr = 1; $budget = 3000; $mode = 'png'
  if (Test-Path $opt) {
    try {
      $o = Get-Content $opt -Raw -ErrorAction Stop | ConvertFrom-Json
      if ($o.width)  { $w = [int]$o.width }
      if ($o.height) { $h = [int]$o.height }
      if ($o.dpr)    { $dpr = [int]$o.dpr }
      if ($o.budget) { $budget = [int]$o.budget }
      if ($o.mode -and ([string]$o.mode).ToLower() -eq 'dom') { $mode = 'dom' }
    } catch { Log "${id}: options unreadable, defaults used ($($_.Exception.Message))" }
  }
  $w = Clamp $w 100 4000; $h = Clamp $h 100 4000; $dpr = Clamp $dpr 1 3; $budget = Clamp $budget 500 30000
  Del $png; Del $domF
  # The flags the 2026-09-29 spike proved under NETWORK SERVICE; --no-sandbox is
  # part of that recipe (the page is the runner's own HTML, no remote content).
  $edgeArgs = @('--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
            '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
            '--disable-background-networking', '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files',
            "--user-data-dir=$edgeProfile", "--window-size=$w,$h", "--virtual-time-budget=$budget")
  $url = 'file:///' + $html.Replace('\', '/')
  if ($mode -eq 'dom') {
    # The DOM goes to stdout: capture it straight into <id>.dom.
    $edgeArgs += @('--dump-dom', $url)
    $stdoutF = $domF
    $result_file = $domF
  } else {
    $edgeArgs += @("--force-device-scale-factor=$dpr", "--screenshot=$png", $url)
    $stdoutF = $outF
    $result_file = $png
  }
  $sw = [Diagnostics.Stopwatch]::StartNew(); $err = ''; $ok = $false
  try {
    $p = Start-Process -FilePath $Edge -ArgumentList $edgeArgs -PassThru -NoNewWindow -RedirectStandardError $errF -RedirectStandardOutput $stdoutF
    if (-not $p.WaitForExit($RenderTimeoutSec * 1000)) {
      $err = "timeout after ${RenderTimeoutSec}s"
      try { & taskkill /PID $p.Id /T /F 2>&1 | Out-Null } catch {}
    } else {
      # On the box the launcher's ExitCode reads as null (seen live 2026-09-29);
      # only a real non-zero number is an error, and a result on disk outranks it.
      $code = $null; try { $code = $p.ExitCode } catch {}
      if ($code -is [int] -and $code -ne 0) { $err = "edge exit $code" }
    }
    $ok = (Test-Path $result_file) -and ((Get-Item $result_file).Length -gt 0)
    if ($ok) { $err = '' }
    else {
      if (-not $err) { $err = "no $mode written" }
      try { $tail = (Get-Content $errF -Raw -ErrorAction SilentlyContinue); if ($tail) { $tail = $tail.Trim(); if ($tail.Length -gt 300) { $tail = $tail.Substring($tail.Length - 300) }; $err += ' | ' + $tail } } catch {}
    }
  } catch { $err = "launch failed: $($_.Exception.Message)" }
  $sw.Stop()
  # Edge's children can hold the two capture files open for a moment after the
  # launcher returns (seen live: t1.err / t1.out left behind); a short wait and
  # a second try, and the stale sweep catches anything still left.
  Start-Sleep -Milliseconds 250
  Del $outF; Del $errF
  $bytes = 0; if ($ok) { $bytes = [int](Get-Item $result_file).Length }
  $result = @{ ok = $ok; ms = [int]$sw.ElapsedMilliseconds; bytes = $bytes; mode = $mode;
               error = $err; width = $w; height = $h; dpr = $dpr; finished = (Get-Date).ToString('o') } | ConvertTo-Json -Compress
  # Publish atomically: the runner polls for <id>.done and must never read a half file.
  [IO.File]::WriteAllText($done + '.tmp', $result)
  Del $done; [IO.File]::Move($done + '.tmp', $done)
  Del $lock
  Log "$id -> $(if ($ok) { 'ok' } else { 'FAIL' }) $mode $($sw.ElapsedMilliseconds)ms ${w}x${h}@$dpr $bytes bytes $err"
}

function Clean-Stale {
  $cut = (Get-Date).AddMinutes(-$StaleMinutes)
  foreach ($f in (Get-ChildItem -Path $Queue -File -ErrorAction SilentlyContinue)) {
    if ($f.Name -like 'worker.*') { continue }
    if ($f.LastWriteTime -lt $cut) { Del $f.FullName; Log "swept stale $($f.Name)" }
  }
}

$lastStale = Get-Date
# Self-reload: nothing can stop or start a process on this box from outside,
# so a new copy of this script applies itself - when the file on disk changes,
# the loop exits and the task's 5-minute trigger starts the new version.
$scriptStamp = try { (Get-Item $PSCommandPath).LastWriteTimeUtc } catch { $null }
$lastReloadCheck = Get-Date
try {
  while ($true) {
    try { [IO.File]::WriteAllText($heartbeat, (Get-Date).ToString('o')) } catch {}
    if ($scriptStamp -and ((Get-Date) - $lastReloadCheck).TotalSeconds -ge 30) {
      $lastReloadCheck = Get-Date
      $nowStamp = try { (Get-Item $PSCommandPath).LastWriteTimeUtc } catch { $scriptStamp }
      if ($nowStamp -ne $scriptStamp) { Log 'script file changed on disk - exiting so the task trigger starts the new version'; break }
    }
    $reqs = Get-ChildItem -Path $Queue -Filter '*.html' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime
    foreach ($r in $reqs) {
      $id = $r.BaseName
      if ((Test-Path (Join-Path $Queue "$id.done")) -or (Test-Path (Join-Path $Queue "$id.lock"))) { continue }
      Render-One $r.FullName
    }
    if (((Get-Date) - $lastStale).TotalMinutes -ge $StaleEveryMinutes) { Clean-Stale; $lastStale = Get-Date }
    if ($Once) { break }
    if ((Get-Date) -gt $deadline) { Log 'max hours reached - recycling (the task trigger restarts a fresh worker)'; break }
    Start-Sleep -Milliseconds $PollMs
  }
} finally {
  Del $lockFile
  Log "worker stop pid=$PID"
}
