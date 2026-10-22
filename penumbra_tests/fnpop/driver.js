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
  function panelIco(group, nth) {
    var list = Array.prototype.slice.call((el('#snipHelperList') || document).querySelectorAll('.snip-group[data-group="' + group + '"] .snip-ico[data-card]'));
    return list[nth || 0] || null;
  }
  function fnRowIco(label) {
    var rows = (el('#snipHelperList') || document).querySelectorAll('.snip-group[data-group="functions"] .snip-row:not(.snip-variant-row) > .snip-item');
    for (var i = 0; i < rows.length; i++) {
      var lab = rows[i].querySelector('.snip-label');
      if (lab && lab.textContent === label) return rows[i].querySelector('.snip-ico');
    }
    return null;
  }

  // ---------------------------------------------------------------- L / S
  function phaseL0() {
    var scripts = Array.prototype.filter.call(document.scripts, function (s) { return /penumbra_snippet_help\.js/.test(s.src); }).length;
    rec('L1 before the Custom Code tab opens: the module is not loaded (no script, no PenumbraSnippetHelp, no card popover)',
        !SH() && scripts === 0 && !document.getElementById('snipCardPop'),
        'PenumbraSnippetHelp ' + (SH() ? 'DEFINED' : 'absent') + ', script tags ' + scripts + ', popover ' + (document.getElementById('snipCardPop') ? 'PRESENT' : 'absent'));
  }
  function phaseS() {
    var titled = (el('#snipHelperList') || document).querySelectorAll('.snip-ico[title]').length;
    var cards = (el('#snipHelperList') || document).querySelectorAll('.snip-ico[data-card]').length;
    var w1 = $.data(el('#report-options-tab'), 'ui-tooltip'), w2 = $.data(el('#snippetHelperPanel'), 'ui-tooltip');
    rec('S1 the jQuery UI tooltips are gone: no widget on the Custom Code tab or the panel, no help HTML in a title attribute, every helpful icon carries data-card',
        !w1 && !w2 && titled === 0 && cards > 40,
        'tab widget ' + (w1 ? 'PRESENT' : 'none') + ', panel widget ' + (w2 ? 'PRESENT' : 'none') + ', icons with title ' + titled + ', icons with data-card ' + cards);
  }

  // ---------------------------------------------------------------- E
  async function phaseE() {
    stubHelp();
    var s = fnSpan('sum');
    var opened = await openOn(s);
    var i = popInfo();
    var sr = s.getBoundingClientRect();
    rec('E1 hovering sum( in the editor opens its card: the registry signature, a link to sum() in the Custom Code help',
        opened && i.where === 'tab' && /sum\(COLUMN, CONDITION\?, SCOPE\?\)/.test(i.text) && i.anchor === 'sum' && i.link === 'sum() in the Custom Code help',
        fmtPop(i));
    rec('E2 ...placed under the name (or above it when there is no room below), inside the window',
        opened && i.inside && (i.rect.top >= sr.bottom - 0.5 || i.rect.bottom <= sr.top + 0.5) && (Math.abs(i.rect.left - sr.left) < 4 || i.rect.right >= i.viewW - 9),
        'name at x ' + Math.round(sr.left) + ' y ' + Math.round(sr.top) + '..' + Math.round(sr.bottom) + '; ' + fmtPop(i));
    // onto the card: still open; then away from both: closed
    var pc = centre(pop());
    moveAt(document, pc.x, pc.y, pop());
    await sleep(450);
    var stay = isOpen();
    moveAt(document, 5, window.innerHeight - 5);
    var gone = await waitClosed(800);
    rec('E3 the card stays open while the pointer travels onto it, and closes once the pointer leaves both',
        stay && gone, 'on the card after 450 ms: ' + (stay ? 'open' : 'CLOSED') + '; after leaving: ' + (gone ? 'closed' : 'STILL OPEN'));

    // a long card scrolls inside the popover
    var hm = fnSpan('heatmap');
    var o2 = await openOn(hm);
    var j = popInfo();
    var p = pop();
    if (p) p.scrollTop = 120;
    var scrolled = p ? p.scrollTop : 0;
    rec('E4 a long card (heatmap) is capped to the window (max 480px) and scrolls inside the popover',
        o2 && j.overflowY === 'auto' && j.maxH > 0 && j.maxH <= 480 && j.maxH <= j.viewH - 16 && j.scrollH > j.clientH && scrolled > 0 && j.inside,
        'max-height ' + j.maxH + ', overflow-y ' + j.overflowY + ', scroll ' + j.scrollH + ' > client ' + j.clientH + ', scrolled to ' + scrolled + '; ' + fmtPop(j));
    await closeCard();

    // typing closes at once; text sliding under a resting pointer does not reopen
    s = fnSpan('sum');
    await openOn(s);
    var was = isOpen();
    var c = { x: last.x, y: last.y };                   // where the pointer rests
    var ed = cm();
    ed.replaceRange(' ', { line: 0, ch: 0 });          // the name moves one place right under the pointer
    var closedNow = !isOpen();
    await sleep(1200);                                   // main.js re-underlines and re-renders meanwhile
    var s2 = fnSpan('sum');
    var c2 = centre(s2);
    moveAt(document, c.x, c.y, s2);                      // same coordinates: the layout moved, not the mouse
    await sleep(700);
    var stayedShut = !isOpen();
    moveAt(document, c2.x + 1, c2.y, s2);                // a real move
    await sleep(30);
    moveAt(document, c2.x + 2, c2.y, s2);
    var reopened = await waitOpen(1500);
    rec('E5 typing closes the card at once; the text sliding under a resting pointer does not reopen it; a real move does',
        was && closedNow && stayedShut && reopened,
        'open before: ' + was + '; closed on the keystroke: ' + closedNow + '; shut after a same-place move: ' + stayedShut + '; reopened on a real move: ' + reopened);

    // the stuck tooltip: its name redrawn away without a mouseleave
    // (the pointer stays where the name was: the old tooltip waited there forever)
    var openBefore6 = isOpen();
    var s3 = fnSpan('sum');
    var c3 = centre(s3);
    s3.parentNode.removeChild(s3);                        // what a redraw does to the hovered span
    moveAt(document, c3.x + 1, c3.y);
    var unstuck = await waitClosed(800);
    rec('E6 a card whose name is redrawn away under it closes on the next pointer move (it no longer waits for a mouseleave that never comes)',
        openBefore6 && unstuck, 'open before: ' + openBefore6 + '; after the span was removed and the pointer moved: ' + (unstuck ? 'closed' : 'STILL OPEN'));
    ed.setValue(ed.getValue());                           // let main.js underline again
    await sleep(1200);

    // Escape: the card, and nothing else
    await openOn(fnSpan('sum'));
    var before = isOpen();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    await sleep(80);
    var consoleUp = !!el('#admWrapper') && $(el('#admWrapper')).is(':visible');
    rec('E7 Escape closes an open card and leaves the console open',
        before && !isOpen() && consoleUp, 'open before: ' + before + '; after Escape: ' + (isOpen() ? 'OPEN' : 'closed') + '; console ' + (consoleUp ? 'open' : 'CLOSED'));

    // the link
    await openOn(fnSpan('sum'));
    helpCalls = [];
    var a = pop() && pop().querySelector('a[data-help-anchor]');
    if (a) a.click();
    await sleep(60);
    rec('E8 the card\'s link opens the Help Center at the function\'s entry (optionsHelpLightbox#sum) and closes the card',
        helpCalls.length === 1 && helpCalls[0][0] === 'optionsHelpLightbox' && helpCalls[0][1] === 'sum' && !isOpen(),
        JSON.stringify(helpCalls) + '; card ' + (isOpen() ? 'OPEN' : 'closed'));

    // action( resolves its type
    var ac = fnSpan('action:search');
    var o3 = await openOn(ac);
    var k = popInfo();
    rec('E9 action(search, ...) in the editor opens the action(search) card, linked to the action entry',
        o3 && /action\(search, LABEL, VALUE\)/.test(k.text) && k.anchor === 'action' && k.link === 'action(search) in the Custom Code help',
        fmtPop(k));
    await closeCard();
  }

  // ---------------------------------------------------------------- K
  function phaseK() {
    var names = (window.PENUMBRA_SNIPPET_FN_NAMES || []).filter(function (n) { return n !== 'action'; })
      .concat((window.PENUMBRA_ACTION_TYPES || []).map(function (t) { return 'action:' + t; })).concat(['action']);
    var anchors = window.__ANCHORS || [];
    var bad = [], dark = [];
    names.forEach(function (n) {
      var h = SH().cardFor(n) || '';
      var m = /data-help-anchor='([^']+)'/.exec(h);
      if (!h || !m || anchors.indexOf(m[1]) === -1) bad.push(n + (h ? (m ? '->' + m[1] + ' (no such heading)' : ' (no link)') : ' (no card)'));
      if (/#ffa657|#6cb6ff|#7ee787|color:#(bbb|ccc|999|aaa)\b|rgba\(255,255,255/i.test(h)) dark.push(n);
    });
    rec('K1 every editor function and action type has a card whose link lands on a heading of the generated Custom Code topic (' + names.length + ' keys, ' + anchors.length + ' headings)',
        names.length > 40 && anchors.length > 30 && bad.length === 0, bad.length ? 'BAD ' + bad.join(', ') : 'all linked');
    var spot = { 'action:feedback': 'action_feedback', abs: 'mathhelpers', mod: 'mathhelpers', 'action:trigger': 'action', date_format: 'date_format' };
    var sbad = Object.keys(spot).filter(function (n) { return (SH().cardFor(n) || '').indexOf("data-help-anchor='" + spot[n] + "'") === -1; });
    rec('K2 the special anchors: action(feedback) -> action_feedback, abs/mod -> mathhelpers, the other action types -> action',
        sbad.length === 0, sbad.length ? 'BAD ' + sbad.join(', ') : 'ok');
    rec('K3 no card keeps the dark tooltip\'s fixed colours (orange / blue / grey text on a dark box)', dark.length === 0, dark.length ? 'still dark: ' + dark.join(', ') : 'theme tokens only');
  }

  // ---------------------------------------------------------------- P
  async function phaseP(whereWant, tag) {
    var ico = fnRowIco('sum');
    var o = await openOn(ico);
    var i = popInfo();
    var ir = ico ? ico.getBoundingClientRect() : { right: 0, left: 0 };
    rec(tag + '1 the panel\'s sum row icon opens its card in the ' + whereWant + ', beside the panel, linked to sum()',
        o && i.where === whereWant && i.anchor === 'sum' && i.inside && (i.rect.left >= ir.right - 0.5 || i.rect.right <= ir.left + 0.5),
        'icon ' + (ico ? 'x ' + Math.round(ir.left) + '..' + Math.round(ir.right) : 'MISSING') + '; ' + fmtPop(i));
    await closeCard();
    var sc = panelIco('shortcuts', 0);
    var o2 = await openOn(sc);
    var j = popInfo();
    rec(tag + '2 a Shortcut helper\'s icon opens its card in the ' + whereWant, o2 && j.where === whereWant && j.text.length > 20, fmtPop(j));
    await closeCard();
  }

  // ---------------------------------------------------------------- C
  var COLS = ['ID', 'AWARD_AMT', 'START_DT', 'DEPT_NAME', 'STATUS_CD', 'NOTES'];
  var KINDS = {
    ID: { num: true, date: false, samples: ['1', '2'] },
    AWARD_AMT: { num: true, date: false, samples: ['1200', '50'] },
    START_DT: { num: false, date: true, samples: ['01-JAN-24'] },
    DEPT_NAME: { num: false, date: false, samples: ['Chemistry'] },
    STATUS_CD: { num: false, date: false, samples: ['Active, pending'] },
    NOTES: { num: false, date: false, samples: ['Text'] }
  };
  function stubCols(cols) {
    window.Penumbra.getActiveColumnList = function () { return cols; };
    window.Penumbra.colKinds = function (c) { return KINDS[String(c).toUpperCase()] || null; };
  }
  async function phaseC() {
    var keepCols = window.Penumbra.getActiveColumnList, keepKinds = window.Penumbra.colKinds;
    var bridge = typeof keepKinds === 'function';
    rec('C0 main.js exposes the column kinds to the module (window.Penumbra.colKinds)', bridge, bridge ? 'present' : 'MISSING');
    stubCols(COLS);
    var rz = SH().realize;
    var cases = [
      ['sum(AMOUNT)', 'sum(AWARD_AMT)'],
      ['count(STATUS = Active)', 'count(DEPT_NAME = Chemistry)'],
      ["sum(AMOUNT, DEPT='IT')", "sum(AWARD_AMT, DEPT_NAME='Chemistry')"],
      ["action(trigger, 'P', 'pivot|DEPT|FY|AMOUNT|sum')", "action(trigger, 'P', 'pivot|DEPT_NAME|STATUS_CD|AWARD_AMT|sum')"],
      ["date_format(COLUMN, 'MM/DD/YYYY')", "date_format(START_DT, 'MM/DD/YYYY')"],
      ['sparkline_cell(TARGET_COLUMN, COL1|COL2|COL3)', 'sparkline_cell(TARGET_COLUMN, AWARD_AMT|ID|COL3)'],
      ['count(ID = 5)', 'count(ID = 5)'],
      ['progress_bar(VALUE, MAX)', 'progress_bar(VALUE, MAX)'],
      ['median(COLUMN)', 'median(AWARD_AMT)'],
      ['sum(COLUMN, CONDITION?, all?)', 'sum(AWARD_AMT)'],
      ['data(TYPE?)', 'data()'],
      ['date_format(SUBJECT, FORMAT?, OFFSET...?)', 'date_format(SUBJECT)'],
      ["action(feedback, 'Something look wrong?')", "action(feedback, 'Something look wrong?')"]
    ];
    var bad = cases.filter(function (c) { return rz(c[0]) !== c[1]; }).map(function (c) { return c[0] + ' -> ' + rz(c[0]) + ' (want ' + c[1] + ')'; });
    rec('C1 a recipe\'s placeholders become this report\'s columns by kind (number / date / text, by the call around COLUMN), a condition takes a real value, distinct placeholders take distinct columns',
        bad.length === 0, bad.length ? bad.join(' | ') : cases.length + ' cases');
    // a sample that cannot sit unquoted keeps the placeholder value; no other text column left -> placeholder stays
    stubCols(['AWARD_AMT', 'STATUS_CD']);
    var v1 = rz('count(STATUS = Active)');
    var v2 = rz('count(DEPT = X) and count(STATUS = Y)');
    rec('C2 a sample with a comma is not dropped into a condition; a placeholder with no fitting column left stays as written',
        v1 === 'count(STATUS_CD = Active)' && v2 === 'count(STATUS_CD = X) and count(STATUS = Y)', v1 + ' | ' + v2);
    stubCols([]);
    var v3 = rz('sum(AMOUNT)');
    window.Penumbra.colKinds = undefined; stubCols.call(null, COLS); window.Penumbra.colKinds = undefined;
    var v4 = rz('sum(AMOUNT)');
    rec('C3 with no report (no columns) or no column kinds the recipe is left exactly as written', v3 === 'sum(AMOUNT)' && v4 === 'sum(AMOUNT)', v3 + ' | ' + v4);

    stubCols(COLS);
    var ed = cm();
    // double-click a panel row: the inserted text uses real columns, the row keeps its shape
    var row = fnRowIco('sum').closest('.snip-item');
    var shape = row.getAttribute('data-text');
    ed.setValue('\n');
    ed.setCursor({ line: 1, ch: 0 });
    $(row).trigger('dblclick');
    var got = ed.getValue();
    rec('C4 double-clicking the sum row inserts a working call (a real number column, no optional placeholders); the row still shows the shape',
        /^\s*sum\(AWARD_AMT\)\s*$/.test(got) && /\bAMOUNT\b|COLUMN/.test(shape), 'row: ' + shape + ' | inserted: ' + got.replace(/\n/g, '\\n'));
    // drag: the payload
    var dt = null, payload = '';
    try {
      dt = new DataTransfer();
      row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      payload = dt.getData('text/plain');
      row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    } catch (e) { payload = 'threw ' + e; }
    rec('C5 dragging the sum row carries the working call in its payload', payload === 'sum(AWARD_AMT)', payload);
    // Ctrl+Space: the menu's insert text, display unchanged
    ed.setValue('su');
    ed.setCursor({ line: 0, ch: 2 });
    var h = SH().hint(ed);
    var it = h && h.list ? h.list.filter(function (x) { return /^sum\(/.test(String(x.text)); })[0] : null;
    rec('C6 the Ctrl+Space menu inserts sum with the real column; its label is unchanged',
        !!it && it.text === 'sum(AWARD_AMT)' && !/AWARD_AMT/.test(String(it.displayText)), it ? it.displayText + ' -> ' + it.text : 'no sum( item in ' + (h && h.list ? h.list.length : 0));
    ed.setValue($('#reportSnippet').val() || 'Total sum(AMOUNT)');
    await sleep(300);
    window.Penumbra.getActiveColumnList = keepCols; window.Penumbra.colKinds = keepKinds;
  }

  // ---------------------------------------------------------------- W / M
  async function phaseW() {
    var e = await popOut();
    if (e) { rec('W0 Open in Window', false, e); return; }
    await tab('report-options-tab');
    stubHelp();
    var s = fnSpan('sum');
    var o = await openOn(s);
    var i = popInfo();
    rec('W1 popped out: hovering sum( in the editor opens the card IN THE CONSOLE WINDOW, inside its view',
        o && i.where === 'console window' && i.inside && i.anchor === 'sum', 'name in the ' + where(s) + '; ' + fmtPop(i));
    helpCalls = [];
    var a = pop() && pop().querySelector('a[data-help-anchor]');
    if (a) a.click();
    await sleep(60);
    rec('W2 popped out: the card\'s link still opens the help at sum', helpCalls.length === 1 && helpCalls[0][1] === 'sum', JSON.stringify(helpCalls));
    await phaseP('console window', 'W3.');
    e = await returnToTab();
    if (e) { rec('W4 Return to Tab', false, e); return; }
    await tab('report-options-tab');
    var o2 = await openOn(fnSpan('sum'));
    var j = popInfo();
    rec('W4 back in the tab: the card opens in the tab again', o2 && j.where === 'tab' && j.inside, fmtPop(j));
    await closeCard();
  }

  // ---------------------------------------------------------------- T (fnpop 2)
  // The cron help and the template string() help: main.js's _pnbHoverCard (#pnbHoverCard).
  function hc() { return el('#pnbHoverCard'); }
  function hcOpen() { var p = hc(); return !!(p && p.classList.contains('open')); }
  async function hcWait(want, ms) { for (var k = 0; k < (ms || 1000) / 50; k++) { if (hcOpen() === want) return true; await sleep(50); } return hcOpen() === want; }
  function enter(t) {
    var w = t.ownerDocument.defaultView, c = centre(t);
    t.dispatchEvent(new w.MouseEvent('mouseenter', { bubbles: false, view: w, clientX: c.x, clientY: c.y }));
    moveAt(t.ownerDocument, c.x, c.y, t);
  }
  function leave(t, x, y) {
    var w = t.ownerDocument.defaultView;
    t.dispatchEvent(new w.MouseEvent('mouseleave', { bubbles: false, view: w, relatedTarget: t.ownerDocument.body }));
    moveAt(t.ownerDocument, x, y);
  }
  function hcInfo() {
    var p = hc();
    if (!p) return { exists: false };
    var r = p.getBoundingClientRect(), vw = p.ownerDocument.defaultView, a = p.querySelector('a[data-help-anchor]');
    return { exists: true, open: p.classList.contains('open'), where: where(p), rect: r, viewW: vw.innerWidth, viewH: vw.innerHeight,
      inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= vw.innerWidth + 0.5 && r.bottom <= vw.innerHeight + 0.5,
      text: String(p.textContent || '').replace(/\s+/g, ' ').trim(), topic: a ? a.getAttribute('data-help-topic') : '',
      anchor: a ? a.getAttribute('data-help-anchor') : '', link: a ? String(a.textContent || '').trim() : '',
      overflowY: vw.getComputedStyle(p).overflowY, maxH: parseFloat(p.style.maxHeight) || 0,
      dark: /#ffa657|#6cb6ff|color:#(bbb|999|aaa)\b|rgba\(255,255,255/i.test(p.innerHTML) };
  }
  function fmtHc(i) {
    if (!i.exists) return 'no hover card element';
    return (i.open ? 'open' : 'CLOSED') + ' in the ' + i.where + ', x ' + Math.round(i.rect.left) + '..' + Math.round(i.rect.right) + ' y ' + Math.round(i.rect.top) + '..' + Math.round(i.rect.bottom) +
      ' in ' + i.viewW + 'x' + i.viewH + (i.inside ? '' : ' (OUTSIDE)') + ', link "' + i.link + '" -> ' + i.topic + '#' + i.anchor + ', "' + i.text.slice(0, 50) + '"';
  }
  async function hcOpenOn(t) { if (!t) return false; reveal(t); enter(t); return hcWait(true, 1200); }
  // Away from the card, in the card's OWN document (that is where its watcher listens).
  async function hcClose() { if (hcOpen()) { moveAt(hc().ownerDocument, 3, 3); await hcWait(false, 800); } }
  async function phaseT() {
    var ids = ['#cronExprHelp', '#schedDropTplStringHelp', '#templateStringHelp'];
    var widgets = ids.filter(function (s) { var n = el(s); return !n || $.data(n, 'ui-tooltip') || n.hasAttribute('title'); });
    rec('T1 the cron and template string() helps carry no jQuery UI tooltip (no widget, no HTML title)', widgets.length === 0, widgets.join(', ') || 'none');
    stubHelp();
    await tab('scheduler-tab');
    var cron = el('#cronExprHelp');
    // (fnpop 3) on index.php's real Scheduler tab the cron row sits in the event form, hidden
    // until an event is open: show it (and the File Drop row below), as a user would see it.
    var showCron = unhide(cron);
    rec('T0 the cron help is laid out for the hover tests (its event form shown)', blocker(cron) === '' || /covered/.test(blocker(cron)), blocker(cron) || 'visible');
    var o = await hcOpenOn(cron);
    var i = hcInfo(), cr = cron.getBoundingClientRect();
    rec('T2 hovering the cron help opens its card under it, inside the window: the field diagram, linked to Cron expressions in the Scheduler help, described-by wired, theme colours only',
        o && i.where === 'tab' && i.inside && /day of week \(0-7, Sunday = 0 or 7\)/.test(i.text) && i.topic === 'schedulerHelpLightbox' && i.anchor === 'schedHelp-cron' &&
        cron.getAttribute('aria-describedby') === 'pnbHoverCard' && cr.height > 0 && (i.rect.top >= cr.bottom - 0.5 || i.rect.bottom <= cr.top + 0.5) && !i.dark,
        fmtHc(i) + '; described-by ' + cron.getAttribute('aria-describedby'));
    var pc = centre(hc());
    leave(cron, pc.x, pc.y);
    moveAt(hc().ownerDocument, pc.x, pc.y, hc());
    await sleep(450);
    var stay = hcOpen();
    moveAt(document, 5, window.innerHeight - 5);
    var gone = await hcWait(false, 800);
    rec('T3 the card stays open on the way onto it and closes once the pointer leaves both', stay && gone, 'on it: ' + (stay ? 'open' : 'CLOSED') + '; away: ' + (gone ? 'closed' : 'STILL OPEN'));
    await hcOpenOn(cron);
    var before = hcOpen();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    await sleep(80);
    var up = !!el('#admWrapper') && $(el('#admWrapper')).is(':visible');
    rec('T4 Escape closes the card and leaves the console open', before && !hcOpen() && up, 'open before: ' + before + '; after: ' + (hcOpen() ? 'OPEN' : 'closed') + '; console ' + (up ? 'open' : 'CLOSED'));
    // (fnpop 4) the cron help is a ? icon beside "Schedule:", like the tab's other ? icons
    var dotted = schedRoot() ? schedRoot().querySelectorAll('.cron-help-trigger').length : -1;
    rec('T12 the cron help is a ? icon after "Schedule:" (its click opens Cron Expressions), not a dotted label',
        cron.classList.contains('tab-help-icon') && cron.textContent === '?' && cron.getAttribute('data-target') === '#schedulerHelpLightbox' &&
        cron.getAttribute('data-jump-to') === 'schedHelp-cron' && /cron/i.test(cron.getAttribute('aria-label') || '') && dotted === 0 &&
        /Schedule:/.test(cron.parentNode.textContent),
        'class "' + cron.className + '", text "' + cron.textContent + '", target ' + cron.getAttribute('data-target') + '#' + cron.getAttribute('data-jump-to') + ', aria-label "' + cron.getAttribute('aria-label') + '", dotted triggers left ' + dotted);
    var tabIdx = cron.getAttribute('tabindex');
    var preActive = cron.ownerDocument.activeElement, preFlag = !!cron._pnbHcClicked;
    cron.focus();
    var gotFocus = cron.ownerDocument.activeElement === cron;
    var byFocus = await hcWait(true, 600);
    cron.blur();
    var closedOnBlur = await hcWait(false, 800);
    rec('T5 keyboard: the trigger takes focus (tabindex 0), focus opens the card and blur closes it', tabIdx === '0' && byFocus && closedOnBlur, 'tabindex ' + tabIdx + '; active before: ' + (preActive ? preActive.tagName + '#' + preActive.id : '-') + '; click flag before: ' + preFlag + '; focused: ' + gotFocus + '; opened on focus: ' + byFocus + '; closed on blur: ' + closedOnBlur);
    // the trigger vanishing under the card (its tab or dialog closes): the next move closes it
    await hcOpenOn(cron);
    var openV = hcOpen();
    var sqlA = el('#editorTabs a[href="#sql-editor-tab"]');
    if (sqlA) sqlA.click();
    await sleep(150);
    moveAt(document, cr.left + 2, cr.top + 2);
    var vanished = await hcWait(false, 800);
    rec('T6 a card whose trigger is hidden under it closes on the next pointer move', openV && vanished, 'open before: ' + openV + '; after the tab switch and a move: ' + (vanished ? 'closed' : 'STILL OPEN'));
    await tab('scheduler-tab');
    showCron = unhide(cron);
    var fd = el('#schedDropTplStringHelp');
    var showFd = unhide(fd);
    var o2 = await hcOpenOn(fd);
    var j = hcInfo();
    rec('T7 the File Drop string() help opens the template card (padend included, regex and calc), capped and scrolling, linked to Custom Template in the Scheduler help',
        o2 && /padend/.test(j.text) && /regex_replace/.test(j.text) && /calc\(/.test(j.text) && j.topic === 'schedulerHelpLightbox' && j.anchor === 'schedHelp-template' &&
        j.overflowY === 'auto' && j.maxH > 0 && j.maxH <= 480 && j.inside && !j.dark, fmtHc(j));
    await hcClose();
    var cp = el('#templateStringHelp');
    var o3 = await hcOpenOn(cp);
    var k = hcInfo();
    helpCalls = [];
    var a = hc() && hc().querySelector('a[data-help-anchor]');
    if (a) a.click();
    await sleep(60);
    rec('T8 the copy dialog\'s string() help links to Custom templates in the Copy help, and the link opens it and closes the card',
        o3 && k.topic === 'copyHelpLightbox' && k.anchor === 'copy-template' && helpCalls.length === 1 && helpCalls[0][0] === 'copyHelpLightbox' && helpCalls[0][1] === 'copy-template' && !hcOpen(),
        fmtHc(k) + '; calls ' + JSON.stringify(helpCalls));
    // popped out
    showFd(); showCron();
    var e = await popOut();
    if (e) { rec('T9 Open in Window', false, e); return; }
    await tab('scheduler-tab');
    var cron2 = el('#cronExprHelp');
    var showCron2 = unhide(cron2);
    var shut = !hcOpen();
    var o4 = await hcOpenOn(cron2);
    var m = hcInfo();
    rec('T9 popped out: the cron card opens IN THE CONSOLE WINDOW, inside its view', shut && o4 && where(cron2) === 'console window' && m.where === 'console window' && m.inside && m.anchor === 'schedHelp-cron', 'trigger in the ' + where(cron2) + '; ' + fmtHc(m));
    await hcClose();
    var shut2 = !hcOpen();
    var o5 = await hcOpenOn(el('#templateStringHelp'));
    var n2 = hcInfo();
    rec('T10 popped out: the report-side copy string() card still opens in the TAB', shut2 && o5 && n2.where === 'tab' && n2.inside && n2.anchor === 'copy-template', fmtHc(n2));
    await hcClose();
    var shut3 = !hcOpen();
    e = await returnToTab();
    if (e) { rec('T11 Return to Tab', false, e); return; }
    showCron2();
    await tab('scheduler-tab');
    var showCron3 = unhide(el('#cronExprHelp'));
    var o6 = shut3 && await hcOpenOn(el('#cronExprHelp'));
    var q = hcInfo();
    rec('T11 back in the tab: the cron card opens in the tab again', o6 && q.where === 'tab' && q.anchor === 'schedHelp-cron', fmtHc(q));
    await hcClose();
    showCron3();
  }

  // ---------------------------------------------------------------- U (fnpop 3)
  // Every Scheduler tip: the REAL #scheduler-tab of index.php (run.ps1 lifts it in), its ? icons
  // and its explanatory option labels carrying data-hcard, bound by _pnbHoverCard.attachAll.
  function schedRoot() { return el('#scheduler-tab'); }
  function trig() { var r = schedRoot(); return r ? Array.prototype.slice.call(r.querySelectorAll('[data-hcard]')) : []; }
  // Show a trigger that sits in a hidden row (the rows follow the event type): every hidden
  // ancestor up to the tab, put back afterwards.
  function unhide(t) {
    var undo = [], n = t, root = schedRoot();
    while (n && n !== root && n.nodeType === 1) {
      if (n.ownerDocument.defaultView.getComputedStyle(n).display === 'none') { undo.push([n, n.style.display]); n.style.display = 'block'; }
      n = n.parentNode;
    }
    return function () { undo.forEach(function (u) { u[0].style.display = u[1]; }); };
  }
  function nameOf(t) { return (t.getAttribute('data-hcard-title') || t.id || t.tagName) + ''; }
  async function phaseU() {
    await tab('scheduler-tab');
    var list = trig(), ids = window.__HELPIDS || {};
    var titled = list.filter(function (t) { return t.hasAttribute('title'); }).map(nameOf);
    var r = schedRoot();
    // every ? icon carries a bound card (the cron ? gets its from main.js, the rest from data-hcard)
    var bareQ = Array.prototype.filter.call(r ? r.querySelectorAll('.tab-help-icon') : [], function (q) { return !q._pnbHoverCard; }).length;
    var badLink = list.filter(function (t) {
      var help = t.getAttribute('data-hcard-help') || '', at = help.indexOf('#');
      var topic = at > 0 ? help.slice(0, at) : String(t.getAttribute('data-target') || '').replace(/^#/, '');
      var anchor = at > 0 ? help.slice(at + 1) : (t.getAttribute('data-jump-to') || '');
      return !ids[topic] || (anchor && ids[topic].indexOf(anchor) === -1);
    }).map(nameOf);
    var labels = list.filter(function (t) { return t.getAttribute('data-hcard-mode') === 'label'; }).length;
    rec('U1 the real Scheduler tab: 20 tips carry a card (11 ? icons, 9 option labels), none keeps a title tooltip, no ? icon is left without one, and every card links to a real help heading',
        list.length === 20 && labels === 9 && titled.length === 0 && bareQ === 0 && badLink.length === 0,
        list.length + ' cards (' + labels + ' labels); still titled: [' + titled.join(', ') + ']; ? icons without a card: ' + bareQ + '; bad links: [' + badLink.join(', ') + ']');
    // every one opens ITS card
    var bad = [], n = 0;
    for (var i = 0; i < list.length; i++) {
      var t = list[i], back = unhide(t);
      reveal(t);
      await hcClose();
      var o = await hcOpenOn(t);
      if (t.getAttribute('data-hcard-mode') === 'label') { o = o || await hcWait(true, 800); }
      var x = hcInfo(), p = hc();
      var h4 = p ? (p.querySelector('h4') || {}).textContent : '';
      var paras = p ? p.querySelectorAll('p').length : 0;
      var ok = o && x.where === 'tab' && x.inside && h4 === t.getAttribute('data-hcard-title') && x.link === (t.getAttribute('data-hcard-link') || '') &&
        paras >= 2 && !/`/.test(x.text) && t.getAttribute('aria-describedby') === 'pnbHoverCard';
      if (ok) n++; else bad.push(nameOf(t) + ' -> ' + fmtHc(x) + ' h4 "' + h4 + '"');
      await hcClose();
      back();
    }
    rec('U2 each Scheduler tip opens its own card on a hover: its heading, its text (code rendered, no stray backticks), its help link, described-by wired, inside the window',
        bad.length === 0 && n === list.length, n + '/' + list.length + (bad.length ? ' BAD ' + bad.slice(0, 3).join(' | ') : ''));
    // label mode: a longer delay, a click on its checkbox closes it, no reopening until it is left
    var lab = list.filter(function (t) { return t.getAttribute('data-hcard-mode') === 'label' && t.querySelector('input'); })[0];
    var back2 = unhide(lab);
    reveal(lab);
    await hcClose();
    enter(lab);
    await sleep(220);
    var early = hcOpen();
    var late = await hcWait(true, 900);
    var box = lab.querySelector('input'), w = lab.ownerDocument.defaultView, c = centre(lab);
    box.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, view: w, clientX: c.x, clientY: c.y }));
    var shut = !hcOpen();
    moveAt(lab.ownerDocument, c.x + 1, c.y, lab);
    await sleep(700);
    var stayShut = !hcOpen();
    leave(lab, 3, 3);
    enter(lab);
    var again = await hcWait(true, 1000);
    await hcClose();
    back2();
    rec('U3 an option label: its card waits ~400 ms (not open at 220), a mousedown on its checkbox closes it, it stays shut while the pointer stays, and opens again after leaving and coming back',
        !early && late && shut && stayShut && again, 'at 220 ms: ' + early + '; later: ' + late + '; closed by the click: ' + shut + '; shut after: ' + stayShut + '; again: ' + again);
    // a ? icon: a click (mousedown, its focus, click) leaves the card shut; keyboard focus opens it
    var q = list.filter(function (t) { return t.classList.contains('tab-help-icon'); })[0];
    var back3 = unhide(q);
    reveal(q);
    await hcClose();
    await hcOpenOn(q);
    var wasOpen = hcOpen();
    var wq = q.ownerDocument.defaultView, cq = centre(q);
    q.dispatchEvent(new wq.MouseEvent('mousedown', { bubbles: true, cancelable: true, view: wq, clientX: cq.x, clientY: cq.y }));
    q.focus();
    await sleep(400);
    var stillShut = !hcOpen();
    q.blur();
    leave(q, 3, 3);
    await sleep(50);
    q.focus();
    var kb = await hcWait(true, 600);
    q.blur();
    await hcWait(false, 800);
    back3();
    rec('U4 a ? icon: clicking it closes its card and the focus the click gives does not reopen it; keyboard focus (tabindex ' + q.getAttribute('tabindex') + ') opens it',
        wasOpen && stillShut && kb && q.getAttribute('tabindex') === '0', 'open before: ' + wasOpen + '; shut after the click: ' + stillShut + '; opened by keyboard focus: ' + kb);
    // popped out
    var e = await popOut();
    if (e) { rec('U5 Open in Window', false, e); return; }
    await tab('scheduler-tab');
    var q2 = trig().filter(function (t) { return t.classList.contains('tab-help-icon'); })[0];
    var back4 = unhide(q2);
    var o5 = await hcOpenOn(q2);
    var y = hcInfo();
    back4();
    await hcClose();
    rec('U5 popped out: a Scheduler ? icon opens its card IN THE CONSOLE WINDOW, inside its view', o5 && where(q2) === 'console window' && y.where === 'console window' && y.inside, fmtHc(y));
    e = await returnToTab();
    if (e) rec('U6 Return to Tab', false, e);
  }

  // ---------------------------------------------------------------- R (fnpop 5)
  // Recipient and Access List pills (Scheduler Recipients, Send Email To, Save Access List):
  // hover cards, every variable, the page's directory answers; the Recipients alert card.
  var JDOE = { label: 'Jane Doe <jdoe@ncsu.edu>', value: 'jdoe@ncsu.edu', name: 'Jane Doe', fname: 'Jane', lname: 'Doe', username: 'jdoe',
    empl_id: '000123456', ouc: '060401', ouc2d: '06', ouc4d: '0604', dept: 'Sponsored Programs', oucs: '060401|141001', oucs2d: '06|14',
    oucs4d: '0604|1410', jobcode: 'C46114', jobcode_prefix: 'C4', empl_class: 'SPA', empl_status: 'A', pi_eligible: '1', kind: 'employee' };
  var SELFREC = { label: 'Hal Harness <harness@ncsu.edu>', value: 'harness@ncsu.edu', name: 'Hal Harness', fname: 'Hal', lname: 'Harness', username: 'harness',
    empl_id: '001234567', ouc: '060401', ouc2d: '06', ouc4d: '0604', dept: 'Harness Dept', oucs: '060401', oucs2d: '06', oucs4d: '0604',
    jobcode: 'UP02', jobcode_prefix: 'UP', empl_class: 'EFX', empl_status: 'A', pi_eligible: '0', kind: 'employee' };
  function over(t) {
    var w = t.ownerDocument.defaultView, c = centre(t);
    t.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true, cancelable: true, view: w, clientX: c.x, clientY: c.y }));
    // and the mouseenter a real pointer brings (an attached pill listens for it)
    t.dispatchEvent(new w.MouseEvent('mouseenter', { bubbles: false, view: w, clientX: c.x, clientY: c.y }));
    moveAt(t.ownerDocument, c.x, c.y, t);
  }
  async function pillCard(t) { if (!t) return false; reveal(t); await hcClose(); over(t); return hcWait(true, 1500); }
  function pillIn(sel, email) {
    var root = el(sel); if (!root) return null;
    var list = root.querySelectorAll('.email-capsule, .access-capsule');
    for (var i = 0; i < list.length; i++) { var v = String($(list[i]).data('email') || $(list[i]).data('value') || ''); if (v.toLowerCase().indexOf(email) !== -1) return list[i]; }
    return null;
  }
  function cardRows() {
    var p = hc(), out = {};
    if (!p) return out;
    Array.prototype.forEach.call(p.querySelectorAll('.pnb-hc-vars tr'), function (tr) { var td = tr.querySelectorAll('td'); if (td.length === 2) out[td[0].textContent] = td[1].textContent; });
    return out;
  }
  function feedDirectory(items) {
    // what jQuery fires for every get_email_recipients.php answer (the harness's ajax stub fires none)
    $(document).trigger('ajaxSuccess', [{}, { url: 'get_email_recipients.php?term=x' }, items]);
  }
  // The alert card closes itself when the Scheduler form scrolls (by design: it would point at
  // nothing). A reveal's scrollIntoView can deliver its scroll event LATE - in the console window
  // after a hover had already opened the card (seen: trace 11000..., the closer was that scroll).
  // Reveal, then wait until the form has been still for 250 ms.
  async function revealStill(t) {
    var panel = t.closest ? t.closest('.scheduler-config-panel') : null, last = Date.now();
    var on = function () { last = Date.now(); };
    if (panel) panel.addEventListener('scroll', on);
    reveal(t);
    for (var k = 0; k < 100 && Date.now() - last < 250; k++) await sleep(25);
    if (panel) panel.removeEventListener('scroll', on);
  }
  async function phaseR() {
    var H = window.__TTH || {};
    stubHelp();
    var v = H.penumbraDirVars ? H.penumbraDirVars(JDOE) : null;
    var keys = ['fname','lname','username','email','empl_id','ouc','ouc2d','ouc4d','dept','oucs','oucs2d','oucs4d','jobcode','jobcode_prefix','empl_class','empl_status','pi_eligible'];
    var missing = v ? keys.filter(function (k) { return !v[k]; }) : ['(no mapper)'];
    rec('R1 one mapper copies every recipient variable from a directory answer ({OUCS} / {OUCS2D} / {OUCS4D} included)', missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : '17 keys');

    // the Scheduler's Recipients
    await tab('scheduler-tab');
    var box = el('#schedEmailContainer'), showBox = unhide(box);
    feedDirectory([JDOE]);
    H.addEmailCapsule('jdoe@ncsu.edu', null, '#schedEmailContainer', '#schedEmailInput');   // typed: no autocomplete pick
    var jp = pillIn('#schedEmailContainer', 'jdoe@ncsu.edu');
    var jv = jp ? $(jp).data('user-vars') : null;
    rec('R2 a typed recipient the page already saw in a suggestion list carries its full record, with no request of its own',
        !!jv && jv.jobcode === 'C46114' && jv.oucs === '060401|141001' && !(window.__ajaxLog || []).some(function (u) { return /get_email_recipients/.test(u); }),
        jv ? JSON.stringify({ jobcode: jv.jobcode, oucs: jv.oucs }) : 'no vars on the pill');
    var o = await pillCard(jp);
    var i = hcInfo(), rows = cardRows(), p = hc();
    rec('R3 hovering a Scheduler recipient opens its card: name and address, all 20 recipient variables ({OUCS} filled), the Recipient variables help link; the old dark tooltip is gone',
        o && i.where === 'tab' && i.inside && /Jane Doe <jdoe@ncsu\.edu>/.test((p.querySelector('h4') || {}).textContent || '') && Object.keys(rows).length === 20 &&
        rows['{OUCS}'] === '060401|141001' && rows['{JOBCODE}'] === 'C46114' && rows['{EMPL_ID4}'] === '3456' && i.topic === 'schedulerPromptHelpLightbox' && i.anchor === 'schedDyn-recipientVars' &&
        !document.querySelector('.pill-rich-tooltip') && !jp.hasAttribute('title') && !i.dark,
        fmtHc(i) + '; rows ' + Object.keys(rows).length + ', {OUCS} ' + rows['{OUCS}'] + ', title left: ' + jp.hasAttribute('title'));
    await hcClose();
    // your own pill: built from the sign-in; the job fields from the page's answers once it has one
    H.addEmailCapsule('harness@ncsu.edu', null, '#schedEmailContainer', '#schedEmailInput');
    var sp = pillIn('#schedEmailContainer', 'harness@ncsu.edu');
    await pillCard(sp);
    var r1 = cardRows();
    await hcClose();
    feedDirectory([SELFREC]);
    await pillCard(sp);
    var r2 = cardRows();
    await hcClose();
    rec('R4 your own pill: from your sign-in, the job fields "from the directory at send time"; once the page has your record, filled in (no request)',
        r1['{FNAME}'] === 'Hal' && /send time/.test(r1['{JOBCODE}'] || '') && r2['{JOBCODE}'] === 'UP02' && r2['{OUCS}'] === '060401',
        'before: {JOBCODE} ' + r1['{JOBCODE}'] + '; after: {JOBCODE} ' + r2['{JOBCODE}'] + ', {OUCS} ' + r2['{OUCS}']);
    H.addEmailCapsule('pat@example.com', null, '#schedEmailContainer', '#schedEmailInput');
    var ext = pillIn('#schedEmailContainer', 'pat@example.com');
    var o3 = await pillCard(ext);
    rec('R5 an external address opens a card that says it has no directory record', o3 && /outside NC State/.test(hcInfo().text), fmtHc(hcInfo()));
    await hcClose();

    // the Send Email dialog's To
    H.addEmailCapsule('jdoe@ncsu.edu', 'Jane Doe', '#emailRecipientContainer', '#emailInputReal', H.penumbraDirVars(JDOE));
    var ep = pillIn('#emailRecipientContainer', 'jdoe@ncsu.edu');
    var o4 = await pillCard(ep);
    var ei = hcInfo();
    rec('R6 the Send Email dialog\'s chips open the same card (its directory record)', o4 && ei.where === 'tab' && /directory record/.test(ei.text) && Object.keys(cardRows()).length === 20, fmtHc(ei));
    await hcClose();

    // the Save dialog's Access List: a person (from the page's answers, no request), an OUC, a keyword
    var before = (window.__ajaxLog || []).length;
    H.addAccessCapsule('Jane Doe <jdoe@ncsu.edu>', 'Jane Doe', 'ncsu');
    var ap = pillIn('#authAccessContainer', 'jdoe@ncsu.edu');
    var asked = (window.__ajaxLog || []).slice(before).filter(function (u) { return /get_email_recipients/.test(u); }).length;
    var o5 = await pillCard(ap);
    var ai = hcInfo();
    rec('R7 an Access List person pill fills from the page\'s answers (no lookup request) and opens its card, linked to the Access List help',
        asked === 0 && o5 && cardRows()['{JOBCODE}'] === 'C46114' && ai.topic === 'accessListHelpLightbox' && ai.anchor === 'acl-entries', 'lookups: ' + asked + '; ' + fmtHc(ai));
    await hcClose();
    H.addAccessCapsule('06', '06', 'ouc');
    var op = pillIn('#authAccessContainer', '06');
    $(op).data('ouc-info', { code: '06', scope: 'College (2-digit)', college: 'Research & Innovation', label: 'ORI', deptCount: 12, samples: ['060401 - Sponsored Programs', '062001 - ITRE'] });
    var o6 = await pillCard(op);
    var oi = hcInfo();
    await hcClose();
    H.addAccessCapsule('public', 'public', 'public');
    var kp = pillIn('#authAccessContainer', 'public');
    var o7 = await pillCard(kp);
    var ki = hcInfo();
    await hcClose();
    rec('R8 an OUC pill and the public keyword open their cards (the departments with "+10 more"; the only-entry caveat), linked to the Access List help',
        o6 && /OUC 06 - ORI/.test(oi.text) && /\+10 more/.test(oi.text) && oi.anchor === 'acl-ouc' && o7 && /only/.test(ki.text) && ki.anchor === 'acl-entries',
        fmtHc(oi) + ' | ' + fmtHc(ki));

    // the Recipients alert card
    $('#schedEventType').val('EMAIL');
    H.addEmailCapsule('bad@x.', null, '#schedEmailContainer', '#schedEmailInput');
    if (typeof window.checkSchedulerExternalWarning === 'function') window.checkSchedulerExternalWarning();
    var icon = el('#schedRecipAlert'), showIcon = unhide(icon);
    await revealStill(icon);
    var wi = icon.ownerDocument.defaultView;
    icon.dispatchEvent(new wi.MouseEvent('mouseenter', { bubbles: false, view: wi }));
    await sleep(80);
    var card = el('#schedRecipAlertCard');
    var cs = card ? card.ownerDocument.defaultView.getComputedStyle(card) : null;
    var cr = card ? card.getBoundingClientRect() : null;
    var link = card ? card.querySelector('.sched-recip-help-link') : null;
    rec('R9 the Recipients alert card opens on hover in the shared popover look (theme surface, a heading, scrolling cap), inside the window, with a Recipients help link',
        !!card && card.classList.contains('bld-help-pop') && cs.position === 'fixed' && cs.backgroundColor !== 'rgb(26, 26, 46)' && !!card.querySelector('h4') &&
        /^Recipients: /.test(card.querySelector('h4').textContent) && parseFloat(card.style.maxHeight) <= 480 && cs.overflowY === 'auto' &&
        cr.left >= 0 && cr.top >= 0 && cr.right <= wi.innerWidth && cr.bottom <= wi.innerHeight && !!link,
        card ? 'background ' + cs.backgroundColor + ', position ' + cs.position + ', max-height ' + card.style.maxHeight + ', overflow ' + cs.overflowY + ', at ' + [cr.left, cr.top, cr.right, cr.bottom].map(Math.round).join(',') : 'no card');
    helpCalls = [];
    if (link) link.click();
    await sleep(60);
    rec('R10 its help link opens Recipients in the Scheduler help and closes the card',
        helpCalls.length === 1 && helpCalls[0][0] === 'schedulerHelpLightbox' && helpCalls[0][1] === 'schedHelp-recipients' && !el('#schedRecipAlertCard'), JSON.stringify(helpCalls));

    // popped out: a pill card and the alert card by hover, in the console window
    var e = await popOut();
    if (e) { rec('R11 Open in Window', false, e); return; }
    await tab('scheduler-tab');
    var showBox2 = unhide(el('#schedEmailContainer'));
    var jp2 = pillIn('#schedEmailContainer', 'jdoe@ncsu.edu');
    var o8 = await pillCard(jp2);
    var pi = hcInfo();
    await hcClose();
    var icon2 = el('#schedRecipAlert'), showIcon2 = unhide(icon2);
    await revealStill(icon2);
    var w2 = icon2.ownerDocument.defaultView;
    // ONE hover, then watch: when the card shows and whether it goes again. The card closes on a
    // scroll of the form BY DESIGN, and the console window's form can fire one late scroll of its
    // own as it settles (the closer, by stack trace). Only for THAT close - a scroll recorded - is the
    // hover made once more; any other close still fails.
    var panel2 = icon2.closest('.scheduler-config-panel'), scrolled = 0;
    var onScr = function () { scrolled++; };
    if (panel2) panel2.addEventListener('scroll', onScr);
    var seen = [], card2 = null, again = '';
    async function watchCard() {
        icon2.dispatchEvent(new w2.MouseEvent('mouseenter', { bubbles: false, view: w2 }));
        for (var k = 0; k < 30; k++) { card2 = el('#schedRecipAlertCard'); seen.push(card2 ? 1 : 0); if (card2 && k >= 4) break; await sleep(20); }
    }
    await watchCard();
    if (!card2 && scrolled) { again = ' (re-hovered after a late scroll of the form)'; await revealStill(icon2); seen.push('|'); await watchCard(); }
    if (panel2) panel2.removeEventListener('scroll', onScr);
    var trace = 'trace ' + seen.join('') + again + ', icon ' + icon2.className + (icon2.style.display === 'none' ? ' HIDDEN' : '');
    rec('R11 popped out: a recipient pill\'s card and the alert card open on hover IN THE CONSOLE WINDOW',
        o8 && pi.where === 'console window' && pi.inside && !!card2 && where(card2) === 'console window', fmtHc(pi) + ' | alert card in the ' + where(card2) + ', ' + trace);
    icon2.dispatchEvent(new w2.MouseEvent('mouseleave', { bubbles: false, view: w2, relatedTarget: icon2.ownerDocument.body }));
    showIcon2(); showBox2();
    e = await returnToTab();
    if (e) rec('R12 Return to Tab', false, e);
    showIcon(); showBox();
  }

  async function pageMain() {
    phaseL0();
    await tab('report-options-tab');
    phaseS();
    var ajaxBefore = (window.__ajaxLog || []).length;
    await phaseE();
    phaseK();
    await phaseP('tab', 'P');
    var helpFetched = (window.__ajaxLog || []).slice(ajaxBefore).filter(function (u) { return /help_content|help_functions/.test(u); });
    rec('L2 opening cards never fetches the help document (the cards ship in the lazy module)', helpFetched.length === 0, helpFetched.join(', ') || 'no help request');
    await phaseC();
    await phaseW();
    await phaseT();
    await phaseU();
    await phaseR();
  }

  async function pageMountPopped() {
    await tab('sql-editor-tab');
    var e = await popOut();
    if (e) { rec('M0 Open in Window', false, e); return; }
    await tab('report-options-tab');
    var ico = fnRowIco('sum');
    rec('M0 the Custom Code panel was first built INSIDE the console window', !!ico && where(ico) === 'console window', ico ? where(ico) : 'no rows');
    await phaseP('console window', 'M1.');
    var o = await openOn(fnSpan('sum'));
    rec('M2 ...and the editor\'s card opens there too', o && popInfo().where === 'console window', fmtPop(popInfo()));
    await closeCard();
    e = await returnToTab();
    if (e) { rec('M3 Return to Tab', false, e); return; }
    await tab('report-options-tab');
    await phaseP('tab', 'M3.');
  }

  // main.js's first-hover hook: the module not yet loaded, a hover on an
  // underlined name loads it and binds the cards.
  async function pageHook() {
    var loadedBefore = !!SH();
    var host = document.getElementById('report-options-tab');
    host.style.display = 'block';                        // shown without the tab's activate (no panel mount)
    var ed = cm();
    if (ed) ed.refresh();
    var wrap = host.querySelector('.CodeMirror');
    var span = document.createElement('span');
    span.className = 'cm-function-underline';
    span.setAttribute('data-fn', 'sum');
    span.textContent = 'sum';
    span.style.cssText = 'position:absolute;left:40px;top:40px;z-index:5;background:#fff';
    wrap.appendChild(span);
    hoverMove(span, 1);
    for (var k = 0; k < 60 && !(SH() && ed && ed.__pnbCardsBound); k++) await sleep(50);
    var bound = !!(SH() && ed && ed.__pnbCardsBound);
    var o = await openOn(span);
    rec('H1 before the panel mounts, a first hover on an underlined name loads the module, binds the cards, and the next move opens sum\'s card',
        !loadedBefore && bound && o && popInfo().anchor === 'sum', 'loaded before: ' + loadedBefore + '; bound: ' + bound + '; ' + fmtPop(popInfo()));
  }

  setTimeout(function () {
    (HOOK ? pageHook() : MOUNT_POPPED ? pageMountPopped() : pageMain()).then(function () { finish(); },
      function (e) { finish('driver threw: ' + String((e && e.stack) || e).slice(0, 600)); });
  }, 300);
})();
