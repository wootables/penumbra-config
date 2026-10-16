// scratchrows suite - browser half (2026-10-13). The REAL main.js "pasted rows in
// this view" path: the status bar's Data card -> the dialog -> a REPLAYED run that
// appends the rows (no second query.php request), the marks (tint, the Data line,
// the file name), a re-run dropping them (+ Add them back), Remove, the snapshot /
// email / row-control guards, refusals, markup in pasted text, and the admin
// Ctrl+V dialog's "this view only" choice. Hooks from run.py: window.__HC_DATA =
// the rows the render got; __HC_FN = getReportFilename.
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  var TSV3 = 'V_ID\tV name\tH_AMT\tEXTRA\r\nP-1\tPasted One\t$1,234.50\tx\r\nP-2\tPasted Two\t(12)\ty\r\nP-3\tPasted Three\tn/a\tz\r\n';
  var TSV2 = 'V_ID\tV_NAME\r\nQ-1\tSecond One\r\nQ-2\tSecond Two\r\n';
  function $1(s) { return document.querySelector(s); }
  function ov() { return $1('#pnbScratchOverlay'); }
  function scratchTrs() { return document.querySelectorAll('#resultsTable tbody tr.pnb-scratch-row'); }
  function bodyTrs() { return document.querySelectorAll('#resultsTable tbody tr').length; }
  function toast() { var t = $1('#action_overlay'); return t ? t.textContent.replace(/\s+/g, ' ') : ''; }
  function stamp() { var s = $1('#importTimestamps .pnb-scratch-ts'); return s ? s.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function rowByNum(n) {
    var trs = document.querySelectorAll('#resultsTable tbody tr');
    for (var i = 0; i < trs.length; i++) { if (trs[i].cells[0] && trs[i].cells[0].textContent === String(n)) return trs[i]; }
    return null;
  }
  async function openCard() {
    if (!$1('#sbDataSeg').classList.contains('sb-open')) $1('#sbDataSeg').click();
    await sleep(80);
  }
  async function cardButton(sel) {
    await openCard();
    await until(function () { return !!$1('#sbDataPop ' + sel); }, 2000);
    return $1('#sbDataPop ' + sel);
  }
  async function typeInto(text) {
    var ta = $1('#pnbScratchText');
    ta.value = text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(350);
  }
  async function addRows(tsv, expectTotal) {
    var b = await cardButton('.pnb-scratch-open');
    if (!b) throw new Error('no Add rows button in the Data card');
    b.click();
    if (!(await until(function () { return !!ov(); }, 2000))) throw new Error('no dialog');
    await typeInto(tsv);
    var go = $1('#pnbScratchGo');
    if (!go || go.disabled) throw new Error('Add button disabled: ' + ($1('#pnbScratchPlan') || {}).textContent);
    go.click();
    // (a wrong count is left for the scenario's checks to report, not thrown)
    if (!(await until(function () { return scratchTrs().length === expectTotal; }, 15000))) R.notes.push('rows: ' + scratchTrs().length + ' not ' + expectTotal);
    await sleep(300);
  }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  var S = {
    // add three rows through the Data card: matched by name / header, numbers read, replayed, marked
    add: async function () {
      var b = await cardButton('.pnb-scratch-open');
      R.chk.cardButton = !!b && /Add rows from the clipboard/.test(b.textContent);
      if (!b) return;
      b.click();
      await until(function () { return !!ov(); }, 2000);
      R.chk.dialog = !!ov() && !!$1('#pnbScratchText') && $1('#pnbScratchGo').disabled;
      await typeInto(TSV3);
      var plan = ($1('#pnbScratchPlan') || {}).textContent || '';
      R.info.plan = plan;
      R.chk.plan = /3 rows to add/.test(plan) && /Matched 3 of the report's 20 columns: V_ID, V_NAME, H_AMT/.test(plan) &&
        /left out: EXTRA/.test(plan) && /Not numbers, kept as text: H_AMT \(1\)/.test(plan);
      R.chk.goLabel = $1('#pnbScratchGo').textContent === 'Add 3 rows' && !$1('#pnbScratchGo').disabled;
      var q0 = window.__queryDone;
      $1('#pnbScratchGo').click();
      await until(function () { return scratchTrs().length === 3; }, 15000);
      await sleep(400);
      R.chk.noRequery = window.__queryDone === q0;
      R.chk.rows = bodyTrs() === 303;
      var t = scratchTrs();
      R.chk.tinted = t.length === 3 && t[0].cells[0].textContent === '301' && t[2].cells[0].textContent === '303' && !rowByNum(300).classList.contains('pnb-scratch-row');
      // (2026-10-15, WCAG 1.3.1) a hidden, TEXTLESS name in a pasted row's first cell; a report row has none
      var sm = t.length === 3 ? t[0].cells[0].querySelector('.pnb-scratch-sr') : null;
      R.chk.srMark = !!sm && sm.getAttribute('role') === 'img' && sm.getAttribute('aria-label') === 'pasted row' && sm.textContent === '' &&
        t[0].cells[0].textContent === '301' && !rowByNum(300).querySelector('.pnb-scratch-sr') &&
        Array.prototype.every.call(t, function (tr) { return tr.cells[0].querySelectorAll('.pnb-scratch-sr').length === 1; });
      var D = window.__HC_DATA || [];
      R.chk.values = D.length === 303 && D[300].V_ID === 'P-1' && D[300].V_NAME === 'Pasted One' && D[300].V_STATUS === '' && D[0].V_ID === 'ID-1001';
      R.chk.number = D.length === 303 && D[300].H_AMT === '1234.50' && D[301].H_AMT === '-12' && D[302].H_AMT === 'n/a';
      var r301 = rowByNum(301);
      R.chk.cellText = !!r301 && r301.querySelector('td[data-column="1"]').textContent === 'Pasted One';
      R.chk.stamp = /^Includes 3 pasted rows \(added .+\), not from the report's data source$/.test(stamp());
      R.info.stamp = stamp();
      $1('body').click(); await sleep(150);
      var rm = await cardButton('.pnb-scratch-remove');
      var pop = $1('#sbDataPop').textContent;
      R.chk.cardSection = !!rm && /Pasted rows \(this view only\)/.test(pop) && /Includes 3 pasted rows/.test(pop) && /Paste more rows/.test(pop);
      R.chk.filename = /_with_pasted_rows\.xlsx$/.test(window.__HC_FN('xlsx'));
      R.info.fn = window.__HC_FN('xlsx');
    },
    // an ordinary run drops them; its notice puts them back, by replay again
    rerun: async function () {
      await addRows(TSV3, 3);
      var q0 = window.__queryDone;
      $1('#executeQuery').click();
      await until(function () { return window.__queryDone > q0 && scratchTrs().length === 0; }, 15000);
      await sleep(400);
      R.chk.requeried = window.__queryDone === q0 + 1;
      R.chk.dropped = scratchTrs().length === 0 && bodyTrs() === 300 && (window.__HC_DATA || []).length === 300;
      R.chk.stampGone = stamp() === '';
      R.chk.fnameBack = !/_with_pasted_rows/.test(window.__HC_FN('xlsx'));
      R.chk.offer = /The report ran again, so the 3 pasted rows are no longer in the view\. Add them back/.test(toast());
      var q1 = window.__queryDone;
      var a = $1('#action_overlay .pnb-scratch-readd');
      if (a) a.click();
      await until(function () { return scratchTrs().length === 3; }, 15000);
      await sleep(300);
      R.chk.readded = scratchTrs().length === 3 && (window.__HC_DATA || [])[300].V_ID === 'P-1';
      R.chk.readdNoQuery = window.__queryDone === q1;
    },
    // Remove in the Data card: gone, no query, no "ran again" notice
    remove: async function () {
      await addRows(TSV3, 3);
      $1('body').click(); await sleep(150);
      var q0 = window.__queryDone;
      var rm = await cardButton('.pnb-scratch-remove');
      if (!rm) return;
      rm.click();
      await until(function () { return scratchTrs().length === 0; }, 15000);
      await sleep(400);
      R.chk.removed = scratchTrs().length === 0 && bodyTrs() === 300;
      R.chk.noRequery = window.__queryDone === q0;
      R.chk.noOffer = !/ran again/.test(toast());
      R.chk.stampGone = stamp() === '';
    },
    // a second paste adds to the first
    more: async function () {
      await addRows(TSV2, 2);
      $1('body').click(); await sleep(150);
      await addRows(TSV3, 5);
      var D = window.__HC_DATA || [];
      R.chk.five = scratchTrs().length === 5 && D.length === 305 && D[300].V_ID === 'Q-1' && D[302].V_ID === 'P-1';
      R.chk.stamp5 = /^Includes 5 pasted rows/.test(stamp());
    },
    // no snapshot / email while they are in the view; a pasted row's controls are inert
    guard: async function () {
      await addRows(TSV3, 3);
      var fired = { email: 0, snap: 0, rowBtn: 0, realBtn: 0 };
      var em = document.createElement('button'); em.id = 'sendEmailBtn'; em.textContent = 'Send';
      em.addEventListener('click', function () { fired.email++; });
      var sn = document.createElement('button'); sn.id = 'createNewSnapshotBtnV2'; sn.textContent = 'Snap';
      sn.addEventListener('click', function () { fired.snap++; });
      document.body.appendChild(em); document.body.appendChild(sn);
      em.click(); await sleep(50);
      R.chk.emailBlocked = fired.email === 0 && /An email would treat the pasted rows as the report's data/.test(toast());
      sn.click(); await sleep(50);
      R.chk.snapBlocked = fired.snap === 0 && /A snapshot would treat/.test(toast());
      var rb = document.createElement('button'); rb.textContent = 'J';
      rb.addEventListener('click', function () { fired.rowBtn++; });
      rowByNum(302).cells[1].appendChild(rb);
      var qb = document.createElement('button'); qb.textContent = 'J';
      qb.addEventListener('click', function () { fired.realBtn++; });
      rowByNum(5).cells[1].appendChild(qb);
      rb.click(); qb.click(); await sleep(50);
      R.chk.rowCtl = fired.rowBtn === 0 && /A pasted row is not in the database/.test(toast());
      R.chk.realRowOk = fired.realBtn === 1;
      // (2026-10-15, WCAG 4.1.2) the blocked control - added AFTER the render, as journal toggles are - is announced disabled
      await until(function () { return rb.getAttribute('aria-disabled') === 'true'; }, 1500);
      R.chk.ariaDisabled = rb.getAttribute('aria-disabled') === 'true' && !qb.hasAttribute('aria-disabled');
      R.info.ariaDis = [rb.getAttribute('aria-disabled'), qb.getAttribute('aria-disabled')];
      // taken out: everything works again
      $1('body').click(); await sleep(150);
      var rm = await cardButton('.pnb-scratch-remove');
      if (rm) rm.click();
      await until(function () { return scratchTrs().length === 0; }, 15000);
      await sleep(300);
      em.click(); sn.click(); await sleep(50);
      R.chk.afterRemove = fired.email === 1 && fired.snap === 1;
      R.info.fired = fired;
    },
    // nothing to match, one line only; Esc closes
    nomatch: async function () {
      var b = await cardButton('.pnb-scratch-open');
      if (!b) return;
      b.click();
      await until(function () { return !!ov(); }, 2000);
      await typeInto('FOO\tBAR\r\n1\t2\r\n');
      R.chk.refused = /None of the pasted column names are in this report/.test($1('#pnbScratchPlan').textContent) && $1('#pnbScratchGo').disabled;
      await typeInto('V_ID\r\n');
      R.chk.oneLine = /Paste the column names line and at least one row under it/.test($1('#pnbScratchPlan').textContent) && $1('#pnbScratchGo').disabled;
      await typeInto('V_ID\tEXTRA\r\n\tq\r\n');   // the only value is in a column the report lacks
      R.chk.blankRows = /Every pasted row is blank/.test($1('#pnbScratchPlan').textContent) && $1('#pnbScratchGo').disabled;
      $1('#pnbScratchText').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await sleep(50);
      R.chk.escCloses = !ov() && scratchTrs().length === 0;
    },
    // pasted text is text: no markup, no @@HTML / @@JSON
    xss: async function () {
      // (no double quotes: the paste is read as Excel copies cells, where " is quoting)
      await addRows('V_ID\tV_NAME\tV_STATUS\r\nX-1\t<img src=x onerror=window.__pwn=1>\t@@JSON[1,2]\r\nX-2\t@@HTML<b id=pwnb>bold</b>\tR&D <i>\r\n', 2);
      await sleep(300);
      var r1 = rowByNum(301), r2 = rowByNum(302);
      R.chk.noScript = !window.__pwn && !!r1 && r1.querySelector('td[data-column="1"]').textContent === '<img src=x onerror=window.__pwn=1>' && !r1.querySelector('img');
      R.chk.noHtml = !document.getElementById('pwnb') && !!r2 && r2.querySelector('td[data-column="1"]').textContent === 'HTML<b id=pwnb>bold</b>' &&
        r2.querySelector('td[data-column="5"]').textContent === 'R&D <i>' && !r2.querySelector('i');
      R.chk.noJson = !!r1 && !r1.querySelector('td[data-column="5"]').classList.contains('cell-contains-nested-table') && r1.querySelector('td[data-column="5"]').textContent === 'JSON[1,2]';
      R.info.cells = r1 && [r1.querySelector('td[data-column="1"]').innerHTML, r2.querySelector('td[data-column="1"]').innerHTML, r1.querySelector('td[data-column="5"]').innerHTML];
    },
    // an add whose Run never reached its request (a prompt cancelled - here the click
    // is swallowed) expires: an ordinary Run 16 s later does not carry it
    stale: async function () {
      // main.js starts the Run with $('#executeQuery').trigger('click'), which calls the
      // jQuery handler directly - so the swallow is at trigger()
      var realTrigger = jQuery.fn.trigger;
      jQuery.fn.trigger = function (ev) {
        if (this.length && this[0].id === 'executeQuery' && ev === 'click') return this;
        return realTrigger.apply(this, arguments);
      };
      var b = await cardButton('.pnb-scratch-open');
      if (!b) return;
      b.click();
      await until(function () { return !!ov(); }, 2000);
      await typeInto(TSV2);
      var q0 = window.__queryDone;
      $1('#pnbScratchGo').click();
      await sleep(800);
      R.chk.swallowed = scratchTrs().length === 0 && window.__queryDone === q0;
      jQuery.fn.trigger = realTrigger;
      await sleep(16000);
      $1('#executeQuery').click();
      await until(function () { return window.__queryDone > q0; }, 15000);
      await sleep(500);
      R.chk.notCarried = window.__queryDone === q0 + 1 && scratchTrs().length === 0 && bodyTrs() === 300;
    },
    // a viewer (no import rights) drops a file: the overlay says so, the file's rows
    // open in the preview, nothing is saved as an import, the report stays put
    drop: async function () {
      window.penumbra_vars.isGlobalAdmin = false; window.penumbra_vars.importGrant = null;
      var dt = new DataTransfer();
      dt.items.add(new File(['V_ID,V_NAME\nD-1,Dropped One\nD-2,Dropped Two\n'], 'extra.csv', { type: 'text/csv' }));
      document.body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await sleep(250);
      R.chk.overlaySays = /add its rows to this view/.test($1('#importDragOverlay p').textContent);
      var q0 = window.__queryDone, imp0 = window.__imports.length;
      document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await until(function () { return !!ov(); }, 4000);
      await sleep(200);
      R.chk.preview = !!ov() && $1('#pnbScratchText').hidden && ($1('.pnb-scratch-file') || {}).textContent === 'extra.csv' &&
        /2 rows to add/.test($1('#pnbScratchPlan').textContent);
      R.chk.noImport = window.__imports.length === imp0 && window.__queryDone === q0;
      if (!ov()) return;
      $1('#pnbScratchGo').click();
      await until(function () { return scratchTrs().length === 2; }, 15000);
      await sleep(300);
      var D = window.__HC_DATA || [];
      R.chk.added = scratchTrs().length === 2 && D.length === 302 && D[300].V_NAME === 'Dropped One' && window.__queryDone === q0 && window.__imports.length === imp0;
    },
    // an administrator's drop is still a new import (the overlay says import)
    dropadmin: async function () {
      var dt = new DataTransfer();
      dt.items.add(new File(['V_ID,V_NAME\nD-1,Dropped One\n'], 'extra.csv', { type: 'text/csv' }));
      document.body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await sleep(250);
      R.chk.overlayImport = /file to import/.test($1('#importDragOverlay p').textContent);
      document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      await until(function () { return window.__imports.some(function (b) { return b.action === 'save'; }); }, 4000);
      R.chk.imported = window.__imports.some(function (b) { return b.action === 'save' && b.import_name === 'EXTRA'; }) && !ov();
    },
    // grouped view (the stored report groups by H_GROUP): pasted rows keep their tint
    // in their groups, and a group holding one marks its header
    gview: async function () {
      await until(function () { return document.querySelectorAll('#groupedResultsContainer .group-wrapper').length > 0; }, 15000);
      await addRows('V_ID\tV_NAME\tH_GROUP\tH_AMT\r\nG-1\tGrp One\tNorth\t5\r\nG-2\tGrp Two\tZeta\t7\r\n', 2);
      await until(function () { return document.querySelectorAll('#groupedResultsContainer tr.pnb-scratch-row').length === 2; }, 15000);
      await sleep(400);
      var gt = document.querySelectorAll('#groupedResultsContainer tr.pnb-scratch-row');
      R.chk.rowsTinted = gt.length === 2 && /gradient/.test(getComputedStyle(gt[0].cells[1]).backgroundImage);
      function hdr(name) { var w = document.querySelector('#groupedResultsContainer .group-wrapper[data-group-key="' + name + '"]'); return w && w.querySelector(':scope > .group-header'); }
      var hn = hdr('North'), hz = hdr('Zeta'), hs = hdr('South');
      R.chk.headerMarked = !!hn && !!hz && getComputedStyle(hn).boxShadow.indexOf('inset') !== -1 && getComputedStyle(hz).boxShadow.indexOf('inset') !== -1;
      R.chk.otherClean = !!hs && getComputedStyle(hs).boxShadow.indexOf('inset') === -1 &&
        document.querySelectorAll('#groupedResultsContainer tr.pnb-scratch-row').length === 2;
      R.info.shadow = [hn && getComputedStyle(hn).boxShadow, hs && getComputedStyle(hs).boxShadow];
    },
    // pivot (H_GROUP > H_GROUP2 down, V_STATUS across, sum of H_AMT): the cells a
    // pasted row feeds are marked, its row gets the edge, nothing else
    pview: async function () {
      await until(function () { return !!$1('#pivotResultTable td[data-row-key]'); }, 15000);
      await addRows('V_ID\tH_GROUP\tH_GROUP2\tV_STATUS\tH_AMT\r\nP-1\tNorth\tTier 1\tOpen\t100\r\n', 1);
      await until(function () { return !!$1('#pivotResultTable [data-pnb-scratch]'); }, 15000);
      await sleep(400);
      var marked = Array.prototype.slice.call(document.querySelectorAll('#pivotResultTable td[data-pnb-scratch][data-row-key]'));
      var leaf = marked.filter(function (td) { return td.getAttribute('data-row-key') === 'North|||Tier 1'; });
      R.chk.cellMarked = leaf.length === 1 && leaf[0].getAttribute('data-col-key') === 'Open' && /gradient/.test(getComputedStyle(leaf[0]).backgroundImage);
      R.chk.otherClean = marked.every(function (td) { return /^North(\|\|\||$)/.test(td.getAttribute('data-row-key')) && td.getAttribute('data-col-key') === 'Open'; });
      var tr = $1('#pivotResultTable tr[data-pnb-scratch]');
      R.chk.rowEdge = !!tr && /North/.test(tr.getAttribute('data-pivot-row')) && document.querySelectorAll('#pivotResultTable tr[data-pnb-scratch]').length === 1;
      var foot = document.querySelectorAll('#pivotResultTable tfoot td[data-pnb-scratch]');
      R.chk.footMarked = foot.length >= 1 && Array.prototype.every.call(foot, function (td) { return td.getAttribute('data-col-key') === 'Open'; });
      // (2026-10-15, WCAG 1.3.1) every marked cell - values and the footer - carries ONE hidden, textless name; no other cell does
      var allMarked = document.querySelectorAll('#pivotResultTable td[data-pnb-scratch]');
      var labelled = document.querySelectorAll('#pivotResultTable td .pnb-scratch-sr');
      R.chk.cellLabel = allMarked.length >= 2 && labelled.length === allMarked.length &&
        Array.prototype.every.call(allMarked, function (td) {
          var m = td.querySelectorAll('.pnb-scratch-sr');
          return m.length === 1 && m[0].getAttribute('role') === 'img' && m[0].getAttribute('aria-label') === 'includes pasted rows' && m[0].textContent === '';
        });
      R.info.labelled = [allMarked.length, labelled.length];
      R.info.marked = marked.map(function (td) { return td.getAttribute('data-row-key') + ' / ' + td.getAttribute('data-col-key'); });
      R.info.foot = foot.length;
      // taken out: the pivot is clean again
      $1('body').click(); await sleep(150);
      var rm = await cardButton('.pnb-scratch-remove');
      if (rm) rm.click();
      await until(function () { return !$1('#pivotResultTable [data-pnb-scratch]') && scratchTrs().length === 0; }, 15000);
      await sleep(300);
      R.chk.cleanAfterRemove = !$1('#pivotResultTable [data-pnb-scratch]') && !!$1('#pivotResultTable td[data-row-key]');
    },
    // an administrator's Ctrl+V dialog offers "this view only"
    adminview: async function () {
      var dt = new DataTransfer(); dt.setData('text/plain', TSV2);
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      await until(function () { return !!$1('#pnbPasteOverlay'); }, 2000);
      var r = $1('#pnbPasteOverlay input[name="pnbPasteMode"][value="view"]');
      R.chk.offered = !!r;
      if (!r) return;
      r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
      R.chk.nextLabel = $1('#pnbPasteGo').textContent === 'Next';
      $1('#pnbPasteGo').click();
      await until(function () { return !!ov(); }, 2000);
      R.chk.planShown = !!ov() && $1('#pnbScratchText').hidden && /2 rows to add/.test($1('#pnbScratchPlan').textContent) && !$1('#pnbPasteOverlay');
      var q0 = window.__queryDone, saves = window.__imports.filter(function (b) { return b.action !== 'list'; }).length;
      $1('#pnbScratchGo').click();
      await until(function () { return scratchTrs().length === 2; }, 15000);
      await sleep(300);
      R.chk.added = scratchTrs().length === 2 && window.__queryDone === q0 && window.__imports.filter(function (b) { return b.action !== 'list'; }).length === saves;
    }
  };
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
