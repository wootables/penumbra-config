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
        '<label><input type="checkbox" id="emailIncludeLink"> Prepend link for recipients to access live report</label><br>'
        + (m.group(0) if m else '') +
        '<label><input type="checkbox" id="emailShowRecipients"> Show</label><label><input type="checkbox" id="emailAttachPDF"> PDF</label>'
        '<div id="emailRecipientContainer"></div></div>\n<div id="pnbStatusBar">')
    # (round 4) a second theme in the registry, so a theme other than the default can ride
    rep("  window.PENUMBRA_THEMES = { 'theme-default': { label: 'Default' } };\n  window.PENUMBRA_THEME_IDS = ['theme-default'];",
        "  window.PENUMBRA_THEMES = { 'theme-default': { label: 'Default' }, 'theme-dark-blue': { label: 'Dark Blue' } };\n  window.PENUMBRA_THEME_IDS = ['theme-default', 'theme-dark-blue'];")
    # (page round) the pager buttons, so a scenario turns pages through main.js's own handlers
    rep('<span id="pageInfo"></span>', '<span id="pageInfo"></span><button id="firstPageBtn">|&lt;</button><button id="prevPageBtn">&lt;</button>'
        '<button id="nextPageBtn">&gt;</button><button id="lastPageBtn">&gt;|</button>')
    return src
