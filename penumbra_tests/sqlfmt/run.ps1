# penumbra_tests\sqlfmt - the Format SQL engine (js/penumbra_sqlfmt.js on top of js/sql-formatter.min.js)
#
# Runs harness.html in LOCAL headless Edge against the two scripts copied out of
# the app directory and prints the RESULT line. Exit 0 = every assertion passed
# and the harness's own control assertion proved it can report a failure.
#
#   -app      app root holding js\sql-formatter.min.js + js\penumbra_sqlfmt.js
#   -suite    this directory (needed when the body runs as a scriptblock, where
#             $MyInvocation carries no path)
#   -Control  MUTANT run: the module is patched back to the old tabularLeft
#             layout; the suite MUST then fail. Proves the assertions bite.
#
# UNC .ps1 files are GPO-blocked from -File: run the BODY as a scriptblock:
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sqlfmt\run.ps1'))
#   & $sb ; & $sb -Control
param(
    [string]$app   = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra',
    [string]$suite = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sqlfmt',
    [switch]$Control
)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { Write-Output "NO EDGE at $edge"; exit 2 }
$work = Join-Path $env:TEMP ('penumbra_sqlfmt_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work | Out-Null
Copy-Item (Join-Path $app 'js\sql-formatter.min.js') $work
Copy-Item (Join-Path $app 'js\penumbra_sqlfmt.js') $work
Copy-Item (Join-Path $suite 'harness.html') $work
if ($Control) {
    $m = Join-Path $work 'penumbra_sqlfmt.js'
    $src = [IO.File]::ReadAllText($m)
    if ($src -notmatch "indentStyle: 'standard'") { Write-Output 'CONTROL: mutation anchor missing'; exit 2 }
    [IO.File]::WriteAllText($m, $src.Replace("indentStyle: 'standard'", "indentStyle: 'tabularLeft'"))
}
$dom = Join-Path $work 'dom.txt'
$url = 'file:///' + ($work -replace '\\', '/') + '/harness.html'
Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput $dom -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
    '--virtual-time-budget=15000', "--user-data-dir=$work\profile", '--dump-dom', $url)
$txt = [IO.File]::ReadAllText($dom)
if ($txt -match 'RESULT pass=(\d+) fail=(\d+) control=(\w+)') {
    $p = [int]$Matches[1]; $f = [int]$Matches[2]; $c = $Matches[3]
    if ($Control) {
        $verdict = 'MUTANT SURVIVED - suite is blind'
        if ($f -gt 0) { $verdict = 'MUTANT CAUGHT (expected)' }
        Write-Output "CONTROL (tabularLeft mutant): pass=$p fail=$f control=$c -> $verdict"
        if ($f -gt 0) { exit 0 } else { exit 1 }
    }
    Write-Output "sqlfmt: pass=$p fail=$f control=$c"
    if ($f -eq 0 -and $c -eq 'ok') { exit 0 }
    if ($txt -match '(?s)<pre id="out"[^>]*>(.*?)RESULT ') {
        Write-Output ($Matches[1] -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&amp;', '&')
    }
    exit 1
}
Write-Output 'NO RESULT - harness did not run (see dom.txt)'
Write-Output $dom
exit 2
