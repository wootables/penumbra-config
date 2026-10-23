# =============================================================================
# DB_DUMP column-drop tests (2026-10-22): the runner prunes picked columns the
# report no longer returns, from the run AND the stored task, and leaves a
# dbdump_columns_dropped note for the task editor.
#
#   powershell -File run.ps1 [-App <path-to-penumbra>]
#
# READ-ONLY: lifts three helpers out of schedule_runner.php; the DB is stubbed.
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
# =============================================================================
param([string]$App = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dbdumpdrop' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
& $php -n (Join-Path $here 'test_dbdumpdrop.php') $App
exit $LASTEXITCODE
