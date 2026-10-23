# =============================================================================
# COLUMN WIDTHS SUITE (2026-09-24; round 2 2026-09-30: the grouped view and a
# pivot's row labels; round 3 2026-10-01: a pivot's value column while it has one;
# round 4 2026-10-01: a one-row header's value columns, one width together;
# round 5 2026-10-01: a two-row header's groups and leaves)
#
# Drag a header's right edge (or +/-/0 on a focused header) to size a column;
# double-click the edge to fit it to its content - in the flat table, the grouped
# view (the SAME width, by column name), a pivot's row-label columns (PIVOT:<field>)
# and, while its header is one row, its value columns - one width together
# (PIVOT:=<field>), the Grand Total its own (PIVOT:TOTAL=<field>), never under
# their widest number; while it is two rows, each group (a year) and each leaf
# under it, like a flat table at two levels (PIVOT:=<field>@<group>.<leaf>, by
# position).
# js/penumbra_colwidths.js + css/penumbra_colwidths.css own the behaviour; main.js
# owns the STATE (STATE_DATA.columnWidths + penumbra_column_prefs[report].widths).
# index.php loads the module only while js/penumbra_colwidths.off is ABSENT - the
# rollback switch - and marks it data-views="off" while js/penumbra_colwidths_views.off
# is PRESENT (round 2's own switch: back to the flat table only).
#
#   browser half  the REAL js\main.js (ready closure unwrapped, window.__CWH export
#                 hook), the REAL module + its CSS and the REAL css\main.css and
#                 css\density.css (V3 runs at Compact), with the Freeze markup LIFTED
#                 from the index.php under test. Three page loads: phases
#                 U G D K P R C S V Q Y Z M (see driver.js), then ?colwidths=off for phase O,
#                 then ?colwidths=flat for phase W.
#   index half    the include block LIFTED from the index.php under test and run
#                 by real PHP in a scratch dir - both files present, the .off marker
#                 present, one file missing, the views marker present - plus php -l
#                 of index.php and help_content.php and the help entry.
#   real input    -Real also runs real_input.py: REAL mouse and keyboard events
#                 over CDP (the click that ends a drag must not sort - flat table,
#                 grouped view and pivot; a pivot's one value column stops at its widest
#                 number; one FY column's drag sizes all four; a two-row header's year
#                 and leaf drags; the pill's Reset reloads the page).
#
#   run.ps1                         live files      EXPECTED: browser 135 / 0, index 8 / 0 (-Real: real 18 / 0)
#                                   (2026-10-01 bdown: + phase E, 10 asserts, and W5 - breakdown tables,
#                                   session widths. The module before it stops at E0 (no breakdown API);
#                                   7 mutants drillstore .. drillevent, all bite.)
#                                   (2026-10-01 pvpill: + phase L, 7 asserts, and W4 - the custom-layout
#                                   pill reports a pivot's widths. CONTROL: the main.js before it under
#                                   this suite = browser 119 / 5, exactly L2-L6 red; L1, the grouped
#                                   view, already passed there - its widths are flat column names)
#                                   (round 4: browser 99 / 0, index 8 / 0, real 16 / 0;
#                                   round 3: browser 88 / 0, index 8 / 0, real 15 / 0;
#                                   round 2 alone: browser 75 / 0, index 8 / 0, real 14 / 0;
#                                   round 1 alone: browser 50 / 0, index 6 / 0, real 10 / 0)
#   run.ps1 -Control                the pre-feature build, no module: RED - browser 1 / 6 (the fixture
#                                   passes, U1-U3 G0b O1 W1 fail and the rest never start), index 2 / 2
#                                   (php -l passes; the include block and the help entry are missing).
#                                   The .baks are looked for in the webroot AND in
#                                   c:\inetpub\penumbra_debloat_*\ (the 09-29 de-bloat moved the
#                                   round-1 set there). Measured 2026-09-30.
#   round-1 build                   -MainJs/-IndexPhp/-HelpPhp/-ModuleJs/-ModuleCss = the
#                                   *.bak-<stamp>-colwidths2 files round 2's deploy leaves: RED -
#                                   browser 52 / 14 (every round-1 assert passes; U4, V1-V11, the Q
#                                   phase and W1 fail), index 7 / 1 (I6). Measured 2026-09-30 (before Y).
#   round-2 build                   the same with the *.bak-<stamp>-colwidths3 files round 3's deploy
#                                   leaves (index.php is not among them - pass the live one): RED -
#                                   browser 76 / 1 (every round-2 assert passes; the Y phase cannot
#                                   start: no value-column code), index 8 / 0. Measured 2026-10-01.
#   round-3 build                   the *.bak-<stamp>-colwidths4 files round 4's deploy leaves (module,
#                                   stylesheet, help; the live main.js and index.php): RED - browser
#                                   76 / 2 (only the Y and Z phases, which need round 4's API, cannot
#                                   start), index 8 / 0. Measured 2026-10-01.
#   round-4 build                   the *.bak-<stamp>-colwidths5 files round 5's deploy leaves (module,
#                                   stylesheet, main.js, help; the live index.php): RED - browser 99 / 1
#                                   (only the M phase, which needs round 5's grid, cannot start), index
#                                   8 / 0. Measured 2026-10-01.
#   mutants                         94 / 0 (2026-10-01; 16 are round 2's, 18 rounds 3-4's, 14 round 5's,
#                                   7 the pill's pivot report: pillpivot .. pillgt, 7 breakdowns). Two, noimportant and
#                                   nocolspan, are pinned by the rule text alone - both guards are
#                                   defensive, see their comments. gnonorm needs Compact density to
#                                   bite: at the default 9px cell padding Edge happens to keep the
#                                   set widths exact without the remainder rule.
#   run.ps1 -MainJs <p> -IndexPhp <p> -HelpPhp <p> -ModuleJs <p> -ModuleCss <p>   a stage build
#   run.ps1 -NoModule               main.js under test but no module files (the switched-off page)
#   run.ps1 -Mutant <name>          ONE line put back/broken, on the feature build
#   run.ps1 -Mutants                every mutant in turn, each checked against the asserts it MUST
#                                   turn red. A mutant that stays green = asserts that do not bite.
#   run.ps1 -Mutants -Only a,b,c    just those - the full 48 outlast a 10-minute tool call, so run
#                                   them in two halves (the names: -CheckMutants lists them)
#   run.ps1 -CheckMutants           every mutant's anchor is still in the files under test (no browser)
#   -Keep keeps the staging dir;  -Here <dir> runs a copy of this suite from elsewhere.
#
# UNC NOTE: -File against a UNC path is GPO-blocked on this box. Run the body:
#   $d = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colwidths'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$d\run.ps1"))) -Mutants
# Prints RESULT: GREEN/RED instead of exiting (an exit kills the caller).
# Stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$IndexPhp = '', [string]$HelpPhp = '',
      [string]$ModuleJs = '', [string]$ModuleCss = '', [string]$Here = '',
      [string]$Mutant = '', [switch]$Mutants, [switch]$CheckMutants, [string]$Only = '', [switch]$Control, [switch]$NoModule, [switch]$Real, [switch]$Keep)
