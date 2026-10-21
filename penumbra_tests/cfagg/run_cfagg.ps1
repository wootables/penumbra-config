# =============================================================================
# format() aggregate-CONDITION parity check (2026-10-20)
#
# Engine A = evaluateAggregateCondition (js/main.js), engine C =
# evaluate_aggregate_condition_php (schedule_runner.php): the evaluators behind
# format(header|row|cell, ..., <aggregate condition>, STYLE) on screen and in email.
# The snippet parity harness (penumbra_tests\parity) never reaches them: they keep
# their OWN mode()/distinct()/count_filled()/... - a fourth hand-copied set.
#
# The share blocks .ps1 files, so run the BODY as a scriptblock (never pipe it):
#   $sb = [scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\cfagg\run_cfagg.ps1')); & $sb
#   & $sb -MainSrc <stage js\main.js> -RunnerSrc <stage schedule_runner.php>   # a stage or mutant copy
# (a local copy of the folder also runs with powershell -File run_cfagg.ps1).
#
# Defaults read the LIVE files; nothing is written to the webroot. The work happens
# in %TEMP%\penumbra_cfagg (headless Edge cannot load a page off the UNC share):
# corpus.json, cfagg_c.php and cfagg_a.html are copied there each run, with the
# vendor libs from live js\. Engine C is extracted from the runner by the parity
# harness's extract_engine_c.php; both engines are instrumented IN THE COPIES ONLY to
# record the text the final numeric comparison reads.
#
# Output: one line per case (A, C, expect, what each engine read), then a verdict.
# GREEN = A and C agree on every case AND both match "expect"; RED ends in a throw.
# "changed" marks a case where the code differs from the pre-2026-10-20 behaviour
# (beforeA/beforeC): every changed case shows it; a control run of the old code shows none.
# Proved 2026-10-20: old code RED (6 DIVERGENT, 22 off "expect", 0 "changed"), the change
# GREEN 33/33; one-line mutants each RED on their own cases only.
# =============================================================================
param(
    [string]$MainSrc,
    [string]$RunnerSrc,
    [string]$App = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot   # empty when run as a scriptblock
if (-not $src) { $src = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\cfagg' }
$kit = Join-Path $env:TEMP 'penumbra_cfagg'
if (-not (Test-Path -LiteralPath $kit)) { New-Item -ItemType Directory -Path $kit | Out-Null }
foreach ($f in @('corpus.json', 'cfagg_c.php', 'cfagg_a.html')) {
    Copy-Item -LiteralPath (Join-Path $src $f) -Destination (Join-Path $kit $f) -Force
}
$parity = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\parity'
$php = '\\oitras\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$work = Join-Path $kit 'work'
if (-not (Test-Path $work)) { New-Item -ItemType Directory -Path $work | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)

$runnerPhp = Join-Path $App 'schedule_runner.php'
if ($RunnerSrc) { if (-not (Test-Path -LiteralPath $RunnerSrc)) { throw "-RunnerSrc not found: $RunnerSrc" }; $runnerPhp = $RunnerSrc }
$mainJs = Join-Path $App 'js\main.js'
if ($MainSrc) { if (-not (Test-Path -LiteralPath $MainSrc)) { throw "-MainSrc not found: $MainSrc" }; $mainJs = $MainSrc }
Write-Host "engine A main.js        : $mainJs"
Write-Host "engine C schedule_runner: $runnerPhp"

# ---- engine C ----------------------------------------------------------------
foreach ($f in @('engineC_functions.php', 'result_c.json', 'result_a.json', 'a.dom.txt')) {
    $p = Join-Path $work $f; if (Test-Path -LiteralPath $p) { [IO.File]::Delete($p) }
}
& $php -n "$parity\extract_engine_c.php" $runnerPhp (Join-Path $work 'engineC_functions.php') | Out-Host
if ($LASTEXITCODE -ne 0) { throw "engine C extraction failed (exit $LASTEXITCODE)" }
& $php -n (Join-Path $kit 'cfagg_c.php') $App (Join-Path $work 'engineC_functions.php') (Join-Path $kit 'corpus.json') (Join-Path $work 'result_c.json') | Out-Host
if ($LASTEXITCODE -ne 0) { throw "engine C run failed (exit $LASTEXITCODE)" }

# ---- engine A ----------------------------------------------------------------
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item -LiteralPath (Join-Path $App "js\$f") -Destination (Join-Path $kit $f) -Force }

$src = [IO.File]::ReadAllText($mainJs)
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 300).Contains($anchor)) { throw 'main.js closure anchor not found' }
$gate = 'const match = processedCondition.match(/^\s*(-?\d*\.?\d+)\s*([<>=!]+)\s*(-?\d*\.?\d+)\s*$/);'
$gi = $src.IndexOf($gate)
if ($gi -lt 0 -or $src.IndexOf($gate, $gi + 1) -ge 0) { throw 'final-gate anchor must hit exactly once in main.js' }
$src = $src.Substring(0, $gi) + 'window.__EAC_FINAL = processedCondition; ' + $src.Substring($gi)
$nl = "`r`n"
$inject = $anchor + $nl +
  '    try {' + $nl +
  '      window.__EAC = function (cond, maps) {' + $nl +
  '        masterRowData = maps;' + $nl +
  "        var tb = document.querySelector('#resultsTable tbody');" + $nl +
  "        tb.innerHTML = '';" + $nl +
  '        for (var i = 0; i < maps.length; i++) {' + $nl +
  "          var tr = document.createElement('tr'); var td = document.createElement('td');" + $nl +
  "          td.setAttribute('data-column', '#'); td.textContent = String(i + 1);" + $nl +
  '          tr.appendChild(td); tb.appendChild(tr);' + $nl +
  '        }' + $nl +
  '        window.__EAC_FINAL = null;' + $nl +
  '        var r = evaluateAggregateCondition(cond);' + $nl +
  '        return { result: r, final: window.__EAC_FINAL };' + $nl +
  '      };' + $nl +
  '    } catch (e) { window.__EAC_ERR = String(e); }' + $nl
