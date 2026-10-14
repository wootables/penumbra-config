// msheet suite - browser half (2026-10-02). Runs ONE scenario (?scn=) against
// whichever main.js the page loaded and publishes
//   window.__MSRESULT = { scn, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__MSDONE = true. run.py collects the asserts; the parity scenario's
// parsed rows go on to the PHP half (test_msheet.php --browser-json).
//
// Hooks (run.py injects them as the main.js closure's first statement):
//   __MS.parse / ensureXLSX / setGrouping / rebuild, __MS.st() = the view globals,
//   __MS.set({...}) writes them.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, asserts: [], obs: {}, errors: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function J(v) { return JSON.stringify(v); }
  // Read LAZILY: this file runs before main.js's ready() callback, which is
  // where the hooks are created - a snapshot taken here is forever empty.
  var MS = new Proxy({}, { get: function (t, k) { return (window.__MS || {})[k]; } });
  function st() { try { return MS.st(); } catch (e) { return { err: String(e) }; } }

  // ---- goldens (the browser's form: headers UPPERCASED, every value a string) ----
  var TG = [
    { WORKSHEET: 'Jan', ID: '1001', NAME: 'Alpha', AMOUNT: '120', NOTE: '' },
    { WORKSHEET: 'Jan', ID: '1002', NAME: 'Bravo', AMOUNT: '80', NOTE: '' },
    { WORKSHEET: 'Jan', ID: '1003', NAME: 'Charlie', AMOUNT: '45', NOTE: '' },
    { WORKSHEET: 'Feb', ID: '2001', NAME: 'Delta', AMOUNT: '300', NOTE: 'late' },
    { WORKSHEET: 'Feb', ID: '2002', NAME: 'Echo', AMOUNT: '10', NOTE: '' },
    { WORKSHEET: 'Mar', ID: '3001', NAME: '', AMOUNT: '75', NOTE: '' },
    { WORKSHEET: 'Mar', ID: '3002', NAME: '', AMOUNT: '60', NOTE: '' }];
  var SG = [{ ID: '1', NAME: 'One', AMOUNT: '10' }, { ID: '2', NAME: 'Two', AMOUNT: '20' }, { ID: '3', NAME: 'Three', AMOUNT: '30' }];
  var OG = [{ ID: '1', NAME: 'One', AMOUNT: '10', 'MIXED CASE': 'a' }, { ID: '2', NAME: 'Two', AMOUNT: '', 'MIXED CASE': 'b' },
            { ID: '3', NAME: '', AMOUNT: '30', 'MIXED CASE': '' }];
  var CG = [{ WORKSHEET_2: 'A', WORKSHEET: 'north', ID: '1' }, { WORKSHEET_2: 'A', WORKSHEET: 'south', ID: '2' },
            { WORKSHEET_2: 'B', WORKSHEET: '', ID: '3' }];
  var HG = [{ ID: '7', NAME: 'Seven' }, { ID: '8', NAME: 'Eight' }];
  var LG = [{ WORKSHEET: 'East', REGION_ID: '11', TOTAL: '500', OWNER: '' }, { WORKSHEET: 'East', REGION_ID: '12', TOTAL: '250', OWNER: '' },
            { WORKSHEET: 'West', REGION_ID: '21', TOTAL: '900', OWNER: 'kim' }];
  var KG = [{ WORKSHEET: 'One', AMOUNT: '5', NAME: 'x' }, { WORKSHEET: 'Two', AMOUNT: '6', NAME: 'y' }];
  // Key ORDER matters (the [IMPORT] resolver reads the first row's keys), so the
  // compare is on the serialised form, not a deep-equal that ignores order.
  function same(a, b) { return J(a) === J(b); }

  // ---- reading the page --------------------------------------------------
  function toasts() { return ($('#action_overlay').text() || '').replace(/\s+/g, ' ').trim(); }
  function bands() {
    return $('#groupedResultsContainer .group-wrapper').filter(function () { return $(this).parent().closest('.group-wrapper').length === 0; })
      .map(function () {
        var $h = $(this).children('.group-header');
        return { key: this.getAttribute('data-group-key'), name: $h.find('.group-name').first().text(),
                 count: $h.find('.group-count').first().text(), open: this.classList.contains('open') };
      }).get();
  }
  function grouped() { return $('#groupedResultsContainer').is(':visible') && bands().length > 0; }
  function flatRows() { return $('#resultsTable').is(':visible') ? $('#resultsTable tbody tr').length : -1; }
  // The flat table as rendered: the header's column names (data-colname; data-column
  // is the column's INDEX) and each row's cells.
  function grid() {
    return {
      cols: $('#tableHeader th').map(function () { return String(this.getAttribute('data-colname') || ''); }).get(),
      rows: $('#resultsTable tbody tr').map(function () { return [$(this).children('td').map(function () { return $(this).text().trim(); }).get()]; }).get()
    };
  }
  // One rendered column's cells, top to bottom ([] while the flat table is hidden).
  function colShown(name) {
    if (!$('#resultsTable').is(':visible')) return [];
    var g = grid(), i = g.cols.indexOf(name);
    return g.rows.map(function (r) { return (i >= 0 && i < r.length) ? r[i] : '?'; });
  }
  function errToasts() {
    return $('#action_overlay .pnb-toast-card.pnbt-err .pnb-toast-msg').map(function () { return $(this).text().replace(/\s+/g, ' ').trim(); }).get();
  }
  function errsFrom(n0, c0, j0) {
    return window.__errors.slice(n0).concat(window.__consoleErrors.slice(c0).map(function (m) { return 'console.error: ' + m; }))
      .concat(window.__rejections.slice(j0).map(function (m) { return 'rejection: ' + m; }));
  }
  function mark() { return [window.__errors.length, window.__consoleErrors.length, window.__rejections.length]; }

  // ---- driving -------------------------------------------------------------
  async function boot() {
    await until(function () { return window.__queryDone >= 1 && (window.__MS_HIDES || 0) >= 1; }, 60000);
    await sleep(400);
    var hooked = !window.__MS_ERR && !!window.__MS && typeof window.__MS.st === 'function' && typeof window.__MS.set === 'function';
    rec('P-boot-' + SCN, hooked && flatRows() === 6, 'hooks ' + (hooked ? 'ok' : (window.__MS_ERR || 'MISSING')) + ', base report rows ' + flatRows());
  }
  async function fixture(name) {
    var r = await fetch('fixtures/' + name, { cache: 'no-store' });
    return new File([await r.arrayBuffer()], name);
  }
  function drop(file) {
    var dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('resultsHeader').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }
  // parse -> save -> query -> render. Waits for the query the import starts and
  // then for the view it should land in (a timeout here just means the asserts
  // will say what it did instead).
  async function dropAndSettle(file, want) {
    var q0 = window.__queryDone, s0 = window.__saves.length;
    drop(file);
    await until(function () { return window.__queryDone > q0; }, 20000);
    await until(want || function () { return false; }, want ? 8000 : 1500);
    await sleep(700);
    return { saved: window.__saves.length > s0, queried: window.__queryDone > q0 };
  }
  async function xlsxReady() { await new Promise(function (res) { MS.ensureXLSX(res); }); }
  function bookFrom(sheets) {   // in-page workbook: [{ name, aoa }]
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (s) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name); });
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }
  function rowsOf(b) { return Array.isArray(b) ? b : (b && b.rows); }   // the pre-change parser returned the array itself

  var S = {
    // The real parser on every fixture - the goldens here, and the rows handed to
    // the PHP half for the server/browser parity check.
    parity: async function () {
      await boot();
      await xlsxReady();
      var files = ['three_tabs.xlsx', 'single.xlsx', 'collide.xlsx', 'hiddenfirst.xlsx', 'legacy2003.xls', 'onetab.xlsx', 'onetab2003.xls', 'case.xlsx', 'three_tabs.ods'];
      var out = {}, books = {};
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        try {
          var b = MS.parse(await (await fetch('fixtures/' + f, { cache: 'no-store' })).arrayBuffer());
          out[f] = rowsOf(b);
          books[f] = Array.isArray(b) ? { legacyArray: true } : { sheets: b.sheets, skipped: b.skipped, sheetColumn: b.sheetColumn };
        } catch (e) { out[f] = { error: String(e && e.message) }; }
      }
      R.obs.parity = out;
      R.obs.books = books;
      var bk = books['three_tabs.xlsx'] || {};
      rec('J-three', same(out['three_tabs.xlsx'], TG), J(out['three_tabs.xlsx']));
      rec('J-meta', same(bk.sheets, [{ name: 'Jan', rows: 3 }, { name: 'Feb', rows: 2 }, { name: 'Mar', rows: 2 }]) &&
          same(bk.skipped, [{ name: 'Lookup', reason: 'hidden' }, { name: 'Notes', reason: 'no data' }, { name: 'Template', reason: 'no data' }]) &&
          bk.sheetColumn === 'WORKSHEET', J(bk));
      // Rows only (the golden itself says whether a sheet column exists), so each
      // of these means the same thing on the pre-change parser, which returned
      // the bare array and no metadata.
      rec('J-single', same(out['single.xlsx'], SG), J(out['single.xlsx']));
      rec('J-onetab', same(out['onetab.xlsx'], OG), J(out['onetab.xlsx']));
      rec('J-collide', same(out['collide.xlsx'], CG), J(out['collide.xlsx']));
      rec('J-hiddenfirst', same(out['hiddenfirst.xlsx'], HG), J(out['hiddenfirst.xlsx']));
      rec('J-legacy', same(out['legacy2003.xls'], LG), J(out['legacy2003.xls']));
      rec('J-case', same(out['case.xlsx'], KG), J(out['case.xlsx']));
      // .ods: SheetJS 0.20.3 does not read an ODS sheet's visibility, so the HIDDEN
      // Lookup tab is stacked like a visible one (last, in tab order). This pins that
      // documented limitation (help_content.php, the .ods row): if a SheetJS upgrade
      // starts flagging hidden ODS tabs this goes red - then drop the Lookup rows
      // from ODSG and the exception from the help text.
      var ODSG = TG.map(function (r) { var o = JSON.parse(J(r)); o.CODE = ''; o.LABEL = ''; return o; }).concat([
        { WORKSHEET: 'Lookup', ID: '', NAME: '', AMOUNT: '', NOTE: '', CODE: 'A', LABEL: 'Active' },
        { WORKSHEET: 'Lookup', ID: '', NAME: '', AMOUNT: '', NOTE: '', CODE: 'C', LABEL: 'Closed' }]);
      rec('J-ods', same(out['three_tabs.ods'], ODSG), J(out['three_tabs.ods']) + ' ' + J(books['three_tabs.ods']));
      // Nothing to import anywhere: the errors a one-sheet workbook has always given.
      // "has headers but no data rows" needs rows the filters REMOVE (a Total row);
      // a header row alone has always been the first message.
      var msg = function (buf) { try { MS.parse(buf); return '(no error)'; } catch (e) { return String(e && e.message); } };
      var e1 = msg(bookFrom([{ name: 'S1', aoa: [] }, { name: 'S2', aoa: [] }]));
      var e2 = msg(bookFrom([{ name: 'Only', aoa: [['ID', 'NAME']] }]));
      var e3 = msg(bookFrom([{ name: 'Only', aoa: [['ID', 'NAME', 'AMOUNT'], ['Total', '', '']] }, { name: 'Blank', aoa: [] }]));
      rec('J-errors', e1 === 'Spreadsheet must have a header row and at least one data row.' &&
          e2 === 'Spreadsheet must have a header row and at least one data row.' && e3 === 'Spreadsheet has headers but no data rows.',
          'empty: "' + e1 + '" | header row only: "' + e2 + '" | only a Total row: "' + e3 + '"');
    },

    // The headline: three tabs with data, one hidden, two without data.
    stack: async function () {
      await boot();
      var m = mark();
      var r = await dropAndSettle(await fixture('three_tabs.xlsx'), grouped);
      var sv = window.__saves[window.__saves.length - 1] || {};
      rec('G-save', r.saved && window.__saves.length === 1 && sv.name === 'THREE_TABS' && sv.row_count === 7 && same(sv.rows, TG),
          'saves ' + window.__saves.length + ', name ' + sv.name + ', row_count ' + sv.row_count + ', rows ' + J(sv.rows));
      var s = st(), b = bands();
      R.obs.bands = b; R.obs.st = s;
      rec('G-grouped', grouped() && s.grouping === 'WORKSHEET', 'grouped view ' + grouped() + ', grouping ' + J(s.grouping));
      rec('G-order', same(b.map(function (x) { return x.name; }), ['Jan', 'Feb', 'Mar']), 'bands ' + J(b.map(function (x) { return x.name; })));
      rec('G-counts', same(b.map(function (x) { return x.count; }), ['3', '2', '2']), 'counts ' + J(b.map(function (x) { return x.count; })));
      rec('G-collapsed', b.length === 3 && b.every(function (x) { return !x.open; }), 'open ' + J(b.map(function (x) { return x.open; })));
      rec('G-csort', !!(s.csort && s.csort.WORKSHEET) && same(s.csort.WORKSHEET.values, ['Jan', 'Feb', 'Mar']), 'customSortOrders ' + J(s.csort));
      var t = toasts();
      R.obs.toasts = t;
      rec('G-toast', t.indexOf('IMPORTED: 3 worksheets from three_tabs.xlsx as one table, grouped by WORKSHEET in tab order: ' +
          'Jan (3 rows), Feb (2 rows), Mar (2 rows). Skipped: Lookup (hidden), Notes (no data), Template (no data).') !== -1, t.slice(0, 600));
      rec('G-pending', s.pendingSheet === null, 'pendingImportSheetGroup ' + J(s.pendingSheet));
      var e = errsFrom.apply(null, m);
      rec('G-err', !e.length, e.join(' | ') || 'no error');
    },

    // One tab with data (two empty tabs): exactly what it always was - flat, no
    // WORKSHEET column, no notice, no sort order written.
    single: async function () {
      await boot();
      var m = mark();
      var r = await dropAndSettle(await fixture('single.xlsx'), function () { return flatRows() === 3; });
      var sv = window.__saves[window.__saves.length - 1] || {};
      rec('F-save', r.saved && same(sv.rows, SG), 'rows ' + J(sv.rows));
      var s = st();
      rec('F-flat', !grouped() && flatRows() === 3 && !s.grouping, 'grouped ' + grouped() + ', flat rows ' + flatRows() + ', grouping ' + J(s.grouping));
      rec('F-csort', !(s.csort && Object.prototype.hasOwnProperty.call(s.csort, 'WORKSHEET')), 'customSortOrders ' + J(s.csort));
      rec('F-toast', toasts().indexOf('IMPORTED:') === -1, toasts().slice(0, 300));
      var e = errsFrom.apply(null, m);
      rec('F-err', !e.length, e.join(' | ') || 'no error');
    },

    // Dropped while the report is GROUPED with a top-1 "(Other)" limit, sorted by
    // count, opened to depth 1 and summing AMOUNT. The query's view stash keeps
    // that grouping; the import's must replace it - and start from the defaults.
    prevgroup: async function () {
      await boot();
      try {
        MS.setGrouping('DEPT');
        MS.set({ groupLimit: { n: 1, dir: 'top', other: true, minRows: 0 }, groupSort: { key: 'count', dir: 'desc' },
                 startDepth: 1, agg: { column: 'AMOUNT', type: 'sum' } });
        $('#resultsTable').hide();
        $('#groupedResultsContainer').show();
        MS.rebuild($('#tableHeader th').filter(function () { return this.style.display !== 'none'; }).map(function () { return $(this).data('column'); }).get());
      } catch (e) { R.obs.setupErr = String(e); }
      var s0 = st(), b0 = bands();
      R.obs.before = { st: s0, bands: b0 };
      rec('P-prevgroup', s0.grouping === 'DEPT' && s0.groupLimit && s0.groupLimit.n === 1 && b0.length >= 1 && $('#groupedResultsContainer').is(':visible'),
          'grouping ' + J(s0.grouping) + ', limit ' + J(s0.groupLimit) + ', bands ' + J(b0.map(function (x) { return x.name; })));
      var m = mark();
      await dropAndSettle(await fixture('three_tabs.xlsx'), function () { return grouped() && st().grouping === 'WORKSHEET'; });
      var s = st(), b = bands();
      R.obs.after = { st: s, bands: b };
      rec('V-grouped', grouped() && s.grouping === 'WORKSHEET', 'grouping ' + J(s.grouping));
      rec('V-bands', same(b.map(function (x) { return x.name; }), ['Jan', 'Feb', 'Mar']), 'bands ' + J(b.map(function (x) { return x.name; })));
      rec('V-reset', s.groupLimit === null && s.groupSort && s.groupSort.key === 'label' && s.groupSort.dir === 'asc' && s.startDepth === 0,
          'limit ' + J(s.groupLimit) + ', sort ' + J(s.groupSort) + ', start depth ' + J(s.startDepth));
      rec('V-agg', s.agg === null, 'group summary ' + J(s.agg));
      rec('V-collapsed', b.length === 3 && b.every(function (x) { return !x.open; }), 'open ' + J(b.map(function (x) { return x.open; })));
      var e = errsFrom.apply(null, m);
      rec('V-err', !e.length, e.join(' | ') || 'no error');
    },

    // Dropped while a PIVOT is on screen: the stash keeps the pivot; the import's
    // grouping must win, with no pivot error along the way.
    prevpivot: async function () {
      await boot();
      MS.set({ pivot: { rows: ['DEPT'], cols: [], vals: 'AMOUNT' } });   // vals = the source column, a string
      $('#resultsTable').hide();
      $('#pivot-output-container').html('<table id="pivotResultTable"><tr><td>pivot</td></tr></table>').show();
      var s0 = st();
      rec('P-prevpivot', !!s0.pivot && $('#pivot-output-container').is(':visible'), 'pivot ' + J(s0.pivot));
      var m = mark();
      await dropAndSettle(await fixture('three_tabs.xlsx'), function () { return grouped() && st().grouping === 'WORKSHEET'; });
      var s = st();
      rec('W-grouped', grouped() && s.grouping === 'WORKSHEET', 'grouping ' + J(s.grouping) + ', bands ' + J(bands().map(function (x) { return x.name; })));
      rec('W-nopivot', !$('#pivot-output-container').is(':visible') && !s.pivot, 'pivot container visible ' + $('#pivot-output-container').is(':visible') + ', pivot ' + J(s.pivot));
      var t = toasts();
      rec('W-toast', !/pivot/i.test(t), t.slice(0, 400));
      var e = errsFrom.apply(null, m);
      rec('W-err', !e.length, e.join(' | ') || 'no error');
    },

    // The same workbook twice: the second asks to overwrite and SAYS the new data
    // is stacked - re-uploading a workbook that used to import as one sheet now
    // brings every sheet plus a column.
    overwrite: async function () {
      await boot();
      var m = mark();
      await dropAndSettle(await fixture('three_tabs.xlsx'), grouped);
      var c1 = window.__confirms.length;
      $('#groupedResultsContainer').empty().hide();   // so the second wait sees ITS render
      await dropAndSettle(await fixture('three_tabs.xlsx'), grouped);
      var asked = window.__confirms.slice(c1);
      rec('O-first', c1 === 0, 'confirms after the first drop: ' + c1);
      rec('O-confirm', asked.length === 1 && asked[0].indexOf('Overwrite with new data (7 rows from 3 worksheets, stacked with a WORKSHEET column)?') !== -1,
          J(asked));
      rec('O-again', grouped() && same(bands().map(function (x) { return x.name; }), ['Jan', 'Feb', 'Mar']), 'bands ' + J(bands().map(function (x) { return x.name; })));
      var e = errsFrom.apply(null, m);
      rec('O-err', !e.length, e.join(' | ') || 'no error');
    },

    // XML Spreadsheet 2003 (.xls), through the same drop.
    legacy: async function () {
      await boot();
      var m = mark();
      await dropAndSettle(await fixture('legacy2003.xls'), grouped);
      var sv = window.__saves[window.__saves.length - 1] || {};
      rec('L-save', same(sv.rows, LG), 'rows ' + J(sv.rows));
      rec('L-bands', grouped() && same(bands().map(function (x) { return x.name; }), ['East', 'West']), 'bands ' + J(bands().map(function (x) { return x.name; })));
      var e = errsFrom.apply(null, m);
      rec('L-err', !e.length, e.join(' | ') || 'no error');
    },

    // Two tabs that are each under the row cap but over it together: refused up
    // front - nothing saved, no query, no grouping left armed for the next query.
    cap: async function () {
      await boot();
      await xlsxReady();
      var max = window.__IMPORT_MAX, per = Math.floor(max / 2) + 1, total = per * 2;
      var mk = function (tag) { var a = [['K', 'V']]; for (var i = 0; i < per; i++) a.push([tag + i, i]); return a; };
      var file = new File([bookFrom([{ name: 'Left', aoa: mk('L') }, { name: 'Right', aoa: mk('R') }])], 'big.xlsx');
      var m = mark(), q0 = window.__queryDone, s0 = window.__saves.length;
      drop(file);
      await until(function () { return toasts().indexOf('import limit') !== -1 || window.__queryDone > q0; }, 30000);
      await sleep(1500);
      var t = toasts();
      rec('Z-nosave', window.__saves.length === s0, 'saves posted: ' + (window.__saves.length - s0));
      rec('Z-noquery', window.__queryDone === q0, 'queries run: ' + (window.__queryDone - q0));
      rec('Z-toast', t.indexOf('big.xlsx has ' + total.toLocaleString() + ' rows across 2 worksheets, over the ' + max.toLocaleString() + '-row import limit.') !== -1,
          t.slice(0, 400));
      rec('Z-pending', st().pendingSheet === null, 'pendingImportSheetGroup ' + J(st().pendingSheet));
      // The next ordinary run must come back as it went in: flat, and no notice
      // about a grouping that "was removed from the query".
      var q1 = window.__queryDone;
      $('#executeQuery').trigger('click');
      await until(function () { return window.__queryDone > q1; }, 15000);
      await sleep(900);
      var t2 = toasts();
      rec('Z-next', !grouped() && flatRows() === 6 && t2.indexOf('Previous grouping dropped') === -1,
          'grouped ' + grouped() + ', flat rows ' + flatRows() + ', toasts "' + t2.slice(0, 300) + '"');
      var e = errsFrom.apply(null, m);
      rec('Z-err', !e.length, e.join(' | ') || 'no error');
    },

    // A save the server REFUSES, over an existing import of the same name (README
    // section 6, closed 2026-10-02). The query sends a name's stored ID ahead of the
    // page's own rows, so a failed save used to show the PREVIOUS upload with no
    // sign of trouble. The rows just dropped must show, sent inline, with a toast
    // saying they were not saved. (The cap is refused BEFORE the save: Z-*.)
    savefail: async function () {
      await boot();
      var m = mark(), NAME = 'SAME_NAME';
      var csv = function (head, rows) { return [head].concat(rows).join('\r\n') + '\r\n'; };
      var lastImportQuery = function (q0) {
        var qs = window.__queries.slice(q0).filter(function (q) { return /\[\s*IMPORT\s*;\s*name\s*=\s*SAME_NAME\s*\]/i.test(q.template); });
        return qs.length ? qs[qs.length - 1] : null;
      };
      var has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
      // 1. The first upload saves: from here the name points at its stored ID.
      var q1 = window.__queries.length;
      var r1 = await dropAndSettle(new File([csv('ID,NAME', ['1,Old-A', '2,Old-B'])], 'same_name.csv'),
                                   function () { return same(colShown('NAME'), ['Old-A', 'Old-B']); });
      var sv1 = window.__saves[window.__saves.length - 1] || {}, qa = lastImportQuery(q1);
      R.obs.first = { save: { name: sv1.name, failed: sv1.failed, id: sv1.id }, query: qa && { refs: qa.refs, inline: Object.keys(qa.inline) }, grid: grid() };
      rec('S-first', r1.saved && sv1.name === NAME && !sv1.failed && !!sv1.id && same(colShown('NAME'), ['Old-A', 'Old-B'])
          && !!qa && qa.refs[NAME] === sv1.id && !errToasts().length,
          'save ' + J(R.obs.first.save) + ', query ' + J(R.obs.first.query) + ', NAME column ' + J(colShown('NAME')) + ', error toasts ' + J(errToasts()));
      // 2. A DIFFERENT file under the same name, whose save the server refuses.
      window.__saveFail = { status: 500, message: 'Action=save: ORA-03113: end-of-file on communication channel' };
      var c0 = window.__confirms.length, q2 = window.__queries.length;
      var r2 = await dropAndSettle(new File([csv('ID,NAME,EXTRA', ['7,New-X,x', '8,New-Y,y', '9,New-Z,z'])], 'same_name.csv'),
                                   function () { return same(colShown('NAME'), ['New-X', 'New-Y', 'New-Z']); });
      var sv2 = window.__saves[window.__saves.length - 1] || {}, qb = lastImportQuery(q2);
      var g2 = grid(), et = errToasts();
      R.obs.refused = { save: { name: sv2.name, failed: sv2.failed, id: sv2.id, rows: sv2.rows }, query: qb, grid: g2, toasts: toasts(), errToasts: et };
      rec('P-savefail-refused', r2.saved && r2.queried && sv2.name === NAME && sv2.failed === 500 && window.__confirms.length - c0 === 1,
          'save ' + J({ name: sv2.name, failed: sv2.failed }) + ', queried ' + r2.queried + ', overwrite prompts ' + (window.__confirms.length - c0));
      rec('S-rows', flatRows() === 3 && same(colShown('NAME'), ['New-X', 'New-Y', 'New-Z']) && same(colShown('ID'), ['7', '8', '9'])
          && g2.cols.indexOf('EXTRA') !== -1,
          'rows ' + flatRows() + ', NAME column ' + J(colShown('NAME')) + ', columns ' + J(g2.cols));
      rec('S-inline', !!qb && !has(qb.refs, NAME) && Array.isArray(qb.inline[NAME]) && qb.inline[NAME].length === 3 && same(qb.inline[NAME], sv2.rows),
          qb ? 'refs ' + J(qb.refs) + ', inline ' + J(qb.inline[NAME] || null) : 'no query for the import');
      rec('S-toast', et.some(function (t) {
        return t.indexOf('ERROR: same_name.csv could not be saved as the import SAME_NAME, so it is available for this session only. '
          + 'Action=save: ORA-03113: end-of-file on communication channel') !== -1;
      }), 'error toasts ' + J(et));
      // 3. Run it again: still the rows just dropped (the stored ID stays forgotten).
      var q3 = window.__queries.length, n3 = window.__queryDone;
      $('#executeQuery').trigger('click');
      await until(function () { return window.__queryDone > n3; }, 15000);
      await until(function () { return same(colShown('NAME'), ['New-X', 'New-Y', 'New-Z']); }, 4000);
      await sleep(500);
      var qc = lastImportQuery(q3);
      rec('S-rerun', same(colShown('NAME'), ['New-X', 'New-Y', 'New-Z']) && !!qc && !has(qc.refs, NAME) && has(qc.inline, NAME),
          'NAME column ' + J(colShown('NAME')) + ', query ' + J(qc && { refs: qc.refs, inline: Object.keys(qc.inline) }));
      // 4. The server takes saves again: the next upload under the name saves and
      //    shows, read back by its NEW ID.
      window.__saveFail = null;
      var q4 = window.__queries.length;
      var r4 = await dropAndSettle(new File([csv('ID,NAME', ['5,Newer-Q'])], 'same_name.csv'),
                                   function () { return same(colShown('NAME'), ['Newer-Q']); });
      var sv4 = window.__saves[window.__saves.length - 1] || {}, qd = lastImportQuery(q4);
      rec('S-recover', r4.saved && !sv4.failed && !!sv4.id && same(colShown('NAME'), ['Newer-Q']) && !!qd && qd.refs[NAME] === sv4.id && !has(qd.inline, NAME),
          'save ' + J({ failed: sv4.failed, id: sv4.id }) + ', NAME column ' + J(colShown('NAME')) + ', query ' + J(qd && { refs: qd.refs, inline: Object.keys(qd.inline) }));
      var e = errsFrom.apply(null, m);
      rec('S-err', !e.length, e.join(' | ') || 'no error');
    }
  };

  (async function () {
    try {
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.slice();
    R.rejections = window.__rejections.slice();
    window.__MSRESULT = R;
    window.__MSDONE = true;
    var o = document.getElementById('out'); if (o) o.textContent = 'done';
  })();
})();
