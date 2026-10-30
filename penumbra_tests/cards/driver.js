// cards suite - page half (2026-10-28). The card view on the REAL main.js, colmenu harness (saveconf
// fixture, 300 rows; shown V_ID V_NAME V_AMOUNT V_DATE V_LINK V_STATUS; hidden H_*; g* grouped by
// H_GROUP, p* on a pivot). run.py reads R.chk / R.info; the scenario list and what each proves are
// in run.py's CHK.
(function () {
  var SCN = window.__SCN;
  var P = new URLSearchParams(location.search);
  var R = { scn: SCN, chk: {}, info: {}, errors: [] };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { var t = Date.now(); while (!fn() && Date.now() - t < ms) await sleep(25); return fn(); }
  function q(s, root) { return (root || document).querySelector(s); }
  function qa(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function C() { return window.Penumbra && window.Penumbra.cards; }
  function host() { return q('#pnbCardsHost'); }
  function sw() { return q('#pnbCardsSwitch'); }
  function vis(el) { return !!(el && !el.hidden && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  function on() { return document.body.classList.contains('pnb-cards-on'); }
  function cards() { return qa('#pnbCardsHost .pnb-card'); }
  function fth(name) { return q('#tableHeader th[data-colname="' + name + '"]'); }
  function colPos(name) { var ths = qa('#tableHeader th'); for (var i = 0; i < ths.length; i++) if (ths[i].getAttribute('data-colname') === name) return i; return -1; }
  function td(tr, name) { var p = colPos(name); return p >= 0 ? tr.cells[p] : null; }
  function tdText(tr, name) { var c = td(tr, name); return c ? c.textContent.trim() : null; }
  function shownRows() { return qa('#resultsTable > tbody > tr').filter(function (tr) { return !tr.classList.contains('search-hidden') && tr.style.display !== 'none'; }); }
  function rowIdx(tr) { return window.Penumbra.cardsHost.rowIndex(tr); }
  function cardRows() { return cards().map(function (c) { return parseInt(c.getAttribute('data-row'), 10); }); }
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; }
  function opt(view) { return q('#pnbCardsSwitch .pnb-cseg-opt[data-view="' + view + '"]'); }
  async function pickView(view) { opt(view).click(); await until(function () { return view === 'cards' ? (on() && cards().length > 0) : !on(); }, 8000); await sleep(120); }
  function prefs() { try { return JSON.parse(localStorage.getItem('penumbra_column_prefs') || '{}'); } catch (e) { return {}; } }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function setSel(id, v) { var s = q('#' + id); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  function key(el, k) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
  function slots() { var st = C() && C().state(); return st ? st.slots : null; }
  async function runSearch(qs) {
    var box = q('#tableSearch'); box.value = qs;
    if (window.__HC && typeof window.__HC.runSearch === 'function') window.__HC.runSearch(); else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(700);
  }
  // ---- colour: computed rgb[a] blended onto a backdrop, WCAG contrast
  function rgba(s) { var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; }
  function blend(fg, bg) { var a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; }
  function lum(c) { function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function ratio(fg, bg) { var a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
  function bgOf(el) {   // the first opaque background up the tree, translucent layers blended
    var layers = [];
    for (var e = el; e; e = e.parentElement) { var c = rgba(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    var base = [255, 255, 255, 1];
    for (var i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return base;
  }
  function fgOf(el) { var c = rgba(getComputedStyle(el).color), bg = bgOf(el); return c ? blend(c, bg) : null; }
  function applyTheme(t) {
    var b = document.body;
    b.className = b.className.replace(/\btheme-[\w-]+\b/g, '').replace(/\b(is-dark|registry-theme)\b/g, '').replace(/\s+/g, ' ').trim();
    b.classList.add(t.id); if (t.isDark) b.classList.add('is-dark'); if (t.modern) b.classList.add('registry-theme');
    b.setAttribute('data-theme', t.id);
  }
  async function boot() {
    if (!(await until(function () { return window.__queryDone >= 1 && (window.__HC_HIDES || 0) >= 1; }, 150000))) throw new Error('boot: never loaded ' + JSON.stringify({ q: window.__queryDone, h: window.__HC_HIDES, errs: (window.__errors || []).slice(-4), body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300) }));
    if (/^g/.test(SCN) && !(await until(function () { return document.querySelectorAll('#groupedResultsContainer tbody tr td').length > 0; }, 20000))) throw new Error('no grouped view');
    if (/^p/.test(SCN) && !(await until(function () { return !!q('#pivotResultTable'); }, 20000))) throw new Error('no pivot');
    await until(function () { return window.Penumbra && window.Penumbra.cardsHost && window.Penumbra.cardsHost.loaded(); }, 10000);
    // the harness SHOWS the Save dialog, whose Enter-to-save eats every Enter (colopt's trap)
    if (window.jQuery) window.jQuery('#saveStateLightbox').hide();
    await sleep(900);
  }
  function thName(name) { var t = fth(name); if (!t) return null; var c = t.cloneNode(true); qa('.sort-icon, button, .pnb-sum-badge, .sr-only', c).forEach(function (x) { x.parentNode.removeChild(x); }); return text(c); }

  var S = {};
  S.cauto = async function () {
    R.chk.switchShown = vis(sw()) && qa('#pnbCardsSwitch .pnb-cseg-opt').length === 2;
    R.chk.tableDefault = !on() && host().hidden && getComputedStyle(q('#resultsTable')).visibility !== 'hidden';
    var before = shownRows().map(rowIdx);
    await pickView('cards');
    R.chk.toCards = on() && vis(host()) && cards().length > 0;
    var pagerCards = (function () { var lb = q('label[for="rowsPerPageSelector"]'); return !!lb && text(lb) === 'Cards:' && /^Cards per page/.test(q('#rowsPerPageSelector').title); })();   // (round I)
    var shownThs = qa('#tableHeader th').filter(function (t) { return t.style.display !== 'none'; }).length;
    R.chk.tableKeptForReaders = window.jQuery('#tableHeader th:visible').length === shownThs && shownThs >= 7 && getComputedStyle(q('#resultsTable')).visibility === 'hidden' && window.jQuery('#resultsTable').is(':visible');
    R.chk.count = cards().length === shownRows().length && cards().length === 200;
    var sl = slots(); R.info.slots = sl;
    R.chk.guessTitle = !!sl && sl.title === 'V_ID';
    R.chk.guessBig = !!sl && sl.big === 'V_AMOUNT';
    R.chk.guessFields = !!sl && same(sl.fields, ['V_NAME', 'V_DATE', 'V_LINK']);
    R.chk.guessNoExtras = !!sl && !sl.pill && !sl.bar && sl.sub.length === 0;
    var rows = shownRows(), cs = cards(), par = true, pi = [];
    for (var i = 0; i < 20 && par; i++) {
      var c = cs[i], tr = rows[i];
      var t1 = text(q('.pnb-card-title', c)), t2 = text(q('.pnb-card-bigval', c)), dd = qa('.pnb-card-fields dd', c), dt = qa('.pnb-card-fields dt', c);
      par = c.getAttribute('data-row') === String(rowIdx(tr)) && t1 === tdText(tr, 'V_ID') && t2 === tdText(tr, 'V_AMOUNT') && text(dd[0]) === tdText(tr, 'V_NAME') && text(dd[1]) === tdText(tr, 'V_DATE') && text(dt[0]) === thName('V_NAME');
      if (!par) pi = [i, t1, tdText(tr, 'V_ID'), t2, tdText(tr, 'V_AMOUNT'), text(dd[0]), tdText(tr, 'V_NAME'), text(dt[0]), thName('V_NAME')];
    }
    R.chk.parity = par; R.info.parity = pi;
    var a1 = q('.pnb-card-fields dd a.resolver-link', cs[0]), a2 = q('a.resolver-link', td(rows[0], 'V_LINK'));
    R.chk.linkKept = !!(a1 && a2 && a1.getAttribute('href') === a2.getAttribute('href'));
    // the filter: the cards follow the rows the search keeps
    await runSearch('Alpha');
    await until(function () { return shownRows().length < 200 && cards().length === shownRows().length; }, 6000);
    var kept = shownRows().map(rowIdx), cr = cardRows();
    R.chk.filtered = kept.length > 0 && kept.length < 200 && same(cr, kept);
    R.info.filtered = [kept.length, cr.length];
    // the sort: a header click re-orders the cards as it re-orders the rows
    fth('V_AMOUNT').click();
    await until(function () { var k = shownRows().map(rowIdx); return same(cardRows(), k) && !same(k, kept); }, 6000);
    var k2 = shownRows().map(rowIdx);
    R.chk.sorted = same(cardRows(), k2) && !same(k2, kept);
    R.chk.prefSaved = (prefs().lrfix || {}).view === 'cards';
    // a11y: a region holding lists of list items, one tab stop, arrows, Enter, Esc, a click
    cs = cards();
    R.chk.roles = host().getAttribute('role') === 'region' && !!host().getAttribute('aria-label') && qa('#pnbCardsHost .pnb-cards-grid').every(function (g) { return g.getAttribute('role') === 'list'; })
      && cs.every(function (c) { return c.getAttribute('role') === 'listitem' && c.parentNode.classList.contains('pnb-cards-grid'); });
    R.chk.oneTabStop = cs.filter(function (c) { return c.tabIndex === 0; }).length === 1 && cs[0].tabIndex === 0;
    cs[0].focus(); key(cs[0], 'ArrowRight'); await sleep(50);
    R.chk.arrowRight = document.activeElement === cs[1] && cs[1].tabIndex === 0 && cs[0].tabIndex === -1;
    key(cs[1], 'ArrowDown'); await sleep(50);
    var ai = cs.indexOf(document.activeElement); R.info.arrowDown = ai;
    R.chk.arrowDown = ai > 1;
    var cur = document.activeElement; key(cur, 'Enter'); await sleep(100);
    // (cdet) Enter selects the card AND opens its details; Escape closes the window with the focus back on the card; a
    // second Escape clears the selection; a click selects and opens too
    R.chk.enterSelects = cur.getAttribute('aria-current') === 'true' && cs.filter(function (c) { return c.getAttribute('aria-current') === 'true'; }).length === 1 && !!C().details && C().details().open && vis(q('#pnbCardDetails'));
    key(document.activeElement, 'Escape'); await sleep(100);
    var closedBack = !!C().details && !C().details().open && document.activeElement === cur;
    key(cur, 'Escape'); await sleep(50);
    R.chk.escClears = closedBack && cs.every(function (c) { return !c.hasAttribute('aria-current'); }) && C().selected() === null;
    q('.pnb-card-title', cs[2]).click(); await sleep(100);
    R.chk.clickSelects = cs[2].getAttribute('aria-current') === 'true' && cs[2].tabIndex === 0 && C().selected() === parseInt(cs[2].getAttribute('data-row'), 10) && !!C().details && C().details().open;
    if (C().closeDetails) C().closeDetails(); await sleep(50);   // (on live before cdet there is no window to close)
    var s = sw(), radios = qa('.pnb-cseg-opt', s);
    R.chk.switchA11y = s.getAttribute('role') === 'radiogroup' && radios.length === 2 && radios.every(function (r) { return r.getAttribute('role') === 'radio'; })
      && opt('cards').getAttribute('aria-checked') === 'true' && opt('table').getAttribute('aria-checked') === 'false' && opt('cards').classList.contains('is-selected');
    await pickView('table');
    R.chk.pagerWord = pagerCards && (function () { var lb = q('label[for="rowsPerPageSelector"]'); return !!lb && text(lb) === 'Rows:' && /^Rows per page/.test(q('#rowsPerPageSelector').title); })();   // (round I) and back
    R.chk.toTable = !on() && host().hidden && getComputedStyle(q('#resultsTable')).visibility !== 'hidden' && opt('table').getAttribute('aria-checked') === 'true';
    R.chk.prefTable = (prefs().lrfix || {}).view === 'table';   // (csize) an explicit Table pick is kept: the phone default yields to it
    if (P.get('shot')) { await pickView('cards'); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); } await sleep(300); }
  };
  S.cpage = async function () {
    await pickView('cards');
    R.chk.pageSize = cards().length === 25 && same(cardRows(), shownRows().map(rowIdx)) && /Page 1 of 12/.test(text(q('#pageInfo')));
    q('#nextPageBtn').click();
    await until(function () { return /Page 2 of/.test(text(q('#pageInfo'))) && same(cardRows(), shownRows().map(rowIdx)); }, 6000);
    R.chk.nextPage = /Page 2 of 12/.test(text(q('#pageInfo'))) && cards().length === 25 && same(cardRows(), shownRows().map(rowIdx)) && cardRows()[0] === 25;
    q('#lastPageBtn').click();
    await until(function () { return /Page 12 of/.test(text(q('#pageInfo'))) && same(cardRows(), shownRows().map(rowIdx)); }, 6000);
    var rows = shownRows(), cs = cards(), ok = rows.length === 25 && cs.length === 25;
    for (var i = 0; i < cs.length && ok; i++) { var t = text(q('.pnb-card-title', cs[i])); ok = !!t && t === tdText(rows[i], 'V_ID') && text(q('.pnb-card-bigval', cs[i])) === tdText(rows[i], 'V_AMOUNT') && tdText(rows[i], 'V_AMOUNT') !== ''; }
    R.chk.lastPageFilled = ok; R.info.last = [rows.length, cs.length, text(q('#pageInfo'))];
    var sel = q('#rowsPerPageSelector'); sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await until(function () { return cards().length === 300; }, 8000);
    R.chk.rowsPerPageAll = cards().length === 300 && same(cardRows(), shownRows().map(rowIdx));
  };
  S.cfull = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.bootsCards = on() && cards().length === 200 && C().view() === 'cards';
    var sl = slots(); R.info.slots = sl;
    R.chk.slots = same(sl, { title: 'V_NAME', sub: ['V_ID', 'V_STATUS'], big: 'H_AMT', pill: 'V_STATUS', bar: 'H_NUM', fields: ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'] });
    var rows = shownRows(), cs = cards(), c0 = cs[0], r0 = rows[0], raw = window.Penumbra.cardsHost.rows()[rowIdx(r0)];
    var big = text(q('.pnb-card-bigval', c0));
    R.chk.hiddenFilled = !!big && big === tdText(r0, 'H_AMT') && big === String(raw.get('H_AMT')) && fth('H_AMT').style.display === 'none';
    var pill = q('.pnb-card-pill', c0);
    R.chk.pillPlain = !!pill && text(pill) === tdText(r0, 'V_STATUS') && !pill.classList.contains('is-ruled') && !pill.getAttribute('style');
    var max = 0; rows.forEach(function (tr) { var v = parseFloat(tdText(tr, 'H_NUM')); if (v > max) max = v; });
    var meter = q('.pnb-card-meter', c0), bar = meter && meter.firstElementChild, w = bar ? parseFloat(bar.style.width) : -1, want = parseFloat(tdText(r0, 'H_NUM')) / max * 100;
    R.chk.barFallback = !!meter && !meter.classList.contains('is-ruled') && Math.abs(w - want) < 0.2 && !bar.style.background;
    R.info.bar = [w, want, max];
    var sub = text(q('.pnb-card-sub', c0));
    R.chk.subShown = !!sub && sub.indexOf(tdText(r0, 'V_ID')) >= 0 && sub.indexOf(tdText(r0, 'V_STATUS')) >= 0;
    R.chk.fieldLabels = same(qa('.pnb-card-fields dt', c0).map(text), ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'].map(thName));
    var dd = qa('.pnb-card-fields dd', c0).map(text);
    R.chk.fieldValues = dd[0] === tdText(r0, 'V_DATE') && dd[1] === tdText(r0, 'V_LINK') && dd[2] === tdText(r0, 'H_TEXT') && !!dd[2] && dd[3] === tdText(r0, 'H_CODE') && !!dd[3];
    R.info.dd = dd;
  };
  S.chl = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var rows = shownRows(), cs = cards(), closed = [], open = [], mism = [];
    for (var i = 0; i < cs.length; i++) {
      var pill = q('.pnb-card-pill', cs[i]), cell = td(rows[i], 'V_STATUS'); if (!pill) continue;
      if (text(pill) === 'Closed') { closed.push([pill, cell]); if (pill.style.backgroundColor !== cell.style.backgroundColor || pill.style.color !== cell.style.color || !cell.style.backgroundColor) mism.push([i, pill.getAttribute('style'), cell.getAttribute('style')]); }
      else open.push(pill);
    }
    R.chk.ruledPills = closed.length > 0 && closed.every(function (p) { return p[0].classList.contains('is-ruled') && !!p[0].style.backgroundColor; });
    R.chk.plainPills = open.length > 0 && open.every(function (p) { return !p.classList.contains('is-ruled') && !p.getAttribute('style'); });
    R.chk.pillMatchesCell = closed.length > 0 && mism.length === 0;
    R.info.hl = [closed.length, open.length, mism.slice(0, 3)];
  };
  S.cbar = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var rows = shownRows(), cs = cards(), cell = td(rows[0], 'V_AMOUNT'), bg = cell.style.backgroundImage || '';
    var m = /linear-gradient\(\s*90deg\s*,\s*((?:rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}))\s+0%\s*,\s*(?:rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+(\d+(?:\.\d+)?)%/.exec(bg);
    R.chk.cellHasBar = !!m; R.info.bg = bg.slice(0, 160);
    var meter = q('.pnb-card-meter', cs[0]), bar = meter && meter.firstElementChild;
    R.chk.barFromCell = !!(m && meter && meter.classList.contains('is-ruled') && Math.abs(parseFloat(bar.style.width) - parseFloat(m[2])) < 0.2);
    R.chk.barColor = !!(m && bar && bar.style.background && rgba(getComputedStyle(bar).backgroundColor) && same(rgba(getComputedStyle(bar).backgroundColor).slice(0, 3), rgba(m[1].indexOf('#') === 0 ? hexToRgb(m[1]) : m[1]).slice(0, 3)));
    R.info.bar = [bar && bar.style.width, m && m[2], bar && bar.style.background, m && m[1]];
  };
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return 'rgb(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16) + ')'; }
  S.cesc = async function () {
    await pickView('cards'); await sleep(400);
    R.chk.noScript = window.__pwn === undefined;
    var t = text(q('.pnb-card-title', cards()[0]));
    R.chk.tagAsText = !!t && t.indexOf('<img') >= 0 && !q('.pnb-card-title img', cards()[0]);
    R.info.title = t;
  };
  S.coff = async function () {
    R.chk.switchHidden = !vis(sw());
    R.chk.hostHidden = !vis(host()) && !on();
    R.chk.notOffered = !!C() && C().offered() === false;
    if (C()) C().set('cards'); await sleep(300);
    R.chk.setRefused = !on() && !vis(host());
    // (round J, cardsmenu 2) the option off, the table's own menu still offers Show as cards: a pick shows them for
    // this visit, the switch with them (to go back), at the size picked
    var ctd = td(shownRows()[1], 'V_NAME'); rclick(ctd); await sleep(80);
    var has = !!menu() && acts().indexOf('showCards') >= 0, sub = has ? await openSub('showCards') : null;
    var cp = sub ? q('.pnb-hm-item[data-act="showCards-compact"]', sub) : null;
    if (cp) cp.click();
    await until(function () { return on() && cards().length > 0; }, 4000); await sleep(100);
    R.chk.offFlyout = has && !!cp && on() && cards().length > 0 && C().size() === 'compact' && vis(sw()) && C().offered() === true;
    R.info.offFlyout = { has: has, sub: !!sub, on: on(), size: C() ? C().size() : null, sw: vis(sw()) };
    await pickView('table');
    R.chk.offBack = !on() && vis(sw()) && getComputedStyle(q('#resultsTable')).visibility !== 'hidden';
  };
  S.cviewer = async function () {
    R.chk.noForm = !q('#viewOptionCards') && !window.penumbra_vars.canEditReport;
    R.info.viewer = [!!q('#viewOptionCards'), !!q('#view-options-tab'), window.penumbra_vars.canEditReport, window.penumbra_vars.isAdmin];
    R.chk.switchShown = vis(sw());
    await pickView('cards');
    var sl = slots();
    R.chk.cards = on() && cards().length === 200 && !!sl && sl.title === 'V_NAME';
  };
  S.cguess = async function () {
    // H_NUM (a plain number) shown BEFORE V_AMOUNT (money): the big number is still the money column
    await pickView('cards');
    var sl = slots(); R.info.slots = sl; R.info.shown = qa('#tableHeader th').filter(function (t) { return t.style.display !== 'none'; }).map(function (t) { return t.getAttribute('data-colname'); });
    R.chk.moneyOverNumber = !!sl && sl.big === 'V_AMOUNT' && R.info.shown.indexOf('H_NUM') < R.info.shown.indexOf('V_AMOUNT') && R.info.shown.indexOf('H_NUM') > 0;
    R.chk.fieldsNext = !!sl && same(sl.fields, ['V_NAME', 'H_NUM', 'V_DATE']);
  };
  // (pvtiles) the pivot as tiles: read against #pivotResultTable's own rows
  function pvT() { return q('#pivotResultTable'); }
  function pvShownRows() { return qa('#pivotResultTable tbody tr').filter(function (tr) { return tr.style.display !== 'none'; }); }
  function pvCellText(td) { var c = td.cloneNode(true); qa('.pivot-collapse-toggle, .journal-pvnote-btn, .pivot-other-count, .sort-icon, .col-sort-icon', c).forEach(function (x) { x.parentNode.removeChild(x); }); return text(c); }
  S.pcoff = async function () {
    R.chk.pivotShown = vis(q('#pivot-output-container')) && !!pvT();
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.switchShownInPivot = vis(sw()) && on() && C().state() && C().state().pivot === true;
    var rows = pvShownRows(), cs = cards(), foot = q('#pivotResultTable tfoot tr');
    R.chk.tilesCount = cs.length === rows.length + 1 && cs.length > 5;
    var t0 = cs[0];
    R.chk.totalTile = t0.classList.contains('is-total') && /Grand Total/.test(text(q('.pnb-card-title', t0))) && text(q('.pnb-card-bigval', t0)) === pvCellText(q('td[data-grand-total]', foot)) && qa('.pnb-card-pvfields dd', t0).length === qa('td[data-col-key]', foot).length;
    // the first leaf row: its own label cell (the leaf level) is the title, the row key's parents the subtitle
    var tr = rows.filter(function (r) { return r.hasAttribute('data-pivot-row'); })[0], ti = rows.indexOf(tr) + 1, tile = cs[ti];
    var labels = qa('td[data-row-field]', tr).map(pvCellText).filter(Boolean), parts = tr.getAttribute('data-pivot-row').split('|||');
    R.chk.tileTitle = !!tile && text(q('.pnb-card-title', tile)) === labels[labels.length - 1] && text(q('.pnb-card-sub', tile)) === parts.slice(0, -1).join(' > ') && parts.length === 2;
    var tot = q('td.pivot-grand-total[data-row-key]', tr);
    R.chk.tileBig = !!tot && text(q('.pnb-card-bigval', tile)) === pvCellText(tot) && text(q('.pnb-card-big small', tile)) === 'Total';
    var vals = qa('td[data-col-key]', tr).filter(function (td) { return !td.classList.contains('pivot-grand-total'); });
    var dts = qa('.pnb-card-pvfields dt', tile).map(text), dds = qa('.pnb-card-pvfields dd', tile).map(text);
    R.chk.tileFields = vals.length === 3 && same(dts, vals.map(function (td) { return td.getAttribute('data-col-key'); })) && same(dds, vals.map(pvCellText));
    R.info.pv = [rows.length, cs.length, labels, parts, dts, dds];
    // fold the first group (the pivot's own toggle): its leaves hide, its summary row shows, the tiles follow
    var tog = q('#pivotResultTable tbody .pivot-collapse-toggle'), before = cs.length;
    if (tog) tog.click();
    await until(function () { return cards().length !== before; }, 4000); await sleep(200);
    var shownNow = pvShownRows();
    R.chk.foldFollowed = !!tog && cards().length === shownNow.length + 1 && cards().length < before && shownNow.some(function (r) { return r.classList.contains('pivot-group-summary-row'); })
      && cards().some(function (c) { return /\(\d+ items\)/.test(text(q('.pnb-card-title', c))); });
    R.info.fold = [before, cards().length, shownNow.length];
    if (P.get('shot')) { if (tog) tog.click(); await sleep(400); if (P.get('theme')) { var th0 = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (th0) applyTheme(th0); } window.scrollTo(0, 0); await sleep(300); return; }   // the tiles, for the screenshot
    // a value's click = its cell's click: the pivot's breakdown opens
    var dd = q('.pnb-card:not(.is-total) .pnb-card-pvfields dd[data-pvc]');
    if (dd) dd.click();
    var opened = await until(function () { return !!q('.infobox-overlay, .modal-prompt-overlay'); }, 4000);
    R.chk.drillForward = !!dd && opened;
    qa('.infobox-overlay .close-lightbox, .infobox-overlay button').forEach(function (b) { if (/close/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || '') + ' ' + b.className)) b.click(); });
    await sleep(200);
    q('#exitPivotModeBtn').click();
    await until(function () { return on() && cards().length > 0 && C().state() && C().state().pivot === false; }, 8000);
    R.chk.backAfterExit = vis(sw()) && on() && cards().length === shownRows().length && cards().length > 0 && !vis(q('#pivot-output-container'));
    // (the exit empties #pivot-output-container: a re-entry needs the builder, which this harness has not got)
    if (P.get('shot') && P.get('theme')) { var th = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (th) applyTheme(th); await sleep(300); }
  };
  S.gcards = async function () {
    await until(function () { return on() && qa('#pnbCardsHost .pnb-cards-grp').length > 0; }, 10000);
    var leaves = qa('#groupedResultsContainer .group-wrapper.group-leaf').filter(function (w) { return !w.classList.contains('group-grand-total'); });
    var grps = qa('#pnbCardsHost .pnb-cards-grp');
    R.chk.grouped = leaves.length >= 5 && window.jQuery('#groupedResultsContainer').is(':visible');
    R.chk.groupCount = grps.length === leaves.length;
    var names = true, counts = true, aggs = true, aggSeen = 0, perGroup = true, total = 0;
    for (var i = 0; i < Math.min(grps.length, leaves.length); i++) {
      var hdr = q(':scope > .group-header', leaves[i]);
      if (text(q('.pnb-cards-grpname', grps[i])) !== text(q('.group-name', hdr))) names = false;
      if (text(q('.pnb-cards-grpcount', grps[i])) !== text(q('.group-count', hdr))) counts = false;
      var agg = q('.group-agg-summary', hdr);
      if (agg) { aggSeen++; if (text(q('.pnb-cards-grpagg', grps[i])) !== text(agg)) aggs = false; }
      var rows = qa(':scope > .group-content > table > tbody > tr', leaves[i]).filter(function (tr) { return !tr.classList.contains('search-hidden'); });
      var cs = qa('.pnb-card', grps[i]); total += cs.length;
      if (cs.length !== rows.length || !same(cs.map(function (c) { return parseInt(c.getAttribute('data-row'), 10); }), rows.map(rowIdx))) perGroup = false;
    }
    var any = grps.length > 0 && leaves.length > 0;   // (never vacuous: on live there are no groups of cards)
    R.chk.groupNames = any && names; R.chk.groupCounts = any && counts; R.chk.groupAgg = aggSeen > 0 && aggs; R.chk.groupCards = any && perGroup;
    R.chk.totalCards = total === 300 && cards().length === 300;
    R.info.g = [grps.length, leaves.length, aggSeen, total, text(q('.pnb-cards-grphead', grps[0]))];
    await runSearch('Alpha');
    var keptN = function () { return qa('#groupedResultsContainer .group-leaf > .group-content > table > tbody > tr').filter(function (tr) { return !tr.classList.contains('search-hidden'); }).length; };
    await until(function () { return keptN() < 300 && cards().length === keptN(); }, 8000);
    R.chk.searched = keptN() > 0 && keptN() < 300 && cards().length === keptN();
    R.info.searched = [keptN(), cards().length];
    if (P.get('shot') && P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(300); }
  };
  // (gfold) the bands fold as the table's: the wrappers' .open is the truth; a card band mirrors it
  function wrappers() { return qa('#groupedResultsContainer .group-wrapper').filter(function (w) { return !w.classList.contains('group-grand-total'); }); }
  function grps() { return qa('#pnbCardsHost .pnb-cards-grp'); }
  function tog(i) { return q('#pnbCardsHost .pnb-cards-grptoggle[data-gi="' + i + '"]'); }
  function openOf(g) { return !g.classList.contains('is-closed') && tog(g.querySelector('.pnb-cards-grptoggle').getAttribute('data-gi')).getAttribute('aria-expanded') === 'true'; }
  S.gcoll = async function () {
    await until(function () { return on() && grps().length > 0; }, 10000);
    var ws = wrappers(), n = ws.length;
    R.chk.bandsOpen = n >= 5 && grps().length === n && ws.every(function (w) { return w.classList.contains('open'); }) && grps().every(openOf) && cards().length === 300;
    tog(0).click(); await until(function () { return grps()[0] && grps()[0].classList.contains('is-closed'); }, 4000);
    var g0 = grps()[0], w0 = ws[0];
    R.chk.bandClick = !w0.classList.contains('open') && g0.classList.contains('is-closed') && qa('.pnb-card', g0).length === 0 && tog(0).getAttribute('aria-expanded') === 'false' && cards().length === 300 - qa('tbody tr', w0).length;
    R.info.fold = [w0.className, cards().length, qa('tbody tr', w0).length];
    tog(0).click(); await until(function () { return grps()[0] && !grps()[0].classList.contains('is-closed'); }, 4000);
    R.chk.bandAgain = ws[0].classList.contains('open') && openOf(grps()[0]) && cards().length === 300;
    tog(1).focus(); key(tog(1), 'Enter'); await until(function () { return !ws[1].classList.contains('open'); }, 4000); await sleep(150);
    R.chk.bandKey = !ws[1].classList.contains('open') && grps()[1].classList.contains('is-closed') && tog(1).getAttribute('aria-expanded') === 'false';
    R.chk.focusKept = document.activeElement === tog(1);
    q('#collapseAllGroups').click(); await until(function () { return cards().length === 0 && grps().every(function (g) { return g.classList.contains('is-closed'); }); }, 4000);
    R.chk.collapseAll = ws.every(function (w) { return !w.classList.contains('open'); }) && grps().length === n && grps().every(function (g) { return g.classList.contains('is-closed'); }) && cards().length === 0;
    q('#expandAllGroups').click(); await until(function () { return cards().length === 300; }, 4000);
    R.chk.expandAll = ws.every(function (w) { return w.classList.contains('open'); }) && grps().every(openOf) && cards().length === 300;
    // fold band 2 here, go to the table and back: the table shows it folded (one state), the cards draw it folded again
    tog(2).click(); await until(function () { return !ws[2].classList.contains('open'); }, 4000);
    await pickView('table');
    var tableFolded = !ws[2].classList.contains('open') && ws[0].classList.contains('open');
    await pickView('cards');
    R.chk.keptAcrossViews = tableFolded && grps()[2].classList.contains('is-closed') && !grps()[0].classList.contains('is-closed') && cards().length === 300 - qa('tbody tr', ws[2]).length;
    if (P.get('shot')) { tog(0).click(); await sleep(300); window.scrollTo(0, 0); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); } await sleep(300); }
  };
  S.gncoll = async function () {
    await until(function () { return on() && grps().length > 0; }, 10000);
    var branches = wrappers().filter(function (w) { return w.classList.contains('group-branch'); }), leaves = wrappers().filter(function (w) { return w.classList.contains('group-leaf'); });
    R.chk.nested = branches.length >= 5 && leaves.length > branches.length && grps().length === branches.length + leaves.length;
    var b0 = branches[0], gi0 = grps().indexOf(grps().filter(function (g) { return g.getAttribute('data-group-path') === b0.getAttribute('data-group-path'); })[0]);
    var inner = qa('.group-wrapper', b0).length, before = grps().length;
    tog(gi0).click(); await until(function () { return !b0.classList.contains('open'); }, 4000); await sleep(150);
    R.chk.branchFolds = !b0.classList.contains('open') && grps().length === before - inner && qa('.pnb-cards-grp', grps()[gi0]).length === 0 && grps()[gi0].classList.contains('is-closed');
    R.info.nested = [branches.length, leaves.length, inner, before, grps().length];
    tog(gi0).click(); await until(function () { return b0.classList.contains('open') && grps().length === before; }, 4000);
    var l0 = leaves[0], gl = grps().indexOf(grps().filter(function (g) { return g.getAttribute('data-group-path') === l0.getAttribute('data-group-path'); })[0]), total = cards().length;
    tog(gl).click(); await until(function () { return !l0.classList.contains('open'); }, 4000); await sleep(150);
    R.chk.leafFolds = !l0.classList.contains('open') && qa('.pnb-card', grps()[gl]).length === 0 && cards().length === total - qa('tbody tr', l0).length && grps().length === before;
  };
  // (glist) the List layout: the picked group's cards alone, every band drawn, a band picks
  function GL() { return window.Penumbra && window.Penumbra.groupList; }
  function pathOf(w) { return w.getAttribute('data-group-path'); }
  function grpOf(w) { return grps().filter(function (g) { return g.getAttribute('data-group-path') === pathOf(w); })[0]; }
  function cardsOnlyIn(w) {   // every drawn card sits under the wrapper's own band (a branch: its leaves' bands)
    var all = cards(), inside = qa('.pnb-card', grpOf(w));
    return all.length > 0 && inside.length === all.length && inside.length === qa('tbody tr', w).filter(function (tr) { return !tr.classList.contains('search-hidden'); }).length;
  }
  // (cardlist) the List layout: its own frame on screen (the list, the total, the picked group's band), the host
  // PARKED in the picked group's box, the box's table laid out out of sight; the list's own pick moves the host
  function selW() { return wrappers().filter(function (w) { return w.classList.contains('pnb-gl-sel'); })[0] || null; }
  function boxOf(w) { return w ? q(':scope > .group-content', w) : null; }
  function keptRows(w) {   // the rows a picked group shows (a branch: every group under it the search keeps)
    var ls = w.classList.contains('group-leaf') ? [w] : qa('.group-wrapper.group-leaf', w), out = [];
    ls.forEach(function (l) { qa(':scope > .group-content > table > tbody > tr', l).forEach(function (tr) { if (!tr.classList.contains('search-hidden')) out.push(tr); }); });
    return out;
  }
  function cardsAre(w) { var rs = keptRows(w); return rs.length > 0 && same(cardRows(), rs.map(rowIdx)); }
  function parkedIn(w) { var b = boxOf(w), h = host(); return !!b && !!h && h.parentNode === b && vis(h); }
  function glItem(path) { return qa('#pnbGroupList .pnb-gl-item').filter(function (i) { return i.getAttribute('data-path') === path; })[0] || null; }
  S.ggcards = async function () {
    await until(function () { return on() && document.body.classList.contains('pnb-gl-on') && cards().length > 0 && !!selW(); }, 10000);
    await until(function () { return parkedIn(selW()); }, 3000);
    var ws = wrappers().filter(function (w) { return w.classList.contains('group-leaf'); }), st = GL() && GL().state(), w0 = selW();
    R.chk.listOn = !!st && st.on === true && !!st.selPath && document.body.classList.contains('pnb-gl-on');
    // (live drew only the picked group's cards too, under bands of its own: this one holds there)
    R.chk.onePicked = !!w0 && cardsAre(w0) && cards().length < 300;
    var gc = q('#groupedResultsContainer'), gl = q('#pnbGroupList'), gcs = getComputedStyle(gc), band = w0 ? q(':scope > .group-header', w0) : null, glr = gl ? gl.getBoundingClientRect() : null;
    R.chk.frameShown = gcs.visibility === 'visible' && gcs.position !== 'absolute' && vis(gl) && !!glr && glr.left >= 0 && glr.top >= 0 && getComputedStyle(gl).visibility === 'visible'
      && qa('#pnbGroupList .pnb-gl-item').length === ws.length && !!band && vis(band) && getComputedStyle(band).visibility === 'visible';
    R.chk.hostInBox = !!w0 && parkedIn(w0) && !!C().state() && C().state().list === true;
    R.chk.noBandsOfItsOwn = cards().length > 0 && qa('#pnbCardsHost .pnb-cards-grp, #pnbCardsHost .pnb-cards-grptoggle').length === 0;
    var tb = w0 ? q(':scope > .group-content > table', w0) : null, tcs = tb ? getComputedStyle(tb) : null;
    R.chk.tableHidden = !!tcs && tcs.visibility === 'hidden' && tcs.position === 'absolute' && window.jQuery(tb).is(':visible');   // (laid out: the exports read :visible)
    R.info.list = { groups: ws.length, items: qa('#pnbGroupList .pnb-gl-item').length, sel: st && st.selPath, cards: cards().length, gc: [gcs.visibility, gcs.position], hostIn: host() && host().parentNode ? host().parentNode.className : null, tb: tcs ? [tcs.visibility, tcs.position] : null };
    // a click on a list row picks its group: the host moves into that group's box
    var w2 = ws[2], it2 = glItem(pathOf(w2));
    if (it2) it2.click();
    await until(function () { return GL().state().selPath === pathOf(w2) && parkedIn(w2) && cardsAre(w2); }, 5000);
    R.chk.pickClick = !!it2 && GL().state().selPath === pathOf(w2) && parkedIn(w2) && cardsAre(w2) && !boxOf(w0).contains(host());
    // the list's own keys: Down picks the next group
    gl.focus(); key(gl, 'ArrowDown');
    await until(function () { return GL().state().selPath === pathOf(ws[3]) && parkedIn(ws[3]) && cardsAre(ws[3]); }, 5000);
    R.chk.pickKey = GL().state().selPath === pathOf(ws[3]) && parkedIn(ws[3]) && cardsAre(ws[3]);
    R.info.pickKey = [GL().state().selPath, pathOf(ws[3])];
    // the list's API (the jump to a band's note)
    GL().selectGroup(ws[1]);
    await until(function () { return parkedIn(ws[1]) && cardsAre(ws[1]); }, 5000);
    R.chk.listPick = GL().state().selPath === pathOf(ws[1]) && parkedIn(ws[1]) && cardsAre(ws[1]);
    // the grouped view rebuilt under the parked host (its box replaced): parked again in the new box
    var path1 = pathOf(ws[1]);
    window.__HC.rgv();
    await until(function () { var w = selW(); return !!w && pathOf(w) === path1 && parkedIn(w) && cardsAre(w); }, 6000);
    var wr = selW();
    R.chk.rebuildParks = !!wr && wr !== ws[1] && pathOf(wr) === path1 && parkedIn(wr) && cardsAre(wr) && qa('[id="pnbCardsHost"]').length === 1;
    // the grouped view's saved HTML put back (a snapshot comparison closing): never a second host
    var realHost = host(), $gc = window.jQuery('#groupedResultsContainer'); $gc.html($gc.html());
    await sleep(30);   // (the container's observer first: until() would read the copy itself)
    // (the host found must be the real one, parked again - never the copy the HTML brought back)
    await until(function () { var w = selW(); return qa('[id="pnbCardsHost"]').length === 1 && host() === realHost && !!w && parkedIn(w) && cards().length === keptRows(w).length; }, 6000);
    var wh = selW();
    R.chk.restoreNoCopy = qa('[id="pnbCardsHost"]').length === 1 && host() === realHost && !!wh && parkedIn(wh) && cards().length === keptRows(wh).length;
    R.info.restore = { hosts: qa('[id="pnbCardsHost"]').length, sel: wh ? pathOf(wh) : null, cards: cards().length };
    window.__HC.rgv();   // (the real grouped view back: the rows the cards read again)
    await until(function () { var w = selW(); return !!w && parkedIn(w) && cardsAre(w); }, 6000);
    // Table <-> Cards: the host goes back to its place with the table; back to the cards, into the same group's box
    var hostEl0 = host();
    opt('table').click();
    var homeNow = !!hostEl0 && hostEl0.isConnected && !hostEl0.closest('#groupedResultsContainer') && hostEl0.hidden;   // (at once: the switch itself takes it home)
    await until(function () { return !on(); }, 8000); await sleep(120);
    var hs = selW(), ht = hs ? q(':scope > .group-content > table', hs) : null;
    var homeOk = homeNow && !!host() && !host().closest('#groupedResultsContainer') && host().hidden && !!ht && getComputedStyle(ht).visibility === 'visible' && getComputedStyle(ht).position !== 'absolute';
    await pickView('cards');
    await until(function () { var w = selW(); return !!w && parkedIn(w) && cardsAre(w); }, 5000);
    var wk = selW();
    R.chk.keptAcrossViews = homeOk && !!wk && pathOf(wk) === path1 && parkedIn(wk) && cardsAre(wk);
    R.info.views = { homeOk: homeOk, sel: wk ? pathOf(wk) : null };
    if (P.get('shot') && P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(300); }
  };
  S.gglnest = async function () {
    await until(function () { return on() && document.body.classList.contains('pnb-gl-on') && cards().length > 0 && !!selW(); }, 10000);
    var ws = wrappers(), st = GL() && GL().state();
    var branches = ws.filter(function (w) { return w.classList.contains('group-branch'); }), leaves = ws.filter(function (w) { return w.classList.contains('group-leaf'); });
    R.chk.listOn = !!st && st.on === true && branches.length >= 5 && leaves.length > branches.length;
    // a branch picked: every group under it as one run of cards, in its box; its groups out of sight
    var b1 = branches[1];
    GL().selectGroup(b1);
    await until(function () { return GL().state().selPath === pathOf(b1) && parkedIn(b1) && cardsAre(b1); }, 5000);
    var inner = qa('.group-wrapper.group-leaf', b1);
    R.chk.branchPick = GL().state().selPath === pathOf(b1) && parkedIn(b1) && cardsAre(b1) && inner.length > 1
      && inner.every(function (l) { return getComputedStyle(l).visibility === 'hidden'; }) && cards().length === keptRows(b1).length;
    R.info.nest = [branches.length, leaves.length, inner.length, cards().length, keptRows(b1).length];
    // ...then one of its groups
    var l0 = inner[0];
    GL().selectGroup(l0);
    await until(function () { return GL().state().selPath === pathOf(l0) && parkedIn(l0) && cardsAre(l0); }, 5000);
    R.chk.leafPick = GL().state().selPath === pathOf(l0) && parkedIn(l0) && cardsAre(l0) && cards().length < keptRows(b1).length;
  };
  // (csize) sizes and the phone default
  function sizeSel() { return q('#pnbCardsSize'); }
  function pickSize(v) { var s = sizeSel(); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  function parts() { return { fields: qa('#pnbCardsHost .pnb-card-fields').length, subs: qa('#pnbCardsHost .pnb-card-sub').length, meters: qa('#pnbCardsHost .pnb-card-meter').length, bigs: qa('#pnbCardsHost .pnb-card-big').length, pills: qa('#pnbCardsHost .pnb-card-pill').length }; }
  S.csize = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var st = C().state();
    R.chk.authorDefault = !!st && st.size === 'large' && host().classList.contains('is-large') && !host().classList.contains('is-compact') && C().size() === 'large';
    R.chk.sizeControl = vis(sizeSel()) && sizeSel().value === 'large' && qa('option', sizeSel()).map(function (o) { return o.value; }).join(',') === 'compact,standard,large,xl';   // (cxl) Extra large after Large
    var before = parts(); R.info.before = before;
    pickSize('compact'); await until(function () { return C().state() && C().state().size === 'compact'; }, 4000);
    R.chk.viewerCompact = host().classList.contains('is-compact') && !host().classList.contains('is-large') && C().size() === 'compact' && sizeSel().value === 'compact' && cards().length === 200;
    var p = parts(); R.info.compact = p;
    R.chk.compactParts = p.fields === 0 && p.subs === 0 && p.meters === 0 && p.bigs === 200 && p.pills === 0 && before.fields === 200;
    R.chk.prefSize = (prefs().lrfix || {}).size === 'compact';
    pickSize('standard'); await until(function () { return C().state() && C().state().size === 'standard'; }, 4000);
    R.chk.backToStandard = !host().classList.contains('is-compact') && !host().classList.contains('is-large') && parts().fields === 200 && (prefs().lrfix || {}).size === undefined;
    // the author's form: the saved default shows, a change writes the state, Standard drops the key
    var f = q('#pnbCardSize'), b1 = bsoCards(); setSel('pnbCardSize', 'compact'); var b2 = bsoCards(); setSel('pnbCardSize', ''); var b3 = bsoCards();
    R.chk.formSize = !!f && b1 && b1.size === 'large' && b2 && b2.size === 'compact' && b3 && b3.size === undefined;
    R.info.form = [b1, b2, b3];
    if (P.get('shot')) { pickSize(P.get('size') || 'compact'); await sleep(300); }
  };
  S.cszvlA = async function () {
    await pickView('cards');
    C().setSize('compact'); await sleep(150);
    var b = window.PenumbraViewLink.build(); R.info.token = b.token;
    var d = window.PenumbraViewLink.decode(b.token);
    R.chk.carriesCz = !!d && d.cv === 1 && d.cz === 'compact' && b.view.cz === 'compact';
    R.chk.describedCz = (window.PenumbraViewLink.describe(b) || []).some(function (x) { return /shown as compact cards/.test(x); });
    C().setSize('standard'); await sleep(150);
    var b2 = window.PenumbraViewLink.build();
    R.chk.noCzStandard = b2.view.cv === 1 && b2.view.cz === undefined;
  };
  S.cszvlB = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.bootsCompact = on() && C().size() === 'compact' && host().classList.contains('is-compact') && parts().fields === 0 && window.PenumbraViewLink.active();
    R.chk.prefUntouched = (prefs().lrfix || {}).size === undefined && (prefs().lrfix || {}).view === undefined;
  };
  S.cnarrowA = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.narrowOpensCards = on() && cards().length === 200 && window.innerWidth < 600 && C().view() === 'cards' && (prefs().lrfix || {}).view === undefined;
    R.info.narrow = [window.innerWidth, on(), (prefs().lrfix || {}).view];
  };
  S.cnarrowT = async function () {
    await sleep(1500);
    R.chk.tableChoiceWins = !on() && window.innerWidth < 600 && (!C() || C().view() === 'table') && (prefs().lrfix || {}).view === 'table';
    R.info.narrow = [window.innerWidth, on(), (prefs().lrfix || {}).view];
  };
  var PICKS = { title: 'V_NAME', sub: ['V_ID'], big: 'H_AMT', pill: 'V_STATUS', bar: 'H_NUM', fields: ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'] };
  function bsoCards() { var st = window.__HC.bso(); return st && st.viewOptions ? st.viewOptions.cards : undefined; }
  function chip(name) { return q('#pnbCardFields input[value="' + name + '"]'); }
  S.cauth = async function () {
    var cb = q('#viewOptionCards');
    R.chk.formOff = !!cb && !cb.checked && q('#pnbCardsSetup').hidden && !vis(sw());
    cb.click(); await sleep(150);
    R.chk.setupShown = cb.checked && !q('#pnbCardsSetup').hidden;
    var opts = qa('#pnbCardTitle option');
    R.chk.pickersListed = opts.length === 21 && opts[0].value === '' && opts[0].textContent === 'Automatic' && opts.some(function (o) { return o.value === 'V_NAME'; }) && opts.some(function (o) { return o.value === 'H_TEXT' && /hidden/.test(o.textContent); })
      && qa('#pnbCardPill option')[0].textContent === 'None';
    R.chk.chipsListed = qa('#pnbCardFields .pnb-cards-chip').length === 20;
    R.chk.liveSwitch = vis(sw());
    R.chk.stateOnEmpty = same(bsoCards(), {});
    setSel('pnbCardTitle', 'V_NAME'); setSel('pnbCardSub1', 'V_ID'); setSel('pnbCardBig', 'H_AMT'); setSel('pnbCardPill', 'V_STATUS'); setSel('pnbCardBar', 'H_NUM');
    ['V_DATE', 'V_LINK', 'H_TEXT', 'H_CODE'].forEach(function (n) { chip(n).click(); });
    await sleep(150);
    R.chk.statePicks = same(bsoCards(), PICKS); R.info.bso = bsoCards();
    R.chk.fourLimit = chip('V_STATUS').disabled && chip('V_DATE').checked && !chip('V_DATE').disabled && text(q('#pnbCardFieldsCount')) === '4 of 4' && chip('V_STATUS').parentNode.classList.contains('is-full');
    await pickView('cards');
    R.chk.drawnPicks = same(slots(), PICKS); R.info.slots = slots();
    cb.click(); await sleep(200);
    R.chk.untickOff = !cb.checked && !vis(sw()) && !on() && q('#pnbCardsSetup').hidden;
    R.chk.stateOff = bsoCards() === undefined;
  };
  S.cauthB = async function () {
    var cb = q('#viewOptionCards');
    R.chk.formOn = !!cb && cb.checked && !q('#pnbCardsSetup').hidden;
    R.chk.pickersShow = q('#pnbCardTitle').value === 'V_NAME' && q('#pnbCardSub1').value === 'V_ID' && q('#pnbCardSub2').value === '' && q('#pnbCardBig').value === 'H_AMT' && q('#pnbCardPill').value === 'V_STATUS' && q('#pnbCardBar').value === 'H_NUM';
    R.chk.chipsShow = same(qa('#pnbCardFields input:checked').map(function (i) { return i.value; }), PICKS.fields) && text(q('#pnbCardFieldsCount')) === '4 of 4';
    R.chk.roundTrip = same(bsoCards(), PICKS); R.info.bso = bsoCards();
    R.chk.switchShown = vis(sw());
    // re-edit: the title and the subtitle back to Automatic / None - the state drops them, the title is guessed again
    // (V_ID: no longer taken by the subtitle)
    setSel('pnbCardTitle', ''); setSel('pnbCardSub1', ''); await sleep(100);
    var b2 = bsoCards(); await pickView('cards');
    R.chk.reedit = !!b2 && b2.title === undefined && b2.sub === undefined && b2.big === 'H_AMT' && slots().title === 'V_ID' && slots().sub.length === 0;
    R.info.reedit = [b2, slots()];
  };
  S.cauthM = async function () {
    var t = q('#pnbCardTitle'), o = t.options[t.selectedIndex];
    R.chk.missingListed = t.value === 'GONE_COL' && /not in the results/.test(o.textContent);
    var ch = chip('GONE2');
    R.chk.missingChip = !!ch && ch.checked && ch.parentNode.classList.contains('is-missing') && chip('V_DATE').checked;
    await pickView('cards');
    R.chk.guessFallsBack = slots().title === 'V_ID';
    R.chk.keptField = same(slots().fields, ['V_DATE']);
    R.info.slots = slots();
  };
  S.cvlA = async function () {
    await pickView('cards');
    var b = window.PenumbraViewLink.build(); R.info.token = b.token; R.info.build = { len: b.url && b.url.length, included: b.included, dropped: b.dropped, cv: b.view && b.view.cv };
    var d = window.PenumbraViewLink.decode(b.token);
    R.chk.carriesCv = !!d && d.cv === 1 && b.view.cv === 1;
    R.chk.included = (b.included || []).indexOf('card view') >= 0;
    var desc = window.PenumbraViewLink.describe(b);
    R.chk.described = (desc || []).some(function (x) { return /shown as cards/.test(x); });
    await pickView('table');
    var b2 = window.PenumbraViewLink.build();
    R.chk.noCvOnTable = !!b2.view && b2.view.cv === undefined && (b2.included || []).indexOf('card view') < 0;
  };
  S.cvlB = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.bootsCards = on() && cards().length === 200 && C().view() === 'cards' && window.PenumbraViewLink.active();
    R.chk.prefUntouched = (prefs().lrfix || {}).view === undefined;
  };
  S.cvlT = async function () {
    await sleep(1500);
    R.chk.linkWins = !!window.PenumbraViewLink.active() && !on() && C().view() === 'table' && vis(sw());
    R.info.vl = [!!window.PenumbraViewLink.active(), on(), C().view()];
  };
  S.ca11y = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var themes = (window.__THEMES || []).filter(function (t) { return !t.legacy; });
    R.chk.themes = themes.length >= 18;
    var fails = [], pillFails = [], swFails = [], measured = [];
    for (var i = 0; i < themes.length; i++) {
      applyTheme(themes[i]); await sleep(60);
      var c = cards()[0], title = q('.pnb-card-title', c), dt = q('.pnb-card-fields dt', c), sub = q('.pnb-card-sub', c), big = q('.pnb-card-big small', c), pill = q('.pnb-card-pill', c), grp = null;
      var bg = bgOf(c);
      var rT = ratio(fgOf(title), bg), rD = ratio(fgOf(dt), bg), rS = ratio(fgOf(sub), bg), rB = ratio(fgOf(big), bg);
      measured.push([themes[i].id, +rT.toFixed(2), +rD.toFixed(2), +rS.toFixed(2)]);
      if (rT < 4.5) fails.push([themes[i].id, 'title', +rT.toFixed(2)]);
      if (rD < 4.5) fails.push([themes[i].id, 'label', +rD.toFixed(2)]);
      if (rS < 4.5) fails.push([themes[i].id, 'sub', +rS.toFixed(2)]);
      if (rB < 4.5) fails.push([themes[i].id, 'bigunit', +rB.toFixed(2)]);
      var rP = ratio(fgOf(pill), bgOf(pill)); if (rP < 4.5) pillFails.push([themes[i].id, +rP.toFixed(2)]);
      var selO = q('#pnbCardsSwitch .pnb-cseg-opt.is-selected'), unsel = q('#pnbCardsSwitch .pnb-cseg-opt:not(.is-selected)'), thumb = q('#pnbCardsSwitch .pnb-cseg-thumb'), track = q('#pnbCardsSwitch .pnb-cseg-track');
      var thumbBg = blend(rgba(getComputedStyle(thumb).backgroundColor) || [0, 0, 0, 0], bgOf(track)), trackBg = bgOf(track);
      var rSel = ratio(blend(rgba(getComputedStyle(selO).color), thumbBg), thumbBg), rUn = ratio(blend(rgba(getComputedStyle(unsel).color), trackBg), trackBg);
      if (rSel < 4.5) swFails.push([themes[i].id, 'selected', +rSel.toFixed(2)]);
      if (rUn < 4.5) swFails.push([themes[i].id, 'unselected', +rUn.toFixed(2)]);
    }
    applyTheme({ id: 'theme-default', isDark: false, modern: false });
    R.chk.contrast = fails.length === 0; R.chk.pillContrast = pillFails.length === 0; R.chk.switchContrast = swFails.length === 0;
    R.info.contrast = { fails: fails, pill: pillFails, sw: swFails, measured: measured };
  };
  S.cphone = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var grid = q('#pnbCardsHost .pnb-cards-grid'), cols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    // (the harness's own fixed-width chrome holds the layout viewport near 465px; a real phone page reads 375)
    R.chk.oneColumn = cols === 1 && window.innerWidth < 600;
    R.chk.noHScroll = document.documentElement.scrollWidth <= window.innerWidth + 1 && host().scrollWidth <= host().clientWidth + 1 && cards()[0].getBoundingClientRect().right <= window.innerWidth;
    R.chk.count = cards().length === shownRows().length && cards().length === 200;
    R.info.phone = [window.innerWidth, cols, document.documentElement.scrollWidth, host().scrollWidth, host().clientWidth];
  };
  S.cperf = async function () {
    var t0 = performance.now(); C().set('cards'); var wall = performance.now() - t0;
    await sleep(100);
    var st = C().state(); R.info.perf = { draw: st && st.ms, wall: wall, rows: st && st.rows, cards: cards().length };
    R.chk.thousand = !!st && st.rows === 1000 && cards().length === 1000 && shownRows().length === 1000;
    R.chk.under300 = !!st && st.ms < 300;
    R.chk.noMore = !!st && st.more === 0 && !q('.pnb-cards-morebtn');
  };
  S.cmore = async function () {
    await pickView('cards');
    R.chk.capped = cards().length === 1000 && shownRows().length === 2500;
    var btn = q('.pnb-cards-morebtn');
    R.chk.moreButton = !!btn && text(btn) === 'Show 1,000 more';
    R.chk.moreText = text(q('.pnb-cards-moretxt')) === '1,000 of 2,500 cards drawn';
    if (btn) btn.click(); await until(function () { return cards().length === 2000; }, 8000);
    R.chk.moreDraws = cards().length === 2000 && text(q('.pnb-cards-moretxt')) === '2,000 of 2,500 cards drawn';
    // 2,500 rows kept: main.js defers its format pass, so the cards are drawn a second time after it
    await until(function () { return !!(C().state() && C().state().again); }, 3000);
    R.chk.deferredDraw = !!(C().state() && C().state().again) && cards().length === 2000;
  };

  // (cxl) the Extra large size: the author's default, the size list, one or two cards per row at 1500px, every field,
  // the link's cz, the viewer's pref, the form's option, back to Large
  S.cxl = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var st = C().state();
    R.chk.authorXl = !!st && st.size === 'xl' && host().classList.contains('is-xl') && !host().classList.contains('is-large') && C().size() === 'xl';
    R.chk.sizeOptions = qa('option', sizeSel()).map(function (o) { return o.value; }).join(',') === 'compact,standard,large,xl' && sizeSel().value === 'xl';
    var cs = cards(), per = 1; while (per < cs.length && cs[per].offsetTop === cs[0].offsetTop) per++;
    R.info.xl = { per: per, w: cs[0].getBoundingClientRect().width, host: host().getBoundingClientRect().width };
    R.chk.twoPerRow = host().classList.contains('is-xl') && per >= 1 && per <= 2 && cs[0].getBoundingClientRect().width >= 500;
    R.chk.allFields = host().classList.contains('is-xl') && parts().fields === 200 && qa('#pnbCardsHost .pnb-card-fields dd').length === 600 && parts().bigs === 200;
    C().setSize('xl'); await sleep(100);
    var b = window.PenumbraViewLink.build(), d = window.PenumbraViewLink.decode(b.token);
    R.chk.linkCz = !!d && d.cv === 1 && d.cz === 'xl' && (window.PenumbraViewLink.describe(b) || []).some(function (x) { return /shown as extra large cards/.test(x); });
    R.chk.prefXl = (prefs().lrfix || {}).size === 'xl';
    setSel('pnbCardSize', 'xl'); var b2 = bsoCards(); setSel('pnbCardSize', 'large'); var b3 = bsoCards();
    R.chk.formXl = !!b2 && b2.size === 'xl' && !!b3 && b3.size === 'large';
    pickSize('large'); await until(function () { return C().state() && C().state().size === 'large'; }, 4000);
    R.chk.backToLarge = host().classList.contains('is-large') && !host().classList.contains('is-xl') && (prefs().lrfix || {}).size === 'large';
    if (P.get('shot')) { pickSize('xl'); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); } await sleep(300); }
  };
  S.cxlvl = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.bootsXl = on() && C().size() === 'xl' && host().classList.contains('is-xl') && window.PenumbraViewLink.active();
    R.chk.prefUntouched = (prefs().lrfix || {}).size === undefined;
  };
  // (cmenu) the right-click menus: the engine's own menu (#pnbHeadMenu) for the element behind a card part
  function menu() { return q('#pnbHeadMenu'); }
  function acts(root) { return qa('.pnb-hm-item', root || menu()).map(function (i) { return i.getAttribute('data-act'); }); }
  function rclick(el, o) {
    o = o || {}; var r = el.getBoundingClientRect();
    var ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: o.x === undefined ? r.left + 5 : o.x, clientY: o.y === undefined ? r.top + 5 : o.y, shiftKey: !!o.shift, view: window });
    el.dispatchEvent(ev); return ev;
  }
  function keyOn(el, k, shift) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true })); }
  async function openSub(act) { var it = menu() ? q('.pnb-hm-item[data-act="' + act + '"]', menu()) : null; if (!it) return null; it.click(); await until(function () { return !!q('.pnb-hm-sub'); }, 2000); return q('.pnb-hm-sub'); }
  S.cmenu = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var cs = cards(), c0 = cs[0], tr0 = shownRows()[0];
    // a value (the pill = V_STATUS): its column's menu, the value first, marked on the cell behind it; the card's items after the column's
    var pill = q('.pnb-card-pill[data-col="V_STATUS"]', c0), ev = rclick(pill);
    await sleep(80);
    var m = menu(), a = acts();
    R.info.valueActs = a;
    R.chk.valueMenu = ev.defaultPrevented && !!m && text(q('.pnb-hm-name', m)) === thName('V_STATUS') && (a.indexOf('filterMenu') >= 0 || a.indexOf('cellFilter') >= 0) && td(tr0, 'V_STATUS').classList.contains('pnb-hm-cell');
    R.chk.extras = a.indexOf('cardSize') >= 0 && a.indexOf('cardsTable') >= 0 && a.indexOf('sortAsc') >= 0 && a.indexOf('cardSize') > a.indexOf('sortAsc');
    // Filter to the value: the engine's item runs on the cell's value - the table filters, the cards follow
    var v = tdText(tr0, 'V_STATUS'), fi = m ? q('.pnb-hm-item[data-act="cellFilter"]', m) : null;
    if (!fi) { var fsub = await openSub('filterMenu'); fi = fsub ? q('.pnb-hm-item[data-act="cellFilter"]', fsub) : null; }
    if (fi) fi.click();
    await until(function () { return !menu() && shownRows().length > 0 && shownRows().length < 200 && shownRows().every(function (r) { return tdText(r, 'V_STATUS') === v; }) && same(cardRows(), shownRows().map(rowIdx)); }, 6000);
    R.chk.filterRuns = !!fi && shownRows().length > 0 && shownRows().length < 200 && shownRows().every(function (r) { return tdText(r, 'V_STATUS') === v; }) && same(cardRows(), shownRows().map(rowIdx));
    R.info.filtered = [v, shownRows().length, cards().length, q('#tableSearch') && q('#tableSearch').value];
    await runSearch(''); await until(function () { return shownRows().length === 200 && cards().length === 200; }, 6000);
    cs = cards(); c0 = cs[0];
    // the card's empty area (a field's label): the row's items alone (Copy this row, notes), none of the column's tools, the card's title on top
    ev = rclick(q('.pnb-card-fields dt', c0)); await sleep(80);
    m = menu(); a = acts(); R.info.cardActs = a;
    R.chk.cardRowOnly = ev.defaultPrevented && !!m && a.indexOf('sortAsc') < 0 && a.indexOf('filterMenu') < 0 && a.indexOf('cellFilter') < 0 && a.indexOf('hide') < 0
      && (a.indexOf('copyRow') >= 0 || a.indexOf('copyMenu') >= 0) && a.indexOf('cardsTable') >= 0 && text(q('.pnb-hm-name', m)) === text(q('.pnb-card-title', c0));
    // Card size: the four sizes, the one shown ticked; a pick redraws
    var sub = await openSub('cardSize'), sa = sub ? acts(sub) : [];
    R.info.sizeActs = sa;
    R.chk.sizeList = same(sa, ['cardSize-compact', 'cardSize-standard', 'cardSize-large', 'cardSize-xl']) && !!sub && q('.pnb-hm-item[data-act="cardSize-standard"]', sub).getAttribute('aria-checked') === 'true';
    if (sub) q('.pnb-hm-item[data-act="cardSize-compact"]', sub).click();
    await until(function () { return !menu() && host().classList.contains('is-compact'); }, 4000);
    R.chk.sizePick = host().classList.contains('is-compact') && C().size() === 'compact' && !menu();
    C().setSize('standard'); await until(function () { return !host().classList.contains('is-compact') && cards().length === 200; }, 4000);
    // a link in a card, Shift+right-click: the browser's own menu (none of ours, nothing prevented)
    var lnk = q('.pnb-card-val[data-col="V_LINK"] a', cards()[0]); ev = rclick(lnk); await sleep(50);
    R.chk.linkKeepsBrowser = !!lnk && !ev.defaultPrevented && !menu();
    ev = rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[0]), { shift: true }); await sleep(50);
    R.chk.shiftKeepsBrowser = !ev.defaultPrevented && !menu();
    // the keyboard: Shift+F10 on a focused card opens its menu under it, the first item focused; Esc closes it and the focus comes back
    var card = cards()[1]; card.focus(); keyOn(card, 'F10', true); await sleep(80);
    m = menu(); var mr = m ? m.getBoundingClientRect() : null, cr = card.getBoundingClientRect();
    R.info.kbd = { m: !!m, active: document.activeElement && document.activeElement.className, mr: mr && [mr.left, mr.top], cr: [cr.left, cr.top, cr.bottom] };
    R.chk.keyboardOpens = !!m && m.contains(document.activeElement) && document.activeElement.classList.contains('pnb-hm-item') && mr.top >= cr.top - 2 && mr.left < cr.right;
    var kOpened = R.chk.keyboardOpens;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    R.chk.escRefocus = kOpened && !menu() && document.activeElement === card;   // (a menu that never opened proves nothing)
    // the Menu key too; Show as table from the menu
    keyOn(card, 'ContextMenu'); await sleep(80);
    var stb = menu() ? q('.pnb-hm-item[data-act="cardsTable"]', menu()) : null;
    R.chk.menuKeyOpens = !!menu() && !!stb;
    if (stb) stb.click(); await until(function () { return !on(); }, 4000);
    R.chk.showTable = !on() && !menu() && opt('table').getAttribute('aria-checked') === 'true' && host().hidden;
    if (P.get('shot')) { await pickView('cards'); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); } rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[2])); await sleep(250); }
  };
  // (cmsize) the menus at every size, the size picked through the viewer's own list: a value, the card's empty area
  // (its head, beside the title) and, grouped (gmsize), a band
  async function menusAtSizes(grouped) {
    var sizes = ['compact', 'standard', 'large', 'xl'], out = {};
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      pickSize(s); await until(function () { return C().state() && C().state().size === s && cards().length > 0; }, 5000);
      var c0 = cards()[0], val = q('[data-col]', c0), head = q('.pnb-card-head', c0), r = { size: C().size(), cls: host().className };
      var ev = rclick(val); await sleep(80);
      r.value = !!menu() && ev.defaultPrevented && acts().indexOf('cardsTable') >= 0 && !!q('td.pnb-hm-cell');
      r.valueActs = acts().length;
      ev = rclick(head, { x: head.getBoundingClientRect().right - 2, y: head.getBoundingClientRect().top + 2 }); await sleep(80);
      r.area = !!menu() && ev.defaultPrevented && acts().indexOf('cardsTable') >= 0 && acts().indexOf('sortAsc') < 0;
      if (grouped) { ev = rclick(q('.pnb-cards-grptoggle', grps()[0])); await sleep(80); r.band = !!menu() && ev.defaultPrevented && acts().indexOf('gToggle') >= 0; }
      if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(40);
      out[s] = r;
    }
    return out;
  }
  S.cmsize = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var r = await menusAtSizes(false); R.info.sizes = r;
    ['compact', 'standard', 'large', 'xl'].forEach(function (s) { R.chk['value_' + s] = !!r[s] && r[s].value; R.chk['area_' + s] = !!r[s] && r[s].area; });
    // (menusel; the user's live tab, 10-28) a selection of nothing but whitespace left inside a card (the end of the title to
    // the start of the big number: what a Shift+click or a slip of the mouse leaves) must not hand the card's right-click to
    // the browser; a selection of real text in the card still does (Copy), as a selected table cell does
    var c0 = cards()[0], tt = q('.pnb-card-title', c0), head = q('.pnb-card-head', c0), tn = tt.firstChild;
    var rg = document.createRange(); rg.setStart(tn, tn.textContent.length); rg.setEnd(head, head.childNodes.length);   // (past the title, before the pill: no text)
    var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg);
    R.info.sel = { collapsed: sl.isCollapsed, text: JSON.stringify(String(sl)), contains: sl.containsNode(tt, true) };
    var ev = rclick(tt); await sleep(80);
    R.chk.blankSelectionIgnored = !sl.isCollapsed && String(sl).trim() === '' && ev.defaultPrevented && !!menu() && acts().indexOf('cardsTable') >= 0;
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(40);
    rg = document.createRange(); rg.selectNodeContents(tn); sl.removeAllRanges(); sl.addRange(rg);
    ev = rclick(tt); await sleep(80);
    R.chk.textSelectionKeepsBrowser = String(sl).trim().length > 0 && !ev.defaultPrevented && !menu();
    sl.removeAllRanges();
  };
  S.gmsize = async function () {
    await until(function () { return on() && grps().length > 0 && cards().length > 0; }, 10000);
    var r = await menusAtSizes(true); R.info.sizes = r;
    ['compact', 'standard', 'large', 'xl'].forEach(function (s) { R.chk['value_' + s] = !!r[s] && r[s].value; R.chk['band_' + s] = !!r[s] && r[s].band; });
  };
  // (cdet) the card details window
  function det() { return q('#pnbCardDetails'); }
  function detOpen() { return !!det() && vis(det()) && C().details().open; }
  function detTitle() { return text(q('#pnbCdetTitle')); }
  function detPos() { return text(q('#pnbCardDetails .pnb-cdet-pos')); }
  function detPairs() { return qa('#pnbCardDetails .pnb-cdet-fields dt').map(function (d) { return [text(d), text(d.nextElementSibling)]; }); }
  function shownCols() { return qa('#tableHeader th[data-colname]').filter(function (t) { return t.style.display !== 'none' && t.getAttribute('data-colname') !== '#' && t.getAttribute('data-colname').indexOf('__JOURNAL') !== 0; }).map(function (t) { return t.getAttribute('data-colname'); }); }
  S.cdet = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var cs = cards(), c2 = cs[2], tr2 = shownRows()[2];
    q('.pnb-card-fields dt', c2).click(); await sleep(150);
    R.chk.clickOpens = detOpen() && det().getAttribute('role') === 'dialog' && detTitle() === tdText(tr2, 'V_NAME') && !!document.activeElement.closest('#pnbCardDetails') && c2.getAttribute('aria-current') === 'true';
    var hb = q('#pnbCardDetails .pnb-cdet-card');
    R.chk.header = !!hb && text(q('.pnb-card-bigval', hb)) === tdText(tr2, 'H_AMT') && !!q('.pnb-card-pill', hb) && text(q('.pnb-card-pill', hb)) === tdText(tr2, 'V_STATUS') && !!q('.pnb-card-meter', hb);
    var pairs = detPairs(), cols = shownCols();
    R.info.det = { pairs: pairs.slice(0, 8), cols: cols, pos: detPos() };
    R.chk.shownColumns = pairs.length > 0 && same(pairs.map(function (p) { return p[0]; }), cols.map(thName));
    R.chk.values = pairs.length === cols.length && pairs.every(function (p, i) { return p[1] === tdText(tr2, cols[i]); });
    // the card shows H_AMT / H_NUM / H_TEXT (hidden columns): the list must not
    R.chk.noHidden = pairs.length > 0 && pairs.every(function (p) { return !/^H_/.test(p[0]); }) && qa('#tableHeader th[data-colname^="H_"]').some(function (t) { return t.style.display === 'none'; }) && !!q('.pnb-card-fields dd[data-col="H_TEXT"]', c2);
    R.chk.position = detPos() === '3 of 200' && !q('#pnbCardDetails .pnb-cdet-prev').disabled && !q('#pnbCardDetails .pnb-cdet-next').disabled;
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    var tr3 = shownRows()[3];
    R.chk.next = detTitle() === tdText(tr3, 'V_NAME') && detPos() === '4 of 200' && cs[3].getAttribute('aria-current') === 'true' && C().details().at === 3;
    keyOn(document.activeElement, 'ArrowLeft'); await sleep(120);
    R.chk.prevKey = detTitle() === tdText(tr2, 'V_NAME') && C().details().at === 2;
    keyOn(document.activeElement, 'Escape'); await sleep(120);
    R.chk.escCloses = !detOpen() && document.activeElement === cards()[2];
    // the filter respected: only the rows shown are stepped through
    await runSearch('V_STATUS = Closed'); await until(function () { return shownRows().length > 0 && shownRows().length < 200 && same(cardRows(), shownRows().map(rowIdx)); }, 6000);
    var sr = shownRows();
    q('.pnb-card-fields dt', cards()[0]).click(); await sleep(150);
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    R.chk.filtered = detOpen() && detTitle() === tdText(sr[1], 'V_NAME') && detPos() === '2 of ' + sr.length && detPairs().some(function (p) { return p[0] === thName('V_STATUS') && p[1] === 'Closed'; });
    R.info.filtered = [sr.length, detTitle(), tdText(sr[1], 'V_NAME'), detPos()];
    // a right-click on a value inside: that cell's menu (the engine's), the menu's Escape closes the menu alone
    var dd = q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_DATE"]'), ev = rclick(dd); await sleep(100);
    R.chk.menuInside = ev.defaultPrevented && !!menu() && text(q('.pnb-hm-name', menu())) === thName('V_DATE') && td(sr[1], 'V_DATE').classList.contains('pnb-hm-cell') && acts().indexOf('cardOpen') < 0 && acts().indexOf('cardsTable') >= 0;
    var dt0 = dd ? dd.previousElementSibling : null, bg0 = dt0 ? getComputedStyle(dt0).backgroundColor : '';
    R.chk.menuMark = !!dd && dd.classList.contains('is-menu-for') && !!menu() && bg0 !== 'rgba(0, 0, 0, 0)' && bg0 !== 'transparent';
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(100);
    R.chk.menuMarkGoes = R.chk.menuMark === true && !!dd && !dd.classList.contains('is-menu-for') && !menu();   // (after the mark: never vacuous)
    R.info.mark = { bg: bg0, cls: dd ? dd.className : null };
    R.chk.menuEscKeepsOpen = !menu() && detOpen();
    C().closeDetails(); await sleep(80);
    // Open details from a card's own menu
    ev = rclick(q('.pnb-card-fields dt', cards()[1])); await sleep(100);
    var op = menu() ? q('.pnb-hm-item[data-act="cardOpen"]', menu()) : null; if (op) op.click(); await sleep(200);
    R.chk.openFromMenu = !!op && detOpen() && detTitle() === tdText(sr[1], 'V_NAME');
    C().closeDetails(); await sleep(80);
    // the API (the palette's row): the selected card, else the focused one
    cards()[2].focus(); keyOn(cards()[2], ' '); await sleep(60);
    C().openDetails(); await sleep(150);
    R.chk.apiOpen = detOpen() && C().details().at === 2 && C().selected() === parseInt(cards()[2].getAttribute('data-row'), 10);
    C().closeDetails(); await sleep(60);
    await runSearch(''); await until(function () { return shownRows().length === 200; }, 6000);
    if (P.get('shot')) { if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); } q('.pnb-card-fields dt', cards()[2]).click(); await sleep(300); }
  };
  S.gdet = async function () {
    await until(function () { return on() && grps().length > 1 && cards().length > 0; }, 10000);
    var g0 = grps()[0], inG0 = qa('.pnb-card', g0), last = inG0[inG0.length - 1], all = cards(), li = all.indexOf(last);
    q('.pnb-card-title', last).click(); await sleep(150);
    R.chk.opensInGroup = detOpen() && C().details().at === li && detPos() === (li + 1) + ' of ' + all.length && li > 0;
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    var firstG1 = q('.pnb-card', grps()[1]);
    R.chk.nextCrossesBand = C().details().at === li + 1 && all[li + 1] === firstG1 && firstG1.getAttribute('aria-current') === 'true' && detTitle() === text(q('.pnb-card-title', firstG1));
    R.chk.countAll = C().details().count === all.length && all.length === 300;
    C().closeDetails();
  };
  S.pdet = async function () {
    await until(function () { return on() && cards().length > 0 && C().state() && C().state().pivot === true; }, 8000);
    var cs = cards(), leaf = cs.filter(function (c) { return !c.classList.contains('is-total'); })[0], li = cs.indexOf(leaf);
    q('.pnb-card-title', leaf).click(); await sleep(150);
    R.chk.tileOpens = detOpen() && detTitle() === text(q('.pnb-card-title', leaf)) && text(q('#pnbCdetSub')) === 'Pivot tile';
    var dts = qa('#pnbCardDetails .pnb-card-pvfields dt').map(text), tdts = qa('.pnb-card-pvfields dt', leaf).map(text);
    R.chk.tileFields = dts.length > 0 && same(dts, tdts) && text(q('#pnbCardDetails .pnb-card-bigval')) === text(q('.pnb-card-bigval', leaf));
    q('#pnbCardDetails .pnb-cdet-next').click(); await sleep(120);
    R.chk.nextTile = C().details().at === li + 1 && detTitle() === text(q('.pnb-card-title', cs[li + 1]));
    q('#pnbCardDetails .pnb-cdet-prev').click(); await sleep(120);
    var btn = q('#pnbCardDetails .pnb-cdet-drill'); if (btn) btn.click();
    var opened = await until(function () { return !!q('.infobox-overlay, .modal-prompt-overlay'); }, 4000);
    R.chk.breakdownButton = !!btn && opened && !detOpen();
    if (P.get('shot')) { qa('.infobox-overlay .close-lightbox, .infobox-overlay button').forEach(function (b) { if (/close/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || '') + ' ' + b.className)) b.click(); }); await sleep(200); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); } q('.pnb-card-title', cards()[li]).click(); await sleep(300); }
  };
  S.cdetph = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    q('.pnb-card-title', cards()[0]).click(); await sleep(200);
    var box = q('#pnbCardDetails .pnb-cdet-box'), r = box && box.getBoundingClientRect();
    R.info.ph = { w: innerWidth, h: innerHeight, r: r && [r.left, r.top, r.width, r.height] };
    var cw = document.documentElement.clientWidth;   // (the harness page keeps a scrollbar: the sheet fills the viewport beside it)
    R.chk.sheet = detOpen() && !!r && innerWidth < 600 && r.width >= cw - 2 && r.height >= innerHeight - 2 && r.left <= 1 && r.top <= 1;
    R.chk.noHScroll = document.documentElement.scrollWidth <= innerWidth + 1;
    if (!P.get('shot') && C().closeDetails) C().closeDetails();
  };
  // (cardword) a card's menu speaks of fields and leaves the grid-only items out; the table's own menu is untouched
  function labels(root) { return qa('.pnb-hm-item', root || menu()).map(function (i) { return text(q('.pnb-hm-label', i)) || text(i); }); }
  function heads(root) { return qa('.pnb-hm-head', root || menu()).map(text); }
  function labelOfAct(act, root) { var i = q('.pnb-hm-item[data-act="' + act + '"]', root || menu()); return i ? text(q('.pnb-hm-label', i)) : null; }
  function wordy(root) { var all = labels(root).concat(heads(root), qa('.pnb-hm-item[title]', root || menu()).map(function (i) { return i.getAttribute('title'); })); return all.filter(function (s) { return /column/i.test(s || ''); }); }
  S.cmword = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var c0 = cards()[0], ev = rclick(q('.pnb-card-pill[data-col="V_STATUS"]', c0)); await sleep(100);
    var a = acts(); R.info.acts = a; R.info.labels = labels();
    R.chk.gridOnlyHidden = !!menu() && ['width', 'rowHeight', 'freeze', 'unfreeze'].every(function (x) { return a.indexOf(x) < 0; }) && ['sortAsc', 'options', 'hide', 'move', 'calc', 'stats', 'show'].every(function (x) { return a.indexOf(x) >= 0; });
    R.info.wordy = wordy();
    R.chk.noColumnWord = !!menu() && wordy().length === 0 && labelOfAct('hide') === 'Hide this field' && labelOfAct('options') === 'Field options...' && labelOfAct('stats') === 'Field stats' && labelOfAct('calc') === 'Add a calculated field...' && labelOfAct('move') === 'Move field' && /^Group by this field/.test(labelOfAct('groupBy') || labelOfAct('groupByList') || '');
    R.chk.noDoubleSep = R.chk.gridOnlyHidden && !!menu() && !qa('#pnbHeadMenu .pnb-hm-sep + .pnb-hm-sep').length && !menu().firstElementChild.nextElementSibling.classList.contains('pnb-hm-sep');
    var sub = await openSub('move'); var ml = sub ? labels(sub) : []; R.info.moveLabels = ml;
    R.chk.moveLabels = same(ml.slice(0, 4), ['Move field up', 'Move field down', 'Move to top', 'Move to bottom']) && !!sub && wordy(sub).length === 0;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    // a move from a card's menu is the table's column move: the fields follow (V_LINK, the third guessed field, moves up past
    // V_DATE; the header's cells re-order without a render, so the cards must watch the header)
    var before = qa('.pnb-card-fields dd[data-col]', cards()[0]).map(function (d) { return d.getAttribute('data-col'); });
    ev = rclick(q('.pnb-card-fields dd[data-col="V_LINK"]', cards()[0])); await sleep(100);
    sub = await openSub('move'); var mr = sub ? q('.pnb-hm-item[data-act="move-left"]', sub) : null;
    if (mr) mr.click();
    await until(function () { var now = qa('.pnb-card-fields dd[data-col]', cards()[0]).map(function (d) { return d.getAttribute('data-col'); }); return !same(now, before); }, 5000);
    var after = qa('.pnb-card-fields dd[data-col]', cards()[0]).map(function (d) { return d.getAttribute('data-col'); });
    R.info.move = [before, after, colPos('V_LINK'), colPos('V_DATE'), !!mr, qa('#tableHeader th').map(function (t) { return t.getAttribute('data-colname'); }).slice(0, 8)];
    R.chk.moveReflected = same(before, ['V_NAME', 'V_DATE', 'V_LINK']) && same(after, ['V_NAME', 'V_LINK', 'V_DATE']) && colPos('V_LINK') === colPos('V_DATE') - 1;
    var toasted = await until(function () { return /Moved V_LINK (up|left)\./.test(document.body.innerText || ''); }, 3000);
    R.info.toast = (document.body.innerText.match(/Moved V_LINK [a-z ]+\./) || [null])[0];
    R.chk.moveToast = toasted && /Moved V_LINK up\./.test(document.body.innerText || '');   // the toast speaks of up, not left
    // Add a calculated field...: its places; Show field(s): its heading
    ev = rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[0])); await sleep(100);
    sub = await openSub('calc'); var cl = sub ? labels(sub) : [], ch = sub ? heads(sub) : []; R.info.calc = [ch, cl];
    R.chk.calcLabels = !!sub && same(cl.slice(0, 4), ['Above this field', 'Below this field', 'At the top', 'At the bottom']) && ch[0] === 'Add one, using this field' && wordy(sub).length === 0;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    ev = rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[0])); await sleep(100);
    sub = await openSub('show'); var sh = sub ? heads(sub) : [], sl = sub ? labels(sub) : []; R.info.show = [sh, sl];
    R.chk.subNoColumn = !!sub && sh[0] === 'Show a hidden field here' && sl.indexOf('Show only this field') >= 0 && sl.indexOf('Show all fields') >= 0 && wordy(sub).length === 0;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    // the table's own menu: every label as it was
    await pickView('table');
    var tdv = td(shownRows()[0], 'V_STATUS'); ev = rclick(tdv); await sleep(100);
    var ta = acts(); R.info.tableActs = ta;
    R.chk.tableUnchanged = !!menu() && ta.indexOf('width') >= 0 && ta.indexOf('rowHeight') >= 0 && labelOfAct('hide') === 'Hide this column' && labelOfAct('options') === 'Column options...' && labelOfAct('move') === 'Move column' && labelOfAct('calc') === 'Calculated column' && wordy().length > 0;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    await pickView('cards');
    if (P.get('shot')) { if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); } rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[2])); await sleep(150); await openSub('move'); await sleep(200); }
  };
  // (curl) the card view by URL parameter: ?cards=1|0 and ?cardsize=, the option off or on, the pref untouched; a view
  // link's cv / cz unlock the switch too; the builder's Open as cards option
  S.curl1 = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.switchShown = vis(sw()) && opt('cards').getAttribute('aria-checked') === 'true';
    R.chk.cardsOn = on() && !host().hidden && cards().length === 200 && same(cardRows(), shownRows().map(rowIdx));
    R.chk.sizeXl = C().size() === 'xl' && host().classList.contains('is-xl') && vis(sizeSel()) && sizeSel().value === 'xl';
    var st = C().state(); R.info.slots = st && st.slots;
    R.chk.guessed = !!st && st.slots && st.slots.title === 'V_ID' && st.slots.big === 'V_AMOUNT' && same(st.slots.fields, ['V_NAME', 'V_DATE', 'V_LINK']);
    R.chk.offeredNoOption = C().report() === null && C().offered() && !!C().asked && !!C().asked() && C().asked().cards === true;
    R.chk.prefUntouched = (prefs().lrfix || {}).view === undefined && (prefs().lrfix || {}).size === undefined;
    R.chk.stateNoLeak = !bsoCards();   // the report's saved state never gains the option from a visitor's URL
    await pickView('table');
    R.chk.switchWrites = !on() && (prefs().lrfix || {}).view === 'table' && vis(sw());
    if (P.get('shot')) { await pickView('cards'); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); } await sleep(300); }   // the cards by URL, for the picture
  };
  S.curl2 = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.paramWins = on() && (prefs().lrfix || {}).view === 'table';
    R.chk.prefStillTable = (prefs().lrfix || {}).view === 'table';
  };
  S.curl3 = async function () {
    await until(function () { return vis(sw()) && window.Penumbra.cardsHost.loaded(); }, 8000); await sleep(300);
    R.chk.tableForced = !on() && vis(sw()) && opt('table').getAttribute('aria-checked') === 'true' && (prefs().lrfix || {}).view === 'cards';
    R.chk.prefStillCards = (prefs().lrfix || {}).view === 'cards';
  };
  S.curl4 = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    R.chk.linkUnlocks = on() && C().report() === null && C().offered() && window.PenumbraViewLink.active() && C().size() === 'compact' && host().classList.contains('is-compact');
    R.chk.prefUntouched = (prefs().lrfix || {}).view === undefined && (prefs().lrfix || {}).size === undefined;
  };
  S.cshare = async function () {
    await until(function () { return vis(sw()); }, 8000);
    var b0 = window.PenumbraViewLink.build(), d0 = window.PenumbraViewLink.decode(b0.token);
    R.chk.noCvOnTable = !on() && !!d0 && d0.cv === undefined && d0.cz === undefined;
    var b = window.PenumbraViewLink.build({ cards: true, size: 'large' }), d = window.PenumbraViewLink.decode(b.token);
    R.info.share = [d0, d];
    R.chk.cardsForce = !on() && !!d && d.cv === 1 && d.cz === 'large' && (window.PenumbraViewLink.describe(b) || []).some(function (x) { return /shown as large cards/.test(x); });
    var b2 = window.PenumbraViewLink.build({ cards: true, size: 'standard' }), d2 = window.PenumbraViewLink.decode(b2.token);
    R.chk.standardNoCz = !!d2 && d2.cv === 1 && d2.cz === undefined;
  };
  S.gmenu = async function () {
    await until(function () { return on() && grps().length > 0; }, 10000);
    var g0 = grps()[0], tg = q('.pnb-cards-grptoggle', g0);
    var ev = rclick(tg); await sleep(80);
    var m = menu(), a = acts(); R.info.bandActs = a;
    R.chk.bandMenu = ev.defaultPrevented && !!m && text(q('.pnb-hm-name', m)) === text(q('.pnb-cards-grpname', g0)) && a.indexOf('gToggle') >= 0 && a.indexOf('gCollapseAll') >= 0 && a.indexOf('cardSize') >= 0 && a.indexOf('cardsTable') >= 0;
    R.info.bandWordy = wordy(); R.chk.bandNoColumn = !!m && wordy().length === 0 && a.length > 8;   // (cardword) a band's menu names no column either
    // the group's own item runs through the table's grouping: Collapse all folds every band in the cards
    q('.pnb-hm-item[data-act="gCollapseAll"]', m).click();
    await until(function () { return !menu() && grps().length > 0 && grps().every(function (g) { return g.classList.contains('is-closed'); }); }, 5000);
    R.chk.bandActs = grps().every(function (g) { return g.classList.contains('is-closed'); }) && wrappers().every(function (w) { return !w.classList.contains('open'); }) && cards().length === 0;
    // the keyboard on a band: Shift+F10 opens the group's menu, Esc back to the band
    tg = q('.pnb-cards-grptoggle', grps()[0]); tg.focus(); keyOn(tg, 'F10', true); await sleep(80);
    R.chk.bandKeyboard = !!menu() && menu().contains(document.activeElement) && acts().indexOf('gToggle') >= 0;
    keyOn(document.activeElement, 'Escape'); await sleep(80);
    R.chk.bandRefocus = !menu() && document.activeElement === tg;
    // a card's value inside a group: its column's menu, as in the flat view
    q('#expandAllGroups').click(); await until(function () { return cards().length > 0; }, 5000);
    var val = q('#pnbCardsHost .pnb-card .pnb-card-val[data-col]'); ev = rclick(val); await sleep(80);
    a = acts();
    R.chk.groupedValueMenu = ev.defaultPrevented && !!menu() && (a.indexOf('filterMenu') >= 0 || a.indexOf('cellFilter') >= 0) && a.indexOf('cardsTable') >= 0 && !!q('#groupedResultsContainer td.pnb-hm-cell');
    if (P.get('shot')) { if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); } rclick(q('.pnb-cards-grptoggle', grps()[1])); await sleep(250); }
    else { keyOn(document.activeElement, 'Escape'); }
  };
  S.pmenu = async function () {
    await until(function () { return on() && cards().length > 0 && C().state() && C().state().pivot === true; }, 8000);
    var cs = cards(), leaf = cs.filter(function (c) { return !c.classList.contains('is-total'); })[0], dd = q('.pnb-card-pvfields dd[data-pvc]', leaf);
    // a tile's value: the pivot's own menu for its cell (marked pnb-hm-for), the card's items after it
    var ev = rclick(dd); await sleep(80);
    var m = menu(), a = acts(), marked = q('#pivotResultTable td.pnb-hm-for');
    R.info.pvActs = a;
    R.chk.tileValueMenu = ev.defaultPrevented && !!m && !!marked && marked.hasAttribute('data-col-key') && pvCellText(marked) === text(dd) && a.indexOf('cardsTable') >= 0 && a.some(function (x) { return x !== 'cardSize' && x !== 'cardsTable'; });
    R.info.tileWordy = wordy(); R.chk.tileNoGrid = !!m && a.indexOf('pvFreeze') < 0 && a.indexOf('pvHighlight') < 0 && wordy().length === 0;   // (cardword; the harness pivot offers no value tools, so this guards the wording alone)
    // the tile's title: the row label's menu
    ev = rclick(q('.pnb-card-title', leaf)); await sleep(80);
    marked = q('#pivotResultTable td.pnb-hm-for'); a = acts(); R.info.pvLabelActs = a;
    R.info.pvLabel = { marked: marked ? marked.outerHTML.replace(/\s+/g, ' ').slice(0, 160) : null, title: menu() ? text(q('.pnb-hm-name', menu())) : null, labels: qa('td[data-row-field]', q('#pivotResultTable tbody tr[data-pivot-row]')).length };
    // (the engine's marker class on the cell must not redraw the tiles under the menu: the tile stays the same element)
    R.chk.tileLabelMenu = ev.defaultPrevented && !!menu() && !!marked && marked.hasAttribute('data-row-field') && a.indexOf('cardSize') >= 0 && leaf.isConnected && cards()[0] === cs[0];
    // the grand total tile: the pivot's menu has no cell for the tfoot - the card's own items alone
    ev = rclick(q('.pnb-card-title', cs[0])); await sleep(80);
    a = acts(); R.info.pvTotalActs = a;
    R.chk.totalTileMenu = ev.defaultPrevented && !!menu() && a.indexOf('cardSize') >= 0 && a.indexOf('cardsTable') >= 0 && a.every(function (x) { return x === 'cardSize' || x === 'cardsTable' || x === 'cardOpen'; });   // (cdet: Open details joins the card's own items)
    // Show as table from a tile: the pivot table shows again
    q('.pnb-hm-item[data-act="cardsTable"]', menu()).click(); await until(function () { return !on(); }, 4000);
    R.chk.tileShowTable = !on() && !menu() && getComputedStyle(q('#pivotResultTable')).visibility !== 'hidden';
    if (P.get('shot')) {   // the tiles with a value's menu open, for the picture
      await pickView('cards'); if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); }
      var sdd = q('.pnb-card:not(.is-total) .pnb-card-pvfields dd[data-pvc]'); if (sdd) rclick(sdd); await sleep(250);
    }
  };

  // (cardnotes) the Notes column in the card: the journal's REAL painter, list, composer and handlers (main.js), over a
  // fake manage_journal.php (add / edit / delete / row_notes) - the harness has no journal of its own
  var JS = null;   // the fake server: row key -> notes (oldest first), and what was asked of it
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fakeJournal() {
    var J = window.jQuery, real = J.ajax, seq = 500;
    JS = { notes: Object.create(null), log: [] };
    J.ajax = function (a, b) {
      var o = (typeof a === 'string') ? J.extend({ url: a }, b || {}) : (a || {}), url = String(o.url || '');
      if (url.indexOf('manage_journal.php') !== 0) return real.apply(this, arguments);
      var body = {}; try { body = (typeof o.data === 'string') ? JSON.parse(o.data) : {}; } catch (e) { }
      var act = body.action || ((/[?&]action=([a-z_]+)/.exec(url) || [])[1]) || '', resp = { status: 'error', message: 'not in the harness' }, i, k;
      JS.log.push({ act: act, body: body });
      if (act === 'add') {
        var n = { ID: ++seq, NOTE_TEXT: body.note_text, CREATED_BY: 'harness', AUTHOR_NAME: 'Harness User', CREATED_AT: '2026-10-29 12:' + pad2(seq % 60) + ':00', PARENT_ID: body.parent_id || null };
        (JS.notes[body.row_key] = JS.notes[body.row_key] || []).push(n);
        resp = { status: 'success', id: n.ID, mention_results: [], reply_results: [] };
      } else if (act === 'edit' || act === 'delete') {
        for (k in JS.notes) for (i = 0; i < JS.notes[k].length; i++) if (String(JS.notes[k][i].ID) === String(body.note_id)) {
          if (act === 'edit') JS.notes[k][i].NOTE_TEXT = body.note_text; else JS.notes[k].splice(i, 1);
          resp = { status: 'success', mention_results: [] }; break;
        }
      } else if (act === 'row_notes') {
        var notes = {}, counts = {};
        for (k in JS.notes) if (JS.notes[k].length) { notes[k] = JS.notes[k].map(function (x) { return J.extend({}, x); }); counts[k] = JS.notes[k].length; }
        resp = { status: 'success', notes: notes, counts: counts, ver: 'v' + seq };
      }
      var d = J.Deferred();
      setTimeout(function () { try { if (o.success) o.success(resp); } catch (e) { } d.resolve(resp, 'success', { status: 200 }); }, 15);
      var pr = d.promise(); pr.abort = function () { }; return pr;
    };
  }
  async function loadNotes() { await new Promise(function (r) { window.Penumbra.loadJournalRowNotes(function () { r(); }); }); await sleep(300); }
  // Row notes on, keyed by V_ID, as a state landing would set them; the Notes column painted by the journal's own pass
  async function journalOn() {
    fakeJournal();
    window.confirm = function () { return true; };
    window._penumbraJournalHidden = false;   // (the harness starts with the journal off)
    window._penumbraJournalRowNotes = true;
    window._penumbraJournalKeyColumns = ['V_ID'];
    if (window.Penumbra.journalMarkLoadedKey) window.Penumbra.journalMarkLoadedKey();
    window._penumbraToggleState = {};
    await loadNotes();
  }
  function keyOfRow(tr) { var b = tr ? tr.querySelector('.journal-notes-btn') : null; return b ? b.getAttribute('data-row-key') : null; }
  var LONG = 'The sponsor asked for a revised budget justification covering the equipment line, the travel line and the subaward; '
    + 'we agreed to send it by Friday, with the cost share letter from the department and the updated biosketches for both co-investigators.';
  function seed(k1, k2) {
    JS.notes[k1] = [{ ID: 11, NOTE_TEXT: 'Called the sponsor about the budget.', CREATED_BY: 'jdoe', AUTHOR_NAME: 'Jane Doe', CREATED_AT: '2026-10-20 09:00:00', PARENT_ID: null },
                    { ID: 12, NOTE_TEXT: LONG, CREATED_BY: 'harness', AUTHOR_NAME: 'Harness User', CREATED_AT: '2026-10-21 10:00:00', PARENT_ID: null }];
    if (k2) JS.notes[k2] = [{ ID: 21, NOTE_TEXT: 'Waiting on the PI.', CREATED_BY: 'jdoe', AUTHOR_NAME: 'Jane Doe', CREATED_AT: '2026-10-22 11:00:00', PARENT_ID: null }];
  }
  function panelOf(card) { return card ? q('.pnb-card-notes .journal-rownote-inline', card) : null; }
  function items(p) { return p ? qa(':scope > .journal-rownote-list .journal-rownote-item', p) : []; }
  function itemTexts(p) { return items(p).map(function (it) { return text(q('.journal-rownote-text', it)); }); }
  function inputOf(p) { return p ? q(':scope > .journal-rownote-compose .journal-rownote-input', p) : null; }
  function typeIn(el, t) { if (el._mentionMf && el._mentionMf.setText) el._mentionMf.setText(t); else { el.textContent = t; el.dispatchEvent(new Event('input', { bubbles: true })); } }
  function noteCardOpen() { return !!q('.journal-pvnote-card'); }
  function lastAct() { return JS.log.length ? JS.log[JS.log.length - 1] : null; }
  function acted(a) { return JS.log.filter(function (x) { return x.act === a; }); }
  function cardFor(tr) { var i = rowIdx(tr); return cards().filter(function (c) { return parseInt(c.getAttribute('data-row'), 10) === i; })[0] || null; }
  S.cnote = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    await journalOn();
    // the journal painting its Notes column in redraws the cards with it: a panel on every card, never the button
    await until(function () { return cards().length > 0 && cards().every(function (c) { return !!panelOf(c); }); }, 4000);
    var cs0 = cards();
    R.chk.autoDraw = !!fth('__JOURNAL_NOTES') && cs0.length > 0 && cs0.every(function (c) { return !!panelOf(c) && !q('.journal-notes-btn', c); });
    R.info.auto = { col: !!fth('__JOURNAL_NOTES'), cards: cs0.length, panels: qa('#pnbCardsHost .journal-rownote-inline').length, btns: qa('#pnbCardsHost .journal-notes-btn').length };
    var rows = shownRows(), k1 = keyOfRow(rows[1]), k2 = keyOfRow(rows[2]), c1 = cardFor(rows[1]);
    seed(k1, k2);
    await loadNotes();
    // the notes read again: the same card's panel follows (no redraw)
    var p1 = panelOf(c1), p2 = panelOf(cardFor(rows[2]));
    R.chk.refreshFollows = !!c1 && c1.isConnected && items(p1).length === 2 && items(p2).length === 1 && text(q('.journal-rownote-inlinecount', p1)) === '2';
    R.info.refresh = { k1: k1, c1: !!c1, conn: !!c1 && c1.isConnected, n1: items(p1).length, n2: items(p2).length };
    // every note in full: no cut text, no scroll box of its own
    var lt = items(p1)[1] ? q('.journal-rownote-text', items(p1)[1]) : null, ls = p1 ? q(':scope > .journal-rownote-list', p1) : null;
    R.chk.fullText = !!lt && text(lt) === LONG && lt.scrollHeight <= lt.clientHeight + 1 && !!ls && ls.scrollHeight <= ls.clientHeight + 1 && getComputedStyle(ls).overflowY === 'visible' && lt.getBoundingClientRect().height > 30;
    R.chk.label = !!p1 && text(q('.journal-rownote-inlinelbl', p1)) === thName('__JOURNAL_NOTES') && !!text(q('.journal-rownote-inlinelbl', p1));
    R.info.label = [p1 ? text(q('.journal-rownote-inlinelbl', p1)) : null, thName('__JOURNAL_NOTES')];
    // the usual buttons: Reply on each, Edit on your own newest, the x for an admin; Add a note
    var i11 = items(p1)[0], i12 = items(p1)[1];
    R.chk.buttons = !!i11 && !!i12 && !!q('.journal-rownote-reply-btn', i11) && !q('.journal-rownote-edit-btn', i11) && !!q('.journal-rownote-del', i11)
      && !!q('.journal-rownote-reply-btn', i12) && !!q('.journal-rownote-edit-btn', i12) && !!q('.journal-rownote-del', i12) && !!q('.journal-rownote-addbtn', p1);
    // (round I) a note is a line of text: a short one's author, text and age on one line; a long one wraps under its author
    var a11 = i11 ? q('.journal-rownote-author', i11) : null, t11 = i11 ? q('.journal-rownote-text', i11) : null, w11 = i11 ? q('.journal-rownote-when', i11) : null;
    var a12 = i12 ? q('.journal-rownote-author', i12) : null, rs12 = lt ? lt.getClientRects() : [];
    function topOf(el) { return el.getClientRects()[0].top; }
    R.chk.oneLine = !!a11 && !!t11 && !!w11 && Math.abs(topOf(a11) - topOf(t11)) < 4 && Math.abs(topOf(a11) - topOf(w11)) < 6 && !!q('.journal-rownote-meta', i11)
      && !!a12 && rs12.length > 2 && Math.abs(rs12[0].top - topOf(a12)) < 4 && rs12[rs12.length - 1].left < a12.getBoundingClientRect().left + 4;
    R.info.oneLine = { a: a11 ? topOf(a11) : null, t: t11 ? topOf(t11) : null, w: w11 ? topOf(w11) : null, rects: rs12.length, lastLeft: rs12.length ? Math.round(rs12[rs12.length - 1].left) : null, authLeft: a12 ? Math.round(a12.getBoundingClientRect().left) : null };
    // ...its Reply / Edit / x quiet icons: no frame, no fill, faint until pointed at
    document.body.classList.add('theme-light-sepia');
    var rb = i12 ? q('.journal-rownote-reply-btn', i12) : null, rcs = rb ? getComputedStyle(rb) : null, act12 = i12 ? q('.journal-rownote-act', i12) : null;
    R.chk.quietIcons = !!rb && !!q('svg', rb) && !text(rb) && /Reply/.test(rb.getAttribute('aria-label') || '') && parseFloat(rcs.borderTopWidth) === 0
      && (rcs.backgroundColor === 'rgba(0, 0, 0, 0)' || rcs.backgroundColor === 'transparent') && !!act12 && parseFloat(getComputedStyle(act12).opacity) < 1;
    R.info.icons = rcs ? { border: rcs.borderTopWidth, bg: rcs.backgroundColor, op: act12 ? getComputedStyle(act12).opacity : null } : null;
    document.body.classList.remove('theme-light-sepia');
    // (round I) Consistent Row Height on (the Settings switch; the harness starts with it off): the tall card kept to the
    // Standard height, faded under Show all
    var rx0 = q('#spRowExpandToggle');
    if (rx0 && !rx0.checked) { rx0.checked = true; rx0.dispatchEvent(new Event('change', { bubbles: true })); }
    await until(function () { return host().style.getPropertyValue('--pnb-card-cap') === '300px'; }, 3000);
    var mb1 = q(':scope > .pnb-card-more', c1);
    await until(function () { return c1.classList.contains('is-clipped'); }, 2000);
    mb1 = q(':scope > .pnb-card-more', c1);
    R.chk.capConsistent = c1.classList.contains('is-clipped') && c1.offsetHeight <= 300 + 26 && c1.offsetHeight < c1.scrollHeight && !!mb1 && text(mb1) === 'Show all' && host().style.getPropertyValue('--pnb-card-cap') === '300px';
    R.info.cap = { h: c1.offsetHeight, sh: c1.scrollHeight, cls: c1.className, cap: host().style.getPropertyValue('--pnb-card-cap') };
    if (mb1) mb1.click(); await sleep(120);
    var openOk = c1.classList.contains('is-open') && c1.offsetHeight > 300 + 26 && !!q(':scope > .pnb-card-more', c1) && text(q(':scope > .pnb-card-more', c1)) === 'Show less' && !detOpen();
    if (q(':scope > .pnb-card-more', c1)) q(':scope > .pnb-card-more', c1).click(); await sleep(120);
    R.chk.showAll = openOk && c1.classList.contains('is-clipped') && !c1.classList.contains('is-open') && c1.offsetHeight <= 300 + 26;
    // a click on a note's text reads it: no details window
    if (lt) lt.click(); await sleep(120);
    R.chk.textClickStays = !!lt && !detOpen();
    // Add a note: the composer IN the card, focused; never the floating note card
    q('.journal-rownote-addbtn', p1).click(); await sleep(120);
    var in1 = inputOf(p1);
    R.chk.addOpens = !!in1 && p1.classList.contains('is-composing') && c1.contains(in1) && document.activeElement === in1 && !noteCardOpen() && !detOpen();
    // (round I) the box opened in the cut-off part: the card shows whole
    await until(function () { return c1.classList.contains('is-open'); }, 1500);
    R.chk.composeOpens = c1.classList.contains('is-open') && !!in1 && in1.getBoundingClientRect().bottom <= c1.getBoundingClientRect().bottom;
    R.info.composeOpens = { cls: c1.className, inB: in1 ? Math.round(in1.getBoundingClientRect().bottom) : null, cB: Math.round(c1.getBoundingClientRect().bottom), act: document.activeElement ? document.activeElement.className : null };
    // Escape folds it away, the text kept: Add a note brings it back
    typeIn(in1, 'Draft one'); await sleep(60);
    keyOn(in1, 'Escape'); await sleep(120);
    var closed = !inputOf(p1) && !p1.classList.contains('is-composing') && document.activeElement === q('.journal-rownote-addbtn', p1);
    q('.journal-rownote-addbtn', p1).click(); await sleep(120);
    in1 = inputOf(p1);
    R.chk.escKeeps = closed && !!in1 && text(in1) === 'Draft one';
    // a redraw while writing: the composer, its text and the focus carried into the new card
    C().redraw(); await sleep(120);
    var c1b = cardFor(rows[1]), p1b = panelOf(c1b), in1b = inputOf(p1b);
    R.chk.carried = !!c1b && c1b !== c1 && !!in1b && text(in1b) === 'Draft one' && document.activeElement === in1b && p1b.classList.contains('is-composing');
    R.info.carried = { newCard: !!c1b && c1b !== c1, input: !!in1b, txt: in1b ? text(in1b) : null, focus: document.activeElement ? document.activeElement.className : null };
    // Post: the note lands in the card's list, the composer folds away
    var badShape = false, shapeMo = new MutationObserver(function () {
      qa('.journal-rownote-item', q(':scope > .journal-rownote-list', p1b)).forEach(function (it) { if (!q(':scope > .journal-rownote-meta', it)) badShape = true; });
    });
    shapeMo.observe(q(':scope > .journal-rownote-list', p1b), { childList: true, subtree: true });
    q('.journal-rownote-post', p1b).click();
    await until(function () { var p = panelOf(cardFor(rows[1])); return acted('add').length === 1 && items(p).length === 3 && !inputOf(p); }, 5000);
    var p1c = panelOf(cardFor(rows[1]));
    R.chk.post = acted('add').length === 1 && acted('add')[0].body.row_key === k1 && acted('add')[0].body.note_text === 'Draft one' && itemTexts(p1c)[2] === 'Draft one'
      && !inputOf(p1c) && text(q('.journal-rownote-inlinecount', p1c)) === '3' && !noteCardOpen();
    // a card beside a taller one (its notes) keeps its parts together at the top: no gaps spread through it
    var c0 = cardFor(rows[0]), c1p = cardFor(rows[1]), sameRow = !!c0 && !!c1p && c0.offsetTop === c1p.offsetTop;
    var tt0 = c0 ? q('.pnb-card-title', c0) : null, bg0 = c0 ? q('.pnb-card-big', c0) : null;
    R.chk.topAligned = sameRow && c1p.offsetHeight > 0 && c0.offsetHeight >= c0.scrollHeight - 1 && c0.offsetHeight > 200 && !!tt0 && !!bg0 && bg0.getBoundingClientRect().top - tt0.getBoundingClientRect().bottom < 16;
    R.info.top = { sameRow: sameRow, h: c0 ? [c0.offsetHeight, c1p.offsetHeight] : null, gap: (tt0 && bg0) ? Math.round(bg0.getBoundingClientRect().top - tt0.getBoundingClientRect().bottom) : null };
    shapeMo.disconnect();
    // (round J) every note of yours can be edited, not only the newest: the older one (12) and the new one both offer Edit
    var o12 = items(p1c).filter(function (it) { return it.getAttribute('data-note-id') === '12'; })[0], oNew = items(p1c)[2];
    R.chk.editOlder = !!o12 && !!q('.journal-rownote-edit-btn', o12) && !!oNew && !!q('.journal-rownote-edit-btn', oNew) && !q('.journal-rownote-edit-btn', items(p1c)[0]);
    R.chk.postKeepsShape = !badShape && items(p1c).length === 3 && items(p1c).every(function (it) { return !!q(':scope > .journal-rownote-meta', it); });
    R.info.post = { adds: acted('add').length, n: items(p1c).length, texts: itemTexts(p1c).map(function (s) { return (s || '').slice(0, 20); }), composing: !!inputOf(p1c) };
    // Reply to the first note: the banner names its author, the post goes under it
    q('.journal-rownote-reply-btn', items(p1c)[0]).click(); await sleep(120);
    var inR = inputOf(p1c), ban = q('.journal-rownote-reply-banner', p1c);
    var banOk = !!inR && !!ban && /Jane Doe/.test(text(ban));
    typeIn(inR, 'A reply in the card'); q('.journal-rownote-post', p1c).click();
    await until(function () { var p = panelOf(cardFor(rows[1])); return acted('add').length === 2 && items(p).length === 4; }, 5000);
    var p1d = panelOf(cardFor(rows[1])), rep = items(p1d).filter(function (it) { return it.classList.contains('journal-rownote-reply'); })[0];
    R.chk.reply = banOk && acted('add').length === 2 && String(acted('add')[1].body.parent_id) === '11' && !!rep && text(q('.journal-rownote-text', rep)) === 'A reply in the card';
    // Edit your newest (the reply): the composer takes its text, Save writes it back
    var eb = rep ? q('.journal-rownote-edit-btn', rep) : null;
    if (eb) eb.click(); await sleep(120);
    var inE = inputOf(p1d), saveLbl = text(q('.journal-rownote-post', p1d));
    var editOpen = !!inE && text(inE) === 'A reply in the card' && saveLbl === 'Save';
    if (inE) { typeIn(inE, 'An edited reply'); q('.journal-rownote-post', p1d).click(); }
    await until(function () { var p = panelOf(cardFor(rows[1])); return acted('edit').length === 1 && itemTexts(p).indexOf('An edited reply') >= 0; }, 5000);
    var p1e = panelOf(cardFor(rows[1]));
    R.chk.edit = !!eb && editOpen && acted('edit').length === 1 && String(acted('edit')[0].body.note_id) === String(rep.getAttribute('data-note-id')) && itemTexts(p1e).indexOf('An edited reply') >= 0 && !inputOf(p1e);
    R.info.edit = { eb: !!eb, open: editOpen, lbl: saveLbl, edits: acted('edit').length };
    // x deletes it
    var rep2 = items(p1e).filter(function (it) { return it.classList.contains('journal-rownote-reply'); })[0], db = rep2 ? q('.journal-rownote-del', rep2) : null;
    if (db) db.click();
    await until(function () { var p = panelOf(cardFor(rows[1])); return acted('delete').length === 1 && items(p).length === 3; }, 5000);
    R.chk.del = !!db && acted('delete').length === 1 && items(panelOf(cardFor(rows[1]))).length === 3 && itemTexts(panelOf(cardFor(rows[1]))).indexOf('An edited reply') < 0;
    // (round I) a double-click on your own newest note edits it
    var pDb = panelOf(cardFor(rows[1])), mine = items(pDb).filter(function (it) { return it.classList.contains('is-editable'); })[0];
    if (mine) q('.journal-rownote-text', mine).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await sleep(120);
    var inDb = inputOf(panelOf(cardFor(rows[1])));
    R.chk.dblEdit = !!mine && !!inDb && text(inDb) === text(q('.journal-rownote-text', mine)) && text(q('.journal-rownote-post', panelOf(cardFor(rows[1])))) === 'Save';
    if (inDb) { keyOn(inDb, 'Escape'); await sleep(100); }
    // a card's menu: Add a note to this row... writes in the card
    var c2 = cardFor(rows[2]), ev = rclick(q('.pnb-card-fields dt', c2)); await sleep(100);
    var an = menu() ? q('.pnb-hm-item[data-act="addNote"]', menu()) : null;
    if (an) an.click(); await sleep(150);
    var p2b = panelOf(cardFor(rows[2]));
    R.chk.menuAddNote = !!an && !!inputOf(p2b) && document.activeElement === inputOf(p2b) && !noteCardOpen();
    R.chk.cardWording = !!an && /this card/.test(text(an)) && !/this row/.test(text(an));   // (round I)
    R.info.anLabel = an ? text(an) : null;
    R.info.menu = { acts: acts(), an: !!an };
    if (menu()) keyOn(document.activeElement, 'Escape');
    if (inputOf(p2b)) { keyOn(inputOf(p2b), 'Escape'); await sleep(80); }
    // Quick actions' add a note: the selected card
    var none = C().noteCard ? C().noteCard() : 'no api';
    var c3 = cardFor(rows[3]); c3.focus(); keyOn(c3, ' '); await sleep(60);
    var nc = C().noteCard ? C().noteCard() : null, took = nc && C().addNote('From quick actions'); await sleep(150);
    var p3 = panelOf(cardFor(rows[3]));
    R.chk.paletteNote = none === null && !!nc && nc.title === text(q('.pnb-card-title', c3)) && !!took && !!inputOf(p3) && text(inputOf(p3)) === 'From quick actions';
    if (inputOf(p3)) { keyOn(inputOf(p3), 'Escape'); await sleep(80); }
    // (round I) Consistent Row Height off (the Settings switch): the cap is the window's, the 3-note card whole
    var rx = q('#spRowExpandToggle');
    if (rx) { rx.checked = false; rx.dispatchEvent(new Event('change', { bubbles: true })); }
    await until(function () { return host().style.getPropertyValue('--pnb-card-cap') === (window.innerHeight - 140) + 'px'; }, 3000);
    var c1x = cardFor(rows[1]);
    R.chk.capOff = !!rx && document.body.classList.contains('disable-auto-expand') && host().style.getPropertyValue('--pnb-card-cap') === (window.innerHeight - 140) + 'px' && !!c1x && !c1x.classList.contains('is-clipped');
    R.info.capOff = { rx: !!rx, cap: host().style.getPropertyValue('--pnb-card-cap'), vh: window.innerHeight, cls: c1x ? c1x.className : null };
    if (rx) { rx.checked = true; rx.dispatchEvent(new Event('change', { bubbles: true })); await sleep(250); }
    // a Notes column the viewer hid: no notes on the cards, as no hidden column
    var nth = fth('__JOURNAL_NOTES'), before = qa('#pnbCardsHost .journal-rownote-inline').length;
    if (nth) { nth.style.display = 'none'; C().redraw(); await sleep(100); }
    R.chk.hiddenNone = !!nth && before > 0 && qa('#pnbCardsHost .journal-rownote-inline').length === 0 && cards().length > 0;
    if (nth) { nth.style.display = ''; C().redraw(); await sleep(100); }
    if (P.get('shot')) {   // the picture: a card with its notes and the composer open
      if (P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(200); }
      var ps = panelOf(cardFor(rows[1])); if (ps) { q('.journal-rownote-addbtn', ps).click(); await sleep(150); typeIn(inputOf(ps), 'Sent the revised budget.'); }
      cardFor(rows[1]).scrollIntoView({ block: 'center' }); await sleep(200);
    }
  };
  // (round I, cardsmenu) the table's own right-click menus: Show as cards, a list of the sizes, This row as a card
  S.ctmenu = async function () {
    await until(function () { return !!sw() && !sw().hidden && !on(); }, 8000);
    var tr = shownRows()[3], cell = td(tr, 'V_NAME');
    rclick(cell); await sleep(80);
    var has = !!menu() && acts().indexOf('showCards') >= 0;
    var sub = await openSub('showCards');
    var sa = sub ? qa('.pnb-hm-item', sub).map(function (x) { return x.getAttribute('data-act'); }) : [];
    R.chk.flyout = has && same(sa, ['showCards-compact', 'showCards-standard', 'showCards-large', 'showCards-xl', 'showCardRow'])
      && q('.pnb-hm-item[data-act="showCards-standard"]', sub).getAttribute('aria-checked') === 'true';
    R.info.flyout = { has: has, sub: sa };
    var lg = sub ? q('.pnb-hm-item[data-act="showCards-large"]', sub) : null;
    if (lg) lg.click(); await until(function () { return on() && cards().length > 0; }, 4000); await sleep(100);
    R.chk.pickSize = on() && C().size() === 'large' && host().classList.contains('is-large') && !menu();
    await pickView('table');
    rclick(td(shownRows()[3], 'V_NAME')); await sleep(80);
    sub = await openSub('showCards');
    var rowIt = sub ? q('.pnb-hm-item[data-act="showCardRow"]', sub) : null;
    if (rowIt) rowIt.click(); await until(function () { return on() && detOpen(); }, 4000); await sleep(100);
    var at = C().details().at, cs = cards();
    R.chk.rowCard = !!rowIt && on() && detOpen() && !!cs[at] && parseInt(cs[at].getAttribute('data-row'), 10) === rowIdx(tr);
    C().closeDetails(); await pickView('table');
    // a heading's menu: the sizes alone (no row there)
    rclick(fth('V_NAME')); await sleep(80);
    sub = await openSub('showCards');
    var ha = sub ? qa('.pnb-hm-item', sub).map(function (x) { return x.getAttribute('data-act'); }) : [];
    R.chk.headerFlyout = ha.length === 4 && ha.indexOf('showCardRow') < 0;
    if (menu()) keyOn(document.activeElement, 'Escape');
  };
  // (round J) filter links in a card and in the details window; links themed as the table's; the field highlight in
  // each theme's table-hover colour
  function colourOf(css) { var e = document.createElement('span'); e.style.color = css; document.body.appendChild(e); var c = getComputedStyle(e).color; e.parentNode.removeChild(e); return c; }
  function bgOfVar(name, fb) { var e = document.createElement('span'); e.style.backgroundColor = 'var(' + name + ', ' + fb + ')'; document.body.appendChild(e); var c = getComputedStyle(e).backgroundColor; e.parentNode.removeChild(e); return c; }
  function setThemeClass(t) {
    var b = document.body;
    b.className = b.className.replace(/\btheme-[\w-]+\b/g, '').replace(/\b(is-dark|registry-theme)\b/g, '').replace(/\s+/g, ' ').trim();
    b.removeAttribute('data-theme');
    if (t && t.id) applyTheme(t); else if (t) b.classList.add(t);
  }
  S.cflink = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    var tr = shownRows()[2], name = tdText(tr, 'V_NAME'), q1 = 'V_NAME = //' + name + '//';
    function plant() { var c = td(tr, 'V_NAME'); c.innerHTML = '<a href="#" data-search="' + q1.replace(/"/g, '&quot;') + '">' + name + '</a>'; C().redraw(); }
    plant(); await sleep(100);
    var cl = q('dd[data-col="V_NAME"] a[data-search]', cardFor(tr));
    if (cl) cl.click();
    await until(function () { return window.jQuery('#tableSearch').val() === q1 && cards().length > 0 && cards().length < 200; }, 5000);
    R.chk.cardLink = !!cl && window.jQuery('#tableSearch').val() === q1 && cards().length > 0 && cards().length < 200 && !detOpen();
    R.info.cardLink = { link: !!cl, search: window.jQuery('#tableSearch').val(), cards: cards().length };
    await runSearch(''); await until(function () { return shownRows().length === 200 && cards().length === 200; }, 6000);
    plant(); await sleep(100);
    q('.pnb-card-title', cardFor(tr)).click(); await sleep(150);
    var dl = q('#pnbCardDetails dd[data-col="V_NAME"] a[data-search]');
    var wasOpen = detOpen();
    if (dl) dl.click();
    await until(function () { return window.jQuery('#tableSearch').val() === q1 && !detOpen() && cards().length < 200; }, 5000);
    R.chk.detailsLink = wasOpen && !!dl && window.jQuery('#tableSearch').val() === q1 && !detOpen() && cards().length > 0 && cards().length < 200;
    R.info.detailsLink = { open: wasOpen, link: !!dl, search: window.jQuery('#tableSearch').val(), det: detOpen() };
    await runSearch(''); await until(function () { return shownRows().length === 200 && cards().length === 200; }, 6000);
    // a link on a card's value takes the table's own link styling, theme by theme (no theme; Light Sepia; a registry theme)
    var reg = (window.__THEMES || []).filter(function (x) { return x.modern; })[0], looks = [], linkOk = true;
    [null, 'theme-light-sepia', reg].forEach(function (th) {
      setThemeClass(th);
      var tr0 = shownRows()[0], tl = td(tr0, 'V_LINK') ? td(tr0, 'V_LINK').querySelector('a') : null, ca = q('dd[data-col="V_LINK"] a', cardFor(tr0));
      var a = tl ? getComputedStyle(tl) : null, b = ca ? getComputedStyle(ca) : null;
      var ok = !!a && !!b && a.color === b.color && a.textDecorationLine === b.textDecorationLine && b.textDecorationLine === 'none';
      looks.push({ theme: th ? (th.id || th) : 'none', table: a ? [a.color, a.textDecorationLine] : null, card: b ? [b.color, b.textDecorationLine] : null });
      if (!ok) linkOk = false;
    });
    R.chk.linkThemed = linkOk && !!reg;
    R.info.links = looks;
    // the field a menu is open for, in the theme's table-hover colour (Light Sepia names its own; a registry theme sets --row-hover)
    var hv = [], hvOk = true;
    [[null, colourOf('#F0E68C')], ['theme-light-sepia', colourOf('#dcd5c9')], [reg, null]].forEach(function (pair) {
      setThemeClass(pair[0]);
      var want = pair[1] || bgOfVar('--row-hover', '#F0E68C');
      var dd = q('dd[data-col="V_DATE"]', cards()[1]); rclick(dd);
      var dt = dd ? dd.previousElementSibling : null, got = dt ? getComputedStyle(dt).backgroundColor : null;
      hv.push({ theme: pair[0] ? (pair[0].id || pair[0]) : 'none', want: want, got: got, menu: !!menu() });
      if (!menu() || got !== want) hvOk = false;
      if (menu()) keyOn(document.activeElement, 'Escape');
    });
    await sleep(60);
    R.chk.hoverThemed = hvOk;
    R.info.hover = hv;
    setThemeClass(null);
  };
  S.cnotedet = async function () {
    await until(function () { return on() && cards().length > 0; }, 8000);
    await journalOn();
    var rows = shownRows(), k1 = keyOfRow(rows[1]);
    seed(k1, null);
    await loadNotes();
    // the details window: the row's notes in full, written in place
    q('.pnb-card-title', cardFor(rows[1])).click(); await sleep(150);
    var dp = q('#pnbCardDetails .pnb-cdet-notes .journal-rownote-inline');
    R.chk.inDetails = detOpen() && !!dp && items(dp).length === 2 && itemTexts(dp)[1] === LONG && !q('#pnbCardDetails .journal-notes-btn');
    if (dp) q('.journal-rownote-addbtn', dp).click(); await sleep(120);
    var din = inputOf(dp);
    R.chk.addInDetails = !!din && document.activeElement === din && !!din.closest('#pnbCardDetails') && !noteCardOpen();
    // Escape: the composer first, the window stays; again: the window closes
    if (din) { typeIn(din, 'From the window'); keyOn(din, 'Escape'); } await sleep(120);
    R.chk.escComposerFirst = !!din && !inputOf(dp) && detOpen();
    keyOn(document.activeElement, 'Escape'); await sleep(120);
    R.chk.escThenCloses = R.chk.escComposerFirst === true && !detOpen();   // (after the composer closed first: never vacuous)
    // post from the window: the note in the window's list and on the card behind it
    q('.pnb-card-title', cardFor(rows[1])).click(); await sleep(150);
    dp = q('#pnbCardDetails .pnb-cdet-notes .journal-rownote-inline');
    if (dp) q('.journal-rownote-addbtn', dp).click(); await sleep(120);
    din = inputOf(dp);
    var kept = !!din && text(din) === 'From the window';
    if (din) q('.journal-rownote-post', dp).click();
    await until(function () { var d = q('#pnbCardDetails .pnb-cdet-notes .journal-rownote-inline'); return acted('add').length === 1 && items(d).length === 3 && items(panelOf(cardFor(rows[1]))).length === 3; }, 5000);
    var d2 = q('#pnbCardDetails .pnb-cdet-notes .journal-rownote-inline');
    R.chk.postInDetails = kept && acted('add').length === 1 && itemTexts(d2)[2] === 'From the window' && itemTexts(panelOf(cardFor(rows[1])))[2] === 'From the window' && detOpen();
    R.info.det = { kept: kept, adds: acted('add').length, n: items(d2).length, card: items(panelOf(cardFor(rows[1]))).length };
    C().closeDetails(); await sleep(80);
    // compact cards draw no notes: their menu's Add a note opens the details window's composer
    C().setSize('compact'); await sleep(150);
    var cc = cardFor(rows[2]), noNotes = qa('#pnbCardsHost .journal-rownote-inline').length === 0;
    rclick(q('.pnb-card-title', cc)); await sleep(100);
    var an = menu() ? q('.pnb-hm-item[data-act="addNote"]', menu()) : null;
    if (an) an.click(); await sleep(200);
    var dp3 = q('#pnbCardDetails .pnb-cdet-notes .journal-rownote-inline');
    R.chk.compactViaDetails = noNotes && !!an && detOpen() && !!inputOf(dp3) && document.activeElement === inputOf(dp3) && !noteCardOpen();
    R.info.compact = { noNotes: noNotes, an: !!an, acts: acts(), open: detOpen() };
    C().closeDetails(); C().setSize('standard'); await sleep(80);
  };

  // ---- (round K) the card's words; Find and the search's marks on the cards; the Bar list ------------------------
  function hl(name) { var h = (window.CSS && CSS.highlights) ? CSS.highlights.get(name) : null; return h ? Array.from(h) : []; }
  function rangeEl(r) { var n = r.startContainer; return n.nodeType === 1 ? n : n.parentElement; }
  function inCards(r) { var e = rangeEl(r); return !!(e && e.isConnected && e.closest('#pnbCardsHost, #pnbCardDetails')); }
  function rangeText(r) { var d = r.startContainer.data || ''; return d.slice(r.startOffset, r.endOffset); }
  function FD() { return window.Penumbra && window.Penumbra.find; }
  async function findSettle() { await until(function () { var s = FD()._state(); return !s.scanning && !s.typing; }, 20000); await sleep(200); }
  function findInp() { return q('#pnbFindBar .pnb-find-input'); }
  async function findStep(shift) { var i = findInp(); i.focus(); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: !!shift, bubbles: true, cancelable: true })); await sleep(60); await findSettle(); }
  async function findType(s) { var i = findInp(); i.focus(); i.value = s; i.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); await findSettle(); }
  function foundLines(kind) { return qa('#pnbCardsHost .pnb-card-found.is-' + kind); }
  function outlined() { return qa('#pnbCardsHost .pnb-card.is-find-cur'); }
  // on screen: inside the window and inside every box around it that scrolls (the find suite's)
  function inViewAny(el) {
    var r = el.getBoundingClientRect();
    if (!(r.width || r.height) || r.top < 0 || r.bottom > innerHeight) return false;
    for (var n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) { var b = n.getBoundingClientRect(); if (r.top < b.top - 1 || r.bottom > b.bottom + 1) return false; }
    }
    return true;
  }
  function trOfId(v) { return qa('#resultsTable > tbody > tr').filter(function (t) { return tdText(t, 'V_ID') === v; })[0] || null; }
  function cardOfId(v) { var tr = trOfId(v); return tr ? q('#pnbCardsHost .pnb-card[data-row="' + rowIdx(tr) + '"]') : null; }
  function sepTidy(m) { var s = qa('.pnb-hm-item, .pnb-hm-sep', m).map(function (e) { return e.classList.contains('pnb-hm-sep') ? '-' : 'i'; }).join(''); return s.length > 0 && s.indexOf('--') < 0 && s[0] !== '-' && s[s.length - 1] !== '-'; }
  var SORTS = ['sortAsc', 'sortDesc', 'thenAsc', 'thenDesc', 'sortClear'];
  S.ckword = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    var copied = null;
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (t) { copied = t; return Promise.resolve(); } } }); } catch (e) { }
    // the card's empty area: Copy -> This entire card; run, it copies the card and says so
    rclick(q('.pnb-card-fields dt', cards()[0])); await sleep(100);
    var it = menu() ? q('.pnb-hm-item[data-act="copyRow"]', menu()) : null, inSub = false;
    if (!it) { var cps = await openSub('copyMenu'); it = cps ? q('.pnb-hm-item[data-act="copyRow"]', cps) : null; inSub = !!it; }
    var lab = it ? (text(q('.pnb-hm-label', it)) || text(it)) : null;
    R.info.copy = { label: lab, inSub: inSub, acts: acts() };
    R.chk.copyCardLabel = lab === (inSub ? 'This entire card' : 'Copy this card');
    if (it) it.click();
    var toasted = await until(function () { return /Copied the card \(\d+ fields\)\./.test(document.body.innerText || ''); }, 3000);
    R.info.toast = (document.body.innerText.match(/Copied the [a-z]+ \(\d+ [a-z]+\)\./) || [null])[0];
    R.chk.copyCardToast = toasted && !!copied && copied.split('\n').length >= 6;
    // (round M) the clipboard refusing it: the card's words too
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function () { return Promise.reject(new Error('denied')); } } }); } catch (e) { }
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(60);
    rclick(q('.pnb-card-fields dt', cards()[1])); await sleep(100);
    var cps2 = await openSub('copyMenu'), it2 = cps2 ? q('.pnb-hm-item[data-act="copyRow"]', cps2) : null; if (it2) it2.click();
    var failed = await until(function () { return /The card could not be copied\./.test(document.body.innerText || ''); }, 3000);
    R.chk.copyFailCard = !!it2 && failed && !/The row could not be copied\./.test(document.body.innerText || '');
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(60);
    // a value's Field stats: over the cards
    rclick(q('.pnb-card-pill[data-col="V_STATUS"]', cards()[0])); await sleep(100);
    var ss = await openSub('stats'), hs = ss ? heads(ss) : [];
    R.info.statsHeads = hs;
    R.chk.statsOverCards = hs[0] === 'Over the 300 cards';   // (every row the filter keeps, as the table's)
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    // the details window: a value's menu without Sort / Then sort / Clear sort, tidy; a card's own menu keeps them
    q('.pnb-card-fields dt', cards()[2]).click(); await sleep(200);
    rclick(q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_DATE"]')); await sleep(100);
    var da = acts(); R.info.detActs = da;
    R.chk.detNoSort = !!menu() && SORTS.every(function (x) { return da.indexOf(x) < 0; }) && da.indexOf('cardsTable') >= 0 && da.indexOf('stats') >= 0;
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    // a number field's menu: its sorts sit between two separators (no Filter by value, no stats after them)
    rclick(q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_AMOUNT"]')); await sleep(100);
    var na = acts(), seq = menu() ? qa('.pnb-hm-item, .pnb-hm-sep', menu()).map(function (e) { return e.classList.contains('pnb-hm-sep') ? '-' : e.getAttribute('data-act'); }) : [];
    R.info.detNum = seq;
    R.chk.detNoDoubleSep = R.chk.detNoSort === true && !!menu() && SORTS.every(function (x) { return na.indexOf(x) < 0; }) && sepTidy(menu());
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    C().closeDetails(); await sleep(100);
    rclick(q('.pnb-card-fields dd[data-col="V_DATE"]', cards()[2])); await sleep(100);
    R.chk.cardKeepsSort = !!menu() && acts().indexOf('sortAsc') >= 0;
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
    // the table's own stats: the rows the filter keeps, as they were
    await pickView('table');
    rclick(td(shownRows()[0], 'V_STATUS')); await sleep(100);
    ss = await openSub('stats'); hs = ss ? heads(ss) : [];
    R.info.tableHeads = hs;
    R.chk.tableStatsRows = hs[0] === 'Over the 300 rows the filter keeps';
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(80);
  };
  S.cfind = async function () {
    await until(function () { return on() && cards().length === 200 && !!FD(); }, 8000);
    var nId = thName('V_ID'), nSt = thName('V_STATUS');
    // the search box: its marks on the cards' own text (the title), none on the hidden table
    await runSearch('Kilo'); await until(function () { return hl('pnb-filter').some(inCards); }, 4000);
    var fr = hl('pnb-filter');
    R.info.filter = { n: fr.length, inCards: fr.filter(inCards).length, sample: fr.slice(0, 3).map(rangeText), cards: cards().length };
    R.chk.filterOnCards = fr.length > 0 && fr.every(inCards) && fr.some(function (r) { return !!rangeEl(r).closest('.pnb-card-title'); }) && fr.every(function (r) { return /^kilo$/i.test(rangeText(r)); });
    // a scoped term in a field the card does not show: each card says so; a click opens the details, marked there
    await runSearch('V_STATUS = Closed'); await until(function () { return foundLines('filter').length > 0 && foundLines('filter').length === cards().length; }, 4000);
    var fl = foundLines('filter'), cs = cards();
    R.info.lines = { n: fl.length, cards: cs.length, text: fl[0] ? text(fl[0]) : null, prev: fl[0] && fl[0].previousElementSibling ? fl[0].previousElementSibling.className : null };
    R.chk.filterBuriedNamed = cs.length > 0 && cs.length < 200 && fl.length === cs.length && fl.every(function (b) { return text(b) === 'Also matches in: ' + nSt; })
      && !!fl[0].previousElementSibling && fl[0].previousElementSibling.classList.contains('pnb-card-top');
    var b1 = q('.pnb-card-found', cs[1]); if (b1) b1.click(); await sleep(300);
    var dd = q('#pnbCardDetails .pnb-cdet-fields dd[data-col="V_STATUS"]');
    R.chk.foundOpensDetails = !!b1 && detOpen() && C().details().at === 1 && !!dd && hl('pnb-filter').some(function (r) { return dd.contains(rangeEl(r)); });
    R.info.det = { open: detOpen(), at: C().details().at, dd: !!dd, lineOnOpen: !!q('.pnb-card-found.is-filter', cards()[1]) };
    C().closeDetails(); await sleep(300);
    R.chk.lineBackAfterClose = R.chk.foundOpensDetails === true && !!q('.pnb-card-found.is-filter', cards()[1]);
    await runSearch(''); await until(function () { return cards().length === 200; }, 6000); await sleep(300);
    R.chk.filterCleared = R.chk.filterBuriedNamed === true && foundLines('filter').length === 0 && hl('pnb-filter').length === 0;
    // Find: its matches on the cards, the current one's card outlined
    window.scrollTo(0, 0); await sleep(100);
    FD().open('Kilo'); await findSettle(); await findStep(false);
    var fh = hl('pnb-find'), fc = hl('pnb-find-cur'), out = outlined();
    R.info.find = { n: fh.length, cur: fc.length, st: FD()._state(), outlined: out.length };
    R.chk.findOnCards = fh.length + fc.length > 0 && fh.concat(fc).every(inCards) && fh.concat(fc).every(function (r) { return /^kilo$/i.test(rangeText(r)); });
    R.chk.findCurOutlined = out.length === 1 && fc.length > 0 && fc.every(function (r) { return out[0].contains(rangeEl(r)); }) && getComputedStyle(out[0]).outlineStyle === 'solid';
    // ...and in the details window of the card it shows
    if (out[0]) q('.pnb-card-title', out[0]).click(); await sleep(300);
    var dw = q('#pnbCardDetails');
    R.chk.findInDetails = detOpen() && hl('pnb-find').concat(hl('pnb-find-cur')).some(function (r) { return dw.contains(rangeEl(r)) && r.startContainer.isConnected; });
    // (the sweep) the bar over the window: what is drawn at its box's middle is the bar
    var fb = q('#pnbFindBar'), fbr = fb ? fb.getBoundingClientRect() : null, atb = fbr ? document.elementFromPoint(fbr.left + 20, fbr.top + fbr.height / 2) : null;
    R.info.barOver = { z: fb ? getComputedStyle(fb).zIndex : null, at: atb ? (atb.id || atb.className) : null };
    R.chk.barOverDetails = detOpen() && !!fb && !!atb && fb.contains(atb);
    // an Escape typed in Find's box closes Find, not the window under it
    var fi = findInp(); fi.focus(); fi.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await sleep(250);
    R.info.findEsc = { findOpen: FD().isOpen(), det: detOpen() };
    R.chk.findEscKeepsDetails = !FD().isOpen() && detOpen();
    FD().open('Kilo'); await findSettle();
    C().closeDetails(); await sleep(200);
    // a match the card does not show, far down the page: named on its card (the current one's line), the card brought on screen
    window.scrollTo(0, 0); await sleep(150);
    var c190 = cardOfId('ID-1190'), before = c190 ? inViewAny(c190) : null;
    await findType('ID-1190'); await sleep(300);   // (one match: reading the term makes it current - no Enter)
    out = outlined(); var ln = foundLines('find');
    R.info.buried = { st: FD()._state(), out: out.length, lines: ln.map(text), before: before, same: out[0] === c190, y: out[0] ? Math.round(out[0].getBoundingClientRect().top) : null };
    R.chk.findBuriedNamed = ln.length === 1 && text(ln[0]) === 'Found in: ' + nId && ln[0].classList.contains('is-cur') && out.length === 1 && out[0].contains(ln[0]) && out[0] === c190;
    R.chk.findScrolled = before === false && out.length === 1 && inViewAny(out[0]);
    // one on the next page: the page turns, its card outlined and on screen
    await findType('ID-1250');   // (one match, on the next page: the read itself turns the page - before the cards are drawn)
    await until(function () { return outlined().length === 1 && cards().length === 100; }, 6000); await sleep(300);
    out = outlined();
    R.info.page = { sy: Math.round(window.scrollY), top: out[0] ? Math.round(out[0].getBoundingClientRect().top) : null, cards: cards().length, out: out.length, same: out[0] === cardOfId('ID-1250'), view: out[0] ? inViewAny(out[0]) : null, line: out[0] ? text(q('.pnb-card-found.is-find', out[0])) : null };
    R.chk.findPageTurn = cards().length === 100 && out.length === 1 && out[0] === cardOfId('ID-1250') && inViewAny(out[0]) && text(q('.pnb-card-found.is-find', out[0])) === 'Found in: ' + nId;
    FD().close(); await sleep(250);
    R.chk.findCloseClears = R.chk.findBuriedNamed === true && foundLines('find').length === 0 && outlined().length === 0 && hl('pnb-find').length === 0 && hl('pnb-find-cur').length === 0;
    // the table: Find paints its cells, as before
    await pickView('table');
    FD().open('Kilo'); await findSettle(); await findStep(false);
    var th = hl('pnb-find').concat(hl('pnb-find-cur'));
    R.chk.tableFindUnchanged = th.length > 0 && th.every(function (r) { return !!rangeEl(r).closest('#resultsTable'); }) && !!q('#resultsTable td.pnb-find-cur');
    FD().close(); await sleep(100);
  };
  S.gfind = async function () {
    await until(function () { return on() && grps().length > 1 && cards().length > 0 && !!FD(); }, 10000);
    // a group's name: on the cards' own band
    FD().open('North'); await findSettle(); await findStep(false);
    var all = hl('pnb-find').concat(hl('pnb-find-cur'));
    R.info.band = { n: all.length, st: FD()._state(), where: all.slice(0, 4).map(function (r) { return rangeEl(r).className + '|' + rangeText(r); }) };
    R.chk.bandMarked = all.length > 0 && all.every(inCards) && all.some(function (r) { return !!rangeEl(r).closest('.pnb-cards-grpname'); });
    // a value: on its card
    await findType('Kilo'); await findStep(false);
    all = hl('pnb-find').concat(hl('pnb-find-cur'));
    R.info.cell = { n: all.length, st: FD()._state(), out: outlined().length };
    R.chk.cellMarked = all.length > 0 && all.every(inCards) && all.some(function (r) { return !!rangeEl(r).closest('.pnb-card'); }) && outlined().length === 1;
    FD().close(); await sleep(150);
    // a match in a folded band: Find opens the group, the cards draw it (the fold watcher's timer), then its card on screen
    var gl = grps()[grps().length - 1], gc = gl ? q('.pnb-card', gl) : null, gid = gc ? text(q('.pnb-card-title', gc)) : null;
    if (gl) q('.pnb-cards-grptoggle', gl).click();
    await until(function () { var g2 = grps()[grps().length - 1]; return !!g2 && g2.classList.contains('is-closed'); }, 4000); await sleep(200);
    var folded = grps()[grps().length - 1].classList.contains('is-closed') && !q('.pnb-card', grps()[grps().length - 1]);
    window.scrollTo(0, 0); await sleep(150);
    FD().open(gid); await findSettle();   // (one match: the read goes to it, opening the group before the cards draw it)
    await until(function () { return outlined().length === 1 && inViewAny(outlined()[0]); }, 5000); await sleep(200);
    var fo = outlined();
    R.info.fold = { sy: Math.round(window.scrollY), id: gid, folded: folded, out: fo.length, title: fo[0] ? text(q('.pnb-card-title', fo[0])) : null, view: fo[0] ? inViewAny(fo[0]) : null, st: FD()._state() };
    R.chk.foldedRevealed = !!gid && folded && fo.length === 1 && text(q('.pnb-card-title', fo[0])) === gid && inViewAny(fo[0]) && !grps()[grps().length - 1].classList.contains('is-closed');
    FD().close(); await sleep(150);
    // the search box's marks
    await runSearch('Kilo'); await until(function () { return hl('pnb-filter').some(inCards); }, 5000); await sleep(200);
    var fr = hl('pnb-filter');
    R.info.filter = { n: fr.length, inCards: fr.filter(inCards).length };
    R.chk.filterMarked = fr.length > 0 && fr.every(inCards);
    await runSearch('');
  };
  S.cbarpick = async function () {
    await until(function () { return !!q('#pnbCardBar') && window.Penumbra.cardsHost && window.Penumbra.cardsHost.loaded(); }, 8000);
    C().populate(); await sleep(100);   // (the View Options tab opened: the lists read the table's columns now)
    function o(v) { return q('#pnbCardBar option[value="' + v + '"]'); }
    R.info.bar = qa('#pnbCardBar option').map(function (x) { return x.value + (x.disabled ? '-' : '+'); });
    R.chk.textOff = ['V_NAME', 'V_ID', 'H_TEXT', 'H_GROUP', 'H_GROUP2', 'H_FLAG', 'H_CODE', 'H_JSON'].every(function (v) { return !!o(v) && o(v).disabled; });
    R.chk.numberOn = ['V_AMOUNT', 'H_NUM', 'H_AMT', 'H_MONEY'].every(function (v) { return !!o(v) && !o(v).disabled; });
    R.chk.pickedKept = q('#pnbCardBar').value === 'V_STATUS' && !!o('V_STATUS') && !o('V_STATUS').disabled;
    R.chk.otherSlotsOpen = qa('#pnbCardTitle option').length > 5 && !q('#pnbCardTitle option:disabled') && !q('#pnbCardPill option:disabled') && !q('#pnbCardBig option:disabled') && !q('#pnbCardSub1 option:disabled');
    R.chk.noneOpen = !!o('') && !o('').disabled;
  };

  // ---- (round L) the Sort list; blank fields; Find on pivot tiles; Settings > Cards ------------------------------
  function HMk() { return window.Penumbra.headerMenu; }
  function sortSel() { return q('#pnbCardsSort'); }
  function sortArrow() { return q('#pnbCardsSortDir'); }
  function sortKey0() { var k = HMk().sortKeys(); return k.length ? String(k[0]).toUpperCase() : null; }
  function sortDir0() { var k = HMk().sortKeys(); return k.length ? HMk().sortDir(k[0]) : null; }
  function setSort(v) { var s = sortSel(); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  function cmpBase(a, b) { return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }); }
  function ordered(list, dir) { for (var i = 1; i < list.length; i++) { var c = cmpBase(list[i - 1], list[i]); if (dir === 'asc' ? c > 0 : c < 0) return false; } return list.length > 1; }
  function cardTexts(col, root) { return qa('.pnb-card [data-col="' + col + '"]', root || host()).map(text); }
  async function settled() { await sleep(250); await until(function () { return same(cardRows(), shownRows().map(rowIdx)); }, 6000); await sleep(150); }
  S.csort = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    var opts = sortSel() ? qa('option', sortSel()).map(function (o) { return [o.value, o.textContent]; }) : [];
    R.info.opts = opts.slice(0, 9);
    R.chk.listShown = vis(sortSel()) && opts.length === 7 && opts[0][0] === '' && opts[0][1] === 'Sort: none' && opts.some(function (o) { return o[0] === 'V_NAME' && o[1] === 'Sort: ' + thName('V_NAME'); })
      && !vis(sortArrow());
    // (round M) in the size list's own small style
    var zs = getComputedStyle(q('#pnbCardsSize')), so = getComputedStyle(sortSel()), hz = q('#pnbCardsSize').getBoundingClientRect().height, hs = sortSel().getBoundingClientRect().height;
    R.info.sized = { size: [zs.fontSize, Math.round(hz)], sort: [so.fontSize, Math.round(hs)] };
    R.chk.sortSized = zs.fontSize === so.fontSize && Math.abs(hz - hs) <= 2;
    setSort('V_NAME'); await settled();
    var nm = shownRows().map(function (tr) { return tdText(tr, 'V_NAME'); });
    R.info.pick = { key: sortKey0(), dir: sortDir0(), first: nm.slice(0, 3), sel: sortSel().value };
    R.chk.pickSorts = sortKey0() === 'V_NAME' && sortDir0() === 'asc' && same(cardRows(), shownRows().map(rowIdx)) && ordered(nm, 'asc') && sortSel().value === 'V_NAME';
    R.chk.arrowShown = vis(sortArrow()) && text(sortArrow()) === '↑';
    sortArrow().click(); await settled();
    nm = shownRows().map(function (tr) { return tdText(tr, 'V_NAME'); });
    R.chk.flip = sortKey0() === 'V_NAME' && sortDir0() === 'desc' && ordered(nm, 'desc') && text(sortArrow()) === '↓' && same(cardRows(), shownRows().map(rowIdx));
    // a sort made from the heading's menu (the engine's path): the list shows it
    HMk().sort(fth('V_AMOUNT'), 'desc'); await settled();
    R.info.back = { sel: sortSel().value, arrow: text(sortArrow()), key: sortKey0() };
    R.chk.readsBack = sortSel().value === 'V_AMOUNT' && text(sortArrow()) === '↓';
    setSort(''); await settled();
    R.chk.noneClears = HMk().sortKeys().length === 0 && sortSel().value === '' && !vis(sortArrow());
    await pickView('table');
    R.chk.tableHides = !vis(sortSel()) && !vis(sortArrow());
  };
  S.gsort = async function () {
    await until(function () { return on() && grps().length > 1 && cards().length > 0; }, 10000);
    setSort('V_NAME'); await sleep(600);
    await until(function () { return grps().every(function (g) { return ordered(cardTexts('V_NAME', g), 'asc') || qa('.pnb-card', g).length < 2; }); }, 6000);
    var per = grps().map(function (g) { var t = cardTexts('V_NAME', g); return [t.length, ordered(t, 'asc') || t.length < 2]; });
    R.info.per = per;
    R.chk.bandsSorted = sortKey0() === 'V_NAME' && per.length > 1 && per.every(function (x) { return x[1]; }) && per.filter(function (x) { return x[0] > 2; }).length > 1;
    // a card menu's Sort descending (the engine's item): every band follows too
    rclick(q('.pnb-card-fields dd[data-col="V_NAME"]', cards()[0])); await sleep(150);
    var sd = menu() ? q('.pnb-hm-item[data-act="sortDesc"]', menu()) : null; if (sd) sd.click();
    await until(function () { return grps().every(function (g) { return ordered(cardTexts('V_NAME', g), 'desc') || qa('.pnb-card', g).length < 2; }); }, 6000);
    var per2 = grps().map(function (g) { var t = cardTexts('V_NAME', g); return ordered(t, 'desc') || t.length < 2; });
    R.info.per2 = per2;
    R.chk.menuSortFollows = !!sd && sortDir0() === 'desc' && per2.every(Boolean) && q('#pnbCardsSort').value === 'V_NAME' && text(q('#pnbCardsSortDir')) === '\u2193';
  };
  S.cempty = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    var rows = shownRows(), off = 0, on2 = 0, bad = [], dates = 0;
    cards().forEach(function (c, i) {
      var tr = rows[i], v = tr ? tdText(tr, 'H_NULL') : null, dd = q('.pnb-card-fields dd[data-col="H_NULL"]', c);
      if (v) { if (dd) on2++; else bad.push(['missing', i]); } else { if (!dd) off++; else bad.push(['blank shown', i]); }
      if (q('.pnb-card-fields dd[data-col="V_DATE"]', c)) dates++;
    });
    R.info.empty = { off: off, on: on2, bad: bad.slice(0, 4), dates: dates };
    R.chk.blankOff = off > 20 && bad.filter(function (b) { return b[0] === 'blank shown'; }).length === 0;
    R.chk.filledOn = on2 > 20 && bad.filter(function (b) { return b[0] === 'missing'; }).length === 0;
    R.chk.otherKept = dates === 200;
  };
  S.pfind = async function () {
    await until(function () { return on() && cards().length > 0 && C().state() && C().state().pivot === true && !!FD(); }, 10000);
    // a leaf tile with a plain title ("[Blank]" is search syntax in the filter box)
    var leaf = cards().filter(function (c) { return !c.classList.contains('is-total') && /^[A-Za-z][A-Za-z0-9 ]*$/.test(text(q('.pnb-card-title', c)) || ''); })[0], term = leaf ? text(q('.pnb-card-title', leaf)) : '';
    // a row label: on its tile's title
    FD().open(term); await findSettle();
    var all = hl('pnb-find').concat(hl('pnb-find-cur'));
    R.info.label = { term: term, n: all.length, st: FD()._state(), where: all.slice(0, 3).map(function (r) { return rangeEl(r).className + '|' + rangeText(r); }) };
    R.chk.labelMarked = !!term && all.length > 0 && all.every(inCards) && all.some(function (r) { return !!rangeEl(r).closest('.pnb-card-pv .pnb-card-title'); });
    // a value: on its tile, the tile outlined
    var dd = leaf ? q('.pnb-card-pvfields dd[data-pvc]', leaf) : null, v = dd ? text(dd) : '';
    await findType(v);
    all = hl('pnb-find').concat(hl('pnb-find-cur'));
    R.info.value = { v: v, n: all.length, st: FD()._state(), out: outlined().length };
    R.chk.valueMarked = !!v && all.length > 0 && all.every(inCards) && all.some(function (r) { return !!rangeEl(r).closest('.pnb-card-pv [data-pvc]'); }) && outlined().length === 1;
    // Compact: the tile shows the title and the big number - a value it does not show is named on it
    C().setSize('compact'); await until(function () { return host().classList.contains('is-compact'); }, 4000); await sleep(400);
    await findType(v); await sleep(300);
    var ln = foundLines('find');
    R.info.compact = { lines: ln.slice(0, 3).map(text), n: ln.length };
    R.chk.compactNamed = ln.length > 0 && ln.every(function (b) { return /^Found in: \S/.test(text(b)) && !/#\d|@label/.test(text(b)); });
    FD().close(); C().setSize('standard'); await sleep(300);
    // the search box's marks on the tiles' labels
    await runSearch(term); await until(function () { return hl('pnb-filter').some(inCards); }, 5000); await sleep(200);
    var fr = hl('pnb-filter');
    R.info.filter = { n: fr.length, inCards: fr.filter(inCards).length };
    R.chk.filterOnTiles = fr.length > 0 && fr.every(inCards) && fr.some(function (r) { return !!rangeEl(r).closest('.pnb-card-pv .pnb-card-title'); });
    await runSearch('');
    R.chk.sortHidden = !vis(sortSel());
  };
  function lay() { return q('#spCardsSection'); }
  function layChip(n) { return q('#spCardFields input[value="' + n + '"]'); }
  S.clayout = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    C().sync(); await sleep(100);
    var ts = q('#spCardTitle'), tops = ts ? qa('option', ts).map(function (o) { return o.value; }) : [];
    R.info.sec = { hidden: lay() ? lay().hidden : null, opts: tops };
    R.chk.sectionShown = !!lay() && !lay().hidden && tops[0] === '' && tops.indexOf('V_STATUS') > 0 && qa('#spCardFields input').length === 6 && q('#spCardReset').disabled;
    setSel('spCardTitle', 'V_STATUS'); await sleep(250);
    R.chk.titlePicked = !!slots() && slots().title === 'V_STATUS' && text(q('.pnb-card-title', cards()[0])) === tdText(shownRows()[0], 'V_STATUS');
    ['V_AMOUNT', 'V_ID'].forEach(function (n) { var c = layChip(n); if (c) { c.click(); } }); await sleep(250);
    R.info.slots = slots();
    R.chk.fieldsPicked = !!slots() && same(slots().fields, ['V_ID', 'V_AMOUNT']) && same(qa('.pnb-card-fields dd[data-col]', cards()[0]).map(function (d) { return d.getAttribute('data-col'); }), ['V_ID', 'V_AMOUNT']);
    var pc = (prefs().lrfix || {}).cards;
    R.info.pref = pc;
    R.chk.keptAsPref = !!pc && pc.title === 'V_STATUS' && same(pc.fields, ['V_ID', 'V_AMOUNT']) && !q('#spCardReset').disabled;
    R.chk.authorUntouched = same(bsoCards(), { title: 'V_NAME', fields: ['V_DATE'] });
    R.info.bso = bsoCards();
    q('#spCardReset').click(); await sleep(250);
    R.chk.resetBack = R.chk.titlePicked === true && slots().title === 'V_NAME' && same(slots().fields, ['V_DATE']) && !(prefs().lrfix || {}).cards && q('#spCardTitle').value === '' && q('#spCardReset').disabled;
    // Quick actions' Card title and fields...: Settings open on the section, the title list focused
    var opened = C().openLayout(); await sleep(250);
    R.chk.paletteOpens = opened === true && C().layoutOffered() === true && document.activeElement === q('#spCardTitle');
  };
  S.clayoutB = async function () {
    await until(function () { return on() && cards().length === 200; }, 8000);
    C().sync(); await sleep(100);
    R.info.slots = slots();
    R.chk.seededDrawn = !!slots() && slots().title === 'V_STATUS' && same(slots().fields, ['V_ID', 'V_AMOUNT']);
    R.chk.seededShown = q('#spCardTitle').value === 'V_STATUS' && layChip('V_ID').checked && layChip('V_AMOUNT').checked && text(q('#spCardFieldsCount')) === '2 of 4';
    R.chk.formIsAuthors = q('#pnbCardTitle').value === 'V_NAME' && same(bsoCards(), { title: 'V_NAME', fields: ['V_DATE'] });
  };

  S.pvfind = async function () {
    await until(function () { return on() && cards().length > 0 && C().state() && C().state().pivot === true && !!FD(); }, 10000);
    // a value on a leaf tile's fields (Standard), its label as the tile draws it
    var leaf = cards().filter(function (c) { return !c.classList.contains('is-total') && /^[A-Za-z][A-Za-z0-9 ]*$/.test(text(q('.pnb-card-title', c)) || ''); })[0];
    var title = leaf ? text(q('.pnb-card-title', leaf)) : null;
    var dds = leaf ? qa('.pnb-card-pvfields dd[data-pvc]', leaf).filter(function (d) { return /\d/.test(text(d)); }) : [], dd = dds[1] || dds[0];
    var v = dd ? text(dd) : null, label = dd ? text(dd.previousElementSibling) : null;
    // Compact: the tile shows its title and its big number - the value is named on it, by that same label
    C().setSize('compact'); await until(function () { return host().classList.contains('is-compact'); }, 4000); await sleep(400);
    FD().open(v); await findSettle(); await sleep(300);
    var tile = cards().filter(function (c) { return text(q('.pnb-card-title', c)) === title; })[0], ln = tile ? q('.pnb-card-found.is-find', tile) : null;
    R.info.pv = { title: title, v: v, label: label, line: ln ? text(ln) : null, lines: foundLines('find').slice(0, 3).map(text) };
    R.chk.namedAsField = !!label && /\s/.test(label) && !!ln && text(ln).replace(/^Found in: /, '').split(', ').indexOf(label) >= 0;
    FD().close(); C().setSize('standard');
  };
  S.cdetrow = async function () {
    await until(function () { return on() && cards().length === 25; }, 8000);
    // a page turn takes the card away: the window closes (it never shows another row)
    q('.pnb-card-fields dt', cards()[0]).click(); await sleep(250);
    var before = detOpen() ? detTitle() : null;
    // the page turned as Find turns it (findHost.showRow, no click: a click outside the window closes it by itself)
    window.Penumbra.findHost.showRow(qa('#resultsTable > tbody > tr')[30]); await until(function () { return !detOpen(); }, 3000); await sleep(250);
    R.info.page = { open: detOpen(), before: before, title: detTitle(), page: text(q('#pageInfo')) };
    R.chk.pageCloses = !!before && !detOpen();
    // every row on one page: a sort moves the row, the window follows it
    setSel('rowsPerPageSelector', 'all'); await until(function () { return cards().length === 300; }, 8000); await sleep(200);
    var c3 = cards()[3], t3 = text(q('.pnb-card-title', c3)), r3 = c3.getAttribute('data-row');
    q('.pnb-card-fields dt', c3).click(); await sleep(250);
    var was = detOpen() && detTitle() === t3;
    HMk().sort(fth('V_AMOUNT'), 'desc'); await settled(); await sleep(200);
    var at = C().details().at, now = cards()[at];
    R.info.sort = { was: was, open: detOpen(), title: detTitle(), want: t3, at: at, row: now && now.getAttribute('data-row'), r3: r3, n: cards().length };
    R.chk.sortFollows = was && detOpen() && detTitle() === t3 && !!now && now.getAttribute('data-row') === r3 && at !== 3;
    C().closeDetails();
  };

  (async function () {
    // a scenario's own exception (on live: no switch, no host) is reported apart from the PAGE's errors
    try { await boot(); if (S[SCN]) await S[SCN](); else throw new Error('no scenario ' + SCN); }
    catch (e) { R.fail = String(e && e.stack || e); }
    R.errors = (window.__errors || []).filter(function (x) { return !/ResizeObserver/.test(String(x)); });
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
