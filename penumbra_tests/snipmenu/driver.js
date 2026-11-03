// Function cards (2026-10-22, fnpop). Drives the REAL main.js (ready closure
// unwrapped, window.__TTH export hook), the REAL jQuery UI / CodeMirror and the
// REAL js/penumbra_snippet_help.js, loaded through main.js's own lazy loader;
// the console moves with the REAL "Open in Window" button into a real
// window.open() window, as production does.
//   L  lazy: nothing of the module (script, popover, cards) before the Custom
//      Code tab opens; a card never fetches the help document
//   S  the old jQuery UI tooltips are gone (no widget on the tab or the panel,
//      no HTML in a title attribute)
//   E  the editor's function names: the card opens on a hover, under the name,
//      inside the window; stays open on the way onto it; scrolls when long;
//      closes at once on typing and does not reopen for text sliding under a
//      resting pointer; closes when its name is redrawn away (the stuck tooltip);
//      Escape closes it and only it; its link opens the help at the entry
//   K  every editor function (and action type) has a card whose link lands on a
//      heading of the generated Custom Code topic; no dark-tooltip colours left
//   P  the panel's icons: function, shortcut and column cards
//   C  real columns in a dragged / double-clicked / autocompleted recipe
//   W  popped out: cards open in the console window (editor + panel + link),
//      and in the tab again after Return to Tab
//   M  (?mountpopped=1) the panel first built inside the console window
//   H  (?hook=1) main.js's first-hover hook loads the module and binds the cards
//   T  (fnpop 2) the cron help and the template string() helps (main.js's
//      _pnbHoverCard): no jQuery UI left; hover, onto it, Escape, keyboard focus,
//      a trigger hidden under it, the File Drop and copy cards and their links,
//      the console window, Return to Tab
//   U  (fnpop 3) every Scheduler tip, on index.php's REAL Scheduler tab: 20 cards, links
//      to real headings, each opens its own card, label mode, ? clicks, keyboard, pop-out
//   R  (fnpop 5) recipient and Access List pills (Scheduler, Send Email, Save): one mapper for
//      every variable, the page's directory answers, their hover cards, the alert card
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 900) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 10),
      hookErr: [window.__TTH_ERR, (window.__TTH_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  var MOUNT_POPPED = /[?&]mountpopped=1/.test(location.search);
  var HOOK = /[?&]hook=1/.test(location.search);
  var SH = function () { return window.PenumbraSnippetHelp; };

  function popWin() { var p = window._admPip; return (p && p.active && p.win && !p.win.closed) ? p.win : null; }
  function el(sel) {
    var n = document.querySelector(sel);
    var pw = popWin();
    if (!n && pw) n = pw.document.querySelector(sel);
    return n;
  }
  function where(node) {
    if (!node) return 'none';
    if (node.ownerDocument === document) return 'tab';
    var pw = popWin();
    if (pw && node.ownerDocument === pw.document) return 'console window';
    return 'another document';
  }
  function cm() { var w = el('#report-options-tab .CodeMirror'); return w ? w.CodeMirror : null; }
  function fnSpan(fn) { return el('#report-options-tab .CodeMirror .cm-function-underline[data-fn="' + fn + '"]'); }
  function pop() { return el('#snipCardPop'); }
  function isOpen() { var p = pop(); return !!(p && p.classList.contains('open')); }
  function reveal(t) { try { t.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { } }
  function blocker(t) {
    var r = t.getBoundingClientRect(), vw = t.ownerDocument.defaultView;
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!(r.width > 0 && r.height > 0)) return 'not laid out';
    if (!(x >= 0 && y >= 0 && x < vw.innerWidth && y < vw.innerHeight)) return 'outside the view';
    var top = t.ownerDocument.elementFromPoint(x, y);
    if (top && (top === t || t.contains(top) || top.contains(t))) return '';
    return 'covered by ' + (top ? top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + '.' + String(top.className || '') : 'nothing');
  }
  // A pointer move in the element's own document, at (x, y) or its centre.
  var last = { x: -1, y: -1 };
  function moveAt(doc, x, y, target) {
    var w = doc.defaultView;
    last = { x: x, y: y };
    var t = target || doc.elementFromPoint(x, y) || doc.body;
    t.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, cancelable: true, view: w, clientX: x, clientY: y }));
  }
  function centre(t) { var r = t.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }
  function hoverMove(t, dx) {
    var c = centre(t);
    moveAt(t.ownerDocument, c.x + (dx || 0), c.y, t);
    return c;
  }
  async function waitOpen(ms) { for (var k = 0; k < (ms || 1500) / 50; k++) { if (isOpen()) return true; await sleep(50); } return isOpen(); }
  async function waitClosed(ms) { for (var k = 0; k < (ms || 800) / 50; k++) { if (!isOpen()) return true; await sleep(50); } return !isOpen(); }
  // Hover until the card opens (two moves: the first may only arm the pointer).
  async function openOn(t) {
    if (!t) return false;
    reveal(t);
    hoverMove(t, 1);
    await sleep(30);
    hoverMove(t, 2);
    return waitOpen(1500);
  }
  async function closeCard() {
    if (SH() && SH().hideCard) SH().hideCard();
    await sleep(30);
  }
  function popInfo() {
    var p = pop();
    if (!p) return { exists: false };
    var r = p.getBoundingClientRect(), vw = p.ownerDocument.defaultView;
    var a = p.querySelector('a[data-help-anchor]');
    return { exists: true, open: p.classList.contains('open'), where: where(p), rect: r, viewW: vw.innerWidth, viewH: vw.innerHeight,
      inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= vw.innerWidth + 0.5 && r.bottom <= vw.innerHeight + 0.5,
      text: String(p.textContent || '').replace(/\s+/g, ' ').trim(), anchor: a ? a.getAttribute('data-help-anchor') : '',
      link: a ? String(a.textContent || '').trim() : '', overflowY: vw.getComputedStyle(p).overflowY,
      maxH: parseFloat(p.style.maxHeight) || 0, scrollH: p.scrollHeight, clientH: p.clientHeight };
  }
  function fmtPop(i) {
    if (!i.exists) return 'no popover element';
    return (i.open ? 'open' : 'CLOSED') + ' in the ' + i.where + ', x ' + Math.round(i.rect.left) + '..' + Math.round(i.rect.right) +
      ' y ' + Math.round(i.rect.top) + '..' + Math.round(i.rect.bottom) + ' in ' + i.viewW + 'x' + i.viewH +
      (i.inside ? '' : ' (OUTSIDE the view)') + ', link "' + i.link + '" -> ' + (i.anchor || 'none') + ', "' + i.text.slice(0, 60) + '"';
  }
  async function tab(id) {
    var a = el('#editorTabs a[href="#' + id + '"]');
    if (!a) throw new Error('no tab anchor for #' + id);
    a.click();
    await sleep(150);
    if (id === 'report-options-tab') {
      for (var k = 0; k < 100; k++) {
        var ico = el('#snipHelperList .snip-ico[data-card]');
        var fn = fnSpan('sum');
        if (ico && fn && blocker(fn) === '') break;
        await sleep(50);
      }
    }
  }
  async function popOut() {
    var btn = el('#popOutWindowBtn');
    if (!btn) return 'no #popOutWindowBtn';
    btn.click();
    for (var k = 0; k < 100 && !popWin(); k++) await sleep(50);
    if (!popWin()) return 'the console window never mounted';
    await sleep(250);
    return '';
  }
  async function returnToTab() {
    var btn = el('#popOutWindowBtn');
    if (!btn) return 'no #popOutWindowBtn';
    btn.click();
    for (var k = 0; k < 100 && window._admPip && window._admPip.active; k++) await sleep(50);
    if (window._admPip.active || !document.getElementById('admWrapper')) return 'the console did not come back to the tab';
    await sleep(250);
    return '';
  }
  var helpCalls = [];
  function stubHelp() {
    window.openHelpCenter = function (topic, anchor, focus) { helpCalls.push([topic, anchor, !!focus]); };
  }

  // ======================================================== snipmenu (2026-11-02)
  //   N1  right-click a helper row: the menu opens at the pointer, in the row's
  //       document, with Insert at cursor / at the beginning / Append to the end /
  //       Copy (+ the tray item and How to use where they apply); the browser's
  //       own menu is suppressed
  //   N2  Insert at the beginning: the realized recipe on line 1, the old text a line down
  //   N3  Append to the end: the recipe on a NEW last line, never welded on
  //   N4  with a selection the first item reads Replace selection and replaces it
  //   N5  a click on a row with no tray opens the menu UNDER the row
  //   N6  a click on a row WITH a tray still opens the tray, no menu
  //   N7  a double-click still inserts once at the cursor, and leaves no menu
  //   N8  keyboard: Shift+F10 opens it, arrows + Enter pick, main.js's Escape
  //       path closes it with the focus back on the row
  //   N9  How to use opens the row's card (its help, its link)
  //   N10 Copy puts the REALIZED recipe on the clipboard
  //   N11 Shift+right-click keeps the browser's menu
  //   N12 a mousedown outside closes it
  //   N13 popped out: the menu opens in the console window and inserts there
  //   N14 no page errors
  var COLS = ['ID', 'AWARD_AMT', 'START_DT', 'DEPT_NAME', 'STATUS_CD', 'NOTES'];
  var KINDS = {
    ID: { num: true, date: false, samples: ['1', '2'] },
    AWARD_AMT: { num: true, date: false, samples: ['1200', '50'] },
    START_DT: { num: false, date: true, samples: ['01-JAN-24'] },
    DEPT_NAME: { num: false, date: false, samples: ['Chemistry'] },
    STATUS_CD: { num: false, date: false, samples: ['Active, pending'] },
    NOTES: { num: false, date: false, samples: ['Text'] }
  };
  function stubCols() {
    window.Penumbra.getActiveColumnList = function () { return COLS; };
    window.Penumbra.colKinds = function (c) { return KINDS[String(c).toUpperCase()] || null; };
  }
  function list() { return el('#snipHelperList'); }
  function rowItem(label) {
    var rows = list().querySelectorAll('.snip-group[data-group="functions"] .snip-row:not(.snip-variant-row) > .snip-item');
    for (var i = 0; i < rows.length; i++) {
      var lab = rows[i].querySelector('.snip-label');
      if (lab && lab.textContent === label) return rows[i];
    }
    return null;
  }
  function firstRow(withTray) {
    var rows = list().querySelectorAll('.snip-row:not(.snip-variant-row)');
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].offsetParent) continue;
      var has = !!rows[i].querySelector('.snip-disc');
      if (has === withTray) return rows[i].querySelector('.snip-item');
    }
    return null;
  }
  function menuIn(doc) { return doc.querySelector('.snip-row-menu'); }
  function anyMenu() { var pw = popWin(); return menuIn(document) || (pw ? menuIn(pw.document) : null); }
  function acts(m) { return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-item'), function (n) { return n.getAttribute('data-act'); }) : []; }
  function labels(m) { return m ? Array.prototype.map.call(m.querySelectorAll('.pnb-hm-label'), function (n) { return n.textContent; }) : []; }
  function ctx(t, opts) {
    var w = t.ownerDocument.defaultView, c = centre(t);
    opts = opts || {};
    var ev = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: w, button: opts.kbd ? 0 : 2,
      clientX: opts.kbd ? 0 : c.x, clientY: opts.kbd ? 0 : c.y, shiftKey: !!opts.shift });
    var notPrevented = t.dispatchEvent(ev);
    return { prevented: !notPrevented, x: c.x, y: c.y };
  }
  function clickN(t, n) {
    var w = t.ownerDocument.defaultView, c = centre(t);
    t.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w, detail: n, clientX: c.x, clientY: c.y }));
    t.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true, cancelable: true, view: w, detail: n, clientX: c.x, clientY: c.y }));
    t.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w, detail: n, clientX: c.x, clientY: c.y }));
  }
  async function pick(m, act) {
    var n = m ? m.querySelector('.pnb-hm-item[data-act="' + act + '"]') : null;
    if (!n) return false;
    n.dispatchEvent(new n.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true, view: n.ownerDocument.defaultView }));
    await sleep(80);
    return true;
  }
  function key(t, k, extra) {
    var w = t.ownerDocument.defaultView;
    var o = { key: k, bubbles: true, cancelable: true, view: w };
    for (var p in (extra || {})) o[p] = extra[p];
    t.dispatchEvent(new w.KeyboardEvent('keydown', o));
  }
  function closeAll() { var m; while ((m = anyMenu())) { if (SH() && SH().rowMenu) SH().rowMenu.close(); else m.parentNode.removeChild(m); if (anyMenu() === m) m.parentNode.removeChild(m); } }

  async function phaseN(whereWant, tag) {
    var sumRow = rowItem('sum');
    if (!sumRow) { rec(tag + '0 the sum row exists', false, 'no sum row'); return; }
    reveal(sumRow);
    var ed = cm();
    var recipe = SH().realize(sumRow.getAttribute('data-text') || '');

    // N1
    ed.setValue('first line\nlast line');
    var r1 = ctx(sumRow), m1 = anyMenu();
    var mr = m1 ? m1.getBoundingClientRect() : null;
    var a1 = acts(m1);
    rec(tag + '1 a right-click on a row opens its menu at the pointer, in the ' + whereWant + ', with cursor/start/end/copy (+ help), browser menu suppressed',
        !!m1 && where(m1) === whereWant && r1.prevented && a1.slice(0, 4).join() === 'cursor,start,end,copy' && a1.indexOf('help') !== -1 &&
        Math.abs(mr.left - r1.x) <= 2 && Math.abs(mr.top - r1.y) <= 2 && m1.getAttribute('role') === 'menu',
        (m1 ? where(m1) + ' at ' + Math.round(mr.left) + ',' + Math.round(mr.top) + ' (pointer ' + r1.x + ',' + r1.y + ')' : 'no menu') +
        '; prevented ' + r1.prevented + '; items ' + labels(m1).join(' | '));

    // N2
    await pick(m1, 'start');
    var v2 = ed.getValue();
    rec(tag + '2 Insert at the beginning: the realized recipe on line 1, the old text a line down, no menu left',
        v2 === recipe + '\nfirst line\nlast line' && recipe !== (sumRow.getAttribute('data-text') || '') && !anyMenu(), JSON.stringify(v2) + ' recipe ' + recipe);

    // N3
    ed.setValue('first line\nlast line');
    ctx(sumRow);
    await pick(anyMenu(), 'end');
    var v3 = ed.getValue();
    ed.setValue('first line\n');
    ctx(sumRow);
    await pick(anyMenu(), 'end');
    var v3b = ed.getValue();
    rec(tag + '3 Append to the end: the recipe on a new last line (never welded on; an empty last line is used as is)',
        v3 === 'first line\nlast line\n' + recipe && v3b === 'first line\n' + recipe, JSON.stringify(v3) + ' | ' + JSON.stringify(v3b));

    // N4
    ed.setValue('alpha BETA gamma');
    ed.setSelection({ line: 0, ch: 6 }, { line: 0, ch: 10 });
    ctx(sumRow);
    var m4 = anyMenu(), l4 = labels(m4)[0];
    await pick(m4, 'cursor');
    var v4 = ed.getValue();
    rec(tag + '4 with a selection the first item reads Replace selection and replaces it', l4 === 'Replace selection' && v4 === 'alpha ' + recipe + ' gamma',
        'label ' + l4 + '; ' + JSON.stringify(v4));

    // N5 / N6
    closeAll();
    var plain = firstRow(false);
    var trayRow = firstRow(true);
    if (plain) { reveal(plain); clickN(plain, 1); }
    var m5 = anyMenu(), rr = plain ? plain.getBoundingClientRect() : null, mr5 = m5 ? m5.getBoundingClientRect() : null;
    rec(tag + '5 a click on a row with no tray opens its menu under the row',
        !!plain && !!m5 && Math.abs(mr5.top - rr.bottom) <= 2 && mr5.left > rr.left, plain ? (m5 ? 'menu top ' + Math.round(mr5.top) + ' row bottom ' + Math.round(rr.bottom) : 'NO menu') + ' (' + plain.textContent.trim() + ')' : 'no row without a tray');
    closeAll();
    var disc = trayRow ? trayRow.parentNode.querySelector('.snip-disc') : null;
    var before = disc ? disc.getAttribute('aria-expanded') : '';
    if (trayRow) { reveal(trayRow); clickN(trayRow, 1); }
    var after = disc ? disc.getAttribute('aria-expanded') : '';
    rec(tag + '6 a click on a row with a tray still toggles the tray and opens no menu', !!trayRow && before !== after && !anyMenu(),
        trayRow ? before + ' -> ' + after + ', menu ' + (anyMenu() ? 'OPEN' : 'none') : 'no row with a tray');
    if (disc && disc.getAttribute('aria-expanded') === 'true') disc.click();
    closeAll();

    // N7
    if (plain) {
      ed.setValue('x ');
      ed.setCursor({ line: 0, ch: 2 });
      var ptext = SH().realize(plain.getAttribute('data-text') || '');
      clickN(plain, 1);
      var opened7 = !!anyMenu();
      clickN(plain, 2);
      var w7 = plain.ownerDocument.defaultView;
      plain.dispatchEvent(new w7.MouseEvent('dblclick', { bubbles: true, cancelable: true, view: w7, detail: 2 }));
      await sleep(60);
      var v7 = ed.getValue();
      var count = v7.split(ptext).length - 1;
      rec(tag + '7 a double-click (its first click opens the menu) still inserts once at the cursor and leaves no menu',
          opened7 && count === 1 && !anyMenu(), 'opened ' + opened7 + ', ' + JSON.stringify(v7.slice(0, 80)) + ', menu ' + (anyMenu() ? 'OPEN' : 'none'));
    } else rec(tag + '7 double-click', false, 'no row without a tray');
    closeAll();

    // N8
    ed.setValue('first line');
    sumRow.focus();
    var r8 = ctx(sumRow, { kbd: true });
    var m8 = anyMenu(), doc8 = sumRow.ownerDocument;
    var f0 = m8 && doc8.activeElement ? doc8.activeElement.getAttribute('data-act') : '';
    if (m8) key(doc8.activeElement, 'ArrowDown');
    var f1 = doc8.activeElement ? doc8.activeElement.getAttribute('data-act') : '';
    // main.js's capture Escape asks the module first (handleSearchEscape)
    var owned = SH().handleSearchEscape();
    var back = doc8.activeElement === sumRow;
    var gone = !anyMenu();
    ctx(sumRow, { kbd: true });
    key(doc8.activeElement, 'ArrowDown');
    key(doc8.activeElement, 'Enter');
    await sleep(60);
    var v8 = ed.getValue();
    rec(tag + '8 keyboard: Shift+F10 opens it on the first item, ArrowDown moves, Escape (main.js path) closes with focus back on the row, Enter picks',
        !!m8 && r8.prevented && f0 === 'cursor' && f1 === 'start' && owned && back && gone && v8 === recipe + '\nfirst line',
        'focus ' + f0 + ' -> ' + f1 + '; esc owned ' + owned + ', back on row ' + back + ', closed ' + gone + '; ' + JSON.stringify(v8));
    closeAll();

    // N9
    await closeCard();
    ctx(sumRow);
    await pick(anyMenu(), 'help');
    await sleep(60);
    var i9 = popInfo();
    rec(tag + '9 How to use opens the row\'s card in the ' + whereWant + ' (its help and its link)',
        i9.open && i9.where === whereWant && i9.anchor === 'sum' && i9.text.length > 40, fmtPop(i9));
    await closeCard();

    // N10
    var copied = null, w10 = sumRow.ownerDocument.defaultView;
    try {
      Object.defineProperty(w10.navigator, 'clipboard', { configurable: true, value: { writeText: function (t) { copied = t; return Promise.resolve(); } } });
    } catch (e) { }
    var execd = null, keepExec = sumRow.ownerDocument.execCommand;
    sumRow.ownerDocument.execCommand = function (c) { if (c === 'copy') { var a = sumRow.ownerDocument.activeElement; execd = a && a.value; } return true; };
    ctx(sumRow);
    await pick(anyMenu(), 'copy');
    sumRow.ownerDocument.execCommand = keepExec;
    var got = copied !== null ? copied : execd;
    rec(tag + '10 Copy puts the realized recipe on the clipboard', got === recipe, JSON.stringify(got) + ' want ' + recipe);

    // N11
    var r11 = ctx(sumRow, { shift: true });
    rec(tag + '11 Shift+right-click keeps the browser\'s menu (nothing opened, nothing prevented)', !r11.prevented && !anyMenu(), 'prevented ' + r11.prevented);
    closeAll();

    // N12
    ctx(sumRow);
    var had = !!anyMenu();
    var bd = sumRow.ownerDocument.body, w12 = sumRow.ownerDocument.defaultView;
    bd.dispatchEvent(new w12.MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w12, clientX: 5, clientY: 5 }));
    rec(tag + '12 a mousedown outside closes it', had && !anyMenu(), 'opened ' + had + ', after ' + (anyMenu() ? 'OPEN' : 'closed'));
    closeAll();
  }

  async function pageMain() {
    stubHelp();
    await tab('report-options-tab');
    stubCols();
    await phaseN('tab', 'N');
    var e = await popOut();
    if (e) { rec('N13 pop out', false, e); }
    else {
      await tab('report-options-tab');
      var row = rowItem('sum');
      var ed = cm();
      ed.setValue('first line');
      var r = row ? ctx(row) : { prevented: false };
      var m = anyMenu();
      var ok = !!m && where(m) === 'console window' && r.prevented;
      await pick(m, 'start');
      var v = ed.getValue();
      rec('N13 popped out: a right-click opens the menu IN the console window, and its Insert at the beginning works',
          ok && v === SH().realize(row.getAttribute('data-text') || '') + '\nfirst line',
          (m ? where(m) : 'no menu') + '; prevented ' + r.prevented + '; ' + JSON.stringify(v));
      closeAll();
      await returnToTab();
    }
    var pe = errs();
    rec('N14 no page errors', pe.length === 0, pe.slice(0, 5).join(' | '));
  }

  setTimeout(function () {
    pageMain().then(function () { finish(); },
      function (e) { finish('driver threw: ' + String((e && e.stack) || e).slice(0, 600)); });
  }, 300);
})();
