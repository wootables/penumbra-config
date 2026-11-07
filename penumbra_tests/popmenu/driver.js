// popmenu suite - page half (2026-11-06): the shared right-click menus in the popped-out console, on the REAL main.js
// and js/penumbra_colmenu.js (the pivmenu harness: a saved pivot, H_GROUP > H_GROUP2 down, V_STATUS across, sum of H_AMT).
//   pwmenu   the tab first: a breakdown's menu opens there and copies with the tab's clipboard (dockMenu, dockCopy).
//            Then the REAL "Open in Window" (popOpened): with the console window holding the focus, a breakdown is drawn
//            THERE (main.js _pnbModalHost: bdInPop), and its menu opens in that window (opens), styled by the stylesheet
//            the pop-out copied (styled), Copy first and focused (copyFirst); the keys move, open and leave a list, and
//            ArrowDown stays in the panel holding the focus while a hovered list is open (keysMove, keysSub, keysPanel);
//            Escape closes the menu, not the dialog under it, the focus back on its cell (escMenuOnly, escRefocus); a
//            hover opens a list (hoverSub); Copy > This value writes the console window's clipboard and its toast shows
//            there (copyPop, toastPop); Column stats > Rows per group and Copy > Distinct column groups over the
//            breakdown's own rows (statsGroups, copyGroups); a menu and its list opened at that window's corner stay
//            inside THAT window, smaller than the tab (placed, subPlaced); a cell with text selected keeps the browser's
//            menu (selKeepsBrowser); the tab's blur leaves the menu open, the console window's closes it (blurOwn); a
//            press outside it closes it (downCloses); a menu of given items marked by a node there (the Server
//            Repository's rows) opens there (itemsInPop); the breakdown's footer (sumInPop); Return to Tab closes a
//            menu left open there (restoreCloses). Back in the tab: a breakdown's menu as before (dockAfter).
//   ?real=1 (run.py --real): REAL input in the console window over CDP - a right-click, ArrowDown, Escape
//            (realMenu, realKeys, realEsc).
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {}, notes: [] };
  var REAL = /[?&]real=1/.test(location.search);
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function cells() { return document.querySelectorAll('#pivotResultTable tbody td[data-agg-idx]'); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    if (!(await until(function () { return cells().length > 0; }, 20000))) throw new Error('no pivot value cells');
    await sleep(600);
    window.__toasts = [];
    var shown = window.show_text;   // the page's own toasts (their dock chosen per window): recorded, still shown
    window.show_text = function (html) { window.__toasts.push(String(html)); return shown.apply(this, arguments); };
    // (round 2) the page's own menu reads a report's id from the address (its 'report' items: Re-run, Metrics, the
    // feedback form...): given one now that main.js has booted (no reload, nothing re-read)
    try { history.replaceState(null, '', location.pathname + location.search + '&id=pwtest'); } catch (e) { R.notes.push('replaceState: ' + e); }
  }
  function CM() { return window.Penumbra && window.Penumbra.colMenu; }
  function closeMenu() { if (CM()) CM().close(); }
  function popWin() { var p = window._admPip; return (p && p.active && p.win && !p.win.closed) ? p.win : null; }
  function menuIn(d) { return d ? d.getElementById('pnbHeadMenu') : null; }
  function panelsIn(d) { return Array.prototype.slice.call(d.querySelectorAll('#pnbHeadMenu, .pnb-hm-sub')); }
  function itemIn(d, act) { var ps = panelsIn(d); for (var i = 0; i < ps.length; i++) { var x = ps[i].querySelector('[data-act="' + act + '"]'); if (x) return x; } return null; }
  function subIn(d) { var s = d.querySelectorAll('.pnb-hm-sub'); return s.length ? s[s.length - 1] : null; }
  function actsOf(p) { return p ? Array.prototype.map.call(p.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
  function actOf(el) { return el && el.getAttribute ? el.getAttribute('data-act') : null; }
  // the events a person's hand makes, built by the window the target is in and sent to it
  function rclick(el, x, y) {
    var w = el.ownerDocument.defaultView, r = el.getBoundingClientRect();
    return !el.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, view: w,
      clientX: x === undefined ? Math.round(r.left + 6) : x, clientY: y === undefined ? Math.round(r.top + 6) : y }));
  }
  function key(d, k) { var a = d.activeElement, w = d.defaultView; if (a) a.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, view: w })); }
  function hover(el) { var w = el.ownerDocument.defaultView, r = el.getBoundingClientRect(); el.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: w, clientX: r.left + 4, clientY: r.top + 4 })); }
  function press(el) { var w = el.ownerDocument.defaultView; el.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: w })); }
  async function open(d, act) { var it = itemIn(d, act); if (!it) return false; it.click(); await sleep(150); return true; }
  function txt(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function inView(el) {
    var w = el.ownerDocument.defaultView, r = el.getBoundingClientRect();
    return { ok: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= w.innerWidth + 0.5 && r.bottom <= w.innerHeight + 0.5,
      r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], view: [w.innerWidth, w.innerHeight] };
  }
  function hd(bt, name) { return Array.prototype.filter.call(bt.tHead.rows[0].cells, function (h) { return h.getAttribute('data-pnb-bd-col') === name; })[0] || null; }
  // the leaf value cell with the most rows behind it (its rows' H_AMT add up): its years repeat
  function bigLeaf() {
    var ls = Array.prototype.filter.call(document.querySelectorAll('#pivotResultTable tbody tr:not(.pivot-group-summary-row) td[data-row-key][data-col-key]'), function (td) {
      return td.parentNode.style.display !== 'none' && td.getAttribute('data-row-key').indexOf('|||') > 0 && !td.classList.contains('pivot-grand-total') && /\d/.test(td.textContent);
    });
    function amt(td) { return parseFloat(td.textContent.replace(/[^0-9.\-]/g, '')) || 0; }
    return ls.sort(function (a, b) { return amt(b) - amt(a); })[0] || null;
  }
  // the breakdown behind that cell, through the pivot's own menu (Show the breakdown): drawn where main.js hosts it
  async function drill() {
    closeMenu();
    var leaf = bigLeaf();
    if (!leaf) throw new Error('no leaf cell');
    rclick(leaf);
    var it = itemIn(document, 'pvDrill');
    if (!it) throw new Error('no pvDrill item: ' + actsOf(menuIn(document)).join());
    it.click();
    await sleep(700);
  }
  function closeDialogs(d) { Array.prototype.forEach.call(d.querySelectorAll('.infobox-overlay .close-lightbox'), function (b) { b.click(); }); }
  // a breakdown in the tab: its menu opens there, Copy > This value writes the tab's clipboard
  async function dockCheck() {
    await drill();
    var bt = document.querySelector('table.pnb-breakdown'), out = { table: !!bt };
    if (!bt) return out;
    var th = hd(bt, 'V_ID'), td = th ? bt.tBodies[0].rows[0].cells[th.cellIndex] : null;
    if (!td) return out;
    var pw = popWin();
    out.opened = rclick(td) && !!menuIn(document) && !(pw && menuIn(pw.document));
    var c0 = window.__clip.length;
    if (await open(document, 'bdCopyMenu')) { await open(document, 'bdCopy'); await sleep(300); }
    out.copied = window.__clip.length === c0 + 1 && window.__clip[window.__clip.length - 1] === txt(td);
    out.clip = window.__clip.slice(-1);
    closeMenu(); closeDialogs(document); await sleep(200);
    return out;
  }

  var S = {
    pwmenu: async function () {
      // --- the tab, before
      var before = await dockCheck();
      R.chk.dockMenu = !!before.table && !!before.opened;
      R.chk.dockCopy = !!before.copied;
      R.info.dockBefore = before;

      // --- "Open in Window": the REAL button, the REAL window.open() window, the REAL _mountConsoleIn
      var btn = document.getElementById('popOutWindowBtn');
      if (btn) btn.click();
      R.chk.popOpened = !!btn && await until(function () { var w = popWin(); return !!(w && w.document.getElementById('admWrapper')); }, 10000);
      if (!R.chk.popOpened) { R.info.popOpened = { btn: !!btn }; return; }
      await sleep(400);   // _mountConsoleIn's own 80 / 120 ms settle timers
      var pw = popWin(), pd = pw.document;
      // the person works in the console window: every focus test main.js makes (where a dialog, a toast, a clipboard
      // write goes) asks hasFocus(), decided here (a headless page's focus is whatever CDP says)
      pd.hasFocus = function () { return true; };
      document.hasFocus = function () { return false; };
      pw.__clip = [];
      try {
        Object.defineProperty(pw.navigator, 'clipboard', { configurable: true, value: {
          writeText: function (t) { pw.__clip.push(String(t)); return pw.Promise.resolve(); } } });
      } catch (e) { R.notes.push('console window clipboard: ' + e); }

      await drill();
      var bt = pd.querySelector('table.pnb-breakdown');
      R.chk.bdInPop = !!bt && !document.querySelector('table.pnb-breakdown') && bt.tBodies[0].rows.length > 1 &&
        Array.prototype.every.call(bt.tBodies[0].rows, function (tr) { return tr.__pnbBdSrc instanceof Map; });
      R.info.bdInPop = { inPop: !!bt, inTab: !!document.querySelector('table.pnb-breakdown'), rows: bt ? bt.tBodies[0].rows.length : 0,
        popView: [pw.innerWidth, pw.innerHeight], tabView: [window.innerWidth, window.innerHeight] };
      if (!bt) return;
      var thV = hd(bt, 'V_ID'), thD = hd(bt, 'V_DATE');
      if (!thV || !thD) throw new Error('breakdown headings missing');
      var tdV = bt.tBodies[0].rows[0].cells[thV.cellIndex];

      // --- REAL input (run.py --real): a right-click, ArrowDown, Escape over CDP in the console window's own target
      if (REAL) {
        closeMenu();
        var rr = tdV.getBoundingClientRect();
        window.__PW_REAL = { x: Math.round(rr.left + 8), y: Math.round(rr.top + 8) };
        await until(function () { return !!window.__PW_REAL_GO; }, 90000);
        var g = window.__PW_REAL_GO || {}, g1 = {}, g3 = {};
        try { g1 = JSON.parse(g.r1 || '{}'); g3 = JSON.parse(g.r3 || '{}'); } catch (e) { }
        R.chk.realMenu = !!g1.menu && !g1.inTab && g1.act === 'bdCopyMenu';
        R.chk.realKeys = !!g.r2 && g.r2 !== g1.act;
        R.chk.realEsc = g3.menu === false && g3.dialog === true;
        R.info.real = g;
        closeMenu();
      }

      // Every block below runs whatever the one before found: on live the menu never opens in the console window (the
      // new checks red there) while the guards (selKeepsBrowser, dockAfter) must still pass. Escape is pressed only over
      // an open menu - in the console window it otherwise closes the dialog, then brings the console back to the tab.
      function escape() { if (menuIn(pd)) key(pd, 'Escape'); }
      // --- the menu opens in the console window
      var prevented = rclick(tdV), m = menuIn(pd);
      R.chk.opens = prevented && !!m && !menuIn(document);
      R.info.opens = { prevented: prevented, inPop: !!m, inTab: !!menuIn(document) };
      var acts = actsOf(m);
      if (m) {
        var cs = pw.getComputedStyle(m), mr = m.getBoundingClientRect();
        var topEl = pd.elementFromPoint(mr.left + mr.width / 2, mr.top + Math.min(20, mr.height / 2));
        R.chk.styled = cs.position === 'fixed' && cs.zIndex === '100003' && mr.width > 0 && !!topEl && m.contains(topEl);
        R.info.styled = { pos: cs.position, z: cs.zIndex, w: Math.round(mr.width), top: topEl ? topEl.tagName + '.' + topEl.className : null };
        R.chk.copyFirst = acts[0] === 'bdCopyMenu' && pd.activeElement === itemIn(pd, 'bdCopyMenu');
        R.info.copyFirst = { acts: acts, active: actOf(pd.activeElement) };

        // --- the keys
        key(pd, 'ArrowDown'); var a1 = actOf(pd.activeElement);
        key(pd, 'ArrowUp'); var a2 = actOf(pd.activeElement);
        R.chk.keysMove = a1 === acts[1] && a2 === acts[0];
        key(pd, 'ArrowRight');   // Copy's list, entered
        var sub = subIn(pd), inSub = !!sub && sub.contains(pd.activeElement);
        key(pd, 'ArrowLeft');    // and left
        var back = !subIn(pd) && pd.activeElement === itemIn(pd, 'bdCopyMenu');
        R.chk.keysSub = inSub && back;
        R.info.keys = { a1: a1, a2: a2, inSub: inSub, subActs: actsOf(sub), back: back, now: actOf(pd.activeElement) };
        // a hover opens Copy's list without taking the focus: ArrowDown moves in the menu that holds the focus
        if (itemIn(pd, 'bdCopyMenu')) { hover(itemIn(pd, 'bdCopyMenu')); await sleep(350); }
        var hovSub = !!subIn(pd) && subIn(pd).ownerDocument === pd;
        R.chk.hoverSub = hovSub;
        key(pd, 'ArrowDown');
        var ae = pd.activeElement;
        R.chk.keysPanel = hovSub && actOf(ae) === acts[1] && m.contains(ae);
        R.info.keysPanel = { hovSub: hovSub, active: actOf(ae), inMenu: !!ae && m.contains(ae) };
        escape();
        await sleep(150);
        R.chk.escMenuOnly = !menuIn(pd) && !CM().isOpen() && !!pd.querySelector('.infobox-overlay') && !!pd.querySelector('table.pnb-breakdown');
        R.info.esc = { menu: !!menuIn(pd), open: CM().isOpen(), dialog: !!pd.querySelector('.infobox-overlay') };
      }
      closeMenu();
      if (!pd.querySelector('table.pnb-breakdown')) { R.notes.push('the breakdown closed with the menu: later checks run on nothing'); return; }
      // from the keyboard on a heading (a tab stop; a body cell takes no focus, in the tab either): Shift+F10 opens its
      // menu under it, Escape puts the focus back on it
      try { thV.focus({ preventScroll: true }); } catch (e) { thV.focus(); }
      var kOpen = thV.dispatchEvent(new pw.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, view: pw, clientX: 0, clientY: 0 })) === false;
      var kMenu = !!menuIn(pd);
      escape();
      await sleep(150);
      R.chk.escRefocus = kOpen && kMenu && !menuIn(pd) && pd.activeElement === thV;
      R.info.escRefocus = { opened: kOpen, menu: kMenu, after: !!menuIn(pd), active: pd.activeElement ? pd.activeElement.tagName + '.' + pd.activeElement.className : null, tabindex: thV.getAttribute('tabindex') };
      closeMenu();

      // --- Copy > This value: the console window's clipboard, its toast there
      rclick(tdV);
      if (itemIn(pd, 'bdCopyMenu')) { hover(itemIn(pd, 'bdCopyMenu')); await sleep(350); }
      var cp0 = pw.__clip.length, cm0 = window.__clip.length, itV = itemIn(pd, 'bdCopy');
      if (itV) { itV.click(); await sleep(450); }
      R.chk.copyPop = !!itV && pw.__clip.length === cp0 + 1 && pw.__clip[pw.__clip.length - 1] === txt(tdV) && window.__clip.length === cm0;
      var dockP = pd.getElementById('action_overlay'), dockT = document.getElementById('action_overlay');
      R.chk.toastPop = !!dockP && /Copied the value/.test(txt(dockP)) && !(dockT && /Copied the value/.test(txt(dockT)));
      R.info.copy = { item: !!itV, pop: pw.__clip.slice(-1), tab: window.__clip.length - cm0, cell: txt(tdV), dockPop: dockP ? txt(dockP).slice(0, 80) : null, toasts: window.__toasts.slice(-2) };

      // --- Column stats > Rows per group > By Year, over the breakdown's own rows (its dates: m/d/yyyy)
      var iD = thD.cellIndex, yc = {};
      Array.prototype.forEach.call(bt.tBodies[0].rows, function (tr) { var mm = /^(\d+)\/(\d+)\/(\d{4})/.exec(txt(tr.cells[iD])); if (mm) yc[mm[3]] = (yc[mm[3]] || 0) + 1; });
      var yrs = Object.keys(yc).sort();
      closeMenu(); rclick(thD);
      await open(pd, 'bdStats'); await open(pd, 'bdStatsGroup-year');
      var sp = subIn(pd), lines = sp ? Array.prototype.map.call(sp.querySelectorAll('.pnb-hm-item[data-act^="bdStatsRow-"]'), function (d) {
        var nt = d.querySelector('.pnb-hm-note'); return [txt(d.querySelector('.pnb-hm-label')), nt ? txt(nt) : ''];
      }) : [];
      R.chk.statsGroups = yrs.length > 0 && !!sp && sp.ownerDocument === pd && lines.length === yrs.length &&
        yrs.every(function (y, k) { return lines[k][0] === y && lines[k][1] === String(yc[y]); });
      R.info.statsGroups = { yrs: yrs, yc: yc, lines: lines };
      // --- Copy > Distinct column groups > By Year > A comma
      closeMenu(); rclick(thD);
      await open(pd, 'bdCopyMenu'); await open(pd, 'bdCopyGroups'); await open(pd, 'bdCopyGroup-year');
      var cg0 = pw.__clip.length, ic = itemIn(pd, 'bdCopyGroup-year-comma');
      if (ic) { ic.click(); await sleep(450); }
      R.chk.copyGroups = !!ic && pw.__clip.length === cg0 + 1 && pw.__clip[pw.__clip.length - 1] === yrs.join(',');
      R.info.copyGroups = { item: !!ic, got: pw.__clip.slice(-1), want: yrs.join(',') };

      // --- at the console window's corner: the menu and its list stay inside THAT window (smaller than the tab)
      closeMenu();
      rclick(tdV, pw.innerWidth - 12, pw.innerHeight - 12);
      var mp = menuIn(pd), pv = mp ? inView(mp) : { ok: false };
      R.chk.placed = !!mp && pv.ok && pw.innerWidth < window.innerWidth && pw.innerHeight < window.innerHeight;
      await open(pd, 'bdCopyMenu');
      var sb = subIn(pd), sv = sb ? inView(sb) : { ok: false };
      R.chk.subPlaced = !!sb && sv.ok;
      R.info.placed = { menu: pv, sub: sv, tab: [window.innerWidth, window.innerHeight] };

      // --- a cell with text selected in it keeps the browser's menu (that window's selection)
      closeMenu();
      var sel = pw.getSelection(); sel.removeAllRanges(); sel.selectAllChildren(tdV);
      var prevS = rclick(tdV);
      R.chk.selKeepsBrowser = !prevS && !menuIn(pd) && !menuIn(document);
      R.info.sel = { prevented: prevS, text: String(sel), menu: !!menuIn(pd) };
      sel.removeAllRanges(); closeMenu();

      // --- the tab's blur leaves it open, the console window's closes it
      rclick(tdV);
      var o1 = !!menuIn(pd);
      window.dispatchEvent(new FocusEvent('blur'));
      var o2 = !!menuIn(pd);
      pw.dispatchEvent(new pw.FocusEvent('blur'));
      var o3 = !!menuIn(pd);
      R.chk.blurOwn = o1 && o2 && !o3;
      R.info.blur = [o1, o2, o3];

      // --- a press outside it closes it
      rclick(tdV);
      var d1 = !!menuIn(pd);
      press(pd.body);
      R.chk.downCloses = d1 && !menuIn(pd) && !CM().isOpen();

      // --- a menu of given items marked by a node in the console window (the Server Repository's rows): there
      var ran = 0;
      CM().openItems('Rows', [{ act: 'zzRun', label: 'Run it', run: function () { ran++; } }], 40, 40, { mark: tdV, focusEl: tdV, noClear: true });
      var mi = menuIn(pd), zi = itemIn(pd, 'zzRun');
      if (zi) { zi.click(); await sleep(150); }
      R.chk.itemsInPop = !!mi && !menuIn(document) && ran === 1;
      R.info.items = { inPop: !!mi, inTab: !!menuIn(document), ran: ran };
      closeMenu();

      // --- the breakdown's footer: a summary row's menu, there
      var ft = (bt.tFoot && bt.tFoot.rows[0]) ? bt.tFoot.rows[0].cells[0] : null;
      var fp = ft ? rclick(ft) : false;
      R.chk.sumInPop = !!ft && fp && !!menuIn(pd) && !menuIn(document);
      R.info.sum = { foot: !!ft, cls: ft ? ft.className : null, prevented: fp, acts: actsOf(menuIn(pd)) };
      closeMenu();

      // ===================== round 2 (2026-11-06; the user: "lets fix those last 2") =====================
      // --- the page's own menu (js/penumbra_wsmenu.js). The tab's list while the console is out still finds the
      // console's Run (it lives in the console window now: main.js window._pnbById)
      var PM = window.PenumbraPageMenu;
      var tabActs = PM ? PM.items().map(function (x) { return x.act; }) : [];
      R.chk.wsTabRerun = tabActs.indexOf('rerun') >= 0;
      R.info.wsTab = { kind: PM ? PM.kind() : null, acts: tabActs };
      function pgm(d) { return d.getElementById('pnbPageMenu'); }
      function pgmActs(d) { var x = pgm(d); return x ? Array.prototype.map.call(x.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : []; }
      // ...and it opens IN the console window, over its window tools bar (not data, not a field: the page's chrome)
      closeMenu();
      var bar = pd.getElementById('admin-window-controls');
      var wsPrev = bar ? rclick(bar) : false, wm = pgm(pd);
      R.chk.wsOpens = !!bar && wsPrev && !!wm && !pgm(document);
      R.info.wsOpens = { bar: !!bar, prevented: wsPrev, inPop: !!wm, inTab: !!pgm(document) };
      if (wm) {
        var wcs = pw.getComputedStyle(wm);
        R.chk.wsStyled = wcs.position === 'fixed' && wm.getBoundingClientRect().width > 0;
        // there, not the items whose window opens beside the report (out of sight): the Settings panel, Quick actions,
        // the feedback form - the tab's own list has the feedback form; Re-run is there
        var pa = pgmActs(pd);
        R.chk.wsLeftOut = pa.indexOf('feedback') < 0 && pa.indexOf('settings') < 0 && pa.indexOf('quick') < 0 && tabActs.indexOf('feedback') >= 0 && pa.indexOf('rerun') >= 0;
        R.info.wsPop = { acts: pa };
        // the keys: the first item has the focus, ArrowDown moves; a hover on Admin opens its list there; Escape closes
        // it all, and the console stays in its window (main.js's own Escape there would bring it back to the tab)
        var f0 = actOf(pd.activeElement);
        key(pd, 'ArrowDown');
        var f1 = actOf(pd.activeElement);
        var adm = pd.querySelector('#pnbPageMenu [data-act="admin"]');
        if (adm) { hover(adm); await sleep(350); }
        var wsub = pd.querySelector('.pnb-pm.pnb-hm-sub');
        R.chk.wsSubHover = !!wsub;
        key(pd, 'Escape'); await sleep(150);
        R.chk.wsKeys = f0 === pa[0] && f1 === pa[1] && !pgm(pd) && !!popWin();
        R.info.wsKeys = { f0: f0, f1: f1, after: !!pgm(pd), stillOut: !!popWin(), subActs: wsub ? Array.prototype.map.call(wsub.querySelectorAll('.pnb-hm-item'), function (e) { return e.getAttribute('data-act'); }) : [] };
      }
      // at the console window's corner: the menu and its Admin list stay in THAT window (smaller than the tab)
      if (PM) PM.close();
      if (bar) rclick(bar, pw.innerWidth - 12, pw.innerHeight - 12);
      var wm2 = pgm(pd), wv = wm2 ? inView(wm2) : { ok: false };
      R.chk.wsPlaced = !!wm2 && wv.ok;
      var adm2 = pd.querySelector('#pnbPageMenu [data-act="admin"]');
      if (adm2) { adm2.click(); await sleep(200); }
      var ws2 = pd.querySelector('.pnb-pm.pnb-hm-sub'), wsv = ws2 ? inView(ws2) : { ok: false };
      R.chk.wsSubPlaced = !!ws2 && wsv.ok;
      R.info.wsPlace = { menu: wv, sub: wsv };
      // the tab's blur leaves it open, the console window's closes it
      var wb1 = !!pgm(pd);
      window.dispatchEvent(new FocusEvent('blur'));
      var wb2 = !!pgm(pd);
      pw.dispatchEvent(new pw.FocusEvent('blur'));
      var wb3 = !!pgm(pd);
      R.chk.wsBlurOwn = wb1 && wb2 && !wb3;
      R.info.wsBlur = [wb1, wb2, wb3];
      if (PM) PM.close();

      // --- a breakdown's column widths there (js/penumbra_colwidths.js)
      function wOf(th) { return Math.round(th.getBoundingClientRect().width); }
      closeMenu(); rclick(thV);
      R.chk.cwItems = !!itemIn(pd, 'bdWidth');
      R.info.cwItems = actsOf(menuIn(pd));
      closeMenu();
      // + on the focused heading: 20px wider, by a rule in THAT window's own <head>
      var w0 = wOf(thV);
      try { thV.focus({ preventScroll: true }); } catch (e) { thV.focus(); }
      thV.dispatchEvent(new pw.KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true, view: pw }));
      await sleep(120);
      var w1 = wOf(thV), cst = pd.getElementById('pnbColWidthDrillStyle');
      R.chk.cwKeys = w1 >= w0 + 15 && !!cst && /width:/.test(cst.textContent);
      // Column widths > Fit this column: the content's width, and an Undo in THAT window's notice puts the + width back
      rclick(thV); await open(pd, 'bdWidth');
      var fitIt = itemIn(pd, 'bdFit');
      if (fitIt) { fitIt.click(); await sleep(400); }
      var w2 = wOf(thV);
      R.chk.cwFit = !!fitIt && Math.abs(w2 - w1) >= 5;
      var cub = pd.querySelector('#action_overlay .pnb-colw-undo');
      if (cub) { cub.click(); await sleep(300); }
      var w3 = wOf(thV);
      R.chk.cwUndo = !!cub && Math.abs(w3 - w1) <= 2;
      R.info.cw = { w0: w0, w1: w1, w2: w2, w3: w3, style: cst ? cst.textContent.slice(0, 100) : null, fit: !!fitIt, undo: !!cub };
      // a grip drag: the press at the heading's right edge, the shield in THAT window, 40px to the right
      closeMenu();
      var gr = thV.getBoundingClientRect(), gx = Math.round(gr.right - 3), gy = Math.round(gr.top + gr.height / 2), wd0 = wOf(thV);
      thV.dispatchEvent(new pw.PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, isPrimary: true, pointerId: 7, clientX: gx, clientY: gy, view: pw }));
      var sh = pd.querySelector('.pnb-colw-shield'), shTab = !!document.querySelector('.pnb-colw-shield');
      if (sh) {
        sh.dispatchEvent(new pw.PointerEvent('pointermove', { bubbles: true, cancelable: true, buttons: 1, isPrimary: true, pointerId: 7, clientX: gx + 40, clientY: gy, view: pw }));
        await sleep(80);
        sh.dispatchEvent(new pw.PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, isPrimary: true, pointerId: 7, clientX: gx + 40, clientY: gy, view: pw }));
        await sleep(250);
      }
      var wd1 = wOf(thV);
      R.chk.cwDrag = !!sh && !shTab && Math.abs(wd1 - (wd0 + 40)) <= 3 && !pd.querySelector('.pnb-colw-shield');
      R.info.cwDrag = { shield: !!sh, inTab: shTab, wd0: wd0, wd1: wd1 };
      // the + - 0 hint the heading names lives in its own document
      var cdesc = String(thV.getAttribute('aria-describedby') || '');
      R.chk.cwHint = cdesc.split(/\s+/).indexOf('pnbColwKeysHint') >= 0 && !!pd.getElementById('pnbColwKeysHint');
      R.info.cwHint = { desc: cdesc, inPop: !!pd.getElementById('pnbColwKeysHint') };
      // back to its own width (0), so the rest reads the breakdown as it was
      try { thV.focus({ preventScroll: true }); } catch (e) { thV.focus(); }
      thV.dispatchEvent(new pw.KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true, view: pw }));
      await sleep(100);

      // ===================== round 3 (2026-11-06; the user: "Yes, fix it") =====================
      // --- the report's frozen columns reach a breakdown in the console window (main.js _bdApply / _bdApplyPop): with
      // two frozen ('#' and the first data column), its '#' and first data column stick there, the next does not, by a
      // rule in THAT window's own <head>; widening the '#' heading moves the next column's offset with it (that window's
      // own ResizeObserver: nothing else calls back)
      closeMenu();
      var HM = window.Penumbra.headerMenu, frWas = HM.frozen();
      HM.setFrozen(2);
      await sleep(300);
      var fRow = bt.tBodies[0].rows[0], fc0 = fRow.cells[0], fc1 = fRow.cells[1], fc2 = fRow.cells[2];
      var fcs1 = pw.getComputedStyle(fc1), fst = pd.getElementById('pnbBreakdownFreezeStyle'), fid = bt.getAttribute('data-pnb-bd');
      R.chk.bdFrozenPop = pw.getComputedStyle(fc0).position === 'sticky' && fcs1.position === 'sticky' && pw.getComputedStyle(fc2).position !== 'sticky' &&
        !!fst && !!fid && fst.textContent.indexOf('data-pnb-bd="' + fid + '"') >= 0;
      R.info.bdFrozenPop = { frozen: HM.frozen(), pos0: pw.getComputedStyle(fc0).position, pos1: fcs1.position, left1: fcs1.left, pos2: pw.getComputedStyle(fc2).position,
        rule: !!fst, id: fid, inTabRule: !!document.getElementById('pnbBreakdownFreezeStyle') && !!fid && document.getElementById('pnbBreakdownFreezeStyle').textContent.indexOf('data-pnb-bd="' + fid + '"') >= 0 };
      var fl0 = parseFloat(fcs1.left), fth0 = bt.tHead.rows[0].cells[0];
      try { fth0.focus({ preventScroll: true }); } catch (e) { fth0.focus(); }
      fth0.dispatchEvent(new pw.KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true, view: pw }));
      await sleep(600);
      var fl1 = parseFloat(pw.getComputedStyle(fc1).left);
      R.chk.bdFrozenPopRO = fl1 >= fl0 + 15;
      R.info.bdFrozenPopRO = { before: fl0, after: fl1, hashWidth: Math.round(fth0.getBoundingClientRect().width) };
      fth0.dispatchEvent(new pw.KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true, view: pw }));
      HM.setFrozen(frWas || 0);
      await sleep(250);

      // --- Return to Tab with a menu open in the console window: closed with it
      rclick(tdV);
      var r1 = !!menuIn(pd) && CM().isOpen(), rb = pd.getElementById('popOutWindowBtn');
      if (rb) rb.click();
      await until(function () { return !CM().isOpen(); }, 3000);
      R.chk.restoreCloses = r1 && !!rb && !popWin() && !CM().isOpen();
      R.info.restore = { open: r1, btn: !!rb, popWin: !!popWin(), isOpen: CM().isOpen() };
      closeMenu();
      await until(function () { return pw.closed; }, 5000);
      await sleep(300);

      // --- "Open in Window" again: a new window, a new document, bound as the first was (rebound); a breakdown there
      // again, and that window's pagehide alone - its own X closing it, no blur first (Return to Tab blurs the window
      // as it goes, and that blur closes the menu too) - closes the menu at once (main.js puts the console back from
      // the same pagehide)
      var btn2 = document.getElementById('popOutWindowBtn');
      if (btn2) btn2.click();
      var pw2 = await until(function () { var w = popWin(); return (w && w !== pw && w.document.getElementById('admWrapper')) ? w : null; }, 10000);
      R.info.again = { btn: !!btn2, win: !!pw2 };
      if (pw2) {
        await sleep(400);
        var pd2 = pw2.document;
        pd2.hasFocus = function () { return true; };
        document.hasFocus = function () { return false; };
        await drill();
        var bt2 = pd2.querySelector('table.pnb-breakdown'), th2 = bt2 ? hd(bt2, 'V_ID') : null, td2 = th2 ? bt2.tBodies[0].rows[0].cells[th2.cellIndex] : null;
        var o2 = td2 ? rclick(td2) : false;
        R.chk.rebound = !!td2 && o2 && !!menuIn(pd2) && !menuIn(document);
        var h1 = !!menuIn(pd2) && CM().isOpen(), h2 = null;
        try { pw2.dispatchEvent(new pw2.PageTransitionEvent('pagehide', { persisted: false })); } catch (e) { pw2.dispatchEvent(new pw2.Event('pagehide')); }
        h2 = CM().isOpen();   // read at once: the close that follows the console's return blurs the window later
        R.chk.pagehideCloses = h1 && h2 === false && !menuIn(pd2);
        R.info.pagehide = { breakdown: !!bt2, open: h1, after: h2 };
        closeMenu();
        await until(function () { return !popWin(); }, 5000);
      }

      // --- back in the tab
      delete document.hasFocus;
      await sleep(300);
      var after = await dockCheck();
      R.chk.dockAfter = !!after.table && !!after.opened && !!after.copied;
      R.info.dockAfter = after;

      // --- (round 2; run.py calls this LAST, once it has read the results: the tab leaves the harness) In the console
      // window's page menu, Admin > ZZ tool - a link to this tab's own place. The tab follows it; that window must not.
      window.__PW_NAV = async function () {
        var out = {};
        var b = document.getElementById('popOutWindowBtn');
        if (b) b.click();
        var w = await until(function () { var x = popWin(); return (x && x.document.getElementById('admWrapper')) ? x : null; }, 10000);
        if (!w) return JSON.stringify({ err: 'no console window' });
        await sleep(400);
        var d = w.document, bar2 = d.getElementById('admin-window-controls');
        if (bar2) rclick(bar2);
        var a2 = d.querySelector('#pnbPageMenu [data-act="admin"]');
        if (a2) { a2.click(); await sleep(200); }
        var link = d.querySelector('.pnb-hm-sub [data-act="tool-zz"]');
        out.menu = !!d.getElementById('pnbPageMenu'); out.link = link ? link.getAttribute('href') : null; out.popUrl = w.location.href;
        if (link) {
          // the event itself, taken first (window, capture), read once its dispatch is over: the menu stops it, so a
          // bubbling listener would never see it
          var seen = null;
          w.addEventListener('click', function (e) { seen = e; }, { capture: true, once: true });
          link.click();
          out.prevented = seen ? seen.defaultPrevented : null;
        }
        return JSON.stringify(out);
      };
    }
  };
  (async function () {
    try {
      await boot();
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String((e && e.stack) || e); }
    R.errors = window.__errors.concat(window.__rejections).slice(0, 10);
    window.__HCRESULT = R; window.__HCDONE = true;
    document.getElementById('out').textContent = 'DONE';
  })();
})();
