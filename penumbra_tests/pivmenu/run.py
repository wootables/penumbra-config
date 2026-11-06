# =============================================================================
# PIVMENU SUITE (2026-10-17) - the pivot table's right-click menu (colmenu pivot v1):
# the REAL main.js + js/penumbra_colmenu.js on the pvshade harness with the pivot builder
# lifted from the index.php under test (mk_harness.py). See driver.js for the scenarios.
#   py -3 run.py [--stage DIR] [--control] [--mutants | --mutant NAME] [--scn S]
# Headless Edge over CDP; stages into %TEMP%\pnb_pm_*; writes nothing to the webroot.
# =============================================================================
import json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
LIBS = ['jquery-3.7.1.min.js', 'jquery-ui.min.js', 'moment.min.js', 'pako.min.js', 'codemirror.min.js', 'sql.min.js',
        'show-hint.js', 'foldcode.js', 'foldgutter.js', 'brace-fold.js', 'comment-fold.js', 'placeholder.js',
        'penumbra_snippet_help.js', 'purify.min.js', 'penumbra_template.js', 'penumbra_userseg.js', 'penumbra_tiles.js', 'penumbra_colwidths.js']
SCN = ['pmhead', 'pmfield', 'pmcell', 'pmbreak', 'pmmulti', 'pmnotool']
CHK = {
    'pmhead': ['opens', 'nativeShift', 'nativeSecond', 'headItems', 'sortDesc', 'thenOffered', 'thenSort', 'sortClear', 'copyCol', 'shadeList', 'shadeBar', 'shadeUndo', 'shadeHover', 'fmtList', 'fmtCurrency', 'fmtDp', 'fmtUndo', 'fmtAuto', 'colsItems', 'colsDesc', 'colsAsc', 'colExclude'],
    'pmfield': ['fieldItems', 'sortAZ', 'layoutItems', 'layoutFlat', 'layoutUndo', 'freezeOne', 'freezeUndo', 'collapseAll', 'expandAll', 'fieldUp', 'fieldUndo', 'fieldRemove', 'removeLastOff', 'swap'],
    'pmcell': ['cellOpens', 'cellItems', 'drillLabel', 'cellTitleDecoded', 'labelDecoded', 'drill', 'labelItems', 'toggle', 'copyLabel', 'labelExclude', 'cellFilter',
               'cellTools', 'cellToolsNotTotal', 'cellShade', 'cellShadeUndo'],   # (2026-10-22) a value cell's Shading / Format
    # (colmenu round 14) the breakdown table's menu: sort and copy
    'pmbreak': ['bdTable', 'bdNumNative', 'bdNativeShift', 'bdHeadOpens', 'bdHeadItems', 'bdSortAsc', 'bdSortDesc', 'bdThen', 'bdClear', 'bdCopyCol', 'bdCopyDistinct', 'bdStats', 'bdCell', 'bdCopyValue', 'bdCopyName', 'bdCopyList', 'bdCopyRow', 'bdNoSql', 'bdKbd',
                'bdWidthItems', 'bdFit', 'bdResetOne', 'bdFitAll', 'bdFitPage', 'bdResetWidths', 'bdWidthsNotPivot', 'bdRowHeight'],
    # (colmenu round 17) several values, no column fields, collapsed groups: the cells by position
    'pmmulti': ['multiBuilt', 'multiItems', 'multiCollapsed', 'multiCopy', 'multiSlot', 'multiFmtKind'],
    'pmnotool': ['noToolField', 'noToolHead'],
    'pmshot': ['open'],
}
# pivot menu v1 is live (5726ddc): its checks pass there. (colmenu round 14) the breakdown
# menu's are the new ones - all but the table itself and the '#' heading's browser menu
NEW_V1 = {'L-%s-%s' % (s, c) for s in CHK for c in CHK[s]}
NEW_R14 = {'L-pmbreak-' + c for c in CHK['pmbreak']} - {'L-pmbreak-bdTable', 'L-pmbreak-bdNumNative'}
# (colmenu round 15) Format beside Shading, both lists beside their item (shadeList changes shape)
NEW_R15 = {'L-pmhead-shadeList', 'L-pmhead-fmtList', 'L-pmhead-fmtCurrency', 'L-pmhead-fmtDp', 'L-pmhead-fmtUndo', 'L-pmhead-fmtAuto'}
# (colmenu round 17) the cells under a heading by position: live drifts over collapsed rows
# (expanded, live's grid still lines up: only the collapsed-group check is red there; the others guard)
NEW_R17 = {'L-pmmulti-multiCollapsed'}
# (colmenu round 18) the columns' order from the menu; the drill item's name
NEW_R18 = {'L-pmhead-colsItems', 'L-pmhead-colsDesc', 'L-pmhead-colsAsc', 'L-pmcell-drillLabel'}
# (colmenu round 19) the pivot menu's lists open on hover
NEW_R19 = {'L-pmhead-shadeHover'}
# (colmenu round 22) a count's Format list: no types, the decimals alone, a line that says why
NEW_R22 = {'L-pmmulti-multiFmtKind'}   # live a57a250
# (colmenu round 25) the way to the browser's menu from the pivot's and the breakdown's menus
NEW_R25 = {'L-pmhead-nativeShift', 'L-pmhead-nativeSecond', 'L-pmbreak-bdNativeShift'}   # live a04520b
# (colmenu round 27) the breakdown menu's width items
NEW_R27 = {'L-pmbreak-bdWidthItems', 'L-pmbreak-bdFit', 'L-pmbreak-bdFitAll', 'L-pmbreak-bdResetWidths'}   # live fd50235
# (colmenu round 28) the breakdown's Copy distinct values list, Column stats, no counts line (these reshape)
NEW_R28 = {'L-pmbreak-bdHeadOpens', 'L-pmbreak-bdHeadItems', 'L-pmbreak-bdCopyCol', 'L-pmbreak-bdCopyDistinct', 'L-pmbreak-bdStats'}   # live 34c2b77
# (colmenu round 29) the pivot's escaped keys read decoded in the menu
NEW_R29 = {'L-pmcell-cellTitleDecoded', 'L-pmcell-labelDecoded'}   # live ab29ada
NEW_R32 = {'L-pmbreak-bdRowHeight'}   # live 375202d
# (colmenu round 33) Layout and Freeze row labels; the breakdown's Column widths list, Fit to page, Reset this column's width
NEW = {'L-pmbreak-bdWidthItems', 'L-pmbreak-bdResetOne', 'L-pmbreak-bdFitPage', 'L-pmfield-layoutItems', 'L-pmfield-layoutFlat',
       'L-pmfield-layoutUndo', 'L-pmfield-freezeOne', 'L-pmfield-freezeUndo'}
