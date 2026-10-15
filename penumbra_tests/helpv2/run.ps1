# =============================================================================
# HELP CENTER v2 SUITE (2026-10-14) - thin PowerShell wrapper around run.php
#
#   run.ps1                          the LIVE webroot as both app and orig (after the deploy)
#   run.ps1 -App <stage> -Orig <dir> a stage build against the v1 files in <dir>
#   run.ps1 ... -Mutants             also run the nine mutants (the suite's control)
#   run.ps1 ... -SkipCoverage        skip the coverage map (it is report-only anyway)
#   -Out <dir>                       scratch dir (renders, caches, coverage_report.md)
#
# What it checks (see run.php for the ids): L1-L13 structural lint of help/ and its
# consumers, E0-E7 v1/v2 render equivalence + the audience gate matrix, R1-R5 the AI
# help retrieval over the fragments; the coverage map is printed, never red.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpv2'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Writes nothing to the webroot.
# =============================================================================
param([string]$App = '', [string]$Orig = '', [string]$Live = '', [string]$Out = '', [string]$Here = '',
      [switch]$Mutants, [switch]$SkipCoverage)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\helpv2' }
$webroot = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
if (-not $App)  { $App = $webroot }
if (-not $Orig) { $Orig = $App }
if (-not $Live) { $Live = $webroot }
if (-not $Out)  { $Out = Join-Path $env:TEMP ('helpv2_' + (Get-Date -Format 'yyyyMMdd_HHmmss')) }
$argv = @('-n', "$here\run.php", "--app=$App", "--orig=$Orig", "--live=$Live", "--out=$Out", "--php=$php")
if ($Mutants)      { $argv += '--mutants' }
if ($SkipCoverage) { $argv += '--skip-coverage' }
& $php @argv
Write-Host "scratch: $Out"
