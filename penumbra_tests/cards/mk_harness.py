# cards: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture, 300 rows;
# shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS, hidden H_*; the column options, calculated
# column, column width and header menu modules; g* scenarios open grouped by H_GROUP, p* on a
# pivot) PLUS the card view: css/penumbra_cards.css + js/penumbra_cards.js (after main.js, as
# index.php loads them), the Table / Cards switch, the card host and the View Options Cards card
# LIFTED from the index.php under test (absent on the control: live has none of them), the pager
# buttons, the Exit pivot button, the registry's theme CSS (theme_vars.css) and ids (themes.js)
# for the 18-theme contrast check, and per-scenario stored states / seeds (see SCN in run.py).
import importlib.util, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
COLMENU = os.environ.get('PNB_COLMENU_HARNESS') or os.path.join(HERE, '..', 'colmenu', 'mk_harness.py')
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness_cards', COLMENU)
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)

# the Cards option each scenario's stored report carries ({} = on with guesses)
CFG = {
    'cauto': {}, 'cguess': {}, 'cpage': {}, 'pcoff': {}, 'gcards': {}, 'gcoll': {}, 'gncoll': {}, 'ggcards': {}, 'gglnest': {}, 'cvlA': {}, 'cvlB': {}, 'cvlT': {}, 'cphone': {}, 'cperf': {}, 'cmore': {},
    'cesc': {'title': 'V_NAME'},
    'cfull': {'title': 'V_NAME', 'sub': ['V_ID', 'V_STATUS'], 'big': 'H_AMT', 'pill': 'V_STATUS', 'bar': 'H_NUM', 'fields': ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE']},
    'chl': {'pill': 'V_STATUS'}, 'cbar': {'bar': 'V_AMOUNT'}, 'ca11y': {'pill': 'V_STATUS', 'bar': 'H_NUM', 'sub': ['V_ID']},
    'cauthB': {'title': 'V_NAME', 'sub': ['V_ID'], 'big': 'H_AMT', 'pill': 'V_STATUS', 'bar': 'H_NUM', 'fields': ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE']},
    'cauthM': {'title': 'GONE_COL', 'fields': ['V_DATE', 'GONE2']},
    'cviewer': {'title': 'V_NAME'},
    # (csize) sizes and the phone default
    'csize': {'size': 'large'}, 'cszvlA': {}, 'cszvlB': {}, 'cnarrowA': {}, 'cnarrowT': {},
    # (cxl) Extra large; (cmenu) the right-click menus (a pill = V_STATUS gives a text value to filter to; the V_LINK field a link)
    'cxl': {'size': 'xl'}, 'cxlvl': {}, 'cmenu': {'pill': 'V_STATUS'}, 'gmenu': {}, 'pmenu': {}, 'cmsize': {'pill': 'V_STATUS'}, 'gmsize': {},
    # (cdet) the details window: a card showing three HIDDEN columns (the window must list none of them)
    'cdet': {'title': 'V_NAME', 'big': 'H_AMT', 'pill': 'V_STATUS', 'bar': 'H_NUM', 'fields': ['V_DATE', 'H_TEXT']}, 'gdet': {}, 'pdet': {}, 'cdetph': {},
}
# the viewer's own saved pick (penumbra_column_prefs.lrfix.view = cards), seeded before boot
PREF_CARDS = ['cfull', 'pcoff', 'gcards', 'gcoll', 'gncoll', 'ggcards', 'gglnest', 'cvlT', 'ca11y', 'cphone', 'cbar', 'chl', 'cviewer', 'csize', 'cxl', 'cmenu', 'gmenu', 'pmenu', 'cmsize', 'gmsize', 'cdet', 'gdet', 'pdet', 'cdetph']
PREF_TABLE = ['cnarrowT']   # (csize) the viewer chose Table: the phone default yields


def _lift(index_src, rx, what):
    if index_src is None: return ''
    m = re.search(rx, index_src, re.S)
    return m.group(0) if m else ''   # '' on the control (live has no card view)


def build(index_src):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    # index.php's viewport meta (line 74): without it a phone lays the page out 980px wide
    rep('<title>colmenu</title>', '<title>cards</title>\n<meta name="viewport" content="width=device-width, initial-scale=1">')
    rep('<link rel="stylesheet" href="penumbra_colmenu.css">\n',
        '<link rel="stylesheet" href="penumbra_colmenu.css">\n<link rel="stylesheet" href="penumbra_cards.css">\n<link rel="stylesheet" href="theme_vars.css">\n')
    # index.php order: the card view after main.js (and the column modules); the theme ids for the driver
    rep('<script src="driver.js"></script>\n', '<script src="penumbra_cards.js"></script>\n<script src="themes.js"></script>\n<script src="driver.js"></script>\n')
    # the switch, after the row count (index.php: inside #tableSearchContainer; the harness keeps the count beside it)
    sw = _lift(index_src, r'<span id="pnbCardsSwitch"[^\n]*', 'the switch')
    szs = _lift(index_src, r'<select id="pnbCardsSize"[^\n]*', 'the size control')   # (csize)
    rep('<span id="resultCount"></span>', '<span id="resultCount"></span>' + sw + szs)
    host = _lift(index_src, r'<div id="pnbCardsHost"[^\n]*', 'the host')
    rep('<div id="pivot-output-container" style="display:none"></div></div>', '<div id="pivot-output-container" style="display:none"></div>' + host + '</div>')
    # the View Options Cards card (the editor's form), in a #view-options-tab of its own; the Exit pivot button
    vo = _lift(index_src, r'<div class="view-option-item pnb-cards-vo">.*?pnb-cards-note.*?</p>\s*</div>\s*</div>', 'the Cards card')
    vo = re.sub(r'<span class="tab-help-icon"[^>]*>\?</span>', '', vo)
    rep('<div id="pnbStatusBar">', '<div id="view-options-tab" style="display:none"><div class="view-options-grid">' + vo + '</div></div>\n<button id="exitPivotModeBtn" type="button">Exit pivot</button>\n<div id="pnbStatusBar">')
    # the pager buttons, so a scenario turns pages through main.js's own handlers
    rep('<span id="pageInfo"></span>', '<span id="pageInfo"></span><button id="firstPageBtn">|&lt;</button><button id="prevPageBtn">&lt;</button>'
        '<button id="nextPageBtn">&gt;</button><button id="lastPageBtn">&gt;|</button>')
    # cperf / cmore: a big report (?rows=N, default 1000), the usual six columns shown
    rep('(/^mperf|^mrerun/.test(window.__SCN) ? (+P.get("rows") || 20000) : 300)',
        '(/^mperf|^mrerun/.test(window.__SCN) ? (+P.get("rows") || 20000) : (/^(cperf|cmore)$/.test(window.__SCN) ? (+P.get("rows") || 1000) : 300))')
    # cesc: a value the server escaped (an image tag as text) in the title column
    rep('    window.__rowsFixture = rows;\n',
        '    if (window.__SCN === "cesc") rows[0].V_NAME = "&lt;img src=x onerror=\\"window.__pwn=1\\"&gt; Alpha";\n'
        '    window.__rowsFixture = rows;\n')
    # the stored report: the Cards option, the page size, a report highlight rule, a grouped subtotal
    cfg = '{' + ', '.join('%s: %s' % (k, _js(v)) for k, v in CFG.items()) + '}'
    rep('    window.__STORED = st;\n',
        '    window.__CARDS_CFG = ' + cfg + ';\n'
        '    if (Object.prototype.hasOwnProperty.call(window.__CARDS_CFG, S)) st.viewOptions = Object.assign({}, st.viewOptions || {}, { cards: window.__CARDS_CFG[S] });\n'
        '    if (S === "cpage") st.rowsPerPage = "25";\n'
        '    if (S === "cguess") { st.visibleColumns = ["#", 0, 1, 7, 2, 3, 4, 5]; st.columnOrder = [0, 1, 7, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; }\n'
        '    if (S === "cperf" || S === "cmore") st.rowsPerPage = "all";\n'
        '    if (S === "chl") st.columnHighlights = { V_STATUS: [{ id: "r1", w: "V_STATUS = //Closed//", css: "background-color: #ffebee; color: #c62828; font-weight: bold" }] };\n'
        '    if (S === "gcards") st.groupAgg = { column: "H_AMT", type: "sum" };\n'
        '    if (S === "ggcards" || S === "gglnest") st.groupLayout = "list";   // (glist) the List layout (the colmenu harness loads penumbra_grouplist.js for gg*)\n'
        '    if (S === "gglnest") st.groupBy = "H_GROUP,H_GROUP2";\n'
        '    window.__STORED = st;\n')
    # a viewer (cviewer): no View Options form, the report's option alone
    rep('    window.__queryResponse = { data: rows };\n',
        '    if (S === "cviewer") { window.penumbra_vars.canEditReport = false; window.penumbra_vars.isAdmin = false; window.penumbra_vars.isGlobalAdmin = false; }\n'
        '    window.__queryResponse = { data: rows };\n')
    # seeds: the viewer's saved pick; cbar's data bar on V_AMOUNT (the Settings panel's shading pref)
    rep("  (function () { try { localStorage.clear(); } catch (e) {} })();\n",
        "  (function () { try { localStorage.clear(); } catch (e) {} })();\n"
        "  (function () { try { var cs = new URLSearchParams(location.search).get('scn') || '';\n"
        "    var pref = " + _js(PREF_CARDS) + ".indexOf(cs) >= 0 ? { view: 'cards' } : (" + _js(PREF_TABLE) + ".indexOf(cs) >= 0 ? { view: 'table' } : null);\n"
        "    if (cs === 'cbar') pref = Object.assign(pref || {}, { shade: { V_AMOUNT: 'bar' } });\n"
        "    if (pref) localStorage.setItem('penumbra_column_prefs', JSON.stringify({ lrfix: pref }));\n"
        "    if (cs === 'cviewer') { var vt = document.getElementById('view-options-tab'); if (vt) vt.parentNode.removeChild(vt); }   // a viewer has no View Options form\n"
        "  } catch (e) {} })();\n")
    return src


def _js(v):
    import json
    return json.dumps(v)


if __name__ == '__main__':
    APP = r'\\oitras.oit.ncsu.edu\c$\inetpub\wwwroot\sponsor_migration\penumbra'
    open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(build(open(os.path.join(APP, 'index.php'), encoding='utf-8', errors='surrogateescape').read()))
    print('harness written')
