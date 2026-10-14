# =============================================================================
# Penumbra FY-REPORTS SUITE (2026-09-25)  -  engine changes made for the
# ?id=fycompawd / ?id=fycompprop reports
#
#   T  combo / butterfly series labels resolve {COLUMN} tokens
#   G  a combo LINE ends at the last category its series has rows for (null
#      after it); bars and between-point gaps keep their old values; Pareto
#      rescales against the last REAL point
#   B  an empty pivot data cell renders blank, not 0 / $0 (formatPivotValue(''))
#   H  an EMPTY row-total override ([] / RowTotals = hide) drops the Grand
#      Total COLUMN (header, sub-headers, body, footer corner); the footer ROW stays
#   C  row-total OVERRIDE cells take the currency of the value they total;
#      C3-C6 (2026-09-26) the corner under a row- or column-total override
#      totals each slot's OWN value (it merged the first value's column)
#   U  builder: ticking Override Row Totals prefills pristine defaults (= no
#      override), the box x clears a value, all cleared = [] / 'hide', and
#      'hide' survives the trigger parser and a settings repopulate
#   S  css: the toggle_switch hover armor and the box-x rule exist at a
#      specificity the per-theme blanket button rules cannot beat
#   F  (2026-09-26) format() on a % Change pivot hides exactly the -100% cells
#   D  % Change (to date): blank where the newer column has no rows, like for
#      like Grand Total row / column / corner; R running totals blank after
#      their last period with data; L combo label room only for series that
#      print outside labels; W a % width leaves room for a flex row's gaps
#   M  (2026-09-26) a derived value's '$' follows its BASE's column (the real
#      penumbraPivotCurrencyFlags over the results table's column properties)
#   P  (2026-09-26) the search builder's live count (_previewPivotAggMatch)
#      computes % Change (to date) the way the executed search does
#   A  (2026-09-26) "auto" combo / butterfly series colours: Palette slots by
#      filter at draw time, and the builder (resetVisualizationForm through a
#      hook) saving "auto", repainting swatches, the corner arrow
#   R4 R5 (2026-09-26) the browser's Grand Total row of a down-running column,
#      the reference test_rundown.php holds the scheduled builders to
#   K  (2026-09-26) which pivot cells a format(cell / header) target selects: a
#      LABEL beats the Values field (data, Grand Total row + corner), a shared
#      label styles all its columns, pivot headers take one-sided borders
#   J  (2026-09-26) every writer of the pivot re-applies format(header) rules;
#      U8 pins the emptied row-total box's wording
#   Q  (2026-09-26) the Custom Code double-click menu lists the pivot's columns
#      (first inside format()/heatmap(), never inside sum() ...) - pass
#      -SnipHelp <staged js/penumbra_snippet_help.js> to test a staged module
#   V  (2026-09-26) format() CONDITIONS on a label two value columns share
#      ("%Δ" after Amount and after Count): a cell reads its own value, another
#      column the one on its base - data cells and group-summary rows
#   126 assertions. Live before the shared-label change fails exactly V1 V2 V3
#   V4; the README's section 3 lists the older controls and all twenty-six
#   mutants with their counts.
#
#   powershell -File run.ps1                      live js/main.js + css/main.css
#   powershell -File run.ps1 -MainJs <p> -Css <p> a staged copy
#   powershell -File run.ps1 -Mutant <name>       one behaviour reverted (below)
#   Control = -MainJs <the pre-change main.js>: every T/G/B/H/C/U assertion that
#   describes new behaviour must FAIL there.
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\fyreports'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# PHP side (runner builders): php -n test_rowtotals.php [--runner=<path>] [--mutant]
#   and php -n test_gtvalues.php [--runner=<path>] [--mutant=<name>] (2026-09-25
#   evening): every Grand Total cell's NUMBER and '$' in the email body, CSV and
#   XLSX - no override (slot i = value i; CSV/XLSX used to repeat value 0), an
#   override, a derived slot, a column-total override. 67 checks; the pre-fix
#   runner fails 39; mutants map curcsv curxlsx curhtml corner curfoot each fail
#   only their own builder's checks. Since 2026-09-26 also test_todate.php (% Change
#   (to date) + running-total trailing blanks, 51 checks), test_curbase.php (a
#   derived value's '$' from its base, 26 checks), test_rundown.php (a
#   down-running column's Grand Total row, 12 checks), test_fmttarget.php (which
#   email-body cells a format(cell) target styles, 3 checks) and test_condlabels.php
#   (format(cell) conditions on a shared label in the email body, 7 checks), same
#   --runner / --mutant flags.
# =============================================================================
param([string]$MainJs = '', [string]$Css = '', [string]$Mutant = '', [string]$SnipHelp = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\fyreports' }
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
# -SnipHelp <path> (2026-09-26): a staged js/penumbra_snippet_help.js (harness Q).
if ($SnipHelp) { Copy-Item $SnipHelp "$here\penumbra_snippet_help.js" -Force }
Write-Host "      main.js under test: $MainJs"
Write-Host "      main.css under test: $Css"
Write-Host ("      snippet help under test: " + $(if ($SnipHelp) { $SnipHelp } else { "$js\penumbra_snippet_help.js" }))
$u8 = New-Object System.Text.UTF8Encoding($false)
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One single-point change each. The anchor must occur exactly once, or the run
# throws: a mutant that silently stopped applying would read as a vacuous pass.
$mutants = @{
  'tokens'    = @('if (!label || String(label).indexOf(''{'') === -1) return label;', 'return label;')
  'gaps'      = @('for (var _lg = _lastHit + 1; _lg < sData.length; _lg++) sData[_lg] = null;', '/* MUTANT gaps */')
  'blank'     = @("if (value === null || value === undefined || value === '')", 'if (value === null || value === undefined)')
  'gtcol'     = @('var _showRowTotalsCol = !(Array.isArray(totalRowAggs) && totalRowAggs.length === 0);', 'var _showRowTotalsCol = true;')
  'curidx'    = @('var _rtCurIdx = (_rtBaseIdxForDrill !== -1) ? _rtBaseIdxForDrill : undefined;', 'var _rtCurIdx = undefined;')
  'pristine'  = @('if ($slots.attr(''data-rt-pristine'') === ''1'') return null;', '/* MUTANT pristine */')
  'hideparse' = @('if (pRowTotals && pRowTotals.toLowerCase() === ''hide'') {', 'if (false) {')
  'hoverarmor'= @('CSS', '.pnb-toggle .pnb-toggle-btn:hover:not(:disabled),')
  'cornerov'  = @('var _crVals = (_crBaseIdx === -1) ? allValuesCorner : _cornerBucketValues(_crBaseIdx);', 'var _crVals = allValuesCorner;')
  'cornercol' = @('if (!_isDerivedAgg(aggTypes[idx])) { allValsForPos = _cornerBucketValues(idx); } else {', 'if (false) { } else {')
  'tdcell'    = @('if (_pctTd[aggIdx] && !_pivotCellHasRows(cellData, aggIdx)) {', 'if (false) {')
  'tdtotals'  = @('var keys = allRowKeys.filter(function (rk) { return _pivotCellHasRows(data[rk] && data[rk][newColKey], baseIdx); });', 'var keys = allRowKeys.slice();')
  'runtrail'  = @('if (_trailBlank) displayValue = null;', '/* MUTANT runtrail */')
  'labelroom' = @("if (opts.type === 'combo' || opts.type === 'butterfly') {", 'if (false) {')
  'gapwidth'  = @('var gap = (f < 1) ? penumbraVizBaseGap(opts.baseEl) : 0;', 'var gap = 0;')
  'curbase'   = @('var src = (aggTypes && aggTypes[i] && _pivotInheritsBaseUnits(aggTypes[i])) ? penumbraPivotBaseAggIdx(aggTypes, i) : i;', 'var src = i;')
  'previewtd' = @('if (at === ''pct_change_td'' && _pTdRows === 0) derivedMap[_dr][ck][ai] = null;', 'if (false) derivedMap[_dr][ck][ai] = null;')
  'autoslot'  = @('var key = fe ? ''f:'' + fe : ''i:'' + i;', 'var key = ''i:'' + i;')
  'autorender'= @('var sColor = (_autoSlots[si] >= 0) ? _penumbraPaletteHex(_autoSlots[si]) : (s.color || ''#336699'');', 'var sColor = s.color || ''#336699'';')
  'autosave'  = @('color: ($(this).attr(''data-color-auto'') === ''1'') ? ''auto'' : ($(this).find(''.viz-combo-color'').val() || ''#336699'')', 'color: ($(this).find(''.viz-combo-color'').val() || ''#336699'')')
  'celltarget'= @('return target === valField && !_cellRuleLabels[target];', 'return target === valField;')
  'headerside'= @('''border-left'': 1, ''border-right'': 1, ''border-top'': 1, ''border-bottom'': 1 };', '};')
  'hdrload'   = @('applyPivotHeaderFormatting();   // header rules: the snippet re-render', '/* MUTANT hdrload */')
  'condlabel' = @('pairs.push([order[o], pick]);', 'pairs.push([order[o], ids[ids.length - 1]]);')
  'condgroup' = @('if (group(ids[k]) === group(c)) { pick = ids[k]; break; }', 'if (false) { pick = ids[k]; break; }')
  # 'SNIP' mutants change the harness's copy of js/penumbra_snippet_help.js instead.
  'pivothints'= @('SNIP', 'if (callName && PIVOT_COLUMN_FNS[callName]) return pivotColumnHints.concat(list);', 'if (false) return pivotColumnHints.concat(list);')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  if ($mOld -eq 'CSS') {
    $n = ([regex]::Matches($cssText, [regex]::Escape($mNew))).Count
    if ($n -ne 1) { throw "mutant '$Mutant' css anchor found $n times, expected 1" }
    $cssText = $cssText.Replace($mNew, '.pnb-toggle .MUTANT-no-armor:hover:not(:disabled),')
  } elseif ($mOld -eq 'SNIP') {
    $snipOld = $mutants[$Mutant][1]; $snipNew = $mutants[$Mutant][2]
    $snipText = $u8.GetString([IO.File]::ReadAllBytes("$here\penumbra_snippet_help.js"))
    $n = ([regex]::Matches($snipText, [regex]::Escape($snipOld))).Count
    if ($n -ne 1) { throw "mutant '$Mutant' snippet-help anchor found $n times, expected 1: $snipOld" }
    [IO.File]::WriteAllText("$here\penumbra_snippet_help.js", $snipText.Replace($snipOld, $snipNew), $u8)
  } else {
    $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
    if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
    $src = $src.Replace($mOld, $mNew)
  }
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\main_css_under_test.css", $cssText, $u8)

# Hoisted function declarations only (a let/var is still in its TDZ at the anchor).
$hooks = @(
  'try { window.__FY = { chartData: generateChartDataFromMaps, pivotTable: generatePivotTable,',
  '  processPivot: processPivotData, extraVals: getExtraValFields,',
  '  setPivotSettings: function (s) { currentPivotSettings = s; },',
  '  repopulate: repopulatePivotLightboxFromCurrentState, rebuildRT: rebuildRowTotalSlots,',
  '  rtTokens: getRowTotalTokens, rtLabels: getRowTotalCustomLabels, rtBase: getRowTotalBaseIndices,',
  '  buildTrigger: penumbraBuildPivotTriggerFromUI, aggTokens: getAggregationTokens,',
  '  setFormatRules: function (r) { conditionalFormattingRules = r; }, parseQuery: parseAdvancedQuery,',
  '  labelRoom: penumbraValueLabelRoom, vizDim: penumbraResolveVizDim, curFlags: penumbraPivotCurrencyFlags,',
  '  previewAgg: (typeof _previewPivotAggMatch === ''function'' ? _previewPivotAggMatch : null),',
  '  setPivotSource: function (d) { pivotMasterDataSource = d; },',
  '  palHex: (typeof _penumbraPaletteHex === ''function'' ? _penumbraPaletteHex : null),',
  '  resetViz: (typeof resetVisualizationForm === ''function'' ? resetVisualizationForm : null),',
  '  chartDataRaw: (typeof _generateChartDataFromMaps === ''function'' ? _generateChartDataFromMaps : null),',
  '  setPalette: function (p) { _penumbraActivePalette = p; },',
  '  headerFmt: (typeof applyPivotHeaderFormatting === ''function'' ? applyPivotHeaderFormatting : null) };',
  '} catch (e) { window.__FY_ERR = String(e); }'
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
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0) { exit 1 }
