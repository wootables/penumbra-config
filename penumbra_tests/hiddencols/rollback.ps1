# =============================================================================
# ROLLBACK - hidden columns built EMPTY (2026-09-30). Three layers:
#
#   rollback.ps1 -Disable    create an empty js\penumbra_lazycells.off: the next page
#                            load builds every cell up front again (index.php ->
#                            penumbra_vars.lazyCellsOff). No deploy, nothing else changes.
#   rollback.ps1 -Enable     delete that file again.
#   rollback.ps1 -Restore [-DryRun]
#                            take the WHOLE change back out of the CURRENT live main.js,
#                            index.php and README.md: hc_patch.py reverse removes exactly
#                            the inserted lines, so anything deployed on top by others
#                            stays; it REFUSES (touches nothing) if any of this change's
#                            text was edited since. Then the same hash-guarded atomic
#                            swap as deploy.ps1 (stamp <date>-hiddencols-rollback).
#   -App <scratch app copy>  rehearse any of the above on a copy.
# The deploy's .bak-<stamp> files are the last layer (they predate anything newer).
# =============================================================================
param([switch]$Disable, [switch]$Enable, [switch]$Restore, [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\hiddencols' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$marker = Join-Path $app 'js\penumbra_lazycells.off'

if ($Disable) {
  if (Test-Path -LiteralPath $marker) { Write-Host "already off: $marker" }
  else { [IO.File]::WriteAllBytes($marker, [byte[]]@()); Write-Host "OFF: created $marker - the next page load builds every cell up front" -ForegroundColor Yellow }
  return
}
if ($Enable) {
  if (Test-Path -LiteralPath $marker) { [IO.File]::Delete($marker); Write-Host "ON: deleted $marker" -ForegroundColor Green }
  else { Write-Host "already on (no $marker)" }
  return
}
if (-not $Restore) { Write-Host 'usage: rollback.ps1 -Disable | -Enable | -Restore [-DryRun] [-App <dir>]'; return }

# ---- -Restore: reverse the patch on the CURRENT live files, then swap ----------
$work = Join-Path $env:TEMP ('pnb_hc_rb_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force "$work\cur\js", "$work\out" | Out-Null
foreach ($rel in @('js\main.js', 'index.php', 'README.md')) { Copy-Item -LiteralPath (Join-Path $app $rel) -Destination (Join-Path "$work\cur" $rel) }
$sha = foreach ($rel in @('js\main.js', 'index.php', 'README.md')) {
  (Get-FileHash -LiteralPath (Join-Path "$work\cur" $rel) -Algorithm SHA256).Hash.ToLower() + ' *' + ($rel -replace '\\', '/')
}
[IO.File]::WriteAllLines("$work\cur.sha256", $sha)
$py = & py -3 (Join-Path $here 'hc_patch.py') reverse "$work\cur" "$work\out" 2>&1
$py | ForEach-Object { Write-Host "  $_" }
if (($py -join "`n") -match 'NOTHING WRITTEN|FAIL') { Write-Host 'ABORT - the reverse patch did not apply cleanly; nothing was touched.' -ForegroundColor Red; return }
$stamp = (Get-Date).ToString('yyyyMMdd') + '-hiddencols-rollback'
& ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $here 'deploy.ps1')))) -Stage "$work\out" -Expect "$work\cur.sha256" -Stamp $stamp -App $app -Here $here -DryRun:$DryRun
Write-Host "work dir: $work"
