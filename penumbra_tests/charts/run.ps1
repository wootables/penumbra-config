# =============================================================================
# Penumbra CHART SUITE  -  one-command rebuild + run  (16 harnesses)
#
# Covers the per-type chart builders and the lazy-load bridge between
# js/main.js and js/penumbra_charts.js:
#
#   funnel_test           conversion + duration funnels, stage maths, labels
#   gauge_test            gauge + bullet: bands, targets, range resolution
#   box_pareto_test       box plot quartiles/whiskers/outliers + the pareto flag
#   gantt_test            timeline bars, date parsing, tick formatting, markers
#   map_test              US tile-grid cartogram: state resolution, binning,
#                         territories, legend placement, unmatched rows
#   dough_roundtrip_test  doughnut survives the vis() emit -> parse round trip
#   module_test           penumbra_charts.js standing ALONE with no main.js:
#                         exports present, init() refuses partial deps loudly
#   bridge_test           the excision itself: nothing was left behind in
#                         main.js, every module export has exactly one shim,
#                         shims delegate argument-for-argument when armed and
#                         return documented neutrals (never undefined) when
#                         not, the module is fetched ONCE with the versioned
#                         URL, and all five Chart.js load sites await it
#
#   drill_other_test      the click-time "(Other)" row filters: the two maps
#                         _buildChartClickCriteria derives from the labels still
#                         visible on the chart are keyed by CHART LABEL, so a
#                         category named hasOwnProperty used to shadow the method
#                         the filter calls (TypeError, drill-down dead) and one
#                         named __proto__ never recorded at all (its rows were
#                         reported as having rolled up into Other). Fixed
#                         2026-09-17; see the harness header.
#
#   values_roundtrip_test the builder's Values select: restore -> preview -> emit
#                         -> parse for every on/off x position. A chart saved with
#                         labels OFF used to restore as 'auto' (= on), so Update
#                         chart switched its labels on. Fixed 2026-10-06; 65 asserts
#                         (pre-fix main.js: 21 FAIL - every labels-off case).
#
#   powershell -File run.ps1
#   powershell -File run.ps1 -MainJs <path>   (e.g. a .bak - positive control:
#                                              the PRE-extraction main.js must
#                                              FAIL bridge_test, because it
#                                              still owns the builders itself)
#   powershell -File run.ps1 -Mutant <site>   one of the drill maps back to its
#                                             pre-fix form. Needs the FIXED
#                                             main.js (each anchor is the
#                                             Object.create(null) / .call form)
#                                             and throws otherwise. Each site is
#                                             its own switch on purpose: reverting
#                                             them together lets one assertion
#                                             cover for another, which is how the
#                                             2026-08-30 sweep missed group mode.
#
# Counts measured 2026-09-17, all out of 998 (drill_other_test contributes 32):
#   fixed main.js            998 / 0
#   the pre-2026-09-17 .bak  982 / 16   the 16 drill_other_test asserts a plain {}
#                                       cannot satisfy; the other 12 harnesses stay green
#   -Mutant xdecl            996 / 2    bar, __proto__ only - constructor / toString /
#                                       valueOf are correctly SHADOWED by the assignment
#                                       here, because these maps store the primitive true
#   -Mutant tmdecl           996 / 2    the treemap twin of the same
#   -Mutant xread            982 / 16   EVERY bar assert throws (a null-prototype object has
#                                       no inherited hasOwnProperty at all). Same COUNT as the
#                                       .bak control and a completely DISJOINT set - the
#                                       control's 16 span both chart kinds, these are all bar.
#                                       Read the details, not the number.
#   -Mutant tmread           984 / 14   every treemap assert throws
#
# If the UNC execution policy refuses the script ("not digitally signed"), run
# its body as a scriptblock from the workstation:
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\charts'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('# $PSScriptRoot is empty when the BODY is run as a scriptblock (UNC .ps1 files are GPO-blocked).
#   $here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\charts' }',"`$here = '$dir'")))
# and do NOT pipe the invocation (a lingering headless child keeps stdout open
# and the pipeline never sees EOF); the script prints its own summary.
#
# Rebuilds SRC.js from the LIVE app files each run, so it always tests what is
# deployed. Writes nothing to the webroot. Exit code 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '',
      [ValidateSet('', 'xdecl', 'xread', 'tmdecl', 'tmread')][string]$Mutant = '')
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (UNC .ps1 files are GPO-blocked).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\charts' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }

