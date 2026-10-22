import os
T = r'\\oitras.oit.ncsu.edu\d$\Utilities\PHP_8.2-p\penumbra_tests'
src = open(os.path.join(T, 'cellsel', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>cellsel</title>', '<title>saveconf</title>')
rep('<link rel="stylesheet" href="penumbra_cellsel.css">\n', '')
rep('<script src="penumbra_cellsel.js"></script>\n', '')
# the save dialog's fields, as index.php ~8017-8297 has them (ids only)
rep('<div id="pnbStatusBar">', '''<!-- saveconf: the Save to Server dialog's fields (index.php ~8017-8297, ids as there) -->
<div id="saveStateLightbox" class="help-lightbox" style="display:block">
  <input type="text" id="serverSaveIdInput" value="zzconf">
  <input type="hidden" id="serverSaveTags" value=""><div id="reportTagsContainer" class="auth-access-container report-tags-container"></div>
  <div id="serverSaveOverwriteContainer"><input type="checkbox" id="serverSaveOverwriteCheckbox" checked></div>
  <div id="serverSaveCopyNotice" style="display:none"></div>
  <input type="hidden" id="serverSaveAuthorized" value="public">
  <div id="authAccessContainer" class="auth-access-container"><input type="text" id="authAccessInput" value="public"></div>
  <input type="text" id="serverSaveIP" value="">
  <input type="checkbox" id="enableReportPassword">
  <input type="password" id="serverSavePassword"><input type="password" id="serverSavePasswordConfirm">
  <textarea id="serverSaveTitleInput">Conflict fixture</textarea><textarea id="serverSaveSubtitleInput"></textarea>
  <select id="serverSaveTheme"><option value="theme-default">Default</option></select>
  <select id="serverSaveDensity"><option value="standard">Standard</option></select>
  <select id="serverSaveRowsPerPage"><option value="200">200</option></select>
  <input type="checkbox" id="serverSaveRowHeight"><input type="checkbox" id="serverSaveResolver" checked><input type="checkbox" id="serverSaveSortNone">
  <div id="serverSaveStatus" class="save-status-message" style="display:none" aria-live="polite"></div>
  <button id="confirmServerSaveBtn" class="pnb-btn pnb-btn-primary">Save to Server</button>
  <button id="saveQuery" type="button" style="display:none">Save</button><!-- (encsave 2026-10-21) the dialog's real opener -->
</div>
<div id="pnbStatusBar">''')
# the loaded report's version (index.php penumbra_vars.reportVersion)
rep("      preloadedState: st\n", "      preloadedState: st,\n      reportVersion: (S === 'nover') ? null : { id: 'zzconf', at: '2026-10-09 10:00:00.000000' }\n")
# save_server_state.php answers from window.__SAVE_ANSWER (a test sets it); every payload is kept
rep("""    var isQuery = /query\\.php/.test(url);""", """    var isQuery = /query\\.php/.test(url);
    if (/save_server_state\\.php/.test(url)) {
      var body = {}; try { body = JSON.parse(opts.data); } catch (e) { }
      window.__saves.push(body);
      var ans = (window.__SAVE_ANSWER || function () { return { ok: true, json: { success: true, new_id: body.short_id, numeric_id: 7, is_new: false, updated_at: '2026-10-09 11:00:00.000000' } }; })(body);
      setTimeout(function () {
        if (ans.ok) {
          try { if (opts.success) opts.success(ans.json, 'success', { status: 200 }); } catch (e) { window.__errors.push('save success threw: ' + String(e)); }
          d.resolve(ans.json, 'success', { status: 200 });
        } else {
          var xhr = { status: ans.status, responseJSON: ans.json, responseText: JSON.stringify(ans.json) };
          try { if (opts.error) opts.error(xhr, 'error', ''); } catch (e) { window.__errors.push('save error threw: ' + String(e)); }
          d.reject(xhr, 'error', '');
        }
      }, 0);
      var sp = d.promise(); sp.abort = function () {}; return sp;
    }""")
rep("  window.__ajaxLog = [];\n", "  window.__ajaxLog = [];\n  window.__saves = [];\n")
open(os.path.join(T, 'saveconf', 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
