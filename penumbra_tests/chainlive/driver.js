// chainlive suite - browser half (2026-11-04). The REAL main.js (ready closure unwrapped, window.__SM hook)
// on a BIG report (run.ps1 passes ?rows=1500, every row on the page) whose snippet holds a live vis() chart.
// A snippet button's re-render is no editor keystroke: it must never hit the live-edit pause ("Large Dataset
// Detected" + the chart swapped for a greyed <img title="Live updates paused...">). Typing in the snippet
// editor still must.
//   B0 boot, the chart live   K1 chain() closing render   T1 action(trigger) catch-all render
//   G1 group_by trigger + data(group) (the grouping's own re-render)   E1 an editor keystroke still pauses
// (2026-11-17, follows adb6299 snipgate) the pause goes by estimated cost, not rows: the fixture is 1,500 rows x
// 120 columns with a format() rule (over the 1,000 ms budget); E0 = the vis() alone on those rows stays live.
(function () {
  var R = [];
  function rec(name, pass, detail) {
    R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) });
    document.getElementById('out').textContent = 'running after ' + R.length + ': ' + JSON.stringify(R);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__SM_ERR, window.__SM_ERR2, (window.__SM_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__SM || {};
  var OUT = '#reportSnippetOutput';
  function link(label) { return $(OUT + ' a.snippet-action').filter(function () { return $.trim($(this).text()) === label; }).get(0) || null; }
  function pausedImg() { return document.querySelectorAll(OUT + ' img[title^="Live updates paused"]').length; }
  function pausedBox() { return $(OUT).text().indexOf('(Chart Paused)') >= 0 ? 1 : 0; }
  // (2026-11-17, follows adb6299) the notice reads "Large report (N rows x M columns): ..." since the cost gate and
  // sits on the snippet editor's wrapper (offstage here), with the Apply button
  function notice() { return document.querySelectorAll('.snippet-manual-apply-container').length ? 1 : 0; }
  function live() { return document.querySelectorAll(OUT + ' canvas').length; }
  function paused() { return pausedImg() + pausedBox() + notice() > 0; }
  function state() {
    return 'canvas=' + live() + ' pausedImg=' + pausedImg() + ' pausedBox=' + pausedBox() + ' notice=' + notice() +
      ' grp=' + $.trim($('#grp').text()) + ' rows=' + $('#resultsTable tbody tr:not(.search-hidden)').length + ' grouped=' + $('#groupedResultsContainer').is(':visible') +
      ' out=' + ($(OUT).html() || '').replace(/\s+/g, ' ').slice(0, 260);
  }
  async function idle(ms) {
    for (var i = 0; i < 400; i++) { if (!$('#loadingOverlay').is(':visible')) break; await sleep(25); }
    await sleep(ms || 600);
  }
  async function bootWait() {
    for (var i = 0; i < 800; i++) {
      if (window.__queryDone >= 1 && $('#resultsTable tbody tr').length && link('Chain') && !$('#loadingOverlay').is(':visible')) break;
      await sleep(25);
    }
    await sleep(1500);
  }
  async function liveAgain(ms) {   // a chart re-render is async (chart module + deferred task): poll for it
    for (var i = 0; i < (ms || 4000) / 50; i++) { if (live() && !paused()) return; await sleep(50); }
  }
  async function click(label) { var el = link(label); if (el) $(el).trigger('click'); await idle(); return !!el; }

  async function main() {
    await bootWait();
    if (!link('Chain')) { finish('no chain button rendered: ' + $(OUT).text().slice(0, 300)); return; }
    await liveAgain(8000);
    var nRows = $('#resultsTable tbody tr').length;
    rec('B0 boot: a big report (' + nRows + ' rows) with its vis() chart live, no pause', nRows > 1000 && live() > 0 && !paused(), state());

    // K1 the chain(): two search steps, then its closing render
    var had = await click('Chain');
    await sleep(2500);   // each step waits for stepComplete (+50ms); the closing render runs last
    await liveAgain();
    rec('K1 chain(): the chart is live after the chain, no live-edit pause', had && live() > 0 && !paused(), state());

    // T1 a plain trigger: the catch-all post-trigger render
    had = await click('Find');
    await liveAgain();
    var t1 = state(), t1ok = had && live() > 0 && !paused();
    await click('Clear'); await liveAgain();
    rec('T1 action(trigger): the chart is live after a trigger, no live-edit pause', t1ok, t1);

    // G1 group_by with data(group) in the snippet: the grouping's own re-render after it lands
    had = await click('Group');
    for (var i = 0; i < 100 && !$('#groupedResultsContainer').is(':visible'); i++) await sleep(50);
    await sleep(800);
    await liveAgain();
    rec('G1 group_by trigger + data(group): grouped, data(group) re-rendered, the chart live', had && $('#groupedResultsContainer').is(':visible') && $.trim($('#grp').text()) === 'true' && live() > 0 && !paused(), state());

    // (2026-11-17 repair, follows adb6299 of 2026-11-16, snipgate) the live-edit guard goes by estimated cost
    // (cells of rules + charts against a 1,000 ms budget), not by "> 1000 rows":
    // E0 the same 1,500 rows with ONLY the vis() (the format() line typed away): ~65 ms, the chart stays live
    // E1 with the format() rule over 1,500 x 121 cells (~1,270 ms): the keystroke STILL pauses
    var ed = H.snipEd ? H.snipEd() : null;
    var how;
    var full = (ed && typeof ed.getValue === 'function') ? ed.getValue() : '';
    if (ed && typeof ed.setValue === 'function') {
      var noRule = full.replace(/^format\(.*\n/m, '');
      ed.setValue(noRule + '\n<span id="typed0">x</span>');
      for (var j0 = 0; j0 < 160 && !document.getElementById('typed0'); j0++) await sleep(50);   // the editor's 1s debounce, then the render
      await liveAgain();
      await sleep(300);
      rec('E0 an editor keystroke with only a vis() on the big report keeps the chart live (cost under the budget)',
        noRule !== full && noRule.indexOf('format(') < 0 && !!document.getElementById('typed0') && live() > 0 && !paused(), state());
    } else {
      rec('E0 an editor keystroke with only a vis() on the big report keeps the chart live (cost under the budget)', false, 'no snippet editor');
    }
    if (ed && typeof ed.setValue === 'function') {
      how = 'editor';
      ed.setValue(full + '\n<span id="typed">x</span>');
      for (var j = 0; j < 160 && !paused(); j++) await sleep(50);   // the editor's 1s debounce + the rule pass
    } else {
      how = 'direct';
      await H.render(null, true);
    }
    await sleep(300);
    rec('E1 an editor keystroke on a big report over the live budget still pauses the chart (' + how + ')', paused(), state());
    rec('V0 no page errors', errs().length === 0, errs().slice(0, 4).join(' | '));
    finish();
  }
  main().catch(function (e) { finish('driver threw: ' + (e && e.stack || e)); });
})();
