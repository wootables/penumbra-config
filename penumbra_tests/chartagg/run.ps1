# =============================================================================
# Penumbra CHART AGGREGATION FOLLOW-UPS SUITE (2026-10-06), after ..\chartdistinct
#
#   S  map / bullet / funnel / waterfall / gauge: Median is the median, Running
#      Count a count (both used to fall to the default and SUM the values)
#   O  every "Other" bucket re-aggregates the folded categories' POOLED values for
#      the non-additive aggregations (Average, Median, Min, Max, Distinct,
#      percentiles, ...) - it used to ADD UP the per-category results. Sum and
#      Count keep their old arithmetic.
#   P  categories / groups named __proto__, constructor, toString, hasOwnProperty,
#      valueOf chart like any other (plain {} maps keyed by the data threw,
#      dropped or mis-counted them)
#   K  (second round, git after 7c521c1) label and group are joined by '\u0001',
#      not '_': label "a_b" in group "c" and label "a" in group "b_c" were both
#      keyed "a_b_c" and merged (generic path and older butterfly); the ungrouped
#      Other reads each folded item's rows by the key the item kept
#   N  (second round) a Sum / Count / Running "Other" keeps its sign on bar / line /
#      pie (grouped or not) and the older butterfly: it added ABSOLUTE values, so
#      -3 and -7 folded into +10. Treemap tiles stay sizes (guard N5).
#
#   Two of the maps made prototype-free have NO mutant, on purpose - reverting
#   them changes nothing observable: the grouped bar's topLabelSet (an inherited
#   truthy value keeps a folded label in topItems, but only data.labels reach the
#   chart) and the older butterfly's aggData (every key holds a '\u0001', so no
#   key can spell "__proto__").
#
#   run.ps1                      live js/main.js
#   run.ps1 -MainJs <p>          a staged copy
#   run.ps1 -Mutant <name>       one fix reverted (below); needs the FIXED main.js
#   Control = the pre-fix main.js: every new-behaviour assertion must FAIL there.
#   Second-round control = 56bddb618e70 (git 7c521c1): only K1 K2 N1-N4 fail.
#
# UNC .ps1 files are GPO-blocked: run through sumfx\launch.ps1, or as a scriptblock.
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chartagg' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)
$NL = "`r`n"

