# =============================================================================
# FILTER WORDING deploy (2026-10-19): the "search box" is the "filter box" in every
# user-facing word. 43 files, text only (main.js: string literals + the Rows card's
# count-text regex). Run ONLY with the user's go-ahead.
#
# Before running: re-cut live and re-apply the patch (live moves often):
#   1. copy the 43 paths in CHANGED_FILES.txt (+ help\ask.php, help\loader.php, help_ask.php,
#      help_content.php, help_manifest.php, help_retrieval.php for the lint) to <kit>\orig2
#   2. py -3 patch.py orig2 stage2             (phrase edits + prose hunks; anchors exact)
#      php -n helpv2\gen_snippets_help.php --app stage2   (the generated reference topic)
#   3. prove: the sorted +/- lines of orig->stage == orig2->stage2 (optionsHelpLightbox's
#      sha header may differ if live's snippets.php moved), filterword run.py --app stage2
#      GREEN, lint_help on stage2 = orig2's result, php -l, skeleton (main.js)
#   4. this script with -From orig2 -Set stage2 -DryRun, then without -DryRun
#
# Guards (ALL files, before any write): live sha == its staged-from copy (-From) and != the
# stage (-Set); git status clean for every path, nothing staged; no .deploy-tmp. Per file:
# copy -> .deploy-tmp, verify, RE-CHECK live right before MoveFileEx(REPLACE_EXISTING),
# LastWriteTime = now (index.php versions the scripts and styles by filemtime), verify.
# Order: help -> endpoints -> modules -> main.js -> index.php LAST. Waits out a scheduler
# tick (minute % 5 == 2, :15..:50) before schedule_runner.php.
#   & ([scriptblock]::Create([IO.File]::ReadAllText('<kit>\deploy.ps1'))) -From orig2 -Set stage2 -DryRun
# =============================================================================
param([switch]$DryRun, [string]$From = 'orig', [string]$Set = 'stage')
$ErrorActionPreference = 'Stop'
$KitDir  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\filterword'
$SetDir  = Join-Path $KitDir $Set
$FromDir = Join-Path $KitDir $From
$LiveDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$env:GIT_DIR = '//oitras.oit.ncsu.edu/d$/Utilities/penumbra_git'
$env:GIT_WORK_TREE = '//oitras.oit.ncsu.edu/c$/inetpub/wwwroot/sponsor_migration/penumbra'

$all = [IO.File]::ReadAllLines((Join-Path $KitDir 'CHANGED_FILES.txt')) | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() -replace '/', '\' }
$first = @($all | Where-Object { $_ -like 'help\*' })
$mid   = @('ai_system_prompt.php', 'manage_journal.php', 'schedule_runner.php', 'search_builder_content.php',
           'js\search_builder.js', 'js\penumbra_find.js', 'js\penumbra_colmenu.js', 'js\penumbra_grouplist.js',
           'js\penumbra_tiles.js', 'js\penumbra_bulkset.js', 'js\penumbra_dashboard.js', 'js\main.js')
$Order = @($first) + $mid + @('index.php')
$missing = @($all | Where-Object { $Order -notcontains $_ })
if ($missing.Count -or $Order.Count -ne $all.Count) { Write-Host "ORDER does not cover CHANGED_FILES.txt: $($missing -join ', ')  (order $($Order.Count) vs $($all.Count))"; Write-Host 'NOTHING WRITTEN'; return }

function Get-Sha([string]$p) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash.ToLower() }

# ---- guards -------------------------------------------------------------------
$bad = @()
foreach ($rel in $Order) {
  $live = Join-Path $LiveDir $rel; $setF = Join-Path $SetDir $rel; $fromF = Join-Path $FromDir $rel
  if (-not (Test-Path -LiteralPath $setF)) { $bad += "missing in the stage: $rel"; continue }
  if (Test-Path -LiteralPath ($live + '.deploy-tmp')) { $bad += "a .deploy-tmp is there: $rel" }
  if (-not (Test-Path -LiteralPath $live) -or -not (Test-Path -LiteralPath $fromF)) { $bad += "missing live or staged-from: $rel"; continue }
  if ((Get-Sha $live) -ne (Get-Sha $fromF)) { $bad += "live moved since the cut: $rel" }
  if ((Get-Sha $setF) -eq (Get-Sha $live)) { $bad += "the stage equals live: $rel" }
  $st = & git status --porcelain -- ($rel -replace '\\', '/')
  if ($LASTEXITCODE -ne 0) { $bad += "git status failed for $rel : $st" }
  elseif ("$st".Trim()) { $bad += "not clean in git: $rel ($st)" }
}
$cached = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { $bad += 'git diff --cached failed' }
elseif ("$cached".Trim()) { $bad += "something is already staged in git: $cached" }
if ($bad.Count) { $bad | ForEach-Object { Write-Host "GUARD FAIL  $_" }; Write-Host 'NOTHING WRITTEN'; return }
Write-Host ("GUARDS OK  {0} files: {1}" -f $Order.Count, ($Order -join ', '))
if ($DryRun) { Write-Host 'dry run: stopping before any write'; return }

if (-not ('PnbFilterDeploy.Mv' -as [type])) {
  Add-Type -Namespace PnbFilterDeploy -Name Mv -MemberDefinition '[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern bool MoveFileEx(string a, string b, int flags);'
}
foreach ($rel in $Order) {
  if ($rel -eq 'schedule_runner.php') {
    # the scheduler starts at :x2:15 / :x7:15 - swap its runner outside a tick
    while ((((Get-Date).Minute % 5) -eq 2) -and ((Get-Date).Second -ge 10) -and ((Get-Date).Second -le 55)) { Start-Sleep -Seconds 5 }
  }
  if ($rel -eq 'index.php') { Start-Sleep -Seconds 1 }
  $live = Join-Path $LiveDir $rel; $setF = Join-Path $SetDir $rel; $tmp = $live + '.deploy-tmp'
  [IO.File]::Copy($setF, $tmp, $true)
  if ((Get-Sha $tmp) -ne (Get-Sha $setF)) { [IO.File]::Delete($tmp); throw "tmp copy differs: $rel (stopped; the files before it are swapped)" }
  # right before the move: live still as the guard saw it? (other sessions deploy main.js / index.php / help)
  if ((Get-Sha $live) -ne (Get-Sha (Join-Path $FromDir $rel))) {
    [IO.File]::Delete($tmp); throw "live moved meanwhile: $rel (stopped; the files before it are swapped)"
  }
  $ok = $false
  for ($t = 0; $t -lt 20 -and -not $ok; $t++) {
    $ok = [PnbFilterDeploy.Mv]::MoveFileEx($tmp, $live, 1)
    if (-not $ok) { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ok) { throw "MoveFileEx failed for $rel (error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())); the tmp is left at $tmp" }
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  if ((Get-Sha $live) -ne (Get-Sha $setF)) { throw "live differs from the stage after the swap: $rel" }
  Write-Host ('{0}  swapped {1}' -f (Get-Date -Format 'HH:mm:ss'), $rel)
}
Write-Host 'DEPLOYED'
