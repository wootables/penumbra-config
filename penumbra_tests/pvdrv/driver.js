// pvdrv suite - page half (2026-10-21, brk): a derived pivot value drills to the cells it is computed
// from, on the REAL main.js and js/penumbra_colmenu.js (mk_harness.py). A check clicks a cell (or picks
// Show the breakdown from its menu), reads the dialog - its note, its sections, each table's rows by
// V_ID (and, in a running value's one table, the Pivot column naming each row's cell) - and holds it
// against the fixture: the rows of each cell, bucketed HERE from H_DATE (m/d/yyyy), and the value the
// cell shows, recomputed from those rows' H_AMT. pdbase collects base cells' dialogs for run.py's
// live-against-stage comparison (B-same).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td[data-pv-ai]').length > 0; }, 20000))) throw new Error('no pivot value cells');
    await sleep(600);
  }

  // ---- the fixture: each cell's rows, computed here ----
  var ROWS = window.__rowsFixture || [];
  function ymd(s) { var m = /^(\d+)\/(\d+)\/(\d{4})$/.exec(String(s || '')); return m ? { y: +m[3], m: +m[1] } : null; }
  function bucket(split, s) { var d = ymd(s); if (!d) return null; return split === 'yq' ? d.y + ' Q' + (Math.floor((d.m - 1) / 3) + 1) : String(d.y); }
  function pkey(p) { var m = /^(\d{4})(?: Q(\d))?$/.exec(p); return m ? (+m[1]) * 10 + (+(m[2] || 0)) : 0; }
  function periods(split) {
    var set = {};
    ROWS.forEach(function (r) { var b = bucket(split, r.H_DATE); if (b) set[b] = 1; });
    return Object.keys(set).sort(function (a, b) { return pkey(a) - pkey(b); });
  }
  // rows where every [field, value] holds: 'Y' / 'Q' a period of H_DATE, 'G' / 'G2' / 'S' a group / status
  function rowsOf(conds, open) {
    return ROWS.filter(function (r) {
      if (open && r.V_STATUS !== 'Open') return false;
      return conds.every(function (c) {
        if (c[0] === 'Y') return bucket('year', r.H_DATE) === c[1];
        if (c[0] === 'Q') return bucket('yq', r.H_DATE) === c[1];
        if (c[0] === 'G') return r.H_GROUP === c[1];
        if (c[0] === 'G2') return r.H_GROUP2 === c[1];
        if (c[0] === 'S') return r.V_STATUS === c[1];
        return false;
      });
    });
  }
  function amt(rs) { return rs.reduce(function (a, r) { return a + Number(r.H_AMT); }, 0); }
  function ids(rs) { return rs.map(function (r) { return r.V_ID; }).sort(); }
  function same(a, b) { a = a.slice().sort(); b = b.slice().sort(); return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  function near(a, b, tol) { return typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a - b) <= tol; }

  // ---- the pivot ----
  function txt(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .col-sort-icon, .sort-rank, .pivot-collapse-toggle, button'), function (n) { n.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function num(td) {
    if (!td) return null;
    var t = String(td.textContent || '').replace(/[\s$,%]/g, ''), neg = /^\(.*\)$/.test(t);
    t = t.replace(/[()]/g, '');
    if (!/^-?[\d.]+$/.test(t)) return null;
    var v = parseFloat(t);
    return isFinite(v) ? (neg ? -v : v) : null;
  }
  function inRow(tr, ck, ai) {
    if (!tr) return null;
    return Array.prototype.filter.call(tr.querySelectorAll('td[data-pv-ai="' + ai + '"]'), function (td) {
      return td.getAttribute('data-col-key') === ck || td.getAttribute('data-pv-ck') === ck;
    })[0] || null;
  }
  function bodyRow(rk) {
    return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr[data-pivot-row]'), function (t) { return t.getAttribute('data-pivot-row') === rk; })[0] || null;
  }
  function sumRow(gk) {
    return Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr.pivot-group-summary-row'), function (t) { return t.getAttribute('data-pivot-group-summary') === gk; })[0] || null;
  }
  function cell(rk, ck, ai) { return inRow(bodyRow(rk), ck, ai); }
  function scell(gk, ck, ai) { return inRow(sumRow(gk), ck, ai); }
  function valueCells(ai) { return Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable tbody td[data-pv-ai="' + ai + '"]')); }

  // ---- the dialog ----
  function overlays() { return document.querySelectorAll('.infobox-overlay'); }
  async function openBy(fn) {
    var n0 = overlays().length;
    fn();
    await until(function () { return overlays().length > n0; }, 3000);
    await sleep(350);
    var o = overlays();
    return { o: o.length > n0 ? o[o.length - 1] : null, added: o.length - n0 };
  }
  function readDlg(o) {
    if (!o) return null;
    var tables = Array.prototype.map.call(o.querySelectorAll('table.pnb-breakdown'), function (t) {
      var hs = Array.prototype.map.call(t.tHead.rows[0].cells, function (c) { return txt(c); });
      var iId = hs.indexOf('V_ID'), lead = t.hasAttribute('data-pnb-bd-lead');
      var rows = Array.prototype.map.call(t.tBodies[0].rows, function (tr) {
        if (tr.cells.length === 1) return null;   // "No matching transactions found."
        return { id: tr.cells[iId] ? tr.cells[iId].textContent.trim() : null, lead: lead ? tr.cells[1].textContent.trim() : null };
      }).filter(Boolean);
      return { heads: hs, lead: lead, id: t.getAttribute('data-pnb-bd'), rows: rows };
    });
    return {
      title: ((o.querySelector('.pnb-dlg-title') || {}).textContent || '').trim(),
      note: ((o.querySelector('.pnb-bd-note') || {}).textContent || '').trim(),
      secs: Array.prototype.map.call(o.querySelectorAll('.pnb-bd-sec'), function (h) { return h.textContent.replace(/\s+/g, ' ').trim(); }),
      link: !!o.querySelector('.infobox-drill-to-table'),
      tables: tables
    };
  }
  async function closeAll() {
    Array.prototype.forEach.call(overlays(), function (o) { var b = o.querySelector('.close-lightbox'); if (b) b.click(); });
    await until(function () { return overlays().length === 0; }, 3000);
    await sleep(60);
  }
  // click a cell: { d: the dialog read, added: how many dialogs opened }
  async function clickCell(td) {
    await closeAll();
    if (!td) return { d: null, added: 0 };
    var r = await openBy(function () { td.click(); });
    var d = readDlg(r.o);
    return { d: d, added: r.added };
  }
  function tIds(t) { return t ? t.rows.map(function (x) { return x.id; }) : []; }
  // a running value's one table: its rows by the cell the Pivot column names
  function byLead(t) {
    var m = {};
    (t ? t.rows : []).forEach(function (x) { (m[x.lead] = m[x.lead] || []).push(x.id); });
    return m;
  }
  function leadOk(t, name, cells) {
    if (!t || !t.lead || t.heads[1] !== name) return false;
    var m = byLead(t), names = Object.keys(m);
    var want = cells.filter(function (c) { return c.rows.length > 0; }).map(function (c) { return c.p; });
    return same(names, want) && cells.every(function (c) { return same(m[c.p] || [], ids(c.rows)); })
      // in the cells' order, as the pivot draws them
      && t.rows.every(function (x, i) { return i === 0 || cells.map(function (c) { return c.p; }).indexOf(x.lead) >= cells.map(function (c) { return c.p; }).indexOf(t.rows[i - 1].lead); });
  }

  // ---- the menu ----
  function menu() { return document.getElementById('pnbHeadMenu'); }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 4), clientY: Math.round(r.top + 4) }));
  }
  function menuItem(act) { var m = menu(); return m ? m.querySelector('[data-act="' + act + '"]') : null; }
  // an item's title: jQuery UI's tooltip takes the attribute away while it shows (the focused item)
  function itemTitle(el) {
    if (!el) return '';
    var t = el.getAttribute('title');
    if (t) return t;
    var j = window.jQuery && window.jQuery(el).data('ui-tooltip-title');
    if (j) return String(j);
    var id = el.getAttribute('aria-describedby'), tip = id && document.getElementById(id);
    return tip ? tip.textContent.trim() : '';
  }
  function toasts() { return (window.__HC_TOASTS || []).join(' | '); }

  var AI = {};   // label -> value index, from the stored pivot
  function idxOf(label) { return (window.__STORED.pivot.aggLabels || []).indexOf(label); }

  var S = {
    pdyear: async function () {
      var Y = periods('year'), G = 'North', P = window.__STORED.pivot;
      R.info.Y = Y;
      ['Amt', 'Chg', 'Diff', 'Row%', 'Run', 'Idx', 'YoY', 'LY', 'Ix23', 'N', 'Per'].forEach(function (l) { AI[l] = idxOf(l); });
      function rs(p) { return rowsOf([['G', G], ['Y', p]]); }
      await step('marks', async function () {
        var drv = ['Chg', 'Diff', 'Row%', 'Run', 'Idx', 'YoY', 'LY', 'Ix23'], not = ['Amt', 'N', 'Per'];
        R.chk.marks = drv.every(function (l) { var cs = valueCells(AI[l]); return cs.length > 0 && cs.every(function (td) { return td.hasAttribute('data-pv-drv'); }); })
          && not.every(function (l) { var cs = valueCells(AI[l]); return cs.length > 0 && cs.every(function (td) { return !td.hasAttribute('data-pv-drv'); }); })
          // a running total's cells still carry the drill's keys (they drilled before)
          && valueCells(AI.Run).every(function (td) { return td.hasAttribute('data-row-key'); });
        R.info.marks = drv.concat(not).map(function (l) { return l + ':' + valueCells(AI[l]).filter(function (td) { return td.hasAttribute('data-pv-drv'); }).length + '/' + valueCells(AI[l]).length; });
      });
      await step('chg', async function () {
        var td = cell(G, Y[2], AI.Chg), r = await clickCell(td), d = r.d;
        var a = rs(Y[2]), b = rs(Y[1]), v = num(td);
        R.chk.chg = !!d && r.added === 1 && d.tables.length === 2 && d.secs.length === 2
          && d.secs[0].indexOf(Y[2] + ', this column') === 0 && d.secs[1].indexOf(Y[1] + ', the column before') === 0
          && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b)) && !d.tables[0].lead
          && d.note === 'Chg compares ' + Y[2] + ' with the column before it, ' + Y[1] + '.' && !d.link && d.title.indexOf('Chg: ') === 0
          && near(v, (amt(a) - amt(b)) / amt(b) * 100, 0.6);
        R.info.chg = { d: d, v: v, want: (amt(a) - amt(b)) / amt(b) * 100, added: r.added };
      });
      await step('chgFirst', async function () {
        var r = await clickCell(cell(G, Y[0], AI.Chg)), d = r.d;
        R.chk.chgFirst = !!d && d.tables.length === 1 && d.secs.length === 0 && same(tIds(d.tables[0]), ids(rs(Y[0])))
          && d.note.indexOf(Y[0] + ' is the first column') === 0 && d.link;
        R.info.chgFirst = d && { note: d.note, n: d.tables.length, link: d.link };
      });
      await step('diff', async function () {
        var td = cell(G, Y[3], AI.Diff), r = await clickCell(td), d = r.d, a = rs(Y[3]), b = rs(Y[2]);
        R.chk.diff = !!d && d.tables.length === 2 && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b)) && near(num(td), amt(a) - amt(b), 1.01);
        R.info.diff = { v: num(td), want: amt(a) - amt(b) };
      });
      await step('share', async function () {
        var td = cell(G, Y[1], AI['Row%']), r = await clickCell(td), d = r.d, a = rs(Y[1]), all = rowsOf([['G', G]]);
        R.chk.share = !!d && d.tables.length === 1 && same(tIds(d.tables[0]), ids(a)) && d.link
          && d.note === "Row% is this cell's share of its row's total. These are its rows." && near(num(td), amt(a) / amt(all) * 100, 0.6);
        R.info.share = { v: num(td), want: amt(a) / amt(all) * 100, note: d && d.note };
      });
      await step('run', async function () {
        var td = cell(G, Y[3], AI.Run), r = await clickCell(td), d = r.d;
        var cells = Y.slice(0, 4).map(function (p) { return { p: p, rows: rs(p) }; }), all = [].concat.apply([], cells.map(function (c) { return c.rows; }));
        R.chk.run = !!d && r.added === 1 && d.tables.length === 1 && leadOk(d.tables[0], 'Pivot column', cells) && !d.link
          && d.note === 'Run adds up ' + Y[0] + ' through ' + Y[3] + '.' && near(num(td), amt(all), 1.01);
        R.info.run = { v: num(td), want: amt(all), added: r.added, heads: d && d.tables[0] && d.tables[0].heads.slice(0, 3), note: d && d.note };
      });
      await step('runFirst', async function () {
        var r = await clickCell(cell(G, Y[0], AI.Run)), d = r.d;
        R.chk.runFirst = !!d && d.tables.length === 1 && !d.tables[0].lead && same(tIds(d.tables[0]), ids(rs(Y[0]))) && d.note.indexOf('Run starts with ' + Y[0]) === 0;
      });
      await step('idx', async function () {
        var td = cell(G, Y[2], AI.Idx), r = await clickCell(td), d = r.d, a = rs(Y[2]), b = rs(Y[0]);
        R.chk.idx = !!d && d.tables.length === 2 && d.secs[1].indexOf(Y[0] + ', the first column') === 0 && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b))
          && near(num(td), amt(a) / amt(b) * 100, 0.6);
        R.info.idx = { v: num(td), want: amt(a) / amt(b) * 100, secs: d && d.secs };
      });
      await step('ix23', async function () {
        var td = cell(G, Y[3], AI.Ix23), r = await clickCell(td), d = r.d, a = rs(Y[3]), b = rs('2023');
        var r2 = await clickCell(cell(G, '2023', AI.Ix23)), d2 = r2.d;
        R.chk.ix23 = !!d && d.tables.length === 2 && d.secs[1].indexOf('2023, the baseline') === 0 && same(tIds(d.tables[1]), ids(b)) && near(num(td), amt(a) / amt(b) * 100, 0.6)
          && !!d2 && d2.tables.length === 1 && d2.note.indexOf("2023 is Ix23's baseline (100)") === 0;
        R.info.ix23 = { v: num(td), want: amt(a) / amt(b) * 100, secs: d && d.secs, note2: d2 && d2.note };
      });
      await step('yoy', async function () {
        var td = cell(G, Y[3], AI.YoY), r = await clickCell(td), d = r.d, a = rs(Y[3]), b = rs(Y[2]);
        R.chk.yoy = !!d && d.tables.length === 2 && d.secs[1].indexOf(Y[2] + ', a year before') === 0 && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b))
          && near(num(td), (amt(a) - amt(b)) / amt(b) * 100, 0.6);
        var r0 = await clickCell(cell(G, Y[0], AI.YoY)), d0 = r0.d;
        R.chk.yoyNone = !!d0 && d0.tables.length === 1 && same(tIds(d0.tables[0]), ids(rs(Y[0]))) && d0.note.indexOf('There is no period a year before ' + Y[0]) === 0;
        R.info.yoy = { v: num(td), secs: d && d.secs, note0: d0 && d0.note };
      });
      await step('ly', async function () {
        var td = cell(G, Y[2], AI.LY), r = await clickCell(td), d = r.d, b = rs(Y[1]);
        R.chk.ly = !!d && d.tables.length === 1 && same(tIds(d.tables[0]), ids(b)) && near(num(td), amt(b), 1.01)
          && d.note === 'LY shows the same period a year before ' + Y[2] + ': ' + Y[1] + '. These are its rows.' && d.title.indexOf('LY: ') === 0;
        // none a year before: no dialog, a notice
        await closeAll();
        window.__HC_TOASTS = [];
        var r0 = await clickCell(cell(G, Y[0], AI.LY));
        R.chk.lyNone = r0.added === 0 && /There is no period a year before/.test(toasts());
        R.info.ly = { v: num(td), want: amt(b), note: d && d.note, added0: r0.added, toasts: toasts() };
      });
      await step('formula', async function () {
        var td = cell(G, Y[2], AI.Per), r = await clickCell(td);
        closeMenu(); rclick(td);
        var noMenuDrill = !!menu() && !menuItem('pvDrill');
        closeMenu();
        R.chk.formulaNone = r.added === 0 && !td.hasAttribute('data-pv-drv') && noMenuDrill;
      });
      await step('menu', async function () {
        var td = cell(G, Y[2], AI.Chg);
        closeMenu(); rclick(td);
        var it = menuItem('pvDrill'), title = itemTitle(it);
        R.info.menuHtml = it ? it.outerHTML.slice(0, 400) : null;
        var r = it ? await openBy(function () { it.click(); }) : { o: null, added: 0 }, d = readDlg(r.o);
        closeMenu();
        await closeAll();
        rclick(cell(G, Y[2], AI.Amt));
        var it2 = menuItem('pvDrill'), title2 = itemTitle(it2);
        closeMenu();
        R.chk.menuDrv = !!it && title === 'The rows of the cells this value is computed from' && !!d && d.tables.length === 2 && same(tIds(d.tables[1]), ids(rs(Y[1])));
        R.chk.menuBase = !!it2 && title2 === 'The rows behind this cell';
        R.info.menu = { title: title, title2: title2, secs: d && d.secs, it: !!it, it2: !!it2, html: R.info.menuHtml };
        R.info.menuDrv = R.info.menu; R.info.menuBase = R.info.menu;
      });
      await closeAll();
    },

    pdnob: async function () {
      var Y = periods('year'), G = 'North';
      AI.Chg = idxOf('Chg');
      await step('nob', async function () {
        var td = cell(G, Y[2], AI.Chg), r = await clickCell(td);
        closeMenu(); rclick(td);
        var m = !!menu() && !menuItem('pvDrill');
        closeMenu();
        R.chk.nobMarks = document.querySelectorAll('#pivotResultTable td[data-pv-drv]').length === 0 && valueCells(AI.Chg).length > 0 && r.added === 0 && m;
        R.info.nob = { drv: document.querySelectorAll('#pivotResultTable td[data-pv-drv]').length, added: r.added, menu: m };
      });
      await closeAll();
    },

    pdq: async function () {
      var Q = periods('yq'), G = 'North';
      ['Amt', 'YTD', 'R3', 'RS2', 'Cum', 'RunN', 'YoY'].forEach(function (l) { AI[l] = idxOf(l); });
      R.info.Q = Q;
      function rs(p, unfiltered) { return rowsOf([['G', G], ['Q', p]], !unfiltered); }
      function cellsOf(from, to, unf) { return Q.slice(from, to + 1).map(function (p) { return { p: p, rows: rs(p, unf) }; }); }
      function rowsIn(cs) { return [].concat.apply([], cs.map(function (c) { return c.rows; })); }
      var q23 = Q.indexOf('2023 Q3'), q23a = Q.indexOf('2023 Q1');
      await step('ytd', async function () {
        var td = cell(G, '2023 Q3', AI.YTD), r = await clickCell(td), d = r.d, cs = cellsOf(q23a, q23);
        R.chk.ytd = !!d && d.tables.length === 1 && leadOk(d.tables[0], 'Pivot column', cs) && near(num(td), amt(rowsIn(cs)), 1.01)
          && d.note === 'YTD adds up the year so far: 2023 Q1 through 2023 Q3.' && /filter: V_STATUS = Open/.test(d.title);
        R.info.ytd = { v: num(td), want: amt(rowsIn(cs)), note: d && d.note, title: d && d.title };
        // the frozen columns: the flat table freezes one, so a breakdown freezes its '#' and one more -
        // and a running value's, its Pivot column too
        var st = (document.getElementById('pnbBreakdownFreezeStyle') || {}).textContent || '';
        var id = d && d.tables[0] && d.tables[0].id;
        var r2 = await clickCell(cell(G, '2023 Q3', AI.Amt)), d2 = r2.d, id2 = d2 && d2.tables[0] && d2.tables[0].id;
        var st2 = (document.getElementById('pnbBreakdownFreezeStyle') || {}).textContent || '';
        // the last column frozen, by the generated rules for that table
        function maxK(css, tid) {
          var k = 0;
          while (tid && css.indexOf('table.pnb-breakdown[data-pnb-bd="' + tid + '"] > thead > tr > th:nth-child(' + (k + 1) + ')') >= 0) k++;
          return k;
        }
        var kLead = maxK(st, id), kBase = maxK(st2, id2);
        R.chk.freezeLead = kBase >= 2 && kLead === kBase + 1;
        R.info.freeze = { id: id, id2: id2, kLead: kLead, kBase: kBase, st: st.slice(0, 200) };
      });
      await step('ytdStart', async function () {
        var r = await clickCell(cell(G, '2023 Q1', AI.YTD)), d = r.d;
        R.chk.ytdStart = !!d && d.tables.length === 1 && !d.tables[0].lead && same(tIds(d.tables[0]), ids(rs('2023 Q1'))) && d.note.indexOf('2023 Q1 starts the year') === 0;
      });
      await step('roll', async function () {
        var j = Q.indexOf('2022 Q2'), td = cell(G, '2022 Q2', AI.R3), r = await clickCell(td), d = r.d, cs = cellsOf(j - 2, j);
        R.chk.roll = !!d && leadOk(d.tables[0], 'Pivot column', cs) && near(num(td), amt(rowsIn(cs)) / 3, 1.01)
          && d.note === 'R3 averages the last 3 columns: ' + Q[j - 2] + ' through 2022 Q2.';
        R.info.roll = { v: num(td), want: amt(rowsIn(cs)) / 3, note: d && d.note };
        var r2 = await clickCell(cell(G, Q[1], AI.R3)), d2 = r2.d;
        R.chk.rollPartial = !!d2 && leadOk(d2.tables[0], 'Pivot column', cellsOf(0, 1)) && / With fewer than 3 so far, it reads N\/A here\.$/.test(d2.note);
        R.info.rollPartial = d2 && d2.note;
      });
      await step('rollsum', async function () {
        var j = Q.indexOf('2024 Q1'), td = cell(G, '2024 Q1', AI.RS2), r = await clickCell(td), d = r.d, cs = cellsOf(j - 1, j);
        R.chk.rollsum = !!d && leadOk(d.tables[0], 'Pivot column', cs) && near(num(td), amt(rowsIn(cs)), 1.01) && /adds up the last 2 columns/.test(d.note);
        R.info.rollsum = { v: num(td), want: amt(rowsIn(cs)) };
      });
      await step('cum', async function () {
        var j = Q.indexOf('2022 Q1'), td = cell(G, '2022 Q1', AI.Cum), r = await clickCell(td), d = r.d, cs = cellsOf(0, j);
        var whole = rowsOf([['G', G]], true);
        R.chk.cum = !!d && leadOk(d.tables[0], 'Pivot column', cs) && near(num(td), amt(rowsIn(cs)) / amt(whole) * 100, 0.6) && /as a share of the row's total\.$/.test(d.note);
        R.info.cum = { v: num(td), want: amt(rowsIn(cs)) / amt(whole) * 100, note: d && d.note };
      });
      await step('runN', async function () {
        var j = Q.indexOf('2021 Q4'), td = cell(G, '2021 Q4', AI.RunN), r = await clickCell(td), d = r.d, cs = cellsOf(0, j, true);
        R.chk.runN = !!d && leadOk(d.tables[0], 'Pivot column', cs) && num(td) === rowsIn(cs).length && !/filter:/.test(d.title) && /^RunN counts the rows of /.test(d.note);
        R.info.runN = { v: num(td), want: rowsIn(cs).length, title: d && d.title };
      });
      await step('yoyQ', async function () {
        var td = cell(G, '2024 Q2', AI.YoY), r = await clickCell(td), d = r.d, a = rs('2024 Q2'), b = rs('2023 Q2');
        R.chk.yoyQ = !!d && d.tables.length === 2 && d.secs[1].indexOf('2023 Q2, a year before') === 0 && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b))
          && (amt(b) === 0 ? true : near(num(td), (amt(a) - amt(b)) / amt(b) * 100, 0.6));
        R.info.yoyQ = { v: num(td), a: amt(a), b: amt(b), secs: d && d.secs };
      });
      await closeAll();
    },

    pddown: async function () {
      var Y = periods('year'), C = 'Open';
      ['Amt', 'ChgD', 'RunD', 'YoYD', 'IdxD', 'R2D'].forEach(function (l) { AI[l] = idxOf(l); });
      function rs(p) { return rowsOf([['Y', p], ['S', C]]); }
      await step('chgDown', async function () {
        var td = cell(Y[2], C, AI.ChgD), r = await clickCell(td), d = r.d, a = rs(Y[2]), b = rs(Y[1]);
        R.chk.chgDown = !!d && d.tables.length === 2 && d.secs[0].indexOf(Y[2] + ', this row') === 0 && d.secs[1].indexOf(Y[1] + ', the row above') === 0
          && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b)) && near(num(td), (amt(a) - amt(b)) / amt(b) * 100, 0.6)
          && d.note === 'ChgD compares ' + Y[2] + ' with the row above it, ' + Y[1] + '.';
        R.info.chgDown = { v: num(td), want: (amt(a) - amt(b)) / amt(b) * 100, secs: d && d.secs, note: d && d.note };
      });
      await step('runDown', async function () {
        var td = cell(Y[3], C, AI.RunD), r = await clickCell(td), d = r.d;
        var cs = Y.slice(0, 4).map(function (p) { return { p: p, rows: rs(p) }; }), all = [].concat.apply([], cs.map(function (c) { return c.rows; }));
        R.chk.runDown = !!d && leadOk(d.tables[0], 'Pivot row', cs) && near(num(td), amt(all), 1.01);
        R.info.runDown = { v: num(td), want: amt(all), heads: d && d.tables[0] && d.tables[0].heads.slice(0, 3) };
      });
      await step('yoyDown', async function () {
        var td = cell(Y[3], C, AI.YoYD), r = await clickCell(td), d = r.d, a = rs(Y[3]), b = rs(Y[2]);
        R.chk.yoyDown = !!d && d.tables.length === 2 && d.secs[1].indexOf(Y[2] + ', a year before') === 0 && same(tIds(d.tables[1]), ids(b)) && near(num(td), (amt(a) - amt(b)) / amt(b) * 100, 0.6);
      });
      await step('idxDown', async function () {
        var td = cell(Y[2], C, AI.IdxD), r = await clickCell(td), d = r.d, a = rs(Y[2]), b = rs(Y[0]);
        R.chk.idxDown = !!d && d.tables.length === 2 && d.secs[1].indexOf(Y[0] + ', the first row') === 0 && same(tIds(d.tables[1]), ids(b)) && near(num(td), amt(a) / amt(b) * 100, 0.6);
      });
      await step('rollDown', async function () {
        var td = cell(Y[2], C, AI.R2D), r = await clickCell(td), d = r.d;
        var cs = Y.slice(1, 3).map(function (p) { return { p: p, rows: rs(p) }; }), all = [].concat.apply([], cs.map(function (c) { return c.rows; }));
        R.chk.rollDown = !!d && leadOk(d.tables[0], 'Pivot row', cs) && near(num(td), amt(all) / 2, 1.01) && /the last 2 rows/.test(d.note);
        R.info.rollDown = { v: num(td), want: amt(all) / 2, note: d && d.note };
      });
      await closeAll();
    },

    pdgrp: async function () {
      var Y = periods('year'), G = 'North';
      ['Amt', 'Chg', 'Run', 'Row%', 'YoY'].forEach(function (l) { AI[l] = idxOf(l); });
      function rs(p, g2) { return rowsOf([['G', G], ['Y', p]].concat(g2 ? [['G2', g2]] : [])); }
      await step('sumMarks', async function () {
        var tr = sumRow(G), ok = !!tr;
        ['Chg', 'Run', 'Row%'].forEach(function (l) {
          var cs = tr ? Array.prototype.slice.call(tr.querySelectorAll('td[data-pv-ai="' + AI[l] + '"]')) : [];
          if (!cs.length || !cs.every(function (td) { return td.hasAttribute('data-pv-drv') && td.getAttribute('data-pv-rk') === G; })) ok = false;
        });
        var yc = tr ? Array.prototype.slice.call(tr.querySelectorAll('td[data-pv-ai="' + AI.YoY + '"]')) : [];
        R.chk.sumMarks = ok && yc.length > 0 && yc.every(function (td) { return !td.hasAttribute('data-pv-drv'); })
          && valueCells(AI.YoY).some(function (td) { return td.hasAttribute('data-pv-drv'); });
      });
      await step('sumChg', async function () {
        var td = scell(G, Y[2], AI.Chg), r = await clickCell(td), d = r.d, a = rs(Y[2]), b = rs(Y[1]);
        R.chk.sumChg = !!d && d.tables.length === 2 && same(tIds(d.tables[0]), ids(a)) && same(tIds(d.tables[1]), ids(b)) && near(num(td), (amt(a) - amt(b)) / amt(b) * 100, 0.6);
        R.info.sumChg = { v: num(td), want: (amt(a) - amt(b)) / amt(b) * 100, n: d && d.tables.map(function (t) { return t.rows.length; }) };
      });
      await step('sumRun', async function () {
        var td = scell(G, Y[2], AI.Run), r = await clickCell(td), d = r.d;
        var cs = Y.slice(0, 3).map(function (p) { return { p: p, rows: rs(p) }; }), all = [].concat.apply([], cs.map(function (c) { return c.rows; }));
        R.chk.sumRun = !!d && r.added === 1 && leadOk(d.tables[0], 'Pivot column', cs) && near(num(td), amt(all), 1.01);
        R.info.sumRun = { v: num(td), want: amt(all), added: r.added };
      });
      await step('sumShare', async function () {
        var td = scell(G, Y[1], AI['Row%']), r = await clickCell(td), d = r.d;
        R.chk.sumShare = !!d && d.tables.length === 1 && same(tIds(d.tables[0]), ids(rs(Y[1]))) && near(num(td), amt(rs(Y[1])) / amt(rowsOf([['G', G]])) * 100, 0.6);
      });
      await step('bodyChg', async function () {
        var td = cell(G + '|||Tier 1', Y[1], AI.Chg), r = await clickCell(td), d = r.d;
        R.chk.bodyChg = !!d && d.tables.length === 2 && same(tIds(d.tables[0]), ids(rs(Y[1], 'Tier 1'))) && same(tIds(d.tables[1]), ids(rs(Y[0], 'Tier 1')));
      });
      await closeAll();
    },

    // base cells' dialogs, for run.py's live-against-stage comparison
    pdbase: async function () {
      var out = [];
      async function grab(k, td) {
        var r = await clickCell(td), o = overlays()[overlays().length - 1];
        out.push({ k: k, found: !!td, added: r.added, title: o ? (o.querySelector('.pnb-dlg-title') || {}).textContent : null,
          body: o ? (o.querySelector('.infobox-body') || {}).innerHTML : null, head: o ? ((o.querySelector('.infobox-head-action') || {}).innerHTML || '') : null });
        await closeAll();
      }
      var amt0 = idxOf('Amt'), n0 = idxOf('N');
      await step('grab', async function () {
        await grab('body', cell('North|||Tier 1', 'Open', amt0));
        await grab('bodyN', cell('North|||Tier 2', 'Closed', n0));
        await grab('rowGT', Array.prototype.filter.call((bodyRow('North|||Tier 1') || document).querySelectorAll('td.pivot-grand-total[data-row-key]'), function (x) { return true; })[0] || null);
        await grab('colFoot', Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable td[data-col-key]:not([data-row-key])'), function (x) { return x.getAttribute('data-col-key') === 'Pending'; })[0] || null);
        await grab('corner', document.querySelector('#pivotResultTable td[data-grand-total]'));
        await grab('summary', scell('North', 'Open', amt0));
      });
      R.info.dlg = out;
      R.chk.grabbed = out.length === 6 && out.every(function (x) { return x.found && x.added === 1 && x.body; });
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
