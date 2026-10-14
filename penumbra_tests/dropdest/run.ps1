# =============================================================================
# Run the DROP_FILE destination allow-list unit tests (added 2026-09-04).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control     # must report FAIL 1 - proves the
#                                         # harness can actually fail
#
# WHAT IS UNDER TEST. penumbraNormalizeDropPath() + penumbraDropDestinationError()
# in db_connection.php (lifted by tokenizer), and transport_unc() from the live
# plugins/file_transport.php exercised against a scratch directory - a write
# under the root lands, a sibling directory and a '..' escape are refused with
# nothing written, and no roots = refused. A TARGETED MUTANT breaks the
# path-segment boundary and must wrongly allow \\srv\share\drops2.
#
# -n (skip php.ini) because from a workstation the ini cannot load oci8/sqlsrv.
#
# EXPECTED TAIL: "PASS 52   FAIL 0". Any other tail is a failure, a smaller
# pass count included.
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dropdest' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'

# NOT $args - that is an automatic variable in PowerShell.
$phpArgs = @('-n', (Join-Path $here 'test_dropdest.php'))
if ($Control) { $phpArgs += '--control' }

& $php @phpArgs
exit $LASTEXITCODE
