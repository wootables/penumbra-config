// urlnum suite - browser half (2026-10-25). Runs ONE scenario (?scn=) against the main.js the page
// loaded and publishes window.__UNRESULT = { scn, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__UNDONE = true. run.py collects the asserts.
//
// The fixture's column 2021 is named only in digits, as a PIVOT query's is: jQuery's data('colname')
// hands its heading back as the NUMBER 2021, and a click on that heading keeps the number as the sort
// level's colIdentifier. The next click and the header menu's sort find a level by that value (===).
//   fA  the flat report sorted by clicks (2021 twice: descending); its link built (Copy a link to this
//       view): a flat link's sort rides as ?sort= text (v.o)
//   fB  that link opened: the level is the NUMBER, marked, the rows in order, data(colsort, 2021) reads
//       it; the next click on 2021 takes the level off
//   fC  that link opened: the header menu's Clear sort on 2021 clears it
//   uA  a plain ?sort=2021: the level is the number; the next click goes on to descending
//   uB  ?sort=2021|desc,V_NAME, then a re-run (Run): every run while ?sort= is in the URL resolves it
//       again, the by-name pass of a state load not after it - the level is the number at both; the
//       next click on 2021 takes its level off and keeps V_NAME's
//   uC  ?sort=0042|desc, then a re-run: a leading zero keeps the name TEXT (data() reads '0042' as text):
//       the level is what a click keeps, not just any number its digits make
//   uJ  a column named [1] too: ?sort=[1]|desc, a link made then, a re-run - the level stays TEXT (a
//       number only: data() parses [1] as JSON, an array no click's equals and text readers misread)
//   pA  a pivot report: its own heading sort marks as before, and a level named by a number in its sort
//       (no path of today's puts one there) leaves the marks' repaint unbroken
//   P-* premises; A-/B-/C-/U-/R-/Z-/H-* checks; E-* page errors
(function () {
  var JG = window.__UN || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [], obs: {}, notes: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail).slice(0, 700) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  function hides() { return window.__UN_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function S(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  function V() { return window.PenumbraViewLink; }
  async function settle() { await sleep(400); await frames(4); }
  // fn run with its throw and the page errors it made caught
  async function step(fn) {
    var e0 = errs().length, out = { threw: null, val: undefined };
    try { out.val = await fn(); } catch (e) { out.threw = String((e && e.message) || e); }
    await sleep(60);
    out.errs = errs().slice(e0);
    return out;
  }
  function clean(o) { return !o.threw && !o.errs.length; }
  function why(o) { return (o.threw ? 'threw: ' + o.threw + '; ' : '') + (o.errs.length ? 'page errors: ' + o.errs.join(' | ') : ''); }

  // ---- the page's sort: [identifier, its type, direction, place] per level ----------------------------
  function sortRaw() { return (JG.sortCrit && JG.sortCrit()) || []; }
  function sortNow() { return sortRaw().map(function (c) { return [c.colIdentifier, typeof c.colIdentifier, c.direction, c.colIndex]; }); }

  // ---- the flat table ---------------------------------------------------------------------------------
  function fTh(name) { return document.querySelector('#tableHeader > th[data-colname="' + name + '"]'); }
  function colOf(name) { var th = fTh(name); return th ? th.getAttribute('data-column') : null; }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  function cellText(tr, name) { var td = tr.querySelector(':scope > td[data-column="' + colOf(name) + '"]'); return td ? String(td.textContent).trim() : null; }
  // the marked headings: column:aria-sort[:rank], in page order
  function fMarks() {
    return Array.prototype.map.call(document.querySelectorAll('#tableHeader > th.sorted'), function (t) {
      var r = t.querySelector('.sort-rank');
      return t.getAttribute('data-colname') + ':' + t.getAttribute('aria-sort') + (r ? ':' + r.textContent : '');
    });
  }
  // the rows in order by a column's numbers (dir 1 ascending, -1 descending; ties in any order), all 60 filled
  function byNum(name, dir) {
    var rows = flatRows(), bad = [];
    var v = rows.map(function (tr) { return parseFloat(cellText(tr, name)); });
    for (var i = 1; i < v.length; i++) {
      if (isNaN(v[i]) || isNaN(v[i - 1])) { bad.push('no number at row ' + i); continue; }
      if ((v[i] - v[i - 1]) * dir < 0) bad.push(v[i - 1] + ' before ' + v[i]);
    }
    return { ok: rows.length === 60 && !bad.length, rows: rows.length, bad: bad.slice(0, 3), first: v.slice(0, 5) };
  }
  // 2021 descending, ties by V_NAME ascending (text compares as the sort does)
  function by2021NameDesc() {
    var rows = flatRows(), bad = [], tied = 0;
    for (var i = 1; i < rows.length; i++) {
      var a = parseFloat(cellText(rows[i - 1], '2021')), b = parseFloat(cellText(rows[i], '2021'));
      if (isNaN(a) || isNaN(b)) { bad.push('no number at row ' + i); continue; }
      if (a < b) bad.push(a + ' before ' + b);
      else if (a === b) {
        tied++;
        var na = cellText(rows[i - 1], 'V_NAME'), nb = cellText(rows[i], 'V_NAME');
        if (String(na).localeCompare(String(nb), undefined, { sensitivity: 'base' }) > 0) bad.push(na + ' before ' + nb + ' (2021 = ' + a + ')');
      }
    }
    return { ok: rows.length === 60 && tied > 0 && !bad.length, rows: rows.length, tied: tied, bad: bad.slice(0, 3) };
  }
  // the report's own order (the fixture's: ID-1001 .. ID-1060)
  function natural() {
    var ids = flatRows().map(function (tr) { return cellText(tr, 'V_ID'); });
    var want = (window.__rowsFixture || []).map(function (r) { return r.V_ID; });
    return ids.length === 60 && S(ids) === S(want);
  }
  function clickTh(th, shift) { if (!th) return false; th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, shiftKey: !!shift })); return true; }

  // ---- the header menu (penumbra_colmenu.js), as a right-click opens it -------------------------------
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function item(act) { var ps = document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub'); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }

  // ---- the run path -----------------------------------------------------------------------------------
  async function boot() {
    var ok = await until(function () {
      if (window.__queryDone < 1 || hides() < 1) return false;
      if (SCN === 'pA') return !!document.getElementById('pivotResultTable') && $('#pivot-output-container').is(':visible');
      return $('#resultsTable').is(':visible') && flatRows().length === 60;
    }, 120000);
    if (!ok) throw new Error('boot: the report never finished loading (120 s): ' + S({ q: window.__queryDone, h: hides(), errs: errs().slice(-4) }));
    await sleep(600); await frames(4);
  }
  // a re-run of the query (the Run button: a prompt answer runs the same path) - not a state load
  async function requery() {
    var q0 = window.__queryDone, h0 = hides();
    $('#executeQuery').trigger('click');
    var ok = await until(function () { return window.__queryDone > q0 && hides() > h0 && $('#resultsTable').is(':visible') && flatRows().length === 60; }, 60000);
    await sleep(600); await frames(4);
    return ok;
  }
  // the premise on every flat page: data() hands the 2021 heading back as the number, 0042's as text
  // (uJ: and [1]'s as an array - JSON)
  function premise() {
    var a = fTh('2021'), b = fTh('0042'), j = SCN === 'uJ' ? fTh('[1]') : null;
    var da = a ? $(a).data('colname') : undefined, db = b ? $(b).data('colname') : undefined, dj = j ? $(j).data('colname') : undefined;
    rec('P-' + SCN, da === 2021 && db === '0042' && colOf('2021') === '0' && colOf('0042') === '5' && (window.__rowsFixture || []).length === 60
      && (SCN !== 'uJ' || (Array.isArray(dj) && colOf('[1]') === '6')),
      'data(colname): 2021 -> ' + S(da) + ' (' + typeof da + '), 0042 -> ' + S(db) + ' (' + typeof db + '); places ' + colOf('2021') + ', ' + colOf('0042')
      + (SCN === 'uJ' ? '; [1] -> ' + S(dj) + ' (array ' + Array.isArray(dj) + ') at ' + colOf('[1]') : ''));
  }

  var SC = {
    fA: async function () {
      premise();
      clickTh(fTh('2021')); await settle();
      clickTh(fTh('2021')); await settle();
      var want = [[2021, 'number', 'desc', 0]], now = sortNow(), o = byNum('2021', -1);
      // GUARD: two clicks: descending, the level the NUMBER (what every check below compares with)
      rec('A-click', S(now) === S(want) && o.ok && S(fMarks()) === S(['2021:descending']), 'sort ' + S(now) + '; rows ' + S(o) + '; marks ' + S(fMarks()));
      var b = V().build(), v = b.token ? V().decode(b.token) : null;
      R.obs.build = { error: b.error || null, len: b.url ? b.url.length : 0, included: b.included, dropped: b.dropped };
      R.obs.token = b.token || null; R.obs.view = v;
      // GUARD: the link is flat, its sort the ?sort= text
      rec('A-built', !!b.token && !b.error && !!v && v.m === 'flat' && v.o === '2021|desc', 'build ' + S(R.obs.build) + '; m ' + (v && v.m) + '; o ' + S(v && v.o));
    },
    fB: async function () {
      premise();
      // GUARD: the link applies
      rec('B-applied', !!V().active() && $('#resultsTable').is(':visible') && !$('#groupedResultsContainer').is(':visible'), 'active ' + V().active());
      var want = [[2021, 'number', 'desc', 0]], now = sortNow();
      R.obs.sortAtOpen = now;
      // NEW: the link's level is on the page as the NUMBER - a header click's value
      rec('B-sort', S(now) === S(want), 'sort ' + S(now) + ' want ' + S(want));
      // GUARD: marked, the rows in order (by its place: as before)
      var o = byNum('2021', -1);
      rec('B-marked', S(fMarks()) === S(['2021:descending']) && o.ok, 'marks ' + S(fMarks()) + '; rows ' + S(o));
      // GUARD: the snippet's data(colsort, 2021) reads it (the lookup compares names as text)
      var cs = await step(function () { return JG.lookup('colsort', '2021'); });
      rec('B-colsort', clean(cs) && !!cs.val && cs.val.v === 'desc', 'colsort = ' + S(cs.val) + '; ' + why(cs));
      // NEW: the next click on 2021 finds its level and takes it off (as on the page that made the link)
      clickTh(fTh('2021')); await settle();
      R.obs.afterClick = sortNow();
      rec('B-nextClick', S(R.obs.afterClick) === '[]' && fMarks().length === 0 && natural(), 'after a click on 2021: ' + S(R.obs.afterClick) + '; marks ' + S(fMarks()) + '; natural ' + natural());
    },
    fC: async function () {
      premise();
      closeMenu();
      rclick(fTh('2021'));
      await sleep(150);
      var it = item('sortClear');
      R.obs.acts = acts();
      // GUARD: the header menu offers Clear sort (it reads the column's sort by its text)
      rec('C-offered', !!menu() && !!it && it.getAttribute('aria-disabled') !== 'true', 'menu ' + !!menu() + '; acts ' + S(R.obs.acts).slice(0, 300));
      if (it) it.click();
      await settle();
      R.obs.afterClear = sortNow();
      // NEW: Clear sort clears it: no sort, no marks, the report's own order
      rec('C-cleared', S(R.obs.afterClear) === '[]' && fMarks().length === 0 && natural(), 'after Clear sort: ' + S(R.obs.afterClear) + '; marks ' + S(fMarks()) + '; natural ' + natural());
      closeMenu();
    },
    uA: async function () {
      premise();
      var now = sortNow(), o = byNum('2021', 1);
      R.obs.sortAtOpen = now;
      // NEW: ?sort=2021: the level is the NUMBER
      rec('U-sort', S(now) === S([[2021, 'number', 'asc', 0]]), 'sort ' + S(now));
      // GUARD: marked, the rows in order
      rec('U-marked', S(fMarks()) === S(['2021:ascending']) && o.ok, 'marks ' + S(fMarks()) + '; rows ' + S(o));
      // NEW: the next click goes on to descending (as text it started over at ascending)
      clickTh(fTh('2021')); await settle();
      var a = sortNow(), d = byNum('2021', -1);
      R.obs.afterClick = a;
      rec('U-nextClick', S(a) === S([[2021, 'number', 'desc', 0]]) && d.ok && S(fMarks()) === S(['2021:descending']), 'after a click: ' + S(a) + '; rows ' + S(d) + '; marks ' + S(fMarks()));
    },
    uB: async function () {
      premise();
      var want = [[2021, 'number', 'desc', 0], ['V_NAME', 'string', 'asc', 3]];
      var s0 = sortNow();
      // NEW: ?sort=2021|desc,V_NAME at the state load: 2021's level the number, V_NAME's text
      rec('R-load', S(s0) === S(want), 'sort ' + S(s0) + ' want ' + S(want));
      var rq = await requery(), s1 = sortNow();
      R.obs.sortAtOpen = s0; R.obs.sortRerun = s1;
      // NEW: ...and after a re-run (the URL's sort resolved again, nothing after it)
      rec('R-rerun', rq && S(s1) === S(want), 'rerun ' + rq + '; sort ' + S(s1));
      // GUARD: marked, the rows in that order
      var o = by2021NameDesc();
      rec('R-rows', S(fMarks()) === S(['2021:descending:1', 'V_NAME:ascending:2']) && o.ok, 'marks ' + S(fMarks()) + '; rows ' + S(o));
      // NEW: the next click on 2021 takes its level off and keeps V_NAME's (as text: 2021 alone, ascending)
      clickTh(fTh('2021')); await settle();
      var a = sortNow();
      R.obs.afterClick = a;
      rec('R-nextClick', S(a) === S([['V_NAME', 'string', 'asc', 3]]) && S(fMarks()) === S(['V_NAME:ascending']), 'after a click on 2021: ' + S(a) + '; marks ' + S(fMarks()));
    },
    uC: async function () {
      premise();
      var want = [['0042', 'string', 'desc', 5]];
      var s0 = sortNow(), o0 = byNum('0042', -1);
      // GUARD: ?sort=0042|desc: the level is the TEXT '0042' - what a click on its heading keeps
      rec('Z-sort', S(s0) === S(want) && o0.ok && S(fMarks()) === S(['0042:descending']), 'sort ' + S(s0) + '; rows ' + S(o0) + '; marks ' + S(fMarks()));
      var rq = await requery(), s1 = sortNow();
      R.obs.sortAtOpen = s0; R.obs.sortRerun = s1;
      // GUARD: ...after a re-run too
      rec('Z-rerun', rq && S(s1) === S(want), 'rerun ' + rq + '; sort ' + S(s1));
      // GUARD: the next click takes it off
      clickTh(fTh('0042')); await settle();
      var a = sortNow();
      R.obs.afterClick = a;
      rec('Z-nextClick', S(a) === '[]' && fMarks().length === 0 && natural(), 'after a click on 0042: ' + S(a) + '; marks ' + S(fMarks()) + '; natural ' + natural());
    },
    uJ: async function () {
      premise();
      var want = [['[1]', 'string', 'desc', 6]];
      var s0 = sortNow(), o0 = byNum('[1]', -1);
      R.obs.sortAtOpen = s0;
      // GUARD: ?sort=[1]|desc: the level stays the TEXT '[1]' (data() parses that name as JSON - a fresh
      // array per heading, which no click finds and every text reader misreads), sorted and marked
      rec('J-sort', S(s0) === S(want) && o0.ok && S(fMarks()) === S(['[1]:descending']), 'sort ' + S(s0) + '; rows ' + S(o0) + '; marks ' + S(fMarks()));
      // GUARD: a link made now names it so (a ?sort= link: String() of an array [1] is "1")
      var b = V().build(), v = b.token ? V().decode(b.token) : null;
      rec('J-link', !!b.token && !b.error && !!v && v.m === 'flat' && v.o === '[1]|desc', 'o ' + S(v && v.o) + '; build error ' + S(b.error || null));
      var rq = await requery(), s1 = sortNow();
      R.obs.sortRerun = s1;
      // GUARD: ...and after a re-run (the resolver alone)
      rec('J-rerun', rq && S(s1) === S(want), 'rerun ' + rq + '; sort ' + S(s1));
    },
    pA: async function () {
      var tbl = document.getElementById('pivotResultTable');
      var pick = function () { return document.querySelector('#pivotResultTable thead tr:last-child th:not([data-row-field]):not([colspan])'); };
      var th = pick();
      R.obs.heads = Array.prototype.map.call(document.querySelectorAll('#pivotResultTable thead th'), function (t) { return String(t.textContent).trim(); }).slice(0, 8);
      // GUARD: the pivot is on screen
      rec('H-pivot', !!tbl && $('#pivot-output-container').is(':visible') && !!th, 'table ' + !!tbl + '; heads ' + S(R.obs.heads));
      // GUARD: its own heading sort - a click keeps the heading's text, and marks it
      clickTh(th); await settle();
      var s1 = sortRaw(), th1 = pick();
      R.obs.ownSort = s1;
      rec('H-ownSort', s1.length === 1 && typeof s1[0].colIdentifier === 'string' && !!th1 && th1.classList.contains('sorted'),
        'sort ' + S(s1) + '; marked ' + !!(th1 && th1.classList.contains('sorted')));
      // NEW: a level named by a number beside it: the marks repaint without a throw, the text level's still on
      var o = await step(function () { JG.setSort(s1.concat([{ colIdentifier: 2021, colIndex: 0, direction: 'asc' }])); JG.icons(); });
      var th2 = pick();
      rec('H-noThrow', clean(o) && !!th2 && th2.classList.contains('sorted'), why(o) + ' marked ' + !!(th2 && th2.classList.contains('sorted')));
      try { JG.setSort(s1); JG.icons(); } catch (e) { R.notes.push('restore: ' + e); }
    }
  };

  (async function main() {
    try {
      await boot();
      R.obs.bootErrors = errs().slice();
      if (!SC[SCN]) throw new Error('unknown scenario ' + SCN);
      await SC[SCN]();
    } catch (e) {
      R.fatal = String((e && e.stack) || e).slice(0, 700);
    }
    R.errors = errs();
    R.hookErr = window.__UN_ERR || null;
    window.__UNRESULT = R;
    window.__UNDONE = true;
    document.getElementById('out').textContent = JSON.stringify(R, null, 1);
  })();
})();
