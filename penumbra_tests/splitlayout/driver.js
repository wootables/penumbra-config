// Split header layout - browser suite (2026-09-18). Drives the REAL main.js
// (ready closure unwrapped, window.__SL export hook) against the REAL main.css,
// with the stage / pane / radio markup LIFTED from the index.php under test.
//   A  apply + move: the snippet node itself travels, and comes back to its slot
//   G  geometry: 50/50, the one-track header, who scrolls, the shared height cap
//   S  the grouped view: bands and pane both stick to the VIEWPORT
//   B  the SNAPSHOT band (the frozen ?snap= view): pills + buttons on the right under SPLIT ONLY;
//      Default and Dashboard keep the stacked band (B0 pins that scope)
//   X  the BARE HEADER option (2026-09-25): no crumb / card / watermark / F2 tab in
//      any layout, for everyone; keys, re-anchoring, save, the viewer path
//   E  section embeds stand the split down
//   D  a page with no stage markup builds its own
//   N  (?narrow=1, a 900px window) the stacked fallback (N5 = bare, stacked)
//   L  (?load=1) boot from a saved state with bareHeader: restore + re-edit
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 500) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 8), hookErr: [window.__SL_ERR, window.__SL_ERR2, (window.__SL_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  var NARROW = /[?&]narrow=1/.test(location.search);
  var LOAD = /[?&]load=1/.test(location.search);
  var H = window.__SL || {};
  function el(id) { return document.getElementById(id); }
  function hdr() { return el('reportHeaderContainer'); }
  function snip() { return el('reportSnippetOutput'); }
  function stage() { return el('pnbSplitStage'); }
  function pane() { return el('pnbSplitPane'); }
  function tvc() { return el('table-view-container'); }
  function wrap() { return el('results-wrapper'); }
  function box(e) { return e.getBoundingClientRect(); }
  function cs(e) { return getComputedStyle(e); }
  function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 1.5 : tol); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function px(v) { return Math.round(parseFloat(v) * 10) / 10; }
  function layout(mode) { if (H.applyHeaderLayout) H.applyHeaderLayout(mode); }
  function isSplit() { return !!(stage() && stage().classList.contains('is-split')); }
  function tracks(e) { return cs(e).gridTemplateColumns.split(' ').filter(Boolean).length; }
  function scrolls(e) { var c = cs(e); return /auto|scroll/.test(c.overflowX + ' ' + c.overflowY); }
  // The element siblings either side of a node - "the same slot" in the header.
  function slot(n) {
    var p = n.previousElementSibling, x = n.nextElementSibling;
    return (n.parentNode ? n.parentNode.id : 'null') + ':' + (p ? p.id : '-') + '|' + (x ? x.id : '-');
  }
  function comments(root, text) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
    while (w.nextNode()) if (w.currentNode.nodeValue === text) out.push(w.currentNode);
    return out;
  }

  var COLS = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'AMOUNT'];
  function makeRows(n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var row = {};
      for (var c = 0; c < COLS.length; c++) row[COLS[c]] = (COLS[c] === 'AMOUNT') ? String(i * 100) : ('value ' + COLS[c] + ' row ' + i + ' xx');
      out.push(row);
    }
    return out;
  }
  async function runQuery(rows) {
    window.__queryResponse = { data: rows };
    var ed = H.getEditor ? H.getEditor() : null;
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    var before = window.__ajaxLog.length;
    $('#executeQuery').trigger('click');
    for (var i = 0; i < 200; i++) {
      await sleep(25);
      if (window.__ajaxLog.length > before && (window.__rejections.length || !$('#loadingOverlay').is(':visible'))) break;
    }
    await sleep(400);
  }
  // The page boots as "no report loaded"; a report view shows the title panel.
  function showReportHeader() {
    $('#reportHeaderContainer').show().removeClass('is-collapsed');
    $('#reportInfoPanel').show();
    $('#defaultTitleView').hide();
  }
  // Two prompt chips in the markup updatePromptDisplay() writes, and the
  // container switched on the way it does (display:flex).
  function showPrompts() {
    $('#promptInfoList').html(
      '<li><a href="#" class="prompt-byline-link prompt-type-date"><em>From date:</em> <strong>01-JUL-25</strong></a></li>' +
      '<li><a href="#" class="prompt-byline-link prompt-type-date"><em>To date:</em> <strong>30-JUN-26</strong></a></li>');
    $('#promptInfoContainer').css('display', 'flex');
  }
  function fillSnippet() {
    var s = snip();
    s.innerHTML = '<div class="penumbra-card" id="slCard">Awards <b>42</b></div><canvas id="slCanvas" width="300" height="120"></canvas>';
    // A script element runs once, now. Moving its parent must not run it again.
    // (Measured 2026-09-18: neither a native move nor a jQuery .append() of an
    // ATTACHED node does - jQuery marks an attached subtree's scripts as already
    // evaluated. So this guards the invariant; it is the handler half of A4 and
    // the identity check in A1 that tell a MOVE from a rebuild.)
    var sc = document.createElement('script');
    sc.text = 'window.__slRuns = (window.__slRuns || 0) + 1;';
    s.appendChild(sc);
  }

  // ------------------------------------------------------------------------
  function phaseA() {
    showReportHeader();
    fillSnippet();
    var node = snip();
    node.__slMark = 42;
    var clicks = 0;
    $('#slCanvas').on('click.sl', function () { clicks++; });
    var home = slot(node);

    rec('A0 control: Default keeps the snippet in the header, in its own slot, and nothing is split',
      node.parentNode === hdr() && home === 'reportHeaderContainer:promptInfoContainer|hdrTail' && !isSplit() && window.__slRuns === 1 &&
      !hdr().classList.contains('layout-split'),
      'slot=' + home + ' split=' + isSplit() + ' runs=' + window.__slRuns);
    if (!H.applyHeaderLayout) { rec('A1 split re-hosts the snippet node', false, 'applyHeaderLayout not exported: ' + (window.__SL_MISSING || []).join(',')); return false; }

    layout('split');
    var p = pane();
    rec('A1 split re-hosts the SAME snippet node into the pane, beside the table',
      !!p && snip() === node && node.__slMark === 42 && node.parentNode === p && p.parentNode === stage() && tvc().parentNode === stage() && !tvc().contains(p),
      'parent=' + (node.parentNode && node.parentNode.id) + ' paneParent=' + (p && p.parentNode && p.parentNode.id) + ' tvcParent=' + (tvc().parentNode && tvc().parentNode.id));
    if (!p) return false;
    rec('A2 split marks the stage, the header and the body, and un-hides the pane',
      isSplit() && hdr().classList.contains('layout-split') && !hdr().classList.contains('layout-dashboard') &&
      document.body.classList.contains('pnb-layout-split') && !p.hidden && cs(p).display === 'block',
      'stage=' + stage().className + ' hdr=' + hdr().className + ' hidden=' + p.hidden + ' display=' + cs(p).display);
    rec('A3 the pane is a labelled, keyboard-reachable region (it owns a scrollbar)',
      p.nodeName === 'ASIDE' && !!p.getAttribute('aria-label') && p.getAttribute('tabindex') === '0',
      p.nodeName + ' label=' + p.getAttribute('aria-label') + ' tabindex=' + p.getAttribute('tabindex'));
    $('#slCanvas').trigger('click');
    rec('A4 it is a MOVE, not a rebuild: handlers on the snippet\'s children survive, and a script inside it does not run again',
      clicks === 1 && window.__slRuns === 1, 'clicks=' + clicks + ' scriptRuns=' + window.__slRuns);
    layout('split');
    rec('A5 applying split twice is idempotent: one placeholder, one snippet',
      comments(hdr(), 'pnbSplitHome').length === 1 && document.querySelectorAll('#reportSnippetOutput').length === 1 && node.parentNode === p,
      'placeholders=' + comments(hdr(), 'pnbSplitHome').length);

    layout('default');
    rec('A6 back to Default: the same node returns to the SAME slot, not the end of the header',
      snip() === node && slot(node) === home && comments(hdr(), 'pnbSplitHome').length === 0 && !isSplit() && p.hidden &&
      !hdr().classList.contains('layout-split') && !document.body.classList.contains('pnb-layout-split') && window.__slRuns === 1,
      'slot=' + slot(node) + ' want=' + home + ' runs=' + window.__slRuns);

    layout('split'); layout('dashboard');
    var crumbMoved = !!el('dashboardBreadcrumb') && el('dashboardBreadcrumb').parentNode === hdr();
    rec('A7 split -> Dashboard: the snippet is back in the header and Dashboard is fully on',
      node.parentNode === hdr() && hdr().classList.contains('layout-dashboard') && !hdr().classList.contains('layout-split') && !isSplit() && crumbMoved,
      'parent=' + node.parentNode.id + ' hdr=' + hdr().className + ' crumbMoved=' + crumbMoved);
    layout('split');
    // (2026-10-03: Split parks the breadcrumb in the header's corner too, so the
    // strip STAYS out of the title panel here; Dashboard's own timestamp row goes.)
    rec('A8 Dashboard -> split: Dashboard is fully undone (its timestamp row is gone; the breadcrumb stays in the header corner, which Split uses too)',
      node.parentNode === p && !hdr().classList.contains('layout-dashboard') && !el('dashboardTimestampRow') &&
      !!el('dashboardBreadcrumb') && el('dashboardBreadcrumb').parentNode === hdr() && document.querySelectorAll('.safe-home-link').length === 1,
      'hdr=' + hdr().className + ' crumbId=' + !!el('dashboardBreadcrumb') + ' tsRow=' + !!el('dashboardTimestampRow') + ' homeLinks=' + document.querySelectorAll('.safe-home-link').length);

    layout('bogus');
    rec('A9 an unknown layout value is Default', node.parentNode === hdr() && !isSplit(), 'parent=' + node.parentNode.id);

    var $radio = $('input[name="headerLayout"][value="split"]');
    if (!$radio.length) { rec('A10 the Split radio engages it and is what gets saved', false, 'no Split radio in the index.php under test'); }
    else {
      // buildStateObject() refuses to build a state for an empty query box.
      var ed = H.getEditor ? H.getEditor() : null;
      if (ed) ed.setValue('SELECT 1 FROM DUAL');
      $radio.prop('checked', true).trigger('change');
      var engaged = isSplit() && node.parentNode === pane();
      var st = null, stErr = '';
      try { st = H.buildState ? H.buildState() : null; } catch (e) { stErr = String(e); }
      var saved = st && st.viewOptions ? st.viewOptions.headerLayout : undefined;
      $('input[name="headerLayout"][value="default"]').prop('checked', true).trigger('change');
      var st2 = null; try { st2 = H.buildState ? H.buildState() : null; } catch (e2) {}
      var saved2 = st2 && st2.viewOptions ? st2.viewOptions.headerLayout : undefined;
      rec('A10 the Split radio engages it, is saved as headerLayout "split", and Default saves nothing',
        engaged && saved === 'split' && saved2 === undefined && !isSplit(),
        'engaged=' + engaged + ' saved=' + saved + ' afterDefault=' + saved2 + ' state=' + (st ? Object.keys(st).slice(0, 6).join('/') : String(st)) + ' vo=' + (st && st.viewOptions ? Object.keys(st.viewOptions).join('/') : 'none') + ' ' + stErr);
    }
    if (H.applyRestrictions) H.applyRestrictions({ headerLayout: 'split' });
    rec('A11 a viewer with no View Options panel gets it from the saved state', isSplit() && node.parentNode === p, 'split=' + isSplit());
    layout('default');
    return true;
  }

  // ------------------------------------------------------------------------
  async function phaseG() {
    await runQuery(makeRows(60));
    if (!wrap() && H.applyContainerization) H.applyContainerization();
    var w = wrap();
    var ok0 = !!w && document.querySelectorAll('#tableHeader th').length === 13 && document.querySelectorAll('#resultsTable > tbody > tr').length === 60;
    rec('G0 fixture: the real render path built a 13-column, 60-row table inside #results-wrapper', ok0,
      'wrapper=' + !!w + ' ths=' + document.querySelectorAll('#tableHeader th').length + ' rows=' + document.querySelectorAll('#resultsTable > tbody > tr').length + ' errs=' + errs().slice(0, 2).join(' / '));
    if (!ok0) return false;
    showReportHeader();
    // A viewer's page: no admin console between the header and the controls
    // bar. (main.js shows #admWrapper for the harness's admin user, and an open
    // console pushes the table down to its 250px floor - where every cap is the
    // same number and G4/G5 could not tell a right answer from a wrong one.)
    $('#admWrapper').hide();
    if (!snip().firstChild) fillSnippet();
    showPrompts();
    // The Default header's left-hand STACK (title over prompts), measured with
    // the snippet emptied so the stack alone sets the height: what the split
    // header has to beat to be called slim.
    var keepSnip = snip().innerHTML;
    snip().innerHTML = '';
    var hStack = box(hdr()).height;
    snip().innerHTML = keepSnip;
    // The DEFAULT header (2026-09-18): the "timestamp" and "imports" rows are
    // gone - they could never paint (the status bar owns both readouts) and
    // cost two 7px row gaps - but the two hidden ELEMENTS must stay: the status
    // bar, the PDF and Excel exports, data(timestamp) and snapshots read them.
    var ipb = box(el('reportInfoPanel')), qpb = box(el('promptInfoContainer'));
    var dts = el('dataLoadedTimestamp'), its = el('importTimestamps');
    rec('H1 the Default header is title / prompts / filler: no dead timestamp rows between them, and the hidden timestamp elements are still there',
      cs(hdr()).gridTemplateAreas === '"title snippet" "prompts snippet" ". snippet"' && (qpb.top - ipb.bottom) < 16 &&
      !!dts && !!its && hdr().contains(dts) && hdr().contains(its) && cs(dts).display === 'none' && cs(its).display === 'none',
      'areas=' + cs(hdr()).gridTemplateAreas + ' titleToPrompts=' + r1(qpb.top - ipb.bottom) + 'px hiddenElementsPresent=' + (!!dts && !!its));
    if (window.stackHeaders) window.stackHeaders();

    var fullW = box(tvc()).width;
    layout('split');
    if (!isSplit()) { rec('G1 the two sides are equal halves of the stage', false, 'split did not engage'); return false; }
    var s = box(stage()), t = box(tvc()), p = box(pane());
    var gap = px(cs(stage()).columnGap) || 0;
    rec('G1 the two sides are equal halves of the stage, table left and pane right, tops level',
      near(t.width, p.width) && near(t.width, (s.width - gap) / 2) && near(t.left, s.left) && near(p.right, s.right) && p.left >= t.right && near(t.top, p.top) && fullW > t.width * 1.8,
      'stage=' + r1(s.width) + ' gap=' + gap + ' table=' + r1(t.width) + ' pane=' + r1(p.width) + ' tops=' + r1(t.top) + '/' + r1(p.top) + ' fullBefore=' + r1(fullW));

    // The header is ONE slim row: the title block, and the prompts in the column
    // the snippet vacated.
    var panel = el('reportInfoPanel'), pr = el('promptInfoContainer');
    var pb = box(panel), qb = box(pr), hSplit = box(hdr()).height;
    var sameRow = qb.top < pb.bottom && qb.bottom > pb.top && qb.left >= pb.right - 1;
    var rightEdge = box(hdr()).right - (parseFloat(cs(hdr()).paddingRight) || 0) - (parseFloat(cs(hdr()).borderRightWidth) || 0);
    var cr = el('dashboardBreadcrumb'), crb = cr ? box(cr) : { left: 0, right: 0, top: 0, bottom: 0, height: 0 };
    rec('G2 the header is one SLIM row: prompts beside the title (right-aligned, ending 24px short of the breadcrumb in the corner), not under it',
      sameRow && near(qb.right, crb.left - 24, 2) && cs(hdr()).gridTemplateAreas === '"title prompts breadcrumb"' && hSplit <= hStack - 55,
      'height=' + r1(hSplit) + ' vs the Default stack ' + r1(hStack) + ' sameRow=' + sameRow + ' promptsRight=' + r1(qb.right) + '/' + r1(rightEdge) + ' areas=' + cs(hdr()).gridTemplateAreas);
    // The breadcrumb strip (2026-10-03): out of the title panel and into the
    // header's upper right corner, after the prompts - so the title
    // is the first thing in its panel and the strip costs the header no row.
    var topEdge = box(hdr()).top + (parseFloat(cs(hdr()).paddingTop) || 0) + (parseFloat(cs(hdr()).borderTopWidth) || 0);
    rec('K1 Split parks the breadcrumb in the header\'s UPPER RIGHT corner: out of the title panel, at the right edge, at the top, the prompts to its left',
      !!cr && cr.parentNode === hdr() && !!cr.querySelector('.safe-home-link') && !panel.querySelector('.safe-home-link') &&
      panel.firstElementChild === el('mainReportTitle') && crb.height > 5 &&
      near(crb.right, rightEdge, 2) && near(crb.top, topEdge, 2) && crb.left >= qb.right - 1 && crb.left >= pb.right - 1 && near(hSplit, Math.max(pb.height, qb.height) + 2 * (topEdge - box(hdr()).top), 3),
      cr ? ('parent=' + cr.parentNode.id + ' crumbRight=' + r1(crb.right) + '/' + r1(rightEdge) + ' crumbTop=' + r1(crb.top) + '/' + r1(topEdge) + ' crumbBottom=' + r1(crb.bottom) + ' promptsTop=' + r1(qb.top) + ' crumbLeft=' + r1(crb.left) + ' titleRight=' + r1(pb.right)) : 'no #dashboardBreadcrumb');
    layout('default');
    var backStrip = document.querySelector('#reportInfoPanel > div:first-child');
    rec('K2 back in Default the strip returns to the top of the title panel, above the title',
      !el('dashboardBreadcrumb') && !!backStrip && !!backStrip.querySelector('.safe-home-link') && document.querySelectorAll('.safe-home-link').length === 1 &&
      box(backStrip).bottom <= box(el('mainReportTitle')).top + 1,
      'moved=' + !!el('dashboardBreadcrumb') + ' firstChild=' + (el('reportInfoPanel').firstElementChild && el('reportInfoPanel').firstElementChild.tagName) + ' homeLinks=' + document.querySelectorAll('.safe-home-link').length);
    layout('split');
    var cols = cs(hdr()).gridTemplateColumns;
    hdr().classList.add('has-pct-snippet');
    var colsPct = cs(hdr()).gridTemplateColumns, areasPct = cs(hdr()).gridTemplateAreas;
    hdr().classList.remove('has-pct-snippet');
    rec('G2b a % chart cannot bring the Default header\'s title|snippet columns back',
      cols === colsPct && areasPct === '"title prompts breadcrumb"' && tracks(hdr()) === 3, 'columns=[' + cols + '] withPctChart=[' + colsPct + ']');

    // The Subscribe chip, built the way initReportSubscriptions() builds it
    // (a button in #pnbSubscribeSlot, the slot .show()n). Under the subtitle it
    // would put a whole row back into the slim header; beside the title it is free.
    function chipOn() { $('#pnbSubscribeSlot').html('<button type="button" id="pnbSubscribeBtn" class="pnb-sub-chip"><span class="pnb-sub-chip-txt">Subscribe</span></button>').show(); }
    function chipOff() { $('#pnbSubscribeSlot').empty().hide(); }
    var hNoChip = box(hdr()).height;
    chipOn();
    var tb = box(el('mainReportTitle')), cb = box(el('pnbSubscribeBtn')), hChip = box(hdr()).height;
    var beside = cb.left >= tb.right - 1 && cb.top < tb.bottom && cb.bottom > tb.top && cb.width > 20;
    var panelDiag = 'panel display=' + cs(el('reportInfoPanel')).display + ' inline=[' + el('reportInfoPanel').getAttribute('style') + '] slotInline=[' + el('pnbSubscribeSlot').getAttribute('style') + ']';
    layout('default');
    var tbD = box(el('mainReportTitle')), cbD = box(el('pnbSubscribeBtn'));
    var underInDefault = cbD.top >= tbD.bottom - 1 && near(cbD.left, tbD.left, 3);
    layout('split');
    rec('G2c the Subscribe chip rides BESIDE the title and costs the slim header no height (Default still puts it under the title)',
      beside && hChip <= hNoChip + 1 && underInDefault,
      'header=' + r1(hChip) + ' vs ' + r1(hNoChip) + ' without a chip; chipLeft=' + r1(cb.left) + ' titleRight=' + r1(tb.right) + ' beside=' + beside + ' underInDefault=' + underInDefault + ' ' + panelDiag);
    // A very long title with no prompts beside it: the chip must still leave the
    // 340px its multi-schedule popover opens into (it opens from the chip's LEFT edge).
    var keepTitle = el('mainReportTitle').textContent;
    $('#promptInfoContainer').hide();
    // ...and no breadcrumb in the corner either (2026-10-03: the strip's column would
    // keep the chip off the edge by itself; the Bare header hides it, so hide it here).
    var crG = el('dashboardBreadcrumb'); if (crG) crG.style.setProperty('display', 'none', 'important');
    $('#mainReportTitle').text('Awards and proposals by contributing college, department and sponsor type over the past five fiscal years to date with interdisciplinary share');
    var cbL = box(el('pnbSubscribeBtn')), tbL = box(el('mainReportTitle')), vwL = document.documentElement.clientWidth;
    rec('G2d a very long title cannot push the chip to the edge: its 340px popover still fits on screen, and the chip stays on the title\'s rows',
      cbL.left + 340 <= vwL && cbL.left >= tbL.right - 1 && cbL.top < tbL.bottom && cbL.bottom > tbL.top && tbL.height > 40,
      'chipLeft=' + r1(cbL.left) + ' +340=' + r1(cbL.left + 340) + ' viewport=' + vwL + ' titleHeight=' + r1(tbL.height));
    $('#mainReportTitle').text(keepTitle);
    if (crG) crG.style.removeProperty('display');
    showPrompts();
    // The grid is display:!important - it has to be, the panel carries the
    // INLINE display:block jQuery's .show() writes - so it must not resurrect a
    // panel main.js has hidden (the snapshot band and the landing page do that).
    $('#reportInfoPanel').hide();
    var staysHidden = cs(el('reportInfoPanel')).display === 'none' && box(el('reportInfoPanel')).height === 0;
    $('#reportInfoPanel').show();
    rec('G2e a title panel main.js has hidden STAYS hidden with a chip in it, and comes back as the grid',
      staysHidden && cs(el('reportInfoPanel')).display === 'grid', 'hiddenWhileHidden=' + staysHidden + ' shownAgainAs=' + cs(el('reportInfoPanel')).display);
    chipOff();
    rec('G2f without a chip the title panel is its ordinary block self', cs(el('reportInfoPanel')).display === 'block', 'display=' + cs(el('reportInfoPanel')).display);

    rec('G3 the stage and the table side never scroll; the pane scrolls itself',
      !scrolls(stage()) && !scrolls(tvc()) && scrolls(pane()) && cs(stage()).display === 'grid',
      'stage=' + cs(stage()).overflowX + '/' + cs(stage()).overflowY + ' tvc=' + cs(tvc()).overflowX + '/' + cs(tvc()).overflowY + ' pane=' + cs(pane()).overflowY);

    if (H.updateContainerHeight) H.updateContainerHeight();
    var capW = px(cs(w).maxHeight), capP = px(cs(pane()).maxHeight);
    // What takes up room between the header and the controls bar (diagnostic).
    var between = Array.prototype.filter.call(document.body.children, function (c) {
      var b = box(c); return b.height > 8 && b.top >= box(hdr()).bottom - 1 && b.bottom <= box(el('resultsHeader')).top + 1;
    }).map(function (c) { return (c.id || c.nodeName) + ':' + Math.round(box(c).height); }).join(',');
    rec('G4 the pane takes the table box\'s own height cap (and the fixture is off the 250px floor)', capW > 300 && near(capW, capP, 0.6),
      'wrapper=' + capW + ' pane=' + capP + ' innerH=' + window.innerHeight + ' hdr=' + r1(box(hdr()).top) + '+' + r1(box(hdr()).height) + ' bar=' + r1(box(el('resultsHeader')).top) + '+' + r1(box(el('resultsHeader')).height) + ' stageTop=' + r1(box(stage()).top) + ' wrapTop=' + r1(box(w).top) + ' between=[' + between + ']');
    // Something ABOVE both boxes (an open admin console): the wrapper's cap
    // shrinks because its top moved. Only updateContainerHeight() is called -
    // the observers that would also fire are stubbed - so this proves both that
    // the pane follows the WRAPPER (not the chrome arithmetic) and who tells it.
    var spacer = document.createElement('div');
    spacer.id = 'slSpacer'; spacer.style.height = '120px';
    stage().parentNode.insertBefore(spacer, stage());
    if (H.updateContainerHeight) H.updateContainerHeight();
    var capW2 = px(cs(w).maxHeight), capP2 = px(cs(pane()).maxHeight);
    spacer.parentNode.removeChild(spacer);
    if (H.updateContainerHeight) H.updateContainerHeight();
    rec('G5 with 120px pushed in above them, both caps shrink together',
      capW2 < capW - 100 && near(capW2, capP2, 0.6) && near(px(cs(pane()).maxHeight), capW, 0.6),
      'before=' + capW + ' wrapper=' + capW2 + ' pane=' + capP2 + ' restored=' + px(cs(pane()).maxHeight));

    var bar = el('resultsHeader');
    var wantTop = Math.round(box(hdr()).height + box(bar).height + (parseFloat(cs(bar).marginBottom) || 0));
    rec('G6 the pane is sticky just below the chrome: header + controls bar + the bar\'s margin',
      cs(pane()).position === 'sticky' && near(px(cs(pane()).top), wantTop, 1.5) && wantTop > 40,
      'position=' + cs(pane()).position + ' top=' + cs(pane()).top + ' want=' + wantTop);

    rec('G7 a table wider than its half scrolls sideways INSIDE the left half',
      w.scrollWidth > w.clientWidth + 100 && box(w).right <= box(pane()).left + 0.5 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      'scrollW=' + w.scrollWidth + ' clientW=' + w.clientWidth + ' wrapRight=' + r1(box(w).right) + ' paneLeft=' + r1(box(pane()).left) + ' pageScrollW=' + document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth);

    // Short content, then content far taller than the cap: the scrollbar that
    // appears must not change the width a % chart resolves against.
    var sn = snip();
    var keep = sn.innerHTML;
    sn.innerHTML = '<div id="slShort" style="height:40px">short</div>';
    var wShort = box(sn).width, scrollShort = pane().scrollHeight > pane().clientHeight;
    sn.innerHTML = '<div id="slTall" style="height:3000px">tall</div>';
    var wTall = box(sn).width, scrollTall = pane().scrollHeight > pane().clientHeight;
    var bw = pane().offsetWidth - pane().clientWidth - 2;   // 2 = the borders
    rec('G8 a scrollbar appearing in the pane does not change the snippet\'s width',
      !scrollShort && scrollTall && near(wShort, wTall, 0.2) && bw > 5,
      'short=' + r1(wShort) + ' tall=' + r1(wTall) + ' overflowed=' + scrollShort + '/' + scrollTall + ' gutter=' + bw);
    var base = H.vizBaseWidth ? H.vizBaseWidth('#reportSnippetOutput') : -1;
    rec('G9 a % chart resolves against the pane, not the page',
      near(base, box(sn).width, 1.5) && base < box(stage()).width / 2, 'base=' + base + ' snippet=' + r1(box(sn).width) + ' stage=' + r1(box(stage()).width));

    // --- one side with nothing to show -------------------------------------
    layout('default');
    sn.innerHTML = '';
    layout('split');
    var e1 = stage().classList.contains('is-split-empty') && cs(pane()).display === 'none' && near(box(tvc()).width, box(stage()).width);
    rec('G10 entering split with NO snippet output: the pane stands down and the table takes the full width', e1,
      'empty=' + stage().classList.contains('is-split-empty') + ' paneDisplay=' + cs(pane()).display + ' table=' + r1(box(tvc()).width) + ' stage=' + r1(box(stage()).width));
    $(sn).html('\n  <style>.x{color:red}</style>\n <span style="display:none">hidden()</span><br>\n');
    await sleep(30);
    var e2 = stage().classList.contains('is-split-empty');
    $(sn).html('<div class="penumbra-card">now there is something</div>');
    await sleep(30);
    var e3 = !stage().classList.contains('is-split-empty') && cs(pane()).display === 'block' && near(box(tvc()).width, box(pane()).width);
    $(sn).empty();
    await sleep(30);
    var e4 = stage().classList.contains('is-split-empty');
    rec('G11 later writes are seen: rules-only output (whitespace, <style>, hidden) stays empty, real output splits, .empty() un-splits',
      e2 && e3 && e4, 'rulesOnlyEmpty=' + e2 + ' contentSplits=' + e3 + ' emptiedAgain=' + e4);
    sn.innerHTML = keep;
    await sleep(30);

    // Rows "None" collapses #table-view-container (flat view only).
    document.body.classList.add('pnb-data-hidden');
    var tH = box(tvc()).height, pn = box(pane()), st = box(stage()), pPos = cs(pane()).position, pCap = cs(pane()).maxHeight;
    var g12 = tH < 1 && near(pn.width, st.width) && pPos === 'static' && pCap === 'none' && !scrolls(pane()) && pn.height > 20;
    document.body.classList.remove('pnb-data-hidden');
    rec('G12 Rows "None": the collapsed table gives the pane the full width, and the pane stops being a capped sticky box', g12,
      'tableH=' + r1(tH) + ' pane=' + r1(pn.width) + '/' + r1(st.width) + ' position=' + pPos + ' maxHeight=' + pCap);

    layout('default');
    rec('G13 back to Default the stage is a plain block box again and the table has the full width',
      cs(stage()).display === 'block' && near(box(tvc()).width, box(stage()).width) && near(box(tvc()).width, fullW) && tracks(hdr()) === 2,
      'display=' + cs(stage()).display + ' table=' + r1(box(tvc()).width) + ' fullBefore=' + r1(fullW) + ' hdrTracks=' + tracks(hdr()));
    return true;
  }

  // ------------------------------------------------------------------------
  // The grouped view by hand, in the wrapper shape renderGroupNode() produces
  // (the groupmode suite's sticky page does the same): this phase is about the
  // STYLESHEET and the offsets, not about how groups are computed.
  function buildGroups(n) {
    var root = el('groupedResultsContainer');
    root.innerHTML = '';
    for (var g = 0; g < n; g++) {
      var wr = document.createElement('div');
      wr.className = 'group-wrapper open group-leaf';
      wr.setAttribute('data-group-depth', '0');
      var rows = '';
      for (var i = 0; i < 40; i++) rows += '<tr><td>row ' + i + '</td><td>dept</td></tr>';
      wr.innerHTML = '<div class="group-header"><span class="group-chevron">v</span><span class="group-name">Group ' + g + '</span><span class="group-count">40</span></div>' +
        '<div class="group-content" style="display:block"><table><thead><tr><th>Name</th><th>Dept</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      root.appendChild(wr);
    }
    root.style.display = 'block';
  }
  function bandTopAfterScroll() {
    var band = document.querySelector('#groupedResultsContainer .group-wrapper:nth-child(2) > .group-header');
    var wr = band.parentNode;
    window.scrollTo(0, 0);
    var y = box(wr).top + window.pageYOffset;      // document position of the 2nd group
    window.scrollTo(0, Math.round(y + 120));       // its band has to be pinned by now
    return { band: box(band).top, wrapperTop: box(wr).top, scrolled: window.pageYOffset };
  }
  function phaseS() {
    if (!H.removeContainerization || !H.groupSync) { rec('S1 grouped view', false, 'exports missing: ' + (window.__SL_MISSING || []).join(',')); return; }
    layout('default');
    H.removeContainerization();
    el('resultsTable').style.display = 'none';
    buildGroups(8);
    document.body.classList.add('group-mode-active');
    if (window.stackHeaders) window.stackHeaders();
    H.groupSync();
    var root = el('groupedResultsContainer');
    // Where "below the chrome" is, measured here and not read back from the app.
    function chrome() { return Math.round(box(hdr()).height + box(el('resultsHeader')).height); }
    var ctlChrome = chrome();
    var ctl = bandTopAfterScroll();
    rec('S0 control: in Default a scrolled group band pins to the viewport, just below the chrome',
      !wrap() && ctl.scrolled > 100 && ctl.wrapperTop < ctl.band - 50 && near(ctl.band, ctlChrome, 1.5),
      'band=' + r1(ctl.band) + ' chrome=' + ctlChrome + ' wrapperTop=' + r1(ctl.wrapperTop) + ' scrolled=' + ctl.scrolled);

    // No stackHeaders() / groupSync() here on purpose: the header just lost its
    // snippet and got SHORTER, and it is applyHeaderLayout's own re-anchoring
    // that has to carry the bands up with it.
    window.scrollTo(0, 0);
    layout('split');
    var spChrome = chrome();
    var sp = bandTopAfterScroll();
    var paneTop = box(pane()).top, wantPane = px(cs(pane()).top);
    rec('S1 in split the band still pins to the VIEWPORT, below the (now shorter) chrome - the stage did not become its scroll box',
      isSplit() && !wrap() && spChrome < ctlChrome - 20 && near(sp.band, spChrome, 1.5) && sp.wrapperTop < sp.band - 50 && !scrolls(stage()) && !scrolls(tvc()),
      'band=' + r1(sp.band) + ' chrome=' + spChrome + ' (Default ' + ctlChrome + ') wrapperTop=' + r1(sp.wrapperTop));
    rec('S2 the pane stays in view while the grouped page scrolls, pinned at its sticky top',
      sp.scrolled > 100 && near(paneTop, wantPane, 1.5) && box(pane()).height > 20,
      'paneTop=' + r1(paneTop) + ' want=' + wantPane + ' scrolled=' + sp.scrolled);
    var half = near(box(root).width, (box(stage()).width - (px(cs(stage()).columnGap) || 0)) / 2, 2);
    rec('S3 the grouped view fits its half (its leaf scrollers own any overflow) and the page gains no sideways scroll',
      half && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      'grouped=' + r1(box(root).width) + ' stage=' + r1(box(stage()).width) + ' pageScrollW=' + document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth);

    window.scrollTo(0, 0);
    document.body.classList.remove('group-mode-active');
    root.innerHTML = ''; root.style.display = '';
    el('resultsTable').style.display = '';
    layout('default');
    if (H.applyContainerization) H.applyContainerization();
  }

  // ------------------------------------------------------------------------
  // The SNAPSHOT band (the frozen ?snap= view), built by the real
  // _renderSnapshotHeader(). It replaces the title panel in EVERY layout, and
  // its pills and buttons sit in a right-hand column beside the text rows.
  // full = all five text rows (top, meta, note, "frozen copy of", captured
  // filter); short = the three a snapshot always has. The short band is what
  // tells "centred on the band" from "hung from row 3": on a five-row band
  // those two land within 5px of each other.
  function snapFixture(withPrompts, short) {
    var s = { displayName: 'Quarter close', timestamp: 1785093717300, creator: 'harness', reportTitle: 'Split layout harness',
              prompts: withPrompts ? [{ name: 'From date', value: '01-JUL-25' }, { name: 'To date', value: '30-JUN-26' }] : [] };
    if (!short) { s.notes = 'why this snapshot exists'; s.searchTerm = 'COLLEGE = CoE'; }
    return s;
  }
  function bandPart(c) { return document.querySelector('#snapshotHeaderPanel > .pnb-snaphdr-' + c); }
  function phaseB() {
    if (!H.renderSnapHeader || !H.hideSnapHeader) { rec('B1 the snapshot band', false, 'exports missing: ' + (window.__SL_MISSING || []).join(',')); return; }
    // SCOPE FIRST (owner, 2026-09-19: "only supposed to work for split layout").
    // It shipped for every layout for a few hours; Default and Dashboard must
    // keep the familiar stacked band: pills under the text, buttons under them.
    function stackedIn(mode) {
      layout(mode);
      H.renderSnapHeader(snapFixture(true), 58, 17);
      var p = el('snapshotHeaderPanel');
      if (!p) return 'no panel';
      var pl = box(bandPart('prompts')), fl = box(bandPart('filter')), ac = box(bandPart('actions'));
      var ok = cs(p).display === 'block' && pl.top >= fl.bottom - 1 && ac.top >= pl.bottom - 1 && near(pl.left, box(p).left, 1.5) && near(ac.left, box(p).left, 1.5);
      return ok ? '' : (mode + ': display=' + cs(p).display + ' filterBottom=' + r1(fl.bottom) + ' pillsTop=' + r1(pl.top) + ' pillsLeft=' + r1(pl.left) + ' panelLeft=' + r1(box(p).left));
    }
    var sDef = stackedIn('default'), sDash = stackedIn('dashboard');
    rec('B0 SCOPE: in the Default and Dashboard layouts the snapshot band is the old stacked one - pills under the text, buttons under the pills, all at the left edge',
      sDef === '' && sDash === '', (sDef || 'default ok') + ' ; ' + (sDash || 'dashboard ok'));

    // Everything below is the SPLIT layout, the only place the band has a right-hand column.
    layout('split');
    H.renderSnapHeader(snapFixture(true), 58, 17);
    var panel = el('snapshotHeaderPanel');
    if (!panel) { rec('B1 the snapshot band', false, 'no #snapshotHeaderPanel was rendered'); return; }
    var pb = box(panel), pills = box(bandPart('prompts')), acts = box(bandPart('actions')), sub = box(bandPart('sub')), filt = box(bandPart('filter'));
    var hGrid = pb.height;
    panel.style.display = 'block';            // inline beats the grid: the band as it used to stack
    var hStacked = box(panel).height;
    panel.style.display = '';
    var nameRow = box(bandPart('top'));
    function mid(b) { return b.top + b.height / 2; }
    // The band hides the title panel and carries its own home link; the report's
    // strip now lives OUTSIDE that panel under Split, so it has to go with it.
    var bCr = el('dashboardBreadcrumb'), bOwn = panel.querySelector('.pnb-snaphdr-crumb');
    rec('B7 with the snapshot band up under Split the report\'s moved breadcrumb is hidden: the band\'s own home link is the only one showing',
      !!bCr && cs(bCr).display === 'none' && !!bOwn && cs(bOwn).display !== 'none' && box(bOwn).width > 5,
      'moved=' + (bCr ? cs(bCr).display : 'missing') + ' bandCrumb=' + (bOwn ? cs(bOwn).display : 'missing'));
    rec('B1 snapshot band under SPLIT: the frozen prompt pills sit at the top RIGHT, level with the snapshot\'s name, and the buttons directly under them - beside the text, not under it',
      near(mid(pills), mid(nameRow), 3) && pills.left > sub.left + 200 && near(pills.right, pb.right, 2) && near(acts.right, pb.right, 2) &&
      acts.top >= pills.bottom - 1 && acts.bottom <= filt.bottom + 1 && hGrid <= hStacked - 35 &&
      hdr().classList.contains('has-snap-header') && hdr().classList.contains('layout-split'),
      'band=' + r1(hGrid) + ' vs stacked ' + r1(hStacked) + ' pillsMid=' + r1(mid(pills)) + ' nameMid=' + r1(mid(nameRow)) + ' buttons=' + r1(acts.top) + '-' + r1(acts.bottom) + ' textBottom=' + r1(filt.bottom) + ' rights=' + r1(pills.right) + '/' + r1(acts.right) + '/' + r1(pb.right));
    var tops = ['top', 'meta', 'note', 'sub', 'filter'].map(function (c) { return box(bandPart(c)); });
    var ordered = tops.every(function (b, i) { return near(b.left, pb.left, 1.5) && (i === 0 || b.top >= tops[i - 1].bottom - 0.5) && b.right <= pills.left + 0.5; });
    rec('B2 the text rows keep their order in the LEFT column and never run under the pills', ordered,
      tops.map(function (b) { return r1(b.top) + '-' + r1(b.bottom); }).join(' | '));

    // Switching the layout while the band is up moves it between the two forms:
    // the class on the header is the whole switch, nothing is re-rendered.
    layout('default');
    var pillsD = box(bandPart('prompts')), filtD = box(bandPart('filter'));
    layout('split');
    var pillsS = box(bandPart('prompts')), subS = box(bandPart('sub'));
    rec('B3 flipping the layout with the band up flips the band too: stacked in Default, right-hand column back in Split',
      pillsD.top >= filtD.bottom - 1 && pillsS.top < subS.bottom && near(pillsS.right, box(el('snapshotHeaderPanel')).right, 2),
      'defaultPillsTop=' + r1(pillsD.top) + ' (filterBottom ' + r1(filtD.bottom) + ') splitPillsTop=' + r1(pillsS.top) + ' (subBottom ' + r1(subS.bottom) + ')');

    // A SHORT band (the three text rows every snapshot has) WITH pills: the
    // buttons under the pills must still end inside the text's height.
    H.renderSnapHeader(snapFixture(true, true), 58, 17);
    var a3 = box(bandPart('actions')), s3 = box(bandPart('sub'));
    rec('B4 a short band (three text rows) is no taller for its pills and buttons: the buttons end inside the text\'s height',
      !bandPart('note') && !bandPart('filter') && a3.bottom <= s3.bottom + 1 && a3.top >= box(bandPart('prompts')).bottom - 1,
      'buttons=' + r1(a3.top) + '-' + r1(a3.bottom) + ' textBottom=' + r1(s3.bottom));
    // ...and with NO pills the buttons take the pills' place beside the name,
    // while the text rows stay in the left column (the third one must not slip
    // into the free cell under the buttons).
    H.renderSnapHeader(snapFixture(false, true), 58, 17);
    var p2 = box(el('snapshotHeaderPanel')), a2 = box(bandPart('actions')), s2 = box(bandPart('sub')), n2 = box(bandPart('top')), m2 = box(bandPart('meta'));
    rec('B5 with no prompt pills the buttons sit beside the snapshot\'s name, and every text row stays in the left column',
      !bandPart('prompts') && near(mid(a2), mid(n2), 3) && near(a2.right, p2.right, 2) && near(s2.left, p2.left, 1.5) && near(m2.left, p2.left, 1.5) && s2.top >= m2.bottom - 1,
      'buttonsMid=' + r1(mid(a2)) + ' nameMid=' + r1(mid(n2)) + ' subLeft=' + r1(s2.left) + ' panelLeft=' + r1(p2.left) + ' metaBottom=' + r1(m2.bottom) + ' subTop=' + r1(s2.top));

    H.hideSnapHeader();
    showReportHeader();
    rec('B6 leaving the snapshot view puts the ordinary header back', !el('snapshotHeaderPanel') && !hdr().classList.contains('has-snap-header') && box(el('reportInfoPanel')).height > 10,
      'panelGone=' + !el('snapshotHeaderPanel') + ' titlePanelH=' + r1(box(el('reportInfoPanel')).height));
    layout('default');
  }

  // ------------------------------------------------------------------------
  // X  BARE HEADER (2026-09-25): View Options > Header Layout > "Bare header"
  //    strips the header's CHROME in every layout, for everyone. Driven through
  //    the REAL checkbox (lifted from the index.php under test) with real change
  //    events, real key events for F2 / h, and the viewer path (the query-success
  //    handler reading the saved state). The load pass (?load=1) covers the boot
  //    restore and the re-edit round trip.
  function bareBox() { return el('viewOptionBareHeader'); }
  function setBare(on) { var b = bareBox(); if (!b) return false; $(b).prop('checked', !!on).trigger('change'); return true; }
  function isBare() { return document.body.classList.contains('pnb-bare-header'); }
  // Dashboard and Split move the strip out of the title panel (#dashboardBreadcrumb).
  function crumbStrip() { return el('dashboardBreadcrumb') || document.querySelector('#reportInfoPanel > div:first-child'); }
  function pseudoGone(which) { var c = getComputedStyle(hdr(), which); return c.content === 'none' || c.display === 'none'; }
  function card() {
    var c = cs(hdr());
    return { t: px(c.borderTopWidth), r: px(c.borderRightWidth), b: px(c.borderBottomWidth), l: px(c.borderLeftWidth),
             shadow: c.boxShadow, radius: px(c.borderBottomLeftRadius), bgImg: c.backgroundImage, bg: c.backgroundColor };
  }
  function key(k, code) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode: code, which: code, bubbles: true, cancelable: true }));
  }
  async function phaseX() {
    layout('default');
    showReportHeader();
    $('#admWrapper').hide();
    if (!snip().firstChild) fillSnippet();
    showPrompts();
    if (window.stackHeaders) window.stackHeaders();
    if (H.updateContainerHeight) H.updateContainerHeight();
    var b = bareBox(), c0 = card(), strip0 = crumbStrip();
    rec('X0 control: the Default header is a card (accent stripe, shadow, watermark, crumb strip), and the Bare header box ships unchecked, OUTSIDE the layout radio group',
      !!b && !b.checked && !$(b).closest('.header-layout-radios').length && !isBare() && c0.l >= 3 && c0.shadow !== 'none' && !pseudoGone('::after') && !!strip0 && box(strip0).height > 5,
      'box=' + !!b + ' checked=' + (b && b.checked) + ' accent=' + c0.l + ' shadow=' + String(c0.shadow).slice(0, 24) + ' after=' + getComputedStyle(hdr(), '::after').content + ' strip=' + (strip0 && r1(box(strip0).height)));
    if (!b) return;

    var bar = el('resultsHeader');
    var hCard = box(hdr()).height, capCard = px(cs(wrap()).maxHeight);
    setBare(true);
    var c1 = card(), bodyBg = cs(document.body).backgroundColor, hBare = box(hdr()).height;
    // Read what sits below the header NOW, straight after the toggle: no
    // observers run in this harness (ResizeObserver is stubbed), so only
    // applyBareHeader's own calls can have moved it - and the X2 measurements
    // below resize the header again without anything re-anchoring.
    var barTopNow = px(bar.style.top), capNow = px(cs(wrap()).maxHeight);
    rec('X1 ticking Bare header strips the chrome: no border or accent stripe, no shadow, no rounded corners, no watermark, no crumb strip - and the band is OPAQUE, the page\'s own colour (the header is sticky)',
      isBare() && c1.t === 0 && c1.r === 0 && c1.b === 0 && c1.l === 0 && c1.shadow === 'none' && c1.radius === 0 &&
      c1.bgImg === 'none' && c1.bg === bodyBg && c1.bg !== 'rgba(0, 0, 0, 0)' && pseudoGone('::after') && pseudoGone('::before') &&
      cs(crumbStrip()).display === 'none',
      'borders=' + [c1.t, c1.r, c1.b, c1.l].join('/') + ' shadow=' + c1.shadow + ' radius=' + c1.radius + ' bg=' + c1.bg + ' page=' + bodyBg + ' bgImg=' + String(c1.bgImg).slice(0, 30) +
      ' after=' + getComputedStyle(hdr(), '::after').content + ' strip=' + cs(crumbStrip()).display);
    // The left-hand stack alone (snippet emptied): what the crumb strip, the card's
    // padding and its border cost - the snippet column otherwise sets the height.
    var keepSnip = snip().innerHTML;
    snip().innerHTML = '';
    setBare(false); var hStackCard = box(hdr()).height;
    setBare(true);  var hStackBare = box(hdr()).height;
    snip().innerHTML = keepSnip;
    rec('X2 what the header SAYS stays - title, prompts, snippet - and the title stack is at least 40px shorter without the frame',
      box(el('mainReportTitle')).height > 10 && cs(el('promptInfoContainer')).display !== 'none' && box(el('promptInfoContainer')).height > 10 &&
      snip().parentNode === hdr() && box(snip()).height > 10 && hStackBare <= hStackCard - 40 && hBare < hCard,
      'stack ' + r1(hStackCard) + ' -> ' + r1(hStackBare) + ' ; with the snippet ' + r1(hCard) + ' -> ' + r1(hBare) + ' ; snippetIn=' + (snip().parentNode && snip().parentNode.id));
    rec('X3 the chrome below re-anchors AT ONCE: the controls bar sticks at the new header height, and the table\'s cap grows by what the header gave back',
      near(barTopNow, hBare, 1.5) && capNow >= capCard + (hCard - hBare) - 2 && hBare < hCard,
      'barTop=' + barTopNow + ' header=' + r1(hBare) + ' cap ' + capCard + ' -> ' + capNow + ' (header gave back ' + r1(hCard - hBare) + ')');

    // Split: the one-row header gets slimmer still, and the pane re-sticks under
    // it. With prompts, the prompt bar is the row's tallest block; without them
    // the title is - measured both ways.
    function promptsOff() { $('#promptInfoContainer').hide(); }
    function promptsOn() { $('#promptInfoContainer').css('display', 'flex'); }
    setBare(false); layout('split');
    var hSplit = box(hdr()).height;
    promptsOff(); var hSplitNoP = box(hdr()).height; promptsOn();
    setBare(true);
    var hSplitBare = box(hdr()).height;
    promptsOff(); var hSplitBareNoP = box(hdr()).height; promptsOn();
    var pb = box(el('reportInfoPanel')), qb = box(el('promptInfoContainer'));
    var tallest = Math.max(pb.height, qb.height);
    var sameRow = qb.top < pb.bottom && qb.bottom > pb.top && qb.left >= pb.right - 1;
    var paneWant = Math.round(box(hdr()).height + box(bar).height + (parseFloat(cs(bar).marginBottom) || 0));
    rec('X4 under Split the one-row header gets slimmer still: nothing but its tallest block + 8px above and below; prompts still beside the title, flush right; the pane re-sticks under it',
      isSplit() && sameRow && near(hSplitBare, tallest + 16, 1.5) && hSplitBare < hSplit && hSplitBareNoP <= hSplitNoP - 8 &&
      near(qb.right, box(hdr()).right, 2) && near(px(cs(pane()).top), paneWant, 1.5),
      'with prompts ' + r1(hSplit) + ' -> ' + r1(hSplitBare) + ' (tallest block ' + r1(tallest) + '); without ' + r1(hSplitNoP) + ' -> ' + r1(hSplitBareNoP) +
      ' sameRow=' + sameRow + ' promptsRight=' + r1(qb.right) + '/' + r1(box(hdr()).right) + ' paneTop=' + cs(pane()).top + ' want=' + paneWant);

    layout('dashboard');
    var dcr = el('dashboardBreadcrumb');
    rec('X5 under Dashboard the moved breadcrumb is hidden too, the title still shown',
      hdr().classList.contains('layout-dashboard') && !!dcr && cs(dcr).display === 'none' && box(el('mainReportTitle')).height > 10,
      'crumb=' + !!dcr + ' display=' + (dcr && cs(dcr).display));
    layout('default');

    if (H.renderSnapHeader && H.hideSnapHeader) {
      H.renderSnapHeader(snapFixture(true), 58, 17);
      var scr = document.querySelector('#snapshotHeaderPanel .pnb-snaphdr-crumb'), stt = document.querySelector('#snapshotHeaderPanel .pnb-snaphdr-title');
      var okSnap = !!scr && cs(scr).display === 'none' && !!stt && box(stt).height > 10;
      var scrDiag = 'crumb=' + (scr ? cs(scr).display : 'none rendered') + ' name=' + (stt ? r1(box(stt).height) : '-');
      H.hideSnapHeader();
      showReportHeader();
      rec('X6 the snapshot band keeps its badge and name but loses its own breadcrumb', okSnap, scrDiag);
    } else { rec('X6 the snapshot band loses its breadcrumb', false, 'exports missing'); }

    // The F2 tab: gone for the mouse while the header is open, the keys still work.
    var hd = el('headerToggleHandle');
    var visOpen = cs(hd).visibility, jqVis = $(hd).is(':visible');
    key('h', 72);
    var byH = hdr().classList.contains('is-collapsed'), hColl = box(hdr()).height, visColl = cs(hd).visibility;
    key('h', 72);
    var backH = !hdr().classList.contains('is-collapsed');
    key('F2', 113);
    var byF2 = hdr().classList.contains('is-collapsed');
    key('F2', 113);
    var backF2 = !hdr().classList.contains('is-collapsed');
    rec('X7 the F2 tab is hidden from the mouse while the header is open, yet F2 and the h key still hide and restore it - collapsed it is truly zero-height, and the tab comes BACK',
      visOpen === 'hidden' && jqVis && byH && hColl < 1 && visColl === 'visible' && backH && byF2 && backF2 && cs(hd).visibility === 'hidden',
      'open=' + visOpen + ' jq:visible=' + jqVis + ' h=' + byH + '/' + backH + ' collapsedH=' + r1(hColl) + ' tabWhileCollapsed=' + visColl + ' F2=' + byF2 + '/' + backF2);

    // What gets saved.
    var ed = H.getEditor ? H.getEditor() : null;
    if (ed) ed.setValue('SELECT 1 FROM DUAL');
    var st1 = null, st0 = null;
    try { st1 = H.buildState(); } catch (e) {}
    setBare(false);
    try { st0 = H.buildState(); } catch (e2) {}
    rec('X8 saved as viewOptions.bareHeader = true while ticked; unticked saves no key at all (an untouched report stays byte-identical)',
      !!st1 && !!st1.viewOptions && st1.viewOptions.bareHeader === true && !!st0 && !(st0.viewOptions && ('bareHeader' in st0.viewOptions)) && !isBare(),
      'on=' + (st1 && st1.viewOptions ? st1.viewOptions.bareHeader : 'no state') + ' offKeys=' + (st0 && st0.viewOptions ? Object.keys(st0.viewOptions).join('/') : 'none'));

    // A VIEWER has no View Options DOM: the query-success handler applies it
    // from the saved state on every run - and clears it for a report without it.
    var wasAdmin = penumbra_vars.isAdmin, keepPre = penumbra_vars.preloadedState;
    penumbra_vars.isAdmin = false;
    penumbra_vars.preloadedState = { viewOptions: { bareHeader: true } };
    await runQuery(makeRows(12));
    var vOn = isBare();
    penumbra_vars.preloadedState = { viewOptions: { hideEmail: true } };
    await runQuery(makeRows(12));
    var vOff = !isBare();
    penumbra_vars.isAdmin = wasAdmin;
    if (keepPre === undefined) { delete penumbra_vars.preloadedState; } else { penumbra_vars.preloadedState = keepPre; }
    rec('X9 a viewer gets it from the saved state on a run, and a report without it clears it', vOn && vOff, 'applied=' + vOn + ' clearedAfter=' + vOff);

    // Leave the page as phase G left it for S / B / E / D: the viewer runs
    // re-rendered the (empty) report snippet, which would leave the split pane
    // with nothing to show.
    setBare(false);
    layout('default');
    showReportHeader();
    $('#admWrapper').hide();
    fillSnippet();
    showPrompts();
    if (H.applyContainerization && !wrap()) H.applyContainerization();
    if (window.stackHeaders) window.stackHeaders();
  }

  // ------------------------------------------------------------------------
  // L  (?load=1) the page BOOTS with penumbra_vars.preloadedState = a report
  //    saved with { headerLayout: 'split', bareHeader: true }: the real restore
  //    path, then the re-edit round trip through the checkbox.
  async function phaseL() {
    for (var i = 0; i < 100 && !isBare(); i++) await sleep(50);
    await sleep(300);
    var b = bareBox();
    rec('L1 opening a report saved with Bare header ticks the box and strips the header, alongside its saved layout',
      !!b && b.checked && isBare() && hdr().classList.contains('layout-split') && cs(crumbStrip()).display === 'none',
      'box=' + (b ? b.checked : 'missing') + ' bare=' + isBare() + ' hdr=' + hdr().className + ' strip=' + (crumbStrip() && cs(crumbStrip()).display));
    var ed = H.getEditor ? H.getEditor() : null;
    if (ed && !String(ed.getValue()).trim()) ed.setValue('SELECT 1 FROM DUAL');
    setBare(false);
    var s0 = null; try { s0 = H.buildState(); } catch (e) {}
    var offOk = !isBare();
    setBare(true);
    var s1 = null; try { s1 = H.buildState(); } catch (e2) {}
    rec('L2 re-edited through the box: unticked saves no key and keeps Split, re-ticked saves it again',
      offOk && !!s0 && !!s0.viewOptions && !('bareHeader' in s0.viewOptions) && s0.viewOptions.headerLayout === 'split' &&
      !!s1 && !!s1.viewOptions && s1.viewOptions.bareHeader === true && isBare(),
      'off=' + (s0 && s0.viewOptions ? Object.keys(s0.viewOptions).join('/') : 'no state') + ' on=' + (s1 && s1.viewOptions ? s1.viewOptions.bareHeader : 'no state'));
  }

  // ------------------------------------------------------------------------
  function phaseE() {
    var node = snip();
    ['embed-only-header', 'embed-only-table'].forEach(function (cls, i) {
      document.body.classList.add('embed-view', cls);
      layout('split');
      var ok = node.parentNode === hdr() && !isSplit() && !hdr().classList.contains('layout-split');
      layout('default');
      document.body.classList.remove('embed-view', cls);
      rec('E' + (i + 1) + ' a ' + cls + ' frame shows one half of the page: split stands down and the snippet stays in the header', ok,
        'parent=' + (node.parentNode && node.parentNode.id));
    });
    document.body.classList.add('embed-view');
    layout('split');
    var full = isSplit();
    layout('default');
    document.body.classList.remove('embed-view');
    rec('E3 a full-report embed still splits (its width decides, not the frame)', full, 'split=' + full);
  }

  // ------------------------------------------------------------------------
  function phaseD() {
    layout('default');
    var st = stage(), t = tvc();
    if (st) { st.parentNode.insertBefore(t, st); st.parentNode.removeChild(st); }
    var gone = !stage() && !pane();
    layout('split');
    var ok = gone && isSplit() && !!pane() && snip().parentNode === pane() && tvc().parentNode === stage() && pane().previousElementSibling === tvc() &&
      near(box(tvc()).width, box(pane()).width) && pane().nodeName === 'ASIDE' && !!pane().getAttribute('aria-label');
    rec('D1 a page with no stage markup builds its own, around the table, and splits the same way', ok,
      'removed=' + gone + ' split=' + isSplit() + ' table=' + (tvc() && r1(box(tvc()).width)) + ' pane=' + (pane() && r1(box(pane()).width)));
    layout('default');
  }

  // ------------------------------------------------------------------------
  async function phaseN() {
    await runQuery(makeRows(20));
    if (!wrap() && H.applyContainerization) H.applyContainerization();
    showReportHeader();
    $('#admWrapper').hide();
    fillSnippet();
    showPrompts();
    var vw = document.documentElement.clientWidth;
    rec('N0 fixture: the window is under the 1000px breakpoint', vw < 1000 && vw > 400, 'clientWidth=' + vw);
    if (!H.applyHeaderLayout) { rec('N1 stacked fallback', false, 'applyHeaderLayout not exported'); return; }
    layout('split');
    var p = pane();
    if (!p || !isSplit()) { rec('N1 stacked fallback', false, 'split did not engage'); return; }
    var pb = box(p), tb = box(tvc()), sb = box(stage());
    rec('N1 under 1000px the sides STACK, snippets first, each the full width',
      tracks(stage()) === 1 && near(pb.width, sb.width) && near(tb.width, sb.width) && pb.bottom <= tb.top + 0.5,
      'tracks=' + tracks(stage()) + ' pane=' + r1(pb.width) + ' table=' + r1(tb.width) + ' stage=' + r1(sb.width) + ' paneBottom=' + r1(pb.bottom) + ' tableTop=' + r1(tb.top));
    rec('N2 stacked, the pane is an ordinary box: not sticky, not capped, no scrollbar of its own',
      cs(p).position === 'static' && cs(p).maxHeight === 'none' && !scrolls(p), 'position=' + cs(p).position + ' maxHeight=' + cs(p).maxHeight);
    var ib = box(el('reportInfoPanel')), qb = box(el('promptInfoContainer'));
    rec('N3 the slim header stacks too: prompts UNDER the title block, at its left edge',
      qb.top >= ib.bottom - 1 && near(qb.left, ib.left, 2) && tracks(hdr()) === 1,
      'titleBottom=' + r1(ib.bottom) + ' promptsTop=' + r1(qb.top) + ' lefts=' + r1(ib.left) + '/' + r1(qb.left) + ' tracks=' + tracks(hdr()));
    var nCr = el('dashboardBreadcrumb'), ncb = nCr ? box(nCr) : null;
    rec('N6 stacked, the breadcrumb is back on TOP: above the title, at its left edge',
      !!nCr && ncb.height > 5 && ncb.bottom <= ib.top + 1 && near(ncb.left, ib.left, 2),
      nCr ? ('crumbBottom=' + r1(ncb.bottom) + ' titleTop=' + r1(ib.top) + ' lefts=' + r1(ncb.left) + '/' + r1(ib.left)) : 'no #dashboardBreadcrumb');
    // The snapshot band in a narrow window is the stacked band even under SPLIT
    // (the only layout that has a right-hand column to fall back from).
    if (H.renderSnapHeader && H.hideSnapHeader) {
      layout('split');
      H.renderSnapHeader(snapFixture(true), 58, 17);
      var nPanel = el('snapshotHeaderPanel');
      var nPills = box(bandPart('prompts')), nFilt = box(bandPart('filter')), nActs = box(bandPart('actions'));
      rec('N4 under 1000px the snapshot band stacks even under Split: pills under the text, buttons under the pills',
        !!nPanel && hdr().classList.contains('layout-split') && cs(nPanel).display === 'block' && nPills.top >= nFilt.bottom - 1 && nActs.top >= nPills.bottom - 1 && near(nPills.left, box(nPanel).left, 1.5),
        'hdr=' + hdr().className + ' display=' + (nPanel && cs(nPanel).display) + ' filterBottom=' + r1(nFilt.bottom) + ' pillsTop=' + r1(nPills.top) + ' buttonsTop=' + r1(nActs.top));
      H.hideSnapHeader();
      showReportHeader();
      layout('default');
    } else { rec('N4 under 1000px the snapshot band stacks as it always did', false, 'exports missing'); }
    // Bare header in a narrow window: the stacked slim header, still frameless.
    if (bareBox()) {
      layout('split'); setBare(true);
      var ib2 = box(el('reportInfoPanel')), qb2 = box(el('promptInfoContainer'));
      rec('N5 Bare header under 1000px: the stacked header keeps its prompts under the title, with no crumb strip and no card edge',
        isBare() && qb2.top >= ib2.bottom - 1 && cs(crumbStrip()).display === 'none' && px(cs(hdr()).borderLeftWidth) === 0,
        'bare=' + isBare() + ' titleBottom=' + r1(ib2.bottom) + ' promptsTop=' + r1(qb2.top) + ' strip=' + cs(crumbStrip()).display + ' accent=' + cs(hdr()).borderLeftWidth);
      setBare(false); layout('default');
    } else { rec('N5 Bare header under 1000px', false, 'no Bare header box in the index.php under test'); }
  }

  (async function () {
    try {
      if (NARROW) { await phaseN(); }
      else if (LOAD) { await phaseL(); }
      else {
        var ok = phaseA();
        if (ok) ok = await phaseG();
        if (ok) { await phaseX(); phaseS(); phaseB(); phaseE(); phaseD(); }
      }
      var pe = errs();
      rec('Z no page errors or unhandled rejections during the run', pe.length === 0, pe.slice(0, 3).join(' | '));
      finish();
    } catch (e) {
      finish(String(e && e.stack ? e.stack : e).slice(0, 600));
    }
  })();
})();
