# find tip wording (2026-10-20): the (i) words start with "Highlights" and say Find reaches other
# pages. File: js\penumbra_find.js (a whole new copy).
# Guards (ALL files, before any write): live sha == its staged-from copy (-From, a cut of
# live) and differs from the stage; git status clean for every path, nothing staged; no
# .deploy-tmp; no penumbra_find.off. Then per file: copy -> .deploy-tmp, verify, RE-CHECK
# live right before MoveFileEx(REPLACE_EXISTING), LastWriteTime = now (index.php versions
# the module and its css by filemtime), verify.
# -DryRun stops after the guards.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\deploy8.ps1'))) -DryRun
param([switch]$DryRun, [string]$From = 'orig12', [string]$Set = 'stage12')
$ErrorActionPreference = 'Stop'
$KitDir  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\find'
$SetDir  = Join-Path $KitDir $Set
$FromDir = Join-Path $KitDir $From
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
  # right before the move: live still as the guard saw it? (other sessions deploy too)
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
