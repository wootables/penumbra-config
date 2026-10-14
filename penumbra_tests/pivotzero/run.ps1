# =============================================================================
# Penumbra PIVOT-ZERO SUITE (2026-10-04)  -  engine changes made for ?id=hitratio
#
#   P  a formula ending in '%' is a percentage: (expr) x 100, flagged ast.pct;
#      a '%' inside a {label} is part of the label; a bare '%' is empty
#   Z  a pivot data cell whose value is 0 PRINTS it when source rows fall in the
#      cell (a PI with 2 proposals and none awarded reads 0 / 0.0%); a cell with
#      NO rows stays blank; '%' formulas print 1 decimal + '%' in data cells and
#      the Grand Total row; plain formulas keep the old format
#   N  the footer's spacer cell (colspan over the non-sticky row-field columns)
#      is tagged data-row-field-span-from and minimizes with those columns - it
#      used to hold each "minimized" column open at ~5.5px (the empty sliver
#      after the first column of a collapsible pivot)
#
#   powershell -File run.ps1                      live js/main.js + css/main.css
#   powershell -File run.ps1 -MainJs <p>          a staged copy
#   powershell -File run.ps1 -Mutant <name>       one behaviour reverted (below)
#   Control = -MainJs <the pre-change main.js>.
#
# UNC .ps1 files are GPO-blocked: run the BODY as a scriptblock, never piped:
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotzero'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -MainJs <p>
# PHP side (runner): php -n test_runner.php [--runner=<path>] [--mutant=<name>]
# Writes nothing to the webroot. Exit 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$Css = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotzero' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $Css) { $Css = "$app\css\main.css" }
$browser = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if (-not (Test-Path $browser)) { $browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }

Write-Host "[1/3] staging JS + patching main.js ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }
Write-Host "      main.js under test: $MainJs"
$u8 = New-Object System.Text.UTF8Encoding($false)
$src = $u8.GetString([IO.File]::ReadAllBytes($MainJs))
$cssText = $u8.GetString([IO.File]::ReadAllBytes($Css))
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# One single-point change each; the anchor must occur exactly once.
$mutants = @{
  'pctparse'  = @("if (s.charAt(s.length - 1) === '%') {", 'if (false) {')
  'pctfmt'    = @("if (aggType === 'formula' && _pivotFormulaASTs && _pivotFormulaASTs[aggIdx] && _pivotFormulaASTs[aggIdx].pct) {", 'if (false) {')
  'zerorows'  = @('if (val === 0 && !_pivotZeroIsMeaningful(aggType) && !_cellHasRows) {', 'if (val === 0 && !_pivotZeroIsMeaningful(aggType)) {')
  'zeroshow'  = @('formatPivotValue(displayValue, aggType, _cellHasRows || undefined, _aggUnitBase[idx], idx)', 'formatPivotValue(displayValue, aggType, undefined, _aggUnitBase[idx], idx)')
  'spacertag' = @(' data-row-field-span-from="${effectiveSticky}"></td>', '></td>')
  'spacermin' = @(", [data-row-field-span-from=`"' + childLevel + '`"]';", "';")
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]
  $n = ([regex]::Matches($src, [regex]::Escape($mOld))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1: $mOld" }
  $src = $src.Replace($mOld, $mNew)
  Write-Host "      + MUTANT $Mutant"
}
[IO.File]::WriteAllText("$here\main_css_under_test.css", $cssText, $u8)

# Hoisted function declarations only (a let/var is still in its TDZ at the anchor).
$hooks = @(
  'try { window.__FY = { pivotTable: generatePivotTable, processPivot: processPivotData, extraVals: getExtraValFields,',
  '  setPivotSettings: function (s) { currentPivotSettings = s; },',
  '  parseFormula: parsePivotFormula, evalFormula: evaluatePivotFormula,',
  '  setFormulas: function (a) { _pivotFormulaASTs = a; },',
  '  minimize: updateRowFieldColumnMinimization };',
  '} catch (e) { window.__FY_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
$patched = $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $u8)

Write-Host "[2/3] running harness headless ..."
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
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
if ($fail -gt 0) { exit 1 }
