// admesc suite - browser half (2026-10-02). Runs ONE scenario (?scn=) on one page
// shape (?page=) against whichever main.js the page loaded and publishes
//   window.__ADMRESULT = { scn, page, asserts: [{id, ok, detail}], obs: {...}, errors: [...] }
// and window.__ADMDONE = true. run.py collects and prints the asserts.
//
// A REAL key press (trusted, to the focused element) is asked of run.py through
// window.__WANTKEY = n; run.py sends it over CDP and sets window.__KEYSENT = n.
(function () {
  var SCN = window.__SCN, PAGE = window.__PAGE;
  var R = { scn: SCN, page: PAGE, asserts: [], obs: {}, errors: [] };
  function rec(id, ok, detail) { R.asserts.push({ id: id, ok: !!ok, detail: String(detail == null ? '' : detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(20); return fn(); }
  function clickEl(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function escOn(el, KE) {
    KE = KE || KeyboardEvent;
    return el.dispatchEvent(new KE('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
  }
  var _keySeq = 0;
  async function realEscape() {
    var n = ++_keySeq;
    window.__WANTKEY = n;
    var ok = await until(function () { return window.__KEYSENT === n; }, 15000);
    if (!ok) throw new Error('run.py never sent real key #' + n);
  }

  // ---- reading the page --------------------------------------------------
  function pref() { try { return localStorage.getItem('penumbra_admin_open'); } catch (e) { return 'ERR'; } }
  // The blocks the drawer open pushes down and rides back up (main.js $admPush):
  // after an open they must carry no inline transition / transform / will-change.
  var PUSH = ['errorBox', 'snapAnalysisDock', 'resultsHeader', 'table-view-container'];
  function pushResidue() {
    var out = [];
    PUSH.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) { out.push(id + ': MISSING'); return; }
      var s = el.style, bits = [];
      if (s.transition) bits.push('transition=' + s.transition);
      if (s.transform) bits.push('transform=' + s.transform);
      if (s.willChange) bits.push('will-change=' + s.willChange);
      if (bits.length) out.push(id + ' ' + bits.join(' '));
    });
    return out;
  }
  function wrapperResidue(w) {
    var s = w.style, bits = [];
    if (s.clipPath) bits.push('clip-path=' + s.clipPath);
    if (s.transition) bits.push('transition=' + s.transition);
    if (s.willChange) bits.push('will-change=' + s.willChange);
    return bits;
  }
  function errsSince(n) { return window.__errors.slice(n); }
  function shown(el) { return !!el && el.ownerDocument === document && el.isConnected && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; }
  function landingShown() { var el = document.querySelector('.landing-container'); return shown(el); }

  // ---- boot ----------------------------------------------------------------
  async function bootReport() {
    await until(function () { return window.__queryDone >= 1 && (window.__ADM_HIDES || 0) >= 1; }, 60000);
    await sleep(300);
    // the journal pass (toggles + row notes) lands after the render
    await until(function () { return document.querySelectorAll('.journal-notes-btn').length > 0; }, 8000);
    await sleep(500);
  }
  async function bootHome() {
    await until(function () { return !!window._admPip && $('#floating-button-container').css('visibility') === 'visible'; }, 30000);
    await sleep(800);
  }

  // Escape with nothing to close on a page WITHOUT the console: no exception, and
  // nothing moves - the admin's saved preference, the landing, the report blocks.
  function checkQuiet(prefix, n0, pref0) {
    var errs = errsSince(n0);
    rec(prefix + '-err', !errs.length, errs.length ? errs.join(' | ') : 'no uncaught error');
    rec(prefix + '-pref', pref() === pref0, 'penumbra_admin_open "' + pref0 + '" -> "' + pref() + '"');
    var res = pushResidue();
    rec(prefix + '-push', !res.length, res.length ? res.join(' ; ') : 'report blocks untouched');
    return errs;
  }

  var S = {
    // THE INCIDENT: a viewer page (jjornl&noadm), a journal row note open, the
    // caret in its composer, a real Escape press.
    rownote: async function () {
      await bootReport();
      var btn = null, bs = document.querySelectorAll('.journal-notes-btn');
      for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute('data-row-key') === window.__NOTED) btn = bs[i];
      if (btn) clickEl(btn);
      // A table row's notes open in the floating card (2026-10-07; it was a panel row).
      await until(function () { return document.querySelectorAll('.journal-pvnote-card').length === 1; }, 3000);
      var child = document.querySelector('.journal-pvnote-card');
      var inp = child ? child.querySelector('.journal-rownote-input') : null;
      if (inp) { inp.focus(); await sleep(50); }
      var focusIn = !!(inp && child.contains(document.activeElement));
      rec('P-rownote-open', !document.getElementById('admWrapper') && !!child && focusIn,
          'no #admWrapper: ' + !document.getElementById('admWrapper') + ', note panel open: ' + !!child + ', focus in its composer: ' + focusIn);
      var n0 = window.__errors.length, p0 = pref();
      await realEscape();
      await sleep(700);   // past the drawer's 480 ms safety timer
      var errs = checkQuiet('V-rownote', n0, p0);
      R.obs.rownoteErrors = errs;
      // (2026-10-10, the note card's standard head) the first Escape closes a row note's card - it used to stay - and the
      // console stays shut (V-rownote-body)
      rec('V-rownote-panel', document.querySelectorAll('.journal-pvnote-card').length === 0,
          'note cards open after the Escape: ' + document.querySelectorAll('.journal-pvnote-card').length + ' (Escape closes the card first)');
      rec('V-rownote-body', !document.body.classList.contains('admin-view'), 'body.admin-view: ' + document.body.classList.contains('admin-view'));
    },
    // The same page, focus nowhere in particular.
    bodyesc: async function () {
      await bootReport();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      var n0 = window.__errors.length, p0 = pref();
      escOn(document.body);
      await sleep(700);
      checkQuiet('V-body', n0, p0);
    },
    // A double press (inside the 400 ms window) takes section D's force-show +
    // dock-toggle path.
    double: async function () {
      await bootReport();
      var n0 = window.__errors.length, p0 = pref();
      escOn(document.body);
      await sleep(100);
      escOn(document.body);
      await sleep(700);
      checkQuiet('V-double', n0, p0);
    },
    // A file dropped on the report: the app-wide import ends by opening the
    // console (importFileData -> toggleSmartAdminView(true)). Its FileReader
    // callback wraps importFileData in a try/catch, so the TypeError never
    // reached the telemetry - it was logged as "Parse error:" and shown as a red
    // "PARSE ERROR: Cannot read properties of undefined ..." toast, although the
    // import itself had worked.
    drop: async function () {
      await bootReport();
      var n0 = window.__errors.length, p0 = pref(), q0 = window.__queryDone, c0 = window.__consoleErrors.length;
      var dt = new DataTransfer();
      dt.items.add(new File(['NAME,AMOUNT\r\nAlpha,10\r\nBravo,20\r\n'], 'viewer_drop.csv', { type: 'text/csv' }));
      document.getElementById('resultsHeader').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      var saved = await until(function () { return window.__ajaxLog.some(function (u) { return /manage_imports\.php/.test(u); }); }, 8000);
      await until(function () { return window.__queryDone > q0; }, 8000);
      await sleep(1200);
      rec('P-drop-ran', saved && window.__queryDone > q0, 'import saved: ' + saved + ', query re-ran: ' + (window.__queryDone > q0));
      R.obs.dropErrors = checkQuiet('V-drop', n0, p0);
      var caught = window.__consoleErrors.slice(c0).filter(function (m) { return /Parse error/i.test(m); });
      var toast = ($('#action_overlay').text() || '').replace(/\s+/g, ' ').trim();
      R.obs.dropToast = toast;
      rec('V-drop-caught', !caught.length, caught.length ? 'console.error: ' + caught.join(' | ') : 'no swallowed error');
      rec('V-drop-toast', !/PARSE ERROR/i.test(toast), 'toasts: "' + toast.slice(0, 240) + '"');
    },
    // The home screen for a non-admin: Escape must not slide the landing cards away.
    home: async function () {
      await bootHome();
      var before = landingShown();
      rec('P-home-landing', before && !document.getElementById('admWrapper'), 'landing shown: ' + before + ', no #admWrapper: ' + !document.getElementById('admWrapper'));
      var n0 = window.__errors.length, p0 = pref();
      escOn(document.body);
      await sleep(700);
      checkQuiet('H-home', n0, p0);
      rec('H-home-landing', landingShown(), 'landing shown after the Escape: ' + landingShown());
    },
    // WITH the console (the path the fix must leave alone): Escape opens it with
    // the drawer, the drawer finishes clean, Escape closes it.
    editor: async function () {
      await bootReport();
      var w = document.getElementById('admWrapper');
      rec('P-editor-closed', !!w && !shown(w) && pref() === 'false', 'console present ' + !!w + ', hidden at boot ' + (w && !shown(w)) + ', pref ' + pref());
      var n0 = window.__errors.length;
      escOn(document.body);
      await sleep(900);
      var res = wrapperResidue(w).concat(pushResidue());
      var openOk = shown(w) && document.body.classList.contains('admin-view') && pref() === 'true' &&
                   $('#toggleAdminViewBtn').attr('aria-expanded') === 'true' && !res.length;
      rec('C-open', openOk, 'shown ' + shown(w) + ', body.admin-view ' + document.body.classList.contains('admin-view') +
          ', pref ' + pref() + ', aria-expanded ' + $('#toggleAdminViewBtn').attr('aria-expanded') + ', residue [' + res.join(' ; ') + ']');
      await sleep(500);   // past the double-press window
      escOn(document.body);
      await sleep(600);
      rec('C-close', openOk && !shown(w) && !document.body.classList.contains('admin-view') && pref() === 'false',
          'was open ' + openOk + ', shown ' + shown(w) + ', body.admin-view ' + document.body.classList.contains('admin-view') + ', pref ' + pref());
      var errs = errsSince(n0);
      rec('C-err', !errs.length, errs.join(' | ') || 'no uncaught error');
    },
    // The console popped out to its own window ("Open in Window", window._admPip):
    // every way home - Escape in the tab, closing the window, Escape inside the
    // window - lands the console back in the tab, shown, without an error.
    popout: async function () {
      await bootReport();
      var n0 = window.__errors.length;
      async function popOut(label) {
        $('#popOutWindowBtn').trigger('click');
        var ok = await until(function () {
          return window._admPip && window._admPip.active && window._admPip.win &&
                 window._admPip.win.document.getElementById('admWrapper') && !document.getElementById('admWrapper');
        }, 8000);
        await sleep(300);
        return ok;
      }
      function home() {
        var w = document.getElementById('admWrapper');
        return { ok: !!w && shown(w) && !window._admPip.active && !window._admPip.win && document.body.classList.contains('admin-view'),
                 txt: 'in the tab ' + !!w + ', shown ' + (!!w && shown(w)) + ', _admPip.active ' + window._admPip.active +
                      ', body.admin-view ' + document.body.classList.contains('admin-view') };
      }
      var w0 = document.getElementById('admWrapper');
      var out1 = await popOut('escape');
      rec('P-pop-out', !!w0 && shown(w0) === false && out1, 'console left the tab for its window: ' + out1);
      // 1. Escape in the tab (section D0)
      escOn(document);
      await sleep(900);
      var h1 = home();
      rec('C-pop-esc', out1 && h1.ok, h1.txt);
      // 2. the window closed natively (its pagehide restores)
      var out2 = await popOut('close');
      if (out2) window._admPip.win.close();
      await until(function () { return !window._admPip.active; }, 5000);
      await sleep(900);
      var h2 = home();
      rec('C-pop-close', out2 && h2.ok, 'popped ' + out2 + ' | ' + h2.txt);
      // 3. Escape INSIDE the console window (replayed onto the tab's handler)
      var out3 = await popOut('pipesc');
      if (out3) { var pw = window._admPip.win; escOn(pw.document, pw.KeyboardEvent); }
      await sleep(900);
      var h3 = home();
      rec('C-pop-pipesc', out3 && h3.ok, 'popped ' + out3 + ' | ' + h3.txt);
      var errs = errsSince(n0);
      rec('C-pop-err', !errs.length, errs.join(' | ') || 'no uncaught error');
    }
  };

  (async function () {
    try {
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) {
      R.fatal = String((e && e.stack) || e);
    }
    R.errors = window.__errors.slice();
    R.rejections = window.__rejections.slice();
    window.__ADMRESULT = R;
    window.__ADMDONE = true;
    var o = document.getElementById('out'); if (o) o.textContent = JSON.stringify(R, null, 1);
  })();
})();
