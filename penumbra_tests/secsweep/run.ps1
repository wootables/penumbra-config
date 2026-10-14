# =============================================================================
# Penumbra SECURITY SWEEP suite (2026-10-01) - the five code items of the 2026-09-04
# sweep: the server-side CSV formula guard (shared_logic.php + the runner's five fputcsv
# sites + the generated stub's twin), the admin tools' session cookie flags
# (penumbraSessionStart), the console-audience gate on manage_table_info.php (and
# ai_assist.php delegating to the one predicate), the client-error report gate, and
# the snapshot pin rule. test.php lifts the new functions by their markers and checks
# the rest of the files' text in order; no database, no web server.
#
#   powershell -File run.ps1                 (tests the LIVE files)
#   powershell -File run.ps1 -App <dir>      (a flat dir holding any of the eleven files;
#                                             missing ones come from live; the pre-fix
#                                             files are the control: FATAL, no guard)
#   powershell -File run.ps1 -Mutant <name>  (ONE single-point change; each must turn
#                                             only its own assertions red)
#       csveq       `=` no longer guarded (shared_logic.php; the twin disagrees too)
#       csvminus    `-1234.5` quoted like text (the plain-number rule dropped)
#       runnersite  one of the runner's fputcsv sites unguarded (schedule_runner.php)
#       stubsite    one of the stub's fputcsv sites unguarded (generate_stub.php)
#       sessflags   HttpOnly off (db_connection.php)
#       sesssecure  Secure never set (db_connection.php)
#       audience    a grant holder no longer passes (db_connection.php)
#       sessbare    grants_admin.php back to a bare session_start()
#       tinfogate   manage_table_info.php gates on nothing
#       cerrgate    log_client_error.php files under any report again
#       pinrule     manage_snapshots.php lets any viewer pin again
# Writes summary.txt. ONE run at a time (the run ends in `exit 1` on a failure).
# From a UNC path run it as a scriptblock with `$here = $PSScriptRoot` replaced.
# =============================================================================
param([string]$App = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\secsweep' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
function Src($name) { if ($App -and (Test-Path -LiteralPath (Join-Path $App $name))) { return (Join-Path $App $name) }; return (Join-Path $live $name) }
$names = @{ db = 'db_connection.php'; logic = 'shared_logic.php'; runner = 'schedule_runner.php'; stub = 'generate_stub.php'; grants = 'grants_admin.php'; people = 'tags_admin.php'; notice = 'system_notice.php'; tinfo = 'manage_table_info.php'; cerr = 'log_client_error.php'; snaps = 'manage_snapshots.php'; ai = 'ai_assist.php' }

$mutants = @{
  'csveq'      = @('logic',  'if ($first === ''='' || $first === ''@'' || $first === "\t" || $first === "\r") return "''" . $s;', 'if ($first === ''@'' || $first === "\t" || $first === "\r") return "''" . $s;')
  'csvminus'   = @('logic',  'if (!preg_match(''/^[+-]?[\d,]*\.?\d+(?:[eE][+-]?\d+)?$/'', trim($s))) return "''" . $s;', 'return "''" . $s;')
  'runnersite' = @('runner', 'fputcsv($fp, penumbraCsvGuardRow($cleanRow));', 'fputcsv($fp, $cleanRow);')
  'stubsite'   = @('stub',   'fputcsv(\$df, array_map(''csvGuardCell'', \$row));', 'fputcsv(\$df, \$row);')
  'sessflags'  = @('db',     '''httponly'' => true,', '''httponly'' => false,')
  'sesssecure' = @('db',     '''secure''   => $secure,', '''secure''   => false,')
  'audience'   = @('db',     'if (is_array($grants) && (!empty($grants[''sql'']) || !empty($grants[''reports'']))) return true;', 'if (false) return true;')
  'sessbare'   = @('grants', 'penumbraSessionStart();   // session_start() with HttpOnly / Secure / SameSite=Lax set in code (2026-10-01)', 'session_start();')
  'tinfogate'  = @('tinfo',  'if (!penumbraIsConsoleAudience($isAdmin, $userGrants, $currentUserKey)) {', 'if (false) {')
  'cerrgate'   = @('cerr',   '&& userCanAccessReport($cerrConn, (int)$cerrRow[''ID''], $currentUserKey, $user_ouc, $isAdmin)) {', ') {')
  'pinrule'    = @('snaps',  'if (!$isAdmin && !penumbra_snap_is_creator($snap[''CREATED_BY''], $currentUserKey)', 'if (false')
}
$txt = @{}
foreach ($k in $names.Keys) { $txt[$k] = [IO.File]::ReadAllText((Src $names[$k])) }
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mk = $mutants[$Mutant][0]; $mOld = $mutants[$Mutant][1]; $mNew = $mutants[$Mutant][2]
  $mN = ([regex]::Matches($txt[$mk], [regex]::Escape($mOld))).Count
  if ($mN -ne 1) { throw "mutant '$Mutant' anchor found $mN times in $mk, expected 1: $mOld" }
  $txt[$mk] = $txt[$mk].Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
$appDir = Join-Path $here 'app'
if (-not (Test-Path -LiteralPath $appDir)) { New-Item -ItemType Directory -Path $appDir | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($k in $names.Keys) { [IO.File]::WriteAllText((Join-Path $appDir $names[$k]), $txt[$k], $utf8) }

# Through cmd so php.exe's stderr never reaches PowerShell (a terminating
# NativeCommandError under Stop); from a local directory because cmd warns on a UNC one.
$testPhp = Join-Path $here 'test.php'
Push-Location $env:TEMP
try { $out = cmd /c "`"$php`" `"$testPhp`" `"$appDir`" 2>nul" } finally { Pop-Location }
$lines = @($out | Where-Object { $_ -notmatch '^PHP (Warning|Notice|Deprecated)' })
$summary = New-Object System.Collections.Generic.List[string]
$summary.Add("files: " + $(if ($App) { $App + ' (missing ones from LIVE)' } else { 'LIVE' }) + $(if ($Mutant) { "   MUTANT $Mutant" } else { '' }))
$lines | ForEach-Object { $summary.Add($_) }
$last = @($lines | Where-Object { $_ -match 'assertions, \d+ failed|^FATAL' }) | Select-Object -Last 1
if (-not $last) { $summary.Add('FATAL: test.php produced no summary'); $last = 'FATAL' }
[IO.File]::WriteAllLines((Join-Path $here 'summary.txt'), $summary)
$summary | ForEach-Object { Write-Host $_ }
if ($last -notmatch 'assertions, 0 failed') { exit 1 }
