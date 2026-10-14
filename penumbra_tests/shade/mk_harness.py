# shade: harness.html from the calccol harness (the REAL main.js, the saveconf
# fixture, the Settings panel with #spColumnList and the Clear button), WITHOUT the
# calculated-column module (not under test here).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'calccol', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>calccol</title>', '<title>shade</title>')
rep('<script src="penumbra_calc.js"></script>\n', '')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
