// sortpage suite - browser half (2026-09-30). After the load path settles, reads
// which rows page 1 shows and whether the table body is really in sorted order,
// and publishes window.__SPRESULT / window.__SPDONE for run.py.
//
// The bug: the on-load sort (a saved sort, ?sort=, a sort carried across a
// re-query) ran AFTER the load path's only applyPagination(), which had picked
// page 1 from the BUILD order - so page 1 showed the original first page
// re-ordered, and rows that belong at the top of the sort stayed hidden.
(function () {
  var HC = window.__HC || {};
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function num(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[$,\s]/g, '')); return isNaN(v) ? null : v; }

  (async function () {
    var R = { scn: window.__SCN };
    try {
      await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
      await sleep(500);
      var tb = document.querySelector('#resultsTable tbody');
      var rows = tb ? tb.rows : [];
      var master = HC.master ? HC.master() : [];
      var searchVisible = [], displayed = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.classList.contains('journal-note-child')) continue;
        if (!r.classList.contains('search-hidden')) searchVisible.push(i);
        if (r.style.display !== 'none') displayed.push(i);
      }
      var rpp = $('#rowsPerPageSelector').val();
      var n = (rpp === 'all') ? searchVisible.length : Math.min(parseInt(rpp, 10) || 0, searchVisible.length);
      // the sort key along the DOM order of the search-visible rows, from the row data
      function keysOf(col) {
        return searchVisible.map(function (pos) {
          var ix = parseInt(rows[pos].cells[0].textContent, 10) - 1;
          var m = master[ix];
          return m ? num(m.get(col)) : null;
        });
      }
      function monotonic(keys, desc) {
        for (var k = 1; k < keys.length; k++) {
          if (keys[k] === null || keys[k - 1] === null) continue;
          if (desc ? keys[k] > keys[k - 1] : keys[k] < keys[k - 1]) return false;
        }
        return true;
      }
      R.rows = rows.length;
      R.rpp = rpp;
      R.searchVisible = searchVisible.length;
      R.displayed = displayed.length;
      R.expectedFirst = searchVisible.slice(0, n);
      R.pageOk = JSON.stringify(displayed) === JSON.stringify(searchVisible.slice(0, n));
      R.firstDisplayedPos = displayed.slice(0, 5);
      R.lastDisplayedPos = displayed.slice(-5);
      R.pageInfo = $('#pageInfo').text();
      R.sortedHnumDesc = monotonic(keysOf('H_NUM'), true);
      R.sortedHmoneyDesc = monotonic(keysOf('H_MONEY'), true);
      R.searchValue = $('#tableSearch').val();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    R.hookErr = [window.__HC_ERR, window.__HC_ERR2].filter(Boolean).join('; ');
    window.__HCRESULT = R;
    window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
