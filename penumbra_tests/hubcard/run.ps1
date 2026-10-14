# =============================================================================
# Run the health hub render tests (health.php, the 2026-09-12 redesign).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -Control     # must report FAIL 1 - proves the
#                                         # harness can actually fail
#   powershell -File run.ps1 -Mutant      # the outage card's mute bell loses
#                                         # its data-slot before rendering and
#                                         # the suite must go RED: a bell
#                                         # without a slot cannot mute anything
#   powershell -File run.ps1 -Mutant2     # penumbra_directory_status() loses
#                                         # its stale threshold and the suite
#                                         # must go RED on exactly the two
#                                         # "stale" verdicts (2026-09-23)
#   powershell -File run.ps1 -Mutant3     # the status band reads 'ok' alone
#                                         # again and must go RED on exactly
#                                         # the two bands whose only problem
#                                         # is a cached down (2026-09-24)
#   powershell -File run.ps1 -Mutant4     # the outage strip draws the last 24
#                                         # hours whatever the card's window
#                                         # (the 2026-10-01 report): 7 RED
#   powershell -File run.ps1 -Mutant5     # the status chips read the cards'
#                                         # windowed $errs / $outg: exactly
#                                         # the two chip assertions RED
#   powershell -File run.ps1 -Mutant6     # the left column back in its old
#                                         # order: exactly the order
#                                         # assertion RED (2026-10-01)
#   powershell -File run.ps1 -App <dir>   # test a STAGED copy (health.php and
#                                         # penumbra_health.php, with the
#                                         # analytics_shared.php and
#                                         # penumbra_logs.php beside them)
#   powershell -File run.ps1 -Html C:\path\hub_preview.html
#                                         # also writes the rendered regions
#                                         # into a page shell for a headless
#                                         # look (link css/ beside it)
#
# WHAT IS UNDER TEST. Seven regions of the LIVE health.php - the status band,
# scheduler + database tiles, delivery, failures, outage history, runtime and
# the log viewer with its scripts - are cut out of the shipped file by their
# anchors and rendered over fixtures: an open outage with its escalation
# packet, an open near miss, a muted recurring window, a closed near miss,
# a 24-hour strip with red and amber cells, a degraded database tile, four
# delivery stalls, a folded and an unfolded failures card, an unreadable log
# source. The mute POST handler runs for real against a scratch mute file.
# Every diagnostic is promoted to fatal, so a notice in a template is a FAIL.
#
# The code under test is LIFTED from the shipped files, never copied: the
# OUTAGE HISTORY block and penumbra_outage_packet() from penumbra_health.php,
# the page helpers from health.php, both by the tokenizer.
#
# -n (skip php.ini) because from a workstation the ini cannot load
# oci8/pdo_oci/sqlsrv. The timezone is passed explicitly.
#
# EXPECTED TAIL: "SUMMARY  pass=NN  fail=0". Any other tail is a failure.
# UNC .ps1 files are GPO-blocked here - run the body as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\hubcard\run.ps1')); & $sb
# =============================================================================
param([switch]$Control, [switch]$Mutant, [switch]$Mutant2, [switch]$Mutant3, [switch]$Mutant4, [switch]$Mutant5, [switch]$Mutant6, [string]$Html, [string]$App)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\hubcard' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$app  = if ($App) { $App } else { '\\oitras\c$\inetpub\wwwroot\sponsor_migration\penumbra' }

$args = @('-n', '-d', 'date.timezone=America/New_York', (Join-Path $here 'test_hubcard.php'),
          "--health=$app\penumbra_health.php", "--page=$app\health.php")
if ($Control) { $args += '--control' }
if ($Mutant)  { $args += '--mutant' }
if ($Mutant2) { $args += '--mutant2' }
if ($Mutant3) { $args += '--mutant3' }
if ($Mutant4) { $args += '--mutant4' }
if ($Mutant5) { $args += '--mutant5' }
if ($Mutant6) { $args += '--mutant6' }
if ($Html)    { $args += "--html=$Html" }

& $php @args
Write-Output ("RESULT: " + $(if ($LASTEXITCODE -eq 0) { 'GREEN' } else { 'RED' }))
exit $LASTEXITCODE
