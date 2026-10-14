# =============================================================================
# Penumbra PIVOT SORT KEEP suite (2026-09-27)
#
# A saved report opens its pivot, replays the saved row sort, then re-renders
# the Custom Code. When that code holds format()/rewrite() rules the re-render
# RE-GENERATES the pivot (the rules are applied while the HTML is built) and
# wrote the rows back in key order without replaying the sort, while
# sortCriteria still claimed it: ?id=sponawd / sponprop had to ship without any
# format() rule to keep their saved "Summary::Avg Amount" sort. Fix: one helper,
# penumbraReplayPivotSortChain(), used by the boot restore, the search re-render
# and now the snippet re-gen.
#
#   S0-S5  one sorted column through the re-gen (rows, header state, sortCriteria)
#   C1-C3  a two-column chain through the re-gen
#   H1-H6  (2026-09-28) the column-sort arrow keeps the row sort, a sort on the year that
#          carries the arrow has a plain id, a pre-fix id WITH the arrow still replays
#   G1-G3  guards: no rule = no re-gen; no sort = key order, no sort invented
#
#   powershell -File run.ps1                     live js/main.js
#   powershell -File run.ps1 -MainJs <path>      a staged copy
#   powershell -File run.ps1 -Mutant <name>      one behaviour reverted (below)
# 19 assertions. Controls: main.js.bak-20260927-sortkeep (before the re-gen replay) fails
# S3 S4 C2 and more; main.js.bak-20260928-colsortkeep (before the arrow fix) fails exactly
# H2 H3 H4 - H5 H6 pass there because that build kept the arrow on BOTH sides. Mutants:
# regen 5 (S3 S4 C2 H5 H6), colsort 2 (H2 H4), arrowid 6 (C2 C3 H2 H3 H5 H6 - the saved side
# is normalised, the header side then is not), arrowsaved 2 (H5 H6), additive 2 (C2 C3).
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotsortkeep'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotsortkeep' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }

Write-Host "[1/3] staging JS + patching main.js ..."
Write-Host "      main.js under test: $MainJs"
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
$u8 = New-Object System.Text.UTF8Encoding($false)
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One single-point change each; the anchor must occur exactly once.
$mutants = @{
  'regen'    = @('if (sortCriteria && sortCriteria.length) {   // snippet re-gen', 'if (false) {')
  'colsort'  = @('if (sortCriteria && sortCriteria.length) {   // column arrow', 'if (false) {')
  'arrowid'  = @('parentText = $parentTh.clone().find(''.sort-icon, .col-sort-icon'').remove().end().text().trim();', 'parentText = $parentTh.text().trim();')
  'arrowsaved' = @('var parentName = penumbraStripColSortArrow(parts[0]);', 'var parentName = parts[0];')
  'additive' = @('var additive = sortCriteria.length > 0;', 'var additive = false;')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}

# Hooks: engine A as the parity suite drives it, plus a pivot set-up that writes
# the pivot the way a report load does (key order, no sort) and reads sortCriteria.
$hooks = @(
  'try { window.__PS = {',
  '  A: async function (text, maps) {',
  '    if (!snippetEditor || typeof snippetEditor.getWrapperElement !== ''function'') { snippetEditor = CodeMirror.fromTextArea(document.getElementById(''reportSnippet''), { lineNumbers: false }); }',
  '    snippetEditor.setValue(text); allResolvedPrompts = []; pendingPivotSettings = null; pendingGroupByColumn = null; window._penumbraAutoloadFired = true;',
  '    var el = document.getElementById(''reportSnippetOutput''); el.innerHTML = '''';',
  '    await renderReportSnippet(maps, false, { ignorePendingViewState: true }); return el.innerHTML; },',
  '  setPivot: function (s, rows) {',
  '    currentPivotSettings = s; currentPivotSourceData = rows; pivotMasterDataSource = rows; sortCriteria = [];',
  '    var cur = penumbraPivotCurrencyFlags(s.vals, s.aggColOverrides, s.agg);',
  '    var pd = processPivotData(rows, s.rows, s.cols, s.vals, s.agg, getExtraValFields(s.aggColOverrides, s.vals), s.aggFilters);',
  '    var res = generatePivotTable(pd, s.rows, s.cols, s.vals, s.rowLayout, s.colLayout, s.agg, s.sortOrder, null, cur, s.totalColAggs, s.totalRowAggs, s.colSortOrder, s.stickyColCount, buildRankConfig(s), s.totalRowAggLabels, s.aggColOverrides, s.totalRowAggBaseIdx, false);',
  '    $(''#pivot-output-container'').html(res.html).show(); penumbraPivotLazyBind(); },',
  '  getSort: function () { return sortCriteria; }, setSort: function (c) { sortCriteria = c; } };',
  '} catch (e) { window.__PS_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running harness headless ..."
$udd = Join-Path $env:TEMP ('pnbpsk_' + [guid]::NewGuid().ToString('N').Substring(0,6))
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--window-size=1366,900','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
try { Remove-Item -LiteralPath $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json

Write-Host "[3/3] results"
if ($parsed.fatal) { Write-Host "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0 -or $parsed.fatal) { exit 1 }
