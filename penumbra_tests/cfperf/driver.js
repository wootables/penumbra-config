// cfperf suite - page half (2026-10-21): three sources of wasted work taken out of main.js,
// nothing styled differently. The REAL main.js (its ready closure kept, so the report's
// highlights load as on the page), counted by run.py's hook: window.__CNT.
//   cffmt  format() rules: a search and a clear restore NO cell content (no rewrite ran);
//          the same cells styled, the hidden rows' styles off, contents untouched; a row with
//          an 'original-bg' still gets it back
//   cfrw   rewrite(): a search still restores; the snippet edited to format() alone gets the
//          cells back, and the search after that restores nothing
//   cfhl   a report highlight rule only: one pass reads each cell ONCE (the reset pass reads
//          none) and still takes old styles off
//   gcf    the grouped view: cffmt's rules, a search restores nothing, the same cells styled
//   pcf    pivot: load, search, clear and Generate each build the pivot ONCE, styled the same;
//          the header rule, the saved sort and the collapse bar as before; a render handed the
//          wrong rules builds again, the right ones not
//   pcftxt pivot whose snippet shows text: Generate renders no snippet - one build, styled
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  var HLRGB = 'rgb(253, 230, 138)', RED = 'rgb(185, 28, 28)';
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  async function step(name, fn) { try { await fn(); } catch (e) { R.notes.push(name + ': ' + String((e && e.message) || e)); } }
  function C() { return window.__CNT || {}; }
  function cnt0() { window.__CNT = {}; }
  function H() { return window.__HC; }
  function hides() { return window.__HC_HIDES || 0; }
  function fx(i) { return (window.__rowsFixture || [])[i] || null; }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (/^p/.test(SCN) && !(await until(function () { return document.querySelectorAll('#pivotResultTable tbody td').length > 0; }, 20000))) throw new Error('no pivot cells');
    await sleep(900); await frames();
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
  }
  // a search the way the box runs it: Enter, then hideLoading
  async function search(q) {
    var b = document.getElementById('tableSearch');
    b.focus(); b.value = q;
    try { $(b).autocomplete('close'); } catch (e) { }
    var h0 = hides();
    // the search box's own run (the harness wires no Enter key): runTableSearch, then hideLoading
    H().runSearch();
    await until(function () { return hides() > h0; }, 30000);
    await sleep(700); await frames();
    b.blur();
  }
  function bg(el) { return el ? el.style.backgroundColor : ''; }
  function bold(el) { var w = el ? el.style.fontWeight : ''; return w === 'bold' || w === '700'; }

  // ---- the flat / grouped table ----
  function posIn(ths, name) { for (var i = 0; i < ths.length; i++) if (ths[i].getAttribute('data-colname') === name) return i; return -1; }
  function flatThs() { return document.querySelectorAll('#resultsTable > thead > tr#tableHeader th'); }
  function flatRows() { return Array.prototype.slice.call(document.querySelectorAll('#resultsTable > tbody > tr')); }
  function grpRows() { return Array.prototype.slice.call(document.querySelectorAll('#groupedResultsContainer table > tbody > tr')).filter(function (tr) { return !!tr.querySelector("td[data-column='#']"); }); }
  function grpThs() { var t = document.querySelector('#groupedResultsContainer .group-wrapper.group-leaf table > thead > tr'); return t ? t.querySelectorAll('th') : []; }
  function idxOf(tr) {
    var a = tr.getAttribute('data-row-index');
    if (a !== null) return parseInt(a, 10);
    var h = tr.querySelector("td[data-column='#']") || tr.cells[0];
    return parseInt(h ? h.textContent : '', 10) - 1;
  }
  // every shown (not search-hidden) row: the cell rule's cells and the row rule's rows, and no
  // other; hidden rows (opts.hidden) carry neither
  function oracle(rows, ths, cellCol, cellWant, rowWant, opts) {
    opts = opts || {};
    var p = posIn(ths, cellCol), bad = [], shown = 0, styled = 0, hidden = 0;
    if (p < 0) return { ok: false, why: 'no column ' + cellCol };
    rows.forEach(function (tr) {
      var r = fx(idxOf(tr)); if (!r) { bad.push('row?' + idxOf(tr)); return; }
      var td = tr.cells[p], isBg = bg(td) === HLRGB, isBold = bold(tr);
      if (tr.classList.contains('search-hidden')) {
        hidden++;
        if (opts.hidden && (isBg || isBold)) bad.push('hidden ' + r.V_ID + (isBg ? ' bg' : '') + (isBold ? ' bold' : ''));
        return;
      }
      shown++; if (isBg) styled++;
      if (isBg !== !!cellWant(r)) bad.push(r.V_ID + ' cell ' + (isBg ? 'styled' : 'plain'));
      if (rowWant && isBold !== !!rowWant(r)) bad.push(r.V_ID + ' row ' + (isBold ? 'bold' : 'plain'));
    });
    return { ok: bad.length === 0 && shown > 0 && styled > 0, shown: shown, styled: styled, hidden: hidden, bad: bad.slice(0, 6) };
  }
  function isOpen(r) { return r.V_STATUS === 'Open'; }
  function hasAlpha(r) { return /Alpha/.test(r.V_NAME); }
  function contents(rows, cols, ths) {
    var ps = cols.map(function (c) { return posIn(ths, c); }), out = {};
    rows.forEach(function (tr) { var i = idxOf(tr); out[i] = JSON.stringify(ps.map(function (p) { return tr.cells[p] ? tr.cells[p].innerHTML : null; })); });
    return out;
  }
  async function pageNext() {
    var b = document.getElementById('nextPageBtn'); if (!b) throw new Error('no next button');
    b.click(); await sleep(500); await frames();
  }

  // ---- the pivot ----
  function pvTable() { return document.getElementById('pivotResultTable'); }
  function num(td) { var t = String(td.textContent || '').replace(/[\s$,%]/g, ''), neg = /^\(.*\)$/.test(t); t = t.replace(/[()]/g, ''); if (!/^-?\d+(\.\d+)?$/.test(t)) return null; var v = parseFloat(t); return isFinite(v) ? (neg ? -v : v) : null; }
  function pvStyled(td) { return /253, 230, 138|#fde68a/i.test(td.getAttribute('style') || ''); }
  // every Amt value on screen - body, group summaries, the Grand Total column and row - styled
  // exactly when it is over 700; nothing else styled
  function pvOracle() {
    var t = pvTable(); if (!t) return { ok: false, why: 'no pivot' };
    var bad = [], vals = 0, styled = 0;
    Array.prototype.forEach.call(t.querySelectorAll('tbody td, tfoot td'), function (td) {
      if (td.closest('tr').style.display === 'none') return;
      var s = pvStyled(td), v = td.hasAttribute('data-row-field') ? null : num(td);
      if (v === null) { if (s) bad.push('label styled: ' + td.textContent.trim().slice(0, 20)); return; }
      vals++; if (s) styled++;
      if (s !== (v > 700)) bad.push(v + (s ? ' styled' : ' plain'));
    });
    return { ok: bad.length === 0 && vals > 0 && styled > 0, vals: vals, styled: styled, bad: bad.slice(0, 6) };
  }
  function pvHead(text) {
    var t = pvTable(); if (!t) return null;
    return Array.prototype.filter.call(t.querySelectorAll('thead th'), function (th) {
      var c = th.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.sort-icon, .col-sort-icon, .sort-rank, button'), function (n) { n.remove(); });
      return c.textContent.replace(/\s+/g, ' ').trim() === text;
    })[0] || null;
  }
  function P() { return window.Penumbra && window.Penumbra.pivotMenu; }
  async function rebuilt(h0) {
    await until(function () { return hides() > h0 && document.querySelectorAll('#pivotResultTable tbody td').length > 0; }, 30000);
    await sleep(900); await frames();
  }
  function sortOk() {
    var s = H().sort() || [];
    return s.length === 1 && /Grand Total/.test(String(s[0].colIdentifier)) && s[0].direction === 'desc';
  }

  var S = {
    cffmt: async function () {
      var snap = null;
      await step('load', async function () {
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.loadStyled = o.ok; R.info.load = o;
        var th = flatThs()[posIn(flatThs(), 'V_STATUS')];
        R.chk.hdr = !!th && th.style.color === RED;
        snap = contents(flatRows().slice(0, 200), ['V_ID', 'V_NAME', 'V_STATUS', 'V_AMOUNT', 'V_LINK'], flatThs());
      });
      await step('search', async function () {
        cnt0();
        await search('Alpha');
        var c = C();
        R.info.search = { rcs: c.resetCellStates || 0, writes: c.rcsWrites || 0 };
        R.chk.searchNoRestore = (c.resetCellStates || 0) >= 1 && !(c.rcsWrites > 0);
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, hasAlpha, { hidden: true });
        R.chk.searchStyled = o.ok && o.hidden > 0; R.info.searchO = o;
      });
      await step('clear', async function () {
        cnt0();
        await search('');
        var c = C();
        R.info.clear = { rcs: c.resetCellStates || 0, writes: c.rcsWrites || 0 };
        R.chk.clearNoRestore = (c.resetCellStates || 0) >= 1 && !(c.rcsWrites > 0);
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.clearStyled = o.ok; R.info.clearO = o;
        var now = contents(flatRows().slice(0, 200), ['V_ID', 'V_NAME', 'V_STATUS', 'V_AMOUNT', 'V_LINK'], flatThs()), diff = [];
        Object.keys(snap || {}).forEach(function (k) { if (now[k] !== snap[k]) diff.push(k); });
        R.chk.contentSame = !!snap && Object.keys(snap).length > 0 && diff.length === 0; R.info.contentDiff = diff.slice(0, 5);
      });
      await step('hiddenClean', async function () {
        // a search that hides styled rows (bold Alpha rows, Open cells): their styles come off
        await search('Bravo');
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, hasAlpha, { hidden: true });
        var hidStyledBefore = R.info.clearO && R.info.clearO.styled > 0;
        R.chk.hiddenClean = o.ok && o.hidden > 0 && hidStyledBefore; R.info.hidden = o;
        await search('');
      });
      await step('origBg', async function () {
        // a row a rule never styled but carrying an 'original-bg' (attribute / jQuery data) is
        // still given it back by the reset (resetCellStates' row pass)
        var rows = flatRows().filter(function (tr) { return !tr.classList.contains('search-hidden') && !hasAlpha(fx(idxOf(tr))) && tr.style.length === 0; });
        var a = rows[0], b = rows[1];
        if (!a || !b) throw new Error('no plain rows');
        a.setAttribute('data-original-bg', 'rgb(9, 9, 9)');
        $.data(b, 'original-bg', 'rgb(8, 8, 8)');
        H().rcs();
        R.chk.origBg = a.style.backgroundColor === 'rgb(9, 9, 9)' && b.style.backgroundColor === 'rgb(8, 8, 8)';
        R.info.origBg = [a.style.backgroundColor, b.style.backgroundColor];
        a.removeAttribute('data-original-bg'); $.removeData(b, 'original-bg'); a.style.backgroundColor = ''; b.style.backgroundColor = '';
      });
      await step('page', async function () {
        await pageNext();
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.page2Styled = o.ok && /2/.test((document.getElementById('pageInfo') || {}).textContent || ''); R.info.page2 = o;
      });
    },
    cfrw: async function () {
      function stCell(tr) { return tr.cells[posIn(flatThs(), 'V_STATUS')]; }
      // (rows the search keeps: a rewrite() writes those only - a hidden row shows the plain value
      // until the search lets it back, as it always has)
      function shownRw() {
        var bad = [];
        flatRows().slice(0, 200).forEach(function (tr) {
          var r = fx(idxOf(tr)), td = stCell(tr); if (!r || !td || td.hasAttribute('data-pnb-lazy') || tr.classList.contains('search-hidden')) return;
          var want = isOpen(r) ? ('OPEN-' + r.V_ID) : r.V_STATUS;
          if (td.textContent.trim() !== want) bad.push(r.V_ID + ':' + td.textContent.trim());
        });
        return bad;
      }
      function plain() {
        var bad = [];
        flatRows().slice(0, 200).forEach(function (tr) {
          var r = fx(idxOf(tr)), td = stCell(tr); if (!r || !td || td.hasAttribute('data-pnb-lazy')) return;
          if (td.textContent.trim() !== r.V_STATUS || td.querySelector('b')) bad.push(r.V_ID + ':' + td.textContent.trim());
        });
        return bad;
      }
      await step('load', async function () {
        var b = shownRw(); R.chk.rwShown = b.length === 0; R.info.rwShown = b.slice(0, 5);
        var o = oracle(flatRows(), flatThs(), 'V_NAME', hasAlpha, null);
        R.chk.rwFmt = o.ok; R.info.rwFmt = o;
      });
      await step('search', async function () {
        cnt0();
        await search('Alpha');
        var c = C();
        R.info.search = { rcs: c.resetCellStates || 0, writes: c.rcsWrites || 0 };
        R.chk.rwRestores = (c.rcsWrites || 0) > 0;
        var b = shownRw(), nRw = flatRows().filter(function (tr) { return !tr.classList.contains('search-hidden') && /^OPEN-/.test((stCell(tr) || {}).textContent || ''); }).length;
        R.chk.rwShownAfter = b.length === 0 && nRw > 0; R.info.rwShownAfter = { bad: b.slice(0, 5), rewritten: nRw };
        await search('');
      });
      await step('toFmt', async function () {
        // the rewrite() taken out of the snippet: the cells come back as the query returned them
        var ed = H().editor();
        ed.setValue("format(cell, V_NAME, V_NAME contains Alpha, 'background-color: #fde68a')");
        await sleep(1500);
        await H().render();
        await sleep(400); await frames();
        var b = plain(); R.chk.rwToFmt = b.length === 0; R.info.rwToFmt = b.slice(0, 5);
        var o = oracle(flatRows(), flatThs(), 'V_NAME', hasAlpha, null);
        R.chk.rwToFmtStyled = o.ok; R.info.rwToFmtO = o;
      });
      await step('fmtOnly', async function () {
        cnt0();
        await search('Bravo');
        var c = C();
        R.info.fmtOnly = { rcs: c.resetCellStates || 0, writes: c.rcsWrites || 0 };
        R.chk.fmtOnlyNoRestore = (c.resetCellStates || 0) >= 1 && !(c.rcsWrites > 0);
        var b = plain(); R.chk.fmtOnlyPlain = b.length === 0;
        await search('');
      });
    },
    cfhl: async function () {
      function mappedReadable() {
        // the cells one format pass reads: every shown row's cells under a named heading,
        // but a still-EMPTY (lazy) one
        var ths = flatThs(), ps = [];
        for (var i = 0; i < ths.length; i++) if (ths[i].getAttribute('data-colname')) ps.push(i);
        var n = 0;
        flatRows().forEach(function (tr) {
          if (tr.classList.contains('search-hidden')) return;
          ps.forEach(function (p) { var td = tr.cells[p]; if (td && !td.hasAttribute('data-pnb-lazy')) n++; });
        });
        return n;
      }
      await step('load', async function () {
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, null);
        R.chk.hlLoaded = o.ok; R.info.hlLoaded = o;
      });
      await step('reads', async function () {
        cnt0();
        H().acf(true);
        var c = C(), want = mappedReadable();
        R.info.reads = { reads: c.acfReads || 0, cells: want };
        R.chk.hlOneRead = want > 0 && (c.acfReads || 0) === want;
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, null);
        R.chk.hlPassStyled = o.ok;
      });
      await step('stale', async function () {
        // a style no rule set (one an earlier pass left) comes off in the pass: the reset still runs
        var p = posIn(flatThs(), 'V_NAME');
        var tr = flatRows().filter(function (x) { return !x.classList.contains('search-hidden'); })[3];
        tr.style.color = 'rgb(1, 2, 3)'; tr.cells[p].style.backgroundColor = 'rgb(1, 2, 3)';
        H().acf(true);
        R.chk.hlStaleOff = tr.style.color === '' && tr.cells[p].style.backgroundColor === '';
        R.info.stale = [tr.style.color, tr.cells[p].style.backgroundColor];
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, null);
        R.chk.hlStaleStyled = o.ok;
      });
      await step('page', async function () {
        await pageNext();
        var o = oracle(flatRows(), flatThs(), 'V_STATUS', isOpen, null);
        R.chk.hlPage2 = o.ok; R.info.hlPage2 = o;
      });
    },
    gcf: async function () {
      await step('load', async function () {
        if (!$('#groupedResultsContainer').is(':visible')) throw new Error('not grouped');
        var o = oracle(grpRows(), grpThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.gStyled = o.ok; R.info.gLoad = o;
      });
      await step('search', async function () {
        cnt0();
        await search('Alpha');
        var c = C();
        R.info.search = { rcs: c.resetCellStates || 0, writes: c.rcsWrites || 0 };
        R.chk.gNoRestore = (c.resetCellStates || 0) >= 1 && !(c.rcsWrites > 0);
        var o = oracle(grpRows(), grpThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.gSearchStyled = o.ok; R.info.gSearch = o;
        await search('');
        var o2 = oracle(grpRows(), grpThs(), 'V_STATUS', isOpen, hasAlpha);
        R.chk.gClearStyled = o2.ok; R.info.gClear = o2;
      });
    },
    pcf: async function () {
      await step('load', async function () {
        R.info.loadBuilds = C().generatePivotTable || 0;
        R.chk.pvOneBuild = (C().generatePivotTable || 0) === 1;
        var o = pvOracle(); R.chk.pvStyled = o.ok; R.info.pvLoad = o;
        var h = pvHead('Open'); R.chk.pvHdr = !!h && h.style.color === RED;
        R.chk.pvSort = sortOk(); R.info.sort = H().sort();
        // the collapse bar's work (injectPivotCollapseBar): the nested class, the toggles in place
        R.chk.pvBar = pvTable().classList.contains('is-nested-pivot') && pvTable().querySelectorAll('.pivot-collapse-toggle').length > 0;
      });
      await step('search', async function () {
        cnt0();
        await search('Open');
        R.info.searchBuilds = C().generatePivotTable || 0;
        R.chk.pvSearchOneBuild = (C().generatePivotTable || 0) === 1;
        var o = pvOracle(); R.chk.pvSearchStyled = o.ok && !pvHead('Closed'); R.info.pvSearch = o;
        R.chk.pvSearchSort = sortOk();
      });
      await step('clear', async function () {
        cnt0();
        await search('');
        R.info.clearBuilds = C().generatePivotTable || 0;
        R.chk.pvClearOneBuild = (C().generatePivotTable || 0) === 1;
        var o = pvOracle(); R.chk.pvClearStyled = o.ok && !!pvHead('Closed'); R.info.pvClear = o;
      });
      await step('generate', async function () {
        cnt0();
        var h0 = hides();
        P().rebuild(P().settings());
        await rebuilt(h0);
        R.info.genBuilds = C().generatePivotTable || 0;
        R.chk.pvGenOneBuild = (C().generatePivotTable || 0) === 1;
        var o = pvOracle(); R.chk.pvGenStyled = o.ok; R.info.pvGen = o;
        var h = pvHead('Open'); R.chk.pvGenHdr = !!h && h.style.color === RED;
        R.chk.pvGenBar = pvTable().classList.contains('is-nested-pivot') && pvTable().querySelectorAll('.pivot-collapse-toggle').length > 0;
      });
      await step('genStale', async function () {
        // the page's rules out of step with the custom code (an edit not applied yet):
        // Generate draws the code's own
        H().setRules([], []);
        var h0 = hides();
        P().rebuild(P().settings());
        await rebuilt(h0);
        var o = pvOracle(); R.chk.pvGenStale = o.ok; R.info.pvGenStale = o;
      });
      await step('sig', async function () {
        cnt0();
        await H().render(null, false, { pivotRulesSig: 'not the rules' });
        await sleep(300); await frames();
        R.info.sigWrong = C().generatePivotTable || 0;
        R.chk.pvSigMismatch = (C().generatePivotTable || 0) === 1;
        cnt0();
        var sig = H().sig();
        await H().render(null, false, { pivotRulesSig: sig });
        await sleep(300); await frames();
        R.info.sigRight = C().generatePivotTable || 0;
        R.chk.pvSigMatch = !!sig && (C().generatePivotTable || 0) === 0;
        var o = pvOracle(); R.chk.pvSigStyled = o.ok;
      });
    },
    pcftxt: async function () {
      await step('generate', async function () {
        var out = document.getElementById('reportSnippetOutput');
        R.info.out = out ? out.textContent.trim().slice(0, 60) : null;
        cnt0();
        var h0 = hides();
        P().rebuild(P().settings());
        await rebuilt(h0);
        R.info.genBuilds = C().generatePivotTable || 0;
        R.chk.txtShown = !!out && /Rows/.test(out.textContent);
        R.chk.txtGenOneBuild = (C().generatePivotTable || 0) === 1 && !(C().renderReportSnippet > 0);
        var o = pvOracle(); R.chk.txtGenStyled = o.ok; R.info.txtGen = o;
      });
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections || []).slice(0, 10);
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
