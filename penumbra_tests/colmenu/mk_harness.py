# colmenu: harness.html = the colopt harness (the calccol one + js/penumbra_colfmt.js +
# the Settings panel lifted from the index.php under test; the REAL main.js on the
# saveconf fixture, 300 rows; shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS,
# hidden H_*; scenarios named g* open GROUPED by H_GROUP) PLUS the header menu:
# css/penumbra_colmenu.css and js/penumbra_colmenu.js (EMPTY files in --control).
import importlib.util, os
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
    return src
