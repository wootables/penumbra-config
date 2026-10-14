// sumnone suite - browser half (2026-10-10). Drives the REAL main.js (ready closure
// unwrapped; window.__SF.ev evaluates inside it) through the settings panel's
// Columns list after the summary checkbox and the type chip were merged into ONE
// chip that reads None when the column is not summarized, and through the footer
// badge's menu, which gained a None option.
//
//   N  the panel: rows, lane alignment, menu, None <-> type, Apply, Reset, sort, badge toggle
//   F  a footer badge picks None (a preview: nothing saved, the panel keeps the saved type),
//      and the notification's Undo puts it back - only while that None is still in effect
//   K  keyboard only: in the panel (Enter opens the chip's menu, a pick puts focus back on
//      the chip) and the footer None + Undo (focus lands on the restored badge)
//   T  contrast of the None chip in 3 themes
(function () {
  var A = [], INFO = [];
  function rec(id, ok, detail) { A.push({ id: id, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 700) }); }
  function info(s) { INFO.push(String(s).slice(0, 500)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function J(x) { return JSON.stringify(x); }
  var SF = window.__SF || {};
  function ev(s) { return SF.ev(s); }
  function finish(fatal) {
    var payload = { scn: window.__SCN, asserts: A, info: INFO, errors: errs().slice(0, 8), hookErr: window.__SF_ERR || '' };
    if (fatal) payload.fatal = fatal;
    window.__SFRESULT = payload;
    window.__SFDONE = true;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  async function waitFor(fn, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) { } await sleep(25); }
    return false;
  }
  // REAL input, performed by run.py (see the sumfx suite).
  var _seq = 0;
  async function act(items) {
    var my = ++_seq;
    window.__req = { seq: my, items: items };
    var ok = await waitFor(function () { return window.__ack === my; }, 30000);
    if (!ok) throw new Error('run.py never performed input #' + my + ' ' + J(items));
    await sleep(60);
  }
  async function shot(name) { if (/[?&]shots=1/.test(location.search)) await act([{ shot: name }]); }
  function click(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }

  // ---- footers (cells found through the HEADER) -------------------------------
  function colIdIn(table, name) {
    var ths = table.querySelectorAll('thead th[data-colname]');
    for (var i = 0; i < ths.length; i++) if (String(ths[i].getAttribute('data-colname')).toUpperCase() === name) return ths[i].getAttribute('data-column');
    return null;
  }
  function footCellIn(table, name) {
    var id = colIdIn(table, name), f = table && table.tFoot;
    if (id === null || !f || !f.rows.length) return null;
    var cells = f.rows[0].cells;
    for (var i = 0; i < cells.length; i++) if (cells[i].getAttribute('data-column') === id) return cells[i];
    return null;
  }
  function cellInfo(td) {
    if (!td) return { text: 'NO CELL', badge: '', type: '' };
    var b = td.querySelector('.pnb-sum-badge');
    var c = td.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.pnb-sum-badge'), function (n) { n.remove(); });
    return { text: c.textContent.trim(), badge: b ? b.textContent.trim() : '', type: td.getAttribute('data-sum-type') || '' };
  }
  function mainTable() { return document.getElementById('resultsTable'); }
  function mainCell(name) { return footCellIn(mainTable(), name); }
  function main(name) { return cellInfo(mainCell(name)); }
  function badgeOf(td) { return td ? td.querySelector('.pnb-sum-badge') : null; }
  function label(table) {
    var f = table && table.tFoot; if (!f || !f.rows.length) return 'NO FOOT';
    var l = f.rows[0].querySelector('td.pnb-sum-label');
    return l ? l.textContent.trim() : 'NO LABEL';
  }
  function menu() { return document.querySelector('.sp-sumtype-menu'); }
  function opt(type) { return document.querySelector('.sp-sumtype-menu .sp-sumtype-opt[data-type="' + type + '"]'); }
  function optTypes() { return Array.prototype.map.call(document.querySelectorAll('.sp-sumtype-menu .sp-sumtype-opt'), function (o) { return o.getAttribute('data-type'); }); }
  function prefs() { try { return JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); } catch (e) { return { bad: String(e) }; } }
  async function waitBoot() {
    await waitFor(function () { return window.__queryDone >= 1 && document.querySelectorAll('#resultsTable tbody tr').length === window.__LIVE.length && mainCell('AMOUNT'); }, 30000);
    await sleep(400);
  }

  // ---- the panel ---------------------------------------------------------------
  function row(name) { return document.querySelector('#spColumnList .sp-col-item[data-colname="' + name + '"]'); }
  function chip(name) { var r = row(name); return r ? r.querySelector('.sp-col-sumtype') : null; }
  function chipState(name) {
    var c = chip(name); if (!c) return { none: true };
    var fx = row(name).querySelector('.sp-col-formula');
    return { type: c.getAttribute('data-type'), text: c.textContent.trim(), isNone: c.classList.contains('is-none'),
             aria: c.getAttribute('aria-label') || '', shown: c.getClientRects().length > 0, fx: !!fx && fx.style.display !== 'none' };
  }
  function pending() { return $('#spPendingCount').text(); }
  function badgeToggleShown() { var b = document.querySelector('#spColumnList #spBadgeToggle'); return !!b && b.style.display !== 'none'; }
  async function panelPick(name, type) {
    var c = chip(name); if (!c) return 'no chip for ' + name;
    click(c); await sleep(40);
    var o = opt(type); if (!o) return 'menu lacks ' + type + ' (' + optTypes().join(',') + ')';
    click(o); await sleep(60);
    return menu() ? 'menu still open' : '';
  }
  function populate() { ev('populateSettingsColumns()'); }
  // The Undo in the notification for `name` (the newest one, if several).
  function undoBtn(name) {
    var all = document.querySelectorAll('#action_overlay .pnb-sum-undo');
    for (var i = all.length - 1; i >= 0; i--) if (all[i].getAttribute('data-undo-col') === name) return all[i];
    return null;
  }
  // The Undo sits BESIDE the message (right of it, within its height), not on a line of its own.
  function besideMsg(btn) {
    if (!btn) return false;
    var m = btn.closest('.pnb-toast-card').querySelector('.pnb-toast-msg').getBoundingClientRect(), b = btn.getBoundingClientRect();
    return b.left >= m.right - 1 && b.top >= m.top - 4 && b.bottom <= m.bottom + 4;
  }
  async function pickBadge(name, type) {
    var b = badgeOf(mainCell(name)); if (!b) return 'no badge on ' + name;
    click(b); await sleep(40);
    var o = opt(type); if (!o) return 'menu lacks ' + type;
    click(o); await sleep(80);
    return menu() ? 'menu still open' : '';
  }
  var NAMES = ['ID', 'DEPT', 'NAME', 'AMOUNT', 'QTY', 'NOTE'];

  async function scnPanel() {
    await waitBoot();
    // so the rows have real geometry: the panel's closed state may be off-canvas, never display:none
    document.getElementById('settingsPanel').style.cssText += ';transform:none;left:0;top:0;width:340px;visibility:visible;display:block';
    populate();
    await sleep(60);

    // N-rows: one summary control per row, in the lane between the show box and the name
    var bad = [];
    NAMES.forEach(function (n) {
      var r = row(n); if (!r) { bad.push(n + ' no row'); return; }
      if (r.querySelector('input.sp-col-sum')) bad.push(n + ' still has the summary checkbox');
      if (r.querySelectorAll('input[type="checkbox"]').length !== 1) bad.push(n + ' checkboxes=' + r.querySelectorAll('input[type="checkbox"]').length);
      if (r.querySelectorAll('.sp-col-sumtype').length !== 1) bad.push(n + ' chips=' + r.querySelectorAll('.sp-col-sumtype').length);
      var kids = Array.prototype.map.call(r.children, function (k) { return k.className.split(' ')[0]; }).filter(function (k) { return k !== 'sp-col-formula'; });
      // The FIRST four, in this order. What follows the name is the row's free end, where
      // later column features go (the viewer-shading chip arrived 2026-10-10).
      if (J(kids.slice(0, 4)) !== J(['sp-drag-grip', 'sp-col-check', 'sp-col-sumtype', 'sp-col-name'])) bad.push(n + ' order=' + kids.join('>'));
    });
    var a = chipState('AMOUNT'), q = chipState('QTY'), nm = chipState('NAME');
    var fixed = document.querySelector('#spColumnList .sp-col-item.sp-col-fixed');
    rec('N-rows', !bad.length && a.type === 'sum' && a.text === 'SUM' && !a.isNone && q.type === 'sum' &&
      nm.type === '' && nm.text === 'None' && nm.isNone && nm.shown && nm.aria === 'Summary for NAME: None' &&
      !!fixed && !!fixed.querySelector('.sp-col-sum-ghost') && !fixed.querySelector('.sp-col-sumtype') &&
      pending() === '' && $('#spApply').prop('disabled') === true,
      (bad.join('; ') || 'rows ok') + ' AMOUNT=' + J(a) + ' NAME=' + J(nm) + ' fixed=' + !!fixed + ' pending=' + J(pending()));

    // N-align: the lane, its header and the '#' spacer share one width and left edge;
    // every name starts at the same x; rows are all one height (None, a type, '#')
    var head = document.querySelector('#spColumnList .sp-col-head .sph-sum');
    var hr = head ? head.getBoundingClientRect() : null;
    var misses = [], lefts = [], heights = [];
    NAMES.forEach(function (n) {
      var cr = chip(n).getBoundingClientRect();
      if (!hr || Math.abs(cr.left - hr.left) > 0.6 || Math.abs(cr.width - hr.width) > 0.6) misses.push(n + ' chip ' + cr.left.toFixed(1) + '/' + cr.width.toFixed(1));
      lefts.push(row(n).querySelector('.sp-col-name').getBoundingClientRect().left);
      heights.push(row(n).clientHeight);   // no borders: the last row has none
    });
    var gr = fixed.querySelector('.sp-col-sum-ghost').getBoundingClientRect();
    if (!hr || Math.abs(gr.left - hr.left) > 0.6 || Math.abs(gr.width - hr.width) > 0.6) misses.push('# ghost ' + gr.left.toFixed(1) + '/' + gr.width.toFixed(1));
    lefts.push(fixed.querySelector('.sp-col-name').getBoundingClientRect().left);
    heights.push(fixed.clientHeight);
    var hn = document.querySelector('#spColumnList .sp-col-head .sph-name');
    var spreadL = Math.max.apply(null, lefts) - Math.min.apply(null, lefts);
    var spreadH = Math.max.apply(null, heights) - Math.min.apply(null, heights);
    var hnOff = hn ? Math.abs(hn.getBoundingClientRect().left - lefts[0]) : 99;
    rec('N-align', !!hr && hr.width >= 40 && !misses.length && spreadL < 0.6 && spreadH < 0.6 && hnOff < 1,
      'header=' + (hr ? hr.left.toFixed(1) + '/' + hr.width.toFixed(1) : 'none') + ' ' + (misses.join('; ') || 'chips in lane') +
      ' nameLeftSpread=' + spreadL.toFixed(2) + ' rowHeightSpread=' + spreadH.toFixed(2) + ' heights=' + heights.map(function (h) { return h.toFixed(1); }).join(',') + ' headerNameOff=' + hnOff.toFixed(2));
    await shot('panel-rest');

    // N-menu: None heads the menu; from None the natural type is marked
    click(chip('NAME')); await sleep(40);
    var t1 = optTypes();
    var cur1 = Array.prototype.map.call(document.querySelectorAll('.sp-sumtype-menu .is-current'), function (o) { return o.getAttribute('data-type'); });
    var sug1 = Array.prototype.map.call(document.querySelectorAll('.sp-sumtype-menu .is-suggested'), function (o) { return o.getAttribute('data-type'); });
    await shot('panel-menu-none');
    ev('_spCloseSummaryMenu()');
    click(chip('AMOUNT')); await sleep(40);
    var cur2 = Array.prototype.map.call(document.querySelectorAll('.sp-sumtype-menu .is-current'), function (o) { return o.getAttribute('data-type'); });
    var sug2 = document.querySelectorAll('.sp-sumtype-menu .is-suggested').length;
    ev('_spCloseSummaryMenu()');
    rec('N-menu', t1[0] === 'none' && t1.length === 15 && J(cur1) === '["none"]' && J(sug1) === '["count_filled"]' && J(cur2) === '["sum"]' && sug2 === 0,
      'NAME menu=' + t1.join(',') + ' current=' + J(cur1) + ' suggested=' + J(sug1) + ' | AMOUNT current=' + J(cur2) + ' suggested=' + sug2);

    // N-on: None -> a type
    var w1 = await panelPick('NAME', 'count_filled');
    var s1 = chipState('NAME');
    rec('N-on', !w1 && s1.type === 'count_filled' && s1.text === 'FILL' && !s1.isNone && s1.aria.indexOf('Summary for NAME: ') === 0 && s1.aria.indexOf('None') < 0 &&
      /1 change/.test(pending()) && badgeToggleShown(),
      (w1 || '') + ' NAME=' + J(s1) + ' pending=' + J(pending()) + ' badgeToggle=' + badgeToggleShown());

    // N-off: a type -> None (what unticking the box used to do)
    var w2 = await panelPick('AMOUNT', 'none');
    var s2 = chipState('AMOUNT');
    rec('N-off', !w2 && s2.type === '' && s2.text === 'None' && s2.isNone && !s2.fx && s2.aria === 'Summary for AMOUNT: None' && /2 change/.test(pending()),
      (w2 || '') + ' AMOUNT=' + J(s2) + ' pending=' + J(pending()));

    // N-apply: saved as the override map; the footer follows
    click(document.getElementById('spApply'));
    await sleep(300);
    var pr = (prefs().sumfx || {}).summaries;
    var fa = main('AMOUNT'), fn = main('NAME'), fq = main('QTY');
    rec('N-apply', !!pr && Object.keys(pr).length === 2 && pr.AMOUNT === false && pr.NAME === 'count_filled' && fa.type === '' && fa.badge === '' && fa.text === '' &&
      fn.type === 'count_filled' && fn.text === '6' && fq.type === 'sum' && fq.text === '21',
      'prefs.summaries=' + J(pr) + ' AMOUNT=' + J(fa) + ' NAME=' + J(fn) + ' QTY=' + J(fq));

    // N-reload: the panel reads the saved choice back
    populate(); await sleep(40);
    var r1 = chipState('AMOUNT'), r2 = chipState('NAME');
    rec('N-reload', r1.type === '' && r1.isNone && r2.type === 'count_filled' && pending() === '', 'AMOUNT=' + J(r1) + ' NAME=' + J(r2) + ' pending=' + J(pending()));

    // N-reset: Reset puts a None pick back to the type it had
    var w3 = await panelPick('QTY', 'none');
    var q0 = chipState('QTY');
    ev('resetPanelState()'); await sleep(40);
    var q1 = chipState('QTY');
    rec('N-reset', !w3 && q0.type === '' && q1.type === 'sum' && q1.text === 'SUM' && !q1.isNone && pending() === '',
      (w3 || '') + ' QTY picked=' + J(q0) + ' after Reset=' + J(q1) + ' pending=' + J(pending()));

    // N-sort: the Sigma lane groups the summarized columns first
    head = document.querySelector('#spColumnList .sp-col-head .sph-sum');   // re-populated since
    click(head); await sleep(60);
    var order = Array.prototype.map.call(document.querySelectorAll('#spColumnList .sp-col-item:not(.sp-col-fixed)'), function (r) {
      return r.getAttribute('data-colname') + ':' + (r.querySelector('.sp-col-sumtype').getAttribute('data-type') || '-');
    });
    var firstNone = order.findIndex(function (s) { return /:-$/.test(s); });
    var lastSum = -1; order.forEach(function (s, i) { if (!/:-$/.test(s)) lastSum = i; });
    rec('N-sort', lastSum >= 0 && firstNone > lastSum && order.length === 6, 'order=' + order.join(' '));

    // N-toggle: with every column at None there are no badges for the Hide/Show chip to govern
    var w4 = await panelPick('NAME', 'none');
    var w5 = await panelPick('QTY', 'none');
    var anyType = Array.prototype.some.call(document.querySelectorAll('#spColumnList .sp-col-sumtype'), function (c) { return !!c.getAttribute('data-type'); });
    rec('N-toggle', !w4 && !w5 && !anyType && !badgeToggleShown(), (w4 || '') + (w5 || '') + ' anyType=' + anyType + ' badgeToggle=' + badgeToggleShown());
    await shot('panel-all-none');
  }

  // A footer badge picks None: a preview, like every badge pick.
  async function scnFooter() {
    await waitBoot();
    var a0 = main('AMOUNT'), q0 = main('QTY');
    rec('F-boot', a0.text === '$2,100.00' && a0.type === 'sum' && q0.text === '21' && label(mainTable()) === 'TOTALS', 'AMOUNT=' + J(a0) + ' QTY=' + J(q0));
    var b = badgeOf(mainCell('AMOUNT'));
    click(b); await sleep(40);
    var t = optTypes();
    var none = opt('none');
    rec('F-opt', t[0] === 'none' && t.length === 15 && !!none && !none.classList.contains('is-current') && opt('sum').classList.contains('is-current'),
      'menu=' + t.join(','));
    await shot('footer-menu');
    if (none) click(none);
    await sleep(80);
    var a1 = main('AMOUNT'), q1 = main('QTY');
    rec('F-none', !menu() && a1.type === '' && a1.badge === '' && a1.text === '' && q1.type === 'sum' && q1.text === '21' && label(mainTable()) === 'TOTALS',
      'menu=' + !!menu() + ' AMOUNT=' + J(a1) + ' QTY=' + J(q1) + ' label=' + label(mainTable()));
    // the notification, with Undo
    // short text, the countdown bar shows (not a "pinned" card), Undo on the message's line
    var u1 = undoBtn('AMOUNT'), tp = u1 ? u1.closest('.pnb-toast-card').querySelector('.pnb-toast-msg').textContent : '';
    var card = u1 ? u1.closest('.pnb-toast-card') : null, bar = card ? card.querySelector('.pnb-toast-bar') : null;
    var barShown = !!bar && getComputedStyle(bar).display !== 'none' && !card.classList.contains('pnbt-pinned');
    var sameLine = besideMsg(u1);
    rec('F-toast', !!u1 && /Summary removed from AMOUNT\. Not saved\./.test(tp) && barShown && sameLine,
      'undo=' + !!u1 + ' toast=' + J(tp) + ' bar=' + barShown + ' sameLine=' + sameLine);
    await shot('footer-toast');
    // a preview: nothing saved, the panel still shows the saved type
    populate(); await sleep(40);
    var c = chipState('AMOUNT');
    var st = ev('buildStateObject()');
    rec('F-nosave', J(ev('transientColumnSummaries')) === '{"AMOUNT":false}' && !((prefs().sumfx || {}).summaries) &&
      c.type === 'sum' && pending() === '' && !(st.columnSummaries && st.columnSummaries.AMOUNT === false),
      'transient=' + J(ev('transientColumnSummaries')) + ' prefs=' + J(prefs()) + ' panel AMOUNT=' + J(c) + ' state=' + J(st.columnSummaries) + ' pending=' + J(pending()));
    // Undo puts the summary back
    if (u1) click(u1);
    await sleep(80);
    var a2 = main('AMOUNT'), tp2 = u1 ? (u1.isConnected ? 'button still there' : (document.querySelector('#action_overlay') || document.body).textContent) : '';
    rec('F-undo', !!u1 && a2.type === 'sum' && a2.text === '$2,100.00' && a2.badge === 'SUM' && J(ev('transientColumnSummaries')) === '{}' &&
      !u1.isConnected && /Restored\./.test(tp2),
      'AMOUNT=' + J(a2) + ' transient=' + J(ev('transientColumnSummaries')) + ' toast=' + J(tp2.slice(-120)));
    // None again, then the panel's Apply clears the preview: AMOUNT comes back, and
    // the (new) Undo then has nothing to put back
    var w2 = await pickBadge('AMOUNT', 'none');
    var u2 = undoBtn('AMOUNT');
    ev('applyColumnChanges()'); await sleep(300);
    var a3 = main('AMOUNT');
    rec('F-back', !w2 && a3.type === 'sum' && a3.text === '$2,100.00' && J(ev('transientColumnSummaries')) === '{}', (w2 || '') + ' AMOUNT=' + J(a3) + ' transient=' + J(ev('transientColumnSummaries')));
    if (u2) click(u2);
    await sleep(80);
    var a4 = main('AMOUNT'), tp3 = u2 ? u2.ownerDocument.querySelector('#action_overlay').textContent : '';
    rec('F-stale', !!u2 && a4.type === 'sum' && J(ev('transientColumnSummaries')) === '{}' && /Nothing to undo/.test(tp3),
      'undo=' + !!u2 + ' AMOUNT=' + J(a4) + ' transient=' + J(ev('transientColumnSummaries')));
    // a LONG column name still keeps Undo on the message's line
    window.Penumbra = window.Penumbra || {};
    var _fc = window.Penumbra.journalFriendlyCol;
    window.Penumbra.journalFriendlyCol = function () { return 'SPONSOR_AWARD_PROJECT_TOTAL_EXPENDITURES'; };
    ev('_pnbToastClearDock(document.getElementById("action_overlay"))');   // the 3 earlier cards would queue this one
    var wl = await pickBadge('QTY', 'none');
    var ul = undoBtn('QTY');
    var lineOk = besideMsg(ul);
    await shot('footer-toast-long');
    window.Penumbra.journalFriendlyCol = _fc;
    if (ul) click(ul);
    await sleep(80);
    rec('F-longline', !wl && !!ul && lineOk && main('QTY').type === 'sum', (wl || '') + ' undo=' + !!ul + ' sameLine=' + lineOk + ' QTY=' + J(main('QTY')));
    // None on the last summarized column too: no summary values left, no errors
    var e0 = errs().length;
    click(badgeOf(mainCell('AMOUNT'))); await sleep(40); if (opt('none')) click(opt('none')); await sleep(80);
    click(badgeOf(mainCell('QTY'))); await sleep(40); if (opt('none')) click(opt('none')); await sleep(80);
    var left = mainTable().tFoot ? mainTable().tFoot.querySelectorAll('.pnb-sum-badge').length : 0;
    info('footer after None on both: label=' + label(mainTable()) + ' badges=' + left);
    rec('F-all', left === 0 && main('AMOUNT').type === '' && main('QTY').type === '' && errs().length === e0, 'badges left=' + left + ' new errors=' + (errs().length - e0));
  }

  // Keyboard only, in the panel.
  async function scnKbd() {
    await waitBoot();
    document.getElementById('settingsPanel').style.cssText += ';transform:none;left:0;top:0;width:340px;visibility:visible;display:block';
    populate(); await sleep(60);
    chip('NAME').focus();
    await act(['Enter']); await sleep(80);
    var first = document.querySelector('.sp-sumtype-menu .sp-sumtype-opt');
    rec('K-open', !!menu() && !!first && first.getAttribute('data-type') === 'none' && document.activeElement === first,
      'menu=' + !!menu() + ' active=' + (document.activeElement && (document.activeElement.getAttribute('data-type') || document.activeElement.className)));
    await act(['ArrowDown', 'Enter']); await sleep(80);
    var s = chipState('NAME');
    rec('K-pick', !menu() && s.type === 'sum' && document.activeElement === chip('NAME'),
      'menu=' + !!menu() + ' NAME=' + J(s) + ' active=' + (document.activeElement && document.activeElement.className));
    await act(['Enter']); await sleep(80);
    await act(['Home', 'Enter']); await sleep(80);
    var s2 = chipState('NAME');
    rec('K-none', !menu() && s2.type === '' && s2.isNone && document.activeElement === chip('NAME') && pending() === '',
      'menu=' + !!menu() + ' NAME=' + J(s2) + ' active=' + (document.activeElement && document.activeElement.className) + ' pending=' + J(pending()));
    // the footer: None by keyboard, then Undo by keyboard lands on the restored badge
    var qb = badgeOf(mainCell('QTY'));
    qb.scrollIntoView({ block: 'center' }); qb.focus();
    await act(['Enter']); await sleep(80);
    var firstF = document.querySelector('.sp-sumtype-menu .sp-sumtype-opt');
    var okFirst = !!firstF && firstF.getAttribute('data-type') === 'none' && document.activeElement === firstF;
    await act(['Enter']); await sleep(120);
    var gone = main('QTY').type === '';
    var ub = undoBtn('QTY');
    if (ub) { ub.focus(); await act(['Enter']); await sleep(150); }
    var q = main('QTY'), nb = badgeOf(mainCell('QTY'));
    rec('K-undo', okFirst && gone && !!ub && q.type === 'sum' && q.text === '21' && !!nb && document.activeElement === nb,
      'firstIsNone=' + okFirst + ' gone=' + gone + ' undo=' + !!ub + ' QTY=' + J(q) + ' active=' + (document.activeElement && document.activeElement.className));
  }

  // ---- contrast of the None chip -------------------------------------------------
  function parseColor(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = /color\(srgb ([^)]+)\)/.exec(s);
    if (m) { var q = m[1].split(/[ \/]+/).filter(Boolean).map(parseFloat); return { r: q[0] * 255, g: q[1] * 255, b: q[2] * 255, a: q.length > 3 ? q[3] : 1 }; }
    return null;
  }
  function lum(c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function bgOf(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  function ratio(fg, bg) { var l1 = lum(fg), l2 = lum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  async function scnTheme() {
    await waitBoot();
    document.getElementById('settingsPanel').style.cssText += ';transform:none;left:0;top:0;width:340px;visibility:visible;display:block';
    populate(); await sleep(60);
    var themes = [['light', 'theme-default'], ['dark-blue', 'theme-dark-blue is-dark'], ['charcoal-gold', 'theme-charcoal-gold is-dark']];
    for (var i = 0; i < themes.length; i++) {
      document.body.className = themes[i][1];
      await sleep(40);
      var c = chip('NAME'), s = chip('AMOUNT');
      var cs = getComputedStyle(c);
      var text = ratio(parseColor(cs.color), bgOf(c));
      var edge = ratio(parseColor(cs.borderTopColor), bgOf(c.parentElement));
      var sumText = ratio(parseColor(getComputedStyle(s).color), bgOf(s));
      await shot('theme-' + themes[i][0]);
      // text >= 4.5 (WCAG 1.4.3); the dashed outline is decoration, the word carries it
      rec('T-' + themes[i][0], text >= 4.5 && cs.borderTopStyle === 'dashed',
        'None text ' + text.toFixed(2) + ' border ' + cs.borderTopStyle + ' ' + edge.toFixed(2) + ' (a type chip: ' + sumText.toFixed(2) + ')');
    }
    document.body.className = 'theme-default';
  }

  // The Calculated columns block (js/penumbra_calc.js, 2026-10-10 round 2): heading, "?" and the
  // Add button on ONE line, the button flush right; no note under it any more.
  async function scnCalc() {
    await waitBoot();
    document.getElementById('settingsPanel').style.cssText += ';transform:none;left:0;top:0;width:340px;visibility:visible;display:block';
    populate();
    await waitFor(function () { return document.getElementById('pnbCalcSec'); }, 5000);
    await sleep(80);
    var sec = document.getElementById('pnbCalcSec'), head = sec && sec.querySelector('.pnb-calc-head');
    var add = document.getElementById('pnbCalcAdd'), q = head && head.querySelector('.sp-help-icon');
    var title = head && head.querySelector('span');
    var hr = head ? head.getBoundingClientRect() : null, ar = add ? add.getBoundingClientRect() : null;
    var tr = title ? title.getBoundingClientRect() : null, qr = q ? q.getBoundingClientRect() : null;
    var mid = function (r) { return r.top + r.height / 2; };
    var ok = !!(head && add && q && title) && add.parentNode === head && /^Calculated columns$/.test(title.textContent.trim()) &&
      q.classList.contains('tab-help-icon') && q.getAttribute('data-target') === '#userSettingsHelpLightbox' && q.getAttribute('data-jump-to') === 'us-calc' &&
      !!q.getAttribute('aria-label') && Math.abs(ar.right - hr.right) < 1.5 && Math.abs(mid(ar) - mid(tr)) < 3 && Math.abs(mid(qr) - mid(tr)) < 3 &&
      qr.left > tr.right && ar.left > qr.right + 20;
    rec('C-head', ok, head ? ('head ' + hr.left.toFixed(0) + '-' + hr.right.toFixed(0) + ' title ' + (tr && tr.left.toFixed(0) + '-' + tr.right.toFixed(0)) +
      ' ? ' + (qr && qr.left.toFixed(0)) + ' add ' + (ar && ar.left.toFixed(0) + '-' + ar.right.toFixed(0)) +
      ' mids ' + (tr && mid(tr).toFixed(1)) + '/' + (qr && mid(qr).toFixed(1)) + '/' + (ar && mid(ar).toFixed(1)) +
      ' jump=' + (q && q.getAttribute('data-jump-to'))) : 'no head');
    rec('C-nonote', !!sec && !sec.querySelector('.pnb-calc-note, #pnbCalcNote') && !/Work out a column/.test(sec.textContent),
      'section text=' + J(sec ? sec.textContent.trim() : null));
    var list = document.getElementById('pnbCalcList');
    rec('C-empty', !!list && list.children.length === 0 && getComputedStyle(list).display === 'none', 'list display=' + (list && getComputedStyle(list).display));
    // C-align: the Add button ends where the COLUMN LIST ends (not the panel), like Freeze above it
    var lr = document.getElementById('spColumnList').getBoundingClientRect();
    var mv = document.querySelector('.sp-move-buttons'), mr = mv ? mv.getBoundingClientRect() : null;
    rec('C-align', !!ar && !!mr && mr.width > 0 && Math.abs(ar.right - lr.right) < 1.5 && ar.right < mr.left,
      'add right=' + (ar && ar.right.toFixed(1)) + ' list right=' + lr.right.toFixed(1) + ' move buttons left=' + (mr && mr.left.toFixed(1)));
    // C-border: the rule sits BELOW the block, none above it
    var cs = sec ? getComputedStyle(sec) : null;
    rec('C-border', !!cs && cs.borderBottomStyle === 'solid' && parseFloat(cs.borderBottomWidth) >= 1 && (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) &&
      sec.getBoundingClientRect().bottom - hr.bottom <= 10,
      cs ? ('top=' + cs.borderTopStyle + ' ' + cs.borderTopWidth + ' bottom=' + cs.borderBottomStyle + ' ' + cs.borderBottomWidth +
            ' head->rule=' + (sec.getBoundingClientRect().bottom - hr.bottom).toFixed(1)) : 'no section');
    // C-gap: inside the panel's real .sp-body (16px flex gap), Save sits 8px under the calc rule;
    // with no calc block the row keeps its usual 31px under the list
    var colsec = document.querySelector('#settingsPanel .sp-columns-section'), acts = document.querySelector('#settingsPanel .sp-actions');
    var body = document.createElement('div'); body.className = 'sp-body'; body.style.flex = 'none';
    colsec.parentNode.insertBefore(body, colsec); body.appendChild(colsec); body.appendChild(acts);
    await sleep(40);
    var save = document.getElementById('spApply');
    var withCalc = save.getBoundingClientRect().top - sec.getBoundingClientRect().bottom;
    var holder = sec.parentNode, next = sec.nextSibling; holder.removeChild(sec);
    await sleep(40);
    var lastOf = colsec.querySelector('.sp-column-container').getBoundingClientRect().bottom;
    var noCalc = save.getBoundingClientRect().top - lastOf;
    holder.insertBefore(sec, next);
    rec('C-gap', Math.abs(withCalc - 8) < 1.5 && Math.abs(noCalc - 31) < 1.5,
      'rule->Save ' + withCalc.toFixed(1) + 'px (want 8); without the calc block list->Save ' + noCalc.toFixed(1) + 'px (want 31, as before: 16 gap + 10 padding + the global button margin 5)');
    await shot('calc-head');
  }

  // Calculated columns in the real page (2026-10-10 calcsweep): a column named I
  // (a letter of ID) must not make ID summable - the totals whitelist is matched by
  // SUBSTRING; the calculated column itself is totalled; the scheduler's pickers
  // leave it out; a Save drops a grouping by it.
  async function scnCalcInt() {
    await waitBoot();
    var C = window.PenumbraCalc;
    var wl0 = JSON.stringify(window.penumbra_vars.totalExemptions);
    C.openDialog(null);
    document.getElementById('pnbCalcName').value = 'I';
    document.getElementById('pnbCalcFormula').value = '{QTY} * 2';
    document.getElementById('pnbCalcGo').click();
    var ok = await waitFor(function () { return !!document.querySelector('#tableHeader th[data-colname="I"]') && mainCell('I'); }, 15000);
    await sleep(300);
    rec('I-added', ok && !document.getElementById('pnbCalcOverlay'), 'header I=' + ok);
    rec('I-whitelist', JSON.stringify(window.penumbra_vars.totalExemptions) === wl0, 'totalExemptions before=' + wl0 + ' after=' + JSON.stringify(window.penumbra_vars.totalExemptions));
    var id = main('ID'), ic = main('I');
    var props = ($('#resultsTable').data('columnProperties') || {});
    var idProps = null; Object.keys(props).forEach(function (k) { if (props[k] && String(props[k].originalName || props[k].name || '').toUpperCase() === 'ID') idProps = props[k]; });
    rec('I-notsummed', id.type === '' && id.text === '', 'ID footer=' + J(id) + ' (I is a letter of ID: the old push made ID summable)');
    rec('I-calcsummed', ic.type === 'sum' && ic.text === '42', 'I footer=' + J(ic));
    var api = window._penumbraSearchAPI;
    var sched = api.getColumns({ schedFilter: true }).map(function (c) { return c.name; });
    var plain = api.getColumns().map(function (c) { return c.name; });
    rec('I-schedfilter', sched.indexOf('I') === -1 && sched.indexOf('QTY') !== -1, 'scheduler filter columns=' + sched.join(','));
    rec('I-tablesearch', plain.indexOf('I') !== -1, 'table search columns=' + plain.join(','));
    if (!document.getElementById('schedColumnSelector')) { var d = document.createElement('div'); d.id = 'schedColumnSelector'; document.body.appendChild(d); }
    try { ev("applyTaskTypeUI('EMAIL')"); } catch (e) { info('applyTaskTypeUI threw: ' + e); }
    var sc = Array.prototype.map.call(document.querySelectorAll('#schedColumnSelector input'), function (i) { return i.value; });
    rec('I-schedcols', sc.length > 0 && sc.indexOf('I') === -1 && sc.indexOf('QTY') !== -1, 'scheduler column selector=' + sc.join(','));
    // the Save path's strip: a grouping by the calculated column and its per-column settings go, the rest stays
    var said = [];
    var st0 = window.show_text; window.show_text = function (h) { said.push(String(h)); return st0 && st0.apply(this, arguments); };
    var st = { groupBy: 'I,DEPT', groupAgg: { column: 'I', type: 'sum' }, groupSort: { key: 'summary', dir: 'asc' },
               columnWidths: { I: 120, NAME: 90 }, columnSummaries: { I: 'avg' }, pivot: { rows: ['DEPT'], cols: [], vals: 'AMOUNT', agg: ['wavg@I'] } };
    C.stripFromState(st, $('#resultsTable').data('columnNameToOriginalIndex'));
    await sleep(1200);
    window.show_text = st0;
    rec('I-strip', st.groupBy === 'DEPT' && !st.groupAgg && !st.groupSort && JSON.stringify(st.columnWidths) === '{"NAME":90}' && !st.columnSummaries && !st.pivot &&
      said.some(function (h) { return /grouping by I/.test(h) && /pivot/.test(h); }),
      'state after strip=' + J(st) + ' notice=' + J(said.join(' | ').slice(0, 300)));
  }

  var SCN = { panel: scnPanel, footer: scnFooter, kbd: scnKbd, theme: scnTheme, calc: scnCalc, calcint: scnCalcInt };
  (async function () {
    try {
      if (!SF.ev) { finish('hook: window.__SF.ev missing'); return; }
      var fn = SCN[window.__SCN];
      if (!fn) { finish('unknown scenario ' + window.__SCN); return; }
      await fn();
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
