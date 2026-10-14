# =============================================================================
# STATUS-BAR KEYS SUITE (2026-10-01)
#
# The footer status bar's keyboard contract, on the REAL main.js + main.css with
# the bar's Data, query-time and Cols segments LIFTED from the index.php under
# test (the profile segment is server-rendered PHP: harness.html carries a stub
# with its structure, the admin-tools split menu included).
#
#   Enter / Space  the Column & Settings panel opens from its two openers only
#                  (the Cols count, the gear); a chip or a control inside a card
#                  keeps its keys. Until 2026-10-01 the segment's keydown handler
#                  took every key it did not have on a skip list: Enter on "Save
#                  my customizations..." opened the panel and never saved, Enter
#                  on the custom-layout chip opened its card AND the panel, the
#                  snapshot chip had no keys at all.
#   Escape         closes the open card - all nine: Data, query time, profile,
#                  and the frozen / pivot / grouping / custom-layout / snapshot /
#                  as-of cards - hands focus back to its trigger and goes no
#                  further. main.js's Escape chain eats the key at document
#                  capture, so the bar's listener is on WINDOW, capture phase;
#                  until 2026-10-01 only the frozen card had one.
#
#   browser half  driver.js under --dump-dom: phases E (Enter / Space) and X (Escape)
#                 with synthetic keys - what nothing above a control may do to its key.
#   real half     real_keys.py over CDP: REAL key presses (Input.dispatchKeyEvent),
#                 which is what shows a button's own click really fires.
#
#   run.ps1                      live files     EXPECTED: browser 22 / 0, real 10 / 0
#   run.ps1 -MainJs <p> [-IndexPhp <p>] [-MainCss <p>]    other copies (a stage build)
#   CONTROL: -MainJs js\main.js.bak-20261001-sbkeys (the build before the fix) = browser 7 / 15,
#                                real 2 / 8 - only S1 E1 E6 X4 X11 X14 Z1 and R6 R10 pass: the
#                                panel openers, the frozen card's own Escape and the guards.
#   run.ps1 -Mutant <name>       ONE line of main.js put back/broken
#   run.ps1 -Mutants             every mutant in turn, each checked against the asserts it
#                                MUST turn red. A mutant that stays green = asserts that do
#                                not bite.
#   -SkipReal / -SkipBrowser     one half only;  -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sbkeys'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%\pnb_sbk_*; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$SkipReal, [switch]$SkipBrowser, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\sbkeys' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not $MainJs)   { $MainJs   = "$js\main.js" }
if (-not $MainCss)  { $MainCss  = "$app\css\main.css" }
if (-not $IndexPhp) { $IndexPhp = "$app\index.php" }
foreach ($p in @($MainJs, $MainCss, $IndexPhp)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$src0 = [IO.File]::ReadAllText($MainJs, $utf8)
$NL = "`r`n"

# --- mutants -----------------------------------------------------------------
# Entry: name = @{ edits = @( @(old, new), ... ); red = the assert ids that MUST go red }.
# Every anchor must be found exactly once (the FIXED build is required).
# Single-quoted: these anchors hold jQuery's $( - a double-quoted string would expand it.
# PARENTHESIZE every side built with + : PowerShell's comma binds tighter than +, so
# 'a' + $NL + 'b', 'c' is 'a' + $NL + ('b', 'c') - one mangled string, not a pair.
$mutantDefs = [ordered]@{
  # Enter / Space
  'wl'        = @{ edits = @(,@(('            if (!$(e.target).closest(''#sbColsOpen, .sb-cols-gear-wrap'').length) return;' + $NL), '')); red = @('E2','R1','R2','R3','R4') }
  'wlgear'    = @{ edits = @(,@('closest(''#sbColsOpen, .sb-cols-gear-wrap'').length) return;', 'closest(''#sbColsOpen'').length) return;')); red = @('E1') }
  'ccstop'    = @{ edits = @(,@(('        $(''#sbCustomCols'').on(''keydown'', function (e) {' + $NL + '            if (e.which === 13 || e.which === 32) { e.preventDefault(); e.stopPropagation(); $(this).trigger(''click''); }'),
                                 ('        $(''#sbCustomCols'').on(''keydown'', function (e) {' + $NL + '            if (e.which === 13 || e.which === 32) { e.preventDefault(); $(this).trigger(''click''); }'))); red = @('E3') }
  'thstop'    = @{ edits = @(,@(('        $(''#sbTableHidden'').on(''keydown'', function (e) {' + $NL + '            if (e.which === 13 || e.which === 32) { e.preventDefault(); e.stopPropagation(); $(this).trigger(''click''); }'),
                                 ('        $(''#sbTableHidden'').on(''keydown'', function (e) {' + $NL + '            if (e.which === 13 || e.which === 32) { e.preventDefault(); $(this).trigger(''click''); }'))); red = @('E4') }
  'snapkey'   = @{ edits = @(,@('    $(document).on(''keydown'', ''#sbSnapshot'', function (e) {', '    $(document).on(''keydown'', ''#sbSnapshotX'', function (e) {')); red = @('E5','R9') }
  # Escape
  'escdoc'    = @{ edits = @(,@(('        window.addEventListener(''keydown'', function (e) {' + $NL + '            if (e.key !== ''Escape'''), ('        document.addEventListener(''keydown'', function (e) {' + $NL + '            if (e.key !== ''Escape'''))); red = @('X1','X2','X3','X4','X5','X6','X7','X8','X9','X10','X13','R7','R8') }
  'escsegs'   = @{ edits = @(,@('            $(POP_SEGS).filter(''.sb-open'').each(function () {', '            $([]).each(function () {')); red = @('X1','X2','X3','X13','R8') }
  'escgrp'    = @{ edits = @(,@(('            [''sb-grp-open'', ''#sbGroup'', ''#sbGroupPop''],' + $NL), '')); red = @('X6') }
  'escfrz'    = @{ edits = @(,@(('            [''sb-frz-open'', ''#sbFrozen'', ''#sbFrozenPop''],' + $NL), '')); red = @('X4') }
  'escsnap'   = @{ edits = @(,@(('            $cols.removeClass(''sb-snap-open sb-asof-open'');' + $NL), '')); red = @('X8','X9') }
  # (Not X1 / X2: the Data and query-time popovers hold nothing focusable, so focus
  # in them is always on the segment - their trigger - and stays there anyway.)
  'escfocus'  = @{ edits = @(,@('                if (open[i].inside && open[i].trigger) { $(open[i].trigger).trigger(''focus''); break; }', '')); red = @('X3','X4','X5','X6','X7','X8','X9','X13','R7') }
  'escmod'    = @{ edits = @(,@(('            if (e.key !== ''Escape'' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;' + $NL + '            // The popped-out console'), ('            if (e.key !== ''Escape'') return;' + $NL + '            // The popped-out console'))); red = @('X12') }
  'escreplay' = @{ edits = @(,@(('            if (e.target === document) return;' + $NL), '')); red = @('X14') }
  'escmenu'   = @{ edits = @(,@(('            if (menu) {' + $NL + '                var caret'), ('            if (false) {' + $NL + '                var caret'))); red = @('X13') }
}

function Apply-Mutant([string]$text, [string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  foreach ($e in $mutantDefs[$name].edits) {
    if (@($e).Count -ne 2 -or -not ($e[0] -is [string]) -or -not ($e[1] -is [string])) { throw "mutant '$name': an edit is not an (old, new) pair of strings - parenthesize each side built with +" }
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FIXED build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- one staged page -----------------------------------------------------------
function New-Run([string]$mainText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_sbk_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js','penumbra_a11y.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  Copy-Item $MainCss "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  # The bar's segments as the page ships them: the lead (row count), Data, query
  # time and Cols - every chip and card - from the index.php UNDER TEST. Its
  # <?php /* */ ?> comments are dropped; any other PHP is an error.
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $sm = [regex]::Match($idx, '(?s)<div class="sb-seg sb-lead">.*?(?=\s*<div class="sb-spring">)')
  if (-not $sm.Success -or -not $sm.Value.Contains('id="sbColsSeg"') -or -not $sm.Value.Contains('id="sbDataSeg"')) { throw 'the status bar segments were not found in the index.php under test' }
  $seg = [regex]::Replace($sm.Value, '(?s)<\?php\s*/\*.*?\*/\s*\?>', '')
  if ($seg.Contains('<?')) { throw 'the lifted status bar segments hold PHP beyond comments - the harness cannot lift them verbatim' }
  $harness = [regex]::Replace($harness, '(?s)<!-- BAR_SEGMENTS:.*?<!-- /BAR_SEGMENTS -->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $seg })
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure exports
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SBK = {',
    '  setName: function (v) { currentLoadedStateName = v; }, getName: function () { return currentLoadedStateName; },',
    '  getEditor: function () { return editor; }',
    '}; } catch (e) { window.__SBK_ERR = String(e); }'
  ) -join $NL
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sbk.js", $patched, $utf8)
  return $run
}

function Remove-Run([string]$run) {
  # A recursive delete only ever goes to a run dir this script made.
  if ((Split-Path $run -Leaf) -notlike 'pnb_sbk_*' -or (Split-Path $run -Parent) -ne $env:TEMP.TrimEnd('\')) { throw "refusing to delete '$run'" }
  if ($Keep) { Write-Host "kept: $run"; return }
  try { [IO.Directory]::Delete($run, $true) } catch {}
}

# --- the browser half (--dump-dom) -----------------------------------------------
function Invoke-Dump([string]$run, [string]$tag) {
  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html'
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                "--user-data-dir=$prof",'--virtual-time-budget=60000','--dump-dom', $url)
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
  return ,$out
}

# --- the real half (CDP) -----------------------------------------------------------
function Invoke-Real([string]$run, [string]$tag) {
  $outFile = Join-Path $run 'real.txt'
  $pp = Start-Process -FilePath 'py' -PassThru -NoNewWindow -Wait -WorkingDirectory $here -RedirectStandardOutput $outFile -RedirectStandardError (Join-Path $run 'real_err.txt') `
        -ArgumentList @('-3', 'real_keys.py', '--dir', $run, '--json')
  $out = @()
  $txt = if (Test-Path $outFile) { [IO.File]::ReadAllText($outFile) } else { '' }
  $m = [regex]::Match($txt, 'REAL_JSON:(.*)')
  if (-not $m.Success) { $out += [pscustomobject]@{ name = "[$tag] real_keys.py reported"; pass = $false; detail = ($txt + ' ' + [IO.File]::ReadAllText((Join-Path $run 'real_err.txt'))).Trim().Substring(0, [Math]::Min(500, ($txt.Length))) } ; return ,$out }
  foreach ($r in ($m.Groups[1].Value | ConvertFrom-Json)) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
  return ,$out
}

function Show-Results($res, [string]$label) {
  $p = 0; $f = 0
  foreach ($r in $res) {
    if ($r.pass) { $p++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $f++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
  Write-Host ("SUMMARY {0} pass={1} fail={2}" -f $label, $p, $f)
  return @($p, $f)
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $run = New-Run (Apply-Mutant $src0 $name) $name
    $res = Invoke-Dump $run $name
    # Assign first: @(Invoke-Real ...) would nest its result array as ONE element,
    # whose failures then never show (an array's .pass is never -not'ed to true).
    if (@($mutantDefs[$name].red | Where-Object { $_ -like 'R*' }).Count) { $real = Invoke-Real $run $name; $res = @($res) + @($real) }
    Remove-Run $run
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-10} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-10} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "main.js:   $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
Write-Host "main.css:  $MainCss"
Write-Host "index.php: $IndexPhp"
$text = if ($Mutant) { Apply-Mutant $src0 $Mutant } else { $src0 }
$run = New-Run $text 'browser'
$green = $true
try {
  if (-not $SkipBrowser) {
    Write-Host '[1/2] browser half (synthetic keys, --dump-dom)'
    $c = Show-Results (Invoke-Dump $run 'browser') 'browser'
    if ($c[1] -ne 0 -or $c[0] -eq 0) { $green = $false }
  }
  if (-not $SkipReal) {
    Write-Host '[2/2] real half (real key presses over CDP)'
    $c = Show-Results (Invoke-Real $run 'real') 'real'
    if ($c[1] -ne 0 -or $c[0] -eq 0) { $green = $false }
  }
} finally { Remove-Run $run }
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
