// Status bar Columns card - browser half (2026-10-19, colscard). Drives the REAL
// main.js (ready closure unwrapped, window.__CLC export hook), the REAL
// penumbra_presets.js and penumbra_calc.js, with the status bar's segments LIFTED
// from the index.php under test (run.ps1).
//   ?scn=main  the count opens a card with a line per chip of its segment, in use or
//              not; the card's button opens the Column & Settings panel; the resting
//              "no nesting" / "no pivot" chips show only where they mean something;
//              one card at a time; Escape; keys; a viewer's lines; the repository
//              page and a page with no columns keep the count as the panel's opener
//   ?scn=calc  a calculated column (&calc= on the URL): its line, the calc chip's
//              popover taking over from the card, and that popover's "list" button
//              opening the panel (it used to click the count)
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 700) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 8), hookErr: [window.__CLC_ERR].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};

  var SCN = (/[?&]scn=([a-z]+)/.exec(location.search) || [])[1] || 'main';
  var H = window.__CLC || {};
  var FF = (window.Penumbra && window.Penumbra.flatFreeze) || null;
  var CODES = { 'Enter': 13, ' ': 32, 'Escape': 27 };
  function key(el, k) {
    var ev = new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, keyCode: CODES[k], which: CODES[k], bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev;
  }
  function $1(sel) { return document.querySelector(sel); }
  function shown(el) { return !!el && getComputedStyle(el).display !== 'none'; }
  function panelOpen() { return $('#settingsPanel').hasClass('is-open'); }
  function closePanel() { $('#settingsPanel').removeClass('is-open'); $('#settingsPanelOverlay').removeClass('is-open'); }
  function cardOpen() { return $('#sbColsSeg').hasClass('sb-cl-open') && shown($1('#sbColsPop')); }
  function lines() {
    return $('#sbColsList .sb-cl-row').map(function () {
      return { key: this.getAttribute('data-cl'), label: $(this).children('dt').text(), value: $(this).children('dd').text(), on: this.classList.contains('sb-cl-on') };
    }).get();
  }
  function line(k) { var l = lines().filter(function (x) { return x.key === k; }); return l.length ? l[0] : null; }
  function keysOf() { return lines().map(function (x) { return x.key; }).join(','); }
  function closeAll() {
    document.body.click();
    $('#sbColsSeg').removeClass('sb-cc-open sb-pp-open sb-grp-open sb-frz-open sb-snap-open sb-asof-open sb-cl-open');
    $('#pnbStatusBar').removeClass('sb-pop-open');
    document.body.classList.remove('sb-tips-suppressed');
    closePanel();
    if (window.PenumbraCalc && window.PenumbraCalc.closeChipMenu) { try { window.PenumbraCalc.closeChipMenu(false); } catch (e) {} }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  // The bar repaints off #resultCount (a MutationObserver, 60 ms debounce).
  async function refresh() { document.getElementById('resultCount').appendChild(document.createTextNode('')); await sleep(220); }

  var COLS = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'AMOUNT'];
  function makeRows(n, nested) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var row = {};
      for (var c = 0; c < COLS.length; c++) row[COLS[c]] = (COLS[c] === 'AMOUNT') ? String(i * 100) : ('value ' + COLS[c] + ' row ' + i);
      if (nested) row.C03 = '@@JSON[{"ITEM":"part ' + i + '","QTY":' + i + '}]';
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
    await sleep(450);
  }
  // What the count says, as the card's Showing line should read it.
  function countAsLine() {
    var m = /^(\d+) of (\d+)$/.exec($.trim($('#sbCols').text()));
    return m ? (m[1] === m[2] ? 'all ' + m[2] : m[1] + ' of ' + m[2]) : '?';
  }
  function state() {
    var op = $1('#sbColsOpen');
    return 'card=' + cardOpen() + ' exp=' + (op && op.getAttribute('aria-expanded')) + ' panel=' + panelOpen() + ' segCls=' + ($1('#sbColsSeg') || {}).className;
  }

  // ------------------------------------------------------------------------
  async function scnMain() {
    var seg = $1('#sbColsSeg'), op = $1('#sbColsOpen'), caret = $1('#sbColsOpen .sb-cl-caret');
    if (!seg || !op || !$1('#sbColsPop')) { rec('C00 the Cols segment, its count and the Columns card are on the page', false, 'seg=' + !!seg + ' op=' + !!op + ' pop=' + !!$1('#sbColsPop')); return; }

    // C0 - no columns yet (the home screen's state): the count opens the panel.
    closePanel();
    var ready0 = seg.classList.contains('sb-cl-ready'), hp0 = op.hasAttribute('aria-haspopup'), ex0 = op.hasAttribute('aria-expanded'), car0 = shown(caret);
    op.click();
    await sleep(40);
    var p0 = panelOpen(), c0 = cardOpen();
    closeAll();
    rec('C0 with no columns on screen (the home screen) the count is no popup: no caret, no aria-haspopup / aria-expanded, a click opens the Column & Settings panel',
      !ready0 && !hp0 && !ex0 && !car0 && p0 && !c0, 'ready=' + ready0 + ' haspopup=' + hp0 + ' expanded=' + ex0 + ' caret=' + car0 + ' panel=' + p0 + ' card=' + c0);

    if (H.setName) H.setName('repC');
    await runQuery(makeRows(12));
    if (FF) FF.set(0, 2);
    await refresh();
    rec('C00 the fixture: a flat table on screen, the count "N of N", two columns frozen',
      !!document.querySelector('#tableHeader th') && /^\d+ of \d+$/.test($.trim($('#sbCols').text())) && shown($1('#sbFrozen')),
      'th=' + document.querySelectorAll('#tableHeader th').length + ' cols=[' + $('#sbCols').text() + '] frozen=' + shown($1('#sbFrozen')));

    // C1 - the gear is gone.
    rec('C1 the gear after the chips is gone (the card holds the panel\'s button now)',
      !document.querySelector('#sbColsSeg .sb-cols-gear-wrap, #sbColsSeg .sb-cols-gear'), 'gear=' + document.querySelectorAll('#sbColsSeg .sb-cols-gear-wrap').length);

    // C2 - the resting chips.
    var nestEl = $1('#sbNested'), pivEl = $1('#sbPivot');
    rec('C2 on a report with no nested columns, no saved pivot, no pivot presets and no pivot on this page, neither "no nesting" nor "no pivot" shows',
      !!nestEl && !!pivEl && !shown(nestEl) && !shown(pivEl),
      'nested=' + (nestEl && shown(nestEl)) + ' [' + (nestEl && nestEl.textContent) + '] pivot=' + (pivEl && shown(pivEl)) + ' [' + (pivEl && $.trim(pivEl.textContent)) + ']');

    // C3 - the count is the card's popup button, and the card follows it in the DOM.
    rec('C3 the count is the card\'s popup button: caret, aria-haspopup / aria-controls / aria-expanded=false, a title that says so, the card right after it (Tab reaches its button next)',
      seg.classList.contains('sb-cl-ready') && shown(caret) && op.getAttribute('aria-haspopup') === 'true' && op.getAttribute('aria-controls') === 'sbColsPop' &&
      op.getAttribute('aria-expanded') === 'false' && /click for the column chips/.test(op.getAttribute('title') || '') && op.nextElementSibling === $1('#sbColsPop'),
      'ready=' + seg.classList.contains('sb-cl-ready') + ' caret=' + shown(caret) + ' haspopup=' + op.getAttribute('aria-haspopup') + ' controls=' + op.getAttribute('aria-controls') +
      ' expanded=' + op.getAttribute('aria-expanded') + ' title=' + op.getAttribute('title') + ' next=' + (op.nextElementSibling && op.nextElementSibling.id));

    // C4 - a click opens the card.
    closeAll();
    op.click();
    await sleep(40);
    var o4 = cardOpen(), lift4 = $('#pnbStatusBar').hasClass('sb-pop-open'), tips4 = document.body.classList.contains('sb-tips-suppressed');
    rec('C4 a click on the count opens the Columns card, not the panel: card shown, aria-expanded=true, the bar lifted, tooltips held',
      o4 && op.getAttribute('aria-expanded') === 'true' && lift4 && tips4 && !panelOpen(), state() + ' lift=' + lift4 + ' tips=' + tips4);

    // C5 / C6 - the lines.
    var ks = keysOf(), labs = lines().map(function (x) { return x.label; }).join('|');
    rec('C5 one line per chip of the segment, in the bar\'s order, in use or not: Showing, Frozen, Nested, Calculated, Pivot, Grouping, Earlier version, Snapshot, Table, Custom layout',
      ks === 'shown,frozen,nested,calc,pivot,group,asof,snap,table,custom' &&
      labs === 'Showing|Frozen|Nested|Calculated|Pivot|Grouping|Earlier version|Snapshot|Table|Custom layout', 'keys=' + ks + ' labels=' + labs);
    var L = function (k) { return line(k) || {}; };
    // (Freezing 2 where the report freezes none is a layout of this browser's own:
    // the custom-layout chip shows, and its line says so.)
    var cc6 = shown($1('#sbCustomCols'));
    rec('C6 each line gives the state now: the count as the bar has it, the frozen columns and this browser\'s own layout (in use), and for every chip not in use its plain state, muted',
      L('shown').value === countAsLine() && L('shown').on && /^2: /.test(L('frozen').value || '') && L('frozen').on &&
      L('nested').value === 'none' && !L('nested').on && L('calc').value === 'none' && !L('calc').on &&
      L('pivot').value === 'none' && !L('pivot').on && L('group').value === 'none' && !L('group').on &&
      L('asof').value === 'none (the live version)' && !L('asof').on && L('snap').value === 'none (live data)' && !L('snap').on &&
      L('table').value === 'shown' && !L('table').on && cc6 && L('custom').value === 'yours, in this browser only' && L('custom').on,
      'count=' + countAsLine() + ' customChip=' + cc6 + ' ' + JSON.stringify(lines()));

    // C7 - a second click closes it.
    op.click();
    await sleep(40);
    rec('C7 a second click closes it: aria-expanded=false, the bar back down, tooltips back',
      !cardOpen() && op.getAttribute('aria-expanded') === 'false' && !$('#pnbStatusBar').hasClass('sb-pop-open') && !document.body.classList.contains('sb-tips-suppressed'), state());

    // C8 - the card's button opens the panel (and never toggles it shut).
    closeAll();
    op.click();
    await sleep(30);
    var btn = $1('#sbColsSettings');
    if (btn) btn.click();
    await sleep(60);
    var p8 = panelOpen(), c8 = cardOpen(), e8 = op.getAttribute('aria-expanded');
    op.click();
    await sleep(30);
    if (btn) btn.click();
    await sleep(60);
    var p8b = panelOpen();
    closeAll();
    rec('C8 "Open the Column & Settings panel..." in the card opens the panel and closes the card; pressed again with the panel open, the panel stays open',
      !!btn && /Open the Column & Settings panel/.test(btn.textContent) && p8 && !c8 && e8 === 'false' && p8b,
      'btn=' + (btn && btn.textContent) + ' panel=' + p8 + ' card=' + c8 + ' expanded=' + e8 + ' again=' + p8b);

    // C9 - an open card follows a column change.
    op.click();
    await sleep(30);
    var th5 = $1('#tableHeader th[data-colname="C05"]');
    if (th5) th5.style.display = 'none';
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(40);
    var s9 = L('shown').value, h9 = line('hidden');
    if (th5) th5.style.display = '';
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(40);
    var s9b = L('shown').value, h9b = line('hidden');
    closeAll();
    rec('C9 an open card follows a column change: Showing counts one fewer and a Hidden line names it; both go back with the column',
      !!th5 && /^\d+ of \d+$/.test(s9 || '') && !!h9 && h9.value === 'C05' && h9.on && /^all \d+$/.test(s9b || '') && !h9b,
      'hidden: shown=' + s9 + ' line=' + JSON.stringify(h9) + ' | back: shown=' + s9b + ' line=' + JSON.stringify(h9b));

    // C10 - one card at a time.
    closeAll();
    $('#sbSnapshot').css('display', 'inline-flex');
    op.click(); await sleep(30);
    $1('#sbFrozen').click(); await sleep(30);
    var a1 = !cardOpen() && $('#sbColsSeg').hasClass('sb-frz-open') && op.getAttribute('aria-expanded') === 'false';
    op.click(); await sleep(30);
    var a2 = cardOpen() && !$('#sbColsSeg').hasClass('sb-frz-open') && $('#sbFrozen').attr('aria-expanded') === 'false';
    $1('#sbSnapshot').click(); await sleep(30);
    var a3 = !cardOpen() && $('#sbColsSeg').hasClass('sb-snap-open');
    op.click(); await sleep(30);
    var a4 = cardOpen() && !$('#sbColsSeg').hasClass('sb-snap-open');
    document.body.click(); await sleep(30);
    var a5 = !cardOpen() && op.getAttribute('aria-expanded') === 'false';
    $('#sbSnapshot').css('display', 'none');
    closeAll();
    rec('C10 one card at a time: the frozen and snapshot chips take over from it, the count takes over from them, a click elsewhere shuts it',
      a1 && a2 && a3 && a4 && a5, 'frozenTakes=' + a1 + ' countTakes=' + a2 + ' snapTakes=' + a3 + ' countTakesBack=' + a4 + ' outside=' + a5);

    // C11 - Escape.
    op.click(); await sleep(30);
    if (btn) btn.focus();
    var f11 = document.activeElement === btn;
    var ev11 = key(document.activeElement, 'Escape');
    await sleep(20);
    rec('C11 Escape closes the card and puts focus back on the count',
      f11 && !cardOpen() && ev11.defaultPrevented && document.activeElement === op && op.getAttribute('aria-expanded') === 'false',
      'focusedIn=' + f11 + ' prevented=' + ev11.defaultPrevented + ' focus=' + (document.activeElement && document.activeElement.id) + ' ' + state());
    closeAll();

    // C12 - keys on the count.
    op.focus();
    var k1 = key(op, 'Enter'), o1 = cardOpen(), x1 = op.getAttribute('aria-expanded');
    var k2 = key(op, ' '), o2 = cardOpen();
    closeAll();
    rec('C12 Enter on the count opens the card and Space closes it again; the panel never opens',
      k1.defaultPrevented && o1 && x1 === 'true' && k2.defaultPrevented && !o2 && !panelOpen(),
      'Enter prevented=' + k1.defaultPrevented + ' card=' + o1 + ' expanded=' + x1 + '; Space prevented=' + k2.defaultPrevented + ' card=' + o2 + ' panel=' + panelOpen());

    // C20 (round 2) - Enter on the snapshot chip with the Columns card open: the card gives
    // way (the key path stacked the two cards at one spot; a click already closed it)
    closeAll();
    $('#sbSnapshot').css('display', 'inline-flex');
    op.click(); await sleep(30);
    var o20 = cardOpen();
    var k20 = key($1('#sbSnapshot'), 'Enter');
    await sleep(30);
    var c20 = !cardOpen() && $('#sbColsSeg').hasClass('sb-snap-open') && op.getAttribute('aria-expanded') === 'false';
    $('#sbColsSeg').removeClass('sb-snap-open');
    $('#sbSnapshot').css('display', 'none');
    closeAll();
    rec('C20 Enter on the snapshot chip with the Columns card open: the Columns card gives way to the snapshot card (one card at a time from the keyboard too)',
      o20 && k20.defaultPrevented && c20, 'opened=' + o20 + ' snapKeyPrevented=' + k20.defaultPrevented + ' result=' + c20);

    // C21 (round 2) - the panel button goes with the card: focus lands in the panel
    closeAll();
    op.click(); await sleep(30);
    $1('#sbColsSettings').focus();
    $1('#sbColsSettings').click(); await sleep(60);
    var f21 = document.activeElement && document.activeElement.id;
    closeAll();
    rec('C21 "Open the Column & Settings panel..." hands focus to the panel\'s close button, not the page\'s body', f21 === 'settingsPanelClose', 'focus=' + f21);

    // C22 (round 2) - a header emptied without a new count (a dismissed import): the click
    // re-reads the table and, with no columns, opens the panel - not an empty card
    closeAll();
    var hdr = $1('#tableHeader'), kids = Array.prototype.slice.call(hdr.childNodes);
    kids.forEach(function (n) { hdr.removeChild(n); });
    var stale = seg.classList.contains('sb-cl-ready');
    op.click(); await sleep(40);
    var c22 = panelOpen() && !cardOpen() && !seg.classList.contains('sb-cl-ready') && !op.hasAttribute('aria-haspopup');
    closeAll();
    kids.forEach(function (n) { hdr.appendChild(n); });
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(40);
    var back22 = seg.classList.contains('sb-cl-ready');
    rec('C22 a header emptied without a new count: the click re-reads the table and, with no columns, opens the panel (no empty card); the offer comes back with the columns',
      stale && c22 && back22, 'staleReady=' + stale + ' clickPanel=' + c22 + ' readyAgain=' + back22);

    // C23 (round 2) - the count follows a column change that never touches #resultCount
    // (a column hidden while a pivot is on screen): penumbra:columns-changed re-reads it
    var th23 = $1('#tableHeader th[data-colname="C05"]'), before23 = $.trim($('#sbCols').text());
    if (th23) th23.style.display = 'none';
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(30);
    var after23 = $.trim($('#sbCols').text());
    if (th23) th23.style.display = '';
    document.dispatchEvent(new CustomEvent('penumbra:columns-changed'));
    await sleep(30);
    var back23 = $.trim($('#sbCols').text()), m23 = /^(\d+) of (\d+)$/.exec(before23);
    rec('C23 the Cols count follows a column change that never touches the row count (penumbra:columns-changed): one fewer, then back',
      !!th23 && !!m23 && after23 === (Number(m23[1]) - 1) + ' of ' + m23[2] && back23 === before23, 'before=' + before23 + ' hidden=' + after23 + ' back=' + back23);

    // C13 - nothing frozen, no layout of this browser's own: those two lines read none.
    var f13 = null, c13 = null, chips13 = '';
    if (FF) {
      FF.set(0, 0);
      await refresh();
      chips13 = 'frozenChip=' + shown($1('#sbFrozen')) + ' customChip=' + shown($1('#sbCustomCols'));
      op.click(); await sleep(30);
      f13 = line('frozen'); c13 = line('custom');
      closeAll();
      FF.set(0, 2);
      await refresh();
    }
    rec('C13 with nothing frozen and no layout of this browser\'s own (both chips gone), the Frozen and Custom layout lines read none, muted',
      !!f13 && !f13.on && f13.value === 'none' && !!c13 && !c13.on && c13.value === 'none' && chips13 === 'frozenChip=false customChip=false',
      chips13 + ' frozen=' + JSON.stringify(f13) + ' custom=' + JSON.stringify(c13));

    // C14 - "no pivot" where a pivot means something.
    window._reportDefaultPivot = { rows: ['C01'], cols: [], vals: 'AMOUNT', agg: ['sum'] };
    await refresh();
    // (round 2) ...and its hover says what a click does there: the card that restores it
    var raTitle = pivEl.getAttribute('title') || '';
    var ra = shown(pivEl) && $(pivEl).hasClass('sb-off') && /no pivot/.test(pivEl.textContent) && raTitle.indexOf('This report’s default is a pivot view - click to restore it') === 0;
    op.click(); await sleep(30);
    var la = L('pivot').value;
    closeAll();
    window._reportDefaultPivot = null;
    await refresh();
    var ra2 = !shown(pivEl);
    var P = window.PenumbraPresets, rb = false, rb2 = false, rb3 = false;
    if (P) {
      P.save(P.NS.PIVOT, null, 'P1', { rows: ['C01'], cols: [], vals: 'AMOUNT', agg: ['sum'] });
      window._pnbSyncPivotStatusChip();
      rb = shown(pivEl);
      P.remove(P.NS.PIVOT, null, 'P1');
      window._pnbSyncPivotStatusChip();
      rb2 = !shown(pivEl);
      await refresh();
      rb3 = !shown(pivEl);
    }
    rec('C14 "no pivot" shows where a pivot means something - the report saved with one (its line says so), pivot presets in this browser - and goes again with them',
      ra && la === 'none (the report’s default is a pivot)' && ra2 && rb && rb2 && rb3,
      'default: chip=' + ra + ' title=[' + raTitle + '] line=' + la + ' gone=' + ra2 + ' | presets(' + !!P + '): saved=' + rb + ' removed=' + rb2 + ' afterRefresh=' + rb3);

    // C15 - a pivot on screen, then the table again (LAST of the pivot checks: from
    // here on this page has had a pivot, which keeps "no pivot" up).
    var rc1 = false, lc1 = null, rc2 = false, lc2 = null;
    if (H.setPivot) {
      H.setPivot({ rows: ['C01', 'C02'], cols: ['C03'], vals: 'AMOUNT', agg: ['sum', 'count'] });
      $('#pivot-output-container').show();
      await refresh();
      rc1 = shown(pivEl) && /pivot 2×1×2/.test(pivEl.textContent) && !$(pivEl).hasClass('sb-off');
      var t15 = $.trim(pivEl.textContent);
      op.click(); await sleep(30);
      lc1 = line('pivot');
      closeAll();
      $('#pivot-output-container').hide();
      await refresh();
      rc2 = shown(pivEl) && $(pivEl).hasClass('sb-off');
      op.click(); await sleep(30);
      lc2 = line('pivot');
      closeAll();
      H.setPivot(null);
    }
    rec('C15 a pivot on screen: the chip and the line give its shape; back on the table "no pivot" stays for the rest of the page (the way back to it) and the line reads none',
      rc1 && !!lc1 && lc1.on && lc1.value === '2 rows × 1 column × 2 values' && rc2 && !!lc2 && !lc2.on && lc2.value === 'none',
      'on screen: chip=' + rc1 + ' [' + (typeof t15 === 'string' ? t15 : '') + '] line=' + JSON.stringify(lc1) + ' | after: chip=' + rc2 + ' [' + $.trim(pivEl.textContent) + '] line=' + JSON.stringify(lc2));

    // C16 - nested columns.
    await runQuery(makeRows(12, true));
    var rn = shown(nestEl) && $.trim(nestEl.textContent) === '1 nested';
    op.click(); await sleep(30);
    var ln = line('nested');
    closeAll();
    nestEl.click(); await sleep(30);
    var viaChip = cardOpen();
    closeAll();
    await runQuery(makeRows(12));
    var rn2 = !shown(nestEl);
    rec('C16 nested columns: "1 nested" shows and the line names the column; that chip (no card of its own) opens the card; without them the chip goes',
      rn && !!ln && ln.on && ln.value === '1: C03' && viaChip && rn2,
      'chip=' + rn + ' [' + $.trim(nestEl.textContent) + '] line=' + JSON.stringify(ln) + ' viaChip=' + viaChip + ' goneAfter=' + rn2);

    // C17 - grouping and Rows = None read through.
    var g = null, t = null, fz = null;
    if (H.setGroup) {
      H.setGroup('C04');
      document.body.classList.add('group-mode-active', 'pnb-data-hidden');
      op.click(); await sleep(30);
      g = line('group'); t = line('table'); fz = line('frozen');
      closeAll();
      H.setGroup(null);
      document.body.classList.remove('group-mode-active', 'pnb-data-hidden');
    }
    rec('C17 a grouped view and Rows = None: "by C04" and "hidden (Rows: None)" in use, Frozen "not in this view"',
      !!g && g.on && g.value === 'by C04' && !!t && t.on && t.value === 'hidden (Rows: None)' && !!fz && !fz.on && fz.value === 'not in this view (flat table only)',
      'group=' + JSON.stringify(g) + ' table=' + JSON.stringify(t) + ' frozen=' + JSON.stringify(fz));

    // C18 - a viewer's card, with nothing of those on screen (round 2: a line on screen
    // stays - C24 - so the fixture's freeze is lifted first)
    if (FF) { FF.set(0, 0); await refresh(); }
    var pv = window.penumbra_vars, wasAdmin = pv.isAdmin;
    pv.isAdmin = false; window._penumbraHideColumns = true;
    document.body.classList.add('restrict-pivot', 'restrict-grouping');
    op.click(); await sleep(30);
    var vk = keysOf();
    closeAll();
    pv.isAdmin = wasAdmin; window._penumbraHideColumns = false;
    document.body.classList.remove('restrict-pivot', 'restrict-grouping');
    if (FF) { FF.set(0, 2); await refresh(); }
    rec('C18 a viewer\'s card leaves out what they can never have: Frozen (no Column Organization), Pivot and Grouping (View Options), Earlier version (editors only)',
      vk === 'shown,nested,calc,snap,table,custom', 'keys=' + vk);

    // C24 (round 2) - ...unless it is on screen anyway: a restricted viewer still gets the
    // lines of the report's own pivot, grouping and freeze
    var pv24 = window.penumbra_vars, was24 = pv24.isAdmin, l24p = null, l24g = null, l24f = null;
    pv24.isAdmin = false; window._penumbraHideColumns = true;
    document.body.classList.add('restrict-pivot', 'restrict-grouping');
    op.click(); await sleep(30);
    l24f = line('frozen');   // the flat table, 2 frozen (the fixture)
    closeAll();
    if (H.setPivot) {
      H.setPivot({ rows: ['C01'], cols: [], vals: 'AMOUNT', agg: ['sum'] });
      $('#pivot-output-container').show();
      op.click(); await sleep(30);
      l24p = line('pivot');
      closeAll();
      $('#pivot-output-container').hide();
      H.setPivot(null);
    }
    if (H.setGroup) {
      H.setGroup('C04'); document.body.classList.add('group-mode-active');
      op.click(); await sleep(30);
      l24g = line('group');
      closeAll();
      H.setGroup(null); document.body.classList.remove('group-mode-active');
    }
    pv24.isAdmin = was24; window._penumbraHideColumns = false;
    document.body.classList.remove('restrict-pivot', 'restrict-grouping');
    await refresh();
    rec('C24 ...unless it is on screen anyway: a restricted viewer still gets the lines of the report\'s pivot, its grouping and its freeze',
      !!l24p && l24p.on && /^1 row /.test(l24p.value) && !!l24g && l24g.on && l24g.value === 'by C04' && !!l24f && l24f.on && /^2: /.test(l24f.value),
      'pivot=' + JSON.stringify(l24p) + ' group=' + JSON.stringify(l24g) + ' frozen=' + JSON.stringify(l24f));

    // C19 - the repository page.
    document.body.classList.add('pnb-repo-mode');
    await refresh();
    var r1 = !seg.classList.contains('sb-cl-ready') && !op.hasAttribute('aria-haspopup') && !op.hasAttribute('aria-expanded') && !op.hasAttribute('aria-controls') && !shown(caret);
    op.click(); await sleep(40);
    var r2 = panelOpen() && !cardOpen();
    closeAll();
    document.body.classList.remove('pnb-repo-mode');
    await refresh();
    var r3 = seg.classList.contains('sb-cl-ready') && op.getAttribute('aria-expanded') === 'false';
    rec('C19 on the repository page the count stays the panel\'s opener (no caret, no popup attributes, a click opens the panel); on a report it is the card\'s again',
      r1 && r2 && r3, 'repo: plain=' + r1 + ' click->panel=' + r2 + ' | report again: ready=' + r3);

    // C25 (round 2) - the card stays inside the window: the Cols segment pushed near the
    // right edge (a narrow window), the card shifts left and its arrow stays on the count
    closeAll();
    var segR = seg.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    seg.style.marginLeft = Math.max(0, Math.round(vw - segR.left - 140)) + 'px';
    op.click(); await sleep(40);
    var pop25 = $1('#sbColsPop'), pr = pop25.getBoundingClientRect(), opr = op.getBoundingClientRect();
    var arrow = pop25.style.getPropertyValue('--sb-cl-arrow');
    var inside = pr.right <= vw - 8 + 0.5 && pr.left >= 8 - 0.5;
    var arrowX = pr.left + parseFloat(arrow || '22');
    var onCount = arrowX >= opr.left - 4 && arrowX <= opr.right + 4;
    closeAll();
    seg.style.marginLeft = '';
    op.click(); await sleep(30);
    var reset = $1('#sbColsPop').style.left === '';
    closeAll();
    rec('C25 the card stays inside the window: with the Cols segment near the right edge it shifts left, its arrow still on the count; back in place, no shift',
      inside && !!arrow && onCount && reset,
      'card ' + Math.round(pr.left) + '-' + Math.round(pr.right) + ' of ' + vw + ' arrow=' + arrow + ' arrowX=' + Math.round(arrowX) + ' count ' + Math.round(opr.left) + '-' + Math.round(opr.right) + ' resetAfter=' + reset);
  }

  // ------------------------------------------------------------------------
  async function scnCalc() {
    var op = $1('#sbColsOpen');
    if (H.setName) H.setName('repK');
    await runQuery(makeRows(12));
    await sleep(800);   // the module settles its columns after the table is built
    var chip = $1('#sbCalcChip');
    op.click(); await sleep(30);
    var lc = line('calc'), ls = line('shown'), cnt = countAsLine();
    rec('K1 a calculated column: its line names it (in use), the count and the Showing line leave it out, the "+1 calculated" chip shows',
      !!lc && lc.on && lc.value === '1: HALF' && !!ls && ls.value === cnt && !/HALF/.test(ls.value) && !!chip && shown(chip) && $.trim(chip.textContent) === '+1 calculated',
      'calc=' + JSON.stringify(lc) + ' shown=' + JSON.stringify(ls) + ' count=' + cnt + ' chip=' + (chip && shown(chip)) + ' [' + (chip && chip.textContent) + ']');
    // The calc chip's popover takes over from the card.
    if (chip) chip.click();
    await sleep(60);
    var pop = $1('#pnbCalcPop');
    var k2 = !cardOpen() && !!pop && shown(pop) && op.getAttribute('aria-expanded') === 'false';
    rec('K2 the calc chip\'s popover takes over from the open Columns card', k2, 'card=' + cardOpen() + ' calcPop=' + (pop && shown(pop)) + ' expanded=' + op.getAttribute('aria-expanded'));
    // ...and its "list" button opens the panel, not the card.
    var lb = $1('#pnbCalcPop [data-calc-poplist]');
    closePanel();
    if (lb) lb.click();
    await sleep(80);
    var k3 = !!lb && panelOpen() && !cardOpen();
    rec('K3 the calc popover\'s "Open the Settings panel list" opens the panel (it used to click the count, which opens the card now)', k3,
      'button=' + !!lb + ' panel=' + panelOpen() + ' card=' + cardOpen());
    closeAll();

    // K4 (round 2) - the calc popover's buttons wear the bar cards' dress in every theme:
    // the card button (#sbColsSettings) is the reference - its surface, border, ink and
    // weight; no theme fill, no global margin. Themes by their body classes (main.css
    // holds the `.theme-x button` blanket rules that used to show through).
    var themes = [[], ['theme-wolfpack'], ['theme-dark-blue', 'is-dark']], bad4 = [], seen4 = [];
    for (var ti = 0; ti < themes.length; ti++) {
      themes[ti].forEach(function (c) { document.body.classList.add(c); });
      closeAll();
      op.click(); await sleep(20);
      var ref = getComputedStyle($1('#sbColsSettings'));
      var refv = { bg: ref.backgroundColor, color: ref.color, bc: ref.borderTopColor, fw: ref.fontWeight };
      closeAll();
      if (chip) chip.click();
      await sleep(60);
      var pop4 = $1('#pnbCalcPop');
      var foot = pop4 ? pop4.querySelectorAll('.pnb-calc-pop-foot button') : [], row = pop4 ? pop4.querySelectorAll('.pnb-calc-pop-btns button') : [];
      var x = pop4 ? pop4.querySelector('.pnb-calc-pop-x') : null;
      var name = themes[ti].join('+') || 'no theme';
      if (!pop4 || foot.length !== 2 || row.length < 3 || !x) bad4.push(name + ': popover/buttons missing');
      Array.prototype.forEach.call(foot, function (b) {
        var cs = getComputedStyle(b);
        var ok = cs.backgroundColor === refv.bg && cs.color === refv.color && cs.borderTopColor === refv.bc && cs.borderTopWidth === '1px' &&
          cs.borderTopStyle === 'solid' && cs.borderTopLeftRadius === '6px' && cs.marginTop === '0px' && cs.fontWeight === refv.fw && cs.fontSize === '12px';
        if (!ok) bad4.push(name + ' foot "' + b.textContent.trim() + '": bg ' + cs.backgroundColor + ' vs ' + refv.bg + ', ink ' + cs.color + ' vs ' + refv.color + ', border ' + cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor + ', radius ' + cs.borderTopLeftRadius + ', mt ' + cs.marginTop + ', fw ' + cs.fontWeight + ', fs ' + cs.fontSize);
      });
      Array.prototype.forEach.call(row, function (b) {
        var cs = getComputedStyle(b);
        var ok = cs.backgroundColor === refv.bg && cs.color === refv.color && cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' &&
          cs.borderTopLeftRadius === '5px' && cs.marginTop === '0px' && cs.fontWeight === refv.fw;
        if (!ok) bad4.push(name + ' row "' + b.textContent.trim() + '": bg ' + cs.backgroundColor + ', border ' + cs.borderTopWidth + ' ' + cs.borderTopStyle + ', radius ' + cs.borderTopLeftRadius + ', mt ' + cs.marginTop + ', fw ' + cs.fontWeight);
      });
      if (x) { var xs = getComputedStyle(x); if (xs.backgroundColor !== 'rgba(0, 0, 0, 0)' || xs.marginTop !== '0px') bad4.push(name + ' close x: bg ' + xs.backgroundColor + ', mt ' + xs.marginTop); }
      seen4.push(name + ' ref ' + refv.bg + '/' + refv.color);
      closeAll();
      themes[ti].forEach(function (c) { document.body.classList.remove(c); });
    }
    rec('K4 the calc popover\'s buttons wear the status bar cards\' dress in every theme (no theme, Wolfpack, Dark Blue): the card button\'s surface, ink, border and weight; 6px corners in the foot, 5px on the rows; no global margin; a bare close x',
      bad4.length === 0, (bad4.length ? bad4.slice(0, 6).join(' | ') : 'ok') + ' || ' + seen4.join(' ; '));

    // K5 (round 2) - a snapshot on screen: its columns are data, none calculated - the card's
    // Calculated and Showing lines agree with the count, the calc chip hidden
    var k5 = null;
    if (H.setSnap) {
      H.setSnap(true);
      await refresh();
      op.click(); await sleep(30);
      k5 = { calc: line('calc'), shown: line('shown'), count: countAsLine(), chip: shown($1('#sbCalcChip')) };
      closeAll();
      H.setSnap(false);
      await refresh();
    }
    rec('K5 on a snapshot (or an imported file) the card says no calculated columns and counts the columns as the bar does; the calc chip is hidden',
      !!k5 && !!k5.calc && !k5.calc.on && k5.calc.value === 'none' && !!k5.shown && k5.shown.value === k5.count && !k5.chip, JSON.stringify(k5));
  }

  // ?scn=shot[&dark=1]: no checks - the card open over a realistic bar, for a
  // headless --screenshot (a nested column, two frozen, one column hidden).
  async function scnShot() {
    if (/[?&]dark=1/.test(location.search)) document.body.classList.add('theme-dark-blue', 'is-dark');
    var tm = /[?&]theme=([a-z-]+)/.exec(location.search);
    if (tm) document.body.classList.add('theme-' + tm[1]);
    if (H.setName) H.setName('repS');
    await runQuery(makeRows(12, true));
    if (FF) FF.set(0, 2);
    await refresh();
    var th = $1('#tableHeader th[data-colname="C06"]');
    if (th) th.style.display = 'none';
    // &calcpop=1 (with &calc=...): the calc chip's popover instead of the Columns card
    if (/[?&]calcpop=1/.test(location.search) && $1('#sbCalcChip')) { await sleep(600); $1('#sbCalcChip').click(); }
    else $1('#sbColsOpen').click();
    await sleep(80);
    document.getElementById('out').textContent = 'SHOT';
  }

  (async function () {
    if (SCN === 'shot') { try { await scnShot(); } catch (e) { document.getElementById('out').textContent = 'shot threw: ' + e; } return; }
    try {
      var hookOk = !!H.getEditor;
      if (!hookOk) rec('S0 the page booted: the export hook is there', false, 'hook=' + JSON.stringify(Object.keys(H)) + ' err=' + window.__CLC_ERR);
      if (SCN === 'calc') await scnCalc(); else await scnMain();
      var pe = errs();
      rec('Z1 no page errors along the way', pe.length === 0, pe.slice(0, 4).join(' | '));
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
