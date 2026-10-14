# Builds harness.html from the pasteimp harness (real main.js, the hiddencols fixture,
# stubbed endpoints) for the scratch-rows suite (2026-10-13):
#  - the query stub's xhr carries responseText, as a real jqXHR does (the replay keeps it)
#  - the status bar's Data segment, as index.php renders it (the Add / Remove buttons live in its card)
#  - every row built (Rows = All), so pasted rows past row 200 have their cells
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'pasteimp', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>pasteimp</title>', '<title>scratchrows</title>')
rep("try { if (opts.success) opts.success(resp, 'success', { status: 200 }); } catch (e) { window.__errors.push('ajax success threw: ' + String(e)); }",
    "try { if (opts.success) opts.success(resp, 'success', { status: 200, responseText: isQuery ? JSON.stringify(resp) : '' }); } catch (e) { window.__errors.push('ajax success threw: ' + String(e)); }")
rep('  <div class="sb-seg" id="sbUserSeg"></div>\n',
    '  <div class="sb-seg sb-click" id="sbDataSeg" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">\n'
    '    <span class="sb-lab">Data</span><span class="sb-val" id="sbDataTime">&mdash;</span>\n'
    '    <span class="sb-chip sb-off" id="sbDataChip" style="display:none;"></span>\n'
    '    <div class="sb-pop" id="sbDataPop"></div>\n'
    '  </div>\n'
    '  <div class="sb-seg" id="sbUserSeg"></div>\n')
rep("rowsPerPage: '200', reportSnippet: ''", "rowsPerPage: 'all', reportSnippet: ''")
# the full-page drop overlay, as index.php renders it for everyone (drop scenarios)
rep('<pre id="out">running</pre>', '<div id="importDragOverlay" style="display: none;"><div class="drag-overlay-content">'
    '<p>Drop CSV, XLS, XLSX, ODB or JSON file to import</p></div></div>\n<pre id="out">running</pre>')
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
