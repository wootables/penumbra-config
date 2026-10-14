# =============================================================================
# DEPLOY - the List layout counts a set column width only where the width tool draws it, never as more than asked (2026-10-03, "grplist2b")
#
#   deploy2b.ps1 -Stage <dir> -Expect <dir>\orig.sha256 [-Stamp S] [-DryRun] [-App <scratch app copy>]
#   deploy2b.ps1 -Stage <dir> -Expect <dir>\orig.sha256 -Stamp S -Rollback     put the .bak-S files back
#
# <dir> holds the staged build in the app's layout: js\penumbra_grouplist.js (one file).
# orig.sha256 lists the LIVE hashes the stage was cut from (sha256sum format,
# matched by file name).
#
# The atomic-deploy recipe (README section 4): every live file must still hash
# to what the stage was cut from (another session may have deployed meanwhile -
# then NOTHING is touched: re-stage by 3-way merge from a fresh live copy), and no
# backup of this stamp may exist yet. Then per file: live -> live.bak-<stamp>
# (hash-verified), stage -> live.deploy-tmp (hash-verified), kernel32
# MoveFileEx(tmp, live, REPLACE_EXISTING) - one atomic rename, the destination
# untouched on failure - retried on sharing violations, LastWriteTime = now
# (main.js is cache-busted by ?v=filemtime), live hash verified.
# One file: js\penumbra_grouplist.js.
#
# -Rollback: every live file must hash to its STAGED hash (still this deploy),
# then each .bak-<stamp> goes back the same way. The .bak files stay.
# Writes deploy\<stamp>\manifest.json under -Here (default: this script's folder).
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Expect,
      [string]$Stamp = '', [switch]$DryRun, [switch]$Rollback, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\grplist' }
# -App: rehearse against a scratch copy of the app folder.
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
if (-not $Stamp) {
  if ($Rollback) { throw '-Rollback needs the -Stamp of the deploy to undo' }
  $Stamp = (Get-Date).ToString('yyyyMMdd') + '-grplist2b'
}

if (-not ('PnbMove' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMove' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }
function Move-Atomic([string]$from, [string]$to) {
  for ($i = 0; $i -lt 20; $i++) {
    if ([PnbMove]::MoveFileEx($from, $to, 1)) { return }
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -ne 32 -and $err -ne 33 -and $err -ne 5) { throw "MoveFileEx($from -> $to) failed: Win32 $err" }
    Start-Sleep -Milliseconds 250
  }
  throw "MoveFileEx($from -> $to) kept failing (sharing violation)"
}

$modified = @('js/penumbra_grouplist.js')
$expectMap = @{}
foreach ($line in [IO.File]::ReadAllLines($Expect)) {
  if ($line -match '^([0-9a-f]{64}) +\*?(.+)$') { $expectMap[[IO.Path]::GetFileName($Matches[2].Trim())] = $Matches[1] }
}

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $modified) {
  $name = [IO.Path]::GetFileName($rel)
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  if (-not $expectMap.ContainsKey($name)) { $problems += "$rel : no expected hash in $Expect" ; continue }
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged" ; continue }
  $h = Get-Sha $live
  if ($Rollback) {
    if ($h -ne (Get-Sha $stg)) { $problems += "$rel : live ($($h.Substring(0,12))) is not this deploy - not rolling back over it" }
    if (-not (Test-Path -LiteralPath "$live.bak-$Stamp")) { $problems += "$rel : no $live.bak-$Stamp" }
    elseif ((Get-Sha "$live.bak-$Stamp") -ne $expectMap[$name]) { $problems += "$rel : the .bak does not hash to the pre-deploy hash" }
  } else {
    if ($h -ne $expectMap[$name]) { $problems += "$rel : LIVE CHANGED since staging (live $($h.Substring(0,12)), staged from $($expectMap[$name].Substring(0,12))) - re-stage" }
    if (Test-Path -LiteralPath "$live.bak-$Stamp") { $problems += "$rel : $live.bak-$Stamp already exists" }
  }
  if (Test-Path -LiteralPath "$live.deploy-tmp") { $problems += "$rel : a stale $live.deploy-tmp exists" }
}
if ($problems.Count) {
  Write-Host 'ABORT - nothing was touched:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  return
}
Write-Host ("guards OK ({0}stamp {1}, app {2})" -f $(if ($Rollback) { 'ROLLBACK, ' } else { '' }), $Stamp, $app) -ForegroundColor Green
if ($DryRun) { Write-Host 'DRY RUN - stopping before the swap.'; return }

$manifest = [ordered]@{ stamp = $Stamp; when = (Get-Date).ToString('s'); app = $app; rollback = [bool]$Rollback; files = [ordered]@{} }
function Swap([string]$rel) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  $src = if ($Rollback) { "$live.bak-$Stamp" } else { $stg }
  $want = Get-Sha $src
  $before = Get-Sha $live
  if (-not $Rollback) {
    Copy-Item -LiteralPath $live -Destination "$live.bak-$Stamp"
    if ((Get-Sha "$live.bak-$Stamp") -ne $before) { throw "$rel : backup hash mismatch" }
  }
  $tmp = "$live.deploy-tmp"
  Copy-Item -LiteralPath $src -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $want) { throw "$rel : temp copy hash mismatch" }
  Move-Atomic $tmp $live
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  $after = Get-Sha $live
  if ($after -ne $want) { throw "$rel : LIVE hash after the swap is $after, expected $want" }
  $manifest.files[$rel] = [ordered]@{ before = $before; after = $after; bak = "$rel.bak-$Stamp" }
  Write-Host ("  swapped {0,-17} {1} -> {2}" -f $rel, $before.Substring(0, 8), $after.Substring(0, 8)) -ForegroundColor Green
}
foreach ($rel in $modified) { Swap $rel }

$dir = Join-Path $here ("deploy\$Stamp" + $(if ($Rollback) { '-rollback' } else { '' }))
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText("$dir\manifest.json", ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "manifest: $dir\manifest.json"
Write-Host $(if ($Rollback) { 'ROLLED BACK.' } else { 'DEPLOYED. Users pick it up on reload (main.js ?v=filemtime).' }) -ForegroundColor Green
