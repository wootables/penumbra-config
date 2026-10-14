# =============================================================================
# ROLLBACK - puts back the files deploy.ps1 replaced, from their .bak-<stamp>.
#
#   rollback.ps1 -Stamp <yyyyMMdd-jsongroup> [-DryRun] [-App <scratch app copy>]
#
# Reads deploy\<stamp>\manifest.json. Guards first, for every file, before
# anything moves: the live file must still hash to what the deploy wrote (a
# later deploy by anyone else is NOT undone blindly - then nothing is touched)
# and its .bak must still hash to what was live before. Then per file: .bak ->
# live.rollback-tmp (hash-verified), MoveFileEx(tmp, live, REPLACE_EXISTING).
# The .bak copies are kept.
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Stamp, [switch]$DryRun, [string]$App = '', [string]$Here = '')
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\jsongroup' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
if (-not ('PnbMove' -as [type])) {
  Add-Type -Namespace '' -Name 'PnbMove' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern bool MoveFileEx(string existing, string replacement, int flags);
'@
}
function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLower() }

$mf = Join-Path $here "deploy\$Stamp\manifest.json"
if (-not (Test-Path -LiteralPath $mf)) { throw "no manifest: $mf" }
$m = Get-Content -LiteralPath $mf -Raw | ConvertFrom-Json
$problems = @()
foreach ($p in $m.files.PSObject.Properties) {
  $live = Join-Path $app ($p.Name -replace '/', '\'); $bak = Join-Path $app ($p.Value.bak -replace '/', '\')
  if ((Get-Sha $live) -ne $p.Value.after) { $problems += "$($p.Name) : live is no longer what this deploy wrote - someone deployed since" }
  if (-not (Test-Path -LiteralPath $bak) -or (Get-Sha $bak) -ne $p.Value.before) { $problems += "$($p.Name) : $bak missing or changed" }
}
if ($problems.Count) {
  Write-Host 'ABORT - nothing was touched:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  return
}
Write-Host "guards OK (stamp $Stamp)" -ForegroundColor Green
if ($DryRun) { Write-Host 'DRY RUN - stopping before the swap.'; return }
foreach ($p in $m.files.PSObject.Properties) {
  $live = Join-Path $app ($p.Name -replace '/', '\'); $bak = Join-Path $app ($p.Value.bak -replace '/', '\')
  $tmp = "$live.rollback-tmp"
  Copy-Item -LiteralPath $bak -Destination $tmp -Force
  if ((Get-Sha $tmp) -ne $p.Value.before) { throw "$($p.Name) : temp copy hash mismatch" }
  if (-not [PnbMove]::MoveFileEx($tmp, $live, 1)) { throw "$($p.Name) : MoveFileEx failed: Win32 $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  (Get-Item -LiteralPath $live).LastWriteTime = Get-Date
  if ((Get-Sha $live) -ne $p.Value.before) { throw "$($p.Name) : live hash after rollback is wrong" }
  Write-Host ("  restored {0}" -f $p.Name) -ForegroundColor Green
}
Write-Host 'ROLLED BACK (the .bak copies are kept).' -ForegroundColor Green