# Chrome first: on this box headless EDGE emits nothing for these pages, and
# cscript's JScript engine is ES3 so it cannot parse main.js at all.
$browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $browser)) { throw 'no Chrome or Edge found' }

Write-Host "[1/3] staging JS from the live app ..."
Copy-Item "$js\moment.min.js"       "$here\moment.min.js"       -Force
Copy-Item "$js\penumbra_charts.js"  "$here\penumbra_charts.js"  -Force
# The geo asset is a LIVE APP FILE too, and outline_map_test asserts directly
# against it (feature counts, projection landmarks, centroid arming). Without
# this copy the suite happily tested whatever build_geo.pl last left here while
# the app served something else - which is how a world layer shipped to the app
# on 2026-08-28 with no harness covering it.
Copy-Item "$js\penumbra_geo_us.js"  "$here\penumbra_geo_us.js"  -Force
# sankey_test draws a REAL chart: Chart.js + the sankey plugin (2026-10-12)
Copy-Item "$js\chart-4.5.1.min.js"                  "$here\chart-4.5.1.min.js"                  -Force
Copy-Item "$js\chartjs-chart-sankey-0.19.1.min.js"  "$here\chartjs-chart-sankey-0.19.1.min.js"  -Force

# SRC.js = penumbra_charts.js + main.js, MODULE FIRST on purpose: main.js now
# carries one-line shims with the same names as the real builders, and the
# harnesses' grab() takes the FIRST match. Module-first makes every
# grab('function applyXChartConfig(') land on the real implementation; every
# other anchor is unique, so the order cannot affect it.
#
# Read as raw BYTES and decode explicitly. js/main.js is pure CRLF and holds two
# NUL bytes; a re-encoding read (or sed, which silently rewrites CRLF to LF)
# corrupts it. The harnesses normalise CRLF themselves.
Write-Host "      main.js under test: $MainJs"
$u8   = New-Object System.Text.UTF8Encoding($false)
$mod  = $u8.GetString([IO.File]::ReadAllBytes("$js\penumbra_charts.js"))
$main = $u8.GetString([IO.File]::ReadAllBytes($MainJs))

