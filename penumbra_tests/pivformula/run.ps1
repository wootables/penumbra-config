# =============================================================================
# Penumbra PIVFORMULA suite (2026-10-17): the pivot search on FORMULA aggregates
# (?id=hitratio: "Hit Ratio" = {Awarded} / {Proposals} %). runTableSearch's agg
# post-filter and the builder preview (_previewPivotAggMatch) never evaluated a
# formula slot - it read back as 0, so `Hit Ratio > 10` matched nothing - and an
# aggregate filter that kept no row drew a hollow table + blank Grand Total row
# instead of the "No results" message.
#
#   F0      setup: the rendered cells (50.0% / 66.7%)
#   F1-F8   the executed search, per query (F8 = a base aggregate, control)
#   V1-V8   the builder preview's pivot-row count == the executed one
#   F7b/c   no match = the No results message, no table, count 0
# Control: the live build before the fix fails F1-F7 + V1-V7 + F7b.
# Mutants (each only its own): engine (runTableSearch call), preview (the twin's
# call), hollow (the empty-result branch).
#
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivformula'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -MainJs <path> [-Mutant name]
# Default main.js = the live one. Writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivformula'
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $MainJs) { $MainJs = "$live\js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)

$mutants = @{
  'engine'  = @('                            penumbraPivotSearchFormulaPass(_derivedMap, postFilterAggTypes,', '                            (function () {})(_derivedMap, postFilterAggTypes,')
  'preview' = @('                penumbraPivotSearchFormulaPass(derivedMap, aggTypes,', '                (function () {})(derivedMap, aggTypes,')
  'hollow'  = @('                if (finalDataToRender.length === 0) {', '                if (false) {')
}

Write-Host "[1/3] staging ... main.js under test: $MainJs"
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$live\js\$f" "$here\$f" -Force }
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant'" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1" }
  $src = $src.Replace($mOld, $mNew); Write-Host "      + MUTANT $Mutant"
}
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found" }
$hooks = @(
  'try { window.__PF = {',
  '  setPivot: function (s, rows) {',
  '    masterRowData = rows; currentPivotSettings = s; currentPivotSourceData = rows; pivotMasterDataSource = rows; sortCriteria = [];',
  '    _pivotPreSearchCollapseState = null; _pnbPivotBaselineMemo = null;',
  '    _pivotFormulaASTs = (s.aggFormulas || []).map(function (f) { return f ? parsePivotFormula(f) : null; });',
  '    var cur = penumbraPivotCurrencyFlags(s.vals, s.aggColOverrides, s.agg);',
  '    var pd = processPivotData(rows, s.rows, s.cols, s.vals, s.agg, getExtraValFields(s.aggColOverrides, s.vals), s.aggFilters);',
  '    var res = generatePivotTable(pd, s.rows, s.cols, s.vals, s.rowLayout, s.colLayout, s.agg, s.sortOrder, null, cur, s.totalColAggs, s.totalRowAggs, s.colSortOrder, s.stickyColCount, buildRankConfig(s), s.totalRowAggLabels, s.aggColOverrides, s.totalRowAggBaseIdx, false);',
  '    $(''#tableSearch'').val(''''); $(''#pivot-output-container'').html(res.html).show(); penumbraPivotLazyBind(); },',
  '  search: function (text) { $(''#tableSearch'').val(text); window.__PF_hides = 0; return runTableSearch(); },',
  '  wrapHide: function () { var o = hideLoading; hideLoading = function () { var r = o.apply(this, arguments); window.__PF_hides = (window.__PF_hides || 0) + 1; return r; }; } };',
  '} catch (e) { window.__PF_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] browser harness (headless) ..."
$udd = Join-Path $env:TEMP ('pnbpf_' + [guid]::NewGuid().ToString('N').Substring(0,6))
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
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$js = $ser.DeserializeObject($txt.Substring(13))

Write-Host "[3/3] results"
if ($js['fatal']) { Write-Host "FATAL: $($js['fatal'])" }
if ($js['pageErrors'] -and $js['pageErrors'].Count) { Write-Warning "page errors: $($js['pageErrors'] -join '; ')" }
$fail = 0; $total = 0
foreach ($r in $js['results']) {
  $total++
  if ($r['pass']) { Write-Host ("  PASS  " + $r['name']) }
  else { $fail++; Write-Host ("  FAIL  " + $r['name']); Write-Host ("        " + $r['detail']) }
}
Write-Host ("{0} assertions, {1} failed" -f $total, $fail)
