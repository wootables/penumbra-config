# =============================================================================
# ROLLBACK - pop-out tooltip hosting (2026-09-25)
#
#   rollback.ps1 -Status             which of the change's hunks the live files hold
#   rollback.ps1 -Restore [-DryRun]  take the change back OUT: patch_tiphost.py reverse
#                                    on the CURRENT live js/main.js - it undoes exactly
#                                    these edits, so anything another session deployed
#                                    on top is kept, and it refuses (touching nothing)
#                                    if someone has edited those lines since. Then the
#                                    README.md entry, best effort: a refusal there only
#                                    warns (it is documentation). Hash-guarded atomic
#                                    swaps, backups *.bak-<stamp>-tiphost-undo.
#
# No off switch on purpose (no config creep): the change has no user-facing
# option, and with the console docked or undocked every path is stock jQuery UI.
#
# UNC NOTE: run the body as a scriptblock (-File on a UNC path is GPO-blocked here):
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\tiphost'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\rollback.ps1"))) -Here $d -Restore -DryRun
# =============================================================================
param([switch]$Status, [switch]$Restore, [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\tiphost' }
# -App: rehearse against a scratch copy of the app folder.
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$patcher = Join-Path $here 'patch_tiphost.py'

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

if (-not ($Status -or $Restore)) { $Status = $true }
$tmp = Join-Path $env:TEMP ('pnb_tthrb_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $tmp | Out-Null
# Names keep the patcher's file-type pick: "main.js" = the CRLF hunks, "README.md" = the doc ones.
$work = [ordered]@{ 'js/main.js' = "$tmp\main.js"; 'README.md' = "$tmp\README.md" }

if ($Status) {
  foreach ($rel in $work.Keys) {
    Copy-Item -LiteralPath (Join-Path $app ($rel -replace '/', '\')) -Destination $work[$rel]
    Write-Host "$rel :"
    & py -3 $patcher check $work[$rel]
  }
}

if ($Restore) {
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmm')
  $taken = @{}; $ok = @{}
  foreach ($rel in $work.Keys) {
    Copy-Item -LiteralPath (Join-Path $app ($rel -replace '/', '\')) -Destination $work[$rel] -Force
    $taken[$rel] = Get-Sha $work[$rel]
    & py -3 $patcher reverse $work[$rel]
    $ok[$rel] = ($LASTEXITCODE -eq 0)
  }
  if (-not $ok['js/main.js']) {
    Write-Host 'ABORT - the reverse patch refused js/main.js (see above); nothing was touched. Restore js\main.js.bak-*-tiphost by hand if needed.' -ForegroundColor Red
    try { [IO.Directory]::Delete($tmp, $true) } catch {}
    return
  }
  if (-not $ok['README.md']) { Write-Host 'NOTE - README.md: the reverse patch refused (edited since); it stays as it is - documentation only.' -ForegroundColor DarkYellow }
  if ($DryRun) { Write-Host "DRY RUN - the rolled-back files are in $tmp; nothing was touched."; return }
  foreach ($rel in @('js/main.js', 'README.md')) {
    if (-not $ok[$rel]) { continue }
    $live = Join-Path $app ($rel -replace '/', '\'); $new = $work[$rel]
    if ((Get-Sha $live) -ne $taken[$rel]) { throw "$rel changed while the rollback was being built - stopping here (files before it are already rolled back)" }
    Copy-Item -LiteralPath $live -Destination "$live.bak-$stamp-tiphost-undo"
    if ((Get-Sha "$live.bak-$stamp-tiphost-undo") -ne $taken[$rel]) { throw "$rel : backup hash mismatch" }
    $want = Get-Sha $new
    Copy-Item -LiteralPath $new -Destination "$live.rollback-tmp" -Force
    if ((Get-Sha "$live.rollback-tmp") -ne $want) { throw "$rel : temp copy hash mismatch" }
    Move-Atomic "$live.rollback-tmp" $live
    (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
    if ((Get-Sha $live) -ne $want) { throw "$rel : live hash after the swap does not match" }
    Write-Host ("  rolled back {0,-12} {1} -> {2}" -f $rel, $taken[$rel].Substring(0, 8), $want.Substring(0, 8)) -ForegroundColor Green
  }
  Write-Host 'ROLLED BACK.' -ForegroundColor Green
}
try { [IO.Directory]::Delete($tmp, $true) } catch {}
