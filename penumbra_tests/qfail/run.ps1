# =============================================================================
# QFAIL SUITE (2026-10-30): a viewer's run that dies with a database or server
# error writes a QUERY_FAIL audit row beside its sizeless OPEN row (the InfoEd
# outage of Oct 30 left four sizeless OPENs and nothing else), and every error
# surface counts and names it. PHP only, offline: test_qfail.php lifts the real
# helpers from db_connection.php and RUNS the real failure blocks of query.php
# and the real error-bucket code of both metrics pages (read its header).
# The Auditor's Health card / ribbon wording is suite auditortab (H7-H9, R1).
#
#   run.ps1                live files                   EXPECTED: GREEN 15 / 0
#   run.ps1 -Control       every file at 10d2ee6, the build before QUERY_FAIL
#                                                       EXPECTED: RED 0 / 15
#                                                       (19 mutants: -Mutants, 19 / 19 bite)
#   run.ps1 -From <dir>    the five files under <dir> (same relative paths as the webroot)
#   run.ps1 -Mutant <name> / -Mutants    anchors checked first (-CheckAnchors)
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\qfail'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting. Writes nothing to the webroot.
# =============================================================================
param([string]$From = '', [string]$Here = '', [string]$Mutant = '', [switch]$Mutants, [switch]$CheckAnchors, [switch]$Control)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\qfail' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

$files = [ordered]@{ db = 'db_connection.php'; q = 'query.php'; sh = 'analytics_shared.php'; all = 'analytics_all.php'; hlp = 'help\topics\auditorHelpLightbox.php' }
$paths = @{}
if ($Control) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))
  foreach ($k in $files.Keys) { $paths[$k] = Get-GitVersion '10d2ee6' ($files[$k] -replace '\\', '/') }
} else {
  $root = if ($From) { $From } else { $app }
  foreach ($k in $files.Keys) { $paths[$k] = Join-Path $root $files[$k] }
}
$src0 = @{}
foreach ($k in $files.Keys) { $src0[$k] = [IO.File]::ReadAllText($paths[$k], $utf8) }

