# =============================================================================
# Penumbra TOO MANY GROUPS vs LIMIT SUITE (2026-10-17)
#
#   Grouped bar / line / area keep only the top `limit` X labels. With "Other"
#   off the 50-group check now counts the series actually drawn (groups inside
#   those labels); with Other on, and on every other chart type, it still counts
#   every row's group.
#
#   run.ps1                      live js/main.js
#   run.ps1 -MainJs <p>          a staged copy
#   run.ps1 -Mutant <name>       one part of the fix reverted (below); needs the FIXED main.js
#   Control = the pre-fix main.js: T1-T5 must FAIL there (T6-T8 pass on both).
#
# UNC .ps1 files are GPO-blocked: run as a scriptblock from PowerShell.
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\gblimit' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)

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

# One part of the fix reverted each. An anchor must occur exactly once, or the run throws.
$mutants = @{
  # the all-rows count runs again for grouped bar / line / area with Other off (ignores Limit)
  'nodefer'    = @("!_gbRepurposed && !(_gbCountsTopOnly && !otherBucket)) {", "!_gbRepurposed) {")
  # the deferred count of the drawn series never fires
  'nopost'     = @("if (_gbCountsTopOnly && !otherBucket && _gbDrawn > _maxGroupByValues) {", "if (false) {")
  # Other on also defers (and then nothing counts the Other bar's groups)
  'otherdefer' = @("!_gbRepurposed && !(_gbCountsTopOnly && !otherBucket)) {", "!_gbRepurposed && !_gbCountsTopOnly) {")
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
$hooks = 'try { window.__CA = { chartData: generateChartDataFromMaps, loadChartModule: penumbraLoadChartModule }; } catch (e) { window.__CA_ERR = String(e); }'
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
