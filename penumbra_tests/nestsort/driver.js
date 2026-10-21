// nestsort suite - browser half (2026-10-20). One scenario per page load (?scn=...);
// each check compares an order the page shows with the order the fixture's own
// counts give (run.py wrote them into fixture.json while it built each value), so
// nothing here reuses the code under test. Publishes window.__HCRESULT / __HCDONE.
(function () {
  var HC = window.__HC || {};
  var FX = window.__FX, n = FX.rows.length, EX = FX.expect;
  var NUM = FX.rows.map(function (r) { return +r.V_NUM; });
  var STATUS = FX.rows.map(function (r) { return r.V_STATUS; });
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function range(k) { var a = []; for (var i = 0; i < k; i++) a.push(i); return a; }
  // the fixture's rows, stable: cmp, then the original order
  function ord(cmp, members) { var ix = (members || range(n)).slice(); ix.sort(function (a, b) { return cmp(a, b) || (a - b); }); return ix; }
  function byN(dir, col) { var e = EX[col || 'N_JSON']; return function (a, b) { return dir === 'desc' ? e[b] - e[a] : e[a] - e[b]; }; }
  function byNum(dir) { return function (a, b) { return dir === 'desc' ? NUM[b] - NUM[a] : NUM[a] - NUM[b]; }; }
  function byStatus(a, b) { return STATUS[a].localeCompare(STATUS[b], undefined, { sensitivity: 'base' }); }
  function chain() { var fs = arguments; return function (a, b) { for (var i = 0; i < fs.length; i++) { var r = fs[i](a, b); if (r) return r; } return 0; }; }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // the rows a tbody shows, as fixture indexes ('#' = the build's row number)
  function idxOf(tbody) { return Array.prototype.map.call(tbody ? tbody.rows : [], function (tr) { return parseInt(tr.cells[0].textContent, 10) - 1; }); }
  function flat() { return idxOf(document.querySelector('#resultsTable > tbody')); }
  function groupTables() {
    return Array.prototype.filter.call(document.querySelectorAll('#groupedResultsContainer table'), function (t) { return t.tHead && t.tHead.querySelector('th[data-colname]') && t.tBodies[0]; });
  }
  function groupsOk(cmp) {
    var ts = groupTables(); if (!ts.length) return false;
    return ts.every(function (t) { var got = idxOf(t.tBodies[0]); return got.length > 0 && eq(got, ord(cmp, got)); });
  }
  function groupsOriginal() {
    var ts = groupTables(); if (!ts.length) return false;
    return ts.every(function (t) { var got = idxOf(t.tBodies[0]); return eq(got, got.slice().sort(function (a, b) { return a - b; })); });
  }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function gth(name) { var t = groupTables()[0]; return t ? t.tHead.querySelector('th[data-colname="' + name + '"]') : null; }
  function click(el, shift) { if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: !!shift })); return true; }
  // the header menu (penumbra_colmenu.js), as the colmenu suite drives it
  function rclick(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.round(r.left + 6), clientY: Math.round(r.top + 6) }));
  }
  function closeMenu() { if (window.Penumbra && window.Penumbra.colMenu) window.Penumbra.colMenu.close(); }
  function item(act) { var m = document.getElementById('pnbHeadMenu'); return m ? m.querySelector('[data-act="' + act + '"]') : null; }
  function label(act) { var it = item(act); var l = it && it.querySelector('.pnb-hm-label'); return l ? l.textContent : (it ? it.textContent : null); }
  async function choose(el, act) { closeMenu(); rclick(el); var it = item(act); if (!it) { closeMenu(); return false; } it.click(); await sleep(450); return true; }
  // the letters fall as the count rises, so the cells' TEXT order is not their count order
  function nestedFmt(k) { return k == null ? null : '@@JSON' + JSON.stringify(range(k).map(function (j) { return { X: String.fromCharCode(122 - k) + j }; })); }

  var SC = {
    unit: async function (R) {
      var C = window.__CORPUS;
      R.corpus = C.map(function (c) { return HC.count ? HC.count(c.raw) : null; });
      R.chk.corpus = C.every(function (c, i) { return R.corpus[i] === c.expect; });
      R.corpusBad = C.map(function (c, i) { return R.corpus[i] === c.expect ? null : c.why + ': got ' + R.corpus[i] + ', want ' + c.expect; }).filter(Boolean);
      // the same values drawn as the page draws a cell, then read back from the cell
      R.cell = C.map(function (c) { var td = document.createElement('td'); td.className = 'cell-contains-nested-table'; td.innerHTML = HC.fmt(c.raw); return HC.cellRows ? HC.cellRows(td) : null; });
      R.chk.cellCorpus = C.every(function (c, i) { return R.cell[i] === c.expect; });
      R.cellBad = C.map(function (c, i) { return R.cell[i] === c.expect ? null : c.why + ': got ' + R.cell[i] + ', want ' + c.expect; }).filter(Boolean);
      R.fuzz = (window.__FUZZ || []).map(function (s) { return HC.count ? HC.count(s) : null; });
      // a comparison table: a changed cell holds the NOW table, then was + now again
      var cases = [{ was: 5, now: 2 }, { was: 1, now: 9 }, { same: 4 }, { was: 7, now: null }, { was: null, now: 3 }];
      var host = document.getElementById('snapshotComparisonContainer');
      var tbl = document.createElement('table');
      tbl.innerHTML = '<thead><tr><th data-column="#">#</th><th data-column="3" data-colname="N_JSON">N_JSON</th></tr></thead><tbody></tbody>';
      host.appendChild(tbl);
      cases.forEach(function (c, i) {
        var tr = document.createElement('tr'); tr.setAttribute('data-i', i);
        var td0 = document.createElement('td'); td0.textContent = String(i + 1); tr.appendChild(td0);
        var td = document.createElement('td'); td.setAttribute('data-column', '3'); td.className = 'cell-contains-nested-table';
        td.innerHTML = (c.same != null) ? HC.fmt(nestedFmt(c.same))
          : '<span class="snap-ba-now-only">' + HC.fmt(nestedFmt(c.now)) + '</span><span class="snap-ba-pair"><span class="snap-ba-label">[was:]</span> <span class="snap-ba-was-val">'
            + HC.fmt(nestedFmt(c.was)) + '</span><br><span class="snap-ba-label">[now:]</span> <span class="snap-ba-now-val">' + HC.fmt(nestedFmt(c.now)) + '</span></span>';
        tr.appendChild(td); tbl.tBodies[0].appendChild(tr);
      });
      R.cmpCells = Array.prototype.map.call(tbl.tBodies[0].rows, function (tr) { return HC.cellRows ? HC.cellRows(tr.cells[1]) : null; });
      R.chk.cmpCells = eq(R.cmpCells, [2, 9, 4, 0, 3]);
      HC.setSort([{ colIdentifier: 'N_JSON', colIndex: 3, direction: 'desc' }]);
      var out = HC.sortRows(Array.prototype.slice.call(tbl.tBodies[0].rows));
      HC.setSort([]);
      R.cmpOrder = out.map(function (tr) { return +tr.getAttribute('data-i'); });
      R.chk.cmpSort = eq(R.cmpOrder, [1, 2, 4, 0, 3]);
      host.removeChild(tbl);
    },
    click: async function (R) {
      R.chk.loadedUnsorted = eq(flat(), range(n));
      var th = fth('N_JSON');
      click(th); await sleep(300);
      R.ascFirst = flat().slice(0, 8).map(function (i) { return EX.N_JSON[i]; });
      R.chk.clickAsc = eq(flat(), ord(byN('asc')));
      R.chk.ariaAsc = fth('N_JSON').getAttribute('aria-sort') === 'ascending';
      click(fth('N_JSON')); await sleep(300);
      R.descFirst = flat().slice(0, 8).map(function (i) { return EX.N_JSON[i]; });
      R.chk.clickDesc = eq(flat(), ord(byN('desc')));
      R.chk.topFive = eq(flat().slice(0, 5).map(function (i) { return EX.N_JSON[i]; }), [73, 56, 55, 54, 51]);
      R.chk.ariaDesc = fth('N_JSON').getAttribute('aria-sort') === 'descending';
      click(fth('N_JSON')); await sleep(300);
      R.chk.clickReset = eq(flat(), range(n));
    },
    chain: async function (R) {
      click(fth('N_JSON')); await sleep(250); click(fth('N_JSON')); await sleep(250);   // most rows first
      click(fth('V_NUM'), true); await sleep(300);                                        // then V_NUM ascending
      R.chk.chainNumTie = eq(flat(), ord(chain(byN('desc'), byNum('asc'))));
      click(fth('V_STATUS')); await sleep(250);                                           // a fresh sort on V_STATUS
      click(fth('N_JSON'), true); await sleep(250); click(fth('N_JSON'), true); await sleep(300);   // then N_JSON, most first
      R.chk.chainUnder = eq(flat(), ord(chain(byStatus, byN('desc'))));
      R.chk.badges = !!fth('V_STATUS').querySelector('.sort-rank') && !!fth('N_JSON').querySelector('.sort-rank');
    },
    saved: async function (R) {
      R.chk.savedDesc = eq(flat(), ord(byN('desc')));
      R.chk.savedAria = fth('N_JSON').getAttribute('aria-sort') === 'descending';
    },
    savedhidden: async function (R) {
      R.chk.hiddenAsc = eq(flat(), ord(byN('asc', 'H_JSON')));
      R.chk.hiddenStillHidden = fth('H_JSON') && fth('H_JSON').style.display === 'none';
    },
    url: async function (R) {
      R.chk.urlDesc = eq(flat(), ord(byN('desc')));
    },
    grouped: async function (R) {
      await until(function () { return $('#groupedResultsContainer').is(':visible') && groupTables().length > 0; }, 10000);
      await sleep(300);
      R.groups = groupTables().length;
      R.chk.groupedSaved = groupsOk(byN('desc'));
      click(gth('N_JSON')); await sleep(300);          // descending -> off
      R.chk.groupedReset = groupsOriginal();
      click(gth('N_JSON')); await sleep(300);          // ascending
      R.chk.groupedAsc = groupsOk(byN('asc'));
      closeMenu(); rclick(gth('N_JSON'));
      R.gLabels = [label('sortAsc'), label('sortDesc')];
      R.chk.groupedMenuLabels = eq(R.gLabels, ['Sort fewest rows first', 'Sort most rows first']);
      closeMenu();
    },
    menu: async function (R) {
      closeMenu(); rclick(fth('N_JSON'));
      R.labels = [label('sortAsc'), label('sortDesc')];
      R.chk.menuLabels = eq(R.labels, ['Sort fewest rows first', 'Sort most rows first']);
      var it = item('sortDesc'); if (it) { it.click(); await sleep(450); }
      R.chk.menuSortDesc = eq(flat(), ord(byN('desc')));
      closeMenu(); rclick(fth('V_NUM'));
      R.plainLabels = [label('sortAsc'), label('sortDesc'), label('thenAsc'), label('thenDesc')];
      R.chk.menuPlainLabels = eq(R.plainLabels, ['Sort ascending', 'Sort descending', 'Then sort ascending', 'Then sort descending']);
      closeMenu();
      await choose(fth('V_NUM'), 'sortAsc');
      closeMenu(); rclick(fth('N_JSON'));
      R.thenLabels = [label('thenAsc'), label('thenDesc')];
      R.chk.menuThenLabels = eq(R.thenLabels, ['Then sort fewest rows first', 'Then sort most rows first']);
      it = item('thenDesc'); if (it) { it.click(); await sleep(450); }
      R.chk.menuThen = eq(flat(), ord(chain(byNum('asc'), byN('desc'))));
      // a nested-table column whose first 210 rows hold no table (the old look stopped at 200)
      closeMenu(); rclick(fth('L_JSON'));
      R.lateLabels = [label('sortAsc'), label('sortDesc')];
      R.chk.menuLate = eq(R.lateLabels, ['Sort fewest rows first', 'Sort most rows first']);
      it = item('sortDesc'); if (it) { it.click(); await sleep(450); }
      R.chk.menuLateSort = eq(flat(), ord(byN('desc', 'L_JSON')));
      closeMenu();
    },
    breakdown: async function (R) {
      var master = HC.master(), rows = master.slice(0, 60);
      HC.breakdown(rows, 'nestsort');
      await until(function () { return !!document.querySelector('table.pnb-breakdown tbody tr'); }, 5000);
      await sleep(300);
      var tbl = document.querySelector('table.pnb-breakdown');
      function bth(name) {
        return tbl ? Array.prototype.filter.call(tbl.tHead.rows[0].cells, function (h) { var c = h.cloneNode(true); var s = c.querySelector('.sort-icon'); if (s) s.remove(); return c.textContent.trim() === name; })[0] : null;
      }
      function bdIdx() { return idxOf(tbl && tbl.tBodies[0]); }
      var th = bth('N_JSON'), thNum = bth('V_NUM');
      R.chk.bdMarked = !!th && th.getAttribute('data-pnb-nested') === '1' && th.getAttribute('data-sort-type') === 'number';
      R.chk.bdPlainUnmarked = !!thNum && !thNum.hasAttribute('data-pnb-nested');
      var sixty = range(60);
      click(th); await sleep(300);                     // a breakdown sorts descending first
      R.chk.bdDesc = eq(bdIdx(), ord(byN('desc'), sixty));
      click(bth('N_JSON')); await sleep(300);
      R.chk.bdAsc = eq(bdIdx(), ord(byN('asc'), sixty));
      closeMenu(); rclick(bth('N_JSON'));
      R.bdLabels = [label('bdSortAsc'), label('bdSortDesc')];
      R.chk.bdLabels = eq(R.bdLabels, ['Sort fewest rows first', 'Sort most rows first']);
      closeMenu(); rclick(bth('V_NUM'));
      R.bdPlainLabels = [label('bdSortAsc'), label('bdSortDesc')];
      R.chk.bdPlainLabels = eq(R.bdPlainLabels, ['Sort ascending', 'Sort descending']);
      closeMenu();
    },
    custom: async function (R) {
      R.chk.customIgnored = eq(flat(), ord(byN('desc')));
    },
    plain: async function (R) {
      R.chk.plainNum = eq(flat(), ord(byNum('desc')));
    }
  };

  (async function () {
    var R = { scn: window.__SCN, chk: {} };
    try {
      await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 60000);
      await sleep(500);
      R.rows = document.querySelectorAll('#resultsTable > tbody > tr').length;
      if (!SC[window.__SCN]) throw new Error('no scenario ' + window.__SCN);
      await SC[window.__SCN](R);
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = window.__HC_ERR || '';
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
