# calccol: builds harness.html from the saveconf harness (the REAL main.js, the
# hiddencols fixture, stubbed endpoints, the Save dialog's fields) + the module
# (penumbra_calc.js) + the Settings panel's
# column container the module hangs its section under. cstate: the stored state
# carries calcColumns, as a view link does.
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'saveconf', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>saveconf</title>', '<title>calccol</title>')
# (index.php defers both, and main.js does its work at ready, after the module has run.
# The harness's main_hc.js runs at once, so the module goes first here.)
rep('<script src="main_hc.js"></script>', '<script src="penumbra_calc.js"></script>\n<script src="main_hc.js"></script>')
# (2026-10-18, calcadj) the cadj scenario has the header menu too, in index.php's order: the
# tile engine before main.js, the menu after it. Other scenarios unchanged.
rep('<script src="penumbra_calc.js"></script>\n<script src="main_hc.js"></script>',
    '<script src="penumbra_calc.js"></script>\n'
    '<script>if (window.__SCN === "cadj") document.write(\'<link rel="stylesheet" href="penumbra_colmenu.css"><script src="penumbra_tiles.js"></scr\' + \'ipt>\');</script>\n'
    '<script src="main_hc.js"></script>')
rep('<script src="driver.js"></script>',
    '<script>if (window.__SCN === "cadj") document.write(\'<script src="penumbra_colmenu.js"></scr\' + \'ipt>\');</script>\n<script src="driver.js"></script>')
# (the saveconf harness already carries the Settings panel with its #spColumnList; calccol3: + the Clear button)
rep('<div id="pnbStatusBar">', '<div id="action_overlay"></div>\n<div id="pnbStatusBar">')
rep('<div class="sp-actions"><button id="spApply">', '<button id="spClearStorage">Clear All Custom Preferences For This Report</button>\n  <div class="sp-actions"><button id="spApply">')
rep('    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];',
    '    if (S === "hidcol") st.visibleColumns = ["#", 0, 1, 3, 4, 5];\n'
    '    if (S === "cstate") st.calcColumns = [{ name: "TRIPLE", formula: "{H_NUM} * 3", format: "number" }];')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
