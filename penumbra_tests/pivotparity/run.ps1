# =============================================================================
# PENUMBRA PIVOT PARITY HARNESS  -  JS (browser) vs PHP (scheduled email)
#
# Feeds ONE fixture set through both pivot aggregation engines and diffs the
# results, so twin drift is found mechanically instead of by eye.
#
#   JS  side: the LIVE js/main.js, patched in memory to export its closure-
#             internal pivot functions, run in headless Edge.
#   PHP side: the top-level function declarations LIFTED OUT of
#             schedule_runner.php by extract_mirror.php. The runner itself is a
#             CLI entry point that opens Oracle, claims tasks and SENDS EMAIL -
#             it is never required here.
#
# Run it (UNC execution policy blocks -File, so pass the body as a scriptblock):
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
#
# Writes nothing to the webroot. Exit 1 when any divergence is found.
# =============================================================================
param([string]$MainJs = '', [switch]$KeepArtifacts, [switch]$TraceInit, [string]$AppDir = '')
$ErrorActionPreference = 'Stop'
$here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity'
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
# -AppDir <stage> (2026-09-23): test a staged tree - its schedule_runner.php (the mirror),
# penumbra_search.php (the PHP driver loads it) and js\main.js. ($App would BE $app:
# PowerShell variable names are case-insensitive.)
if ($AppDir) { $app = $AppDir.TrimEnd('\') }
$js   = "$app\js"
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
if (-not $MainJs) { $MainJs = "$js\main.js" }
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }

# NOTE: never pipe php.exe through 2>&1 here. In Windows PowerShell 5.1 that
# wraps each stderr line in an ErrorRecord (NativeCommandError) and flips $? to
# false even on a clean exit 0 - which, under $ErrorActionPreference='Stop',
# kills the run. This box's php.exe always warns about a missing opcache/sqlsrv
# DLL on stderr, so merging streams made every invocation look fatal. stdout is
# clean on its own; this filter is just belt-and-braces.
function Quiet($lines) { $lines | Where-Object { $_ -notmatch 'dynamic library|Zend extension|php_opcache|Failed loading' } }

Write-Host "[1/5] extracting the PHP pivot mirror (no execution of the runner) ..."
Quiet (& $php "$here\extract_mirror.php" "$app\schedule_runner.php" "$here\pivot_mirror.php") | ForEach-Object { Write-Host "      $_" }
$lint = Quiet (& $php -l "$here\pivot_mirror.php")
if ($lint -notmatch 'No syntax errors') { throw "extracted mirror failed to lint: $lint" }

Write-Host "[2/5] generating fixtures ..."
$fx = Quiet (& $php "$here\gen_fixtures.php")
[IO.File]::WriteAllText("$here\fixtures.json", ($fx -join "`n"), (New-Object System.Text.UTF8Encoding($false)))
$fxObj = Get-Content "$here\fixtures.json" -Raw | ConvertFrom-Json
Write-Host "      $($fxObj.count) cases"

Write-Host "[3/5] running the PHP side ..."
# The driver loads penumbra_search.php from the SAME tree as the mirror (engine C's
# _cf_test_condition needs _sr_resolve_keyword_date - see php_driver.php).
$phpOut = Quiet (& $php "$here\php_driver.php" $app)
$phpJson = ($phpOut -join "`n")
try { $phpRes = ($phpJson | ConvertFrom-Json).results } catch { throw "PHP driver did not emit JSON: $($phpJson.Substring(0,[Math]::Min(500,$phpJson.Length)))" }

Write-Host "[4/5] running the JS side in headless Edge ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
# Inline the fixtures rather than fetch(): no file:// XHR timing to get wrong.
[IO.File]::WriteAllText("$here\fixtures_inline.js",
  "window.__FIXTURES = " + (Get-Content "$here\fixtures.json" -Raw) + ";",
  (New-Object System.Text.UTF8Encoding($false)))

$src = [IO.File]::ReadAllText($MainJs, (New-Object System.Text.UTF8Encoding($false)))
$anchor = '$(document).ready(function () {'
$i = $src.IndexOf($anchor)
if ($i -lt 0) { throw 'main.js closure anchor not found' }
# HOISTED functions only; PENUMBRA_PIVOT_SPLITS is a var, so it needs a getter.
$hook = @(
 'try { window.__PARITY = {',
 '  extract: extractAggregationValue, stddev: pivotSampleStdDev,',
 '  pctOf: pivotPercentileOf, pctP: pivotPercentileP,',
 '  wavgCol: pivotWavgWeightCol, wavgOf: pivotWavgOf,',
 '  antimode: pivotAntimodeFromValues, parseNums: pivotParseNumericValues,',
 '  parseTok: pivotParseFieldToken, dispLabel: pivotFieldDisplayLabel,',
 '  binBucket: pivotBinBucketLabel, binsBucket: pivotBinsBucketLabel,',
 '  splitBucket: pivotSplitBucketLabel, autoW: pivotAutoBinWidth,',
 '  normEdges: pivotNormalizeBinEdges, aggLabel: getAggregationLabel,',
 '  minOf: penumbraMinOf, maxOf: penumbraMaxOf, emptyAgg: penumbraEmptyAggValue,',
 '  isDerived: _isDerivedAgg, isRoll: pivotIsRoll, indexBase: pivotIndexBaseLabel,',
 '  collect: processPivotData, parseQuery: parseAdvancedQuery, evalQuery: evaluateParsedQuery,',
 '  parseVal: parseAccountingNumber,',
 '  splits: function () { return PENUMBRA_PIVOT_SPLITS; },',
 '  probe: function () {',
 '    var out = {};',
 '    try { out.n20005 = (typeof VIEW_ONLOAD_KEY !== "undefined"); } catch (e) { out.n20005 = "TDZ"; }',
 '    try { out.n21931 = (typeof rowTotalBaseOptions !== "undefined"); } catch (e) { out.n21931 = "TDZ"; }',
 '    try { out.n23855 = (typeof _pivotBinAutoMemo !== "undefined"); } catch (e) { out.n23855 = "TDZ"; }',
 '    try { out.n31016 = (typeof _csComparatorCache !== "undefined"); } catch (e) { out.n31016 = "TDZ"; }',
 '    try { out.n40668 = (typeof _vizPctResizeTimer !== "undefined"); } catch (e) { out.n40668 = "TDZ"; }',
 '    try { out.n44327 = (typeof _couldBeDate !== "undefined"); } catch (e) { out.n44327 = "TDZ"; }',
 '    try { out.n45223 = (typeof _stickyRowRafId !== "undefined"); } catch (e) { out.n45223 = "TDZ"; }',
 '    return out;',
 '  }',
 '}; } catch (e) { window.__PARITY_ERR = String(e); }'
) -join ' '
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hook`r`n" + $src.Substring($i + $anchor.Length)
# -TraceInit wraps the whole ready body in try/catch to capture an init failure
# WITH ITS STACK. Diagnostic only, never on by default: wrapping the body puts
# every function declaration inside a block, which makes them block-scoped, so
# the hook above captures `undefined` for all of them and EVERY case fails. Used
# once to find the real blocker (a null CodeMirror in populateSelectorBox); keep
# it for the next time init stops somewhere new.
if ($TraceInit) {
  $patched = $patched.Insert($patched.IndexOf($hook) + $hook.Length, "`r`n    try {")
  $tail = $patched.LastIndexOf('});')
  if ($tail -lt 0) { throw 'ready-closure tail not found - cannot wrap for diagnostics' }
  $catch = "`r`n    } catch (e) { window.__INIT_ERR = String((e && e.message) ? e.message : e) + ' @@ ' + String((e && e.stack) ? e.stack : '').split(String.fromCharCode(10)).slice(0, 5).join(' | '); }`r`n"
  $patched = $patched.Substring(0, $tail) + $catch + $patched.Substring($tail)
}
[IO.File]::WriteAllText("$here\main_parity.js", $patched, (New-Object System.Text.UTF8Encoding($false)))

$rid = [Guid]::NewGuid().ToString('N').Substring(0,8)
$dom = "$here\dom_$rid.txt"
$udd = "$here\edgeprofile_$rid"
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/js_driver.html'
$eargs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
           "--user-data-dir=$udd",'--virtual-time-budget=60000','--dump-dom',$url)
