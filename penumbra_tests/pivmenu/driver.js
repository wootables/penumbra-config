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
  PSUBS.push(['pvWidth', /^pvFit(All)?$/]);   // (2026-11-04, pvfit) the pivot's Column widths list
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
    // (2026-11-03, menufix) the Grand Total row: a column total's menu (Show the breakdown, Copy this value, Filter to this
    // column) and its drill; the label's menu (the pivot's own items, Clear all); a row label's Collapse all / Expand all;
    // Clear all last under a separator and no separator first in every pivot menu
    pmfix: async function () {
      var foot = document.querySelector('#pivotResultTable tfoot tr');
      var tot = foot ? Array.prototype.filter.call(foot.cells, function (c) { return c.hasAttribute('data-col-key'); })[0] || null : null;
      var gl = foot ? foot.cells[0] : null;
      var totOpen = !!tot && rclick(tot) && !!menu(), a = acts(), cf = item('pvCellFilter');
      R.chk.totalMenu = totOpen && a[0] === 'pvDrill' && a[1] === 'pvCopy' && !!cf && /this column/.test(cf.textContent);
      closeMenu();
      var glOpen = !!gl && rclick(gl) && !!menu(), b = acts();
      R.chk.totalLabel = glOpen && b.indexOf('pvEdit') >= 0 && b[b.length - 1] === 'clearPrefs' && b.indexOf('pvDrill') < 0;
      R.info.total = { tot: a, label: b, foot: foot ? foot.outerHTML.slice(0, 300) : null };
      closeMenu();
      var lab = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody td[data-row-field="0"]'), function (td) { return !!td.querySelector('.pivot-collapse-toggle'); })[0] || null;
      var labOpen = !!lab && rclick(lab) && !!menu(), c = acts();
      R.chk.labelAll = labOpen && c[0] === 'pvToggle' && c[1] === 'pvCollapseAll' && c[2] === 'pvExpandAll';
      if (item('pvCollapseAll')) { item('pvCollapseAll').click(); await sleep(800); }
      R.chk.labelCollapse = labOpen && document.querySelectorAll('#pivotResultTable .pivot-collapse-toggle').length > 0
        && document.querySelectorAll('#pivotResultTable .pivot-collapse-toggle:not(.pivot-group-collapsed)').length === 0;
      closeMenu();
      lab = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody td[data-row-field="0"]'), function (td) { return !!td.querySelector('.pivot-collapse-toggle'); })[0] || null;
      rclick(lab);
      if (item('pvExpandAll')) { item('pvExpandAll').click(); await sleep(800); }
      closeMenu();
      var spread = heads().filter(function (h) { return h.hasAttribute('colspan') && !h.hasAttribute('data-row-field'); })[0] || null;
      var spots = [field(0), heads().filter(function (h) { return !h.hasAttribute('data-row-field') && !h.hasAttribute('colspan'); })[0], cells()[0], lab, spread].filter(Boolean);
      var seen = spots.map(function (el) {
        rclick(el);
        var x = acts(), m = menu(), t = m ? m.querySelector('.pnb-hm-title') : null, first = t ? t.nextElementSibling : null, ci = item('clearPrefs');
        var out = { last: x[x.length - 1], lastSep: !!ci && !!ci.previousElementSibling && ci.previousElementSibling.classList.contains('pnb-hm-sep'), firstSep: !!first && first.classList.contains('pnb-hm-sep') };
        closeMenu();
        return out;
      });
      R.chk.clearLast = seen.length >= 4 && seen.every(function (o) { return o.last === 'clearPrefs' && o.lastSep; });
      // two values under each column value: its heading spans them (the one that opened on a separator)
      var s2 = P().settings(), h1 = window.__HC_HIDES || 0;
      s2.agg = ['count', 'sum']; s2.aggLabels = null; s2.aggShade = null; s2.aggFormat = null;
      P().rebuild(s2);
      await rebuilt(h1);
      spread = heads().filter(function (h) { return h.hasAttribute('colspan') && !h.hasAttribute('data-row-field'); })[0] || null;
      var sp = null;
      if (spread) {
        rclick(spread);
        var m2 = menu(), t2 = m2 ? m2.querySelector('.pnb-hm-title') : null, f2 = t2 ? t2.nextElementSibling : null, x2 = acts();
        sp = { open: !!m2, firstSep: !!f2 && f2.classList.contains('pnb-hm-sep'), last: x2[x2.length - 1], acts: x2 };
        closeMenu();
      }
      R.chk.noLeadSep = !!sp && sp.open && !sp.firstSep && sp.last === 'clearPrefs' && seen.every(function (o) { return !o.firstSep; });
      R.info.spots = { n: seen.length, seen: seen, spread: sp };
      foot = document.querySelector('#pivotResultTable tfoot tr');   // (the pivot was rebuilt: its cells are new)
      tot = foot ? Array.prototype.filter.call(foot.cells, function (c) { return c.hasAttribute('data-col-key'); })[0] || null : null;
      if (tot) { await choose(tot, 'pvDrill'); await sleep(900); }
      R.chk.totalDrill = !!document.querySelector('table.pnb-breakdown');
    },
    // (2026-11-03, menufix2) a breakdown's footer: the summary menu (the types, ticked, a pick redrawing it; no Clear all, as a
    // breakdown's menus); its label cell: the badges switch
    pmfix2: async function () {
      var HM = window.Penumbra.headerMenu, col = null;
      Array.prototype.forEach.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (th) { if (!col && /AMOUNT/i.test(th.getAttribute('data-colname'))) col = th.getAttribute('data-colname'); });
      if (col && typeof HM.sumPick === 'function') { HM.sumPick(col, 'sum'); await sleep(900); }
      function leaf2() {
        return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
          return td.parentNode.style.display !== 'none' && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
        })[0] || null;
      }
      await choose(leaf2(), 'pvDrill');
      await sleep(900);
      var bt = document.querySelector('table.pnb-breakdown'), ft = bt ? bt.querySelector('tfoot td[data-sum-col="' + col + '"]') : null;
      var op = !!ft && rclick(ft) && !!menu(), a = acts(), st = menu() ? (menu().querySelector('.pnb-hm-stats') || {}).textContent : '';
      R.chk.bdFootMenu = op && a[0] === 'sum-none' && a[1] === 'sum-sum' && item('sum-sum').getAttribute('aria-checked') === 'true' && a.indexOf('clearPrefs') < 0 && st === 'Breakdown summary';
      R.info.bdFoot = { col: col, acts: a, st: st, ft: ft ? ft.outerHTML.slice(0, 200) : null };
      var av = item('sum-avg'); if (av) { av.click(); }
      await sleep(900);
      ft = bt ? bt.querySelector('tfoot td[data-sum-col="' + col + '"]') : null;
      R.chk.bdFootPick = !!av && !!ft && ft.getAttribute('data-sum-type') === 'avg';
      var lab = bt ? bt.querySelector('tfoot td:first-child') : null;
      var lo = !!lab && !lab.hasAttribute('data-sum-col') && rclick(lab) && !!menu();
      R.chk.bdFootLabel = lo && acts().join() === 'sumBadges';
      closeMenu();
    },
    pmfield: async function () {
      rclick(field(1));
      R.chk.fieldItems = has(['pvSortAsc', 'pvSortDesc', 'pvCollapseAll', 'pvExpandAll', 'pvFieldUp', 'pvFieldDown', 'pvFieldRemove', 'pvSwap', 'pvEdit'])
        && item('pvFieldDown').getAttribute('aria-disabled') === 'true' && item('pvFieldUp').getAttribute('aria-disabled') !== 'true';
      R.chk.sortAZ = !!item('pvSortAsc') && /^\s*Sort ascending\s*$/.test(item('pvSortAsc').querySelector('.pnb-hm-label').textContent)
        && /^\s*Sort descending\s*$/.test(item('pvSortDesc').querySelector('.pnb-hm-label').textContent);   // (2026-11-03, menufix: it read Sort A to Z)
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
      // (2026-11-03, menufix) the '#' column has a menu now, as the table's: no sort; a cell's Copy is its row
      var numOpen = rclick(ths[0]) && !!menu(), numActs = acts(), numName = menu() ? menu().querySelector('.pnb-hm-name').textContent : '';
      closeMenu();
      var numCell = bt.tBodies[0].rows[0].cells[0], numCellOpen = rclick(numCell) && !!menu(), numCellActs = acts();
      closeMenu();
      R.chk.bdNumMenu = numOpen && numName === '# (Row Number)' && numActs.indexOf('bdSortAsc') < 0 && numActs.indexOf('rowHeight') >= 0;
      R.chk.bdNumRow = numCellOpen && numCellActs[0] === 'bdCopyRow' && numCellActs.indexOf('bdSortAsc') < 0;
      R.info.bdNum = { head: numActs, cell: numCellActs };
      var rB = th.getBoundingClientRect();
      R.chk.bdNativeShift = !th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, shiftKey: true, clientX: Math.round(rB.left + 6), clientY: Math.round(rB.top + 6) })) === false && !menu();
      R.chk.bdHeadOpens = rclick(th) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === txt(th) && !menu().querySelector('.pnb-hm-stats');   // (round 28) the counts moved into Column stats
      // (2026-10-27, copymenu) the copies in one list, Copy: on a heading, Column name and Distinct values
      R.chk.bdHeadItems = has(['bdSortAsc', 'bdSortDesc', 'bdStats', 'bdCopyMenu']) && !item('bdCopyCol') && !item('bdCopy') && !item('bdThenAsc') && !item('bdSortClear')
        && !item('bdCopyName') && !item('bdCopyDistinct') && (function () { item('bdCopyMenu').click(); return /^bdCopyName,bdCopyDistinct(,bdCopyGroups)?$/.test(subActs().join()); })();   // (bdbucket) a date or number column's groups after
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
      var bo = ['bdSortAsc', 'bdCopyMenu', 'bdStats', 'bdWidth'].map(function (x) { return topBd.indexOf(x); });   // (2026-11-03, menufix) the table heading's order
      R.chk.bdWidthItems = !!CW && bo.every(function (v, k) { return v >= 0 && (k === 0 || v > bo[k - 1]); }) && (topBd.indexOf('bdFormat') < 0 || topBd.indexOf('bdFormat') > bo[3]) && topBd.indexOf('bdFit') < 0
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
    },
    // (2026-11-04, pvfit) the pivot menu's Column widths list: Fit this column / Fit all column widths to
    // contents, 'auto' filed under the column's keys (a row label; the value columns together; the Grand
    // Total), with Undo; greyed while nothing is at a width of ours; reached from the cells too
    pmfit: async function () {
      var H = window.Penumbra.colWidthsHost, CW = window.Penumbra.colWidths;
      var f0 = H.pivotRowFields()[0], vf = H.pivotValueField();
      var kL = 'PIVOT:' + String(f0).toUpperCase(), kV = 'PIVOT:=' + String(vf).toUpperCase(), kT = 'PIVOT:TOTAL=' + String(vf).toUpperCase();
      function user() { return H.state().user; }
      function wOf(el) { return Math.round(el.getBoundingClientRect().width); }
      async function set(k, v) { H.setUser(k, v); await sleep(300); }
      function undoBtn() { var b = document.querySelectorAll('.zz-toast .pnb-colw-undo'); return b[b.length - 1] || null; }
      var tb = document.getElementById('pivotResultTable');
      R.info.fit = { f0: f0, vf: vf, marked: !!tb && tb.hasAttribute('data-pnb-colw-value') };
      // the list on a row field's heading, both greyed with no width of ours
      rclick(field(0));
      R.chk.fitItems = acts().indexOf('pvWidth') >= 0;
      var wl = reachP('pvFit'), wa = item('pvFitAll');
      R.chk.fitItems = R.chk.fitItems && !!wl && !!wa && subActs().join(',') === 'pvFit,pvFitAll';
      R.chk.fitFresh = !!wl && !!wa && wl.getAttribute('aria-disabled') === 'true' && wa.getAttribute('aria-disabled') === 'true';
      R.info.fit.sub = subActs();
      closeMenu();
      // one row label: 'auto' under its key, back to its natural width; Undo puts the 320 back
      var nat = wOf(field(0));
      await set(kL, 320);
      var held = wOf(field(0));
      var ran = await choose(field(0), 'pvFit');
      await sleep(300);
      R.chk.fitOne = ran && held === 320 && H.widthFor(kL) === null && Math.abs(wOf(field(0)) - nat) <= 2 && /fitted to content/.test(lastToast());
      R.info.fit.one = { nat: nat, held: held, now: wOf(field(0)), u: user()[kL], toast: lastToast().slice(0, 160) };
      var ub = undoBtn();
      if (ub) { ub.click(); await sleep(300); }
      R.chk.fitUndo = !!ub && user()[kL] === 320 && wOf(field(0)) === 320;
      // the value columns together, from a value heading; the row label kept
      await set(kV, 200);
      ran = await choose(head('Open'), 'pvFit');
      await sleep(300);
      R.chk.fitValue = ran && H.widthFor(kV) === null && user()[kL] === 320;
      R.info.fit.value = { u: user()[kV], l: user()[kL] };
      // every column, from a value cell's menu (a cell reaches its heading's list)
      await set(kV, 200); await set(kT, 180);
      var vc = cells()[0];
      ran = await choose(vc, 'pvFitAll');
      await sleep(300);
      R.chk.fitAll = ran && H.widthFor(kL) === null && H.widthFor(kV) === null && H.widthFor(kT) === null && /Pivot column widths fitted to content/.test(lastToast());
      R.info.fit.all = { l: user()[kL], v: user()[kV], t: user()[kT], toast: lastToast().slice(0, 160) };
      ub = undoBtn();
      if (ub) { ub.click(); await sleep(300); }
      R.chk.fitAllUndo = !!ub && user()[kL] === 320 && user()[kV] === 200 && user()[kT] === 180;
      // the cells: a row label reaches its row field's list, a value cell its heading's
      var lab = document.querySelector('#pivotResultTable tbody td[data-row-field="0"]');
      rclick(lab); var la = acts().indexOf('pvWidth') >= 0; closeMenu();
      rclick(vc); var va = acts().indexOf('pvWidth') >= 0; closeMenu();
      R.chk.fitCell = la && va;
      // the API: no pivot fit for a flat-table heading; the flat fit still refuses a pivot heading
      R.chk.fitApi = typeof CW.canFitPivot === 'function' && CW.canFitPivot(field(0)) === true && CW.canFit(field(0)) === false && CW.pivotSized(null) === true;
      R.info.fit.cell = { la: la, va: va };
    },
    pmbucket: async function () {
      // (2026-11-05, bdbucket) a breakdown column's buckets, as the report's Group by offers them: Copy > Distinct column
      // groups and Column stats > Rows per group, over the breakdown's OWN rows (each row's source row, __pnbBdSrc)
      var H = window.Penumbra.headerMenu;
      function leaf() {
        return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
          return td.parentNode.style.display !== 'none' && td.getAttribute('data-row-key').indexOf('|||') > 0 && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
        })[0] || null;
      }
      function subLabels() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item .pnb-hm-label'), function (e) { return e.textContent; }) : []; }
      function subHeads() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-head'), function (e) { return e.textContent; }) : []; }
      function subInfo() {   // (bdbucket sweep) an info line, or a Rows per group line to read (an item: its label and note)
        var p = subPanel();
        return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-info, .pnb-hm-item[data-act^="bdStatsRow-"], .pnb-hm-item[data-act="bdStatsMore"]'), function (d) {
          if (d.classList.contains('pnb-hm-info')) return [d.querySelector('.pnb-hm-info-k').textContent, d.querySelector('.pnb-hm-info-v').textContent];
          var nt = d.querySelector('.pnb-hm-note'); return [d.querySelector('.pnb-hm-label').textContent, nt ? nt.textContent : ''];
        }) : [];
      }
      async function open(act) { var it = item(act); if (!it) return false; it.click(); await sleep(150); return true; }
      function fn(f) { return typeof H[f] === 'function'; }
      // a cell with many rows behind it, so the years repeat: the leaf with the largest sum (its rows' H_AMT add up)
      function amt(td) { return parseFloat(td.textContent.replace(/[^0-9.\-]/g, '')) || 0; }
      var leaves = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
        return td.parentNode.style.display !== 'none' && td.getAttribute('data-row-key').indexOf('|||') > 0 && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
      });
      var how = 'largest of ' + leaves.length;
      await choose(leaves.slice().sort(function (a, b) { return amt(b) - amt(a); })[0] || leaf(), 'pvDrill');
      await sleep(600);
      var bt = document.querySelector('table.pnb-breakdown');
      if (!bt) throw new Error('no breakdown table');
      var ths = Array.prototype.slice.call(bt.tHead.rows[0].cells);
      function hd(name) { return ths.filter(function (h) { return h.getAttribute('data-pnb-bd-col') === name; })[0] || null; }
      var thD = hd('V_DATE'), thA = hd('V_AMOUNT'), thT = hd('V_ID');   // (bdbucket 2) V_NAME splits by space: V_ID is the plain text
      if (!thD || !thA || !thT) throw new Error('breakdown headings missing: ' + ths.map(txt).join());
      var tb = bt.tBodies[0], body = Array.prototype.slice.call(tb.rows), src = body.map(function (tr) { return tr.__pnbBdSrc; });
      // the report's buckets for a column (its Group by list, a list's Split by too: bdbucket 2), as act ids
      function variants(c) { return H.groupVariants(c) || []; }
      function ids(c) { return variants(c).map(function (v) { return v.active ? 'active' + v.active : String(v.token).split(':').pop(); }); }
      var dIds = ids('V_DATE'), aIds = ids('V_AMOUNT');
      // the breakdown's dates from its own text (m/d/yyyy): its years, their rows, its months
      function dt(s) { var m = /^(\d+)\/(\d+)\/(\d{4})/.exec(String(s || '')); return m ? { y: +m[3], m: +m[1] } : null; }
      var iD = thD.cellIndex, dates = body.map(function (tr) { return dt(tr.cells[iD].textContent.trim()); });
      var yrs = [], yc = {}, yms = {};
      dates.forEach(function (d) { if (!d) return; if (yrs.indexOf(String(d.y)) < 0) yrs.push(String(d.y)); yc[d.y] = (yc[d.y] || 0) + 1; yms[d.y * 100 + d.m] = 1; });
      yrs.sort();
      R.info.bk = { how: how, rows: body.length, src: src.filter(function (m) { return m instanceof Map; }).length, dIds: dIds, aIds: aIds, yrs: yrs, txtV: (H.groupVariants('V_NAME') || []).map(function (v) { return v.token; }) };
      // Copy on the date heading: Distinct column groups after Distinct column values, its buckets the report's
      closeMenu(); rclick(thD);
      await open('bdCopyMenu'); var l1 = subActs();
      await open('bdCopyGroups'); var l2 = subActs(), lab2 = subLabels();
      R.chk.bkCopyList = l1.join() === 'bdCopyName,bdCopyDistinct,bdCopyGroups' && dIds.length > 0 && l2.join() === dIds.map(function (x) { return 'bdCopyGroup-' + x; }).join()
        && ['year', 'fy', 'ym'].every(function (x) { return dIds.indexOf(x) >= 0; }) && lab2.join('|') === variants('V_DATE').map(function (v) { return v.label; }).join('|');
      R.info.bkList = { l1: l1, l2: l2, lab2: lab2 };
      // By Year, comma: the breakdown's years, ascending
      await open('bdCopyGroup-year'); var l3 = subActs();
      if (item('bdCopyGroup-year-comma')) { item('bdCopyGroup-year-comma').click(); await sleep(300); }
      R.chk.bkCopyYear = l3.indexOf('bdCopyGroup-year-newline') >= 0 && l3.indexOf('bdCopyGroup-year-comma') >= 0 && yrs.length >= 2 && lastClip() === yrs.join(',')
        && /Copied \d+ distinct groups? \(By Year\)\./.test(lastToast());
      R.info.bkYear = { clip: lastClip(), want: yrs.join(','), toast: lastToast().slice(0, 120), l3: l3 };
      // By Year > Month, newline: the months of the breakdown's rows - not the report's
      var all = (window.__rowsFixture || []).map(function (r) { var m = new Map(); Object.keys(r).forEach(function (k) { m.set(k, r[k]); }); return m; });
      var own = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:ym', src) : null, rep = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:ym', all) : null;
      closeMenu(); rclick(thD); await open('bdCopyMenu'); await open('bdCopyGroups'); await open('bdCopyGroup-ym');
      if (item('bdCopyGroup-ym-newline')) { item('bdCopyGroup-ym-newline').click(); await sleep(300); }
      R.chk.bkOwnRows = !!own && !!rep && own.length === Object.keys(yms).length && own.length < rep.length && own.every(function (x) { return rep.indexOf(x) >= 0; })
        && lastClip() === own.join('\n');
      R.info.bkOwn = { own: own, rep: rep ? rep.length : null, clip: String(lastClip()).slice(0, 120) };
      // a number column: its ranges, over the breakdown's rows
      var vA = variants('V_AMOUNT')[0] || null, ownA = (vA && fn('groupValues')) ? H.groupValues('V_AMOUNT', vA.token, src) : null;
      closeMenu(); rclick(thA); await open('bdCopyMenu'); var la = subActs();
      if (vA) { await open('bdCopyGroups'); await open('bdCopyGroup-' + aIds[0]); if (item('bdCopyGroup-' + aIds[0] + '-newline')) { item('bdCopyGroup-' + aIds[0] + '-newline').click(); await sleep(300); } }
      R.chk.bkCopyNum = !!vA && la.join() === 'bdCopyName,bdCopyDistinct,bdCopyGroups' && !!ownA && ownA.length >= 1 && ownA.length <= body.length && lastClip() === ownA.join('\n');
      R.info.bkNum = { la: la, tok: vA ? vA.token : null, own: ownA, clip: String(lastClip()).slice(0, 120) };
      // a date cell's Copy list: This value, its name, This row, Distinct values, Distinct column groups
      closeMenu(); rclick(body[0].cells[iD]); await open('bdCopyMenu'); var lc = subActs();
      R.chk.bkCell = lc.join() === 'bdCopy,bdCopyName,bdCopyRow,bdCopyDistinct,bdCopyGroups';
      R.info.bkCell = lc;
      // a text column: no groups in Copy, no Rows per group in Column stats
      closeMenu(); rclick(thT); await open('bdCopyMenu'); var lt = subActs();
      closeMenu(); rclick(thT); await open('bdStats'); var ht = subHeads(), st = subActs();
      R.chk.bkNoText = lt.join() === 'bdCopyName,bdCopyDistinct' && ht.indexOf('Rows per group') < 0 && !st.some(function (a) { return /^bdStatsGroup-/.test(a); });
      R.info.bkText = { lt: lt, ht: ht, st: st };
      // a row without its source row: no groups (they could not be read)
      var keepS = body[1].__pnbBdSrc; delete body[1].__pnbBdSrc;
      closeMenu(); rclick(thD); await open('bdCopyMenu'); var ln = subActs();
      closeMenu(); rclick(thD); await open('bdStats'); var hn = subHeads();
      body[1].__pnbBdSrc = keepS;
      R.chk.bkNoSrc = ln.join() === 'bdCopyName,bdCopyDistinct' && hn.indexOf('Rows per group') < 0;
      R.info.bkNoSrc = { ln: ln, hn: hn };
      // Column stats on the date heading: Rows per group last, a list for each bucket
      closeMenu(); rclick(thD); await open('bdStats'); var hs = subHeads(), sa = subActs();
      R.chk.bkStatsList = hs.length > 0 && hs[hs.length - 1] === 'Rows per group' && dIds.length > 0 && sa.join() === dIds.map(function (x) { return 'bdStatsGroup-' + x; }).join();
      R.info.bkStats = { hs: hs, sa: sa };
      // By Year: each year with its rows, in order
      await open('bdStatsGroup-year'); var iy = subInfo(), hy = subHeads();
      var wantY = yrs.map(function (y) { return [y, String(yc[y])]; });
      R.chk.bkStatsYear = JSON.stringify(iy) === JSON.stringify(wantY) && hy.join() === 'Rows in each group';
      R.info.bkStatsYear = { got: iy, want: wantY, hy: hy };
      // a blank date: (Blank) last, its row out of the years
      var keepB = body[0].__pnbBdSrc, mb = new Map(keepB); mb.set('V_DATE', ''); body[0].__pnbBdSrc = mb;
      var yc2 = {}; dates.forEach(function (d, k) { if (d && k > 0) yc2[d.y] = (yc2[d.y] || 0) + 1; });
      var wantB = Object.keys(yc2).sort().map(function (y) { return [y, String(yc2[y])]; }).concat([['(Blank)', '1']]);
      closeMenu(); rclick(thD); await open('bdStats'); await open('bdStatsGroup-year'); var ib = subInfo();
      body[0].__pnbBdSrc = keepB;
      R.chk.bkStatsBlank = JSON.stringify(ib) === JSON.stringify(wantB);
      R.info.bkBlank = { got: ib, want: wantB };
      // a long list: 60 more rows, a month each in 2001-2005 - By Year > Month stops at 50, its last line the rest
      var extra = [];
      for (var k = 0; k < 60; k++) {
        var tr = body[0].cloneNode(true), mx = new Map(keepB);
        mx.set('V_DATE', ((k % 12) + 1) + '/1/' + (2001 + Math.floor(k / 12)));
        tr.__pnbBdSrc = mx; tb.appendChild(tr); extra.push(tr);
      }
      var totalYm = Object.keys(yms).length + 60;
      closeMenu(); rclick(thD); await open('bdStats'); await open('bdStatsGroup-ym'); var ic = subInfo();
      extra.forEach(function (tr) { tr.parentNode.removeChild(tr); });
      var more = totalYm - 50;
      R.chk.bkStatsCap = ic.length === 51 && JSON.stringify(ic[50]) === JSON.stringify([more + (more === 1 ? ' more group' : ' more groups'), '']) && ic.slice(0, 50).every(function (p) { return /^\d+$/.test(p[1]); });
      R.info.bkCap = { n: ic.length, last: ic[ic.length - 1], total: totalYm };
      closeMenu();
      // an active level (a start/end pair's START: Active per Year), straight from the API, the rows out of order: every
      // year a row runs in, ascending; counts per year, a row with no start last as ''; a split by a delimiter stays out
      function mp(o) { var m = new Map(); Object.keys(o).forEach(function (k) { m.set(k, o[k]); }); return m; }
      var ra = [mp({ V_DATE: '6/1/2022', H_DATE: '8/1/2022', V_NAME: 'Alpha Bravo' }), mp({ V_DATE: '3/1/2021', H_DATE: '2/1/2023', V_NAME: 'Bravo Delta' }), mp({ V_DATE: '', H_DATE: '1/1/2024', V_NAME: 'Echo Golf' })];
      var av = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:year@H_DATE', ra) : 'n/a', ac = fn('groupCounts') ? H.groupCounts('V_DATE', 'V_DATE:year@H_DATE', ra) : 'n/a';
      var kept = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:year@H_DATE') : 'n/a', dl = fn('groupValues') ? H.groupValues('V_NAME', 'V_NAME:dspace', ra) : 'n/a';
      R.chk.bkActive = JSON.stringify(av) === '["2021","2022","2023"]' && JSON.stringify(ac) === '[{"v":"2021","n":1},{"v":"2022","n":2},{"v":"2023","n":1},{"v":"","n":1}]'
        && Array.isArray(kept);   // (bdbucket 2) a split names its values now: bkSplitApi
      R.info.bkActive = { av: av, ac: ac, kept: Array.isArray(kept) ? kept.length : kept, dl: dl };
      // (bdbucket 2; the user: "I dont see the bucketing by delimited strings ... for PI_LIST or DEPARTMENT_LIST") a list
      // column - V_NAME's words, Split by space in the report's Group by - in both lists: each word once, alphabetical,
      // and the rows listing each
      var thN = hd('V_NAME'), iN = thN.cellIndex, nIds = ids('V_NAME'), words = {}, wc = {};
      body.forEach(function (tr) {
        var seen = {};
        tr.cells[iN].textContent.trim().split(/ +/).forEach(function (w) { if (!w || seen[w]) return; seen[w] = 1; words[w] = 1; wc[w] = (wc[w] || 0) + 1; });
      });
      var wl = Object.keys(words).sort(function (a, b) { return a.localeCompare(b); });   // (bdbucket sweep) the grouped view's text order
      closeMenu(); rclick(thN); await open('bdCopyMenu'); var sn1 = subActs();
      await open('bdCopyGroups'); var sn2 = subActs(), snl = subLabels();
      await open('bdCopyGroup-dspace'); if (item('bdCopyGroup-dspace-newline')) { item('bdCopyGroup-dspace-newline').click(); await sleep(300); }
      R.chk.bkSplit = nIds.join() === 'dspace' && sn1.join() === 'bdCopyName,bdCopyDistinct,bdCopyGroups' && sn2.join() === 'bdCopyGroup-dspace' && snl.join() === 'Split by space'
        && wl.length >= 2 && lastClip() === wl.join('\n') && /Copied \d+ distinct values? \(Split by space\)\./.test(lastToast());
      R.info.bkSplit = { ids: nIds, sn1: sn1, sn2: sn2, snl: snl, want: wl, clip: String(lastClip()).slice(0, 200), toast: lastToast().slice(0, 120) };
      closeMenu(); rclick(thN); await open('bdStats'); var hsN = subHeads(), saN = subActs();
      await open('bdStatsGroup-dspace'); var isN = subInfo(), hhN = subHeads();
      var wantN = wl.map(function (w) { return [w, String(wc[w])]; });
      R.chk.bkSplitStats = hsN.length > 0 && hsN[hsN.length - 1] === 'Rows per group' && saN.join() === 'bdStatsGroup-dspace' && hhN.join() === 'Rows listing each value'
        && JSON.stringify(isN) === JSON.stringify(wantN.slice(0, 50));
      R.info.bkSplitStats = { hs: hsN, sa: saN, hh: hhN, got: isN.slice(0, 8), want: wantN.slice(0, 8) };
      closeMenu();
      // ...and straight from the API, over given rows: each value once, alphabetical; a row counted once per value it lists
      var sv = fn('groupValues') ? H.groupValues('V_NAME', 'V_NAME:dspace', ra) : 'n/a', sc = fn('groupCounts') ? H.groupCounts('V_NAME', 'V_NAME:dspace', ra) : 'n/a';
      R.chk.bkSplitApi = JSON.stringify(sv) === '["Alpha","Bravo","Delta","Echo","Golf"]'
        && JSON.stringify(sc) === '[{"v":"Alpha","n":1},{"v":"Bravo","n":2},{"v":"Delta","n":1},{"v":"Echo","n":1},{"v":"Golf","n":1}]';
      R.info.bkSplitApi = { sv: sv, sc: sc };
      // (bdbucket sweep; the user: "Full bugsweep of this and lets close out this feature")
      // a split's values in the grouped view's text order ("11-CALS" before "9-CVM"), not a number line's
      var ss = fn('groupValues') ? H.groupValues('V_NAME', 'V_NAME:dspace', [mp({ V_NAME: '9-CVM 11-CALS' })]) : 'n/a';
      R.chk.bkSplitSort = JSON.stringify(ss) === '["11-CALS","9-CVM"]';
      // a bucket's text fallback decoded (the data is HTML-escaped), as the grouped view names its group
      var en1 = fn('groupValues') ? H.groupValues('V_AMOUNT', 'V_AMOUNT:bin', [mp({ V_AMOUNT: 'TBD &amp; pending' })]) : 'n/a';
      var en2 = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:year', [mp({ V_DATE: 'R&amp;D' })]) : 'n/a';
      R.chk.bkEntity = JSON.stringify(en1) === '["TBD & pending"]' && JSON.stringify(en2) === '["R&D"]';
      R.info.bkSweepApi = { ss: ss, en1: en1, en2: en2 };
      // past 50 groups: (Blank) still shown, last, and not counted among the "more"
      var keepC = body[0].__pnbBdSrc, extraC = [];
      for (var kc = 0; kc < 60; kc++) {
        var trc = body[0].cloneNode(true), mc = new Map(keepC);
        mc.set('V_DATE', ((kc % 12) + 1) + '/1/' + (2001 + Math.floor(kc / 12)));
        trc.__pnbBdSrc = mc; tb.appendChild(trc); extraC.push(trc);
      }
      var trb = body[0].cloneNode(true), mbk = new Map(keepC); mbk.set('V_DATE', ''); trb.__pnbBdSrc = mbk; tb.appendChild(trb); extraC.push(trb);
      closeMenu(); rclick(thD); await open('bdStats'); await open('bdStatsGroup-ym'); var icb = subInfo();
      extraC.forEach(function (tr) { tr.parentNode.removeChild(tr); });
      var moreB = Object.keys(yms).length + 60 - 50;
      R.chk.bkCapBlank = icb.length === 52 && JSON.stringify(icb[50]) === JSON.stringify([moreB + ' more groups', '']) && JSON.stringify(icb[51]) === '["(Blank)","1"]';
      R.info.bkCapBlank = { n: icb.length, tail: icb.slice(-3), more: moreB };
      closeMenu();
      // the keyboard: Rows per group's lines are stops - ArrowRight enters a bucket's list (its line read out as
      // "<group>, <n> rows"), Enter keeps the menu, ArrowLeft comes back to the bucket with Column stats still open
      function key(k) { var a = document.activeElement; if (a) a.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      closeMenu(); rclick(thD); await open('bdStats');
      var bY = item('bdStatsGroup-year'); if (bY) bY.focus();
      key('ArrowRight'); await sleep(150);
      var a1 = document.activeElement, inRow = !!a1 && /^bdStatsRow-/.test(a1.getAttribute('data-act') || ''), nSubs1 = document.querySelectorAll('.pnb-hm-sub').length;
      var ariaOk = !!a1 && /, \d+ rows?$/.test(a1.getAttribute('aria-label') || '');
      key('Enter'); await sleep(150);
      var stillOpen = !!menu() && document.querySelectorAll('.pnb-hm-sub').length === nSubs1;
      key('ArrowLeft'); await sleep(150);
      var a2 = document.activeElement, back = !!a2 && a2.getAttribute('data-act') === 'bdStatsGroup-year', nSubs2 = document.querySelectorAll('.pnb-hm-sub').length;
      R.chk.bkKbd = inRow && ariaOk && stillOpen && back && nSubs2 === nSubs1 - 1 && nSubs2 >= 1;
      R.info.bkKbd = { a1: a1 ? a1.getAttribute('data-act') : null, aria: a1 ? a1.getAttribute('aria-label') : null, subs: [nSubs1, nSubs2], a2: a2 ? a2.getAttribute('data-act') : null, stillOpen: stillOpen };
      closeMenu();
      // ...and a short window: Column stats taller than its room, its first stop (By Year, under the facts) in sight
      var stS = document.createElement('style'); stS.textContent = '.pnb-hm-sub { max-height: 140px !important; }'; document.head.appendChild(stS);
      closeMenu(); rclick(thD);
      var bs = item('bdStats'); if (bs) bs.focus();
      key('ArrowRight'); await sleep(200);
      var a3 = document.activeElement, pnl = a3 && a3.closest ? a3.closest('.pnb-hm-sub') : null, rA = a3 ? a3.getBoundingClientRect() : null, rP = pnl ? pnl.getBoundingClientRect() : null;
      var inSight = !!rA && !!rP && rA.top >= rP.top - 1 && rA.bottom <= rP.bottom + 1;
      R.chk.bkKbdScroll = !!a3 && a3.getAttribute('data-act') === 'bdStatsGroup-year' && !!pnl && pnl.scrollHeight > pnl.clientHeight + 20 && inSight;
      R.info.bkKbdScroll = { act: a3 ? a3.getAttribute('data-act') : null, a: rA ? [Math.round(rA.top), Math.round(rA.bottom)] : null, p: rP ? [Math.round(rP.top), Math.round(rP.bottom)] : null, sh: pnl ? [pnl.scrollHeight, pnl.clientHeight, pnl.scrollTop] : null };
      stS.parentNode.removeChild(stS); closeMenu();
      // a list column's Column stats: no number stats, its lengths instead (V_NAME - Split by space - holding numbers)
      var iN2 = thN.cellIndex, keepT = body.map(function (tr) { return tr.cells[iN2].innerHTML; });
      body.forEach(function (tr, k) { tr.cells[iN2].textContent = (500000 + k) + ' ' + (600000 + k); });
      closeMenu(); rclick(thN); await open('bdStats'); var keysL = subInfo().map(function (p) { return p[0]; });
      body.forEach(function (tr, k) { tr.cells[iN2].innerHTML = keepT[k]; });
      R.chk.bkListStats = keysL.indexOf('Shortest') >= 0 && keysL.indexOf('Smallest') < 0 && keysL.indexOf('Total') < 0;
      R.info.bkListStats = keysL.slice(0, 10);
      closeMenu();
      // a long group label: cut as Most common's, the whole of it the tooltip and the spoken name
      var keepL = body[0].__pnbBdSrc, mL = new Map(keepL), longW = 'Supercalifragilisticexpialidocious-and-more';
      mL.set('V_NAME', longW + ' Alpha'); body[0].__pnbBdSrc = mL;
      closeMenu(); rclick(thN); await open('bdStats'); await open('bdStatsGroup-dspace');
      var rowL = Array.prototype.filter.call((subPanel() || document).querySelectorAll('.pnb-hm-item'), function (e) { return (e.getAttribute('aria-label') || '').indexOf(longW) === 0; })[0] || null;
      body[0].__pnbBdSrc = keepL;
      var labL = rowL ? rowL.querySelector('.pnb-hm-label').textContent : null, titL = rowL ? (rowL.getAttribute('title') || (window.jQuery ? window.jQuery(rowL).data('ui-tooltip-title') : '')) : null;
      R.chk.bkLongLabel = !!rowL && labL === longW.slice(0, 27) + '...' && titL === longW && rowL.getAttribute('aria-label') === longW + ', 1 row';
      R.info.bkLongLabel = { lab: labL, tit: titL, aria: rowL ? rowL.getAttribute('aria-label') : null };
      closeMenu();
      // (2026-11-05, bdbucket older issues; the user: "fix the older issues") a two-digit fiscal year within a window:
      // FY99 is 1999, so it sorts before FY00 (it read as 2099 and sorted last); the same for a fiscal quarter
      var fyv = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:fy', [mp({ V_DATE: '3/1/2000' }), mp({ V_DATE: '3/1/1999' }), mp({ V_DATE: '8/1/2000' })]) : 'n/a';
      var fqv = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:fyq', [mp({ V_DATE: '7/15/1999' }), mp({ V_DATE: '6/15/1999' })]) : 'n/a';
      R.chk.bkFy99 = JSON.stringify(fyv) === '["FY99","FY00","FY01"]' && JSON.stringify(fqv) === '["FY99 Q4","FY00 Q1"]';
      R.info.bkFy99 = { fy: fyv, fyq: fqv };
      // ...and Hour needs a time: a date-only column offers no By Hour, a date-only value keeps its text, a time buckets
      var hv1 = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:hour', [mp({ V_DATE: '3/1/2021' })]) : 'n/a';
      var hv2 = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:hour', [mp({ V_DATE: '2021-03-01 14:22:00' })]) : 'n/a';
      R.chk.bkNoHour = dIds.length > 0 && dIds.indexOf('hour') < 0 && JSON.stringify(hv1) === '["3/1/2021"]' && JSON.stringify(hv2) === '["14:00"]';
      R.info.bkNoHour = { dIds: dIds, hv1: hv1, hv2: hv2 };
      // (2026-11-05, bdbucket final sweep; the user: "...then full bugsweep on this and we can close this out") a two-digit
      // fiscal year as the date parser reads a two-digit year - 00-68 is 20xx, 69-99 is 19xx (fixed, never sliding): FY69 is
      // 1969, first; FY65 is 2065, after FY99 (a window of 30 years ahead read it as 1965); the same for a fiscal quarter
      var f68 = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:fy', [mp({ V_DATE: '3/1/2065' }), mp({ V_DATE: '3/1/1999' }), mp({ V_DATE: '3/1/2068' }), mp({ V_DATE: '3/1/1969' })]) : 'n/a';
      var q68 = fn('groupValues') ? H.groupValues('V_DATE', 'V_DATE:fyq', [mp({ V_DATE: '3/1/2065' }), mp({ V_DATE: '3/1/1999' })]) : 'n/a';
      R.chk.bkFy68 = JSON.stringify(f68) === '["FY69","FY99","FY65","FY68"]' && JSON.stringify(q68) === '["FY99 Q3","FY65 Q3"]';
      R.info.bkFy68 = { fy: f68, fyq: q68 };
      // ...a value that is only a no-break space ('&nbsp;': the data is HTML-escaped) or only spaces joins no group - the
      // grouped view's [Blank] - its rows counted as (Blank); a padded date buckets as its trimmed text does (the labelers
      // trim their input)
      var nb = fn('groupCounts') ? H.groupCounts('V_DATE', 'V_DATE:year', [mp({ V_DATE: '&nbsp;' }), mp({ V_DATE: '   ' }), mp({ V_DATE: ' 3/1/2021 ' })]) : 'n/a';
      R.chk.bkNbsp = JSON.stringify(nb) === '[{"v":"2021","n":1},{"v":"","n":2}]';
      R.info.bkNbsp = nb;
      // ...Rows per group's lines are to read: no pointer and no hover fill (pnb-hm-ro), unlike the bucket lists beside them
      closeMenu(); rclick(thD); await open('bdStats'); var opL = item('bdStatsGroup-year'); await open('bdStatsGroup-year');
      var roL = (subPanel() || document).querySelector('.pnb-hm-item[data-act^="bdStatsRow-"]');
      var roCur = roL ? getComputedStyle(roL).cursor : null, opCur = opL ? getComputedStyle(opL).cursor : null, hov = false;
      Array.prototype.forEach.call(document.styleSheets, function (ss) {
        try { Array.prototype.forEach.call(ss.cssRules || [], function (r) { if (/\.pnb-hm-ro:hover/.test(r.selectorText || '') && r.style && r.style.backgroundColor === 'transparent') hov = true; }); } catch (e) { }
      });
      R.chk.bkRoLine = !!roL && roL.classList.contains('pnb-hm-ro') && roCur === 'default' && !!opL && !opL.classList.contains('pnb-hm-ro') && opCur === 'pointer' && hov;
      R.info.bkRoLine = { ro: roL ? roL.className : null, roCur: roCur, opCur: opCur, hov: hov };
      closeMenu();
      // ...and the column menu's Copy > Distinct column groups names an active level's items as Group by's does:
      // copyGroup-active<period>, no '@<END>' in the act (the command palette reads the acts by a word pattern). This
      // fixture has no start/end pair, so the API offers V_DATE one Active per Year variant (its shape, main.js's) here.
      var thR = document.querySelector("#resultsTable thead th[data-colname='V_DATE']");
      function pickAct(list, a) { return (list || []).filter(function (x) { return x && x.act === a; })[0] || null; }
      var gvWas = H.groupVariants, cTop = [], cCopy = null, cGrp = null, cga = [];
      H.groupVariants = function (c) { var l = gvWas.apply(H, arguments) || []; return String(c) === 'V_DATE' ? l.concat([{ token: 'V_DATE:year@H_DATE', label: 'Active per Year (to H_DATE)', delim: null, active: 'year' }]) : l; };
      try {
        cTop = (thR && window.Penumbra.colMenu && typeof window.Penumbra.colMenu.items === 'function') ? window.Penumbra.colMenu.items(thR) : [];
        cCopy = pickAct(cTop, 'copyMenu'); cGrp = (cCopy && typeof cCopy.items === 'function') ? pickAct(cCopy.items(), 'copyGroups') : pickAct(cTop, 'copyGroups');
        cga = (cGrp && typeof cGrp.items === 'function') ? cGrp.items().map(function (x) { return x.act; }) : [];
      } finally { H.groupVariants = gvWas; }
      R.chk.bkCopyActIds = cga.indexOf('copyGroup-activeyear') >= 0 && cga.indexOf('copyGroup-year') >= 0 && cga.every(function (a) { return /^copyGroup-[a-z0-9]+$/.test(a); });
      R.info.bkCopyActIds = { th: !!thR, top: cTop.length, copy: !!cCopy, grp: !!cGrp, cga: cga };
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
