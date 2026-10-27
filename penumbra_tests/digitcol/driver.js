// digitcol suite - browser half (2026-10-25). Runs ONE scenario (?scn=) against
// whichever main.js / search_builder.js the page loaded and publishes
//   window.__DCRESULT = { scn, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__DCDONE = true. run.py collects the asserts.
//
// The fixture's columns 2021 and 2022 are named only in digits, as a PIVOT query's are;
// jQuery's data('colname') hands their headers back as NUMBERS (P-* proves it on every
// run). Every check reads a reader of that value: the grouping dialog's pickers (with and
// without the search builder), the format() / rewrite() passes, data(colorder / colvisible
// / colsort / coltotal), the API snippet's field list, the chart drill breakdown, the
// scheduler's change-column list and the group| / sort| / copy_distinct| commands.
(function () {
  var JG = window.__JG || {};
  var SCN = window.__SCN;
  var FX = window.__rowsFixture;
  var R = { scn: SCN, asserts: [], obs: {}, notes: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__JG_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function colId(name) { return String(window.__COLS.indexOf(name)); }
  function th(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  function errsSince(n) { return errs().slice(n); }
  function S(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  // a step: runs fn, catches what it throws, and reports the page errors it raised
  async function step(fn) {
    var e0 = errs().length, out = { threw: null, val: undefined };
    try { out.val = await fn(); } catch (e) { out.threw = String((e && e.message) || e); }
    await sleep(60);
    out.errs = errsSince(e0);
    return out;
  }
  function clean(o) { return !o.threw && !o.errs.length; }
  function why(o) { return (o.threw ? 'threw: ' + o.threw + '; ' : '') + (o.errs.length ? 'page errors: ' + o.errs.join(' | ') : ''); }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(500);   // deferred tails: presets, a11y nudge, the snippet's own render
  }
  function premise() {
    var t = th('2021'), dv = t ? $(t).data('colname') : undefined;
    R.obs.flatHead = Array.prototype.map.call(document.querySelectorAll('#tableHeader th'), function (h) { return h.getAttribute('data-colname'); });
    var sbOk = !!(window._penumbraSearchBuilder && window._penumbraSearchBuilder.getAvailableColumns) === !!window.__SB;
    var nestOk = SCN === 'plainsb' ? (!th('J_SUBS') && !!th('V_AMT')) : !!th('J_SUBS');   // plainsb: no nested-table column
    var ok = !!t && dv === 2021 && typeof dv === 'number' && nestOk && sbOk && FX.length === 60
      && document.querySelectorAll('#resultsTable tbody tr').length === 60;
    rec('P-' + SCN, ok, 'data(colname) of the 2021 heading = ' + S(dv) + ' (' + typeof dv + '); search builder ' + (window.__SB ? 'loaded' : 'absent') + ' -> ' + sbOk
      + '; rows ' + document.querySelectorAll('#resultsTable tbody tr').length + '; head ' + S(R.obs.flatHead));
  }

  // ---- the grouping dialog, the real way (the Group icon) -------------------------
  function pickerItems(id) {
    return Array.prototype.map.call(document.querySelectorAll('#' + id + ' .pcs-dropdown .pcs-item:not(.pcs-item-bucket):not(.pcs-item-none)'),
      function (el) { return { v: el.getAttribute('data-value'), t: el.textContent, nested: el.classList.contains('pcs-item-nested') }; });
  }
  function pickCustom(id, value) {
    var items = document.querySelectorAll('#' + id + ' .pcs-dropdown .pcs-item'), hit = null, seen = [];
    for (var i = 0; i < items.length; i++) {
      seen.push(items[i].getAttribute('data-value'));
      if (items[i].getAttribute('data-value') === value) hit = items[i];
    }
    if (!hit) throw new Error('#' + id + ' offers no "' + value + '" (offers: ' + seen.join(', ') + ')');
    clickEl(document.querySelector('#' + id + ' .pcs-selected'));
    clickEl(hit);
    var got = $('#' + id + ' .pcs-selected').attr('data-value');
    if (got !== value) throw new Error('#' + id + ' holds "' + got + '" after picking "' + value + '"');
  }
  function readBands() {
    return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-group-depth="0"]'), function (w) {
      return { key: w.getAttribute('data-group-key'), col: w.getAttribute('data-group-col'), n: w.querySelectorAll('tbody tr').length };
    });
  }
  function wantBands(col) {
    var w = Object.create(null);
    FX.forEach(function (r) { var k = String(r[col]); w[k] = (w[k] || 0) + 1; });
    return w;
  }
  function bandsMatch(col, bands) {
    var w = wantBands(col), ks = Object.keys(w);
    var bad = bands.filter(function (b) { return b.col !== col || w[b.key] !== b.n; });
    return ks.length >= 3 && bands.length === ks.length && !bad.length;
  }
  async function scnDialog() {
    var lb = document.getElementById('groupingLightbox');
    var shownBefore = getComputedStyle(lb).display !== 'none';
    var o = await step(function () { clickEl(document.getElementById('groupTableBtn')); return sleep(150); });
    var shown = getComputedStyle(lb).display !== 'none';
    var lv = pickerItems('groupingColumnSelector'), ag = pickerItems('groupAggColumn');
    R.obs.level0 = lv.map(function (x) { return (x.nested ? '~' : '') + x.v; });
    rec('G-' + SCN + '-open', !shownBefore && shown && clean(o), 'shown ' + shownBefore + ' -> ' + shown + '; ' + why(o));
    var vals = lv.map(function (x) { return x.v; }), flat = lv.filter(function (x) { return !x.nested; }).map(function (x) { return x.v; });
    var nested = lv.filter(function (x) { return x.nested; }).map(function (x) { return x.v; });
    var want = ['2021', '2022', 'V_ID', 'V_NAME', 'V_STATUS'];
    var okList = want.every(function (c) { return flat.indexOf(c) >= 0; }) && ['SUB_NAME', 'SUB_AMT', 'SUB_ROLE'].every(function (c) { return nested.indexOf(c) >= 0; })
      && vals.indexOf('J_SUBS') < 0 && flat.indexOf('2021') < flat.indexOf('V_STATUS')
      && lv.every(function (x) { return x.t === x.v; })
      && want.every(function (c) { return ag.some(function (x) { return x.v === c; }); });
    rec('G-' + SCN + '-list', okList, 'level 0: ' + S(R.obs.level0) + '; summary column picker: ' + ag.length + ' items');
    // a pick of a column named in digits groups by its values
    var g = await step(async function () {
      pickCustom('groupingColumnSelector', '2021');
      var before = hides();
      clickEl(document.getElementById('confirmGroupingBtn'));
      await until(function () { return hides() > before && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0; }, 20000);
      await sleep(300);
      return readBands();
    });
    R.obs.bands2021 = g.val;
    rec('G-' + SCN + '-by2021', clean(g) && bandsMatch('2021', g.val || []), 'bands ' + S(g.val) + ' want ' + S(wantBands('2021')) + '; ' + why(g));
  }

  // ---- plainsb: no nested-table column, so the dialog opened before the fix too --------------------
  // The one thing its pickers list differently now: a numeric column named in digits (2022, 60 values)
  // offers the bin entries every numeric column offers (V_AMT here) - data()'s number found no values
  // for the bin test before. The columns themselves are the same, in the same order.
  async function scnPlain() {
    var lb = document.getElementById('groupingLightbox');
    var o = await step(function () { clickEl(document.getElementById('groupTableBtn')); return sleep(150); });
    var shown = getComputedStyle(lb).display !== 'none';
    rec('G-plainsb-open', shown && clean(o), 'shown ' + shown + '; ' + why(o));
    var lv = pickerItems('groupingColumnSelector').map(function (x) { return x.v; });
    R.obs.level0 = lv;
    rec('G-plainsb-list', S(lv) === S(['#', '2021', '2022', 'V_ID', 'V_NAME', 'V_STATUS', 'V_AMT']), 'level 0 ' + S(lv));
    // (2026-10-26, grpbucket) a column's bucket choices are the dropdown beside the picker: pick it, read them
    var of = function (c) {
      try { pickCustom('groupingColumnSelector', c); } catch (e) { return ['ERR ' + e.message]; }
      var s = document.getElementById('groupingBucket1');
      if (!s || s.style.display === 'none') return [];
      return Array.prototype.map.call(s.options, function (o) { return o.value; }).filter(function (v) { return v; }).map(function (v) { return v.slice(1); }).sort();
    };
    R.obs.buckets = { '2022': of('2022'), V_AMT: of('V_AMT') };
    rec('G-plainsb-buckets', of('V_AMT').length >= 1 && S(of('2022')) === S(of('V_AMT')), '2022: ' + S(of('2022')) + ', V_AMT: ' + S(of('V_AMT')));
  }

  // ---- the sweep: every other reader -----------------------------------------------------
  function cellsOf(name) {
    var id = colId(name);
    return Array.prototype.map.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
      return tr.querySelector("td[data-column='" + id + "']");
    });
  }
  function rowNum(td) { var h = td && td.parentNode.querySelector("td[data-column='#']"); return h ? parseInt(h.textContent, 10) : NaN; }
  async function scnSweep() {
    var snip = '';
    try { snip = (JG.snippetText && JG.snippetText()) || ''; } catch (e) { }
    R.obs.snippetLoaded = /DCSNIP/.test(snip);
    // format(cell, V_STATUS, V_STATUS='Open', ...) - the pass maps every heading
    var st = cellsOf('V_STATUS'), badF = [];
    st.forEach(function (td) {
      if (!td) { badF.push('no cell'); return; }
      var want = td.textContent.trim() === 'Open', has = /rgb\(255, 0, 0\)/.test(td.getAttribute('style') || '');
      if (want !== has) badF.push(rowNum(td) + ':' + td.textContent.trim() + ':' + (td.getAttribute('style') || ''));
    });
    var opens = st.filter(function (td) { return td && td.textContent.trim() === 'Open'; }).length;
    rec('F-cf', R.obs.snippetLoaded && opens > 0 && badF.length === 0, 'snippet loaded ' + R.obs.snippetLoaded + '; Open cells ' + opens + '; wrong: ' + S(badF.slice(0, 5)));
    // rewrite(V_NAME, '<b class="dcrw">{val}</b>')
    var nm = cellsOf('V_NAME'), badR = nm.filter(function (td) { return !td || !td.querySelector('b.dcrw'); }).length;
    rec('F-rw', nm.length === 60 && badR === 0, 'V_NAME cells without the rewrite: ' + badR + ' of ' + nm.length);

    // the grouping picker's own list, read directly
    var gc = await step(function () { return JG.getColumnsForGrouping(); });
    var gv = (gc.val && gc.val.visible) || [];
    rec('U-grpcols', clean(gc) && gv.indexOf('2021') >= 0 && gv.every(function (n) { return typeof n === 'string'; }), 'visible ' + S(gv) + '; ' + why(gc));
    // the search builder's list without main.js's API (its own reader)
    var api = window._penumbraSearchAPI, keep = api && api.getColumns;
    var fb = await step(function () { if (api) api.getColumns = undefined; try { return window._penumbraSearchBuilder.getAvailableColumns(); } finally { if (api) api.getColumns = keep; } });
    var fv = (fb.val && fb.val.visible) || [];
    rec('U-sbfallback', clean(fb) && fv.indexOf('2021') >= 0 && fv.every(function (n) { return typeof n === 'string'; }), 'visible ' + S(fv) + '; ' + why(fb));
    // data(coltotal, standard): every named heading
    var names = Object.create(null);
    Array.prototype.forEach.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (h) { names[String(h.getAttribute('data-colname')).toUpperCase()] = 1; });
    var wantCt = Object.keys(names).length;
    var ct = await step(function () { return JG._penumbraColTotal('standard'); });
    rec('U-coltotal', clean(ct) && ct.val === wantCt && wantCt >= 7, 'coltotal(standard) = ' + S(ct.val) + ', headings ' + wantCt + '; ' + why(ct));
    // data(colorder, 2021) / data(colvisible, 2021) - engine A
    var vis = Array.prototype.slice.call(document.querySelectorAll('#resultsTable thead th')).filter(function (h) { return $(h).is(':visible'); });
    var wantOrd = String(vis.indexOf(th('2021')) + 1);
    var co = await step(function () { return JG.penumbraDataLookup('colorder', '2021'); });
    rec('U-colorder', clean(co) && co.val && co.val.v === wantOrd && wantOrd !== '0', 'colorder = ' + S(co.val) + ' want ' + wantOrd + '; ' + why(co));
    var cv = await step(function () { return JG.penumbraDataLookup('colvisible', '2021'); });
    rec('U-colvisible', clean(cv) && cv.val && cv.val.v === 'true', 'colvisible = ' + S(cv.val) + '; ' + why(cv));
    // the nested-column plan Copy / Download read (2023 is a nested-table column named in digits): names as text - Copy
    // with Custom Template upper-cases each plan's parentName
    var np = await step(function () { return JG.getNestedColumnPlan(); });
    var npv = np.val || [], np23 = npv.filter(function (p) { return String(p.parentName) === '2023'; })[0];
    rec('U-nestplan', clean(np) && npv.length >= 2 && npv.every(function (p) { return typeof p.parentName === 'string'; })
      && !!np23 && np23.subNames.indexOf('N_KIND') >= 0,
      'plan ' + S(npv.map(function (p) { return [p.parentName, typeof p.parentName, p.subNames]; })) + '; ' + why(np));
    // the API snippet's field list: names as text (row["2021"], not row[2021])
    var ac = await step(function () { return JG.getApiSnippetSampleColumns(0); });
    var acv = ac.val || [];
    rec('U-apicols', clean(ac) && acv.indexOf('2021') >= 0 && acv.every(function (n) { return typeof n === 'string'; }), 'fields ' + S(acv) + '; ' + why(ac));
    // a pivot's rules read first from the snippet (they map the headings too)
    var rf = await step(function () { return JG._pnbPivotRulesFirst(null); });
    rec('U-rulesfirst', clean(rf) && !!rf.val && rf.val.cf && rf.val.cf.length >= 1, 'rules = ' + (rf.val ? 'cf ' + rf.val.cf.length + ', rw ' + rf.val.rw.length : S(rf.val)) + '; ' + why(rf));
    // the report snippet drawn from the page's own headings (no row maps handed in)
    $('#reportSnippetOutput').empty();
    var sd = await step(function () { return JG.renderReportSnippet(); });
    rec('U-snippetdom', clean(sd) && /DCSNIP/.test($('#reportSnippetOutput').text()), 'output "' + $('#reportSnippetOutput').text().trim().slice(0, 60) + '"; ' + why(sd));
    // the chart drill breakdown over three rows: the 2021 column shows their values
    var m = (JG.master && JG.master()) || [], three = m.slice(0, 3);
    var cd = await step(function () { JG._showChartDrillBreakdown(three, ['DC drill'], [], null); return sleep(100); });
    var tb = document.querySelector('.infobox-drill-table.pnb-breakdown'), cdIdx = -1, cdVals = [];
    if (tb) {
      var hs = Array.prototype.map.call(tb.querySelectorAll('thead th'), function (h) { return h.textContent.trim(); });
      cdIdx = hs.findIndex(function (t) { return /^2021/.test(t); });
      if (cdIdx >= 0) cdVals = Array.prototype.map.call(tb.querySelectorAll('tbody tr'), function (tr) { return tr.cells[cdIdx] ? tr.cells[cdIdx].textContent.trim() : null; });
      R.obs.drillHead = hs;
    }
    var cdWant = three.map(function (r) { return String(r.get('2021')); });
    rec('U-chartdrill', clean(cd) && !!tb && cdIdx >= 0 && S(cdVals) === S(cdWant), 'head ' + S(R.obs.drillHead) + '; 2021 cells ' + S(cdVals) + ' want ' + S(cdWant) + '; ' + why(cd));
    $('.infobox-dialog, .pnb-infobox, .infobox-overlay').remove();
    // the scheduler's change-column list
    var sc = await step(function () { JG.applyTaskTypeUI('EMAIL'); });
    var scv = Array.prototype.map.call(document.querySelectorAll('#schedColumnSelector input[type="checkbox"]'), function (i) { return i.value; });
    rec('U-sched', clean(sc) && scv.indexOf('2021') >= 0 && scv.indexOf('V_STATUS') >= 0, 'boxes ' + S(scv) + '; ' + why(sc));
    // copy_distinct|2021: the column found by its name, its distinct values copied
    var want2021 = Object.create(null);
    cellsOf('2021').forEach(function (td) { var t = td ? td.textContent.trim() : ''; if (t) want2021[t] = 1; });
    var kd = await step(async function () { JG.executeChainStep('copy_distinct|2021'); await sleep(100); });
    var clip = (window.__clip || []).slice(-1)[0] || '';
    var got = clip ? clip.split(';').sort() : [];
    rec('K-distinct', clean(kd) && S(got) === S(Object.keys(want2021).sort()), 'copied "' + clip + '" want ' + S(Object.keys(want2021).sort()) + '; ' + why(kd));
    // the Copy dialog's "distinct values of one column": the picked column (text) found among the headings
    var n0 = (window.__clip || []).length;
    var cdl = await step(async function () { $('#copyColumnSelector').val('2021'); clickEl(document.getElementById('confirmCopyBtn')); await sleep(150); });
    var clip2 = (window.__clip || []).length > n0 ? window.__clip[window.__clip.length - 1] : '';
    var got2 = clip2 ? clip2.split(';').sort() : [];
    rec('U-copydlg', clean(cdl) && S(got2) === S(Object.keys(want2021).sort()), 'copied "' + clip2 + '"; ' + why(cdl));
    // sort|2021|desc: sorted by the column; its sort keeps data()'s own value (a header click's)
    var ks = await step(async function () { JG.executeChainStep('sort|2021|desc'); await sleep(300); });
    var after = cellsOf('2021').map(function (td) { return td ? parseFloat(td.textContent.replace(/[^0-9.\-]/g, '')) : NaN; });
    var desc = after.length === 60 && after.every(function (v, i) { return i === 0 || after[i - 1] >= v; });
    var crit = (JG.sortCrit && JG.sortCrit()) || [];
    R.obs.sortCrit = crit;
    rec('K-sort', clean(ks) && desc && crit.length === 1 && crit[0].colIdentifier === 2021 && crit[0].direction === 'desc',
      'desc order ' + desc + '; criteria ' + S(crit) + '; ' + why(ks));
    // data(colsort, 2021) with that sort in place
    var cs = await step(function () { return JG.penumbraDataLookup('colsort', '2021'); });
    rec('U-colsort', clean(cs) && cs.val && cs.val.v === 'desc', 'colsort = ' + S(cs.val) + '; ' + why(cs));
    // group|V_STATUS: the headings before it (2021, 2022) are read on the way (last: it leaves the view grouped)
    var kg = await step(async function () {
      var before = hides();
      JG.executeChainStep('group|V_STATUS');
      await until(function () { return hides() > before && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0; }, 20000);
      await sleep(300);
      return readBands();
    });
    rec('K-group', clean(kg) && bandsMatch('V_STATUS', kg.val || []), 'bands ' + S(kg.val) + '; ' + why(kg));
    // pivot|V_STATUS||2021|sum: the value column found by its name and handed to the builder (no Generate here)
    var kp = await step(async function () { JG.executeChainStep('pivot|V_STATUS||2021|sum'); await sleep(100); });
    var aggTxt = $('#pivot-agg-table-body').text() + ' ' + $('#pivot-agg-table-body').find('select, input').map(function () { return $(this).val(); }).get().join(' ');
    var notFound = /Value column '2021' not found/.test(document.body.innerText);
    rec('K-pivot', clean(kp) && !notFound && $('#pivot-agg-table-body tr').length >= 1 && /2021/.test(aggTxt),
      'agg rows ' + $('#pivot-agg-table-body tr').length + ' "' + aggTxt.trim().slice(0, 80) + '"; not-found notice ' + notFound + '; ' + why(kp));
  }

  (async function main() {
    try {
      await boot();
      R.obs.bootErrors = errs().slice();
      premise();
      if (SCN === 'dlg' || SCN === 'dlgsb') await scnDialog();
      else if (SCN === 'sweep') await scnSweep();
      else if (SCN === 'plainsb') await scnPlain();
      else R.notes.push('unknown scenario ' + SCN);
    } catch (e) {
      R.fatal = String((e && e.stack) || e).slice(0, 500);
    }
    R.errors = errs();
    R.missing = window.__JG_MISSING || null;
    R.hookErr = window.__JG_ERR || window.__JG_ERR2 || null;
    window.__DCRESULT = R;
    window.__DCDONE = true;
    document.getElementById('out').textContent = JSON.stringify(R, null, 1);
  })();
})();
