# =============================================================================
# FLAT-TABLE FROZEN COLUMNS SUITE (2026-09-18)
#
# The Settings panel's Freeze control keeps the first N visible columns of the
# FLAT table in view while it scrolls sideways (N = 1..5; a visible '#' counts as
# one of them), freezes the same columns in the XLSX download, and - saved with
# the report as STATE_DATA.frozenCols - in the scheduled XLSX too.
#
#   browser half  the REAL js\main.js (ready closure unwrapped, window.__FF export
#                 hook) against the REAL css\main.css, with the Freeze markup LIFTED
#                 from the index.php under test. Phases U G K P S X C - see driver.js.
#   runner half   test_flatfreeze.php: the real generate_xlsx_string(), lifted out of
#                 schedule_runner.php by pivotparity\extract_mirror.php (the runner is
#                 never require()d - it opens Oracle and sends mail). Its six mutants
#                 always run.
#   Phase K is the SAME case table in both halves: data columns frozen on screen ==
#   the sheet's xSplit. Change a row in one file, change it in the other.
#
#   run.ps1                      live files             EXPECTED: browser 88 / 0, runner PASS 38 FAIL 0
#                                (2026-10-01 bdown: + phase D, 12 asserts - breakdown tables. CONTROL: the
#                                index.php before it with this main.js = 87 / 1, exactly D10 - the notice
#                                under the heading; the main.js before it stops at D0, no breakdown API.
#                                9 more mutants, bdnosync .. bdpad, all bite. frames_check F7 too.)
#   run.ps1 -Control             the pre-feature .baks  EXPECTED: browser 3 / 3 (the fixture and control
#                                asserts G0 G0b G1 pass; U1 U2 G2 fail and the later phases never start),
#                                runner PASS 6 FAIL 26. Measured 2026-09-18, as were the first 19 mutants.
#                                (Those .baks were pruned by 2026-10-01; -Control now needs -MainJs etc.)
#
# PHASE B (2026-10-01) is the status bar's frozen-columns chip, #sbFrozen. The harness now LIFTS
# the whole Cols segment of the status bar from the index.php under test (siblings and all), and
# has #resultCount, so view changes reach the bar's refreshAll() the production way. Its controls,
# measured 2026-10-01 on the stage build: the build before the chip (main.js + index.php + css)
#   = browser 60 / 1 (B0: no chip in the markup); the chip's index.php + css with the main.js
#   before it = 60 / 16 (every B assert red). 13 chip mutants (chipnotify .. chipmark), all bite.
#   run.ps1 -MainJs <p> -MainCss <p> -IndexPhp <p> -Runner <p>   any other copies (a stage build)
#   run.ps1 -Mutant <name>       ONE line of main.js put back/broken, on the feature build
#   run.ps1 -Mutants             every mutant in turn, each checked against the asserts it MUST turn
#                                red (about 20 s apiece). A mutant that stays green = asserts that do
#                                not bite. Skips the runner half.
#   -SkipPhp / -SkipBrowser      one half only;  -Keep keeps the staging dir.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\flatfreeze'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
#
# NOT covered here (needs real frames, which --dump-dom never renders): that the
# ResizeObserver CALLBACK fires on a width change. The harness stubs RO and rAF;
# G15 proves what is observed and G16 proves the MutationObserver path end to end.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$Runner = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$Control, [switch]$SkipPhp, [switch]$SkipBrowser, [switch]$Keep)
$ErrorActionPreference = 'Stop'
# $PSScriptRoot is empty when the BODY is run as a scriptblock (see the UNC note).
$here = if ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\flatfreeze' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control) {
  # The files the deploy of this feature replaced (byte-identical to the pre-feature build).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  function LastBak($pattern) { Get-BakItem $pattern | Select-Object -Last 1 }
  $bm = LastBak "$js\main.js.bak-*-flatfreeze"; $bc = LastBak "$app\css\main.css.bak-*-flatfreeze"
  $bi = LastBak "$app\index.php.bak-*-flatfreeze"; $br = LastBak "$app\schedule_runner.php.bak-*-flatfreeze"
  if (-not $MainJs)   { if (-not $bm) { throw '-Control needs js\main.js.bak-*-flatfreeze (made by the deploy), or pass -MainJs' }; $MainJs = $bm.FullName }
  if (-not $MainCss)  { if ($bc) { $MainCss = $bc.FullName } }
  if (-not $IndexPhp) { if ($bi) { $IndexPhp = $bi.FullName } }
  if (-not $Runner)   { if ($br) { $Runner = $br.FullName } }
}
if (-not $MainJs)   { $MainJs   = "$js\main.js" }
if (-not $MainCss)  { $MainCss  = "$app\css\main.css" }
if (-not $IndexPhp) { $IndexPhp = "$app\index.php" }
if (-not $Runner)   { $Runner   = "$app\schedule_runner.php" }
foreach ($p in @($MainJs, $MainCss, $IndexPhp, $Runner)) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$src0 = [IO.File]::ReadAllText($MainJs, $utf8)
$NL = "`r`n"

