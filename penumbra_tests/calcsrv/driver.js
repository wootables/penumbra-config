// calcsrv suite - page half (2026-10-11). The REAL main.js + js/penumbra_calc.js on
// the saveconf harness (20 fixture columns, 0-19). The stored report (r*) carries
// calcColumns REP1 = {H_NUM} * 3 and REP2 = ROUND({REP1} / 2, 1), shown (20, 21).
//   rload    the report's columns: source 'report', FIRST (before a link's), tagged,
//            not "the viewer's own" (isCalc), totalled like any
//   rsave    the Save dialog's Last Stop list: every column ticked; untick some; the
//            saved state keeps the ticked ones (+ what they use), strips the rest and
//            renumbers the positions after it; afterwards they are the report's
//   rnolist  a save with no list showing: the report's own stay, the viewer's go
// window.__HC.bso = buildStateObject (run.py's hook).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
  }
  function th(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function shown(name) { var t = th(name); return !!t && t.style.display !== 'none'; }
  function cell(name) {
    var t = th(name); if (!t) return null;
    var ths = Array.prototype.slice.call(document.querySelectorAll('#tableHeader th'));
    var i = ths.indexOf(t), tr = document.querySelector('#resultsTable tbody tr');
    return tr && tr.children[i] ? tr.children[i].textContent.trim() : null;
  }
  function map() { return $('#resultsTable').data('columnNameToOriginalIndex') || {}; }
  function toast() { var t = document.getElementById('action_overlay'); return t ? t.textContent.replace(/\s+/g, ' ') : ''; }
  function num(v) { return parseFloat(String(v).replace(/[$,]/g, '')); }
  var F = function () { return window.__rowsFixture[0]; };
  async function save() {
    window.__SAVE_ANSWER = function (b) { return { ok: true, json: { success: true, new_id: b.short_id, numeric_id: 7, is_new: false, updated_at: '2026-10-11 10:00:00.000000' } }; };
    var n = window.__saves.length;
    $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
    await until(function () { return window.__saves.length > n; }, 8000); await sleep(300);
    var s = window.__saves[window.__saves.length - 1], sd = null;
    try { sd = JSON.parse(s.state_data); } catch (e) {}
    return sd;
  }
  var S = {
    rload: async function () {
      var f = F(), m = map();
      R.chk.shown = shown('REP1') && cell('REP1') === String(num(f.H_NUM) * 3) && shown('REP2');
      R.chk.first = m.REP1 === 20 && m.REP2 === 21 && m.MINE === 22;
      var act = window.PenumbraCalc.active();
      R.chk.source = act.length === 3 && act[0].src === 'report' && act[1].src === 'report' && act[2].src === 'url';
      var li = Array.prototype.slice.call(document.querySelectorAll('#pnbCalcList .pnb-calc-item'));
      var t1 = li.filter(function (x) { return /REP1/.test(x.textContent); })[0], t3 = li.filter(function (x) { return /MINE/.test(x.textContent); })[0];
      R.chk.tag = !!t1 && /in the report/.test(t1.textContent) && !t1.querySelector('[data-calc-keep]') && !!t3 && /from the link/.test(t3.textContent);
      R.chk.notCalc = window.PenumbraCalc.isCalc('REP1') === false && window.PenumbraCalc.isCalc('MINE') === true && window.PenumbraCalc.isReport('REP2') === true;
      R.chk.summable = window.PenumbraCalc.isSummable('REP1') === true;
      R.info = { map: m, act: act, list: li.map(function (x) { return x.textContent; }) };
    },
    rsave: async function () {
      // the viewer's own: A, B (URL), C uses B - after the report's REP1, REP2
      var m = map();
      R.chk.before = m.REP1 === 20 && m.REP2 === 21 && m.A === 22 && m.B === 23 && m.C === 24;
      // the Save dialog opening (main.js calls this from the #saveQuery handler)
      window.PenumbraCalc.renderSaveList();
      var boxes = Array.prototype.slice.call(document.querySelectorAll('#pnbCalcSaveRow input[data-calc-save]'));
      R.chk.listed = boxes.map(function (b) { return b.getAttribute('data-calc-save') + (b.checked ? '+' : '-'); }).join(',') === 'REP1+,REP2+,A+,B+,C+'
        && !!document.getElementById('lastStopCardBody').querySelector('#pnbCalcSaveRow');
      R.chk.hint = /Saves 5 calculated columns with the report/.test(document.querySelector('#lastStopCard .lsc-collapsed-hint').textContent);
      // keep REP1, C; leave out REP2, A, B (C uses B: B goes along)
      ['REP2', 'A', 'B'].forEach(function (n) { var b = document.querySelector('#pnbCalcSaveRow input[data-calc-save="' + n + '"]'); b.checked = false; b.dispatchEvent(new Event('change', { bubbles: true })); });
      R.chk.hintFollows = /Saves 2 calculated columns/.test(document.querySelector('#lastStopCard .lsc-collapsed-hint').textContent);
      var sd = await save();
      var cc = sd && sd.calcColumns ? sd.calcColumns.map(function (d) { return d.name; }).join(',') : '';
      R.chk.kept = cc === 'REP1,B,C';
      // before: REP1 20, REP2 21, A 22, B 23, C 24 -> REP2 and A out: B 21, C 22
      var vis = sd ? sd.visibleColumns : [], ord = sd ? sd.columnOrder : [];
      R.chk.positions = vis.indexOf(20) !== -1 && vis.indexOf(21) !== -1 && vis.indexOf(22) !== -1 && vis.indexOf(23) === -1 && vis.indexOf(24) === -1
        && ord.slice(-3).join(',') === '20,21,22' && ord.indexOf(23) === -1 && vis.indexOf(0) !== -1 && vis.indexOf(19) === -1;
      await sleep(1300);   // (the module says it 900 ms on - after the save's own toast)
      R.chk.depSaid = /Also saved B/.test(toast());
      var act = window.PenumbraCalc.active();
      R.chk.nowReport = act.filter(function (d) { return d.src === 'report'; }).map(function (d) { return d.name; }).join(',') === 'REP1,B,C'
        && act.some(function (d) { return d.name === 'A' && d.src === 'url'; });
      // calcsrv2: an unticked column the table showed stays the viewer's own (REP2 was the report's); a link's stays the link's
      R.chk.untickedKept = act.some(function (d) { return d.name === 'REP2' && d.src === 'saved'; }) && act.some(function (d) { return d.name === 'A' && d.src === 'url'; });
      R.info = { cc: cc, vis: vis, ord: ord && ord.slice(-6), toast: toast().slice(0, 300), act: act, before: m };
    },
    radj: async function () {
      var f = F(), C = window.PenumbraCalc;
      R.chk.shown = shown('D') && cell('D') === String(num(f.H_NUM) * 3) && C.inputs().R.value === 3 && C.inputs().R.min === 1 && C.inputs().R.max === 9;
      var q0 = window.__queryDone;
      C.setInput('R', 4);
      await until(function () { return window.__queryDone > q0 && cell('D') === String(num(f.H_NUM) * 4); }, 15000); await sleep(300);
      R.chk.moved = cell('D') === String(num(f.H_NUM) * 4) && C.inputs().R.value === 4 && C.inputs().R.def === 3;
      C.renderSaveList();
      var sd = await save();
      var dd = sd && sd.calcColumns ? sd.calcColumns.filter(function (d) { return d.name === 'D'; })[0] : null;
      R.chk.kept = !!dd && JSON.stringify(dd.input) === JSON.stringify({ name: 'R', value: 4, min: 1, max: 9 });
      await sleep(200);
      R.chk.spent = C.inputs().R.value === 4 && C.inputs().R.def === 4 && C.active().some(function (d) { return d.name === 'D' && d.src === 'report'; });
      R.info = { d: cell('D'), inputs: C.inputs(), dd: dd, act: C.active() };
    },
    rnolist: async function () {
      var sd = await save();
      var cc = sd && sd.calcColumns ? sd.calcColumns.map(function (d) { return d.name; }).join(',') : '';
      R.chk.reportKept = cc === 'REP1,REP2';
      var vis = sd ? sd.visibleColumns : [];
      R.chk.mineGone = vis.indexOf(22) === -1 && vis.indexOf(20) !== -1 && vis.indexOf(21) !== -1;
      R.info = { cc: cc, vis: vis, act: window.PenumbraCalc.active() };
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
