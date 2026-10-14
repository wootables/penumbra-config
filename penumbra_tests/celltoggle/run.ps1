# =============================================================================
# Penumbra CELL-TOGGLE SUITE (2026-10-04)  -  a collapsible pivot's whole
# row-label cell expands/collapses its group, not just the small chevron
#
#   C  a click anywhere in a row-label cell holding a chevron toggles that group
#      ONCE (the chevron's own click still toggles once - it must not bubble into
#      a second toggle); a click on a link in the label (a data-search link, a
#      plain @@HTML anchor) stays the link's; a click that ends a text selection
#      and the second click of a double-click do nothing; a cell with no chevron
#      does nothing
#   H  css: the chevron's cell gets a pointer; hovering the cell lifts the chevron
#      (opacity 1 + a soft chip), hovering the chevron a notch more; hovering a
#      link in the label leaves the chevron at rest; the row hover is unchanged.
#      :hover cannot be driven in --dump-dom, so the harness loads main.css with
#      every ':hover' rewritten to '.pnbh' and sets that class instead.
#
#   powershell -File run.ps1                       live js/main.js + css/main.css
#   powershell -File run.ps1 -MainJs <p> -Css <p>  a staged copy
#   powershell -File run.ps1 -Mutant <name>        one behaviour reverted (below)
#   Control = -MainJs/-Css <the pre-change files>.
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\celltoggle'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -MainJs <p> -Css <p>
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Css = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\celltoggle' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $Css) { $Css = "$app\css\main.css" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }

Write-Host "[1/3] staging JS + patching main.js ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
Write-Host "      main.js under test: $MainJs"
Write-Host "      main.css under test: $Css"
$u8 = New-Object System.Text.UTF8Encoding($false)
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One single-point change each; the anchor must occur exactly once in its file.
$jsMutants = @{
  'nocell'   = @("'#pivotResultTable tbody td[data-row-field]', function (e) {", "'#pivotResultTable tbody td[data-row-field-none]', function (e) {")
  'nolink'   = @('if (own && this.contains(own)) return;', 'if (false) return;')
  'nosel'    = @('if (sel && !sel.isCollapsed && sel.containsNode(this, true)) return;', 'if (false) return;')
  'nodetail' = @('if (e.detail > 1) return;', 'if (false) return;')
  'nostop'   = @("e.stopPropagation();`r`n        togglePivotGroup(`$(this), null);", "togglePivotGroup(`$(this), null);")
}
$cssMutants = @{
  'nocursor'    = @("td[data-row-field]:has(.pivot-collapse-toggle) {`r`n    cursor: pointer;", "td[data-row-field]:has(.pivot-collapse-toggle) {`r`n    cursor: auto;")
  'nolinkhover' = @("td[data-row-field]:hover:not(:has(a:hover)) .pivot-collapse-toggle {", "td[data-row-field]:hover .pivot-collapse-toggle {")
  'nochip'      = @("background-color: color-mix(in srgb, currentColor 14%, transparent);", "background-color: transparent;")
  'nostrong'    = @("background-color: color-mix(in srgb, currentColor 26%, transparent);", "background-color: color-mix(in srgb, currentColor 14%, transparent);")
}
if ($Mutant) {
  if ($jsMutants.ContainsKey($Mutant)) { $pair = $jsMutants[$Mutant]; $isJs = $true }
  elseif ($cssMutants.ContainsKey($Mutant)) { $pair = $cssMutants[$Mutant]; $isJs = $false }
  else { throw "unknown mutant '$Mutant' (known: $((@($jsMutants.Keys) + @($cssMutants.Keys) | Sort-Object) -join ', '))" }
  $hay = if ($isJs) { $src } else { $cssText }
  $n = ([regex]::Matches($hay, [regex]::Escape($pair[0]))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $($pair[0])" }
  if ($isJs) { $src = $src.Replace($pair[0], $pair[1]) } else { $cssText = $cssText.Replace($pair[0], $pair[1]) }
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\main_css_under_test.css", $cssText, $u8)

# Hoisted function declarations only (a let/var is still in its TDZ at the anchor).
$hooks = @(
  'try { window.__CT = { pivotTable: generatePivotTable, processPivot: processPivotData, extraVals: getExtraValFields,',
  '  setPivotSettings: function (s) { currentPivotSettings = s; } };',
  '} catch (e) { window.__CT_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running harness headless ..."
$udd = Join-Path $here 'profile'
if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--window-size=1400,900','--virtual-time-budget=30000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json
[IO.File]::WriteAllText("$here\result.json", ($parsed | ConvertTo-Json -Depth 6), $u8)

Write-Host "[3/3] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0) { exit 1 }
