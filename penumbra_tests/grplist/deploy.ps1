# =============================================================================
# DEPLOY - the grouped view's List layout (2026-10-03, "grplist")
#
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 [-Stamp S] [-DryRun] [-App <scratch app copy>]
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 -Stamp S -Rollback     undo THIS deploy
#
# <dir> holds the staged build in the app's layout. MODIFIED: js\main.js,
# help_content.php, README.md, index.php (orig.sha256 lists the LIVE hashes the
# stage was cut from, sha256sum format, matched by relative path). NEW:
# js\penumbra_grouplist.js, css\penumbra_grouplist.css (must not exist live yet).
#
# The atomic-deploy recipe (README section 4): every modified live file must still
# hash to what the stage was cut from - another session may have deployed
# meanwhile; then NOTHING is touched (re-stage: grplist_patch.py forward on a fresh
# copy of live) - and no backup of this stamp may exist yet. Per file: live ->
# live.bak-<stamp> (hash-verified), stage -> live.deploy-tmp (hash-verified),
# kernel32 MoveFileEx(tmp, live, REPLACE_EXISTING) - one atomic rename, the
# destination untouched on failure - retried on sharing violations, LastWriteTime
# = now (?v=filemtime cache-busts), live hash verified.
# ORDER - safe at every instant: the two NEW files, then js\main.js,
# help_content.php, README.md, and index.php LAST (it is what starts loading the
# module; with the old main.js the module would only find no host and do nothing).
#
# -Rollback: every live file must hash to its STAGED hash (still this deploy);
# index.php FIRST back from its .bak (no page loads the module from then on), then
# the rest, and the two new files are renamed *.removed-<stamp> (never deleted).
# For taking the feature out AFTER other deploys landed on top, use
# rollback.ps1 -Restore instead (it reverses exactly these lines).
# Writes deploy\<stamp>[-rollback]\manifest.json under -Here.
# UNC: run the body as a scriptblock (the share is RemoteSigned):
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\grplist'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\deploy.ps1"))) -Stage ... -Expect ... -DryRun
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Expect,
      [string]$Stamp = '', [switch]$DryRun, [switch]$Rollback, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\grplist' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
if (-not $Stamp) {
  if ($Rollback) { throw '-Rollback needs the -Stamp of the deploy to undo' }
  $Stamp = (Get-Date).ToString('yyyyMMdd') + '-grplist'
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

$newFiles = @('css/penumbra_grouplist.css', 'js/penumbra_grouplist.js')
$modified = @('js/main.js', 'help_content.php', 'README.md', 'index.php')   # index.php LAST
$expectMap = @{}
foreach ($line in [IO.File]::ReadAllLines($Expect)) {
  if ($line -match '^([0-9a-f]{64}) +\*?(.+)$') { $expectMap[($Matches[2].Trim() -replace '\\', '/')] = $Matches[1] }
}
function P([string]$root, [string]$rel) { Join-Path $root ($rel -replace '/', '\') }

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $modified) {
  $live = P $app $rel; $stg = P $Stage $rel
  if (-not $expectMap.ContainsKey($rel)) { $problems += "$rel : no expected hash in $Expect"; continue }
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged"; continue }
  $h = Get-Sha $live
  if ($Rollback) {
    if ($h -ne (Get-Sha $stg)) { $problems += "$rel : live ($($h.Substring(0,12))) is not this deploy - use rollback.ps1 -Restore" }
    if (-not (Test-Path -LiteralPath "$live.bak-$Stamp")) { $problems += "$rel : no $live.bak-$Stamp" }
    elseif ((Get-Sha "$live.bak-$Stamp") -ne $expectMap[$rel]) { $problems += "$rel : the .bak does not hash to the pre-deploy hash" }
  } else {
    if ($h -ne $expectMap[$rel]) { $problems += "$rel : LIVE CHANGED since staging (live $($h.Substring(0,12)), staged from $($expectMap[$rel].Substring(0,12))) - re-stage" }
    if (Test-Path -LiteralPath "$live.bak-$Stamp") { $problems += "$rel : $live.bak-$Stamp already exists" }
  }
  if (Test-Path -LiteralPath "$live.deploy-tmp") { $problems += "$rel : a stale $live.deploy-tmp exists" }
}
foreach ($rel in $newFiles) {
  $live = P $app $rel; $stg = P $Stage $rel
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged"; continue }
  if ($Rollback) {
    if (-not (Test-Path -LiteralPath $live)) { $problems += "$rel : not live - nothing to take out" }
    elseif ((Get-Sha $live) -ne (Get-Sha $stg)) { $problems += "$rel : live is not this deploy's copy - use rollback.ps1 -Restore" }
  } else {
    if (Test-Path -LiteralPath $live) { $problems += "$rel : already exists live - refusing to overwrite a file this deploy did not create" }
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
function Put([string]$rel, [string]$src) {
  $live = P $app $rel
  $want = Get-Sha $src
  $before = if (Test-Path -LiteralPath $live) { Get-Sha $live } else { '' }
  $tmp = "$live.deploy-tmp"
  Copy-Item -LiteralPath $src -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $want) { throw "$rel : temp copy hash mismatch" }
  Move-Atomic $tmp $live
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  $after = Get-Sha $live
  if ($after -ne $want) { throw "$rel : LIVE hash after the swap is $after, expected $want" }
  $manifest.files[$rel] = [ordered]@{ before = $before; after = $after }
  Write-Host ("  put     {0,-28} {1} -> {2}" -f $rel, $(if ($before) { $before.Substring(0, 8) } else { '(new)   ' }), $after.Substring(0, 8)) -ForegroundColor Green
}
if (-not $Rollback) {
  foreach ($rel in $newFiles) { Put $rel (P $Stage $rel) }
  foreach ($rel in $modified) {
    $live = P $app $rel
    Copy-Item -LiteralPath $live -Destination "$live.bak-$Stamp"
    if ((Get-Sha "$live.bak-$Stamp") -ne $expectMap[$rel]) { throw "$rel : backup hash mismatch" }
    Put $rel (P $Stage $rel)
    $manifest.files[$rel].bak = "$rel.bak-$Stamp"
  }
} else {
  foreach ($rel in @('index.php', 'js/main.js', 'help_content.php', 'README.md')) { Put $rel ("$(P $app $rel).bak-$Stamp") }
  foreach ($rel in $newFiles) {
    $live = P $app $rel
    $dest = "$live.removed-$Stamp"
    Move-Atomic $live $dest
    $manifest.files[$rel] = [ordered]@{ removedTo = $dest }
    Write-Host "  removed $rel -> $(Split-Path $dest -Leaf)" -ForegroundColor Green
  }
}

$dir = Join-Path $here ("deploy\$Stamp" + $(if ($Rollback) { '-rollback' } else { '' }))
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText("$dir\manifest.json", ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "manifest: $dir\manifest.json"
Write-Host $(if ($Rollback) { 'ROLLED BACK.' } else { 'DEPLOYED. Users pick it up on reload (?v=filemtime).' }) -ForegroundColor Green
