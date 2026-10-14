# =============================================================================
# CELLSEL SUITE (2026-10-09) - cell selection on the FLAT table
#
# Drag across cells for Sum / Average / Count / Min / Max in the status bar;
# Shift+click, Ctrl+click, Esc; Ctrl+C copies the block (TSV + HTML).
# js/penumbra_cellsel.js + css/penumbra_cellsel.css; main.js is NOT touched.
# Each scenario loads the REAL main.js and the REAL module (harness.html, the
# hiddencols fixture, ungrouped) and publishes named checks:
#   L-<scn>-<check>  must hold on the candidate (checks named sane* are harness
#                    sanity and must hold in --control too)
#   E-<scn>          no page errors
#   I-*              (full runs only) the include block lifted from the index.php under test
#                    and run by PHP with / without the files and the .off switch; the help entry; php -l
#
#   py -3 run.py                        candidate = LIVE js\main.js + module + stylesheet
#   py -3 run.py --stage DIR            a stage in the app layout (DIR\js\penumbra_cellsel.js,
#                                       DIR\css\penumbra_cellsel.css; main.js from DIR if there, else live)
#   py -3 run.py --control              live main.js and NO module: every non-sane L check goes RED
#   py -3 run.py --mutant NAME / --mutants
#   --scn a,b                           a subset of scenarios
# Headless Edge over CDP; stages into %TEMP%; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js']
SCN = [('boot', ''), ('drag', ''), ('inside', ''), ('filter', ''), ('shift', ''), ('hidcol', ''), ('search', ''),
       ('copy', ''), ('float', ''), ('crowd', ''), ('big', ''), ('off', '&cellsel=off'),
       ('gdrag', ''), ('gmerge', ''), ('gndrag', ''), ('pdrag', ''), ('pspan', ''), ('ptotal', ''), ('pclick', ''),
       ('keys', ''), ('kstale', ''), ('gkeys', ''), ('pkeys', ''),
       ('gsnap', ''), ('pdrill', ''),
       ('gprobe', ''), ('gnprobe', ''), ('pprobe', ''), ('pfprobe', '')]
