# =============================================================================
# SWITCH MOTION SUITE (2026-09-24)
#
# A layout_switch / toggle_switch click moves the control AT ONCE (a pending
# position the sync passes honour until the page is quiet, then the live view is
# read again), the load it starts veils the DATA only (showLoading's scoped mode;
# the overlay itself still shields the whole page), a click or arrow key during
# the change is dropped, a re-render mid-slide RESUMES the slide, a pivot /
# group_by trigger no longer re-renders the snippet inside the click, and a
# clearing search step runs one search instead of two.
#
#   browser half only: the REAL js\main.js (ready closure unwrapped, window.__SM
#   export hook, runTableSearch rebound to a counter) + the REAL css\main.css,
#   through the REAL click handlers and group_by / pivot / flat / search paths:
#     switch   F M R B L P T H S K   (a report whose snippet reads data(group))
#     plain    N                     (a snippet that reads no view state)
#
#   run.ps1                      live js\main.js + css\main.css   EXPECTED: switch 39/0, plain 2/0,
#                                restore 9/0 (TOTAL 50/0, RESULT: GREEN - measured 2026-09-25)
#   V6 = a load that starts under the veil keeps it (a big sort's formatting pass).
#   restore (2026-09-25, 600 rows): Remove Grouping / Restore Transaction List / sorts
#   veil the data with no switch involved (showLoading opts.scoped); a dialog-style
#   grouping from a pivot stays full-screen throughout. Q = a DUE settle counts as done
#   at the next click; D = nothing settles a change before its command is sent.
#   The view change starts once the slide has played (_pnbAfterSlide), so every
#   check on the LOAD waits for it (driver loadStarted()); A1 asserts that wait.
#   run.ps1 -MainJs <p> -MainCss <p>   a stage build
#   run.ps1 -Control             the pre-fix build (js\main.js.bak-*-switchmotion, made
#                                by the deploy; or pass -MainJs/-MainCss) - must be RED:
#                                measured 8/42 (fixtures + asserts that hold either way pass)
#   run.ps1 -Mutant <name>       ONE edit of the fixed main.js, see $mutantDefs
#   run.ps1 -Mutants             every mutant in turn, each checked against the asserts
#                                it MUST turn red (measured 2026-09-25: 20/20 bite)
#   Real frames: -Keep, then py -3 cdp_demo.py <kept dir> <out> 6000 1 switch (see README).
#   -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\switchmotion'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# ONE suite run per PowerShell call, output to a FILE (the console truncates).
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\switchmotion' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control -and -not $MainJs) {
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  $bm = Get-BakItem "$js\main.js.bak-*-switchmotion" | Select-Object -Last 1
  $bc = Get-BakItem "$app\css\main.css.bak-*-switchmotion" | Select-Object -Last 1
  if (-not $bm -or -not $bc) { throw '-Control needs js\main.js.bak-*-switchmotion + css\main.css.bak-*-switchmotion (made by the deploy), or pass -MainJs/-MainCss <pre-fix copies>' }
  $MainJs = $bm.FullName; $MainCss = $bc.FullName
}
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $MainCss) { $MainCss = "$app\css\main.css" }
foreach ($p in @($MainJs, $MainCss)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }
$src0 = [IO.File]::ReadAllText($MainJs, $utf8)
$NL = "`r`n"

