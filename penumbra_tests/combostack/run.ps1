# =============================================================================
# Penumbra COMBO STACK GROUPS SUITE (2026-10-06) - Stack Data on a combo chart
#
#   D  data builder: bars record their Stack group (_comboStack, 1-4, default 1),
#      lines none, no Chart.js stack id; options y2Label rides the data; a
#      distinct count of TEXT (award ids) counts the text - series values and the
#      sort-by-value order (both used to coerce every id to 1)
#   R  report renderer (renderSnippetChart): stacked = bars by group, each line
#      alone, lines on the right axis, y2Label titles it; real Chart.js geometry
#      (two stacked columns per year, segment tops at the stack totals, a count
#      line at its own value); unstacked = no stack ids, one column per bar; an
#      older stacked combo (no "stack" keys) still stacks all its bars
#   B  the chart builder, driven through its own controls (markup lifted from the
#      index.php under test): Stack Data offered on a combo, the Stack column
#      appears only when ticked, line rows hide their picker, Right Y Label only
#      with Dual Y-Axis, the PREVIEW stacks, the emitted vis() call parses back
#   X  the report renders the builder's own vis() call through renderReportSnippet
#      and draws exactly what the preview drew (datasets, stacking, axis title)
#   O  re-open: the rendered canvas's config restored into the builder brings
#      back every setting, and re-emits the same chart
#   N  Group By's Stack to 100% / Stack Order never ride a combo
#   T  the Stack Data tip on a combo is the real one, and explains the combo case
#   S  (static, here) help_content.php tips + index.php markup
#
#   powershell -File run.ps1                                  live files
#   run.ps1 -MainJs <p> -Css <p> -Index <p> -Help <p>         staged copies
#   run.ps1 -Mutant <name>                                    one behaviour reverted
#   Control = the pre-change files: every new-behaviour assertion must FAIL there.
#
# UNC .ps1 files are GPO-blocked: run it through sumfx\launch.ps1, or as a
# scriptblock. Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Css = '', [string]$Index = '', [string]$Help = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\combostack' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $Css)    { $Css = "$app\css\main.css" }
if (-not $Index)  { $Index = "$app\index.php" }
if (-not $Help)   { $Help = "$app\help\tips\viz-tips-storage.php" }   # (2026-10-19) the v1 help is gone; S3 reads the Custom Code topic too
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)
$NL = "`r`n"

Write-Host "[1/4] staging libraries ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
# The chart libraries load through the app's own loadScript('js/...'), as on the site.
New-Item -ItemType Directory -Force -Path "$here\js" | Out-Null
foreach ($f in @('chart-4.5.1.min.js','chartjs-plugin-datalabels-2.0.0.min.js','chartjs-chart-treemap-3.1.0.min.js','chartjs-chart-sankey-0.19.1.min.js','penumbra_charts.js','penumbra_geo_us.js')) {
  Copy-Item "$js\$f" "$here\js\$f" -Force
}
Write-Host "      main.js:  $MainJs"
Write-Host "      main.css: $Css"
Write-Host "      index:    $Index"
Write-Host "      help:     $Help"

