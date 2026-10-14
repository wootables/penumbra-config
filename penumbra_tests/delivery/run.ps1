# =============================================================================
# Run the www3 delivery-check unit tests (penumbra_health.php DELIVERY block).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control     # must report FAIL 1 - proves the
#                                         # harness can actually fail
#   powershell -File run.ps1 -Mutant      # runs the block with the stall code
#                                         # changed (121 -> 999) and must go RED:
#                                         # proves the assertions bite on the
#                                         # thing that matters
#
# WHAT IS UNDER TEST. On 2026-09-12 responses over ~27KB from oitras to the
# www3 reverse proxies stalled for most of a day (IIS sc-win32-status 121)
# while health.php stayed green, because every check it ran was made FROM
# the server. penumbra_delivery_health() reads the last 15 minutes of the
# IIS access log and asks whether large responses to the proxies complete.
# This suite drives it against synthetic u_ex*.log fixtures in a scratch dir
# (window edges, the UTC midnight rollover, a custom #Fields order, every
# verdict, the real 2026-09-12 lines), and finally against the LIVE log
# directory read-only as a smoke test.
#
# The block is EXTRACTED from the live penumbra_health.php - never a copy -
# and the live penumbra_logs.php supplies the tail/W3C helpers it calls.
#
# -n (skip php.ini) because from a workstation the ini cannot load
# oci8/pdo_oci/sqlsrv. The timezone is passed explicitly: -n drops
# date.timezone and 'c'-formatted timestamps would otherwise print as UTC.
#
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0". Any other tail is a failure.
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\delivery\run.ps1')); & $sb
# =============================================================================
param([switch]$Control, [switch]$Mutant)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\delivery' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$iis  = '\\oitras\c$\inetpub\logs\LogFiles\W3SVC1'

$args = @('-n', '-d', 'date.timezone=America/New_York', (Join-Path $here 'test_delivery.php'),
          "--src=$app\penumbra_health.php", "--logs=$app\penumbra_logs.php", "--live=$iis")
if ($Control) { $args += '--control' }
if ($Mutant)  { $args += '--mutant' }

& $php @args
Write-Output ("RESULT: " + $(if ($LASTEXITCODE -eq 0) { 'GREEN' } else { 'RED' }))
