// cmpsort suite - browser half (2026-10-22). The REAL main.js renders a REAL compare-to-live snapshot comparison
// (the cmpfoot fixture: keys ID; 5-6 new, 7-8 removed, 3-4 modified, 1-2 unchanged - two rows in each group), and
// the headings are clicked as a person clicks them. The report's own table is sorted first: its NOTE is column 4,
// the comparison's NOTE column 5 (the comparison counts '#' first), the comparison's column 4 is QTY - whose order
// (the ID order) differs from NOTE's in three groups. window.__CF.sc() reads the page's one sort.
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 700) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {};
  // (2026-10-23, cmprq) does the main.js under test hold cmprq (a new query run during a comparison hands the report
  // table's own sort back)? run.py reads it from the file: S8 expects what that build does
  var CMPRQ = !!window.__CF_CMPRQ;
  var COLS = window.__COLS, LIVE = window.__LIVE, SNAP = window.__SNAP;
  function J(x) { return JSON.stringify(x); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  function flatRows() { return document.querySelectorAll('#resultsTable tbody tr').length; }
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && flatRows() === LIVE.length; }, 30000);
    await sleep(400);
  }
  function snapObj(rows, name, ageDays) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: COLS.slice(),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  function cmpOn() { return document.body.classList.contains('snapshot-comparison-active'); }
  function box() { return document.getElementById('snapshotComparisonContainer'); }
  function wrappers() { return Array.prototype.slice.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper')); }
  function wrapperOf(group) { return wrappers().filter(function (w) { return w.getAttribute('data-group-key') === group; })[0] || null; }
  function keys() { return wrappers().map(function (w) { return w.getAttribute('data-group-key'); }); }
  function headIn(w, name) {
    if (!w) return null;
    return Array.prototype.slice.call(w.querySelectorAll('thead th[data-colname]')).filter(function (t) { return String(t.getAttribute('data-colname')).toUpperCase() === name; })[0] || null;
  }
  function cmpTh(name) { return headIn(wrapperOf('Modified Rows'), name); }
  // a group's IDs in the order its table shows them
  function idsOf(group) {
    var w = wrapperOf(group), idTh = headIn(w, 'ID');
    if (!idTh) return null;
    var c = idTh.getAttribute('data-column');
    return Array.prototype.map.call(w.querySelectorAll('tbody tr'), function (r) { var td = r.querySelector('td[data-column="' + c + '"]'); return td ? String(td.textContent).trim() : '?'; });
  }
  function allIds() { return J([idsOf('New Rows'), idsOf('Removed Rows'), idsOf('Modified Rows'), idsOf('Unchanged Rows')]); }
  function openAll() { wrappers().forEach(function (x) { var c = x.querySelector('.group-content'); if (c) c.style.display = 'block'; }); }
  // the sort marks on the comparison's headings: group:column:aria-sort[:rank], in page order
  function marksIn(sel, withGroup) {
    return Array.prototype.map.call(document.querySelectorAll(sel), function (t) {
      var w = t.closest('.group-wrapper'), r = t.querySelector('.sort-rank');
      return (withGroup ? (w ? w.getAttribute('data-group-key') : '?') + ':' : '') + t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort') + (r ? ':' + r.textContent : '');
    });
  }
  function cmpMarks() { return marksIn('#snapshotComparisonContainer thead th.sorted', true); }
  function reportMarks() { return marksIn('#tableHeader th.sorted', false); }
  var GROUPS = ['New Rows', 'Removed Rows', 'Modified Rows', 'Unchanged Rows'];
  function everyGroup(parts) { var out = []; GROUPS.forEach(function (g) { parts.forEach(function (p) { out.push(g + ':' + p); }); }); return J(out); }
  // the page's sort, as [name, column number, direction] - the number is the one its cells are read by
  function crit() { return J((H.sc() || []).map(function (c) { return [String(c.colIdentifier), String(c.colIndex), c.direction]; })); }
  function reportTh(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function reportIds() {
    return J(Array.prototype.map.call(document.querySelectorAll('#resultsTable tbody tr'), function (r) { var td = r.querySelector('td[data-column="0"]'); return td ? String(td.textContent).trim() : '?'; }));
  }
  // a click on a heading, as a person's (Shift for the next sort level)
  function clickTh(th, shift) {
    if (!th) return false;
    th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!shift }));
    return true;
  }
  // the report table sorted by NAME in DIR through clicks on its own heading (as it was before any comparison)
  async function reportSort(name, dir) {
    var want = J([[name, String(reportTh(name) ? reportTh(name).getAttribute('data-column') : '?'), dir]]);
    for (var i = 0; i < 4 && crit() !== want; i++) { clickTh(reportTh(name)); await sleep(120); }
    return crit() === want;
  }
  async function openCmp() {
    var h0 = window.__CF_HIDES || 0;
    H.runCmp(snapObj(SNAP, 'Fixture snapshot', 3), ['ID']);
    var ok = await waitFor(function () { return cmpOn() && wrappers().length === 4 && (window.__CF_HIDES || 0) > h0; }, 30000);
    await sleep(300);
    openAll();
    await sleep(100);
    return ok;
  }
  // the comparison's own Clear (the control bar's link)
  async function clearCmp() {
    var h0 = window.__CF_HIDES || 0;
    document.getElementById('removeGroupingLink').click();
    var ok = await waitFor(function () { return !cmpOn() && (window.__CF_HIDES || 0) > h0 && !box(); }, 15000);
    await sleep(300);
    return ok;
  }
  // a search re-runs a compare-to-live comparison: a new container, then a quiet DOM
  async function search(q) {
    var c0 = box();
    window.Penumbra.findHost.runSearch(q);
    await waitFor(function () { return box() && box() !== c0; }, 8000);
    var last = '', still = 0, t0 = Date.now();
    while (Date.now() - t0 < 4000 && still < 4) {
      await sleep(100);
      var s = keys().join('|') + '#' + document.querySelectorAll('#snapshotComparisonContainer tbody tr').length;
      if (s === last) still++; else { still = 0; last = s; }
    }
    openAll();
  }
  // the comparison menu (penumbra_colmenu.js), right-clicked as a person does
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function item(a) { var ps = document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub'); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + a + '"]'); if (x) return x; } return null; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  async function choose(el, act) {
    closeMenu(); rclick(el);
    var it = item(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; }
    it.click();
    await sleep(200);
    return true;
  }
  function HM() { return window.Penumbra.headerMenu; }

  var NOTE_ASC = J([['6', '5'], ['8', '7'], ['4', '3'], ['1', '2']]);
  var NOTE_DESC = J([['5', '6'], ['7', '8'], ['3', '4'], ['2', '1']]);
  var ID_DESC = J([['6', '5'], ['8', '7'], ['4', '3'], ['2', '1']]);
  // a render's own order under the report's NOTE sort: its live rows in the report table's order (NOTE ascending),
  // the removed ones in the snapshot's - not the page's sort: Removed Rows is not by NOTE
  var RENDER_N = J([['6', '5'], ['7', '8'], ['4', '3'], ['1', '2']]);
  var R_NOTE_ASC = J(['6', '5', '4', '1', '2', '3']), R_NOTE_DESC = J(['3', '2', '1', '4', '5', '6']), R_ID = J(['1', '2', '3', '4', '5', '6']);

  async function main() {
    await waitBoot();
    // S0 the report's own table sorted by NOTE, a click on its heading: its column 4
    var ok0 = await reportSort('NOTE', 'asc');
    rec('S0 a click sorts the report\'s own table by NOTE, ascending, by its column 4', ok0 && reportIds() === R_NOTE_ASC && J(reportMarks()) === J(['NOTE:ascending']),
      'sort=' + crit() + ' rows=' + reportIds() + ' marks=' + J(reportMarks()));

    // S1 a comparison renders under that sort in an order of its own (its live rows as the report table has them, the
    // removed ones as the snapshot has them): a repaint with no table (the journal's, after a render) marks none of
    // its headings - the report's NOTE number is the comparison's QTY
    var on1 = await openCmp();
    H.uhi();
    var m1 = cmpMarks();
    rec('S1 a fresh comparison under the report\'s sort: a repaint with no table marks none of its headings (the report\'s NOTE is the comparison\'s column 4, QTY)',
      on1 && J(keys()) === J(GROUPS) && allIds() === RENDER_N && m1.length === 0, 'on=' + on1 + ' rows=' + allIds() + ' marks=' + J(m1) + ' sort=' + crit());

    // S2 a click on a comparison heading: by that heading's own column, ascending first - every group's table, every
    // group's heading marked; a repaint with no table then marks the same
    var noteCol = cmpTh('NOTE') ? cmpTh('NOTE').getAttribute('data-column') : '?';
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o2 = allIds(), c2 = crit(), m2 = J(cmpMarks());
    H.uhi();
    var m2b = J(cmpMarks());
    rec('S2 a click on a comparison heading sorts every group by that heading\'s own column (5), ascending first, and marks it in every group',
      noteCol === '5' && o2 === NOTE_ASC && c2 === J([['NOTE', '5', 'asc']]) && m2 === everyGroup(['NOTE:ascending']) && m2b === m2,
      'col=' + noteCol + ' rows=' + o2 + ' sort=' + c2 + ' marks=' + m2 + ' repaint=' + m2b);

    // S3 the next click: descending; the one after: no sort (the render's order, no marks)
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o3a = allIds(), c3a = crit(), m3a = J(cmpMarks());
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o3b = allIds(), c3b = crit(), m3b = J(cmpMarks());
    rec('S3 the next click sorts descending, the one after takes the sort off (the render\'s order back, no marks)',
      o3a === NOTE_DESC && c3a === J([['NOTE', '5', 'desc']]) && m3a === everyGroup(['NOTE:descending']) && o3b === RENDER_N && c3b === '[]' && m3b === '[]',
      'desc=' + o3a + ' ' + c3a + ' ' + m3a + ' | off=' + o3b + ' ' + c3b + ' ' + m3b);

    // S4 a search re-runs the comparison: a new render, unsorted - a repaint marks none of its headings, and a click
    // on the heading the page's sort is on starts ascending again
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o4z = allIds();
    await search("NAME != 'Zulu'");
    H.uhi();
    var m4a = J(cmpMarks()), o4a = allIds();
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o4b = allIds(), c4 = crit();
    rec('S4 after a re-run its headings carry no mark (a repaint with no table either), and a click on the sorted column starts ascending',
      o4z === NOTE_ASC && m4a === '[]' && o4a === RENDER_N && o4b === NOTE_ASC && c4 === J([['NOTE', '5', 'asc']]),
      'before=' + o4z + ' rerun=' + o4a + ' marks=' + m4a + ' click=' + o4b + ' ' + c4);

    // S5 Shift+click on a render not sorted yet: levels of its own from the first (the sort from before the re-run is
    // not a level of it), each by the comparison's column numbers, ranked in every group
    clickTh(cmpTh('NAME'));
    await sleep(200);
    var c5z = crit();
    await search('');
    clickTh(cmpTh('NOTE'), true);
    await sleep(200);
    clickTh(cmpTh('AMOUNT'), true);
    await sleep(200);
    var c5 = crit(), o5 = allIds(), m5 = J(cmpMarks());
    rec('S5 Shift+click on a fresh render builds its own levels (NOTE 5, then AMOUNT 3), the earlier sort not among them, ranked in every group',
      c5z === J([['NAME', '2', 'asc']]) && c5 === J([['NOTE', '5', 'asc'], ['AMOUNT', '3', 'asc']]) && o5 === NOTE_ASC && m5 === everyGroup(['AMOUNT:ascending:2', 'NOTE:ascending:1']),
      'before=' + c5z + ' sort=' + c5 + ' rows=' + o5 + ' marks=' + m5);

    // S6 Clear: the report table's own sort is back (NOTE ascending, its column 4), its rows as they were; a click on
    // its NOTE heading goes on from it (descending)
    var cl6 = await clearCmp();
    var c6a = crit(), r6a = reportIds();
    clickTh(reportTh('NOTE'));
    await sleep(200);
    var c6b = crit(), r6b = reportIds(), rm6 = J(reportMarks());
    rec('S6 Clear puts the report table\'s own sort back (NOTE ascending, its column 4), and a click on its NOTE heading then sorts descending',
      cl6 && c6a === J([['NOTE', '4', 'asc']]) && r6a === R_NOTE_ASC && c6b === J([['NOTE', '4', 'desc']]) && r6b === R_NOTE_DESC && rm6 === J(['NOTE:descending']),
      'cleared=' + cl6 + ' back=' + c6a + ' ' + r6a + ' | click=' + c6b + ' ' + r6b + ' ' + rm6);

    // S7 a sort of the report's own table made while a comparison is on screen (the page's header menu API, as a
    // palette row can run it) is the report's sort then: no comparison heading is marked from it, and Clear puts IT
    // back after a later comparison sort - not the sort from before the comparison
    var on7 = await openCmp();
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    HM().sort(reportTh('QTY'), 'asc');
    await sleep(200);
    var c7a = crit(), m7 = J(cmpMarks());
    clickTh(cmpTh('NAME'));
    await sleep(200);
    var c7b = crit();
    var cl7 = await clearCmp();
    var c7 = crit(), r7 = reportIds();
    rec('S7 a report-table sort made during a comparison is the one Clear puts back after a later comparison sort (QTY, its column 3), no comparison heading marked from it',
      on7 && c7a === J([['QTY', '3', 'asc']]) && m7 === '[]' && c7b === J([['NAME', '2', 'asc']]) && cl7 && c7 === J([['QTY', '3', 'asc']]) && r7 === R_ID,
      'reportSort=' + c7a + ' marks=' + m7 + ' cmpSort=' + c7b + ' cleared=' + cl7 + ' back=' + c7 + ' ' + r7);

    // S8 a new query ends a sorted comparison (no Clear). Since cmprq (2026-10-23) the run hands the report table's own
    // sort back first - QTY, as S7 left it - and carries it, keeping no sort for the comparison's end; the next
    // comparison's Clear puts that one back. Before cmprq it carried the comparison's own (none: its heading clicked
    // three times) and left the kept sort stale, which the next comparison's entry dropped - S13 holds that case now
    // (a table opened from the console still leaves one)
    var on8 = await openCmp();
    clickTh(cmpTh('NOTE')); await sleep(150);
    clickTh(cmpTh('NOTE')); await sleep(150);
    clickTh(cmpTh('NOTE')); await sleep(150);
    var c8z = crit(), q0 = window.__queryDone;
    document.getElementById('executeQuery').click();
    var ran8 = await waitFor(function () { return window.__queryDone > q0 && !cmpOn() && flatRows() === LIVE.length; }, 30000);
    await sleep(600);
    var c8a = crit(), r8a = reportIds();
    var on8b = await openCmp();
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var c8b = crit();
    var cl8 = await clearCmp();
    var c8 = crit(), r8 = reportIds();
    var back8 = CMPRQ ? J([['QTY', '3', 'asc']]) : '[]';
    rec('S8 a new query ends a sorted comparison: it comes back in the report table\'s own sort (QTY; none before cmprq), and the next comparison\'s Clear leaves that sort',
      on8 && c8z === '[]' && ran8 && c8a === back8 && r8a === R_ID && on8b && c8b === J([['NOTE', '5', 'asc']]) && cl8 && c8 === back8 && r8 === R_ID,
      'cmprq=' + CMPRQ + ' cmp=' + on8 + ' ' + c8z + ' query=' + ran8 + ' ' + c8a + ' ' + r8a + ' | next=' + on8b + ' ' + c8b + ' cleared=' + cl8 + ' back=' + c8 + ' ' + r8);

    // S9 another view taking over from a comparison (Apply Grouping, a pivot, Load As View: their shared teardown)
    // puts the report table's own sort back
    var ok9 = await reportSort('NOTE', 'asc');
    var on9 = await openCmp();
    clickTh(cmpTh('QTY'));
    await sleep(200);
    var c9a = crit(), m9a = J(cmpMarks());
    H.teardown();
    var c9 = crit();
    // the comparison is still on screen until the caller replaces it: a repaint must not paint it from the report's sort
    H.uhi();
    var m9 = J(cmpMarks());
    $('#groupedResultsContainer').empty().hide();
    $('#resultsTable').show();
    await sleep(200);
    rec('S9 the teardown another view runs puts the report table\'s own sort back (NOTE ascending, its column 4), the comparison still on screen left unmarked',
      ok9 && on9 && c9a === J([['QTY', '4', 'asc']]) && m9a === everyGroup(['QTY:ascending']) && c9 === J([['NOTE', '4', 'asc']]) && m9 === '[]' && !cmpOn(),
      'report=' + ok9 + ' cmp=' + on9 + ' ' + c9a + ' ' + m9a + ' after=' + c9 + ' marks=' + m9);

    // S10 the comparison menu's sort takes the page's sort over as a click does (Sort descending, Then sort): Clear
    // puts the report's back
    var ok10 = await reportSort('NOTE', 'asc');
    var on10 = await openCmp();
    var ran10a = await choose(cmpTh('NAME'), 'sortDesc');
    var o10 = allIds();
    var ran10b = await choose(cmpTh('AMOUNT'), 'thenAsc');
    var c10a = crit();
    closeMenu();
    var cl10 = await clearCmp();
    var c10 = crit(), r10 = reportIds();
    rec('S10 the comparison menu\'s Sort descending and Then sort, then Clear: the report table\'s own sort back (NOTE ascending, its column 4)',
      ok10 && on10 && ran10a && o10 === ID_DESC && ran10b && c10a === J([['NAME', '2', 'desc'], ['AMOUNT', '3', 'asc']]) && cl10 && c10 === J([['NOTE', '4', 'asc']]) && r10 === R_NOTE_ASC,
      'report=' + ok10 + ' cmp=' + on10 + ' menu=' + ran10a + '/' + ran10b + ' rows=' + o10 + ' ' + c10a + ' cleared=' + cl10 + ' back=' + c10 + ' ' + r10);

    // S11 an A-vs-B comparison (the other renderer: two snapshots, its rows in the snapshots' order, its columns
    // numbered without '#' - NOTE 4 here, as the report's): no mark from the report's sort, a click on NOTE starts
    // ascending, Clear puts the report's own sort back
    var ok11 = await reportSort('NOTE', 'asc');
    var h11 = window.__CF_HIDES || 0;
    H.runAb(snapObj(SNAP, 'Snapshot A', 5), snapObj(LIVE, 'Snapshot B', 1), ['ID']);
    var on11 = await waitFor(function () { return cmpOn() && wrappers().length === 4 && (window.__CF_HIDES || 0) > h11; }, 30000);
    await sleep(300);
    openAll();
    await sleep(100);
    var o11a = allIds();
    H.uhi();
    var m11a = J(cmpMarks()), col11 = cmpTh('NOTE') ? cmpTh('NOTE').getAttribute('data-column') : '?';
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var o11b = allIds(), c11a = crit(), m11b = J(cmpMarks());
    var cl11 = await clearCmp();
    var c11 = crit(), r11 = reportIds();
    rec('S11 an A-vs-B comparison: no mark from the report\'s sort, a click on NOTE (its column 4) sorts ascending first, Clear puts the report\'s own sort back',
      ok11 && on11 && o11a === J([['5', '6'], ['7', '8'], ['3', '4'], ['1', '2']]) && m11a === '[]' && col11 === '4' && o11b === NOTE_ASC && c11a === J([['NOTE', '4', 'asc']])
        && m11b === everyGroup(['NOTE:ascending']) && cl11 && c11 === J([['NOTE', '4', 'asc']]) && r11 === R_NOTE_ASC,
      'report=' + ok11 + ' ab=' + on11 + ' rows=' + o11a + ' marks=' + m11a + ' col=' + col11 + ' | click=' + o11b + ' ' + c11a + ' ' + m11b + ' cleared=' + cl11 + ' back=' + c11 + ' ' + r11);

    // S12 a Custom Sort Order saved during a comparison re-applies the sort on screen (_csApplyToCurrentView): a render
    // the page's sort is not on has none - left as it is, the report's own sort untouched (the review: its clicks turned
    // the report's criterion around in place); on a render the page's sort is on, that sort is applied again as it stands
    var ok12 = await reportSort('NOTE', 'desc');
    var on12 = await openCmp();
    var o12a = allIds(), c12z = crit();
    H.csApply('NOTE');
    await sleep(200);
    var o12b = allIds(), c12a = crit(), m12a = J(cmpMarks());
    clickTh(cmpTh('NOTE')); await sleep(150);
    clickTh(cmpTh('NOTE')); await sleep(150);
    var c12b = crit();
    H.csApply('NOTE');
    await sleep(200);
    var o12c = allIds(), c12c = crit(), m12c = J(cmpMarks());
    var cl12 = await clearCmp();
    var c12 = crit(), r12 = reportIds();
    rec('S12 a Custom Sort Order saved during a comparison leaves an unsorted render and the report\'s sort as they are, and re-applies a sort the page has on the render',
      ok12 && on12 && c12z === J([['NOTE', '4', 'desc']]) && o12b === o12a && c12a === c12z && m12a === '[]'
        && c12b === J([['NOTE', '5', 'desc']]) && o12c === NOTE_DESC && c12c === c12b && m12c === everyGroup(['NOTE:descending'])
        && cl12 && c12 === J([['NOTE', '4', 'desc']]) && r12 === R_NOTE_DESC,
      'report=' + ok12 + ' cmp=' + on12 + ' ' + c12z + ' rows=' + o12a + ' | apply=' + o12b + ' ' + c12a + ' ' + m12a
        + ' | sorted=' + c12b + ' apply=' + o12c + ' ' + c12c + ' ' + m12c + ' cleared=' + cl12 + ' back=' + c12 + ' ' + r12);

    // S13 (2026-10-23, cmprq) a table opened from the console (performClearAllAction: a new query from no sort that keeps
    // nothing of the report's view) ends a comparison whose heading took the sort over: the report sort it kept for its
    // end stays behind - the next comparison does not put that one back, its Clear leaves the sort the new table
    // started with (none). (S8's case until cmprq: a plain new query hands the kept sort back itself since.)
    var ok13 = await reportSort('QTY', 'asc');
    var on13 = await openCmp();
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var c13z = crit(), q13 = window.__queryDone;
    H.clearAll('CMPFOOT_FIXTURE', window.__QUERY);
    var ran13 = await waitFor(function () { return window.__queryDone > q13 && !cmpOn() && flatRows() === LIVE.length; }, 30000);
    await sleep(600);
    var c13a = crit(), r13a = reportIds();
    var on13b = await openCmp();
    clickTh(cmpTh('NOTE'));
    await sleep(200);
    var c13b = crit();
    var cl13 = await clearCmp();
    var c13 = crit(), r13 = reportIds();
    rec('S13 a table opened from the console ends a sorted comparison: the next comparison\'s Clear leaves the new table\'s sort (none), not the report sort kept before it',
      ok13 && on13 && c13z === J([['NOTE', '5', 'asc']]) && ran13 && c13a === '[]' && r13a === R_ID && on13b && c13b === J([['NOTE', '5', 'asc']]) && cl13 && c13 === '[]' && r13 === R_ID,
      'report=' + ok13 + ' cmp=' + on13 + ' ' + c13z + ' query=' + ran13 + ' ' + c13a + ' ' + r13a + ' | next=' + on13b + ' ' + c13b + ' cleared=' + cl13 + ' back=' + c13 + ' ' + r13);
  }

  (async function () {
    try {
      if (!H.runCmp || !H.runAb || !H.compress || !H.uhi || !H.teardown || !H.csApply || !H.sc || !H.clearAll) { finish('hook: an entry point is not exported'); return; }
      await main();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
