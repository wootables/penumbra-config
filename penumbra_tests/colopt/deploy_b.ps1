# =============================================================================
# DEPLOY - colopt b (2026-10-12): the summary in the column options popover, the cog in
# the summary lane, the badges of what is set at the row's end
#
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 [-Stamp S] [-DryRun] [-App <scratch app copy>]
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 -Stamp S -Rollback     put the .bak-S files back
#
# <dir> holds the staged build in the app's layout. orig.sha256 lists the LIVE hashes
# the stage was cut from (sha256sum format, matched by relative path's file name).
# No new file. The cheap rollback of the whole column-options feature (v1 and b) stays
# an empty js/penumbra_colfmt.off (the old chips come back, summary chip included).
#
# The atomic-deploy recipe: every live file must still hash to what the stage was cut
# from (another session may have deployed meanwhile - then NOTHING is touched:
# re-stage by 3-way merge from a fresh live copy), and no backup of this stamp may
# exist yet. Then per file: live -> live.bak-<stamp> (hash-verified), stage ->
# live.deploy-tmp (hash-verified), kernel32 MoveFileEx(tmp, live, REPLACE_EXISTING),
# retried on sharing violations, LastWriteTime = now (?v=filemtime cache-busts),
# live hash verified.
# Order: the module (an old main.js passes it no summary: its popover is as before),
# then help_content.php, css\main.css and js\main.js.
#
# The \\oitras share is RemoteSigned: run it as a scriptblock, not with -File:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<this file>'))) -Stage ... -Expect ... -DryRun
# Writes deploy\<stamp>\manifest.json beside this script (hashes before/after).
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Expect,
      [string]$Stamp = '', [switch]$DryRun, [switch]$Rollback, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colopt' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
if (-not $Stamp) {
  if ($Rollback) { throw '-Rollback needs the -Stamp of the deploy to undo' }
  $Stamp = (Get-Date).ToString('yyyyMMdd-HHmm') + '-coloptb'
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

$new = @()
$helpers = @('js/penumbra_colfmt.js')
$consumers = @('help_content.php', 'css/main.css', 'js/main.js')
$all = $helpers + $consumers
$expectMap = @{}
foreach ($line in [IO.File]::ReadAllLines($Expect)) {
  if ($line -match '^([0-9a-f]{64}) +\*?(.+)$') { $expectMap[($Matches[2].Trim() -replace '\\', '/')] = $Matches[1] }
}

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $all) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  $isNew = $new -contains $rel
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged" ; continue }
  if ($isNew) {
    if ($Rollback) {
      if (-not (Test-Path -LiteralPath $live)) { $problems += "$rel : not live - nothing to take away" }
      elseif ((Get-Sha $live) -ne (Get-Sha $stg)) { $problems += "$rel : live is not this deploy's - not removing it" }
    } elseif (Test-Path -LiteralPath $live) { $problems += "$rel : already exists live (a NEW file) - look before overwriting" }
  } else {
    if (-not $expectMap.ContainsKey($rel)) { $problems += "$rel : no expected hash in $Expect" ; continue }
    $h = Get-Sha $live
    if ($Rollback) {
      if ($h -ne (Get-Sha $stg)) { $problems += "$rel : live ($($h.Substring(0,12))) is not this deploy - not rolling back over it" }
      if (-not (Test-Path -LiteralPath "$live.bak-$Stamp")) { $problems += "$rel : no $live.bak-$Stamp" }
      elseif ((Get-Sha "$live.bak-$Stamp") -ne $expectMap[$rel]) { $problems += "$rel : the .bak does not hash to the pre-deploy hash" }
    } else {
      if ($h -ne $expectMap[$rel]) { $problems += "$rel : LIVE CHANGED since staging (live $($h.Substring(0,12)), staged from $($expectMap[$rel].Substring(0,12))) - re-stage" }
      if (Test-Path -LiteralPath "$live.bak-$Stamp") { $problems += "$rel : $live.bak-$Stamp already exists" }
    }
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
  $isNew = $new -contains $rel
  if ($Rollback -and $isNew) {
    $before = Get-Sha $live
    $gone = "$live.rolledback-$Stamp"
    Move-Atomic $live $gone   # kept beside it, not deleted
    $manifest.files[$rel] = [ordered]@{ before = $before; after = 'removed'; kept = "$rel.rolledback-$Stamp" }
    Write-Host ("  removed {0,-22} (kept as .rolledback-{1})" -f $rel, $Stamp) -ForegroundColor Green
    return
  }
  $src = if ($Rollback) { "$live.bak-$Stamp" } else { $stg }
  $want = Get-Sha $src
  $before = if (Test-Path -LiteralPath $live) { Get-Sha $live } else { 'absent' }
  if (-not $Rollback -and -not $isNew) {
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
  $manifest.files[$rel] = [ordered]@{ before = $before; after = $after; bak = $(if ($isNew) { $null } else { "$rel.bak-$Stamp" }) }
  Write-Host ("  swapped {0,-22} {1} -> {2}" -f $rel, $before.Substring(0, [Math]::Min(8, $before.Length)), $after.Substring(0, 8)) -ForegroundColor Green
}
foreach ($rel in $helpers) { Swap $rel }
Start-Sleep -Seconds 3
foreach ($rel in $consumers) { Swap $rel }

$dir = Join-Path $here ("deploy\$Stamp" + $(if ($Rollback) { '-rollback' } else { '' }))
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText("$dir\manifest.json", ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "manifest: $dir\manifest.json"
Write-Host $(if ($Rollback) { 'ROLLED BACK.' } else { 'DEPLOYED. Users pick it up on reload (?v=filemtime).' }) -ForegroundColor Green