# (2026-10-22, round 33 is live: its checks are old ones now) a value cell's Shading and Format, as its heading's
NEW = {'L-pmcell-cellTools', 'L-pmcell-cellShade', 'L-pmcell-cellShadeUndo'}
# (2026-10-27, copymenu) a breakdown's copies as ONE list, Copy: the heading's and the cell's lists, This row, For SQL
NEW = {'L-pmbreak-bdHeadItems', 'L-pmbreak-bdCell', 'L-pmbreak-bdWidthItems', 'L-pmbreak-bdCopyList', 'L-pmbreak-bdCopyRow', 'L-pmbreak-bdCopySql'}
NEW = set()   # (copymenu is LIVE since a8aabf9, 2026-10-27: old checks now)
NEW = {'L-pmbreak-bdNoSql'}   # (2026-10-27, copymenu 2) no For SQL in a breakdown's Distinct values (live a8aabf9 has it)
NEW = set()   # (copymenu 2 is LIVE since 0d19cfd, 2026-10-27: old checks now)
NEW = NEW - {'L-pmbreak-bdCopyList'}   # (fltmenu is LIVE since 5eae534, 2026-10-27)
CHK['pmbreak'] = CHK['pmbreak'] + ['bdCopyHead']
NEW = NEW | {'L-pmbreak-bdCopyHead'}   # (2026-10-27, copymenu 3) the breakdown's Copy list under a Copy heading (live has none)
NEW = NEW - {'L-pmbreak-bdCopyHead'}   # (copymenu 3 is LIVE since 766f5e9, 2026-10-27: old checks now)
#NEW = NEW | {'L-pmbreak-bdCopyList'}   # (2026-10-27, fltmenu) a breakdown cell's Copy list: the column's name before This entire row
MUTANTS = {
    # --- (2026-10-22) a value cell's tools: none; offered under a Grand Total column too
    'c-notools': ([('menu', '            if (vinfo && !vinfo.total && vinfo.aggs.length === 1) {', '            if (false) {')], ['L-pmcell-cellTools', 'L-pmcell-cellShade'], ['pmcell']),
    'c-total': ([('menu', '            if (vinfo && !vinfo.total && vinfo.aggs.length === 1) {', '            if (vinfo && vinfo.aggs.length >= 1) {')], ['L-pmcell-cellToolsNotTotal'], ['pmcell']),
    # --- (colmenu round 27) the breakdown's width items: never offered; the API gate back to flat/group
    'w-bditems': ([('menu', "            size.push({ act: 'bdWidth', label: 'Column widths', sub: true, items: function () { return widthItems(th, false, true); } });", "")],
                  ['L-pmbreak-bdWidthItems', 'L-pmbreak-bdFit', 'L-pmbreak-bdResetOne', 'L-pmbreak-bdFitAll', 'L-pmbreak-bdFitPage', 'L-pmbreak-bdResetWidths'], ['pmbreak']),
    # (colmenu round 33) a breakdown's Fit to page sets nothing; no Layout list; a Freeze pick changes nothing
    'w-pagebd': ([('colw', "            if (drill) { before[cc.name] = drillW[cc.name] || null; drillW[cc.name] = w; }", "            if (drill) { before[cc.name] = drillW[cc.name] || null; }")], ['L-pmbreak-bdFitPage'], ['pmbreak']),
    'l-nolayout': ([('menu', "            if (pvLayoutItems().length) { items.push({ act: 'pvLayout', label: 'Layout', sub: true, items: pvLayoutItems }); }", "")], ['L-pmfield-layoutItems', 'L-pmfield-layoutFlat', 'L-pmfield-layoutUndo'], ['pmfield']),
    'l-freezenoop': ([('menu', "                    x.stickyColCount = k;", "                    x.stickyColCount = x.stickyColCount;")], ['L-pmfield-freezeOne'], ['pmfield']),
    'w-apigate': ([('colw', "            if (!c || c.view === 'pivot') { return false; }   // (round 27) a breakdown's too", "            if (!c || (c.view !== 'flat' && c.view !== 'group')) { return false; }")], ['L-pmbreak-bdFitAll'], ['pmbreak']),
    # --- (colmenu round 25) Shift with the right-click intercepted all the same
    'p-shift': ([('menu', "        if (e.shiftKey && e.button === 2) { if (cur) { close(false); } lastClosed = null; return; }\n", "")], ['L-pmhead-nativeShift', 'L-pmbreak-bdNativeShift'], ['pmhead', 'pmbreak']),
    # --- (colmenu round 22) the Format list ignores what kind of value it is
    'f-kind': ([('menu', "        var kind = typeof P.fmtKind === 'function' ? P.fmtKind(ai) : 'number';", "        var kind = 'number';")], ['L-pmmulti-multiFmtKind'], ['pmmulti']),
    # --- (colmenu round 19) no hover listener on the pivot menu's root
    'h-nohover': ([('menu', "        el.addEventListener('mouseover', onHover);   // (round 19) its lists open on hover too\n", "")], ['L-pmhead-shadeHover'], ['pmhead']),
    # --- (colmenu round 18) the order item does nothing
    'c-noop': ([('menu', "checked: cdir === 'desc', run: function () { if (cdir !== 'desc') { csi.click(); } } });", "checked: cdir === 'desc', run: function () { } });")], ['L-pmhead-colsDesc'], ['pmhead']),
    # --- (colmenu round 17) the values' cells one place off
    'g-shift': ([('menu', "            var tr = rows[r], L = tr.cells.length - K;", "            var tr = rows[r], L = tr.cells.length - K - 1;")], ['L-pmmulti-multiCopy', 'L-pmmulti-multiSlot'], ['pmmulti']),
    # --- (colmenu round 15) the Format list
    'f-store': ([('menu', "            x.aggFormat = arr.some(Boolean) ? arr : null;", "            x.aggFormat = x.aggFormat;")], ['L-pmhead-fmtCurrency'], ['pmhead']),
    'f-dp': ([('menu', "            var v = (t === 'auto' && dp === null) ? null : t + (dp === null ? '' : ':' + dp);", "            var v = (t === 'auto' && dp === null) ? null : t;")], ['L-pmhead-fmtDp'], ['pmhead']),
    'f-checked': ([('menu', "            items.push({ act: 'pvFmt-' + m[0], label: m[1], checked: now.t === m[0], run: function () {", "            items.push({ act: 'pvFmt-' + m[0], label: m[1], checked: false, run: function () {")], ['L-pmhead-fmtList'], ['pmhead']),
    # --- (colmenu round 14) the breakdown table's menu
    'b-nosort': ([('main', "            for (var i = 0; i < 3; i++) {\n                if (want ? $th.attr('aria-sort') === want : !$th.hasClass('sorted')) return true;",
                   "            for (var i = 0; i < 0; i++) {\n                if (want ? $th.attr('aria-sort') === want : !$th.hasClass('sorted')) return true;")],
                 ['L-pmbreak-bdSortAsc', 'L-pmbreak-bdSortDesc'], ['pmbreak']),
    'b-native': ([('menu', "        if (!th || i === 0 || labelOf(th) === '#') { return null; }", "        if (!th) { return null; }")], ['L-pmbreak-bdNumNative'], ['pmbreak']),
    'b-distinct': ([('menu', "        return bdColumnTexts(t).filter(function (x) { if (x === '' || seen[x]) { return false; } seen[x] = 1; return true; });",
                     "        return bdColumnTexts(t).filter(function (x) { return x !== ''; });")], ['L-pmbreak-bdCopyDistinct'], ['pmbreak']),
    # --- (colmenu round 32) the breakdown's row height item gone
    'b-norow': ([('menu', "        if (rhb) { size.push(rhb); }\n", "")], ['L-pmbreak-bdRowHeight'], ['pmbreak']),
    'b-nohead': ([('menu', "items: function () { return [{ heading: 'Copy' }].concat(list); } };", "items: function () { return list; } };")], ['L-pmbreak-bdCopyHead'], ['pmbreak']),   # (copymenu 3)
    # --- (colmenu round 29) no decoding of the pivot's keys
    'k-raw': ([('menu', "        if (s == null || s.indexOf('&') < 0) { return String(s == null ? '' : s); }", "        return String(s == null ? '' : s);")], ['L-pmcell-cellTitleDecoded', 'L-pmcell-labelDecoded'], ['pmcell']),
    # --- (colmenu round 28) the delimiter ignored; the duplicates miscounted in a breakdown's stats
    'b-delim': ([('menu', "                pvCopy(v.join(d[2]), 'Copied ' + v.length + (v.length === 1 ? ' distinct value.' : ' distinct values.'));", "                pvCopy(v.join('\\n'), 'Copied ' + v.length + (v.length === 1 ? ' distinct value.' : ' distinct values.'));")], ['L-pmbreak-bdCopyDistinct'], ['pmbreak']),
    'b-stats': ([('menu', "        freq.forEach(function (c) { if (c > 1) { dRows += c; dExtra += c - 1; dVals++; } });", "        freq.forEach(function (c) { if (c > 1) { dRows += c; dExtra += c; dVals++; } });")], ['L-pmbreak-bdStats'], ['pmbreak']),
    'b-then': ([('menu', "        if (sortedOther) {\n            items.push({ act: 'bdThenAsc'", "        if (false) {\n            items.push({ act: 'bdThenAsc'")], ['L-pmbreak-bdThen'], ['pmbreak']),
    # (re-anchored 2026-10-27, copymenu: the cell's copies gather into the Copy list)
    'b-cell': ([('menu', "        if (t.td) {\n            bcp.push({ act: 'bdCopy',", "        if (false) {\n            bcp.push({ act: 'bdCopy',")], ['L-pmbreak-bdCopyList', 'L-pmbreak-bdCopyValue'], ['pmbreak']),
    # --- (2026-10-27, copymenu) the cell's Copy list at the foot (the heading's place); no This row; '#' in the row; no Copy
    # list on a heading
    'b-cpslot': ([('menu', "        if (t.td) {\n            items.push(copyEntry('bdCopyMenu', bcp));\n            items.push('-');\n        }\n", ""),
                  ('menu', "        if (!t.td) { items.push(copyEntry('bdCopyMenu', bcp)); }\n", "        items.push(copyEntry('bdCopyMenu', bcp));\n")], ['L-pmbreak-bdCell'], ['pmbreak']),
    'b-norow': ([('menu', "            bcp.push(rowCopyItem('bdCopyRow', function () { return bdRowLines(t); }));\n", "")], ['L-pmbreak-bdCopyList', 'L-pmbreak-bdCopyRow'], ['pmbreak']),
    'b-rownum': ([('menu', "        for (var i = 1; i < hr.cells.length; i++) {", "        for (var i = 0; i < hr.cells.length; i++) {"),
                  ('menu', "            if (!c || name === '#' || !shown(h) || c.hasAttribute('colspan')) { continue; }", "            if (!c) { continue; }")], ['L-pmbreak-bdCopyRow'], ['pmbreak']),
    'b-headlist': ([('menu', "        if (!t.td) { items.push(copyEntry('bdCopyMenu', bcp)); }\n", "")], ['L-pmbreak-bdHeadItems', 'L-pmbreak-bdWidthItems'], ['pmbreak']),
    # Clear sort: no Shift+click, so the heading stays sorted
    'm-clear': ([('main', "        if (now === 'ascending' || now === 'descending') $th.trigger($.Event('click.pivotSort', { shiftKey: true }));\n", "")],
                ['L-pmhead-sortClear'], ['pmhead']),
    # a column value never found: no Filter to / Exclude on a heading
    'm-colval': ([('menu', "if (!info || info.total || !info.keys.length || !s.cols.length || info.level !== 0) { return null; }",
                   "if (true) { return null; }")], ['L-pmhead-headItems', 'L-pmhead-colExclude'], ['pmhead']),
    # Undo a no-op
    'm-undo': ([('menu', "offerUndo(function () { var Q = window.Penumbra.pivotMenu; if (Q && Q.on()) { Q.rebuild(before); } })",
                 "offerUndo(function () { })")], ['L-pmhead-shadeUndo', 'L-pmfield-fieldUndo'], ['pmhead', 'pmfield']),
    # Move up a level puts the field back where it was
    'm-up': ([('menu', "                    x.rows.splice(i - 1, 0, f);\n", "                    x.rows.splice(i, 0, f);\n")], ['L-pmfield-fieldUp'], ['pmfield']),
    # the Pivot tool not consulted
    'm-tool': ([('main', "        toolOn: function () { var b = document.getElementById('pivotBtn'); return !!b && b.getClientRects().length > 0; },",
                 "        toolOn: function () { return true; },")], ['L-pmnotool-noToolField', 'L-pmnotool-noToolHead'], ['pmnotool']),
    # a value cell's filter takes its row only
    'm-cellcols': ([('menu', "            if (ck) { ck.split('|||').forEach(function (x, k) { if (k < s.cols.length) { pairs.push([s.cols[k], x]); } }); }\n", "")],
                   ['L-pmcell-cellItems', 'L-pmcell-cellFilter'], ['pmcell']),
    # [Blank] kept as text: harmless here, so not run - kept for the record
}