# --- mutants -------------------------------------------------------------------
# name = @{ edits = @(@(old, new), ...); red = assert ids that MUST go red }
# Every anchor must be found exactly once (the FIXED build is required).
$mutantDefs = [ordered]@{
  # the grouping starts inside the click again, mid-slide (freezing the main-thread label colours)
  'noafterslide' = @{ edits = @(,@("        move();$NL        _pnbAfterSlide(function () { executeChainStep(trig); });", "        move();$NL        executeChainStep(trig);")); red = @('A1') }
  # the sync passes ignore the pending position: the click paints the OLD view
  'nopending'  = @{ edits = @(,@('            if (m) { _pnbMotionPaint(sw, m, paint); return; }', '            if (false) { _pnbMotionPaint(sw, m, paint); return; }')); red = @('M1','B1','P1') }
  # a replacement node lands at the end instead of resuming the slide
  'noresume'   = @{ edits = @(,@('        var resume = m.from >= 0 && spent < dur;', '        var resume = false;')); red = @('R1') }
  # the switch click is no longer dropped mid-change
  'noguard'    = @{ edits = @(,@("        e.preventDefault();$NL        if (_pnbMotionBusy()) { _pnbBusyNotice(); return; }$NL        // WCAG 2.4.3: the re-render replaces this node", "        e.preventDefault();$NL        // WCAG 2.4.3: the re-render replaces this node")); red = @('M5','M6') }
  # the arrow keys are no longer dropped mid-change (focus walks away from the thumb)
  'nokeyguard' = @{ edits = @(,@("        if (_pnbMotionBusy()) { _pnbBusyNotice(); return; }$NL        var `$sw = `$(this).closest('.pnb-layout-switch');", "        var `$sw = `$(this).closest('.pnb-layout-switch');")); red = @('M5') }
  # (2026-10-15) a dropped press is silent again / the end of a load is silent again
  'nobusysay'  = @{ edits = @(,@("        _pnbStatusWrite('Still loading. Try again in a moment.');", '')); red = @('M5b') }
  'noloadedsay' = @{ edits = @(,@("        if (_pnbWasLoading) _pnbLoadSay('Loaded', 300);", '')); red = @('M6b') }
  # every load is full screen again
  'noscope'    = @{ edits = @(,@('            _pnbLoadingScope(_pnbWantScope);', '            _pnbLoadingScope(false);')); red = @('M4','F2','P2','T2','V1','V6') }
  # only switch-driven loads are scoped: Remove Grouping / Restore / sorts go full screen again
  'noscopedopt' = @{ edits = @(,@("                _pnbWantScope = (opts && typeof opts.scoped === 'boolean') ? opts.scoped", "                _pnbWantScope = (opts && typeof opts.scoped === 'boolean') ? false")); red = @('V1','V2','V4','V5') }
  # a load that starts under the veil (a big sort's formatting pass) flips it to the full screen
  'noinherit'  = @{ edits = @(,@("                    : (`$('#loadingOverlay').is(':visible') && `$('#loadingOverlay').hasClass('pnb-lo-scoped'));", '                    : false;')); red = @('V6') }
  # the exit that starts a dialog grouping is scoped too: the one change flips veil -> full screen
  'chainscope' = @{ edits = @(,@('{ scoped: typeof onComplete !== ''function'' }', '{ scoped: true }')); red = @('V3') }
  # a load ending never schedules the settle
  'nosettle'   = @{ edits = @(,@('        if (_pnbMotion) _pnbMotionArm(_PNB_MOTION_QUIET_MS);', '        if (false) _pnbMotionArm(_PNB_MOTION_QUIET_MS);')); red = @('M7') }
  # the settle forgets to read the live view again: a refused step stays put
  'noslideback' = @{ edits = @(,@("            this.style.removeProperty('--pnb-motion-delay');$NL        });$NL        penumbraSyncActiveLayout();", "            this.style.removeProperty('--pnb-motion-delay');$NL        });")); red = @('B2') }
  # the catch-all post-trigger render runs for pivot / group_by again
  'catchall'   = @{ edits = @(,@('_skipPostRender = _isAsyncStep && /^(pivot|create_pivot|group_by|group)$/.test(cmd);', '_skipPostRender = false;')); red = @('M3','P1','N1') }
  # a clearing search step searches twice again
  'doublesearch' = @{ edits = @(,@("            previousSearchValue = '';$NL            `$('#tableSearch').val(searchTerm).trigger('input');", "            `$('#tableSearch').val(searchTerm).trigger('input');")); red = @('T5') }
  # a theme change is scoped too
  'themescope' = @{ edits = @(,@('            scoped: !(cmds || []).some(function (c) { return /^\s*theme\s*(\||$)/i.test(String(c)); }),', '            scoped: true,')); red = @('H1') }
  # a leaked motion wedges the controls
  'noleak'     = @{ edits = @(,@('        if (m && (!m.timer || _pnbMotionNow() >= m.dueAt)) _pnbMotionSettle();', '')); red = @('K1','Q1') }
  # a settle before the command is even sent: a stray hideLoading() in the slide drops the click
  'nodispatch' = @{ edits = @(,@('        if (!m.dispatched && _pnbMotionNow() - m.t0 < 2000) { _pnbMotionArm(_PNB_MOTION_QUIET_MS); return; }', '')); red = @('D1') }
  # a DUE settle still waits for its timer: a click right after the view lands is dropped
  'nodue'      = @{ edits = @(,@('        if (m && (!m.timer || _pnbMotionNow() >= m.dueAt)) _pnbMotionSettle();', '        if (m && !m.timer) _pnbMotionSettle();')); red = @('Q1') }
  # split layout takes the results header in (veiling the pane the control is in)
  'splithdr'   = @{ edits = @(,@("        if (rh && rh.getClientRects().length && !`$('#pnbSplitStage').hasClass('is-split')) {", '        if (rh && rh.getClientRects().length) {')); red = @('S2') }
  # a sliver of the data on screen and it still scopes (a spinner with no room)
  'nominbox'   = @{ edits = @(,@('        if (bottom - top < _PNB_SCOPE_MIN_H || right - left < _PNB_SCOPE_MIN_W) return null;', '')); red = @('S3') }
  # the veil stops at the data region's own bottom: a short grouped view falls back to full screen
  'databottom' = @{ edits = @(,@('        var top = r.top, left = r.left, right = r.right, bottom = Infinity;', '        var top = r.top, left = r.left, right = r.right, bottom = r.bottom;')); red = @('F2') }
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
function Mode-Of([string]$id) { if ($id.StartsWith('N')) { 'plain' } elseif ($id.StartsWith('V')) { 'restore' } else { 'switch' } }

# --- one browser run -------------------------------------------------------------
function Invoke-Browser([string]$mainText, [string]$mode, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_sm_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  Copy-Item $MainCss "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force
  Copy-Item "$here\harness.html" "$run\harness.html" -Force

  # closure exports, by NAME through eval so a function an older build lacks
  # costs only its own entry; runTableSearch is REBOUND inside the closure so
  # every internal call is counted (function declarations are mutable bindings).
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__SM = { motion: function () { return typeof _pnbMotion === "undefined" ? undefined : _pnbMotion; }, groupCol: function () { return currentGroupingColumn; } }; } catch (e) { window.__SM_ERR = String(e); }',
    'try { var _smF = { render: "renderReportSnippet", sync: "penumbraSyncActiveLayout", show: "showLoading", hide: "hideLoading", scopeBox: "_pnbLoadingScopeBox" }; } catch (e) {}',
    'try { Object.keys(_smF).forEach(function (k) { try { window.__SM[k] = eval(_smF[k]); } catch (e) { (window.__SM_MISSING = window.__SM_MISSING || []).push(_smF[k]); } }); } catch (e) { window.__SM_ERR2 = String(e); }',
    'try { var __smRts = runTableSearch; runTableSearch = function () { window.__SM_RTS = (window.__SM_RTS || 0) + 1; return __smRts.apply(this, arguments); }; } catch (e) { window.__SM_ERR2 = String(e); }',
    'try { var __smNow = _pnbMotionNow; _pnbMotionNow = function () { return __smNow() + (window.__SM_SKEW || 0); }; } catch (e) { /* a build without the motion clock */ }'
  ) -join $NL
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_sm.js", $patched, $utf8)

  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html?mode=' + $mode
  # --force-prefers-no-reduced-motion: this workstation has the OS "show
  # animations" setting OFF, and the CSS media query follows the HOST - without
  # it every transition is `none` and the slide asserts pass vacuously.
  $edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--no-first-run',
                '--no-default-browser-check','--disable-sync','--disable-extensions','--window-size=1400,1000',
                '--force-prefers-no-reduced-motion',
                "--user-data-dir=$prof",'--virtual-time-budget=120000','--dump-dom', $url)
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
      if ($parsed.hostReduced) { Write-Warning "[$tag] this host has reduced motion ON: CSS transitions are off, the slide asserts pass vacuously" }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs   main.css: $MainCss"
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
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

Write-Host "main.js: $MainJs   main.css: $MainCss$(if ($Mutant) { "   + MUTANT $Mutant" })$(if ($Control) { '   (CONTROL: the pre-fix build must be RED)' })"
$text = if ($Mutant) { Apply-Mutant $src0 $Mutant } else { $src0 }
$tPass = 0; $tFail = 0; $failed = @()
foreach ($m in @('switch', 'plain', 'restore')) {
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
