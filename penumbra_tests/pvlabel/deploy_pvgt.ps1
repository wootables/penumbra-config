# =============================================================================
# DEPLOY - pvgt (2026-10-22): the scheduler's three pivot builders (email HTML, .csv, .xlsx) take the
# Grand Total sub-labels from pivot_row_total_display_labels: an override shows its own labels even
# when it lists the values' types in their order (the page's rule). One file: schedule_runner.php.
#
#   deploy_pvgt.ps1 -Stage <dir> -Orig <dir> [-DryRun]
#
# The atomic-deploy recipe (NO .bak copies - git is the backup): git status --porcelain empty, live
# sha256 == the orig copy, stage != live, no stale .deploy-tmp; then WAITS for the scheduler's next
# "Run Complete" (the runner includes this file every 5 minutes), stage -> live.deploy-tmp
# (hash-verified), MoveFileEx(REPLACE_EXISTING), LastWriteTime = now, live hash verified.
# Run as a scriptblock (the share is RemoteSigned):
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<this file>'))) -Stage ... -Orig ... -DryRun
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Orig, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$GitExe = 'C:\Program Files\Git\cmd\git.exe'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
if (-not ('PnbMovePvgt' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMovePvgt' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }
function Move-Atomic([string]$from, [string]$to) {
  for ($k = 0; $k -lt 20; $k++) {
    if ([PnbMovePvgt]::MoveFileEx($from, $to, 1)) { return }
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -ne 32 -and $err -ne 33 -and $err -ne 5) { throw "MoveFileEx($from -> $to) failed: Win32 $err" }
    [System.Threading.Thread]::Sleep(250)
  }
  throw "MoveFileEx($from -> $to) kept failing (sharing violation)"
}
$order = @('schedule_runner.php')

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $order) {
  $LiveFile = Join-Path $LiveDir ($rel -replace '/', '\'); $StageFile = Join-Path $Stage ($rel -replace '/', '\'); $OrigFile = Join-Path $Orig ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $StageFile)) { $problems += "$rel : not staged"; continue }
  if (-not (Test-Path -LiteralPath $OrigFile)) { $problems += "$rel : no orig copy"; continue }
  $porc = & $GitExe -C $LiveDir status --porcelain -- $rel
  if ($porc) { $problems += "$rel : git status not clean ($porc) - another session's uncommitted swap?" }
  $hLive = Get-Sha $LiveFile
  if ($hLive -ne (Get-Sha $OrigFile)) { $problems += "$rel : LIVE CHANGED since staging (live $($hLive.Substring(0,12))) - re-stage by 3-way merge" }
  if ($hLive -eq (Get-Sha $StageFile)) { $problems += "$rel : stage == live (nothing to deploy?)" }
  if (Test-Path -LiteralPath "$LiveFile.deploy-tmp") { $problems += "$rel : a stale .deploy-tmp exists" }
}
if ($problems.Count) {
  Write-Host 'ABORT - nothing was touched:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  return
}
Write-Host 'guards OK' -ForegroundColor Green
if ($DryRun) { Write-Host 'DRY RUN - stopping before the swap.'; return }

# ---- time the swap: right after a scheduler "Run Complete" (a 5-minute cycle, :x2:15 / :x7:15) ----
$SchedLog = Join-Path $LiveDir ('log\scheduler_{0}.log' -f (Get-Date).ToString('yyyy-MM-dd'))
function Get-LastComplete { if (Test-Path -LiteralPath $SchedLog) { (Select-String -LiteralPath $SchedLog -Pattern 'Run Complete' | Select-Object -Last 1).Line } }
$seen = Get-LastComplete
$t0 = Get-Date
while ((Get-LastComplete) -eq $seen) {
  if (((Get-Date) - $t0).TotalSeconds -gt 400) { Write-Host 'ABORT - no new Run Complete in 400 s; nothing was touched.' -ForegroundColor Red; return }
  [System.Threading.Thread]::Sleep(2000)
}
Write-Host ("after: {0}" -f (Get-LastComplete))
# re-check the guards that can move while waiting
foreach ($rel in $order) {
  $LiveFile = Join-Path $LiveDir ($rel -replace '/', '\'); $OrigFile = Join-Path $Orig ($rel -replace '/', '\')
  if ((Get-Sha $LiveFile) -ne (Get-Sha $OrigFile)) { Write-Host "ABORT - $rel LIVE CHANGED while waiting; nothing was touched." -ForegroundColor Red; return }
  if (& $GitExe -C $LiveDir status --porcelain -- $rel) { Write-Host "ABORT - $rel git status not clean while waiting; nothing was touched." -ForegroundColor Red; return }
}

foreach ($rel in $order) {
  $LiveFile = Join-Path $LiveDir ($rel -replace '/', '\'); $StageFile = Join-Path $Stage ($rel -replace '/', '\')
  $want = Get-Sha $StageFile
  $before = Get-Sha $LiveFile
  $tmp = "$LiveFile.deploy-tmp"
  Copy-Item -LiteralPath $StageFile -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $want) { throw "$rel : temp copy hash mismatch" }
  Move-Atomic $tmp $LiveFile
  (Get-Item -LiteralPath $LiveFile).LastWriteTime = Get-Date
  $after = Get-Sha $LiveFile
  if ($after -ne $want) { throw "$rel : LIVE hash after the swap is $after, expected $want" }
  Write-Host ("  swapped {0,-20} {1} -> {2}" -f $rel, $before.Substring(0, 8), $after.Substring(0, 8)) -ForegroundColor Green
}
Write-Host ('DEPLOYED {0}. Next: commit + push schedule_runner.php only.' -f (Get-Date).ToString('s')) -ForegroundColor Green
