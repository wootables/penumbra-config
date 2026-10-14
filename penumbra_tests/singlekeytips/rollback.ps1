# =============================================================================
# ROLLBACK - single-key hints (2026-09-25)
#
#   rollback.ps1 -Status             which of the change's hunks each live file holds
#   rollback.ps1 -Restore [-DryRun]  take the change back OUT: patch_singlekeytips.py
#                                    reverse on the CURRENT live files - it undoes exactly
#                                    these edits, so anything another session deployed on
#                                    top is kept, and it refuses (touching nothing) if
#                                    someone has edited those lines since. Hash-guarded
#                                    atomic swaps, main.js FIRST, backups
#                                    *.bak-<stamp>-singlekeytips-undo.
#
# There is no global off switch on purpose (no config creep): every viewer
# already has one - the Single-Key Shortcuts switch - and with it off the page
# behaves exactly as before this change, minus the Caps Lock fix.
#
# UNC NOTE: run the body as a scriptblock (-File on a UNC path is GPO-blocked here):
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\rollback.ps1"))) -Restore -DryRun
# =============================================================================
param([switch]$Status, [switch]$Restore, [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\singlekeytips' }
# -App: rehearse against a scratch copy of the app folder.
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$code = @('js/main.js', 'js/penumbra_dashboard.js', 'js/penumbra_a11y.js', 'css/main.css', 'health.php', 'help_content.php', 'README.md')

if (-not ('PnbMove' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMove' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }
function Move-Atomic([string]$from, [string]$to) {
  for ($i = 0; $i -lt 20; $i++) {
    if ([PnbMove]::MoveFileEx($from, $to, 1)) { return }
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -ne 32 -and $err -ne 33 -and $err -ne 5) { throw "MoveFileEx($from -> $to) failed: Win32 $err" }
    Start-Sleep -Milliseconds 250
  }
  throw "MoveFileEx($from -> $to) kept failing (sharing violation)"
}
function Copy-Live([string]$dest) {
  foreach ($rel in $code) {
    $d = Join-Path $dest ($rel -replace '/', '\')
    New-Item -ItemType Directory -Force (Split-Path $d) | Out-Null
    Copy-Item -LiteralPath (Join-Path $app ($rel -replace '/', '\')) -Destination $d
  }
}

if (-not ($Status -or $Restore)) { $Status = $true }

if ($Status) {
  $tmp = Join-Path $env:TEMP ('pnb_sktst_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  Copy-Live $tmp
  & py -3 (Join-Path $here 'patch_singlekeytips.py') check $tmp
  try { [IO.Directory]::Delete($tmp, $true) } catch {}
}

if ($Restore) {
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmm')
  $tmp = Join-Path $env:TEMP ('pnb_sktrb_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  Copy-Live "$tmp\in"
  $taken = @{}
  foreach ($rel in $code) { $taken[$rel] = Get-Sha (Join-Path "$tmp\in" ($rel -replace '/', '\')) }
  & py -3 (Join-Path $here 'patch_singlekeytips.py') reverse "$tmp\in" "$tmp\out"
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'ABORT - the reverse patch refused (see above); nothing was touched. Restore the .bak-*-singlekeytips copies by hand if needed.' -ForegroundColor Red
    return
  }
  foreach ($rel in @('health.php', 'help_content.php')) {
    $l = (& $php -n -l (Join-Path "$tmp\out" $rel)) -join ' '
    if ($l -notmatch 'No syntax errors') { Write-Host "ABORT - php -l on the rolled-back $rel : $l" -ForegroundColor Red; return }
  }
  if ($DryRun) { Write-Host "DRY RUN - the rolled-back files are in $tmp\out; nothing was touched."; return }
  foreach ($rel in @('js/main.js', 'js/penumbra_dashboard.js', 'js/penumbra_a11y.js', 'css/main.css', 'health.php', 'help_content.php', 'README.md')) {
    $live = Join-Path $app ($rel -replace '/', '\'); $new = Join-Path "$tmp\out" ($rel -replace '/', '\')
    if ((Get-Sha $live) -ne $taken[$rel]) { throw "$rel changed while the rollback was being built - stopping here (files before it are already rolled back)" }
    Copy-Item -LiteralPath $live -Destination "$live.bak-$stamp-singlekeytips-undo"
    if ((Get-Sha "$live.bak-$stamp-singlekeytips-undo") -ne $taken[$rel]) { throw "$rel : backup hash mismatch" }
    $want = Get-Sha $new
    Copy-Item -LiteralPath $new -Destination "$live.rollback-tmp" -Force
    if ((Get-Sha "$live.rollback-tmp") -ne $want) { throw "$rel : temp copy hash mismatch" }
    Move-Atomic "$live.rollback-tmp" $live
    (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
    if ((Get-Sha $live) -ne $want) { throw "$rel : live hash after the swap does not match" }
    Write-Host ("  rolled back {0,-26} {1} -> {2}" -f $rel, $taken[$rel].Substring(0, 8), $want.Substring(0, 8)) -ForegroundColor Green
  }
  try { [IO.Directory]::Delete($tmp, $true) } catch {}
  foreach ($rel in @('health.php', 'help_content.php')) { Write-Host ('  live php -l: ' + ((& $php -n -l (Join-Path $app $rel)) -join ' ')) }
  Write-Host 'ROLLED BACK.' -ForegroundColor Green
}
