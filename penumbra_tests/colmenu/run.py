# =============================================================================
# COLMENU SUITE (2026-10-16) - the table header's right-click menu
# (js/penumbra_colmenu.js + css/penumbra_colmenu.css + main.js window.Penumbra.headerMenu,
# penumbra_calc.js openDialog(name, {seed, onAdded}), penumbra_colwidths.js fit/resetAll).
#   page half   harness.html (mk_harness.py, from colopt's) + driver.js: the REAL main.js,
#               column options, calculated column and column width modules
#                                                                   L-<scn>-<check>, E-<scn>
#   static      index.php loads the module behind its .off switch; the help names it  S-*
# --control runs LIVE (no module: EMPTY files): every NEW check red there, every other
# one green (they describe what live already does: a cell's menu is the browser's).
#
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_cm_*; writes nothing to the webroot.
# =============================================================================
import json, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js',
        'penumbra_a11y.js', 'penumbra_grouplist.js', 'penumbra_cellsel.js']
SCN = ['mflat', 'mkbd', 'mopts', 'mcalc', 'mgroupby', 'gmenu', 'mrestr', 'mexcl', 'mcopy', 'mjournal', 'mmore', 'mfitnest', 'mcell', 'mload', 'mreset', 'msubs', 'mbucket', 'mnum']
CHK = {
    'mflat': ['opens', 'prevented', 'titleName', 'statsLine', 'statsAllUnique', 'statsTop', 'statsEmpty', 'statsToggle', 'statsNotes', 'statsFiltered', 'itemsAll', 'sortAsc', 'sortChecked', 'sortDesc', 'sortClear', 'moveRight', 'moveMinimal', 'cellsFollow', 'saved',
              'toastUndo', 'noSavedToast', 'undo', 'edgeDisabled', 'moveStart', 'moveEnd', 'tipNotEarly', 'tipThird', 'tipStored', 'tipOnce',
              'tipOpens', 'hide', 'hideSaved', 'skipHidden', 'showList', 'showHere', 'showFilled', 'swapList', 'swapDone', 'multiMove', 'lastNotHidable'],
    'mkbd': ['opensBelow', 'focusFirst', 'arrowMoves', 'enterRuns', 'focusBack', 'escCloses', 'escFocusBack', 'outsideCloses'],
    'mopts': ['optsPopover', 'optsTitle', 'optsNoFreeze', 'optsOpener', 'optsCloses', 'optsBack', 'freezeItem', 'freezes', 'unfreezeItem', 'unfreezes',
              'noFreezePast5', 'fitItem', 'fits', 'fitUndo', 'fitUndone', 'fitAll', 'fitAllUndo', 'resetItem', 'resets', 'fitsLong', 'fitsLongCut', 'fitCapped'],
    'mcalc': ['dialog', 'seeded', 'placedRight', 'placeSaved', 'calcRemoveItem', 'calcRemoved', 'calcStart'],
    'mgroupby': ['uniqueAsks', 'groupItem', 'grouped', 'uniqueQuiet'],   # uniqueAsks / uniqueQuiet 2026-10-19 (grpunique): an all-different column asks first
    'gmenu': ['opens', 'noFreeze', 'cellGroup', 'groupItems', 'sortsGroups', 'fitGroup', 'moveAll', 'groupsKept', 'hideAll', 'regroup', 'ungroup'],
    'mrestr': ['sortOnly', 'noLayout'],
    'mexcl': ['cellNative', 'numMenu', 'compareNative'],
    'mcell': ['cellOpens', 'cellFilter', 'cellAdd', 'cellExclude', 'cellCopy', 'cellRaw', 'cellBlank', 'cellNatives', 'cellKbd'],
    'msubs': ['topOrder', 'noChips', 'arrows', 'showLabel', 'moveList', 'flyPos', 'nested', 'hoverSwitch', 'showList', 'hoverCloses', 'hoverOpens', 'calcList',
              'copyList', 'resetList', 'clearPanel', 'kbdOpens', 'kbdBack', 'escAll', 'outsideAll'],
    'mreset': ['raItem', 'raOffClean', 'raOnCustom', 'raLayout', 'raCells', 'raPref', 'raFmt', 'raShade', 'raSum', 'raWidth', 'raFreeze', 'raToast',
               'raOffAfter', 'unLayout', 'unCells', 'unFmt', 'unShade', 'unSum', 'unWidth', 'unFreeze', 'unFmtOnly'],
    'mbucket': ['bkModes', 'bkList', 'bkValues', 'bkApply', 'bkReopen', 'bkGap', 'bkOpenEnd', 'bkClear', 'bkText', 'dtModes', 'dtList', 'dtUnits', 'dtApply', 'dtClear'],
    'mnum': ['numOpens', 'numItems', 'numResets', 'numSort', 'numHide', 'numShowItem', 'numShown', 'numCell'],
    'mload': ['idSame', 'idFast', 'idFallback', 'idDynamic', 'edExists', 'edHiddenSkip', 'edShownRefresh', 'edShownNow', 'edShownOnce'],
    'mfitnest': ['nestGrow', 'nestCompact', 'fitLines'],
    'mjournal': ['jrnPainted', 'jrnNotesCell', 'jrnAddNote', 'jrnInNote', 'jrnMoves', 'jrnStaysUnsaved', 'jrnSwap', 'jrnSaved'],
    'mmore': ['thenItems', 'thenSort', 'filterList', 'filterApply', 'filterReopen', 'filterBack', 'filterEsc', 'filterClear', 'filterBlank',
              'only', 'showAll', 'resetCol', 'copyName'],
    'mcopy': ['copyItem', 'copySubmenu', 'copyComma', 'copyNewline', 'copyTab', 'copyFiltered', 'copyKeeps', 'copyOther'],
    # (not in SCN) the menu left open for a picture: PNB_SHOT=<png> py -3 run.py --stage DIR --scn mshot
    'mshot': ['open'],
    # (not in SCN) a big report's move, timed / profiled: --scn mperf [PNB_PROFILE=<json>] [PNB_ROWS=N]
    'mperf': ['done'],
    'mrerun': ['done'],
}
# what this change brings: everything but the checks of what live already does
GUARDS = {'L-mexcl-cellNative', 'L-mexcl-numMenu', 'L-mexcl-compareNative', 'L-mshot-open', 'L-mperf-done', 'L-mrerun-done'}
NEW_R1 = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]} - GUARDS | {'S-indexLoads', 'S-helpNamed'}
# round 2 (2026-10-16): the counts under the name, the measuring Fit
NEW_R2 = {'L-mflat-statsLine', 'L-mflat-statsEmpty', 'L-mflat-statsFiltered', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup', 'S-helpFit'}
# round 3 (2026-10-16): Fit's cap, journal counts, Copy distinct values
NEW = {'L-mopts-fitCapped', 'L-mflat-statsToggle', 'L-mflat-statsNotes', 'S-helpCopy'} | {'L-mcopy-' + c for c in CHK['mcopy']}
# round 4 (same deploy): "all unique" / "none empty" (statsLine and statsFiltered read the new words), Swap...
NEW_R34 = NEW | {'L-mflat-statsAllUnique', 'L-mflat-statsLine', 'L-mflat-statsFiltered', 'L-mflat-swapList', 'L-mflat-swapDone', 'S-helpSwap'}
# round 5 (2026-10-16): journal columns a fixed block; the popover's Back
NEW_R5 = {'L-mopts-optsBack', 'S-helpBack'}
# round 6 (2026-10-16): journal columns movable (mjournal rewritten), the eight new items
NEW_R6 = {'S-helpBack', 'S-helpMore'} | {'L-mjournal-' + c for c in CHK['mjournal']} | {'L-mmore-' + c for c in CHK['mmore']}
# round 7 (2026-10-16): Fit measures nested sub-tables and multi-line cells as they lay out
NEW_R7 = {'L-mfitnest-' + c for c in CHK['mfitnest']}
# round 8 (2026-10-17): the cell menu
NEW_R8 = {'L-mcell-' + c for c in CHK['mcell']} | {'L-gmenu-cellGroup', 'S-helpCells'}
# round 9 (2026-10-17, perf): a move touches only the moved cells (multiMove is a guard: the
# old full pass got it right too, just slowly)
NEW_R9 = {'L-mflat-moveMinimal'}
# round 10 (2026-10-17, load perf): id lists found by id; a hidden editor refreshed when shown
# (idSame, idFallback, idDynamic, edExists, edShownNow are guards: live gets them right too)
NEW_R10 = {'L-mload-idFast', 'L-mload-edHiddenSkip', 'L-mload-edShownRefresh', 'L-mload-edShownOnce'}
# round 11 (2026-10-17): Reset all columns - every mreset check is new (live has no item),
# plus the help rows
NEW_R11 = {'L-mreset-' + c for c in CHK['mreset']} | {'S-helpResetAll'}
# round 12 (2026-10-17): the menu reorganized (mockup B) - the lists under one item; the
# checks of the old top level that changed shape come along (itemsAll, showList, copySubmenu)
NEW_R12 = {'L-msubs-' + c for c in CHK['msubs']} | {'S-helpSubs', 'L-mflat-itemsAll', 'L-mflat-showList', 'L-mflat-showHere', 'L-mflat-showFilled', 'L-mcopy-copySubmenu',
       'S-helpResetAll', 'S-helpMore', 'S-helpSwap', 'S-helpCopy'}
# round 13 (2026-10-17): the lists open BESIDE their item (hover, click, ArrowRight), no Back;
# Column stats and Pivot / Chart left out; Copy distinct values named again. The checks that
# read a list (showList, swapList, copy*) and the top level (itemsAll) change shape with it.
NEW_R13 = {'L-msubs-' + c for c in CHK['msubs']} | {'L-mflat-itemsAll', 'L-mflat-showList', 'L-mflat-swapList', 'L-mcopy-copyItem', 'L-mcopy-copySubmenu', 'L-mmore-copyName',
       'S-helpMore', 'S-helpCopy', 'S-helpStats'}
# round 16 (2026-10-17): Filter by value's Ranges for a number column (bkText is a guard: live has no modes either)
NEW_R16 = {'L-mbucket-' + c for c in CHK['mbucket']} - {'L-mbucket-bkText'} | {'S-helpRanges'}
# round 19 (2026-10-18): Fit's Undo, Fit all column widths, date Ranges
NEW_R19 = {'L-mopts-fitUndo', 'L-mopts-fitUndone', 'L-mopts-fitAll', 'L-mopts-fitAllUndo', 'L-mbucket-dtModes', 'L-mbucket-dtList', 'L-mbucket-dtApply', 'L-mbucket-dtClear', 'S-helpFitAll'}
# round 20 (2026-10-18): the '#' menu, journal cells, Add a note to this row, date units
NEW_R20 = {'L-mnum-' + c for c in CHK['mnum']} | {'L-mjournal-jrnNotesCell', 'L-mjournal-jrnAddNote', 'L-mbucket-dtUnits', 'S-helpNum', 'L-mexcl-numMenu', 'L-mcell-cellNatives'}
# round 21 (2026-10-18): Column stats as a list beside the item (the stats checks change shape), the
# notes button's inside, Remove this calculated column
NEW = {'L-mflat-statsLine', 'L-mflat-statsAllUnique', 'L-mflat-statsTop', 'L-mflat-statsToggle', 'L-mflat-statsNotes', 'L-mflat-statsFiltered',
       'L-mjournal-jrnInNote', 'L-mcalc-calcRemoveItem', 'L-mcalc-calcRemoved', 'S-helpStats', 'L-msubs-topOrder',
       'L-mgroupby-uniqueAsks'}   # (2026-10-19, grpunique) live groups an all-different column without asking; uniqueQuiet holds there too
MUTANTS = {
    # (2026-10-19, grpunique) main.js (CRLF): the all-different column no longer asks
    'm-grpunique': ([('main', "            if (!window.confirm('Every row has a different ' + selectedColumn + ', so grouping by it makes one group per row and summarises nothing.\\n\\nGroup by it anyway?')) return;\r\n", "")],
                    ['L-mgroupby-uniqueAsks'], ['mgroupby']),
    # --- the module
    'j-menu': ([('menu', "        if (!th || !api()) { return; }\n        e.preventDefault();", "        if (!th || !api() || true) { return; }\n        e.preventDefault();")],
               ['L-mflat-opens', 'L-mflat-prevented'], ['mflat']),
    'j-skiphidden': ([('menu', "            for (j = i - 1; j >= 0; j--) { if (movable(cols[j])) { return j; } }", "            if (i > 0) { return i - 1; }")],
                     ['L-mflat-skipHidden'], ['mflat']),
    'j-tiponce': ([('menu', "        if (isMove && moves > 2 && !tipSeen()) {\n            markTipSeen();", "        if (isMove && moves > 2) {")],
                  ['L-mflat-tipOnce', 'L-mflat-tipStored'], ['mflat']),
    'j-tipearly': ([('menu', "moves > 2 && !tipSeen()", "moves > 1 && !tipSeen()")], ['L-mflat-tipNotEarly'], ['mflat']),
    'j-grouped': ([('menu', "        return (g && th.closest('thead')) ? th : null;", "        return null;")], ['L-gmenu-opens'], ['gmenu']),
    'j-restrict': ([('menu', "        var restricted = A.restricted(), layout", "        var restricted = false, layout")], ['L-mrestr-noLayout'], ['mrestr']),
    'j-kbdplace': ([('menu', "            x = r.left; y = r.bottom;", "            x = r.left; y = r.top - 400;")], ['L-mkbd-opensBelow'], ['mkbd']),
    'j-focusback': ([('menu', "            if (t) { try { t.focus({ preventScroll: true }); } catch (e) { } }", "")], ['L-mkbd-focusBack', 'L-mkbd-escFocusBack'], ['mkbd']),
    'j-showhere': ([('menu', "                l.cols.splice(a < 0 ? l.cols.length : a + 1, 0, it);", "                l.cols.push(it);")], ['L-mflat-showHere'], ['mflat']),
    'j-calcplace': ([('menu', "                A.applyLayout(l);\n            }\n        });", "            }\n        });")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    # --- main.js
    'm-fromheader': ([('main', "        if (opts.fromHeader) {\n            window.Penumbra.refreshSettingsColumns();\n            return _asyncRerender;\n        }\n", "")],
                     ['L-mflat-noSavedToast'], ['mflat']),
    'm-sortrun': ([('main', "        else return;\n        _pnbRunHeaderSort($h.closest('table'));", "        else return;")],
                  ['L-mflat-sortAsc', 'L-mflat-sortDesc', 'L-gmenu-sortsGroups'], ['mflat', 'gmenu']),
    'm-hdrfreeze': ([('main', "            freeze: !hdr && _pnbFreezeState(col) ?", "            freeze: _pnbFreezeState(col) ?")], ['L-mopts-optsNoFreeze'], ['mopts']),
    'm-opener': ([('main', "        _all('.pnb-hm-opener.is-open').removeClass('is-open pnb-hm-opener');\n", "")], ['L-mopts-optsCloses'], ['mopts']),
    # --- the calculated column module, the width module
    'j-calcafter': ([('calc', "                    if (after) { try { after(name); } catch (e) { } }\n", "")], ['L-mcalc-placedRight', 'L-mcalc-calcStart'], ['mcalc']),
    'j-calcseed': ([('calc', "esc(d ? d.formula : (opts.seed || ''))", "esc(d ? d.formula : '')")], ['L-mcalc-seeded'], ['mcalc']),
    'j-fit': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));\n            return true;", "            return true;")], ['L-mopts-fits', 'L-mopts-fitsLong', 'L-mopts-fitsLongCut'], ['mopts']),
    # --- (round 2) the measuring Fit, the counts
    'j-fitauto': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "            setWidth(c, 'auto');")], ['L-mopts-fitsLong', 'L-mopts-fitsLongCut', 'L-gmenu-fitGroup'], ['mopts', 'gmenu']),
    # --- (round 3) Fit's cap, journal counts, Copy distinct values
    'j-fitcap': ([('colw', "            setWidth(c, clampW(Math.min(w, fitCap(c)), c));", "            setWidth(c, clampW(w, c));")], ['L-mopts-fitCapped'], ['mopts']),
    'm-statsjournal': ([('main', "        var jrn = !!(P.journalFriendlyCol && P.journalSearchColumnValue && P.journalFriendlyCol(String(col)));",
                         "        var jrn = false;")], ['L-mflat-statsToggle', 'L-mflat-statsNotes'], ['mflat']),
    'm-quickdelim': ([('main', "                const delimiter = (_pnbQuick && typeof _pnbQuick.delim === 'string') ? _pnbQuick.delim : ($('#copyDelimiterInput').val() || ';');",
                       "                const delimiter = $('#copyDelimiterInput').val() || ';';")], ['L-mcopy-copyComma', 'L-mcopy-copyNewline', 'L-mcopy-copyTab'], ['mcopy']),
    'm-quickkeep': ([('main', "        if (_pnbQuick) return;\n        lastCopySettings = {", "        lastCopySettings = {")], ['L-mcopy-copyKeeps'], ['mcopy']),
    'j-copyother': ([('menu', "            run: function () { A.copyDistinct(col, null); } });", "            run: function () { A.copyDistinct(col, ';'); } });")],
                    ['L-mcopy-copyOther'], ['mcopy']),
    # --- (round 4) the quick read, Swap...
    'j-allunique': ([('menu', "        var uq = (s.values > 1 && s.unique === s.values) ? 'all unique' : n(s.unique) + ' unique';",
                      "        var uq = n(s.unique) + ' unique';")], ['L-mflat-statsAllUnique'], ['mflat']),
    'j-noneempty': ([('menu', "(s.empty === 0 ? 'none empty' : n(s.empty) + ' empty')", "(n(s.empty) + ' empty')")],
                    ['L-mflat-statsLine', 'L-mflat-statsFiltered', 'L-mflat-statsAllUnique'], ['mflat']),
    'j-swaphalf': ([('menu', "                l.cols[i] = l.cols[j];\n                l.cols[j] = a;", "                l.cols[i] = l.cols[j];")],
                   ['L-mflat-swapDone'], ['mflat']),
    'j-swapself': ([('menu', "            if (!movable(c) || c.colName === col) { return; }", "            if (!movable(c)) { return; }")],
                   ['L-mflat-swapList'], ['mflat']),
    # --- (round 5) the journal block, Back
    'm-back': ([('main', "            back: (hdr && typeof hdr.back === 'function') ? { label: 'Back to the column menu', run: hdr.back } : null", "            back: null")],
               ['L-mopts-optsBack'], ['mopts']),
    'j-backrun': ([('mod', "            e.preventDefault();\n            cfg.back.run();", "            e.preventDefault();")], ['L-mopts-optsBack'], ['mopts']),
    # --- (round 6) journal columns movable; the new items
    'm-jplace': ([('main', "        function placeHead(headRow, prev, th) {\n            if (th.parentNode === headRow) return th;", "        function placeHead(headRow, prev, th) {")],
                 ['L-mjournal-jrnStaysUnsaved'], ['mjournal']),
    'm-jrow': ([('main', "                placeAfter(anchor, cell);\n            }\n        }", "                placeAfter(hash, cell);\n            }\n        }")],
               ['L-mjournal-jrnMoves'], ['mjournal']),
    'm-jsaved': ([('main', "            if (!order) return null;\n            for (var k = order.indexOf(col) - 1;", "            return null;\n            for (var k = order.indexOf(col) - 1;")],
                 ['L-mjournal-jrnSaved'], ['mjournal']),
    'm-thensort': ([('main', "        if (then && (dir === 'asc' || dir === 'desc')) {", "        if (false) {")], ['L-mmore-thenSort'], ['mmore']),
    'm-filterkeep': ([('main', "        if (values && values.length) st.sel[C] = values.slice();", "        if (false) st.sel[C] = values.slice();")], ['L-mmore-filterApply'], ['mmore']),
    'j-filterinit': ([('menu', "        var on = vals.map(function (v) { return any ? !!v.on : true; });", "        var on = vals.map(function (v) { return true; });")],
                     ['L-mmore-filterReopen'], ['mmore']),
    'j-panelesc': ([('menu', "        if (panel && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); closePanel(true); return; }\n", "")],
                   ['L-mmore-filterEsc'], ['mmore']),
    'm-statsnum': ([('main', "            out.num = { min: nums[0], max: nums[nums.length - 1],", "            out.num = { min: nums[nums.length - 1], max: nums[0],")], ['L-mmore-statsNum'], ['mmore']),
    'm-statsdate': ([('main', "                    if (!dMin || k < dMin.k) dMin = { k: k, t: t };", "                    if (!dMin) dMin = { k: k, t: t };")], ['L-mmore-statsDate'], ['mmore']),
    'j-only': ([('menu', "                l.cols.forEach(function (c) { c.visible = c.colName === col; });", "                l.cols.forEach(function (c) { c.visible = true; });")],
               ['L-mmore-only'], ['mmore']),
    'm-resetpos': ([('main', "        if (to !== i) penumbraApplyHeaderLayout(lay);\n", "")], ['L-mmore-resetCol'], ['mmore']),
    'j-copyname': ([('menu', "            navigator.clipboard.writeText(name).then(", "            navigator.clipboard.writeText(String(name).toLowerCase()).then(")],
                   ['L-mmore-copyName'], ['mmore']),
    'j-toolon': ([('menu', "    function toolOn(id) { var b = document.getElementById(id); return !!b && b.getClientRects().length > 0; }",
                   "    function toolOn(id) { return !!document.getElementById(id); }")], ['L-mmore-toolHidden'], ['mmore']),
    'm-blankoffer': ([('main', "return e.v !== '' || e.all > 0 || e.on;", "return true;")], ['L-mmore-filterList', 'L-mmore-filterApply'], ['mmore']),
    # --- (round 7) Fit as the cell lays out
    'j-fittable': ([('colw', "            if (st.display === 'table' || st.display === 'inline-table') {", "            if (false) {")],
                   ['L-mfitnest-nestGrow', 'L-mfitnest-nestCompact'], ['mfitnest']),
    'j-fitbr': ([('colw', "            if (n.tagName === 'BR') { flushLine(acc); continue; }", "            if (n.tagName === 'BR') { continue; }")],
                ['L-mfitnest-fitLines'], ['mfitnest']),
    'j-fitfixed': ([('colw', "        if (st.tableLayout === 'fixed') { w = widest * n; }   // fixed: the columns share the width equally\n", "")],
                   ['L-mfitnest-nestCompact'], ['mfitnest']),
    # --- (round 8) the cell menu
    'j-cellof': ([('menu', "        if (!th) { cell = cellOf(e.target); th = cell ? cell.th : null; }\n", "")], ['L-mcell-cellOpens', 'L-gmenu-cellGroup'], ['mcell', 'gmenu']),
    'j-celllink': ([('menu', "        if (target.closest('a, button, input, select, textarea, label, [contenteditable=\"true\"]')) { return null; }\n", "")],
                   ['L-mcell-cellNatives'], ['mcell']),
    'j-cellsel': ([('menu', "        if (sel && !sel.isCollapsed && sel.containsNode && sel.containsNode(td, true)) { return null; }\n", "")], ['L-mcell-cellNatives'], ['mcell']),
    'm-cellraw': ([('main', "        return _pnbFsCellText(m.get(String(col || '').toUpperCase()));\n    }\n    // One value into", "        return String(td.textContent || '').trim();\n    }\n    // One value into")],
                  ['L-mcell-cellRaw'], ['mcell']),
    'm-celladd': ([('main', "        if (!cur.some(function (x) { return String(x).toLowerCase() === v.toLowerCase(); })) cur.push(v);", "        cur = [v];")],
                  ['L-mcell-cellAdd'], ['mcell']),
    'm-cellex': ([('main', "fields = [exclude ? { col: C, blank: true, mode: 'ex' } : { col: C, blank: true }];", "fields = [{ col: C, blank: true }];")],
                 ['L-mcell-cellExclude'], ['mcell']),
    'j-cellfocus': ([('menu', "            var t = (c.cell && document.contains(c.cell.td)) ? c.cell.td : (document.contains(c.th) ? c.th : null);",
                      "            var t = document.contains(c.th) ? c.th : null;")], ['L-mcell-cellKbd'], ['mcell']),
    # --- (round 9, perf) only the cells that change
    'm-cellplan': ([('main', "            if (!_pnbApplyCellPlan(row, plan)) _pnbFullCellPass(row, desiredOrder, visibilityMap);",
                     "            if (true) _pnbFullCellPass(row, desiredOrder, visibilityMap);")], ['L-mflat-moveMinimal'], ['mflat']),
    'm-planlast': ([('main', "        for (i = ids.length - 1; i >= 0; i--) {\n            if (stay[ids[i]]) continue;",
                     "        for (i = 0; i < ids.length; i++) {\n            if (stay[ids[i]]) continue;")], ['L-mflat-multiMove'], ['mflat']),
    'm-planlis': ([('main', "        for (var t = tails.length ? tailIdx[tails.length - 1] : -1; t >= 0; t = prevIdx[t]) stay[ids[t]] = true;",
                    "        for (var t = -1; t >= 0; t = prevIdx[t]) stay[ids[t]] = true;")], ['L-mflat-moveMinimal'], ['mflat']),
    # --- (round 12) the lists under one item
    'u-noshowall': ([('menu', "        body.push({ act: 'showAll', label: 'Show all columns', disabled: !hidden.length, why: 'Every column is shown', run: function () {\n            var l = copyLayout(api().layout());\n            l.cols.forEach(function (c) { c.visible = true; });\n            applyWithUndo(l, 'Showing all ' + l.cols.length + ' columns.', false);\n        } });\n", "")],
                    ['L-msubs-showList'], ['msubs']),
    'u-clear': ([('menu', "run: function () { var b = document.getElementById('spClearStorage'); if (b) { b.click(); } } });", "run: function () { } });")], ['L-msubs-clearPanel'], ['msubs']),
    'u-arrow': ([('menu', "((it.sub && it.act !== 'back') ? '<span class=\"pnb-hm-arrow\" aria-hidden=\"true\">&#8250;</span>' : '')", "''")], ['L-msubs-arrows'], ['msubs']),
    'u-copyname': ([('menu', "        use.push({ act: 'copyName', label: 'Copy column name', run: function () { copyName(col); } });\n", "")], ['L-msubs-topOrder'], ['msubs']),
    # --- (round 21) Column stats, the notes button, Remove calculated column
    's-noflyout': ([('menu', "            look.push({ act: 'stats', label: 'Column stats', sub: true, items: function () { return statsItems(col); } });\n", "")], ['L-mflat-statsLine'], ['mflat']),
    's-topnofilter': ([('menu', "run: function () { A.filterAdd(col, t.v, false); } }); }", "run: function () { } }); }")], ['L-mflat-statsTop'], ['mflat']),
    'c-noremove': ([('menu', "            if (typeof C.isCalc === 'function' && C.isCalc(col) && typeof C.remove === 'function') {", "            if (false) {")], ['L-mcalc-calcRemoveItem'], ['mcalc']),
    'j-innote': ([('menu', "        var onNotes = target.closest('button.journal-notes-btn');", "        var onNotes = null;")], ['L-mjournal-jrnInNote'], ['mjournal']),
    # --- (round 20) the '#' menu, Add a note, the fiscal year
    'n-native': ([('menu', "        if (!th) { return null; }   // (round 20) the '#' heading has a short menu of its own", "        if (!th || th.getAttribute('data-column') === '#') { return null; }")], ['L-mnum-numOpens'], ['mnum']),
    'j-nonote': ([('menu', "            if (nb && !nb.disabled) {   // (a row whose key is empty cannot take notes: its button is disabled)\n                items.push({ act: 'addNote',", "            if (false) {\n                items.push({ act: 'addNote',")], ['L-mjournal-jrnAddNote'], ['mjournal']),
    'f-fy': ([('main', "var fy = m >= PNB_FY_START_MONTH ? y + 1 : y;", "var fy = y;")], ['L-mbucket-dtUnits'], ['mbucket']),
    # --- (round 19) date Ranges, Fit all
    'k-nodate': ([('main', "        if (days.length >= 2 && days.length === nonEmpty) {", "        if (false) {")], ['L-mbucket-dtModes'], ['mbucket']),
    'w-nofitall': ([('menu', "            if (typeof W.fitAll === 'function') {", "            if (false) {")], ['L-mopts-fitAll'], ['mopts']),
    # --- (round 16) Ranges
    'k-contig': ([('menu', "                apply.disabled = sp.n === 0 || sp.gap || !!info.off;", "                apply.disabled = sp.n === 0 || !!info.off;")], ['L-mbucket-bkGap'], ['mbucket']),
    # (the fixture's amounts are all distinct, so a wrong count per value cannot show: the cuts instead)
    'k-step': ([('main', "        for (; c < hi && cuts.length < 12; c += step) cuts.push(+c.toFixed(6));", "        for (; c < hi && cuts.length < 1; c += step) cuts.push(+c.toFixed(6));")], ['L-mbucket-bkList'], ['mbucket']),
    'k-range': ([('main', "max: (max === null || max === undefined) ? '' : String(max) };", "max: '' };")], ['L-mbucket-bkApply'], ['mbucket']),
    'k-openend': ([('menu', "(clearR || sp.first === 0) ? null : bk.buckets[sp.first].min,", "clearR ? null : bk.buckets[sp.first].min,")], ['L-mbucket-bkOpenEnd'], ['mbucket']),
    # --- (round 13) the lists beside their item
    'v-hover': ([('menu', "            hoverTimer = setTimeout(function () { if (cur && document.contains(itemEl)) { openSub(itemEl, it); } }, 150);", "            hoverTimer = null;")], ['L-msubs-hoverOpens'], ['msubs']),
    'v-hoverclose': ([('menu', "            hoverTimer = setTimeout(function () { if (cur) { closeSubs(level); } }, 250);", "            hoverTimer = null;")], ['L-msubs-hoverCloses'], ['msubs']),
    'v-kbdright': ([('menu', "        else if (k === 'ArrowRight' && opens) { activate(it[i]); }\n", "")], ['L-msubs-kbdOpens'], ['msubs']),
    'v-kbdleft': ([('menu', "        else if (k === 'ArrowLeft' && level > 0) { var from = cur.subs[level - 1].from; closeSubs(level - 1); try { from.focus({ preventScroll: true }); } catch (err) { from.focus(); } }\n", "")], ['L-msubs-kbdBack'], ['msubs']),
    'v-side': ([('menu', "        var x = p.right - 2, y = r.top - 5;", "        var x = p.left, y = p.top;")], ['L-msubs-flyPos'], ['msubs']),
    'v-close': ([('menu', "        c.subs.forEach(function (s) { if (s.el.parentNode) { s.el.parentNode.removeChild(s.el); } });\n", "")], ['L-msubs-escAll', 'L-msubs-outsideAll'], ['msubs']),
    'u-resetwidths': ([('menu', "        if (W && typeof W.resized === 'function' && W.resized()) {\n            resets.push(", "        if (false) {\n            resets.push(")], ['L-msubs-resetList'], ['msubs']),
    'u-seps': ([('menu', "        items = items.concat(look);\n", "        if (look.length) { items.push('-'); items = items.concat(look); }\n")], ['L-msubs-topOrder'], ['msubs']),
    # --- (round 11) Reset all columns
    'r-layout': ([('main', "        if (s.moved) penumbraApplyHeaderLayout(s.rep);\n        _pnbDropLayoutPref();",
                   "        _pnbDropLayoutPref();")], ['L-mreset-raLayout'], ['mreset']),
    'r-droppref': ([('main', "        if (s.moved) penumbraApplyHeaderLayout(s.rep);\n        _pnbDropLayoutPref();",
                     "        if (s.moved) penumbraApplyHeaderLayout(s.rep);")], ['L-mreset-raPref'], ['mreset']),
    'r-custom': ([('main', "        customized: function () { return !!_pnbColumnCustoms(); },", "        customized: function () { return true; },")],
                 ['L-mreset-raOffClean', 'L-mreset-raOffAfter'], ['mreset']),
    'r-undofmt': ([('main', "_pnbColOptWrite(C, { fmt: o.fmt || null,", "_pnbColOptWrite(C, { fmt: null,")], ['L-mreset-unFmt', 'L-mreset-unFmtOnly'], ['mreset']),
    'r-undosum': ([('main', "                persistColumnSummaries(userColumnSummaries, userColumnSummaryFormulas);\n", "")], ['L-mreset-unSum'], ['mreset']),
    'r-freezeorder': ([('main', "        if (s.frozen !== null) penumbraSetFrozenCols(reportFrozenCols);\n", "")], ['L-mreset-raFreeze'], ['mreset']),
    # --- (round 10, load perf)
    'p-idlist': ([('main', "            var fast = (typeof selector === 'string' && !context",
                   "            var fast = (false && typeof selector === 'string' && !context")], ['L-mload-idFast'], ['mload']),
    'p-idsort': ([('main', "            return jQuery.uniqueSort(out);", "            return out;")], ['L-mload-idSame'], ['mload']),
    'p-idscope': ([('main', "found = el.querySelectorAll(m[2].charAt(0) === '>' ? ':scope ' + m[2] : m[2]);", "found = el.querySelectorAll(m[2]);")],
                  ['L-mload-idFast'], ['mload']),
    'p-edhidden': ([('main', "        if (shown || typeof IntersectionObserver !== 'function') {",
                     "        if (true || typeof IntersectionObserver !== 'function') {")], ['L-mload-edHiddenSkip', 'L-mload-edShownRefresh'], ['mload']),
    'p-edcancel': ([('main', "            if (w.__pnbRefreshIO) { w.__pnbRefreshIO.disconnect(); w.__pnbRefreshIO = null; }\n", "")], ['L-mload-edShownOnce'], ['mload']),
    'p-edio': ([('main', "            w.__pnbRefreshIO = null;\n            cm.refresh();", "            w.__pnbRefreshIO = null;")], ['L-mload-edShownRefresh'], ['mload']),
    'j-fitgroup': ([('colw', "        var tables = c.view === 'group' ? document.querySelectorAll('#groupedResultsContainer table') : [c.th.closest('table')];",
                     "        var tables = [c.th.closest('table')];")], ['L-gmenu-fitGroup'], ['gmenu']),
    'm-statshidden': ([('main', "            if (rows[i].classList.contains('search-hidden')) continue;\n            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);",
                        "            var idx = _pnbLazyRowIndex(rows[i]), m = (idx >= 0) ? masterRowData[idx] : null;\n            if (!m) continue;\n            var v = m.get(name);")], ['L-mflat-statsFiltered'], ['mflat']),
    'm-statsempty': ([('main', "            else seen.add(t);", "            seen.add(t);")], ['L-mflat-statsEmpty'], ['mflat']),
    'j-statsline': ([('menu', "        if (!A || typeof A.colStats !== 'function') { return ''; }", "        if (true) { return ''; }")], ['L-mflat-statsLine'], ['mflat']),
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
one_mutant = opt('--mutant', None)
all_mutants = flag('--mutants')
control = flag('--control')
scn_only = opt('--scn', None)
if scn_only: SCN = scn_only.split(',')
if args: raise SystemExit('unknown arguments: %s' % ' '.join(args))
src_root = stage_dir or APP
def pick(rel):
    p = os.path.join(src_root, rel)
    return p if os.path.exists(p) else os.path.join(APP, rel)
