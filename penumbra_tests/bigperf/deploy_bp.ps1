# bigperf deploy (2026-10-19): main-thread blocking on large report pages, outside Find.
# Files: js\main.js and css\main.css (patch_bp.py re-applies to any live copy: recut.py),
# js\penumbra_a11y.js and js\penumbra_cellsel.js (whole copies; recut.py refuses if live
# moved). Each file's change stands alone, so any order is safe; main.js goes FIRST
# because it is the one other sessions deploy most: if it moved, nothing is written.
# Guards (ALL files, before any write): live sha == its staged-from copy (-From) and
# differs from the stage (-Set); git status clean for every path, nothing staged; no
# .deploy-tmp. Then per file: copy -> .deploy-tmp, verify, RE-CHECK live right before
# MoveFileEx(REPLACE_EXISTING), LastWriteTime = now (index.php versions the files by
# filemtime), verify. -DryRun stops after the guards.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\deploy_bp.ps1'))) -From orig3 -Set stage3 -DryRun
param([switch]$DryRun, [string]$From = 'orig3', [string]$Set = 'stage3')
$ErrorActionPreference = 'Stop'
$KitDir  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\bigperf'
$SetDir  = Join-Path $KitDir $Set
$FromDir = Join-Path $KitDir $From
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
$env:GIT_WORK_TREE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'
$Order = @('js\main.js', 'css\main.css', 'js\penumbra_a11y.js', 'js\penumbra_cellsel.js')

function Get-Sha([string]$p) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower() }

# ---- guards -------------------------------------------------------------------
$bad = @()
foreach ($rel in $Order) {
  $live = Join-Path $LiveDir $rel; $setf = Join-Path $SetDir $rel; $fromf = Join-Path $FromDir $rel
  if (-not (Test-Path -LiteralPath $setf)) { $bad += "missing in the stage: $rel"; continue }
  if (Test-Path -LiteralPath ($live + '.deploy-tmp')) { $bad += "a .deploy-tmp is there: $rel" }
  if (-not (Test-Path -LiteralPath $live) -or -not (Test-Path -LiteralPath $fromf)) { $bad += "missing live or staged-from: $rel"; continue }
  if ((Get-Sha $live) -ne (Get-Sha $fromf)) { $bad += "live moved since the cut: $rel (re-cut: recut.py)" }
  if ((Get-Sha $setf) -eq (Get-Sha $live)) { $bad += "the stage equals live: $rel" }
  $st = & git status --porcelain -- ($rel -replace '\\', '/')
  if ($LASTEXITCODE -ne 0) { $bad += "git status failed for $rel : $st" }
  elseif ("$st".Trim()) { $bad += "not clean in git: $rel ($st)" }
}
$cached = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { $bad += 'git diff --cached failed' }
elseif ("$cached".Trim()) { $bad += "something is already staged in git: $cached" }
if ($bad.Count) { $bad | ForEach-Object { Write-Host "GUARD FAIL  $_" }; Write-Host 'NOTHING WRITTEN'; return }
Write-Host ('GUARDS OK  ' + ($Order -join ', '))
if ($DryRun) { Write-Host 'dry run: stopping before any write'; return }

if (-not ('PnbBpDeploy.Mv' -as [type])) {
  Add-Type -Namespace PnbBpDeploy -Name Mv -MemberDefinition '[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool MoveFileEx(string a, string b, int flags);'
}
foreach ($rel in $Order) {
  $live = Join-Path $LiveDir $rel; $setf = Join-Path $SetDir $rel; $tmp = $live + '.deploy-tmp'
  [IO.File]::Copy($setf, $tmp, $true)
  if ((Get-Sha $tmp) -ne (Get-Sha $setf)) { [IO.File]::Delete($tmp); throw "tmp copy differs: $rel (stopped; the files before it are swapped)" }
  # right before the move: live still as the guard saw it? (other sessions deploy main.js often)
  if ((Get-Sha $live) -ne (Get-Sha (Join-Path $FromDir $rel))) {
    [IO.File]::Delete($tmp); throw "live moved meanwhile: $rel (stopped; the files before it are swapped)"
  }
  $ok = $false
  for ($t = 0; $t -lt 20 -and -not $ok; $t++) {
    $ok = [PnbBpDeploy.Mv]::MoveFileEx($tmp, $live, 1)
    if (-not $ok) { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ok) { throw "MoveFileEx failed for $rel (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())); the tmp is left at $tmp" }
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  if ((Get-Sha $live) -ne (Get-Sha $setf)) { throw "live differs from the stage after the swap: $rel" }
  Write-Host ('{0}  swapped {1}' -f (Get-Date -Format 'HH:mm:ss'), $rel)
}
Write-Host 'DEPLOYED'
