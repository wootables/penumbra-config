# =============================================================================
# DEPLOY - brk (2026-10-21): a derived pivot value drills to the cells it is computed from (js\main.js:
# the drill's code as shared helpers, penumbraPivotDerivedDrill, data-pv-drv / data-pv-rk on the cells,
# the breakdown's lead column frozen with its '#'; js\penumbra_colmenu.js: Show the breakdown on a derived
# cell; css\main.css: its pointer). Help: the pivot builder's drill-down lists, Your Settings' pivot menu
# table, the Disable Drill-Down Links tip. README.md.
#
#   deploy_brk.ps1 -Stage <dir> -Orig <dir> [-DryRun]
#
# The atomic-deploy recipe (NO .bak copies - git is the backup): git status --porcelain empty (git -C the
# webroot), live sha256 == the orig copy, stage != live, no stale .deploy-tmp; then per file stage ->
# live.deploy-tmp (hash-verified), MoveFileEx(REPLACE_EXISTING), LastWriteTime = now, live hash verified.
# Any order works (each script works with the others' old copies); no runner change.
# Run as a scriptblock (the share is RemoteSigned):
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<this file>'))) -Stage ... -Orig ... -DryRun
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Orig, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$GitExe = 'C:\Program Files\Git\cmd\git.exe'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
if (-not ('PnbMoveBrk' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMoveBrk' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }
function Move-Atomic([string]$from, [string]$to) {
  for ($k = 0; $k -lt 20; $k++) {
    if ([PnbMoveBrk]::MoveFileEx($from, $to, 1)) { return }
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -ne 32 -and $err -ne 33 -and $err -ne 5) { throw "MoveFileEx($from -> $to) failed: Win32 $err" }
    [System.Threading.Thread]::Sleep(250)
  }
  throw "MoveFileEx($from -> $to) kept failing (sharing violation)"
}
$first = @('css/main.css')
$then = @('js/penumbra_colmenu.js', 'js/main.js', 'help/topics/userSettingsHelpLightbox.php', 'help/topics/pivotBuilderHelpLightbox.php',
  'help/tips/pivot-tips-storage.php', 'README.md')
$order = $first + $then

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $order) {
  $LiveFile = Join-Path $LiveDir ($rel -replace '/', '\'); $StageFile = Join-Path $Stage ($rel -replace '/', '\'); $OrigFile = Join-Path $Orig ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $StageFile)) { $problems += "$rel : not staged"; continue }
  if (-not (Test-Path -LiteralPath $OrigFile)) { $problems += "$rel : no orig copy"; continue }
  $porc = & $GitExe -C $LiveDir status --porcelain -- $rel   # -C: the pathspec is the webroot's whatever the caller's folder
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
