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
      // (round 6) the Kind pick stays clear of the Default box, for a number and for a date
      function overlap() { var k = document.getElementById('pnbCalcAdjKind').getBoundingClientRect(), v = document.getElementById('pnbCalcAdjVal').getBoundingClientRect(); return k.right > v.left + 1 && Math.abs(k.top - v.top) < 10; }
      var ovNum = overlap();
      var ksel = document.getElementById('pnbCalcAdjKind'); ksel.value = 'date'; ksel.dispatchEvent(new Event('change', { bubbles: true }));
      var ovDate = overlap(), vType = document.getElementById('pnbCalcAdjVal').type;
      ksel.value = 'number'; ksel.dispatchEvent(new Event('change', { bubbles: true }));
      R.chk.kindNoOverlap = !ovNum && !ovDate && vType === 'date' && document.getElementById('pnbCalcAdjVal').type === 'text';
      R.info.kind = { ovNum: ovNum, ovDate: ovDate, vType: vType };
      document.getElementById('pnbCalcAdjWrap').open = false;
      // (round 7) the error line sits in the footer between the buttons, in view whatever the content's scroll
      var errEl = document.getElementById('pnbCalcErr'), footer = errEl && errEl.closest('.modal-prompt-buttons'), content = document.querySelector('#pnbCalcOverlay .modal-prompt-content');
      if (content) content.scrollTop = 0;
      var box = document.querySelector('#pnbCalcOverlay .modal-prompt-box').getBoundingClientRect(), er = errEl.getBoundingClientRect();
      var lnk = document.getElementById('pnbCalcLink').getBoundingClientRect(), goB = document.getElementById('pnbCalcGo').getBoundingClientRect();
      R.chk.errInFooter = !!footer && !errEl.closest('.modal-prompt-content') && er.top >= box.top && er.bottom <= box.bottom && er.left >= lnk.right - 1 && er.right <= goB.left + 1;
      R.info.err = { inFooter: !!footer, er: { t: er.top, b: er.bottom, l: er.left, r: er.right }, box: { t: box.top, b: box.bottom } };
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
      // (2026-11-25, cgroups) adding, editing or removing a column replays the last answer (window.Penumbra.replayNextRun,
      // as a knob's move does): the table is drawn again, no query goes out
      await until(function () { return !!th('RATIO'); }, 15000); await sleep(400);
      var f = F();
      var want = Math.round(num(f.H_NUM) / num(f.H_AMT) * 100 * (1 + 1e-12)) / 100;
      R.chk.replayed = window.__queryDone === q0 && !!th('RATIO');
      // (2026-10-22) the name keeps the case it was typed in: the heading reads Ratio (its data-colname, the
      // key every heading has, stays RATIO)
      var hadRatio = !!th('RATIO'), headRatio = hadRatio ? th('RATIO').textContent.replace(/[\u25b2\u25bc]/g, '').trim() : null;
      R.info.headRatio = headRatio;
      R.chk.added = shown('RATIO') && Number(cell('RATIO')) === want && headRatio === 'Ratio';
      function listed(n) { return Array.prototype.some.call(document.querySelectorAll('#spColumnList .sp-col-item'), function (el) { return el.textContent.indexOf(n) !== -1; }); }
      await until(function () { return listed('RATIO'); }, 4000);
      R.chk.listAfterAdd = listed('RATIO') && listed('V_ID');
      R.chk.panelLabel = Array.prototype.some.call(document.querySelectorAll('#pnbCalcList .pnb-calc-n'), function (e) { return e.textContent === 'Ratio'; });
      // edit it (no RATIO to edit = the add failed: the checks below stay unset, so red)
      var editBtn = document.querySelector('#pnbCalcList [data-calc-edit="RATIO"]');
      if (!editBtn) { R.info = { ta: R.info.ta, err: (document.getElementById('pnbCalcErr') || {}).textContent }; return; }
      editBtn.focus();   // a keyboard user's Enter (moderate 2026-10-15: editFocus / removeFocus)
      editBtn.click();
      R.chk.editShowsLabel = (document.getElementById('pnbCalcName') || {}).value === 'Ratio';
      document.getElementById('pnbCalcFormula').value = '{H_NUM} * 0';
      var q1 = window.__queryDone;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return cell('RATIO') === '0'; }, 15000); await sleep(400);
      R.chk.edited = cell('RATIO') === '0' && window.__queryDone === q1;
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
      await until(function () { return !th('RATIO'); }, 15000); await sleep(400);
      R.chk.removed = hadRatio && !th('RATIO') && window.__queryDone === q2;
      await until(function () { return !listed('RATIO'); }, 4000);
      R.chk.listAfterRemove = !listed('RATIO') && listed('V_ID');
      R.info = { head: R.info.headRatio, ratio: cell('RATIO'), want: want, q: [q0, q1, q2, window.__queryDone], act: window.PenumbraCalc.active(), applied: window.PenumbraCalc.applied() };
    },
    // (2026-10-18, calcadj) an adjustable value through the dialog: its knob in the panel's row
    // and under the header menu's Adjust...; a change re-runs the query; the view state carries
    // the moved value; the reset button puts the default back
    cadj: async function () {
      var colsBefore = document.getElementById('sbCols').textContent;   // (round 5) the query's columns, before any calculated one
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
      // (2026-11-25) Remove is last, after Adjust, since menufix2 P4 (2026-11-19): the old order read red on live
      R.chk.menuEditItem = acts.indexOf('calc-left') === 0 && acts.indexOf('calcEdit') > acts.indexOf('calc-end') && acts.indexOf('calcDup') > acts.indexOf('calcEdit')
        && acts.indexOf('calcAdj') > acts.indexOf('calcDup') && acts.indexOf('calcRemove') > acts.indexOf('calcAdj');
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
      // (round 5) Duplicate... opens the dialog on a NEW column seeded with the formula and format, its value row empty
      var t3 = th('FA'), r3 = t3.getBoundingClientRect();
      t3.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r3.left + 6), clientY: Math.round(r3.top + 6) }));
      await sleep(300);
      var ce3 = document.querySelector('#pnbHeadMenu [data-act="calc"]'); if (ce3) ce3.click();
      await sleep(300);
      var id3 = document.querySelector('.pnb-hm-sub [data-act="calcDup"]'); if (id3) id3.click();
      await sleep(300);
      R.chk.menuDupOpens = !!document.getElementById('pnbCalcOverlay') && document.getElementById('pnbCalcName').value === '' && document.getElementById('pnbCalcFormula').value === '{H_AMT} * {@RATE}'
        && document.getElementById('pnbCalcFmt').value === 'number' && document.getElementById('pnbCalcAdjName').value === '' && /Add a calculated column/.test(document.getElementById('pnbCalcTitle').textContent);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      // (round 5) the status bar counts the query's columns; the calculated ones are a chip of their own
      var chip = document.getElementById('sbCalcChip');
      R.chk.chipCalc = document.getElementById('sbCols').textContent === colsBefore && !!chip && chip.textContent === '+1 calculated' && /FA \(yours\)/.test(chip.getAttribute('title') || '') && chip.style.display !== 'none';
      R.info.chip = { cols: document.getElementById('sbCols').textContent, before: colsBefore, chip: chip && chip.textContent, title: chip && chip.getAttribute('title') };
      // (round 6) the chip opens a popover: FA's row with Edit / Duplicate / Remove and its knob; Duplicate
      // seeds the dialog; Escape closes the popover and returns to the chip
      if (chip) chip.click();
      await sleep(300);
      var pop = document.getElementById('pnbCalcPop');
      var popOk = !!pop && !!pop.querySelector('[data-calc-edit="FA"]') && !!pop.querySelector('[data-calc-dup="FA"]') && !!pop.querySelector('[data-calc-del="FA"]') && !!pop.querySelector('[data-calc-input="RATE"]')
        && pop.getBoundingClientRect().bottom <= window.innerHeight && pop.getBoundingClientRect().top >= 0;
      var pd = pop && pop.querySelector('[data-calc-dup="FA"]'); if (pd) pd.click();
      await sleep(300);
      var popDup = !document.getElementById('pnbCalcPop') && !!document.getElementById('pnbCalcOverlay') && document.getElementById('pnbCalcFormula').value === '{H_AMT} * {@RATE}' && document.getElementById('pnbCalcName').value === '';
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      if (chip) chip.click();
      await sleep(200);
      var popAgain = !!document.getElementById('pnbCalcPop');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      R.chk.chipPop = popOk && popDup && popAgain && !document.getElementById('pnbCalcPop') && document.activeElement === chip;
      R.info.pop = { popOk: popOk, popDup: popDup, popAgain: popAgain, ae: document.activeElement && document.activeElement.id };
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
      // --- round 8 (closing sweep) -------------------------------------------------------------
      // one Escape, one surface: the Adjust panel open, the chip's popover opened over it - Escape
      // closes the popover alone, the next the panel
      var r8 = {};
      var t5 = th('FA'), r5 = t5.getBoundingClientRect();
      t5.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r5.left + 6), clientY: Math.round(r5.top + 6) }));
      await sleep(300);
      var ce5 = document.querySelector('#pnbHeadMenu [data-act="calc"]'); if (ce5) ce5.click();
      await sleep(300);
      var ia5 = document.querySelector('.pnb-hm-sub [data-act="calcAdj"]'); if (ia5) ia5.click();
      await sleep(300);
      r8.panelUp = !!document.querySelector('#pnbHeadPanel [data-calc-input="RATE"]');
      if (chip) chip.click();
      await sleep(200);
      r8.bothUp = r8.panelUp && !!document.getElementById('pnbCalcPop') && !!document.getElementById('pnbHeadPanel');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      r8.popGonePanelStays = !document.getElementById('pnbCalcPop') && !!document.getElementById('pnbHeadPanel');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      R.chk.escOneSurface = r8.bothUp && r8.popGonePanelStays && !document.getElementById('pnbHeadPanel');
      // a saved definition named like a real column (skipped this run) lends the real column no Adjust / Edit
      window.PenumbraCalc.fromState([{ name: 'H_AMT', formula: '{H_NUM}', input: { name: 'ZZQ', value: 1 } }], 'state');
      var t6 = th('H_AMT'), r6 = t6.getBoundingClientRect();
      t6.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r6.left + 6), clientY: Math.round(r6.top + 6) }));
      await sleep(300);
      var ce6 = document.querySelector('#pnbHeadMenu [data-act="calc"]'); if (ce6) ce6.click();
      await sleep(300);
      r8.realActs = Array.prototype.map.call(document.querySelectorAll('.pnb-hm-sub .pnb-hm-item'), function (e) { return e.getAttribute('data-act'); });
      R.chk.realColNoAdjust = r8.realActs.indexOf('calc-left') === 0 && r8.realActs.indexOf('calcAdj') < 0 && r8.realActs.indexOf('calcEdit') < 0;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      var qR = window.__queryDone;
      window.PenumbraCalc.remove('H_AMT');
      await until(function () { return window.__queryDone > qR; }, 15000); await sleep(500);
      // a replay armed for a run that stops short (no query) goes with it: the next Run asks the database
      var cmEl = document.querySelector('.CodeMirror'), cm = cmEl && cmEl.CodeMirror, ta = document.getElementById('sqlQuery');
      var qText = cm ? cm.getValue() : ta.value, qA = window.__queryDone;
      window.Penumbra.replayNextRun();
      if (cm) cm.setValue(''); else ta.value = '';
      $('#executeQuery').click();
      await sleep(500);
      if (cm) cm.setValue(qText); else ta.value = qText;
      $('#executeQuery').click();
      await until(function () { return window.__queryDone > qA; }, 15000); await sleep(500);
      R.chk.armDropped = window.__queryDone === qA + 1 && shown('FA');
      r8.arm = { qA: qA, now: window.__queryDone, cm: !!cm };
      R.info = { fa: cell('FA'), want: [want(0.5), want(0.25), want(1)], q: [q0, q1, q2, q3, window.__queryDone], inputs: window.PenumbraCalc.inputs(),
        menu: it ? it.textContent : null, state: st && st.calcColumns, err: document.getElementById('pnbCalcErr') ? document.getElementById('pnbCalcErr').textContent : null };
      R.info.r8 = r8;
    },
    // Clear All Custom Preferences takes the calculated columns too (calccol3)
    // (2026-11-25, cgroups) CUSTOM GROUPS: the editor as the grouping dialog and the header menu open it (values with
    // their rows, ticked into groups, the rest named), the column it makes (hidden, worked out, no query, sorting in its
    // groups' order), the grouping dialog's entries, an edit, the view state, a locked reader, the header menu, a remove
    cgrp: async function () {
      var C = window.PenumbraCalc, done = [], cancelled = 0, q0 = window.__queryDone;
      function vt() { return Array.prototype.map.call(document.querySelectorAll('#pnbGrpVals .pnb-grp-vt'), function (e) { return e.textContent; }); }
      function tick(v) {
        var i = vt().indexOf(v), b = document.querySelectorAll('#pnbGrpVals input[data-grp-v]')[i];
        if (!b) return false;
        b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); return true;
      }
      function typeIn(el, v) { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      C.openGroups({ col: 'H_GROUP', hide: true, onDone: function (n) { done.push(n); }, onCancel: function () { cancelled++; } });
      await sleep(250);
      var part = document.getElementById('pnbGrpPart');
      R.chk.dlgOpens = !!part && !part.hidden && (document.getElementById('pnbCalcTitle') || {}).textContent === 'Add custom groups' &&
        document.getElementById('pnbCalcFxPart').hidden === true;
      R.chk.defaultName = (document.getElementById('pnbCalcName') || {}).value === 'H_GROUP_GROUPS';
      var labels = vt(), counts = Array.prototype.map.call(document.querySelectorAll('#pnbGrpVals .pnb-grp-vn'), function (e) { return Number(e.textContent.replace(/,/g, '')); });
      R.chk.valuesListed = labels.length === 6 && labels[0] === '[Blank]' && counts.reduce(function (a, b) { return a + b; }, 0) === 300;
      R.info.labels = labels; R.info.counts = counts;
      R.chk.noEarlyError = (document.getElementById('pnbCalcErr') || {}).textContent === '';
      tick('North'); tick('South');
      R.chk.addCount = /2 ticked/.test((document.getElementById('pnbGrpAdd') || {}).textContent || '');
      document.getElementById('pnbGrpAdd').click();
      await sleep(150);
      var nm = document.querySelector('#pnbCalcOverlay [data-grp-name="0"]');
      R.chk.newGroupFocus = !!nm && document.activeElement === nm && nm.value === 'Group 1';
      typeIn(nm, 'NS');
      tick('East');
      document.getElementById('pnbGrpTo').value = 'new';
      document.getElementById('pnbGrpAdd').click();
      await sleep(150);
      R.chk.singleNamed = ((document.querySelector('#pnbCalcOverlay [data-grp-name="1"]') || {}).value) === 'East';
      typeIn(document.getElementById('pnbGrpOther'), 'Rest');
      await sleep(450);
      var want = { NS: 0, East: 0, Rest: 0, blank: 0 };
      window.__rowsFixture.forEach(function (r) { var g = r.H_GROUP; if (g === 'North' || g === 'South') want.NS++; else if (g === 'East') want.East++; else if (g) want.Rest++; else want.blank++; });
      var prev = ((document.getElementById('pnbGrpPrev') || {}).textContent || '').replace(/,/g, '');
      R.chk.preview = prev.indexOf('NS ' + want.NS) !== -1 && prev.indexOf('East ' + want.East) !== -1 && prev.indexOf('Rest ' + want.Rest) !== -1 && prev.indexOf('[Blank] ' + want.blank) !== -1;
      R.chk.marked = Array.prototype.some.call(document.querySelectorAll('#pnbGrpVals .pnb-grp-v-in .pnb-grp-vin'), function (e) { return e.textContent === 'NS'; });
      R.info.prev = prev; R.info.want = want;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return !!th('H_GROUP_GROUPS') && done.length > 0; }, 15000); await sleep(400);
      R.chk.saved = done[0] === 'H_GROUP_GROUPS' && !document.getElementById('pnbCalcOverlay');
      R.chk.hidden = !!th('H_GROUP_GROUPS') && !shown('H_GROUP_GROUPS');
      R.chk.noQuery = window.__queryDone === q0;
      var exp = function (g) { return (g === 'North' || g === 'South') ? 'NS' : (g === 'East' ? 'East' : (g ? 'Rest' : '')); };
      var vals = window.Penumbra.columnRawValues('H_GROUP_GROUPS');
      R.chk.values = vals.length === 300 && window.__rowsFixture.every(function (r, i) { return vals[i] === exp(r.H_GROUP); });
      var go = C.groupOrder('H_GROUP_GROUPS');
      R.chk.order = !!go && go.values.join('|') === 'NS|East|Rest';
      R.chk.panelRow = /Groups of \{H_GROUP\}: NS, East, Rest/.test(((document.querySelector('#pnbCalcList') || {}).textContent) || '');
      // the view state carries the groups (no formula), hidden
      var st = window.__HC.bso(), cc = ((st && st.calcColumns) || []).filter(function (d) { return d.name === 'H_GROUP_GROUPS'; })[0];
      R.chk.stateCarries = !!cc && !!cc.groups && cc.hide === true && cc.groups.sets.length === 2 && cc.groups.other === 'Rest' && !('formula' in cc);
      // grouped by it: the groups in the order they were made
      window.Penumbra.groupByColumn('H_GROUP_GROUPS');
      await until(function () { return document.querySelectorAll('#groupedResultsContainer .group-header .group-name').length >= 3; }, 15000); await sleep(700);
      var heads = Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-header .group-name'), function (e) { return e.textContent.trim(); });
      var real = heads.filter(function (h) { return h === 'NS' || h === 'East' || h === 'Rest'; });
      R.chk.groupedOrder = real.join('|') === 'NS|East|Rest';
      R.info.heads = heads;
      // the grouping dialog: on the custom groups column, Edit these...; on H_GROUP, its custom groups and New...
      $('#groupTableBtn').trigger('click');
      await sleep(500);
      // (the harness's Group button leaves the dialog closed: shown here, as a person has it while picking)
      if (!$('#groupingLightbox').is(':visible')) $('#groupingLightbox').css('display', 'flex');
      var opt = function () { var s1 = document.getElementById('groupingBucket1'); return s1 ? Array.prototype.map.call(s1.options, function (o) { return o.value; }) : []; };
      R.chk.dlgEditEntry = opt().indexOf('=cg:edit') !== -1;
      var it = document.querySelector('#groupingColumnSelector .pcs-item[data-value="H_GROUP"]');
      if (it) it.click();
      await sleep(400);
      R.chk.dlgEntries = opt().indexOf('=cg:use:H_GROUP_GROUPS') !== -1 && opt().indexOf('=cg:new') !== -1;
      R.info.opts = opt();
      var s1 = document.getElementById('groupingBucket1');
      s1.value = '=cg:new'; $(s1).trigger('change');
      await sleep(300);
      R.chk.dlgNewOpens = !!document.getElementById('pnbGrpPart') && (document.getElementById('pnbGrpCol') || {}).value === 'H_GROUP';
      document.querySelector('#pnbCalcOverlay .pnb-calc-cancel').click();
      await sleep(200);
      R.chk.dlgNewCancel = !document.getElementById('pnbCalcOverlay') && document.getElementById('groupingBucket1').value === '';
      s1 = document.getElementById('groupingBucket1');
      s1.value = '=cg:use:H_GROUP_GROUPS'; $(s1).trigger('change');
      await sleep(400);
      R.chk.dlgUse = ((document.querySelector('#groupingColumnSelector .pcs-selected') || { getAttribute: function () { return ''; } }).getAttribute('data-value')) === 'H_GROUP_GROUPS';
      // New custom groups... saved from the dialog: the level holds the new column once the table shows it, the dialog
      // still open, the other levels kept; no query
      var itv = document.querySelector('#groupingColumnSelector .pcs-item[data-value="V_STATUS"]');
      if (itv) itv.click();
      await sleep(400);
      var it2 = document.querySelector('#groupingColumnSelector2 .pcs-item[data-value="H_GROUP"]');
      if (it2) it2.click();
      await sleep(400);
      $('#groupSortSelect').val('count|desc');
      var qd = window.__queryDone;
      s1 = document.getElementById('groupingBucket1');
      s1.value = '=cg:new'; $(s1).trigger('change');
      await sleep(300);
      R.chk.dlgNewCol = (document.getElementById('pnbGrpCol') || {}).value === 'V_STATUS' && (document.getElementById('pnbCalcName') || {}).value === 'V_STATUS_GROUPS';
      tick('Open');
      document.getElementById('pnbGrpAdd').click();
      await sleep(150);
      document.getElementById('pnbCalcGo').click();
      await until(function () { var sel = document.querySelector('#groupingColumnSelector .pcs-selected'); return !!sel && sel.getAttribute('data-value') === 'V_STATUS_GROUPS'; }, 15000);
      await sleep(300);
      R.chk.dlgNewSaves = ((document.querySelector('#groupingColumnSelector .pcs-selected') || { getAttribute: function () { return ''; } }).getAttribute('data-value')) === 'V_STATUS_GROUPS' &&
        $('#groupingLightbox').is(':visible') && !shown('V_STATUS_GROUPS') && !!th('V_STATUS_GROUPS') && window.__queryDone === qd;
      // ...the form as the person left it: the second level and the sort
      R.chk.dlgNewKeepsForm = ((document.querySelector('#groupingColumnSelector2 .pcs-selected') || { getAttribute: function () { return ''; } }).getAttribute('data-value')) === 'H_GROUP' &&
        $('#groupSortSelect').val() === 'count|desc';
      R.chk.dlgNewEditEntry = (function () { var s2 = document.getElementById('groupingBucket1'); return !!s2 && Array.prototype.some.call(s2.options, function (o) { return o.value === '=cg:edit'; }); })();
      C.remove('V_STATUS_GROUPS');
      await until(function () { return !th('V_STATUS_GROUPS'); }, 15000); await sleep(300);
      $('#groupingLightbox').hide();
      // an edit: East renamed E; the cells follow, no query
      var q1 = window.__queryDone, done2 = [];
      C.openGroups({ name: 'H_GROUP_GROUPS', onDone: function (n) { done2.push(n); } });
      await sleep(250);
      R.chk.editOpens = (document.getElementById('pnbCalcTitle') || {}).textContent === 'Edit custom groups' && !document.querySelector('input[name="pnbCalcKind"]') &&
        ((document.querySelector('#pnbCalcOverlay [data-grp-name="1"]') || {}).value) === 'East';
      typeIn(document.querySelector('#pnbCalcOverlay [data-grp-name="1"]'), 'E');
      await sleep(200);
      document.getElementById('pnbCalcGo').click();
      await until(function () { return done2.length > 0; }, 15000); await sleep(400);
      vals = window.Penumbra.columnRawValues('H_GROUP_GROUPS');
      R.chk.edited = window.__queryDone === q1 && window.__rowsFixture.every(function (r, i) { var w = exp(r.H_GROUP); return vals[i] === (w === 'East' ? 'E' : w); });
      // a locked reader (Column Organization closed): their custom groups run, hidden; a formula column is refused; the
      // editor opens for custom groups only, with no kind and no "show it"
      penumbra_vars.isAdmin = false; C.setLock(true);
      R.chk.lockKeepsGroups = C.active().some(function (d) { return d.name === 'H_GROUP_GROUPS' && d.hide === true && !!d.groups; });
      C.openDialog(null); await sleep(150);
      R.chk.lockRefusesFormula = !document.getElementById('pnbCalcOverlay');
      C.openGroups({ col: 'V_STATUS', onCancel: function () { cancelled++; } }); await sleep(250);
      R.chk.lockOpensGroups = !!document.getElementById('pnbGrpPart') && !document.querySelector('input[name="pnbCalcKind"]') && !document.getElementById('pnbGrpShow');
      var ov = document.getElementById('pnbCalcOverlay'), c0 = cancelled;
      if (ov) ov.querySelector('.pnb-calc-cancel').click();
      await sleep(150);
      R.chk.cancelCalled = cancelled === c0 + 1 && !document.getElementById('pnbCalcOverlay');
      C.setLock(false); penumbra_vars.isAdmin = true;
      // the header menu: Custom groups (a list: these, then New custom groups...) on H_GROUP
      var its = (window.Penumbra.colMenu && typeof window.Penumbra.colMenu.items === 'function') ? window.Penumbra.colMenu.items(th('H_GROUP')) : [];
      var acts = its.map(function (x) { return x && x.act; }).filter(Boolean);
      R.chk.menuItem = acts.some(function (a) { return /^groupCustom/.test(a); });
      R.info.acts = acts.filter(function (a) { return /group/i.test(a); });
      // removed while the table is grouped by it: gone, no query, and the table flat again - group mode with it
      // (cgroups sweep S1: body.group-mode-active stayed on over the flat table)
      var q2 = window.__queryDone;
      if (!document.body.classList.contains('group-mode-active')) { window.Penumbra.groupByColumn('H_GROUP_GROUPS'); await sleep(1200); }
      var wasGrouped = document.body.classList.contains('group-mode-active');
      C.remove('H_GROUP_GROUPS');
      await until(function () { return !th('H_GROUP_GROUPS'); }, 15000); await sleep(800);
      R.chk.removed = !th('H_GROUP_GROUPS') && window.__queryDone === q2 && !C.groupOrder('H_GROUP_GROUPS');
      R.chk.removeLeavesGroupMode = wasGrouped && !document.body.classList.contains('group-mode-active') && $('#resultsTable').is(':visible') &&
        !$('#groupedResultsContainer').is(':visible') && window.Penumbra.headerMenu.groupingColumn() === '';
    },
    // (2026-11-25, cgroups sweep) the editor's sweep: Esc in Find, Add ticked to by key and its focus, Esc / a click outside
    // ask first, the column's dropdown keeps the focus, values gone after a switch (named, taken out), Other merged and its
    // case, a pattern the server reads differently, "show it" in an edit, a rename keeps the grouping, a column not in
    // this run, a multi-line value, the lock and the report's own, the Group by dialog's arrow keys, a split level, a
    // split name
    // (p2 sweep) the formula dialog's sweep - the report carries FIRSTW, FIRSTW_UP (reads it) and PCT (Percent); the page has
    // penumbra_a11y.js, whose own first focus moved the dialog's
    txsweep: async function () {
      var C = window.PenumbraCalc;
      function ov() { return document.getElementById('pnbCalcOverlay'); }
      function err() { return ((document.getElementById('pnbCalcErr') || {}).textContent) || ''; }
      function fx() { return document.getElementById('pnbCalcFormula'); }
      function fmt() { return (document.getElementById('pnbCalcFmt') || {}).value; }
      function typeIn(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      function key(el, k) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      function cancel() { var o = ov(); if (o) o.querySelector('.pnb-calc-cancel').click(); }
      function caret(el, at) { el.focus(); el.setSelectionRange(at, at); el.dispatchEvent(new Event('select', { bubbles: true })); }
      // a new column: the focus stays in Name; Format follows the formula until the reader picks one
      C.openDialog(null, {});
      await sleep(400);
      R.chk.focusName = document.activeElement === document.getElementById('pnbCalcName');
      typeIn(fx(), 'RIGHT({V_ID}, 3)'); await sleep(300);
      var f1 = fmt();
      typeIn(fx(), '{H_NUM} * 2'); await sleep(300);
      var f2 = fmt();
      var sel = document.getElementById('pnbCalcFmt'); sel.value = 'currency'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
      typeIn(fx(), 'LEFT({V_ID}, 2)'); await sleep(300);
      R.chk.fmtFollows = f1 === 'text' && f2 === 'number' && fmt() === 'currency';
      R.info.fmt = [f1, f2, fmt()];
      // a half-typed formula's complaint waits for a pause
      typeIn(fx(), 'IFS('); await sleep(400);
      var e1 = err();
      await sleep(1100);
      R.chk.errWaits = e1 === '' && err() !== '';
      R.info.errWaits = [e1, err()];
      // a click outside, then Esc: asked first; a second Esc closes
      ov().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      ov().dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
      await sleep(150);
      R.chk.backdropAsks = !!ov() && /not added: Cancel closes/.test(err());
      if (!ov()) { C.openDialog(null, {}); await sleep(300); typeIn(fx(), 'IFS('); await sleep(200); }   // (a broken guard closed it: carry on)
      key(fx(), 'Escape'); await sleep(150);
      var asked = !!ov() && /Esc again/.test(err());
      key(fx(), 'Escape'); await sleep(150);
      R.chk.escAsksTwice = asked && !ov();
      // an untouched dialog still closes on the first click outside
      C.openDialog(null, {}); await sleep(300);
      ov().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      ov().dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
      await sleep(150);
      R.chk.cleanCloses = !ov();
      // the column chips: Tab reaches them, Enter puts one in; clicked inside "quotes" it joins the column in
      C.openDialog(null, {}); await sleep(300);
      var chip = Array.prototype.filter.call(document.querySelectorAll('#pnbCalcCols code'), function (c) { return c.textContent === '{V_ID}'; })[0];
      R.chk.chipFocusable = !!chip && chip.getAttribute('tabindex') === '0' && chip.getAttribute('role') === 'button';
      typeIn(fx(), 'LEN()'); caret(fx(), 4);
      if (chip) { chip.focus(); key(chip, 'Enter'); }
      await sleep(200);
      R.chk.chipEnter = fx().value === 'LEN({V_ID})';
      typeIn(fx(), 'CONTAINS({V_NAME}, "")'); caret(fx(), 20);
      if (chip) chip.click();
      await sleep(200);
      R.chk.chipInQuotes = fx().value === 'CONTAINS({V_NAME}, "" & {V_ID} & "")';
      R.info.chips = [fx().value];
      // the preview reads a calculated column as the table does: its value for math; an @@HTML cell's text
      typeIn(fx(), '{PCT} * 100'); await sleep(400);
      var pc = document.querySelector('#pnbCalcPrev tbody tr td.pnb-calc-res');
      var want = String(Number((num(F().H_NUM) / 10).toFixed(6)));
      R.chk.previewRaw = !!pc && pc.textContent === want;
      typeIn(fx(), '{V_LINK} & " (x)"'); await sleep(400);
      var lc = document.querySelector('#pnbCalcPrev tbody tr td.pnb-calc-res');
      R.chk.previewHtmlText = !!lc && !/@@HTML|<a/.test(lc.textContent) && / \(x\)$/.test(lc.textContent);
      R.info.preview = [pc && pc.textContent, want, lc && lc.textContent];
      cancel(); await sleep(150);
      // an edit: the formula has the focus, the caret at its end; renamed, the report's column reading it follows
      C.openDialog('FIRSTW'); await sleep(400);
      R.chk.editCaretEnd = document.activeElement === fx() && fx().selectionStart === fx().value.length && fx().value.length > 0;
      typeIn(document.getElementById('pnbCalcName'), 'FIRSTW2');
      var q0 = window.__queryDone;
      document.getElementById('pnbCalcGo').click();
      await until(function () { return window.__queryDone > q0; }, 8000); await sleep(900);
      var act = C.active(), up = act.filter(function (d) { return d.name === 'FIRSTW_UP'; })[0];
      R.chk.renameCarries = !!up && up.formula === 'UPPER({FIRSTW2})' && !(C.problems ? C.problems() : []).some(function (p) { return p.name === 'FIRSTW_UP'; });
      R.info.renamed = act.map(function (d) { return d.name + '=' + (d.formula || '') + '/' + d.src; });
    },
    cgsweep: async function () {
      var C = window.PenumbraCalc, q0 = window.__queryDone;
      function vt() { return Array.prototype.map.call(document.querySelectorAll('#pnbGrpVals .pnb-grp-vt'), function (e) { return e.textContent; }); }
      function tick(v) {
        var i = vt().indexOf(v), b = document.querySelectorAll('#pnbGrpVals input[data-grp-v]')[i];
        if (!b) return false;
        b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); return true;
      }
      function typeIn(el, v) { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      function key(el, k) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      function err() { return ((document.getElementById('pnbCalcErr') || {}).textContent) || ''; }
      function ov() { return document.getElementById('pnbCalcOverlay'); }
      function cancel() { var o = ov(); if (o) o.querySelector('.pnb-calc-cancel').click(); }
      function nameBox(i) { return document.querySelector('#pnbCalcOverlay [data-grp-name="' + i + '"]'); }
      function setSel(el, v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }
      var done = [];
      C.openGroups({ col: 'H_GROUP', hide: true, onDone: function (n) { done.push(n); } });
      await sleep(300);
      var fd = document.getElementById('pnbGrpFind');
      R.chk.findAutofocus = !!fd && fd.hasAttribute('autofocus');
      // Esc in Find clears Find; the editor stays
      typeIn(fd, 'No'); await sleep(250);
      key(fd, 'Escape'); await sleep(150);
      R.chk.escFindClears = !!ov() && fd.value === '' && vt().length === 6;
      if (!ov()) { C.openGroups({ col: 'H_GROUP', hide: true, onDone: function (n) { done.push(n); } }); await sleep(300); }   // (a broken Esc closed it)
      tick('North'); tick('South');
      document.getElementById('pnbGrpAdd').click(); await sleep(150);
      typeIn(nameBox(0), 'NS');
      tick('East');
      document.getElementById('pnbGrpTo').value = 'new';
      document.getElementById('pnbGrpAdd').click(); await sleep(150);
      // Add ticked to East, then East moved up: the pick follows East (it kept the place, and named NS)
      var to = document.getElementById('pnbGrpTo');
      to.value = to.options[2].value;
      var eastKey = to.value;
      document.querySelector('#pnbCalcOverlay [data-grp-up="1"]').click(); await sleep(150);
      to = document.getElementById('pnbGrpTo');
      R.chk.addToFollows = to.value === eastKey && /East/.test(to.options[to.selectedIndex].textContent);
      // Add into a group already made: the focus goes to that group's name (Add itself is off)
      tick('West');
      document.getElementById('pnbGrpAdd').click(); await sleep(150);
      R.chk.addFocusTarget = document.activeElement === nameBox(0) && nameBox(0).value === 'East';
      // Esc with groups made asks first; a click outside keeps them too
      key(document.getElementById('pnbCalcName'), 'Escape'); await sleep(120);
      R.chk.escAsks = !!ov() && /Esc again/.test(err());
      ov().click(); await sleep(120);
      R.chk.backdropKeeps = !!ov() && /not saved/.test(err());
      // the column's dropdown keeps the focus through a switch; values the new column does not hold are named and marked
      var colSel = document.getElementById('pnbGrpCol');
      colSel.focus(); setSel(colSel, 'V_STATUS'); await sleep(300);
      R.chk.colKeepsFocus = document.getElementById('pnbGrpCol') === colSel && document.activeElement === colSel;
      var stale = document.getElementById('pnbGrpStale');
      R.chk.staleNamed = !!stale && !stale.hidden && /4 picked values are not in V_STATUS/.test(stale.textContent) && document.querySelectorAll('#pnbGrpSets .pnb-grp-chip-gone').length === 4;
      R.info.stale = stale ? stale.textContent : null;
      setSel(colSel, 'H_GROUP'); await sleep(300);
      R.chk.staleGoneBack = document.getElementById('pnbGrpStale').hidden === true && document.querySelectorAll('#pnbGrpSets .pnb-grp-chip-gone').length === 0;
      // a group named as the rest's group (Other) is that group: one count, said so ("Other 273 · Other 0" before)
      document.getElementById('pnbGrpTo').value = 'new';
      tick('Central');
      document.getElementById('pnbGrpAdd').click(); await sleep(150);
      typeIn(nameBox(2), 'Other'); await sleep(450);
      var pv = ((document.getElementById('pnbGrpPrev') || {}).textContent || '').replace(/,/g, '');
      R.chk.otherMerged = /Other \d+ \(with every value in no group\)/.test(pv) && !/Other 0/.test(pv);
      R.info.otherPrev = pv;
      // ...and not in another case
      typeIn(nameBox(2), 'OTHER'); await sleep(200);
      document.getElementById('pnbCalcGo').click(); await sleep(200);
      R.chk.otherCaseRefused = !!ov() && /differ only in case/.test(err());
      typeIn(nameBox(2), 'Middle'); await sleep(200);
      typeIn(document.getElementById('pnbCalcName'), 'SWEEP_G');
      document.getElementById('pnbCalcGo').click();
      await until(function () { return !!th('SWEEP_G') && done.length > 0; }, 15000); await sleep(400);
      R.chk.saved = done[0] === 'SWEEP_G' && !shown('SWEEP_G');
      // "Show it as a column" ticked in an edit shows it (read after the save, the change never registered)
      var d2 = [];
      C.openGroups({ name: 'SWEEP_G', onDone: function (n) { d2.push(n); } }); await sleep(300);
      var shw = document.getElementById('pnbGrpShow'); shw.checked = true; shw.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('pnbCalcGo').click();
      await until(function () { return d2.length > 0; }, 15000); await sleep(500);
      R.chk.showFlips = shown('SWEEP_G');
      // renamed while the table is grouped by it: still grouped, by the new name (it dropped the grouping)
      window.Penumbra.groupByColumn('SWEEP_G');
      await until(function () { return document.body.classList.contains('group-mode-active') && document.querySelectorAll('#groupedResultsContainer .group-header').length >= 2; }, 15000); await sleep(700);
      var d3 = [];
      C.openGroups({ name: 'SWEEP_G', onDone: function (n) { d3.push(n); } }); await sleep(300);
      typeIn(document.getElementById('pnbCalcName'), 'TEAMS');
      document.getElementById('pnbCalcGo').click();
      await until(function () { return d3.length > 0; }, 15000); await sleep(1200);
      var ut = document.getElementById('undo_text');
      R.chk.renameKeepsGrouping = d3[0] === 'TEAMS' && document.body.classList.contains('group-mode-active') && window.Penumbra.headerMenu.groupingColumn() === 'TEAMS' &&
        !(ut && /Previous grouping dropped/.test(ut.textContent));
      R.info.rename = { gc: window.Penumbra.headerMenu.groupingColumn(), ut: ut ? ut.textContent : null };
      // custom groups of a column this run does not have: the editor keeps it, marked; a save keeps it
      C.fromState([{ name: 'GONE_G', groups: { col: 'NOPE_COL', sets: [{ name: 'A', values: ['x'] }], rest: 'other' } }], 'state');
      C.openGroups({ name: 'GONE_G' }); await sleep(300);
      var cs = document.getElementById('pnbGrpCol');
      R.chk.goneColKept = !!cs && cs.value === 'NOPE_COL' && /not in this run/.test(cs.options[cs.selectedIndex].textContent) &&
        /not in this run/.test(((document.getElementById('pnbGrpVals') || {}).textContent) || '');
      typeIn(nameBox(0), 'A2'); await sleep(150);
      document.getElementById('pnbCalcGo').click(); await sleep(700);
      var gd = C.active().filter(function (d) { return d.name === 'GONE_G'; })[0];
      R.chk.goneColSaves = !ov() && !!gd && gd.groups.col === 'NOPE_COL' && gd.groups.sets[0].name === 'A2';
      C.remove('GONE_G'); await sleep(700);
      // a multi-line cell's value goes into its group (it went in as nothing), named on one line
      var d5 = [];
      C.openGroups({ col: 'H_NL', hide: true, onDone: function (n) { d5.push(n); } }); await sleep(350);
      var v0 = vt()[0];
      tick(v0); document.getElementById('pnbGrpAdd').click(); await sleep(150);
      typeIn(document.getElementById('pnbCalcName'), 'NL_G');
      document.getElementById('pnbCalcGo').click();
      await until(function () { return d5.length > 0; }, 15000); await sleep(400);
      var nlv = window.Penumbra.columnRawValues('NL_G'), want5 = window.__rowsFixture.filter(function (r) { return r.H_NL === v0; }).length;
      R.chk.multiLineValue = want5 > 0 && /\n/.test(v0) && nlv.filter(function (x) { return x === v0.replace(/\s+/g, ' '); }).length === want5;
      R.info.nl = { v0: v0, want: want5, got: nlv.slice(0, 5) };
      // Column Organization closed: the report's own custom groups are not the reader's to change; their own are
      C.fromState([{ name: 'REP_G', groups: { col: 'H_GROUP', sets: [{ name: 'N', values: ['North'] }], rest: 'other' } }], 'report');
      penumbra_vars.isAdmin = false; C.setLock(true);
      R.chk.lockReportNoEdit = C.canEdit('REP_G') === false && C.canEdit('NL_G') === true;
      C.openDialog('REP_G'); await sleep(200);
      R.chk.lockReportNoDialog = !ov();
      if (ov()) cancel();
      C.setLock(false); penumbra_vars.isAdmin = true;
      C.fromState([], 'report');
      // the Group by dialog: an arrow key onto New custom groups... waits for Enter (it opened the editor)
      $('#groupTableBtn').trigger('click'); await sleep(500);
      if (!$('#groupingLightbox').is(':visible')) $('#groupingLightbox').css('display', 'flex');
      var itg = document.querySelector('#groupingColumnSelector .pcs-item[data-value="H_GROUP"]');
      if (itg) itg.click();
      await sleep(400);
      var b1 = document.getElementById('groupingBucket1');
      b1.focus(); key(b1, 'ArrowDown');
      b1.value = '=cg:new'; $(b1).trigger('change'); await sleep(300);
      R.chk.arrowArms = !ov() && b1.getAttribute('data-cg-armed') === '1';
      key(b1, 'Enter'); await sleep(400);
      R.chk.enterOpens = !!ov() && (document.getElementById('pnbGrpCol') || {}).value === 'H_GROUP';
      cancel(); await sleep(250);
      // a level split at a delimiter: New custom groups... starts split the same way
      var sel1 = document.querySelector('#groupingColumnSelector .pcs-selected');
      sel1.setAttribute('data-value', 'V_NAME:dcomma'); $('#groupingColumnSelector').trigger('pcs-change', ['V_NAME:dcomma']); await sleep(700);
      b1 = document.getElementById('groupingBucket1');
      b1.value = '=cg:new'; $(b1).trigger('change'); await sleep(400);
      R.chk.splitLevelCarried = !!ov() && (document.getElementById('pnbGrpSplit') || {}).value === 'dcomma' && (document.getElementById('pnbGrpCol') || {}).value === 'V_NAME';
      R.info.splitOpts = Array.prototype.map.call(b1.options, function (o) { return o.value; });
      cancel(); await sleep(250);
      $('#groupingLightbox').hide();
      // a pattern the server reads differently: refused, and why (a dialog of its own: a broken check saves it)
      C.openGroups({ col: 'V_STATUS', hide: true }); await sleep(300);
      tick('Open'); document.getElementById('pnbGrpAdd').click(); await sleep(150);
      setSel(document.querySelector('#pnbCalcOverlay [data-grp-op="0"]'), 'matches'); await sleep(120);
      typeIn(document.querySelector('#pnbCalcOverlay [data-grp-rv="0"]'), '\\p{L}'); await sleep(250);
      document.getElementById('pnbCalcGo').click(); await sleep(300);
      var rxBox = document.querySelector('#pnbCalcOverlay [data-grp-rv="0"]');
      R.chk.rxRefused = !!ov() && /read differently on the server/.test(err()) && !!rxBox && rxBox.getAttribute('aria-invalid') === 'true';
      R.info.rxErr = err();
      if (ov()) cancel(); else { await sleep(1500); C.remove('V_STATUS_GROUPS'); }
      await sleep(400);
      // values of the old column: taken out in one click; a split column's group named with < is refused
      C.openGroups({ col: 'H_GROUP', hide: true }); await sleep(300);
      tick('North'); document.getElementById('pnbGrpAdd').click(); await sleep(150);
      setSel(document.getElementById('pnbGrpCol'), 'H_GROUP2'); await sleep(300);
      var dropBtn = document.getElementById('pnbGrpDropStale');
      if (dropBtn) dropBtn.click();
      await sleep(200);
      R.chk.staleTakenOut = !!dropBtn && document.querySelectorAll('#pnbGrpSets .pnb-grp-chip').length === 0 && document.getElementById('pnbGrpStale').hidden === true;
      // (the group the values left is empty now: out, or its own error comes first)
      var del0 = document.querySelector('#pnbCalcOverlay [data-grp-del="0"]');
      if (del0) del0.click();
      await sleep(150);
      setSel(document.getElementById('pnbGrpSplit'), 'dsemi'); await sleep(250);
      tick('Tier 1'); document.getElementById('pnbGrpTo').value = 'new'; document.getElementById('pnbGrpAdd').click(); await sleep(150);
      var nb = document.querySelectorAll('#pnbCalcOverlay [data-grp-name]');
      typeIn(nb[nb.length - 1], 'a<b'); await sleep(150);
      document.getElementById('pnbCalcGo').click(); await sleep(200);
      R.chk.splitNameRefused = !!ov() && /may not hold ; < or >/.test(err());
      R.info.splitErr = err();
      cancel(); await sleep(250);
      // (2026-11-26, bdclick) a press inside the dialog released over the backdrop is no click outside: the dialog stays
      // (the user: "when clicking outside the UI it closes -- which can happen on accident when rapid selecting the group
      // name"); a click wholly on the backdrop still closes it (nothing changed)
      function fire(el, type) { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, detail: 1, view: window })); }
      C.openDialog(null); await sleep(250);
      var ovx = ov(), nmx = document.getElementById('pnbCalcName');
      if (ovx && nmx) { fire(nmx, 'mousedown'); fire(ovx, 'mouseup'); fire(ovx, 'click'); }
      await sleep(150);
      R.chk.dragOutKeeps = !!ovx && !!nmx && !!ov();
      if (ov()) { fire(ov(), 'mousedown'); fire(ov(), 'mouseup'); fire(ov(), 'click'); }
      await sleep(150);
      R.chk.backdropCloses = !ov();
      if (ov()) cancel();
      await sleep(150);
      // (2026-11-26, gsumac) the group summary as a filter offers ITS values - the bands' own counts - where it offered
      // nothing and the search box listed a column's values (none of which a count can equal)
      window.Penumbra.groupByColumn('H_GROUP');
      await until(function () { return document.body.classList.contains('group-mode-active'); }, 15000); await sleep(600);
      $('#groupTableBtn').trigger('click'); await sleep(500);
      if (!$('#groupingLightbox').is(':visible')) $('#groupingLightbox').css('display', 'flex');
      $('#groupAggCheckbox').prop('checked', true).trigger('change');
      var agSel = document.querySelector('#groupAggColumn .pcs-selected');
      if (agSel) agSel.setAttribute('data-value', 'V_STATUS');
      // (the harness's stub dialog lists sum and avg only: the page's own select has Count (distinct))
      if (!$('#groupAggType option[value="count_distinct"]').length) $('#groupAggType').append('<option value="count_distinct">Count (distinct)</option>');
      $('#groupAggType').val('count_distinct');
      $('#confirmGroupingBtn').trigger('click');
      await until(function () { return !!document.querySelector('#groupedResultsContainer .group-wrapper[data-agg-value]'); }, 15000); await sleep(600);
      var gsl = (window._penumbraSearchAPI.getGroupSummaryColumns() || [])[0] || '';
      var gsv = gsl ? window._penumbraSearchAPI.getColumnAutocompleteValues(gsl) : null;
      var bandVals = Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-wrapper[data-agg-value]'), function (w) { return String(parseFloat(w.getAttribute('data-agg-value'))); });
      R.chk.gsumValues = gsl === 'Distinct of V_STATUS' && Array.isArray(gsv) && gsv.length > 0 && gsv.every(function (v) { return /^\d+$/.test(v) && bandVals.indexOf(v) !== -1; });
      if (!R.chk.gsumValues) R.info = { gsum: { label: gsl, vals: gsv, bands: bandVals.slice(0, 12), agg: $('#groupAggType').val(), aggCol: agSel ? agSel.getAttribute('data-value') : null, grouped: document.body.classList.contains('group-mode-active') } };
      $('#groupingLightbox').hide();
      C.remove('TEAMS'); await sleep(500);
      C.remove('NL_G'); await sleep(500);
      R.chk.noQuerySweep = window.__queryDone === q0;
    },
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
      // (2026-11-16, savechg C) ...and "What this save changes"' place for the lists, where the module puts them since Last Stop went
      if (!document.getElementById('pnbSaveChgLists')) { var scl = document.createElement('div'); scl.id = 'pnbSaveChgLists'; document.body.appendChild(scl); }
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
