# Builds harness.html from the saveconf harness (real main.js, hiddencols fixture,
# stubbed endpoints) + a stub for manage_imports.php: every request is kept in
# window.__imports; the answer comes from window.__IMPORT_ANSWER(body) when a test
# sets it (else a plain success).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', 'saveconf', 'harness.html'), encoding='utf-8').read()

def rep(old, new):
    global src
    if src.count(old) != 1:
        raise SystemExit('anchor x%d: %r' % (src.count(old), old[:80]))
    src = src.replace(old, new)

rep('<title>saveconf</title>', '<title>pasteimp</title>')
rep("""    if (/save_server_state\\.php/.test(url)) {""", """    if (/manage_imports\\.php/.test(url)) {
      var ib = {}; try { ib = opts.data ? JSON.parse(opts.data) : {}; } catch (e) { }
      if (!ib.action) { var am = /action=([a-z_]+)/.exec(url); ib.action = am ? am[1] : ''; }
      window.__imports.push(ib);
      var ia = (window.__IMPORT_ANSWER || function (b) {
        if (b.action === 'list') return { ok: true, json: { status: 'success', data: [] } };
        return { ok: true, json: { status: 'success', id: 900 } };
      })(ib);
      setTimeout(function () {
        if (ia.ok) {
          try { if (opts.success) opts.success(ia.json, 'success', { status: 200 }); } catch (e) { window.__errors.push('imports success threw: ' + String(e)); }
          try { if (opts.complete) opts.complete({ status: 200 }, 'success'); } catch (e) { window.__errors.push('imports complete threw: ' + String(e)); }
          d.resolve(ia.json, 'success', { status: 200 });
        } else {
          var ix = { status: ia.status, responseJSON: ia.json, responseText: JSON.stringify(ia.json) };
          try { if (opts.error) opts.error(ix, 'error', ''); } catch (e) { window.__errors.push('imports error threw: ' + String(e)); }
          try { if (opts.complete) opts.complete(ix, 'error'); } catch (e) { }
          d.reject(ix, 'error', '');
        }
      }, 0);
      var ip = d.promise(); ip.abort = function () {}; return ip;
    }
    if (/save_server_state\\.php/.test(url)) {""")
rep("  window.__saves = [];\n", "  window.__saves = [];\n  window.__imports = [];\n")
rep('<div id="pnbStatusBar">', '<div id="action_overlay"></div>\n<div id="pnbStatusBar">')   # the toast dock (show_text renders here)
rep('<div id="saveStateLightbox" class="help-lightbox" style="display:block">', '<div id="saveStateLightbox" class="help-lightbox" style="display:none">')   # a visible dialog makes the page ignore pastes
open(os.path.join(HERE, 'harness.html'), 'w', encoding='utf-8', newline='\n').write(src)
print('harness written')
