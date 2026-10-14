# =============================================================================
# SAVE-LAYOUT SUITE (2026-09-24)
#
# A report save must never drop the report's column layout (STATE_DATA
# visibleColumns / columnOrder). buildStateObject() reads the layout from the
# flat #tableHeader, but every run empties that header before it asks the server
# and only a run that RETURNS ROWS builds it again - so a save made while the run
# had failed (dirsearch, audit 29665: saved 12 s after a query.php 500), came
# back with 0 rows, or was still in flight wrote no layout at all. The fix keeps
# the report's STORED layout (_pnbStoredLayout: seeded at boot, replaced by every
# save, dropped by clear-all) and writes it when there is no header to read.
#
#   browser half only: the REAL js\main.js (ready closure unwrapped, window.__SL
#   export hook) through the REAL run path and the REAL Save dialog handlers, in
#   three pages - see driver.js:
#     report    F A P Z E I O S L X   (a report with hidden + reordered columns)
#     bootfail  B                      (the report's FIRST run fails)
#     adhoc     N                      (no report loaded)
#
#   run.ps1                     live js\main.js          EXPECTED: report 24/0, bootfail 3/0, adhoc 5/0
#                                                        (TOTAL 32/0, RESULT: GREEN)
#   run.ps1 -Control            the pre-fix build        EXPECTED: TOTAL 21/11, RED on exactly the 11 carry
#                               (js\main.js.bak-*-savelayout, made by the deploy)   asserts A1 A2 P1 Z1 E1
#                               I1 O2 S2 L2 B1 B2; every fixture/control assert stays green.
#   Measured 2026-09-24 on the stage: 32/0; control 21/11 (exactly those 11); mutants 7/7 bite -
#   nocarry = those 11, noseed = the 9 before any in-page save, noremember S2, nolocal L2,
#   noforget X1, always O1 S1 (+S0 S2 L0 L1 L2), alias P1 (+Z1 E1 I1 O2: the leak reaches later saves).
#   run.ps1 -MainJs <p>         any other copy (a stage build)
#   run.ps1 -Mutant <name>      ONE edit of main.js put back/broken, on the fixed build
#   run.ps1 -Mutants            every mutant in turn, each checked against the asserts it MUST
#                               turn red (only the pages those asserts live in are run)
#   -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\savelayout'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\savelayout' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control -and -not $MainJs) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $bm = Get-BakItem "$js\main.js.bak-*-savelayout" | Select-Object -Last 1
  if (-not $bm) { throw '-Control needs js\main.js.bak-*-savelayout (made by the deploy), or pass -MainJs <pre-fix copy>' }
  $MainJs = $bm.FullName
}
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not (Test-Path $MainJs)) { throw "file under test not found: $MainJs" }
$src0 = [IO.File]::ReadAllText($MainJs, $utf8)
$NL = "`r`n"

# --- mutants -------------------------------------------------------------------
# name = @{ edits = @(@(old, new), ...); red = assert ids that MUST go red }
# Every anchor must be found exactly once (the FIXED build is required).
$carryIf = '        if (columnOrder.length === 0 && _pnbStoredLayout) {'
$mutantDefs = [ordered]@{
  'nocarry'    = @{ edits = @(,@($carryIf, '        if (false) {')); red = @('A1','A2','P1','Z1','E1','I1','O2','S2','L2','B1','B2') }
  'noseed'     = @{ edits = @(,@("                _pnbStoredLayout = _pnbLayoutOf(decodedState);", '')); red = @('A1','A2','P1','Z1','E1','I1','O2','B1','B2') }
  'noremember' = @{ edits = @(,@("            _pnbStoredLayout = _pnbLayoutOf(stateObject);", '')); red = @('S2') }
  'nolocal'    = @{ edits = @(,@("            _pnbStoredLayout = savedLayout;", '')); red = @('L2') }
  'noforget'   = @{ edits = @(,@("        // ...and its stored column layout, which says nothing about this table.$NL        _pnbStoredLayout = null;", '')); red = @('X1') }
  'always'     = @{ edits = @(,@($carryIf, '        if (_pnbStoredLayout) {')); red = @('O1','S1') }
  'alias'      = @{ edits = @(,@("_pnbStoredLayout.visibleColumns ? _pnbStoredLayout.visibleColumns.slice() : undefined;$NL            state.columnOrder = _pnbStoredLayout.columnOrder ? _pnbStoredLayout.columnOrder.slice() : undefined;",
                                  "_pnbStoredLayout.visibleColumns;$NL            state.columnOrder = _pnbStoredLayout.columnOrder;")); red = @('P1') }
}

