# pvfix harness (2026-10-20 d): the pivmenu harness (the pvshade harness - the REAL main.js
# over a saved pivot - with the pivot builder lifted from the index.php under test, the tile
# engine and the menu module) PLUS the column options module (js/penumbra_colfmt.js: the rule
# editor the menu's Highlight... opens) and two scenarios of its own, by name:
#   pfmenu  one row field (H_GROUP), V_STATUS across, Amt (sum of H_AMT) and Chg (its % change)
#   pfneg   the same, North's amounts x1000 and West's negated (a two-sided scale on lopsided
#           values), Amt shaded with a Color scale
# pivmenu's own files are read, never written.
import importlib.util, os
PIVMENU = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivmenu'
# by its path: a plain "import mk_harness" would find THIS module (same name, already loaded)
_spec = importlib.util.spec_from_file_location('pivmenu_mk_harness', os.path.join(PIVMENU, 'mk_harness.py'))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)


def build(index_src):
    src = _pm.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('pvfix harness: anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    # the data: pfneg's lopsided amounts both ways from zero
    rep('    window.__rowsFixture = rows;\n',
        "    if (window.__SCN === 'pfneg') rows.forEach(function (r) {\n"
        "      if (r.H_GROUP === 'North') r.H_AMT = String(Number(r.H_AMT) * 1000);\n"
        "      else if (r.H_GROUP === 'West') r.H_AMT = String(-Number(r.H_AMT));\n"
        "    });\n"
        '    window.__rowsFixture = rows;\n')
    # the pivot: Amt and its % change
    rep('    window.__STORED = st;\n',
        "    if (S === 'pfmenu' || S === 'pfneg') {\n"
        "      st.pivot.agg = ['sum', 'pct_change']; st.pivot.aggLabels = ['Amt', 'Chg']; st.pivot.aggColOverrides = ['H_AMT', null];\n"
        "      if (S === 'pfneg') st.pivot.aggShade = ['scale', null];\n"
        "    }\n"
        '    window.__STORED = st;\n')
    # the column options module, before the menu module (as index.php loads it)
    rep('<script src="penumbra_colmenu.js"></script>\n', '<script src="penumbra_colfmt.js"></script>\n<script src="penumbra_colmenu.js"></script>\n')
    return src
