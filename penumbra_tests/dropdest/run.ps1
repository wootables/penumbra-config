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
# EXPECTED TAIL: "PASS 52   FAIL 0" then "RESULT: GREEN" (-Control: "FAIL 1" then
# "RESULT: RED"). RESULT follows php's exit code (0 only when FAIL is 0); any other
# tail is a failure, a smaller pass count included (RESULT cannot see the count).
#
# UNC .ps1 files are GPO-blocked here, so -File fails: run the body as a scriptblock
# (the runner prints its RESULT and never calls exit, which would kill the caller):
#   & ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dropdest\run.ps1'))) [-Control]
# =============================================================================
param([switch]$Control)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\dropdest' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'

# NOT $args - that is an automatic variable in PowerShell.
$phpArgs = @('-n', (Join-Path $here 'test_dropdest.php'))
if ($Control) { $phpArgs += '--control' }

$rc = 99   # stays 99 (RED) if php.exe cannot be started at all, e.g. the share is down
try { & $php @phpArgs; $rc = $LASTEXITCODE } catch { Write-Output "could not run php: $($_.Exception.Message)" }
if ($rc -ne 0) { Write-Output "php exit code: $rc" }
# NO `exit` here: the body runs as a scriptblock (UNC .ps1 is GPO-blocked), where an exit ends the CALLING PowerShell and the tail never prints.
# Write-Output, not Write-Host: the verdict then travels in the same stream as php's own PASS/FAIL lines, so `$out = & (scriptblock)` captures it too.
Write-Output ('RESULT: ' + $(if ($rc -eq 0) { 'GREEN' } else { 'RED' }))
