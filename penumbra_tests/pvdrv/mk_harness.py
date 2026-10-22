# pvdrv harness (2026-10-21, brk): the pivmenu harness (the pvshade harness - the REAL main.js over a
# saved pivot - with the pivot builder lifted from the index.php under test, the tile engine and the
# menu module) with pivots of derived values over the fixture's dates (H_DATE, 2021 to Feb 2025):
#   pdyear  H_GROUP down, H_DATE:year across: Amt (sum of H_AMT), Chg (% change), Diff (change),
#           Row% (% of row total), Run (running total), Idx (index), YoY, LY (prior year), Ix23
#           (index@2023), N (count), Per (formula {Amt} / {N})
#   pdq     H_GROUP down, H_DATE:yq across: Amt filtered to V_STATUS = Open, YTD, R3 (roll3), RS2
#           (rollsum2), Cum (pct_cum), RunN (running count: every row, as its value), YoY; the flat
#           table freezes two columns (the breakdown's lead column rides with its '#')
#   pddown  H_DATE:year down, V_STATUS across: Amt and the vertical ChgD, RunD, YoYD, IdxD, R2D
#   pdgrp   H_GROUP > H_GROUP2 down, H_DATE:year across: Amt, Chg, Run, Row%, YoY (group summaries)
#   pdnob   pdyear with the pivot's breakdowns off
#   pdbase  H_GROUP > H_GROUP2 down, V_STATUS across: Amt filtered to V_STATUS = Open, N, Run - the
#           base cells' breakdowns, compared live against stage (run.py B-same)
# pivmenu's own files are read, never written.
import importlib.util, os
PIVMENU = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivmenu'
# by its path: a plain "import mk_harness" would find THIS module (same name, already loaded)
_spec = importlib.util.spec_from_file_location('pivmenu_mk_harness', os.path.join(PIVMENU, 'mk_harness.py'))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)

SETUP = r"""    if (/^pd/.test(S)) {
      var PV = st.pivot;
      // [type, label, column override, formula, filter]
      var A = function (list) {
        PV.agg = list.map(function (x) { return x[0]; });
        PV.aggLabels = list.map(function (x) { return x[1]; });
        PV.aggColOverrides = list.map(function (x) { return x[2] || null; });
        PV.aggFormulas = list.some(function (x) { return x[3]; }) ? list.map(function (x) { return x[3] || null; }) : null;
        PV.aggFilters = list.some(function (x) { return x[4]; }) ? list.map(function (x) { return x[4] || null; }) : null;
      };
      PV.rows = ['H_GROUP']; PV.cols = ['H_DATE:year']; PV.vals = 'H_AMT'; PV.startExpanded = true;
      if (S === 'pdyear' || S === 'pdnob') {
        A([['sum', 'Amt', 'H_AMT'], ['pct_change', 'Chg'], ['diff', 'Diff'], ['pct_row_total', 'Row%'], ['running_total', 'Run'],
           ['index', 'Idx'], ['yoy', 'YoY'], ['prioryear', 'LY'], ['index@2023', 'Ix23'], ['count', 'N', 'H_AMT'], ['formula', 'Per', null, '{Amt} / {N}']]);
        if (S === 'pdnob') PV.noBreakdown = true;
      }
      if (S === 'pdq') {
        PV.cols = ['H_DATE:yq'];
        A([['sum', 'Amt', 'H_AMT', null, 'V_STATUS = Open'], ['ytd', 'YTD'], ['roll3', 'R3'], ['rollsum2', 'RS2'], ['pct_cum', 'Cum'],
           ['running_count', 'RunN'], ['yoy', 'YoY']]);
        st.frozenCols = 2;
      }
      if (S === 'pddown') {
        PV.rows = ['H_DATE:year']; PV.cols = ['V_STATUS'];
        A([['sum', 'Amt', 'H_AMT'], ['pct_change:down', 'ChgD'], ['running_total:down', 'RunD'], ['yoy:down', 'YoYD'], ['index:down', 'IdxD'], ['roll2:down', 'R2D']]);
      }
      if (S === 'pdgrp') {
        PV.rows = ['H_GROUP', 'H_GROUP2'];
        A([['sum', 'Amt', 'H_AMT'], ['pct_change', 'Chg'], ['running_total', 'Run'], ['pct_row_total', 'Row%'], ['yoy', 'YoY']]);
      }
      if (S === 'pdbase') {
        PV.rows = ['H_GROUP', 'H_GROUP2']; PV.cols = ['V_STATUS'];
        A([['sum', 'Amt', 'H_AMT', null, 'V_STATUS = Open'], ['count', 'N', 'H_AMT'], ['running_total', 'Run']]);
      }
    }
    window.__STORED = st;
"""


def build(index_src):
    src = _pm.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('pvdrv harness: anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    # two groups, so a group's quarter has rows (and a status filter leaves some)
    rep('    window.__rowsFixture = rows;\n',
        "    if (/^pd/.test(window.__SCN)) rows.forEach(function (r, i) { r.H_GROUP = (i % 2) ? 'North' : 'South'; });\n"
        '    window.__rowsFixture = rows;\n')
    rep('    window.__STORED = st;\n', SETUP)
    return src
