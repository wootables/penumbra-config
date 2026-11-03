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
