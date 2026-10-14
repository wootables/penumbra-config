// Save-layout suite - browser half (2026-09-24). Drives the REAL main.js (ready
// closure unwrapped, window.__SL export hook) through the REAL run path and the
// REAL Save dialog handlers, and reads back what a save writes for the column
// layout (STATE_DATA.visibleColumns / columnOrder).
//
// The bug (dirsearch, audit 29665): every run empties #tableHeader before it
// asks the server and only a run that returns rows builds it again, and
// buildStateObject() read the layout from that header alone - so a save made
// while the run had failed, come back empty or was still in flight wrote NO
// layout, and the report lost its hidden and reordered columns.
//
// ?mode=report    F fixture/controls  A failed run (HTTP 500)  P no aliasing
//                 Z 0 rows  E app error at HTTP 200  I in flight
//                 O a local override (by design: a table on screen = what is saved)
//                 S an in-page server save replaces what is carried
//                 L a local save does too  X exploring a raw table forgets it
// ?mode=bootfail  B the report's very FIRST run fails
// ?mode=adhoc     N no report: a default layout is written, nothing is invented
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 500) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8),
                    hookErr: [window.__SL_ERR, window.__SL_ERR2, (window.__SL_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};

  var H = window.__SL || {};
  var STORED = window.__STORED;
  var FAIL500 = { status: 500, error: 'ORA-00933: SQL command not properly ended' };

  function J(x) { return JSON.stringify(x); }
  function lay(s) { return s ? { vc: s.visibleColumns, co: s.columnOrder } : { vc: 'NO STATE', co: 'NO STATE' }; }
  function same(l, want) { return J(l.vc) === J(want.visibleColumns) && J(l.co) === J(want.columnOrder); }
  function none(l) { return l.vc === undefined && l.co === undefined; }
  function show(l) { return 'vc=' + J(l.vc) + ' co=' + J(l.co); }
  function ths() { return $('#tableHeader th'); }
  function names() { return ths().map(function () { return this.getAttribute('data-colname'); }).get(); }
  function shown() { return ths().filter(function () { return this.style.display !== 'none'; }).map(function () { return this.getAttribute('data-colname'); }).get(); }
  function build() { try { return H.buildState(); } catch (e) { return { visibleColumns: 'THREW ' + e, columnOrder: 'THREW' }; } }

  // One run through the real #executeQuery handler. The stub answers after
  // `delay` ms; __queryDone counts answers, the render lands in a timeout after.
  async function run(o) {
    o = o || {};
    window.__queryFail = o.fail || null;
    window.__queryResponse = o.resp || { data: window.__rows(5) };
    window.__queryDelay = o.delay || 0;
    var before = window.__queryDone;
    $('#executeQuery').trigger('click');
    if (o.noWait) return before;
    await waitDone(before, o.table);
    return before;
  }
  async function waitDone(before, wantTable) {
    for (var i = 0; i < 400 && window.__queryDone <= before; i++) await sleep(25);
    await sleep(300);
    if (wantTable) { for (var k = 0; k < 200 && !ths().length; k++) await sleep(25); }
    await sleep(200);
  }
  // The real Save-to-server handler, end to end: returns the STATE_DATA it POSTed.
  async function serverSave() {
    $('#serverSaveIdInput').val('layoutfix');
    $('#serverSaveTitleInput').val('Layout fixture');
    $('#serverSaveOverwriteCheckbox').prop('checked', true);
    var before = window.__savePosts.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    for (var i = 0; i < 200 && window.__savePosts.length === before; i++) await sleep(25);
    await sleep(200);   // the handler resumes after its await
    var post = window.__savePosts[before];
    if (!post) return null;
    try { return JSON.parse(post.state_data); } catch (e) { return null; }
  }
  // The real Save-locally handler: returns the state it wrote to savedQueries.
  async function localSave(name) {
    $('#localSaveNameInput').val(name);
    $('#confirmLocalSaveBtn').prop('disabled', false).trigger('click');
    var hit = null;
    for (var i = 0; i < 200 && !hit; i++) {
      await sleep(25);
      var list = []; try { list = JSON.parse(localStorage.getItem('savedQueries') || '[]'); } catch (e) {}
      hit = list.filter(function (q) { return q.name === name; })[0] || null;
    }
    await sleep(150);
    if (!hit) return null;
    try {
      var enc = new URL(hit.url, location.href).searchParams.get('state');
      return JSON.parse(H.decompress(enc));
    } catch (e) { return { visibleColumns: 'UNDECODABLE ' + e, columnOrder: null }; }
  }
  // Hide one column the way the Settings panel's Apply does: the <th> and every
  // body cell at that DOM index.
  function hideCol(name) {
    var idx = names().indexOf(name);
    if (idx < 0) return false;
    ths()[idx].style.display = 'none';
    $('#resultsTable > tbody > tr').each(function () { var td = this.children[idx]; if (td) td.style.display = 'none'; });
    return true;
  }

  // --------------------------------------------------------------------------
  async function modeReport() {
    // The boot loads the stored state and runs it by itself.
    await waitDone(0, true);
    var n0 = names(), v0 = shown();
    var ok = J(n0) === J(['#', 'EMAIL', 'ID', 'NAME', 'DEPT', 'TITLE', 'PHONE']) && J(v0) === J(['#', 'EMAIL', 'ID', 'NAME']);
    rec('F1 fixture: the boot renders the stored layout (EMAIL first; DEPT TITLE PHONE hidden)', ok,
      'names=' + J(n0) + ' shown=' + J(v0) + ' errs=' + errs().slice(0, 2).join(' / '));
    if (!ok) return;
    var f2 = lay(build());
    rec('F2 control: with the table on screen the builder writes what is on screen (= the stored layout)', same(f2, STORED), show(f2));

    // A - the incident: query.php 500s, the header stays empty, then a save.
    await run({ fail: FAIL500 });
    rec('A0 fixture: after a failed run the flat header is empty', ths().length === 0, 'ths=' + ths().length + ' errorBox=' + $('#errorBox').text().slice(0, 80));
    var a1 = lay(build());
    rec('A1 a save after a failed run keeps the stored layout', same(a1, STORED), show(a1));
    var a2 = lay(await serverSave());
    rec('A2 end to end: the Save dialog POSTs the stored layout after a failed run', same(a2, STORED), show(a2) + ' status=' + $('#serverSaveStatus').text().slice(0, 80));

    // P - what the builder hands out is a copy: a caller editing it must not
    // change what the NEXT save carries.
    var p = build();
    try { p.visibleColumns.push(99); p.columnOrder.push(99); } catch (e) {}
    var p1 = lay(build());
    rec('P1 the carried layout is a copy (editing one state does not leak into the next)', same(p1, STORED), show(p1));

    // Z - a run that returns no rows builds no header either.
    await run({ resp: { data: [] } });
    rec('Z0 fixture: after a 0-row run the flat header is empty', ths().length === 0, 'ths=' + ths().length);
    var z1 = lay(build());
    rec('Z1 a save after a 0-row run keeps the stored layout', same(z1, STORED), show(z1));

    // E - an app-level error at HTTP 200 ({error: ...}) takes the data[0].Error path.
    await run({ resp: { error: 'ORA-00942: table or view does not exist' } });
    rec('E0 fixture: after an HTTP-200 error the flat header is empty', ths().length === 0, 'ths=' + ths().length);
    var e1 = lay(build());
    rec('E1 a save after an HTTP-200 error keeps the stored layout', same(e1, STORED), show(e1));

    // I - a save while the run is still in flight (header already wiped).
    var ib = await run({ delay: 4000, noWait: true });
    await sleep(100);
    var i0 = ths().length === 0 && window.__queryDone === ib;
    rec('I0 fixture: mid-flight the header is already empty and no answer has come', i0, 'ths=' + ths().length + ' done=' + window.__queryDone + ' before=' + ib);
    var i1 = lay(build());
    rec('I1 a save while the run is in flight keeps the stored layout', same(i1, STORED), show(i1));
    await waitDone(ib, true);
    window.__queryDelay = 0;
    var i2 = lay(build());
    rec('I2 control: once the run lands, the header is back and is what the builder reads', same(i2, STORED) && ths().length === 7, show(i2) + ' ths=' + ths().length);

    // O - (c) a local override. With a table on screen the override IS what is
    // saved (WYSIWYG, the pill's "Save to report"); with no table the report's
    // STORED layout is kept - the override is one browser's view.
    localStorage.setItem('penumbra_column_prefs', J({ layoutfix: { order: ['NAME', 'ID', 'EMAIL', 'DEPT', 'PHONE', 'TITLE'], visible: ['NAME', 'ID', 'PHONE'], isNumVisible: false } }));
    await run({ table: true });
    var OV = { visibleColumns: [1, 0, 4], columnOrder: [1, 0, 3, 2, 4, 5] };
    rec('O0 fixture: the override is what renders', J(names()) === J(['#', 'NAME', 'ID', 'EMAIL', 'DEPT', 'PHONE', 'TITLE']) && J(shown()) === J(['NAME', 'ID', 'PHONE']),
      'names=' + J(names()) + ' shown=' + J(shown()));
    var o1 = lay(build());
    rec('O1 control (by design): with a table on screen the saved layout is the one on screen', same(o1, OV), show(o1));
    await run({ fail: FAIL500 });
    var o2 = lay(build());
    rec('O2 with no table the save keeps the REPORT\'s stored layout, not the override', same(o2, STORED), show(o2));
    localStorage.removeItem('penumbra_column_prefs');

    // S - a server save made from this page replaces what is carried forward.
    await run({ table: true });   // re-query restores the last layout seen (the override's)
    var LS = OV;
    var s0 = lay(build());
    rec('S0 fixture: the table on screen now differs from the stored layout', same(s0, LS), show(s0));
    var s1 = lay(await serverSave());
    rec('S1 control: a save with the table on screen POSTs the screen layout', same(s1, LS), show(s1));
    await run({ fail: FAIL500 });
    var s2 = lay(build());
    rec('S2 after that save, a failed run carries the NEWLY saved layout (not the boot one)', same(s2, LS), show(s2));

    // L - so does a local save (captured before any encryption).
    await run({ table: true });
    var hid = hideCol('PHONE');
    var LL = { visibleColumns: [1, 0], columnOrder: [1, 0, 3, 2, 4, 5] };
    var l0 = lay(build());
    rec('L0 fixture: PHONE hidden - the screen layout changed again', hid && same(l0, LL), show(l0));
    var l1 = lay(await localSave('layoutlocal'));
    rec('L1 control: the local save stores the screen layout', same(l1, LL), show(l1) + ' status=' + $('#localSaveStatus').text().slice(0, 80));
    await run({ fail: FAIL500 });
    var l2 = lay(build());
    rec('L2 after a local save, a failed run carries the locally saved layout', same(l2, LL), show(l2));

    // X - leaving the report for a raw table: its layout says nothing about that table.
    window.__queryFail = FAIL500;
    var xb = window.__queryDone;
    if (H.clearAll) H.clearAll('LAYOUT_OTHER');
    await waitDone(xb, false);
    rec('X0 fixture: clear-all ran a new query for the raw table and it failed', window.__queryDone > xb && ths().length === 0 && /LAYOUT_OTHER/.test(H.getEditor().getValue()),
      'done=' + window.__queryDone + ' ths=' + ths().length + ' sql=' + H.getEditor().getValue().slice(0, 60));
    var x1 = lay(build());
    rec('X1 exploring a raw table: a save carries NO layout from the report left behind', none(x1), show(x1));
  }

  async function modeBootFail() {
    await waitDone(0, false);
    rec('B0 fixture: the report\'s first run failed and left no header', window.__queryDone >= 1 && ths().length === 0,
      'done=' + window.__queryDone + ' ths=' + ths().length + ' sql=' + (H.getEditor ? H.getEditor().getValue().slice(0, 40) : '?'));
    var b1 = lay(build());
    rec('B1 opening a broken report and saving it keeps the stored layout', same(b1, STORED), show(b1));
    var b2 = lay(await serverSave());
    rec('B2 end to end: the Save dialog POSTs the stored layout', same(b2, STORED), show(b2));
  }

  async function modeAdhoc() {
    H.getEditor().setValue(window.__QUERY);
    await run({ table: true });
    rec('N0 fixture: an ad-hoc run renders all six columns', ths().length === 7, 'names=' + J(names()));
    // (b): no "equal to the default" omission exists - a default layout is written.
    var n1 = lay(build());
    rec('N1 control (b): the default layout (all shown, natural order) IS written', same(n1, { visibleColumns: ['#', 0, 1, 2, 3, 4, 5], columnOrder: [0, 1, 2, 3, 4, 5] }), show(n1));
    await run({ fail: FAIL500 });
    var n2 = lay(build());
    rec('N2 no report loaded: a failed run carries nothing (nothing is invented)', none(n2), show(n2));
    await run({ resp: { data: [] } });
    var n3 = lay(build());
    rec('N3 no report loaded: a 0-row run carries nothing', none(n3), show(n3));
    var n4 = lay(await serverSave());
    rec('N4 end to end: the Save dialog POSTs no layout keys for it', none(n4), show(n4));
  }

  (async function () {
    try {
      if (!H.buildState) { finish('hook: buildStateObject not exported'); return; }
      if (window.__MODE === 'bootfail') await modeBootFail();
      else if (window.__MODE === 'adhoc') await modeAdhoc();
      else await modeReport();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
