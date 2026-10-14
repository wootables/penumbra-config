// tablefit suite driver (2026-10-03). harness.html boots the REAL main.js on a
// 120 x 24 report in Easy Read density (a table far wider than the window, so
// #results-wrapper owns a horizontal scrollbar), console closed. Every step
// measures the box against the fixed status bar:
//   room   = innerHeight - the box's PAGE top - 2 - the bar's height
//   cap    = the box's inline max-height (what updateContainerHeight() wrote)
//   bottom = the box's lower border edge; its scrollbar ends 1px (the border) above
// "fits" = the box ends exactly on the bar's top edge (+-1px): not behind it, no gap.
// The console is opened and closed with the REAL toggle button (the docked drawer
// with its 420ms transition); its tabs are a real jQuery UI tabs widget whose
// panels are sized from the measured room so the three tabs land the box in the
// three regimes: tab C ~330px of room (above the old 250px floor), tab A ~170px
// (the band the old floor pushed behind the bar), tab B ~40px (too little room:
// the box keeps 250px and the page scrolls to it).
// Every "trigger" step first re-caps explicitly (a known-good start), then makes
// ONE change with no explicit call, so it isolates who notices that change.
// Publishes window.__TFRESULT = { results: [{name, pass, detail}], ... }, __TFDONE.
(function () {
  var TF = window.__TF || {};
  var R = [];
  var notes = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: String(detail === undefined ? '' : detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function el(id) { return document.getElementById(id); }
  function wrap() { return el('results-wrapper'); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function recap() { if (TF.updateContainerHeight) TF.updateContainerHeight(); }
  function geo() {
    var w = wrap(), bar = el('pnbStatusBar'), adm = el('admWrapper');
    if (!w) return { noWrapper: true };
    var b = w.getBoundingClientRect(), sb = bar.getBoundingClientRect(), cs = getComputedStyle(w);
    var bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
    var docTop = b.top + window.pageYOffset;
    return {
      ih: window.innerHeight, scrollY: Math.round(window.pageYOffset),
      maxScroll: Math.round(document.scrollingElement.scrollHeight - window.innerHeight),
      docTop: r1(docTop), bottom: r1(b.bottom), barTop: r1(sb.top), barH: r1(sb.height),
      cap: r1(parseFloat(w.style.maxHeight)), room: r1(window.innerHeight - docTop - 2 - sb.height),
      hbarBottom: r1(b.bottom - bb),
      hScroll: w.scrollWidth > w.clientWidth + 50,
      hbarH: w.offsetHeight - w.clientHeight - bt - bb,
      admH: adm ? adm.offsetHeight : -1,
      tab: (function () { try { return $('#editorTabs').tabs('option', 'active'); } catch (e) { return 'err'; } })()
    };
  }
  function txt(g) {
    if (g.noWrapper) return 'NO #results-wrapper';
    return 'room=' + g.room + ' cap=' + g.cap + ' bottom=' + g.bottom + ' barTop=' + g.barTop + ' hbarBottom=' + g.hbarBottom +
      ' docTop=' + g.docTop + ' scrollY=' + g.scrollY + '/' + g.maxScroll + ' adm=' + g.admH + ' tab=' + g.tab + ' ih=' + g.ih;
  }
  // The box ends on the bar's top edge: its scrollbar is on screen, right above the bar.
  function fits(g) { return !g.noWrapper && Math.abs(g.bottom - g.barTop) <= 1 && g.hbarBottom <= g.barTop + 0.5; }
  function admOpen() { var a = el('admWrapper'); return !!(a && a.offsetHeight > 0); }
  async function toggleConsole(wantOpen) {
    $('#toggleAdminViewBtn').trigger('click');
    // the docked drawer: 420ms clip/translate transition (+480ms safety net), then
    // onTransitionComplete re-caps at once and again 50ms later
    if (!(await until(function () { return admOpen() === wantOpen; }, 3000))) notes.push('console did not ' + (wantOpen ? 'open' : 'close'));
    await sleep(wantOpen ? 1100 : 500);
  }
  async function tab(i) { $('#editorTabs').tabs('option', 'active', i); await sleep(350); }
  // max-height VALUE changes on the box while `ms` passes (a re-cap loop shows here)
  async function capChanges(ms) {
    var n = 0, w = wrap();
    var mo = new MutationObserver(function (list) {
      list.forEach(function (m) {
        var was = /max-height:\s*([^;]+)/.exec(m.oldValue || ''), now = /max-height:\s*([^;]+)/.exec(w.getAttribute('style') || '');
        if ((was && was[1]) !== (now && now[1])) n++;
      });
    });
    mo.observe(w, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
    await sleep(ms);
    mo.disconnect();
    return n;
  }

  async function run() {
    if (!(await until(function () {
      return window.__queryDone >= 1 && (window.__TF_HIDES || 0) >= 1 && wrap() &&
        document.querySelectorAll('#resultsTable > tbody > tr').length >= window.__rowsFixture.length;
    }, 120000))) throw new Error('boot: the report never finished loading (120 s)');
    await sleep(700);

    // ---- T0: console closed - the control regime -------------------------------
    var g0 = geo();
    rec('T0 console closed: Easy Read, the box scrolls sideways, has >= 250px of room and fits exactly on the bar',
      document.body.classList.contains('density-easy-read') && !admOpen() && g0.hScroll && g0.hbarH >= 8 && g0.room >= 250 && fits(g0) && Math.abs(g0.cap - g0.room) <= 1,
      txt(g0) + ' hbarH=' + g0.hbarH + ' easyRead=' + document.body.classList.contains('density-easy-read'));

    // ---- size the console's three tabs from the measured room ------------------
    // main.css gives #editorTabs a 310px min-height (the console never drops below
    // ~342px), so the chrome is measured with a panel tall enough to clear it, and
    // every tab must stay above that floor or the console stops following it.
    $('#tf-tab-a .tf-fill').height(500);
    await toggleConsole(true);
    var gOpen0 = geo();
    var chrome = gOpen0.admH - 500;
    await toggleConsole(false);
    var gC = geo();
    var A0 = gC.room;
    var pA = Math.round(A0 - 170 - chrome), pB = Math.round(A0 - 40 - chrome), pC = Math.round(A0 - 330 - chrome);
    notes.push('room closed ' + A0 + ', console chrome ' + chrome + ' (open at 500: ' + gOpen0.admH + '), panels A/B/C ' + pA + '/' + pB + '/' + pC);
    if (Math.min(pA, pB, pC) + chrome < 360) throw new Error('fixture: the window is too short for the three console regimes (' + notes[notes.length - 1] + ')');
    $('#tf-tab-a .tf-fill').height(pA);
    $('#tf-tab-b .tf-fill').height(pB);
    $('#tf-tab-c .tf-fill').height(pC);
    $('#editorTabs').tabs('option', 'active', 0);

    // ---- T-open: the reported case - Easy Read + the docked console open --------
    await toggleConsole(true);
    var g1 = geo();
    rec('T-open the REAL console toggle (tab A open, 100-250px of room): the box fits above the bar, its horizontal scrollbar on screen',
      admOpen() && g1.tab === 0 && g1.room >= 100 && g1.room < 250 && fits(g1) && Math.abs(g1.cap - g1.room) <= 1, txt(g1));

    // ---- T-tabshrink: a shorter tab gives the box more room ---------------------
    recap(); await sleep(150);
    await tab(2);
    var g2 = geo();
    rec('T-tabshrink switching to a SHORTER console tab (no explicit re-cap): the box grows back down to the bar, no gap',
      g2.tab === 2 && g2.room >= 250 && fits(g2), txt(g2));

    // ---- T-tabgrow: a taller tab pushes the box down ------------------------------
    recap(); await sleep(150);
    await tab(0);
    var g3 = geo();
    rec('T-tabgrow switching to a TALLER console tab (no explicit re-cap): the box shrinks to stay above the bar',
      g3.tab === 0 && g3.room >= 100 && g3.room < 250 && fits(g3), txt(g3));

    // ---- T-floor: a tab taller than the window can spare ----------------------------
    recap(); await sleep(150);
    await tab(1);
    var g4 = geo();
    rec('T-floor switching to a console tab that leaves < 100px (no explicit re-cap): the box keeps 250px and the page scrolls to it',
      g4.tab === 1 && g4.room < 100 && g4.cap === 250 && g4.maxScroll >= 120, txt(g4));

    // ---- T-floorbar: scrolled to the end, that box's scrollbar is above the bar ------
    recap(); await sleep(150);
    window.scrollTo(0, document.scrollingElement.scrollHeight);
    await sleep(250);
    var g5 = geo();
    rec('T-floorbar with the page scrolled to its end, the 250px box\'s horizontal scrollbar sits right above the bar',
      g5.scrollY > 0 && g5.scrollY === g5.maxScroll && g5.hbarBottom <= g5.barTop + 0.5 && g5.hbarBottom >= g5.barTop - 3, txt(g5));

    // ---- T-scrollstable: a re-cap on a scrolled page changes nothing --------------
    var s0 = g5.scrollY, c0 = g5.cap;
    var changesP = capChanges(1600);
    recap();
    var n6 = await changesP;
    var g6 = geo();
    rec('T-scrollstable re-capping while the page is scrolled keeps the same cap and scroll position (the cap is measured from the PAGE, not the viewport)',
      g6.cap === c0 && Math.abs(g6.scrollY - s0) <= 1 && n6 <= 1, txt(g6) + ' before: cap=' + c0 + ' scrollY=' + s0 + ' capChanges=' + n6);
    window.scrollTo(0, 0);
    await sleep(200);

    // ---- T-idle: settled, the page observer does not re-cap in a loop --------------
    await tab(0);
    await sleep(300);
    var n7 = await capChanges(1000);
    var g7 = geo();
    rec('T-idle settled on tab A, the cap does not change again over 1s (no observer feedback loop)', n7 === 0, txt(g7) + ' capChanges=' + n7);

    await toggleConsole(false);

    // ---- T-hdr / T-hdrback: the header re-renders taller, then shorter ----------
    recap(); await sleep(150);
    var so = el('reportSnippetOutput');
    notes.push('header ' + el('reportHeaderContainer').offsetHeight + 'px; snippet output display=' + getComputedStyle(so).display +
      ' children=' + so.children.length + ' h=' + so.offsetHeight + ' tfSnippetBlock=' + !!el('tfSnippetBlock'));
    var g8a = geo();
    var grow = document.createElement('div');
    grow.id = 'tfGrow'; grow.style.height = '80px'; grow.textContent = 'more header';
    el('reportInfoPanel').appendChild(grow);
    await sleep(350);
    var g8 = geo();
    notes.push('header after +80px: ' + el('reportHeaderContainer').offsetHeight + 'px');
    rec('T-hdr the report header grows 80px (no explicit re-cap): the box shrinks to stay above the bar',
      !admOpen() && g8.room >= 250 && g8.docTop - g8a.docTop >= 70 && fits(g8), txt(g8) + ' moved=' + r1(g8.docTop - g8a.docTop));

    recap(); await sleep(150);
    grow.parentNode.removeChild(grow);
    await sleep(350);
    var g9 = geo();
    rec('T-hdrback the header shrinks back (no explicit re-cap): the box grows back down to the bar, no gap',
      g9.room >= 250 && g8.docTop - g9.docTop >= 70 && fits(g9), txt(g9) + ' moved=' + r1(g9.docTop - g8.docTop));
  }

  run().then(function () {}, function (e) { notes.push('FATAL ' + (e && e.message || e)); R.push({ name: 'F-run', pass: false, detail: String(e && e.stack || e).slice(0, 600) }); })
    .then(function () {
      var errs = window.__errors.concat(window.__rejections);
      rec('E no page errors, no hook errors', !errs.length && !window.__TF_ERR && !window.__TF_ERR2 && !(window.__TF_MISSING || []).length,
        JSON.stringify(errs.slice(0, 4)) + ' ' + [window.__TF_ERR, window.__TF_ERR2, (window.__TF_MISSING || []).join(',')].filter(Boolean).join('; '));
      window.__TFRESULT = { results: R, notes: notes };
      window.__TFDONE = true;
    });
})();
