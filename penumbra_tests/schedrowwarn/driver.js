// Scheduler row-limit banner - browser suite (2026-10-02). Drives the REAL
// main.js (ready closure unwrapped, window.__SL export hook) against the REAL
// css\main.css, with #schedRowLimitWarning LIFTED from the index.php under test.
//
// The change: the banner ("Row limit is on (max 200 rows)...") used to show
// whenever the limiter was on. It is now sized by liveQueryRowCount, the rows
// the report's query last returned on the page:
//   under 150        hidden (the cap is nowhere near)
//   150-199          "may not always deliver the full result set" as it grows
//   200 or more      at the cap: events ship only the first 200 rows
//   unknown (null)   the index.php wording (not run yet, an error)
// A query's return re-sizes an open form's banner; clearResultsUI forgets the
// count; a zero-row run is a KNOWN zero. DB_DUMP keeps its own wording, and
// (round 2, the same day) its "Enforce row limit" banner is sized the same way
// against the dump's own cap: hidden under 75% of it; exactly 200 rows is only
// a floor (the report limiter may have cut it).
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
  function warn() { return el('schedRowLimitWarning'); }
  function shown() { var w = warn(); return !!w && getComputedStyle(w).display !== 'none'; }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function text() { var w = warn(); return w ? norm(w.textContent) : ''; }
  function state() { return 'shown=' + shown() + ' text=' + text(); }
  function limiter(on) { $('#toggleLimitBtn').toggleClass('is-active', !!on); }
  // What openSchedulerForm / the toggle handler do: re-evaluate the banner.
  function update() { window.updateSchedRowLimitWarning(); }
  var SHIP = norm(window.__shipText);
  function isShip() { return shown() && text() === SHIP; }
  function isNear(n) { return shown() && /may not always deliver the full result set/.test(text()) && text().indexOf('returns ' + n + ' rows now') !== -1; }
  function isCap() { return shown() && /reaches it/.test(text()) && /only the first 200 rows/.test(text()); }
  function noDash() { return !/[—–]/.test(text()); }

  var COLS = ['C01', 'C02', 'AMOUNT'];
  function makeRows(n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var row = {};
      for (var c = 0; c < COLS.length; c++) row[COLS[c]] = (COLS[c] === 'AMOUNT') ? String(i * 100) : ('v' + c + '-' + i);
      out.push(row);
    }
    return out;
  }
  async function runResponse(resp) {
    window.__queryResponse = resp;
    var ed = H.getEditor ? H.getEditor() : null;
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    var before = window.__ajaxLog.length;
    $('#executeQuery').trigger('click');
    for (var i = 0; i < 200; i++) {
      await sleep(25);
      if (window.__ajaxLog.length > before && (window.__rejections.length || !$('#loadingOverlay').is(':visible'))) break;
    }
    await sleep(400);
  }
  function runQuery(n) { return runResponse({ data: makeRows(n) }); }

  async function phaseB() {
    rec('B0 fixture: the banner (lifted from the index.php under test), the event type, the limiter and updateSchedRowLimitWarning are on the page',
      !!warn() && !!el('schedEventType') && $('#toggleLimitBtn').hasClass('is-active') && typeof window.updateSchedRowLimitWarning === 'function' && SHIP.length > 20,
      'banner=' + !!warn() + ' type=' + !!el('schedEventType') + ' fn=' + typeof window.updateSchedRowLimitWarning + ' ship=' + SHIP);
    if (!warn() || typeof window.updateSchedRowLimitWarning !== 'function') return;

    // 1. No query has run: the count is unknown, so the shipped wording shows.
    limiter(true);
    update();
    rec('B1 no run yet (count unknown), limiter on: the banner shows index.php\'s own wording', isShip(), state());

    // 2. A small report: the query's RETURN hides an open banner by itself.
    await runQuery(120);
    rec('B2 a 120-row run hides the banner, re-sized by the query\'s return (no form re-open)', !shown(), state());

    // 3. The 150 boundary.
    await runQuery(149);
    var at149 = !shown();
    await runQuery(150);
    var at150 = isNear(150);
    rec('B3 149 rows: hidden; 150 rows: shown, worded "may not always deliver the full result set" with the count',
      at149 && at150, 'hiddenAt149=' + at149 + ' | at150: ' + state());

    await runQuery(199);
    rec('B4 199 rows (fits, little headroom): the "may not always" wording, with no em or en dash', isNear(199) && noDash(), state());

    // 4. At the cap.
    await runQuery(200);
    rec('B5 200 rows with the limiter on: the at-the-cap wording ("reaches it", "only the first 200 rows"), no dash', isCap() && noDash(), state());

    // 5. The limiter itself, and a full fetch taken with the limiter off.
    limiter(false); update();
    var offHidden = !shown();
    await runQuery(1200);
    var offStill = !shown();
    limiter(true); update();
    var capAfter = isCap();
    rec('B6 limiter off: hidden at 200 and after a 1,200-row full fetch; turned back on, that 1,200 reads as at the cap',
      offHidden && offStill && capAfter, 'offHidden=' + offHidden + ' offStill=' + offStill + ' | on: ' + state());

    // 6. The query supplies its own limit.
    $('#toggleLimitBtn').addClass('is-overridden'); update();
    var ovHidden = !shown();
    $('#toggleLimitBtn').removeClass('is-overridden'); update();
    rec('B7 an overridden limiter (the query\'s own FETCH FIRST) hides it even at the cap; back to normal, it returns',
      ovHidden && isCap(), 'overriddenHidden=' + ovHidden + ' | after: ' + state());

    // 7. Zero rows is a KNOWN count (clearResultsUI runs on that path).
    await runQuery(0);
    var zHidden = !shown();
    update();
    rec('B8 a zero-row run hides the banner and it STAYS hidden on re-evaluation (zero is known, not unknown)',
      zHidden && !shown(), 'hiddenOnReturn=' + zHidden + ' | after update: ' + state());

    // 8. An error clears the result: the count is unknown again.
    await runQuery(120);
    var smallHidden = !shown();
    await runResponse({ error: 'ORA-00942: table or view does not exist' });
    update();
    rec('B9 an error after a 120-row run forgets that count: re-evaluated, the banner shows the shipped wording again',
      smallHidden && isShip(), 'hiddenAt120=' + smallHidden + ' | after error: ' + state());

    // 9. DB_DUMP "all" ships everything; EMAIL is re-sized on the way back.
    await runQuery(160);
    $('#schedEventType').val('DB_DUMP');
    $('input[name="schedDbDumpRowMode"][value="all"]').prop('checked', true).trigger('change');
    var dumpAll = !shown();
    $('#schedEventType').val('EMAIL');
    update();
    var emailBack = isNear(160);
    await runQuery(200);
    var emailCap = isCap();
    rec('B10 DB_DUMP "Always include all rows" stays silent even at 160 rows; back on EMAIL the banner is re-sized by the count (160 near, 200 at the cap)',
      dumpAll && emailBack && emailCap, 'dumpAll=' + dumpAll + ' emailBack160=' + emailBack + ' | ' + state());

    // 10. DB_DUMP "Enforce row limit" (round 2, 2026-10-02): sized against the
    //     dump's own cap with the same 75% buffer.
    function dump(cap) {
      $('#schedEventType').val('DB_DUMP');
      $('input[name="schedDbDumpRowMode"][value="enforce"]').prop('checked', true).trigger('change');
      $('#schedDbDumpRowLimit').val(String(cap)).trigger('input');
    }
    function dNear(cap, n) { return shown() && text().indexOf('capped at ' + cap.toLocaleString() + ' rows') !== -1 && /as it grows the dump may not always load the full result set/.test(text()) && text().indexOf('returns ' + n.toLocaleString() + ' rows now') !== -1; }
    function dCap(cap) { return shown() && text().indexOf('capped at ' + cap.toLocaleString() + ' rows') !== -1 && /this report reaches it/.test(text()) && text().indexOf('only the first ' + cap.toLocaleString() + ' rows') !== -1; }
    function dUnknown(cap) { return shown() && text().indexOf('capped at ' + cap.toLocaleString() + ' rows') !== -1 && /, so it may not always load the full result set/.test(text()) && !/returns|reaches/.test(text()); }

    await runQuery(120);
    dump(200);
    var d120 = !shown();
    await runQuery(160);
    var d160 = dNear(200, 160);
    var d160txt = text();
    await runQuery(200);
    var d200 = dCap(200);
    rec('B11 DB_DUMP enforce at 200: 120 rows hidden, 160 "may not always load" with the count, 200 "reaches it ... only the first 200 rows"; no dash',
      d120 && d160 && d200 && noDash(), 'hidden120=' + d120 + ' near160=' + d160 + ' cap200=' + d200 + ' | 160: ' + d160txt + ' | 200: ' + text());

    await runQuery(120);
    dump(100);
    var c100 = dCap(100);
    await runQuery(180);
    dump(1000);
    var c1000small = !shown();
    await runQuery(900);
    var c1000near = dNear(1000, 900);
    await runQuery(1200);
    var c1000over = dCap(1000);
    rec('B12 the cap typed in the box re-sizes it: 120 rows over a 100 cap reach it; 180 under a 1,000 cap hidden; 900 near it; 1,200 reaches it',
      c100 && c1000small && c1000near && c1000over, 'cap100=' + c100 + ' hidden180=' + c1000small + ' near900=' + c1000near + ' over1200=' + c1000over + ' | ' + state());

    await runQuery(200);
    var floor200 = dUnknown(1000);
    var floorTxt = text();
    await runResponse({ error: 'ORA-00942: table or view does not exist' });
    update();
    var errUnknown = dUnknown(1000);
    await runQuery(0);
    var zero = !shown();
    dump(200);
    $('#schedEventType').val('EMAIL');
    update();
    rec('B13 exactly 200 rows under a 1,000 cap is only a floor (the report limiter may have cut it): the "may not always" wording, no count; an error is unknown too; zero rows is hidden',
      floor200 && errUnknown && zero, 'floor200=' + floor200 + ' errUnknown=' + errUnknown + ' zeroHidden=' + zero + ' | ' + floorTxt);
  }

  (async function () {
    try {
      await sleep(300);
      await phaseB();
      var pe = errs();
      rec('Z no page errors or unhandled rejections during the run', pe.length === 0, pe.slice(0, 3).join(' | '));
      finish();
    } catch (e) {
      finish(String(e && e.stack ? e.stack : e).slice(0, 600));
    }
  })();
})();
