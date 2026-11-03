// bdhl suite - page half (2026-11-02): the report's format() rules and the viewer's highlight rules reach
// the breakdown tables, on the REAL main.js (mk_harness.py). A pivot cell's breakdown (the North / Tier 1
// row total: every status) and a chart point's (window.__chartDrill, exposed by run.py's hook) are read
// row by row - each row found in the fixture by V_ID - and every style held against what the rule says
// for that row: a rule on a column the breakdown does not show (H_FLAG, H_NUM) too.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td[data-row-key]').length > 0; }, 20000))) throw new Error('no pivot cells');
    await sleep(600);
  }
  var FX = Object.create(null);
  (window.__rowsFixture || []).forEach(function (r) { FX[r.V_ID] = r; });

  function txt(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .sort-rank, button'), function (n) { n.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function overlays() { return document.querySelectorAll('.infobox-overlay'); }
  async function open(fn) {
    var n0 = overlays().length;
    fn();
    await until(function () { return overlays().length > n0; }, 3000);
    await sleep(350);
    var o = overlays();
    return o.length > n0 ? o[o.length - 1].querySelector('table.pnb-breakdown') : null;
  }
  async function closeAll() {
    Array.prototype.forEach.call(overlays(), function (o) { var b = o.querySelector('.close-lightbox'); if (b) b.click(); });
    await until(function () { return overlays().length === 0; }, 3000);
    await sleep(60);
  }
  // the table: { cols: label -> index, ths, rows: [{ tr, id, f (fixture row), td(label) }] }
  function read(t) {
    if (!t) return null;
    var ths = Array.prototype.slice.call(t.tHead.rows[0].cells), cols = {};
    ths.forEach(function (th, i) { cols[txt(th)] = i; });
    var rows = Array.prototype.filter.call(t.tBodies[0].rows, function (tr) { return !tr.querySelector('td[colspan]'); }).map(function (tr) {
      var id = tr.cells[cols.V_ID] ? tr.cells[cols.V_ID].textContent.trim() : null;
      return { tr: tr, id: id, f: FX[id] || null, td: function (l) { return tr.cells[cols[l]] || null; } };
    });
    return { t: t, cols: cols, ths: ths, rows: rows };
  }
  // every row: (what the row shows) === (what the rule says), and both sides seen at least once
  function each(T, name, shows, says) {
    if (!T || !T.rows.length) { R.info[name] = 'no rows'; return false; }
    var bad = [], yes = 0, no = 0;
    T.rows.forEach(function (x) {
      if (!x.f) { bad.push(x.id + ': not in the fixture'); return; }
      var s = !!shows(x), w = !!says(x.f);
      if (w) yes++; else no++;
      if (s !== w) bad.push(x.id + ': shows ' + s + ', rule ' + w);
    });
    R.info[name] = { rows: T.rows.length, yes: yes, no: no, bad: bad.slice(0, 6) };
    return bad.length === 0 && yes > 0 && no > 0;
  }
  var F = {
    flag: function (x) { return x.tr.style.backgroundColor !== ''; },
    flagSays: function (f) { return f.H_FLAG === 'Y'; },
    num: function (x) { var c = x.td('V_NAME'); return !!c && (c.style.fontWeight === 'bold' || c.style.fontWeight === '700'); },
    numSays: function (f) { return Number(f.H_NUM) > 500; },
    st: function (x) { return x.tr.style.fontStyle === 'italic'; },
    stSays: function (f) { return f.V_STATUS !== 'Closed'; },
    own: function (x) { var c = x.td('V_AMOUNT'); return !!c && c.style.color !== ''; },
    ownSays: function (f) { return Number(f.H_NUM) < 300; },
    rep: function (x) { var c = x.td('V_STATUS'); return !!c && /underline/.test(c.style.textDecoration || c.style.textDecorationLine); },
    repSays: function (f) { return f.V_STATUS === 'Pending'; }
  };
  function attrsOk(T) {
    return !!T && T.ths.every(function (th, i) {
      var l = txt(th);
      return l === '#' ? !th.hasAttribute('data-pnb-bd-col') : th.getAttribute('data-pnb-bd-col') === l;
    });
  }
  function pivotCell() {
    var tr = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr[data-pivot-row]'), function (t) { return t.getAttribute('data-pivot-row') === 'North|||Tier 1'; })[0];
    return tr ? tr.querySelector('td.pivot-grand-total[data-row-key]') : null;
  }
  // a total as the report's totals hand it to the format engine (main.js _pnbNumText, copied): the breakdown's
  // total must read as the report's would
  // main.js _pnbNumText (2026-11-02, pnt: 15 significant digits, not toFixed(12)'s binary noise)
  function numText(v) { var mag = Math.abs(v), s = (mag >= 1e-6 && mag < 1e14) ? v.toPrecision(15) : mag >= 1e21 ? String(v) : v.toFixed(12); if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
  // a breakdown's total for a column: its footer cell's text without the type badge
  function totalText(T, col) {
    var foot = T && T.t.tFoot && T.t.tFoot.rows[0], fc = foot ? foot.cells[T.cols[col]] : null;
    return (fc && fc.firstChild && fc.firstChild.nodeType === 3) ? fc.firstChild.textContent.trim() : null;
  }
  function chartRows(n) { var m = window.__mrd ? window.__mrd() : null; return m ? m.slice(0, n) : []; }

  var S = {
    pbh: async function () {
      var T = null;
      await step('pivot', async function () {
        // the report's table is left alone: its hidden columns' empty (lazy) cells are not filled for a breakdown
        function lazy() { return document.querySelectorAll('#resultsTable td[data-pnb-lazy]').length; }
        var lz0 = lazy();
        T = read(await open(function () { pivotCell().click(); }));
        R.info.mainLazy = [lz0, lazy()];
        R.chk.mainLazy = lz0 > 0 && lazy() === lz0;
        R.chk.attrs = attrsOk(T);
        R.chk.rowFlag = each(T, 'rowFlag', F.flag, F.flagSays);
        R.chk.cellNum = each(T, 'cellNum', F.num, F.numSays);
        R.chk.rowNot = each(T, 'rowNot', F.st, F.stSays);
        R.chk.viewerHl = each(T, 'viewerHl', F.own, F.ownSays);
        R.chk.reportHl = each(T, 'reportHl', F.rep, F.repSays);
        R.chk.noHeat = !!T && T.rows.length > 0 && T.rows.every(function (x) { var c = x.td('V_AMOUNT'); return c && !c.style.backgroundColor && !c.style.backgroundImage; });
        R.chk.border = !!T && T.rows.length > 0 && T.rows.every(function (x) { return Array.prototype.every.call(x.tr.cells, function (c) { return c.style.borderBottom !== ''; }); });
      });
      await step('sort', async function () {
        var before = T ? T.rows.map(function (x) { return x.id; }).join() : '';
        var th = T && T.ths[T.cols.V_AMOUNT];
        if (th) { th.click(); await sleep(250); }
        var T2 = read(T && T.t), after = T2 ? T2.rows.map(function (x) { return x.id; }).join() : '';
        R.info.sortMoved = before !== after;
        R.chk.sorted = before !== after && each(T2, 'sortedFlag', F.flag, F.flagSays) && each(T2, 'sortedNum', F.num, F.numSays);
      });
      await closeAll();
      await step('chart', async function () {
        var C = read(await open(function () { window.__chartDrill(chartRows(60), 'Point'); }));
        R.chk.chartAttrs = attrsOk(C);
        R.chk.chartFlag = each(C, 'chartFlag', F.flag, F.flagSays);
        R.chk.chartCell = each(C, 'chartCell', F.num, F.numSays);
        R.chk.chartRep = each(C, 'chartRep', F.rep, F.repSays);
      });
      await closeAll();
      await step('empty', async function () {
        var t = await open(function () { window.__chartDrill([], 'Nothing'); });
        var line = t && t.tBodies[0] && t.tBodies[0].rows[0];
        R.info.emptyLine = line ? line.getAttribute('style') : null;
        R.chk.emptyClean = !!line && !!line.querySelector('td[colspan]') && !line.style.fontStyle && !line.style.backgroundColor;
      });
      await closeAll();
    },
    pbhoff: async function () {
      await step('pivot', async function () {
        var T = read(await open(function () { pivotCell().click(); }));
        var pend = T ? T.rows.filter(function (x) { return x.f && x.f.V_STATUS === 'Pending'; }).length : 0;
        R.chk.reportOff = pend > 0 && T.rows.every(function (x) { return !F.rep(x); });
        R.chk.viewerOn = each(T, 'viewerOn', F.own, F.ownSays);
      });
      await closeAll();
    },
    // (bdhl 2) the columns' formats in a breakdown, and a rule made from its menu's Highlight...
    pbhui: async function () {
      var T = null, CF = window.PenumbraColFmt;
      function amt(s) { return Number(String(s).replace(/[$,]/g, '')); }
      function pop() { return document.querySelector('.sp-sumtype-menu.pnb-colopt'); }
      function q(sel) { var p = pop(); return p ? p.querySelector(sel) : null; }
      function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
      function menuItem(act) { return document.querySelector('#pnbHeadMenu [data-act="' + act + '"]'); }
      async function rightClick(el) {
        var r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 8, clientY: r.top + 8 }));
        await sleep(150);
      }
      function amber(x) { var c = x.td('V_AMOUNT'); return !!c && c.style.backgroundColor !== ''; }
      await step('formats', async function () {
        T = read(await open(function () { pivotCell().click(); }));
        R.chk.fmtDate = !!T && T.rows.length > 5 && T.rows.every(function (x) {
          var c = x.td('V_DATE'), w = CF.formatValue(x.f.V_DATE, 'date:YYYY-MM-DD');
          return c && w && w !== x.f.V_DATE && c.textContent === w && c.getAttribute('data-pnb-raw') === x.f.V_DATE;
        });
        R.chk.fmtAmt = !!T && T.rows.length > 5 && T.rows.every(function (x) {
          var c = x.td('V_AMOUNT'), w = CF.formatValue(x.f.V_AMOUNT, 'currency:0');
          return c && w && w !== x.f.V_AMOUNT && c.textContent === w && c.getAttribute('data-pnb-raw') === x.f.V_AMOUNT;
        });
        // (bdhl 4) the total in the column's format (currency:0), of the values - not of the rounded amounts shown
        var want = T ? T.rows.reduce(function (a, x) { return a + amt(x.f.V_AMOUNT); }, 0) : NaN;
        var shownSum = T ? T.rows.reduce(function (a, x) { return a + amt(x.td('V_AMOUNT').textContent); }, 0) : NaN;
        var tot = totalText(T, 'V_AMOUNT'), wantTxt = CF.formatValue(numText(want), 'currency:0');
        R.info.fmtTotal = [want, shownSum, tot, wantTxt];
        R.chk.fmtTotal = !!wantTxt && tot === wantTxt && Math.round(want) !== Math.round(shownSum);
      });
      await step('menu', async function () {
        await rightClick(T.ths[T.cols.V_AMOUNT]);
        var it = menuItem('bdHighlight');
        R.chk.menuItem = !!it && /^Highlight\.\.\./.test(it.textContent.trim());
        if (!it) return;
        it.click();
        await sleep(200);
        var p = pop(), r = p ? p.getBoundingClientRect() : null, top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 20) : null;
        R.info.popOpen = { pop: !!p, onTop: !!(top && p.contains(top)), focus: document.activeElement ? document.activeElement.className : null };
        R.chk.popOpen = !!p && !!top && p.contains(top) && !!q('[data-co="hl-add"]');
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(200);
      });
      await step('keyboard', async function () {
        // from the keyboard (the Menu key: no pointer position): the editor takes the focus; Escape closes it, never the breakdown
        var th = T.ths[T.cols.V_AMOUNT];
        th.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 0, clientY: 0 }));
        await sleep(150);
        var it = menuItem('bdHighlight');
        if (it) { it.click(); await sleep(200); }
        var p = pop();
        R.info.kbdFocus = { pop: !!p, focus: document.activeElement ? document.activeElement.outerHTML.slice(0, 80) : null };
        R.chk.kbdFocus = !!p && p.contains(document.activeElement);
        var n0 = overlays().length;
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(250);
        R.chk.escKeeps = !!p && !pop() && overlays().length === n0 && n0 > 0;
      });
      await step('rule', async function () {
        await rightClick(T.ths[T.cols.V_AMOUNT]);
        menuItem('bdHighlight').click();
        await sleep(200);
        q('[data-co="hl-add"]').click();
        await sleep(100);
        var v = q('[data-co="hl-v"]'); v.value = '50,000'; fire(v, 'input');
        await sleep(650);
        R.chk.addRule = each(T, 'addRule', amber, function (f) { return amt(f.V_AMOUNT) > 50000; });
        v = q('[data-co="hl-v"]'); v.value = '80,000'; fire(v, 'input');
        await sleep(650);
        // drawn again: a row between the two values loses its fill
        var mid = T.rows.filter(function (x) { var a = amt(x.f.V_AMOUNT); return a > 50000 && a <= 80000; }).length;
        R.chk.ruleChange = mid > 0 && each(T, 'ruleChange', amber, function (f) { return amt(f.V_AMOUNT) > 80000; });
        R.chk.bordersKept = T.rows.every(function (x) { return Array.prototype.every.call(x.tr.cells, function (c) { return c.style.borderBottom !== ''; }); });
      });
      await step('back', async function () {
        var hb = q('[data-co="hl-back"]'); if (hb) { hb.click(); await sleep(150); }
        var b = q('[data-co="back"]');
        R.info.backReopens = { back: !!b };
        if (b) { b.click(); await sleep(250); }
        var m = document.getElementById('pnbHeadMenu');
        R.chk.backReopens = !!b && !pop() && !!m && !!menuItem('bdSortAsc') && !!menuItem('bdHighlight');
      });
      await closeAll();
    },
    // (bdhl 3) Format... from a breakdown's menu: the format alone, a change shown in the breakdown and the
    // list (the rules left on), Reset back to the report's, a date pattern, the keyboard, Back
    pbhfmt: async function () {
      var T = null, CF = window.PenumbraColFmt;
      function amt(s) { return Number(String(s).replace(/[$,]/g, '')); }
      function pop() { return document.querySelector('.sp-sumtype-menu.pnb-colopt'); }
      function q(sel) { var p = pop(); return p ? p.querySelector(sel) : null; }
      function setSel(el, v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }
      function menuItem(act) { return document.querySelector('#pnbHeadMenu [data-act="' + act + '"]'); }
      async function rightClick(el, kbd) {
        var r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: kbd ? 0 : r.left + 8, clientY: kbd ? 0 : r.top + 8 }));
        await sleep(150);
      }
      async function openFmt(col, kbd) {
        await rightClick(T.ths[T.cols[col]], kbd);
        var it = menuItem('bdFormat');
        if (it) { it.click(); await sleep(250); }
        return !!it;
      }
      function shows(col, spec) {
        return T.rows.length > 5 && T.rows.every(function (x) {
          var c = x.td(col), raw = x.f[col], w = spec ? CF.formatValue(raw, spec) : raw;
          return c && w && c.textContent === w && ((spec && w !== raw) ? c.getAttribute('data-pnb-raw') === raw : !c.hasAttribute('data-pnb-raw'));
        });
      }
      function prefs() { try { return JSON.parse(localStorage.getItem('penumbra_column_prefs')).lrfix.colopt; } catch (e) { return null; } }
      await step('items', async function () {
        T = read(await open(function () { pivotCell().click(); }));
        await rightClick(T.ths[T.cols.V_AMOUNT]);
        var f = menuItem('bdFormat');
        R.chk.fmtItem = !!f && /^Format\.\.\./.test(f.textContent.trim()) && !!menuItem('bdHighlight');
        await rightClick(T.ths[T.cols.V_NAME]);
        R.chk.fmtNotText = !menuItem('bdFormat') && !!menuItem('bdHighlight');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(150);
      });
      await step('change', async function () {
        await openFmt('V_AMOUNT');
        var p = pop(), secs = p ? Array.prototype.map.call(p.querySelectorAll('[data-sec]'), function (s) { return s.getAttribute('data-sec'); }).join() : '';
        R.info.fmtOnly = secs;
        R.chk.fmtOnly = secs === 'format' && q('[data-co="type"]').value === 'currency';
        setSel(q('[data-co="dp"]'), '1');
        await sleep(400);
        R.chk.fmtChange = shows('V_AMOUNT', 'currency:1');
        // (bdhl 4) the open breakdown's total follows at once
        var sum = T.rows.reduce(function (a, x) { return a + amt(x.f.V_AMOUNT); }, 0), t1 = totalText(T, 'V_AMOUNT');
        R.info.totChange = [t1, CF.formatValue(numText(sum), 'currency:1')];
        R.chk.totChange = !!t1 && t1 === CF.formatValue(numText(sum), 'currency:1');
        // (2026-11-02, pnt) the same total against the amounts added up in whole cents - no float at all: a sum
        // of cents just under a 5 (North / Tier 1: 720,750.05) shows .1 at one place, not .0
        var cs = T.rows.map(function (x) { return amt(x.f.V_AMOUNT) * 100; }), ct = cs.reduce(function (a, c) { return a + Math.round(c); }, 0);
        var whole = cs.every(function (c) { return Math.abs(c - Math.round(c)) < 1e-6; }), act = Math.abs(ct);
        var centsTxt = (ct < 0 ? '-' : '') + Math.floor(act / 100) + '.' + ('0' + (act % 100)).slice(-2);
        R.info.totCents = [t1, centsTxt, CF.formatValue(centsTxt, 'currency:1'), whole];
        R.chk.totCents = whole && !!t1 && t1 === CF.formatValue(centsTxt, 'currency:1');
        var c = prefs();
        R.chk.fmtSaved = !!c && !!c.V_AMOUNT && c.V_AMOUNT.fmt === 'currency:1';
        // the report's table: the same column, the same format
        var fth = document.querySelector('#tableHeader th[data-colname="V_AMOUNT"]'), ftr = document.querySelector('#resultsTable > tbody > tr');
        var ith = document.querySelector('#tableHeader th[data-colname="V_ID"]'), fid = (ftr && ith && ftr.cells[ith.cellIndex]) ? ftr.cells[ith.cellIndex].textContent.trim() : null, ftd = (fth && ftr) ? ftr.cells[fth.cellIndex] : null;
        R.info.fmtList = [fid, ftd ? ftd.textContent : null];
        R.chk.fmtList = !!ftd && !!FX[fid] && ftd.textContent === CF.formatValue(FX[fid].V_AMOUNT, 'currency:1');
        // the rule's fill stays, by the value
        R.chk.fmtRules = each(T, 'fmtRules', function (x) { var cc = x.td('V_AMOUNT'); return !!cc && cc.style.backgroundColor !== ''; }, function (f) { return amt(f.V_AMOUNT) > 50000; });
        q('[data-co="reset"]').click();
        await sleep(400);
        var c2 = prefs();
        R.chk.fmtReset = shows('V_AMOUNT', null) && !(c2 && c2.V_AMOUNT && c2.V_AMOUNT.fmt);
        // and back to the plain total (two decimals: no format of the column's)
        var t2 = totalText(T, 'V_AMOUNT');
        R.info.totReset = t2;
        R.chk.totReset = !!t2 && /^\$[\d,]+\.\d\d$/.test(t2) && Math.abs(amt(t2) - sum) < 0.006;
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(200);
      });
      await step('date', async function () {
        await openFmt('V_DATE');
        setSel(q('[data-co="pattern"]'), 'MMM D, YYYY');
        await sleep(400);
        R.chk.fmtDate2 = shows('V_DATE', 'date:MMM D, YYYY');
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(200);
      });
      await step('keyboard', async function () {
        var n0 = overlays().length;
        await openFmt('V_AMOUNT', true);
        var p = pop();
        R.chk.fmtKbd = !!p && p.contains(document.activeElement) && overlays().length === n0;
        var b = q('[data-co="back"]');
        if (b) { b.click(); await sleep(250); }
        R.chk.fmtBack = !!b && !pop() && !!menuItem('bdFormat') && !!menuItem('bdSortAsc');
      });
      await closeAll();
    },
    pbhnone: async function () {
      await step('pivot', async function () {
        var T = read(await open(function () { pivotCell().click(); }));
        R.chk.clean = !!T && T.rows.length > 0 && T.rows.every(function (x) {
          if (x.tr.style.backgroundColor || x.tr.style.fontStyle) return false;
          return Array.prototype.every.call(x.tr.cells, function (c) { return !c.style.backgroundColor && !c.style.fontWeight && !c.style.color.replace(/var\(--text-muted\)/, '') && !c.style.textDecoration; });
        });
      });
      await closeAll();
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('no scenario ' + SCN);
      await S[SCN]();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = (window.__errors || []).concat(window.__rejections || []).slice(0, 10);
    window.__HCRESULT = R;
    window.__HCDONE = true;
  })();
})();
