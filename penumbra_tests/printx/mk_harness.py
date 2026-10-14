# printx: harness.html from the shade harness (the REAL main.js + main.css, the
# saveconf fixture: 300 rows at 200 a page) + the print stamp index.php carries
# + a help icon, a chart cog and a canvas, the bits the print sweep hides / cards.
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'shade', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>shade</title>', '<title>printx</title>')
rep('<div id="action_overlay"></div>',
    '<div id="action_overlay"></div>\n'
    '<div id="pnbPrintStamp" aria-hidden="true"></div>\n'
    '<div id="pxBits"><span class="tab-help-icon" id="pxHelp">?</span><span id="searchHelpIcon">?</span>'
    '<button type="button" class="chart-settings-cog" id="pxCog">cog</button>'
    '<canvas id="pxCanvas" width="200" height="60"></canvas></div>')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
