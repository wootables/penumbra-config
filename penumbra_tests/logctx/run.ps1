# =============================================================================
# Run the log-filter context tests (health hub log console).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control    # must report FAIL 1
#
# WHAT IS UNDER TEST. penumbra_log_tail()'s context window: N lines either side
# of a substring match, the match mark, the "N lines not shown" separator, the
# merge of overlapping windows, clamping at both ends of the file, the
# interaction with "problems only", and the row cap.
#
# NOT A COPY. penumbra_logs.php is self-contained (no database, no requires) and
# takes the PHP-error log path from $config, so the suite points that key at a
# scratch file and drives the REAL function end to end - tail reader and
# severity classifier included. Nothing is stubbed and the live logs are never
# touched.
#
# -n (skip php.ini) because from a workstation the ini cannot load the database
# extensions; nothing here needs them.
#
# EXPECTED TAIL: "PASS 45   FAIL 0". Any other tail is a failure.
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\logctx' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'

$a = @('-n', (Join-Path $here 'test_logctx.php'), "--app=$app")
if ($Control) { $a += '--control' }

& $php @a
exit $LASTEXITCODE