PROBES = {'gprobe', 'gnprobe', 'pprobe', 'pfprobe'}   # DOM dumps (--dump), never in a default run
CHK = {
    'boot': ['api', 'noReadout', 'parse_money', 'parse_parens', 'parse_negDollar', 'parse_pct', 'parse_lead0', 'parse_text',
             'parse_year', 'parse_nbsp', 'statsMoney', 'statsAvgDec', 'statsMixedNoDollar', 'statsTextOnly', 'statsFloat',
             'statsNoNegZero'],
    'drag': ['count3', 'painted3', 'readout', 'inBar', 'sum', 'countVal', 'min', 'max', 'avg', 'outline', 'dragClassOff', 'noNativeSel',
             'block4', 'textCounted', 'oldGone'],
    'inside': ['noBlock', 'textSelKept', 'hashIgnored', 'linkIgnored'],
    'filter': ['sanePlainFilters', 'dragNoFilter', 'shiftNoFilter', 'shiftRect', 'ctrlNoFilter', 'ctrlAdds', 'ctrlLinkIgnored',
               'plainAfterFilters'],
    'shift': ['rect9', 'plainClears', 'fromNewAnchor', 'ctrlAnchors', 'shiftCtrlAdds', 'escClears'],
    'hidcol': ['skipHiddenCol', 'noHiddenTint'],
    'search': ['saneSearched', 'skipHiddenRows', 'keepOnBenign', 'clearOnSearch', 'clearOnRowMove', 'clearOnColHide'],
    'copy': ['prevented', 'twoLines', 'fiveCols', 'formulaGuard', 'leadZero', 'amountText', 'htmlTable', 'htmlTextFmt',
             'nativeWins', 'inputWins', 'noSelNoCopy', 'bbox', 'readoutKeeps', 'valueCopy'],
    'float': ['floats', 'floatSum'],
    'crowd': ['inBar', 'wideNone', 'prefixOrder', 'monotonic', 'allSteps', 'noOverflowWithRoom', 'minimal', 'sumCountStay',
              'userAtStep4', 'narrowSumCount', 'growRestores', 'refitOnContent', 'refitBack', 'clearRestores', 'idleNoFit',
              'nestFirst', 'nestCountStays', 'mainLifted', 'handBack'],
    'big': ['saneAll', 'bigCount', 'bigFast', 'bigCopy'],
    'off': ['saneOffNoApi'],
    'gdrag': ['saneTables', 'gCount3', 'gSum', 'gStaysInTable', 'gCtrlOther', 'gCopyTwoTables', 'gFootClears', 'gDragNoFilter', 'gClearOnRebuild'],
    # glsweep (2026-10-14): two groups drawn as ONE table (the List layout's selected outer group) are one grid
    'gmerge': ['saneTables', 'mDrag', 'mShift', 'mAll', 'mCopyOne'],
    'gndrag': ['saneNested', 'gnBlock'],
    'pdrag': ['saneKeys', 'pCount9', 'pSum', 'pCopy3x3', 'pOutline'],
    'pspan': ['saneRowspan', 'pSpanCount', 'pSpanOnce', 'pNoChevron', 'pStickyTint', 'pSkipsHiddenSummary'],
    'ptotal': ['pFootCount', 'pFootSum', 'pFootLabel', 'pBodyToFoot'],
    'pclick': ['pDragNoToggle', 'pClearOnCollapse', 'sanePlainToggles'],
    'keys': ['activeOnPress', 'noRingAfterClick', 'downMoves', 'oldTiGone', 'kbRing', 'rightMoves', 'shiftExtends', 'shiftRight',
             'plainClears', 'ctrlDownEdge', 'ctrlNotPage', 'revealed', 'ctrlHome', 'ctrlEnd', 'homeEnd', 'edgeStays', 'ctrlA',
             'escTwice', 'arrowsFreeWhenUnfocused', 'copyActive', 'tabStop', 'tabInto', 'shiftTabRests', 'mouseFocusStays',
             'noRingAfterMouse'],
    'kstale': ['freshAfterSearch'],
    'gkeys': ['gCross', 'gCrossBack', 'gShiftNoCross', 'gTabStop', 'gTabInto'],
    'pkeys': ['pLeftToLabels', 'pDownFromSpan', 'pUpIntoGroup', 'pCtrlEndFoot', 'pShiftUpFromFoot', 'pTabStop'],
    'gsnap': ['snapNowSum', 'saneBothShown', 'snapBothSum', 'snapCopyNow', 'snapBlock'],
    'pdrill': ['saneDrillOpen', 'saneDrillCols', 'drillTabStop', 'drillSum', 'drillReadoutOnTop', 'drillHashOut', 'drillNoHashInBlock',
               'escKeepsDialog', 'drillArrow', 'drillCtrlHomeSkipsHash', 'drillTabInto'],
    'gprobe': [], 'gnprobe': [], 'pprobe': [], 'pfprobe': [],
}
# In --control (no module) these may hold: they hold with or without the module
# because they assert an ABSENCE (noBlock etc.). Listed so the control report reads cleanly.
CONTROL_OK = {'L-inside-noBlock', 'L-inside-textSelKept', 'L-inside-hashIgnored', 'L-inside-linkIgnored',
              'L-filter-ctrlLinkIgnored', 'L-filter-plainAfterFilters', 'L-boot-noReadout', 'L-copy-nativeWins',
              'L-copy-inputWins', 'L-copy-noSelNoCopy', 'L-drag-dragClassOff', 'L-search-saneSearched',
              'L-drag-noNativeSel', 'L-drag-oldGone', 'L-hidcol-noHiddenTint', 'L-gdrag-gFootClears',
              'L-keys-noRingAfterClick', 'L-keys-arrowsFreeWhenUnfocused', 'L-keys-noRingAfterMouse', 'L-pdrill-drillHashOut',
              # 2026-10-12 csfit: absences / prefix facts that also hold with no readout at all
              'L-crowd-prefixOrder', 'L-crowd-monotonic', 'L-crowd-minimal', 'L-crowd-idleNoFit',
              'L-crowd-userAtStep4', 'L-crowd-narrowSumCount', 'L-crowd-refitBack',
              'L-crowd-handBack'}   # csfit2: with no module main.js's own collapse holds it
