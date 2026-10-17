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
  function item(act) { var m = menu(); return m ? m.querySelector('[data-act="' + act + '"]') : null; }
  function acts() { var m = menu(); return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  async function choose(el, act) {
    closeMenu();
    rclick(el);
    var it = item(act);
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
      var st = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.statsLine = !!st && st.textContent === '300 values, ' + Object.keys(uniq).length + ' unique, none empty'
        && !!menu() && menu().getAttribute('aria-describedby') === st.id;
      R.info.stats = st && st.textContent;
      // (round 4) no value repeats: "all unique"
      closeMenu();
      rclick(fth('V_ID'));
      var stU = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.statsAllUnique = !!stU && stU.textContent === '300 values, all unique, none empty';
      R.info.statsU = stU && stU.textContent;
      closeMenu();
      rclick(fth('V_NAME'));
      var a = acts();
      R.chk.itemsAll = ['sortAsc', 'sortDesc', 'options', 'freeze', 'move-left', 'move-right', 'move-start', 'move-end', 'hide', 'showHidden',
        'calc-left', 'calc-right', 'calc-start', 'calc-end', 'groupBy'].every(function (x) { return a.indexOf(x) >= 0; });
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
      rclick(fth('V_STATUS'));
      var stT = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.statsToggle = !!stT && stT.textContent === wantOn + ' checked, ' + (300 - wantOn) + ' unchecked';
      closeMenu();
      rclick(fth('V_DATE'));
      var stN = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.statsNotes = !!stN && stN.textContent === wantNotesRows + ' rows with notes (' + wantNotes + ' notes), ' + (300 - wantNotesRows) + ' without';
      R.info.statsJournal = { toggle: stT && stT.textContent, notes: stN && stN.textContent, want: [wantOn, wantNotesRows, wantNotes] };
      closeMenu();
      P.journalFriendlyCol = keepF; P.journalSearchColumnValue = keepV;
      // the search: rows it hides do not count (marked as the search marks them)
      var openN = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#resultsTable tbody tr'), function (tr) {
        var r = window.__rowsFixture[parseInt(tr.cells[0].textContent, 10) - 1];
        if (r && r.V_STATUS !== 'Open') tr.classList.add('search-hidden'); else if (r) openN++;
      });
      rclick(fth('V_STATUS'));
      var st2 = menu() && menu().querySelector('.pnb-hm-stats');
      R.chk.statsFiltered = openN > 0 && !!st2 && st2.textContent === openN + ' values, 1 unique, none empty';
      R.info.statsFiltered = { got: st2 && st2.textContent, open: openN };
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
      await choose(fth('V_NAME'), 'move-right');
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
      rclick(fth('V_ID'));
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
      if (item('showHidden')) item('showHidden').click();
      await sleep(200);
      var labels = menu() ? Array.prototype.map.call(menu().querySelectorAll('.pnb-hm-item .pnb-hm-label'), function (e) { return e.textContent; }) : [];
      R.chk.showList = labels.indexOf('V_LINK') >= 0 && labels.indexOf('H_NUM') >= 0 && labels.indexOf('Back') === 0 && labels.indexOf('V_NAME') < 0;
      var hn = menu() ? Array.prototype.filter.call(menu().querySelectorAll('.pnb-hm-item'), function (e) { return e.textContent.trim() === 'H_NUM'; })[0] : null;
      if (hn) hn.click();
      await sleep(500);
      var s2 = shownNames();
      R.chk.showHere = s2.indexOf('H_NUM') === s2.indexOf('V_ID') + 1 && s2.indexOf('H_NUM') > 0;
      R.chk.showFilled = rowsOk('H_NUM', 20);
      // (round 4) Swap...: the other shown columns; the one picked and this one trade places
      var sb0 = shownNames(), si = sb0.indexOf('V_ID'), sj = sb0.indexOf('V_DATE');
      rclick(fth('V_ID'));
      if (item('move-swap')) item('move-swap').click();
      await sleep(150);
      var swHead = menu() && menu().querySelector('.pnb-hm-head');
      var swLabels = menu() ? Array.prototype.map.call(menu().querySelectorAll('.pnb-hm-item .pnb-hm-label'), function (e) { return e.textContent; }) : [];
      R.chk.swapList = !!swHead && swHead.textContent === 'Swap places with' && swLabels[0] === 'Back'
        && swLabels.slice(1).join() === sb0.filter(function (n) { return n !== 'V_ID'; }).join();
      var swItem = menu() ? Array.prototype.filter.call(menu().querySelectorAll('.pnb-hm-item'), function (e) { return e.textContent.trim() === 'V_DATE'; })[0] : null;
      if (swItem) swItem.click();
      await sleep(500);
      var want = sb0.slice(); want[si] = 'V_DATE'; want[sj] = 'V_ID';
      R.chk.swapDone = si >= 0 && sj >= 0 && shownNames().join() === want.join() && /Swapped/.test(lastToast()) && rowsOk('V_ID', 20) && rowsOk('V_DATE', 20);
      R.info.swap = { before: sb0, after: shownNames(), labels: swLabels };
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
      R.chk.fitItem = !!item('fit') && !!item('resetWidths');
      if (item('fit')) item('fit').click();
      await sleep(400);
      var w1 = fth('V_AMOUNT').getBoundingClientRect().width;
      R.chk.fits = w0 >= 320 && w1 < w0 - 40 && H.widthFor('V_AMOUNT') !== 330;
      R.info.widths = [w0, w1];
      H.setUser('V_NAME', 300); H.setUser('V_DATE', 280); W.apply();
      await sleep(300);
      rclick(fth('V_NAME'));
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
      await choose(fth('V_DATE'), 'calc-start');
      if (document.getElementById('pnbCalcOverlay')) await add('D2', '{V_DATE}');
      R.chk.calcStart = shownNames()[0] === 'D2';
      R.info.order2 = shownNames();
    },
    mgroupby: async function () {
      rclick(fth('V_STATUS'));
      R.chk.groupItem = !!item('groupBy') && /Group by this column/.test(item('groupBy').textContent);
      if (item('groupBy')) item('groupBy').click();
      await until(function () { return document.body.classList.contains('group-mode-active') && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0; }, 15000);
      await sleep(400);
      R.chk.grouped = !!A() && A().groupingColumn() === 'V_STATUS' && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === 3;
    },
    gmenu: async function () {
      R.chk.opens = rclick(gth('V_NAME')) && !!menu();
      R.chk.noFreeze = !!menu() && !item('freeze') && !item('unfreeze');
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
      R.chk.noLayout = !!menu() && !a.some(function (x) { return /^(move-|calc-)/.test(x) || ['hide', 'showHidden', 'options', 'freeze', 'unfreeze'].indexOf(x) >= 0; });
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
      R.chk.copyItem = !!item('copy') && /Copy distinct values/.test(item('copy').textContent);
      if (item('copy')) item('copy').click();
      await sleep(150);
      var head = menu() && menu().querySelector('.pnb-hm-head');
      R.chk.copySubmenu = !!head && head.textContent === 'Delimited by'
        && ['back', 'copy-space', 'copy-comma', 'copy-semicolon', 'copy-tab', 'copy-newline', 'copy-other'].every(function (a) { return acts().indexOf(a) >= 0; });
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
      if (item('move-swap')) item('move-swap').click();
      await sleep(150);
      var sw = menu() ? Array.prototype.filter.call(menu().querySelectorAll('.pnb-hm-item'), function (e) { return e.textContent.trim() === 'V_DATE'; })[0] : null;
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
      R.chk.filterBlank = nulls > 0 && !!lastV && lastV.v === '' && lastV.all === nulls;      // Column stats: numbers, dates, the most common values
      function statsOf(name) {
        return (async function () {
          rclick(fth(name));
          if (item('stats')) item('stats').click();
          await sleep(300);
          var out = {}, pe = panelEl();
          if (pe) Array.prototype.forEach.call(pe.querySelectorAll('[data-hp="stats"] tr'), function (tr) { out[tr.children[0].textContent] = tr.children[1].textContent; });
          out.__top = pe ? Array.prototype.map.call(pe.querySelectorAll('[data-hp="top"] tr'), function (tr) { return [tr.children[0].textContent, tr.children[1].textContent]; }) : [];
          key('Escape');
          await sleep(100);
          return out;
        })();
      }
      function fmt(x) { return Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
      var amts = window.__rowsFixture.map(function (r) { return parseFloat(String(r.V_AMOUNT).replace(/[$,]/g, '')); });
      var sa = await statsOf('V_AMOUNT');
      R.chk.statsNum = sa.Rows === '300' && sa.Smallest === fmt(Math.min.apply(null, amts)) && sa.Largest === fmt(Math.max.apply(null, amts)) && sa.Empty === '0';
      var dates = window.__rowsFixture.map(function (r) { var m = /^(\d+)\/(\d+)\/(\d+)$/.exec(r.V_DATE); return { k: +m[3] * 10000 + +m[1] * 100 + +m[2], t: r.V_DATE }; });
      dates.sort(function (a, b) { return a.k - b.k; });
      var sd = await statsOf('V_DATE');
      R.chk.statsDate = sd.Earliest === dates[0].t && sd.Latest === dates[dates.length - 1].t;
      var fq = {};
      window.__rowsFixture.forEach(function (r) { fq[r.V_NAME] = (fq[r.V_NAME] || 0) + 1; });
      var best = Math.max.apply(null, Object.keys(fq).map(function (k) { return fq[k]; }));
      var sn = await statsOf('V_NAME');
      R.chk.statsTop = sn.__top.length === 5 && sn.__top[0][1] === String(best) && fq[sn.__top[0][0]] === best && !!sn.Longest;
      R.info.stats = { a: sa, d: sd, n: sn.__top };
      // Show only this column / Show all columns
      await choose(fth('V_NAME'), 'only');
      R.chk.only = shownNames().join() === 'V_NAME' && /Undo/.test(lastToast());
      rclick(fth('V_NAME'));
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
      // Pivot by / Chart this column: shown where the toolbar shows the tool
      ['pivotBtn', 'visualizeBtn'].forEach(function (id) {
        if (!document.getElementById(id)) { var b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = id; document.body.appendChild(b); }
      });
      var A0 = A(), calls = [], kp = A0.pivotColumn, kc = A0.chartColumn;
      A0.pivotColumn = function (c) { calls.push('p:' + c); };
      A0.chartColumn = function (c) { calls.push('c:' + c); };
      await choose(fth('V_STATUS'), 'pivot');
      await choose(fth('V_STATUS'), 'chart');
      R.chk.builders = calls.join() === 'p:V_STATUS,c:V_STATUS';
      document.getElementById('pivotBtn').style.display = 'none';
      rclick(fth('V_STATUS'));
      R.chk.toolHidden = !item('pivot') && !!item('chart');
      closeMenu();
      A0.pivotColumn = kp; A0.chartColumn = kc;
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
    mshot: async function () {
      await choose(fth('V_NAME'), 'sortAsc');
      rclick(fth('V_NAME'));
      R.chk.open = !!menu();
    },
    mexcl: async function () {
      var td = document.querySelector('#resultsTable tbody tr td:nth-child(3)');
      R.chk.cellNative = !!td && !rclick(td) && !menu();
      var num = document.querySelector('#tableHeader th[data-column="#"]');
      R.chk.numNative = !!num && !rclick(num) && !menu();
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
