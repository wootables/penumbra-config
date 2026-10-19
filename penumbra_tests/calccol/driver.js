// calccol suite - page half (2026-10-10). The REAL main.js + js/penumbra_calc.js on
// the saveconf harness (300 fixture rows; the stored report shows columns 0-5).
// window.__HC.bso = buildStateObject (exposed by run.py's hook).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(500);
  }
  function th(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function shown(name) { var t = th(name); return !!t && t.style.display !== 'none'; }
  // the first body row's cell under a column (by the header's position among the ths)
  function cell(name) {
    var t = th(name); if (!t) return null;
    var ths = Array.prototype.slice.call(document.querySelectorAll('#tableHeader th'));
    var i = ths.indexOf(t);
    var tr = document.querySelector('#resultsTable tbody tr');
    return tr && tr.children[i] ? tr.children[i].textContent.trim() : null;
  }
  function toast() { var t = document.getElementById('action_overlay'); return t ? t.textContent.replace(/\s+/g, ' ') : ''; }
  var F = function () { return window.__rowsFixture[0]; };
  function num(v) { return parseFloat(String(v).replace(/[$,]/g, '')); }
  var S = {
    // &calc= on the URL: the columns arrive with the rows, shown, worked out; a bad one is named
    curl: async function () {
      await sleep(1200);   // (the module says what it left out once the table is built)
      var f = F();
      R.chk.halfShown = shown('HALF') && cell('HALF') === String(Number((num(f.H_NUM) / 2).toFixed(6)));
      var dbl = num(f.V_AMOUNT) * 2;
      R.chk.dblCurrency = shown('DBL') && cell('DBL') === '$' + dbl.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      R.chk.flagText = shown('FLAG') && cell('FLAG') === (String(f.V_STATUS).toLowerCase() === 'open' ? 'yes' : 'no');
      R.chk.badLeftOut = !th('BAD') && /BAD.*left out/.test(toast());
      R.chk.atEnd = (function () { var m = $('#resultsTable').data('columnNameToOriginalIndex') || {}; return m.HALF === 20 && m.DBL === 21 && m.FLAG === 22; })();
      R.chk.panelFromLink = !!document.querySelector('#pnbCalcList [data-calc-keep="HALF"]') && /not shown/.test((document.querySelector('#pnbCalcList') || {}).textContent || '');
      // 2026-10-10 calcsweep: by exact name, not pushed into the substring whitelist
      R.chk.summable = !!(window.PenumbraCalc && window.PenumbraCalc.isSummable && window.PenumbraCalc.isSummable('HALF')) &&
        (penumbra_vars.totalExemptions || []).indexOf('HALF') === -1;
      R.info = { half: cell('HALF'), dbl: cell('DBL'), flag: cell('FLAG'), toast: toast().slice(0, 200), map: $('#resultsTable').data('columnNameToOriginalIndex') };
    },
    // the panel's dialog: add -> the query runs again and the column is there; edit; remove
    cadd: async function () {
      // the Settings panel is OPEN while the column is added (calccol3: its list must follow)
      document.getElementById('settingsPanel').classList.add('is-open');
      var b = document.getElementById('pnbCalcAdd');
      R.chk.addButton = !!b;
      if (!b) return;
      b.click();
      R.chk.dialog = !!document.getElementById('pnbCalcOverlay');
      // the layout (2026-10-10, calccol2): each label sits directly ABOVE its field, left edges lined up
      function lab(id) {
        var l = document.querySelector('#pnbCalcOverlay label[for="' + id + '"]'), f = document.getElementById(id);
        if (!l || !f) return false;
        var a = l.getBoundingClientRect(), b = f.getBoundingClientRect();
        return a.bottom <= b.top + 1 && Math.abs(a.left - b.left) <= 2 && b.width > 120;
      }
      R.chk.layout = lab('pnbCalcName') && lab('pnbCalcFmt') && lab('pnbCalcFormula') && !document.getElementById('pnbCalcCol');
      // (2026-10-19, calcadj round 2) the cheat sheet's row labels are plain, not the data grid's
      // gradient headers, and its cells wrap instead of ending in an ellipsis
      var cth = document.querySelector('#pnbCalcOverlay .pnb-calc-cheat th'), ctd = document.querySelector('#pnbCalcOverlay .pnb-calc-cheat td');
      R.chk.cheatPlain = !!cth && getComputedStyle(cth).backgroundImage === 'none' && getComputedStyle(cth).cursor !== 'pointer'
        && !!ctd && getComputedStyle(ctd).whiteSpace === 'normal' && getComputedStyle(ctd).textOverflow === 'clip';
      R.info.cheat = { bg: cth && getComputedStyle(cth).backgroundImage.slice(0, 40), ws: ctd && getComputedStyle(ctd).whiteSpace };
      // the adjustable value's five fields share one line; its token chip sits inline in its sentence
      document.getElementById('pnbCalcAdjWrap').open = true;
      var fy = ['pnbCalcAdjName', 'pnbCalcAdjVal', 'pnbCalcAdjMin', 'pnbCalcAdjMax', 'pnbCalcAdjStep'].map(function (id) { return Math.round(document.getElementById(id).getBoundingClientRect().top); });
      var tok = document.getElementById('pnbCalcAdjTok'), tokP = tok.closest('.pnb-calc-adj-help');
      R.chk.adjOneLine = fy.every(function (y) { return y === fy[0]; }) && Math.abs(tok.getBoundingClientRect().top - tokP.getBoundingClientRect().top) < 14;
      R.info.adjRow = { ys: fy, tokTop: tok.getBoundingClientRect().top, helpTop: tokP.getBoundingClientRect().top };
      document.getElementById('pnbCalcAdjWrap').open = false;
      R.chk.noEarlyError = document.getElementById('pnbCalcErr').textContent === '';
      // the columns: the copy templates' list - click one, it goes in at the cursor
      var chips = Array.prototype.slice.call(document.querySelectorAll('#pnbCalcCols.pnb-tpl-placeholders code'));
      R.chk.chips = chips.length === 20 && chips.some(function (c) { return c.textContent === '{H_NUM}'; })
        && document.getElementById('pnbCalcFormula').classList.contains('pnb-tpl-field');
      document.getElementById('pnbCalcName').value = 'Ratio';
      var ta = document.getElementById('pnbCalcFormula');
      ta.focus();
      ta.value = 'ROUND( / {H_AMT}, 2)';
      ta.setSelectionRange(6, 6);
      ta.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      var chip = chips.filter(function (c) { return c.textContent === '{H_NUM}'; })[0];
      if (chip) chip.click();
      await sleep(300);
      R.chk.chipInserts = ta.value === 'ROUND({H_NUM} / {H_AMT}, 2)' && ta.selectionStart === 13;
      if (!R.chk.chipInserts) ta.value = 'ROUND({H_NUM} / {H_AMT}, 2)';   // the rest of the scenario still runs
      R.info.ta = ta.value;
      R.chk.preview = document.querySelectorAll('#pnbCalcPrev tbody tr').length === 5 && document.getElementById('pnbCalcErr').textContent === '';
      var q0 = window.__queryDone;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return window.__queryDone > q0 && !!th('RATIO'); }, 15000); await sleep(400);
      var f = F();
      var want = Math.round(num(f.H_NUM) / num(f.H_AMT) * 100 * (1 + 1e-12)) / 100;
      R.chk.reran = window.__queryDone > q0;
      R.chk.added = shown('RATIO') && Number(cell('RATIO')) === want;
      function listed(n) { return Array.prototype.some.call(document.querySelectorAll('#spColumnList .sp-col-item'), function (el) { return el.textContent.indexOf(n) !== -1; }); }
      await until(function () { return listed('RATIO'); }, 4000);
      R.chk.listAfterAdd = listed('RATIO') && listed('V_ID');
      // edit it (no RATIO to edit = the add failed: the checks below stay unset, so red)
      var editBtn = document.querySelector('#pnbCalcList [data-calc-edit="RATIO"]');
      if (!editBtn) { R.info = { ta: R.info.ta, err: (document.getElementById('pnbCalcErr') || {}).textContent }; return; }
      editBtn.focus();   // a keyboard user's Enter (moderate 2026-10-15: editFocus / removeFocus)
      editBtn.click();
      document.getElementById('pnbCalcFormula').value = '{H_NUM} * 0';
      var q1 = window.__queryDone;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return window.__queryDone > q1; }, 15000); await sleep(400);
      R.chk.edited = cell('RATIO') === '0';
      // WCAG 2.4.3: the list is rebuilt under the Edit button that opened the dialog; Save lands
      // on that row's Edit button again, not on the page
      var ae1 = document.activeElement;
      R.chk.editFocus = !!ae1 && ae1.matches && ae1.matches('#pnbCalcList [data-calc-edit="RATIO"]');
      R.info.focus1 = ae1 ? ae1.tagName + '#' + ae1.id + '.' + ae1.className + ' ' + (ae1.getAttribute('data-calc-edit') || '') : null;
      // remove it
      var q2 = window.__queryDone;
      var delBtn = document.querySelector('#pnbCalcList [data-calc-del="RATIO"]');
      delBtn.focus();
      delBtn.click();
      // its row is gone: focus on + Add calculated column (no other row's Remove to land on)
      var ae2 = document.activeElement;
      R.chk.removeFocus = !!ae2 && ae2.id === 'pnbCalcAdd';
      R.info.focus2 = ae2 ? ae2.tagName + '#' + ae2.id : null;
      await until(function () { return window.__queryDone > q2; }, 15000); await sleep(400);
      R.chk.removed = !th('RATIO');
      await until(function () { return !listed('RATIO'); }, 4000);
      R.chk.listAfterRemove = !listed('RATIO') && listed('V_ID');
      R.info = { ratio: cell('RATIO'), want: want, q: [q0, q1, q2, window.__queryDone], act: window.PenumbraCalc.active(), applied: window.PenumbraCalc.applied() };
    },
    // (2026-10-18, calcadj) an adjustable value through the dialog: its knob in the panel's row
    // and under the header menu's Adjust...; a change re-runs the query; the view state carries
    // the moved value; the reset button puts the default back
    cadj: async function () {
      document.getElementById('settingsPanel').classList.add('is-open');
      document.getElementById('pnbCalcAdd').click();
      var wrap = document.getElementById('pnbCalcAdjWrap');
      R.chk.row = !!wrap && !wrap.open;
      if (wrap) wrap.open = true;
      document.getElementById('pnbCalcName').value = 'FA';
      document.getElementById('pnbCalcFormula').value = '{H_AMT} * {@RATE}';
      document.getElementById('pnbCalcAdjName').value = 'rate';
      document.getElementById('pnbCalcAdjVal').value = '0.5';
      document.getElementById('pnbCalcAdjMin').value = '0';
      document.getElementById('pnbCalcAdjMax').value = '1';
      document.getElementById('pnbCalcAdjStep').value = '0.05';
      document.getElementById('pnbCalcFormula').dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(250);
      R.chk.preview = document.getElementById('pnbCalcErr').textContent === '' && document.querySelectorAll('#pnbCalcPrev tbody tr').length === 5;
      var f = F(), q0 = window.__queryDone;
      function want(rate) { return String(Number((num(f.H_AMT) * rate).toFixed(6))); }
      document.getElementById('pnbCalcGo').click();
      await until(function () { return window.__queryDone > q0 && !!th('FA'); }, 15000); await sleep(400);
      R.chk.added = shown('FA') && cell('FA') === want(0.5);
      // (round 3) from here on every change REPLAYS the last answer: the query counter must not move
      var qBase = window.__queryDone;
      await until(function () { return !!document.querySelector('#pnbCalcList [data-calc-input="RATE"]'); }, 4000);
      var knob = document.querySelector('#pnbCalcList [data-calc-input="RATE"]'), range = document.querySelector('#pnbCalcList [data-calc-range="RATE"]');
      var rst = document.querySelector('#pnbCalcList [data-calc-inpreset="RATE"]');
      R.chk.panelKnob = !!knob && knob.value === '0.5' && !!range && range.min === '0' && range.max === '1' && range.step === '0.05' && !!rst && rst.hidden === true;
      // Enter in the box applies it: the query runs again and the column follows
      var q1 = window.__queryDone;
      if (knob) { knob.value = '0.25'; knob.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }
      await until(function () { return cell('FA') === want(0.25); }, 15000); await sleep(300);
      R.chk.changed = cell('FA') === want(0.25) && document.querySelector('#pnbCalcList [data-calc-input="RATE"]').value === '0.25'
        && document.querySelector('#pnbCalcList [data-calc-inpreset="RATE"]').hidden === false;
      var st = window.__HC.bso();
      R.chk.stateCarries = !!st && Array.isArray(st.calcColumns) && st.calcColumns.some(function (d) {
        return d.name === 'FA' && d.input && d.input.name === 'RATE' && d.input.value === 0.25 && d.input.min === 0 && d.input.max === 1 && d.input.step === 0.05;
      });
      // the header menu: Adjust RATE... opens a panel with the same knob; a change there re-runs too
      var t = th('FA'), r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
      await sleep(300);
      // (round 3) ONE Calculated column entry; its list holds Add (four placements), then Edit,
      // Copy formula, Remove and Adjust for a calculated column
      var mr = document.getElementById('pnbHeadMenu').getBoundingClientRect(), menuAt = { x: mr.left, y: mr.top };
      var ce = document.querySelector('#pnbHeadMenu [data-act="calc"]');
      var topActs = Array.prototype.map.call(document.querySelectorAll('#pnbHeadMenu .pnb-hm-item'), function (e) { return e.getAttribute('data-act'); });
      if (ce) ce.click();
      await sleep(300);
      var subP = document.querySelector('.pnb-hm-sub');
      var acts = subP ? Array.prototype.map.call(subP.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : [];
      var it = subP ? subP.querySelector('[data-act="calcAdj"]') : null;
      R.chk.menuItem = !!it && /Adjust RATE/.test(it.textContent) && !!ce && /Calculated column/.test(ce.textContent)
        && topActs.indexOf('calcEdit') < 0 && topActs.indexOf('calcRemove') < 0 && topActs.indexOf('calcAdj') < 0;
      R.chk.menuEditItem = acts.indexOf('calc-left') === 0 && acts.indexOf('calcEdit') > acts.indexOf('calc-end') && acts.indexOf('calcCopy') > acts.indexOf('calcEdit')
        && acts.indexOf('calcRemove') > acts.indexOf('calcCopy') && acts.indexOf('calcAdj') > acts.indexOf('calcRemove');
      R.info.subActs = acts;
      if (it) it.click();
      await sleep(300);
      var mk = document.querySelector('#pnbHeadPanel [data-calc-input="RATE"]');
      R.chk.menuPanel = !!mk && mk.value === '0.25' && !!document.querySelector('#pnbHeadPanel [data-calc-range="RATE"]');
      // (round 2) the panel is placed where the menu was and fits the viewport (it sat at the page's end before)
      var pe = document.getElementById('pnbHeadPanel'), pr = pe ? pe.getBoundingClientRect() : null;
      R.chk.menuPanelPlaced = !!pr && pr.bottom <= window.innerHeight && pr.right <= window.innerWidth && pr.top >= 0 && Math.abs(pr.left - Math.min(menuAt.x, window.innerWidth - pr.width - 4)) <= 2
        && Math.abs(pr.top - Math.min(menuAt.y, window.innerHeight - pr.height - 4)) <= 2;
      R.info.panelRect = pr ? { top: pr.top, left: pr.left, h: pr.height, menuAt: menuAt, vh: window.innerHeight } : null;
      var q2 = window.__queryDone;
      if (mk) { mk.value = '1'; mk.dispatchEvent(new Event('change', { bubbles: true })); }
      await until(function () { return cell('FA') === want(1); }, 15000); await sleep(300);
      R.chk.menuChanged = cell('FA') === want(1);
      // (round 2) a value over the highest, applied with Enter: the box springs to the bound, as the value does
      var q2b = window.__queryDone, kb2 = document.querySelector('#pnbCalcList [data-calc-input="RATE"]');
      kb2.focus(); kb2.value = '5'; kb2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      R.chk.boxSprings = kb2.value === '1' && window.PenumbraCalc.inputs().RATE.value === 1;
      await until(function () { return cell('FA') === want(1); }, 15000); await sleep(300);
      // ...and a run returning while the box holds a half-typed value keeps it, with the caret
      // (the move first - it syncs every box at once - then the typing, before the run it scheduled returns)
      var q2c = window.__queryDone; window.PenumbraCalc.setInput('RATE', 0.5);
      var kb3 = document.querySelector('#pnbCalcList [data-calc-input="RATE"]');
      kb3.focus(); kb3.value = '0.7'; kb3.setSelectionRange(3, 3);
      await until(function () { return cell('FA') === want(0.5); }, 15000); await sleep(300);
      var kb4 = document.querySelector('#pnbCalcList [data-calc-input="RATE"]');
      R.chk.typedKept = !!kb4 && kb4.value === '0.7' && document.activeElement === kb4 && kb4.selectionStart === 3;
      R.info.typed = { v: kb4 && kb4.value, ae: document.activeElement && document.activeElement.tagName };
      // Edit this calculated column... from the header menu opens the dialog on the column, its value row open
      var t2 = th('FA'), r2 = t2.getBoundingClientRect();
      t2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r2.left + 6), clientY: Math.round(r2.top + 6) }));
      await sleep(300);
      var ce2 = document.querySelector('#pnbHeadMenu [data-act="calc"]'); if (ce2) ce2.click();
      await sleep(300);
      var ie = document.querySelector('.pnb-hm-sub [data-act="calcEdit"]');
      if (ie) ie.click();
      await sleep(300);
      R.chk.menuEditOpens = !!document.getElementById('pnbCalcOverlay') && document.getElementById('pnbCalcName').value === 'FA'
        && document.getElementById('pnbCalcAdjWrap').open === true && document.getElementById('pnbCalcAdjName').value === 'RATE';
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      // the reset puts the default back, and focus stays on the knob (the button hides itself)
      window.PenumbraCalc.setInput('RATE', 0.25);
      await until(function () { return cell('FA') === want(0.25); }, 15000); await sleep(300);
      var q3 = window.__queryDone, rb = document.querySelector('#pnbCalcList [data-calc-inpreset="RATE"]');
      if (rb) { rb.focus(); rb.click(); }
      var aeR = document.activeElement;
      R.chk.resetFocus = !!aeR && aeR.getAttribute && aeR.getAttribute('data-calc-input') === 'RATE';
      await until(function () { return cell('FA') === want(0.5); }, 15000); await sleep(300);
      R.chk.reset = cell('FA') === want(0.5) && window.PenumbraCalc.inputs().RATE.value === 0.5;
      // (round 3) none of the changes above asked the database: the last answer was replayed
      R.chk.noQuery = window.__queryDone === qBase;
      R.info.queries = { base: qBase, now: window.__queryDone };
      R.info = { fa: cell('FA'), want: [want(0.5), want(0.25), want(1)], q: [q0, q1, q2, q3, window.__queryDone], inputs: window.PenumbraCalc.inputs(),
        menu: it ? it.textContent : null, state: st && st.calcColumns, err: document.getElementById('pnbCalcErr') ? document.getElementById('pnbCalcErr').textContent : null };
    },
    // Clear All Custom Preferences takes the calculated columns too (calccol3)
    cclear: async function () {
      window.PenumbraCalc.openDialog(null);
      document.getElementById('pnbCalcName').value = 'GONE';
      document.getElementById('pnbCalcFormula').value = '{H_NUM} + 1';
      var q0 = window.__queryDone;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return window.__queryDone > q0 && !!th('GONE'); }, 15000); await sleep(300);
      R.chk.before = window.PenumbraCalc.active().some(function (d) { return d.name === 'GONE'; });
      var asked = null;
      window.confirm = function (m) { asked = String(m); return true; };
      document.getElementById('spClearStorage').click();
      // (2026-10-13) this page has no ?id=: the column is the page's alone, yet Clear must list it (not
      // "Nothing is saved", which returned before clearing anything) and clear it
      R.chk.listed = !!asked && /Calculated columns: [^\n]*\bGONE\b/.test(asked);
      R.chk.cleared = !window.PenumbraCalc.active().some(function (d) { return d.name === 'GONE'; });
      R.info = { act: window.PenumbraCalc.active(), asked: asked };
    },
    // a view link's state.calcColumns: shown; in the view state; never in a Save
    cstate: async function () {
      var f = F();
      R.chk.stateShown = shown('TRIPLE') && cell('TRIPLE') === String(num(f.H_NUM) * 3);
      var st = window.__HC.bso();
      R.chk.viewStateCarries = !!st && Array.isArray(st.calcColumns) && st.calcColumns.some(function (d) { return d.name === 'TRIPLE' && d.formula === '{H_NUM} * 3'; })
        && st.visibleColumns.indexOf(20) !== -1;
      // calcsrv (2026-10-11): a stored report's column is the REPORT's and a save keeps it -
      // unless it is unticked in the Save dialog's Last Stop list, as here: then it is stripped
      if (!document.getElementById('lastStopCardBody')) { var lsb = document.createElement('div'); lsb.id = 'lastStopCardBody'; document.body.appendChild(lsb); }
      if (window.PenumbraCalc.renderSaveList) window.PenumbraCalc.renderSaveList();
      var tcb = document.querySelector('#pnbCalcSaveRow input[data-calc-save="TRIPLE"]'); if (tcb) tcb.checked = false;
      window.__SAVE_ANSWER = function (b) { return { ok: true, json: { success: true, new_id: b.short_id, numeric_id: 7, is_new: false, updated_at: '2026-10-10 10:00:00.000000' } }; };
      var n = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n; }, 8000); await sleep(150);
      var s = window.__saves[window.__saves.length - 1], sd = null;
      try { sd = JSON.parse(s.state_data); } catch (e) {}
      R.chk.saveStrips = !!sd && !('calcColumns' in sd) && sd.visibleColumns.indexOf(20) === -1 && sd.columnOrder.indexOf(20) === -1 && sd.visibleColumns.indexOf(0) !== -1;
      R.info = { vis: sd && sd.visibleColumns, order: sd && sd.columnOrder && sd.columnOrder.slice(-3), act: window.PenumbraCalc && window.PenumbraCalc.active(),
        pre: penumbra_vars.preloadedState && penumbra_vars.preloadedState.calcColumns, applied: window.PenumbraCalc && window.PenumbraCalc.applied() };
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
