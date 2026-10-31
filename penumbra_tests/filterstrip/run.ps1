# =============================================================================
# Penumbra FILTER STRIP HARNESS  -  filter_strip() snippet control (2026-09-28)
#
# Boots js/main.js headlessly (same recipe as ..\pivot_trigger) and drives the
# real code paths of the filter_strip() snippet function:
#   - argument parsing (fields, options, keywords, refusals)
#   - the value encoder/decoder and the search-text round trip
#     (_pnbFsState / _pnbFsCompose), including the engine agreement check
#     through the REAL parseAdvancedQuery + evaluateParsedQuery
#   - chip sets with cross-filtered counts (_pnbFsGroups)
#   - engine A rendering, DOMPurify survival, the "+n more" fold
#   - the click flow through the executor's own `search` action
#   - engine B returning nothing, the function registry
#   - (2026-09-29) the composable toggle: filter|COND / unfilter|COND steps,
#     PenumbraTiles.strip.has/add/remove, the implied off side, and a toggle
#     and a strip sharing the box without wiping each other
#   - (2026-09-30) range fields ('Label|COLUMN|range'): parsing, bounds, kinds,
#     state / compose, the browser AND the server agreeing on every range text
#     (range_corpus.json through penumbra_search.php by range_php.php, then
#     through main.js in the page), and the boxes on the page: Enter, the pair
#     committing together, a bad value marked, dates, sync, clear, the pause
#   - (2026-09-30, later) the (blank) chip ('Label|COLUMN|blank'): parsing, the empty
#     alternative kept in the state, both engines matching it against an empty cell
#     (the corpus's blank cells through penumbra_search.php too), counts, pinned last,
#     never folded (at render and by the in-place fold), the click flow, the sync
#   - (2026-10-01) the strip in a PIVOT view (section L, a REAL pivot through the trigger
#     executor): no pause; a chip rebuilds the pivot from the matching transactions; the
#     counts from the source rows with aggregate conditions left out; __SRC written when
#     a chip column shares an aggregate label's name; a typed source condition; Clear all
#   - (2026-10-01, later) the list option ('Label|COLUMN|list', section M): parsing and the two
#     refusals (top=N, range), every value as a row in a scrolling column under a find box (the
#     real main.css, computed), typing hiding what it misses in place without a search, the (blank)
#     row found by name, the no-match note, Enter pressing the first row showing with the typed text
#     kept and the pressed rows first across the re-render, focus back in the box, a pressed row
#     never hidden, the sync, Clear all, az + exclude, the or pause reaching the box
#   - (2026-10-27) the vertical keyword (section N), on GEOMETRY from the real main.css: each
#     group's chips in a column, one value per line, as wide as the widest, the counts lined up at
#     the far end (it used to stack only the groups, so a one-field strip did not change); the
#     default still a row; one group per line; the label and clear on the first chip's line; Clear
#     all at the strip's side; right / center aligning the stacked groups; columns=N; segmented
#     parting with a bottom rule; "+n more" under the column; a list field untouched
#   - (2026-10-29) nested (@@JSON) fields (section O): chips from the sub-rows' values, each once
#     per row; two or more fields from one sub-table write __ROW with the first value pressed and
#     take it off with the last (read back between, so a hand delete stays); counts held to one
#     sub-row under __ROW; anyrow; a lone nested field writes none; range / split refused
#   - (2026-10-30) buttons (section P): '+Label|/regex/' under a column field = a pattern chip
#     OR'd with its value chips in ONE regex (only = the patterns alone); 'Label|*' + '+Label|COND'
#     = a button group (one = pick one, all = each adds its own). Parsing and every refusal, the
#     read-back (known patterns only, a button by every part in any order), compose as a fixed
#     point, each chip's count as its own query, render, clicks, sync, fold, nested __ROW; the
#     regexes also ride the corpus through penumbra_search.php (section J)
# Since 2026-09-29 the strip's grammar lives in js/penumbra_tiles.js
# (PenumbraTiles.strip, shared with the dashboard); main.js keeps the _pnbFs*
# names as delegates, so the hooks below still reach the real code.
#
#   powershell -File run.ps1                 (tests the LIVE js/main.js + js/penumbra_tiles.js)
#   powershell -File run.ps1 -MainJs <path> -TilesJs <path>
#                                            (staged copies, or a .bak as the
#                                             positive control: a pre-feature
#                                             main.js must FAIL with
#                                             "hooks unavailable")
#   powershell -File run.ps1 -Mutant <name>  (ONE single-point change, to SHOW
#                                             a named assertion bites)
#       fsorblind    a top-level `or` no longer pauses the strip        (tiles)
#       fsnoescape   values are no longer regex-escaped                 (tiles)
#       fsrestdrop   typed conditions are dropped from the composed text (tiles)
#       fsselfcount  a column's own selection narrows its own counts    (main)
#       condspacing  a condition is compared as raw text, not token by token (tiles)
#       condnodup    filter| adds a condition the box already holds     (tiles)
#       tsfilteractive  a filter| toggle never reads ON                 (main)
#       tsfilterwipe    filter| replaces the whole box, like search|    (main)
#       tsimpliedoff    a filter|-only toggle no longer inverts itself  (main)
#       tsorrefuse      a filter| step runs on a box holding an or      (main)
#       tsnumfmt        the toggle's markup goes through the number pass (main)
#       rangeclaim      a range field never claims its >= / <= from the box   (tiles)
#       rangecompose    the max bound is dropped from the composed text     (tiles)
#       rangeiso        an impossible day (Feb 30) is written as a bound    (tiles)
#       rangenum        any text passes as a number bound                   (tiles)
#       rangepair       moving from one box to the other commits half a range (main)
#       rangecounts     chip counts ignore a range                          (main)
#       rangetext       a range on a text column renders instead of refusing (main)
#       rangekind       the kinds are not learned before the state is read  (main)
#       listparse       the list option is ignored (chips, folded)           (tiles)
#       listfold        a list folds like chips                              (tiles)
#       listpin         a pressed row is not pinned first                    (tiles)
#       listfind        typing hides nothing                                 (tiles)
#       listkeep        the typed find text is lost at the next render       (main)
#       listsync        a hand-typed value leaves its pressed row hidden     (main)
#       listenter       Enter presses nothing                                (main)
#       rangesync       a typed bound no longer fills its box               (main)
#       rangesyncpair   a sync writes over the pair being edited            (main)
#       rangeinvalid    a bad value is written as it is                     (main)
#       blankparse      the blank option is read but never set              (tiles)
#       blankstate      the empty alternative is dropped on a blank field   (tiles)
#       blankclaim      a strip without the option drops a typed empty alternative (tiles)
#       blankwant       a pressed blank chip on such a strip counts nothing   (main)
#       rangehintgroup  range hints group every number (a year reads 2,025)  (tiles)
#       blankfold       top=N folds the blank chip like any other           (tiles)
#       blankcount      empty cells are never counted                       (main)
#       blankpin        the blank chip sorts among the values               (main)
#       blankdom        a sync forgets which groups are blank fields        (main)
#       blankrefold     the in-place fold (+n more, less) hides the blank chip (main)
#       blankalways     a column with no empty cells gets no blank chip          (main)
#       pivotpause      the strip pauses in a pivot view again                   (main)
#       pivotsrc        a chip column sharing an aggregate label's name is written without __SRC (main)
#       pivotaggcount   an aggregate condition in the box zeroes the counts      (main)
#     css mutants (2026-10-27, section N) - one rule of the stylesheet the harness loads:
#       vchips          a vertical strip's chips stay in a row                   (css)
#       vcount          the count follows the value instead of the far end       (css)
#       vgrp            the label and clear centre on the column, not its first line (css)
#       vmore           "+n more" stretches across the column                    (css)
#       vclear          Clear all centres under the stacked groups               (css)
#       vright          right no longer aligns the stacked groups                (css)
#       vcenter         center no longer aligns the stacked groups               (css)
#       vclearright     Clear all leaves the right edge under right              (css)
#       vseg            segmented parts the stacked chips with a right rule      (css)
#       vlist           the label rule reaches a list field too                  (css)
#       vseglist        the segmented rule reaches a list field's rows too       (css)
#       seglistscroll   a segmented strip's list field loses its scroll again    (css)
#   -SearchPhp <path> is the penumbra_search.php for the server half of the
#   range parity (default: the live one).
#
# If the UNC execution policy refuses the script, run its body as a scriptblock:
#   $dir='\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\filterstrip'
#   & ([scriptblock]::Create([IO.File]::ReadAllText("$dir\run.ps1").Replace('$here = $PSScriptRoot',"`$here = '$dir'"))) -MainJs <path>
# Output also lands in summary.txt (the console truncates long runs).
# Rebuilds from the LIVE app files each run; writes nothing to the webroot.
# Exit code 1 when any assertion fails.
# =============================================================================
param([string]$MainJs = '', [string]$MainCss = '', [string]$TilesJs = '', [string]$Mutant = '', [string]$SearchPhp = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot; if (-not $here) { $here = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\filterstrip' }   # empty when run as a scriptblock: never fall back to the caller's cwd
$app  = '\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
$js   = "$app\js"
if (-not $MainJs) { $MainJs = "$js\main.js" }
if (-not $TilesJs) { $TilesJs = "$js\penumbra_tiles.js" }
if (-not $SearchPhp) { $SearchPhp = "$app\penumbra_search.php" }
# The harness loads the real main.css (like ..\switchmotion) so it can assert
# COMPUTED styles: the top=N fold was green on a class check while the chips
# stayed visible (a lighter hide rule lost to the chip's layout rule).
if (-not $MainCss) { $MainCss = "$app\css\main.css" }
# Read byte for byte (Latin-1 maps every byte to one char), so a css mutant
# changes its anchor and nothing else; written to $here after the mutants.
$latin1 = [Text.Encoding]::GetEncoding(28591)
$cssSrc = [IO.File]::ReadAllText($MainCss, $latin1)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$summary = New-Object System.Collections.Generic.List[string]

Write-Host "[1/3] staging JS + patching main.js ..."
$libs = @('jquery-3.7.1.min.js','jquery-ui.min.js','moment.min.js','pako.min.js',
          'codemirror.min.js','sql.min.js','show-hint.js','foldcode.js','foldgutter.js',
          'brace-fold.js','comment-fold.js','placeholder.js','penumbra_snippet_help.js',
          'purify.min.js','penumbra_template.js')
foreach ($f in $libs) { Copy-Item "$js\$f" "$here\$f" -Force }

Write-Host "      main.js under test: $MainJs"
Write-Host "      penumbra_tiles.js under test: $TilesJs"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$src = [IO.File]::ReadAllText($MainJs, $utf8)
$tilesSrc = [IO.File]::ReadAllText($TilesJs, $utf8)
$anchor = '$(document).ready(function () {'
if (-not $src.Substring(0, 200).Contains($anchor)) { throw "main.js closure anchor not found - update run.ps1" }

# Targeted mutants: ONE single-point change each, in main.js or in
# penumbra_tiles.js (third element). The anchor must occur exactly once or the
# run throws - a mutant that quietly stopped applying would read as a vacuous
# pass.
$mutants = @{
  'fsorblind'   = @('if (low === ''or'') { out.or = true; }', 'if (low === ''or'') { out.or = false; }', 'tiles')
  # parentheses (2026-10-30): the or box is not wrapped (a chip would bind to one branch); a group is not one part
  'fswrapblind' = @('if (!sp.or) { return sp; }', 'return sp;', 'tiles')
  'fsparenflat' = @('depth += (tok === ''('') ? 1 : -1;', 'depth = 0;', 'tiles')
  'fsnoescape'  = @('function fsEncode(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, ''\\$&'').replace(/\//g, ''\\x2F''); }', 'function fsEncode(v) { return String(v).replace(/\//g, ''\\x2F''); }', 'tiles')
  'fsrestdrop'  = @('(st.rest || []).forEach(function (r) { if (r) parts.push(r); });', '/* mutant: rest dropped */', 'tiles')
  'fsselfcount' = @('if (gc !== col && st.sel[gc] && st.sel[gc].length) { others.sel[gc] = st.sel[gc]; anyOther = true; }', 'if (st.sel[gc] && st.sel[gc].length) { others.sel[gc] = st.sel[gc]; anyOther = true; }', 'main')
  'condspacing' = @('var t = String(s == null ? '''' : s).trim().replace(SPLIT_PROTECT,', 'return String(s == null ? '''' : s).trim(); var t = String(s == null ? '''' : s).trim().replace(SPLIT_PROTECT,', 'tiles')
  'condnodup'   = @('var add = want.filter(function (p) { return have.indexOf(condKey(p)) === -1; });', 'var add = want.slice();', 'tiles')
  'tsfilteractive' = @('if (kind === ''filter'') return fs.has(box, rest);', 'if (kind === ''filter'') return false;', 'main')
  'tsfilterwipe'   = @('var next = fs ? (kind === ''unfilter'' ? fs.remove(cur, cond) : fs.add(cur, cond)) : null;', 'var next = kind === ''unfilter'' ? '''' : cond;', 'main')
  'tsimpliedoff'   = @('if (!tsOff.length && tsOn.every(function (c) { return tsFilterRe.test(c); })) {', 'if (false) {', 'main')
  'tsorrefuse'     = @('if (next === null) {', 'if (next === null && false) {', 'main')
  'tsnumfmt'       = @('unformattedLiterals.push(tsHtml);', 'unformattedLiterals.push(tsHtml.replace(/2025/g, ''2,025''));', 'main')
  'rangeclaim'     = @('if (rf && rf.range && rf.kind !== ''text'') {', 'if (false) {', 'tiles')
  'rangecompose'   = @('if (rg && rg.max) parts.push(fsColRef(col) + '' <= '' + rg.max);', '/* mutant: max dropped */', 'tiles')
  'rangeiso'       = @('if (!mo || mo < 1 || mo > 12 || d < 1 || d > fsDaysIn(y, mo)) return null;', 'if (!mo) return null;', 'tiles')
  'rangenum'       = @('if (!FS_NUM.test(t) && !/^[-+]?\$?\.\d+%?$/.test(t)) return null;', 'if (false) return null;', 'tiles')
  'rangepair'      = @('if (e.relatedTarget && $.contains(this, e.relatedTarget)) return;   // first box -> second: still editing the pair', '/* mutant: every focus move commits */', 'main')
  'rangecounts'    = @('var anyOther = !!st.rest.length || anyRange;', 'var anyOther = !!st.rest.length;', 'main')
  'rangetext'      = @('if (fsTextRange.length) {', 'if (false) {', 'main')
  'rangekind'      = @('var rinfo = _pnbFsRangeKinds(fields, rows);', 'var rinfo = {};', 'main')
  'rangesyncpair'  = @('if ($.contains(this, document.activeElement)) return;', '/* mutant: sync over the pair being edited */', 'main')
  'rangesync'      = @('$(this).val(rg[$(this).attr(''data-fs-bound'')] || '''').removeAttr(''aria-invalid'');', '/* mutant: boxes not synced */', 'main')
  'rangeinvalid'   = @('if (b === null) { bad = true; $(this).attr(''aria-invalid'', ''true''); return; }', 'if (b === null) { b = String($(this).val()); }', 'main')
  'blankparse'     = @('if (m === ''blank'') { f.blank = true; continue; }', 'if (m === ''blank'') { continue; }', 'tiles')
  'blankstate'     = @('st.sel[col] = (st.sel[col] || []).concat(fsSplitAlt(m[6]).map(fsDecode));', 'st.sel[col] = (st.sel[col] || []).concat(fsSplitAlt(m[6]).map(fsDecode).filter(function (v) { return v !== ''''; }));', 'tiles')
  'blankclaim'     = @('st.sel[col] = (st.sel[col] || []).concat(fsSplitAlt(m[6]).map(fsDecode));', 'st.sel[col] = (st.sel[col] || []).concat(fsSplitAlt(m[6]).map(fsDecode).filter(function (v) { return v !== '''' || f.blank; }));', 'tiles')
  'blankwant'      = @('var wantBlank = f.blank || (st.sel[col] || []).indexOf('''') !== -1;', 'var wantBlank = f.blank;', 'main')
  'pivotpause'     = @('        if ($(''#snapshotComparisonContainer'').is('':visible'')) return ''compare'';', '        if ($(''#pivot-output-container'').is('':visible'')) return ''pivot''; if ($(''#snapshotComparisonContainer'').is('':visible'')) return ''compare'';', 'main')
  'pivotsrc'       = @('            st.prefix = (st.prefix || '''') + ''__SRC '';', '            /* mutant: no __SRC for a shared name */', 'main')
  'pivotaggcount'  = @('if (pv) { pvRest = st.rest.filter(function (r) { return !_pnbFsFragIsAgg(r, pv.aggNames); }); }', '/* mutant: aggregate conditions counted */', 'main')
  'rangehintgroup' = @('useGrouping: grouped });', 'useGrouping: true });', 'tiles')
  'listparse'      = @('if (m === ''list'') { f.list = true; continue; }', 'if (m === ''list'') { continue; }', 'tiles')
  'listfold'       = @('if (f.list) hide = !e.on && !!ql && (blank ? ''(blank)'' : String(e.v)).toLowerCase().indexOf(ql) === -1;', '/* mutant: a list folds like chips */', 'tiles')
  'listpin'        = @('var order = f.list ? grp.values.filter(function (e) { return e.on; }).concat(grp.values.filter(function (e) { return !e.on; })) : grp.values;', 'var order = grp.values;', 'tiles')
  'listfind'       = @('c.classList.toggle(''pnb-fs-hid'', hide);', 'c.classList.toggle(''pnb-fs-hid'', false);', 'tiles')
  'listkeep'       = @('return _pnbFsLib().render(spec, _pnbFsGroups(spec, text), _pnbFsExpanded, { find: _pnbFsFind });', 'return _pnbFsLib().render(spec, _pnbFsGroups(spec, text), _pnbFsExpanded);', 'main')
  'listsync'       = @('if (pressed && $(this).closest(''.pnb-fs-list'').length) $(this).removeClass(''pnb-fs-hid'');', '/* mutant: the sync leaves a pressed row hidden */', 'main')
  'listenter'      = @('var $first = $(this).closest(''.pnb-fs-group'').find(''.pnb-fs-chip:not(.pnb-fs-hid)[aria-pressed="false"]'').first();', 'var $first = $();', 'main')
  'blankfold'      = @('var hide = !open && f.top > 0 && i >= f.top && !e.on && !blank;', 'var hide = !open && f.top > 0 && i >= f.top && !e.on;', 'tiles')
  'blankcount'     = @('if (v === '''' && !f.blank) continue;', 'if (v === '''') continue;', 'main')
  'blankpin'       = @('if (idx['''']) { list.splice(list.indexOf(idx['''']), 1); list.push(idx['''']); }   // the (blank) chip last, whatever the order', '/* mutant: the blank chip sorts among the values */', 'main')
  'blankdom'       = @('blank: $(this).attr(''data-fs-blank'') === ''1'' };', 'blank: false };', 'main')
  'blankrefold'    = @('&& !$(this).hasClass(''pnb-fs-blank''));', ');', 'main')
  'blankalways'    = @('if (f.blank && !idx['''']) { idx[''''] = { v: '''', all: 0, n: 0, on: false }; list.push(idx['''']); }', '/* mutant: no chip without empty cells */', 'main')
  'vchips'         = @('.pnb-fstrip.vertical .pnb-fs-group:not(.pnb-fs-list) .pnb-fs-chips { flex-direction: column; flex-wrap: nowrap; align-items: stretch; }', '/* mutant: the chips stay in a row */', 'css')
  'vcount'         = @('.pnb-fstrip.vertical .pnb-fs-group:not(.pnb-fs-list) .pnb-fs-chips .pnb-fs-chip .pnb-fs-v { flex: 1 1 auto; min-width: 0; text-align: left; }', '/* mutant: the count follows the value */', 'css')
  'vgrp'           = @('.pnb-fstrip.vertical .pnb-fs-group:not(.pnb-fs-list) { align-items: baseline; }', '/* mutant: label and clear centre on the column */', 'css')
  'vmore'          = @('.pnb-fstrip.vertical .pnb-fs-group .pnb-fs-chips .pnb-fs-more { align-self: flex-start; }', '/* mutant: +n more stretches */', 'css')
  'vclear'         = @('.pnb-fstrip.vertical .pnb-fs-clearall, .pnb-fstrip.vertical .pnb-fs-note { align-self: flex-start; }', '/* mutant: Clear all centres */', 'css')
  'vright'         = @('.pnb-fstrip.vertical.align-right { align-items: flex-end; }', '/* mutant: right lost */', 'css')
  'vcenter'        = @('.pnb-fstrip.vertical.align-center { align-items: center; }', '/* mutant: center lost */', 'css')
  'vclearright'    = @('.pnb-fstrip.vertical.align-right .pnb-fs-clearall, .pnb-fstrip.vertical.align-right .pnb-fs-note { align-self: flex-end; }', '/* mutant: Clear all leaves the right edge */', 'css')
  'vseg'           = @('.pnb-fstrip.segmented.vertical .pnb-fs-group:not(.pnb-fs-list) .pnb-fs-chips .pnb-fs-chip { border-right: 0; border-bottom: 1px solid var(--border-color, #dee2e6); }', '/* mutant: segments part with a right rule */', 'css')
  'vlist'          = @('.pnb-fstrip.vertical .pnb-fs-group:not(.pnb-fs-list) { align-items: baseline; }', '.pnb-fstrip.vertical .pnb-fs-group { align-items: baseline; }', 'css')
  'vseglist'       = @('.pnb-fstrip.segmented.vertical .pnb-fs-group:not(.pnb-fs-list) .pnb-fs-chips .pnb-fs-chip { border-right: 0;', '.pnb-fstrip.segmented.vertical .pnb-fs-group .pnb-fs-chips .pnb-fs-chip { border-right: 0;', 'css')
  'seglistscroll'  = @('gap: 2px; overflow-y: auto; overflow-x: hidden; }', 'gap: 2px; }', 'css')
  # section O (2026-10-29): nested fields and __ROW
  'nestrowadd'     = @('if (!before && after && !has) return p + ''__ROW '';', '/* mutant: __ROW never written */', 'tiles')
  'nestrowdrop'    = @('if (before && !after && has) return p.replace(/__ROW\s+/i, '''');', '/* mutant: __ROW never taken off */', 'tiles')
  'nestreadback'   = @('if (!before && after && !has)', 'if (after && !has)', 'tiles')
  'nestanykw'      = @('anyrow: ''anyrow''   // no look', '_anyrow: ''anyrow''   // no look', 'tiles')
  'nestcols'       = @('Object.keys(_pnbFsNestedSrc()).forEach(function (vc) { if (cols.indexOf(vc) === -1) cols.push(vc); });', '/* mutant: nested names unknown to the parser */', 'main')
  'nestvals'       = @('var nested = !!_pnbFsNestedSrc()[col];', 'var nested = false;', 'main')
  'nestpervalue'   = @('var perVal = nested && rowMatch ? Object.create(null) : null;', 'var perVal = null;', 'main')
  'nestexcount'    = @('? $.extend({}, g, { mode: ''in'' }) : g; }) : null;', '? g : g; }) : null;', 'main')
  'nestanyrow'     = @('if ($strip && $strip.hasClass(''anyrow'')) return out;', '/* mutant: anyrow ignored */', 'main')
  'nestsingle'     = @('if (src[c] && n[src[c]] > 1) out[c] = true;', 'if (src[c]) out[c] = true;', 'main')
  'nolabel'        = @('if (!label) label = bits[1];', '/* mutant: no label stays empty */', 'tiles')
  'nestrefuse'     = @('return (f.range || f.split) && _pnbFsNestedSrc()[f.col]; });', 'return false; });', 'main')
  # section P (2026-10-30): buttons - patterns and Label|* groups
  'btnparse'       = @('if (raw.charAt(0) === ''+'') {', 'if (false) {', 'tiles')
  'patread'        = @('? fsPatBody(body, iff.pats) : null;', '? null : null;', 'tiles')
  'patcompose'     = @('if (f.pats && pon.length) { parts.push(fsPatCond(col, f, st.sel[col], pon)); return; }', '/* mutant: patterns not written */', 'tiles')
  'patvals'        = @('if (vals && vals.length) alts.push(''^(?:'' + vals.map(fsEncode).join(''|'') + '')$'');', '/* mutant: values dropped beside a pattern */', 'tiles')
  'btnclaim'       = @('fsClaimButtons(st, fields);', '/* mutant: buttons never read back */', 'tiles')
  'btnsubset'      = @('if (f.btn !== ''all'') {', 'if (false) {', 'tiles')
  'btnone'         = @('else st[kind][col] = (kind === ''btn'' && f.btn !== ''all'') ? [k] : cur.concat([k]);', 'else st[kind][col] = cur.concat([k]);', 'tiles')
  'btnrest'        = @('st.rest = (st.rest || []).filter(function (r) { return drop.indexOf(condKey(r)) === -1; });', '/* mutant: the parts stay in the rest */', 'tiles')
  'btndedupe'      = @('if (!bseen[pk]) { bseen[pk] = true; parts.push(p); }', 'parts.push(p);', 'tiles')
  'btnconflict'    = @('if (!claim.rest.length && by) {', 'if (false) {', 'tiles')
  'patslash'       = @('if (body.indexOf(''/'') !== -1) return', 'if (false) return', 'tiles')
  'patbackref'     = @('if (/[1-9]/.test(body.charAt(i + 1))) return', 'if (false) return', 'tiles')
  'patlist'        = @('if (host.list) return { error:', 'if (false) return { error:', 'tiles')
  'patcount'       = @('else { c.sel[col] = []; c.pat[col] = [k]; }', 'else { c.pat[col] = fsOn(st, ''pat'', col).concat([k]); }', 'tiles')
  'btncountall'    = @('c.btn[col] = f.btn === ''all'' ? fsOn(st, ''btn'', col).filter(function (x) { return x !== k; }).concat([k]) : [k];', 'c.btn[col] = [k];', 'tiles')
  'authrender'     = @('(grp.pats || []).forEach(function (e) { html += fsAuthoredChip(''pat'', e, g.off, counts); });', '/* mutant: patterns not drawn */', 'tiles')
  'authothers'     = @('if (_pnbFsLib().authoredOthers(others, st, fields, col)) anyOther = true;', '/* mutant: value chips ignore patterns and buttons */', 'main')
  'patexin'        = @('var inF = cfields.map(function (g) { return String(g.col).toUpperCase() === col ? $.extend({}, g, { mode: ''in'' }) : g; });', 'var inF = cfields;', 'main')
  'authdom'        = @('return $.extend(_pnbFsLib().authoredFromDom(this), {', 'return $.extend({}, {', 'main')
  'authsync'       = @('$(this).find(''.pnb-fs-pat'').each(function (k) { $(this).attr(''aria-pressed'', gPat.indexOf(k) !== -1 ? ''true'' : ''false''); });', '/* mutant: a typed pattern presses nothing */', 'main')
  'authclick'      = @('if ($(this).is(''.pnb-fs-pat, .pnb-fs-btn'')) {', 'if (false) {', 'main')
  'authfold'       = @('$grp.find(''.pnb-fs-chip:not(.pnb-fs-pat)'').each(function (i) {', '$grp.find(''.pnb-fs-chip'').each(function (i) {', 'main')
  'authclear'      = @(' st.pat[cc] = []; st.btn[cc] = [];', '', 'main')
  'authoneoff'     = @('if (af.buttons && af.btn !== ''all'') $ag.find(''.pnb-fs-btn'').not(aChip).attr(''aria-pressed'', ''false'');', '/* mutant: the other button waits for the redraw */', 'main')
  'btnmissing'     = @('return !f.buttons && fsCols.indexOf(f.col) === -1;', 'return fsCols.indexOf(f.col) === -1;', 'main')
  'btncols'        = @('if (fsBtnBad.length && (masterRowData.length || fsCols.length > 1)) {', 'if (false) {', 'main')
  'onlyfilter'     = @('if (f.only) list = list.filter(function (e3) { return e3.on || (f.blank && e3.v === ''''); });', '/* mutant: only ignored */', 'main')
  'rowpat'         = @('+ _pnbFsLib().on(s, ''pat'', c).length', '+ 0', 'main')
}
if ($Mutant) {
  if (-not $mutants.ContainsKey($Mutant)) { throw "unknown mutant '$Mutant' (known: $(($mutants.Keys | Sort-Object) -join ', '))" }
  $mOld = $mutants[$Mutant][0]; $mNew = $mutants[$Mutant][1]; $mIn = $mutants[$Mutant][2]
  $mText = if ($mIn -eq 'tiles') { $tilesSrc } elseif ($mIn -eq 'css') { $cssSrc } else { $src }
  $mN = ([regex]::Matches($mText, [regex]::Escape($mOld))).Count
  if ($mN -ne 1) { throw "mutant '$Mutant' anchor found $mN times in $mIn, expected 1: $mOld" }
  if ($mIn -eq 'tiles') { $tilesSrc = $tilesSrc.Replace($mOld, $mNew) } elseif ($mIn -eq 'css') { $cssSrc = $cssSrc.Replace($mOld, $mNew) } else { $src = $src.Replace($mOld, $mNew) }
  Write-Host "      + MUTANT $Mutant ($mIn)"
}
[IO.File]::WriteAllText("$here\main.css", $cssSrc, $latin1)
[IO.File]::WriteAllText("$here\penumbra_tiles.js", $tilesSrc, $utf8)

# The server half of the range parity (section J): the corpus through the REAL
# php_apply_search_filter, written as window.RANGE for the page.
Write-Host "      penumbra_search.php (range parity): $SearchPhp"
$php = '\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
$rangeJs = & $php -n "$here\range_php.php" $SearchPhp "$here\range_corpus.json" 2>&1 | Out-String
if ($rangeJs -notmatch '^window\.RANGE = ') { throw "range_php.php failed: $rangeJs" }
[IO.File]::WriteAllText("$here\range_php.js", $rangeJs, $utf8)

# Export the closure-internal functions as the closure's FIRST statement.
# Function declarations hoist, so this works even if later init throws; the
# registry is a var assigned later, hence the getter; masterRowData is a `let`
# read only when setRows() is called, long after the closure body has run.
$hooks = @(
  'try { window.__FS = { parseArgs: _pnbFsParseArgs, state: _pnbFsState, compose: _pnbFsCompose,',
  '  enc: _pnbFsEncode, dec: _pnbFsDecode, groups: _pnbFsGroups, render: _pnbFsRender,',
  '  sync: _pnbSyncFilterStrips, syncLayout: penumbraSyncActiveLayout, cellText: _pnbFsCellText, colRef: _pnbFsColRef,',
  '  setRows: function (r) { masterRowData = r; }, renderA: renderReportSnippet,',
  '  engineB: resolveInfoboxSnippet, parseQ: parseAdvancedQuery, evalQ: evaluateParsedQuery,',
  '  names: function () { return PENUMBRA_SNIPPET_FN_NAMES; },',
  '  isActive: _pnbCommandIsActive, exec: executeChainStep, syncToggles: _pnbSyncToggles,',
  '  motion: function () { return _pnbMotion; }, busy: _pnbMotionBusy,',
  '  pivotLabels: function () { return currentPivotSettings ? buildAggDisplayLabels(currentPivotSettings.agg, currentPivotSettings.aggLabels || null) : []; } };',
  '} catch (e) { window.__FS_ERR = String(e); }'
) -join ' '
$inject  = $anchor + "`r`n    $hooks`r`n"
$patched = $src.Substring(0, $src.IndexOf($anchor)) + $inject + $src.Substring($src.IndexOf($anchor) + $anchor.Length)
[IO.File]::WriteAllText("$here\main_patched.js", $patched, $utf8)

Write-Host "[2/3] running harness in headless Edge ..."
$udd = Join-Path $here 'edgeprofile'
$dom = Join-Path $here 'dom.txt'
if (Test-Path $dom) { [IO.File]::Delete($dom) }
$url = 'file:///' + $here.Replace([char]92, [char]47) + '/harness.html'
$edgeArgs = @('--headless=new','--disable-gpu','--no-sandbox','--allow-file-access-from-files',"--user-data-dir=$udd",'--virtual-time-budget=60000','--dump-dom',$url)
Start-Process -FilePath $edge -Wait -NoNewWindow -RedirectStandardOutput $dom -ArgumentList $edgeArgs
$d = [IO.File]::ReadAllText($dom)
$i = $d.IndexOf('<pre id="out">'); $j = $d.IndexOf('</pre>', $i)
if ($i -lt 0) { throw "no <pre id=out> in dump (Edge produced $($d.Length) bytes)" }
$txt = [System.Net.WebUtility]::HtmlDecode($d.Substring($i + 14, $j - $i - 14))
if (-not $txt.StartsWith('RESULTS_JSON:')) { throw "harness did not finish: $($txt.Substring(0,[Math]::Min(400,$txt.Length)))" }
$parsed = $txt.Substring(13) | ConvertFrom-Json
[IO.File]::WriteAllText("$here\result.json", ($parsed | ConvertTo-Json -Depth 6))

Write-Host "[3/3] results"
if ($parsed.fatal) {
  $summary.Add("FATAL: $($parsed.fatal)")
  [IO.File]::WriteAllLines("$here\summary.txt", $summary)
  throw "FATAL: $($parsed.fatal)"
}
if ($parsed.pageErrors -and $parsed.pageErrors.Count) {
  $summary.Add("WARNING main.js init errors: $($parsed.pageErrors -join '; ')")
  Write-Warning "main.js init errors (may invalidate results): $($parsed.pageErrors -join '; ')"
}
$fail = 0
foreach ($r in $parsed.results) {
  if ($r.pass) { $summary.Add("  PASS  " + $r.name); Write-Host ("  PASS  " + $r.name) -ForegroundColor Green }
  else { $fail++; $summary.Add("  FAIL  " + $r.name); $summary.Add("        " + $r.detail); Write-Host ("  FAIL  " + $r.name) -ForegroundColor Red; Write-Host ("        " + $r.detail) -ForegroundColor DarkYellow }
}
$line = ("{0} assertions, {1} failed" -f $parsed.results.Count, $fail)
$summary.Add($line)
if ($Mutant) { $summary.Add("mutant: $Mutant") }
$summary.Add("main.js: $MainJs")
$summary.Add("penumbra_tiles.js: $TilesJs")
$summary.Add("penumbra_search.php: $SearchPhp")
[IO.File]::WriteAllLines("$here\summary.txt", $summary)
Write-Host $line
if ($fail -gt 0) { exit 1 }
