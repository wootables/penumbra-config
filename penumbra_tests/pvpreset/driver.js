// pvpreset suite - page half (2026-10-22): the pivot builder's Presets chip on the REAL main.js
// and js/penumbra_presets.js, over a saved pivot (H_GROUP > H_GROUP2 down, V_STATUS across,
// sum of H_AMT; Frozen 2).
//   psticky  Frozen None / 1 / 2 / 3, each saved through the chip (its getState is the real
//            _pivotBuildSnapshotFromBuilder), then each applied back (applyState) over a
//            different Frozen: the builder shows what was saved. Generate over the None preset
//            freezes no row-label column (over the 1 preset, the first alone). A Frozen select
//            with no value saves the default, 3.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function cells() { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]'); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return cells().length > 0; }, 20000))) throw new Error('no pivot value cells');
    await sleep(600);
  }
  function P() { return window.Penumbra && window.Penumbra.pivotMenu; }
  function chip() { return document.querySelector('#pivotPresetMount .pnb-preset-chip'); }
  function pop() { return document.querySelector('#pivotPresetMount .pnb-preset-pop'); }
  function frozenNow() { return $('#pivot-sticky-cols').val(); }
  function setFrozen(v) { $('#pivot-sticky-cols').val(v).trigger('change'); }
  async function openPop() {
    var p = pop();
    if (!p || !chip()) return false;
    if (p.hidden) { chip().click(); await sleep(60); }
    return !p.hidden;
  }
  // Save current view... -> the name prompt (answered here) -> the engine's store
  async function save(name) {
    if (!(await openPop())) return false;
    var b = pop().querySelector('.pnb-preset-save');
    if (!b) return false;
    window.prompt = function () { return name; };
    try { b.click(); } finally { window.prompt = function () { return null; }; }
    await sleep(60);
    return true;
  }
  function stored(name) {
    var E = window.PenumbraPresets;
    return E ? E.get(E.NS.PIVOT, E.reportId(), name) : null;
  }
  // the preset's row in the chip's list -> applyState (the builder repopulated from it)
  async function load(name) {
    if (!(await openPop())) return false;
    var hit = null;
    Array.prototype.forEach.call(pop().querySelectorAll('.pnb-preset-row .pnb-preset-pick'), function (b) {
      var n = b.querySelector('.pnb-preset-rname');
      if (n && n.textContent === name) hit = b;
    });
    if (!hit) return false;
    hit.click();
    await sleep(100);
    return true;
  }
  // how many row-label cells (headings and body) carry each frozen-column class: [first, second,
  // third]. Not the footer: its Grand Total label is classed frozen whatever Frozen says (below).
  function stickyCls() {
    var t = document.getElementById('pivotResultTable');
    return t ? ['pivot-sticky-col', 'pivot-sticky-col-2', 'pivot-sticky-col-3'].map(function (c) { return t.querySelectorAll('thead .' + c + ', tbody .' + c).length; }) : null;
  }
  // (info only) the footer row against the first body row: their widths in columns, and the
  // label cell's colspan and classes
  function footInfo() {
    var t = document.getElementById('pivotResultTable');
    var f = t && t.querySelector('tfoot tr'), b = t && t.querySelector('tbody tr');
    function cols(tr) { return tr ? Array.prototype.reduce.call(tr.cells, function (a, c) { return a + c.colSpan; }, 0) : null; }
    var c0 = f && f.cells[0];
    return { foot: cols(f), body: cols(b), label: c0 ? { colspan: c0.getAttribute('colspan'), cls: c0.className } : null };
  }
  // Generate ends in hideLoading, and the new pivot has value cells
  async function generate() {
    var h0 = window.__HC_HIDES || 0;
    $('#generatePivotBtn').trigger('click');
    await until(function () { return (window.__HC_HIDES || 0) > h0 && cells().length > 0; }, 30000);
    await sleep(500);
    return (window.__HC_HIDES || 0) > h0;
  }

  var S = {
    psticky: async function () {
      $('#pivotBtn').trigger('click');
      await sleep(300);
      // the chip mounted on the builder, which shows the saved pivot's Frozen 2
      R.chk.chip = !!chip() && !!pop() && frozenNow() === '2';
      R.info.boot = { chip: !!chip(), frozen: frozenNow() };
      var K = [0, 1, 2, 3], saved = {}, back = {}, i, d, ok;
      for (i = 0; i < K.length; i++) {
        setFrozen(String(K[i]));
        ok = await save('frz' + K[i]);
        d = stored('frz' + K[i]);
        saved[K[i]] = (ok && d) ? d.stickyColCount : 'not saved';
      }
      R.info.saved = saved;
      R.chk.saveNone = saved[0] === 0;
      R.chk.saveOne = saved[1] === 1;
      R.chk.saveTwo = saved[2] === 2;
      R.chk.saveThree = saved[3] === 3;
      // each applied over a different Frozen: the builder shows what was saved
      for (i = 0; i < K.length; i++) {
        setFrozen(K[i] === 3 ? '0' : '3');
        ok = await load('frz' + K[i]);
        back[K[i]] = ok ? frozenNow() : 'not loaded';
      }
      R.info.restored = back;
      R.chk.restoreNone = back[0] === '0';
      R.chk.restoreOne = back[1] === '1';
      R.chk.restoreTwo = back[2] === '2';
      R.chk.restoreThree = back[3] === '3';
      // Generate over the None preset: no row-label column frozen
      setFrozen('3');
      var okN = await load('frz0'), genN = okN && (await generate());
      var s = P() && P().settings(), cls = stickyCls();
      R.info.genNone = { loaded: okN, rebuilt: genN, sticky: s && s.stickyColCount, cls: cls, foot: footInfo() };
      R.chk.genNone = !!genN && !!s && s.stickyColCount === 0 && !!cls && cls.every(function (n) { return n === 0; });
      // over the 1 preset: the first column alone (a guard: the count does see a frozen column)
      var okO = await load('frz1'), genO = okO && (await generate());
      s = P() && P().settings(); cls = stickyCls();
      R.info.genOne = { loaded: okO, rebuilt: genO, sticky: s && s.stickyColCount, cls: cls, foot: footInfo() };
      R.chk.genOne = !!genO && !!s && s.stickyColCount === 1 && !!cls && cls[0] > 0 && cls[1] === 0 && cls[2] === 0;
      // a Frozen select with no value (no option matches): the default 3, never NaN (null once stored)
      $('#pivotBtn').trigger('click');
      await sleep(300);
      $('#pivot-sticky-cols').val('zz');
      var okD = await save('frzDefault'), dd = stored('frzDefault');
      R.info.saveDefault = { saved: okD, frozen: frozenNow(), sticky: dd && dd.stickyColCount };
      R.chk.saveDefault = okD && frozenNow() === null && !!dd && dd.stickyColCount === 3;
      R.info.err = $('#pivotErrorBox').text();
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
