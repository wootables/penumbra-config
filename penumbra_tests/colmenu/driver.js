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
    reset: 'resets', resetAll: 'resets', resetWidths: 'resets', clearPrefs: 'resets' };
  function sub(act) { var it = item(act); if (!it || it.getAttribute('aria-disabled') === 'true') return false; it.click(); return true; }
  function reach(act) { if (!item(act) && SUBS[act]) sub(SUBS[act]); return item(act); }
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

  var S = {
    mflat: async function () {
      var BASE = shownNames();
      R.chk.prevented = rclick(fth('V_NAME'));
      R.chk.opens = !!menu();
      var t = menu() && menu().querySelector('.pnb-hm-title');
      R.chk.titleName = !!t && t.textContent.indexOf('V_NAME') >= 0;
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
      R.chk.itemsAll = ['sortAsc', 'sortDesc', 'filter', 'options', 'move', 'show', 'hide', 'freeze', 'copy', 'copyName', 'calc', 'groupBy', 'resets'].every(function (x) { return a.indexOf(x) >= 0; });
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
      var fitIt = !!item('fit'); sub('resets');
      R.chk.fitItem = fitIt && !!item('resetWidths');
      closeMenu(); rclick(fth('V_AMOUNT'));
      if (item('fit')) item('fit').click();
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
      H.setUser('V_NAME', 300); H.setUser('V_DATE', 280); W.apply();
      await sleep(300);
      rclick(fth('V_NAME'));
      sub('resets');
      R.chk.resetItem = !!item('resetWidths');
      if (item('resetWidths')) item('resetWidths').click();
      await sleep(400);
      R.chk.resets = H.userDiff().length === 0 && /widths reset/.test(lastToast());
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
        if (item('fit')) item('fit').click();
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
      if (item('fit')) item('fit').click();
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
      R.chk.cellGroup = !!gtd && rclick(gtd) && acts()[0] === 'cellFilter' && item('cellFilter').textContent.indexOf('"' + gtd.textContent.trim() + '"') >= 0;
      closeMenu();
      rclick(gth('V_NAME'));
      R.chk.groupItems = !!item('groupBy') && /instead/.test(item('groupBy').textContent) && !!item('ungroup');
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
      if (item('fit')) item('fit').click();
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
      R.chk.copyItem = !!item('copy') && /^Copy distinct values/.test(item('copy').textContent.trim());
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
      async function quick(act) { rclick(fth('V_STATUS')); if (item('copy')) item('copy').click(); await sleep(100); if (item(act)) item(act).click(); await sleep(600); return lastClip(); }
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
      if (item('copy')) item('copy').click();
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
      if (panelEl()) panelEl().querySelector('[data-hp="clear"]').click();
      await sleep(900);
      R.chk.filterClear = searchVal() === '' && visRows() === 300;
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
      // Reset this column: its place (the report's order), width and format
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'number:1');
      window.Penumbra.colWidthsHost.setUser('V_AMOUNT', 300); window.Penumbra.colWidths.apply();
      await choose(fth('V_AMOUNT'), 'move-end');
      var movedEnd = shownNames().slice(-1)[0] === 'V_AMOUNT';
      await choose(fth('V_AMOUNT'), 'reset');
      await sleep(300);
      var s3 = shownNames(), co = prefs().colopt || {};
      R.chk.resetCol = movedEnd && s3.indexOf('V_AMOUNT') === s3.indexOf('V_NAME') + 1 && !(co.V_AMOUNT && co.V_AMOUNT.fmt)
        && window.Penumbra.colWidthsHost.widthFor('V_AMOUNT') !== 300 && /Reset/.test(lastToast());
      R.info.reset = { s3: s3.slice(0, 5), co: co.V_AMOUNT || null, w: window.Penumbra.colWidthsHost.widthFor('V_AMOUNT') };
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
        if (item('fit')) item('fit').click();
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
      if (item('fit')) item('fit').click();
      await sleep(500);
      var w2 = fth('H_NL').getBoundingClientRect().width;
      R.chk.fitLines = nl.length > 10 && nl.every(function (td) { return lines(td) === 2; }) && w2 < concatNl + pad - 10;
      R.info.fitnest = { grow: g, compact: c, nl: { w: w2, concat: concatNl, pad: pad, lines: nl.slice(0, 5).map(function (td) { return lines(td); }) } };
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
      R.chk.nestSubOpens = !!subCell && rclick(subCell) && !!menu() && !!item('cellFilter') && item('cellFilter').textContent.indexOf('"' + v + '"') >= 0 && !item('cellExclude') && !!item('cellCopy');
      R.info.nestSub = { v: v, acts: acts(), nameIdx: nameIdx, hdr: Array.prototype.map.call(hdrCells, function (x) { return x.textContent.trim().slice(0, 12); }) };
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      var want = window.__rowsFixture.filter(function (r) { return r.H_JSON && JSON.parse(r.H_JSON.substring(6)).some(function (x) { return String(x.SUB_NAME) === v; }); }).length;
      var vis = Array.prototype.filter.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) { return !tr.classList.contains('search-hidden'); }).length;
      R.chk.nestSubFilter = v !== '' && searchVal() === 'SUB_NAME = //' + v + '//' && vis === want && want > 0;
      R.info.nestFilter = { search: searchVal(), vis: vis, want: want };
      (function (t) { var a = document.createElement('a'); a.className = 'snippet-action'; a.setAttribute('data-action-name', 'search'); a.setAttribute('data-action-value', t); document.getElementById('reportSnippetOutput').appendChild(a); $(a).trigger('click'); a.remove(); })('');
      await sleep(900);
      // the cell around the sub-table: the column's menu, no value items
      R.chk.nestPadOpens = !!td && rclick(td) && !!menu() && !item('cellFilter') && !item('cellCopy') && acts().indexOf('sortAsc') >= 0;
      closeMenu();
      // (round 24) a sub-cell that is a LINK (fi-epa-c's resolver links): a right-click on the link
      // opens the menu, Filter to its text, Copy this value; (round 25) no link items of our own,
      // a footer names the way to the browser's menu; a header's menu has no footer
      var subId = (row0 && hdrCells.length) ? row0.children[0] : null, idText = subId ? subId.textContent.trim() : '';
      if (subId) { subId.innerHTML = '<a href="https://example.test/x?id=' + encodeURIComponent(idText) + '">' + idText + '</a>'; }
      var lnk = subId ? subId.querySelector('a') : null;
      R.chk.nestLinkOpens = !!lnk && rclick(lnk) && !!menu() && !!item('cellFilter') && item('cellFilter').textContent.indexOf('"' + idText + '"') >= 0
        && !!item('cellCopy') && !item('cellOpenLink') && !item('cellCopyLink');
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
      rclick(lnk); if (item('cellFilter')) item('cellFilter').click();
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
      R.chk.cellOpens = prevented && !!menu() && a[0] === 'cellFilter' && a[1] === 'cellExclude' && a[2] === 'cellCopy'
        && item('cellFilter').textContent.indexOf('"' + v0 + '"') >= 0 && c0.classList.contains('pnb-hm-cell')
        && menu().querySelector('.pnb-hm-name').textContent === 'V_STATUS' && a.indexOf('sortAsc') > 2;
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
      rclick(c1);
      if (item('cellExclude')) item('cellExclude').click();
      await sleep(900);
      R.chk.cellExclude = searchVal() === 'V_STATUS != /^(?:' + v1 + ')$/' && visRows() === 300 - cnt[v1];
      setSearch('');
      await sleep(900);
      // Copy this value: the text the cell shows
      var c2 = cellAt('V_NAME', 1);
      rclick(c2);
      if (item('cellCopy')) item('cellCopy').click();
      await sleep(300);
      R.chk.cellCopy = window.__clip[window.__clip.length - 1] === c2.innerText.trim();
      // a formatted amount filters by its VALUE
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      await sleep(300);
      var c3 = cellAt('V_AMOUNT', 2), shown = c3.textContent.trim(), raw = c3.getAttribute('data-pnb-raw');
      rclick(c3);
      var rawLbl = item('cellFilter') ? item('cellFilter').textContent : '';
      if (item('cellFilter')) item('cellFilter').click();
      await sleep(900);
      var same = window.__rowsFixture.filter(function (r) { return r.V_AMOUNT === raw; }).length;
      R.chk.cellRaw = !!raw && shown !== raw && rawLbl.indexOf(raw) >= 0 && same > 0 && visRows() === same;
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
      rclick(blankTd);
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
      var a = acts(), want = ['sortAsc', 'sortDesc', 'filter', 'stats', 'options', 'move', 'show', 'hide', 'fit', 'freeze', 'copy', 'copyName', 'calc', 'groupBy', 'resets'];   // (round 21) stats is back, a list
      var pos = want.map(function (x) { return a.indexOf(x); });
      R.chk.topOrder = pos.every(function (p, i) { return p >= 0 && (i === 0 || p > pos[i - 1]); })
        && menu().querySelectorAll('.pnb-hm-sep').length === 3 && ['move-left', 'only', 'reset', 'stats-top-0', 'pivot', 'chart', 'copy-comma'].every(function (x) { return a.indexOf(x) < 0; });
      R.chk.noChips = !menu().querySelector('.pnb-hm-row');
      var subs = ['move', 'show', 'copy', 'calc', 'resets'];
      R.chk.arrows = subs.every(function (x) { return !!item(x) && !!item(x).querySelector('.pnb-hm-arrow') && item(x).getAttribute('aria-haspopup') === 'menu' && item(x).getAttribute('aria-expanded') === 'false'; })
        && !item('copyName').querySelector('.pnb-hm-arrow');
      var showNote = item('show').querySelector('.pnb-hm-note');
      R.chk.showLabel = item('show').querySelector('.pnb-hm-label').textContent === 'Show column(s)' && !!showNote && /^\d+ hidden$/.test(showNote.textContent)
        && item('move').querySelector('.pnb-hm-label').textContent === 'Move column' && item('copy').querySelector('.pnb-hm-label').textContent === 'Copy distinct values';
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
      closeMenu(); rclick(fth('V_NAME')); sub('copy');
      var pa = subActs();
      R.chk.copyList = pa.indexOf('back') < 0 && pa.indexOf('copyName') < 0 && ['copy-space', 'copy-comma', 'copy-newline', 'copy-other'].every(function (x) { return pa.indexOf(x) >= 0; })
        && !!anyHead() && anyHead().textContent === 'Delimited by' && menu().querySelector('.pnb-hm-name').textContent === 'V_NAME';
      closeMenu(); rclick(fth('V_NAME')); sub('resets');
      var ra = subActs(), rl = subLabels();
      R.chk.resetList = ra.indexOf('back') < 0 && ['reset', 'resetAll', 'resetWidths', 'clearPrefs'].every(function (x) { return ra.indexOf(x) >= 0; })
        && rl.indexOf('This column') >= 0 && rl.indexOf('All columns') >= 0 && rl.indexOf('All column widths') >= 0 && rl.indexOf('Clear all custom preferences for this report...') >= 0;
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
      R.chk.numItems = ['sortAsc', 'sortDesc', 'hide', 'freeze', 'show', 'fitAll', 'resets'].every(function (x) { return a.indexOf(x) >= 0; })
        && ['move', 'options', 'copy', 'copyName', 'calc', 'groupBy', 'filter', 'fit', 'cellCopy', 'cellFilter'].every(function (x) { return a.indexOf(x) < 0; })
        && item('hide').querySelector('.pnb-hm-label').textContent === 'Hide the row numbers';
      R.info.numActs = a;
      sub('resets');
      R.chk.numResets = !item('reset') && !!item('resetAll') && !!item('clearPrefs');
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
    mshot: async function () {
      await choose(fth('V_NAME'), 'sortAsc');
      rclick(fth('V_NAME'));
      R.chk.open = !!menu();
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
