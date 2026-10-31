// impgrant suite - browser half (2026-10-09). The REAL main.js as an IMPORTS GRANT
// holder (penumbra_vars.importGrant: null | "*" | [ids]): the paste preview, the
// append / undo naming the import by ID, overwriting a shared import by its ID
// (replace_id), the sidebar and its menu for an import that is not yours, and the
// import list loading at boot for a holder. Stubbed endpoint (window.__IMPORT_ANSWER;
// every request in window.__imports). window.__HC.psb / .menu = populateSelectorBox /
// showImportMoreOptions, exposed by run.py's hook.
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
  function radio(v) { return ov() && ov().querySelector('input[name="pnbPasteMode"][value="' + v + '"]'); }
  function grantee(g) { penumbra_vars.isGlobalAdmin = false; penumbra_vars.importGrant = g; }
  function seed() {
    window._penumbraImportMeta = window._penumbraImportMeta || {};
    window._penumbraImportMeta.ZZ_LIST = { id: 5, filename: 'zz.csv', row_count: 3, mine: false, owner: 'ann' };
  }
  function okAppend(b) {
    if (b.action === 'append') return { ok: true, json: { status: 'success', id: 5, before_count: 3, row_count: 3 + b.rows.length, added: b.rows.length, new_columns: [], missing: [], token: 'T1' } };
    if (b.action === 'append_undo') return { ok: true, json: { status: 'success', id: 5, row_count: b.before_count } };
    return { ok: true, json: { status: 'success', id: 5, data: [] } };
  }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(400);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function sideItem(name) { return document.querySelector('#tableSelectorContent .selector-item[data-type="imported"][data-value="' + name + '"]'); }
  function menuFor(name) {
    document.querySelectorAll('.context-submenu').forEach(function (m) { m.remove(); });
    var it = sideItem(name);
    if (!it) return null;
    window.__HC.menu(it, $(it), { pageX: 10, pageY: 10, preventDefault: function () {}, stopPropagation: function () {} });
    var m = document.querySelector('.context-submenu');
    var acts = m ? Array.prototype.map.call(m.querySelectorAll('.submenu-item[data-action]'), function (x) { return x.getAttribute('data-action'); }) : null;
    if (m) m.remove();
    return acts;
  }

  var S = {
    // a holder of a grant for particular imports: adding is the only way; the import goes by ID
    gpaste: async function () {
      grantee([5]); seed();
      window.__IMPORT_ANSWER = okAppend;
      var ev = paste(TSV);
      R.chk.opens = ev.defaultPrevented && !!ov();
      if (!ov()) return;
      R.chk.newAbsent = !radio('new') && !document.getElementById('pnbPasteName');   // (addrows) a choice is offered only to someone who can use it
      R.chk.appendChecked = !!radio('append') && radio('append').checked && document.getElementById('pnbPasteTarget').value === 'ZZ_LIST';
      R.chk.buttonAdd = document.getElementById('pnbPasteGo').textContent === 'Add the rows';
      await go();
      var a = lastReq('append');
      R.chk.sentId = !!a && a.id === 5 && a.import_name === 'ZZ_LIST' && a.rows.length === 3;
      R.chk.noSave = reqs('save').length === 0;
      var ub = document.querySelector('#action_overlay .pnb-paste-undo');
      if (ub) { ub.click(); await sleep(150); }
      var u = lastReq('append_undo');
      R.chk.undoId = !!u && u.id === 5 && u.before_count === 3 && u.token === 'T1';
      R.info = { append: a && { id: a.id, name: a.import_name }, undo: u && { id: u.id }, toast: toast().slice(0, 160) };
    },
    // when the paste has nowhere to go, it is not taken; the every-import grant may create
    gnone: async function () {
      grantee([5]);   // no import in the list at all: this view is the only place (addrows)
      var a = paste(TSV);
      R.chk.noTargetViewOnly = a.defaultPrevented && !!ov() && !radio('new') && !radio('append') && !!radio('view') && radio('view').checked;
      if (ov()) ov().remove();
      grantee(null);
      seed();   // the report's import is listed, but no grant: not a target
      var b = paste(TSV);
      R.chk.noGrantViewOnly = b.defaultPrevented && !!ov() && !radio('new') && !radio('append') && !!radio('view') && radio('view').checked;
      R.info.gnone = ov() ? ov().querySelector('#pnbRowsDest').textContent.replace(/\s+/g, ' ').trim() : null;
      if (ov()) ov().remove();
      grantee('*');
      var c = paste(TSV);
      R.chk.starOpens = c.defaultPrevented && !!ov();
      R.chk.starNewChecked = !!radio('new') && radio('new').checked && !radio('new').disabled && document.getElementById('pnbPasteGo').textContent === 'Import';
    },
    // the sidebar and the menu: whose an import is decides what you may do to it
    gside: async function () {
      window._penumbraImportMeta = window._penumbraImportMeta || {};
      window._penumbraImportMeta.ZZ_LIST = { id: 5, filename: 'zz.csv', row_count: 3, mine: false, owner: 'ann' };
      window._penumbraImportMeta.ZZ_MINE = { id: 6, filename: 'm.csv', row_count: 2, mine: true, owner: 'harness' };
      grantee([5]);
      window.__HC.psb();
      var sh = sideItem('ZZ_LIST'), mi = sideItem('ZZ_MINE');
      R.chk.ownerShown = !!sh && /\(3 rows, ann's\)/.test(sh.textContent) && !!mi && /\(2 rows\)/.test(mi.textContent);
      R.chk.noRemoveShared = !!sh && !sh.querySelector('[data-action="remove-import"]');
      R.chk.removeMine = !!mi && !!mi.querySelector('[data-action="remove-import"]');
      var m1 = menuFor('ZZ_LIST'), m2 = menuFor('ZZ_MINE');
      R.chk.menuSharedBare = !!m1 && m1.indexOf('import-open') !== -1 && m1.indexOf('import-rename') === -1 && m1.indexOf('import-delete') === -1 && m1.indexOf('import-duplicate') === -1;
      R.chk.menuMineNoDup = !!m2 && m2.indexOf('import-rename') !== -1 && m2.indexOf('import-delete') !== -1 && m2.indexOf('import-duplicate') === -1;
      grantee('*');
      var m3 = menuFor('ZZ_MINE');
      R.chk.menuStarDup = !!m3 && m3.indexOf('import-duplicate') !== -1;
      penumbra_vars.isGlobalAdmin = true; penumbra_vars.importGrant = null;
      delete window._penumbraImportMeta.ZZ_LIST.mine;   // an admin's list never says "not yours"
      window.__HC.psb();
      var m4 = menuFor('ZZ_LIST');
      R.chk.menuAdminAll = !!m4 && ['import-rename', 'import-duplicate', 'import-delete'].every(function (x) { return m4.indexOf(x) !== -1; })
        && !!sideItem('ZZ_LIST') && !!sideItem('ZZ_LIST').querySelector('[data-action="remove-import"]');
      R.info = { m1: m1, m2: m2, m3: m3, m4: m4, sh: sh && sh.textContent.trim().slice(0, 60) };
    },
    // overwriting a shared import (same name) goes by its ID and stays theirs; your own goes by name
    greplace: async function () {
      grantee('*'); seed();
      window.confirm = function () { return true; };
      window.__IMPORT_ANSWER = function (b) { return { ok: true, json: { status: 'success', id: b.replace_id || 77, updated: !!b.replace_id } }; };
      paste(TSV); if (!ov()) return;
      document.getElementById('pnbPasteName').value = 'zz_list';
      await go();
      var s = lastReq('save');
      R.chk.replaceIdSent = !!s && s.replace_id === 5 && s.import_name === 'ZZ_LIST';
      R.chk.mineKept = window._penumbraImportMeta.ZZ_LIST.mine === false && window._penumbraImportMeta.ZZ_LIST.owner === 'ann' && window._penumbraImportMeta.ZZ_LIST.id === 5;
      window._penumbraImportMeta.ZZ_OWN = { id: 8, filename: 'o.csv', row_count: 1, mine: true };
      paste(TSV); if (!ov()) return;
      document.getElementById('pnbPasteName').value = 'ZZ_OWN';
      await go();
      var s2 = lastReq('save');
      R.chk.ownNoReplaceId = !!s2 && s2.import_name === 'ZZ_OWN' && s2.replace_id === undefined;
      R.info = { s: s && { r: s.replace_id, n: s.import_name }, s2: s2 && { r: s2.replace_id, n: s2.import_name } };
    },
    // the list loads at boot for a holder, and says whose
    gload: async function () {
      R.chk.listCalled = reqs('list').length >= 1;
      var m = window._penumbraImportMeta || {};
      R.chk.mineFlag = !!m.ZZ_LIST && m.ZZ_LIST.mine === false && m.ZZ_LIST.owner === 'ann' && !!m.ZZ_MINE && m.ZZ_MINE.mine === true;
      R.info = { meta: m.ZZ_LIST, n: reqs('list').length };
    },
    // (addrows) the import flows' questions are the app's own dialog, never confirm() / prompt():
    // delete from the sidebar's X (Cancel keeps it; Delete sends, the registries clear once the
    // server agrees), rename from the menu (the name checked as typed, saved in capitals, Enter = OK)
    gask: async function () {
      penumbra_vars.isGlobalAdmin = true; penumbra_vars.importGrant = null;
      window._penumbraImportMeta = window._penumbraImportMeta || {};
      window._penumbraImportIds = window._penumbraImportIds || {};
      window._penumbraImportMeta.ZZ_MINE = { id: 6, filename: 'm.csv', row_count: 2, mine: true, owner: 'harness' };
      window._penumbraImportIds.ZZ_MINE = 6;
      window.__IMPORT_ANSWER = function (b) { return { ok: true, json: { status: 'success' } }; };
      window.__HC.psb();
      var natives = 0;
      window.confirm = function () { natives++; return true; };
      window.prompt = function () { natives++; return 'X'; };
      window.alert = function () { natives++; };
      function ask() { return document.getElementById('pnbImportAsk'); }
      var x = sideItem('ZZ_MINE') && sideItem('ZZ_MINE').querySelector('[data-action="remove-import"]');
      if (!x) { R.notes.push('no X on ZZ_MINE'); return; }
      x.click();
      await until(function () { return !!ask(); }, 2000);
      R.chk.deleteAsks = !!ask() && /Delete ZZ_MINE \(2 rows\)\?/.test(ask().textContent) && document.getElementById('pnbImportAskOk').textContent === 'Delete' && natives === 0;
      var st = document.getElementById('pnbImportAskStatus');
      R.chk.askFooter = !!st && !!st.closest('.modal-prompt-buttons') && st.nextElementSibling.id === 'pnbImportAskOk' && st.previousElementSibling.classList.contains('modal-btn-secondary');
      if (ask()) ask().querySelector('.modal-btn-secondary.pnb-ask-cancel').click();
      await sleep(100);
      R.chk.cancelKeeps = !ask() && reqs('delete').length === 0 && !!window._penumbraImportMeta.ZZ_MINE && !!sideItem('ZZ_MINE');
      x = sideItem('ZZ_MINE') && sideItem('ZZ_MINE').querySelector('[data-action="remove-import"]');
      if (x) x.click();
      await until(function () { return !!ask(); }, 2000);
      if (ask()) document.getElementById('pnbImportAskOk').click();
      await until(function () { return reqs('delete').length === 1; }, 2000);
      await sleep(200);
      var d = lastReq('delete');
      R.chk.deleteSent = !!d && d.id === 6 && !ask() && !window._penumbraImportMeta.ZZ_MINE && !sideItem('ZZ_MINE') && /REMOVED: Imported data source ZZ_MINE/.test(toast());
      // rename
      window._penumbraImportMeta.ZZ_MINE = { id: 6, filename: 'm.csv', row_count: 2, mine: true, owner: 'harness' }; window._penumbraImportIds.ZZ_MINE = 6;
      window._penumbraImportMeta.ZZ_LIST = { id: 5, filename: 'zz.csv', row_count: 3, mine: true, owner: 'harness' };
      window.__HC.psb();
      var it = sideItem('ZZ_MINE');
      window.__HC.menu(it, $(it), { pageX: 10, pageY: 10, preventDefault: function () {}, stopPropagation: function () {} });
      var mi = document.querySelector('.context-submenu .submenu-item[data-action="import-rename"]');
      if (!mi) { R.notes.push('no rename item'); return; }
      mi.click();
      await until(function () { return !!document.getElementById('pnbImportAskInput'); }, 2000);
      var inp = document.getElementById('pnbImportAskInput');
      R.chk.renameAsks = !!inp && inp.value === 'ZZ_MINE' && document.getElementById('pnbImportAskOk').textContent === 'Rename' && natives === 0;
      if (!inp) return;
      inp.value = 'zz_list'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(50);
      R.chk.renameTaken = document.getElementById('pnbImportAskOk').disabled && /An import named ZZ_LIST already exists/.test(document.getElementById('pnbImportAskStatus').textContent) &&
        document.getElementById('pnbImportAskStatus').offsetParent !== null;
      inp.value = 'my new!'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(50);
      R.chk.renameNote = !document.getElementById('pnbImportAskOk').disabled && /Saved as MY_NEW/.test(document.getElementById('pnbImportAskNote').textContent) &&
        document.getElementById('pnbImportAskStatus').offsetParent === null;
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await until(function () { return reqs('rename').length === 1; }, 2000);
      await sleep(100);
      var rn = lastReq('rename');
      R.chk.renameSent = !!rn && rn.id === 6 && rn.new_name === 'MY_NEW' && !ask() && !!window._penumbraImportMeta.MY_NEW && !window._penumbraImportMeta.ZZ_MINE && !!sideItem('MY_NEW') && natives === 0;
      R.info = { toast: toast().slice(0, 120), d: d, rn: rn, natives: natives };
    },
    // a report editor without a grant: no list request (it would only be refused)
    gload0: async function () {
      R.chk.noListCall = reqs('list').length === 0;
      R.info = { n: reqs('list').length };
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
