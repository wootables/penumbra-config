# Builds harness.html from the pasteimp harness (real main.js, stubbed endpoints,
# manage_imports.php stub: every request in window.__imports, answered by
# window.__IMPORT_ANSWER). Adds: the sidebar container, and for the gload* scenarios
# the page's vars as a grant holder BEFORE main.js boots (the import list loads at boot).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'pasteimp', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>pasteimp</title>', '<title>impgrant</title>')
rep('<script src="main_hc.js"></script>', '''<script>
  // gload: an imports grant holder (not a global admin; a report editor), the list answers one shared import.
  // gload0: the same editor WITHOUT a grant - the list must not be asked for.
  if (/^gload/.test(window.__SCN)) {
    penumbra_vars.isGlobalAdmin = false;
    penumbra_vars.importGrant = window.__SCN === 'gload' ? [5] : null;
    window.__IMPORT_ANSWER = function (b) {
      if (b.action === 'list') return { ok: true, json: { status: 'success', data: [
        { ID: 5, IMPORT_NAME: 'ZZ_LIST', FILENAME: 'z.csv', ROW_COUNT: 3, USER_ID: 'ann', MINE: 0 },
        { ID: 6, IMPORT_NAME: 'ZZ_MINE', FILENAME: 'm.csv', ROW_COUNT: 2, USER_ID: 'harness', MINE: 1 } ] } };
      return { ok: true, json: { status: 'success' } };
    };
  }
</script>
<script src="main_hc.js"></script>''')
rep('<div id="action_overlay"></div>', '<div id="action_overlay"></div>\n<div id="tableSelectorContent" style="width:320px"></div>')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
