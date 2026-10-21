# =============================================================================
# DEPLOY - nestsort (2026-10-20): a nested-table (@@JSON) column sorts by how many rows
# its tables hold. penumbra_search.php (penumbra_nested_row_count, the count both PHP
# callers use), schedule_runner.php (the scheduled email's sort), index.php (?json=1's
# saved sort), js\main.js (sortRows, the breakdown tables, the menu's nested check),
# js\penumbra_colmenu.js (the menu's wording), the Your Settings + Power Features topics,
# README.md (the suite's section 3 entry).
#
#   deploy_nestsort.ps1 -Stage <dir> -Orig <dir> [-DryRun]
#
# The atomic-deploy recipe since 2026-10-14 (NO .bak copies - git is the backup): before
# a single byte moves, for EVERY file: git status --porcelain is empty (no other session's
# uncommitted swap), live sha256 == the orig copy the stage was cut from (another session
# may have deployed meanwhile: then NOTHING is touched - re-cut and re-apply patch.py),
# stage != live, no stale .deploy-tmp. Then per file: stage -> live.deploy-tmp
# (hash-verified), kernel32 MoveFileEx(tmp, live, REPLACE_EXISTING), retried on sharing
# violations, LastWriteTime = now (?v=filemtime), live hash verified. Order:
# penumbra_search.php FIRST (an addition nothing old calls; the runner and index.php call
# it only once they are swapped), 3 s, then the rest. After: prebuild the help cache ON
# LIVE (helpv2\prebuild_caches.php), commit + push (the cache in its own commit).
# Run as a scriptblock (the share is RemoteSigned):
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<this file>'))) -Stage ... -Orig ... -DryRun
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Orig, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$GitExe = 'C:\Program Files\Git\cmd\git.exe'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
$env:GIT_WORK_TREE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
if (-not ('PnbMoveNestSort' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMoveNestSort' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }
function Move-Atomic([string]$from, [string]$to) {
  for ($k = 0; $k -lt 20; $k++) {
    if ([PnbMoveNestSort]::MoveFileEx($from, $to, 1)) { return }
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -ne 32 -and $err -ne 33 -and $err -ne 5) { throw "MoveFileEx($from -> $to) failed: Win32 $err" }
    [System.Threading.Thread]::Sleep(250)
  }
  throw "MoveFileEx($from -> $to) kept failing (sharing violation)"
}
$first = @('penumbra_search.php')
$then = @('schedule_runner.php', 'index.php', 'js/main.js', 'js/penumbra_colmenu.js',
          'help/topics/userSettingsHelpLightbox.php', 'help/topics/powerFeaturesHelpLightbox.php', 'README.md')
$order = $first + $then

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $order) {
  $LiveFile = Join-Path $LiveDir ($rel -replace '/', '\'); $StageFile = Join-Path $Stage ($rel -replace '/', '\'); $OrigFile = Join-Path $Orig ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $StageFile)) { $problems += "$rel : not staged"; continue }
  if (-not (Test-Path -LiteralPath $OrigFile)) { $problems += "$rel : no orig copy"; continue }
  $porc = & $GitExe status --porcelain -- $rel
  if ($LASTEXITCODE -ne 0) { $problems += "$rel : git status failed (exit $LASTEXITCODE)" }
  if ($porc) { $problems += "$rel : git status not clean ($porc) - another session's uncommitted swap?" }
  $hLive = Get-Sha $LiveFile
  if ($hLive -ne (Get-Sha $OrigFile)) { $problems += "$rel : LIVE CHANGED since staging (live $($hLive.Substring(0,12))) - re-cut and re-apply patch.py" }
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

function Swap([string]$rel) {
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
  Write-Host ("  swapped {0,-45} {1} -> {2}" -f $rel, $before.Substring(0, 8), $after.Substring(0, 8)) -ForegroundColor Green
}
foreach ($rel in $first) { Swap $rel }
[System.Threading.Thread]::Sleep(3000)
foreach ($rel in $then) { Swap $rel }
Write-Host ('DEPLOYED {0}. Users pick it up on reload (?v=filemtime). Next: prebuild the help cache, commit + push.' -f (Get-Date).ToString('s')) -ForegroundColor Green