# (2026-10-27, fltmenu) the breakdown's name copy after This entire row again
MUTANTS['b-nameafter'] = ([('menu', "            bcp.push(bdName);\n            bcp.push(rowCopyItem('bdCopyRow', function () { return bdRowLines(t); }));\n",
                            "            bcp.push(rowCopyItem('bdCopyRow', function () { return bdRowLines(t); }));\n            bcp.push(bdName);\n")], ['L-pmbreak-bdCopyList'], ['pmbreak'])

# (2026-11-03, menufix) the Grand Total row, a row label's Collapse / Expand all, Clear all last and no leading separator;
# the row field's sort words (sortAZ, now Sort ascending); a breakdown's '#' menu (bdNumNative -> bdNumMenu, bdNumRow) and
# its heading's order (bdWidthItems)
SCN = SCN + ['pmfix']
CHK['pmfix'] = ['totalMenu', 'totalLabel', 'labelAll', 'labelCollapse', 'clearLast', 'noLeadSep', 'totalDrill']
CHK['pmbreak'] = [c for c in CHK['pmbreak'] if c != 'bdNumNative'] + ['bdNumMenu', 'bdNumRow']
NEW_MF = {'L-pmfix-' + c for c in CHK['pmfix']} | {'L-pmfield-sortAZ', 'L-pmbreak-bdNumMenu', 'L-pmbreak-bdNumRow', 'L-pmbreak-bdWidthItems'}
NEW = NEW | NEW_MF
# (2026-11-03, menufix2) a breakdown footer's summary menu: red on menufix's live build
SCN = SCN + ['pmfix2']
CHK['pmfix2'] = ['bdFootMenu', 'bdFootPick', 'bdFootLabel']
NEW_MF2 = {'L-pmfix2-' + c for c in CHK['pmfix2']}
NEW = NEW | NEW_MF2
NEW = NEW - NEW_MF2   # (menufix2 is LIVE since f4cc45a, 2026-11-03: old checks now)
MUTANTS.update({
    'mf2-bdfoot': ([('menu', "        var td = target.closest('tfoot tr.total-row-data td, tfoot tr.total-row-link td, table.pnb-breakdown tfoot td');", "        var td = target.closest('tfoot tr.total-row-data td, tfoot tr.total-row-link td');")],
                   ['L-pmfix2-bdFootMenu', 'L-pmfix2-bdFootPick', 'L-pmfix2-bdFootLabel'], ['pmfix2']),
    'mf2-bdclear': ([('menu', "subs: [], bd: t.bd ? true : undefined };", "subs: [] };")], ['L-pmfix2-bdFootMenu'], ['pmfix2']),
})
NEW = NEW - NEW_MF   # (menufix is LIVE since 5b124ce, 2026-11-03: old checks now)
MUTANTS.pop('b-native', None)   # its anchor went: the '#' column has a menu now (pf-bdnum)
MUTANTS.update({
    'pf-tfoot': ([('menu', "        if (cell.closest('tfoot')) {", "        if (false) {")], ['L-pmfix-totalMenu', 'L-pmfix-totalLabel', 'L-pmfix-totalDrill'], ['pmfix']),
    'pf-tlabel': ([('menu', "            return { kind: 'totals', el: cell };", "            return null;")], ['L-pmfix-totalLabel'], ['pmfix']),
    'pf-all': ([('menu', "            if (tg && P.collapsible() && s.rows.length > 1) {", "            if (false) {")], ['L-pmfix-labelAll', 'L-pmfix-labelCollapse'], ['pmfix']),
    'pf-clear': ([('menu', "        if (!c && cur && !cur.bd && !cur.cmp) { c = clearItem(); }", "        if (false) { c = clearItem(); }")], ['L-pmfix-clearLast', 'L-pmfix-totalLabel'], ['pmfix']),
    'pf-tidy': ([('menu', "        out.forEach(function (it) { if (it !== '-' || (tidy.length && tidy[tidy.length - 1] !== '-')) { tidy.push(it); } });", "        out.forEach(function (it) { tidy.push(it); });")], ['L-pmfix-noLeadSep'], ['pmfix']),
    'pf-sortword': ([('menu', "items.push({ act: 'pvSortAsc', label: 'Sort ascending', checked: dir === 'ascending'", "items.push({ act: 'pvSortAsc', label: t.kind === 'field' ? 'Sort A to Z' : 'Sort ascending', checked: dir === 'ascending'")], ['L-pmfield-sortAZ'], ['pmfield']),
    'pf-bdnum': ([('menu', "        if (i === 0 || labelOf(th) === '#') { return { table: table, th: th, td: cell.closest('tbody') ? cell : null, i: i, num: true }; }", "        if (i === 0 || labelOf(th) === '#') { return null; }")],
                 ['L-pmbreak-bdNumMenu', 'L-pmbreak-bdNumRow'], ['pmbreak']),
    'pf-bdnumrow': ([('menu', "        if (t.td) { items.push(copyEntry('bdCopyMenu', [rowCopyItem('bdCopyRow', function () { return bdRowLines(t); })])); items.push('-'); }", "")], ['L-pmbreak-bdNumRow'], ['pmbreak']),
    # Column stats back at the foot, after the sizes (where it was)
    'pf-bdorder': ([('menu', "        items.push({ act: 'bdStats', label: 'Column stats', sub: true, items: function () { return statsItems(null, bdProfile(t)); } });\n        var look = [];", "        var look = [];"),
                    ('menu', "        if (look.length) { items.push('-'); items = items.concat(look); }\n", "        if (look.length) { items.push('-'); items = items.concat(look); }\n        items.push({ act: 'bdStats', label: 'Column stats', sub: true, items: function () { return statsItems(null, bdProfile(t)); } });\n")],
                   ['L-pmbreak-bdWidthItems'], ['pmbreak']),
})