$pp = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $eargs
# Wait for the COMPLETE DUMP, not for the process: a lingering headless Edge child held
# WaitForExit() for 15+ minutes on 2026-09-23 with the dump already written (parity's
# run_parity.ps1 polls the same way). Then stop only THIS run's Edge (its own profile dir).
$waitSw = [Diagnostics.Stopwatch]::StartNew()
while ($waitSw.Elapsed.TotalSeconds -lt 600) {
  try {
    $fs = [IO.File]::Open($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try { $peek = (New-Object IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Dispose() }
    if ($peek.Contains('</pre>') -and $peek.TrimEnd().EndsWith('</html>')) { break }
  } catch { }
  if ($pp.HasExited -and $waitSw.Elapsed.TotalSeconds -gt 5) { break }
  Start-Sleep -Milliseconds 500
}
if (-not $pp.HasExited) { try { $pp.Kill() } catch { } }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*edgeprofile_$rid*" } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
# A lingering Edge child keeps the dump handle open for a while - retry patiently.
$d = $null
for ($z = 0; $z -lt 120; $z++) {
  try { $d = [IO.File]::ReadAllText($dom); if ($d.Length -gt 0) { break } } catch { }
  Start-Sleep -Milliseconds 500
}
if (-not $d) { throw 'could not read the Edge dump' }
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "JS driver did not finish: $($txt.Substring(0,[Math]::Min(600,$txt.Length)))" }
$jsObj = $txt.Substring(13) | ConvertFrom-Json
if ($jsObj.fatal) { throw "JS driver fatal: $($jsObj.fatal)" }
if ($jsObj.initErr) { Write-Host "      INIT ERROR (this is what stops the ready closure): $($jsObj.initErr)" }
if ($jsObj.initProbe) {
  Write-Host "      init progress (first TDZ brackets where the ready closure stopped):"
  $jsObj.initProbe.PSObject.Properties | ForEach-Object { Write-Host ("        {0,-8} {1}" -f $_.Name, $_.Value) }
}
if ($jsObj.pageErrors -and $jsObj.pageErrors.Count) {
  Write-Host "      note: page errors (harness libs, not the mirror): $($jsObj.pageErrors -join '; ')"
}
$jsRes = $jsObj.results

Write-Host "[5/5] diffing ..."
# n: values compare NUMERICALLY with a relative tolerance so printf-vs-JS number
# formatting can never look like engine divergence. Everything else is exact.
function SameVal($x, $y) {
  if ($x -eq $y) { return $true }
  if ($x -like 'n:*' -and $y -like 'n:*') {
    $xa = $x.Substring(2); $ya = $y.Substring(2)
    if ($xa -eq '+INF' -or $xa -eq '-INF' -or $ya -eq '+INF' -or $ya -eq '-INF') { return $xa -eq $ya }
    try {
      $xf = [double]::Parse($xa, [Globalization.CultureInfo]::InvariantCulture)
      $yf = [double]::Parse($ya, [Globalization.CultureInfo]::InvariantCulture)
    } catch { return $false }
    if ($xf -eq $yf) { return $true }
    $scale = [Math]::Max([Math]::Abs($xf), [Math]::Abs($yf))
    if ($scale -eq 0) { return $true }
    return ([Math]::Abs($xf - $yf) / $scale) -lt 1e-9
  }
  return $false
}

# A JS-side ReferenceError/TDZ means main.js init never reached the declaration
# the case depends on - the harness could not evaluate that lane at all. That is
# a harness limitation, NOT engine drift, so it is counted and reported
# separately. It is never silently dropped: an unevaluated lane is a coverage
# gap you should be able to see.
$div = @()
$blocked = @()
foreach ($c in $fxObj.cases) {
  $id = $c.id
  $p = $phpRes.$id
  $j = $jsRes.$id
  if (SameVal $j $p) { continue }
  $row = [pscustomobject]@{ id = $id; fn = $c.fn; note = $c.note; js = $j; php = $p }
  if ($j -like 'ERR:ReferenceError*') { $blocked += $row } else { $div += $row }
}

$byFn = $div | Group-Object fn | Sort-Object Count -Descending
Write-Host ""
Write-Host ("{0} cases compared, {1} DIVERGENT, {2} not evaluated (JS init blocked)" -f $fxObj.count, $div.Count, $blocked.Count)
if ($blocked.Count) {
  Write-Host ""
  Write-Host "NOT EVALUATED - harness coverage gap, not engine drift"
  Write-Host "  main.js init stops before these declarations, so the JS side threw a"
  Write-Host "  ReferenceError/TDZ instead of returning a value. Fix the boot stubs to"
  Write-Host "  close this gap; do NOT read these as divergences."
  foreach ($g in ($blocked | Group-Object fn | Sort-Object Count -Descending)) {
    Write-Host ("  {0,-22} {1}   e.g. {2}" -f $g.Name, $g.Count, $g.Group[0].js)
  }
}
if ($div.Count) {
  Write-Host ""
  Write-Host "DIVERGENCES BY FUNCTION"
  foreach ($g in $byFn) { Write-Host ("  {0,-22} {1}" -f $g.Name, $g.Count) }
  Write-Host ""
  Write-Host "DETAIL"
  foreach ($g in $byFn) {
    Write-Host ""
    Write-Host ("=== {0} ({1}) ===" -f $g.Name, $g.Count)
    foreach ($r in ($g.Group | Select-Object -First 25)) {
      Write-Host ("  {0}  [{1}]" -f $r.id, $r.note)
      Write-Host ("      JS  {0}" -f $r.js)
      Write-Host ("      PHP {0}" -f $r.php)
    }
    if ($g.Count -gt 25) { Write-Host ("  ... {0} more in divergences.json" -f ($g.Count - 25)) }
  }
}
@{ divergent = $div; notEvaluated = $blocked } | ConvertTo-Json -Depth 6 | Set-Content "$here\divergences.json" -Encoding utf8
Write-Host ""
Write-Host "full list -> $here\divergences.json"

if (-not $KeepArtifacts) {
  try { Remove-Item $dom -Force -ErrorAction SilentlyContinue } catch {}
  try { Remove-Item $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
# No `exit` (2026-09-23): the documented way to run this is a SCRIPTBLOCK, where `exit 1`
# killed the CALLER's session (a background job running control + stage died after the
# control). The verdict is printed and left in $LASTEXITCODE instead.
Write-Host ('RESULT: ' + $(if ($div.Count -gt 0) { "DIVERGENT ($($div.Count))" } else { 'NO DIVERGENCE' }))
$global:LASTEXITCODE = $(if ($div.Count -gt 0) { 1 } else { 0 })
