# =============================================================================
# Penumbra VIS CHARTS suite (2026-09-29): vis() charts in scheduled email + PDF.
#
# penumbra_render_charts.php (extract / page / parse / MIME / PDF hand-off) end
# to end on THIS workstation: a worker copy runs here on a local queue with the
# local Edge, the render page mirrors the LIVE app's js/, the PDF plugin copy
# draws the result. The runner's own edits are thin call sites and are proven
# live (a scheduled test send); everything with logic is here.
#
#   run.ps1                                  the LIVE files
#   run.ps1 -Module <p> -Client <p> -Worker <p> -Pdf <p>   staged copies
#   run.ps1 -Mutant noquote   the extractor stops tracking quotes: a title with
#                             parens ends the call early (extract + render asserts red)
#   run.ps1 -Mutant nocid     the related wrapper attaches every image whether or
#                             not the HTML references it (mime asserts red)
# Full-screen links (2026-10-06, sections L/O/M of test_vischarts.php):
#   run.ps1 -Mutant vispos       the plan numbers only the emailed charts, so a slide() or a
#                                web() chart stops counting (plan, oracle and engine asserts red)
#   run.ps1 -Mutant nopagecheck  the plan/engine call-list guard is gone (L2 red)
#   run.ps1 -Mutant nodoubt      a chart that did not draw no longer gates the numbers after it (L2, M5 red)
#   run.ps1 -Mutant noescape     the link's href is written unescaped (L4 red)
#   run.ps1 -Mutant nobase       no hand-over check: charts link with no base URL (L3, M4 red)
#   run.ps1 -Mutant planweb      RUNNER mutant: the plan is taken AFTER web() is removed (M1 red)
# "%" charts that scale with the email (2026-10-06, section N):
#   run.ps1 -Mutant nobasewidth  the render page ignores baseWidth: the charts are drawn against 900 again (N real render red)
#   run.ps1 -Mutant nomaxw       no cap at the picture's own pixels (N markup red)
#   run.ps1 -Mutant nosumpack    the rows pack without looking at the percentages (N packing red)
#   run.ps1 -Mutant fluidall     every layout is fluid, not only Dashboard (F and N default-layout asserts red)
#   run.ps1 -Mutant nowpct       the authored "%" is not remembered, so nothing is fluid (N real render red)
# Run the body as a scriptblock from the workstation (UNC .ps1 policy):
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\vischarts'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot',"`$here = '$dir'")))
# Output: summary.txt, php.out, out\chart1..3.png/.jpg, out\charts.pdf,
# out\email_body.txt. Exit code 1 when any assertion fails.
# =============================================================================
param([string]$Module = '', [string]$Client = '', [string]$Worker = '', [string]$Pdf = '', [string]$Runner = '', [string]$Mutant = '')
$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\vischarts' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$phpDir = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p'
$app = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $Module) { $Module = "$app\penumbra_render_charts.php" }
if (-not $Client) { $Client = "$app\penumbra_render_client.php" }
if (-not $Worker) { $Worker = "$phpDir\penumbra_render_worker.ps1" }
if (-not $Pdf)    { $Pdf = "$app\plugins\pdf_generator.php" }
$php = "$phpDir\php.exe"
# Everything under test runs LOCALLY: PHP's is_writable() refuses a UNC queue,
# a UNC .ps1 is refused as unsigned, and Edge renders here.
$work = Join-Path $env:LOCALAPPDATA 'Temp\penumbra_vischarts'
$q = Join-Path $work 'queue'
$mod = Join-Path $work 'mod'
$results = New-Object System.Collections.Generic.List[object]
function Assert([string]$name, [bool]$cond, [string]$detail = '') { $results.Add(@{ name = $name; pass = $cond; detail = $detail }) | Out-Null; if ($cond) { Write-Host "  PASS  $name" -ForegroundColor Green } else { Write-Host "  FAIL  $name" -ForegroundColor Red; if ($detail) { Write-Host "        $detail" -ForegroundColor DarkYellow } } }
function Del([string]$p) { try { if (Test-Path -LiteralPath $p) { [IO.File]::Delete($p) } } catch {} }
function KillQueueEdge { Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*penumbra_vischarts\queue*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
function Wait-Until([scriptblock]$cond, [int]$ms) { $sw = [Diagnostics.Stopwatch]::StartNew(); while ($sw.ElapsedMilliseconds -lt $ms) { if (& $cond) { return $true }; Start-Sleep -Milliseconds 150 }; return $false }

Write-Host "[1/4] fixtures"
foreach ($d in @($work, $q, $mod, (Join-Path $mod 'plugins'), (Join-Path $here 'out'))) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
Get-ChildItem $q -File -ErrorAction SilentlyContinue | ForEach-Object { Del $_.FullName }
if (Test-Path (Join-Path $q 'js')) { Remove-Item (Join-Path $q 'js') -Recurse -Force -ErrorAction SilentlyContinue }
Get-ChildItem (Join-Path $here 'out') -File -ErrorAction SilentlyContinue | ForEach-Object { Del $_.FullName }
KillQueueEdge
$src = [IO.File]::ReadAllText($Module)
$mutants = @{
  'noquote' = @('if ($c === "''") { $inSQ = true; }', 'if (false) { $inSQ = true; }')
  'nocid'   = @('if (strpos($html, ''cid:'' . $cid) !== false) $used[$cid] = $part;', '$used[$cid] = $part;')
  'vispos'      = @('if (!$e[''slide''] && !$e[''action'']) {', 'if ($e[''kind''] === ''vis'' && !$e[''web''] && !$e[''slide''] && !$e[''action'']) {')
  'nopagecheck' = @('array_values($calls) !== $planCalls || ', 'false || ')
  'nodoubt'     = @('if (!isset($images[$tok])) { $doubt = true; continue; }', 'if (!isset($images[$tok])) { continue; }')
  'noescape'    = @('$href = htmlspecialchars((string)$img[''href''], ENT_QUOTES);', '$href = (string)$img[''href''];')
  'nobase'      = @('if (empty($link[''base'']) || !is_string($link[''base'']) || !$images) return array();', 'if (!$images) return array();')
  'nobasewidth' = @('isset($opts[''baseWidth''])', 'false')
  'nomaxw'      = @('width:100%; max-width:'' . $nat . ''px; height:auto;', 'width:100%; height:auto;')
  'nosumpack'   = @('if ($cur && $sum + $p > 100.0001) {', 'if ($cur && $sum + $p > 1000) {')
  'fluidall'    = @('$fluid = penumbra_vis_fluid_layout();', '$fluid = true;')
  'nowpct'      = @('$wpct = (float)$wm[1];', '$wpct = 0.0;')
}
if ($Mutant -and $Mutant -ne 'planweb') {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant'" }
  $n = ([regex]::Matches($src, [regex]::Escape($mutants[$Mutant][0]))).Count
  if ($n -ne 1) { throw "mutant anchor found $n times" }
  $src = $src.Replace($mutants[$Mutant][0], $mutants[$Mutant][1]); Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText((Join-Path $mod 'penumbra_render_charts.php'), $src)
Copy-Item $Client (Join-Path $mod 'penumbra_render_client.php') -Force
Copy-Item $Pdf (Join-Path $mod 'plugins\pdf_generator.php') -Force
# TCPDF rides beside the plugin copy (the plugin loads __DIR__/lib/tcpdf); one-time cache.
if (-not (Test-Path (Join-Path $mod 'plugins\lib\tcpdf\tcpdf.php'))) {
  Write-Host "      caching TCPDF beside the plugin copy (one time) ..."
  Copy-Item (Join-Path $app 'plugins\lib') (Join-Path $mod 'plugins\lib') -Recurse -Force
}
$wut = Join-Path $work 'worker_under_test.ps1'
Copy-Item $Worker $wut -Force
# The runner's email header builder, lifted by the parity extractor (top-level
# function declarations, each guarded by function_exists so the test stubs win -
# schedule_runner.php itself is never run).
if (-not $Runner) { $Runner = "$app\schedule_runner.php" }
if ($Mutant -eq 'planweb') {
  # a RUNNER mutant: the plan hook moves below the web() removal, where the charts inside web() are already gone
  $rsrc = [IO.File]::ReadAllText($Runner)
  $hook = "    if (!`$plainOutput && !empty(`$reportMeta['renderCharts']) && function_exists('penumbra_vis_live_plan')) {`r`n        `$reportMeta['visPlan'] = penumbra_vis_live_plan(`$text);`r`n    }`r`n"
  $webLine = "    `$text = _snippet_remove_balanced_call(`$text, 'web');`r`n"
  $n1 = ([regex]::Matches($rsrc, [regex]::Escape($hook))).Count
  $n2 = ([regex]::Matches($rsrc, [regex]::Escape($webLine))).Count
  if ($n1 -ne 1 -or $n2 -ne 1) { throw "runner mutant anchors: hook $n1, web line $n2" }
  $rsrc = $rsrc.Replace($hook, '').Replace($webLine, $webLine + $hook)
  $Runner = Join-Path $work 'schedule_runner_mut.php'
  [IO.File]::WriteAllText($Runner, $rsrc)
  Write-Host "      + RUNNER MUTANT planweb"
}
& $php -n "$phpDir\penumbra_tests\parity\extract_engine_c.php" $Runner "$here\runner_mirror.php" | Out-Host
Write-Host "      module: $Module"; Write-Host "      client: $Client"; Write-Host "      worker: $Worker"; Write-Host "      pdf:    $Pdf"; Write-Host "      runner: $Runner"

Write-Host "[2/4] worker up"
$wOut = Join-Path $here 'worker.out'
$a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $wut, '-Queue', $q, '-MaxHours', '1', '-PollMs', '200', '-RenderTimeoutSec', '120', '-StaleMinutes', '5', '-StaleEveryMinutes', '0')
$w1 = Start-Process -FilePath 'powershell.exe' -ArgumentList $a -PassThru -WindowStyle Hidden -RedirectStandardOutput $wOut -RedirectStandardError ($wOut + '.err')
$hb = Join-Path $q 'worker.heartbeat'
Assert 'worker: heartbeat appears within 10s' (Wait-Until { Test-Path $hb } 10000) ''

Write-Host "[3/4] php: units + a real render + the pdf"
$phpOut = Join-Path $here 'php.out'
$pa = @('-n', '-d', 'display_errors=stderr', '-d', 'memory_limit=1024M', '-d', 'error_reporting=32767', "$here\test_vischarts.php", $mod, $q, $app, (Join-Path $here 'out'))
$pp = Start-Process -FilePath $php -ArgumentList $pa -PassThru -NoNewWindow -RedirectStandardOutput $phpOut -RedirectStandardError ($phpOut + '.err')
$pp.WaitForExit(600000) | Out-Null; if (-not $pp.HasExited) { $pp.Kill() }
$raw = Get-Content $phpOut -Raw -ErrorAction SilentlyContinue
$line = ($raw -split "`n" | Where-Object { $_.StartsWith('RESULTS_JSON:') } | Select-Object -Last 1)
if ($line) {
  $parsed = $line.Substring(13) | ConvertFrom-Json
  foreach ($r in $parsed.results) { Assert $r.name ([bool]$r.pass) ([string]$r.detail) }
} else {
  $err = Get-Content ($phpOut + '.err') -Raw -ErrorAction SilentlyContinue
  Assert 'php: the test script finished' $false ("no RESULTS_JSON; stdout=" + [string]$raw + " stderr=" + [string]$err)
}

Write-Host "[4/4] stop"
Stop-Process -Id $w1.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
KillQueueEdge
Del (Join-Path $q 'worker.lock')

$fail = ($results | Where-Object { -not $_.pass } | Measure-Object).Count
$lines = $results | ForEach-Object { if ($_.pass) { "  PASS  $($_.name)" } else { "  FAIL  $($_.name)`r`n        $($_.detail)" } }
$lines += ("{0} assertions, {1} failed" -f $results.Count, $fail)
if ($Mutant) { $lines += "mutant: $Mutant" }
$lines += "module: $Module"; $lines += "client: $Client"; $lines += "worker: $Worker"; $lines += "pdf: $Pdf"
[IO.File]::WriteAllLines("$here\summary.txt", $lines)
Write-Host ("{0} assertions, {1} failed" -f $results.Count, $fail)
if ($fail -gt 0) { exit 1 }
