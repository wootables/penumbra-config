// @@JSON grouping suite - browser half (2026-09-30). Runs ONE scenario (?scn=)
// against whichever main.js the page loaded and publishes
//   window.__JGRESULT = { scn, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__JGDONE = true. run.py collects the asserts.
//
// GROUND TRUTH comes from the fixture (window.__rowsFixture) alone - never from
// the app's own parsing - with the grouping rules the app documents: a row
// joins one band per DISTINCT trimmed SUB_NAME in its nested table, and a row
// with no nested rows (null, [], or a blank value) joins [Blank].
// A rendered row is identified by its '#' cell (= fixture index + 1), and the
// P-* preconditions prove that premise on every run.
(function () {
  var JG = window.__JG || {};
  var SCN = window.__SCN;
  var FX = window.__rowsFixture;
  var R = { scn: SCN, asserts: [], obs: {}, notes: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JG_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function colId(name) { return String(window.__COLS.indexOf(name)); }

  // ---- ground truth ------------------------------------------------------
  function nestedRows(r) {
    if (r.J_SUBS == null) return [];
    var s = String(r.J_SUBS), j = s.indexOf('@@JSON');
    if (j < 0) return [];
    try { var a = JSON.parse(s.substring(j + 6)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function subName(o) { return String(o.SUB_NAME == null ? '' : o.SUB_NAME).trim() || '[Blank]'; }
  function truthNames(r) {
    var a = nestedRows(r);
    if (!a.length) return ['[Blank]'];
    var seen = Object.create(null), out = [];
    a.forEach(function (o) { var v = subName(o); if (!seen[v]) { seen[v] = true; out.push(v); } });
    return out;
  }
  function subAmtAll(r) { return nestedRows(r).reduce(function (s, o) { return s + Number(o.SUB_AMT || 0); }, 0); }
  function subAmtFor(r, name) {   // same-source correlation: only nested rows of THAT name
    return nestedRows(r).reduce(function (s, o) { return s + (subName(o) === name ? Number(o.SUB_AMT || 0) : 0); }, 0);
  }

  // ---- reading the page --------------------------------------------------
  function flatOrder() {   // '#' of every flat data row in DOM order (0 = not a data row)
    var out = [], trs = document.querySelectorAll('#resultsTable tbody tr');
    for (var i = 0; i < trs.length; i++) {
      var h = trs[i].querySelector("td[data-column='#']");
      out.push(h ? parseInt(h.textContent, 10) : 0);
    }
    return out;
  }
  function flatVisibleCount() {
    var n = 0, trs = document.querySelectorAll('#resultsTable tbody tr');
    for (var i = 0; i < trs.length; i++) {
      if (!trs[i].classList.contains('search-hidden') && !trs[i].classList.contains('journal-note-child')) n++;
    }
    return n;
  }
  function readGroups() {
    var out = [];
    var ws = document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]');
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], hdr = w.querySelector(':scope > .group-header');
      var rows = [], trs = w.querySelectorAll('tbody tr');
      for (var t = 0; t < trs.length; t++) {
        var tr = trs[t];
        if (tr.classList.contains('journal-note-child')) continue;
        var h = tr.querySelector("td[data-column='#']");
        var vid = tr.querySelector("td[data-column='" + colId('V_ID') + "']");
        rows.push({ n: h ? parseInt(h.textContent, 10) : NaN, vid: vid ? vid.textContent.trim() : null });
      }
      var agg = w.getAttribute('data-agg-value');
      out.push({
        key: w.getAttribute('data-group-key'), col: w.getAttribute('data-group-col'),
        total: hdr ? $(hdr).data('total-rows') : undefined,
        agg: agg === null ? null : parseFloat(agg), rows: rows
      });
    }
    return out;
  }

  // ---- driving the page the way a user does ------------------------------
  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(400);   // deferred tails: presets (100 ms), a11y nudge
  }
  function pickCustom(id, value) {
    var items = document.querySelectorAll('#' + id + ' .pcs-dropdown .pcs-item'), hit = null, seen = [];
    for (var i = 0; i < items.length; i++) {
      seen.push(items[i].getAttribute('data-value'));
      if (items[i].getAttribute('data-value') === value) hit = items[i];
    }
    if (!hit) throw new Error('#' + id + ' offers no "' + value + '" (offers: ' + seen.join(', ') + ')');
    clickEl(document.querySelector('#' + id + ' .pcs-selected'));   // open it
    clickEl(hit);                                                     // pick
    var got = $('#' + id + ' .pcs-selected').attr('data-value');
    if (got !== value) throw new Error('#' + id + ' holds "' + got + '" after picking "' + value + '"');
  }
  // Group icon -> level-0 picker -> (summary) -> (group sort) -> Apply Grouping.
  async function groupVia(o) {
    clickEl(document.getElementById('groupTableBtn'));   // the real open path seeds every picker
    await sleep(50);
    pickCustom('groupingColumnSelector', o.level0);
    if (o.agg) {
      var cb = document.getElementById('groupAggCheckbox');
      if (!cb.checked) cb.click();                        // toggles + change: adds the summary sort options
      pickCustom('groupAggColumn', o.agg);
      $('#groupAggType').val(o.aggType || 'sum').trigger('change');
    }
    if (o.sort) {
      $('#groupSortSelect').val(o.sort).trigger('change');
      if ($('#groupSortSelect').val() !== o.sort) throw new Error('group sort select refused ' + o.sort);
    }
    R.obs.flatAtApply = flatOrder();                      // what rebuildGroupedView is about to walk
    R.obs.flatVisibleAtApply = flatVisibleCount();
    var before = hides();
    clickEl(document.getElementById('confirmGroupingBtn'));
    await until(function () {
      return hides() > before && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0;
    }, 30000);
    await sleep(300);
  }
  async function clickSort(colName) {
    var th = document.querySelector('#tableHeader th[data-colname="' + colName + '"]');
    if (!th) throw new Error('no header ' + colName);
    clickEl(th);            // <= 500 rows: the handler sorts synchronously
    await sleep(200);
  }
  async function flatSearch(q) {
    var before = hides();
    $('#tableSearch').val(q);
    JG.runTableSearch();
    await until(function () { return hides() > before; }, 30000);
    await sleep(300);
  }

  // ---- assertions --------------------------------------------------------
  function checkMaster(scn) {
    // The '#' premise: masterRowData is the fixture in query order, so '#' n is fixture row n-1.
    var m = JG.master ? JG.master() : null, bad = [];
    if (!m || m.length !== FX.length) { rec('P-' + scn + '-master', false, 'masterRowData length ' + (m ? m.length : 'n/a') + ' vs fixture ' + FX.length); return; }
    for (var i = 0; i < FX.length; i++) if (String(m[i].get('V_ID')) !== FX[i].V_ID) { bad.push(i); if (bad.length > 3) break; }
    rec('P-' + scn + '-master', !bad.length, bad.length ? 'masterRowData out of query order at ' + bad.join(',') : 'masterRowData[i] == fixture[i] for all ' + FX.length);
  }
  function checkRowsAgree(scn, groups) {
    // Every grouped row's own V_ID cell must be fixture['#' - 1] - the '#' cell and the row are one row.
    var bad = [], n = 0;
    groups.forEach(function (g) {
      g.rows.forEach(function (r) {
        n++;
        if (!(r.n >= 1 && r.n <= FX.length) || FX[r.n - 1].V_ID !== r.vid) bad.push(g.key + ':#' + r.n + '=' + r.vid);
      });
    });
    rec('P-' + scn + '-rowid', n > 0 && !bad.length, n ? (bad.length ? bad.slice(0, 4).join('; ') : n + ' grouped rows, each # agrees with its own V_ID') : 'no grouped rows');
  }
  // Level 0 = SUB_NAME: membership, completeness and totals against the fixture.
  function checkNestedGrouping(scn, eligible) {
    var groups = readGroups();
    R.obs.groups = groups.map(function (g) { return g.key + '(' + g.rows.length + ')'; }).join(' ');
    var cols = {}; groups.forEach(function (g) { cols[g.col] = 1; });
    rec('P-' + scn + '-grouped', groups.length >= 3 && Object.keys(cols).join() === 'SUB_NAME',
      groups.length + ' depth-0 bands, data-group-col=' + Object.keys(cols).join('|'));
    checkRowsAgree(scn, groups);
    // M: a row sits only under names its OWN nested table holds.
    var wrong = [], pairs = 0;
    groups.forEach(function (g) {
      g.rows.forEach(function (r) {
        pairs++;
        if (!(r.n >= 1 && r.n <= FX.length)) { wrong.push(g.key + ' <- #' + r.n); return; }
        var names = truthNames(FX[r.n - 1]);
        if (names.indexOf(g.key) === -1) wrong.push(g.key + ' <- #' + r.n + ' (holds ' + names.join('/') + ')');
      });
    });
    rec('M-' + scn, pairs > 0 && !wrong.length, pairs ? (wrong.length ? wrong.length + ' of ' + pairs + ' rows in a band their nested table does not name, e.g. ' + wrong.slice(0, 3).join('; ') : pairs + ' band rows, each under a name its own nested table holds') : 'no band rows');
    // C: every eligible row appears under EACH of its names, exactly once.
    var want = Object.create(null), got = Object.create(null), missing = [], extra = [], dup = [];
    for (var i = 0; i < FX.length; i++) {
      if (!eligible(i)) continue;
      truthNames(FX[i]).forEach(function (nm) { want[nm + '\u0001' + (i + 1)] = 1; });
    }
    groups.forEach(function (g) { g.rows.forEach(function (r) { var k = g.key + '\u0001' + r.n; if (got[k]) dup.push(k); got[k] = 1; }); });
    Object.keys(want).forEach(function (k) { if (!got[k]) missing.push(k.replace('\u0001', ' #')); });
    Object.keys(got).forEach(function (k) { if (!want[k]) extra.push(k.replace('\u0001', ' #')); });
    var nWant = Object.keys(want).length;
    rec('C-' + scn, nWant > 0 && !missing.length && !extra.length && !dup.length,
      (!missing.length && !extra.length && !dup.length) ? nWant + ' (name, row) pairs, all present once' :
        'missing ' + missing.length + ' (' + missing.slice(0, 2).join('; ') + '), extra ' + extra.length + ' (' + extra.slice(0, 2).join('; ') + '), dup ' + dup.length);
    // T: the "of N" denominator = rows in the WHOLE result holding that name.
    var tWant = Object.create(null);
    FX.forEach(function (r) { truthNames(r).forEach(function (nm) { tWant[nm] = (tWant[nm] || 0) + 1; }); });
    var tBad = [];
    groups.forEach(function (g) { if (g.total !== tWant[g.key]) tBad.push(g.key + ' ' + g.total + '!=' + tWant[g.key]); });
    rec('T-' + scn, groups.length > 0 && !tBad.length, tBad.length ? tBad.slice(0, 4).join('; ') : groups.length + ' band totals match the whole-result counts');
    return groups;
  }
  function checkReordered(scn, expectReordered) {
    var fo = R.obs.flatAtApply || [], moved = 0, dataRows = 0;
    for (var p = 0, d = 0; p < fo.length; p++) { if (!fo[p]) continue; dataRows++; if (fo[p] !== d + 1) moved++; d++; }
    R.obs.flatHead = fo.slice(0, 8).join(',');
    if (expectReordered) rec('P-' + scn + '-reordered', dataRows === FX.length && moved > FX.length / 2, moved + ' of ' + dataRows + ' flat rows away from query order when grouping (head ' + R.obs.flatHead + ')');
    else rec('P-' + scn + '-queryorder', dataRows === FX.length && moved === 0, moved + ' of ' + dataRows + ' flat rows moved (head ' + R.obs.flatHead + ')');
  }
  function nonIncreasing(vals) { for (var i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) return i; return -1; }

  var all = function () { return true; };
  var S = {
    // No reorder: the old and new mappings agree - proves the truth model and the read-out.
    plain: async function () {
      await groupVia({ level0: 'SUB_NAME' });
      checkReordered('plain', false);
      checkNestedGrouping('plain', all);
    },
    // A SAVED sort reorders the flat tbody on load; then Group by SUB_NAME.
    sortload: async function () {
      await groupVia({ level0: 'SUB_NAME' });
      checkReordered('sortload', true);
      checkNestedGrouping('sortload', all);
    },
    // A header click reorders the flat tbody; then Group by SUB_NAME.
    clicksort: async function () {
      await clickSort('V_NAME');
      await groupVia({ level0: 'SUB_NAME' });
      checkReordered('clicksort', true);
      checkNestedGrouping('clicksort', all);
    },
    // A saved sort + a flat search: only the matching rows are grouped.
    sortsearch: async function () {
      await flatSearch("V_STATUS = 'Open'");
      var openN = FX.filter(function (r) { return r.V_STATUS === 'Open'; }).length;
      rec('P-sortsearch-search', flatVisibleCount() === openN, flatVisibleCount() + ' flat rows match, fixture has ' + openN + ' Open');
      await groupVia({ level0: 'SUB_NAME' });
      checkReordered('sortsearch', true);
      checkNestedGrouping('sortsearch', function (i) { return FX[i].V_STATUS === 'Open'; });
    },
    // Group by a NORMAL column, summary = a NESTED column, bands sorted by that
    // summary: the pre-sort reads each row's nested values.
    sumsort: async function () {
      await groupVia({ level0: 'V_REGION', agg: 'SUB_AMT', aggType: 'sum', sort: 'summary|desc' });
      checkReordered('sumsort', true);
      var groups = readGroups();
      R.obs.groups = groups.map(function (g) { return g.key + '=' + g.agg; }).join(' ');
      rec('P-sumsort-grouped', groups.length >= 5 && groups.every(function (g) { return g.col === 'V_REGION'; }), groups.length + ' depth-0 bands on V_REGION');
      checkRowsAgree('sumsort', groups);
      var mBad = [];
      groups.forEach(function (g) { g.rows.forEach(function (r) { if (!FX[r.n - 1] || FX[r.n - 1].V_REGION !== g.key) mBad.push(g.key + ' <- #' + r.n); }); });
      rec('M-sumsort', !mBad.length, mBad.length ? mBad.slice(0, 3).join('; ') : 'every band row is in its own region');
      var truth = Object.create(null);
      FX.forEach(function (r) { truth[r.V_REGION] = (truth[r.V_REGION] || 0) + subAmtAll(r); });
      var vBad = groups.filter(function (g) { return g.agg !== truth[g.key]; }).map(function (g) { return g.key + ' ' + g.agg + '!=' + truth[g.key]; });
      rec('V-sumsort', groups.length > 0 && !vBad.length, vBad.length ? vBad.join('; ') : 'each band shows Sum of SUB_AMT = its rows\' nested total');
      var shown = groups.map(function (g) { return g.agg; }), at = nonIncreasing(shown);
      rec('S-sumsort', groups.length > 0 && at === -1, at === -1 ? 'bands run high to low: ' + shown.join(' > ') : 'band ' + at + ' (' + groups[at].key + ' ' + shown[at] + ') above ' + groups[at - 1].key + ' ' + shown[at - 1] + ': ' + shown.join(', '));
    },
    // Both columns nested: group by SUB_NAME, Sum of SUB_AMT, sorted by it.
    // Membership and, since 2026-10-01, the ORDER are asserted: the pre-sort ranks
    // on the correlated value the band shows (it was only observed before the fix).
    sumsortboth: async function () {
      await groupVia({ level0: 'SUB_NAME', agg: 'SUB_AMT', aggType: 'sum', sort: 'summary|desc' });
      checkReordered('sumsortboth', true);
      var groups = checkNestedGrouping('sumsortboth', all);
      var corr = Object.create(null), loose = Object.create(null);
      FX.forEach(function (r) {
        truthNames(r).forEach(function (nm) {
          corr[nm] = (corr[nm] || 0) + subAmtFor(r, nm);
          loose[nm] = (loose[nm] || 0) + subAmtAll(r);
        });
      });
      var vBad = groups.filter(function (g) { return (g.agg === null ? 0 : g.agg) !== corr[g.key]; }).map(function (g) { return g.key + ' ' + g.agg + '!=' + corr[g.key]; });
      rec('V-sumsortboth', groups.length > 0 && !vBad.length, vBad.length ? vBad.join('; ') : 'each band shows the Sum of its OWN name\'s SUB_AMT');
      var shown = groups.map(function (g) { return g.agg === null ? 0 : g.agg; });
      R.obs.orderShown = shown.join(', ');
      R.obs.orderMonotonic = nonIncreasing(shown) === -1;
      R.obs.orderByLoose = nonIncreasing(groups.map(function (g) { return loose[g.key]; })) === -1;
      R.obs.looseTotals = groups.map(function (g) { return g.key + '=' + loose[g.key]; }).join(' ');
      var at = nonIncreasing(shown);
      rec('S-sumsortboth', groups.length > 0 && at === -1, at === -1 ? 'bands run high to low by what they show: ' + shown.slice(0, 6).join(' > ') + (shown.length > 6 ? ' ...' : '')
        : 'band ' + at + ' (' + groups[at].key + ' ' + shown[at] + ') above ' + groups[at - 1].key + ' ' + shown[at - 1] + ' - ranked on the loose totals ' + loose[groups[at].key] + ' vs ' + loose[groups[at - 1].key]);
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      checkMaster(SCN);
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__JG_ERR, window.__JG_ERR2].filter(Boolean).join('; ');
    R.missing = window.__JG_MISSING || [];
    window.__JGRESULT = R;
    window.__JGDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
