# =============================================================================
# MAP CLICK-TO-ZOOM SUITE (2026-10-06) - map_zoom_test.html
#
#   run.ps1 -JsDir <dir>            dir holding main.js + penumbra_charts.js to test
#                                   (default: the LIVE app's js folder)
#   run.ps1 -JsDir <dir> -Mutant X  one targeted break, anchor must hit EXACTLY once:
#       contract  main.js click wrapper back to "ignore the prev handler's answer"
#       ring      zoomBox keeps far-off sizeable rings (no proximity rule)
#       clip      no clip while zoomed
#       nest      first outline hit wins instead of the smallest
#       floor     no minimum zoom window
#       labels    off-view labels not suppressed
#
# EXPECTED (2026-10-06, live after 20261006-mapzoom + -mapzoom2): 76 / 0.
# 2026-10-15: + K (keyboard route: chart.data._pnbMapZoom + main.js _chartA11yPoints) = 82 / 0.
#   Control: live pair -> 6 FAIL; live penumbra_charts.js + staged main.js -> 5 FAIL (no zoom).
#   Control: -JsDir with the .bak-20261006-mapzoom pair copied into a folder -> RED (10 / 20 + harness stop).
#   Mutants: contract 10 FAIL, floor 2, ring / clip / nest / labels 1 each.
# 2026-10-15 (moderate a11y, dash): + Z9-Z11 focus when Zoom out hides itself (cog, else canvas) = 87 / 0
#   on the staged penumbra_charts.js. Live (control) 2 FAIL (Z9, Z10); stage minus the focusAfterZoomOut call 2 FAIL.
# Installed copy lives in penumbra_tests\mapzoom. The UNC share blocks .ps1 files,
# so run it as a scriptblock with -Here:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\mapzoom'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Here $d
#
# SRC.js = penumbra_charts.js + main.js, module first (grab() takes the first
# match, same as the charts suite), carried as base64 so the 6 MB / 2-NUL main.js
# survives byte for byte. Headless Chrome, its own profile per run.
# =============================================================================
param([string]$JsDir = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js',
      [ValidateSet('', 'contract', 'ring', 'clip', 'nest', 'floor', 'labels')][string]$Mutant = '',
      [string]$Here = '')
$ErrorActionPreference = 'Stop'
if (-not $Here) { $Here = $PSScriptRoot }
if (-not $Here) { throw 'pass -Here when running as a scriptblock' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra\js'
foreach ($f in 'chart-4.5.1.min.js', 'jquery-3.7.1.min.js', 'penumbra_geo_us.js') { Copy-Item "$live\$f" "$Here\$f" -Force }

$u8 = New-Object System.Text.UTF8Encoding($false)
$mod  = $u8.GetString([IO.File]::ReadAllBytes("$JsDir\penumbra_charts.js"))
$main = $u8.GetString([IO.File]::ReadAllBytes("$JsDir\main.js"))

function Swap([string]$text, [string]$from, [string]$to, [string]$name) {
  $n = ([regex]::Matches($text, [regex]::Escape($from))).Count
  if ($n -ne 1) { throw "mutant '$name': anchor found $n times (need 1)" }
  return $text.Replace($from, $to)
}
if ($Mutant) {
  # 01.anchor / 01.repl = main.js's click wrapper before / after (the 'contract' mutant swaps them back).
  $blk = Join-Path $Here 'blocks'
  switch ($Mutant) {
    'contract' {
      $new = ([IO.File]::ReadAllText("$blk\01.repl")).Replace("`r`n", "`n").TrimEnd("`n").Replace("`n", "`r`n")
      $old = ([IO.File]::ReadAllText("$blk\01.anchor")).Replace("`r`n", "`n").TrimEnd("`n").Replace("`n", "`r`n")
      $main = Swap $main $new $old 'contract' }
    'ring'   { $mod = Swap $mod 'if (Math.sqrt(gx * gx + gy * gy) > diag) continue;' '/* mutant: no proximity rule */' 'ring' }
    'clip'   { $mod = Swap $mod 'ctx.clip();' '/* mutant: no clip */' 'clip' }
    'nest'   { $mod = Swap $mod 'if (ar < bestArea) { best = i; bestArea = ar; }' 'if (best < 0) { best = i; bestArea = ar; }' 'nest' }
    'floor'  { $mod = Swap $mod 'w = Math.min(box.w, Math.max(w + pad * 2, box.w / 14));' 'w = Math.min(box.w, Math.max(w + pad * 2, 0));' 'floor'
               $mod = Swap $mod 'h = Math.min(box.h, Math.max(h + pad * 2, box.h / 14));' 'h = Math.min(box.h, Math.max(h + pad * 2, 0));' 'floor' }
    'labels' { $mod = Swap $mod 'if (zx < za.left || zx > za.right || zy < za.top || zy > za.bottom) return false;' '/* mutant */' 'labels' }
  }
  Write-Host "MUTANT $Mutant applied"
}
$b64 = [Convert]::ToBase64String($u8.GetBytes($mod + "`n" + $main))
[IO.File]::WriteAllText("$Here\SRC.js", 'window.__src = new TextDecoder().decode(Uint8Array.from(atob("' + $b64 + '"), function (c) { return c.charCodeAt(0); }));', $u8)

$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
$udd = Join-Path $env:TEMP ('mzprof_' + [guid]::NewGuid().ToString('N'))
$dom = Join-Path $Here 'map_zoom_test_dom.txt'
if (Test-Path $dom) { [IO.File]::Delete($dom) }
$url = 'file:///' + $Here.Replace([char]92, [char]47) + '/map_zoom_test.html'
$args = @('--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--window-size=1000,1400',
          "--user-data-dir=$udd", '--virtual-time-budget=60000', '--dump-dom', $url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $args
$pr.WaitForExit(240000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$i = $d.IndexOf('<pre id="out">'); if ($i -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$j = $d.IndexOf('</pre>', $i)
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
$lines = $txt -split "`n"
Write-Host $lines[0]
$pi = $d.IndexOf('<pre id="prog">'); if ($pi -ge 0) { $pj = $d.IndexOf('</pre>', $pi); Write-Host ('  progress: ' + [System.Net.WebUtility]::HtmlDecode($d.Substring($pi + 15, $pj - $pi - 15))) }
foreach ($l in $lines) { if ($l.StartsWith('FAIL') -or $l.StartsWith('SCRIPT')) { Write-Host ('  ' + $l.Trim()) } }
