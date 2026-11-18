// Diff parity suite - browser half (2026-11-17). The REAL main.js (ready closure unwrapped, window.__CF export
// hook - the cmpfoot suite's page) runs a REAL compare-to-live of one case of cases.json, and this reads the
// rendered comparison back: which rows landed in New / Removed / Modified / Unchanged, which cells of a Modified
// row are marked, and which report row every comparison row says it shows (data-pnb-src-index, cmpid).
// Rows are named by their RID cell. run.py compares the answer with the scheduler's for the same case.
(function () {
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) {} await sleep(25); }
    return false;
  }
  function finish(payload) {
    payload.pageErrors = errs().slice(0, 8);
    payload.hookErr = [window.__CF_ERR, window.__CF_ERR2, (window.__CF_MISSING || []).join(',')].filter(Boolean).join('; ');
    window.__CFRESULT = payload;
    window.__CFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};
  var H = window.__CF || {}, LIVE = window.__LIVE, SNAP = window.__SNAP, KEYS = window.__KEYS;
  var GROUP = { 'New Rows': 'new', 'Removed Rows': 'removed', 'Modified Rows': 'modified', 'Unchanged Rows': 'unchanged' };

  async function main() {
    if (!H.runCmp || !H.compress) { finish({ fatal: 'hook: a comparison entry point is not exported' }); return; }
    var booted = await waitFor(function () {
      return window.__queryDone >= 1 && document.querySelectorAll('#resultsTable tbody tr').length === LIVE.length;
    }, 30000);
    if (!booted) { finish({ fatal: 'the report did not render its ' + LIVE.length + ' rows' }); return; }
    await sleep(400);
    var snapCols = {};
    SNAP.forEach(function (r) { Object.keys(r).forEach(function (k) { snapCols[k.toUpperCase()] = true; }); });
    var snap = {
      name: 'Parity snapshot', timestamp: Date.now() - 86400000, searchTerm: '', prompts: [], tables: '', notes: '',
      columnNames: Object.keys(snapCols).sort(),
      compressedData: H.compress(JSON.stringify(SNAP.map(function (r) { return { rowData: r }; })))
    };
    var h0 = window.__CF_HIDES || 0;
    H.runCmp(snap, KEYS);
    var ok = await waitFor(function () {
      var c = document.getElementById('snapshotComparisonContainer');
      return c && document.body.classList.contains('snapshot-comparison-active') && (window.__CF_HIDES || 0) > h0;
    }, 20000);
    await sleep(300);
    if (!ok) {
      // No comparison on screen: the browser's "not comparable" (it says why in a notice)
      var note = document.getElementById('undo_text');
      finish({ groups: null, notice: note ? note.textContent.trim().slice(0, 300) : '' });
      return;
    }
    var out = { 'new': [], removed: [], modified: [], unchanged: [] }, identity = [];
    var ridToLive = {};
    LIVE.forEach(function (r, i) { if (!(r.RID in ridToLive)) ridToLive[r.RID] = i; });
    Array.prototype.forEach.call(document.querySelectorAll('#snapshotComparisonContainer .group-wrapper'), function (w) {
      var g = GROUP[w.getAttribute('data-group-key')];
      if (!g) return;
      var nameById = {}, ridId = null;
      Array.prototype.forEach.call(w.querySelectorAll('thead th[data-colname]'), function (th) {
        var n = String(th.getAttribute('data-colname')).toUpperCase();
        nameById[th.getAttribute('data-column')] = n;
        if (n === 'RID') ridId = th.getAttribute('data-column');
      });
      Array.prototype.forEach.call(w.querySelectorAll('tbody tr'), function (tr) {
        var ridTd = Array.prototype.filter.call(tr.cells, function (td) { return td.getAttribute('data-column') === ridId; })[0];
        var rid = ridTd ? ridTd.textContent.trim() : '?';
        if (g === 'modified') {
          var cols = [];
          Array.prototype.forEach.call(tr.querySelectorAll('td.snap-cell-modified'), function (td) { cols.push(nameById[td.getAttribute('data-column')] || '?'); });
          cols.sort();
          out.modified.push(rid + ':' + cols.join(','));
        } else {
          out[g].push(rid);
        }
        // cmpid: a Removed row names no report row (-1); every other row names the report row it shows
        var src = tr.getAttribute('data-pnb-src-index');
        var wantSrc = (g === 'removed') ? '-1' : String(ridToLive[rid]);
        if (src !== wantSrc) identity.push(g + ' ' + rid + ': data-pnb-src-index=' + src + ', want ' + wantSrc);
      });
    });
    Object.keys(out).forEach(function (k) { out[k].sort(); });
    finish({ groups: out, identity: identity });
  }
  main().catch(function (e) { finish({ fatal: 'driver threw: ' + ((e && e.stack) || e) }); });
})();