# (L-drag-outline is red in control: no module, no classes)
MUTANTS = {
    # glsweep: a table drawn as one with others keeps its own grid - a drag stops at its edge
    'csmerge': ([('mod', "    function tableOf(td) { var T = td.closest('table'), ms = mergedOf(T); return ms ? ms[0] : T; }", "    function tableOf(td) { return td.closest('table'); }")],
                ['L-gmerge-mDrag', 'L-gmerge-mAll'], ['gmerge']),
    # the click that ends a drag / a Shift or Ctrl click is no longer swallowed: it filters
    'noswallow': ([('mod', "        if (!swallow) { return; }\n", "        if (true) { return; }\n")],
                  ['L-filter-dragNoFilter', 'L-filter-shiftNoFilter', 'L-filter-ctrlNoFilter'], ['filter']),
    # rows a search hides take part
    'hiddenrows': ([('mod', "        return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && tr.getClientRects().length > 0;\n", "        return true;\n")],
                   ['L-search-skipHiddenRows'], ['search']),
    # hidden columns take part
    'hiddencols': ([('mod', "        if (!p || td.style.display === 'none' || td.getAttribute('data-column') === '#') { return false; }\n",
                     "        if (!p || td.getAttribute('data-column') === '#') { return false; }\n")],
                   ['L-hidcol-skipHiddenCol'], ['hidcol']),
    # nothing clears a stale selection
    'noobserver': ([('mod', "        if (typeof MutationObserver !== 'function') { return; }\n        if (!observer) {", "        return;\n        if (!observer) {")],
                   ['L-search-clearOnSearch', 'L-search-clearOnRowMove', 'L-search-clearOnColHide'], ['search']),
    # every row / heading attribute change clears it (a journal badge would)
    'benignclear': ([('mod', "    function hiddenBy(el, attr, old) {\n", "    function hiddenBy(el, attr, old) {\n        return true;\n")],
                    ['L-search-keepOnBenign'], ['search']),
    # the TSV copy skips the export's formula guard
    'noguard': ([('mod', "        if (P && typeof P.escapeCsvCell === 'function') { return P.escapeCsvCell(text, '\\t'); }\n        var s = String(text);\n",
                  "        return String(text);\n        var s = String(text);\n")],
                ['L-copy-formulaGuard'], ['copy']),
    # 00123 sums as a number
    'lead0': ([('mod', "        if (/^0\\d/.test(t)) { return null; }   // 00123 is an identifier, not a number\n", "")],
              ['L-boot-parse_lead0'], ['boot']),
    # a drag inside one cell starts a block (kills the text selection)
    'noinside': ([('mod', "            if (td === drag.td) { return; }   // still inside the first cell: text selection\n", "")],
                 ['L-inside-textSelKept'], ['inside']),
    # no outline (the edge classes never set)
    'nooutline': ([('mod', "            cl.toggle(EDGES[0], !neighbour(g, next, p.r - 1, p.c, p.c1, -1));\n", "")],
                  ['L-drag-outline'], ['drag']),
    # round 2: row spans ignored (every cell one row tall): the rows under a pivot label misalign
    'norowspan': ([('mod', "                    var rs = Math.max(1, Math.min(td.rowSpan || 1, rows.length - r)), cs = Math.max(1, td.colSpan || 1);\n",
                    "                    var rs = 1, cs = Math.max(1, td.colSpan || 1);\n")],
                  ['L-pspan-pSpanCount', 'L-pspan-pSpanOnce'], ['pspan']),
    # round 2: column spans ignored: the Grand Total row's cells sit one column left of the body's
    'nocolspan': ([('mod', "                    var rs = Math.max(1, Math.min(td.rowSpan || 1, rows.length - r)), cs = Math.max(1, td.colSpan || 1);\n",
                    "                    var rs = Math.max(1, Math.min(td.rowSpan || 1, rows.length - r)), cs = 1;\n")],
                  ['L-ptotal-pBodyToFoot'], ['ptotal']),
    # round 2: the pivot's Grand Total row left out
    'nopivotfoot': ([('mod', "        if (isPivot(T) && T.tFoot) { out.push(T.tFoot); }\n", "")],
                    ['L-ptotal-pFootCount', 'L-ptotal-pBodyToFoot'], ['ptotal']),
    # round 2: the grouped view's tables not taken
    'nogroups': ([('mod', "        return !!(p && p.classList && p.classList.contains('group-content') && T.closest('#groupedResultsContainer'));\n", "        return false;\n")],
                 ['L-gdrag-gCount3', 'L-gndrag-gnBlock'], ['gdrag', 'gndrag']),
    # round 2: a pivot label's chevron copied with its text
    'chevron': ([('mod', "    var NOT_TEXT = '.pivot-collapse-toggle, .pnb-sum-badge, .sort-icon, .journal-pvnote-btn';\n", "    var NOT_TEXT = '.pnb-sum-badge';\n")],
                ['L-pspan-pNoChevron'], ['pspan']),
    # round 2: the pivot's last frozen column keeps only its separator (no tint)
    'nostickytint': ([('css', "#pivotResultTable td.pnb-csel.pivot-last-sticky {", "#pivotResultTable td.pnb-csel.pivot-last-sticky.zz-never {")],
                     ['L-pspan-pStickyTint'], ['pspan']),
    # round 3: no arrow keys
    'nokeys': ([('mod', "    var ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };\n", "    var ARROWS = {};\n")],
               ['L-keys-downMoves', 'L-keys-shiftExtends', 'L-pkeys-pDownFromSpan'], ['keys', 'pkeys']),
    # round 3: a key we act on also reaches main.js's page-wide hotkeys (Ctrl+Down = page bottom)
    'nostop': ([('mod', "    function take(e) { e.preventDefault(); e.stopPropagation(); markKb(); }\n", "    function take(e) { e.preventDefault(); markKb(); }\n")],
               ['L-keys-ctrlNotPage'], ['keys']),
    # round 3: a mouse press on a heading pulls the focus into a cell
    'pointerjump': ([('mod', "        if (pointerFocus) { return; }\n", "")],
                    ['L-keys-mouseFocusStays'], ['keys']),
    # round 3: the grouped view's arrows stop at a group's edge
    'nocross': ([('mod', "        var box = td.closest('#groupedResultsContainer');\n", "        var box = null;\n")],
                ['L-gkeys-gCross'], ['gkeys']),
    # round 3: a grid cached with nothing watching is trusted after a search
    'stalegrid': ([('mod', "        if (!observer) { grids = new Map(); }\n        var mod = e.ctrlKey", "        var mod = e.ctrlKey")],
                  ['L-kstale-freshAfterSearch'], ['kstale']),
    # round 3: Ctrl+C with no block copies nothing
    'nosinglecopy': ([('mod', "        var only = rects.length ? null : activeOnly();\n", "        var only = null;\n")],
                     ['L-keys-copyActive'], ['keys']),
    # round 3: Shift+Tab out of a cell is pulled straight back in (a focus trap)
    'shifttabtrap': ([('mod', "        if (e.relatedTarget && el.contains(e.relatedTarget)) { return; }\n", "")],
                     ['L-keys-shiftTabRests'], ['keys']),
    # round 4: a comparison's changed cell read as its whole text ("[was:] 5 [now:] 10" under Show both)
    'snapwas': ([('mod', "        if (now) { td = now; }\n", "")],
                ['L-gsnap-snapBothSum', 'L-gsnap-snapCopyNow'], ['gsnap']),
    # round 4: breakdown tables not taken
    'nodrill': ([('mod', "        if (T.classList.contains('infobox-drill-table')) { return true; }\n", "")],
                ['L-pdrill-drillSum', 'L-pdrill-drillArrow'], ['pdrill']),
    # round 4: a breakdown's '#' column (no data-column) taken as data
    'drillhash': ([('mod', "        if (g.hash[p.c] && p.c1 === p.c) { return false; }   // a '#' column without the attribute (a breakdown's)\n", "")],
                  ['L-pdrill-drillHashOut', 'L-pdrill-drillCtrlHomeSkipsHash'], ['pdrill']),
    # round 4: the readout stays in the status bar, behind the dialog's backdrop
    'drillbar': ([('mod', "        var inBar = barDrawn() && !overlayOf(T);\n", "        var inBar = barDrawn();\n")],
                 ['L-pdrill-drillReadoutOnTop'], ['pdrill']),
    # round 4: the Esc that clears a block also closes the dialog
    'escleaks': ([('mod', "            if (rects.length) { clear(); e.preventDefault(); e.stopPropagation(); return; }\n", "            if (rects.length) { clear(); return; }\n")],
                 ['L-pdrill-escKeepsDialog'], ['pdrill']),
    # round 4: no Tab stop on a breakdown table
    'nodrillstop': ([('mod', "        }).observe(document.body, { childList: true });\n", "        });\n")],
                    ['L-pdrill-drillTabStop', 'L-pdrill-drillTabInto'], ['pdrill']),
    # round 2: a re-render of the grouped view leaves a stale selection
    'nobox': ([('mod', "            [T, box].forEach(", "            [T].forEach(")],
              ['L-gdrag-gClearOnRebuild'], ['gdrag']),
    # the readout lands outside the status bar
    'nobar': ([('mod', "        var inBar = barDrawn() && !overlayOf(T);\n", "        var inBar = false;\n")],
              ['L-drag-inBar'], ['drag']),
    # a press on the readout clears the selection
    'readoutclears': ([('mod', "        if (seg && seg.contains(t)) { return; }\n", "")],
                      ['L-copy-readoutKeeps'], ['copy']),
    # 2026-10-12 csfit: the bar never makes room - the readout runs off the edge
    'nofit': ([('mod', "        for (var j = 0; j < FIT.length && barShort(sb); j++) { sb.classList.add(FIT[j]); }\n", "")],
              ['L-crowd-noOverflowWithRoom', 'L-crowd-allSteps'], ['crowd']),
    # every step at once (not one at a time, only as far as needed)
    'allatonce': ([('mod', "        for (var j = 0; j < FIT.length && barShort(sb); j++) { sb.classList.add(FIT[j]); }\n",
                   "        if (barShort(sb)) { for (var j = 0; j < FIT.length; j++) { sb.classList.add(FIT[j]); } }\n")],
                  ['L-crowd-minimal', 'L-crowd-allSteps'], ['crowd']),
    # the steps in another order (Min + Max before the profile cell)
    'order': ([('mod', "'pnb-csel-fit-user', 'pnb-csel-fit-minmax',", "'pnb-csel-fit-minmax', 'pnb-csel-fit-user',")],
              ['L-crowd-prefixOrder', 'L-crowd-minimal'], ['crowd']),
    # no re-fit on a resize / a segment changing size
    'noresize': ([('mod', "        if (!fitRO && typeof ResizeObserver === 'function') {", "        if (false) {")],
                 ['L-crowd-noOverflowWithRoom', 'L-crowd-allSteps'], ['crowd']),
    # no re-fit when a collapsed segment's text changes (its box stays the same size)
    'notext': ([('mod', "        if (!fitMO && typeof MutationObserver === 'function') {", "        if (false) {")],
               ['L-crowd-refitBack'], ['crowd']),
    # a cleared selection leaves the steps on
    'clearkeeps': ([('mod', "        if (seg) { seg.hidden = true; fitBar(); }\n", "        if (seg) { seg.hidden = true; }\n")],
                   ['L-crowd-clearRestores'], ['crowd']),
    # the profile cell is never hidden (the CSS step missing)
    'nousercss': ([('css', "#pnbStatusBar.pnb-csel-fit-user #sbUserSeg { display: none !important; }", "#pnbStatusBar.pnb-csel-fit-user #sbUserSeg { }")],
                  ['L-crowd-userAtStep4'], ['crowd']),
    # csfit2: the "no nesting" chip is not the first step (its CSS missing)
    'nonest': ([('css', "#pnbStatusBar.pnb-csel-fit-nest #sbNested.sb-off { display: none !important; }", "")],
               ['L-crowd-nestFirst'], ['crowd']),
    # main.js's Data / Load collapse left on during a selection (it goes before the chip)
    'keepmain': ([('mod', "        sb.classList.remove(MAIN[0], MAIN[1]);\n", "")],
                 ['L-crowd-mainLifted', 'L-crowd-nestFirst'], ['crowd']),
    # nothing handed back on clear: a crowded bar pushes the profile cell off again
    'nohandback': ([('mod', "            if (fitOwns) { fitOwns = false; handBack(sb); }\n", "")],
                   ['L-crowd-handBack'], ['crowd']),
    # a real "3 nested" count hidden too
    'nestcount': ([('css', "#pnbStatusBar.pnb-csel-fit-nest #sbNested.sb-off {", "#pnbStatusBar.pnb-csel-fit-nest #sbNested {")],
                  ['L-crowd-nestCountStays'], ['crowd']),
}

