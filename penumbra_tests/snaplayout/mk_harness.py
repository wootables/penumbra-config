# snaplayout: harness.html = the colmenu harness (the REAL main.js on the saveconf fixture,
# colopt / calc / colwidths / colmenu modules) with
#   - the report's SAVED layout out of query order: V_STATUS first, V_AMOUNT hidden, H_GROUP
#     shown between V_NAME and V_LINK (so the restore has columns to move AND to hide);
#   - sbig: 20,000 rows (?rows=N), as colmenu's mperf;
#   - the snapshot caution icon (leaving a snapshot = its click handler).
import importlib.util, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('colmenu_mk_harness', os.path.join(HERE, '..', 'colmenu', 'mk_harness.py'))
colmenu_harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(colmenu_harness)


def build(index_src):
    src = colmenu_harness.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('<title>colmenu</title>', '<title>snaplayout</title>')
    # colmenu's big-fixture condition (whatever scenarios it names) OR sbig
    big = re.findall(r'for \(var i = 1; i <= \((.+?) \? \(\+P\.get\("rows"\) \|\| 20000\) : 300\); i\+\+\) \{', src)
    if len(big) != 1:
        raise SystemExit('big-fixture row loop x%d' % len(big))
    rep('i <= (%s ? (+P.get("rows")' % big[0], 'i <= ((%s || window.__SCN === "sbig") ? (+P.get("rows")' % big[0])
    rep('    window.__STORED = st;\n',
        '    if (/^s/.test(S)) {\n'
        '      // V_STATUS V_ID [V_AMOUNT hidden] V_DATE V_NAME H_GROUP V_LINK, the other H_* hidden\n'
        '      st.columnOrder = [5, 0, 2, 3, 1, 15, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19];\n'
        '      st.visibleColumns = ["#", 5, 0, 3, 1, 15, 4];\n'
        '    }\n'
        '    window.__STORED = st;\n')
    rep('<table id="resultsTable"', '<span id="snapshotCautionIcon" style="display:none">!</span><table id="resultsTable"')
    return src
