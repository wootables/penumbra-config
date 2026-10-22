# cfperf harness (2026-10-21): the pvfix harness (pivmenu's: the REAL main.js over the pvshade
# fixture - 300 rows, 20 columns, 200 a page; a saved pivot for the p* scenarios, H_GROUP >
# H_GROUP2 down, V_STATUS across, the sum of H_AMT as Amt - with the pivot builder lifted from
# index.php, the menu module and the column options module) PLUS, by scenario:
#   cffmt  flat: format() rules in the custom code - a cell rule, a row rule, a header rule
#   cfrw   flat: rewrite() + format() (the snippet is edited to format() alone in the driver)
#   cfhl   flat: one report highlight rule (the column options cog), no custom code
#   gcf    grouped by H_GROUP: cffmt's rules
#   pcf    pivot: format() on Amt + a header rule + two commented-out format() calls; a saved
#          sort on Grand Total
#   pcftxt pivot: format() on Amt + text the snippet shows (Generate then renders no snippet)
# and the page buttons (the pvshade harness has none). pvfix's files are read, never written.
import importlib.util, json, os
PVFIX = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests\pvfix'
# by its path: a plain "import mk_harness" would find THIS module (same name, already loaded)
_spec = importlib.util.spec_from_file_location('pvfix_mk_harness', os.path.join(PVFIX, 'mk_harness.py'))
_pf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pf)

HL = "background-color: #fde68a"
SNIPS = {
    'cffmt': "format(cell, V_STATUS, V_STATUS = Open, '%s')\nformat(row, V_NAME contains Alpha, 'font-weight: bold')\nformat(header, V_STATUS, 'color: #b91c1c')" % HL,
    'gcf': "format(cell, V_STATUS, V_STATUS = Open, '%s')\nformat(row, V_NAME contains Alpha, 'font-weight: bold')\nformat(header, V_STATUS, 'color: #b91c1c')" % HL,
    'cfrw': "rewrite(V_STATUS, V_STATUS = Open, '<b>OPEN-{V_ID}</b>')\nformat(cell, V_NAME, V_NAME contains Alpha, '%s')" % HL,
    'pcf': "/* format(cell, Amt, Amt > 0, 'color: #ff0000') */\nformat(cell, Amt, Amt > 700, '%s; font-weight: bold')\n// format(cell, Amt, Amt > 0, 'color: #0000ff')\nformat(header, Open, 'color: #b91c1c')" % HL,
    'pcftxt': "Rows: count()\nformat(cell, Amt, Amt > 700, '%s; font-weight: bold')" % HL,
}
HLRULES = {'cfhl': {'V_STATUS': [{'id': 'h1', 'w': 'V_STATUS = Open', 'css': HL, 'row': False}]}}


def build(index_src):
    src = _pf.build(index_src)

    def rep(old, new):
        nonlocal src
        if src.count(old) != 1:
            raise SystemExit('cfperf harness: anchor x%d: %r' % (src.count(old), old[:80]))
        src = src.replace(old, new)

    rep('    window.__STORED = st;\n',
        '    var __CF_SNIPS = ' + json.dumps(SNIPS) + ';\n'
        '    var __CF_HL = ' + json.dumps(HLRULES) + ';\n'
        '    if (__CF_SNIPS[S]) st.reportSnippet = __CF_SNIPS[S];\n'
        '    if (__CF_HL[S]) st.columnHighlights = __CF_HL[S];\n'
        "    if (S === 'pcf') st.sortCriteria = [{ colIdentifier: 'Grand Total', colIndex: 0, direction: 'desc' }];\n"
        '    window.__STORED = st;\n')
    rep('<span id="pageInfo"></span>',
        '<button id="firstPageBtn" type="button">First</button><button id="prevPageBtn" type="button">Prev</button>'
        '<span id="pageInfo"></span>'
        '<button id="nextPageBtn" type="button">Next</button><button id="lastPageBtn" type="button">Last</button>')
    return src
