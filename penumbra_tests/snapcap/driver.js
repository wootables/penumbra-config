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
  function snapObj(rows, name, ageDays, serverId) {
    var o = {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: Object.keys(rows[0]),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
    // (snapgrp) a SERVER snapshot: a comparison of two has its own link (a browser-local one refuses it)
    if (serverId) o.serverId = serverId;
    return o;
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
    // (the summaries' store writes the report's entry on every column apply, layout or not: an entry without a
    // layout in it is the viewer's summaries, none here)
    function layoutStored(p) { var e = p && p.snapcap; return !!(e && (Array.isArray(e.order) || Array.isArray(e.visible))); }
    rec('K1b ...and changes the view only: no layout stored as this viewer\'s own for the report',
      applied && !layoutStored(pr0) && !layoutStored(pr1), 'before=' + J(pr0) + ' after=' + J(pr1));
    var back = await backToLive(false);
    var st2 = H.bso();
    rec('K2 back to live data: the report in its own layout, a capture the one from before the view',
      back && headIsReport() && J(stLay(st2)) === J(stLay(st0)), 'back=' + back + ' ' + headView() + ' layout=' + J(stLay(st2)) + ' prefs=' + J(prefsNow()));
    // the next run builds the table again (a viewer's stored layout wins there)
    var ran = await runQuery();
    rec('K3 ...and a Run after it: the report still in its own layout (no snapshot layout stored for this viewer)',
      ran && headIsReport(), 'run=' + ran + ' ' + headView() + ' prefs=' + J(prefsNow()));
  }

  // ============================ ?mode=ovchg: a layout changed (not saved) before the view =====================
  // the viewer hides NAME on the live report (the header menu; stored as their own layout, as it always is), then
  // loads a view: a capture made in it writes the layout they had - the live one, not the report's stored one
  var CHG_HEAD = { order: ['NAME', 'ID', 'NOTE', 'DEPT', 'AMOUNT', 'QTY'], visible: ['#', 'ID', 'NOTE', 'DEPT'] };
  async function phaseOverlayChanged() {
    var b = await waitBoot();
    var M = window.Penumbra && window.Penumbra.headerMenu, l = M && M.layout ? M.layout() : null, applied = false;
    if (l && l.cols) {
      l.cols.forEach(function (c) { if (String(c.colName).toUpperCase() === 'NAME') c.visible = false; });
      applied = !!M.applyLayout(l);
    }
    await sleep(400);
    var st0 = H.bso(), vl0 = viewLink();
    rec('U0 the viewer hides NAME on the live report: a capture writes that layout (NAME hidden), a view link carries it',
      b && applied && J(headLayout()) === J(CHG_HEAD) && !!st0 && J(st0.visibleColumns) === J(['#', 0, 5, 1]) && J(st0.columnOrder) === J(window.__REPORT_ORDER)
        && !!vl0.view && J(viewC(vl0.view).v) === J(['ID', 'NOTE', 'DEPT']),
      'applied=' + applied + ' ' + headView() + ' state=' + J(stLay(st0)) + ' link=' + J(viewC(vl0.view)));
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var st1 = H.bso(), vl1 = viewLink();
    rec('U1 a capture made in a view loaded over it writes the layout the viewer had (NAME hidden), not the report\'s stored one',
      on && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' before=' + J(stLay(st0)) + ' during=' + J(stLay(st1)));
    rec('U2 ...and a link to the view made in it carries that layout by name',
      !!vl1.view && J(viewC(vl1.view)) === J(viewC(vl0.view)), 'before=' + J(viewC(vl0.view)) + ' during=' + J(viewC(vl1.view)) + ' err=' + J(vl1.error));
    var back = await backToLive(false);
    rec('U3 back to live data: the layout the viewer had, NAME hidden', back && J(headLayout()) === J(CHG_HEAD), 'back=' + back + ' ' + headView());
    var on2 = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var ran = await runQuery();
    rec('U4 Run from a view loaded over it: the layout the viewer had, NAME hidden', on2 && ran && J(headLayout()) === J(CHG_HEAD), 'view=' + on2 + ' run=' + ran + ' ' + headView());
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

  // ============================ ?mode=ovcalc: the viewer's own calculated column (&calc=DOUBLE) ===============
  // The Save takes a calculated column the viewer did not tick out of the lists BY PLACE (penumbra_calc.js
  // stripFromState, through a name -> place map). Snapshot #58 was taken before NOTE existed, with DOUBLE at its
  // place 5 - the live report's NOTE place (the live run appends DOUBLE at 6).
  async function phaseOverlayCalc() {
    var b = await waitBoot();
    var hb = headLayout();
    var sd0 = await serverSave(), st0 = null;
    try { st0 = JSON.parse(sd0); } catch (e) {}
    rec('E0 the report runs with the viewer\'s calculated column DOUBLE appended, shown; the Server Save takes it out: the report\'s own layout',
      b && J(hb.order) === J(REPORT_HEAD.order.concat(['DOUBLE'])) && hb.visible.indexOf('DOUBLE') >= 0 && stIsReport(st0) && !!st0 && !st0.calcColumns,
      'boot=' + b + ' head=' + J(hb) + ' posted=' + J(stLay(st0)) + ' calc=' + J(st0 && st0.calcColumns) + ' sort=' + J(st0 && st0.sortCriteria));
    var on = await loadView(window.__SNAP4, 'Older snapshot with DOUBLE', 6);
    var sd1 = await serverSave(), st1 = null;
    try { st1 = JSON.parse(sd1); } catch (e) {}
    ART.save = sd1;
    rec('E1 the Server Save made in a view of a snapshot with DOUBLE one place earlier takes DOUBLE out of the report\'s own layout - not the report\'s NOTE: layout and sort as the save before the view',
      on && !!st1 && !!st0 && J(stLay(st1)) === J(stLay(st0)) && J(st1.sortCriteria) === J(st0.sortCriteria),
      'view=' + on + ' before=' + J(stLay(st0)) + ' during=' + J(stLay(st1)) + ' sortBefore=' + J(st0 && st0.sortCriteria) + ' sortDuring=' + J(st1 && st1.sortCriteria));
  }

  // ============================ ?mode=ovcalc0: a view loaded while the report's last run came back empty ======
  // no rows on screen -> the view keeps no stash: a capture writes the report's STORED layout, whose places the
  // snapshot's name -> place map knows nothing of; the calculated column DOUBLE (still applied from the run before)
  // must go by name only - the snapshot's map would take out its place 5, the report's NOTE
  async function phaseOverlayCalcEmpty() {
    var b = await waitBoot();
    var hb = headLayout();
    window.__EMPTY_NEXT = true;
    var q0 = window.__queryDone, h0 = hides();
    document.getElementById('executeQuery').click();
    var ran = await waitFor(function () { return window.__queryDone > q0 && hides() > h0; }, 20000);
    await sleep(800);
    window.__EMPTY_NEXT = false;
    var empty = flatRows() === 0;
    var on = await loadView(window.__SNAP4, 'Older snapshot with DOUBLE', 6);
    var stash = H.stash();
    var sd = await serverSave(), st = null;
    try { st = JSON.parse(sd); } catch (e) {}
    rec('E2 a view loaded while the report\'s last run came back empty (no stash): the Server Save writes the report\'s stored layout whole, DOUBLE taken out by name - not the report\'s NOTE place',
      b && hb.order.indexOf('DOUBLE') >= 0 && ran && empty && on && stash === null && stIsReport(st),
      'boot=' + b + ' head=' + J(hb) + ' run=' + ran + ' empty=' + empty + ' view=' + on + ' stash=' + J(stash) + ' posted=' + J(stLay(st)) + ' sort=' + J(st && st.sortCriteria));
  }

  // ============================ ?mode=ovundo: Reset all on a view, its Undo after going back to live data ======
  async function phaseOverlayUndoLater() {
    var b = await waitBoot();
    var M = window.Penumbra && window.Penumbra.headerMenu, l = M && M.layout ? M.layout() : null, applied = false;
    if (l && l.cols) {
      l.cols.forEach(function (c) { if (String(c.colName).toUpperCase() === 'NAME') c.visible = false; });
      applied = !!M.applyLayout(l);
    }
    await sleep(400);
    var pr0 = prefsNow();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var undo = M && M.resetAll ? M.resetAll() : null;
    await sleep(300);
    var back = await backToLive(false);
    var hv0 = headLayout();
    // the colmenu offers the Undo for a few seconds: clicked now, on the live report
    if (typeof undo === 'function') undo();
    await sleep(400);
    var hv1 = headLayout(), pr1 = prefsNow();
    rec('R4 the Undo of a Reset all made on a view, clicked after going back to live data: the live report keeps the viewer\'s layout (NAME hidden), and nothing of the view\'s is stored',
      b && applied && on && typeof undo === 'function' && back && J(hv0) === J(CHG_HEAD) && J(hv1) === J(CHG_HEAD) && J(layoutOf(pr1)) === J(layoutOf(pr0)),
      'applied=' + applied + ' view=' + on + ' undo=' + (typeof undo) + ' back=' + back + ' before=' + J(hv0) + ' after=' + J(hv1) + ' prefsBefore=' + J(layoutOf(pr0)) + ' prefsAfter=' + J(layoutOf(pr1)));
  }

  // ============================ ?mode=ovfail: a second snapshot failing to load during a view ==================
  async function phaseOverlayFail() {
    var b = await waitBoot();
    var st0 = H.bso();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    // a snapshot whose rows are not rows: the load throws after the view's stash exists, and its failure path puts
    // the live report back
    H.loadSnap({ name: 'Broken snapshot', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
                 columnNames: ['ID'], compressedData: H.compress(JSON.stringify([{ rowData: 5 }])) });
    var back = await waitFor(function () { return !H.viewing() && flatRows() === LIVE.length; }, 20000);
    await sleep(800);
    var st1 = H.bso();
    rec('B1 a snapshot failing to load during a view: the live report comes back in its own column layout, a capture writes it',
      b && on && back && headIsReport() && J(stLay(st1)) === J(stLay(st0)), 'view=' + on + ' back=' + back + ' ' + headView() + ' layout=' + J(stLay(st1)));
  }

  // ============================ ?mode=ovreset: Reset all (the header menu) on a view ===========================
  // the viewer has their own layout for the report (NAME hidden on the live report, stored as it always is), loads a
  // view and uses the header menu's Reset all there, then its Undo
  function layoutOf(p) { var e = p && p.snapcap; return e ? { order: e.order, visible: e.visible, isNumVisible: e.isNumVisible } : null; }
  async function phaseOverlayReset() {
    var b = await waitBoot();
    var M = window.Penumbra && window.Penumbra.headerMenu, l = M && M.layout ? M.layout() : null, applied = false;
    if (l && l.cols) {
      l.cols.forEach(function (c) { if (String(c.colName).toUpperCase() === 'NAME') c.visible = false; });
      applied = !!M.applyLayout(l);
    }
    await sleep(400);
    var pr0 = prefsNow();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var undo = M && M.resetAll ? M.resetAll() : null;
    await sleep(400);
    var pr1 = prefsNow(), hv1 = headLayout();
    // (how the view is laid out after it is not this round's: the report's stored layout, saved without
    // layoutColumnNames, is read BY PLACE over the snapshot's columns - pre-existing, a follow-up)
    INFO.ovreset_view = { headAfterResetAll: hv1 };
    rec('R1 Reset all on a snapshot view leaves the viewer\'s own layout for the report stored as it was',
      b && applied && !!layoutOf(pr0) && Array.isArray(layoutOf(pr0).order) && on && typeof undo === 'function' && J(layoutOf(pr1)) === J(layoutOf(pr0)),
      'applied=' + applied + ' view=' + on + ' undo=' + (typeof undo) + ' before=' + J(layoutOf(pr0)) + ' after=' + J(layoutOf(pr1)) + ' head=' + J(hv1));
    if (typeof undo === 'function') undo();
    await sleep(400);
    var pr2 = prefsNow();
    rec('R2 ...and its Undo too: the viewer\'s own layout still stored as it was', typeof undo === 'function' && J(layoutOf(pr2)) === J(layoutOf(pr0)),
      'before=' + J(layoutOf(pr0)) + ' afterUndo=' + J(layoutOf(pr2)));
    var back = await backToLive(false);
    rec('R3 back to live data: the layout the viewer had, NAME hidden', back && J(headLayout()) === J(CHG_HEAD), 'back=' + back + ' ' + headView());
    try { ART.prefs = localStorage.getItem('penumbra_column_prefs'); } catch (e) { ART.prefs = null; }
  }

  // ============================ ?mode=ovpanel: the column panel's Apply on a view ============================
  async function phaseOverlayPanel() {
    var b = await waitBoot();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    $('#settingsPanel').addClass('is-open');
    if (window.Penumbra && window.Penumbra.refreshSettingsColumns) window.Penumbra.refreshSettingsColumns();
    await sleep(200);
    var box = document.querySelector('#spColumnList .sp-col-item[data-colname="QTY"] .sp-col-check');
    if (box) { box.checked = false; $(box).trigger('change'); }
    $('#action_overlay').empty();
    var h0 = hides();
    $('#spApply').prop('disabled', false).trigger('click');
    await waitFor(function () { return hides() > h0; }, 10000);
    await sleep(500);
    var said = String(($('#action_overlay').text() || '')).replace(/\s+/g, ' ').trim(), hv = headLayout(), pr = prefsNow();
    rec('A1 the column panel\'s Apply on a snapshot view says it changed the view only (nothing stored), not that it saved the layout for the report',
      b && on && !!box && /snapshot view only/i.test(said) && !/persist across sessions/i.test(said), 'view=' + on + ' box=' + !!box + ' said=' + J(said.slice(0, 220)));
    var noLayout = !layoutOf(pr) || !Array.isArray(layoutOf(pr).order);
    rec('A2 ...the view hides QTY, and no layout is stored as this viewer\'s own for the report',
      !!box && hv.visible.indexOf('QTY') < 0 && noLayout, 'head=' + J(hv) + ' prefs=' + J(pr));
  }

  // ============================ snapgrp (2026-10-24): the rest of the report's own view during a view ============
  // A view empties the grouped container, hides the pivot and nulls its settings, and draws the snapshot's columns
  // only: a capture made during it - the Server Save, a ?state= link, a link to the view - wrote no grouping and no
  // pivot (buildStateObject reads them off the screen), and the widths, summaries and summary formulas of the columns
  // the snapshot lacks went with them (read off the header). A ?snap= tab's Server Save dropped the report's own
  // calculated columns (none applied: its query never ran).
  // canonical JSON (keys sorted): two captures that differ only in the order of their keys are the same capture
  function CJ(x) {
    return JSON.stringify(x, function (k, v) {
      if (v && typeof v === 'object' && !Array.isArray(v)) { var o = {}; Object.keys(v).sort().forEach(function (kk) { o[kk] = v[kk]; }); return o; }
      return v;
    });
  }
  function cdiff(a, b) {
    var out = [], keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { if (CJ((a || {})[k]) !== CJ((b || {})[k])) out.push(k); });
    return out;
  }
  var GRP_KEYS = ['groupBy', 'groupAgg', 'groupSort', 'groupStartDepth', 'groupLayout', 'groupLimit'];
  function grpOf(st) { var o = {}; if (st) GRP_KEYS.forEach(function (k) { if (st[k] !== undefined && st[k] !== null) o[k] = st[k]; }); return o; }
  var REPORT_GRP = window.__REPORT_GROUP2;
  function grpCol() { var g = H.grp ? H.grp() : null; return g ? String(g.col) : null; }
  function grpView(v) { return v && v.view ? { m: v.view.m, g: v.view.g || null, p: v.view.p ? true : false } : null; }
  var NW_PARTS = ['columnWidths', 'columnSummaries', 'columnSummaryFormulas'];
  function nwOf(st) { var o = {}; if (st) NW_PARTS.forEach(function (k) { if (st[k] !== undefined) o[k] = st[k]; }); return o; }
  var REPORT_NW = { columnWidths: window.__REPORT_WIDTHS_NW, columnSummaries: window.__REPORT_SUMS, columnSummaryFormulas: window.__REPORT_FX };

  // ?mode=gv: a view over the grouped report
  async function phaseGroupView() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(500);
    var st0 = H.bso(), vl0 = viewLink();
    rec('GV0 the report runs grouped (by DEPT, summed AMOUNT, largest groups first, the top 2, one level open): a capture writes that grouping, a view link carries it',
      b && g0 && CJ(grpOf(st0)) === CJ(REPORT_GRP) && !!vl0.view && vl0.view.m === 'group',
      'boot=' + b + ' grouped=' + g0 + ' grp=' + CJ(grpOf(st0)) + ' link=' + J(grpView(vl0)) + ' err=' + J(vl0.error));
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var st1 = H.bso();
    INFO.gv_during = { grp: grpOf(st1), diff: cdiff(st0, st1) };
    rec('GV1 a capture made in a view over the grouped report writes the report\'s own grouping',
      on && CJ(grpOf(st1)) === CJ(grpOf(st0)), 'view=' + on + ' before=' + CJ(grpOf(st0)) + ' during=' + CJ(grpOf(st1)));
    rec('GV1b ...the whole capture is the one made before the view', on && cdiff(st0, st1).length === 0, 'differs=' + J(cdiff(st0, st1)));
    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    ART.save = sd;
    rec('GV2 the Server Save made in the view posts the report\'s own grouping', !!st2 && CJ(grpOf(st2)) === CJ(grpOf(st0)), 'posted=' + !!st2 + ' grp=' + CJ(grpOf(st2)));
    var u3 = H.bvu(true), st3 = stateOfUrl(u3);
    ART.state = u3;
    rec('GV3 a ?state= link made in the view carries the report\'s own grouping', !!st3 && CJ(grpOf(st3)) === CJ(grpOf(st0)), 'grp=' + CJ(grpOf(st3)));
    var vl1 = viewLink();
    ART.view = vl1.url || null;
    rec('GV4 a link to the view made in the view carries the report\'s own grouping', !!vl1.view && vl1.view.m === 'group' && CJ(vl1.view.g) === CJ(vl0.view && vl0.view.g),
      'before=' + J(grpView(vl0)) + ' during=' + J(grpView(vl1)) + ' err=' + J(vl1.error));
    // the viewer groups the snapshot by NAME during the view (the status bar's / header menu's one-click grouping)
    window.Penumbra.groupByColumn('NAME');
    var gn = await waitFor(function () { return grpOn() && grpCol() === 'NAME'; }, 15000);
    await sleep(600);
    var st5 = H.bso(), vl5 = viewLink();
    INFO.gv_regroup = { grp: grpOf(st5), link: grpView(vl5) };
    rec('GV5 the snapshot grouped by NAME during the view (the view only): a capture still writes the report\'s own grouping, a view link too',
      gn && CJ(grpOf(st5)) === CJ(grpOf(st0)) && !!vl5.view && CJ(vl5.view.g) === CJ(vl0.view && vl0.view.g),
      'regrouped=' + gn + ' col=' + grpCol() + ' grp=' + CJ(grpOf(st5)) + ' link=' + J(grpView(vl5)));
    var openKeys = ['gp', 'gr', 'gc', 'go', 'ga', 'gb', 'gt'].filter(function (k) { return !!vl5.view && vl5.view[k] !== undefined; });
    rec('GV5b ...and that link carries none of the view\'s own open groups (they are the snapshot\'s NAME groups)',
      gn && !!vl5.view && openKeys.length === 0, 'keys=' + J(openKeys) + ' go=' + J(vl5.view && vl5.view.go) + ' ga=' + J(vl5.view && vl5.view.ga));
    var back = await backToLive(false);
    var st6 = H.bso();
    INFO.gv_back = { col: grpCol(), grp: grpOf(st6) };
    rec('GV6 back to live data: grouped by DEPT as the report was, and a capture writes the report\'s grouping, not the view\'s',
      back && grpOn() && grpCol() === 'DEPT' && CJ(grpOf(st6)) === CJ(grpOf(st0)), 'back=' + back + ' grouped=' + grpOn() + ' col=' + grpCol() + ' grp=' + CJ(grpOf(st6)));
    // Run from a view: the report's query runs, the view ends
    var on2 = await loadView(SNAP, 'Viewed snapshot', 2);
    var ran = await runQuery();
    var st7 = H.bso();
    INFO.gv_run = { grouped: grpOn(), grp: grpOf(st7) };
    rec('GV7 Run from a snapshot view of the grouped report: the report comes back grouped as it was',
      on2 && ran && grpOn() && CJ(grpOf(st7)) === CJ(grpOf(st0)), 'view=' + on2 + ' run=' + ran + ' grouped=' + grpOn() + ' grp=' + CJ(grpOf(st7)));
  }

  // ?mode=pv: a view over the report's pivot, sorted by its DEPT row field (descending: West North East)
  function pivotDepts() {
    return Array.prototype.map.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (r) { return r.cells[0] ? r.cells[0].textContent.trim() : '?'; })
      .filter(function (d) { return !/total/i.test(d); });
  }
  function scNow() { return (H.sc() || []).map(function (c) { return [String(c.colIdentifier), String(c.colIndex), String(c.direction)]; }); }
  var PSORT = [['DEPT', '0', 'desc']], PDEPTS = ['West', 'North', 'East'];
  async function phasePivotView() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotOn, 15000);
    await sleep(1200);
    var st0 = H.bso(), vl0 = viewLink();
    rec('PV0 the report runs as its pivot sorted by DEPT descending: a capture writes both, a view link carries them',
      b && p0 && !!st0 && !!st0.pivot && CJ(st0.sortCriteria) === CJ(window.__REPORT_PSORT) && J(pivotDepts()) === J(PDEPTS) && !!vl0.view && vl0.view.m === 'pivot' && CJ(vl0.view.sc) === CJ(window.__REPORT_PSORT),
      'boot=' + b + ' pivot=' + p0 + ' sort=' + J(st0 && st0.sortCriteria) + ' rows=' + J(pivotDepts()) + ' link=' + J(grpView(vl0)) + ' sc=' + J(vl0.view && vl0.view.sc) + ' err=' + J(vl0.error));
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var st1 = H.bso();
    INFO.pv_during = { pivot: !!(st1 && st1.pivot), sort: st1 && st1.sortCriteria, diff: cdiff(st0, st1) };
    rec('PV1 a capture made in a view over the pivot writes the report\'s own pivot, with its sort', on && !!st1 && !!st1.pivot && CJ(st1.pivot) === CJ(st0.pivot) && CJ(st1.sortCriteria) === CJ(st0.sortCriteria),
      'view=' + on + ' pivot=' + !!(st1 && st1.pivot) + ' sort=' + J(st1 && st1.sortCriteria));
    rec('PV1b ...the whole capture is the one made before the view', on && cdiff(st0, st1).length === 0, 'differs=' + J(cdiff(st0, st1)));
    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    ART.save = sd;
    rec('PV2 the Server Save made in the view posts the report\'s own pivot', !!st2 && !!st2.pivot && CJ(st2.pivot) === CJ(st0.pivot), 'posted=' + !!st2 + ' pivot=' + !!(st2 && st2.pivot));
    var u3 = H.bvu(true), st3 = stateOfUrl(u3);
    ART.state = u3;
    rec('PV3 a ?state= link made in the view carries the report\'s own pivot', !!st3 && !!st3.pivot && CJ(st3.pivot) === CJ(st0.pivot), 'pivot=' + !!(st3 && st3.pivot));
    var vl1 = viewLink();
    ART.view = vl1.url || null;
    rec('PV4 a link to the view made in the view carries the report\'s own pivot, with its sort', !!vl1.view && vl1.view.m === 'pivot' && CJ(vl1.view.p) === CJ(vl0.view && vl0.view.p) && CJ(vl1.view.sc) === CJ(vl0.view && vl0.view.sc),
      'before=' + J(grpView(vl0)) + ' during=' + J(grpView(vl1)) + ' sc=' + J(vl1.view && vl1.view.sc) + ' err=' + J(vl1.error));
    var back = await backToLive(false);
    await sleep(800);
    var st5 = H.bso();
    rec('PV5 back to live data: the pivot comes back in its sort, a capture writes both', back && pivotOn() && !!st5 && CJ(st5.pivot) === CJ(st0.pivot) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS),
      'back=' + back + ' pivot=' + pivotOn() + ' sort=' + J(scNow()) + ' rows=' + J(pivotDepts()));
    var on2 = await loadView(SNAP, 'Viewed snapshot', 2);
    // the snapshot grouped in the view through the dialog: one level open, the top 1 (the view only)
    window.Penumbra.groupByColumn('DEPT');
    await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(300);
    $('#groupStartDepth').val('1'); $('#groupLimitN').val('1');
    $('#confirmGroupingBtn').trigger('click');
    await sleep(1200);
    var gview = H.grp();
    var ran = await runQuery();
    await waitFor(function () { return pivotOn() && pivotDepts().length === 3; }, 8000);
    await sleep(1500);   // the pivot's deferred formatting
    var st6 = H.bso(), g7 = H.grp();
    INFO.pv_run = { pivot: pivotOn(), saved: !!(st6 && st6.pivot), sort: scNow(), rows: pivotDepts(), viewGroup: gview, after: g7 };
    rec('PV6 Run from a snapshot view of the pivot report: the report comes back as its pivot, in its sort', on2 && ran && pivotOn() && !!st6 && CJ(st6.pivot) === CJ(st0.pivot) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS),
      'view=' + on2 + ' run=' + ran + ' pivot=' + pivotOn() + ' captured=' + !!(st6 && st6.pivot) + ' sort=' + J(scNow()) + ' rows=' + J(pivotDepts()));
    rec('PV7 ...out of group mode: none of the grouping made on the snapshot left for the next grouping (no level open, no limit, label order, Stacked)',
      ran && gview.depth === 1 && !!gview.limit && !$('body').hasClass('group-mode-active') && g7.depth === 0 && !g7.limit && !g7.agg
        && CJ(g7.sort) === CJ({ key: 'label', dir: 'asc' }) && g7.layout === 'stacked', 'view=' + J(gview) + ' after=' + J(g7));
  }

  // ?mode=nw: the report's widths, summaries and a summary formula on columns snapshot #59 lacks (AMOUNT, QTY)
  async function phaseNoColumns() {
    var b = await waitBoot();
    var st0 = H.bso(), vl0 = viewLink();
    // (10-27, viewlink sweep) a view link carries a formula summary too: its text is the report's saved formula
    rec('NW0 the report runs with its widths, AMOUNT averaged and QTY summarised by a formula: a capture writes them, a view link carries the widths and both summaries',
      b && CJ(nwOf(st0)) === CJ(REPORT_NW) && !!vl0.view && CJ(vl0.view.w) === CJ(REPORT_NW.columnWidths) && CJ(vl0.view.cs) === CJ({ AMOUNT: 'avg', QTY: 'formula' }),
      'boot=' + b + ' parts=' + CJ(nwOf(st0)) + ' link w=' + CJ(vl0.view && vl0.view.w) + ' cs=' + CJ(vl0.view && vl0.view.cs));
    var on = await loadView(window.__SNAP5, 'Snapshot without AMOUNT and QTY', 3);
    var st1 = H.bso();
    INFO.nw_during = { parts: nwOf(st1), diff: cdiff(st0, st1) };
    rec('NW1 a capture made in a view of a snapshot without AMOUNT and QTY writes their widths, summaries and formula as the report has them',
      on && CJ(nwOf(st1)) === CJ(nwOf(st0)), 'view=' + on + ' during=' + CJ(nwOf(st1)));
    rec('NW1b ...the whole capture is the one made before the view', on && cdiff(st0, st1).length === 0, 'differs=' + J(cdiff(st0, st1)));
    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    ART.save = sd;
    rec('NW2 the Server Save made in the view posts them', !!st2 && CJ(nwOf(st2)) === CJ(nwOf(st0)), 'posted=' + CJ(nwOf(st2)));
    var u3 = H.bvu(true), st3 = stateOfUrl(u3);
    ART.state = u3;
    rec('NW3 a ?state= link made in the view carries them', !!st3 && CJ(nwOf(st3)) === CJ(nwOf(st0)), 'link=' + CJ(nwOf(st3)));
    var vl1 = viewLink();
    ART.view = vl1.url || null;
    rec('NW4 a link to the view made in the view carries the widths and summaries', !!vl1.view && CJ(vl1.view.w) === CJ(vl0.view && vl0.view.w) && CJ(vl1.view.cs) === CJ(vl0.view && vl0.view.cs),
      'w=' + CJ(vl1.view && vl1.view.w) + ' cs=' + CJ(vl1.view && vl1.view.cs) + ' err=' + J(vl1.error));
  }

  // ?mode=lzg / lzp: a ?snap=55 tab of the grouped report / of the pivot report (the report's query never ran)
  async function phaseLazyView() {
    var piv = MODE === 'lzp';
    var on = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var q0 = window.__queryDone, st1 = H.bso();
    // (a pivot with its own sort: DEPT descending)
    function lzOf(st) { return st ? (piv ? CJ({ pivot: st.pivot, sort: st.sortCriteria }) : CJ(grpOf(st))) : null; }
    INFO[MODE] = piv ? { pivot: !!(st1 && st1.pivot), sort: st1 && st1.sortCriteria } : { grp: grpOf(st1) };
    var want = piv ? CJ({ pivot: window.__REPORT_PIVOT, sort: window.__REPORT_PSORT }) : CJ(REPORT_GRP), got = lzOf(st1);
    var tag = piv ? 'LP' : 'LG', what = piv ? 'pivot, with its sort' : 'grouping';
    rec(tag + '1 a capture made in a ?snap= tab of the ' + (piv ? 'pivot' : 'grouped') + ' report writes the report\'s saved ' + what,
      on && q0 === 0 && got === want, 'view=' + on + ' queries=' + q0 + ' got=' + (piv ? J({ pivot: !!(st1 && st1.pivot), sort: st1 && st1.sortCriteria }) : got));
    var u2 = H.bvu(true), st2 = stateOfUrl(u2);
    ART.state = u2;
    rec(tag + '2 a ?state= link made there carries it', lzOf(st2) === want, 'got=' + (st2 ? (piv ? J({ pivot: !!st2.pivot, sort: st2.sortCriteria }) : CJ(grpOf(st2))) : null));
    var sd = await serverSave(), st3 = null;
    try { st3 = JSON.parse(sd); } catch (e) {}
    rec(tag + '3 the Server Save made there posts it', lzOf(st3) === want, 'posted=' + !!st3);
    if (!piv) {
      // the viewer groups the frozen rows by NAME, then the grouping dialog opens no level and takes the limit off (the
      // view only): a capture still writes the saved grouping, and the way back draws the report's with its own parts
      window.Penumbra.groupByColumn('NAME');
      await waitFor(function () { return grpOn() && grpCol() === 'NAME'; }, 8000);
      await sleep(300);
      $('#groupStartDepth').val('0'); $('#groupLimitN').val(''); $('#groupLimitMinRows').val('');
      $('#confirmGroupingBtn').trigger('click');
      await sleep(1500);
      var g5 = H.grp(), st5 = H.bso();
      INFO.lzg_regroup = { grp: g5, cap: grpOf(st5) };
      rec('LG5 the frozen rows grouped by NAME, no level open and no limit (the view only): a capture still writes the report\'s saved grouping',
        grpOn() && g5.col === 'NAME' && g5.depth === 0 && !g5.limit && !!st5 && CJ(grpOf(st5)) === want, 'grp=' + J(g5) + ' captured=' + CJ(grpOf(st5)));
    }
    var back = await backToLive(true);
    if (piv) await waitFor(function () { return pivotOn() && pivotDepts().length === 3; }, 8000);
    await sleep(piv ? 1500 : 600);
    var st4 = H.bso();
    rec(tag + '4 back to live data (the query runs): the report as saved, ' + what + ' and all',
      back && (piv ? pivotOn() : grpOn()) && lzOf(st4) === want && (!piv || J(pivotDepts()) === J(PDEPTS)), 'back=' + back + ' on=' + (piv ? pivotOn() : grpOn()) + (piv ? ' rows=' + J(pivotDepts()) : ''));
  }

  // ?mode=lzw: a ?snap=59 tab (no AMOUNT, no QTY) of the report with widths, summaries and a formula on them
  async function phaseLazyWidths() {
    var on = await waitFor(function () { return H.viewing() && flatRows() === window.__SNAP5.length && hides() > 0; }, 30000);
    await sleep(800);
    var st1 = H.bso();
    INFO.lzw = nwOf(st1);
    rec('LW1 a capture made in a ?snap= tab of a snapshot without AMOUNT and QTY writes the report\'s saved widths, summaries and formula',
      on && CJ(nwOf(st1)) === CJ(REPORT_NW), 'view=' + on + ' parts=' + CJ(nwOf(st1)));
    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    rec('LW2 the Server Save made there posts them', !!st2 && CJ(nwOf(st2)) === CJ(REPORT_NW), 'posted=' + CJ(nwOf(st2)));
  }

  // ?mode=lzc: a ?snap=55 tab of a report with its own calculated column DOUBLE
  async function phaseLazyCalc() {
    var on = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    // (the link first: a Save that keeps the report's calculated columns hands them to the module, as the report's)
    var u3 = H.bvu(true), st3 = stateOfUrl(u3);
    ART.state = u3;
    rec('LC3 a ?state= link made in a ?snap= tab carries the report\'s own calculated column (its query never ran)',
      on && !!st3 && CJ(st3.calcColumns) === CJ(window.__REPORT_CALC), 'view=' + on + ' calc=' + J(st3 && st3.calcColumns));
    var sd = await serverSave(), st1 = null;
    try { st1 = JSON.parse(sd); } catch (e) {}
    ART.save = sd;
    INFO.lzc = { calc: st1 && st1.calcColumns, link: st3 && st3.calcColumns };
    rec('LC1 the Server Save made there keeps it', !!st1 && CJ(st1.calcColumns) === CJ(window.__REPORT_CALC), 'calc=' + J(st1 && st1.calcColumns));
    var back = await backToLive(true);
    var sd2 = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd2); } catch (e) {}
    rec('LC2 back to live data (the query ran): its Server Save keeps it, as it always did',
      back && !!st2 && CJ(st2.calcColumns) === CJ(window.__REPORT_CALC), 'back=' + back + ' calc=' + J(st2 && st2.calcColumns));
  }

  // ?mode=rsv: Reset all / Reset this column on a view of a report saved before its column names were kept
  // (no layoutColumnNames: its layout goes by place) - the view is snapshot #56, NOTE first
  // ?mode=rsvc: the same with the viewer's own calculated column DOUBLE on the live table (its place 6, after the
  // places the report's layout lists)
  async function phaseResetView() {
    var T = MODE === 'rsvc' ? 'RC' : 'RV';
    var b = await waitBoot();
    var hb = headLayout();
    var st0 = H.bso();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var M = window.Penumbra && window.Penumbra.headerMenu;
    var hv0 = headLayout();
    var one = M && M.resetColumn ? M.resetColumn('NAME') : null;
    await sleep(400);
    var hv1 = headLayout();
    INFO[MODE + '_column'] = { live: hb, before: hv0, after: hv1 };
    rec(T + '1 Reset this column on NAME in the view' + (T === 'RC' ? ' (the viewer\'s DOUBLE on the live table)' : '') + ': NAME goes to its place in the report\'s order by name, first',
      b && on && !('layoutColumnNames' in (H.stored() || {})) && (T !== 'RC' || hb.order.indexOf('DOUBLE') >= 0) && J(hv1.order) === J(['NAME', 'NOTE', 'ID', 'DEPT', 'QTY', 'AMOUNT']),
      'view=' + on + ' live=' + J(hb.order) + ' stored=' + J(H.stored()) + ' before=' + J(hv0) + ' after=' + J(hv1));
    var undo = M && M.resetAll ? M.resetAll() : null;
    await sleep(400);
    var hv2 = headLayout();
    INFO[MODE + '_all'] = { after: hv2 };
    rec(T + '2 Reset all in the view: the snapshot\'s columns in the report\'s own layout by name (NAME ID NOTE DEPT shown, AMOUNT QTY hidden)',
      on && J(hv2) === J(REPORT_HEAD), 'undo=' + (typeof undo) + ' after=' + J(hv2));
    var back = await backToLive(false);
    var st3 = H.bso();
    rec(T + '3 back to live data: the report in its own layout, a capture the one from before the view',
      back && J(headLayout()) === J(hb) && J(stLay(st3)) === J(stLay(st0)), 'back=' + back + ' ' + headView());
  }

  // ?mode=rsc: the custom-layout chip on a view of the same report, for a viewer with their own layout (NAME hidden)
  async function phaseChipView() {
    var b = await waitBoot();
    var M = window.Penumbra && window.Penumbra.headerMenu, l = M && M.layout ? M.layout() : null, applied = false;
    if (l && l.cols) {
      l.cols.forEach(function (c) { if (String(c.colName).toUpperCase() === 'NAME') c.visible = false; });
      applied = !!M.applyLayout(l);
    }
    await sleep(400);
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(300);
    var live = String($('#sbCustomColsDiff').text() || '');
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(300);
    var txt = String($('#sbCustomColsDiff').text() || '');
    INFO.rsc = { live: live, view: txt };
    rec('RV0 the custom-layout chip on a view of a report saved before its column names were kept reads the report\'s layout by name: QTY and AMOUNT shown only here',
      b && applied && on && /Hidden only here: NAME/.test(live) && /Shown only here: QTY, AMOUNT/.test(txt), 'live=' + J(live) + ' view=' + J(txt));
  }

  // ?mode=ovgx: the FLAT report's snapshot grouped during the view, then back to live data - the report flat, out of
  // group mode; and the rows the grouping kept for its ungroup were the SNAPSHOT's (a later Remove Grouping on the
  // live report put them under the live table)
  function rowNames() { var m = H.mrd ? H.mrd() : null; return m ? m.slice().sort() : null; }
  var LIVE_NAMES = LIVE.map(function (r) { return r.NAME; }).sort();
  async function phaseOverlayGroupSnap() {
    var b = await waitBoot();
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 15000);
    await sleep(500);
    var st1 = H.bso();
    rec('GX1 the flat report\'s snapshot grouped by DEPT during the view (the view only): a capture writes the report flat, as before the view',
      b && on && g && !!st1 && CJ(grpOf(st1)) === CJ(grpOf(st0)) && !st1.groupBy, 'view=' + on + ' grouped=' + g + ' grp=' + CJ(grpOf(st1)));
    var vl1 = viewLink();
    INFO.ovgx_link = { m: vl1.view && vl1.view.m, o: vl1.view && vl1.view.o, err: vl1.error };
    rec('GX5 ...and a link to the view made then: the report flat in its own sort (NOTE descending) - not the view\'s grouping, not unsorted',
      g && !!vl1.view && vl1.view.m === 'flat' && vl1.view.o === 'NOTE|desc', 'link=' + J(INFO.ovgx_link));
    var back = await backToLive(false);
    var st2 = H.bso(), cls = $('body').hasClass('group-mode-active');
    INFO.ovgx_back = { grouped: grpOn(), cls: cls, col: grpCol(), rows: flatRows() };
    rec('GX2 back to live data: the report flat and out of group mode, a capture writes no grouping',
      back && !grpOn() && !cls && !!st2 && !st2.groupBy && flatRows() === LIVE.length, 'back=' + back + ' grouped=' + grpOn() + ' groupMode=' + cls + ' rows=' + flatRows());
    window.Penumbra.groupByColumn('DEPT');
    var g2 = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(400);
    rec('GX3 ...then a one-click grouping of the live report by DEPT groups it', g2, 'grouped=' + grpOn() + ' col=' + grpCol());
    if (!g2) {
      // (it did not: group by NAME instead, so the ungroup below runs)
      window.Penumbra.groupByColumn('NAME');
      await waitFor(function () { return grpOn() && grpCol() === 'NAME'; }, 8000);
      await sleep(400);
    }
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    var names = rowNames();
    INFO.ovgx_rows = names;
    rec('GX4 ...and its Remove Grouping: the rows under the flat table are the live report\'s, not the snapshot\'s',
      flat && J(names) === J(LIVE_NAMES), 'flat=' + flat + ' rows=' + J(names));
  }

  // ?mode=ovgl: the same, then a live action from the view (a group preset / pivot: _exitSnapshotForLiveAction) - the
  // snapshot's groups must not stay on screen as the live report's, nor its rows under the live table
  function grpHas(t) { var c = document.getElementById('groupedResultsContainer'); return !!c && $(c).is(':visible') && c.textContent.indexOf(t) >= 0; }
  async function phaseOverlayGroupLive() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT' && grpHas('Golf'); }, 15000);
    await sleep(500);
    H.exitLive();
    await sleep(300);
    var snapGroups = grpHas('Golf'), names = rowNames(), cls = $('body').hasClass('group-mode-active');
    INFO.ovgl_exit = { snapGroups: snapGroups, groupMode: cls, rows: names, flat: flatRows() };
    rec('GL1 a live action from a view whose snapshot was grouped: the snapshot\'s groups leave the screen, the page holds the live rows, out of group mode',
      b && on && g && !snapGroups && !cls && J(names) === J(LIVE_NAMES), 'view=' + on + ' grouped=' + g + ' snapGroups=' + snapGroups + ' groupMode=' + cls + ' rows=' + J(names));
    window.Penumbra.groupByColumn('DEPT');
    var g2 = await waitFor(function () { return grpOn() && grpCol() === 'DEPT' && grpHas('Echo'); }, 8000);
    await sleep(400);
    rec('GL2 ...then grouped by DEPT (the action): the live report\'s rows grouped, none of the snapshot\'s',
      g2 && !grpHas('Golf'), 'grouped=' + g2 + ' live=' + grpHas('Echo') + ' snap=' + grpHas('Golf'));
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    var names2 = rowNames();
    rec('GL3 ...and its Remove Grouping: the live report\'s rows under the flat table', flat && J(names2) === J(LIVE_NAMES), 'flat=' + flat + ' rows=' + J(names2));
  }

  // (review) the ways back past a comparison opened on the view, a second snapshot loaded over it, a table opened from
  // the console: group mode set from what comes back, never the view's
  function cmpOn() { return document.body.classList.contains('snapshot-comparison-active'); }
  async function openAbOnView() {
    var h0 = hides();
    H.runAb(snapObj(SNAP, 'Snapshot A', 5, 56), snapObj(LIVE, 'Snapshot B', 1, 57), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && !!document.getElementById('snapshotComparisonContainer') && hides() > h0; }, 30000);
    await sleep(400);
    return ok;
  }
  async function clearCmp() {
    var h0 = hides();
    document.getElementById('removeGroupingLink').click();
    var ok = await waitFor(function () { return !cmpOn() && hides() > h0 && !document.getElementById('snapshotComparisonContainer'); }, 15000);
    await sleep(800);
    return ok;
  }
  // a grouping of the live report by NAME (one click) and its Remove Grouping: the rows the flat table then holds
  async function ungroupRows() {
    window.Penumbra.groupByColumn('NAME');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'NAME'; }, 8000);
    await sleep(300);
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    return { grouped: g, flat: flat, rows: rowNames() };
  }
  // ?mode=cmpv: the flat report's snapshot grouped by DEPT in the view, an A-vs-B comparison on it, a link, its Clear
  async function phaseCmpOnView() {
    var b = await waitBoot();
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 15000);
    await sleep(400);
    var ab = await openAbOnView();
    var vl = viewLink(), stk = H.stack ? H.stack() : null;
    INFO.cmpv_link = { m: vl.view && vl.view.m, go: vl.view && vl.view.go, ga: vl.view && vl.view.ga, stack: stk, err: vl.error };
    rec('CV1 a link to the view made during an A-vs-B comparison opened on a view is the comparison\'s, with the comparison\'s open groups',
      b && on && g && ab && !!vl.view && vl.view.m === 'keep' && !!stk && CJ({ go: vl.view.go, ga: vl.view.ga }) === CJ({ go: stk.go, ga: stk.ga }),
      'view=' + on + ' grouped=' + g + ' ab=' + ab + ' link=' + J(INFO.cmpv_link));
    var cl = await clearCmp();
    var st2 = H.bso(), cls = $('body').hasClass('group-mode-active');
    INFO.cmpv_clear = { viewing: H.viewing(), grouped: grpOn(), col: grpCol(), cls: cls, grp: grpOf(st2) };
    rec('CV2 the comparison\'s Clear: the live report flat as it was (not grouped by the view\'s DEPT), out of group mode, a capture writes no grouping',
      ab && cl && !H.viewing() && !grpOn() && !cls && !!st2 && !st2.groupBy && J(stLay(st2)) === J(stLay(st0)), 'clear=' + J(INFO.cmpv_clear));
    var u = await ungroupRows();
    rec('CV3 ...then a grouping of the live report and its Remove Grouping: the live rows under the flat table, not the snapshot\'s',
      cl && u.grouped && u.flat && J(u.rows) === J(LIVE_NAMES), J(u));
  }
  // ?mode=cmpvb: the same, then back to live data during the comparison (the caution icon)
  async function phaseCmpOnViewBack() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 15000);
    await sleep(400);
    var ab = await openAbOnView();
    var back = await backToLive(false);
    var cls = $('body').hasClass('group-mode-active'), st = H.bso();
    INFO.cmpvb = { cmp: cmpOn(), grouped: grpOn(), cls: cls, col: grpCol(), rows: flatRows() };
    rec('CB1 back to live data from an A-vs-B comparison opened on a view whose snapshot was grouped: the report flat, out of group mode',
      b && on && g && ab && back && !cmpOn() && !grpOn() && !cls && !!st && !st.groupBy, 'back=' + J(INFO.cmpvb));
    var u = await ungroupRows();
    rec('CB2 ...then a grouping and its Remove Grouping: the live rows under the flat table', back && u.grouped && u.flat && J(u.rows) === J(LIVE_NAMES), J(u));
  }
  // ?mode=ovg2: the flat report's snapshot grouped in the view, a second snapshot loaded over it, back to live data
  async function phaseSecondView() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 15000);
    await sleep(400);
    var on2 = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var back = await backToLive(false);
    var cls = $('body').hasClass('group-mode-active'), st = H.bso();
    INFO.ovg2 = { grouped: grpOn(), cls: cls, col: grpCol() };
    rec('GS1 back to live data from a second snapshot loaded over a view whose snapshot was grouped: the report flat, out of group mode',
      b && on && g && on2 && back && !grpOn() && !cls && !!st && !st.groupBy, 'back=' + back + ' ' + J(INFO.ovg2));
    var u = await ungroupRows();
    rec('GS2 ...then a grouping and its Remove Grouping: the live rows under the flat table', back && u.grouped && u.flat && J(u.rows) === J(LIVE_NAMES), J(u));
  }
  // ?mode=cmpvg: the GROUPED report's snapshot regrouped by NAME in the view, an A-vs-B comparison on it, its Clear
  async function phaseCmpOnGroupedView() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('NAME');
    var gn = await waitFor(function () { return grpOn() && grpCol() === 'NAME'; }, 15000);
    await sleep(400);
    // ...through the dialog: no level open, no limit (the view only)
    $('#groupStartDepth').val('0'); $('#groupLimitN').val(''); $('#groupLimitMinRows').val('');
    $('#confirmGroupingBtn').trigger('click');
    await sleep(1200);
    var gview = H.grp();
    var ab = await openAbOnView();
    var cl = await clearCmp();
    await waitFor(function () { return grpOn(); }, 8000);
    await sleep(600);
    var st = H.bso();
    INFO.cmpvg = { view: gview, grouped: grpOn(), col: grpCol(), grp: grpOf(st) };
    rec('CG1 the Clear of an A-vs-B comparison opened on a view of the grouped report (its snapshot regrouped by NAME, no level open, no limit): grouped by DEPT again, as the report was - start depth and limit too',
      b && g0 && on && gn && gview.depth === 0 && !gview.limit && ab && cl && !H.viewing() && grpOn() && grpCol() === 'DEPT' && !!st && CJ(grpOf(st)) === CJ(grpOf(st0)),
      J(INFO.cmpvg) + ' before=' + CJ(grpOf(st0)));
  }

  // ?mode=gvr2: the report grouped by DEPT through a one-click grouping (its ungroup keeps the live rows), a view over
  // it, the snapshot grouped by DEPT (the report's own column), then by NAME, then Remove Grouping in the view
  async function phaseViewOverDialogGrouping() {
    var b = await waitBoot();
    window.Penumbra.groupByColumn('DEPT');
    var g0 = await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var gd = await waitFor(function () { return grpOn() && grpCol() === 'DEPT' && grpHas('Golf'); }, 8000);
    await sleep(300);
    rec('GR1 a view over the report grouped by DEPT: a one-click grouping of the snapshot by DEPT groups the snapshot',
      b && g0 && on && gd, 'grouped=' + gd + ' col=' + grpCol() + ' snapRows=' + grpHas('Golf'));
    window.Penumbra.groupByColumn('NAME');
    var gn = await waitFor(function () { return grpOn() && grpCol() === 'NAME' && grpHas('Golf'); }, 8000);
    await sleep(300);
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === SNAP.length; }, 15000);
    await sleep(500);
    var names = rowNames(), SNAP_NAMES = SNAP.map(function (r) { return r.NAME; }).sort();
    INFO.gvr2_view = { viewing: H.viewing(), rows: names, table: flatRows() };
    rec('GR2 ...its Remove Grouping in the view: the snapshot\'s rows under the view\'s table, not the live report\'s',
      gn && flat && H.viewing() && J(names) === J(SNAP_NAMES), J(INFO.gvr2_view));
    var back = await backToLive(false);
    var st3 = H.bso();
    rec('GR3 back to live data: grouped by DEPT as the report was, a capture writes it', back && grpOn() && grpCol() === 'DEPT' && CJ(grpOf(st3)) === CJ(grpOf(st0)),
      'back=' + back + ' col=' + grpCol() + ' grp=' + CJ(grpOf(st3)));
    $('#removeGroupingLink').trigger('click');
    var flat2 = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    var names2 = rowNames();
    rec('GR4 ...and its Remove Grouping: the live rows under the flat table', flat2 && J(names2) === J(LIVE_NAMES), 'flat=' + flat2 + ' rows=' + J(names2));
  }
  // ?mode=gvc: a table opened from the console during a view of the grouped report (a "clear all" run); ?mode=lzgc: in a
  // ?snap= tab of it - the new table comes up flat, none of the report's views armed on it
  async function phaseConsoleTable() {
    var lazy = MODE === 'lzgc', b = true;
    var on;
    if (lazy) { on = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && hides() > 0; }, 30000); await sleep(800); }
    else { b = await waitBoot(); await waitFor(grpOn, 15000); await sleep(400); on = await loadView(SNAP, 'Viewed snapshot', 2); }
    var q0 = window.__queryDone, h0 = hides();
    H.clearAll('SNAPCAP_FIXTURE', 'SELECT * FROM SNAPCAP_FIXTURE');
    var ran = await waitFor(function () { return window.__queryDone > q0 && hides() > h0 && !H.viewing(); }, 20000);
    await sleep(1200);
    var st = H.bso();
    INFO[MODE] = { grouped: grpOn(), pivot: pivotOn(), col: grpCol(), rows: flatRows(), grp: grpOf(st) };
    rec((lazy ? 'GC3' : 'GC1') + ' a table opened from the console ' + (lazy ? 'in a ?snap= tab' : 'during a view') + ' of the grouped report comes up flat: none of the report\'s grouping armed on it',
      b && on && ran && !grpOn() && !pivotOn() && flatRows() === LIVE.length && !!st && !st.groupBy, 'view=' + on + ' ran=' + ran + ' ' + J(INFO[MODE]));
  }
  // ?mode=gvce: that table's run comes back EMPTY (nothing kept for the next view), then a view over it: a capture writes
  // none of the report's views - the page has left the report it loaded
  async function phaseConsoleEmpty() {
    var b = await waitBoot();
    await waitFor(grpOn, 15000);
    await sleep(400);
    window.__EMPTY_NEXT = true;
    var q0 = window.__queryDone, h0 = hides();
    H.clearAll('SNAPCAP_FIXTURE', 'SELECT * FROM SNAPCAP_FIXTURE');
    var ran = await waitFor(function () { return window.__queryDone > q0 && hides() > h0; }, 20000);
    await sleep(800);
    window.__EMPTY_NEXT = false;
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var stash = H.stash(), st = H.bso();
    INFO.gvce = { stash: stash, grp: grpOf(st), pivot: !!(st && st.pivot) };
    rec('GC2 a view over a table opened from the console (its run came back empty: nothing kept) writes none of the report\'s grouping',
      b && ran && on && stash === null && !!st && !st.groupBy && !st.pivot, 'ran=' + ran + ' view=' + on + ' ' + J(INFO.gvce));
  }

  // ============================ snapback (2026-10-24): the ways back snapgrp left ===================================
  // 1. the load's failure path (a second, broken snapshot loaded while a view is on screen) rebuilt the live table flat:
  //    a grouped or pivot report did not get its view back, and a grouping made on the first snapshot (or a comparison
  //    opened on it) stayed on screen over the live rows, group mode and the SNAPSHOT's rows with it;
  // 2. an A-vs-B comparison opened on a view of the PIVOT report, then its Clear: flat (the Clear regroups only);
  // 3. Compare to Live Data from a view, and Load As View over a comparison, kept no grouping or pivot for what came
  //    next: a Save made then, the comparison's Clear, a Run, back to live data - all flat.
  function brokenSnap() {
    return { name: 'Broken snapshot', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
             columnNames: ['ID'], compressedData: H.compress(JSON.stringify([{ rowData: 5 }])) };
  }
  // a snapshot whose rows are not rows: the load throws after the view's stash exists; its failure path goes back
  async function loadBroken() {
    var h0 = hides();
    H.loadSnap(brokenSnap());
    var back = await waitFor(function () { return !H.viewing() && hides() > h0; }, 20000);
    await sleep(1000);
    return back;
  }
  // the pivot as a capture writes it, without the fields a pivot drawn by the builder adds (aggShade, aggFormat...)
  function pvCore(p) { return p ? CJ({ rows: p.rows, cols: p.cols, vals: p.vals, agg: p.agg, rowLayout: p.rowLayout }) : null; }
  function pivotBack() { return pivotOn() && pivotDepts().length === 3; }
  // the snapshot header's Compare to Live Data: the report's query runs, the comparison overlays it
  async function compareToLive() {
    var q0 = window.__queryDone;
    var btn = document.getElementById('pnbSnapHdrCompare');
    if (!btn) return false;
    $(btn).trigger('click');
    var ok = await waitFor(function () { return window.__queryDone > q0 && cmpOn() && !!document.getElementById('snapshotComparisonContainer') && !H.viewing(); }, 30000);
    await sleep(800);
    return ok;
  }
  // a comparison of snapshot #55 with the live report (the manager's Compare To Live), no view
  async function openCmpLive() {
    var h0 = hides();
    H.runCmp(snapObj(SNAP, 'Compared snapshot', 3, 55), null);
    var ok = await waitFor(function () { return cmpOn() && !!document.getElementById('snapshotComparisonContainer') && hides() > h0; }, 30000);
    await sleep(500);
    return ok;
  }

  // ?mode=gvf: a snapshot failing to load during a view of the grouped report
  async function phaseGroupedFail() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var back = await loadBroken();
    var st1 = H.bso(), cls = $('body').hasClass('group-mode-active');
    INFO.gvf = { back: back, grouped: grpOn(), col: grpCol(), cls: cls, grp: grpOf(st1), head: headLayout() };
    rec('GF1 a snapshot failing to load during a view of the grouped report: the report comes back grouped by DEPT as it was (summed AMOUNT, largest first, the top 2, one level open), in group mode, in its own column layout; a capture writes it',
      b && g0 && on && back && grpOn() && grpCol() === 'DEPT' && cls && CJ(grpOf(st1)) === CJ(grpOf(st0)) && headIsReport(), J(INFO.gvf) + ' before=' + CJ(grpOf(st0)));
    var wasGrouped = grpOn();
    $('#removeGroupingLink').trigger('click');
    var flat = await waitFor(function () { return !grpOn() && flatRows() === LIVE.length; }, 15000);
    await sleep(500);
    var names = rowNames();
    rec('GF2 ...and its Remove Grouping: the live rows under the flat table', back && wasGrouped && flat && J(names) === J(LIVE_NAMES), 'grouped=' + wasGrouped + ' flat=' + flat + ' rows=' + J(names));
  }
  // ?mode=gvfg: the same, the snapshot regrouped by NAME during the view first
  async function phaseGroupedFailRegrouped() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('NAME');
    var gn = await waitFor(function () { return grpOn() && grpCol() === 'NAME' && grpHas('Golf'); }, 15000);
    await sleep(400);
    var back = await loadBroken();
    var st1 = H.bso();
    INFO.gvfg = { grouped: grpOn(), col: grpCol(), snapGroups: grpHas('Golf'), grp: grpOf(st1) };
    rec('GF3 the snapshot regrouped by NAME during a view of the grouped report, then a snapshot failing to load: the snapshot\'s groups leave the screen, the report grouped by DEPT as it was',
      b && g0 && on && gn && back && grpOn() && grpCol() === 'DEPT' && !grpHas('Golf') && CJ(grpOf(st1)) === CJ(grpOf(st0)), J(INFO.gvfg));
  }
  // ?mode=pvf: a snapshot failing to load during a view of the pivot report
  async function phasePivotFail() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotOn, 15000);
    await sleep(1200);
    var st0 = H.bso();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var back = await loadBroken();
    await waitFor(pivotBack, 5000);
    await sleep(800);
    var st1 = H.bso();
    INFO.pvf = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pvCore(st1 && st1.pivot) };
    rec('PF1 a snapshot failing to load during a view of the pivot report: the pivot comes back in its sort (DEPT descending), a capture writes both',
      b && p0 && on && back && pivotOn() && !!st1 && pvCore(st1.pivot) === pvCore(st0.pivot) && CJ(st1.sortCriteria) === CJ(st0.sortCriteria) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS),
      J(INFO.pvf));
  }
  // ?mode=ovgf: the FLAT report's snapshot grouped by DEPT during the view, then a snapshot failing to load
  async function phaseFlatFailGrouped() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(function () { return grpOn() && grpCol() === 'DEPT' && grpHas('Golf'); }, 15000);
    await sleep(400);
    var back = await loadBroken();
    var cls = $('body').hasClass('group-mode-active'), st = H.bso();
    INFO.ovgf = { grouped: grpOn(), snapGroups: grpHas('Golf'), cls: cls, rows: flatRows() };
    rec('GF4 the flat report\'s snapshot grouped by DEPT during the view, then a snapshot failing to load: the report flat, out of group mode, none of the snapshot\'s groups on screen',
      b && on && g && back && !grpOn() && !cls && flatRows() === LIVE.length && !!st && !st.groupBy, J(INFO.ovgf));
    var u = await ungroupRows();
    rec('GF5 ...then a grouping of the live report and its Remove Grouping: the live rows under the flat table', back && u.grouped && u.flat && J(u.rows) === J(LIVE_NAMES), J(u));
  }
  // ?mode=cmpvf: an A-vs-B comparison opened on a view of the grouped report, then a snapshot failing to load
  async function phaseCmpFail() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var ab = await openAbOnView();
    var back = await loadBroken();
    var st1 = H.bso();
    INFO.cmpvf = { cmp: cmpOn(), box: !!document.getElementById('snapshotComparisonContainer'), grouped: grpOn(), col: grpCol(), grp: grpOf(st1), label: $('#removeGroupingLink').text() };
    rec('GF6 an A-vs-B comparison opened on a view of the grouped report, then a snapshot failing to load: the comparison goes with the view, the report grouped by DEPT as it was',
      b && g0 && on && ab && back && !cmpOn() && !INFO.cmpvf.box && grpOn() && grpCol() === 'DEPT' && CJ(grpOf(st1)) === CJ(grpOf(st0)) && /^Remove Grouping$/.test(INFO.cmpvf.label), J(INFO.cmpvf));
  }
  // ?mode=cmpvp: an A-vs-B comparison opened on a view of the PIVOT report, then its Clear
  async function phaseCmpPivotClear() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotOn, 15000);
    await sleep(1200);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var ab = await openAbOnView();
    var st1 = H.bso();
    rec('CP0 an A-vs-B comparison opened on a view of the pivot report: a capture made during it writes the report\'s own pivot, with its sort',
      b && p0 && on && ab && !!st1 && pvCore(st1.pivot) === pvCore(st0.pivot) && CJ(st1.sortCriteria) === CJ(st0.sortCriteria), 'pivot=' + pvCore(st1 && st1.pivot) + ' sort=' + J(st1 && st1.sortCriteria));
    var cl = await clearCmp();
    var p1 = await waitFor(pivotBack, 10000);
    await sleep(1500);
    var st2 = H.bso();
    INFO.cmpvp = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pvCore(st2 && st2.pivot), grouped: grpOn() };
    rec('CP1 ...its Clear: the report\'s pivot comes back, in its sort (DEPT descending); a capture writes both',
      ab && cl && p1 && !H.viewing() && !!st2 && pvCore(st2.pivot) === pvCore(st0.pivot) && CJ(st2.sortCriteria) === CJ(st0.sortCriteria) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS),
      J(INFO.cmpvp));
  }
  // ?mode=clv / clvp: Compare to Live Data from a view of the grouped / pivot report: a Save made during the comparison,
  // its Clear
  async function phaseCmpLive() {
    var piv = MODE === 'clvp';
    var b = await waitBoot();
    var v0 = await waitFor(piv ? pivotOn : grpOn, 15000);
    await sleep(piv ? 1200 : 400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var cmp = await compareToLive();
    var st1 = H.bso();
    function viewOf(st) { return st ? (piv ? J({ p: pvCore(st.pivot), s: st.sortCriteria }) : CJ(grpOf(st))) : null; }
    INFO[MODE + '_during'] = viewOf(st1);
    var t = piv ? ['CL4', 'CL5'] : ['CL1', 'CL3'], what = piv ? 'pivot, with its sort' : 'grouping (start depth and limit too)';
    rec(t[0] + ' Compare to Live Data from a view of the ' + (piv ? 'pivot' : 'grouped') + ' report: a capture made during the comparison writes the report\'s own ' + what,
      b && v0 && on && cmp && viewOf(st1) === viewOf(st0), 'cmp=' + cmp + ' got=' + viewOf(st1) + ' want=' + viewOf(st0));
    if (!piv) {
      var sd = await serverSave(), st2 = null;
      try { st2 = JSON.parse(sd); } catch (e) {}
      rec('CL2 ...the Server Save made then posts it', cmp && !!st2 && CJ(grpOf(st2)) === CJ(grpOf(st0)), 'posted=' + CJ(grpOf(st2)));
    }
    var cl = await clearCmp();
    if (piv) await waitFor(pivotBack, 10000); else await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(piv ? 1500 : 600);
    var st3 = H.bso();
    INFO[MODE + '_clear'] = piv ? { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: viewOf(st3) } : { grouped: grpOn(), col: grpCol(), grp: grpOf(st3) };
    rec(t[1] + ' ...and the comparison\'s Clear: the report ' + (piv ? 'as its pivot, in its sort' : 'grouped by DEPT as it was') + ', a capture writes it',
      cmp && cl && (piv ? (pivotOn() && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS)) : (grpOn() && grpCol() === 'DEPT')) && viewOf(st3) === viewOf(st0),
      J(INFO[MODE + '_clear']));
  }
  // ?mode=clvr / clvgr: Compare to Live Data from a view of the pivot / grouped report, then Run during the comparison
  async function phaseCmpLiveRun() {
    var piv = MODE === 'clvr';
    var b = await waitBoot();
    var v0 = await waitFor(piv ? pivotOn : grpOn, 15000);
    await sleep(piv ? 1200 : 400);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var cmp = await compareToLive();
    var ran = await runQuery();
    if (piv) await waitFor(pivotBack, 10000);
    await sleep(piv ? 1500 : 600);
    var st1 = H.bso();
    INFO[MODE] = piv ? { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), cmp: cmpOn() } : { grouped: grpOn(), col: grpCol(), grp: grpOf(st1), cmp: cmpOn() };
    rec((piv ? 'CL6' : 'CL7') + ' Compare to Live Data from a view of the ' + (piv ? 'pivot' : 'grouped') + ' report, then Run during the comparison: the report comes back ' + (piv ? 'as its pivot, in its sort' : 'grouped as it was'),
      b && v0 && on && cmp && ran && !cmpOn() && (piv ? (pivotOn() && !!st1 && pvCore(st1.pivot) === pvCore(st0.pivot) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS))
                                                  : (grpOn() && grpCol() === 'DEPT' && CJ(grpOf(st1)) === CJ(grpOf(st0)))),
      'cmp=' + cmp + ' run=' + ran + ' ' + J(INFO[MODE]));
  }
  // ?mode=lzcl / lzclp: Compare to Live Data from a ?snap=55 tab of the grouped / pivot report (its query never ran)
  async function phaseLazyCmpLive() {
    var piv = MODE === 'lzclp';
    var on = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var want = piv ? J({ p: pvCore(window.__REPORT_PIVOT), s: window.__REPORT_PSORT }) : CJ(REPORT_GRP);
    function viewOf(st) { return st ? (piv ? J({ p: pvCore(st.pivot), s: st.sortCriteria }) : CJ(grpOf(st))) : null; }
    var cmp = await compareToLive();
    var st1 = H.bso();
    var cl = await clearCmp();
    if (piv) await waitFor(pivotBack, 10000); else await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(piv ? 1500 : 600);
    var st2 = H.bso();
    INFO[MODE] = { during: viewOf(st1), after: viewOf(st2), on: piv ? pivotOn() : grpOn(), sort: piv ? scNow() : null };
    rec((piv ? 'CL9' : 'CL8') + ' Compare to Live Data from a ?snap= tab of the ' + (piv ? 'pivot' : 'grouped') + ' report: a capture during the comparison writes the report\'s saved ' + (piv ? 'pivot and its sort' : 'grouping') + ', and its Clear gives it back',
      on && cmp && cl && viewOf(st1) === want && viewOf(st2) === want && (piv ? (pivotOn() && J(scNow()) === J(PSORT)) : (grpOn() && grpCol() === 'DEPT')),
      'cmp=' + cmp + ' ' + J(INFO[MODE]) + ' want=' + want);
  }
  // ?mode=lvc / lvcr: a snapshot loaded as a view over a comparison of the grouped report: a capture in it, back to live
  // data (lvc) / Run (lvcr)
  async function phaseViewOverCmp() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var cmp = await openCmpLive();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var st1 = H.bso();
    if (MODE === 'lvc') {
      rec('LV1 a snapshot loaded as a view over a comparison of the grouped report: a capture made in it writes the report\'s own grouping (the one the comparison\'s Clear gives back)',
        b && g0 && cmp && on && CJ(grpOf(st1)) === CJ(grpOf(st0)), 'cmp=' + cmp + ' view=' + on + ' got=' + CJ(grpOf(st1)) + ' want=' + CJ(grpOf(st0)));
    }
    var back = MODE === 'lvcr' ? await runQuery() : await backToLive(false);
    await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(600);
    var st2 = H.bso(), cls = $('body').hasClass('group-mode-active');
    INFO[MODE] = { grouped: grpOn(), col: grpCol(), cls: cls, grp: grpOf(st2), cmp: cmpOn() };
    rec((MODE === 'lvcr' ? 'LV3 ...then Run from that view' : 'LV2 ...then back to live data') + ': grouped by DEPT as the report was (start depth and limit too), in group mode',
      b && g0 && cmp && on && back && !cmpOn() && grpOn() && grpCol() === 'DEPT' && cls && CJ(grpOf(st2)) === CJ(grpOf(st0)), J(INFO[MODE]));
  }
  // (review) ?mode=gvfs: the grouped report searched for "East" (its groups drawn under it), a view, the box cleared in
  // the view, then a snapshot failing to load: the groups come back with the search they were drawn under
  function grpVisibleNames() {
    return $('#groupedResultsContainer tbody tr:visible').map(function () { return $(this).find('td[data-column="2"]').text().trim(); }).get()
      .filter(function (n) { return !!n; }).sort();
  }
  async function phaseGroupedFailSearch() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    $('#tableSearch').val('East');
    await H.search();
    await sleep(800);
    var vis0 = grpVisibleNames();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    $('#tableSearch').val('');
    var back = await loadBroken();
    await sleep(600);
    var vis1 = grpVisibleNames(), box = $('#tableSearch').val();
    INFO.gvfs = { before: vis0, after: vis1, box: box, grouped: grpOn(), col: grpCol() };
    rec('GF7 the grouped report searched for "East", a view, the search cleared in it, then a snapshot failing to load: the groups come back under the search they were drawn with, "East" in the box',
      b && g0 && on && back && vis0.length > 0 && vis0.length < LIVE.length && grpOn() && grpCol() === 'DEPT' && box === 'East' && J(vis1) === J(vis0), J(INFO.gvfs));
  }
  // (review) ?mode=lvcf: a view loaded over a comparison of the grouped report (its grouping kept undrawn), then a
  // snapshot failing to load: grouped as the report was, drawn again last
  async function phaseViewOverCmpFail() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    var st0 = H.bso();
    var cmp = await openCmpLive();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var back = await loadBroken();
    await waitFor(function () { return grpOn() && grpCol() === 'DEPT'; }, 8000);
    await sleep(600);
    var st1 = H.bso(), cls = $('body').hasClass('group-mode-active');
    INFO.lvcf = { grouped: grpOn(), col: grpCol(), cls: cls, grp: grpOf(st1), cmp: cmpOn() };
    rec('LV6 a view loaded over a comparison of the grouped report, then a snapshot failing to load: grouped by DEPT as the report was (start depth and limit too), in group mode',
      b && g0 && cmp && on && back && !cmpOn() && grpOn() && grpCol() === 'DEPT' && cls && CJ(grpOf(st1)) === CJ(grpOf(st0)), J(INFO.lvcf));
  }
  // (review) ?mode=lzclx: a ?snap=55 tab of a report saved as a pivot by REGION, a column its query no longer has:
  // Compare to Live Data, its Clear - the report flat, with the notice naming the column (not a pivot of blank rows)
  async function phaseLazyCmpLiveGone() {
    var on = await waitFor(function () { return H.viewing() && flatRows() === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var cmp = await compareToLive();
    $('#action_overlay, #undo_text_container').empty();
    var cl = await clearCmp();
    await sleep(1200);
    var said = String($('#action_overlay').text() + ' ' + $('#undo_text_container').text()).replace(/\s+/g, ' ').trim();
    INFO.lzclx = { pivot: pivotOn(), rows: flatRows(), said: said.slice(0, 300) };
    rec('CL10 Compare to Live Data from a ?snap= tab of a report saved as a pivot by a column its query no longer has, then the Clear: the report flat, with the notice naming the column',
      on && cmp && cl && !pivotOn() && flatRows() === LIVE.length && /no longer in the query: REGION/.test(said), J(INFO.lzclx));
  }

  // ?mode=lvcp: the pivot report: a view, Compare to Live Data, then a snapshot loaded as a view over that comparison
  async function phaseViewOverCmpPivot() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotOn, 15000);
    await sleep(1200);
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var cmp = await compareToLive();
    var on2 = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var st1 = H.bso();
    rec('LV4 the pivot report: a view, Compare to Live Data, then a snapshot loaded as a view over that comparison: a capture made in it writes the report\'s own pivot, with its sort',
      b && p0 && on && cmp && on2 && !!st1 && pvCore(st1.pivot) === pvCore(st0.pivot) && CJ(st1.sortCriteria) === CJ(st0.sortCriteria), 'pivot=' + pvCore(st1 && st1.pivot) + ' sort=' + J(st1 && st1.sortCriteria));
    var back = await backToLive(false);
    var p1 = await waitFor(pivotBack, 10000);
    await sleep(1500);
    var st2 = H.bso();
    INFO.lvcp = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pvCore(st2 && st2.pivot) };
    rec('LV5 ...then back to live data: the report\'s pivot, in its sort', on2 && back && p1 && !!st2 && pvCore(st2.pivot) === pvCore(st0.pivot) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS), J(INFO.lvcp));
  }

  // ============================ cmppiv (2026-10-24): the three edges snapback left ==================================
  // 1. (the user's call) a comparison opened over the report's LIVE pivot keeps the pivot for its end: its Clear draws it
  //    again in its sort, a Save made during it writes it, a Run during it draws it again, a view loaded over it keeps it;
  //    one that never took the page (it aborted) puts the pivot back - it left the page blank;
  // 2. a pivot drawn again through the builder under a search: from all the rows, then that search in pivot mode (one
  //    matching no live row made the builder refuse, and the report stayed flat, nothing said);
  // 3. Compare to Live Data from a view whose comparison does not render: the report's view it kept, drawn again.
  // a snapshot sharing no column with the report (nor with the other snapshots): a comparison with it aborts
  var SNAP6 = [{ CODE: 'k1', LABEL: 'One' }, { CODE: 'k2', LABEL: 'Two' }];
  function said() { return String($('#action_overlay').text() + ' ' + $('#undo_text_container').text()).replace(/\s+/g, ' ').trim(); }
  function clearSaid() { $('#action_overlay, #undo_text_container').empty(); }
  async function bootPivot() {
    var b = await waitBoot();
    var p0 = await waitFor(pivotBack, 15000);
    await sleep(1200);
    return b && p0;
  }
  // the pivot a capture writes (its core) with its sort
  function pivotState(st) { return st ? J({ p: pvCore(st.pivot), s: st.sortCriteria }) : null; }
  function pivotInSort() { return pivotOn() && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS); }
  async function waitPivotBack() { var ok = await waitFor(pivotBack, 10000); await sleep(1500); return ok; }

  // ?mode=lpc: a comparison of snapshot #55 with the report's live pivot (a preset's, as the status bar leaves one): a
  // capture and the Server Save during it, its Clear
  async function phaseLivePivotCmp() {
    var b = await bootPivot();
    var st0 = H.bso();
    H.mountChip();
    var chipOk = H.setChip('Dept view', 'shared');
    window._pivotUserPresetActive = 'Dept view';
    var cmp = await openCmpLive();
    var st1 = H.bso();
    INFO.lpc_during = pivotState(st1);
    rec('LP1 a comparison opened over the report\'s live pivot: a capture made during it writes the report\'s pivot, with its sort',
      b && cmp && pivotState(st1) === pivotState(st0), 'cmp=' + cmp + ' got=' + pivotState(st1) + ' want=' + pivotState(st0));
    var sd = await serverSave(), st2 = null;
    try { st2 = JSON.parse(sd); } catch (e) {}
    rec('LP2 ...the Server Save made then posts it', cmp && pivotState(st2) === pivotState(st0), 'posted=' + pivotState(st2));
    var cl = await clearCmp();
    var p1 = await waitPivotBack();
    var st3 = H.bso();
    INFO.lpc_clear = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st3), preset: window._pivotUserPresetActive };
    rec('LP3 ...its Clear: the report\'s pivot comes back, in its sort (DEPT descending); a capture writes both',
      cmp && cl && p1 && pivotInSort() && pivotState(st3) === pivotState(st0), J(INFO.lpc_clear));
    rec('LP3b ...named as the shared preset it was (the status bar, the builder' + "'" + 's chip)', p1 && chipOk && pivotOn() && window._pivotUserPresetActive === 'Dept view' && J(H.chip()) === J({ name: 'Dept view', src: 'shared' }),
      'chip=' + chipOk + ' preset=' + J(window._pivotUserPresetActive) + ' builder=' + J(H.chip()));
  }
  // ?mode=lpab: an A-vs-B comparison opened over the report's live pivot, its Clear
  async function phaseLivePivotAb() {
    var b = await bootPivot();
    var st0 = H.bso();
    H.mountChip();
    var chipOk = H.setChip('Dept view', 'local');
    window._pivotUserPresetActive = null;
    var ab = await openAbOnView();
    var cl = await clearCmp();
    var p1 = await waitPivotBack();
    var st1 = H.bso();
    INFO.lpab = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st1) };
    rec('LP4 an A-vs-B comparison opened over the report\'s live pivot, then its Clear: the pivot comes back, in its sort; a capture writes both',
      b && ab && cl && p1 && pivotInSort() && pivotState(st1) === pivotState(st0), J(INFO.lpab));
    rec('LP4b ...the preset the builder' + "'" + 's chip named (none in the status bar) named there again', p1 && chipOk && pivotOn() && window._pivotUserPresetActive == null && J(H.chip()) === J({ name: 'Dept view', src: 'local' }),
      'chip=' + chipOk + ' preset=' + J(window._pivotUserPresetActive) + ' builder=' + J(H.chip()));
  }
  // ?mode=lpr: a comparison over the report's live pivot, then Run during it
  async function phaseLivePivotRun() {
    var b = await bootPivot();
    var st0 = H.bso();
    var cmp = await openCmpLive();
    var ran = await runQuery();
    var p1 = await waitPivotBack();
    var st1 = H.bso();
    INFO.lpr = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st1), cmp: cmpOn() };
    rec('LP5 a comparison over the report\'s live pivot, then Run during it: the report comes back as its pivot, in its sort',
      b && cmp && ran && p1 && !cmpOn() && pivotInSort() && pivotState(st1) === pivotState(st0), J(INFO.lpr));
  }
  // ?mode=lplv: a comparison over the report's live pivot, a snapshot loaded as a view over it, back to live data
  async function phaseLivePivotView() {
    var b = await bootPivot();
    var st0 = H.bso();
    H.mountChip();
    var chipOk = H.setChip('Dept view', 'shared');
    window._pivotUserPresetActive = 'Dept view';
    var cmp = await openCmpLive();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var st1 = H.bso();
    rec('LP6 a comparison over the report\'s live pivot, then a snapshot loaded as a view over it: a capture made in the view writes the report\'s pivot, with its sort',
      b && cmp && on && pivotState(st1) === pivotState(st0), 'cmp=' + cmp + ' view=' + on + ' got=' + pivotState(st1));
    var back = await backToLive(false);
    var p1 = await waitPivotBack();
    var st2 = H.bso();
    INFO.lplv = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st2) };
    rec('LP7 ...then back to live data: the report\'s pivot, in its sort', on && back && p1 && pivotInSort() && pivotState(st2) === pivotState(st0), J(INFO.lplv));
    rec('LP7b ...named as the shared preset it was', p1 && chipOk && pivotOn() && window._pivotUserPresetActive === 'Dept view' && J(H.chip()) === J({ name: 'Dept view', src: 'shared' }),
      'chip=' + chipOk + ' preset=' + J(window._pivotUserPresetActive) + ' builder=' + J(H.chip()));
  }
  // ?mode=lplvc / lplva: a comparison over the report's live pivot (a shared preset's), a snapshot loaded as a view over
  // it, then from that view: Compare to Live Data and its Clear (lplvc) / an A-vs-B comparison on it and its Clear (lplva)
  async function phaseLivePivotViewCmp() {
    var hdr = MODE === 'lplvc';
    var b = await bootPivot();
    var st0 = H.bso();
    H.mountChip();
    var chipOk = H.setChip('Dept view', 'shared');
    window._pivotUserPresetActive = 'Dept view';
    var cmp = await openCmpLive();
    var on = await loadView(SNAP2, 'Another query\'s snapshot', 5);
    var c2 = hdr ? await compareToLive() : await openAbOnView();
    var cl = await clearCmp();
    var p1 = await waitPivotBack();
    var st1 = H.bso();
    INFO[MODE] = { chipOk: chipOk, cmp: cmp, view: on, second: c2, pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st1), viewing: H.viewing(),
                   preset: window._pivotUserPresetActive, chip: H.chip() };
    rec((hdr ? 'LP11' : 'LP12') + ' a comparison over the report\'s live pivot (a shared preset\'s), a view loaded over it, then ' +
        (hdr ? 'Compare to Live Data from that view' : 'an A-vs-B comparison on that view') + ' and its Clear: the pivot in its sort, named as the preset it was',
      b && chipOk && cmp && on && c2 && cl && p1 && !H.viewing() && pivotInSort() && pivotState(st1) === pivotState(st0) &&
        window._pivotUserPresetActive === 'Dept view' && J(H.chip()) === J({ name: 'Dept view', src: 'shared' }),
      J(INFO[MODE]));
  }
  // ?mode=lpx / lpxc: a comparison over the report's live pivot that aborts (a snapshot sharing no column with the other
  // side): A vs B / with live data
  async function phaseLivePivotAbort() {
    var ab = MODE === 'lpx';
    var b = await bootPivot();
    var st0 = H.bso();
    clearSaid();
    var h0 = hides();
    if (ab) H.runAb(snapObj(SNAP, 'Snapshot A', 5, 56), snapObj(SNAP6, 'Snapshot B', 1, 57), null);
    else H.runCmp(snapObj(SNAP6, 'Compared snapshot', 3, 55), null);
    var ran = await waitFor(function () { return hides() > h0 && /shares? no columns/.test(said()); }, 20000);
    var p1 = await waitPivotBack();
    var st1 = H.bso();
    INFO[MODE] = { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: pivotState(st1), table: $('#resultsTable').is(':visible'), said: said().slice(0, 160) };
    rec((ab ? 'LP8 an A-vs-B' : 'LP9 a') + ' comparison over the report\'s live pivot that aborts (a snapshot sharing no column): the pivot comes back in its sort - not a blank page - the reason said',
      b && ran && p1 && !cmpOn() && pivotInSort() && pivotState(st1) === pivotState(st0), J(INFO[MODE]));
  }
  // ?mode=lps: the report's live pivot searched for "East" in pivot mode, a comparison over it, its Clear
  async function phaseLivePivotSearch() {
    var b = await bootPivot();
    var st0 = H.bso();
    $('#tableSearch').val('East');
    await H.search();
    var s0 = await waitFor(function () { return pivotOn() && J(pivotDepts()) === J(['East']); }, 8000);
    await sleep(600);
    var cmp = await openCmpLive();
    var cl = await clearCmp();
    var p1 = await waitFor(function () { return pivotOn() && J(pivotDepts()) === J(['East']) && /3 pivot rows, with 1 filtered result/.test($('#resultCount').text()); }, 10000);
    await sleep(1500);
    var st1 = H.bso();
    INFO.lps = { searched: s0, pivot: pivotOn(), rows: pivotDepts(), count: $('#resultCount').text(), box: $('#tableSearch').val(), sort: scNow(), saved: pivotState(st1) };
    rec('LP10 the report\'s live pivot searched for "East", a comparison over it, its Clear: the pivot comes back searched in pivot mode as it was (East, of 3 pivot rows), in its sort',
      b && s0 && cmp && cl && p1 && J(pivotDepts()) === J(['East']) && $('#tableSearch').val() === 'East' && J(scNow()) === J(PSORT) && pivotState(st1) === pivotState(st0), J(INFO.lps));
  }
  // ?mode=cmpvpz / cmpvpe: an A-vs-B comparison opened on a view of the pivot report, then its Clear with a search in the
  // box matching no live row ("Zulu") / some ("East"): the pivot drawn again from all the rows, then that search in
  // pivot mode
  async function phaseCmpPivotSearch() {
    var none = MODE === 'cmpvpz', q = none ? 'Zulu' : 'East';
    // (the page's "No rows match" box, as index.php has it: the flat search shows it when it matches nothing)
    $('body').append('<div id="pnbNoSearchMatches" style="display:none">No rows match <span id="pnbNoSearchMatchesHint"></span></div>');
    var b = await bootPivot();
    var st0 = H.bso();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var ab = await openAbOnView();
    $('#tableSearch').val(q);
    var cl = await clearCmp();
    var want = none ? /3 pivot rows, with 0 filtered result/ : /3 pivot rows, with 1 filtered result/;
    var p1 = await waitFor(function () { return $('#pivot-output-container').is(':visible') && want.test($('#resultCount').text()); }, 10000);
    await sleep(1500);
    var st1 = H.bso(), box = $('#pivot-output-container');
    INFO[MODE] = { on: box.is(':visible'), text: box.text().replace(/\s+/g, ' ').trim().slice(0, 80), rows: pivotDepts(), count: $('#resultCount').text(),
                   exit: $('#exitPivotModeBtn').is(':visible'), flat: $('#resultsTable').is(':visible'), saved: pivotState(st1) };
    if (none) {
      rec('LS1 an A-vs-B comparison on a view of the pivot report, its Clear with a search matching no live row: the report\'s pivot, searched in pivot mode ("No results found in pivot data.", of 3 pivot rows), not the flat table; a capture writes the pivot and its sort',
        b && on && ab && cl && p1 && /No results found in pivot data/.test(INFO[MODE].text) && INFO[MODE].exit && !INFO[MODE].flat && pivotState(st1) === pivotState(st0), J(INFO[MODE]));
      rec('LS1c ...the pivot\'s own message only: the flat table\'s "No rows match" box hidden', p1 && /No results found in pivot data/.test(INFO[MODE].text) && !$('#pnbNoSearchMatches').is(':visible'),
        'box=' + $('#pnbNoSearchMatches').is(':visible'));
      $('#tableSearch').val('');
      await H.search();
      var p2 = await waitFor(pivotBack, 8000);
      await sleep(600);
      rec('LS1b ...the search cleared: the whole pivot, in its sort', p1 && p2 && pivotInSort(), 'rows=' + J(pivotDepts()) + ' sort=' + J(scNow()));
      var hidN = document.querySelectorAll('#resultsTable tbody tr.search-hidden').length;
      rec('LS1d ...and the flat rows under it unmarked, as the box is now: none hidden', p1 && p2 && hidN === 0, 'hidden=' + hidN);
    } else {
      rec('LS2 ...its Clear with a search matching some live rows ("East"): the pivot drawn from all the rows, then searched in pivot mode (East, of 3 pivot rows), as a run draws it',
        b && on && ab && cl && p1 && J(pivotDepts()) === J(['East']) && pivotState(st1) === pivotState(st0), J(INFO[MODE]));
      // (the flat rows under the pivot keep the search's marks, as a run leaves them: a comparison's live side, the
      // builder's next Generate read them)
      var un = $('#resultsTable tbody tr').filter(function () { return !this.classList.contains('search-hidden'); })
        .map(function () { return $(this).find('td[data-column="2"]').text().trim(); }).get().sort();
      rec('LS2b ...the flat rows under it still marked by the search: the East rows only', J(un) === J(['Alpha', 'Charlie']), 'unmarked=' + J(un));
    }
  }
  // ?mode=clvf / clvfp / clvn: Compare to Live Data from a view of the grouped / pivot report whose comparison does not
  // render: it throws (the viewed snapshot's data unreadable by then) / it aborts (a snapshot sharing no column)
  async function phaseCmpLiveFail() {
    var piv = MODE !== 'clvf', gone = MODE === 'clvn', rows = gone ? SNAP6 : SNAP;
    var b = await waitBoot();
    var v0 = await waitFor(piv ? pivotBack : grpOn, 15000);
    await sleep(piv ? 1200 : 400);
    var st0 = H.bso();
    var so = snapObj(rows, 'Viewed snapshot', 2), h0 = hides();
    H.loadSnap(so);
    var on = await waitFor(function () { return H.viewing() && hides() > h0 && flatRows() === rows.length && !$('#loadingOverlay').is(':visible'); }, 20000);
    await sleep(500);
    if (!gone) so.compressedData = H.compress('not json');   // (the comparison's own read of it throws)
    clearSaid();
    var q0 = window.__queryDone, btn = document.getElementById('pnbSnapHdrCompare');
    if (btn) $(btn).trigger('click');
    var ran = await waitFor(function () { return window.__queryDone > q0 && !H.viewing() && (gone ? /shares no columns/ : /Comparison failed/).test(said()); }, 30000);
    var back = await waitFor(piv ? pivotBack : function () { return grpOn() && grpCol() === 'DEPT'; }, 10000);
    await sleep(piv ? 1500 : 600);
    var st1 = H.bso();
    function viewOf(st) { return st ? (piv ? pivotState(st) : CJ(grpOf(st))) : null; }
    INFO[MODE] = piv ? { pivot: pivotOn(), sort: scNow(), rows: pivotDepts(), saved: viewOf(st1), cmp: cmpOn(), said: said().slice(0, 160) }
                     : { grouped: grpOn(), col: grpCol(), grp: grpOf(st1), cmp: cmpOn(), said: said().slice(0, 160) };
    var t = { clvf: 'CF1', clvfp: 'CF2', clvn: 'CF3' }[MODE];
    rec(t + ' Compare to Live Data from a view of the ' + (piv ? 'pivot' : 'grouped') + ' report, its comparison ' + (gone ? 'aborting (a snapshot sharing no column)' : 'failing') +
        ': the report comes back ' + (piv ? 'as its pivot, in its sort' : 'grouped as it was') + ', the reason said',
      b && v0 && on && !!btn && ran && back && !cmpOn() && (piv ? pivotInSort() : (grpOn() && grpCol() === 'DEPT')) && viewOf(st1) === viewOf(st0), J(INFO[MODE]));
  }

  // ============================ phase 2: a capture opened in a fresh page ===================================
  async function phaseLoad() {
    var tag = { saved: 'a Save', state: 'a ?state= link', view: 'a link to the view', prefs: 'the viewer\'s stored layout' }[MODE] || MODE;
    var id = 'R-' + EXP + '-' + MODE;
    var b = await waitBoot();
    // (snapgrp) the pages of the report's grouping / pivot / column parts
    if (EXP === 'gv' || EXP === 'lzg') {
      var g = H.bso();
      rec(id + ' ' + tag + ' made in a snapshot view (' + EXP + ') reopens the report grouped as it was, in its own column layout',
        b && grpOn() && grpCol() === 'DEPT' && CJ(grpOf(g)) === CJ(REPORT_GRP) && headIsReport(),
        'boot=' + b + ' grouped=' + grpOn() + ' col=' + grpCol() + ' grp=' + CJ(grpOf(g)) + ' ' + headView());
      return;
    }
    if (EXP === 'pv' || EXP === 'lzp') {
      await waitFor(function () { return pivotOn() && pivotDepts().length === 3; }, 8000);
      await sleep(1500);   // the pivot's deferred formatting
      var p = H.bso();
      rec(id + ' ' + tag + ' made in a snapshot view (' + EXP + ') reopens the report as its pivot, in its sort, in its own column layout',
        b && pivotOn() && !!p && CJ(p.pivot) === CJ(window.__REPORT_PIVOT) && J(scNow()) === J(PSORT) && J(pivotDepts()) === J(PDEPTS) && headIsReport(),
        'boot=' + b + ' pivot=' + pivotOn() + ' sort=' + J(scNow()) + ' rows=' + J(pivotDepts()) + ' ' + headView());
      return;
    }
    if (EXP === 'nw') {
      var w = H.bso();
      rec(id + ' ' + tag + ' made in a snapshot view (nw) reopens the report with its widths, summaries and formula',
        // (a link to the view carries the widths and the summaries but never a formula one: QTY's goes)
        b && headIsReport() && CJ(nwOf(w)) === CJ(REPORT_NW),   // (10-27, viewlink sweep) a view link too: its formula summary comes back with the report's formula
        'boot=' + b + ' parts=' + CJ(nwOf(w)) + ' ' + headView());
      return;
    }
    if (EXP === 'lzc') {
      var c = H.bso();
      rec(id + ' ' + tag + ' made in a ?snap= tab (lzc) reopens the report with its own calculated column',
        b && !!c && CJ(c.calcColumns) === CJ(window.__REPORT_CALC) && headLayout().order.indexOf('DOUBLE') >= 0, 'boot=' + b + ' calc=' + J(c && c.calcColumns) + ' ' + headView());
      return;
    }
    if (MODE === 'prefs') {
      // what Reset all + its Undo on a view left stored: the viewer's own layout, NAME hidden
      rec(id + ' ' + tag + ' after Reset all and its Undo on a snapshot view (' + EXP + '): the report opens in the viewer\'s own layout, NAME hidden',
        b && J(headLayout()) === J(CHG_HEAD), 'boot=' + b + ' ' + headView() + ' preErr=' + J(window.__PRE_ERR || null));
      return;
    }
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
      else if (MODE === 'ovchg') await phaseOverlayChanged();
      else if (MODE === 'ovcalc') await phaseOverlayCalc();
      else if (MODE === 'ovcalc0') await phaseOverlayCalcEmpty();
      else if (MODE === 'ovundo') await phaseOverlayUndoLater();
      else if (MODE === 'ovfail') await phaseOverlayFail();
      else if (MODE === 'ovreset') await phaseOverlayReset();
      else if (MODE === 'ovpanel') await phaseOverlayPanel();
      else if (MODE === 'lz') await phaseLazy();
      else if (MODE === 'gv') await phaseGroupView();
      else if (MODE === 'pv') await phasePivotView();
      else if (MODE === 'nw') await phaseNoColumns();
      else if (MODE === 'lzg' || MODE === 'lzp') await phaseLazyView();
      else if (MODE === 'lzc') await phaseLazyCalc();
      else if (MODE === 'rsv' || MODE === 'rsvc') await phaseResetView();
      else if (MODE === 'rsc') await phaseChipView();
      else if (MODE === 'ovgx') await phaseOverlayGroupSnap();
      else if (MODE === 'ovgl') await phaseOverlayGroupLive();
      else if (MODE === 'gvf') await phaseGroupedFail();
      else if (MODE === 'gvfg') await phaseGroupedFailRegrouped();
      else if (MODE === 'pvf') await phasePivotFail();
      else if (MODE === 'ovgf') await phaseFlatFailGrouped();
      else if (MODE === 'cmpvf') await phaseCmpFail();
      else if (MODE === 'cmpvp') await phaseCmpPivotClear();
      else if (MODE === 'clv' || MODE === 'clvp') await phaseCmpLive();
      else if (MODE === 'clvr' || MODE === 'clvgr') await phaseCmpLiveRun();
      else if (MODE === 'lzcl' || MODE === 'lzclp') await phaseLazyCmpLive();
      else if (MODE === 'lvc' || MODE === 'lvcr') await phaseViewOverCmp();
      else if (MODE === 'lvcp') await phaseViewOverCmpPivot();
      else if (MODE === 'gvfs') await phaseGroupedFailSearch();
      else if (MODE === 'lvcf') await phaseViewOverCmpFail();
      else if (MODE === 'lzclx') await phaseLazyCmpLiveGone();
      else if (MODE === 'cmpv') await phaseCmpOnView();
      else if (MODE === 'cmpvb') await phaseCmpOnViewBack();
      else if (MODE === 'ovg2') await phaseSecondView();
      else if (MODE === 'cmpvg') await phaseCmpOnGroupedView();
      else if (MODE === 'gvc' || MODE === 'lzgc') await phaseConsoleTable();
      else if (MODE === 'gvce') await phaseConsoleEmpty();
      else if (MODE === 'gvr2') await phaseViewOverDialogGrouping();
      else if (MODE === 'lzw') await phaseLazyWidths();
      else if (MODE === 'lpc') await phaseLivePivotCmp();
      else if (MODE === 'lpab') await phaseLivePivotAb();
      else if (MODE === 'lpr') await phaseLivePivotRun();
      else if (MODE === 'lplv') await phaseLivePivotView();
      else if (MODE === 'lplvc' || MODE === 'lplva') await phaseLivePivotViewCmp();
      else if (MODE === 'lpx' || MODE === 'lpxc') await phaseLivePivotAbort();
      else if (MODE === 'lps') await phaseLivePivotSearch();
      else if (MODE === 'cmpvpz' || MODE === 'cmpvpe') await phaseCmpPivotSearch();
      else if (MODE === 'clvf' || MODE === 'clvfp' || MODE === 'clvn') await phaseCmpLiveFail();
      else if (MODE === 'saved' || MODE === 'state' || MODE === 'view' || MODE === 'prefs') await phaseLoad();
      else { finish('unknown mode ' + MODE); return; }
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
