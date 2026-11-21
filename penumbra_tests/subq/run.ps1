# =============================================================================
# Run the cross-database [SUBQUERY] / [CTE_SUBQUERY] tag tests (subqsweep, 2026-11-19).
#
#   powershell -File run.ps1                 # against the live webroot
#   powershell -File run.ps1 -App <dir>      # against a staged app tree
#   powershell -File run.ps1 -Control        # must report FAIL 1
#   powershell -File run.ps1 -Mutants        # every mutant must BITE (12/12)
#
# The real functions are lifted by tokenizer from db_connection.php and
# shared_logic.php; executeSubqueryLogic runs end to end against fake Oracle and
# SQL Server connections that obey the row limits written into the SQL. See the
# header of test_subq.php for what each section covers.
#
# EXPECTED TAIL: "PASS 80   FAIL 0" (with -Mutants: "MUTANTS 12/12 BITE").
# =============================================================================
param([string]$App = '', [switch]$Control, [switch]$Mutants)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_penumbra\penumbra_tests\subq' }
$php  = '\\oitras\d$\Utilities\PHP_penumbra\php.exe'
$phpArgs = @('-n', (Join-Path $here 'test_subq.php'))
if ($App -ne '') { $phpArgs += "--app=$App" }
if ($Control) { $phpArgs += '--control' }
if ($Mutants) { $phpArgs += '--mutants' }
& $php @phpArgs
exit $LASTEXITCODE
