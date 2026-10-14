# =============================================================================
# Penumbra GROUPROW suite (2026-09-28): the grouped-summary preview reads __ROW.
#
# On a grouped report with a per-group summary ("Sum of AMOUNT"), a query that names
# the summary is counted by _previewGroupedAggMatch - the Visual Search Builder's count
# and the task form's Search Filter hint. It parsed the raw text, so a leading __ROW
# was a search term no row matched: every __ROW summary query previewed 0 while the
# executed search and the scheduled email were right. Fixed by reading __ROW the way
# runTableSearch's grouped branch and the runner do: strip it, then apply same-sub-row
# matching to the row conditions.
#
#   G0            setup guard (the summary label)
#   P1-P6 H1-H6   builder preview / task-form hint, six cases (fixture.json)
#   X1-X6         the executed grouped search - the reference, green in every build
#   M1-M6         the runner's grouped-summary filter (the email) - also the reference
# Cases 5-6 are nested (@@JSON): a Widget and a QTY over 5 on DIFFERENT sub-rows match
# without __ROW and not with it, which is what tells a preview that strips __ROW but
# ignores it from a correct one.
# 26 assertions. Control: main.js.bak-20260928-grouprow (the build before) fails exactly
# P2 H2 P4 H4 P6 H6. Mutants: strip 6 (the same six), rowmatch 2 (P6 H6).
#
#   powershell -File run.ps1                  live app files
#   powershell -File run.ps1 -App <dir>       a staged app dir (js\main.js, penumbra_search.php,
#                                             schedule_runner.php read from it; libraries from live)
#   powershell -File run.ps1 -Mutant <name>   one behaviour reverted
# Writes nothing to the webroot. Exit 1 when any assertion fails - which, run as a
# scriptblock, ends the calling session too: run it on its own.
#   $d='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\grouprow'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1")))
# =============================================================================
param([string]$App = '', [string]$Mutant = '')
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\grouprow' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$extract = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivotparity\extract_mirror.php'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$u8 = New-Object System.Text.UTF8Encoding($false)

# One single-point change each; the anchor must occur exactly once in main.js.
$mutants = @{
  'strip'    = @("`n        if (/^__ROW\s+/i.test(query)) {`r`n            requireRowMatch = true;", "`n        if (false) {`r`n            requireRowMatch = true;")
  'rowmatch' = @('if (!evaluateParsedQuery(rowMap, rowParts, allCols, requireRowMatch)) continue;', 'if (!evaluateParsedQuery(rowMap, rowParts, allCols, false)) continue;')
}

Write-Host "[1/4] staging ..."
Write-Host "      app under test: $App"
foreach ($f in 'jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js','purify.min.js','penumbra_template.js','penumbra_presets.js') { Copy-Item "$live\js\$f" "$here\$f" -Force }
Copy-Item "$live\css\main.css" "$here\main.css" -Force; Copy-Item "$live\css\density.css" "$here\density.css" -Force
$src = $u8.GetString([IO.File]::ReadAllBytes("$App\js\main.js"))
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $n = ([regex]::Matches($src, [regex]::Escape($mutants[$Mutant][0]))).Count
  if ($n -ne 1) { throw "mutant '$Mutant' anchor found $n times, expected 1" }
  $src = $src.Replace($mutants[$Mutant][0], $mutants[$Mutant][1])
  Write-Host "      + MUTANT $Mutant"
}
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }
$hooks = @(
  'try { window.__RV = { setRows: function (r) { masterRowData = r; }, setAgg: function (a) { currentGroupAgg = a; },',
  '  setLevels: setGroupingColumns, rebuild: rebuildGroupedView, label: function () { return getGroupSummaryLabel(); },',
  '  wrapHide: function () { var o = hideLoading; hideLoading = function () { var r = o.apply(this, arguments); window.__RV_hides = (window.__RV_hides || 0) + 1; return r; }; } };',
  '} catch (e) { window.__RV_ERR = String(e); }'
) -join ' '
$i = $src.IndexOf($anchor)
[IO.File]::WriteAllText("$here\main_patched.js", $src.Substring(0, $i) + $anchor + "`r`n    $hooks`r`n" + $src.Substring($i + $anchor.Length), $u8)
[IO.File]::WriteAllText("$here\fixture.js", 'window.__GR_FIXTURE = ' + $u8.GetString([IO.File]::ReadAllBytes("$here\fixture.json")) + ';', $u8)

Write-Host "[2/4] browser harness (headless Edge) ..."
$udd = Join-Path $env:TEMP ('pnbgr_' + [guid]::NewGuid().ToString('N').Substring(0,6))
$dom = Join-Path $here ('dom_' + [guid]::NewGuid().ToString('N').Substring(0,6) + '.txt')
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$bArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run','--disable-extensions',"--user-data-dir=$udd",'--virtual-time-budget=40000','--window-size=1400,900','--dump-dom',$url)
$pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $bArgs
$pr.WaitForExit(180000) | Out-Null; if (-not $pr.HasExited) { $pr.Kill(); Start-Sleep -Seconds 2 }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$udd*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Milliseconds 500
$fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs, $u8); $d = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
try { Remove-Item -LiteralPath $udd -Recurse -Force -ErrorAction SilentlyContinue } catch {}
try { [IO.File]::Delete($dom) } catch {}
$a = $d.IndexOf('<pre id="out">'); $b = $d.IndexOf('</pre>', $a)
if ($a -lt 0) { throw "no <pre id=out> in dump ($($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$js = $txt.Substring(13) | ConvertFrom-Json

Write-Host "[3/4] the email (runner grouped-summary filter) ..."
$mirror = Join-Path $here 'mirror.php'
& $php -n -d memory_limit=512M $extract "$App\schedule_runner.php" $mirror | Out-Null
if (-not (Test-Path $mirror)) { throw "mirror extraction failed" }
$phpOut = & $php -n -d memory_limit=512M -d extension_dir=//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext -d extension=mbstring "$here\email.php" $mirror "$App\penumbra_search.php" "$here\fixture.json"
try { [IO.File]::Delete($mirror) } catch {}
$phpLine = ($phpOut | Where-Object { "$_".StartsWith('RESULTS_JSON:') } | Select-Object -First 1)
if (-not $phpLine) { throw "email.php did not finish: $(($phpOut | Select-Object -First 6) -join ' | ')" }
$ph = "$phpLine".Substring(13) | ConvertFrom-Json

Write-Host "[4/4] results"
$fx = $u8.GetString([IO.File]::ReadAllBytes("$here\fixture.json")) | ConvertFrom-Json
$results = New-Object System.Collections.ArrayList
foreach ($r in $js.results) { [void]$results.Add($r) }
foreach ($c in $fx.cases) {
  $got = ($ph.cases | Where-Object { $_.id -eq $c.id } | Select-Object -First 1).names
  [void]$results.Add([pscustomobject]@{ name = "M$($c.id) the email (runner): $($c.q)"; pass = ($got -ceq $c.names); detail = "want $($c.names), got $got" })
}
if ($js.fatal) { Write-Host "FATAL: $($js.fatal)" }
$fail = 0
foreach ($r in $results) {
  if ($r.pass) { Write-Host ("  PASS  " + $r.name) }
  else { $fail++; Write-Host ("  FAIL  " + $r.name); Write-Host ("        " + $r.detail) }
}
Write-Host ("{0} assertions, {1} failed" -f $results.Count, $fail)
if ($fail -gt 0 -or $js.fatal) { exit 1 }
