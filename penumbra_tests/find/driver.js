// find suite - browser half (2026-10-19). Runs ONE scenario (?scn=) against the
// main.js + js/penumbra_find.js + cell selection the page loaded and publishes
//   window.__HCRESULT = { scn, chk: {name: bool}, info: {...}, errors: [...] }
// and window.__HCDONE = true. run.py asserts every chk on the candidate (L-*) and
// no page errors (E-*); --control loads the LIVE main.js and an EMPTY module, where
// every L check goes red except sane* ones and the absences run.py lists.
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  var FX = window.__rowsFixture;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }

  // ---- the page ----------------------------------------------------------------
  function T() { return document.getElementById('resultsTable'); }
  function colId(name) { var th = document.querySelector('#tableHeader th[data-colname="' + name + '"]'); return th ? th.getAttribute('data-column') : null; }
  function rowNo(tr) { var h = tr && tr.querySelector('td[data-column="#"]'); return h ? parseInt(h.textContent, 10) : NaN; }
  function rowByNo(n) { var rs = T().tBodies[0].rows; for (var i = 0; i < rs.length; i++) { if (rowNo(rs[i]) === n) return rs[i]; } return null; }
  function cellOf(n, name) { var tr = rowByNo(n); return tr ? tr.querySelector('td[data-column="' + colId(name) + '"]') : null; }
  function pageInfo() { return $('#pageInfo').text(); }
  function wrap() { return document.getElementById('results-wrapper'); }
  function inBox(td) {
    var r = td.getBoundingClientRect(), w = wrap();
    if (r.top < 0 || r.bottom > window.innerHeight) return false;
    if (!w) return true;
    var b = w.getBoundingClientRect();
    return r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1;
  }
  function kept() { return Array.prototype.filter.call(T().tBodies[0].rows, function (tr) { return !tr.classList.contains('search-hidden'); }); }
  function blurAll() { var a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }
  async function searched(q) {
    var h0 = window.__HC_HIDES || 0;
    $('#tableSearch').val(q);
    HC.runTableSearch();
    await until(function () { return (window.__HC_HIDES || 0) > h0; }, 20000);
    await sleep(150); await frames(2); await settle();
  }

  // ---- Find --------------------------------------------------------------------------
  function F() { return (window.Penumbra && window.Penumbra.find) || null; }
  function FH() { return (window.Penumbra && window.Penumbra.findHost) || null; }
  function st() { return F() ? F()._state() : {}; }
  function hits() { return F() ? F()._hits() : []; }
  function countNow() { return F() ? F()._countNow() : undefined; }
  function barEl() { return document.getElementById('pnbFindBar'); }
  function barShown() { var b = barEl(); return !!(b && !b.hidden && b.getClientRects().length); }
  function inp() { return document.querySelector('#pnbFindBar .pnb-find-input'); }
  function btn() { return document.querySelector('#pnbFindBar .pnb-find-filter'); }
  function btnShown() { var b = btn(); return !!(b && !b.hidden && b.getClientRects().length); }
  // on screen to the eye (round 4: the spinner keeps its place while idle - visibility, not display)
  function drawn(el) { if (!el) return false; var cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; }
  // round 5: the infobox dialogs on screen (the last one drawn is on top)
  function overlays() { return Array.prototype.filter.call(document.querySelectorAll('.infobox-overlay'), function (o) { return o.isConnected && o.getClientRects().length > 0; }); }
  function topOverlay() { var o = overlays(); return o.length ? o[o.length - 1] : null; }
  // a REAL breakdown (main.js's chart-drill dialog) of n report rows from row `from`
  async function breakdown(n, from) {
    var rows = FH().rows().slice(from || 0, (from || 0) + n), before = overlays().length;
    HC._showChartDrillBreakdown(rows, ['V_STATUS = any'], [], null);
    await until(function () { var o = topOverlay(); return overlays().length > before && !!o && !!o.querySelector('table.infobox-drill-table tbody tr'); }, 5000);
    await sleep(250); await frames(2);
    return topOverlay();
  }
  // what Find should read in a dialog: its tables' body and footer cells, the '#' column out
  function dialogCells(ov) {
    var out = [];
    Array.prototype.forEach.call(ov.querySelectorAll('.infobox-body table'), function (T) {
      if (T.parentElement.closest('table') || !T.getClientRects().length) return;
      var hr = T.tHead && T.tHead.rows.length ? T.tHead.rows[T.tHead.rows.length - 1] : null, nc = -1;
      if (hr) {
        for (var i = 0; i < hr.cells.length; i++) {
          var t = hr.cells[i].cloneNode(true), si = t.querySelector('.sort-icon');
          if (si) si.remove();
          if (t.textContent.trim() === '#') nc = i;
        }
      }
      var trs = [];
      Array.prototype.forEach.call(T.tBodies, function (b) { trs = trs.concat(Array.prototype.slice.call(b.rows)); });
      if (T.tFoot) trs = trs.concat(Array.prototype.slice.call(T.tFoot.rows));
      trs.forEach(function (tr) { Array.prototype.forEach.call(tr.cells, function (td, j) { if (j !== nc && td.tagName === 'TD') out.push(td); }); });
    });
    return out;
  }
  function cellSays(td) { return td.textContent.replace(/[\s\xa0]+/g, ' ').trim().toLowerCase(); }
  function inDialog(ov, q) { return dialogCells(ov).filter(function (td) { return cellSays(td).indexOf(q) >= 0; }).length; }
  // a narrow window (the scenario's &vw=): two rows, spanning it, one size, nothing outside, words whole
  async function narrowCheck() {
    blurAll(); await ctrlF();
    var b = barEl();
    if (!b) { R.chk.nTwoRows = R.chk.nSpans = R.chk.nInside = R.chk.nSteady = R.chk.nWhole = false; return; }
    var ws = [], hs = [], at = [], inside = true, whole = true;
    function rec(tag) {
      var r = barEl().getBoundingClientRect();
      ws.push(r.width); hs.push(r.height); at.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      Array.prototype.forEach.call(barEl().querySelectorAll('.pnb-find-row > *'), function (el) {
        var c = el.getBoundingClientRect();
        if (c.width && (c.left < r.left - 0.5 || c.right > r.right + 0.5 || c.top < r.top - 0.5 || c.bottom > r.bottom + 0.5)) { inside = false; at.push('outside: ' + el.className); }
      });
      var cnt = barEl().querySelector('.pnb-find-count');
      if (cnt.scrollWidth > cnt.clientWidth + 1) { whole = false; at.push('clipped: ' + cnt.textContent); }
    }
    rec('open');
    await find('kilo'); await until(function () { return btnShown(); }, 5000); rec('filter offered');
    key('Enter'); await settle(); rec('stepped');
    await find('zzzz-none'); rec('no matches');
    await find('/[/'); rec('bad pattern');
    var bad = st().count === 'Not a valid pattern';
    var r0 = b.getBoundingClientRect(), i0 = inp().getBoundingClientRect(), c0 = b.querySelector('.pnb-find-count').getBoundingClientRect(), x0 = b.querySelector('.pnb-find-close').getBoundingClientRect();
    R.chk.nTwoRows = c0.top >= i0.bottom - 1 && Math.abs(x0.top - i0.top) < 6;
    // (the window's width less its scrollbar: what a fixed box spans)
    R.chk.nSpans = Math.abs(r0.left - 8) < 1 && Math.abs(r0.right - (document.documentElement.clientWidth - 8)) < 1;
    R.chk.nInside = inside;
    R.chk.nSteady = ws.every(function (w) { return Math.abs(w - ws[0]) < 0.6; }) && hs.every(function (h) { return Math.abs(h - hs[0]) < 0.6; });
    R.chk.nWhole = whole && bad;
    R.info.narrow = { vw: window.innerWidth, at: at };
  }
  function curTd() { return document.querySelector('#resultsTable td.pnb-find-cur, #groupedResultsContainer td.pnb-find-cur, #pivotResultTable td.pnb-find-cur'); }
  function hlSize(name) { var r = window.CSS && CSS.highlights; return (r && r.has(name)) ? r.get(name).size : 0; }
  function hlRanges(name) { var r = window.CSS && CSS.highlights, out = []; if (r && r.has(name)) r.get(name).forEach(function (x) { out.push(x); }); return out; }
  // a highlight's text (round 3: StaticRanges - no toString of their own)
  function rangeText(x) {
    if (x instanceof Range) return x.toString();
    var r = document.createRange(); r.setStart(x.startContainer, x.startOffset); r.setEnd(x.endContainer, x.endOffset); return r.toString();
  }
  function hlTexts(name) { return hlRanges(name).map(rangeText); }
  // a key on whatever has the focus (as the browser sends it)
  function key(k, o) {
    o = o || {};
    var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, metaKey: !!o.meta, altKey: !!o.alt });
    (document.activeElement || document.body).dispatchEvent(ev);
    return ev;
  }
  async function ctrlF(o) { var ev = key('f', o || { ctrl: true }); await sleep(30); return ev; }
  async function settle() { await until(function () { var s = st(); return !s.scanning && !s.typing; }, 30000); await sleep(60); await frames(2); }
  async function find(q) {
    var i = inp();
    if (!i) return;
    i.focus();
    i.value = q;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(10);
    await settle();
  }
  function kiloIn(n) { var m = String(FX[n - 1].V_NAME).match(/kilo/gi); return m ? m.length : 0; }
  // the grouped view
  function shown(el) { return !!(el && el.getClientRects().length); }
  function gWraps() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer > .group-wrapper')); }
  function gRowByNo(n) {
    var rs = document.querySelectorAll('#groupedResultsContainer .group-content > table > tbody > tr');
    for (var i = 0; i < rs.length; i++) { if (rowNo(rs[i]) === n) return rs[i]; }
    return null;
  }
  // on screen: inside the window and inside every box around it that scrolls
  function inViewAny(el) {
    var r = el.getBoundingClientRect();
    if (!(r.width || r.height) || r.top < 0 || r.bottom > innerHeight) return false;
    for (var n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) {
        var b = n.getBoundingClientRect();
        if (r.top < b.top - 1 || r.bottom > b.bottom + 1) return false;
      }
    }
    return true;
  }
  function anyHas(r, re) { return Object.keys(r).some(function (k) { return r[k] != null && re.test(String(r[k])); }); }

  var MODE = /^(?:gview|grp_)/.test(SCN) ? 'grouped' : (/^piv_/.test(SCN) ? 'pivot' : 'flat');
  async function boot() {
    if (!(await until(function () {
      if (!(window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1)) return false;
      if (MODE === 'grouped') return $('#groupedResultsContainer').is(':visible') && document.querySelectorAll('#groupedResultsContainer .group-content > table tbody td').length > 0;
      if (MODE === 'pivot') return !!document.querySelector('#pivotResultTable tbody td') && $('#pivot-output-container').is(':visible');
      return T() && T().tBodies[0] && T().tBodies[0].rows.length >= 200 && colId('V_AMOUNT') !== null;
    }, 150000))) throw new Error('boot: the report never finished loading (150 s, ' + MODE + ')');
    await sleep(400); await frames(4);
  }

  var S = {
    boot: async function () {
      var r250 = rowByNo(250);
      R.chk.sane300 = T().tBodies[0].rows.length === 300;
      R.chk.saneLazy = !!(r250 && r250.querySelector('td[data-column="' + colId('V_NAME') + '"][data-pnb-lazy]') && r250.style.display === 'none');
      R.chk.sanePage = pageInfo() === 'Page 1 of 2';
      R.chk.api = !!(F() && typeof F().open === 'function' && typeof F().paged === 'function');
      R.chk.host = !!(FH() && typeof FH().showRow === 'function' && typeof FH().searchCount === 'function');
      R.chk.noBarYet = !barShown();
      R.chk.activateApi = !!(window.Penumbra.cellSel && typeof window.Penumbra.cellSel.activate === 'function');
    },

    // Ctrl+F opens the bar; again in the box = the browser's; Esc closes and is
    // consumed; Cmd+F; never in a text field or under a dialog; the cheat sheet.
    open: async function () {
      blurAll();
      var ev = await ctrlF();
      R.chk.ctrlF = ev.defaultPrevented;
      R.chk.barShown = barShown();
      R.chk.inputFocused = !!inp() && document.activeElement === inp();
      var b = barEl();
      R.chk.a11y = !!(b && b.getAttribute('role') === 'search' && b.getAttribute('aria-label') && inp().getAttribute('aria-label') &&
        b.querySelector('[role="status"][aria-live="polite"]') &&
        Array.prototype.every.call(b.querySelectorAll('button.pnb-find-btn'), function (x) { return !!x.getAttribute('aria-label'); }));
      if (b) {
        // round 3: the WINDOW's top right (where a browser's find bar is), the same in every view
        var br = b.getBoundingClientRect(), vw = document.documentElement.clientWidth;
        R.chk.placed = Math.round(br.top) === 8 && Math.abs(vw - br.right - 16) <= 1;
        R.info.place = [Math.round(br.top), Math.round(br.right), vw];
      }
      var ev2 = await ctrlF();
      R.chk.secondPasses = barShown() && document.activeElement === inp() && !ev2.defaultPrevented;
      var wasOpen = barShown(), esc0 = window.__docEsc;
      var ev3 = key('Escape');
      await sleep(30);
      R.chk.escCloses = wasOpen && ev3.defaultPrevented && !barShown();
      R.chk.escConsumed = wasOpen && window.__docEsc === esc0;
      blurAll();
      var ev4 = await ctrlF({ meta: true });
      R.chk.metaF = ev4.defaultPrevented && barShown();
      key('Escape'); await sleep(30);
      // a text field keeps Ctrl+F (the browser's)
      document.getElementById('tableSearch').focus();
      var ev5 = await ctrlF();
      R.chk.typingFree = !ev5.defaultPrevented && !barShown();
      blurAll();
      // a dialog owns the screen
      $('#settingsPanel').addClass('is-open');
      var ev6 = await ctrlF();
      R.chk.busyFree = !ev6.defaultPrevented && !barShown();
      $('#settingsPanel').removeClass('is-open');
      // the "?" cheat sheet names Ctrl+F while the module is loaded
      var sheet = '';
      try { sheet = String(HC._pnbKeysSheetHtml()); } catch (e) { sheet = 'ERR ' + e; }
      R.chk.sheet = /<kbd>Ctrl\+F<\/kbd>/.test(sheet);
    },

    // A name only one LAZY row on page 2 has: found, its page turned, its cell
    // filled, marked, in view; case and runs of spaces ignored; no match.
    lazy: async function () {
      var r250 = rowByNo(250), vn = colId('V_NAME'), td = r250.querySelector('td[data-column="' + vn + '"]');
      R.chk.saneLazy = td.hasAttribute('data-pnb-lazy') && r250.style.display === 'none';
      blurAll(); await ctrlF();
      await find('zulu unique');
      var s = st(); R.info.s = s;
      R.chk.count1 = s.n === 1 && s.count === '1 of 1' && !!hits()[0] && hits()[0].raw === false;   // found by what it SHOWS
      R.chk.onPage = pageInfo() === 'Page 2 of 2' && r250.style.display !== 'none';
      R.chk.filled = !td.hasAttribute('data-pnb-lazy') && td.textContent.trim() === 'Zulu Unique';
      R.chk.curMarked = td.classList.contains('pnb-find-cur');
      R.chk.inView = inBox(td);
      R.chk.highlighted = hlTexts('pnb-find-cur').join('|') === 'Zulu Unique';
      R.chk.live = /^1 of 1, .+, row 250$/.test(s.live || '');
      await find('ZULU    unique');
      R.chk.caseless = st().n === 1;
      await find('qqqzzz');
      var s2 = st();
      R.chk.noMatches = s2.n === 0 && s2.count === 'No matches' && hlSize('pnb-find') === 0 && hlSize('pnb-find-cur') === 0 && !curTd();
    },

    // On-screen (sorted) order; the first match from the top; Enter / Shift+Enter
    // wrap; F3, Ctrl+G and Ctrl+Shift+G from the table.
    order: async function () {
      var th = document.querySelector('#tableHeader th[data-colname="V_ID"]');
      $(th).trigger('click'); await sleep(700); $(th).trigger('click'); await sleep(900); await frames(2);
      R.chk.saneSorted = rowNo(T().tBodies[0].rows[0]) === 300;
      blurAll(); await ctrlF();
      await find('kilo');
      var hs = hits(), s = st();
      R.chk.domOrder = hs.length > 3 && hs.every(function (h, i) { return i === 0 || h.pos > hs[i - 1].pos; });
      var rows = T().tBodies[0].rows, top = -1, last = -1;
      for (var i = 0; i < rows.length; i++) { if (kiloIn(rowNo(rows[i]))) { if (top < 0) top = i; last = i; } }
      R.chk.firstOnTop = s.cur === 0 && !!hs[0] && hs[0].pos === top;
      key('Enter'); await settle();
      var c1 = curTd();
      R.chk.nextDown = st().cur === 1 && !!c1 && c1.parentNode.sectionRowIndex === hs[1].pos;
      key('Enter', { shift: true }); await settle();
      key('Enter', { shift: true }); await settle();
      var lastPage = 'Page ' + (Math.floor(last / 200) + 1) + ' of 2';
      R.chk.wraps = st().cur === hs.length - 1 && pageInfo() === lastPage && !!curTd() && curTd().parentNode.sectionRowIndex === last;
      R.info.order = { n: hs.length, top: top, last: last, page: pageInfo() };
      blurAll();
      var e1 = key('F3'); await settle();
      R.chk.f3 = e1.defaultPrevented && st().cur === 0;
      var e2 = key('g', { ctrl: true }); await settle();
      R.chk.ctrlG = e2.defaultPrevented && st().cur === 1;
      var e3 = key('G', { ctrl: true, shift: true }); await settle();
      R.chk.ctrlShiftG = e3.defaultPrevented && st().cur === 0;
    },

    // Only the rows the search keeps; a line counts the rest; the count follows a
    // search change by itself.
    search: async function () {
      await searched('Open');
      var rows = T().tBodies[0].rows, keepNos = [], hidNos = [];
      for (var i = 0; i < rows.length; i++) { (rows[i].classList.contains('search-hidden') ? hidNos : keepNos).push(rowNo(rows[i])); }
      R.chk.saneSearched = hidNos.length > 0 && keepNos.length > 0;
      var wantKept = keepNos.filter(function (n) { return kiloIn(n) > 0; }).length;
      var wantHid = hidNos.filter(function (n) { return kiloIn(n) > 0; }).length;
      blurAll(); await ctrlF(); await find('kilo');
      var s = st(), hs = hits();
      R.info.want = [wantKept, wantHid]; R.info.s = s;
      R.chk.scoped = hs.length > 0 && hs.every(function (h) { return !rows[h.pos].classList.contains('search-hidden'); });
      R.chk.countKept = s.n === wantKept;
      // the box is the FILTER box since filterword (2026-10-19): "your filter hides"; the old
      // "your search hides" passes too until that deploy (the words: penumbra_tests\filterword W4)
      var mlHead = wantHid + ' more in ' + (wantHid === 1 ? 'a row' : 'rows') + ' your ';
      R.chk.moreLine = wantHid > 0 && s.hidden === wantHid && (s.more === mlHead + 'filter hides' || s.more === mlHead + 'search hides');
      await searched('');
      var s2 = st();
      R.chk.liveRescope = s2.open === true && s2.n === wantKept + wantHid && s2.hidden === 0 && s2.more === null;
    },

    // A column the layout hides is not searched.
    hidcol: async function () {
      var th = document.querySelector('#tableHeader th[data-colname="V_AMOUNT"]');
      R.chk.saneHidden = !!th && th.style.display === 'none';
      blurAll(); await ctrlF();
      await find('$');
      R.chk.noHiddenCol = st().n === 0;
      await find('AB-');
      R.chk.noHiddenOnly = st().n === 0;
      await find('ID-1001');
      R.chk.shownCol = st().n === 1;
    },

    // A column format: found by what it shows AND by the stored value, drawn or lazy.
    fmt: async function () {
      var c3 = cellOf(3, 'H_AMT'), r250 = rowByNo(250);
      R.chk.saneFmt = !!c3 && c3.textContent.trim() === '$4,321.50' && c3.getAttribute('data-pnb-raw') === '4321.5';
      R.chk.saneLazy = !!r250.querySelector('td[data-column="' + colId('H_AMT') + '"][data-pnb-lazy]');
      blurAll(); await ctrlF();
      await find('$1,234.50'); var a = hits();
      R.chk.shownLazy = a.length === 1 && a[0].ri === 249 && a[0].name === 'H_AMT' && a[0].raw === false;
      await find('1234.5'); var b = hits();
      R.chk.rawLazy = b.length === 1 && b[0].ri === 249 && b[0].raw === true;
      await find('$4,321.50'); var c = hits();
      R.chk.shownFilled = c.length === 1 && c[0].ri === 2 && c[0].raw === false;
      await find('4321.5'); var d = hits();
      R.chk.rawFilled = d.length === 1 && d[0].ri === 2 && d[0].raw === true;
      R.chk.rawTint = c3.classList.contains('pnb-find-hit') && c3.classList.contains('pnb-find-cur') && hlSize('pnb-find-cur') === 0;
      R.info.fmt = { a: a, b: b, c: c, d: d };
    },

    // //text// = the whole cell; plain text = any part.
    exact: async function () {
      var open = FX.filter(function (r) { return r.V_STATUS === 'Open'; }).length;
      var named = FX.filter(function (r) { return /open/i.test(r.V_NAME); }).length;
      blurAll(); await ctrlF();
      await find('open');
      R.chk.containsWide = st().n === open + named;
      await find('//open//');
      R.chk.exactNarrow = st().n === open && hits().every(function (h) { return h.name === 'V_STATUS'; });
      var t = hlTexts('pnb-find-cur');
      R.chk.exactWhole = t.length === 1 && t[0] === 'Open';
      R.info.exact = { open: open, named: named, n: st().n };
    },

    // /pattern/ (and /pattern/I) as in the search box; a broken one says so.
    regex: async function () {
      blurAll(); await ctrlF();
      await find('/^ID-100[1-9]$/');
      R.chk.re9 = st().n === 9 && st().kind === 'regex';
      await find('/^id-1001$/I');
      R.chk.reCase = st().n === 0 && st().kind === 'regex';
      await find('/^id-1001$/');
      R.chk.reNoCase = st().n === 1;
      await find('/(/');
      var s = st();
      R.chk.bad = s.kind === 'bad' && s.count === 'Not a valid pattern' && s.n === 0;
      await find('/ID-10/');
      R.chk.reHighlight = hlTexts('pnb-find-cur').join('|') === 'ID-10';
    },

    // Filter to N rows: N is the SEARCH's count; the click filters; an applied
    // search gets the term with AND; an OR search gets no button; Alt+Enter.
    filter: async function () {
      blurAll(); await ctrlF();
      await find('zulu unique');
      var p1 = countNow();
      R.chk.labelOne = !!p1 && p1.q === '"zulu unique"' && p1.n === 1 && btnShown() && btn().textContent === 'Filter to 1 row';
      await find('kilo');
      // round 3: the bar counts in slices - its label names the search's own N once it is in
      await until(function () { return btnShown(); }, 5000);
      var anyKilo0 = FX.filter(function (r) { return anyHas(r, /kilo/i); }).length;
      R.chk.labelAsync = btnShown() && btn().textContent === 'Filter to ' + anyKilo0 + ' rows';
      var p2 = countNow(), anyKilo = FX.filter(function (r) { return anyHas(r, /kilo/i); }).length;
      var findRows = hits().length;
      R.chk.honest = !!p2 && p2.n === anyKilo && anyKilo !== findRows && !!btn() && btn().textContent === 'Filter to ' + anyKilo + ' rows';
      // (no button - the control - no click: the waits below time out quickly)
      async function clickBtn() {
        var b = btn(), h = window.__HC_HIDES || 0;
        if (!b) return false;
        b.click();
        await until(function () { return (window.__HC_HIDES || 0) > h; }, 20000); await sleep(150); await settle();
        return true;
      }
      await clickBtn();
      R.chk.clickFilters = $('#tableSearch').val() === 'kilo' && kept().length === anyKilo && barShown() && st().hidden === 0 && st().n === findRows;
      // the search now holds the term: nothing left to add, no button
      R.chk.noReoffer = !!F() && countNow() === null && !btnShown();
      await searched('Open');
      await find('kilo');
      var p3 = countNow();
      var openKilo = FX.filter(function (r) { return anyHas(r, /open/i) && anyHas(r, /kilo/i); }).length;
      R.chk.andAdds = !!p3 && p3.add === true && p3.q === 'Open AND kilo' && p3.n === openKilo;
      var clicked = await clickBtn();
      R.chk.andFilters = clicked && $('#tableSearch').val() === 'Open AND kilo' && kept().length === openKilo;
      await searched('Open OR Closed');
      await find('kilo');
      var p4 = countNow();
      R.chk.orHides = p4 === null && !btnShown();
      await searched('');
      await find('zulu unique');
      countNow();
      var h2 = window.__HC_HIDES || 0, ev = null;
      if (inp()) {
        inp().focus();
        ev = key('Enter', { alt: true });
        await until(function () { return (window.__HC_HIDES || 0) > h2; }, 20000); await sleep(150); await settle();
      }
      R.chk.altEnter = !!ev && ev.defaultPrevented && $('#tableSearch').val() === '"zulu unique"' && kept().length === 1;
      R.info.filter = { p1: p1, p2: p2, p3: p3, p4: p4, anyKilo: anyKilo, findRows: findRows, openKilo: openKilo };
    },

    // Esc: the bar closes, nothing stays painted, the match becomes cell
    // selection's active cell (the arrows carry on); reopening keeps the term.
    esc: async function () {
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = cellOf(250, 'V_NAME');
      key('Escape'); await sleep(50); await frames(2);
      var cs = window.Penumbra.cellSel;
      R.chk.closed = !barShown();
      R.chk.unpainted = !document.querySelector('#resultsTable .pnb-find-cur, #resultsTable .pnb-find-hit') && hlSize('pnb-find') === 0 && hlSize('pnb-find-cur') === 0;
      R.chk.activeCell = !!td && document.activeElement === td && !!cs && cs.active() === td;
      key('ArrowUp'); await sleep(40);
      var up = cs && cs.active();
      R.chk.arrowsOn = !!up && up !== td && !!td && up.getAttribute('data-column') === td.getAttribute('data-column') && rowNo(up.parentNode) === 249;
      blurAll(); await ctrlF(); await settle();
      R.chk.termKept = !!inp() && inp().value === 'zulu unique' && st().n === 1;
    },

    // Stepping starts where you are (page 2); a page turned by hand is repainted,
    // never read again; the bar closes when the table is hidden (Rows = None).
    paint: async function () {
      document.getElementById('nextPageBtn').click(); await sleep(100); await frames(2);
      R.chk.sanePage2 = pageInfo() === 'Page 2 of 2';
      var rows = T().tBodies[0].rows, first2 = -1;
      for (var i = 200; i < rows.length; i++) { if (kiloIn(rowNo(rows[i]))) { first2 = i; break; } }
      blurAll(); await ctrlF(); await find('kilo');
      var hs = hits(), s0 = st();
      R.chk.startHere = !!hs[s0.cur] && hs[s0.cur].pos === first2 && pageInfo() === 'Page 2 of 2';
      function shownOcc() { var n = 0; Array.prototype.forEach.call(T().tBodies[0].rows, function (tr) { if (tr.style.display !== 'none') n += kiloIn(rowNo(tr)); }); return n; }
      function allOnScreen() { return hlRanges('pnb-find').concat(hlRanges('pnb-find-cur')).every(function (r) { var tr = r.startContainer.parentNode.closest('tr'); return !!tr && tr.style.display !== 'none'; }); }
      R.chk.paintsPage = hlSize('pnb-find') + hlSize('pnb-find-cur') === shownOcc() && allOnScreen();
      document.getElementById('firstPageBtn').click(); await sleep(60); await settle();
      R.chk.afterFlip = pageInfo() === 'Page 1 of 2' && hlSize('pnb-find') === shownOcc() && hlSize('pnb-find-cur') === 0 && allOnScreen();
      R.chk.noReread = typeof s0.scans === 'number' && st().scans === s0.scans && st().cur === s0.cur;
      R.info.paint = { first2: first2, cur: s0.cur, sizes: [hlSize('pnb-find'), hlSize('pnb-find-cur'), shownOcc()], scans: [s0.scans, st().scans] };
      var wasOpen = barShown();
      $('#rowsPerPageSelector').val('none').trigger('change'); await sleep(100); await frames(2);
      R.chk.closesOnNone = wasOpen && !barShown() && st().open === false;
    },

    // The table's own output is the same with Find open (nothing it paints leaks).
    export: async function () {
      function str(x) { return (typeof x === 'string') ? x : JSON.stringify(x); }
      var csv0 = str(await Promise.resolve(HC.getExportData('csv'))), html0 = str(await Promise.resolve(HC.getExportData('html')));
      blurAll(); await ctrlF(); await find('kilo');
      R.chk.openOk = st().n > 0 && !!curTd() && hlSize('pnb-find') > 0;
      var csv1 = str(await Promise.resolve(HC.getExportData('csv'))), html1 = str(await Promise.resolve(HC.getExportData('html')));
      R.chk.csvSame = csv0.length > 1000 && csv0 === csv1;
      R.chk.htmlSame = html0.length > 1000 && html0 === html1;
      if (html0 !== html1) {
        var k = 0; while (k < html0.length && html0[k] === html1[k]) k++;
        R.info.diff = [html0.slice(Math.max(0, k - 200), k + 200), html1.slice(Math.max(0, k - 200), k + 200)];
      }
      R.info.len = [csv0.length, html0.length, html1.length];
    },

    // Round 2: the grouped view takes Ctrl+F too (round 1 left it to the browser).
    gview: async function () {
      R.chk.saneGrouped = $('#groupedResultsContainer').is(':visible');
      blurAll();
      var ev = await ctrlF();
      R.chk.taken = ev.defaultPrevented && barShown() && st().view === 'grouped';
    },

    // ---- round 2: the grouped view ---------------------------------------------
    // Stacked, every group open: a cell found in its group's table, in page order
    // across the groups; a group's NAME found in its heading.
    grp_stack: async function () {
      R.chk.saneGrouped = gWraps().length === 6;
      blurAll();
      var ev = await ctrlF();
      R.chk.taken = ev.defaultPrevented && barShown() && st().view === 'grouped';
      await find('zulu unique');
      var td = curTd(), tr = gRowByNo(250);
      R.info.zulu = { st: st(), tr: !!tr, trHtml: tr ? tr.outerHTML.slice(0, 600) : null, hits: hits().map(function (h) { return [h.kind, h.el ? h.el.outerHTML.slice(0, 120) : null]; }), cur: td ? td.outerHTML.slice(0, 200) : null };
      R.chk.oneCell = st().n === 1 && !!td && !!tr && td.closest('tr') === tr && td.textContent.trim() === 'Zulu Unique';
      R.chk.inView = !!td && inViewAny(td);
      R.chk.highlighted = hlTexts('pnb-find-cur').join('|') === 'Zulu Unique';
      await find('kilo');
      var hs = hits(), want = FX.filter(function (r) { return /kilo/i.test(r.V_NAME); }).length;
      R.chk.allGroups = hs.length === want && hs.every(function (h) { return h.view === 'grouped' && h.kind === 'cell'; });
      R.chk.pageOrder = hs.length > 3 && hs.every(function (h, i) { return i === 0 || !!(hs[i - 1].el.compareDocumentPosition(h.el) & Node.DOCUMENT_POSITION_FOLLOWING); });
      // (it starts from where you are: the first match drawn at or below the screen's top)
      var c0 = st().cur;
      key('Enter'); await settle();
      var c1 = curTd(), k1 = (c0 + 1) % hs.length;
      R.chk.stepped = c0 >= 0 && st().cur === k1 && !!c1 && c1 === hs[k1].el && inViewAny(c1);
      await find('central');
      var hb = hits(), cur = document.querySelector('#groupedResultsContainer .pnb-find-cur');
      R.chk.band = hb.length === 1 && hb[0].kind === 'band' && !!cur && cur.classList.contains('group-name') && !!cur.closest('.group-header[data-group-key="Central"]');
      R.chk.bandOutline = !!cur && getComputedStyle(cur).outlineStyle === 'solid' && parseFloat(getComputedStyle(cur).outlineWidth) >= 2;
      // Esc on a group's name (no row, no cell to hand over): the bar closes, nothing thrown
      key('Escape'); await sleep(60);
      R.chk.bandEsc = !!cur && !barShown() && !!F() && !F().isOpen() && !document.querySelector('#groupedResultsContainer .pnb-find-cur, #groupedResultsContainer .pnb-find-hit');
      R.info.stack = { n: hs.length, want: want, cur: st().cur };
    },
    // Stacked, every group collapsed: stepping to a match opens its group (only it).
    grp_closed: async function () {
      var ws = gWraps();
      R.chk.saneClosed = ws.length === 6 && ws.every(function (w) { return !w.classList.contains('open'); });
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = curTd(), w = td && td.closest('.group-wrapper');
      R.chk.opened = !!w && w.classList.contains('open') && shown(td);
      R.chk.othersClosed = !!w && ws.filter(function (x) { return x !== w; }).every(function (x) { return !x.classList.contains('open'); });
      R.chk.inView = !!td && inViewAny(td);
      await find('kilo');
      var ok = true;
      for (var i = 0; i < 4; i++) {
        key('Enter'); await settle();
        var c = curTd();
        ok = ok && !!c && shown(c) && c.closest('.group-wrapper').classList.contains('open') && inViewAny(c);
      }
      R.chk.stepOpens = ok;
    },
    // Two levels, collapsed: both groups around the match open.
    grp_nest_closed: async function () {
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = curTd(), chain = [];
      for (var w = td && td.closest('.group-wrapper'); w; w = w.parentElement ? w.parentElement.closest('.group-wrapper') : null) chain.push(w);
      R.chk.saneNested = document.querySelectorAll('#groupedResultsContainer > .group-wrapper.group-branch').length === 6;
      R.chk.twoLevels = chain.length === 2;
      R.chk.bothOpen = chain.length === 2 && chain.every(function (x) { return x.classList.contains('open'); }) && shown(td);
      R.chk.inView = !!td && inViewAny(td);
    },
    // The List layout: the match's group is picked (it was not the selected one).
    grp_list: async function () {
      R.chk.saneList = document.body.classList.contains('pnb-gl-on') && !!document.getElementById('pnbGroupList');
      var before = document.querySelector('#groupedResultsContainer > .group-wrapper.pnb-gl-sel');
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = curTd(), w = td && td.closest('.group-wrapper');
      R.chk.otherGroup = !!before && !!w && w !== before;
      R.chk.picked = !!w && w.classList.contains('pnb-gl-sel') && shown(td);
      R.chk.inView = !!td && inViewAny(td);
      var item = document.querySelector('#pnbGroupList .pnb-gl-item.is-active .pnb-gl-name');
      R.chk.listFollows = !!item && !!w && item.textContent.trim() === w.getAttribute('data-group-key');
      // A band that moves AFTER the pick (live: the List layout draws the picked band's crumb a
      // frame later, which slid a long group name under the bar): the bar follows it.
      await find('central');
      var nm = document.querySelector('#groupedResultsContainer .group-name.pnb-find-cur'), fb = document.querySelector('.pnb-find-bar');
      function box(el) { var r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
      function over(a, b) { return a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b; }
      var slid = false, still = true;
      if (nm && fb) {
        // round 3: the bar sits at the window's top right - the name is slid up under it
        // (a style change that redraws nothing, as the crumb's was)
        var n0 = box(nm), b0 = box(fb);
        nm.style.position = 'relative';
        nm.style.top = Math.round(b0.t + 6 - n0.t) + 'px';
        nm.style.left = Math.round(b0.l + 20 - n0.l) + 'px';
        slid = over(box(nm), box(fb));   // under the bar now (nothing has moved it yet)
        await frames(3); await sleep(50);
        still = over(box(nm), box(fb));
        nm.style.position = nm.style.top = nm.style.left = '';
      }
      R.chk.barFollows = !!nm && slid && !still;
      R.info.follow = { nm: !!nm, slid: slid, still: still };
    },
    // A search in the grouped view: only the rows it keeps; a line counts the rest;
    // a search run while Find is open re-reads the matches by itself.
    grp_search: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      var n0 = st().n;
      await searched('Open');
      var trs = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-content > table > tbody > tr'));
      function keptTr(tr) { return !tr.classList.contains('search-hidden') && !tr.closest('.group-wrapper.search-hidden'); }
      var keep = trs.filter(keptTr), off = trs.filter(function (tr) { return !keptTr(tr); });
      function kiloCells(rows) { return rows.filter(function (tr) { return kiloIn(rowNo(tr)) > 0; }).length; }
      var wk = kiloCells(keep), wh = kiloCells(off), s = st();
      R.chk.saneSearched = off.length > 0 && keep.length > 0;
      R.chk.allBefore = n0 === wk + wh;
      R.chk.liveRescope = s.n === wk && s.hidden === wh;
      var mlHead2 = wh + ' more in ' + (wh === 1 ? 'a row' : 'rows') + ' your ';   // filter (filterword) or the old search
      R.chk.moreLine = wh > 0 && (s.more === mlHead2 + 'filter hides' || s.more === mlHead2 + 'search hides');
      R.chk.scoped = hits().length > 0 && hits().every(function (h) { return !h.el.closest('tr.search-hidden') && !h.el.closest('.group-wrapper.search-hidden'); });
      R.info.gsearch = { n0: n0, wk: wk, wh: wh, s: s };
    },
    // Filter to N rows in the grouped view: the search's count, the click filters
    // the groups' rows, then nothing is offered again.
    grp_filter: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      var p = countNow(), anyKilo = FX.filter(function (r) { return anyHas(r, /kilo/i); }).length;
      R.chk.offered = !!p && p.q === 'kilo' && p.n === anyKilo && btnShown();
      var b = btn(), h0 = window.__HC_HIDES || 0;
      if (b) { b.click(); await until(function () { return (window.__HC_HIDES || 0) > h0; }, 20000); await sleep(200); await settle(); }
      var kept = Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer .group-content > table > tbody > tr'), function (tr) { return !tr.classList.contains('search-hidden') && !tr.closest('.group-wrapper.search-hidden'); }).length;
      R.chk.filtered = !!b && $('#tableSearch').val() === 'kilo' && kept === anyKilo && barShown();
      R.chk.noReoffer = !!F() && countNow() === null && !btnShown();
      R.info.gfilter = { p: p, kept: kept, anyKilo: anyKilo };
    },
    // ---- round 3: the pivot ---------------------------------------------------------
    // Expanded: a row label found in every group, values found, the Grand Total row
    // read, no Filter (a pivot's cells are mostly sums).
    piv_open: async function () {
      var P = document.getElementById('pivotResultTable');
      function tier2Rows() { return Array.prototype.filter.call(P.tBodies[0].rows, function (tr) { var c = tr.querySelector('td[data-row-field="1"]'); return tr.hasAttribute('data-pivot-row') && !!c && c.textContent.trim() === 'Tier 2'; }); }
      var want = tier2Rows().length;
      R.chk.sanePivot = want >= 4;
      blurAll();
      var ev = await ctrlF();
      R.chk.taken = ev.defaultPrevented && barShown() && st().view === 'pivot';
      await find('tier 2');
      var hs = hits();
      R.chk.labels = hs.length === want && hs.every(function (h) { return h.view === 'pivot' && h.el.getAttribute('data-row-field') === '1'; });
      var c0 = st().cur, td0 = curTd();
      R.chk.cur = c0 >= 0 && !!td0 && inViewAny(td0) && hlTexts('pnb-find-cur').join('|') === 'Tier 2';
      key('Enter'); await settle();
      var td1 = curTd();
      R.chk.stepped = st().cur === (c0 + 1) % hs.length && !!td1 && td1 !== td0 && inViewAny(td1);
      R.chk.noFilter = countNow() === null && !btnShown();
      var gt = P.tFoot ? P.tFoot.querySelector('td[data-col-key]') : null, gtText = gt ? gt.textContent.trim() : '';
      if (gtText) { await find('//' + gtText + '//'); }
      R.chk.grandTotal = !!gtText && hits().some(function (h) { return P.tFoot.contains(h.el); });
      R.info.piv = { want: want, n: hs.length, gt: gtText };
    },
    // Collapsed: a match inside a collapsed group expands it (only it).
    piv_closed: async function () {
      var P = document.getElementById('pivotResultTable');
      var hiddenRows = Array.prototype.filter.call(P.tBodies[0].rows, function (tr) { return tr.hasAttribute('data-pivot-row') && !shown(tr); }).length;
      R.chk.saneClosed = hiddenRows > 6;
      blurAll(); await ctrlF(); await find('tier 2');
      var td = curTd(), tr = td && td.closest('tr');
      R.chk.expanded = !!tr && shown(tr) && shown(td);
      R.chk.inView = !!td && inViewAny(td);
      var grp = tr ? tr.getAttribute('data-pivot-group') : null;
      R.chk.othersClosed = !!grp && Array.prototype.filter.call(P.tBodies[0].rows, function (r) { return r.hasAttribute('data-pivot-row') && r.getAttribute('data-pivot-group') !== grp && shown(r); }).length === 0;
      key('Enter'); await settle();
      var td2 = curTd(), tr2 = td2 && td2.closest('tr');
      R.chk.stepExpands = !!tr2 && tr2 !== tr && shown(td2) && inViewAny(td2);
      R.info.pclosed = { hiddenRows: hiddenRows, grp: grp, grp2: tr2 ? tr2.getAttribute('data-pivot-group') : null };
    },
    // Esc in the pivot: the match becomes cell selection's active cell.
    piv_esc: async function () {
      blurAll(); await ctrlF(); await find('tier 2');
      var td = curTd();
      key('Escape'); await sleep(60);
      var cs = window.Penumbra.cellSel;
      R.chk.closed = !barShown();
      R.chk.activeCell = !!td && document.activeElement === td && !!cs && cs.active() === td;
    },

    // Esc in the grouped view: the match becomes cell selection's active cell.
    grp_esc: async function () {
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = curTd();
      key('Escape'); await sleep(60);
      var cs = window.Penumbra.cellSel;
      R.chk.closed = !barShown();
      R.chk.activeCell = !!td && document.activeElement === td && !!cs && cs.active() === td;
      key('ArrowDown'); await sleep(40);
      var dn = cs && cs.active();
      R.chk.arrowsOn = !!dn && !!td && dn !== td && dn.getAttribute('data-column') === td.getAttribute('data-column');
    },
    none: async function () {
      R.chk.saneNone = document.body.classList.contains('pnb-data-hidden');
      blurAll();
      var ev = await ctrlF();
      R.chk.notTaken = !ev.defaultPrevented && !barShown();
    },

    // A nested (@@JSON) column: its values, lazy or drawn - never the hidden raw
    // JSON or the nested heading.
    json: async function () {
      var jc = colId('H_JSON'), r250 = rowByNo(250), r5 = rowByNo(5);
      R.chk.saneJson = !!r250.querySelector('td[data-column="' + jc + '"][data-pnb-lazy]') && !!r5.querySelector('td[data-column="' + jc + '"] .raw-json-data');
      blurAll(); await ctrlF();
      await find('nestedonly');
      var a = hits(), td = r250.querySelector('td[data-column="' + jc + '"]');
      R.chk.nestedLazy = a.length === 1 && a[0].name === 'H_JSON' && a[0].ri === 249 && pageInfo() === 'Page 2 of 2' && !td.hasAttribute('data-pnb-lazy') && td.classList.contains('pnb-find-cur');
      R.chk.nestedMarked = hlTexts('pnb-find-cur').join('|') === 'Nestedonly';
      await find('nestedfirst');
      R.chk.nestedOnce = st().n === 1;
      await find('SUB_NAME');
      R.chk.noKeys = st().n === 0;
    },

    // Entities read as the cell shows them.
    ent: async function () {
      function n(v) { return FX.filter(function (r) { return r.H_ENT === v; }).length; }
      var rd = n('R&amp;D'), ob = n('O&#039;Brien'), tag = n('&lt;tag&gt;');
      blurAll(); await ctrlF();
      await find('r&d'); R.chk.decoded = st().n === rd;
      await find('&amp;'); R.chk.noEntity = st().n === 0;
      await find("o'brien"); R.chk.apos = st().n === ob;
      await find('<tag>'); R.chk.lt = st().n === tag;
      R.info.ent = { rd: rd, ob: ob, tag: tag };
    },

    // 3,000 rows (15 pages, all but the first lazy): read fast; the last match.
    big: async function () {
      R.chk.saneBig = T().tBodies[0].rows.length === 3000;
      blurAll(); await ctrlF();
      var i = inp(), t0 = performance.now();
      if (i) { i.focus(); i.value = 'kilo'; i.dispatchEvent(new Event('input', { bubbles: true })); }
      await until(function () { var s = st(); return s.n > 0 && !s.scanning && !s.typing; }, 30000);
      var ms = performance.now() - t0 - 120;
      var rows = T().tBodies[0].rows, want = 0, last = -1;
      for (var k = 0; k < rows.length; k++) { if (kiloIn(rowNo(rows[k]))) { want++; last = k; } }
      R.chk.bigCount = st().n === want;
      R.chk.bigFast = st().n > 0 && ms < 2000;
      await settle();
      var t1 = performance.now();
      key('Enter', { shift: true }); await settle();
      var ms2 = performance.now() - t1;
      R.chk.bigLast = st().cur === want - 1 && pageInfo() === 'Page ' + (Math.floor(last / 200) + 1) + ' of 15' && ms2 < 1500;
      R.info.big = { scanMs: Math.round(ms), lastMs: Math.round(ms2), want: want, last: last, page: pageInfo() };
    },

    // The bar never covers the current match: page 2's first row, right-hand column
    // (the bar's corner) - the bar moves to the bottom right; back under the headings
    // once the match is elsewhere.
    // round 3: the bar sits at the window's top right; it never covers the current
    // match - pulled up under its place (the page's own header out of the way), the
    // bar steps just below the match's row, and goes home once the match is elsewhere.
    cover: async function () {
      blurAll(); await ctrlF();
      await find('topright unique');
      var td = curTd(), b = barEl();
      function overlap(a, c) { return a.right > c.left && a.left < c.right && a.bottom > c.top && a.top < c.bottom; }
      R.chk.topRow = !!td && pageInfo() === 'Page 2 of 2' && td.parentNode.sectionRowIndex === 200 && inBox(td);
      var home = b ? b.getBoundingClientRect() : null;
      R.chk.atHome = !!home && Math.round(home.top) === 8;
      var box = document.getElementById('table-view-container');
      if (td && b) {
        box.style.marginTop = Math.round(-(td.getBoundingClientRect().top - 14)) + 'px';
        window.dispatchEvent(new Event('resize')); await frames(3); await sleep(40);
      }
      var tr = td ? td.getBoundingClientRect() : null, br = b ? b.getBoundingClientRect() : null;
      R.chk.underHome = !!tr && !!home && overlap(home, tr);   // it really is where the bar sits
      R.chk.notCovered = !!tr && !!br && !overlap(br, tr);
      R.chk.justBelow = !!tr && !!br && br.top >= tr.bottom && br.top <= tr.bottom + 12;
      await find('zulu unique');
      var br2 = barEl() ? barEl().getBoundingClientRect() : null, z = curTd();
      R.chk.backHome = !!br2 && !!z && !overlap(home, z.getBoundingClientRect()) && Math.round(br2.top) === 8;
      box.style.marginTop = '';
      R.info.cover = { home: home ? [Math.round(home.top), Math.round(home.bottom)] : null, td: tr ? [Math.round(tr.top), Math.round(tr.bottom)] : null,
                       bar: br ? [Math.round(br.top), Math.round(br.bottom)] : null, bar2: br2 ? Math.round(br2.top) : null };
    },

    // Rows = All: no page to turn, the match scrolled into view.
    all: async function () {
      R.chk.saneAll = T().tBodies[0].rows[299].style.display !== 'none';
      blurAll(); await ctrlF(); await find('zulu unique');
      var td = curTd();
      R.chk.allFound = st().n === 1 && !!td && inBox(td) && td.textContent.trim() === 'Zulu Unique';
    },

    // &find=off: no module, Ctrl+F the browser's.
    off: async function () {
      R.chk.saneOffNoApi = !(window.Penumbra && window.Penumbra.find);
      blurAll();
      var ev = await ctrlF();
      R.chk.saneOffNotTaken = !ev.defaultPrevented && !barShown();
    },

    // (pictures only: run.py --dump --scn shot,shotdark --shot <png>) the bar open on
    // its third match, in the default theme and a dark one.
    // round 3: a search applied (its own marks), Find open on another term, the (i) words shown
    shot: async function () {
      await searched('Open'); await sleep(80);
      blurAll(); await ctrlF(); await find('kilo');
      key('Enter'); await settle(); key('Enter'); await settle();
      var info = barEl() && barEl().querySelector('.pnb-find-info');
      if (info) info.click();
      await sleep(80); await frames(2);
      R.info.s = st();
      R.info.bar = barEl() ? barEl().getBoundingClientRect().top : null;
    },
    // (pictures only, round 4: --scn shot_open,shot_kilo --shot X.png) the bar just opened -
    // no filter, an empty box - and with a term read, Filter offered
    shot_open: async function () {
      blurAll(); await ctrlF(); await sleep(80); await frames(2);
    },
    shot_kilo: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      await until(function () { return btnShown(); }, 5000); await sleep(80); await frames(2);
    },
    shotdark: async function () {
      document.body.className = document.body.className.replace(/\btheme-[\w-]+/g, '').trim() + ' theme-wolfpack-dark';
      await sleep(150); await frames(3);
      await S.shot();
    },

    // (dumps only: --dump --scn grp_probe,grp_probe_closed,grp_probe_list,grp_probe_nest,piv_probe,piv_probe_closed)
    viewProbe: async function () {
      var I = R.info;
      function disp(el) { return el ? (getComputedStyle(el).display + (el.getClientRects().length ? '' : ' (no box)')) : null; }
      function cls(el) { return el ? (el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(/\s+/).join('.')) : null; }
      if (MODE === 'grouped') {
        var box = document.getElementById('groupedResultsContainer');
        I.box = { cls: cls(box), kids: Array.prototype.slice.call(box.children, 0, 6).map(cls), html0: box.innerHTML.slice(0, 2500) };
        I.wrappers = box.querySelectorAll('.group-wrapper').length;
        I.headers = Array.prototype.slice.call(box.querySelectorAll('.group-header'), 0, 4).map(function (h) { return { cls: cls(h), attrs: Array.prototype.map.call(h.attributes, function (a) { return a.name + ':' + String(a.value).slice(0, 40); }), text: h.textContent.trim().slice(0, 80) }; });
        I.contents = Array.prototype.slice.call(box.querySelectorAll('.group-content'), 0, 8).map(function (c) { return { disp: disp(c), cls: cls(c), tables: c.querySelectorAll(':scope > table').length, rows: c.querySelector('table') ? c.querySelector('table').tBodies[0].rows.length : null }; });
        I.tables = box.querySelectorAll('.group-content > table').length;
        I.tableRows = Array.prototype.map.call(box.querySelectorAll('.group-content > table'), function (t) { return t.tBodies[0] ? t.tBodies[0].rows.length : 0; }).join(',');
        I.lazyCells = box.querySelectorAll('td[data-pnb-lazy]').length;
        I.listUi = Array.prototype.slice.call(document.querySelectorAll('[class*="pnb-gl"]'), 0, 12).map(cls);
        I.groupList = window.Penumbra.groupList ? Object.keys(window.Penumbra.groupList) : null;
        I.layoutHost = window.Penumbra.groupLayoutHost ? window.Penumbra.groupLayoutHost.get() : null;
        var sc = []; for (var n = box; n && n !== document.body; n = n.parentElement) { var cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) sc.push(cls(n) + ' oy:' + cs.overflowY + ' ox:' + cs.overflowX + ' h:' + n.clientHeight + '/' + n.scrollHeight); }
        I.scrollers = sc;
      } else if (MODE === 'pivot') {
        var P = document.getElementById('pivotResultTable');
        var rs = P.tBodies[0].rows;
        I.rows = rs.length;
        I.shown = Array.prototype.filter.call(rs, function (tr) { return tr.style.display !== 'none' && tr.getClientRects().length; }).length;
        I.toggles = P.querySelectorAll('.pivot-collapse-toggle').length;
        I.head = P.tHead ? P.tHead.innerHTML.slice(0, 1500) : null;
        I.body = Array.prototype.slice.call(rs, 0, 5).map(function (tr) { return tr.outerHTML.slice(0, 900); });
        I.hiddenRow = (function () { for (var i = 0; i < rs.length; i++) { if (rs[i].style.display === 'none' || !rs[i].getClientRects().length) return rs[i].outerHTML.slice(0, 900); } return null; })();
        I.foot = P.tFoot ? P.tFoot.innerHTML.slice(0, 800) : null;
        var sc2 = []; for (var m = P; m && m !== document.body; m = m.parentElement) { var cs2 = getComputedStyle(m); if (/(auto|scroll)/.test(cs2.overflowY + cs2.overflowX)) sc2.push(cls(m) + ' oy:' + cs2.overflowY + ' ox:' + cs2.overflowX + ' h:' + m.clientHeight + '/' + m.scrollHeight); }
        I.scrollers = sc2;
      }
      I.findView = { flatActive: FH() ? FH().flatActive() : null };
    },

    // ---- round 3 (2026-10-19) ---------------------------------------------------------------
    // While a long table is read, a spinner turns beside the count ("Searching... N%").
    busy3: async function () {
      blurAll(); await ctrlF();
      if (F()) F()._setSlice(0.01);   // a slice per 32 rows: the read spans many tasks
      var i = inp(), seenBusy = false, seenText = false, seenSpin = false;
      if (i) { i.value = 'kilo'; i.dispatchEvent(new Event('input', { bubbles: true })); }
      var t0 = Date.now();
      while (i && Date.now() - t0 < 5000) {
        var b = barEl(), s = st();
        if (s.scanning) {
          seenBusy = seenBusy || b.classList.contains('pnb-find-busy');
          seenText = seenText || /^Searching\.\.\./.test(s.count || '');
          var sp = b.querySelector('.pnb-find-spin');
          seenSpin = seenSpin || drawn(sp);
        }
        if (!s.scanning && !s.typing && s.n > 0) break;
        await sleep(2);
      }
      if (F()) F()._setSlice(10);
      await settle();
      var sp2 = barEl() ? barEl().querySelector('.pnb-find-spin') : null;
      R.chk.busyShown = seenBusy && seenSpin;
      R.chk.busyText = seenText;
      R.chk.busyGone = !!sp2 && !barEl().classList.contains('pnb-find-busy') && !drawn(sp2) && st().n > 0;
    },
    // The count's words change in place (one text node - penumbra_a11y.js sweeps the page
    // after any node is added or removed), and the matches are StaticRanges (no live ones).
    textnode3: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      var b = barEl(), c = b && b.querySelector('.pnb-find-count'), l = b && b.querySelector('.pnb-find-live[role="status"]');
      var c0 = c && c.firstChild, l0 = l && l.firstChild, t0 = c ? c.textContent : '';
      key('Enter'); await settle();
      R.chk.sameNodes = !!c0 && !!l0 && c.firstChild === c0 && l.firstChild === l0 && c.textContent !== t0;
      var rs = hlRanges('pnb-find').concat(hlRanges('pnb-find-cur'));
      R.chk.staticRanges = rs.length > 0 && (typeof StaticRange !== 'function' || rs.every(function (x) { return x instanceof StaticRange; }));
    },
    // Classes that move nothing Find reads (stripes re-set row by row, a hover cue) are no
    // view change; a group closed is.
    grp_churn: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      var v0 = F() ? F()._views() : -1, s0 = st().scans;
      var rows = document.querySelectorAll('#groupedResultsContainer .group-content > table > tbody > tr'), i;
      for (i = 0; i < rows.length; i++) { rows[i].classList.remove('pnb-stripe-x'); rows[i].classList.add('pnb-stripe-x'); }
      var tds = document.querySelectorAll('#groupedResultsContainer tbody td');
      for (i = 0; i < Math.min(60, tds.length); i++) { tds[i].classList.add('cell-to-expand'); }
      await sleep(150);
      for (i = 0; i < Math.min(60, tds.length); i++) { tds[i].classList.remove('cell-to-expand'); }
      await sleep(150);
      var v1 = F() ? F()._views() : -1;
      R.chk.churnIgnored = v0 >= 0 && v1 === v0 && st().scans === s0;
      var w = gWraps()[0], c = w && w.querySelector(':scope > .group-content');
      if (w) { w.classList.remove('open'); if (c) c.style.display = 'none'; }
      await sleep(150);
      R.chk.closeTaken = !!F() && F()._views() > v1;
      if (w) { w.classList.add('open'); if (c) c.style.display = 'block'; }
      R.info.churn = { v0: v0, v1: v1, v2: F() ? F()._views() : -1, s0: s0, s1: st().scans };
    },
    // A page turned while a read is under way: the read ends, looks again, does not start over.
    big_dirty: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      if (F()) F()._setSlice(0.01);
      var s0 = st().scans, i = inp();
      if (i) { i.value = 'alpha'; i.dispatchEvent(new Event('input', { bubbles: true })); }
      await until(function () { return st().scanning && !st().typing; }, 5000);
      HC.applyPagination();   // ends with find.paged()
      await settle();
      if (F()) F()._setSlice(10);
      var want = 0;
      FX.forEach(function (r) { ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_STATUS'].forEach(function (k) { if (/alpha/i.test(String(r[k] == null ? '' : r[k]))) want++; }); });
      R.chk.noRestart = st().scans === s0 + 1;
      R.chk.dirtyRight = st().n === want;
      R.info.dirty = { s0: s0, s1: st().scans, n: st().n, want: want };
    },
    // Filter is not offered for a term the search reads by value: 'empty' (its keyword) and a
    // number range / list (1-5, 1,5); a plain word still is.
    guards3: async function () {
      blurAll(); await ctrlF();
      await find('empty'); var p1 = countNow();
      await find('1-5'); var p2 = countNow();
      await find('3,7'); var p3 = countNow();
      await find('kilo'); var p4 = countNow();
      R.chk.noKeyword = p1 === null && p2 === null && p3 === null;
      R.chk.wordOffered = !!p4 && p4.q === 'kilo';
    },
    // The grouped view's Filter adds to the search it APPLIED - not to text typed in the box and not run.
    grp_applied: async function () {
      await searched('kilo');
      $('#tableSearch').val('xyz');   // typed, never run
      blurAll(); await ctrlF(); await find('alpha');
      var p = countNow();
      R.chk.appliedOnly = !!p && p.add === true && p.q === 'kilo AND alpha';
      R.info.applied = p;
      $('#tableSearch').val('');
    },
    // What Find is: the (i) button's words (a hover's title; a click shows them under the box);
    // the bar is a FORM that never submits.
    info3: async function () {
      blurAll(); await ctrlF();
      var b = barEl(), info = b && b.querySelector('.pnb-find-info'), tip = b && b.querySelector('.pnb-find-tip');
      // the tip names the filter: "The filter box ..." (filterword, 2026-10-19) or the old "...box filters instead"
      R.chk.aboutText = !!info && /filter/.test(info.getAttribute('title') || '') && !!document.getElementById('pnbFindAbout') &&
        !!inp() && inp().getAttribute('aria-describedby') === 'pnbFindAbout' && inp().getAttribute('placeholder') === 'Find without filtering';
      // the owner's words (2026-10-20): it starts with "Highlights", reaches other pages, and the
      // hover title, the line under the box and the screen readers' description say the same
      var t = info ? (info.getAttribute('title') || '') : '', ab = document.getElementById('pnbFindAbout');
      R.chk.aboutWords = /^Highlights what you type and steps from match to match \(even across other pages\); every row stays in the table\. /.test(t) &&
        !/hidden col/i.test(t) && !!tip && tip.textContent === t && !!ab && ab.textContent === t;
      if (info) info.click();
      await sleep(30);
      R.chk.tipOpens = !!tip && !tip.hidden && info.getAttribute('aria-expanded') === 'true' && document.activeElement === inp();
      if (info) info.click();
      await sleep(30);
      R.chk.tipCloses = !!tip && tip.hidden && info.getAttribute('aria-expanded') === 'false';
      var ev = new Event('submit', { bubbles: true, cancelable: true });
      if (b) b.dispatchEvent(ev);
      R.chk.formNoSubmit = !!b && b.tagName === 'FORM' && ev.defaultPrevented;
    },
    // Filter to N rows leaves the box as a typed search would: its clear x shows, and
    // deleting the term clears the search (main.js findHost.runSearch).
    xfix: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      await until(function () { return btnShown(); }, 5000);
      var h0 = window.__HC_HIDES || 0;
      if (btn()) btn().click();
      await until(function () { return (window.__HC_HIDES || 0) > h0; }, 20000); await sleep(150); await settle();
      var x = document.getElementById('clearTableSearch');
      R.chk.hasText = document.getElementById('tableSearchContainer').classList.contains('has-text') && $('#tableSearch').val() === 'kilo';
      R.chk.xShown = !!x && x.getClientRects().length > 0;
      key('Escape'); await sleep(50);
      var ts = document.getElementById('tableSearch'), h1 = window.__HC_HIDES || 0;
      ts.focus(); ts.value = '';
      ts.dispatchEvent(new Event('input', { bubbles: true }));
      ts.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
      await until(function () { return (window.__HC_HIDES || 0) > h1; }, 8000); await sleep(150);
      R.chk.deleteClears = !!btn() && !T().querySelector('tbody tr.search-hidden');
    },
    // A script's own search (.val() + runTableSearch, no keyup / input - a comparison left, a
    // new query, a restore): the box's x shows all the same, and deleting the term clears it
    // (main.js _pnbSyncSearchBoxState at the end of applyPagination).
    xsync: async function () {
      await searched('kilo');
      var x = document.getElementById('clearTableSearch');
      R.chk.syncHasText = document.getElementById('tableSearchContainer').classList.contains('has-text') && !!x && x.getClientRects().length > 0;
      var ts = document.getElementById('tableSearch'), h1 = window.__HC_HIDES || 0;
      ts.focus(); ts.value = '';
      ts.dispatchEvent(new Event('input', { bubbles: true }));
      ts.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
      await until(function () { return (window.__HC_HIDES || 0) > h1; }, 8000); await sleep(150);
      R.chk.syncDeleteClears = !T().querySelector('tbody tr.search-hidden');
    },
    // main.js's "is a dialog open" (Ctrl+F, PageUp / PageDown, the single keys): the same
    // answers, never jQuery's :visible selector (it tested every element of the page).
    busymain: async function () {
      var Hh = FH(), calls = 0, orig = jQuery.find;
      var wrapped = function (sel) { if (/:visible/.test(String(sel))) calls++; return orig.apply(this, arguments); };
      Object.keys(orig).forEach(function (k) { wrapped[k] = orig[k]; });
      jQuery.find = wrapped;
      var out = {};
      try {
        out.idle = Hh.busy();
        var lb = document.createElement('div'); lb.id = 'emailLightbox'; lb.style.cssText = 'display:block;position:fixed;left:0;top:0;width:10px;height:10px';
        document.body.appendChild(lb); out.lb = Hh.busy(); lb.style.display = 'none'; out.lbHidden = Hh.busy(); lb.remove();
        var sm = document.createElement('div'); sm.className = 'context-submenu'; document.body.appendChild(sm); out.sm = Hh.busy(); sm.remove();
        var ov = document.createElement('div'); ov.className = 'infobox-overlay'; ov.style.cssText = 'width:10px;height:10px';
        document.body.appendChild(ov); out.ov = Hh.busy(); ov.style.display = 'none'; out.ovHidden = Hh.busy(); ov.remove();
      } finally { jQuery.find = orig; }
      R.chk.busySame = out.idle === false && out.lb === true && out.lbHidden === false && out.sm === true && out.ov === true && out.ovHidden === false;
      R.chk.noSlowSelector = calls === 0;
      R.info.busy = { out: out, calls: calls };
    },

    // The bar's size is set when it opens and holds as the results come in (round 4,
    // the user: "it should start out the max probable size to avoid the resizing"): the
    // count's words, the spinner, Filter to N rows arriving, "N more in rows your filter
    // hides", No matches, a bad pattern - same width, same height (a filter applied).
    steady: async function () {
      await searched('Open');
      blurAll(); await ctrlF();
      var b = barEl();
      if (!b) { R.chk.steadyWidth = R.chk.steadyHeight = R.chk.steadyFits = R.chk.roomCleared = R.chk.steadyNoFilter = false; await searched(''); return; }
      var r0 = b.getBoundingClientRect(), ws = [], hs = [], at = [];
      function rec(tag, W, Hh) { var r = barEl().getBoundingClientRect(); W.push(r.width); Hh.push(r.height); at.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
      rec('open', ws, hs);
      if (F()) F()._setSlice(0.01);
      var i = inp(); i.value = 'kilo'; i.dispatchEvent(new Event('input', { bubbles: true }));
      var t0 = Date.now(), seenBusy = false;
      while (Date.now() - t0 < 5000) {
        var s = st(); if (s.scanning) { seenBusy = true; rec('reading', ws, hs); }
        if (!s.scanning && !s.typing && s.n > 0) break;
        await sleep(3);
      }
      if (F()) F()._setSlice(10);
      rec('read', ws, hs);
      await until(function () { return btnShown(); }, 5000); rec('filter offered', ws, hs);
      key('Enter'); await settle(); rec('stepped', ws, hs);
      await find('zzzz-none'); rec('no matches', ws, hs);
      // a pattern needs its closing slash ("/[" is plain text: No matches) - and the words must show
      await find('/[/'); rec('bad pattern', ws, hs);
      var badSeen = st().count === 'Not a valid pattern';
      await find('alpha'); await until(function () { return btnShown(); }, 5000); rec('alpha', ws, hs);
      R.chk.steadyWidth = seenBusy && badSeen && ws.every(function (w) { return Math.abs(w - r0.width) < 0.6; });
      R.chk.steadyHeight = hs.every(function (h) { return Math.abs(h - r0.height) < 0.6; });
      // the places kept hold the longest probable words (a report of 99,999 rows): each word
      // drawn alone, in the same element's font, against the width the bar gives it
      var cnt = b.querySelector('.pnb-find-count'), fb = btn(), fits = [], fitsOk = !!(cnt && fb);
      function fit(proto, text) {
        var e = proto.cloneNode(false); e.removeAttribute('hidden');
        e.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;min-width:0;width:auto';
        e.textContent = text; b.appendChild(e);
        var w = e.getBoundingClientRect().width, have = proto.getBoundingClientRect().width;
        e.remove();
        fits.push(text + ' ' + w.toFixed(1) + '/' + have.toFixed(1));
        return w <= have + 0.5;
      }
      if (fitsOk) {
        ['Searching... 99%', 'Not a valid pattern', '99,999 of 99,999', '99,999 matches', 'No matches'].forEach(function (t) { fitsOk = fit(cnt, t) && fitsOk; });
        ['Filter to 99,999 rows', 'Filter to these rows'].forEach(function (t) { fitsOk = fit(fb, t) && fitsOk; });
      }
      R.chk.steadyFits = fitsOk;
      // closed, the filter cleared, opened again (the box keeps alpha: it reads at once): no
      // room kept for the hidden-rows line now, and again one size all through
      key('Escape'); await sleep(50);
      var why = { closed: !st().open, roomAtClose: barEl().classList.contains('pnb-find-room') };
      await searched('');
      why.applied = FH() ? FH().searchApplied() : null;
      blurAll(); await ctrlF();
      why.roomAtOpen = barEl().classList.contains('pnb-find-room'); R.info.why = why;
      var w2 = [], h2 = [];
      rec('reopened, no filter', w2, h2);
      await settle(); await until(function () { return btnShown(); }, 5000); rec('alpha, no filter', w2, h2);
      R.chk.roomCleared = !!barEl() && !barEl().classList.contains('pnb-find-room') && h2[0] < r0.height - 5;
      R.chk.steadyNoFilter = w2.every(function (w) { return Math.abs(w - r0.width) < 0.6; }) && h2.every(function (h) { return Math.abs(h - h2[0]) < 0.6; });
      R.info.steady = { at: at, fits: fits };
      key('Escape'); await sleep(50);
    },

    // ...and the grouped view (its own branch: the search the view last applied): a search on
    // when Find opens - the hidden-rows line's room from the start, one size all through.
    grp_steady: async function () {
      await searched('Open');
      blurAll(); await ctrlF();
      var b = barEl();
      if (!b) { R.chk.gSteady = R.chk.gRoom = false; return; }
      var r0 = b.getBoundingClientRect(), ws = [], hs = [], at = [];
      function rec(tag) { var r = barEl().getBoundingClientRect(); ws.push(r.width); hs.push(r.height); at.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
      rec('open');
      await find('kilo'); await until(function () { return btnShown(); }, 5000); rec('kilo');
      var s = st();
      await find('zzzz-none'); rec('no matches');
      R.chk.gRoom = b.classList.contains('pnb-find-room') && !!s.more;
      R.chk.gSteady = ws.every(function (w) { return Math.abs(w - r0.width) < 0.6; }) && hs.every(function (h) { return Math.abs(h - r0.height) < 0.6; });
      R.info.gsteady = { at: at, more: s.more };
    },

    // ---- round 5 (2026-10-20): a dialog with a table, a comparison's group names, narrow windows ----
    // Ctrl+F in a breakdown finds in ITS table: its cells ('#' out), the bar drawn over the
    // dialog, Enter stepping inside it, no Filter and no "more" line, a sort read again in the
    // new order, Esc closing Find and not the dialog, the dialog closing ending Find.
    dlg_find: async function () {
      var ov = await breakdown(120, 0);
      if (!ov) { R.chk.dlgTaken = false; return; }
      blurAll();
      var ev = await ctrlF(), b = barEl();
      R.chk.dlgTaken = ev.defaultPrevented && barShown() && st().dialog === true;
      var oz = parseInt(getComputedStyle(ov).zIndex, 10) || 0, bz = b ? (parseInt(getComputedStyle(b).zIndex, 10) || 0) : 0;
      var br = b ? b.getBoundingClientRect() : null, atBar = br ? document.elementFromPoint(br.left + 20, br.top + br.height / 2) : null;
      R.chk.dlgAbove = !!b && bz > oz && !!atBar && b.contains(atBar);
      if (!R.chk.dlgTaken || !inp()) {   // not Find's: the rest cannot be asked
        ['dlgCount', 'dlgStep', 'dlgNoFilter', 'dlgNoRowNo', 'dlgSort', 'dlgEscFind', 'dlgCloses'].forEach(function (k) { R.chk[k] = false; });
        return;
      }
      await find('kilo');
      var want = inDialog(ov, 'kilo'), s1 = st();
      R.chk.dlgCount = want > 3 && s1.n === want && s1.view === 'dialog' && hits().every(function (h) { return ov.contains(h.el); });
      key('Enter'); await settle(); key('Enter'); await settle();
      var c = ov.querySelector('td.pnb-find-cur'), curAt = st().cur;
      R.chk.dlgStep = !!c && inViewAny(c) && curAt === 2 && hits()[2] && hits()[2].el === c;
      await sleep(450);   // a Filter count would be in by now
      R.chk.dlgNoFilter = !btnShown() && st().more === null && st().promo === null;
      // a number never finds the '#' column's row numbers
      await find('7');
      var want7 = inDialog(ov, '7');
      R.chk.dlgNoRowNo = want7 > 0 && st().n === want7 && hits().every(function (h) { return h.el.cellIndex !== 0; });
      // a heading click sorts the breakdown: the same cells, read again in their new order
      await find('kilo');
      var s0 = st().scans, th = ov.querySelectorAll('table.infobox-drill-table thead th')[2];
      if (th) th.click();
      await sleep(250); await settle();
      var hs = hits(), ordered = hs.length > 1;
      for (var i = 1; i < hs.length; i++) { if (!(hs[i - 1].el.compareDocumentPosition(hs[i].el) & Node.DOCUMENT_POSITION_FOLLOWING)) { ordered = false; break; } }
      R.chk.dlgSort = !!th && st().scans > s0 && st().n === want && ordered;
      // Esc in the bar: Find closes, the dialog stays
      inp().focus(); key('Escape'); await sleep(80);
      R.chk.dlgEscFind = !barShown() && ov.isConnected && overlays().indexOf(ov) >= 0;
      // Find open in it again, then the dialog closed (its OK button): Find ends with it
      blurAll(); await ctrlF(); await find('kilo');
      var ok = ov.querySelector('.modal-btn-primary');
      if (ok) ok.click();
      await until(function () { return !ov.isConnected; }, 3000); await sleep(200);
      R.chk.dlgCloses = !!ok && !ov.isConnected && !barShown() && st().open === false;
      R.info.dlg = { want: want, n: s1.n, z: [oz, bz], want7: want7, cur: st().cur };
    },
    // A dialog with no table (an infobox of words): Ctrl+F stays the browser's.
    dlg_notable: async function () {
      HC.showInfoboxDialog({ title: 'Plain words', content: '<p>kilo is here, in words only</p>', mode: 'raw' });
      await until(function () { return !!topOverlay(); }, 3000); await sleep(200);
      blurAll();
      var ev = await ctrlF();
      R.chk.notableBrowser = !!topOverlay() && !ev.defaultPrevented && !barShown();
    },
    // Find on the table, then a breakdown over it: Ctrl+F there starts Find in it (the term
    // kept); the breakdown closing ends it; Ctrl+F again is the table's Find.
    dlg_switch: async function () {
      blurAll(); await ctrlF(); await find('kilo');
      var nFlat = st().n, ov = await breakdown(80, 20);
      var still = st().open === true && st().dialog === false;
      blurAll(); await ctrlF(); await settle();
      var want = inDialog(ov, 'kilo');
      R.chk.swDialog = still && st().dialog === true && !!inp() && inp().value === 'kilo' && want > 0 && st().n === want;
      var ok = ov.querySelector('.modal-btn-primary');
      if (ok) ok.click();
      await until(function () { return !ov.isConnected; }, 3000); await sleep(200);
      R.chk.swClosed = !barShown();
      blurAll(); await ctrlF(); await settle();
      R.chk.swBack = barShown() && st().dialog === false && st().view === 'flat' && st().n === nFlat;
      R.info.sw = { nFlat: nFlat, want: want, n: st().n };
    },
    // A second breakdown opened over the first: Find in the first ends (not on top any more);
    // Ctrl+F then finds in the second.
    dlg_ontop: async function () {
      var a = await breakdown(60, 0);
      blurAll(); await ctrlF(); await find('kilo');
      var inA = st().dialog === true && hits().length > 0 && hits().every(function (h) { return a.contains(h.el); });
      var b = await breakdown(60, 100);
      await sleep(250);
      R.chk.otEnds = inA && !barShown();
      blurAll(); await ctrlF(); await settle();
      R.chk.otSecond = !!b && b !== a && barShown() && st().dialog === true && hits().length > 0 && hits().every(function (h) { return b.contains(h.el); });
    },
    // A snapshot comparison (A vs B, drawn by main.js's runComparisonTwoSnapshots): a group's
    // name is found in its heading ("Modified Rows"), never its count; stepping onto it outlines it.
    cmp_names: async function () {
      var base = FX.slice(0, 60).map(function (r) { return { rowData: Object.assign({}, r) }; });
      var b2 = base.map(function (x) { return { rowData: Object.assign({}, x.rowData) }; });
      for (var i = 0; i < 5; i++) { b2[i].rowData.V_STATUS = 'Changed ' + i; }
      b2.splice(5, 3);
      for (var j = 0; j < 4; j++) { var nr = Object.assign({}, base[0].rowData); nr.V_ID = 'NEWROW-' + j; b2.push({ rowData: nr }); }
      // (a failure inside the comparison is a console.error and a toast the harness has no dock for)
      var cerr = [], oce = console.error;
      console.error = function () { cerr.push(Array.prototype.map.call(arguments, function (a) { return (a && a.stack) ? String(a.stack).slice(0, 500) : String(a); }).join(' ')); return oce.apply(console, arguments); };
      R.info.cmpErr = cerr;
      HC.runComparisonTwoSnapshots({ rows: base }, { rows: b2 }, ['V_ID']);
      var heads = function () { return Array.prototype.map.call(document.querySelectorAll('#groupedResultsContainer .group-header'), function (h) { return h.textContent.replace(/\s+/g, ' ').trim(); }); };
      await until(function () { return heads().some(function (t) { return /^Modified Rows\b/.test(t); }); }, 10000);
      await sleep(300); await frames(3);
      var gc = document.getElementById('groupedResultsContainer');
      R.info.cmpDbg = { fn: typeof HC.runComparisonTwoSnapshots, grpShown: !!(gc && gc.getClientRects().length), grp: gc ? gc.innerHTML.slice(0, 300) : null,
        err: $('#errorBox').text().slice(0, 300), undo: $('#undo_text_container').text().slice(0, 300), loading: $('#loadingOverlay').is(':visible'), msg: $('#loadingMessage').text() };
      blurAll();
      var ev = await ctrlF();
      await find('modified rows');
      var bands = hits().filter(function (h) { return h.kind === 'band'; });
      R.chk.cmpBand = ev.defaultPrevented && st().view === 'grouped' && bands.length === 1 && !!bands[0].el && /^Modified Rows\b/.test(bands[0].el.textContent.replace(/\s+/g, ' ').trim());
      // the count inside the name's span is not part of the name: "rows 5" finds no heading
      await find('rows 5');
      R.chk.cmpNoCount = hits().filter(function (h) { return h.kind === 'band'; }).length === 0;
      // stepping onto a name outlines it (and it is still found once painted)
      await find('removed rows');
      key('Enter'); await settle();
      var bh = hits().filter(function (h) { return h.kind === 'band'; })[0], cs = (bh && bh.el) ? getComputedStyle(bh.el) : null;
      R.chk.cmpOutline = !!cs && bh.el.classList.contains('pnb-find-cur') && cs.outlineStyle === 'solid';
      R.info.cmp = { bands: bands.length, heads: heads().slice(0, 6) };
    },
    // (pictures only, round 5: --scn shot_dlg,shot_narrow,shot_cmp --shot X.png)
    shot_dlg: async function () {
      await breakdown(120, 0); blurAll(); await ctrlF(); await find('kilo');
      key('Enter'); await settle(); key('Enter'); await settle(); await sleep(150); await frames(2);
    },
    shot_narrow: async function () {
      blurAll(); await ctrlF(); await find('kilo'); await until(function () { return btnShown(); }, 5000); await sleep(150); await frames(2);
    },
    shot_narrow_mid: async function () { await S.shot_narrow(); },
    shot_cmp: async function () {
      await S.cmp_names();
      await find('modified rows'); await sleep(150); await frames(2);
    },
    // A narrow window: two rows spanning it (420 px, a phone; 700 px, under the 720 px line)...
    narrow: async function () { await narrowCheck(); },
    narrow_mid: async function () { await narrowCheck(); },
    // ...and just past the line (760 px): the one-row bar, whole on screen.
    wide_edge: async function () {
      blurAll(); await ctrlF(); await find('kilo'); await until(function () { return btnShown(); }, 5000);
      var b = barEl();
      if (!b || !inp()) { R.chk.wOneRow = R.chk.wInView = false; return; }
      var r = b.getBoundingClientRect(), i = inp().getBoundingClientRect(), c = b.querySelector('.pnb-find-count').getBoundingClientRect();
      R.chk.wOneRow = Math.abs(c.top - i.top) < 8 && r.height < 45;
      R.chk.wInView = r.left >= 0 && r.right <= window.innerWidth;
      R.info.wide = { vw: window.innerWidth, bar: [Math.round(r.left), Math.round(r.right), Math.round(r.height)] };
    },

    // ---- the search's own highlight (marks) ----
    // The flat table: what the search found, in the rows on this page; the next page has its
    // own; the search cleared, none.
    mk_flat: async function () {
      $('#rowsPerPageSelector').val('25').trigger('change'); await sleep(150);
      await searched('kilo'); await sleep(60); await frames(2);
      var rs = hlRanges('pnb-filter');
      R.chk.marked = rs.length > 0 && rs.every(function (x) { return rangeText(x).toLowerCase() === 'kilo'; });
      R.chk.onPage = rs.length > 0 && rs.every(function (x) { var tr = x.startContainer.parentNode.closest('tr'); return !!tr && tr.style.display !== 'none' && !tr.classList.contains('search-hidden'); });
      R.chk.notRowNo = rs.every(function (x) { var td = x.startContainer.parentNode.closest('td'); return !!td && td.getAttribute('data-column') !== '#'; });
      var want = 0;
      kept().forEach(function (tr) {
        if (tr.style.display === 'none') return;
        Array.prototype.forEach.call(tr.cells, function (td) {
          if (td.getAttribute('data-column') === '#' || td.style.display === 'none') return;
          var m = td.textContent.match(/kilo/gi); want += m ? m.length : 0;
        });
      });
      R.chk.allOnPage = want > 0 && rs.length === want;
      var p1rows = rs.map(function (x) { return x.startContainer.parentNode.closest('tr'); });
      document.getElementById('nextPageBtn').click(); await sleep(150); await frames(2);
      var rs2 = hlRanges('pnb-filter');
      R.chk.followsPage = rs2.length > 0 && rs2.every(function (x) { var tr = x.startContainer.parentNode.closest('tr'); return !!tr && tr.style.display !== 'none' && p1rows.indexOf(tr) < 0; });
      await searched(''); await sleep(60); await frames(2);
      R.chk.clearedNone = hlSize('pnb-filter') === 0;
      R.info.mk = { n: rs.length, want: want, n2: rs2.length, page: pageInfo() };
    },
    // A column's term marks that column only ("10" is in the dates and amounts too).
    mk_col: async function () {
      await searched('V_ID 10'); await sleep(60); await frames(2);
      var rs = hlRanges('pnb-filter'), sid = colId('V_ID');
      var elsewhere = kept().some(function (tr) {
        return tr.style.display !== 'none' && Array.prototype.some.call(tr.cells, function (td) {
          var c = td.getAttribute('data-column'); return c !== sid && c !== '#' && td.textContent.indexOf('10') >= 0;
        });
      });
      R.chk.colOnly = elsewhere && rs.length > 0 && rs.every(function (x) { var td = x.startContainer.parentNode.closest('td'); return !!td && td.getAttribute('data-column') === sid; });
      await searched('Open'); await sleep(60); await frames(2);
      var g = hlRanges('pnb-filter'), r3 = cellOf(3, 'V_NAME');
      R.chk.globalAnyCol = !!r3 && g.some(function (x) { return r3.contains(x.startContainer); });   // "Open House"
      await searched('');
    },
    // The search's own forms: //whole cell//, /pattern/, = (the whole cell); a comparison or a
    // negation marks nothing.
    mk_forms: async function () {
      async function marksFor(q) { await searched(q); await sleep(60); await frames(2); return hlRanges('pnb-filter'); }
      var a = await marksFor('//Open//');
      R.chk.exactWhole = a.length > 0 && a.every(function (x) { var td = x.startContainer.parentNode.closest('td'); return rangeText(x) === 'Open' && td.textContent.trim() === 'Open'; });
      var b = await marksFor('/^kil/');
      R.chk.regexStart = b.length > 0 && b.every(function (x) { return x.startOffset === 0 && rangeText(x).toLowerCase() === 'kil'; });
      var c = await marksFor('V_STATUS = Closed');
      R.chk.equalsWhole = c.length > 0 && c.every(function (x) { return rangeText(x) === 'Closed'; });
      var d = await marksFor('H_NUM > 500'), e = await marksFor('!= Open');
      R.chk.noCompare = d.length === 0 && e.length === 0;
      await searched('');
    },
    // The grouped view: a group opened after the search gets its marks (the view's own watcher).
    grp_marks_closed: async function () {
      await searched('kilo'); await sleep(150); await frames(2);
      var n0 = hlSize('pnb-filter');
      var w = gWraps().filter(function (x) { return !x.classList.contains('search-hidden'); })[0];
      var hd = w && w.querySelector(':scope > .group-header');
      if (hd) hd.click();
      await sleep(600); await frames(3);
      var rs = hlRanges('pnb-filter');
      R.chk.opensMarked = !!w && rs.length > 0 && rs.every(function (x) { return w.contains(x.startContainer) && rangeText(x).toLowerCase() === 'kilo'; });
      R.chk.closedUnmarked = n0 === 0;
      R.info.gm = { n0: n0, n: rs.length };
    },
    // A pivot: its row labels the search found.
    piv_marks: async function () {
      await searched('Central'); await sleep(200); await frames(2);
      var rs = hlRanges('pnb-filter');
      R.chk.pivLabels = rs.length > 0 && rs.every(function (x) { var td = x.startContainer.parentNode.closest('td'); return !!td && td.hasAttribute('data-row-field') && rangeText(x).toLowerCase() === 'central'; });
      R.info.pm = { n: rs.length };
      await searched('');
    },
    // With Find: both shown, the search's under Find's; a print shows neither; painting never
    // touches a cell.
    mk_find: async function () {
      await searched('kilo'); await sleep(60);
      blurAll(); await ctrlF(); await find('alpha');
      var f = window.CSS && CSS.highlights;
      R.chk.bothShown = hlSize('pnb-filter') > 0 && (hlSize('pnb-find') + hlSize('pnb-find-cur')) > 0;
      R.chk.underFind = !!f && f.has('pnb-filter') && f.get('pnb-filter').priority < (f.has('pnb-find') ? f.get('pnb-find').priority : 0);
      window.dispatchEvent(new Event('beforeprint'));
      var during = hlSize('pnb-filter') + hlSize('pnb-find') + hlSize('pnb-find-cur');
      window.dispatchEvent(new Event('afterprint'));
      R.chk.printClean = during === 0 && hlSize('pnb-filter') > 0 && (hlSize('pnb-find') + hlSize('pnb-find-cur')) > 0;
      var mo = new MutationObserver(function () { });
      mo.observe(T(), { attributes: true, childList: true, subtree: true, characterData: true });
      if (F()) F()._paintMarks();
      var recs = mo.takeRecords(); mo.disconnect();
      R.chk.marksNoDom = !!F() && hlSize('pnb-filter') > 0 && recs.length === 0;
    },

    // ---- the sweep (round 3): Find, the search box and the views, mixed at random ------------
    // A seeded walk (?seed=, ?steps=) through Find (type, step, F3, Filter, Esc, x), the search
    // box (Enter, its clear x, deleting the term), paging, rows per page, a sort, grouping and
    // ungrouping, a pivot and back, groups and pivot groups opened / closed, a resize, a dialog.
    // After every step the invariants: no page error; an open bar's matches equal a fresh read
    // (_verify); every highlight is the term, in a drawn cell; the bar never on the current
    // match; the box's x iff it holds text; an empty box filters nothing; the search's own
    // highlight only marks its terms, in drawn rows, and nothing without a search.
    sweep: async function () {
      var qp = new URLSearchParams(location.search), seed = +(qp.get('seed') || 1), STEPS = +(qp.get('steps') || 60);
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      function pickOne(a) { return a[Math.floor(rnd() * a.length)]; }
      function overlap(a, c) { return a.right > c.left && a.left < c.right && a.bottom > c.top && a.top < c.bottom; }
      var TERMS = ['kilo', 'alpha', 'open', 'zulu unique', 'tier 2', '//Open//', '/^kil/', 'central', 'xyz-none', 'empty', '1-5', 'ID-10'];
      var SEARCHES = ['kilo', 'Open', 'V_STATUS Closed', 'alpha OR bravo', '', 'H_NUM > 500', 'Central', '//Pending//'];
      var log = [], bad = [], errs0 = window.__errors.length;
      function gShown() { return shown(document.getElementById('groupedResultsContainer')); }
      function pShown() { return shown(document.getElementById('pivot-output-container')); }
      async function waitSearch(h0, ms) { await until(function () { return (window.__HC_HIDES || 0) > h0; }, ms || 8000); await sleep(200); await settle(); }
      var ACTIONS = {
        find: async function () { var t = pickOne(TERMS); if (!barShown()) { blurAll(); await ctrlF(); } if (!barShown()) return 'find (not taken)'; await find(t); return 'find "' + t + '"'; },
        step: async function () { if (!barShown()) return 'step (closed)'; inp().focus(); key('Enter'); await settle(); return 'step'; },
        back: async function () { if (!barShown()) return 'back (closed)'; inp().focus(); key('Enter', { shift: true }); await settle(); return 'back'; },
        f3: async function () { blurAll(); key('F3'); await settle(); return 'F3'; },
        filter: async function () {
          if (!btnShown()) return 'filter (none)';
          var h0 = window.__HC_HIDES || 0; btn().click(); await waitSearch(h0); return 'Filter to N rows';
        },
        esc: async function () { if (!barShown()) return 'esc (closed)'; inp().focus(); key('Escape'); await sleep(80); return 'esc'; },
        closeX: async function () { var b = barEl() && barEl().querySelector('.pnb-find-close'); if (!b || !barShown()) return 'closeX (closed)'; b.click(); await sleep(80); return 'close x'; },
        search: async function () {
          var q = pickOne(SEARCHES), ts = document.getElementById('tableSearch'), h0 = window.__HC_HIDES || 0;
          ts.focus(); ts.value = q;
          ts.dispatchEvent(new Event('input', { bubbles: true }));
          ts.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', bubbles: true }));
          ts.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          await waitSearch(h0); return 'search "' + q + '" + Enter';
        },
        clearX: async function () {
          var x = document.getElementById('clearTableSearch');
          if (!x || !x.getClientRects().length) return 'clearX (hidden)';
          var h0 = window.__HC_HIDES || 0; $(x).trigger('click'); await waitSearch(h0, 4000); return 'search box x';
        },
        del: async function () {
          var ts = document.getElementById('tableSearch');
          if (!ts.value) return 'del (empty)';
          var h0 = window.__HC_HIDES || 0;
          ts.focus(); ts.value = '';
          ts.dispatchEvent(new Event('input', { bubbles: true }));
          ts.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
          await waitSearch(h0, 4000); return 'delete the term';
        },
        page: async function () {
          var b = document.getElementById(rnd() < 0.5 ? 'nextPageBtn' : 'prevPageBtn');
          if (!b || b.disabled || !b.getClientRects().length) return 'page (n/a)';
          b.click(); await sleep(150); await settle(); return 'page ' + b.id;
        },
        rpp: async function () { var v = pickOne(['25', '200', 'all']); $('#rowsPerPageSelector').val(v).trigger('change'); await sleep(250); await settle(); return 'rows per page ' + v; },
        sort: async function () { var d = rnd() < 0.5 ? 'asc' : 'desc'; HC.executeChainStep('sort|V_NAME|' + d); await sleep(350); await settle(); return 'sort V_NAME ' + d; },
        group: async function () {
          if (gShown() || pShown()) return 'group (n/a)';
          HC.executeChainStep('group|H_GROUP');
          await until(gShown, 8000); await sleep(500); await settle(); return 'group by H_GROUP';
        },
        ungroup: async function () {
          if (!gShown()) return 'ungroup (n/a)';
          $('#removeGroupingLink').trigger('click');
          await until(function () { return !gShown(); }, 8000); await sleep(500); await settle(); return 'remove grouping';
        },
        pivot: async function () {
          if (pShown()) return 'pivot (already)';
          HC.executeChainStep('pivot|H_GROUP,H_GROUP2|V_STATUS|H_AMT|sum');
          await until(function () { return pShown() && !!document.querySelector('#pivotResultTable tbody td'); }, 8000); await sleep(500); await settle(); return 'pivot';
        },
        unpivot: async function () {
          if (!pShown()) return 'unpivot (n/a)';
          $('#exitPivotModeBtn').trigger('click');
          await until(function () { return !pShown(); }, 8000); await sleep(500); await settle(); return 'exit pivot';
        },
        toggleGroup: async function () {
          var hs = Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer .group-header'), shown);
          if (!hs.length) return 'group toggle (n/a)';
          var hd = hs[Math.floor(rnd() * hs.length)]; hd.click(); await sleep(450); await settle();
          return 'group toggle ' + ((hd.closest('.group-wrapper') || { getAttribute: function () { return '?'; } }).getAttribute('data-group-key'));
        },
        pivToggle: async function () {
          var ts = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable .pivot-collapse-toggle-right'), shown);
          if (!ts.length) return 'pivot toggle (n/a)';
          ts[Math.floor(rnd() * ts.length)].click(); await sleep(350); await settle(); return 'pivot group toggle';
        },
        resize: async function () { window.dispatchEvent(new Event('resize')); await sleep(100); return 'resize'; },
        dialog: async function () {
          $('#settingsPanel').addClass('is-open'); blurAll();
          var ev = await ctrlF(), taken = ev.defaultPrevented;
          $('#settingsPanel').removeClass('is-open');
          if (taken) bad.push({ at: log.length, after: 'dialog', why: 'Ctrl+F taken under a dialog' });
          return 'Ctrl+F under a dialog';
        }
      };
      var WEIGHTS = [['find', 6], ['step', 4], ['back', 2], ['f3', 1], ['filter', 2], ['esc', 2], ['closeX', 1], ['search', 4], ['clearX', 2], ['del', 1],
                     ['page', 2], ['rpp', 1], ['sort', 1], ['group', 2], ['ungroup', 2], ['pivot', 1], ['unpivot', 1], ['toggleGroup', 2], ['pivToggle', 1], ['resize', 1], ['dialog', 1]];
      var total = WEIGHTS.reduce(function (a, w) { return a + w[1]; }, 0);
      function pickAction() { var x = rnd() * total; for (var i = 0; i < WEIGHTS.length; i++) { x -= WEIGHTS[i][1]; if (x < 0) return WEIGHTS[i][0]; } return 'find'; }
      function markOk(t, terms, td) {
        var low = t.toLowerCase(), whole = td ? td.textContent.replace(/[\s\xa0]+/g, ' ').trim().toLowerCase() : '';
        return terms.some(function (x) {
          if (x.how === 'regex') { try { return new RegExp(x.text, x.cs ? '' : 'i').test(t); } catch (e) { return false; } }
          var w = String(x.text).replace(/[\s\xa0]+/g, ' ').trim().toLowerCase();
          if (x.how === 'contains') return low === w;
          return whole === w || whole.replace(/[^a-z0-9]/g, '') === w.replace(/[^a-z0-9]/g, '') || low === whole;
        });
      }
      function check(s, what) {
        function fail(why) { bad.push({ at: s, after: what, why: why, recent: log.slice(-6) }); }
        if (window.__errors.length > errs0) { fail('page error: ' + window.__errors.slice(errs0).join(' | ').slice(0, 300)); errs0 = window.__errors.length; }
        var F_ = F(), ts = document.getElementById('tableSearch'), cont = document.getElementById('tableSearchContainer');
        if (F_ && F_.isOpen()) {
          var s_ = F_._state();
          if (!s_.scanning && !s_.typing) {
            var v = F_._verify();
            if (v && !v.none && (v.n !== s_.n || v.hidden !== s_.hidden)) fail('stale matches: the bar ' + s_.n + ' (+' + s_.hidden + ' hidden) vs a fresh read ' + v.n + ' (+' + v.hidden + ') in ' + v.view);
            var sp = F_._text.compile(inp() ? inp().value : '');
            if (sp && !sp.bad) {
              hlRanges('pnb-find').concat(hlRanges('pnb-find-cur')).forEach(function (r) {
                var t = rangeText(r), host = r.startContainer.parentNode, cell = host && host.closest && host.closest('td, .group-name');
                if (!r.startContainer.isConnected) { fail('a Find highlight on a removed node'); return; }
                if (!cell || !shown(cell)) { fail('a Find highlight in a cell not drawn: "' + t + '"'); return; }
                if (sp.kind === 'text' && t.replace(/[\s\xa0]+/g, ' ').toLowerCase() !== sp.needle) fail('a Find highlight that is not the term: "' + t + '"');
              });
            }
            var curEl = document.querySelector('.pnb-find-cur'), b = barEl();
            if (curEl && b && shown(curEl) && overlap(b.getBoundingClientRect(), curEl.getBoundingClientRect())) fail('the bar covers the current match');
          }
        }
        if (!!ts.value !== cont.classList.contains('has-text')) fail('the box\'s x: has-text ' + cont.classList.contains('has-text') + ' with the box "' + ts.value + '"');
        if (!ts.value.trim()) {
          if (T().querySelector('tbody tr.search-hidden')) fail('flat rows hidden under an empty box');
          if (gShown() && document.querySelector('#groupedResultsContainer tr.search-hidden, #groupedResultsContainer .group-wrapper.search-hidden')) fail('grouped rows hidden under an empty box');
        }
        var marks = hlRanges('pnb-filter'), q = ts.value.trim();
        if (!q && marks.length) fail(marks.length + ' search marks with no search');
        if (q && marks.length) {
          var terms = FH().searchTerms(q) || [];
          marks.forEach(function (r) {
            var t = rangeText(r), host = r.startContainer.parentNode, td = host && host.closest && host.closest('td');
            if (!r.startContainer.isConnected) { fail('a search mark on a removed node'); return; }
            if (!td || !shown(td)) { fail('a search mark in a cell not drawn: "' + t + '"'); return; }
            if (!markOk(t, terms, td)) fail('a search mark that is not a term of "' + q + '": "' + t + '"');
          });
        }
      }
      for (var s = 0; s < STEPS && bad.length < 12; s++) {
        var a = pickAction(), what;
        try { what = await ACTIONS[a](); } catch (e) { what = a + ' threw'; bad.push({ at: s, after: a, why: 'the step threw: ' + String((e && e.message) || e) }); }
        await sleep(160); await frames(2);
        log.push(what);
        check(s, what);
      }
      R.chk.noViolations = bad.length === 0;
      R.info.sweep = { seed: +(qp.get('seed') || 1), steps: log.length, bad: bad.slice(0, 12), log: log.slice(0, 120) };
    },

    // prof\prof.py drives the page itself (CDP Profiler around each action): boot only.
    prof: async function () {
      R.info.prof = { rows: T().tBodies[0].rows.length, cols: T().tHead.rows[T().tHead.rows.length - 1].cells.length };
    },

    // Text selected in the table becomes the term.
    sel: async function () {
      var td = cellOf(10, 'V_NAME'), want = td.textContent.trim();
      var range = document.createRange(); range.selectNodeContents(td);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(range);
      blurAll(); await ctrlF(); await settle();
      R.chk.prefill = !!inp() && inp().value === want && st().n >= 1;
      R.info.sel = { want: want, got: inp() ? inp().value : null };
    }
  };

  (async function () {
    try {
      await boot();
      var run = S[SCN] || (/probe/.test(SCN) ? S.viewProbe : null) || (/sweep/.test(SCN) ? S.sweep : null);
      if (!run) throw new Error('unknown scenario ' + SCN);
      await run();
      await sleep(50);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    R.missing = window.__HC_MISSING || [];
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
