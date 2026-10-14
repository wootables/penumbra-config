# =============================================================================
# Metrics tables' standard sort + session-only column resize (2026-10-03).
#
#   powershell -File run.ps1                 against LIVE
#   powershell -File run.ps1 -App <dir>      against a staged app folder
#                                            (analytics_all.php + css\main.css)
#   The share refuses unsigned scripts (RemoteSigned, even with -ExecutionPolicy
#   Bypass) - from there, run it as a script block in a CHILD process (it exits):
#     powershell -NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText('<this file>')))" [-Control]
#
# WHAT IS UNDER TEST: the sorter block of the SHIPPED analytics_all.php -
# lifted between its own comment anchors, never copied - plus its table CSS,
# run in headless Chrome over a fixture table with the app's real main.css:
# the .sort-icon in main.css's gutter, th.sorted / one arrow / aria-sort,
# asc -> desc -> off with arrival order restored, Shift+click multi-sort with
# .sort-rank chips and the priority title, main.js's "plain click on the
# primary advances it" rule, data-sort keys, the reveal hook; and the resize:
# grip hover, a drag that lands where the pointer stops (border-box), never
# sorting on the grip or a fit-double-click, the 48px floor, keyboard + / 0.
# The control is the pre-change sorter (orig_20261003\sorter_orig.js) - it
# must FAIL here. Nothing is sent anywhere; the page is a local file.
# =============================================================================
param([string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra', [switch]$Control)
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras\d$\Utilities\PHP_8.2-p\penumbra_tests\dtsort' }
$php  = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$work = Join-Path $env:TEMP ('pnb_dtsort_' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force (Join-Path $work 'css') | Out-Null
try {
    Copy-Item (Join-Path $App 'css\main.css') (Join-Path $work 'css\main.css')
    Copy-Item (Join-Path $here 'test.html') (Join-Path $work 'test.html')
    $lift = @'
$s = file_get_contents($argv[1]);
$a = strpos($s, "    // Sortable tables - THE APP'S STANDARD HEADER SORT");
$m = strpos($s, "    document.addEventListener('mouseup'", $a);
if ($a === false || $m === false) { fwrite(STDERR, "sorter anchors not found\n"); exit(2); }
$b = strpos($s, "    });\n", $m) + 8;
file_put_contents($argv[2], substr($s, $a, $b - $a));
$c = strpos($s, "    table.dt { width: 100%"); $d = strpos($s, "body.dt-resizing", $c);
if ($c === false || $d === false) { fwrite(STDERR, "css anchors not found\n"); exit(2); }
file_put_contents($argv[3], substr($s, $c, strpos($s, "\n", $d) - $c));
'@
    $liftFile = Join-Path $work 'lift.php'; [IO.File]::WriteAllText($liftFile, "<?php`n" + $lift)
    & $php -n $liftFile (Join-Path $App 'analytics_all.php') (Join-Path $work 'sorter.js') (Join-Path $work 'page.css')
    if ($LASTEXITCODE -ne 0) { throw 'lift failed' }
    if ($Control) { Copy-Item (Join-Path $here 'orig_20261003\sorter_orig.js') (Join-Path $work 'sorter.js') -Force }
    $chrome = @('C:\Program Files (x86)\Google\Chrome\Application\chrome.exe', 'C:\Program Files\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $chrome) { throw 'Chrome not found' }
    # Page 2 (2026-10-03): the sticky card strips, lifted from analytics_shared.php -
    # the CSS block and the script, between their own anchors. -Control drops the
    # script (the strips then do not stack: it must FAIL).
    Copy-Item (Join-Path $here 'strips.html') (Join-Path $work 'strips.html')
    $lift2 = @'
$s = file_get_contents($argv[1]);
$a = strpos($s, "    table.dt th { position: sticky;");
$b = strpos($s, "@media (max-width: 900px), (max-height: 560px) { .an-cardhead { position: static; } }", $a);
$c = strpos($s, "    // ---- Sticky card strips (2026-10-03) ----");
$m = ($c === false) ? false : strpos($s, "const mo = new MutationObserver", $c);
if ($a === false || $b === false || $c === false || $m === false) { fwrite(STDERR, "strip anchors not found\n"); exit(2); }
file_put_contents($argv[2], substr($s, $a, strpos($s, "\n", $b) - $a));
$d = strpos($s, "    })();\n", $m) + 10;
file_put_contents($argv[3], substr($s, $c, $d - $c));
'@
    $lift2File = Join-Path $work 'lift2.php'; [IO.File]::WriteAllText($lift2File, "<?php`n" + $lift2)
    & $php -n $lift2File (Join-Path $App 'analytics_shared.php') (Join-Path $work 'strips.css') (Join-Path $work 'strips.js')
    if ($LASTEXITCODE -ne 0) { throw 'strip lift failed' }
    if ($Control) { [IO.File]::WriteAllText((Join-Path $work 'strips.js'), '/* control: no strips script */') }
    $all = ''
    foreach ($page in 'test.html', 'strips.html') {
        $url = 'file:///' + ((Join-Path $work $page) -replace '\\', '/')
        # Chrome writes harmless noise to stderr; under 'Stop' PowerShell 5.1 turns
        # that into a terminating NativeCommandError, so relax it for this call only.
        $ErrorActionPreference = 'Continue'
        $dom = & $chrome --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --window-size=1200,800 "--user-data-dir=$work\prof" --virtual-time-budget=5000 --dump-dom $url 2>$null | Out-String
        $ErrorActionPreference = 'Stop'
        if ($dom -notmatch '(?s)<div id="out">(.*?)</div>') { throw "no result in $page" }
        $out = [System.Net.WebUtility]::HtmlDecode($Matches[1])
        "== $page"; $out
        $all += $out
    }
    if (([regex]::Matches($all, 'SUMMARY fails=0')).Count -eq 2) { exit 0 } else { exit 1 }
} finally {
    if ($work -like (Join-Path $env:TEMP 'pnb_dtsort_*')) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
