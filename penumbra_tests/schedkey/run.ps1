# =============================================================================
# Penumbra SCHEDKEY suite (2026-10-03) - two hardenings around the scheduler secret:
#   1. the secret is honoured only when the request comes from THIS SERVER
#      (penumbraPeerIsLocal() in db_connection.php; query.php's elevation and the CSRF
#      guard's bypass), and a valid secret from anywhere else is logged;
#   2. a stored task secret that cannot be read stops the task with the reason
#      (schedule_runner.php: decrypt_scheduler_password, scheduler_read_secret, the
#      file-drop block, the encrypted-report message).
# test.php lifts the functions by their markers and RUNS them (the peer rule over 15
# peers; the stored-secret reader against values made by manage_schedule.php's own
# encrypt; the file-drop block inside a one-pass loop with the runner's two logging
# calls stubbed), then pins the call sites. No database, no web server.
#
#   powershell -File run.ps1                 (tests the LIVE files)
#   powershell -File run.ps1 -App <dir>      (a flat dir holding any of query.php,
#                                             db_connection.php, schedule_runner.php,
#                                             manage_schedule.php; missing ones come from
#                                             live; the pre-fix files are the control:
#                                             FATAL, nothing to lift)
#   powershell -File run.ps1 -Mutant <name> | -Mutants   (single-point changes; each
#                                             must turn exactly its own assertions red)
#       peerany      a peer that is not this server passes once its addresses are known
#       peerwide     any link-local peer passes (the web.config rule's width)
#       nofallback   no fallback when the server's addresses cannot be learned
#       nozone       the IPv6 zone id is not stripped (the scheduler's peer carries one)
#       querynolocal query.php elevates without the peer check
#       csrfnolocal  the CSRF bypass skips the peer check
#       readfalse    scheduler_read_secret hands back whatever decrypt answered
#       dropcarryon  the file-drop block never records the error
#       msgold       the encrypted-report message never says "could not be read"
#       decryptloose decrypt no longer rejects a value with no separator
#       ivloose      decrypt no longer rejects a short IV
# Writes summary.txt. Run it as a CHILD process (it ends in `exit`):
#   powershell -NoProfile -ExecutionPolicy Bypass -File <a local copy of run.ps1> -Here <this dir>
# =============================================================================
param([string]$App = '', [string]$Mutant = '', [switch]$Mutants, [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\schedkey' }
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
function Src($rel) { if ($App -and (Test-Path -LiteralPath (Join-Path $App $rel))) { return (Join-Path $App $rel) }; return (Join-Path $live $rel) }
$names = @{ query = 'query.php'; db = 'db_connection.php'; runner = 'schedule_runner.php'; sched = 'manage_schedule.php' }

$mutantDefs = @{
  'peerany'      = @('db',     '    if ($known) return false;', '    if ($known) return true;', @('P6', 'P7', 'P13', 'P14', 'P15'))
  'peerwide'     = @('db',     '        if ($b === $peer) return true;', '        if ($b === $peer || (strlen($peer) === 16 && ord($peer[0]) === 0xfe)) return true;', @('P7'))
  'nofallback'   = @('db',     '    return strlen($peer) === 16 && ord($peer[0]) === 0xfe && (ord($peer[1]) & 0xc0) === 0x80;   // fe80::/10', '    return false;', @('P9'))
  'nozone'       = @('db',     '        if ($p !== false) $ip = substr($ip, 0, $p);   // IPv6 zone id (fe80::1%4)', '', @('P4', 'P8', 'P9', 'P12', 'P14'))
  'querynolocal' = @('query',  '        if (penumbraPeerIsLocal()) {', '        if (true) {', @('Q1'))
  'csrfnolocal'  = @('db',     '                && penumbraPeerIsLocal()) {', '                ) {', @('Q2'))
  'readfalse'    = @('runner', '    if ($plain === false || $plain === null || $plain === '''') {', '    if (false) {', @('S2', 'S3', 'D2', 'D3'))
  'dropcarryon'  = @('runner', '                    if ($pnbErr !== null) { $pnbDropSecretErr = $pnbErr; break; }', '                    if (false) { $pnbDropSecretErr = $pnbErr; break; }', @('D2', 'D3'))
  'msgold'       = @('runner', '            if (!$password) return array(''error'' => ($password === false', '            if (!$password) return array(''error'' => (false', @('R1'))
  'decryptloose' = @('runner', '    if ($raw === false || strpos($raw, ''::'') === false) return false;', '', @('S5'))
  'ivloose'      = @('runner', '    if (strlen($iv) !== 16) return false;', '', @('S5'))
}

function Run-Once([string]$mut) {
  $txt = @{}
  foreach ($k in $names.Keys) { $txt[$k] = [IO.File]::ReadAllText((Src $names[$k])) }
  $expect = @()
  if ($mut) {
    if (-not $mutantDefs.ContainsKey($mut)) { throw "unknown mutant '$mut' (known: $(($mutantDefs.Keys | Sort-Object) -join ', '))" }
    $d = $mutantDefs[$mut]; $mk = $d[0]; $mOld = $d[1]; $mNew = $d[2]; $expect = @($d[3])
    $mN = ([regex]::Matches($txt[$mk], [regex]::Escape($mOld))).Count
    if ($mN -ne 1) { throw "mutant '$mut' anchor found $mN times in $mk, expected 1: $mOld" }
    $txt[$mk] = $txt[$mk].Replace($mOld, $mNew)
  }
  $appDir = Join-Path $here 'app'
  if (Test-Path -LiteralPath $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
  New-Item -ItemType Directory -Path $appDir | Out-Null
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  foreach ($k in $names.Keys) { [IO.File]::WriteAllText((Join-Path $appDir $names[$k]), $txt[$k], $utf8) }
  # Through cmd so php.exe's stderr never reaches PowerShell (a terminating
  # NativeCommandError under Stop); from a local directory because cmd warns on a UNC one.
  # -n: no php.ini (the workstation cannot load the server's extension DLLs); openssl is
  # loaded by UNC with forward slashes, as tplparity does for mbstring.
  $testPhp = Join-Path $here 'test.php'
  Push-Location $env:TEMP
  try { $out = cmd /c "`"$php`" -n -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=openssl `"$testPhp`" `"$appDir`" 2>nul" } finally { Pop-Location }
  $lines = @($out | Where-Object { $_ -notmatch '^PHP (Warning|Notice|Deprecated)' })
  $last = @($lines | Where-Object { $_ -match 'assertions, \d+ failed|^FATAL' }) | Select-Object -Last 1
  if (-not $last) { $last = 'FATAL: test.php produced no summary' }
  $red = @($lines | Where-Object { $_ -match '^FAIL ' } | ForEach-Object { ($_ -split ' ')[1] })
  return @{ lines = $lines; last = $last; red = $red; expect = $expect }
}

$summary = New-Object System.Collections.Generic.List[string]
$summary.Add("files: " + $(if ($App) { $App + ' (missing ones from LIVE)' } else { 'LIVE' }))
$code = 0
if ($Mutants -or $Mutant) {
  $todo = if ($Mutants) { @($mutantDefs.Keys | Sort-Object) } else { @($Mutant) }
  foreach ($m in $todo) {
    $r = Run-Once $m
    $got = @($r.red | Sort-Object); $want = @($r.expect | Sort-Object)
    $ok = (($got -join ',') -eq ($want -join ','))
    $line = "mutant {0,-12} {1}  red=[{2}] expected=[{3}]  ({4})" -f $m, $(if ($ok) { 'BITES' } else { 'MISMATCH' }), ($got -join ' '), ($want -join ' '), $r.last
    $summary.Add($line); Write-Host $line
    if (-not $ok) { $code = 1 }
  }
  $summary.Add($(if ($code -eq 0) { 'RESULT: GREEN (every mutant bites exactly its own)' } else { 'RESULT: RED' }))
  Write-Host $summary[$summary.Count - 1]
} else {
  $r = Run-Once ''
  $r.lines | ForEach-Object { $summary.Add($_) }
  $summary | ForEach-Object { Write-Host $_ }
  if ($r.last -notmatch 'assertions, 0 failed') { $code = 1 }
}
[IO.File]::WriteAllLines((Join-Path $here 'summary.txt'), $summary)
exit $code
