# =============================================================================
# Run the DB_DUMP destination column-typing tests.
#
#   powershell -File run.ps1
#
# Lifts db_dump_resolve_column_types() / infer_db_dump_column_types() /
# db_dump_type_from_meta() out of the LIVE schedule_runner.php and exercises
# them in isolation. READ-ONLY: no database, no network, nothing written back
# to the app directory.
#
# Guards two contracts:
#   - rows-present: the column SET and ORDER belong to the rows, metadata
#     contributes TYPES only. $rows at the call site is already narrowed by the
#     task's column mode while $columns_meta is not, so a metadata-owned set
#     would resurrect excluded columns as all-NULL. Order matters too - the
#     caller detects schema drift with !== on the column-name array.
#   - metadata-only ($allow_meta_only): resolve a full column set with no rows,
#     the precondition for batched/streaming DB_DUMP, which must CREATE the
#     destination before reading a row.
#
# -n (skip php.ini) because from a workstation the ini fails to load
# oci8/pdo_oci/sqlsrv; nothing here needs an extension, and this harness prints
# no timestamps so the UTC side effect of -n is irrelevant.
#
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0".
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dbdumptypes' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'

& $php -n (Join-Path $here 'test_dbdumptypes.php') $app
exit $LASTEXITCODE
