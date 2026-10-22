// Pop-out tooltip hosting (2026-09-25). Drives the REAL main.js (ready closure
// unwrapped, window.__TTH export hook), the REAL jQuery UI 1.13.2 and the REAL
// penumbra_snippet_help.js - loaded through main.js's own lazy loader - and
// moves the console with the REAL "Open in Window" button into a real
// window.open() window, as production does.
//   S  the page booted: main.js ran to its end, the four console hosts exist
//   D  docked: every console tooltip opens in the tab (stock behaviour)
//   P  "Open in Window": the Custom Code Shortcuts and Functions helpers, a
//      function underline, the File Drop string() help, the cron help and a
//      title tooltip opened by keyboard focus all open IN THE CONSOLE WINDOW -
//      visible, aria-describedby resolving there, jQuery UI's live region with
//      them, flipped/fitted against the console window's own size - while a
//      report-side tooltip still opens in the tab
//   Q  a tooltip OPEN on the button that moves the console (hover on "Open in
//      Window", focus on "Return to Tab") is closed by the move - not left
//      behind in the window the console leaves, not stale on the button
//   R  Return to Tab: the same tooltips open in the tab again
//   (2026-10-22, fnpop) the Custom Code helpers and function underlines are no
//   longer jQuery UI tooltips: P1-P3, R2 and the ?mountpopped=1 page (M) moved
//   to the fnpop suite; real_input.py X2-X4/X7 now check their cards. Then the File Drop
//   string() help and the cron help (fnpop 2): P5, P6, D2, P8 to fnpop phase T; X5 a card.
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 900) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return (window.__errors || []).concat(window.__rejections || []); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 10),
      hookErr: [window.__TTH_ERR, window.__TTH_ERR2, (window.__TTH_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  var H = window.__TTH || {};

  function popWin() { var p = window._admPip; return (p && p.active && p.win && !p.win.closed) ? p.win : null; }
  // Wherever the element lives right now - the console moves between documents.
  function el(sel) {
    var n = document.querySelector(sel);
    var pw = popWin();
    if (!n && pw) n = pw.document.querySelector(sel);
    return n;
  }
  function inst(host) { return host ? $.data(host, 'ui-tooltip') : null; }

  // Open a tooltip the way a pointer does: a mouseover in the element's OWN
  // document. The console window forwards no hover events, so only widgets
  // bound on the moved nodes hear it - exactly as with a real pointer there.
  function hover(t) {
    var w = t.ownerDocument.defaultView, r = t.getBoundingClientRect();
    t.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: w,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }
  function unhover(t) {
    var w = t.ownerDocument.defaultView;
    t.dispatchEvent(new w.MouseEvent('mouseout', { bubbles: true, cancelable: true, view: w, relatedTarget: t.ownerDocument.body }));
  }
  // Keyboard focus the way the browser reports it: focus (jQuery 3.7 drives its
  // focusin handlers from a capturing focus listener on the document) and then
  // focusin (which the console window forwards to the tab's jQuery handlers).
  function focusLike(t) {
    var w = t.ownerDocument.defaultView;
    t.dispatchEvent(new w.FocusEvent('focus', { bubbles: false }));
    t.dispatchEvent(new w.FocusEvent('focusin', { bubbles: true }));
  }
  function blurLike(t) {
    var w = t.ownerDocument.defaultView;
    t.dispatchEvent(new w.FocusEvent('blur', { bubbles: false }));
    t.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  }

  function where(node) {
    if (!node) return 'none';
    if (node.ownerDocument === document) return 'tab';
    var pw = popWin();
    if (pw && node.ownerDocument === pw.document) return 'console window';
    return 'another document (' + (node.ownerDocument.defaultView ? 'open' : 'closed') + ')';
  }
  function read(t, host) {
    var id = $(t).data('ui-tooltip-id');
    var I = inst(host);
    var node = (id && I && I.tooltips && I.tooltips[id]) ? I.tooltips[id].tooltip[0] : null;
    var vw = node ? node.ownerDocument.defaultView : null;
    var r = node ? node.getBoundingClientRect() : null;
    var desc = String(t.getAttribute('aria-describedby') || '');
    return {
      id: id || '', node: node, where: where(node),
      descOk: !!id && desc.split(/\s+/).indexOf(id) !== -1 && t.ownerDocument.getElementById(id) === node,
      visible: !!(node && vw && node.isConnected && vw.getComputedStyle(node).display !== 'none' && r.width > 0 && r.height > 0),
      rect: r, viewW: vw ? vw.innerWidth : 0, viewH: vw ? vw.innerHeight : 0,
      position: (node && vw) ? vw.getComputedStyle(node).position : '',
      text: node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '',
      live: (I && I.liveRegion) ? I.liveRegion[0] : null
    };
  }
  // Could a real pointer be on this element? Laid out, inside its own window's
  // viewport, and the topmost thing at its centre. (A hidden target would let a
  // synthetic event "pass" for something no user can hover.)
  function blocker(t) {
    var r = t.getBoundingClientRect(), vw = t.ownerDocument.defaultView;
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!(r.width > 0 && r.height > 0)) return 'not laid out';
    if (!(x >= 0 && y >= 0 && x < vw.innerWidth && y < vw.innerHeight)) return 'outside the ' + vw.innerWidth + 'x' + vw.innerHeight + ' view at ' + Math.round(x) + ',' + Math.round(y);
    var top = t.ownerDocument.elementFromPoint(x, y);
    if (top && (top === t || t.contains(top))) return '';
    return 'covered at ' + Math.round(x) + ',' + Math.round(y) + ' by ' + (top ? top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (typeof top.className === 'string' && top.className ? '.' + top.className.trim().split(/\s+/).join('.') : '') : 'nothing');
  }
  function hittable(t) { return blocker(t) === ''; }
  // What a user does first: scroll the thing into view (the helper list and the
  // console window both scroll).
  function reveal(t) { try { t.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { } }
  function fmt(x) {
    if (x.missing) return 'target missing';
    var pre = x.hit === false ? 'TARGET NOT HITTABLE (' + x.why + '), ' : '';
    if (!x.node) return pre + 'no tooltip opened';
    return pre + x.where + (x.visible ? ', visible' : ', NOT visible') + (x.descOk ? ', described-by ok' : ', described-by BROKEN') +
      ', x ' + Math.round(x.rect.left) + '..' + Math.round(x.rect.right) + ' y ' + Math.round(x.rect.top) + '..' + Math.round(x.rect.bottom) +
      ' in a ' + x.viewW + 'x' + x.viewH + ' view, position:' + x.position + (x.closed ? ', closed after' : ', STILL OPEN after') +
      ', live region: ' + x.liveWhere + (x.liveHasText ? ' (has the text)' : ' (text missing)') + ', "' + x.text.slice(0, 40) + '"';
  }
  // Bring a console tab forward through the REAL tab strip (a click on its
  // anchor, in whichever window the console lives). Activating Custom Code is
  // what shows the helper panel and, the first time, loads + mounts it.
  async function tab(id) {
    var a = el('#editorTabs a[href="#' + id + '"]');
    if (!a) throw new Error('no tab anchor for #' + id);
    a.click();
    await sleep(150);
    if (id === 'report-options-tab') {
      for (var k = 0; k < 100; k++) {
        var ico = el('#snipHelperList .snip-ico[data-card]');
        var fn = el('#report-options-tab .CodeMirror .cm-function-underline[data-fn="sum"]');
        if (ico && fn && hittable(ico) && hittable(fn)) break;
        await sleep(50);
      }
    }
  }

  // Open, wait out the widget's show delay (100-600 ms), read, close.
  async function probe(t, host, how) {
    if (!t) return { node: null, where: 'none', missing: true };
    reveal(t);
    var why = blocker(t), hit = why === '';
    (how === 'focus' ? focusLike : hover)(t);
    var x = read(t, host);
    for (var k = 0; k < 40 && x.node && !x.visible; k++) { await sleep(50); x = read(t, host); }
    x.liveWhere = x.live ? where(x.live) : 'none';
    var liveText = x.live ? String(x.live.textContent || '').replace(/\s+/g, ' ').trim() : '';
    x.liveHasText = !!x.text && liveText.indexOf(x.text.slice(0, 30)) !== -1;
    (how === 'focus' ? blurLike : unhover)(t);
    await sleep(80);
    x.closed = !$(t).data('ui-tooltip-id');
    x.hit = hit;
    x.why = why;
    return x;
  }
  // A tooltip that opened where it should, for a target a pointer could reach.
  function okIn(x, w) { return x.hit && x.where === w && x.visible && x.descOk && x.closed; }

  // The console's tooltips: what each is opened on, the widget that owns it,
  // and the console tab that has to be in front for a pointer to reach it.
  function cases() {
    var cc = 'report-options-tab';
    return [
      // (2026-10-22, fnpop) the Custom Code helpers and the function underlines left jQuery UI:
      // their cards are a popover of the lazy module, suite fnpop. P1-P3 retired with them.
      { key: 'focus', id: 'P4', tab: cc, what: 'a console button\'s title tooltip opened by keyboard focus', t: function () { return el('#tthConsoleBtn'); }, host: document, how: 'focus' }
      // (2026-10-22, fnpop 2) the File Drop string() help and the cron help left jQuery UI too:
      // a hover card of main.js (_pnbHoverCard), suite fnpop phase T. P5, P6, D2, P8 retired.
    ];
  }
  async function probeCase(c) {
    await tab(c.tab);
    return probe(c.t(), c.host, c.how);
  }

  async function popOut() {
    var btn = el('#popOutWindowBtn');
    if (!btn) return 'no #popOutWindowBtn (main.js did not build the WINDOW TOOLS bar)';
    btn.click();
    for (var k = 0; k < 100 && !popWin(); k++) await sleep(50);
    if (!popWin()) return 'the console window never mounted (_admPip.active=' + (window._admPip && window._admPip.active) + ')';
    await sleep(250);   // _mountConsoleIn's own 80 / 120 ms settle timers
    return '';
  }
  async function returnToTab() {
    var btn = el('#popOutWindowBtn');
    if (!btn) return 'no #popOutWindowBtn';
    btn.click();   // it relabels itself "Return to Tab" while popped out
    for (var k = 0; k < 100 && window._admPip && window._admPip.active; k++) await sleep(50);
    if (window._admPip.active || !document.getElementById('admWrapper')) return 'the console did not come back to the tab';
    await sleep(250);
    return '';
  }
  function phaseS() {
    var ran = typeof window._pnbBodyFor === 'function' && !!window._admPip && !!document.getElementById('popOutWindowBtn');
    // (The Custom Code panel builds its widget when the tab first opens - D1 / M0.)
    // (#report-options-tab's widget is gone since 2026-10-22: its function cards are fnpop's.)
    var hosts = ['#tthFnEdge'].filter(function (s) { return !inst(el(s)); });
    if (!inst(document)) hosts.push('document');
    var patched = !!($.ui && $.ui.tooltip && $.ui.tooltip.prototype._pnbOwnDocument);
    rec('S1 main.js ran to its end (the pop-out engine and the WINDOW TOOLS bar exist) and every tooltip host carries its widget',
        ran && hosts.length === 0, (ran ? 'booted' : 'main.js did NOT run to the pop-out section') + '; missing widgets: ' + (hosts.join(',') || 'none') + '; build: ' + (patched ? 'with' : 'without') + ' per-open tooltip hosting');
  }

  async function phaseD() {
    var bad = [], det = [];
    for (var c of cases()) {
      var x = await probeCase(c);
      det.push(c.key + ': ' + fmt(x));
      if (!(okIn(x, 'tab') && x.liveWhere === 'tab')) bad.push(c.key);
    }
    rec('D1 docked: the console\'s focus tooltip opens in the tab - target hittable, visible, described-by resolving, live region there - and close (stock behaviour)',
        bad.length === 0, (bad.length ? 'BAD ' + bad.join(',') + ' | ' : '') + det.join(' | '));
  }

  async function phaseP() {
    var pw = popWin();
    rec('P0 "Open in Window" moved the console into a real window.open() window, narrower than the tab (so a wrong-window flip/fit shows)',
        !!(pw && pw.document.getElementById('admWrapper') && !document.getElementById('admWrapper') && pw.innerWidth + 300 <= window.innerWidth),
        'console window ' + (pw ? pw.innerWidth + 'x' + pw.innerHeight : '-') + ', tab ' + window.innerWidth + 'x' + window.innerHeight);
    for (var c of cases()) {
      var x = await probeCase(c);
      rec(c.id + ' popped out: ' + c.what + ' opens its tooltip IN THE CONSOLE WINDOW, visible, described-by resolving there, and closes',
          okIn(x, 'console window'), fmt(x));
      if (c.key === 'focus') {
        rec(c.id + 'L ...and jQuery UI\'s screen-reader live region moved to the console window with the tooltip\'s text (' + c.key + ')',
            x.liveWhere === 'console window' && x.liveHasText, 'live region: ' + x.liveWhere + (x.liveHasText ? ', has the text' : ', text missing'));
      }
    }
    await tab('report-options-tab');
    var edge = await probe(el('#tthFnEdge'), el('#tthFnEdge'));
    var inside = !!edge.node && edge.rect.left >= -0.5 && edge.rect.right <= edge.viewW + 0.5;
    rec('P7 popped out: a console tooltip at the console window\'s right edge flips/fits INSIDE that window (not against the wider tab)',
        okIn(edge, 'console window') && inside, fmt(edge) + '; tab is ' + window.innerWidth + ' wide');
    var fb = await probe(el('#tthReportBtn'), document, 'focus');
    rec('P9 popped out: a report-side title tooltip opened by focus still opens in the TAB, live region with it', okIn(fb, 'tab') && fb.liveWhere === 'tab', fmt(fb));
  }

  async function phaseR() {
    var bad = [], det = [];
    for (var c of cases()) {
      var x = await probeCase(c);
      det.push(c.key + ': ' + fmt(x));
      if (!okIn(x, 'tab')) bad.push(c.key);
    }
    rec('R1 back in the tab: the console\'s focus tooltip opens in the tab again - target hittable, visible, described-by resolving - and close',
        bad.length === 0, (bad.length ? 'BAD ' + bad.join(',') + ' | ' : '') + det.join(' | '));
  }

  // Open a tooltip and leave it open (the pointer / focus stays put).
  async function openOnly(t, host, how) {
    (how === 'focus' ? focusLike : hover)(t);
    var x = read(t, host);
    for (var k = 0; k < 40 && x.node && !x.visible; k++) { await sleep(50); x = read(t, host); }
    return x;
  }
  function shownIn(doc) {
    return Array.prototype.filter.call(doc.querySelectorAll('.ui-tooltip'), function (n) {
      var r = n.getBoundingClientRect();
      return n.ownerDocument.defaultView.getComputedStyle(n).display !== 'none' && r.width > 0;
    }).length;
  }

  // P7's target: a console tooltip hard against the right edge. Its widget is made here, DOCKED,
  // as main.js makes its own (the function underline it used to be left jQuery UI, fnpop).
  function edgeWidget() {
    $('#tthFnEdge').attr('title', 'An edge tooltip: long enough that a flip/fit against the wrong window would push it outside the console window.')
      .tooltip({ items: '#tthFnEdge', content: function () { return $(this).prop('title'); }, show: { delay: 100 } });
  }
  async function pageMain() {
    edgeWidget();
    phaseS();
    await tab('report-options-tab');   // first reveal: loads + mounts the Custom Code panel, docked
    await phaseD();
    // Q1: the pointer rests on "Open in Window" long enough for its tooltip, then clicks.
    var btn = el('#popOutWindowBtn');
    var bo = await openOnly(btn, document);
    var e = await popOut();
    if (e) { rec('P0 "Open in Window" moved the console into a real window.open() window', false, e); return; }
    var left = shownIn(document);
    rec('Q1 the "Open in Window" button\'s own tooltip, open as it is clicked, is closed - not left behind in the tab',
        bo.visible && bo.where === 'tab' && left === 0 && !$(btn).data('ui-tooltip-open'),
        'open before the click: ' + (bo.visible ? 'yes (' + bo.where + ')' : 'NO') + '; tooltips still shown in the tab: ' + left + '; button still "open": ' + !!$(btn).data('ui-tooltip-open'));
    await phaseP();
    // Q2: "Return to Tab" takes keyboard focus on mousedown (its focus tooltip opens), then clicks.
    var rb = el('#popOutWindowBtn');
    var ro = await openOnly(rb, document, 'focus');
    e = await returnToTab();
    if (e) { rec('R0 Return to Tab', false, e); return; }
    var stale = !!$(rb).data('ui-tooltip-id');
    var rx = await probe(rb, document);
    rec('Q2 the Return to Tab button\'s focus tooltip, open as it is clicked, closes with the move - its next hover in the tab opens normally',
        ro.visible && ro.where === 'console window' && !stale && okIn(rx, 'tab'),
        'open before the click: ' + (ro.visible ? 'yes (' + ro.where + ')' : 'NO') + '; stale tooltip state after the move: ' + stale + '; next hover: ' + fmt(rx));
    await phaseR();
  }

  // ?real=1: real_input.py drives the page over CDP with REAL pointer input in
  // both windows and only reads state through these.
  if (window.__REAL) {
    window.__drv = {
      tab: function (id) { return tab(id).then(function () { return true; }); },
      popped: function () { return !!popWin(); },
      // Centre of an element in ITS OWN window's viewport, and which window that is.
      center: function (sel) {
        var n = el(sel); if (!n) return null;
        reveal(n);
        var r = n.getBoundingClientRect(), vw = n.ownerDocument.defaultView;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), where: where(n), viewW: vw.innerWidth, viewH: vw.innerHeight };
      },
      tip: function (sel, hostSel) {
        var t = el(sel); if (!t) return { missing: true };
        var x = read(t, hostSel === 'document' ? document : el(hostSel));
        return { where: x.where, visible: x.visible, descOk: x.descOk, text: x.text.slice(0, 60),
                 rect: x.rect ? [x.rect.left, x.rect.top, x.rect.right, x.rect.bottom].map(Math.round) : null,
                 view: [x.viewW, x.viewH], live: x.live ? where(x.live) : 'none' };
      },
      tabTooltips: function () { return document.querySelectorAll('.ui-tooltip').length; },
      // The function-card popover (fnpop): where it is, open, inside its window's view.
      card: function (popSel) {
        var n = el(popSel || '#snipCardPop'); if (!n) return { missing: true };
        var r = n.getBoundingClientRect(), vw = n.ownerDocument.defaultView;
        var a = n.querySelector('a[data-help-anchor]');
        return { where: where(n), open: n.classList.contains('open'), visible: n.classList.contains('open') && r.width > 0 && vw.getComputedStyle(n).visibility === 'visible',
                 inside: r.left >= 0 && r.top >= 0 && r.right <= vw.innerWidth && r.bottom <= vw.innerHeight,
                 anchor: a ? a.getAttribute('data-help-anchor') : '', text: String(n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
                 rect: [r.left, r.top, r.right, r.bottom].map(Math.round), view: [vw.innerWidth, vw.innerHeight] };
      },
      errors: errs
    };
    document.getElementById('out').textContent = 'READY';
    return;
  }

  setTimeout(function () {
    pageMain().then(function () { finish(); },
      function (e) { finish('driver threw: ' + String((e && e.stack) || e).slice(0, 600)); });
  }, 300);
})();
