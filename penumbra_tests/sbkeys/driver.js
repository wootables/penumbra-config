// Status-bar keys - browser half (2026-10-01). Drives the REAL main.js (ready
// closure unwrapped, window.__SBK export hook) with the status bar's Data,
// query-time and Cols segments LIFTED from the index.php under test (run.ps1).
//   E  Enter / Space in the Cols segment: the Column & Settings panel opens from
//      its two openers only (the Cols count, the gear); every chip and every
//      control inside a chip's card keeps its own keys
//   X  Escape closes the open card - every card of the bar - hands focus back to
//      its trigger and goes no further; it stands aside with no card open, for a
//      modifier'd Escape, and for the pop-out console's replay onto the document
// A synthetic keydown fires no native click, so what phase E can see is that
// nothing above a control took its key (preventDefault, the panel). That the
// control's own click then really fires is real_keys.py's job (real key presses
// over CDP).
(function () {
  var R = [];
  function rec(name, pass, detail) { R.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail).slice(0, 600) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function errs() { return window.__errors.concat(window.__rejections); }
  function finish(fatal) {
    var payload = { results: R, pageErrors: errs().slice(0, 8), hookErr: [window.__SBK_ERR, window.__SBK_ERR2, (window.__SBK_MISSING || []).join(',')].filter(Boolean).join('; ') };
    if (fatal) payload.fatal = fatal;
    document.getElementById('out').textContent = 'RESULTS_JSON:' + JSON.stringify(payload);
  }
  if (typeof window.stackHeaders !== 'function') window.stackHeaders = function () {};

  var H = window.__SBK || {};
  var FF = (window.Penumbra && window.Penumbra.flatFreeze) || null;

  var CODES = { 'Enter': 13, ' ': 32, 'Escape': 27 };
  function key(el, k, mods) {
    var o = { key: k, code: k === ' ' ? 'Space' : k, keyCode: CODES[k], which: CODES[k], bubbles: true, cancelable: true };
    if (mods) { for (var m in mods) o[m] = mods[m]; }
    var ev = new KeyboardEvent('keydown', o);
    el.dispatchEvent(ev);
    return ev;
  }
  function $1(sel) { return document.querySelector(sel); }
  function shown(el) { return !!el && getComputedStyle(el).display !== 'none'; }
  function panelOpen() { return $('#settingsPanel').hasClass('is-open'); }
  function closePanel() { $('#settingsPanel').removeClass('is-open'); $('#settingsPanelOverlay').removeClass('is-open'); }
  function colsCard(cls, pop) { return $('#sbColsSeg').hasClass(cls) && shown(document.getElementById(pop)); }
  function segCard(seg, pop) { return $('#' + seg).hasClass('sb-open') && shown(document.getElementById(pop)); }
  function focusId() { var a = document.activeElement; return a ? (a.id || (a.getAttribute('data-n') ? 'n' + a.getAttribute('data-n') : a.tagName)) : 'none'; }
  // Every card shut and the panel closed - the way a click elsewhere does it,
  // then by hand for anything that click leaves (no card handler is under test here).
  function closeAll() {
    $(document.body).trigger('click');
    $('#sbColsSeg').removeClass('sb-cc-open sb-pp-open sb-grp-open sb-frz-open sb-snap-open sb-asof-open');
    $('#sbDataSeg, #sbLoadSeg, #sbUserSeg').removeClass('sb-open');
    $('#pnbStatusBar').removeClass('sb-pop-open');
    document.body.classList.remove('sb-tips-suppressed');
    $('#sbUserPop .pnb-admmenu').removeClass('open');
    closePanel();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  // The chips that only show in states this page does not build (a grouped
  // view, a custom layout, a snapshot, a version preview, Rows = None) are put
  // on screen by hand: their keys are what is under test, not when they show.
  function forceChips() {
    $('#sbGroup, #sbCustomCols, #sbSnapshot, #sbAsOf, #sbTableHidden').css('display', 'inline-flex');
    $('#sbCustomColsSave').show();
  }
  // Counts the keys that get past their target all the way to the document
  // (bubble phase) - what a chip's stopPropagation() is there to prevent.
  var bubbled = [];
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') bubbled.push(e.target.id || e.target.tagName); });

  var COLS = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'AMOUNT'];
  function makeRows(n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var row = {};
      for (var c = 0; c < COLS.length; c++) row[COLS[c]] = (COLS[c] === 'AMOUNT') ? String(i * 100) : ('value ' + COLS[c] + ' row ' + i);
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
    await sleep(400);
  }
  // A flat table on screen with two columns frozen, so the frozen chip shows;
  // the bar's own refresh (60 ms after #resultCount changes) settled.
  async function setup() {
    if (H.setName) H.setName('repK');
    await runQuery(makeRows(12));
    if (FF) FF.set(0, 2);
    await sleep(200);
    forceChips();
  }

  // ------------------------------------------------------------------------
  // E. Enter / Space in the Cols segment.
  async function phaseE() {
    var seg = $1('#sbColsSeg'), opener = $1('#sbColsOpen'), gear = $1('#sbColsSeg .sb-cols-gear-wrap');
    if (!seg || !opener || !gear || !$1('#sbCustomColsPop')) { rec('E0 the Cols segment, its two openers and its cards are on the page', false, 'lift found no Cols segment'); return; }

    // E1 - the panel's own openers keep working from the keyboard.
    closeAll();
    var a = key(opener, 'Enter'), o1 = panelOpen();
    var b = key(opener, 'Enter'), o2 = panelOpen();
    var c = key(gear, ' '), o3 = panelOpen();
    var d = key(gear, 'Enter'), o4 = panelOpen();
    rec('E1 Enter and Space on the panel\'s two openers - the Cols count and the gear - open and close the Column & Settings panel',
      a.defaultPrevented && o1 && b.defaultPrevented && !o2 && c.defaultPrevented && o3 && d.defaultPrevented && !o4,
      'cols Enter ' + a.defaultPrevented + '/' + o1 + ', again ' + b.defaultPrevented + '/' + o2 + '; gear Space ' + c.defaultPrevented + '/' + o3 + ', Enter ' + d.defaultPrevented + '/' + o4);

    // E2 - every button inside every card keeps its keys. Each card is opened
    // the way its chip opens it, so lists the chip renders (the grouping card's
    // columns) are there too; the pivot card by its class (with no presets, the
    // chip goes straight to the pivot builder instead).
    var cards = [
      ['frozen', 'sbFrozenPop', function () { $('#sbFrozen').trigger('click'); }],
      ['pivot', 'sbPivotPop', function () { $('#sbColsSeg').addClass('sb-pp-open'); }],
      ['grouping', 'sbGroupPop', function () { $('#sbGroup').trigger('click'); }],
      ['custom', 'sbCustomColsPop', function () { $('#sbCustomCols').trigger('click'); }],
      ['snapshot', 'sbSnapshotPop', function () { $('#sbSnapshot').trigger('click'); }],
      ['as-of', 'sbAsOfPop', function () { $('#sbAsOf').trigger('click'); }]
    ];
    var taken = [], n = 0, per = [];
    cards.forEach(function (cd) {
      closeAll(); forceChips();
      cd[2]();
      var btns = $('#' + cd[1] + ' button').toArray(), bad = 0;
      btns.forEach(function (btn) {
        ['Enter', ' '].forEach(function (k) {
          var ev = key(btn, k);
          n++;
          if (ev.defaultPrevented || panelOpen()) { bad++; taken.push(cd[0] + ':' + (btn.id || btn.className.split(' ')[0]) + ':' + (k === ' ' ? 'Space' : k) + (panelOpen() ? '+panel' : '')); }
          closePanel();
        });
      });
      per.push(cd[0] + ' ' + (btns.length * 2 - bad) + '/' + (btns.length * 2));
    });
    rec('E2 Enter and Space on every button inside every card of the Cols segment are left to the button: never prevented, the panel never opens',
      taken.length === 0 && n >= 60, 'keys=' + n + ' [' + per.join(', ') + '] taken: ' + taken.slice(0, 12).join(' ') + (taken.length > 12 ? ' +' + (taken.length - 12) : ''));

    // E3 - the custom-layout chip: its card, nothing else.
    closeAll(); forceChips();
    bubbled.length = 0;
    var e3 = key($1('#sbCustomCols'), 'Enter');
    var e3card = colsCard('sb-cc-open', 'sbCustomColsPop'), e3panel = panelOpen(), e3up = bubbled.slice();
    rec('E3 Enter on the custom-layout chip opens its card and nothing else: not the panel, and the key stops at the chip',
      e3.defaultPrevented && e3card && $('#sbCustomCols').attr('aria-expanded') === 'true' && !e3panel && e3up.length === 0,
      'prevented=' + e3.defaultPrevented + ' card=' + e3card + ' expanded=' + $('#sbCustomCols').attr('aria-expanded') + ' panel=' + e3panel + ' reachedDocument=[' + e3up.join(',') + ']');

    // E5 - the snapshot chip: it had no keys of its own at all.
    closeAll(); forceChips();
    var e5a = key($1('#sbSnapshot'), 'Enter'), s1 = colsCard('sb-snap-open', 'sbSnapshotPop'), p1 = panelOpen();
    var e5b = key($1('#sbSnapshot'), ' '), s2 = colsCard('sb-snap-open', 'sbSnapshotPop'), p2 = panelOpen();
    rec('E5 Enter on the snapshot chip opens its card (it was mouse-only) and Space closes it again; the panel never opens',
      e5a.defaultPrevented && s1 && !p1 && e5b.defaultPrevented && !s2 && !p2,
      'Enter prevented=' + e5a.defaultPrevented + ' card=' + s1 + ' panel=' + p1 + '; Space prevented=' + e5b.defaultPrevented + ' card=' + s2 + ' panel=' + p2);

    // E6 - chips that already had keys of their own (the control).
    var e6 = [];
    [['#sbFrozen', 'sb-frz-open', 'sbFrozenPop'], ['#sbGroup', 'sb-grp-open', 'sbGroupPop'], ['#sbAsOf', 'sb-asof-open', 'sbAsOfPop']].forEach(function (ch) {
      closeAll(); forceChips();
      var ev = key($1(ch[0]), 'Enter');
      e6.push(ch[0] + ':' + ev.defaultPrevented + '/' + colsCard(ch[1], ch[2]) + '/' + (panelOpen() ? 'PANEL' : 'shut'));
    });
    rec('E6 Enter on the frozen, grouping and as-of chips opens each one\'s card and never the panel',
      e6.join(' ') === '#sbFrozen:true/true/shut #sbGroup:true/true/shut #sbAsOf:true/true/shut', e6.join(' '));

    // E4 - the "show table" chip, LAST: bringing the table back re-renders it,
    // and the bar's refresh then hides the chips this page put up by hand.
    closeAll(); forceChips();
    bubbled.length = 0;
    var changes = 0;
    $('#rowsPerPageSelector').on('change.sbk', function () { changes++; });
    var e4 = key($1('#sbTableHidden'), 'Enter');
    $('#rowsPerPageSelector').off('change.sbk');
    var e4panel = panelOpen(), e4up = bubbled.slice();
    rec('E4 Enter on the "show table" chip brings the table back and nothing else: not the panel, and the key stops at the chip',
      e4.defaultPrevented && changes === 1 && !e4panel && e4up.length === 0,
      'prevented=' + e4.defaultPrevented + ' rowsChange=' + changes + ' panel=' + e4panel + ' reachedDocument=[' + e4up.join(',') + ']');
    await sleep(300);
    closeAll(); forceChips();
  }

  // ------------------------------------------------------------------------
  // X. Escape.
  async function phaseX() {
    var specs = [
      { name: 'Data', open: function () { $('#sbDataSeg').trigger('click'); }, isOpen: function () { return segCard('sbDataSeg', 'sbDataPop'); }, trigger: '#sbDataSeg', focus: '#sbDataSeg', expanded: '#sbDataSeg' },
      { name: 'query-time', open: function () { $('#sbLoadSeg').trigger('click'); }, isOpen: function () { return segCard('sbLoadSeg', 'sbLoadPop'); }, trigger: '#sbLoadSeg', focus: '#sbLoadSeg', expanded: '#sbLoadSeg' },
      { name: 'profile', open: function () { $('#sbUserBtn').trigger('click'); }, isOpen: function () { return segCard('sbUserSeg', 'sbUserPop'); }, trigger: '#sbUserBtn', focus: '#sbHomeLink', expanded: '#sbUserBtn' },
      { name: 'frozen-columns', open: function () { $('#sbFrozen').trigger('click'); }, isOpen: function () { return colsCard('sb-frz-open', 'sbFrozenPop'); }, trigger: '#sbFrozen', focus: '#sbFrozenCounts .sb-frz-n[data-n="1"]', expanded: '#sbFrozen' },
      // No presets: the chip goes to the builder, so the card is opened the way
      // its opener leaves the page (class, aria-expanded, the bar lifted).
      { name: 'pivot', open: function () { $('#sbColsSeg').addClass('sb-pp-open'); $('#sbPivot').attr('aria-expanded', 'true'); $('#pnbStatusBar').addClass('sb-pop-open'); document.body.classList.add('sb-tips-suppressed'); },
        isOpen: function () { return colsCard('sb-pp-open', 'sbPivotPop'); }, trigger: '#sbPivot', focus: '#sbPivotOpenBuilder', expanded: '#sbPivot' },
      { name: 'grouping', open: function () { $('#sbGroup').trigger('click'); }, isOpen: function () { return colsCard('sb-grp-open', 'sbGroupPop'); }, trigger: '#sbGroup', focus: '#sbGrpConfigure', expanded: '#sbGroup' },
      { name: 'custom-layout', open: function () { $('#sbCustomCols').trigger('click'); }, isOpen: function () { return colsCard('sb-cc-open', 'sbCustomColsPop'); }, trigger: '#sbCustomCols', focus: '#sbCustomColsReset', expanded: '#sbCustomCols' },
      { name: 'snapshot', open: function () { $('#sbSnapshot').trigger('click'); }, isOpen: function () { return colsCard('sb-snap-open', 'sbSnapshotPop'); }, trigger: '#sbSnapshot', focus: '#sbSnapManager', expanded: null },
      { name: 'as-of', open: function () { $('#sbAsOf').trigger('click'); }, isOpen: function () { return colsCard('sb-asof-open', 'sbAsOfPop'); }, trigger: '#sbAsOf', focus: '#sbAsOfHistory', expanded: null }
    ];
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      closeAll(); forceChips();
      s.open();
      var opened = s.isOpen();
      var f = $1(s.focus);
      if (f) f.focus();
      var focused = !!f && document.activeElement === f;
      var esc0 = window.__docEsc;
      var ev = key(document.activeElement || document.body, 'Escape');
      var heard = window.__docEsc - esc0;
      var still = s.isOpen(), onTrigger = document.activeElement === $1(s.trigger);
      var exp = s.expanded ? $(s.expanded).attr('aria-expanded') : 'n/a';
      var lift = $('#pnbStatusBar').hasClass('sb-pop-open'), tips = document.body.classList.contains('sb-tips-suppressed');
      rec('X' + (i + 1) + ' Escape closes the ' + s.name + ' card, hands focus back to its trigger, and goes no further',
        opened && focused && !still && ev.defaultPrevented && heard === 0 && onTrigger && (!s.expanded || exp === 'false') && !lift && !tips,
        'opened=' + opened + ' focusedIn=' + focused + ' -> open=' + still + ' prevented=' + ev.defaultPrevented + ' heardBelow=' + heard +
        ' focus=' + focusId() + ' expanded=' + exp + ' barLift=' + lift + ' tipsOff=' + tips);
    }

    // Focus elsewhere: the card closes, focus stays where it is.
    closeAll(); forceChips();
    specs[4].open();
    $1('#tableSearch').focus();
    var e0 = window.__docEsc, ev10 = key(document.activeElement, 'Escape');
    rec('X10 with focus outside the bar, Escape still closes the open card and leaves focus where it was',
      !specs[4].isOpen() && ev10.defaultPrevented && window.__docEsc - e0 === 0 && document.activeElement === $1('#tableSearch'),
      'open=' + specs[4].isOpen() + ' prevented=' + ev10.defaultPrevented + ' heardBelow=' + (window.__docEsc - e0) + ' focus=' + focusId());

    // No card open: the key is main.js's chain's, untouched.
    closeAll();
    var e1 = window.__docEsc, ev11 = key(document.body, 'Escape');
    rec('X11 with no card open, Escape is left to main.js\'s Escape chain', window.__docEsc - e1 === 1, 'heardBelow=' + (window.__docEsc - e1) + ' prevented=' + ev11.defaultPrevented);
    await sleep(450);   // past the chain's double-Escape window

    // A modifier'd Escape is the browser's (Shift+Esc = Chrome's Task Manager).
    closeAll(); forceChips();
    specs[0].open();
    var e2 = window.__docEsc, m1 = key($1('#sbDataSeg'), 'Escape', { shiftKey: true });
    var dataStill = specs[0].isOpen(), heard12 = window.__docEsc - e2;
    closeAll(); forceChips();
    specs[4].open();
    var m2 = key($1('#sbPivotOpenBuilder'), 'Escape', { ctrlKey: true });
    var pivotStill = specs[4].isOpen();
    rec('X12 Shift+Escape and Ctrl+Escape are left alone: the open card stays open and the key goes on, unprevented',
      dataStill && pivotStill && !m1.defaultPrevented && !m2.defaultPrevented && heard12 === 1,
      'data open=' + dataStill + ' prevented=' + m1.defaultPrevented + ' heardBelow=' + heard12 + '; pivot open=' + pivotStill + ' prevented=' + m2.defaultPrevented);

    // The admin-tools menu in the profile card's footer: innermost first.
    closeAll();
    specs[2].open();
    var caret = $1('#sbUserPop .pnb-admsplit-caret'), menu = $1('#sbUserPop .pnb-admmenu');
    caret.click();
    var menu0 = menu.classList.contains('open');
    $1('#sbAdmItem1').focus();
    var e3 = window.__docEsc;
    var k1 = key(document.activeElement, 'Escape');
    var st1 = 'menu=' + menu.classList.contains('open') + ' card=' + specs[2].isOpen() + ' focus=' + (document.activeElement === caret ? 'caret' : focusId()) + ' caretExpanded=' + caret.getAttribute('aria-expanded');
    var ok1 = !menu.classList.contains('open') && specs[2].isOpen() && document.activeElement === caret && caret.getAttribute('aria-expanded') === 'false';
    var k2 = key(document.activeElement, 'Escape');
    var ok2 = !specs[2].isOpen() && document.activeElement === $1('#sbUserBtn');
    rec('X13 in the profile card Escape closes the admin-tools menu first (focus back on its caret, the card stays), then the card (focus back on the avatar)',
      menu0 && k1.defaultPrevented && ok1 && k2.defaultPrevented && ok2 && window.__docEsc - e3 === 0,
      'menuOpened=' + menu0 + ' | 1st: prevented=' + k1.defaultPrevented + ' ' + st1 + ' | 2nd: prevented=' + k2.defaultPrevented + ' card=' + specs[2].isOpen() + ' focus=' + focusId() + ' | heardBelow=' + (window.__docEsc - e3));

    // The popped-out console replays its Escape onto THIS document for the
    // chain (the target is the document itself): never a card's key. (After a
    // pause: an Escape that reached the chain just before would make this one
    // the chain's double-Escape.)
    await sleep(450);
    closeAll(); forceChips();
    specs[4].open();
    var e4 = window.__docEsc;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    var replayOpen = specs[4].isOpen(), heard14 = window.__docEsc - e4;
    closeAll();
    rec('X14 the pop-out console\'s Escape, replayed onto the document, goes to main.js\'s chain even while a card is open',
      replayOpen && heard14 === 1, 'card still open=' + replayOpen + ' heardBelow=' + heard14);
    await sleep(450);
  }

  // ?real=1: real_keys.py drives the page itself over CDP. Hand it the
  // fixture helpers and stand aside.
  if (window.__REAL) {
    (async function () {
      try { await setup(); } catch (e) { window.__errors.push('setup threw: ' + e); }
      window.__drv = { closeAll: closeAll, forceChips: forceChips, panelOpen: panelOpen, colsCard: colsCard, segCard: segCard };
      document.getElementById('out').textContent = 'READY';
    })();
    return;
  }

  (async function () {
    try {
      await setup();
      var hookOk = !!(H.getEditor && FF);
      if (!hookOk) rec('S0 the page booted: the export hook and Penumbra.flatFreeze are there', false, 'hook=' + !!H.getEditor + ' flatFreeze=' + !!FF);
      rec('S1 the fixture: a flat table on screen and the frozen chip showing "2 frozen"',
        !!document.querySelector('#tableHeader th') && shown($1('#sbFrozen')) && /2 frozen/.test($('#sbFrozen').text()),
        'th=' + document.querySelectorAll('#tableHeader th').length + ' chip=' + shown($1('#sbFrozen')) + ' [' + $('#sbFrozen').text().trim() + ']');
      await phaseE();
      await phaseX();
      var pe = errs();
      rec('Z1 no page errors along the way', pe.length === 0, pe.slice(0, 4).join(' | '));
      finish();
    } catch (e) { finish('driver threw: ' + ((e && e.stack) || e)); }
  })();
})();
