# =============================================================================
# CHAINLIVE SUITE (2026-11-04) - a snippet button never greys a big report's vis() charts
#
# The bug: chain()'s closing render, action(trigger)'s catch-all render, a grouping's data(group) re-render
# and a theme trigger's data(theme) re-render all called renderReportSnippet(null, true). The second
# argument is isLiveEdit (meant for typing in the snippet editor): with > 1000 rows and a vis() it set
# executionBlocked, which swaps every chart for a greyed <img title="Live updates paused. Click Apply...">.
# The fix passes false there (as the csw2 view pick and the vis % resize already did).
# Browser half only: harness.html (cardsnip's page) + driver.js against the REAL main.js, ?rows=1500.
#
#   run.ps1 -App <dir>          a stage tree (js\main.js)
#   run.ps1 -Control -App <dir> the pre-change tree: K1 / T1 must be RED, E1 GREEN
#   run.ps1 -Mutants -App <dir> every mutant, each against the checks it MUST turn red
#
# UNC NOTE: -File against a UNC path is GPO-blocked. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chainlive'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -App <dir>
# ONE suite run per PowerShell call, output to a FILE. Prints RESULT: GREEN/RED. Stages into %TEMP%.
# =============================================================================
param([string]$App = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep, [string]$Here = '', [int]$Rows = 1500)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\chainlive' }
$live = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
if (-not $App) { $App = $live }
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$srcMain = [IO.File]::ReadAllText("$App\js\main.js", $utf8)

# name = @{ edits = @(@(old, new), ...); red = check ids that MUST go red }
$mutantDefs = [ordered]@{
  'chainpause' = @{ edits = @(,@("renderReportSnippet(null, false);   // (chainlive) the chain's closing render", "renderReportSnippet(null, true);   // (chainlive) the chain's closing render")); red = @('K1') }
  'trigpause'  = @{ edits = @(,@("renderReportSnippet(null, false);   // (chainlive) a trigger's catch-all render", "renderReportSnippet(null, true);   // (chainlive) a trigger's catch-all render")); red = @('T1') }
  'grppause'   = @{ edits = @(,@("renderReportSnippet(null, false);   // (chainlive) a grouping is no editor", "renderReportSnippet(null, true);   // (chainlive) a grouping is no editor")); red = @('G1') }
  # the over-fix: the editor's own debounced render no longer pauses (E1 guards the intended pause)
  'editlive'   = @{ edits = @(@("        if (isLiveEdit && rowCount > 1000 && hasComplexFunctions) {", "        if (false && isLiveEdit && rowCount > 1000 && hasComplexFunctions) {"),
                              @("            if (isLiveEdit && rowCount > 1000 && (localConditionalRules.length > 0", "            if (false && isLiveEdit && rowCount > 1000 && (localConditionalRules.length > 0")); red = @('E1') }
}

function Apply-Edits([string]$text, $edits, [string]$name) {
  foreach ($e in $edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1: $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

function Invoke-Browser([string]$mainText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_cl_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  New-Item -ItemType Directory -Force "$run\js" | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js','codemirror.min.js','sql.min.js','show-hint.js',
            'foldcode.js','foldgutter.js','brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js','penumbra_cards.js')
  foreach ($f in $libs) { $p = "$App\js\$f"; if (-not (Test-Path $p)) { $p = "$live\js\$f" }; Copy-Item $p "$run\$f" -Force }
  # vis() lazy-loads the chart libraries + the chart module by relative path (js/...)
  foreach ($f in @('chart-4.5.1.min.js','chartjs-plugin-datalabels-2.0.0.min.js','chartjs-chart-treemap-3.1.0.min.js','chartjs-chart-sankey-0.19.1.min.js','penumbra_charts.js','penumbra_geo_us.js')) {
    $p = "$App\js\$f"; if (-not (Test-Path $p)) { $p = "$live\js\$f" }; Copy-Item $p "$run\js\$f" -Force
  }
  Copy-Item "$live\css\main.css" "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  Copy-Item "$here\harness.html" "$run\harness.html" -Force
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = 'try { window.__SM = {}; window.__SM.snipEd = function () { try { return snippetEditor; } catch (e) { return null; } }; window.__SM.render = renderReportSnippet; } catch (e) { window.__SM_ERR = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + "`r`n" + $hook + "`r`n" + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sm.js", $patched, $utf8)
  $prof = Join-Path $run 'profile'; $dom = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + "/harness.html?mode=chainlive&rows=$Rows"
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run','--no-default-browser-check',
                '--disable-sync','--disable-extensions','--window-size=1400,1000',"--user-data-dir=$prof",'--virtual-time-budget=180000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'err.txt') -ArgumentList $edgeArgs
  $pr.WaitForExit(300000) | Out-Null
  if (-not $pr.HasExited) { try { $pr.Kill() } catch {} }
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  $d = ''
  for ($t = 0; $t -lt 40; $t++) {
    try { $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite); $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close(); if ($d.Contains('</pre>')) { break } } catch {}
    Start-Sleep -Milliseconds 500
  }
  $out = @()
  $a = $d.IndexOf('<pre id="out">'); $b = if ($a -ge 0) { $d.IndexOf('</pre>', $a) } else { -1 }
  if ($a -lt 0 -or $b -lt 0) { $out += [pscustomobject]@{ name = "[$tag] page produced a result block"; pass = $false; detail = "no dump - see $run" } }
  else {
    $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
    if (-not $txt.StartsWith('RESULTS_JSON:')) { $out += [pscustomobject]@{ name = "[$tag] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(600, $txt.Length)) } }
    else {
      $parsed = $txt.Substring(13) | ConvertFrom-Json
      if ($parsed.fatal) { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.hookErr) { Write-Warning "[$tag] hook: $($parsed.hookErr)" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

if ($Mutants) {
  Write-Host "[mutants] app: $App"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $def = $mutantDefs[$name]
    $res = Invoke-Browser (Apply-Edits $srcMain $def.edits $name) $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($def.red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-11} turns {1} red   [red: {2}]" -f $name, ($def.red -join ' '), ($red -join ' ')) }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-11} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "app: $App$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: the pre-change tree, K1 / T1 must be RED)' })"
if ($Mutant) {
  if (-not $mutantDefs.Contains($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutantDefs.Keys) -join ', '))" }
  $srcMain = Apply-Edits $srcMain $mutantDefs[$Mutant].edits $Mutant
}
$res = Invoke-Browser $srcMain 'run'
$p = 0; $f = 0; $failed = @()
foreach ($r in $res) {
  if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") }
  else { $f++; $failed += ($r.name -split ' ')[0]; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") }
}
Write-Host ("TOTAL pass={0} fail={1}   failed: {2}" -f $p, $f, ($failed -join ' '))
Write-Host $(if ($f -eq 0 -and $p -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
