# =============================================================================
# Run the shared-preset ENDPOINT unit tests (added 2026-09-05).
#
#   powershell -File run_api.ps1
#   powershell -File run_api.ps1 -Control   # must report FAIL 1 - proves the
#                                           # harness can actually fail
#
# WHAT IS UNDER TEST. manage_presets.php - phase 2 of the preset engine, the
# server-side store an author saves to and every viewer reads from. The suite
# patches the SHIPPED file (two require lines, the CSRF guard, the Content-Type
# header, the php://input read; `exit;` -> throw; http_response_code -> recorder),
# includes it once, and drives penumbraPresetsDispatch() per scenario against a
# fake database that emulates Oracle's TRIM(SHORT_ID) = :bind asymmetry.
#
# The five gate helpers - penumbraIsReportOwner, penumbraWildcardMatch,
# penumbraReportGrantMatches, userCanAccessReport (promoted into
# db_connection.php FOR this endpoint) and checkAuthorization - are lifted from
# the live files by tokenizer, never copied.
#
# A TARGETED MUTANT always runs in a child process: the write gate with its
# owner clause removed. The owner-save assertion must FAIL while grant-holder
# and admin still pass, proving the gate assertions bite on the right clause.
#
# This is the PHP half of penumbra_tests\presets. run.ps1 beside it runs the
# two JavaScript harnesses (the store and the mounted control).
#
# -n (skip php.ini) because from a workstation the ini cannot load oci8/sqlsrv.
# Nothing here needs them - the one oci8-touching function is faked.
#
# EXPECTED TAIL: "PASS 222   FAIL 0" (151 before Preset Sharing, 207 before its bug sweep, 2026-10-22). Any other tail is a failure, a smaller
# pass count included.
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when this body runs as a scriptblock (the GPO workaround).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\presets' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'

# NOT $args - that is an automatic variable in PowerShell.
$phpArgs = @('-n', (Join-Path $here 'test_presets_api.php'), "--app=$app")
if ($Control) { $phpArgs += '--control' }

& $php @phpArgs
exit $LASTEXITCODE
