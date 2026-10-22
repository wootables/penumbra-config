// saveconf suite - browser half (2026-10-09). The REAL main.js save handler
// (#confirmServerSaveBtn) against a stubbed save_server_state.php
// (window.__SAVE_ANSWER, every payload in window.__saves). Publishes
//   window.__HCRESULT = { scn, chk: {name: bool}, info, errors } + window.__HCDONE.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  var LOADED = '2026-10-09 10:00:00.000000', LATER = '2026-10-09 11:00:00.000000';
  function conflict(extra) {
    var j = { success: false, conflict: true, message: 'This report was saved by someone else after you opened it.',
      updated_at: '2026-10-09 10:30:00.123456', updated_by: 'alee', updated_by_name: 'Ana Lee', updated_by_self: false,
      updated_when: '2026-10-09 10:30', updated_action: 'UPDATE' };
    for (var k in (extra || {})) j[k] = extra[k];
    return { ok: false, status: 409, json: j };
  }
  function ok(at) { return function (b) { return { ok: true, json: { success: true, new_id: b.short_id, numeric_id: 7, is_new: false, updated_at: at } }; }; }
  function status() { return document.getElementById('serverSaveStatus'); }
  function last() { return window.__saves[window.__saves.length - 1]; }
  async function save() {
    var n = window.__saves.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    await until(function () { return window.__saves.length > n; }, 8000);
    await sleep(150);
    return window.__saves.length > n ? last() : null;
  }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(400);
  }
  var S = {
    // a save over the loaded report sends the version it loaded; a success hands the page the new one
    base: async function () {
      window.__SAVE_ANSWER = ok(LATER);
      var b = await save();
      R.chk.sentBase = !!b && b.base_updated_at === LOADED && b.force === false && b.overwrite === true;
      R.chk.versionMoved = penumbra_vars.reportVersion && penumbra_vars.reportVersion.at === LATER && penumbra_vars.reportVersion.id === 'zzconf';
      var b2 = await save();
      R.chk.secondSendsNew = !!b2 && b2.base_updated_at === LATER;
      R.info = { b: b && { base: b.base_updated_at, force: b.force }, b2: b2 && b2.base_updated_at };
    },
    // a 409: the notice names who and when, the three ways on, the dialog stays
    conflict: async function () {
      window.__SAVE_ANSWER = function () { return conflict(); };
      await save();
      var h = status().innerHTML, t = status().textContent;
      R.chk.noticeWho = /Not saved\./.test(t) && t.indexOf('Ana Lee saved this report at 2026-10-09 10:30, after you opened it.') >= 0;
      R.chk.noticeButtons = !!status().querySelector('.pnb-save-conflict-force') && /href="\?id=zzconf"/.test(h) && /target="_blank"/.test(h);
      R.chk.dialogStays = $('#saveStateLightbox').css('display') !== 'none' && status().style.display !== 'none';
      R.chk.buttonBack = $('#confirmServerSaveBtn').prop('disabled') === false;
      R.chk.versionKept = penumbra_vars.reportVersion.at === LOADED;
      // Save anyway: the same save again, force on, then the version moves
      window.__SAVE_ANSWER = function (b) { return b.force ? ok(LATER)(b) : conflict(); };
      var n = window.__saves.length;
      var fb = status().querySelector('.pnb-save-conflict-force');
      if (fb) fb.click();
      await until(function () { return window.__saves.length > n; }, 8000); await sleep(150);
      var f = window.__saves.length > n ? last() : null;
      R.chk.forceSent = !!f && f.force === true && f.base_updated_at === LOADED;
      R.chk.forceSaved = penumbra_vars.reportVersion.at === LATER;
      // and the force was for that one save only
      window.__SAVE_ANSWER = ok('2026-10-09 12:00:00.000000');
      var g = await save();
      R.chk.forceOnce = !!g && g.force === false && g.base_updated_at === LATER;
      R.info = { text: t.slice(0, 300) };
    },
    // the user's own save from another tab
    self: async function () {
      window.__SAVE_ANSWER = function () { return conflict({ updated_by: 'harness', updated_by_name: 'Har Ness', updated_by_self: true }); };
      await save();
      var t = status().textContent;
      R.chk.selfWords = t.indexOf('You saved this report at 2026-10-09 10:30 in another tab or window, after this page opened it.') >= 0;
      window.__SAVE_ANSWER = function () { return conflict({ updated_action: 'ROLLBACK' }); };
      await save();
      R.chk.rollbackWords = status().textContent.indexOf('Ana Lee rolled this report back to an earlier version at 2026-10-09 10:30') >= 0;
      R.info = { t: t.slice(0, 200) };
    },
    // a save under ANOTHER id, or without Overwrite, sends no version
    otherid: async function () {
      window.__SAVE_ANSWER = ok(LATER);
      $('#serverSaveIdInput').val('zzconf-copy');
      var b = await save();
      R.chk.otherNoBase = !!b && !('base_updated_at' in b);
      R.chk.otherVersion = penumbra_vars.reportVersion.id === 'zzconf-copy' && penumbra_vars.reportVersion.at === LATER;
      $('#serverSaveIdInput').val('zzconf');
      $('#serverSaveOverwriteCheckbox').prop('checked', false);
      var c = await save();
      R.chk.noOverwriteNoBase = !!c && !('base_updated_at' in c);
    },
    // jsaveas (2026-10-10): exploring a table from a journal report, then saving it.
    // Under ANOTHER id the booted report's journal View Options stay out; over that
    // report's own id they stay in (its marks hang off the toggle keys); not exploring,
    // a save as a copy keeps them as before.
    jsaveas: async function () {
      window.__SAVE_ANSWER = ok(LATER);
      if (!document.getElementById('viewOptionJournal')) {
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'viewOptionJournal'; cb.style.display = 'none';
        document.body.appendChild(cb);
      }
      document.getElementById('viewOptionJournal').checked = true;
      window._penumbraJournalKeyColumns = ['ID'];
      window._penumbraJournalToggles = [{ key: 't_done', label: 'Done' }];
      window._penumbraJournalToggleWho = true;
      window._penumbraJournalRowNotes = true;
      window.Penumbra = window.Penumbra || {};
      window.Penumbra.journalReportId = 'zzconf';
      window._penumbraJournalExploring = true;
      function vo(b) { try { return (JSON.parse(b.state_data).viewOptions) || {}; } catch (e) { return null; } }
      function hasJ(v) { return !!v && ['journalEnabled', 'journalKeyColumns', 'journalToggles', 'journalToggleWho', 'journalRowNotes'].some(function (k) { return k in v; }); }
      $('#serverSaveIdInput').val('zz-explored');
      var a = await save(), va = a && vo(a);
      R.chk.otherIdDropped = !!a && va !== null && !hasJ(va);
      var full = (function () { try { return JSON.parse(a.state_data); } catch (e) { return null; } })();
      R.chk.otherKeepsRest = !!full && !!full.query && full.reportTitle !== undefined;
      // (a save under a new id switches the journal to that report - journalSwitchReport ends
      // exploring - so put the page back the way exploring the booted report leaves it)
      window._penumbraJournalExploring = true; window.Penumbra.journalReportId = 'zzconf';
      R.info.afterFirst = { exploring: window._penumbraJournalExploring };
      $('#serverSaveIdInput').val('zzconf');
      var c = await save(), vc = c && vo(c);
      R.chk.sameIdKept = !!vc && vc.journalEnabled === true && JSON.stringify(vc.journalKeyColumns) === '["ID"]' && vc.journalToggles && vc.journalToggles[0].key === 't_done' && vc.journalRowNotes === true;
      window._penumbraJournalExploring = false;
      $('#serverSaveIdInput').val('zz-copy');
      var d = await save(), vd = d && vo(d);
      R.chk.notExploringKept = !!vd && vd.journalEnabled === true && vd.journalToggleWho === true;
      R.info = { a: va, c: vc && Object.keys(vc), d: vd && Object.keys(vd) };
    },
    // schedsave (2026-10-16): a schedule change answers X-Penumbra-Report-Version
    // "<id> <before> <after>"; the page moves on only when it still held <before>.
    // (jQuery.ajax is stubbed here, so the global ajaxComplete is fired by hand.)
    sched: async function () {
      function fire(hdr) {
        var x = { getResponseHeader: function (n) { return n === 'X-Penumbra-Report-Version' ? hdr : null; } };
        $(document).trigger('ajaxComplete', [x, { url: 'manage_schedule.php' }]);
      }
      var enc = encodeURIComponent, MID = '2026-10-09 10:20:00.500000';
      fire(null);
      R.chk.noHeaderKept = penumbra_vars.reportVersion.at === LOADED;
      fire('zzother ' + enc(LOADED) + ' ' + enc(MID));
      R.chk.otherReportKept = penumbra_vars.reportVersion.at === LOADED;
      fire('zzconf ' + enc('2026-10-09 10:10:00.000000') + ' ' + enc(MID));
      R.chk.otherMovedKept = penumbra_vars.reportVersion.at === LOADED;
      fire('zzconf ' + enc(LOADED) + ' ' + enc(MID));
      R.chk.adopted = penumbra_vars.reportVersion.at === MID && penumbra_vars.reportVersion.id === 'zzconf';
      window.__SAVE_ANSWER = ok(LATER);
      var b = await save();
      R.chk.saveSendsAdopted = !!b && b.base_updated_at === MID;
      fire('zzconf%');   // malformed: ignored, no throw
      R.chk.malformedKept = penumbra_vars.reportVersion.at === LATER;
      R.info = { v: penumbra_vars.reportVersion, b: b && b.base_updated_at };
    },
    // nothing loaded (no reportVersion): no version sent
    nover: async function () {
      window.__SAVE_ANSWER = ok(LATER);
      var b = await save();
      R.chk.noVersionNoBase = !!b && !('base_updated_at' in b);
    },
    // "Save anyway" that stops at a validation error does not carry the force on
    validate: async function () {
      window.__SAVE_ANSWER = function () { return conflict(); };
      await save();
      $('#serverSaveTitleInput').val('');
      var n = window.__saves.length;
      var fb = status().querySelector('.pnb-save-conflict-force');
      R.chk.saneStopped = !!fb;
      if (fb) fb.click();
      await sleep(300);
      R.chk.saneStopped = R.chk.saneStopped && window.__saves.length === n;
      $('#serverSaveTitleInput').val('Conflict fixture');
      var b = await save();
      R.chk.forceNotCarried = !!b && b.force === false;
    },
    // (encsave 2026-10-21) Encrypt as the page last SAVED it. The opener used to re-tick Encrypt only from
    // how the page LOADED, so after a save that added a password the next save came up unticked and went
    // out in plaintext. Driven through the real opener (#saveQuery) and the real save button.
    encsave: async function () {
      window.__SAVE_ANSWER = ok(LATER);
      var opens = [], alerts = [], aWas = window.alert;
      window.alert = function (m) { alerts.push(String(m).slice(0, 140)); };
      var ev = $._data($('#saveQuery')[0], 'events');
      var cmEl = document.querySelector('.CodeMirror');
      R.info.diag = { bound: !!(ev && ev.click && ev.click.length), edLen: cmEl && cmEl.CodeMirror ? cmEl.CodeMirror.getValue().length : -1, alerts: alerts };
      // the opener ran when it emptied the password fields (it resets them before deciding the tick)
      async function openDlg() {
        $('#serverSavePassword').val('left-over'); $('#serverSavePasswordConfirm').val('left-over');
        $('#saveQuery').trigger('click'); await sleep(900);
        var o = { pw: $('#serverSavePassword').val(), ticked: $('#enableReportPassword').prop('checked') };
        opens.push(o); return o;
      }
      function sealed(b) { return !!b && /^\{"encrypted":true,"content":"PENUMBRA_GCM::/.test(String(b.state_data || '')); }
      var o1 = await openDlg();
      R.chk.bootUnticked = o1.pw === '' && o1.ticked === false;   // a plaintext report: unticked, as before (and the opener ran)
      $('#enableReportPassword').prop('checked', true).trigger('change');
      $('#serverSavePassword').val('pw-encsave-21'); $('#serverSavePasswordConfirm').val('pw-encsave-21');
      var b1 = await save();
      R.chk.firstEncrypted = sealed(b1);
      var o2 = await openDlg();
      R.chk.openerRan = o2.pw === '';
      R.chk.tickedAfterEncSave = o2.pw === '' && o2.ticked === true;
      // straight to Save with nothing typed: refused for the password - never a plaintext save of it
      var n = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await sleep(1500);
      var b2 = window.__saves.length > n ? last() : null;
      R.chk.secondSaveNotPlain = !b2 || sealed(b2);
      R.chk.passwordAsked = !b2 && /Password is required/.test(status().textContent || '');
      // unticked on purpose: saved in plaintext, and the next open is unticked
      $('#enableReportPassword').prop('checked', false).trigger('change');
      var b3 = await save();
      R.chk.plainSaved = !!b3 && !sealed(b3) && /^\{/.test(String(b3.state_data || '')) && !/"encrypted":true/.test(String(b3.state_data || ''));
      var o3 = await openDlg();
      R.chk.untickedAfterPlainSave = o3.pw === '' && o3.ticked === false;
      window.alert = aWas;
      R.info.diag.opens = opens;
      R.info.r = { b1: b1 && String(b1.state_data).slice(0, 44), b2: b2 && String(b2.state_data).slice(0, 44), status: (status().textContent || '').slice(0, 90) };
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
    R.missing = window.__HC_MISSING || [];
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