RELS = {'main': os.path.join('js', 'main.js'), 'mod': os.path.join('js', 'penumbra_colfmt.js'), 'calc': os.path.join('js', 'penumbra_calc.js'),
        'colw': os.path.join('js', 'penumbra_colwidths.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'),
        'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'css': os.path.join('css', 'main.css'),
        'index': 'index.php', 'help': 'help_content.php', 'topic': os.path.join('help', 'topics', 'userSettingsHelpLightbox.php')}
sys.path.insert(0, HERE)
import mk_harness
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p):
    if not os.path.exists(p): return ''   # the control has no module: an EMPTY file
    return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

def hook(src):
    anchor = '$(document).ready(function () {'
    i = src.find(anchor)
    if i < 0 or i > 400: raise SystemExit('closure anchor not found')
    out = src[:i] + ';(function () {\r\n' + src[i + len(anchor):]
    j = out.rfind('});')
    out = out[:j] + '})();' + out[j + 3:]
    hl = '    function hideLoading() {'
    if out.count(hl) != 1: raise SystemExit('hideLoading anchor count %d' % out.count(hl))
    return out.replace(hl, hl + '\n        window.__HC_HIDES = (window.__HC_HIDES || 0) + 1;')
def mutate(texts, name):
    t = dict(texts)
    for f, old, new in MUTANTS[name][0]:
        # main.js mixes line endings: an anchor written with LF may sit in a CRLF stretch
        crlf = lambda x: x.replace('\n', '\r\n')
        if t[f].count(old) != 1 and t[f].count(crlf(old)) == 1:
            old, new = crlf(old), crlf(new)
        if t[f].count(old) != 1: raise SystemExit("mutant '%s': %s anchor found %d times: %r" % (name, f, t[f].count(old), old[:90]))
        t[f] = t[f].replace(old, new)
    return t

