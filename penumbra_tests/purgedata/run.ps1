# =============================================================================
# Penumbra PURGE DATA suite - purge_report_data.php tells the truth (2026-10-01)
#
# test.php lifts the endpoint's DELETE helper and its per-report loop by markers and
# runs them against a STUB connection (no database): a table never installed
# (ORA-00942) counts as 0 rows and no error, as always; a DELETE the database
# refuses (ORA-01031 - the answer every Manage-mode History purge got before the
# 2026-10-01 GRANT DELETE ON NC_REPORTING.PENUMBRA_AUDIT TO ORIED_RO) is named per
# statement in per_report[].error and errors[] and written into the report's
# DATA_PURGE audit row as "refused" with the true rows_deleted; the second statement
# of 'toggles' is named on its own while the first's rows count; a refusal does not
# stop the batch; a report not found is reported as before.
#
#   powershell -File run.ps1                 (tests the LIVE purge_report_data.php)
#   powershell -File run.ps1 -App <dir>      (a staged copy; the pre-fix .bak is the
#                                             positive control: 7 of 14 red)
#   powershell -File run.ps1 -Mutant <name>  (ONE single-point change; each must turn
#                                             only its own assertions red)
#       swallow    every error is swallowed as "table absent" again (the old bug)
#       noaudit    the DATA_PURGE row loses its "refused" list
#       noerrors   a refusal is not listed in errors[]
#       noentry    a refusal is not named on the per-report entry
# Writes summary.txt. ONE run at a time (the run ends in `exit 1` on a failure).
# From a UNC path run it as a scriptblock with `$here = $PSScriptRoot` replaced.
# =============================================================================
param([string]$App = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\purgedata' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$src = Join-Path $App 'purge_report_data.php'
if (-not (Test-Path -LiteralPath $src)) { throw "purge_report_data.php not found under $App" }

$mutants = @{
  'swallow'  = @('if (pdd_table_absent($e)) { return 0; }', 'return 0;')
  'noaudit'  = @('if ($refused) { $audit[''refused''] = $refused; }', '/* mutant: refusals not audited */')
  'noerrors' = @('foreach ($refused as $why) { $errors[] = ''Report '' . $shortId . '' ('' . $rid . ''): '' . $why; }', '/* mutant: refusals not listed */')
  'noentry'  = @('$entry[''error''] = implode(''; '', $refused);', '/* mutant: refusal not on the entry */')
}
$txt = [IO.File]::ReadAllText($src)
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $mN = ([regex]::Matches($txt, [regex]::Escape($mOld))).Count
  if ($mN -ne 1) { throw "mutant '$Mutant' anchor found $mN times, expected 1: $mOld" }
  $txt = $txt.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
$appDir = Join-Path $here 'app'
if (-not (Test-Path -LiteralPath $appDir)) { New-Item -ItemType Directory -Path $appDir | Out-Null }
[IO.File]::WriteAllText((Join-Path $appDir 'purge_report_data.php'), $txt, (New-Object System.Text.UTF8Encoding($false)))

# Through cmd so php.exe's stderr (the workstation build's missing-extension warnings)
# never reaches PowerShell: under $ErrorActionPreference = 'Stop' a native stderr line
# redirected in PowerShell 5.1 is a terminating NativeCommandError.
$testPhp = Join-Path $here 'test.php'
Push-Location $env:TEMP   # cmd prints a warning when started from a UNC working directory
try { $out = cmd /c "`"$php`" `"$testPhp`" `"$appDir`" 2>nul" } finally { Pop-Location }
$lines = @($out | Where-Object { $_ -notmatch '^PHP (Warning|Notice|Deprecated)' })
$summary = New-Object System.Collections.Generic.List[string]
$summary.Add("files: " + $(if ($App -eq $live) { 'LIVE' } else { $App }) + $(if ($Mutant) { "   MUTANT $Mutant" } else { '' }))
$lines | ForEach-Object { $summary.Add($_) }
$last = @($lines | Where-Object { $_ -match 'assertions, \d+ failed|^FATAL' }) | Select-Object -Last 1
if (-not $last) { $summary.Add('FATAL: test.php produced no summary'); $last = 'FATAL' }
[IO.File]::WriteAllLines((Join-Path $here 'summary.txt'), $summary)
$summary | ForEach-Object { Write-Host $_ }
if ($last -notmatch 'assertions, 0 failed') { exit 1 }
