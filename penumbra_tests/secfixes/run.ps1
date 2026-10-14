# =============================================================================
# Penumbra SECURITY FIXES suite (2026-10-01) - the AI Assist rate limit and the
# CSRF guard on audit_ack.php
#
# test.php lifts penumbraAiRateCheck() out of db_connection.php by its markers and
# runs it against a temp dir with an injected clock (N calls a rolling minute per
# user, the N+1th refused with its Retry-After, the window sliding, users apart,
# 0 = off, an unwritable dir failing OPEN, a user key sanitised, a corrupt stamp
# file tolerated), then checks ai_assist.php calls it after the authorization check
# and before the body is read and refuses with 429 + Retry-After, and that
# audit_ack.php calls penumbraCsrfGuard() before anything else. No database.
#
#   powershell -File run.ps1                 (tests the LIVE files)
#   powershell -File run.ps1 -App <dir>      (a flat dir holding the three files; any
#                                             missing one comes from live; the pre-fix
#                                             files are the control: FATAL, no limiter)
#   powershell -File run.ps1 -Mutant <name>  (ONE single-point change; each must turn
#                                             only its own assertions red)
#       window      a stamp never ages out (db_connection.php)
#       peruser     every user shares one stamp file (db_connection.php)
#       failclosed  an unwritable dir refuses the call (db_connection.php)
#       offbyone    the limit admits one call too many (db_connection.php)
#       ratecall    ai_assist.php ignores the limiter's answer
#       csrfoff     audit_ack.php drops its CSRF guard
# Writes summary.txt. ONE run at a time (the run ends in `exit 1` on a failure).
# From a UNC path run it as a scriptblock with `$here = $PSScriptRoot` replaced.
# =============================================================================
param([string]$App = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\secfixes' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
function Src($name) { if ($App -and (Test-Path -LiteralPath (Join-Path $App $name))) { return (Join-Path $App $name) }; return (Join-Path $live $name) }
$files = @{ db = Src 'db_connection.php'; ai = Src 'ai_assist.php'; ack = Src 'audit_ack.php' }

$mutants = @{
  'window'     = @('db',  '&& ($now - (int)$s) < 60 &&', '&& ($now - (int)$s) < 600000 &&')
  'peruser'    = @('db',  '$safeUid . ''.ai'';', '''all.ai'';')
  'failclosed' = @('db',  'if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) return $open;   // fail open', 'if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) return array(''ok'' => false, ''limit'' => $limit, ''count'' => 0, ''retry'' => 60);')
  'offbyone'   = @('db',  'if (count($stamps) >= $limit) {', 'if (count($stamps) > $limit) {')
  'ratecall'   = @('ai',  'if (!$aiRate[''ok'']) {', 'if (false) {')
  'csrfoff'    = @('ack', 'penumbraCsrfGuard();', '/* mutant: no CSRF guard */')
}
$txt = @{}
foreach ($k in $files.Keys) { $txt[$k] = [IO.File]::ReadAllText($files[$k]) }
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
[IO.File]::WriteAllText((Join-Path $appDir 'db_connection.php'), $txt.db, $utf8)
[IO.File]::WriteAllText((Join-Path $appDir 'ai_assist.php'), $txt.ai, $utf8)
[IO.File]::WriteAllText((Join-Path $appDir 'audit_ack.php'), $txt.ack, $utf8)

# Through cmd so php.exe's stderr never reaches PowerShell (a terminating
# NativeCommandError under Stop); the cd because cmd refuses a UNC working dir.
$testPhp = Join-Path $here 'test.php'
Push-Location $env:TEMP   # cmd prints a warning when started from a UNC working directory
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
