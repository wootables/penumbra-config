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
  S.ggcards = async function () {
    await until(function () { return on() && grps().length > 0 && document.body.classList.contains('pnb-gl-on'); }, 10000);
    var ws = wrappers(), st = GL() && GL().state();
    R.chk.listOn = !!st && st.on === true && !!st.selPath && document.body.classList.contains('pnb-gl-on');
    var sel = ws.filter(function (w) { return w.classList.contains('pnb-gl-sel'); })[0];
    R.chk.onePicked = !!sel && cardsOnlyIn(sel) && grpOf(sel).classList.contains('is-picked') && cards().length < 300;
    R.chk.allBands = grps().length === ws.length && grps().every(function (g) { return g.classList.contains('is-list'); }) && grps().filter(function (g) { return g.classList.contains('is-off'); }).length === ws.length - 1
      && qa('.pnb-cards-grptoggle', host()).every(function (t) { return t.hasAttribute('aria-current') && !t.hasAttribute('aria-expanded'); });
    R.info.list = [ws.length, grps().length, st && st.selPath, cards().length];
    var w2 = ws[2], g2 = grpOf(w2);
    q('.pnb-cards-grptoggle', g2).click();
    await until(function () { return GL().state().selPath === pathOf(w2) && grpOf(w2) && grpOf(w2).classList.contains('is-picked') && cardsOnlyIn(w2); }, 5000);
    R.chk.pickClick = GL().state().selPath === pathOf(w2) && w2.classList.contains('pnb-gl-sel') && cardsOnlyIn(w2) && q('.pnb-cards-grptoggle', grpOf(w2)).getAttribute('aria-current') === 'true' && q('.pnb-cards-grptoggle', grpOf(ws[0])).getAttribute('aria-current') === 'false';
    var t3 = q('.pnb-cards-grptoggle', grpOf(ws[3])); t3.focus(); key(t3, 'Enter');
    await until(function () { return GL().state().selPath === pathOf(ws[3]) && cardsOnlyIn(ws[3]); }, 5000);
    R.chk.pickKey = GL().state().selPath === pathOf(ws[3]) && cardsOnlyIn(ws[3]);
    // the list's own pick (as its row click does): the cards follow live
    GL().select(pathOf(ws[1]));
    await until(function () { return GL().state().selPath === pathOf(ws[1]) && cardsOnlyIn(ws[1]); }, 5000);
    R.chk.listPick = GL().state().selPath === pathOf(ws[1]) && cardsOnlyIn(ws[1]) && grpOf(ws[1]).classList.contains('is-picked');
    await pickView('table');
    var tablePick = GL().state().selPath === pathOf(ws[1]) && ws[1].classList.contains('pnb-gl-sel') && !ws[1].classList.contains('pnb-gl-off');
    await pickView('cards');
    R.chk.keptAcrossViews = tablePick && cardsOnlyIn(ws[1]) && grpOf(ws[1]).classList.contains('is-picked');
    if (P.get('shot') && P.get('theme')) { var t = (window.__THEMES || []).filter(function (x) { return x.id === P.get('theme'); })[0]; if (t) applyTheme(t); await sleep(300); }
  };
  S.gglnest = async function () {
    await until(function () { return on() && grps().length > 0 && document.body.classList.contains('pnb-gl-on'); }, 10000);
    var ws = wrappers(), st = GL() && GL().state();
    var branches = ws.filter(function (w) { return w.classList.contains('group-branch'); }), leaves = ws.filter(function (w) { return w.classList.contains('group-leaf'); });
    R.chk.listOn = !!st && st.on === true && branches.length >= 5 && leaves.length > branches.length;
    var b1 = branches[1];
    q('.pnb-cards-grptoggle', grpOf(b1)).click();
    await until(function () { return GL().state().selPath === pathOf(b1) && cardsOnlyIn(b1); }, 5000);
    var inner = qa('.group-wrapper.group-leaf', b1);
    R.chk.branchPick = GL().state().selPath === pathOf(b1) && cardsOnlyIn(b1) && inner.every(function (l) { return qa('.pnb-card', grpOf(l)).length > 0; }) && grpOf(b1).classList.contains('is-picked');
    R.info.nest = [branches.length, leaves.length, inner.length, cards().length];
    var l0 = inner[0];
    q('.pnb-cards-grptoggle', grpOf(l0)).click();
    await until(function () { return GL().state().selPath === pathOf(l0) && cardsOnlyIn(l0); }, 5000);
    R.chk.leafPick = GL().state().selPath === pathOf(l0) && cardsOnlyIn(l0) && grpOf(l0).classList.contains('is-picked') && !grpOf(b1).classList.contains('is-picked');
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
    if (menu()) keyOn(document.activeElement, 'Escape'); await sleep(100);
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
  S.gmenu = async function () {
    await until(function () { return on() && grps().length > 0; }, 10000);
    var g0 = grps()[0], tg = q('.pnb-cards-grptoggle', g0);
    var ev = rclick(tg); await sleep(80);
    var m = menu(), a = acts(); R.info.bandActs = a;
    R.chk.bandMenu = ev.defaultPrevented && !!m && text(q('.pnb-hm-name', m)) === text(q('.pnb-cards-grpname', g0)) && a.indexOf('gToggle') >= 0 && a.indexOf('gCollapseAll') >= 0 && a.indexOf('cardSize') >= 0 && a.indexOf('cardsTable') >= 0;
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

  (async function () {
    // a scenario's own exception (on live: no switch, no host) is reported apart from the PAGE's errors
    try { await boot(); if (S[SCN]) await S[SCN](); else throw new Error('no scenario ' + SCN); }
    catch (e) { R.fail = String(e && e.stack || e); }
    R.errors = (window.__errors || []).filter(function (x) { return !/ResizeObserver/.test(String(x)); });
    window.__HCRESULT = R; window.__HCDONE = true;
  })();
})();
