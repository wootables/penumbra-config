// copyhtml suite - browser half (2026-09-30). After the load path settles:
// goes to the scenario's page, copies through the Copy dialog's own button
// (format = html), and publishes window.__HCRESULT / window.__HCDONE for run.py:
// what the clipboard received and the toast, which rows the copy touched, the
// page state before and after, the email path's HTML (getExportData('html')
// with no opts - one page by design) and the ORACLE - the old one-page copy
// taken after switching Rows to All, which is what "every page, as displayed"
// means. Big strings travel as SHA-256 + length; a mismatch ships a snippet.
(function () {
  var HC = window.__HC || {};
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function sha(s) {
    if (s == null) return null;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16);
  }
  function parse(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return d; }
  function bodyRows(html) {
    var t = parse(html).querySelector('table');
    return t ? Array.prototype.map.call(t.querySelectorAll(':scope > tbody > tr'), function (tr) { return tr.outerHTML; }) : [];
  }
  function footRows(html) {
    var t = parse(html).querySelector('table');
    return t ? Array.prototype.map.call(t.querySelectorAll(':scope > tfoot > tr'), function (tr) { return tr.textContent.replace(/\s+/g, ' ').trim(); }) : [];
  }
  function noteText(html) {
    var kids = parse(html).children;
    var last = kids.length ? kids[kids.length - 1] : null;
    return (last && last.tagName === 'DIV') ? last.textContent : '';
  }
  function firstDiff(a, b) {
    a = a || ''; b = b || '';
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return { at: i, a: a.slice(Math.max(0, i - 80), i + 160), b: b.slice(Math.max(0, i - 80), i + 160) };
  }
  // Everything the copy must put back: every row's inline display, the stripe of
  // every DISPLAYED row (an off-page row's stripe is never seen and is re-set
  // whenever it is shown), the tfoot rows, the page label and page number.
  function state() {
    var tb = document.querySelector('#resultsTable tbody');
    var rows = tb ? tb.rows : [];
    var disp = [], zebra = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      disp.push(r.style.display || '-');
      if (r.style.display !== 'none') zebra.push(i + (r.classList.contains('zebra-dark') ? 'd' : (r.classList.contains('zebra-light') ? 'l' : '?')));
    }
    var foot = Array.prototype.map.call(document.querySelectorAll('#resultsTable tfoot tr'), function (tr) { return tr.className + '=' + (tr.style.display || '-'); });
    return JSON.stringify({ disp: disp.join(','), zebra: zebra.join(','), foot: foot, page: $('#pageInfo').text(),
                            cur: HC.getPage ? HC.getPage() : null, rpp: $('#rowsPerPageSelector').val(),
                            dataHidden: document.body.classList.contains('pnb-data-hidden') });
  }

  (async function () {
    var R = { scn: window.__SCN };
    try {
      var S = window.__SCN;
      // A load that never finishes must FAIL the scenario, not carry on: on a
      // busy machine it once did, and the copy of an empty table then read as
      // three failed cap asserts instead of one timeout.
      if (!(await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 150000))) throw new Error('boot: the report never finished loading (150 s)');
      await sleep(500);
      if (S === 'group' && !(await until(function () { return $('#groupedResultsContainer').is(':visible'); }, 30000))) throw new Error('group: the grouped view never appeared (30 s)');
      if (S === 'p2' || S === 'fmt' || S === 'cap') HC.setPage(2);
      // rpp25: page 2 then 3, so rows 25-49 keep page 2's stripes (row 25 "light")
      // while Rows = All stripes row 25 dark - the copy must re-stripe them.
      if (S === 'rpp25') { HC.setPage(2); HC.setPage(3); }
      await sleep(200);
      var tb = document.querySelector('#resultsTable tbody');
      var rows = tb ? tb.rows : [];
      var sv = 0, dv = 0;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].classList.contains('search-hidden') || rows[i].classList.contains('journal-note-child')) continue;
        sv++;
        if (rows[i].style.display !== 'none') dv++;
      }
      R.searchVisible = sv;
      R.displayed = dv;
      R.pageInfo = $('#pageInfo').text();
      R.before = state();

      // --- the copy, through the dialog's own button ---------------------------
      // run.py reads the browser's LayoutCount just before and just after (L-*):
      // let the load's deferred timers (the a11y nudge, 1.5 s) pass first.
      await sleep(1200);
      var touched = new Set();
      var mo = new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.target.tagName === 'TR') touched.add(m.target); }); });
      if (tb) mo.observe(tb, { attributes: true, attributeFilter: ['style'], subtree: true });
      window.__clipHtml = []; window.__toasts = [];
      $('input[name="copyFormat"][value="html"]').prop('checked', true);
      window.__HC_PRECOPY = true;
      if (!(await until(function () { return window.__HC_GO; }, 60000))) throw new Error('metrics: no GO from run.py');
      var t0 = performance.now();
      $('#confirmCopyBtn').trigger('click');
      R.copyMs = Math.round(performance.now() - t0);
      window.__HC_COPIED = true;
      mo.takeRecords().forEach(function (m) { if (m.target.tagName === 'TR') touched.add(m.target); });
      mo.disconnect();
      R.touched = touched.size;
      if (!(await until(function () { return window.__HC_METRICS_TAKEN; }, 60000))) throw new Error('metrics: run.py never read them');
      R.lastRun = HC.lastRun ? HC.lastRun() : null;
      R.after = state();
      if (!(await until(function () { return window.__clipHtml.length > 0 && window.__toasts.length > 0; }, 30000))) {
        throw new Error('copy: no clipboard write + toast within 30 s (toasts: ' + JSON.stringify(window.__toasts || []).slice(0, 200) + ')');
      }
      var copyHtml = window.__clipHtml[0] || null;
      R.clipErr = window.__clipErr || '';
      R.toast = (window.__toasts[0] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      R.copyLen = copyHtml ? copyHtml.length : 0;
      R.copyHash = await sha(copyHtml);
      var copyRows = bodyRows(copyHtml);
      R.copyRowCount = copyRows.length;
      R.copyFoot = footRows(copyHtml);
      R.note = noteText(copyHtml);

      // --- the email embed's path: getExportData('html'), no opts --------------
      var emailHtml = HC.getExportData('html').content;
      R.emailHash = await sha(emailHtml);
      R.emailRowCount = bodyRows(emailHtml).length;
      R.afterEmail = state();

      // --- the ORACLE: the old one-page copy with Rows = All (changes the page -
      // so it runs last). Grouped: the no-opts copy of the same view.
      if (S !== 'group') { $('#rowsPerPageSelector').val('all'); HC.applyPagination(); }
      var oracleHtml = HC.getExportData('html').content;
      R.oracleHash = await sha(oracleHtml);
      R.oracleLen = oracleHtml.length;
      var oracleRows = bodyRows(oracleHtml);
      R.oracleRowCount = oracleRows.length;
      R.oracleFoot = footRows(oracleHtml);
      R.copyEqOracle = (copyHtml === oracleHtml);
      if (!R.copyEqOracle) R.diff = firstDiff(copyHtml, oracleHtml);
      R.prefixOk = copyRows.length > 0 && copyRows.every(function (h, k) { return h === oracleRows[k]; });
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
