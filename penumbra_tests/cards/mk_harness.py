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
    'cmword': {'pill': 'V_STATUS'},   # (cardword) the guessed fields V_NAME / V_DATE / V_LINK, a pill to right-click
    # (curl) curl1 and curl4 have NO entry: the report's option is off there; curl2 / curl3 / cshare have it on
    'curl2': {}, 'curl3': {}, 'cshare': {},
    'cnote': {}, 'cnotedet': {}, 'ctmenu': {}, 'cflink': {},   # (cardnotes) the notes in the card (the driver turns row notes on)
    # (round K) the card's words (a pill to right-click); Find on cards showing V_NAME, V_AMOUNT (the big number, guessed)
    # and V_DATE alone (V_ID, V_LINK, V_STATUS buried); grouped; a TEXT column picked for the bar (stays pickable)
    'ckword': {'pill': 'V_STATUS'}, 'cfind': {'title': 'V_NAME', 'fields': ['V_DATE']}, 'gfind': {}, 'cbarpick': {'bar': 'V_STATUS'},
    # (round L) the Sort list flat and grouped; a field that is blank on some rows (H_NULL: null / '' / a word); Find on
    # pivot tiles; the viewer's own title and fields over the report's (clayoutB: seeded)
    'csort': {}, 'gsort': {}, 'cempty': {'title': 'V_NAME', 'fields': ['H_NULL', 'V_DATE']}, 'pfind': {},
    'clayout': {'title': 'V_NAME', 'fields': ['V_DATE']}, 'clayoutB': {'title': 'V_NAME', 'fields': ['V_DATE']},
    'cdetrow': {'title': 'V_NAME'},   # (the sweep) the details window keeps its row: 25 rows a page, as cpage
    'pvfind': {},   # (round M) Find on a pivot of three measures (pv*: Amt, N, Mean)
    # (round O) a card with every part (white space vs text); the details past the page (25 a page) and past the 1,000
    # drawn (1,003 rows, All); the status bar's Cards segment
    'cwhite': {'title': 'V_NAME', 'big': 'H_AMT', 'pill': 'V_STATUS', 'bar': 'H_NUM', 'fields': ['V_DATE', 'V_ID']}, 'cdetpage': {}, 'cdetmore': {}, 'cseg': {},
    # (round P) Extra large with four short fields (one row's status made long), on a desktop and on a phone; ccolsview has
    # NO entry: a report with no card setup (the Cards segment not shown yet)
    'gboard': {}, 'cboard': {'pill': 'H_GROUP'}, 'cboardload': {},   # (round S) the board
    'cfieldsB': {'title': 'V_NAME', 'fields': ['V_ID', 'V_DATE']},   # (round R) the viewer's kept labels-off setup seeded over it
    'cfields': {'title': 'V_NAME', 'fields': ['V_ID', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_CODE', 'H_NUM', 'H_DATE', 'H_MONEY', 'H_AMT']},   # (round R) ten fields
    'cfmt': {'title': 'V_NAME', 'sub': ['V_STATUS'], 'big': 'H_AMT', 'fields': ['V_DATE', 'V_ID']},   # (cfmt) highlight rules on every part
    'cfmtbig': {'title': 'V_NAME', 'fields': ['V_DATE']},   # (cfmt2) the same rules on 2,500 rows: main.js defers its format pass
    'pvhtml': {},   # (round Q) a pivot on link-valued fields (the rows patch below)
    'cbarrank': {'bar': 'H_NUM'}, 'cvlC': {}, 'cvlD': {},   # (clbar) the rank-scaled bar; the link's card setup (cvlD opens cvlC's link)
    'cxl2': {'size': 'xl', 'title': 'V_NAME', 'fields': ['V_ID', 'V_STATUS', 'V_DATE', 'V_AMOUNT']}, 'cxl2ph': {'size': 'xl', 'title': 'V_NAME', 'fields': ['V_ID', 'V_STATUS', 'V_DATE', 'V_AMOUNT']},
}
# the viewer's own saved pick (penumbra_column_prefs.lrfix.view = cards), seeded before boot
PREF_CARDS = ['cfmtbig', 'cfmt', 'cfull', 'pcoff', 'gcards', 'gcoll', 'gncoll', 'ggcards', 'gglnest', 'cvlT', 'ca11y', 'cphone', 'cbar', 'chl', 'cviewer', 'csize', 'cxl', 'cmenu', 'gmenu', 'pmenu', 'cmsize', 'gmsize', 'cdet', 'gdet', 'pdet', 'cdetph', 'cmword', 'curl3', 'cnote', 'cnotedet', 'cflink', 'ckword', 'cfind', 'gfind', 'csort', 'gsort', 'cempty', 'pfind', 'clayout', 'clayoutB', 'cdetrow', 'pvfind', 'cwhite', 'cdetpage', 'cdetmore', 'cseg', 'cxl2', 'cxl2ph', 'pvhtml', 'cfields', 'cfieldsB', 'cboard', 'cbarrank', 'cvlC']
PREF_TABLE = ['cnarrowT', 'curl2', 'ctmenu']   # (csize) the viewer chose Table: the phone default yields; (curl) ?cards=1 wins over it


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
        '<link rel="stylesheet" href="penumbra_colmenu.css">\n<link rel="stylesheet" href="penumbra_cards.css">\n<link rel="stylesheet" href="theme_vars.css">\n'
        # (round O) the status bar's Cards card drawn open: a control's visibility is then the segment's (reachable); the
        # card's own open / close is read from its class and aria
        '<style>#sbCardsPop { display: block !important; }</style>\n')
    # index.php order: the card view after main.js (and the column modules); the theme ids for the driver
    # (2026-10-30, the sweep) the card view BEFORE the menu engine and both DEFERRED, as index.php loads them: the card
    # view's init then runs at once and its window-capture key listener comes before the engine's (parsed in place, its
    # init waited for DOMContentLoaded and the engine's came first - which hid an Escape that closed the details window
    # under an open menu)
    rep('<script src="penumbra_colmenu.js"></script>\n', '<script defer src="penumbra_cards.js"></script>\n<script defer src="penumbra_colmenu.js"></script>\n')
    rep('<script src="driver.js"></script>\n', '<script src="themes.js"></script>\n<script src="driver.js"></script>\n')
    # (round K) Find in results for the scenarios that use it (index.php loads it after the card view)
    rep('<script defer src="penumbra_colmenu.js"></script>\n', '<script defer src="penumbra_colmenu.js"></script>\n'
        '<script>if (/^(cfind|gfind|pfind|pvfind)$/.test(window.__SCN)) document.write(\'<link rel="stylesheet" href="penumbra_find.css"><script defer src="penumbra_find.js"></scr\' + \'ipt>\');</script>\n')   # (deferred, after the engine, as index.php)
    # the switch, after the row count (index.php: inside #tableSearchContainer; the harness keeps the count beside it)
    # (round O) the status bar's Cards segment - the switch, the size, the Sort list, Configure cards - after Cols, as
    # index.php draws it; a build without one (the control: live) has the controls beside the row count
    seg = _lift(index_src, r'\n([ \t]*)<div class="sb-seg sb-click sb-cards-seg" id="sbCardsSeg".*?\n\1</div>', 'the Cards segment')
    if seg:
        rep('  <div class="sb-seg" id="sbUserSeg"></div>', seg.strip('\n') + '\n  <div class="sb-seg" id="sbUserSeg"></div>')
    else:
        sw = _lift(index_src, r'<span id="pnbCardsSwitch"[^\n]*', 'the switch')
        szs = _lift(index_src, r'<select id="pnbCardsSize"[^\n]*', 'the size control')   # (csize)
        srt = _lift(index_src, r'<select id="pnbCardsSort"[^\n]*', 'the sort list')   # (round L, csort) the list and its arrow
        rep('<span id="resultCount"></span>', '<span id="resultCount"></span>' + sw + szs + srt)
    # (round O) Cols as index.php labels it (its label and its card's heading read Fields while cards show)
    # (round P) the Cols card itself, lifted from the index.php under test where it has the Layout line (#sbColsView; its
    # PHP comments out): the count opens it through main.js, the module's line at its end; a build without one (the
    # control: live) keeps the bare heading. The count a focusable button, as index.php's (the line's link puts the focus
    # back on it)
    clp = _lift(index_src, r'\n([ \t]*)<div class="sb-pop sb-cl-pop" id="sbColsPop".*?\n\1</div>', 'the Cols card') if (index_src and 'id="sbColsView"' in index_src) else ''
    clp = re.sub(r'<\?php.*?\?>', '', clp, flags=re.S).strip('\n')
    rep('<div class="sb-seg" id="sbColsSeg"><span id="sbCols"></span>', '<div class="sb-seg" id="sbColsSeg"><span class="sb-cols-open" id="sbColsOpen" role="button" tabindex="0"><span class="sb-lab">Cols</span> <span id="sbCols"></span></span>' + (clp or '<span class="sb-pop-h" id="sbColsPopHead">Columns</span>'))
    host = _lift(index_src, r'<div id="pnbCardsHost"[^\n]*', 'the host')
    rep('<div id="pivot-output-container" style="display:none"></div></div>', '<div id="pivot-output-container" style="display:none"></div>' + host + '</div>')
    # the View Options Cards card (the editor's form), in a #view-options-tab of its own - (round N) gone from index.php:
    # lifted on the control alone (live's); Configure cards builds its own window. The Exit pivot button
    vo = _lift(index_src, r'<div class="view-option-item pnb-cards-vo">.*?pnb-cards-note.*?</p>\s*</div>\s*</div>', 'the Cards card')
    vo = re.sub(r'<span class="tab-help-icon"[^>]*>\?</span>', '', vo)
    rep('<div id="pnbStatusBar">', '<div id="view-options-tab" style="display:none"><div class="view-options-grid">' + vo + '</div></div>\n<button id="exitPivotModeBtn" type="button">Exit pivot</button>\n<div id="pnbStatusBar">')
    # (round I) the pager's Rows: label and the list's title, as index.php has them (the module reads them)
    plb = _lift(index_src, r'<label for="rowsPerPageSelector"[^>]*>[^<]*</label>', 'the pager label')
    ptt = re.search(r'<select id="rowsPerPageSelector" (title="[^"]*")', index_src or '')
    rep('<div id="paginationControls"><select id="rowsPerPageSelector">', '<div id="paginationControls">' + plb + '<select id="rowsPerPageSelector"' + ((' ' + ptt.group(1)) if ptt else '') + '>')
    # the pager buttons, so a scenario turns pages through main.js's own handlers
    rep('<span id="pageInfo"></span>', '<span id="pageInfo"></span><button id="firstPageBtn">|&lt;</button><button id="prevPageBtn">&lt;</button>'
        '<button id="nextPageBtn">&gt;</button><button id="lastPageBtn">&gt;|</button>')
    # cperf / cmore: a big report (?rows=N, default 1000), the usual six columns shown
    rep('(/^mperf|^mrerun/.test(window.__SCN) ? (+P.get("rows") || 20000) : 300)',
        '(/^mperf|^mrerun/.test(window.__SCN) ? (+P.get("rows") || 20000) : (/^(cperf|cmore|cfmtbig)$/.test(window.__SCN) ? (+P.get("rows") || 1000) : (window.__SCN === "cdetmore" ? 1003 : 300)))')   # (round O) cdetmore: past the 1,000 drawn
    # cesc: a value the server escaped (an image tag as text) in the title column
    rep('    window.__rowsFixture = rows;\n',
        '    if (window.__SCN === "cxl2" || window.__SCN === "cxl2ph") { rows[2].V_NAME = "Long status row"; rows[2].V_STATUS = "Waiting on the sponsor for the final signed agreement"; }\n'   # (round P) the one card that keeps one column
        '    if (window.__SCN === "pvhtml") rows.forEach(function (r) { ["H_GROUP", "H_GROUP2", "V_STATUS"].forEach(function (c) { if (r[c] != null && r[c] !== "") r[c] = "@@HTML<a href=\\"#" + c + "\\">" + r[c] + "</a>"; }); });\n'   # (round Q) link-valued pivot fields, as ?id=int-col-mat's
        '    if (window.__SCN === "cbarrank") { rows[0].H_NUM = "1000000000"; rows[1].H_NUM = "500"; rows[2].H_NUM = "500"; rows[3].H_NUM = "0"; }\n'   # (clbar) one huge value, two ties, a zero
        '    if (window.__SCN === "cesc") rows[0].V_NAME = "&lt;img src=x onerror=\\"window.__pwn=1\\"&gt; Alpha";\n'
        '    window.__rowsFixture = rows;\n')
    # the stored report: the Cards option, the page size, a report highlight rule, a grouped subtotal
    cfg = '{' + ', '.join('%s: %s' % (k, _js(v)) for k, v in CFG.items()) + '}'
    rep('    window.__STORED = st;\n',
        '    window.__CARDS_CFG = ' + cfg + ';\n'
        '    if (Object.prototype.hasOwnProperty.call(window.__CARDS_CFG, S)) st.viewOptions = Object.assign({}, st.viewOptions || {}, { cards: window.__CARDS_CFG[S] });\n'
        '    if (S === "cpage" || S === "cdetrow" || S === "cdetpage" || S === "cfmtbig") st.rowsPerPage = "25";\n'
        '    if (S === "cguess") { st.visibleColumns = ["#", 0, 1, 7, 2, 3, 4, 5]; st.columnOrder = [0, 1, 7, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; }\n'
        '    if (S === "cperf" || S === "cmore" || S === "cdetmore" || S === "cxl2" || S === "cxl2ph") st.rowsPerPage = "all";\n'
        '    if (S === "chl") st.columnHighlights = { V_STATUS: [{ id: "r1", w: "V_STATUS = //Closed//", css: "background-color: #ffebee; color: #c62828; font-weight: bold" }] };\n'
        '    if (S === "cfmt" || S === "cfmtbig") st.columnHighlights = { V_NAME: [{ id: "t1", w: "", css: "background-color: #ffebee; color: #c62828" }], V_STATUS: [{ id: "s1", w: "V_STATUS = //Closed//", css: "font-style: italic; color: #2e7d32" }], H_AMT: [{ id: "b1", w: "", css: "background-color: #e8f5e9" }], V_DATE: [{ id: "f1", w: "", css: "font-weight: bold; text-decoration: underline" }] };\n'
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
    "    if (cs === 'clayoutB') pref = Object.assign(pref || {}, { cards: { title: 'V_STATUS', fields: ['V_ID', 'V_AMOUNT'] } });   // (round L) the viewer's own layout\n"
        "    if (cs === 'gboard') pref = Object.assign(pref || {}, { view: 'board' });   // (round S) a grouped report opened as a board\n"
        "    if (cs === 'cboardload') pref = Object.assign(pref || {}, { view: 'board', board: 'H_GROUP' });   // (round S) a kept board, a flat report (a hidden column: the guess would never pick it)\n"
        "    if (cs === 'cfieldsB') pref = Object.assign(pref || {}, { cards: { own: 1, title: 'V_NAME', fields: ['V_ID', 'V_AMOUNT', 'V_DATE'], nolabels: 1 } });   // (round R) a kept labels-off setup\n"
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
