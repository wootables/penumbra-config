# colmenu: harness.html = the colopt harness (the calccol one + js/penumbra_colfmt.js +
# the Settings panel lifted from the index.php under test; the REAL main.js on the
# saveconf fixture, 300 rows; shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS,
# hidden H_*; scenarios named g* open GROUPED by H_GROUP) PLUS the header menu:
# css/penumbra_colmenu.css and js/penumbra_colmenu.js (EMPTY files in --control).
import importlib.util, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
# colopt's builder, by its path (its module name is this one's)
_spec = importlib.util.spec_from_file_location('colopt_mk_harness', os.path.join(HERE, '..', 'colopt', 'mk_harness.py'))
colopt_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colopt_harness)


def build(index_src):
    src = colopt_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colopt</title>', '<title>colmenu</title>')
    # (round 3) the Copy button: main.js binds the dialog's opening (column list, last
    # settings) to it, and Copy distinct values' Other... clicks it
    rep('<button id="executeQuery">Run</button>', '<button id="executeQuery">Run</button><button id="copyActionsBtn" type="button">Copy</button>')
    rep('<link rel="stylesheet" href="penumbra_colwidths.css">\n',
        '<link rel="stylesheet" href="penumbra_colwidths.css">\n<link rel="stylesheet" href="penumbra_colmenu.css">\n')
    # (round 6) the shared tile engine (filter_strip()'s search grammar, the header
    # filter's) before main.js, as index.php has it
    rep('<script src="main_hc.js"></script>\n', '<script src="penumbra_tiles.js"></script>\n<script src="main_hc.js"></script>\n')
    # index.php order: the menu loads after main.js and the column modules
    rep('<script src="driver.js"></script>\n', '<script src="penumbra_colmenu.js"></script>\n<script src="driver.js"></script>\n')
    # (perf, 2026-10-17) mperf: a big report - ?rows=N (default 20000), every column shown -
    # with penumbra_a11y.js (before main.js) and the grouping list / cell selection modules
    # (after it), as index.php loads them. Other scenarios unchanged.
    rep('    for (var i = 1; i <= 300; i++) {', '    for (var i = 1; i <= (/^mperf|^mrerun/.test(window.__SCN) ? (+P.get("rows") || 20000) : 300); i++) {')
    rep("      visibleColumns: ['#', 0, 1, 2, 3, 4, 5], columnOrder: order,", "      visibleColumns: (/^mperf|^mrerun/.test(window.__SCN) ? ['#'].concat(order) : ['#', 0, 1, 2, 3, 4, 5]), columnOrder: order,")
    rep('<script src="penumbra_tiles.js"></script>\n',
        '<script src="penumbra_tiles.js"></script>\n'
        '<script>if (/^mperf|^mrerun/.test(window.__SCN)) document.write(\'<script src="penumbra_a11y.js"></scr\' + \'ipt>\');</script>\n')
    # (2026-10-20, grpsweep 2) ggfmt: the report saves V_DATE shown as a year (one band holds many
    # days); mautostale: a report saved grouped as List by a column the query no longer has (it opens
    # flat, the List choice left behind)
    rep('    window.__STORED = st;\n',
        '    if (S === "ggfmt") st.columnFormats = { V_DATE: "date:YYYY" };\n'
        '    if (S === "mautostale") { st.groupBy = "NO_SUCH_COL"; st.groupLayout = "list"; }\n'
        '    window.__STORED = st;\n')
    # (2026-10-20, grpmenu) the group menu (gg*) and the layout's auto choice (mauto*) need
    # the List layout too
    rep('<script src="penumbra_colmenu.js"></script>\n',
        '<script>if (/^mperf|^mrerun|^gg|^mauto/.test(window.__SCN)) document.write(\'<link rel="stylesheet" href="penumbra_grouplist.css"><link rel="stylesheet" href="penumbra_cellsel.css">\' +\n'
        '  \'<script src="penumbra_grouplist.js"></scr\' + \'ipt><script src="penumbra_cellsel.js"></scr\' + \'ipt>\');</script>\n'
        '<script src="penumbra_colmenu.js"></script>\n')
    # (2026-10-25, nestgb) mnestgb / ggnest / pnestgb (the palette's, on this harness): H_TEXT holds a nested table of its
    # own (NOTE_KIND, NOTE_DAYS), so a nested-table column's Group by list is shown to hold its OWN tables' columns - from
    # row 7 on (inside the ten rows group mode reads its nested columns from, past the five the dialog's picker reads the
    # column itself from); H_NULL's tables are all empty (no column to group by)
    rep('    window.__rowsFixture = rows;\n',
        '    if (/^(mnestgb|ggnest|pnestgb|gnnestbd|gchipnest)$/.test(window.__SCN)) rows.forEach(function (r, i) {\n'
        '      r.H_TEXT = i < 6 ? null : "@@JSON" + JSON.stringify([{ NOTE_KIND: (i % 2 ? "Memo" : "Call"), NOTE_DAYS: i % 5 }]);\n'
        '      r.H_NULL = "@@JSON[]";\n'
        '    });\n'
        '    window.__rowsFixture = rows;\n')
    # (2026-10-25, nestgb2) gnnestbd / gchipnest (the group band menu's lists, the status bar chip's): H_TEXT's and H_NULL's
    # tables as above, and H_ENT's - tables sharing SUB_NAME with H_JSON's beside a column of their own (one entry for a
    # name two tables share)
    rep('    window.__rowsFixture = rows;\n',
        '    if (/^(gnnestbd|gchipnest)$/.test(window.__SCN)) rows.forEach(function (r, i) {\n'
        '      r.H_ENT = "@@JSON" + JSON.stringify([{ ENT_KIND: (i % 3 ? "Lab" : "Field"), SUB_NAME: (i % 2 ? "Alpha" : "Bravo") }]);\n'
        '    });\n'
        '    window.__rowsFixture = rows;\n')
    # ...gchipnest: the status bar's grouping chip and its card, lifted from the index.php under test (main.js _sbRenderGrpPop
    # draws its column list), written there alone (the page has not set __SCN yet): every other scenario keeps its bar
    if index_src is not None:
        m = re.search(r'\n([ \t]*)<span class="sb-chip" id="sbGroup"[^\n]*\n\1<div class="sb-pop sb-grp-pop" id="sbGroupPop">.*?\n\1</div>', index_src, re.S)
        if not m:
            raise SystemExit('lift: the grouping chip not found in index.php')
        chip = re.sub(r'<\?php\s*/\*(?:(?!\*/).)*\*/\s*\?>', '', m.group(0).strip(), flags=re.S)
        if '<?' in chip:
            raise SystemExit('lift: PHP left in the grouping chip')
        js = json.dumps(chip).replace('</', '<\\/').replace('<!--', '<\\!--')
        rep('    <span class="sb-chip" id="sbCustomCols" style="display:none;">custom layout</span>\n',
            '    <script>if (/[?&]scn=gchipnest(?:&|$)/.test(location.search)) document.write(' + js + ');</script>\n'
            '    <span class="sb-chip" id="sbCustomCols" style="display:none;">custom layout</span>\n')
    return src
