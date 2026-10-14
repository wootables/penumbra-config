# =============================================================================
# Run the [IMPORT] silent-truncation unit tests (added 2026-09-10).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control     # must report FAIL 1 - proves the
#                                         # harness can actually fail
#
# WHAT IS UNDER TEST. The two ./imports/ folder paths in query.php that used to
# array_slice() an oversize file down to PENUMBRA_IMPORT_MAX_ROWS and then
# PERSIST the short copy - the refresh path over the stored CLOB, the
# auto-create path into a new row - with no message to the user and no way to
# notice, since the folder is re-read every run. Both guards and the 400 gate
# are lifted from the live query.php by source anchor, so a rewrite that moves
# the code fails this suite loudly instead of quietly testing nothing.
#
# The gate calls exit, so it runs in a child php process. That child is
# GENERATED into local temp: cmd.exe refuses a UNC current directory and a UNC
# script argument does not survive the quoting, and either one yields an empty
# stdout that would read as a pass.
#
# It also covers resolveImportDataTags() in shared_logic.php - the last line of
# defence, whose row cap used to array_slice() directly above a byte check whose
# own comment reads "fail loud, never silently drop rows". That function is
# lifted by tokenizer WITH its helpers: the extractor does not follow
# require_once, so an unlifted helper kills the pass before assertion one.
#
# It also covers the [IMPORT] JSON row transport (2026-09-10): lane selection by
# generated-statement size, the mssql / no-bind-pool gates, payload integrity,
# the shared bind pool surviving, and LANE EQUIVALENCE across all five storage
# shapes - the literal and JSON lanes must give every column the same name and
# type, or a report changes what a join means on crossing the threshold.
#
# THREE TARGETED MUTANTS: two revert a fixed site to its old array_slice() form
# (resolver cap, refresh guard) and prove each then truncates silently; the third
# types the JSON lane from the numeric PREDICATE rather than from what the literal
# emitter ships, and must produce a NUMBER/VARCHAR2 split across the lanes. Two
# PENUMBRA_SUBQUERY_LIMIT lines on stderr in the resolver section are EXPECTED
# (the live error_log on the refusal path).
#
# -n (skip php.ini) because from a workstation the ini cannot load oci8/sqlsrv.
#
# EXPECTED TAIL: "PASS 172   FAIL 0". Any other tail is a failure, a smaller
# pass count included.
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\importtrunc' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'

# NOT $args - that is an automatic variable in PowerShell.
$phpArgs = @('-n', (Join-Path $here 'test_importtrunc.php'))
if ($Control) { $phpArgs += '--control' }

& $php @phpArgs
exit $LASTEXITCODE
