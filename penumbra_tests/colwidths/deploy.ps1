# =============================================================================
# DEPLOY - flat-table column widths (2026-09-24)
#
#   deploy.ps1 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun]                round 1 (2026-09-25)
#   deploy.ps1 -Round 2 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun]      round 2 (built 2026-09-30): the
#       grouped view + pivot row labels - every file already exists, so all six are MODIFIED
#   deploy.ps1 -Round 3 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun]      round 3 (built 2026-10-01): a
#       pivot's value column while it has only one - five files MODIFIED, index.php untouched
#   deploy.ps1 -Round 4 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun]      round 4 (built 2026-10-01): a
#       one-row header's value columns, one width together - four files MODIFIED (the module, its
#       stylesheet, help_content.php, README.md); main.js and index.php untouched
#   deploy.ps1 -Round 5 -Stage <dir> -Expect <dir>\orig.sha256 [-DryRun]      round 5 (built 2026-10-01): a
#       two-row header's groups and leaves - five files MODIFIED (main.js: the 16px value minimum),
#       index.php untouched
#
# <dir> holds the staged build in the app's layout: js\main.js, index.php,
# help_content.php, README.md (modified) and js\penumbra_colwidths.js,
# css\penumbra_colwidths.css (new). orig.sha256 lists the LIVE hashes the stage
# was cut from (sha256sum format, relative paths).
#
# The atomic-deploy recipe: every live file must still hash to what the stage
# was cut from (another session may have deployed meanwhile - then NOTHING is
# touched: re-stage with `patch_colwidths.py forward <live copy> <stage>`), no
# backup of this stamp may exist yet, the new files must not exist yet. Then per
# file: live -> live.bak-<stamp> (hash-verified), stage -> live.deploy-tmp
# (hash-verified), kernel32 MoveFileEx(tmp, live, REPLACE_EXISTING) - one atomic
# rename, the destination untouched on failure - retried on sharing violations,
# LastWriteTime = now, live hash verified. Order: the two new files (nothing
# references them yet) and the docs, 3 s, main.js (its state layer is inert
# without the module), then index.php, which starts loading the module.
# Every mixed state in between is harmless: an old index.php never loads the
# module; a new one with an old main.js loads a module that finds no host and
# stays inert.
#
# Writes deploy\<stamp>\manifest.json beside this script: the hashes before and
# after, which rollback.ps1 reads.
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stage, [Parameter(Mandatory = $true)][string]$Expect, [int]$Round = 1,
      [string]$Stamp = '', [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colwidths' }
# -App: rehearse against a scratch copy of the app folder.
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
if (-not $Stamp) { $Stamp = (Get-Date).ToString('yyyyMMdd') + $(if ($Round -ge 2) { "-colwidths$Round" } else { '-colwidths' }) }

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

$modified = @('js/main.js', 'index.php', 'help_content.php', 'README.md')
$created  = @('js/penumbra_colwidths.js', 'css/penumbra_colwidths.css')
# Swap order; '|' = a 3 s pause. Round 1: the two NEW files (nothing references
# them yet) and the docs, then main.js (its state layer is inert without the
# module), then index.php, which starts loading the module. Round 2 swaps the
# module and its stylesheet IN PLACE: stylesheet + docs, then main.js (the new
# pivot accessors are unused by the old module), then the module (it copes with
# an older main.js: no pivot accessors = no pivot widths), then index.php (the
# views switch attribute is ignored by the old module). Every mixed state in
# between is harmless.
$order = @('js/penumbra_colwidths.js', 'css/penumbra_colwidths.css', 'help_content.php', 'README.md', '|', 'js/main.js', 'index.php')
if ($Round -eq 2) {
  $modified = @('js/main.js', 'index.php', 'help_content.php', 'README.md', 'js/penumbra_colwidths.js', 'css/penumbra_colwidths.css')
  $created  = @()
  $order    = @('css/penumbra_colwidths.css', 'help_content.php', 'README.md', '|', 'js/main.js', 'js/penumbra_colwidths.js', 'index.php')
}
# Round 3 leaves index.php alone. The stylesheet first (its new grip rule asks
# for a mark only the new module sets), the docs, then main.js (the new value
# field accessor is unused by the old module), then the module (it copes with an
# older main.js: no accessor = no value column widths).
if ($Round -eq 3) {
  $modified = @('js/main.js', 'help_content.php', 'README.md', 'js/penumbra_colwidths.js', 'css/penumbra_colwidths.css')
  $created  = @()
  $order    = @('css/penumbra_colwidths.css', 'help_content.php', 'README.md', '|', 'js/main.js', 'js/penumbra_colwidths.js')
}
# Round 4 touches neither main.js (the round-3 accessor serves) nor index.php:
# the stylesheet (comments only) and the docs, then the module.
if ($Round -eq 4) {
  $modified = @('help_content.php', 'README.md', 'js/penumbra_colwidths.js', 'css/penumbra_colwidths.css')
  $created  = @()
  $order    = @('css/penumbra_colwidths.css', 'help_content.php', 'README.md', '|', 'js/penumbra_colwidths.js')
}
# Round 5: the stylesheet (its new grips ask for a mark only the new module
# sets) and the docs, then main.js (the 16px value minimum and host.minValue,
# unused by the old module), then the module (it copes with an older main.js:
# no minValue = 40px as before).
if ($Round -eq 5) {
  $modified = @('js/main.js', 'help_content.php', 'README.md', 'js/penumbra_colwidths.js', 'css/penumbra_colwidths.css')
  $created  = @()
  $order    = @('css/penumbra_colwidths.css', 'help_content.php', 'README.md', '|', 'js/main.js', 'js/penumbra_colwidths.js')
}
$expectMap = @{}
foreach ($line in [IO.File]::ReadAllLines($Expect)) {
  if ($line -match '^([0-9a-f]{64}) \*?(.+)$') { $expectMap[$Matches[2].Trim()] = $Matches[1] }
}

# ---- guards: all of them before a single byte moves ----------------------------
$problems = @()
foreach ($rel in $modified) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  if (-not $expectMap.ContainsKey($rel)) { $problems += "$rel : no expected hash in $Expect" ; continue }
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged" ; continue }
  $h = Get-Sha $live
  if ($h -ne $expectMap[$rel]) { $problems += "$rel : LIVE CHANGED since staging (live $($h.Substring(0,12)), staged from $($expectMap[$rel].Substring(0,12))) - re-stage" }
  if (Test-Path -LiteralPath "$live.bak-$Stamp") { $problems += "$rel : $live.bak-$Stamp already exists" }
}
foreach ($rel in $created) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $stg)) { $problems += "$rel : not staged" }
  if (Test-Path -LiteralPath $live) { $problems += "$rel : already exists live" }
}
foreach ($rel in @('index.php', 'help_content.php')) {
  $l = (& $php -n -l (Join-Path $Stage $rel)) -join ' '
  if ($l -notmatch 'No syntax errors') { $problems += "$rel : php -l on the stage: $l" }
}
if ($problems.Count) {
  Write-Host 'ABORT - nothing was touched:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  return
}
Write-Host "guards OK (stamp $Stamp)" -ForegroundColor Green
if ($DryRun) { Write-Host 'DRY RUN - stopping before the swap.'; return }