# (2026-11-04, pvfit) the pivot menu's Column widths list: Fit this column / Fit all column widths to contents
SCN = SCN + ['pmfit']
CHK['pmfit'] = ['fitItems', 'fitFresh', 'fitOne', 'fitUndo', 'fitValue', 'fitAll', 'fitAllUndo', 'fitCell', 'fitApi']
NEW_PF = {'L-pmfit-' + c for c in CHK['pmfit']}
NEW = NEW | NEW_PF
NEW = NEW - NEW_PF   # (pvfit is LIVE since ddc2e47, 2026-11-04: old checks now)
MUTANTS.update({
    'pf-nolist': ([('menu', "        if (wth) { items.push('-'); items.push({ act: 'pvWidth', label: 'Column widths', sub: true, items: function () { return pvWidthItems(wth); } }); }\n", "")],
                  ['L-pmfit-fitItems', 'L-pmfit-fitOne', 'L-pmfit-fitAll', 'L-pmfit-fitCell'], ['pmfit']),
    'pf-shown': ([('colw', "            if (!c || c.th !== ths[i] || c.view !== 'pivot') { continue; }", "            if (!c || c.th !== ths[i] || c.view !== 'pivot' || c.value) { continue; }")], ['L-pmfit-fitAll'], ['pmfit']),
    'pf-undo': ([('colw', "            Object.keys(before).forEach(function (k) { host.setUser(k, before[k]); });\n            apply();\n        });\n        return true;\n    }\n    function fitPivotOne(c) {",
                  "            apply();\n        });\n        return true;\n    }\n    function fitPivotOne(c) {")], ['L-pmfit-fitUndo', 'L-pmfit-fitAllUndo'], ['pmfit']),
    'pf-grey': ([('menu', "disabled: !W.pivotSized(th), why: 'It already fits its content',", "disabled: false, why: 'It already fits its content',")], ['L-pmfit-fitFresh'], ['pmfit']),
    'pf-cellth': ([('menu', "        } else if (t.kind === 'value') { th = pvCellHead(el); }", "        }")], ['L-pmfit-fitCell'], ['pmfit']),
    'pf-keys': ([('colw', "    function pivotKeysOf(c) { return c.keys ? c.keys.slice() : [c.key]; }", "    function pivotKeysOf(c) { return [c.key]; }"),
                 ('colw', "            pivotKeysOf(c).forEach(function (k) { if (!seen[k]) { seen[k] = true; out.push(k); } });", "            if (!c.value) { pivotKeysOf(c).forEach(function (k) { if (!seen[k]) { seen[k] = true; out.push(k); } }); }")], ['L-pmfit-fitAll'], ['pmfit']),
})

