// snaplayout suite - page half (2026-10-17). Leaving a snapshot view puts the live table's
// column layout back (restoreOriginalData -> rebuildTableFromMasterData renders every column
// in QUERY order -> applyColumnLayoutByName(captured layout)). The report opens with its
// saved layout out of query order (V_STATUS first, V_AMOUNT hidden, H_GROUP shown); the
// driver loads a 40-row snapshot through the real loadSnapshotData, leaves it through the
// caution icon's click handler, and reads the restored table.
//   snap   300 rows; run.py's hook counts what applyColumnLayoutByName does (window.__ACL):
//          tbody.rows reads, cell moves inside body rows, the body taken off the page
//   sbig   20,000 rows; the restore's applyColumnLayoutByName timed (no counting)
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function bodyRows() { var tb = document.querySelector('#resultsTable tbody'); return tb ? tb.rows.length : 0; }
  function heads() { return Array.prototype.slice.call(document.querySelectorAll('#tableHeader th')); }
  function allNames() { return heads().map(function (t) { return t.getAttribute('data-colname'); }); }
  function shownNames() { return heads().filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-colname'); }); }
  var PLAIN = ['V_ID', 'V_NAME', 'V_STATUS', 'H_GROUP', 'H_TEXT', 'H_CODE'];
  // every row (or every step-th): its cells line up with the header - same column, same
  // shown/hidden - and the plain columns hold the fixture row's values
  function follow(step) {
    var hs = heads(), ids = hs.map(function (t) { return t.getAttribute('data-column'); });
    var hid = hs.map(function (t) { return t.style.display === 'none'; });
    var idx = {}; hs.forEach(function (t, i) { idx[t.getAttribute('data-colname')] = i; });
    var trs = document.querySelectorAll('#resultsTable tbody tr'), bad = { align: 0, vis: 0, text: 0, first: null }, n = 0;
    for (var r = 0; r < trs.length; r += step) {
      var tr = trs[r], cs = tr.children; n++;
      var a = cs.length === ids.length, v = true, tx = true;
      for (var i = 0; a && i < cs.length; i++) {
        if (cs[i].getAttribute('data-column') !== ids[i]) a = false;
        else if ((cs[i].style.display === 'none') !== hid[i]) v = false;
      }
      var fx = window.__rowsFixture[parseInt(cs[0] ? cs[0].textContent : '', 10) - 1];
      if (!fx) tx = false;
      else PLAIN.forEach(function (nm) {
        var c = cs[idx[nm]], want = fx[nm] == null ? '' : String(fx[nm]);
        if (!c || c.textContent.trim() !== want.trim()) tx = false;
      });
      if (!a) bad.align++; if (!v) bad.vis++; if (!tx) bad.text++;
      if ((!a || !v || !tx) && !bad.first) bad.first = { r: r, cells: Array.prototype.slice.call(cs, 0, 8).map(function (c) { return c.getAttribute('data-column') + (c.style.display === 'none' ? '/h' : '') + '=' + c.textContent.slice(0, 12); }) };
    }
    bad.n = n;
    return bad;
  }
  async function roundTrip(count) {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1 && bodyRows() > 0; }, 200000))) throw new Error('boot: never loaded');
    await sleep(600);
    window.show_text = function () { };
    var liveRows = bodyRows();
    var before = { all: allNames(), shown: shownNames() };
    R.info.before = before.shown;
    R.chk.setup = before.shown.join(' ') === '# V_STATUS V_ID V_DATE V_NAME H_GROUP V_LINK';
    if (!window.__pnbSnap) throw new Error('no snapshot hook');
    var snapRows = window.__rowsFixture.slice(0, 40).map(function (r) { return { rowData: r }; });
    var hides = window.__HC_HIDES;
    window.__pnbSnap.load({ name: 'zz snap', timestamp: '2026-10-01 10:00:00', compressedData: JSON.stringify(snapRows) });
    if (!(await until(function () { return window.__HC_HIDES > hides && bodyRows() === 40; }, 60000))) throw new Error('snapshot never shown: rows ' + bodyRows());
    await sleep(400);
    R.info.inSnap = shownNames().slice(0, 8);
    window.__ACL = null;
    window.__ACL_COUNT = !!count;
    hides = window.__HC_HIDES;
    $('#snapshotCautionIcon').trigger('click');
    if (!(await until(function () { return window.__ACL && window.__HC_HIDES > hides && bodyRows() === liveRows; }, 120000)))
      throw new Error('restore never finished: acl ' + JSON.stringify(window.__ACL) + ' rows ' + bodyRows());
    var t0 = performance.now();
    await new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); });
    R.info.frameAfter = Math.round(performance.now() - t0);
    window.__ACL_COUNT = false;
    var acl = window.__ACL;
    R.info.acl = acl;
    R.info.after = shownNames();
    R.chk.restored = allNames().join(' ') === before.all.join(' ') && shownNames().join(' ') === before.shown.join(' ');
    return { acl: acl, rows: liveRows };
  }
  var S = {
    snap: async function () {
      var o = await roundTrip(true), acl = o.acl;
      var f = follow(1);
      R.info.follow = f;
      R.chk.cellsFollow = f.n === o.rows && f.align === 0 && f.text === 0;
      R.chk.hiddenFollow = f.n === o.rows && f.vis === 0;
      // only the moved columns' cells move: the fixture's restore moves 3 columns, a full
      // pass re-appends all 21 cells of every row
      R.chk.restoreMinimal = acl.moves > 0 && acl.moves <= o.rows * 4;
      R.chk.stayAttached = acl.detach === 0;
      R.chk.noRowsWalk = acl.rowsGets <= 2;
    },
    sbig: async function () {
      var o = await roundTrip(false), acl = o.acl;
      var f = follow(97);
      R.info.follow = f;
      R.info.perf = { ms: Math.round(acl.ms), rows: o.rows, frameAfter: R.info.frameAfter };
      R.chk.cellsFollow = f.align === 0 && f.text === 0 && f.vis === 0 && f.n > 200;
      // 20,000 rows: the old pass took seconds (quadratic rows[r] + every cell re-appended)
      R.chk.fast = acl.ms < 1500;
    }
  };
  (async function () {
    try {
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); R.chk.__fatal = R.fatal; }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    if (R.fatal) R.errors.push('driver: ' + R.fatal.slice(0, 300));
    window.__HCRESULT = R; window.__HCDONE = true;
    var o = document.getElementById('out'); if (o) o.textContent = 'DONE';
  })();
})();
