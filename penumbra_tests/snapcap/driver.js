// snapcap suite - browser half (2026-10-23). A capture of the page made while a snapshot is loaded as a VIEW over the
// report - the real Server Save (its POST kept by the stubbed $.ajax), a ?state= link (buildViewStateURL), a link to
// the view (PenumbraViewLink.build) - read the column layout off #tableHeader, which the view has redrawn with the
// SNAPSHOT's columns: all shown, in its captured order, numbered its own way. And the ways back to live data handed
// the report its own layout back only in the flat case.
//   phase 1 pages make the captures and walk the ways out; phase 2 pages (?mode=saved|state|view) open each capture
//   in a fresh page and read the column layout it comes back in.
// The fixture: the report table numbers its columns ID 0, DEPT 1, NAME 2, AMOUNT 3, QTY 4, NOTE 5 and is saved with
// NAME, ID, NOTE, DEPT shown in that order and AMOUNT, QTY hidden after them; snapshot #55 has the same columns,
// #56 puts NOTE first (NOTE 0 ... AMOUNT 5), #57 has no NOTE.
(function () {
  var R = [], INFO = {}, ART = {};
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 1200) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, info: INFO, artifacts: ART, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload).slice(0, 4000);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {};
  var LIVE = window.__LIVE, SNAP = window.__SNAP, SNAP2 = window.__SNAP2, SNAP3 = window.__SNAP3, MODE = window.__MODE, EXP = window.__EXP;
  function J(x) { return JSON.stringify(x); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  function hides() { return window.__CF_HIDES || 0; }

  // ---- the column layout a reader sees on the flat table, and the one a capture writes ----
  // the headings in their order ('#' left out) and the ones shown ('#' counted), by name
  function headLayout() {
    var ths = Array.prototype.slice.call(document.querySelectorAll('#tableHeader > th[data-colname]'));
    return {
      order: ths.map(function (t) { return String(t.getAttribute('data-colname')).toUpperCase(); }).filter(function (n) { return n !== '#'; }),
      visible: ths.filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return String(t.getAttribute('data-colname')).toUpperCase(); })
    };
  }
  var REPORT_HEAD = { order: ['NAME', 'ID', 'NOTE', 'DEPT', 'AMOUNT', 'QTY'], visible: ['#', 'NAME', 'ID', 'NOTE', 'DEPT'] };
  function headIsReport() { return J(headLayout()) === J(REPORT_HEAD); }
  // a state's layout: its two lists (places), and the names at those places when the build writes them (ldlayout)
  function stLay(st) {
    if (!st) return null;
    var o = { vc: st.visibleColumns === undefined ? null : st.visibleColumns, co: st.columnOrder === undefined ? null : st.columnOrder };
    if (st.layoutColumnNames !== undefined) o.nm = st.layoutColumnNames;
    return o;
  }
  var REPORT_ST = { vc: window.__REPORT_VISIBLE, co: window.__REPORT_ORDER };
  function stIsReport(st) { var l = stLay(st); return !!l && J(l.vc) === J(REPORT_ST.vc) && J(l.co) === J(REPORT_ST.co); }
  // a view link's column layout, by name
  function viewC(v) { return v && v.c ? { o: v.c.o, v: v.c.v, n: v.c.n } : null; }
  var REPORT_VC = { o: ['NAME', 'ID', 'NOTE', 'DEPT', 'AMOUNT', 'QTY'], v: ['NAME', 'ID', 'NOTE', 'DEPT'], n: true };
  // the keys two captures disagree on
  function stateDiff(a, b) {
    var out = [], keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { if (J((a || {})[k]) !== J((b || {})[k])) out.push(k); });
    return out;
  }
  function headView() { return 'head=' + J(headLayout()); }

  // ---- the page's own steps ----
  function snapObj(rows, name, ageDays) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: Object.keys(rows[0]),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  function flatRows() { return document.querySelectorAll('#resultsTable > tbody > tr').length; }
  function grpWrappers() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper')); }
  function grpOn() { return $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0; }
  function pivotOn() { return $('#pivot-output-container').is(':visible') && !!document.querySelector('#pivot-output-container td'); }
  async function waitBoot() {
    var ok = await waitFor(function () { return window.__queryDone >= 1 && hides() > 0 && (grpOn() || pivotOn() || flatRows() === LIVE.length); }, 30000);
    await sleep(800);
    return ok;
  }
  // a snapshot loaded as a view (Load As View: the manager's button calls the same function)
  async function loadView(rows, name, ageDays) {
    var h0 = hides();
    H.loadSnap(snapObj(rows, name, ageDays));
    var ok = await waitFor(function () { return H.viewing() && hides() > h0 && flatRows() === rows.length && !$('#loadingOverlay').is(':visible'); }, 20000);
    await sleep(500);
    return ok;
  }
  // back to live data: the caution icon, as a person clicks it
  async function backToLive(lazy) {
    var h0 = hides(), q0 = window.__queryDone;
    $('#snapshotCautionIcon').trigger('click');
    var ok = await waitFor(function () {
      return !H.viewing() && hides() > h0 && (!lazy || window.__queryDone > q0) && (grpOn() || pivotOn() || flatRows() === LIVE.length);
    }, 20000);
    await sleep(800);
    return ok;
  }
  // a new query (the Run button); done when its rows are drawn
  async function runQuery() {
    var q0 = window.__queryDone, h0 = hides();
    document.getElementById('executeQuery').click();
    var ok = await waitFor(function () { return window.__queryDone > q0; }, 20000);
    ok = ok && await waitFor(function () { return hides() > h0 && !H.viewing() && (grpOn() || pivotOn() || flatRows() === LIVE.length); }, 20000);
    await sleep(800);
    return ok;
  }
  // the real Server Save (the dialog's Save to Server button): the state it posts
  async function serverSave() {
    var n0 = window.__posts.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    var ok = await waitFor(function () { return window.__posts.length > n0; }, 10000);
    await sleep(300);
    if (!ok) return null;
    try { return JSON.parse(window.__posts[n0].data).state_data; } catch (e) { return null; }
  }
  function stateOfUrl(u) {
    if (!u) return null;
    try { return JSON.parse(H.decompress(new URLSearchParams(String(u).split('?')[1]).get('state'))); } catch (e) { return null; }
  }
  function viewLink() { var b = window.PenumbraViewLink ? window.PenumbraViewLink.build() : null; return b || {}; }
  function prefsNow() { try { return JSON.parse(localStorage.getItem('penumbra_column_prefs') || 'null'); } catch (e) { return 'unreadable'; } }

  // ============================ ?mode=ov: snapshots loaded as views over the flat report ======================
  async function phaseOverlay() {
    var b = await waitBoot();
    var st0 = H.bso(), vl0 = viewLink();
    rec('V0 the report runs in its saved column layout (NAME ID NOTE DEPT shown, AMOUNT QTY hidden): a capture writes it, a view link carries it by name',
      b && headIsReport() && stIsReport(st0) && J(viewC(vl0.view)) === J(REPORT_VC),
      'boot=' + b + ' ' + headView() + ' state=' + J(stLay(st0)) + ' link=' + J(viewC(vl0.view)) + ' err=' + J(vl0.error));
    INFO.ov_before = { lay: stLay(st0), widths: st0 && st0.columnWidths, sort: st0 && st0.sortCriteria };

    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var hv = headLayout();
    rec('V1 the view shows the snapshot as captured: its columns, all shown, NOTE first',
      on && J(hv) === J({ order: ['NOTE', 'ID', 'DEPT', 'NAME', 'QTY', 'AMOUNT'], visible: ['#', 'NOTE', 'ID', 'DEPT', 'NAME', 'QTY', 'AMOUNT'] }), 'view=' + on + ' ' + headView());

    var st1 = H.bso();
    INFO.ov_during = { lay: stLay(st1), diff: stateDiff(st0, st1) };
    rec('C1 a capture made in the view (buildStateObject) writes the report\'s own column layout, as one made before the view',
      on && J(stLay(st1)) === J(stLay(st0)), 'before=' + J(stLay(st0)) + ' during=' + J(stLay(st1)) + ' differs=' + J(stateDiff(st0, st1)));

    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    ART.save = sd;
    rec('C2 the Server Save made in the view posts the report\'s own column layout',
      !!st2 && J(stLay(st2)) === J(stLay(st0)) && H.viewing(), 'posted=' + !!st2 + ' layout=' + J(stLay(st2)));

    var u3 = H.bvu(true), st3 = stateOfUrl(u3);
    ART.state = u3;
    rec('C3 a ?state= link made in the view carries the report\'s own column layout',
      !!st3 && J(stLay(st3)) === J(stLay(st0)), 'layout=' + J(stLay(st3)));

    var vl1 = viewLink();
    ART.view = vl1.url || null;
    rec('C4 a link to the view made in the view carries the report\'s own column layout, by name',
      !!vl1.view && J(viewC(vl1.view)) === J(viewC(vl0.view)), 'before=' + J(viewC(vl0.view)) + ' during=' + J(viewC(vl1.view)) + ' err=' + J(vl1.error));

    var back = await backToLive(false);
    var st4 = H.bso();
    rec('C5 back to live data: the report in its own layout, and a capture the one from before the view, whole',
      back && headIsReport() && J(st4) === J(st0), 'back=' + back + ' ' + headView() + ' differs=' + J(stateDiff(st0, st4)));

    // a snapshot without one of the report's columns (no NOTE)
    var on5 = await loadView(SNAP3, 'Older snapshot', 9);
    var st5 = H.bso();
    INFO.ov_nonote = { lay: stLay(st5), widths: st5 && st5.columnWidths, diff: stateDiff(st0, st5) };
    rec('C6 a capture made in a view of a snapshot without NOTE writes the report\'s own column layout',
      on5 && J(stLay(st5)) === J(stLay(st0)), 'view=' + on5 + ' during=' + J(stLay(st5)) + ' differs=' + J(stateDiff(st0, st5)));

    // Run from the view: the report's query runs, the view ends
    var ran = await runQuery();
    var st6 = H.bso();
    rec('C7 Run from a snapshot view: the report comes back in its own column layout (not the view\'s), a capture writes it',
      ran && headIsReport() && J(stLay(st6)) === J(stLay(st0)), 'run=' + ran + ' ' + headView() + ' layout=' + J(stLay(st6)));
  }

  // ============================ ?mode=ovg: a view over the grouped report ======================================
  async function phaseOverlayGrouped() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    rec('G0 the report runs grouped by DEPT over its saved column layout: a capture writes both',
      b && g0 && headIsReport() && stIsReport(st0) && st0.groupBy === 'DEPT', 'boot=' + b + ' grouped=' + g0 + ' ' + headView() + ' state=' + J(stLay(st0)) + ' groupBy=' + J(st0 && st0.groupBy));
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var st1 = H.bso();
    INFO.ovg_during = { lay: stLay(st1), groupBy: st1 && st1.groupBy, diff: stateDiff(st0, st1) };
    rec('G1 a capture made in a view over the grouped report writes the report\'s own column layout',
      on && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' during=' + J(stLay(st1)) + ' differs=' + J(stateDiff(st0, st1)));
    var back = await backToLive(false);
    var st2 = H.bso();
    rec('G2 back to live data from it: the grouped report comes back, the flat table under it in the report\'s own layout, a capture the one from before the view',
      back && grpOn() && headIsReport() && J(stLay(st2)) === J(stLay(st0)), 'back=' + back + ' grouped=' + grpOn() + ' ' + headView() + ' layout=' + J(stLay(st2)) + ' differs=' + J(stateDiff(st0, st2)));
    // Remove Grouping: the flat table a person sees next
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    rec('G3 ...then Remove Grouping: the flat table in the report\'s own layout', flat && headIsReport(), 'flat=' + flat + ' ' + headView());
  }

  // ============================ ?mode=ovp: a view over the report's pivot ======================================
  async function phaseOverlayPivot() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotOn, 15000);
    await sleep(1200);
    var st0 = H.bso();
    rec('P0 the report runs as its pivot over its saved column layout: a capture writes both',
      b && p0 && headIsReport() && stIsReport(st0) && !!st0.pivot, 'boot=' + b + ' pivot=' + p0 + ' ' + headView() + ' state=' + J(stLay(st0)) + ' pivot=' + !!(st0 && st0.pivot));
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var st1 = H.bso();
    INFO.ovp_during = { lay: stLay(st1), pivot: !!(st1 && st1.pivot), diff: stateDiff(st0, st1) };
    rec('P1 a capture made in a view over the pivot writes the report\'s own column layout',
      on && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' during=' + J(stLay(st1)) + ' differs=' + J(stateDiff(st0, st1)));
    var back = await backToLive(false);
    var st2 = H.bso();
    rec('P2 back to live data from it: the pivot comes back, the flat table under it in the report\'s own layout, a capture the one from before the view',
      back && pivotOn() && headIsReport() && J(stLay(st2)) === J(stLay(st0)), 'back=' + back + ' pivot=' + pivotOn() + ' ' + headView() + ' layout=' + J(stLay(st2)) + ' differs=' + J(stateDiff(st0, st2)));
  }

  // ============================ ?mode=ovlive: a live action from a view ======================================
  async function phaseOverlayLive() {
    var b = await waitBoot();
    var st0 = H.bso();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    // a group preset applied during the view: the snapshot exit for live actions, then the grouping's Apply
    H.exitLive();
    await sleep(200);
    var hv = headLayout(), st1 = H.bso();
    rec('L1 a live action from a snapshot view (a group preset): the live table it starts from is in the report\'s own layout',
      b && on && J(hv) === J(REPORT_HEAD) && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' head=' + J(hv) + ' layout=' + J(stLay(st1)));
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(grpOn, 15000);
    await sleep(600);
    var st2 = H.bso();
    INFO.ovlive_grouped = { lay: stLay(st2), groupBy: st2 && st2.groupBy };
    rec('L2 ...grouped by it: a capture writes the report\'s own column layout under the grouping',
      g && J(stLay(st2)) === J(stLay(st0)), 'grouped=' + g + ' layout=' + J(stLay(st2)));
  }

  // ============================ ?mode=ovcol: a column hidden during a view ====================================
  async function phaseOverlayColumn() {
    var b = await waitBoot();
    var st0 = H.bso(), pr0 = prefsNow();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var M = window.Penumbra && window.Penumbra.headerMenu, l = M && M.layout ? M.layout() : null, applied = false;
    if (l && l.cols) {
      l.cols.forEach(function (c) { if (String(c.colName).toUpperCase() === 'QTY') c.visible = false; });
      applied = !!M.applyLayout(l);
    }
    await sleep(400);
    var hv = headLayout(), pr1 = prefsNow(), st1 = H.bso();
    INFO.ovcol = { prefsBefore: pr0, prefsAfter: pr1, head: hv };
    rec('K1 a column hidden in the view (the header menu): the view hides it; a capture still writes the report\'s own layout',
      b && on && applied && hv.visible.indexOf('QTY') < 0 && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' applied=' + applied + ' head=' + J(hv) + ' layout=' + J(stLay(st1)));
    var back = await backToLive(false);
    var st2 = H.bso();
    rec('K2 back to live data: the report in its own layout, a capture the one from before the view',
      back && headIsReport() && J(stLay(st2)) === J(stLay(st0)), 'back=' + back + ' ' + headView() + ' layout=' + J(stLay(st2)) + ' prefs=' + J(prefsNow()));
  }

  // ============================ ?mode=lz: a ?snap=56 tab of the report =======================================
  async function phaseLazy() {
    var on = await waitFor(function () { return H.viewing() && flatRows() === SNAP2.length && hides() > 0; }, 30000);
    await sleep(800);
    var q0 = window.__queryDone, hv = headLayout();
    rec('Z0 a ?snap= link of the report opens the snapshot as captured, without running the report\'s query',
      on && q0 === 0 && J(hv.order) === J(['NOTE', 'ID', 'DEPT', 'NAME', 'QTY', 'AMOUNT']), 'view=' + on + ' queries=' + q0 + ' ' + headView());
    var st1 = H.bso();
    INFO.lz_during = { lay: stLay(st1), stored: H.stored() };
    rec('Z1 a capture made in the ?snap= view writes the report\'s own column layout (the saved one: its query never ran)',
      on && stIsReport(st1), 'during=' + J(stLay(st1)));
    var u2 = H.bvu(true), st2 = stateOfUrl(u2);
    ART.state = u2;
    rec('Z2 a ?state= link made in the ?snap= view carries the report\'s own column layout', !!st2 && stIsReport(st2), 'layout=' + J(stLay(st2)));
    var vl = viewLink();
    rec('Z3 a link to the view stays refused in a ?snap= tab (a snapshot has its own Copy link)',
      !vl.view && /snapshot has its own/i.test(String(vl.error || '')), 'err=' + J(vl.error));
    var back = await backToLive(true);
    rec('Z4 back to live data (the report\'s query runs): the report in its own column layout', back && headIsReport(), 'back=' + back + ' ' + headView());
  }

  // ============================ phase 2: a capture opened in a fresh page ===================================
  async function phaseLoad() {
    var tag = { saved: 'a Save', state: 'a ?state= link', view: 'a link to the view' }[MODE] || MODE;
    var id = 'R-' + EXP + '-' + MODE;
    var b = await waitBoot();
    rec(id + ' ' + tag + ' made in a snapshot view (' + EXP + ') reopens the report in its own column layout: NAME ID NOTE DEPT shown, AMOUNT QTY hidden',
      b && headIsReport(), 'boot=' + b + ' ' + headView() + ' preErr=' + J(window.__PRE_ERR || null));
  }

  (async function () {
    try {
      var need = ['compress', 'decompress', 'loadSnap', 'restore', 'exitLive', 'bso', 'bvu', 'viewing', 'stored'];
      var miss = need.filter(function (k) { return !H[k]; });
      if (miss.length) { finish('hook: not exported: ' + miss.join(', ')); return; }
      if (MODE === 'ov') await phaseOverlay();
      else if (MODE === 'ovg') await phaseOverlayGrouped();
      else if (MODE === 'ovp') await phaseOverlayPivot();
      else if (MODE === 'ovlive') await phaseOverlayLive();
      else if (MODE === 'ovcol') await phaseOverlayColumn();
      else if (MODE === 'lz') await phaseLazy();
      else if (MODE === 'saved' || MODE === 'state' || MODE === 'view') await phaseLoad();
      else { finish('unknown mode ' + MODE); return; }
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
