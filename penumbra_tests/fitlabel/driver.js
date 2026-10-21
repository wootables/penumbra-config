// fitlabel suite - page half (2026-10-20 d): Fit's notice names a column as it shows. A journal
// column's heading carries its internal name (__JOURNAL_NOTES); the notice read it raw ("__JOURNAL_NOTES
// fitted to its content", user on a notes report). The REAL main.js and penumbra_colwidths.js on the
// colmenu harness (its files are read, never written).
//   fitlbl  the Notes column fitted: "Notes fitted to its content"; a data column: its own name
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function plain(h) { var d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); }
  var S = {
    fitlbl: async function () {
      var N = '__JOURNAL_NOTES', P = window.Penumbra, W = P.colWidths, H = P.colWidthsHost;
      if (typeof P.journalPaintFor !== 'function' || typeof P.journalMarkLoadedKey !== 'function') { R.info.why = 'no journal hooks'; return; }
      // a report with the journal on and row notes on, keyed by V_ID (as mfitnote sets it up; the
      // harness keeps the journal off), one row with a note
      window._penumbraJournalHidden = false;
      window._penumbraJournalKeyColumns = ['V_ID'];
      window._penumbraJournalRowNotes = true;
      P.journalMarkLoadedKey();
      window._penumbraToggleState = {};
      window._penumbraRowNoteCounts = {}; window._penumbraRowNotes = {};
      P.journalPaintFor([], true);
      await sleep(250);
      var b = document.querySelector('#resultsTable tbody td.journal-notes-col .journal-notes-btn');
      var k = b && b.getAttribute('data-row-key');
      if (k) { window._penumbraRowNoteCounts[k] = 1; window._penumbraRowNotes[k] = [{ ID: 901, NOTE_TEXT: 'Call the sponsor back' }]; P.journalPaintFor([], true); await sleep(250); }
      R.info.friendly = H.friendly(N);
      R.info.journal = { hidden: !!window._penumbraJournalHidden, rowNotes: window._penumbraJournalRowNotes, names: P.journalSearchColumnNames ? P.journalSearchColumnNames() : null };
      var t0 = window.__toasts.length;
      H.setUser(N, 600); W.apply(); await sleep(250);
      var ok = !!fth(N) && W.fit(fth(N));
      await sleep(400);
      var m1 = window.__toasts.slice(t0).map(plain).join(' | ');
      R.chk.noteLabel = !!ok && /\bNotes fitted to its content\b/.test(m1) && !/__JOURNAL/.test(m1);
      var t1 = window.__toasts.length;
      H.setUser('V_NAME', 600); W.apply(); await sleep(250);
      var ok2 = !!fth('V_NAME') && W.fit(fth('V_NAME'));
      await sleep(400);
      var m2 = window.__toasts.slice(t1).map(plain).join(' | ');
      R.chk.dataLabel = !!ok2 && /\bV_NAME fitted to its content\b/.test(m2);
      R.info.msgs = [m1, m2];
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('no scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = (window.__errors || []).concat(window.__rejections || []).slice(0, 10);
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
