# run.ps1 - control + mutant for the dashboard help panel's hub links (2026-10-16).
#
#   run.ps1 -Patched <penumbra_dashboard.js with the fix> -Unpatched <penumbra_dashboard.js without it> [-Out <dir>]
#
# Control = the patched file: T0..T5 all PASS. Mutant = the unpatched file (live before the deploy,
# or `git show <rev>:js/penumbra_dashboard.js` after it): T2 FAILS, the rest PASS. Prints a verdict
# per run and SUITE: GREEN only when both are as expected. Run from PowerShell (not Git Bash: UNC paths).
# The execution policy refuses .ps1 files on the share, so invoke the text as a scriptblock:
#   & ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashhelplinks\run.ps1'))) -Patched <f> -Unpatched <f> -Out <dir>
param([string]$Patched = '', [string]$Unpatched = '', [string]$Out = '')
$ErrorActionPreference = 'Stop'
if (-not $Patched -or -not $Unpatched) { throw 'usage: -Patched <file> -Unpatched <file> [-Out <dir>]' }
if (-not $Out) { $Out = Join-Path $env:TEMP ('dashhelplinks_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dashhelplinks' }
$engine = [scriptblock]::Create([IO.File]::ReadAllText((Join-Path $here 'dashhelp_harness.ps1')))
Write-Host "control: $Patched"
$c = & $engine -DashJs $Patched -Here $here -Out (Join-Path $Out 'control') | Out-String
Write-Host $c.TrimEnd()
Write-Host "mutant: $Unpatched"
$m = & $engine -DashJs $Unpatched -Here $here -Out (Join-Path $Out 'mutant') -ExpectMutant | Out-String
Write-Host $m.TrimEnd()
$ok = ($c -match 'RESULT: GREEN') -and ($m -match 'RESULT: GREEN')
Write-Host ('SUITE: ' + $(if ($ok) { 'GREEN' } else { 'RED' }) + " (output in $Out)")