$ai = $src.IndexOf($anchor)
$patched = $src.Substring(0, $ai) + $inject + $src.Substring($ai + $anchor.Length)
[IO.File]::WriteAllText((Join-Path $kit 'main_cfagg.js'), $patched, $utf8)
[IO.File]::WriteAllText((Join-Path $kit 'corpus_inline.js'), 'window.__CORPUS = ' + [IO.File]::ReadAllText((Join-Path $kit 'corpus.json')) + ';', $utf8)

$dom = Join-Path $work 'a.dom.txt'
$url = 'file:///' + $kit.Replace([char]92, [char]47) + '/cfagg_a.html'
$proc = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList `
  '--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files', `
  "--user-data-dir=$(Join-Path $kit 'edgeprofile')",'--virtual-time-budget=8000','--dump-dom',$url
$readShared = {
  param($p)
  $fs = [IO.File]::Open($p, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  try { $sr = New-Object IO.StreamReader($fs); return $sr.ReadToEnd() } finally { $fs.Dispose() }
}
$sw = [Diagnostics.Stopwatch]::StartNew(); $ready = $false
while ($sw.Elapsed.TotalSeconds -lt 180) {
  try { $peek = & $readShared $dom; if ($peek.Contains('RESULTS_JSON:') -and $peek.TrimEnd().EndsWith('</html>')) { $ready = $true; break } } catch { }
  if ($proc.HasExited -and $sw.Elapsed.TotalSeconds -gt 5) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $proc.HasExited) { try { $proc.Kill() } catch { } }
if (-not $ready) { throw 'engine A: no complete RESULTS_JSON dump within 180s' }
$d = $null
for ($t = 0; $t -lt 40; $t++) { try { $d = [IO.File]::ReadAllText($dom); break } catch { Start-Sleep -Milliseconds 250 } }
if ($null -eq $d) { throw "engine A: $dom stayed locked" }
$i = $d.IndexOf('<pre id="out">'); $j = $d.IndexOf('</pre>', $i)
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "engine A harness failed: $($txt.Substring(0, [Math]::Min(300, $txt.Length)))" }
$parsedA = $txt.Substring(13) | ConvertFrom-Json
$pageErrors = @(); if ($null -ne $parsedA.pageErrors) { $pageErrors = @($parsedA.pageErrors) }

# ---- compare -----------------------------------------------------------------
$corpus = [IO.File]::ReadAllText((Join-Path $kit 'corpus.json')) | ConvertFrom-Json
$resC = [IO.File]::ReadAllText((Join-Path $work 'result_c.json')) | ConvertFrom-Json
$byA = @{}; foreach ($r in $parsedA.cases) { $byA[$r.id] = $r }
$byC = @{}; foreach ($r in $resC) { $byC[$r.id] = $r }
$nDiv = 0; $nExp = 0; $nPred = 0; $nErr = 0; $nKept = 0
foreach ($c in $corpus.cases) {
  $a = $byA[$c.id]; $cc = $byC[$c.id]
  $flags = @()
  if ($null -eq $a -or $null -eq $cc -or $a.error -or $cc.error) {
    $nErr++; $flags += 'ERROR'
    Write-Host ("{0,-26} ERROR A={1} C={2}" -f $c.id, $a.error, $cc.error)
    continue
  }
  if ($a.result -ne $cc.result) { $nDiv++; $flags += 'DIVERGENT' }
  if ($a.result -ne $c.expect -or $cc.result -ne $c.expect) { $nExp++; $flags += 'EXPECT-MISS' }
  if (($null -ne $c.beforeA -and $a.result -ne $c.beforeA) -or ($null -ne $c.beforeC -and $cc.result -ne $c.beforeC)) { $nPred++; $flags += 'changed' }
  $keptWant = 0; if ($cc.result) { $keptWant = 1 }
  if ($cc.kept -ne $keptWant -or $cc.parsed -ne 1) { $nKept++; $flags += "KEPT=$($cc.kept)/parsed=$($cc.parsed)" }
  Write-Host ("{0,-26} A={1,-5} C={2,-5} expect={3,-5} | A reads '{4}' | C reads '{5}'  {6}" -f $c.id, $a.result, $cc.result, $c.expect, $a.final, $cc.final, ($flags -join ' '))
}
Write-Host ''
Write-Host ("cases {0}: DIVERGENT {1}, expect misses {2}, errors {3}, page errors {4}, consumer mismatches {5}; changed since before 2026-10-20: {6}" -f @($corpus.cases).Count, $nDiv, $nExp, $nErr, $pageErrors.Count, $nKept, $nPred)
if ($pageErrors.Count) { Write-Host ("PAGE ERRORS: " + ($pageErrors -join ' | ')) }
# A throw, not `exit`: run as a scriptblock, `exit` would close the caller's shell.
if ($nDiv -eq 0 -and $nExp -eq 0 -and $nErr -eq 0 -and $pageErrors.Count -eq 0 -and $nKept -eq 0) { Write-Host 'GREEN' }
else { throw "RED: $nDiv DIVERGENT, $nExp expect misses, $nErr errors, $($pageErrors.Count) page errors, $nKept consumer mismatches" }