# (2026-11-05, bdbucket) a breakdown column's buckets: Copy > Distinct column groups and Column stats > Rows per group, over
# the breakdown's own rows; groupValues' rows / counts and an active level (dtpick C). bkNoText / bkNoSrc hold on live too.
SCN = SCN + ['pmbucket']
CHK['pmbucket'] = ['bkCopyList', 'bkCopyYear', 'bkOwnRows', 'bkCopyNum', 'bkCell', 'bkNoText', 'bkNoSrc', 'bkStatsList', 'bkStatsYear', 'bkStatsBlank', 'bkStatsCap', 'bkActive']
NEW_BK = {'L-pmbucket-' + c for c in CHK['pmbucket'] if c not in ('bkNoText', 'bkNoSrc')}
NEW = NEW | NEW_BK
NEW = NEW - NEW_BK   # (bdbucket is LIVE since 23aee43, 2026-11-05: old checks now)
MUTANTS.update({
    'k-nocopy': ([('menu', "        if (bgv.length) {\n            bcp.push({ act: 'bdCopyGroups'", "        if (false) {\n            bcp.push({ act: 'bdCopyGroups'")],
                 ['L-pmbucket-bkCopyList', 'L-pmbucket-bkCopyYear', 'L-pmbucket-bkOwnRows', 'L-pmbucket-bkCopyNum', 'L-pmbucket-bkCell'], ['pmbucket']),
    'k-reportrows': ([('menu', "var vals = api().groupValues(col, v.token, bdSrcRows(t) || []);", "var vals = api().groupValues(col, v.token);")], ['L-pmbucket-bkOwnRows'], ['pmbucket']),
    'k-nosrc': ([('menu', "            if (!rows[r].__pnbBdSrc) { return null; }\n", "            if (!rows[r].__pnbBdSrc) { continue; }\n")], ['L-pmbucket-bkNoSrc'], ['pmbucket']),
    'k-nostats': ([('menu', "        if (!Array.isArray(t)) { p.groups = bdGroupStats(t); }\n", "")],
                  ['L-pmbucket-bkStatsList', 'L-pmbucket-bkStatsYear', 'L-pmbucket-bkStatsBlank', 'L-pmbucket-bkStatsCap'], ['pmbucket']),
    'k-render': ([('menu', "        if (given && given.groups && given.groups.length) {", "        if (false) {")], ['L-pmbucket-bkStatsList', 'L-pmbucket-bkStatsYear'], ['pmbucket']),
    'k-cap': ([('menu', "list.slice(0, BD_GROUPS_MAX).forEach(", "list.forEach(")], ['L-pmbucket-bkStatsCap'], ['pmbucket']),
    'k-count': ([('main', "                tally[k] = (tally[k] || 0) + 1;", "                tally[k] = (tally[k] || 0) + 2;")], ['L-pmbucket-bkStatsYear', 'L-pmbucket-bkActive'], ['pmbucket']),
    'k-blank': ([('main', "        if (none) list.push({ v: '', n: none });", "")], ['L-pmbucket-bkStatsBlank', 'L-pmbucket-bkActive'], ['pmbucket']),
    'k-active': ([('main', "        if (!spec || (spec.multi && !spec.active) || !masterRowData) return null;", "        if (!spec || spec.multi || !masterRowData) return null;")], ['L-pmbucket-bkActive'], ['pmbucket']),
    'k-sort': ([('main', "        try { out.sort(pivotSplitComparator(spec.split, spec.base)); } catch (e) { }\n", "")], ['L-pmbucket-bkActive'], ['pmbucket']),
})

