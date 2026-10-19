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
  async function choose(el, act) {
    closeMenu();
    rclick(el);
    var it = item(act);
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
      R.chk.bdHeadOpens = rclick(th) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === txt(th) && /rows?, /.test((menu().querySelector('.pnb-hm-stats') || {}).textContent || '');
      R.chk.bdHeadItems = has(['bdSortAsc', 'bdSortDesc', 'bdCopyCol', 'bdCopyDistinct', 'bdCopyName']) && !item('bdCopy') && !item('bdThenAsc') && !item('bdSortClear');
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
      await choose(thc, 'bdCopyCol');
      R.chk.bdCopyCol = lastClip() === vals.join('\n') && /Copied \d+ values?\./.test(lastToast());
      await choose(thc, 'bdCopyDistinct');
      R.chk.bdCopyDistinct = lastClip() === distinct.join('\n') && !!dup && distinct.length < vals.length;
      var td = bt.tBodies[0].rows[0].cells[i2];
      R.chk.bdCell = rclick(td) && !!menu() && acts()[0] === 'bdCopy' && menu().querySelector('.pnb-hm-name').textContent === txt(th2) && td.classList.contains('pnb-hm-cell');
      closeMenu();
      await choose(td, 'bdCopy');
      R.chk.bdCopyValue = lastClip() === td.textContent.trim() && !td.classList.contains('pnb-hm-cell');
      await choose(th2, 'bdCopyName');
      R.chk.bdCopyName = lastClip() === txt(th2);
      // from the keyboard (Shift+F10 on the focused heading): the menu drops from it
      th.focus();
      th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }));
      var m = menu(), r = th.getBoundingClientRect(), mr = m ? m.getBoundingClientRect() : null;
      R.chk.bdKbd = !!mr && Math.abs(mr.top - r.bottom) <= 2 && Math.abs(mr.left - r.left) <= 2 && document.activeElement === m.querySelector('.pnb-hm-item');
      closeMenu();
      R.info.bdCopies = { vals: vals.length, distinct: distinct.length, dupCol: dup ? txt(dup) : null, clip: String(lastClip()).slice(0, 60) };
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
      closeMenu();
      await choose(td, 'pvDrill');
      R.chk.drill = drills === 1;
      $('.help-lightbox:visible, .infobox-overlay:visible').hide();
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
