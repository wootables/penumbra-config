// cellsel suite - browser half (2026-10-09). Runs ONE scenario (?scn=) against
// the main.js + js/penumbra_cellsel.js the page loaded and publishes
//   window.__HCRESULT = { scn, chk: {name: bool}, info: {...}, errors: [...] }
// and window.__HCDONE = true. run.py asserts every chk on the candidate (L-*)
// and no page errors (E-*); --control loads an EMPTY module, where every L
// check must go red. Checks named sane* are harness sanity (green either way).
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames(n) { var p = Promise.resolve(); for (var i = 0; i < (n || 3); i++) p = p.then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }); return p; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function CS() { return (window.Penumbra && window.Penumbra.cellSel) || null; }

  function T() { return document.getElementById('resultsTable'); }
  function shownRows() {
    return Array.prototype.filter.call(T().tBodies[0].rows, function (tr) {
      return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && tr.getClientRects().length;
    });
  }
  function colId(name) {
    var th = document.querySelector('#tableHeader th[data-colname="' + name + '"]');
    return th ? th.getAttribute('data-column') : null;
  }
  function cell(r, name) { var tr = shownRows()[r]; return tr ? tr.querySelector('td[data-column="' + colId(name) + '"]') : null; }
  function hashCell(r) { var tr = shownRows()[r]; return tr ? tr.querySelector('td[data-column="#"]') : null; }
  function txt(td) { return (td.innerText || '').replace(/ /g, ' ').trim(); }
  function painted() { return Array.prototype.slice.call(document.querySelectorAll('table td.pnb-csel')); }
  function count() { return CS() ? CS().count() : 0; }
  function seg() { return document.getElementById('pnbCellSelReadout'); }
  function segShown() { var s = seg(); return !!(s && !s.hidden && s.getClientRects().length); }
  function val(k) { var b = seg() && seg().querySelector('.pnb-csel-v[data-k="' + k + '"]'); return b ? b.textContent : null; }

  function center(el) { var b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
  function mouse(type, el, o) {
    o = o || {};
    var c = center(el);
    var ev = new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, button: 0,
      buttons: (type === 'mouseup' || type === 'click') ? 0 : 1,
      clientX: c.x, clientY: c.y, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, metaKey: !!o.meta
    });
    el.dispatchEvent(ev);
    return ev;
  }
  // The nearest element holding both (where a real click lands after a drag).
  function common(a, b) { var n = a; while (n && !n.contains(b)) n = n.parentNode; return n; }
  // A drag through cells: press on the first, move over each, release on the last
  // and the click the browser would send to their common ancestor.
  async function drag(cells, o) {
    o = o || {};
    mouse('mousedown', cells[0], o);
    for (var i = 0; i < cells.length; i++) mouse('mousemove', cells[i], o);
    var last = cells[cells.length - 1];
    mouse('mouseup', last, o);
    var target = cells.reduce(function (acc, c) { return common(acc, c); });
    var ck = mouse('click', target, o);
    await sleep(10);
    return ck;
  }
  async function click(el, o) { mouse('mousedown', el, o); mouse('mouseup', el, o); var ck = mouse('click', el, o); await sleep(10); return ck; }

  function money(t) { var m = /^(-)?\$([\d,]+\.\d\d)$/.exec(String(t).trim()); return m ? Math.round(parseFloat(m[2].replace(/,/g, '')) * 100) * (m[1] ? -1 : 1) : null; }
  function fmtCents(c) { var s = (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (c < 0 ? '-' : '') + '$' + s; }

  function search(q) {
    $('#tableSearch').val(q);
    HC.runTableSearch();
  }
  async function clearSearch() {
    search('');
    await until(function () { return !T().querySelector('tbody tr.search-hidden'); }, 15000);
    await sleep(200); await frames(2);
  }

  function copyEvent() {
    var dt = new DataTransfer();
    var ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented, text: dt.getData('text/plain'), html: dt.getData('text/html') };
  }

  var MODE = /^g/.test(SCN) ? 'grouped' : (/^p/.test(SCN) ? 'pivot' : 'flat');
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
    // ---- round 2: the grouped view -------------------------------------
    // A drag in one group's table; it never reaches into another group; Ctrl+click
    // adds a cell of another group; the copy writes both, a blank line between.
    // glsweep: the List layout's selected outer group draws its groups as ONE table - stood in
    // here (window.Penumbra.groupList.mergeTables; the List module is not loaded): two group
    // tables are one grid - a drag, a Shift+click and Ctrl+A run on from one into the other,
    // and a copy is one table.
    gmerge: async function () {
      var t0 = gtabs()[0], t1 = gtabs()[1];
      R.chk.saneTables = gtabs().length === 6 && !!t0 && !!t1;
      window.Penumbra.groupList = { mergeTables: function (t) { return (t === t0 || t === t1) ? [t0, t1] : null; } };
      function shown(t) { return Array.prototype.filter.call(t.tBodies[0].rows, function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none' && tr.getClientRects().length; }); }
      var n0 = shown(t0).length, a = gcell(t0, 0, 'V_AMOUNT'), z = gcell(t1, 0, 'V_AMOUNT');
      mouse('mousedown', a); mouse('mousemove', z); mouse('mouseup', z); await sleep(10);
      var pd = painted();
      R.chk.mDrag = count() === n0 + 1 && pd.some(function (td) { return td.closest('table') === t1; });
      R.info.drag = { count: count(), n0: n0 };
      await click(a);
      await click(gcell(t1, 1, 'V_AMOUNT'), { shift: true });
      R.chk.mShift = count() === n0 + 2;
      await click(a);
      key('a', { ctrl: true }); await sleep(20);
      var want = 0;
      [t0, t1].forEach(function (t) { shown(t).forEach(function (tr) { Array.prototype.forEach.call(tr.cells, function (td) { if (td.style.display !== 'none' && td.getAttribute('data-column') !== '#') { want++; } }); }); });
      var pa = painted();
      R.chk.mAll = count() === want && pa.some(function (td) { return td.closest('table') === t1; });
      R.info.all = { count: count(), want: want };
      var p = CS().payload();
      R.chk.mCopyOne = !!p && p.tables === 1;
      window.Penumbra.groupList = undefined;
    },
    gdrag: async function () {
      var t0 = gtabs()[0], t1 = gtabs()[1];
      var a = gcell(t0, 0, 'V_AMOUNT'), b = gcell(t0, 1, 'V_AMOUNT'), c = gcell(t0, 2, 'V_AMOUNT');
      R.chk.saneTables = gtabs().length === 6 && !!a && !!c;
      await drag([a, b, c]);
      var cents = [a, b, c].map(function (x) { return money(txt(x)); });
      R.chk.gCount3 = count() === 3 && painted().length === 3;
      R.chk.gSum = val('sum') === fmtCents(cents[0] + cents[1] + cents[2]);
      // the pointer wanders into the next group's table: the block stays put
      mouse('mousedown', a); mouse('mousemove', b); mouse('mousemove', gcell(t1, 0, 'V_AMOUNT')); mouse('mouseup', gcell(t1, 0, 'V_AMOUNT'));
      await sleep(10);
      R.chk.gStaysInTable = count() === 2 && painted().every(function (td) { return td.closest('table') === t0; });
      // Ctrl+click a cell of the next group
      await click(gcell(t1, 0, 'V_AMOUNT'), { ctrl: true });
      R.chk.gCtrlOther = count() === 3;
      var p = CS().payload();
      R.chk.gCopyTwoTables = !!p && p.tables === 2 && p.text.split('\r\n\r\n').length === 2;
      R.info.copy = p && p.text;
      // the group's totals row is not a cell to select: a press there clears
      var ft = t0.tFoot && t0.tFoot.querySelector('td[data-column="' + colId('V_AMOUNT') + '"]');
      mouse('mousedown', ft); mouse('mouseup', ft);
      R.chk.gFootClears = !!ft && count() === 0;
      // click-to-filter in the grouped view: the click that ends a drag does not filter
      document.body.classList.add('pnb-click-filter');
      var s1 = gcell(t0, 0, 'V_STATUS'), s2 = gcell(t0, 1, 'V_STATUS');
      mouse('mousedown', s1); mouse('mousemove', s2); mouse('mousemove', s1); mouse('mouseup', s1); mouse('click', s1);
      await sleep(30);
      R.chk.gDragNoFilter = $('#tableSearch').val() === '' && count() === 1;
      // a re-render of the grouped view clears it
      await drag([gcell(t0, 0, 'V_ID'), gcell(t0, 1, 'V_ID')]);
      var had = count();
      $('#groupedResultsContainer').append('<div class="zz-x"></div>');
      await sleep(30);
      R.chk.gClearOnRebuild = had === 2 && count() === 0;
    },
    // nested groups: a drag inside an inner group's table
    gndrag: async function () {
      var t = gtabs()[0];
      R.chk.saneNested = gtabs().length > 6;
      await drag([gcell(t, 0, 'V_NAME'), gcell(t, 1, 'V_AMOUNT')]);
      R.chk.gnBlock = count() === 4 && val('count') === '4';
    },

    // ---- round 2: the pivot ---------------------------------------------
    // value cells: a 3 x 3 block, its sum, its copy
    pdrag: async function () {
      var keys = pkeys();
      R.chk.saneKeys = keys.join() === 'Closed,Open,Pending';
      var a = pcell(0, 'Closed'), z = pcell(2, 'Pending');
      await drag([a, pcell(1, 'Open'), z]);
      var want = 0;
      for (var r = 0; r <= 2; r++) keys.forEach(function (k) { want += num(txt(pcell(r, k))); });
      R.chk.pCount9 = count() === 9;
      R.chk.pSum = !!CS().stats() && Math.abs(CS().stats().raw.sum - want) < 1e-6;
      var p = CS().payload();
      R.chk.pCopy3x3 = !!p && p.rows === 3 && p.cols === 3 && p.text.split('\r\n')[0].split('\t')[0] === txt(a);
      R.chk.pOutline = a.classList.contains('pnb-csel-t') && a.classList.contains('pnb-csel-l') && !a.classList.contains('pnb-csel-r') && z.classList.contains('pnb-csel-b') && z.classList.contains('pnb-csel-r');
      R.info.p = { want: want, got: CS().stats() && CS().stats().raw, text: p && p.text };
    },
    // a label spanning three rows: dragging from it to its first leaf's value covers
    // all three rows; it counts once; its chevron is not part of its text
    pspan: async function () {
      var lab = plabel(0, '0');
      R.chk.saneRowspan = !!lab && lab.rowSpan === 3;
      await drag([lab, plabel(0, '1'), pcell(0, 'Closed')]);
      R.chk.pSpanCount = count() === 1 + 3 + 3;
      var p = CS().payload(), lines = p ? p.text.split('\r\n') : [];
      R.chk.pSpanOnce = lines.length === 3 && lines[0].split('\t')[0] === '[Blank]' && lines[1].split('\t')[0] === '' && lines[2].split('\t')[0] === '';
      R.chk.pNoChevron = !!p && p.text.indexOf('◀') < 0 && p.text.indexOf('▶') < 0;
      // the last frozen label column (its own separator shadow) shows the tint too
      var selT = plabel(0, '1'), offT = plabel(5, '1');
      R.chk.pStickyTint = !!selT && !!offT && selT.classList.contains('pnb-csel') && selT.classList.contains('pivot-last-sticky') &&
        getComputedStyle(selT).boxShadow !== getComputedStyle(offT).boxShadow && /rgba?\(/.test(getComputedStyle(selT).boxShadow);
      R.info.sticky = [getComputedStyle(selT).boxShadow, getComputedStyle(offT).boxShadow];
      R.info.span = p && p.text;
      // across a group boundary: the next group's first leaf row (the hidden summary row is skipped)
      await drag([pcell(0, 'Closed'), pcell(3, 'Closed')]);
      R.chk.pSkipsHiddenSummary = count() === 4;
      R.info.rows4 = [0, 1, 2, 3].map(function (r) { return prow(r).getAttribute('data-pivot-row'); });
    },
    // the Grand Total row
    ptotal: async function () {
      var ft = document.querySelector('#pivotResultTable tfoot tr');
      var f = function (k) { return ft.querySelector('td[data-col-key="' + k + '"]'); };
      await drag([f('Closed'), f('Open'), f('Pending')]);
      R.chk.pFootCount = count() === 3;
      R.chk.pFootSum = !!CS().stats() && Math.abs(CS().stats().raw.sum - (num(txt(f('Closed'))) + num(txt(f('Open'))) + num(txt(f('Pending'))))) < 1e-6;
      var gl = ft.querySelector('td[colspan]');
      await drag([gl, f('Closed')]);
      R.chk.pFootLabel = count() === 2 && val('count') === '2';
      // from the body down into the Grand Total row
      await drag([pcell(0, 'Closed'), f('Closed')]);
      R.chk.pBodyToFoot = count() === prows().length + 1;
      R.info.pf = { count: count(), rows: prows().length, gl: gl && gl.colSpan, foot: (CS().payload() || {}).text };
    },
    // a label's click still expands / collapses; the click that ends a drag does not;
    // a collapse clears the selection
    pclick: async function () {
      var lab = plabel(0, '0'), tog = lab.querySelector('.pivot-collapse-toggle');
      mouse('mousedown', lab); mouse('mousemove', plabel(0, '1')); mouse('mousemove', lab); mouse('mouseup', lab); mouse('click', lab);
      await sleep(50);
      R.chk.pDragNoToggle = tog.getAttribute('aria-expanded') === 'true' && count() === 1;
      await drag([pcell(0, 'Closed'), pcell(1, 'Closed')]);
      var had = count();
      $(tog).trigger('click');
      await sleep(80);
      R.chk.pClearOnCollapse = had === 2 && count() === 0 && tog.getAttribute('aria-expanded') === 'false';
      // and a plain click on the label toggles it back (nothing swallows it)
      await sleep(20);
      var before = plabel(0, '0').querySelector('.pivot-collapse-toggle').getAttribute('aria-expanded');
      await click(plabel(0, '0'));
      await sleep(80);
      R.chk.sanePlainToggles = plabel(0, '0').querySelector('.pivot-collapse-toggle').getAttribute('aria-expanded') !== before;
    },
    // ---- round 3: the keyboard -------------------------------------------
    keys: async function () {
      var docSeen = [];
      document.addEventListener('keydown', function (e) { docSeen.push(e.key); }, true);   // main.js's hotkeys listen here
      var a = cell(0, 'V_NAME');
      mouse('mousedown', a); mouse('mouseup', a); mouse('click', a);
      R.chk.activeOnPress = a.getAttribute('tabindex') === '-1' && a.classList.contains('pnb-csel-active') && CS().active() === a;
      R.chk.noRingAfterClick = !document.body.classList.contains('pnb-csel-kb');
      a.focus();   // the browser focuses a tabindex cell on a real press; a synthetic one does not
      var ev = key('ArrowDown');
      R.chk.downMoves = document.activeElement === cell(1, 'V_NAME') && ev.defaultPrevented;
      R.chk.oldTiGone = R.chk.activeOnPress && !a.hasAttribute('tabindex') && !a.classList.contains('pnb-csel-active');
      R.chk.kbRing = document.body.classList.contains('pnb-csel-kb');
      key('ArrowRight');
      R.chk.rightMoves = document.activeElement === cell(1, 'V_AMOUNT');
      key('ArrowDown', { shift: true }); key('ArrowDown', { shift: true });
      R.chk.shiftExtends = count() === 3 && document.activeElement === cell(1, 'V_AMOUNT');
      key('ArrowRight', { shift: true });
      R.chk.shiftRight = count() === 6 && segShown() && val('count') === '6';
      key('ArrowLeft');
      R.chk.plainClears = count() === 0 && document.activeElement === cell(1, 'V_NAME');
      var last = shownRows().length - 1;
      docSeen.length = 0;
      key('ArrowDown', { ctrl: true });
      R.chk.ctrlDownEdge = document.activeElement === cell(last, 'V_NAME');
      R.chk.ctrlNotPage = docSeen.indexOf('ArrowDown') < 0;
      var sb = document.getElementById('pnbStatusBar').getBoundingClientRect().top;
      var cr = document.activeElement.getBoundingClientRect();
      R.chk.revealed = cr.bottom <= sb + 1 && cr.top >= 0;
      R.info.reveal = { cell: [Math.round(cr.top), Math.round(cr.bottom)], sb: Math.round(sb), y: Math.round(scrollY) };
      key('Home', { ctrl: true });
      R.chk.ctrlHome = document.activeElement === cell(0, 'V_ID');
      key('End', { ctrl: true });
      R.chk.ctrlEnd = document.activeElement === cell(last, 'V_STATUS');
      key('Home');
      var h1 = document.activeElement === cell(last, 'V_ID');
      key('End');
      R.chk.homeEnd = h1 && document.activeElement === cell(last, 'V_STATUS');
      key('Home', { ctrl: true });
      ev = key('ArrowUp');
      R.chk.edgeStays = document.activeElement === cell(0, 'V_ID') && ev.defaultPrevented;
      key('a', { ctrl: true });
      R.chk.ctrlA = count() === shownRows().length * 6;
      key('Escape');
      var esc1 = count() === 0 && document.activeElement === cell(0, 'V_ID');
      key('Escape');
      R.chk.escTwice = esc1 && document.activeElement !== cell(0, 'V_ID');
      // nothing focused: the arrows are the page's
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
      ev = key('ArrowDown');
      R.chk.arrowsFreeWhenUnfocused = !ev.defaultPrevented;
      // Ctrl+C with no block copies the active cell
      cell(2, 'V_AMOUNT').focus();
      mouse('mousedown', cell(2, 'V_AMOUNT')); mouse('mouseup', cell(2, 'V_AMOUNT'));
      cell(2, 'V_AMOUNT').focus();
      var cp = copyEvent();
      R.chk.copyActive = cp.prevented && cp.text === txt(cell(2, 'V_AMOUNT'));
      // the table is a Tab stop; arriving by keyboard lands on the active cell
      R.chk.tabStop = T().getAttribute('tabindex') === '0';
      blurAll(); key('Tab'); T().focus();
      R.chk.tabInto = document.activeElement === cell(2, 'V_AMOUNT');
      // Shift+Tab out of a cell rests on the table (the next Shift+Tab leaves)
      T().focus();
      R.chk.shiftTabRests = document.activeElement === T();
      // a mouse press on a heading focuses the table and stays there
      blurAll();
      var th = document.querySelector('#tableHeader th[data-colname="V_DATE"]');
      mouse('mousedown', th); T().focus(); mouse('mouseup', th);
      R.chk.mouseFocusStays = document.activeElement === T();
      R.chk.noRingAfterMouse = !document.body.classList.contains('pnb-csel-kb');
    },
    // a grid read before a search is not trusted after it
    kstale: async function () {
      var a = cell(0, 'V_ID');
      mouse('mousedown', a); mouse('mouseup', a); a.focus();
      copyEvent();   // reads the grid with nothing watching
      search('Open');
      await until(function () { return T().querySelector('tbody tr.search-hidden'); }, 15000); await sleep(300);
      var b = cell(0, 'V_ID'), want = cell(1, 'V_ID');
      mouse('mousedown', b); mouse('mouseup', b); b.focus();
      key('ArrowDown');
      R.chk.freshAfterSearch = document.activeElement === want;
      R.info = { got: document.activeElement && txt(document.activeElement), want: txt(want) };
    },
    gkeys: async function () {
      var t0 = gtabs()[0], t1 = gtabs()[1];
      var rows0 = Array.prototype.filter.call(t0.tBodies[0].rows, function (tr) { return tr.style.display !== 'none'; }).length;
      var a = gcell(t0, rows0 - 1, 'V_AMOUNT');
      mouse('mousedown', a); mouse('mouseup', a); a.focus();
      key('ArrowDown');
      R.chk.gCross = document.activeElement === gcell(t1, 0, 'V_AMOUNT');
      key('ArrowUp');
      R.chk.gCrossBack = document.activeElement === a;
      var ev = key('ArrowDown', { shift: true });
      R.chk.gShiftNoCross = document.activeElement === a && ev.defaultPrevented && count() === 0;
      var box = document.getElementById('groupedResultsContainer');
      R.chk.gTabStop = box.getAttribute('tabindex') === '0';
      blurAll(); key('Tab'); box.focus();
      R.chk.gTabInto = document.activeElement === a;   // the active cell
    },
    pkeys: async function () {
      var c0 = pcell(0, 'Closed');
      mouse('mousedown', c0); mouse('mouseup', c0); c0.focus();
      key('ArrowLeft');
      var t1 = document.activeElement === plabel(0, '1');
      key('ArrowLeft');
      R.chk.pLeftToLabels = t1 && document.activeElement === plabel(0, '0');
      key('ArrowDown');
      R.chk.pDownFromSpan = document.activeElement === plabel(3, '0');   // past its 3 rows and the hidden summary row
      key('ArrowRight');
      key('ArrowUp');
      R.chk.pUpIntoGroup = document.activeElement === plabel(2, '1');
      key('End', { ctrl: true });
      var ae = document.activeElement;
      R.chk.pCtrlEndFoot = !!ae && !!ae.closest('tfoot') && ae.classList.contains('pivot-grand-total');
      key('ArrowUp', { shift: true });
      R.chk.pShiftUpFromFoot = count() === 2;
      R.chk.pTabStop = document.getElementById('pivot-output-container').getAttribute('tabindex') === '0';
    },
    // ---- round 4: the snapshot comparison and breakdown tables -----------
    // A comparison group as main.js renders it (~95520-95670): '#', the hidden
    // __SNAP_TYPE, a changed cell holding the new value + the was / now pair.
    gsnap: async function () {
      function chg(was, now) {
        return '<td data-column="0" class="snap-cell-modified" title="Was: ' + was + '"><span class="snap-ba-now-only">' + now + '</span>' +
          '<span class="snap-ba-pair"><span class="snap-ba-label">[was:]</span> <span class="snap-ba-was-val">' + was + '</span><br>' +
          '<span class="snap-ba-label">[now:]</span> <span class="snap-ba-now-val">' + now + '</span></span></td>';
      }
      function row(n, amt, name) { return '<tr><td data-column="#">' + n + '</td><td data-column="__SNAP_TYPE" style="display:none">Modified Rows</td>' + amt + '<td data-column="1">' + name + '</td></tr>'; }
      var wrap = document.createElement('div'); wrap.id = 'snapshotComparisonContainer';
      wrap.innerHTML = '<div class="group-wrapper open"><div class="group-content" style="display:block"><table><thead><tr>' +
        '<th data-column="#" data-colname="#">#</th><th data-column="__SNAP_TYPE" data-colname="__SNAP_TYPE" style="display:none">__SNAP_TYPE</th>' +
        '<th data-column="0" data-colname="AMT">AMT</th><th data-column="1" data-colname="NAME">NAME</th></tr></thead><tbody>' +
        row(1, chg('5', '10'), 'Ann') + row(2, '<td data-column="0">20</td>', 'Bo') + row(3, chg('1', '30'), 'Cy') + '</tbody></table></div></div>';
      document.getElementById('groupedResultsContainer').prepend(wrap);
      await frames(2);
      var t = wrap.querySelector('table');
      var c = function (r, col) { return t.tBodies[0].rows[r].querySelector('td[data-column="' + col + '"]'); };
      await drag([c(0, '0'), c(1, '0'), c(2, '0')]);
      R.chk.snapNowSum = count() === 3 && !!CS().stats() && CS().stats().raw.sum === 60;
      // "Show both": the same sum, and the copy is the new values
      document.body.classList.add('snap-show-before-after');
      await frames(2);
      R.chk.saneBothShown = getComputedStyle(c(0, '0').querySelector('.snap-ba-pair')).display !== 'none';
      await drag([c(0, '0'), c(1, '0'), c(2, '0')]);
      R.chk.snapBothSum = !!CS().stats() && CS().stats().raw.sum === 60;
      var p = CS().payload();
      R.chk.snapCopyNow = !!p && p.text === '10\r\n20\r\n30';
      // '#' and the hidden __SNAP_TYPE stay out: AMT..NAME over 3 rows = 6
      await drag([c(0, '0'), c(2, '1')]);
      R.chk.snapBlock = count() === 6 && CS().payload().cols === 2;
      R.info = { stats: CS().stats(), copy: p && p.text };
    },
    // A real breakdown: a plain click on a pivot value cell opens it in an infobox.
    pdrill: async function () {
      // the Grand Total cell: every source row (a single cell holds only a few here)
      await click(document.querySelector('#pivotResultTable tfoot td[data-grand-total]'));
      var ok = await until(function () { return document.querySelector('.infobox-overlay table.infobox-drill-table tbody tr'); }, 8000);
      R.chk.saneDrillOpen = !!ok;
      if (!ok) return;
      var dt = document.querySelector('.infobox-overlay table.infobox-drill-table'), ov = dt.closest('.infobox-overlay');
      var heads = Array.prototype.map.call(dt.tHead.rows[0].cells, function (th) { return th.textContent.replace(/[▲▼]/g, '').trim(); });
      var amt = heads.indexOf('V_AMOUNT'), nm = heads.indexOf('V_NAME');
      var d = function (r, ci) { return dt.tBodies[0].rows[r].cells[ci]; };
      R.chk.saneDrillCols = heads[0] === '#' && amt > 0 && dt.tBodies[0].rows.length >= 3;
      R.chk.drillTabStop = dt.getAttribute('tabindex') === '0';
      await drag([d(0, amt), d(1, amt), d(2, amt)]);
      var want = num(txt(d(0, amt))) + num(txt(d(1, amt))) + num(txt(d(2, amt)));
      R.chk.drillSum = count() === 3 && Math.abs(CS().stats().raw.sum - want) < 1e-6;
      var s = seg(), sr = s && s.getBoundingClientRect();
      var hit = sr ? document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2) : null;
      R.chk.drillReadoutOnTop = !!s && s.parentNode === document.body && s.classList.contains('pnb-csel-float-top') && !!hit && s.contains(hit) &&
        (+getComputedStyle(s).zIndex) > (+getComputedStyle(ov).zIndex);
      // the '#' column stays out
      await drag([d(0, 0), d(1, amt)]);
      R.chk.drillHashOut = count() === 0;
      await drag([d(0, 1), d(1, amt)]);
      R.chk.drillNoHashInBlock = count() === 2 * amt && painted().every(function (td) { return td.cellIndex > 0; });
      // Esc clears the block and leaves the dialog open
      key('Escape');
      R.chk.escKeepsDialog = count() === 0 && document.body.contains(ov) && getComputedStyle(ov).display !== 'none';
      // the keyboard in a breakdown
      var a = d(0, amt); mouse('mousedown', a); mouse('mouseup', a); a.focus();
      key('ArrowDown');
      R.chk.drillArrow = document.activeElement === d(1, amt);
      key('Home', { ctrl: true });
      R.chk.drillCtrlHomeSkipsHash = document.activeElement === d(0, 1);
      d(1, amt).focus(); mouse('mousedown', d(1, amt)); mouse('mouseup', d(1, amt)); d(1, amt).focus();
      blurAll(); key('Tab'); dt.focus();
      R.chk.drillTabInto = document.activeElement === d(1, amt);
      R.info = { heads: heads, want: want, z: [s && getComputedStyle(s).zIndex, getComputedStyle(ov).zIndex] };
    },
    gprobe: async function () { probe('#groupedResultsContainer'); },
    gnprobe: async function () { probe('#groupedResultsContainer'); },
    pprobe: async function () { probe('#pivot-output-container'); },
    pfprobe: async function () { probe('#pivot-output-container'); },
    // The module is there, the readout is not, and the number reader / stats.
    boot: async function () {
      var cs = CS();
      R.chk.api = !!cs;
      R.chk.noReadout = !segShown();
      if (!cs) return;
      var P = cs._parse, st = cs._stats;
      function v(s) { var p = P(s); return p ? p.v : null; }
      var cases = {
        money: v('$1,234.50') === 1234.5 && P('$1,234.50').cur && P('$1,234.50').dec === 2,
        parens: v('(1,234)') === -1234,
        negDollar: v('-$5') === -5 && v('$-5') === -5,
        pct: v('12%') === 12 && P('12%').pct,
        lead0: P('00123') === null && v('0.5') === 0.5 && v('0') === 0,
        text: P('ID-1001') === null && P('1/2/2023') === null && P('1,23') === null && P('') === null && P('-') === null && P('$') === null && P('abc') === null,
        year: v('2023') === 2023,
        nbsp: v(' 1,000 ') === 1000
      };
      Object.keys(cases).forEach(function (k) { R.chk['parse_' + k] = cases[k] === true; });
      var a = st(['$1.00', '$2.50', 'x', '', '  ']);
      R.chk.statsMoney = a.count === 3 && a.numbers === 2 && a.sum === '$3.50' && a.avg === '$1.75' && a.min === '$1.00' && a.max === '$2.50';
      var b = st(['1', '2']);
      R.chk.statsAvgDec = b.sum === '3' && b.avg === '1.5' && st(['1', '2', '2']).avg === '1.67';
      var c = st(['$1.00', '2']);
      R.chk.statsMixedNoDollar = c.sum === '3.00';
      var d = st(['a', 'b']);
      R.chk.statsTextOnly = d.count === 2 && d.sum === undefined;
      var e = st(['0.1', '0.2']);
      R.chk.statsFloat = e.sum === '0.3';
      var f = st(['$-0.004', '$0.004']);
      R.chk.statsNoNegZero = f.sum === '$0.000';
      R.info = { a: a, b: b, c: c, d: d, e: e, f: f };
    },

    // A drag down one money column, then a 2 x 2 block with a text column.
    drag: async function () {
      var a = cell(0, 'V_AMOUNT'), b = cell(1, 'V_AMOUNT'), c = cell(2, 'V_AMOUNT');
      await drag([a, b, c]);
      var cents = [a, b, c].map(function (x) { return money(txt(x)); });
      var sum = cents[0] + cents[1] + cents[2];
      R.chk.count3 = count() === 3;
      R.chk.painted3 = painted().length === 3 && painted().indexOf(a) >= 0 && painted().indexOf(c) >= 0;
      R.chk.readout = segShown();
      R.chk.inBar = !!(seg() && seg().parentNode && seg().parentNode.id === 'pnbStatusBar' && seg().nextElementSibling && seg().nextElementSibling.id === 'sbUserSeg');
      R.chk.sum = val('sum') === fmtCents(sum);
      R.chk.countVal = val('count') === '3';
      R.chk.min = val('min') === fmtCents(Math.min.apply(null, cents));
      R.chk.max = val('max') === fmtCents(Math.max.apply(null, cents));
      R.chk.avg = val('avg') === fmtCents(Math.round(sum / 3));
      // the outline: top + sides on the first, sides only in the middle, bottom + sides on the last
      function edges(td) { return ['t', 'b', 'l', 'r'].filter(function (k) { return td.classList.contains('pnb-csel-' + k); }).join(''); }
      R.chk.outline = edges(a) === 'tlr' && edges(b) === 'lr' && edges(c) === 'blr';
      R.info.edges = [edges(a), edges(b), edges(c)];
      R.chk.dragClassOff = !document.body.classList.contains('pnb-csel-drag');
      R.chk.noNativeSel = window.getSelection().isCollapsed;
      R.info.first = { sum: val('sum'), want: fmtCents(sum), avg: val('avg'), cents: cents };
      // a new plain drag replaces it: V_NAME row 0 -> V_AMOUNT row 1 = 4 cells, 2 numbers
      var n0 = cell(0, 'V_NAME'), a1 = cell(1, 'V_AMOUNT');
      await drag([n0, cell(0, 'V_AMOUNT'), a1]);
      R.chk.block4 = count() === 4 && painted().length === 4;
      R.chk.textCounted = val('count') === '4' && val('sum') === fmtCents(cents[0] + cents[1]);
      R.chk.oldGone = painted().indexOf(c) < 0;
      R.info.second = { count: count(), sum: val('sum'), cnt: val('count') };
    },

    // A drag that never leaves its cell is the browser's text selection.
    inside: async function () {
      var a = cell(3, 'V_NAME');
      mouse('mousedown', a);
      var rg = document.createRange(); rg.selectNodeContents(a);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
      mouse('mousemove', a); mouse('mousemove', a);
      mouse('mouseup', a); mouse('click', a);
      await sleep(10);
      R.chk.noBlock = count() === 0 && painted().length === 0 && !segShown();
      R.chk.textSelKept = !window.getSelection().isCollapsed;
      // and the '#' column never starts one
      window.getSelection().removeAllRanges();
      await drag([hashCell(0), cell(0, 'V_ID'), cell(1, 'V_ID')]);
      R.chk.hashIgnored = count() === 0;
      // a press on a link inside a cell is the link's
      var ln = cell(0, 'V_LINK').querySelector('a');
      mouse('mousedown', ln); mouse('mousemove', cell(1, 'V_LINK')); mouse('mouseup', cell(1, 'V_LINK'));
      R.chk.linkIgnored = count() === 0;
      R.info = { count: count(), hasLink: !!ln };
    },

    // Click-to-filter keeps the plain click and loses every selection gesture.
    filter: async function () {
      document.body.classList.add('pnb-click-filter');
      await click(cell(0, 'V_STATUS'));
      R.chk.sanePlainFilters = $('#tableSearch').val() !== '';
      R.info.plain = $('#tableSearch').val();
      await clearSearch();
      // a drag that goes out and comes back to its first cell: the click lands on that cell
      var a = cell(0, 'V_STATUS'), b = cell(1, 'V_STATUS');
      mouse('mousedown', a); mouse('mousemove', b); mouse('mousemove', a); mouse('mouseup', a); mouse('click', a);
      await sleep(30);
      R.chk.dragNoFilter = $('#tableSearch').val() === '' && count() === 1;
      if ($('#tableSearch').val() !== '') await clearSearch();   // (a mutant filtered: carry on)
      // Shift+click from an anchor set with the filter off
      document.body.classList.remove('pnb-click-filter');
      await click(cell(0, 'V_NAME'));
      document.body.classList.add('pnb-click-filter');
      await click(cell(2, 'V_STATUS'), { shift: true });
      R.chk.shiftNoFilter = $('#tableSearch').val() === '';
      R.chk.shiftRect = count() === 3 * (cols().indexOf('V_STATUS') - cols().indexOf('V_NAME') + 1);
      if ($('#tableSearch').val() !== '') await clearSearch();
      // Ctrl+click one more cell
      await click(cell(5, 'V_ID'), { ctrl: true });
      R.chk.ctrlNoFilter = $('#tableSearch').val() === '';
      R.chk.ctrlAdds = count() === 3 * (cols().indexOf('V_STATUS') - cols().indexOf('V_NAME') + 1) + 1;
      if ($('#tableSearch').val() !== '') await clearSearch();
      // Ctrl on a link is the link's (open in a new tab)
      var n = count();
      mouse('mousedown', cell(6, 'V_LINK').querySelector('a'), { ctrl: true });
      R.chk.ctrlLinkIgnored = count() === n;
      // a plain click afterwards filters again (nothing left swallowing clicks)
      await sleep(20);
      await click(cell(4, 'V_STATUS'));
      R.chk.plainAfterFilters = $('#tableSearch').val() !== '';
      R.info.after = { search: $('#tableSearch').val(), count: count() };
    },

    // Shift+click and Shift+Ctrl+click
    shift: async function () {
      await click(cell(1, 'V_NAME'));
      await click(cell(3, 'V_DATE'), { shift: true });
      R.chk.rect9 = count() === 9 && painted().length === 9;
      var had9 = count();
      await click(cell(5, 'V_ID'));
      R.chk.plainClears = had9 === 9 && count() === 0;
      await click(cell(8, 'V_AMOUNT'), { shift: true });
      R.chk.fromNewAnchor = count() === 4 * 3;
      await click(cell(10, 'V_ID'), { ctrl: true });          // one more cell, and the new anchor
      R.chk.ctrlAnchors = count() === 12 + 1;
      await click(cell(11, 'V_ID'), { shift: true, ctrl: true });   // + the block 10..11 (10 already in)
      R.chk.shiftCtrlAdds = count() === 12 + 2;
      // Esc clears
      var hadEsc = count();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      R.chk.escClears = hadEsc === 14 && count() === 0 && painted().length === 0 && !segShown();
      R.info = { count: count() };
    },

    // A hidden column between two shown ones is skipped.
    hidcol: async function () {
      await drag([cell(0, 'V_NAME'), cell(1, 'V_DATE')]);
      var p = CS() && CS().payload();
      R.chk.skipHiddenCol = count() === 4 && !!p && p.cols === 2;
      R.chk.noHiddenTint = !document.querySelector('#resultsTable td.pnb-csel[style*="display: none"]');
      R.info = { count: count(), cols: p && p.cols };
    },

    // Rows a search hides are skipped; a change to the rows clears; a benign one does not.
    search: async function () {
      search('Open');
      await until(function () { return T().querySelector('tbody tr.search-hidden'); }, 15000); await sleep(300); await frames(2);
      var rows = shownRows();
      R.chk.saneSearched = rows.length > 5 && rows.length < 200;
      // the shown rows 0..4 sit among hidden ones
      var a = cell(0, 'V_AMOUNT'), e = cell(4, 'V_AMOUNT');
      var gapRows = Array.prototype.indexOf.call(T().tBodies[0].rows, e.parentNode) - Array.prototype.indexOf.call(T().tBodies[0].rows, a.parentNode) + 1;
      await drag([a, cell(2, 'V_AMOUNT'), e]);
      R.chk.skipHiddenRows = count() === 5 && painted().every(function (td) { return !td.parentNode.classList.contains('search-hidden'); });
      R.info.gapRows = gapRows;
      // a class that leaves the display alone (a journal badge) and a cell style (a format pass)
      a.parentNode.classList.add('zz-benign'); a.style.color = 'rgb(1, 2, 3)';
      await sleep(30);
      R.chk.keepOnBenign = count() === 5;
      // the search changes: cleared
      var hadS = count();
      search('Closed');
      await until(function () { return count() === 0; }, 5000);
      R.chk.clearOnSearch = hadS === 5 && count() === 0 && painted().length === 0 && !segShown();
      await clearSearch();
      // a row moved (a sort): cleared
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]);
      var had = count();
      var tb = T().tBodies[0]; tb.appendChild(tb.rows[0]);
      await sleep(30);
      R.chk.clearOnRowMove = had === 2 && count() === 0;
      // a column hidden: cleared
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]);
      had = count();
      var th = document.querySelector('#tableHeader th[data-colname="V_DATE"]'); th.style.display = 'none';
      await sleep(30);
      R.chk.clearOnColHide = had === 2 && count() === 0;
      th.style.display = '';
      R.info.had = had;
    },

    // Ctrl+C: tab-separated text + an HTML table, the formula guard, leading zeros.
    copy: async function () {
      var names = cols();
      var i0 = names.indexOf('V_NAME'), i1 = names.indexOf('V_STATUS');
      // fixture rows 1 and 2 are the first two shown rows? find them by content
      var rF = rowWith('V_STATUS', '=SUM(A1)'), rZ = rowWith('V_NAME', '00123');
      R.info.rows = [rF, rZ];
      await drag([cell(rF, 'V_NAME'), cell(rZ, 'V_STATUS')]);
      var c = copyEvent();
      var lines = c.text.split('\r\n');
      R.chk.prevented = c.prevented;
      R.chk.twoLines = lines.length === 2;
      R.chk.fiveCols = lines.every(function (l) { return l.split('\t').length === i1 - i0 + 1; });
      var first = lines[0].split('\t'), second = (lines[1] || '').split('\t');
      R.chk.formulaGuard = first[first.length - 1] === "'=SUM(A1)";
      R.chk.leadZero = second[0] === '00123';
      R.chk.amountText = first[1] === txt(cell(rF, 'V_AMOUNT'));
      R.chk.htmlTable = /^<table>/.test(c.html) && (c.html.match(/<tr>/g) || []).length === 2;
      R.chk.htmlTextFmt = (c.html.match(/mso-number-format/g) || []).length === 2;
      R.info.text = c.text.slice(0, 300); R.info.html = c.html.slice(0, 300);
      // the user's own text selection wins
      var rg = document.createRange(); rg.selectNodeContents(cell(rF, 'V_NAME'));
      window.getSelection().removeAllRanges(); window.getSelection().addRange(rg);
      R.chk.nativeWins = !copyEvent().prevented;
      window.getSelection().removeAllRanges();
      // focus in a text box: not ours
      $('#tableSearch').trigger('focus');
      R.chk.inputWins = !copyEvent().prevented;
      $('#tableSearch').trigger('blur');
      // no selection: not ours
      CS().clear();
      R.chk.noSelNoCopy = !copyEvent().prevented;
      // two blocks: their bounding box, the cells between empty
      await click(cell(0, 'V_ID'));
      await click(cell(0, 'V_ID'), { ctrl: true });
      await click(cell(2, 'V_DATE'), { ctrl: true });
      var p = CS().payload(), ls = p.text.split('\r\n');
      R.chk.bbox = p.rows === 3 && p.cols === names.indexOf('V_DATE') - names.indexOf('V_ID') + 1 && ls[1].replace(/\t/g, '') === '' && ls[0].split('\t')[0] === txt(cell(0, 'V_ID'));
      R.info.bbox = p.text;
      // a readout value copies itself, and pressing it keeps the selection
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]);
      var btn = seg().querySelector('.pnb-csel-v[data-k="sum"]');
      mouse('mousedown', btn); mouse('mouseup', btn); btn.click();
      await sleep(30);
      R.chk.readoutKeeps = count() === 2;
      R.chk.valueCopy = window.__clip[window.__clip.length - 1] === btn.textContent;
    },

    // No status bar drawn (an embedded report): a floating readout.
    float: async function () {
      document.getElementById('pnbStatusBar').style.display = 'none';
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]);
      var s = seg();
      R.chk.floats = !!(s && s.parentNode === document.body && s.classList.contains('pnb-csel-float') && segShown());
      R.chk.floatSum = !!val('sum');
    },

    // (2026-11-24, cselmenu) Median / Distinct / Numbers; Ctrl+Space and Shift+Space from the active cell; "on screen only"
    // when a column's selection leaves rows off screen; the status bar's pick of figures (Show in the status bar)
    lines: async function () {
      var S = CS();
      var st = S._stats(['1', '2', '3', '10', 'x', 'x', ''], null), st2 = S._stats(['5', '1', '3'], null);
      R.info.st = [st.median, st2.median, st.distinct];
      R.chk.statMedianEven = st.median === '2.5' && st2.median === '3';
      R.chk.statDistinct = st.distinct === 5 && st.numbers === 4 && st.count === 6;
      // Ctrl+Space: the active cell's column, its rows on screen; Shift+Space: its row
      try { localStorage.removeItem('penumbra_cellsel_stats'); } catch (e0) { }
      S.clear();
      var td = cell(2, 'V_AMOUNT');
      S.activate(td); await frames(2);
      key(' ', { ctrl: true }); await sleep(80);
      var wantCol = shownRows().filter(function (tr) { return !!tr.querySelector('td[data-column="' + colId('V_AMOUNT') + '"]'); }).length;
      R.info.col = { count: count(), want: wantCol, active: S.active() === td };
      R.chk.ctrlSpaceColumn = wantCol > 3 && count() === wantCol && S.active() === td && segShown();
      key(' ', { shift: true }); await sleep(80);
      var wantRow = Array.prototype.filter.call(td.parentNode.cells, function (c) { return c.getAttribute('data-column') !== '#' && c.style.display !== 'none' && c.getClientRects().length > 0; }).length;
      R.info.row = { count: count(), want: wantRow };
      R.chk.shiftSpaceRow = wantRow > 2 && count() === wantRow && S.active() === td;
      R.chk.noPageNoteRow = !(seg() && seg().querySelector('.pnb-csel-page'));
      S.clear();
      // rows off screen (as a page's): a column's selection says so; two cells do not
      // (the harness draws 200 of its rows: the rest are off screen already) - the count before, then 5 more hidden
      S.selectColumn(cell(0, 'V_AMOUNT')); await sleep(50);
      var off0 = S.offScreen(), n0 = off0 ? off0.n : 0;
      S.clear();
      var rs = shownRows(), hid = rs.slice(8, 13);
      hid.forEach(function (tr) { tr.style.display = 'none'; });
      await sleep(50);
      S.selectColumn(cell(0, 'V_AMOUNT')); await sleep(80);
      var pg = seg() && seg().querySelector('.pnb-csel-page');
      var want = (n0 + 5).toLocaleString('en-US');
      R.info.page = { text: pg && pg.textContent, title: pg && pg.getAttribute('title'), off: S.offScreen(), n0: n0 };
      R.chk.pageNote = !!pg && /^(on screen|this page) only$/.test(pg.textContent) && (pg.getAttribute('title') || '').indexOf(want + ' more rows are not on screen') === 0
        && !!S.offScreen() && S.offScreen().n === n0 + 5;
      S.clear();
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]); await sleep(50);
      R.chk.noPageNotePart = segShown() && !seg().querySelector('.pnb-csel-page');
      S.clear();
      hid.forEach(function (tr) { tr.style.display = ''; });
      await sleep(50);
      // the status bar's pick: Median on (an extra), then off; the last figure cannot go
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT'), cell(2, 'V_AMOUNT')]); await sleep(50);
      var before = !seg().querySelector('.pnb-csel-median');
      S.toggleStat('median'); await sleep(30);
      var md = seg().querySelector('.pnb-csel-median');
      R.chk.pickMedian = before && !!md && md.classList.contains('pnb-csel-extra') && JSON.parse(localStorage.getItem('penumbra_cellsel_stats') || '[]').indexOf('median') >= 0;
      var figs = S.figures().map(function (f) { return f.k; });
      R.info.figs = figs;
      R.chk.figuresAll = ['sum', 'avg', 'count', 'min', 'max', 'median', 'distinct', 'numbers'].every(function (k) { return figs.indexOf(k) >= 0; });
      ['sum', 'avg', 'count', 'min', 'max', 'median'].forEach(function (k) { S.toggleStat(k); });
      var left = JSON.parse(localStorage.getItem('penumbra_cellsel_stats') || '[]');
      R.info.left = left;
      R.chk.pickLastStays = left.length === 1 && left[0] === 'median' && !!seg().querySelector('.pnb-csel-median');
      try { localStorage.removeItem('penumbra_cellsel_stats'); } catch (e1) { }
      S.clear();
    },
    // (2026-11-24, cselsweep) the bug sweep's fixes: a % cell's stored value x 100, pivot labels no numbers, money
    // averages in cents, Hide Empty Columns (its stylesheet) skipped by the arrows and the copy and clearing a selection,
    // Esc in a box keeps the selection, the cell last clicked kept for Quick actions, a line selected takes the focus,
    // a drag inside one cell redoes nothing, Excel text / line breaks in the copy, Ctrl+A by its key code, the tip a
    // segment only while it shows, no divider before the profile cell with nothing between
    sweep: async function () {
      var S = CS();
      S.clear();
      function fakeTd(attrs) { var t = document.createElement('td'); for (var k in attrs) t.setAttribute(k, attrs[k]); return t; }
      var pst = S._stats(['0%', '0%'], [fakeTd({ 'data-pnb-raw': '0.004' }), fakeTd({ 'data-pnb-raw': '0.004' })]);
      R.info.pct = pst.raw;
      R.chk.pctTimes100 = !!pst.raw && Math.abs(pst.raw.sum - 0.8) < 1e-9;
      var lst = S._stats(['2024', '5'], [fakeTd({ 'data-row-field': '0' }), fakeTd({})]);
      R.info.lab = [lst.count, lst.numbers, lst.sum];
      R.chk.pivotLabelNotNumber = lst.count === 2 && lst.numbers === 1 && lst.sum === '5';
      var cst = S._stats(['$10', '$11'], null);
      R.info.cents = [cst.avg, cst.median];
      R.chk.avgCents = cst.avg === '$10.50' && cst.median === '$10.50';
      // Hide Empty Columns
      var ths = Array.prototype.filter.call(document.querySelectorAll('#tableHeader th[data-column]'), function (th) {
        return /^\d+$/.test(th.getAttribute('data-column')) && th.style.display !== 'none' && th.getClientRects().length; });
      var A = ths[0].getAttribute('data-column'), B = ths[1].getAttribute('data-column'), Cc = ths[2].getAttribute('data-column');
      function cid(r, id) { var tr = shownRows()[r]; return tr ? tr.querySelector('td[data-column="' + id + '"]') : null; }
      var st = document.createElement('style');
      st.textContent = 'table[data-pnb-na~="' + B + '"] > * > tr > [data-column="' + B + '"] { display: none !important; }';
      document.head.appendChild(st);
      await drag([cid(1, A), cid(2, Cc)]); await sleep(50);
      var before = count();
      T().setAttribute('data-pnb-na', B); await sleep(80);
      R.info.na = { cols: [A, B, Cc], before: before, after: count() };
      R.chk.naClears = before === 6 && count() === 0;
      S.activate(cid(2, A)); await frames(2);
      key('ArrowRight'); await sleep(50);
      R.info.naStep = { active: S.active() && S.active().getAttribute('data-column'), want: Cc, focus: document.activeElement === S.active() };
      R.chk.naArrowSkips = !!S.active() && S.active() === cid(2, Cc) && document.activeElement === S.active();
      S.clear();
      await drag([cid(1, A), cid(2, Cc)]); await sleep(50);
      var pl = S.payload();
      R.info.naCopy = pl && { cols: pl.cols, cells: pl.cells, count: count() };
      R.chk.naCopySkips = !!pl && pl.cols === 2 && pl.cells === 4 && count() === 4;
      S.clear();
      T().removeAttribute('data-pnb-na'); st.remove(); await sleep(50);
      // Esc typed in a box is the box's; on the page it clears
      await drag([cid(0, A), cid(1, A)]); await sleep(30);
      var inp = document.createElement('input'); document.body.appendChild(inp); inp.focus();
      key('Escape'); await sleep(30);
      R.info.esc = { inBox: count() };
      R.chk.escInputKeeps = count() === 2;
      inp.blur(); inp.remove(); blurAll();
      key('Escape'); await sleep(30);
      R.chk.escBodyClears = count() === 0;
      // a press elsewhere drops the active cell; recent() keeps it (Quick actions' rows); a line selected takes the focus
      var rc = cid(3, A);
      S.activate(rc); await frames(1);
      mouse('mousedown', document.body); mouse('mouseup', document.body);
      R.info.recent = { active: !!S.active(), recent: !!(S.recent && S.recent() === rc) };
      R.chk.recentKept = !S.active() && !!S.recent && S.recent() === rc;
      blurAll();
      var nrow = S.selectRow(S.recent ? S.recent() : null); await sleep(30);
      R.info.lineFocus = { n: nrow, focus: document.activeElement === rc };
      R.chk.lineFocuses = nrow > 2 && document.activeElement === rc;
      S.clear();
      // a drag still inside the same cell: nothing redone (no attribute writes, the readout's nodes kept)
      var a0 = cid(0, A), a1 = cid(1, A);
      mouse('mousedown', a0); mouse('mousemove', a0); mouse('mousemove', a1);
      var n1 = seg() && seg().firstChild, recs = 0, mo = new MutationObserver(function (l) { recs += l.length; });
      mo.observe(T(), { attributes: true, subtree: true });
      mouse('mousemove', a1); mouse('mousemove', a1);
      await sleep(0);
      mo.disconnect();
      var same = !!n1 && seg().firstChild === n1;
      mouse('mouseup', a1); mouse('click', common(a0, a1)); await sleep(20);
      R.info.dragSame = { recs: recs, same: same, count: count() };
      R.chk.dragSameNoRewrite = same && recs === 0 && count() === 2;
      S.clear();
      // the copy for Excel: 1E5 kept text, a line break kept in its cell
      var c0 = cid(5, A), c1 = cid(6, A), h0 = c0.innerHTML, h1 = c1.innerHTML;
      c0.textContent = '1E5'; c1.innerHTML = 'line one<br>line two';
      await drag([c0, c1]); await sleep(30);
      var ph = S.payload();
      R.info.xl = ph && ph.html.slice(0, 400);
      R.chk.copySciText = !!ph && ph.html.indexOf("mso-number-format:'\\@'\">1E5<") >= 0;
      R.chk.copyBrSameCell = !!ph && ph.html.indexOf('line one<br style="mso-data-placement:same-cell">line two') >= 0;
      S.clear(); c0.innerHTML = h0; c1.innerHTML = h1; await sleep(30);
      // Ctrl+A by its key code (another keyboard layout's letter)
      S.activate(cid(0, A)); await frames(1);
      var ev = new KeyboardEvent('keydown', { key: '\u0444', code: 'KeyA', ctrlKey: true, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(ev); await sleep(30);
      R.info.ctrlA = { count: count(), prevented: ev.defaultPrevented };
      R.chk.ctrlAByCode = count() > 10 && ev.defaultPrevented;
      S.clear();
      // the tip: a segment (a divider) only while it shows; nothing shown between the spring and the profile cell: no divider
      var H = S._hint; H.reset(); await sleep(350); await frames(3);
      var he = H.el();
      var shownSeg = !!he && !he.hidden && he.classList.contains('sb-seg');
      await drag([cid(0, A), cid(1, A)]); await sleep(350);
      var hidNoSeg = !!he && he.hidden && !he.classList.contains('sb-seg');
      R.info.hintSeg = { shownSeg: shownSeg, hidNoSeg: hidNoSeg };
      R.chk.hintSegOnlyShown = shownSeg && hidNoSeg;
      S.clear(); await sleep(350); await frames(2);
      if (he) { he.hidden = true; he.classList.remove('sb-seg'); }
      var spr = document.createElement('div'); spr.className = 'sb-spring'; var cs0 = document.getElementById('sbColsSeg');
      if (cs0) { cs0.parentNode.insertBefore(spr, cs0.nextSibling); }   // the app's bar has one (the harness's does not)
      // both orders the two can take: the readout alone between the spring and the profile cell (the tip taken out),
      // then the tip (hidden, no sb-seg) before the readout
      var u = document.getElementById('sbUserSeg'), ro = seg();
      function noDiv() { var d = getComputedStyle(u, '::before'); return d.display === 'none' || d.content === 'none' || d.content === 'normal'; }
      var hp = he && he.parentNode, hn = he && he.nextSibling;
      if (he && hp) { hp.removeChild(he); }
      if (ro) { u.parentNode.insertBefore(ro, u); }
      var d1 = noDiv();
      if (he && ro) { ro.parentNode.insertBefore(he, ro); }
      var d2 = noDiv();
      if (he && hp) { hp.insertBefore(he, hn && hn.parentNode === hp ? hn : u); }
      R.info.divider = { readoutAlone: d1, tipThenReadout: d2, ro: !!ro, he: !!he };
      R.chk.noIdleDivider = !!u && !!ro && d1 && d2;
      spr.remove();
      H.reset();
    },
    // (2026-11-24, cselhint) the idle hint where the readout will show ("Drag across cells for Sum, Average, Count"):
    // shown with no readout, hidden while it shows, back when it clears, counted once per selection, retired after
    // three, the x hides it for good, none without the bar or without a number on screen, fewer words when short
    hint: async function () {
      var H = CS()._hint, sb = document.getElementById('pnbStatusBar');
      function el() { return document.getElementById('pnbCellSelHint'); }
      function hShown() { var h = el(); return !!(h && !h.hidden && h.getClientRects().length && !h.classList.contains('pnb-csel-hint-clip')); }
      async function settle() { await sleep(350); await frames(3); }
      CS().clear(); H.reset(); await settle();
      var h0 = el();
      R.info.start = { has: !!h0, cls: h0 && h0.className, text: h0 && h0.textContent, next: h0 && h0.nextElementSibling && h0.nextElementSibling.id };
      R.chk.hintShown = hShown() && /Drag across cells for Sum, Average, Count/.test(h0.textContent) && h0.parentNode === sb &&
        !!h0.nextElementSibling && h0.nextElementSibling.id === 'sbUserSeg';
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT')]); await settle();
      R.chk.hintHidesOnReadout = segShown() && !hShown();
      R.chk.hintCounts = H.state().n === 1;
      var c3 = cell(3, 'V_AMOUNT');
      mouse('mousedown', c3, { ctrl: true }); mouse('mouseup', c3, { ctrl: true }); mouse('click', c3, { ctrl: true }); await settle();
      R.info.afterCtrl = { count: count(), state: H.state() };
      R.chk.hintOnce = count() === 3 && H.state().n === 1;
      CS().clear(); await settle();
      R.chk.hintBack = hShown() && !segShown();
      await drag([cell(0, 'V_AMOUNT'), cell(2, 'V_AMOUNT')]); await settle();
      CS().clear(); await settle();
      var twice = hShown() && H.state().n === 2;
      await drag([cell(1, 'V_AMOUNT'), cell(2, 'V_AMOUNT')]); await settle();
      CS().clear(); await settle();
      R.info.retire = { twice: twice, state: H.state(), el: !!el() };
      R.chk.hintRetires = twice && H.state().n === 3 && !el();
      // the x: gone for good
      H.reset(); await settle();
      var shownAgain = hShown();
      el().querySelector('.pnb-csel-hint-x').click(); await settle();
      R.chk.hintXOff = shownAgain && H.state().off === 1 && !el();
      // no bar drawn (an embedded report): none
      H.reset(); await settle();
      sb.style.display = 'none'; H.sync(); await settle();
      var noBar = !!el() && el().hidden;   // the module hid it (inside a hidden bar it would not show anyway)
      sb.style.display = ''; H.sync(); await settle();
      R.chk.hintNoBar = noBar && hShown();
      // short of room: fewer words, then the sign, then invisible - never wider than the room
      var rightWas = sb.style.right, seq = [], okRoom = true;
      for (var w = 2400; w >= 200; w -= 20) {
        sb.style.right = (window.innerWidth - w) + 'px';
        await frames(2); await sleep(20);
        var h = el(), t = h.querySelector('.pnb-csel-hint-t');
        var k = h.classList.contains('pnb-csel-hint-clip') ? 4 : h.classList.contains('pnb-csel-hint-sig-only') ? 3 :
          (t.textContent === 'Drag across cells for Sum, Average, Count' ? 0 : t.textContent === 'Drag cells to sum' ? 1 : t.textContent === 'Drag to sum' ? 2 : -1);
        if (k !== 4 && h.scrollWidth - h.clientWidth > 1) okRoom = false;
        if (!seq.length || seq[seq.length - 1][1] !== k) seq.push([w, k]);
      }
      sb.style.right = rightWas; await settle();
      R.info.fitSeq = seq;
      var ks = seq.map(function (x) { return x[1]; });
      R.chk.hintFitSteps = ks[0] === 0 && ks.indexOf(-1) < 0 && ks.every(function (k, i) { return !i || k > ks[i - 1]; }) && ks.length >= 3 && okRoom;
      R.chk.hintFitBack = hShown() && /Drag across cells for Sum, Average, Count/.test(el().textContent);
      // a table of text alone: no hint (nothing to sum)
      shownRows().slice(0, 10).forEach(function (tr) { Array.prototype.forEach.call(tr.cells, function (td) { if (td.getAttribute('data-column') !== '#') td.textContent = 'abc'; }); });
      H.sync(); await settle();
      R.chk.hintTextOnly = !hShown();
    },

    // 2026-10-12 csfit: a crowded bar gives way to the readout, one step at a
    // time (the muted "no nesting" chip - csfit2; Data, Load to icons; the profile
    // cell; Min + Max; Average). The
    // harness bar gets the real segments' shape, then is narrowed 10 px at a
    // time (a window resize does not move innerWidth here: the bar's own width, wider than the window at first: the harness readout + profile cell alone take 900 px).
    crowd: async function () {
      var FIT = ['pnb-csel-fit-nest', 'pnb-csel-fit-data', 'pnb-csel-fit-load', 'pnb-csel-fit-user', 'pnb-csel-fit-minmax', 'pnb-csel-fit-avg'];
      var sb = document.getElementById('pnbStatusBar'), user = document.getElementById('sbUserSeg');
      function segHtml(id, lab, v) {
        return '<div class="sb-seg sb-click" id="' + id + '"><svg class="sb-ico" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6"/></svg>' +
          '<span class="sb-lab">' + lab + '</span><span class="sb-val">' + v + '</span><span class="sb-chip">+4 sources</span><span class="sb-caret">^</span></div>';
      }
      sb.insertAdjacentHTML('afterbegin', '<div class="sb-seg sb-lead"><span id="sbRows">1,234 rows (5,678 source transactions)</span></div>' +
        segHtml('sbDataSeg', 'Data', '2026-10-12 09:15 (imported 3 hours ago)') + segHtml('sbLoadSeg', 'Queried in', '1.24 s + 0.31 s render'));
      sb.insertBefore(Object.assign(document.createElement('div'), { className: 'sb-spring' }), user);
      user.innerHTML = '<span class="sb-ava">AB</span><span class="sb-uname">A Rather Long Display Name</span>';
      document.getElementById('sbColsSeg').insertAdjacentHTML('beforeend', '<span class="sb-chip sb-off" id="sbNested">no nesting</span>');
      var nested = document.getElementById('sbNested'), dataLab = document.querySelector('#sbDataSeg .sb-lab'), nestFirst = null;
      function setW(w) { sb.style.right = (window.innerWidth - w) + "px"; }
      // main.js collapses Data / Load itself on a bar resize (sb-collapse-*, off the
      // profile cell) - csfit2: while the readout shows the module lifts those, so
      // the "no nesting" chip really goes first; they come back when it clears
      var MAIN = ['sb-collapse-data', 'sb-collapse-load'], okMainLifted = true;
      function mainOn() { return MAIN.some(function (c) { return sb.classList.contains(c); }); }
      function on(i) { return sb.classList.contains(FIT[i]); }
      function n() { var k = 0; while (k < FIT.length && on(k)) k++; return k; }
      function prefix() { var k = n(); for (var i = k; i < FIT.length; i++) if (on(i)) return false; return true; }
      function shown(el) { return !!(el && el.getClientRects().length); }
      function item(k) { return seg() && seg().querySelector('.pnb-csel-' + k); }
      function short() {
        var right = sb.getBoundingClientRect().right;
        return Array.prototype.some.call(sb.children, function (c) { return c.getClientRects().length && c.getBoundingClientRect().right - right > 1; });
      }
      setW(2200);
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT'), cell(2, 'V_AMOUNT')]);
      await frames(3);
      R.info.kids = Array.prototype.map.call(sb.children, function (c) { var b = c.getBoundingClientRect(); return (c.id || c.className) + ':' + Math.round(b.left) + '-' + Math.round(b.right); }).concat(['bar:' + Math.round(sb.getBoundingClientRect().right), 'iw:' + window.innerWidth, 'cls:' + sb.className]);
      R.chk.inBar = !!(seg() && seg().parentNode === sb && segShown());
      R.chk.wideNone = n() === 0 && prefix() && shown(user) && ['sum', 'avg', 'count', 'min', 'max'].every(function (k) { return shown(item(k)); });
      var rec = [], okPrefix = true, okMono = true, okRoom = true, okMin = true, okKeep = true, okUser = true, last = 0, lastFree = 0;
      for (var w = 2200; w >= 200; w -= 10) {
        setW(w);
        await frames(3);
        var k = n();
        if (!prefix()) okPrefix = false;
        if (mainOn()) okMainLifted = false;
        if (k < last) okMono = false;
        last = k;
        if (k < FIT.length && short()) okRoom = false;
        // minimal: one step fewer would not fit
        if (k > 0) {
          sb.classList.remove(FIT[k - 1]);
          if (!short()) okMin = false;
          sb.classList.add(FIT[k - 1]);
        }
        if (!shown(item('sum')) || !shown(item('count'))) okKeep = false;
        if (shown(user) !== (k < 4)) okUser = false;
        // the first step taken is the "no nesting" chip, Data still whole
        if (k >= 1 && nestFirst === null) nestFirst = !shown(nested) && shown(dataLab);
        if (k === 0) lastFree = w;
        if (!rec.length || rec[rec.length - 1].k !== k) rec.push({ w: w, k: k, cls: sb.className });
      }
      R.info.steps = rec;
      R.chk.prefixOrder = okPrefix;
      R.chk.monotonic = okMono;
      R.chk.allSteps = last === FIT.length && rec.length === FIT.length + 1;
      R.chk.noOverflowWithRoom = okRoom;
      R.chk.minimal = okMin;
      R.chk.sumCountStay = okKeep;
      R.chk.userAtStep4 = okUser;
      R.chk.nestFirst = nestFirst === true;
      R.chk.mainLifted = okMainLifted;
      R.chk.narrowSumCount = !shown(item('avg')) && !shown(item('min')) && !shown(item('max'));
      setW(2200);
      await frames(3);
      R.chk.growRestores = n() === 0 && shown(user) && shown(item('min')) && shown(item('avg'));
      // a segment growing (its text changed) re-fits; shrinking back un-fits
      setW(lastFree);
      await frames(3);
      var v = document.querySelector('#sbDataSeg .sb-val'), was = v.textContent, n0 = n();
      v.textContent = was + ' - and a much longer freshness note than before';
      await frames(4);
      var grown = n();
      v.textContent = was;
      await frames(4);
      R.info.content = { w: lastFree, n0: n0, grown: grown, back: n() };
      R.chk.refitOnContent = n0 === 0 && grown >= 1;
      R.chk.refitBack = n() === 0;
      // clearing the selection puts every step back
      setW(400);
      await frames(3);
      var before = n();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      R.chk.clearRestores = before >= 4 && count() === 0 && n() === 0 && FIT.every(function (c) { return !sb.classList.contains(c); }) && shown(user);
      // ... and hands back main.js's own Data / Load state: at 400 px the profile
      // cell overflows without them (with them too, here), so both are on again (no resize needed)
      R.info.handBack = sb.className;
      R.chk.handBack = MAIN.every(function (c) { return sb.classList.contains(c); });
      // and stays put once cleared: a resize with no readout adds nothing
      setW(300);
      await frames(3);
      R.chk.idleNoFit = FIT.every(function (c) { return !sb.classList.contains(c); }) && shown(user);
      // a real count ("3 nested") is never the step: it stays on a crowded bar
      nested.classList.remove('sb-off'); nested.textContent = '3 nested';
      await drag([cell(0, 'V_AMOUNT'), cell(1, 'V_AMOUNT'), cell(2, 'V_AMOUNT')]);
      await frames(3);
      R.info.nestCount = { cls: sb.className, shown: shown(nested) };
      R.chk.nestCountStays = segShown() && sb.classList.contains(FIT[0]) && shown(nested);
    },

    // &cellsel=off: the module stands down for the page.
    off: async function () {
      R.chk.saneOffNoApi = !CS();
    },

    // Every row on one page: a 300 x 6 drag stays quick.
    big: async function () {
      var rows = shownRows();
      R.chk.saneAll = rows.length === 300;
      var t0 = performance.now();
      await drag([cell(0, 'V_ID'), cell(150, 'V_AMOUNT'), cell(299, 'V_STATUS')]);
      var ms = performance.now() - t0;
      R.chk.bigCount = count() === 300 * 6;
      R.chk.bigFast = ms < 1500;
      var t1 = performance.now(); var p = CS().payload(); var ms2 = performance.now() - t1;
      R.chk.bigCopy = p.rows === 300 && p.cols === 6 && ms2 < 1500;
      R.info = { dragMs: Math.round(ms), copyMs: Math.round(ms2) };
    }
  };
  function blurAll() { var a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }
  // round 3: a key on whatever has the focus (as the browser sends it)
  function key(k, o) {
    o = o || {};
    var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, metaKey: !!o.meta });
    (document.activeElement || document.body).dispatchEvent(ev);
    return ev;
  }
  // round 2 helpers: the grouped view's tables, the pivot's rows and cells
  function gtabs() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer .group-content > table')); }
  function gcell(t, r, name) {
    var rows = Array.prototype.filter.call(t.tBodies[0].rows, function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none'; });
    return rows[r] ? rows[r].querySelector('td[data-column="' + colId(name) + '"]') : null;
  }
  function pT() { return document.getElementById('pivotResultTable'); }
  function prows() { return Array.prototype.filter.call(pT().tBodies[0].rows, function (tr) { return tr.style.display !== 'none' && tr.getClientRects().length; }); }
  function prow(r) { return prows()[r]; }
  function pcell(r, k) { return prow(r).querySelector('td[data-col-key="' + k + '"]'); }
  function plabel(r, lvl) { return prow(r).querySelector('td[data-row-field="' + lvl + '"]'); }
  function pkeys() { var s = []; prow(0).querySelectorAll('td[data-col-key]').forEach(function (td) { s.push(td.getAttribute('data-col-key')); }); return s; }
  function num(t) { return parseFloat(String(t).replace(/[$,]/g, '')); }
  function probe(sel) {
    var box = document.querySelector(sel), tabs = box.querySelectorAll("table");
    R.info.tables = tabs.length;
    R.info.ids = Array.prototype.map.call(tabs, function (t) { return (t.id || "") + "." + t.className + " parent=" + t.parentNode.className; }).slice(0, 6);
    var t = tabs[0];
    R.info.head = t.tHead ? t.tHead.outerHTML.slice(0, 2500) : null;
    R.info.body = Array.prototype.slice.call(t.tBodies[0].rows, 0, 6).map(function (r) { return r.outerHTML.slice(0, 1400); });
    R.info.foot = t.tFoot ? t.tFoot.outerHTML.slice(0, 1500) : null;
    R.info.nbody = t.tBodies[0].rows.length;
    R.info.wrapper = box.innerHTML.slice(0, 1500);
  }
  function cols() { return Array.prototype.filter.call(document.querySelectorAll('#tableHeader th'), function (th) { return th.style.display !== 'none' && th.getAttribute('data-column') !== '#'; }).map(function (th) { return th.getAttribute('data-colname'); }); }
  function rowWith(name, text) { var rs = shownRows(); for (var i = 0; i < rs.length; i++) { var td = rs[i].querySelector('td[data-column="' + colId(name) + '"]'); if (td && txt(td) === text) return i; } return -1; }

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
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