# (2026-11-05, bdbucket 2; the user: "I dont see the bucketing by delimited strings using your example on int-col-mat for
# PI_LIST or DEPARTMENT_LIST") a list column's Split by in both breakdown lists; groupValues / groupCounts take a split.
# k-active re-aimed (its guard line went): the END never read.
CHK['pmbucket'] = CHK['pmbucket'] + ['bkSplit', 'bkSplitStats', 'bkSplitApi']
NEW_BK2 = {'L-pmbucket-bkSplit', 'L-pmbucket-bkSplitStats', 'L-pmbucket-bkSplitApi'}
NEW = NEW | NEW_BK2
NEW = NEW - NEW_BK2   # (bdbucket 2 is LIVE since ed497b9, 2026-11-05: old checks now)
MUTANTS.update({
    'k-active': ([('main', "                var v = m.get(c);\n                if (v === undefined) v = m.get(String(c).toUpperCase());",
                   "                var v = null;\n                if (v === undefined) v = m.get(String(c).toUpperCase());")], ['L-pmbucket-bkActive'], ['pmbucket']),
    'k-nodelim': ([('menu', "        return A.groupVariants(col) || [];", "        return (A.groupVariants(col) || []).filter(function (v) { return !v.delim; });")],
                  ['L-pmbucket-bkSplit', 'L-pmbucket-bkSplitStats'], ['pmbucket']),
    'k-delimnull': ([('main', "        if (!spec || !masterRowData) return null;", "        if (!spec || (spec.multi && !spec.active) || !masterRowData) return null;")],
                    ['L-pmbucket-bkSplit', 'L-pmbucket-bkSplitStats', 'L-pmbucket-bkSplitApi'], ['pmbucket']),
    'k-splitone': ([('main', "            var ks = !spec.multi ? [spec.label(raw)] :", "            var ks = !spec.active ? [spec.label(raw)] :")],
                   ['L-pmbucket-bkSplit', 'L-pmbucket-bkSplitApi'], ['pmbucket']),
    'k-noun': ([('menu', "var noun = v.delim ? ' distinct value' : ' distinct group';", "var noun = ' distinct group';")], ['L-pmbucket-bkSplit'], ['pmbucket']),
    'k-listhead': ([('menu', "(v.delim ? 'Rows listing each value' : 'Rows in each group')", "'Rows in each group'")], ['L-pmbucket-bkSplitStats'], ['pmbucket']),
})

# (2026-11-05, bdbucket sweep; the user: "Full bugsweep of this and lets close out this feature") the reviews' findings:
# a split's text order, decoded labels, (Blank) past 50, Rows per group lines as keyboard stops (+ the first stop in sight),
# no number stats on a list column, long labels cut with the whole as the tooltip
CHK['pmbucket'] = CHK['pmbucket'] + ['bkSplitSort', 'bkEntity', 'bkCapBlank', 'bkKbd', 'bkKbdScroll', 'bkListStats', 'bkLongLabel']
NEW_BK3 = {'L-pmbucket-' + c for c in ['bkSplitSort', 'bkEntity', 'bkCapBlank', 'bkKbd', 'bkKbdScroll', 'bkListStats', 'bkLongLabel']}
NEW = NEW | NEW_BK3
NEW = NEW - NEW_BK3   # (the bdbucket sweep is LIVE since 06ab0b7, 2026-11-05: old checks now)
MUTANTS.update({
    's-dsort': ([('main', "        if (spec.delim) { try { out.sort(getCustomSortComparator(String(token)) || function (a, b) { return String(a).localeCompare(String(b)); }); } catch (e) { } }\n", "")], ['L-pmbucket-bkSplitSort'], ['pmbucket']),
    's-ent': ([('main', "                if (!spec.multi && k.indexOf('&') !== -1) k = decodeHtmlEntities(k);", "")], ['L-pmbucket-bkEntity'], ['pmbucket']),
    's-blank': ([('menu', "var blank = list[list.length - 1].v === '' ? list.pop() : null,", "var blank = null,")], ['L-pmbucket-bkCapBlank'], ['pmbucket']),
    's-ronly': ([('menu', "        if (it.readOnly) { return; }", "")], ['L-pmbucket-bkKbd'], ['pmbucket']),
    's-info': ([('menu', "        return { act: 'bdStatsRow-' + k, label: shown, note: c, readOnly: true,", "        return { info: shown, value: c, act: 'bdStatsRow-' + k, readOnly: true,")], ['L-pmbucket-bkKbd', 'L-pmbucket-bkLongLabel'], ['pmbucket']),
    's-scroll': ([('menu', "        if (i === 0 && sc && typeof it[i].scrollIntoView === 'function' && it[i].getBoundingClientRect().bottom > sc.getBoundingClientRect().bottom)", "        if (false)")], ['L-pmbucket-bkKbdScroll'], ['pmbucket']),
    's-listnum': ([('menu', "        if (allNum && !Array.isArray(t) && bdGroupVariants(t).some(function (v) { return v.delim; })) { allNum = false; }\n", "")], ['L-pmbucket-bkListStats'], ['pmbucket']),
    's-cut': ([('menu', "shown = full.length > 28 ? full.slice(0, 27) + '...' : full,", "shown = full,")], ['L-pmbucket-bkLongLabel'], ['pmbucket']),
})

