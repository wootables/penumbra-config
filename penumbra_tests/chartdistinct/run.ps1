# =============================================================================
# Penumbra CHART DISTINCT COUNT SUITE (2026-10-06)
#
# Every chart path's "Distinct Count" counts the column's own NON-BLANK TEXT -
# the pivot's rule (`valStr.trim() !== ''`) - and an X value a series has NO rows
# for counts 0. Before: the generic path (bar / line / pie / radar, with or without
# Group By), both butterfly paths and combo pushed `isNaN(n) ? 1 : n`, so a text id
# like PAM-P23-001234 counted as 1 and a Distinct Count read 1 per category; map,
# bullet, funnel, waterfall and gauge had no distinct at all and SUMMED; treemap
# and combo counted a blank as a value; combo and butterfly read a category with
# no rows as one pretend row ([0]), so Count / Running Count / Distinct showed 1.
#
#   G generic   B butterfly (both formats)   C combo   T treemap   M map
#   U bullet    F funnel    W waterfall      A gauge   (+ Count / Sum guards)
#
#   run.ps1                      live js/main.js
#   run.ps1 -MainJs <p>          a staged copy
#   run.ps1 -Mutant <name>       one fix reverted (below); needs the FIXED main.js
#   Control = the pre-fix main.js: every new-behaviour assertion must FAIL there.
#
# UNC .ps1 files are GPO-blocked: run through sumfx\launch.ps1, or as a scriptblock.
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chartdistinct' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)
$NL = "`r`n"

Write-Host "[1/3] staging libraries ..."
foreach ($f in @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js','show-hint.js',
                 'foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js','purify.min.js','penumbra_template.js')) {
  Copy-Item "$js\$f" "$here\$f" -Force
}
New-Item -ItemType Directory -Force -Path "$here\js" | Out-Null
foreach ($f in @('penumbra_charts.js','penumbra_geo_us.js')) { Copy-Item "$js\$f" "$here\js\$f" -Force }
Write-Host "      main.js: $MainJs"
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One fix reverted each. An anchor must occur exactly once, or the run throws.
$I12 = '            '; $I16 = $I12 + '    '; $I20 = $I16 + '    '; $I24 = $I20 + '    '
$mutants = @{
  'generic'   = @(("if (aggregation === 'distinct') {" + $NL + $I16 + "const _gnD"), ("if (false) {" + $NL + $I16 + "const _gnD"))
  'oldbfly'   = @(("if (aggregation === 'distinct') {" + $NL + $I20 + "const _obD"), ("if (false) {" + $NL + $I20 + "const _obD"))
  'newbfly'   = @(("if (s.agg === 'distinct') {" + $NL + $I24 + "var _bfD"), ("if (false) {" + $NL + $I24 + "var _bfD"))
  'bflynone'  = @("return (agg === 'count' || agg === 'running_count' || agg === 'distinct') ? [] : [0];", 'return [0];')
  'combonone' = @("var _sNone = (s.agg === 'count' || s.agg === 'running_count' || s.agg === 'distinct') ? [] : [0];", 'var _sNone = [0];')
  'combodist' = @("if (_sbD.trim() !== '') m[xVal].push(_sbD);", 'm[xVal].push(_sbD);')
  'combosort' = @("if (_acD.trim() !== '') agg[xVal].push(_acD);", 'agg[xVal].push(_acD);')
  'treemap'   = @("if (_tmD.trim() !== '') valuesMap.get(key).push(_tmD);", 'valuesMap.get(key).push(_tmD);')
  'map'       = @(("case 'distinct':" + $NL + $I24 + "var _mpD"), ("case 'distinct-off':" + $NL + $I24 + "var _mpD"))
  'bullet'    = @(("case 'distinct':" + $NL + $I24 + "var _blD"), ("case 'distinct-off':" + $NL + $I24 + "var _blD"))
  'funnel'    = @(("case 'distinct':" + $NL + $I24 + "var _fnD"), ("case 'distinct-off':" + $NL + $I24 + "var _fnD"))
  'waterfall' = @(("case 'distinct':" + $NL + $I24 + "var _wfD"), ("case 'distinct-off':" + $NL + $I24 + "var _wfD"))
  'gauge'     = @("case 'distinct': ggValue = ggDist.size; break;", '/* MUTANT gauge */')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
$hooks = 'try { window.__CD = { chartData: generateChartDataFromMaps, loadChartModule: penumbraLoadChartModule }; } catch (e) { window.__CD_ERR = String(e); }'
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running the harness headless ..."
$udd = Join-Path $here 'profile'
if (Test-Path $udd) { Remove-Item $udd -Recurse -Force }
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { Remove-Item $dom -Force }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=30000','--dump-dom',$url)
$pr = Start-Process -FilePath $browser -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe' or Name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json
[IO.File]::WriteAllText("$here\result.json", ($parsed | ConvertTo-Json -Depth 6), $u8)

Write-Host "[3/3] results"
if ($parsed.fatal) { throw "FATAL: $($parsed.fatal)" }
if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Warning "page errors (may invalidate results): $($parsed.pageErrors -join '; ')" }
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name + "  -- " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed{2}" -f $parsed.results.Count, $fail, $(if ($Mutant) { " (mutant $Mutant)" } else { '' }))
if ($fail) { exit 1 } else { exit 0 }
