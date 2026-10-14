# =============================================================================
# Penumbra PIVOTSRC suite (2026-09-28): a name a pivot aggregate label shares with a
# source column (?id=sponawd: the "Amount" label on the AMOUNT column).
#
# The report's own search reads the shared name as the pivot AGGREGATE (what is on
# screen is what is searched); a leading __SRC hands it back to the column (filter
# the transactions, then re-pivot). A scheduled email never filters pivot cells
# (penumbra_search.php has no pivot step), so the task form's count and the
# scheduler's builder use that email reading, with a warning under the count.
#
#   E0-E13  runTableSearch executed on a real pivot (fixture.json), both readings; E10 a
#           DEFAULT label (Count) on a same-named column; E11/E11b one aggregate: the value
#           column's name is the column, read once (the single-aggregate alias is gone)
#   V*      the builder's preview count (countMatchingRows) == the executed search
#   F1-F3   flat view: __SRC is a no-op, __ROW previews like the search, __ALL stays a term
#   B1-B14  the Visual Search Builder: column lists per mode, the __SRC box, round trips,
#           the toggle keeping each row's column and a {COLUMN} reference
#   H1-H5   the task form's hint (updateSchedFilterHint): email count + the warning
#   A1      the search bar's autocomplete lists the shared name under Pivot Aggregates
#   M0-M15  browser email reading == penumbra_search.php, query by query (cross-engine)
#   P1-P11  penumbraStripSrcModifier() + the runner's grouped-summary path (PHP)
# 92 assertions. Controls: the pre-__SRC build (*.bak-20260928-pivotsrc) fails 49, the build
# before the alias fix (main.js.bak-20260928-singleagg) exactly E11b. Mutants: engine 10,
# preview 6, take 2, email 11, alias 4, aliaspreview 2, note 2, hintemail 1, list 5,
# reselect 3, sbemail 1, phpstrip 3, runnerstrip 1, rowstrip 4, allstrip 3 - each only its own.
#
#   powershell -File run.ps1                          live app files
#   powershell -File run.ps1 -App <dir>               a staged app dir (js\main.js,
#        js\search_builder.js, search_builder_content.php, penumbra_search.php,
#        schedule_runner.php are read from it; libraries always from the live js\)
#   powershell -File run.ps1 -Mutant <name>           one behaviour reverted (below)
# Writes nothing to the webroot. Exit 1 when any assertion fails - which, run as a
# scriptblock, ends the calling session too: run it on its own.
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotsrc'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
# =============================================================================
param([string]$App = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotsrc' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$extract = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)
function Read-U8([string]$p) { return $u8.GetString([IO.File]::ReadAllBytes($p)) }

# One single-point change each; the anchor must occur exactly once in its file.
$mutants = @{
  'engine'     = @('main', 'const aggNamesUpper = penumbraPivotSearchAggNames(aggLabelsUpper, penumbraPivotSourceNamesUpper(sourceData), searchSourceRows);', 'const aggNamesUpper = penumbraPivotSearchAggNames(aggLabelsUpper, penumbraPivotSourceNamesUpper(sourceData), false);')
  'preview'    = @('main', 'var aggNamesUpper = penumbraPivotSearchAggNames(aggLabelsUpper, penumbraPivotSourceNamesUpper(sourceData), srcRows);', 'var aggNamesUpper = penumbraPivotSearchAggNames(aggLabelsUpper, penumbraPivotSourceNamesUpper(sourceData), false);')
  'take'       = @('main', 'var head = (/^(?:__(?:ALL|ROW|SRC)\s+)*/i.exec(q) || [''''])[0];', 'var head = (/^(?:__SRC\s+)*/i.exec(q) || [''''])[0];')
  'email'      = @('main', 'var _aggPreview = emailReading ? null : _previewPivotAggMatch(query, allCols);', 'var _aggPreview = _previewPivotAggMatch(query, allCols);')
  # The removed single-aggregate alias put back, in the search and in the preview.
  'alias'      = @('main', '                            // No single-aggregate alias (removed 2026-09-28). With one', ('                            else if (postFilterAggLabels.length === 1 && settings.vals && aqPart.column.toUpperCase() === settings.vals.toUpperCase()) { aggOnlyQuery.push(aqPart); }' + "`r`n" + '                            // No single-aggregate alias (removed 2026-09-28). With one'))
  'aliaspreview' = @('main', ('                colToType[lbl] = aggTypes[i]; colToIdx[lbl] = i;' + "`r`n" + '            });'), ('                colToType[lbl] = aggTypes[i]; colToIdx[lbl] = i;' + "`r`n" + '            });' + "`r`n" + '            if (aggLabelsUpper.length === 1 && settings.vals) { colToType[settings.vals.toUpperCase()] = aggTypes[0]; colToIdx[settings.vals.toUpperCase()] = 0; }'))
  'note'       = @('main', 'return $(''<span class="sched-filter-pivot-note"></span>'')', 'return false && $(''<span class="sched-filter-pivot-note"></span>'')')
  'hintemail'  = @('main', 'var result = window._penumbraSearchAPI.countMatchingRows(filterText, { email: true });', 'var result = window._penumbraSearchAPI.countMatchingRows(filterText);')
  'rowstrip'   = @('main', 'if (/^__ROW\s+/i.test(query)) {', 'if (false) {')
  'allstrip'   = @('main', "if (!emailReading && `$('#pivot-output-container').is(':visible') && /^__ALL\s+/i.test(query)) {", 'if (false) {')
  'list'       = @('sb', 'if (ctx && ctx.pivotSearch && !ctx.srcRows && window._penumbraSearchAPI &&', 'if (false && ctx && ctx.pivotSearch && !ctx.srcRows && window._penumbraSearchAPI &&')
  'reselect'   = @('sb', 'const exact = $opts.filter(function() { return this.value === currentVal; }).length > 0;', 'const exact = true;')
  'sbemail'    = @('sb', "var result = window._penumbraSearchAPI.countMatchingRows(query, { email: _sbMode.target !== '#tableSearch' });", 'var result = window._penumbraSearchAPI.countMatchingRows(query);')
  # Parenthesised: inside @() the COMMA binds before +, which garbles an unwrapped anchor.
  'phpstrip'   = @('search', ('    $resolvedFilter = penumbraStripSrcModifier($resolvedFilter);' + "`r`n`r`n    // Detect __ROW modifier"), "`r`n    // Detect __ROW modifier")
  'runnerstrip'= @('runner', ('    $resolvedFilter = penumbraStripSrcModifier($resolvedFilter);' + "`r`n`r`n    // __ROW modifier (correlate"), "`r`n    // __ROW modifier (correlate")
}
$mutFile = ''; $mOld = ''; $mNew = ''
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mutFile = $mutants[$Mutant][0]; $mOld = $mutants[$Mutant][1]; $mNew = $mutants[$Mutant][2]
}
function Apply-Mutant([string]$which, [string]$src) {
  # Plain names, not $script: - run as a scriptblock, this body has no script scope of its own.
  if ($mutFile -ne $which) { return $src }
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times in $which, expected 1: $mOld" }
  Write-Host "      + MUTANT $Mutant ($which)"
  return $src.Replace($mOld, $mNew)
}

