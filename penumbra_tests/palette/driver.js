// palette suite - page half (2026-10-20). The command palette (js/penumbra_palette_boot.js +
// js/penumbra_palette.js) on the REAL main.js + the header menu and column modules, the
// saveconf fixture (300 rows; shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS).
//   pcold   the first Ctrl+K on a page that never prefetched: the box at once, keys kept, hand-over
//   pfail   the module file is missing: a plain line, Esc closes, nothing hangs
//   pmain   the "?" sheet row, the empty state, fuzzy ranking + marks, greyed vs hidden, the
//           sections, questions -> Ask, the focus trap, Esc restores focus, recents + Clear all,
//           the registry / menu coverage checks
//   ppick   "Which column?" (the freeze on the first five, never a frozen one), real actions
//           (freeze, unfreeze, sort, hide, show all, a theme), the column's own list, Backspace
//   pview   the authoring gate: a viewer never sees Save / Version history / the admin controls
//           (Save greyed when typed in full); an editor does
//   prow    row-level items only while a cell is selected; Filter to "value" runs
(function () {
  var SCN = window.__SCN;
  var R = { scn: SCN, chk: {}, info: {} }; window.__R = R;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function P() { return window.PenumbraPalette || null; }
  function trace(s) { (window.__TRACE = window.__TRACE || []).push(Math.round(performance.now()) + ' ' + s); }
  // null-safe reads: the control (live, no palette) runs every scenario to its end, each check simply false
  function selRow() { return rows()[selIdx()] || {}; }
  function selIdx() { return (P() && P().selected) ? P().selected() : -1; }
  function modeOf() { return (P() && P().mode) ? P().mode() : null; }
  function bootState() { return (P() && P().boot) ? P().boot.state() : 'none'; }
  function pal(name) { return (P() && typeof P()[name] === 'function') ? P()[name] : function () { return []; }; }
  var RECENT_KEY = 'penumbra_palette_recent';
  function A() { return (window.Penumbra && window.Penumbra.headerMenu) || null; }
  function fth(name) { return document.querySelector('#tableHeader th[data-colname="' + name + '"]'); }
  function box() { return document.getElementById('pnbPalette'); }
  function input() { return document.getElementById('pnbPaletteInput'); }
  function rows() { return (P() && P().rows) ? P().rows() : []; }
  function texts() { return rows().map(function (r) { return r.text; }); }
  function row(startsWith, section) { return rows().filter(function (r) { return r.text.indexOf(startsWith) === 0 && (!section || r.section === section); })[0] || null; }
  function rowIndex(startsWith, section) { var rs = rows(); for (var i = 0; i < rs.length; i++) { if (rs[i].text.indexOf(startsWith) === 0 && (!section || rs[i].section === section)) return i; } return -1; }
  function key(k, o) {
    o = o || {}; trace('key ' + k);
    var t = o.target || document.activeElement || document.body;
    var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ctrlKey: !!o.ctrl, metaKey: !!o.meta, shiftKey: !!o.shift, altKey: !!o.alt });
    return !t.dispatchEvent(ev);   // true = default prevented
  }
  function typingTarget(el) { return !!(el && el.tagName && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || (el.closest && el.closest('.CodeMirror')))); }
  // Ctrl+K from wherever the focus is - unless that is a field (the key stands down there): then from the page
  function ctrlK() {
    var a = document.activeElement;
    if (typingTarget(a) && !(a.id === 'pnbPaletteInput')) { try { a.blur(); } catch (e) { } }
    return key('k', { ctrl: true, target: document.activeElement || document.body });
  }
  function type(text) { trace('type ' + JSON.stringify(text)); var i = input(); if (!i) return; i.value = text; i.dispatchEvent(new Event('input', { bubbles: true })); }
  async function open(text) {
    trace('open ' + JSON.stringify(text || ''));
    if (box()) { key('Escape'); await sleep(30); }
    var prevented = ctrlK(); trace('ctrlK prevented ' + prevented + ' box ' + !!box() + ' open ' + !!(P() && P().isOpen && P().isOpen()) + ' ae ' + (document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id : null));
    var ok = await until(function () { return !!box() && P() && P().mode && modeOf() === 'root'; }, 5000); trace('until ' + ok);
    if (!ok) return false;
    if (text) type(text);
    await sleep(60);
    return true;
  }
  async function pickRow(startsWith, section) {
    var i = rowIndex(startsWith, section);
    if (i < 0) return false;
    if (P() && P().select) P().select(i);
    return selIdx() === i;
  }
  async function enter() { key('Enter', { target: input() }); await sleep(80); trace('entered'); }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded');
    await sleep(600);
    // The harness page boots with the fixture's pivot container shown and the flat table hidden
    // (body.penumbra-fs-autoload-pending) - the colmenu suite never minds, it dispatches events on
    // the headers wherever they are. The palette reads the view in force (pivotMenu.on(), the
    // group mode class), so put the page in the flat view it stands for.
    var pvc = document.getElementById('pivot-output-container'); if (pvc) pvc.style.display = 'none';
    document.body.classList.remove('penumbra-fs-autoload-pending');
    window.__toasts = [];
    window.show_text = function (html) { window.__toasts.push(String(html)); };
    // the Help Center's opener, stubbed: the Ask page's form appears as its lazy load would make it
    window.__helpOpens = []; window.__askSubmits = [];
    window.openHelpCenter = function (id, jump, focus) {
      window.__helpOpens.push([id, jump || '', !!focus]);
      if (id === 'askHelpLightbox' && !document.getElementById('pnbAskForm')) {
        setTimeout(function () {
          var f = document.createElement('form'); f.id = 'pnbAskForm'; f.innerHTML = '<textarea id="pnbAskQ"></textarea><button type="submit" id="pnbAskGo">Ask</button>';
          document.body.appendChild(f);
          f.addEventListener('submit', function (e) { e.preventDefault(); window.__askSubmits.push(document.getElementById('pnbAskQ').value); });
        }, 150);
      }
    };
  }
  async function ready() {
    var p = P();
    if (p && p.boot && p.boot.state() === 'idle') p.boot.load();
    return await until(function () { return !!(P() && (P() && P().ready)); }, 15000);
  }
  function noDash(s) { return String(s).indexOf('—') < 0; }

  var S = {};
  // ---------------------------------------------------------------- pcold
  S.pcold = async function () {
    await boot();
    R.info.state0 = P() && P().boot ? bootState() : 'no stub';
    var prevented = ctrlK();
    var b = box(), inp = input();
    R.chk.shellAtOnce = !!(prevented && b && inp && document.activeElement === inp && bootState() === 'loading' && !(P() && P().ready));
    // the letters typed before the module arrives stay in the box
    if (inp) { inp.value = 'fr'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    var over = await until(function () { return !!((P() && P().ready) && box() && box().querySelector('.pnb-pal-sec')); }, 15000);
    R.chk.handOver = over && bootState() === 'ready' && document.activeElement === input() && document.querySelectorAll('#pnbPalette').length === 1;
    R.chk.keysKept = over && input().value === 'fr';
    await sleep(100);
    R.info.rows = texts().slice(0, 6);
    R.chk.renders = over && !!row('Freeze up to this column', 'Actions');
    key('Escape');
  };
  // ---------------------------------------------------------------- pfail
  S.pfail = async function () {
    await boot();
    var prevented = ctrlK();
    R.chk.shellAtOnce = !!(prevented && box() && input() && bootState() === 'loading');
    var failed = await until(function () { return bootState() === 'failed'; }, 6000);
    await sleep(50);
    var text = box() ? box().textContent : '';
    R.info.text = text.slice(0, 120); R.info.state = bootState();
    R.chk.failLine = failed && /could not be loaded/.test(text) && !/Loading quick actions/.test(text);
    key('Escape', { target: input() });
    await sleep(50);
    R.chk.escCloses = failed && !box();   // (a box that was there: never vacuous on the control)
    // a second press: the line at once, no loading state to wait on
    ctrlK(); await sleep(50);
    R.chk.noHang = !!box() && /could not be loaded/.test(box().textContent) && bootState() === 'failed';
    // (round 11) the shell's Esc chip is a button that closes it
    var chip = box() ? box().querySelector('button.pnb-pal-esc') : null; if (chip) { chip.click(); } await sleep(50);
    R.chk.escChipCloses = !!chip && chip.getAttribute('aria-label') === 'Close quick actions' && !box();
    if (box()) { key('Escape', { target: input() }); }
  };
  // ---------------------------------------------------------------- pmain
  S.pmain = async function () {
    trace('pmain: boot'); await boot(); trace('pmain: booted');
    await ready(); trace('pmain: ready ' + !!(P() && P().ready));   // (false on the control: no module)
    try { localStorage.removeItem(RECENT_KEY); localStorage.setItem('pnb_recent_reports', JSON.stringify([{ id: 'zzpal', title: 'Palette fixture report', ts: Date.now() }])); } catch (e) { }
    // the "?" sheet names Ctrl+K while the stub is loaded
    window.penumbraToggleShortcutSheet(true); await sleep(50);
    var sheet = document.getElementById('pnbShortcutsLightbox');
    R.chk.sheetRow = !!(sheet && Array.prototype.some.call(sheet.querySelectorAll('.pnb-keys-table kbd'), function (k) { return k.textContent === 'Ctrl+K'; }));
    window.penumbraToggleShortcutSheet(false); await sleep(50);
    // the empty state
    await open('');
    var rt = document.getElementById('resultsTable');
    R.info.diag = { ths: document.querySelectorAll('#tableHeader th[data-colname]').length, hdrs: pal('headers')(), pivotOn: !!(window.Penumbra.pivotMenu && window.Penumbra.pivotMenu.on()), grouped: document.body.classList.contains('group-mode-active'), rtDisp: rt ? getComputedStyle(rt).display : '' };
    var secs = rows().map(function (r) { return r.section; });
    R.info.empty = texts().slice(0, 12);
    R.chk.emptyRecent = secs.indexOf('Recent') < 0;
    R.chk.emptyCommon = secs.indexOf('For this report') >= 0 && rows().length >= 3;
    R.chk.commonAvailOnly = rows().every(function (r) { return !r.off; }) && !row('Ungroup');
    R.chk.hiddenUntilTyped = !row('Ungroup');
    // fuzzy ranking + marks
    type('fr'); await sleep(60);
    R.info.fr = texts().slice(0, 6);
    R.chk.rankTop = rows().length > 0 && rows()[0].section === 'Actions' && rows()[0].text.indexOf('Freeze up to this column') === 0;
    var m = box() ? box().querySelector('.pnb-pal-it .pnb-pal-lab mark') : null;
    R.chk.marks = !!m && m.textContent === 'Fr';
    // greyed with the menu's reason once typed
    type('ungro'); await sleep(60);
    var ug = row('Ungroup');
    R.info.ungro = ug;
    R.chk.greyWhenTyped = !!ug && ug.off === true;
    R.chk.greyReason = !!ug && ug.why === 'Nothing is grouped';
    // the sections
    type('v_am'); await sleep(60);
    R.chk.columnsSec = !!row('V_AMOUNT', 'Columns');
    type('palette fix'); await sleep(400);
    var rep = row('Palette fixture report', 'Reports');
    R.info.rep = rep;
    R.chk.reportsLocal = !!rep && /zzpal/.test(rep.text);
    type('group'); await sleep(60);
    R.chk.helpSec = !!row('Grouping', 'Help');
    var rs = rows();
    R.chk.askLast = rs.length > 1 && rs[rs.length - 1].ask && selIdx() >= 0 && !(rs[selIdx()] || {}).ask;
    // a question: Ask first and selected; Enter opens the Ask page with the text submitted
    var q = 'how do I share this report';
    type(q); await sleep(60);
    rs = rows();
    R.info.q = texts().slice(0, 4);
    R.chk.questionFirst = rs.length > 1 && (rs[0] || {}).ask && selIdx() === 0 && rs.some(function (r) { return r.section === 'Actions'; });   // (the Ask row AHEAD of real matches)
    await enter();
    R.chk.askOpens = !box() && window.__helpOpens.length === 1 && window.__helpOpens[0][0] === 'askHelpLightbox';
    var sub = await until(function () { return window.__askSubmits.length === 1; }, 3000);
    R.chk.askSubmits = sub && window.__askSubmits[0] === q;
    var f = document.getElementById('pnbAskForm'); if (f) f.parentNode.removeChild(f);
    // the focus trap: Tab = next section, Shift+Tab = back, a focus elsewhere comes back
    await open('fr');
    var before = selRow().section;
    key('Tab', { target: input() }); await sleep(30);
    var after = selRow() ? selRow().section : '';
    R.info.tab = [before, after, document.activeElement === input()];
    R.chk.trapTab = document.activeElement === input() && after !== before && after !== '';
    key('Tab', { target: input(), shift: true }); await sleep(30);
    R.chk.trapShiftTab = document.activeElement === input() && selRow().section === before;
    // (a button of the page's own, on screen - the harness's headers sit in a hidden table and cannot take the focus)
    var th = document.createElement('button'); th.id = 'zzFocusProbe'; th.type = 'button'; th.textContent = 'probe'; th.style.cssText = 'position:fixed;left:4px;top:4px;z-index:5;';
    document.body.appendChild(th); th.focus(); await sleep(50);
    R.chk.trapFocusin = document.activeElement === input();
    // the arrows skip greyed rows (the typed word matches greyed and live rows alike)
    type('gr'); await sleep(60);
    var offs = rows().map(function (r) { return r.off; });
    var s0 = selIdx(); key('ArrowDown', { target: input() }); await sleep(20); var s1 = selIdx(); key('ArrowUp', { target: input() }); await sleep(20);
    R.info.arrows = [s0, s1, selIdx(), offs];
    var nextOn = s0; do { nextOn = (nextOn + 1) % offs.length; } while (offs[nextOn]);
    R.chk.arrows = s1 === nextOn && s1 !== s0 && !(rows()[s1] || {}).off && selIdx() === s0;
    // Esc puts the focus back where it was (a button of the page's own, on screen: the harness's
    // table headers and title are not focusable here)
    key('Escape', { target: input() }); await sleep(30);
    th.focus(); await sleep(30);
    var wasTh = document.activeElement === th;
    ctrlK(); await until(function () { return !!box(); }, 2000); await sleep(30);
    var inBox = document.activeElement === input();
    key('Escape', { target: input() }); await sleep(30);
    R.info.esc = [wasTh, inBox, !box(), document.activeElement ? (document.activeElement.tagName + '#' + document.activeElement.id) : null];
    R.chk.escFocus = wasTh && inBox && !box() && document.activeElement === th;
    // recents: a pick is remembered, listed first, cleared by the Settings panel's button
    await open('scroll top');
    await enter();
    var stored = null; try { stored = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null'); } catch (e) { }
    R.info.stored = stored;
    R.chk.recentsStored = !box() && Array.isArray(stored) && stored[0] === 'top';
    await open('');
    R.chk.recentsShown = rows().length > 0 && rows()[0].section === 'Recent' && rows()[0].text === 'Scroll to the top';
    key('Escape', { target: input() }); await sleep(30);
    // main.js's handler ends with setTimeout(location.reload, 1500): a reload mid-scenario restarts
    // the page (and this driver) from the top, so that one timer is dropped on the floor here
    var st0 = window.setTimeout;
    window.setTimeout = function (fn) { if (typeof fn === 'function' && /location\.reload/.test(String(fn))) { trace('clearPrefs: reload timer dropped'); return 0; } return st0.apply(window, arguments); };
    try { document.getElementById('spClearStorage').click(); await sleep(100); } finally { window.setTimeout = st0; }
    R.info.cleared = localStorage.getItem(RECENT_KEY);
    R.chk.clearPrefs = Array.isArray(stored) && stored[0] === 'top' && localStorage.getItem(RECENT_KEY) === null;   // (stored first, then gone)
    // every header-menu act has a palette entry or a recorded exemption
    var acts = {}, M = window.Penumbra.colMenu;
    ['V_ID', 'V_NAME', 'V_AMOUNT', 'V_DATE', 'V_LINK', 'V_STATUS', '#'].forEach(function (n) { var t = fth(n); if (t) pal('menuActs')(t).forEach(function (a) { acts[a] = 1; }); });
    var td = document.querySelector('#resultsTable tbody tr td[data-column="' + fth('V_NAME').getAttribute('data-column') + '"]');
    if (td) pal('menuActs')(fth('V_NAME'), { td: td, th: fth('V_NAME'), nested: false, target: td }).forEach(function (a) { acts[a] = 1; });
    var covered = pal('columnActs')(), missing = Object.keys(acts).filter(function (a) { return covered.indexOf(a) < 0 && !((P() && P().exempt) ? P().exempt(a) : false); });
    R.info = Object.assign({ missing: missing, acts: Object.keys(acts) }, R.info);
    R.chk.coverage = Object.keys(acts).length >= 15 && missing.length === 0 && !!M && typeof M.items === 'function';
    // every entry's control or function exists here (or is a control this harness has not got)
    var ABSENT = ['pivot', 'viz', 'download', 'dl-xls', 'dl-pdf', 'dl-print', 'dl-csv', 'dl-tsv', 'dl-json', 'email', 'snapshots', 'journal', 'subscribe', 'settings', 'header', 'find', 'nextpage', 'prevpage', 'clearfilter', 'builder'];
    var reg = pal('registry')(), bad = reg.filter(function (e) { return !e.needs && ABSENT.indexOf(e.id) < 0; }).map(function (e) { return e.id; });
    R.info.regBad = bad; R.info.regN = reg.length;
    R.chk.registryNeeds = reg.length >= 40 && bad.length === 0;
    // (round 2) every entry with a toolbar twin draws that twin's own icon - the sprite symbol it
    // references, or its inline path - and the rows on screen carry them
    function iconKey(svg) { if (!svg) return null; var u = svg.querySelector('use'); if (u) return 'use:' + u.getAttribute('href'); var p = svg.querySelector('path'); return p ? 'path:' + p.getAttribute('d') : null; }
    var twins = pal('registry')().filter(function (e) { return e.icon && e.icon.twin && document.getElementById(e.icon.twin); }), badIcons = [];
    twins.forEach(function (e) {
      var b = document.getElementById(e.icon.twin), s = b.tagName.toLowerCase() === 'svg' ? b : b.querySelector('svg');
      var tpl = document.createElement('div'); tpl.innerHTML = (P() && P().iconMarkup) ? P().iconMarkup(e.id) : '';
      var want = iconKey(s), got = iconKey(tpl.querySelector('svg'));
      if (!want || got !== want) badIcons.push(e.id + ': ' + got + ' vs ' + want);
    });
    await open('');
    var rowSvg = document.querySelector('#pnbPalette .pnb-pal-it[data-id="pivot"] .pnb-pal-ic svg use'), tb = document.querySelector('#pivotBtn use');
    R.info.icons = [twins.length, badIcons, rowSvg ? rowSvg.getAttribute('href') : null, tb ? tb.getAttribute('href') : null];
    R.chk.iconsTwin = twins.length >= 10 && badIcons.length === 0 && !!rowSvg && !!tb && rowSvg.getAttribute('href') === tb.getAttribute('href')
      && !document.querySelector('#pnbPalette .pnb-pal-ic:not(:has(svg)):not(:has(.pnb-pal-glyph))');   // (round 12: an admin tool row carries the menu's own glyph)
    key('Escape', { target: input() }); await sleep(30);
    // (round 4) the icons RENDER as the toolbar's: for three sprite twins, in three themes (a dark one and
    // Wolfpack Red among them), the computed fill / stroke / stroke-width / caps / colour of the box's
    // SVG equal the toolbar icon's (the "black blob" bug: a clone outside the .export-icon rule)
    var THEMES = ['theme-default', 'theme-dark-blue', 'theme-wolfpack'], renderBad = [], renderN = 0;
    function themeTo(t) { THEMES.concat(['theme-charcoal-gold', 'theme-light-sepia']).forEach(function (c) { document.body.classList.remove(c); }); if (t !== 'theme-default') document.body.classList.add(t); document.body.setAttribute('data-theme', t); }
    for (var ti = 0; ti < THEMES.length; ti++) {
      themeTo(THEMES[ti]);
      await open('');
      ['pivot', 'download', 'group'].forEach(function (id) {
        var b = document.getElementById({ pivot: 'pivotBtn', download: 'downloadBtn', group: 'groupTableBtn' }[id]);
        var s = document.querySelector('#pnbPalette .pnb-pal-it[data-id="' + id + '"] .pnb-pal-ic svg');
        if (!b || !s) { renderBad.push(THEMES[ti] + ':' + id + ':missing'); return; }
        var cb = getComputedStyle(b), cs = getComputedStyle(s), selRow = !!s.closest('.pnb-pal-it.is-sel');
        renderN++;
        // (the selected row's icon takes the brand colour on purpose: its colour and its stroke, which
        // resolves currentColor to that colour, are compared with each other, not with the toolbar's)
        ['fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'color'].forEach(function (k) {
          if (selRow && (k === 'color' || k === 'stroke')) { if (k === 'stroke' && cs.stroke !== cs.color) renderBad.push(THEMES[ti] + ':' + id + ':selected stroke ' + cs.stroke + ' vs its colour ' + cs.color); return; }
          if (cb[k] !== cs[k]) renderBad.push(THEMES[ti] + ':' + id + ':' + k + ' ' + cs[k] + ' vs ' + cb[k]);
        });
      });
      key('Escape', { target: input() }); await sleep(30);
    }
    themeTo('theme-default');
    R.info.render = [renderN, renderBad.slice(0, 6)];
    R.chk.iconsRendered = renderN === 9 && renderBad.length === 0;
    // (round 5) THE REPORT DISCOVERY GATE: a non-admin's typed text never reaches the server's report
    // search (the Reports section is their own history); a global admin's does
    var xhrUrls = [], xo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) { xhrUrls.push(String(u)); return xo.apply(this, arguments); };
    var wasGlobal = penumbra_vars.isGlobalAdmin;
    penumbra_vars.isGlobalAdmin = false;
    trace('gate: viewer open'); await open('palette fix'); trace('gate: viewer opened'); await sleep(700);
    var viewerCalls = xhrUrls.filter(function (u) { return u.indexOf('get_server_reports.php') >= 0; }).length;
    var viewerRows = rows().filter(function (r) { return r.section === 'Reports'; }).map(function (r) { return r.text; });
    trace('gate: viewer rows ' + viewerRows.length); key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isGlobalAdmin = true;
    xhrUrls = [];
    trace('gate: admin open'); await open('palette fix'); trace('gate: admin opened'); await sleep(700);
    var adminCalls = xhrUrls.filter(function (u) { return u.indexOf('get_server_reports.php?mode=quicksearch') >= 0; }).length;
    trace('gate: admin calls ' + adminCalls); key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isGlobalAdmin = wasGlobal;
    XMLHttpRequest.prototype.open = xo;
    trace('gate: done');
    R.info.gate = [viewerCalls, adminCalls, viewerRows];
    R.chk.reportsGate = viewerCalls === 0 && adminCalls === 1 && viewerRows.some(function (t) { return /Palette fixture report/.test(t); });
    // (round 3) the group-mode icon is candidate C "Sections": the sprite symbol every <use> follows, the
    // toolbar button and the box's Group rows (the cloned twin, and the fallback = the same symbol)
    var GROUP_C = '<path d="m4 4 2.5 2.5L9 4"></path><line x1="12" y1="5" x2="20" y2="5"></line><line x1="8" y1="9.5" x2="20" y2="9.5"></line><line x1="8" y1="13" x2="20" y2="13"></line><path d="m6.25 15.25 2.5 2.5-2.5 2.5"></path><line x1="12" y1="18" x2="20" y2="18"></line>';
    var gsym = document.getElementById('pnbi-group'), gbtn = document.querySelector('#groupTableBtn use');
    await open('');
    var grow = document.querySelector('#pnbPalette .pnb-pal-it[data-id="group"] .pnb-pal-ic svg use');
    var gfall = (function () { var d = document.createElement('div'); d.innerHTML = (P() && P().iconMarkup) ? P().iconMarkup('col:groupBy') : ''; var u = d.querySelector('use'); return u ? u.getAttribute('href') : null; })();
    R.info.group = [gsym ? gsym.innerHTML : null, gbtn ? gbtn.getAttribute('href') : null, grow ? grow.getAttribute('href') : null, gfall];
    R.chk.groupIcon = !!gsym && gsym.innerHTML === GROUP_C && !!gbtn && gbtn.getAttribute('href') === '#pnbi-group' && !!grow && grow.getAttribute('href') === '#pnbi-group' && gfall === '#pnbi-group';
    key('Escape', { target: input() }); await sleep(30);
    // (round 2b) a key dispatched on the WINDOW itself (no Node target - a script's synthetic event, as the
    // live log showed at penumbra_palette.js:774) neither throws nor acts on the open box
    await open('fr');
    var errsBefore = (R.errors || []).length, selBefore = selIdx();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(60);
    R.chk.windowKey = (R.errors || []).length === errsBefore && !!box() && selIdx() === selBefore;
    key('Escape', { target: input() }); await sleep(30);
    // no em-dash anywhere the box prints
    await open('fr');
    var all = (box() ? box().textContent : '') + rows().map(function (r) { return r.text + r.why + r.sub; }).join('');
    R.chk.noEmdashUi = !!box() && rows().length > 0 && noDash(all);   // (a box with rows: never vacuous on the control)
    key('Escape', { target: input() });
  };
  // ---------------------------------------------------------------- ppick
  S.ppick = async function () {
    await boot();
    await ready();   // (false on the control: no module)
    await open('freeze up');
    var pvc = document.getElementById('pivot-output-container');
    R.info.pre = { hdrs: pal('headers')(), pivotOn: !!(window.Penumbra.pivotMenu && window.Penumbra.pivotMenu.on()), grouped: document.body.classList.contains('group-mode-active'),
      pvt: !!document.getElementById('pivotResultTable'), pvcDisp: pvc ? getComputedStyle(pvc).display : null, ths: document.querySelectorAll('#tableHeader th[data-colname]').length,
      shownTh: Array.prototype.filter.call(document.querySelectorAll('#tableHeader th[data-colname]'), function (t) { return t.style.display !== 'none'; }).length,
      rows: rows().map(function (r) { return [r.text, r.off, r.why]; }), sel: selIdx(), ae: document.activeElement ? document.activeElement.id : null, mode: modeOf() };
    await enter();
    R.info.post = { mode: modeOf(), box: !!box(), ae: document.activeElement ? document.activeElement.id : null };
    R.chk.pickMode = !!box() && modeOf() === 'pick';
    var t = texts();
    R.info.pick = rows().map(function (r) { return [r.text, r.off, r.why, r.pill]; });
    R.chk.pickOrder = t.slice(0, 7).join(',') === '#,V_ID,V_NAME,V_AMOUNT,V_DATE,V_LINK,V_STATUS';
    var rs = rows();
    R.chk.pickFreezeOff = rs.length >= 7 && !rs[1].off && !rs[4].off && rs[5].off && rs[5].why === 'past the first 5' && rs[6].off;
    // pick V_NAME (the 3rd shown column): # -> V_ID -> V_NAME
    key('ArrowDown', { target: input() }); key('ArrowDown', { target: input() }); await sleep(20);
    R.info.sel = selIdx();
    await enter();
    R.chk.pickFreezeRuns = !box() && A().frozen() === 3;
    var froze = A().frozen() === 3;
    await open('freeze up'); await enter();
    rs = rows();
    R.info.pick2 = rs.slice(0, 4).map(function (r) { return [r.text, r.off, r.pill]; });
    R.chk.pickFrozenPill = rs.length >= 3 && rs[0].off && rs[1].off && rs[2].off && rs[2].pill === 'frozen up to here' && rs[1].pill === 'frozen' && !rs[3].off;
    var un = row('Unfreeze columns', 'Or');
    R.chk.unfreezeOr = !!un && !un.off;
    await pickRow('Unfreeze columns', 'Or'); await enter();
    R.chk.unfreezeRuns = froze && !box() && A().frozen() === 0;   // (frozen first, then not)
    // sort through the picker
    await open('sort asc'); await enter();
    type('v_am'); await sleep(40);
    await enter();
    R.chk.sortRuns = !box() && A().sortDir('V_AMOUNT') === 'asc';
    // hide through the picker, then show all from the column's own list
    await open('hide this'); await enter();
    type('v_sta'); await sleep(40); await enter();
    await sleep(100);
    var hid = fth('V_STATUS').style.display === 'none';
    R.chk.hideRuns = !box() && hid;
    await open('v_name');
    await pickRow('V_NAME', 'Columns'); await enter();
    R.chk.colMode = !!box() && modeOf() === 'col';
    t = texts();
    R.info.col = t;
    R.chk.colItems = t.indexOf('Sort ascending') >= 0 && t.indexOf('Hide this column') >= 0 && t.indexOf('Move column: Left') >= 0 && t.indexOf('Show column(s): Show all columns') >= 0 && t.indexOf('Reset: This column') >= 0;
    await pickRow('Show column(s): Show all columns'); await enter();
    await sleep(100);
    R.chk.colRun = hid && !box() && fth('V_STATUS').style.display !== 'none';   // (hidden first, then shown again)
    // Backspace on an empty box steps back
    await open('v_name'); await pickRow('V_NAME', 'Columns'); await enter();
    key('Backspace', { target: input() }); await sleep(30);
    R.chk.backspaceBack = modeOf() === 'root';
    // a theme, the Settings panel's own select
    type('theme'); await sleep(40);
    await pickRow('Theme...', 'Actions'); await enter();
    R.chk.themePick = !!box() && modeOf() === 'theme' && !!row('Dark Blue') && !!row('Default Light');
    await pickRow('Dark Blue'); await enter();
    R.chk.themeRuns = await until(function () { return document.body.classList.contains('theme-dark-blue'); }, 2000);
  };
  // ---------------------------------------------------------------- pview
  S.pview = async function () {
    await boot();
    await ready();   // (false on the control: no module)
    penumbra_vars.isAdmin = false; penumbra_vars.isGlobalAdmin = false;
    await open('sav');
    R.chk.saveHidden = !row('Save');
    type('save'); await sleep(40);
    var sv = row('Save');
    R.info.save = sv;
    R.chk.saveGreyExact = !!sv && sv.off && sv.why === 'you can view this report, not edit it';
    type('version'); await sleep(40);
    R.chk.vhHidden = !row('Version history');
    type('admin controls'); await sleep(40);
    R.chk.consoleHidden = !row('Show or hide the admin controls');
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true;
    await open('save');
    sv = row('Save');
    R.info.editor = sv;
    R.chk.editorSave = !!sv && !sv.off;
    type('version'); await sleep(40);
    R.chk.editorVh = !!row('Version history');
    key('Escape', { target: input() });
  };
  // ---------------------------------------------------------------- prow
  S.prow = async function () {
    await boot();
    await ready();   // (false on the control: no module)
    if (!(await until(function () { return !!(window.Penumbra && window.Penumbra.cellSel); }, 5000))) throw new Error('no cell selection module');
    await open('');
    R.chk.noRowItemsIdle = !rows().some(function (r) { return /^(Filter to|Copy this value|Exclude)/.test(r.text); });
    key('Escape', { target: input() }); await sleep(30);
    var th = fth('V_NAME'), td = document.querySelector('#resultsTable tbody tr td[data-column="' + th.getAttribute('data-column') + '"]');
    var val = td.textContent.trim();
    var act = window.Penumbra.cellSel.activate(td);
    await sleep(50);
    await open('');
    R.info.rowsIdle = texts().slice(0, 10); R.info.act = act; R.info.val = val;
    var fr = row('Filter to "' + val + '"', 'For this report');
    R.chk.rowItems = act && !!fr && !!row('Copy this value', 'For this report') && /row \d+, V_NAME/.test(fr.sub);
    var picked = await pickRow('Filter to "' + val + '"');
    R.info.picked = [picked, selIdx(), selRow() ? selRow().text : null, document.activeElement ? document.activeElement.id : null, modeOf()];
    var prevented = key('Enter', { target: input() });
    R.info.enter = [prevented, modeOf(), !!box(), selIdx()];
    await sleep(80);
    await sleep(900);   // the search runs after the filter box is written (the colmenu suite waits as long)
    var q = document.getElementById('tableSearch').value;
    R.info.q = q; R.info.toasts = window.__toasts.slice(0, 3); R.info.boxAfter = !!box();
    R.chk.rowFilterRuns = !box() && q === 'V_NAME = /^(?:' + val + ')$/';
  };

  // ---------------------------------------------------------------- pshot
  // (round 4) the box left OPEN beside the toolbar in Wolfpack Red (the theme of the user's report
  // of the bug) for the runner's screenshot: it crops the box's and the toolbar's icons of the same
  // symbol and compares their ink (a filled blob vs an outlined stroke). The rects ride in info.
  S.pshot = async function () {
    await boot();
    await ready();
    ['theme-dark-blue', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-wolfpack'); document.body.setAttribute('data-theme', 'theme-wolfpack');
    var tb = document.getElementById('zzToolbar'); if (tb) { tb.style.cssText = 'position:fixed;left:620px;top:40px;z-index:100200;background:var(--bg-surface,#fff);padding:6px;border:1px solid var(--border-color,#ccc);'; }
    await open('');
    await sleep(200);
    var rect = function (el) { if (!el) return null; var r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    R.info.rects = {};
    ['pivot', 'download', 'group', 'email'].forEach(function (id) {
      var bid = { pivot: 'pivotBtn', download: 'downloadBtn', group: 'groupTableBtn', email: 'emailTableBtn' }[id];
      R.info.rects[id] = { pal: rect(document.querySelector('#pnbPalette .pnb-pal-it[data-id="' + id + '"] .pnb-pal-ic svg')), tb: rect(document.getElementById(bid)) };
    });
    R.info.bg = getComputedStyle(document.querySelector('#pnbPalette .pnb-pal')).backgroundColor;
    R.chk.open = !!box() && rows().length > 0;
  };

  // ---------------------------------------------------------------- pcombo
  // (round 4b) combinations made from the report's columns and saved items: each OPENS the familiar
  // dialog with its choice made and applies nothing (the view preferences apart, which the selects
  // themselves make); eight show, then "Show N more"
  S.pcombo = async function () {
    await boot();
    await ready();
    var gl = document.getElementById('groupingLightbox');
    // Group by X as List: the Group dialog with the column and the layout chosen, Apply unpressed
    await open('group by v_status list');
    var r0 = row('Group by V_STATUS as List');
    R.chk.comboGroupRow = !!r0 && !r0.off;
    await pickRow('Group by V_STATUS as List'); await enter(); await sleep(500);
    var selv = document.querySelector('#groupingColumnSelector .pcs-selected');
    R.info.group = [gl ? gl.style.display : null, selv ? selv.getAttribute('data-value') : null, (document.getElementById('groupLayout') || {}).value, document.body.classList.contains('group-mode-active')];
    R.chk.comboGroupOpens = !!gl && gl.style.display !== 'none' && !!selv && selv.getAttribute('data-value') === 'V_STATUS';
    R.chk.comboGroupLayout = (document.getElementById('groupLayout') || {}).value === 'list';
    R.chk.comboGroupNotApplied = R.chk.comboGroupOpens && !document.body.classList.contains('group-mode-active');   // (the dialog opened, and nothing applied: never vacuous)
    if (gl) gl.style.display = 'none';
    // Pivot by X / Chart X: handed to the page's own openers with the column (the builders are not in
    // this harness: the openers are recorded)
    var calls = [], A0 = A(), op = A0.pivotColumn, oc = A0.chartColumn;
    A0.pivotColumn = function (c) { calls.push('pivot:' + c); return true; };
    A0.chartColumn = function (c) { calls.push('chart:' + c); return true; };
    await open('pivot by v_amount'); await pickRow('Pivot by V_AMOUNT'); await enter(); await sleep(120);
    await open('chart v_date'); await pickRow('Chart V_DATE'); await enter(); await sleep(120);
    A0.pivotColumn = op; A0.chartColumn = oc;
    R.info.calls = calls;
    R.chk.comboPivot = calls.indexOf('pivot:V_AMOUNT') >= 0;
    R.chk.comboChart = calls.indexOf('chart:V_DATE') >= 0 && !(window.Penumbra.pivotMenu && window.Penumbra.pivotMenu.on());
    // Copy distinct values of X...: the Copy dialog on the column, Single Column, nothing copied yet
    await open('copy distinct v_name'); await pickRow('Copy distinct values of V_NAME...'); await enter(); await sleep(500);
    var cl = document.getElementById('copyActionsLightbox'), cs = document.getElementById('copyColumnSelector');
    R.info.copy = [cl ? cl.style.display : null, cs ? cs.value : null, (document.querySelector('input[name="copyFormat"]:checked') || {}).value];
    R.chk.comboCopyOpens = !!cl && cl.style.display !== 'none' && !!cs && cs.value === 'V_NAME' && (document.querySelector('input[name="copyFormat"]:checked') || {}).value === 'single_col';
    if (cl) cl.style.display = 'none';
    // Apply group preset P...: the dialog opens, its chip loads the preset (the column it holds shows), nothing applied
    var PP = window.PenumbraPresets;
    if (PP && PP.save) { PP.save('group', PP.reportId(), 'Zeta', { v: 1, levels: ['V_DATE'], agg: null, sort: 'label|asc', limit: null, startDepth: 0 }); }
    R.info.presets = !!(PP && PP.save);
    await open('apply group preset zeta');
    R.chk.comboPresetRow = !!row('Apply group preset Zeta...');
    await pickRow('Apply group preset Zeta...'); await enter();
    var loaded = await until(function () { var c = document.querySelector('#groupPresetMount .pnb-preset-chip'); return !!(c && /Zeta/.test(c.textContent)); }, 6000);
    await sleep(100);
    selv = document.querySelector('#groupingColumnSelector .pcs-selected');
    R.info.preset = [loaded, selv ? selv.getAttribute('data-value') : null, document.body.classList.contains('group-mode-active'), (document.querySelector('#groupPresetMount .pnb-preset-chip') || {}).textContent];
    R.chk.comboPresetLoads = loaded && !!selv && selv.getAttribute('data-value') === 'V_DATE' && !document.body.classList.contains('group-mode-active');
    if (gl) gl.style.display = 'none';
    // Rows per page / Density: the view preference, as the selects make it
    // (the harness's select offers 25 / 50 / 200 / All / None; index.php's 10 / 100 / 200 / 500 / All / None)
    await open('rows per page 50'); var picked50 = await pickRow('Rows per page: 50'); await enter(); await sleep(400);
    R.info.rows = [picked50, document.getElementById('rowsPerPageSelector').value];
    R.chk.comboRows = picked50 && document.getElementById('rowsPerPageSelector').value === '50';
    await open('density compact'); await pickRow('Density: Compact'); await enter(); await sleep(300);
    R.chk.comboDensity = document.getElementById('spDensitySelector').value === 'compact';
    // the cap: "v_" matches dozens of combinations - eight show, then "Show N more" lifts the cap
    await open('v_');
    var rs = rows().filter(function (r) { return r.section === 'Actions'; }), more = rs.filter(function (r) { return r.more; })[0];
    R.info.cap = [rs.length, more ? more.text : null];
    R.chk.comboCap = rs.length === 9 && !!more && /^Show \d+ more/.test(more.text);
    if (more) { await pickRow(more.text); await enter(); await sleep(100); }
    var rs2 = rows().filter(function (r) { return r.section === 'Actions'; });
    R.info.more = [rs2.length, !!box()];
    R.chk.comboMore = !!box() && rs2.length > 9 && !rs2.some(function (r) { return r.more; });
    key('Escape', { target: input() });
  };

  // ---------------------------------------------------------------- pkeys (round 6)
  // the key from the fields and editors, the platform rule and its labels, the breadcrumb's
  // magnifier, the profile card's row
  function setPlatform(p) {
    Object.defineProperty(navigator, 'platform', { get: function () { return p; }, configurable: true });
    Object.defineProperty(navigator, 'userAgentData', { get: function () { return { platform: /Mac/.test(p) ? 'macOS' : 'Windows' }; }, configurable: true });
    if (P() && P().boot && P().boot.relabel) P().boot.relabel();
  }
  function ae() { return document.activeElement; }
  async function fromField(el, press) {
    var prevented = press(); var ok = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    R.info['from_' + el.id] = [prevented, ok, ae() ? ae().id : null];
    return prevented && ok;
  }
  S.pkeys = async function () {
    await boot(); await ready();
    setPlatform('Win32');
    // 1. the filter box: the key opens, Esc returns the focus and the caret
    var f = document.getElementById('tableSearch'); f.focus(); f.value = 'abc'; f.setSelectionRange(1, 1);
    R.chk.fieldOpens = await fromField(f, function () { return key('k', { ctrl: true, target: f }); });
    key('Escape', { target: input() }); await sleep(40);
    R.chk.fieldFocusBack = R.chk.fieldOpens && ae() === f && f.selectionStart === 1 && f.selectionEnd === 1;
    f.value = '';
    // 2. a textarea, 3. an editable note
    var ta = document.getElementById('zzTa'); ta.focus(); ta.setSelectionRange(3, 3);
    R.chk.taOpens = await fromField(ta, function () { return key('k', { ctrl: true, target: ta }); });
    key('Escape', { target: input() }); await sleep(40);
    R.chk.taFocusBack = R.chk.taOpens && ae() === ta && ta.selectionStart === 3;
    var ce = document.getElementById('zzCe'); ce.focus();
    R.chk.ceOpens = await fromField(ce, function () { return key('k', { ctrl: true, target: ce }); });
    key('Escape', { target: input() }); await sleep(40);
    R.chk.ceFocusBack = R.chk.ceOpens && ae() === ce;
    // 4. a REAL CodeMirror editor (the page's own library): the key from inside it, the cursor kept
    var cm = window.CodeMirror ? window.CodeMirror(document.body, { value: 'select 1\nfrom dual where 1 = 1' }) : null;
    if (cm) { cm.focus(); cm.setCursor({ line: 1, ch: 9 }); }
    var cmIn = cm ? cm.getInputField() : null;
    R.chk.cmOpens = !!cm && cm.hasFocus() && await fromField(cmIn && cmIn.id ? cmIn : { id: 'cm' }, function () { return key('k', { ctrl: true, target: cmIn }); });
    key('Escape', { target: input() }); await sleep(60);
    var cur = cm ? cm.getCursor() : null;
    R.info.cm = [!!cm, cm ? cm.hasFocus() : null, cur, ae() ? ae().tagName : null];
    R.chk.cmCursorBack = R.chk.cmOpens && !!cm && cm.hasFocus() && cur.line === 1 && cur.ch === 9;
    // 5. the platform rule: a Mac takes Cmd+K and never Ctrl+K; Windows takes Ctrl+K and never the Windows key
    setPlatform('MacIntel');
    var pMac = key('k', { ctrl: true, target: document.body }); await sleep(120);
    R.chk.macCtrlIgnored = !pMac && !box();
    var pCmd = key('k', { meta: true, target: document.body }); var okCmd = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    R.chk.macCmdOpens = pCmd && okCmd;
    // the labels on a Mac: keyLabel(), the "?" sheet's row, the card's row, the magnifier's title
    var lbl = (P() && P().keyLabel) ? P().keyLabel() : null;
    key('Escape', { target: input() }); await sleep(30);
    window.penumbraToggleShortcutSheet(true); await sleep(50);
    function sheetKbds() { var s = document.getElementById('pnbShortcutsLightbox'); return s ? Array.prototype.map.call(s.querySelectorAll('.pnb-keys-table kbd'), function (k) { return k.textContent; }) : []; }
    var sheetMac = sheetKbds();
    window.penumbraToggleShortcutSheet(false); await sleep(30);
    // (round 10) the card's row became the bar's "Search" button: its title carries the key
    var pbtn = document.getElementById('sbPaletteBtn'), mag = document.getElementById('searchPaletteIcon');
    R.info.labels = [lbl, sheetMac.filter(function (k) { return /K$/.test(k); }), pbtn ? pbtn.title : null, mag ? mag.title : null];
    R.chk.labelMac = lbl === '⌘K' && sheetMac.indexOf('⌘K') >= 0 && sheetMac.indexOf('Ctrl+K') < 0 && !!pbtn && /\(⌘K\)/.test(pbtn.title) && !!mag && /⌘K/.test(mag.title) && !/Ctrl\+K/.test(mag.title);
    setPlatform('Win32');
    var pMeta = key('k', { meta: true, target: document.body }); await sleep(120);
    R.chk.winMetaIgnored = !pMeta && !box();
    var pCtrl = key('k', { ctrl: true, target: document.body }); var okCtrl = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    key('Escape', { target: input() }); await sleep(30);
    window.penumbraToggleShortcutSheet(true); await sleep(50);
    var sheetWin = sheetKbds();
    window.penumbraToggleShortcutSheet(false); await sleep(30);
    lbl = (P() && P().keyLabel) ? P().keyLabel() : null;
    R.chk.labelWin = pCtrl && okCtrl && lbl === 'Ctrl+K' && sheetWin.indexOf('Ctrl+K') >= 0 && !!pbtn && /\(Ctrl\+K\)/.test(pbtn.title) && !!mag && /\(Ctrl\+K\)/.test(mag.title);
    // 6. the magnifier beside the "?": the same disc; click / Enter open; the Help Center leads; Esc returns
    var q = document.getElementById('searchHelpIcon');
    R.chk.crumbIcon = !!mag && !!q && q.nextElementSibling === mag && mag.getAttribute('role') === 'button' && mag.tabIndex === 0 && mag.getAttribute('data-pnb-palette') === 'open' && mag.getAttribute('data-pnb-from') === 'crumb'
      && mag.title === 'Quick actions: run an action, jump to a column, report or help (Ctrl+K)' && !!mag.querySelector('svg use[href="#pnbi-quick"]');
    if (mag && q) {
      var cm1 = getComputedStyle(mag), cq = getComputedStyle(q), same = [], diff = [];
      ['width', 'height', 'borderRadius', 'borderTopWidth', 'borderTopColor', 'backgroundColor', 'color', 'display'].forEach(function (k) { (cm1[k] === cq[k] ? same : diff).push(k + ':' + cm1[k] + '|' + cq[k]); });
      R.info.crumbStyle = diff;
      R.chk.crumbSameSize = diff.length === 0;
    }
    if (box()) { key('Escape', { target: input() }); await sleep(30); }
    if (mag) { mag.click(); }
    var okMag = await until(function () { return !!box() && modeOf() === 'root'; }, 3000); await sleep(60);
    var top = rows()[0] || {};
    R.info.crumbRows = texts().slice(0, 4);
    R.chk.crumbOpens = !!mag && okMag && top.section === 'Help' && top.text === 'Help Center' && !top.off;
    key('Escape', { target: input() }); await sleep(40);
    R.chk.crumbEscFocus = !!mag && ae() === mag;
    if (mag) { mag.focus(); key('Enter', { target: mag }); }
    var okEnter = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    R.chk.crumbEnterOpens = !!mag && okEnter;
    key('Escape', { target: input() }); await sleep(30);
    // ...and from the key itself the Help Center does NOT lead (the empty state is the usual one)
    await open('');
    R.chk.plainNoHelpFirst = !!box() && (rows()[0] || {}).section !== 'Help';
    key('Escape', { target: input() }); await sleep(30);
    // 7. (round 10) the card's bottom bar: a "Search" button after Home and Help in BOTH footers (the admin's
    // keeps its pill last), styled by the bar's own rule as its neighbours are, the list row gone; the four
    // buttons on one line without overflow at the card's own width, light and dark; click opens, the card
    // closes, Esc returns to the card's button
    var seg = document.getElementById('zzUserSeg'), ubtn = document.getElementById('zzUserBtn');
    var fv = document.getElementById('zzFootViewer'), fa = document.getElementById('zzFootAdmin');
    function footBtn(f) { return f ? f.querySelector('a[data-pnb-palette="open"]') : null; }
    function footOk(f) {
      var b = footBtn(f); if (!b) return false;
      var kids = Array.prototype.filter.call(f.children, function (k) { return k.nodeType === 1; }), i = kids.indexOf(b);
      var afterHelp = i >= 1 && /Help/.test(kids[i - 1].textContent), beforePill = !f.querySelector('.pnb-admsplit') || kids[i + 1] === f.querySelector('.pnb-admsplit');
      return afterHelp && beforePill && /^\s*Quick actions\s*$/.test(b.textContent) && !!b.querySelector('svg.pnb-foot-ico use[href="#pnbi-quick"]') && b.getAttribute('role') === 'button'
        && b.title === 'Quick actions: run an action, jump to a column, report or help (Ctrl+K)';
    }
    R.info.foot = [fv ? fv.children.length : null, fa ? fa.children.length : null, footBtn(fv) ? footBtn(fv).outerHTML.slice(0, 120) : null];
    R.chk.popBtn = footOk(fv) && footOk(fa) && !!document.getElementById('sbPaletteBtn');
    R.chk.rowGone = !document.getElementById('sbPaletteRow') && !document.querySelector('.sb-pal-row');
    var pb = footBtn(fa), home = fa ? fa.querySelector('a[href="index.php"]') : null, d2 = [];
    if (pb && home) {
      var cb = getComputedStyle(pb), ch = getComputedStyle(home);
      ['fontSize', 'fontWeight', 'paddingTop', 'paddingLeft', 'borderRadius', 'color', 'textAlign', 'whiteSpace', 'flexGrow', 'height'].forEach(function (k) { if (cb[k] !== ch[k]) d2.push(k + ':' + cb[k] + '|' + ch[k]); });
      var ic = getComputedStyle(pb.querySelector('svg')); if (ic.stroke !== cb.color) d2.push('icon stroke ' + ic.stroke + ' vs ' + cb.color);
    }
    R.info.popStyle = d2;
    R.chk.popBtnStyle = !!pb && !!home && d2.length === 0;
    // no wrap, no overflow: every button on the bar's one line, the bar inside the card, the card within its clamp
    var pop = document.getElementById('zzUserPop'), wrapBad = [];
    function wraps(f, theme) {
      var kids = Array.prototype.filter.call(f.children, function (k) { return k.nodeType === 1; }), tops = kids.map(function (k) { return Math.round(k.getBoundingClientRect().top); });
      var oneLine = tops.every(function (t) { return Math.abs(t - tops[0]) < 3; }), inside = f.scrollWidth <= f.clientWidth + 1 && kids.every(function (k) { return k.getBoundingClientRect().right <= f.getBoundingClientRect().right + 1; });
      if (!oneLine || !inside) wrapBad.push(theme + ':' + f.id + ':' + tops.join(',') + ':' + f.scrollWidth + '/' + f.clientWidth);
    }
    function themeOn(t) { ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); }); if (t !== 'theme-default') document.body.classList.add(t); }
    ['theme-default', 'theme-dark-blue'].forEach(function (t) { themeOn(t); wraps(fv, t); wraps(fa, t); });
    themeOn('theme-default');
    var popW = pop.getBoundingClientRect().width;
    R.info.wrap = [wrapBad, popW];
    R.chk.popNoWrap = !!fv && !!fa && wrapBad.length === 0 && popW >= 354 && popW <= 510;
    seg.classList.add('sb-open'); ubtn.setAttribute('aria-expanded', 'true');
    if (pb) { pb.click(); }
    var okRow = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    R.info.popOpen = [okRow, seg.classList.contains('sb-open'), ubtn.getAttribute('aria-expanded')];
    R.chk.popBtnOpens = !!pb && okRow && !seg.classList.contains('sb-open') && ubtn.getAttribute('aria-expanded') === 'false';
    key('Escape', { target: input() }); await sleep(40);
    R.chk.popEscFocus = !!pb && ae() === ubtn;
    // 8. (round 11) "Quick actions" everywhere a user sees the feature; the bolt on every surface, no magnifier there
    await open('');
    var dlg = box().querySelector('.pnb-pal'), sheetRowText = '';
    window.penumbraToggleShortcutSheet(true); await sleep(40);
    (function () { var sh = document.getElementById('pnbShortcutsLightbox'); if (!sh) return; Array.prototype.forEach.call(sh.querySelectorAll('tr'), function (tr) { if (/Ctrl\+K|\u2318K/.test(tr.textContent)) sheetRowText = tr.textContent; }); })();
    window.penumbraToggleShortcutSheet(false); await sleep(30);
    R.info.names = [dlg.getAttribute('aria-label'), input().getAttribute('aria-label'), sheetRowText.replace(/\s+/g, ' ').trim(), (box().querySelector('.pnb-pal-help') || {}).title];
    R.chk.quickLabel = dlg.getAttribute('aria-label') === 'Quick actions' && input().getAttribute('aria-label') === 'Quick actions' && /Quick actions:/.test(sheetRowText) && !/Command palette|Search actions/i.test(sheetRowText)
      && !!pb && /^\s*Quick actions\s*$/.test(pb.textContent) && pb.title === 'Quick actions: run an action, jump to a column, report or help (Ctrl+K)' && !!mag && mag.title === pb.title && mag.getAttribute('aria-label') === 'Quick actions'
      && !/command palette/i.test(document.getElementById('pnbStatusBar').textContent + box().textContent);
    var sym = document.getElementById('pnbi-quick'), psym = document.getElementById('pnbpal-quick'), boxUse = box().querySelector('.pnb-pal-in .pnb-pal-ico svg use');
    var surfaces = [mag, pb, footBtn(fv), box().querySelector('.pnb-pal-in .pnb-pal-ico')];
    var noMag = surfaces.every(function (el) { return el && !el.querySelector('circle') && !/\uD83D\uDD0D/.test(el.textContent); });
    R.info.bolt = [sym ? sym.innerHTML : null, psym ? psym.innerHTML : null, boxUse ? boxUse.getAttribute('href') : null, noMag];
    R.chk.boltEverywhere = !!sym && /<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/.test(sym.innerHTML) && !!psym && psym.innerHTML === sym.innerHTML
      && !!boxUse && boxUse.getAttribute('href') === '#pnbpal-quick' && !!mag && !!mag.querySelector('use[href="#pnbi-quick"]') && !!pb && !!pb.querySelector('use[href="#pnbi-quick"]') && !!footBtn(fv) && !!footBtn(fv).querySelector('use[href="#pnbi-quick"]') && noMag;   // (null-safe: the x-noicon / x-nobtn mutants remove a surface)
    key('Escape', { target: input() }); await sleep(30);
    // 9. (round 11) the Esc chip is a button: a click closes and returns the focus to the opener; it is out of
    // the Tab cycle; a click on the backdrop closes; a click inside the box does not
    var ta2 = document.getElementById('zzTa'); ta2.focus();
    key('k', { ctrl: true, target: ta2 }); await until(function () { return !!box() && modeOf() === 'root'; }, 3000); await sleep(40);
    var esc = box().querySelector('button.pnb-pal-esc'), escCursor = esc ? getComputedStyle(esc).cursor : null;   // (read NOW: a detached element computes to '')
    R.info.esc = [esc ? esc.tagName : null, esc ? esc.getAttribute('aria-label') : null, esc ? esc.tabIndex : null, escCursor];
    key('Tab', { target: input() }); await sleep(30);
    var tabStays = ae() === input();
    if (esc) { esc.click(); } await sleep(60);
    R.info.escAfter = [!!box(), ae() ? (ae().tagName + '#' + ae().id) : null];
    R.chk.escClick = !!esc && esc.tagName === 'BUTTON' && esc.getAttribute('aria-label') === 'Close quick actions' && escCursor === 'pointer' && !box() && ae() === ta2;
    R.chk.escNotInTab = !!esc && esc.tabIndex === -1 && tabStays;
    await open(''); var veil = box();
    veil.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })); await sleep(60);
    R.chk.backdropClose = !box();
    await open(''); var inside = box().querySelector('.pnb-pal-body');
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); inside.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(60);
    R.chk.insideClickStays = !!box() && modeOf() === 'root';
    key('Escape', { target: input() });
  };
  // (round 11) the photograph of the box's top row: the bolt, the input, the Esc button
  S.pshot11 = async function () {
    await boot(); await ready();
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });
    var ok = await open(''); await sleep(200);
    R.chk.open = ok && !!box() && !!box().querySelector('button.pnb-pal-esc');
  };
  // ---------------------------------------------------------------- pdash / pdasha (round 6)
  // dashboard.php's stand-in: the key opens; the header's buttons and the filter box are the rows;
  // the report tools are hidden; the Help Center runs the page's own Help button; the round-5 gate
  async function bootDash() {
    await until(function () { return document.readyState === 'complete'; }, 20000);
    await sleep(300);
    try { localStorage.removeItem(RECENT_KEY); localStorage.setItem('pnb_recent_reports', JSON.stringify([{ id: 'zzpal', title: 'Palette fixture report', ts: Date.now() }])); } catch (e) { }
  }
  async function dashCommon(admin) {
    trace('dashCommon start'); await bootDash(); trace('booted'); var rdy = await ready(); trace('ready ' + rdy + ' state ' + bootState());
    // (round 13) the module notes the opened dashboard in the browser's own history (the reports' recents twin)
    var recD = []; try { recD = JSON.parse(localStorage.getItem('pnb_recent_dashboards') || '[]'); } catch (e) { }
    R.info.recD = recD;
    R.chk.dashRecentWrite = Array.isArray(recD) && recD.length >= 1 && recD[0].id === 'zzdash' && recD[0].title === 'Fixture dashboard';
    var xhrUrls = [], xo = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) { xhrUrls.push(String(u)); return xo.apply(this, arguments); };
    var okOpen = await (async function () { key('k', { ctrl: true, target: document.body }); return await until(function () { return !!box() && modeOf() === 'root'; }, 5000); })();
    await sleep(80);
    R.chk.dashOpens = okOpen;
    var ts = texts(), secs = rows().map(function (r) { return r.section; });
    R.info.rows = rows().map(function (r) { return r.section + ': ' + r.text; }).slice(0, 12);
    R.chk.dashRows = secs.indexOf('For this dashboard') >= 0 && ts.indexOf('Refresh') >= 0 && ts.indexOf('Edit') >= 0 && ts.indexOf('Filter the dashboard') >= 0 && secs.indexOf('For this report') < 0;
    R.chk.dashPlaceholder = !!input() && input().getAttribute('placeholder') === 'Type an action or a report';
    type('pivot'); await sleep(60);
    var noPivot = !row('Pivot table builder') && !row('Pivot by');
    type('download'); await sleep(60);
    var noDl = !row('Download');
    type('freeze'); await sleep(60);
    R.chk.dashNoTools = noPivot && noDl && !row('Freeze');
    type('feedback'); await sleep(60);
    R.chk.dashNoFeedback = !row('Send feedback');   // (round 8) a report page's entry, never the dashboard's
    type('metrics for'); await sleep(60);
    R.chk.dashNoMetricsRow = okOpen && !row('Metrics for this report');   // (round 13) a report page's row, never the dashboard's
    type('refresh'); await sleep(60);
    var ok = await pickRow('Refresh'); if (ok) { await enter(); } await sleep(80);   // (never Enter on a stranger: with the rows gone the first row may navigate - b-dashrows)
    R.chk.dashRefreshRuns = ok && !box() && (window.__clicks.dashRefreshBtn || 0) === 1;
    await open('filter the'); ok = await pickRow('Filter the dashboard'); if (ok) { await enter(); } await sleep(80);
    R.chk.dashFilterRuns = ok && !box() && ae() === document.getElementById('dashSearchInput');
    await open('help cen'); var hr = row('Help Center'); ok = await pickRow('Help Center'); if (ok) { await enter(); } await sleep(80);
    R.info.help = hr;
    R.chk.dashHelpRow = !!hr && !hr.off && ok && (window.__clicks.dashHelpBtn || 0) === 1;
    await open('palette fix'); await sleep(700);
    var calls = xhrUrls.filter(function (u) { return u.indexOf('get_server_reports.php?mode=quicksearch') >= 0; }).length;
    var local = rows().filter(function (r) { return r.section === 'Reports' && /Palette fixture report/.test(r.text); }).length;
    R.info.gate = [admin, calls, local];
    if (admin) { R.chk.dashGateAdmin = calls === 1 && local === 1; } else { R.chk.dashGateViewer = calls === 0 && local === 1; }
    key('Escape', { target: input() });
    XMLHttpRequest.prototype.open = xo;
  }
  S.pdash = async function () { await dashCommon(false); };
  S.pdasha = async function () { await dashCommon(true); };

  // ---------------------------------------------------------------- pdsec (round 13)
  // the Dashboards section on a report page: the list fixture (manage_dashboard.php = what the server returns
  // THIS caller), matched on title and id, never on the owner or a tag for a non-admin (an admin's term reaches
  // both), after the Reports section, a row's dashboard.php?id= link, one fetch per open from two letters,
  // absent on an empty list, the browser's own history row
  S.pdsec = async function () {
    await boot(); await ready();
    var xhrUrls = [], xo = XMLHttpRequest.prototype.open, none = false;
    XMLHttpRequest.prototype.open = function (m, u) {
      var a = Array.prototype.slice.call(arguments); u = String(u); xhrUrls.push(u);
      if (none && u.indexOf('manage_dashboard.php?action=list') === 0) { a[1] = 'manage_dashboard_none.json'; }
      return xo.apply(this, a);
    };
    function dsec() { return rows().filter(function (r) { return r.section === 'Dashboards'; }); }
    function dcalls() { return xhrUrls.filter(function (u) { return u.indexOf('manage_dashboard.php?action=list') >= 0; }).length; }
    var wasGlobal = penumbra_vars.isGlobalAdmin;
    penumbra_vars.isGlobalAdmin = false;
    try { localStorage.removeItem('pnb_recent_dashboards'); localStorage.setItem('pnb_recent_reports', JSON.stringify([{ id: 'zzpal', title: 'Awards fixture report', ts: Date.now() }])); } catch (e) { }
    var okOpen = await open('a'); await sleep(300);
    R.chk.dashNoFetchShort = okOpen && dcalls() === 0;
    type('awards'); await sleep(700);
    var d = dsec(); R.info.awards = rows().map(function (r) { return r.section + ': ' + r.text; });
    R.chk.dashSection = d.length === 1 && /^Awards overview/.test(d[0].text) && / dshA$/.test(d[0].text) && d[0].sub === 'dashboard';
    R.chk.dashHref = d.length === 1 && d[0].href === 'dashboard.php?id=dshA';
    var secs = rows().map(function (r) { return r.section; });
    R.chk.dashAfterReports = secs.indexOf('Reports') >= 0 && secs.indexOf('Dashboards') > secs.lastIndexOf('Reports');
    type('dshb'); await sleep(80);
    d = dsec(); R.chk.dashById = d.length === 1 && /^Budget burn/.test(d[0].text);
    type('ownerx'); await sleep(80);
    R.chk.dashNotByOwner = okOpen && dsec().length === 0;
    type('tag:finance'); await sleep(80);
    R.chk.dashNoTagViewer = okOpen && dsec().length === 0;
    R.chk.dashFetchedOnce = dcalls() === 1;
    R.info.calls = xhrUrls.filter(function (u) { return u.indexOf('manage_dashboard') >= 0; });
    key('Escape', { target: input() }); await sleep(30);
    // an admin: the owner's name and a tag reach; a new open fetches once more
    penumbra_vars.isGlobalAdmin = true; xhrUrls = [];
    await open('ownerx'); await sleep(700);
    d = dsec(); R.chk.dashByOwnerAdmin = d.length === 1 && /^Awards overview/.test(d[0].text);
    type('tag:finance'); await sleep(80);
    d = dsec(); R.chk.dashByTagAdmin = d.length === 1 && /^Budget burn/.test(d[0].text);
    R.chk.dashRefetchNewOpen = dcalls() === 1;
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isGlobalAdmin = false;
    // an empty list: no section at all
    none = true; await open('awards'); await sleep(700);
    R.chk.dashAbsentEmpty = okOpen && !!box() && dsec().length === 0;
    key('Escape', { target: input() }); await sleep(30);
    // the browser's own history rides along (the module writes it on dashboard.php; planted here)
    try { localStorage.setItem('pnb_recent_dashboards', JSON.stringify([{ id: 'dshZ', title: 'Zebra dashboard', ts: Date.now() }])); } catch (e) { }
    await open('zebra'); await sleep(300);
    d = dsec(); R.chk.dashLocalRow = d.length === 1 && /^Zebra dashboard/.test(d[0].text) && d[0].href === 'dashboard.php?id=dshZ' && d[0].sub === 'dashboard, recently opened';
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isGlobalAdmin = wasGlobal; XMLHttpRequest.prototype.open = xo;
    try { localStorage.removeItem('pnb_recent_dashboards'); } catch (e) { }
  };

  // ---------------------------------------------------------------- pmetr (round 13, the round-12 addition)
  // "Metrics for this report (ID)": absent without ?id=; the admin, the owner and the plain viewer see it (the rule
  // of the metrics page and the home rail's icon: anyone who can open the report); above the all-reports tool row;
  // Enter opens analytics.php?id=<this report> in a new tab
  S.pmetr = async function () {
    await boot(); await ready();
    var opens = [], wo = window.open; window.open = function (u, t) { opens.push([String(u), String(t)]); return null; };
    function mrow() { return row('Metrics for this report'); }
    var was = { a: penumbra_vars.isAdmin, g: penumbra_vars.isGlobalAdmin, o: penumbra_vars.isReportOwner, e: penumbra_vars.canEditReport };
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true;
    var ok = await open('metrics'); R.chk.absentWithoutId = ok && !!box() && !mrow();
    key('Escape', { target: input() }); await sleep(30);
    history.replaceState(null, '', window.location.pathname + '?scn=pmetr&id=zzconf');
    ok = await open('metrics'); var r = mrow(), ri = rowIndex('Metrics for this report'), ti = rowIndex('Metrics', 'Admin tools');
    R.info.admin = [r, ri, ti, texts().slice(0, 6)];
    R.chk.adminSees = ok && !!r && !r.off && r.section === 'Actions' && /^\(zzconf\) /.test(r.sub);
    R.chk.aboveAllReports = ri >= 0 && ti >= 0 && ri < ti;
    var picked = await pickRow('Metrics for this report'); if (picked) { await enter(); } await sleep(80);   // (never Enter on a stranger: the control's first row is the all-reports tool, a navigation)
    R.info.opens = opens;
    R.chk.opensRight = picked && !box() && opens.length === 1 && opens[0][0] === 'analytics.php?id=zzconf' && opens[0][1] === '_blank';
    penumbra_vars.isAdmin = false; penumbra_vars.isGlobalAdmin = false; penumbra_vars.isReportOwner = true; penumbra_vars.canEditReport = true;
    ok = await open('metrics'); r = mrow(); R.info.owner = r;
    R.chk.ownerSees = ok && !!r && !r.off;
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isReportOwner = false; penumbra_vars.canEditReport = false;
    ok = await open('metrics'); r = mrow(); R.info.viewer = r;
    R.chk.viewerSees = ok && !!r && !r.off;
    key('Escape', { target: input() }); await sleep(30);
    window.open = wo; penumbra_vars.isAdmin = was.a; penumbra_vars.isGlobalAdmin = was.g; penumbra_vars.isReportOwner = was.o; penumbra_vars.canEditReport = was.e;
    history.replaceState(null, '', window.location.pathname + '?scn=pmetr');
  };

  // ---------------------------------------------------------------- phand (round 14)
  // the hand-offs: the two rows for "sponsor nih" leading the empty state (no note); Find opens on it with the
  // box untouched; the filter row writes the phrase quoted the grammar's way; a condition row in the grammar's
  // syntax merged into the current filter; < > greyed on a text column, not on a number column; after Actions
  // when actions match; "Filter by V_STATUS..." opens the header menu's value list; a hidden column: no rows
  S.phand = async function () {
    await boot(); await ready();
    var ts = document.getElementById('tableSearch');
    // the flat table on screen: Find scopes to the view in force (the harness boots with the table's wrapper hidden)
    var hiddenUp = $('#resultsTable').parents().filter(function () { return $(this).css('display') === 'none'; });
    R.info.hiddenUp = hiddenUp.map(function () { return this.id || this.className; }).get();
    hiddenUp.show(); $('#resultsTable').show(); await sleep(100);
    function hand() { return rows().filter(function (r) { return r.section === 'Filter and find'; }); }
    function hrow(p) { return hand().filter(function (r) { return r.text.indexOf(p) === 0; })[0] || null; }
    function note() { var b = box(); return b ? b.querySelector('.pnb-pal-note') : null; }
    var ok = await open('sponsor nih'); await sleep(200);
    var hf = hrow('Filter this report for'), hd = hrow('Find'); R.info.hand = hand(); R.info.first = rows()[0] || null;
    R.chk.handRows = ok && !!hf && !hf.off && !!hd && !hd.off;
    R.chk.handLeadsEmpty = ok && rows().length > 0 && rows()[0].section === 'Filter and find' && !note();
    var picked = await pickRow('Find'); if (picked) { await enter(); } await sleep(500);
    var F = window.Penumbra && window.Penumbra.find, fs = (F && F._state) ? F._state() : null; R.info.find = fs;
    var FH = window.Penumbra && window.Penumbra.findHost;
    R.info.findDbg = [FH ? FH.flatActive() : 'no host', $('#resultsTable').is(':visible'), $('#pivot-output-container').is(':visible'), $('#groupedResultsContainer').is(':visible'), document.body.className, document.querySelectorAll('#resultsTable tbody tr td[data-column="' + fth('V_NAME').getAttribute('data-column') + '"]:not([data-pnb-lazy])').length];
    R.chk.findNoFilter = picked && !box() && !!fs && fs.open === true && ts.value === '';
    if (F && F.close) { F.close(); } await sleep(150);
    await open('sponsor nih'); picked = await pickRow('Filter this report for'); if (picked) { await enter(); } await sleep(900);
    R.info.q1 = ts.value;
    R.chk.filterQuoted = picked && !box() && ts.value === "'sponsor nih'";
    await open('v_status = open'); await sleep(200);
    var cr = hrow('Filter: '); R.info.cond = cr;
    R.chk.condRow = !!cr && !cr.off && cr.text.indexOf('Filter: V_STATUS = open') === 0;
    picked = await pickRow('Filter: '); if (picked) { await enter(); } await sleep(900);
    R.info.q2 = ts.value;
    R.chk.condMerges = picked && !box() && ts.value === "'sponsor nih' and V_STATUS = open";
    await open('v_name > 5'); await sleep(200); var tcr = hrow('Filter: '); R.info.typeText = tcr;
    await open('v_amount > 5'); await sleep(200); var ncr = hrow('Filter: '); R.info.typeNum = ncr;
    R.chk.typesHonoured = !!tcr && tcr.off && /holds text/.test(tcr.why) && !!ncr && !ncr.off;
    await open('fr'); await sleep(150); var secs = rows().map(function (r) { return r.section; });
    R.chk.handAfterActions = secs.indexOf('Actions') >= 0 && secs.indexOf('Filter and find') > secs.indexOf('Actions');
    await open('v_stat'); await sleep(200); var fb = hrow('Filter by V_STATUS'); R.info.fb = fb;
    picked = await pickRow('Filter by V_STATUS'); if (picked) { await enter(); } await sleep(500);
    var hp = document.querySelector('.pnb-hp-list[data-hp="list"]');
    R.chk.filterByOpens = !!fb && !fb.off && picked && !box() && !!hp;
    key('Escape', { target: document.activeElement || document.body }); await sleep(150);
    var thL = fth('V_LINK'); thL.style.display = 'none';
    await open('v_link = x'); await sleep(200); var h1 = hrow('Filter: ');
    type('v_lin'); await sleep(200); var h2 = hrow('Filter by V_LINK');
    thL.style.display = '';
    R.info.hidden = [h1, h2];
    R.chk.hiddenNoRow = ok && !h1 && !h2;
    key('Escape', { target: input() }); await sleep(30);
    ts.value = ''; if (window._penumbraSearchAPI && window._penumbraSearchAPI.runTableSearch) { window._penumbraSearchAPI.runTableSearch(); } await sleep(600);
  };
  // the photographs (round 14): "sponsor nih" and a text nothing matches, Dark Blue at the runner's 1500px window
  async function shot14(text) {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=' + SCN + '&id=zzconf');
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue'); await sleep(150);
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });
    var ok = await open(text); await sleep(300);
    R.chk.open = ok && !!box() && rows().some(function (r) { return r.section === 'Filter and find'; });
  }
  S.pshot14a = async function () { await shot14('sponsor nih'); };
  S.pshot14b = async function () { await shot14('zzqx'); };

  // ---------------------------------------------------------------- pvo (round 15)
  // the dialogs' own words; the View Options rows (count, state, selecting opens the editor on the option, focused,
  // unchanged); the console's tabs; the scheduler's own new-task path (Add once with EMAIL, nothing saved); a viewer: none
  S.pvo = async function () {
    await boot(); await ready();
    var was = { a: penumbra_vars.isAdmin, g: penumbra_vars.isGlobalAdmin, s: penumbra_vars.canScheduleReport };
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true; penumbra_vars.canScheduleReport = true;
    function vo() { return rows().filter(function (r) { return r.text.indexOf('View Options:') === 0; }); }
    var ok = await open('wysiwyg'); await sleep(200);
    R.info.wys = texts().slice(0, 4);
    R.info.reg = [pal('registry')().filter(function (e) { return e.id === 'pivot' || e.id === 'copy'; }), (P() && P().uiWords) ? [String(P().uiWords('pivot')).slice(0, 120), String(P().uiWords('copy')).slice(0, 120)] : null];
    var pl = document.querySelectorAll('#pivotLightbox'), pl0 = pl[0] || null;
    R.info.pivotDlg = [pl.length, pl0 ? pl0.querySelectorAll('.pnb-dlg-title, .pnb-dlg-sub, label, small, h4, legend, button, option, .pnb-subset-tip').length : -1, pl0 ? pl0.textContent.replace(/\s+/g, ' ').slice(0, 100) : null, pl0 ? pl0.parentNode.id : null];
    R.chk.wysiwyg = ok && !!row('Copy table data to the clipboard');
    type('cross-tab'); await sleep(120); var pv = !!row('Pivot table builder');
    type('collapse'); await sleep(120); var gr = !!row('Group the table');
    type('recipients'); await sleep(120); var em = !!row('Email the table data');
    R.info.more = [pv, gr, em];
    R.chk.uiWordsMore = ok && pv && gr && em;
    type('freeze'); await sleep(120); var fi = rowIndex('Freeze'), si = rowIndex('Data snapshots');
    R.info.freeze = [fi, si, texts().slice(0, 6)];
    R.chk.uiBelowLabel = fi >= 0 && si > fi;
    type('view options'); await sleep(200);
    var more = row('Show '); R.info.vo1 = [vo().length, more ? more.text : null];
    if (more) { var pm = await pickRow('Show '); if (pm) { await enter(); } await sleep(200); }
    var tab = document.getElementById('view-options-tab');
    var want = tab ? tab.querySelectorAll('.view-option-item input[type="checkbox"]').length + 4 : -1;   // + layout, title, subtitle, sort orders (the journal row features are hidden)
    R.info.vo2 = [vo().length, want, vo().map(function (r) { return r.text + ' | ' + r.sub; })];
    R.chk.voCount = ok && vo().length === want && want >= 10;
    R.chk.voState = vo().some(function (r) { return /^(on|off); /.test(r.sub); }) && vo().some(function (r) { return /^Default; /.test(r.sub); });
    var cb = document.getElementById('viewOptionClickFilter'), before = cb ? cb.checked : null;
    var picked = await pickRow('View Options: Click-to-Filter'); if (picked) { await enter(); } await sleep(800);
    var active = -1; try { active = $('#editorTabs').tabs('option', 'active'); } catch (e) { }
    var voIdx = $('#editorTabs > ul > li > a[href="#view-options-tab"]').parent().index();
    R.info.sel = [picked, document.body.classList.contains('admin-view'), active, voIdx, cb ? cb.checked : null, before, document.activeElement ? document.activeElement.id : null, $('#view-options-tab').is(':visible')];
    R.chk.optionOpens = picked && !box() && document.body.classList.contains('admin-view') && active === voIdx && voIdx >= 0 && $('#view-options-tab').is(':visible');
    R.chk.optionFocused = picked && !!cb && document.activeElement === cb && cb.closest('.view-option-item').classList.contains('pnb-pal-spot');
    R.chk.optionUnchanged = picked && !!cb && cb.checked === before;
    await open('auditor'); await sleep(150);
    var tr = row('Open the editor on Auditor'); R.info.tabs = texts().slice(0, 5);
    type('open the editor'); await sleep(150);
    var nTabs = $('#editorTabs > ul > li > a').length, tabRows = rows().filter(function (r) { return r.text.indexOf('Open the editor on ') === 0; }).length;
    R.info.tabN = [nTabs, tabRows];
    R.chk.tabRows = !!tr && !tr.off && tabRows === nTabs && nTabs >= 4;
    var clicks = 0, jq = 0, btn = document.getElementById('addNewTaskBtn'); if (btn) { btn.addEventListener('click', function () { clicks++; }, true); $(btn).on('click', function () { jq++; }); }
    var xhrUrls = [], xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { xhrUrls.push(String(u)); return xo.apply(this, arguments); };
    await open('schedule an email'); picked = await pickRow('Schedule an email of this report'); if (picked) { await enter(); } await sleep(800);
    try { active = $('#editorTabs').tabs('option', 'active'); } catch (e) { }
    var schIdx = $('#editorTabs > ul > li > a[href="#scheduler-tab"]').parent().index();
    var saves = xhrUrls.filter(function (u) { return /manage_schedule|schedule_save|save_schedule|save_task/i.test(u); });
    R.info.sched = [picked, clicks, jq, $('#schedNewEventType').val(), active, schIdx, $('#schedulerPlaceholder').is(':visible'), $('.scheduler-config-panel').is(':visible'), xhrUrls.filter(function (u) { return /sched|task/i.test(u); })];
    R.chk.schedRow = picked && !box() && (clicks === 1 || jq === 1) && clicks <= 1 && jq <= 1 && $('#schedNewEventType').val() === 'EMAIL' && active === schIdx && schIdx >= 0 && saves.length === 0;
    XMLHttpRequest.prototype.open = xo;
    await open('manage sched'); var mr = row("Manage this report's schedules"); R.chk.manageRow = !!mr && !mr.off;   // (two words: three would be a question, loosely matched and capped)
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isAdmin = false; penumbra_vars.isGlobalAdmin = false;
    await open('view options'); await sleep(150); var v1 = vo().length;
    type('schedule an email'); await sleep(120); var v2 = !!row('Schedule an email');
    type('open the editor'); await sleep(120); var v3 = rows().filter(function (r) { return r.text.indexOf('Open the editor on ') === 0; }).length;
    R.info.viewer = [v1, v2, v3];
    R.chk.viewerNoRows = ok && v1 === 0 && !v2 && v3 === 0;
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isAdmin = was.a; penumbra_vars.isGlobalAdmin = was.g; penumbra_vars.canScheduleReport = was.s;
  };
  // the photograph (round 15): "view options" as an admin, Dark Blue
  S.pshot15 = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pshot15&id=zzconf');
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue'); await sleep(150);
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true;
    var ok = await open('view options'); await sleep(300);
    R.chk.open = ok && !!box() && rows().some(function (r) { return r.text.indexOf('View Options:') === 0; });
  };

  // ---------------------------------------------------------------- pjar (round 16)
  // Ask Jarvis: the row and its gate, the ranking, nothing sent by listing, Enter opens the console on the panel and
  // the panel's own send runs once with the text (the summary box untouched), the popped-out console takes it
  S.pjar = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pjar&id=zzconf');
    var was = { a: penumbra_vars.isAdmin, g: penumbra_vars.isGlobalAdmin, ai: penumbra_vars.aiAllowed, u: penumbra_vars.aiProxyUrl };
    penumbra_vars.aiProxyUrl = 'ai_assist_stub.json';
    // the panel sends through $.ajax, which the harness answers from its fixture: the stub reply is answered here, the body kept
    var sent = [], ajaxWas = $.ajax;
    $.ajax = function (o) {
      if (o && String(o.url || '').indexOf('ai_assist_stub.json') >= 0) {
        sent.push(String(o.data || '')); setTimeout(function () { if (o.success) { o.success({ status: 'success', reply: 'A stub answer.' }); } }, 60);
        return { done: function () { return this; }, fail: function () { return this; }, always: function () { return this; } };
      }
      return ajaxWas.apply(this, arguments);
    };
    function jrow() { return row('Ask Jarvis:'); }
    function lastSent(i) { try { var b = JSON.parse(sent[i]); return b.messages[b.messages.length - 1]; } catch (e) { return null; } }
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true; penumbra_vars.aiAllowed = true;
    var ok = await open('how do I sum a column'); await sleep(200);
    var r1 = jrow(); R.info.admin = [r1, texts().slice(0, 3), selIdx()];
    R.chk.rowForAdmin = ok && !!r1 && !r1.off;
    R.chk.rankQuestion = ok && !!rows()[0] && rows()[0].text.indexOf('Ask Jarvis:') === 0 && !!rows()[1] && rows()[1].text.indexOf('Ask help:') === 0 && selIdx() === 0;
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.isAdmin = false; penumbra_vars.isGlobalAdmin = false; penumbra_vars.aiAllowed = true;   // a grant holder or an owner: the server's flag says yes
    await open('select * from awards'); await sleep(200);
    var r2 = jrow(); R.info.grant = [r2, texts().slice(0, 3)];
    R.chk.rowForGrant = ok && !!r2 && !r2.off;
    R.chk.rankSql = !!rows()[0] && rows()[0].text.indexOf('Ask Jarvis:') === 0 && !!rows()[1] && rows()[1].text.indexOf('Ask help:') === 0;
    key('Escape', { target: input() }); await sleep(30);
    await open('fr'); await sleep(200); var idxJ = rowIndex('Ask Jarvis:'), idxH = rowIndex('Ask help:'), n = rows().length;
    R.info.plain = [idxJ, idxH, n];
    R.chk.rankPlain = idxJ === n - 1 && idxH === n - 2 && idxH > 0;
    await open('zzqx'); await sleep(250);
    var jz = jrow(); R.info.empty = [jz, rows().map(function (r) { return r.section + ': ' + r.text; })];
    R.chk.emptyState = !!jz && jz.section === 'Filter and find' && !!rows()[0] && rows()[0].section === 'Filter and find';
    R.chk.nothingSentOnOpen = ok && sent.length === 0;
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.aiAllowed = false;
    await open('how do I sum a column'); await sleep(200);
    R.chk.noRowViewer = ok && !jrow() && !!row('Ask help:');
    key('Escape', { target: input() }); await sleep(30);
    penumbra_vars.aiAllowed = true;
    var sum = document.getElementById('aiProfileOn'), sumBefore = sum ? sum.checked : null;
    await open('how do I sum a column'); var picked = await pickRow('Ask Jarvis:'); if (picked) { await enter(); } await sleep(1000);
    var msgs = Array.prototype.map.call(document.querySelectorAll('#aiChatMessages .ai-msg.user'), function (m) { return m.textContent.trim(); });
    var aiIn = document.getElementById('aiChatInput');
    R.info.dbg = [aiIn ? aiIn.value : null, $('#aiAssistPanel').is(':visible'), document.body.classList.contains('admin-view'), typeof window._pnbById, aiIn ? Object.keys($._data(aiIn, 'events') || {}) : null, (window.__toasts || []).slice(-2), $('#toggleAiPanel').length, $('#aiAssistPanel').length];
    var last = sent.length ? lastSent(0) : null;
    R.info.send = [picked, sent.length, msgs, last ? last.content.slice(0, 60) : null, document.body.classList.contains('admin-view'), $('#aiAssistPanel').is(':visible'), sum ? sum.checked : null];
    R.chk.sendsOnce = picked && !box() && sent.length === 1 && !!last && last.role === 'user' && last.content.indexOf('how do I sum a column') === 0 && msgs.indexOf('how do I sum a column') >= 0;
    R.chk.panelOpens = picked && document.body.classList.contains('admin-view') && $('#aiAssistPanel').is(':visible');
    R.chk.summaryUntouched = picked && !!sum && sum.checked === sumBefore;
    await sleep(600);
    // popped out: the console's node lives in another window (window._admPip.win, as main.js pops it out)
    sent.length = 0;
    var wrap = document.getElementById('admWrapper'); $('#toggleAdminViewBtn').click(); await sleep(500);
    var ifr = document.createElement('iframe'); ifr.id = 'zzPip'; ifr.style.cssText = 'width:600px;height:300px;'; document.body.appendChild(ifr); await sleep(150);
    var pdoc = ifr.contentDocument; pdoc.body.appendChild(wrap); wrap.style.display = 'block';
    var pipWas = window._admPip ? window._admPip.win : undefined; if (window._admPip) { window._admPip.win = ifr.contentWindow; }
    await open('how do I sum a column'); picked = await pickRow('Ask Jarvis:'); if (picked) { await enter(); } await sleep(1000);
    var pin = pdoc.getElementById('aiChatInput'), last2 = sent.length ? lastSent(0) : null;
    R.info.pip = [picked, sent.length, pin ? pin.value : null, last2 ? last2.content.slice(0, 40) : null, document.body.classList.contains('admin-view'), !!document.getElementById('admWrapper')];
    R.chk.popOut = picked && !box() && sent.length === 1 && !!last2 && last2.content.indexOf('how do I sum a column') === 0 && !document.body.classList.contains('admin-view');
    if (window._admPip) { window._admPip.win = pipWas; }
    document.body.appendChild(wrap); ifr.remove(); await sleep(150);
    $.ajax = ajaxWas;
    penumbra_vars.isAdmin = was.a; penumbra_vars.isGlobalAdmin = was.g; penumbra_vars.aiAllowed = was.ai; penumbra_vars.aiProxyUrl = was.u;
    history.replaceState(null, '', window.location.pathname + '?scn=pjar');
  };
  // the photograph (round 16): a question as an admin, Ask Jarvis first, Dark Blue
  S.pshot16 = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pshot16&id=zzconf');
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue'); await sleep(150);
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });
    penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true; penumbra_vars.aiAllowed = true;
    var ok = await open('how do I sum a column'); await sleep(300);
    R.chk.open = ok && !!box() && !!row('Ask Jarvis:');
  };

  // ---------------------------------------------------------------- pchip (round 17)
  // Jarvis's suggested quick actions: the canned reply's block becomes chips for the valid suggestions only (an unknown id, an
  // invented action, a hidden column dropped; four at most), the block never shows as text, the Group chip opens the dialog with
  // V_STATUS and List chosen and applies nothing, a viewer loses the gated ones (Save, View Options)
  // the panel sends through $.ajax, which the harness answers from its fixture: the canned chips reply (ai_assist_chips.json, read once) is
  // answered here as the panel's send expects it
  var chipsReply = null, ajaxChipsWas = null;
  function chipsAjaxOn() {
    if (chipsReply === null) { var x = new XMLHttpRequest(); x.open('GET', 'ai_assist_chips.json', false); x.send(); chipsReply = JSON.parse(x.responseText); }
    if (ajaxChipsWas) { return; }
    ajaxChipsWas = $.ajax;
    $.ajax = function (o) {
      if (o && String(o.url || '').indexOf('ai_assist_chips.json') >= 0) {
        setTimeout(function () { if (o.success) { o.success(chipsReply); } }, 60);
        return { done: function () { return this; }, fail: function () { return this; }, always: function () { return this; } };
      }
      return ajaxChipsWas.apply(this, arguments);
    };
  }
  function chipsAjaxOff() { if (ajaxChipsWas) { $.ajax = ajaxChipsWas; ajaxChipsWas = null; } }
  async function askPanel(q) {
    chipsAjaxOn();
    var inp = document.getElementById('aiChatInput'), before = document.querySelectorAll('#aiChatMessages .ai-msg.assistant').length;
    inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true }));
    $('#aiSendBtn').click();   // the panel's own send (a synthetic Enter on the textarea does not reach its handler here)
    await until(function () { return document.querySelectorAll('#aiChatMessages .ai-msg.assistant').length > before; }, 6000); await sleep(900);
    return $('#aiChatMessages .ai-msg.assistant').last()[0] || null;
  }
  function chipsOf(m) { return m ? Array.prototype.map.call(m.querySelectorAll('.ai-action-chip'), function (c) { return c.textContent.trim(); }) : []; }
  async function panelUp() {
    if (!document.body.classList.contains('admin-view')) { $('#toggleAdminViewBtn').click(); await sleep(500); }
    if (!$('#aiAssistPanel').is(':visible')) { $('#toggleAiPanel').click(); await sleep(250); }
  }
  S.pchip = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pchip&id=zzconf');
    var was = { a: penumbra_vars.isAdmin, g: penumbra_vars.isGlobalAdmin, ai: penumbra_vars.aiAllowed, u: penumbra_vars.aiProxyUrl };
    penumbra_vars.aiProxyUrl = 'ai_assist_chips.json'; penumbra_vars.aiAllowed = true; penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true;
    var thL = fth('V_LINK'); thL.style.display = 'none';
    await panelUp();
    var m1 = await askPanel('group it'); var ls = chipsOf(m1), txt = m1 ? m1.textContent : '';
    R.info.chips = [ls, txt.slice(0, 200)];
    R.chk.validRender = ls.length >= 3 && ls.some(function (l) { return /^Group by V_STATUS as List/.test(l); }) && ls.some(function (l) { return /^Filter: V_STATUS = Open/.test(l); }) && ls.some(function (l) { return /^Sort ascending/.test(l); });
    R.chk.unknownDropped = ls.length > 0 && !ls.some(function (l) { return /teleport|zzz/i.test(l); });
    R.chk.hiddenColDropped = ls.length > 0 && !ls.some(function (l) { return /V_LINK/.test(l); });
    R.chk.blockNeverRaw = !!m1 && txt.indexOf('penumbra-actions') < 0 && txt.indexOf('```') < 0 && txt.indexOf('"id"') < 0 && /Group the rows by their status/.test(txt);
    R.chk.maxFour = ls.length > 0 && ls.length <= 4;
    var gc = m1 ? Array.prototype.filter.call(m1.querySelectorAll('.ai-action-chip'), function (c) { return /^Group by V_STATUS as List/.test(c.textContent.trim()); })[0] : null;
    if (gc) { gc.click(); } await sleep(700);
    var gl = document.getElementById('groupingLightbox'), selv = document.querySelector('#groupingColumnSelector .pcs-selected');
    R.info.group = [!!gc, gl ? gl.style.display : null, selv ? selv.getAttribute('data-value') : null, (document.getElementById('groupLayout') || {}).value, document.body.classList.contains('group-mode-active')];
    R.chk.chipOpensPreselected = !!gc && !!gl && gl.style.display !== 'none' && !!selv && selv.getAttribute('data-value') === 'V_STATUS' && (document.getElementById('groupLayout') || {}).value === 'list';
    R.chk.chipOpensNotApplies = R.chk.chipOpensPreselected && !document.body.classList.contains('group-mode-active');
    if (gl) { gl.style.display = 'none'; }
    penumbra_vars.isAdmin = false; penumbra_vars.isGlobalAdmin = false;
    var m2 = await askPanel('group it again'); var vl = chipsOf(m2);
    R.info.viewer = vl;
    R.chk.viewerGatedDropped = vl.length > 0 && !vl.some(function (l) { return /^Save|^View Options/.test(l); }) && ls.some(function (l) { return /^Save/.test(l); });
    thL.style.display = ''; chipsAjaxOff();
    penumbra_vars.isAdmin = was.a; penumbra_vars.isGlobalAdmin = was.g; penumbra_vars.aiAllowed = was.ai; penumbra_vars.aiProxyUrl = was.u;
    history.replaceState(null, '', window.location.pathname + '?scn=pchip');
  };
  // the photograph (round 17): a reply with chips under it, Dark Blue
  S.pshot17 = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pshot17&id=zzconf');
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue'); await sleep(150);
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });
    penumbra_vars.aiProxyUrl = 'ai_assist_chips.json'; penumbra_vars.aiAllowed = true; penumbra_vars.isAdmin = true; penumbra_vars.isGlobalAdmin = true;
    await panelUp();
    var m = await askPanel('How should I look at the open ones?');
    R.chk.open = !!m && chipsOf(m).length > 0;
  };

  // ---------------------------------------------------------------- pshot6 (round 6)
  // the page as the runner photographs it: the breadcrumb with the "?" and the magnifier beside it,
  // the profile card open with its "Search actions and reports" row; the rects for the crops
  S.pshot6 = async function () {
    await boot(); await ready();
    var seg = document.getElementById('zzUserSeg'), ubtn = document.getElementById('zzUserBtn');
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });   // (the plumbing's save-state lightbox sits over the page: not in the photo)
    seg.classList.add('sb-open'); ubtn.setAttribute('aria-expanded', 'true');
    // the plumbing's inputs sit over the page's top: the trail is lifted into a box of its own for the photo
    var crumb = document.getElementById('zzCrumb');
    if (crumb) { crumb.style.cssText = 'position:fixed;top:300px;left:420px;z-index:99999;background:var(--bg-surface,#fff);padding:10px 14px;border:1px solid #ccc;border-radius:6px;display:inline-flex;align-items:center;gap:6px;'; }
    window.scrollTo(0, 0); await sleep(150);
    function rect(id) { var e = document.getElementById(id); if (!e) return null; var b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }
    R.info.rects = { crumb: rect('zzCrumb'), card: rect('zzUserPop'), mag: rect('searchPaletteIcon'), footViewer: rect('zzFootViewer'), footAdmin: rect('zzFootAdmin') };
    (function () { var fa = document.getElementById('zzFootAdmin'), b = fa ? fa.getBoundingClientRect() : null, e = b ? document.elementFromPoint(b.left + 40, b.top + 10) : null; R.info.topmost = e ? (e.tagName + '#' + e.id + '.' + e.className) : null; R.info.bodyClass = document.body.className; })();
    var m = R.info.rects.mag, w = R.info.rects.footAdmin, v = R.info.rects.footViewer;
    R.chk.crumbShown = !!m && m[2] > 0 && m[3] > 0 && m[1] >= 0 && m[1] < window.innerHeight;
    R.chk.footShown = !!w && !!v && w[2] > 0 && w[3] > 0 && w[1] >= 0 && w[1] + w[3] <= window.innerHeight && !!document.querySelector('#zzFootAdmin a[data-pnb-palette]');
  };
  // (round 10) the same card in the dark theme: both footers with their Search button
  S.pshot10 = async function () {
    await boot(); await ready();
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue');
    var seg = document.getElementById('zzUserSeg'), ubtn = document.getElementById('zzUserBtn');
    Array.prototype.forEach.call(document.querySelectorAll('.help-lightbox'), function (l) { l.style.display = 'none'; });   // (the plumbing's save-state lightbox sits over the page: not in the photo)
    seg.classList.add('sb-open'); ubtn.setAttribute('aria-expanded', 'true');
    window.scrollTo(0, 0); await sleep(200);
    function rect(id) { var e = document.getElementById(id); if (!e) return null; var b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }
    R.info.rects = { card: rect('zzUserPop'), footViewer: rect('zzFootViewer'), footAdmin: rect('zzFootAdmin') };
    var w = R.info.rects.footAdmin;
    R.chk.open = !!w && w[2] > 0 && !!document.querySelector('#zzFootAdmin a[data-pnb-palette]') && document.body.classList.contains('theme-dark-blue');
  };

  // ---------------------------------------------------------------- pfn (round 7)
  // the Functions and tags section: the index fetched once, on the first open and never before; the
  // loading row; the rows (signature, summary, where), their ranking (names, then parameters and
  // options, then summaries), the cap; the anchors; the inserts, each in its own editor only
  var fnReq = 0, fnDelay = 0;
  (function () {   // from the page's first moment: every request for the index is counted (and may be slowed)
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__fn = /help_functions/.test(String(u)); if (this.__fn) { fnReq++; } return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { var x = this, a = arguments; if (x.__fn && fnDelay) { setTimeout(function () { xs.apply(x, a); }, fnDelay); return; } return xs.apply(x, a); };
  })();
  function fnSec() { return rows().filter(function (r) { return r.section === 'Functions and tags'; }); }
  function fnRow(startsWith) { return fnSec().filter(function (r) { return r.text.indexOf(startsWith) === 0; })[0] || null; }
  function fnStateOf() { return (P() && P().fnState) ? P().fnState() : null; }
  async function openFromCm(cm, text) {
    if (box()) { key('Escape', { target: input() }); await sleep(30); }
    cm.focus(); key('k', { ctrl: true, target: cm.getInputField() });
    var ok = await until(function () { return !!box() && modeOf() === 'root'; }, 3000);
    if (ok && text) { type(text); await sleep(60); }
    return ok;
  }
  function expectedFnTemplate(cm, id, signature) {
    try {
      var H = window.PenumbraSnippetHelp, h = H.hint(cm, {}), list = (h && h.list) || [], i, d;
      for (i = 0; i < list.length; i++) { d = String(list[i].displayText || ''); if (d === id) { return String(list[i].text); } }
      for (i = 0; i < list.length; i++) { d = String(list[i].displayText || ''); if (d.indexOf(id + '(') === 0) { return String(list[i].text); } }
    } catch (e) { }
    return signature;
  }
  S.pfn = async function () {
    await boot(); await ready(); await sleep(400);   // (the idle prefetch has loaded the module by now)
    R.info.lazy = [fnReq, fnStateOf()];
    R.chk.lazyIndex = fnReq === 0 && fnStateOf() === 'idle';
    // the first open fetches the index; a slowed answer shows the loading row
    fnDelay = 400;
    await open('sum');
    var lr = fnSec()[0] || null;
    R.info.loading = [lr, fnStateOf()];
    R.chk.loadingRow = !!lr && lr.loading && /Loading the functions and tags/.test(lr.text) && lr.off;
    fnDelay = 0;
    var ready7 = await until(function () { return fnStateOf() === 'ready'; }, 6000); await sleep(80);
    var sumRow = fnRow('sum(');
    R.info.sum = sumRow;
    R.chk.fnRow = ready7 && !!sumRow && sumRow.pill === 'browser + email' && /sum of a numeric column/.test(sumRow.sub) && !sumRow.off;
    R.chk.fetchedOnce = fnReq === 1;
    key('Escape', { target: input() }); await sleep(30);
    await open('sum');
    R.chk.cachedInMemory = fnReq === 1 && !!fnRow('sum(');
    // a parameter name finds the functions that take it; a name outranks a parameter
    type('CONDITION'); await sleep(60);
    var byParam = fnSec();
    R.info.param = byParam.slice(0, 4).map(function (r) { return r.text + ' | ' + r.sub.slice(0, 30); });
    R.chk.paramQuery = byParam.some(function (r) { return r.text.indexOf('count(') === 0 && r.sub.indexOf('CONDITION: ') === 0; }) && byParam.some(function (r) { return r.text.indexOf('sum(') === 0; });
    type('count'); await sleep(60);
    R.chk.namesFirst = fnSec().length > 0 && fnSec()[0].text.indexOf('count(') === 0;
    // the tags: an option name finds its tag (the row says which option); the two subquery tags
    type('noquote'); await sleep(60);
    var pr = fnRow('[PROMPT');
    R.info.noquote = pr;
    R.chk.tagOption = !!pr && pr.sub.indexOf('noquote ') === 0 && pr.pill === 'SQL editor';
    type('subquery'); await sleep(60);
    R.chk.tagRows = !!fnRow('[SUBQUERY') && !!fnRow('[CTE_SUBQUERY');
    // one letter finds nothing; "row" matches many summaries: eight, then Show N more
    type('s'); await sleep(60);
    R.chk.fnMinChars = ready7 && fnSec().length === 0;   // (never vacuous: the index is there)
    type('row'); await sleep(60);
    var capped = fnSec(), more = capped.filter(function (r) { return r.more; })[0];
    R.info.cap = [capped.length, more ? more.text : null];
    R.chk.fnCap = capped.length === 9 && !!more && /^Show \d+ more/.test(more.text);
    if (more) { await pickRow(more.text); await enter(); await sleep(100); }
    var all = fnSec();
    R.chk.fnMore = !!box() && all.length > 9 && !all.some(function (r) { return r.more; });
    // Enter opens the reference at the entry's heading: a function's id, a tag's syntax section, an
    // option's table
    type('sum'); await sleep(60); await pickRow('sum(', 'Functions and tags'); await enter(); await sleep(60);
    var ho = window.__helpOpens.slice(-1)[0] || [];
    R.info.anchors = [ho];
    R.chk.anchorFn = !box() && ho[0] === 'optionsHelpLightbox' && ho[1] === 'sum';
    await open('prompt'); await pickRow('[PROMPT', 'Functions and tags'); await enter(); await sleep(60);
    ho = window.__helpOpens.slice(-1)[0] || []; R.info.anchors.push(ho);
    R.chk.anchorTag = !box() && ho[0] === 'promptsHelpLightbox' && ho[1] === 'prompts';
    await open('noquote'); await pickRow('[PROMPT', 'Functions and tags'); await enter(); await sleep(60);
    ho = window.__helpOpens.slice(-1)[0] || []; R.info.anchors.push(ho);
    R.chk.anchorOption = !box() && ho[0] === 'promptsHelpLightbox' && ho[1] === 'pr-params';
    // from the Custom Code editor: the section leads, Shift+Enter inserts the editor's own template at the cursor
    var cmS = window.CodeMirror(document.body, { mode: 'snippet', value: 'Total:  here' }), sumSig = (sumRow && sumRow.text) || '';
    cmS.setCursor({ line: 0, ch: 7 });
    var tpl = expectedFnTemplate(cmS, 'sum', sumSig);   // (read BEFORE the insert: the hint's list follows the token at the cursor)
    var okS = await openFromCm(cmS, 'sum');
    R.chk.editorFirst = okS && rows().length > 0 && rows()[0].section === 'Functions and tags';
    var sRow = fnRow('sum('); await pickRow('sum(', 'Functions and tags');
    key('Enter', { shift: true, target: input() }); await sleep(120);
    R.info.insert = [sRow && sRow.insert, cmS.getValue().slice(0, 80), tpl.slice(0, 60), cmS.hasFocus()];
    R.chk.insertSnippet = !!sRow && sRow.insert && !box() && cmS.getValue() === 'Total: ' + tpl + ' here' && cmS.hasFocus();
    R.chk.insertCursor = cmS.getValue().indexOf('Total: ' + tpl.slice(0, 4)) === 0 && /here$/.test(cmS.getValue());
    // ...a tag has no insert there
    await openFromCm(cmS, 'prompt'); var pS = fnRow('[PROMPT');
    R.chk.insertOnlySql = !!pS && !pS.insert;
    key('Escape', { target: input() }); await sleep(30);
    // from the SQL editor: a tag inserts, a function does not (Shift+Enter then opens its reference instead)
    var cmQ = window.CodeMirror(document.body, { mode: 'text/x-sql', value: 'SELECT 1 FROM dual WHERE x = ' });
    cmQ.setCursor({ line: 0, ch: cmQ.getValue().length });
    await openFromCm(cmQ, 'prompt'); var pQ = fnRow('[PROMPT'); await pickRow('[PROMPT', 'Functions and tags');
    key('Enter', { shift: true, target: input() }); await sleep(120);
    R.info.sqlInsert = [pQ && pQ.insert, cmQ.getValue()];
    R.chk.insertSql = !!pQ && pQ.insert && !box() && cmQ.getValue() === 'SELECT 1 FROM dual WHERE x = [PROMPT;type=text;name=text1;message=Enter text]' && cmQ.hasFocus();
    var before = cmQ.getValue(), opens = window.__helpOpens.length;
    await openFromCm(cmQ, 'sum'); var sQ = fnRow('sum('); await pickRow('sum(', 'Functions and tags');
    key('Enter', { shift: true, target: input() }); await sleep(120);
    R.info.sqlFn = [sQ && sQ.insert, cmQ.getValue() === before, window.__helpOpens.length - opens];
    R.chk.insertOnlySnippet = !!sQ && !sQ.insert && cmQ.getValue() === before && !/sum\(/.test(cmQ.getValue());
    if (box()) { key('Escape', { target: input() }); await sleep(30); }
    // from the page itself nothing inserts
    await open('sum'); var sB = fnRow('sum(');
    R.chk.noInsertFromBody = !!sB && !sB.insert && !/Shift\+Enter/.test(document.getElementById('pnbPaletteList').textContent);
    key('Escape', { target: input() });
  };
  // ---------------------------------------------------------------- pfeed (round 8)
  // "Send feedback to the report owner...": absent without a saved report, the author's FIRST rendered
  // action(feedback) call reused (label, types, to:, freeze:LABEL; the commented-out call ignored), the
  // default spec with the freeze checkbox otherwise, nothing sent on open, greyed for the owner
  var sendReq = 0;
  (function () {
    var xo = XMLHttpRequest.prototype.open, f0 = window.fetch;
    XMLHttpRequest.prototype.open = function (m, u) { if (/submit_home_form/.test(String(u))) { sendReq++; } return xo.apply(this, arguments); };
    if (f0) { window.fetch = function (u) { if (/submit_home_form/.test(String(u))) { sendReq++; } return f0.apply(this, arguments); }; }
  })();
  function modal() { return document.querySelector('.pf-modal'); }
  function modalInfo() {
    var m = modal(); if (!m) return null;
    var sel = m.querySelector('select[name="type"]'), fz = m.querySelector('input[name="freeze"]'), fzLab = fz ? m.querySelector('label[for="' + fz.id + '"]') : null;
    return { title: (m.querySelector('.pf-title') || {}).textContent, intro: (m.querySelector('.pf-sub') || {}).textContent,
             types: sel ? Array.prototype.map.call(sel.options, function (o) { return o.value; }) : null,
             freeze: !!fz, freezeChecked: !!(fz && fz.checked), freezeLabel: fzLab ? fzLab.textContent : null,
             labels: Array.prototype.map.call(m.querySelectorAll('label.pf-label'), function (l) { return l.textContent.replace(/\s+/g, ' ').trim(); }) };
  }
  async function openFeedbackViaBox() {
    await open('feedback'); var r = row('Send feedback'); if (!r || r.off) return r;
    await pickRow('Send feedback'); await enter();
    await until(function () { return !!modal(); }, 8000); await sleep(150);
    return r;
  }
  function closeModal() { var c = document.querySelector('.pf-modal .pf-close'); if (c) c.click(); }
  S.pfeed = async function () {
    await boot(); await ready();
    var link = document.querySelector('#reportSnippetOutput a.snippet-action[data-action-name="feedback"]');
    R.info.link = [link ? link.textContent : null, link ? link.getAttribute('data-action-value') : null, document.querySelectorAll('#reportSnippetOutput a.snippet-action[data-action-name="feedback"]').length];
    // 1. no ?id= in the address: not a saved report, the row is absent
    await open('feedback'); R.chk.absentWithoutId = !!box() && !row('Send feedback');
    key('Escape', { target: input() }); await sleep(30);
    history.replaceState(null, '', window.location.pathname + '?scn=pfeed&id=zzconf');
    // 2. the author's first rendered call: its label, types, to: and freeze:LABEL; the commented-out one ignored
    var r = await openFeedbackViaBox(); var m = modalInfo();
    R.info.authored = [r, m, sendReq];
    R.chk.entryShown = !!r && !r.off && r.section === 'Actions';
    R.chk.authoredSpec = !!m && m.title === 'Ask the data steward' && JSON.stringify(m.types) === JSON.stringify(['Bug', 'Question']) && m.freeze && !m.freezeChecked
      && m.freezeLabel === 'Freeze a copy of this dataset for review' && /contact for this report/.test(m.intro) && m.labels.some(function (l) { return /^What happened\?/.test(l); });
    R.chk.authoredNotCommented = !!m && m.title !== 'Old form' && m.types.indexOf('Commented out?') < 0 && m.title !== 'Second form';
    await sleep(500);
    R.chk.nothingSent = !!modal() && sendReq === 0;
    closeModal(); await sleep(60);
    // 3. no rendered call: the default three-way form with the freeze checkbox on offer
    document.getElementById('reportSnippetOutput').innerHTML = '';
    r = await openFeedbackViaBox(); m = modalInfo();
    R.info.dflt = [m, sendReq];
    R.chk.defaultSpec = !!m && m.title === 'Send feedback to the report owner' && JSON.stringify(m.types) === JSON.stringify(['Bug', 'Suggestion', 'Question']) && /owner of this report/.test(m.intro)
      && m.labels.some(function (l) { return /^What happened\?/.test(l); }) && m.labels.some(function (l) { return /^What would help\?/.test(l); });
    R.chk.defaultFreeze = !!m && m.freeze && !m.freezeChecked && m.freezeLabel === 'Freeze a copy of this dataset for review';
    closeModal(); await sleep(60);
    R.chk.nothingSent = R.chk.nothingSent && sendReq === 0;
    // 4. the owner: greyed with the reason
    penumbra_vars.isReportOwner = true;
    await open('feedback'); r = row('Send feedback'); R.info.owner = r;
    R.chk.ownerGreyed = !!r && r.off && r.why === 'You own this report, so feedback would come to you';
    penumbra_vars.isReportOwner = false;
    key('Escape', { target: input() });
  };
  // the photograph: the authored form open over the report
  S.pshot8 = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pshot8&id=zzconf');
    document.getElementById('reportSnippetOutput').innerHTML = '';   // the default form
    var r = await openFeedbackViaBox(); await sleep(200);
    R.chk.open = !!r && !!modal();
  };
  // ---------------------------------------------------------------- prank (round 9)
  // the rankings on real labels, the marks inside one word, the box's width, paddings and one-line footer
  function actRows() { return rows().filter(function (r) { return r.section === 'Actions' && !r.more; }); }
  function hasRow(re) { return rows().some(function (r) { return re.test(r.text); }); }
  S.prank = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=prank&id=zzconf');   // the feedback entry shows on a saved report
    // "bug": the feedback row leads through its keyword; no letters picked across words
    await open('bug'); var a = actRows();
    R.info.bug = rows().slice(0, 6).map(function (r) { return r.section + ': ' + r.text; });
    R.chk.rankBug = a.length > 0 && a[0].text.indexOf('Send feedback to the report owner') === 0 && !hasRow(/Find in the table/) && !hasRow(/Audit Log/);
    await open('feedback'); a = actRows();
    R.chk.rankFeedback = a.length > 0 && a[0].text.indexOf('Send feedback to the report owner') === 0;
    await open('fr'); a = actRows();
    R.info.fr = a.slice(0, 4).map(function (r) { return r.text; });
    R.chk.rankFr = a.length > 1 && a[0].text.indexOf('Freeze up to this column') === 0 && hasRow(/^Refresh the report/);
    await open('grp'); a = actRows();
    R.info.grp = a.slice(0, 4).map(function (r) { return r.text; });
    R.chk.rankGrp = a.length > 0 && a[0].text.indexOf('Group the table') === 0;
    var marks = Array.prototype.map.call(document.querySelectorAll('#pnbPalette .pnb-pal-it[data-id="group"] .pnb-pal-lab mark'), function (m) { return m.textContent; }).join('');
    R.info.marks = marks;
    R.chk.marksWord = marks === 'Grp';
    await open('exp'); a = actRows();
    R.info.exp = a.slice(0, 6).map(function (r) { return r.text; });
    R.chk.rankExp = a.length > 0 && /^Download/.test(a[0].text) && !hasRow(/Find in the table|Keyboard shortcuts|Scroll to the|admin controls/);
    // the box: 760px wide on this 1500px window, the footer one line with its "?" beside the hints
    var bx = box().querySelector('.pnb-pal'), foot = box().querySelector('.pnb-pal-foot'), hint = foot.querySelector('.pnb-pal-hint'), help = foot.querySelector('.pnb-pal-help');
    var bw = bx.getBoundingClientRect().width, fh = foot.getBoundingClientRect().height;
    R.info.box = [bw, fh, hint.getBoundingClientRect().top, help.getBoundingClientRect().top, getComputedStyle(foot).flexWrap];
    R.chk.boxWide = Math.round(bw) === 760;
    R.chk.footerOneLine = fh <= 44 && Math.abs(hint.getBoundingClientRect().top - help.getBoundingClientRect().top) < 6 && getComputedStyle(foot).flexWrap === 'nowrap';
    var cin = getComputedStyle(box().querySelector('.pnb-pal-in')), cbody = getComputedStyle(box().querySelector('.pnb-pal-body')), cfoot = getComputedStyle(foot);
    R.info.pad = [cin.padding, cbody.padding, cfoot.padding];
    R.chk.padding = cin.padding === '13px 15px' && cbody.padding === '9px 5px' && cfoot.padding === '11px 17px';
    // the owner's greyed row: the label whole, the reason capped at 42% with an ellipsis
    penumbra_vars.isReportOwner = true;
    await open('bug');
    var it = document.querySelector('#pnbPalette .pnb-pal-it[data-id="feedback"]'), lab = it && it.querySelector('.pnb-pal-lab'), why = it && it.querySelector('.pnb-pal-why');
    var labW = lab ? lab.getBoundingClientRect().width : 0, whyW = why ? why.getBoundingClientRect().width : 0, rowW = it ? it.getBoundingClientRect().width : 0;
    R.info.owner = [labW, whyW, rowW, why ? why.textContent : null, lab ? lab.firstChild.textContent : null];
    // the label itself ("Send feedback to the report owner...", ~230px) is whole: the lab box keeps at least 300px;
    // the reason is capped at half the row and shows whole when it fits
    R.chk.ownerLabelFits = !!it && labW >= 300 && whyW <= rowW * 0.5 + 1 && /so feedback would come to you/.test(why.textContent) && why.scrollWidth <= why.clientWidth + 1;
    penumbra_vars.isReportOwner = false;
    key('Escape', { target: input() });
  };
  // the photograph: "bug" as the owner, Amethyst, the window 1440 wide (run.py sets the viewport)
  S.pshot9 = async function () {
    await boot(); await ready();
    history.replaceState(null, '', window.location.pathname + '?scn=pshot9&id=zzconf');
    // (the harness carries main.css's theme classes, not index.php's emitted registry: Dark Blue is its dark theme)
    ['theme-dark-blue', 'theme-wolfpack', 'theme-charcoal-gold', 'theme-light-sepia'].forEach(function (c) { document.body.classList.remove(c); });
    document.body.classList.add('theme-dark-blue'); await sleep(150);
    penumbra_vars.isReportOwner = true;
    var ok = await open('bug'); await sleep(200);
    R.chk.open = ok && !!box() && !!row('Send feedback');
  };
  // ---------------------------------------------------------------- ptools / ptoolsv (round 12)
  // the Admin tools rows against the menu the page renders: an admin's page carries the menu (the real chrome's
  // output, menu + the tools JSON beside it) - every row matches a menu link, in the menu's order, with its
  // glyph and description; a row opens its tool through the menu's own link. A viewer's page has no menu:
  // no rows, no section, nothing typed finds a tool.
  function menuItems() { return Array.prototype.map.call(document.querySelectorAll('#zzFootAdmin .pnb-admmenu a[role="menuitem"]'), function (a) { return { label: a.textContent.replace(/^\S+\s+/, '').trim(), href: a.getAttribute('href'), glyph: a.textContent.trim().split(/\s+/)[0] }; }); }
  function toolRows() { return rows().filter(function (r) { return r.section === 'Admin tools'; }); }
  S.ptools = async function () {
    await boot(); await ready();
    var menu = menuItems(), list = window.PENUMBRA_ADMIN_TOOLS || [];
    R.info.menu = menu.map(function (m) { return m.label + '>' + m.href; });
    await open(''); var idle = toolRows();
    R.info.idle = idle.map(function (r) { return r.text + '>' + r.href; });
    var same = menu.length >= 5 && idle.length === menu.length && menu.every(function (m, i) { return idle[i] && idle[i].text === m.label && idle[i].href === m.href && !idle[i].off; });
    var glyphs = Array.prototype.map.call(document.querySelectorAll('#pnbPalette .pnb-pal-it[data-id^="tool:"] .pnb-pal-glyph'), function (g) { return g.textContent; });
    R.info.glyphs = glyphs;
    R.chk.toolsMatchMenu = same && glyphs.length === menu.length && glyphs.every(function (g, i) { return g === menu[i].glyph; }) && list.length === menu.length;
    R.chk.toolsDesc = idle.length > 0 && idle.every(function (r) { return r.sub && r.sub.length > 10; });   // (never vacuous)
    // typed: "gra" finds Grants first among the tools, by its name; "scheduled" finds the Calendar by its description
    type('gra'); await sleep(60); var t1 = toolRows();
    type('scheduled'); await sleep(60); var t2 = toolRows();
    R.info.typed = [t1.map(function (r) { return r.text; }), t2.map(function (r) { return r.text; })];
    R.chk.toolsTyped = t1.length > 0 && t1[0].text === 'Grants' && t2.some(function (r) { return r.text === 'Calendar'; });
    // a row opens its tool the way the menu does: through the menu's link (intercepted here, never followed)
    var opened = [];
    Array.prototype.forEach.call(document.querySelectorAll('#zzFootAdmin .pnb-admmenu a'), function (a) { a.addEventListener('click', function (e) { e.preventDefault(); opened.push(a.getAttribute('href')); }); });
    type('gra'); await sleep(60); await pickRow('Grants', 'Admin tools'); await enter(); await sleep(80);
    R.info.opened = opened;
    R.chk.toolOpens = !box() && opened.length === 1 && opened[0] === 'grants_admin.php';
    // the report tools are untouched on the report page: the Actions section still leads with them
    await open(''); R.chk.toolsAfterReport = rows().length > 0 && rows()[0].section !== 'Admin tools' && toolRows().length === menu.length;
    key('Escape', { target: input() });
  };
  S.ptoolsv = async function () {
    await boot(); await ready();
    var hasMenu = !!document.querySelector('.pnb-admmenu'), list = window.PENUMBRA_ADMIN_TOOLS;
    await open(''); var idle = toolRows();
    type('grants'); await sleep(60); var typed = toolRows();
    type('repository'); await sleep(60); var typed2 = toolRows();
    R.info.viewer = [hasMenu, list ? list.length : null, idle.length, typed.length, typed2.length, rows().map(function (r) { return r.section; }).filter(function (v, i, a) { return a.indexOf(v) === i; })];
    R.chk.viewerNoTools = !hasMenu && !list && idle.length === 0 && typed.length === 0 && typed2.length === 0 && rows().every(function (r) { return r.section !== 'Admin tools'; });
    key('Escape', { target: input() });
  };
  // ---------------------------------------------------------------- padmin (round 12)
  // an admin tool page (adm.html, the real status bar the chrome renders): the key opens the box, the admin
  // tools and the family settings are the rows, the report tools are absent, a row opens its tool, the card's
  // Quick actions button is there with the bolt, Esc and the focus as everywhere
  S.padmin = async function () {
    await until(function () { return document.readyState === 'complete'; }, 20000); await sleep(300);
    try { localStorage.removeItem(RECENT_KEY); } catch (e) { }
    await ready();
    var stub = document.querySelector('script[src*="penumbra_palette_boot.js"]');
    R.chk.adminStub = !!stub && /data-fn=/.test(stub.outerHTML) && !!(window.PENUMBRA_ADMIN_VARS && window.PENUMBRA_ADMIN_VARS.page === 'admin' && window.PENUMBRA_ADMIN_VARS.isAdmin === true);
    key('k', { ctrl: true, target: document.body }); var ok = await until(function () { return !!box() && modeOf() === 'root'; }, 5000); await sleep(80);
    R.chk.adminOpens = ok;
    var secs = rows().map(function (r) { return r.section; }).filter(function (v, i, a) { return a.indexOf(v) === i; }), ts = texts();
    R.info.rows = rows().map(function (r) { return r.section + ': ' + r.text; }).slice(0, 14);
    var menuN = document.querySelectorAll('#pnbStatusBar .pnb-admmenu a[role="menuitem"]').length;
    R.chk.adminRows = secs.indexOf('Admin tools') >= 0 && toolRows().length === menuN && menuN >= 5 && ts.indexOf('Grants') >= 0 && ts.indexOf('Health') >= 0;
    R.chk.adminSettings = secs.indexOf('For this page') >= 0 && ts.some(function (t) { return /Settings panel/.test(t); }) && ts.some(function (t) { return /^Theme/.test(t); }) && ts.indexOf('Help Center') >= 0;
    R.chk.adminPlaceholder = !!input() && input().getAttribute('placeholder') === 'Type an action, a tool or a report';
    type('pivot'); await sleep(60); var noPivot = !row('Pivot');
    type('download'); await sleep(60); var noDl = !row('Download');
    type('freeze'); await sleep(60); var noFreeze = !row('Freeze');
    type('refresh'); await sleep(60); var noRefresh = !row('Refresh the report');
    R.chk.adminNoReportTools = ok && noPivot && noDl && noFreeze && noRefresh;   // (never vacuous: the box was open)
    type('metrics for'); await sleep(60); R.chk.adminNoReportMetrics = ok && !row('Metrics for this report');   // (round 13)
    var opened = [];
    Array.prototype.forEach.call(document.querySelectorAll('#pnbStatusBar .pnb-admmenu a'), function (a) { a.addEventListener('click', function (e) { e.preventDefault(); opened.push(a.getAttribute('href')); }); });
    type('heal'); await sleep(60); await pickRow('Health', 'Admin tools'); await enter(); await sleep(80);
    R.chk.adminToolOpens = !box() && opened.length === 1 && opened[0] === 'health.php';
    var pb = document.querySelector('#pnbStatusBar .sb-upop-foot a[data-pnb-palette="open"]');
    R.chk.adminCardBtn = !!pb && /^\s*Quick actions\s*$/.test(pb.textContent) && !!pb.querySelector('svg.pnb-foot-ico polygon') && /\(Ctrl\+K\)$/.test(pb.title);
    // Esc chip and the focus back: open from the page's theme select, close with the chip
    var sel = document.getElementById('spThemeSelector'); sel.focus();
    key('k', { ctrl: true, target: sel }); await until(function () { return !!box(); }, 3000); await sleep(40);
    var bx = box(), chip = bx ? bx.querySelector('button.pnb-pal-esc') : null; if (chip) { chip.click(); } await sleep(60);   // (null-safe: the control has no box here)
    R.chk.adminEscBack = !!chip && !box() && document.activeElement === sel;
  };
  // the photograph: an admin page, "gra" typed
  S.pshot12 = async function () {
    await until(function () { return document.readyState === 'complete'; }, 20000); await sleep(300); await ready();
    key('k', { ctrl: true, target: document.body }); var ok = await until(function () { return !!box() && modeOf() === 'root'; }, 5000);
    type('gra'); await sleep(200);
    R.chk.open = ok && !!box() && toolRows().length > 0;
  };
  // the photographs: a function search from the Custom Code editor, a tag search from the SQL editor
  async function shot7(mode, value, text) {
    await boot(); await ready();
    var cm = window.CodeMirror(document.body, { mode: mode, value: value });
    cm.getWrapperElement().style.cssText = 'position:fixed;left:20px;top:120px;width:520px;height:120px;border:1px solid #ccc;z-index:5;background:#fff;';
    cm.setCursor({ line: 0, ch: value.length });
    var ok = await openFromCm(cm, text);
    await until(function () { return fnStateOf() === 'ready'; }, 6000); await sleep(150);
    R.chk.open = ok && !!box() && fnSec().length > 0;
  }
  S.pshot7f = async function () { await shot7('snippet', 'Total awarded: ', 'sum'); };
  S.pshot7t = async function () { await shot7('text/x-sql', 'SELECT * FROM awards WHERE fy = ', 'prompt'); };

  window.addEventListener('error', function (e) { (R.errors = R.errors || []).push(String(e.message)); });
  (async function () {
    try {
      if (!S[SCN]) throw new Error('unknown scenario ' + SCN);
      await S[SCN]();
    } catch (e) { R.fatal = String(e && e.stack || e); }
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
