# =============================================================================
# Run the Version History restore-path unit tests (added 2026-09-01).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control     # must report FAIL 1 - proves the
#                                         # harness can actually fail
#
# WHAT IS UNDER TEST. Five defects found by the 2026-09-01 restore audit, plus
# the behaviour around them that must not regress:
#   F1  restore_server_report.php dispatched on four action names and handled
#       two - ROLLBACK and CREATE matched NEITHER branch and returned
#       status:success having written nothing. Every restore logs a ROLLBACK
#       row, so "restore back from the Changes view" was the dead path.
#   F2  a restore of a version saved before a RENAME resolved its target by the
#       short id frozen in the snapshot, missed, re-inserted a duplicate, and
#       moved the LIVE report's journal notes and snapshots onto it.
#   F3  SHORT_ID is CHAR; delete_server_report.php handed back the padded value,
#       so the id-conflict check and the post-insert id lookup both missed and
#       every undelete lost its audit row and its re-link.
#   F4  a grant holder's rollback recorded an ownership change that never
#       happened in the audit AFTER.
#   F9  only two of five payload fields were validated; a missing short id
#       inserted a row with a NULL SHORT_ID.
#
# The SHIPPED restore_server_report.php is what runs: the file is read and four
# things are rewritten (require, CSRF guard, Content-Type header, php://input),
# plus `exit;` -> a throw and http_response_code() -> a recorder so the response
# is observable from CLI. Each rewrite is COUNTED and asserted, so a source edit
# that moves one fails the suite instead of hollowing it out.
#
# The four permission / change-summary helpers are LIFTED from db_connection.php
# by the tokenizer, never copied. Only the database is faked - and it emulates
# Oracle's TRIM(SHORT_ID) = :bind (the COLUMN is trimmed, the bind is not),
# because that asymmetry IS finding F3.
#
# -n (skip php.ini) because from a workstation the ini cannot load oci8/sqlsrv -
# those client libraries exist only on the server. Nothing here needs them.
#
# EXPECTED TAIL: "PASS 138   FAIL 0". Any other tail is a failure, a smaller
# pass count included. (Re-baselined 2026-09-16 from 135 after the 09-06/09-09
# $relinkTables additions - see the RE-BASELINE note in test_restore.php.)
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\restore' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'

# NOT $args - that is an automatic variable in PowerShell and assigning to it
# behaves differently inside a function than at script scope.
$phpArgs = @('-n', (Join-Path $here 'test_restore.php'), "--app=$app")
if ($Control) { $phpArgs += '--control' }

& $php @phpArgs
exit $LASTEXITCODE
