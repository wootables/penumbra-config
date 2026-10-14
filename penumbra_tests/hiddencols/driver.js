// Hidden-columns suite - browser half (2026-09-30). Runs ONE scenario (?scn=)
// against whichever main.js the page loaded, then publishes
//   window.__HCRESULT = { scn, fp: {...}, census: {...}, errors: [...] }
// and window.__HCDONE = true. run.py loads the same scenario against the
// BASELINE build and the CANDIDATE and compares the fingerprints; the census
// (which hidden columns still hold EMPTY cells) is asserted on the candidate.
//
// A fingerprint is everything a user, an export or a later pass could observe:
// every element, attribute and text node of the table / grouped view, EXCEPT
// the inside of a hidden cell - the candidate builds those empty by design.
// Columns a scenario makes the app READ or SHOW (opts.cols) are compared in
// full, attributes and content, hidden or not.
(function () {
  var HC = window.__HC || {};
  var SCN = window.__SCN;
  var R = { scn: SCN, fp: {}, census: null, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function hides() { return window.__HC_HIDES || 0; }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }

  function fpDom(root, cols) {
    var out = [];
    if (!root) return ['<missing>'];
    cols = cols || [];
    (function walk(el, depth) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { var t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t) out.push(depth + ' #' + t); continue; }
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toLowerCase();
        var hiddenCell = tag === 'td' && n.style.display === 'none' && cols.indexOf(n.getAttribute('data-column')) === -1;
        var attrs = [];
        for (var i = 0; i < n.attributes.length; i++) {
          var a = n.attributes[i];
          if (a.name === 'data-pnb-lazy') continue;                       // the candidate's marker
          if (hiddenCell && a.name !== 'data-column' && a.name !== 'style' && a.name !== 'class') continue;
          attrs.push(a.name + '=' + a.value);
        }
        attrs.sort();
        out.push(depth + ' <' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>' + (hiddenCell ? ' [hidden]' : ''));
        if (!hiddenCell) walk(n, depth + 1);
      }
    })(root, 0);
    return out;
  }
  function fpFlat(cols) {
    return {
      table: fpDom(document.getElementById('resultsTable'), cols),
      count: $('#resultCount').text(), page: $('#pageInfo').text()
    };
  }
  function fpGrouped(cols) {
    return { groups: fpDom(document.getElementById('groupedResultsContainer'), cols), count: $('#resultCount').text() };
  }
  function census() {
    var per = {};
    var tds = document.querySelectorAll('#resultsTable td[data-pnb-lazy], #groupedResultsContainer td[data-pnb-lazy]');
    for (var i = 0; i < tds.length; i++) { var c = tds[i].getAttribute('data-column'); per[c] = (per[c] || 0) + 1; }
    var flatLazy = document.querySelectorAll('#resultsTable td[data-pnb-lazy]').length;
    // A cell still marked EMPTY must BE empty: anything that wrote into one
    // without going through the fill (resetCellStates, a rewrite) shows here.
    var lazyWithContent = 0;
    for (var j = 0; j < tds.length; j++) if (tds[j].innerHTML !== '') lazyWithContent++;
    var pending = [];
    try { pending = HC.lazyCols ? Array.from(HC.lazyCols()).sort(function (a, b) { return a - b; }) : null; } catch (e) { pending = 'n/a'; }
    return { flatLazy: flatLazy, perCol: per, pendingSet: pending, lazyWithContent: lazyWithContent };
  }
  function colId(name) { return String(window.__COLS.indexOf(name)); }
  function ids(names) { return names.map(colId); }

  async function boot() {
    await until(function () { return window.__queryDone >= 1 && hides() >= 1; }, 60000);
    await sleep(400);   // deferred tails: presets (100 ms), grouped/pivot handoffs, a11y nudge
  }
  // Settings panel -> tick columns -> Apply, the REAL path (applyColumnChanges).
  async function showColumns(names) {
    HC.openSettingsPanel();
    names.forEach(function (n) {
      var $cb = $('#spColumnList .sp-col-item[data-column="' + colId(n) + '"] .sp-col-check');
      if (!$cb.length) R.notes.push('no panel item for ' + n);
      $cb.prop('checked', true).trigger('change');
    });
    var before = hides();
    $('#spApply').prop('disabled', false).trigger('click');
    await until(function () { return hides() > before; }, 30000);
    await sleep(300);
  }
  async function search(q) {
    var before = hides();
    $('#tableSearch').val(q);
    HC.runTableSearch();
    await until(function () { return hides() > before; }, 30000);
    await sleep(300);
  }

  var S = {
    boot: async function () { R.fp.flat = fpFlat([]); },
    killswitch: async function () {
      // &lazycells=off: every cell is built up front - compare ALL cells.
      R.fp.flat = fpFlat(window.__COLS.map(function (n) { return colId(n); }));
    },
    killswitch2: async function () {
      // penumbra_vars.lazyCellsOff (js/penumbra_lazycells.off): every cell built up front.
      R.fp.flat = fpFlat(window.__COLS.map(function (n) { return colId(n); }));
    },
    show: async function () {
      var cols = ['H_TEXT', 'H_NUM', 'H_HTML', 'H_JSON', 'H_ENT', 'H_NL', 'H_NULL'];
      await showColumns(cols);
      R.fp.flat = fpFlat(ids(cols));
    },
    sortnum: async function () { R.fp.flat = fpFlat(ids(['H_NUM'])); },
    sorttext: async function () { R.fp.flat = fpFlat(ids(['H_ENT', 'H_TEXT'])); },
    group: async function () {
      await until(function () { return $('#groupedResultsContainer').is(':visible'); }, 10000);
      await sleep(300);
      R.fp.grouped = fpGrouped(ids(['H_GROUP', 'H_AMT']));
      R.fp.flat = fpFlat(ids(['H_GROUP', 'H_AMT']));
    },
    group2: async function () {
      await until(function () { return $('#groupedResultsContainer').is(':visible'); }, 10000);
      await sleep(300);
      R.fp.grouped = fpGrouped(ids(['H_GROUP', 'H_GROUP2', 'H_MONEY']));
    },
    groupsort: async function () {
      await until(function () { return $('#groupedResultsContainer').is(':visible'); }, 10000);
      await sleep(300);
      R.fp.grouped = fpGrouped(ids(['H_NUM']));
    },
    fmt: async function () {
      var cols = ids(['H_FLAG', 'H_NUM', 'H_TEXT', 'H_MONEY']);
      R.fp.flat0 = fpFlat(cols);
      await search('Alpha');
      R.fp.flat1 = fpFlat(cols);
      await search('');
      R.fp.flat2 = fpFlat(cols);
    },
    heat: async function () { R.fp.flat = fpFlat(ids(['H_NUM', 'H_AMT'])); },
    rewrite: async function () {
      R.fp.flat0 = fpFlat(ids(['H_CODE']));
      window.__clip.length = 0;
      await Promise.resolve(HC.executeChainStep('copy_distinct|H_CODE|,'));
      await sleep(100);
      R.fp.clip = window.__clip.slice();
      await showColumns(['H_CODE']);
      R.fp.flat1 = fpFlat(ids(['H_CODE']));
    },
    copydistinct: async function () {
      window.__clip.length = 0;
      await Promise.resolve(HC.executeChainStep('copy_distinct|H_TEXT|,'));
      await sleep(100);
      await Promise.resolve(HC.executeChainStep('copy_distinct|H_ENT'));
      await sleep(100);
      await Promise.resolve(HC.executeChainStep('copy_distinct|H_JSON-SUB_NAME|;'));
      await sleep(100);
      R.fp.clip = window.__clip.slice();
    },
    copydialog: async function () {
      window.__clip.length = 0;
      var $sel = $('#copyColumnSelector');
      $sel.html('<option value="H_ENT">H_ENT</option><option value="H_JSON-SUB_ID" data-nested-parent="H_JSON" data-nested-sub="SUB_ID" data-nested-colid="' + colId('H_JSON') + '">H_JSON-SUB_ID</option>');
      $sel.val('H_ENT');
      $('#confirmCopyBtn').trigger('click');
      await sleep(150);
      $sel.val('H_JSON-SUB_ID');
      $('#confirmCopyBtn').trigger('click');
      await sleep(150);
      R.fp.clip = window.__clip.slice();
    },
    template: async function () {
      R.fp.lines = HC.generateTemplateOutput('{V_ID}|{H_TEXT}|{H_ENT}|{H_HTML}|{H_NL}|{H_JSON-SUB_ID}|{H_NULL}');
    },
    nestedplan: async function () { R.fp.plan = HC.getNestedColumnPlan(); },
    search: async function () {
      await search('H_TEXT contains Alpha');
      R.fp.flat = fpFlat([]);
    },
    default7: async function () { R.fp.flat = fpFlat(ids(['V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', 'H_TEXT'])); },
    notice: async function () {
      var shown = HC.penumbraBigRenderNotice(20000, 150, 140);
      R.fp.notice = { shown: shown, msg: $('#loadingOverlay > p').first().text(), tip: $('#loadingTip').text() };
      var shown2 = HC.penumbraBigRenderNotice(20000, 150);
      R.fp.notice2 = { shown: shown2, msg: $('#loadingOverlay > p').first().text() };
    },
    wrap: async function () {
      // Duplicates of the shared id: one hidden, one visible after the real one.
      $('body').append('<div id="results-wrapper" style="display:none">dup-hidden</div><div id="results-wrapper" style="width:50px;height:0">dup-zero-height</div>');
      var viaJq = $('[id="results-wrapper"]:visible').get();
      var t = HC._pnbHorizontalScrollTargets();
      var w = HC._pnbVisibleResultsWrapper();
      var jqW = $('[id="results-wrapper"]:visible').filter(function () { return this.clientHeight > 0; }).get(0) || null;
      R.fp.wrap = {
        sameTargets: t.length === viaJq.length && t.every(function (el, i) { return el === viaJq[i]; }),
        n: t.length, sameWrapper: w === jqW, wrapperIsReal: w === document.querySelector('#table-view-container #results-wrapper')
      };
    }
  };

  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
      await sleep(50);
      R.census = census();
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
