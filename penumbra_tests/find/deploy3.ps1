# find round 2b deploy (2026-10-19): the bar follows a band that moves after the List pick (the crumb).
# Adapted from round 2's script: Find in the grouped view (Stacked + List) and the
# pivot; the bar moves off the current match; Filter is not offered for a term the
# search already holds; a group name's outline. Three files, all already live:
# css\penumbra_find.css, js\penumbra_find.js, help\topics\searchHelpLightbox.php
# (main.js and index.php are untouched in round 2).
# Guards (ALL files, before any write): live sha == its staged-from copy (orig5, cut
# 14:25 == what round 1 deployed) and differs from the stage; git status clean for
# every path and nothing staged in git; no .deploy-tmp left; no penumbra_find.off.
# Then per file: copy -> <live>.deploy-tmp, verify, RE-CHECK live right before the move,
# MoveFileEx(REPLACE_EXISTING), LastWriteTime = now (index.php versions both assets
# by filemtime), verify the live sha == the stage's. Order: css, js, help.
# -DryRun stops after the guards.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\deploy2.ps1'))) -DryRun
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$KitDir  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\find'
$SetDir  = Join-Path $KitDir 'stage6'
$FromDir = Join-Path $KitDir 'orig6'
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
$env:GIT_WORK_TREE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
$Order = @('js\penumbra_find.js')

function Get-Sha([string]$p) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower() }

# ---- guards -------------------------------------------------------------------
$bad = @()
foreach ($rel in $Order) {
  $live = Join-Path $LiveDir $rel; $set = Join-Path $SetDir $rel; $from = Join-Path $FromDir $rel
  if (-not (Test-Path -LiteralPath $set)) { $bad += "missing in the stage: $rel"; continue }
  if (Test-Path -LiteralPath ($live + '.deploy-tmp')) { $bad += "a .deploy-tmp is there: $rel" }
  if (-not (Test-Path -LiteralPath $live) -or -not (Test-Path -LiteralPath $from)) { $bad += "missing live or staged-from: $rel"; continue }
  if ((Get-Sha $live) -ne (Get-Sha $from)) { $bad += "live moved since the cut: $rel" }
  if ((Get-Sha $set) -eq (Get-Sha $live)) { $bad += "the stage equals live: $rel" }
  $st = & git status --porcelain -- ($rel -replace '\\', '/')
  if ($LASTEXITCODE -ne 0) { $bad += "git status failed for $rel : $st" }
  elseif ("$st".Trim()) { $bad += "not clean in git: $rel ($st)" }
}
$cached = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { $bad += 'git diff --cached failed' }
elseif ("$cached".Trim()) { $bad += "something is already staged in git: $cached" }
if (Test-Path -LiteralPath (Join-Path $LiveDir 'js\penumbra_find.off')) { $bad += 'js\penumbra_find.off exists live (the module is switched off)' }
if ($bad.Count) { $bad | ForEach-Object { Write-Host "GUARD FAIL  $_" }; Write-Host 'NOTHING WRITTEN'; return }
Write-Host ('GUARDS OK  ' + ($Order -join ', '))
if ($DryRun) { Write-Host 'dry run: stopping before any write'; return }

if (-not ('PnbFindDeploy.Mv' -as [type])) {
  Add-Type -Namespace PnbFindDeploy -Name Mv -MemberDefinition '[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool MoveFileEx(string a, string b, int flags);'
}
foreach ($rel in $Order) {
  $live = Join-Path $LiveDir $rel; $set = Join-Path $SetDir $rel; $tmp = $live + '.deploy-tmp'
  [IO.File]::Copy($set, $tmp, $true)
  if ((Get-Sha $tmp) -ne (Get-Sha $set)) { [IO.File]::Delete($tmp); throw "tmp copy differs: $rel (stopped; the files before it are swapped)" }
  # right before the move: live still as the guard saw it?
  if ((Get-Sha $live) -ne (Get-Sha (Join-Path $FromDir $rel))) {
    [IO.File]::Delete($tmp); throw "live moved meanwhile: $rel (stopped; the files before it are swapped)"
  }
  $ok = $false
  for ($t = 0; $t -lt 20 -and -not $ok; $t++) {
    $ok = [PnbFindDeploy.Mv]::MoveFileEx($tmp, $live, 1)
    if (-not $ok) { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ok) { throw "MoveFileEx failed for $rel (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())); the tmp is left at $tmp" }
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  if ((Get-Sha $live) -ne (Get-Sha $set)) { throw "live differs from the stage after the swap: $rel" }
  Write-Host ('{0}  swapped {1}' -f (Get-Date -Format 'HH:mm:ss'), $rel)
}
Write-Host 'DEPLOYED'
