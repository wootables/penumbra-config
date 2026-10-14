// Status bar row-limit warning - browser suite (2026-09-25). Drives the REAL
// main.js (ready closure unwrapped, window.__SL export hook) against the REAL
// css\main.css, with the status bar's lead segment (row count + #sbRowLimitWarn)
// LIFTED from the index.php under test.
//
// The bug: the flat and grouped row counts draw their "Row limit enabled" warning
// INSIDE #resultCount (a titled span around a triangle). The header copy of
// #resultCount is display:none since the status bar took the readout over, and
// the bar mirrors its TEXT - so the warning was dropped and #sbRowLimitWarn,
// which nothing ever switched on, never showed.
//   W  the icon follows the count's own warning span (flat: the real render path;
//      grouped: its markup), a pivot of a 200-row limited fetch, never a snapshot
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 500) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 8), hookErr: [window.__SL_ERR, window.__SL_ERR2, (window.__SL_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  var H = window.__SL || {};
  function el(id) { return document.getElementById(id); }
  function cs(e) { return getComputedStyle(e); }
  function warn() { return el('sbRowLimitWarn'); }
  function shown() { var w = warn(); return !!w && cs(w).display !== 'none' && w.getBoundingClientRect().width > 0; }
  function title() { var w = warn(); return w ? (w.getAttribute('title') || '') : ''; }
  function limiter(on) { $('#toggleLimitBtn').toggleClass('is-active', !!on); }
  // The bar coalesces #resultCount mutations for 60ms before it repaints.
  function settle() { return sleep(250); }
  function setCount(html) { $('#resultCount').html(html); return settle(); }

  var COLS = ['C01', 'C02', 'C03', 'AMOUNT'];
  function makeRows(n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var row = {};
      for (var c = 0; c < COLS.length; c++) row[COLS[c]] = (COLS[c] === 'AMOUNT') ? String(i * 100) : ('v' + c + '-' + i);
      out.push(row);
    }
    return out;
  }
  async function runQuery(rows) {
    window.__queryResponse = { data: rows };
    var ed = H.getEditor ? H.getEditor() : null;
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    var before = window.__ajaxLog.length;
    $('#executeQuery').trigger('click');
    for (var i = 0; i < 200; i++) {
      await sleep(25);
      if (window.__ajaxLog.length > before && (window.__rejections.length || !$('#loadingOverlay').is(':visible'))) break;
    }
    await sleep(400);
    await settle();
  }
  var PIVOT_NOTE = 'Row limit enabled (200 rows). This pivot may be built from a partial result set.';
  function pivotCount(srcTitle) { return '12 pivot rows <span title="' + srcTitle + '" style="cursor:help">*</span>'; }

  async function phaseW() {
    var w = warn();
    rec('W0 fixture: the status bar lead segment (lifted from the index.php under test), the row count and the limiter are on the page, and the bar is running',
      !!w && !!el('sbRows') && !!el('resultCount') && $('#toggleLimitBtn').hasClass('is-active') && !!window.PenumbraUserSeg,
      'icon=' + !!w + ' sbRows=' + !!el('sbRows') + ' resultCount=' + !!el('resultCount') + ' userseg=' + !!window.PenumbraUserSeg);
    if (!w || !el('resultCount')) return;

    // 1. The REAL flat render path: exactly 200 rows with the limiter on.
    limiter(true);
    await runQuery(makeRows(200));
    var span = $('#resultCount span[title^="Row limit"]');
    var spanTitle = span.attr('title') || '';
    var aria1 = w.getAttribute('aria-label');
    rec('W1 a flat run of exactly 200 rows with the limiter on: the count carries its warning span, and the status bar SHOWS the icon, in the same words, beside "200 total rows"',
      span.length === 1 && shown() && title() === spanTitle && /200 total rows/.test($('#sbRows').text()),
      'span=' + span.length + ' shown=' + shown() + ' iconTitle=' + title() + ' | spanTitle=' + spanTitle + ' | sbRows=' + $('#sbRows').text());

    await runQuery(makeRows(150));
    rec('W2 a 150-row run (under the cap): no span in the count, and the icon goes away again',
      $('#resultCount span[title^="Row limit"]').length === 0 && !shown() && /150 total rows/.test($('#sbRows').text()),
      'shown=' + shown() + ' sbRows=' + $('#sbRows').text());

    limiter(false);
    await runQuery(makeRows(200));
    var offOk = !shown();
    limiter(true);
    rec('W3 the limiter OFF: 200 rows is just 200 rows - no icon', offOk, 'shownWithLimiterOff=' + !offOk);

    // 2. The grouped count's own span, in ITS wording ("...not THE full result set").
    var gTitle = 'Row limit enabled (200 rows). This may not be the full result set.';
    await setCount('<span title="' + gTitle + '" style="cursor: help; margin-right: 5px;"><svg width="15" height="15"></svg></span>200 total rows, in 12 groups');
    rec('W4 the grouped count\'s warning span is mirrored as-is, wording and all', shown() && title() === gTitle, 'shown=' + shown() + ' title=' + title());

    // 3. Pivot counts carry no span; the bar decides from the source-row total.
    await setCount(pivotCount('200 source transactions'));
    var p1 = shown() && title() === PIVOT_NOTE;
    await setCount('12 pivot rows, with 3 filtered results <span title="5 of 200 source transactions match this filter" style="cursor:help">*</span>');
    var p2 = shown() && title() === PIVOT_NOTE;
    await setCount(pivotCount('1,200 source transactions'));
    var p3 = !shown();
    limiter(false);
    await setCount(pivotCount('200 source transactions'));
    var p4 = !shown();
    limiter(true);
    rec('W5 a pivot built from a 200-row limited fetch warns (also while a search narrows it); 1,200 source rows, or the limiter off, do not',
      p1 && p2 && p3 && p4, 'plain=' + p1 + ' searchNarrowed=' + p2 + ' notAt1200=' + p3 + ' notWithLimiterOff=' + p4 + ' lastTitle=' + title());

    // 4. Frozen snapshot data never warns.
    if (!H.setSnap) { rec('W6 snapshot data never warns', false, 'setSnap hook missing: ' + (window.__SL_MISSING || []).join(',')); }
    else {
      H.setSnap(true);
      await setCount(pivotCount('200 source transactions'));
      var snapOk = !shown();
      H.setSnap(false);
      await setCount(pivotCount('200 source transactions'));
      var backOk = shown();
      rec('W6 frozen snapshot data never warns - the limiter\'s CURRENT state says nothing about the capture - and live data warns again after',
        snapOk && backOk, 'hiddenWhileSnapshot=' + snapOk + ' shownAfter=' + backOk);
    }

    // 5. Screen readers: a labelled image (the a11y module's decorative-svg sweep
    //    skips role=img), whose label follows the words it shows.
    rec('W7 the icon is a labelled image (never swept as decoration), and its label follows what it shows',
      w.getAttribute('role') === 'img' && aria1 === spanTitle && w.getAttribute('aria-label') === PIVOT_NOTE && w.getAttribute('aria-hidden') !== 'true',
      'role=' + w.getAttribute('role') + ' ariaAfterFlat=' + aria1 + ' | ariaNow=' + w.getAttribute('aria-label'));
  }

  (async function () {
    try {
      await sleep(300);
      await phaseW();
      var pe = errs();
      rec('Z no page errors or unhandled rejections during the run', pe.length === 0, pe.slice(0, 3).join(' | '));
      finish();
    } catch (e) {
      finish(String(e && e.stack ? e.stack : e).slice(0, 600));
    }
  })();
})();
