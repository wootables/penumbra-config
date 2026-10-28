# viewlink: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture, 300 rows;
# shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*; the column options, calculated
# column, column width and header menu modules; g* scenarios open grouped by H_GROUP, p* scenarios
# on a pivot) PLUS seed.js right after the harness's localStorage.clear(): the viewer's own saved
# column prefs a scenario starts from (vwins*). The page is opened as harness.html?scn=S&id=lrfix
# [&view=TOKEN] - the ?id= is what makes a view link apply (saved reports only).
import importlib.util, os
HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness_vl', os.path.join(HERE, '..', 'colmenu', 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)


def build(index_src):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>viewlink</title>')
    # (10-27 b) the selected-cells scenarios need the cell selection module (the colmenu harness loads it for gg*/mauto* only)
    rep('<script src="penumbra_colmenu.js"></script>\n',
        '<script>if (/^vsel|^pvsel|^vpsel|^vcmp[ST]$/.test(window.__SCN)) document.write(\'<link rel="stylesheet" href="penumbra_cellsel.css">\' +\n'
        '  \'<script src="penumbra_cellsel.js"></scr\' + \'ipt>\');</script>\n'
        '<script src="penumbra_colmenu.js"></script>\n')
    rep('<script src="jquery-3.7.1.min.js"></script>\n', '<script src="seed.js"></script>\n<script src="jquery-3.7.1.min.js"></script>\n')
    # the View Options boxes a state load sets (index.php's ids): a link must never move them
    rep('<div id="pnbStatusBar">', '<div id="zzViewOptions" style="display:none"><input type="checkbox" id="viewOptionSearch" checked>'
        '<input type="checkbox" id="viewOptionExport" checked></div>\n<div id="pnbStatusBar">')
    # (round 3) vcc*: the REPORT carries a calculated column of its own (TRIPLE)
    rep('    window.__STORED = st;\n', '    if (/^vcc/.test(S)) st.calcColumns = [{ name: "TRIPLE", formula: "{H_NUM} * 3", format: "number" }];\n    window.__STORED = st;\n')
    # (round 3) the Email dialog's link options + its notice box: the "Open it in your view" row LIFTED
    # from the index.php under test (absent on the control), the rest by id as index.php has them
    import re
    m = re.search(r'<div id="emailViewLinkRow".*?</div>', index_src)
    rep('<div id="pnbStatusBar">', '<div id="emailLightbox" style="display:none"><div id="emailWarnings"></div>'
        '<label><input type="checkbox" id="emailInsertData" checked> Insert</label><label><input type="checkbox" id="emailIncludeSnippet"> Header</label>'
        '<label><input type="checkbox" id="emailIncludeLink"> Include a link to the live report</label><br>'
        + (m.group(0) if m else '') +
        '<label><input type="checkbox" id="emailShowRecipients"> Show</label><label><input type="checkbox" id="emailAttachPDF"> PDF</label>'
        '<div id="emailRecipientContainer"></div></div>\n<div id="pnbStatusBar">')
    # (round 4) a second theme in the registry, so a theme other than the default can ride
    rep("  window.PENUMBRA_THEMES = { 'theme-default': { label: 'Default' } };\n  window.PENUMBRA_THEME_IDS = ['theme-default'];",
        "  window.PENUMBRA_THEMES = { 'theme-default': { label: 'Default' }, 'theme-dark-blue': { label: 'Dark Blue' } };\n  window.PENUMBRA_THEME_IDS = ['theme-default', 'theme-dark-blue'];")
    # (round 5) the console's Share button (main.js binds it at boot)
    rep('<div id="pnbStatusBar">', '<button id="shareQuery" type="button">Share</button>\n<div id="pnbStatusBar">')
    # (round 6) Find, after main.js as index.php loads it (the candidate's, written by run.py)
    rep('<script src="driver.js"></script>\n', '<link rel="stylesheet" href="penumbra_find.css">\n<script src="penumbra_find.js"></script>\n<script src="driver.js"></script>\n')
    # (sweep) vfmsave: the REPORT formats V_AMOUNT itself
    rep('    window.__STORED = st;\n', '    if (S === "vfmsave") st.columnFormats = { V_AMOUNT: "currency:0", V_DATE: "date:YYYY" };\n    window.__STORED = st;\n')
    # (10-23) a snapshot comparison: manage_snapshots.php?action=load answers with a baseline (the fixture's
    # first 280 rows, every 25th row's V_STATUS changed), and the analysis banner's Copy link button
    rep("    var resp = isQuery ? window.__queryResponse :",
        "    if (/manage_snapshots\\.php/.test(url) && /action=load/.test(url)) {\n"
        "      var snapRows = window.__rowsFixture.slice(0, 280).map(function (r, i) { var c = {}; for (var k in r) c[k] = r[k]; if (i % 25 === 0) c.V_STATUS = 'Archived'; return c; });\n"
        "      var snapJs = { status: 'success', data: { SNAP_DATA: JSON.stringify(snapRows.map(function (r) { return { rowData: r }; })), SNAP_NAME: 'Baseline', CREATED_AT: '2026-10-01 10:00:00', CREATED_BY: 'harness',\n"
        "        ROW_COUNT: 280, COLUMN_COUNT: window.__COLS.length, COLUMN_NAMES: window.__COLS.join(','), PROMPTS: [], TABLES_USED: '', NOTES: '' } };\n"
        "      setTimeout(function () { try { if (opts.success) opts.success(snapJs, 'success', { status: 200 }); } catch (e) { window.__errors.push('snap success threw: ' + String(e)); } d.resolve(snapJs, 'success', { status: 200 }); }, 0);\n"
        "      var sp9 = d.promise(); sp9.abort = function () {}; return sp9;\n"
        "    }\n"
        "    var resp = isQuery ? window.__queryResponse :")
    # the analysis banner's template, LIFTED from the index.php under test (its Copy link buttons included)
    import re as _re
    tm = _re.search(r'<template id="snapshotAnalysisTemplate">.*?</template>', index_src, _re.S)
    rep('<div id="pnbStatusBar">', '<div id="snapAnalysisDock"></div>\n' + (tm.group(0) if tm else '') + '\n'
        '<div id="manageSnapshotsLightbox" style="display:none"><input type="checkbox" id="snapIncludeToggles"></div>\n<div id="pnbStatusBar">')
    # (10-23 b) ggc*: a report grouped as a LIST, so its snapshot comparison is listed too (grplistcmp)
    rep('    window.__STORED = st;\n', '    if (/^ggc/.test(S)) st.groupLayout = "list";\n    window.__STORED = st;\n')
    # (page round) the pager buttons, so a scenario turns pages through main.js's own handlers
    rep('<span id="pageInfo"></span>', '<span id="pageInfo"></span><button id="firstPageBtn">|&lt;</button><button id="prevPageBtn">&lt;</button>'
        '<button id="nextPageBtn">&gt;</button><button id="lastPageBtn">&gt;|</button>')
    return src
