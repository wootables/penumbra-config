# =============================================================================
# Failure-notice receipt suite (2026-10-03): the runner writes who the failure
# email went to into the audit row; the health hub's Failures card reads it.
#
#   powershell -File run.ps1                 against LIVE
#   powershell -File run.ps1 -App <dir>      against a staged copy (needs
#                                            schedule_runner.php, penumbra_health.php,
#                                            health.php, penumbra_email_shell.php,
#                                            analytics_all.php, analytics_shared.php)
#   powershell -File run.ps1 -Control        must report fail=1
#   powershell -File run.ps1 -Mutant 1       receipt never merged: 12 RED
#   powershell -File run.ps1 -Mutant 2       JSON guard keeps 'to': exactly 1 RED
#   powershell -File run.ps1 -Mutant 3       send after insert again: 12 RED
#   powershell -File run.ps1 -Mutant 4       shared text leaks addresses: 5 RED
#   powershell -File run.ps1 -Mutant 5       feed leaks addresses: 2 RED
#
# Nothing is sent and nothing touches Oracle: mail() and execClobInsert() are
# recorders in test_notice.php. Run as a child process (it exits).
# =============================================================================
param([string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
      [switch]$Control, [int]$Mutant = 0)
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\notice' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$a = @('-n', '-d', 'date.timezone=America/New_York', (Join-Path $here 'test_notice.php'), "--app=$($App -replace '\\','/')")
if ($Control) { $a += '--control' }
if ($Mutant)  { $a += "--mutant=$Mutant" }
& $php @a
exit $LASTEXITCODE