function Apply-Mutant([string]$text, [string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIXED build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}
function Mode-Of([string]$id) { if ($id.StartsWith('B')) { 'bootfail' } elseif ($id.StartsWith('N')) { 'adhoc' } else { 'report' } }

# --- one browser run -------------------------------------------------------------
function Invoke-Browser([string]$mainText, [string]$mode, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_sl_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  Copy-Item "$app\css\main.css" "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  Copy-Item "$here\harness.html" "$run\harness.html" -Force

  # closure exports, by NAME through eval so a function an older build lacks
  # costs only its own entry
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SL = { getEditor: function () { return editor; } }; } catch (e) { window.__SL_ERR = String(e); }',
    'try { var _slF = { buildState: "buildStateObject", clearAll: "performClearAllAction", decompress: "decompressString" }; } catch (e) {}',
    'try { Object.keys(_slF).forEach(function (k) { try { window.__SL[k] = eval(_slF[k]); } catch (e) { (window.__SL_MISSING = window.__SL_MISSING || []).push(_slF[k]); } }); } catch (e) { window.__SL_ERR2 = String(e); }'
  ) -join $NL
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sl.js", $patched, $utf8)

  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html?mode=' + $mode
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=90000','--dump-dom', $url)
  $pr = Start-Process -FilePath $edge -PassThru -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $run 'err.txt') -ArgumentList $edgeArgs
  $pr.WaitForExit(300000) | Out-Null
  if (-not $pr.HasExited) { try { $pr.Kill() } catch {} }
  Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like "*$prof*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  $d = ''
  for ($t = 0; $t -lt 40; $t++) {
    try {
      $fs = New-Object IO.FileStream($dom, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
      $sr = New-Object IO.StreamReader($fs); $d = $sr.ReadToEnd(); $sr.Close()
      if ($d.Contains('</pre>')) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  $out = @()
  $a = $d.IndexOf('<pre id="out">'); $b = if ($a -ge 0) { $d.IndexOf('</pre>', $a) } else { -1 }
  if ($a -lt 0 -or $b -lt 0) { $out += [pscustomobject]@{ name = "[$tag] page produced a result block"; pass = $false; detail = "no dump ($($d.Length) bytes) - see $run" } }
  else {
    $txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($a + 14, $b - $a - 14))
    if (-not $txt.StartsWith('RESULTS_JSON:')) { $out += [pscustomobject]@{ name = "[$tag] harness finished"; pass = $false; detail = $txt.Substring(0, [Math]::Min(400, $txt.Length)) } }
    else {
      $parsed = $txt.Substring(13) | ConvertFrom-Json
      if ($parsed.fatal)   { $out += [pscustomobject]@{ name = "[$tag] driver ran to the end"; pass = $false; detail = [string]$parsed.fatal } }
      if ($parsed.hookErr) { Write-Warning "[$tag] hook: $($parsed.hookErr)" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $text = Apply-Mutant $src0 $name
    $modes = @($mutantDefs[$name].red | ForEach-Object { Mode-Of $_ } | Select-Object -Unique)
    $red = @()
    foreach ($m in $modes) {
      # Assign first: Invoke-Browser returns ,$out, and piping the CALL hands the
      # pipeline that whole array as ONE object (every mutant then read "no reds").
      $res = Invoke-Browser $text $m "$name/$m"
      $red += @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    }
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-11} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-11} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "main.js: $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: the pre-fix build must be RED on the carry asserts)' })"
$text = if ($Mutant) { Apply-Mutant $src0 $Mutant } else { $src0 }
$tPass = 0; $tFail = 0; $failed = @()
foreach ($m in @('report', 'bootfail', 'adhoc')) {
  $res = Invoke-Browser $text $m $m
  $p = 0; $f = 0
  foreach ($r in $res) {
    if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $f++; $failed += ($r.name -split ' ')[0]; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
  Write-Host ("SUMMARY {0} pass={1} fail={2}" -f $m, $p, $f)
  $tPass += $p; $tFail += $f
}
Write-Host ("TOTAL pass={0} fail={1}   failed: {2}" -f $tPass, $tFail, ($failed -join ' '))
Write-Host $(if ($tFail -eq 0 -and $tPass -gt 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
