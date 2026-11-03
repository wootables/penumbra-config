# bdhl harness (2026-11-02): the pivmenu harness (the REAL main.js over a saved pivot, H_GROUP > H_GROUP2
# down, V_STATUS across, sum of H_AMT) + js/penumbra_colfmt.js (the highlight rules need it), with rules:
#   pbh      the report's format() rules - a row on a HIDDEN column (H_FLAG), a cell on a hidden one (H_NUM),
#            a row on a shown one (V_STATUS != 'Closed') - and a heatmap(); a report highlight rule on
#            V_STATUS (Pending), the viewer's own on V_AMOUNT (H_NUM < 300)
#   pbhoff   pbh with the report's highlight rule turned Off for me
#   pbhnone  no rules at all
#   pbhui    (bdhl 2) no rules, the viewer's formats on V_DATE / V_AMOUNT; a rule made from the breakdown's menu
#   pbhfmt   (bdhl 3) pbhui's formats + a rule on V_AMOUNT; the formats changed from the breakdown's Format...
# pivmenu's files are read, never written.
import importlib.util, os
PIVMENU = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pivmenu'
_spec = importlib.util.spec_from_file_location('pivmenu_mk_harness', os.path.join(PIVMENU, 'mk_harness.py'))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)

SETUP = r"""    if (/^pbh/.test(S)) {
      // pbhui (bdhl 2): no rules; the viewer's formats on V_DATE and V_AMOUNT; rules made from a breakdown's menu
      if (S === 'pbhui') {
        try { localStorage.setItem('penumbra_column_prefs', JSON.stringify({ lrfix: { colopt: { V_DATE: { fmt: 'date:YYYY-MM-DD' }, V_AMOUNT: { fmt: 'currency:0' } } } })); } catch (e) {}
      } else if (S === 'pbhfmt') {
        // (bdhl 3) the same formats, and a rule on V_AMOUNT that a format change must leave in place
        try { localStorage.setItem('penumbra_column_prefs', JSON.stringify({ lrfix: { colopt: { V_DATE: { fmt: 'date:YYYY-MM-DD' },
          V_AMOUNT: { fmt: 'currency:0', hl: [{ id: 'own2', w: 'V_AMOUNT > 50000', css: 'background-color: #fbe8a6', row: false }] } } } })); } catch (e) {}
      } else if (S !== 'pbhnone') {
        st.reportSnippet = "format(row, H_FLAG = 'Y', 'background-color:#fff3cd')\n"
          + "format(cell, V_NAME, H_NUM > 500, 'font-weight:bold')\n"
          + "format(row, V_STATUS != 'Closed', 'font-style:italic')\n"
          + "heatmap(cell, V_AMOUNT)";
        st.columnHighlights = { V_STATUS: [{ id: 'rep1', w: 'V_STATUS = Pending', css: 'text-decoration: underline', row: false }] };
        var mine = { V_AMOUNT: { hl: [{ id: 'own1', w: 'H_NUM < 300', css: 'color: #c00000', row: false }] } };
        if (S === 'pbhoff') mine.V_STATUS = { hlOff: ['rep1'] };
        try { localStorage.setItem('penumbra_column_prefs', JSON.stringify({ lrfix: { colopt: mine } })); } catch (e) {}
      }
    }
    window.__STORED = st;
"""


def build(index_src):
    src = _pm.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('bdhl harness: anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('    window.__STORED = st;\n', SETUP)
    rep('<script src="main_hc.js"></script>\n', '<script src="penumbra_colfmt.js"></script>\n<script src="main_hc.js"></script>\n')
    return src
