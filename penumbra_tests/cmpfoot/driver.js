// Comparison-footer suite - browser half (2026-09-30). Drives the REAL main.js
// (ready closure unwrapped, window.__CF export hook) into a REAL snapshot
// comparison, then changes a summary type the way a user does - a click on the
// footer badge, a click on a menu option - and reads the diff's footers back.
//
// The bug: _penumbraRecomputeFooterInPlace() - what penumbraRefreshSummaryFooters()
// runs while a comparison is on screen (badge pick, badge SHOW toggle, journal
// summary refresh) - called penumbraSummaryAccumulator(type, col) with `col`
// never declared: a ReferenceError on every call, so the diff's footers never
// changed. Behind it: it read each cell's column NAME from the header at the
// cell's INDEX, but the diff's <thead> carries a hidden __SNAP_TYPE column its
// <tfoot> does not - every cell resolved its left-hand neighbour's name - and it
// summed textContent, which on a modified cell is its was/now views
// concatenated (NaN, so the cell dropped out).
//
// ?mode=live       F fixture  B badge change  R re-render parity  T badge SHOW toggle
// ?mode=numhidden  H '#' hidden: the label lives in the first plain cell
// ?mode=ab         A A-vs-B with an in-place search (the recompute twin: recomputeWrapperTotals)
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) }); }
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
  var COLS = window.__COLS, LIVE = window.__LIVE, SNAP = window.__SNAP;
  var GROUPS = ['New Rows', 'Removed Rows', 'Modified Rows', 'Unchanged Rows'];
  function J(x) { return JSON.stringify(x); }

  // --- the expected diff, worked out from the fixture alone (keyed on ID) ---
  function expectedGroups() {
    var snapById = {}, liveById = {};
    SNAP.forEach(function (r) { snapById[r.ID] = r; });
    LIVE.forEach(function (r) { liveById[r.ID] = r; });
    var g = { 'New Rows': [], 'Removed Rows': [], 'Modified Rows': [], 'Unchanged Rows': [] };
    LIVE.forEach(function (r) {
      var s = snapById[r.ID];
      if (!s) { g['New Rows'].push(r); return; }
      var diff = COLS.some(function (c) { return c !== 'ID' && String(r[c]) !== String(s[c]); });
      g[diff ? 'Modified Rows' : 'Unchanged Rows'].push(r);   // current (live) values
    });
    SNAP.forEach(function (r) { if (!liveById[r.ID]) g['Removed Rows'].push(r); });
    return g;
  }
  var EXP = expectedGroups();
  function num(s) { return parseFloat(String(s).replace(/[$,]/g, '')); }
  function money(n) { return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function whole(n) { return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function vals(rows, col) { return rows.map(function (r) { return num(r[col]); }); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  // keep(row) = the rows a search leaves visible (default: all)
  function want(group, keep) {
    var rows = EXP[group].filter(keep || function () { return true; });
    var am = vals(rows, 'AMOUNT'), q = vals(rows, 'QTY');
    return {
      n: rows.length,
      amountSum: rows.length ? money(sum(am)) : '',
      amountAvg: rows.length ? money(sum(am) / am.length) : '',
      qtySum: rows.length ? whole(sum(q)) : ''
    };
  }

  // --- reading the diff (located through the HEADER's data-column, never
  //     through anything the code under test stamps on the footer) ---
  function wrappers() { return Array.prototype.slice.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper')); }
  function wrapperOf(group) { return wrappers().filter(function (w) { return w.getAttribute('data-group-key') === group; })[0] || null; }
  function colIdOf(w, name) {
    var th = Array.prototype.slice.call(w.querySelectorAll('thead th[data-colname]')).filter(function (t) {
      return String(t.getAttribute('data-colname')).toUpperCase() === name;
    })[0];
    return th ? th.getAttribute('data-column') : null;
  }
  function footRow(w) { var t = w.querySelector('table'); return (t && t.tFoot && t.tFoot.rows[0]) || null; }
  function footCell(w, name) {
    var tr = footRow(w), id = colIdOf(w, name);
    if (!tr || id === null) return null;
    return Array.prototype.slice.call(tr.cells).filter(function (td) { return td.getAttribute('data-column') === id; })[0] || null;
  }
  function info(w, name) {
    var td = footCell(w, name);
    if (!td) return { text: 'NO CELL', badge: '', type: '' };
    var st = td.querySelector('strong'), b = td.querySelector('.pnb-sum-badge');
    return { text: st ? st.textContent.trim() : 'NO STRONG', badge: b ? b.textContent.trim() : '', type: td.getAttribute('data-sum-type') || '' };
  }
  function labels(w) {
    var tr = footRow(w);
    if (!tr) return { label: 'NO FOOT', numCell: '' };
    var withStrong = Array.prototype.slice.call(tr.querySelectorAll('td.pnb-sum-label')).filter(function (td) { return !!td.querySelector('strong'); });
    var num = Array.prototype.slice.call(tr.cells).filter(function (td) { return td.getAttribute('data-column') === '#'; })[0];
    return {
      label: withStrong.map(function (td) { return td.textContent.trim(); }).join('|'),
      labelCol: withStrong.map(function (td) { return td.getAttribute('data-column'); }).join('|'),
      numCell: num ? num.textContent.trim() : 'NO # CELL',
      numHidden: num ? num.style.display === 'none' : null
    };
  }
  // Everything a footer shows, per group - the parity fingerprint.
  function footers() {
    var out = {};
    wrappers().forEach(function (w) {
      var tr = footRow(w);
      out[w.getAttribute('data-group-key')] = tr ? Array.prototype.slice.call(tr.cells).map(function (td) {
        var b = td.querySelector('.pnb-sum-badge');
        return td.getAttribute('data-column') + '=' + ((td.querySelector('strong') || {}).textContent || '').trim() +
               (b ? ' [' + b.textContent.trim() + ']' : '');
      }) : 'NO FOOT';
    });
    return out;
  }
  function counts() {
    var o = {};
    wrappers().forEach(function (w) { o[w.getAttribute('data-group-key')] = w.querySelectorAll('tbody tr').length; });
    return o;
  }

  // --- driving -------------------------------------------------------------
  // A real click: dispatched, so a throwing handler lands in window.onerror
  // exactly as it does for a user (jQuery's .trigger() would rethrow instead).
  function click(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && document.querySelectorAll('#resultsTable tbody tr').length === LIVE.length; }, 30000);
    await sleep(400);
  }
  function snapObj(rows, name, ageDays) {
    return {
      name: name, timestamp: Date.now() - ageDays * 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: COLS.slice(),
      compressedData: H.compress(JSON.stringify(rows.map(function (r) { return { rowData: r }; })))
    };
  }
  async function waitCompare(hides0) {
    var ok = await waitFor(function () {
      var c = document.getElementById('snapshotComparisonContainer');
      return c && !c.hasAttribute('data-cf-old') && document.body.classList.contains('snapshot-comparison-active') &&
             wrappers().length > 0 && (window.__CF_HIDES || 0) > hides0;
    }, 30000);
    await sleep(300);
    return ok;
  }
  // Pick a summary type from the badge menu of `name`'s footer cell in `group`.
  async function pickType(group, name, type) {
    var w = wrapperOf(group), td = w && footCell(w, name), b = td && td.querySelector('.pnb-sum-badge');
    if (!b) return 'no badge on ' + name + ' in ' + group;
    click(b);
    await sleep(50);
    var opt = document.querySelector('.sp-sumtype-menu .sp-sumtype-opt[data-type="' + type + '"]');
    if (!opt) return 'the badge menu did not offer ' + type;
    click(opt);
    await sleep(150);
    return document.querySelector('.sp-sumtype-menu') ? 'the menu stayed open' : '';
  }
  function row(id) { return function (r) { return r.ID === id; }; }
  function errDelta(n0) { return errs().slice(n0).join(' / '); }

  // --- the checks shared by the two compare-to-live pages ---------------------
  function checkInitial(tag) {
    var c = counts(), okc = GROUPS.every(function (g) { return c[g] === EXP[g].length; });
    rec(tag + '1 fixture: the diff renders New/Removed/Modified/Unchanged with 2 rows each', okc && wrappers().length === 4, 'rows=' + J(c));
    var bad = [];
    GROUPS.forEach(function (g) {
      var w = wrapperOf(g); if (!w) { bad.push(g + ': no wrapper'); return; }
      var x = want(g), a = info(w, 'AMOUNT'), q = info(w, 'QTY');
      if (a.text !== x.amountSum || a.badge !== 'SUM' || a.type !== 'sum') bad.push(g + ' AMOUNT=' + J(a) + ' want ' + x.amountSum);
      if (q.text !== x.qtySum || q.badge !== 'SUM' || q.type !== 'sum') bad.push(g + ' QTY=' + J(q) + ' want ' + x.qtySum);
      if (labels(w).label !== 'TOTALS') bad.push(g + ' label=' + J(labels(w)));
    });
    rec(tag + '2 fixture: every footer starts as SUM of AMOUNT and QTY under TOTALS', !bad.length, bad.join('; ') || 'ok');
  }
  function checkAvg(keep) {
    var bad = [];
    ['New Rows', 'Removed Rows', 'Unchanged Rows'].forEach(function (g) {
      var w = wrapperOf(g), x = want(g, keep), a = info(w, 'AMOUNT');
      if (a.text !== x.amountAvg || a.badge !== 'AVG' || a.type !== 'avg') bad.push(g + ' AMOUNT=' + J(a) + ' want ' + x.amountAvg + ' [AVG]');
    });
    return bad;
  }
  function checkQtyKept(keep) {
    var bad = [];
    ['New Rows', 'Removed Rows', 'Unchanged Rows'].forEach(function (g) {
      var w = wrapperOf(g), x = want(g, keep), q = info(w, 'QTY');
      if (q.text !== x.qtySum || q.badge !== 'SUM' || q.type !== 'sum') bad.push(g + ' QTY=' + J(q) + ' want ' + x.qtySum + ' [SUM]');
    });
    return bad;
  }
  function checkModified(keep) {
    var w = wrapperOf('Modified Rows'), x = want('Modified Rows', keep), a = info(w, 'AMOUNT'), q = info(w, 'QTY');
    var bad = [];
    if (a.text !== x.amountAvg || a.type !== 'avg') bad.push('AMOUNT=' + J(a) + ' want ' + x.amountAvg);
    if (q.text !== x.qtySum || q.type !== 'sum') bad.push('QTY=' + J(q) + ' want ' + x.qtySum);
    return bad;
  }

  // --------------------------------------------------------------------------
  async function modeLive(numHidden) {
    await waitBoot();
    var tag = numHidden ? 'H' : 'F';
    if (numHidden) {
      // What the Settings panel's Apply leaves behind when '#' is unticked: the
      // renderers read it off the flat header (_isNumColHidden).
      var th = document.querySelector('#tableHeader th[data-column="#"]');
      if (th) th.style.display = 'none';
    }
    var e0 = errs().length, h0 = window.__CF_HIDES || 0;
    H.runCmp(snapObj(SNAP, 'Fixture snapshot', 3), ['ID']);
    var ok = await waitCompare(h0);
    rec(tag + '0 fixture: a compare-to-live diff renders (keys: ID)', ok, 'wrappers=' + wrappers().length + ' errs=' + errDelta(e0));
    if (!ok) return;
    checkInitial(tag);

    if (numHidden) {
      var badH = [];
      wrappers().forEach(function (w) {
        var l = labels(w);
        if (l.label !== 'TOTALS' || l.labelCol !== colIdOf(w, 'ID') || l.numCell !== '' || l.numHidden !== true) badH.push(w.getAttribute('data-group-key') + '=' + J(l));
      });
      rec('H3 fixture: with # hidden the TOTALS label sits in the ID cell and the # cell is empty', !badH.length, badH.join('; ') || 'ok');
      var e1h = errs().length;
      var ph = await pickType('New Rows', 'AMOUNT', 'avg');
      var badH2 = [];
      wrappers().forEach(function (w) {
        var l = labels(w);
        if (l.label !== 'SUMMARY' || l.labelCol !== colIdOf(w, 'ID') || l.numCell !== '') badH2.push(w.getAttribute('data-group-key') + '=' + J(l));
      });
      rec('H4 after AMOUNT -> Average the relocated label reads SUMMARY and nothing is written into the hidden # cell',
        !ph && !badH2.length, (ph || badH2.join('; ') || 'ok') + (errDelta(e1h) ? ' errs=' + errDelta(e1h) : ''));
      rec('H5 no page error from the change', errs().length === e1h, errDelta(e1h) || 'none');
      return;
    }

    // F3: the structural cause, recorded so a future renderer change that
    // gives the <tfoot> a __SNAP_TYPE cell shows up here as a fixture change.
    var w0 = wrapperOf('New Rows'), t0 = w0.querySelector('table');
    var nHead = t0.tHead.rows[0].cells.length, nFoot = t0.tFoot.rows[0].cells.length;
    rec('F3 fixture: the diff <thead> has one cell more than its <tfoot> (the hidden __SNAP_TYPE column)', nHead === nFoot + 1,
      'thead=' + nHead + ' tfoot=' + nFoot + ' th[1]=' + (t0.tHead.rows[0].cells[1] || {}).getAttribute('data-column'));

    // B: the user picks Average on AMOUNT's badge in one group.
    var e1 = errs().length;
    var p = await pickType('New Rows', 'AMOUNT', 'avg');
    rec('B1 picking Average on a diff footer badge raises no page error', !p && errs().length === e1, (p || '') + ' ' + (errDelta(e1) || 'none'));
    var b2 = checkAvg();
    rec('B2 AMOUNT now shows its AVERAGE (AVG badge) in every group', !b2.length, b2.join('; ') || 'ok');
    var b3 = checkQtyKept();
    rec('B3 QTY, the column to its right, keeps its TOTAL (SUM badge)', !b3.length, b3.join('; ') || 'ok');
    var b4 = checkModified();
    rec('B4 Modified Rows: a modified cell counts at its CURRENT value (AMOUNT avg $350.00, QTY 7)', !b4.length, b4.join('; ') || 'ok');
    var b5 = wrappers().filter(function (w) { return labels(w).label !== 'SUMMARY'; }).map(function (w) { return w.getAttribute('data-group-key') + '=' + J(labels(w)); });
    rec('B5 the footer label reads SUMMARY now that the types are mixed', !b5.length, b5.join('; ') || 'ok');

    // R: the in-place refresh must equal what a fresh render writes. A search
    // in compare-to-live re-runs the whole comparison (generateComparisonTotalRow,
    // which resolves the same badge pick).
    var inPlace = footers();
    var e2 = errs().length, h2 = window.__CF_HIDES || 0;
    document.getElementById('snapshotComparisonContainer').setAttribute('data-cf-old', '1');
    $('#tableSearch').val('');
    try { H.runTableSearch(); } catch (e) { window.__errors.push('runTableSearch threw: ' + e); }
    var ok2 = await waitCompare(h2);
    var fresh = footers();
    rec('R1 the in-place refresh equals a fresh render of the diff, cell for cell', ok2 && J(inPlace) === J(fresh),
      (ok2 ? '' : 'NO RE-RENDER ') + (J(inPlace) === J(fresh) ? 'identical: ' + J(fresh['Modified Rows']) : 'in-place=' + J(inPlace) + ' | fresh=' + J(fresh)) + (errDelta(e2) ? ' errs=' + errDelta(e2) : ''));

    // T: the settings panel's badge SHOW toggle refreshes the same footers.
    var e3 = errs().length, beforeT = footers();
    click(document.getElementById('spBadgeToggle'));
    await sleep(150);
    var left = document.querySelectorAll('#snapshotComparisonContainer tfoot .pnb-sum-badge').length;
    var stripped = {};
    Object.keys(beforeT).forEach(function (g) { stripped[g] = beforeT[g].map(function (s) { return s.replace(/ \[[A-Z]+\]$/, ''); }); });
    rec('T1 Hide badges: no page error, no badge left in any diff footer, values unchanged',
      errs().length === e3 && left === 0 && J(footers()) === J(stripped), 'badges left=' + left + ' errs=' + (errDelta(e3) || 'none') + ' now=' + J(footers()['New Rows']));
    var e4 = errs().length;
    click(document.getElementById('spBadgeToggle'));
    await sleep(150);
    rec('T2 Show badges: every footer is back exactly as before (AMOUNT AVG, QTY SUM)', errs().length === e4 && J(footers()) === J(beforeT),
      'now=' + J(footers()['New Rows']) + ' before=' + J(beforeT['New Rows']) + (errDelta(e4) ? ' errs=' + errDelta(e4) : ''));
  }

  async function modeAb() {
    await waitBoot();
    var e0 = errs().length, h0 = window.__CF_HIDES || 0;
    // B = the newer side ("current"), A = the baseline.
    H.runAb(snapObj(SNAP, 'Snapshot A', 5), snapObj(LIVE, 'Snapshot B', 1), ['ID']);
    var ok = await waitCompare(h0);
    rec('A0 fixture: an A-vs-B diff renders (keys: ID)', ok, 'wrappers=' + wrappers().length + ' errs=' + errDelta(e0));
    if (!ok) return;
    checkInitial('A');

    // An in-place search (A-vs-B has no re-run): QTY > 1 hides row 1.
    var keep = function (r) { return num(r.QTY) > 1; };
    var h1 = window.__CF_HIDES || 0;
    $('#tableSearch').val('QTY > 1');
    try { H.runTableSearch(); } catch (e) { window.__errors.push('runTableSearch threw: ' + e); }
    await waitFor(function () { return (window.__CF_HIDES || 0) > h1; }, 20000);
    await sleep(200);
    var u = wrapperOf('Unchanged Rows'), xu = want('Unchanged Rows', keep);
    var vis = u.querySelectorAll('tbody tr:not(.search-hidden)').length;
    rec('A3 fixture: the search leaves 1 of 2 Unchanged rows and its footer re-sums them', vis === 1 && info(u, 'AMOUNT').text === xu.amountSum,
      'visible=' + vis + ' AMOUNT=' + J(info(u, 'AMOUNT')) + ' want ' + xu.amountSum);

    var e1 = errs().length;
    var p = await pickType('Unchanged Rows', 'AMOUNT', 'avg');
    var bad = checkAvg(keep).concat(checkQtyKept(keep)).concat(checkModified(keep).map(function (s) { return 'Modified ' + s; }));
    rec('A4 AMOUNT -> Average under a search: every group averages its VISIBLE rows (Unchanged $200.00), QTY keeps its total',
      !p && errs().length === e1 && !bad.length, (p || '') + (bad.join('; ') || 'ok') + (errDelta(e1) ? ' errs=' + errDelta(e1) : ''));

    // A5: the search's own recompute (recomputeWrapperTotals, re-running each
    // cell's stamped type) must leave every footer exactly as the refresh did.
    var inPlace = footers(), h2 = window.__CF_HIDES || 0, e2 = errs().length;
    try { H.runTableSearch(); } catch (e) { window.__errors.push('runTableSearch threw: ' + e); }
    await waitFor(function () { return (window.__CF_HIDES || 0) > h2; }, 20000);
    await sleep(200);
    var again = footers();
    rec('A5 the search recompute (recomputeWrapperTotals) agrees with the refresh, cell for cell', J(inPlace) === J(again),
      (J(inPlace) === J(again) ? 'identical: ' + J(again['Unchanged Rows']) : 'refresh=' + J(inPlace) + ' | search=' + J(again)) + (errDelta(e2) ? ' errs=' + errDelta(e2) : ''));
    rec('A6 no page error across the A-vs-B run', errs().length === e0, errDelta(e0) || 'none');
  }

  (async function () {
    try {
      if (!H.runCmp || !H.runAb || !H.compress || !H.runTableSearch) { finish('hook: a comparison entry point is not exported'); return; }
      if (window.__MODE === 'ab') await modeAb();
      else await modeLive(window.__MODE === 'numhidden');
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