# --- mutants (every file under test is LF) ---
$L = "`n"
$mSet     = "        'QUERY_FAIL'," + $L
$mGate    = "if (empty(`$openAuditId) || `$userKey === 'SCHEDULER') return false;"
$mGateNoS = "if (empty(`$openAuditId)) return false;"
$mGateNoO = "if (`$userKey === 'SCHEDULER') return false;"
$mRaw     = "    return 'Query failed' . (`$db !== null && `$db !== '' ? ' on ' . `$db : '')"
$mRaw0    = "    return 'Query failed: ' . `$raw . (`$db !== null && `$db !== '' ? ' on ' . `$db : '')"
$mOra     = '($n >= 12150 && $n <= 12699)'
$mOra0    = '($n >= 12000 && $n <= 12999)'
$mHint    = '    return isset($labels[$hint]) ? $labels[$hint] : null;'
$mPins    = "        if (is_array(`$pinsTableNames) && in_array(`$t, `$pinsTableNames))     return 'PINS MS-SQL';" + $L
$mPdo     = "    // size: say the run failed, and why in a word (2026-10-30, QUERY_FAIL)." + $L + "    penumbraAuditQueryFail("
$mPdo0    = "    // size: say the run failed, and why in a word (2026-10-30, QUERY_FAIL)." + $L + "    (function () {})("
$mExc     = "    error_log(`"PENUMBRA Exception for user `$currentUserKey: `" . `$e->getMessage());" + $L + "    penumbraAuditQueryFail("
$mExc0    = "    error_log(`"PENUMBRA Exception for user `$currentUserKey: `" . `$e->getMessage());" + $L + "    (function () {})("
$mCte     = "        error_log(`"CTE Subquery Failed: `" . `$e->getMessage());" + $L + "        penumbraAuditQueryFail("
$mCte0    = "        error_log(`"CTE Subquery Failed: `" . `$e->getMessage());" + $L + "        (function () {})("
$mSub     = "        error_log(`"Subquery Failed: `" . `$e->getMessage());" + $L + "        penumbraAuditQueryFail("
$mSub0    = "        error_log(`"Subquery Failed: `" . `$e->getMessage());" + $L + "        (function () {})("
$mStream  = "                    penumbraAuditQueryFail(isset("
$mStream0 = "                    (function () {})(isset("
$mJson    = "echo json_encode([`"error`" => `"Failed to encode query results as JSON.`"]);" + $L + "        penumbraAuditQueryFail("
$mJson0   = "echo json_encode([`"error`" => `"Failed to encode query results as JSON.`"]);" + $L + "        (function () {})("
$mCard    = "    if ((int)`$sys['QFAIL_COUNT'] > 0)      `$errBits[] = `$sys['QFAIL_COUNT'] . ' query-fail';" + $L
$mCardN   = " + (int)`$sys['QFAIL_COUNT'] + (int)`$sys['CLIENT_ERR_COUNT'];"
$mCardN0  = " + (int)`$sys['CLIENT_ERR_COUNT'];"
$mCnt     = "        case 'query_fails':          return `"COUNT(CASE WHEN ACTION='QUERY_FAIL' `$t THEN 1 END)`";" + $L
$mAll     = "if (`$queryFail > 0) `$errBits[] = number_format(`$queryFail) . ' query-fail';" + $L
$mAllN    = '$timeout + $queryFail + $clientErr;'
$mAllN0   = '$timeout + $clientErr;'
$mCss     = "    .act.QUERY_FAIL, .act.QUERY_TIMEOUT, .act.QUERY_TOOBIG {"
$mCss0    = "    .act.QUERY_FAILX, .act.QUERY_TIMEOUTX, .act.QUERY_TOOBIGX {"
$mutantDefs = [ordered]@{
  'setdrop'    = @{ t = 'db';  edits = @(,@($mSet, '')); red = @('E1') }
  'schedrow'   = @{ t = 'db';  edits = @(,@($mGate, $mGateNoS)); red = @('A1', 'Q1') }
  'noopenrow'  = @{ t = 'db';  edits = @(,@($mGate, $mGateNoO)); red = @('A1', 'Q1') }
  'rawleak'    = @{ t = 'db';  edits = @(,@($mRaw, $mRaw0)); red = @('M1', 'M2', 'Q2') }
  'ora12all'   = @{ t = 'db';  edits = @(,@($mOra, $mOra0)); red = @('M1') }
  'nohint'     = @{ t = 'db';  edits = @(,@($mHint, '    return null;')); red = @('D1') }
  'nopins'     = @{ t = 'db';  edits = @(,@($mPins, '')); red = @('D1') }
  'pdonocall'  = @{ t = 'q';   edits = @(,@($mPdo, $mPdo0)); red = @('Q1') }
  'excnocall'  = @{ t = 'q';   edits = @(,@($mExc, $mExc0)); red = @('Q2') }
  'ctenocall'  = @{ t = 'q';   edits = @(,@($mCte, $mCte0)); red = @('Q3') }
  'subnocall'  = @{ t = 'q';   edits = @(,@($mSub, $mSub0)); red = @('Q4') }
  'streamnone' = @{ t = 'q';   edits = @(,@($mStream, $mStream0)); red = @('Q5') }
  'jsonnone'   = @{ t = 'q';   edits = @(,@($mJson, $mJson0)); red = @('Q5') }
  'cardbucket' = @{ t = 'sh';  edits = @(,@($mCard, '')); red = @('C2') }
  'cardnamed'  = @{ t = 'sh';  edits = @(,@($mCardN, $mCardN0)); red = @('C2') }
  'nocounter'  = @{ t = 'sh';  edits = @(,@($mCnt, '')); red = @('C1') }
  'allbucket'  = @{ t = 'all'; edits = @(,@($mAll, '')); red = @('C3') }
  'allnamed'   = @{ t = 'all'; edits = @(,@($mAllN, $mAllN0)); red = @('C3') }
  'nocss'      = @{ t = 'all'; edits = @(,@($mCss, $mCss0)); red = @('S1') }
}
function Apply-Mutant([string]$text, [string]$name) {
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

function Invoke-Suite($s) {
  $run = Join-Path $env:TEMP ('pnb_qf_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  foreach ($k in $files.Keys) { [IO.File]::WriteAllText((Join-Path $run (Split-Path $files[$k] -Leaf)), $s[$k], $utf8) }
  Copy-Item (Join-Path $here 'test_qfail.php') "$run\test_qfail.php" -Force
  $out = & $php -n -d date.timezone=America/New_York "$run\test_qfail.php" $run 2>&1 | Out-String
  try { [IO.Directory]::Delete($run, $true) } catch { }
  return $out
}

Write-Host ('files: ' + (($files.Keys | ForEach-Object { $paths[$_] }) -join ' | '))
if ($CheckAnchors -or $Mutants) {
  $stale = @()
  foreach ($nm in $mutantDefs.Keys) { try { [void](Apply-Mutant $src0[$mutantDefs[$nm].t] $nm) } catch { $stale += $_.Exception.Message } }
  if ($stale.Count) { $stale | ForEach-Object { Write-Host "ANCHOR $_" }; Write-Host 'RESULT: RED'; return }
  Write-Host "ANCHORS all $($mutantDefs.Count) mutants apply exactly once"
  if ($CheckAnchors) { Write-Host 'RESULT: GREEN'; return }
}
if ($Mutant -or $Mutants) {
  $names = if ($Mutants) { @($mutantDefs.Keys) } else { @($Mutant) }
  $bite = 0
  foreach ($nm in $names) {
    if (-not $mutantDefs.Contains($nm)) { throw "unknown mutant '$nm' (known: $(($mutantDefs.Keys) -join ', '))" }
    $sx = @{}; foreach ($k in $src0.Keys) { $sx[$k] = $src0[$k] }
    $tk = $mutantDefs[$nm].t; $sx[$tk] = Apply-Mutant $src0[$tk] $nm
    $out = Invoke-Suite $sx
    $red = @([regex]::Matches($out, '(?m)^FAIL  (\S+)') | ForEach-Object { $_.Groups[1].Value })
    $miss = @($mutantDefs[$nm].red | Where-Object { $red -notcontains $_ })
    if ($miss.Count -eq 0) { $bite++; Write-Host ("MUTANT {0,-11} BITES   red: {1}" -f $nm, ($red -join ' ')) }
    else { Write-Host ("MUTANT {0,-11} MISSED  {1} stayed green; red: {2}" -f $nm, ($miss -join ' '), ($red -join ' ')) }
  }
  Write-Host "MUTANTS $bite / $($names.Count) bite"
  Write-Host $(if ($bite -eq $names.Count) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}
Write-Host (Invoke-Suite $src0).TrimEnd()
