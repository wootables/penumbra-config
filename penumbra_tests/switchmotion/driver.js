// Switch motion suite - browser half (2026-09-24). Drives the REAL main.js (ready
// closure unwrapped, window.__SM export hook) through the REAL switch / toggle
// click handlers and the REAL group_by / pivot / flat / search paths, and reads
// back what the user would see:
//   - the control moves AT ONCE, as a pending position, and keeps it through the
//     load and through re-renders (a re-render mid-slide RESUMES the slide)
//   - the load veils the data region only; the overlay still shields the page
//   - clicks and arrow keys are dropped while a change is running
//   - the pending position is dropped once the page is quiet: truth again, so a
//     refused step slides back
//   - a pivot / group_by trigger no longer re-renders the snippet in the click
//   - a clearing search step runs ONE search, not two
//
// ?mode=switch  M group by DEPT, R resume across a re-render, B a refused step,
//               L a re-render after the slide window, F flat again, P pivot,
//               T the search toggle, H the theme toggle, S scope geometry,
//               K a leaked motion
// ?mode=plain   N nothing re-renders at all on a switch click (no data() reads)
//
// Under --dump-dom no frame is ever rendered, so a CSS transition is CREATED (on
// a forced style pass) but never starts. getAnimations() still lists it - that
// is what "the thumb slides" is asserted on.
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { mode: window.__MODE, results: R, pageErrors: errs().slice(0, 8), hostReduced: !!window.__HOST_REDUCED,
                    hookErr: [window.__SM_ERR, window.__SM_ERR2, (window.__SM_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};

  var H = window.__SM || {};
  var RED = !!window.__HOST_REDUCED;     // host reduced motion: CSS has no transitions to assert

  function J(x) { return JSON.stringify(x); }
  // (2026-10-15) every announcement #pnbLoadStatus makes, in order
  var SAY = [];
  (function () { var el = document.getElementById('pnbLoadStatus'); if (el) new MutationObserver(function () { var x = el.textContent; if (x) SAY.push(x); }).observe(el, { childList: true, characterData: true, subtree: true }); })();
  function sw() { return document.querySelector('#reportSnippetOutput .pnb-layout-switch'); }
  function opts(s) { return (s || sw()).querySelectorAll('.pnb-ls-opt'); }
  function sel(s) { s = s || sw(); return s ? s.getAttribute('data-ls-selected') : 'NO SWITCH'; }
  function idx(s) { s = s || sw(); return s ? s.style.getPropertyValue('--pnb-ls-i').trim() : 'NO SWITCH'; }
  function tgs() { return document.querySelectorAll('#reportSnippetOutput .pnb-toggle'); }
  function tgOn(i) { var t = tgs()[i]; return t ? t.getAttribute('data-ts-on') : 'NO TOGGLE'; }
  function ov() { return document.getElementById('loadingOverlay'); }
  function ovShown() { return $('#loadingOverlay').is(':visible'); }
  function scoped() { return ov().classList.contains('pnb-lo-scoped'); }
  function motion() { return H.motion ? H.motion() : undefined; }
  function thumbTx(s) {
    var th = (s || sw()).querySelector('.pnb-ls-thumb');
    return th ? th.getAnimations().filter(function (a) { return a.transitionProperty === 'transform'; }) : [];
  }
  function knobTx(t) {
    var p = t ? t.querySelector('.sp-switch') : null;
    return p ? p.getAnimations({ subtree: true }).filter(function (a) { return !!a.transitionProperty; }) : [];
  }
  function view() {
    if ($('#pivot-output-container').is(':visible')) return 'pivot';
    if ($('#groupedResultsContainer').is(':visible')) return 'group:' + String(H.groupCol ? H.groupCol() : '?');
    return 'flat';
  }
  function state(s) {
    s = s || sw();
    var m = motion();
    return 'sel=' + sel(s) + ' i=' + idx(s) + ' busy=' + (s ? s.getAttribute('aria-busy') : '-') + ' view=' + view() +
      ' ov=' + (ovShown() ? (scoped() ? 'scoped' : 'full') : 'hidden') + ' motion=' + (m ? (m.kind + ':' + m.from + '->' + m.to) : String(m));
  }
  // The view change starts once the slide has played (_pnbAfterSlide), so a
  // check on the LOAD has to wait for it to begin. Returns the wait in ms.
  async function loadStarted(max) {
    var t = performance.now();
    for (var i = 0; i < (max || 100) && !ovShown(); i++) await sleep(5);
    return performance.now() - t;
  }
  // The page is idle when no load is on screen and no motion is pending. Gives
  // up after ~4 s of (virtual) time - a load here takes well under one - so a
  // build that never settles fails its own asserts instead of running the page
  // out of its virtual-time budget before the results are written.
  async function idle(max) {
    for (var i = 0; i < (max || 160); i++) {
      if (!ovShown() && !motion()) break;
      await sleep(25);
    }
    await sleep(60);
  }
  async function bootWait() {
    for (var i = 0; i < 600; i++) {
      if (window.__queryDone >= 1 && $('#resultsTable tbody tr').length && sw() && !ovShown()) break;
      await sleep(25);
    }
    await sleep(400);
  }
  // Every #reportSnippetOutput repaint. executeChainStep() appends (and removes)
  // a temporary <a class="snippet-action"> to dispatch a trigger - that is not a
  // repaint and is ignored. Records are delivered in a microtask, so a check
  // made synchronously after a click must flush() first.
  var log = [];
  function logReset() { flush(); log.length = 0; }
  function take(ms) {
    var n = 0;
    ms.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (a) {
        if (!(a.nodeType === 1 && a.matches('a.snippet-action'))) n++;
      });
    });
    if (n) log.push({ t: performance.now(), what: 'snippet' });
  }
  var mo = new MutationObserver(take);
  mo.observe(document.getElementById('reportSnippetOutput'), { childList: true });
  function flush() { take(mo.takeRecords()); }
  function after(what, ref) { flush(); return log.filter(function (e) { return e.what === what && e.t >= ref; }).length; }

  function box() {
    var o = ov();
    return ['--pnb-lo-t', '--pnb-lo-r', '--pnb-lo-b', '--pnb-lo-l'].map(function (p) { return o.style.getPropertyValue(p).trim(); });
  }

  // --------------------------------------------------------------------------
  async function modeSwitch() {
    await bootWait();
    var s0 = sw();
    rec('F1 fixture: the report boots flat with the switch on Transactions, both toggles off',
      s0 && opts(s0).length === 5 && sel(s0) === '0' && tgs().length === 2 && tgOn(0) === '0' && tgOn(1) === '0' && view() === 'flat'
        && $('#viewState').text() === 'FLAT',
      state() + ' toggles=' + tgs().length + ' on=' + tgOn(0) + '/' + tgOn(1) + ' viewState=' + $('#viewState').text() + ' hostReduced=' + RED + ' errs=' + errs().slice(0, 2).join(' / '));
    if (!s0) return;

    // M - group by DEPT through the switch.
    var o1 = opts(s0)[1];
    o1.focus();
    logReset();
    var t0 = performance.now();
    o1.click();
    var s1 = sw();
    var m1 = motion();
    rec('M1 the thumb moves AT ONCE: position 1 is selected before the grouping has run',
      s1 && sel(s1) === '1' && idx(s1) === '1' && opts(s1)[1].classList.contains('is-selected') && opts(s1)[1].getAttribute('aria-checked') === 'true'
        && opts(s1)[0].getAttribute('aria-checked') === 'false' && s1.getAttribute('aria-busy') === 'true' && view() === 'flat',
      state(s1));
    rec('M2 ...and slides there: the thumb has a transform transition from the click',
      RED || thumbTx(s1).length >= 1, 'transitions=' + thumbTx(s1).length + ' hostReduced=' + RED);
    var noLoadYet = !ovShown() && view() === 'flat';
    var waited = await loadStarted();
    rec('A1 the grouping starts once the slide has played (~the thumb\'s 0.18s), not in the click',
      noLoadYet && ovShown() && waited >= 150 && waited <= 400, 'noLoadAtClick=' + noLoadYet + ' loadAfter=' + Math.round(waited) + 'ms');
    rec('M3 a group_by click no longer re-renders the snippet: the same switch node survives the dispatch',
      sw() === s0 && after('snippet', t0) === 0, 'same=' + (sw() === s0) + ' repaints=' + after('snippet', t0));
    var vt = box();
    var tv = document.getElementById('table-view-container').getBoundingClientRect();
    var rh = document.getElementById('resultsHeader').getBoundingClientRect();
    var so = document.getElementById('reportSnippetOutput').getBoundingClientRect();
    var ob = ov().getBoundingClientRect();
    var wantTop = Math.max(0, Math.min(tv.top, rh.top));
    var vh = document.documentElement.clientHeight;
    var sbEl = document.getElementById('pnbStatusBar');
    var floor = (sbEl && sbEl.getClientRects().length) ? Math.min(vh, sbEl.getBoundingClientRect().top) : vh;
    rec('M4 the load is SCOPED: the veil runs from the data (results header + table) to the bottom of the screen; the overlay still spans the viewport',
      ovShown() && scoped() && m1 && m1.scoped === true && Math.abs(parseFloat(vt[0]) - Math.round(wantTop)) <= 1
        && Math.abs(parseFloat(vt[3]) - Math.round(Math.max(0, Math.min(tv.left, rh.left)))) <= 1
        && Math.abs(parseFloat(vt[2]) - Math.round(vh - floor)) <= 1
        && so.bottom <= parseFloat(vt[0]) + 1
        && Math.abs(ob.width - document.documentElement.clientWidth) <= 1 && Math.abs(ob.height - vh) <= 1,
      state() + ' box=' + J(vt) + ' want top=' + Math.round(wantTop) + ' bottom=' + Math.round(vh - floor) + ' snippetBottom=' + Math.round(so.bottom) + ' overlay=' + Math.round(ob.width) + 'x' + Math.round(ob.height));
    // A second click and an arrow key while the grouping runs are DROPPED.
    opts()[2].click();
    var ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    var focusBefore = document.activeElement;
    opts()[1].dispatchEvent(ev);
    var m5 = motion();
    rec('M5 clicks and arrow keys are dropped while the change is running (no second change starts, focus stays with the thumb)',
      m5 && m5.to === 1 && ev.defaultPrevented && sel() === '1' && document.activeElement === focusBefore && focusBefore === opts()[1],
      state() + ' prevented=' + ev.defaultPrevented + ' focusMoved=' + (document.activeElement !== focusBefore) + ' focusOnPos1=' + (focusBefore === opts()[1]));
    await sleep(120);
    rec('M5b a press dropped mid-change is SAID (#pnbLoadStatus: Still loading), not silent (WCAG 2.1.1 / 4.1.3, 2026-10-15)',
      SAY.indexOf('Still loading. Try again in a moment.') !== -1, J(SAY));
    await idle();
    var s7 = sw();
    rec('M6 after the load: grouped by DEPT (the dropped click did NOT run), overlay gone and unscoped',
      view() === 'group:DEPT' && !ovShown() && !scoped() && box().join('') === '',
      state(s7) + ' box=' + J(box()));
    rec('M7 the pending position is dropped once the page is quiet, and the truth agrees',
      motion() === null && sel(s7) === '1' && idx(s7) === '1' && !s7.hasAttribute('aria-busy') && !s7.style.getPropertyValue('--pnb-motion-delay'),
      state(s7));
    rec('M8 a snippet that reads data(group) is still re-rendered when the grouping is up',
      $('#viewState').text() === 'GROUPED', 'viewState=' + $('#viewState').text());
    for (var sw9 = 0; sw9 < 75 && SAY[SAY.length - 1] !== 'Loaded'; sw9++) await sleep(20);
    rec('M6b the end of the load is said (#pnbLoadStatus: Loaded, after the busy notice) (WCAG 4.1.3, 2026-10-15)',
      SAY[SAY.length - 1] === 'Loaded' && SAY.lastIndexOf('Loaded') > SAY.indexOf('Still loading. Try again in a moment.'), J(SAY));

    // R - a re-render IN THE MIDDLE of the slide resumes it instead of snapping.
    var r0 = sw();
    logReset();
    opts(r0)[2].click();                     // By Type: 1 -> 2
    H.render();                              // a repaint while the thumb is sliding
    var r1 = sw();
    var d1 = r1 ? r1.style.getPropertyValue('--pnb-motion-delay').trim() : '';
    rec('R1 a re-render mid-slide hands the NEW node the slide already under way (not the end position)',
      r1 && r1 !== r0 && sel(r1) === '2' && idx(r1) === '2' && /^-?\d+ms$/.test(d1) && (RED || thumbTx(r1).length >= 1),
      'newNode=' + (r1 !== r0) + ' ' + state(r1) + ' delay=' + d1 + ' transitions=' + (r1 ? thumbTx(r1).length : '-'));
    await idle();
    rec('R2 ...and it still lands on the truth: grouped by TYPE, position 2', view() === 'group:TYPE' && sel() === '2' && motion() === null, state());

    // B - a refused step (no such column) moves at once, then slides BACK.
    var b0 = sw();
    opts(b0)[3].click();                     // Missing: notice, no load
    var b1 = sw();
    rec('B1 a refused step still moves at once (the thumb cannot know yet)', sel(b1) === '3' && idx(b1) === '3' && !ovShown(), state(b1));
    // L - a re-render AFTER the slide window lands the new node without a slide.
    await sleep(320);
    H.render();
    var l1 = sw();
    rec('L1 a re-render after the slide window lands the new node on the pending position with no transition',
      l1 && sel(l1) === '3' && !l1.style.getPropertyValue('--pnb-motion-delay') && thumbTx(l1).length === 0 && !!motion(),
      state(l1) + ' transitions=' + (l1 ? thumbTx(l1).length : '-'));
    for (var w = 0; w < 80 && motion(); w++) await sleep(25);
    var b2 = sw();
    rec('B2 with nothing loaded the pending position is dropped: back on the live view (TYPE, position 2)',
      motion() === null && sel(b2) === '2' && idx(b2) === '2' && view() === 'group:TYPE', state(b2));
    rec('B3 ...and it SLIDES back rather than jumping', RED || thumbTx(b2).length >= 1, 'transitions=' + thumbTx(b2).length);

    // F - flat again, through removeGrouping().
    logReset();
    var f0 = sw();
    opts(f0)[0].click();
    await loadStarted();
    var tvf = document.getElementById('table-view-container').getBoundingClientRect();
    rec('F2 back to flat from a SHORT (collapsed) grouped view: moves at once, and the ungroup load is still scoped (the veil runs to the bottom of the screen)', sel() === '0' && scoped() && ovShown(),
      state() + ' scopeBox=' + J(H.scopeBox ? H.scopeBox() : 'n/a') + ' tv=' + J([Math.round(tvf.top), Math.round(tvf.bottom), Math.round(tvf.left), Math.round(tvf.right)])
        + ' scrollY=' + Math.round(window.scrollY) + ' vh=' + document.documentElement.clientHeight);
    await idle();
    rec('F3 flat, position 0, settled', view() === 'flat' && sel() === '0' && motion() === null && $('#viewState').text() === 'FLAT', state() + ' viewState=' + $('#viewState').text());

    // P - a pivot through the switch (runSilent -> #generatePivotBtn).
    logReset();
    var p0 = sw();
    var tp = performance.now();
    opts(p0)[4].click();
    var p1sel = sel();
    await loadStarted();
    var p1 = sw();
    rec('P1 a pivot click moves at once and does not re-render the snippet when the trigger dispatches',
      p1 === p0 && p1sel === '4' && after('snippet', tp) === 0, 'selAtClick=' + p1sel + ' ' + state(p1) + ' repaints=' + after('snippet', tp));
    rec('P2 the pivot build is scoped too', ovShown() && scoped(), state());
    await idle();
    rec('P3 pivot on screen, position 4, settled', view() === 'pivot' && sel() === '4' && motion() === null, state() + ' pivotErr=' + $('#pivotErrorBox').text().slice(0, 80));
    opts()[0].click();
    var p4sel = sel();
    await loadStarted();
    rec('P4 leaving the pivot (the exit button path) moves at once and is scoped', p4sel === '0' && sel() === '0' && scoped(), 'selAtClick=' + p4sel + ' ' + state());
    await idle();
    rec('P5 flat again after the pivot', view() === 'flat' && sel() === '0' && motion() === null, state());

    // T - the search toggle.
    var tg0 = tgs()[0];
    window.__SM_RTS = 0;
    logReset();
    tg0.querySelector('.pnb-toggle-btn').click();
    var tg1 = tgs()[0];
    rec('T1 the toggle flips AT ONCE and its knob slides', tgOn(0) === '1' && tg1.getAttribute('aria-busy') === 'true'
      && tg1.querySelector('.pnb-toggle-btn').getAttribute('aria-checked') === 'true' && (RED || knobTx(tg1).length >= 1),
      'on=' + tgOn(0) + ' knobTransitions=' + knobTx(tg1).length + ' ' + state());
    await loadStarted();
    rec('T2 the search runs under the scoped veil', ovShown() && scoped(), state());
    await idle();
    var rows = $('#resultsTable tbody tr').filter(function () { return !this.classList.contains('search-hidden'); }).length;
    rec('T3 filtered, toggle on, settled: ONE search ran', tgOn(0) === '1' && $('#tableSearch').val() === 'alpha' && rows === 7 && motion() === null
      && window.__SM_RTS === 1, 'on=' + tgOn(0) + ' box=' + $('#tableSearch').val() + ' rows=' + rows + ' searches=' + window.__SM_RTS + ' ' + state());
    window.__SM_RTS = 0;
    tgs()[0].querySelector('.pnb-toggle-btn').click();
    rec('T4 off: flips back AT ONCE', tgOn(0) === '0', 'on=' + tgOn(0));
    await idle();
    var rows2 = $('#resultsTable tbody tr').filter(function () { return !this.classList.contains('search-hidden'); }).length;
    rec('T5 clearing the filter runs ONE search, not two (the box\'s own input handler no longer runs a second)',
      window.__SM_RTS === 1 && tgOn(0) === '0' && $('#tableSearch').val() === '' && rows2 === 30,
      'searches=' + window.__SM_RTS + ' on=' + tgOn(0) + ' rows=' + rows2);

    // H - a theme toggle keeps the FULL overlay (the whole page restyles).
    tgs()[1].querySelector('.pnb-toggle-btn').click();
    var mh = motion();
    rec('H1 a theme toggle moves at once but is NOT scoped', tgOn(1) === '1' && mh && mh.scoped === false, 'on=' + tgOn(1) + ' motion=' + J(mh && { scoped: mh.scoped, to: mh.to }));
    await idle();
    rec('H2 ...and settles on the live theme', motion() === null && tgOn(1) === '1', 'on=' + tgOn(1) + ' theme=' + document.body.className.slice(0, 80));
    tgs()[1].querySelector('.pnb-toggle-btn').click();
    await idle();

    // S - scope geometry and fallbacks.
    H.show('plain load');
    rec('S1 a load that no switch started keeps the full-screen overlay', ovShown() && !scoped() && box().join('') === '', 'box=' + J(box()));
    H.hide();
    await idle();
    if (H.scopeBox) {
      var stage = document.getElementById('pnbSplitStage');
      var bFull = H.scopeBox();
      stage.classList.add('is-split');
      var bSplit = H.scopeBox();
      stage.classList.remove('is-split');
      var tvr = document.getElementById('table-view-container').getBoundingClientRect();
      rec('S2 split layout: the results header is NOT taken in (it spans the pane the control lives in)',
        bFull && bSplit && Math.abs(bSplit.t - Math.max(0, tvr.top)) <= 1 && bFull.t < bSplit.t,
        'full=' + J(bFull) + ' split=' + J(bSplit) + ' tvTop=' + Math.round(tvr.top));
    } else rec('S2 split layout: the results header is NOT taken in', false, 'scopeBox not exported');
    // S3: only a sliver of the data region on screen - no room for the spinner.
    var spacer = document.createElement('div');
    spacer.style.height = Math.max(0, document.documentElement.clientHeight - 150 - document.getElementById('resultsHeader').getBoundingClientRect().top) + 'px';
    document.getElementById('resultsHeader').parentNode.insertBefore(spacer, document.getElementById('resultsHeader'));
    opts()[1].click();
    await loadStarted();
    rec('S3 only a sliver of the data on screen: the ordinary full-screen overlay', ovShown() && !scoped() && sel() === '1',
      state() + ' rhTop=' + Math.round(document.getElementById('resultsHeader').getBoundingClientRect().top));
    await idle();
    spacer.parentNode.removeChild(spacer);
    opts()[0].click();
    await idle();
    // S4: no data region at all.
    var tvEl = document.getElementById('table-view-container');
    tvEl.style.display = 'none';
    opts()[1].click();
    await loadStarted();
    rec('S4 no data region on screen: the ordinary full-screen overlay', ovShown() && !scoped() && sel() === '1', state());
    tvEl.style.display = '';
    await idle();
    opts()[0].click();
    await idle();

    // K - a motion whose overlay was hidden WITHOUT hideLoading must not wedge
    // the controls: the next click goes through.
    opts()[3].click();                        // Missing: a motion with no load...
    await sleep(250);                         // ...whose command has been SENT (after the slide)
    H.show('leak');                           // a load starts: the settle is cancelled
    $('#loadingOverlay').hide();              // ...and ends without hideLoading
    opts()[2].click();
    var mk = motion();
    rec('K1 a leaked motion does not wedge the switch: the next click starts a new change',
      mk && mk.to === 2 && sel() === '2', state());
    await idle();
    rec('K2 ...which completes', view() === 'group:TYPE' && sel() === '2' && motion() === null, state());

    // Q - a settle that is DUE counts as done at the next click even though its
    // timer has not run: after a long task the browser runs a waiting click
    // ahead of a waiting timer (and a background tab holds timers back - seen
    // live on dr-huron2). __SM_SKEW moves the motion clock (_pnbMotionNow is
    // rebound by the hook) without letting any timer run.
    opts()[3].click();                       // Missing: no load, its settle is 700ms out
    var q0 = motion();
    await sleep(250);                        // its command has been SENT (after the slide)
    window.__SM_SKEW = 2000;                 // ...and 2s pass with the timer still waiting
    opts()[0].click();                       // back to flat
    var q1 = motion();
    rec('Q1 a click once the settle is DUE goes through, even before the settle timer has run',
      !!q0 && !!q1 && q1 !== q0 && q1.to === 0 && sel() === '0', 'prev=' + J(q0 && { to: q0.to }) + ' now=' + J(q1 && { to: q1.to }) + ' ' + state());
    await idle();
    window.__SM_SKEW = 0;
    rec('Q2 ...and lands', view() === 'flat' && sel() === '0' && motion() === null, state());

    // D - a stray hideLoading() while the change still waits for its slide (the
    // command not sent yet) must not settle the motion and drop the click.
    opts()[1].click();                       // By Dept: the command goes out after the slide
    H.hide();                                // some other code path hides "its" load meanwhile
    await idle();
    rec('D1 a stray hideLoading() during the slide does not drop the change', view() === 'group:DEPT' && sel() === '1' && motion() === null, state());
  }

  // ?mode=restore (2026-09-25): loads that only rearrange the data veil the data
  // region too, with no switch involved - Remove Grouping, Restore Transaction
  // List, a header sort, a sort| trigger - while a grouping NOT started by a
  // switch (the dialog's path) stays full-screen from its first step to its last.
  async function modeRestore() {
    await bootWait();
    var s0 = sw();
    var links = $('#reportSnippetOutput a.snippet-action');
    function link(t) { return links.filter(function () { return $(this).text().trim() === t; })[0]; }
    rec('V0 fixture: 600 rows, flat, the switch and both action links rendered',
      s0 && sel(s0) === '0' && $('#resultsTable tbody tr').length === 600 && !!link('Group by dept') && !!link('Sort by amount'),
      state() + ' rows=' + $('#resultsTable tbody tr').length + ' links=' + links.length);
    if (!s0) return;

    opts()[1].click(); await idle();                                  // grouped, via the switch
    document.getElementById('removeGroupingLink').click();
    await loadStarted();
    rec('V1 Remove Grouping veils the data region only (no switch involved)', ovShown() && scoped() && motion() === null, state());
    await idle();
    rec('V1b ...back to the flat table', view() === 'flat' && sel() === '0', state());

    opts()[4].click(); await idle();                                  // a pivot, via the switch
    document.getElementById('exitPivotModeBtn').click();
    await loadStarted();
    rec('V2 Restore Transaction List veils the data region only', ovShown() && scoped() && motion() === null, state());
    await idle();
    rec('V2b ...flat again', view() === 'flat' && sel() === '0', state());

    opts()[4].click(); await idle();                                  // pivot again
    links = $('#reportSnippetOutput a.snippet-action');
    var shownAny = false, scopedAny = false;
    link('Group by dept').click();                                    // exit (with onComplete) + group
    for (var i = 0; i < 400; i++) {
      if (ovShown()) { shownAny = true; if (scoped()) scopedAny = true; }
      else if (shownAny && view().indexOf('group') === 0) break;
      await sleep(5);
    }
    await idle();
    rec('V3 a grouping from a pivot NOT started by a switch stays full-screen throughout (its exit step does not flip to the veil)',
      shownAny && !scopedAny && view() === 'group:DEPT', 'shownAny=' + shownAny + ' scopedAny=' + scopedAny + ' ' + state());

    opts()[0].click(); await idle();                                  // flat, via the switch
    document.querySelector('#tableHeader th[data-colname="AMOUNT"]').click();
    await loadStarted();
    var msg = $('#loadingOverlay > p').first().text();
    rec('V4 sorting 600 rows from a column header veils the data region only', ovShown() && scoped() && motion() === null && /^Sorting/.test(msg),
      state() + ' msg=' + msg);
    await idle();
    links = $('#reportSnippetOutput a.snippet-action');
    link('Sort by amount').click();
    await loadStarted();
    msg = $('#loadingOverlay > p').first().text();
    rec('V5 a sort| trigger over 500 rows veils the data region only', ovShown() && scoped() && /^Sorting/.test(msg), state() + ' msg=' + msg);
    await idle();

    // V6: a load that starts while the veil is up keeps it - a sort over 2,000
    // rows runs the formatting pass, which opens its own "Applying custom
    // formatting rules..." (live on dr-huron2 the one sort flipped from the
    // veil to the full screen). An explicit full-screen request, or a fresh
    // load with nothing on screen, still gets the full screen.
    H.show('outer', false, { scoped: true });
    var v6outer = scoped();
    H.show('nested (the formatting pass)');
    var v6nested = scoped();
    H.show('explicit', false, { scoped: false });
    var v6explicit = scoped();
    H.hide();
    H.show('fresh');
    var v6fresh = scoped();
    H.hide();
    await idle();
    rec('V6 a load that starts under the veil keeps it; an explicit full-screen request or a fresh load gets the full screen',
      v6outer && v6nested && !v6explicit && !v6fresh, 'outer=' + v6outer + ' nested=' + v6nested + ' explicit=' + v6explicit + ' fresh=' + v6fresh);
  }

  async function modePlain() {
    await bootWait();
    var s0 = sw(), mark = document.getElementById('plainMark');
    rec('N0 fixture: flat, switch on position 0', s0 && sel(s0) === '0' && !!mark && view() === 'flat', state(s0));
    if (!s0) return;
    logReset();
    var t0 = performance.now();
    opts(s0)[1].click();
    await idle();
    rec('N1 a snippet that does not read the view is never re-rendered by a switch click: same nodes, no repaint',
      sw() === s0 && document.getElementById('plainMark') === mark && after('snippet', t0) === 0 && view() === 'group:DEPT' && sel() === '1',
      'sameSwitch=' + (sw() === s0) + ' repaints=' + after('snippet', t0) + ' ' + state());
  }

  (async function () {
    try {
      if (!H.render) { finish('hook: renderReportSnippet not exported'); return; }
      // ?mode=demo: boot and stop - a CDP session drives the page with real frames.
      if (window.__MODE === 'demo') { await bootWait(); window.__READY = true; return; }
      if (window.__MODE === 'plain') await modePlain();
      else if (window.__MODE === 'restore') await modeRestore();
      else await modeSwitch();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
