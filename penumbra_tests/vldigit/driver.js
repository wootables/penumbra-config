// vldigit suite - browser half (2026-10-25). Runs ONE scenario (?scn=) against the main.js the page
// loaded and publishes window.__VDRESULT = { scn, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__VDDONE = true. run.py collects the asserts (and, for gB, compares with gA's).
//
// The fixture's column 2021 is named only in digits, as a PIVOT query's is: jQuery's data('colname')
// hands its heading back as the NUMBER 2021, and a click on that heading keeps the number as the sort
// level's colIdentifier (P-* proves both on every run).
//   gA  a report grouped by V_STATUS, sorted by clicks on its headings: 2021 (twice: descending), then
//       Shift+click V_NAME (the second level). The view's link is built (Copy a link to this view).
//   gB  that link opened on the report (flat, no sort of its own): grouped, sorted 2021 desc then V_NAME,
//       2021's level still the NUMBER, marked on every group's heading, the rows in that order; the next
//       click on 2021 takes its level off (as on gA); the view captured again (run.py compares it).
//   gC  the link's validator on its own (tokens made by run.py): a level naming its column by a finite
//       number is kept as that number, text as before; tag-shaped / oversized / empty text and any other
//       kind of value (array, true, null, object, Infinity, none) refused. A pivot view's level likewise.
(function () {
  var JG = window.__JG || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [], obs: {}, notes: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail).slice(0, 700) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  function hides() { return window.__VD_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function S(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  function V() { return window.PenumbraViewLink; }
  function bodyText() { return document.body.innerText || ''; }

  // ---- the page's sort: [identifier, its type, direction, place] per level ----------------------------
  function sortRaw() { return (JG.sortCrit && JG.sortCrit()) || []; }
  function sortNow() { return sortRaw().map(function (c) { return [c.colIdentifier, typeof c.colIdentifier, c.direction, c.colIndex]; }); }
  // the place of a column (its flat heading's data-column)
  function colOf(name) { var th = document.querySelector('#tableHeader > th[data-colname="' + name + '"]'); return th ? th.getAttribute('data-column') : null; }

  // ---- the grouped view -------------------------------------------------------------------------------
  function bands() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]'), function (w) {
      return { key: w.getAttribute('data-group-key'), col: w.getAttribute('data-group-col') };
    });
  }
  function leafTables() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper.group-leaf'), function (w) {
      return w.querySelector(':scope > .group-content > table');
    }).filter(Boolean);
  }
  // every group table's heading for a column
  function gThs(name) { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer th[data-colname="' + name + '"]')); }
  // the marked headings of the grouped view: column:aria-sort[:rank], one entry per distinct mark
  function gMarks() {
    var seen = Object.create(null), out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#groupedResultsContainer th.sorted'), function (t) {
      var r = t.querySelector('.sort-rank');
      var m = t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort') + (r ? ':' + r.textContent : '');
      if (!seen[m]) { seen[m] = 1; out.push(m); }
    });
    return out;
  }
  function cellText(tr, name) { var td = tr.querySelector(':scope > td[data-column="' + colOf(name) + '"]'); return td ? String(td.textContent).trim() : null; }
  // each group's rows in order by 2021 descending, ties by V_NAME ascending (as the sort compares text)
  function rowsInOrder() {
    var bad = [], nRows = 0, nTables = 0, tied = 0;
    leafTables().forEach(function (t) {
      var trs = Array.prototype.slice.call((t.tBodies[0] || { rows: [] }).rows);
      nTables++; nRows += trs.length;
      for (var i = 1; i < trs.length; i++) {
        var a = parseFloat(cellText(trs[i - 1], '2021')), b = parseFloat(cellText(trs[i], '2021'));
        var na = cellText(trs[i - 1], 'V_NAME'), nb = cellText(trs[i], 'V_NAME');
        if (isNaN(a) || isNaN(b)) { bad.push('no number at row ' + i); continue; }
        if (a < b) bad.push(a + ' before ' + b);
        else if (a === b) { tied++; if (String(na).localeCompare(String(nb), undefined, { sensitivity: 'base' }) > 0) bad.push(na + ' before ' + nb + ' (2021 = ' + a + ')'); }
      }
    });
    return { ok: nTables >= 3 && nRows === 60 && tied > 0 && !bad.length, tables: nTables, rows: nRows, tied: tied, bad: bad.slice(0, 4) };
  }
  function clickTh(th, shift) { if (!th) return false; th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: !!shift })); return true; }
  async function settle() { await sleep(400); await frames(4); }

  async function boot() {
    var ok = await until(function () {
      if (window.__queryDone < 1 || hides() < 1) return false;
      if (SCN === 'gA' || SCN === 'gB') return $('#groupedResultsContainer').is(':visible') && leafTables().length >= 3;
      return $('#resultsTable').is(':visible') && document.querySelectorAll('#resultsTable > tbody > tr').length === 60;
    }, 120000);
    if (!ok) throw new Error('boot: the report never finished loading (120 s): ' + S({ q: window.__queryDone, h: hides(), errs: errs().slice(-4), grouped: $('#groupedResultsContainer').is(':visible') }));
    await sleep(600); await frames(4);
  }
  // the premise on every grouped page: data() hands the 2021 heading back as the number
  function premise() {
    var ths = gThs('2021'), dv = ths.length ? $(ths[0]).data('colname') : undefined;
    rec('P-' + SCN, ths.length >= 3 && dv === 2021 && typeof dv === 'number' && (window.__rowsFixture || []).length === 60,
      'grouped 2021 headings ' + ths.length + '; data(colname) = ' + S(dv) + ' (' + typeof dv + ')');
  }
  // the view the page would link to now (the real builder), decoded as the opened page decodes it
  function captureView() {
    var b = V().build();
    R.obs.build = { error: b.error || null, len: b.url ? b.url.length : 0, included: b.included, dropped: b.dropped };
    return { token: b.token || null, view: b.token ? V().decode(b.token) : null, built: b.view || null, url: b.url || null };
  }

  async function scnA() {
    premise();
    // 2021 asc -> desc (plain clicks), then V_NAME as the next level (Shift+click)
    clickTh(gThs('2021')[0]); await settle();
    clickTh(gThs('2021')[0]); await settle();
    clickTh(gThs('V_NAME')[0], true); await settle();
    var want = [[2021, 'number', 'desc', 0], ['V_NAME', 'string', 'asc', 3]];
    var now = sortNow(), ord = rowsInOrder(), mk = gMarks();
    rec('A-click', S(now) === S(want) && ord.ok && S(mk) === S(['2021:descending:1', 'V_NAME:ascending:2']),
      'sort ' + S(now) + ' want ' + S(want) + '; rows ' + S(ord) + '; marks ' + S(mk));
    var cap = captureView();
    R.obs.token = cap.token; R.obs.view = cap.view; R.obs.url = cap.url;
    var v = cap.view || {}, sc = (v.sc || []).map(function (c) { return [c.colIdentifier, typeof c.colIdentifier, c.direction, c.colIndex]; });
    rec('A-built', !!cap.token && !R.obs.build.error && v.m === 'group' && !!v.g && v.g.by === 'V_STATUS', 'build ' + S(R.obs.build) + '; m ' + v.m + '; g ' + S(v.g));
    // NEW: the link carries the 2021 level - the number a click keeps - and the next level
    rec('A-carries', S(sc) === S(want), 'link sort ' + S(sc) + ' want ' + S(want));
    // GUARD: the next click on 2021 takes its level off (what gB's click must do too)
    clickTh(gThs('2021')[0]); await settle();
    R.obs.afterClick = sortNow();
    rec('A-nextClick', S(R.obs.afterClick) === S([['V_NAME', 'string', 'asc', 3]]) && S(gMarks()) === S(['V_NAME:ascending']),
      'after a click on 2021: ' + S(R.obs.afterClick) + '; marks ' + S(gMarks()));
  }

  async function scnB() {
    premise();
    var applied = V().active() && S(bands().map(function (b) { return b.col; }).filter(function (c, i, a) { return a.indexOf(c) === i; })) === S(['V_STATUS']);
    await until(function () { return bodyText().indexOf('Opened a shared view') >= 0; }, 6000);
    // GUARD: the link applies (grouped by V_STATUS)
    rec('B-applied', applied && bodyText().indexOf('Opened a shared view') >= 0, 'active ' + V().active() + '; bands ' + S(bands()));
    var want = [[2021, 'number', 'desc', 0], ['V_NAME', 'string', 'asc', 3]];
    var now = sortNow();
    R.obs.sortAtOpen = now;
    // NEW: the link's 2021 level is on the page as the NUMBER (a header click's value), then V_NAME
    rec('B-sort', S(now) === S(want), 'sort ' + S(now) + ' want ' + S(want));
    // NEW: marked on every group's headings: 2021 first, descending; V_NAME second
    var mk = gMarks(), th21 = gThs('2021');
    var allMarked = th21.length >= 3 && th21.every(function (t) { return t.classList.contains('sorted') && t.getAttribute('aria-sort') === 'descending'; });
    rec('B-marked', allMarked && S(mk) === S(['2021:descending:1', 'V_NAME:ascending:2']), 'marks ' + S(mk) + '; 2021 headings marked ' + th21.filter(function (t) { return t.classList.contains('sorted'); }).length + '/' + th21.length);
    // NEW: each group's rows by 2021 descending, ties by V_NAME
    var ord = rowsInOrder();
    rec('B-rows', ord.ok, S(ord));
    // the view captured again (run.py compares it with gA's)
    var cap = captureView();
    R.obs.view = cap.view;
    // NEW: the next click on 2021 finds its level (the same value) and takes it off, as on gA
    clickTh(gThs('2021')[0]); await settle();
    R.obs.afterClick = sortNow();
    rec('B-nextClick', S(R.obs.afterClick) === S([['V_NAME', 'string', 'asc', 3]]) && S(gMarks()) === S(['V_NAME:ascending']),
      'after a click on 2021: ' + S(R.obs.afterClick) + '; marks ' + S(gMarks()));
  }

  async function scnC() {
    var P = new URLSearchParams(location.search);
    var dg = V().decode(P.get('t1') || ''), dp = V().decode(P.get('t2') || '');
    // each input level carries its place in the input list as its colIndex: what came through, by kind
    var got = ((dg && dg.sc) || []).map(function (c) { return [c.colIndex, c.colIdentifier, typeof c.colIdentifier, c.direction]; });
    R.obs.decoded = got;
    var by = Object.create(null); got.forEach(function (g) { by[g[0]] = g; });
    var keptNums = [[0, 2021, 'number', 'desc'], [2, 0, 'number', 'asc'], [3, -1.5, 'number', 'desc']];
    var keptText = [[1, '2022', 'string', 'asc'], [4, 'V_NAME', 'string', 'asc']];
    var keptAll = [keptNums[0], keptText[0], keptNums[1], keptNums[2], keptText[1]];
    rec('C-decoded', !!dg && dg.m === 'group' && !!dg.g && dg.g.by === 'V_STATUS', 'view ' + S(dg && { m: dg.m, g: dg.g }));
    // NEW: a level named by a finite number is kept as that number, in its place among the other kept ones (0-4;
    // what else came through is the refusal checks' to judge)
    var got04 = got.filter(function (g) { return g[0] <= 4; });
    rec('C-numbersKept', S(got04) === S(keptAll), 'decoded 0-4 ' + S(got04) + ' want ' + S(keptAll));
    // GUARD: text levels kept as text, as before
    rec('C-textKept', keptText.every(function (k) { return S(by[k[0]]) === S(k); }), 'decoded ' + S(got));
    // the refusals below judge a decode that kept the text levels (not one that kept nothing at all)
    var decodedOk = !!by[1] && !!by[4];
    // GUARD: tag-shaped (5), oversized (6) and empty (7) text refused
    rec('C-refusedText', decodedOk && [5, 6, 7].every(function (i) { return !by[i]; }), 'decoded ' + S(got));
    // GUARD: any other kind of value refused: an array (8), true (9), null (10), an object (11), no identifier (12),
    // Infinity (13: JSON's 1e999)
    rec('C-refusedShape', decodedOk && [8, 9, 10, 11, 12, 13].every(function (i) { return !by[i]; }), 'decoded ' + S(got));
    // NEW: a pivot view's level by number, likewise
    var pg = ((dp && dp.sc) || []).map(function (c) { return [c.colIdentifier, typeof c.colIdentifier, c.direction]; });
    R.obs.pivot = { m: dp && dp.m, sc: pg };
    rec('C-pivotKept', !!dp && dp.m === 'pivot' && S(pg) === S([[2021, 'number', 'desc'], ['Closed', 'string', 'asc']]), 'pivot view ' + S(R.obs.pivot));
  }

  (async function main() {
    try {
      await boot();
      R.obs.bootErrors = errs().slice();
      if (SCN === 'gA') await scnA();
      else if (SCN === 'gB') await scnB();
      else if (SCN === 'gC') await scnC();
      else R.notes.push('unknown scenario ' + SCN);
    } catch (e) {
      R.fatal = String((e && e.stack) || e).slice(0, 700);
    }
    R.errors = errs();
    R.missing = window.__JG_MISSING || null;
    R.hookErr = window.__JG_ERR || null;
    window.__VDRESULT = R;
    window.__VDDONE = true;
    document.getElementById('out').textContent = JSON.stringify(R, null, 1);
  })();
})();
