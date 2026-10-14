# calcsrv: builds harness.html from the saveconf harness (the REAL main.js, the
# 20-column fixture, stubbed endpoints, the Save dialog's fields) + the module
# (penumbra_calc.js) + a Last Stop Changes card (the Save dialog's list lives in it).
#   r* scenarios: the stored report carries calcColumns (the REPORT's own).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'saveconf', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>saveconf</title>', '<title>calcsrv</title>')
# (the harness's main_hc.js runs at once, so the module goes first, as calccol's does)
rep('<script src="main_hc.js"></script>', '<script src="penumbra_calc.js"></script>\n<script src="main_hc.js"></script>')
rep('<div id="pnbStatusBar">', '<div id="action_overlay"></div>\n'
    '<div class="save-form-container collapsed" id="lastStopCard"><div class="lsc-collapsed-hint">Optional final overrides. Click to expand.</div>'
    '<div id="lastStopCardBody"></div></div>\n<div id="pnbStatusBar">')
rep('    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];',
    '    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];\n'
    '    if (/^r/.test(S)) { st.calcColumns = [{ name: "REP1", formula: "{H_NUM} * 3", format: "number" }, { name: "REP2", formula: "ROUND({REP1} / 2, 1)", format: "number" }];\n'
    '      st.visibleColumns = ["#", 0, 1, 2, 3, 4, 5, 20, 21]; }')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