# (2026-11-05, bdbucket older issues; the user: "fix the older issues, then full e2e then full bugsweep on this") FY99
# before FY00 (a two-digit year's window), no By Hour on a date-only column
CHK['pmbucket'] = CHK['pmbucket'] + ['bkFy99', 'bkNoHour']
NEW_BK4 = {'L-pmbucket-bkFy99', 'L-pmbucket-bkNoHour'}
NEW = NEW | NEW_BK4
NEW = NEW - NEW_BK4   # (the bdbucket older issues are LIVE since c53b3e2, 2026-11-05: old checks now)
MUTANTS.update({
    'o-fy': ([('main', "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); if (!m) return null; var y = 2000 + +m[1]; return y > new Date().getFullYear() + 30 ? y - 100 : y; },",
               "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); return m ? 2000 + +m[1] : null; },")], ['L-pmbucket-bkFy99'], ['pmbucket']),
    'o-fyq': ([('main', "if (!m) return null; var y = 2000 + +m[1]; if (y > new Date().getFullYear() + 30) y -= 100; return y * 10 + (+m[2]); },",
                "if (!m) return null; var y = 2000 + +m[1]; return y * 10 + (+m[2]); },")], ['L-pmbucket-bkFy99'], ['pmbucket']),
    'o-hour': ([('main', "hour: { kind: 'cycle', label: 'Hour', chip: 'Hr', ex: '00–23', minGran: 3,", "hour: { kind: 'cycle', label: 'Hour', chip: 'Hr', ex: '00–23', minGran: 0,")],
               ['L-pmbucket-bkNoHour'], ['pmbucket']),
})

# (2026-11-05, bdbucket final sweep; the user: "...then full bugsweep on this and we can close this out") a two-digit FY as
# the date parser reads one (00-68 = 20xx, 69-99 = 19xx), '&nbsp;' / spaces join no group, Rows per group's lines read-only
# to the eye, the column menu's active copy acts. The older mutants whose lines changed: the same breakage, the new text.
CHK['pmbucket'] = CHK['pmbucket'] + ['bkFy68', 'bkNbsp', 'bkRoLine', 'bkCopyActIds']
NEW_BK5 = {'L-pmbucket-bkFy68', 'L-pmbucket-bkNbsp', 'L-pmbucket-bkRoLine', 'L-pmbucket-bkCopyActIds'}
NEW = NEW | NEW_BK5
NEW = NEW - NEW_BK5   # (the bdbucket final sweep is LIVE since 8f1fae5, 2026-11-05: old checks now)
MUTANTS.update({
    's-ent': ([('main', "if (!spec.multi) { if (k.indexOf('&') !== -1) k = decodeHtmlEntities(k); k = k.trim(); if (k === '') return; }",
                "if (!spec.multi) { k = k.trim(); if (k === '') return; }")], ['L-pmbucket-bkEntity'], ['pmbucket']),
    'o-fy': ([('main', "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); if (!m) return null; var y = +m[1]; return y + (y <= 68 ? 2000 : 1900); },",
               "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); return m ? 2000 + +m[1] : null; },")], ['L-pmbucket-bkFy99', 'L-pmbucket-bkFy68'], ['pmbucket']),
    'o-fyq': ([('main', "if (!m) return null; var y = +m[1]; y += y <= 68 ? 2000 : 1900; return y * 10 + (+m[2]); },",
                "if (!m) return null; var y = 2000 + +m[1]; return y * 10 + (+m[2]); },")], ['L-pmbucket-bkFy99', 'L-pmbucket-bkFy68'], ['pmbucket']),
    'f-fywin': ([('main', "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); if (!m) return null; var y = +m[1]; return y + (y <= 68 ? 2000 : 1900); },",
                  "sortVal: function (s) { var m = /^FY(\\d{2})$/i.exec(s); if (!m) return null; var y = 2000 + +m[1]; return y > new Date().getFullYear() + 30 ? y - 100 : y; },")],
                ['L-pmbucket-bkFy68'], ['pmbucket']),
    'f-fyqwin': ([('main', "if (!m) return null; var y = +m[1]; y += y <= 68 ? 2000 : 1900; return y * 10 + (+m[2]); },",
                   "if (!m) return null; var y = 2000 + +m[1]; if (y > new Date().getFullYear() + 30) y -= 100; return y * 10 + (+m[2]); },")],
                 ['L-pmbucket-bkFy68'], ['pmbucket']),
    'f-trim': ([('main', "if (!spec.multi) { if (k.indexOf('&') !== -1) k = decodeHtmlEntities(k); k = k.trim(); if (k === '') return; }",
                 "if (!spec.multi) { if (k.indexOf('&') !== -1) k = decodeHtmlEntities(k); }")], ['L-pmbucket-bkNbsp'], ['pmbucket']),
    'f-roclass': ([('menu', "(it.readOnly ? ' pnb-hm-ro' : '')", "''")], ['L-pmbucket-bkRoLine'], ['pmbucket']),
    'f-rocur': ([('mcss', ".pnb-hm-item.pnb-hm-ro { cursor: default; }\n", "")], ['L-pmbucket-bkRoLine'], ['pmbucket']),
    'f-rohov': ([('mcss', ".pnb-hm-item.pnb-hm-ro:hover:not(:focus-visible) { background: transparent; color: inherit; }\n", "")], ['L-pmbucket-bkRoLine'], ['pmbucket']),
    'f-actid': ([('menu', "var id = v.active ? 'active' + v.active : String(v.token).split(':').pop();", "var id = String(v.token).split(':').pop();")],
                ['L-pmbucket-bkCopyActIds'], ['pmbucket']),
})

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
RELS = {'main': os.path.join('js', 'main.js'), 'menu': os.path.join('js', 'penumbra_colmenu.js'), 'mcss': os.path.join('css', 'penumbra_colmenu.css'), 'colw': os.path.join('js', 'penumbra_colwidths.js'),
        'css': os.path.join('css', 'main.css'), 'index': 'index.php'}