# --- drill "(Other)" map mutants (2026-09-17) --------------------------------
# One map's declaration back to a plain {}, or one map's READ back to the
# method-call form. A read mutant throws on EVERY call (a null-prototype object
# has no inherited hasOwnProperty at all), so it fails more assertions than the
# declaration mutant and for the opposite reason - compare the details, not the
# count.
if ($Mutant) {
  $muts = @{
    'xdecl'  = @('var visibleX = Object.create(null);', 'var visibleX = {};')
    'xread'  = @('return !Object.prototype.hasOwnProperty.call(visibleX, rv);', 'return !visibleX.hasOwnProperty(rv);')
    'tmdecl' = @('var visibleTmX = Object.create(null);', 'var visibleTmX = {};')
    'tmread' = @('return !Object.prototype.hasOwnProperty.call(visibleTmX, rv);', 'return !visibleTmX.hasOwnProperty(rv);')
  }
  $m = $muts[$Mutant]
  $n = ([regex]::Matches($main, [regex]::Escape($m[0]))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor not found exactly once (found $n) - needs the FIXED main.js: $($m[0])" }
  $main = $main.Replace($m[0], $m[1])
  Write-Host "      MUTANT $Mutant applied"
}

$text = $mod + "`n" + $main

$sb = New-Object System.Text.StringBuilder ($text.Length + 200000)
[void]$sb.Append('window.__src = "')
foreach ($ch in $text.ToCharArray()) {
    $o = [int]$ch
    if     ($ch -eq [char]92)  { [void]$sb.Append('\\') }        # backslash
    elseif ($ch -eq [char]34)  { [void]$sb.Append('\"') }        # double quote
    elseif ($o  -eq 10)        { [void]$sb.Append('\n')  }
    elseif ($o  -eq 13)        { [void]$sb.Append('\r')  }
    elseif ($o  -eq 9)         { [void]$sb.Append('\t')  }
    elseif ($o -lt 32 -or $o -gt 126) { [void]$sb.Append(('\u{0:x4}' -f $o)) }
    else   { [void]$sb.Append($ch) }
}
[void]$sb.Append('";')
[IO.File]::WriteAllText("$here\SRC.js", $sb.ToString(), $u8)
Write-Host ("      SRC.js rebuilt: {0} source chars -> {1} bytes" -f $text.Length, (Get-Item "$here\SRC.js").Length)

Write-Host "[2/3] running 16 harnesses headlessly ..."
$suites = @('funnel_test','gauge_test','box_pareto_test','gantt_test','map_test',
            'dough_roundtrip_test','module_test','bridge_test','format_bands_test','outline_map_test','palette_test','autobuild_test',
            'drill_other_test','values_roundtrip_test','sankey_test','sunburst_test')
$rows = @()
foreach ($s in $suites) {
    # Its own profile per run: a stale disk cache will happily serve the
    # PREVIOUS version of SRC.js and quietly "pass" against old code.
    $udd = Join-Path $here ("profile_" + $s)
    if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
    $dom = Join-Path $here ($s + "_dom.txt")
    if (Test-Path $dom) { Remove-Item $dom -Force }
    $url = 'file:///' + $here.Replace([char]92, [char]47) + '/' + $s + '.html'
    $args = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',
              "--user-data-dir=$udd",'--virtual-time-budget=40000','--dump-dom',$url)
    # -RedirectStandardOutput, never a pipe: a lingering headless child keeps
    # stdout open and a PowerShell pipeline never sees EOF.
    # -Wait hung on a lingering child (2026-08-24) and a plain ReadAllText hit "file in use" (2026-09-08):
    # bound the wait, stop only the browser processes on THIS profile, share-read the dump.
    $pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $args
    $pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
    Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }; Start-Sleep -Milliseconds 500
    $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
    $i = $d.IndexOf('<pre id="out">')
    if ($i -lt 0) { throw "$s : no <pre id=out> in dump ($($d.Length) bytes)" }
    $j = $d.IndexOf('</pre>', $i)
    $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
    $first = ($txt -split "`n")[0].Trim()
    $pass = 0; $fail = 0
    if ($first -match 'pass=(\d+)\s+fail=(\d+)') { $pass = [int]$Matches[1]; $fail = [int]$Matches[2] }
    else { $fail = -1 }
    $rows += [pscustomobject]@{ suite = $s; pass = $pass; fail = $fail; line = $first; text = $txt }
}

Write-Host "[3/3] results"
$totalPass = 0; $totalFail = 0
foreach ($r in $rows) {
    if ($r.fail -eq 0) {
        $totalPass += $r.pass
        Write-Host ("  PASS  {0,-22} {1,4} assertions" -f $r.suite, $r.pass) -ForegroundColor Green
    } elseif ($r.fail -lt 0) {
        $totalFail++
        Write-Host ("  ERROR {0,-22} {1}" -f $r.suite, $r.line) -ForegroundColor Red
    } else {
        $totalPass += $r.pass; $totalFail += $r.fail
        Write-Host ("  FAIL  {0,-22} {1} failed of {2}" -f $r.suite, $r.fail, ($r.pass + $r.fail)) -ForegroundColor Red
        foreach ($l in ($r.text -split "`n")) {
            if ($l.StartsWith('FAIL')) { Write-Host ("        " + $l.Trim()) -ForegroundColor DarkYellow }
        }
    }
}
Write-Host ("SUMMARY pass={0} fail={1}" -f $totalPass, $totalFail)
if ($totalFail -gt 0) { exit 1 }
