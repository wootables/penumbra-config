# =============================================================================
# DEPLOY - lazy rows: rows off the first page are built EMPTY and filled on demand (2026-09-30)
#
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun] [-App <scratch app copy>]
#
# <dir> holds the staged build in the app's layout: js\main.js, README.md.
# orig.sha256 lists the LIVE hashes the stage was cut from (sha256sum format;
# the names are matched by file name).
#
# The atomic-deploy recipe: every live file must still hash to what the stage
# was cut from (another session may have deployed meanwhile - then NOTHING is
# touched: re-stage with `lr_patch.py forward <live copy> <stage>`), no backup of
# this stamp may exist yet. Then per file: live -> live.bak-<stamp>
# (hash-verified), stage -> live.deploy-tmp (hash-verified), kernel32
# MoveFileEx(tmp, live, REPLACE_EXISTING) - one atomic rename, the destination
# untouched on failure - retried on sharing violations, LastWriteTime = now,
# live hash verified. Order: README.md, main.js.
#
# Writes deploy\<stamp>\manifest.json beside this script (hashes before/after).
# Roll back: copy js\main.js.bak-<stamp> over js\main.js (and README.md the same) - or,
# without a deploy, turn every lazy build off: an empty js\penumbra_lazycells.off.
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Expect,
      [string]$Stamp = '', [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\lazyrows' }
# -App: rehearse against a scratch copy of the app folder.
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
if (-not $Stamp) { $Stamp = (Get-Date).ToString('yyyyMMdd') + '-lazyrows' }

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

$modified = @('README.md', 'js/main.js')
$expectMap = @{}
foreach ($line in [IO.File]::ReadAllLines($Expect)) {
  if ($line -match '^([0-9a-f]{64}) \*?(.+)$') { $expectMap[[IO.Path]::GetFileName($Matches[2].Trim())] = $Matches[1] }
}

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $modified) {
  $name = [IO.Path]::GetFileName($rel)
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  if (-not $expectMap.ContainsKey($name)) { $problems += "$rel : no expected hash in $Expect" ; continue }
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged" ; continue }
  $h = Get-Sha $live
  if ($h -ne $expectMap[$name]) { $problems += "$rel : LIVE CHANGED since staging (live $($h.Substring(0,12)), staged from $($expectMap[$name].Substring(0,12))) - re-stage" }
  if (Test-Path -LiteralPath "$live.bak-$Stamp") { $problems += "$rel : $live.bak-$Stamp already exists" }
}
if ($problems.Count) {
  Write-Host 'ABORT - nothing was touched:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  return
}
Write-Host "guards OK (stamp $Stamp, app $app)" -ForegroundColor Green
if ($DryRun) { Write-Host 'DRY RUN - stopping before the swap.'; return }

$manifest = [ordered]@{ stamp = $Stamp; when = (Get-Date).ToString('s'); app = $app; files = [ordered]@{} }
function Swap([string]$rel) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  $want = Get-Sha $stg
  $before = Get-Sha $live
  Copy-Item -LiteralPath $live -Destination "$live.bak-$Stamp"
  if ((Get-Sha "$live.bak-$Stamp") -ne $before) { throw "$rel : backup hash mismatch" }
  $tmp = "$live.deploy-tmp"
  Copy-Item -LiteralPath $stg -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $want) { throw "$rel : temp copy hash mismatch" }
  Move-Atomic $tmp $live
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  $after = Get-Sha $live
  if ($after -ne $want) { throw "$rel : LIVE hash after the swap is $after, expected $want" }
  $manifest.files[$rel] = [ordered]@{ before = $before; after = $after; bak = "$rel.bak-$Stamp" }
  Write-Host ("  swapped {0,-12} {1} -> {2}" -f $rel, $before.Substring(0, 8), $after.Substring(0, 8)) -ForegroundColor Green
}
foreach ($rel in $modified) { Swap $rel }

$dir = Join-Path $here "deploy\$Stamp"
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText("$dir\manifest.json", ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "manifest: $dir\manifest.json"
Write-Host 'DEPLOYED.' -ForegroundColor Green
