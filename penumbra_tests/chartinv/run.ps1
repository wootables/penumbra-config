# =============================================================================
# Penumbra CHART INVARIANTS SUITE (2026-10-13) - the whole chart system, by rule
#
# Not one feature: three rules that must hold for EVERY chart type, checked by
# driving the real main.js (hooks into its closure, as combostack does) over one
# deterministic fixture.
#
#   C  CLICKS ADD UP. Each element of each chart, clicked through the app's own
#      _buildChartClickCriteria, lists rows whose aggregate equals the value the
#      chart drew for that element (bar/line/pie/doughnut/radar/treemap/sankey/
#      sunburst/map/funnel/bullet/histogram/waterfall, sum/count/avg/min/max/
#      median/distinct, Other buckets, groups, bucketed axes).
#   R  REOPENING IS EXACT. Builder form -> vis() -> the app's parser -> restore
#      -> vis() again is the identical call; the same through a preset snapshot.
#   L  SWITCHING TYPES DOES NOT LEAK. For every A -> B of the type picker, every
#      control's state at B is the same whatever A was; and the click path and
#      the restore path agree on B's controls.
#   P  PREVIEW = REPORT. The Builder preview and the report's snippet render of
#      the same code draw the same labels/values/series (18 types).
#   A  A11Y TABLE. Every rendered chart has its aria-label and a hidden table
#      whose rows and cells match what was drawn.
#   F  FILTER PANEL. Unticking one value loses exactly that value's rows (blank
#      = "Unknown"), and the clicks still add up afterwards.
#   D  DRILL-INTO. A drilled element's child chart totals the element.
#   E  (export) writes vischarts/fixture_alltypes_*; vischarts section T then
#      renders every type in an email (run test_vischarts.php after this).
#
#   powershell -File run.ps1                              live files
#   run.ps1 -MainJs <p> -ChartsJs <p> -Index <p>          staged copies
#   run.ps1 -Only C|R|L|P|F|D                             one section
#
# UNC .ps1 files are GPO-blocked: run it as a scriptblock. Writes nothing to the
# webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$ChartsJs = '', [string]$Index = '', [string]$Css = '', [string]$Only = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chartinv' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs)   { $MainJs = "$js\main.js" }
if (-not $ChartsJs) { $ChartsJs = "$js\penumbra_charts.js" }
if (-not $Index)    { $Index = "$app\index.php" }
if (-not $Css)      { $Css = "$app\css\main.css" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)

Write-Host "[1/4] staging libraries ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js','penumbra_a11y.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
New-Item -ItemType Directory -Force -Path "$here\js" | Out-Null
foreach ($f in @('chart-4.5.1.min.js','chartjs-plugin-datalabels-2.0.0.min.js','chartjs-chart-treemap-3.1.0.min.js','chartjs-chart-sankey-0.19.1.min.js','penumbra_geo_us.js')) {
  Copy-Item "$js\$f" "$here\js\$f" -Force
}
Copy-Item $ChartsJs "$here\js\penumbra_charts.js" -Force
Copy-Item $Css "$here\main_css_under_test.css" -Force
Write-Host "      main.js:   $MainJs"
Write-Host "      charts.js: $ChartsJs"
Write-Host "      index:     $Index"

$src     = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$idxText = $u8.GetString([IO.File]::ReadAllBytes($Index))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

Write-Host "[2/4] building the harness page ..."
$lbStart = $idxText.IndexOf('<div id="visualizationLightbox"')
$lbEnd = $idxText.IndexOf('<?php if ($canEditLoadedReport): ?>', [Math]::Max(0, $lbStart))
if ($lbStart -lt 0 -or $lbEnd -lt 0) { throw "builder markup not found in $Index" }
$lightbox = [regex]::Replace($idxText.Substring($lbStart, $lbEnd - $lbStart), '(?s)<\?php.*?\?>', '')
if ($lightbox -match '<\?') { throw "PHP left in the lifted builder markup" }
$tpl = $u8.GetString([IO.File]::ReadAllBytes("$here\harness.html"))
if (-not $tpl.Contains('<!--VIZ_LIGHTBOX-->')) { throw "harness.html lost its <!--VIZ_LIGHTBOX--> marker" }
$tpl = $tpl.Replace('<!--VIZ_LIGHTBOX-->', $lightbox).Replace('__ONLY__', $Only)
[IO.File]::WriteAllText("$here\harness_built.html", $tpl, $u8)

# Hoisted function declarations only (a let/var is still in its TDZ at the anchor).
$hooks = @(
  'try { window.__CI = { chartData: generateChartDataFromMaps, renderSnip: renderSnippetChart, createViz: createVisualization,',
  '  resetViz: resetVisualizationForm, populateCols: populateVisualizationColumns, restore: restoreVizConfig,',
  '  collectOpts: _vizCollectVizOptions, enumVis: enumerateVisCallsInEditor,',
  '  criteria: _buildChartClickCriteria, probe: _chartDrillProbe, parseNum: parseAccountingNumber,',
  '  snapshot: _buildVizSnapshotFromForm, applySnap: _vizApplySnapshotToForm,',
  '  parseFilter: safeParseFilter, evalFilter: evaluateParsedQuery,',
  '  loadChartModule: penumbraLoadChartModule, loadScript: loadScript,',
  '  renderSnippet: renderReportSnippet, updatePanel: updateFilterPanelStatus, drillInPlace: _drillChartInPlace,',
  '  rowsByPath: _filterRowsByPath, panelExclusions: _applyChartPanelExclusions,',
  '  setSnippet: function (t) { snippetEditor.setValue(t); } };',
  '} catch (e) { window.__CI_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[3/4] running the harness headless ..."
$udd = Join-Path $here ('profile_' + (Get-Date -Format 'HHmmssfff'))
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { [IO.File]::Delete($dom) }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness_built.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--window-size=1400,1000','--virtual-time-budget=300000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(540000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(600,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json

Write-Host "[4/4] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host ("  page errors: " + ($parsed.pageErrors -join '; ')) }
if ($parsed.dialogs -and $parsed.dialogs.Count) { Write-Host ("  native dialogs: " + ($parsed.dialogs -join '; ')) }
$exports = @($parsed.results | Where-Object { $_.export })
$all = @($parsed.results | Where-Object { -not $_.export })
[IO.File]::WriteAllText("$here\result.json", ($all | ConvertTo-Json -Depth 6), $u8)
# E: the builder's own vis() call per type + the fixture rows, for the vischarts
# suite's real email / PDF render (section T of test_vischarts.php).
$vcDir = Join-Path (Split-Path $here -Parent) 'vischarts'
$fx = $exports | Where-Object { $_.name -eq 'EXPORT fixture' } | Select-Object -First 1
$codes = $exports | Where-Object { $_.name -like 'EXPORT code *' } | ForEach-Object { $_.name.Substring(12) + "`t" + $_.detail }
if ($fx -and $codes) {
  [IO.File]::WriteAllText("$vcDir\fixture_alltypes.csv", $fx.detail, $u8)
  [IO.File]::WriteAllText("$vcDir\fixture_alltypes_codes.txt", ($codes -join "`n"), $u8)
  Write-Host ("      exported {0} vis() calls + the fixture for vischarts section T" -f @($codes).Count)
}
$fail = 0
foreach ($r in $all) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name + "  -- " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $all.Count, $fail)
if ($fail) { exit 1 } else { exit 0 }