Write-Host "[1/3] staging libraries ..."
foreach ($f in @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js','show-hint.js',
                 'foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js','purify.min.js','penumbra_template.js')) {
  Copy-Item "$js\$f" "$here\$f" -Force
}
New-Item -ItemType Directory -Force -Path "$here\js" | Out-Null
foreach ($f in @('penumbra_charts.js','penumbra_geo_us.js')) { Copy-Item "$js\$f" "$here\js\$f" -Force }
Write-Host "      main.js: $MainJs"
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One fix reverted each. An anchor must occur exactly once, or the run throws.
$ADD = "if (aggregation === 'sum' || aggregation === 'count' || aggregation === 'running_total' || aggregation === 'running_count') {"
$I20 = '                    '
$ON = 'Object.create(null)'
$mutants = @{
  # S: Median / Running Count on the specialty types, and the restart at 0
  'blmedian'  = @("Object.keys(blValsMap).forEach(function (k) { blAgg[k] = _comboAggregateVals(blValsMap[k], 'median'); });", '/* MUTANT */')
  'fnmedian'  = @("Object.keys(fnValsMap).forEach(function (k) { fnAgg[k] = _comboAggregateVals(fnValsMap[k], 'median'); });", '/* MUTANT */')
  'wfmedian'  = @("Object.keys(wfValsMap).forEach(function (k) { wfAgg[k] = _comboAggregateVals(wfValsMap[k], 'median'); });", '/* MUTANT */')
  'mpmedian'  = @("Object.keys(mpVals).forEach(function (k) { mpAgg[k] = _comboAggregateVals(mpVals[k], 'median'); });", '/* MUTANT */')
  'ggmedian'  = @("case 'median': ggValue = ggVals.length ? _comboAggregateVals(ggVals, 'median') : 0; break;", '/* MUTANT */')
  'blrc'      = @("case 'running_count': blAgg[xVal] = blCount[xVal]; break;", '/* MUTANT */')
  'fnrc'      = @("case 'running_count': fnAgg[xVal] = fnCount[xVal]; break;", '/* MUTANT */')
  'wfrc'      = @("case 'running_count': wfAgg[xVal] = wfCount[xVal]; break;", '/* MUTANT */')
  'mprc'      = @("case 'running_count': mpAgg[st] = mpCount[st]; break;", '/* MUTANT */')
  'ggrc'      = @("case 'running_count': ggValue = rowDataMaps.length; break;", '/* MUTANT */')
  'blzero'    = @("if (!blValsMap[xVal]) { blAgg[xVal] = 0;", "if (!blAgg[xVal]) { blAgg[xVal] = 0;")
  'fnzero'    = @("if (!fnValsMap[xVal]) { fnAgg[xVal] = 0;", "if (!fnAgg[xVal]) { fnAgg[xVal] = 0;")
  'wfzero'    = @("if (!wfValsMap[xVal]) { wfAgg[xVal] = 0;", "if (!wfAgg[xVal]) { wfAgg[xVal] = 0;")
  # O: the pooled "Other" buckets
  'tmother'   = @(($ADD + $NL + $I20 + 'for (var oi = limit; oi < allEntries.length;'), ('if (true) {' + $NL + $I20 + 'for (var oi = limit; oi < allEntries.length;'))
  'tmcollect' = @("if (aggregation === 'median' || aggregation === 'distinct' || aggregation === 'avg' || aggregation === 'min' || aggregation === 'max'", "if (aggregation === 'median' || aggregation === 'distinct'")
  'fnother'   = @(($ADD + $NL + $I20 + 'for (var foi = limit;'), ('if (true) {' + $NL + $I20 + 'for (var foi = limit;'))
  'wfother'   = @(($ADD + $NL + $I20 + 'for (var woi = limit;'), ('if (true) {' + $NL + $I20 + 'for (var woi = limit;'))
  'gother'    = @(($ADD + $NL + $I20 + 'processed.forEach(function (item) {'), ('if (true) {' + $NL + $I20 + 'processed.forEach(function (item) {'))
  'uother'    = @(($ADD + $NL + $I20 + 'for (var oi = limit; oi < processed.length;'), ('if (true) {' + $NL + $I20 + 'for (var oi = limit; oi < processed.length;'))
  'bfother'   = @("var _bfOtherAdds = (aggregation === 'sum' || aggregation === 'count' || aggregation === 'running_total' || aggregation === 'running_count');", 'var _bfOtherAdds = true;')
  # P: the data-keyed maps back to plain {}
  'paggregated'   = @("const aggregatedData = $ON;", 'const aggregatedData = {};')
  'plabelscores'  = @("const labelScores = $ON;", 'const labelScores = {};')
  'premaining'    = @("var remainingLabelsSet = $ON;", 'var remainingLabelsSet = {};')
  'potherbygroup' = @("var otherByGroup = $ON;", 'var otherByGroup = {};')
  'pgroupedmap'   = @("var groupedMap = $ON;", 'var groupedMap = {};')
  'pgroupednest'  = @("groupedMap[item.group] = $ON;", 'groupedMap[item.group] = {};')
  'pbullet'       = @("var blAgg = $ON, blCount = $ON, blValsMap = $ON;", 'var blAgg = {}, blCount = {}, blValsMap = {};')
  'pfunnel'       = @("var fnAgg = $ON, fnCount = $ON, fnValsMap = $ON;", 'var fnAgg = {}, fnCount = {}, fnValsMap = {};')
  'pwaterfall'    = @("var wfValsMap = $ON;", 'var wfValsMap = {};')
  'pcomboagg'     = @(("var agg = $ON;" + $NL), ('var agg = {};' + $NL))
  'pcombom'       = @("var m = $ON;   // keyed by the data (2026-10-06)", 'var m = {};')
  'plabelscoremap'= @("var _labelScoreMap = $ON;", 'var _labelScoreMap = {};')
  'ptoplabelsset' = @("var topLabelsSet = $ON;", 'var topLabelsSet = {};')
  'pbfly'         = @("var agg = $ON;   // keyed by the data (2026-10-06)", 'var agg = {};')
  'pallabels'     = @("var allLabels = $ON;", 'var allLabels = {};')
  'pbflyscores'   = @("var labelScores = $ON;", 'var labelScores = {};')
  'pgmap'         = @("const gMap = $ON;", 'const gMap = {};')
  'pgmapnest'     = @("if (!gMap[item.group]) gMap[item.group] = $ON;", 'if (!gMap[item.group]) gMap[item.group] = {};')
  'pbox'          = @("var bxRaw = $ON;", 'var bxRaw = {};')
  'pgantt'        = @("var gtMap = $ON;", 'var gtMap = {};')
  # K: label + group keys (second round)
  'kgeneric'  = @("const key = groupBy ? xVal + '\u0001' + groupVal : xVal;", "const key = groupBy ? xVal + '_' + groupVal : xVal;")
  'kbfly'     = @("const key = xVal + '\u0001' + groupVal;", "const key = xVal + '_' + groupVal;")
  'kukey'     = @('var _uIt = aggregatedData[processed[uo]._key];', "var _uIt = aggregatedData[groupBy ? (processed[uo].label + '_' + processed[uo].group) : processed[uo].label];")
  # N: signed Sum Others (second round)
  'nungrouped'= @('otherSum += processed[oi].value;', 'otherSum += Math.abs(processed[oi].value);')
  'ngrouped'  = @('otherByGroup[item.group] += item.value;', 'otherByGroup[item.group] += Math.abs(item.value);')
  'nbfly'     = @('otherSum += (gMap[grp][lbl] || 0);', 'otherSum += Math.abs(gMap[grp][lbl] || 0);')
  'nbflypool' = @('otherSum = _bfPool.length ? _comboAggregateVals(_bfPool, aggregation) : 0;', 'otherSum = _bfPool.length ? Math.abs(_comboAggregateVals(_bfPool, aggregation)) : 0;')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
$hooks = 'try { window.__CA = { chartData: generateChartDataFromMaps, loadChartModule: penumbraLoadChartModule }; } catch (e) { window.__CA_ERR = String(e); }'
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running the harness headless ..."
$udd = Join-Path $here 'profile'
if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom',$url)
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
  else { $fail++; Write-Host ("  FAIL  " + $r.name + "  -- " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed{2}" -f $parsed.results.Count, $fail, $(if ($Mutant) { " (mutant $Mutant)" } else { '' }))
if ($fail) { exit 1 } else { exit 0 }
