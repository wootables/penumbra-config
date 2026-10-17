# run.ps1 - control + mutants for the Help Center deep-link anchor, #help=<topic>[:<anchor>] (2026-10-16).
#
#   run.ps1 -MainJs <stage main.js> -DashJs <stage penumbra_dashboard.js> [-OrigMainJs <f>] [-OrigDashJs <f>] [-Out <dir>]
#
# Five headless-Edge runs:
#   hash control   the STAGE main.js: H0..H14 all PASS
#   hash orig      the pre-change main.js (-OrigMainJs, default LIVE before the deploy; after it a
#                  `git show <rev>:js/main.js` copy): H2 H3 H4 H6 H7 H9 H10 H11 H12 FAIL, the rest PASS
#   hash mutant    made HERE from the stage: its openHelpCenter call hands '' instead of the parsed
#                  anchor (the parse is intact): H2 H3 H6 H10 H12 FAIL, the rest PASS
#   dash control   the STAGE penumbra_dashboard.js: D0..D8 all PASS
#   dash orig      the pre-change penumbra_dashboard.js (-OrigDashJs, default LIVE): D1 D5 D6 D7 FAIL
# Prints a verdict per run and SUITE: GREEN only when every run is as expected.
# Run from PowerShell (not Git Bash: UNC paths); the execution policy refuses .ps1 files on the share:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpanchor\run.ps1'))) -MainJs <f> -DashJs <f>
param([string]$MainJs = '', [string]$DashJs = '', [string]$OrigMainJs = '', [string]$OrigDashJs = '', [string]$Out = '')
$ErrorActionPreference = 'Stop'
$webroot = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $MainJs -or -not $DashJs) { throw 'usage: -MainJs <stage main.js> -DashJs <stage penumbra_dashboard.js> [-OrigMainJs <f>] [-OrigDashJs <f>] [-Out <dir>]' }
if (-not $OrigMainJs) { $OrigMainJs = "$webroot\js\main.js" }
if (-not $OrigDashJs) { $OrigDashJs = "$webroot\js\penumbra_dashboard.js" }
if (-not $Out) { $Out = Join-Path $env:TEMP ('helpanchor_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
New-Item -ItemType Directory -Force $Out | Out-Null
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpanchor' }
$hashEngine = [scriptblock]::Create([IO.File]::ReadAllText((Join-Path $here 'helphash_harness.ps1')))
$dashEngine = [scriptblock]::Create([IO.File]::ReadAllText((Join-Path $here 'dashanchor_harness.ps1')))
$all = $true

# The mutant: the stage's openHelpCenter call without the anchor (byte-exact; Latin-1 round-trips every byte, the NUL too).
$mutant = Join-Path $Out 'mutant_main.js'
$latin1 = [Text.Encoding]::GetEncoding(28591)
$text = $latin1.GetString([IO.File]::ReadAllBytes($MainJs))
$needle = "openHelpCenter(_helpOk ? _helpTopic : 'whatIsPenumbraLightbox', _helpAnchor, !_helpOk && !_helpAnchor)"
$n = ([regex]::Matches($text, [regex]::Escape($needle))).Count
if ($n -ne 1) {
  Write-Host "mutant: the stage's openHelpCenter call found $n times (expected 1) - is -MainJs the patched stage?"
  $all = $false
} else {
  [IO.File]::WriteAllBytes($mutant, $latin1.GetBytes($text.Replace($needle, "openHelpCenter(_helpOk ? _helpTopic : 'whatIsPenumbraLightbox', '', !_helpOk && !_helpAnchor)")))
}

Write-Host "hash control (stage): $MainJs"
$r = & $hashEngine -MainJs $MainJs -Here $here -Out (Join-Path $Out 'hash_control') | Out-String
Write-Host $r.TrimEnd(); $all = $all -and ($r -match 'RESULT: GREEN')
Write-Host "hash orig (pre-change): $OrigMainJs"
$r = & $hashEngine -MainJs $OrigMainJs -Here $here -Out (Join-Path $Out 'hash_orig') -MustFail 'H2,H3,H4,H6,H7,H9,H10,H11,H12' | Out-String
Write-Host $r.TrimEnd(); $all = $all -and ($r -match 'RESULT: GREEN')
if (Test-Path -LiteralPath $mutant) {
  Write-Host "hash mutant (anchor parsed, not handed on): $mutant"
  $r = & $hashEngine -MainJs $mutant -Here $here -Out (Join-Path $Out 'hash_mutant') -MustFail 'H2,H3,H6,H10,H12' | Out-String
  Write-Host $r.TrimEnd(); $all = $all -and ($r -match 'RESULT: GREEN')
}
Write-Host "dash control (stage): $DashJs"
$r = & $dashEngine -DashJs $DashJs -Here $here -Out (Join-Path $Out 'dash_control') | Out-String
Write-Host $r.TrimEnd(); $all = $all -and ($r -match 'RESULT: GREEN')
Write-Host "dash orig (pre-change): $OrigDashJs"
$r = & $dashEngine -DashJs $OrigDashJs -Here $here -Out (Join-Path $Out 'dash_orig') -MustFail 'D1,D5,D6,D7' | Out-String
Write-Host $r.TrimEnd(); $all = $all -and ($r -match 'RESULT: GREEN')
Write-Host ('SUITE: ' + $(if ($all) { 'GREEN' } else { 'RED' }) + " (output in $Out)")
