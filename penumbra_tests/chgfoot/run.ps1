# =============================================================================
# CHANGES FOOTER / POP OUT SUITE (2026-09-28): the Auditor's Changes view
# without its footer line, Pop out on the Auditor banner, Ctrl+Shift+Y named
# in its tooltip (and doing what it does while it is on screen).
#
# chg.html renders the REAL audit module of the main.js under test (everything
# from `var _auditLogLimit` to the audit-log sorting handler: the banner,
# _auditShowSeg, _auditRenderChanges / _auditPaintChanges, the filter, the diff
# painter and every delegated click/key handler), the REAL vhOpen and the REAL
# Ctrl+Shift+Y case, inside the REAL #auditor-tab and #versionHistoryLightbox
# lifted from the index.php under test, under index.php's stylesheet set with
# the css\main.css under test, in headless Edge over CDP (real mouse + keys).
# Only $.ajax is faked: get_audit_log.php / get_audit_data.php answer from
# fixtures shaped like the live payloads (a grantprofiles-like history).
#
#   F1-F4  no footer under the panes (docked 1708/1123, capped, compact, the
#          dialog); the list and the diff reach the panel's bottom
#   P1-P9  Pop out: a named button on the banner, only while Changes is the view,
#          never in the pane or the dialog; title "(CTRL+SHIFT+Y) ..." +
#          aria-keyshortcuts; the Changes banner one line from 1708 to 720px,
#          as tall as Report metrics; a REAL click and the key open the dialog on
#          the version being viewed and move the pane to Events; the tooltip
#          shows it; text >= 4.5, outline >= 3:1, hover keeps its colours (18 themes)
#   L1 L2  "Load older versions" ends a capped list; a REAL click refetches 500
#   C1-C3  the filter count under the selects (one row), zero-match, the dialog
#   K1 K2  ArrowDown on a filter select steps the select; on a row, the list
#   X1     no script errors
#
#   run.ps1                  live files                         EXPECTED: GREEN
#   run.ps1 -Control         the build before (.bak-20260928-chgfoot)  EXPECTED: RED
#   run.ps1 -MainCss <p> -MainJs <p> -IndexPhp <p>
#   run.ps1 -Mutant <name> / -Mutants   anchors checked first (-CheckAnchors)
#   -Keep keeps the staging dir.  -Here <dir> runs a copy.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chgfoot'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Needs py -3 with websocket-client and the PHP 8.2 CLI. Writes nothing to the webroot.
# =============================================================================
param([string]$MainCss = '', [string]$MainJs = '', [string]$IndexPhp = '', [string]$App = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$CheckAnchors, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chgfoot' }
$app  = if ($App) { $App } else { '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra' }
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$env:PYTHONIOENCODING = 'utf-8'

if ($Control) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $MainCss = Resolve-Bak "$app\css\main.css.bak-20260928-chgfoot"; $MainJs = Resolve-Bak "$app\js\main.js.bak-20260928-chgfoot"
  if (-not $MainCss -or -not $MainJs) { throw "-Control: no css\main.css / js\main.js .bak-20260928-chgfoot" }
}
$cssPath = if ($MainCss) { $MainCss } else { "$app\css\main.css" }
$jsPath  = if ($MainJs) { $MainJs } else { "$app\js\main.js" }
$idxPath = if ($IndexPhp) { $IndexPhp } else { "$app\index.php" }
Write-Host "main.css:  $cssPath"; Write-Host "main.js:   $jsPath"; Write-Host "index.php: $idxPath"

function New-RunDir {
  $run = Join-Path $env:TEMP ('pnb_cf_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force "$run\css", "$run\js" | Out-Null
  foreach ($f in @('jquery-ui.css', 'penumbra_tiles.css', 'density.css', 'search_builder.css', 'penumbra_presets.css', 'penumbra_colwidths.css')) { Copy-Item "$app\css\$f" "$run\css\$f" -Force }
  foreach ($f in @('jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js')) { Copy-Item "$app\js\$f" "$run\js\$f" -Force }
  Copy-Item $cssPath "$run\main.css" -Force
  Copy-Item $jsPath "$run\main.js" -Force
  Copy-Item $idxPath "$run\index.php" -Force
  foreach ($f in @('chg.html', 'cdp.py', 'suite.py', 'mutants.py', 'gen.php')) { Copy-Item "$here\$f" "$run\$f" -Force }
  $gen = & $php -n "$run\gen.php" $run $app 2>&1
  if (-not (Test-Path "$run\themes.js")) { throw "gen.php wrote no themes.js: $gen" }
  return $run
}
function Remove-RunDir($run) { if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch { } } else { Write-Host "kept: $run" } }

if ($CheckAnchors -or $Mutants) {
  $chk = & py -3 "$here\mutants.py" check $jsPath $cssPath 2>&1
  $chk | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { Write-Host 'RESULT: RED'; return }
  if ($CheckAnchors) { Write-Host 'RESULT: GREEN'; return }
}
if ($Mutant -or $Mutants) {
  $names = if ($Mutants) { @((& py -3 "$here\mutants.py" list) -split ' ') } else { @($Mutant) }
  $bite = 0
  foreach ($nm in $names) {
    $run = New-RunDir
    $ap = & py -3 "$run\mutants.py" apply $nm "$run\main.js" "$run\main.css" 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "MUTANT $nm could not apply: $ap"; Remove-RunDir $run; continue }
    [void](& py -3 "$run\suite.py" $run 2>&1)
    $want = @((& py -3 "$run\mutants.py" red $nm) -split ' ')
    $red = @()
    if (Test-Path "$run\asserts.json") { $red = @(([IO.File]::ReadAllText("$run\asserts.json", $utf8) | ConvertFrom-Json) | Where-Object { -not $_.pass } | ForEach-Object { $_.id }) }
    $miss = @($want | Where-Object { $red -notcontains $_ })
    if ($miss.Count -eq 0 -and $red.Count -gt 0) { $bite++; Write-Host ("MUTANT {0,-14} BITES   red: {1}" -f $nm, ($red -join ' ')) }
    else { Write-Host ("MUTANT {0,-14} MISSED  {1} stayed green; red: {2}" -f $nm, ($miss -join ' '), ($red -join ' ')) }
    Remove-RunDir $run
  }
  Write-Host "MUTANTS $bite / $($names.Count) bite"
  Write-Host $(if ($bite -eq $names.Count) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}
$run = New-RunDir
& py -3 "$run\suite.py" $run 2>&1 | ForEach-Object { Write-Host $_ }
Remove-RunDir $run
