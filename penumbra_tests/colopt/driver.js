// colopt suite - page half (2026-10-12). The REAL main.js + js/penumbra_colfmt.js +
// js/penumbra_calc.js on the saveconf fixture (300 rows; shown: V_ID V_NAME V_AMOUNT
// V_DATE V_LINK V_STATUS; hidden: H_*). window.__HC = run.py's hook (closure functions).
//   fbuild   options SAVED before the report opens: formats at build (shown + a lazy
//            hidden column), the value kept as data-pnb-raw, filter links, footer
//   fsort    a date column shown as "Mon, Oct 5, 2026" sorts as DATES
//   fpanel   the Settings panel: a cog in every row's summary lane and the badges at its
//            end (colopt b), the popover, a date pick, a custom pattern (good and bad),
//            Reset, Escape, the default VC / NO VC badges
//   fsum     (colopt b) the summary in the popover: at once, stored as Save Column Layout
//            stored it, badges + the cog's accent, Custom Formula, Reset, a footer look
//            dropped, Save Column Layout keeps it, the lane's sort, a summary-only column
//   ffilter  click a table cell to filter by that value (and Enter), a nested column's sub-cells
//   fdeep    deep link vendor codes per column, nested sub-cells included
//   fcalc    a calculated column's date format (&calc=), its dialog
//   fxss     formula text is escaped (a link's &calc= cannot write HTML)
//   fsave    Save Column Layout keeps the shading and the column options
//   fclear   Clear All lists and takes them
//   gfmt     the grouped view: formatted clones, footers, a change in place
//   fheat    data bars from the VALUES under a format
//   pvfmt    pvfmt2  a pivot's settings.aggFormat (cells -> run.py -> PHP parity)
//   pvcog    the pivot builder's cog: the same popover, Format + Shading
//   fnomod   &nomod=1 - no module: the old Shading chip, nothing formatted
//   fparity  the engine: unit cases, and its date answers for the PHP twin
//   (2026-10-20, hl) Highlight rules:
//   fhlunit  the module's rule text: Basic's forms both ways, the CSS gate, the words
//   fhl      authored through the popover: a rule's view, Basic, Advanced, the list,
//            the badge, the top rule wins, delete, Escape, Reset; text and date columns
//   fhlseed  rules saved before the report opens (+ shading): drawn at once, over the
//            heat, row and other-column rules, kept by a sort and a search, the dark
//            tints, a value that stops matching
//   ghl      the grouped view: drawn there, and a change drawn again in both tables
//   (2026-10-20 b) formats and rules SAVED WITH THE REPORT (mk_harness: hr* reports):
//   hrep     drawn at once and outlined, Off for me, Automatic over the report's format and
//            Reset, a report rule changed into the viewer's copy and back, a view link, a save
//            without the dialog's list; the email's fixtures (test_colopt.php hl)
//   hrview   a viewer: no changing the report's rules, Off for me, their own on top
//   hrsave   the Save dialog's Last Stop Changes list, the save, the report after it
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (/^pv/.test(SCN) && !(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td').length > 0; }, 20000))) throw new Error('no pivot');
    await sleep(600);
  }
  function hdrIndex(name, tableSel) {
    var ths = Array.prototype.slice.call(document.querySelectorAll((tableSel || '#resultsTable') + ' thead th'));
    return ths.findIndex(function (t) { return t.dataset.colname === name; });
  }
  function colCells(name, all) {
    var i = hdrIndex(name);
    if (i < 0) return [];
    return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr')).filter(function (tr) { return all || tr.style.display !== 'none'; })
      .map(function (tr) { return tr.children[i]; }).filter(Boolean);
  }
  function rowOf(td) { var n = parseInt(td.parentNode.cells[0].textContent, 10); return window.__rowsFixture[n - 1]; }
  function prefs() { try { var p = JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); return p.lrfix || null; } catch (e) { return 'ERR'; } }
  function colopt() { var p = prefs(); return p && p.colopt ? p.colopt : null; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function mdy(s) { var m = /^(\d+)\/(\d+)\/(\d+)$/.exec(s); return m ? { y: +m[3], m: +m[1], d: +m[2] } : null; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function wday(o) { return DAYS[new Date(Date.UTC(o.y, o.m - 1, o.d)).getUTCDay()]; }
  function cents(s) { var t = String(s).replace(/[$,]/g, ''); var neg = t.charAt(0) === '-'; if (neg) t = t.slice(1); var p = t.split('.'); var c = parseInt(p[0], 10) * 100 + (p[1] ? parseInt((p[1] + '00').slice(0, 2), 10) : 0); return neg ? -c : c; }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function dollars0(c) { return '$' + group(Math.round(c / 100)); }   // fixture amounts are positive
  function popover() { return document.querySelector('.sp-sumtype-menu.pnb-colopt'); }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function openPanel() { document.getElementById('settingsPanel').classList.add('is-open'); window.Penumbra.refreshSettingsColumns(); }
  function item(n) { return Array.prototype.slice.call(document.querySelectorAll('#spColumnList .sp-col-item')).filter(function (el) { return el.getAttribute('data-colname') === n; })[0]; }
  // the cog in the lane (colopt b); before it (the control: live), the chip at the row's end
  function cogOf(n) { var it = item(n); return it ? (it.querySelector('.sp-col-cog') || it.querySelector('.sp-col-opts')) : null; }
  var chipOf = cogOf;
  function badgesOf(n) {
    var it = item(n);
    return it ? Array.prototype.map.call(it.querySelectorAll('.sp-col-badges .sp-col-badge'), function (b) { return { t: b.textContent, own: b.classList.contains('is-own') }; }) : [];
  }
  // the flat footer's cell of a column (null: not summarized)
  function footCell(n) {
    return Array.prototype.slice.call(document.querySelectorAll('#resultsTable tfoot tr.total-row-data td[data-sum-col]')).filter(function (td) { return td.getAttribute('data-sum-col') === n; })[0] || null;
  }
  function searchVal() { return document.getElementById('tableSearch').value; }
  // ---- (2026-10-20, hl) Highlight rules
  function hlEd() { var p = popover(); return p ? p.querySelector('.pnb-hl-ed') : null; }
  function hlQ(sel) { var e = hlEd(); return e ? e.querySelector(sel) : null; }
  function setInput(el, v) { el.value = v; fire(el, 'input'); }
  function setSel(el, v) { el.value = v; fire(el, 'change'); }
  function hlRules(col) { var c = colopt(); return (c && c[col] && c[col].hl) ? c[col].hl : null; }
  function isShown(el) { return !!el && el.offsetParent !== null; }
  // what a CSS text computes to here (the theme's variables live on <body>)
  function probe(css, prop) {
    var d = document.createElement('span');
    d.style.cssText = css;
    document.body.appendChild(d);
    var v = getComputedStyle(d)[prop];
    d.parentNode.removeChild(d);
    return v;
  }
  function amtOf(r) { return cents(r.V_AMOUNT) / 100; }
  function ymd(r) { var o = mdy(r.V_DATE); return o.y * 10000 + o.m * 100 + o.d; }
  function closeAll() { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
  // ---- (2026-10-20 c) the pivot's cells of one value: body (a row of data), group summary rows,
  // Grand Totals; the same cell's other value; "painted exactly where the test holds"; Generate
  function pvKit() {
    var K = {};
    function q(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    // a body or summary cell has its column's key; a row's Grand Total column has none, the
    // Grand Total row is data-grand-total
    K.body = function (idx) { return q('#pivotResultTable tbody tr[data-pivot-row] > td[data-agg-idx="' + idx + '"][data-col-key]').filter(function (td) { return !td.hasAttribute('data-grand-total'); }); };
    K.sum = function (idx) { return q('#pivotResultTable tbody tr.pivot-group-summary-row > td[data-agg-idx="' + idx + '"][data-col-key]').filter(function (td) { return !td.hasAttribute('data-grand-total'); }); };
    K.grand = function (idx) {
      return q('#pivotResultTable td[data-agg-idx="' + idx + '"]').filter(function (td) { return td.hasAttribute('data-grand-total') || !td.hasAttribute('data-col-key'); });
    };
    K.num = function (td) { var t = td.textContent.replace(/[$,%\s]/g, ''); return (t === '' || t === '-') ? NaN : parseFloat(t); };
    K.sib = function (td, idx) {
      var ck = td.getAttribute('data-col-key');
      return Array.prototype.filter.call(td.parentNode.children, function (c) {
        return c.getAttribute('data-agg-idx') === String(idx) && c.getAttribute('data-col-key') === ck && !c.hasAttribute('data-grand-total');
      })[0] || null;
    };
    K.iff = function (cells, test, painted) {
      var on = 0, off = 0, bad = [];
      cells.forEach(function (td) {
        var t = !!test(td), pt = !!painted(td);
        if (t) on++; else off++;
        if (t !== pt) bad.push(td.textContent.trim() + ' [' + td.getAttribute('data-col-key') + '|' + (td.parentNode.getAttribute('data-pivot-row') || td.parentNode.className) + '] ' + (td.getAttribute('style') || '').slice(0, 140));
      });
      return { ok: cells.length > 0 && bad.length === 0, on: on, off: off, bad: bad.slice(0, 5), n: cells.length };
    };
    K.generate = async function () {
      var old = document.getElementById('pivotResultTable');
      document.getElementById('generatePivotBtn').click();
      await until(function () { var t = document.getElementById('pivotResultTable'); return !!t && t !== old && !!t.querySelector('tbody td'); }, 15000);
      await sleep(400);
    };
    return K;
  }
  // ---- (2026-10-20 b) the REPORT's formats and rules (hr*): what the table shows, cell by cell
  function hrKit() {
    var K = {
      amber: probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor'),
      green: probe('background-color: var(--pnb-hl-green, #d3eedb)', 'backgroundColor'),
      blue: probe('background-color: var(--pnb-hl-blue, #d6e5fa)', 'backgroundColor'),
      red: probe('color: var(--accent-danger, #c62828)', 'color')
    };
    K.amt = function (td) { return amtOf(rowOf(td)); };
    // V_AMOUNT over 50,000 in that fill, and no other cell
    K.painted = function (fill) {
      var c = colCells('V_AMOUNT', true);
      return c.length === 300 && c.every(function (td) { return (K.amt(td) > 50000) === (getComputedStyle(td).backgroundColor === fill); });
    };
    K.none = function (fill) { var c = colCells('V_AMOUNT', true); return c.length === 300 && c.every(function (td) { return getComputedStyle(td).backgroundColor !== fill; }); };
    // the Closed rows struck (on), or none (off)
    K.strikes = function (on) {
      var c = colCells('V_STATUS', true);
      return c.length === 300 && c.every(function (td) { return (on && rowOf(td).V_STATUS === 'Closed') === /line-through/.test(td.parentNode.style.textDecoration || ''); });
    };
    K.bold = function (over) { var c = colCells('V_AMOUNT', true); return c.length === 300 && c.every(function (td) { return (K.amt(td) > over) === (getComputedStyle(td).fontWeight === '700'); }); };
    // r3 (V_NAME = /Alpha/) italic; with o1, the Pending rows' too
    K.italicNames = function (pending) {
      var c = colCells('V_NAME', true);
      return c.length === 300 && c.every(function (td) { var r = rowOf(td); return (/Alpha/.test(r.V_NAME) || (pending && r.V_STATUS === 'Pending')) === (getComputedStyle(td).fontStyle === 'italic'); });
    };
    K.amtText = function (how) {
      var c = colCells('V_AMOUNT', true);
      return c.length === 300 && c.every(function (td) {
        var r = rowOf(td), ct = cents(r.V_AMOUNT), t = td.textContent.trim();
        return how === 'cur0' ? t === dollars0(ct) : how === 'num2' ? t === group(Math.floor(ct / 100)) + '.' + pad2(ct % 100) : t === r.V_AMOUNT;
      });
    };
    K.dateIso = function () {
      window.__HC.fillByName(['V_DATE']);   // no rule reads it: past the first page its cells are still lazy
      var c = colCells('V_DATE', true);
      return c.length === 300 && c.every(function (td) { var o = mdy(rowOf(td).V_DATE); return td.textContent.trim() === o.y + '-' + pad2(o.m) + '-' + pad2(o.d); });
    };
    K.foot = function () { var f = footCell('V_AMOUNT'), s = f && (f.querySelector('strong') || f); return s ? s.textContent.trim() : null; };
    // test_colopt.php hl: the email of these rows (the report's state) must draw what the page drew
    K.emailFix = function () {
      var cols = ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_STATUS'], rows = [], page = [];
      colCells('V_AMOUNT', true).forEach(function (td) {
        var r = rowOf(td), tr = td.parentNode, o = {};
        cols.forEach(function (c) { o[c] = r[c]; });
        rows.push(o);
        page.push({ id: r.V_ID, amt: td.textContent.trim(), fill: getComputedStyle(td).backgroundColor === K.amber,
          strike: /line-through/.test(tr.style.textDecoration || ''), italic: getComputedStyle(tr.children[hdrIndex('V_NAME')]).fontStyle === 'italic' });
      });
      var st = window.__STORED;
      return { rows: rows, state: { columnFormats: st.columnFormats, columnHighlights: st.columnHighlights }, page: page, foot: K.foot() };
    };
    // ...and the engine itself: Basic's forms (and a few typed ones), the rows each matches here
    // (the paint pass's own reading: the cells' values, a hidden column filled first)
    K.whenFix = function () {
      var F = window.PenumbraColFmt, HC = window.__HC, r0 = window.__rowsFixture[0], o0 = mdy(r0.V_DATE);
      var picks = [['V_AMOUNT', 'gt', '50000'], ['V_AMOUNT', 'gte', '45,000'], ['V_AMOUNT', 'lt', '1000'], ['V_AMOUNT', 'lte', '20000.5'],
        ['V_AMOUNT', 'eq', r0.V_AMOUNT], ['V_AMOUNT', 'ne', r0.V_AMOUNT], ['V_AMOUNT', 'between', '20000', '40000'], ['V_AMOUNT', 'empty'], ['V_AMOUNT', 'notempty'],
        ['V_DATE', 'before', '2023-01-01'], ['V_DATE', 'after', '6/30/2024'], ['V_DATE', 'onbefore', '2022-03-15'], ['V_DATE', 'onafter', '2024-12-31'],
        ['V_DATE', 'on', o0.y + '-' + pad2(o0.m) + '-' + pad2(o0.d)], ['V_DATE', 'between', '2022-01-01', '2022-12-31'], ['V_DATE', 'last', '30'], ['V_DATE', 'next', '30'],
        ['V_STATUS', 'is', 'Closed'], ['V_STATUS', 'is', 'closed'], ['V_STATUS', 'isnot', 'Closed'], ['V_STATUS', 'contains', 'en'], ['V_STATUS', 'notcontains', 'os'],
        ['V_STATUS', 'starts', 'Pe'], ['V_NAME', 'contains', 'Alpha'], ['V_NAME', 'contains', 'a B'], ['V_NAME', 'is', 'Alpha Bravo'], ['V_NAME', 'starts', 'Echo'],
        ['V_NAME', 'contains', 'ha.B'], ['H_NULL', 'empty'], ['H_NULL', 'notempty'], ['H_FLAG', 'is', 'Y'], ['H_NUM', 'gt', '500'], ['H_CODE', 'contains', 'AB-1'],
        ['H_GROUP', 'isnot', 'North'], ['H_ENT', 'contains', 'Brien'], ['V_AMOUNT', 'always']];
      var kind = function (c) { return /^(V_AMOUNT|H_NUM)$/.test(c) ? 'num' : c === 'V_DATE' ? 'date' : 'text'; };
      var ws = picks.map(function (p) { return F.hlWhen({ col: p[0], op: p[1], v: p[2], v2: p[3], kind: kind(p[0]) }); });
      ws = ws.concat(['V_AMOUNT > 50000 and V_STATUS = //Open//', 'V_STATUS = //Open// or V_STATUS = //Pending//', 'V_NAME = /Alpha/', 'Alpha']);
      var ths = Array.prototype.slice.call(document.querySelectorAll('#resultsTable thead th'));
      var names = ths.map(function (t) { return t.getAttribute('data-colname'); });
      var vis = ths.filter(function (t) { return t.style.display !== 'none' && t.getAttribute('data-colname'); }).map(function (t) { return t.getAttribute('data-colname'); });
      // every column (a page's rows past the first keep a column no rule reads lazy - empty - until shown)
      HC.fillByName(names.filter(Boolean));
      var trs = Array.prototype.slice.call(document.querySelectorAll('#resultsTable tbody tr'));
      var maps = trs.map(function (tr) {
        var m = new Map();
        names.forEach(function (n, i) { if (n) m.set(n, HC.cmpText(tr.cells[i])); });
        return { id: rowOf(tr.cells[0]).V_ID, m: m };
      });
      var cols = names.filter(Boolean);
      return ws.map(function (w) {
        if (w === null) return [null, null];
        var p = w ? HC.paq(w, cols) : null;
        return [w, maps.filter(function (x) { return !w || HC.epq(x.m, p, vis); }).map(function (x) { return x.id; })];
      });
    };
    // the format engine and its PHP twin (_pnb_colfmt_value), value for value; a footer's number
    // as the page hands it over (_pnbNumText); the CSS gate and penumbra_hl_clean_css
    K.unitFix = function () {
      var F = window.PenumbraColFmt, HC = window.__HC, fmt = [], num = [], css = [];
      var vals = ['$45,123.45', '45123.45', '-1234.5', '(1,234.50)', '0', '0.005', '1.005', '2.675', '1e3', '12%', 'abc', '', ' 42 ', '1,234,567.891', '-0.004',
        '999.995', '100', '$0.50', '-$12.00', '12.5%', '1/2/2026', '2026-10-05', '2026-10-05 14:30', 'Oct 5, 2026', '10/5/26', '0.125', '-0.5',
        '1234567890123.456', '.5', '5.', '+7', '1,23', '12,345,678.9', '-0', '0.0005', '99.5', '-99.5'];
      var specs = ['number', 'number:0', 'number:2', 'number:4', 'currency', 'currency:0', 'currency:2', 'percent', 'percent:0', 'percent:1',
        'date:YYYY-MM-DD', 'date:MMM D, YYYY', 'date:ddd, MMM D, YYYY', 'date:MM/DD/YYYY h:mm A'];
      vals.forEach(function (v) { specs.forEach(function (s) { fmt.push([v, s, F.formatValue(v, s)]); }); });
      window.__rowsFixture.forEach(function (r) { ['currency:0', 'number:2', 'percent:1', 'currency'].forEach(function (s) { fmt.push([r.V_AMOUNT, s, F.formatValue(r.V_AMOUNT, s)]); }); });
      [13456789.12, 12345.499999999998, 12345.5, 99999999.995, 1.005, 0.125, 2.5, -2.5, 1e-7, 0.1 + 0.2, 123.45678901234568, -0.0000001, 4.35 * 100, 1 / 3, 7]
        .forEach(function (f) { ['number:2', 'number:0', 'currency:0', 'currency', 'percent:1', 'number:4'].forEach(function (s) { num.push([f, s, F.formatValue(HC.numText(f), s)]); }); });
      ['color: red', 'COLOR : Red ;; background-color:#fff', 'color: red; color: blue', 'font-weight: bold; foo: bar', 'background-color: url(x)', 'color: rgb(1, 2, 3)',
        'color: rgb(1, 2, 3', 'color: )(', "font-family: 'Courier New', monospace", 'color: expression(alert(1))',
        'border: 1px solid #ccc; border-left: 4px solid var(--accent-danger, #c62828)', 'text-decoration: line-through underline', 'transform: rotate(2deg)',
        'font-size: 120%', 'color: "red"', 'color: red /* x */', 'color: javascript:1', 'color: a@b', 'width: 10px', ':color red', 'color:', 'color: ' + new Array(125).join('a'),
        'background-color: var(--pnb-hl-amber, #fbe8a6); color: var(--accent-danger, #c62828); font-weight: bold; font-style: italic; text-decoration: line-through']
        .forEach(function (s) { css.push([s, F.cleanCss(s).css]); });
      return { fmt: fmt, num: num, css: css };
    };
    return K;
  }

  var S = {
    fbuild: async function () {
      var amt = colCells('V_AMOUNT'), dt = colCells('V_DATE'), st = colCells('V_STATUS'), nm = colCells('V_NAME');
      var badA = amt.slice(0, 60).filter(function (td) { var r = rowOf(td); return td.textContent !== dollars0(cents(r.V_AMOUNT)) || td.getAttribute('data-pnb-raw') !== r.V_AMOUNT; });
      R.chk.amtShown = amt.length >= 60 && badA.length === 0;
      R.chk.noOrigHtml = amt.slice(0, 60).every(function (td) { return !td.hasAttribute('data-original-html'); });
      var badD = dt.slice(0, 60).filter(function (td) { var r = rowOf(td), o = mdy(r.V_DATE); return td.textContent !== MON[o.m - 1] + ' ' + o.d + ', ' + o.y || td.getAttribute('data-pnb-raw') !== r.V_DATE; });
      R.chk.dateShown = dt.length >= 60 && badD.length === 0;
      R.chk.filterClass = st.length > 0 && st.every(function (td) { return td.classList.contains('pnb-cflt'); }) && nm.every(function (td) { return !td.classList.contains('pnb-cflt'); });
      R.chk.plainUntouched = nm.slice(0, 30).every(function (td) { var r = rowOf(td); return td.textContent === r.V_NAME && !td.hasAttribute('data-pnb-raw'); });
      R.chk.linksKept = colCells('V_LINK').slice(0, 20).every(function (td) { return !!td.querySelector('a.resolver-link'); });
      // a hidden column, filled on demand, comes out formatted too (number:2)
      window.__HC.fillByName(['H_NUM']);
      var hn = colCells('H_NUM', true);
      var badN = hn.slice(0, 60).filter(function (td) { var r = rowOf(td); return td.textContent !== group(r.H_NUM) + '.00' || td.getAttribute('data-pnb-raw') !== r.H_NUM; });
      R.chk.lazyFormatted = hn.length >= 60 && badN.length === 0;
      // the flat footer: V_AMOUNT's total in the column's format, from the values
      var tot = 0; window.__rowsFixture.forEach(function (r) { tot += cents(r.V_AMOUNT); });
      var i = hdrIndex('V_AMOUNT'), ft = document.querySelector('#resultsTable tfoot tr.total-row-data');
      var ftd = ft ? Array.prototype.slice.call(ft.children).filter(function (c) { return c.getAttribute('data-column') === String(document.querySelectorAll('#resultsTable thead th')[i].getAttribute('data-column')); })[0] : null;
      var fstr = ftd ? (ftd.querySelector('strong') || ftd).textContent.trim() : null;
      R.chk.footerFmt = fstr === dollars0(tot);
      // the readers of a cell's VALUE (rules, heat, totals, the grouped search) get the value
      R.chk.readersRaw = !!window.__HC.cmpText && !!amt[0] && window.__HC.cmpText(amt[0]) === rowOf(amt[0]).V_AMOUNT
        && String(window.__HC.sumText(amt[0])) === rowOf(amt[0]).V_AMOUNT && amt[0].textContent !== rowOf(amt[0]).V_AMOUNT;
      R.info = { a0: amt[0] && amt[0].outerHTML.slice(0, 160), d0: dt[0] && dt[0].outerHTML.slice(0, 160), badA: badA.length, badD: badD.length, badN: badN.length, foot: fstr, want: dollars0(tot), hn0: hn[0] && hn[0].outerHTML.slice(0, 120) };
    },
    fsort: async function () {
      var th = document.querySelector('#tableHeader th[data-colname="V_DATE"]');
      th.click();
      await sleep(700);
      var cells = colCells('V_DATE');
      var keys = cells.map(function (td) { var o = mdy(td.getAttribute('data-pnb-raw') || ''); return o ? o.y * 10000 + o.m * 100 + o.d : NaN; });
      var sorted = keys.every(function (k, j) { return !isNaN(k) && (j === 0 || keys[j - 1] <= k); });
      R.chk.shownAsPattern = cells.length >= 100 && cells.slice(0, 20).every(function (td) { var o = mdy(td.getAttribute('data-pnb-raw')); return o && td.textContent === wday(o) + ', ' + MON[o.m - 1] + ' ' + o.d + ', ' + o.y; });
      R.chk.sortedByDate = cells.length >= 100 && sorted;
      R.info = { first: cells.slice(0, 4).map(function (td) { return td.textContent; }), n: cells.length };
    },
    fpanel: async function () {
      openPanel();
      await sleep(200);
      var items = Array.prototype.slice.call(document.querySelectorAll('#spColumnList .sp-col-item:not(.sp-col-fixed)'));
      // (colopt b) the cog in the summary lane - after the show box, before the name - and
      // the badges at the row's end, on every row; no summary chip, Shading chip, formula box
      R.chk.cogsAll = items.length === 20 && items.every(function (it) {
        var kids = Array.prototype.slice.call(it.children), c = it.querySelector('.sp-col-cog'), nm = it.querySelector('.sp-col-name'), b = it.querySelector('.sp-col-badges');
        return !!c && !!nm && !!b && kids.indexOf(c) === 2 && kids.indexOf(nm) === 3 && kids.indexOf(b) === kids.length - 1;
      });
      R.chk.noShadeChip = !document.querySelector('#spColumnList .sp-col-shade');
      R.chk.noOldChips = !document.querySelector('#spColumnList .sp-col-sumtype, #spColumnList .sp-col-formula');
      R.chk.restCog = !!cogOf('V_DATE') && !!cogOf('V_DATE').classList.contains('sp-col-cog') && !cogOf('V_DATE').classList.contains('is-custom') && badgesOf('V_DATE').length === 0;
      // the lane is a cog wide: header cell, cogs and the '#' row's spacer line up at 24px
      var hs = document.querySelector('#spColumnList .sp-col-head .sph-sum'), gh = document.querySelector('#spColumnList .sp-col-sum-ghost');
      R.chk.cogWidth = !!cogOf('V_DATE') && Math.round(cogOf('V_DATE').getBoundingClientRect().width) === 24 && !!hs && Math.round(hs.getBoundingClientRect().width) === 24
        && !!gh && Math.round(gh.getBoundingClientRect().left) === Math.round(cogOf('V_DATE').getBoundingClientRect().left);
      chipOf('V_DATE').click();
      var pop = popover();
      var types = pop ? Array.prototype.map.call(pop.querySelectorAll('[data-co="type"] option'), function (o) { return o.value; }) : [];
      R.chk.popDateKind = !!pop && types.indexOf('date') !== -1 && types.indexOf('currency') === -1 && !pop.querySelector('[data-sec="shade"]') && !!pop.querySelector('[data-co="filter"]') && !pop.querySelector('[data-co="deep"]');
      R.chk.chipOpen = chipOf('V_DATE').classList.contains('is-open') && chipOf('V_DATE').getAttribute('aria-expanded') === 'true';
      var tSel = pop.querySelector('[data-co="type"]');
      tSel.value = 'date'; fire(tSel, 'change');
      await sleep(80);
      var c0 = colCells('V_DATE')[0], o0 = mdy(rowOf(c0).V_DATE);
      R.chk.pickDate = c0.textContent === o0.y + '-' + pad2(o0.m) + '-' + pad2(o0.d) && (colopt() || {}).V_DATE && colopt().V_DATE.fmt === 'date:YYYY-MM-DD';
      var bd = badgesOf('V_DATE');
      R.chk.badgeReads = bd.length === 1 && bd[0].t === 'DATE' && bd[0].own && cogOf('V_DATE').classList.contains('is-custom') && !!popover()
        && /Format: Date, Oct 5, 2026|Format: Date, 2026-10-05/.test(item('V_DATE').querySelector('.sp-col-badges').getAttribute('title') || '')
        && /\(customized\)$/.test(cogOf('V_DATE').getAttribute('aria-label'));
      var pSel = popover().querySelector('[data-co="pattern"]');
      pSel.value = '__custom'; fire(pSel, 'change');
      var cIn = popover().querySelector('[data-co="custom"]');
      cIn.value = 'D MMMM YYYY'; fire(cIn, 'input');
      await sleep(450);
      c0 = colCells('V_DATE')[0];
      R.chk.customPattern = c0.textContent === o0.d + ' ' + MONTHS[o0.m - 1] + ' ' + o0.y && colopt().V_DATE.fmt === 'date:D MMMM YYYY';
      cIn.value = 'MMM <D>'; fire(cIn, 'input');
      await sleep(450);
      R.chk.badPatternKept = colCells('V_DATE')[0].textContent === o0.d + ' ' + MONTHS[o0.m - 1] + ' ' + o0.y && cIn.classList.contains('is-invalid') && colopt().V_DATE.fmt === 'date:D MMMM YYYY';
      // Reset: everything for the column back
      popover().querySelector('[data-co="reset"]').click();
      await sleep(80);
      R.chk.resetClears = colCells('V_DATE')[0].textContent === rowOf(colCells('V_DATE')[0]).V_DATE && (!colopt() || !colopt().V_DATE)
        && !chipOf('V_DATE').classList.contains('is-custom') && badgesOf('V_DATE').length === 0;
      // Escape closes it (the app's capture handler) and hands the focus back to the chip
      var t = popover().querySelector('select') || popover();
      t.focus();
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(80);
      R.chk.escapeCloses = !popover() && !chipOf('V_DATE').classList.contains('is-open');
      // a money column: number formats + shading; no date, no deep links
      chipOf('V_AMOUNT').click();
      var p2 = popover();
      var t2 = p2 ? Array.prototype.map.call(p2.querySelectorAll('[data-co="type"] option'), function (o) { return o.value; }) : [];
      R.chk.popNumKind = !!p2 && t2.join(',') === ',number,currency,percent' && !!p2.querySelector('[data-sec="shade"]') && !p2.querySelector('[data-co="deep"]');
      // the shading radio is the Shading chip's pick (penumbraSetShade)
      var bar = p2.querySelector('[data-co="shade"][value="bar"]');
      bar.checked = true; fire(bar, 'change');
      await sleep(120);
      var pr = prefs();
      R.chk.shadeViaPopover = !!pr && pr.shade && pr.shade.V_AMOUNT === 'bar' && /linear-gradient/.test(colCells('V_AMOUNT')[0].style.backgroundImage || '');
      // the badges: its default total outlined, then the bar, filled; the cog accented
      var ba = badgesOf('V_AMOUNT');
      R.chk.barBadge = ba.length === 2 && ba[0].t === 'SUM' && !ba[0].own && ba[1].t === 'BAR' && ba[1].own && cogOf('V_AMOUNT').classList.contains('is-custom');
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(60);
      R.chk.outsideCloses = !popover();
      // a vendor-code column: its deep links; no format section
      chipOf('V_LINK').click();
      var p3 = popover();
      R.chk.popLinkKind = !!p3 && !p3.querySelector('[data-sec="format"]') && !!p3.querySelector('[data-co="deep"]') && p3.querySelector('[data-co="deep"]').checked;
      // its links are on by default: an outlined VC; off is the viewer's own, NO VC
      var bl0 = badgesOf('V_LINK');
      R.chk.vcDefault = bl0.length === 1 && bl0[0].t === 'VC' && !bl0[0].own && !cogOf('V_LINK').classList.contains('is-custom');
      var dlk = p3 && p3.querySelector('[data-co="deep"]');
      if (dlk) { dlk.checked = false; fire(dlk, 'change'); }
      await sleep(100);
      var bl1 = badgesOf('V_LINK');
      R.chk.vcOff = bl1.length === 1 && bl1[0].t === 'NO VC' && bl1[0].own && cogOf('V_LINK').classList.contains('is-custom');
      R.info = { types: types, t2: t2, prefs: prefs(), chip: chipOf('V_DATE') && chipOf('V_DATE').outerHTML.slice(0, 300), bl0: bl0, bl1: bl1,
        amt: item('V_AMOUNT') && item('V_AMOUNT').innerHTML.slice(0, 600) };
    },
    // (colopt b) the summary in the cog's popover: at once, the user layer, the badges, the
    // accent; a Custom Formula once it reads; Reset; a footer badge's look dropped; Save
    // Column Layout keeps them; the lane's sort; a column with only a summary to set
    fsum: async function () {
      // the harness shows the Save dialog, whose Enter-to-save takes every Enter
      document.getElementById('saveStateLightbox').style.display = 'none';
      openPanel();
      await sleep(200);
      // V_AMOUNT is money, so it is totalled by default: an outlined SUM, the cog not accented
      var b0 = badgesOf('V_AMOUNT');
      R.chk.defaultOutlined = b0.length === 1 && b0[0].t === 'SUM' && !b0[0].own && !cogOf('V_AMOUNT').classList.contains('is-custom')
        && cogOf('V_AMOUNT').getAttribute('data-sum-type') === 'sum';
      var tg = document.getElementById('spBadgeToggle');
      R.chk.footerLabel = !!tg && tg.textContent === 'Hide footer badges' && tg.style.display !== 'none';
      cogOf('V_AMOUNT').click();
      var pop = popover(), sel = pop && pop.querySelector('[data-co="sum"]');
      var secs = pop ? Array.prototype.map.call(pop.querySelectorAll('[data-sec]'), function (s) { return s.getAttribute('data-sec'); }) : [];
      R.chk.popHasSummary = !!sel && sel.value === 'sum' && secs[0] === 'summary' && secs.indexOf('format') > 0 && pop.querySelector('[data-hint="sum"]').textContent === '';
      R.chk.popLeftAligned = !!pop && Math.abs(pop.getBoundingClientRect().left - cogOf('V_AMOUNT').getBoundingClientRect().left) <= 1;
      // Average: at once - the footer, the user layer, the badge, the cog - and no pending change
      sel.value = 'avg'; fire(sel, 'change');
      await sleep(200);
      var fc = footCell('V_AMOUNT');
      R.chk.avgFooter = !!fc && fc.getAttribute('data-sum-type') === 'avg' && /AVG/.test(fc.textContent);
      R.chk.avgSaved = !!prefs() && !!prefs().summaries && prefs().summaries.V_AMOUNT === 'avg';
      var b1 = badgesOf('V_AMOUNT');
      R.chk.avgBadgeOwn = b1.length === 1 && b1[0].t === 'AVG' && b1[0].own && cogOf('V_AMOUNT').classList.contains('is-custom')
        && pop.querySelector('[data-hint="sum"]').textContent === 'Default: Total.' && !pop.querySelector('[data-co="reset"]').disabled;
      R.chk.notPending = document.getElementById('spPendingCount').textContent === '' && document.getElementById('spApply').disabled;
      // the default again: nothing stored, nothing accented
      sel.value = 'sum'; fire(sel, 'change');
      await sleep(200);
      var p = prefs();
      R.chk.sameAsDefaultNotOwn = !(p && p.summaries && Object.prototype.hasOwnProperty.call(p.summaries, 'V_AMOUNT')) && !cogOf('V_AMOUNT').classList.contains('is-custom')
        && !!footCell('V_AMOUNT') && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'sum';
      // None over a default total: stored as false, the footer cell goes, the cog accented,
      // and the row says so - NO SUM, filled (it is the viewer's)
      sel.value = ''; fire(sel, 'change');
      await sleep(200);
      p = prefs();
      var bn = badgesOf('V_AMOUNT');
      R.chk.noneStored = !!p && !!p.summaries && p.summaries.V_AMOUNT === false && !footCell('V_AMOUNT') && bn.length === 1 && bn[0].t === 'NO SUM' && bn[0].own
        && cogOf('V_AMOUNT').classList.contains('is-custom') && cogOf('V_AMOUNT').getAttribute('data-sum-type') === ''
        && /Summary: None \(default: Total\)/.test(item('V_AMOUNT').querySelector('.sp-col-badges').getAttribute('title') || '');
      // Custom Formula: its box; nothing applied until the formula reads
      sel.value = 'formula'; fire(sel, 'change');
      await sleep(100);
      var fx = pop.querySelector('[data-co="fx"]'), msg = pop.querySelector('.pnb-colopt-msg');
      R.chk.fxWaits = !!fx && fx.offsetParent !== null && fx.value === '' && /Type a formula/.test(msg.textContent) && prefs().summaries.V_AMOUNT === false
        && fx.getAttribute('aria-invalid') === 'false';
      fx.value = '{sum}/{bogus}'; fire(fx, 'input');
      await sleep(600);
      R.chk.fxInvalidKept = /Unknown value \{bogus\}\.$/.test(msg.textContent) && fx.getAttribute('aria-invalid') === 'true' && prefs().summaries.V_AMOUNT === false && !footCell('V_AMOUNT');
      fx.value = '{sum}/{count}'; fire(fx, 'input');
      await sleep(600);
      fc = footCell('V_AMOUNT'); p = prefs();
      var tot = 0; window.__rowsFixture.forEach(function (r) { tot += cents(r.V_AMOUNT); });
      var fxv = fc && fc.querySelector('strong') ? parseFloat(fc.querySelector('strong').textContent.replace(/[$,]/g, '')) : NaN;
      var bf = badgesOf('V_AMOUNT');
      R.chk.fxApplied = p.summaries.V_AMOUNT === 'formula' && !!p.summaryFormulas && p.summaryFormulas.V_AMOUNT === '{sum}/{count}' && !!fc && fc.getAttribute('data-sum-type') === 'formula'
        && Math.abs(fxv - tot / 100 / window.__rowsFixture.length) < 0.011 && msg.textContent === '' && bf.length === 1 && bf[0].t === 'FX' && bf[0].own;
      // Enter on a formula that does not read: said at once, the last good one stands
      fx.value = '{sum}/';
      fx.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(150);
      R.chk.fxEnterInvalid = msg.textContent !== '' && prefs().summaryFormulas.V_AMOUNT === '{sum}/{count}' && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'formula' && !!popover();
      // Reset: back to the default total, nothing of the viewer's left
      pop.querySelector('[data-co="reset"]').click();
      await sleep(200);
      p = prefs();
      var br = badgesOf('V_AMOUNT');
      R.chk.resetSum = !(p && p.summaries && Object.prototype.hasOwnProperty.call(p.summaries, 'V_AMOUNT')) && !(p && p.summaryFormulas && p.summaryFormulas.V_AMOUNT)
        && !!footCell('V_AMOUNT') && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'sum' && sel.value === 'sum' && !cogOf('V_AMOUNT').classList.contains('is-custom')
        && br.length === 1 && br[0].t === 'SUM' && !br[0].own;
      // a text column: the number types flagged, a count suggested; Count Unique applies
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      cogOf('V_NAME').click();
      pop = popover(); sel = pop.querySelector('[data-co="sum"]');
      var grp = pop.querySelector('[data-co="sum"] optgroup');
      var sug = Array.prototype.filter.call(sel.options, function (o) { return /, suggested$/.test(o.textContent); }).map(function (o) { return o.value; });
      R.chk.textColList = !!grp && /does not look numeric/.test(grp.label) && sug.join() === 'count_filled' && sel.value === '';
      sel.value = 'count_unique'; fire(sel, 'change');
      await sleep(200);
      fc = footCell('V_NAME');
      var lbl = document.querySelector('#resultsTable tfoot tr.total-row-data .pnb-sum-label');
      R.chk.uniqFooter = !!fc && fc.getAttribute('data-sum-type') === 'count_unique' && /UNIQ/.test(fc.textContent) && !!lbl && lbl.textContent.trim() === 'SUMMARY'
        && prefs().summaries.V_NAME === 'count_unique';
      // a footer badge's look at V_AMOUNT (never saved), then a pick in the popover: the pick shows
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      footCell('V_AMOUNT').querySelector('.pnb-sum-badge').click();
      var mx = document.querySelector('.sp-sumtype-menu .sp-sumtype-opt[data-type="max"]');
      if (mx) mx.click();
      await sleep(200);
      var looked = !!footCell('V_AMOUNT') && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'max';
      cogOf('V_AMOUNT').click();
      pop = popover(); sel = pop.querySelector('[data-co="sum"]');
      var showsSaved = sel.value === 'sum';
      sel.value = 'median'; fire(sel, 'change');
      await sleep(200);
      R.chk.dropsLook = looked && showsSaved && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'median';
      // Save Column Layout (for a visibility change) keeps them: the rows carry no summary
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      item('V_ID').querySelector('.sp-col-check').click();
      await sleep(80);
      var pend = document.getElementById('spPendingCount').textContent;
      document.getElementById('spApply').click();
      await sleep(900);
      p = prefs();
      R.chk.applyKeeps = pend === '1 change' && !!p.summaries && p.summaries.V_AMOUNT === 'median' && p.summaries.V_NAME === 'count_unique'
        && !!footCell('V_AMOUNT') && footCell('V_AMOUNT').getAttribute('data-sum-type') === 'median' && !!footCell('V_NAME');
      // the lane's sort: the viewer's own first, then those set by default, then the rest
      openPanel();
      await sleep(200);
      // shading set from outside the popover (the API, as a link's &shade= would) shows on its row
      window.Penumbra.setShade('V_AMOUNT', 'scale');
      var bsh = badgesOf('V_AMOUNT');
      R.chk.shadeOutside = bsh.length === 2 && bsh[1].t === 'HEAT' && bsh[1].own;
      // an option of the viewer's on a column listed AFTER the vendor-code one (default VC):
      // the sort has to lift it past that column
      window.Penumbra.setColOpt('V_STATUS', 'filter', true);
      var head = document.querySelector('#spColumnList .sp-col-head .sph-sum');
      var rest = head ? head.getAttribute('data-rest') : '';
      head.click();
      await sleep(100);
      var ranks = Array.prototype.map.call(document.querySelectorAll('#spColumnList .sp-col-item:not(.sp-col-fixed)'), function (it) {
        var c = it.querySelector('.sp-col-cog'); return !c ? -1 : c.classList.contains('is-custom') ? 2 : (it.querySelector('.sp-col-badge') ? 1 : 0);
      });
      R.chk.laneSort = ranks.every(function (r, i) { return r >= 0 && (i === 0 || ranks[i - 1] >= r); }) && ranks[0] === 2 && ranks.indexOf(1) !== -1 && ranks.indexOf(0) !== -1
        && /⚙/.test(rest || '');
      // the badges open the popover too
      item('V_AMOUNT').querySelector('.sp-col-badges').click();
      R.chk.badgesOpen = !!popover() && cogOf('V_AMOUNT').classList.contains('is-open');
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      // a column the query did not return (a journal column): its summary, and only that
      var fake = document.createElement('button');
      fake.className = 'sp-col-opts sp-col-cog'; fake.setAttribute('data-opts-col', 'NO_SUCH_COL'); fake.setAttribute('data-opts-title', 'Done');
      document.getElementById('spColumnList').appendChild(fake);
      fake.click();
      pop = popover();
      var secs2 = pop ? Array.prototype.map.call(pop.querySelectorAll('[data-sec]'), function (s) { return s.getAttribute('data-sec'); }) : [];
      R.chk.nonDataOnlySummary = secs2.join() === 'summary' && pop.querySelector('.pnb-colopt-title').textContent === 'Done';
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      fake.parentNode.removeChild(fake);
      R.info = { b0: b0, b1: b1, bf: bf, br: br, secs: secs, secs2: secs2, ranks: ranks, pend: pend, prefs: prefs(), fxv: fxv, want: tot / 100 / window.__rowsFixture.length,
        msg: msg && msg.textContent, sug: sug, rest: rest, lbl: lbl && lbl.textContent, tg: tg && tg.textContent };
    },
    // (colopt c) Freeze in the options of the first five shown columns: the box, the
    // columns frozen WITH the one that holds it (ticked, greyed, named), the badges,
    // the report's default (taken off here, Reset back), a show/hide moving it, the
    // status bar's count and button; the select by the Columns heading hidden
    ffreeze: async function () {
      document.getElementById('saveStateLightbox').style.display = 'none';
      openPanel();
      await sleep(200);
      var FF = window.Penumbra.flatFreeze;
      FF.apply();   // what an open panel runs (the select's sync)
      await sleep(100);
      function shownRows() { return Array.prototype.filter.call(document.querySelectorAll('#spColumnList .sp-col-item'), function (it) { var c = it.querySelector('.sp-col-check'); return c && c.checked; }); }
      var names = shownRows().map(function (it) { return it.classList.contains('sp-col-fixed') ? '#' : it.getAttribute('data-colname'); });
      var wrap = document.getElementById('spFreezeWrap');
      R.chk.selectHidden = !!wrap && getComputedStyle(wrap).display === 'none';
      function closePop() { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
      function popFor(n) { closePop(); var c = cogOf(n); if (c) c.click(); return popover(); }
      function frz(n) {
        var it = item(n), b = it && it.querySelector('.sp-col-badge.is-ico');
        return b ? (b.classList.contains('is-own') ? 'own' : 'with') + (/NO/.test(b.textContent) ? '-no' : '') : '';
      }
      function hint(p) { var h = p && p.querySelector('[data-hint="freeze"]'); return h ? h.textContent : ''; }
      var five = names.slice(0, 5).filter(function (n) { return n !== '#'; });
      var has = five.map(function (n) { var p = popFor(n); return !!(p && p.querySelector('[data-sec="freeze"] [data-co="freeze"]')); });
      var p6 = popFor(names[5]), pH = popFor('H_TEXT');
      R.chk.sectionFirstFive = five.length >= 3 && has.every(Boolean) && !!p6 && !p6.querySelector('[data-sec="freeze"]') && !!pH && !pH.querySelector('[data-sec="freeze"]');
      // tick it on the third shown column: the count is its place; it holds the freeze
      var e1 = names[2], before = names.slice(0, 2).filter(function (n) { return n !== '#'; });
      var p = popFor(e1), cb = p && p.querySelector('[data-co="freeze"]');
      var startOff = !!cb && !cb.checked && !cb.disabled;
      if (cb) { cb.checked = true; fire(cb, 'change'); }
      await sleep(150);
      var pr = prefs();
      R.chk.checkFreezes = startOff && FF.state().wanted === 3 && !!pr && pr.frozen === 3 && cb.checked && !cb.disabled && !p.querySelector('[data-co="reset"]').disabled;
      R.chk.badges = frz(e1) === 'own' && cogOf(e1).classList.contains('is-custom') && before.length > 0
        && before.every(function (n) { return frz(n) === 'with' && !cogOf(n).classList.contains('is-custom'); })
        && names.slice(3).every(function (n) { return n === '#' || frz(n) === ''; }) && item(e1).classList.contains('sp-col-frozen-last');
      // a column before it: ticked, greyed, and it says which column holds the freeze
      var pb = popFor(before[before.length - 1]), cbb = pb && pb.querySelector('[data-co="freeze"]');
      R.chk.inherited = !!cbb && cbb.checked && cbb.disabled && hint(pb).indexOf('Frozen with ' + e1) === 0;
      // a later one of the five takes it further; the one before it is frozen WITH it now
      var e2 = names[4], p2 = popFor(e2), cb2 = p2 && p2.querySelector('[data-co="freeze"]');
      if (cb2) { cb2.checked = true; fire(cb2, 'change'); }
      await sleep(150);
      R.chk.moveDown = FF.state().wanted === 5 && frz(e2) === 'own' && frz(e1) === 'with' && !cogOf(e1).classList.contains('is-custom') && cogOf(e2).classList.contains('is-custom');
      // ...and unticking the column that holds it takes the freeze off
      if (cb2) { cb2.checked = false; fire(cb2, 'change'); }
      await sleep(150);
      pr = prefs();
      R.chk.untickOff = FF.state().wanted === 0 && !(pr && Object.prototype.hasOwnProperty.call(pr, 'frozen')) && names.every(function (n) { return n === '#' || frz(n) === ''; })
        && !!cb2 && !cb2.checked && !cb2.disabled;
      // the report's own freeze (2): outlined; its box says so; taken off here it is the
      // viewer's - NO + snowflake, filled, the cog accented - and Reset puts it back
      FF.set(2, null);
      await sleep(150);
      var r2 = names[1], pr2 = popFor(r2), cbr = pr2 && pr2.querySelector('[data-co="freeze"]');
      R.chk.reportDefault = frz(r2) === 'with' && !cogOf(r2).classList.contains('is-custom') && !!cbr && cbr.checked && !cbr.disabled
        && /report.s default/.test(hint(pr2)) && pr2.querySelector('[data-co="reset"]').disabled;
      if (cbr) { cbr.checked = false; fire(cbr, 'change'); }
      await sleep(150);
      R.chk.offOwn = FF.state().wanted === 0 && FF.state().user === 0 && frz(r2) === 'own-no' && cogOf(r2).classList.contains('is-custom')
        && /took it off/.test(hint(pr2)) && !pr2.querySelector('[data-co="reset"]').disabled;
      pr2.querySelector('[data-co="reset"]').click();
      await sleep(150);
      R.chk.resetBack = FF.state().wanted === 2 && FF.state().user === null && frz(r2) === 'with' && !!cbr && cbr.checked && !cogOf(r2).classList.contains('is-custom');
      closePop();
      // a show/hide in the list moves it with the places (what Save Column Layout would freeze)
      var hide = names[1], next = names[2];
      item(hide).querySelector('.sp-col-check').click();
      await sleep(120);
      var moved = frz(next) === 'with' && frz(hide) === '' && item(next).classList.contains('sp-col-frozen-last');
      item(hide).querySelector('.sp-col-check').click();
      await sleep(120);
      R.chk.followsList = moved && frz(hide) === 'with' && frz(next) === '';
      // the status bar: its count is the same count; its button opens the column that holds it
      var n3 = document.querySelector('#sbFrozenCounts .sb-frz-n[data-n="3"]');
      if (n3) n3.click();
      await sleep(150);
      R.chk.chipCount = !!n3 && FF.state().wanted === 3 && frz(names[2]) === 'own';
      var sb = document.getElementById('sbFrozenSettings');
      if (sb) sb.click();
      await sleep(500);
      var pp = popover();
      R.chk.chipOpens = !!pp && !!pp.querySelector('[data-sec="freeze"]') && pp.querySelector('.pnb-colopt-title').textContent === names[2]
        && /column options/.test(sb.textContent) && /any of the first five/.test(document.querySelector('#sbFrozenPop .sb-frz-foot').textContent);
      R.info = { names: names, has: has, state: FF.state(), prefs: prefs(), hintB: hint(pb), hintR: hint(pr2),
        e1: item(e1) && item(e1).querySelector('.sp-col-badges') && item(e1).querySelector('.sp-col-badges').outerHTML.slice(0, 400) };
    },
    // (colopt c) the ? icons: alike in light and dark themes (a dark theme's button paint
    // used to take the shortcut sheet's ?), and hover help - the shared rich popover
    // with the tip's own text - on every ? of the panel and the options popover
    ftips: async function () {
      openPanel();
      await sleep(200);
      function looks() {
        var els = Array.prototype.filter.call(document.querySelectorAll('#settingsPanel .sp-help-icon'), function (e) { return e.offsetParent !== null; });
        var c = cogOf('V_AMOUNT'); if (c) c.click();
        var pq = popover() && popover().querySelector('.sp-help-icon'); if (pq) els.push(pq);
        var sigs = els.map(function (e) { var s = getComputedStyle(e); return [s.borderTopWidth, s.borderTopStyle, s.borderTopColor, s.backgroundColor, s.color, Math.round(e.getBoundingClientRect().width)].join(' '); });
        var ring = els.length ? getComputedStyle(els[0]).borderTopColor === getComputedStyle(els[0]).color : false;
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        return { n: els.length, sigs: sigs, same: sigs.length > 0 && sigs.every(function (x) { return x === sigs[0]; }), ring: ring };
      }
      var L = looks();
      document.body.classList.add('is-dark', 'theme-dark-blue');
      var D = looks();
      document.body.classList.remove('theme-dark-blue');   // is-dark alone: a registry dark theme
      var D2 = looks();
      document.body.classList.remove('is-dark');
      R.chk.iconsAlike = L.n >= 5 && L.same && D.same && D2.same && D.n === L.n && D.ring && D.sigs[0] !== L.sigs[0];
      async function tip(el) {
        if (!el) return '';
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
        await until(function () { var q = document.querySelector('.bld-help-pop.open h4'); return !!q; }, 10000);
        var h = document.querySelector('.bld-help-pop.open h4'), t = h ? h.textContent : '';
        el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        await until(function () { return !document.querySelector('.bld-help-pop.open'); }, 3000);
        return t;
      }
      var q = function (sel) { return document.querySelector(sel); };
      var t1 = await tip(q('#settingsPanel .sp-header .sp-help-icon'));
      var t2 = await tip(q('#spPrefsBody .tab-help-icon'));
      var t3 = await tip(q('#spKeysHelp'));
      var t4 = await tip(q('#pnbCalcSec .sp-help-icon'));
      cogOf('V_AMOUNT').click();
      var pop = popover(), pq = pop && pop.querySelector('.sp-help-icon');
      if (pq) pq.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
      await until(function () { return !!document.querySelector('.bld-help-pop.open h4'); }, 10000);
      var bp = document.querySelector('.bld-help-pop.open'), t5 = bp && bp.querySelector('h4') ? bp.querySelector('h4').textContent : '';
      var above = !!bp && !!pop && parseInt(getComputedStyle(bp).zIndex, 10) > parseInt(getComputedStyle(pop).zIndex, 10);
      R.chk.tipsPanel = t1 === 'Your Settings' && t2 === 'Consistent Row Height' && t3 === 'Single-Key Shortcuts' && t4 === 'Calculated Columns';
      R.chk.tipPopover = t5 === 'Column Options' && above;
      // the tip replaces the title (no second tooltip on top of it)
      R.chk.noTitles = Array.prototype.every.call(document.querySelectorAll('#settingsPanel .sp-help-icon'), function (e) { return !e.hasAttribute('title') && !!e.getAttribute('data-tip'); })
        && !!pq && !pq.hasAttribute('title');
      R.info = { tips: [t1, t2, t3, t4, t5], above: above, loaded: !!document.querySelector('#helpContentContainer [data-tip="us-tip-settings"]'),
        pop: bp ? bp.className + ' ' + bp.innerHTML.slice(0, 120) : null, inited: typeof window.initHelpPopover, L: L, D: D, D2: D2 };
    },
    // (colopt d) the popover as a two-column form: each section's label beside its
    // controls on ONE row, the labels in one column and the controls in another, each
    // label centred on its first row of controls; the shading choices and the Format
    // lists on one line; the pivot cog's popover alike; no title tooltips while open
    fform: async function () {
      openPanel();
      await sleep(450);   // past the panel's 0.25 s slide: popovers are placed by their cog
      function geo(p) {
        var pl = p.getBoundingClientRect().left;   // offsets from the popover's own edge
        return Array.prototype.map.call(p.querySelectorAll('.pnb-colopt-sec'), function (sec) {
          var lbl = sec.querySelector('.pnb-colopt-lbl'), first = null;
          for (var i = 0; i < sec.children.length && !first; i++) { var c = sec.children[i]; if (c !== lbl && c.offsetParent !== null) first = c; }
          var lr = lbl.getBoundingClientRect(), cr = first ? first.getBoundingClientRect() : null;
          return { sec: sec.getAttribute('data-sec'), lblLeft: Math.round(lr.left - pl), ctlLeft: cr ? Math.round(cr.left - pl) : -1,
                   dy: cr ? Math.round(Math.abs((lr.top + lr.height / 2) - (cr.top + cr.height / 2)) * 10) / 10 : 99, gap: cr ? Math.round(cr.left - lr.right) : -99 };
        });
      }
      function even(g, n) {
        return g.length === n && g.every(function (x) { return x.lblLeft === g[0].lblLeft && x.ctlLeft === g[0].ctlLeft && x.dy <= 2 && x.gap >= 0; });
      }
      function tops(p, sel) { return Array.prototype.map.call(p.querySelectorAll(sel), function (e) { return Math.round(e.getBoundingClientRect().top); }); }
      function oneLine(t, n) { return t.length === n && t.every(function (x) { return x === t[0]; }); }
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');   // both of Format's lists on show
      cogOf('V_AMOUNT').click();
      var pop = popover(), g = pop ? geo(pop) : [];
      // (2026-10-20, hl) Highlight after Shading
      R.chk.formRows = even(g, 6) && g.map(function (x) { return x.sec; }).join() === 'summary,format,shade,highlight,filter,freeze';
      // a long name wraps in the head, not cut short: its title tooltip is held while open
      var tt = pop && pop.querySelector('.pnb-colopt-title'), tw = null;
      if (tt) {
        var keepT = tt.textContent, h1 = tt.getBoundingClientRect().height;
        tt.textContent = 'TOTAL_DIRECT_COSTS_AWARDED_TO_DATE_CUMULATIVE_ORIGINAL_SPONSOR';
        tw = { fits: tt.scrollWidth <= tt.clientWidth + 1, h1: Math.round(h1), h2: Math.round(tt.getBoundingClientRect().height) };
        tt.textContent = keepT;
      }
      R.chk.titleWraps = !!tw && tw.fits && tw.h2 > tw.h1 * 1.5;
      // Summary says what it is: "footer row" under its label (the select names it too)
      var sl = pop && pop.querySelector('[data-sec="summary"] .pnb-colopt-lbl'), ss = pop && pop.querySelector('[data-co="sum"]');
      // (the label keeps to its column: it ends before the select starts - colopt e widened both)
      R.chk.sumLabel = !!sl && /^Summary\s*footer row$/i.test(sl.textContent.replace(/\s+/g, ' ').trim()) && !!ss && ss.getAttribute('aria-label') === 'Summary (footer row)'
        && sl.getBoundingClientRect().right <= ss.getBoundingClientRect().left - 4;
      var rt = pop ? tops(pop, '.pnb-colopt-radios label') : [], ft = pop ? tops(pop, '[data-sec="format"] [data-co="type"], [data-sec="format"] [data-co="dp"]') : [];
      R.chk.oneLineEach = oneLine(rt, 3) && oneLine(ft, 2);
      // (colopt e) roomier and a size up: 13px text, 11px labels, 14/16px of padding, ~400px wide
      var pcs = pop && getComputedStyle(pop), plb = pop && pop.querySelector('.pnb-colopt-lbl');
      var roomy = pop ? { padT: parseFloat(pcs.paddingTop), padL: parseFloat(pcs.paddingLeft), fs: parseFloat(pcs.fontSize),
                          lbl: plb ? parseFloat(getComputedStyle(plb).fontSize) : 0, w: Math.round(pop.getBoundingClientRect().width) } : null;
      R.chk.popRoomy = !!roomy && roomy.padT >= 12 && roomy.padL >= 14 && roomy.fs >= 13 && roomy.lbl >= 11 && roomy.w >= 380;
      // no title tooltips while it is open - one already on screen included - and back after
      var tip = document.createElement('div');
      tip.className = 'ui-tooltip'; tip.textContent = 'a title tooltip';
      document.body.appendChild(tip);
      var hiddenOpen = getComputedStyle(tip).display === 'none' && document.body.classList.contains('pnb-colopt-open');
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(80);
      var backAfter = !popover() && getComputedStyle(tip).display !== 'none' && !document.body.classList.contains('pnb-colopt-open');
      R.chk.noTipsOpen = hiddenOpen && backAfter;
      // a text column's popover: its three sections, the same columns
      cogOf('V_NAME').click();
      var pn = popover(), gn = pn ? geo(pn) : [];
      // the same label and control columns as the number column's popover
      R.chk.textCol = even(gn, 4) && gn.map(function (x) { return x.sec; }).join() === 'summary,highlight,filter,freeze' && g.length > 0
        && gn[0].lblLeft === g[0].lblLeft && gn[0].ctlLeft === g[0].ctlLeft;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(60);
      // (colopt g) Filter and Links each a row of their own - both on a vendor-code column;
      // "Click a value to filter" under Links read as following the code's link
      cogOf('V_LINK').click();
      var pl = popover(), gl = pl ? geo(pl) : [];
      var fsec = pl && pl.querySelector('[data-sec="filter"]'), lsec = pl && pl.querySelector('[data-sec="links"]');
      var fbox = fsec && fsec.querySelector('[data-co="filter"]'), ftxt = fbox ? fbox.parentNode.textContent.replace(/\s+/g, ' ').trim() : '';
      R.chk.filterOwnRow = !!fsec && !!lsec && fsec.querySelector('.pnb-colopt-lbl').textContent.trim() === 'Filter' && ftxt === 'Click a table cell to filter by that value'
        && lsec.querySelector('.pnb-colopt-lbl').textContent.trim() === 'Links' && !!lsec.querySelector('[data-co="deep"]') && !lsec.querySelector('[data-co="filter"]')
        && even(gl, gl.length) && gl.length >= 2 && gl[0].lblLeft === g[0].lblLeft;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(60);
      // ...and the FILTER badge's words (the cog's title) say it the same way
      window.Penumbra.setColOpt('V_STATUS', 'filter', true);
      await sleep(30);
      var stc = cogOf('V_STATUS'), stt = stc ? (stc.getAttribute('title') || '') : '';
      R.chk.badgeWords = /Click a table cell to filter by that value/.test(stt) && !/Click a value/.test(stt);
      window.Penumbra.setColOpt('V_STATUS', 'filter', false);
      // the pivot builder's cog: the same popover, the same form, its tooltips held too
      window.__HC.addAgg('sum', 'H_AMT', 'Amt', null, null, null, null);
      var pcog = document.querySelector('#pivot-agg-table-body tr .pat-cell-opt');
      if (pcog) $(pcog).trigger('click');
      var pp = popover(), gp = pp ? geo(pp) : [];
      // (2026-10-20 c) ...and a value's Highlight rules
      R.chk.pivotForm = even(gp, 3) && gp.map(function (x) { return x.sec; }).join() === 'format,shade,highlight' && oneLine(pp ? tops(pp, '.pnb-colopt-radios label') : [], 3)
        && getComputedStyle(tip).display === 'none';
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(60);
      tip.parentNode.removeChild(tip);
      R.info = { rt: rt, ft: ft, tw: tw, roomy: roomy, w: pop && Math.round(pop.getBoundingClientRect().width), g: g, gn: gn, gp: gp, gl: gl, ftxt: ftxt, stt: stt };
    },
    // (colopt e) the Settings panel itself: Theme, Density and Columns each on ONE row,
    // the labels in one column, the controls between one pair of edges (the list's)
    fprows: async function () {
      openPanel();
      await sleep(450);   // past the panel's 0.25 s slide
      var P = document.getElementById('settingsPanel');
      function q(s) { return P.querySelector(s); }
      function box(el) { var b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, cy: b.top + b.height / 2, h: b.height }; }
      function near(a, b, t) { return Math.abs(a - b) <= (t === undefined ? 1 : t); }
      function rnd(b) { var o = {}; for (var k in b) o[k] = Math.round(b[k] * 10) / 10; return o; }
      var tl = q('.sp-theme-section .sp-section-label'), ts = q('#spThemeSelector'),
          dl = q('.sp-density-section .sp-section-label'), ds = q('#spDensitySelector'),
          cl = q('.sp-columns-head .sp-section-label'), cs = q('#spColumnSearch'),
          hu = q('#spHideUnchecked'), cp = q('#spClipToQuery'), li = q('#spColumnList'),
          sw = q('.sp-toggles .sp-switch'), row = q('.sp-column-search-row'), cont = q('.sp-column-container');
      var T = box(tl), TS = box(ts), D = box(dl), DS = box(ds), C = box(cl), CS = box(cs), HU = box(hu), CP = box(cp), LI = box(li), SW = sw ? box(sw) : null;
      // each label beside its control, centred on it; Columns' quick find and both buttons on its row
      R.chk.oneRowEach = near(T.cy, TS.cy, 2) && near(D.cy, DS.cy, 2) && near(C.cy, CS.cy, 2) && near(CS.cy, HU.cy, 2) && near(CS.cy, CP.cy, 2);
      // the labels in one column, beside (not over) the controls, which start on one line
      R.chk.labelsCol = near(T.l, D.l) && near(D.l, C.l) && T.r <= TS.l && D.r <= DS.l && C.r <= CS.l
        && near(TS.l, DS.l) && near(DS.l, CS.l);
      // ...and end on the column list's right edge, the toggles' switches with them
      R.chk.rightEdge = near(TS.r, DS.r) && near(DS.r, CP.r) && near(CP.r, LI.r, 1.5) && !!SW && near(SW.r, CP.r);
      R.chk.labelsOneLine = [T, D, C].every(function (b) { return b.h > 0 && b.h <= 16; });
      // a default hint goes under its select, in the control column; an empty one takes no room
      var hint = q('#spThemeDefaultHint'), tsec = q('.sp-theme-section');
      var h0 = box(tsec).h;
      hint.innerHTML = '<span class="sp-hint-link">Use this theme on all reports I view</span>';
      var HB = box(hint), h1 = box(tsec).h;
      hint.textContent = '';
      var h2 = box(tsec).h;
      R.chk.hintUnder = near(HB.l, TS.l) && HB.t >= TS.b - 0.5 && h1 > h0 + 8;
      R.chk.emptyHintNoRoom = near(h0, TS.h, 0.5) && near(h2, TS.h, 0.5);
      // the notes that come and go: Freeze paused, resized widths and the admin note UNDER
      // the Columns row, over the list (no pivot notice: an unplaced note would take its row)
      var fh = q('#spFreezeHint'), cw = q('#spColwNote'), an = q('#spColumnsAdminNote'), pm = q('.sp-columns-pivot-msg');
      var shown = [fh, cw, an].filter(Boolean);
      shown.forEach(function (n) { n.style.display = ''; });
      var RW = box(row), CT = box(cont), NB = shown.map(box), C2 = box(cl);
      R.chk.notesPlaced = shown.length >= 2 && near(C2.cy, box(cs).cy, 2) && NB.every(function (b, i) {
        return b.h > 0 && b.t >= RW.b - 0.5 && b.b <= CT.t + 0.5 && (i === 0 || b.t >= NB[i - 1].b - 0.5);
      });
      shown.forEach(function (n) { n.style.display = 'none'; });
      // the pivot notice sits ABOVE the Columns row (2026-10-01)
      pm.innerHTML = '<p>Currently viewing a pivot table.</p>'; pm.style.display = '';
      var PM = box(pm), C3 = box(cl), RW3 = box(row);
      R.chk.pivotAbove = PM.h > 0 && PM.b <= C3.t + 0.5 && PM.b <= RW3.t + 0.5;
      pm.style.display = 'none';
      // Column Organization off for a viewer: no quick find, no list - the message under the label
      var dm = q('.sp-columns-disabled-msg');
      $(row).hide(); $(cont).hide(); $(dm).show();
      var DM = box(dm), C4 = box(cl);
      R.chk.disabledUnder = C4.h > 0 && DM.h > 0 && DM.t >= C4.b - 0.5;
      $(dm).hide(); $(row).show(); $(cont).show();
      // the Freeze select (js/penumbra_colfmt.off): under the row, ending on its edge
      var fw = q('#spFreezeWrap');
      fw.style.display = '';
      var FW = box(fw), RW5 = box(row);
      R.chk.freezeUnder = FW.h > 0 && FW.t >= RW5.b - 0.5 && near(FW.r, CP.r, 1.5) && FW.l >= CS.l - 0.5;
      fw.style.display = 'none';
      // the list takes the section's height: the calculated columns block (under it) keeps its
      // own height, and nothing else is left over
      var sec = q('.sp-columns-section'), calc = q('#pnbCalcSec'), SEC = box(sec), CT6 = box(cont), RW6 = box(row);
      var calcH = calc ? box(calc).h : 0, calcNat = calc ? calc.firstElementChild.getBoundingClientRect().height + (calc.lastElementChild.getBoundingClientRect().height) + 8 : 0;
      // ...a SHORT list too (the quick find down to one column): the list's box keeps the height
      // (an auto row would shrink to the one row and hand the rest out to the section's other rows)
      cs.value = 'V_AMOUNT'; fire(cs, 'input');
      await sleep(30);
      var CT6s = box(cont), calcHs = calc ? box(calc).h : 0, shownN = Array.prototype.filter.call(P.querySelectorAll('#spColumnList .sp-col-item'), function (it) { return it.offsetParent !== null; }).length;
      cs.value = ''; fire(cs, 'input');
      R.chk.listFills = CT6.h > 120 && (!calc || (box(calc).t >= CT6.b - 0.5 && calcH <= calcNat + 2))
        && near(SEC.h, (RW6.b - SEC.t) + 6 + CT6.h + (calc ? calcH + 8 : 0), 3)
        && shownN === 1 && near(CT6s.h, CT6.h, 1) && near(calcHs, calcH, 1);
      // a short window collapses Display Preferences: the Columns row stays one row
      $('#spPrefsToggle').trigger('click');
      await sleep(60);
      var collapsed = document.getElementById('spPrefsGroup').classList.contains('is-collapsed');
      var C7 = box(cl), CS7 = box(cs);
      R.chk.collapsedRow = collapsed && near(C7.cy, CS7.cy, 2) && near(CS7.l, CS.l);
      $('#spPrefsToggle').trigger('click');
      R.info = { T: rnd(T), TS: rnd(TS), D: rnd(D), DS: rnd(DS), C: rnd(C), CS: rnd(CS), CP: rnd(CP), LI: rnd(LI), SW: SW && rnd(SW),
                 h: [h0, h1, h2], notes: NB.map(rnd), RW: rnd(RW), CT: rnd(CT), PM: rnd(PM), DM: rnd(DM), FW: rnd(FW),
                 SEC: rnd(SEC), CT6: rnd(CT6), CT6s: rnd(CT6s), shownN: shownN, calc: [calcH, calcNat, calcHs], collapsed: collapsed };
    },
    ffilter: async function () {
      window.Penumbra.setColOpt('V_STATUS', 'filter', true);
      var st = colCells('V_STATUS');
      R.chk.classOn = st.length > 0 && st.every(function (td) { return td.classList.contains('pnb-cflt'); });
      R.chk.looksLikeLink = st.length > 0 && /underline/.test(getComputedStyle(st[0]).textDecorationLine || getComputedStyle(st[0]).textDecoration) && getComputedStyle(st[0]).cursor === 'pointer';
      // ...on screen only: Copy as HTML / the email embed write it in the row's text colour
      var copyColor = null;
      try {
        var hDoc = new DOMParser().parseFromString(window.__HC.exportData('html').content, 'text/html');
        var tr1 = hDoc.querySelector('tbody tr'), tds = tr1 ? tr1.querySelectorAll('td') : [];
        var iS = hdrIndex('V_STATUS'), iN = hdrIndex('V_NAME');
        if (tds[iS] && tds[iN]) copyColor = [tds[iS].style.color, tds[iN].style.color];
      } catch (e) { copyColor = ['ERR ' + e.message]; }
      R.chk.copyPlainColor = !!copyColor && copyColor.length === 2 && !!copyColor[0] && copyColor[0] === copyColor[1]
        && copyColor[0] !== getComputedStyle(st[0]).color;
      R.info.copyColor = copyColor;
      var v = st[0].textContent.trim();
      st[0].click();
      await sleep(400);
      R.chk.clickFilters = searchVal() === 'V_STATUS = //' + v + '//';
      var shown = colCells('V_STATUS');
      R.chk.rowsFiltered = shown.length > 0 && shown.every(function (td) { return td.textContent.trim() === v; });
      // a column without it: no filter
      $('#tableSearch').val(''); window.__HC.runSearch();
      await sleep(400);
      colCells('V_NAME')[0].click();
      await sleep(200);
      R.chk.otherColInert = searchVal() === '';
      // Enter on the focused cell (cell selection's active cell). The harness keeps the
      // Save dialog SHOWN for the saveconf suites, and its Enter-to-save handler takes
      // every Enter while it shows - as it would on the real page: hide it first.
      document.getElementById('saveStateLightbox').style.display = 'none';
      var c2 = colCells('V_STATUS')[3], v2 = c2.textContent.trim();
      c2.setAttribute('tabindex', '-1'); c2.focus();
      c2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await sleep(400);
      R.chk.enterFilters = searchVal() === 'V_STATUS = //' + v2 + '//';
      $('#tableSearch').val(''); window.__HC.runSearch();
      await sleep(400);
      // a formatted column filters by its VALUE, never its display
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      window.Penumbra.setColOpt('V_AMOUNT', 'filter', true);
      var a0 = colCells('V_AMOUNT')[0], raw = a0.getAttribute('data-pnb-raw');
      a0.click();
      await sleep(400);
      R.chk.valueNotDisplay = !!raw && searchVal() === 'V_AMOUNT = //' + raw + '//' && colCells('V_AMOUNT').length >= 1;
      $('#tableSearch').val(''); window.__HC.runSearch();
      await sleep(400);
      // a nested column: its sub-cells filter by their sub-column
      window.__HC.fillByName(['H_JSON']);
      window.Penumbra.setColOpt('H_JSON', 'filter', true);
      var hj = colCells('H_JSON', true).filter(function (td) { return td.querySelector('.nested-json-row:not(.nested-total-row) .nested-json-cell'); })[0];
      var sub = hj ? hj.querySelectorAll('.nested-json-container > .nested-json-row:not(.nested-total-row) > .nested-json-cell')[2] : null;
      var subTxt = sub ? sub.textContent.trim() : '';
      if (sub) sub.click();
      await sleep(400);
      R.chk.nestedSubFilter = !!sub && searchVal() === 'SUB_NAME = //' + subTxt + '//';
      R.info = { search: searchVal(), v: v, raw: raw, sub: subTxt, deco: getComputedStyle(st[0]).textDecorationLine };
    },
    fdeep: async function () {
      R.chk.linkDefaultOn = colCells('V_LINK').slice(0, 10).every(function (td) { return !!td.querySelector('a.resolver-link'); });
      window.Penumbra.setColOpt('V_LINK', 'deep', false);
      var off = colCells('V_LINK');
      R.chk.offStripped = off.length > 0 && off.slice(0, 20).every(function (td) { return !td.querySelector('a') && /^\d+$/.test(td.textContent.trim()); });
      R.chk.offSaved = !!colopt() && colopt().V_LINK && colopt().V_LINK.deep === false;
      window.__HC.fillByName(['H_HTML', 'H_JSON']);
      R.chk.otherColKeeps = colCells('H_HTML', true).slice(0, 10).every(function (td) { return !!td.querySelector('a.resolver-link'); });
      var nested = colCells('H_JSON', true).filter(function (td) { return td.querySelector('.nested-json-container'); });
      R.chk.nestedLinked = nested.length > 0 && nested.slice(0, 10).every(function (td) { return !!td.querySelector('.nested-json-cell a.resolver-link'); });
      var k = window.__HC.kinds('H_JSON');
      R.chk.kinds = k.deep === true && k.nested === true && window.__HC.kinds('V_LINK').deep === true && window.__HC.kinds('V_NAME').deep === false;
      window.Penumbra.setColOpt('H_JSON', 'deep', false);
      nested = colCells('H_JSON', true).filter(function (td) { return td.querySelector('.nested-json-container'); });
      R.chk.nestedOff = nested.length > 0 && nested.slice(0, 10).every(function (td) { return !td.querySelector('a'); }) && colCells('H_HTML', true).slice(0, 5).every(function (td) { return !!td.querySelector('a.resolver-link'); });
      window.Penumbra.setColOpt('V_LINK', 'deep', true);
      R.chk.backOn = colCells('V_LINK').slice(0, 10).every(function (td) { return !!td.querySelector('a.resolver-link'); }) && !(colopt() && colopt().V_LINK);
      R.info = { opts: colopt(), v0: off[0] && off[0].outerHTML.slice(0, 160) };
    },
    // (colopt f) the Save dialog's report-wide Deep Link Vendor Codes default is gone. This
    // report was saved with it OFF (resolverLinksDefault: false): its codes open linked all
    // the same, the column's options start ticked (the default, not the viewer's own), and
    // neither the view's state nor a save writes the key any more
    frepdeep: async function () {
      R.chk.linkedDespite = colCells('V_LINK').slice(0, 10).every(function (td) { return !!td.querySelector('a.resolver-link'); });
      openPanel();
      await sleep(450);
      var cog = cogOf('V_LINK');
      if (cog) cog.click();
      var pop = popover(), dc = pop && pop.querySelector('[data-co="deep"]'), bd = badgesOf('V_LINK');
      R.chk.popDefaultOn = !!dc && dc.checked === true && bd.some(function (b) { return /^VC$/.test(b.t) && !b.own; });
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await sleep(60);
      var vs = window.__HC.bso ? window.__HC.bso() : null;
      window.__SAVE_ANSWER = function (b) { return { ok: true, json: { success: true, new_id: b.short_id, numeric_id: 7, is_new: false, updated_at: '2026-10-13 10:00:00.000000' } }; };
      var n = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n; }, 8000);
      await sleep(150);
      var s = window.__saves[window.__saves.length - 1], sd = null;
      try { sd = JSON.parse(s.state_data); } catch (e) {}
      R.chk.savedNoKey = !!vs && !('resolverLinksDefault' in vs) && !!sd && !('resolverLinksDefault' in sd) && Array.isArray(sd.visibleColumns);
      R.info = { badges: bd, deep: dc && dc.checked, vsKey: vs && vs.resolverLinksDefault, sdKey: sd && sd.resolverLinksDefault, saves: window.__saves.length - n };
    },
    // &deeplink=0 still turns a view's vendor-code links off (colopt f touched its reader)
    furldeep: async function () {
      R.chk.urlOff = colCells('V_LINK').slice(0, 10).every(function (td) { return !td.querySelector('a') && /^\d+$/.test(td.textContent.trim()); });
      openPanel();
      await sleep(450);
      var cog = cogOf('V_LINK');
      if (cog) cog.click();
      var pop = popover(), dc = pop && pop.querySelector('[data-co="deep"]');
      R.chk.popOff = !!dc && dc.checked === false;
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      R.info = { deep: dc && dc.checked, v0: (colCells('V_LINK')[0] || {}).outerHTML };
    },
    fcalc: async function () {
      var cells = colCells('DUE');
      var bad = cells.slice(0, 40).filter(function (td) {
        var o = mdy(rowOf(td).V_DATE), d = new Date(Date.UTC(o.y, o.m - 1, o.d + 30));
        var iso = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
        return td.getAttribute('data-pnb-raw') !== iso || td.textContent !== MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
      });
      R.chk.shown = cells.length >= 40 && bad.length === 0;
      R.chk.notSummable = window.PenumbraCalc.isSummable('DUE') === false && window.PenumbraCalc.isSummable('TWICE') === true;
      R.chk.kept = window.PenumbraCalc.applied().some(function (d) { return d.name === 'DUE' && d.format === 'date:MMM D, YYYY'; });
      window.PenumbraCalc.openDialog('DUE');
      await sleep(150);
      var sel = document.getElementById('pnbCalcFmt');
      R.chk.dialogFmt = !!sel && sel.value === 'date:MMM D, YYYY';
      var prev = document.querySelector('#pnbCalcPrev td.pnb-calc-res');
      R.chk.dialogPreview = !!prev && /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(prev.textContent);
      sel.value = '__customdate'; fire(sel, 'change');
      var pat = document.getElementById('pnbCalcPat');
      pat.value = 'YYYY [Q]Q'; fire(pat, 'input');
      await sleep(300);
      prev = document.querySelector('#pnbCalcPrev td.pnb-calc-res');
      R.chk.dialogCustom = !!prev && /^\d{4} Q[1-4]$/.test(prev.textContent) && document.getElementById('pnbCalcPatWrap').style.display !== 'none';
      R.info = { c0: cells[0] && cells[0].outerHTML.slice(0, 160), prev: prev && prev.textContent, bad: bad.length };
    },
    fxss: async function () {
      var cells = colCells('X');
      R.chk.noElement = !document.querySelector('#resultsTable img') && window.__pwned === undefined;
      R.chk.shownAsText = cells.length > 0 && cells[0].textContent === '<img src=x onerror=window.__pwned=1>';
      var q = colCells('Q'), want = true, n = 0;
      q.forEach(function (td) { var r = rowOf(td); var y = r.H_ENT === 'O&#039;Brien'; if (y) n++; if ((td.textContent === 'yes') !== y) want = false; });
      R.chk.quoteEquals = q.length > 0 && n > 0 && want;
      R.info = { x0: cells[0] && cells[0].innerHTML.slice(0, 160), n: n };
    },
    fsave: async function () {
      window.Penumbra.setShade('V_AMOUNT', 'bar');
      window.Penumbra.setColOpt('V_DATE', 'format', 'date:YYYY');
      var hasSet = typeof window.Penumbra.setColSummary === 'function';
      if (hasSet) window.Penumbra.setColSummary('V_DATE', 'count_filled');
      window.__HC.saveCols();
      var p = prefs();
      R.chk.keepsBoth = !!p && Array.isArray(p.order) && p.shade && p.shade.V_AMOUNT === 'bar' && p.colopt && p.colopt.V_DATE && p.colopt.V_DATE.fmt === 'date:YYYY';
      R.chk.keepsSummary = hasSet && !!p && !!p.summaries && p.summaries.V_DATE === 'count_filled';
      R.info = { p: p && Object.keys(p) };
    },
    fclear: async function () {
      window.Penumbra.setShade('V_AMOUNT', 'scale');
      window.Penumbra.setColOpt('V_DATE', 'filter', true);
      var hasSet = typeof window.Penumbra.setColSummary === 'function';
      if (hasSet) window.Penumbra.setColSummary('V_NAME', 'mode');
      var items = window.__HC.clearItems('lrfix');
      // (2026-10-20, hl) the column options hold highlight rules too
      R.chk.listed = items.some(function (t) { return /^Shading \(1 column\)$/.test(t); }) && items.some(function (t) { return /^Column options: formats, highlights and links \(1 column\)$/.test(t); });
      R.chk.listsSummary = hasSet && items.some(function (t) { return /^Column summaries \(1 column\)$/.test(t); });
      window.confirm = function () { return true; };
      document.getElementById('spClearStorage').click();
      R.chk.cleared = prefs() === null;
      R.info = { items: items };
    },
    gfmt: async function () {
      if (!(await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000))) throw new Error('no grouped view');
      await sleep(300);
      function gcells(name) {
        var out = [];
        Array.prototype.forEach.call(document.querySelectorAll('#groupedResultsContainer table'), function (t) {
          var ths = Array.prototype.slice.call(t.querySelectorAll('thead th')), i = ths.findIndex(function (th) { return th.dataset.colname === name; });
          if (i < 0) return;
          Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (tr) { if (tr.children[i] && tr.children[i].hasAttribute('data-pnb-raw')) out.push(tr.children[i]); });
        });
        return out;
      }
      var ga = gcells('V_AMOUNT');
      R.chk.cellsFmt = ga.length >= 50 && ga.slice(0, 50).every(function (td) { return td.textContent === dollars0(cents(td.getAttribute('data-pnb-raw'))); });
      var feet = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer tfoot td[data-sum-col="V_AMOUNT"] strong'));
      R.chk.footFmt = feet.length > 0 && feet.every(function (s) { return /^\$[\d,]+$/.test(s.textContent.trim()); });
      var groupsBefore = document.querySelectorAll('#groupedResultsContainer .group-wrapper').length;
      // (Number, 1 decimal: a format that CHANGES every cell - currency:2 would write the
      // fixture's own "$12,345.67" back, and an unchanged cell keeps no data-pnb-raw)
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'number:1');
      ga = gcells('V_AMOUNT');
      R.chk.changeInPlace = ga.length >= 50 && ga.slice(0, 50).every(function (td) {
          var c = cents(td.getAttribute('data-pnb-raw')), want = group(Math.floor(Math.round(c / 10) / 10)) + '.' + (Math.round(c / 10) % 10);
          return td.textContent === want;
        }) && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === groupsBefore;
      feet = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer tfoot td[data-sum-col="V_AMOUNT"] strong'));
      R.chk.footChanged = feet.length > 0 && feet.every(function (s) { return /^[\d,]+\.\d$/.test(s.textContent.trim()); });
      // (colopt b) a summary picked in the popover reaches every group's footer at once,
      // without a regroup; None takes the column's cells out of them
      var hasSet = typeof window.Penumbra.setColSummary === 'function';
      if (hasSet) window.Penumbra.setColSummary('V_AMOUNT', 'avg');
      await sleep(300);
      var gfa = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer tfoot td[data-sum-col="V_AMOUNT"]'));
      R.chk.groupSumAvg = hasSet && gfa.length > 0 && gfa.every(function (td) { return td.getAttribute('data-sum-type') === 'avg' && /AVG/.test(td.textContent); })
        && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === groupsBefore;
      if (hasSet) window.Penumbra.setColSummary('V_AMOUNT', '');
      await sleep(300);
      R.chk.groupSumNone = hasSet && document.querySelectorAll('#groupedResultsContainer tfoot td[data-sum-col="V_AMOUNT"]').length === 0
        && document.querySelectorAll('#groupedResultsContainer .group-wrapper').length === groupsBefore;
      var gs = Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer td.pnb-cflt'));
      R.chk.filterInGroups = gs.length > 0;
      if (gs[0]) { var v = gs[0].textContent.trim(); gs[0].click(); await sleep(500); R.chk.groupClick = searchVal() === 'V_STATUS = //' + v + '//'; }
      R.info = { ga0: ga[0] && ga[0].outerHTML.slice(0, 140), feet: feet.slice(0, 3).map(function (s) { return s.textContent; }), gfa: gfa.length };
    },
    fheat: async function () {
      var cells = colCells('V_AMOUNT');
      var vals = window.__rowsFixture.map(function (r) { return cents(r.V_AMOUNT) / 100; }).sort(function (a, b) { return a - b; });
      var idx = 0.99 * (vals.length - 1), lo = Math.floor(idx), hi = Math.ceil(idx);
      var top = lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
      var bad = 0;
      cells.slice(0, 40).forEach(function (td) {
        var v = cents(td.getAttribute('data-pnb-raw')) / 100;
        var want = Math.round(Math.max(0, Math.min(1, v / top)) * 1000) / 10;
        var m = /,\s*transparent\s+([\d.]+)%/.exec(td.style.backgroundImage || '');
        // the value MUST be on the cell (number:0 changes every one of these), or NaN would pass
        if (!td.hasAttribute('data-pnb-raw') || !m || !(Math.abs(parseFloat(m[1]) - want) <= 0.05)) bad++;
      });
      R.chk.barsFromValues = cells.length >= 40 && bad === 0;
      R.chk.shownNoDollar = cells.slice(0, 20).every(function (td) { return /^[\d,]+$/.test(td.textContent); });
      R.info = { bad: bad, c0: cells[0] && cells[0].getAttribute('style') };
    },
    pvfmt: async function () { pivotCells('pvfmt'); },
    pvfmt2: async function () { pivotCells('pvfmt2'); },
    // values that land on rounding TIES (1.005, 2.675 ...): the page and the email must agree
    pvtie: async function () { pivotCells('pvtie'); R.chk.ran = R.info.texts.length > 20; },
    // ---- (2026-10-20 c) a pivot value's Highlight rules, through the REAL pivot builder (pvhl*)
    // pvhl: authored in a value's cog (Basic), Generate, re-edited, a rule on a column field, the
    // saved state
    pvhl: async function () {
      var P = pvKit();
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor'), red = probe('color: var(--accent-danger, #c62828)', 'color');
      // each step guarded: a missing control fails its own checks, never the page (a dead page
      // is no mutant kill)
      async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
      function rowAt(i) { return document.querySelectorAll('#pivot-agg-table-body tr')[i] || null; }
      function openCog(i) { var tr = rowAt(i), c = tr && tr.querySelector('.pat-cell-opt'); if (c) c.click(); return tr; }
      function q2(sel) { var p = popover(); return p ? p.querySelector(sel) : null; }
      async function done() { var d = hlQ('[data-co="hl-done"]'); if (d) d.click(); await sleep(60); closeAll(); await sleep(40); }
      var cols = [], cnt = '', want = -1, stored = null, gen = null, gen2 = null, fld = null, op = '', nStored = null, ah = null, was = '', items = 0;
      await step('author', async function () {
        window.__HC.repop();
        document.getElementById('pivotLightbox').style.display = 'block';
        await sleep(150);
        var amtTr = openCog(0);
        await sleep(120);
        R.chk.popHasHl = !!q2('[data-sec="highlight"] [data-co="hl-add"]') && !!q2('[data-sec="format"]') && !!q2('[data-sec="shade"]');
        var add = q2('[data-co="hl-add"]');
        if (!add) return;
        add.click();
        await sleep(100);
        var cs = hlQ('[data-co="hl-col"]'), os = hlQ('[data-co="hl-op"]'), v = hlQ('[data-co="hl-v"]');
        cols = cs ? Array.prototype.map.call(cs.options, function (o) { return o.value; }) : [];
        R.chk.editorPivot = !!hlEd() && !hlEd().querySelector('[data-sec="hl-to"]') && !!cs && cs.value === 'Amt'
          && cols.join() === 'Amt,N,Mean,H_GROUP,H_GROUP2,V_STATUS' && !!os && os.value === 'gt';
        if (!v) return;
        setInput(v, '900');
        await sleep(600);
        var ch = hlQ('[data-hint="hl-count"]');
        cnt = ch ? ch.textContent : '';
        want = P.body(0).filter(function (td) { return P.num(td) > 900; }).length;
        stored = JSON.parse((amtTr && amtTr.getAttribute('data-agg-hl')) || 'null');
        var oc = amtTr && amtTr.querySelector('.pat-cell-opt');
        R.chk.ruleStored = !!stored && stored.length === 1 && stored[0].w === 'Amt > 900' && stored[0].css === 'background-color: var(--pnb-hl-amber, #fbe8a6)'
          && !!oc && /RULE/.test(oc.textContent) && /a highlight rule/.test(oc.getAttribute('aria-label') || '');
        R.chk.editorCount = cnt === 'Matches ' + want + ' of ' + P.body(0).length + ' cells.' && want > 0;
        await done();
      });
      await step('generate', async function () {
        await P.generate();
        gen = P.iff(P.body(0), function (td) { return P.num(td) > 900; }, function (td) { return getComputedStyle(td).backgroundColor === amber; });
        R.chk.generated = gen.ok && gen.on > 0 && gen.off > 0;
      });
      // re-edited: the rule comes back with the pivot, changed, generated again
      await step('reedit', async function () {
        window.__HC.repop();
        await sleep(150);
        openCog(0);
        await sleep(120);
        var p = popover();
        items = p ? p.querySelectorAll('.pnb-hl-item').length : 0;
        var ed = q2('[data-co="hl-edit"]');
        if (!ed) return;
        ed.click();
        await sleep(120);
        var v = hlQ('[data-co="hl-v"]');
        if (!v) return;
        was = v.value;
        setInput(v, '1100');
        await sleep(600);
        await done();
        await P.generate();
        gen2 = P.iff(P.body(0), function (td) { return P.num(td) > 1100; }, function (td) { return getComputedStyle(td).backgroundColor === amber; });
        R.chk.reedit = items === 1 && was === '900' && gen2.ok && gen2.on > 0 && gen2.off > 0;
      });
      // a rule on N reading a COLUMN field: red text in the Open column
      await step('field', async function () {
        window.__HC.repop();
        await sleep(150);
        var nTr = openCog(1);
        await sleep(120);
        var add = q2('[data-co="hl-add"]');
        if (!add) return;
        add.click();
        await sleep(100);
        var cs = hlQ('[data-co="hl-col"]');
        if (!cs) return;
        setSel(cs, 'V_STATUS');
        await sleep(60);
        op = hlQ('[data-co="hl-op"]') ? hlQ('[data-co="hl-op"]').value : '';
        setInput(hlQ('[data-co="hl-v"]'), 'Open');
        await sleep(550);
        hlQ('[data-co="hl-tx"][data-k="red"]').click();
        hlQ('[data-co="hl-fl"][data-k=""]').click();
        await sleep(100);
        nStored = JSON.parse((nTr && nTr.getAttribute('data-agg-hl')) || 'null');
        await done();
        await P.generate();
        fld = P.iff(P.body(1), function (td) { return td.getAttribute('data-col-key') === 'Open'; }, function (td) { return getComputedStyle(td).color === red; });
        R.chk.fieldRule = op === 'is' && !!nStored && nStored[0].w === 'V_STATUS = //Open//' && nStored[0].css === 'color: var(--accent-danger, #c62828)'
          && fld.ok && fld.on > 0 && fld.off > 0;
      });
      // the pivot saved with them (a view link, a save, a preset all take the settings)
      await step('state', async function () {
        var st = window.__HC.bso();
        ah = st && st.pivot && st.pivot.aggHighlight;
        R.chk.stateCarries = Array.isArray(ah) && ah.length === 3 && !!ah[0] && ah[0][0].w === 'Amt > 1100' && !!ah[1] && ah[1][0].w === 'V_STATUS = //Open//' && ah[2] === null;
      });
      R.info = { notes: R.notes, cols: cols, cnt: cnt, want: want, stored: stored, gen: gen, gen2: gen2, fld: fld, op: op, nStored: nStored, ah: ah, was: was, items: items };
    },
    // pvhlseed: rules saved with the pivot - its cells, its group rows, never a Grand Total, the top
    // rule wins, a rule reading another value, a dark theme; the email's fixture
    pvhlseed: async function () {
      var P = pvKit();
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor'), blue = probe('background-color: var(--pnb-hl-blue, #d6e5fa)', 'backgroundColor');
      var red = probe('color: var(--accent-danger, #c62828)', 'color'), info = probe('color: var(--accent-info, #0b5cad)', 'color');
      var body = P.iff(P.body(0), function (td) { return P.num(td) > 900; }, function (td) { return getComputedStyle(td).backgroundColor === amber; });
      var top = P.body(0).filter(function (td) { return P.num(td) > 900; }).every(function (td) {
        return getComputedStyle(td).color === (P.num(td) > 1200 ? red : info);
      }) && P.body(0).some(function (td) { return P.num(td) > 1200; }) && P.body(0).some(function (td) { var v = P.num(td); return v > 900 && v <= 1200; });
      R.chk.seedBody = body.ok && body.on > 0 && body.off > 0;
      R.chk.seedTopWins = top;
      var sum = P.iff(P.sum(0), function (td) { return P.num(td) > 900; }, function (td) { return getComputedStyle(td).backgroundColor === amber; });
      R.chk.seedSummary = sum.ok && sum.on > 0;
      R.chk.seedGrand = body.ok && body.on > 0 && P.grand(0).length > 0 && P.grand(0).every(function (td) { return getComputedStyle(td).backgroundColor !== amber; })
        && P.grand(1).every(function (td) { return getComputedStyle(td).textDecorationLine.indexOf('underline') === -1; }) && P.grand(2).every(function (td) { return getComputedStyle(td).backgroundColor !== blue; });
      var fld = P.iff(P.body(1), function (td) { return td.getAttribute('data-col-key') === 'Open'; }, function (td) { return getComputedStyle(td).textDecorationLine.indexOf('underline') !== -1; });
      R.chk.seedField = fld.ok && fld.on > 0 && fld.off > 0;
      var oth = P.iff(P.body(2), function (td) { var a = P.sib(td, 0); return !!a && P.num(a) > 900; }, function (td) { return getComputedStyle(td).backgroundColor === blue; });
      R.chk.seedOther = oth.ok && oth.on > 0 && oth.off > 0;
      var st = window.__HC.bso();
      R.chk.seedState = !!st && !!st.pivot && JSON.stringify(st.pivot.aggHighlight) === JSON.stringify(window.__STORED.pivot.aggHighlight);
      // the email's fixture (test_colopt.php pivot): the texts each rule painted on the page's body cells
      function texts(list, test) { return list.filter(test).map(function (td) { return td.textContent.trim(); }).sort(); }
      R.info = {
        n: [P.body(0).length, P.sum(0).length, P.grand(0).length], body: body, sum: sum, fld: fld, oth: oth,
        rows: window.__rowsFixture.map(function (r) { return { H_GROUP: r.H_GROUP, H_GROUP2: r.H_GROUP2, V_STATUS: r.V_STATUS, H_AMT: r.H_AMT }; }),
        settings: window.__STORED.pivot,
        amber: texts(P.body(0), function (td) { return getComputedStyle(td).backgroundColor === amber; }),
        red: texts(P.body(0), function (td) { return getComputedStyle(td).color === red; }),
        under: texts(P.body(1), function (td) { return getComputedStyle(td).textDecorationLine.indexOf('underline') !== -1; }),
        blue: texts(P.body(2), function (td) { return getComputedStyle(td).backgroundColor === blue; })
      };
      // a dark theme: the fills are its own tints
      document.body.classList.add('is-dark');
      var darkAmber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      var hot = P.body(0).filter(function (td) { return P.num(td) > 900; })[0];
      R.chk.seedDark = darkAmber === 'rgb(77, 63, 18)' && !!hot && getComputedStyle(hot).backgroundColor === darkAmber;
      document.body.classList.remove('is-dark');
    },
    // pvhlnomod: the column options off (no module) - none drawn, none lost
    pvhlnomod: async function () {
      var P = pvKit(), amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      var st = window.__HC.bso();
      R.chk.offNotDrawn = !window.PenumbraColFmt && P.body(0).length > 0 && P.body(0).every(function (td) { return getComputedStyle(td).backgroundColor !== amber; });
      R.chk.offKept = !!st && !!st.pivot && JSON.stringify(st.pivot.aggHighlight) === JSON.stringify(window.__STORED.pivot.aggHighlight);
      // ...and through the builder: opened (its rows from the settings) and generated again
      window.__HC.repop();
      await sleep(150);
      await P.generate();
      var st2 = window.__HC.bso();
      R.chk.offRoundTrip = !!st2 && !!st2.pivot && JSON.stringify(st2.pivot.aggHighlight) === JSON.stringify(window.__STORED.pivot.aggHighlight)
        && P.body(0).length > 0 && P.body(0).every(function (td) { return getComputedStyle(td).backgroundColor !== amber; });
      R.info = { ah: st2 && st2.pivot && st2.pivot.aggHighlight };
    },
    pvcog: async function () {
      window.__HC.addAgg('sum', 'H_AMT', 'Amt', null, null, null, null);
      var tr = document.querySelector('#pivot-agg-table-body tr');
      var cog = tr && tr.querySelector('.pat-cell-opt');
      R.chk.cogDialog = !!cog && cog.getAttribute('aria-haspopup') === 'dialog';
      $(cog).trigger('click');   // the keyboard path (Enter/Space trigger a click)
      var pop = popover();
      var types = pop ? Array.prototype.map.call(pop.querySelectorAll('[data-co="type"] option'), function (o) { return o.value; }) : [];
      R.chk.popPivot = !!pop && types.join(',') === ',number,currency,percent' && !!pop.querySelector('[data-sec="shade"]') && !pop.querySelector('[data-co="filter"]') && !pop.querySelector('[data-co="pattern"]');
      R.chk.kbdFocus = !!pop && pop.contains(document.activeElement);
      var t = pop.querySelector('[data-co="type"]'), d = pop.querySelector('[data-co="dp"]');
      t.value = 'currency'; fire(t, 'change');
      d.value = '0'; fire(d, 'change');
      R.chk.fmtSet = tr.getAttribute('data-agg-fmt') === 'currency:0' && JSON.stringify(window.__HC.fmts()) === '["currency:0"]' && /\$/.test(cog.textContent);
      var bar = pop.querySelector('[data-co="shade"][value="bar"]');
      bar.checked = true; fire(bar, 'change');
      R.chk.shadeSet = tr.getAttribute('data-agg-shade') === 'bar' && /\$ BAR/.test(tr.querySelector('.pat-cell-opt').textContent) && !!popover();
      // Automatic with decimals = auto:N
      t.value = ''; fire(t, 'change'); d.value = '2'; fire(d, 'change');
      R.chk.autoDp = tr.getAttribute('data-agg-fmt') === 'auto:2';
      pop.querySelector('[data-co="reset"]').click();
      R.chk.resetBoth = !tr.hasAttribute('data-agg-fmt') && !tr.hasAttribute('data-agg-shade') && window.__HC.fmts() === null;
      R.info = { types: types, cog: tr.querySelector('.pat-cell-opt').outerHTML.slice(0, 200) };
    },
    fnomod: async function () {
      openPanel();
      await sleep(200);
      R.chk.oldChip = !!(item('V_AMOUNT') && item('V_AMOUNT').querySelector('.sp-col-shade')) && !document.querySelector('#spColumnList .sp-col-opts');
      // ...and the summary chip in the lane, its formula box, the Sigma over them; no cogs, no badges
      var sc = item('V_AMOUNT') && item('V_AMOUNT').querySelector('.sp-col-sumtype'), hs = document.querySelector('#spColumnList .sp-col-head .sph-sum');
      R.chk.oldSumChip = !!sc && sc.getAttribute('data-type') === 'sum' && item('V_AMOUNT').children[2] === sc && !!item('V_AMOUNT').querySelector('.sp-col-formula')
        && !document.querySelector('#spColumnList .sp-col-cog, #spColumnList .sp-col-badges') && !!hs && hs.getAttribute('data-rest') === 'Σ'
        && Math.round(sc.getBoundingClientRect().width) === 46;
      // ...and the Freeze select by the Columns heading (colopt c), no Freeze in any popover
      window.Penumbra.flatFreeze.apply();
      await sleep(100);
      var fw = document.getElementById('spFreezeWrap');
      R.chk.oldFreeze = !!fw && getComputedStyle(fw).display !== 'none';
      R.chk.rawCells = colCells('V_DATE').slice(0, 20).every(function (td) { return td.textContent === rowOf(td).V_DATE && !td.hasAttribute('data-pnb-raw'); });
      window.Penumbra.setColOpt('V_DATE', 'format', 'date:YYYY');
      R.chk.setNoop = colCells('V_DATE')[0].textContent === rowOf(colCells('V_DATE')[0]).V_DATE;
    },
    // screenshots (shots.py): the Settings panel with options set, a popover open
    shotpanel: async function () {
      ['saveStateLightbox', 'copyActionsLightbox', 'groupingLightbox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      window.Penumbra.setShade('V_AMOUNT', 'bar');
      window.Penumbra.setColOpt('V_STATUS', 'filter', true);
      if (window.Penumbra.setColSummary) window.Penumbra.setColSummary('V_STATUS', 'count_unique');
      if (/[?&]dark=1/.test(location.search)) document.body.classList.add('is-dark', 'theme-dark-blue');
      openPanel();
      await sleep(300);
      // &frz=N: freeze up to the Nth shown column, from its options (colopt c)
      var fz = /[?&]frz=(\d)/.exec(location.search);
      if (fz && window.Penumbra.freezeColumn) {
        var sr = Array.prototype.filter.call(document.querySelectorAll('#spColumnList .sp-col-item'), function (it) { var c = it.querySelector('.sp-col-check'); return c && c.checked; });
        var at = sr[parseInt(fz[1], 10) - 1];
        if (at) window.Penumbra.freezeColumn(at.getAttribute('data-colname'), true);
        await sleep(200);
      }
      var sel = /[?&]open=([A-Z_]+)/.exec(location.search);
      var chip = chipOf(sel ? sel[1] : 'V_DATE');
      if (chip) chip.click();
      await sleep(100);
      var pop = popover();
      if (pop && /[?&]date=1/.test(location.search)) {
        var t = pop.querySelector('[data-co="type"]'); t.value = 'date'; fire(t, 'change');
        var p = pop.querySelector('[data-co="pattern"]'); p.value = 'MMM D, YYYY'; fire(p, 'change');
      }
      if (pop && /[?&]fx=1/.test(location.search)) {
        var s = pop.querySelector('[data-co="sum"]'); s.value = 'formula'; fire(s, 'change');
        var x = pop.querySelector('[data-co="fx"]'); x.value = '{sum}/{filled}'; fire(x, 'input');
        await sleep(500);
      }
      await sleep(200);
      window.__SHOTREADY = true;
    },
    // (2026-10-20, hl) screenshots: three rules on V_AMOUNT, its popover's Highlight list;
    // &ed=N a rule's view (&ed=new a new one), &adv=1 its Advanced, &dark=1, &open=NONE the table
    shothl: async function () {
      ['saveStateLightbox', 'copyActionsLightbox', 'groupingLightbox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
      if (/[?&]dark=1/.test(location.search)) document.body.classList.add('is-dark', 'theme-dark-blue');
      window.Penumbra.setColOpt('V_AMOUNT', 'format', 'currency:0');
      window.Penumbra.setColOpt('V_AMOUNT', 'highlight', [
        { id: 'a1', w: 'V_AMOUNT > 80000', css: 'color: var(--accent-danger, #c62828); font-weight: bold', row: false },
        { id: 'a2', w: 'V_AMOUNT >= 40000 and V_AMOUNT <= 80000', css: 'background-color: var(--pnb-hl-amber, #fbe8a6)', row: false },
        { id: 'a3', w: 'V_STATUS = //Closed//', css: 'color: var(--text-muted, #6b6b6b); text-decoration: line-through', row: true }
      ]);
      await sleep(200);
      if (!/[?&]open=NONE/.test(location.search)) {
        openPanel();
        await sleep(300);
        chipOf('V_AMOUNT').click();
        await sleep(150);
        var ed = /[?&]ed=(new|\d)/.exec(location.search);
        if (ed) {
          if (ed[1] === 'new') popover().querySelector('[data-co="hl-add"]').click();
          else popover().querySelector('[data-co="hl-edit"][data-i="' + ed[1] + '"]').click();
          await sleep(250);
        }
        if (/[?&]adv=1/.test(location.search)) { hlQ('[data-co="hl-adv"]').click(); await sleep(150); }
      }
      await sleep(400);
      window.__SHOTREADY = true;
    },
    // hrnomod: the column options off (no module: the rollback switch, a failed load) - a save and a
    // view link carry the report's formats and rules on as it stores them
    hrnomod: async function () {
      var st = window.__STORED, n = window.__saves.length;
      $('#serverSaveIdInput').val('lrfix');
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n; }, 8000);
      await sleep(300);
      var sd = null;
      try { sd = JSON.parse(window.__saves[window.__saves.length - 1].state_data); } catch (e) { }
      R.chk.saveKeeps = !window.PenumbraColFmt && !!sd && JSON.stringify(sd.columnFormats) === JSON.stringify(st.columnFormats)
        && JSON.stringify(sd.columnHighlights) === JSON.stringify(st.columnHighlights);
      var sv = window.__HC.bso();
      R.chk.linkKeeps = !!sv && JSON.stringify(sv.columnFormats) === JSON.stringify(st.columnFormats) && JSON.stringify(sv.columnHighlights) === JSON.stringify(st.columnHighlights);
      R.info = { sd: sd && { f: sd.columnFormats, h: sd.columnHighlights }, sv: sv && { f: sv.columnFormats, h: sv.columnHighlights } };
    },
    // (2026-10-20 b) the report's rules (an hr* report): their own rule over the report's, one of
    // the report's off; a report rule opened by an editor; the Save dialog's list
    hrshot: async function () {
      ['copyActionsLightbox', 'groupingLightbox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
      var Q = location.search, sl = document.getElementById('saveStateLightbox');
      if (!/[?&]view=save/.test(Q) && sl) sl.style.display = 'none';
      if (/[?&]dark=1/.test(Q)) document.body.classList.add('is-dark', 'theme-dark-blue');
      window.Penumbra.setColOpt('V_AMOUNT', 'highlight', [{ id: 'n1', w: 'V_AMOUNT > 80000', css: 'color: var(--accent-danger, #c62828); font-weight: bold', row: false }]);
      if (!/[?&]view=save/.test(Q)) window.Penumbra.setColOpt('V_STATUS', 'highlightOff', ['r2']);
      if (/[?&]view=save/.test(Q)) {
        window.Penumbra.setColOpt('V_DATE', 'format', 'date:MMM D, YYYY');
        window.Penumbra.setColOpt('V_STATUS', 'highlightOff', ['r2']);
        document.getElementById('saveQuery').click();
        await sleep(400);
        sl.style.cssText = 'display:block; position:fixed; left:40px; top:40px; width:640px; background:var(--bg-surface, #fff); padding:12px;';
        Array.prototype.forEach.call(sl.children, function (c) { if (c.id !== 'lastStopCard') c.style.display = 'none'; });
        var card = document.getElementById('lastStopCard');
        card.classList.remove('collapsed');
        card.classList.add('sp-sumtype-menu');   // shots.py's close-up finds it by this class
      } else if (/[?&]view=(list|rule)/.test(Q)) {
        openPanel();
        await sleep(300);
        cogOf(/[?&]col=V_STATUS/.test(Q) ? 'V_STATUS' : 'V_AMOUNT').click();
        await sleep(150);
        if (/[?&]view=rule/.test(Q)) { popover().querySelector('[data-co="hl-redit"]').click(); await sleep(250); }
      }
      await sleep(400);
      window.__SHOTREADY = true;
    },
    hrviewshot: async function () {
      ['saveStateLightbox', 'copyActionsLightbox', 'groupingLightbox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
      openPanel();
      await sleep(300);
      cogOf('V_AMOUNT').click();
      await sleep(400);
      window.__SHOTREADY = true;
    },
    shotpivot: async function () {
      ['saveStateLightbox', 'copyActionsLightbox', 'groupingLightbox'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
      window.__HC.addAgg('sum', 'H_AMT', 'Amt', null, null, 'bar', 'currency:0');
      window.__HC.addAgg('avg', 'H_AMT', 'Mean', null, null, null, null);
      var tbl = document.getElementById('pivot-agg-table');
      tbl.style.cssText = 'position:fixed;top:60px;left:40px;width:520px;background:var(--bg-surface,#fff);z-index:5;border:1px solid #ccc';
      var cog = document.querySelectorAll('#pivot-agg-table-body .pat-cell-opt')[0];
      $(cog).trigger('click');
      await sleep(200);
      window.__SHOTREADY = true;
    },
    fparity: async function () {
      var F = window.PenumbraColFmt;
      var U = [
        ['1234.5', 'number', '1,234.5'], ['1234.5', 'number:2', '1,234.50'], ['-0.004', 'number:2', '0.00'], ['1.005', 'currency', '$1.01'],
        ['(1,234.5)', 'currency', '-$1,234.50'], ['0.125', 'percent', '12.5%'], ['12%', 'percent', '12%'], ['0.12345', 'percent:1', '12.3%'],
        ['00123', 'number', null], ['abc', 'currency', null], ['', 'number', null], ['1e5', 'number', null], ['999.995', 'currency', '$1,000.00'],
        ['-999.995', 'currency:2', '-$1,000.00'], ['$-12.5', 'number:0', '-13'], ['-$1,234,567.891', 'number', '-1,234,567.891'], ['12,34', 'number', null],
        ['10/5/2026', 'date:YYYY-MM-DD', '2026-10-05'], ['2026-10-05 14:30:05', 'date:MM/DD/YYYY h:mm A', '10/05/2026 2:30 PM'],
        ['05-OCT-26 02.30.05.000000 PM', 'date:YYYY-MM-DD HH:mm:ss', '2026-10-05 14:30:05'], ['October 5, 2026', 'date:ddd', 'Mon'],
        ['2/30/2026', 'date:YYYY', null], ['2026-10-05', 'date:[Q]Q YYYY', 'Q4 2026'], ['2026-10-01', 'date:Do', '1st'], ['2026-10-11', 'date:Do', '11th'],
        ['2026-10-22', 'date:Do', '22nd'], ['12/31/69', 'date:YYYY', '2069'], ['12/31/70', 'date:YYYY', '1970'], ['2026-10-05T23:59:59Z', 'date:hh:mm a', '11:59 pm'],
        ['2026-10-05 12:00', 'date:h A', '12 PM'], ['2026-10-05 00:00', 'date:h a', '12 am'], ['2026-10-05', 'date:MMM <D>', null], ['2026-10-05', 'number:7', null],
        ['1234', 'auto:2', null], ['13/1/2026', 'date:YYYY', null], ['2026-10-05 24:00', 'date:YYYY', null], ['Oct 5 2026 2:30 pm', 'date:HH:mm', '14:30'],
        ['1/2/2026 12:30 AM', 'date:HH:mm', '00:30'], ['1/2/2026 12:30 PM', 'date:HH:mm', '12:30']
      ];
      var bad = U.filter(function (u) { return F.formatValue(u[0], u[1]) !== u[2]; }).map(function (u) { return u.join(' | ') + ' -> ' + F.formatValue(u[0], u[1]); });
      R.chk.units = bad.length === 0;
      R.chk.specs = F.parseSpec('auto') === null && F.cleanSpec('auto:2') === 'auto:2' && F.cleanSpec('CURRENCY:2') === 'currency:2' && F.cleanSpec('date:MMM D') === 'date:MMM D' && F.cleanSpec('date:') === '';
      // the pivot's fixed decimals, rounded on the decimal text (twin: pivot_dec_text)
      var DT = [[120.1525, 1, true, '12,015.3'], [2.675, 2, false, '2.68'], [-0.004, 2, false, '0.00'], [999.995, 2, false, '1,000.00'],
                [-1234.5, 0, false, '-1,235'], [0.125, 0, true, '13'], [1e-7, 2, false, '0.00'], [9.995, 1, false, '10.0'], [0, 2, true, '0.00'],
                [123456789.125, 2, false, '123,456,789.13'], [0.1 + 0.2, 1, false, '0.3'], [7, 3, false, '7.000']];
      var dtBad = window.__HC.decText ? DT.filter(function (c) { return window.__HC.decText(c[0], c[1], c[2]) !== c[3]; }).map(function (c) { return c.join(' ') + ' -> ' + window.__HC.decText(c[0], c[1], c[2]); }) : ['no _pnbDecText'];
      R.chk.decText = dtBad.length === 0;
      var kd = F.kindsOf(['1', '2', '3', '4', 'x']), kt = F.kindsOf(['10/5/2026', '2026-01-02', 'Oct 5, 2026', 'n/a', '1/1/2020']);
      R.chk.kinds = kd.num === true && kd.date === false && kt.date === true && kt.num === false;
      // the date answers the PHP twin must give (run.py hands them over)
      var RAW = ['2026-10-05', '10/5/2026', '1/31/1999 11:05:09 PM', '05-OCT-26', '29-FEB-24 12.00.00.000000 AM', 'October 5, 2026', 'Sep 9 2025 9:07 am',
                 '2026-10-05T07:08:09.5-05:00', '2/29/2023', '12/31/69', '2026-1-2 3:04', '13/13/2013', ' 2026-10-05 ', 'not a date', '', '2026-10-05 25:00', '7/4/1776'];
      var PAT = ['YYYY-MM-DD', 'MM/DD/YY', 'M/D/YYYY', 'MMM D, YYYY', 'MMMM D, YYYY', 'dddd, MMMM Do, YYYY', 'ddd DD-MMM-YYYY', 'YYYY [Q]Q', 'h:mm:ss A',
                 'HH:mm', 'hh:mm a', 'YY.M.D H:m:s', "[Week of] MMM D 'YY", 'D/M/YYYY (dddd)'];
      var out = [];
      RAW.forEach(function (r) { PAT.forEach(function (p) { out.push([r, p, F.formatValue(r, 'date:' + p)]); }); });
      // calculated columns: the engine's value through the date format, as the page shows it
      var C = window.PenumbraCalc, rowsC = [{ D: '10/5/2026', S: 'Oct 5, 2026 2:30 PM', N: '42', T: 'x' }, { D: '2/29/2024', S: '', N: '-1.5', T: "O'B" }];
      var FORM = ['{D} + 30', 'DAYS({D}, "1/1/2026")', '{S}', '{N}', '"<b>" & {T} & "</b>"', 'IF({N} > 0, {D}, "none")', 'TODAY() - TODAY()', '{D}'];
      var calc = [];
      rowsC.forEach(function (row) {
        FORM.forEach(function (f) {
          ['date:MMM D, YYYY', 'date:YYYY-MM-DD HH:mm', 'text'].forEach(function (fmt) {
            var cc = C.compile(f);
            var v = cc.ok ? C.evaluate(cc.ast, function (n) { return row[n]; }, fmt) : '';
            var shown = /^date:/.test(fmt) ? (F.formatValue(v, fmt) === null ? v : F.formatValue(v, fmt)) : v;
            calc.push([f, fmt, row, shown]);
          });
        });
      });
      R.info = { bad: bad, dtBad: dtBad, dates: out, calc: calc, decText: DT };
      R.chk.ran = out.length === RAW.length * PAT.length;
    },
    // (2026-10-15, WCAG) the sort lanes' names start with their words and end with their
    // state (2.5.3 / 4.1.2); the Theme / Density hint links are keyboard buttons (2.1.1)
    // (2026-10-20, hl) the module's rule text: Basic's forms written and read back, what
    // is not Basic (Custom), the CSS gate, Basic's style picks, the words, a stored list
    fhlunit: async function () {
      var F = window.PenumbraColFmt;
      var kind = function (c) { return c === 'V_DATE' ? 'date' : (c === 'V_AMOUNT' || c === 'MY COL' || c === 'AND') ? 'num' : 'text'; };
      var cases = [
        [{ col: 'V_AMOUNT', op: 'gt', v: '1000' }, 'V_AMOUNT > 1000'],
        [{ col: 'V_AMOUNT', op: 'gte', v: '$1,000.50' }, 'V_AMOUNT >= 1000.50', { v: '1000.50' }],
        [{ col: 'V_AMOUNT', op: 'lt', v: '-.5' }, 'V_AMOUNT < -0.5', { v: '-0.5' }],
        [{ col: 'V_AMOUNT', op: 'ne', v: '0' }, 'V_AMOUNT != 0'],
        [{ col: 'V_AMOUNT', op: 'between', v: '10', v2: '20' }, 'V_AMOUNT >= 10 and V_AMOUNT <= 20'],
        [{ col: 'V_DATE', op: 'before', v: '10/5/2026' }, 'V_DATE < 2026-10-05', { v: '2026-10-05' }],
        [{ col: 'V_DATE', op: 'onafter', v: 'today-30' }, 'V_DATE >= TODAY-30', { v: 'TODAY-30' }],
        [{ col: 'V_DATE', op: 'between', v: '2026-01-01', v2: 'TODAY' }, 'V_DATE >= 2026-01-01 and V_DATE <= TODAY'],
        [{ col: 'V_DATE', op: 'last', v: '30' }, 'V_DATE >= TODAY-30 and V_DATE <= TODAY'],
        [{ col: 'V_DATE', op: 'next', v: '7' }, 'V_DATE >= TODAY and V_DATE <= TODAY+7'],
        [{ col: 'V_STATUS', op: 'is', v: 'In Progress' }, 'V_STATUS = //In Progress//'],
        [{ col: 'V_STATUS', op: 'isnot', v: 'a//b' }, 'V_STATUS != /^a\\x2F\\x2Fb$/'],
        [{ col: 'V_STATUS', op: 'contains', v: 'Pend' }, 'V_STATUS contains Pend'],
        [{ col: 'V_STATUS', op: 'contains', v: 'empty' }, 'V_STATUS = /empty/'],
        [{ col: 'V_STATUS', op: 'contains', v: "O'Brien (x)" }, "V_STATUS = /O'Brien \\(x\\)/"],
        [{ col: 'V_STATUS', op: 'notcontains', v: 'x/y' }, 'V_STATUS != /x\\x2Fy/'],
        [{ col: 'V_STATUS', op: 'starts', v: 'Op' }, 'V_STATUS = /^Op/'],
        [{ col: 'V_STATUS', op: 'empty' }, 'V_STATUS = empty'],
        [{ col: 'V_STATUS', op: 'notempty' }, 'V_STATUS != empty'],
        [{ col: 'V_STATUS', op: 'always' }, ''],
        [{ col: 'MY COL', op: 'gt', v: '5' }, '{MY COL} > 5'],
        [{ col: 'AND', op: 'gt', v: '5' }, '{AND} > 5']
      ];
      var badW = [], badR = [];
      cases.forEach(function (c) {
        var p = c[0], w = F.hlWhen({ col: p.col, op: p.op, v: p.v, v2: p.v2, kind: kind(p.col) });
        if (w !== c[1]) badW.push([c[1], w]);
        var want = p.op === 'always' ? { col: '', op: 'always', v: '', v2: '' } : Object.assign({ col: p.col, op: p.op, v: p.v || '', v2: p.v2 || '' }, c[2] || {});
        var back = F.hlWhenPicks(w, kind);
        if (JSON.stringify(back) !== JSON.stringify(want)) badR.push([w, back, want]);
      });
      R.chk.whenForms = badW.length === 0;
      R.chk.whenRound = badR.length === 0;
      var nulls = [
        F.hlWhen({ col: 'V_AMOUNT', op: 'gt', v: 'abc', kind: 'num' }),
        F.hlWhen({ col: 'V_AMOUNT', op: 'between', v: '1', v2: '', kind: 'num' }),
        F.hlWhen({ col: 'V_DATE', op: 'before', v: '2/30/2026', kind: 'date' }),
        F.hlWhen({ col: 'V_DATE', op: 'last', v: '0', kind: 'date' }),
        F.hlWhen({ col: 'V_STATUS', op: 'is', v: '  ', kind: 'text' }),
        F.hlWhen({ col: 'A=B', op: 'gt', v: '1', kind: 'num' })
      ];
      var customs = ['V_AMOUNT > 5 and V_STATUS = //Open//', '{V_AMOUNT} > 5', 'V_STATUS = /^Op.*/', 'V_AMOUNT > 5 or V_AMOUNT < 1', 'Open',
        'V_AMOUNT > TODAY', 'V_DATE != 2026-01-01', 'V_STATUS = //a//b//'];
      var custBad = customs.filter(function (w) { return F.hlWhenPicks(w, kind) !== null; });
      R.chk.whenNull = nulls.every(function (x) { return x === null; }) && custBad.length === 0;
      var c1 = F.cleanCss("color: red; padding: 4px; background-color: url(x.png); font-family: 'Segoe UI', Arial; COLOR: blue; border: 1px solid var(--x, #fff); bold");
      R.chk.cssGate = c1.css === "color: blue; font-family: 'Segoe UI', Arial; border: 1px solid var(--x, #fff)" && c1.dropped.join() === 'padding,bold' && c1.bad.join() === 'background-color'
        && F.cleanCss('color: red" onmouseover="x').css === '' && F.cleanCss('color: expression(alert(1))').css === '' && F.cleanCss('transform: rotate(3deg').css === ''
        && F.cleanCss('color: rgb(1, 2, 3) !important').css === 'color: rgb(1, 2, 3) !important' && F.cleanCss('font-size: 12px; /* x */').css === 'font-size: 12px'
        && F.cleanCss('border-left: 2px solid red; text-transform: uppercase').css === 'border-left: 2px solid red; text-transform: uppercase';
      var css = F.hlCss({ tx: 'red', fl: 'amber', b: true, s: true });
      var pk = F.hlCssPicks(css), pk2 = F.hlCssPicks('color: #123456; font-weight: 700; border: 1px solid red');
      R.chk.cssPicks = css === 'color: var(--accent-danger, #c62828); background-color: var(--pnb-hl-amber, #fbe8a6); font-weight: bold; text-decoration: line-through'
        && pk.tx === 'red' && pk.fl === 'amber' && pk.b && !pk.i && pk.s && pk.other === 0
        && pk2.tx === '*' && pk2.fl === '' && pk2.b && pk2.other === 2;
      var d = [
        F.hlDescribe({ w: 'V_AMOUNT > 1000000', css: 'color: red', row: false }, kind, 'V_AMOUNT'),
        F.hlDescribe({ w: 'V_STATUS = //Closed//', css: 'color: red', row: true }, kind, 'V_AMOUNT'),
        F.hlDescribe({ w: 'V_DATE >= TODAY-30 and V_DATE <= TODAY', css: 'color: red', row: false }, kind, 'V_DATE'),
        F.hlDescribe({ w: 'V_AMOUNT >= 10 and V_AMOUNT <= 2000', css: 'color: red', row: false }, kind, 'V_AMOUNT'),
        F.hlDescribe({ w: '', css: 'color: red', row: true }, kind, 'V_AMOUNT'),
        F.hlDescribe({ w: 'V_AMOUNT > 5 and V_STATUS = //Open//', css: 'color: red', row: false }, kind, 'V_AMOUNT')
      ];
      R.chk.describe = d.join('|') === 'Is greater than 1,000,000|V_STATUS is Closed, whole row|Is in the last 30 days|Is between 10 and 2,000|Every row|V_AMOUNT > 5 and V_STATUS = //Open//';
      var many = [];
      for (var i = 0; i < 12; i++) many.push({ id: 'z' + i, w: '', css: 'color: blue' });
      var cl = F.hlClean([{ id: 'a1', w: 'X > 1', css: 'color: red', row: true }, { id: 'a1', w: 'X > 2', css: 'padding: 3px' }, null,
        { w: 7, css: 'font-weight: bold', row: 'yes' }].concat(many));
      R.chk.cleanList = cl.length === 10 && cl[0].id === 'a1' && cl[0].row === true && cl[1].w === '' && cl[1].row === false && cl[1].css === 'font-weight: bold'
        && cl[1].id !== 'a1' && /^[a-z0-9]{1,16}$/.test(cl[1].id) && cl[9].id === 'z7';
      R.info = { badW: badW, badR: badR, custBad: custBad, c1: c1, css: css, pk: pk, pk2: pk2, d: d, cl: cl.slice(0, 3) };
    },
    // (2026-10-20, hl) authored through the popover, the way a viewer does it
    fhl: async function () {
      openPanel();
      await sleep(450);
      cogOf('V_AMOUNT').click();
      var pop = popover();
      var secs = pop ? Array.prototype.filter.call(pop.children, function (n) { return n.classList.contains('pnb-colopt-sec'); }).map(function (s) { return s.getAttribute('data-sec'); }).join() : '';
      var hsec = pop && pop.querySelector('[data-sec="highlight"]'), add = hsec && hsec.querySelector('[data-co="hl-add"]');
      R.chk.popHasHl = secs === 'summary,format,shade,highlight,filter,freeze' && !!add && /^\+ Add a rule$/.test(add.textContent)
        && hsec.querySelector('.pnb-colopt-lbl').textContent.trim() === 'Highlight' && hsec.querySelectorAll('.pnb-hl-item').length === 0;
      // Add a rule: its own view in the popover's place; nothing stored until it reads
      add.click();
      await sleep(80);
      var ed = hlEd(), opSel = hlQ('[data-co="hl-op"]');
      var mainHidden = !!ed && Array.prototype.every.call(pop.children, function (n) { return n === ed || n.style.display === 'none'; });
      R.chk.addOpens = isShown(ed) && mainHidden && document.activeElement === opSel && /^New highlight rule$/.test(ed.querySelector('.pnb-colopt-title').textContent)
        && !hlRules('V_AMOUNT') && /^Type a number\.$/.test(hlQ('.pnb-hl-msg').textContent) && !hlQ('.pnb-hl-msg').classList.contains('is-bad')
        && hlQ('[data-co="hl-col"]').value === 'V_AMOUNT' && /\(this column\)$/.test(hlQ('[data-co="hl-col"]').options[0].textContent);
      var ops = opSel ? Array.prototype.map.call(opSel.options, function (o) { return o.value; }).join() : '';
      R.chk.opsNum = ops === 'gt,gte,lt,lte,eq,ne,between,empty,notempty,always';
      // a value: the rule is stored and drawn - the new rule's style is the amber fill
      setInput(hlQ('[data-co="hl-v"]'), '50,000');
      await sleep(550);
      var want = window.__rowsFixture.filter(function (r) { return amtOf(r) > 50000; }).length;
      var rs = hlRules('V_AMOUNT'), cnt = hlQ('[data-hint="hl-count"]').textContent;
      R.chk.typeValue = !!rs && rs.length === 1 && rs[0].w === 'V_AMOUNT > 50000' && rs[0].css === 'background-color: var(--pnb-hl-amber, #fbe8a6)' && rs[0].row === false
        && cnt === 'Matches ' + want + ' of 300 rows.' && hlQ('.pnb-hl-msg').textContent === '';
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      var cells = colCells('V_AMOUNT', true);
      var badP = cells.filter(function (td) { return (amtOf(rowOf(td)) > 50000) !== (getComputedStyle(td).backgroundColor === amber); });
      R.chk.cellsPainted = cells.length === 300 && badP.length === 0 && want > 20 && want < 280;
      // Basic's style: Text red, Font bold - each in its place in the rule's CSS
      hlQ('[data-co="hl-tx"][data-k="red"]').click();
      hlQ('[data-co="hl-b"]').click();
      await sleep(80);
      rs = hlRules('V_AMOUNT');
      var red = probe('color: var(--accent-danger, #c62828)', 'color');
      var on1 = cells.filter(function (td) { return amtOf(rowOf(td)) > 50000; })[0], off1 = cells.filter(function (td) { return amtOf(rowOf(td)) <= 50000; })[0];
      R.chk.swatchFont = rs[0].css === 'background-color: var(--pnb-hl-amber, #fbe8a6); color: var(--accent-danger, #c62828); font-weight: bold'
        && getComputedStyle(on1).color === red && getComputedStyle(on1).fontWeight === '700' && getComputedStyle(off1).color !== red && getComputedStyle(off1).fontWeight !== '700'
        && hlQ('[data-co="hl-tx"][data-k="red"]').getAttribute('aria-checked') === 'true' && hlQ('[data-co="hl-b"]').getAttribute('aria-pressed') === 'true'
        && getComputedStyle(hlQ('.pnb-hl-prev')).color === red;
      // a swatch row is one Tab stop; the arrows move the pick
      var txs = Array.prototype.slice.call(hlEd().querySelectorAll('[data-co="hl-tx"]'));
      var stops = txs.filter(function (b) { return b.tabIndex === 0; });
      var redB = hlQ('[data-co="hl-tx"][data-k="red"]');
      redB.focus();
      redB.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      await sleep(80);
      var amberB = hlQ('[data-co="hl-tx"][data-k="amber"]');
      R.chk.swatchKeys = stops.length === 1 && stops[0] === redB && document.activeElement === amberB && amberB.getAttribute('aria-checked') === 'true'
        && /color: var\(--accent-warning/.test(hlRules('V_AMOUNT')[0].css) && amberB.tabIndex === 0 && redB.tabIndex === -1;
      redB.click();
      await sleep(60);
      // Tab leaves the row: the next stop is the Fill row's picked swatch
      redB.focus();
      redB.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      await sleep(40);
      var fillStop = Array.prototype.filter.call(hlEd().querySelectorAll('[data-co="hl-fl"]'), function (b) { return b.tabIndex === 0; });
      R.chk.tabStops = fillStop.length === 1 && document.activeElement === fillStop[0] && fillStop[0].getAttribute('data-k') === 'amber';
      // Advanced: the rule as text
      hlQ('[data-co="hl-adv"]').click();
      await sleep(40);
      var wIn = hlQ('[data-co="hl-w"]'), cIn = hlQ('[data-co="hl-css"]');
      R.chk.advShows = isShown(wIn) && wIn.value === 'V_AMOUNT > 50000' && cIn.value === hlRules('V_AMOUNT')[0].css && hlQ('[data-co="hl-adv"]').getAttribute('aria-expanded') === 'true';
      // CSS of your own: what the format pass would not apply is named, and left out
      cIn.focus();
      setInput(cIn, 'color: #123456; padding: 4px');
      await sleep(550);
      rs = hlRules('V_AMOUNT');
      R.chk.advCss = rs[0].css === 'color: #123456' && /Not applied: padding/.test(hlQ('.pnb-hl-msg').textContent) && hlQ('.pnb-hl-msg').classList.contains('is-bad')
        && getComputedStyle(on1).color === 'rgb(18, 52, 86)' && getComputedStyle(on1).backgroundColor !== amber
        && txs.every(function (b) { return b.getAttribute('aria-checked') === 'false'; }) && /Plus CSS of your own/.test(hlQ('[data-hint="hl-other"]').textContent);
      // a value that could break out of the style attribute is refused; the rule as it was
      setInput(cIn, 'color: red" onmouseover="window.__pwned=1');
      await sleep(550);
      R.chk.cssRefused = hlRules('V_AMOUNT')[0].css === 'color: #123456' && /Not a value it takes: color/.test(hlQ('.pnb-hl-msg').textContent)
        && !window.__pwned && getComputedStyle(on1).color === 'rgb(18, 52, 86)';
      // a property the rule stops setting comes off the cells (the format pass's reset
      // takes every property a rule may set)
      setInput(cIn, 'color: #123456; text-transform: uppercase');
      await sleep(550);
      var upOn = getComputedStyle(on1).textTransform === 'uppercase';
      setInput(cIn, 'color: #123456');
      await sleep(550);
      R.chk.cssClears = upOn && getComputedStyle(on1).textTransform === 'none' && on1.style.textTransform === '' && hlRules('V_AMOUNT')[0].css === 'color: #123456';
      // a condition of your own (filter box syntax): Basic says Custom
      wIn.focus();
      setInput(wIn, 'V_AMOUNT > 50000 and V_STATUS = //Open//');
      await sleep(550);
      rs = hlRules('V_AMOUNT');
      var badC = cells.filter(function (td) { var r = rowOf(td); return (amtOf(r) > 50000 && r.V_STATUS === 'Open') !== (getComputedStyle(td).color === 'rgb(18, 52, 86)'); });
      R.chk.advCond = rs[0].w === 'V_AMOUNT > 50000 and V_STATUS = //Open//' && opSel.value === 'custom' && badC.length === 0
        && hlQ('[data-co="hl-col"]').disabled && hlQ('[data-show="hl-v"]').style.display === 'none';
      // a pattern that cannot be read: said in red, the rule as it was
      setInput(wIn, 'V_STATUS = /([/');
      await sleep(550);
      R.chk.badCond = hlRules('V_AMOUNT')[0].w === 'V_AMOUNT > 50000 and V_STATUS = //Open//' && hlQ('.pnb-hl-msg').classList.contains('is-bad')
        && /pattern/.test(hlQ('.pnb-hl-msg').textContent);
      // back to a form Basic writes: Basic shows it again
      setInput(wIn, 'V_AMOUNT > 50000');
      await sleep(550);
      R.chk.backToBasic = opSel.value === 'gt' && hlQ('[data-co="hl-v"]').value === '50000' && !hlQ('[data-co="hl-col"]').disabled
        && !opSel.querySelector('option[value="custom"]') && hlRules('V_AMOUNT')[0].w === 'V_AMOUNT > 50000';
      // Apply to: Whole row
      var rowR = hlQ('[data-co="hl-to"][value="row"]');
      rowR.checked = true;
      fire(rowR, 'change');
      await sleep(80);
      rs = hlRules('V_AMOUNT');
      var badR = cells.filter(function (td) { return (amtOf(rowOf(td)) > 50000) !== (td.parentNode.style.color !== ''); });
      R.chk.rowApply = rs[0].row === true && badR.length === 0 && cells.every(function (td) { return td.style.color === ''; });
      // Done: the list, the rule in words; the badge
      hlQ('[data-co="hl-done"]').click();
      await sleep(80);
      var items = pop.querySelectorAll('[data-sec="highlight"] .pnb-hl-item'), ib = items[0] && items[0].querySelector('[data-co="hl-edit"]');
      R.chk.doneBack = !hlEd() && items.length === 1 && !!ib && ib.textContent === 'Is greater than 50,000, whole row' && document.activeElement === ib
        && Array.prototype.every.call(pop.children, function (n) { return n.style.display !== 'none'; });
      var bv = badgesOf('V_AMOUNT');
      R.chk.badge = bv.some(function (b) { return b.t === 'RULE' && b.own; }) && cogOf('V_AMOUNT').classList.contains('is-custom')
        && /Highlight: Is greater than 50,000, whole row/.test(item('V_AMOUNT').querySelector('.sp-col-badges').getAttribute('title') || '');
      // back to a cell rule, then a second rule, green text on 40,000 to 60,000: it goes on
      // top, and where both match it wins
      ib.click();
      await sleep(80);
      var cellR = hlQ('[data-co="hl-to"][value="cell"]');
      cellR.checked = true;
      fire(cellR, 'change');
      await sleep(60);
      hlQ('[data-co="hl-done"]').click();
      await sleep(60);
      pop.querySelector('[data-co="hl-add"]').click();
      await sleep(80);
      setSel(hlQ('[data-co="hl-op"]'), 'between');
      var bothShown = isShown(hlQ('[data-co="hl-v2"]')) && isShown(hlQ('.pnb-hl-and'));
      setInput(hlQ('[data-co="hl-v"]'), '40000');
      setInput(hlQ('[data-co="hl-v2"]'), '60000');
      await sleep(550);
      hlQ('[data-co="hl-tx"][data-k="green"]').click();
      hlQ('[data-co="hl-fl"][data-k=""]').click();
      await sleep(80);
      rs = hlRules('V_AMOUNT');
      var green = probe('color: var(--accent-success, #1a7f37)', 'color');
      var badT = cells.filter(function (td) {
        var a = amtOf(rowOf(td)), c = getComputedStyle(td).color;
        if (a >= 40000 && a <= 60000) return c !== green;
        if (a > 50000) return c !== 'rgb(18, 52, 86)';
        return c === green || c === 'rgb(18, 52, 86)';
      });
      R.chk.topWins = bothShown && rs.length === 2 && rs[0].w === 'V_AMOUNT >= 40000 and V_AMOUNT <= 60000' && rs[0].css === 'color: var(--accent-success, #1a7f37)'
        && rs[1].w === 'V_AMOUNT > 50000' && rs[1].row === false && badT.length === 0;
      // opened again, Basic reads the rule back
      hlQ('[data-co="hl-done"]').click();
      await sleep(60);
      pop.querySelector('[data-co="hl-edit"][data-i="0"]').click();
      await sleep(80);
      R.chk.reopen = hlQ('[data-co="hl-op"]').value === 'between' && hlQ('[data-co="hl-v"]').value === '40000' && hlQ('[data-co="hl-v2"]').value === '60000'
        && hlQ('[data-co="hl-tx"][data-k="green"]').getAttribute('aria-checked') === 'true' && hlQ('[data-co="hl-fl"][data-k=""]').getAttribute('aria-checked') === 'true'
        && hlQ('.pnb-hl-advbox').style.display === 'none' && /^Highlight rule$/.test(hlQ('.pnb-colopt-title').textContent) && hlQ('[data-co="hl-delete"]').textContent === 'Delete rule';
      // Delete rule: gone from the cells and the list
      hlQ('[data-co="hl-delete"]').click();
      await sleep(100);
      rs = hlRules('V_AMOUNT');
      R.chk.deleteRule = !hlEd() && !!rs && rs.length === 1 && rs[0].w === 'V_AMOUNT > 50000' && cells.every(function (td) { return getComputedStyle(td).color !== green; })
        && pop.querySelectorAll('[data-sec="highlight"] .pnb-hl-item').length === 1;
      // Escape from a rule's view closes the popover; the rule stays
      pop.querySelector('[data-co="hl-edit"][data-i="0"]').click();
      await sleep(80);
      var t = hlQ('[data-co="hl-op"]');
      t.focus();
      t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(100);
      R.chk.escCloses = !popover() && !!hlRules('V_AMOUNT') && hlRules('V_AMOUNT').length === 1 && cells.some(function (td) { return td.style.color !== ''; });
      // Reset: the rules go with the rest, and their styles off every cell
      cogOf('V_AMOUNT').click();
      await sleep(80);
      popover().querySelector('[data-co="reset"]').click();
      await sleep(100);
      R.chk.resetClears = !hlRules('V_AMOUNT') && popover().querySelectorAll('.pnb-hl-item').length === 0
        && cells.every(function (td) { return td.style.color === '' && td.parentNode.style.color === ''; }) && !badgesOf('V_AMOUNT').some(function (b) { return b.t === 'RULE'; });
      // a text column: its operators; "is" writes the filter box's exact match (any case)
      closeAll();
      await sleep(60);
      cogOf('V_STATUS').click();
      await sleep(80);
      popover().querySelector('[data-co="hl-add"]').click();
      await sleep(80);
      var ops2 = Array.prototype.map.call(hlQ('[data-co="hl-op"]').options, function (o) { return o.value; }).join();
      setInput(hlQ('[data-co="hl-v"]'), 'closed');
      await sleep(550);
      rs = hlRules('V_STATUS');
      var stc = colCells('V_STATUS', true);
      R.chk.textIs = ops2 === 'is,isnot,contains,notcontains,starts,empty,notempty,always' && !!rs && rs[0].w === 'V_STATUS = //closed//'
        && stc.length === 300 && stc.every(function (td) { return (rowOf(td).V_STATUS === 'Closed') === (getComputedStyle(td).backgroundColor === amber); });
      // a date column: before a date typed the US way
      closeAll();
      await sleep(60);
      cogOf('V_DATE').click();
      await sleep(80);
      popover().querySelector('[data-co="hl-add"]').click();
      await sleep(80);
      var ops3 = Array.prototype.map.call(hlQ('[data-co="hl-op"]').options, function (o) { return o.value; }).join();
      var ph = hlQ('[data-co="hl-v"]').getAttribute('placeholder');
      setInput(hlQ('[data-co="hl-v"]'), '1/1/2023');
      await sleep(550);
      rs = hlRules('V_DATE');
      var dtc = colCells('V_DATE', true);
      R.chk.dateBefore = ops3 === 'before,after,onbefore,onafter,on,between,last,next,empty,notempty,always' && /TODAY/.test(ph || '') && !!rs && rs[0].w === 'V_DATE < 2023-01-01'
        && dtc.length === 300 && dtc.every(function (td) { return (ymd(rowOf(td)) < 20230101) === (getComputedStyle(td).backgroundColor === amber); });
      closeAll();
      R.info = { secs: secs, ops: ops, ops2: ops2, ops3: ops3, rs: rs, cnt: cnt, want: want, badP: badP.length, badC: badC.length, badR: badR.length, badT: badT.length,
        prefs: colopt(), msg: hlEd() ? hlQ('.pnb-hl-msg').textContent : null };
    },
    // (2026-10-20, hl) rules saved before the report opens (mk_harness SEED), with the
    // column's shading on (a color scale)
    fhlseed: async function () {
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      function cellAmt(td) { return cents(td.getAttribute('data-pnb-raw') || td.textContent) / 100; }
      function rowStatus(tr) { return tr.children[hdrIndex('V_STATUS')].textContent.trim(); }
      function amtOk() {
        var cells = colCells('V_AMOUNT', true);
        return cells.length === 300 && cells.every(function (td) {
          var a = cellAmt(td), cs = getComputedStyle(td);
          if (a > 80000) return cs.color === 'rgb(0, 0, 255)' && cs.backgroundColor === amber;
          if (a > 50000) return cs.color === 'rgb(255, 0, 0)' && cs.backgroundColor === amber;
          return cs.color !== 'rgb(0, 0, 255)' && cs.color !== 'rgb(255, 0, 0)' && cs.backgroundColor !== amber;
        });
      }
      function rowsOk() {
        var cells = colCells('V_STATUS', true);
        return cells.length === 300 && cells.every(function (td) { return (rowStatus(td.parentNode) === 'Closed') === /line-through/.test(td.parentNode.style.textDecoration || ''); });
      }
      function namesOk() {
        var cells = colCells('V_NAME', true);
        return cells.length === 300 && cells.every(function (td) { return (rowStatus(td.parentNode) === 'Pending') === (getComputedStyle(td).fontStyle === 'italic'); });
      }
      // drawn at once; the top rule wins where both set the color
      R.chk.drawnAtBoot = amtOk();
      // over the shading: the heat pass ran on the rest of the column
      var cells = colCells('V_AMOUNT', true);
      var heatOn = cells.filter(function (td) { return cellAmt(td) <= 50000 && !!td.style.backgroundColor; }).length;
      R.chk.overShade = heatOn > 50 && cells.filter(function (td) { return cellAmt(td) > 50000; }).every(function (td) { return /pnb-hl-amber/.test(td.style.backgroundColor); });
      R.chk.rowRule = rowsOk();
      R.chk.otherCol = namesOk();
      openPanel();
      await sleep(400);
      var bv = badgesOf('V_AMOUNT');
      R.chk.badges = bv.some(function (b) { return b.t === 'HEAT' && b.own; }) && bv.some(function (b) { return b.t === 'RULE' && b.own; })
        && /Highlight: 2 rules/.test(item('V_AMOUNT').querySelector('.sp-col-badges').getAttribute('title') || '')
        && badgesOf('V_NAME').some(function (b) { return b.t === 'RULE'; });
      // a sort and a search draw them again
      document.querySelector('#tableHeader th[data-colname="V_DATE"]').click();
      await sleep(800);
      var sortOk = amtOk() && rowsOk() && namesOk();
      $('#tableSearch').val('Pending');
      await window.__HC.runSearch();
      await sleep(600);
      var vis = colCells('V_NAME').filter(function (td) { return !td.parentNode.classList.contains('search-hidden'); });
      var searchOk = vis.length > 20 && vis.every(function (td) { return getComputedStyle(td).fontStyle === 'italic'; });
      $('#tableSearch').val('');
      await window.__HC.runSearch();
      await sleep(600);
      R.chk.sortSearch = sortOk && searchOk && amtOk();
      // a dark theme: the fills are its own tints
      document.body.classList.add('is-dark');
      var darkAmber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      var hot = colCells('V_AMOUNT', true).filter(function (td) { return cellAmt(td) > 50000; })[0];
      R.chk.darkTint = darkAmber === 'rgb(77, 63, 18)' && !!hot && getComputedStyle(hot).backgroundColor === darkAmber;
      document.body.classList.remove('is-dark');
      // a value that stops matching: drawn again, its old style gone (the format pass
      // takes the styles off even when only highlight rules are left to draw)
      var ctd = colCells('V_STATUS', true).filter(function (td) { return td.textContent.trim() === 'Closed'; })[0];
      var ctr = ctd && ctd.parentNode, before = ctr ? /line-through/.test(ctr.style.textDecoration || '') : false;
      if (ctd) { ctd.textContent = 'Open'; if (ctd.hasAttribute('data-pnb-raw')) ctd.setAttribute('data-pnb-raw', 'Open'); }
      window.__HC.acf(true);
      await sleep(100);
      R.chk.stopsMatching = before && !!ctr && !/line-through/.test(ctr.style.textDecoration || '');
      var hot0 = colCells('V_AMOUNT', true).filter(function (td) { return cellAmt(td) > 50000; });
      R.info = { heatOn: heatOn, bv: bv, darkAmber: darkAmber, before: before, sortOk: sortOk, searchOk: searchOk, vis: vis.length,
        hot: hot0.slice(0, 3).map(function (td) { return td.style.cssText; }), hotN: hot0.length,
        hotBad: hot0.filter(function (td) { return !/pnb-hl-amber/.test(td.style.backgroundColor); }).slice(0, 3).map(function (td) { return td.outerHTML.slice(0, 200); }) };
    },
    // (2026-10-20, hl) the grouped view
    ghl: async function () {
      var amber = probe('background-color: var(--pnb-hl-amber, #fbe8a6)', 'backgroundColor');
      function gCells(col) {
        var out = [];
        Array.prototype.forEach.call(document.querySelectorAll('#groupedResultsContainer table'), function (tb) {
          var ths = Array.prototype.slice.call(tb.querySelectorAll(':scope > thead th')), i = ths.findIndex(function (t) { return t.getAttribute('data-colname') === col; });
          if (i < 0) return;
          Array.prototype.forEach.call(tb.querySelectorAll(':scope > tbody > tr'), function (tr) { if (tr.children[i] && tr.children.length === ths.length) out.push(tr.children[i]); });
        });
        return out;
      }
      function amt(td) { return cents(td.getAttribute('data-pnb-raw') || td.textContent) / 100; }
      var gc = gCells('V_AMOUNT');
      R.chk.groupedPainted = gc.length > 100 && gc.every(function (td) { return (amt(td) > 50000) === (getComputedStyle(td).backgroundColor === amber); });
      // a rule made with the grouped view on: drawn there; deleted: gone from both tables
      openPanel();
      await sleep(450);
      cogOf('V_STATUS').click();
      await sleep(80);
      popover().querySelector('[data-co="hl-add"]').click();
      await sleep(80);
      setInput(hlQ('[data-co="hl-v"]'), 'Closed');
      await sleep(550);
      hlQ('[data-co="hl-tx"][data-k="red"]').click();
      hlQ('[data-co="hl-fl"][data-k=""]').click();
      await sleep(100);
      var red = probe('color: var(--accent-danger, #c62828)', 'color');
      var gs = gCells('V_STATUS');
      var drawn = gs.length > 100 && gs.every(function (td) { return (td.textContent.trim() === 'Closed') === (getComputedStyle(td).color === red); });
      hlQ('[data-co="hl-delete"]').click();
      await sleep(120);
      var gone = gCells('V_STATUS').every(function (td) { return getComputedStyle(td).color !== red && td.style.color === ''; })
        && colCells('V_STATUS', true).every(function (td) { return td.style.color === ''; });
      R.chk.groupedLive = drawn && gone && !hlRules('V_STATUS');
      closeAll();
      R.info = { n: gc.length, gs: gs.length, drawn: drawn, gone: gone };
    },
    // ---- (2026-10-20 b) formats and highlight rules SAVED WITH THE REPORT. hr*: the report holds
    // columnFormats { V_AMOUNT: currency:0 } and columnHighlights { V_AMOUNT: [r1 amber over 50,000],
    // V_STATUS: [r2 Closed, the whole row struck], V_NAME: [r3 V_NAME = /Alpha/ italic] } (mk_harness)
    // hrep: someone who may save it - drawn at once and outlined, Off for me, Automatic over the
    // report's format and Reset back, a report rule changed into a copy (and back), a view link,
    // a save made without the dialog's list; and the PHP half's fixtures
    hrep: async function () {
      var K = hrKit();
      R.chk.repFmt = K.amtText('cur0') && colCells('V_AMOUNT', true).every(function (td) { return td.getAttribute('data-pnb-raw') === rowOf(td).V_AMOUNT; });
      R.chk.repDrawn = K.painted(K.amber) && K.strikes(true) && K.italicNames(false);
      R.info.email = K.emailFix();
      R.info.when = K.whenFix();
      R.info.unit = K.unitFix();
      R.info.rowsAll = window.__rowsFixture.map(function (r) {
        var o = {};
        Object.keys(r).forEach(function (k) { if (!/^(V_LINK|H_HTML|H_JSON)$/.test(k)) o[k] = r[k]; });
        return o;
      });
      openPanel();
      await sleep(450);
      var bv = badgesOf('V_AMOUNT'), bt = item('V_AMOUNT').querySelector('.sp-col-badges').getAttribute('title') || '';
      R.chk.repBadges = bv.some(function (b) { return b.t === '$' && !b.own; }) && bv.some(function (b) { return b.t === 'RULE' && !b.own; })
        && bt.indexOf("Format: Currency, 0 decimals (the report's)") !== -1 && /Highlight: [^\n]*\(the report's\)/.test(bt)
        && badgesOf('V_STATUS').some(function (b) { return b.t === 'RULE' && !b.own; });
      cogOf('V_AMOUNT').click();
      await sleep(80);
      var pop = popover(), reps = pop.querySelectorAll('.pnb-hl-item.is-report'), rr = reps[0];
      var offCb = rr && rr.querySelector('[data-co="hl-off"]');
      R.chk.popRepRow = reps.length === 1 && pop.querySelectorAll('.pnb-hl-item:not(.is-report)').length === 0
        && rr.querySelector('.pnb-hl-tag').textContent === 'report' && !!rr.querySelector('[data-co="hl-redit"]') && !rr.querySelector('.pnb-hl-text')
        && !!offCb && !offCb.checked && /Off for me/.test(rr.querySelector('.pnb-hl-offl').textContent)
        && pop.querySelector('[data-co="reset"]').disabled && pop.querySelector('[data-co="type"]').value === 'currency'
        && pop.querySelector('[data-co="dp"]').value === '0' && pop.querySelector('[data-hint="fmt"]').textContent === '';
      // Off for me: off for this viewer alone, at once; the view link carries what they see
      offCb.click();
      await sleep(150);
      var co = colopt() || {};
      R.chk.offForMe = K.none(K.amber) && !!co.V_AMOUNT && JSON.stringify(co.V_AMOUNT.hlOff) === '["r1"]' && !co.V_AMOUNT.hl
        && rr.classList.contains('is-off') && !pop.querySelector('[data-co="reset"]').disabled && K.strikes(true)
        && getComputedStyle(rr.querySelector('.pnb-hl-open')).opacity === '0.55' && /line-through/.test(getComputedStyle(rr.querySelector('.pnb-hl-open')).textDecorationLine);
      bv = badgesOf('V_AMOUNT');
      R.chk.offBadge = bv.some(function (b) { return b.t === 'NO RULE' && b.own; }) && !bv.some(function (b) { return b.t === 'RULE'; });
      var sv = window.__HC.bso();
      var svOff = !!sv && !!sv.columnHighlights && !sv.columnHighlights.V_AMOUNT && !!sv.columnHighlights.V_STATUS && sv.columnHighlights.V_STATUS[0].id === 'r2'
        && !!sv.columnFormats && sv.columnFormats.V_AMOUNT === 'currency:0';
      offCb.click();
      await sleep(150);
      co = colopt() || {};
      R.chk.offBack = K.painted(K.amber) && !rr.classList.contains('is-off') && !(co.V_AMOUNT && co.V_AMOUNT.hlOff);
      sv = window.__HC.bso();
      R.chk.viewLink = svOff && !!sv && !!sv.columnHighlights && !!sv.columnHighlights.V_AMOUNT && sv.columnHighlights.V_AMOUNT.length === 1
        && sv.columnHighlights.V_AMOUNT[0].id === 'r1' && sv.columnHighlights.V_AMOUNT[0].css === 'background-color: var(--pnb-hl-amber, #fbe8a6)'
        && sv.columnHighlights.V_STATUS[0].row === true && sv.columnFormats.V_AMOUNT === 'currency:0';
      // Automatic over the report's format: the values as they are, for this viewer (NO $)
      setSel(pop.querySelector('[data-co="type"]'), '');
      await sleep(250);
      co = colopt() || {};
      bv = badgesOf('V_AMOUNT');
      R.chk.autoOverRep = K.amtText('raw') && !!co.V_AMOUNT && co.V_AMOUNT.fmt === 'none'
        && pop.querySelector('[data-hint="fmt"]').textContent === "The report's: Currency, 0 decimals. Reset goes back to it."
        && /without the report's format/.test(pop.querySelector('.pnb-colopt-prev').textContent)
        && bv.some(function (b) { return b.t === 'NO $' && b.own; }) && !pop.querySelector('[data-co="reset"]').disabled;
      // Reset: the report's format, every report rule on
      offCb = pop.querySelector('.pnb-hl-item.is-report [data-co="hl-off"]');
      offCb.click();
      await sleep(150);
      pop.querySelector('[data-co="reset"]').click();
      await sleep(300);
      co = colopt() || {};
      var pop2 = popover();
      R.chk.resetBack = K.amtText('cur0') && K.painted(K.amber) && !(co.V_AMOUNT && (co.V_AMOUNT.fmt || co.V_AMOUNT.hl || co.V_AMOUNT.hlOff))
        && !!pop2 && pop2.querySelector('[data-co="type"]').value === 'currency' && pop2.querySelector('[data-co="dp"]').value === '0'
        && pop2.querySelector('[data-hint="fmt"]').textContent === '' && pop2.querySelector('[data-co="reset"]').disabled
        && !pop2.querySelector('.pnb-hl-item.is-report [data-co="hl-off"]').checked;
      // opened and left: still the report's, nothing stored
      pop2.querySelector('.pnb-hl-item.is-report [data-co="hl-redit"]').click();
      await sleep(120);
      var ttl = hlEd() ? hlEd().querySelector('.pnb-colopt-title').textContent : '', note = hlQ('.pnb-hl-note'), del0 = hlQ('[data-co="hl-delete"]').textContent;
      var stored0 = hlRules('V_AMOUNT');
      hlQ('[data-co="hl-back"]').click();
      await sleep(100);
      R.chk.openNoCopy = ttl === "The report's rule" && !!note && /Save dialog offers it to the report/.test(note.textContent) && del0 === 'Discard'
        && !stored0 && !hlRules('V_AMOUNT') && popover().querySelectorAll('.pnb-hl-item.is-report').length === 1;
      // a change: the viewer's copy (the same id), drawn in the report's rule's place, marked changed
      popover().querySelector('.pnb-hl-item.is-report [data-co="hl-redit"]').click();
      await sleep(120);
      hlQ('[data-co="hl-fl"][data-k="green"]').click();
      await sleep(150);
      var rs = hlRules('V_AMOUNT'), delTxt = hlQ('[data-co="hl-delete"]').textContent;
      hlQ('[data-co="hl-done"]').click();
      await sleep(100);
      pop = popover();
      var own = pop.querySelectorAll('.pnb-hl-item:not(.is-report)');
      R.chk.editCopy = !!rs && rs.length === 1 && rs[0].id === 'r1' && rs[0].w === 'V_AMOUNT > 50000' && rs[0].css === 'background-color: var(--pnb-hl-green, #d3eedb)'
        && delTxt === 'Delete my change' && K.painted(K.green) && own.length === 1 && !!own[0].querySelector('.pnb-hl-tag')
        && own[0].querySelector('.pnb-hl-tag').textContent === 'changed' && pop.querySelectorAll('.pnb-hl-item.is-report').length === 0
        && /^Delete your change to the report's rule/.test(own[0].querySelector('[data-co="hl-del"]').getAttribute('aria-label'))
        && badgesOf('V_AMOUNT').some(function (b) { return b.t === 'RULE' && b.own; })
        && !/\d rules/.test(item('V_AMOUNT').querySelector('.sp-col-badges').getAttribute('title') || '');
      // changed back to the report's: the copy goes
      own[0].querySelector('[data-co="hl-edit"]').click();
      await sleep(120);
      hlQ('[data-co="hl-fl"][data-k="amber"]').click();
      await sleep(150);
      var backTxt = hlQ('[data-co="hl-delete"]').textContent, rsBack = hlRules('V_AMOUNT');
      hlQ('[data-co="hl-done"]').click();
      await sleep(100);
      R.chk.changeBack = !rsBack && !hlRules('V_AMOUNT') && backTxt === 'Discard' && K.painted(K.amber)
        && popover().querySelectorAll('.pnb-hl-item.is-report').length === 1 && popover().querySelectorAll('.pnb-hl-item:not(.is-report)').length === 0;
      // Delete my change: the report's rule again
      popover().querySelector('.pnb-hl-item.is-report [data-co="hl-redit"]').click();
      await sleep(120);
      hlQ('[data-co="hl-tx"][data-k="red"]').click();
      await sleep(150);
      var made = hlRules('V_AMOUNT'), redOn = colCells('V_AMOUNT', true).some(function (td) { return getComputedStyle(td).color === K.red; });
      hlQ('[data-co="hl-delete"]').click();
      await sleep(150);
      R.chk.copyDelete = !!made && made.length === 1 && made[0].id === 'r1' && redOn && !hlRules('V_AMOUNT') && K.painted(K.amber)
        && colCells('V_AMOUNT', true).every(function (td) { return getComputedStyle(td).color !== K.red; });
      // a rule typed in a form Basic writes another way (V_NAME = /Alpha/): opened and left, still the report's
      closeAll();
      await sleep(60);
      cogOf('V_NAME').click();
      await sleep(100);
      popover().querySelector('.pnb-hl-item.is-report [data-co="hl-redit"]').click();
      await sleep(150);
      var r3op = hlQ('[data-co="hl-op"]').value, r3v = hlQ('[data-co="hl-v"]').value, r3stored = hlRules('V_NAME');
      hlQ('[data-co="hl-back"]').click();
      await sleep(100);
      R.chk.openCanon = r3op === 'contains' && r3v === 'Alpha' && !r3stored && !hlRules('V_NAME') && popover().querySelectorAll('.pnb-hl-item.is-report').length === 1
        && K.italicNames(false);
      closeAll();
      await sleep(60);
      // a save made without the dialog's list: the report's stay as they are, the viewer's own stay theirs
      cogOf('V_AMOUNT').click();
      await sleep(100);
      setSel(popover().querySelector('[data-co="type"]'), 'number');
      setSel(popover().querySelector('[data-co="dp"]'), '2');
      await sleep(250);
      closeAll();
      $('#serverSaveIdInput').val('lrfix');
      var n0 = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n0; }, 8000);
      await sleep(400);
      var sd0 = null;
      try { sd0 = JSON.parse(window.__saves[window.__saves.length - 1].state_data); } catch (e) { }
      co = colopt() || {};
      R.chk.noListKeeps = !!sd0 && JSON.stringify(sd0.columnFormats) === '{"V_AMOUNT":"currency:0"}' && !!sd0.columnHighlights
        && Object.keys(sd0.columnHighlights).sort().join() === 'V_AMOUNT,V_NAME,V_STATUS' && sd0.columnHighlights.V_AMOUNT[0].css === 'background-color: var(--pnb-hl-amber, #fbe8a6)'
        && !!co.V_AMOUNT && co.V_AMOUNT.fmt === 'number:2' && K.amtText('num2');
      R.info.chk = { bt: bt, sv: sv, sd0: sd0 && { f: sd0.columnFormats, h: sd0.columnHighlights }, co: co, ttl: ttl, delTxt: delTxt, backTxt: backTxt, r3: [r3op, r3v] };
    },
    // hrview: a viewer (canEditReport off) - the report's drawn; its rules cannot be opened, only
    // turned off for themself; their own rule on top (its fill over the report's); their own format
    hrview: async function () {
      var K = hrKit();
      R.chk.viewDrawn = K.painted(K.amber) && K.strikes(true) && K.amtText('cur0') && K.italicNames(false);
      openPanel();
      await sleep(450);
      cogOf('V_AMOUNT').click();
      await sleep(80);
      var pop = popover(), rr = pop.querySelector('.pnb-hl-item.is-report');
      R.chk.viewNoEdit = !!rr && !rr.querySelector('[data-co="hl-redit"]') && !!rr.querySelector('.pnb-hl-text') && !!rr.querySelector('[data-co="hl-off"]')
        && pop.querySelectorAll('[data-co="hl-redit"]').length === 0;
      rr.querySelector('[data-co="hl-off"]').click();
      await sleep(150);
      var co = colopt() || {};
      var offOk = K.none(K.amber) && !!co.V_AMOUNT && JSON.stringify(co.V_AMOUNT.hlOff) === '["r1"]';
      rr.querySelector('[data-co="hl-off"]').click();
      await sleep(150);
      R.chk.viewOff = offOk && K.painted(K.amber);
      // their own rule: drawn over the report's (whose fill stays where theirs sets none)
      pop.querySelector('[data-co="hl-add"]').click();
      await sleep(100);
      setInput(hlQ('[data-co="hl-v"]'), '80000');
      await sleep(550);
      hlQ('[data-co="hl-tx"][data-k="red"]').click();
      hlQ('[data-co="hl-fl"][data-k="blue"]').click();
      await sleep(150);
      hlQ('[data-co="hl-done"]').click();
      await sleep(100);
      var rs = hlRules('V_AMOUNT'), cells = colCells('V_AMOUNT', true);
      R.chk.viewOwnOnTop = !!rs && rs.length === 1 && rs[0].w === 'V_AMOUNT > 80000' && rs[0].css === 'background-color: var(--pnb-hl-blue, #d6e5fa); color: var(--accent-danger, #c62828)'
        && cells.length === 300 && cells.every(function (td) {
          var a = K.amt(td), cs = getComputedStyle(td);
          return (a > 80000) === (cs.color === K.red) && (a > 80000 ? cs.backgroundColor === K.blue : (a > 50000) === (cs.backgroundColor === K.amber));
        })
        && popover().querySelectorAll('.pnb-hl-item.is-report').length === 1 && popover().querySelectorAll('.pnb-hl-item:not(.is-report)').length === 1
        && !popover().querySelector('.pnb-hl-item:not(.is-report) .pnb-hl-tag');
      // their own format over the report's
      setSel(popover().querySelector('[data-co="type"]'), 'number');
      setSel(popover().querySelector('[data-co="dp"]'), '2');
      await sleep(300);
      var bv = badgesOf('V_AMOUNT');
      co = colopt() || {};
      R.chk.viewFmtOwn = !!co.V_AMOUNT && co.V_AMOUNT.fmt === 'number:2' && K.amtText('num2') && bv.some(function (b) { return b.t === 'NUM' && b.own; })
        && !bv.some(function (b) { return b.t === '$'; }) && popover().querySelector('[data-hint="fmt"]').textContent === "The report's: Currency, 0 decimals. Reset goes back to it.";
      closeAll();
      // the Run button (the report's own query): still the report's; an edited query (an
      // ad-hoc run) is another table - the report's rules and format go, the viewer's stay
      var cmEl = document.querySelector('.CodeMirror'), cm = cmEl && cmEl.CodeMirror, ta = document.getElementById('sqlQuery');
      var qText = cm ? cm.getValue() : ta.value, q0 = window.__queryDone;
      $('#executeQuery').click();
      await until(function () { return window.__queryDone > q0; }, 15000);
      await sleep(800);
      var mid = function (fill) {
        return colCells('V_AMOUNT', true).every(function (td) { var a = K.amt(td), bg = getComputedStyle(td).backgroundColor; return a > 80000 ? bg === K.blue : (a > 50000) === (bg === fill); });
      };
      R.chk.rerunKeeps = window.__queryDone === q0 + 1 && mid(K.amber) && K.strikes(true) && K.italicNames(false) && K.amtText('num2');
      if (cm) cm.setValue(qText + ' WHERE 1 = 1'); else ta.value = qText + ' WHERE 1 = 1';
      var q1 = window.__queryDone;
      $('#executeQuery').click();
      await until(function () { return window.__queryDone > q1; }, 15000);
      await sleep(800);
      var ownOnly = colCells('V_AMOUNT', true).every(function (td) { var bg = getComputedStyle(td).backgroundColor; return K.amt(td) > 80000 ? bg === K.blue : bg !== K.amber; });
      R.chk.adhocDrops = window.__queryDone === q1 + 1 && ownOnly && K.none(K.amber) && K.strikes(false)
        && colCells('V_NAME', true).every(function (td) { return getComputedStyle(td).fontStyle !== 'italic'; }) && K.amtText('num2');
      R.info = { co: co, bv: bv, rs: rs, q: [q0, q1, window.__queryDone], cm: !!cm };
    },
    // hrsave: the Save dialog - Last Stop Changes lists the saver's own (each ticked); the ticked go
    // into the report, an unticked off rule comes out of it; after the save the report's own copies
    // go; a save under another id leaves this report's own settings be
    hrsave: async function () {
      var K = hrKit();
      window.alert = function (m) { R.notes.push('alert: ' + m); };
      // at boot: their copy of r1 (green) in its place, o2 (bold over 80,000) on top, r2 off for them, o1 theirs
      var seed = { painted: K.painted(K.green), bold: K.bold(80000), strikes: K.strikes(false), italic: K.italicNames(true), date: K.dateIso() };
      R.chk.seedDrawn = seed.painted && seed.bold && seed.strikes && seed.italic && seed.date;
      document.getElementById('saveQuery').click();
      await sleep(500);
      var items = Array.prototype.map.call(document.querySelectorAll('#pnbHlSaveRow input[data-hl-save]'), function (cb) {
        return { k: cb.getAttribute('data-hl-save'), on: cb.checked, t: cb.parentNode.textContent.trim() };
      });
      var lbl = function (k) { var x = items.filter(function (y) { return y.k === k; })[0]; return x ? x.t : ''; };
      R.chk.listItems = items.map(function (x) { return x.k; }).join() === 'hl|V_NAME|o1,hl|V_AMOUNT|o2,hl|V_AMOUNT|r1,fmt|V_DATE,off|V_STATUS|r2'
        && items.every(function (x) { return x.on; }) && /\(your change to the report's rule\)$/.test(lbl('hl|V_AMOUNT|r1'))
        && /\(the report's rule, off for you\)$/.test(lbl('off|V_STATUS|r2')) && /^V_DATE: format Date, /.test(lbl('fmt|V_DATE'))
        && !!document.querySelector('#lastStopCardBody #pnbHlSaveRow') && document.getElementById('pnbHlSaveLbl').textContent === 'Column formats and highlight rules'
        && !!document.querySelector('#pnbHlSaveRow .pnb-hl-save-note');
      var hint = document.getElementById('pnbHlSaveHint');
      R.chk.listHint = !!hint && hint.textContent === ' Saves 5 column formats and highlight rules with the report.';
      var cb = function (k) { return document.querySelector('#pnbHlSaveRow input[data-hl-save="' + k + '"]'); };
      cb('hl|V_NAME|o1').checked = false;
      cb('off|V_STATUS|r2').checked = false;
      $('#serverSaveIdInput').val('lrfix');
      var n = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n; }, 8000);
      await sleep(500);
      var sd = null;
      try { sd = JSON.parse(window.__saves[window.__saves.length - 1].state_data); } catch (e) { }
      var ch = sd && sd.columnHighlights, cf = sd && sd.columnFormats;
      R.chk.savedState = !!sd && JSON.stringify(cf) === JSON.stringify({ V_AMOUNT: 'currency:0', V_DATE: 'date:YYYY-MM-DD' })
        && !!ch && Object.keys(ch).sort().join() === 'V_AMOUNT,V_NAME' && ch.V_AMOUNT.map(function (r) { return r.id; }).join() === 'o2,r1'
        && ch.V_AMOUNT[0].css === 'font-weight: bold' && ch.V_AMOUNT[1].css === 'background-color: var(--pnb-hl-green, #d3eedb)'
        && ch.V_NAME.map(function (r) { return r.id; }).join() === 'r3';
      var co = colopt() || {};
      R.chk.afterOwn = !!co.V_NAME && !!co.V_NAME.hl && co.V_NAME.hl.map(function (r) { return r.id; }).join() === 'o1'
        && !(co.V_AMOUNT && (co.V_AMOUNT.hl || co.V_AMOUNT.fmt)) && !(co.V_DATE && co.V_DATE.fmt) && !(co.V_STATUS && co.V_STATUS.hlOff);
      var after = { painted: K.painted(K.green), bold: K.bold(80000), strikes: K.strikes(false), italic: K.italicNames(true), date: K.dateIso() };
      R.chk.afterDrawn = after.painted && after.bold && after.strikes && after.italic && after.date;
      openPanel();
      await sleep(450);
      var bD = badgesOf('V_DATE'), bA = badgesOf('V_AMOUNT'), bN = badgesOf('V_NAME'), bS = badgesOf('V_STATUS');
      R.chk.afterBadges = bD.some(function (b) { return b.t === 'DATE' && !b.own; }) && bA.some(function (b) { return b.t === 'RULE' && !b.own; })
        && bN.some(function (b) { return b.t === 'RULE' && b.own; }) && !bS.some(function (b) { return /RULE/.test(b.t); });
      // the dialog again: only what is still theirs
      document.getElementById('saveQuery').click();
      await sleep(500);
      var keys2 = Array.prototype.map.call(document.querySelectorAll('#pnbHlSaveRow input[data-hl-save]'), function (x) { return x.getAttribute('data-hl-save'); });
      R.chk.relist = keys2.join() === 'hl|V_NAME|o1' && document.getElementById('pnbHlSaveHint').textContent === ' Saves 1 column format or highlight rule with the report.';
      // a save under another id (a copy): the copy gets o1, this report's own settings stay
      $('#serverSaveIdInput').val('zzcopy');
      n = window.__saves.length;
      $('#confirmServerSaveBtn').prop('disabled', false).trigger('click');
      await until(function () { return window.__saves.length > n; }, 8000);
      await sleep(500);
      var sd2 = null;
      try { sd2 = JSON.parse(window.__saves[window.__saves.length - 1].state_data); } catch (e) { }
      co = colopt() || {};
      R.chk.copyKeepsOwn = !!sd2 && !!sd2.columnHighlights && !!sd2.columnHighlights.V_NAME
        && sd2.columnHighlights.V_NAME.map(function (r) { return r.id; }).join() === 'o1,r3' && !!co.V_NAME && !!co.V_NAME.hl
        && co.V_NAME.hl.map(function (r) { return r.id; }).join() === 'o1';
      R.info = { seed: seed, after: after, d0: colCells('V_DATE', true).slice(0, 2).map(function (td) { return td.textContent; }), items: items, keys2: keys2, cf: cf, ch: ch, co: co, sd2: sd2 && sd2.columnHighlights, bD: bD, bA: bA, bN: bN, bS: bS, notes: R.notes };
    },
    fspa11y: async function () {
      openPanel();
      await sleep(450);
      var nm = document.querySelector('#spColumnList .sp-col-head .sph-name');
      var lanes = Array.prototype.slice.call(document.querySelectorAll('#spColumnList .sp-col-head .sph'));
      var words = nm ? nm.textContent.replace(/[▲▼]/g, '').trim() : '';
      var l0 = nm ? (nm.getAttribute('aria-label') || '') : '';
      R.chk.sortNameVisible = !!nm && words === 'Column' && l0.indexOf('Column, sort alphabetically') === 0;
      var seq = [l0];
      for (var i = 0; nm && i < 3; i++) { nm.click(); await sleep(60); seq.push(nm.getAttribute('aria-label') || ''); }
      R.chk.sortStates = /, not sorted$/.test(seq[0]) && /, sorted ascending$/.test(seq[1]) && /, sorted descending$/.test(seq[2]) && /, not sorted$/.test(seq[3]);
      if (nm) { nm.click(); await sleep(60); }
      var others = lanes.filter(function (h) { return h !== nm; });
      R.chk.otherLanesNot = others.length >= 1 && others.every(function (h) { return /, not sorted$/.test(h.getAttribute('aria-label') || ''); })
        && /, sorted ascending$/.test(nm.getAttribute('aria-label') || '');
      R.info = { seq: seq, lanes: lanes.map(function (h) { return h.getAttribute('aria-label'); }) };
      if (nm) { nm.click(); nm.click(); await sleep(60); }   // back to rest
      // the hint links: pick an explicit value, then Enter makes it the default and Space clears it
      function press(el, k) { var c = k === ' ' ? 32 : 13; $(el).trigger($.Event('keydown', { which: c, keyCode: c, key: k })); }
      async function hint(kind) {
        var Kind = kind.charAt(0).toUpperCase() + kind.slice(1);
        var sel = document.getElementById('sp' + Kind + 'Selector'), store = 'penumbra_user_' + kind;
        localStorage.removeItem(store);
        var opt = Array.prototype.filter.call(sel.options, function (o) { return o.value && o.value !== 'report-default' && o.value !== 'my-default' && o.style.display !== 'none'; })
          .map(function (o) { return o.value; }).filter(function (v) { return v !== sel.value; })[0];
        $(sel).val(opt).trigger('change');
        await sleep(400);
        var mk = document.getElementById('sp' + Kind + 'MakeGlobal');
        var out = { opt: opt, mk: !!mk };
        out.btn = !!mk && mk.getAttribute('role') === 'button' && mk.getAttribute('tabindex') === '0';
        if (mk) { mk.focus(); press(mk, 'Enter'); }
        await sleep(500);
        out.stored = localStorage.getItem(store);
        var ae = document.activeElement;
        out.focus = ae ? ae.id : '';
        out.enter = out.stored === opt;
        var clr = document.getElementById('sp' + Kind + 'ClearGlobal');
        out.focusMoved = !!clr && ae === clr && clr.getAttribute('role') === 'button' && /^Clear/.test(clr.getAttribute('aria-label') || '');
        if (clr) press(clr, ' ');
        await sleep(600);
        out.space = localStorage.getItem(store) === null;
        var ae2 = document.activeElement;
        out.focus2 = ae2 ? ae2.id : '';
        out.focusKept = !!ae2 && ae2 !== document.body && (ae2 === sel || /^sp/.test(ae2.id));
        return out;
      }
      var th = await hint('theme'), de = await hint('density');
      R.chk.themeHintBtn = th.btn; R.chk.themeEnter = th.enter; R.chk.themeFocusMoves = th.focusMoved; R.chk.themeSpaceClears = th.space && th.focusKept;
      R.chk.densityHintBtn = de.btn; R.chk.densityEnter = de.enter; R.chk.densityFocusMoves = de.focusMoved; R.chk.densitySpaceClears = de.space && de.focusKept;
      R.info.theme = th; R.info.density = de;
    }
  };
  function pivotCells(sc) {
    var tds = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable td[data-agg-idx]'));
    var by = { 0: [], 1: [], 2: [] };
    tds.forEach(function (td) { var i = td.getAttribute('data-agg-idx'); if (by[i]) by[i].push(td.textContent.trim()); });
    function all(i, rx) { return by[i].length > 0 && by[i].filter(Boolean).every(function (t) { return rx.test(t); }); }
    if (sc === 'pvfmt') {
      R.chk.amtCurrency0 = all(0, /^\$[\d,]+$/);
      R.chk.countStaysCount = all(1, /^[\d,]+$/);
      R.chk.meanPercent = all(2, /^[\d,]+\.\d%$/);
    } else if (sc === 'pvfmt2') {
      R.chk.amtNumber2 = all(0, /^[\d,]+\.\d\d$/);
      R.chk.countAsIs = all(1, /^[\d,]+$/);
      R.chk.meanAuto0 = all(2, /^[\d,]+$/);
    }
    // every value-looking text of the pivot, for the email's twin (run.py -> PHP) - not the
    // group subtotal rows, which the emailed pivot does not draw
    var texts = [];
    Array.prototype.forEach.call(document.querySelectorAll('#pivotResultTable tr:not(.pivot-group-summary-row) > td'), function (td) {
      var t = td.textContent.trim();
      if (/^-?\$?[\d,]+(\.\d+)?%?$/.test(t)) texts.push(t);
    });
    R.info = { texts: texts.sort(), by0: by[0].slice(0, 4), by1: by[1].slice(0, 4), by2: by[2].slice(0, 4), n: tds.length,
      rows: window.__rowsFixture.map(function (r) { return { H_GROUP: r.H_GROUP, H_GROUP2: r.H_GROUP2, V_STATUS: r.V_STATUS, H_AMT: r.H_AMT }; }),
      settings: window.__STORED.pivot };
  }
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
