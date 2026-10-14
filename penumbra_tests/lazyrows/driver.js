// lazyrows suite - browser half (2026-09-30). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__HCRESULT = { scn, fp: {...}, census: {...}, errors: [...] }
// and window.__HCDONE = true. run.py loads the same scenario against the
// BASELINE (every row built in full) and the CANDIDATE (lazy rows) and requires
// identical fingerprints; the census (which rows still hold EMPTY cells in a
// SHOWING column) is asserted on the candidate.
//
// A fingerprint is everything a user, an export or a copy could observe: every
// element, attribute and text node of the table / grouped view - EXCEPT the
// inside of a cell in a row nobody can see (display:none) and of a hidden
// column's cell: the candidate builds those empty by design. Such a cell keeps
// its data-column / style / class (format() / heatmap() styles reach it either
// way). Export and copy outputs are compared whole (as SHA-256 + length; the
// first difference ships as a snippet).
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, fp: {}, census: null, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function sha(s) {
    if (s == null) return null;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16);
  }
  // Big strings travel as a digest, a length and a head/tail sample.
  async function big(s) {
    s = (s == null) ? '' : String(s);
    return { sha: await sha(s), len: s.length, head: s.slice(0, 120), tail: s.slice(-120) };
  }

  function fpDom(root, cols) {
    var out = [];
    if (!root) return ['<missing>'];
    cols = cols || [];
    (function walk(el, depth, inHiddenRow) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { var t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(depth + ' #' + t); continue; }
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toLowerCase();
        var col = n.getAttribute('data-column');
        var opaque = tag === 'td' && col !== '#' && (inHiddenRow || (n.style.display === 'none' && cols.indexOf(col) === -1));
        var attrs = [];
        for (var i = 0; i < n.attributes.length; i++) {
          var a = n.attributes[i];
          if (a.name === 'data-pnb-lazy') continue;                         // the candidate's marker
          if (opaque && a.name !== 'data-column' && a.name !== 'style' && a.name !== 'class') continue;
          attrs.push(a.name + '=' + a.value);
        }
        attrs.sort();
        out.push(depth + ' <' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>' + (opaque ? ' [opaque]' : ''));
        if (!opaque) walk(n, depth + 1, inHiddenRow || (tag === 'tr' && (n.style.display === 'none' || n.classList.contains('search-hidden'))));
      }
    })(root, 0, false);
    return out;
  }
  function fpFlat(cols) {
    return { table: fpDom(document.getElementById('resultsTable'), cols), count: $('#resultCount').text(), page: $('#pageInfo').text() };
  }
  function fpGrouped(cols) {
    return { groups: fpDom(document.getElementById('groupedResultsContainer'), cols), count: $('#resultCount').text() };
  }
  // EMPTY cells in SHOWING columns, by where their row is.
  function census() {
    var vis = Object.create(null);
    var ths = document.querySelectorAll('#resultsTable > thead > tr#tableHeader th');
    for (var i = 0; i < ths.length; i++) if (ths[i].style.display !== 'none') vis[ths[i].getAttribute('data-column')] = true;
    var rows = document.querySelectorAll('#resultsTable > tbody > tr');
    var c = { rows: rows.length, lazyRows: 0, lazyShown: 0, lazyShownDisplayed: 0, lazySearchVisible: 0, firstLazyRow: -1, lazyWithContent: 0, lazyAny: 0 };
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], hit = false, shownRow = row.style.display !== 'none' && !row.classList.contains('search-hidden');
      for (var k = 0; k < row.cells.length; k++) {
        var td = row.cells[k];
        if (!td.hasAttribute('data-pnb-lazy')) continue;
        c.lazyAny++;
        if (td.innerHTML !== '') c.lazyWithContent++;
        if (!vis[td.getAttribute('data-column')]) continue;
        c.lazyShown++; hit = true;
        if (shownRow) c.lazyShownDisplayed++;
        if (!row.classList.contains('search-hidden')) c.lazySearchVisible++;
      }
      if (hit) { c.lazyRows++; if (c.firstLazyRow < 0) c.firstLazyRow = r; }
    }
    var g = document.querySelectorAll('#groupedResultsContainer td[data-pnb-lazy]');
    c.groupedLazyShown = 0;
    for (var j = 0; j < g.length; j++) if (g[j].style.display !== 'none') c.groupedLazyShown++;
    try { c.pendingSet = HC.lazyCols ? HC.lazyCols().size : null; } catch (e) { c.pendingSet = 'n/a'; }
    return c;
  }
  function colId(name) { return String(window.__COLS.indexOf(name)); }
  function ids(names) { return names.map(colId); }

  async function boot() {
    // hideLoading can fire before the table exists - wait for its rows too, or a
    // census taken "at load" would count an empty tbody.
    if (!(await until(function () {
      return window.__queryDone >= 1 && hides() >= 1 && document.querySelectorAll('#resultsTable > tbody > tr').length >= window.__rowsFixture.length;
    }, 150000))) throw new Error('boot: the report never finished loading (150 s)');
    await sleep(400);   // deferred tails: presets (100 ms), grouped/pivot handoffs, a11y nudge
  }
  async function settle() { await sleep(250); }
  // Settings panel -> tick / untick columns -> Apply, the REAL path.
  async function setColumns(names, on) {
    HC.openSettingsPanel();
    names.forEach(function (n) {
      var $cb = $('#spColumnList .sp-col-item[data-column="' + colId(n) + '"] .sp-col-check');
      if (!$cb.length) R.notes.push('no panel item for ' + n);
      $cb.prop('checked', on).trigger('change');
    });
    var before = hides();
    $('#spApply').prop('disabled', false).trigger('click');
    await until(function () { return hides() > before; }, 30000);
    await sleep(300);
  }
  async function search(q) {
    var before = hides();
    $('#tableSearch').val(q);
    HC.runTableSearch();
    await until(function () { return hides() > before; }, 30000);
    await sleep(300);
  }
  async function clickSort(name) {
    var th = document.querySelector('#tableHeader th[data-column="' + colId(name) + '"]');
    $(th).trigger('click');
    await sleep(600);   // < 500 rows: the sort runs inline; the re-page follows
  }
  async function copyAs(format, setup) {
    $('input[name="copyFormat"][value="' + format + '"]').prop('checked', true);
    if (setup) setup();
    var n = window.__clip.length;
    $('#confirmCopyBtn').trigger('click');
    await until(function () { return window.__clip.length > n; }, 10000);
    await sleep(50);
    return window.__clip[window.__clip.length - 1] || '';
  }
  async function exportsFp(tag) {
    R.fp['csv' + tag] = await big(HC.getExportData('csv').content);
    R.fp['tsv' + tag] = await big(HC.getExportData('tsv').content);
    R.fp['json' + tag] = await big(HC.getExportData('json').content);
  }

  async function xlsxFp() {
    var wb = await HC.createXlsxWorkbook(true, {});
    var sheets = [];
    (wb && wb.worksheets || []).forEach(function (ws) {
      var rows = [];
      ws.eachRow({ includeEmpty: false }, function (row, rn) {
        var cells = [];
        row.eachCell({ includeEmpty: true }, function (cell, cn) {
          var v = cell.value;
          cells.push([cn, (v && typeof v === 'object') ? JSON.stringify(v) : v,
                      cell.fill ? JSON.stringify(cell.fill) : '', cell.font ? JSON.stringify(cell.font) : '']);
        });
        rows.push([rn, cells]);
      });
      sheets.push([ws.name, rows]);
    });
    return big(JSON.stringify(sheets));
  }

  var S = {
    boot: async function () { R.fp.flat = fpFlat([]); },
    page2: async function () { HC.setPage(2); await settle(); R.fp.flat = fpFlat([]); },
    rpp25: async function () {
      HC.setPage(12); await settle(); R.fp.flat12 = fpFlat([]);
      HC.setPage(9); await settle(); R.fp.flat9 = fpFlat([]);
    },
    rowsall: async function () { R.fp.flat = fpFlat([]); },
    toall: async function () {
      $('#rowsPerPageSelector').val('all').trigger('change'); await settle();
      R.fp.flat = fpFlat([]);
    },
    rowsnone: async function () { R.fp.flat = fpFlat([]); await exportsFp(''); },
    search: async function () {
      await search('H_FLAG = N'); R.fp.flat1 = fpFlat([]);
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
      await search(''); R.fp.flat3 = fpFlat([]);
    },
    sort: async function () {
      await clickSort('V_AMOUNT'); R.fp.flat1 = fpFlat([]);
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
    },
    savedsort: async function () { R.fp.flat = fpFlat([]); },
    presearch: async function () { R.fp.flat = fpFlat([]); },
    show: async function () {
      await setColumns(['H_TEXT', 'H_JSON', 'H_ENT'], true);
      R.fp.flat1 = fpFlat(ids(['H_TEXT', 'H_JSON', 'H_ENT']));
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat(ids(['H_TEXT', 'H_JSON', 'H_ENT']));
    },
    hide: async function () {
      await setColumns(['V_NAME'], false);
      R.fp.flat1 = fpFlat([]);
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
      await exportsFp('');
    },
    group: async function () {
      await until(function () { return $('#groupedResultsContainer').is(':visible'); }, 10000);
      await sleep(300);
      R.fp.grouped = fpGrouped(ids(['H_GROUP', 'H_AMT']));
      await exportsFp('');
    },
    fmt: async function () {
      R.fp.flat1 = fpFlat([]);
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
      HC.setPage(1); await settle();
      await exportsFp('');
    },
    exports: async function () { await exportsFp(''); HC.setPage(2); await settle(); R.fp.flat = fpFlat([]); },
    nested: async function () {
      R.fp.csvFlat = await big(HC.getExportData('csv', { flattenNested: true }).content);
      R.fp.tsvFlat = await big(HC.getExportData('tsv', { flattenNested: true }).content);
      await exportsFp('');
    },
    // One copy format per page load: an earlier format's fill would hide a later one's gap.
    copyhtml: async function () { R.fp.out = await big(await copyAs('html')); HC.setPage(2); await settle(); R.fp.flat = fpFlat([]); },
    copycsv: async function () { R.fp.out = await big(await copyAs('csv')); },
    copytsv: async function () { R.fp.out = await big(await copyAs('tsv')); },
    copyjson: async function () { R.fp.out = await big(await copyAs('json')); },
    copysql: async function () { R.fp.out = await big(await copyAs('sql')); },
    copycustom: async function () {
      R.fp.out = await big(await copyAs('custom', function () { $('#customTemplateInput').val('{V_ID}|{V_NAME}|{V_AMOUNT}|{H_TEXT}'); }));
    },
    copysingle: async function () {
      R.fp.out = await big(await copyAs('single_col', function () {
        $('#copyColumnSelector').html('<option value="V_NAME">V_NAME</option>').val('V_NAME');
      }));
    },
    // A nested sub-table header click re-sorts that column's table in EVERY row.
    nestedsort: async function () {
      var hdr = document.querySelectorAll('#resultsTable tbody tr td[data-column="' + colId('H_JSON') + '"] .nested-json-header .nested-json-cell');
      if (hdr.length < 2) throw new Error('nestedsort: no nested header on screen');
      $(hdr[1]).trigger('click');
      await sleep(300);
      R.fp.flat1 = fpFlat([]);
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
      R.fp.csv = await big(HC.getExportData('csv').content);
    },
    // format(row, Alpha, ...) tests every showing cell: other pages' rows too.
    cfglobal: async function () {
      R.fp.flat1 = fpFlat([]);
      R.fp.html = await big(await copyAs('html'));
      R.fp.xlsx = await xlsxFp();
      HC.setPage(2); await settle(); R.fp.flat2 = fpFlat([]);
    },
    // Rows = None: a search leaves every match displayed - the email embed carries them.
    nonesearch: async function () {
      await search('H_FLAG = N');
      R.fp.email = await big(HC.getExportData('html').content);
      R.fp.csv = await big(HC.getExportData('csv').content);
    },
    // The "Preparing N rows..." path (run.py patches its threshold to 0 for these).
    prepcsv: async function () { R.fp.out = await big(await copyAs('csv')); },
    prepall: async function () {
      $('#rowsPerPageSelector').val('all').trigger('change');
      await sleep(600);
      R.fp.flat = fpFlat([]);
    },
    email: async function () { R.fp.email = await big(HC.getExportData('html').content); },
    pdf: async function () {
      await HC.loadScript('js/jspdf-2.5.1.umd.min.js');
      await HC.loadScript('js/jspdf-autotable-3.5.23.min.js');
      var api = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API;
      if (!api || !api.autoTable) throw new Error('pdf: jsPDF / autotable did not load');
      window.__pdfTables = [];
      var orig = api.autoTable;
      api.autoTable = function (o) {
        try { window.__pdfTables.push(JSON.stringify({ head: o && o.head, body: o && o.body, foot: o && o.foot })); } catch (e) { window.__pdfTables.push('unserialisable: ' + e); }
        return orig.apply(this, arguments);
      };
      await HC.generatePdfContent();
      R.fp.pdf = await big(window.__pdfTables.join('\n'));
      R.fp.pdfTables = window.__pdfTables.length;
    },
    xlsx: async function () { R.fp.xlsx = await xlsxFp(); },
    killswitch: async function () {
      // &lazycells=off: every cell of every row built up front - compare ALL cells.
      $('#rowsPerPageSelector').val('all').trigger('change'); await settle();
      R.fp.flat = fpFlat(window.__COLS.map(function (n) { return colId(n); }));
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      R.census0 = census();
      await S[SCN]();
      await sleep(50);
      R.census = census();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    R.missing = window.__HC_MISSING || [];
    R.clipErr = window.__clipErr || '';
    R.rrs = window.__rrsCensus || [];
    R.loadMsgs = window.__loadMsgs || [];
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