$ErrorActionPreference = 'Stop'
$here = if ($Here) { $Here } elseif ($PSScriptRoot) { $PSScriptRoot } else { '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\colwidths' }
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
$php  = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Control) {
  # The files the deploy of this feature replaced (byte-identical to the pre-feature build).
  # De-bloats MOVED the old .baks out of the webroot; Get-BakItem finds them in git / the
  # de-bloat folders (_oldver\bak_index.tsv).
  . ([scriptblock]::Create([IO.File]::ReadAllText('\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\_oldver\oldver.ps1')))   # .bak copies come from git since 2026-10-14
  function LastBak($rel) { Get-BakItem "$app\$rel" | Select-Object -Last 1 }
  $bm = LastBak 'js\main.js.bak-*-colwidths'; $bi = LastBak 'index.php.bak-*-colwidths'; $bh = LastBak 'help_content.php.bak-*-colwidths'
  if (-not $MainJs)   { if (-not $bm) { throw '-Control needs js\main.js.bak-*-colwidths (made by the deploy), or pass -MainJs' }; $MainJs = $bm.FullName }
  if (-not $IndexPhp) { if ($bi) { $IndexPhp = $bi.FullName } }
  if (-not $HelpPhp)  { if ($bh) { $HelpPhp = $bh.FullName } }
  $NoModule = $true
}
if (-not $MainJs)    { $MainJs    = "$js\main.js" }
if (-not $MainCss)   { $MainCss   = "$app\css\main.css" }
if (-not $IndexPhp)  { $IndexPhp  = "$app\index.php" }
if (-not $HelpPhp)   { $HelpPhp   = "$app\help\topics\userSettingsHelpLightbox.php" }   # (2026-10-19) the v1 help is gone
if (-not $ModuleJs)  { $ModuleJs  = "$js\penumbra_colwidths.js" }
if (-not $ModuleCss) { $ModuleCss = "$app\css\penumbra_colwidths.css" }
$need = @($MainJs, $MainCss, $IndexPhp, $HelpPhp)
if (-not $NoModule) { $need += @($ModuleJs, $ModuleCss) }
foreach ($p in $need) { if (-not (Test-Path $p)) { throw "file under test not found: $p" } }

$srcMain = [IO.File]::ReadAllText($MainJs, $utf8)
$srcMod  = if ($NoModule) { $null } else { [IO.File]::ReadAllText($ModuleJs, $utf8) }
$NL = "`r`n"; $LF = "`n"

