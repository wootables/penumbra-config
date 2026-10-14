# =============================================================================
# Notice / maintenance SCOPE suite (2026-10-11): the "Applies to" dropdowns on
# system_notice.php - All Reports / By connection(s) / By tag(s) / By report(s).
#
#   powershell -File run.ps1                 against LIVE
#   powershell -File run.ps1 -App <dir>      against a staged copy (needs
#                                            penumbra_notice.php, system_notice.php,
#                                            index.php, query.php,
#                                            penumbra_admin_chrome.php)
#   powershell -File run.ps1 -Control        must report fail=1
#   powershell -File run.ps1 -Mutant 1       early gate ignores scope: 4 RED
#   powershell -File run.ps1 -Mutant 2       save forgets the live scope: 5 RED
#   powershell -File run.ps1 -Mutant 3       empty scoped half matches all: 2 RED
#   powershell -File run.ps1 -Mutant 4       case-sensitive tag/conn match: 5 RED
#   powershell -File run.ps1 -Mutant 5       posted scope reads every list: 1 RED
#
# EXPECTED: "SUMMARY  pass=85  fail=0" (2026-10-11).
# No database, no mail; the state file is a temp file. Section G lifts
# mon_sync_notice() from the live penumbra_monitor.php.
# mbstring is loaded explicitly with a RELATIVE extension_dir, so php runs
# from the PHP folder (a UNC extension_dir gets mangled).
# UNC .ps1 files may be GPO-blocked: run the body as a scriptblock, or a local copy.
# =============================================================================
param([string]$App = '\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
      [switch]$Control, [int]$Mutant = 0)
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\noticescope' }
$phpDir = '\oitras\d$\Utilities\PHP_8.2-p'
$php  = Join-Path $phpDir 'php.exe'
$a = @('-n', '-d', 'extension_dir=ext', '-d', 'extension=php_mbstring.dll', '-d', 'date.timezone=America/New_York',
       (Join-Path $here 'test_noticescope.php'), "--app=$($App -replace '\','/')")
if ($Control) { $a += '--control' }
if ($Mutant)  { $a += "--mutant=$Mutant" }
Push-Location $phpDir
try { & $php @a } finally { Pop-Location }