$manifest = [ordered]@{ stamp = $Stamp; round = $Round; when = (Get-Date).ToString('s'); files = [ordered]@{} }
function Swap([string]$rel, [bool]$isNew) {
  $live = Join-Path $app ($rel -replace '/', '\'); $stg = Join-Path $Stage ($rel -replace '/', '\')
  $want = Get-Sha $stg
  $before = $null
  if (-not $isNew) {
    $before = Get-Sha $live
    Copy-Item -LiteralPath $live -Destination "$live.bak-$Stamp"
    if ((Get-Sha "$live.bak-$Stamp") -ne $before) { throw "$rel : backup hash mismatch" }
  }
  $tmp = "$live.deploy-tmp"
  Copy-Item -LiteralPath $stg -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $want) { throw "$rel : temp copy hash mismatch" }
  Move-Atomic $tmp $live
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  $after = Get-Sha $live
  if ($after -ne $want) { throw "$rel : LIVE hash after the swap is $after, expected $want" }
  $manifest.files[$rel] = [ordered]@{ new = $isNew; before = $before; after = $after; bak = $(if ($isNew) { $null } else { "$rel.bak-$Stamp" }) }
  Write-Host ("  swapped {0,-28} {1} -> {2}" -f $rel, $(if ($before) { $before.Substring(0, 8) } else { '(new)   ' }), $after.Substring(0, 8)) -ForegroundColor Green
}

foreach ($rel in $order) {
  if ($rel -eq '|') { Start-Sleep -Seconds 3; continue }
  Swap $rel ($created -contains $rel)
}

$dir = Join-Path $here "deploy\$Stamp"
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText("$dir\manifest.json", ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "manifest: $dir\manifest.json"
foreach ($rel in @('index.php', 'help_content.php')) { Write-Host ('  live php -l: ' + ((& $php -n -l (Join-Path $app $rel)) -join ' ')) }
Write-Host 'DEPLOYED. Switch-off without a deploy: rollback.ps1 -Disable' -ForegroundColor Green