Write-Host "[1/4] staging ..."
Write-Host "      app under test: $App"
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$live\js\$f" "$here\$f" -Force }

$src = Apply-Mutant 'main' (Read-U8 "$App\js\main.js")
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }
# Hooks into main.js's closure: a pivot set up the way a report load writes it, the
# real search, the task form's hint, and a hideLoading counter to await a search.
$hooks = @(
  'try { window.__PSRC = {',
  '  setPivot: function (s, rows) {',
  '    masterRowData = rows; currentPivotSettings = s; currentPivotSourceData = rows; pivotMasterDataSource = rows; sortCriteria = [];',
  '    _pivotPreSearchCollapseState = null; _pnbPivotBaselineMemo = null;',
  '    var cur = penumbraPivotCurrencyFlags(s.vals, s.aggColOverrides, s.agg);',
  '    var pd = processPivotData(rows, s.rows, s.cols, s.vals, s.agg, getExtraValFields(s.aggColOverrides, s.vals), s.aggFilters);',
  '    var res = generatePivotTable(pd, s.rows, s.cols, s.vals, s.rowLayout, s.colLayout, s.agg, s.sortOrder, null, cur, s.totalColAggs, s.totalRowAggs, s.colSortOrder, s.stickyColCount, buildRankConfig(s), s.totalRowAggLabels, s.aggColOverrides, s.totalRowAggBaseIdx, false);',
  '    $(''#pivot-output-container'').html(res.html).show(); penumbraPivotLazyBind(); },',
  '  hidePivot: function () { $(''#pivot-output-container'').hide(); },',
  '  search: function (text) { $(''#tableSearch'').val(text); window.__PSRC_hides = 0; return runTableSearch(); },',
  '  hint: function (text) { $(''#schedSearchFilter'').val(text); updateSchedFilterHint(); return $(''#schedSearchFilterHint'').text(); },',
  '  srcCount: function () { return currentPivotSourceData ? currentPivotSourceData.length : -1; },',
  '  initAC: function () { initSearchAutocomplete(); },',
  '  wrapHide: function () { var o = hideLoading; hideLoading = function () { var r = o.apply(this, arguments); window.__PSRC_hides = (window.__PSRC_hides || 0) + 1; return r; }; } };',
  '} catch (e) { window.__PSRC_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

$sb = Apply-Mutant 'sb' (Read-U8 "$App\js\search_builder.js")
[IO.File]::WriteAllText("$here\sb_patched.js", $sb, $u8)
$content = Read-U8 "$App\search_builder_content.php"
$ci = $content.IndexOf('?>')
if ($ci -lt 0) { throw "search_builder_content.php: no closing ?> - update run.ps1" }
$markup = $content.Substring($ci + 2)
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = 20000000
[IO.File]::WriteAllText("$here\sb_markup.js", 'window.__SB_MARKUP = ' + $ser.Serialize($markup) + ';', $u8)
[IO.File]::WriteAllText("$here\fixture.js", 'window.__FIXTURE = ' + (Read-U8 "$here\fixture.json") + ';', $u8)

Write-Host "[2/4] browser harness (headless) ..."
$udd = Join-Path $env:TEMP ('pnbpsrc_' + [guid]::NewGuid().ToString('N').Substring(0,6))
$dom = Join-Path $here ('dom_' + [guid]::NewGuid().ToString('N').Substring(0,6) + '.txt')
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run','--no-default-browser-check','--disable-extensions',"--user-data-dir=$udd",'--virtual-time-budget=60000','--window-size=1400,900','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(240000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs, $u8); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
try { Remove-Item -LiteralPath $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
try { [IO.File]::Delete($dom) } catch {}
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$js = $ser.DeserializeObject($txt.Substring(13))

Write-Host "[3/4] PHP engines ..."
$searchPhp = Apply-Mutant 'search' (Read-U8 "$App\penumbra_search.php")
[IO.File]::WriteAllText("$here\search_under_test.php", $searchPhp, $u8)
$runner = Apply-Mutant 'runner' (Read-U8 "$App\schedule_runner.php")
[IO.File]::WriteAllText("$here\runner_under_test.php", $runner, $u8)
$ex = & $php -n -d memory_limit=512M $extract "$here\runner_under_test.php" "$here\mirror.php" 2>&1
if (-not (Test-Path "$here\mirror.php")) { throw "mirror extraction failed: $ex" }
$phpOut = & $php -n -d memory_limit=512M -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring "$here\php_driver.php" "$here\search_under_test.php" "$here\mirror.php" "$here\fixture.json" 2>&1
$phpLine = ($phpOut | Where-Object { "$_".StartsWith('RESULTS_JSON:') } | Select-Object -First 1)
if (-not $phpLine) { throw "php_driver did not finish: $(($phpOut | Select-Object -First 8) -join ' | ')" }
$ph = $ser.DeserializeObject("$phpLine".Substring(13))
foreach ($f in 'search_under_test.php','runner_under_test.php','mirror.php') { try { [IO.File]::Delete("$here\$f") } catch {} }

Write-Host "[4/4] results"
$results = New-Object System.Collections.ArrayList
foreach ($r in $js['results']) { [void]$results.Add(@{ name = $r['name']; pass = [bool]$r['pass']; detail = $r['detail'] }) }
function T([string]$name, [bool]$cond, [string]$detail) { [void]$results.Add(@{ name = $name; pass = $cond; detail = $detail }) }
# M: the browser's email reading (the task form's hint) == the engine the email runs.
$bEmail = $js['emailCounts']; $n = 0
foreach ($q in $ph['emailCounts'].Keys) {
  $n++
  $pc = [int]$ph['emailCounts'][$q]; $bc = if ($bEmail.ContainsKey($q)) { [int]$bEmail[$q] } else { -99 }
  T ("M$n email reading, browser == PHP: $q") ($pc -eq $bc) "php $pc, browser $bc"
}
T 'M0 guard: the discriminating case differs between the readings (email 2 rows vs report 11)' (([int]$ph['emailCounts']['AMOUNT > 100']) -eq 2 -and ([int]$js['reportTxns']['AMOUNT > 100']) -eq 11) ("email " + $ph['emailCounts']['AMOUNT > 100'] + ", report " + $js['reportTxns']['AMOUNT > 100'])
$k = 0
foreach ($c in $ph['strip']) { $k++; T ("P$k penumbraStripSrcModifier('" + $c['in'] + "')") ($c['got'] -ceq $c['want']) ("want '" + $c['want'] + "' got '" + $c['got'] + "'") }
$g = $ph['group']
if ($g.ContainsKey('error')) { T 'P10 runner grouped-summary path' $false $g['error'] }
else {
  T 'P10 guard: the grouped-summary filter keeps Bravo and Delta (9 New rows)' ($g['plain']['groups'] -eq 'Bravo,Delta' -and [int]$g['plain']['rows'] -eq 9) ("plain " + $g['plain']['groups'] + " / " + $g['plain']['rows'])
  T 'P11 the runner reads __SRC Sum of AMOUNT > 100 ... like the plain filter' ($g['src']['groups'] -eq $g['plain']['groups'] -and [int]$g['src']['rows'] -eq [int]$g['plain']['rows']) ("__SRC " + $g['src']['groups'] + " / " + $g['src']['rows'])
}
if ($js['info']) { foreach ($i2 in $js['info']) { Write-Host ("  INFO  " + $i2) } }
foreach ($q in $ph['infoCounts'].Keys) { $bq = if ($js['infoCounts'] -and $js['infoCounts'].ContainsKey($q)) { $js['infoCounts'][$q] } else { '?' }; Write-Host ("  INFO  email reading of '$q': php " + $ph['infoCounts'][$q] + ", browser hint " + $bq) }
if ($js['fatal']) { Write-Host "FATAL: $($js['fatal'])" }
if ($js['pageErrors'] -and $js['pageErrors'].Count) { Write-Warning "page errors (may invalidate results): $($js['pageErrors'] -join '; ')" }
$fail = 0
foreach ($r in $results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $results.Count, $fail)
if ($fail -gt 0 -or $js['fatal']) { exit 1 }