# --- mutants -----------------------------------------------------------------
# name = @{ file = 'main'|'module'; edits = @(@(old, new), ...); red = asserts that MUST go red }
# Every anchor must be found exactly once (the FEATURE build is required).
$mutantDefs = [ordered]@{
  # module: the rules
  'footidx'     = @{ file = 'module'; edits = @(,@("S + ' > tfoot > tr > td:nth-child(' + c.vis + '):not([colspan])' +", "S + ' > tfoot > tr > td:nth-child(' + c.idx + '):not([colspan])' +")); red = @('U1','G5') }
  # Equivalent for geometry (measured 2026-09-24): a spanning cell never takes ONE column's width -
  # it spans the table whatever its own width says - so this guard is defensive and only the rule
  # text pins it, like !important below. G6 keeps the colspan row itself honest.
  'nocolspan'   = @{ file = 'module'; edits = @(,@("S + ' > tbody > tr > td:nth-child(' + c.idx + '):not([colspan]),' +", "S + ' > tbody > tr > td:nth-child(' + c.idx + '),' +")); red = @('U1') }
  'headonly'    = @{ file = 'module'; edits = @(@("S + ' > tbody > tr > td:nth-child(' + c.idx + '):not([colspan]),' +", "S + ' > thead > tr > th:nth-child(' + c.idx + '),' +"), @("S + ' > tfoot > tr > td:nth-child(' + c.vis + '):not([colspan])' +", "S + ' > thead > tr > th:nth-child(' + c.idx + ')' +")); red = @('U1','G2') }
  'noimportant' = @{ file = 'module'; edits = @(,@("S + ' > tfoot > tr > td:nth-child(' + c.vis + '):not([colspan])' +$LF                     '{box-sizing:border-box!important;width:' + w + '!important;' +", "S + ' > tfoot > tr > td:nth-child(' + c.vis + '):not([colspan])' +$LF                     '{box-sizing:border-box;width:' + w + ';' +")); red = @('U1') }
  'noscope'     = @{ file = 'module'; edits = @(,@("var SCOPE = '#results-wrapper #resultsTable';", "var SCOPE = '#resultsTable';")); red = @('U1','G8') }
  'noobserver'  = @{ file = 'module'; edits = @(,@("}).observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });", "}).disconnect();")); red = @('G7') }
  'nofreezesync'= @{ file = 'module'; edits = @(,@("if (window.Penumbra && window.Penumbra.flatFreeze) { window.Penumbra.flatFreeze.apply(); }", "")); red = @('G11') }
  # module: the drag
  'livedrag'    = @{ file = 'module'; edits = @(,@("            place(drag.w);$LF        });", "            place(drag.w);$LF            setWidth(drag.c, drag.w);$LF        });")); red = @('D3') }
  'nosuppress'  = @{ file = 'module'; edits = @(,@("        if (!suppressUntil) { return; }", "        return;")); red = @('D5') }
  # (2026-10-22, colmenu round 33) Fit to page, widths as shares of the page
  'pageclean'   = @{ file = 'main'; edits = @(,@("                if (p > 0 && p <= 100 && name.indexOf('PIVOT:') !== 0) out[name] = p + '%';", "")); red = @('F1', 'F4') }
  'pageresolve' = @{ file = 'module'; edits = @(,@("        if (!isShare(v)) { return v; }", "        return isShare(v) ? null : v;")); red = @('F4') }
  'pagedrawn'   = @{ file = 'module'; edits = @(,@("        pageCols(view, row).fixed.forEach(function (f) { fixed += contentWidth(f.th); });", "        pageCols(view, row).fixed.forEach(function (f) { fixed += f.th.getBoundingClientRect().width; });")); red = @('F7') }
  'pagespare'   = @{ file = 'module'; edits = @(,@("            big.forEach(function (q) { w[q] += bsum > 0 ? spare * w[q] / bsum : spare / big.length; });", "")); red = @('F3') }
  'pageprop'    = @{ file = 'module'; edits = @(,@("            w = lo.map(function (x, q) { return x + (hi[q] - x) * f; });", "            w = lo.map(function (x, q) { return x + (room - sumLo) / n; });")); red = @('F2', 'F5') }
  'pagefloor'   = @{ file = 'module'; edits = @(,@("        } else if (sumFl < room && sumLo > sumFl) {", "        } else if (false) {")); red = @('F3') }
  'pagemin'     = @{ file = 'module'; edits = @(,@("            mins.push(minWidth(s.c));", "            mins.push(minFor(s.c));")); red = @('F5') }
  'pagenoundo'  = @{ file = 'module'; edits = @(,@("                else { host.setUser(k, before[k]); }", "                else { }")); red = @('F11') }
  'nodouble'    = @{ file = 'module'; edits = @(,@("if (lastPress && lastPress.key === c.key && t - lastPress.t < DOUBLE_MS) {", "if (false) {")); red = @('D6') }
  # (2026-10-18) the double press back to a reset of every width: D6 red
  'dblreset'    = @{ file = 'module'; edits = @(,@("if (c.view !== 'pivot') { if (e.shiftKey) { fitAll(c); } else { fitOne(c); } } else { resetAll(c); }", "resetAll(c);")); red = @('D6') }
  # (2026-10-18, round 22) a breakdown's double press back to the reset of every width; Shift on a breakdown ignored
  'drillreset'  = @{ file = 'module'; edits = @(,@("if (c.view !== 'pivot') { if (e.shiftKey) { fitAll(c); } else { fitOne(c); } } else { resetAll(c); }", "if (c.view === 'flat' || c.view === 'group') { if (e.shiftKey) { fitAll(c); } else { fitOne(c); } } else { resetAll(c); }")); red = @('E4') }
  'drillshift'  = @{ file = 'module'; edits = @(,@("        if (c.view === 'drill') { return fitAllDrill(c); }", "")); red = @('E4c') }
  # (2026-10-18) the fit without its Undo; Shift ignored on the double press
  'nofitundo'   = @{ file = 'module'; edits = @(,@("            if (drill) { setWidth(c, had === null ? 'auto' : had); } else { host.setUser(c.key, had); apply(); }", "")); red = @('D6c') }
  'noshift'     = @{ file = 'module'; edits = @(,@("if (e.shiftKey) { fitAll(c); } else { fitOne(c); }", "fitOne(c);")); red = @('D6d') }
  'noundo'      = @{ file = 'module'; edits = @(,@("Object.keys(before).forEach(function (k) { host.setUser(k, before[k]); });", "")); red = @('D6b') }
  'pivotscope'  = @{ file = 'module'; edits = @(,@("return (k.indexOf('PIVOT:') === 0) === pivot;", "return true;")); red = @('M6') }
  'noescape'    = @{ file = 'module'; edits = @(,@("if (e.key === 'Escape' || e.key === 'Esc') {", "if (false) {")); red = @('D7') }
  'escdocument' = @{ file = 'module'; edits = @(,@("        window.addEventListener('keydown', onDragKey, true);", "        document.addEventListener('keydown', onDragKey, true);")); red = @('D7') }
  'noclamp'     = @{ file = 'module'; edits = @(,@("function clampDrag(w) { return Math.max(drag ? drag.min : host.min, Math.min(drag ? drag.max : host.max, Math.round(w))); }", "function clampDrag(w) { return Math.round(w); }")); red = @('D8','V5','Y4') }
  # module: keys, gate, note, off switch
  'nokeys'      = @{ file = 'module'; edits = @(,@("            row.addEventListener('keydown', onKey);", "")); red = @('K1') }
  'nomods'      = @{ file = 'module'; edits = @(,@("if (e.ctrlKey || e.metaKey || e.altKey || !enabled()) { return; }", "if (!enabled()) { return; }")); red = @('K2') }
  'keytarget'   = @{ file = 'module'; edits = @(,@("if (!c || e.target !== c.th) { return; }", "if (!c) { return; }")); red = @('K4') }
  'nogate'      = @{ file = 'module'; edits = @(,@("function enabled() { return !!host && !host.restricted(); }", "function enabled() { return !!host; }")); red = @('R2') }
  'nonote'      = @{ file = 'module'; edits = @(,@("var mine = enabled() && host.userDiff().length > 0;", "var mine = false;")); red = @('S1') }
  'noreset'     = @{ file = 'module'; edits = @(,@("            host.clearUser();$LF            apply();$LF            say(", "            apply();$LF            say(")); red = @('S1') }
  'nooffswitch' = @{ file = 'module'; edits = @(,@('    if (/[?&]colwidths=off(?:&|$)/i.test(window.location.search)) { return; }', '')); red = @('O1') }
  # main.js: the state layer
  'noauto'      = @{ file = 'main'; edits = @(,@("if (v === 'auto') { if (allowAuto) out[name] = 'auto'; return; }", "if (v === 'auto') { return; }")); red = @('U2','U3','P1') }
  'nodiffer'    = @{ file = 'main'; edits = @(,@("        userColumnWidths = penumbraColWidthsUserDiff();$NL        if (!currentLoadedStateName) return;", "        if (!currentLoadedStateName) return;")); red = @('P1') }
  'nohydrate'   = @{ file = 'main'; edits = @(,@("        userColumnWidths = penumbraCleanColWidths(prefs && prefs.widths, true);", "")); red = @('P3') }
  'nocarry'     = @{ file = 'main'; edits = @(,@("        if (existing && existing.widths && typeof existing.widths === 'object') savedData.widths = existing.widths;", "")); red = @('P2') }
  'nosave'      = @{ file = 'main'; edits = @(,@("            state.columnWidths = _colWidths;", "")); red = @('P4','P5') }
  'noforward'   = @{ file = 'main'; edits = @(,@("            if (!ths.length || !(window.Penumbra && window.Penumbra.colWidths)) return stored;", "            if (false) return stored;")); red = @('P5','O2') }
  'nofailsafe'  = @{ file = 'main'; edits = @(,@("        } catch (e) { return stored; }", "        } catch (e) { throw e; }")); red = @('P9') }
  'nosaved'     = @{ file = 'main'; edits = @(,@("        reportColumnWidths = penumbraCleanColWidths(saved, false);", "")); red = @('P7') }
  'nostateload' = @{ file = 'main'; edits = @(,@("                reportColumnWidths = penumbraCleanColWidths(decodedState ? decodedState.columnWidths : null, false);", "")); red = @('G13') }
  'nogatemain'  = @{ file = 'main'; edits = @(,@("        return !penumbra_vars.isAdmin && !!window._penumbraHideColumns;", "        return false;")); red = @('R2') }
  'nopill'      = @{ file = 'main'; edits = @(,@("            var widthsDiff = _ccWidthsDiff();", "            var widthsDiff = null;")); red = @('C1') }
  'pillwhenoff' = @{ file = 'main'; edits = @(,@("            if (!currentLoadedStateName || !(window.Penumbra && window.Penumbra.colWidths)) return null;", "            if (!currentLoadedStateName) return null;")); red = @('C2') }
  # 2026-10-01 - the pill beyond the flat table (phase L, W4). Single-quoted: the
  # anchors hold jQuery's $( - a double-quoted string would expand it.
  'pillpivot'   = @{ file = 'main'; edits = @(,@('            if (pivotWidthsDiff) {', '            if (false) {')); red = @('L2','L3','L4','L5','L6') }
  'pillviews'   = @{ file = 'main'; edits = @(,@('            if (!currentLoadedStateName || !cw || !cw.VIEWS) return null;', '            if (!currentLoadedStateName || !cw) return null;')); red = @('L6','W4') }
  'pillpgate'   = @{ file = 'main'; edits = @(,@(('            if (!currentLoadedStateName || !cw || !cw.VIEWS) return null;' + $NL + '            if (penumbraColWidthsRestricted()) return null;'), '            if (!currentLoadedStateName || !cw || !cw.VIEWS) return null;')); red = @('L6') }
  'pillrowname' = @{ file = 'main'; edits = @(,@('                else label = pivotFieldDisplayLabel(k.slice(6));', '                else label = k;')); red = @('L2') }
  'pillgrid'    = @{ file = 'main'; edits = @(,@('                    if (leaf) label = (leaf.row ? _ccHeadText(leaf.group.th) + '' '' : '''') + _ccHeadText(leaf.th);', '                    if (false) label = '''';')); red = @('L4') }
  'pillplaces'  = @{ file = 'main'; edits = @(,@('            if (places) out.push(places === 1 ? ''1 value column'' : places + '' value columns'');', '')); red = @('L5') }
  'pillgt'      = @{ file = 'main'; edits = @(,@('                if (k.indexOf(''PIVOT:TOTAL='') === 0 || (m && m[2].charAt(0) === ''T'')) label = ''Grand Total'';', '                if (false) label = ''Grand Total'';')); red = @('L3','L5') }
  # 2026-10-01 - breakdown tables (phase E, W5). Single-quoted where the anchor holds a $.
  'drillstore'  = @{ file = 'module'; edits = @(,@('            if (v === ''auto'') { delete drillW[c.name]; } else { drillW[c.name] = v; }', '            host.setUser(c.key, v);')); red = @('E1') }
  'drillname'   = @{ file = 'module'; edits = @(,@('        for (var n = th.firstChild; n; n = n.nextSibling) { if (n.nodeType === 3) { s += n.nodeValue; } }', '        s = th.textContent;')); red = @('E1','E3b') }
  'drillmark'   = @{ file = 'module'; edits = @(@('        if (table.classList && table.classList.contains(''pnb-breakdown'') && table.ownerDocument === document) {', '        if (table.classList && table.classList.contains(''infobox-drill-table'') && table.ownerDocument === document) {'), @('        return !!th && !!th.closest(''table.pnb-breakdown > thead'');', '        return !!th && !!th.closest(''table.infobox-drill-table > thead'');')); red = @('E6') }
  'drillsession'= @{ file = 'module'; edits = @(,@('        if (key !== drillKey) { drillW = Object.create(null); drillKey = key; }', '')); red = @('E7') }
  'drillopen'   = @{ file = 'module'; edits = @(,@('            document.addEventListener(''penumbra:breakdown-opened'', function () { apply(); });', '')); red = @('E3') }
  'drillfocus'  = @{ file = 'module'; edits = @(,@(('            stampDrillFocus();' + $LF + '        }' + $LF + '        syncNote();'), ('        }' + $LF + '        syncNote();'))); red = @('E0') }
  # (No mutant for the views switch on breakdowns: it is gated in three places -
  # colOf(), the listeners' registration and apply()'s VIEWS block - so no single
  # edit opens it; W5 holds the combined behaviour.)
  'drillevent'  = @{ file = 'main'; edits = @(,@('        try { document.dispatchEvent(new CustomEvent(''penumbra:breakdown-opened'')); } catch (e) {}', '')); red = @('E3') }
  # 2026-09-30 - the grouped view
  'gnonorm'     = @{ file = 'module'; edits = @(,@("out.push({ attr: active[i].attr, pct: active[i].pct / tot2 * 100 });", "out.push({ attr: active[i].attr, pct: active[i].pct });")); red = @('V3') }
  'gnofloor'    = @{ file = 'module'; edits = @(,@("if (left * active[i].pct / tot < FLOOR) {", "if (false) {")); red = @('V4') }
  'gnoscale'    = @{ file = 'module'; edits = @(,@("var scale = (W > 0 && sumPin > room) ? Math.max(0, room) / sumPin : 1;", "var scale = 1;")); red = @('V4') }
  'gnocap'      = @{ file = 'module'; edits = @(,@("function maxFor(c) { return c.view === 'group' ? groupMaxFor(c.key) : host.max; }", "function maxFor(c) { return host.max; }")); red = @('V5') }
  'gnoclick'    = @{ file = 'module'; edits = @(,@("            return { th: th, view: 'group', key: nameOf(th) };", "            return null;")); red = @('V5','V8') }
  'noviewsobs'  = @{ file = 'module'; edits = @(,@("                if (window.MutationObserver) { new MutationObserver(schedule).observe(box, { childList: true }); }", "")); red = @('V11','Q9') }
  # 2026-09-30 - the pivot's row labels
  'pnominimized'= @{ file = 'module'; edits = @(,@("var a = '[data-row-field=`"' + attrEsc(L.level) + '`"]:not(.pivot-row-field-minimized)';", "var a = '[data-row-field=`"' + attrEsc(L.level) + '`"]';")); red = @('Q3') }
  'pnorelayout' = @{ file = 'module'; edits = @(,@("                try { if (host.pivotRelayout) { host.pivotRelayout(); } } catch (e2) { /* no pivot on screen */ }", "")); red = @('Q4') }
  'pnobody'     = @{ file = 'module'; edits = @(,@("                     P + ' > tbody > tr > td' + a + ':not([colspan]),' +", "")); red = @('Q2') }
  'pnofocus'    = @{ file = 'module'; edits = @(,@("            if (!ths[i].hasAttribute('tabindex')) { ths[i].setAttribute('tabindex', '0'); }", "")); red = @('Q0') }
  'pbylevel'    = @{ file = 'module'; edits = @(,@("            var w = host.widthFor('PIVOT:' + f);", "            var w = host.widthFor('PIVOT:' + level);")); red = @('Q1','Q9') }
  # 2026-09-30 - the views switch
  'noviewsattr' = @{ file = 'module'; edits = @(,@("        return !(script && script.getAttribute && script.getAttribute('data-views') === 'off') &&", "        return true &&")); red = @('U4') }
  'viewsalways' = @{ file = 'module'; edits = @(,@("    var VIEWS = viewsFor(document.currentScript, window.location.search);", "    var VIEWS = true;")); red = @('W1','W2') }
  # 2026-09-30 - main.js (patch_colwidths2.py)
  'nosavepivot' = @{ file = 'main'; edits = @(,@("            penumbraColWidthsPivotKeys().forEach(function (k) {", "            [].forEach(function (k) {")); red = @('Q8','Y9') }
  'nopivotfields' = @{ file = 'main'; edits = @(,@("        return (currentPivotSettings && Array.isArray(currentPivotSettings.rows)) ? currentPivotSettings.rows.slice() : [];", "        return [];")); red = @('Q0') }
  'nohostrelayout' = @{ file = 'main'; edits = @(,@("        try { updateStickyColumnLayout(); } catch (e) { /* no pivot on screen */ }", "")); red = @('Q4') }
  # 2026-10-01 - a pivot's ONE value column (round 3), then a one-row header's value columns (round 4)
  'vnomark'     = @{ file = 'module'; edits = @(,@("                var V = P + '[' + VALUE_ATTR + ']';", "                var V = P;")); red = @('Y7','Y11') }
  'vnocolspan'  = @{ file = 'module'; edits = @(,@("                var v = L.value === 'total' ? '.' + GT_CLASS : ':not([data-row-field]):not([colspan]):not(.' + GT_CLASS + ')';", "                var v = L.value === 'total' ? '.' + GT_CLASS : ':not([data-row-field]):not(.' + GT_CLASS + ')';")); red = @('Y2','Y11') }
  'vonerow'     = @{ file = 'module'; edits = @(,@("        if (!t || !t.tHead || t.tHead.rows.length !== 1) { return null; }", "        if (!t || !t.tHead) { return null; }")); red = @('Y6','Z8') }
  'vmaxwidth'   = @{ file = 'module'; edits = @(,@("V + ' > tfoot > tr > td' + v +$LF                         '{box-sizing:border-box!important;width:' + w + '!important;' +$LF                         'min-width:' + w + '!important;max-width:none!important}');", "V + ' > tfoot > tr > td' + v +$LF                         '{box-sizing:border-box!important;width:' + w + '!important;' +$LF                         'min-width:' + w + '!important;max-width:' + w + '!important}');")); red = @('Y3','Y11','Z3') }
  'mmaxwidth'   = @{ file = 'module'; edits = @(,@("Gm + ' > tfoot > tr > td' + at +$LF                         '{box-sizing:border-box!important;width:' + w + '!important;' +$LF                         'min-width:' + w + '!important;max-width:none!important}');", "Gm + ' > tfoot > tr > td' + at +$LF                         '{box-sizing:border-box!important;width:' + w + '!important;' +$LF                         'min-width:' + w + '!important;max-width:' + w + '!important}');")); red = @('M11','M16') }
  'vnofloor'    = @{ file = 'module'; edits = @(,@("        return Math.max(lo, valueFloor(c.th.closest('table'), c.value));", "        return lo;")); red = @('Y4','Y5','Z4') }
  'vnolabel'    = @{ file = 'module'; edits = @(,@("note = c.value === 'group' ? ' (widest numbers)' : ' (widest number)'; }", "note = ''; }")); red = @('Y4','Z4','M3','M14') }
  'vnokeybase'  = @{ file = 'module'; edits = @(,@("            if (c.value) { cur = Math.max(cur, valueWidest(c)); }", "")); red = @('Y5','Z7') }
  'vnofocus'    = @{ file = 'module'; edits = @(,@("            if (!vths[k].hasAttribute('tabindex')) { vths[k].setAttribute('tabindex', '0'); }", "")); red = @('Y0','Z0') }
  'vnoclick'    = @{ file = 'module'; edits = @(,@("                    return { th: th, view: 'pivot', key: 'PIVOT:=' + vf, field: vf, value: 'cols', n: heads.cols.length };", "                    return null;")); red = @('Y4','Y5','Z4','Z5') }
  'vnomarkcall' = @{ file = 'module'; edits = @(,@("            markPivotValue(document.getElementById('pivotResultTable'));", "")); red = @('Y0','Z0') }
  'vnohostfield'= @{ file = 'main'; edits = @(,@("        return (own || s.vals) ? String(own || s.vals) : null;", "        return null;")); red = @('Y0') }
  'vnooverride' = @{ file = 'main'; edits = @(,@("        const own = Array.isArray(s.aggColOverrides) ? s.aggColOverrides[0] : null;", "        const own = null;")); red = @('Y10') }
  'zgtsame'     = @{ file = 'module'; edits = @(,@("                var v = L.value === 'total' ? '.' + GT_CLASS : ':not([data-row-field]):not([colspan]):not(.' + GT_CLASS + ')';", "                var v = L.value === 'total' ? '.' + GT_CLASS : ':not([data-row-field]):not([colspan])';")); red = @('Z1','Y11') }
  'znototal'    = @{ file = 'module'; edits = @(,@("                if (th === heads.total) { return { th: th, view: 'pivot', key: 'PIVOT:TOTAL=' + vf, field: vf, value: 'total' }; }", "")); red = @('Z6') }
  'zpickgt'     = @{ file = 'module'; edits = @(,@("            if (tw) { out.push({ value: 'total', field: vf, w: tw }); }", "")); red = @('Z2') }
  'zfloorwhich' = @{ file = 'module'; edits = @(,@("        var v = which === 'total' ? '.' + GT_CLASS : ':not([data-row-field]):not([colspan]):not(.' + GT_CLASS + ')';", "        var v = '.' + GT_CLASS;")); red = @('Z3','Z4','Y4') }
  'zlabelall'   = @{ file = 'module'; edits = @(,@("        else if (c.n > 1) { note = ' (all ' + c.n + ' columns)'; }", "")); red = @('Z5') }
  'zannounce'   = @{ file = 'module'; edits = @(,@("        var many = c.n > 1;", "        var many = false;")); red = @('Z7') }
  # 2026-10-01 - a TWO-row header: groups and leaves (round 5)
  'mnomark'     = @{ file = 'module'; edits = @(,@("                var Gm = P + '[' + GRID_ATTR + ']', lf = L.grid;", "                var Gm = P, lf = L.grid;")); red = @('M11','M13') }
  'mpos'        = @{ file = 'module'; edits = @(,@("            leaves[i].p = n - i;", "            leaves[i].p = n - i + 1;")); red = @('M1') }
  'mgroupfirst' = @{ file = 'module'; edits = @(,@("            for (var i = 0; i < c.keys.length; i++) { host.setUser(c.keys[i], ws ? ws[i] : 'auto'); }", "            for (var i = 0; i < 1; i++) { host.setUser(c.keys[i], ws ? ws[i] : 'auto'); }")); red = @('M2','M5','M6') }
  'msplitfloor' = @{ file = 'module'; edits = @(,@("                if (!held[i] && mins[i] > left / free) { held[i] = true; out[i] = mins[i]; left -= mins[i]; free--; moved = true; }", "")); red = @('M14') }
  'mbyname'     = @{ file = 'module'; edits = @(,@("            var th = top[i], g = { th: th, id: th.classList.contains(GT_CLASS) ? 'T' : String(gi++), leaves: [] };", "            var th = top[i], g = { th: th, id: th.classList.contains(GT_CLASS) ? 'T' : headText(th), leaves: [] };")); red = @('M4') }
  'mgtindex'    = @{ file = 'module'; edits = @(,@("            var th = top[i], g = { th: th, id: th.classList.contains(GT_CLASS) ? 'T' : String(gi++), leaves: [] };", "            var th = top[i], g = { th: th, id: String(gi++), leaves: [] };")); red = @('M4') }
  'mnofocus'    = @{ file = 'module'; edits = @(,@("            for (var g = 0; g < grid.groups.length; g++) { vths.push(grid.groups[g].th); }", "")); red = @('M0') }
  'mnoleaf'     = @{ file = 'module'; edits = @(,@("                    if (lx.th === th) { return { th: th, view: 'pivot', key: gridKey(gf, lx.id), field: gf, value: 'leaf', leaf: lx }; }", "")); red = @('M3') }
  'mnogroup'    = @{ file = 'module'; edits = @(,@("                    if (gy.th === th) {", "                    if (false) {")); red = @('M2','M14') }
  'mnotail'     = @{ file = 'module'; edits = @(,@("        if (first) {", "        if (false) {")); red = @('M15') }
  'mlabelgroup' = @{ file = 'module'; edits = @(,@("        else if (c.value === 'group') { note = ' (' + c.n + ' columns)'; }", "")); red = @('M2') }
  'mminvalue'   = @{ file = 'main'; edits = @(,@("            const lo = (name.indexOf('PIVOT:=') === 0 || name.indexOf('PIVOT:TOTAL=') === 0) ? PENUMBRA_COLW_MIN_VALUE : PENUMBRA_COLW_MIN;", "            const lo = PENUMBRA_COLW_MIN;")); red = @('M3','M12') }
  'mhostmin'    = @{ file = 'main'; edits = @(,@("        minValue: PENUMBRA_COLW_MIN_VALUE,", "")); red = @('M') }
  # 2026-10-15 moderate (WCAG 4.1.2 / 3.3.2) - the + - 0 keys named on the headers (K5, V0b, E0b)
  'keysflat'    = @{ file = 'module'; edits = @(,@(('        syncNote();' + $LF + '        stampFlatKeys();'), '        syncNote();')); red = @('K5') }
  'keysfocus'   = @{ file = 'module'; edits = @(,@("        document.addEventListener('focusin', function (e) { var c = colOf(e.target); if (c && c.th === e.target) { stampKeys(c.th); } }, true);", "")); red = @('V0b') }
  'keysdrill'   = @{ file = 'module'; edits = @(,@(("                stampKeys(row.cells[i]);" + $LF), "")); red = @('E0b') }
  'keysattr'    = @{ file = 'module'; edits = @(,@("        if (th.getAttribute('aria-keyshortcuts') !== 'Plus - 0') { th.setAttribute('aria-keyshortcuts', 'Plus - 0'); }", "")); red = @('K5','V0b','E0b') }
  # 2026-10-22 (fit39) - the grouped view read by its FIRST group's row although that group is closed (0px: Fit
  # to page does nothing), and the container's observer blind to a new row to read (a group opening)
  'grefvis'     = @{ file = 'module'; edits = @(,@("        for (var i = 0; i < rows.length; i++) { if (rows[i].getClientRects().length) { return rows[i]; } }", "")); red = @('F12') }
  'grefro'      = @{ file = 'module'; edits = @(,@("                    if (w !== lastW || ref !== lastRef) { lastW = w; lastRef = ref; schedule(); }", "                    if (w !== lastW) { lastW = w; lastRef = ref; schedule(); }")); red = @('F14') }
}

function Apply-Mutant([string]$name) {
  if (-not $mutantDefs.Contains($name)) { throw "unknown mutant '$name' (known: $(($mutantDefs.Keys) -join ', '))" }
  $def = $mutantDefs[$name]
  $text = if ($def.file -eq 'main') { $srcMain } else { $srcMod }
  if ($null -eq $text) { throw "mutant '$name' needs the module file" }
  foreach ($e in $def.edits) {
    $n = ([regex]::Matches($text, [regex]::Escape($e[0]))).Count
    if ($n -ne 1) { throw "mutant '$name' anchor found $n times, expected 1 (needs the FEATURE build): $($e[0])" }
    $text = $text.Replace($e[0], $e[1])
  }
  if ($def.file -eq 'main') { return @{ main = $text; mod = $srcMod } } else { return @{ main = $srcMain; mod = $text } }
}

# --- one browser run ---------------------------------------------------------
function Invoke-Browser([string]$mainText, $modText, [string]$query, [string]$tag) {
  $run = Join-Path $env:TEMP ('pnb_cw_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force $run | Out-Null
  $libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
            'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
            'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
            'purify.min.js','penumbra_template.js','penumbra_userseg.js')
  foreach ($f in $libs) { Copy-Item "$js\$f" "$run\$f" -Force }
  Copy-Item $MainCss "$run\main.css" -Force
  Copy-Item (Join-Path (Split-Path $MainCss -Parent) 'density.css') "$run\density.css" -Force
  Copy-Item "$here\driver.js" "$run\driver.js" -Force

  $harness = [IO.File]::ReadAllText("$here\harness.html", $utf8)
  # The Freeze markup (the Settings panel note goes after its hint) comes from
  # the index.php UNDER TEST, so the harness cannot drift from the page.
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $m = [regex]::Match($idx, '(?s)<div class="sp-columns-head sp-aligned">.*?id="spFreezeHint"[^>]*>.*?</div>')
  if ($m.Success) {
    if ($m.Value.Contains('<?php')) { throw 'the Freeze markup block contains PHP - the harness cannot lift it verbatim' }
    $harness = [regex]::Replace($harness, '<!-- FREEZE_MARKUP:.*?-->', [System.Text.RegularExpressions.MatchEvaluator]{ param($x) $m.Value })
  }
  if ($null -ne $modText) {
    [IO.File]::WriteAllText("$run\penumbra_colwidths.js", $modText, $utf8)
    Copy-Item $ModuleCss "$run\penumbra_colwidths.css" -Force
    $harness = [regex]::Replace($harness, '<!-- MODULE_CSS:.*?-->', '<link rel="stylesheet" href="penumbra_colwidths.css">')
    $harness = [regex]::Replace($harness, '<!-- MODULE_JS:.*?-->', '<script src="penumbra_colwidths.js"></script>')
  }
  [IO.File]::WriteAllText("$run\harness.html", $harness, $utf8)

  # closure exports
  $anchor = '$(document).ready(function () {'
  if (-not $mainText.Substring(0, 200).Contains($anchor)) { throw 'main.js closure anchor not found' }
  $hook = @(
    'try { window.__CWH = {',
    '  setName: function (v) { currentLoadedStateName = v; }, getName: function () { return currentLoadedStateName; },',
    '  getEditor: function () { return editor; },',
    '  setStateLoading: function (v) { isStateLoading = v; },',
    '  setReportWidths: function (m) { reportColumnWidths = penumbraCleanColWidths(m, false); penumbraColWidthsRefresh(); },',
    '  setPivotSettings: function (s) { currentPivotSettings = s; },',
    '  getSort: function () { return sortCriteria.slice(); }, resetSort: function () { sortCriteria = []; }',
    '}; } catch (e) { window.__CWH_ERR = String(e); }',
    'try { var _cwF = { hydrate: "hydrateUserColumnSummaries", saveColPrefs: "saveColumnPrefs", loadColPrefs: "loadColumnPrefs",',
    '  buildState: "buildStateObject", openSP: "openSettingsPanel", updateTotalRow: "updateTotalRow",',
    '  updateStickyHeaderOffset: "updateStickyHeaderOffset", clean: "penumbraCleanColWidths", saved: "penumbraColWidthsSaved",',
    '  setLevels: "setGroupingColumns", rebuild: "rebuildGroupedView", pcollect: "processPivotData", pgen: "generatePivotTable",',
    '  pextra: "getExtraValFields", prank: "buildRankConfig", psticky: "updateStickyColumnLayout", pzebra: "applyZebraStriping",',
    '  pcollapse: "injectPivotCollapseBar", chartDrill: "_showChartDrillBreakdown" }; } catch (e) {}'
  ) -join $NL
  # By NAME through eval, so a function an older build lacks costs only its own entry.
  $hook2 = 'try { Object.keys(_cwF).forEach(function (k) { try { window.__CWH[k] = eval(_cwF[k]); } catch (e) { (window.__CWH_MISSING = window.__CWH_MISSING || []).push(_cwF[k]); } }); } catch (e) { window.__CWH_ERR2 = String(e); }'
  $i = $mainText.IndexOf($anchor)
  $patched = $mainText.Substring(0, $i) + ';(function () {' + $NL + $hook + $NL + $hook2 + $NL + $mainText.Substring($i + $anchor.Length)
  $j = $patched.LastIndexOf('});')
  if ($j -lt 0) { throw 'closure tail not found' }
  $patched = $patched.Substring(0, $j) + '})();' + $patched.Substring($j + 3)
  [IO.File]::WriteAllText("$run\main_cw.js", $patched, $utf8)

  $prof = Join-Path $run 'profile'
  $dom  = Join-Path $run 'dom.txt'
  $url  = 'file:///' + $run.Replace([char]92, [char]47) + '/harness.html' + $query
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
      if ($parsed.hookErr) { Write-Host "  [$tag] hook: $($parsed.hookErr)" -ForegroundColor DarkYellow }
      if ($parsed.pageErrors -and $parsed.pageErrors.Count) { Write-Host "  [$tag] page errors: $($parsed.pageErrors -join ' | ')" -ForegroundColor DarkYellow }
      foreach ($r in $parsed.results) { $out += [pscustomobject]@{ name = [string]$r.name; pass = [bool]$r.pass; detail = [string]$r.detail } }
    }
  }
  if (-not $Keep -and -not $Real) { try { [IO.Directory]::Delete($run, $true) } catch {} } else { Write-Host "kept: $run" }
  $script:lastRun = $run
  return ,$out
}