stage = tempfile.mkdtemp(prefix='pnb_cm_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css', 'penumbra_grouplist.css', 'penumbra_cellsel.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
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

def run_page(path):
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
        call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
        call('Emulation.setFocusEmulationEnabled', {'enabled': True})
        # (perf) PNB_PROFILE_BOOT=<json>: the CPU from navigation until the page is ready (mperf: the build)
        booting = bool(os.environ.get('PNB_PROFILE_BOOT'))
        if booting:
            call('Profiler.enable'); call('Profiler.setSamplingInterval', {'interval': 500}); call('Profiler.start')
        tnav = time.time()
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        profiling = False
        while time.time() - t0 < 300:
            time.sleep(0.25)
            if booting:
                if call('Runtime.evaluate', {'expression': '!!window.__PERF_READY', 'returnByValue': True}).get('result', {}).get('value'):
                    prof = call('Profiler.stop').get('profile')
                    open(os.environ['PNB_PROFILE_BOOT'], 'w', encoding='utf-8').write(json.dumps(prof))
                    print('BOOT wall %.1f s' % (time.time() - tnav))
                    booting = False
                    call('Runtime.evaluate', {'expression': 'window.__PERF_GO = true'})
                continue
            # (perf) PNB_PROFILE: once the page says it is ready, profile the move it then makes
            if os.environ.get('PNB_PROFILE') and not profiling:
                ready = call('Runtime.evaluate', {'expression': '!!window.__PERF_READY', 'returnByValue': True}).get('result', {}).get('value')
                if ready:
                    call('Profiler.enable'); call('Profiler.setSamplingInterval', {'interval': 200}); call('Profiler.start')
                    call('Runtime.evaluate', {'expression': 'window.__PERF_GO = true'})
                    profiling = True
                    continue
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if profiling:
                    prof = call('Profiler.stop').get('profile')
                    open(os.environ['PNB_PROFILE'], 'w', encoding='utf-8').write(json.dumps(prof))
                if os.environ.get('PNB_SHOT'):
                    import base64
                    shot = call('Page.captureScreenshot', {'format': 'png'}).get('data')
                    if shot: open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot))
                return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def help_stub(help_src):
    m = re.search(r'<div id="settings-tips-storage" hidden>.*?\n</div>', help_src, re.S)
    return 'window.__HELP_STUB = ' + json.dumps('<div id="searchHelpLightbox"></div>' + (m.group(0) if m else '')) + ';\n'

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('help_stub.js', help_stub(texts['help']))
    w('main_hc.js', hook(texts['main']))
    w('penumbra_colfmt.js', texts['mod'])
    w('penumbra_calc.js', texts['calc'])
    w('penumbra_colwidths.js', texts['colw'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('main.css', texts['css'])

def static_checks(texts):
    idx, hlp = texts['index'], texts['help']
    return [
        ('S-indexLoads', "file_exists(__DIR__ . '/js/penumbra_colmenu.off')" in idx and 'src="js/penumbra_colmenu.js?v=' in idx
         and 'href="css/penumbra_colmenu.css?v=' in idx, ''),
        # (round 5) the popover's Back, the journal block
        ('S-helpBack', 'with a Back button to this menu' in hlp and 'returns to this menu' in texts['topic']
         and 'journal columns move too' in hlp and 'move like any other and stay where you put them' in texts['topic'], ''),
        # (round 8) the cell menu in both help files
        ('S-helpNum', 'Hide the row numbers' in texts['topic'] and 'Add a note to this row' in hlp and 'fiscal year' in hlp and 'by fiscal year' in texts['topic'], ''),
        ('S-helpFitAll', 'Fit all column widths' in texts['topic'] and '<em>Fit all column widths</em>' in hlp and 'date column by year' in texts['topic'], ''),
        ('S-helpRanges', '<em>Ranges</em> groups the values into about six ranges' in texts['topic'] and '<em>Ranges</em> groups them into about six ranges' in hlp, ''),
        ('S-helpSubs', '<strong>Move column</strong>' in texts['topic'] and 'Clear all custom preferences for this report' in texts['topic'] and '<em>Show column(s)</em>' in hlp and '<em>Move column</em>' in hlp, ''),
        ('S-helpResetAll', '<em>All columns</em>, every column back to the report' in hlp and '<strong>Reset</strong>: All columns</td>' in texts['topic'], ''),
        ('S-helpCells','data-colmenu-cells' in hlp and 'data-colmenu-cells' in texts['topic'] and 'Filter to "value"' in texts['topic'], ''),
        # (round 6) the new items in both help files
        ('S-helpMore', all(x in texts['topic'] for x in ('Then sort ascending', 'Filter by value...', 'Show only this column',
                                                           '<strong>Reset</strong>: This column', '<strong>Copy column name</strong>', 'the lists open beside their item'))
         and all(x in hlp for x in ('Then sort ascending / descending', 'Filter by value...', '<em>Reset</em> (<em>This column</em>', '<em>Copy column name</em>', 'opens on hover')), ''),
        # (round 21) Column stats is back as a list beside the item; Pivot / Chart this column stay out
        ('S-helpStats', '<strong>Column stats</strong>' in texts['topic'] and '<em>Column stats</em>' in hlp and 'Pivot by this column' not in texts['topic']
         and 'Pivot by this column...</em> / <em>Chart this column' not in hlp and 'Remove this calculated column' in hlp
         and '<em>all</em> when none repeats' in hlp and '<em>all</em> when none repeats' in texts['topic'] and 'all unique' not in texts['topic'], ''),
        # (round 4) Swap..., the quick read
        ('S-helpSwap', '<em>Swap with...</em>' in hlp and '<em>Swap with...</em>' in texts['topic'], ''),   # (round 21: the "all unique" wording moved to S-helpStats)
        # (round 3) Copy distinct values, the cap, the journal counts
        ('S-helpCopy', '<em>Copy distinct values</em> (delimited by' in hlp and '<strong>Copy distinct values</strong></td>' in texts['topic'] and "60% of the table's visible width" in hlp
         and "60% of the table's visible width" in texts['topic'] and 'checked and unchecked boxes' in texts['topic'], ''),
        # the v2 topic (the Help Center, help/v2.on) and the classic help both name it
        # (round 2) the help says Fit measures, and names the counts
        ('S-helpFit', 'widest value on screen' in hlp and 'widest value on screen' in texts['topic']
         and 'how many different values' in texts['topic'] and 'and empty cells' in hlp, ''),
        ('S-helpNamed', 'data-colmenu-help' in hlp and 'id="us-colmenu" data-colmenu-help' in texts['topic']
         and 'data-jump-to="us-colmenu"' in texts['topic'], ''),
    ]

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s%s' % (s, ('&rows=' + os.environ['PNB_ROWS']) if (s in ('mperf', 'mrerun') and os.environ.get('PNB_ROWS')) else ''))
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:600])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        full = bool(os.environ.get('PNB_INFO'))
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:None if full else 600]) if (v is not True or full) else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps(cand))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            t = mutate(texts, m)
            write_stage(t)
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            dead = [a[2:] for a in red if a.startswith('F-')]
            good = not [x for x in must if x not in red and not [d for d in dead if x.startswith('L-' + d + '-')]]
            okc += good; bad += (not good)
            print('  %s  mutant %-14s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        if scn_only is None: res += static_checks(texts)
        p = f = 0; failed = []
        for a, passed, dd in res:
            print('  %s  %-30s %s' % ('PASS' if passed else 'FAIL', a, dd if os.environ.get('PNB_INFO') else dd[:600]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            dead = {a[2:] for a, passed, _ in res if a.startswith('F-') and not passed}
            red = {a for a, passed, _ in res if not passed} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            seen = {a for a, _, _ in res} | {'L-%s-%s' % (s, c) for s in dead for c in CHK[s]}
            new_green = sorted(a for a in NEW if a in seen and a not in red)
            new_unseen = sorted(a for a in NEW if a not in seen)
            old_red = sorted(a for a in red if a not in NEW and not a.startswith('F-'))
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(new_green) or 'none'))
            print('CONTROL: new checks never run: %s' % (' '.join(new_unseen) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(old_red) or 'none'))
            print('RESULT: GREEN' if not new_green and not new_unseen and not old_red else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
