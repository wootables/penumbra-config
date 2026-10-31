// pasteimp suite - browser half (2026-10-09). The REAL main.js paste-an-import
// path: a ClipboardEvent('paste') on the page, the preview, a new import
// (importFileData -> manage_imports.php action=save) or an append (action=append,
// the new-columns confirm, Undo -> action=append_undo), against a stubbed endpoint
// (window.__IMPORT_ANSWER; every request in window.__imports).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  var TSV = 'ID\tNAME\tAMT\r\n1\tAda\t00123\r\n2\tBob\t5\r\n3\tCy, Jr\t7\r\n';
  function paste(text, target) {
    var dt = new DataTransfer(); dt.setData('text/plain', text);
    var ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    (target || document.body).dispatchEvent(ev);
    return ev;
  }
  function ov() { return document.getElementById('pnbPasteOverlay'); }
  function reqs(a) { return window.__imports.filter(function (b) { return b.action === a; }); }
  function lastReq(a) { var l = reqs(a); return l[l.length - 1]; }
  function toast() { var t = document.getElementById('action_overlay'); return t ? t.textContent.replace(/\s+/g, ' ') : ''; }
  async function go() { document.getElementById('pnbPasteGo').click(); await sleep(150); }
  function pickAppend() { var r = ov().querySelector('input[name="pnbPasteMode"][value="append"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  function seedMeta() { window._penumbraImportMeta = window._penumbraImportMeta || {}; window._penumbraImportMeta.ZZ_LIST = { id: 5, filename: 'zz.csv', row_count: 3 }; }
  function okAppend(extra) {
    return function (b) {
      if (b.action === 'append') {
        var j = { status: 'success', id: 5, before_count: 3, row_count: 3 + b.rows.length, added: b.rows.length, new_columns: [], missing: ['X'], token: 'T1' };
        for (var k in (extra || {})) j[k] = extra[k];
        return { ok: true, json: j };
      }
      if (b.action === 'append_undo') return { ok: true, json: { status: 'success', id: 5, row_count: b.before_count } };
      return { ok: true, json: { status: 'success', id: 900, data: [] } };
    };
  }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(400);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  var S = {
    // a paste on the page: the preview, then a NEW import through importFileData
    newimp: async function () {
      var ev = paste(TSV);
      R.chk.prevented = ev.defaultPrevented;
      if (!ov()) return;
      R.chk.preview = !!ov() && /3 rows/.test(ov().textContent) && /3 columns/.test(ov().textContent);
      R.chk.previewCells = !!ov() && ov().querySelectorAll('tbody tr').length === 3 && ov().querySelector('tbody tr td:nth-child(3)').textContent === '00123';
      R.chk.defaultName = !!ov() && document.getElementById('pnbPasteName').value === 'PASTED_1';
      // the head band runs edge to edge across the box, its title without the generic h3 underline (as the infoboxes)
      var box = ov().querySelector('.modal-prompt-box'), head = ov().querySelector('.pnb-dlg-head'), h3 = ov().querySelector('.pnb-dlg-title');
      var br = box.getBoundingClientRect(), hr = head.getBoundingClientRect();
      R.chk.headFlush = Math.abs(hr.left - br.left) <= 2 && Math.abs(hr.right - br.right) <= 2 && Math.abs(hr.top - br.top) <= 2 && getComputedStyle(h3).borderBottomStyle === 'none';
      R.info.head = { box: [Math.round(br.left), Math.round(br.top), Math.round(br.right)], head: [Math.round(hr.left), Math.round(hr.top), Math.round(hr.right)], h3border: getComputedStyle(h3).borderBottomStyle };
      document.getElementById('pnbPasteName').value = 'my list!';
      await go();
      var s = lastReq('save');
      var rows = s ? JSON.parse(s.import_data) : [];
      R.chk.saved = !!s && s.import_name === 'MY_LIST' && s.filename === 'Pasted from the clipboard' && rows.length === 3;
      R.chk.savedText = rows.length === 3 && rows[0].AMT === '00123' && rows[2].NAME === 'Cy, Jr' && JSON.stringify(Object.keys(rows[0])) === '["ID","NAME","AMT"]';
      R.chk.closed = !ov();
      await sleep(300);
      R.info = { save: s && { name: s.import_name, file: s.filename }, rows: rows.slice(0, 2) };
    },
    // the row-number column never imports; a single pasted column works
    hashcol: async function () {
      paste('#\tID\n1\tA-1\n2\tA-2\n');
      if (!ov()) return;
      R.chk.hashDropped = !!ov() && ov().querySelectorAll('thead th').length === 1 && ov().querySelector('thead th').textContent === 'ID';
      document.querySelector('#pnbPasteOverlay .pnb-paste-cancel').click();
      await sleep(50);
      R.chk.cancelCloses = !ov() && reqs('save').length === 0;
      paste('ID\n100\n200\n300\n');
      R.chk.oneColumn = !!ov() && /3 rows/.test(ov().textContent) && /1 column/.test(ov().textContent);
      // one column whose values hold commas: tabs only, never a comma split
      if (ov()) ov().remove();
      paste('NAME\nSmith, Ann\nLee, Bo\n');
      R.chk.commaKept = !!ov() && ov().querySelectorAll('thead th').length === 1 && ov().querySelector('tbody tr td').textContent === 'Smith, Ann';
    },
    // when a paste is NOT an import
    ignore: async function () {
      var inp = document.getElementById('tableSearch');
      inp.focus();
      var a = paste(TSV, inp);
      R.chk.inInputIgnored = !a.defaultPrevented && !ov();
      inp.blur();
      var b = paste('just one line');
      R.chk.oneLineIgnored = !b.defaultPrevented && !ov();
      penumbra_vars.isGlobalAdmin = false;
      var c = paste(TSV);
      R.chk.nonAdminIgnored = !c.defaultPrevented && !ov();
      penumbra_vars.isGlobalAdmin = true;
      var cm = document.querySelector('.CodeMirror textarea') || document.querySelector('.CodeMirror');
      R.info.cm = cm ? cm.tagName + '.' + cm.className : null;
      var d = cm ? paste(TSV, cm) : { defaultPrevented: true };
      R.chk.editorIgnored = !!cm && !ov();   // (CodeMirror handles its own paste)
      document.getElementById('groupingLightbox').style.display = 'block';
      var f = paste(TSV);
      R.chk.dialogIgnored = !f.defaultPrevented && !ov();
      document.getElementById('groupingLightbox').style.display = 'none';
      var g = paste(TSV);
      R.chk.saneStillWorks = g.defaultPrevented && !!ov();
    },
    // an append: the rows go to the server; the notice; the counts
    append: async function () {
      seedMeta();
      window.__IMPORT_ANSWER = okAppend();
      paste(TSV);
      R.chk.targetListed = !!ov() && document.getElementById('pnbPasteTarget').value === 'ZZ_LIST';
      if (!ov()) return;
      pickAppend();
      R.chk.buttonSaysAdd = document.getElementById('pnbPasteGo').textContent === 'Add the rows';
      await go();
      var a = lastReq('append');
      R.chk.sent = !!a && a.import_name === 'ZZ_LIST' && a.add_columns === false && a.rows.length === 3 && a.rows[0].AMT === '00123';
      R.chk.noSave = reqs('save').length === 0;
      R.chk.closed = !ov();
      R.chk.notice = /ADDED: 3 rows to ZZ_LIST \(now 6\)\./.test(toast()) && /Left blank on the new rows: X\./.test(toast()) && !!document.querySelector('#action_overlay .pnb-paste-undo');
      R.chk.metaCount = window._penumbraImportMeta.ZZ_LIST.row_count === 6;
      R.info = { toast: toast().slice(0, 200) };
    },
    // columns the import lacks: refused first, then added after the confirm
    addcols: async function () {
      seedMeta();
      window.__IMPORT_ANSWER = function (b) {
        if (b.action === 'append' && !b.add_columns) return { ok: false, status: 409, json: { status: 'error', error: 'new_columns', new_columns: ['AMT'], message: 'x' } };
        return okAppend({ new_columns: ['AMT'], missing: [] })(b);
      };
      paste(TSV); if (!ov()) return; pickAppend(); await go();
      var st = document.getElementById('pnbPasteStatus');
      R.chk.asks = !!ov() && !!st && /ZZ_LIST has no column AMT\./.test(st.textContent) && !!document.getElementById('pnbPasteAddCols');
      R.chk.firstNoAdd = reqs('append').length === 1 && reqs('append')[0].add_columns === false;
      var addBtn = document.getElementById('pnbPasteAddCols');
      if (addBtn) addBtn.click();
      await sleep(150);
      var a = lastReq('append');
      R.chk.secondAdds = reqs('append').length === 2 && a.add_columns === true;
      R.chk.doneNotice = !ov() && /New columns: AMT\./.test(toast());
    },
    // Undo: the ticket the append returned, once
    undo: async function () {
      seedMeta();
      window.__IMPORT_ANSWER = okAppend({ new_columns: ['AMT'] });
      paste(TSV); if (!ov()) return; pickAppend(); await go();
      var ub = document.querySelector('#action_overlay .pnb-paste-undo');
      if (!ub) return;
      ub.click();
      await sleep(150);
      var u = lastReq('append_undo');
      R.chk.undoSent = !!u && u.import_name === 'ZZ_LIST' && u.before_count === 3 && u.row_count === 6 && u.token === 'T1' && JSON.stringify(u.new_columns) === '["AMT"]';
      R.chk.undoNotice = /UNDONE: took the 3 rows back out of ZZ_LIST \(3 again\)\./.test(toast());
      R.chk.undoMeta = window._penumbraImportMeta.ZZ_LIST.row_count === 3;
      // a stale notice's Undo does nothing the second time
      var n = reqs('append_undo').length;
      R.chk.undoLinkGone = !document.querySelector('#action_overlay .pnb-paste-undo');
      var again = document.querySelector('#action_overlay .pnb-paste-undo');
      if (again) again.click();
      await sleep(100);
      R.chk.undoOnce = reqs('append_undo').length === n;
    },
    // refusals keep the preview open with the server's reason; Esc closes it and nothing else
    refuse: async function () {
      seedMeta();
      window.__IMPORT_ANSWER = function (b) {
        if (b.action === 'append') return { ok: false, status: 409, json: { status: 'error', folder: true, message: 'ZZ_LIST is refreshed from a file in the server imports folder.' } };
        return { ok: true, json: { status: 'success' } };
      };
      paste(TSV); if (!ov()) return; pickAppend(); await go();
      R.chk.folderShown = !!ov() && /refreshed from a file/.test(document.getElementById('pnbPasteStatus').textContent);
      var docSaw = 0;
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') docSaw++; }, true);
      document.getElementById('pnbPasteGo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(50);
      R.chk.escCloses = !ov();
      R.info.docSaw = docSaw;   // (main.js's own Escape handler stops later listeners either way)
    },
    // a query that reads the import runs again after an append
    rerun: async function () {
      seedMeta();
      window.__IMPORT_ANSWER = okAppend();
      document.querySelector('.CodeMirror').CodeMirror.setValue('SELECT * FROM [IMPORT; name=ZZ_LIST]');
      var q0 = window.__queryDone;
      paste(TSV); if (!ov()) return; pickAppend(); await go();
      await until(function () { return window.__queryDone > q0; }, 4000);
      R.chk.reran = window.__queryDone > q0;
      R.info = { q0: q0, q1: window.__queryDone };
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