# --- the index.php half ------------------------------------------------------
function Invoke-IndexHalf {
  $res = @()
  $idx = [IO.File]::ReadAllText($IndexPhp, $utf8)
  $m = [regex]::Match($idx, '(?s)<\?php /\* AFTER main\.js: (?:flat-table )?column widths.*?<\?php endif; \?>')
  if (-not $m.Success) {
    $res += [pscustomobject]@{ name = 'I1 index.php loads the module behind the .off switch'; pass = $false; detail = 'include block not found in ' + $IndexPhp }
  } else {
    $tmp = Join-Path $env:TEMP ('pnb_cwi_' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Force "$tmp\js", "$tmp\css" | Out-Null
    [IO.File]::WriteAllText("$tmp\t.php", $m.Value, $utf8)
    [IO.File]::WriteAllText("$tmp\js\penumbra_colwidths.js", '/* x */', $utf8)
    [IO.File]::WriteAllText("$tmp\css\penumbra_colwidths.css", '/* x */', $utf8)
    Push-Location $tmp
    try {
      $on = (& $php -n "$tmp\t.php") -join "`n"
      [IO.File]::WriteAllText("$tmp\js\penumbra_colwidths_views.off", '', $utf8)
      $views = (& $php -n "$tmp\t.php") -join "`n"
      [IO.File]::Delete("$tmp\js\penumbra_colwidths_views.off")
      [IO.File]::WriteAllText("$tmp\js\penumbra_colwidths.off", '', $utf8)
      $off = (& $php -n "$tmp\t.php") -join "`n"
      [IO.File]::Delete("$tmp\js\penumbra_colwidths.off")
      [IO.File]::Delete("$tmp\css\penumbra_colwidths.css")
      $half = (& $php -n "$tmp\t.php") -join "`n"
    } finally { Pop-Location }
    try { [IO.Directory]::Delete($tmp, $true) } catch {}
    $tagJs = '<script defer src="js/penumbra_colwidths.js?v='; $tagCss = '<link rel="stylesheet" href="css/penumbra_colwidths.css?v='
    $res += [pscustomobject]@{ name = 'I1 index.php: with both files present it emits the stylesheet link and the deferred script (cache-busted)'; pass = ($on.Contains($tagJs) -and $on.Contains($tagCss) -and $on -match 'colwidths\.js\?v=\d{9,}'); detail = $on.Trim().Replace("`n", ' | ') }
    $res += [pscustomobject]@{ name = 'I2 index.php: an (empty) js/penumbra_colwidths.off switches BOTH off - the rollback switch'; pass = (-not $off.Contains('penumbra_colwidths') -and $off.Trim() -eq ''); detail = 'output=[' + $off.Trim() + ']' }
    $res += [pscustomobject]@{ name = 'I3 index.php: a missing module file emits nothing (no 404, no PHP warning)'; pass = (-not $half.Contains('penumbra_colwidths') -and -not ($half -match 'Warning|Notice')); detail = 'output=[' + $half.Trim() + ']' }
    $res += [pscustomobject]@{ name = 'I6 index.php: js/penumbra_colwidths_views.off marks the script data-views="off" and still loads both files (the views switch)'; pass = ($views.Contains($tagCss) -and $views -match '<script defer src="js/penumbra_colwidths\.js\?v=\d{9,}" data-views="off"></script>'); detail = $views.Trim().Replace("`n", ' | ') }
    $res += [pscustomobject]@{ name = 'I7 index.php: without that file the script carries no data-views attribute'; pass = ($on -notmatch 'data-views'); detail = '' }
  }
  foreach ($f in @($IndexPhp, $HelpPhp)) {
    $l = (& $php -n -l $f) -join ' '
    $res += [pscustomobject]@{ name = 'I4 php -l ' + (Split-Path $f -Leaf); pass = ($l -match 'No syntax errors'); detail = $l }
  }
  $help = [IO.File]::ReadAllText($HelpPhp, $utf8)
  $res += [pscustomobject]@{ name = 'I5 the help entry exists beside Freeze (id="us-colwidths") and names the keys'; pass = ($help.Contains('id="us-colwidths"') -and $help.Contains('<kbd>+</kbd>') -and $help.Contains('<kbd>0</kbd>')); detail = '' }
  return ,$res
}

function Show([object[]]$res, [ref]$pass, [ref]$fail) {
  foreach ($r in $res) {
    if ($r.pass) { $pass.Value++; Write-Host ("  PASS  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Green }
    else { $fail.Value++; Write-Host ("  FAIL  " + $r.name + "  [" + $r.detail + "]") -ForegroundColor Red }
  }
}

if ($CheckMutants) {
  $bad = 0
  foreach ($name in $mutantDefs.Keys) {
    try { [void](Apply-Mutant $name); Write-Host ("  ok    {0}" -f $name) -ForegroundColor Green }
    catch { $bad++; Write-Host ("  BAD   {0}: {1}" -f $name, $_.Exception.Message) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY anchors ok={0} bad={1}" -f ($mutantDefs.Count - $bad), $bad)
  Write-Host $(if ($bad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

if ($Mutants) {
  Write-Host "[mutants] main.js: $MainJs   module: $ModuleJs"
  $mOk = 0; $mBad = 0
  $names = @($mutantDefs.Keys)
  if ($Only) { $names = @($Only.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
  foreach ($name in $names) {
    $mt = Apply-Mutant $name
    $wantsOff = @($mutantDefs[$name].red | Where-Object { $_ -like 'O*' }).Count -gt 0
    $wantsFlat = @($mutantDefs[$name].red | Where-Object { $_ -like 'W*' }).Count -gt 0
    $res = Invoke-Browser $mt.main $mt.mod '' $name
    # Through a variable: @(Invoke-Browser ...) would wrap the returned array as
    # ONE element, and that page's failures would silently read as passes.
    if ($wantsOff) { $resOff = Invoke-Browser $mt.main $mt.mod '?colwidths=off' "$name/off"; $res = @($res) + @($resOff) }
    if ($wantsFlat) { $resFlat = Invoke-Browser $mt.main $mt.mod '?colwidths=flat' "$name/flat"; $res = @($res) + @($resFlat) }
    $red = @($res | Where-Object { -not $_.pass } | ForEach-Object { ($_.name -split ' ')[0] })
    $missing = @($mutantDefs[$name].red | Where-Object { $red -notcontains $_ })
    if ($missing.Count -eq 0) { $mOk++; Write-Host ("  PASS  mutant {0,-12} turns {1} red   [red: {2}]" -f $name, ($mutantDefs[$name].red -join ' '), ($red -join ' ')) -ForegroundColor Green }
    else { $mBad++; Write-Host ("  FAIL  mutant {0,-12} stayed green on {1}   [red: {2}]" -f $name, ($missing -join ' '), ($red -join ' ')) -ForegroundColor Red }
  }
  Write-Host ("SUMMARY mutants ok={0} bad={1}" -f $mOk, $mBad)
  Write-Host $(if ($mBad -eq 0) { 'RESULT: GREEN' } else { 'RESULT: RED' })
  return
}

$bPass = 0; $bFail = 0
Write-Host "[1/3] browser half   main.js: $MainJs$(if ($Mutant) { "   + MUTANT $Mutant" })"
Write-Host "                     module:  $(if ($NoModule) { '(none)' } else { $ModuleJs })"
Write-Host "                     index.php: $IndexPhp"
$mt = if ($Mutant) { Apply-Mutant $Mutant } else { @{ main = $srcMain; mod = $srcMod } }
Show (Invoke-Browser $mt.main $mt.mod '' 'browser') ([ref]$bPass) ([ref]$bFail)
$runDir = $script:lastRun
Show (Invoke-Browser $mt.main $mt.mod '?colwidths=off' 'off') ([ref]$bPass) ([ref]$bFail)
# -Real keeps the FIRST page's staging dir for real_input.py; the others are not needed.
if ($Real -and -not $Keep -and $script:lastRun -ne $runDir) { try { [IO.Directory]::Delete($script:lastRun, $true) } catch {} }
Show (Invoke-Browser $mt.main $mt.mod '?colwidths=flat' 'flat') ([ref]$bPass) ([ref]$bFail)
if ($Real -and -not $Keep -and $script:lastRun -ne $runDir) { try { [IO.Directory]::Delete($script:lastRun, $true) } catch {} }
Write-Host ("SUMMARY browser pass={0} fail={1}" -f $bPass, $bFail)

$iPass = 0; $iFail = 0
if (-not $Mutant) {
  Write-Host "[2/3] index half     index.php: $IndexPhp   help: $HelpPhp"
  Show (Invoke-IndexHalf) ([ref]$iPass) ([ref]$iFail)
  Write-Host ("SUMMARY index pass={0} fail={1}" -f $iPass, $iFail)
}

$rOk = $true
if ($Real) {
  Write-Host "[3/3] real input     $runDir"
  & py -3 (Join-Path $here 'real_input.py') $runDir
  $rOk = ($LASTEXITCODE -eq 0)
  if (-not $Keep) { try { [IO.Directory]::Delete($runDir, $true) } catch {} }
}

$green = ($bFail -eq 0 -and $bPass -gt 0) -and ($iFail -eq 0) -and $rOk
Write-Host $(if ($green) { 'RESULT: GREEN' } else { 'RESULT: RED' })
