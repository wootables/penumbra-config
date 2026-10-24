// snapsort suite - browser half (2026-10-23). Every snapshot VIEW drew the frozen rows in their captured order under a
// fresh, unmarked header (rebuildTableFromMasterData) while sortCriteria still held the page's sort: the report's saved
// sort in a ?snap= tab, the live sort after Load As View, a pivot's. A repaint with no table marked it by number (on a
// snapshot of other columns: another column), and the ways out handed on whatever the view held: a Run, a live action
// or Compare to Live Data took the snapshot table's own heading sort to the live report; back to live data reset it,
// losing the report's.
// The user's call: a view opens in the report's own sort - matched by column NAME, a level whose column the snapshot
// lacks dropped, never a pivot's - its headings marked; and the report's own sort comes back on every way out.
//   ?mode=lz    a ?snap= boot of the report saved flat and sorted (the state sets the sort, the query never runs)
//   ?mode=lzg   the same with &snapview=report, the report saved grouped (the snapshot drawn grouped)
//   ?mode=ov    the report run (sorted), snapshots loaded as views over it (one of other columns, one without NOTE)
//   ?mode=ovg   the report run grouped and sorted, a snapshot loaded as a view over it, then back to live data
//   ?mode=lzrun / lzcmp / ovrun / ovlive / ovcmp / ovcon / ovp: the other ways out (Run, Compare to Live Data, a live
//               action, a comparison's Clear, a table from the console) and a view loaded over a pivot
// The fixture: the report table numbers its columns ID 0, DEPT 1, NAME 2, AMOUNT 3, QTY 4, NOTE 5 and is sorted by
// NOTE descending (its column 5); snapshot #55 has the same columns, captured in an order no sort of NOTE gives;
// snapshot #56 has NOTE first (its column 5 is AMOUNT); snapshot #57 has no NOTE.
(function () {
  var R = [], INFO = {};
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 900) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, info: INFO, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload).slice(0, 4000);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {};
  var LIVE = window.__LIVE, SNAP = window.__SNAP, SNAP2 = window.__SNAP2, SNAP3 = window.__SNAP3, MODE = window.__MODE;
  function J(x) { return JSON.stringify(x); }
  // an object's JSON with its keys in order (a grouped view's groups come in the group sort's order)
  function JK(o) { var k = Object.keys(o || {}).sort(), c = {}; k.forEach(function (x) { c[x] = o[x]; }); return JSON.stringify(c); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  function hides() { return window.__CF_HIDES || 0; }
  // the page's sort, as [name, column number, direction]
  function scOf(list) { return (list || []).map(function (c) { return [String(c.colIdentifier), String(c.colIndex), c.direction]; }); }
  function crit() { return J(scOf(H.sc())); }
  var RS = J(scOf(window.__REPORT_SORT));   // [["NOTE","5","desc"]]
  function kept() { var k = H.kept(); return k === 'missing' ? 'missing' : J(k); }

  // ---- what a reader sees: the rows (by their ID), the marked headings, the page's sort ----
  function headsIn(theadSel) { return Array.prototype.slice.call(document.querySelectorAll(theadSel + ' th[data-colname]')); }
  function colOf(theadSel, name) {
    var th = headsIn(theadSel).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0];
    return th ? th.getAttribute('data-column') : null;
  }
  function cellsOf(trs, col) {
    return Array.prototype.map.call(trs, function (r) { var td = col === null ? null : r.querySelector(':scope > td[data-column="' + col + '"]'); return td ? String(td.textContent).trim() : '?'; });
  }
  function flatTrs() { return document.querySelectorAll('#resultsTable > tbody > tr'); }
  function flatIds() { return cellsOf(flatTrs(), colOf('#tableHeader', 'ID')); }
  function markList(sel) {
    return Array.prototype.map.call(document.querySelectorAll(sel), function (t) { return String(t.getAttribute('data-colname')).toUpperCase() + ':' + t.getAttribute('aria-sort'); });
  }
  function flatMarks() { return markList('#tableHeader th.sorted').sort(); }
  // rows in a table's order, sorted by the page's sort? (compared by name: the column a reader sees)
  function valKey(v) { var s = String(v).replace(/[$,]/g, ''); return (s !== '' && !isNaN(Number(s))) ? Number(s) : String(v); }
  function sortedBy(trs, theadSel, sc) {
    var cols = sc.map(function (c) { return colOf(theadSel, String(c.colIdentifier).toUpperCase()); });
    if (cols.some(function (c) { return c === null; })) return false;
    var vals = cols.map(function (c) { return cellsOf(trs, c).map(valKey); });
    for (var i = 1; i < trs.length; i++) {
      for (var k = 0; k < sc.length; k++) {
        var a = vals[k][i - 1], b = vals[k][i];
        if (a === b) continue;
        var asc = (typeof a === 'number' && typeof b === 'number') ? a < b : String(a).localeCompare(String(b)) < 0;
        if (asc !== (sc[k].direction !== 'desc')) return false;
        break;
      }
    }
    return true;
  }
  function wantMarks(sc) { return sc.map(function (c) { return String(c.colIdentifier).toUpperCase() + ':' + (c.direction === 'desc' ? 'descending' : 'ascending'); }).sort(); }
  // rows, marks and sort agree: no sort - nothing marked, the rows as drawn (natural); a sort - its headings marked
  // (by name) and the rows in its order
  function agreeFlat(natural) {
    var sc = H.sc(), mk = flatMarks();
    if (!sc.length) return mk.length === 0 && J(flatIds()) === J(natural);
    return J(mk) === J(wantMarks(sc)) && sortedBy(flatTrs(), '#tableHeader', sc);
  }
  function flatView() { return 'rows=' + J(flatIds()) + ' marks=' + J(flatMarks()) + ' sort=' + crit() + ' kept=' + kept(); }
  // the grouped view: each group's rows (by ID) and the marks in every group's headings
  function grpWrappers() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper')); }
  function grpOn() { return $('#groupedResultsContainer').is(':visible') && grpWrappers().length > 0; }
  function grpRows() {
    var out = {};
    grpWrappers().forEach(function (w) {
      var trs = w.querySelectorAll(':scope > .group-content > table > tbody > tr');
      if (!trs.length) return;
      var th = w.querySelector(':scope > .group-content > table > thead th[data-colname="ID"]');
      out[w.getAttribute('data-group-key')] = cellsOf(trs, th ? th.getAttribute('data-column') : null);
    });
    return out;
  }
  function grpMarks() {
    // one list per group (every group's thead is a clone): the distinct marks
    var seen = {};
    markList('#groupedResultsContainer .group-wrapper thead th.sorted').forEach(function (m) { seen[m] = 1; });
    return Object.keys(seen).sort();
  }
  function agreeGrouped(natural) {
    var sc = H.sc(), mk = grpMarks(), rows = grpRows();
    if (!sc.length) return mk.length === 0 && JK(rows) === JK(natural);
    if (J(mk) !== J(wantMarks(sc))) return false;
    return grpWrappers().every(function (w) {
      var trs = w.querySelectorAll(':scope > .group-content > table > tbody > tr');
      if (!trs.length) return true;
      var head = w.querySelector(':scope > .group-content > table > thead');
      if (!head) return true;
      head.setAttribute('data-snapsort-probe', '1');
      try { return sortedBy(trs, '[data-snapsort-probe="1"]', sc); } finally { head.removeAttribute('data-snapsort-probe'); }
    });
  }
  function grpView() { return 'groups=' + JK(grpRows()) + ' marks=' + J(grpMarks()) + ' sort=' + crit() + ' kept=' + kept(); }
  function clickTh(th, shift) {
    if (!th) return false;
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!shift }));
    return true;
  }
  function flatTh(name) { return headsIn('#tableHeader').filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0] || null; }

  // ---- the page's own steps ----
  function snapObj(rows, name, ageDays) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: Object.keys(rows[0]),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  async function waitBoot() {
    var ok = await waitFor(function () { return window.__queryDone >= 1 && hides() > 0 && (grpOn() || flatIds().length === LIVE.length); }, 30000);
    await sleep(600);
    return ok;
  }
  // a snapshot loaded as a view (Load As View: the manager's button calls the same function)
  async function loadView(rows, name, ageDays) {
    var h0 = hides();
    H.loadSnap(snapObj(rows, name, ageDays));
    var ok = await waitFor(function () { return H.viewing() && hides() > h0 && flatIds().length === rows.length && !$('#loadingOverlay').is(':visible'); }, 20000);
    await sleep(500);
    return ok;
  }
  // back to live data: the caution icon, as a person clicks it
  async function backToLive(lazy) {
    var h0 = hides(), q0 = window.__queryDone;
    $('#snapshotCautionIcon').trigger('click');
    var ok = await waitFor(function () {
      return !H.viewing() && hides() > h0 && (!lazy || window.__queryDone > q0) && (grpOn() || $('#pivot-output-container').is(':visible') || flatIds().length === LIVE.length);
    }, 20000);
    await sleep(800);
    return ok;
  }
  var NAT_SNAP = SNAP.map(function (r) { return r.ID; });            // 1 4 3 2 7 8
  var NAT_SNAP2 = SNAP2.map(function (r) { return r.ID; });          // 5 1 2
  var NAT_SNAP3 = SNAP3.map(function (r) { return r.ID; });          // 2 1 3
  var SNAP_SORTED = ['3', '2', '1', '4', '7', '8'];                  // #55 by NOTE descending
  var SNAP_G_SORTED = { East: ['3', '1', '7'], West: ['2', '4', '8'] };
  var NAT_SNAP_G = { East: ['1', '3', '7'], West: ['4', '2', '8'] };
  var LIVE_SORTED = ['3', '2', '1', '4', '5', '6'];
  var LIVE_G_SORTED = { East: ['3', '1'], West: ['2', '4'], North: ['5', '6'] };
  var LIVE_G_NAT = { East: ['1', '3'], West: ['2', '4'], North: ['5', '6'] };   // the query's order in each group
  // a view in the report's own sort: #55's NOTE is its column 5 too
  function snapSorted() { return crit() === RS && J(flatIds()) === J(SNAP_SORTED) && J(flatMarks()) === J(['NOTE:descending']) && agreeFlat(NAT_SNAP); }
  function reportBack() { return !H.viewing() && crit() === RS && J(flatIds()) === J(LIVE_SORTED) && J(flatMarks()) === J(['NOTE:descending']); }

  // ============================ ?mode=lz: a ?snap= boot of the flat sorted report ===============================
  async function phaseLazy() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var q0 = window.__queryDone;
    rec('L0 a ?snap= link of the report opens the snapshot without running the report\'s query',
      on && q0 === 0 && J(flatIds().slice().sort()) === J(NAT_SNAP.slice().sort()), 'viewing=' + on + ' queries=' + q0 + ' ' + flatView());
    rec('L1 a ?snap= view opens in the report\'s own sort: NOTE descending, marked, the rows in that order',
      on && snapSorted(), flatView());
    // a repaint with no table (the journal's, a column change's) marks what sortCriteria says, by number
    H.uhi();
    await sleep(100);
    rec('L2 ...and still so after a repaint of the heading marks', on && snapSorted(), flatView());
    // a state capture made in the view (a Save, a ?state= link) writes the report's own sort
    var st = H.bso();
    rec('L3 a Save made in the ?snap= view writes the report\'s own sort (NOTE descending, its column 5)',
      !!st && J(scOf(st.sortCriteria)) === RS, 'saved=' + J(st && scOf(st.sortCriteria)));
    // a click on the marked NOTE heading (descending) takes the sort off; the next sorts it ascending
    clickTh(flatTh('NOTE'));
    await sleep(300);
    var off = crit() === '[]' && agreeFlat(NAT_SNAP), v1 = flatView();
    clickTh(flatTh('NOTE'));
    await sleep(300);
    rec('L4 a click on the marked NOTE heading takes the sort off (the snapshot\'s own order, unmarked); the next sorts by NOTE ascending',
      on && off && crit() === J([['NOTE', colOf('#tableHeader', 'NOTE'), 'asc']]) && agreeFlat(NAT_SNAP),
      'off: ' + v1 + ' | asc: ' + flatView());
    // back to live data (the caution icon): the report's query runs, the report in its own sort
    var back = await backToLive(true);
    rec('L5 back to live data from the ?snap= view (after clicks re-sorted the snapshot): the report comes back in its own sort, NOTE descending',
      back && reportBack(), 'back=' + back + ' ' + flatView());
  }

  // ============================ ?mode=lzg: ?snap=&snapview=report, the report saved grouped ======================
  async function phaseLazyGrouped() {
    var on = await waitFor(function () { return H.viewing() && grpOn() && hides() > 0; }, 30000);
    await sleep(800);
    rec('G0 a ?snap=&snapview=report link of the grouped report draws the snapshot grouped by DEPT, without running the query',
      on && window.__queryDone === 0 && J(Object.keys(grpRows()).sort()) === J(['East', 'West']), 'grouped=' + on + ' queries=' + window.__queryDone + ' ' + grpView());
    function gSorted() { return crit() === RS && JK(grpRows()) === JK(SNAP_G_SORTED) && J(grpMarks()) === J(['NOTE:descending']) && agreeGrouped(NAT_SNAP_G); }
    rec('G1 the snapshot drawn in the report\'s group view is in the report\'s own sort: NOTE descending in every group, marked',
      on && gSorted(), grpView());
    H.uhi();
    await sleep(100);
    rec('G2 ...and still so after a repaint of the heading marks', on && gSorted(), grpView());
    var back = await backToLive(true);
    rec('G3 back to live data: the grouped report comes back in its own sort, NOTE descending in every group',
      back && !H.viewing() && grpOn() && crit() === RS && JK(grpRows()) === JK(LIVE_G_SORTED) && J(grpMarks()) === J(['NOTE:descending']),
      'back=' + back + ' ' + grpView());
  }

  // ============================ ?mode=ov: snapshots loaded as views over the sorted flat report ==================
  async function phaseOverlay() {
    var b = await waitBoot();
    rec('V0 the report runs sorted by NOTE descending',
      b && crit() === RS && J(flatIds()) === J(LIVE_SORTED) && J(flatMarks()) === J(['NOTE:descending']), 'boot=' + b + ' ' + flatView());
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    rec('V1 a snapshot loaded as a view over the sorted report opens in the report\'s own sort: NOTE descending, marked, the rows in that order',
      on && snapSorted(), 'view=' + on + ' ' + flatView());
    H.uhi();
    await sleep(100);
    rec('V2 ...and still so after a repaint of the heading marks', on && snapSorted(), flatView());
    var st = H.bso();
    rec('V3 a Save made in the snapshot view writes the report\'s own sort (NOTE descending, its column 5)',
      !!st && J(scOf(st.sortCriteria)) === RS, 'saved=' + J(st && scOf(st.sortCriteria)));
    // the user sorts the snapshot by NAME, then loads another snapshot (another query's columns: NOTE first)
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c4 = crit();
    var on2 = await loadView(SNAP2, 'Another snapshot', 5);
    var v4a = flatView();
    var ok4a = crit() === J([['NOTE', '0', 'desc']]) && J(flatIds()) === J(['2', '1', '5']) && J(flatMarks()) === J(['NOTE:descending']) && agreeFlat(NAT_SNAP2);
    H.uhi();
    await sleep(100);
    rec('V4 another snapshot loaded over the first (sorted by NAME there; its columns put NOTE first) opens in the report\'s sort by name: NOTE, its column 0, descending - after a repaint too',
      c4 === J([['NAME', '2', 'asc']]) && on2 && ok4a && crit() === J([['NOTE', '0', 'desc']]) && J(flatMarks()) === J(['NOTE:descending']) && agreeFlat(NAT_SNAP2),
      'took=' + c4 + ' view=' + on2 + ' opened: ' + v4a + ' | repainted: ' + flatView());
    var st2 = H.bso();
    rec('V4b a Save made in that view writes the report\'s own sort (NOTE descending, the report\'s column 5), not the view\'s',
      !!st2 && J(scOf(st2.sortCriteria)) === RS, 'saved=' + J(st2 && scOf(st2.sortCriteria)));
    var back = await backToLive(false);
    rec('V5 back to live data: the report comes back in its own sort, NOTE descending',
      back && reportBack(), 'back=' + back + ' ' + flatView());
    // a snapshot taken before NOTE existed: the report's sort has no column there - unsorted, unmarked
    var on3 = await loadView(SNAP3, 'Older snapshot', 9);
    rec('V10 a snapshot without the sort\'s column (no NOTE) opens unsorted: its own order, nothing marked, no sort',
      on3 && crit() === '[]' && J(flatIds()) === J(NAT_SNAP3) && flatMarks().length === 0, 'view=' + on3 + ' ' + flatView());
    var back3 = await backToLive(false);
    rec('V11 back to live data from it: the report\'s own sort comes back, NOTE descending',
      back3 && reportBack(), 'back=' + back3 + ' ' + flatView());
    // a sort of two levels (NOTE descending, then NAME): over the snapshot without NOTE, only NAME applies
    clickTh(flatTh('NAME'), true);
    await sleep(300);
    var two = J([['NOTE', '5', 'desc'], ['NAME', '2', 'asc']]);
    var c12 = crit();
    var on4 = await loadView(SNAP3, 'Older snapshot', 9);
    rec('V12 a sort of two levels (NOTE descending, then NAME) over the snapshot without NOTE: NOTE\'s level dropped, the rows by NAME ascending, marked',
      c12 === two && on4 && crit() === J([['NAME', '2', 'asc']]) && J(flatIds()) === J(['1', '2', '3']) && J(flatMarks()) === J(['NAME:ascending']),
      'before=' + c12 + ' view=' + on4 + ' ' + flatView());
    var back4 = await backToLive(false);
    rec('V12b back to live data: both levels come back, NOTE descending then NAME, both marked',
      back4 && !H.viewing() && crit() === two && J(flatIds()) === J(LIVE_SORTED) && J(flatMarks()) === J(['NAME:ascending', 'NOTE:descending']),
      'back=' + back4 + ' ' + flatView());
  }

  // ============================ ?mode=ovg: a snapshot loaded as a view over the grouped sorted report ============
  async function phaseOverlayGrouped() {
    var b = await waitBoot();
    var g0 = await waitFor(grpOn, 15000);
    await sleep(400);
    rec('W0 the report runs grouped by DEPT, NOTE descending in every group',
      b && g0 && crit() === RS && JK(grpRows()) === JK(LIVE_G_SORTED) && J(grpMarks()) === J(['NOTE:descending']), 'boot=' + b + ' ' + grpView());
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    rec('W1 a snapshot loaded as a view over the grouped report (drawn flat) opens in the report\'s own sort, NOTE descending, marked',
      on && !grpOn() && snapSorted(), 'view=' + on + ' ' + flatView());
    var back = await backToLive(false);
    rec('W2 back to live data: the grouped report comes back with its rows, marks and sort agreeing - NOTE descending in every group',
      back && !H.viewing() && grpOn() && crit() === RS && JK(grpRows()) === JK(LIVE_G_SORTED) && J(grpMarks()) === J(['NOTE:descending']),
      'back=' + back + ' agree=' + agreeGrouped(LIVE_G_NAT) + ' ' + grpView());
  }

  // ---- the other ways out of a snapshot view ----
  function cmpOn() { return document.body.classList.contains('snapshot-comparison-active'); }
  function box() { return document.getElementById('snapshotComparisonContainer'); }
  function cmpWrappers() { return Array.prototype.slice.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper')); }
  function cmpTh(name) {
    var w = cmpWrappers().filter(function (x) { return x.querySelector('thead th[data-colname]'); })[0];
    if (!w) return null;
    return Array.prototype.slice.call(w.querySelectorAll('thead th[data-colname]')).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0] || null;
  }
  // a new query (the Run button, or what else starts one: trigger); done when its rows are drawn
  async function runQuery(trigger) {
    var q0 = window.__queryDone, h0 = hides();
    if (trigger) trigger(); else document.getElementById('executeQuery').click();
    var ok = await waitFor(function () { return window.__queryDone > q0; }, 20000);
    ok = ok && await waitFor(function () { return hides() > h0 && !H.viewing() && (grpOn() || flatIds().length === LIVE.length); }, 20000);
    await sleep(800);
    return ok;
  }
  async function openAb() {
    var h0 = hides();
    H.runAb(snapObj(SNAP, 'Snapshot A', 5), snapObj(LIVE, 'Snapshot B', 1), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && cmpWrappers().length > 0 && hides() > h0; }, 30000);
    await sleep(400);
    return ok;
  }
  async function openCmp() {
    var h0 = hides();
    H.runCmp(snapObj(SNAP, 'Fixture snapshot', 3), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && cmpWrappers().length > 0 && hides() > h0; }, 30000);
    await sleep(400);
    return ok;
  }
  // the comparison's own Clear (the control bar's link)
  async function clearCmp() {
    var h0 = hides();
    document.getElementById('removeGroupingLink').click();
    var ok = await waitFor(function () { return !cmpOn() && hides() > h0 && !box(); }, 15000);
    await sleep(600);
    return ok;
  }

  // ?mode=lzrun: a ?snap= tab, a heading clicked there, then Run (a prompt changed): the report's own sort comes back
  async function phaseLazyRun() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c = crit();
    var ran = await runQuery();
    rec('L6 Run from a ?snap= view (a click sorted the snapshot by NAME first): the report comes back in its own sort, NOTE descending',
      on && c === J([['NAME', '2', 'asc']]) && ran && reportBack(), 'view=' + on + ' took=' + c + ' run=' + ran + ' ' + flatView());
  }
  // ?mode=lzcase: the report's sort names its column "Note" (the report's heading keeps an alias's case); the
  // snapshot's heading is NOTE. The view's sort takes the heading's name, as a click on it would: the next click on
  // the marked heading finds it and takes it off (not a new ascending sort)
  async function phaseLazyCase() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var opened = flatView();
    var ok0 = crit() === J([['NOTE', '5', 'desc']]) && J(flatIds()) === J(SNAP_SORTED) && J(flatMarks()) === J(['NOTE:descending']);
    clickTh(flatTh('NOTE'));
    await sleep(300);
    rec('L8 the report\'s sort naming its column "Note" opens the view sorted by NOTE descending under the heading\'s own name; a click on that heading takes it off',
      on && ok0 && crit() === '[]' && J(flatIds()) === J(NAT_SNAP) && flatMarks().length === 0, 'opened: ' + opened + ' | clicked: ' + flatView());
  }
  // ?mode=lzcmp: a ?snap= tab, a heading clicked, "Compare to Live Data" in its band, the comparison's Clear: the live
  // report in its own sort
  async function phaseLazyCompare() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c = crit(), q0 = window.__queryDone;
    var btn = document.getElementById('pnbSnapHdrCompare');
    if (btn) btn.click();
    var cmp = await waitFor(function () { return window.__queryDone > q0 && cmpOn() && cmpWrappers().length > 0; }, 30000);
    await sleep(600);
    var cl = cmp && await clearCmp();
    rec('L7 a ?snap= view (sorted by NAME there), Compare to Live Data, then the comparison\'s Clear: the live report in its own sort, NOTE descending',
      on && !!btn && c === J([['NAME', '2', 'asc']]) && cmp && cl && reportBack(), 'view=' + on + ' button=' + !!btn + ' took=' + c + ' cmp=' + cmp + ' clear=' + cl + ' ' + flatView());
  }
  // ?mode=ovrun: Load As View, a heading clicked, Run: the report's own sort comes back
  async function phaseOverlayRun() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c = crit();
    var ran = await runQuery();
    rec('V6 Run from a snapshot loaded as a view (sorted by NAME there): the report comes back in its own sort, NOTE descending',
      b && on && c === J([['NAME', '2', 'asc']]) && ran && reportBack(), 'view=' + on + ' took=' + c + ' run=' + ran + ' ' + flatView());
  }
  // ?mode=ovlive: Load As View, a heading clicked, then a live action that leaves the view by itself (a group preset:
  // the snapshot exit for live actions, then the grouping's Apply): the groups in the report's own sort
  async function phaseOverlayLiveAction() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c = crit();
    H.exitLive();
    await sleep(200);
    var flat = flatView(), flatOk = reportBack();
    window.Penumbra.groupByColumn('DEPT');
    var g = await waitFor(grpOn, 15000);
    await sleep(600);
    rec('V7 a live action from a snapshot view (sorted by NAME there; a group preset): the live table in the report\'s own sort as the view goes, and the groups too - NOTE descending',
      b && on && c === J([['NAME', '2', 'asc']]) && flatOk && g && crit() === RS && JK(grpRows()) === JK(LIVE_G_SORTED) && J(grpMarks()) === J(['NOTE:descending']),
      'view=' + on + ' took=' + c + ' afterExit: ' + flat + ' | grouped=' + g + ' ' + grpView());
  }
  // ?mode=ovcmp: Load As View, an A-vs-B comparison on it (a heading clicked there), its Clear: the live report in its
  // own sort; again with no click; then a comparison on a view left by the caution icon, and a later one's Clear
  async function phaseOverlayCompare() {
    var b = await waitBoot();
    // the view sorted by NAME (a click there), an A-vs-B on it: a comparison heading's click keeps the VIEW's sort for
    // the comparison's end - but the Clear leaves the view for the live report
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c0 = crit();
    var ab = await openAb();
    clickTh(cmpTh('QTY'));
    await sleep(300);
    var c = crit();
    var cl = ab && await clearCmp();
    rec('V8 an A-vs-B comparison opened on a snapshot view (sorted by NAME there), a comparison heading clicked, its Clear: the live report in its own sort, NOTE descending',
      b && on && c0 === J([['NAME', '2', 'asc']]) && ab && /QTY/.test(c) && cl && reportBack(), 'view=' + on + ' viewSort=' + c0 + ' ab=' + ab + ' took=' + c + ' clear=' + cl + ' ' + flatView());
    var on2 = await loadView(SNAP, 'Viewed snapshot', 2);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var c2 = crit();
    var ab2 = await openAb();
    var cl2 = ab2 && await clearCmp();
    rec('V9 ...and with no comparison heading clicked: the live report in its own sort, NOTE descending',
      on2 && c2 === J([['NAME', '2', 'asc']]) && ab2 && cl2 && reportBack(), 'view=' + on2 + ' viewSort=' + c2 + ' ab=' + ab2 + ' clear=' + cl2 + ' ' + flatView());
    // the snapshot sorted by NAME, an A-vs-B on it with a heading clicked (it keeps the view's NAME sort for its end),
    // then back to live data by the caution icon: the report's sort; a later comparison of the live report, a heading
    // clicked, its Clear: the report's sort again - not the first comparison's leftover
    var on3 = await loadView(SNAP, 'Viewed snapshot', 2);
    clickTh(flatTh('NAME'));
    await sleep(300);
    var ab3 = await openAb();
    clickTh(cmpTh('QTY'));
    await sleep(300);
    var back = await backToLive(false);
    var a13 = reportBack(), v13 = flatView();
    var cmp2 = await openCmp();
    clickTh(cmpTh('NAME'));
    await sleep(300);
    var cl3 = cmp2 && await clearCmp();
    rec('V13 back to live data during an A-vs-B on a view (sorted by NAME there, a comparison heading clicked): the report\'s own sort; a later comparison\'s Clear keeps it',
      on3 && ab3 && back && a13 && cmp2 && cl3 && reportBack(), 'view=' + on3 + ' ab=' + ab3 + ' back=' + back + ' then: ' + v13 + ' | cmp=' + cmp2 + ' clear=' + cl3 + ' ' + flatView());
  }
  // ?mode=ovcon: Load As View, then a table opened from the console (it starts from no sort)
  async function phaseOverlayConsole() {
    var b = await waitBoot();
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var ran = await runQuery(function () { H.clearAll('SNAPSORT_FIXTURE', window.__QUERY); });
    rec('C1 a table opened from the console during a snapshot view opens unsorted, as it always has',
      b && on && ran && !H.viewing() && crit() === '[]' && J(flatIds()) === J(['1', '2', '3', '4', '5', '6']) && flatMarks().length === 0,
      'view=' + on + ' run=' + ran + ' ' + flatView());
  }
  // ?mode=ovp: a pivot on screen sorted by one of its own headings - its DEPT row field, a name the snapshot has too -
  // a snapshot loaded as a view over it (a pivot's sort never applies to the snapshot's rows), then back: the pivot
  // comes back with its sort, marked
  function pivotMarks() {
    return Array.prototype.map.call(document.querySelectorAll('#pivotResultTable thead th.sorted'), function (t) {
      var c = t.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.sort-icon'), function (x) { x.remove(); });
      return String(c.textContent).trim().toUpperCase() + ':' + t.getAttribute('aria-sort');
    });
  }
  function pivotDepts() { return Array.prototype.map.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (r) { return r.cells[0] ? r.cells[0].textContent.trim() : '?'; }); }
  async function phaseOverlayPivot() {
    var b = await waitBoot();
    H.setSort([]); H.uhi();
    $('#resultsTable').hide(); $('#paginationControls').hide();
    $('#pivot-output-container').html('<table id="pivotResultTable"><thead><tr><th data-row-field="DEPT">DEPT <span class="sort-icon">&#9650;&#9660;</span></th>'
      + '<th>North <span class="sort-icon">&#9650;&#9660;</span></th></tr></thead><tbody><tr><td>East</td><td>1</td></tr><tr><td>North</td><td>3</td></tr><tr><td>West</td><td>2</td></tr></tbody></table>').show();
    $('#exitPivotModeBtn').show();
    H.setSort([{ colIdentifier: 'DEPT', colIndex: 0, direction: 'asc' }]);
    H.uhi();
    var pv0 = J(pivotMarks());
    var on = await loadView(SNAP, 'Viewed snapshot', 2);
    var v1 = flatView(), ok1 = crit() === '[]' && agreeFlat(NAT_SNAP);
    H.uhi();
    await sleep(100);
    rec('P1 a snapshot loaded as a view over a pivot sorted by its DEPT row field opens unsorted (a pivot\'s sort never applies): its own order, nothing marked - after a repaint too',
      b && pv0 === J(['DEPT:ascending']) && on && ok1 && crit() === '[]' && agreeFlat(NAT_SNAP), 'pivotBefore=' + pv0 + ' view=' + on + ' opened: ' + v1 + ' | repainted: ' + flatView());
    var back = await backToLive(false);
    var pv = $('#pivot-output-container').is(':visible');
    rec('P2 back to live data: the pivot comes back with its own sort - DEPT ascending, marked, its rows in that order',
      back && pv && crit() === J([['DEPT', '0', 'asc']]) && J(pivotMarks()) === J(['DEPT:ascending']) && J(pivotDepts()) === J(['East', 'North', 'West']),
      'back=' + back + ' pivot=' + pv + ' marks=' + J(pivotMarks()) + ' rows=' + J(pivotDepts()) + ' sort=' + crit() + ' kept=' + kept());
  }

  // ?mode=lzp: a ?snap= tab of a report saved as a pivot (sorted by its DEPT row field): the pivot is armed, not on
  // screen - its sort is the pivot's, never the snapshot rows'; Compare to Live Data's flat table does not take it
  async function phaseLazyPivot() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var v0 = flatView(), ok0 = crit() === '[]' && J(flatIds()) === J(NAT_SNAP) && flatMarks().length === 0;
    H.uhi();
    await sleep(100);
    rec('P3 a ?snap= view of a report saved as a pivot (sorted by its DEPT row field) opens unsorted - a pivot\'s sort never applies to the snapshot\'s rows - after a repaint too',
      on && ok0 && crit() === '[]' && J(flatIds()) === J(NAT_SNAP) && flatMarks().length === 0, 'opened: ' + v0 + ' | repainted: ' + flatView());
    var q0 = window.__queryDone;
    var btn = document.getElementById('pnbSnapHdrCompare');
    if (btn) btn.click();
    var cmp = await waitFor(function () { return window.__queryDone > q0 && cmpOn() && cmpWrappers().length > 0; }, 30000);
    await sleep(600);
    var cl = cmp && await clearCmp();
    rec('P4 ...its Compare to Live Data, then the comparison\'s Clear: the live table flat in its own order - the pivot\'s sort not on it, nothing marked',
      on && !!btn && cmp && cl && crit() === '[]' && J(flatIds()) === J(['1', '2', '3', '4', '5', '6']) && flatMarks().length === 0,
      'button=' + !!btn + ' cmp=' + cmp + ' clear=' + cl + ' ' + flatView());
  }
  // ?mode=lzpx: the same tab, back to live data (the caution icon): the report's pivot in its own sort again
  async function phaseLazyPivotExit() {
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length && hides() > 0; }, 30000);
    await sleep(800);
    var q0 = window.__queryDone;
    $('#snapshotCautionIcon').trigger('click');
    var back = await waitFor(function () { return !H.viewing() && window.__queryDone > q0 && $('#pivot-output-container').is(':visible') && !!document.querySelector('#pivotResultTable tbody tr'); }, 30000);
    await sleep(1500);   // the pivot's deferred formatting
    var depts = pivotDepts().filter(function (d) { return !/total/i.test(d); });
    rec('P5 back to live data from it: the report\'s pivot comes back in its own sort - DEPT descending, marked, its rows in that order',
      on && back && crit() === J([['DEPT', '0', 'desc']]) && J(pivotMarks()) === J(['DEPT:descending']) && J(depts) === J(['West', 'North', 'East']),
      'view=' + on + ' back=' + back + ' sort=' + crit() + ' marks=' + J(pivotMarks()) + ' rows=' + J(pivotDepts()));
  }
  // ?mode=lzpw: an encrypted report's ?snap= tab: the view opens while the password is asked for (the report's sort not
  // known yet); once it is given, the report's state arrives - its sort is the one to keep, and the view's
  async function phaseLazyPassword() {
    var asked = await waitFor(function () { return !!document.getElementById('decryptPasswordInput'); }, 30000);
    var on = await waitFor(function () { return H.viewing() && flatIds().length === SNAP.length; }, 30000);
    await sleep(800);
    var v0 = flatView();
    $('#decryptPasswordInput').val(window.__PW);
    $('#btnDecryptOk').trigger('click');
    var st = await waitFor(function () { return !document.getElementById('passwordPromptOverlay') && H.sc().length > 0; }, 30000);
    await sleep(800);
    rec('L9 an encrypted report\'s ?snap= view opened while its password was asked for: once the report\'s state arrives, the view is in its saved sort - NOTE descending, marked',
      asked && on && st && snapSorted(), 'asked=' + asked + ' view=' + on + ' state=' + st + ' before: ' + v0 + ' | after: ' + flatView());
    var back = await backToLive(true);
    rec('L10 back to live data from it: the report comes back in its own sort, NOTE descending', back && reportBack(), 'back=' + back + ' ' + flatView());
  }
  // ?mode=ovx: another report's snapshot loaded as a view over this report (Browse All): its rows are not this
  // report's - its own order; the report's sort back on the way out
  async function phaseOverlayForeign() {
    var b = await waitBoot();
    var h0 = hides();
    var so = snapObj(SNAP, 'Another report\'s snapshot', 4);
    so.reportShortId = 'otherrpt'; so.reportTitle = 'Another report';
    H.loadSnap(so);
    var on = await waitFor(function () { return H.viewing() && hides() > h0 && flatIds().length === SNAP.length; }, 20000);
    await sleep(500);
    rec('V14 another report\'s snapshot loaded as a view (Browse All) opens in its own order - this report\'s sort is not its: nothing marked, no sort',
      b && on && crit() === '[]' && J(flatIds()) === J(NAT_SNAP) && flatMarks().length === 0, 'view=' + on + ' ' + flatView());
    var back = await backToLive(false);
    rec('V14b back to live data: the report\'s own sort comes back, NOTE descending', back && reportBack(), 'back=' + back + ' ' + flatView());
  }

  (async function () {
    try {
      var need = ['compress', 'loadSnap', 'restore', 'exitLive', 'uhi', 'bso', 'sc', 'setSort', 'viewing', 'kept', 'runAb', 'runCmp', 'clearAll'];
      var miss = need.filter(function (k) { return !H[k]; });
      if (miss.length) { finish('hook: not exported: ' + miss.join(', ')); return; }
      if (MODE === 'lz') await phaseLazy();
      else if (MODE === 'lzg') await phaseLazyGrouped();
      else if (MODE === 'ov') await phaseOverlay();
      else if (MODE === 'ovg') await phaseOverlayGrouped();
      else if (MODE === 'lzrun') await phaseLazyRun();
      else if (MODE === 'lzcase') await phaseLazyCase();
      else if (MODE === 'lzp') await phaseLazyPivot();
      else if (MODE === 'lzpx') await phaseLazyPivotExit();
      else if (MODE === 'lzpw') await phaseLazyPassword();
      else if (MODE === 'ovx') await phaseOverlayForeign();
      else if (MODE === 'lzcmp') await phaseLazyCompare();
      else if (MODE === 'ovrun') await phaseOverlayRun();
      else if (MODE === 'ovlive') await phaseOverlayLiveAction();
      else if (MODE === 'ovcmp') await phaseOverlayCompare();
      else if (MODE === 'ovcon') await phaseOverlayConsole();
      else if (MODE === 'ovp') await phaseOverlayPivot();
      else { finish('unknown mode ' + MODE); return; }
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