# --- mutants -----------------------------------------------------------------
# Entry: name = @( @(old, new), ... ; then the assert ids that MUST go red )
# Every anchor must be found exactly once (the FEATURE build is required).
$mutantDefs = [ordered]@{
  'footidx'     = @{ edits = @(,@("var f = S + ' > tfoot > tr > td:nth-child(' + v + '):not([colspan])';", "var f = S + ' > tfoot > tr > td:nth-child(' + d + '):not([colspan])';")); red = @('U2','G10') }
  'nocolspan'   = @{ edits = @(,@("var b = S + ' > tbody > tr > td:nth-child(' + d + '):not([colspan])';", "var b = S + ' > tbody > tr > td:nth-child(' + d + ')';")); red = @('U2','G8') }
  'hiddenidx'   = @{ edits = @(,@("            if (ths[i].style.display === 'none') continue;$NL            out.push({ th: ths[i], idx: i + 1 });", "            out.push({ th: ths[i], idx: i + 1 });")); red = @('G9','G11') }
  'noclamp'     = @{ edits = @(,@("        if (visibleCount > 0 && n >= visibleCount) n = visibleCount - 1;", "")); red = @('U1','G12','K08','K10') }
  'nocap'       = @{ edits = @(,@("        if (n > PENUMBRA_FROZEN_COLS_MAX) n = PENUMBRA_FROZEN_COLS_MAX;", "")); red = @('U1','K19') }
  'noimportant' = @{ edits = @(,@("(1020 - i) + ' !important}');", "(1020 - i) + '}');")); red = @('U2','G4') }
  'nozebra'     = @{ edits = @(,@("        out.push(':where(' + zebra.join(',') + '){background-color:inherit}');", "")); red = @('U2','G5') }
  'nowhere'     = @{ edits = @(,@("out.push(':where(' + body.join(',') + '){background-color:var(--bg-surface,#fff)}');", "out.push(body.join(',') + '{background-color:var(--bg-surface,#fff)}');")); red = @('G6') }
  'nopad'       = @{ edits = @(,@("        if (total > 0) out.push('#results-wrapper{scroll-padding-left:' + Math.ceil(total) + 'px}');", "")); red = @('U2','G6b') }
  'scope'       = @{ edits = @(,@("var _FRZ_SCOPE = '#results-wrapper #resultsTable';", "var _FRZ_SCOPE = '#resultsTable';")); red = @('U2','G14') }
  'nopause'     = @{ edits = @(,@("if (!_frzPaused && total > room * _FRZ_PAUSE_AT) _frzPaused = true;", "if (false) _frzPaused = true;")); red = @('G13','S6') }
  'nomo'        = @{ edits = @(,@("            _frzMO.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });", "")); red = @('G16') }
  'nocarry'     = @{ edits = @(,@("        if (existing && typeof existing.frozen === 'number') savedData.frozen = existing.frozen;", "")); red = @('P2') }
  'nodiffer'    = @{ edits = @(,@("        if (n === reportFrozenCols) delete entry.frozen;$NL        else entry.frozen = n;", "        entry.frozen = n;")); red = @('P3','P5') }
  'nohydrate'   = @{ edits = @(,@("        userFrozenCols = (prefs && typeof prefs.frozen === 'number') ? prefs.frozen : null;", "")); red = @('P4') }
  'nostate'     = @{ edits = @(,@("        if (_frozenCols > 0) {", "        if (false) {")); red = @('P6') }
  'nonotes'     = @{ edits = @(,@("            if (!cols[i].th.classList.contains('journal-notes-col')) n++;", "            n++;")); red = @('X1') }
  'nopill'      = @{ edits = @(,@("            if (frozenDiff) {", "            if (false) {")); red = @('C1') }
  'nomarks'     = @{ edits = @(,@("        shown.slice(0, n).addClass('sp-col-frozen').last().addClass('sp-col-frozen-last');", "")); red = @('S2','S3','S4') }
  # --- the status bar's frozen-columns chip (phase B, 2026-10-01). Single-quoted:
  # these anchors hold jQuery's $( - a double-quoted PowerShell string would expand it.
  'chipnotify'  = @{ edits = @(,@(('        _spSyncFreezeControl();' + $NL + '        _frzNotify(cols);' + $NL + '    }'), ('        _spSyncFreezeControl();' + $NL + '    }'))); red = @('B1','B10') }
  'chipview'    = @{ edits = @(,@('            if ($(''body'').hasClass(''group-mode-active'')) return false;', '')); red = @('B9') }
  'chipgate'    = @{ edits = @(,@('            if (!penumbra_vars.isAdmin && window._penumbraHideColumns) return false;', '')); red = @('B9') }
  'chiprefresh' = @{ edits = @(,@(('            updateFrozenChip();' + $NL + '            _sbUpdateOverflow();'), '            _sbUpdateOverflow();')); red = @('B9') }
  'chiprestore' = @{ edits = @(,@('.toggle(!!_ccFrozenDiff())', '.toggle(false)')); red = @('B3','B6','B7') }
  'chipresting' = @{ edits = @(,@('            if (!cols || (!cols.length && !(reportFrozenCols > 0))) {', '            if (!cols || !cols.length) {')); red = @('B7') }
  'chipwriter'  = @{ edits = @(,@('            penumbraSetFrozenCols(parseInt($(this).attr(''data-n''), 10));', '            userFrozenCols = parseInt($(this).attr(''data-n''), 10);')); red = @('B4') }
  # chipkeys / chipesc re-anchored 2026-10-01 (sbkeys): the Cols segment's keys open the
  # panel from its two openers only, and every card's Escape is the bar's one listener.
  'chipkeys'    = @{ edits = @(,@(('            if (!$(e.target).closest(''#sbColsOpen, .sb-cols-gear-wrap'').length) return;' + $NL), '')); red = @('B11') }
  'chipesc'     = @{ edits = @(,@(('            [''sb-frz-open'', ''#sbFrozen'', ''#sbFrozenPop''],' + $NL), '')); red = @('B12') }
  'chipclose'   = @{ edits = @(,@('removeClass(''sb-cc-open sb-pp-open sb-grp-open sb-frz-open'')', 'removeClass(''sb-cc-open sb-pp-open sb-grp-open'')')); red = @('B8','B12','B13') }
  'chipfocus'   = @{ edits = @(,@('                    if (hadFocus) $(''#sbColsOpen'').trigger(''focus'');', '')); red = @('B8') }
  'chipothers'  = @{ edits = @(,@('            seg.removeClass(''sb-snap-open sb-asof-open'');', '')); red = @('B14') }
  'chipmark'    = @{ edits = @(,@('            penumbraMarkUserHiddenFor(''viewOptionColumns'', $chip);', '')); red = @('B15') }
  # --- breakdown tables (phase D, 2026-10-01).
  'bdnosync'    = @{ edits = @(,@(('        penumbraBreakdownFreezeSync();' + $NL + '        try { document.dispatchEvent(new CustomEvent(''penumbra:breakdown-opened'')); } catch (e) {}'), '        try { document.dispatchEvent(new CustomEvent(''penumbra:breakdown-opened'')); } catch (e) {}')); red = @('D1') }
  'bdhash'      = @{ edits = @(,@('        return data + 1;', '        return data;')); red = @('D1','D6','D7') }
  'bdlive'      = @{ edits = @(,@(('        // view the flat table is hidden and that pass stops before its end.' + $NL + '        _bdApply();'), '        // view the flat table is hidden and that pass stops before its end.')); red = @('D7') }
  'bdpause'     = @{ edits = @(,@('                if (!_bdPaused[id] && total > room * _FRZ_PAUSE_AT) _bdPaused[id] = true;', '                if (false) _bdPaused[id] = true;')); red = @('D8') }
  'bdscope'     = @{ edits = @(,@('        var tables = document.querySelectorAll(''table.pnb-breakdown'');', '        var tables = document.querySelectorAll(''table.infobox-drill-table'');')); red = @('D9') }
  'bdfill'      = @{ edits = @(,@('        out.push('':where('' + cells.join('','') + ''){background-color:var(--bg-surface,#fff)}'');', '')); red = @('D3') }
  'bdborders'   = @{ edits = @(,@('        out.push(S + ''{border-collapse:separate!important;border-spacing:0}'');', '')); red = @('D5') }
  'bdzhead'     = @{ edits = @(,@('            out.push(h + '','' + f + ''{z-index:'' + (20 - i) + ''}'');', '')); red = @('D2') }
  'bdpad'       = @{ edits = @(,@('            if (box) box.style.scrollPaddingLeft = on ? Math.ceil(total) + ''px'' : '''';', '')); red = @('D4') }
}

function Apply-Mutant([string]$text, [string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  foreach ($e in $mutantDefs[$name].edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  return $text
}

# --- one browser run ---------------------------------------------------------
function Invoke-Browser([string]$mainText, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_ff_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  Copy-Item $MainCss "$run\main.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  # The Freeze control's markup comes from the index.php UNDER TEST, so the
  # harness cannot drift from the page. A pre-feature index.php has no such
  # block: the placeholder stays a comment and phase S fails, as it should.
  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  # Since 2026-10-01 the lift starts at the Columns SECTION, so whatever index.php
  # puts above the heading (the pivot notice, phase D's D10) comes along in its
  # place; <?php /* */ ?> comments are dropped, any other PHP is an error.
  $m = [regex]::Match($idx, '(?s)<div class="sp-section sp-columns-section">.*?id="spFreezeHint"[^>]*>.*?</div>')
  if ($m.Success -and $m.Value.Contains('sp-columns-head sp-aligned')) {
    $blk = [regex]::Replace($m.Value, '(?s)<\?php\s*/\*.*?\*/\s*\?>', '')
    if ($blk.Contains('<?')) { throw 'the Freeze markup block contains PHP - the harness cannot lift it verbatim' }
    $harness = [regex]::Replace($harness, '(?s)<div class="sp-section sp-columns-section">\s*<!-- FREEZE_MARKUP:.*?-->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $blk })
  }
  # The status bar's Cols segment too (2026-10-01): the frozen-columns chip and
  # every sibling chip and card it shares the segment with, as the page ships
  # them. Its <?php /* */ ?> comments are dropped; any other PHP is an error. A
  # pre-chip index.php has no #sbFrozen in it, and phase B fails, as it should.
  $sm = [regex]::Match($idx, '(?s)<div class="sb-seg sb-opt" id="sbColsSeg">.*?(?=\s*<div class="sb-spring">)')
  if ($sm.Success) {
    $seg = [regex]::Replace($sm.Value, '(?s)<\?php\s*/\*.*?\*/\s*\?>', '')
    if ($seg.Contains('<?')) { throw 'the Cols segment holds PHP beyond comments - the harness cannot lift it verbatim' }
    $harness = [regex]::Replace($harness, '(?s)<!-- COLS_SEGMENT:.*?<!-- /COLS_SEGMENT -->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $seg })
  }
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure exports
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__FF = {',
    '  setName: function (v) { currentLoadedStateName = v; }, getName: function () { return currentLoadedStateName; },',
    '  getEditor: function () { return editor; }',
    '}; } catch (e) { window.__FF_ERR = String(e); }',
    'try { var _ffF = { hydrate: "hydrateUserColumnSummaries", saveColPrefs: "saveColumnPrefs", loadColPrefs: "loadColumnPrefs",',
    '  buildState: "buildStateObject", openSP: "openSettingsPanel", updateTotalRow: "updateTotalRow",',
    '  updateStickyHeaderOffset: "updateStickyHeaderOffset", chartDrill: "_showChartDrillBreakdown" }; } catch (e) {}'
  ) -join $NL
  # By NAME through eval, so a function an older build lacks costs only its own entry.
  $hook2 = 'try { Object.keys(_ffF).forEach(function (k) { try { window.__FF[k] = eval(_ffF[k]); } catch (e) { (window.__FF_MISSING = window.__FF_MISSING || []).push(_ffF[k]); } }); } catch (e) { window.__FF_ERR2 = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $hook2 + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_ff.js", $patched, $utf8)

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
  if (-not $Keep) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  return ,$out
}

$bPass = 0; $bFail = 0; $pOk = $true; $browserRan = $false

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs"
  $mOk = 0; $mBad = 0
  foreach ($name in $mutantDefs.Keys) {
    $res = Invoke-Browser (Apply-Mutant $src0 $name) $name
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

if (-not $SkipBrowser) {
  Write-Host "[1/2] browser half   main.js: $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
  Write-Host "                     main.css: $MainCss"
  Write-Host "                     index.php: $IndexPhp"
  $text = if ($Mutant) { Apply-Mutant $src0 $Mutant } else { $src0 }
  $res = Invoke-Browser $text 'browser'
  $browserRan = $true
  foreach ($r in $res) {
    if ($r.pass) { $bPass++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $bFail++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
  Write-Host ("SUMMARY browser pass={0} fail={1}" -f $bPass, $bFail)
}

if (-not $SkipPhp -and -not $Mutant) {
  Write-Host "[2/2] runner half    schedule_runner.php: $Runner"
  $ext = '//oitras.oit.ncsu.edu/d$/Utilities/PHP_8.2-p/ext'
  # NOT $args - that is an automatic variable in PowerShell.
  $phpArgs = @('-n', '-d', 'memory_limit=1024M', '-d', 'date.timezone=America/New_York', '-d', "extension_dir=$ext",
               '-d', 'extension=zip', '-d', 'extension=mbstring', (Join-Path $here 'test_flatfreeze.php'),
               ('--app=' + $app.Replace([char]92, [char]47)), ('--runner=' + $Runner.Replace([char]92, [char]47)))
  if ($Control) { $phpArgs += '--control' }
  & $php @phpArgs
  $pOk = ($LASTEXITCODE -eq 0)
}

$green = ((-not $browserRan) -or ($bFail -eq 0 -and $bPass -gt 0)) -and $pOk
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