cand = {k: pick(v) for k, v in RELS.items()}
if control: cand = {k: os.path.join(APP, v) for k, v in RELS.items()}
def read_b(p): return open(p, 'rb').read().decode('utf-8', 'surrogateescape')

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
        hit = None
        for o, n in ((old, new), (old.replace('\n', '\r\n'), new.replace('\n', '\r\n'))):
            if t[f].count(o) == 1: hit = (o, n); break
        if not hit: raise SystemExit("mutant '%s': %s anchor not found once: %r" % (name, f, old[:90]))
        t[f] = t[f].replace(hit[0], hit[1])
    return t

stage = tempfile.mkdtemp(prefix='pnb_pm_')
for f in LIBS: shutil.copyfile(os.path.join(APP, 'js', f), os.path.join(stage, f))
for f in ('density.css', 'penumbra_colwidths.css'): shutil.copyfile(os.path.join(APP, 'css', f), os.path.join(stage, f))
open(os.path.join(stage, 'help_stub.js'), 'wb').write(b'window.__HELP_STUB = "";\n')
shutil.copyfile(os.path.join(HERE, 'driver.js'), os.path.join(stage, 'driver.js'))
sys.path.insert(0, HERE)
import mk_harness
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
        call('Page.navigate', {'url': 'http://127.0.0.1:%d/%s' % (hp, path)})
        t0 = time.time()
        while time.time() - t0 < 300:
            time.sleep(0.25)
            v = call('Runtime.evaluate', {'expression': 'window.__HCDONE ? JSON.stringify(window.__HCRESULT) : null', 'returnByValue': True}).get('result', {}).get('value')
            if v:
                if os.environ.get('PNB_SHOT') and 'pmshot' in path:
                    import base64
                    shot = call('Page.captureScreenshot', {'format': 'png'})
                    open(os.environ['PNB_SHOT'], 'wb').write(base64.b64decode(shot.get('data', '')))
                return json.loads(v)
        return {'fatal': 'timeout (300 s)'}
    finally:
        try: ws.close()
        except Exception: pass
        try: urllib.request.urlopen('http://127.0.0.1:%d/json/close/%s' % (dp, t['id']), timeout=10).read()
        except Exception: pass

def write_stage(texts):
    def w(name, s): open(os.path.join(stage, name), 'wb').write(s.encode('utf-8', 'surrogateescape'))
    w('harness.html', mk_harness.build(texts['index']))
    w('main_hc.js', hook(texts['main']))
    w('main.css', texts['css'])
    w('penumbra_colmenu.js', texts['menu'])
    w('penumbra_colmenu.css', texts['mcss'])
    w('penumbra_colwidths.js', texts['colw'])   # (colmenu round 27) the staged width module, not LIBS' live copy

def run_browser(scns):
    out = []
    for s in scns:
        r = run_page('harness.html?scn=%s' % s)
        if r.get('fatal'):
            out.append(('F-' + s, False, (r.get('fatal') or '')[:400])); continue
        out.append(('E-' + s, not r.get('errors'), 'errors %s' % r.get('errors')))
        chk = r.get('chk') or {}
        for c in CHK[s]:
            v = chk.get(c)
            out.append(('L-%s-%s' % (s, c), v is True, '%s%s' % (v, ('   info %s' % json.dumps(r.get('info'))[:500]) if v is not True else '')))
    return out

try:
    texts = {k: read_b(v) for k, v in cand.items()}
    print('under test: %s' % json.dumps({k: v.split('penumbra')[-1] for k, v in cand.items()}))
    if all_mutants or one_mutant:
        okc = bad = 0
        for m in ([one_mutant] if one_mutant else list(MUTANTS)):
            edits, must, scns = MUTANTS[m]
            write_stage(mutate(texts, m))
            res = run_browser(scns)
            red = [a for a, p, _ in res if not p]
            good = not [x for x in must if x not in red]
            okc += good; bad += (not good)
            print('  %s  mutant %-12s turns %s red   [red: %s]' % ('PASS' if good else 'FAIL', m, ' '.join(must), ' '.join(red)))
        print('SUMMARY mutants ok=%d bad=%d' % (okc, bad))
        print('RESULT: GREEN' if bad == 0 else 'RESULT: RED')
    else:
        write_stage(texts)
        res = run_browser(SCN)
        p = f = 0; failed = []
        for a, passed, d in res:
            print('  %s  %-28s %s' % ('PASS' if passed else 'FAIL', a, d[:500]))
            if passed: p += 1
            else: f += 1; failed.append(a)
        print('TOTAL pass=%d fail=%d   failed: %s' % (p, f, ' '.join(failed)))
        if control:
            green_new = [a for a, passed, _ in res if passed and a in NEW]
            red_old = [a for a, passed, _ in res if not passed and a not in NEW and not a.startswith('F-')]
            print('CONTROL: new checks green on live (unexpected): %s' % (' '.join(green_new) or 'none'))
            print('CONTROL: old checks red on live (unexpected): %s' % (' '.join(red_old) or 'none'))
            print('RESULT: GREEN' if not green_new and not red_old else 'RESULT: RED')
        else:
            print('RESULT: GREEN' if f == 0 and p > 0 else 'RESULT: RED')
finally:
    try: edge.kill()
    except Exception: pass
    try: srv.kill()
    except Exception: pass
    time.sleep(1)
    shutil.rmtree(stage, ignore_errors=True)
