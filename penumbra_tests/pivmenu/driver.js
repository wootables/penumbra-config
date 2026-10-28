// pivmenu suite - page half (2026-10-17): the pivot table's right-click menu (colmenu pivot
// v1) on the REAL main.js and js/penumbra_colmenu.js, over a saved pivot: H_GROUP > H_GROUP2
// down, V_STATUS across (Open / Closed / Pending), sum of H_AMT.
//   pmhead   a value heading: its items, sort / then sort / clear, copy the column, the
//            shading (a rebuild) and its Undo, exclude a column value (the search)
//   pmfield  a row field's heading: its items, collapse / expand all, move up a level (a
//            rebuild) and its Undo, remove the field, swap rows and columns
//   pmcell   a value cell (drill-down, filter to its row and column) and a row label
//            (its group's toggle, copy, exclude the label)
//   pmnotool the Pivot tool hidden: no change to the pivot itself is offered
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
    window.__toasts = [];
    window.show_text = function (html) {
      window.__toasts.push(String(html));
      var d = document.createElement('div'); d.className = 'zz-toast'; d.innerHTML = String(html); document.body.appendChild(d);
    };
  }
  function P() { return window.Penumbra && window.Penumbra.pivotMenu; }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  // (colmenu round 15) the lists beside an item are panels of their own
  function panelsAll() { return Array.prototype.slice.call(document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function item(act) { var ps = panelsAll(); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function subPanel() { var s = document.querySelectorAll('.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function subActs() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function has(list) { var a = acts(); return list.every(function (x) { return a.indexOf(x) >= 0; }); }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) });
    return !el.dispatchEvent(ev);
  }
  // (colmenu round 33) an item in a list beside its parent: open the parent first
  var PSUBS = [['bdWidth', /^bd(Fit|FitAll|FitPage|ResetWidth|ResetWidths)$/], ['pvLayout', /^(pvRows-|pvCols-|pvStartExpanded$)/], ['pvFreeze', /^pvFreeze-/]];
  // (2026-10-27, copymenu) a breakdown's copies are one list, Copy: This value, This row, Column name, Distinct values (its
  // delimiters and All values in row order in a list of its own) - reached through it, two levels deep
  PSUBS.push(['bdCopyMenu', /^(bdCopy|bdCopyRow|bdCopyName|bdCopyDistinct)$/], ['bdCopyDistinct', /^(bdCopy-[a-z]+|bdCopyCol)$/]);
  function reachP(act) {
    var it = item(act);
    if (it) return it;
    // (2026-10-27, copymenu) a list inside a list: its parent reached first
    for (var i = 0; i < PSUBS.length; i++) { if (PSUBS[i][1].test(act)) { var p = reachP(PSUBS[i][0]); if (p) { p.click(); return item(act); } } }
    return null;
  }
  async function choose(el, act) {
    closeMenu();
    rclick(el);
    var it = reachP(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; }
    it.click();
    await sleep(500);
    return true;
  }
  function txt(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .col-sort-icon, .sort-rank, .pivot-collapse-toggle, button'), function (n) { n.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function heads() { return Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable thead th')); }
  function head(t) { return heads().filter(function (h) { return !h.hasAttribute('data-row-field') && txt(h) === t; })[0] || null; }
  function field(i) { return document.querySelector('#pivotResultTable thead th[data-row-field="' + i + '"]'); }
  function searchVal() { return document.getElementById('tableSearch').value; }
  function lastToast() { return window.__toasts.length ? window.__toasts[window.__toasts.length - 1] : ''; }
  function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
  function visRows() { return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (tr) { return tr.style.display !== 'none'; }); }
  function rowsNow() { var s = P() && P().settings(); return s ? JSON.stringify(s.rows) + JSON.stringify(s.cols) : ''; }
  // a rebuild: Generate ends in hideLoading, and the new pivot has value cells
  async function rebuilt(h0) {
    await until(function () { return (window.__HC_HIDES || 0) > h0 && cells().length > 0; }, 30000);
    await sleep(500);
  }
  async function undo() {
    var b = document.querySelectorAll('.zz-toast .pnb-hm-undo'), ub = b[b.length - 1];
    if (!ub) return false;
    var h0 = window.__HC_HIDES || 0;
    ub.click();
    await rebuilt(h0);
    return true;
  }

  var S = {
    pmhead: async function () {
      var th = head('Open');
      R.chk.opens = !!th && rclick(th) && !!menu();
      // (colmenu round 25) the browser's own menu: Shift with the right-click is not intercepted;
      // a second right-click on the same heading while ours is open steps aside
      closeMenu();
      var rS = th.getBoundingClientRect();
      R.chk.nativeShift = !th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, shiftKey: true, clientX: Math.round(rS.left + 6), clientY: Math.round(rS.top + 6) })) === false && !menu();
      var o1 = rclick(th) && !!menu();
      th.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: Math.round(rS.left + 6), clientY: Math.round(rS.top + 6) }));
      R.chk.nativeSecond = o1 && !rclick(th) && !menu();
      R.info.native = { o1: o1 };
      rclick(th);   // the checks below read the open menu
      R.chk.headItems = has(['pvSortAsc', 'pvSortDesc', 'pvColOnly', 'pvColExclude', 'pvCopyCol', 'pvShade', 'pvEdit']) && acts().indexOf('sortAsc') < 0;
      R.info.acts = acts();
      closeMenu();
      await choose(head('Open'), 'pvSortDesc');
      R.chk.sortDesc = head('Open').getAttribute('aria-sort') === 'descending';
      rclick(head('Closed'));
      R.chk.thenOffered = has(['pvThenAsc', 'pvThenDesc']);
      closeMenu();
      await choose(head('Closed'), 'pvThenAsc');
      R.chk.thenSort = head('Open').getAttribute('aria-sort') === 'descending' && head('Closed').getAttribute('aria-sort') === 'ascending';
      await choose(head('Open'), 'pvSortClear');
      R.chk.sortClear = head('Open').getAttribute('aria-sort') !== 'descending' && head('Open').getAttribute('aria-sort') !== 'ascending'
        && head('Closed').getAttribute('aria-sort') === 'ascending';
      R.info.sort = heads().map(function (h) { return txt(h) + ':' + h.getAttribute('aria-sort'); });
      // Copy column values: the shown cells under the heading, one a line
      var n0 = window.__clip.length;
      await choose(head('Closed'), 'pvCopyCol');
      await sleep(300);
      var lines = window.__clip.length > n0 ? String(lastClip()).split('\n') : [];
      R.chk.copyCol = lines.length > 5 && lines.every(function (l) { return /^[\$\-\d,.()\s]*$/.test(l); }) && lines.some(function (l) { return /\d/.test(l); });
      R.info.copy = { n: lines.length, first: lines.slice(0, 4) };
      // Shading...: a sub-list, the pick rebuilds the pivot, Undo puts it back
      closeMenu();
      rclick(head('Closed'));
      var sh = item('pvShade');
      if (sh) { sh.click(); await sleep(200); }
      // (colmenu round 15) a list beside the item, no Back; Format beside it
      R.chk.shadeList = !!subPanel() && ['pvShade-none', 'pvShade-scale', 'pvShade-bar'].every(function (x) { return subActs().indexOf(x) >= 0; }) && !item('back') && !!item('pvFormat');
      var h0 = window.__HC_HIDES || 0, bar = item('pvShade-bar');
      if (bar) { bar.click(); await rebuilt(h0); }
      var s1 = P() ? P().settings() : {};
      R.chk.shadeBar = !!bar && !!s1.aggShade && s1.aggShade[0] === 'bar' && document.querySelectorAll('#pivotResultTable tbody td[style*="linear-gradient"]').length > 0
        && /Undo/.test(lastToast());
      R.chk.shadeUndo = !!P() && (await undo()) && !(P().settings().aggShade && P().settings().aggShade[0]);
      R.info.shade = { after: s1.aggShade, undone: P() && P().settings().aggShade };
      // (colmenu round 19) resting on Shading opens its list, as in the column menu
      closeMenu();
      rclick(head('Closed'));
      var shI = item('pvShade');
      if (shI) shI.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
      await sleep(350);
      R.chk.shadeHover = !!shI && !!subPanel() && subActs().indexOf('pvShade-bar') >= 0 && shI.getAttribute('aria-expanded') === 'true';
      closeMenu();
      // (colmenu round 15) Format: the list beside the item (the type, then the decimals);
      // a pick rebuilds the pivot with Undo; Automatic takes the format away
      closeMenu();
      rclick(head('Closed'));
      var fm = item('pvFormat');
      if (fm) { fm.click(); await sleep(200); }
      var fa = subActs();
      R.chk.fmtList = !!fm && !!fm.querySelector('.pnb-hm-arrow') && ['pvFmt-auto', 'pvFmt-number', 'pvFmt-currency', 'pvFmt-percent', 'pvDp-auto', 'pvDp-0', 'pvDp-2', 'pvDp-4'].every(function (x) { return fa.indexOf(x) >= 0; })
        && item('pvFmt-auto').getAttribute('aria-checked') === 'true' && item('pvDp-auto').getAttribute('aria-checked') === 'true' && !item('back');
      function cellTexts() { return Array.prototype.map.call(cells(), function (c) { return c.textContent.trim(); }).filter(function (t) { return /\d/.test(t); }); }
      var t0 = cellTexts();
      h0 = window.__HC_HIDES || 0;
      if (item('pvFmt-currency')) { item('pvFmt-currency').click(); await rebuilt(h0); }
      var s2 = P() ? P().settings() : {}, t1 = cellTexts();
      R.chk.fmtCurrency = !!s2.aggFormat && s2.aggFormat[0] === 'currency' && t1.length > 0 && t1.every(function (t) { return /^\(?-?\$/.test(t); }) && t0.every(function (t) { return t.indexOf('$') < 0; }) && /Undo/.test(lastToast());
      rclick(head('Closed')); if (item('pvFormat')) { item('pvFormat').click(); await sleep(200); }
      var numChecked = !!item('pvFmt-currency') && item('pvFmt-currency').getAttribute('aria-checked') === 'true';
      h0 = window.__HC_HIDES || 0;
      if (item('pvDp-0')) { item('pvDp-0').click(); await rebuilt(h0); }
      var s3 = P() ? P().settings() : {}, t2 = cellTexts();
      R.chk.fmtDp = numChecked && !!s3.aggFormat && s3.aggFormat[0] === 'currency:0' && t2.length > 0 && t2.every(function (t) { return t.indexOf('.') < 0; });
      R.chk.fmtUndo = (await undo()) && !!P().settings().aggFormat && P().settings().aggFormat[0] === 'currency';
      rclick(head('Closed')); if (item('pvFormat')) { item('pvFormat').click(); await sleep(200); }
      h0 = window.__HC_HIDES || 0;
      if (item('pvFmt-auto')) { item('pvFmt-auto').click(); await rebuilt(h0); }
      var s4 = P() ? P().settings() : {};
      R.chk.fmtAuto = R.chk.fmtUndo && !(s4.aggFormat && s4.aggFormat[0]) && cellTexts().join() === t0.join();
      R.info.fmt = { before: t0.slice(0, 3), currency: t1.slice(0, 3), dp0: t2.slice(0, 3), s2: s2.aggFormat, s3: s3.aggFormat };
      // (colmenu round 18) the columns' order, from a top-row column heading: the pivot's own
      // toggle, so the headings change places and its arrow says the direction
      closeMenu();
      rclick(head('Closed'));
      var asc0 = item('pvColsAsc'), desc0 = item('pvColsDesc');
      R.chk.colsItems = !!asc0 && !!desc0 && asc0.getAttribute('aria-checked') === 'true' && desc0.getAttribute('aria-checked') === 'false';
      function colOrder() { return heads().filter(function (h) { return !h.hasAttribute('data-row-field'); }).map(txt).filter(function (t) { return /^(Closed|Open|Pending)$/.test(t); }).join(); }
      closeMenu();
      var o0 = colOrder();
      await choose(head('Closed'), 'pvColsDesc');
      await sleep(700);
      var o1 = colOrder(), icon = document.querySelector('#pivotResultTable .col-sort-icon');
      R.chk.colsDesc = o0 === 'Closed,Open,Pending' && o1 === 'Pending,Open,Closed' && !!icon && icon.getAttribute('data-col-sort') === 'desc';
      rclick(head('Open'));
      var descChecked = !!item('pvColsDesc') && item('pvColsDesc').getAttribute('aria-checked') === 'true';
      closeMenu();
      await choose(head('Open'), 'pvColsAsc');
      await sleep(700);
      R.chk.colsAsc = descChecked && colOrder() === 'Closed,Open,Pending';
      R.info.cols = { o0: o0, o1: o1, back: colOrder() };
      // Exclude "Open": a search condition on V_STATUS, the pivot rebuilt without the column
      await choose(head('Open'), 'pvColExclude');
      await until(function () { return !head('Open') && cells().length > 0; }, 20000);
      R.chk.colExclude = !head('Open') && !!head('Closed') && /V_STATUS/i.test(searchVal());
      R.info.search = searchVal();
    },
    pmfield: async function () {
      rclick(field(1));
      R.chk.fieldItems = has(['pvSortAsc', 'pvSortDesc', 'pvCollapseAll', 'pvExpandAll', 'pvFieldUp', 'pvFieldDown', 'pvFieldRemove', 'pvSwap', 'pvEdit'])
        && item('pvFieldDown').getAttribute('aria-disabled') === 'true' && item('pvFieldUp').getAttribute('aria-disabled') !== 'true';
      R.chk.sortAZ = !!item('pvSortAsc') && /A to Z/.test(item('pvSortAsc').textContent);
      R.info.acts = acts();
      closeMenu();
      // (colmenu round 33) Layout and Freeze row labels: the builder's own choices, each pick a rebuild with Undo
      rclick(field(0));
      var lfActs = acts(), hasLF = lfActs.indexOf('pvLayout') >= 0 && lfActs.indexOf('pvFreeze') >= 0 && lfActs.indexOf('pvLayout') < lfActs.indexOf('pvEdit');
      if (item('pvLayout')) { item('pvLayout').click(); await sleep(200); }
      var lay = subActs();
      closeMenu(); rclick(field(0));
      if (item('pvFreeze')) { item('pvFreeze').click(); await sleep(200); }
      var frz = subActs();
      closeMenu();
      var s0 = P().settings(), sticky0 = typeof s0.stickyColCount === 'number' ? s0.stickyColCount : 3;
      R.chk.layoutItems = hasLF && ['pvRows-nested', 'pvRows-nested-static', 'pvRows-flat', 'pvStartExpanded'].every(function (x) { return lay.indexOf(x) >= 0; }) && lay.indexOf('pvCols-flat') < 0
        && ['pvFreeze-0', 'pvFreeze-1', 'pvFreeze-2'].every(function (x) { return frz.indexOf(x) >= 0; }) && frz.indexOf('pvFreeze-3') < 0;
      R.info.layout = { top: lfActs, lay: lay, frz: frz, rows: s0.rows, rl: s0.rowLayout, sticky: s0.stickyColCount };
      var hL = window.__HC_HIDES || 0;
      var ranFlat = await choose(field(0), 'pvRows-flat');
      if (ranFlat) await rebuilt(hL);
      R.chk.layoutFlat = ranFlat && P().settings().rowLayout === 'flat' && /Undo/.test(lastToast());
      R.chk.layoutUndo = ranFlat && (await undo()) && P().settings().rowLayout !== 'flat';
      hL = window.__HC_HIDES || 0;
      var ranFrz = await choose(field(0), 'pvFreeze-1');
      if (ranFrz) await rebuilt(hL);
      R.chk.freezeOne = ranFrz && P().settings().stickyColCount === 1 && /Undo/.test(lastToast());
      R.chk.freezeUndo = ranFrz && (await undo()) && P().settings().stickyColCount === sticky0;
      await choose(field(0), 'pvCollapseAll');
      var v = visRows();
      R.chk.collapseAll = v.length > 0 && v.every(function (tr) { return tr.classList.contains('pivot-group-summary-row'); });
      await choose(field(0), 'pvExpandAll');
      R.chk.expandAll = R.chk.collapseAll && visRows().some(function (tr) { return !tr.classList.contains('pivot-group-summary-row'); });
      // Move up a level: H_GROUP2 first, then Undo
      var h0 = window.__HC_HIDES || 0;
      await choose(field(1), 'pvFieldUp');
      await rebuilt(h0);
      R.chk.fieldUp = rowsNow() === '["H_GROUP2","H_GROUP"]["V_STATUS"]' && /H_GROUP2/.test(txt(field(0))) && /Undo/.test(lastToast());
      R.info.up = { rows: rowsNow(), f0: field(0) && txt(field(0)) };
      R.chk.fieldUndo = (await undo()) && rowsNow() === '["H_GROUP","H_GROUP2"]["V_STATUS"]' && /H_GROUP/.test(txt(field(0))) && !/H_GROUP2/.test(txt(field(0)));
      // Remove from the pivot
      h0 = window.__HC_HIDES || 0;
      await choose(field(1), 'pvFieldRemove');
      await rebuilt(h0);
      R.chk.fieldRemove = rowsNow() === '["H_GROUP"]["V_STATUS"]' && !field(1);
      // the last row field cannot go
      rclick(field(0));
      R.chk.removeLastOff = !!item('pvFieldRemove') && item('pvFieldRemove').getAttribute('aria-disabled') === 'true';
      closeMenu();
      // Swap rows and columns
      h0 = window.__HC_HIDES || 0;
      await choose(field(0), 'pvSwap');
      await rebuilt(h0);
      R.chk.swap = rowsNow() === '["V_STATUS"]["H_GROUP"]';
      R.info.swap = rowsNow();
    },
    pmbreak: async function () {
      // (2026-10-17, colmenu round 14) the breakdown behind a pivot cell: the sort and copy
      // part of the column menu on its headings and cells; '#' keeps the browser's menu
      function leaf() {
        return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
          return td.parentNode.style.display !== 'none' && td.getAttribute('data-row-key').indexOf('|||') > 0 && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
        })[0] || null;
      }
      await choose(leaf(), 'pvDrill');
      await sleep(600);
      var bt = document.querySelector('table.pnb-breakdown');
      R.chk.bdTable = !!bt && !!bt.tBodies[0] && bt.tBodies[0].rows.length > 1;
      if (!bt) return;
      var ths = Array.prototype.slice.call(bt.tHead.rows[0].cells);
      var th = ths.filter(function (h) { return h.cellIndex > 0 && h.getAttribute('data-sort-type') === 'number'; })[0] || ths[1];
      var th2 = ths.filter(function (h) { return h.cellIndex > 0 && h !== th; })[0];
      var i = th.cellIndex, i2 = th2.cellIndex;
      function colVals(k) { return Array.prototype.map.call(bt.tBodies[0].rows, function (r) { return r.cells[k] ? r.cells[k].textContent.trim() : ''; }); }
      function num(v) { var t = String(v).replace(/[$,\s]/g, ''); return /^[-+]?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; }
      function cmp(a, b) { var x = num(a), y = num(b); if (x !== null && y !== null) return x - y; return String(a).localeCompare(String(b)); }
      function ordered(arr, dir) { return arr.length > 1 && arr.every(function (v, k) { return k === 0 || (dir === 'asc' ? cmp(arr[k - 1], v) <= 0 : cmp(arr[k - 1], v) >= 0); }); }
      R.chk.bdNumNative = !rclick(ths[0]) && !menu();
      var rB = th.getBoundingClientRect();
      R.chk.bdNativeShift = !th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, shiftKey: true, clientX: Math.round(rB.left + 6), clientY: Math.round(rB.top + 6) })) === false && !menu();
      R.chk.bdHeadOpens = rclick(th) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === txt(th) && !menu().querySelector('.pnb-hm-stats');   // (round 28) the counts moved into Column stats
      // (2026-10-27, copymenu) the copies in one list, Copy: on a heading, Column name and Distinct values
      R.chk.bdHeadItems = has(['bdSortAsc', 'bdSortDesc', 'bdStats', 'bdCopyMenu']) && !item('bdCopyCol') && !item('bdCopy') && !item('bdThenAsc') && !item('bdSortClear')
        && !item('bdCopyName') && !item('bdCopyDistinct') && (function () { item('bdCopyMenu').click(); return subActs().join() === 'bdCopyName,bdCopyDistinct'; })();
      R.info.bdActs = acts();
      closeMenu();
      await choose(th, 'bdSortAsc');
      var asc = colVals(i);
      R.chk.bdSortAsc = th.getAttribute('aria-sort') === 'ascending' && ordered(asc, 'asc');
      await choose(th, 'bdSortDesc');
      var desc = colVals(i);
      R.chk.bdSortDesc = th.getAttribute('aria-sort') === 'descending' && ordered(desc, 'desc');
      rclick(th);
      var checked = item('bdSortDesc') && item('bdSortDesc').getAttribute('aria-checked') === 'true' && !!item('bdSortClear');
      closeMenu();
      // Then sort on another heading: both headings sorted
      rclick(th2);
      var thenOffered = !!item('bdThenAsc') && !!item('bdThenDesc');
      closeMenu();
      await choose(th2, 'bdThenAsc');
      R.chk.bdThen = checked && thenOffered && th.classList.contains('sorted') && th2.classList.contains('sorted') && th2.getAttribute('aria-sort') === 'ascending';
      await choose(th, 'bdSortClear');
      R.chk.bdClear = !th.classList.contains('sorted') && th2.classList.contains('sorted');
      R.info.bdSort = { asc: asc.slice(0, 6), desc: desc.slice(0, 6), i: i, i2: i2 };
      // copies: the column's values, its distinct values, a cell's value, the name
      // (a column with a repeated value: the rows behind one cell share its row field)
      var dup = ths.filter(function (h) { var v = colVals(h.cellIndex); return h.cellIndex > 0 && v.some(function (x, k) { return x !== '' && v.indexOf(x) < k; }); })[0];
      var ic = dup ? dup.cellIndex : i2, thc = dup || th2;
      var vals = colVals(ic), seen = {}, distinct = vals.filter(function (v) { if (v === '' || seen[v]) return false; seen[v] = 1; return true; });
      // (round 28) Copy distinct values is a list: delimited as picked; All values in row order is its last entry
      closeMenu(); rclick(thc); if (reachP('bdCopyDistinct')) { item('bdCopyDistinct').click(); await sleep(200); }
      var copyActs = subActs();
      if (item('bdCopyCol')) item('bdCopyCol').click();
      await sleep(300);
      R.chk.bdNoSql = copyActs.length > 0 && copyActs.indexOf('bdCopy-sql') < 0;   // (2026-10-27, copymenu 2) no For SQL: the user took it out
      R.chk.bdCopyCol = copyActs.indexOf('bdCopy-newline') >= 0 && copyActs.indexOf('bdCopy-comma') >= 0 && copyActs[copyActs.length - 1] === 'bdCopyCol'
        && lastClip() === vals.join('\n') && /Copied \d+ values?\./.test(lastToast());
      closeMenu(); rclick(thc); if (reachP('bdCopyDistinct')) { item('bdCopyDistinct').click(); await sleep(200); }
      if (item('bdCopy-newline')) item('bdCopy-newline').click();
      await sleep(300);
      var clipNl = lastClip();
      // the delimiter on th2 (two distinct values: a 2-row breakdown's duplicate column has one)
      var vals2 = colVals(i2), seen2 = {}, distinct2 = vals2.filter(function (v) { if (v === '' || seen2[v]) return false; seen2[v] = 1; return true; });
      closeMenu(); rclick(th2); if (reachP('bdCopyDistinct')) { item('bdCopyDistinct').click(); await sleep(200); }
      if (item('bdCopy-comma')) item('bdCopy-comma').click();
      await sleep(300);
      R.chk.bdCopyDistinct = clipNl === distinct.join('\n') && distinct2.length >= 2 && lastClip() === distinct2.join(',') && !!dup && distinct.length < vals.length;
      R.info.bdDelim = { d2: distinct2, clip: String(lastClip()).slice(0, 60) };
      // Column stats, from the table's shown text: the counts, the duplicates, the most common (no filter)
      closeMenu(); rclick(thc); if (item('bdStats')) { item('bdStats').click(); await sleep(200); }
      var sp = subPanel(), inf = {}; if (sp) Array.prototype.forEach.call(sp.querySelectorAll('.pnb-hm-info'), function (d) { inf[d.querySelector('.pnb-hm-info-k').textContent] = d.querySelector('.pnb-hm-info-v').textContent; });
      var cnt = {}; vals.forEach(function (v) { if (v !== '') cnt[v] = (cnt[v] || 0) + 1; });
      var ex = 0, shareR = 0, shareV = 0; Object.keys(cnt).forEach(function (k) { if (cnt[k] > 1) { ex += cnt[k] - 1; shareR += cnt[k]; shareV++; } });
      var best = Object.keys(cnt).sort(function (a, b) { return (cnt[b] - cnt[a]) || a.localeCompare(b); })[0];
      var tops = sp ? Array.prototype.map.call(sp.querySelectorAll('.pnb-hm-info'), function (d) { return d.querySelector('.pnb-hm-info-k').textContent; }) : [];
      R.chk.bdStats = !!sp && inf['With a value'] === String(vals.filter(function (v) { return v !== ''; }).length) && inf['Unique'] === String(distinct.length)
        && inf['Duplicates'] === (ex ? ex.toLocaleString() + ' (' + shareR.toLocaleString() + ' rows share ' + shareV.toLocaleString() + (shareV === 1 ? ' value)' : ' values)') : 'none')
        && tops.indexOf(best) >= 0 && !sp.querySelector('[data-act^="stats-top-"]');
      R.info.bdStats = { inf: inf, ex: ex, best: best, tops: tops.slice(-5) };
      closeMenu();
      var td = bt.tBodies[0].rows[0].cells[i2];
      R.chk.bdCell = rclick(td) && !!menu() && acts()[0] === 'bdCopyMenu' && menu().querySelector('.pnb-hm-name').textContent === txt(th2) && td.classList.contains('pnb-hm-cell');
      closeMenu();
      await choose(td, 'bdCopy');
      R.chk.bdCopyValue = lastClip() === td.textContent.trim() && !td.classList.contains('pnb-hm-cell');
      await choose(th2, 'bdCopyName');
      R.chk.bdCopyName = lastClip() === txt(th2);
      // (2026-10-27, copymenu) a cell's Copy list: This value, This row, Column name, Distinct values; This row: each column but
      // '#', "Name: text"
      closeMenu(); rclick(td);
      var bl = [];
      if (reachP('bdCopyMenu')) { item('bdCopyMenu').click(); await sleep(150); bl = subActs(); }
      R.chk.bdCopyList = bl.join() === 'bdCopy,bdCopyName,bdCopyRow,bdCopyDistinct';   // (2026-10-27, fltmenu) the name before This entire row
      // (2026-10-27, copymenu 3) the list opens under a static heading, Copy (no act)
      R.chk.bdCopyHead = (function () { var p = subPanel(), f = p ? p.firstElementChild : null; R.info.bdCopyHead = f ? [f.className, f.textContent.trim(), f.getAttribute('data-act') || ''] : null;
        return !!f && /(^| )pnb-hm-head( |$)/.test(f.className) && f.getAttribute('role') === 'presentation' && f.textContent.trim() === 'Copy' && !f.getAttribute('data-act'); })();
      R.info.bdCopyList = bl;
      closeMenu();
      var trb = td.closest('tr'), wantR = [];
      Array.prototype.forEach.call(bt.tHead.rows[0].cells, function (h, k) { if (k === 0 || txt(h) === '#' || h.style.display === 'none') return; var c = trb.cells[k]; if (c && !c.hasAttribute('colspan')) wantR.push(txt(h) + ': ' + String(c.innerText || '').trim()); });
      await choose(td, 'bdCopyRow');
      R.info.bdRow = { got: lastClip(), want: wantR.join('\n') };
      R.chk.bdCopyRow = wantR.length >= 2 && lastClip() === wantR.join('\n') && /Copied the row \(/.test(lastToast());
      // from the keyboard (Shift+F10 on the focused heading): the menu drops from it
      th.focus();
      th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
      var m = menu(), r = th.getBoundingClientRect(), mr = m ? m.getBoundingClientRect() : null;
      R.chk.bdKbd = !!mr && Math.abs(mr.top - r.bottom) <= 2 && Math.abs(mr.left - r.left) <= 2 && document.activeElement === m.querySelector('.pnb-hm-item');
      closeMenu();
      R.info.bdCopies = { vals: vals.length, distinct: distinct.length, dupCol: dup ? txt(dup) : null, clip: String(lastClip()).slice(0, 60) };
      // (colmenu round 27) the width items, on the module's session widths for a breakdown:
      // Fit this column, Fit all, Reset (with Undo); none in a pivot's menu
      var CW = window.Penumbra && window.Penumbra.colWidths, bdt = th.closest('table');
      function bdW(h) { return Math.round(h.getBoundingClientRect().width); }
      // (colmenu round 33) the widths are one list beside the item: Fit width to contents, Fit all, Fit to page, the resets
      rclick(th);
      var topBd = acts();
      if (item('bdWidth')) { item('bdWidth').click(); await sleep(200); }
      var bwl = subActs();
      R.chk.bdWidthItems = !!CW && topBd.indexOf('bdWidth') >= 0 && topBd.indexOf('bdWidth') < topBd.indexOf('bdCopyMenu') && topBd.indexOf('bdFit') < 0
        && ['bdFit', 'bdFitAll', 'bdFitPage', 'bdResetWidth', 'bdResetWidths'].every(function (x) { return bwl.indexOf(x) >= 0; });
      R.info.bdWidthList = { top: topBd, list: bwl };
      closeMenu();
      var w0 = bdW(th);
      var ranFit = await choose(th, 'bdFit');
      var dw1 = CW ? CW.drillWidths() : {};
      R.chk.bdFit = ranFit && Object.keys(dw1).length === 1 && Math.abs(bdW(th) - dw1[Object.keys(dw1)[0]]) <= 2 && /fitted to its content/.test(lastToast());
      // (round 33) this column's width back (its natural width), with Undo
      var ranOne = await choose(th, 'bdResetWidth');
      R.chk.bdResetOne = ranOne && Object.keys(CW ? CW.drillWidths() : {}).length === 0 && /width reset/.test(lastToast());
      var ranAll = await choose(th, 'bdFitAll');
      var dw2 = CW ? CW.drillWidths() : {}, cells = bdt.tHead.rows[0].cells.length;
      R.chk.bdFitAll = ranAll && Object.keys(dw2).length >= Math.min(3, cells - 1) && /breakdown column widths fitted to content/.test(lastToast());
      // (round 33) Fit to page: every column a width that fills the breakdown with no sideways scroll
      // (when even the floors do not fit, its notice says the table still scrolls)
      var ranPage = await choose(th, 'bdFitPage');
      var dwP = CW ? CW.drillWidths() : {}, pbox = bdt.closest('.infobox-content') || bdt.parentNode;
      var sumP = Object.keys(dwP).reduce(function (a, k) { return a + dwP[k]; }, 0), changed = Object.keys(dwP).some(function (k) { return dwP[k] !== dw2[k]; });
      R.chk.bdFitPage = ranPage && changed && Object.keys(dwP).length >= Math.min(3, cells - 1) && /fitted to the page/.test(lastToast())
        && ((pbox.scrollWidth <= pbox.clientWidth + 1 && sumP <= pbox.clientWidth && sumP >= pbox.clientWidth * 0.7) || /still scrolls sideways/.test(lastToast()));
      R.info.bdFitPage = { n: Object.keys(dwP).length, changed: changed, sum: sumP, scroll: pbox.scrollWidth, client: pbox.clientWidth, toast: String(lastToast()).slice(0, 120) };
      var ranReset = await choose(th, 'bdResetWidths');
      var dw3 = CW ? CW.drillWidths() : {};
      R.chk.bdResetWidths = ranReset && Object.keys(dw3).length === 0 && /Breakdown column widths reset/.test(lastToast());
      R.info.bdWidths = { w0: w0, dw1: dw1, n2: Object.keys(dw2).length, n3: Object.keys(dw3).length, toast: String(lastToast()).slice(0, 60) };
      // (colmenu round 30) Consistent row height only where the breakdown holds nested tables
      rclick(th);
      R.chk.bdRowHeight = !!menu() && !!item('rowHeight');   // (round 32) on every breakdown
      R.info.bdRowHeight = { nested: !!bdt.querySelector('.nested-json-container'), item: !!item('rowHeight') };
      closeMenu();
      // a pivot heading's menu has none of them
      var pvh = document.querySelector('#pivotResultTable thead th[data-row-field]');
      if (pvh) { rclick(pvh); R.chk.bdWidthsNotPivot = !!menu() && !item('bdFit') && !item('bdFitAll') && !item('bdResetWidths') && !item('bdWidth'); closeMenu(); } else { R.chk.bdWidthsNotPivot = true; }
    },
    pmmulti: async function () {
      // (colmenu round 17) no column fields, several values, groups collapsed: every value
      // heading offers Shading and Format, Copy column values copies ITS column, and Format
      // writes its own slot. (The grid placed from rowspans drifted over the collapsed rows'
      // labels, so only the first heading saw one aggregate - hitratio, 2026-10-17.)
      var s = P().settings(), h0 = window.__HC_HIDES || 0;
      s.cols = []; s.agg = ['count', 'sum']; s.aggLabels = null; s.aggShade = null; s.aggFormat = null;
      P().rebuild(s);
      await rebuilt(h0);
      var trs = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable thead tr')), bottom = trs[trs.length - 1];
      var vh = Array.prototype.filter.call(bottom.cells, function (c) { return !c.hasAttribute('data-row-field'); });
      R.chk.multiBuilt = vh.length === 2 && P().settings().cols.length === 0 && trs.length >= 1;
      function offers(h) { rclick(h); var a = acts(); closeMenu(); return a.indexOf('pvShade') >= 0 && a.indexOf('pvFormat') >= 0 && a.indexOf('pvCopyCol') >= 0; }
      var ok = vh.map(offers);
      R.chk.multiItems = ok.length === 2 && ok.every(Boolean);
      // a group collapsed (rows display:none under rowspanned labels): the second heading still has both
      var tg = document.querySelector('#pivotResultTable .pivot-collapse-toggle');
      if (tg) { tg.click(); await sleep(400); }
      var hidden = Array.prototype.some.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (tr) { return tr.style.display === 'none'; });
      R.chk.multiCollapsed = hidden && offers(vh[1]) && offers(vh[0]);
      // Copy column values on the second heading: its own column, the shown rows
      var n0 = window.__clip.length;
      await choose(vh[1], 'pvCopyCol');
      var copied = window.__clip.length > n0 ? String(lastClip()).split('\n') : [];
      var want = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr'), function (tr) { return tr.style.display !== 'none'; })
        .map(function (tr) { return tr.cells[tr.cells.length - 1]; }).filter(function (td) { return td && !td.hasAttribute('data-row-field'); }).map(function (td) { return td.textContent.trim(); });
      R.chk.multiCopy = copied.length > 1 && copied.join('\n') === want.join('\n');
      // Format on the second value writes the second slot
      rclick(vh[1]);
      if (item('pvFormat')) { item('pvFormat').click(); await sleep(200); }
      h0 = window.__HC_HIDES || 0;
      if (item('pvFmt-currency')) { item('pvFmt-currency').click(); await rebuilt(h0); }
      var f = P().settings().aggFormat;
      R.chk.multiSlot = !!f && f[1] === 'currency' && !f[0];
      // (colmenu round 22) a count keeps its own format: its list says so and offers the decimals
      // alone (Number / Currency / Percent would change nothing); the sum's list offers the types
      closeMenu();
      // (the rebuild above replaced the table: the headings again)
      var trs2 = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable thead tr')), bottom2 = trs2[trs2.length - 1];
      var vh2 = Array.prototype.filter.call(bottom2.cells, function (c) { return !c.hasAttribute('data-row-field'); });
      rclick(vh2[0]); if (item('pvFormat')) { item('pvFormat').click(); await sleep(200); }
      var fa0 = subActs(), inf0 = subPanel() ? Array.prototype.map.call(subPanel().querySelectorAll('.pnb-hm-info'), function (d) { return d.textContent; }) : [];
      closeMenu();
      rclick(vh2[1]); if (item('pvFormat')) { item('pvFormat').click(); await sleep(200); }
      var fa1 = subActs();
      closeMenu();
      R.chk.multiFmtKind = fa0.indexOf('pvFmt-currency') < 0 && fa0.indexOf('pvFmt-number') < 0 && fa0.indexOf('pvDp-0') >= 0
        && inf0.some(function (t) { return /count keeps its own format/.test(t); }) && fa1.indexOf('pvFmt-currency') >= 0 && fa1.indexOf('pvDp-0') >= 0;
      R.info.multi = { offers: ok, hidden: hidden, copied: copied.slice(0, 3), want: want.slice(0, 3), fmt: f, kind: { count: fa0, info: inf0, sum: fa1.slice(0, 4) } };
    },
    pmcell: async function () {
      var drills = 0;
      $(document).on('click.pivotDrilldown', '#pivotResultTable td', function () { drills++; });
      function leaf() {
        return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
          return td.parentNode.style.display !== 'none' && td.getAttribute('data-row-key').indexOf('|||') > 0 && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
        })[0] || null;
      }
      var td = leaf();
      R.chk.cellOpens = !!td && rclick(td) && !!menu();
      R.chk.cellItems = has(['pvDrill', 'pvCopy', 'pvCellFilter']) && /row and column/.test((item('pvCellFilter') || {}).textContent || '');
      // (colmenu round 18) the drill item's name
      R.chk.drillLabel = !!item('pvDrill') && item('pvDrill').querySelector('.pnb-hm-label').textContent === 'Show the breakdown';
      R.info.cellActs = acts();
      // (colmenu round 29) a pivot key holds its values HTML-escaped: the title and the label's Filter to
      // read decoded (the filter keeps the raw key)
      closeMenu();
      var rawKey = td.getAttribute('data-row-key'), parts0 = rawKey.split('|||');
      parts0[0] = 'R&amp;D &#039;Lab&#039;';
      td.setAttribute('data-row-key', parts0.join('|||'));
      rclick(td);
      var ttl = menu() ? menu().querySelector('.pnb-hm-name').textContent : '';
      R.chk.cellTitleDecoded = ttl.indexOf("R&D 'Lab'") === 0 && ttl.indexOf('&amp;') < 0 && ttl.indexOf('&#039;') < 0;
      closeMenu();
      var lbl0 = td.parentNode.querySelector('td[data-row-field="0"]');
      if (lbl0) { rclick(lbl0); var fl = item('pvLabelOnly'); R.chk.labelDecoded = !!fl && fl.querySelector('.pnb-hm-label').textContent.indexOf("R&D 'Lab'") >= 0 && fl.getAttribute('title').indexOf('&amp;') < 0; closeMenu(); } else { R.chk.labelDecoded = true; }
      R.info.decoded = { ttl: ttl.slice(0, 60) };
      td.setAttribute('data-row-key', rawKey);
      closeMenu();
      await choose(td, 'pvDrill');
      R.chk.drill = drills === 1;
      $('.help-lightbox:visible, .infobox-overlay:visible').hide();
      // (2026-10-22) its value's Shading and Format, after its own items, as the value's heading offers them;
      // none on a Grand Total column's cell (its heading offers none); a pick from a cell's list sets its value's
      // shading, with Undo
      td = leaf();
      closeMenu(); rclick(td);
      var ca = acts();
      R.chk.cellTools = ca.indexOf('pvCellFilter') > 0 && ca.indexOf('pvShade') > ca.indexOf('pvCellFilter') && ca.indexOf('pvFormat') > ca.indexOf('pvShade');
      R.info.cellTools = ca;
      closeMenu();
      var gtCell = null;
      (function () {
        var tb = document.getElementById('pivotResultTable'), hr = tb.tHead.rows, last = hr[hr.length - 1];
        var vh = Array.prototype.filter.call(last.cells, function (c) { return !c.hasAttribute('data-row-field'); }), K = vh.length, g = -1;
        vh.forEach(function (h, i) { if (h.classList.contains('pivot-grand-total')) g = i; });
        if (g < 0) return;
        var tr = Array.prototype.filter.call(tb.tBodies[0].rows, function (r) { return r.style.display !== 'none' && !r.classList.contains('pivot-group-summary-row'); })[0];
        if (tr) gtCell = tr.cells[tr.cells.length - K + g];
      })();
      R.info.gtCell = gtCell ? [gtCell.textContent.trim(), gtCell.getAttribute('data-agg-idx'), gtCell.getAttribute('data-pv-ai')] : null;
      if (gtCell) rclick(gtCell);
      var ga = acts();
      R.chk.cellToolsNotTotal = !!gtCell && !!menu() && ga.indexOf('pvCopy') >= 0 && ga.indexOf('pvShade') < 0 && ga.indexOf('pvFormat') < 0;
      R.info.gtActs = ga;
      closeMenu();
      rclick(td);
      var csh = item('pvShade');
      if (csh) { csh.click(); await sleep(200); }
      var ch0 = window.__HC_HIDES || 0, cbar = item('pvShade-bar');
      if (cbar) { cbar.click(); await rebuilt(ch0); }
      var cs1 = P() ? P().settings() : {};
      R.chk.cellShade = !!cbar && !!cs1.aggShade && cs1.aggShade[0] === 'bar' && document.querySelectorAll('#pivotResultTable tbody td[style*="linear-gradient"]').length > 0 && /Undo/.test(lastToast());
      R.chk.cellShadeUndo = R.chk.cellShade === true && (await undo()) && !(P().settings().aggShade && P().settings().aggShade[0]);
      R.info.cellShade = { after: cs1.aggShade, undone: P() && P().settings().aggShade };
      closeMenu();
      // a row label: its group's toggle, copy, filter / exclude
      var lt = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody td[data-row-field="0"]'), function (x) {
        return x.parentNode.style.display !== 'none' && x.querySelector('.pivot-collapse-toggle');
      })[0];
      rclick(lt);
      R.chk.labelItems = has(['pvToggle', 'pvCopyLabel', 'pvLabelOnly', 'pvLabelExclude']);
      R.info.labelActs = acts();
      closeMenu();
      var tg = lt.querySelector('.pivot-collapse-toggle'), was = tg.classList.contains('pivot-group-collapsed');
      await choose(lt, 'pvToggle');
      var tg2 = lt.querySelector('.pivot-collapse-toggle');
      R.chk.toggle = !!tg2 && tg2.classList.contains('pivot-group-collapsed') !== was;
      await choose(lt, 'pvToggle');
      await choose(lt, 'pvCopyLabel');
      await sleep(200);
      R.chk.copyLabel = lastClip() === txt(lt);
      var key = lt.parentNode.querySelector('td[data-row-key]').getAttribute('data-row-key').split('|||')[0];
      function keyLeft() { return Array.prototype.some.call(document.querySelectorAll('#pivotResultTable tbody td[data-row-key]'), function (x) { return x.getAttribute('data-row-key').split('|||')[0] === key; }); }
      await choose(lt, 'pvLabelExclude');
      await until(function () { return !keyLeft() && cells().length > 0; }, 20000);
      R.chk.labelExclude = !keyLeft() && /H_GROUP/i.test(searchVal());
      R.info.exclude = { key: key, search: searchVal() };
      // Filter to this row and column: one leaf row, one column, left
      td = leaf();
      var rk = td.getAttribute('data-row-key'), ck = td.getAttribute('data-col-key');
      await choose(td, 'pvCellFilter');
      await until(function () {
        var v = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (x) {
          return !x.classList.contains('pivot-grand-total') && x.parentNode.style.display !== 'none';
        });
        return v.length > 0 && v.every(function (x) { return x.getAttribute('data-row-key') === rk && x.getAttribute('data-col-key') === ck; });
      }, 20000);
      var left = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (x) {
        return !x.classList.contains('pivot-grand-total') && x.parentNode.style.display !== 'none';
      });
      R.chk.cellFilter = left.length > 0 && left.every(function (x) { return x.getAttribute('data-row-key') === rk && x.getAttribute('data-col-key') === ck; })
        && /H_GROUP2/i.test(searchVal()) && /V_STATUS/i.test(searchVal());
      R.info.filter = { rk: rk, ck: ck, left: left.length, search: searchVal() };
    },
    // (not in SCN) the menus left open for a picture: PNB_SHOT=<png> py -3 run.py --stage DIR --scn pmshot
    pmshot: async function () {
      // the harness's own leftovers out of the picture
      Array.prototype.forEach.call(document.querySelectorAll('#saveStateLightbox, #action_overlay, #loadingOverlay, .zz-toast'), function (e) { e.style.display = 'none'; });
      document.body.classList.remove('lightbox-open');
      var th = head('Closed');
      R.chk.open = !!th && rclick(th) && !!menu();
      var m = menu();
      if (m) { m.style.left = '420px'; m.style.top = '60px'; }
      var lt = document.querySelector('#pivotResultTable tbody td[data-row-field="0"]');
      if (lt) { var r = lt.getBoundingClientRect(); window.__shotNote = Math.round(r.left) + ',' + Math.round(r.top); }
    },
    pmnotool: async function () {
      document.getElementById('pivotBtn').style.display = 'none';
      rclick(field(1));
      var a = acts();
      R.chk.noToolField = a.indexOf('pvSortAsc') >= 0 && a.indexOf('pvFieldUp') < 0 && a.indexOf('pvSwap') < 0 && a.indexOf('pvEdit') < 0;
      closeMenu();
      rclick(head('Closed'));
      a = acts();
      R.chk.noToolHead = a.indexOf('pvSortAsc') >= 0 && a.indexOf('pvShade') < 0 && a.indexOf('pvColExclude') >= 0;
      R.info.acts = a;
      closeMenu();
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
