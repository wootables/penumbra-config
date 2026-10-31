// colmenu suite - page half (2026-10-16). The table header's right-click menu
// (js/penumbra_colmenu.js) on the REAL main.js + column options / calculated column /
// column width modules, saveconf fixture (300 rows; shown V_ID V_NAME V_AMOUNT V_DATE
// V_LINK V_STATUS; hidden H_*). g* scenarios open grouped by H_GROUP.
//   mflat     the menu, sort, move (+ Undo, the Settings tip once), hide, show here
//   mkbd      from the keyboard: placed under the header, arrows, Enter, Escape
//   mopts     column options popover, freeze, widths
//   mcalc     a calculated column, its formula seeded, placed beside the column
//   mgroupby  group by this column from the flat table
//   gmenu     the grouped view: sort every group, move / hide in every group, regroup, ungroup
//   mrestr    Column Organization closed to the viewer: sort only
//   mexcl     a cell, '#', a snapshot comparison keep the browser's menu (guards)
// window.show_text is stubbed: what the menu posts is recorded and drawn as a plain
// card (the real stack shows three and queues the rest).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (/^g/.test(SCN) && !(await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000))) throw new Error('no grouped view');
    await sleep(600);
    window.__toasts = [];
    window.show_text = function (html) {
      window.__toasts.push(String(html));
      var d = document.createElement('div'); d.className = 'zz-toast'; d.innerHTML = String(html); document.body.appendChild(d);
    };
  }
  function A() { return (window.Penumbra && window.Penumbra.headerMenu) || null; }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function gth(name) { return document.querySelector('#groupedResultsContainer table thead th[data-colname="' + name + '"]'); }
  function rclick(el, kbd) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    var ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: kbd ? 0 : 2,
      clientX: kbd ? 0 : Math.round(r.left + 6), clientY: kbd ? 0 : Math.round(r.top + 6) });
    return !el.dispatchEvent(ev);   // true = the default (the browser's menu) was prevented
  }
  function menu() { return document.getElementById('pnbHeadMenu'); }
  // (round 13) the menu and the lists open beside it are panels of their own
  function panelsAll() { return Array.prototype.slice.call(document.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function item(act) { var ps = panelsAll(); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function subPanel() { var s = document.querySelectorAll('.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function subActs() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function subLabels() { var p = subPanel(); return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item .pnb-hm-label'), function (e) { return e.textContent; }) : []; }
  // (round 21) the Column stats list's facts, label -> value
  function infoMap() { var p = subPanel(), o = {}; if (p) Array.prototype.forEach.call(p.querySelectorAll('.pnb-hm-info'), function (d) { o[d.querySelector('.pnb-hm-info-k').textContent] = d.querySelector('.pnb-hm-info-v').textContent; }); return o; }
  function anyHead() { var ps = panelsAll(); for (var i = ps.length - 1; i >= 0; i--) { var h = ps[i].querySelector('.pnb-hm-head'); if (h) return h; } return null; }
  function allItems() { var out = []; panelsAll().forEach(function (p) { out = out.concat(Array.prototype.slice.call(p.querySelectorAll('.pnb-hm-item'))); }); return out; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  // (round 12) the lists under one item: an act inside one is reached through its parent
  var SUBS = { 'move-left': 'move', 'move-right': 'move', 'move-start': 'move', 'move-end': 'move', 'move-swap': 'move',
    only: 'show', showAll: 'show', 'calc-left': 'calc', 'calc-right': 'calc', 'calc-start': 'calc', 'calc-end': 'calc',
    calcEdit: 'calc', calcDup: 'calc', calcRemove: 'calc', calcAdj: 'calc',   // (2026-10-19, calcadj round 3) one Calculated column entry; round 5: Duplicate
    fit: 'width', fitAll: 'width', fitPage: 'width', resetWidth: 'width', resetWidths: 'width',
    groupBy: 'groupByList' };   // (2026-10-26, delimgroup) a column with buckets: Group by is a list, As is in it   // (round 33) the Reset list went
  // (2026-10-27, copymenu) the menu's copies are one list, Copy: This value, This row, Column name, Distinct values (its
  // delimiters in a list of its own) and (copymenu 2) Link to this view - reached through it, a delimiter two levels down
  ['cellCopy', 'copyRow', 'copyName', 'copy', 'copyViewLink'].forEach(function (a) { SUBS[a] = 'copyMenu'; });
  // (2026-10-27, fltmenu) a cell's filters are one list, Filter; Copy gains This nested table and Distinct column groups
  ['cellFilter', 'cellExclude', 'cellAtLeast', 'cellAtMost', 'clickFilter'].forEach(function (a) { SUBS[a] = 'filterMenu'; });
  ['copyNestedTable', 'copyGroups'].forEach(function (a) { SUBS[a] = 'copyMenu'; });
  ['copy-space', 'copy-comma', 'copy-semicolon', 'copy-pipe', 'copy-tab', 'copy-newline', 'copy-other', 'copySplit'].forEach(function (a) { SUBS[a] = 'copy'; });
  function sub(act) { var it = item(act); if (!it || it.getAttribute('aria-disabled') === 'true') return false; it.click(); return true; }
  function reach(act) { if (!item(act) && SUBS[act]) { reach(SUBS[act]); sub(SUBS[act]); } return item(act); }
  async function choose(el, act) {
    closeMenu();
    rclick(el);
    var it = reach(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; }
    it.click();
    await sleep(450);
    return true;
  }
  function shownNames(sel) {
    return Array.prototype.filter.call(document.querySelectorAll(sel || '#tableHeader th[data-colname]'), function (t) { return t.style.display !== 'none' && t.getAttribute('data-column') !== '#'; })
      .map(function (t) { return t.getAttribute('data-colname'); });
  }
  function allNames() { return Array.prototype.map.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (t) { return t.getAttribute('data-colname'); }); }
  function prefs() { try { var p = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); return p.lrfix || {}; } catch (e) { return {}; } }
  function searchVal() { return document.getElementById('tableSearch').value; }
  function lastToast() { return window.__toasts.length ? window.__toasts[window.__toasts.length - 1] : ''; }
  function hdrIndex(name) {
    return Array.prototype.slice.call(document.querySelectorAll('#resultsTable thead th')).findIndex(function (t) { return t.dataset.colname === name; });
  }
  function colTexts(name, n) {
    var i = hdrIndex(name);
    if (i < 0) return [];
    return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr')).filter(function (tr) { return tr.style.display !== 'none'; })
      .slice(0, n || 60).map(function (tr) { return tr.children[i] ? tr.children[i].textContent.trim() : null; });
  }
  function rowsOk(name, n) {
    var i = hdrIndex(name);
    if (i < 0) return false;
    var trs = Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr')).filter(function (tr) { return tr.style.display !== 'none'; }).slice(0, n);
    return trs.length === n && trs.every(function (tr) {
      var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
      return r && tr.children[i] && tr.children[i].textContent.trim() === String(r[name]);
    });
  }
  // the line boxes a cell's text lays out in
  function lines(el) {
    var r = document.createRange(); r.selectNodeContents(el);
    var tops = {}; Array.prototype.forEach.call(r.getClientRects(), function (x) { if (x.width > 0) tops[Math.round(x.top)] = 1; });
    return Object.keys(tops).length;
  }
  function sorted(a, dir) {
    return a.length > 20 && a.every(function (v, j) { if (j === 0) return true; var c = a[j - 1].localeCompare(v); return dir === 'asc' ? c <= 0 : c >= 0; });
  }
  // (2026-10-20, grpmenu / grpauto) the group menu and the layout's auto choice
  function L() { var H = window.Penumbra && window.Penumbra.groupLayoutHost; return H ? H.get() : null; }
  function glOn() { var G = window.Penumbra && window.Penumbra.groupList; return !!(G && G.state().on); }
  function GM() { return (window.Penumbra && window.Penumbra.groupMenu) || null; }
  function grouped() { return document.body.classList.contains('group-mode-active'); }
  function tops() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer > .group-wrapper')); }
  function topKeys() { return tops().filter(function (w) { return !w.classList.contains('search-hidden'); }).map(function (w) { return w.getAttribute('data-group-key'); }); }
  function gw(key) { return tops().filter(function (w) { return w.getAttribute('data-group-key') === key; })[0] || null; }
  function bandEl(key) { var w = gw(key); return w ? w.querySelector(':scope > .group-header') : null; }
  function listRow(name) { return Array.prototype.filter.call(document.querySelectorAll('#pnbGroupList .pnb-gl-item'), function (r) { var n = r.querySelector('.pnb-gl-name'); return !!n && n.textContent === name; })[0] || null; }
  function levelsNow() { var G = GM(), w = tops()[0], i = (G && w) ? G.info(w) : null; return i ? i.levels.join() : ''; }
  async function groupedBy(col, n) {
    return await until(function () { return grouped() && !!A() && A().groupingColumn() === col && (n == null || tops().length === n); }, 15000);
  }
  async function flat() { if (A() && grouped()) A().ungroup(); return await until(function () { return !grouped(); }, 15000); }
  // the status bar chip's / the header menu's one-click Group by (penumbraGroupByColumn)
  async function oneClick(col, n) { window.Penumbra.groupByColumn(col); var ok = await groupedBy(col, n); await sleep(350); return ok; }
  function snipAction(name, value) { var a = $('<a class="snippet-action"></a>').attr('data-action-name', name).attr('data-action-value', value); $('#reportSnippetOutput').append(a); a.trigger('click'); a.remove(); }
  // a submenu's item: the menu on el, the list beside `parent`, then `act`
  async function chooseIn(el, parent, act) {
    closeMenu();
    rclick(el);
    if (!sub(parent)) { closeMenu(); return false; }
    var it = item(act);
    if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; }
    it.click();
    await sleep(450);
    return true;
  }
  // (2026-10-27, copymenu) a heading's name as the menu reads it (no sort arrows, grips or screen-reader words), and This row
  // as its rule says: the heading row's shown named columns ('#' aside), each "Name: text", a text of several lines indented
  // under it; val(h, td) for a cell of its own (undefined: its text; null: left out)
  function headLabel(h) {
    var c = h.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .sr-only, button, [aria-hidden="true"], [class*="grip"]'), function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim() || h.getAttribute('data-colname');
  }
  function rowWant(tr, heads, val) {
    var out = [];
    Array.prototype.forEach.call(heads, function (h) {
      var nm = h.getAttribute('data-colname');
      if (nm === null || nm === '#' || h.style.display === 'none') return;
      var c = tr.querySelector('td[data-column="' + h.getAttribute('data-column') + '"]');
      if (!c) return;
      var v = val ? val(h, c) : undefined;
      if (v === null) return;
      if (v === undefined) v = String(c.innerText || c.textContent || '').trim();
      out.push(headLabel(h) + ': ' + String(v).replace(/\r?\n/g, '\n  '));
    });
    return out;
  }
  // the Undo button of the newest notice whose text matches re
  function undoBtn(re) {
    var ts = Array.prototype.slice.call(document.querySelectorAll('.zz-toast')).filter(function (t) { return re.test(t.textContent); });
    return ts.length ? ts[ts.length - 1].querySelector('.pnb-hm-undo') : null;
  }
  function rdown(el) { var r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) })); }
  function keyOn(k) { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }

  // (2026-10-25, nestgb2) gnnestbd / gchipnest: the nested-table columns (mk_harness: H_TEXT's tables from row 7, H_JSON's,
  // H_ENT's sharing SUB_NAME with H_JSON's, H_NULL's empty) and their tables' columns as the band menu and the chip list them
  // (the header menu's and Quick actions' order): by the column's place in the table, each one's tables' in their own order,
  // a name two tables share once - the grouping dialog's Nested Table Columns holds the same names, in the order its rows show them
  var NB_COLS = ['H_TEXT', 'H_JSON', 'H_ENT', 'H_NULL'];
  var NB_OWN = { H_TEXT: ['NOTE_KIND', 'NOTE_DAYS'], H_JSON: ['SUB_ID', 'SUB_AMT', 'SUB_NAME'], H_ENT: ['ENT_KIND', 'SUB_NAME'], H_NULL: [] };
  function nbWant(cols) {
    var hdr = allNames(), out = [];
    cols.slice().sort(function (a, b) { return hdr.indexOf(a) - hdr.indexOf(b); }).forEach(function (c) { NB_OWN[c].forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); }); });
    return out;
  }
  // the groups on screen: each top group's key, its rows (its own table's, never a nested table's) and the groups below it
  function nbRows(w) { return Array.prototype.filter.call(w.querySelectorAll('tbody > tr'), function (tr) { return !tr.closest('.nested-json-container'); }).length; }
  function nbShape() {
    return tops().map(function (w) {
      var kids = Array.prototype.map.call(w.querySelectorAll('.group-wrapper[data-group-depth="1"]'), function (x) { return x.getAttribute('data-group-key') + '=' + nbRows(x); }).sort();
      return w.getAttribute('data-group-key') + '=' + nbRows(w) + '[' + kids.join(';') + ']';
    }).sort().join('|');
  }
  // the same levels through the grouping dialog, from the flat table: each level from its own picker (a nested field from
  // level 1's Nested Table Columns), none below them, Stacked picked - the groups it makes ('' when a pick is not there)
  async function nbDialog(levels) {
    await flat();
    $('#groupTableBtn').trigger('click');
    await sleep(400);
    var ids = ['groupingColumnSelector', 'groupingColumnSelector2', 'groupingColumnSelector3'], ok = true;
    for (var k = 0; k < ids.length && ok; k++) {
      var it = document.querySelector('#' + ids[k] + ' .pcs-dropdown ' + (k < levels.length ? '.pcs-item[data-value="' + levels[k] + '"]' : '.pcs-item-none'));
      if (it) { $(it).trigger('click'); await sleep(150); } else if (k < levels.length) { ok = false; }
    }
    var st = document.querySelector('#groupLayoutRow input[value="stacked"]');
    if (st) st.click();
    if (!ok) { $('#groupingLightbox').hide(); return ''; }
    $('#confirmGroupingBtn').trigger('click');
    var g = await until(function () { return levelsNow() === levels.join(); }, 15000);
    await sleep(500);
    $('#groupingLightbox').hide();
    return g ? nbShape() : '';
  }
  // an open list's entries in order: items by their act, headings by their text, separators '-'
  function nbSeq() {
    var p = subPanel();
    return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-sep, .pnb-hm-head, .pnb-hm-item'), function (e) {
      return e.classList.contains('pnb-hm-sep') ? '-' : (e.classList.contains('pnb-hm-head') ? 'H:' + e.textContent : e.getAttribute('data-act'));
    }) : [];
  }

  var S = {
    mflat: async function () {
      var BASE = shownNames();
      R.chk.prevented = rclick(fth('V_NAME'));
      R.chk.opens = !!menu();
      var t = menu() && menu().querySelector('.pnb-hm-title');
      R.chk.titleName = !!t && t.textContent.indexOf('V_NAME') >= 0;
      if (!menu()) return;   // (2026-10-20, stalemut) no menu (mutant j-menu): the checks below need one - red, not a crash
      // (round 2) the counts under the name: the rows the search keeps, from the data
      var names = window.__rowsFixture.map(function (r) { return r.V_NAME; });
      var uniq = {}; names.forEach(function (x) { uniq[x] = 1; });
      // (round 21) no counts line under the title; Column stats is a list beside the item
      var noLine = !menu().querySelector('.pnb-hm-stats') && !menu().getAttribute('aria-describedby');
      sub('stats');
      var inf = infoMap(), stHead = anyHead();
      R.chk.statsLine = noLine && !!subPanel() && inf['With a value'] === '300' && inf['Unique'] === String(Object.keys(uniq).length) && inf['Empty'] === '0'
        && !!stHead && /300 rows the (?:search|filter) keeps/.test(stHead.textContent) && !!inf['Shortest'] && !!inf['Longest'];   // filter: penumbra_tests\filterword (2026-10-19)
      R.info.stats = inf;
      // (round 26) Duplicates: the extra copies (Unique + Duplicates = With a value), the rows sharing a value, the values shared
      var cntN = {}; names.forEach(function (x) { cntN[x] = (cntN[x] || 0) + 1; });
      var dRows = 0, dExtra = 0, dVals = 0; Object.keys(cntN).forEach(function (k) { if (cntN[k] > 1) { dRows += cntN[k]; dExtra += cntN[k] - 1; dVals++; } });
      var dupWant = dExtra ? dExtra.toLocaleString() + ' (' + dRows.toLocaleString() + ' rows share ' + dVals.toLocaleString() + ' values)' : 'none';
      R.chk.statsDup = inf['Duplicates'] === dupWant && dExtra + Object.keys(uniq).length === 300;
      R.info.statsDup = { got: inf['Duplicates'], want: dupWant };
      // (round 4) no value repeats: "all"
      closeMenu();
      rclick(fth('V_ID')); sub('stats');
      var infU = infoMap();
      R.chk.statsAllUnique = infU['Unique'] === 'all' && infU['With a value'] === '300' && infU['Duplicates'] === 'none';
      R.info.statsU = infU;
      closeMenu();
      // (2026-10-20, mutfix) round 21's list: a number column's spread, a date column's span, from the data
      var amts = window.__rowsFixture.map(function (r) { return parseFloat(String(r.V_AMOUNT).replace(/[$,]/g, '')); }).sort(function (x, y) { return x - y; });
      var aSum = 0, aMid = amts.length >> 1; amts.forEach(function (v) { aSum += v; });
      var nf = function (x) { return Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 }); };
      var numWant = { Smallest: nf(amts[0]), Largest: nf(amts[amts.length - 1]), Total: nf(aSum), Average: nf(aSum / amts.length), Median: nf((amts[aMid - 1] + amts[aMid]) / 2) };
      rclick(fth('V_AMOUNT')); sub('stats');
      var infA = infoMap();
      R.chk.statsNum = amts.length === 300 && amts[0] < amts[amts.length - 1] && Object.keys(numWant).every(function (k) { return infA[k] === numWant[k]; });
      R.info.statsNum = { got: infA, want: numWant };
      closeMenu();
      var dk = function (s) { var p = String(s).split('/'); return (+p[2] * 100 + +p[0]) * 100 + +p[1]; };
      var days = window.__rowsFixture.map(function (r) { return r.V_DATE; }).sort(function (x, y) { return dk(x) - dk(y); });
      rclick(fth('V_DATE')); sub('stats');
      var infD = infoMap();
      R.chk.statsDate = dk(days[0]) < dk(days[days.length - 1]) && infD['Earliest'] === days[0] && infD['Latest'] === days[days.length - 1];
      R.info.statsDate = { got: infD, want: [days[0], days[days.length - 1]] };
      closeMenu();
      // the five most common values, each a filter: V_STATUS's top value filters the table to it
      var cntS = {};
      window.__rowsFixture.forEach(function (r) { cntS[r.V_STATUS] = (cntS[r.V_STATUS] || 0) + 1; });
      var bestS = Object.keys(cntS).sort(function (x, y) { return cntS[y] - cntS[x]; })[0];
      rclick(fth('V_STATUS')); sub('stats');
      var top0 = item('stats-top-0'), topLbl = top0 ? top0.querySelector('.pnb-hm-label').textContent : '', topN = top0 && top0.querySelector('.pnb-hm-note') ? top0.querySelector('.pnb-hm-note').textContent : '';
      closeMenu();
      rclick(fth('V_STATUS')); sub('stats');
      var ranTop = !!item('stats-top-0');
      if (ranTop) item('stats-top-0').click();
      await sleep(900);
      var visAfter = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length;
      R.chk.statsTop = !!top0 && topLbl === bestS && topN === String(cntS[bestS]) && ranTop && searchVal().indexOf('V_STATUS') >= 0 && visAfter === cntS[bestS];
      R.info.statsTop = { lbl: topLbl, n: topN, best: bestS, search: searchVal(), vis: visAfter };
      (function (t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); })('');
      await sleep(900);
      rclick(fth('V_NAME'));
      var a = acts();
      // (round 12) the top level: sort, filter, stats; options, move, show, hide, fit, freeze; copy, calc, group; reset
      R.chk.itemsAll = ['sortAsc', 'sortDesc', 'filter', 'width', 'rowHeight', 'options', 'move', 'show', 'hide', 'freeze', 'copyMenu', 'calc', 'groupBy', 'clearPrefs'].every(function (x) { return a.indexOf(x) >= 0 || (x === 'groupBy' && a.indexOf('groupByList') >= 0); })   // (delimgroup) or its list
        && ['copy', 'copyName'].every(function (x) { return a.indexOf(x) < 0; });   // (2026-10-27, copymenu) in the Copy list
      R.info.acts = a;
      closeMenu();
      // a column with empties (H_GROUP: null on every 11th row), counted by main.js
      var gv = window.__rowsFixture.map(function (r) { return r.H_GROUP; });
      var gu = {}, ge = 0;
      gv.forEach(function (x) { if (x === null || x === undefined || String(x).trim() === '') ge++; else gu[String(x).trim()] = 1; });
      var cs = A() && typeof A().colStats === 'function' ? A().colStats('H_GROUP') : null;
      R.chk.statsEmpty = !!cs && ge > 0 && cs.empty === ge && cs.values === 300 - ge && cs.unique === Object.keys(gu).length;
      R.info.statsEmpty = { got: cs, want: { empty: ge, unique: Object.keys(gu).length } };
      // (round 3) a journal column counts what it shows: a toggle its boxes, Notes its rows
      // with notes. The harness has no journal: the two hooks main.js asks are stubbed.
      var P = window.Penumbra, keepF = P.journalFriendlyCol, keepV = P.journalSearchColumnValue;
      var wantOn = 0, wantNotesRows = 0, wantNotes = 0;
      window.__rowsFixture.forEach(function (r, i) { if (i % 3 === 0) wantOn++; if (i % 4 === 0) { wantNotesRows++; wantNotes += 1 + (i % 3); } });
      P.journalFriendlyCol = function (c) { return c === 'V_STATUS' ? 'Done' : (c === 'V_DATE' ? 'Notes' : (keepF ? keepF(c) : null)); };
      P.journalSearchColumnValue = function (m, up) {
        var i = parseInt(String(m.get('V_ID')).slice(3), 10) - 1001;
        if (up === 'V_STATUS') return { kind: 'toggle', on: i % 3 === 0 };
        if (up === 'V_DATE') return { kind: 'notes', count: i % 4 === 0 ? 1 + (i % 3) : 0 };
        return keepV ? keepV(m, up) : null;
      };
      rclick(fth('V_STATUS')); sub('stats');
      var stT = infoMap();
      R.chk.statsToggle = stT['Checked'] === String(wantOn) && stT['Unchecked'] === String(300 - wantOn);
      closeMenu();
      rclick(fth('V_DATE')); sub('stats');
      var stN = infoMap();
      R.chk.statsNotes = stN['Rows with notes'] === String(wantNotesRows) && stN['Notes'] === String(wantNotes) && stN['Without notes'] === String(300 - wantNotesRows);
      R.info.statsJournal = { toggle: stT, notes: stN, want: [wantOn, wantNotesRows, wantNotes] };
      closeMenu();
      // (2026-10-20, jrnhidden) a journal column counts the rows the filter keeps too: all but the Open rows
      // hidden (as statsFiltered hides them below), the toggle's boxes on the rows left, from the data
      var jVis = 0, jOn = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
        var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
        if (r && r.V_STATUS !== 'Open') tr.classList.add('search-hidden');
        else if (r) { jVis++; if ((parseInt(String(r.V_ID).slice(3), 10) - 1001) % 3 === 0) jOn++; }
      });
      rclick(fth('V_STATUS')); sub('stats');
      var stJ = infoMap();
      R.chk.statsJournalFiltered = jVis > 0 && jVis < 300 && stJ['Checked'] === String(jOn) && stJ['Unchecked'] === String(jVis - jOn);
      R.info.statsJournalFiltered = { got: stJ, want: [jOn, jVis - jOn] };
      closeMenu();
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr.search-hidden'), function (tr) { tr.classList.remove('search-hidden'); });
      P.journalFriendlyCol = keepF; P.journalSearchColumnValue = keepV;
      // the search: rows it hides do not count (marked as the search marks them)
      var openN = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
        var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
        if (r && r.V_STATUS !== 'Open') tr.classList.add('search-hidden'); else if (r) openN++;
      });
      rclick(fth('V_STATUS')); sub('stats');
      var st2 = infoMap();
      R.chk.statsFiltered = openN > 0 && st2['With a value'] === String(openN) && st2['Unique'] === '1' && st2['Empty'] === '0';
      R.info.statsFiltered = { got: st2, open: openN };
      closeMenu();
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr.search-hidden'), function (tr) { tr.classList.remove('search-hidden'); });
      // sort
      await choose(fth('V_NAME'), 'sortAsc');
      R.chk.sortAsc = sorted(colTexts('V_NAME'), 'asc') && !menu();
      rclick(fth('V_NAME'));
      R.chk.sortChecked = !!item('sortAsc') && item('sortAsc').getAttribute('aria-checked') === 'true' && !!item('sortClear')
        && item('sortDesc').getAttribute('aria-checked') === 'false';
      closeMenu();
      await choose(fth('V_NAME'), 'sortDesc');
      R.chk.sortDesc = sorted(colTexts('V_NAME'), 'desc');
      await choose(fth('V_NAME'), 'sortClear');
      R.chk.sortClear = !!A() && A().sortDir('V_NAME') === null && colTexts('V_ID', 1)[0] === 'ID-1001';
      // move right: header, cells, saved, a notice with Undo, no SAVED notice
      // (perf, round 9) the move touches only the moved column's cells: the body's childList
      // mutations, counted (re-appending every cell of every row was ~42 a row here)
      var tbodyEl = document.querySelector('#resultsTable tbody'), rowN = tbodyEl.rows.length;
      var recN = 0, mo = new MutationObserver(function (l) { recN += l.length; });
      mo.observe(tbodyEl, { childList: true, subtree: true });
      await choose(fth('V_NAME'), 'move-right');
      recN += mo.takeRecords().length;
      mo.disconnect();
      R.chk.moveMinimal = recN > 0 && recN <= rowN * 2 + 10;
      R.info.moveRecs = { recs: recN, rows: rowN };
      var o = shownNames();
      R.chk.moveRight = o.join() === ['V_ID', 'V_AMOUNT', 'V_NAME', 'V_DATE', 'V_LINK', 'V_STATUS'].join();
      R.chk.cellsFollow = R.chk.moveRight && rowsOk('V_NAME', 30) && rowsOk('V_AMOUNT', 30);
      var po = prefs().order || [];
      R.chk.saved = po.indexOf('V_NAME') > po.indexOf('V_AMOUNT') && po.indexOf('V_AMOUNT') >= 0;
      R.chk.toastUndo = /Moved/.test(lastToast()) && /pnb-hm-undo/.test(lastToast());
      R.chk.noSavedToast = R.chk.moveRight && document.body.textContent.indexOf('Column layout saved as a local preference') < 0;
      var early = lastToast().indexOf('Ctrl+,') < 0;
      R.info.afterRight = o;
      var ub = document.querySelectorAll('.zz-toast .pnb-hm-undo');
      if (ub.length) ub[ub.length - 1].click();
      await sleep(450);
      R.chk.undo = R.chk.moveRight && ub.length > 0 && shownNames().join() === BASE.join();
      rclick(fth('V_ID')); sub('move');
      R.chk.edgeDisabled = !!item('move-left') && item('move-left').getAttribute('aria-disabled') === 'true' && item('move-start').getAttribute('aria-disabled') === 'true'
        && item('move-right').getAttribute('aria-disabled') !== 'true';
      closeMenu();
      await choose(fth('V_DATE'), 'move-start');
      R.chk.moveStart = shownNames()[0] === 'V_DATE';
      early = early && lastToast().indexOf('Ctrl+,') < 0;
      await choose(fth('V_DATE'), 'move-end');
      var sn = shownNames();
      R.chk.moveEnd = sn[sn.length - 1] === 'V_DATE';
      R.chk.tipNotEarly = early && R.chk.toastUndo && R.chk.moveStart && window.__toasts.length >= 3;
      R.chk.tipThird = lastToast().indexOf('Ctrl+,') >= 0 && /pnb-hm-settings/.test(lastToast()) && /pnb-hm-undo/.test(lastToast());
      try { R.chk.tipStored = localStorage.getItem('penumbra_colmenu_tip') === '1'; } catch (e) { R.chk.tipStored = false; }
      await choose(fth('V_ID'), 'move-right');
      R.chk.tipOnce = /Moved/.test(lastToast()) && lastToast().indexOf('Ctrl+,') < 0;
      var sb = document.querySelectorAll('.zz-toast .pnb-hm-settings');
      if (sb.length) sb[sb.length - 1].click();
      await sleep(500);
      R.chk.tipOpens = document.getElementById('settingsPanel').classList.contains('is-open');
      R.info.toasts = window.__toasts.slice(-4);
      // hide (the Settings panel stays open: its list is rebuilt from the table)
      await choose(fth('V_LINK'), 'hide');
      R.chk.hide = fth('V_LINK').style.display === 'none' && shownNames().indexOf('V_LINK') < 0;
      R.chk.hideSaved = (prefs().visible || ['V_LINK']).indexOf('V_LINK') < 0 && (prefs().visible || []).indexOf('V_ID') >= 0;
      // left steps over a hidden column: V_LINK sits hidden just left of V_STATUS
      var before = shownNames(), i = before.indexOf('V_STATUS');
      await choose(fth('V_STATUS'), 'move-left');
      var after = shownNames(), want = before.slice();
      want.splice(i, 1); want.splice(i - 1, 0, 'V_STATUS');
      R.chk.skipHidden = after.join() === want.join();
      R.info.skip = { before: before, after: after, all: allNames() };
      // show a hidden column here (right of the column the menu is for)
      closeMenu();
      rclick(fth('V_ID'));
      sub('show');
      await sleep(200);
      var labels = subLabels();
      R.chk.showList = labels.indexOf('V_LINK') >= 0 && labels.indexOf('H_NUM') >= 0 && labels.indexOf('Back') < 0 && labels.indexOf('V_NAME') < 0;
      var hn = allItems().filter(function (e) { return e.textContent.trim() === 'H_NUM'; })[0] || null;
      if (hn) hn.click();
      await sleep(500);
      var s2 = shownNames();
      R.chk.showHere = s2.indexOf('H_NUM') === s2.indexOf('V_ID') + 1 && s2.indexOf('H_NUM') > 0;
      R.chk.showFilled = rowsOk('H_NUM', 20);
      // (round 4) Swap...: the other shown columns; the one picked and this one trade places
      var sb0 = shownNames(), si = sb0.indexOf('V_ID'), sj = sb0.indexOf('V_DATE');
      rclick(fth('V_ID'));
      sub('move'); if (item('move-swap')) item('move-swap').click();
      await sleep(150);
      var swHead = anyHead();
      var swLabels = subLabels();
      R.chk.swapList = !!swHead && swHead.textContent === 'Swap places with' && swLabels.indexOf('Back') < 0
        && swLabels.join() === sb0.filter(function (n) { return n !== 'V_ID'; }).join();
      var swItem = allItems().filter(function (e) { return e.textContent.trim() === 'V_DATE'; })[0] || null;
      if (swItem) swItem.click();
      await sleep(500);
      var want = sb0.slice(); want[si] = 'V_DATE'; want[sj] = 'V_ID';
      R.chk.swapDone = si >= 0 && sj >= 0 && shownNames().join() === want.join() && /Swapped/.test(lastToast()) && rowsOk('V_ID', 20) && rowsOk('V_DATE', 20);
      R.info.swap = { before: sb0, after: shownNames(), labels: swLabels };
      // (perf, round 9) several columns moved at once - the first five shown, reversed:
      // each lands before a cell that itself moves, so the moves' order matters
      if (A()) {
        var lr = A().layout(), vis5 = lr.cols.filter(function (c) { return c.visible; }).slice(0, 5).map(function (c) { return c.colName; });
        var rest = lr.cols.filter(function (c) { return vis5.indexOf(c.colName) < 0; });
        var rev = vis5.slice().reverse().map(function (n) { return lr.cols.filter(function (c) { return c.colName === n; })[0]; });
        lr.cols = rev.concat(rest);
        A().applyLayout(lr);
        await sleep(300);
        R.chk.multiMove = shownNames().slice(0, 5).join() === vis5.slice().reverse().join() && vis5.every(function (n) { return rowsOk(n, 30); });
        R.info.multi = { want: vis5.slice().reverse(), got: shownNames().slice(0, 5) };
      }
      // the last column shown cannot be hidden
      if (A()) {
        var l = A().layout();
        l.cols.forEach(function (c) { c.visible = c.colName === 'V_ID'; });
        A().applyLayout(l);
        await sleep(300);
      }
      rclick(fth('V_ID'));
      R.chk.lastNotHidable = !!item('hide') && item('hide').getAttribute('aria-disabled') === 'true';
      closeMenu();
    },
    mkbd: async function () {
      var th = fth('V_NAME');
      if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
      th.focus();
      rclick(th, true);
      var m = menu(), r = th.getBoundingClientRect(), mr = m ? m.getBoundingClientRect() : null;
      R.chk.opensBelow = !!mr && Math.abs(mr.top - r.bottom) <= 2 && Math.abs(mr.left - r.left) <= 2;
      R.info.rect = { th: [r.left, r.bottom], m: mr && [mr.left, mr.top] };
      R.chk.focusFirst = !!m && document.activeElement === m.querySelector('.pnb-hm-item') && document.activeElement.getAttribute('data-act') === 'sortAsc';
      function key(k) { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      key('ArrowDown');
      R.chk.arrowMoves = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'sortDesc';
      key('Enter');
      await sleep(450);
      R.chk.enterRuns = !menu() && !!A() && A().sortDir('V_NAME') === 'desc';
      R.chk.focusBack = R.chk.enterRuns && document.activeElement === fth('V_NAME');
      rclick(fth('V_NAME'), true);
      var had = !!menu();
      key('Escape');
      R.chk.escCloses = had && !menu();
      R.chk.escFocusBack = had && document.activeElement === fth('V_NAME');
      rclick(fth('V_NAME'));
      had = !!menu();
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      R.chk.outsideCloses = had && !menu();
    },
    mopts: async function () {
      // the Settings panel open, its list built: the popover's own Freeze reads that list,
      // so only with it does a header-opened popover have a Freeze to leave out
      document.getElementById('settingsPanel').classList.add('is-open'); window.Penumbra.refreshSettingsColumns();
      await sleep(200);
      var th = fth('V_AMOUNT');
      await choose(th, 'options');
      var pop = document.querySelector('.sp-sumtype-menu.pnb-colopt');
      R.chk.optsPopover = !!pop && !!pop.querySelector('[data-sec="format"]') && !!pop.querySelector('[data-sec="summary"]');
      R.chk.optsTitle = !!pop && pop.textContent.indexOf('V_AMOUNT') >= 0;
      R.chk.optsNoFreeze = !!pop && !pop.querySelector('[data-sec="freeze"]');
      R.chk.optsOpener = th.classList.contains('is-open') && !th.hasAttribute('aria-expanded');
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await sleep(100);
      R.chk.optsCloses = R.chk.optsPopover && !document.querySelector('.sp-sumtype-menu.pnb-colopt') && !th.classList.contains('is-open') && !th.classList.contains('pnb-hm-opener');
      // (round 5) the popover's Back: the column menu again, for the same column
      await choose(th, 'options');
      var bkb = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="back"]');
      if (bkb) bkb.click();
      await sleep(200);
      var bt = menu() && menu().querySelector('.pnb-hm-name');
      R.chk.optsBack = !!bkb && !document.querySelector('.sp-sumtype-menu.pnb-colopt') && !!bt && bt.textContent === 'V_AMOUNT' && !th.classList.contains('is-open');
      closeMenu();
      // freeze: '#' is the first column shown, V_ID the second, V_NAME the third
      rclick(fth('V_NAME'));
      R.chk.freezeItem = !!item('freeze') && /up to this column/.test(item('freeze').textContent);
      if (item('freeze')) item('freeze').click();
      await sleep(400);
      R.chk.freezes = !!A() && A().frozen() === 3 && prefs().frozen === 3;
      rclick(fth('V_ID'));
      R.chk.unfreezeItem = !!item('unfreeze') && !item('freeze');
      if (item('unfreeze')) item('unfreeze').click();
      await sleep(400);
      R.chk.unfreezes = !!A() && A().frozen() === 0;
      rclick(fth('V_STATUS'));
      R.chk.noFreezePast5 = !!menu() && !item('freeze') && !item('unfreeze');
      closeMenu();
      // widths: fit one column to its contents; every width back
      var H = window.Penumbra.colWidthsHost, W = window.Penumbra.colWidths;
      H.setUser('V_AMOUNT', 330); W.apply();
      await sleep(300);
      var w0 = fth('V_AMOUNT').getBoundingClientRect().width;
      rclick(fth('V_AMOUNT'));
      var fitIt = !!reach('fit');   // (round 33) in Column widths, with its resets
      R.chk.fitItem = fitIt && !!item('resetWidths');
      closeMenu(); rclick(fth('V_AMOUNT'));
      if (reach('fit')) item('fit').click();
      await sleep(400);
      var w1 = fth('V_AMOUNT').getBoundingClientRect().width;
      R.chk.fits = w0 >= 320 && w1 < w0 - 40 && H.widthFor('V_AMOUNT') !== 330;
      R.info.widths = [w0, w1];
      // (round 19) the fit's notice offers Undo: the width set before comes back
      R.chk.fitUndo = /fitted to its content/.test(lastToast()) && /pnb-colw-undo/.test(lastToast());
      var fub = document.querySelectorAll('.zz-toast .pnb-colw-undo');
      if (fub.length) fub[fub.length - 1].click();
      await sleep(300);
      R.chk.fitUndone = fub.length > 0 && H.widthFor('V_AMOUNT') === 330;
      // Fit all column widths: every shown column gets a width of its own, Undo takes them back
      var shownN = shownNames().length, before = H.userDiff().slice();
      var ranAll = await choose(fth('V_NAME'), 'fitAll');
      await sleep(400);
      var diffAll = H.userDiff();
      R.chk.fitAll = ranAll && diffAll.length >= Math.min(shownN, 4) && diffAll.length > before.length && /column widths fitted to content/.test(lastToast()) && /pnb-colw-undo/.test(lastToast());
      R.info.fitAll = { shown: shownN, before: before, after: diffAll };
      fub = document.querySelectorAll('.zz-toast .pnb-colw-undo');
      if (fub.length) fub[fub.length - 1].click();
      await sleep(300);
      R.chk.fitAllUndo = ranAll && H.userDiff().slice().sort().join() === before.slice().sort().join();
      // (round 33) Fit to page: every shown column a SHARE of the page ("n%"), the table no wider than
      // its box (no sideways scroll), the notice offers Undo, which puts the widths back
      var wrapB = fth('V_NAME').closest('#results-wrapper');
      var ranPage = await choose(fth('V_NAME'), 'fitPage');
      await sleep(500);
      var uPage = H.state().user, shares = Object.keys(uPage).filter(function (k) { return /%$/.test(String(uPage[k])); });
      R.chk.fitPage = ranPage && shares.length >= Math.min(shownN, 4) && !!wrapB && wrapB.scrollWidth <= wrapB.clientWidth + 1
        && /fitted to the page/.test(lastToast()) && /pnb-colw-undo/.test(lastToast());
      R.info = Object.assign({ fitPage: { ran: ranPage, shares: shares.length, shown: shownN, scroll: wrapB && wrapB.scrollWidth, client: wrapB && wrapB.clientWidth,
        sample: shares.slice(0, 3).map(function (k) { return k + '=' + uPage[k]; }), toast: String(lastToast()).slice(0, 90) } }, R.info);
      fub = document.querySelectorAll('.zz-toast .pnb-colw-undo');
      if (fub.length) fub[fub.length - 1].click();
      await sleep(300);
      R.chk.fitPageUndo = ranPage && H.userDiff().slice().sort().join() === before.slice().sort().join();
      H.setUser('V_NAME', 300); H.setUser('V_DATE', 280); W.apply();
      await sleep(300);
      rclick(fth('V_NAME'));
      sub('width');
      R.chk.resetItem = !!item('resetWidths') && item('resetWidths').getAttribute('aria-disabled') !== 'true';
      if (item('resetWidths')) item('resetWidths').click();
      await sleep(400);
      R.chk.resets = H.userDiff().length === 0 && /widths reset/.test(lastToast());
      // (round 33) a clean slate either way (on a build without the list the reset never ran)
      closeMenu(); H.clearUser(); W.apply();
      await sleep(200);
      // (round 2) Fit MEASURES: a long value shows on ONE line, in full - with rows that
      // grow (the harness's body.disable-auto-expand: the value wraps) and with rows that
      // do not (the base max-width cuts it off)
      async function longFit(mode) {
        document.body.classList.toggle('disable-auto-expand', mode === 'grow');
        H.setUser('V_NAME', null); W.apply();
        await sleep(200);
        var tr = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (x) { return x.offsetParent; })[mode === 'grow' ? 0 : 1];
        var ni = Array.prototype.slice.call(document.querySelectorAll('#resultsTable thead th')).findIndex(function (h) { return h.dataset.colname === 'V_NAME'; });
        var cell = tr && tr.children[ni];
        if (!cell) return { ok: false };
        cell.textContent = new Array(4).join('Long value that runs on and on ');
        await sleep(150);
        var before = { lines: lines(cell), cut: cell.scrollWidth > cell.clientWidth + 1, w: fth('V_NAME').getBoundingClientRect().width };
        rclick(fth('V_NAME'));
        if (reach('fit')) item('fit').click();
        await sleep(500);
        var after = { lines: lines(cell), cut: cell.scrollWidth > cell.clientWidth + 1, w: fth('V_NAME').getBoundingClientRect().width };
        // (round 3) under the cap: rows that grow lay the value out on one line already and
        // the table hands the column spare room - Fit narrows it to the value; rows that do
        // not cut the value off - Fit widens the column until it shows in full
        var ok = mode === 'grow' ? (after.lines === 1 && !after.cut && after.w < before.w - 20)
                                 : (before.cut && after.lines === 1 && !after.cut && after.w > before.w);
        return { ok: ok, before: before, after: after };
      }
      var g1 = await longFit('grow'), c1 = await longFit('cut');
      // (round 3) a value far wider than the view: Fit stops at 60% of the table's visible
      // width (400..1200px), not at the 2000px drag limit
      var capTr = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (x) { return x.offsetParent; })[2];
      var capNi = Array.prototype.slice.call(document.querySelectorAll('#resultsTable thead th')).findIndex(function (h) { return h.dataset.colname === 'V_NAME'; });
      if (capTr && capTr.children[capNi]) capTr.children[capNi].textContent = new Array(31).join('Long value that runs on and on ');
      await sleep(150);
      rclick(fth('V_NAME'));
      if (reach('fit')) item('fit').click();
      await sleep(500);
      var box = fth('V_NAME').closest('#results-wrapper');
      var cap = Math.max(400, Math.min(1200, Math.round((box ? box.clientWidth : window.innerWidth) * 0.6)));
      var capW = fth('V_NAME').getBoundingClientRect().width;
      R.chk.fitCapped = !!box && Math.abs(capW - cap) <= 4;
      R.info.fitCap = { cap: cap, w: capW, box: box && box.clientWidth };
      R.chk.fitsLong = g1.ok;
      R.chk.fitsLongCut = c1.ok;
      R.info.fitLong = { grow: g1, cut: c1 };
    },
    mcalc: async function () {
      await choose(fth('V_NAME'), 'calc-right');
      var dlg = document.getElementById('pnbCalcOverlay');
      R.chk.dialog = !!dlg;
      var fx = document.getElementById('pnbCalcFormula');
      R.chk.seeded = !!fx && fx.value === '{V_NAME}';
      async function add(name, formula) {
        document.getElementById('pnbCalcName').value = name;
        document.getElementById('pnbCalcFormula').value = formula;
        var f = document.getElementById('pnbCalcFmt');
        if (f && f.querySelector('option[value="text"]')) f.value = 'text';
        ['input', 'change'].forEach(function (ty) { document.getElementById('pnbCalcFormula').dispatchEvent(new Event(ty, { bubbles: true })); });
        document.getElementById('pnbCalcGo').click();
        await until(function () { return !!fth(name); }, 20000);
        await sleep(1200);
      }
      if (dlg) await add('NM2', '{V_NAME} & "!"');
      var s = shownNames();
      R.chk.placedRight = s.indexOf('NM2') === s.indexOf('V_NAME') + 1 && s.indexOf('V_NAME') >= 0;
      var po = prefs().order || [];
      R.chk.placeSaved = po.indexOf('NM2') === po.indexOf('V_NAME') + 1 && po.indexOf('NM2') > 0;
      R.info.order = s;
      // (round 21) a calculated column of the viewer's own offers Remove; a plain column does not
      // (2026-10-19, calcadj round 3: the items sit in the Calculated column list - reached through it)
      rclick(fth('V_NAME'));
      var plainHas = !!reach('calcRemove');
      closeMenu();
      rclick(fth('NM2'));
      R.chk.calcRemoveItem = !!fth('NM2') && !!reach('calcRemove') && !plainHas;
      closeMenu();
      var ranRm = await choose(fth('NM2'), 'calcRemove');
      await until(function () { return !fth('NM2'); }, 15000);
      await sleep(400);
      R.chk.calcRemoved = ranRm && !fth('NM2') && !window.PenumbraCalc.active().some(function (d) { return d.name === 'NM2'; }) && /Removed the calculated column/.test(lastToast());
      await choose(fth('V_DATE'), 'calc-start');
      if (document.getElementById('pnbCalcOverlay')) await add('D2', '{V_DATE}');
      R.chk.calcStart = shownNames()[0] === 'D2';
      R.info.order2 = shownNames();
    },
    mgroupby: async function () {
      // (2026-10-19, grpunique) a column whose every row differs (V_ID) asks first; No = no grouping
      var asked = [];
      window.confirm = function (m) { asked.push(String(m)); return false; };
      await choose(fth('V_ID'), 'groupBy');
      await sleep(400);
      R.chk.uniqueAsks = asked.length === 1 && /different V_ID/.test(asked[0]) && !document.body.classList.contains('group-mode-active');
      R.info.asked = asked.slice();
      window.confirm = function (m) { asked.push(String(m)); return true; };
      asked.length = 0;
      rclick(fth('V_STATUS'));
      R.chk.groupItem = !!item('groupBy') && /Group by this column/.test(item('groupBy').textContent);
      if (item('groupBy')) item('groupBy').click();
      await until(function () { return document.body.classList.contains('group-mode-active') && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0; }, 15000);
      await sleep(400);
      R.chk.grouped = !!A() && A().groupingColumn() === 'V_STATUS' && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === 3;
      // ...and a column with repeats is grouped without a question
      R.chk.uniqueQuiet = asked.length === 0;
      // (round 8, calcadj closing sweep) a pick the dialog cannot select (nothing to select: the picker shows
      // its placeholder) must not leave its question behind for the next preset-style grouping (no pointer: no question)
      var alerts = 0; window.alert = function () { alerts++; };
      asked.length = 0;
      window.Penumbra.groupByColumn('');
      await sleep(300);
      $('#groupingColumnSelector .pcs-selected').attr('data-value', 'V_ID');
      $('#confirmGroupingBtn').trigger('click');
      await sleep(800);
      R.chk.stalePickQuiet = alerts === 1 && asked.length === 0;
      R.info.stale = { alerts: alerts, asked: asked.slice(), gcol: A() && A().groupingColumn() };
    },
    gmenu: async function () {
      R.chk.opens = rclick(gth('V_NAME')) && !!menu();
      R.chk.noFreeze = !!menu() && !item('freeze') && !item('unfreeze');
      closeMenu();
      // (round 8) a cell of a group's table: its column's menu, its value first
      var gtd = (function () { var t = gth('V_STATUS'), tb = t && t.closest('table'), k = t ? Array.prototype.indexOf.call(t.parentNode.children, t) : -1, tr = tb && tb.querySelector('tbody tr'); return tr ? tr.children[k] : null; })();
      R.chk.cellGroup = !!gtd && rclick(gtd) && acts()[0] === 'filterMenu' && !!reach('cellFilter') && item('cellFilter').textContent.indexOf('"' + gtd.textContent.trim() + '"') >= 0;
      closeMenu();
      rclick(gth('V_NAME'));
      var _gbI = item('groupBy') || item('groupByList');   // (2026-10-26, delimgroup) or its list, on a column with buckets
      R.chk.groupItems = !!_gbI && /instead/.test(_gbI.textContent) && !!item('ungroup');
      closeMenu();
      function gtables() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer table')).filter(function (t) { return t.querySelector('thead th[data-colname]') && t.querySelector('tbody tr'); }); }
      function tNames(t) { return Array.prototype.filter.call(t.querySelectorAll('thead th[data-colname]'), function (h) { return h.style.display !== 'none' && h.getAttribute('data-column') !== '#'; }).map(function (h) { return h.getAttribute('data-colname'); }); }
      await choose(gth('V_NAME'), 'sortAsc');
      var ts = gtables();
      R.chk.sortsGroups = ts.length > 2 && ts.every(function (t) {
        var i = Array.prototype.slice.call(t.querySelectorAll('thead th')).findIndex(function (h) { return h.getAttribute('data-colname') === 'V_NAME'; });
        var v = Array.prototype.map.call(t.querySelectorAll('tbody tr'), function (tr) { return tr.children[i] ? tr.children[i].textContent.trim() : ''; });
        return i >= 0 && v.every(function (x, j) { return j === 0 || v[j - 1].localeCompare(x) <= 0; });
      });
      // (round 2) Fit in the grouped view measures every group's table: the long value
      // sits in the SECOND group, the menu is opened on the FIRST group's heading
      var t2 = gtables()[1], gi = t2 ? Array.prototype.slice.call(t2.querySelectorAll('thead th')).findIndex(function (h) { return h.getAttribute('data-colname') === 'V_NAME'; }) : -1;
      var gcell = (t2 && gi >= 0) ? t2.querySelector('tbody tr').children[gi] : null;
      if (gcell) gcell.textContent = new Array(4).join('Long value that runs on and on ');
      await sleep(100);
      var gl = gcell ? lines(gcell) : 0, gcut = !!gcell && (gl > 1 || gcell.scrollWidth > gcell.clientWidth + 1);
      rclick(gth('V_NAME'));
      if (reach('fit')) item('fit').click();
      await sleep(600);
      R.chk.fitGroup = gcut && !!gcell && lines(gcell) === 1 && gcell.scrollWidth <= gcell.clientWidth + 1;
      R.info.fitGroup = { linesBefore: gl, linesAfter: gcell && lines(gcell), sw: gcell && gcell.scrollWidth, cw: gcell && gcell.clientWidth };
      var groups = document.querySelectorAll('#groupedResultsContainer .group-wrapper').length;
      await choose(gth('V_NAME'), 'move-right');
      ts = gtables();
      R.chk.moveAll = ts.length > 2 && ts.every(function (t) { var n = tNames(t); return n.indexOf('V_NAME') === n.indexOf('V_AMOUNT') + 1; })
        && shownNames().indexOf('V_NAME') === shownNames().indexOf('V_AMOUNT') + 1;
      R.chk.groupsKept = R.chk.moveAll && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === groups && groups > 2;
      R.info.g = { groups: groups, first: ts[0] && tNames(ts[0]) };
      await choose(gth('V_LINK'), 'hide');
      ts = gtables();
      R.chk.hideAll = ts.length > 2 && ts.every(function (t) { return tNames(t).indexOf('V_LINK') < 0; });
      await choose(gth('V_STATUS'), 'groupBy');
      await until(function () { return !!A() && A().groupingColumn() === 'V_STATUS' && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === 3; }, 15000);
      R.chk.regroup = !!A() && A().groupingColumn() === 'V_STATUS';
      rclick(gth('V_NAME'));
      R.info.ugActs = acts();
      closeMenu();
      var ugOk = await choose(gth('V_NAME'), 'ungroup');
      await until(function () { return !document.body.classList.contains('group-mode-active'); }, 15000);
      R.chk.ungroup = !document.body.classList.contains('group-mode-active') && !!A() && A().groupingColumn() === '';
      R.info.ug = { ok: ugOk, gm: document.body.classList.contains('group-mode-active'), gc: A() && A().groupingColumn(), errs: window.__errors.slice(-3) };
    },
    mrestr: async function () {
      window.penumbra_vars.isAdmin = false;
      window._penumbraHideColumns = true;
      rclick(fth('V_NAME'));
      var a = acts();
      R.chk.sortOnly = a.indexOf('sortAsc') >= 0 && a.indexOf('sortDesc') >= 0;
      R.chk.noLayout = !!menu() && !a.some(function (x) { return /^(move-|calc-)/.test(x) || ['hide', 'show', 'move', 'calc', 'options', 'freeze', 'unfreeze'].indexOf(x) >= 0; });
      R.info.acts = a;
      closeMenu();
    },
    mcopy: async function () {
      function distinctOf(name) {
        var seen = [], set = {};
        Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
          if (tr.classList.contains('search-hidden')) return;
          var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
          if (r && !set[r[name]]) { set[r[name]] = 1; seen.push(r[name]); }
        });
        return seen;
      }
      function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      rclick(fth('V_STATUS'));
      // (2026-10-27, copymenu) Copy distinct values is the Copy list's Distinct values
      R.chk.copyItem = !!item('copyMenu') && item('copyMenu').querySelector('.pnb-hm-label').textContent === 'Copy' && !!reach('copy') && item('copy').querySelector('.pnb-hm-label').textContent === 'Distinct column values';   // (cpsplit) the user's name
      if (item('copy')) item('copy').click();
      await sleep(150);
      var head = anyHead();
      R.chk.copySubmenu = !!head && head.textContent === 'Delimited by' && subActs().indexOf('back') < 0
        && ['copy-space', 'copy-comma', 'copy-semicolon', 'copy-tab', 'copy-newline', 'copy-other'].every(function (a) { return subActs().indexOf(a) >= 0; });
      var kept = $('#copyColumnSelector').val();
      if (item('copy-comma')) item('copy-comma').click();
      await sleep(600);
      R.chk.copyComma = lastClip() === distinctOf('V_STATUS').join(',');
      // a newline cannot sit in the dialog's text box: the menu hands it over
      async function quick(act) { rclick(fth('V_STATUS')); reach(act); await sleep(100); if (item(act)) item(act).click(); await sleep(600); return lastClip(); }   // (2026-10-27, copymenu) through the Copy list
      R.chk.copyNewline = (await quick('copy-newline')) === distinctOf('V_STATUS').join('\n');
      R.chk.copyTab = (await quick('copy-tab')) === distinctOf('V_STATUS').join('\t');
      // only the rows the search keeps
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
        var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
        if (r && r.V_STATUS !== 'Open') tr.classList.add('search-hidden');
      });
      R.chk.copyFiltered = (await quick('copy-semicolon')) === 'Open';
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr.search-hidden'), function (tr) { tr.classList.remove('search-hidden'); });
      // the quick copies leave the dialog's last settings alone: it opens as before
      $('#copyActionsBtn').trigger('click');
      await sleep(400);
      R.chk.copyKeeps = R.chk.copyComma && $('#copyColumnSelector').val() === (kept || '') && $('#copyDelimiterInput').val() === ';';
      R.info.keeps = { sel: $('#copyColumnSelector').val(), kept: kept, delim: $('#copyDelimiterInput').val() };
      $('#copyActionsLightbox').hide();
      // Other...: the dialog on Single Column (Distinct), this column chosen, the box focused
      rclick(fth('V_NAME'));
      reach('copy-other');   // (2026-10-27, copymenu) through the Copy list
      await sleep(100);
      if (item('copy-other')) item('copy-other').click();
      await sleep(500);
      R.chk.copyOther = $('#copyActionsLightbox').is(':visible') && $('input[name="copyFormat"][value="single_col"]').is(':checked')
        && $('#copyColumnSelector').val() === 'V_NAME' && document.activeElement === document.getElementById('copyDelimiterInput');
      R.info.other = { vis: $('#copyActionsLightbox').is(':visible'), sel: $('#copyColumnSelector').val(), act: document.activeElement && document.activeElement.id, clips: window.__clip.slice(-3) };
    },
    mjournal: async function () {
      // (round 6) the REAL journal painter (the harness has no journal: its key, state and
      // toggle are handed to it, as a state landing would) - a toggle and Notes
      var J = '__JOURNAL_TOGGLE__k1', N = '__JOURNAL_NOTES', P = window.Penumbra;
      if (typeof P.journalPaintFor !== 'function') { R.info.jrn = 'no journalPaintFor'; return; }
      window._penumbraJournalKeyColumns = ['V_ID'];
      window._penumbraToggleState = { k1: {} };
      window._penumbraRowNoteCounts = {};
      var TOG = [{ key: 'k1', label: 'Done' }];
      function paint() { P.journalPaintFor(TOG, true); }
      function heads() { return Array.prototype.map.call(document.querySelectorAll('#tableHeader > th'), function (t) { return t.getAttribute('data-column'); }); }
      function aligned(n) {
        var h = heads().join();
        return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr'), 0, n).every(function (tr) {
          return Array.prototype.map.call(tr.children, function (c) { return c.getAttribute('data-column'); }).join() === h;
        });
      }
      paint();
      await sleep(200);
      var h0 = heads();
      R.chk.jrnPainted = h0[1] === J && h0[2] === N && aligned(20);
      // (round 8, calcadj closing sweep) a journal column has no "Group by this column": the grouping picker leaves those out
      var nth = fth(N);
      R.chk.jrnNoGroup = !!nth && rclick(nth) && !!menu() && !item('groupBy') && acts().indexOf('sortAsc') >= 0;
      R.info.jrnNoGroupActs = acts();
      closeMenu();
      // (round 20) a Notes cell (not its button) opens the Notes column's menu, and every
      // cell of a row with a notes button offers the row's notes
      var ntd = document.querySelector('#resultsTable tbody tr td.journal-notes-col'), nbtn = ntd && ntd.querySelector('button.journal-notes-btn');
      var noteClicks = 0;
      // (the harness has no journal key: its buttons are disabled; this row's is enabled for the test)
      if (nbtn) { nbtn.disabled = false; nbtn.addEventListener('click', function (e) { noteClicks++; e.stopImmediatePropagation(); e.preventDefault(); }, true); }
      R.chk.jrnNotesCell = !!ntd && !!nbtn && rclick(ntd) && !!menu() && acts().indexOf('sortAsc') >= 0 && acts().indexOf('addNote') >= 0 && acts().indexOf('cellCopy') < 0;
      R.info.jrnCellActs = acts();
      closeMenu();
      var dtd = ntd ? ntd.parentNode.querySelector('td[data-column="1"]') : null;
      rclick(dtd);
      var hasAdd = !!item('addNote') && /Add a note to this row/.test(item('addNote').textContent);
      closeMenu();
      var ranNote = dtd ? await choose(dtd, 'addNote') : false;
      R.chk.jrnAddNote = hasAdd && ranNote && noteClicks === 1;
      // (2026-10-27, notescroll) from a cell far to the right, the Notes column scrolled out of the table's box sideways:
      // the button is back in the box when it is clicked (the card hides while its button is out of the box)
      var wrapN = ntd ? ntd.closest('#results-wrapper') : null, outBefore = false, inBox = null, ranFar = false;
      if (wrapN && nbtn) {
        var _w0 = wrapN.style.width, _o0 = wrapN.style.overflowX;
        wrapN.style.width = '320px'; wrapN.style.overflowX = 'auto';
        wrapN.scrollLeft = wrapN.scrollWidth;
        var vis = function () { var r = nbtn.getBoundingClientRect(), v = wrapN.getBoundingClientRect(); return r.right > v.left && r.left < v.right; };
        outBefore = !vis();
        var spy = function (e) { if (e.target === nbtn) inBox = vis(); };   // (the document's capture phase: before the button's own stopper)
        document.addEventListener('click', spy, true);
        ranFar = await choose(ntd.parentNode.lastElementChild, 'addNote');
        document.removeEventListener('click', spy, true);
        wrapN.style.width = _w0; wrapN.style.overflowX = _o0; wrapN.scrollLeft = 0;
      }
      R.chk.jrnAddNoteScrolled = outBefore && ranFar && inBox === true;
      R.info.jrnAddNoteScrolled = { wrap: !!wrapN, outBefore: outBefore, ranFar: ranFar, inBox: inBox };
      // (round 21) inside the button itself (its count): the Notes column's menu, with the row's notes
      var inBtn = nbtn && (nbtn.querySelector('.journal-notes-count') || nbtn.querySelector('svg'));
      R.chk.jrnInNote = !!inBtn && rclick(inBtn) && !!menu() && acts().indexOf('addNote') >= 0 && acts().indexOf('sortAsc') >= 0;
      closeMenu();
      R.info.jrnNote = { dtd: !!dtd, hasAdd: hasAdd, ranNote: ranNote, clicks: noteClicks, btnInDoc: !!nbtn && document.contains(nbtn), errs: (window.__errors || []).slice(-2) };
      // moved to the end, it stays there through a repaint
      await choose(fth(J), 'move-end');
      paint();
      await sleep(150);
      var h1 = heads();
      R.chk.jrnMoves = h1[h1.length - 1] === J && aligned(20);
      // ...and with no saved layout to go by (an unsaved query): the heading in the row stays
      try { var _cp = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); var _kept = _cp.lrfix; if (_cp.lrfix) { delete _cp.lrfix.order; } localStorage.setItem('penumbra_column_prefs', JSON.stringify(_cp)); } catch (e) { }
      paint();
      await sleep(150);
      var h1b = heads();
      R.chk.jrnStaysUnsaved = h1b[h1b.length - 1] === J && aligned(20);
      try { if (_kept) { var _cp2 = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); _cp2.lrfix = _kept; localStorage.setItem('penumbra_column_prefs', JSON.stringify(_cp2)); } } catch (e) { }
      // Notes swaps places with V_DATE and stays
      var di = heads().indexOf('3'), ni = heads().indexOf(N);
      rclick(fth(N));
      sub('move'); if (item('move-swap')) item('move-swap').click();
      await sleep(150);
      var sw = allItems().filter(function (e) { return e.textContent.trim() === 'V_DATE'; })[0] || null;
      if (sw) sw.click();
      await sleep(450);
      paint();
      await sleep(150);
      var h2 = heads();
      R.chk.jrnSwap = !!sw && h2.indexOf(N) === di && h2.indexOf('3') === ni && aligned(20);
      // a fresh paint (a reload's: the toggle not there yet) puts it where the saved layout has it
      Array.prototype.forEach.call(document.querySelectorAll('[data-column="' + J + '"]'), function (el) { el.parentNode.removeChild(el); });
      paint();
      await sleep(150);
      var h3 = heads(), po = prefs().order || [];
      R.chk.jrnSaved = po[po.length - 1] === J && h3[h3.length - 1] === J && aligned(20);
      R.info.jrn = { h0: h0, h1: h1, h2: h2, h3: h3, order: po };
    },
    mmore: async function () {
      function visRows() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length; }
      function panelEl() { return document.getElementById('pnbHeadPanel'); }
      function key(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      // Then sort: the next level under the sort already there
      await choose(fth('V_STATUS'), 'sortAsc');
      rclick(fth('V_NAME'));
      R.chk.thenItems = !!item('thenAsc') && !!item('thenDesc') && item('sortAsc').getAttribute('aria-checked') === 'false';
      if (item('thenAsc')) item('thenAsc').click();
      await sleep(600);
      var st = colTexts('V_STATUS', 200), nm = colTexts('V_NAME', 200);
      R.chk.thenSort = !!A() && A().sortKeys().join() === 'V_STATUS,V_NAME' && st.length >= 150
        && st.every(function (v, j) { return j === 0 || st[j - 1].localeCompare(v) <= 0; })
        && nm.every(function (v, j) { return j === 0 || st[j - 1] !== st[j] || nm[j - 1].localeCompare(v) <= 0; });
      // Filter by value: the checklist, its counts, Apply, the box read back, Back, Escape, Clear
      var cnt = {};
      window.__rowsFixture.forEach(function (r) { cnt[r.V_STATUS] = (cnt[r.V_STATUS] || 0) + 1; });
      rclick(fth('V_STATUS'));
      if (item('filter')) item('filter').click();
      await sleep(300);
      var pnl = panelEl(), rowsP = pnl ? Array.prototype.slice.call(pnl.querySelectorAll('.pnb-hp-row')) : [];
      var labels = rowsP.map(function (r) { return r.querySelector('.pnb-hp-v').textContent; });
      R.chk.filterList = labels.join() === 'Closed,Open,Pending' && rowsP.every(function (r) { return r.querySelector('input').checked; })
        && rowsP.every(function (r) { return +r.querySelector('.pnb-hp-n').textContent.replace(/,/g, '') === cnt[r.querySelector('.pnb-hp-v').textContent]; });
      R.info.filter = { labels: labels, n: rowsP.map(function (r) { return r.querySelector('.pnb-hp-n').textContent; }), ch: rowsP.map(function (r) { return r.querySelector('input').checked; }), cnt: cnt };
      if (rowsP[0]) rowsP[0].querySelector('input').click();
      if (pnl) pnl.querySelector('[data-hp="apply"]').click();
      await sleep(900);
      R.info.apply = { search: searchVal(), vis: visRows() };
      R.chk.filterApply = searchVal() === 'V_STATUS = /^(?:Open|Pending)$/' && visRows() === cnt.Open + cnt.Pending && !panelEl();
      rclick(fth('V_STATUS'));
      if (item('filter')) item('filter').click();
      await sleep(300);
      pnl = panelEl();
      var ch = pnl ? Array.prototype.map.call(pnl.querySelectorAll('.pnb-hp-row input'), function (x) { return x.checked; }) : [];
      R.chk.filterReopen = ch.join() === 'false,true,true' && !!(pnl && pnl.querySelector('[data-hp="clear"]'));
      if (pnl) pnl.querySelector('[data-hp="back"]').click();
      await sleep(200);
      var bn = menu() && menu().querySelector('.pnb-hm-name');
      R.chk.filterBack = !panelEl() && !!bn && bn.textContent === 'V_STATUS';
      if (item('filter')) item('filter').click();
      await sleep(300);
      var hadPanel = !!panelEl();
      key('Escape');
      await sleep(100);
      R.chk.filterEsc = hadPanel && !panelEl();
      rclick(fth('V_STATUS'));
      if (item('filter')) item('filter').click();
      await sleep(300);
      var clr = panelEl() && panelEl().querySelector('[data-hp="clear"]');   // (2026-10-20, mutfix) no Clear (m-filterkeep: no filter kept): red, not a crash
      if (clr) clr.click();
      await sleep(900);
      R.chk.filterClear = !!clr && searchVal() === '' && visRows() === 300;
      // (Blank) is offered where cells are empty: H_GROUP is null on every 11th row
      var nulls = window.__rowsFixture.filter(function (r) { return r.H_GROUP === null || r.H_GROUP === undefined || String(r.H_GROUP).trim() === ''; }).length;
      var fb = A() && A().filterInfo ? A().filterInfo('H_GROUP') : null, lastV = fb && fb.values[fb.values.length - 1];
      R.chk.filterBlank = nulls > 0 && !!lastV && lastV.v === '' && lastV.all === nulls;            // Show only this column / Show all columns
      await choose(fth('V_NAME'), 'only');
      R.chk.only = shownNames().join() === 'V_NAME' && /Undo/.test(lastToast());
      rclick(fth('V_NAME')); sub('show');
      var onlyDis = !!item('only') && item('only').getAttribute('aria-disabled') === 'true';
      closeMenu();
      await choose(fth('V_NAME'), 'showAll');
      R.chk.showAll = onlyDis && shownNames().length === 20;
      // (round 33) the Reset list went: one column's width comes back from Column widths' Reset this
      // column's width, with Undo (greyed out on a column with no width of the viewer's own)
      window.Penumbra.colWidthsHost.setUser('V_NAME', null);
      window.Penumbra.colWidthsHost.setUser('V_AMOUNT', 300); window.Penumbra.colWidths.apply();
      await sleep(200);
      rclick(fth('V_NAME')); sub('width');
      var oneOff = !!item('resetWidth') && item('resetWidth').getAttribute('aria-disabled') === 'true';
      closeMenu();
      await choose(fth('V_AMOUNT'), 'resetWidth');
      await sleep(300);
      R.chk.resetCol = oneOff && window.Penumbra.colWidthsHost.widthFor('V_AMOUNT') !== 300 && /width reset/.test(lastToast()) && /pnb-colw-undo/.test(lastToast());
      R.info.reset = { oneOff: oneOff, w: window.Penumbra.colWidthsHost.widthFor('V_AMOUNT'), toast: String(lastToast()).slice(0, 80) };
      // Copy column name
      await choose(fth('V_NAME'), 'copyName');
      await sleep(200);
      R.chk.copyName = window.__clip[window.__clip.length - 1] === 'V_NAME';
    },
    mfitnest: async function () {
      // (round 7) Fit on a nested @@JSON column (H_JSON: 1-3 sub-rows) and a multi-line one
      // (H_NL: two words on two lines, a <br>): measured as they lay out
      var H = window.Penumbra.colWidthsHost, W = window.Penumbra.colWidths;
      var l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_JSON' || c.colName === 'H_NL') c.visible = true; });
      A().applyLayout(l);
      await sleep(500);
      var cv = document.createElement('canvas').getContext('2d');
      function tw(t, font) { cv.font = font; return cv.measureText(String(t).replace(/\s+/g, ' ')).width; }
      function cellsOf(name) {
        var i = hdrIndex(name);
        return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr')).filter(function (tr) { return tr.offsetParent; })
          .map(function (tr) { return tr.children[i]; }).filter(Boolean);
      }
      // Fit's ceiling now (60% of the table's visible width, 400..1200): the old measure, every
      // sub-row's text in one line, ran into it
      function capNow() { var bx = fth('H_JSON').closest('#results-wrapper'); return Math.max(400, Math.min(1200, Math.round((bx ? bx.clientWidth : window.innerWidth) * 0.6))); }      async function fitNested(mode) {
        document.body.classList.toggle('disable-auto-expand', mode === 'grow');
        H.setUser('H_JSON', null); W.apply();
        await sleep(300);
        var cells = cellsOf('H_JSON').slice(0, 60).filter(function (td) { return td.querySelector('.nested-json-container'); });
        // the widest cell's text in ONE line: what Fit measured before round 7
        var concat = 0;
        cells.forEach(function (td) { concat = Math.max(concat, tw(td.textContent, getComputedStyle(td).font)); });
        rclick(fth('H_JSON'));
        if (reach('fit')) item('fit').click();
        await sleep(500);
        var w = fth('H_JSON').getBoundingClientRect().width, vis = [];
        cells.forEach(function (td) { Array.prototype.forEach.call(td.querySelectorAll('.nested-json-row > .nested-json-cell'), function (c) { if (c.offsetParent) vis.push(c); }); });
        var bad = vis.filter(function (c) { return lines(c) !== 1 || c.scrollWidth > c.clientWidth + 1; });
        // ...and tight: the column within a few pixels of what the widest sub-table needs, laid
        // out at its natural width - its columns side by side, or (compact: table-layout fixed)
        // its column count times its widest column
        var need = 0;
        cells.forEach(function (td) {
          var t = td.querySelector('.nested-json-container'), row = t && Array.prototype.filter.call(t.children, function (r) { return r.offsetParent && r.classList.contains('nested-json-row'); })[0];
          if (!t || !row) return;
          var ow = t.style.cssText;
          t.style.setProperty('width', 'max-content', 'important');
          t.style.setProperty('table-layout', 'auto', 'important');
          var cw = Array.prototype.map.call(row.children, function (c) { return c.getBoundingClientRect().width; });
          var nat = mode === 'grow' ? t.getBoundingClientRect().width : cw.length * Math.max.apply(null, cw);
          t.style.cssText = ow;
          need = Math.max(need, nat);
        });
        var cs1 = cells[0] ? getComputedStyle(cells[0]) : null;
        var inner = cells[0] ? cells[0].getBoundingClientRect().width - parseFloat(cs1.paddingLeft) - parseFloat(cs1.paddingRight) : 0;
        var slack = inner - need;        // ...and each sub-table inside its column, not spilling past the cell's edge
        var spill = cells.filter(function (td) { var t = td.querySelector('.nested-json-container'); return t && t.getBoundingClientRect().width > td.getBoundingClientRect().width + 1; });
        return { ok: vis.length > 20 && !bad.length && !spill.length && slack < 40, w: w, need: need, slack: slack, concat: concat, n: vis.length, spill: spill.length,
                 bad: bad.slice(0, 3).map(function (c) { return [c.textContent, c.scrollWidth, c.clientWidth, lines(c)]; }) };
      }
      var g = await fitNested('grow'), c = await fitNested('compact');
      R.chk.nestGrow = g.ok;
      R.chk.nestCompact = c.ok;
      // multi-line: each line stays one line, the column narrower than the lines joined
      document.body.classList.add('disable-auto-expand');
      H.setUser('H_NL', null); W.apply();
      await sleep(300);
      var nl = cellsOf('H_NL').slice(0, 40), concatNl = 0;
      nl.forEach(function (td) { concatNl = Math.max(concatNl, tw(td.textContent, getComputedStyle(td).font)); });
      var cs0 = nl[0] ? getComputedStyle(nl[0]) : null, pad = cs0 ? parseFloat(cs0.paddingLeft) + parseFloat(cs0.paddingRight) : 0;
      rclick(fth('H_NL'));
      if (reach('fit')) item('fit').click();
      await sleep(500);
      var w2 = fth('H_NL').getBoundingClientRect().width;
      R.chk.fitLines = nl.length > 10 && nl.every(function (td) { return lines(td) === 2; }) && w2 < concatNl + pad - 10;
      R.info.fitnest = { grow: g, compact: c, nl: { w: w2, concat: concatNl, pad: pad, lines: nl.slice(0, 5).map(function (td) { return lines(td); }) } };
    },
    mfitnote: async function () {
      // (2026-10-20, notefit; user on jjornl: a double press on the Notes column's edge made it "extra
      // long") The newest note in a Notes cell is a box of its own - 16em and wrapping while rows grow,
      // one line cut at 22em while they do not - and its button sets the icon, the count and the note
      // side by side. Fit gives the column what the button takes laid out, never the note's text on one
      // line; a note let out of its box (overflow visible) spills and shows, so it is measured whole.
      var N = '__JOURNAL_NOTES', P = window.Penumbra, H = P.colWidthsHost, W = P.colWidths;
      if (typeof P.journalPaintFor !== 'function' || typeof P.journalMarkLoadedKey !== 'function') { R.info.fitnote = 'no journal hooks'; return; }
      var LONG = 'ok that sounds good to me -- ok that sounds good to me -- ok that sounds good to me -- ok that sounds good to me';
      var SHORT = ['Call the sponsor back', 'Done', 'Budget sent to the PI'];
      window._penumbraJournalKeyColumns = ['V_ID'];
      P.journalMarkLoadedKey();   // the key the report is saved with: the buttons take notes
      window._penumbraToggleState = {};
      window._penumbraRowNoteCounts = {}; window._penumbraRowNotes = {};
      P.journalPaintFor([], true);
      await sleep(200);
      function btns() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody td.journal-notes-col .journal-notes-btn')).filter(function (b) { return b.offsetParent; }); }
      function pvs() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody td.journal-notes-col .journal-notes-preview')).filter(function (p) { return p.offsetParent; }); }
      var keys = btns().slice(0, 3).map(function (b) { return b.getAttribute('data-row-key'); });
      function notes(texts) {
        window._penumbraRowNoteCounts = {}; window._penumbraRowNotes = {};
        texts.forEach(function (t, i) { window._penumbraRowNoteCounts[keys[i]] = i + 1; window._penumbraRowNotes[keys[i]] = [{ ID: 900 + i, NOTE_TEXT: t }]; });
        P.journalPaintFor([], true);
      }
      function edgeOf(el) { var c = getComputedStyle(el); return parseFloat(c.paddingLeft) + parseFloat(c.paddingRight) + parseFloat(c.borderLeftWidth) + parseFloat(c.borderRightWidth); }
      var cv = document.createElement('canvas').getContext('2d');
      function tw(t, font) { cv.font = font; return cv.measureText(t).width; }
      function r1(x) { return Math.round(x * 10) / 10; }
      // what the widest notes cell takes laid out: the column made far wider than any button
      async function natural() {
        H.setUser(N, 1100); W.apply(); await sleep(250);
        var w = 0;
        pvs().forEach(function (p) { w = Math.max(w, p.closest('.journal-notes-btn').getBoundingClientRect().width + edgeOf(p.closest('td'))); });
        return w;
      }
      // the double press's Fit (the API that and the menu's item both run)
      async function fitNow() {
        H.setUser(N, null); W.apply(); await sleep(200);
        var ok = W.fit(fth(N)); await sleep(400);
        return ok ? fth(N).getBoundingClientRect().width : 0;
      }
      // 1. rows that grow: every note wraps in its 16em box - the column fits the button, the box whole
      notes([LONG, SHORT[0], SHORT[1]]);
      document.body.classList.add('disable-auto-expand');
      await sleep(200);
      var p0 = pvs()[0], font = p0 ? getComputedStyle(p0).font : '', fs = p0 ? parseFloat(getComputedStyle(p0).fontSize) : 0;
      var oneLine = tw(LONG, font);
      var natG = await natural(), wG = await fitNow();
      var pvG = pvs().map(function (p) { return r1(p.getBoundingClientRect().width); });
      R.chk.noteGrow = pvs().length === 3 && natG > 100 && oneLine > natG + 150 && wG >= natG - 0.5 && wG <= natG + 6 && pvG.every(function (x) { return Math.abs(x - 16 * fs) < 1; });
      // 2. consistent height: one line, the long note cut at its 22em, the short ones whole
      document.body.classList.remove('disable-auto-expand');
      await sleep(200);
      var natC = await natural(), wC = await fitNow();
      var pc = pvs(), longC = pc[0] ? pc[0].clientWidth : 0, cutC = pc.slice(1).filter(function (p) { return p.scrollWidth > p.clientWidth + 1; }).length;
      R.chk.noteCompact = pc.length === 3 && natC > 100 && oneLine > natC + 150 && wC >= natC - 0.5 && wC <= natC + 6 && Math.abs(longC - 22 * fs) < 1.5 && !cutC;
      // 3. short notes only: the icon, the count and the note side by side - none cut
      notes(SHORT);
      await sleep(200);
      var natS = await natural(), wS = await fitNow();
      var cutS = pvs().filter(function (p) { return p.scrollWidth > p.clientWidth + 1; }).map(function (p) { return p.textContent + ' ' + p.clientWidth + '/' + p.scrollWidth; });
      R.chk.noteShort = pvs().length === 3 && natS > 60 && wS >= natS - 0.5 && wS <= natS + 6 && !cutS.length;
      // 4. a note let out of its box (overflow visible): it spills past its 22em and shows - measured whole
      notes([LONG, SHORT[0], SHORT[1]]);
      var sp = document.head.appendChild(document.createElement('style'));
      sp.textContent = '#resultsTable td.journal-notes-col .journal-notes-preview { overflow: visible !important; text-overflow: clip !important; }';
      await sleep(200);
      var wP = await fitNow(), q = pvs()[0], tdq = q ? q.closest('td') : null, rg = document.createRange();
      if (q) rg.selectNodeContents(q);
      var textEnd = q ? rg.getBoundingClientRect().right : 0, room = tdq ? tdq.getBoundingClientRect().right - parseFloat(getComputedStyle(tdq).paddingRight) : 0;
      var capP = Math.max(400, Math.min(1200, Math.round((fth(N).closest('#results-wrapper') || document.documentElement).clientWidth * 0.6)));
      R.chk.noteSpill = !!q && wP > 0 && oneLine + 60 < capP && textEnd <= room + 1;
      sp.remove();
      R.info.fitnote = { fs: fs, oneLine: r1(oneLine), grow: { nat: r1(natG), w: r1(wG), pv: pvG }, compact: { nat: r1(natC), w: r1(wC), long: longC, cut: cutC },
        short: { nat: r1(natS), w: r1(wS), cut: cutS }, spill: { w: r1(wP), end: r1(textEnd), room: r1(room), cap: capP }, keys: keys };
    },
    mnest: async function () {
      // (round 23) a nested-table column (H_JSON, @@JSON): no Filter by value, Column stats counts the
      // tables and the rows inside them and lists no values; a right-click on a sub-cell filters to that
      // value in its SUB-column; the cell around the sub-table offers no value items
      var l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = true; });
      A().applyLayout(l);
      await sleep(500);
      var th = fth('H_JSON');
      R.chk.nestOpens = !!th && rclick(th) && !!menu();
      var a0 = acts();
      R.chk.nestNoFilter = a0.indexOf('filter') < 0 && a0.indexOf('stats') >= 0 && a0.indexOf('sortAsc') >= 0;
      sub('stats');
      var inf = infoMap(), withT = window.__rowsFixture.filter(function (r) { return r.H_JSON; }).length;
      var subRows = window.__rowsFixture.reduce(function (t, r) { return t + (r.H_JSON ? JSON.parse(r.H_JSON.substring(6)).length : 0); }, 0);
      R.chk.nestStats = inf['With a table'] === String(withT) && inf['Empty'] === String(300 - withT) && inf['Rows inside the tables'] === subRows.toLocaleString() && !item('stats-top-0') && !inf['Unique'];
      R.info.nest = { acts: a0, inf: inf, withT: withT, subRows: subRows };
      closeMenu();
      // a sub-cell: SUB_NAME in the first nested row of the first row that has a table
      var k = hdrIndex('H_JSON'), td = null, trs = document.querySelectorAll('#resultsTable tbody tr');
      for (var i = 0; i < trs.length && !td; i++) { var c = trs[i].children[k]; if (c && c.querySelector('.nested-json-row .nested-json-cell')) td = c; }
      var hdrCells = td ? td.querySelectorAll('.nested-json-header > *') : [], nameIdx = -1;
      for (var h = 0; h < hdrCells.length; h++) { if (hdrCells[h].textContent.replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim() === 'SUB_NAME') nameIdx = h; }
      var row0 = td ? td.querySelector('.nested-json-row') : null, subCell = (row0 && nameIdx >= 0) ? row0.children[nameIdx] : null, v = subCell ? subCell.textContent.trim() : '';
      R.chk.nestSubOpens = !!subCell && rclick(subCell) && !!menu() && !!reach('cellFilter') && item('cellFilter').textContent.indexOf('"' + v + '"') >= 0 && !item('cellExclude') && !!item('copyMenu') && !!reach('cellCopy');   // (2026-10-27, copymenu) in the Copy list
      R.info.nestSub = { v: v, acts: acts(), nameIdx: nameIdx, hdr: Array.prototype.map.call(hdrCells, function (x) { return x.textContent.trim().slice(0, 12); }) };
      closeMenu(); rclick(subCell); reach('cellFilter');   // (2026-10-27, fltmenu) through the Filter list (the Copy list opened above)
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      var want = window.__rowsFixture.filter(function (r) { return r.H_JSON && JSON.parse(r.H_JSON.substring(6)).some(function (x) { return String(x.SUB_NAME) === v; }); }).length;
      var vis = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length;
      R.chk.nestSubFilter = v !== '' && searchVal() === 'SUB_NAME = //' + v + '//' && vis === want && want > 0;
      R.info.nestFilter = { search: searchVal(), vis: vis, want: want };
      (function (t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); })('');
      await sleep(900);
      // the cell around the sub-table: the column's menu, no value items
      R.chk.nestPadOpens = !!td && rclick(td) && !!menu() && !item('cellFilter') && !item('cellCopy') && acts().indexOf('sortAsc') >= 0
        && !!reach('copyRow') && !item('cellCopy');   // (2026-10-27, copymenu) its Copy list: the row, the column's name, no value
      closeMenu();
      // (round 30) Consistent row height: the panel's switch as a checked item on the nested column
      // (not on a plain one); a pick flips the switch and the body class, the preference with it
      var tg = document.getElementById('spRowExpandToggle'), was = !document.body.classList.contains('disable-auto-expand');
      // (round 31) the panel syncs its checkbox only when it opens: a stale checkbox must not mislead the item
      if (tg) { tg.checked = !was; }
      rclick(th);
      var rhItem = item('rowHeight');
      R.chk.nestRowHeight = !!tg && !!rhItem && rhItem.getAttribute('aria-checked') === String(was) && tg.checked === was;
      closeMenu();
      rclick(fth('V_NAME'));
      R.chk.nestRowHeightPlain = !!menu() && !!item('rowHeight');   // (round 33) every column's menu carries it
      closeMenu();
      var flipped = await choose(th, 'rowHeight');
      R.chk.nestRowHeightFlips = flipped && !!tg && tg.checked === !was && document.body.classList.contains('disable-auto-expand') === was
        && rclick(th) && item('rowHeight').getAttribute('aria-checked') === String(!was);
      R.info.rowHeight = { was: was, now: tg && tg.checked, cls: document.body.classList.contains('disable-auto-expand') };
      closeMenu();
      if (tg && tg.checked !== was) { await choose(th, 'rowHeight'); }
      // (round 24) a sub-cell that is a LINK (fi-epa-c's resolver links): a right-click on the link
      // opens the menu, Filter to its text, Copy this value; (round 25) no link items of our own,
      // a footer names the way to the browser's menu; a header's menu has no footer
      var subId = (row0 && hdrCells.length) ? row0.children[0] : null, idText = subId ? subId.textContent.trim() : '';
      if (subId) { subId.innerHTML = '<a href="https://example.test/x?id=' + encodeURIComponent(idText) + '">' + idText + '</a>'; }
      var lnk = subId ? subId.querySelector('a') : null;
      R.chk.nestLinkOpens = !!lnk && rclick(lnk) && !!menu() && !!reach('cellFilter') && item('cellFilter').textContent.indexOf('"' + idText + '"') >= 0
        && !!reach('cellCopy') && !item('cellOpenLink') && !item('cellCopyLink');   // (2026-10-27, copymenu) in the Copy list
      var foot = menu() && menu().querySelector('.pnb-hm-foot');
      R.chk.nestLinkFoot = !!foot && /Shift\+right-click/.test(foot.textContent);
      R.info.nestLink = { idText: idText, acts: acts(), foot: foot && foot.textContent };
      closeMenu();
      rclick(fth('V_NAME'));
      R.chk.nestNoFoot = !!menu() && !menu().querySelector('.pnb-hm-foot');
      closeMenu();
      // (round 25) the browser's own menu: Shift with the right-click is not intercepted; a second
      // right-click on the same spot while ours is open (the right button's mousedown closes it)
      // is not either; a right-click on ANOTHER heading while ours is open opens ours there
      function rclickS(el) { var r = el.getBoundingClientRect(); return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, shiftKey: true, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) })); }
      function mdown(el) { var r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) })); }
      var thN = fth('V_NAME'), thS = fth('V_STATUS');
      R.chk.nativeShift = !rclickS(thN) && !menu();
      var open1 = rclick(thN) && !!menu();
      mdown(thN); var second = rclick(thN);
      R.chk.nativeSecond = open1 && !second && !menu();
      var open2 = rclick(thN) && !!menu();
      mdown(thS); var other = rclick(thS);
      R.chk.nativeOther = open2 && other && !!menu() && menu().querySelector('.pnb-hm-name').textContent === 'V_STATUS';
      R.info.native = { open1: open1, second: second, open2: open2, other: other };
      closeMenu();
      // a cell too: the second right-click on the same cell steps aside
      var c0 = document.querySelector('#resultsTable tbody tr td[data-column]:not([data-column="#"])');
      var copen = !!c0 && rclick(c0) && !!menu(); if (c0) { mdown(c0); }
      R.chk.nativeSecondCell = copen && !!c0 && !rclick(c0) && !menu();
      closeMenu();
      rclick(lnk); reach('cellFilter'); if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      var vis2 = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length;
      var want2 = window.__rowsFixture.filter(function (r) { return r.H_JSON && JSON.parse(r.H_JSON.substring(6)).some(function (x) { return String(x.SUB_ID) === idText; }); }).length;
      R.chk.nestLinkFilter = searchVal() === 'SUB_ID = //' + idText + '//' && vis2 === want2 && want2 > 0;
      R.info.nestLinkFilter = { search: searchVal(), vis: vis2, want: want2 };
      (function (t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); })('');
      await sleep(900);
    },
    mcell: async function () {
      // (round 8) the cell menu
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return tr.style.display !== 'none' && !tr.classList.contains('search-hidden'); }); }
      function visRows() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length; }
      function cellAt(name, i) { var k = hdrIndex(name), tr = visTrs()[i || 0]; return tr ? tr.children[k] : null; }
      function setSearch(t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); }
      var cnt = {};
      window.__rowsFixture.forEach(function (r) { cnt[r.V_STATUS] = (cnt[r.V_STATUS] || 0) + 1; });
      var c0 = cellAt('V_STATUS', 0), v0 = c0.textContent.trim();
      var prevented = rclick(c0), a = acts();
      // (2026-10-27, fltmenu) the Filter list first (Filter to, Exclude in it), then Copy
      R.chk.cellOpens = prevented && !!menu() && a[0] === 'filterMenu' && a[1] === 'copyMenu' && !!reach('cellFilter') && subActs()[1] === 'cellExclude'
        && item('cellFilter').textContent.indexOf('"' + v0 + '"') >= 0 && c0.classList.contains('pnb-hm-cell')
        && menu().querySelector('.pnb-hm-name').textContent === 'V_STATUS' && a.indexOf('sortAsc') > 1;
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      R.chk.cellFilter = searchVal() === 'V_STATUS = /^(?:' + v0 + ')$/' && visRows() === cnt[v0] && !c0.classList.contains('pnb-hm-cell');
      // a second value of the column joins the first (its cells are filtered out now: the call itself)
      var other = ['Open', 'Closed', 'Pending'].filter(function (x) { return x !== v0; })[0];
      A().filterAdd('V_STATUS', other, false);
      await sleep(900);
      R.chk.cellAdd = searchVal() === 'V_STATUS = /^(?:' + v0 + '|' + other + ')$/' && visRows() === cnt[v0] + cnt[other];
      setSearch('');
      await sleep(900);
      var c1 = cellAt('V_STATUS', 0), v1 = c1.textContent.trim();
      rclick(c1); reach('cellExclude');
      if (item('cellExclude')) item('cellExclude').click();
      await sleep(900);
      R.chk.cellExclude = searchVal() === 'V_STATUS != /^(?:' + v1 + ')$/' && visRows() === 300 - cnt[v1];
      setSearch('');
      await sleep(900);
      // Copy this value: the text the cell shows
      var c2 = cellAt('V_NAME', 1);
      rclick(c2);
      reach('cellCopy');   // (2026-10-27, copymenu) through the Copy list
      if (item('cellCopy')) item('cellCopy').click();
      await sleep(300);
      R.chk.cellCopy = window.__clip[window.__clip.length - 1] === c2.innerText.trim();
      // a formatted amount filters by its VALUE
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      await sleep(300);
      var c3 = cellAt('V_AMOUNT', 2), shown = c3.textContent.trim(), raw = c3.getAttribute('data-pnb-raw');
      rclick(c3); reach('cellFilter');
      var rawLbl = item('cellFilter') ? item('cellFilter').textContent : '';
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      var same = window.__rowsFixture.filter(function (r) { return r.V_AMOUNT === raw; }).length;
      // (cfmt2, 2026-10-30, the user) the item names the value as SHOWN ($51,361), the filter keeps the stored one
      R.chk.cellRaw = !!raw && shown !== raw && rawLbl.indexOf(shown) >= 0 && rawLbl.indexOf(raw) < 0 && same > 0 && visRows() === same;
      R.info.raw = { shown: shown, raw: raw, lbl: rawLbl, box: searchVal(), vis: visRows() };
      setSearch('');
      await sleep(900);
      // an empty cell: Filter to blanks (H_GROUP is null on every 11th row)
      var l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_GROUP') c.visible = true; });
      A().applyLayout(l);
      await sleep(500);
      var gk = hdrIndex('H_GROUP'), blankTd = null;
      visTrs().some(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1]; if (r && (r.H_GROUP === null || r.H_GROUP === undefined)) { blankTd = tr.children[gk]; return true; } return false; });
      var nulls = window.__rowsFixture.filter(function (r) { return r.H_GROUP === null || r.H_GROUP === undefined; }).length;
      rclick(blankTd); reach('cellFilter');
      var bl = item('cellFilter') ? item('cellFilter').textContent : '';
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      R.chk.cellBlank = !!blankTd && /Filter to blanks/.test(bl) && searchVal() === 'H_GROUP = /^(?:)$/' && visRows() === nulls;
      setSearch('');
      await sleep(900);
      // the browser's menu stays for a link and selected text; (round 20) a '#' cell opens the
      // '#' column's menu, without a value of its own
      var trs = visTrs(), num = trs[0].cells[0], link = trs[0].querySelector('td a');
      var nmTd = cellAt('V_NAME', 4), rg = document.createRange();
      var nativeNum = rclick(num) && !!menu() && acts().indexOf('cellCopy') < 0 && acts().indexOf('sortAsc') >= 0;
      closeMenu();
      var nativeLink = !!link && !rclick(link) && !menu();
      rg.selectNodeContents(nmTd); window.getSelection().removeAllRanges(); window.getSelection().addRange(rg);
      var nativeSel = !rclick(nmTd) && !menu();
      window.getSelection().removeAllRanges();
      R.chk.cellNatives = nativeNum && nativeLink && nativeSel;
      R.info.natives = [nativeNum, nativeLink, nativeSel];
      // from the keyboard: under the cell, and back to it on Escape
      var c4 = cellAt('V_NAME', 3);
      if (!c4.hasAttribute('tabindex')) c4.setAttribute('tabindex', '-1');
      c4.focus();
      rclick(c4, true);
      var mr = menu() ? menu().getBoundingClientRect() : null, cr = c4.getBoundingClientRect();
      // under the cell - or, the menu taller than the room below, lifted to end at the window's foot
      var under = !!mr && Math.abs(mr.left - cr.left) <= 2 && (Math.abs(mr.top - cr.bottom) <= 2 || Math.abs(mr.bottom - (window.innerHeight - 4)) <= 2);
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      R.chk.cellKbd = under && !menu() && document.activeElement === c4;
      R.info.kbd = { under: under, mr: mr && [mr.left, mr.top], cr: [cr.left, cr.bottom], open: !!menu(), act: document.activeElement && (document.activeElement.tagName + '.' + document.activeElement.className), same: document.activeElement === c4 };
    },
    mperf: async function () {
      // (perf) one Move right of V_NAME on a big report, timed: the call itself, and to the
      // next frame. run.py with PNB_PROFILE=<file> records a CPU profile of exactly this.
      window.__PERF_READY = true;
      await until(function () { return window.__PERF_GO; }, 120000);
      var l = A().layout(), i = -1;
      l.cols.forEach(function (c, k) { if (c.colName === 'V_NAME') i = k; });
      var it = l.cols.splice(i, 1)[0];
      l.cols.splice(i + 1, 0, it);
      var t0 = performance.now();
      A().applyLayout(l);
      var t1 = performance.now();
      await new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); });
      var t2 = performance.now();
      R.info.perf = { sync: Math.round(t1 - t0), toFrame: Math.round(t2 - t0), rows: document.querySelectorAll('#resultsTable tbody tr').length,
        cells: document.querySelectorAll('#resultsTable tbody td').length, order: shownNames().slice(0, 4) };
      R.chk.done = shownNames()[2] === 'V_NAME';
    },
    msubs: async function () {
      // (round 12, 13) the menu reorganized: the top level, and the lists beside an item
      var H = window.Penumbra.colWidthsHost, W = window.Penumbra.colWidths;
      H.setUser('V_DATE', 280); W.apply();
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'number:1');
      await sleep(300);
      function key(k) { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      function over(el) { if (el) el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true })); }
      rclick(fth('V_NAME'));
      var a = acts(), want = ['sortAsc', 'sortDesc', 'copyMenu', 'filter', 'stats', 'width', 'rowHeight', 'options', 'move', 'show', 'hide', 'freeze', 'calc', 'groupBy', 'clearPrefs'];   // (copymenu 3) Copy above Filter by value...   // (round 33) the sizes up the menu, one clear-all item at its foot; (2026-10-27, copymenu) Copy
      var pos = want.map(function (x) { return (x === 'groupBy' && a.indexOf(x) < 0) ? a.indexOf('groupByList') : a.indexOf(x); });   // (delimgroup) or its list
      R.chk.topOrder = pos.every(function (p, i) { return p >= 0 && (i === 0 || p > pos[i - 1]); })
        && menu().querySelectorAll('.pnb-hm-sep').length === 4 && ['move-left', 'only', 'reset', 'resetAll', 'resets', 'fit', 'fitAll', 'stats-top-0', 'pivot', 'chart', 'copy-comma', 'copy', 'copyName'].every(function (x) { return a.indexOf(x) < 0; });
      R.chk.noChips = !menu().querySelector('.pnb-hm-row');
      var subs = ['move', 'show', 'copyMenu', 'calc', 'width'];   // (2026-10-27, copymenu) Copy, the copies' list
      R.chk.arrows = subs.every(function (x) { return !!item(x) && !!item(x).querySelector('.pnb-hm-arrow') && item(x).getAttribute('aria-haspopup') === 'menu' && item(x).getAttribute('aria-expanded') === 'false'; })
        && !!item('hide') && !item('hide').querySelector('.pnb-hm-arrow');   // (2026-10-27, copymenu) a plain item, no arrow (Copy column name is in the Copy list)
      var showNote = item('show').querySelector('.pnb-hm-note');
      R.chk.showLabel = item('show').querySelector('.pnb-hm-label').textContent === 'Show column(s)' && !!showNote && /^\d+ hidden$/.test(showNote.textContent)
        && item('move').querySelector('.pnb-hm-label').textContent === 'Move column' && !!item('copyMenu') && item('copyMenu').querySelector('.pnb-hm-label').textContent === 'Copy';   // (2026-10-27, copymenu; no crash where there is none)
      R.info.top = a;
      // a click on the item: its list beside it, the menu still there, the item marked
      sub('move');
      var sp = subPanel(), mr = menu().getBoundingClientRect(), ir = item('move').getBoundingClientRect(), sr = sp ? sp.getBoundingClientRect() : null;
      var ma = subActs(), ml = subLabels();
      R.chk.moveList = !!sp && ma.indexOf('back') < 0 && ['move-left', 'move-right', 'move-start', 'move-end', 'move-swap'].every(function (x) { return ma.indexOf(x) >= 0; })
        && ml.indexOf('To the start') >= 0 && ml.indexOf('To the end') >= 0 && ml.indexOf('Swap with...') >= 0 && !!item('move-swap').querySelector('.pnb-hm-arrow')
        && !!menu() && !!item('sortAsc') && item('move').getAttribute('aria-expanded') === 'true';
      R.chk.flyPos = !!sr && Math.abs(sr.left - (mr.right - 2)) <= 2 && Math.abs(sr.top - (ir.top - 5)) <= 3;
      R.info.fly = sr ? { sub: [sr.left, sr.top], menu: [mr.right, mr.top], item: [ir.left, ir.top] } : null;
      // a third level: Swap with... beside the Move list, on hover
      over(item('move-swap'));
      await sleep(350);
      R.chk.nested = document.querySelectorAll('.pnb-hm-sub').length === 2 && !!anyHead() && anyHead().textContent === 'Swap places with'
        && subLabels().indexOf('V_ID') >= 0 && subLabels().indexOf('V_NAME') < 0;
      // hover: another item with a list switches the list; one without closes it
      over(item('show'));
      await sleep(450);
      var sa = subActs(), head = anyHead();
      R.chk.hoverSwitch = document.querySelectorAll('.pnb-hm-sub').length === 1 && sa.indexOf('only') >= 0 && sa.indexOf('move-left') < 0
        && item('move').getAttribute('aria-expanded') === 'false' && item('show').getAttribute('aria-expanded') === 'true';
      R.chk.showList = sa.indexOf('back') < 0 && sa.indexOf('show-0') >= 0 && sa.indexOf('only') >= 0 && sa.indexOf('showAll') >= 0 && !!head && head.textContent === 'Show a hidden column here'
        && subLabels().indexOf('H_NUM') >= 0 && subLabels().indexOf('Show only this column') >= 0 && subLabels().indexOf('Show all columns') >= 0;
      over(item('hide'));
      await sleep(450);
      R.chk.hoverCloses = !subPanel() && !!menu() && item('show').getAttribute('aria-expanded') === 'false';
      over(item('calc'));
      await sleep(350);
      var ca = subActs(), cl = subLabels();
      R.chk.hoverOpens = !!subPanel() && ca.indexOf('calc-left') >= 0;
      R.chk.calcList = ca.indexOf('back') < 0 && ['calc-left', 'calc-right', 'calc-start', 'calc-end'].every(function (x) { return ca.indexOf(x) >= 0; }) && cl.indexOf('At the start') >= 0;
      closeMenu(); rclick(fth('V_NAME')); reach('copy'); sub('copy');   // (2026-10-27, copymenu) through the Copy list
      var pa = subActs();
      R.chk.copyList = pa.indexOf('back') < 0 && pa.indexOf('copyName') < 0 && ['copy-space', 'copy-comma', 'copy-newline', 'copy-other'].every(function (x) { return pa.indexOf(x) >= 0; })
        && !!anyHead() && anyHead().textContent === 'Delimited by' && menu().querySelector('.pnb-hm-name').textContent === 'V_NAME';
      // (round 33) Column widths: one list (this column, every column, the page, the resets); the Reset
      // list became one item at the foot, Clear all customizations...
      closeMenu(); rclick(fth('V_NAME')); sub('width');
      var ra = subActs(), rl = subLabels(), clearIt = item('clearPrefs');
      R.chk.resetList = ra.indexOf('back') < 0 && ['fit', 'fitAll', 'fitPage', 'resetWidth', 'resetWidths'].every(function (x) { return ra.indexOf(x) >= 0; })
        && rl.indexOf('Fit this column width to contents') >= 0 && rl.indexOf('Fit all column widths to contents') >= 0 && rl.indexOf('Fit all column widths to page') >= 0 && rl.indexOf("Reset this column's width") >= 0 && rl.indexOf('Reset all column widths') >= 0
        && !!clearIt && clearIt.querySelector('.pnb-hm-label').textContent === 'Clear all customizations...' && !clearIt.querySelector('.pnb-hm-arrow');
      R.info.lists = { move: ma, show: sa, calc: ca, copy: pa, reset: ra };
      // Clear all custom preferences: the Settings panel's button, clicked - its confirm
      // lists what is saved (the format set above), and a No leaves it all in place
      var asked = [], clicks = 0, btn = document.getElementById('spClearStorage');
      if (btn) btn.addEventListener('click', function () { clicks++; });
      var oc = window.confirm;
      window.confirm = function (m) { asked.push(String(m)); return false; };
      var ran = await choose(fth('V_NAME'), 'clearPrefs');
      await sleep(300);
      window.confirm = oc;
      var kept = prefs();
      R.chk.clearPanel = ran && clicks === 1 && asked.length === 1 && /Column options/.test(asked[0]) && /Column widths/.test(asked[0])
        && !!(kept.colopt && kept.colopt.V_AMOUNT) && H.widthFor('V_DATE') === 280;
      R.info.clear = { ran: ran, clicks: clicks, asked: asked.map(function (x) { return x.slice(0, 200); }) };
      // the keyboard: ArrowRight opens the list and enters it, ArrowLeft comes back, Escape
      // closes all of it; so does a click outside
      var th = fth('V_NAME');
      if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
      closeMenu(); rclick(th, true);
      item('move').focus();
      key('ArrowRight');
      await sleep(50);
      R.chk.kbdOpens = !!subPanel() && document.activeElement === item('move-left') && document.activeElement.closest('.pnb-hm-sub') === subPanel();
      key('ArrowDown');
      var downStays = document.activeElement === item('move-right');
      key('ArrowLeft');
      await sleep(50);
      R.chk.kbdBack = downStays && !subPanel() && document.activeElement === item('move') && !!menu();
      key('ArrowRight');
      await sleep(50);
      var hadSub = !!subPanel();
      key('Escape');
      R.chk.escAll = hadSub && !menu() && !document.querySelector('.pnb-hm-sub') && document.activeElement === th;
      rclick(th); sub('move'); sub('move-swap');
      hadSub = document.querySelectorAll('.pnb-hm-sub').length === 2;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      R.chk.outsideAll = hadSub && !menu() && !document.querySelector('.pnb-hm-sub');
    },
    mreset: async function () {
      // (round 11) Reset all columns: every column back to the report's, with an Undo
      var H = window.Penumbra.colWidthsHost, W = window.Penumbra.colWidths;
      function off() { var it = item('resetAll'); return !!it && it.getAttribute('aria-disabled') === 'true'; }
      // the Undo of the Reset all notice itself (an older notice's would stand in for it)
      function ub() {
        var b = Array.prototype.filter.call(document.querySelectorAll('.zz-toast .pnb-hm-undo'), function (x) { return /Reset all columns/.test(x.parentNode.textContent) && !x.disabled; });
        return b.length ? b[b.length - 1] : null;
      }
      var BASE_SHOWN = shownNames(), BASE_ALL = allNames(), F0 = A().frozen();
      rclick(fth('V_NAME')); sub('resets');
      R.chk.raItem = !!item('resetAll');
      R.chk.raOffClean = off();
      closeMenu();
      // the viewer's changes: a move, a hide, a hidden column shown, a format, shading,
      // a summary, a width and a Freeze
      await choose(fth('V_NAME'), 'move-end');
      await choose(fth('V_DATE'), 'hide');
      var l = A().layout(), hcol = l.cols.filter(function (c) { return !c.visible; })[0];
      hcol.visible = true;
      A().applyLayout(l);
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'number:1');
      window.Penumbra.setColOpt('V_AMOUNT', 'shade', 'bar');
      window.Penumbra.setColSummary('V_AMOUNT', 'avg');
      H.setUser('V_STATUS', 300); W.apply();
      A().setFrozen(2);
      await sleep(300);
      var C_SHOWN = shownNames(), C_ALL = allNames(), p1 = prefs();
      R.info.custom = { shown: C_SHOWN, hid: hcol.colName, prefs: p1, frozen: A().frozen(), f0: F0 };
      var setUp = C_SHOWN.join() !== BASE_SHOWN.join() && p1.colopt && p1.colopt.V_AMOUNT && p1.shade && p1.shade.V_AMOUNT === 'bar'
        && p1.summaries && p1.summaries.V_AMOUNT === 'avg' && H.widthFor('V_STATUS') === 300 && A().frozen() === 2;
      rclick(fth('V_ID')); sub('resets');
      R.chk.raOnCustom = setUp && !!item('resetAll') && !off();
      closeMenu();
      // Reset all
      var ran = await choose(fth('V_ID'), 'resetAll');
      await sleep(400);
      var p2 = prefs();
      R.info.reset = { ran: ran, shown: shownNames(), all: allNames().slice(0, 8), prefs: p2, frozen: A().frozen(), w: H.widthFor('V_STATUS'), toast: lastToast().slice(0, 200) };
      R.chk.raLayout = ran && shownNames().join() === BASE_SHOWN.join() && allNames().join() === BASE_ALL.join();
      R.chk.raCells = R.chk.raLayout && rowsOk('V_NAME', 30) && rowsOk('V_AMOUNT', 30) && rowsOk('V_DATE', 30);
      R.chk.raPref = ran && !p2.order && !p2.visible;
      R.chk.raFmt = ran && !(p2.colopt && p2.colopt.V_AMOUNT);
      R.chk.raShade = ran && !(p2.shade && p2.shade.V_AMOUNT);
      R.chk.raSum = ran && !(p2.summaries && p2.summaries.V_AMOUNT);
      R.chk.raWidth = ran && H.userDiff().length === 0 && H.widthFor('V_STATUS') !== 300;
      R.chk.raFreeze = ran && A().frozen() === F0 && typeof p2.frozen !== 'number';
      R.chk.raToast = /Reset all columns/.test(lastToast()) && /pnb-hm-undo/.test(lastToast());
      rclick(fth('V_ID')); sub('resets');
      R.chk.raOffAfter = ran && off();
      closeMenu();
      // Undo: all of it back
      var b = ub();
      if (b) b.click();
      b = ran && !!b;
      await sleep(500);
      var p3 = prefs();
      R.info.undo = { shown: shownNames(), prefs: p3, frozen: A().frozen(), w: H.widthFor('V_STATUS') };
      R.chk.unLayout = !!b && shownNames().join() === C_SHOWN.join() && allNames().join() === C_ALL.join();
      R.chk.unCells = R.chk.unLayout && rowsOk('V_NAME', 30) && rowsOk(hcol.colName, 30);
      R.chk.unFmt = !!b && !!(p3.colopt && p3.colopt.V_AMOUNT && p3.colopt.V_AMOUNT.fmt === 'number:1');
      R.chk.unShade = !!b && !!(p3.shade && p3.shade.V_AMOUNT === 'bar');
      R.chk.unSum = !!b && !!(p3.summaries && p3.summaries.V_AMOUNT === 'avg');
      R.chk.unWidth = !!b && H.widthFor('V_STATUS') === 300;
      R.chk.unFreeze = !!b && A().frozen() === 2;
      // a format alone: Reset all and its Undo leave the layout following the report
      await choose(fth('V_ID'), 'resetAll');
      await sleep(300);
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'number:2');
      await sleep(100);
      var ran2 = await choose(fth('V_ID'), 'resetAll');
      await sleep(300);
      var fmtGone = !(prefs().colopt && prefs().colopt.V_AMOUNT);
      b = ub();
      if (b) b.click();
      b = ran2 && !!b;
      await sleep(400);
      var p4 = prefs();
      R.chk.unFmtOnly = ran2 && fmtGone && !!b && !p4.order && !p4.visible && !!(p4.colopt && p4.colopt.V_AMOUNT && p4.colopt.V_AMOUNT.fmt === 'number:2')
        && shownNames().join() === BASE_SHOWN.join();
      R.info.fmtOnly = { ran2: ran2, fmtGone: fmtGone, prefs: p4 };
    },
    mbucket: async function () {
      // (round 16) Filter by value's Ranges for a currency column: about six ranges with
      // their counts, an unbroken span written as the low and high bound, open ends, Clear
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }); }
      function visRows() { return visTrs().length; }
      function panelEl() { return document.getElementById('pnbHeadPanel'); }
      function rowsP() { var p = panelEl(); return p ? Array.prototype.slice.call(p.querySelectorAll('.pnb-hp-row')) : []; }
      function num(t) { var x = String(t).replace(/[$,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(x) ? parseFloat(x) : null; }
      function visAmounts() { return visTrs().map(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1]; return r ? num(r.V_AMOUNT) : null; }); }
      function key(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      async function openFilter(name) { closeMenu(); rclick(fth(name)); if (item('filter')) item('filter').click(); await sleep(300); return panelEl(); }
      var pnl = await openFilter('V_AMOUNT');
      var modes = pnl ? pnl.querySelectorAll('.pnb-hp-mode') : [], mr = pnl && pnl.querySelector('[data-hp="mode-ranges"]');
      R.chk.bkModes = modes.length === 2 && !!mr && mr.getAttribute('aria-selected') === 'true' && pnl.querySelector('[data-hp="find"]').style.display === 'none';
      if (modes.length !== 2) {   // (the control: live has no Ranges) the text column's panel alone
        key('Escape');
        pnl = await openFilter('V_NAME');
        R.chk.bkText = !!pnl && !pnl.querySelector('.pnb-hp-mode') && rowsP().length > 20;
        key('Escape');
        return;
      }
      var rp = rowsP(), labels = rp.map(function (r) { return r.querySelector('.pnb-hp-v').textContent; });
      var counts = rp.map(function (r) { return +r.querySelector('.pnb-hp-n').textContent.replace(/,/g, ''); }), total = counts.reduce(function (a, b) { return a + b; }, 0);
      R.chk.bkList = rp.length >= 4 && rp.length <= 9 && labels.every(function (l) { return l.indexOf('$') >= 0; }) && /^Under /.test(labels[0]) && / and over$/.test(labels[labels.length - 1])
        && labels.slice(1, -1).every(function (l) { return / to under /.test(l); }) && total === 300 && rp.every(function (r) { return r.querySelector('input').checked; });
      R.info.buckets = { labels: labels, counts: counts };
      // Values a click away, and back
      pnl.querySelector('[data-hp="mode-values"]').click();
      await sleep(100);
      R.chk.bkValues = rowsP().length > 20 && panelEl().querySelector('[data-hp="find"]').style.display !== 'none' && panelEl().querySelector('[data-hp="mode-values"]').getAttribute('aria-selected') === 'true';
      pnl.querySelector('[data-hp="mode-ranges"]').click();
      await sleep(100);
      // a span: the 2nd and 3rd ranges -> a low and a high bound; the rows within them
      rp = rowsP();
      rp.forEach(function (r, i) { var cb = r.querySelector('input'); if (cb.checked !== (i === 1 || i === 2)) cb.click(); });
      var apply = panelEl().querySelector('[data-hp="apply"]'), okApply = !apply.disabled;
      apply.click();
      await sleep(900);
      var sv = searchVal(), m = /^V_AMOUNT >= (\S+) and V_AMOUNT <= (\S+)$/.exec(sv), va = visAmounts();
      R.chk.bkApply = okApply && !!m && visRows() === counts[1] + counts[2] && va.length > 0
        && va.every(function (x) { return x !== null && x >= parseFloat(m[1]) && x <= parseFloat(m[2]); }) && !panelEl();
      R.info.apply = { search: sv, vis: visRows(), want: counts[1] + counts[2] };
      // reopened: Ranges, the two ticked, Clear offered
      pnl = await openFilter('V_AMOUNT');
      rp = rowsP();
      R.chk.bkReopen = !!pnl && pnl.querySelector('[data-hp="mode-ranges"]').getAttribute('aria-selected') === 'true'
        && rp.map(function (r) { return r.querySelector('input').checked; }).join() === rp.map(function (r, i) { return i === 1 || i === 2; }).join() && !!pnl.querySelector('[data-hp="clear"]');
      // a gap (the 2nd and 4th): Apply off, the note says so
      if (rp.length < 4) return;   // (2026-10-20, mutfix) fewer than four ranges (mutant k-step): the checks below need them - red, not a crash
      rp[2].querySelector('input').click();
      rp[3].querySelector('input').click();
      await sleep(50);
      R.chk.bkGap = panelEl().querySelector('[data-hp="apply"]').disabled && /unbroken/.test(panelEl().querySelector('[data-hp="note"]').textContent);
      // the lowest range alone: an open low end
      rp.forEach(function (r, i) { var cb = r.querySelector('input'); if (cb.checked !== (i === 0)) cb.click(); });
      panelEl().querySelector('[data-hp="apply"]').click();
      await sleep(900);
      var sv2 = searchVal(), hi = /^V_AMOUNT <= (\S+)$/.exec(sv2);
      R.chk.bkOpenEnd = !!hi && visRows() === counts[0] && visAmounts().every(function (x) { return x !== null && x <= parseFloat(hi[1]); });
      R.info.openEnd = { search: sv2, vis: visRows(), want: counts[0] };
      // Clear filter: the box empty, every row back
      pnl = await openFilter('V_AMOUNT');
      var cl = pnl && pnl.querySelector('[data-hp="clear"]');
      if (cl) cl.click();
      await sleep(900);
      R.chk.bkClear = !!cl && searchVal() === '' && visRows() === 300;
      // a text column: no Ranges
      pnl = await openFilter('V_NAME');
      R.chk.bkText = !!pnl && !pnl.querySelector('.pnb-hp-mode') && rowsP().length > 20;
      key('Escape');
      await sleep(100);
      // (round 19) a date column: by year or by month, the bounds ISO days, the rows within
      function iso(t) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t).trim()); return m ? m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : null; }
      function visDates() { return visTrs().map(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1]; return r ? iso(r.V_DATE) : null; }); }
      pnl = await openFilter('V_DATE');
      var dmodes = pnl ? pnl.querySelectorAll('.pnb-hp-mode') : [], dmr = pnl && pnl.querySelector('[data-hp="mode-ranges"]');
      if (!dmr) { R.chk.dtModes = false; key('Escape'); return; }   // (the control: live has no date Ranges)
      dmr.click();
      await sleep(100);
      rp = rowsP();
      var dl = rp.map(function (r) { return r.querySelector('.pnb-hp-v').textContent; }), dc = rp.map(function (r) { return +r.querySelector('.pnb-hp-n').textContent.replace(/,/g, ''); });
      R.chk.dtModes = dmodes.length === 2 && rp.length >= 2;
      R.chk.dtList = dl.every(function (l) { return /^(\d{4}|[A-Z][a-z]{2} \d{4})$/.test(l); }) && dc.reduce(function (a, b) { return a + b; }, 0) === 300 && dl.join() === dl.slice().join();
      R.info.dates = { labels: dl, counts: dc };
      // (round 20) the dates by fiscal year (July to June, named by the year it ends in) and by month
      function fyOf(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return 'FY' + (m >= 7 ? y + 1 : y); }
      var wantFy = {};
      window.__rowsFixture.forEach(function (r) { var d = iso(r.V_DATE); if (d) wantFy[fyOf(d)] = (wantFy[fyOf(d)] || 0) + 1; });
      var ub = panelEl().querySelector('.pnb-hp-unit[data-unit="fy"]');
      if (ub) ub.click();
      await sleep(100);
      var fl = rowsP().map(function (r) { return r.querySelector('.pnb-hp-v').textContent; }), fc = rowsP().map(function (r) { return +r.querySelector('.pnb-hp-n').textContent.replace(/,/g, ''); });
      var fyOk = fl.length === Object.keys(wantFy).length && fl.every(function (l, i) { return /^FY\d{4}$/.test(l) && wantFy[l] === fc[i]; });
      var mb = panelEl().querySelector('.pnb-hp-unit[data-unit="month"]');
      if (mb) mb.click();
      await sleep(100);
      var ml = rowsP().map(function (r) { return r.querySelector('.pnb-hp-v').textContent; });
      R.chk.dtUnits = !!ub && !!mb && fyOk && ub.getAttribute('aria-pressed') === 'false' && mb.getAttribute('aria-pressed') === 'true' && ml.every(function (l) { return /^[A-Z][a-z]{2} \d{4}$/.test(l); });
      R.info.fy = { labels: fl, counts: fc, want: wantFy };
      var yb = panelEl().querySelector('.pnb-hp-unit[data-unit="year"]');   // back to the yearly list the span below is picked from
      if (yb) yb.click();
      await sleep(100);
      rp = rowsP();
      dl = rp.map(function (r) { return r.querySelector('.pnb-hp-v').textContent; }); dc = rp.map(function (r) { return +r.querySelector('.pnb-hp-n').textContent.replace(/,/g, ''); });
      var pick = rp.length >= 4 ? [1, 2] : [0];
      rp.forEach(function (r, i) { var cb = r.querySelector('input'); if (cb.checked !== (pick.indexOf(i) >= 0)) cb.click(); });
      panelEl().querySelector('[data-hp="apply"]').click();
      await sleep(900);
      var dsv = searchVal(), dm = pick.length === 2 ? /^V_DATE >= (\d{4}-\d{2}-\d{2}) and V_DATE <= (\d{4}-\d{2}-\d{2})$/.exec(dsv) : /^V_DATE <= (\d{4}-\d{2}-\d{2})$/.exec(dsv);
      var dwant = pick.reduce(function (a, i) { return a + dc[i]; }, 0), vd = visDates();
      var lo = dm ? (pick.length === 2 ? dm[1] : '0000') : null, hi = dm ? (pick.length === 2 ? dm[2] : dm[1]) : null;
      R.chk.dtApply = !!dm && visRows() === dwant && vd.length > 0 && vd.every(function (d) { return d !== null && d >= lo && d <= hi; });
      R.info.dapply = { search: dsv, vis: visRows(), want: dwant };
      pnl = await openFilter('V_DATE');
      var dcl = pnl && pnl.querySelector('[data-hp="clear"]');
      var reT = rowsP().map(function (r) { return r.querySelector('input').checked; }), reL = rowsP().map(function (r) { return r.querySelector('.pnb-hp-v').textContent; });
      var reTicked = reT.join() === rp.map(function (r, i) { return pick.indexOf(i) >= 0; }).join();
      var reBk = A().filterBuckets ? A().filterBuckets('V_DATE') : null;
      if (dcl) dcl.click();
      await sleep(900);
      R.chk.dtClear = !!dcl && reTicked && searchVal() === '' && visRows() === 300;
      R.info = Object.assign({ dclear: { reTicked: reTicked, ticks: reT, labels: reL, range: reBk && reBk.range, unit: reBk && reBk.unit, pick: pick } }, R.info);
    },
    mnum: async function () {
      // (round 20) the '#' column: a short menu on its heading and cells - sort, hide the row
      // numbers (Show column(s) offers them back), freeze, Fit all, Reset
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none'; }); }
      function firstNum() { var tr = visTrs()[0]; return tr ? parseInt(tr.cells[0].textContent, 10) : NaN; }
      var th = document.querySelector('#tableHeader th[data-column="#"]');
      R.chk.numOpens = !!th && rclick(th) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === '# (Row Number)' && !menu().querySelector('.pnb-hm-stats');
      var a = acts();
      R.chk.numItems = ['sortAsc', 'sortDesc', 'hide', 'freeze', 'show', 'width', 'rowHeight', 'clearPrefs'].every(function (x) { return a.indexOf(x) >= 0; })
        && ['move', 'options', 'copy', 'copyName', 'calc', 'groupBy', 'filter', 'fit', 'fitAll', 'resets', 'cellCopy', 'cellFilter'].every(function (x) { return a.indexOf(x) < 0; })
        && item('hide').querySelector('.pnb-hm-label').textContent === 'Hide the row numbers';
      R.info.numActs = a;
      sub('width');
      var nw = subActs();
      R.chk.numResets = ['fitAll', 'fitPage', 'resetWidths'].every(function (x) { return nw.indexOf(x) >= 0; }) && nw.indexOf('fit') < 0 && nw.indexOf('resetWidth') < 0 && !!item('clearPrefs');
      closeMenu();
      var n0 = firstNum();
      await choose(th, 'sortDesc');
      var sortedDesc = A().sortDir('#') === 'desc' && firstNum() === 300;
      await choose(th, 'sortClear');
      R.chk.numSort = n0 === 1 && sortedDesc && A().sortDir('#') === null && firstNum() === 1;
      await choose(th, 'hide');
      R.chk.numHide = th.style.display === 'none' && !A().layout().num.visible && /row numbers/.test(lastToast()) && /pnb-hm-undo/.test(lastToast());
      rclick(fth('V_NAME')); sub('show');
      R.chk.numShowItem = !!item('show-num') && /\d+ hidden/.test(item('show') ? item('show').querySelector('.pnb-hm-note').textContent : '');
      if (item('show-num')) item('show-num').click();
      await sleep(400);
      R.chk.numShown = R.chk.numHide && th.style.display !== 'none' && !!A().layout().num.visible;
      var td = visTrs()[0].cells[0];
      R.chk.numCell = rclick(td) && !!menu() && acts().indexOf('cellCopy') < 0 && acts().indexOf('cellFilter') < 0 && acts().indexOf('sortAsc') >= 0
        && menu().querySelector('.pnb-hm-name').textContent === '# (Row Number)';
      closeMenu();
    },
    mload: async function () {
      // (round 10, load perf) a context-less list of ids is found id by id: the same elements,
      // in document order, as the selector engine finds
      var fx = document.createElement('div');
      fx.innerHTML = '<div id="mlA" class="k"><span class="x">1</span><b class="x y">2</b></div>' +
        '<div id="mlB"><i class="x">3</i><p><span class="x">4</span></p></div><div id="mlC" class="k"></div>';
      document.body.appendChild(fx);
      function same(sel) {
        var a = $(sel).toArray(), b = Array.prototype.slice.call(document.querySelectorAll(sel));
        return a.length === b.length && a.every(function (e, i) { return e === b[i]; });
      }
      function hits() { return jQuery.fn.init.fastHits || 0; }
      var fastSels = ['#mlA, #mlB', '#mlB, #mlA', '#mlA, #mlNope, #mlC', '#mlA .x, #mlB .x', '#mlA > .x, #mlB > .x',
        '#mlB .x, #mlA, #mlA .y', '#mlA,#mlB,#mlC', '#mlA, #mlA'];
      var h0 = hits(), ok = fastSels.map(same);
      R.chk.idSame = ok.every(Boolean);
      R.chk.idFast = hits() - h0 === fastSels.length;
      // what the native engine cannot read (jQuery's own pseudos) or another shape: the usual road
      var slowSels = ['#mlA .x:visible, #mlB', '#mlA .x:first, #mlB', '#mlA :not(.y), #mlB', '.k, #mlB', '#mlA ~ div, #mlC'];
      var h1 = hits();
      var slowOk = [$('#mlA .x:visible, #mlB').length === 3, $('#mlA .x:first, #mlB').length === 2,
        same('#mlA :not(.y), #mlB'), same('.k, #mlB'), same('#mlA ~ div, #mlC')];
      R.chk.idFallback = slowOk.every(Boolean) && hits() === h1;
      document.getElementById('mlB').remove();
      R.chk.idDynamic = $('#mlA, #mlB').length === 1 && $('#mlA, #mlB')[0] === document.getElementById('mlA');
      R.info.idlist = { same: ok, slow: slowOk, fast: hits() - h0 };
      fx.remove();
      // the editor's refresh after a run waits until a hidden editor is shown
      // (the harness's SQL editor, put in a box of its own, hidden)
      var cmEl = Array.prototype.filter.call(document.querySelectorAll('.CodeMirror'), function (e) { return e.CodeMirror && e.CodeMirror.getTextArea().id === 'sqlQuery'; })[0];
      var cm = cmEl && cmEl.CodeMirror;
      R.chk.edExists = !!cm;
      if (!cm) return;
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:0;left:0;width:400px;height:120px;z-index:99999;display:none';
      document.body.appendChild(box);   // (out of the harness's hidden form)
      box.appendChild(cmEl);
      var n = 0, orig = cm.refresh;
      cm.refresh = function () { n++; return orig.apply(this, arguments); };
      async function rerun() {
        var q0 = window.__queryDone;
        document.getElementById('executeQuery').click();
        await until(function () { return window.__queryDone > q0; }, 30000);
        await sleep(400);
      }
      await rerun();
      var nHidden = n;
      R.chk.edHiddenSkip = nHidden === 0;
      await rerun();
      var nHidden2 = n;
      box.style.display = '';
      await sleep(400);
      var nShown = n;
      R.chk.edShownRefresh = nShown - nHidden2 === 1;
      await rerun();
      var nNow = n;
      R.chk.edShownNow = nNow - nShown === 1;
      // hidden for a run (a wait), then shown off the screen for the next: that run refreshes
      // it and the wait is dropped - coming on screen later does not refresh it again
      box.style.display = 'none';
      await rerun();
      box.style.top = '5000px';
      box.style.display = '';
      await rerun();
      var nOff = n;
      box.style.top = '0px';
      await sleep(400);
      R.chk.edShownOnce = nOff - nNow === 1 && n === nOff;
      R.info.ed = { hidden: nHidden, hidden2: nHidden2, shown: nShown, now: nNow, off: nOff, after: n };
    },
    mrerun: async function () {
      // (perf) the report's query run again on a big report (mperf's fixture: ?scn=mrerun uses it
      // too), profiled under PNB_PROFILE: the teardown of the old table and the build of the new
      window.__PERF_READY = true;
      await until(function () { return window.__PERF_GO; }, 120000);
      var q0 = window.__queryDone, h0 = window.__HC_HIDES || 0, t0 = performance.now();
      document.getElementById('executeQuery').click();
      await until(function () { return window.__queryDone > q0 && (window.__HC_HIDES || 0) > h0; }, 120000);
      var t1 = performance.now();
      await new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); });
      R.info.perf = { rerun: Math.round(t1 - t0), toFrame: Math.round(performance.now() - t0), rows: document.querySelectorAll('#resultsTable tbody tr').length };
      R.chk.done = document.querySelectorAll('#resultsTable tbody tr').length > 1000;
    },
    // (2026-10-20, grpauto) a grouping that names no layout takes one from its size: up to 8
    // groups at the top level Stacked, more List - decided once, at the click; a chosen
    // layout sticks until the grouping ends. (The grouping list module is loaded: mauto*.)
    mauto: async function () {
      var rows = window.__rowsFixture, cnt = {};
      rows.forEach(function (r) { cnt[r.V_NAME] = (cnt[r.V_NAME] || 0) + 1; });
      var names = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); });
      // 1. few groups (V_STATUS: 3) from the header menu: Stacked
      await choose(fth('V_STATUS'), 'groupBy');
      var ok1 = await groupedBy('V_STATUS', 3);
      await sleep(300);
      R.chk.autoFew = ok1 && L() === 'stacked' && !glOn();
      // 2. ungrouped, the same column again groups (the old guard read a variable an ungroup leaves behind)
      await flat();
      await choose(fth('V_STATUS'), 'groupBy');
      R.chk.sameAgain = await groupedBy('V_STATUS', 3);
      await flat();
      // 3. many groups (V_NAME): List, the List layer on, and the notice saying so
      try { localStorage.removeItem('penumbra_grpauto_tip'); } catch (e) { }
      window.__toasts.length = 0;
      await choose(fth('V_NAME'), 'groupBy');
      var ok3 = await groupedBy('V_NAME', names.length);
      await sleep(500);
      R.chk.autoMany = ok3 && names.length > 8 && L() === 'list' && glOn();
      function tips() { return window.__toasts.filter(function (t) { return t.indexOf('groups, so they are listed on the left') >= 0; }); }
      var t1 = tips();
      R.chk.tipShown = t1.length === 1 && t1[0].indexOf(names.length.toLocaleString() + ' groups') >= 0 && localStorage.getItem('penumbra_grpauto_tip') === '1';
      // 4. no one chose List: a one-click regroup decides again (V_STATUS: Stacked)
      var wasList = L() === 'list';
      var okr = await oneClick('V_STATUS', 3);
      R.chk.redecides = wasList && okr && L() === 'stacked' && !glOn();
      // ...and many again: List, without a second notice
      var okm = await oneClick('V_NAME', names.length);
      await sleep(300);
      R.chk.tipOnce = okm && L() === 'list' && glOn() && tips().length === 1;
      // 5. a layout chosen from the group menu sticks through a one-click regroup...
      await oneClick('V_STATUS', 3);
      var sw = !!bandEl('Open') && await choose(bandEl('Open'), 'gList');
      await sleep(300);
      var listed = sw && L() === 'list' && glOn();
      var okc = await oneClick('H_GROUP', 6);
      R.chk.chosenSticks = listed && okc && L() === 'list' && glOn();
      // ...until the grouping is removed: grouped again from the dialog (its Layout left alone - a
      // one-click grouping from flat decides anyway), a one-click regroup decides again
      await flat();
      $('#groupTableBtn').trigger('click'); await sleep(400);
      $('#confirmGroupingBtn').trigger('click');
      var okd = await groupedBy('H_GROUP', 6); await sleep(300);
      // (H_CODE, not V_NAME: on live the next step's V_NAME grouping, right after an ungroup of
      // V_NAME, would meet the old "already grouped by it" bug and keep the guard below from guarding)
      var codes = {}; rows.forEach(function (r) { codes[r.H_CODE] = 1; });
      var oku = await oneClick('H_CODE', Object.keys(codes).length);
      R.chk.ungroupResets = R.chk.chosenSticks && okd && oku && Object.keys(codes).length > 8 && L() === 'list' && glOn();
      $('#groupingLightbox').hide();
      await flat();
      // 6. what is DRAWN decides: the filter leaves 8 names - Stacked; 9 - List
      function only(n) { return 'V_NAME = /^(?:' + names.slice(0, n).join('|') + ')$/'; }
      function rowsOf(n) { return names.slice(0, n).reduce(function (s, k) { return s + cnt[k]; }, 0); }
      function flatShown() { return document.querySelectorAll('#resultsTable tbody tr:not(.search-hidden)').length; }
      snipAction('search', only(8));
      await until(function () { return flatShown() === rowsOf(8); }, 10000);
      var ok8 = await oneClick('V_NAME', 8);
      R.chk.boundary8 = ok8 && L() === 'stacked';
      await flat();
      snipAction('search', only(9));
      await until(function () { return flatShown() === rowsOf(9); }, 10000);
      var ok9 = await oneClick('V_NAME', 9);
      R.chk.boundary9 = ok9 && L() === 'list';
      // ...decided once: the filter narrowed to 8 groups while grouped does not switch it back
      // (the grouped search only hides groups: one filtered out before grouping is never built)
      snipAction('search', only(8));
      await until(function () { return topKeys().length === 8; }, 10000);
      await sleep(400);
      R.chk.filterNoFlip = ok9 && topKeys().length === 8 && L() === 'list';
      await flat();
      snipAction('search', '');
      await until(function () { return flatShown() === 300; }, 10000);
      // 7. a limit left in the form (a cancelled dialog, a grouping since removed) is not applied
      $('#groupLimitN').val('2'); $('#groupLimitOther').prop('checked', true);
      var oks = await oneClick('H_GROUP', 6);
      R.chk.staleForm = oks && topKeys().length === 6 && !document.querySelector('#groupedResultsContainer > .group-wrapper[data-group-other]');
      R.info.auto = { names: names.length, L: L(), tops: topKeys().length, levels: levelsNow(), tips: tips().length, ok: [ok1, ok3, okr, okm, sw, okc, oku, ok8, ok9, oks] };
    },
    // (2026-10-20, grpauto) the dialog and the snippet triggers: what counts as a choice
    mauto2: async function () {
      var seen = {}; window.__rowsFixture.forEach(function (r) { seen[r.V_NAME] = 1; });
      var nN = Object.keys(seen).length;
      // 1. a dialog Apply that leaves the Layout radio alone chooses nothing: the count still decides
      await choose(fth('V_NAME'), 'groupBy');
      await groupedBy('V_NAME', nN); await sleep(300);
      var wasList = L() === 'list';
      $('#groupTableBtn').trigger('click'); await sleep(400);
      $('#confirmGroupingBtn').trigger('click'); await sleep(900);
      var okd = await oneClick('H_GROUP', 6);
      R.chk.dialogKeepsAuto = wasList && okd && L() === 'stacked';
      $('#groupingLightbox').hide();
      // 2. ...a pick on the radio is a choice, even of the layout already on screen
      await oneClick('V_NAME', nN);
      var wasList2 = L() === 'list';
      $('#groupTableBtn').trigger('click'); await sleep(400);
      var rS = document.querySelector('#groupLayoutRow input[value="stacked"]'), rL = document.querySelector('#groupLayoutRow input[value="list"]');
      if (rS) rS.click();
      if (rL) rL.click();
      $('#confirmGroupingBtn').trigger('click'); await sleep(900);
      var okp = await oneClick('H_GROUP', 6);
      R.chk.radioPickSticks = wasList2 && okp && L() === 'list';
      $('#groupingLightbox').hide();
      await flat();
      // 3. a snippet's bare group_by names no layout: the layout on screen stays (Stacked from flat)
      snipAction('trigger', 'group_by|V_NAME');
      var okt = await groupedBy('V_NAME', nN); await sleep(300);
      R.chk.triggerBare = okt && L() === 'stacked';
      await flat();
      // 4. a trigger naming the layout on screen makes it a choice: a one-click regroup keeps it
      await oneClick('V_NAME', nN);
      var wasAuto = L() === 'list';
      snipAction('trigger', 'group_by|V_NAME|layout=list');
      await sleep(900);
      var okn = await oneClick('H_GROUP', 6);
      R.chk.triggerNamedSticks = wasAuto && okn && L() === 'list';
      // 5. (sweep) a radio picked in a dialog closed without Apply is not a later trigger's choice
      await flat();
      $('#groupTableBtn').trigger('click'); await sleep(400);
      var rL2 = document.querySelector('#groupLayoutRow input[value="list"]');
      if (rL2) rL2.click();
      $('#groupingLightbox').hide();
      snipAction('trigger', 'group_by|V_STATUS');
      var okc2 = await groupedBy('V_STATUS', 3); await sleep(300);
      var okc3 = await oneClick('V_NAME', nN);
      R.chk.cancelledPick = !!rL2 && okc2 && okc3 && L() === 'list';
      // 6. (sweep) a window too narrow for List: the count says List, the reader sees Stacked - Stacked is kept
      await flat();
      // (innerWidth is the window's OWN property: deleting the stand-in leaves none at all - put the real one back)
      var iw0 = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      Object.defineProperty(window, 'innerWidth', { configurable: true, get: function () { return 800; } });
      var okw = await oneClick('V_NAME', nN);
      R.chk.narrowStacked = okw && L() === 'stacked' && !glOn();
      if (iw0) { Object.defineProperty(window, 'innerWidth', iw0); } else { delete window.innerWidth; }
      // 7. (sweep 2) a layout set without a pick (a preset, a restore - here the field, then Apply):
      // List is a choice, the default Stacked is not, as a saved view's layout reads
      await flat();
      var okv = await oneClick('V_NAME', nN);
      var wasL = L() === 'list';
      $('#groupLayout').val('stacked');
      $('#confirmGroupingBtn').trigger('click');
      await sleep(700);
      var wasS = L() === 'stacked';
      var codes = {}; window.__rowsFixture.forEach(function (r) { codes[r.H_CODE] = 1; });
      var okk = await oneClick('H_CODE', Object.keys(codes).length);
      R.chk.implicitStacked = okv && wasL && wasS && okk && L() === 'list';
      R.info.auto2 = { L: L(), chosen: !!GM() && GM().chosen(), ok: [wasList, okd, wasList2, okp, okt, wasAuto, okn, okc2, okc3, okw, okv, wasL, wasS, okk], w: window.innerWidth };
    },
    // (2026-10-20, grpmenu) a group's own menu on its band, Stacked (g*: grouped by H_GROUP, every level open)
    ggmenu: async function () {
      var G = GM();
      var hd = bandEl('North');
      R.chk.gmOpens = !!hd && rclick(hd) && !!menu();
      var nm = menu() && menu().querySelector('.pnb-hm-name'), st = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.gmTitle = !!nm && nm.textContent === 'North' && !!st && st.textContent === 'H_GROUP';
      var a = acts();
      R.chk.gmItems = ['gToggle', 'gOnly', 'gHide', 'gCopyName', 'gBy', 'gAdd', 'gSort', 'gConfigure', 'gUngroup', 'gList', 'gExpandAll', 'gCollapseAll'].every(function (x) { return a.indexOf(x) >= 0; })
        && a.indexOf('gRemoveLevel') < 0 && a.indexOf('gStacked') < 0 && !!item('gBy') && item('gBy').textContent.indexOf('Group by') >= 0;
      R.chk.gmMarked = !!hd && getComputedStyle(hd).outlineStyle === 'solid';
      R.info.gmActs = a;
      closeMenu();
      R.chk.gmUnmarked = R.chk.gmMarked && !hd.classList.contains('pnb-hm-for');
      // open / close the group
      var w = gw('North');
      await choose(bandEl('North'), 'gToggle');
      R.chk.gmToggle = !!w && !w.classList.contains('open');
      await choose(bandEl('North'), 'gToggle');
      R.chk.gmToggleBack = R.chk.gmToggle && w.classList.contains('open');
      // copy its name
      await choose(bandEl('East'), 'gCopyName');
      await sleep(100);
      R.chk.gmCopy = window.__clip[window.__clip.length - 1] === 'East';
      // show only this group: its condition in the filter box, the others gone
      await choose(bandEl('North'), 'gOnly');
      await until(function () { return topKeys().length === 1; }, 10000);
      R.chk.gmOnly = searchVal().indexOf('H_GROUP = /^(?:North)$/') >= 0 && topKeys().join() === 'North';
      // ...in place of the column's values already in the box
      snipAction('search', 'H_GROUP = /^(?:North|South)$/');
      await until(function () { return topKeys().length === 2; }, 10000);
      await choose(bandEl('South'), 'gOnly');
      await until(function () { return topKeys().length === 1; }, 10000);
      R.chk.gmOnlyReplaces = topKeys().join() === 'South' && searchVal().indexOf('North') < 0;
      // ...and [Blank], the empty value
      snipAction('search', '');
      await until(function () { return topKeys().length === 6; }, 10000);
      await choose(bandEl('[Blank]'), 'gOnly');
      await until(function () { return topKeys().length === 1; }, 10000);
      R.chk.gmOnlyBlank = topKeys().join() === '[Blank]' && searchVal().indexOf('H_GROUP = /^(?:)$/') >= 0;
      snipAction('search', '');
      await until(function () { return topKeys().length === 6; }, 10000);
      // hide it: the band's x
      await choose(bandEl('South'), 'gHide');
      await until(function () { return topKeys().indexOf('South') < 0; }, 10000);
      R.chk.gmHide = topKeys().length === 5 && topKeys().indexOf('South') < 0 && /H_GROUP != ["']South["']/.test(searchVal());
      snipAction('search', '');
      await until(function () { return topKeys().length === 6; }, 10000);
      // sort the groups: most items first; the order in force is the grouping's
      function size(k) { var x = gw(k); return x ? x.querySelectorAll('tbody tr:not(.search-hidden)').length : -1; }
      await chooseIn(bandEl('North'), 'gSort', 'gsort-count-desc');
      var ks = topKeys(), sz = ks.map(size), i0 = (G && gw(ks[0])) ? G.info(gw(ks[0])) : null;
      R.chk.gmSort = ks.length === 6 && sz.every(function (s, i) { return i === 0 || sz[i - 1] >= s; }) && !!i0 && i0.sort.key === 'count' && i0.sort.dir === 'desc';
      // the list ticks the order in force; the summary orders only with a summary
      rclick(bandEl('North')); sub('gSort');
      var on = document.querySelector('.pnb-hm-sub [data-act="gsort-count-desc"]');
      R.chk.gmSortList = subActs().join() === 'gsort-label-asc,gsort-label-desc,gsort-count-asc,gsort-count-desc' && !!on && on.getAttribute('aria-checked') === 'true';
      closeMenu();
      // with a summary, the All groups bar stays AFTER the groups (the in-place sort sent it to the top)
      snipAction('trigger', 'group_by|H_GROUP|H_AMT|sum');
      await until(function () { return !!document.querySelector('#groupedResultsContainer > .group-grand-total') && tops().length === 6; }, 15000);
      await sleep(400);
      await chooseIn(bandEl('North'), 'gSort', 'gsort-label-desc');
      var gc = document.getElementById('groupedResultsContainer'), bar = gc.querySelector(':scope > .group-grand-total');
      R.chk.gmBarLast = !!bar && gc.lastElementChild === bar && topKeys()[0] === 'West';
      rclick(bandEl('North')); sub('gSort');
      R.chk.gmSortSumm = subActs().indexOf('gsort-summary-desc') >= 0 && subActs().indexOf('gsort-summary-asc') >= 0;
      closeMenu();
      // (Other) stays last whatever the order
      $('#groupTableBtn').trigger('click'); await sleep(300);
      $('#groupLimitN').val('2'); $('#groupLimitOther').prop('checked', true);
      $('#confirmGroupingBtn').trigger('click');
      await until(function () { return !!document.querySelector('#groupedResultsContainer > .group-wrapper[data-group-other]') && tops().length === 3; }, 15000);
      await sleep(300);
      var fh = tops()[0] && tops()[0].querySelector(':scope > .group-header');
      if (fh) await chooseIn(fh, 'gSort', 'gsort-label-asc');
      // (the render draws (Other) last too: the check needs the sort to have run - label A-Z puts "(" first)
      var tw = tops(), io = (G && tw[0]) ? G.info(tw[0]) : null;
      R.chk.gmOtherLast = tw.length === 3 && tw[2].hasAttribute('data-group-other') && !!io && io.sort.key === 'label' && io.sort.dir === 'asc'
        && tw[0].getAttribute('data-group-key').localeCompare(tw[1].getAttribute('data-group-key')) < 0;
      R.info.other = tw.map(function (x) { return x.getAttribute('data-group-key'); });
      $('#groupTableBtn').trigger('click'); await sleep(300);
      $('#groupLimitN').val('');
      $('#confirmGroupingBtn').trigger('click');
      await until(function () { return tops().length === 6; }, 15000);
      $('#groupingLightbox').hide();
      await sleep(300);
      // Group by > another shown column for this level; its notice's Undo puts the grouping back
      window.__toasts.length = 0;
      rclick(bandEl('North')); sub('gBy');
      var by = subActs();
      R.chk.gmByList = by.indexOf('gby:V_STATUS') >= 0 && by.indexOf('gby:V_NAME') >= 0 && by.indexOf('gby:H_GROUP') < 0 && by.indexOf('gby-other') >= 0;
      R.info.byList = by;
      closeMenu();
      await chooseIn(bandEl('North'), 'gBy', 'gby:V_STATUS');
      var okb = await groupedBy('V_STATUS', 3);
      await sleep(300);
      var ub = undoBtn(/Grouped by V_STATUS/);
      R.chk.gmGroupBy = okb && !!ub && !!G && !!tops()[0] && G.info(tops()[0]).summary === true;
      // the column grouped by now is ticked in the list
      rclick(bandEl('Open')); sub('gBy');
      var tick = document.querySelector('.pnb-hm-sub [data-act="gby:V_STATUS"]');
      R.chk.gmTick = !!tick && tick.getAttribute('aria-checked') === 'true';
      closeMenu();
      if (ub) ub.click();
      R.chk.gmUndo = R.chk.gmGroupBy && (await groupedBy('H_GROUP', 6));
      if (!R.chk.gmUndo && grouped() && A() && A().groupingColumn() !== 'H_GROUP') await oneClick('H_GROUP', 6);   // (a broken Undo must not kill the rest)
      await sleep(300);
      // Add a level below: nested; the inner band's menu names its level
      await chooseIn(bandEl('North'), 'gAdd', 'gadd:V_STATUS');
      await until(function () { return levelsNow() === 'H_GROUP,V_STATUS'; }, 15000);
      await sleep(400);
      function inner() { var o = gw('North'); return o ? o.querySelector('.group-wrapper[data-group-depth="1"] > .group-header') : null; }
      R.chk.gmAdd = levelsNow() === 'H_GROUP,V_STATUS' && !!inner() && !!undoBtn(/Added a V_STATUS level/);
      var ia = [];
      if (inner() && rclick(inner())) {
        ia = acts();
        var st2 = menu().querySelector('.pnb-hm-stats');
        R.chk.gmLevelMenu = !!st2 && st2.textContent === 'V_STATUS, level 2 of 2' && ia.indexOf('gRemoveLevel') >= 0 && ia.indexOf('gAdd') >= 0
          && item('gBy').textContent.indexOf('Group this level by') >= 0 && ia.indexOf('gHide') < 0;
        sub('gAdd');
        R.chk.gmAddUsed = subActs().indexOf('gadd:V_STATUS') < 0 && subActs().indexOf('gadd:V_NAME') >= 0;
        closeMenu();
      }
      R.info.levelActs = ia;
      // Remove this level (the inner one): one level again; its Undo puts the level back
      await choose(inner(), 'gRemoveLevel');
      await until(function () { return levelsNow() === 'H_GROUP'; }, 15000);
      var ur = undoBtn(/Removed the V_STATUS level/);
      R.chk.gmRemoveLevel = levelsNow() === 'H_GROUP' && !!ur;
      if (ur) ur.click();
      await until(function () { return levelsNow() === 'H_GROUP,V_STATUS'; }, 15000);
      R.chk.gmRemoveUndo = R.chk.gmRemoveLevel && levelsNow() === 'H_GROUP,V_STATUS';
      await sleep(300);
      if (inner()) await choose(inner(), 'gRemoveLevel');
      await until(function () { return levelsNow() === 'H_GROUP'; }, 15000);
      await sleep(300);
      // a column whose every row differs asks first; No: nothing changes, and no notice offers an Undo
      var asked = [];
      window.confirm = function (m) { asked.push(String(m)); return false; };
      window.__toasts.length = 0;
      await chooseIn(bandEl('North'), 'gBy', 'gby:V_ID');
      await sleep(600);
      R.chk.gmUniqueNo = asked.length === 1 && /different V_ID/.test(asked[0]) && !!A() && A().groupingColumn() === 'H_GROUP' && !window.__toasts.some(function (t) { return t.indexOf('Grouped by') >= 0; });
      R.info.asked = asked.slice();
      window.confirm = function () { return true; };
      // every group closed, from the menu (open first: a regroup may have left them closed)
      $('#expandAllGroups').trigger('click');
      await sleep(250);
      var anyOpen = tops().some(function (x) { return x.classList.contains('open'); });
      await choose(bandEl('North'), 'gCollapseAll');
      R.chk.gmCollapseAll = anyOpen && tops().length === 6 && tops().every(function (x) { return !x.classList.contains('open'); });
      // from the keyboard: the band's name focused, Shift+F10 - under the band, the first item focused; Escape - back
      var bN = bandEl('North'), nmEl = bN ? bN.querySelector('.group-name') : null;
      if (nmEl) { nmEl.focus(); rclick(nmEl, true); }
      var m2 = menu(), br = bN ? bN.getBoundingClientRect() : null, mr = m2 ? m2.getBoundingClientRect() : null;
      R.chk.gmKbd = !!mr && !!br && Math.abs(mr.top - br.bottom) <= 2 && Math.abs(mr.left - br.left) <= 2 && document.activeElement === m2.querySelector('.pnb-hm-item');
      R.info.kbd = { band: br && [br.left, br.bottom], menu: mr && [mr.left, mr.top] };
      keyOn('Escape');
      R.chk.gmKbdBack = R.chk.gmKbd && !menu() && document.activeElement === nmEl;
      // a second right-click on the band (another part of it) is the browser's menu
      var cntEl = bN ? bN.querySelector('.group-count') : null;
      var o1 = !!nmEl && rclick(nmEl) && !!menu();
      var second = true;
      if (cntEl) { rdown(cntEl); second = rclick(cntEl); }
      R.chk.gmNativeSecond = o1 && !second && !menu();
      closeMenu();
      // every group open again
      await choose(bandEl('North'), 'gExpandAll');
      R.chk.gmExpandAll = R.chk.gmCollapseAll && tops().every(function (x) { return x.classList.contains('open'); });
      // a viewer kept from grouping: the group's items and the view, nothing that regroups - and no
      // regrouping from a column's header either
      document.body.classList.add('restrict-grouping');
      rclick(bandEl('North'));
      var ra = acts();
      R.chk.gmRestricted = !!menu() && ra.indexOf('gBy') < 0 && ra.indexOf('gAdd') < 0 && ra.indexOf('gSort') < 0 && ra.indexOf('gConfigure') < 0 && ra.indexOf('gUngroup') < 0
        && ra.indexOf('gOnly') >= 0 && ra.indexOf('gList') >= 0;
      closeMenu();
      rclick(gth('V_NAME'));
      var ha = acts();
      R.chk.gmHdrRestricted = !!menu() && ha.indexOf('groupBy') < 0 && ha.indexOf('ungroup') < 0 && ha.indexOf('sortAsc') >= 0;
      closeMenu();
      document.body.classList.remove('restrict-grouping');
      // the comparison class over a grouped view that is no comparison (no #snapshotComparisonContainer) and the All groups
      // bar keep the browser's menu (guards); a real comparison's bands open its own menu (2026-10-22: the cmpmenu suite)
      document.body.classList.add('snapshot-comparison-active');
      R.chk.gmCompareNative = !rclick(bandEl('North')) && !menu();
      document.body.classList.remove('snapshot-comparison-active');
      var gt = document.querySelector('#groupedResultsContainer > .group-grand-total > .group-header');
      R.chk.gmTotalNative = !!gt && !rclick(gt) && !menu();
      closeMenu();
      // the dialog; no grouping
      await choose(bandEl('North'), 'gConfigure');
      await sleep(400);
      R.chk.gmConfigure = $('#groupingLightbox').is(':visible');
      $('#groupingLightbox').hide();
      await choose(bandEl('North'), 'gUngroup');
      R.chk.gmUngroup = await until(function () { return !grouped(); }, 15000);
      // (sweep 2) a regroup's Undo after its grouping has gone does nothing (it regrouped the flat table)
      var okg = await oneClick('H_GROUP', 6);
      window.__toasts.length = 0;
      if (bandEl('North')) await chooseIn(bandEl('North'), 'gBy', 'gby:V_STATUS');
      var okv2 = await groupedBy('V_STATUS', 3);
      var ub2 = undoBtn(/Grouped by V_STATUS/);
      await flat();
      if (ub2) ub2.click();
      await sleep(1500);
      R.chk.gmUndoStale = okg && okv2 && !!ub2 && !grouped();
    },
    // (2026-10-20, grpsweep 2) a group of a formatted column: V_DATE shown as a year (the saved report's
    // format) holds many days - Show only this group keeps every one of them (it kept the first day's)
    ggfmt: async function () {
      var years = {};
      window.__rowsFixture.forEach(function (r) { var y = String(r.V_DATE).split('/')[2]; years[y] = (years[y] || 0) + 1; });
      var ny = Object.keys(years).length, y0 = Object.keys(years).sort(function (a, b) { return years[b] - years[a]; })[0];
      var ok = await oneClick('V_DATE', ny);
      var shown = topKeys();
      if (bandEl(y0)) await choose(bandEl(y0), 'gOnly');
      await until(function () { return topKeys().length === 1; }, 10000);
      await sleep(300);
      var w = gw(y0), n = w ? w.querySelectorAll('tbody tr:not(.search-hidden)').length : -1;
      R.chk.fmtOnlyAll = ok && shown.indexOf(y0) >= 0 && topKeys().join() === y0 && n === years[y0];
      R.info.fmt = { ok: ok, shown: shown, y0: y0, want: years[y0], got: n, search: searchVal().slice(0, 160) };
    },
    // (2026-10-20, grpsweep 2) a report saved grouped as List by a column the query no longer has: it opens
    // flat with the List choice left behind - a one-click grouping is the count's and clears it, so the
    // group menu's regroup decides again (it kept Stacked)
    mautostale: async function () {
      var flatAtLoad = !grouped();
      await choose(fth('V_STATUS'), 'groupBy');
      var ok1 = await groupedBy('V_STATUS', 3); await sleep(300);
      var wasS = L() === 'stacked';
      var seen = {}; window.__rowsFixture.forEach(function (r) { seen[r.V_NAME] = 1; });
      var nN = Object.keys(seen).length;
      if (bandEl('Open')) await chooseIn(bandEl('Open'), 'gBy', 'gby:V_NAME');
      var ok2 = await groupedBy('V_NAME', nN); await sleep(400);
      R.chk.staleChoice = flatAtLoad && ok1 && wasS && ok2 && L() === 'list' && glOn();
      R.info.stale = { flatAtLoad: flatAtLoad, ok1: ok1, wasS: wasS, ok2: ok2, L: L(), chosen: !!GM() && GM().chosen() };
    },
    // (2026-10-20, grpmenu) the List layout: switched from a band, a row's menu, back from a row
    gglist: async function () {
      $('#collapseAllGroups').trigger('click');
      await sleep(250);
      await choose(bandEl('South'), 'gList');
      await sleep(400);
      var GLs = window.Penumbra.groupList ? window.Penumbra.groupList.state() : {};
      R.chk.glSwitch = glOn() && L() === 'list' && GLs.selPath === 'South' && !!GM() && GM().chosen() === true;
      var row = listRow('East');
      R.chk.glRowOpens = !!row && rclick(row) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === 'East';
      var a = acts();
      R.chk.glRowItems = R.chk.glRowOpens && a.indexOf('gToggle') < 0 && a.indexOf('gStacked') >= 0 && a.indexOf('gList') < 0 && a.indexOf('gExpandAll') < 0
        && a.indexOf('gOnly') >= 0 && a.indexOf('gBy') >= 0;
      R.chk.glRowMarked = !!row && row.classList.contains('pnb-hm-for');
      R.info.rowActs = a;
      closeMenu();
      // the selected band opens it too
      var sb = document.querySelector('#groupedResultsContainer .group-wrapper.pnb-gl-sel > .group-header');
      R.chk.glBandOpens = !!sb && rclick(sb) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === 'South';
      closeMenu();
      // the list focused (the keyboard's way in): Shift+F10 opens the active row's menu; Escape - back to the list
      var lst = document.getElementById('pnbGroupList');
      if (lst) lst.focus();
      var actRow = lst ? lst.querySelector('.pnb-gl-item.is-active') : null, actName = actRow ? actRow.querySelector('.pnb-gl-name').textContent : null;
      R.chk.glKbd = !!lst && !!actName && rclick(lst, true) && !!menu() && menu().querySelector('.pnb-hm-name').textContent === actName;
      keyOn('Escape');
      R.chk.glKbdBack = R.chk.glKbd && !menu() && document.activeElement === lst;
      // (sweep 2) a row's notes in List: its group is selected first, so the notes card has a drawn button to
      // sit by (it opened invisible). A stand-in note button records whether it was drawn when clicked.
      var cw = gw('Central'), drawnAtClick = null;
      if (cw) {
        var fake = document.createElement('button');
        fake.type = 'button'; fake.className = 'journal-pvnote-btn'; fake.setAttribute('data-count', '');
        fake.addEventListener('click', function (ev) { ev.stopPropagation(); drawnAtClick = fake.getClientRects().length > 0; });
        cw.querySelector(':scope > .group-header').appendChild(fake);
      }
      var cr = listRow('Central');
      if (cr) await choose(cr, 'gNote');
      R.chk.glNoteDrawn = drawnAtClick === true;
      R.info.note = { drawn: drawnAtClick, sel: window.Penumbra.groupList ? window.Penumbra.groupList.state().selPath : null };
      // (sweep 2) from the keyboard, Switch to Stacked view: the focus goes to that group's band (the list it
      // was in is gone; it fell to the page)
      if (lst && document.contains(lst)) lst.focus();
      var act2 = (lst && document.contains(lst)) ? lst.querySelector('.pnb-gl-item.is-active') : null, act2Name = act2 ? act2.querySelector('.pnb-gl-name').textContent : null;
      if (act2Name && rclick(lst, true)) {
        for (var kk = 0; kk < 20 && document.activeElement && document.activeElement.getAttribute('data-act') !== 'gStacked'; kk++) keyOn('ArrowDown');
        keyOn('Enter');
      }
      await sleep(600);
      var aw = act2Name ? gw(act2Name) : null, fnm = aw ? aw.querySelector(':scope > .group-header .group-name') : null;
      R.chk.glKbdStackFocus = !!act2Name && !glOn() && L() === 'stacked' && !!fnm && document.activeElement === fnm;
      R.info.kbdFocus = { act: act2Name, focus: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : null };
      // back to List for a row's own switch below
      if (bandEl('South')) await choose(bandEl('South'), 'gList');
      await sleep(400);
      // Switch to Stacked view from a row: Stacked, that group opened (the others as they were)
      var er = listRow('East');
      if (er) await choose(er, 'gStacked');
      await sleep(400);
      var ew = gw('East'), nw = gw('North');
      R.chk.glToStacked = !glOn() && L() === 'stacked' && !!ew && ew.classList.contains('open') && !!nw && !nw.classList.contains('open');
      R.info.gl = { L: L(), on: glOn(), sel: GLs.selPath, act: actName };
    },
    mshot: async function () {
      await choose(fth('V_NAME'), 'sortAsc');
      rclick(fth('V_NAME'));
      R.chk.open = !!menu();
    },
    // (2026-10-24, hlhead; the user: "shouldnt column header right clicks also have a highlight menu") Highlight... right
    // after Column options: the column's highlight rules alone in the popover (no other section), Header among a rule's
    // Apply to; Back (the rule's, then the popover's) to the menu; none on '#'; none where Column Organization is closed
    mhl: async function () {
      document.getElementById('settingsPanel').classList.add('is-open'); window.Penumbra.refreshSettingsColumns();
      await sleep(200);
      var th = fth('V_AMOUNT');
      rclick(th);
      var a = acts();
      R.info.acts = a;
      R.chk.hlItem = a.indexOf('options') >= 0 && a.indexOf('highlight') === a.indexOf('options') + 1 && !!item('highlight')
        && item('highlight').querySelector('.pnb-hm-label').textContent === 'Highlight...';
      closeMenu();
      await choose(th, 'highlight');
      var pop = document.querySelector('.sp-sumtype-menu.pnb-colopt');
      var secs = pop ? Array.prototype.filter.call(pop.children, function (n) { return n.classList.contains('pnb-colopt-sec'); }).map(function (s) { return s.getAttribute('data-sec'); }).join() : '';
      R.info.secs = secs;
      R.chk.hlAlone = !!pop && secs === 'highlight' && !!pop.querySelector('[data-co="hl-add"]') && pop.textContent.indexOf('V_AMOUNT') >= 0;
      if (pop) { pop.querySelector('[data-co="hl-add"]').click(); await sleep(80); }
      R.chk.hlHeaderOption = !!document.querySelector('.sp-sumtype-menu.pnb-colopt .pnb-hl-ed [data-co="hl-to"][value="header"]');
      var hb = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="hl-back"]');
      if (hb) { hb.click(); await sleep(80); }
      var bkb = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="back"]');
      if (bkb) bkb.click();
      await sleep(200);
      var bt = menu() && menu().querySelector('.pnb-hm-name');
      R.chk.hlBack = !!bkb && !document.querySelector('.sp-sumtype-menu.pnb-colopt') && !!bt && bt.textContent === 'V_AMOUNT';
      closeMenu();
      // (the review) from the keyboard: Highlight... puts the focus in the popover (its first button - the column has no
      // rule, so no Reset to land on)
      var kth = fth('V_AMOUNT');
      if (!kth.hasAttribute('tabindex')) kth.setAttribute('tabindex', '0');
      kth.focus();
      rclick(kth, true);
      var hi = item('highlight');
      if (hi) { hi.focus(); hi.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }
      await sleep(450);
      var kp = document.querySelector('.sp-sumtype-menu.pnb-colopt'), ae = document.activeElement;
      R.info.kbdFocus = ae ? [ae.tagName, ae.getAttribute('data-co'), (ae.textContent || '').trim().slice(0, 30), !!kp] : null;
      R.chk.hlKbdFocus = !!kp && !!ae && kp.contains(ae) && ae.tagName === 'BUTTON';
      if (ae) ae.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(200);
      if (document.querySelector('.sp-sumtype-menu.pnb-colopt') && window.Penumbra.headerMenu && window.Penumbra.headerMenu.closeColOpts) window.Penumbra.headerMenu.closeColOpts();
      closeMenu();
      // (the second review) with a rule of the viewer's own (Reset on): from the keyboard the focus is on the rules' first
      // button, never Reset - Enter there took every rule of theirs off at once; Reset: the focus stays in the rules
      function popClose() {
        var x = document.querySelector('.sp-sumtype-menu.pnb-colopt');
        if (x && window.Penumbra.headerMenu && window.Penumbra.headerMenu.closeColOpts) window.Penumbra.headerMenu.closeColOpts();
        closeMenu();
      }
      await choose(fth('V_AMOUNT'), 'highlight');
      var p2 = document.querySelector('.sp-sumtype-menu.pnb-colopt');
      if (p2 && p2.querySelector('[data-co="hl-add"]')) { p2.querySelector('[data-co="hl-add"]').click(); await sleep(80); }
      var hv = document.querySelector('.sp-sumtype-menu.pnb-colopt .pnb-hl-ed [data-co="hl-v"]');
      if (hv) { hv.focus(); hv.value = '50,000'; hv.dispatchEvent(new Event('input', { bubbles: true })); await sleep(600); }
      var hdn = document.querySelector('.sp-sumtype-menu.pnb-colopt [data-co="hl-done"]');
      if (hdn) { hdn.click(); await sleep(200); }
      popClose();
      await sleep(150);
      kth.focus();
      rclick(kth, true);
      var hi2 = item('highlight');
      if (hi2) { hi2.focus(); hi2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }
      await sleep(450);
      var kp2 = document.querySelector('.sp-sumtype-menu.pnb-colopt'), ae2 = document.activeElement, rb = kp2 && kp2.querySelector('button.pnb-colopt-reset');
      R.info.kbd2 = ae2 ? [ae2.tagName, ae2.className, ae2.getAttribute('data-co'), (ae2.textContent || '').trim().slice(0, 30), !!rb && !rb.disabled] : null;
      R.chk.hlKbdNotReset = !!kp2 && !!rb && !rb.disabled && !!ae2 && kp2.contains(ae2) && ae2 !== rb && !!ae2.closest('[data-sec="highlight"]');
      if (rb) { rb.click(); await sleep(250); }
      var ae3 = document.activeElement;
      R.info.reset = ae3 ? [ae3.tagName, ae3.className, ae3.getAttribute('data-co'), (ae3.textContent || '').trim().slice(0, 30)] : null;
      R.chk.hlResetFocus = !!rb && !!ae3 && !!kp2 && kp2.contains(ae3) && ae3.tagName === 'BUTTON' && !ae3.disabled && !!ae3.closest('[data-sec="highlight"]');
      popClose();
      await sleep(150);
      var num = document.querySelector('#tableHeader th[data-column="#"]');
      rclick(num);
      R.chk.hlNotNum = !!menu() && acts().indexOf('highlight') < 0 && acts().indexOf('sortAsc') >= 0;
      closeMenu();
      window.penumbra_vars.isAdmin = false;
      window._penumbraHideColumns = true;
      rclick(fth('V_NAME'));
      R.chk.hlNotRestricted = !!menu() && acts().indexOf('highlight') < 0 && acts().indexOf('sortAsc') >= 0;
      closeMenu();
    },
    // (2026-10-25, nestgb; the user: "When right clicking on a column that uses JSON, the group by option should become a
    // flyout that shows the group by each nested subrow"; nestcopy: "this process should be repeated for the copy distinct
    // values ... their own menu section, with their own static header stating the nested sub-column" - they chose one
    // section, a list per column) H_JSON shown (and H_TEXT: a nested table of its own from row 7; H_NULL: empty tables):
    // its menu has no Group by and no Copy distinct values of its own; it ends with a Nested columns section, one item per
    // column of its tables, each opening its own list with its name on top - Group by it (a row joins the group of each
    // value its table holds: the bands checked against the fixture; "instead" in a grouped view, the one grouped by now
    // ticked) and Copy distinct values (the clipboard checked against the fixture; Other... opens Copy on its own option);
    // from the keyboard. A plain column keeps its own items (nsPlain); a column named in digits keeps the menu (nsDigitSafe).
    // (the review, v2) nothing drawn to name them (a hidden column's lazy cells stay empty); "Nested column X" to a screen
    // reader; the tables' own case in the labels; no whole-column copy while it holds nested tables; none of it where the
    // report hides Clipboard; a tall menu scrolls to the keyboard's item.
    mnestgb: async function () {
      var l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = true; });
      A().applyLayout(l);
      await sleep(500);
      // H_TEXT hidden: its cells are left empty (lazy) until something needs them - H_JSON's menu and a column's list do not
      function cellsOf(name) {
        var t = fth(name), id = t ? t.getAttribute('data-column') : null, tds = id === null ? [] : document.querySelectorAll('#resultsTable tbody td[data-column="' + id + '"]');
        return { n: tds.length, lazy: Array.prototype.filter.call(tds, function (td) { return td.hasAttribute('data-pnb-lazy'); }).length,
          drawn: Array.prototype.filter.call(tds, function (td) { return !!td.querySelector('.raw-json-data'); }).length };
      }
      var c0 = cellsOf('H_TEXT');
      rclick(fth('H_JSON'));
      if (item('nestcol-2') && item('nestcol-2').getAttribute('aria-haspopup') === 'menu') sub('nestcol-2');
      var nd1 = !!item('nestcopy-2');
      closeMenu();
      var c1 = cellsOf('H_TEXT');
      R.info.noDraw = [c0, c1, nd1];
      R.chk.nsNoDraw = nd1 && c0.lazy > 0 && c0.drawn === 0 && c1.lazy === c0.lazy && c1.drawn === 0;
      l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_TEXT' || c.colName === 'H_NULL') c.visible = true; });
      A().applyLayout(l);
      await sleep(500);
      var FX = window.__rowsFixture;
      function subsOf(r, key) { return r.H_JSON ? JSON.parse(r.H_JSON.substring(6)).map(function (x) { return String(x[key]); }) : []; }
      function want(key) {
        var w = Object.create(null);
        FX.forEach(function (r) {
          var vs = subsOf(r, key);
          if (!vs.length) { w['[Blank]'] = (w['[Blank]'] || 0) + 1; return; }
          vs.filter(function (v, i) { return vs.indexOf(v) === i; }).forEach(function (v) { w[v] = (w[v] || 0) + 1; });
        });
        return w;
      }
      function bandsMatch(key) {
        var w = want(key), ks = Object.keys(w), got = Object.create(null);
        tops().forEach(function (wr) { got[wr.getAttribute('data-group-key')] = wr.querySelectorAll('tbody tr').length; });
        var gk = Object.keys(got);
        var bad = ks.filter(function (k) { return got[k] !== w[k]; }).concat(gk.filter(function (k) { return !(k in w); }));
        R.info['bands_' + key] = { want: ks.length, got: gk.length, bad: bad.slice(0, 5).map(function (k) { return [k, w[k], got[k]]; }) };
        return ks.length > 2 && gk.length === ks.length && bad.length === 0;
      }
      // the distinct values a copy of H_JSON's key gives: the flat rows the filter keeps, in their order, each table's rows in order
      function distinctSub(key) {
        var seen = Object.create(null), out = [];
        Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
          if (tr.classList.contains('search-hidden')) return;
          var r = FX[parseInt(tr.cells[0].textContent, 10) - 1];
          if (r) subsOf(r, key).forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
        });
        return out;
      }
      function lastClip() { return window.__clip && window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      function isList(el) { return !!el && el.getAttribute('aria-haspopup') === 'menu'; }
      function lab(el) { var x = el && el.querySelector('.pnb-hm-label'); return x ? x.textContent : ''; }
      function heads(p) { return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-head'), function (h) { return h.textContent; }) : []; }
      function nestActs() { return acts().filter(function (a) { return /^nestcol-/.test(a); }); }
      function nestLabels() { return nestActs().map(function (a) { return lab(item(a)); }); }
      // the Nested columns heading sits after the column's tools (Calculated column) and before the menu's foot
      function sectionPlaced() {
        var m = menu(); if (!m) return false;
        var kids = Array.prototype.slice.call(m.children), h = kids.filter(function (k) { return k.classList.contains('pnb-hm-head') && k.textContent === 'Nested columns'; })[0];
        var calc = item('calc'), clr = item('clearPrefs');
        return !!h && (!calc || kids.indexOf(calc) < kids.indexOf(h)) && (!clr || kids.indexOf(h) < kids.indexOf(clr));
      }
      var th = fth('H_JSON');
      rclick(th);
      R.info.acts = acts();
      R.chk.nsSection = !!menu() && acts().indexOf('groupBy') < 0 && acts().indexOf('copy') < 0 && acts().indexOf('copyName') >= 0 && sectionPlaced()
        && nestActs().join() === 'nestcol-0,nestcol-1,nestcol-2' && nestLabels().join() === 'SUB_ID,SUB_AMT,SUB_NAME' && nestActs().every(function (a) { return isList(item(a)); });
      // a screen reader hears each one as a nested column (the heading is no stop for it)
      R.info.aria = nestActs().map(function (a) { return item(a).getAttribute('aria-label'); });
      R.chk.nsAria = nestActs().length === 3 && nestActs().every(function (a) { return item(a).getAttribute('aria-label') === 'Nested column ' + lab(item(a)); });
      if (isList(item('nestcol-2'))) sub('nestcol-2');
      var p2 = subPanel();
      R.info.list = [heads(p2), subActs(), subLabels()];
      R.chk.nsColList = !!p2 && heads(p2).join() === 'SUB_NAME' && subActs().join() === 'groupBy-2,nestcopy-2,neststats-2' && lab(item('groupBy-2')) === 'Group by SUB_NAME'
        && item('groupBy-2').getAttribute('aria-checked') === 'false' && isList(item('nestcopy-2'));
      closeMenu();
      // another nested table's columns are its own column's, never H_JSON's; its tables start at row 7 (both engines see it)
      rclick(fth('H_TEXT'));
      R.info.listText = nestLabels();
      var ownOk = nestLabels().join() === 'NOTE_KIND,NOTE_DAYS';
      if (isList(item('nestcol-0'))) sub('nestcol-0');
      R.chk.nsOwnOnly = ownOk && lab(item('groupBy-0')) === 'Group by NOTE_KIND' && isList(item('nestcopy-0'));
      closeMenu();
      // (guard) a plain column keeps its own items
      rclick(fth('V_STATUS'));
      R.chk.nsPlain = !!item('groupBy') && !item('groupBy').hasAttribute('aria-haspopup') && lab(item('groupBy')) === 'Group by this column'
        && isList(item('copyMenu')) && isList(reach('copy')) && !nestActs().length && heads(menu()).indexOf('Nested columns') < 0;   // (2026-10-27, copymenu) its Copy list
      closeMenu();
      // a nested-table column whose tables hold no column: one greyed line with the reason
      rclick(fth('H_NULL'));
      var nn = item('nestnone');
      R.info.none = nn ? [lab(nn), nn.getAttribute('aria-disabled'), nn.getAttribute('title'), acts()] : acts();
      R.chk.nsNone = !!nn && nn.getAttribute('aria-disabled') === 'true' && nn.getAttribute('title') === 'Its nested tables have no columns'
        && heads(menu()).indexOf('Nested columns') >= 0 && acts().indexOf('groupBy') < 0 && acts().indexOf('copy') < 0 && acts().indexOf('copyMenu') < 0;   // (2026-10-27, copymenu)
      closeMenu();
      // (guard) a column named in digits (jQuery's data() hands it back as a number, and the grouping picker's own list throws
      // on it): the nested column's menu still opens
      $(fth('V_ID')).data('colname', 2021);
      var dOpen = false;
      try { dOpen = rclick(th) && !!menu() && acts().indexOf('sortAsc') >= 0; } catch (eD) { R.info.digit = String(eD); }
      $(fth('V_ID')).removeData('colname');
      R.chk.nsDigitSafe = dOpen;
      closeMenu();
      // (guard; 2026-10-25, digitcol) the grouping picker's list throwing for any reason (a stub - a column named in digits
      // throws no more): the nested column's menu still opens (main.js's catch in penumbraHeaderNestedFields)
      var sbWas = window._penumbraSearchBuilder, tOpen = false;
      window._penumbraSearchBuilder = { getAvailableColumns: function () { throw new Error('the grouping list threw (stub)'); } };
      try { tOpen = rclick(th) && !!menu() && acts().indexOf('sortAsc') >= 0; } catch (eT) { R.info.listThrows = String(eT); }
      if (sbWas === undefined) { delete window._penumbraSearchBuilder; } else { window._penumbraSearchBuilder = sbWas; }
      R.chk.nsListThrows = tOpen;
      closeMenu();
      // the tables' own case: a key Copy reads as "Sub_Name" (group mode's SUB_NAME) is named so on the item, its list's
      // heading and its Group by (the copy's names stubbed for the menu's build)
      var realCF = A().nestedCopyFields;
      A().nestedCopyFields = function (c) { var r = realCF.apply(this, arguments); return (r && String(c) === 'H_JSON') ? r.map(function (s) { return s === 'SUB_NAME' ? 'Sub_Name' : s; }) : r; };
      try {
        rclick(th);
        var caseLab = lab(item('nestcol-2'));
        if (isList(item('nestcol-2'))) sub('nestcol-2');
        R.info.caseLab = [caseLab, heads(subPanel()), subLabels()];
        R.chk.nsCase = caseLab === 'Sub_Name' && heads(subPanel()).join() === 'Sub_Name' && lab(item('groupBy-2')) === 'Group by Sub_Name';
      } finally { A().nestedCopyFields = realCF; }
      closeMenu();
      // the whole column's Copy distinct values never comes back while it holds nested tables: with neither engine naming a
      // column of them (the grouping picker throwing, no row shown holding one) the section says so
      var realNF = A().nestedFields, realCF2 = A().nestedCopyFields;
      A().nestedFields = function () { return null; };
      A().nestedCopyFields = function () { return null; };
      try {
        rclick(th);
        R.info.noRaw = acts();
        R.chk.nsNoRaw = !!menu() && acts().indexOf('copy') < 0 && acts().indexOf('copyMenu') < 0 && acts().indexOf('nestnone') >= 0 && heads(menu()).indexOf('Nested columns') >= 0;
      } finally { A().nestedFields = realNF; A().nestedCopyFields = realCF2; }
      closeMenu();
      // the report hides Clipboard (body.restrict-clipboard, as its View Option does): no Copy distinct values - the nested
      // tables' or a plain column's - and the copy itself refused
      window.__clip = window.__clip || [];
      var clipActs = [], plainCopy = true, refused = false, clipsB = window.__clip.length;
      document.body.classList.add('restrict-clipboard');
      try {
        rclick(th);
        if (isList(item('nestcol-2'))) sub('nestcol-2');
        clipActs = subActs();
        closeMenu();
        rclick(fth('V_STATUS'));
        plainCopy = !!item('copy') || !!item('copyMenu') || !!reach('copy');   // (2026-10-27, copymenu) or in a Copy list
        closeMenu();
        refused = typeof A().copyNested === 'function' && A().copyNested('H_JSON', 'SUB_NAME', ',') === false;
        await sleep(300);
      } finally { document.body.classList.remove('restrict-clipboard'); }
      R.info.clipOff = { acts: clipActs, plainCopy: plainCopy, refused: refused, clips: window.__clip.length - clipsB };
      R.chk.nsClipOff = clipActs.join() === 'groupBy-2,neststats-2' && !plainCopy && refused && window.__clip.length === clipsB;
      // Copy distinct values of SUB_NAME: the delimiter list, then a comma copy of the fixture's values
      rclick(th);
      if (isList(item('nestcol-2'))) sub('nestcol-2');
      if (isList(item('nestcopy-2'))) sub('nestcopy-2');
      var pc = subPanel();
      R.info.copyList = [heads(pc), subActs()];
      var listOk = !!pc && heads(pc).join() === 'Delimited by'
        && ['space', 'comma', 'semicolon', 'tab', 'newline', 'other'].every(function (d) { return subActs().indexOf('nestcopy-2-' + d) >= 0; });
      var cc = item('nestcopy-2-comma');
      if (cc) cc.click();
      await sleep(700);
      var wantN = distinctSub('SUB_NAME');
      R.info.copy = { got: lastClip() && lastClip().slice(0, 120), want: wantN.join(',').slice(0, 120) };
      R.chk.nsCopy = listOk && !!cc && wantN.length > 5 && lastClip() === wantN.join(',');
      // Other...: Copy on Single Column (Distinct), its own option for H_JSON's SUB_NAME chosen, the delimiter box focused
      rclick(th);
      if (isList(item('nestcol-2'))) sub('nestcol-2');
      if (isList(item('nestcopy-2'))) sub('nestcopy-2');
      var co = item('nestcopy-2-other');
      if (co) co.click();
      await sleep(600);
      R.info.other = { vis: $('#copyActionsLightbox').is(':visible'), sel: $('#copyColumnSelector').val(), act: document.activeElement && document.activeElement.id };
      R.chk.nsCopyOther = !!co && $('#copyActionsLightbox').is(':visible') && $('input[name="copyFormat"][value="single_col"]').is(':checked')
        && $('#copyColumnSelector').val() === 'H_JSON-SUB_NAME' && document.activeElement === document.getElementById('copyDelimiterInput');
      $('#copyActionsLightbox').hide();
      // (the review, v3) a snapshot comparison numbers its rows afresh and keys its cells by place: no nested names from it
      var cmpN = 'n/a', cmpP = 'n/a';
      document.body.classList.add('snapshot-comparison-active');
      try { if (typeof A().nestedCopyFields === 'function') { cmpN = A().nestedCopyFields('H_JSON'); cmpP = A().nestedCopyPlan(); } }
      finally { document.body.classList.remove('snapshot-comparison-active'); }
      R.info.cmp = [cmpN, cmpP];
      R.chk.nsCmpNone = cmpN === null && Array.isArray(cmpP) && cmpP.length === 0;
      // a @@JSON value inside a nested table renders its own hidden copy INSIDE the table, ahead of the cell's: the copy and
      // Copy's own list read the cell's own copy (the nested sort's rule), never the inner one (stand-ins in every row here)
      var hid = fth('H_JSON').getAttribute('data-column'), fakes = [], innClip = null, innOpts = [];
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody td[data-column="' + hid + '"]'), function (td) {
        var box = td.firstElementChild;
        if (!box || box.classList.contains('raw-json-data') || !td.querySelector('.raw-json-data')) return;
        var f = document.createElement('div'); f.className = 'raw-json-data'; f.style.display = 'none'; f.textContent = '[{"INNER_X":"zzz"}]';
        box.insertBefore(f, box.firstChild); fakes.push(f);
      });
      var innB = window.__clip.length;
      try {
        rclick(th);
        if (isList(item('nestcol-2'))) sub('nestcol-2');
        if (isList(item('nestcopy-2'))) sub('nestcopy-2');
        var ic = item('nestcopy-2-comma');
        if (ic) ic.click();
        await sleep(700);
        innClip = window.__clip.length > innB ? lastClip() : null;
        rclick(th);
        if (isList(item('nestcol-2'))) sub('nestcol-2');
        if (isList(item('nestcopy-2'))) sub('nestcopy-2');
        var io = item('nestcopy-2-other');
        if (io) io.click();
        await sleep(600);
        innOpts = $('#copyColumnSelector option').map(function () { return this.value; }).get();
        $('#copyActionsLightbox').hide();
      } finally { fakes.forEach(function (f) { f.remove(); }); }
      R.info.inner = { fakes: fakes.length, clip: innClip && innClip.slice(0, 80), opts: innOpts.filter(function (v) { return /^H_JSON-/.test(v); }) };
      R.chk.nsInnerOwn = fakes.length > 5 && innClip === distinctSub('SUB_NAME').join(',') && innOpts.indexOf('H_JSON-SUB_NAME') >= 0 && innOpts.indexOf('H_JSON-INNER_X') < 0;
      // (2026-10-25, neststats; the user: "Should subcolumns have their own column stats in the flyout menu? If its cheap we
      // should add it") each column's list ends with Column stats over its tables' values in the rows the filter keeps:
      // SUB_AMT's row count, total and range, SUB_NAME's unique count (the fixture's); a filter on V_STATUS keeps fewer
      function statInfo(p) { var o = {}; if (p) Array.prototype.forEach.call(p.querySelectorAll('.pnb-hm-info'), function (r) { var k = r.querySelector('.pnb-hm-info-k'), v = r.querySelector('.pnb-hm-info-v'); if (k && v) o[k.textContent] = v.textContent; }); return o; }
      function keptSubs(key) {
        var out = [];
        Array.prototype.forEach.call(document.querySelectorAll('#resultsTable > tbody > tr'), function (tr) {
          if (tr.classList.contains('search-hidden')) return;
          var r = FX[parseInt(tr.cells[0].textContent, 10) - 1];
          if (r && r.H_JSON) JSON.parse(r.H_JSON.substring(6)).forEach(function (x) { out.push(x[key] == null ? '' : String(x[key])); });
        });
        return out;
      }
      function fmtN(x) { return Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
      function statsOf(k) {
        rclick(fth('H_JSON'));
        if (isList(item('nestcol-' + k))) sub('nestcol-' + k);
        if (isList(item('neststats-' + k))) sub('neststats-' + k);
        var p = subPanel(), o = { head: heads(p).join('|'), info: statInfo(p) };
        closeMenu();
        return o;
      }
      function setSearchNs(t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); }
      var amt = keptSubs('SUB_AMT'), amtN = amt.filter(function (v) { return v !== ''; }).map(Number), amtSum = amtN.reduce(function (a, b) { return a + b; }, 0);
      var sA = statsOf(1);
      var nms = keptSubs('SUB_NAME').filter(function (v) { return v !== ''; }), nmU = Object.keys(nms.reduce(function (o, v) { o[v] = 1; return o; }, {})).length;
      var sN = statsOf(2);
      R.info.stats = { amt: sA, name: sN, want: [amt.length, amtSum, nmU] };
      R.chk.nsStats = amt.length > 50 && sA.head.indexOf('Over the ' + fmtN(amt.length) + ' rows of its tables in the rows the filter keeps') === 0
        && sA.info['Total'] === fmtN(amtSum) && sA.info['Smallest'] === fmtN(Math.min.apply(null, amtN)) && sA.info['Largest'] === fmtN(Math.max.apply(null, amtN))
        && sN.info['Unique'] === (nms.length > 1 && nmU === nms.length ? 'all' : fmtN(nmU));
      A().filterAdd('V_STATUS', 'Open', false);
      await sleep(900);
      var amtF = keptSubs('SUB_AMT'), sF = statsOf(1);
      setSearchNs('');
      await sleep(900);
      R.info.statsF = { want: amtF.length, all: amt.length, head: sF.head };
      R.chk.nsStatsFilter = amtF.length > 0 && amtF.length < amt.length && sF.head.indexOf('Over the ' + fmtN(amtF.length) + ' rows of its tables in the rows the filter keeps') === 0;
      // (the review) a value that is a table of its own (an object, a list, @@JSON) is no value: counted apart, With a table
      // (the values stubbed for the menu: 5 and 7, a blank, two tables)
      var nvReal = A().nestedValues, tblInfo = null;
      A().nestedValues = function () { var a = ['5', '7', '']; a.tables = 2; return a; };
      try { var sT = statsOf(1); tblInfo = sT; } finally { A().nestedValues = nvReal; }
      R.info.statsT = tblInfo;
      R.chk.nsStatsTables = !!tblInfo && tblInfo.head.indexOf('Over the 5 rows of its tables in the rows the filter keeps') === 0 && tblInfo.info['With a table'] === '2'
        && tblInfo.info['Total'] === '12' && tblInfo.info['Empty'] === '1';
      // (guard) a main.js without nestedValues (a stale cache) where the report hides Clipboard and Grouping: no section of
      // lists with nothing in them, and the whole column's Copy distinct values still left out
      var nvKeep = A().nestedValues, staleActs = null;
      delete A().nestedValues;
      document.body.classList.add('restrict-clipboard'); document.body.classList.add('restrict-grouping');
      try { rclick(th); staleActs = acts(); closeMenu(); }
      finally { document.body.classList.remove('restrict-clipboard'); document.body.classList.remove('restrict-grouping'); if (nvKeep) A().nestedValues = nvKeep; }
      R.info.stale = staleActs;
      R.chk.nsStaleNoEmpty = !!staleActs && staleActs.indexOf('sortAsc') >= 0 && !staleActs.some(function (a) { return /^nestcol-/.test(a); }) && staleActs.indexOf('copy') < 0;
      // the mouse, flat: Group by SUB_NAME
      var asked = [];
      window.confirm = function (m) { asked.push(String(m)); return true; };
      rclick(th);
      if (isList(item('nestcol-2'))) sub('nestcol-2');
      var pickN = item('groupBy-2');
      if (pickN) pickN.click();
      var g1 = !!pickN && await groupedBy('SUB_NAME');
      await sleep(400);
      R.chk.nsGroups = g1 && bandsMatch('SUB_NAME') && asked.length === 0;
      // the mouse, grouped: Ungroup before the section; SUB_NAME ticked, SUB_ID "instead"; SUB_ID picked
      var gt = g1 ? gth('H_JSON') : null;
      if (gt) rclick(gt);
      var ugFirst = !!gt && acts().indexOf('ungroup') >= 0 && sectionPlaced();
      if (gt && isList(item('nestcol-2'))) sub('nestcol-2');
      var t2 = item('groupBy-2'), tick2 = t2 ? [lab(t2), t2.getAttribute('aria-checked')].join('|') : '';
      if (gt && isList(item('nestcol-0'))) sub('nestcol-0');
      var t0 = item('groupBy-0'), tick0 = t0 ? [lab(t0), t0.getAttribute('aria-checked')].join('|') : '';
      R.info.grouped = { ugFirst: ugFirst, tick2: tick2, tick0: tick0 };
      R.chk.nsGroupedTick = ugFirst && tick2 === 'Group by SUB_NAME|true' && tick0 === 'Group by SUB_ID instead|false';
      if (t0 && tick0) t0.click();
      var g2 = !!t0 && !!tick0 && await groupedBy('SUB_ID');
      await sleep(400);
      R.chk.nsRegroup = g2 && bandsMatch('SUB_ID');
      closeMenu();
      // the keyboard, flat: the menu from the heading, ArrowDown to SUB_NAME, ArrowRight opens its list on Group by (the
      // heading is no stop), Enter groups; then the copy: ArrowDown to Copy distinct values, ArrowRight, comma, Enter
      async function kbdTo(el, act) {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        el.focus(); rclick(el, true);
        for (var n = 0; n < 40 && menu() && (document.activeElement && document.activeElement.getAttribute('data-act')) !== act; n++) keyOn('ArrowDown');
        return !!document.activeElement && document.activeElement.getAttribute('data-act') === act;
      }
      await flat();
      await sleep(300);
      var kth = fth('H_JSON');
      var onN = await kbdTo(kth, 'nestcol-2');
      if (onN) keyOn('ArrowRight');
      await sleep(100);
      var ae = document.activeElement;
      R.info.kbd = { onN: onN, ae: ae ? ae.getAttribute('data-act') : null, sub: !!subPanel() };
      R.chk.nsKbdOpens = onN && !!subPanel() && !!ae && ae.getAttribute('data-act') === 'groupBy-2' && subPanel().contains(ae);
      if (R.chk.nsKbdOpens) keyOn('Enter');
      var g3 = R.chk.nsKbdOpens && await groupedBy('SUB_NAME');
      await sleep(400);
      R.chk.nsKbdPick = !!g3 && !menu() && bandsMatch('SUB_NAME');
      await flat();
      await sleep(300);
      var clipsBefore = (window.__clip || []).length;
      var onN2 = await kbdTo(fth('H_JSON'), 'nestcol-2');
      if (onN2) { keyOn('ArrowRight'); await sleep(80); keyOn('ArrowDown'); }
      var onCopy = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'nestcopy-2';
      if (onCopy) { keyOn('ArrowRight'); await sleep(80); }
      var onSpace = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'nestcopy-2-space';
      if (onSpace) { keyOn('ArrowDown'); keyOn('Enter'); }
      await sleep(700);
      R.info.kbdCopy = { onN2: onN2, onCopy: onCopy, onSpace: onSpace, clips: (window.__clip || []).length - clipsBefore };
      R.chk.nsKbdCopy = onCopy && onSpace && (window.__clip || []).length > clipsBefore && lastClip() === distinctSub('SUB_NAME').join(',');
      closeMenu();
      // a menu taller than the window scrolls (held to 150px here): End, then Home, keeps the keyboard's item in sight - the
      // menu's own scroll, never the page's
      var sth = fth('H_JSON');
      if (!sth.hasAttribute('tabindex')) sth.setAttribute('tabindex', '0');
      sth.focus(); rclick(sth, true);
      var mEl = menu(), y0 = window.scrollY;
      function inSight() { var ae = document.activeElement; if (!mEl || !ae || !mEl.contains(ae)) return false; var r = ae.getBoundingClientRect(), mr = mEl.getBoundingClientRect(); return r.top >= mr.top - 1 && r.bottom <= mr.bottom + 1; }
      if (mEl) mEl.style.maxHeight = '150px';
      keyOn('End'); await sleep(80);
      var endOk = !!mEl && inSight() && mEl.scrollTop > 0;
      keyOn('Home'); await sleep(80);
      var homeOk = !!mEl && inSight() && mEl.scrollTop === 0;
      R.info.kbdScroll = { endOk: endOk, homeOk: homeOk, top: mEl ? mEl.scrollTop : null, y: [y0, window.scrollY], ae: document.activeElement && document.activeElement.getAttribute('data-act') };
      R.chk.nsKbdScroll = endOk && homeOk && window.scrollY === y0;
      closeMenu();
    },
    // (2026-10-25, nestgb / nestcopy) the grouped view a report opens in (by H_GROUP; the List layout's module loaded, as index.php
    // has it): H_JSON's heading has Ungroup and the Nested columns section, its items "instead", nothing ticked; from the keyboard
    // SUB_NAME regroups (13 groups); there SUB_NAME is ticked and picking it again changes nothing; Copy distinct values in the
    // grouped view copies every group's rows' values
    ggnest: async function () {
      var l = A().layout();
      l.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = true; });
      A().applyLayout(l);
      await sleep(700);
      function isList(el) { return !!el && el.getAttribute('aria-haspopup') === 'menu'; }
      function lab(el) { var x = el && el.querySelector('.pnb-hm-label'); return x ? x.textContent : ''; }
      function nestActs() { return acts().filter(function (a) { return /^nestcol-/.test(a); }); }
      var names = Object.create(null), blank = false;
      window.__rowsFixture.forEach(function (r) { if (!r.H_JSON) { blank = true; return; } JSON.parse(r.H_JSON.substring(6)).forEach(function (x) { names[String(x.SUB_NAME)] = 1; }); });
      var wantN = Object.keys(names).length + (blank ? 1 : 0);
      var th = gth('H_JSON');
      if (th) rclick(th);
      R.info.section = th ? { acts: acts(), labels: nestActs().map(function (a) { return lab(item(a)); }) } : null;
      var secOk = !!th && acts().indexOf('ungroup') >= 0 && acts().indexOf('groupBy') < 0 && acts().indexOf('copy') < 0
        && nestActs().map(function (a) { return lab(item(a)); }).join() === 'SUB_ID,SUB_AMT,SUB_NAME';
      if (secOk && isList(item('nestcol-1'))) sub('nestcol-1');
      var g1 = item('groupBy-1');
      R.chk.gnSection = secOk && !!g1 && lab(g1) === 'Group by SUB_AMT instead' && g1.getAttribute('aria-checked') === 'false';
      closeMenu();
      // the keyboard: from the heading, ArrowDown to SUB_NAME, ArrowRight (onto Group by), Enter
      var kth = gth('H_JSON');
      if (kth && !kth.hasAttribute('tabindex')) kth.setAttribute('tabindex', '0');
      if (kth) { kth.focus(); rclick(kth, true); }
      for (var n = 0; n < 40 && menu() && (document.activeElement && document.activeElement.getAttribute('data-act')) !== 'nestcol-2'; n++) keyOn('ArrowDown');
      var onN = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'nestcol-2';
      if (onN) keyOn('ArrowRight');
      await sleep(100);
      var ae = document.activeElement;
      R.info.kbd = { onN: onN, ae: ae ? ae.getAttribute('data-act') : null, label: lab(ae) };
      R.chk.gnKbdOpens = onN && !!subPanel() && !!ae && ae.getAttribute('data-act') === 'groupBy-2' && lab(ae) === 'Group by SUB_NAME instead';
      if (R.chk.gnKbdOpens) keyOn('Enter');
      var g = R.chk.gnKbdOpens && await groupedBy('SUB_NAME');
      await sleep(700);
      R.info.after = { gcol: A() && A().groupingColumn(), groups: tops().length, want: wantN, list: glOn() };
      R.chk.gnKbdPick = !!g && !menu() && tops().length === wantN && wantN > 5;
      // ticked now; picked again, nothing changes (the same group boxes)
      var t2 = g ? gth('H_JSON') : null, before = tops()[0] || null;
      if (t2) rclick(t2);
      if (t2 && isList(item('nestcol-2'))) sub('nestcol-2');
      var tk = item('groupBy-2');
      R.info.tick = tk ? [lab(tk), tk.getAttribute('aria-checked')] : null;
      R.chk.gnTick = !!tk && lab(tk) === 'Group by SUB_NAME' && tk.getAttribute('aria-checked') === 'true';
      if (tk && R.chk.gnTick) tk.click();
      await sleep(900);
      R.chk.gnTickNoop = !!tk && R.chk.gnTick && !!before && tops()[0] === before && document.contains(before) && A().groupingColumn() === 'SUB_NAME';
      closeMenu();
      // Copy distinct values in the grouped view: every group's rows (a newline between values)
      window.__clip = window.__clip || [];
      var t3 = gth('H_JSON');
      if (t3) rclick(t3);
      if (t3 && isList(item('nestcol-2'))) sub('nestcol-2');
      if (isList(item('nestcopy-2'))) sub('nestcopy-2');
      var cn = item('nestcopy-2-newline');
      if (cn) cn.click();
      await sleep(700);
      var got = (window.__clip.length ? window.__clip[window.__clip.length - 1] : '') || '';
      R.info.copy = got.slice(0, 120);
      R.chk.gnCopyGrouped = !!cn && got.split('\n').sort().join() === Object.keys(names).sort().join();
      closeMenu();
      // (2026-10-25, neststats, the review) grouped, with a search typed there (it marks the grouped rows alone): a column's
      // Column stats count the rows it keeps, each row once though it sits in several groups
      function setSearchGg(t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); }
      A().filterAdd('V_STATUS', 'Open', false);
      await sleep(900);
      var seenIx = Object.create(null), wantG = 0, headG = '';
      Array.prototype.forEach.call(document.querySelectorAll('#groupedResultsContainer table tbody tr:not(.search-hidden)'), function (tr) {
        var ix = tr.getAttribute('data-row-index');
        if (ix === null) { var hc = tr.querySelector("td[data-column='#']"); ix = hc ? parseInt(hc.textContent, 10) - 1 : NaN; } else { ix = parseInt(ix, 10); }
        if (isNaN(ix) || ix < 0 || seenIx[ix]) return;
        seenIx[ix] = 1;
        var r = window.__rowsFixture[ix];
        if (r && r.H_JSON) wantG += JSON.parse(r.H_JSON.substring(6)).length;
      });
      var tg = gth('H_JSON');
      if (tg) {
        rclick(tg);
        if (isList(item('nestcol-1'))) sub('nestcol-1');
        if (isList(item('neststats-1'))) sub('neststats-1');
        var pg = subPanel(), hg = pg ? pg.querySelector('.pnb-hm-head') : null;
        headG = hg ? hg.textContent : '';
        closeMenu();
      }
      setSearchGg('');
      await sleep(900);
      R.info.statsG = { want: wantG, head: headG, rows: Object.keys(seenIx).length };
      R.chk.gnStatsGrouped = wantG > 0 && Object.keys(seenIx).length < 300 && headG.indexOf('Over the ' + wantG.toLocaleString() + ' rows of its tables') === 0;
    },
    // (2026-10-25, nestgb2; the user: "@@JSON column names shouldn't appear in the command palette's group by, but the
    // nested columns should (just like in group mode UI)") a group's band menu, grouped by H_GROUP then H_GROUP2 with the
    // nested-table columns shown: no list names one; the top level's list ends with their tables' columns, under Nested
    // table columns, one item for a name two tables share; a level below and Add a level below list none (the dialog offers
    // them at level 1 alone) and their Other column... names no nested fields; a pick regroups as the dialog does with the
    // same levels (the groups compared), ticked after, with its Undo; from the keyboard; a hidden one's tables are not read.
    gnnestbd: async function () {
      var G = GM();
      var l = A().layout();
      l.cols.forEach(function (c) { if (NB_COLS.indexOf(c.colName) >= 0) c.visible = true; });
      A().applyLayout(l);
      await sleep(700);
      if (G && tops()[0]) G.layout('stacked', tops()[0]);   // chosen: a regroup keeps it
      await sleep(300);
      var want = nbWant(NB_COLS), wantActs = want.map(function (s) { return 'gby:' + s; });
      function topBand() { var w = tops()[0]; return w ? w.querySelector(':scope > .group-header') : null; }
      function inner() { var w = tops()[0]; return w ? w.querySelector('.group-wrapper[data-group-depth="1"] > .group-header') : null; }
      function listOf(el, parent) { closeMenu(); if (!el || !rclick(el) || !sub(parent)) { closeMenu(); return []; } return nbSeq(); }
      function titleOf(act) { var x = item(act); return x ? (x.getAttribute('title') || '') : null; }
      function noParent(s) { return NB_COLS.every(function (c) { return s.indexOf('gby:' + c) < 0 && s.indexOf('gadd:' + c) < 0; }); }
      function noNest(s) { return s.indexOf('H:Nested table columns') < 0 && want.every(function (n) { return s.indexOf('gby:' + n) < 0 && s.indexOf('gadd:' + n) < 0; }); }
      function plainToo(s) { return s.indexOf('gby:V_STATUS') >= 0 || s.indexOf('gadd:V_STATUS') >= 0; }
      // the four lists: the top band's Group this level by and Add a level below, the inner band's two
      var tBy = listOf(topBand(), 'gBy'), tByOther = titleOf('gby-other');
      var tAdd = listOf(topBand(), 'gAdd');
      var iBy = listOf(inner(), 'gBy'), iByOther = titleOf('gby-other');
      var iAdd = listOf(inner(), 'gAdd'), iAddOther = titleOf('gadd-other');
      closeMenu();
      R.info.lists = { want: want, tBy: tBy, tAdd: tAdd, iBy: iBy, iAdd: iAdd, titles: [tByOther, iByOther, iAddOther], levels: levelsNow() };
      var hi = tBy.indexOf('H:Nested table columns');
      R.chk.nbTopList = levelsNow() === 'H_GROUP,H_GROUP2' && hi > 1 && tBy[hi - 1] === '-' && tBy.slice(0, hi - 1).every(function (a) { return /^gby:V_/.test(a); })
        && tBy.indexOf('gby:V_STATUS') >= 0 && tBy.slice(hi + 1, hi + 1 + want.length).join() === wantActs.join()
        && tBy[hi + 1 + want.length] === '-' && tBy[hi + 2 + want.length] === 'gby-other' && tBy.length === hi + 3 + want.length;
      R.chk.nbDedupe = tBy.filter(function (a) { return a === 'gby:SUB_NAME'; }).length === 1 && tBy.indexOf('gby:ENT_KIND') >= 0 && tBy.indexOf('gby:NOTE_KIND') >= 0;
      R.chk.nbNoParent = [tBy, tAdd, iBy, iAdd].every(function (s) { return plainToo(s) && noParent(s); });
      R.chk.nbInnerNone = [tAdd, iBy, iAdd].every(function (s) { return plainToo(s) && noNest(s); });
      R.chk.nbOtherTitle = /nested fields/.test(tByOther || '') && iByOther !== null && !/nested/.test(iByOther) && iAddOther !== null && !/nested/.test(iAddOther);
      // the mouse: SUB_NAME for the top level - the notice with its Undo, the pick ticked after
      var asked = [];
      window.confirm = function (m) { asked.push(String(m)); return true; };
      window.__toasts.length = 0;
      var picked = await chooseIn(topBand(), 'gBy', 'gby:SUB_NAME');
      var g1 = picked && await until(function () { return levelsNow() === 'SUB_NAME,H_GROUP2'; }, 15000);
      await sleep(500);
      var s1 = g1 ? nbShape() : '', ub = undoBtn(/Grouped level 1 by SUB_NAME/);
      var tk = null;
      if (g1) { var sb = listOf(topBand(), 'gBy'), x = item('gby:SUB_NAME'); tk = (x && sb.length) ? x.getAttribute('aria-checked') : null; }
      closeMenu();
      R.info.pick = { picked: picked, levels: levelsNow(), groups: tops().length, asked: asked.slice(), toasts: window.__toasts.slice(-2), tick: tk };
      R.chk.nbPickTick = !!g1 && tk === 'true';
      if (ub) ub.click();
      R.chk.nbUndo = !!ub && await until(function () { return levelsNow() === 'H_GROUP,H_GROUP2'; }, 15000);
      await sleep(400);
      // the same levels from the dialog: the same groups
      var s2 = await nbDialog(['SUB_NAME', 'H_GROUP2']);
      R.info.shapes = { n: [s1.split('|').length, s2.split('|').length], s1: s1.slice(0, 240), s2: s2.slice(0, 240) };
      R.chk.nbPick = !!g1 && !!ub && asked.length === 0 && !!s1 && s1 === s2 && tops().length > 5;
      // the keyboard: a top band's name, Shift+F10, down to Group this level by, ArrowRight, down to SUB_ID, Enter
      var bN = topBand(), nmEl = bN ? bN.querySelector('.group-name') : null;
      if (nmEl) { nmEl.focus(); rclick(nmEl, true); }
      for (var n = 0; n < 40 && menu() && (document.activeElement && document.activeElement.getAttribute('data-act')) !== 'gBy'; n++) keyOn('ArrowDown');
      var onBy = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'gBy';
      if (onBy) keyOn('ArrowRight');
      await sleep(100);
      for (var n2 = 0; n2 < 40 && subPanel() && (document.activeElement && document.activeElement.getAttribute('data-act')) !== 'gby:SUB_ID'; n2++) keyOn('ArrowDown');
      var onSub = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'gby:SUB_ID' && !!subPanel() && subPanel().contains(document.activeElement);
      if (onSub) keyOn('Enter');
      var g3 = onSub && await until(function () { return levelsNow() === 'SUB_ID,H_GROUP2'; }, 15000);
      await sleep(400);
      R.info.kbd = { onBy: onBy, onSub: onSub, levels: levelsNow() };
      R.chk.nbKbd = !!g3 && !menu();
      closeMenu();
      // (a guard) a hidden nested-table column's tables are not read: H_ENT hidden, ENT_KIND goes (SUB_NAME stays H_JSON's)
      var l2 = A().layout();
      l2.cols.forEach(function (c) { if (c.colName === 'H_ENT') c.visible = false; });
      A().applyLayout(l2);
      await sleep(700);
      var hBy = listOf(topBand(), 'gBy');
      closeMenu();
      R.info.hidden = hBy;
      R.chk.nbHiddenNot = plainToo(hBy) && hBy.indexOf('gby:ENT_KIND') < 0 && hBy.indexOf('gby:H_ENT') < 0;
      // ...the list: the shown ones' tables' columns alone, SUB_NAME kept (H_JSON's tables, shown, hold it too)
      var hi2 = hBy.indexOf('H:Nested table columns'), wantH = nbWant(['H_TEXT', 'H_JSON', 'H_NULL']);
      R.chk.nbHiddenList = hi2 > 0 && hBy.slice(hi2 + 1, hi2 + 1 + wantH.length).join() === wantH.map(function (s) { return 'gby:' + s; }).join()
        && hBy[hi2 + 1 + wantH.length] === '-' && wantH.indexOf('SUB_NAME') >= 0;
    },
    // (2026-10-25, nestgb2) the status bar's grouping chip (index.php's, lifted for this scenario), grouped by H_GROUP with
    // every nested-table column hidden (the chip lists every column): no button for one; their tables' columns after the
    // others, under Nested table columns, one button for a shared name; SUB_NAME groups as the dialog does (the groups
    // compared) and is the one lit after; the plain columns keep their buttons, the one grouped by lit (a guard)
    gchipnest: async function () {
      var G = GM();
      if (G && tops()[0]) G.layout('stacked', tops()[0]);   // chosen: the chip's regroup keeps it
      await sleep(300);
      var want = nbWant(NB_COLS);
      function open() { if (!$('#sbColsSeg').hasClass('sb-grp-open')) $('#sbGroup').trigger('click'); }
      function shut() { if ($('#sbColsSeg').hasClass('sb-grp-open')) $('#sbGroup').trigger('click'); }
      function cseq() {
        return Array.prototype.map.call(document.querySelectorAll('#sbGrpCols > *'), function (e) {
          if (e.classList.contains('sb-grp-col')) return 'B:' + e.getAttribute('data-col') + (e.classList.contains('sb-grp-active') ? '*' : '');
          return e.classList.contains('sb-pop-h') ? 'H:' + e.textContent + (e.classList.contains('sb-mt') ? '^' : '') : '?' + e.tagName;
        });
      }
      open();
      await sleep(200);
      var s = cseq();
      R.info.chip = { s: s, want: want, open: $('#sbColsSeg').hasClass('sb-grp-open'), lifted: !!document.getElementById('sbGrpCols') };
      var bi = s.indexOf('H:Nested table columns^');
      R.chk.ncNoParent = s.length > 5 && NB_COLS.every(function (c) { return s.indexOf('B:' + c) < 0 && s.indexOf('B:' + c + '*') < 0; });
      R.chk.ncPlain = s.indexOf('B:V_STATUS') >= 0 && s.indexOf('B:H_GROUP2') >= 0 && s.indexOf('B:H_GROUP*') >= 0;
      R.chk.ncNestList = bi > 0 && s.slice(0, bi).every(function (x) { return /^B:/.test(x); })
        && s.slice(bi + 1).join() === want.map(function (x) { return 'B:' + x; }).join();
      // SUB_NAME: grouped by it, as the dialog groups by it; lit when the chip opens again
      var asked = [];
      window.confirm = function (m) { asked.push(String(m)); return true; };
      var bt = document.querySelector('#sbGrpCols .sb-grp-col[data-col="SUB_NAME"]');
      if (bt) bt.click();
      var g1 = !!bt && await groupedBy('SUB_NAME');
      await sleep(500);
      var s1 = g1 ? nbShape() : '';
      open();
      await sleep(200);
      var sa = cseq();
      shut();
      R.info.after = { s: sa, levels: levelsNow(), groups: tops().length, asked: asked.slice() };
      R.chk.ncActive = !!g1 && sa.indexOf('B:SUB_NAME*') >= 0 && sa.filter(function (x) { return /\*$/.test(x); }).length === 1;
      var s2 = await nbDialog(['SUB_NAME']);
      R.info.shapes = { n: [s1.split('|').length, s2.split('|').length], s1: s1.slice(0, 240), s2: s2.slice(0, 240) };
      R.chk.ncPick = !!g1 && asked.length === 0 && !!s1 && s1 === s2 && tops().length > 5;
    },
    // (2026-10-26, cstat) Column stats in the grouped view (H_GROUP) with a search typed there - it marks the grouped rows
    // alone, never the flat table's: the rows it keeps (a column's counts, a number's spread, a journal toggle's boxes), as
    // with a search typed before grouping (a guard: live counts that one right) and with none (a guard: every row, read in
    // the groups though all are closed); grouped by SUB_NAME (a row sits in the group of each name its table holds): each
    // row once, and a row whose copy in one group is hidden (a group a summary condition hides marks its own rows) still
    // counted by its copy in another, first copy or last.
    ggstat: async function () {
      var GR = '#groupedResultsContainer table tbody tr';
      function ixOf(tr) { var a = tr.getAttribute('data-row-index'), h; if (a !== null) return parseInt(a, 10); h = tr.querySelector("td[data-column='#']"); return h ? parseInt(h.textContent, 10) - 1 : NaN; }
      // the grouped rows the search keeps: their rows, each once, and every copy
      function keptG() {
        var seen = Object.create(null), ix = [], copies = [];
        Array.prototype.forEach.call(document.querySelectorAll(GR), function (tr) {
          var i = ixOf(tr);
          if (isNaN(i) || i < 0 || !window.__rowsFixture[i] || tr.classList.contains('search-hidden')) return;
          copies.push(tr);
          if (!seen[i]) { seen[i] = 1; ix.push(i); }
        });
        return { ix: ix, copies: copies };
      }
      function flatHidden() { return document.querySelectorAll('#resultsTable > tbody > tr.search-hidden').length; }
      function flatKept() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable > tbody > tr'), function (tr) { var i = ixOf(tr); return i >= 0 && !!window.__rowsFixture[i] && !tr.classList.contains('search-hidden'); }).length; }
      function headFor(n) { return 'Over the ' + n.toLocaleString() + (n === 1 ? ' row' : ' rows') + ' the filter keeps'; }
      // a grouped heading of the column, one on screen where there is one (a closed group's, a List's other group's, else)
      function gthShown(col) {
        var all = document.querySelectorAll('#groupedResultsContainer table thead th[data-colname="' + col + '"]');
        for (var i = 0; i < all.length; i++) { if (all[i].getClientRects().length) return all[i]; }
        return all[0] || null;
      }
      // its Column stats list: the count heading and the facts
      function statsG(col) {
        closeMenu();
        var th = gthShown(col), o = null;
        if (th && rclick(th) && sub('stats') && subPanel()) {
          var hs = Array.prototype.map.call(subPanel().querySelectorAll('.pnb-hm-head'), function (e) { return e.textContent; });
          o = { head: hs.filter(function (t) { return /^Over the |^No rows/.test(t); })[0] || '', inf: infoMap() };
        }
        closeMenu();
        return o;
      }
      async function marked(want) { return await until(function () { return !!document.querySelector(GR + '.search-hidden') === want; }, 8000); }
      async function cleared() { snipAction('search', ''); var ok = await until(function () { return !flatHidden() && !document.querySelector(GR + '.search-hidden') && keptG().ix.length === 300; }, 10000); await sleep(400); return ok; }
      var openIx = [];
      window.__rowsFixture.forEach(function (r, i) { if (r.V_STATUS === 'Open') openIx.push(i); });
      var openN = openIx.length;
      // no search: every row, read in the groups though every group is closed
      $('#collapseAllGroups').trigger('click');
      var shut = await until(function () { return tops().length > 1 && tops().every(function (w) { return !w.classList.contains('open'); }); }, 5000);
      await sleep(250);
      var s0 = statsG('V_STATUS');
      R.info.csAll = { s: s0, groups: tops().length, closed: shut, gcol: A() && A().groupingColumn(), list: glOn() };
      R.chk.csAll = shut && !!s0 && s0.head === headFor(300) && s0.inf['With a value'] === '300';
      $('#expandAllGroups').trigger('click');
      await sleep(250);
      // a search typed while grouped (Filter to "Open" adds it to the box): the grouped rows marked, the flat table's not
      var fa = A().filterAdd('V_STATUS', 'Open', false);
      var mk = await marked(true);
      await sleep(500);
      var k1 = keptG(), s1 = statsG('V_STATUS');
      R.info.csCount = { added: fa, marked: mk, search: searchVal(), open: openN, kept: k1.ix.length, flatHidden: flatHidden(), s: s1 };
      R.chk.csCount = mk && openN > 0 && openN < 300 && k1.ix.length === openN && flatHidden() === 0 && !!s1 && s1.head === headFor(openN)
        && s1.inf['With a value'] === String(openN) && s1.inf['Unique'] === '1' && s1.inf['Empty'] === '0';
      // a number's spread over those rows
      var amts = openIx.map(function (i) { return parseFloat(String(window.__rowsFixture[i].V_AMOUNT).replace(/[$,]/g, '')); }).sort(function (x, y) { return x - y; });
      var aSum = 0;
      amts.forEach(function (v) { aSum += v; });
      var nf = function (x) { return Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 }); };
      var sA = statsG('V_AMOUNT');
      R.info.csNum = { got: sA, want: [nf(amts[0]), nf(amts[amts.length - 1]), nf(aSum)] };
      R.chk.csNum = mk && amts.length === openN && !!sA && sA.head === headFor(openN) && sA.inf['Smallest'] === nf(amts[0])
        && sA.inf['Largest'] === nf(amts[amts.length - 1]) && sA.inf['Total'] === nf(aSum);
      // a journal toggle's boxes on those rows (the two hooks main.js asks stubbed, as mflat's are)
      var P = window.Penumbra, keepF = P.journalFriendlyCol, keepV = P.journalSearchColumnValue;
      var jOn = openIx.filter(function (i) { return (parseInt(String(window.__rowsFixture[i].V_ID).slice(3), 10) - 1001) % 3 === 0; }).length;
      P.journalFriendlyCol = function (c) { return c === 'V_STATUS' ? 'Done' : (keepF ? keepF(c) : null); };
      P.journalSearchColumnValue = function (m, up) {
        if (up === 'V_STATUS') return { kind: 'toggle', on: (parseInt(String(m.get('V_ID')).slice(3), 10) - 1001) % 3 === 0 };
        return keepV ? keepV(m, up) : null;
      };
      var sJ = null;
      try { sJ = statsG('V_STATUS'); } finally { P.journalFriendlyCol = keepF; P.journalSearchColumnValue = keepV; }
      R.info.csJournal = { got: sJ, want: [jOn, openN - jOn] };
      R.chk.csJournal = mk && jOn > 0 && jOn < openN && !!sJ && sJ.inf['Checked'] === String(jOn) && sJ.inf['Unchecked'] === String(openN - jOn);
      // a search typed BEFORE grouping (a guard: live counts it right): the groups are drawn from the rows it keeps
      var c1 = await cleared();
      var fl = await flat();
      A().filterAdd('V_STATUS', 'Open', false);
      var fm = await until(function () { return flatKept() === openN; }, 8000);
      await sleep(400);
      var rg = await oneClick('H_GROUP') && await until(function () { return keptG().ix.length === openN; }, 8000);
      await sleep(400);
      var k2 = keptG(), s2 = statsG('V_STATUS');
      R.info.csBefore = { cleared: c1, flat: fl, flatMarked: fm, regrouped: rg, kept: k2.ix.length, flatHidden: flatHidden(), s: s2 };
      R.chk.csBefore = fl && fm && rg && k2.ix.length === openN && !!s2 && s2.head === headFor(openN) && s2.inf['With a value'] === String(openN);
      // grouped by SUB_NAME, a search typed there: each row once, though it sits in the group of every name its table holds
      var c2 = await cleared();
      var gs = await oneClick('SUB_NAME') && await until(function () { return keptG().ix.length === 300 && tops().length > 6; }, 10000);
      await sleep(400);
      A().filterAdd('V_STATUS', 'Open', false);
      var mk3 = await marked(true);
      await sleep(500);
      var k3 = keptG(), s3 = statsG('V_STATUS');
      R.info.csOnce = { cleared: c2, grouped: gs, gcol: A() && A().groupingColumn(), groups: tops().length, list: glOn(), marked: mk3,
        kept: k3.ix.length, copies: k3.copies.length, flatHidden: flatHidden(), s: s3 };
      R.chk.csOnce = gs && mk3 && k3.ix.length === openN && k3.copies.length > k3.ix.length && !!s3 && s3.head === headFor(openN)
        && s3.inf['With a value'] === String(openN);
      // a row kept in two groups, one copy hidden (as a group a summary condition hides marks its own rows) - its first, then
      // its last: still counted, by the other
      var byIx = Object.create(null), two = null;
      k3.copies.forEach(function (tr) { var i = ixOf(tr); (byIx[i] = byIx[i] || []).push(tr); });
      Object.keys(byIx).some(function (i) { if (byIx[i].length > 1) { two = byIx[i]; return true; } return false; });
      function withHidden(tr) {
        if (tr) tr.classList.add('search-hidden');
        try { return statsG('V_STATUS'); } finally { if (tr) tr.classList.remove('search-hidden'); }
      }
      var s4 = two ? withHidden(two[0]) : null, s5 = two ? withHidden(two[two.length - 1]) : null;
      R.info.csShownCopy = { row: two ? ixOf(two[0]) : null, copies: two ? two.length : 0, first: s4, last: s5 };
      R.chk.csShownCopy = !!two && [s4, s5].every(function (s) { return !!s && s.head === headFor(openN) && s.inf['With a value'] === String(openN); });
    },
    // ---- (2026-10-27, copymenu; the user: "The 3 copy menus can be combined into one copy menu (value, column name, distinct
    // values) in the right click menus"; they chose This row, then Link to this view in place of For SQL) ONE Copy list: on a
    // cell, in its place, This value, This row, Column name, Distinct values (its delimiters), Link to this view (a saved
    // report); on a heading where Copy distinct values was; an item alone keeps its own name (a '#' cell on an unsaved
    // report: Copy this row; Clipboard hidden: Copy column name)
    mcopym: async function () {
      function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      function lab(el) { var x = el && el.querySelector('.pnb-hm-label'); return x ? x.textContent : ''; }
      function note(el) { var x = el && el.querySelector('.pnb-hm-note'); return x ? x.textContent : ''; }
      function isList(el) { return !!el && el.getAttribute('aria-haspopup') === 'menu'; }
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && !!tr.querySelector('td[data-column]'); }); }
      function cellAt(name, i) { var t = fth(name), tr = visTrs()[i || 0]; return (t && tr) ? tr.querySelector('td[data-column="' + t.getAttribute('data-column') + '"]') : null; }
      function flatHeads() { return document.querySelectorAll('#tableHeader > th'); }
      function distinctOf(name) {
        var seen = [], set = Object.create(null);
        visTrs().forEach(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1], v = r ? r[name] : null; if (v != null && v !== '' && !set[v]) { set[v] = 1; seen.push(String(v)); } });
        return seen;
      }
      // a cell: Filter to, Exclude, then Copy - its list This value, This row, Column name, Distinct values
      var c0 = cellAt('V_NAME', 1), tr0 = c0 ? c0.closest('tr') : null;
      closeMenu(); rclick(c0);
      var a0 = acts(), cp = item('copyMenu');
      R.info.cell = a0;
      R.chk.cmCell = !!cp && lab(cp) === 'Copy' && isList(cp) && a0[0] === 'filterMenu' && a0[1] === 'copyMenu'   // (2026-10-27, fltmenu) the Filter list first
        && ['cellCopy', 'copyRow', 'copyName', 'copy'].every(function (x) { return a0.indexOf(x) < 0; }) && a0.indexOf('sortAsc') > 1;
      sub('copyMenu'); await sleep(100);
      var l0 = subActs(), n0 = subLabels(), sp0 = subPanel();
      R.info.list = [l0, n0];
      // (2026-10-27, cpsplit; the user) the value copy named by the value itself (cut to 28, an empty one (blank)),
      // This entire row, Distinct column values
      var v0 = c0 ? c0.innerText.replace(/\s+/g, ' ').trim() : '', v0l = v0 === '' ? '(blank)' : (v0.length > 28 ? v0.slice(0, 27) + '...' : v0);
      R.chk.cmList = l0.join() === 'cellCopy,copyName,copyRow,copy' && n0.join() === [v0l, 'V_NAME', 'This entire row', 'Distinct column values'].join()   // (2026-10-27, fltmenu) [column name] above This entire row
        && isList(item('copy')) && !isList(item('copyRow')) && !!sp0 && sp0.getAttribute('aria-label') === 'Copy';
      closeMenu();
      // This value: the text the cell shows
      await choose(c0, 'cellCopy');
      R.chk.cmValue = !!c0 && lastClip() === c0.innerText.trim();
      // This row: each shown column, "Name: value", one per line, in the table's order ('#' aside)
      var w0 = tr0 ? rowWant(tr0, flatHeads()) : [];
      await choose(c0, 'copyRow');
      R.info.row = { got: lastClip(), want: w0.join('\n'), toast: lastToast() };
      R.chk.cmRow = w0.length === 6 && lastClip() === w0.join('\n') && /Copied the row \(6 columns\)/.test(lastToast());
      // a column hidden is left out; one shown again comes in, at its place
      var lay = A().layout();
      lay.cols.forEach(function (c) { if (c.colName === 'V_DATE') c.visible = false; if (c.colName === 'H_GROUP') c.visible = true; });
      A().applyLayout(lay); await sleep(500);
      var c1 = cellAt('V_NAME', 2), tr1 = c1 ? c1.closest('tr') : null, w1 = tr1 ? rowWant(tr1, flatHeads()) : [];
      await choose(c1, 'copyRow');
      var got1 = lastClip() || '';
      R.info.rowLayout = { got: got1, want: w1.join('\n') };
      R.chk.cmRowLayout = w1.length === 6 && got1 === w1.join('\n') && got1.indexOf('V_DATE:') < 0 && got1.indexOf('H_GROUP:') >= 0;
      lay = A().layout();
      lay.cols.forEach(function (c) { if (c.colName === 'V_DATE') c.visible = true; if (c.colName === 'H_GROUP') c.visible = false; });
      A().applyLayout(lay); await sleep(500);
      // a value of several lines goes on under its name, indented
      var c2 = cellAt('V_NAME', 3), keep2 = c2 ? c2.innerHTML : '';
      if (c2) c2.innerHTML = 'Line one<br>Line two';
      await choose(c2, 'copyRow');
      var got2 = lastClip() || '';
      if (c2) c2.innerHTML = keep2;
      R.info.rowLines = got2;
      R.chk.cmRowLines = got2.indexOf('V_NAME: Line one\n  Line two\n') >= 0;
      // a heading: Copy where Copy distinct values was (after the layout tools, before Calculated column), its list Column
      // name and Distinct values
      closeMenu(); rclick(fth('V_STATUS'));
      var a3 = acts(), cpi = a3.indexOf('copyMenu');
      R.info.head = a3;
      R.chk.cmHead = cpi > 0 && a3[cpi + 1] === 'filter' && cpi < a3.indexOf('stats') && cpi < a3.indexOf('hide')   // (copymenu 3) right above Filter by value...
        && ['cellCopy', 'copyRow', 'copyName', 'copy'].every(function (x) { return a3.indexOf(x) < 0; });
      sub('copyMenu'); await sleep(100);
      R.info.headList = subActs();
      R.chk.cmHeadList = subActs().join() === 'copyName,copy';
      closeMenu();
      await choose(fth('V_STATUS'), 'copyName');
      R.chk.cmName = lastClip() === 'V_STATUS';
      // (copymenu 2: the user took For SQL out) Distinct values: the delimiters, then Other... - no For SQL
      closeMenu(); rclick(fth('V_STATUS'));
      var oth = reach('copy-other'), dl = subActs();
      R.info.distinct = dl;
      R.chk.cmDistinct = !!oth && dl[dl.length - 1] === 'copy-other' && dl.indexOf('copy-sql') < 0
        && ['copy-space', 'copy-comma', 'copy-semicolon', 'copy-pipe', 'copy-tab', 'copy-newline'].every(function (a) { return dl.indexOf(a) >= 0; });
      closeMenu();
      // the report hiding Clipboard: a cell's Copy keeps This value, This row and Column name, no Distinct values; a heading's
      // Column name alone, by its own name
      var a5 = [], l5 = [], a6 = [], n6 = null;
      document.body.classList.add('restrict-clipboard');
      try {
        closeMenu(); rclick(c0); a5 = acts(); sub('copyMenu'); await sleep(100); l5 = subActs(); closeMenu();
        rclick(fth('V_NAME')); a6 = acts(); n6 = item('copyName') ? lab(item('copyName')) : null; closeMenu();
      } finally { document.body.classList.remove('restrict-clipboard'); }
      R.info.clipOff = { cell: a5, list: l5, head: a6, name: n6 };
      R.chk.cmClipOff = a5[1] === 'copyMenu' && l5.join() === 'cellCopy,copyName,copyRow' && a6.indexOf('copyMenu') < 0 && a6.indexOf('copy') < 0 && n6 === 'Copy column name';
      // (copymenu 2; the user: "replace with 'Link to this view', with the tooltip explaining") Link to this view: last in the
      // list after a separator, where the page can make a view link (main.js PenumbraViewLink: a saved report - this harness has
      // no report id, so none by default); its title says what the link carries; it runs the page's own copy (Copy's Copy a link
      // to this view); on a heading and on a '#' cell too (there with This row: a list, no longer the item alone)
      closeMenu(); rclick(c0); sub('copyMenu'); await sleep(100);
      var vl0 = subActs();
      closeMenu();
      R.chk.cmViewLinkNone = vl0.length > 0 && vl0.indexOf('copyViewLink') < 0;
      var VL = window.PenumbraViewLink, vlKeep = VL ? { av: VL.available, cp: VL.copy } : null, vlCalls = 0, vlList = [], vlTitle = '', vlLab = '', vlSep = false, vlHead = [], vlNum = [];
      if (VL) { VL.available = function () { return true; }; VL.copy = function () { vlCalls++; return Promise.resolve({}); }; }
      try {
        closeMenu(); rclick(c0); sub('copyMenu'); await sleep(100);
        vlList = subActs();
        var vli = item('copyViewLink');
        vlTitle = vli ? (vli.getAttribute('title') || '') : ''; vlLab = lab(vli);
        vlSep = !!vli && !!vli.previousElementSibling && vli.previousElementSibling.classList.contains('pnb-hm-sep');
        if (vli) vli.click();
        await sleep(300);
        closeMenu(); rclick(fth('V_STATUS')); sub('copyMenu'); await sleep(100); vlHead = subActs(); closeMenu();
        var trv = visTrs()[6]; rclick(trv ? trv.cells[0] : null); vlNum = acts(); closeMenu();
      } finally { if (VL && vlKeep) { VL.available = vlKeep.av; VL.copy = vlKeep.cp; } }
      R.info.viewLink = { list: vlList, label: vlLab, sep: vlSep, title: vlTitle, calls: vlCalls, head: vlHead, num: vlNum };
      // (fltmenu, 5eae534) the column's name sits above This entire row
      R.chk.cmViewLink = vlList.join() === 'cellCopy,copyName,copyRow,copy,copyViewLink' && vlSep && vlLab === 'Link to this view'
        && /reopens this report as you see it now/.test(vlTitle) && /It carries no data/.test(vlTitle) && vlCalls === 1
        && vlHead.join() === 'copyName,copy,copyViewLink' && vlNum.indexOf('copyMenu') >= 0 && vlNum.indexOf('copyRow') < 0;
      // (copymenu 3; the user: "Add a 'Copy' static header in the flyover menu so everything below makes more instant sense",
      // "When right clicking headers, move the copy menu to be above the filter to value item") the Copy list opens under a
      // static heading, Copy (no act: the keys and the palette pass it), on a cell and on a heading; a heading's Copy sits right
      // above Filter by value... (a column without it: where it would be, after the sorts); a cell's Filter and Copy lead its menu
      var firstRow = function () { var p = subPanel(), f = p ? p.firstElementChild : null; return f ? [f.className, f.getAttribute('role') || '', f.textContent.trim(), f.getAttribute('data-act') || ''] : []; };
      var isHead = function (r) { return r.length === 4 && /(^| )pnb-hm-head( |$)/.test(r[0]) && r[1] === 'presentation' && r[2] === 'Copy' && r[3] === ''; };
      var beforeOk = ['sortAsc', 'sortDesc', 'thenAsc', 'thenDesc', 'sortClear', 'about'];
      // (the review) the list's first item, not its heading, level with Copy: the pointer moving across lands on an item
      var alignOf = function () { var sp = subPanel(), it = item('copyMenu'), fi = sp ? sp.querySelector('.pnb-hm-item') : null, hd = sp ? sp.querySelector('.pnb-hm-head') : null;
        if (!sp || !it || !fi || !hd) { return null; } var a = it.getBoundingClientRect(), b = fi.getBoundingClientRect(), c = hd.getBoundingClientRect(); return [Math.round(a.top), Math.round(b.top), Math.round(c.top), Math.round(c.bottom)]; };
      var aligned = function (v) { return !!v && Math.abs(v[1] - v[0]) <= 3 && v[3] <= v[1] + 1 && v[2] < v[0]; };
      closeMenu(); rclick(c0); var hc0 = acts(); sub('copyMenu'); await sleep(100);
      var hcRow = firstRow(), hcActs = subActs(), hcAlign = alignOf(); closeMenu();
      rclick(fth('V_STATUS')); var hh = acts(); sub('copyMenu'); await sleep(100);
      var hhRow = firstRow(), hhAlign = alignOf(); closeMenu();
      rclick(fth('H_JSON')); var hn = acts(); closeMenu();
      R.info.copyHead = { cellTop: hc0, cellRow: hcRow, cellList: hcActs, cellAlign: hcAlign, headTop: hh, headRow: hhRow, headAlign: hhAlign, nestTop: hn };
      R.chk.cmHeadAlign = aligned(hcAlign) && aligned(hhAlign);
      var hhAt = hh.indexOf('copyMenu'), hnAt = hn.indexOf('copyName');
      R.chk.cmHeadRow = isHead(hcRow) && hcActs[0] === 'cellCopy' && isHead(hhRow);
      R.chk.cmHeadPlace = hhAt > 0 && hh[hhAt + 1] === 'filter' && beforeOk.indexOf(hh[hhAt - 1]) >= 0 && hc0[0] === 'filterMenu' && hc0[1] === 'copyMenu';
      R.chk.cmHeadNoFilter = hn.indexOf('filter') < 0 && hnAt > 0 && beforeOk.indexOf(hn[hnAt - 1]) >= 0;
      // a '#' cell: This row alone, by its own name; the '#' heading: no copy at all
      var trn = visTrs()[4], num = trn ? trn.cells[0] : null;
      closeMenu(); rclick(num);
      var a7 = acts(), r7 = item('copyRow'), w7 = trn ? rowWant(trn, flatHeads()) : [];
      R.info.num = { acts: a7, label: lab(r7) };
      var ok7 = !!r7 && lab(r7) === 'Copy this row' && !isList(r7) && a7.indexOf('copyMenu') < 0;
      if (r7) r7.click();
      await sleep(400);
      R.chk.cmNumRow = ok7 && w7.length === 6 && lastClip() === w7.join('\n');
      closeMenu(); rclick(document.querySelector('#tableHeader th[data-column="#"]'));
      var a8 = acts();
      R.chk.cmNumHead = !!menu() && ['copyMenu', 'copyRow', 'copyName', 'copy', 'cellCopy'].every(function (x) { return a8.indexOf(x) < 0; });
      closeMenu();
      // from the keyboard: the cell's menu, down to Copy, ArrowRight opens its list on This value, Enter copies it
      var c9 = cellAt('V_NAME', 5);
      closeMenu(); rclick(c9, true);
      await sleep(80);
      function key(k) { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      var steps = 0;
      while (document.activeElement && document.activeElement.getAttribute('data-act') !== 'copyMenu' && steps < 8) { key('ArrowDown'); steps++; await sleep(30); }
      var onCopy = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'copyMenu';
      key('ArrowRight'); await sleep(150);
      var onVal = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'cellCopy';
      var nB = window.__clip.length;
      key('Enter'); await sleep(450);
      R.info.kbd = { steps: steps, onCopy: onCopy, onVal: onVal, clips: window.__clip.length - nB };
      R.chk.cmKbd = onCopy && onVal && window.__clip.length === nB + 1 && !!c9 && lastClip() === c9.innerText.trim();
      closeMenu();
      // a nested table's sub-cell: Copy with This value (the sub-cell's), This row (the row it sits in), Column name - no
      // Distinct values; the row's line for the nested column: its name, then each row of its table, "KEY: value, ..."
      lay = A().layout(); lay.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = true; }); A().applyLayout(lay); await sleep(600);
      var FX = window.__rowsFixture, jid = fth('H_JSON').getAttribute('data-column'), jtd = null;
      visTrs().some(function (tr) { var td = tr.querySelector('td[data-column="' + jid + '"]'); if (td && td.querySelector('.nested-json-row:not(.nested-total-row) .nested-json-cell')) { jtd = td; return true; } return false; });
      var subc = jtd ? jtd.querySelector('.nested-json-row:not(.nested-total-row) .nested-json-cell') : null;
      closeMenu(); rclick(subc);
      var a10 = acts(); sub('copyMenu'); await sleep(100);
      var l10 = subActs(); closeMenu();
      R.info.nested = { acts: a10, list: l10 };
      R.chk.cmNestList = !!subc && a10.indexOf('copyMenu') >= 0 && l10.join() === 'cellCopy,copyName,copyRow,copyNestedTable';   // (2026-10-27, fltmenu)
      var jtr = jtd ? jtd.closest('tr') : null, jr = jtr ? FX[parseInt(jtr.cells[0].textContent, 10) - 1] : null;
      var arr = (jr && jr.H_JSON) ? JSON.parse(jr.H_JSON.substring(6)) : [], ks = arr.length ? Object.keys(arr[0]).filter(function (x) { return x !== '__PNBDIFF'; }) : [];
      var wantJ = 'H_JSON:' + arr.map(function (o) { return '\n  ' + ks.map(function (x) { return x + ': ' + (o[x] == null ? '' : String(o[x]).trim()); }).join(', '); }).join('');
      await choose(subc, 'copyRow');
      var gotJ = lastClip() || '';
      R.info.nestRow = { got: gotJ.slice(0, 500), want: wantJ.slice(0, 500) };
      R.chk.cmNestRow = arr.length > 0 && (gotJ + '\n').indexOf(wantJ + '\n') >= 0;
      // a nested column's own list (Nested columns): its delimiters, then Other... - no For SQL (copymenu 2)
      closeMenu(); rclick(fth('H_JSON'));
      if (isList(item('nestcol-2'))) sub('nestcol-2');
      if (isList(item('nestcopy-2'))) sub('nestcopy-2');
      await sleep(100);
      var nsl = subActs();
      R.info.nestList = nsl;
      R.chk.cmNestNoSql = nsl.length > 0 && nsl[nsl.length - 1] === 'nestcopy-2-other' && nsl.indexOf('nestcopy-2-sql') < 0;
      closeMenu();
      // a journal toggle's line reads Yes or No; Notes come along only where the report puts notes in copies
      var P = window.Penumbra;
      if (typeof P.journalPaintFor === 'function') {
        window._penumbraJournalKeyColumns = ['V_ID']; window._penumbraToggleState = { k1: {} }; window._penumbraRowNoteCounts = {};
        P.journalPaintFor([{ key: 'k1', label: 'Done' }], true);
        await sleep(300);
        var tgd = document.querySelector('#resultsTable tbody tr td.journal-toggle-col'), tgr = tgd ? tgd.closest('tr') : null;
        var box = tgd ? tgd.querySelector('.journal-toggle-box') : null, nt = tgr ? tgr.querySelector('td.journal-notes-col') : null;
        var tth = document.querySelector('#tableHeader th[data-column="__JOURNAL_TOGGLE__k1"]'), nth = document.querySelector('#tableHeader th[data-column="__JOURNAL_NOTES"]');
        var vtd = tgr ? tgr.querySelector('td[data-column="1"]') : null, outNotes = nt ? P.journalExportCell(nt) : 'n/a';
        var tl = tth ? headLabel(tth) : 'Done', nl = nth ? headLabel(nth) : 'Notes';
        var was = box ? box.getAttribute('aria-checked') : null;
        if (box) box.setAttribute('aria-checked', 'false');
        await choose(vtd, 'copyRow');
        var gNo = '\n' + (lastClip() || '') + '\n';
        if (box) box.setAttribute('aria-checked', 'true');
        await choose(vtd, 'copyRow');
        var gYes = '\n' + (lastClip() || '') + '\n';
        if (box && was !== null) box.setAttribute('aria-checked', was);
        R.info.jrnRow = { no: gNo.slice(0, 300), yes: gYes.slice(0, 300), notesOut: outNotes, labels: [tl, nl] };
        R.chk.cmJournal = !!box && gNo.indexOf('\n' + tl + ': No\n') >= 0 && gYes.indexOf('\n' + tl + ': Yes\n') >= 0
          && (outNotes === null ? gNo.indexOf('\n' + nl + ':') < 0 : gNo.indexOf('\n' + nl + ': ') >= 0);
      } else { R.info.jrnRow = 'no journalPaintFor'; }
    },
    // (2026-10-27, fltmenu) a cell's Filter list (Filter to, Exclude, Filter by value..., At least / At most, Click to filter),
    // a heading's kept flat; Highlight... gone; Copy's [column name] before This entire row, This nested table, Distinct column groups
    mfltm: async function () {
      function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      function lab(el) { var x = el && el.querySelector('.pnb-hm-label'); return x ? x.textContent : ''; }
      function isList(el) { return !!el && el.getAttribute('aria-haspopup') === 'menu'; }
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && !!tr.querySelector('td[data-column]'); }); }
      function cellAt(name, i) { var t = fth(name), tr = visTrs()[i || 0]; return (t && tr) ? tr.querySelector('td[data-column="' + t.getAttribute('data-column') + '"]') : null; }
      function shownOf(td) { var s = td ? td.innerText.replace(/\s+/g, ' ').trim() : ''; return s === '' ? '(blank)' : (s.length > 28 ? s.slice(0, 27) + '...' : s); }
      function rng(col) { var b = A().filterBuckets(col); return b ? b.range : null; }
      function numOf(s) { var t = String(s).replace(/[$,\s]/g, ''); return parseFloat(t); }
      function sepBefore(act) { var p = subPanel(), it = p ? p.querySelector('[data-act="' + act + '"]') : null, prev = it ? it.previousElementSibling : null; return !!prev && prev.classList.contains('pnb-hm-sep'); }
      function clearBox() { var s = document.getElementById('tableSearch'); s.value = ''; if (typeof window.runTableSearch === 'function') window.runTableSearch(); else $(s).trigger('input'); }
      // a text cell: Filter (a list) first, then Copy; nothing of the list at the top level
      var c0 = cellAt('V_NAME', 1);
      closeMenu(); rclick(c0);
      var a0 = acts(), fm = item('filterMenu');
      R.info.cell = a0;
      R.chk.fmCell = !!fm && lab(fm) === 'Filter' && isList(fm) && a0[0] === 'filterMenu' && a0[1] === 'copyMenu'
        && ['cellFilter', 'cellExclude', 'filter', 'clickFilter'].every(function (x) { return a0.indexOf(x) < 0; });
      sub('filterMenu'); await sleep(100);
      var l0 = subActs(), n0 = subLabels();
      R.info.list = [l0, n0];
      var w0 = c0 ? c0.innerText.trim() : '', q0 = '"' + (w0.length > 28 ? w0.slice(0, 27) + '...' : w0) + '"';
      R.chk.fmList = l0.join() === 'cellFilter,cellExclude,filter,clickFilter' && n0.join() === ['Filter to ' + q0, 'Exclude ' + q0, 'Filter by value...', 'Click to filter'].join()
        && sepBefore('clickFilter') && !!subPanel() && subPanel().getAttribute('aria-label') === 'Filter';
      closeMenu();
      // Filter to and Filter by value... still run from the list
      SUBS.cellFilter = SUBS.cellExclude = SUBS.cellAtLeast = SUBS.cellAtMost = SUBS.clickFilter = 'filterMenu';
      await choose(c0, 'cellFilter');
      R.chk.fmFilterRuns = searchVal().indexOf('V_NAME') >= 0 && searchVal().indexOf(w0) >= 0;
      clearBox(); await sleep(400);
      // a number: At least / At most its value, shown as the cell shows it, after Filter by value...
      var c1 = cellAt('V_AMOUNT', 2);
      closeMenu(); rclick(c1); sub('filterMenu'); await sleep(100);
      var l1 = subActs(), n1 = subLabels();
      R.info.num = [l1, n1];
      R.chk.fmNumList = l1.join() === 'cellFilter,cellExclude,filter,cellAtLeast,cellAtMost,clickFilter'
        && n1[3] === 'At least ' + shownOf(c1) && n1[4] === 'At most ' + shownOf(c1);
      closeMenu();
      // At least: the column's low bound, the value itself; the rows left all hold at least it
      var x1 = c1 ? numOf(c1.innerText) : NaN;
      await choose(c1, 'cellAtLeast'); await sleep(300);
      var r1 = rng('V_AMOUNT'), vis1 = visTrs().map(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1]; return r ? numOf(r.V_AMOUNT) : NaN; });
      R.info.atLeast = { box: searchVal(), range: r1, x: x1, n: vis1.length };
      R.chk.fmAtLeast = isFinite(x1) && !!r1 && r1.min === x1 && r1.max === null && vis1.length > 0 && vis1.indexOf(x1) >= 0 && vis1.every(function (v) { return v >= x1; });
      // At most a bigger value keeps the low bound; At least one past the high bound takes it away
      var amts = visTrs().map(function (tr) { var td = tr.querySelector('td[data-column="' + fth('V_AMOUNT').getAttribute('data-column') + '"]'); return { td: td, v: td ? numOf(td.innerText) : NaN }; })
        .filter(function (o) { return isFinite(o.v); }).sort(function (a, b) { return a.v - b.v; });
      var hiC = amts.length > 2 ? amts[Math.floor(amts.length / 2)] : null;
      if (hiC) await choose(hiC.td, 'cellAtMost');
      await sleep(300);
      var r2 = rng('V_AMOUNT');
      R.info.keep = { range: r2, hi: hiC ? hiC.v : null };
      R.chk.fmKeepOther = !!hiC && hiC.v > x1 && !!r2 && r2.min === x1 && r2.max === hiC.v;
      var top = amts.length ? amts[amts.length - 1] : null;
      if (top) await choose(top.td, 'cellAtLeast');
      await sleep(300);
      var r3 = rng('V_AMOUNT');
      R.info.drop = { range: r3, top: top ? top.v : null };
      R.chk.fmDropOther = !!top && top.v > (hiC ? hiC.v : Infinity) && !!r3 && r3.min === top.v && r3.max === null;
      clearBox(); await sleep(400);
      // a date: On or after / On or before, its bound an ISO day
      var c4 = cellAt('V_DATE', 3);
      closeMenu(); rclick(c4); sub('filterMenu'); await sleep(100);
      var n4 = subLabels(), l4 = subActs(); closeMenu();
      var fx4 = c4 ? window.__rowsFixture[parseInt(c4.closest('tr').cells[0].textContent, 10) - 1] : null;
      var md = fx4 ? String(fx4.V_DATE).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null, iso4 = md ? md[3] + '-' + ('0' + md[1]).slice(-2) + '-' + ('0' + md[2]).slice(-2) : null;
      await choose(c4, 'cellAtMost'); await sleep(300);
      var r4 = A().filterBuckets('V_DATE'), rg4 = r4 ? r4.range : null;
      R.info.date = { labels: n4, iso: iso4, range: rg4 };
      R.chk.fmDate = l4.indexOf('cellAtLeast') >= 0 && n4.indexOf('On or after ' + shownOf(c4)) >= 0 && n4.indexOf('On or before ' + shownOf(c4)) >= 0
        && !!iso4 && !!rg4 && rg4.max === iso4 && rg4.min === null;
      clearBox(); await sleep(400);
      // a text column has no bounds (fmList); a heading keeps Filter by value... on its own, no list, no Click to filter, no Highlight...
      closeMenu(); rclick(fth('V_AMOUNT'));
      var a5 = acts(), all5 = allItems().map(function (e) { return e.getAttribute('data-act'); });
      R.info.head = a5;
      R.chk.fmHead = a5.indexOf('filter') >= 0 && a5.indexOf('filterMenu') < 0 && all5.indexOf('clickFilter') < 0 && all5.indexOf('cellAtLeast') < 0;
      R.chk.fmNoHighlight = !!menu() && all5.indexOf('highlight') < 0 && a5.indexOf('options') >= 0;
      closeMenu(); rclick(c0);
      R.chk.fmNoHighlightCell = !!menu() && acts().indexOf('highlight') < 0;
      closeMenu();
      // Click to filter: Column options' Filter switch for the column - off, on (its cells click-filter), off again
      function cflt() { var td = cellAt('V_NAME', 4); return !!td && td.classList.contains('pnb-cflt'); }
      function cfItem() { closeMenu(); rclick(cellAt('V_NAME', 4)); sub('filterMenu'); var it = item('clickFilter'), o = it ? { checked: it.getAttribute('aria-checked'), dis: it.getAttribute('aria-disabled') === 'true', title: it.getAttribute('title') || '' } : null; closeMenu(); return o; }
      var off0 = cfItem(), cl0 = cflt();
      await choose(cellAt('V_NAME', 4), 'clickFilter'); await sleep(400);
      var on1 = cfItem(), cl1 = cflt(), t1 = lastToast();
      await choose(cellAt('V_NAME', 4), 'clickFilter'); await sleep(400);
      var off2 = cfItem(), cl2 = cflt();
      R.info.click = { off0: off0, on1: on1, off2: off2, cls: [cl0, cl1, cl2], toast: t1 };
      R.chk.fmClick = !!off0 && off0.checked === 'false' && !cl0 && !!on1 && on1.checked === 'true' && cl1 && /Click to filter is on for/.test(t1)
        && !!off2 && off2.checked === 'false' && !cl2 && /Column options/.test(off0.title);
      // the report's View Options Click to filter (every column): ticked and greyed
      document.body.classList.add('pnb-click-filter');
      var forced = null;
      try { forced = cfItem(); } finally { document.body.classList.remove('pnb-click-filter'); }
      R.chk.fmForced = !!forced && forced.checked === 'true' && forced.dis;
      // Copy: the value, the column's name (named by itself), This entire row, Distinct column values
      closeMenu(); rclick(c0); sub('copyMenu'); await sleep(100);
      var l6 = subActs(), n6 = subLabels(); closeMenu();
      R.info.copy = [l6, n6];
      R.chk.fmCopyOrder = l6.slice(0, 4).join() === 'cellCopy,copyName,copyRow,copy' && n6[1] === 'V_NAME' && n6[2] === 'This entire row' && n6[3] === 'Distinct column values';
      await choose(c0, 'copyName');
      R.chk.fmCopyName = lastClip() === 'V_NAME';
      // a heading's Copy list: the name by itself too
      closeMenu(); rclick(fth('V_STATUS')); sub('copyMenu'); await sleep(100);
      var l7 = subActs(), n7 = subLabels(); closeMenu();
      R.info.headCopy = [l7, n7];
      R.chk.fmHeadName = l7[0] === 'copyName' && n7[0] === 'V_STATUS';
      // Distinct column groups on a date column: its groups (By Year...), each a delimiter list; the copy = the groups of the
      // rows kept, each once, in order
      closeMenu(); rclick(fth('V_DATE')); sub('copyMenu'); await sleep(100);
      var l8 = subActs(), gi = item('copyGroups');
      if (isList(gi)) sub('copyGroups');
      await sleep(100);
      var l9 = subActs();
      if (isList(item('copyGroup-year'))) sub('copyGroup-year');
      await sleep(100);
      var l10 = subActs(), dc = item('copyGroup-year-comma');
      if (dc) dc.click();
      await sleep(400);
      var yrs = [], ys = Object.create(null);
      visTrs().forEach(function (tr) { var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1], m = r ? String(r.V_DATE).match(/(\d{4})/) : null; if (m && !ys[m[1]]) { ys[m[1]] = 1; yrs.push(m[1]); } });
      yrs.sort();
      R.info.groups = { copy: l8, groups: l9, delims: l10, got: lastClip(), want: yrs.join(','), toast: lastToast() };
      R.chk.fmGroupsList = l8[l8.length - 1] === 'copyGroups' && isList(gi) && lab(gi) === 'Distinct column groups' && l9.indexOf('copyGroup-year') >= 0 && l9.indexOf('copyGroup-month') >= 0
        && ['copyGroup-year-space', 'copyGroup-year-comma', 'copyGroup-year-newline'].every(function (a) { return l10.indexOf(a) >= 0; });
      R.chk.fmGroupsCopy = yrs.length > 1 && lastClip() === yrs.join(',') && /Copied \d+ distinct groups \(By Year\)/.test(lastToast());
      closeMenu();
      // a number column's ranges: the groups in order (each label's low end rising)
      closeMenu(); rclick(fth('V_AMOUNT'));
      var gl = reach('copyGroups'), nl = null;
      if (gl) { sub('copyGroups'); await sleep(100); var bins = subActs().filter(function (a) { return /^copyGroup-[a-z]+$/.test(a); }); if (bins.length) { sub(bins[0]); await sleep(100); nl = item(bins[0] + '-newline'); } }
      if (nl) nl.click();
      await sleep(400);
      var bl = (lastClip() || '').split('\n'), lows = bl.map(function (s) { var m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; });
      R.info.bins = { got: bl.slice(0, 8), want: typeof A().groupValues === 'function' ? A().groupValues('V_AMOUNT', 'V_AMOUNT:' + (nl ? nl.getAttribute('data-act').split('-')[1] : 'bin')) : null };   // (none on live: the control)
      R.chk.fmGroupsNum = !!nl && bl.length > 1 && lows.every(function (v, i) { return isFinite(v) && (i === 0 || v > lows[i - 1]); })
        && bl.join('|') === (R.info.bins.want || []).join('|');
      closeMenu();
      // a text column has none; nor where the report hides Clipboard
      closeMenu(); rclick(fth('V_STATUS'));
      var noTxt = allItems().every(function (e) { return e.getAttribute('data-act') !== 'copyGroups'; }); reach('copyName'); noTxt = noTxt && !item('copyGroups'); closeMenu();
      document.body.classList.add('restrict-clipboard');
      var noClip = false;
      try { closeMenu(); rclick(fth('V_DATE')); reach('copyName'); noClip = !!menu() && !item('copyGroups'); closeMenu(); } finally { document.body.classList.remove('restrict-clipboard'); }
      R.chk.fmGroupsNone = noTxt && noClip;
      // a nested table's sub-cell: Filter (Filter to, Click to filter), Copy with This nested table after This entire row
      var lay = A().layout(); lay.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = true; }); A().applyLayout(lay); await sleep(600);
      var FX = window.__rowsFixture, jid = fth('H_JSON').getAttribute('data-column'), jtd = null;
      visTrs().some(function (tr) { var td = tr.querySelector('td[data-column="' + jid + '"]'); if (td && td.querySelector('.nested-json-row:not(.nested-total-row) .nested-json-cell')) { jtd = td; return true; } return false; });
      var subc = jtd ? jtd.querySelector('.nested-json-row:not(.nested-total-row) .nested-json-cell') : null;
      closeMenu(); rclick(subc);
      var a11 = acts(); sub('filterMenu'); await sleep(100);
      var l11 = subActs(); closeMenu(); rclick(subc); sub('copyMenu'); await sleep(100);
      var l12 = subActs(); closeMenu();
      R.info.nested = { acts: a11, filter: l11, copy: l12 };
      R.chk.fmNestLists = !!subc && a11[0] === 'filterMenu' && l11.join() === 'cellFilter,clickFilter' && l12.join() === 'cellCopy,copyName,copyRow,copyNestedTable';
      SUBS.copyNestedTable = 'copyMenu';
      var jtr = jtd ? jtd.closest('tr') : null, jr = jtr ? FX[parseInt(jtr.cells[0].textContent, 10) - 1] : null;
      var arr = (jr && jr.H_JSON) ? JSON.parse(jr.H_JSON.substring(6)) : [], ks = arr.length ? Object.keys(arr[0]).filter(function (x) { return x !== '__PNBDIFF'; }) : [];
      var wantJ = arr.map(function (o) { return ks.map(function (x) { return x + ': ' + (o[x] == null ? '' : String(o[x]).trim()); }).join(', '); }).join('\n');
      await choose(subc, 'copyNestedTable');
      R.info.nestCopy = { got: (lastClip() || '').slice(0, 400), want: wantJ.slice(0, 400), toast: lastToast() };
      R.chk.fmNestCopy = arr.length > 0 && lastClip() === wantJ && /Copied the nested table \(\d+ rows?\)/.test(lastToast());
      // the cell around the table (no sub-cell): This nested table too
      var pad = jtd;
      closeMenu(); rclick(pad); sub('copyMenu'); await sleep(100);
      var l13 = subActs(); closeMenu();
      R.chk.fmNestPad = l13.indexOf('copyNestedTable') >= 0 && l13.indexOf('copyRow') >= 0;
      lay = A().layout(); lay.cols.forEach(function (c) { if (c.colName === 'H_JSON') c.visible = false; }); A().applyLayout(lay); await sleep(400);
      // '#' cell: no Filter list (nothing to filter by), This row alone still
      var trn = visTrs()[4], num = trn ? trn.cells[0] : null;
      closeMenu(); rclick(num);
      var a14 = acts(); closeMenu();
      R.chk.fmNumCell = a14.indexOf('filterMenu') < 0 && a14.indexOf('copyRow') >= 0;
      // the keyboard: the cell's menu opens on Filter, ArrowRight enters it on Filter to
      closeMenu(); rclick(cellAt('V_NAME', 6), true); await sleep(80);
      function key(k) { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
      var onF = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'filterMenu';
      key('ArrowRight'); await sleep(150);
      var onTo = !!document.activeElement && document.activeElement.getAttribute('data-act') === 'cellFilter';
      R.chk.fmKbd = onF && onTo;
      closeMenu();
    },
    // (2026-10-27, copymenu) the grouped view: a cell's Copy list as the flat table's; This row reads the group table's own
    // heading row
    ggcopym: async function () {
      function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      var tabs = Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer table'), function (t) { return !!t.querySelector('thead th[data-colname="V_NAME"]') && !!t.querySelector('tbody tr td[data-column]'); });
      var tb = tabs[0] || null, th = tb ? tb.querySelector('thead th[data-colname="V_NAME"]') : null, cid = th ? th.getAttribute('data-column') : null;
      var tr = tb ? Array.prototype.filter.call(tb.querySelectorAll('tbody tr'), function (x) { return !x.classList.contains('search-hidden') && !!x.querySelector('td[data-column="' + cid + '"]'); })[0] : null;
      var td = tr ? tr.querySelector('td[data-column="' + cid + '"]') : null;
      closeMenu(); rclick(td);
      var a = acts(); sub('copyMenu'); await sleep(100);
      var l = subActs(); closeMenu();
      R.info.grouped = { tables: tabs.length, acts: a, list: l };
      R.chk.gcList = !!td && a.indexOf('copyMenu') >= 0 && l.join() === 'cellCopy,copyName,copyRow,copy';   // (2026-10-27, fltmenu)
      var want = tr ? rowWant(tr, th.parentNode.children) : [];
      await choose(td, 'copyRow');
      R.info.gRow = { got: lastClip(), want: want.join('\n') };
      R.chk.gcRow = want.length >= 5 && lastClip() === want.join('\n');
    },
    // (2026-10-30, selflt) a right-click inside a selection of several cells acts on the selection: Filter to / Exclude the
    // selected values (a column's values alternatives, every column's held, the box's other conditions kept), Copy > The
    // selected cells (Ctrl+C's text and table, after the press on the item cleared the selection); outside it, the cell's
    // own; past 100 values greyed. Alt+click adds a cell's value (click-to-filter off and on: never the box replaced); a
    // link and '#' keep their click. A selection of text alone: Filter to selection in the readout (numbers: none).
    msel: async function () {
      // cell selection, as index.php loads it (this harness writes it for gg* / mauto* alone)
      if (!(window.Penumbra && window.Penumbra.cellSel)) {
        var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'penumbra_cellsel.css'; document.head.appendChild(lk);
        var sc = document.createElement('script'); sc.src = 'penumbra_cellsel.js'; document.body.appendChild(sc);
      }
      if (!(await until(function () { return !!(window.Penumbra && window.Penumbra.cellSel); }, 8000))) throw new Error('no cell selection module');
      var CS = window.Penumbra.cellSel;
      SUBS.selFilter = SUBS.selExclude = 'filterMenu'; SUBS.selCopy = 'copyMenu';
      function lastClip() { return window.__clip.length ? window.__clip[window.__clip.length - 1] : null; }
      function lab(el) { var x = el && el.querySelector('.pnb-hm-label'); return x ? x.textContent : ''; }
      function noteOf(el) { var x = el && el.querySelector('.pnb-hm-note'); return x ? x.textContent : ''; }
      function visTrs() { return Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && !!tr.querySelector('td[data-column]'); }); }
      function trOf(num) { return visTrs().filter(function (tr) { return tr.cells[0].textContent.trim() === String(num); })[0] || null; }
      function cellIn(tr, name) { var t = fth(name); return (t && tr) ? tr.querySelector('td[data-column="' + t.getAttribute('data-column') + '"]') : null; }
      function fx(tr) { return window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1]; }
      function low(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
      async function boxTo(q) { var s = document.getElementById('tableSearch'); s.value = q; if (typeof window.runTableSearch === 'function') window.runTableSearch(); else $(s).trigger('input'); await sleep(900); }
      function pick(list) { return CS.select(list.map(function (td) { return { a: td, b: td }; })); }
      function press(el) { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1 })); }
      async function runItem(el, act) { closeMenu(); rclick(el); var it = reach(act); if (!it || it.getAttribute('aria-disabled') === 'true') { closeMenu(); return false; } press(it); it.click(); await sleep(900); return true; }
      // an unrelated condition first (it must stay); then two names of rows sharing a status, and the first row's status
      await boxTo('V_AMOUNT > 0');
      var trs = visTrs(), ti = trs[1], tj = null;
      for (var k = 2; k < trs.length && !tj; k++) { if (low(fx(trs[k]).V_STATUS) === low(fx(ti).V_STATUS) && low(fx(trs[k]).V_NAME) !== low(fx(ti).V_NAME)) tj = trs[k]; }
      if (!ti || !tj) throw new Error('fixture: no two names of one status');
      var ni = ti.cells[0].textContent.trim(), nj = tj.cells[0].textContent.trim();
      var a = cellIn(ti, 'V_NAME'), b = cellIn(tj, 'V_NAME'), c = cellIn(ti, 'V_STATUS');
      var va = A().cellValue(a, 'V_NAME'), vb = A().cellValue(b, 'V_NAME'), vc = A().cellValue(c, 'V_STATUS');
      var n0 = pick([a, b, c]), cl = CS.cells ? CS.cells() : [];
      R.chk.selCells = n0 === 3 && cl.length === 3 && [a, b, c].every(function (td) { return cl.indexOf(td) >= 0; });
      // the right-click inside it: the Filter list is the selection's (no Filter to "value", Exclude, At least...)
      closeMenu(); rclick(b);
      var a0 = acts(); sub('filterMenu'); await sleep(100);
      var l0 = subActs(), fi = item('selFilter');
      R.info.menu = { acts: a0, list: l0, note: noteOf(fi), title: fi ? fi.getAttribute('title') : null, va: va, vb: vb, vc: vc };
      R.chk.selMenu = a0[0] === 'filterMenu' && a0[1] === 'copyMenu' && l0.join() === 'selFilter,selExclude,filter,clickFilter' && lab(fi) === 'Filter to the selected values'
        && lab(item('selExclude')) === 'Exclude the selected values';
      // (the first item takes the focus as the list opens: jQuery UI's tooltip then holds its title, in the tip it points to)
      function tipOf(el) { if (!el) return ''; var t = el.getAttribute('title'); if (t) return t; var d = el.getAttribute('aria-describedby'), n = d ? document.getElementById(d) : null; return n ? n.textContent : ''; }
      var t0 = tipOf(fi);
      R.chk.selNote = noteOf(fi) === '3 values, 2 columns' && t0.indexOf(va) >= 0 && t0.indexOf(vb) >= 0 && t0.indexOf(vc) >= 0;
      closeMenu(); rclick(b); sub('copyMenu'); await sleep(100);
      var l1 = subActs(), ci = item('selCopy');
      R.info.copy = { list: l1, note: noteOf(ci) };
      R.chk.selCopyList = l1[0] === 'selCopy' && l1.indexOf('cellCopy') < 0 && l1.indexOf('copyRow') > 0 && lab(ci) === 'The selected cells' && noteOf(ci) === '3 cells';
      closeMenu();
      // Copy > The selected cells: the press on the item clears the selection, the copy is Ctrl+C's (its copy event: text and table)
      var exp = CS.payload(), realExec = document.execCommand, got = null;
      document.execCommand = function (cmd) {
        if (cmd !== 'copy') return realExec.apply(document, arguments);
        var dt = new DataTransfer(), ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
        got = { text: dt.getData('text/plain'), html: dt.getData('text/html'), prevented: ev.defaultPrevented, count: CS.count() };
        return true;
      };
      await runItem(b, 'selCopy');
      R.info.copied = { got: got, exp: exp ? { text: exp.text.slice(0, 300) } : null, toasts: window.__toasts.slice(-2) };
      R.chk.selCopyRuns = !!got && !!exp && got.text === exp.text && got.html === exp.html && got.prevented && got.count === 0 && got.text.indexOf(va) >= 0 && got.text.indexOf(vc) >= 0;
      // ...where the copy event is refused: the text alone, through the clipboard
      document.execCommand = function (cmd) { return cmd === 'copy' ? false : realExec.apply(document, arguments); };
      a = cellIn(trOf(ni), 'V_NAME'); c = cellIn(trOf(ni), 'V_STATUS');
      pick([a, c]); var exp2 = CS.payload();
      await runItem(a, 'selCopy');
      document.execCommand = realExec;
      R.chk.selCopyFallback = !!exp2 && lastClip() === exp2.text;
      // outside the selection: the cell's own list
      pick([a, c]);
      var d = cellIn(visTrs()[6], 'V_NAME');
      closeMenu(); rclick(d); sub('filterMenu'); await sleep(100);
      var l3 = subActs(); closeMenu();
      R.info.outside = l3;
      R.chk.selOutside = l3[0] === 'cellFilter' && l3.indexOf('selFilter') < 0;
      // two cells of one value: still the selection's, one value
      var sj = cellIn(trOf(nj), 'V_STATUS');
      pick([c, sj]);
      closeMenu(); rclick(c); sub('filterMenu'); await sleep(100);
      R.chk.selOne = subActs()[0] === 'selFilter' && noteOf(item('selFilter')) === '1 value';
      closeMenu();
      // past 100 values: greyed, the reason its title
      var rows40 = visTrs().slice(0, 40), blk = CS.select([{ a: cellIn(rows40[0], 'V_ID'), b: cellIn(rows40[rows40.length - 1], 'V_STATUS') }]);
      var A0 = A(), realCV = A0.cellValue, reads = 0;
      A0.cellValue = function () { reads++; return realCV.apply(this, arguments); };
      closeMenu(); rclick(cellIn(rows40[3], 'V_NAME')); sub('filterMenu'); await sleep(100);
      A0.cellValue = realCV;
      var cap = item('selFilter');
      R.info.cap = { cells: blk, note: noteOf(cap), dis: cap ? cap.getAttribute('aria-disabled') : null, title: tipOf(cap), reads: reads };
      R.chk.selCap = blk > 150 && !!cap && cap.getAttribute('aria-disabled') === 'true' && /More than 100 different values/.test(tipOf(cap)) && noteOf(cap) === 'over 100 values';
      R.chk.capStops = reads > 100 && reads < 200;   // (the reading stops past 100 values: 240 cells, about 200 of them different)
      closeMenu();
      // read once per selection: the cell's items built again (Quick actions builds them per keystroke) read only the cell's own
      a = cellIn(trOf(ni), 'V_NAME'); b = cellIn(trOf(nj), 'V_NAME'); c = cellIn(trOf(ni), 'V_STATUS');
      pick([a, b, c]);
      var thb = fth('V_NAME'), cb = { td: b, th: thb, nested: false, target: b };
      reads = 0; A0.cellValue = function () { reads++; return realCV.apply(this, arguments); };
      window.Penumbra.colMenu.items(thb, cb); var rd1 = reads;
      var it2 = window.Penumbra.colMenu.items(thb, cb), rd2 = reads - rd1;
      A0.cellValue = realCV;
      var fm2 = it2.filter(function (x) { return x.act === 'filterMenu'; })[0], fl2 = (fm2 && typeof fm2.items === 'function') ? fm2.items() : [];
      R.info.memo = [rd1, rd2, fl2.map(function (x) { return x && x.act; })];
      R.chk.selMemo = rd1 >= 1 && rd1 <= 4 && rd2 === 1 && fl2.some(function (x) { return x && x.act === 'selFilter'; });
      // Filter to the selected values: a name of either row and the status, the typed condition kept
      a = cellIn(trOf(ni), 'V_NAME'); b = cellIn(trOf(nj), 'V_NAME'); c = cellIn(trOf(ni), 'V_STATUS');
      pick([a, b, c]);
      await runItem(b, 'selFilter');
      var q1 = searchVal(), v1 = visTrs(), names1 = {};
      v1.forEach(function (tr) { names1[low(fx(tr).V_NAME)] = 1; });
      R.info.filter = { q: q1, n: v1.length, names: Object.keys(names1).slice(0, 5) };
      R.chk.selFilterRuns = v1.length > 0 && v1.every(function (tr) { var r = fx(tr); return (low(r.V_NAME) === low(va) || low(r.V_NAME) === low(vb)) && low(r.V_STATUS) === low(vc); })
        && !!names1[low(va)] && !!names1[low(vb)] && /V_NAME = \/\^\(\?:/.test(q1) && /V_STATUS = \/\^\(\?:/.test(q1);
      R.chk.selKeepsBox = q1.indexOf('V_AMOUNT > 0') >= 0 && q1.split(' and ').length === 3;
      // Exclude the selected values: every row holding any of them leaves
      await boxTo('');
      a = cellIn(trOf(ni), 'V_NAME'); c = cellIn(trOf(ni), 'V_STATUS');
      pick([a, c]);
      await runItem(a, 'selExclude');
      var q2 = searchVal(), v2 = visTrs();
      R.info.exclude = { q: q2, n: v2.length };
      R.chk.selExcludeRuns = v2.length > 0 && v2.every(function (tr) { var r = fx(tr); return low(r.V_NAME) !== low(va) && low(r.V_STATUS) !== low(vc); }) && /V_NAME != /.test(q2) && /V_STATUS != /.test(q2);
      // the readout: a selection of text alone offers Filter to selection after Count; one with numbers does not
      await boxTo('');
      a = cellIn(trOf(ni), 'V_NAME'); b = cellIn(trOf(nj), 'V_NAME');
      pick([a, b]); await sleep(150);
      var ro = document.getElementById('pnbCellSelReadout'), fb = ro ? ro.querySelector('.pnb-csel-fltbtn') : null;
      R.info.readout = ro ? ro.innerHTML.slice(0, 500) : null;
      R.chk.roButton = !!fb && fb.textContent === 'Filter to selection' && !ro.querySelector('.pnb-csel-sum') && (fb.getAttribute('title') || '').indexOf(va) >= 0;
      pick([a, cellIn(trOf(ni), 'V_AMOUNT')]); await sleep(150);
      ro = document.getElementById('pnbCellSelReadout');
      R.chk.roNoNumbers = !!ro && !ro.hidden && !!ro.querySelector('.pnb-csel-sum') && !ro.querySelector('.pnb-csel-fltbtn');
      pick([a, b]); await sleep(150);
      fb = document.querySelector('#pnbCellSelReadout .pnb-csel-fltbtn');
      if (fb) { press(fb); fb.click(); }
      await sleep(900);
      var v4 = visTrs();
      R.info.roRun = { q: searchVal(), n: v4.length };
      R.chk.roRuns = !!fb && v4.length > 0 && v4.every(function (tr) { var n = low(fx(tr).V_NAME); return n === low(va) || n === low(vb); }) && /V_NAME = \/\^\(\?:/.test(searchVal());
      // a Mac's Ctrl+click is its right-click: the selection stays for the menu (Cmd adds a cell there); elsewhere Ctrl adds
      function ctrlPress(td) { td.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, ctrlKey: true })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); }
      a = cellIn(trOf(ni), 'V_NAME'); c = cellIn(trOf(ni), 'V_STATUS'); var dd = cellIn(trOf(nj), 'V_NAME');
      pick([a, c]);
      Object.defineProperty(navigator, 'platform', { configurable: true, get: function () { return 'MacIntel'; } });
      ctrlPress(dd); await sleep(50);
      var onMac = CS.count();
      delete navigator.platform;
      ctrlPress(dd); await sleep(50);
      var onWin = CS.count();
      R.info.macCtrl = [onMac, onWin, navigator.platform];
      R.chk.macCtrl = onMac === 2 && onWin === 3;
      // Alt+click adds a cell's value: click-to-filter off, then on (its plain click would replace the box); a link and '#' keep theirs
      await boxTo('');
      var reached = 0;
      function seen(e) { reached++; if (e.target.closest && e.target.closest('a[href]')) e.preventDefault(); }
      document.addEventListener('click', seen);
      function altClick(el) { return !el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true, button: 0 })); }
      document.body.classList.remove('pnb-click-filter');
      var p5 = altClick(cellIn(trOf(ni), 'V_NAME')); await sleep(900);
      var q5 = searchVal();
      document.body.classList.add('pnb-click-filter');
      var r0 = reached;
      altClick(cellIn(trOf(ni), 'V_STATUS')); await sleep(900);
      var q6 = searchVal(), r6 = reached - r0;
      R.info.alt = { q5: q5, q6: q6, prevented: p5, reached: r6 };
      R.chk.altAdds = p5 && /^V_NAME = \/\^\(\?:/.test(q5) && q6.indexOf('V_NAME = ') >= 0 && q6.indexOf('V_STATUS = ') >= 0 && q6.indexOf('//') < 0 && r6 === 0;
      // a double-click's second click adds nothing (and the click-to-filter on still never takes it)
      var dEv = new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true, button: 0, detail: 2 }), rd0 = reached;
      cellIn(trOf(ni), 'V_AMOUNT').dispatchEvent(dEv); await sleep(900);
      R.info.altDouble = { q: searchVal(), prevented: dEv.defaultPrevented, reached: reached - rd0 };
      R.chk.altDouble = searchVal() === q6 && dEv.defaultPrevented && reached === rd0;
      var lnk = document.querySelector('#resultsTable tbody tr:not(.search-hidden) td a[href]'), num = document.querySelector('#resultsTable tbody tr:not(.search-hidden) td[data-column="#"]');
      var before = searchVal(), r1 = reached;
      if (lnk) altClick(lnk);
      if (num) altClick(num);
      await sleep(600);
      R.info.altKeep = { link: !!lnk, num: !!num, reached: reached - r1, q: searchVal() };
      R.chk.altLinkNum = !!lnk && !!num && reached - r1 === 2 && searchVal() === before;
      // a plain click with click-to-filter on still puts its value in place of the box (the report's own, untouched)
      var pc = cellIn(visTrs()[0], 'V_STATUS'), pv = pc ? A().cellValue(pc, 'V_STATUS') : '';
      if (pc) pc.click();
      await sleep(900);
      R.chk.plainClickReplaces = !!pc && searchVal() === 'V_STATUS = //' + pv + '//';
      document.removeEventListener('click', seen);
      document.body.classList.remove('pnb-click-filter');
      await boxTo('');
    },
    // (2026-10-30, selflt) the grouped view: a selection in a group's table - the selection's Filter list, and its filter
    ggsel: async function () {
      var CS = window.Penumbra.cellSel;   // (gg*: the harness loads cell selection)
      var tabs = Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer table'), function (t) { return !!t.querySelector('thead th[data-colname="V_NAME"]') && !!t.querySelector('tbody tr td[data-column]'); });
      var tb = tabs[0] || null, th = tb ? tb.querySelector('thead th[data-colname="V_NAME"]') : null, ths = tb ? tb.querySelector('thead th[data-colname="V_STATUS"]') : null;
      var tr = tb ? Array.prototype.filter.call(tb.querySelectorAll('tbody tr'), function (x) { return !x.classList.contains('search-hidden') && x.style.display !== 'none' && !!x.querySelector('td[data-column]'); })[0] : null;
      var a = tr ? tr.querySelector('td[data-column="' + th.getAttribute('data-column') + '"]') : null, c = tr ? tr.querySelector('td[data-column="' + ths.getAttribute('data-column') + '"]') : null;
      var n = (a && c && CS) ? CS.select([{ a: a, b: a }, { a: c, b: c }]) : 0;
      closeMenu(); rclick(a); sub('filterMenu'); await sleep(100);
      var l = subActs(), it = item('selFilter');
      if (it) it.click();
      await sleep(1200);
      var q = searchVal();
      R.info.g = { n: n, list: l, q: q };
      R.chk.gsMenu = n === 2 && l[0] === 'selFilter' && l[1] === 'selExclude';
      R.chk.gsFilter = /V_NAME = \/\^\(\?:/.test(q) && /V_STATUS = \/\^\(\?:/.test(q);
    },
    mexcl: async function () {
      var td = document.querySelector('#resultsTable tbody tr td a');
      R.chk.cellNative = !!td && !rclick(td) && !menu();
      var num = document.querySelector('#tableHeader th[data-column="#"]');
      // (round 20) the '#' heading has a menu of its own now
      R.chk.numMenu = !!num && rclick(num) && !!menu();
      closeMenu();
      document.body.classList.add('snapshot-comparison-active');
      R.chk.compareNative = !rclick(fth('V_NAME')) && !menu();
      document.body.classList.remove('snapshot-comparison-active');
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); R.chk.__fatal = R.fatal; }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    if (R.fatal) R.errors.push('driver: ' + R.fatal.slice(0, 300));
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
