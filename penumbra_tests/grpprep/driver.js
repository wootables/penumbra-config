// grpprep suite - browser half (2026-10-03). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__HCRESULT = { scn, same: {...}, chk: {...}, info: {...}, errors: [...] }
// and window.__HCDONE = true.
//   same  everything that must be IDENTICAL between the build before and the
//         candidate: the grouped PDF's tables (autoTable's head/body/foot), the
//         "in X of Y groups" text, the email embed, the CSV/TSV/JSON exports, and
//         each group's open/closed state after a PDF
//   chk   booleans the CANDIDATE must hold: hiding group wrappers the List way
//         (a class of their own, NOT the search) changes neither the PDF nor the
//         count, and a PDF leaves every group open or closed as it found it
//   info  observations printed for both builds, never asserted
// Step 1 of the grouped view's List layout: the PDF export and the count stop
// asking jQuery :visible where a group is on screen.
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, same: {}, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function sha(s) {
    if (s == null) return null;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16);
  }
  async function big(s) {
    s = (s == null) ? '' : String(s);
    return { sha: await sha(s), len: s.length, head: s.slice(0, 160), tail: s.slice(-120) };
  }

  function top() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]')); }
  function kids(w) { return Array.prototype.slice.call(w.querySelectorAll(':scope > .group-content > .group-wrapper')); }
  // Every wrapper's open/closed state: the class AND the content's OWN display
  // (getComputedStyle of the element itself - an ancestor's display:none does
  // not change it).
  function openState() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper'), function (w) {
      var c = w.querySelector(':scope > .group-content');
      return (w.getAttribute('data-group-depth') || '?') + '|' + (w.getAttribute('data-group-key') || '') + '|' +
        (w.classList.contains('open') ? 'open' : 'closed') + '|' + (c ? getComputedStyle(c).display : '-');
    });
  }
  async function toggle(w) {
    var h = w.querySelector(':scope > .group-header');
    if (!h) throw new Error('no band on ' + (w.getAttribute('data-group-key') || '?'));
    $(h).trigger('click');
    await sleep(150);
  }
  function listHide(ws) { ws.forEach(function (w) { w.classList.add('zz-list-hide'); }); }
  function listShow() { document.querySelectorAll('.zz-list-hide').forEach(function (w) { w.classList.remove('zz-list-hide'); }); }

  var pdfReady = false;
  async function pdf() {
    if (!pdfReady) {
      await HC.loadScript('js/jspdf-2.5.1.umd.min.js');
      await HC.loadScript('js/jspdf-autotable-3.5.23.min.js');
      var api = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API;
      if (!api || !api.autoTable) throw new Error('pdf: jsPDF / autotable did not load');
      var orig = api.autoTable;
      api.autoTable = function (o) {
        try { window.__pdfTables.push(JSON.stringify({ head: o && o.head, body: o && o.body, foot: o && o.foot })); } catch (e) { window.__pdfTables.push('unserialisable: ' + e); }
        return orig.apply(this, arguments);
      };
      pdfReady = true;
    }
    window.__pdfTables = [];
    await HC.generatePdfContent();
    var t = window.__pdfTables.slice();
    // A readable summary: how many columns each table's heading carries.
    var cols = t.map(function (s) { try { var o = JSON.parse(s); return (o.head && o.head[0]) ? o.head[0].length : 0; } catch (e) { return -1; } });
    return { text: t.join('\n'), list: t, tables: t.length, cols: cols };
  }
  // The PDF walks the groups in document order and draws ONE table per INNERMOST
  // group (pdfnest, 2026-10-14) - the builds before drew one per wrapper, a branch's
  // empty under a garbled title - so table i belongs to the i-th innermost group, or
  // on a build before, to wrapper i (leafTables tells them apart by the count).
  // Taken BEFORE the PDF runs: the build before could change the open states.
  function pdfWrappers() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper:not(.search-hidden)'), function (w) {
      var parent = w.parentElement ? w.parentElement.closest('.group-wrapper') : null;
      return { leaf: w.classList.contains('group-leaf'), parentOpen: !parent || parent.classList.contains('open') };
    });
  }
  // Every innermost group's table carries the 7 showing columns ('#' + V_*), and
  // the tables of innermost groups under an OPEN branch (which the build before
  // already drew correctly) for the identical-output check.
  function leafTables(ws, p) {
    var leafCols = [], openLeaf = [], leaves = ws.filter(function (w) { return w.leaf; });
    // one table per innermost group (pdfnest) - or, on a build before, one per wrapper
    var mapped = p.tables === leaves.length ? leaves : (p.tables === ws.length ? ws : null);
    if (!mapped) return { ok: false, leafCols: ['tables ' + p.tables + ' != innermost groups ' + leaves.length + ' (or wrappers ' + ws.length + ')'], openLeaf: [] };
    mapped.forEach(function (w, i) {
      if (!w.leaf) return;
      leafCols.push(p.cols[i]);
      if (w.parentOpen) openLeaf.push(p.list[i]);
    });
    return { ok: leafCols.length > 0 && leafCols.every(function (c) { return c === 7; }), leafCols: leafCols, openLeaf: openLeaf };
  }
  async function search(q) {
    $('#tableSearch').val(q);
    HC.runTableSearch();
    if (!(await until(function () { return document.querySelector('#groupedResultsContainer .group-wrapper.search-hidden'); }, 15000)))
      throw new Error('search "' + q + '" hid no group within 15 s');
    await sleep(400);
  }
  function countText() { return $('#resultCount').text(); }

  async function boot() {
    if (!(await until(function () {
      return window.__queryDone >= 1 && hides() >= 1 && top().length >= 6 && $('#groupedResultsContainer').is(':visible');
    }, 150000))) throw new Error('boot: the grouped report never finished loading (150 s)');
    await sleep(500);   // deferred tails: presets, grouped handoff, a11y nudge
  }

  var S = {
    // Stacked, every group collapsed (the default): the PDF reads each one.
    pdf: async function () {
      var before = openState();
      var p = await pdf();
      R.same.pdf = await big(p.text); R.same.pdfCols = p.cols;
      R.same.state = openState();
      R.chk.stateKept = JSON.stringify(R.same.state) === JSON.stringify(before);
    },
    // Stacked, two groups open.
    pdfopen: async function () {
      var t = top(); await toggle(t[1]); await toggle(t[3]);
      var before = openState();
      var p = await pdf();
      R.same.pdf = await big(p.text); R.same.pdfCols = p.cols;
      R.same.state = openState();
      R.chk.stateKept = JSON.stringify(R.same.state) === JSON.stringify(before);
    },
    // The List stand-in: group 1 OPEN, then every band but the first hidden by
    // a class of its own. The PDF must match the stacked one exactly and leave
    // group 1 open.
    pdflist: async function () {
      var t = top(); await toggle(t[1]);
      var a = await pdf();
      var before = openState();
      listHide(t.slice(1));
      var b = await pdf();
      var after = openState();
      listShow();
      R.same.pdfStacked = await big(a.text);
      R.chk.headsEqual = a.text === b.text;
      R.chk.keepOpen = JSON.stringify(after) === JSON.stringify(before);
      R.info.colsStacked = a.cols; R.info.colsHidden = b.cols;
      if (!R.chk.keepOpen) R.info.stateDiff = before.filter(function (x, i) { return x !== after[i]; }).concat(['->'], after.filter(function (x, i) { return x !== before[i]; }));
    },
    // A search hides the North band: "in 5 of 6 groups".
    count: async function () {
      await search("H_GROUP != 'North'");
      R.same.count = countText();
    },
    // The same search, then three of the five kept bands hidden the List way.
    countlist: async function () {
      await search("H_GROUP != 'North'");
      var a = countText();
      var kept = top().filter(function (w) { return !w.classList.contains('search-hidden'); });
      listHide(kept.slice(1, 4));
      HC.updateGroupedResultCount();
      var b = countText();
      listShow();
      R.same.count = a;
      R.chk.countEqual = a === b;
      R.info.countHidden = b;
    },
    // Nested (H_GROUP > H_GROUP2): depth-0 bands count, innermost appended.
    ncount: async function () {
      await search("H_GROUP != 'South'");
      R.same.count = countText();
    },
    // Nested: branch 0 and its first leaf open; the first leaf of branch 2 open
    // while branch 2 stays CLOSED (Expand All, then collapse a branch). Every
    // innermost table must carry its columns (the build before drew the ones
    // under a closed branch BLANK) and the PDF must leave every group as it was
    // (the build before closed that leaf).
    npdf: async function () {
      var t = top();
      await toggle(t[0]); await toggle(kids(t[0])[0]);
      await toggle(kids(t[2])[0]);
      var before = openState();
      var ws = pdfWrappers();
      var p = await pdf();
      var after = openState();
      var lt = leafTables(ws, p);
      R.same.openLeafTables = await big(lt.openLeaf.join('\n'));
      // (the table count changes by design: pdfnest dropped the outer groups' empty ones)
      R.info.tableCount = p.tables;
      R.chk.leafCols = lt.ok;
      R.chk.stateKept = JSON.stringify(after) === JSON.stringify(before);
      var leaf = kids(t[2])[0], c = leaf.querySelector(':scope > .group-content');
      R.info.leafCols = lt.leafCols;
      R.info.leafInClosedBranchAfterPdf = (leaf.classList.contains('open') ? 'open' : 'closed') + ' / content ' + getComputedStyle(c).display;
    },
    // Nested List stand-in: branch 1 and its first leaf open, every band but
    // the first hidden the List way.
    nlist: async function () {
      var t = top();
      await toggle(t[1]); await toggle(kids(t[1])[0]);
      var ws = pdfWrappers();
      var a = await pdf();
      var before = openState();
      listHide(t.slice(1));
      var b = await pdf();
      var after = openState();
      listShow();
      var lt = leafTables(ws, a);
      R.same.openLeafTables = await big(lt.openLeaf.join('\n'));
      R.chk.stackedLeafCols = lt.ok;
      R.chk.headsEqual = a.text === b.text;
      R.chk.keepOpen = JSON.stringify(after) === JSON.stringify(before);
      R.info.colsStacked = a.cols; R.info.colsHidden = b.cols;
    },
    // Guards on paths step 1 does not touch: the email embed and the exports.
    email: async function () {
      await toggle(top()[0]);
      R.same.email = await big(HC.getExportData('html').content);
    },
    exports: async function () {
      R.same.csv = await big(HC.getExportData('csv').content);
      R.same.tsv = await big(HC.getExportData('tsv').content);
      R.same.json = await big(HC.getExportData('json').content);
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      R.info.groups = top().length;
      await S[SCN]();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    R.missing = window.__HC_MISSING || [];
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
