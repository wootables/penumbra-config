// ldsort suite - browser half (2026-10-23). Runs ONE scenario (?scn=) against the main.js the page loaded and
// publishes window.__HCRESULT = { scn, chk: {name: bool}, info: {...}, errors: [...] } and window.__HCDONE = true.
// The stored report (harness.html) carries a SAVED sort whose colIndex - the column's place when it was saved - is
// stale: the report's SQL has moved the column since (or dropped it, or renamed it in place). run.py asserts every
// chk (L-*) and no page errors (E-*); on the live build before the fix the NEW checks are red, the GUARDs green.
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function J(x) { return JSON.stringify(x); }

  // ---- the page's sort ---------------------------------------------------------------------------------------
  // [name, place, direction] per level, the place as a heading's data-column reads
  function sortNow() { return J((HC.getSort() || []).map(function (c) { return [String(c.colIdentifier), String(c.colIndex), c.direction]; })); }
  function sortRaw() { return HC.getSort() || []; }
  // the sort NOTICEs show_text was handed (the hook records every call)
  function notices() { return (window.__NOTICES || []).filter(function (t) { return /Sort dropped for column/.test(t); }); }
  function txt(html) { var d = document.createElement('div'); d.innerHTML = html; return String(d.textContent || '').replace(/\s+/g, ' ').trim(); }

  // ---- the flat table ----------------------------------------------------------------------------------------
  function fTh(name) { return document.querySelector('#tableHeader > th[data-colname="' + name + '"]'); }
  // a column's place (its heading's data-column), by name
  function colOf(name) { var th = fTh(name); return th ? th.getAttribute('data-column') : null; }
  function cellOf(r, col) { var td = r.querySelector(':scope > td[data-column="' + col + '"]'); return td ? String(td.textContent).trim() : ''; }
  function val(r, name) { return cellOf(r, colOf(name)); }
  function num(r, name) { return parseFloat(val(r, name).replace(/[$,\s]/g, '')); }
  function amt(r) { return num(r, 'V_AMOUNT'); }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  // the flat rows on screen: the page applyPagination shows
  function flatShown() { return flatRows().filter(function (r) { return r.style.display !== 'none' && !r.classList.contains('search-hidden'); }); }
  // a flat row's number: its '#' cell (always filled - a lazy row's other cells are empty until it is prepared)
  function rowNo(r) { return r.cells[0] ? parseInt(r.cells[0].textContent, 10) : NaN; }
  function flatNos() { return flatRows().map(rowNo); }
  // the report's own order: 1..300
  function naturalNos() { return (window.__rowsFixture || []).map(function (r, i) { return i + 1; }); }
  // the flat table's sort marks: column:aria-sort[:rank] of every marked heading, in page order
  function fMarks() {
    return Array.prototype.map.call(document.querySelectorAll('#tableHeader > th.sorted'), function (t) {
      var r = t.querySelector('.sort-rank');
      return t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort') + (r ? ':' + r.textContent : '');
    });
  }
  // rows in order by a chain of [key(row), dir] levels (dir 1 ascending, -1 descending); text compares as the sort does
  function inOrder(rows, levels) {
    for (var i = 1; i < rows.length; i++) {
      for (var k = 0; k < levels.length; k++) {
        var a = levels[k][0](rows[i - 1]), b = levels[k][0](rows[i]);
        if (typeof a === 'number' && (isNaN(a) || isNaN(b))) return false;   // a cell with no number (not filled): no order
        var c = (typeof a === 'number' && typeof b === 'number') ? (a - b) : String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
        if (c * levels[k][1] > 0) return false;   // the earlier row sorts after the later one
        if (c !== 0) break;
      }
    }
    return rows.length > 1;
  }
  function clickTh(th, shift) { if (!th) return false; th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!shift })); return true; }

  // ---- the grouped view --------------------------------------------------------------------------------------
  function top() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]')); }
  function leaves() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper.group-leaf')); }
  function leafTbody(w) { var t = w.querySelector(':scope > .group-content > table'); return t ? (t.tBodies[0] || null) : null; }
  // a leaf's V_AMOUNT in order: ascending (dir 1) or descending (-1)
  function amountsSorted(w, dir) {
    var tb = leafTbody(w), col = colOf('V_AMOUNT'); if (!tb) return false;
    var v = Array.prototype.map.call(tb.rows, function (r) { return parseFloat(cellOf(r, col).replace(/[$,\s]/g, '')); });
    for (var i = 1; i < v.length; i++) { if (isNaN(v[i]) || isNaN(v[i - 1]) || (v[i] - v[i - 1]) * dir < 0) return false; }
    return v.length > 0;
  }
  function gMarks() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer th.sorted'), function (t) {
      var r = t.querySelector('.sort-rank');
      return t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort') + (r ? ':' + r.textContent : '');
    });
  }
  function setPcs(id, v) { $('#' + id + ' .pcs-selected').attr('data-value', v).text(v); }
  // the grouping dialog's Apply, grouped by H_GROUP (summed H_AMT), Stacked: done when it has drawn and the overlay is down
  async function applyGrp() {
    setPcs('groupingColumnSelector', 'H_GROUP'); setPcs('groupingColumnSelector2', ''); setPcs('groupingColumnSelector3', '');
    $('#groupAggCheckbox').prop('checked', true); setPcs('groupAggColumn', 'H_AMT'); $('#groupAggType').val('sum');
    $('#groupSortSelect').val('label|asc'); $('#groupLimitDir').val('top'); $('#groupLimitN').val(''); $('#groupLimitMinRows').val('');
    $('#groupLimitOther').prop('checked', true); $('#groupStartDepth').val('0'); $('#groupLayout').val('stacked');
    $('#groupingLightbox').show();
    var n0 = window.__REBUILDS || 0, h0 = hides();
    $('#confirmGroupingBtn').trigger('click');
    var ok = await until(function () { return (window.__REBUILDS || 0) > n0 && hides() > h0; }, 20000);
    await sleep(300); await frames(4);
    return ok;
  }
  // Remove Grouping (the control bar's link): done when the flat table is back and the overlay down
  async function removeGrp() {
    var h0 = hides();
    $('#removeGroupingLink').trigger('click');
    var ok = await until(function () { return !$('#groupedResultsContainer').is(':visible') && $('#resultsTable').is(':visible') && hides() > h0; }, 20000);
    await sleep(300); await frames(4);
    return ok;
  }
  // a re-run of the query (the Run button: a prompt answer runs the same path), optionally with other rows
  async function requery(data) {
    if (data) window.__queryResponse = { data: data };
    var q0 = window.__queryDone, h0 = hides();
    $('#executeQuery').trigger('click');
    var ok = await until(function () { return window.__queryDone > q0 && hides() > h0 && $('#resultsTable').is(':visible') && flatRows().length === 300; }, 60000);
    await sleep(600); await frames(4);
    return ok;
  }

  async function boot() {
    var grouped = SCN === 'group' || SCN === 'pivotgrp', pivot = SCN === 'pivot';
    var ok = await until(function () {
      if (window.__queryDone < 1 || hides() < 1) return false;
      if (pivot) return !!document.getElementById('pivotResultTable') && $('#pivot-output-container').is(':visible');
      if (grouped) return top().length >= 6 && $('#groupedResultsContainer').is(':visible');
      return $('#resultsTable').is(':visible') && flatRows().length === 300;
    }, 150000);
    if (!ok) throw new Error('boot: the report never finished loading (150 s)');
    await sleep(pivot ? 900 : 500); await frames(4);
  }

  // the fixture's rows, sorted the way the expected order is
  function byAmount(rows, dir) { return rows.slice().sort(function (a, b) { return (amt(a) - amt(b)) * dir; }); }
  function info(extra) {
    var rows = flatRows();
    R.info = Object.assign({ sort: sortNow(), marks: fMarks(), gmarks: gMarks().slice(0, 3), gmarksN: gMarks().length,
      first: rows.slice(0, 4).map(function (r) { return [val(r, 'V_ID'), val(r, 'V_NAME'), val(r, 'V_AMOUNT')]; }),
      notices: (window.__NOTICES || []).map(txt).slice(0, 6) }, extra || {});
  }

  var S = {
    // NEW: the report's saved V_AMOUNT sort at its old place (1, V_NAME's now) follows V_AMOUNT by name: the rows,
    // the marks, page 1; then a grouping Apply and Remove Grouping keep it (the page's re-sorts take it: its place
    // and its name agree now)
    flat: async function () {
      var rows = flatRows(), want = byAmount(rows, -1).slice(0, 200), shown = flatShown();
      R.chk.sortByName = sortNow() === J([['V_AMOUNT', '2', 'desc']]);
      R.chk.rowsByName = inOrder(rows, [[amt, -1]]);
      R.chk.marksByName = J(fMarks()) === J(['V_AMOUNT:descending']);
      R.chk.page1 = shown.length === 200 && shown.every(function (r, i) { return amt(r) === amt(want[i]); });
      R.chk.noNotice = notices().length === 0;
      var ap = await applyGrp(), lv = leaves(), gm = gMarks();
      R.chk.regroupSorted = ap && lv.length >= 6 && lv.every(function (w) { return amountsSorted(w, -1); });
      R.chk.regroupMarks = gm.length >= lv.length && gm.every(function (x) { return x === 'V_AMOUNT:descending'; });
      var rm = await removeGrp();
      R.chk.removeSorted = rm && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      info({ ap: ap, rm: rm, leaves: lv.length });
    },
    // NEW: a grouped report (H_GROUP) saved with the same stale sort: every group's table by V_AMOUNT, marked; a
    // regroup (the dialog's Apply draws from the flat rows, which the grouped load never sorted) re-sorts by it - the
    // gate wants the place and the name to agree; Remove Grouping sorts the flat rows by it
    group: async function () {
      var lv0 = leaves(), m0 = gMarks();
      R.chk.sortByName = sortNow() === J([['V_AMOUNT', '2', 'desc']]);
      R.chk.groupsByName = lv0.length >= 6 && lv0.every(function (w) { return amountsSorted(w, -1); });
      R.chk.groupMarks = m0.length >= lv0.length && m0.every(function (x) { return x === 'V_AMOUNT:descending'; });
      R.chk.noNotice = notices().length === 0;
      var ap = await applyGrp(), lv1 = leaves(), m1 = gMarks();
      R.chk.regroupKeeps = ap && lv1.length >= 6 && lv1.every(function (w) { return amountsSorted(w, -1); })
        && m1.length >= lv1.length && m1.every(function (x) { return x === 'V_AMOUNT:descending'; });
      var rm = await removeGrp();
      R.chk.removeKeeps = rm && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      info({ ap: ap, rm: rm, leaves: [lv0.length, lv1.length] });
    },
    // NEW: two levels, both at stale places (V_STATUS saved at 4, V_AMOUNT at 1)
    multi: async function () {
      var st = function (r) { return val(r, 'V_STATUS'); };
      R.chk.sortByName = sortNow() === J([['V_STATUS', '5', 'asc'], ['V_AMOUNT', '2', 'desc']]);
      R.chk.rowsByName = inOrder(flatRows(), [[st, 1], [amt, -1]]);
      R.chk.marksByName = J(fMarks()) === J(['V_AMOUNT:descending:2', 'V_STATUS:ascending:1']);
      R.chk.noNotice = notices().length === 0;
      info();
    },
    // NEW: the SQL dropped H_GONE (saved at 1, with V_AMOUNT at 3; the report had 21 columns then, 20 now): its level
    // goes, with the re-query's NOTICE naming it; V_AMOUNT follows its name
    gone: async function () {
      var n = notices();
      R.chk.dropped = sortNow() === J([['V_AMOUNT', '2', 'desc']]);
      R.chk.notice = n.length === 1 && txt(n[0]) === 'NOTICE: Sort dropped for column no longer in this query: H_GONE.';
      R.chk.rowsByName = inOrder(flatRows(), [[amt, -1]]);
      R.chk.marksByName = J(fMarks()) === J(['V_AMOUNT:descending']);
      info();
    },
    // NEW: every level's column gone: no sort, the report's own order, no marks, one NOTICE naming both
    allgone: async function () {
      var n = notices();
      R.chk.emptied = sortNow() === '[]';
      R.chk.natural = J(flatNos()) === J(naturalNos());
      R.chk.unmarked = fMarks().length === 0;
      R.chk.notice = n.length === 1 && txt(n[0]) === 'NOTICE: Sort dropped for columns no longer in this query: H_GONE, H_GONE2.';
      var a = flatNos(), b = naturalNos(), at = -1;
      for (var i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] !== b[i]) { at = i; break; } }
      info({ lens: [a.length, b.length], firstDiff: at, here: at >= 0 ? a.slice(at, at + 3) : null, want: at >= 0 ? b.slice(at, at + 3) : null });
    },
    // V_AMOUNT was V_AMT_OLD when saved (renamed in place: as many columns now as then): the sort stays at its place,
    // as it always has (GUARD), no NOTICE (GUARD), and takes the column's name (NEW): a click on the heading goes on to
    // descending - with the old name the click started over at ascending
    renamed: async function () {
      R.chk.keptByPlace = inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.noNotice = notices().length === 0;
      R.chk.healed = sortNow() === J([['V_AMOUNT', '2', 'asc']]);
      var s0 = sortNow();
      clickTh(fTh('V_AMOUNT')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      info({ s0: s0 });
    },
    // NEW: ...and a re-run (a prompt answer, Run) carries it by its name: with the old one the carry-over dropped it
    renamedrq: async function () {
      var rq = await requery();
      R.chk.requeryKeeps = rq && sortNow() === J([['V_AMOUNT', '2', 'asc']]) && inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.requeryNoNotice = notices().length === 0;
      info({ rq: rq });
    },
    // an old save's name in the SQL's own case ('v_Amount', at the right place): sorted and marked as always (GUARD),
    // under its heading's name (NEW): a click goes on to descending
    casename: async function () {
      R.chk.keptByPlace = inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.noNotice = notices().length === 0;
      R.chk.healed = sortNow() === J([['V_AMOUNT', '2', 'asc']]);
      clickTh(fTh('V_AMOUNT')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      info();
    },
    // NEW: a column named 2021 (saved by a click as the NUMBER 2021, at place 3; it is first in the result now): by
    // name, in the form a click on its heading gives (the number), so a click on it goes on to descending
    numname: async function () {
      var y = function (r) { return num(r, '2021'); };
      var raw = sortRaw()[0] || {};
      R.chk.sortByName = sortNow() === J([['2021', '0', 'asc']]);
      R.chk.numberForm = raw.colIdentifier === 2021;
      R.chk.rowsByName = inOrder(flatRows(), [[y, 1]]);
      R.chk.marksByName = J(fMarks()) === J(['2021:ascending']);
      R.chk.noNotice = notices().length === 0;
      clickTh(fTh('2021')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['2021', '0', 'desc']]) && inOrder(flatRows(), [[y, -1]]) && J(fMarks()) === J(['2021:descending']);
      info({ type: typeof raw.colIdentifier, at: colOf('2021') });
    },
    // GUARD: '#' is no column of the result and is kept as it is (the row numbers, descending)
    hash: async function () {
      R.chk.hashKept = sortNow() === J([['#', '#', 'desc']]) && J(flatNos()) === J(naturalNos().slice().reverse())
        && J(fMarks()) === J(['#:descending']) && notices().length === 0;
      info();
    },
    // a journal column's level is kept as it is (GUARD); the V_AMOUNT level after it follows its name (NEW)
    journal: async function () {
      var raw = sortRaw()[0] || {};
      R.chk.virtualKept = raw.colIdentifier === '__JOURNAL_TOGGLE__toggle1' && raw.colIndex === '__JOURNAL_TOGGLE__toggle1' && raw.direction === 'asc'
        && notices().length === 0;
      R.chk.sortByName = sortNow() === J([['__JOURNAL_TOGGLE__toggle1', '__JOURNAL_TOGGLE__toggle1', 'asc'], ['V_AMOUNT', '2', 'desc']]);
      R.chk.rowsByName = inOrder(flatRows(), [[amt, -1]]);
      info();
    },
    // GUARD: a link's ?sort= takes the load's sort over (the saved one names a gone column): the link's sort, and no
    // NOTICE about the saved one it replaced
    urlsort: async function () {
      var nm = function (r) { return val(r, 'V_NAME'); };
      R.chk.urlWins = sortNow() === J([['V_NAME', '1', 'desc']]) && inOrder(flatRows(), [[nm, -1]]) && J(fMarks()) === J(['V_NAME:descending']);
      R.chk.noNotice = notices().length === 0;
      info();
    },
    // GUARD: a pivot's chain names the pivot's own headings: it reaches the pivot branch's replay as saved
    pivot: async function () {
      var rp = window.__REPLAYS || [];
      R.chk.chainAsSaved = rp.length >= 1 && J(rp[0]) === J([{ colIdentifier: 'Open::Sum', colIndex: 3, direction: 'desc' }]);
      R.chk.noNotice = notices().length === 0;
      info({ replays: rp.slice(0, 2), heads: Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable thead th')).slice(0, 8).map(function (t) { return String(t.textContent).trim(); }) });
    },
    // GUARD: the re-query carry-over, unchanged - a click's sort on V_AMOUNT, then a re-run whose SQL put a column in
    // front: the sort follows V_AMOUNT to its new place
    requery: async function () {
      clickTh(fTh('V_AMOUNT')); await sleep(300); await frames(2);
      var s0 = sortNow();
      var moved = (window.__rowsFixture || []).map(function (r, i) { var o = { V_NEW: 'N' + i }; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); return o; });
      var rq = await requery(moved);
      R.chk.carried = s0 === J([['V_AMOUNT', '2', 'asc']]) && rq && colOf('V_AMOUNT') === '3' && sortNow() === J([['V_AMOUNT', '3', 'asc']])
        && inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.noNotice = notices().length === 0;
      info({ s0: s0, rq: rq, at: colOf('V_AMOUNT') });
    },
    // NEW: a level renamed in place whose place another level names (V_AMOUNT by name at 2; V_OLD saved at 2): it
    // cannot be that column - dropped, with the NOTICE, rather than a second level on V_AMOUNT
    taken: async function () {
      var n = notices();
      R.chk.sortByName = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[amt, -1]]);
      R.chk.notice = n.length === 1 && txt(n[0]) === 'NOTICE: Sort dropped for column no longer in this query: V_OLD.';
      info();
    },
    // GUARD: two columns share a name but for its case (V_AMOUNT at 2, v_amount at 3; both headings read V_AMOUNT):
    // the level saved at 2 stays at 2 - by name alone it went to the last of them
    casedup: async function () {
      var at2 = function (r) { return parseFloat(cellOf(r, '2').replace(/[$,\s]/g, '')); };
      var marked = Array.prototype.map.call(document.querySelectorAll('#tableHeader > th.sorted'), function (t) { return t.getAttribute('data-column') + ':' + t.getAttribute('aria-sort'); });
      R.chk.atItsPlace = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[at2, -1]]) && J(marked) === J(['2:descending']);
      R.chk.noNotice = notices().length === 0;
      info({ marked: marked, sameName: document.querySelectorAll('#tableHeader > th[data-colname="V_AMOUNT"]').length });
    },
    // NEW (2026-10-25, urlnum): a link's ?sort=2021|desc - the URL resolver names the level as a click on the heading
    // does, the NUMBER 2021 (it was the text '2021', pinned here as a GUARD), and it passes as it is: sorted, marked,
    // and the next click takes it off (as text the click started over at ascending)
    numurl: async function () {
      var y = function (r) { return num(r, '2021'); }, raw = sortRaw()[0] || {};
      R.chk.urlNumber = sortNow() === J([['2021', '0', 'desc']]) && raw.colIdentifier === 2021 && inOrder(flatRows(), [[y, -1]]) && J(fMarks()) === J(['2021:descending']);
      R.chk.noNotice = notices().length === 0;
      var t0 = typeof raw.colIdentifier;
      clickTh(fTh('2021')); await sleep(300); await frames(2);
      R.chk.clickOff = sortNow() === '[]' && J(flatNos()) === J(naturalNos()) && fMarks().length === 0;
      info({ type: t0 });
    },
    // the column named 2021 was Y_OLD when saved (renamed in place): kept at its place (GUARD), under the name a click
    // gives it - the NUMBER 2021 (NEW) - so a click on it goes on to descending (NEW)
    numrenamed: async function () {
      var y = function (r) { return num(r, '2021'); }, raw = sortRaw()[0] || {};
      R.chk.keptByPlace = inOrder(flatRows(), [[y, 1]]) && J(fMarks()) === J(['2021:ascending']) && notices().length === 0;
      R.chk.numberForm = raw.colIdentifier === 2021 && sortNow() === J([['2021', '0', 'asc']]);
      clickTh(fTh('2021')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['2021', '0', 'desc']]) && inOrder(flatRows(), [[y, -1]]) && J(fMarks()) === J(['2021:descending']);
      info({ type: typeof raw.colIdentifier });
    },
    // (2026-10-25, urlnum) a level saved as the TEXT '2021' at its place (a save made from a ?sort= view before
    // urlnum): sorted and marked as always (GUARD), in the form a click on the heading gives - the NUMBER 2021 (NEW) -
    // so a click on it goes on to descending (NEW)
    numsaved: async function () {
      var y = function (r) { return num(r, '2021'); }, raw = sortRaw()[0] || {};
      R.chk.numberForm = raw.colIdentifier === 2021 && sortNow() === J([['2021', '0', 'asc']]);
      R.chk.rowsByName = inOrder(flatRows(), [[y, 1]]);
      R.chk.marksByName = J(fMarks()) === J(['2021:ascending']);
      R.chk.noNotice = notices().length === 0;
      var t0 = typeof raw.colIdentifier;
      clickTh(fTh('2021')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['2021', '0', 'desc']]) && inOrder(flatRows(), [[y, -1]]) && J(fMarks()) === J(['2021:descending']);
      info({ type: t0 });
    },
    // renamed in place while this viewer has a calculated column of their own (a save leaves it out): the columns a
    // save keeps are as many as the report saved, so the level stays at its place (GUARD: as always), with no NOTICE
    // (GUARD), under its column's name (NEW)
    mycalc: async function () {
      R.chk.calcThere = colOf('MYCALC') !== null;
      R.chk.keptByPlace = inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.noNotice = notices().length === 0;
      R.chk.healed = sortNow() === J([['V_AMOUNT', '2', 'asc']]);
      info({ calc: colOf('MYCALC') });
    },
    // NEW: a level with no name is left out (it said nothing to resolve); V_AMOUNT follows its name; no NOTICE (GUARD)
    nameless: async function () {
      R.chk.leftOut = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      R.chk.noNotice = notices().length === 0;
      info();
    },
    // NEW: two levels on one column - the second adds nothing to the order (the build before marked the heading with
    // its direction, over rows in the first's): one level, and a click on it goes on to descending
    dup: async function () {
      R.chk.oneLevel = sortNow() === J([['V_AMOUNT', '2', 'asc']]) && inOrder(flatRows(), [[amt, 1]]) && J(fMarks()) === J(['V_AMOUNT:ascending']);
      R.chk.noNotice = notices().length === 0;
      clickTh(fTh('V_AMOUNT')); await sleep(300); await frames(2);
      R.chk.clickDesc = sortNow() === J([['V_AMOUNT', '2', 'desc']]) && inOrder(flatRows(), [[amt, -1]]) && J(fMarks()) === J(['V_AMOUNT:descending']);
      info();
    },
    // GUARD: a pivot report whose viewer pinned a grouping to run on load: the pivot's chain is left as saved (by name
    // and by its place in the pivot's cells it names no report column)
    pivotgrp: async function () {
      R.chk.grouped = top().length >= 6 && !document.getElementById('pivotResultTable');
      R.chk.chainAsSaved = sortNow() === J([['Open::Sum', '3', 'desc']]);
      R.chk.noNotice = notices().length === 0;
      info({ replays: (window.__REPLAYS || []).length });
    }
  };

  (async function () {
    try {
      window.__STEP = 'boot';
      await boot();
      window.__STEP = 'scenario';
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
      try { info(); } catch (x) { }
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2, window.__HC_ERR3, window.__HC_ERR4].filter(Boolean).join('; ');
    R.missing = window.__HC_MISSING || [];
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
