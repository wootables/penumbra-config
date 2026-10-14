# =============================================================================
# Run the NDJSON stream-consumer tests.
#
#   powershell -File run.ps1
#
# Lifts penumbra_ndjson_feed/init/finish/usable out of the LIVE shared_logic.php
# and drives them the way curl does - arbitrary byte chunks that ignore line
# boundaries. READ-ONLY: no database, no network, nothing written to the app.
#
# WHAT IT GUARDS. A streaming DB_DUMP rebuilds a real Oracle table from these
# rows. HTTP returned 200 and the headers were gone long before a fetch could
# fail, so a clean socket close proves nothing about completeness. If the
# consumer ever calls a truncated stream usable, the dump swaps a SHORT table
# into place and the loss is silent. Section 2 is entirely that guard: no
# trailer, mid-line death, error line, trailer/row-count mismatch, missing
# head, and malformed lines must all come back NOT usable.
#
# -n (skip php.ini) because from a workstation the ini fails to load
# oci8/pdo_oci/sqlsrv; nothing here needs an extension.
#
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\ndjsonstream' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'

& $php -n (Join-Path $here 'test_ndjsonstream.php') $app
exit $LASTEXITCODE