args = sys.argv[1:]
def opt(name, default=None):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
def flag(name):
    if name in args: args.remove(name); return True
    return False
stage_dir = opt('--stage', None)
scn_arg = opt('--scn', None)
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
verbose = flag('--verbose')
dump = flag('--dump')
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
cand = {'main': pick(os.path.join('js', 'main.js')),
        'mod': os.path.join(src_root, 'js', 'penumbra_cellsel.js'),
        'css': os.path.join(src_root, 'css', 'penumbra_cellsel.css')}

def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')
def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    names = ['runTableSearch']
    h = ('\r\n;try { window.__HC = {}; } catch (e) { window.__HC_ERR = String(e); }\r\n'
         'try { [' + ','.join('"%s"' % n for n in names) + '].forEach(function (k) { try { window.__HC[k] = eval(k); } catch (e) { (window.__HC_MISSING = window.__HC_MISSING || []).push(k); } }); } catch (e) { window.__HC_ERR2 = String(e); }\r\n')
    out = src[:i] + ';(function () {' + h + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {\r\n'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;\r\n')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cs_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
shutil.copyfile(os.path.join(APP, 'css', 'main.css'), os.path.join(stage, 'main.css'))
shutil.copyfile(os.path.join(APP, 'css', 'density.css'), os.path.join(stage, 'density.css'))
shutil.copyfile(os.path.join(APP, 'css', 'penumbra_colwidths.css'), os.path.join(stage, 'penumbra_colwidths.css'))
shutil.copyfile(os.path.join(APP, 'js', 'penumbra_colwidths.js'), os.path.join(stage, 'penumbra_colwidths.js'))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
for f in ('harness.html', 'driver.js'): shutil.copyfile(os.path.join(HERE, f), os.path.join(stage, f))
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
hp, dp = free_port(), free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(hp), '--bind', '127.0.0.1', '--directory', stage], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
edge = subprocess.Popen([EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-sync',
                         '--disable-extensions', '--user-data-dir=' + os.path.join(stage, 'p'), '--window-size=1500,900',
                         '--remote-debugging-port=%d' % dp, '--remote-allow-origins=*', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def jget(p, m='GET'):
    return json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d%s' % (dp, p), method=m), timeout=15).read().decode())
for _ in range(150):
    try: jget('/json/version'); break
    except Exception: time.sleep(0.2)

def run_page(scn, extra):
    t = jget('/json/new?about:blank', 'PUT')
    ws = websocket.create_connection(t['webSocketDebuggerUrl'], timeout=300, suppress_origin=True)
    n = [0]
    def call(m, p=None):
        n[0] += 1; mid = n[0]
        ws.send(json.dumps({'id': mid, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == mid: return r.get('result', {})
    try:
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        # round 3: a background headless page moves document.activeElement on focus()
        # but fires no focus / focusin events - the Tab-stop handler needs them
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/harness.html?scn=%s%s' % (hp, scn, extra)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v: return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def run_build(texts, scns):
    open(os.path.join(stage, 'main_hc.js'), 'wb').write(hook(texts['main']).encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_cellsel.js'), 'wb').write(texts['mod'].encode('utf-8', 'surrogateescape'))
    open(os.path.join(stage, 'penumbra_cellsel.css'), 'wb').write(texts['css'].encode('utf-8', 'surrogateescape'))
    out = {}
    for s, x in SCN:
        if s not in scns: continue
        r = run_page(s, x)
        if r.get('fatal') and 'never finished loading' in r['fatal']:
            r = run_page(s, x); r['retried'] = True
        out[s] = r
    return out

def evaluate(res, scns):
    out = []
    add = lambda aid, ok, d: out.append((aid, bool(ok), d))
    for s in scns:
        r = res.get(s, {})
        if r.get('fatal'):
            add('F-' + s, False, (r.get('fatal') or '')[:400]); continue
        add('E-' + s, not r.get('errors') and not r.get('hookErr') and not r.get('missing'),
            'errors %s %s %s' % (r.get('errors'), r.get('hookErr'), r.get('missing')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            add('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:330]) if v is not True else ''))
    return out

# --- the index.php + help half (no browser) --------------------------------------
# The include block LIFTED from the index.php under test, run by PHP in a temp folder:
# both files present -> the link + the deferred script (cache-busted); an empty
# js/penumbra_cellsel.off -> nothing (the rollback switch); a missing file -> nothing.
PHP = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\php.exe'
def index_half():
    import re
    out = []
    add = lambda aid, ok, d='': out.append((aid, bool(ok), d))
    idx_p, help_p = pick('index.php'), pick('help_content.php')
    idx = read_b(idx_p)
    m = re.search(r'(?s)<\?php /\* AFTER main\.js: cell selection on the flat table.*?<\?php endif; \?>', idx)
    add('I-block', m is not None, idx_p)
    if m:
        tmp = tempfile.mkdtemp(prefix='pnb_csi_')
        os.makedirs(os.path.join(tmp, 'js')); os.makedirs(os.path.join(tmp, 'css'))
        open(os.path.join(tmp, 't.php'), 'w', encoding='utf-8', newline='').write(m.group(0))
        jsf, cssf, offf = os.path.join(tmp, 'js', 'penumbra_cellsel.js'), os.path.join(tmp, 'css', 'penumbra_cellsel.css'), os.path.join(tmp, 'js', 'penumbra_cellsel.off')
        open(jsf, 'w').write('/* x */'); open(cssf, 'w').write('/* x */')
        runphp = lambda: subprocess.run([PHP, '-n', os.path.join(tmp, 't.php')], cwd=tmp, capture_output=True, text=True).stdout
        on = runphp()
        open(offf, 'w').write(''); off = runphp(); os.remove(offf)
        os.remove(cssf); half = runphp()
        shutil.rmtree(tmp, ignore_errors=True)
        add('I-on', '<link rel="stylesheet" href="css/penumbra_cellsel.css?v=' in on and re.search(r'<script defer src="js/penumbra_cellsel\.js\?v=\d{9,}"></script>', on), on.strip().replace('\n', ' | '))
        add('I-off', off.strip() == '', 'output=[%s]' % off.strip())
        add('I-missing', half.strip() == '' and 'Warning' not in half, 'output=[%s]' % half.strip())
        # after main.js and after the column-width tool, as the module expects
        add('I-order', idx.find('js/penumbra_cellsel.js') > idx.find('js/main.js?v=') > 0 and idx.find('js/penumbra_cellsel.js') > idx.find('js/penumbra_colwidths.js'), '')
    hp = read_b(help_p)
    add('I-help', '<li id="us-cellsel">' in hp and '<kbd>Ctrl</kbd>+<kbd>C</kbd>' in hp and hp.find('id="us-cellsel"') > hp.find('id="us-colwidths"'), help_p)
    for f in (idx_p, help_p):
        r = subprocess.run([PHP, '-n', '-l', f], capture_output=True, text=True).stdout
        add('I-lint-' + os.path.basename(f), 'No syntax errors' in r, r.strip())
    return out

try:
    names = [s for s, _ in SCN if s not in PROBES]
    if scn_arg: names = [s for s, _ in SCN if s in scn_arg.split(',')]
    texts = {k: read_b(v) for k, v in cand.items()}
    if control:
        texts['mod'] = '/* --control: no module */\n'; texts['css'] = '/* --control: no module */\n'
        print('CONTROL: %s and NO module' % cand['main'])
    else:
        print('candidate: %s (main.js %s)' % (src_root, cand['main']))
    if dump:
        res = run_build(texts, names)
        for k in names: print('=== %s' % k); print(json.dumps(res[k], indent=1)[:20000])
    elif all_mutants or one_mutant:
        ok = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            res = evaluate(run_build(mutate(texts, m), scns), scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            ok += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
            if verbose:
                for a, p, d in res:
                    if not p: print('        %-30s %s' % (a, d[:300]))
        print('SUMMARY mutants ok=%d bad=%d' % (ok, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    elif control:
        res = evaluate(run_build(texts, names), names)
        # every non-sane, non-absence L check must be red; sane ones and E- must be green
        wrong = []
        for a, passed, d in res:
            sane = '-sane' in a or a.startswith('E-') or a in CONTROL_OK
            expect = True if sane else False
            if a == 'L-off-saneOffNoApi': expect = True
            flag_ = 'ok ' if passed == expect else 'BAD'
            if passed != expect: wrong.append(a)
            print('  %s  %-32s %s  %s' % (flag_, a, 'pass' if passed else 'fail', d[:200] if passed != expect else ''))
        print('CONTROL wrong=%d   %s' % (len(wrong), ' '.join(wrong)))
        print('RESULT: GREEN' if not wrong else 'RESULT: RED')
    else:
        res = evaluate(run_build(texts, names), names)
        if not scn_arg: res = index_half() + res
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-32s %s' % ('PASS' if passed else 'FAIL', a, d[:420]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
