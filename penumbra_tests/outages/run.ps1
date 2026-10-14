# =============================================================================
# Run the outage-ledger unit tests (penumbra_health.php availability history).
#
#   powershell -File run.ps1
#
# The tests EXTRACT the OUTAGE HISTORY block out of the live penumbra_health.php
# and run that - never a copy. A test of a pasted copy proves the copy works.
# The only thing stubbed is penumbra_health_cache_file(), which decides where
# the ledger file lands; it is redirected to a scratch dir so a test run can
# never touch D:\Utilities\PHP_8.2-p\logs\penumbra_outages.json.
#
# -n (skip php.ini) because from a workstation the ini fails to load
# oci8/pdo_oci/sqlsrv - those client libraries exist only on the server. Unlike
# the notice suite this needs no extension staged: the code under test uses only
# json/preg/date, all of which are built in.
#
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0". Any other tail is a failure.
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\outages' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$src  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra\penumbra_health.php'

& $php -n (Join-Path $here 'test_outages.php') $src
exit $LASTEXITCODE