$src     = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
$idxText = $u8.GetString([IO.File]::ReadAllBytes($Index))
$helpText = $u8.GetString([IO.File]::ReadAllBytes($Help)) + $u8.GetString([IO.File]::ReadAllBytes("$app\help\topics\optionsHelpLightbox.php"))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One behaviour each. An anchor must occur exactly once, or the run throws: a
# mutant that silently stopped applying would read as a vacuous pass.
$mutants = @{
  'datastack'    = @('JS', "_comboStack: 'grp' + (/^[1-4]$/.test(String(s.stack || '').trim()) ? String(s.stack).trim() : '1'),", "_comboStack: 'grp1',")
  'rstack'       = @('JS', ('Twin of the block in createVisualization.' + $NL + "        if (type === 'combo' && data.datasets) {"), ('Twin of the block in createVisualization.' + $NL + '        if (false) {'))
  'pstack'       = @('JS', ('Twin of the block in renderSnippetChart.' + $NL + "        if (chartType === 'combo' && data.datasets) {"), ('Twin of the block in renderSnippetChart.' + $NL + '        if (false) {'))
  'linestack'    = @('JS', ('Twin of the block in createVisualization.' + $NL + "        if (type === 'combo' && data.datasets) {" + $NL + '            data.datasets.forEach(function (ds, i) {' + $NL + "                if (stacked) ds.stack = (ds.type === 'line') ? ('__line' + i) : (ds._comboStack || 'grp1');"),
                         ('Twin of the block in createVisualization.' + $NL + "        if (type === 'combo' && data.datasets) {" + $NL + '            data.datasets.forEach(function (ds, i) {' + $NL + "                if (stacked) ds.stack = (ds._comboStack || 'grp1');"))
  'previewforce' = @('JS', ("options (order, 100%) never apply to a combo." + $NL + "                stackOrder = 'default';"), ("options (order, 100%) never apply to a combo." + $NL + "                stacked = false; stackOrder = 'default';"))
  'emitstack'    = @('JS', "if (s.type === 'bar' && stk !== '1' && `$('#vizStacked').is(':checked')) s.stack = stk;", '/* MUTANT emitstack */')
  'presetstack'  = @('JS', "`$row.find('.viz-combo-stack').val(/^[1-4]$/.test(stk) ? stk : '1');", "`$row.find('.viz-combo-stack').val('1');")
  'stackui'      = @('JS', "`$('#vizComboSeriesList').toggleClass('viz-combo-stacked', on);", '/* MUTANT stackui */')
  'typeswitch'   = @('JS', "`$stackCheck.prop('checked', false).prop('disabled', false);", "`$stackCheck.prop('checked', false).prop('disabled', true);")
  'restorestack' = @('JS', ("`$('#vizStacked').prop('disabled', false).prop('checked', c.stacked === true);" + $NL + "            `$('#vizStackedWrap .viz-chip').removeClass('viz-chip-dim');" + $NL + "            var _rStTipOrig"),
                         ("`$('#vizStacked').prop('checked', false).prop('disabled', true);" + $NL + "            `$('#vizStackedWrap .viz-chip').removeClass('viz-chip-dim');" + $NL + "            var _rStTipOrig"))
  'y2title'      = @('JS', ("// sized like this renderer's other axis titles." + $NL + '                title: {' + $NL + '                    display: !!data._y2Label,'), ("// sized like this renderer's other axis titles." + $NL + '                title: {' + $NL + '                    display: false,'))
  'y2collect'    = @('JS', 'if (y2l) o.y2Label = y2l;', '/* MUTANT y2collect */')
  'y2restore'    = @('JS', "`$('#vizY2AxisLabel').val(typeof _y2Saved === 'string' ? _y2Saved : '');", "`$('#vizY2AxisLabel').val('');")
  'y2show'       = @('JS', "`$('#vizY2AxisLabelWrap').toggle(on);", '/* MUTANT y2show */')
  'y2parse'      = @('JS', "if (_y2o && typeof _y2o.y2Label === 'string') out._y2Label = _y2o.y2Label.trim();", '/* MUTANT y2parse */')
  'distinct'     = @('JS', "if (s.agg === 'distinct') { m[xVal].push(yRaw || ''); return; }", '/* MUTANT distinct */')
  'distinctsort' = @('JS', "if (aggMethod === 'distinct') { agg[xVal].push(yRaw || ''); return; }", '/* MUTANT distinctsort */')
  'normemit'     = @('JS', "so = 'default'; nm = false;   // Group By stack options never apply to a combo", '/* MUTANT normemit */')
  'stackopts'    = @('JS', "if (isStacked && `$('.viz-type-option.active').data('type') !== 'combo') {", 'if (isStacked) {')
  'tiporig'      = @('JS', "if (_stTipOrig) `$('#vizStackedWrap .viz-chip').attr('data-tip', _stTipOrig);", '/* MUTANT tiporig */')
  'css'          = @('CSS', '#vizComboSeriesList.viz-combo-stacked .viz-combo-stack { display: block; }', '/* MUTANT css */')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $kind = $mutants[$Mutant][0]; $mOld = $mutants[$Mutant][1]; $mNew = $mutants[$Mutant][2]
  if ($kind -eq 'CSS') {
    $n = ([regex]::Matches($cssText, [regex]::Escape($mOld))).Count
    if ($n -ne 1) { throw "mutant '$Mutant' css anchor found $n times, expected 1" }
    $cssText = $cssText.Replace($mOld, $mNew)
  } else {
    $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
    if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
    $src = $src.Replace($mOld, $mNew)
  }
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\main_css_under_test.css", $cssText, $u8)

Write-Host "[2/4] building the harness page ..."
# The builder markup: index.php's #visualizationLightbox block, up to the next PHP
# control line, with any <?php ... ?> comment inside stripped.
$lbStart = $idxText.IndexOf('<div id="visualizationLightbox"')
$lbEnd = $idxText.IndexOf('<?php if ($canEditLoadedReport): ?>', [Math]::Max(0, $lbStart))
if ($lbStart -lt 0 -or $lbEnd -lt 0) { throw "builder markup not found in $Index" }
$lightbox = [regex]::Replace($idxText.Substring($lbStart, $lbEnd - $lbStart), '(?s)<\?php.*?\?>', '')
if ($lightbox -match '<\?') { throw "PHP left in the lifted builder markup" }
$tpl = $u8.GetString([IO.File]::ReadAllBytes("$here\harness.html"))
if (-not $tpl.Contains('<!--VIZ_LIGHTBOX-->')) { throw "harness.html lost its <!--VIZ_LIGHTBOX--> marker" }
[IO.File]::WriteAllText("$here\harness_built.html", $tpl.Replace('<!--VIZ_LIGHTBOX-->', $lightbox), $u8)

# Hoisted function declarations only; anything else is read through a function,
# when the harness calls it (a let/var is still in its TDZ at the anchor).
$hooks = @(
  'try { window.__CS = { chartData: generateChartDataFromMaps, renderSnip: renderSnippetChart, createViz: createVisualization,',
  '  resetViz: resetVisualizationForm, populateCols: populateVisualizationColumns, restore: restoreVizConfig,',
  '  collectOpts: _vizCollectVizOptions, updateStackOptions: updateStackOptions,',
  '  renderSnippet: renderReportSnippet, enumVis: enumerateVisCallsInEditor,',
  '  loadChartModule: penumbraLoadChartModule, loadScript: loadScript,',
  '  setSnippet: function (t) { snippetEditor.setValue(t); } };',
  '} catch (e) { window.__CS_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[3/4] running the harness headless ..."
$udd = Join-Path $here 'profile'
if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness_built.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--window-size=1400,1000','--virtual-time-budget=60000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(240000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json

# S: static checks on the help and the markup, in the same result list.
$static = @(
  @{ name = 'S1 help: a viz-series-stack tip exists'; pass = $helpText.Contains('<div data-tip="viz-series-stack">') },
  @{ name = 'S2 help: a viz-y2-label tip exists'; pass = $helpText.Contains('<div data-tip="viz-y2-label">') },
  @{ name = 'S3 help: arg 31 documents the "stack" key, arg 41 y2Label'; pass = ($helpText.Contains('A bar series may carry <code>"stack"</code>') -and $helpText.Contains('<strong><code>y2Label</code></strong>')) },
  @{ name = 'S4 index: the Right Y Label field, hidden by default, with its tip'; pass = ($idxText -match '<div class="viz-fld" id="vizY2AxisLabelWrap" style="[^"]*display:none"' -and $idxText.Contains('<input type="text" id="vizY2AxisLabel"') -and $idxText.Contains('data-tip="viz-y2-label"')) }
)

Write-Host "[4/4] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
if ($parsed.dialogs -and $parsed.dialogs.Count) { Write-Warning "native dialogs raised: $($parsed.dialogs -join '; ')" }
$all = @($parsed.results) + @($static | ForEach-Object { [pscustomobject]@{ name = $_.name; pass = [bool]$_.pass; detail = '' } })
[IO.File]::WriteAllText("$here\result.json", ($all | ConvertTo-Json -Depth 6), $u8)
$fail = 0
foreach ($r in $all) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name + "  -- " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed{2}" -f $all.Count, $fail, $(if ($Mutant) { " (mutant $Mutant)" } else { '' }))
if ($fail) { exit 1 } else { exit 0 }
